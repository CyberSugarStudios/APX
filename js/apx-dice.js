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
        .apxd-log{overflow-y:auto;padding:.5rem .6rem;display:flex;flex-direction:column;gap:.45rem;min-height:90px}
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
        .apxd-die.drop{opacity:.35;text-decoration:line-through}
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
        fab.title = 'Dice roller';
        fab.innerHTML = D20_SVG;
        fab.onclick = () => toggle();
        let el = document.createElement('div');
        el.className = 'apxd-tray';
        el.innerHTML = `
            <div class="apxd-hdr" id="apxdHdr">${D20_SVG.replace('<svg', '<svg width="18" height="18"')}<b>Dice</b>
                <button class="apxd-x" data-clear title="Clear the log">Clear</button><button class="apxd-x" data-close title="Close">X</button></div>
            <div class="apxd-bar">
                <div class="apxd-seg" title="Applies to the next d20 roll (conditions are added automatically)">
                    <button data-mode="dis">Disadv</button><button data-mode="normal" class="on">Normal</button><button data-mode="adv">Adv</button></div>
                <label data-explode-wrap style="display:none;font-size:.67rem;font-weight:800;align-items:center;gap:.2rem;cursor:pointer" title="High Roller Rank 5: once per Full Rest, declare before rolling damage">
                    <input type="checkbox" data-explode> Dice Explosion</label>
            </div>
            <div class="apxd-omen" data-omen style="display:none"></div>
            <div class="apxd-q">
                ${[4, 6, 8, 10, 12, 20, 100].map(s => `<button data-q="${s}">d${s}</button>`).join('')}
                <input data-free placeholder="+3 or 2d6+3" title="A number is added to the dice pool as a modifier. Any other roll (like 2d6+3) is rolled with the pool. Enter rolls.">
            </div>
            <div class="apxd-pool" data-pool></div>
            <div class="apxd-log"><div class="apxd-empty">Click a skill, save, weapon, power or any dice in a stat block to roll. Or use the buttons above.</div></div>`;
        document.body.appendChild(fab);
        document.body.appendChild(el);
        tray.el = el; tray.fab = fab; tray.log = el.querySelector('.apxd-log');
        el.querySelector('[data-close]').onclick = () => toggle(false);
        el.querySelector('[data-clear]').onclick = () => { cards = []; tray.log.innerHTML = '<div class="apxd-empty">Log cleared.</div>'; };
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
        let r = isSheet ? perk('luc_omen') : 0;
        if (!r) { om.style.display = 'none'; return; }
        let dice = S().omenDice || [];
        om.style.display = 'flex';
        om.innerHTML = `Omen: ${dice.length ? dice.map(v => `<span class="apxd-die omen">${v}</span>`).join('') : '<span style="opacity:.7;font-weight:600">none stored</span>'}
            ${S().omenRollPending ? `<button data-omenroll style="margin-left:auto;font-size:.67rem;font-weight:800;padding:.1rem .4rem;border-radius:.3rem;border:1px solid #a855f7;background:none;color:#e9d5ff;cursor:pointer">Roll Omen Dice</button>` : ''}`;
        let b = om.querySelector('[data-omenroll]'); if (b) b.onclick = () => APXDice.rollOmen();
    }

    // ── Card rendering ───────────────────────────────────────────
    function dieHtml(d, extraCls, spin) {
        let cls = 'apxd-die' + (extraCls ? ' ' + extraCls : '') + (spin ? ' spin' : '');
        if (d.v === d.s && d.s > 1 && !extraCls) cls += ' max';
        if (d.v === 1 && !extraCls) cls += ' min';
        let tip = [d.from ? `rerolled a ${d.from}` : '', d.boom ? `exploded: +${d.boom.join(' +')}` : ''].filter(Boolean).join('; ');
        return `<span class="${cls}" ${tip ? `title="${esc(tip)}"` : ''}>${d.v}${d.boom ? `<small>+${d.boom.join('+')}</small>` : ''}${d.from ? '<small>*</small>' : ''}</span>`;
    }
    function groupsHtml(roll, spin) {
        return roll.groups.map((g, i) => (i || g.sign < 0 ? `<span class="apxd-mod" ${g.crit ? 'title="Critical hit: extra dice"' : ''}>${g.sign < 0 ? '−' : g.crit ? '+crit' : '+'}</span>` : '') +
            g.dice.map(d => dieHtml(d, '', spin)).join('')).join('');
    }

    function renderCard(c, spin) {
        let el = c.el || (c.el = document.createElement('div'));
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
        if (!c.perks) return acts;
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
        if (r >= 3 && (p.nat === 20 || p.nat === 1) && !p.banked && p.omenAt === undefined) {
            acts.push({ label: `Bank ${p.nat} as Omen`, cls: 'omen', title: 'Omen Rank 3: store this natural roll as an Omen die', run: () => {
                let st = S(); st.omenDice = (st.omenDice || []).concat([p.nat]); p.banked = true; onChange(); save(); refreshPerkBar(); refreshAllActions();
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
            let p = { kind: 'd20', title: o.kind === 'save' ? 'Save' : 'd20', r, bonus: o.bonus || 0, canCrit: false, origMode: mode };
            settleD20(p);
            let c = { label: o.label || 'Check', who: o.who, parts: [p], perks: o.perks !== false && !!(window.state?.perks), badges: modeBadges(mode, o.advSources, o.disSources) };
            if (o.autoFail) c.badges.push(['fum', 'Auto-fail', o.autoFail]);
            if (o.note) c.badges.push(['info', o.note]);
            let redo = () => { c.badges = modeBadges(p.badgeMode || mode, o.advSources, o.disSources).concat(o.autoFail ? [['fum', 'Auto-fail', o.autoFail]] : []); c.actions = d20Actions(c, p, redo); renderCard(c); };
            c._redo = redo;
            c.actions = d20Actions(c, p, redo);
            setMode('normal');
            return addCard(c);
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
            let c = { label: o.label || 'Attack', who: o.who, parts: [atk, dmg], perks: usePerks, gamble };
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
            let redo = (full) => { settleDmg(); c.actions = d20Actions(c, atk, redo).concat(extraActs()); renderCard(c); };
            c._redo = redo;
            settleDmg();
            c.actions = d20Actions(c, atk, redo).concat(extraActs());
            setMode('normal');
            return addCard(c);
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
            let c = { label: o.label || 'Damage', who: o.who, parts: [p], badges: [] };
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
                c.actions = dp.instig ? [{ label: dst.inst ? 'Instigator: on' : 'Target Frightened/Provoked?', cls: dst.inst ? 'luck' : '', title: 'Instigator Rank 3: a Frightened or Provoked target takes an extra damage die', run: () => { dst.inst = !dst.inst; settle(); renderCard(c); } }] : [];
            };
            settle();
            return addCard(c);
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
        rollOmen() {
            let r = perk('luc_omen'); if (!r) return;
            let vals = r >= 5 ? [1, 10, 20] : Array.from({ length: omenPerRest(r) }, () => rnd(20));
            let st = S(); st.omenDice = vals; st.omenRollPending = false;
            setTimeout(refreshAllActions, 0);
            addCard({ label: 'Omen Dice', parts: [{ kind: 'text', html: vals.map(v => `<span class="apxd-die omen">${v}</span>`).join(' ') }], badges: [['info', r >= 5 ? 'Rank 5: no roll needed' : `${vals.length} stored until used`]] });
            refreshPerkBar(); save();
        },

        // After a Full Rest: Omen dice are re-rolled, High Roller's exploding dice come back
        onFullRest(opts) {
            let st = S();
            st.hrExplodeUsed = false;
            if (perk('luc_omen') && !(opts && opts.keepOmen)) { st.omenRollPending = true; APXDice.rollOmen(); }
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
