// ============================================================
// APX Rules Migrations
// ============================================================
// Old characters must always load, keep everything they had, and save in
// the current format afterwards. Every rules change that touches saved data
// gets ONE entry below. Entries only ever add or adjust; they never delete a
// player's stuff.
//
//   state.rulesVersion   which migrations this character has already had
//   state.rulesNotices   [{v, title, text}] messages the player hasn't
//                        dismissed yet (shown once, in a themed popup)
//
// Powers are handled separately and dynamically: each saved power remembers
// the Power Crafting rules revision it was built under (power.rulesRev).
// When a newer revision changes something that power uses, it is flagged
// "Recraft (free)" everywhere it's listed until it's re-saved in the crafter.
// That works for player powers, companion powers, and GM NPC powers alike.
// ============================================================
(function () {
    'use strict';

    // ── Power Crafting rule revisions ──────────────────────────────
    // test(draft) -> true when a power built with that draft is affected.
    const POWER_RULE_CHANGES = {
        2: [
            {
                id: 'maxDice8',
                test: d => (window.POWER_DIE_STEPS || ['d4', 'd6', 'd8', 'd10', 'd12']).some(s => ((d.dmg || {})[s] || 0) > 8),
                text: 'Max dice per die step is now 8 (was 12). Lower any die step above 8.'
            },
            {
                id: 'sacrifice',
                test: d => !!(d.refunds && d.refunds.sacrifice),
                text: 'Sacrifice now also stops you regaining HP from any source (including this power) until the start of your next turn.'
            }
        ],
        // Step 7 AP Modifications reworked: 1 AP is 30 XP (was 35), Reaction is its own 15 XP option
        // with a set trigger, and Lengthy Cast Time comes in lengths (1 Minute is the old one)
        4: [
            { id: 'ap1', test: d => d.apMod === 'ap1' && !d.apReaction, text: 'Step 7 changed: 1 AP now costs 30 XP (was 35). Rebuild it to get the difference back, or keep it as it is.' },
            { id: 'reaction', test: d => d.apMod === 'ap1' && !!d.apReaction, text: 'Step 7 changed: Reaction is now its own AP option for 15 XP (was 35), with a set condition for when it\'s used. Rebuild it to name its trigger and get the difference back, or keep it as it is.' },
            { id: 'lengthy', test: d => d.apMod === 'lengthy', text: 'Step 7 changed: Lengthy Cast Time now comes in lengths from 1 Minute (-15 XP, the same as before) to 24 Hours (-60 XP). Rebuild it to choose a length, or keep it as it is.' }
        ],
        // Step 3 Targeting reworked: AoE is x3 plus a shape crafted to an exact size
        // (Line 0.5 XP per square, Cone 3 XP per square of length, Burst 10 XP per square of radius)
        5: [
            { id: 'aoeShape', test: d => ['small', 'medium', 'large', 'massive'].includes(d.aoe), text: 'Step 3 (Targeting) changed: areas are no longer fixed sizes. An AoE is now x3, plus its shape crafted to an exact size: Line 0.5 XP per square, Cone 3 XP per square of length, Burst 10 XP per square of radius. Rebuild it to choose its shape and size.' }
        ],
        // Powers cap at 200 XP (a free power could be built far past Level 5): rebuild to 200 or less, free
        6: [
            { id: 'xpCap', test: d => typeof window.pcCalcXP === 'function' && window.pcCalcXP(d).total > (window.APX_POWER_MAX_XP || 200), text: 'Powers now cap at the top of Level 5 (200 XP for a character\'s power; Level 5\'s TP for an NPC\'s), and this one is built past it. Rebuild it to fit (free): a character gets back any XP paid over the new cost, and can\'t use it until then.' }
        ],
        // Saving throws name their Core Attribute; lasting effects get an Escape Save the target can pass
        3: ['save', 'cond', 'escape', 'actionInt'].map(k => ({
            id: 'powerSaves_' + k,
            test: d => !!window.apxPowerSaveInfo && window.apxPowerSaveInfo(d).problems.includes(k),
            text: ({
                save: 'Saving throws now name a Core Attribute: choose which one targets use to resist this power (Step 1).',
                cond: 'Choose which Condition this power inflicts or ends (Step 5), so its Escape Save can be checked.',
                escape: 'A power that leaves a lasting effect on its target now gives it an Escape Save at the end of each of its turns, using an attribute the effect doesn\'t make it auto-fail. Choose one (Step 6).',
                actionInt: 'Action Interrupt can\'t be taken on a power that inflicts Stunned, Paralyzed, or Unconscious (an Incapacitated creature can\'t spend AP). Remove it (Step 6).'
            })[k]
        }))
    };
    window.APX_POWER_RULES_REV = Math.max(...Object.keys(POWER_RULE_CHANGES).map(Number));

    // Reasons this saved power should be recrafted (empty array = it's fine).
    window.apxPowerRecraftReasons = function (p) {
        if (!p || !p.draft) return [];
        let from = p.rulesRev || 1, out = [];
        for (let v = from + 1; v <= window.APX_POWER_RULES_REV; v++) {
            (POWER_RULE_CHANGES[v] || []).forEach(c => { try { if (c.test(p.draft)) out.push(c.text); } catch (e) { } });
        }
        return out;
    };
    window.apxPowerNeedsRecraft = p => window.apxPowerRecraftReasons(p).length > 0;
    // Over the 200 XP cap: can't be used until it's rebuilt (checked on its build, whenever it was saved)
    window.apxPowerOverCap = p => !!(p && p.draft && typeof window.pcCalcXP === 'function' && (() => { try { return window.pcCalcXP(p.draft).total > (window.APX_POWER_MAX_XP || 200); } catch (e) { return false; } })());

    // Small reusable badge/button for power lists
    window.apxRecraftBadge = function (p, onclickJs) {
        if (!window.apxPowerNeedsRecraft(p)) return '';
        let tip = window.apxPowerRecraftReasons(p).join('\n').replace(/"/g, '&quot;');
        return `<button onclick="${onclickJs}" data-tip="${tip}" class="apx-recraft-badge">Rules changed: Recraft (Free)</button>`;
    };

    // ── Character migrations ───────────────────────────────────────
    // Each run(s) mutates the state in place and returns notices to show.
    const CHARACTER_MIGRATIONS = [
        {
            v: 2, label: 'Playtest update (Sept 23, 2026)',
            run(s) {
                let notes = [];
                let traits = (s.ancestry && s.ancestry.traits) || [];
                let regen = traits.filter(t => t === 't_reg').length;
                if (regen && typeof s.ancestry.gpUsed === 'number') {
                    s.ancestry.gpUsed = Math.max(0, s.ancestry.gpUsed - regen);
                    notes.push({ title: 'Regenerative', text: 'Now costs 3 GP (was 4), so you got 1 GP back to spend in the Ancestry editor. New effect: at the beginning of your turn in combat you can expend a Rest Die, rolling it, and heal for the result (use the "Regen" button under your AP).' });
                }
                if ((s.perks || {}).agi_mobile) {
                    notes.push({ title: 'Mobile (Rank 1)', text: 'Now reads: "Each time you spend AP to move on your turn, the cost is reduced by 1 AP (to a minimum of 0 AP). Additionally, you ignore the penalties of difficult terrain."' });
                }
                let flagged = []
                    .concat((s.powers || []).filter(window.apxPowerNeedsRecraft).map(p => p.name))
                    .concat(((s.companion && s.companion.powers) || []).filter(window.apxPowerNeedsRecraft).map(p => (p.name) + ' (companion)'));
                if (flagged.length) {
                    notes.push({ title: 'Power Crafting rules changed', text: `These powers use a rule that changed: ${flagged.join(', ')}. Open each one with "Recraft (Free)" to rebuild it under the new rules. Lowering its cost refunds the difference; nothing is lost in the meantime.` });
                }
                return notes;
            }
        },
        {
            v: 3, label: 'AP and rests update (Sept 23, 2026)',
            run(s, from) {
                let notes = [];
                let score = ((s.baseStats && s.baseStats.AGI) || 5) + ((s.ancestry && s.ancestry.bonuses && s.ancestry.bonuses.AGI) || 0);
                let mod = score - 5;
                let oldAp = Math.max(6, 6 + mod), newAp = Math.max(6, 6 + Math.floor(mod / 2));
                if (oldAp !== newAp) notes.push({ title: 'Action Points', text: 'AP is now 6 + half your AGI modifier (rounded down, minimum 6), so your AP is lower than before. Your sheet shows the new value.' });
                // Characters already updated by the earlier build saw the old Regenerative wording
                if (from === 2 && ((s.ancestry && s.ancestry.traits) || []).includes('t_reg'))
                    notes.push({ title: 'Regenerative', text: 'Full replacement: at the beginning of your turn in combat you can expend a Rest Die, rolling it, and heal for the result (the "Regen" button under your AP). It no longer heals your CON modifier each turn.' });
                return notes;
            }
        },
        {
            v: 4, label: 'Companion gear update (Sept 23, 2026)',
            run(s) {
                let c = s.companion;
                if (!c || !window.companionGearTp || !((c.weapons || []).length || (c.equippedArmor && c.equippedArmor.name))) return [];
                let g = window.companionGearTp(c);
                if (!g.total) return [];
                return [{ title: 'Companion gear now costs Threat Points', text: `Manufactured weapons and armor now count against your companion's TP, priced like the innate weapon they imitate. ${c.name || 'Your companion'}'s gear is worth ${g.total} TP. Nothing was removed: if that puts it over budget, its TP total shows in red in the NPC Crafter until you buy more TP or change its gear.` }];
            }
        },
        {
            v: 5, label: 'Per-character GP limit',
            run(s) {
                // The Ancestry GP limit used to be a single browser-wide box. Keep any
                // character that was built over 15 GP valid by remembering its own limit.
                if (s.ancestry && s.ancestry.gpLimit === undefined) s.ancestry.gpLimit = Math.max(15, s.ancestry.gpUsed || 0);
                return [];
            }
        },
        {
            v: 6, label: 'Ammo stacks, High Roller and Fortunate Fighter (Sept 24, 2026)',
            run(s) {
                let notes = [];
                window.apxNormalizeAmmo(s);
                let p = s.perks || {};
                if (p.luc_highroller) notes.push({ title: 'High Roller', text: 'Updated: a Gamble that hits adds +5 damage (+10 from Rank 4, which also gives you 1 AP). Rank 3 now lets you roll a Luck Point reroll with Advantage or Disadvantage. Rank 5 is a Dice Explosion you declare before rolling damage: each die that rolls its maximum is rolled once more and added.' });
                if (p.luc_fortunatefighter) notes.push({ title: 'Fortunate Fighter (Rank 1)', text: 'Now: when determining your AC, you may replace your AGI with your LUC. It no longer adds LUC on top of AGI. Your sheet uses whichever is higher, so your AC may be lower than before.' });
                return notes;
            }
        },
        {
            v: 7, label: 'Inventory stacks (Sept 27, 2026)',
            run(s) {
                // Identical items looted or received separately (three Leather Armors) become one row
                window.apxMergeInventoryStacks(s);
                return [];
            }
        },
        {
            v: 8, label: 'Core Attributes from XP kept apart',
            run(s) {
                // Core Attributes bought with XP (and Permanent Injuries) used to be added to the base
                // set at creation, so the Ancestry builder said things like "Point Buy: 10 of 7".
                // They now live in attrAdj. Scores don't change: only where the points are kept.
                if (!s.baseStats) return [];
                let adj = {};
                let re = /^(STR|AGI|CON|PER|INT|CHA|LUC) (\d+) → (\d+)$/;
                (s.xpLog || []).forEach(e => {
                    let m = re.exec(String(e && e.what || ''));
                    if (!m) return;
                    adj[m[1]] = (adj[m[1]] || 0) + (e.type === 'refund' ? -1 : 1);
                });
                (s.permanentInjuries || []).forEach(pi => { if (pi && pi.attr) adj[pi.attr] = (adj[pi.attr] || 0) - 1; });
                s.attrAdj = s.attrAdj || {};
                Object.keys(adj).forEach(a => {
                    let n = adj[a], base = (s.baseStats[a] || 5) - n;
                    if (!n || base < 2 || base > 10) return;   // can't tell: leave it as it was
                    s.baseStats[a] = base;
                    s.attrAdj[a] = (s.attrAdj[a] || 0) + n;
                });
                return [];
            }
        },
        {
            v: 9, label: 'Powers rework',
            run(s) {
                // Each power now picks its own Core Attribute, and INT/CHA Powers are now Full Rest /
                // Short Rest Powers. Existing powers keep exactly what they used before.
                let was = s.powerAttr === 'CHA' ? 'CHA' : 'INT';
                (s.powers || []).forEach(p => {
                    if (!p) return;
                    if (!p.attr) p.attr = was;
                    if (!p.pool) p.pool = was === 'CHA' ? 'short' : 'full';
                    if (p.draft) { if (!p.draft.coreAttr) p.draft.coreAttr = p.attr; if (!p.draft.pool) p.draft.pool = p.pool; }
                });
                let perks = s.perks || {};
                if ((s.powers || []).length || perks.pwr_int || perks.pwr_cha) return [{ title: 'Powers reworked',
                    text: 'Intelligence Powers are now Full Rest Powers and Charisma Powers are now Short Rest Powers, and you can have both. Each power now uses the Core Attribute you choose for it in the Power Crafter (its Attack Bonus and Save DC). Your powers keep the attribute they used before (' + was + ').' }];
                return [];
            }
        },
        {
            v: 10, label: 'Grapple rework',
            run(s) {
                // Grab / Grapple / Pin became Grapple / Pin: Grabbed is now Grappled
                if (Array.isArray(s.conditions) && s.conditions.includes('grabbed')) {
                    s.conditions = s.conditions.map(c => c === 'grabbed' ? 'grappled' : c).filter((c, i, a) => a.indexOf(c) === i);
                }
                if (Array.isArray(s.pinnedActions)) s.pinnedActions = s.pinnedActions.filter(n => n !== 'Grab');
                return [];
            }
        },
        {
            v: 11, label: 'Local dates',
            run(s) {
                // Notes made automatically (the Languages note) were dated in UTC, a day ahead on an evening
                // in the Americas. Their id holds when they were made: date them in local time instead.
                (s.charNotes || []).forEach(n => {
                    let m = n && /^cn_lang_(\d{12,})$/.exec(String(n.id || ''));
                    if (!m) return;
                    let t = parseInt(m[1], 10), utc = new Date(t).toISOString().slice(0, 10);
                    if (n.date === utc && window.apxToday) n.date = window.apxToday(t);
                });
                return [];
            }
        }
    ];
    // Joins identical inventory rows into one stack (worn items and part-used consumables stay apart)
    window.apxMergeInventoryStacks = function (s) {
        if (!s || !Array.isArray(s.items) || typeof window.apxItemsStack !== 'function') return;
        let out = [];
        s.items.forEach(it => {
            if (!it) return;
            let same = out.find(o => window.apxItemsStack(o, it) && !(it.isCustomEquippable && it.equipped));
            if (same) same.ct = (parseInt(same.ct) || 0) + (parseInt(it.ct) || 0);
            else out.push(it);
        });
        s.items = out;
    };

    // Ammo is one stack per type ("Medium Ammo"), counted in rounds, with per-round weight
    // and value. Older sheets could have "Medium Ammo (20)" stacks (sometimes several).
    window.apxNormalizeAmmo = function (s) {
        let gear = (typeof ADVENTURING_GEAR !== 'undefined' ? ADVENTURING_GEAR : []).filter(g => g.cat === 'Ammo');
        if (!gear.length || !Array.isArray(s.items)) return;
        gear.forEach(g => {
            let base = g.name.replace(/\s*\(20\)\s*$/, '');
            let stacks = s.items.filter(i => i && !i.isConsumable && (i.name === g.name || i.name === base));
            if (!stacks.length) return;
            let keep = stacks[0];
            let rounds = stacks.reduce((t, i) => t + (parseInt(i.ct) || 0), 0);
            keep.name = base; keep.ct = rounds;
            keep.wt = g.wt / 20; keep.val = g.cost / 20;
            s.items = s.items.filter(i => i === keep || !stacks.includes(i));
        });
    };
    window.APX_RULES_VERSION = Math.max(...CHARACTER_MIGRATIONS.map(m => m.v));

    // Runs any migrations this state hasn't had. Safe to call as often as you like.
    window.apxMigrateCharacter = function (s) {
        if (!s || typeof s !== 'object') return false;
        let from = Number(s.rulesVersion) || 1;
        if (from >= window.APX_RULES_VERSION) return false;
        if (!Array.isArray(s.rulesNotices)) s.rulesNotices = [];
        CHARACTER_MIGRATIONS.filter(m => m.v > from).sort((a, b) => a.v - b.v).forEach(m => {
            try {
                (m.run(s, from) || []).forEach(n => s.rulesNotices.push(Object.assign({ v: m.v }, n)));
            } catch (e) { console.warn('APX migration v' + m.v + ' skipped:', e); }
        });
        s.rulesVersion = window.APX_RULES_VERSION;
        if (s === window.state && s.rulesNotices.length) window.apxMaybeShowRulesNotices();
        return true;
    };

    // GM race templates: same GP fix as characters (Regenerative 4 → 3 GP).
    window.apxMigrateRace = function (r) {
        if (!r || typeof r !== 'object' || (r.rulesVersion || 1) >= 2) return r;
        let a = r.ancestry || r;
        let regen = ((a && a.traits) || []).filter(t => t === 't_reg').length;
        if (regen && typeof a.gpUsed === 'number') a.gpUsed = Math.max(0, a.gpUsed - regen);
        r.rulesVersion = 2;
        return r;
    };

    // Brand-new characters start on the current rules (nothing to migrate).
    window.apxStampNewCharacter = function (s) { if (s) { s.rulesVersion = window.APX_RULES_VERSION; s.rulesNotices = []; } return s; };

    // Normalise an incoming saved state before it's merged into window.state,
    // so an old save (no rulesVersion) never inherits the previous character's.
    window.apxPrepareLoadedState = function (incoming) {
        if (!incoming || typeof incoming !== 'object') return incoming;
        if (incoming.rulesVersion === undefined) incoming.rulesVersion = 1;
        if (!Array.isArray(incoming.rulesNotices)) incoming.rulesNotices = [];
        return incoming;
    };

    // ── "Rules updated" popup for the current character ─────────────
    let shownFor = null;
    window.apxMaybeShowRulesNotices = function () {
        let s = window.state;
        if (!s || !Array.isArray(s.rulesNotices) || !s.rulesNotices.length) return;
        let key = (s.id || s.name || '') + ':' + s.rulesNotices.length;
        if (shownFor === key || document.querySelector('[data-apx-rules-popup]')) return;
        shownFor = key;
        setTimeout(() => window.apxShowRulesNotices(), 300);
    };

    window.apxShowRulesNotices = function () {
        let s = window.state;
        let notes = (s && s.rulesNotices) || [];
        if (!notes.length) return;
        let esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        if (window.apxInjectDialogStyles) window.apxInjectDialogStyles();
        let recraftRows = (s.powers || []).map((p, i) => ({ p, i })).filter(x => window.apxPowerNeedsRecraft(x.p));
        let back = document.createElement('div');
        back.className = 'apxdlg-back';
        back.setAttribute('data-apx-rules-popup', '1');
        back.innerHTML = `<div class="apxdlg" style="width:min(520px,100%);max-height:85vh;overflow:auto">
            <div class="apxdlg-title">Rules updated for ${esc(s.name || 'this character')}</div>
            <div class="apxdlg-msg" style="margin-bottom:.6rem">Your character was updated to the latest rules. Nothing was removed.</div>
            ${notes.map(n => `<div style="border:1px solid var(--c-border);border-radius:.5rem;padding:.5rem .65rem;margin-bottom:.45rem;background:var(--c-surface2)">
                <div style="font-weight:800;font-size:.78rem;color:var(--c-text)">${esc(n.title)}</div>
                <div style="font-size:.74rem;color:var(--c-text-dimmer);line-height:1.4">${esc(n.text)}</div></div>`).join('')}
            ${recraftRows.length ? `<div style="font-weight:800;font-size:.72rem;margin:.6rem 0 .3rem;color:var(--c-text)">Powers to recraft (free)</div>
                ${recraftRows.map(x => `<div style="display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin-bottom:.3rem">
                    <span style="font-size:.76rem;color:var(--c-text-dimmer)">${esc(x.p.name)} <span style="opacity:.7">(Lvl ${x.p.lvl})</span></span>
                    <button class="apxdlg-btn apxdlg-ok" data-recraft="${x.i}">Recraft (Free)</button></div>`).join('')}` : ''}
            <div class="apxdlg-row" style="margin-top:.8rem"><button class="apxdlg-btn apxdlg-ok" data-act="ok">Got it</button></div>
        </div>`;
        let close = () => { back.remove(); s.rulesNotices = []; if (typeof window.recalculateMath === 'function') window.recalculateMath(); setTimeout(() => window.apxPlayerConsumableRemake && window.apxPlayerConsumableRemake(), 300); };
        back.querySelector('[data-act="ok"]').onclick = close;
        back.querySelectorAll('[data-recraft]').forEach(b => b.onclick = () => {
            let idx = Number(b.dataset.recraft);
            close();
            if (typeof window.openPowerEditor === 'function') window.openPowerEditor(idx, 'player');
        });
        document.body.appendChild(back);
    };

    // ── "Powers to rebuild" list ────────────────────────────────────
    // Shown when a character sheet or a GM's world opens while powers built under older rules still
    // need rebuilding (a free Recraft). Each row opens the crafter; when it closes, the list updates,
    // and it goes away once nothing is left. "Later" hides it until the next launch.
    //   opts: { id, title, intro, rows: () => [{ key, name, sub, open() }], busy: [modal ids], doneText }
    let rbState = {};
    window.apxRebuildList = function (opts) {
        let esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        if (window.apxInjectDialogStyles) window.apxInjectDialogStyles();
        let domId = 'apxRebuild_' + opts.id;
        let st = rbState[opts.id] || (rbState[opts.id] = {});
        let busy = () => (opts.busy || []).some(m => document.getElementById(m)?.classList.contains('active'));
        let render = () => {
            let rows = opts.rows();
            let back = document.getElementById(domId);
            if (!rows.length) {
                if (back) { back.remove(); if (st.started && window.APXDice) window.APXDice.notify(opts.doneText || 'Everything is rebuilt.', { kind: 'loot' }); }
                return;
            }
            if (!back) {
                back = document.createElement('div');
                back.id = domId; back.className = 'apxdlg-back'; back.setAttribute('data-apx-rebuild', opts.id);
                document.body.appendChild(back);
            }
            back.style.display = '';
            back.innerHTML = `<div class="apxdlg" style="width:min(520px,100%);max-height:85vh;overflow:auto">
                <div class="apxdlg-title">${esc(opts.title)}</div>
                <div class="apxdlg-msg" style="margin-bottom:.6rem">${esc(opts.intro)}</div>
                ${rows.map(r => `<div style="display:flex;align-items:center;justify-content:space-between;gap:.5rem;border:1px solid var(--c-border,#334155);border-radius:.5rem;padding:.4rem .6rem;margin-bottom:.35rem;background:var(--c-surface2,#0f172a)">
                    <div style="min-width:0"><div style="font-weight:800;font-size:.78rem;color:var(--c-text,#e2e8f0)">${esc(r.name)}</div>
                        ${r.sub ? `<div style="font-size:.68rem;color:var(--c-text-dimmer,#94a3b8);line-height:1.35">${esc(r.sub)}</div>` : ''}</div>
                    <button class="apxdlg-btn apxdlg-ok" data-rb="${esc(r.key)}" style="flex-shrink:0">Rebuild</button></div>`).join('')}
                <div class="apxdlg-row" style="margin-top:.7rem"><button class="apxdlg-btn" data-rb-later>Later</button></div></div>`;
            back.querySelector('[data-rb-later]').onclick = () => { back.remove(); st.later = true; };
            back.querySelectorAll('[data-rb]').forEach(b => b.onclick = () => {
                let r = rows.find(x => x.key === b.dataset.rb); if (!r) return;
                st.started = true;
                back.style.display = 'none';
                try { r.open(); } catch (e) { console.warn('Rebuild:', e); }
                // Back to the list once the crafter closes
                clearInterval(st.watch);
                let seen = false;
                st.watch = setInterval(() => {
                    if (busy()) { seen = true; return; }
                    if (!seen && Date.now() - (st.t0 || 0) < 1500) return;
                    clearInterval(st.watch);
                    if (document.getElementById(domId)) render();
                }, 400);
                st.t0 = Date.now();
            });
        };
        if (document.getElementById(domId)) { if (document.getElementById(domId).style.display !== 'none') render(); return; }
        render();
    };

    // The character sheet: the player's (and their companion's) powers
    let rbShownFor = null, rbWaiting = false;
    window.apxMaybeShowPowerRebuild = function () {
        let s = window.state;
        if (!s || typeof window.openPowerEditor !== 'function') return;
        let list = () => [].concat(
            (s.powers || []).map((p, i) => ({ p, i, who: 'player' })),
            ((s.companion && s.companion.powers) || []).map((p, i) => ({ p, i, who: 'companion' })))
            .filter(x => x.p && window.apxPowerNeedsRecraft(x.p));
        let key = (s.id || s.name || '') + ':' + (s.rulesVersion || 0);
        if (rbShownFor === key || rbWaiting) return;
        if (!list().length) return;
        // after the "Rules updated" popup or the tutorial, if one is up
        if (document.querySelector('[data-apx-rules-popup]') || document.querySelector('.apxtut-back') || ['powerCrafterModal', 'npcCrafterModal', 'consumableCrafterModal'].some(m => document.getElementById(m)?.classList.contains('active'))) { rbWaiting = true; setTimeout(() => { rbWaiting = false; window.apxMaybeShowPowerRebuild(); }, 1500); return; }
        rbShownFor = key;
        window.apxRebuildList({
            id: 'sheet', title: 'Powers to rebuild',
            intro: `The Power Crafting rules changed in ways that affect ${s.name || 'this character'}'s powers. Rebuild each one in the Power Crafter: it's free, and nothing is lost in the meantime. Area powers need rebuilding because Step 3 (Targeting) now crafts each area's shape and size exactly. A power listed only for the Step 7 AP changes (1 AP, Reaction, Lengthy Cast Time) is yours to rebuild or keep: rebuilding refunds any XP it now costs less. Powers now cap at 200 XP: one that costs more can't be used until it's rebuilt to 200 XP or less (free).`,
            busy: ['powerCrafterModal', 'npcCrafterModal'],
            doneText: 'All your powers are rebuilt.',
            rows: () => {
                let cur = window.state; if (cur !== s) return [];
                return list().map(x => ({ key: x.who + ':' + x.i, name: `${x.p.name || 'Power'}${x.who === 'companion' ? ' (' + ((s.companion && s.companion.name) || 'companion') + ')' : ''} · Lvl ${x.p.lvl}`,
                    sub: window.apxPowerRecraftReasons(x.p).join(' '), open: () => window.openPowerEditor(x.i, x.who) }));
            }
        });
    };

    // GM Tools: stat blocks in the open world whose powers need rebuilding (one row per NPC)
    let rbGmShown = {};
    window.apxGmRebuildCheck = function (force) {
        if (!Array.isArray(window.gmNpcs) || typeof window.openGmNpcBuilder !== 'function') return;
        let w = window.apxGmActiveWorld ? window.apxGmActiveWorld() : null;
        let wk = w ? (w.worldId || w.id || w.name) : '_';
        let inWorld = e => typeof window.apxNpcInActiveWorld !== 'function' || window.apxNpcInActiveWorld(e);
        let flaggedIdx = e => ((e.npc && e.npc.powers) || []).map((p, i) => window.apxPowerNeedsRecraft(p) ? i : -1).filter(i => i >= 0);
        let rows = () => window.gmNpcs.filter(e => e && e.npc && inWorld(e) && flaggedIdx(e).length).map(e => ({
            key: e.id, name: e.npc.name || 'Unnamed NPC',
            sub: flaggedIdx(e).map(i => e.npc.powers[i].name || 'Power').join(', '),
            open: () => {
                window.openGmNpcBuilder(e.id);
                // Each of its powers in turn, as long as the last one was rebuilt
                let walk = n => {
                    let idx = flaggedIdx(e); if (!idx.length) return;
                    window.openPowerEditor(idx[0], 'gm');
                    let wt = setInterval(() => {
                        if (document.getElementById('powerCrafterModal')?.classList.contains('active')) return;
                        clearInterval(wt);
                        let left = flaggedIdx(e).length;
                        if (left && left < n && document.getElementById('npcCrafterModal')?.classList.contains('active')) walk(left);
                    }, 400);
                };
                setTimeout(() => walk(flaggedIdx(e).length), 150);
            }
        }));
        if (rbGmShown[wk] && !force) return;
        if (!rows().length) return;
        if (document.querySelector('.apxtut-back')) { setTimeout(() => window.apxGmRebuildCheck(force), 1500); return; }
        rbGmShown[wk] = true;
        window.apxRebuildList({
            id: 'gm', title: 'NPCs to rebuild',
            intro: `The Power Crafting rules changed (saving throws name a Core Attribute, lasting effects give their target an Escape Save, Step 3 crafts each area's exact shape and size, and Step 7's AP options were reworked). These NPCs${w && w.name ? ' in ' + w.name : ''} have powers to rebuild. Rebuild opens each NPC and walks you through its powers; finished NPCs drop off this list. Powers listed only for the Step 7 changes can be kept as they are.`,
            busy: ['powerCrafterModal', 'npcCrafterModal'],
            doneText: 'Every NPC is rebuilt.',
            rows
        });
    };

    // Shared badge styling (themed)
    function injectCss() {
        if (document.getElementById('apxMigrationCss')) return;
        let st = document.createElement('style');
        st.id = 'apxMigrationCss';
        st.textContent = `.apx-recraft-badge{display:inline-block;margin-top:.25rem;font-size:9px;font-weight:800;padding:.1rem .45rem;border-radius:.3rem;
            background:var(--c-amber,#d97706);color:#fff;border:0;cursor:pointer}.apx-recraft-badge:hover{filter:brightness(1.1)}`;
        document.head.appendChild(st);
    }
    if (document.head) injectCss(); else document.addEventListener('DOMContentLoaded', injectCss);
})();
