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
    function refresh() { window.recalculateMath && window.recalculateMath(); window.scheduleAutoSave && window.scheduleAutoSave(); }
    function addFx(e) { let list = fx().filter(x => x.key !== e.key); list.push(Object.assign({ id: uid() }, e)); st().turnFx = list; refresh(); }
    function rollSkill(skill, attr, label) {
        // the sheet's own roll for that skill (bonuses, conditions), as if clicked
        let spec = null;
        document.querySelectorAll('[data-apx-roll]').forEach(el => { if (spec) return; try { let o = JSON.parse(el.getAttribute('data-apx-roll')); if (o.type === 'check' && o.skill === skill && o.kind !== 'save') spec = o; } catch (e) { } });
        if (!window.APXDice) return;
        let o = Object.assign({ attr, skill, bonus: 0, who: st().name || '' }, spec || {}, { label });
        delete o.type;
        window.APXDice.check(o);
    }

    // ── What the effects do (called by the engine on every recalculation) ──
    window.apxTurnFxAc = function () {
        return fx().reduce((t, e) => t + (e.key === 'defensive' ? (e.attacked ? 2 : 4) : e.key === 'block' ? (e.ac || 0) : (e.ac || 0)), 0);
    };
    window.apxTurnFxApply = function (calc) {
        fx().forEach(e => {
            if (e.atkDis) calc.disadv.atkGeneral.push(e.label);
            if (e.atkAdv) (calc.disadv.atkAdv = calc.disadv.atkAdv || []).push(e.label);
            if (e.next && e.next.dis) (e.next.melee ? calc.disadv.atkMelee : calc.disadv.atkGeneral).push(e.label);
        });
        render();
    };
    function render() {
        let box = document.getElementById('dispTurnFx'); if (!box) return;
        let list = fx();
        box.innerHTML = list.map(e => `<span class="apx-cond-chip" style="border-color:#38bdf8;color:#bae6fd;display:inline-flex;align-items:center;gap:.2rem" title="${esc(e.desc || '')}">${esc(e.short || e.label)}<button onclick="window.apxEndTurnFx('${e.id}')" title="End it now" style="color:#ef4444;font-weight:900;background:none;border:none;cursor:pointer;padding:0 .1rem">✕</button></span>`).join('');
    }
    window.apxEndTurnFx = function (id) { st().turnFx = fx().filter(e => e.id !== id); refresh(); };

    // ── Ending effects: your next turn, and your next attack ──
    function hookTurnStart() {
        let orig = window.apxResetAp;
        if (typeof orig !== 'function' || orig._apxFx) return;
        let w = function () {
            let r = orig.apply(this, arguments);
            let s = st();
            if (s) { let had = fx().length; s.turnFx = []; s.apxMoves = 0; if (had) refresh(); }
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
            let list = fx(), changed = false, melee = o.wcat !== 'ranged';
            list.forEach(e => {
                if (e.key === 'defensive' && !e.attacked) { e.attacked = true; changed = true; }   // +4 AC drops to +2 once you attack
                if (!e.next) return;
                if (e.next.melee && !melee) return;
                // A next-attack maneuver rides on this attack: Disadvantage and/or extra damage, then it's spent
                if (e.next.dis) o.disSources = (o.disSources || []).concat([e.label]);
                if (e.next.adv) o.advSources = (o.advSources || []).concat([e.label]);
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
        { g: 'Combat Maneuvers', name: 'Fight Defensively', cost: 1, tip: '+4 AC until the start of your next turn (+2 once you attack), and Disadvantage on your attack rolls.',
            auto: () => addFx({ key: 'defensive', label: 'Fight Defensively', short: 'Fight Defensively: +4 AC', until: 'turn', atkDis: true, desc: '+4 AC until your next turn (+2 once you attack); Disadvantage on your attacks.' }) },
        { g: 'Combat Maneuvers', name: 'Fight Offensively', cost: 1, tip: 'Advantage on your attack rolls until the start of your next turn; attacks against you have Advantage too.',
            auto: () => addFx({ key: 'offensive', label: 'Fight Offensively', short: 'Fight Offensively: Adv on attacks', until: 'turn', atkAdv: true, desc: 'Advantage on your attacks; attacks against you have Advantage. Until your next turn.' }) },
        { g: 'Combat Maneuvers', name: 'Block', cost: 2, tip: 'Double your shield\'s AC bonus until the start of your next turn or until you attack. With a Sturdy weapon instead: roll one of its damage dice and add it to your AC.',
            auto: async () => {
                let sac = shieldAc(), ac = sac;
                if (!sac) {
                    let v = window.apxPrompt ? await window.apxPrompt('No shield equipped. Blocking with a Sturdy weapon: roll one of its damage dice and enter the result (your AC bonus).', '', { title: 'Block' }) : null;
                    ac = parseInt(v) || 0; if (!ac) return false;
                }
                addFx({ key: 'block', label: 'Block', short: `Block: +${ac} AC`, ac, until: 'attack', desc: `+${ac} AC until your next turn or until you attack.` });
            } },
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
            auto: () => addFx({ key: 'charge', label: 'Charge', short: 'Charge: next melee attack +1 die', until: 'turn', next: { melee: true, dis: true, dice: 1 }, desc: 'Your next melee attack (1 AP) has Disadvantage and deals an extra die of damage.' }) },
        { g: 'Combat Maneuvers', name: 'Lunging Attack', cost: 3, tip: 'A melee attack with 1 square more reach, with Disadvantage; it provokes attacks of opportunity.',
            auto: () => addFx({ key: 'lunge', label: 'Lunging Attack', short: 'Lunge: next melee attack', until: 'turn', next: { melee: true, dis: true }, desc: 'Next melee attack: +1 square reach, Disadvantage; provokes attacks of opportunity.' }) },
        { g: 'Combat Maneuvers', name: 'Disarming Attack', cost: 3, tip: 'A melee attack with Disadvantage: on a hit, the target drops an item of your choice (2 AP to catch it).',
            auto: () => addFx({ key: 'disarm', label: 'Disarming Attack', short: 'Disarm: next melee attack', until: 'turn', next: { melee: true, dis: true }, desc: 'Next melee attack: Disadvantage; on a hit the target drops an item.' }) },
        { g: 'Combat Maneuvers', name: 'Shove', cost: 3, tip: 'A melee attack that deals no damage (Disadvantage against larger creatures): on a hit, push 2 squares or knock Prone.',
            auto: () => note('Shove: make your melee attack (no damage). On a hit, push the target 2 squares or knock it Prone. Disadvantage if it\'s larger than you.') },
        { g: 'Combat Maneuvers', name: 'Shield Bash', cost: 3, tip: 'With a shield: a STR melee attack; on a hit, Bludgeoning damage equal to your STR score and the target is Staggered until your next turn.',
            requires: () => shieldAc() ? '' : 'You need a shield equipped.',
            auto: () => { let s = (typeof calc !== 'undefined' && calc.scores && calc.scores.STR) || 0; window.APXDice?.check({ kind: 'attack', attr: 'STR', label: 'Shield Bash', bonus: mod('STR') + (st().trainingBonus || 0), who: st().name || '', note: `Hit: ${s} Bludgeoning damage and the target is Staggered` }); } },
        { g: 'Combat Maneuvers', name: 'Feint', cost: 2, tip: 'CHA (Deceive) against the target\'s PER (Insight). If you win, your next attack against it this turn has Advantage.',
            auto: () => { rollSkill('Deceive', 'CHA', 'Feint: CHA (Deceive)'); addFx({ key: 'feint', label: 'Feint', short: 'Feint: Adv on next attack', until: 'turn', next: { adv: true }, desc: 'If your Deceive beat their Insight, your next attack against them has Advantage. ✕ it if you lost.' }); } },
        { g: 'Combat Maneuvers', name: 'Vault', cost: 2, tip: 'AGI (Acrobatics) against the creature\'s STR (Athletics): leap over it, and your first melee attack against it this turn has Advantage.',
            auto: () => { rollSkill('Acrobatics', 'AGI', 'Vault: AGI (Acrobatics)'); addFx({ key: 'vault', label: 'Vault', short: 'Vault: Adv on next melee attack', until: 'turn', next: { melee: true, adv: true }, desc: 'If you beat their Athletics, your next melee attack against them has Advantage. ✕ it if you lost.' }); } },
        { g: 'Combat Maneuvers', name: 'Grab', cost: 3, tip: 'An unarmed strike with Disadvantage (no damage), free hand needed: on a hit the target is Grabbed and both your Speeds are 0.',
            auto: () => note('Grab: make an unarmed strike with Disadvantage (no damage). On a hit, the target is Grabbed: both your Speeds become 0. Ask your GM to mark it Grabbed.') },
        { g: 'Combat Maneuvers', name: 'Grapple', cost: 2, tip: 'On a creature you\'ve Grabbed: contested STR (Athletics). On a success, you\'re both Grappled (Restrained).',
            auto: () => rollSkill('Athletics', 'STR', 'Grapple: STR (Athletics)') },
        { g: 'Combat Maneuvers', name: 'Pin', cost: 1, tip: 'On a creature you\'ve Grappled: contested STR (Athletics). On a success, you\'re both Pinned (Prone). 1 AP: unarmed damage (non-lethal).',
            auto: () => rollSkill('Athletics', 'STR', 'Pin: STR (Athletics)') },
        // Standard Actions
        { g: 'Standard Actions', name: 'Move', cost: null, tip: 'Move up to your Speed. Costs 1 AP the first time this turn, 2 the second, 3 the third… (dragging your token in combat pays this for you).',
            costNow: () => { let s = st(), n = (s.apxMoves || 0) + 1, c = Math.max(0, n - (((s.perks || {}).agi_mobile || 0) >= 1 ? 1 : 0)); let eff = window.apxEffectiveConditions ? window.apxEffectiveConditions(s.conditions || [], s).map(x => x.id) : []; return eff.includes('staggered') ? c * 2 : c; },
            auto: () => { st().apxMoves = (st().apxMoves || 0) + 1; } },
        { g: 'Standard Actions', name: 'Aim', cost: 2, tip: 'Add your PER modifier to your next ranged attack and damage roll this turn. Use your ranged weapon\'s Aimed attack, which spends the Aim AP for you.', info: true },
        { g: 'Standard Actions', name: 'Draw / Stow', cost: 2, tip: 'Draw a weapon or stow an item you\'re holding.', auto: () => { } },
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
            auto: async () => { let v = window.apxPrompt ? await window.apxPrompt('Ready an action: how many AP does it cost?', '3', { title: 'Ready' }) : null; let n = parseInt(v); if (!(n >= 0)) return false; return { spend: n }; } },
        { g: 'Standard Actions', name: 'Recover', cost: null, costLabel: '1 / 3', tip: 'Shake It Off (1 AP) or Shrug It Off (3 AP), once each per Short or Full Rest.', auto: () => { window.apxRecoverMenu && window.apxRecoverMenu(); return false; }, own: true }
    ];

    window.apxOpenActions = function (ev) {
        if (ev) ev.stopPropagation();
        document.getElementById('apxActionsPop')?.remove();
        let have = window.apxApCurrent ? window.apxApCurrent() : 0;
        let pop = document.createElement('div');
        pop.id = 'apxActionsPop';
        pop.style.cssText = 'position:fixed;width:min(380px,calc(100vw - 16px));max-height:min(78vh,640px);overflow:auto;background:var(--c-surface,#1e293b);border:1px solid var(--c-border2,#475569);border-radius:.6rem;box-shadow:0 18px 50px rgba(0,0,0,.7);padding:.5rem;color:var(--c-text,#fff);font-family:var(--c-font,inherit)';
        let groups = [...new Set(A.map(a => a.g))];
        pop.innerHTML = `<div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.35rem"><b style="flex:1;font-size:.85rem">Actions</b><span style="font-size:.7rem;color:var(--c-text-muted,#94a3b8)">You have <b style="color:#60a5fa">${have}</b> AP</span><button data-x style="background:none;border:none;color:var(--c-text-muted,#94a3b8);font-weight:900;cursor:pointer">✕</button></div>`
            + groups.map(g => `<div style="font-size:.62rem;font-weight:900;text-transform:uppercase;letter-spacing:.05em;color:var(--c-indigo-lt,#a5b4fc);margin:.45rem 0 .2rem">${g}</div>`
                + A.filter(a => a.g === g).map((a, i) => {
                    let c = a.costNow ? a.costNow() : a.cost;
                    let lbl = a.costLabel || (c == null ? 'X' : String(c)) + (a.extra ? ' ' + a.extra : '');
                    return `<button data-a="${A.indexOf(a)}" title="${esc(a.tip)}" style="display:flex;width:100%;text-align:left;gap:.5rem;align-items:baseline;background:var(--c-surface2,#0f172a);border:1px solid var(--c-border,#334155);border-radius:.4rem;padding:.3rem .45rem;margin-bottom:.2rem;cursor:pointer;color:inherit">
                        <span style="font-size:.74rem;font-weight:800;flex:1">${esc(a.name)}<span style="display:block;font-size:.62rem;font-weight:500;color:var(--c-text-muted,#94a3b8);line-height:1.3">${esc(a.tip)}</span></span>
                        <span style="font-size:.66rem;font-weight:900;color:#60a5fa;white-space:nowrap">${esc(lbl)} AP</span></button>`;
                }).join('')).join('');
        document.body.appendChild(pop);
        let r = (ev && ev.target && ev.target.getBoundingClientRect) ? ev.target.getBoundingClientRect() : { left: 20, bottom: 120 };
        pop.style.left = Math.max(8, Math.min(innerWidth - pop.offsetWidth - 8, r.left)) + 'px';
        pop.style.top = Math.max(8, Math.min(innerHeight - pop.offsetHeight - 8, r.bottom + 4)) + 'px';
        if (window.apxFront) window.apxFront(pop); else pop.style.zIndex = 2147483100;
        let close = () => { pop.remove(); document.removeEventListener('mousedown', outside, true); };
        let outside = e => { if (!pop.contains(e.target)) close(); };
        setTimeout(() => document.addEventListener('mousedown', outside, true), 0);
        pop.querySelector('[data-x]').onclick = close;
        pop.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { close(); doAction(A[+b.dataset.a]); });
    };

    async function doAction(a) {
        if (a.info) { note(a.name + ': ' + a.tip); return; }
        let why = a.requires ? a.requires() : '';
        if (why) { note(`${a.name}: ${why}`, 'warn'); return; }
        if (a.own) { await a.auto(); return; }
        let cost = a.costNow ? a.costNow() : (a.cost || 0);
        let have = window.apxApCurrent ? window.apxApCurrent() : 0;
        if (cost > have) {
            let ok = window.apxConfirm ? await window.apxConfirm(`${a.name} costs ${cost} AP and you have ${have}. Do it anyway?`, { title: 'Not enough AP', okLabel: 'Do it anyway', cancelLabel: 'Cancel' }) : false;
            if (!ok) return;
        }
        let res = await a.auto();
        if (res === false) return;
        if (res && typeof res.spend === 'number') cost = res.spend;
        let spend = Math.min(cost, window.apxApCurrent ? window.apxApCurrent() : cost);
        if (spend > 0 && window.apxSpendAp) window.apxSpendAp(spend);
        note(`${a.name}${cost ? `: −${cost} AP (${window.apxApCurrent ? window.apxApCurrent() : '?'} left)` : ''}.`);
    }

    // The engine and AP code load before this file; hook once they exist
    let tries = 0;
    (function hook() { hookTurnStart(); hookAttacks(); if ((!window.apxResetAp || !window.apxBeforeAttack) && tries++ < 50) setTimeout(hook, 200); else render(); })();
})();
