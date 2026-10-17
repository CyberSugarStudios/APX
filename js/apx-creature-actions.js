// ============================================================
// APX Creature Actions: Combat Maneuvers and Standard Actions for creatures
// ============================================================
// NPCs, summoned creatures and Loyal Companions get the same list the player's sheet has
// (js/apx-actions.js), worded for a creature. Picking one spends that creature's AP and
// applies what can be applied:
//   fx      → an effect on the creature until the start of its next turn (chips on its
//             tracker card; Fight Defensively/Offensively change its attack rolls and AC)
//   next    → its next attack only (Disadvantage / Advantage), then it's used up
//   cond    → adds a condition (Fall Prone)   uncond → removes one (Stand Up)
//   keep    → an fx that lasts past its next turn (Grappling, until it lets go)
// The page passes a ctx: { name, have(), spend(n), log(text), conds(), addCond(id),
// removeCond(id), addFx(fx), endFx(key) → true if it had one, standUpCharges, move() } (anything it lacks is skipped).
// ============================================================
(function () {
    'use strict';
    const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const L = [
        { g: 'Combat Maneuvers', name: 'Fight Defensively', cost: 1, tip: '+2 AC and Disadvantage on its attack rolls until the start of its next turn. If it makes no attacks this turn, the bonus is +4.', fx: { key: 'defensive', label: 'Fight Defensively', atkDis: true, ac: 4 } },
        { g: 'Combat Maneuvers', name: 'Fight Offensively', cost: 1, tip: 'Advantage on its attack rolls until the start of its next turn; attacks against it have Advantage too.', fx: { key: 'offensive', label: 'Fight Offensively', atkAdv: true } },
        { g: 'Combat Maneuvers', name: 'Block', cost: 2, tip: 'Double its shield\'s AC bonus until the start of its next turn or until it attacks. With a Sturdy weapon instead: roll one of its damage dice and add it to its AC.', fx: { key: 'block', label: 'Block', untilAttack: true } },
        { g: 'Combat Maneuvers', name: 'Shield Bash', cost: 3, tip: 'With a shield: a STR melee attack; on a hit, Bludgeoning damage equal to its STR score and the target is Staggered until its next turn.' },
        { g: 'Combat Maneuvers', name: 'Disengage', cost: 2, tip: 'Its movement doesn\'t provoke attacks of opportunity until the end of its turn.', fx: { key: 'disengage', label: 'Disengaged' } },
        { g: 'Combat Maneuvers', name: 'Power Attack', cost: 2, extra: '+ attack', tip: 'Declare before its next melee attack (it also costs its own AP): on a hit, add its STR modifier to the damage.', fx: { key: 'power', label: 'Power Attack: +STR dmg', next: {} } },
        { g: 'Combat Maneuvers', name: 'Precision Attack', cost: 2, extra: '+ attack', tip: 'Declare before its next melee attack (it also costs its own AP): on a hit, add its AGI modifier to the damage.', fx: { key: 'precision', label: 'Precision Attack: +AGI dmg', next: {} } },
        { g: 'Combat Maneuvers', name: 'Sweeping Strike', cost: 1, extra: '+ attack', tip: 'Its next melee attack is rolled with Disadvantage and compared to the AC of two adjacent enemies in reach.', fx: { key: 'sweep', label: 'Sweeping Strike', next: { dis: true } } },
        { g: 'Combat Maneuvers', name: 'Whirlwind', cost: 3, extra: '+ attack', tip: 'Its next melee attack is rolled with Disadvantage and compared to the AC of every enemy in reach.', fx: { key: 'whirl', label: 'Whirlwind', next: { dis: true } } },
        { g: 'Combat Maneuvers', name: 'Charge', cost: 3, tip: 'Move up to its Speed in a straight line (2+ squares). Then 1 AP: a melee attack with Disadvantage that deals an extra damage die, or a tackle (both Prone, STR score damage).', fx: { key: 'charge', label: 'Charge: +1 damage die', next: { dis: true } } },
        { g: 'Combat Maneuvers', name: 'Lunging Attack', cost: 3, tip: 'A melee attack with 1 square more reach, with Disadvantage; it provokes attacks of opportunity.', fx: { key: 'lunge', label: 'Lunge', next: { dis: true } } },
        { g: 'Combat Maneuvers', name: 'Disarming Attack', cost: 3, tip: 'A melee attack with Disadvantage: on a hit, the target drops an item of its choice (2 AP to catch it).', fx: { key: 'disarm', label: 'Disarm', next: { dis: true } } },
        { g: 'Combat Maneuvers', name: 'Shove', cost: 3, tip: 'A melee attack that deals no damage (Disadvantage against larger creatures): on a hit, push 2 squares or knock Prone.' },
        { g: 'Combat Maneuvers', name: 'Feint', cost: 2, tip: 'CHA (Deceive) against the target\'s PER (Insight). If it wins, its next attack against that target this turn has Advantage.', fx: { key: 'feint', label: 'Feint: Adv (if it won)', next: { adv: true } } },
        { g: 'Combat Maneuvers', name: 'Vault', cost: 2, tip: 'AGI (Acrobatics) against the creature\'s STR (Athletics): leap over it, and its first melee attack against it this turn has Advantage.', fx: { key: 'vault', label: 'Vault: Adv (if it won)', next: { adv: true } } },
        { g: 'Combat Maneuvers', name: 'Grapple', cost: 3, tip: 'A free hand, on a creature no more than one size larger: contested STR (Athletics) against its STR (Athletics) or AGI (Acrobatics). On a win the target is Grappled, and the grappler is Staggered for as long as it holds on.', ask: 'Grapple won?', cond: 'staggered', fx: { key: 'grappling', label: 'Grappling (Staggered)', keep: true } },
        { g: 'Combat Maneuvers', name: 'Pin', cost: 2, tip: 'On a creature it\'s grappling: contested STR (Athletics) again. On a win the target is Pinned: also Restrained and Prone.' },
        { g: 'Combat Maneuvers', name: 'Choke', cost: 2, tip: 'On a creature it has Pinned: its unarmed strike damage with no attack roll, lethal or non-lethal. It ignores the target\'s DR, ER and resistances, and counts as an attack.' },
        { g: 'Combat Maneuvers', name: 'Escape', cost: 4, tip: 'Break free of a grapple: contested STR (Athletics) or AGI (Acrobatics) against the grappler\'s STR (Athletics). On a win, the Grapple and any Pin end.', ask: 'Escape won?', uncond: ['pinned', 'grappled', 'grabbed'] },
        { g: 'Combat Maneuvers', name: 'Let Go', cost: 0, tip: 'Release the creature it\'s grappling (a Free Action). Its Staggered from the grapple ends.', endFx: 'grappling' },
        { g: 'Standard Actions', name: 'Move', cost: null, tip: 'Move up to its Speed. Costs 1 AP the first time this turn, 2 the second, 3 the third… (dragging its token on a battle map in combat pays this for you).', move: true },
        { g: 'Standard Actions', name: 'Draw / Stow', cost: 2, tip: 'Draw a weapon or stow an item it\'s holding.' },
        { g: 'Standard Actions', name: 'Use / Manipulate', cost: 3, tip: 'Open a door, pull a lever, pass an item, drink a potion, activate a terminal.' },
        { g: 'Standard Actions', name: 'Drop', cost: 0, tip: 'Drop an item in its square (a Free Action).' },
        { g: 'Standard Actions', name: 'Fall Prone', cost: 2, tip: 'Drop to the ground: ranged attacks against it have Disadvantage, melee attacks Advantage; its melee attacks have Disadvantage.', cond: 'prone' },
        { g: 'Standard Actions', name: 'Stand Up', cost: 2, tip: 'Stand up from Prone (2 AP in combat).', uncond: ['prone'], needs: 'prone', stand: true },
        { g: 'Standard Actions', name: 'Help', cost: 3, tip: 'Give an ally Advantage on their next skill check, attack roll or saving throw.' },
        { g: 'Standard Actions', name: 'Skill Check', cost: 3, tip: 'Any skill check mid-combat (pick a lock, hide, search a body). Click the check on its stat block to roll it.' },
        { g: 'Standard Actions', name: 'Ready', cost: null, tip: 'Spend the AP of an action and set a trigger. If it happens before its next turn, it does it as its Reaction; if not, the AP comes back.', ready: true }
    ];
    window.apxCreatureActionList = L;

    window.apxOpenCreatureActions = function (ev, ctx) {
        if (ev) ev.stopPropagation();
        document.getElementById('apxCreatureActionsPop')?.remove();
        if (!ctx) return;
        let have = ctx.have ? ctx.have() : null, conds = ctx.conds ? ctx.conds() : [];
        let pop = document.createElement('div');
        pop.id = 'apxCreatureActionsPop';
        pop.style.cssText = 'position:fixed;width:min(720px,calc(100vw - 16px));max-height:min(78vh,620px);overflow:auto;background:var(--c-surface,#1e293b);border:1px solid var(--c-border2,#475569);border-radius:.6rem;box-shadow:0 18px 50px rgba(0,0,0,.7);padding:.5rem;color:var(--c-text,#fff);font-family:var(--c-font,inherit)';
        let groups = [...new Set(L.map(a => a.g))];
        pop.innerHTML = `<div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.35rem"><b style="flex:1;font-size:.85rem">${esc(ctx.name || 'Creature')}: Actions</b>${have != null ? `<span style="font-size:.7rem;color:var(--c-text-muted,#94a3b8)"><b style="color:#60a5fa">${have}</b> AP</span>` : ''}<button data-x style="background:none;border:none;color:var(--c-text-muted,#94a3b8);font-weight:900;cursor:pointer">✕</button></div>`
            + (ctx.note ? `<div style="font-size:.66rem;color:#fcd34d;margin-bottom:.3rem">${esc(ctx.note)}</div>` : '')
            + `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:.6rem;align-items:start">`
            + groups.map(g => `<div><div style="font-size:.62rem;font-weight:900;text-transform:uppercase;letter-spacing:.05em;color:var(--c-indigo-lt,#a5b4fc);margin:.2rem 0">${g}</div>`
                + L.filter(a => a.g === g).map(a => {
                    let c = a.move && ctx.moveCost ? ctx.moveCost() : a.cost;
                    let lbl = (c == null ? 'X' : String(c)) + (a.extra ? ' ' + a.extra : '');
                    let why = a.needs && ctx.conds && !conds.includes(a.needs) ? `It isn't ${a.needs[0].toUpperCase() + a.needs.slice(1)}.` : '';
                    return `<button data-a="${L.indexOf(a)}" ${why ? 'data-why="1"' : ''} title="${esc(why ? why + ' ' + a.tip : a.tip)}" style="display:flex;width:100%;text-align:left;gap:.5rem;align-items:baseline;margin-bottom:.2rem;background:var(--c-surface2,#0f172a);border:1px solid var(--c-border,#334155);border-radius:.4rem;padding:.25rem .45rem;cursor:${why ? 'not-allowed' : 'pointer'};color:inherit;${why ? 'opacity:.4' : ''}">
                        <span style="font-size:.72rem;font-weight:800;flex:1">${esc(a.name)}<span style="display:block;font-size:.6rem;font-weight:500;color:var(--c-text-muted,#94a3b8);line-height:1.3">${esc(why || a.tip)}</span></span>
                        <span style="font-size:.64rem;font-weight:900;color:#60a5fa;white-space:nowrap">${esc(lbl)} AP</span></button>`;
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
        pop.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
            let a = L[+b.dataset.a];
            if (b.dataset.why) { window.APXDice?.notify(`${a.name}: ${b.title}`, { kind: 'warn' }); return; }
            close(); doIt(a, ctx);
        });
    };

    async function doIt(a, ctx) {
        let who = ctx.name || 'The creature';
        let cost = a.move && ctx.moveCost ? ctx.moveCost() : a.cost;
        if (a.ready) {
            let v = window.apxPrompt ? await window.apxPrompt(`Ready an action for ${who}: how many AP does it cost?`, '3', { title: 'Ready' }) : '3';
            cost = parseInt(v); if (!(cost >= 0)) return;
        }
        cost = cost || 0;
        let have = ctx.have ? ctx.have() : null;
        if (have != null && cost > have) {
            let ok = window.apxConfirm ? await window.apxConfirm(`${a.name} costs ${cost} AP and ${who} has ${have}. Do it anyway?`, { title: 'Not enough AP', okLabel: 'Do it anyway', cancelLabel: 'Cancel' }) : true;
            if (!ok) return;
        }
        // Contests: roll them from its stat block; the effect applies only on a win
        let won = true;
        if (a.ask && window.APXDice && APXDice.ask) {
            let ans = await APXDice.ask(a.ask, `${a.tip} Roll the contest from its stat block, then say how it went.`, [['won', 'Won', 'pri'], ['lost', 'Lost']]);
            if (!ans) return;
            won = ans === 'won';
        }
        if (a.move && ctx.move) ctx.move();
        let spend = have != null ? Math.min(cost, have) : cost;
        // (standing up: removing Prone already charges its 2 AP where the page does that)
        if (spend > 0 && ctx.spend && !(a.stand && ctx.standUpCharges)) ctx.spend(spend);
        if (won) {
            if (a.fx && ctx.addFx) ctx.addFx(Object.assign({ id: 'fx' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: a.name }, JSON.parse(JSON.stringify(a.fx))));
            if (a.cond && ctx.addCond) ctx.addCond(a.cond);
            if (a.uncond && ctx.removeCond) a.uncond.forEach(id => ctx.removeCond(id));
            // Letting go: its grapple's Staggered ends (not one it got some other way)
            if (a.endFx && ctx.endFx && ctx.endFx(a.endFx) && ctx.removeCond) ctx.removeCond('staggered');
        }
        let left = ctx.have ? ctx.have() : null;
        if (ctx.log) ctx.log(`${who}: ${a.name}${a.ask ? (won ? ' (won)' : ' (lost)') : ''}${cost ? ` (−${cost} AP${left != null ? `, ${left} left` : ''})` : ''}.`, a);
    }
})();
