// ============================================================
// APX Dice — one roller for the Character Sheet, companions, GM Tools
// and every stat block.
// ============================================================
//   APXDice.check({ label, who, bonus, adv, advSources, disSources, autoFail })
//   APXDice.attack({ label, who, bonus, dice, dmgMod, dmgType, critMult, adv, … , perks:true })
//   APXDice.damage({ label, who, formula, heal, perks:true })
//   APXDice.formula(label, "2d6+3", who)
//   APXDice.rest({ label, dieStep, count, wellRested })
//   APXDice.linkify(element)      turn "2d6+3" text into clickable rolls
//
// Perks (character sheet only, when perks:true):
//   High Roller  R1 Gamble (forced Disadvantage, +5 damage on a hit; +10 and +1 AP from R4)
//                R2 reroll 1s and 2s on damage   R3 Luck Point reroll of the d20
//                R4 landing a Gamble grants +1 AP R5 Exploding dice once per Full Rest
//   Omen         stored d20s that can replace any d20 roll (R2 ±LUC mod,
//                R3 bank natural 1s and 20s), rolled after a Full Rest.
// ============================================================
(function () {
    'use strict';

    // Critical hits multiply the NUMBER of damage dice rolled: 2d4 at x2 rolls 4d4,
    // 4d12 at x3 rolls 12d12. Flat modifiers are added once.
    const CRIT_MODE = 'count';

    // ── RNG + parsing ────────────────────────────────────────────
    function rnd(sides) {
        let a = new Uint32Array(1);
        (window.crypto || window.msCrypto).getRandomValues(a);
        return (a[0] % sides) + 1;
    }
    // "2d6 + 1d4 - 1 Fire" -> { dice:[{n,s,sign}], flat }
    function parse(str) {
        let s = String(str || '').toLowerCase().replace(/\s+/g, '');
        let out = { dice: [], flat: 0 };
        let re = /([+-]?)(\d*)d(\d+)|([+-]?)(\d+)(?!\d*d)/g, m;
        while ((m = re.exec(s))) {
            if (m[3]) out.dice.push({ n: Math.max(1, parseInt(m[2] || '1', 10)), s: parseInt(m[3], 10), sign: m[1] === '-' ? -1 : 1 });
            else if (m[5]) out.flat += (m[4] === '-' ? -1 : 1) * parseInt(m[5], 10);
        }
        return out;
    }
    function fmtNum(n) { return n >= 0 ? '+' + n : String(n); }
    function esc(t) { return String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

    // ── Character-sheet context (perks) ──────────────────────────
    function S() { return window.state || {}; }
    function perk(id) { return (S().perks || {})[id] || 0; }
    function lucMod() { try { return (typeof calc !== 'undefined' && calc.mods) ? (calc.mods.LUC || 0) : 0; } catch (e) { return 0; } }
    function omenPerRest(r) { return r >= 5 ? 3 : r >= 4 ? 3 : r >= 3 ? 2 : r >= 1 ? 1 : 0; }

    // Roll a group of dice with the active damage perks applied
    function rollGroup(n, s, opt) {
        opt = opt || {};
        let dice = [];
        for (let i = 0; i < n; i++) {
            let v = rnd(s), d = { v, s };
            if (opt.reroll12 && v <= 2) { d.from = v; d.v = rnd(s); }            // High Roller R2
            if (opt.explode && d.v === s) {                                       // High Roller R5: max → roll it again, add it
                let x = rnd(s);
                if (opt.reroll12 && x <= 2) x = rnd(s);
                d.boom = [x];
            }
            dice.push(d);
        }
        return dice;
    }
    function dieSum(d) { return d.v + (d.boom ? d.boom.reduce((a, b) => a + b, 0) : 0); }

    // Damage perks that change the dice (character sheet only):
    //   High Roller R2 reroll 1s/2s, R5 Dice Explosion; Melee Prowess R2 / Sharpshooter R2
    //   roll damage twice keep the higher total; Melee Prowess R5 / Sharpshooter R5 crit
    //   confirm roll → maximum critical damage; Instigator R3 vs a Frightened/Provoked
    //   target: +1 damage die and crit multiplier +1.
    function damagePerks(o, usePerks) {
        let cat = o.wcat || '';
        let mp = usePerks ? perk('str_meleeprowess') : 0, ss = usePerks ? perk('per_sharpshooter') : 0;
        return {
            hr: usePerks ? perk('luc_highroller') : 0,
            keepBest: (cat === 'melee' && mp >= 2) || (cat === 'ranged' && ss >= 2),
            keepSrc: cat === 'ranged' ? 'Sharpshooter' : 'Melee Prowess',
            maxConfirm: (cat === 'melee' && mp >= 5) || (cat === 'ranged' && ss >= 5),
            confirmSrc: cat === 'ranged' ? 'Sharpshooter' : 'Melee Prowess',
            instig: usePerks && (cat === 'melee' || cat === 'ranged') && perk('cha_instigator') >= 3
        };
    }
    // Rolls every die the damage could need up front (crit extras, Instigator's die, a second
    // set for keep-the-higher), so the card can be re-settled later (Omen 20, toggles) without rerolling.
    function makeDamage(formula, opt) {
        let p = parse(formula || '0');
        let critMult = opt.critMult || 2, mmax = critMult + (opt.instig ? 1 : 0);
        let sets = (opt.keepBest ? [0, 1] : [0]).map(() => p.dice.map((g, i) => rollGroup((g.n + (i === 0 && opt.instig ? 1 : 0)) * Math.max(1, mmax), g.s, opt)));
        function evalSet(pools, st) {
            let mult = st.crit ? critMult + (st.inst ? 1 : 0) : 1;
            let base = [], extra = [];
            p.dice.forEach((g, i) => {
                let n = g.n + (st.inst && i === 0 ? 1 : 0);
                let bd = pools[i].slice(0, n), ed = pools[i].slice(n, n * mult);
                if (st.maxed) { bd = bd.map(d => ({ v: d.s, s: d.s })); ed = ed.map(d => ({ v: d.s, s: d.s })); }
                base.push({ sign: g.sign, s: g.s, dice: bd });
                if (ed.length) extra.push({ sign: g.sign, s: g.s, crit: true, dice: ed });
            });
            let groups = base.concat(extra);
            let diceTotal = groups.reduce((t, g) => t + g.sign * g.dice.reduce((a, d) => a + dieSum(d), 0), 0);
            return { groups, flat: p.flat, diceTotal, mult };
        }
        return {
            parsed: p,
            settle(st) {
                let rs = sets.map(pl => evalSet(pl, st));
                let k = rs.length > 1 && rs[1].diceTotal > rs[0].diceTotal ? 1 : 0;
                return { roll: rs[k], other: rs.length > 1 ? rs[1 - k] : null };
            },
            rerolled() { return sets.some(pl => pl.some(g => g.some(d => d.from))); }
        };
    }

    function rollFormula(formula, opt) {
        let p = parse(formula);
        let k = (opt && opt.countMult) || 1;
        let groups = p.dice.map(g => ({ sign: g.sign, s: g.s, crit: !!(opt && opt.critExtra), dice: rollGroup(g.n * k, g.s, opt) }));
        let diceTotal = groups.reduce((t, g) => t + g.sign * g.dice.reduce((a, d) => a + dieSum(d), 0), 0);
        return { groups, flat: p.flat, diceTotal, total: diceTotal + p.flat };
    }

    function d20(mode) {
        let a = rnd(20);
        if (mode !== 'adv' && mode !== 'dis') return { rolls: [a], kept: 0, nat: a, mode: 'normal' };
        let b = rnd(20);
        let kept = mode === 'adv' ? (b > a ? 1 : 0) : (b < a ? 1 : 0);
        return { rolls: [a, b], kept, nat: kept ? b : a, mode };
    }
    // Advantage + Disadvantage cancel out (unless one is "uncancelable")
    function combineMode(list, forced) {
        if (forced) return forced;
        let adv = list.includes('adv'), dis = list.includes('dis');
        return adv && dis ? 'normal' : adv ? 'adv' : dis ? 'dis' : 'normal';
    }

    // ── Tray UI ──────────────────────────────────────────────────
    const tray = { el: null, log: null, mode: 'normal', explodeNext: false, open: false };
    let cards = [];

    function css() {
        if (document.getElementById('apxDiceCss')) return;
        let st = document.createElement('style');
        st.id = 'apxDiceCss';
        st.textContent = `
        .apxd-fab{position:fixed;right:18px;bottom:18px;z-index:2147483000;width:48px;height:48px;border-radius:50%;border:2px solid var(--c-border2,#475569);
            background:var(--c-surface,#1e293b);color:var(--c-text,#fff);box-shadow:0 6px 20px rgba(0,0,0,.6);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .15s}
        .apxd-fab:hover{transform:scale(1.07)} .apxd-fab svg{width:28px;height:28px}
        .apxd-tray{position:fixed;right:18px;bottom:76px;z-index:2147483001;width:340px;max-width:calc(100vw - 24px);max-height:min(78vh,720px);display:none;flex-direction:column;
            background:var(--c-surface,#1e293b);border:1px solid var(--c-border2,#475569);border-radius:.75rem;box-shadow:0 20px 60px rgba(0,0,0,.7);color:var(--c-text,#fff);font-family:var(--c-font,inherit)}
        .apxd-tray.open{display:flex}
        .apxd-hdr{display:flex;align-items:center;gap:.4rem;padding:.5rem .7rem;border-bottom:1px solid var(--c-border,#334155);background:var(--c-surface2,#0f172a);border-radius:.75rem .75rem 0 0}
        .apxd-hdr b{flex:1;font-size:.82rem;font-family:var(--c-heading-font,inherit)}
        .apxd-x{background:none;border:none;color:var(--c-text-dimmer,#94a3b8);font-weight:800;cursor:pointer;font-size:.8rem}
        .apxd-bar{display:flex;flex-wrap:wrap;gap:.3rem;padding:.45rem .6rem;border-bottom:1px solid var(--c-border,#334155);align-items:center}
        .apxd-seg{display:flex;border:1px solid var(--c-border2,#475569);border-radius:.35rem;overflow:hidden}
        .apxd-seg button{background:none;border:none;color:var(--c-text-dimmer,#cbd5e1);font-size:.69rem;font-weight:800;padding:.2rem .45rem;cursor:pointer}
        .apxd-seg button.on{background:var(--c-indigo,#4f46e5);color:#fff}
        .apxd-seg button.on.dis{background:var(--c-red,#dc2626)} .apxd-seg button.on.adv{background:var(--c-emerald,#059669)}
        .apxd-q{display:flex;flex-wrap:wrap;gap:.25rem;padding:.4rem .6rem;border-bottom:1px solid var(--c-border,#334155)}
        .apxd-q button{background:var(--c-surface2,#0f172a);border:1px solid var(--c-border,#334155);color:var(--c-text,#fff);font-size:.73rem;font-weight:800;padding:.2rem .4rem;border-radius:.3rem;cursor:pointer}
        .apxd-q button:hover{border-color:var(--c-indigo,#6366f1)}
        .apxd-q input{width:74px;background:var(--c-surface2,#0f172a);border:1px solid var(--c-border,#334155);color:var(--c-text,#fff);font-size:.74rem;padding:.2rem .35rem;border-radius:.3rem}
        .apxd-pool{display:flex;flex-wrap:wrap;align-items:center;gap:.25rem;padding:.35rem .6rem;border-bottom:1px solid var(--c-border,#334155);min-height:30px}
        .apxd-pool .chip{font-size:.73rem;font-weight:900;padding:.12rem .4rem;border-radius:.3rem;border:1px solid var(--c-indigo,#6366f1);background:rgba(99,102,241,.15);color:var(--c-text,#fff);cursor:pointer}
        .apxd-pool .chip:hover{border-color:#f87171;color:#fca5a5}
        .apxd-pool .ph{font-size:.69rem;color:var(--c-text-muted,#64748b);flex:1}
        .apxd-pool .modtag{font-size:.73rem;font-weight:800;color:var(--c-text-dimmer,#cbd5e1)}
        .apxd-pool .go{margin-left:auto;background:var(--c-emerald,#059669);border:none;color:#fff;font-size:.7rem;font-weight:900;padding:.22rem .7rem;border-radius:.3rem;cursor:pointer}
        .apxd-pool .go:disabled{opacity:.4;cursor:default}
        .apxd-pool .clr{background:none;border:none;color:var(--c-text-muted,#94a3b8);font-size:.67rem;font-weight:800;cursor:pointer}
        .apxd-card.log{padding:.3rem .5rem;border-left:3px solid var(--c-indigo,#6366f1);font-size:.74rem;line-height:1.35;color:var(--c-text-dimmer,#cbd5e1)}
        .apxd-card.log.k-dmg{border-left-color:#ef4444} .apxd-card.log.k-heal{border-left-color:#10b981}
        .apxd-card.log.k-wt{border-left-color:#f59e0b} .apxd-card.log.k-bleed{border-left-color:#b91c1c}
        .apxd-card.log.k-roll{border-left-color:#818cf8} .apxd-card.log.k-info{border-left-color:#64748b}
        .apxd-card.log.k-note{border-left-color:#38bdf8} .apxd-card.log.k-warn{border-left-color:#f87171;color:var(--c-text,#fff)}
        .apxd-card.log.k-xp{border-left-color:#34d399} .apxd-card.log.k-loot{border-left-color:#f59e0b}
        .apxd-card.log .lt{font-size:.62rem;color:var(--c-text-muted,#94a3b8);margin-right:.35rem}
        .apxd-card.log .lg{font-size:.58rem;font-weight:800;text-transform:uppercase;color:var(--c-text-muted,#94a3b8);margin-right:.3rem}
        .apxd-fab.unseen::after{content:'';position:absolute;top:2px;right:2px;width:11px;height:11px;border-radius:50%;background:#ef4444;border:2px solid var(--c-surface,#1e293b)}
        .apxd-tray>*{flex-shrink:0}
        .apxd-log{overflow-y:auto;padding:.5rem .6rem;display:flex;flex-direction:column;gap:.45rem;min-height:90px;flex:1 1 auto;flex-shrink:1}
        .apxd-empty{font-size:.7rem;color:var(--c-text-muted,#64748b);text-align:center;padding:1rem .5rem}
        .apxd-card{border:1px solid var(--c-border,#334155);background:var(--c-surface2,#0f172a);border-radius:.55rem;padding:.45rem .55rem}
        .apxd-card.crit{border-color:#facc15;box-shadow:0 0 0 1px #facc15 inset}
        .apxd-card.fumble{border-color:var(--c-red,#dc2626)}
        .apxd-title{display:flex;align-items:baseline;gap:.35rem;font-size:.74rem;font-weight:800}
        .apxd-title span{font-size:.67rem;font-weight:600;color:var(--c-text-muted,#94a3b8)}
        .apxd-part{display:flex;align-items:center;gap:.35rem;margin-top:.3rem;flex-wrap:wrap}
        .apxd-plabel{font-size:.65rem;font-weight:800;text-transform:uppercase;color:var(--c-text-muted,#94a3b8);width:46px}
        .apxd-die{min-width:22px;height:22px;padding:0 3px;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;font-size:.74rem;font-weight:900;
            background:var(--c-surface,#1e293b);border:1px solid var(--c-border2,#475569);color:var(--c-text,#fff);position:relative}
        .apxd-die.d20{border-radius:50% 50% 6px 6px;border-color:var(--c-indigo-lt,#818cf8)}
        .apxd-die.sh{background:none;border:none;border-radius:0;width:28px;height:28px;min-width:28px;padding:0}
        .apxd-die.sh.w3{width:32px;min-width:32px}
        .dsh{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
        .dsh *{fill:var(--c-surface,#1e293b);stroke:var(--c-border2,#475569);stroke-width:1.3;vector-effect:non-scaling-stroke;stroke-linejoin:round}
        .apxd-die .dn,.dq .dn{position:relative;display:inline-flex;align-items:baseline;line-height:1}
        .apxd-die.s4 .dn,.dq.s4 .dn{transform:translateY(3px)} .apxd-die.s8 .dn,.dq.s8 .dn{transform:translateY(-3px)}
        .apxd-die.s4,.apxd-die.s8{font-size:.66rem}
        .apxd-die.s20 .dsh *{stroke:var(--c-indigo-lt,#818cf8)}
        .apxd-die.max .dsh *{stroke:#facc15} .apxd-die.min .dsh *{stroke:#f87171}
        .apxd-die.omen.sh{background:none} .apxd-die.omen .dsh *{fill:#3b0764;stroke:#c084fc}
        .apxd-die.dashed .dsh *{stroke-dasharray:3 2}
        .apxd-q button.dq{position:relative;width:36px;height:34px;padding:0;background:none;border:none;display:inline-flex;align-items:center;justify-content:center;font-size:.64rem}
        .apxd-q button.dq .dsh *{fill:var(--c-surface2,#0f172a);stroke:var(--c-border2,#475569)}
        .apxd-q button.dq:hover .dsh *{stroke:var(--c-indigo,#6366f1);stroke-width:1.8}
        .apxd-die.drop{opacity:.35;text-decoration:line-through} .apxd-die.drop .dn{text-decoration:line-through}
        .apxd-die.max{color:#facc15;border-color:#facc15} .apxd-die.min{color:#f87171;border-color:#f87171}
        .apxd-die.omen{background:#3b0764;border-color:#c084fc}
        .apxd-die small{font-size:.57rem;opacity:.7;margin-left:1px}
        .apxd-die.spin{animation:apxdSpin .45s ease-out}
        @keyframes apxdSpin{0%{transform:rotate(-200deg) scale(.4);opacity:.2}70%{transform:rotate(15deg) scale(1.1)}100%{transform:none;opacity:1}}
        @media (prefers-reduced-motion:reduce){.apxd-die.spin{animation:none}}
        .apxd-mod{font-size:.73rem;color:var(--c-text-dimmer,#cbd5e1);font-weight:700}
        .apxd-tot{margin-left:auto;font-size:1.05rem;font-weight:900;min-width:30px;text-align:right}
        .apxd-badges{display:flex;flex-wrap:wrap;gap:.25rem;margin-top:.3rem}
        .apxd-b{font-size:.63rem;font-weight:800;padding:.05rem .35rem;border-radius:.6rem;border:1px solid}
        .apxd-b.crit{color:#fde047;border-color:#facc15} .apxd-b.fum{color:#fca5a5;border-color:#dc2626}
        .apxd-b.adv{color:#6ee7b7;border-color:#059669} .apxd-b.dis{color:#fca5a5;border-color:#dc2626} .apxd-b.info{color:var(--c-text-dimmer,#cbd5e1);border-color:var(--c-border2,#475569)}
        .apxd-acts{display:flex;flex-wrap:wrap;gap:.25rem;margin-top:.35rem}
        .apxd-acts button{font-size:.65rem;font-weight:800;padding:.15rem .4rem;border-radius:.3rem;cursor:pointer;background:none;border:1px solid var(--c-border2,#475569);color:var(--c-text-dimmer,#cbd5e1)}
        .apxd-acts button.omen{border-color:#a855f7;color:#e9d5ff} .apxd-acts button.luck{border-color:#10b981;color:#a7f3d0}
        .apxd-omen{display:flex;align-items:center;gap:.25rem;flex-wrap:wrap;padding:.35rem .6rem;border-bottom:1px solid var(--c-border,#334155);font-size:.69rem;font-weight:800;color:#e9d5ff}
        .apxd-roll-link{text-decoration:underline dotted;text-underline-offset:2px;cursor:pointer;color:inherit;font-weight:inherit}
        .apxd-roll-link:hover{color:var(--c-indigo-lt,#a5b4fc)}
        [data-apx-roll]{cursor:pointer}
        [data-apx-roll]:hover{filter:brightness(1.25)}
        .apxd-ask{position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px}
        .apxd-ask>div{background:var(--c-surface,#1e293b);border:1px solid var(--c-border2,#475569);border-radius:.7rem;padding:1rem 1.1rem;width:min(360px,100%);color:var(--c-text,#fff)}
        .apxd-ask h4{margin:0 0 .3rem;font-size:.9rem;font-weight:800} .apxd-ask p{margin:0 0 .8rem;white-space:pre-line;font-size:.74rem;color:var(--c-text-dimmer,#cbd5e1);line-height:1.4}
        .apxd-ask .row{display:flex;gap:.4rem;justify-content:flex-end;flex-wrap:wrap}
        .apxd-ask button{border:none;border-radius:.4rem;padding:.45rem .8rem;font-size:.74rem;font-weight:800;cursor:pointer;background:var(--c-border,#334155);color:var(--c-text,#fff)}
        .apxd-ask button.pri{background:var(--c-amber,#d97706)} .apxd-ask button.ok{background:var(--c-emerald,#059669)}`;
        document.head.appendChild(st);
    }

    const D20_SVG = `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M16 2 29 9.5v13L16 30 3 22.5v-13z"/><path d="M16 2 9 12h14zM9 12 3 22.5M23 12l6 10.5M9 12l7 11 7-11M16 23v7M3 22.5 16 23l13-.5"/></svg>`;

    function build() {
        if (tray.el) return;
        css();
        let fab = document.createElement('button');
        fab.className = 'apxd-fab';
        fab.title = 'Dice and Notifications';
        fab.innerHTML = D20_SVG;
        fab.onclick = () => toggle();
        let el = document.createElement('div');
        el.className = 'apxd-tray';
        el.innerHTML = `
            <div class="apxd-hdr" id="apxdHdr">${D20_SVG.replace('<svg', '<svg width="18" height="18"')}<b>Dice and Notifications</b>
                <button class="apxd-x" data-clear title="Clear the dice and notifications (cleared entries don't come back)">Clear</button><button class="apxd-x" data-close title="Close">X</button></div>
            <div class="apxd-bar">
                <div class="apxd-seg" title="Applies to the next d20 roll (conditions are added automatically)">
                    <button data-mode="dis">Disadv</button><button data-mode="normal" class="on">Normal</button><button data-mode="adv">Adv</button></div>
                <label data-explode-wrap style="display:none;font-size:.67rem;font-weight:800;align-items:center;gap:.2rem;cursor:pointer" title="High Roller Rank 5: once per Full Rest, declare before rolling damage">
                    <input type="checkbox" data-explode> Dice Explosion</label>
            </div>
            <div class="apxd-omen" data-omen style="display:none"></div>
            <div class="apxd-q">
                ${[4, 6, 8, 10, 12, 20, 100].map(s => `<button data-q="${s}" class="dq s${s}">${shapeSvg(s)}<span class="dn">d${s}</span></button>`).join('')}
                <input data-free placeholder="+3 or 2d6+3" title="A number is added to the dice pool as a modifier. Any other roll (like 2d6+3) is rolled with the pool. Enter rolls.">
            </div>
            <div class="apxd-pool" data-pool></div>
            <div class="apxd-log"><div class="apxd-empty">Click a skill, save, weapon, power or any dice in a stat block to roll, or use the buttons above. Notifications and the combat log show up here too.</div></div>`;
        document.body.appendChild(fab);
        document.body.appendChild(el);
        tray.el = el; tray.fab = fab; tray.log = el.querySelector('.apxd-log');
        el.querySelector('[data-close]').onclick = () => toggle(false);
        el.querySelector('[data-clear]').onclick = () => { cards = []; logCards = {}; tray.clearedAt = Date.now(); try { localStorage.setItem('apx_tray_cleared_' + trayKey(), String(tray.clearedAt)); } catch (e) { } tray.log.innerHTML = '<div class="apxd-empty">Log cleared.</div>'; };
        el.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => setMode(b.dataset.mode));
        // Die buttons add to a pool; Roll rolls the pool (plus the text field) and clears both
        tray.pool = {};
        el.querySelectorAll('[data-q]').forEach(b => {
            b.title = 'Add a d' + b.dataset.q + ' to the pool (right-click to remove one)';
            b.onclick = () => { poolAdd(+b.dataset.q, 1); };
            b.oncontextmenu = e => { e.preventDefault(); poolAdd(+b.dataset.q, -1); };
        });
        let free = el.querySelector('[data-free]');
        free.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); rollPool(); } });
        free.addEventListener('input', renderPool);
        el.querySelector('[data-pool]').addEventListener('click', e => {
            let chip = e.target.closest('[data-chip]');
            if (chip) return poolAdd(+chip.dataset.chip, -1);
            if (e.target.closest('[data-roll]')) return rollPool();
            if (e.target.closest('[data-poolclear]')) { tray.pool = {}; free.value = ''; renderPool(); }
        });
        renderPool();
        el.querySelector('[data-explode]').onchange = e => { tray.explodeNext = e.target.checked; };
        if (window.apxMakeDraggable) window.apxMakeDraggable(el, el.querySelector('#apxdHdr'));
        refreshPerkBar();
    }
    const POOL_SIDES = [4, 6, 8, 10, 12, 20, 100];
    function poolAdd(sides, d) {
        let n = Math.max(0, (tray.pool[sides] || 0) + d);
        if (n) tray.pool[sides] = Math.min(99, n); else delete tray.pool[sides];
        renderPool();
    }
    // Text field: a bare number ("3", "+3", "-2") is a modifier for the pool; anything else is a roll formula
    function freeText() {
        let v = (tray.el?.querySelector('[data-free]')?.value || '').trim();
        if (!v) return { mod: 0, formula: '' };
        if (/^[+-]?\s*\d+$/.test(v)) return { mod: parseInt(v.replace(/\s+/g, ''), 10), formula: '' };
        return { mod: 0, formula: v };
    }
    function poolFormula() {
        let parts = POOL_SIDES.filter(sd => tray.pool[sd]).map(sd => tray.pool[sd] + 'd' + sd);
        let f = freeText();
        if (f.formula) parts.push(f.formula.replace(/^\+/, ''));
        let str = parts.join('+').replace(/\+-/g, '-');
        if (f.mod) str = str ? str + fmtNum(f.mod) : '';
        return str;
    }
    function renderPool() {
        let box = tray.el?.querySelector('[data-pool]'); if (!box) return;
        let chips = POOL_SIDES.filter(sd => tray.pool[sd]).map(sd => `<button class="chip" data-chip="${sd}" title="Remove one d${sd}">${tray.pool[sd]}d${sd}</button>`).join('');
        let f = freeText(), str = poolFormula();
        let extra = f.formula ? `<span class="modtag">+ ${esc(f.formula)}</span>` : (f.mod && chips ? `<span class="modtag">${fmtNum(f.mod)}</span>` : '');
        box.innerHTML = (chips || extra ? chips + extra : '<span class="ph">Click dice above to build a pool.</span>')
            + (chips || f.formula ? '<button class="clr" data-poolclear title="Empty the pool">Clear</button>' : '')
            + `<button class="go" data-roll ${str ? '' : 'disabled'} title="${str ? 'Roll ' + esc(str) : 'Add dice first'}">Roll</button>`;
    }
    function rollPool() {
        let str = poolFormula(); if (!str) return;
        let p = parse(str);
        // A single d20 (plus a modifier) is a check, so Advantage/Disadvantage and crits apply
        if (p.dice.length === 1 && p.dice[0].n === 1 && p.dice[0].s === 20 && p.dice[0].sign === 1) APXDice.check({ label: str, bonus: p.flat });
        else APXDice.formula(str, str);
        tray.pool = {};
        let free = tray.el.querySelector('[data-free]'); if (free) free.value = '';
        renderPool();
    }
    function setMode(m) {
        tray.mode = m;
        tray.el?.querySelectorAll('[data-mode]').forEach(b => { b.className = b.dataset.mode === m ? 'on ' + m : ''; });
    }
    function toggle(force) {
        build();
        tray.open = force === undefined ? !tray.open : !!force;
        tray.el.classList.toggle('open', tray.open);
        if (tray.open) tray.fab.classList.remove('unseen');
        if (tray.open) refreshPerkBar();
    }

    // Omen dice strip + exploding toggle (only when the sheet has those perks)
    function refreshPerkBar() {
        if (!tray.el) return;
        let isSheet = !!(window.state && window.state.perks && document.getElementById('charName'));
        let hr = isSheet ? perk('luc_highroller') : 0;
        let wrap = tray.el.querySelector('[data-explode-wrap]');
        wrap.style.display = hr >= 5 ? 'flex' : 'none';
        let box = tray.el.querySelector('[data-explode]');
        box.disabled = !!S().hrExplodeUsed;
        box.checked = tray.explodeNext && !S().hrExplodeUsed;
        wrap.title = S().hrExplodeUsed ? 'Used — comes back after a Full Rest' : 'High Roller Rank 5: once per Full Rest';
        let om = tray.el.querySelector('[data-omen]');
        let ext = tray.extOmens || [];
        if (!isSheet && ext.length) {
            // GM: Omen dice players have spent, waiting to be applied to a roll (or dismissed)
            om.style.display = 'flex';
            om.innerHTML = `Omen spent: ${ext.map((o, i) => `<span class="apxd-die omen" title="${esc(o.who)}: apply it from a d20 roll's buttons">${o.value}${o.adj ? `<small>${o.adj > 0 ? '+' : '−'}${Math.abs(o.adj)}</small>` : ''}</span><span style="font-size:.62rem;opacity:.85">${esc(o.who)}</span><button data-omendrop="${i}" title="Dismiss (already used)" style="font-size:.62rem;border:none;background:none;color:#e9d5ff;cursor:pointer">✕</button>`).join('')}`;
            shapeDice(om);
            om.querySelectorAll('[data-omendrop]').forEach(b => b.onclick = () => { tray.extOmens.splice(parseInt(b.dataset.omendrop), 1); refreshPerkBar(); refreshAllActions(); });
            return;
        }
        let r = isSheet ? perk('luc_omen') : 0;
        let gifts = isSheet ? (S().giftedOmens || []) : [];
        if (!r && !gifts.length) { om.style.display = 'none'; return; }
        let dice = r ? (S().omenDice || []) : [];
        let adjS = a => a ? `<small>${a > 0 ? '+' : '−'}${Math.abs(a)}</small>` : '';
        om.style.display = 'flex';
        om.innerHTML = `Omen: ${dice.length ? dice.map((v, i) => `<span class="apxd-die omen" data-omenspend="${i}" style="cursor:pointer" title="Pass this Omen die to the GM (for another creature's roll) or to a party member">${v}</span>`).join('') : (r ? '<span style="opacity:.7;font-weight:600">none stored</span>' : '')}
            ${gifts.map(g => `<span class="apxd-die omen" data-omengift="${esc(g.id)}" style="cursor:pointer;border-style:dashed" title="From ${esc(g.from)}. Use it from a d20 roll's buttons, or click to pass it on">${g.value}${adjS(g.adj)}</span>`).join('')}
            ${S().omenRollPending ? `<button data-omenroll style="margin-left:auto;font-size:.67rem;font-weight:800;padding:.1rem .4rem;border-radius:.3rem;border:1px solid #a855f7;background:none;color:#e9d5ff;cursor:pointer">Roll Omen Dice</button>` : ''}`;
        shapeDice(om);
        let b = om.querySelector('[data-omenroll]'); if (b) b.onclick = () => APXDice.rollOmen();
        om.querySelectorAll('[data-omenspend]').forEach(el => el.onclick = () => APXDice.spendOmenOnOther(parseInt(el.dataset.omenspend)));
        om.querySelectorAll('[data-omengift]').forEach(el => el.onclick = () => APXDice.passGiftedOmen(el.dataset.omengift));
    }

    // ── Card rendering ───────────────────────────────────────────
    // Each die has its own outline: d4 triangle, d6 square, d8 triangle (point down, to tell it
    // from the d4), d10 kite, d12 pentagon, d20 hexagon (corner up), d100 circle.
    const DIE_SHAPES = {
        4: '<polygon points="50,6 97,88 3,88"/>',
        6: '<rect x="8" y="8" width="84" height="84" rx="12"/>',
        8: '<polygon points="3,12 97,12 50,94"/>',
        10: '<polygon points="50,3 93,40 50,97 7,40"/>',
        12: '<polygon points="50,3 95,36 78,92 22,92 5,36"/>',
        20: '<polygon points="50,2 92,26 92,74 50,98 8,74 8,26"/>',
        100: '<circle cx="50" cy="50" r="47"/>'
    };
    function shapeSvg(sides) {
        return `<svg class="dsh" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${DIE_SHAPES[sides] || DIE_SHAPES[6]}</svg>`;
    }
    // Give every plain die in `root` its outline (dice are d20s unless marked data-s)
    function shapeDice(root) {
        if (!root) return;
        root.querySelectorAll('.apxd-die:not(.sh)').forEach(el => {
            let s = parseInt(el.dataset.s) || 20;
            if (!DIE_SHAPES[s]) s = 6;
            if (el.style.borderStyle === 'dashed') { el.classList.add('dashed'); el.style.borderStyle = ''; }
            el.classList.add('sh', 's' + s);
            if (el.textContent.trim().length >= 3) el.classList.add('w3');
            el.innerHTML = shapeSvg(s) + `<span class="dn">${el.innerHTML}</span>`;
        });
    }
    function dieHtml(d, extraCls, spin) {
        let cls = 'apxd-die' + (extraCls ? ' ' + extraCls : '') + (spin ? ' spin' : '');
        if (d.v === d.s && d.s > 1 && !extraCls) cls += ' max';
        if (d.v === 1 && !extraCls) cls += ' min';
        let tip = [d.from ? `rerolled a ${d.from}` : '', d.boom ? `exploded: +${d.boom.join(' +')}` : ''].filter(Boolean).join('; ');
        return `<span class="${cls}" data-s="${d.s || 6}" ${tip ? `title="${esc(tip)}"` : ''}>${d.v}${d.boom ? `<small>+${d.boom.join('+')}</small>` : ''}${d.from ? '<small>*</small>' : ''}</span>`;
    }
    function groupsHtml(roll, spin) {
        return roll.groups.map((g, i) => (i || g.sign < 0 ? `<span class="apxd-mod" ${g.crit ? 'title="Critical hit: extra dice"' : ''}>${g.sign < 0 ? '−' : g.crit ? '+crit' : '+'}</span>` : '') +
            g.dice.map(d => dieHtml(d, '', spin)).join('')).join('');
    }

    // A combat-log message can ask YOU for a roll (Wound Threshold CON save, Bleed Out CON (Survive)):
    // it gets a button that rolls it. The page decides whether the ask is for this player (apxLogAsk).
    tray.askDone = tray.askDone || {};
    function askIsMine(e) { return !!(e && e.ask && typeof window.apxLogAsk === 'function' && typeof window.apxRollFromAsk === 'function' && window.apxLogAsk(e.ask)); }
    function askBtnHtml(e) {
        if (!askIsMine(e)) return '';
        let done = !!tray.askDone[e.id];
        // Saves are settled in the order they were asked for (the Wound Threshold save first,
        // then a hit's own saves, then Bleed Out), so a later button waits for the earlier ones
        let waitWt = !done && cards.some(x => x.log && x.log.id !== e.id && x.log.ask && askIsMine(x.log) && !tray.askDone[x.log.id] && (x.log.t || 0) < (e.t || 0));
        let label = done ? 'Rolled' : waitWt ? 'Roll the earlier save first' : e.ask.label ? e.ask.label
            : e.ask.roll === 'save' ? `Roll ${e.ask.attr || 'CON'} save${e.ask.dc ? ' (DC ' + e.ask.dc + ')' : ''}` : 'Roll CON (Survive)';
        return `<div style="margin-top:.3rem"><button data-logask ${done || waitWt ? 'disabled' : ''} style="font-size:.66rem;font-weight:800;padding:.18rem .5rem;border-radius:.3rem;cursor:${done || waitWt ? 'default' : 'pointer'};border:1px solid ${done ? 'var(--c-border2,#475569)' : '#f59e0b'};background:${done || waitWt ? 'none' : '#b45309'};color:${done ? 'var(--c-text-muted,#94a3b8)' : '#fff'};opacity:${waitWt ? '.6' : '1'}">${label}</button></div>`;
    }
    function refreshAskCards() { cards.forEach(x => { if (x.log && x.log.ask) renderCard(x); }); }

    function renderCard(c, spin) {
        let el = c.el || (c.el = document.createElement('div'));
        if (c.log) {
            let d = new Date(c.log.t || Date.now());
            let hh = d.getHours() % 12 || 12, mm = String(d.getMinutes()).padStart(2, '0');
            el.className = 'apxd-card log k-' + (c.log.kind || 'info');
            el.innerHTML = `<span class="lt">${hh}:${mm}</span>${c.log.gmOnly ? '<span class="lg" title="Only you (the GM) see this">GM</span>' : ''}${esc(c.log.text)}${askBtnHtml(c.log)}`;
            let ab = el.querySelector('[data-logask]');
            if (ab) ab.onclick = () => {
                if (ab.disabled) return;
                tray.askDone[c.log.id] = true;
                try { window.apxRollFromAsk(c.log.ask); } catch (e) { console.warn('Roll from message:', e); }
                refreshAskCards();
            };
            return;
        }
        let crit = c.parts.some(p => p.crit), fum = c.parts.some(p => p.fumble);
        el.className = 'apxd-card' + (crit ? ' crit' : fum ? ' fumble' : '');
        let partsHtml = c.parts.map((p, pi) => {
            if (p.kind === 'd20') {
                let dice = p.r.rolls.map((v, i) => {
                    let cls = 'd20' + (p.r.rolls.length > 1 && i !== p.r.kept ? ' drop' : '') + (p.omenAt === i ? ' omen' : '');
                    let d = { v, s: 20 };
                    let c2 = cls + (i === p.r.kept && v === 20 ? ' max' : i === p.r.kept && v === 1 ? ' min' : '');
                    return dieHtml(d, c2, spin && p.omenAt === undefined);
                }).join('');
                return `<div class="apxd-part"><span class="apxd-plabel">${esc(p.title)}</span>${dice}${p.bonus ? `<span class="apxd-mod">${fmtNum(p.bonus)}</span>` : ''}${p.omenAdj ? `<span class="apxd-mod" title="Omen: LUC mod">${fmtNum(p.omenAdj)}</span>` : ''}<span class="apxd-tot">${p.total}</span></div>`;
            }
            if (p.kind === 'dmg') {
                if (p.none) return `<div class="apxd-part"><span class="apxd-plabel">${esc(p.title)}</span><span class="apxd-mod">— (natural 1)</span><span class="apxd-tot">-</span></div>`;
                let mods = (p.roll.flat ? `<span class="apxd-mod">${fmtNum(p.roll.flat)}</span>` : '') + (p.gamble ? `<span class="apxd-mod" title="High Roller Gamble: +5 on a hit (+10 from Rank 4)">+${p.gamble}</span>` : '');
                let critTxt = p.crit ? `<span class="apxd-mod" title="Critical hit: ×${p.mult} dice">(×${p.mult} dice)</span>` : '';
                return `<div class="apxd-part"><span class="apxd-plabel">${esc(p.title)}</span>${groupsHtml(p.roll, spin)}${mods}${critTxt}<span class="apxd-tot">${p.total}</span></div>`;
            }
            if (p.kind === 'best') {
                return `<div class="apxd-part"><span class="apxd-plabel">${esc(p.title)}</span>${p.pairs.map(pr => pr.map((v, i) => dieHtml({ v, s: p.s }, i === (pr[0] >= pr[1] ? 1 : 0) && pr.length > 1 ? 'drop' : '', spin)).join('')).join('<span class="apxd-mod">,</span>')}${p.flat ? `<span class="apxd-mod">${fmtNum(p.flat)}</span>` : ''}<span class="apxd-tot">${p.total}</span></div>`;
            }
            if (p.kind === 'text') return `<div class="apxd-part"><span class="apxd-mod">${p.html}</span></div>`;
            return '';
        }).join('');
        let badges = (c.badges || []).concat(crit ? [['crit', 'CRITICAL!']] : []).concat(fum ? [['fum', 'Natural 1']] : []);
        let acts = (c.actions || []).filter(a => !a.hidden);
        el.innerHTML = `<div class="apxd-title">${esc(c.label)}${c.who ? `<span>${esc(c.who)}</span>` : ''}</div>${partsHtml}
            ${badges.length ? `<div class="apxd-badges">${badges.map(b => `<span class="apxd-b ${b[0]}" ${b[2] ? `title="${esc(b[2])}"` : ''}>${esc(b[1])}</span>`).join('')}</div>` : ''}
            ${acts.length ? `<div class="apxd-acts">${acts.map((a, i) => `<button class="${a.cls || ''}" data-act="${i}" title="${esc(a.title || '')}">${esc(a.label)}</button>`).join('')}</div>` : ''}`;
        el.querySelectorAll('[data-act]').forEach(b => b.onclick = () => { let a = acts[+b.dataset.act]; if (a) a.run(); });
        shapeDice(el);
    }

    function addCard(c) {
        build();
        if (!tray.open) toggle(true);
        let empty = tray.log.querySelector('.apxd-empty'); if (empty) empty.remove();
        cards.unshift(c);
        renderCard(c, true);
        tray.log.insertBefore(c.el, tray.log.firstChild);
        while (cards.length > 40) { let old = cards.pop(); old.el?.remove(); }
        tray.log.scrollTop = 0;
        return c;
    }

    // Recompute a d20 part after Omen replacement / Luck reroll
    function settleD20(p) {
        let nat = p.r.rolls[p.r.kept];
        p.nat = nat;
        p.total = nat + (p.bonus || 0) + (p.omenAdj || 0);
        p.crit = p.canCrit !== false && nat === 20;
        p.fumble = nat === 1;
    }

    // Omen + High Roller buttons for any card with a d20 part
    function d20Actions(c, p, onChange) {
        let acts = [];
        // Omen dice another player spent on "someone else's roll": the GM applies them here
        if (p.omenAt === undefined) (tray.extOmens || []).forEach(o => {
            let adjTxt = o.adj ? (o.adj > 0 ? '+' : '−') + Math.abs(o.adj) : '';
            acts.push({ label: `${o.who}'s Omen ${o.value}${adjTxt}`, cls: 'omen', title: `Replace this d20 with the Omen die ${o.who} spent (${o.value}${adjTxt})`, run: () => {
                let i = (tray.extOmens || []).indexOf(o); if (i < 0) { renderCard(c); return; }
                tray.extOmens.splice(i, 1);
                let before = p.total;
                p.r.rolls.push(o.value); p.r.kept = p.r.rolls.length - 1; p.omenAt = p.r.kept; p.omenAdj = o.adj || 0;
                settleD20(p); onChange(); refreshPerkBar(); refreshAllActions();
                if (typeof window.gmLog === 'function') window.gmLog({ text: `${o.who}'s Omen die turns ${c.who ? c.who + '\'s' : 'a'} roll into ${/^(8|11$|18$)/.test(String(p.total)) ? 'an' : 'a'} ${p.total}.`, gmText: `${o.who}'s Omen die (${o.value}${adjTxt}) replaces ${c.who ? c.who + '\'s' : 'a'} d20 on ${c.label || 'a roll'}: ${before} → ${p.total}.`, kind: 'info', force: true });
            } });
        });
        // Your companion's rolls don't use your perks, but your Omen dice work on them
        let omenOnly = !c.perks && c.omenOk;
        if (!c.perks && !omenOnly) return acts;
        // Omen dice other players passed to you: use them like your own
        if (p.omenAt === undefined) (S().giftedOmens || []).forEach(g => {
            let adjTxt = g.adj ? (g.adj > 0 ? '+' : '−') + Math.abs(g.adj) : '';
            acts.push({ label: `${g.from}'s Omen ${g.value}${adjTxt}`, cls: 'omen', title: `Replace this d20 with the Omen die ${g.from} passed you`, run: () => {
                let list = (S().giftedOmens || []).slice(), i = list.findIndex(x => x.id === g.id);
                if (i < 0) { renderCard(c); return; }
                list.splice(i, 1); S().giftedOmens = list;
                p.r.rolls.push(g.value); p.r.kept = p.r.rolls.length - 1; p.omenAt = p.r.kept; p.omenAdj = g.adj || 0;
                settleD20(p); onChange(); save(); refreshPerkBar(); refreshAllActions();
            } });
        });
        let r = perk('luc_omen');
        let stored = S().omenDice || [];
        if (r && stored.length && p.omenAt === undefined) {
            stored.forEach((v) => {
                let use = (adj) => {
                    // Look the die up NOW — another card may have used it already
                    let st = S(), cur = (st.omenDice || []).slice(), at = cur.indexOf(v);
                    if (at < 0) { renderCard(c); return; }
                    cur.splice(at, 1); st.omenDice = cur;
                    p.r.rolls.push(v); p.r.kept = p.r.rolls.length - 1; p.omenAt = p.r.kept; p.omenAdj = adj || 0;
                    settleD20(p); onChange(); save(); refreshPerkBar(); refreshAllActions();
                };
                acts.push({ label: `Use Omen ${v}`, cls: 'omen', title: 'Replace this d20 with a stored Omen die', run: () => use(0) });
                if (r >= 2) {
                    let m = lucMod();
                    if (m) {
                        acts.push({ label: `Omen ${v}+${Math.abs(m)}`, cls: 'omen', title: 'Omen Rank 2: add your LUC mod', run: () => use(Math.abs(m)) });
                        acts.push({ label: `Omen ${v}−${Math.abs(m)}`, cls: 'omen', title: 'Omen Rank 2: subtract your LUC mod', run: () => use(-Math.abs(m)) });
                    }
                }
            });
        }
        if (omenOnly) return acts;   // (banking and Luck rerolls are for your own rolls)
        if (r >= 3 && (p.nat === 20 || p.nat === 1) && !p.banked && p.omenAt === undefined && stored.length) {
            // Banking swaps: the natural 1 or 20 goes into your Omen dice, and the held die it
            // replaces becomes this roll (from Rank 2 you may add or subtract your LUC modifier)
            acts.push({ label: `Bank ${p.nat} as Omen`, cls: 'omen', title: 'Omen Rank 3: store this natural roll as an Omen die; one of your held dice takes its place as the roll', run: async () => {
                let cur = (S().omenDice || []).slice(); if (!cur.length) return;
                let m = Math.abs(lucMod());
                let choices = [];
                cur.forEach((v, i) => {
                    choices.push(['i' + i + ':0', `Roll becomes ${v}`, 'pri']);
                    if (r >= 2 && m) { choices.push(['i' + i + ':+', `${v} + ${m}`, 'pri']); choices.push(['i' + i + ':-', `${v} − ${m}`, 'pri']); }
                });
                let ans = await ask(`Bank the ${p.nat}`, `The ${p.nat} goes into your Omen dice, and the die it replaces becomes this roll${r >= 2 && m ? ' (add or subtract your LUC modifier if you like)' : ''}. Which one?`, choices);
                if (!ans || p.banked || p.omenAt !== undefined) return;
                let [iPart, sign] = ans.split(':'), i = parseInt(iPart.slice(1));
                let now = (S().omenDice || []).slice(), v = cur[i];
                let at = now[i] === v ? i : now.indexOf(v); if (at < 0) { renderCard(c); return; }
                let adj = sign === '+' ? m : sign === '-' ? -m : 0;
                now[at] = p.nat; S().omenDice = now;
                p.banked = p.nat;
                p.r.rolls.push(v); p.r.kept = p.r.rolls.length - 1; p.omenAt = p.r.kept; p.omenAdj = adj;
                settleD20(p);
                if (c.badges) c.badges.push(['info', `Banked the ${p.banked}; the roll is now the Omen ${v}${adj ? (adj > 0 ? '+' : '−') + Math.abs(adj) : ''}`]);
                onChange(); save(); refreshPerkBar(); refreshAllActions();
            } });
        }
        if (!p.luckUsed && window.state && document.getElementById('luckPtsInput')) {
            let pts = S().luckPts || 0;
            let r3 = perk('luc_highroller') >= 3;
            let orig = p.origMode || 'normal';
            let modes = c.gamble ? ['dis'] : r3 ? ['adv', 'dis'] : [orig];
            modes.forEach(m => acts.push({
                label: c.gamble ? 'Luck reroll (Gamble: Disadv)' : r3 ? `Luck reroll (${m === 'adv' ? 'Adv' : 'Disadv'})` : 'Luck reroll',
                cls: 'luck',
                title: `Spend 1 Luck Point to reroll this d20 (${pts} left)` + (r3 && !c.gamble ? '. High Roller Rank 3: roll it with Advantage or Disadvantage' : c.gamble ? '. A Gamble keeps its Disadvantage' : ''),
                hidden: pts <= 0,
                run: () => {
                    let st = S(); if ((st.luckPts || 0) <= 0) return;
                    st.luckPts -= 1; p.luckUsed = true;
                    let nr = d20(m);
                    p.r = nr; p.omenAt = undefined; p.omenAdj = 0; p.badgeMode = m;
                    settleD20(p); onChange(true); save();
                    let li = document.getElementById('luckPtsInput'); if (li) li.value = st.luckPts;
                }
            }));
        }
        return acts;
    }
    // Other cards' Omen buttons must reflect the dice still stored
    function refreshAllActions() { cards.forEach(k => { if (k._redo) k._redo(); }); }
    function save() {
        if (typeof window.scheduleAutoSave === 'function') { try { window.scheduleAutoSave(); } catch (e) { } }
        if (typeof window.recalculateMath === 'function' && window.state && document.getElementById('charName')) {
            try { window.recalculateMath(); } catch (e) { }
        }
    }

    function modeBadges(mode, advSources, disSources, forced) {
        let b = [];
        if (mode === 'adv') b.push(['adv', 'Advantage', (advSources || []).join(', ')]);
        if (mode === 'dis') b.push(['dis', forced ? 'Disadvantage (Gamble)' : 'Disadvantage', (disSources || []).join(', ')]);
        return b;
    }

    // ── Public actions ───────────────────────────────────────────
    const APXDice = {
        CRIT_MODE, parse, rnd,

        check(o) {
            o = o || {};
            let list = [tray.mode];
            if ((o.advSources || []).length || o.adv === 'adv') list.push('adv');
            if ((o.disSources || []).length || o.adv === 'dis') list.push('dis');
            let mode = combineMode(list);
            let r = d20(mode);
            // kind 'attack': a lone attack roll (a power attack, or a weapon attack for a martial power) that can crit
            let isAtk = o.kind === 'attack';
            let p = { kind: 'd20', title: o.kind === 'save' ? 'Save' : isAtk ? 'Attack' : 'd20', r, bonus: o.bonus || 0, canCrit: isAtk, origMode: mode };
            settleD20(p);
            let c = { label: o.label || 'Check', who: o.who, parts: [p], perks: o.perks !== false && !!(window.state?.perks), omenOk: !!o.omen && !!(window.state?.perks), badges: modeBadges(mode, o.advSources, o.disSources) };
            if (o.autoFail) c.badges.push(['fum', 'Auto-fail', o.autoFail]);
            if (o.note) c.badges.push(['info', o.note]);
            c.id = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
            let emit = () => {
                if (typeof window.apxOnRollEvent !== 'function' || !c.perks || isAtk) return;
                try {
                    window.apxOnRollEvent({ id: c.id, kind: o.kind === 'save' ? 'save' : 'check', attr: o.attr || '', skill: o.skill || '', label: c.label, who: o.who || '',
                        nat: p.nat, total: p.total, bonus: p.bonus || 0, mode: p.badgeMode || mode, luck: !!p.luckUsed, omen: p.omenAt !== undefined, autoFail: !!o.autoFail,
                        purpose: o.purpose || '', extra: c.resultExtra || null });
                } catch (e) { }
            };
            // o.onResult(result) → optional text shown on the card (e.g. what a Loot check found);
            // called again whenever a Luck reroll or Omen changes the roll
            let lastSig = null;
            let result = () => {
                if (typeof o.onResult !== 'function') return;
                let sig = p.nat + '|' + p.total;
                if (sig === lastSig) return;
                lastSig = sig;
                try {
                    let res = o.onResult({ id: c.id, nat: p.nat, total: p.total, autoFail: !!o.autoFail, rerolled: !!p.luckUsed || p.omenAt !== undefined });
                    if (res && typeof res === 'object') { c.resultNote = res.text || null; c.resultExtra = res.extra || null; }
                    else c.resultNote = res || null;
                } catch (e) { console.warn('Roll result:', e); }
            };
            let noteBadge = () => c.resultNote ? [['info', c.resultNote]] : [];
            let redo = () => { result(); c.badges = modeBadges(p.badgeMode || mode, o.advSources, o.disSources).concat(o.autoFail ? [['fum', 'Auto-fail', o.autoFail]] : [], o.note ? [['info', o.note]] : [], noteBadge()); c.actions = d20Actions(c, p, redo); renderCard(c); emit(); };
            c._redo = redo;
            result(); c.badges = c.badges.concat(noteBadge());
            c.actions = d20Actions(c, p, redo);
            setMode('normal');
            let out = addCard(c);
            emit();
            return out;
        },

        async attack(o) {
            o = o || {};
            let usePerks = o.perks !== false && !!(window.state?.perks);
            let hr = usePerks ? perk('luc_highroller') : 0;
            let gamble = false;
            if (hr >= 1 && o.gambleAllowed !== false) {
                let ans = await ask('High Roller: Gamble?', `Gamble: this attack has Disadvantage that no Advantage can cancel, but deals +${hr >= 4 ? 10 : 5} damage if it hits.` + (hr >= 4 ? ' Landing it also gives you 1 AP.' : ''),
                    [['normal', 'Normal attack', 'ok'], ['gamble', 'Gamble', 'pri']]);
                if (!ans) return;
                gamble = ans === 'gamble';
            }
            // AP for the attack: the page decides (player sheet: spends the pool, asks about Aim
            // and AP perks; GM: takes it from the NPC whose turn it is). Returning false cancels.
            let apNote = null;
            if (typeof window.apxBeforeAttack === 'function') {
                let pre;
                try { pre = await window.apxBeforeAttack(o); } catch (e) { console.warn('AP hook:', e); }
                if (pre === false) return;
                if (pre && pre.note) apNote = [pre.warn ? 'fum' : 'info', pre.note, pre.tip || ''];
                if (pre && pre.bonus) o = Object.assign({}, o, { bonus: (o.bonus || 0) + pre.bonus });
                if (pre && pre.label) o = Object.assign({}, o, { label: pre.label });
            }
            let list = [tray.mode];
            if ((o.advSources || []).length || o.adv === 'adv') list.push('adv');
            if ((o.disSources || []).length || o.adv === 'dis') list.push('dis');
            let mode = combineMode(list, gamble ? 'dis' : null);
            let r = d20(mode);
            let atk = { kind: 'd20', title: 'Attack', r, bonus: o.bonus || 0, origMode: mode };
            settleD20(atk);
            let explode = usePerks && tray.explodeNext && hr >= 5 && !S().hrExplodeUsed;
            if (explode) { S().hrExplodeUsed = true; tray.explodeNext = false; refreshPerkBar(); }
            let critMult = o.critMult || 2;
            let dp = damagePerks(o, usePerks);
            // The crit dice are rolled now and only shown if the attack turns out to crit
            // (it can become a crit later, e.g. by using a stored Omen 20).
            let dm = makeDamage(o.dice, { reroll12: usePerks && hr >= 2, explode, critMult, keepBest: dp.keepBest, instig: dp.instig });
            let flat = (dm.parsed.flat || 0) + (o.dmgMod || 0);
            let gambleBonus = gamble ? (hr >= 4 ? 10 : 5) : 0;   // High Roller: +5 on a Gamble that hits (+10 from Rank 4)
            let dst = { crit: false, inst: false, maxed: false };
            let dmg = { kind: 'dmg', title: 'Damage', gamble: gambleBonus, mult: critMult };
            let c = { label: o.label || 'Attack', who: o.who, parts: [atk, dmg].concat(o.flavor ? [{ kind: 'text', html: '<i style="font-weight:500;line-height:1.35">' + esc(o.flavor) + '</i>' }] : []), perks: usePerks, omenOk: !!o.omen && !!(window.state?.perks), gamble };
            c.id = 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
            // The page hears about every attack (and every change to it): the GM Tools use it to know
            // who just attacked with what, so a hit applies the weapon's properties to the right target.
            let tell = () => { if (typeof window.apxOnAttackRoll === 'function') { try { window.apxOnAttackRoll(o, { id: c.id, nat: atk.nat, total: atk.total, crit: !!atk.crit, fumble: !!atk.fumble, dmg: dmg.total, bonus: atk.bonus || 0 }); } catch (e) { console.warn('Attack hook:', e); } } };
            let settleDmg = () => {
                dmg.crit = atk.crit; dmg.none = atk.fumble;
                dst.crit = atk.crit;
                let res = dm.settle(dst);
                dmg.roll = { groups: res.roll.groups, flat, diceTotal: res.roll.diceTotal };
                dmg.mult = res.roll.mult;
                let total = dmg.roll.diceTotal + dmg.roll.flat;
                if (gamble) total += gambleBonus;
                dmg.total = Math.max(0, total);
                c.badges = modeBadges(atk.badgeMode || mode, o.advSources, o.disSources, gamble);
                if (o.dmgType) c.badges.push(['info', o.dmgType]);
                if (gamble && !atk.fumble) c.badges.push(['info', `Gamble: +${gambleBonus} is included, only if it hits` + (hr >= 4 ? '. Hit = +1 AP' : '')]);
                if (res.other) c.badges.push(['info', `${dp.keepSrc}: rolled damage twice, kept ${res.roll.diceTotal + flat} (other ${res.other.diceTotal + flat})`, 'Rank 2: roll damage twice and keep the highest total']);
                if (dm.rerolled()) c.badges.push(['info', 'High Roller: rerolled 1s & 2s (*)']);
                if (explode) c.badges.push(['info', 'Dice Explosion: max rolls rolled again and added']);
                if (dst.inst) c.badges.push(['info', 'Instigator: +1 damage die' + (atk.crit ? ', crit ×' + dmg.mult : '')]);
                if (dst.confirm) c.badges.push([dst.maxed ? 'crit' : 'info', `${dp.confirmSrc} R5 second attack roll: ${dst.confirm.total} (d20 ${dst.confirm.nat})` + (dst.maxed ? ' · max critical damage' : '')]);
                if (apNote) c.badges.push(apNote);
                if (o.useNote) c.badges.push([o.useWarn ? 'fum' : 'info', o.useNote]);
            };
            let extraActs = () => {
                let acts = [];
                if (dp.instig) acts.push({ label: dst.inst ? 'Instigator: on' : 'Target Frightened/Provoked?', cls: dst.inst ? 'luck' : '', title: 'Instigator Rank 3: a Frightened or Provoked target takes an extra damage die, and your crit multiplier is +1', run: () => { dst.inst = !dst.inst; redo(); } });
                if (dp.maxConfirm && atk.crit && !dst.confirm) acts.push({ label: `${dp.confirmSrc} R5: roll again`, cls: 'luck', title: 'Rank 5: on a critical hit, roll the attack again; if it hits, deal maximum critical damage', run: () => {
                    let r2 = d20(mode === 'dis' || gamble ? 'dis' : mode); let nat = r2.rolls[r2.kept];
                    dst.confirm = { nat, total: nat + (atk.bonus || 0) }; redo();
                } });
                if (dst.confirm && !dst.maxed) acts.push({ label: 'It hit: max damage', cls: 'luck', title: 'The second attack roll hit: deal maximum critical damage', run: () => { dst.maxed = true; redo(); } });
                if (gamble && hr >= 4 && !atk.fumble && !dst.apGained && typeof window.apxSetApValue === 'function') acts.push({ label: 'Gamble hit: +1 AP', cls: 'luck', title: 'High Roller Rank 4: landing a Gamble gives you 1 AP', run: () => {
                    dst.apGained = true; window.apxSetApValue((window.apxApCurrent ? window.apxApCurrent() : 0) + 1); redo();
                } });
                return acts;
            };
            let redo = (full) => { settleDmg(); c.actions = d20Actions(c, atk, redo).concat(extraActs()); renderCard(c); tell(); };
            c._redo = redo;
            settleDmg();
            c.actions = d20Actions(c, atk, redo).concat(extraActs());
            setMode('normal');
            let out = addCard(c);
            tell();
            return out;
        },

        damage(o) {
            o = o || {};
            let usePerks = o.perks !== false && !!(window.state?.perks);
            let hr = usePerks ? perk('luc_highroller') : 0;
            let explode = usePerks && !o.heal && tray.explodeNext && hr >= 5 && !S().hrExplodeUsed;
            if (explode) { S().hrExplodeUsed = true; tray.explodeNext = false; refreshPerkBar(); }
            let dp = o.heal ? {} : damagePerks(o, usePerks);
            let mult = (o.mult && o.mult > 1) ? o.mult : 2;
            let dm = makeDamage(o.formula, { reroll12: !o.heal && usePerks && hr >= 2, explode, critMult: mult, keepBest: dp.keepBest, instig: dp.instig });
            let dst = { crit: !!(o.mult && o.mult > 1), inst: false, maxed: false };
            let p = { kind: 'dmg', title: o.heal ? 'Heal' : 'Damage' };
            let c = { label: o.label || 'Damage', who: o.who, parts: [p].concat(o.flavor ? [{ kind: 'text', html: '<i style="font-weight:500;line-height:1.35">' + esc(o.flavor) + '</i>' }] : []), badges: [] };
            let settle = () => {
                let res = dm.settle(dst);
                p.roll = { groups: res.roll.groups, flat: dm.parsed.flat, diceTotal: res.roll.diceTotal };
                p.total = Math.max(0, res.roll.diceTotal + dm.parsed.flat); p.crit = dst.crit; p.mult = res.roll.mult;
                c.badges = [];
                if (o.dmgType) c.badges.push(['info', o.dmgType]);
                if (res.other) c.badges.push(['info', `${dp.keepSrc}: rolled damage twice, kept ${p.total} (other ${res.other.diceTotal + dm.parsed.flat})`]);
                if (dm.rerolled()) c.badges.push(['info', 'High Roller: rerolled 1s & 2s (*)']);
                if (explode) c.badges.push(['info', 'Dice Explosion: max rolls rolled again and added']);
                if (dst.inst) c.badges.push(['info', 'Instigator: +1 damage die']);
                if (o.apNote) c.badges.push([o.apWarn ? 'fum' : 'info', o.apNote]);
                if (o.note) c.badges.push(['info', o.note]);
                c.actions = dp.instig ? [{ label: dst.inst ? 'Instigator: on' : 'Target Frightened/Provoked?', cls: dst.inst ? 'luck' : '', title: 'Instigator Rank 3: a Frightened or Provoked target takes an extra damage die', run: () => { dst.inst = !dst.inst; settle(); renderCard(c); } }] : [];
            };
            settle();
            return addCard(c);
        },

        // A card with just text (a power with no roll: its description, and what it cost)
        info(o) {
            o = o || {};
            return addCard({ label: o.label || 'Note', who: o.who, parts: [{ kind: 'text', html: '<span style="font-weight:500;line-height:1.35">' + esc(o.text || '') + '</span>' }], badges: (o.badges || []).map(b => Array.isArray(b) ? b : ['info', b]) });
        },

        formula(label, formula, who) {
            let p = parse(formula);
            if (!p.dice.length) return null;
            if (p.dice.length === 1 && p.dice[0].s === 20 && p.dice[0].n === 1) return APXDice.check({ label, who, bonus: p.flat });
            let roll = rollFormula(formula, {});
            let c = { label: label || formula, who, parts: [{ kind: 'dmg', title: 'Roll', roll, total: roll.total }], badges: [['info', String(formula).trim()]] };
            return addCard(c);
        },

        // Rest dice: count dice of dieStep (+flat each). Well Rested: roll each twice, keep the highest.
        rest(o) {
            o = o || {};
            let s = parseInt(String(o.dieStep || 'd6').replace(/\D/g, ''), 10) || 6;
            let pairs = [], total = 0;
            for (let i = 0; i < (o.count || 1); i++) {
                let a = rnd(s);
                if (o.wellRested) { let b = rnd(s); pairs.push([a, b]); total += Math.max(a, b); }
                else { pairs.push([a]); total += a; }
            }
            total += (o.flat || 0) * (o.count || 1);
            let c = { label: o.label || 'Rest Dice', who: o.who, parts: [{ kind: 'best', title: 'Rest', pairs, s, flat: (o.flat || 0) * (o.count || 1), total }], badges: o.wellRested ? [['info', 'Well Rested: rolled twice, kept highest']] : [] };
            if (o.note) c.badges.push(['info', o.note]);
            addCard(c);
            return total;
        },

        // Omen: roll the dice for this rest (Rank 5 gets 1, 10 and 20 without rolling)
        // keep: Omen dice to hold on to; only the empty slots are filled
        rollOmen(keep) {
            let r = perk('luc_omen'); if (!r) return;
            keep = Array.isArray(keep) ? keep.slice() : [];
            let need = Math.max(0, omenPerRest(r) - keep.length);
            let fresh;
            if (r >= 5) {
                // Rank 5: no roll, the missing ones of 1, 10 and 20
                let pool = [1, 10, 20];
                keep.forEach(v => { let i = pool.indexOf(v); if (i >= 0) pool.splice(i, 1); });
                fresh = pool.slice(0, need);
                while (fresh.length < need) fresh.push([1, 10, 20][fresh.length % 3]);
            } else fresh = Array.from({ length: need }, () => rnd(20));
            let vals = keep.concat(fresh);
            let st = S(); st.omenDice = vals; st.omenRollPending = false;
            setTimeout(refreshAllActions, 0);
            addCard({ label: 'Omen Dice', parts: [{ kind: 'text', html: keep.map(v => `<span class="apxd-die omen" style="opacity:.55" title="Kept from before">${v}</span>`).join(' ') + (keep.length && fresh.length ? ' ' : '') + fresh.map(v => `<span class="apxd-die omen">${v}</span>`).join(' ') }],
                badges: [['info', (r >= 5 ? 'Rank 5: no roll needed' : fresh.length ? `${fresh.length} rolled` : 'nothing rolled') + (keep.length ? `, ${keep.length} kept` : '') + ` · ${vals.length} stored until used`]] });
            refreshPerkBar(); save();
        },

        // Spend one of your Omen dice on another creature's roll (a foe's crit, an ally's save…).
        // The GM applies it to that roll from their dice tray.
        // Pass one of your Omen dice on: to the GM (for any creature's roll: a foe's crit, an
        // NPC's save) or to a party member, who can then use it on their own rolls.
        async spendOmenOnOther(idx) {
            let st = S(), cur = (st.omenDice || []).slice(), v = cur[idx];
            if (v === undefined) return;
            let r = perk('luc_omen'), m = Math.abs(lucMod());
            let choices = [['s0', `Use the ${v}`, 'pri']];
            if (r >= 2 && m) { choices.push(['s+', `${v} + ${m} (LUC)`, 'pri']); choices.push(['s-', `${v} − ${m} (LUC)`, 'pri']); }
            let ans = await ask(`Omen die: ${v}`, `Pass this die on? Whoever receives it replaces a d20 with it${r >= 2 && m ? '. Add or subtract your LUC modifier now if you like' : ''}. (To use it on your own roll, use the roll's buttons instead.)`, choices);
            if (!ans) return;
            let adj = ans === 's+' ? m : ans === 's-' ? -m : 0;
            let to = await pickOmenTarget(v, adj);
            if (!to) return;
            let now = (S().omenDice || []).slice(), at = now[idx] === v ? idx : now.indexOf(v);
            if (at < 0) return;
            now.splice(at, 1); S().omenDice = now;
            refreshPerkBar(); refreshAllActions(); save();
            sendOmen(to, v, adj);
        },
        // A die someone passed you can be passed on again (its LUC adjustment stays as it is)
        async passGiftedOmen(id) {
            let g = (S().giftedOmens || []).find(x => x.id === id); if (!g) return;
            let to = await pickOmenTarget(g.value, g.adj || 0, `From ${g.from}. Use it from any d20 roll's buttons, or pass it on:`);
            if (!to) return;
            let list = (S().giftedOmens || []).filter(x => x.id !== id); S().giftedOmens = list;
            refreshPerkBar(); refreshAllActions(); save();
            sendOmen(to, g.value, g.adj || 0);
        },
        // GM: a player spent an Omen die; it shows on d20 rolls until applied or dismissed
        offerOmen(o) {
            if (!o || !o.id) return;
            tray.extOmens = tray.extOmens || [];
            if (tray.extOmens.some(x => x.id === o.id)) return;
            tray.extOmens.push({ id: o.id, value: o.value, adj: o.adj || 0, who: o.who || 'A player' });
            refreshPerkBar(); refreshAllActions();
        },

        // After a Full Rest: Omen dice are re-rolled, High Roller's exploding dice come back
        onFullRest(opts) {
            let st = S();
            st.hrExplodeUsed = false;
            if (perk('luc_omen')) {
                // opts.reroll: which held Omen dice to roll again (by position); the rest are kept
                let cur = (st.omenDice || []).slice();
                let keep = opts && Array.isArray(opts.reroll) ? cur.filter((v, i) => !opts.reroll.includes(i))
                    : (opts && opts.keepOmen) ? cur : [];
                st.omenRollPending = true; APXDice.rollOmen(keep);
            }
            refreshPerkBar();
        },

        open() { toggle(true); },
        refresh: refreshPerkBar,

        // Wrap every "NdS(+M)" in text under `root` so it can be clicked to roll.
        linkify(root, labelFn) {
            if (!root) return;
            let walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
                acceptNode(n) {
                    let p = n.parentElement;
                    if (!p || p.closest('input,textarea,select,button,script,style,.apxd-roll-link,[data-apx-roll],[data-no-roll]')) return NodeFilter.FILTER_REJECT;
                    return /\d*d(4|6|8|10|12|20|100)\b/i.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                }
            });
            let nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
            nodes.forEach(n => {
                let frag = document.createDocumentFragment(), txt = n.nodeValue, last = 0;
                let re = /\b(\d*d(?:4|6|8|10|12|20|100)(?:\s*[+\-]\s*\d*d(?:4|6|8|10|12|20|100)|\s*[+\-]\s*\d+(?![\dd]))*)\b/gi, m;
                while ((m = re.exec(txt))) {
                    if (m.index > last) frag.appendChild(document.createTextNode(txt.slice(last, m.index)));
                    let sp = document.createElement('span');
                    sp.className = 'apxd-roll-link';
                    sp.textContent = m[0];
                    sp.dataset.formula = m[0];
                    sp.title = 'Roll ' + m[0];
                    let label = labelFn ? labelFn(n.parentElement) : null;
                    if (label) sp.dataset.label = label;
                    frag.appendChild(sp);
                    last = m.index + m[0].length;
                }
                if (last === 0) return;
                if (last < txt.length) frag.appendChild(document.createTextNode(txt.slice(last)));
                n.parentNode.replaceChild(frag, n);
            });
        }
    };

    // Small themed chooser. choices: [[value, label, cls]]
    function ask(title, text, choices) {
        css();
        return new Promise(res => {
            let back = document.createElement('div');
            back.className = 'apxd-ask';
            back.innerHTML = `<div><h4>${esc(title)}</h4><p>${esc(text)}</p><div class="row"><button data-v="">Cancel</button>${choices.map(c => `<button class="${c[2] || ''}" data-v="${c[0]}">${esc(c[1])}</button>`).join('')}</div></div>`;
            let done = v => { back.remove(); document.removeEventListener('keydown', key, true); res(v || null); };
            let key = e => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } };
            back.querySelectorAll('[data-v]').forEach(b => b.onclick = () => done(b.dataset.v));
            back.addEventListener('mousedown', e => { if (e.target === back) done(null); });
            document.addEventListener('keydown', key, true);
            document.body.appendChild(back);
            back.querySelector('.pri,.ok')?.focus();
        });
    }
    APXDice.ask = ask;

    // Who gets an Omen die: the GM (another creature's roll) or a party member
    async function pickOmenTarget(v, adj, lead) {
        let adjTxt = adj ? (adj > 0 ? ' + ' : ' − ') + Math.abs(adj) : '';
        let party = typeof window.apxGiveTargets === 'function' ? (window.apxGiveTargets() || []) : [];
        let choices = [['gm', 'The GM (any creature\'s roll)', 'pri']].concat(party.map(p => ['p:' + p.uid, p.name, 'pri']));
        let ans = await ask(`Omen die: ${v}${adjTxt}`, (lead ? lead + ' ' : '') + `Who gets it? The GM can put it on any creature's roll (an enemy's critical hit, for one). A party member gets it in their dice roller to use on their own roll.`, choices);
        if (!ans) return null;
        if (ans === 'gm') return { kind: 'gm' };
        let p = party.find(x => 'p:' + x.uid === ans);
        return p ? { kind: 'player', uid: p.uid, name: p.name } : null;
    }
    function sendOmen(to, v, adj) {
        let adjTxt = adj ? (adj > 0 ? '+' : '−') + Math.abs(adj) : '';
        if (to.kind === 'player') {
            let ok = typeof window.apxSendOmenToPlayer === 'function' && window.apxSendOmenToPlayer(to.uid, to.name, v, adj);
            APXDice.notify(ok ? `You passed an Omen die (${v}${adjTxt}) to ${to.name}.` : `Couldn't reach ${to.name}; the Omen die (${v}${adjTxt}) is spent. Tell them to use it.`, { kind: 'note', open: true });
            return;
        }
        if (typeof window.apxOnRollEvent === 'function') {
            try { window.apxOnRollEvent({ id: 'om' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), kind: 'omen', value: v, adj, label: 'Omen', who: S().name || '', nat: v, total: v + adj }); } catch (e) { }
        }
        APXDice.notify(`You spent an Omen die (${v}${adjTxt}) on another creature's roll.` + (window._pwOmenSent ? ' Your GM can apply it to that roll.' : ' Tell your GM which roll it replaces.'), { kind: 'note', open: true });
    }
    // An Omen die passed to you by another player
    APXDice.receiveOmen = function (g) {
        if (!g || !g.id) return;
        let list = (S().giftedOmens || []).slice();
        if (list.some(x => x.id === g.id)) return;
        list.push({ id: g.id, value: g.value, adj: g.adj || 0, from: g.from || 'A party member' });
        S().giftedOmens = list;
        refreshPerkBar(); refreshAllActions(); save();
        let adjTxt = g.adj ? (g.adj > 0 ? '+' : '−') + Math.abs(g.adj) : '';
        APXDice.notify(`${g.from || 'A party member'} passed you an Omen die: ${g.value}${adjTxt}. Use it from any d20 roll's buttons.`, { kind: 'note', open: true, id: 'omen_' + g.id });
    };

    // ── Combat log lines (from the GM's combat log) ──────────────
    // Adds or updates (same id) a one-line card. Doesn't pop the tray open; a red
    // dot on the dice button shows there's something new.
    let logCards = {};
    function trayKey() { return (location.pathname.split('/').pop() || 'index').toLowerCase(); }
    function clearedAt() {
        if (tray.clearedAt === undefined) { let v = 0; try { v = parseInt(localStorage.getItem('apx_tray_cleared_' + trayKey())) || 0; } catch (e) { } tray.clearedAt = v; }
        return tray.clearedAt || 0;
    }
    APXDice.logEntry = function (e) {
        if (!e || !e.id) return;
        build();
        let c = logCards[e.id];
        if (!c && (e.t || 0) <= clearedAt()) return;   // cleared entries stay cleared
        if (c && c.log.text === e.text && c.log.kind === e.kind && !!c.log.ask === !!e.ask) return;
        if (c) { c.log = e; renderCard(c); return; }
        c = { log: e, parts: [] };
        logCards[e.id] = c;
        let empty = tray.log.querySelector('.apxd-empty'); if (empty) empty.remove();
        cards.unshift(c);
        renderCard(c);
        tray.log.insertBefore(c.el, tray.log.firstChild);
        while (cards.length > 60) { let old = cards.pop(); old.el?.remove(); if (old.log) delete logCards[old.log.id]; }
        if (!tray.open) tray.fab.classList.add('unseen');
    };
    APXDice.hasLogEntry = id => !!logCards[id];
    // Notifications go in the same list (only on this device). open: pop the tray open
    // (for messages about something you just tried to do).
    APXDice.notify = function (text, opts) {
        opts = opts || {};
        let e = { id: opts.id || ('n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)), t: Date.now() + 1, text: String(text ?? ''), kind: opts.kind || 'note' };
        APXDice.logEntry(e);
        if (opts.open && !tray.open) toggle(true);
        return e.id;
    };
    APXDice.css = css;
    // Safe attribute value for data-apx-roll (use inside single quotes: data-apx-roll='${APXDice.attr({...})}')
    APXDice.attr = function (o) { return JSON.stringify(o).replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/</g, '&lt;'); };

    // Delegated clicks: dice text links, and any element with data-apx-roll='{json}'
    document.addEventListener('click', e => {
        let link = e.target.closest && e.target.closest('.apxd-roll-link');
        if (link) {
            e.preventDefault(); e.stopPropagation();
            let ctx = link.dataset.label || link.closest('[data-roll-label]')?.dataset.rollLabel || 'Roll';
            let who = link.closest('[data-roll-who]')?.dataset.rollWho || '';
            APXDice.formula(ctx, link.dataset.formula, who);
            return;
        }
        let blocked = e.target.closest && e.target.closest('[data-apx-blocked]');
        if (blocked) {
            e.preventDefault(); e.stopPropagation();
            APXDice.notify(`You're ${blocked.getAttribute('data-apx-blocked')}, so you can't attack or take actions until that ends.`, { kind: 'warn', open: true });
            return;
        }
        let el = e.target.closest && e.target.closest('[data-apx-roll]');
        if (el) {
            e.preventDefault(); e.stopPropagation();
            let o; try { o = JSON.parse(el.getAttribute('data-apx-roll')); } catch (err) { return; }
            let fn = APXDice[o.type || 'formula'];
            if (o.type === 'formula') APXDice.formula(o.label, o.formula, o.who);
            else if (typeof fn === 'function') fn(o);
        }
    }, true);

    // Anything rendered inside .apx-dice-scope gets its dice text made clickable
    let _lkPending = false;
    function linkifyScopes() {
        _lkPending = false;
        document.querySelectorAll('.apx-dice-scope').forEach(el => APXDice.linkify(el));
    }
    function watch() {
        linkifyScopes();
        new MutationObserver(muts => {
            if (_lkPending) return;
            if (!muts.some(m => [...m.addedNodes].some(n => n.nodeType === 1 && (n.matches?.('.apx-dice-scope') || n.closest?.('.apx-dice-scope') || n.querySelector?.('.apx-dice-scope'))))) return;
            _lkPending = true;
            requestAnimationFrame(linkifyScopes);
        }).observe(document.body, { childList: true, subtree: true });
    }
    APXDice.linkifyScopes = linkifyScopes;

    window.APXDice = APXDice;
    // Build the floating button once the page is ready
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { build(); watch(); }); else { build(); watch(); }
})();
