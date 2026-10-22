// ============================================================
// APX Power effects: Utilities that are numbers, applied for you
// ============================================================
// Step 5 Utilities that buff (or drain) a target by a number are applied when the power is used:
//   +1 AC, +2 DR or ER, +2 Speed, +1 to Attack rolls / Saves / Skill checks, Temporary HP (10 a copy),
//   +1 AP at the start of its next turn, -1 AP now, a Fly / Swim / Climb speed, Hover, no Attacks of
//   Opportunity, Feather Fall, Immunity to a damage type, Ethereal (immune to Physical damage),
//   Fatigue -1 / to 0, and ending Bleeding Out, Infected, Diseased or every Wounded limb.
// Each copy that needs a choice gets one in the Power Crafter (DR or ER, which rolls, which damage type...):
// draft.utilPicks[key or key#2...]. Using the power asks who the target is (you, your Loyal Companion, or
// a creature on your GM's battle map); an area power's targets are the creatures in its area.
// Lasting effects: on a player, state.powerBuffs (added into the sheet's totals like an item's); on an NPC
// in the GM's tracker, entry._fx with { powerBuff: true, ac, dr, er, speed, atk, save, ... }.
// They last until the end of the target's next turn (Instant), 10 of its turns (1 Minute, Channeling), or
// until ended (longer: the chip's x, or a rest).
// ============================================================
(function () {
    'use strict';
    const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const PHYS = ['Bludgeoning', 'Piercing', 'Slashing'];
    // Utilities that need a pick for each copy: [label, options [[value, text]]]
    const PICKS = {
        drEr2: ['+2 to', [['dr', 'DR'], ['er', 'ER']]],
        plus1Roll: ['+1 to', [['atk', 'Attack rolls'], ['save', 'Saving throws'], ['skill', 'Skill checks']]],
        swimClimb: ['Grants a', [['swim', 'Swim speed'], ['climb', 'Climb speed']]],
        endBleedInfect: ['Ends', [['bleedingout', 'Bleeding Out'], ['infected', 'Infected']]],
        fatigueDisease: ['Does', [['fatigue', 'Fatigue -1 level'], ['diseased', 'Ends Diseased']]],
        fatigueZeroWoundAll: ['Does', [['fatigue', 'Fatigue to 0'], ['wounds', 'Ends Wounded on every limb']]],
        dmgImmunity: ['Immune to', null],   // (a damage type)
        lightDark: ['Zone of', [['dark', 'Magical darkness'], ['fog', 'A cloud of fog'], ['light', 'Intense light']]],
        wall: ['Wall:', [['solid', 'Solid (blocks movement and sight)'], ['hazard', 'Hazardous (Step 4 dice to pass through)']]],
        resizeOne: ['Size:', [['grow', 'Grow one size larger'], ['shrink', 'Shrink one size smaller']]]
    };
    const TIER_OF = {};
    function tierOf(key) {
        if (TIER_OF[key]) return TIER_OF[key];
        let U = typeof POWER_UTILITY !== 'undefined' ? POWER_UTILITY : {};
        Object.keys(U).forEach(t => (U[t] || []).forEach(u => { TIER_OF[u.key] = t; }));
        return TIER_OF[key];
    }
    function count(d, key) { let t = tierOf(key); return t ? (((d.utility || {})[t] || {})[key] || 0) : 0; }
    function pickKeys(key, n) { return window.apxCondPickKeys ? window.apxCondPickKeys(key, n) : Array.from({ length: n }, (_, i) => i ? key + '#' + (i + 1) : key); }
    function pickOf(d, pk, key) {
        let v = (d.utilPicks || {})[pk];
        if (v) return v;
        let P = PICKS[key]; return P && P[1] ? P[1][0][0] : (key === 'dmgImmunity' ? 'Fire' : null);
    }
    function dmgTypes() { return typeof DMG_TYPES !== 'undefined' ? DMG_TYPES.slice() : ['Fire', 'Cold', 'Electric', 'Poison', 'Acid', 'Bludgeoning', 'Piercing', 'Slashing']; }

    // What the power's numeric Utilities do to one target (null if none of them)
    window.apxPowerBuff = function (d, lvl) {
        if (!d || !d.utility) return null;
        lvl = Math.max(1, parseInt(lvl) || 1);
        let b = { ac: 0, dr: 0, er: 0, speed: 0, atk: 0, save: 0, skill: 0, tempHp: 0, apNext: 0, apLose: 0, fly: false, swim: false, climb: false, hover: false, noAoO: false, featherFall: false,
            immune: [], fatigue: 0, fatigueZero: false, endConds: [], endWounds: false, harmful: false };
        let any = false, n;
        if ((n = count(d, 'plus1Ac'))) { b.ac += n; any = true; }
        if ((n = count(d, 'speed2'))) { b.speed += 2 * n; any = true; }
        if ((n = count(d, 'tempHp5'))) { b.tempHp += 10 * n; any = true; }   // (10 per copy, up to the power's Level in copies)
        // AP at the start of each of the target's turns while it lasts: movement-only, any use, or 1 less
        if ((n = count(d, 'bonusAp1'))) { b.apMove = (b.apMove || 0) + n; any = true; }
        if ((n = count(d, 'bonusApAny'))) { b.apTurn = (b.apTurn || 0) + n; any = true; }
        if ((n = count(d, 'loseAp1'))) { b.apLoseTurn = (b.apLoseTurn || 0) + n; b.harmful = true; any = true; }
        if ((n = count(d, 'drEr2'))) { pickKeys('drEr2', n).forEach(pk => { b[pickOf(d, pk, 'drEr2') === 'er' ? 'er' : 'dr'] += 2; }); any = true; }
        if ((n = count(d, 'plus1Roll'))) { pickKeys('plus1Roll', n).forEach(pk => { let v = pickOf(d, pk, 'plus1Roll'); b[['atk', 'save', 'skill'].includes(v) ? v : 'atk'] += 1; }); any = true; }
        if (count(d, 'flySpeed')) { b.fly = true; any = true; }
        if (count(d, 'hover')) { b.hover = true; any = true; }
        if ((n = count(d, 'swimClimb'))) { pickKeys('swimClimb', n).forEach(pk => { b[pickOf(d, pk, 'swimClimb') === 'climb' ? 'climb' : 'swim'] = true; }); any = true; }   // (two copies: both)
        if (count(d, 'noAoO')) { b.noAoO = true; any = true; }
        if (count(d, 'featherFall')) { b.featherFall = true; any = true; }
        if (count(d, 'dmgImmunity')) { b.immune.push(pickOf(d, 'dmgImmunity', 'dmgImmunity')); any = true; }
        if (count(d, 'ethereal')) { b.immune.push(...PHYS); b.ethereal = true; any = true; }
        if (count(d, 'endBleedInfect')) { b.endConds.push(pickOf(d, 'endBleedInfect', 'endBleedInfect')); any = true; }
        if (count(d, 'fatigueDisease')) { if (pickOf(d, 'fatigueDisease', 'fatigueDisease') === 'diseased') b.endConds.push('diseased'); else b.fatigue -= 1; any = true; }
        if (count(d, 'fatigueZeroWoundAll')) { if (pickOf(d, 'fatigueZeroWoundAll', 'fatigueZeroWoundAll') === 'wounds') b.endWounds = true; else b.fatigueZero = true; any = true; }
        if (count(d, 'invisible')) { b.invisible = true; any = true; }   // (Concentration checks for each hostile action: js/apx-power-world.js)
        if (!any) return null;
        b.immune = [...new Set(b.immune)];
        b.lasting = !!(b.ac || b.dr || b.er || b.speed || b.atk || b.save || b.skill || b.fly || b.swim || b.climb || b.hover || b.noAoO || b.featherFall || b.immune.length || b.invisible || b.apMove || b.apTurn || b.apLoseTurn);
        return b;
    };
    // An empty buff (for a power whose only buff is one the engine adds, like extra weapon damage)
    window.apxBlankBuff = () => ({ ac: 0, dr: 0, er: 0, speed: 0, atk: 0, save: 0, skill: 0, tempHp: 0, apNext: 0, apLose: 0, fly: false, swim: false, climb: false, hover: false, noAoO: false, featherFall: false,
        immune: [], fatigue: 0, fatigueZero: false, endConds: [], endWounds: false, harmful: false, lasting: false });
    // "+1 AC, +2 DR, Fly speed…"
    window.apxPowerBuffText = function (b) {
        if (!b) return '';
        let t = [];
        if (b.ac) t.push(`+${b.ac} AC`); if (b.dr) t.push(`+${b.dr} DR`); if (b.er) t.push(`+${b.er} ER`); if (b.speed) t.push(`+${b.speed} Speed`);
        if (b.atk) t.push(`+${b.atk} to Attack rolls`); if (b.save) t.push(`+${b.save} to Saving throws`); if (b.skill) t.push(`+${b.skill} to Skill checks`);
        if (b.tempHp) t.push(`${b.tempHp} Temporary HP`); if (b.apNext) t.push(`+${b.apNext} AP at the start of its next turn`); if (b.apLose) t.push(`loses ${b.apLose} AP`);
        if (b.apTurn) t.push(`+${b.apTurn} AP each turn`); if (b.apMove) t.push(`+${b.apMove} AP each turn for movement`); if (b.apLoseTurn) t.push(`${b.apLoseTurn} less AP each turn`);
        if (b.fly) t.push('a Fly speed'); if (b.swim) t.push('a Swim speed'); if (b.climb) t.push('a Climb speed'); if (b.hover) t.push('Hover');
        if (b.noAoO) t.push('no Attacks of Opportunity'); if (b.featherFall) t.push('Feather Fall (no fall damage)');
        if (b.ethereal) t.push('Ethereal (immune to Physical damage)'); else if ((b.immune || []).length) t.push('Immune to ' + b.immune.join(', '));
        if (b.invisible) t.push('Invisible');
        if (b.wpnDmg) t.push(`weapons deal +${b.wpnDmg.formula}${b.wpnDmg.type ? ' ' + b.wpnDmg.type : ''}`);
        if (b.fatigue) t.push(b.fatigue > 0 ? `+${b.fatigue} level${b.fatigue > 1 ? 's' : ''} of Fatigue` : `${b.fatigue} Fatigue`); if (b.fatigueZero) t.push('Fatigue to 0'); if (b.endWounds) t.push('ends every Wounded limb');
        if ((b.endConds || []).length) t.push('ends ' + b.endConds.map(c => ((typeof CONDITIONS !== 'undefined' ? CONDITIONS : []).find(x => x.id === c) || {}).name || c).join(', '));
        return t.join(', ');
    };
    // Its target's turns (counted at the start of each one): 1 round = 6 seconds (js/apx-power-world.js)
    const TURNS = { instant: 2, '1min': 10, channel: 10 };
    window.apxBuffTurns = dur => window.apxDurTurns ? window.apxDurTurns(dur) : (TURNS[dur || 'instant'] != null ? TURNS[dur || 'instant'] : null);

    // ── The Power Crafter: a pick for each copy that needs one ──
    window.pcUtilPickRows = function (key, n) {
        let P = PICKS[key]; if (!P || typeof pcDraft === 'undefined' || !pcDraft || !n) return '';
        let opts = P[1] || dmgTypes().map(t => [t, t]);
        return pickKeys(key, n).map((pk, i) => {
            let cur = pickOf(pcDraft, pk, key);
            return `<div class="flex items-center gap-2 bg-slate-950 border border-sky-800/60 rounded px-2 py-1 ml-3 text-[10px] text-sky-100" data-pc-utilpick="${esc(pk)}">${n > 1 ? `<b class="text-sky-300">#${i + 1}</b>` : ''}<span>${esc(P[0])}</span>
                <select onchange="window.pcSetUtilPick('${esc(pk)}', this.value)" class="bg-slate-900 border-slate-700 text-[10px] py-0.5">${opts.map(o => `<option value="${esc(o[0])}" ${cur === o[0] ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>
                <span class="text-slate-500">(applied for you when it's used)</span></div>`;
        }).join('');
    };
    // The power's summary: "+2 DR, +2 ER" for two copies of +2 DR or ER (null for a Utility with no pick)
    window.apxUtilPickBits = function (d, key, n) {
        let P = PICKS[key]; if (!P || !d || !n) return null;
        let opts = P[1] || dmgTypes().map(t => [t, t]), tally = {};
        pickKeys(key, n).forEach(pk => { let v = pickOf(d, pk, key); tally[v] = (tally[v] || 0) + 1; });
        return Object.keys(tally).map(v => {
            let txt = ((opts.find(o => o[0] === v) || [v, v])[1]), k = tally[v];
            let line = key === 'drEr2' ? `+${2 * k} ${txt}` : key === 'plus1Roll' ? `+${k} to ${txt}` : P[0] === 'Does' || /:$/.test(P[0]) ? txt : `${P[0]} ${txt}`;
            return line + (k > 1 && !['drEr2', 'plus1Roll'].includes(key) ? ` (x${k})` : '');
        });
    };
    window.pcSetUtilPick = function (pk, v) {
        if (typeof pcDraft === 'undefined' || !pcDraft) return;
        pcDraft.utilPicks = Object.assign({}, pcDraft.utilPicks || {}, { [pk]: v });
        if (typeof pcRenderAll === 'function') pcRenderAll();
    };

    // ── On a player's sheet ──
    // Totals from the buffs on you, added like an item's (the engine calls this when it adds up your items)
    window.apxPowerBuffStats = function (st, itemFx) {
        let list = (st && st.powerBuffs) || []; if (!list.length || !itemFx) return;
        let add = (k, v) => { if (v) itemFx.stat[k] = (itemFx.stat[k] || 0) + v; };
        list.forEach(b => {
            add('ac', b.ac); add('dr', b.dr); add('er', b.er); add('speed', b.speed);
            add('meleeAtk', b.atk); add('rangedAtk', b.atk); add('powerAtk', b.atk);
            add('saveAll', b.save); add('checkAll', b.skill);
        });
    };
    // Extra weapon damage from a power on you: [{ formula, type, name }]
    window.apxPowerBuffWpnDmg = st => ((st && st.powerBuffs) || []).filter(b => b.wpnDmg && b.wpnDmg.formula).map(b => Object.assign({ name: b.name || 'Power' }, b.wpnDmg));
    window.apxPowerBuffImmune = st => [...new Set(((st && st.powerBuffs) || []).reduce((t, b) => t.concat(b.immune || []), []))];
    window.apxPowerBuffHas = (st, k) => ((st && st.powerBuffs) || []).some(b => b[k]);
    // Put a buff on yourself (from your own power, or from someone else's through your GM)
    window.apxApplyBuffToMe = function (b, from) {
        let st = window.state; if (!st || !b) return;
        let notes = [];
        if (b.lasting) {
            st.powerBuffs = (st.powerBuffs || []).filter(x => x.key !== b.key);   // (the same power again: the new one replaces it)
            st.powerBuffs.push(Object.assign({}, b, { id: b.id || ('pb' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)), from: from || b.from || '', left: window._pwCombatCode ? window.apxBuffTurns(b.dur) : null }));
        }
        if (b.tempHp) { let had = Math.max(0, st.tempHp || 0); if (b.tempHp > had) { st.tempHp = b.tempHp; notes.push(`${b.tempHp} Temporary HP`); } else notes.push(`kept your ${had} Temporary HP (it doesn't stack)`); window.apxRefreshHpInputs?.(); }
        if (b.apNext) { st.apNextBonus = (st.apNextBonus || 0) + b.apNext; }
        if (b.apLose && window.apxSpendAp) window.apxSpendAp(Math.min(b.apLose, window.apxApCurrent ? window.apxApCurrent() : b.apLose));
        if (b.fatigueZero) st.fatigue = 0; else if (b.fatigue) st.fatigue = Math.max(0, (parseInt(st.fatigue) || 0) + b.fatigue);
        if (b.endWounds) st.woundedLimbs = [];
        (b.endConds || []).forEach(c => { if ((st.conditions || []).includes(c) && window.toggleCondition) window.toggleCondition(c, false); });
        window.recalculateMath?.(); window.scheduleAutoSave?.();
        window.APXDice?.notify(`${b.name || 'A power'}${from ? ` (${from})` : ''}: ${window.apxPowerBuffText(b)}${notes.length ? ' · ' + notes.join(', ') : ''}.`, { kind: 'note', open: true });
    };
    window.apxEndBuff = function (id, why) {
        let st = window.state; if (!st) return;
        let b = (st.powerBuffs || []).find(x => x.id === id);
        st.powerBuffs = (st.powerBuffs || []).filter(x => x.id !== id);
        if (!st.powerBuffs.length) delete st.powerBuffs;
        if (b) window.APXDice?.notify(`${b.name || 'A power'} on you ends${why ? ` (${why})` : ''}.`, { kind: 'note' });
        // (Invisible no more: your GM's map shows your token again)
        if (b && b.invisible) { try { window.apxOnRollEvent?.({ id: 'bd' + Date.now().toString(36), kind: 'buffDrop', label: b.name || 'Power', pi: b.pi || null, invisible: true }); } catch (e) { } }
        // (your own lasting power whose only effect this was: it's over too)
        let a = b && b.pi && window.apxMyInstance ? window.apxMyInstance(b.pi) : null;
        if (a && !a.onOthers && !(st.powerBuffs || []).some(x => x.pi === a.id) && why && window.apxEndActivePower) window.apxEndActivePower(a.id, why);
        window.recalculateMath?.(); window.scheduleAutoSave?.();
    };
    // The bar above your Powers and Attacks (and under Armor & Defenses' totals): what's on you, with x to end it
    window.apxPowerBuffBarHtml = function () {
        let list = (window.state && window.state.powerBuffs) || []; if (!list.length) return '';
        return list.map(b => `<div data-power-buff="${esc(b.id)}" style="background:rgba(12,74,110,.35);border:1px solid #0284c7;border-radius:.4rem;padding:.3rem .5rem;margin-bottom:.4rem;display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">
            <span style="font-size:.7rem;font-weight:800;color:#bae6fd">${esc(b.name || 'Power')}</span>
            <span style="font-size:.6rem;color:#7dd3fc">${esc(window.apxPowerBuffText(Object.assign({}, b, { tempHp: 0, apNext: 0, apLose: 0, fatigue: 0, fatigueZero: false, endWounds: false, endConds: [] })))}${b.from ? ' · from ' + esc(b.from) : ''}${b.left != null ? ` · ${b.left} more turn${b.left === 1 ? '' : 's'}` : ''}</span>
            <span style="flex:1"></span><button onclick="window.apxEndBuff('${esc(b.id)}')" title="It ended (or was dispelled)" style="font-size:.62rem;font-weight:800;padding:0 .4rem;border-radius:.25rem;background:#0f172a;border:1px solid #0284c7;color:#bae6fd;cursor:pointer">✕</button></div>`).join('');
    };
    // Your turn starts: buffs run down; +1 AP from a power lands now
    (function hook(tries) {
        let orig = window.apxResetAp;
        if (typeof orig !== 'function') { if ((tries || 0) < 50) setTimeout(() => hook((tries || 0) + 1), 200); return; }
        if (orig._apxBuff) return;
        let w = function () {
            let r = orig.apply(this, arguments);
            let st = window.state;
            if (st && st.apNextBonus > 0 && window.apxSetApValue) { let n = st.apNextBonus; st.apNextBonus = 0; window.apxSetApValue((window.apxApCurrent ? window.apxApCurrent() : 0) + n); window.APXDice?.notify(`+${n} AP from a power, this turn.`, { kind: 'note' }); }
            let gone = [];
            ((st && st.powerBuffs) || []).forEach(b => { if (b.left != null) { b.left -= 1; if (b.left <= 0) gone.push(b); } });
            if (gone.length) { st.powerBuffs = st.powerBuffs.filter(b => !gone.includes(b)); if (!st.powerBuffs.length) delete st.powerBuffs; window.APXDice?.notify(`${gone.map(b => b.name || 'A power').join(' and ')} on you ${gone.length > 1 ? 'end' : 'ends'}.`, { kind: 'note' }); setTimeout(() => window.recalculateMath?.(), 0); }
            // The powers still on you: +1 AP each turn, 1 less, and AP that can only be spent on movement (used first when you
            // move; it doesn't carry over to your next turn)
            if (st) window.apxBuffTurnAp(st);
            return r;
        };
        Object.keys(orig).forEach(k => { w[k] = orig[k]; });
        w._apxBuff = true; window.apxResetAp = w;
    })(0);
    window.apxBuffTurnAp = function (st) {
        let sum = k => (st.powerBuffs || []).reduce((t, b) => t + (parseInt(b[k]) || 0), 0);
        let plus = sum('apTurn'), minus = sum('apLoseTurn'), mv = sum('apMove'), bits = [];
        if ((plus || minus) && window.apxSetApValue) {
            let cur = window.apxApCurrent ? window.apxApCurrent() : 0;
            window.apxSetApValue(Math.max(0, cur + plus - minus));
            if (plus) bits.push(`+${plus} AP`); if (minus) bits.push(`−${minus} AP`);
        }
        if (mv) { st.apMove = mv; bits.push(`+${mv} AP for movement only (spent first when you move)`); } else delete st.apMove;
        window.apxRenderApPips?.();
        if (bits.length) window.APXDice?.notify(`Powers on you this turn: ${bits.join(', ')}.`, { kind: 'note' });
    };
    // Movement AP (Move, Jump, dragging your token): movement-only AP first, then your own. → AP taken from your own
    window.apxMoveApLeft = () => Math.max(0, parseInt((window.state || {}).apMove) || 0);
    window.apxSpendMoveAp = function (n) {
        let st = window.state; n = Math.max(0, parseInt(n) || 0); if (!st || !n) return 0;
        let mv = Math.min(n, window.apxMoveApLeft());
        if (mv) { st.apMove -= mv; if (st.apMove <= 0) delete st.apMove; }
        let rest = n - mv;
        if (rest > 0 && window.apxSpendAp) window.apxSpendAp(Math.min(rest, window.apxApCurrent ? window.apxApCurrent() : rest));
        else window.apxRenderApPips?.();
        return rest;
    };
    // Buffs your GM's tracker sends you (another player's power on you): applied once each
    window.apxReceiveBuffs = function (map) {
        let st = window.state; if (!st || !map) return;
        let seen = st._buffSeen || [];
        Object.keys(map).sort((a, b) => ((map[a] || {}).t || 0) - ((map[b] || {}).t || 0)).forEach(id => {
            if (seen.includes(id) || !map[id]) return;
            seen.push(id);
            let m = map[id];
            // (the power it came from ended: its buffs on you go too)
            if (m.endPi) { let gone = (st.powerBuffs || []).filter(b => b.pi === m.endPi); if (gone.length) { st.powerBuffs = st.powerBuffs.filter(b => !gone.includes(b)); if (!st.powerBuffs.length) delete st.powerBuffs; window.APXDice?.notify(`${gone[0].name || 'A power'} on you ends${m.why ? ` (${m.why})` : ''}.`, { kind: 'note' }); window.recalculateMath?.(); } return; }
            // (one of your own powers was ended: dispelled, or its Sensor destroyed)
            if (m.endOwn) { if (window.apxMyInstance && window.apxMyInstance(m.endOwn)) window.apxEndActivePower(m.endOwn, m.why || 'it was ended'); return; }
            // (your Loyal Companion's turn: powers on it add or take AP, or give it AP for movement only)
            if (m.compAp !== undefined || m.compMove !== undefined) {
                if (m.compAp && window.apxCompSetAp && window.apxCompApCurrent) window.apxCompSetAp(Math.max(0, window.apxCompApCurrent() + m.compAp));
                if (st.companion) { if (m.compMove) st.compApMove = m.compMove; else delete st.compApMove; }
                if (m.compAp || m.compMove) window.APXDice?.notify(`${(st.companion && st.companion.name) || 'Your companion'}: ${[m.compAp ? `${m.compAp > 0 ? '+' : '−'}${Math.abs(m.compAp)} AP` : '', m.compMove ? `+${m.compMove} AP for movement only` : ''].filter(Boolean).join(', ')} from powers this turn.`, { kind: 'note' });
                window.scheduleAutoSave?.(); return;
            }
            // (your token's size: a power grew or shrank you)
            if (m.size !== undefined) { st.powerSize = m.size || null; if (!st.powerSize) delete st.powerSize; window.recalculateMath?.(); return; }
            window.apxApplyBuffToMe(Object.assign({}, m, { id }), m.from || '');
        });
        st._buffSeen = seen.slice(-60);
    };
    // Using a power with these Utilities: who gets it. → { self: true } | { tokenId, name } | { companion: true } | null (cancel) | 'skip'
    window.apxPickBuffTarget = async function (name, b) {
        if (!window.APXDice || !APXDice.ask) return { self: true };
        let opts = b.harmful ? [] : [['self', 'You', 'pri']];
        let st = window.state;
        if (st && st.companion && ((st.perks || {}).cha_loyalcompanion || 0) >= 1) opts.push(['comp', `${st.companion.name || 'Your companion'} (your Loyal Companion)`]);
        let am = window._pwAreaMap ? window._pwAreaMap(false) : null, toks = [];
        if (am) {
            let map = (((window._playerWorldData || {}).notesV2 || {}).otherMaps || []).find(m => m.id === am.mapId);
            toks = ((map && map.battleTokens) || []).filter(t => t.revealed !== false && t.id !== am.tokenId && !(t.type === 'companion' && t.playerUid === window.apxAuth?.user?.uid)).slice(0, 10);
            toks.forEach(t => opts.push(['t' + t.id, t.name || 'Creature']));
        }
        opts.push(['other', 'Someone else (my GM applies it)']);
        if (opts[0]) opts[0][2] = 'pri';
        let a = await APXDice.ask(name, `Who does it target? (${window.apxPowerBuffText(b)})`, opts);
        if (!a) return null;
        if (a === 'self') return { self: true };
        if (a === 'comp') return { companion: true };
        if (a === 'other') return 'skip';
        let t = toks.find(x => 't' + x.id === a);
        return t ? { tokenId: t.id, mapId: am.mapId, name: t.name || 'Creature' } : 'skip';
    };

    // ── The GM's tracker ──
    // Sum of a numeric field over an NPC entry's power buffs (AC is already added by _gmFxAcBonus)
    window._gmBuffStat = (e, k) => (Array.isArray(e && e._fx) ? e._fx : []).filter(f => f.powerBuff).reduce((t, f) => t + (parseInt(f[k]) || 0), 0);
    window._gmBuffHas = (e, k) => (Array.isArray(e && e._fx) ? e._fx : []).some(f => f.powerBuff && f[k]);
    window._gmBuffImmune = e => [...new Set((Array.isArray(e && e._fx) ? e._fx : []).filter(f => f.powerBuff).reduce((t, f) => t.concat(f.immune || []), []))];
    // Apply a buff to a tracker entry: an NPC here, a player (or their companion) on their sheet
    window._gmApplyBuff = function (e, b, fromName) {
        if (!e || !b) return;
        let name = b.name || 'A power';
        if (e.faction === 'player' && e.playerUid && !e.companionOf) { window._gmSendBuff && window._gmSendBuff(e.playerUid, Object.assign({}, b, { from: fromName || '' })); return; }
        let bits = [];
        if (b.lasting) {
            e._fx = (Array.isArray(e._fx) ? e._fx : []).filter(f => !(f.powerBuff && f.key === 'pb:' + (b.key || name)));
            e._fx.push(Object.assign({}, b, { id: 'pb' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), key: 'pb:' + (b.key || name), name, powerBuff: true, keep: true,
                label: `${name}: ${window.apxPowerBuffText(Object.assign({}, b, { tempHp: 0, apNext: 0, apLose: 0, fatigue: 0, fatigueZero: false, endWounds: false, endConds: [] }))}`,
                left: window.apxBuffTurns(b.dur), ac: b.ac || 0 }));
        }
        if (b.tempHp) { let had = Math.max(0, e.tempHp || 0); if (b.tempHp > had) e.tempHp = b.tempHp; bits.push(b.tempHp > had ? `${b.tempHp} Temporary HP` : 'its Temporary HP stays (no stacking)'); }
        if (b.apNext) e._apNext = (e._apNext || 0) + b.apNext;
        if (b.apLose && window.gmCombatStarted && typeof gmApCurrent === 'function') e.apCur = Math.max(0, gmApCurrent(e) - b.apLose);
        if (b.fatigueZero) e.fatigue = 0; else if (b.fatigue) e.fatigue = Math.max(0, (parseInt(e.fatigue) || 0) + b.fatigue);
        if (b.endWounds && Array.isArray(e.wounds)) e.wounds = [];
        (b.endConds || []).forEach(c => { if (window._gmRemoveEntryCondition && (window._gmEntryConditions ? window._gmEntryConditions(e.id) : []).includes(c)) window._gmRemoveEntryCondition(e.id, c); });
        if (typeof gmLog === 'function') gmLog({ text: `${window._gmPublicName ? window._gmPublicName(e) : e.name}: ${name}${b.harmful ? '' : ' (from ' + (fromName || 'a power') + ')'}.`, gmText: `${window._gmGmName ? window._gmGmName(e) : e.name} ← ${name}${fromName ? ' (' + fromName + ')' : ''}: ${window.apxPowerBuffText(b)}${bits.length ? ' · ' + bits.join(', ') : ''}.`, kind: 'info', force: true });
        window.renderInitiativeTracker?.(); window.saveWorldNotes?.();
    };
    // A player gets it on their sheet (worldCodes/{code}/players/{uid}._gmBuffs.{id})
    window._gmSendBuff = function (uid, b) {
        let code = typeof _gmInviteCode === 'function' ? _gmInviteCode() : null, db = window._apxDb;
        if (!code || !db || !uid) return;
        let id = 'gb' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        let clean = JSON.parse(JSON.stringify(Object.assign({}, b, { t: Date.now() })));
        db.collection('worldCodes').doc(code).collection('players').doc(uid).set({ _gmBuffs: { [id]: clean } }, { merge: true }).catch(e => console.warn('Buff to player:', e.message));
    };
    // A player's power event with a buff: apply it to the creature they picked, or to everyone in its area
    window._gmHandleBuffEvent = function (uid, ev, casterName) {
        let b = ev && ev.buff; if (!b) return;
        let list = window.gmInitiative || [], targets = [];
        let byTok = (mapId, tid) => { let m = ((window._wNotes || {}).otherMaps || (typeof _wNotes !== 'undefined' ? _wNotes.otherMaps : []) || []).find(x => x.id === mapId); let t = m && (m.battleTokens || []).find(x => x.id === tid); return t && t.initiativeId ? list.find(e => e.id === t.initiativeId) : null; };
        if (ev.buffTarget && ev.buffTarget.tokenId) { let e = byTok(ev.buffTarget.mapId, ev.buffTarget.tokenId); if (e) targets.push(e); }
        else if (ev.buffTarget && Array.isArray(ev.buffTarget.tokenIds)) ev.buffTarget.tokenIds.forEach(tid => { let e = window._gmEntryForToken ? window._gmEntryForToken(ev.buffTarget.mapId, tid) : byTok(ev.buffTarget.mapId, tid); if (e && !targets.includes(e)) targets.push(e); });
        else if (ev.buffTarget && ev.buffTarget.companion) { let e = list.find(x => x.companionOf === uid); if (e) targets.push(e); }
        else if (ev.area && Array.isArray(ev.area.tokenIds)) ev.area.tokenIds.forEach(tid => { let e = byTok(ev.area.mapId, tid); if (e && !targets.includes(e)) targets.push(e); });
        targets.forEach(e => { if (e.faction === 'player' && e.playerUid === uid && !e.companionOf) return; window._gmApplyBuff(e, b, casterName); });   // (the caster's own buff is on their sheet already)
        if (!targets.length && ev.buffTarget !== undefined && !(ev.buffTarget && ev.buffTarget.self) && typeof gmLog === 'function') gmLog({ gmOnly: true, kind: 'info', text: `${casterName || 'A player'}'s ${b.name || 'power'}: ${window.apxPowerBuffText(b)}. Apply it to its target by hand (it wasn't a creature in the tracker).` });
    };
    // GM page: an NPC's attack roll gets its +1 to Attack rolls from a power (added to the roll's bonus)
    (function hookGmAtk(tries) {
        if (typeof window._gmAttackerFor !== 'function') { if ((tries || 0) < 50 && /GMTools/i.test(location.pathname)) setTimeout(() => hookGmAtk((tries || 0) + 1), 300); return; }
        let orig = window.apxBeforeAttack;
        if (typeof orig !== 'function' || orig._apxBuffAtk) return;
        let w = async function (o) {
            let pre = await orig.apply(this, arguments);
            if (pre === false || !o || o.pcAttack) return pre;
            let a = null; try { a = window._gmAttackerFor(o); } catch (e) { }
            // (an attack is a hostile action: Invisible from a power, a Concentration check; Action Interrupt ends a buff)
            if (a && !o._hostileDone && window._gmNpcHostile) { o._hostileDone = true; try { window._gmNpcHostile(a); } catch (e) { } }
            // A power on it makes its weapons deal extra damage (a weapon attack, not a power)
            let wd = a && !o.power && o.dice ? (Array.isArray(a._fx) ? a._fx : []).filter(f => f.powerBuff && f.wpnDmg && f.wpnDmg.formula) : [];
            if (wd.length && !o._wpnDmgDone) {
                o._wpnDmgDone = true;
                o.split = (o.split && o.split.length ? o.split : [{ formula: o.dice, type: o.dmgType || 'Weapon' }]).concat(wd.map(f => ({ formula: f.wpnDmg.formula, type: f.wpnDmg.type || 'Power' })));
                o.dmgType = [...new Set(o.split.map(x => x.type).filter(Boolean))].join(' + ');
                pre = Object.assign({}, pre || {}, { note: ((pre && pre.note) ? pre.note + ' · ' : '') + wd.map(f => `+${f.wpnDmg.formula} ${f.wpnDmg.type || ''} (${f.name})`).join(', ') });
            }
            let n = a ? window._gmBuffStat(a, 'atk') : 0;
            if (!n) return pre;
            return Object.assign({}, pre || {}, { bonus: ((pre && pre.bonus) || 0) + n, note: ((pre && pre.note) ? pre.note + ' · ' : '') + `+${n} to attack (a power)` });
        };
        Object.keys(orig).forEach(k => { w[k] = orig[k]; });
        w._apxBuffAtk = true; window.apxBeforeAttack = w;
    })(0);
    // An NPC uses such a power from its stat block: the GM picks who gets it
    window._gmBuffOffer = async function (actor, p) {
        let b = p && p.draft ? window.apxPowerBuff(p.draft, p.lvl) : null; if (!b || !window.APXDice || !APXDice.ask) return;
        b = Object.assign(b, { name: p.name || 'Power', key: (actor ? actor.id : '') + ':' + (p.name || 'Power'), dur: p.draft.duration || 'instant' });
        let list = (window.gmInitiative || []).filter(e => !(e.currentHp !== null && e.currentHp <= 0 && e.faction !== 'player'));
        if (!list.length) return;
        let mates = o => actor && ((actor.faction === 'enemy') === (o.faction === 'enemy'));
        list.sort((x, y) => (b.harmful ? (mates(x) ? 1 : 0) - (mates(y) ? 1 : 0) : (mates(y) ? 1 : 0) - (mates(x) ? 1 : 0)) || (y === actor ? 1 : 0) - (x === actor ? 1 : 0));
        let a = await APXDice.ask(p.name || 'Power', `Who gets it? (${window.apxPowerBuffText(b)})`, list.slice(0, 12).map((o, i) => ['t' + o.id, (window._gmGmName ? window._gmGmName(o) : o.name) + (o === actor ? ' (itself)' : ''), i ? '' : 'pri']).concat([['none', 'No one in the tracker']]));
        if (!a || a === 'none') return;
        let t = list.find(o => 't' + o.id === a);
        if (t) window._gmApplyBuff(t, b, actor ? (window._gmGmName ? window._gmGmName(actor) : actor.name) : '');
    };
})();
