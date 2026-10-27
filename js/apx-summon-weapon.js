// ============================================================
// APX Summon a Weapon (Moderate Utility)
// ============================================================
// "Summon a magical, hard-light, or psychic weapon to your hands. You are considered Trained with it, and
// you use your Power Attribute for its attack and damage rolls. Damage purchased in Step 4 determines how
// much damage the weapon deals. The weapon is considered Medium and attacks with it cost 3 AP. (A maximum
// of 1 die per Power Level can be purchased.) For an additional 10 XP each, you can add Weapon Properties
// to the weapon that a normal weapon could have."
//
// Each copy of the Utility is one weapon: draft.summonWeapons[i] = { name, category: 'melee' | 'ranged',
// props: { key: true | n } }. Using the power puts its weapons in Weapons & Attacks (state.summonedWeapons)
// until its duration runs out or you dismiss them. They attack with the Power Attack Bonus (a Conduit
// Exo-Suit's included), its Power Save DC sets their properties' DCs, and a Conduit's Breach, Nullifier
// and Amplifier work on their damage. NPCs' stat blocks list the weapons under the power.
// ============================================================
(function () {
    'use strict';
    const XP_PER_PROP = 10, BASE_AP = 3, RANGED_RANGE = '5/20';
    const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const DICE = () => (typeof POWER_DIE_STEPS !== 'undefined' ? POWER_DIE_STEPS : ['d4', 'd6', 'd8', 'd10', 'd12']);

    function count(d) { return ((d && d.utility && d.utility.moderate) || {}).summonWeapon || 0; }
    window.apxSwCount = count;
    function blank() { return { name: '', category: 'melee', props: {} }; }
    function norm(w) {
        w = w || {};
        let props = {};
        Object.keys(w.props || {}).forEach(k => { let v = w.props[k]; if (typeof v === 'number' ? v > 0 : !!v) props[k] = typeof v === 'number' ? v : true; });
        return { name: String(w.name || '').slice(0, 60), category: w.category === 'ranged' ? 'ranged' : 'melee', props };
    }
    // Each copy's weapon (a copy without one of its own is a copy of the one before it)
    window.apxSwSlots = function (d) {
        let n = count(d), list = Array.isArray(d && d.summonWeapons) ? d.summonWeapons : [], out = [];
        for (let i = 0; i < n; i++) out.push(norm(list[i] || out[i - 1] || blank()));
        return out;
    };
    window.apxSwSet = function (d, i, patch) {
        let slots = window.apxSwSlots(d);
        if (!slots[i]) return;
        slots[i] = norm(Object.assign({}, slots[i], patch));
        d.summonWeapons = slots;
    };
    // The number of copies changed: a new copy starts as a copy of the one before it
    window.apxSwResize = function (d, next) {
        let slots = window.apxSwSlots(d);
        let list = slots.slice(0, Math.max(0, next));
        while (list.length < next) list.push(norm(list[list.length - 1] || blank()));
        if (next > 0) d.summonWeapons = list; else delete d.summonWeapons;
    };

    // ── What the weapon is ──
    function ctxOf(d, w) {
        let el = typeof WEAPON_ELEMENTAL_TYPES !== 'undefined' && WEAPON_ELEMENTAL_TYPES.includes(d.dmgType) ? d.dmgType : null;
        return { category: w.category, weightClass: 'medium', props: w.props, effectiveDmgType: d.dmgType, elemental: el };
    }
    function propN(v) { return typeof v === 'number' ? Math.max(0, v) : (v ? 1 : 0); }
    // The properties a summoned weapon can take: what a normal Medium weapon of its kind could. No drawbacks
    // (Loading, Unwieldy), and no Finesse (it already uses your Power Attribute).
    window.apxSwPropDefs = function (d, w) {
        if (typeof WEAPON_PROPERTIES === 'undefined') return [];
        return WEAPON_PROPERTIES.filter(p => p.cost > 0 && p.key !== 'finesse' && (!p.addonOf || (w.props || {})[p.addonOf]))
            .sort((a, b) => (b.top ? 1 : 0) - (a.top ? 1 : 0))   // (Elemental Critical first, as in the Weapon Forge)
            .map(p => { let ok = false; try { ok = !!p.reqCheck(ctxOf(d, w)); } catch (e) { } return { def: p, ok, n: propN((w.props || {})[p.key]), max: p.max || 1 }; });
    };
    // Properties it has that it no longer qualifies for (its damage type changed, it became ranged…)
    function badProps(d, w) {
        let defs = window.apxSwPropDefs(d, w);
        return Object.keys(w.props || {}).filter(k => { let x = defs.find(o => o.def.key === k); return !x || !x.ok; })
            .map(k => { let def = (typeof WEAPON_PROPERTIES !== 'undefined' ? WEAPON_PROPERTIES : []).find(p => p.key === k); return { key: k, name: def ? def.name : k, req: def ? def.reqLabel : '' }; });
    }
    // XP its properties add: 10 each (Reach: 10 per square)
    window.apxSwXp = function (d) {
        return window.apxSwSlots(d).reduce((t, w) => t + Object.keys(w.props).reduce((s, k) => s + propN(w.props[k]), 0) * XP_PER_PROP, 0);
    };
    function diceOf(d) {
        let n = 0, size = null;
        DICE().forEach(st => { let c = parseInt((d.dmg || {})[st]) || 0; if (c > 0) { n += c; size = size || st; } });
        return { n, size, formula: DICE().filter(st => (parseInt((d.dmg || {})[st]) || 0) > 0).map(st => `${parseInt(d.dmg[st])}${st}`).join('+') };
    }
    // Problems that keep the power from being saved
    window.apxSwProblems = function (d, level) {
        let n = count(d); if (!n) return [];
        let out = [], dc = diceOf(d);
        if (d.isHealing) out.push('Summon a Weapon deals damage: untick "This power Heals" in Step 4.');
        else if (!dc.n) out.push('Summon a Weapon: buy its weapon\'s damage dice in Step 4.');
        if (dc.n > (level || 1)) out.push(`Summon a Weapon: its weapon can have at most 1 damage die per Power Level (Level ${level || 1}: ${level || 1} ${(level || 1) === 1 ? 'die' : 'dice'}). It has ${dc.n}: remove ${dc.n - (level || 1)} in Step 4.`);
        if (d.addAttrToDmg) out.push('Summon a Weapon already adds your Power Attribute modifier to its damage: untick "Add Power Attribute modifier" in Step 4.');
        window.apxSwSlots(d).forEach((w, i) => badProps(d, w).forEach(b => out.push(`Summon a Weapon${n > 1 ? ' #' + (i + 1) : ''}: ${b.name} needs ${b.req || 'something this weapon isn\'t'}. Remove it in Step 5.`)));
        return out;
    };
    function apOf(w) { return BASE_AP + ((w.props || {}).repeating ? 2 : 0); }   // (Repeating: +2 AP to fire)
    function propText(w) {
        return Object.keys(w.props || {}).map(k => {
            let def = (typeof WEAPON_PROPERTIES !== 'undefined' ? WEAPON_PROPERTIES : []).find(p => p.key === k);
            let nm = def ? def.name : k, v = w.props[k];
            return typeof v === 'number' && v > 1 ? `${nm} ${v}` : nm;
        }).join(', ');
    }
    function wName(w, i) { return w.name || (`Summoned ${w.category === 'ranged' ? 'Ranged' : 'Melee'} Weapon` + (i ? ' ' + (i + 1) : '')); }
    // One line for the power's description
    window.apxSwSummaryBits = function (d) {
        return window.apxSwSlots(d).map((w, i) => `Summons ${wName(w, i)} (Medium ${w.category === 'ranged' ? 'Ranged' : 'Melee'}, Trained; Power Attack and Step 4 damage + Power Attribute; ${apOf(w)} AP${propText(w) ? '; ' + propText(w) : ''})`);
    };
    // Its damage roll: Step 4's dice (split between two types if the power splits them), + mod on the first part
    function damageOf(d, mod) {
        let dc = diceOf(d), flat = d.addFlatDmgPerDie ? dc.n : 0, add = mod + flat;
        let split = window.apxDmgSplit ? window.apxDmgSplit(d) : null;
        if (split) {
            split = split.map(x => Object.assign({}, x));
            if (add) split[0].formula += (add > 0 ? '+' : '') + add;
            return { dice: split.map(x => x.formula).join('+'), dmgMod: 0, type: split.map(x => x.type).join(' + '), split, size: dc.size, n: dc.n };
        }
        return { dice: dc.formula || '0', dmgMod: add, type: d.dmgType || 'Force', split: null, size: dc.size, n: dc.n };
    }
    function hitMeta(w, i, dmg, extra) {
        let props = Object.keys(w.props || {}).filter(k => propN(w.props[k]) > 0);
        return Object.assign({ weapon: wName(w, i), props, die: '1d' + String(dmg.size || 'd6').replace(/^d/, ''), wpn: true, dmgType: dmg.type, ammo: null, summoned: true,
            elec: /Electric/.test(dmg.type || ''), range: w.category === 'ranged' ? ((w.props || {}).scatter ? '3-sq Cone' : RANGED_RANGE) : null }, extra || {});
    }

    // ── The Power Crafter: a row for each copy (its name, Melee or Ranged, and its properties) ──
    window.pcSwRowsHtml = function () {
        if (typeof pcDraft === 'undefined' || !pcDraft) return '';
        let d = pcDraft, slots = window.apxSwSlots(d), many = slots.length > 1, dc = diceOf(d);
        let npc = typeof pcIsNpc === 'function' && pcIsNpc();
        let price = (on, mut) => typeof pcCost === 'function' ? (on ? (typeof pcCostOn === 'function' ? pcCostOn('+' + XP_PER_PROP, mut) : XP_PER_PROP + ' XP') : pcCost('+' + XP_PER_PROP, mut)) : '+10 XP';
        return slots.map((w, i) => {
            let defs = window.apxSwPropDefs(d, w), bad = badProps(d, w).map(b => b.key);
            let chips = defs.map(o => {
                let k = o.def.key, on = o.n > 0, can = o.ok || on;
                let label = esc(o.def.name) + (o.max > 1 && o.n > 1 ? ' ' + o.n : '');
                let mutAdd = dd => { let s = window.apxSwSlots(dd); if (s[i]) { s[i].props[k] = o.max > 1 ? Math.min(o.max, o.n + 1) : true; dd.summonWeapons = s; } };
                let mutOff = dd => { let s = window.apxSwSlots(dd); if (s[i]) { delete s[i].props[k]; dd.summonWeapons = s; } };
                let tip = esc((o.def.desc || '') + (o.ok ? '' : ` (Needs: ${o.def.reqLabel || '—'})`));
                let cls = bad.includes(k) ? 'border-red-500 text-red-300 bg-red-950/50' : on ? 'border-blue-400 text-white bg-blue-800/70' : can ? 'border-slate-600 text-slate-300 bg-slate-900 hover:border-blue-400' : 'border-slate-800 text-slate-600 bg-slate-950 cursor-not-allowed';
                let more = o.max > 1 && on && o.n < o.max ? ` <span onclick="event.stopPropagation();window.pcSwProp(${i}, '${k}', 1)" class="text-blue-200 hover:text-white" title="Another square">+</span>` : '';
                return `<button type="button" data-pc-swprop="${k}" ${can ? `onclick="window.pcSwProp(${i}, '${k}', ${on ? -1 : 1})"` : 'disabled'} title="${tip}" class="text-[9px] px-1.5 py-0.5 rounded border ${cls}">${label} <span class="${on ? 'text-blue-200' : 'text-yellow-500'}">[${on ? price(true, mutOff) : price(false, mutAdd)}]</span>${more}</button>`;
            }).join('');
            return `
            <div class="bg-slate-950 border border-blue-700/60 rounded px-2 py-1.5 ml-3 text-[10px] text-blue-100 leading-tight" data-pc-swslot="${i}">
                <div class="flex flex-wrap items-center gap-1.5">
                    ${many ? `<b class="text-blue-300">#${i + 1}</b>` : ''}
                    <input type="text" value="${esc(w.name)}" maxlength="60" placeholder="${esc(wName(w, i))}" onchange="window.pcSwSet(${i}, { name: this.value })" class="flex-1 min-w-[8rem] bg-slate-900 border-slate-700 text-[10px] py-0.5 px-1">
                    <select onchange="window.pcSwSet(${i}, { category: this.value })" class="bg-slate-900 border-slate-700 text-[10px] py-0.5">
                        <option value="melee" ${w.category === 'melee' ? 'selected' : ''}>Melee</option>
                        <option value="ranged" ${w.category === 'ranged' ? 'selected' : ''}>Ranged (${RANGED_RANGE})</option>
                    </select>
                </div>
                <div class="text-slate-400 mt-1">Medium, Trained · attacks with ${npc ? 'its' : 'your'} Power Attack Bonus · ${dc.n ? esc(dc.formula) : '<span class="text-red-400">no dice yet (Step 4)</span>'}${d.addFlatDmgPerDie && dc.n ? ' + ' + dc.n : ''} + ${npc ? 'its' : 'your'} Power Attribute modifier ${esc(d.isHealing ? '' : d.dmgType || '')} · ${apOf(w)} AP${(w.props || {}).repeating ? ' (Repeating)' : ''}. Properties' saving throws use the Power Save DC.</div>
                <div class="text-[9px] text-slate-500 mt-1">Weapon Properties (+${XP_PER_PROP} XP each${npc ? ', in TP for NPCs' : ''}):</div>
                <div class="flex flex-wrap gap-1 mt-0.5">${chips}</div>
            </div>`;
        }).join('');
    };
    window.pcSwSet = function (i, patch) {
        if (typeof pcDraft === 'undefined' || !pcDraft) return;
        window.apxSwSet(pcDraft, i, patch);
        // Ranged ↔ Melee: properties it no longer qualifies for are dropped
        if (patch && patch.category) {
            let w = window.apxSwSlots(pcDraft)[i], defs = window.apxSwPropDefs(pcDraft, w);
            Object.keys(w.props).forEach(k => { let o = defs.find(x => x.def.key === k); if (!o || !o.ok) delete w.props[k]; });
            window.apxSwSet(pcDraft, i, { props: w.props });
        }
        if (typeof pcRenderAll === 'function') pcRenderAll();
    };
    window.pcSwProp = function (i, key, delta) {
        if (typeof pcDraft === 'undefined' || !pcDraft) return;
        let w = window.apxSwSlots(pcDraft)[i]; if (!w) return;
        let o = window.apxSwPropDefs(pcDraft, w).find(x => x.def.key === key);
        if (!o) { delete w.props[key]; }
        else if (delta > 0) { if (!o.ok) return; w.props[key] = o.max > 1 ? Math.min(o.max, o.n + 1) : true; }
        else {
            delete w.props[key];
            // An add-on goes with what it adds to (Returning with Thrown)
            window.apxSwPropDefs(pcDraft, Object.assign({}, w, { props: Object.assign({}, w.props, { [key]: true }) })).forEach(x => { if (x.def.addonOf === key) delete w.props[x.def.key]; });
        }
        window.apxSwSet(pcDraft, i, { props: w.props });
        if (typeof pcRenderAll === 'function') pcRenderAll();
    };
    // A note at the top of Step 4 while the power summons a weapon
    window.pcSwStep4Note = function (level) {
        if (typeof pcDraft === 'undefined' || !pcDraft || !count(pcDraft)) return '';
        let dc = diceOf(pcDraft), max = level || 1, over = dc.n > max;
        return `<div class="bg-blue-950/60 border ${over ? 'border-red-500' : 'border-blue-700'} rounded p-2 text-[10px] ${over ? 'text-red-300' : 'text-blue-100'} leading-tight" data-pc-swnote>
            <b>Summon a Weapon:</b> these dice are the summoned weapon's damage, rolled when it attacks (not when the power is used), plus the Power Attribute modifier. Up to 1 die per Power Level: <b>${max}</b> at Level ${max}${over ? ` (it has ${dc.n})` : ''}.</div>`;
    };

    // ── On your sheet: summoning, the rows in Weapons & Attacks, and when they fade ──
    const DUR_TURNS = { instant: 2, '1min': 10, channel: 10 };   // your turns it lasts into (Instant: through your next turn)
    const DUR_TEXT = { instant: 'until the end of your next turn', '1min': '1 minute', '10min': '10 minutes', '1hr': '1 hour', '8hr': '8 hours', '24hr': '24 hours', channel: 'up to 1 minute', permanent: 'until it\'s dispelled' };
    // Using the power: its weapons appear (using it again replaces the ones it summoned before)
    window.apxSwSummon = function (key, p, chosen) {
        let st = window.state; if (!st || !p || !p.draft || !count(p.draft)) return [];
        let d = JSON.parse(JSON.stringify(p.draft));
        if (chosen) Object.assign(d, chosen);   // (a damage type chosen on use)
        let snap = { dmg: d.dmg, dmgType: d.dmgType, secondDmgType: d.secondDmgType, addSecondType: d.addSecondType, secondSplit: d.secondSplit, secondDice: d.secondDice, addFlatDmgPerDie: d.addFlatDmgPerDie, coreAttr: d.coreAttr };
        let ct = window._pwCombatTurn, inFight = !!window._pwCombatCode;
        st.summonedWeapons = (st.summonedWeapons || []).filter(e => e.key !== String(key));
        let made = window.apxSwSlots(d).map((w, i) => ({
            id: 'sw' + Date.now().toString(36) + i + Math.random().toString(36).slice(2, 5), key: String(key), slot: i, power: p.name || 'Power',
            attr: p.attr || null, w, d: snap, dur: d.duration || 'instant', left: inFight && DUR_TURNS[d.duration || 'instant'] ? DUR_TURNS[d.duration || 'instant'] : null,
            round: ct && ct.round || null
        }));
        st.summonedWeapons = st.summonedWeapons.concat(made);
        return made.map(e => wName(e.w, e.slot));
    };
    // Block: a summoned Sturdy (or Parrying) weapon blocks with one of its damage dice
    window.apxSwBlockOptions = function (st) {
        return ((st && st.summonedWeapons) || []).filter(e => e.w && e.w.props && (e.w.props.sturdy || e.w.props.parrying))
            .map(e => ({ name: wName(e.w, e.slot), dmg: '1' + (diceOf(e.d).size || 'd6'), parry: !e.w.props.sturdy }));
    };
    window.apxSwDismiss = function (id) {
        let st = window.state; if (!st || !st.summonedWeapons) return;
        let e = st.summonedWeapons.find(x => x.id === id);
        st.summonedWeapons = st.summonedWeapons.filter(x => x.id !== id);
        if (!st.summonedWeapons.length) delete st.summonedWeapons;
        if (e) window.APXDice?.notify(`${wName(e.w, e.slot)} fades away.`, { kind: 'note' });
        window.recalculateMath?.(); window.scheduleAutoSave?.();
    };
    // Its power is over (you ended it, its time ran out, or a rest outlasted it): its weapons fade. which(entry) picks them.
    window.apxSwFade = function (which, why) {
        let st = window.state, list = (st && st.summonedWeapons) || [];
        let gone = list.filter(which); if (!gone.length) return;
        st.summonedWeapons = list.filter(e => !gone.includes(e));
        if (!st.summonedWeapons.length) delete st.summonedWeapons;
        window.APXDice?.notify(`${gone.map(e => wName(e.w, e.slot)).join(' and ')} ${gone.length > 1 ? 'fade' : 'fades'} away${why ? ` (${why})` : ''}.`, { kind: 'note' });
        setTimeout(() => { window.recalculateMath?.(); window.scheduleAutoSave?.(); }, 0);
    };
    // A rest: the ones whose power wouldn't last that long (an Instant one, or out of a fight, a 1 Minute one) are gone
    window.apxSwRestFade = function (hours, why) {
        window.apxSwFade(e => (window.apxDurOverAfter ? window.apxDurOverAfter(e.dur, hours) : e.dur !== 'permanent'), why);
    };
    // Your turn starts: Instant ones last through your next turn, 1 Minute ones 10 rounds
    (function hook(tries) {
        let orig = window.apxResetAp;
        if (typeof orig !== 'function') { if ((tries || 0) < 50) setTimeout(() => hook((tries || 0) + 1), 200); return; }
        if (orig._apxSw) return;
        let w = function () {
            let r = orig.apply(this, arguments);
            let st = window.state, list = st && st.summonedWeapons;
            if (list && list.length) {
                let gone = [];
                list.forEach(e => { if (e.left != null) { e.left -= 1; if (e.left <= 0) gone.push(e); } });
                if (gone.length) {
                    st.summonedWeapons = list.filter(e => !gone.includes(e));
                    if (!st.summonedWeapons.length) delete st.summonedWeapons;
                    window.APXDice?.notify(`${gone.map(e => wName(e.w, e.slot)).join(' and ')} ${gone.length > 1 ? 'fade' : 'fades'} away (its power's duration is over).`, { kind: 'note' });
                    setTimeout(() => { window.recalculateMath?.(); window.scheduleAutoSave?.(); }, 0);
                }
            }
            return r;
        };
        Object.keys(orig).forEach(k => { w[k] = orig[k]; });
        w._apxSw = true; window.apxResetAp = w;
    })(0);
    // The rows under your weapons (called by the sheet's Weapons & Attacks): attack with the Power Attack Bonus
    window.apxSwSheetRows = function () {
        let st = window.state, list = (st && st.summonedWeapons) || [];
        if (!list.length || typeof calc === 'undefined' || !window.apxPowerNums || !window.apxRollAttr) return '';
        return list.map(e => {
            let w = norm(e.w), cat = w.category;
            let pn = window.apxPowerNums({ name: e.power, attr: e.attr, draft: e.d });
            let dmg = damageOf(e.d, pn.mod || 0);
            let exf = window.apxExoPowerFx ? window.apxExoPowerFx(dmg.type) : null;   // (a Conduit's Breach, Nullifier, Amplifier)
            let hit = hitMeta(w, e.slot, dmg, Object.assign({ strMod: calc.mods.STR || 0, intMod: calc.mods.INT || 0, propDc: pn.dc }, exf ? { breach: exf.breach, nullify: exf.nullify || undefined } : {}));
            let dis = calc.disadv.atkGeneral.concat(cat === 'melee' ? calc.disadv.atkMelee : (calc.disadv.atkNotMelee || []));
            let adv = (calc.disadv.atkAdv || []).concat(cat === 'ranged' ? calc.disadv.atkRangedAdv : (calc.disadv.atkMeleeAdv || []));
            let critMult = 2 + (((st.perks || {}).luc_fortunatefighter || 0) >= 4 ? 1 : 0);
            let ap = apOf(w), name = wName(w, e.slot);
            let o = { type: 'attack', label: name, bonus: pn.atk, dice: dmg.dice, dmgMod: dmg.dmgMod, critMult, dmgType: dmg.type, disSources: dis, advSources: adv, pcAttack: true, wcat: cat,
                apCost: ap, ranged: cat === 'ranged', hit, split: dmg.split || undefined, maxDmg: exf && exf.max ? exf.max : undefined };
            (calc.weaponAttacks = calc.weaponAttacks || []).push({ key: name + '|sw', label: name, bonus: pn.atk, disSources: dis, advSources: adv, wcat: cat, dice: dmg.dice, dmgMod: dmg.dmgMod, dmgType: dmg.type, critMult, hit, ap });
            // (Composite Form, condensed: no weapons, a summoned one included)
            const FORM_MSG = 'In your condensed form (Composite Form) you can\'t wield weapons: only unarmed attacks. Return to your standard form (3 AP, in Actions) first.';
            let blocked = calc.cantAct ? ` data-no-roll data-apx-blocked="${calc.cantActLabel}" title="You're ${calc.cantActLabel} and can't attack until that ends"`
                : calc.condensed ? ` data-no-roll data-apx-blocked="condensed" data-apx-blocked-msg="${FORM_MSG}" title="${FORM_MSG}"` : '';
            let atkAttr = blocked || window.apxRollAttr(o);
            let dmgAttr = blocked || window.apxRollAttr({ type: 'damage', label: name + ' damage', formula: dmg.dice + (dmg.dmgMod ? (dmg.dmgMod > 0 ? '+' : '') + dmg.dmgMod : ''), dmgType: dmg.type, wcat: cat, split: dmg.split || undefined, maxDmg: exf && exf.max ? exf.max : undefined });
            let dmgText = dmg.dice + (dmg.dmgMod ? ` ${dmg.dmgMod > 0 ? '+' : '-'} ${Math.abs(dmg.dmgMod)}` : '');
            let lasts = e.left != null ? `${e.left} more turn${e.left === 1 ? '' : 's'}` : (DUR_TEXT[e.dur] || '');
            let disHtml = calc.cantAct ? `<span class="text-[8px] text-red-500 font-black block -mt-1 leading-none">(${calc.cantActLabel})</span>`
                : calc.condensed ? `<span class="text-[8px] text-amber-400 font-black block -mt-1 leading-none" title="${FORM_MSG}">(Condensed)</span>`
                : dis.length ? `<span class="text-[8px] text-red-400 block -mt-1 leading-none" title="${esc(dis.join(', '))}">(Disadv)</span>` : adv.length ? `<span class="text-[8px] text-emerald-400 block -mt-1 leading-none" title="${esc(adv.join(', '))}">(Adv)</span>` : '';
            return `
                <tr class="bg-blue-950/40" data-sw-row="${esc(e.id)}">
                    <td class="px-1 py-2">
                        <div class="text-xs font-bold text-blue-200">${esc(name)}</div>
                    </td>
                    <td class="px-1 py-2 text-center text-[10px] text-slate-300 font-bold" title="Your Power Attribute: attacks use your Power Attack Bonus">${esc(pn.attr)}</td>
                    <td class="px-1 py-2 text-center"><input type="checkbox" checked disabled class="w-4 h-4 opacity-60" title="You're Trained with a summoned weapon"></td>
                    <td class="px-1 py-2 text-center">
                        <div class="font-black text-emerald-400 text-sm bg-slate-900 rounded border border-blue-700 py-0.5 apx-rollable" title="Roll attack + damage (Power Attack Bonus)"${atkAttr}>${pn.atk >= 0 ? '+' + pn.atk : pn.atk}</div>
                        ${disHtml}
                    </td>
                    <td class="px-1 py-2 text-center text-[11px] text-slate-300 font-bold apx-rollable" title="Roll damage only"${dmgAttr}>${esc(dmgText)}</td>
                    <td class="px-1 py-2"><div class="text-xs font-bold text-blue-400 text-center p-1 h-7 flex items-center justify-center" title="A summoned weapon's attacks cost ${BASE_AP} AP${ap > BASE_AP ? ' (Repeating +2)' : ''}">${ap}</div></td>
                    <td class="px-1 py-2 text-center"><button onclick="window.apxSwDismiss('${esc(e.id)}')" class="text-[9px] text-red-400 hover:text-red-300 font-bold" title="Dismiss it (the power ends)">Dismiss</button></td>
                </tr>
                <tr class="bg-blue-950/40 border-b border-blue-800/50" data-sw-info="${esc(e.id)}">
                    <td colspan="7" class="px-1 pb-2 pt-0 text-[9px] text-slate-400 leading-tight" style="white-space:normal;overflow-wrap:anywhere">Summoned by ${esc(e.power)} · Medium ${cat === 'ranged' ? 'Ranged (' + esc(hit.range) + ')' : 'Melee'} · ${esc(dmg.type)}${propText(w) ? ' · ' + esc(propText(w)) : ''}${lasts ? ' · lasts ' + esc(lasts) : ''}</td>
                </tr>`;
        }).join('');
    };

    // ── NPC stat blocks: the weapons, under the power (the GM rolls them while it's summoned) ──
    window.apxSwNpcHtml = function (p, sb) {
        let d = p && p.draft; if (!d || !count(d) || !sb || !window.APXDice) return '';
        let mod = (sb.mods || {})[sb.powerAttrChoice] || 0, bonus = sb.powerAttackBonus || 0;
        let flags = sb._isCompanion ? { omen: true, companion: true, compOwner: sb._compOwner || null } : { npcId: sb._npcId || undefined, initId: sb._initId || undefined };
        let dmg = damageOf(d, mod);
        return window.apxSwSlots(d).map((w, i) => {
            let name = wName(w, i), ap = apOf(w);
            let hit = hitMeta(w, i, dmg, { strMod: (sb.mods || {}).STR || 0, intMod: (sb.mods || {}).INT || 0, propDc: sb.powerSaveDc, tier: sb.tier || 0 });
            let attr = ` data-apx-roll='${window.APXDice.attr(Object.assign({ who: sb.name, perks: false, gambleAllowed: false }, flags, { type: 'attack', label: name, bonus, dice: dmg.dice, dmgMod: dmg.dmgMod, critMult: 2, dmgType: dmg.type, hit, split: dmg.split || undefined, apCost: ap }))}' title="Roll its attack (while it's summoned)"`;
            let dmgText = dmg.dice + (dmg.dmgMod ? (dmg.dmgMod > 0 ? '+' : '') + dmg.dmgMod : '');
            return `<div class="text-[9px] text-blue-200 mb-0.5" data-sw-npc="${i}">⚔ Summons <b>${esc(name)}</b> (Medium ${w.category === 'ranged' ? 'Ranged ' + esc(hit.range) : 'Melee'}${propText(w) ? ', ' + esc(propText(w)) : ''}): <span class="apxd-atk underline decoration-dotted cursor-pointer"${attr}>${bonus >= 0 ? '+' : ''}${bonus}, ${esc(dmgText)} ${esc(dmg.type)}</span>, ${ap} AP</div>`;
        }).join('');
    };
})();
