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
// removeCond(id), addFx(fx), endFx(key) → true if it had one, standUpCharges, move(), sb() → its stat block,
// rollFlags (which creature a roll belongs to), attacked() (it made an attack), recover: { used(kind), use(kind),
// heal(n), wounds(), healWound(limb) } } (anything it lacks is skipped).
//   roll    → rolled for it from its stat block: a skill (its trained total, or the attribute) or a STR melee
//             attack (STR + its Training Bonus); a contest then asks whether it won
// ============================================================
(function () {
    'use strict';
    const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const L = [
        { g: 'Combat Maneuvers', name: 'Fight Defensively', cost: 1, tip: '+2 AC and Disadvantage on its attack rolls until the start of its next turn. If it makes no attacks this turn, the bonus is +4.', fx: { key: 'defensive', label: 'Fight Defensively', atkDis: true, ac: 4 } },
        { g: 'Combat Maneuvers', name: 'Fight Offensively', cost: 1, tip: 'Advantage on its attack rolls until the start of its next turn; attacks against it have Advantage too.', fx: { key: 'offensive', label: 'Fight Offensively', atkAdv: true } },
        { g: 'Combat Maneuvers', name: 'Block', cost: 2, tip: 'Double its shield\'s AC bonus until the start of its next turn or until it attacks. With a Sturdy weapon instead: roll one of its damage dice and add it to its AC. A Parrying weapon blocks the same way, as its Reaction (0 AP).', block: true, fx: { key: 'block', label: 'Block', untilAttack: true } },
        { g: 'Combat Maneuvers', name: 'Shield Bash', cost: 3, tip: 'With a shield: a STR melee attack; on a hit, Bludgeoning damage equal to its STR score and the target is Staggered until its next turn.', shield: true, roll: { attack: 'STR', label: 'Shield Bash', hitNote: sb => `Hit: ${5 + ((sb && sb.mods && sb.mods.STR) || 0)} Bludgeoning damage (its STR score) and the target is Staggered until its next turn` } },
        { g: 'Combat Maneuvers', name: 'Disengage', cost: 2, tip: 'Its movement doesn\'t provoke attacks of opportunity until the end of its turn.', fx: { key: 'disengage', label: 'Disengaged' } },
        { g: 'Combat Maneuvers', name: 'Power Attack', cost: 2, extra: '+ attack', tip: 'Declare before its next melee attack (it also costs its own AP): on a hit, add its STR modifier to the damage.', fx: { key: 'power', label: 'Power Attack: +STR dmg', next: {} } },
        { g: 'Combat Maneuvers', name: 'Precision Attack', cost: 2, extra: '+ attack', tip: 'Declare before its next melee attack (it also costs its own AP): on a hit, add its AGI modifier to the damage.', fx: { key: 'precision', label: 'Precision Attack: +AGI dmg', next: {} } },
        { g: 'Combat Maneuvers', name: 'Sweeping Strike', cost: 1, extra: '+ attack', tip: 'Its next melee attack is rolled with Disadvantage and compared to the AC of two adjacent enemies in reach.', fx: { key: 'sweep', label: 'Sweeping Strike', next: { dis: true } } },
        { g: 'Combat Maneuvers', name: 'Whirlwind', cost: 3, extra: '+ attack', tip: 'Its next melee attack is rolled with Disadvantage and compared to the AC of every enemy in reach.', fx: { key: 'whirl', label: 'Whirlwind', next: { dis: true } } },
        { g: 'Combat Maneuvers', name: 'Charge', cost: 3, tip: 'Move up to its Speed in a straight line (2+ squares). Then 1 AP: a melee attack with Disadvantage that deals an extra damage die, or a tackle (both Prone, STR score damage).', fx: { key: 'charge', label: 'Charge: +1 damage die', next: { dis: true } } },
        { g: 'Combat Maneuvers', name: 'Lunging Attack', cost: 1, extra: '+ attack', tip: 'Declare before its next melee attack (it also costs its own AP): it has 1 square more reach and Disadvantage, and it provokes attacks of opportunity.', fx: { key: 'lunge', label: 'Lunge', next: { dis: true } } },
        { g: 'Combat Maneuvers', name: 'Disarming Attack', cost: 2, extra: '+ attack', tip: 'Declare before its next melee attack (it also costs its own AP): it has Disadvantage, and on a hit the target drops an item of its choice (2 AP to catch it).', fx: { key: 'disarm', label: 'Disarm', next: { dis: true } } },
        { g: 'Combat Maneuvers', name: 'Shove', cost: 3, tip: 'A melee attack that deals no damage (Disadvantage against larger creatures): on a hit, push 2 squares or knock Prone.', roll: { attack: 'STR', label: 'Shove', larger: true, hitNote: () => 'No damage. Hit: push the target 2 squares away or knock it Prone' }, shove: true },
        { g: 'Combat Maneuvers', name: 'Feint', cost: 2, tip: 'CHA (Deceive) against the target\'s PER (Insight). If it wins, its next attack against that target this turn has Advantage.', roll: { skill: 'Deceive', attr: 'CHA', label: 'Feint: CHA (Deceive)' }, ask: 'Feint won?', vs: 'the target\'s PER (Insight)', fx: { key: 'feint', label: 'Feint: Adv on next attack', next: { adv: true } } },
        { g: 'Combat Maneuvers', name: 'Vault', cost: 2, tip: 'AGI (Acrobatics) against the creature\'s STR (Athletics): leap over it, and its first melee attack against it this turn has Advantage.', roll: { skill: 'Acrobatics', attr: 'AGI', label: 'Vault: AGI (Acrobatics)' }, ask: 'Vault won?', vs: 'the creature\'s STR (Athletics)', fx: { key: 'vault', label: 'Vault: Adv on next melee attack', next: { adv: true, melee: true } } },
        { g: 'Combat Maneuvers', name: 'Grapple', cost: 3, tip: 'A free hand, on a creature no more than one size larger: contested STR (Athletics) against its STR (Athletics) or AGI (Acrobatics). On a win the target is Grappled, and the grappler is Staggered for as long as it holds on.', roll: { skill: 'Athletics', attr: 'STR', label: 'Grapple: STR (Athletics)', push: true }, ask: 'Grapple won?', vs: 'its STR (Athletics) or AGI (Acrobatics)', cond: 'staggered', fx: { key: 'grappling', label: 'Grappling (Staggered)', keep: true }, grab: 'grapple' },
        { g: 'Combat Maneuvers', name: 'Pin', cost: 2, tip: 'On a creature it\'s grappling: contested STR (Athletics) again. On a win the target is Pinned: also Restrained and Prone.', roll: { skill: 'Athletics', attr: 'STR', label: 'Pin: STR (Athletics)', push: true }, ask: 'Pin won?', vs: 'its STR (Athletics)', grab: 'pin' },
        { g: 'Combat Maneuvers', name: 'Choke', cost: 2, tip: 'On a creature it has Pinned: its unarmed strike damage with no attack roll, lethal or non-lethal. It ignores the target\'s DR, ER and resistances, and counts as an attack.' },
        { g: 'Combat Maneuvers', name: 'Escape', cost: 4, tip: 'Break free of a grapple: contested STR (Athletics) or AGI (Acrobatics) against the grappler\'s STR (Athletics). On a win, the Grapple and any Pin end.', roll: { escape: true }, ask: 'Escape won?', vs: 'the grappler\'s STR (Athletics)', uncond: ['pinned', 'grappled', 'grabbed'] },
        { g: 'Combat Maneuvers', name: 'Recover: Shake It Off', cost: 1, recover: 'shake', tip: 'Roll half its Rest Dice (its CON score in d6, rounded down) and add its CON modifier to each die: it regains that much HP. Once per fight (a Short or Full Rest brings it back).' },
        { g: 'Combat Maneuvers', name: 'Recover: Shrug It Off', cost: 3, recover: 'shrug', tip: 'Completely heal one of its Wounded limbs. Once per fight (a Short or Full Rest brings it back).' },
        { g: 'Combat Maneuvers', name: 'Let Go', cost: 0, tip: 'Release the creature it\'s grappling (a Free Action). Its Staggered from the grapple ends.', endFx: 'grappling' },
        { g: 'Standard Actions', name: 'Move', cost: null, tip: 'Move up to its Speed. Costs 1 AP the first time this turn, 2 the second, 3 the third… (dragging its token on a battle map in combat pays this for you).', move: true },
        { g: 'Standard Actions', name: 'Jump', cost: null, tip: 'A Jump counts as moving for its AP (1 AP the first time this turn, 2 the second…). It jumps up to its STR modifier in squares (minimum 1); further takes a STR (Athletics) check, DC 5 per extra square.', move: true },
        { g: 'Standard Actions', name: 'Draw / Stow', cost: 2, tip: 'Draw a weapon or stow an item it\'s holding (a Quickdraw weapon: 0 AP).', quick: true },
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
        let sbNow = null; try { sbNow = ctx.sb ? ctx.sb() : null; } catch (e) { }
        let pop = document.createElement('div');
        pop.id = 'apxCreatureActionsPop';
        pop.style.cssText = 'position:fixed;width:min(720px,calc(100vw - 16px));max-height:min(78vh,620px);overflow:auto;background:var(--c-surface,#1e293b);border:1px solid var(--c-border2,#475569);border-radius:.6rem;box-shadow:0 18px 50px rgba(0,0,0,.7);padding:.5rem;color:var(--c-text,#fff);font-family:var(--c-font,inherit)';
        let groups = [...new Set(L.map(a => a.g))];
        pop.innerHTML = `<div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.35rem"><b style="flex:1;font-size:.85rem">${esc(ctx.name || 'Creature')}: Actions</b>${have != null ? `<span style="font-size:.7rem;color:var(--c-text-muted,#94a3b8)"><b style="color:#60a5fa">${have}</b> AP</span>` : ''}<button data-x style="background:none;border:none;color:var(--c-text-muted,#94a3b8);font-weight:900;cursor:pointer">✕</button></div>`
            + (ctx.note ? `<div style="font-size:.66rem;color:#fcd34d;margin-bottom:.3rem">${esc(ctx.note)}</div>` : '')
            + `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:.6rem;align-items:start">`
            + groups.map(g => `<div><div style="font-size:.62rem;font-weight:900;text-transform:uppercase;letter-spacing:.05em;color:var(--c-indigo-lt,#a5b4fc);margin:.2rem 0">${g}</div>`
                + L.filter(a => a.g === g && (!a.recover || ctx.recover)).map(a => {
                    let c = a.move && ctx.moveCost ? ctx.moveCost() : a.cost;
                    let lbl = (c == null ? 'X' : String(c)) + (a.extra ? ' ' + a.extra : '');
                    let why = a.needs && ctx.conds && !conds.includes(a.needs) ? `It isn't ${a.needs[0].toUpperCase() + a.needs.slice(1)}.` : '';
                    if (!why && a.recover && ctx.recover.used(a.recover)) why = 'Already used this fight.';
                    if (!why && a.recover === 'shrug' && !ctx.recover.wounds().length) why = 'It has no Wounded limbs.';
                    if (!why && a.shield && sbNow && sbNow.hasShield === false) why = 'It has no shield.';
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

    // A roll for the creature from its stat block: a skill check, or a STR melee attack (Shove, Shield Bash).
    // Returns true when it rolled, false when it couldn't (no dice tray), null when cancelled.
    async function rollFor(a, ctx) {
        if (!window.APXDice) return false;
        let sb = null; try { sb = ctx.sb ? ctx.sb() : null; } catch (e) { }
        let R = Object.assign({}, a.roll);
        if (R.escape) {
            let which = APXDice.ask ? await APXDice.ask('Escape', 'Roll which?', [['Athletics', 'STR (Athletics)', 'pri'], ['Acrobatics', 'AGI (Acrobatics)']]) : 'Athletics';
            if (!which) return null;
            R = { skill: which, attr: which === 'Athletics' ? 'STR' : 'AGI', label: `Escape: ${which === 'Athletics' ? 'STR' : 'AGI'} (${which})` };
        }
        let base = Object.assign({ who: ctx.name || (sb && sb.name) || '', perks: false, gambleAllowed: false }, ctx.rollFlags || {});
        let mods = (sb && sb.mods) || {};
        if (R.skill) {
            let sk = sb && (sb.trainedSkills || []).find(x => x.name === R.skill);
            let adv = ((sk && sk.adv) || []).slice(), dis = ((sk && sk.dis) || []).slice();
            // Large: Advantage on STR (Athletics) to grapple, pin or escape a grapple
            if (R.skill === 'Athletics' && R.push && sb && sb.sizeKey === 'large') adv.push('Large size');
            APXDice.check(Object.assign(base, { attr: R.attr, skill: R.skill, label: R.label, bonus: sk ? sk.total : (mods[R.attr] || 0),
                advSources: adv.length ? adv : undefined, disSources: dis.length ? dis : undefined }));
            return true;
        }
        if (R.attack) {
            let dis = sb && sb.armorStrShort ? ['Armor (STR requirement not met)'] : [];
            if (R.larger && APXDice.ask) {
                let big = await APXDice.ask(R.label, 'Is the target larger than it? Shoving a larger creature is rolled with Disadvantage.', [['no', 'Same size or smaller', 'pri'], ['yes', 'Larger: Disadvantage']]);
                if (!big) return null;
                if (big === 'yes') dis.push('Target is larger');
            }
            // Large: Advantage on melee attack rolls made to Shove
            let adv = R.label === 'Shove' && sb && sb.sizeKey === 'large' ? ['Large size'] : [];
            APXDice.check(Object.assign(base, { kind: 'attack', attr: R.attack, label: R.label, bonus: (mods[R.attack] || 0) + ((sb && sb.trainingBonus) || 0),
                note: R.hitNote ? R.hitNote(sb) : undefined, disSources: dis.length ? dis : undefined, advSources: adv.length ? adv : undefined }));
            if (ctx.attacked) ctx.attacked();   // (an attack: Fight Defensively drops to +2, Block ends)
            return true;
        }
        return false;
    }
    // Recover (Shake It Off / Shrug It Off): once per fight for a creature in the tracker
    async function recover(a, ctx) {
        let rc = ctx.recover, who = ctx.name || 'The creature';
        let sb = null; try { sb = ctx.sb ? ctx.sb() : null; } catch (e) { }
        let con = (sb && sb.mods && sb.mods.CON) || 0;
        if (a.recover === 'shake') {
            let n = Math.max(1, Math.floor((5 + con) / 2));   // half its Rest Dice (its CON score, in d6)
            let card = window.APXDice && APXDice.rest ? APXDice.rest({ label: 'Recover: Shake It Off', who, dieStep: 'd6', count: n, flat: con }) : null;
            let heal = typeof card === 'number' ? card : (() => { let t = 0; for (let i = 0; i < n; i++) t += 1 + Math.floor(Math.random() * 6) + con; return t; })();
            rc.use('shake'); rc.heal(Math.max(0, heal), `Shake It Off (${n}d6${con ? (con > 0 ? ' +' : ' −') + Math.abs(con) + ' each' : ''})`);
            return true;
        }
        let limbs = rc.wounds();
        if (!limbs.length) return false;
        let limb = limbs[0];
        if (new Set(limbs).size > 1 && window.APXDice && APXDice.ask) {
            limb = await APXDice.ask('Shrug It Off', `Which of ${who}'s Wounded limbs heals?`, [...new Set(limbs)].map((l, i) => [l, l, i ? '' : 'pri']));
            if (!limb) return false;
        }
        rc.use('shrug'); rc.healWound(limb);
        return true;
    }

    async function doIt(a, ctx) {
        let who = ctx.name || 'The creature';
        let cost = a.move && ctx.moveCost ? ctx.moveCost() : a.cost;
        if (a.ready) {
            let v = window.apxPrompt ? await window.apxPrompt(`Ready an action for ${who}: how many AP does it cost?`, '3', { title: 'Ready' }) : '3';
            cost = parseInt(v); if (!(cost >= 0)) return;
        }
        // Block: its shield (+2 more AC), or a Sturdy weapon's damage die; a Parrying weapon does it as its Reaction (0 AP)
        let blockFx = null;
        if (a.block) {
            let sb = null; try { sb = ctx.sb ? ctx.sb() : null; } catch (e) { }
            let ws = ((sb && sb.equippedWeapons) || []).filter(w => (w.props || []).some(p => p === 'sturdy' || p === 'parrying'));
            let opts = (sb && sb.hasShield && sb.shieldOn !== false ? [['shield', 'Shield (+2 more AC)', 'pri']] : []).concat(ws.map((w, i) => ['w' + i, `${w.name} (1d${(String(w.dmg || '').match(/d(\d+)/) || [0, 6])[1]})${(w.props || []).includes('sturdy') ? '' : ': Parrying, its Reaction (0 AP)'}`, '']));
            if (opts[0]) opts[0][2] = 'pri';
            let pick = opts.length > 1 && window.APXDice && APXDice.ask ? await APXDice.ask('Block with…', `A shield doubles its AC bonus; a Sturdy weapon rolls one of its damage dice as its AC bonus. A Parrying weapon blocks the same way, as its Reaction.`, opts) : (opts[0] || [])[0];
            if (opts.length > 1 && !pick) return;
            if (pick === 'shield') blockFx = { ac: 2, label: 'Block (shield): +2 AC' };
            else if (pick) {
                let w = ws[+pick.slice(1)], sides = +((String(w.dmg || '').match(/d(\d+)/) || [0, 6])[1]);
                let roll = window.APXDice && APXDice.rnd ? APXDice.rnd(sides) : 1 + Math.floor(Math.random() * sides);
                let parry = !(w.props || []).includes('sturdy');
                blockFx = { ac: roll, label: `Block (${w.name}${parry ? ', Parrying' : ''}): +${roll} AC` };
                if (parry) cost = 0;
                window.APXDice?.info?.({ label: 'Block', who, text: `${w.name}: rolled 1d${sides} = ${roll}. +${roll} AC until its next turn or until it attacks.${parry ? ' Parrying: its Reaction, no AP.' : ''}` });
            }
        }
        // Draw / Stow: a Quickdraw weapon takes 0 AP
        if (a.quick) {
            let sb = null; try { sb = ctx.sb ? ctx.sb() : null; } catch (e) { }
            let qd = ((sb && sb.equippedWeapons) || []).filter(w => (w.props || []).includes('quickdraw'));
            if (qd.length && window.APXDice && APXDice.ask) {
                let ans = await APXDice.ask('Draw / Stow', 'A Quickdraw weapon is drawn or stowed for 0 AP.', qd.map((w, i) => ['q' + i, `${w.name} (Quickdraw): 0 AP`, i ? '' : 'pri']).concat([['other', 'Something else: 2 AP']]));
                if (!ans) return;
                if (ans !== 'other') cost = 0;
            }
        }
        cost = cost || 0;
        let have = ctx.have ? ctx.have() : null;
        if (a.move && have != null && ctx.moveAp) have += ctx.moveAp();   // (a power's AP for movement only)
        if (have != null && cost > have) {
            let ok = window.apxConfirm ? await window.apxConfirm(`${a.name} costs ${cost} AP and ${who} has ${have}. Do it anyway?`, { title: 'Not enough AP', okLabel: 'Do it anyway', cancelLabel: 'Cancel' }) : true;
            if (!ok) return;
        }
        // Its roll (from its stat block), then for a contest: did it win? The effect applies only on a win.
        let rolled = false;
        if (a.roll) { rolled = await rollFor(a, ctx); if (rolled === null) return; }
        let won = true;
        if (a.ask && window.APXDice && APXDice.ask) {
            let ans = await APXDice.ask(a.ask, rolled ? `${who}'s roll is in your dice tray. Compare it with ${a.vs || 'the other side\'s roll'}: did it win?` : `${a.tip} Roll the contest from its stat block, then say how it went.`, [['won', 'Won', 'pri'], ['lost', 'Lost']]);
            if (!ans) return;
            won = ans === 'won';
        }
        // Who it grapples, pins or knocks Prone (the GM's tracker: a player's sheet gets the Condition too)
        let target = null, shoveProne = false;
        if (won && a.grab && ctx.pickTarget) {
            target = a.grab === 'pin' && ctx.grappling ? ctx.grappling() : null;
            if (!target) { target = await ctx.pickTarget(a.grab === 'pin' ? `Who does ${who} pin?` : `Who does ${who} grapple?`); if (target === undefined) return; }
        }
        if (a.shove && ctx.pickTarget && window.APXDice && APXDice.ask) {
            let ans = await APXDice.ask('Shove', `${who}'s attack roll is in your dice tray. Compare it with the target's AC: did it hit?`, [['prone', 'Hit: knock it Prone', 'pri'], ['push', 'Hit: push it 2 squares'], ['miss', 'Missed']]);
            if (!ans) return;
            if (ans === 'prone') { target = await ctx.pickTarget(`Who does ${who} knock Prone?`); if (target === undefined) return; shoveProne = !!target; }
        }
        if (a.recover) { let ok = await recover(a, ctx); if (!ok) return; }
        if (a.move && ctx.move) ctx.move();
        let spend = have != null ? Math.min(cost, have) : cost;
        // (standing up: removing Prone already charges its 2 AP where the page does that)
        // (a maneuver against a creature is a hostile action: Invisible from a power, 2 AP to stay hidden)
        if (['Shove', 'Grapple', 'Pin', 'Choke', 'Shield Bash', 'Feint'].includes(a.name) && ctx.hostile) setTimeout(() => ctx.hostile(), 0);
        if (spend > 0 && a.move && ctx.spendMove) ctx.spendMove(spend);
        else if (spend > 0 && ctx.spend && !(a.stand && ctx.standUpCharges)) ctx.spend(spend);
        if (won) {
            if (a.fx && ctx.addFx) ctx.addFx(Object.assign({ id: 'fx' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: a.name }, JSON.parse(JSON.stringify(a.fx)), blockFx || {}));
            // (a grapple the tracker links up Staggers the grappler itself)
            if (a.cond && ctx.addCond && !(a.grab && target && ctx.grapple)) ctx.addCond(a.cond);
            if (a.grab && target && ctx.grapple) ctx.grapple(target, a.grab === 'pin');
            if (shoveProne && ctx.knockProne) ctx.knockProne(target);
            if (a.uncond && ctx.removeCond) a.uncond.forEach(id => ctx.removeCond(id));
            // Letting go: its grapple's Staggered ends (not one it got some other way)
            if (a.endFx && ctx.endFx && ctx.endFx(a.endFx) && ctx.removeCond) ctx.removeCond('staggered');
        }
        let left = ctx.have ? ctx.have() : null;
        if (ctx.log) ctx.log(`${who}: ${a.name}${a.ask ? (won ? ' (won)' : ' (lost)') : ''}${cost ? ` (−${cost} AP${left != null ? `, ${left} left` : ''})` : ''}.`, a);
    }
})();
