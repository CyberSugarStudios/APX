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
        ]
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
        }
    ];

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
        let close = () => { back.remove(); s.rulesNotices = []; if (typeof window.recalculateMath === 'function') window.recalculateMath(); };
        back.querySelector('[data-act="ok"]').onclick = close;
        back.querySelectorAll('[data-recraft]').forEach(b => b.onclick = () => {
            let idx = Number(b.dataset.recraft);
            close();
            if (typeof window.openPowerEditor === 'function') window.openPowerEditor(idx, 'player');
        });
        document.body.appendChild(back);
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
