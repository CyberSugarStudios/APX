// ============================================================
// APX Actions (Character Sheet): Combat Maneuvers and Standard Actions
// ============================================================
// Click "Action Points" in Vitals: every maneuver and standard action from the rulebook, with its
// AP cost. Picking one spends the AP (short on AP? it asks "do it anyway?") and applies what can be
// applied automatically. Ongoing effects live in state.turnFx and show as chips (with a red ✕) under
// Armor & Defenses until they end:
//   until: 'turn'   → until the start of your next turn (cleared when your turn's AP is added)
//   until: 'attack' → until you next attack (also cleared at your next turn)
//   next: {...}     → applies to your next attack only (Disadvantage, extra damage)
// ============================================================
(function () {
    'use strict';
    const st = () => window.state;
    const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const mod = a => (typeof calc !== 'undefined' && calc.mods && calc.mods[a]) || 0;
    const fx = () => { let s = st(); if (!s) return []; if (!Array.isArray(s.turnFx)) s.turnFx = []; return s.turnFx; };
    const uid = () => 'fx' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const note = (t, kind) => window.APXDice?.notify(t, { kind: kind || 'note' });
    function shieldAc() {
        let s = st(), ac = 0;
        if (s.equippedShield && s.equippedShield.equipped) ac += parseInt(s.equippedShield.ac) || 0;
        (s.extraShields || []).forEach(x => { ac += parseInt(x.ac) || 0; });
        return ac;
    }
    // A worn Bandolier or Utility Belt: drawing or stowing an item on it takes half the AP
    // Heavy weapons (and a Grappled creature, wielded as a Heavy improvised weapon at Brute Rank 1)
    function heavyWeapons() { return (st().weapons || []).filter(w => w && w.weightClass === 'heavy'); }
    function turnKey() { let ct = window._pwCombatTurn; return ct && ct.id ? (ct.session || '') + ':' + (ct.round || 0) + ':' + (ct.turnNo || 0) : null; }
    function groundStrikeUsed() { let k = turnKey(); return !!(k && st().groundStrikeTurn === k); }
    // Brute Rank 5: Ground Strike. With a battle map open, a 2-square burst around you picks who's in it; the
    // GM's tracker rolls their AGI saves and deals the damage (half on a save, Prone on a failure)
    async function groundStrike() {
        let s = st(), rank = (s.perks || {}).str_brute || 0, m = mod('STR');
        let withCreature = false;
        if (s.grappling && window.APXDice && APXDice.ask) {
            let hv = heavyWeapons();
            let ans = await APXDice.ask('Ground Strike', 'Strike the ground with what?', hv.map((w, i) => ['w' + i, w.name || 'Heavy weapon', i ? '' : 'pri']).concat([['grab', 'The creature I\'m grappling (it takes the maximum)', hv.length ? '' : 'pri']]));
            if (!ans) return false;
            withCreature = ans === 'grab';
        }
        let dc = 10 + m + rank, formula = `5d8${2 * m ? (2 * m > 0 ? '+' : '') + 2 * m : ''}`, maxDmg = 40 + 2 * m;
        let areaRes = null;
        if (window._pwAreaMap && window.APXBattle && window.APXBattle.placeArea) {
            let am = window._pwAreaMap(false);
            if (am) {
                let r = await window.APXBattle.placeArea(am.winId, { casterId: am.tokenId, label: 'Ground Strike', mode: 'burst', size: 2, range: 0, shapeLabel: '2-square Burst around you' });
                if (r === null) return false;
                if (r !== 'skip') areaRes = { mapId: am.mapId, tokenIds: (r.tokenIds || []).filter(id => id !== am.tokenId), safeIds: r.safeIds || [], names: r.names || [] };
            }
        }
        let k = turnKey(); if (k) s.groundStrikeTurn = k;
        let card = window.APXDice ? APXDice.damage({ label: 'Ground Strike (Brute)', who: s.name || '', formula, dmgType: 'Bludgeoning', perks: false,
            note: `Every other creature on the ground within 2 squares: DC ${dc} AGI save, or take this damage and fall Prone (half on a save).${withCreature ? ` The creature you struck with takes ${maxDmg} (maximum).` : ''}` }) : null;
        let total = card && Array.isArray(card.parts) ? card.parts.filter(x => x.kind === 'dmg').reduce((t, x) => t + (x.total || 0), 0) : null;
        if (withCreature) grappleEv('slam', { total: maxDmg, text: `${s.name || 'A player'} slams the creature they're grappling into the ground: ${maxDmg} Bludgeoning (maximum).` });
        if (window.apxOnRollEvent) {
            let id = 'gs' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
            window.apxOnRollEvent(Object.assign({ id, kind: 'power', label: 'Ground Strike', aoe: true,
                text: `${s.name || 'A player'} uses Ground Strike (Brute): every other creature on the ground within 2 squares makes a DC ${dc} AGI save, or takes ${total == null ? formula : total} Bludgeoning and falls Prone (half on a save).${areaRes ? ` In the area: ${areaRes.names.length ? areaRes.names.join(', ') : 'no one'}.` : ''}`,
                dmgType: 'Bludgeoning', dice: formula, dmgTotal: total == null ? undefined : total, save: { dc, kind: 'halves', attr: 'AGI' },
                fx: { conds: ['prone'], lasting: false, saveAttr: 'AGI', saveKind: 'halves', dc } }, areaRes ? { area: { mapId: areaRes.mapId, tokenIds: areaRes.tokenIds, safeIds: areaRes.safeIds } } : {}));
        }
        // it's an attack with your weapon: Fight Defensively drops to +2, Block ends
        s.apxAttackedTurn = true; fx().forEach(e => { if (e.key === 'defensive') e.attacked = true; }); s.turnFx = fx().filter(e => e.until !== 'attack');
        refresh();
    }
    // Weapons with the Quickdraw property (drawn or stowed for 0 AP)
    function quickdrawWeapons() { return (st().weapons || []).filter(w => w && w.properties && w.properties.quickdraw); }
    function wornBelt() { return (st().items || []).find(i => i && i.storageWorn && /bandolier|utility belt/i.test(i.name || '')) || null; }
    // Weapons with the Sturdy property (and unarmed strikes at Martial Arts Rank 2): they can Block
    const UNARMED = ['1d4', '1d6', '1d8', '1d10', '1d12', '2d6'];
    function sturdyWeapons() {
        // (a Parrying weapon blocks as if it were Sturdy, using your Reaction instead of AP)
        let s = st(), out = (s.weapons || []).filter(w => w && w.properties && (w.properties.sturdy || w.properties.parrying)).map(w => ({ name: w.name || 'Weapon', dmg: String(w.dmg || w.dice || '1d6'), parry: !w.properties.sturdy }));
        // (and a Sturdy or Parrying weapon a power summoned)
        if (window.apxSwBlockOptions) out = out.concat(window.apxSwBlockOptions(s));
        let ma = (s.perks || {}).str_martialarts || 0;
        if (ma >= 2) out.push({ name: 'Unarmed (Martial Arts)', dmg: UNARMED[Math.min(5, ma)] });
        return out;
    }
    function oneDie(formula) { let m = String(formula).match(/d(\d+)/); return m ? +m[1] : 6; }
    function rollDie(sides) { return window.APXDice && window.APXDice.rnd ? window.APXDice.rnd(sides) : 1 + Math.floor(Math.random() * sides); }
    // Martial Arts Rank 1: combat maneuvers cost 1 AP less (minimum 1)
    function maneuverCost(a, c) { if (a.g !== 'Combat Maneuvers' || !c || a.perk) return c; return ((st().perks || {}).str_martialarts || 0) >= 1 ? Math.max(1, c - 1) : c; }
    function prowess() { return (st().perks || {}).str_meleeprowess || 0; }
    // A combat maneuver that is itself a STR melee attack (Shove, Shield Bash): rolled now, and it counts as an
    // attack (Fight Defensively drops to +2, Block ends). Melee Prowess R3/R4 apply when melee is set.
    async function maneuverAttack(label, note, opts) {
        opts = opts || {};
        let mp = opts.melee ? prowess() : 0;
        let dd = (typeof calc !== 'undefined' && calc.disadv) || {};
        let dis = (dd.atkGeneral || []).concat(mp >= 3 ? [] : (dd.atkMelee || []), mp >= 3 ? [] : fx().filter(e => e.atkDis).map(e => e.label));
        dis = [...new Set(dis)];
        let adv = (dd.atkAdv || []).slice();
        if (opts.larger && window.APXDice && APXDice.ask) {
            let big = await APXDice.ask(label, `Is the target larger than you? Shoving a larger creature is rolled with Disadvantage${mp >= 3 ? ' (but your Melee Prowess Rank 3 removes it)' : ''}.`, [['no', 'Same size or smaller', 'pri'], ['yes', mp >= 3 ? 'Larger (no Disadvantage: Melee Prowess)' : 'Larger: Disadvantage']]);
            if (!big) return false;
            if (big === 'yes' && mp < 3) dis.push('Target is larger');
        }
        if (mp >= 4) adv.push('Melee Prowess R4 (a combat maneuver)');
        window.APXDice?.check({ kind: 'attack', attr: 'STR', label, bonus: mod('STR') + (st().trainingBonus || 0), who: st().name || '', note, disSources: dis.length ? dis : undefined, advSources: adv.length ? adv : undefined });
        st().apxAttackedTurn = true;
        fx().forEach(e => { if (e.key === 'defensive') e.attacked = true; });
        st().turnFx = fx().filter(e => e.until !== 'attack');
        refresh();
    }
    function refresh() { window.recalculateMath && window.recalculateMath(); window.scheduleAutoSave && window.scheduleAutoSave(); }
    function addFx(e) { let list = fx().filter(x => x.key !== e.key); list.push(Object.assign({ id: uid() }, e)); st().turnFx = list; refresh(); }
    function rollSkill(skill, attr, label) {
        // the sheet's own roll for that skill (bonuses, conditions), as if clicked
        let spec = null;
        document.querySelectorAll('[data-apx-roll]').forEach(el => { if (spec) return; try { let o = JSON.parse(el.getAttribute('data-apx-roll')); if (o.type === 'check' && o.skill === skill && o.kind !== 'save') spec = o; } catch (e) { } });
        if (!window.APXDice) return;
        let o = Object.assign({ attr, skill, bonus: 0, who: st().name || '' }, spec || {}, { label });
        delete o.type;
        // Large: Advantage on STR (Athletics) to push or grapple (Grapple, Pin, Escape, Shove)
        if (skill === 'Athletics' && typeof calc !== 'undefined' && calc.sizeKey === 'large' && /Grapple|Pin|Escape|Shove/.test(label || ''))
            o.advSources = (o.advSources || []).concat(['Large size']);
        window.APXDice.check(o);
    }

    // ── What the effects do (called by the engine on every recalculation) ──
    window.apxTurnFxAc = function () {
        return fx().reduce((t, e) => t + (e.key === 'defensive' ? (e.attacked || st().apxAttackedTurn ? 2 : 4) : (e.ac || 0)), 0);
    };
    window.apxTurnFxApply = function (calc) {
        // Melee Prowess R3: a combat maneuver's Disadvantage doesn't apply to your melee weapon attacks;
        // R4: a combat maneuver you make with a melee weapon has Advantage
        let mp = prowess();
        fx().forEach(e => {
            if (e.atkDis) (mp >= 3 ? (calc.disadv.atkNotMelee = calc.disadv.atkNotMelee || []) : calc.disadv.atkGeneral).push(e.label);
            if (e.atkAdv) (calc.disadv.atkAdv = calc.disadv.atkAdv || []).push(e.label);
            if (e.next && e.next.dis && !(mp >= 3 && e.next.melee)) (e.next.melee ? calc.disadv.atkMelee : calc.disadv.atkGeneral).push(e.label);
            if (e.next && e.next.melee && mp >= 4) (calc.disadv.atkMeleeAdv = calc.disadv.atkMeleeAdv || []).push(`Melee Prowess R4 (${e.label})`);
        });
        try { checkGrapple(); } catch (e) { }
        render();
        try { renderPinned(); } catch (e) { }
    };
    function render() {
        let box = document.getElementById('dispTurnFx'); if (!box) return;
        let list = fx();
        box.innerHTML = list.map(e => `<span class="apx-cond-chip" style="border-color:#38bdf8;color:#bae6fd;display:inline-flex;align-items:center;gap:.2rem" title="${esc(e.desc || '')}">${esc(e.key === 'defensive' ? `Fight Defensively: +${e.attacked || st().apxAttackedTurn ? 2 : 4} AC` : (e.short || e.label))}<button onclick="window.apxEndTurnFx('${e.id}')" title="${e.key === 'grapple' ? 'Let go (a Free Action)' : 'End it now'}" style="color:#ef4444;font-weight:900;background:none;border:none;cursor:pointer;padding:0 .1rem">✕</button></span>`).join('');
    }
    // Actions pinned to Weapons & Attacks
    function renderPinned() {
        let body = document.getElementById('weaponsBody'); if (!body) return;
        let host = document.getElementById('apxPinnedActions');
        if (!host) { host = document.createElement('div'); host.id = 'apxPinnedActions'; host.style.cssText = 'display:flex;flex-wrap:wrap;gap:.3rem;margin-top:.5rem'; let wrap = body.closest('.overflow-x-auto') || body.parentElement; wrap.parentElement.insertBefore(host, wrap.nextSibling); }
        let pins = (st().pinnedActions || []).map(n => A.find(a => a.name === n)).filter(Boolean);
        host.style.display = pins.length ? 'flex' : 'none';
        host.innerHTML = pins.map(a => { let why = a.requires ? a.requires() : ''; let c = costOf(a);
            return `<span style="display:inline-flex;align-items:center;border:1px solid var(--c-border2,#475569);border-radius:.4rem;background:var(--c-surface2,#0f172a);${why ? 'opacity:.45' : ''}">
                <button data-pin-do="${esc(a.name)}" title="${esc(why || a.tip)}" style="background:none;border:none;color:inherit;font-size:.72rem;font-weight:800;padding:.25rem .5rem;cursor:pointer">${esc(a.name)} <span style="color:#60a5fa;font-weight:900">${esc(a.costLabel || (c == null ? 'X' : String(c)))} AP</span></button>
                <button data-pin-off="${esc(a.name)}" title="Unpin" style="background:none;border:none;border-left:1px solid var(--c-border,#334155);color:var(--c-text-muted,#94a3b8);font-size:.7rem;padding:.25rem .35rem;cursor:pointer">✕</button></span>`; }).join('');
        host.querySelectorAll('[data-pin-do]').forEach(b => b.onclick = () => { let a = A.find(x => x.name === b.dataset.pinDo); if (a) doAction(a); });
        host.querySelectorAll('[data-pin-off]').forEach(b => b.onclick = () => togglePin(b.dataset.pinOff));
    }
    function togglePin(name) {
        let s = st(), list = (s.pinnedActions || []).slice(), i = list.indexOf(name);
        if (i >= 0) list.splice(i, 1); else list.push(name);
        s.pinnedActions = list; renderPinned(); window.scheduleAutoSave && window.scheduleAutoSave();
        return i < 0;
    }
    // Mobile: moving in combat gives +1 AC per rank until the start of your next turn, once per round
    window.apxMobileMoved = function () {
        let r = (st().perks || {}).agi_mobile || 0; if (!r) return;
        let ct = window._pwCombatTurn; if (!ct || ct.ended || !ct.id) return;
        let key = (ct.session || '') + ':' + (ct.round || 0);
        if (st().mobileRound === key) return;
        st().mobileRound = key;
        addFx({ key: 'mobile', label: 'Mobile', short: `Mobile: +${r} AC`, ac: r, until: 'turn', desc: `+${r} AC until the start of your next turn (Mobile Rank ${r}, once per round).` });
        note(`Mobile: +${r} AC until the start of your next turn.`);
    };
    window.apxEndTurnFx = function (id) {
        let e = fx().find(x => x.id === id);
        if (e && e.key === 'grapple') { releaseGrapple(); return; }   // ✕ on "Grappling" lets go
        st().turnFx = fx().filter(e => e.id !== id); refresh();
    };

    // ── Grappling (sheet side) ──
    // state.grappling = { pinned, stag } while you hold a creature (stag: the grapple made you Staggered)
    const grappleEv = (action, extra) => window.apxOnRollEvent?.(Object.assign({ id: 'gr' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), kind: 'grapple', action, label: 'Grapple', who: st().name || '' }, extra || {}));
    const myConds = () => window.apxEffectiveConditions ? window.apxEffectiveConditions(st().conditions || [], st()).map(c => c.id) : (st().conditions || []);
    async function setCond(id, on) {
        let has = (st().conditions || []).includes(id);
        if (has === !!on) return;
        if (typeof window.toggleCondition === 'function') await window.toggleCondition(id, !!on);
        else { st().conditions = on ? (st().conditions || []).concat([id]) : (st().conditions || []).filter(c => c !== id); }
    }
    async function wonContest(title, winText) {
        if (!window.APXDice || !APXDice.ask) return true;
        await new Promise(r => setTimeout(r, 350));   // (after the roll's card)
        return (await APXDice.ask(title, 'Compare your roll with theirs: did you win the contest?', [['won', winText, 'pri'], ['lost', 'Lost']])) === 'won';
    }
    function holdFx(pinned) {
        addFx({ key: 'grapple', label: 'Grappling', short: pinned ? 'Pinning a creature (Staggered)' : 'Grappling a creature (Staggered)', until: 'hold',
            desc: pinned ? 'You hold a Pinned creature: Choke it (2 AP), or ✕ to let go (a Free Action).' : 'You hold a Grappled creature: Pin it (2 AP), or ✕ to let go (a Free Action). You\'re Staggered while you hold on.' });
    }
    async function releaseGrapple(quiet) {
        let g = st().grappling; if (!g) return;
        st().grappling = null;
        st().turnFx = fx().filter(e => e.key !== 'grapple');
        if (g.stag) await setCond('staggered', false);
        if (!quiet) { grappleEv('release', { text: `${st().name || 'A player'} lets go.` }); note('You let go: the grapple ends.'); }
        refresh();
    }
    window.apxReleaseGrapple = releaseGrapple;
    // The GM ended it (they escaped, you were knocked out): the Staggered from it came off, so the hold is over
    function checkGrapple() {
        let g = st() && st().grappling;
        if (g && g.stag && !(st().conditions || []).includes('staggered')) { st().grappling = null; st().turnFx = fx().filter(e => e.key !== 'grapple'); }
        if (g && myConds().includes('incapacitated')) releaseGrapple(true);
        if (!st().grappling && fx().some(e => e.key === 'grapple')) st().turnFx = fx().filter(e => e.key !== 'grapple');
    }

    // ── Ending effects: your next turn, and your next attack ──
    function hookTurnStart() {
        let orig = window.apxResetAp;
        if (typeof orig !== 'function' || orig._apxFx) return;
        let w = function () {
            let r = orig.apply(this, arguments);
            let s = st();
            if (s) { let had = fx().filter(e => e.until !== 'hold').length; s.turnFx = fx().filter(e => e.until === 'hold'); s.apxMoves = 0; s.apxAttackedTurn = false; if (had) refresh(); }   // (a grapple you hold carries over)
            return r;
        };
        w._apxFx = true; window.apxResetAp = w;
    }
    function hookAttacks() {
        let orig = window.apxBeforeAttack;
        if (typeof orig !== 'function' || orig._apxFx) return;
        let w = async function (o) {
            let r = await orig.apply(this, arguments);
            if (r === false || !o || !o.pcAttack) return r;
            let list = fx(), changed = false, melee = o.wcat !== 'ranged' && !o.thrown;   // (a Thrown weapon's attack is a ranged attack roll: next-melee-attack maneuvers don't ride it)
            if (!st().apxAttackedTurn) { st().apxAttackedTurn = true; changed = true; }   // Fight Defensively: +2, not +4, on a turn you attack
            list.forEach(e => {
                if (e.key === 'defensive' && !e.attacked) { e.attacked = true; changed = true; }   // +4 AC drops to +2 once you attack
                if (!e.next) return;
                if (e.next.melee && !melee) return;
                // A next-attack maneuver rides on this attack: Disadvantage and/or extra damage, then it's spent
                // (Melee Prowess: R3 no Disadvantage from it on a melee attack, R4 Advantage)
                let addU = (arr, v) => (arr || []).includes(v) ? arr : (arr || []).concat([v]);
                if (e.next.dis && !(melee && prowess() >= 3)) o.disSources = addU(o.disSources, e.label);
                if (e.next.adv) o.advSources = addU(o.advSources, e.label);
                if (melee && e.next.melee && prowess() >= 4) o.advSources = addU(o.advSources, `Melee Prowess R4 (${e.label})`);
                if (e.next.dmg) o.dmgMod = (parseInt(o.dmgMod) || 0) + e.next.dmg;
                if (e.next.dice && o.dice) { let m = String(o.dice).match(/^(\d+)d(\d+)(.*)$/); if (m) o.dice = (parseInt(m[1]) + e.next.dice) + 'd' + m[2] + m[3]; }
                e._spent = true; changed = true;
            });
            let keep = list.filter(e => !e._spent && e.until !== 'attack');
            if (keep.length !== list.length) changed = true;
            if (changed) { st().turnFx = keep; setTimeout(refresh, 0); }
            return r;
        };
        w._apxFx = true; window.apxBeforeAttack = w;
    }

    // ── The list ──
    // cost: AP (null = varies), auto(): applies it; requires(): a reason it can't be done (or '')
    const A = [
        // Combat Maneuvers
        { g: 'Combat Maneuvers', name: 'Fight Defensively', cost: 1, tip: '+2 AC and Disadvantage on your attack rolls until the start of your next turn. If you make no attacks this turn, the bonus is +4.',
            auto: () => addFx({ key: 'defensive', label: 'Fight Defensively', attacked: !!st().apxAttackedTurn, until: 'turn', atkDis: true, desc: '+4 AC until your next turn, or +2 on a turn you attack (before or after); Disadvantage on your attacks.' }) },
        { g: 'Combat Maneuvers', name: 'Fight Offensively', cost: 1, tip: 'Advantage on your attack rolls until the start of your next turn; attacks against you have Advantage too.',
            auto: () => addFx({ key: 'offensive', label: 'Fight Offensively', short: 'Fight Offensively: Adv on attacks', until: 'turn', atkAdv: true, desc: 'Advantage on your attacks; attacks against you have Advantage. Until your next turn.' }) },
        { g: 'Combat Maneuvers', name: 'Block', cost: 2, tip: 'Double your shield\'s AC bonus until the start of your next turn or until you attack. With a Sturdy weapon instead: roll one of its damage dice and add it to your AC. A Parrying weapon blocks like a Sturdy one, using your Reaction instead of AP.',
            costNow: () => !shieldAc() && sturdyWeapons().length && sturdyWeapons().every(w => w.parry) ? 0 : 2,
            requires: () => shieldAc() || sturdyWeapons().length ? '' : 'You need a shield, or a Sturdy or Parrying weapon, equipped.',
            auto: async () => {
                let sac = shieldAc(), sw = sturdyWeapons(), pick = sac ? 'shield' : '0';
                if (sw.length && (sac || sw.length > 1) && window.APXDice && APXDice.ask) {
                    let ch = (sac ? [['shield', `Shield (+${sac} AC)`, 'pri']] : []).concat(sw.map((w, i) => [String(i), `${w.name} (1d${oneDie(w.dmg)})${w.parry ? ': Parrying, your Reaction (0 AP)' : ''}`, sac || i ? '' : 'pri']));
                    pick = await APXDice.ask('Block with…', 'A shield doubles its AC bonus; a Sturdy weapon rolls one of its damage dice as your AC bonus. A Parrying weapon blocks the same way, as your Reaction instead of AP.', ch);
                    if (!pick) return false;
                }
                let ac, src;
                if (pick === 'shield') { ac = sac; src = 'shield'; }
                else {
                    let w = sw[+pick] || sw[0], sides = oneDie(w.dmg); ac = rollDie(sides); src = w.name;
                    if (window.APXDice && APXDice.info) APXDice.info({ label: 'Block', who: st().name || '', text: `${w.name}: rolled 1d${sides} = ${ac}. +${ac} AC until your next turn or until you attack with it.` });
                }
                let parry = pick !== 'shield' && (sw[+pick] || sw[0] || {}).parry;
                addFx({ key: 'block', label: 'Block', short: `Block (${src}${parry ? ', Parrying' : ''}): +${ac} AC`, ac, until: 'attack', desc: `+${ac} AC until your next turn or until you attack.${parry ? ' (Parrying: your Reaction this round.)' : ''}` });
                if (parry) return { spend: 0 };   // (your Reaction, no AP)
            } },
        { g: 'Combat Maneuvers', name: 'Shield Bash', cost: 3, tip: 'With a shield: a STR melee attack; on a hit, Bludgeoning damage equal to your STR score and the target is Staggered until your next turn.',
            requires: () => shieldAc() ? '' : 'You need a shield equipped.',
            auto: () => { let s = (typeof calc !== 'undefined' && calc.scores && calc.scores.STR) || 0; return maneuverAttack('Shield Bash', `Hit: ${s} Bludgeoning damage and the target is Staggered until your next turn`); } },
        { g: 'Combat Maneuvers', name: 'Ground Strike (Brute)', cost: 3, tip: 'Brute Rank 5, once per turn: strike the ground with a Heavy weapon (or the creature you\'re grappling). Every other creature on the ground within 2 squares makes an AGI save (DC 10 + your STR modifier + 5) or takes 5d8 + twice your STR modifier Bludgeoning damage and falls Prone; half damage on a save. A Grappled creature you strike with takes the maximum.',
            perk: true, hidden: () => ((st().perks || {}).str_brute || 0) < 5,   // (a perk's own action: Martial Arts doesn't make it cheaper)
            requires: () => groundStrikeUsed() ? 'Already used this turn.' : (heavyWeapons().length || st().grappling) ? '' : 'You need a Heavy weapon (or a creature you\'re grappling).',
            auto: () => groundStrike() },
        { g: 'Combat Maneuvers', name: 'Disengage', cost: 2, tip: 'Your movement doesn\'t provoke attacks of opportunity until the end of your turn.',
            auto: () => addFx({ key: 'disengage', label: 'Disengage', short: 'Disengaged', until: 'turn', desc: 'Your movement doesn\'t provoke attacks of opportunity this turn.' }) },
        { g: 'Combat Maneuvers', name: 'Power Attack', cost: 2, extra: '+ attack', tip: 'Declare before your next melee attack (it also costs its own AP): on a hit, add your STR modifier to the damage.',
            auto: () => addFx({ key: 'power', label: 'Power Attack', short: `Power Attack: +${mod('STR')} dmg`, until: 'turn', next: { melee: true, dmg: mod('STR') }, desc: 'Your next melee attack adds your STR modifier to its damage.' }) },
        { g: 'Combat Maneuvers', name: 'Precision Attack', cost: 2, extra: '+ attack', tip: 'Declare before your next melee attack (it also costs its own AP): on a hit, add your AGI modifier to the damage.',
            auto: () => addFx({ key: 'precision', label: 'Precision Attack', short: `Precision Attack: +${mod('AGI')} dmg`, until: 'turn', next: { melee: true, dmg: mod('AGI') }, desc: 'Your next melee attack adds your AGI modifier to its damage.' }) },
        { g: 'Combat Maneuvers', name: 'Sweeping Strike', cost: 1, extra: '+ attack', tip: 'Your next melee attack is rolled with Disadvantage and compared to the AC of two adjacent enemies in reach.',
            auto: () => addFx({ key: 'sweep', label: 'Sweeping Strike', short: 'Sweeping Strike: next melee attack', until: 'turn', next: { melee: true, dis: true }, desc: 'Next melee attack: Disadvantage; compare it to two adjacent enemies\' AC.' }) },
        { g: 'Combat Maneuvers', name: 'Whirlwind', cost: 3, extra: '+ attack', tip: 'Your next melee attack is rolled with Disadvantage and compared to the AC of every enemy in reach.',
            auto: () => addFx({ key: 'whirl', label: 'Whirlwind', short: 'Whirlwind: next melee attack', until: 'turn', next: { melee: true, dis: true }, desc: 'Next melee attack: Disadvantage; compare it to every enemy in reach.' }) },
        { g: 'Combat Maneuvers', name: 'Charge', cost: 3, tip: 'Move up to your Speed in a straight line (2+ squares). Then 1 AP: a melee attack with Disadvantage that deals an extra damage die, or a tackle (both Prone, STR score damage).',
            auto: () => { st().chargeMove = { key: typeof _pwTurnKey === 'function' ? _pwTurnKey() : null }; return addFx({ key: 'charge', label: 'Charge', short: 'Charge: next melee attack +1 die', until: 'turn', next: { melee: true, dis: true, dice: 1 }, desc: 'Your next melee attack (1 AP) has Disadvantage and deals an extra die of damage.' }); } },
        { g: 'Combat Maneuvers', name: 'Lunging Attack', cost: 3, tip: 'A melee attack with 1 square more reach, with Disadvantage; it provokes attacks of opportunity.',
            auto: () => addFx({ key: 'lunge', label: 'Lunging Attack', short: 'Lunge: next melee attack', until: 'turn', next: { melee: true, dis: true }, desc: 'Next melee attack: +1 square reach, Disadvantage; provokes attacks of opportunity.' }) },
        { g: 'Combat Maneuvers', name: 'Disarming Attack', cost: 3, tip: 'A melee attack with Disadvantage: on a hit, the target drops an item of your choice (2 AP to catch it).',
            auto: () => addFx({ key: 'disarm', label: 'Disarming Attack', short: 'Disarm: next melee attack', until: 'turn', next: { melee: true, dis: true }, desc: 'Next melee attack: Disadvantage; on a hit the target drops an item.' }) },
        { g: 'Combat Maneuvers', name: 'Shove', cost: 3, tip: 'A melee attack that deals no damage (Disadvantage against larger creatures): on a hit, push 2 squares or knock Prone.',
            auto: () => maneuverAttack('Shove', 'No damage. Hit: push the target 2 squares away or knock it Prone', { larger: true, melee: true }) },
        { g: 'Combat Maneuvers', name: 'Feint', cost: 2, tip: 'CHA (Deceive) against the target\'s PER (Insight). If you win, your next attack against it this turn has Advantage.',
            auto: () => { rollSkill('Deceive', 'CHA', 'Feint: CHA (Deceive)'); addFx({ key: 'feint', label: 'Feint', short: 'Feint: Adv on next attack', until: 'turn', next: { adv: true }, desc: 'If your Deceive beat their Insight, your next attack against them has Advantage. ✕ it if you lost.' }); } },
        { g: 'Combat Maneuvers', name: 'Vault', cost: 2, tip: 'AGI (Acrobatics) against the creature\'s STR (Athletics): leap over it, and your first melee attack against it this turn has Advantage.',
            auto: () => { rollSkill('Acrobatics', 'AGI', 'Vault: AGI (Acrobatics)'); addFx({ key: 'vault', label: 'Vault', short: 'Vault: Adv on next melee attack', until: 'turn', next: { melee: true, adv: true }, desc: 'If you beat their Athletics, your next melee attack against them has Advantage. ✕ it if you lost.' }); } },
        { g: 'Combat Maneuvers', name: 'Grapple', cost: 3, tip: 'A free hand, on a creature no more than one size larger: contested STR (Athletics) against its STR (Athletics) or AGI (Acrobatics). On a win it\'s Grappled, and you\'re Staggered for as long as you hold on.',
            auto: async () => {
                rollSkill('Athletics', 'STR', 'Grapple: STR (Athletics)');
                if (!(await wonContest('Grapple', 'Won: it\'s Grappled'))) { note('Grapple: they slipped your grip.'); return; }
                if (st().grappling) await releaseGrapple(true);
                // Brute Rank 2: not Staggered while grappling
                let brute = ((st().perks || {}).str_brute || 0) >= 2;
                let had = brute || (st().conditions || []).includes('staggered');
                if (!had) await setCond('staggered', true);
                st().grappling = { pinned: false, stag: !had };
                holdFx(false);
                grappleEv('grapple', { staggered: !had, text: `${st().name || 'A player'} grapples a creature.` });
                note(brute ? 'Grappled! (Brute: you aren\'t Staggered.)' : 'Grappled! You\'re Staggered while you hold on (moving costs double AP, no Aim).');
            } },
        { g: 'Combat Maneuvers', name: 'Pin', cost: 2, tip: 'On a creature you\'re grappling: contested STR (Athletics) again. On a win it\'s Pinned: also Restrained and Prone.',
            requires: () => st().grappling ? (st().grappling.pinned ? 'It\'s already Pinned.' : '') : 'You aren\'t grappling anyone.',
            auto: async () => {
                rollSkill('Athletics', 'STR', 'Pin: STR (Athletics)');
                if (!(await wonContest('Pin', 'Won: it\'s Pinned'))) { note('Pin: it kept its footing (still Grappled).'); return; }
                st().grappling.pinned = true; holdFx(true);
                grappleEv('pin', { text: `${st().name || 'A player'} pins the creature.` });
            } },
        { g: 'Combat Maneuvers', name: 'Choke', cost: 2, tip: 'On a creature you\'ve Pinned: your unarmed strike damage with no attack roll, lethal or non-lethal (0 HP from non-lethal damage knocks it out instead). It ignores the creature\'s DR, ER and resistances, and counts as an attack (Fight Defensively gives +2 AC, not +4, on a turn you Choke).',
            requires: () => st().grappling && st().grappling.pinned ? '' : 'You need a creature Pinned.',
            auto: async () => {
                let ans = window.APXDice && APXDice.ask ? await APXDice.ask('Choke', 'Lethal or non-lethal? Non-lethal damage knocks the creature out at 0 HP instead of killing it.', [['nl', 'Non-lethal', 'pri'], ['lethal', 'Lethal']]) : 'nl';
                if (!ans) return false;
                let w = (st().weapons || []).find(x => x && x.isUnarmed) || { name: 'Unarmed Strike', dmg: '1d4', attr: 'STR', isUnarmed: true };
                let mod = window.apxWeaponDmgModifier ? (parseInt(window.apxWeaponDmgModifier(w, w.attr || 'STR')) || 0) : 0;
                let m = String(w.dmg || '1d4').match(/(\d*)d(\d+)/), n = m ? (parseInt(m[1]) || 1) : 1, sides = m ? +m[2] : 4, rolls = [];
                for (let i = 0; i < n; i++) rolls.push(rollDie(sides));
                let total = Math.max(0, rolls.reduce((a, b) => a + b, 0) + mod);
                let nl = ans === 'nl';
                // A Choke is an attack: Fight Defensively drops to +2 AC this turn
                st().apxAttackedTurn = true; fx().forEach(e => { if (e.key === 'defensive') e.attacked = true; }); refresh();
                window.APXDice?.info({ label: 'Choke', who: st().name || '', text: `${n}d${sides}${mod ? (mod > 0 ? '+' : '') + mod : ''} [${rolls.join('+')}${mod ? (mod > 0 ? '+' : '−') + Math.abs(mod) : ''}] = ${total} Bludgeoning${nl ? ', non-lethal' : ''}. No attack roll: it lands, ignoring DR, ER and resistances.` });
                grappleEv('choke', { total, nonlethal: nl, text: `${st().name || 'A player'} chokes the Pinned creature: ${total} Bludgeoning${nl ? ' (non-lethal)' : ''}, ignoring DR, ER and resistances.` });
            } },
        { g: 'Combat Maneuvers', name: 'Escape', cost: 4, tip: 'Break free of a grapple: contested STR (Athletics) or AGI (Acrobatics) against the grappler\'s STR (Athletics). On a win, the Grapple and any Pin end.',
            requires: () => myConds().includes('grappled') ? '' : 'You aren\'t Grappled.',
            auto: async () => {
                let which = window.APXDice && APXDice.ask ? await APXDice.ask('Escape', 'Roll which?', [['Athletics', 'STR (Athletics)', 'pri'], ['Acrobatics', 'AGI (Acrobatics)']]) : 'Athletics';
                if (!which) return false;
                rollSkill(which, which === 'Athletics' ? 'STR' : 'AGI', `Escape: ${which === 'Athletics' ? 'STR' : 'AGI'} (${which})`);
                if (!(await wonContest('Escape', 'Won: I\'m free'))) { note('Escape: still held.'); return; }
                await setCond('pinned', false); await setCond('grappled', false); await setCond('grabbed', false);
                grappleEv('escape', { text: `${st().name || 'A player'} escapes the grapple.` });
                note('You break free: the grapple ends.');
            } },
        { g: 'Combat Maneuvers', name: 'Let Go', cost: 0, tip: 'Release the creature you\'re grappling (a Free Action). Your Staggered from the grapple ends.',
            requires: () => st().grappling ? '' : 'You aren\'t grappling anyone.',
            auto: () => releaseGrapple() },
        // Standard Actions
        { g: 'Standard Actions', name: 'Move', cost: null, tip: 'Move up to your Speed. Costs 1 AP the first time this turn, 2 the second, 3 the third… (dragging your token in combat pays this for you).',
            costNow: () => { let s = st(), n = (s.apxMoves || 0) + 1, c = Math.max(0, n - (((s.perks || {}).agi_mobile || 0) >= 1 ? 1 : 0)); let eff = window.apxEffectiveConditions ? window.apxEffectiveConditions(s.conditions || [], s).map(x => x.id) : []; return eff.includes('staggered') || (typeof calc !== 'undefined' && calc.exoDeadWeight) ? c * 2 : c; },
            auto: () => { st().apxMoves = (st().apxMoves || 0) + 1; window.apxMobileMoved && window.apxMobileMoved(); } },
        { g: 'Standard Actions', name: 'Aim', cost: 2, tip: 'Add your PER modifier to your next ranged attack and damage roll this turn. Use your ranged weapon\'s Aimed attack, which spends the Aim AP for you.', info: true },
        { g: 'Standard Actions', name: 'Jump', cost: null, tip: 'A Jump counts as moving for its AP: your first Move or Jump this turn costs 1 AP, the next 2, and so on. You jump up to your STR modifier in squares (minimum 1); further takes a STR (Athletics) check, DC 5 per extra square.',
            costNow: () => { let s = st(), n = (s.apxMoves || 0) + 1, c = Math.max(0, n - (((s.perks || {}).agi_mobile || 0) >= 1 ? 1 : 0)); let eff = window.apxEffectiveConditions ? window.apxEffectiveConditions(s.conditions || [], s).map(x => x.id) : []; return eff.includes('staggered') || (typeof calc !== 'undefined' && calc.exoDeadWeight) ? c * 2 : c; },
            requires: () => { let eff = window.apxEffectiveConditions ? window.apxEffectiveConditions(st().conditions || [], st()).map(x => x.id) : (st().conditions || []); return typeof calc !== 'undefined' && calc.overburdened ? 'You\'re Overburdened: you can\'t jump.' : eff.some(c => ['grappled', 'restrained', 'prone'].includes(c)) ? 'You can\'t jump while Grappled, Restrained or Prone.' : ''; },
            auto: async () => {
                st().apxMoves = (st().apxMoves || 0) + 1;
                window.apxMobileMoved && window.apxMobileMoved();
                let sq = Math.max(1, mod('STR'));
                let far = window.APXDice && APXDice.ask ? await APXDice.ask('Jump', `You can jump ${sq} square${sq === 1 ? '' : 's'} (your STR modifier, minimum 1). Further takes a STR (Athletics) check: DC 5 for every extra square.`, [['ok', `${sq} square${sq === 1 ? '' : 's'}`, 'pri'], ['far', 'Further (roll Athletics)']]) : 'ok';
                if (far === 'far') rollSkill('Athletics', 'STR', 'Jump: STR (Athletics), DC 5 per extra square');
            } },
        { g: 'Standard Actions', name: 'Draw / Stow', cost: 2, tip: 'Draw a weapon or stow an item you\'re holding. An item on a Bandolier or Utility Belt you wear takes half the AP (1); a Quickdraw weapon takes 0 AP.',
            costNow: () => quickdrawWeapons().length ? 0 : wornBelt() ? 1 : 2,
            auto: async () => {
                let qd = quickdrawWeapons();
                if (!wornBelt() && !qd.length) return;
                let opts = qd.map((w, i) => ['q' + i, `${w.name || 'Weapon'} (Quickdraw): 0 AP`, i ? '' : 'pri'])
                    .concat(wornBelt() ? [['belt', `On your ${wornBelt().name || 'belt'}: 1 AP`, qd.length ? '' : 'pri']] : [], [['other', 'Something else: 2 AP']]);
                let ans = window.APXDice && APXDice.ask ? await APXDice.ask('Draw / Stow', `What are you drawing or stowing?${qd.length ? ' A Quickdraw weapon takes 0 AP.' : ''}${wornBelt() ? ' An item on your belt takes half the AP.' : ''}`, opts) : (qd.length ? 'q0' : 'belt');
                if (!ans) return false;
                return { spend: /^q/.test(ans) ? 0 : ans === 'belt' ? 1 : 2 };
            } },
        { g: 'Standard Actions', name: 'Use / Manipulate', cost: 3, tip: 'Open a door, pull a lever, pass an item, drink a potion, activate a terminal.', auto: () => { } },
        { g: 'Standard Actions', name: 'Drop', cost: 0, tip: 'Drop an item in your square (a Free Action).', auto: () => { } },
        { g: 'Standard Actions', name: 'Fall Prone', cost: 2, tip: 'Drop to the ground: ranged attacks against you have Disadvantage, melee attacks Advantage; your melee attacks have Disadvantage.',
            auto: () => window.toggleCondition && window.toggleCondition('prone', true) },
        { g: 'Standard Actions', name: 'Stand Up', cost: 0, costLabel: '2', tip: 'Stand up from Prone (charged by the Prone condition itself: 2 AP in combat).',
            requires: () => (st().conditions || []).includes('prone') ? '' : 'You aren\'t Prone.',
            auto: () => window.toggleCondition && window.toggleCondition('prone', false) },
        { g: 'Standard Actions', name: 'Help', cost: 3, tip: 'Give an ally Advantage on their next skill check, attack roll or saving throw.', auto: () => note('You Help an ally: their next skill check, attack roll or saving throw has Advantage.') },
        { g: 'Standard Actions', name: 'Repair (Unalive)', cost: 3, tip: 'Mechanical repairs on an adjacent Unalive Structure (a machine or animated object): it regains Xd6 HP, where X is your INT modifier (minimum 1). Nothing else heals it.',
            auto: () => { let x = Math.max(1, mod('INT')); if (window.APXDice && APXDice.damage) APXDice.damage({ label: 'Mechanical repairs', who: st().name || '', formula: x + 'd6', heal: true, note: 'An adjacent Unalive Structure regains this much HP.' }); else note(`Repair: the Unalive creature regains ${x}d6 HP.`); } },
        { g: 'Standard Actions', name: 'Skill Check', cost: 3, tip: 'Any skill check mid-combat (pick a lock, hide, search a body). Click the skill on your sheet to roll it.', auto: () => { } },
        { g: 'Standard Actions', name: 'Ready', cost: null, tip: 'Spend the AP of an action and set a trigger. If it happens before your next turn, do it as your Reaction; if not, you get the AP back.',
            auto: async () => { let v = window.apxPrompt ? await window.apxPrompt('Ready an action: how many AP does it cost?', '3', { title: 'Ready' }) : null; let n = parseInt(v); if (!(n >= 0)) return false; return { spend: n }; } }
    ];
    function costOf(a) { return maneuverCost(a, a.costNow ? a.costNow() : a.cost); }

    window.apxOpenActions = function (ev) {
        if (ev) ev.stopPropagation();
        document.getElementById('apxActionsPop')?.remove();
        let have = window.apxApCurrent ? window.apxApCurrent() : 0;
        let pop = document.createElement('div');
        pop.id = 'apxActionsPop';
        pop.style.cssText = 'position:fixed;width:min(780px,calc(100vw - 16px));max-height:min(78vh,640px);overflow:auto;background:var(--c-surface,#1e293b);border:1px solid var(--c-border2,#475569);border-radius:.6rem;box-shadow:0 18px 50px rgba(0,0,0,.7);padding:.5rem;color:var(--c-text,#fff);font-family:var(--c-font,inherit)';
        let groups = [...new Set(A.map(a => a.g))];
        pop.innerHTML = `<div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.35rem"><b style="flex:1;font-size:.85rem">Actions</b><span style="font-size:.7rem;color:var(--c-text-muted,#94a3b8)">You have <b style="color:#60a5fa">${have}</b> AP</span><button data-x style="background:none;border:none;color:var(--c-text-muted,#94a3b8);font-weight:900;cursor:pointer">✕</button></div>`
            + `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:.6rem;align-items:start">`
            + groups.map(g => `<div><div style="font-size:.62rem;font-weight:900;text-transform:uppercase;letter-spacing:.05em;color:var(--c-indigo-lt,#a5b4fc);margin:.2rem 0 .2rem">${g}</div>`
                + A.filter(a => a.g === g && !(a.hidden && a.hidden())).map((a, i) => {
                    let c = costOf(a);
                    let lbl = a.costLabel || (c == null ? 'X' : String(c)) + (a.extra ? ' ' + a.extra : '');
                    let why = a.requires ? a.requires() : '';
                    let pinned = (st().pinnedActions || []).includes(a.name);
                    return `<div style="display:flex;gap:.2rem;margin-bottom:.2rem;align-items:stretch"><button data-a="${A.indexOf(a)}" ${why ? 'data-why="1"' : ''} title="${esc(why ? why + ' ' + a.tip : a.tip)}" style="display:flex;flex:1;min-width:0;text-align:left;gap:.5rem;align-items:baseline;background:var(--c-surface2,#0f172a);border:1px solid var(--c-border,#334155);border-radius:.4rem;padding:.3rem .45rem;cursor:${why ? 'not-allowed' : 'pointer'};color:inherit;${why ? 'opacity:.4' : ''}">
                        <span style="font-size:.74rem;font-weight:800;flex:1">${esc(a.name)}<span style="display:block;font-size:.62rem;font-weight:500;color:var(--c-text-muted,#94a3b8);line-height:1.3">${esc(why || a.tip)}</span></span>
                        <span style="font-size:.66rem;font-weight:900;color:#60a5fa;white-space:nowrap">${esc(lbl)} AP</span></button>
                        <button data-pin="${esc(a.name)}" title="${pinned ? 'Unpin from Weapons & Attacks' : 'Pin to Weapons & Attacks'}" style="flex-shrink:0;width:1.7rem;background:${pinned ? 'rgba(249,115,22,.25)' : 'var(--c-surface2,#0f172a)'};border:1px solid ${pinned ? '#f97316' : 'var(--c-border,#334155)'};border-radius:.4rem;cursor:pointer;color:${pinned ? '#fdba74' : 'var(--c-text-muted,#94a3b8)'};font-size:.75rem">📌</button></div>`;
                }).join('') + '</div>').join('') + '</div>';
        document.body.appendChild(pop);
        let r = (ev && ev.target && ev.target.getBoundingClientRect) ? ev.target.getBoundingClientRect() : { left: 20, bottom: 120 };
        pop.style.left = Math.max(8, Math.min(innerWidth - pop.offsetWidth - 8, r.left)) + 'px';
        pop.style.top = Math.max(8, Math.min(innerHeight - pop.offsetHeight - 8, r.bottom + 4)) + 'px';
        if (window.apxFront) window.apxFront(pop); else pop.style.zIndex = 2147483100;
        let close = () => { pop.remove(); document.removeEventListener('mousedown', outside, true); };
        let outside = e => { if (!pop.contains(e.target)) close(); };
        setTimeout(() => document.addEventListener('mousedown', outside, true), 0);
        pop.querySelector('[data-x]').onclick = close;
        pop.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { let a = A[+b.dataset.a]; if (b.dataset.why) { note(`${a.name}: ${a.requires()}`, 'warn'); return; } close(); doAction(a); });
        pop.querySelectorAll('[data-pin]').forEach(b => b.onclick = e => { e.stopPropagation(); let on = togglePin(b.dataset.pin);
            b.style.background = on ? 'rgba(249,115,22,.25)' : 'var(--c-surface2,#0f172a)'; b.style.borderColor = on ? '#f97316' : 'var(--c-border,#334155)'; b.style.color = on ? '#fdba74' : 'var(--c-text-muted,#94a3b8)'; b.title = on ? 'Unpin from Weapons & Attacks' : 'Pin to Weapons & Attacks'; });
    };

    async function doAction(a) {
        if (a.info) { note(a.name + ': ' + a.tip); return; }
        let why = a.requires ? a.requires() : '';
        if (why) { note(`${a.name}: ${why}`, 'warn'); return; }
        if (a.own) { await a.auto(); return; }
        let cost = costOf(a) || 0;
        // Relentless Rank 1 (Rank 3): once per turn in combat, a non-attack, non-movement action that costs 1 AP
        // (3 AP or less) costs 0 AP
        let relFree = false;
        {
            let rk = window.apxPerkRank ? window.apxPerkRank(st(), 'agi_relentless') : ((st().perks || {}).agi_relentless || 0);
            let lim = rk >= 3 ? 3 : rk >= 1 ? 1 : 0, turn = window._pwCombatCode ? (window._pwLastTurnKey || null) : null;
            let attackish = ['Shove', 'Shield Bash', 'Choke', 'Ground Strike', 'Sweeping Strike', 'Whirlwind', 'Charge', 'Lunging Attack', 'Disarming Attack', 'Power Attack', 'Precision Attack', 'Grapple', 'Pin'];
            let moving = ['Move', 'Jump', 'Vault', 'Charge'];
            if (lim && turn && cost > 0 && cost <= lim && !attackish.includes(a.name) && !moving.includes(a.name) && st().relentlessFreeTurn !== turn) {
                relFree = true; st().relentlessFreeTurn = turn; cost = 0;
            }
        }
        let moveAct = ['Move', 'Jump'].includes(a.name);   // (a power's movement-only AP pays for these first)
        let have = (window.apxApCurrent ? window.apxApCurrent() : 0) + (moveAct && window.apxMoveApLeft ? window.apxMoveApLeft() : 0);
        if (cost > have) {
            let ok = window.apxConfirm ? await window.apxConfirm(`${a.name} costs ${cost} AP and you have ${have}. Do it anyway?`, { title: 'Not enough AP', okLabel: 'Do it anyway', cancelLabel: 'Cancel' }) : false;
            if (!ok) return;
        }
        let before = fx().map(e => e.id);
        let res = await a.auto();
        if (res === false) return;
        if (res && typeof res.spend === 'number') cost = res.spend;
        if (moveAct && cost > 0 && window.apxSpendMoveAp) window.apxSpendMoveAp(cost);
        else { let spend = Math.min(cost, window.apxApCurrent ? window.apxApCurrent() : cost); if (spend > 0 && window.apxSpendAp) window.apxSpendAp(spend); }
        note(`${a.name}${cost ? `: −${cost} AP (${window.apxApCurrent ? window.apxApCurrent() : '?'} left)` : relFree ? ': 0 AP (Relentless, once per turn)' : ''}.`);
        // Your GM sees it in their dice tray and notifications (with what it does: Block's AC, Fight Defensively…)
        let added = fx().filter(e => !before.includes(e.id)).map(e => e.key === 'defensive' ? `Fight Defensively: +${e.attacked || st().apxAttackedTurn ? 2 : 4} AC` : (e.short || e.label));
        if (window.apxOnRollEvent && (a.g !== 'Standard Actions' || ['Fall Prone', 'Help', 'Ready', 'Jump', 'Repair (Unalive)'].includes(a.name))) {
            try { window.apxOnRollEvent({ id: 'act' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), kind: 'action', label: a.name, ap: cost,
                text: `${st().name || 'A player'} uses ${a.name}${cost ? ` (${cost} AP)` : ''}${added.length ? ': ' + added.join(', ') : ''}.` }); } catch (e) { }
        }
    }

    // The engine and AP code load before this file; hook once they exist
    let tries = 0;
    (function hook() { hookTurnStart(); hookAttacks(); if ((!window.apxResetAp || !window.apxBeforeAttack) && tries++ < 50) setTimeout(hook, 200); else { render(); renderPinned(); } })();
})();
