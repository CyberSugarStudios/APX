// ============================================================
// APX Exo-Suits (Rulebook Chapter 11: Vehicles & Mounts → Exo-Suits, The Exo-Suit Forge)
// ============================================================
// A suit is bought (3,000 Currency) as a Juggernaut, a Phantom or a Conduit, is worn with your armor, and
// holds up to 3 Integrated Systems from its framework's list. While it's worn and powered it changes the
// sheet (js/apx-engine.js asks apxExoActive). A System Overload (a Critical Hit, or one hit over your Wound
// Threshold) shuts it down until a 6 AP System Reboot.
//   state.exoSuit = { frame: 'juggernaut'|'phantom'|'conduit', name, systems: [ids installed], owned: [ids ever bought],
//                     paidCost, worn, overloaded, camoUsed, bulwarkUsed }
//   A Breach system is stored with its Energy type: 'breach:Fire' (it can be taken more than once).
// Only offered when the GM's World Settings allow Exo-Suits (characters outside a world always can).
// ============================================================
(function () {
    'use strict';

    const EXO = {
        base: 3000, maxSystems: 3,
        frames: {
            juggernaut: {
                name: 'Juggernaut', attr: 'STR', skill: 'Athletics', attrPlus: 4, attrMax: 16,
                blurb: 'Raw power and front-line siege warfare: a walking tank (a hollowed-out golem, a steampunk gear-hulk, an armored cybernetic exoskeleton).',
                features: ['STR +4 (to a maximum of 16)', 'Advantage on STR (Athletics) checks', 'Speed is set to 4', 'Your Size increases by one step',
                    'Standard Plating: AC and WT +5, DR and ER +2']
            },
            phantom: {
                name: 'Phantom', attr: 'AGI', skill: 'Stealth', attrPlus: 4, attrMax: 16,
                blurb: 'Infiltration and mobility: a skin-tight second layer (a shadow-weave garment, a bio-organic carapace, an optical-camouflage stealth suit). No Plating: your armor is your protection.',
                features: ['AGI +4 (to a maximum of 16)', 'Advantage on AGI (Stealth) checks', 'Speed +1 square',
                    'Active Camouflage: at the start of your turn, spend 2 AP to become Invisible until the start of your next turn (uses per Short Rest: your AGI modifier, minimum once)']
            },
            conduit: {
                name: 'Conduit',
                blurb: 'A frame built around the Powers you wield, focusing and amplifying them (a rune-etched harness, a resonance amplifier rig, a psionic focusing lattice). Overloading it also ends your Concentration Powers.',
                features: ['Power Attack Bonus and Save DC +2', '+5 ER',
                    'Long Rest Powers: one more Long Rest Power Slot, of a Level below your highest Power Level', 'Short Rest Powers: one more Short Rest Power Slot']
            }
        },
        systems: {
            juggernaut: [
                { id: 'assault', name: 'Assault Plating', cost: 2000, plating: { ac: 7, dr: 4, er: 4, wt: 7 }, speed: 3, desc: 'Heavy, militarized armor bolted to the frame (replacing all other Plating): AC and WT +7, DR and ER +4, and your Speed is set to 3.' },
                { id: 'dreadnought', name: 'Dreadnought Plating', cost: 6000, plating: { ac: 9, dr: 6, er: 6, wt: 9 }, speed: 2, desc: 'Massive, lumbering armor (replacing all other Plating): AC and WT +9, DR and ER +6, and your Speed is set to 2.' },
                { id: 'powerful', name: 'Powerful', cost: 1000, desc: 'Overclocks the frame\'s lifting power: your STR score increases by an additional 2, to a maximum of 18.' },
                { id: 'forceMult', name: 'Force Multipliers', cost: 1500, desc: 'Add your STR modifier twice to all melee weapon damage rolls.' },
                { id: 'bulwark', name: 'Bulwark', cost: 2500, desc: 'Spend 2 AP to gain Temporary Hit Points equal to your AC. You can do this a number of times equal to your STR modifier (minimum once); the uses come back on a Short Rest.' },
                { id: 'impactors', name: 'Kinetic Impactors', cost: 1500, legacy: true, desc: 'Your unarmed strikes deal 2d8 Bludgeoning damage and gain the Crushing Property. (No longer sold: kept on suits that have it.)' },
                { id: 'heavyMount', name: 'Heavy Weapon Mount', cost: 1500, desc: 'A Heavy weapon mounted in the shoulder or forearm: your hands stay free, and it can\'t be disarmed.' },
                { id: 'hermetic', name: 'Hermetic Seal', cost: 1000, desc: 'Immune to airborne toxins, diseases, and the vacuum of space or underwater environments.' }
            ],
            phantom: [
                { id: 'mirage', name: 'Mirage Weave', cost: 1500, desc: 'Double the uses of Active Camouflage per Short Rest.' },
                { id: 'climb', name: 'Climbing Grips', cost: 1500, desc: 'A Climb speed equal to your walking speed; hang upside down from ceilings with your hands free.' },
                { id: 'concealed', name: 'Concealed Weapon Mount', cost: 1000, desc: 'A Light weapon hidden in the forearm or leg: invisible to casual inspection, can\'t be disarmed, has the Concealed property.' },
                { id: 'decoy', name: 'Decoy', cost: 2000, desc: 'Using Active Camouflage can leave a perfect illusion of you in your square (destroyed by any damage). For 3 AP, swap places with it within 15 squares, destroying it and ending Active Camouflage.' },
                { id: 'injector', name: 'Auto-Injector', cost: 1000, desc: 'Stores up to 3 crafted Consumables: trigger one for 1 AP instead of 3 AP.' },
                { id: 'flight', name: 'Flight Module', cost: 2000, desc: 'A glider, wings or micro-thrusters: a Fly Speed equal to your walking speed.' }
            ],
            conduit: [
                { id: 'capacitor', name: 'Capacitor', cost: 3000, desc: 'Another +2 to your Power Attack Bonus and Save DC.' },
                { id: 'breach', name: 'Breach', cost: 2500, typed: true, desc: 'Choose an Energy damage type: your Powers ignore a target\'s Resistance to it, and you gain +5 ER against it. Take it again for another type.' },
                { id: 'nullifier', name: 'Nullifier', cost: 5000, req: 'breach', desc: 'Requires Breach. Your Powers treat Immunity as Resistance against your Breach types.' },
                { id: 'amplifier', name: 'Amplifier', cost: 5000, req: 'nullifier', desc: 'Requires Nullifier. Whenever you would roll for damage with a Power that deals Energy damage of your chosen type from Breach, you may spend an additional 3 AP to deal maximum damage instead.' },
                { id: 'emitter', name: 'Emitter', cost: 1500, desc: 'Your ranged Powers reach 10 squares farther, and your Touch Powers have a range of 3 squares.' }
            ]
        }
    };
    window.APX_EXO = EXO;
    // 'breach:Fire' → the Breach system (its type after the colon)
    const baseId = id => String(id || '').split(':')[0];
    const typeOf = id => String(id || '').split(':')[1] || '';
    const sysDef = (frame, id) => (EXO.systems[frame] || []).find(s => s.id === baseId(id));
    const sysName = (frame, id) => { let s = sysDef(frame, id); return s ? s.name + (s.typed && typeOf(id) ? ` (${typeOf(id)})` : '') : id; };
    const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const ENERGY = () => (window.APXDamage && window.APXDamage.ENERGY ? (typeof window.APXDamage.ENERGY === 'function' ? window.APXDamage.ENERGY() : window.APXDamage.ENERGY) : ['Fire', 'Cold', 'Electric', 'Acid', 'Poison', 'Sonic', 'Radiation', 'Force', 'Psychic']);

    // Are Exo-Suits allowed for this character? (the GM's World Settings; outside a world, yes)
    window.apxExoAllowed = function () {
        let ws = typeof window.apxActiveWorldSettings === 'function' ? window.apxActiveWorldSettings() : null;
        return !ws || !!ws.allowExoSuits;
    };

    // What a worn suit does right now (null when there's no suit, it's off, or it has overloaded)
    window.apxExoActive = function (st) {
        let x = st && st.exoSuit;
        if (!x || !x.frame || !x.worn || x.overloaded) return null;
        // On the sheet, a suit does nothing while the GM's World Settings don't allow Exo-Suits
        if (st === window.state && typeof window.apxActiveWorldSettings === 'function' && !window.apxExoAllowed()) return null;
        let f = EXO.frames[x.frame]; if (!f) return null;
        let ids = (x.systems || []).filter(id => sysDef(x.frame, id));
        let sys = new Set(ids.map(baseId));
        let out = { frame: x.frame, name: x.name || ('Exo-Suit (' + f.name + ')'), sys, attr: f.attr || null, attrPlus: f.attrPlus || 0, attrMax: f.attrMax || 0, skill: f.skill || null };
        if (x.frame === 'juggernaut') {
            if (sys.has('powerful')) { out.attrPlus += 2; out.attrMax = 18; }
            let pl = sys.has('dreadnought') ? sysDef('juggernaut', 'dreadnought') : sys.has('assault') ? sysDef('juggernaut', 'assault') : null;
            out.plating = pl ? pl.plating : { ac: 5, dr: 2, er: 2, wt: 5 };   // added to your own defenses
            out.platingName = pl ? pl.name : 'Standard Plating';
            out.speedFixed = pl ? pl.speed : 4;
            out.sizeUp = true;
        } else if (x.frame === 'phantom') {
            out.speedPlus = 1;
            if (sys.has('flight')) out.fly = true;
            if (sys.has('climb')) out.climb = true;
        } else if (x.frame === 'conduit') {
            out.power = sys.has('capacitor') ? 4 : 2;   // Power Attack Bonus and Save DC
            out.er = 5;
            out.extraSlot = true;
            out.breach = [...new Set(ids.filter(id => baseId(id) === 'breach').map(typeOf).filter(Boolean))];
            out.nullifier = sys.has('nullifier') && out.breach.length > 0;
            out.amplifier = sys.has('amplifier') && out.nullifier;
            out.emitter = sys.has('emitter');
        }
        return out;
    };
    // An attribute score in the suit: +N, to the suit's maximum (never lower than it already is)
    window.apxExoScore = function (score, exo) {
        if (!exo || !exo.attr) return score;
        return Math.max(score, Math.min(score + (exo.attrPlus || 0), exo.attrMax || 0));
    };
    // A deactivated Juggernaut (its Plating) with STR 16 or less: Overburdened (Speed 1, moving costs double AP)
    window.apxExoOverburdened = function (st, strScore) {
        let x = st && st.exoSuit;
        return !!(x && x.worn && x.overloaded && x.frame === 'juggernaut' && strScore <= 16);
    };
    // Active Camouflage uses per Short Rest
    window.apxExoCamoMax = function (st, agiMod) {
        let x = st && st.exoSuit; if (!x || x.frame !== 'phantom') return 0;
        return Math.max(1, agiMod || 0) * ((x.systems || []).includes('mirage') ? 2 : 1);
    };
    // Bulwark uses per Short Rest (your STR modifier, minimum once)
    window.apxExoBulwarkMax = function (st, strMod) {
        let x = st && st.exoSuit; if (!x || x.frame !== 'juggernaut' || !(x.systems || []).includes('bulwark')) return 0;
        return Math.max(1, strMod || 0);
    };
    // A Conduit's effect on a Power: { breach: [types it ignores Resistance to], nullify, hits: [its Breach types this power
    // deals], amp (Amplifier can max it, for 3 more AP), note: the roller's line, max: '' (set once Amplifier's AP is paid) }
    // (dmgType: the power's damage type text, e.g. "Fire" or "Fire + Cold")
    window.apxExoPowerFx = function (dmgType) {
        let ex = window.apxExoActive(window.state);
        if (!ex || ex.frame !== 'conduit' || !ex.breach || !ex.breach.length) return null;
        let types = window.APXDamage && window.APXDamage.parts ? window.APXDamage.parts(dmgType || '') : String(dmgType || '').split(/[^A-Za-z]+/).filter(Boolean);
        let hits = ex.breach.filter(t => types.includes(t));
        return { breach: ex.breach.slice(), nullify: !!ex.nullifier, hits, amp: !!(ex.amplifier && hits.length), max: '',
            note: hits.length ? `Breach (Exo-Suit): ignores the target's Resistance to ${hits.join(' and ')}${ex.nullifier ? ', and treats Immunity to it as Resistance (Nullifier)' : ''}` : '' };
    };
    // Amplifier: as the damage is about to be rolled, spend 3 more AP for maximum damage? → the roller's line, or ''
    window.apxExoAmplify = async function (exf, name) {
        if (!exf || !exf.amp || !window.APXDice || !APXDice.ask) return '';
        let have = window.apxApCurrent ? window.apxApCurrent() : 0, t = exf.hits.join(' and ');
        let a = await APXDice.ask('Amplifier', `${name || 'This power'} deals ${t} damage (your Breach). Spend 3 more AP to deal maximum damage instead of rolling? You have ${have} AP.`,
            have >= 3 ? [['max', 'Spend 3 AP: maximum damage', 'pri'], ['roll', 'Roll it']] : [['roll', 'Roll it', 'pri'], ['max', 'Spend 3 AP anyway']]);
        if (a !== 'max') return '';
        if (window.apxSpendAp) window.apxSpendAp(Math.min(3, have));
        return `Amplifier (${t}): 3 AP spent, maximum damage`;
    };
    // A Conduit's Emitter: ranged Powers +10 squares, Touch Powers 3 squares (range in squares; 0 = Touch/Self)
    window.apxExoRange = function (range) {
        let ex = window.apxExoActive(window.state);
        if (!ex || !ex.emitter || range == null || !isFinite(range)) return range;
        return range <= 0 ? 3 : range + 10;
    };
    window.apxExoRangeNote = function (p) {
        let ex = window.apxExoActive(window.state);
        if (!ex || !ex.emitter || !p || !p.draft || !window.apxPowerRange) return '';
        let R = window.apxPowerRange(p.draft);
        if (R.sq == null || !isFinite(R.sq)) return '';
        return ` <span class="text-fuchsia-300" title="Your Exo-Suit's Emitter">(Emitter: ${R.sq <= 0 ? 'range 3 sq' : `${R.sq + 10} sq`})</span>`;
    };

    // ── On the sheet: its equipment slot (beside Shield and Helmet) and, while you're in it, a banner at the
    //    top of Armor & Defenses with what it's doing; the numbers it replaces are marked ──
    let _btn = (cls, txt, on, tip, dis) => `<button ${dis ? 'disabled' : ''} onclick="${on}" title="${esc(tip || '')}" class="${cls} text-[10px] px-2 py-1 rounded border transition font-bold ${dis ? 'opacity-40 cursor-not-allowed' : ''}">${txt}</button>`;
    const B_CYAN = 'bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/40 border-cyan-700/50';
    const B_FUCH = 'bg-fuchsia-600/20 text-fuchsia-300 hover:bg-fuchsia-600/40 border-fuchsia-700/50';
    const B_RED = 'bg-red-600/20 text-red-400 hover:bg-red-600/40 border-red-700/50';
    const B_GRN = 'bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/40 border-emerald-700/50';
    const B_IND = 'bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/40 border-indigo-700/50';
    function _mark(id, on, tip) {
        let el = document.getElementById(id); if (!el) return;
        let box = id === 'dispWt' ? el : el.parentElement;
        if (on) { box.style.boxShadow = '0 0 0 2px rgba(217,70,239,.75)'; box.setAttribute('data-exo-tip', '1'); box.title = tip; }
        else if (box.getAttribute('data-exo-tip')) { box.style.boxShadow = ''; box.removeAttribute('data-exo-tip'); box.title = ''; }
    }
    // The sheet's numbers (calc lives in js/apx-state.js)
    const C = () => { try { return (typeof calc !== 'undefined' && calc) || {}; } catch (e) { return {}; } };
    window.apxRenderExo = function () {
        let tile = document.getElementById('exoControl'), slots = document.getElementById('equipSlots'), vb = document.getElementById('exoVitalsBtn');
        if (!tile) return;
        let st = window.state, x = st && st.exoSuit, allowed = window.apxExoAllowed(), c = C();
        let act = window.apxExoActive(st), f = x ? (EXO.frames[x.frame] || {}) : {};
        // The slot: shown when suits are allowed here, or one is owned
        let show = !!x || allowed;
        tile.classList.toggle('hidden', !show);
        if (slots) { slots.classList.toggle('grid-cols-3', show); slots.classList.toggle('grid-cols-2', !show); }
        if (show) {
            let status = !x ? 'None'
                : !allowed ? '<span class="text-amber-300">Not allowed in this world</span>'
                : !x.worn ? `${esc(f.name)} · <span class="text-slate-400">Stowed</span>`
                : x.overloaded ? `${esc(f.name)} · <span class="text-red-400 font-bold">Overloaded</span>`
                : `${esc(f.name)} · <span class="text-emerald-400 font-bold">Powered</span>`;
            // Click EXO-SUIT (or its name) for everything the suit does
            tile.innerHTML = `<div ${x ? 'onclick="window.apxExoDetails()" role="button" title="What your Exo-Suit does: click for its details" style="cursor:pointer"' : 'data-tip="A piloted suit worn with your armor (Rulebook Chapter 11): a Juggernaut, a Phantom or a Conduit, with up to 3 Integrated Systems"'}>
                    <div class="text-[9px] text-fuchsia-300/80 uppercase font-bold mb-1 ${x ? 'underline decoration-dotted underline-offset-2 hover:text-fuchsia-200' : ''}">Exo-Suit</div>
                    ${x ? `<div class="text-[10px] font-bold text-fuchsia-200 truncate hover:text-white">${esc(x.name || 'Exo-Suit')}</div>` : ''}
                    <div class="text-[10px] text-slate-400 mb-1">${status}</div></div>
                <div class="flex flex-col gap-1">${!x
                    ? _btn('w-full whitespace-nowrap ' + B_FUCH, 'Exo-Suit Forge', 'window.openExoForge()', 'Build a Juggernaut, Phantom or Conduit suit (3,000 Currency)')
                    : (allowed ? _btn('w-full whitespace-nowrap ' + B_CYAN, x.worn ? 'Leave Suit' : 'Enter Suit', 'window.apxExoWear()', 'Getting in or out takes 1 minute' + (x.frame === 'juggernaut' ? ' (6 AP in combat)' : '')) : '')
                      + _btn('w-full whitespace-nowrap ' + B_FUCH, allowed ? 'Forge' : 'Scrap…', 'window.openExoForge()', allowed ? 'Change its systems or name, or scrap it' : 'Your GM has turned Exo-Suits off for this world: it does nothing here')
                      + exoUseBtns(st, x, act, c, 'w-full whitespace-nowrap ')}</div>`;
        } else tile.innerHTML = '';
        // Vitals: Overload Exo-Suit while it's powered (System Reboot once it has overloaded)
        if (vb) {
            let on = !!(x && x.worn && allowed);
            vb.classList.toggle('hidden', !on);
            if (on) {
                vb.textContent = x.overloaded ? 'Reboot Exo-Suit (6 AP)' : 'Overload Exo-Suit';
                vb.title = x.overloaded ? 'System Reboot: bring the suit back online' : 'A Critical Hit, or one hit over your Wound Threshold (caught automatically when you take damage), overloads the Power Core: the suit shuts down until a System Reboot (6 AP)';
                vb.style.borderColor = x.overloaded ? 'var(--c-emerald,#059669)' : '#dc2626';
                vb.style.color = x.overloaded ? 'var(--c-emerald-lt,#6ee7b7)' : '#fca5a5';
                vb.onclick = () => x.overloaded ? window.apxExoReboot() : window.apxExoOverload();
            }
        }
        document.getElementById('apxExoDetails') && window.apxExoDetails(true);   // keep an open pop-up current
        // The numbers the suit changes, marked (its Plating adds to your own defenses)
        let pl = act && act.plating, nm = x ? (x.name || 'your Exo-Suit') : '';
        _mark('dispAc', !!pl, pl ? `Includes +${pl.ac} AC from ${nm} (${act.platingName})` : '');
        _mark('dispDr', !!pl, pl ? `Includes +${pl.dr} DR from ${nm} (${act.platingName})` : '');
        _mark('dispEr', !!(pl || (act && act.er)), pl ? `Includes +${pl.er} ER from ${nm} (${act.platingName})` : act && act.er ? `Includes +${act.er} ER from ${nm} (Conduit)` : '');
        _mark('dispWt', !!pl, pl ? `Includes +${pl.wt} WT from ${nm} (${act.platingName})` : '');
        let acc = document.getElementById('dispAcCalc');
        if (acc && pl && !/Plating/.test(acc.innerText)) acc.innerText = `${acc.innerText} + ${act.platingName} ${pl.ac}`;
        _mark('dispSpeed', !!(act && (act.speedFixed || act.speedPlus)), act ? `${nm}: ${act.speedFixed ? 'Speed set to ' + act.speedFixed : 'Speed +1'}` : '');
    };
    // The suit's details: what it does right now, its systems, and its buttons (click EXO-SUIT in its slot)
    window.apxExoDetails = function (refresh) {
        let st = window.state, x = st && st.exoSuit, old = document.getElementById('apxExoDetails');
        if (!x) { if (old) old.remove(); return; }
        if (refresh && !old) return;
        let c = C(), f = EXO.frames[x.frame] || {}, act = window.apxExoActive(st), allowed = window.apxExoAllowed();
        let sys = (x.systems || []).filter(id => sysDef(x.frame, id)).map(id => Object.assign({}, sysDef(x.frame, id), { name: sysName(x.frame, id) }));
        let state = !allowed ? ['Not allowed in this world: it does nothing here', '#fcd34d'] : !x.worn ? ['Stowed: Enter Suit to power it up', '#94a3b8'] : x.overloaded ? ['Overloaded: shut down until a System Reboot (6 AP)', '#f87171'] : ['Powered', '#4ade80'];
        let now = [];
        if (act) {
            if (act.attr) now.push(`${act.attr} +${act.attrPlus} (to a maximum of ${act.attrMax}): ${act.attr} ${(c.scores || {})[act.attr] || '?'} now`, `Advantage on ${act.attr} (${act.skill}) checks`);
            if (act.speedFixed) now.push(`Speed is set to ${act.speedFixed}`); if (act.speedPlus) now.push('Speed +1 square');
            if (act.sizeUp) now.push('One Size larger');
            if (act.plating) now.push(`${act.platingName}: AC and WT +${act.plating.ac}, DR and ER +${act.plating.dr} (added to your own)`);
            if (act.climb) now.push('Climb Speed equal to your walking speed'); if (act.fly) now.push('Fly Speed equal to your walking speed');
            if (act.power) now.push(`Power Attack Bonus and Save DC +${act.power}`);
            if (act.er) now.push(`ER +${act.er}`);
            if (act.extraSlot) now.push('One more Power Slot: a Long Rest slot of a Level below your highest, and/or a Short Rest slot');
            if (act.breach && act.breach.length) now.push(`Breach: your Powers ignore Resistance to ${act.breach.join(', ')}; +5 ER against ${act.breach.length > 1 ? 'each' : 'it'}`);
            if (act.nullifier) now.push(`Nullifier: your Powers treat Immunity to ${act.breach.join(', ')} as Resistance`);
            if (act.amplifier) now.push(`Amplifier: when a Power deals ${act.breach.join(' or ')} damage, you can spend 3 more AP to deal maximum damage (asked as you use it)`);
            if (act.emitter) now.push('Emitter: ranged Powers +10 squares; Touch Powers reach 3 squares');
        } else if (x.worn && x.overloaded && window.apxExoOverburdened(st, (c.scores || {}).STR || 0)) now.push('The dead Juggernaut weighs on you (STR 16 or less): you\'re Overburdened (Disadvantage on attacks, checks and saves, no jumping or climbing), Speed 1, and moving costs double AP');
        let camo = '';
        if (x.frame === 'juggernaut' && (x.systems || []).includes('bulwark')) {
            let max = window.apxExoBulwarkMax(st, (c.mods || {}).STR), left = Math.max(0, max - (x.bulwarkUsed || 0));
            camo = `<div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;margin-top:.5rem;font-size:.72rem">Bulwark: <b>${left}/${max}</b> left this Short Rest
                <span style="display:flex;gap:.3rem">${exoUseBtns(st, x, act, c, '')}</span></div>`;
        }
        if (x.frame === 'phantom') {
            let max = window.apxExoCamoMax(st, (c.mods || {}).AGI), left = Math.max(0, max - (x.camoUsed || 0));
            camo = `<div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;margin-top:.5rem;font-size:.72rem">Active Camouflage: <b>${left}/${max}</b> left this Short Rest
                <span style="display:flex;gap:.3rem;flex-wrap:wrap;justify-content:flex-end">${exoUseBtns(st, x, act, c, '')}</span></div>`;
        }
        let back = old || document.createElement('div');
        if (!old) {
            back.id = 'apxExoDetails';
            back.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(2,6,23,.6);display:flex;align-items:center;justify-content:center;padding:12px';
            back.addEventListener('mousedown', e => { if (e.target === back) back.remove(); });
            document.body.appendChild(back);
            if (window.apxFront) try { window.apxFront(back); } catch (e) { }
        }
        back.innerHTML = `<div style="width:min(440px,100%);max-height:90vh;overflow:auto;background:#0f172a;border:1px solid #a21caf;border-radius:.7rem;padding:.9rem;color:#e2e8f0;box-shadow:0 20px 60px rgba(0,0,0,.6)">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem">
                <div><div style="font-size:.62rem;font-weight:900;text-transform:uppercase;color:#f0abfc">Exo-Suit · ${esc(f.name || '')}</div>
                <div style="font-size:1rem;font-weight:900">${esc(x.name || 'Exo-Suit')}</div>
                <div style="font-size:.7rem;font-weight:800;color:${state[1]}">${state[0]}</div></div>
                <button onclick="document.getElementById('apxExoDetails').remove()" style="background:none;border:0;color:#94a3b8;font-size:1.05rem;cursor:pointer">✕</button></div>
            ${now.length ? `<ul style="margin:.5rem 0 0;padding-left:1.1rem;font-size:.72rem;line-height:1.45;color:#f5d0fe">${now.map(t => `<li>${t}</li>`).join('')}</ul>` : ''}
            <div style="font-size:.68rem;font-weight:900;margin-top:.6rem">Integrated Systems (${sys.length}/${EXO.maxSystems})</div>
            ${sys.length ? sys.map(s => `<div style="margin-top:.3rem;border:1px solid #4a044e;border-radius:.35rem;padding:.3rem .45rem;background:rgba(74,4,78,.25)"><div style="font-size:.72rem;font-weight:800">${esc(s.name)}</div><div style="font-size:.64rem;color:#cbd5e1;line-height:1.35">${esc(s.desc)}</div></div>`).join('') : '<div style="font-size:.66rem;color:#94a3b8;margin-top:.2rem">None installed (Forge to add up to 3).</div>'}
            ${camo}
            <div style="font-size:.62rem;color:#94a3b8;margin-top:.6rem;line-height:1.35">A Critical Hit, or one hit over your Wound Threshold, overloads the Power Core (Overload Exo-Suit in Vitals; a hit over your WT is caught automatically). Getting in or out takes 1 minute${x.frame === 'juggernaut' ? ' (6 AP in combat)' : ''}.</div>
            <div style="display:flex;gap:.4rem;justify-content:flex-end;margin-top:.7rem">
                ${allowed ? _btn(B_CYAN, x.worn ? 'Leave Suit' : 'Enter Suit', 'window.apxExoWear()', '') : ''}
                ${_btn(B_FUCH, allowed ? 'Forge' : 'Scrap…', "document.getElementById('apxExoDetails').remove();window.openExoForge()", '')}</div>
        </div>`;
    };

    // The suit's own actions, as buttons (its slot on the sheet, and its details pop-up): Active Camouflage (and
    // Swap with Decoy) on a Phantom, Bulwark on a Juggernaut that has it
    function exoUseBtns(st, x, act, c, cls) {
        if (!x || !x.worn || !window.apxExoAllowed()) return '';
        if (x.frame === 'phantom') {
            let max = window.apxExoCamoMax(st, (c.mods || {}).AGI), left = Math.max(0, max - (x.camoUsed || 0));
            let on = ((st.powerBuffs || []).find(b => b.key === 'exo:camo'));
            let dec = (x.systems || []).includes('decoy') ? window.apxExoMyDecoy() : null;
            return _btn(cls + B_IND, on ? 'Camouflaged' : `Camouflage (2 AP) · ${left}/${max}`, 'window.apxExoCamo()', on ? 'You\'re Invisible until the start of your next turn (Active Camouflage)' : `Active Camouflage: spend 2 AP to become Invisible until the start of your next turn${(x.systems || []).includes('decoy') ? ', and leave a Decoy of yourself in your square' : ''} (${left} of ${max} uses left this Short Rest)`, !act || !left || !!on)
                + (dec ? _btn(cls + B_CYAN, 'Swap with Decoy (3 AP)', 'window.apxExoDecoySwap()', 'Swap places with your Decoy (within 15 squares): it\'s destroyed and your Active Camouflage ends', !act) : '');
        }
        if (x.frame === 'juggernaut' && (x.systems || []).includes('bulwark')) {
            let max = window.apxExoBulwarkMax(st, (c.mods || {}).STR), left = Math.max(0, max - (x.bulwarkUsed || 0));
            return _btn(cls + B_IND, `Bulwark (2 AP) · ${left}/${max}`, 'window.apxExoBulwark()', `Bulwark: spend 2 AP for Temporary HP equal to your AC (${c.ac || '?'}); ${left} of ${max} uses left this Short Rest`, !act || !left);
        }
        return '';
    }
    let save = () => { window.recalculateMath?.(); window.scheduleAutoSave?.(); };
    let spendAp = (n, what) => {
        // In combat, from your AP (asks first when you don't have enough); outside combat it's free
        if (!window._pwCombatCode || typeof window.apxApCurrent !== 'function' || !window.apxSpendAp) return true;
        if (window.apxApCurrent() < n) { window.APXDice?.notify(`${what} costs ${n} AP: you have ${window.apxApCurrent()}.`, { kind: 'warn', open: true }); return false; }
        window.apxSpendAp(n); return true;
    };
    window.apxExoWear = function () {
        let x = window.state?.exoSuit; if (!x) return;
        if (!x.worn && x.frame === 'juggernaut' && window._pwCombatCode && !spendAp(6, 'Entering a Juggernaut')) return;
        if (x.worn && x.frame === 'juggernaut' && window._pwCombatCode && !spendAp(6, 'Leaving a Juggernaut')) return;
        x.worn = !x.worn;
        if (!x.worn) x.overloaded = false;
        window.APXDice?.notify(x.worn ? `You're in ${x.name || 'your Exo-Suit'}: it's powered.` : `You left ${x.name || 'your Exo-Suit'}.`, { kind: 'note' });
        save();
    };
    window.apxExoOverload = function (why) {
        let x = window.state?.exoSuit; if (!x || !x.worn || x.overloaded) return;
        x.overloaded = true;
        let conc = x.frame === 'conduit' ? ' Your Concentration Powers end.' : '';
        window.APXDice?.notify(`System Overload${why ? ' (' + why + ')' : ''}: ${x.name || 'your Exo-Suit'} shuts down. Everything it grants is gone until a System Reboot (6 AP).${conc}`, { kind: 'warn', open: true });
        try { window.apxOnRollEvent?.({ id: 'exo' + Date.now().toString(36), kind: 'action', label: 'System Overload', text: `${window.state.name || 'A player'}'s Exo-Suit overloads and shuts down.${conc ? ' Their Concentration Powers end.' : ''}` }); } catch (e) { }
        save();
    };
    window.apxExoReboot = function () {
        let x = window.state?.exoSuit; if (!x || !x.overloaded) return;
        if (!spendAp(6, 'A System Reboot')) return;
        x.overloaded = false;
        window.APXDice?.notify(`System Reboot: ${x.name || 'your Exo-Suit'} is back online.`, { kind: 'note' });
        save();
    };
    // An action of the suit's (Active Camouflage, Bulwark, a Decoy swap): its AP comes off your tracker, in a fight or
    // not, like any action. Short on AP: asked first.
    let payAp = async (n, what) => {
        if (typeof window.apxApCurrent !== 'function' || !window.apxSpendAp) return true;
        let have = window.apxApCurrent();
        if (have < n) {
            let ok = window.apxConfirm ? await window.apxConfirm(`${what} costs ${n} AP and you have ${have}. Use it anyway?`, { title: what, okLabel: 'Use it', cancelLabel: 'Cancel' }) : window.confirm(`${what} costs ${n} AP and you have ${have}. Use it anyway?`);
            if (!ok) return false;
        }
        window.apxSpendAp(Math.min(n, have)); return true;
    };
    // Active Camouflage (Phantom): 2 AP, Invisible until the start of your next turn (a chip under Armor & Defenses, with
    // its ✕). Your GM's map hides your token from the other players; with Decoy, a see-through light blue copy of
    // you stays in your square (it's destroyed by any damage)
    window.apxExoCamo = async function () {
        let st = window.state, x = st?.exoSuit; if (!x || !window.apxExoActive(st)) return;
        let max = window.apxExoCamoMax(st, (C().mods || {}).AGI);
        if ((x.camoUsed || 0) >= max) { window.APXDice?.notify('No Active Camouflage left until a Short Rest.', { kind: 'warn' }); return; }
        if ((st.powerBuffs || []).some(b => b.key === 'exo:camo')) { window.APXDice?.notify('Your Active Camouflage is already on: it lasts until the start of your next turn.', { kind: 'warn' }); return; }
        let decoy = false;
        if ((x.systems || []).includes('decoy') && window.APXDice && APXDice.ask) {
            let a = await APXDice.ask('Active Camouflage', 'Leave a Decoy of yourself in your square? Enemies who don\'t know where you really are treat it as you, and any damage destroys it. Later, 3 AP swaps you with it (within 15 squares), ending your Camouflage.', [['decoy', 'Leave a Decoy', 'pri'], ['no', 'No Decoy']]);
            if (!a) return;
            decoy = a === 'decoy';
        }
        if (!(await payAp(2, 'Active Camouflage'))) return;
        x.camoUsed = (x.camoUsed || 0) + 1;
        let id = 'cm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
        st.powerBuffs = (st.powerBuffs || []).filter(b => b.key !== 'exo:camo').concat([{ id, key: 'exo:camo', name: 'Active Camouflage', pi: 'camo_' + id, camo: true, invisible: true, lasting: true, left: 1, dur: 'nextTurn', from: x.name || 'your Exo-Suit' }]);
        try { window.apxOnRollEvent?.({ id: 'exc' + id, kind: 'action', label: 'Active Camouflage', ap: 2, exo: { camo: true, pi: 'camo_' + id, decoy: decoy || undefined },
            text: `${st.name || 'A player'} uses Active Camouflage (2 AP): Invisible until the start of their next turn${decoy ? ', leaving a Decoy in their square' : ''}.` }); } catch (e) { }
        window.APXDice?.notify(`Active Camouflage: you're Invisible until the start of your next turn${decoy ? ', and your Decoy stands in your square' : ''}. ${max - x.camoUsed} left this Short Rest.`, { kind: 'note', open: true });
        save(); window.apxRenderExo();
    };
    // Your Decoy on a battle map your GM shares (and your own token on that map): { map, decoy, me } or null
    window.apxExoMyDecoy = function () {
        let uid = window.apxAuth?.user?.uid, w = window._playerWorldData; if (!uid || !w) return null;
        for (let m of ((w.notesV2 && w.notesV2.otherMaps) || [])) {
            let d = (m.battleTokens || []).find(t => t.type === 'decoy' && t.decoyOf === uid);
            if (d) return { map: m, decoy: d, me: (m.battleTokens || []).find(t => t.type === 'player' && t.playerUid === uid) || null };
        }
        return null;
    };
    // Swap places with your Decoy (3 AP, within 15 squares): it's destroyed, and your Active Camouflage ends
    window.apxExoDecoySwap = async function () {
        let st = window.state, x = st?.exoSuit; if (!x || !window.apxExoActive(st)) return;
        let f = window.apxExoMyDecoy();
        if (!f) { window.APXDice?.notify('Your Decoy isn\'t on a battle map any more (any damage destroys it).', { kind: 'warn' }); return; }
        if (f.me && window.APXBattle) {
            let a = window.APXBattle.posOf(f.map.id, f.me), b = window.APXBattle.posOf(f.map.id, f.decoy);
            let d = window.APXBattle.squaresBetween(a.gridX - b.gridX, a.gridY - b.gridY);
            if (d > 15) { window.APXDice?.notify(`Your Decoy is ${d} squares away: you can only swap with it within 15 squares.`, { kind: 'warn', open: true }); return; }
        }
        if (!(await payAp(3, 'Swapping with your Decoy'))) return;
        try { window.apxOnRollEvent?.({ id: 'exs' + Date.now().toString(36), kind: 'action', label: 'Decoy', ap: 3, exo: { swap: true, mapId: f.map.id, decoyId: f.decoy.id },
            text: `${st.name || 'A player'} swaps places with their Decoy (3 AP): it's destroyed and their Active Camouflage ends.` }); } catch (e) { }
        let cb = (st.powerBuffs || []).find(b => b.key === 'exo:camo');
        if (cb && window.apxEndBuff) window.apxEndBuff(cb.id, 'you swapped places with your Decoy');
        window.APXDice?.notify('You swap places with your Decoy: it\'s gone, and so is your Active Camouflage.', { kind: 'note', open: true });
        save(); window.apxRenderExo();
    };
    // Bulwark (Juggernaut): 2 AP for Temporary HP equal to your AC (Temp HP doesn't stack: you keep the higher)
    window.apxExoBulwark = async function () {
        let st = window.state, x = st?.exoSuit; if (!x || !window.apxExoActive(st)) return;
        let c = C(), max = window.apxExoBulwarkMax(st, (c.mods || {}).STR);
        if ((x.bulwarkUsed || 0) >= max) { window.APXDice?.notify('No Bulwark left until a Short Rest.', { kind: 'warn' }); return; }
        if (!(await payAp(2, 'Bulwark'))) return;
        x.bulwarkUsed = (x.bulwarkUsed || 0) + 1;
        let amt = Math.max(0, c.ac || 0), had = Math.max(0, st.tempHp || 0);
        st.tempHp = Math.max(had, amt);
        window.APXDice?.notify(`Bulwark: ${had >= amt ? `you keep your ${had} Temporary HP (it doesn't stack, and ${amt} isn't more)` : `${amt} Temporary HP (your AC)`}. ${max - x.bulwarkUsed} left this Short Rest.`, { kind: 'note', open: true });
        try { window.apxOnRollEvent?.({ id: 'bw' + Date.now().toString(36), kind: 'action', label: 'Bulwark', ap: 2, text: `${st.name || 'A player'} uses Bulwark (2 AP): ${st.tempHp} Temporary HP.` }); } catch (e) { }
        window.apxRefreshHpInputs?.();
        save();
    };
    // A Critical Hit, or a single hit over the Wound Threshold (the suit's, with Plating), overloads the Power Core
    window.apxExoOnDamage = function (amount, wt, crit) {
        let st = window.state; if (!st || !window.apxExoActive(st)) return;
        if (crit) window.apxExoOverload('a Critical Hit');
        else if ((amount || 0) > (wt || 0)) window.apxExoOverload(`${amount} damage, over your WT of ${wt}`);
    };

    // ── The Exo-Suit Forge ──
    window.openExoForge = function () {
        let st = window.state; if (!st) return;
        if (!st.exoSuit && !window.apxExoAllowed()) { window.APXDice?.notify('Exo-Suits aren\'t allowed in this world (your GM\'s World Settings).', { kind: 'warn', open: true }); return; }
        // Turned off in this world: the suit does nothing here, and all you can do is scrap it
        if (st.exoSuit && !window.apxExoAllowed()) {
            window.apxConfirm(`Your GM has turned Exo-Suits off for this world, so ${st.exoSuit.name || 'your Exo-Suit'} does nothing here. Scrap it? It's gone for good (no Currency back).`, { title: 'Scrap Exo-Suit', okLabel: 'Scrap', danger: true })
                .then(ok => { if (!ok) return; st.exoSuit = null; save(); });
            return;
        }
        let have = st.exoSuit ? JSON.parse(JSON.stringify(st.exoSuit)) : null;
        let d = { frame: have ? have.frame : 'juggernaut', name: have ? have.name : '', systems: have ? (have.systems || []).slice() : [] };
        document.getElementById('apxExoForge')?.remove();
        let back = document.createElement('div');
        back.id = 'apxExoForge';
        back.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(2,6,23,.72);display:flex;align-items:center;justify-content:center;padding:12px';
        back.innerHTML = `<div style="width:min(640px,100%);max-height:92vh;overflow:auto;background:#0f172a;border:1px solid #a21caf;border-radius:.75rem;box-shadow:0 20px 60px rgba(0,0,0,.6);padding:1rem;color:#e2e8f0" data-body></div>`;
        document.body.appendChild(back);
        if (window.apxFront) try { window.apxFront(back); } catch (e) { }
        back.addEventListener('mousedown', e => { if (e.target === back) back.remove(); });
        let body = back.querySelector('[data-body]');
        let owned = new Set((have && have.owned) || (have ? have.systems || [] : []));
        let isOwned = id => !!(have && have.frame === d.frame && owned.has(id));
        let cost = () => {
            let c = have ? 0 : EXO.base;
            d.systems.forEach(id => { if (!isOwned(id)) { let sd = sysDef(d.frame, id); if (sd) c += sd.cost; } });
            return c;
        };
        let has = base => d.systems.some(id => baseId(id) === base);
        // Taking one out takes out what needs it (Nullifier needs a Breach, Amplifier needs Nullifier)
        let tidy = () => {
            if (!has('breach')) d.systems = d.systems.filter(id => id !== 'nullifier');
            if (!has('nullifier')) d.systems = d.systems.filter(id => id !== 'amplifier');
        };
        let row = (id, s, on, full, extra) => {
            let reqOk = !s.req || has(s.req), dis = (full && !on) || (!on && !reqOk);
            let price = isOwned(id) ? 'owned' : s.cost.toLocaleString() + ' Cu';
            return `<label style="display:flex;gap:.45rem;align-items:flex-start;border:1px solid ${on ? '#d946ef' : '#334155'};border-radius:.4rem;padding:.35rem .45rem;background:${on ? 'rgba(162,28,175,.12)' : '#0b1220'};opacity:${dis ? .5 : 1};cursor:${dis ? 'not-allowed' : 'pointer'}">
                <input type="checkbox" data-sys="${esc(id)}" ${on ? 'checked' : ''} ${dis ? 'disabled' : ''} style="margin-top:.15rem">
                <div style="flex:1"><div style="font-size:.75rem;font-weight:800">${esc(sysName(d.frame, id))} <span style="color:#facc15;font-weight:700">${price}</span></div>
                <div style="font-size:.62rem;color:#94a3b8;line-height:1.3">${esc(s.desc)}${!reqOk && !on ? ` <b style="color:#fca5a5">Needs ${esc((sysDef(d.frame, s.req) || {}).name || s.req)} first.</b>` : ''}</div>${extra || ''}</div></label>`;
        };
        let draw = () => {
            let f = EXO.frames[d.frame], list = EXO.systems[d.frame] || [], toPay = cost(), full = d.systems.length >= EXO.maxSystems;
            let sysRows = list.filter(s => !s.legacy || d.systems.includes(s.id) || isOwned(s.id)).map(s => {
                if (!s.typed) {
                    let on = d.systems.includes(s.id), swap = (s.id === 'assault' && d.systems.includes('dreadnought')) || (s.id === 'dreadnought' && d.systems.includes('assault'));
                    return row(s.id, s, on, full && !swap);
                }
                // Breach: one per Energy type (installed ones, ones bought before, and a new one)
                let mine = d.systems.filter(id => baseId(id) === s.id), before = [...owned].filter(id => baseId(id) === s.id && !mine.includes(id) && have && have.frame === d.frame);
                let taken = new Set(mine.concat(before).map(typeOf));
                let free = ENERGY().filter(t => !taken.has(t));
                // (the Energy type picker sits under the text, so the description keeps the row's full width)
                let addRow = `<div data-breach-row style="border:1px dashed #475569;border-radius:.4rem;padding:.35rem .45rem;background:#0b1220;opacity:${full || !free.length ? .5 : 1}">
                    <div style="font-size:.75rem;font-weight:800">${esc(s.name)} <span style="color:#facc15;font-weight:700">${s.cost.toLocaleString()} Cu</span></div>
                    <div style="font-size:.62rem;color:#94a3b8;line-height:1.3">${esc(s.desc)}</div>
                    <div style="display:flex;gap:.4rem;align-items:center;margin-top:.35rem;flex-wrap:wrap"><span style="font-size:.62rem;color:#cbd5e1;font-weight:700">Energy type</span>
                    <select data-breach-type style="flex:1;min-width:8rem;background:#1e293b;border:1px solid #334155;border-radius:.3rem;color:#e2e8f0;font-size:.7rem;padding:.15rem" ${full || !free.length ? 'disabled' : ''}>${free.map(t => `<option value="${t}">${t}</option>`).join('')}</select>
                    <button data-breach-add style="background:#a21caf;border:1px solid #e879f9;color:#fff;border-radius:.3rem;padding:.2rem .5rem;font-size:.68rem;font-weight:800;cursor:pointer" ${full || !free.length ? 'disabled' : ''}>Add</button></div></div>`;
                return mine.concat(before).map(id => row(id, s, mine.includes(id), full)).join('') + addRow;
            }).join('');
            body.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem"><div style="font-size:1rem;font-weight:900;color:#f0abfc">Exo-Suit Forge</div>
                    <button data-x style="background:none;border:0;color:#94a3b8;font-size:1.1rem;cursor:pointer">✕</button></div>
                <div style="font-size:.7rem;color:#94a3b8;margin-bottom:.6rem;line-height:1.35">A Base Suit costs ${EXO.base.toLocaleString()} Currency, is worn with your armor, and holds up to ${EXO.maxSystems} Integrated Systems from its framework's list. Swapping systems later takes 1 hour at a Workbench: systems you've already bought can be put back in for free. Entering or leaving the suit takes 1 minute (6 AP in combat for a Juggernaut: its Plating).</div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:.5rem;margin-bottom:.6rem">
                    ${Object.keys(EXO.frames).map(k => { let F = EXO.frames[k], on = d.frame === k, locked = have && have.frame !== k;
                        return `<label style="display:block;border:1px solid ${on ? '#d946ef' : '#334155'};background:${on ? 'rgba(162,28,175,.15)' : '#0b1220'};border-radius:.5rem;padding:.5rem;cursor:${locked ? 'not-allowed' : 'pointer'};opacity:${locked ? .45 : 1}">
                            <div style="display:flex;gap:.35rem;align-items:center"><input type="radio" name="exoFrame" value="${k}" ${on ? 'checked' : ''} ${locked ? 'disabled' : ''}><b style="font-size:.85rem">${F.name}</b></div>
                            <div style="font-size:.62rem;color:#94a3b8;margin:.25rem 0">${F.blurb}</div>
                            <ul style="font-size:.62rem;color:#cbd5e1;margin:0;padding-left:1rem">${F.features.map(t => `<li>${t}</li>`).join('')}</ul>
                            ${locked ? '<div style="font-size:.6rem;color:#fca5a5;margin-top:.25rem">Your suit is a ' + EXO.frames[have.frame].name + ': scrap it to build another kind.</div>' : ''}</label>`; }).join('')}
                </div>
                <label style="display:block;font-size:.7rem;font-weight:800;margin-bottom:.15rem">Name</label>
                <input data-name type="text" value="${esc(d.name)}" placeholder="${f.name} Exo-Suit" style="width:100%;background:#1e293b;border:1px solid #334155;border-radius:.3rem;padding:.3rem .45rem;color:#e2e8f0;font-size:.8rem;margin-bottom:.6rem">
                <div style="font-size:.75rem;font-weight:900;margin-bottom:.25rem">Integrated Systems <span style="color:#94a3b8;font-weight:700">(${d.systems.length}/${EXO.maxSystems})</span></div>
                <div style="display:flex;flex-direction:column;gap:.3rem;margin-bottom:.6rem">${sysRows}</div>
                ${d.frame === 'juggernaut' ? '<div style="font-size:.62rem;color:#94a3b8;margin:-.35rem 0 .6rem">Assault and Dreadnought Plating replace each other (and the Standard Plating): one Plating at a time.</div>' : ''}
                ${d.frame === 'conduit' ? '<div style="font-size:.62rem;color:#94a3b8;margin:-.35rem 0 .6rem">Breach can be taken more than once, a new Energy type each time. Nullifier needs a Breach, and Amplifier needs Nullifier.</div>' : ''}
                <div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap;border-top:1px solid #334155;padding-top:.6rem">
                    <div style="font-size:.8rem">${have ? 'To pay for this change' : 'Total'}: <b style="color:#facc15">${toPay.toLocaleString()} Cu</b> <span style="color:#94a3b8;font-size:.7rem">(you have ${(st.currency || 0).toLocaleString()})</span></div>
                    <div style="display:flex;gap:.4rem">
                        ${have ? '<button data-scrap style="background:#7f1d1d;border:1px solid #b91c1c;color:#fecaca;border-radius:.35rem;padding:.35rem .7rem;font-size:.72rem;font-weight:800;cursor:pointer">Scrap Suit</button>' : ''}
                        <button data-ok style="background:#a21caf;border:1px solid #e879f9;color:#fff;border-radius:.35rem;padding:.35rem .9rem;font-size:.75rem;font-weight:900;cursor:pointer">${have ? 'Save Suit' : 'Buy Suit'}</button>
                    </div></div>`;
            body.querySelector('[data-x]').onclick = () => back.remove();
            body.querySelector('[data-name]').oninput = e => { d.name = e.target.value; };
            body.querySelectorAll('input[name="exoFrame"]').forEach(r => r.onchange = () => { d.frame = r.value; d.systems = []; draw(); });
            body.querySelectorAll('[data-sys]').forEach(cb => cb.onchange = () => {
                let id = cb.dataset.sys;
                if (cb.checked) {
                    if (id === 'assault') d.systems = d.systems.filter(x => x !== 'dreadnought');
                    if (id === 'dreadnought') d.systems = d.systems.filter(x => x !== 'assault');
                    if (d.systems.length < EXO.maxSystems && !d.systems.includes(id)) d.systems.push(id);
                } else { d.systems = d.systems.filter(x => x !== id); tidy(); }
                draw();
            });
            let ba = body.querySelector('[data-breach-add]');
            if (ba) ba.onclick = e => {
                e.preventDefault();
                let t = body.querySelector('[data-breach-type]').value;
                if (t && d.systems.length < EXO.maxSystems && !d.systems.includes('breach:' + t)) d.systems.push('breach:' + t);
                draw();
            };
            let sc = body.querySelector('[data-scrap]');
            if (sc) sc.onclick = async () => {
                let ok = await window.apxConfirm(`Scrap ${have.name || 'your Exo-Suit'}? It's gone for good (no Currency back).`, { title: 'Scrap Exo-Suit', okLabel: 'Scrap', danger: true });
                if (!ok) return;
                st.exoSuit = null;   // (not delete: the cloud save merges, so a missing field would keep the old suit)
                back.remove(); save();
            };
            body.querySelector('[data-ok]').onclick = () => {
                let total = cost(), name = (d.name || '').trim() || (EXO.frames[d.frame].name + ' Exo-Suit');
                let apply = paid => {
                    let ow = new Set(have && have.frame === d.frame ? (have.owned || have.systems || []) : []);
                    d.systems.forEach(id => ow.add(id));
                    st.exoSuit = Object.assign({}, have || {}, { frame: d.frame, name, systems: d.systems.slice(), owned: [...ow],
                        paidCost: ((have && have.paidCost) || 0) + (paid ? total : 0), worn: have ? !!have.worn : false, overloaded: have ? !!have.overloaded : false, camoUsed: have ? (have.camoUsed || 0) : 0, bulwarkUsed: have ? (have.bulwarkUsed || 0) : 0 });
                    if (paid) st.currency = (st.currency || 0) - total;
                    back.remove();
                    window.APXDice?.notify(have ? `${name}: systems updated.` : `${name} is yours. Use Enter the Suit on your sheet to power it up.`, { kind: 'note' });
                    save();
                };
                if (!total) { apply(false); return; }
                if (typeof window.askPayOrGrant === 'function') { back.style.display = 'none'; window.askPayOrGrant(name, total, paid => apply(!!paid)); setTimeout(() => { if (back.isConnected && !document.getElementById('payOrGrantModal')?.classList.contains('active')) back.style.display = 'flex'; }, 400); }
                else if ((st.currency || 0) >= total) apply(true);
                else window.APXDice?.notify(`Not enough Currency (${total} needed).`, { kind: 'warn' });
            };
        };
        draw();
    };
})();
