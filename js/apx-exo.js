// ============================================================
// APX Exo-Suits (Rulebook Chapter 11: Vehicles & Mounts → Exo-Suits, The Exo-Suit Forge)
// ============================================================
// A suit is bought (5,000 Currency) as a Juggernaut or a Phantom and holds up to 3 Integrated Systems
// from its framework's list. While it's worn and powered it changes the sheet (js/apx-engine.js asks
// apxExoActive). A System Overload (a Critical Hit, or one hit over your Wound Threshold) shuts it down
// until a 6 AP System Reboot.
//   state.exoSuit = { frame: 'juggernaut'|'phantom', name, systems: [ids installed], owned: [ids ever bought],
//                     paidCost, worn, overloaded, camoUsed }
// Only offered when the GM's World Settings allow Exo-Suits (characters outside a world always can).
// ============================================================
(function () {
    'use strict';

    const EXO = {
        base: 5000, maxSystems: 3,
        frames: {
            juggernaut: {
                name: 'Juggernaut', attr: 'STR', skill: 'Athletics',
                blurb: 'Raw power and front-line siege warfare: a walking tank (a hollowed-out golem, a steampunk gear-hulk, an armored cybernetic exoskeleton).',
                features: ['STR becomes 15 (unless already higher)', 'Advantage on STR (Athletics) checks', 'Speed is a fixed 3 squares', 'Your Size increases by one step',
                    'Standard Plating: you use the suit\'s defenses instead of your own (AC 15, DR 4, ER 4, WT 15)']
            },
            phantom: {
                name: 'Phantom', attr: 'AGI', skill: 'Stealth',
                blurb: 'Infiltration and mobility: a skin-tight second layer (a shadow-weave garment, a bio-organic carapace, an optical-camouflage stealth suit). No Plating: wear normal armor over it.',
                features: ['AGI becomes 15 (unless already higher)', 'Advantage on AGI (Stealth) checks', 'Speed +1 square',
                    'Active Camouflage: at the start of your turn, spend 2 AP to become Invisible until the start of your next turn (uses per Short Rest: your AGI modifier, minimum 1)']
            }
        },
        systems: {
            juggernaut: [
                { id: 'assault', name: 'Assault Plating', cost: 6000, plating: { ac: 20, dr: 8, er: 8, wt: 20 }, desc: 'Heavy, militarized armor: you use the suit\'s defenses instead of your own: AC 20, DR 8, ER 8, WT 20.' },
                { id: 'dreadnought', name: 'Dreadnought Plating', cost: 12000, plating: { ac: 25, dr: 12, er: 12, wt: 25 }, speed: 2, desc: 'Massive, lumbering armor: AC 25, DR 12, ER 12, WT 25, and your Speed is a fixed 2 squares.' },
                { id: 'powerful', name: 'Powerful', cost: 2000, desc: 'The suit\'s STR override rises from 15 to 20.' },
                { id: 'forceMult', name: 'Force Multipliers', cost: 1500, desc: 'Add your STR modifier twice to all melee weapon damage rolls.' },
                { id: 'impactors', name: 'Kinetic Impactors', cost: 1500, desc: 'Your unarmed strikes deal 2d8 Bludgeoning damage and gain the Crushing Property.' },
                { id: 'heavyMount', name: 'Heavy Weapon Mount', cost: 1500, desc: 'A Heavy weapon mounted in the shoulder or forearm: your hands stay free, and it can\'t be disarmed.' },
                { id: 'hermetic', name: 'Hermetic Seal', cost: 1000, desc: 'Immune to airborne toxins, diseases, and the vacuum of space or underwater environments.' }
            ],
            phantom: [
                { id: 'mirage', name: 'Mirage Weave', cost: 3000, desc: 'Double the uses of Active Camouflage per Short Rest.' },
                { id: 'climb', name: 'Climbing Grips', cost: 1500, desc: 'A Climb speed equal to your walking speed; hang upside down from ceilings with your hands free.' },
                { id: 'concealed', name: 'Concealed Weapon Mount', cost: 1000, desc: 'A Light weapon hidden in the forearm or leg: invisible to casual inspection, can\'t be disarmed, has the Concealed property.' },
                { id: 'decoy', name: 'Decoy', cost: 2000, desc: 'Using Active Camouflage can leave a perfect illusion of you in your square (destroyed by any damage). For 3 AP, swap places with it within 15 squares, destroying it and ending Active Camouflage.' },
                { id: 'injector', name: 'Auto-Injector', cost: 1000, desc: 'Stores up to 3 crafted Consumables: trigger one for 1 AP instead of 3 AP.' },
                { id: 'flight', name: 'Flight Module', cost: 3000, desc: 'A glider, wings or micro-thrusters: a Fly Speed equal to your walking speed.' }
            ]
        }
    };
    window.APX_EXO = EXO;
    const sysDef = (frame, id) => (EXO.systems[frame] || []).find(s => s.id === id);
    const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

    // Are Exo-Suits allowed for this character? (the GM's World Settings; outside a world, yes)
    window.apxExoAllowed = function () {
        let ws = typeof window.apxActiveWorldSettings === 'function' ? window.apxActiveWorldSettings() : null;
        return !ws || !!ws.allowExoSuits;
    };

    // What a worn suit does right now (null when there's no suit, it's off, or it has overloaded)
    window.apxExoActive = function (st) {
        let x = st && st.exoSuit;
        if (!x || !x.frame || !x.worn || x.overloaded) return null;
        let f = EXO.frames[x.frame]; if (!f) return null;
        let sys = new Set((x.systems || []).filter(id => sysDef(x.frame, id)));
        let out = { frame: x.frame, name: x.name || ('Exo-Suit (' + f.name + ')'), sys, attr: f.attr, attrFloor: 15, skill: f.skill };
        if (x.frame === 'juggernaut') {
            if (sys.has('powerful')) out.attrFloor = 20;
            out.plating = sys.has('dreadnought') ? sysDef('juggernaut', 'dreadnought').plating : sys.has('assault') ? sysDef('juggernaut', 'assault').plating : { ac: 15, dr: 4, er: 4, wt: 15 };
            out.platingName = sys.has('dreadnought') ? 'Dreadnought Plating' : sys.has('assault') ? 'Assault Plating' : 'Standard Plating';
            out.speedFixed = sys.has('dreadnought') ? 2 : 3;
            out.sizeUp = true;
        } else {
            out.speedPlus = 1;
        }
        return out;
    };
    // A deactivated Juggernaut with STR 14 or less: Overburdened (Speed 1, moving costs double AP)
    window.apxExoOverburdened = function (st, strScore) {
        let x = st && st.exoSuit;
        return !!(x && x.worn && x.overloaded && x.frame === 'juggernaut' && strScore <= 14);
    };
    // Active Camouflage uses per Short Rest
    window.apxExoCamoMax = function (st, agiMod) {
        let x = st && st.exoSuit; if (!x || x.frame !== 'phantom') return 0;
        return Math.max(1, agiMod || 0) * ((x.systems || []).includes('mirage') ? 2 : 1);
    };

    // ── The sheet's Exo-Suit panel (under Shield / Helmet) ──
    window.apxRenderExo = function () {
        let box = document.getElementById('exoControl'); if (!box) return;
        let st = window.state, x = st && st.exoSuit, allowed = window.apxExoAllowed();
        if (!x && !allowed) { box.classList.add('hidden'); box.innerHTML = ''; return; }
        box.classList.remove('hidden');
        if (!x) {
            box.innerHTML = `<div class="flex items-center justify-between gap-2"><div><div class="text-[9px] text-slate-500 uppercase font-bold">Exo-Suit</div><div class="text-[10px] text-slate-400">None. A piloted suit of power armor: Juggernaut or Phantom.</div></div>
                <button onclick="window.openExoForge()" class="bg-fuchsia-600/20 text-fuchsia-300 hover:bg-fuchsia-600/40 text-[10px] px-2 py-1 rounded border border-fuchsia-700/50 transition font-bold whitespace-nowrap">Exo-Suit Forge</button></div>`;
            return;
        }
        let f = EXO.frames[x.frame] || {}, c = window.calc || {}, act = window.apxExoActive(st);
        let sys = (x.systems || []).map(id => sysDef(x.frame, id)).filter(Boolean);
        let status = !x.worn ? '<span class="text-slate-400">Not worn</span>' : x.overloaded ? '<span class="text-red-400 font-bold">OVERLOADED: shut down</span>' : '<span class="text-emerald-400 font-bold">Powered</span>';
        let camo = '';
        if (x.frame === 'phantom') {
            let max = window.apxExoCamoMax(st, (c.mods || {}).AGI), left = Math.max(0, max - (x.camoUsed || 0));
            camo = `<div class="flex items-center justify-between gap-2 mt-1"><span class="text-[10px] text-slate-300">Active Camouflage: <b>${left}/${max}</b> left (Short Rest)</span>
                <button ${act && left ? '' : 'disabled'} onclick="window.apxExoCamo()" class="text-[10px] px-2 py-0.5 rounded border font-bold ${act && left ? 'bg-indigo-600/20 text-indigo-300 border-indigo-700/50 hover:bg-indigo-600/40' : 'opacity-40 cursor-not-allowed border-slate-700 text-slate-500'}">Camouflage (2 AP)</button></div>`;
        }
        let defs = act && act.plating ? `<div class="text-[10px] text-cyan-300 mt-1">${act.platingName}: AC ${act.plating.ac} · DR ${act.plating.dr} · ER ${act.plating.er} · WT ${act.plating.wt} (instead of your own)</div>` : '';
        box.innerHTML = `<div class="flex items-start justify-between gap-2">
                <div class="min-w-0"><div class="text-[9px] text-slate-500 uppercase font-bold">Exo-Suit · ${esc(f.name || '')}</div>
                <div class="text-xs font-bold text-fuchsia-300 truncate">${esc(x.name || 'Exo-Suit')}</div>
                <div class="text-[10px]">${status}</div></div>
                <button onclick="window.openExoForge()" class="bg-fuchsia-600/20 text-fuchsia-300 hover:bg-fuchsia-600/40 text-[10px] px-2 py-1 rounded border border-fuchsia-700/50 transition font-bold whitespace-nowrap">Forge</button></div>
            <div class="text-[10px] text-slate-400 mt-1 leading-tight">${sys.length ? sys.map(s => `<span title="${esc(s.desc)}" class="inline-block bg-slate-800 border border-slate-700 rounded px-1 mr-1 mb-0.5">${esc(s.name)}</span>`).join('') : 'No Integrated Systems installed.'}</div>
            ${defs}${camo}
            <div class="flex gap-1 mt-1.5">
                <button onclick="window.apxExoWear()" class="flex-1 bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/40 text-[10px] px-2 py-1 rounded border border-cyan-700/50 transition font-bold" title="Entering or leaving the suit takes 1 minute${x.frame === 'juggernaut' ? ' (6 AP in combat with Plating)' : ''}">${x.worn ? 'Leave the Suit' : 'Enter the Suit'}</button>
                ${x.worn ? (x.overloaded
                    ? `<button onclick="window.apxExoReboot()" class="flex-1 bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/40 text-[10px] px-2 py-1 rounded border border-emerald-700/50 transition font-bold" title="Bring the suit back online">System Reboot (6 AP)</button>`
                    : `<button onclick="window.apxExoOverload()" class="flex-1 bg-red-600/20 text-red-400 hover:bg-red-600/40 text-[10px] px-2 py-1 rounded border border-red-700/50 transition font-bold" title="A Critical Hit, or one hit over the Wound Threshold, overloads the Power Core (one over your WT is caught automatically)">Overload</button>`) : ''}
            </div>
            ${x.worn && x.overloaded && window.apxExoOverburdened(st, (c.scores || {}).STR || 0) ? '<div class="text-[10px] text-red-400 mt-1">Overburdened by the dead Juggernaut: Speed 1, and moving costs double AP.</div>' : ''}`;
    };

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
        window.APXDice?.notify(`System Overload${why ? ' (' + why + ')' : ''}: ${x.name || 'your Exo-Suit'} shuts down. Everything it grants is gone until a System Reboot (6 AP).`, { kind: 'warn', open: true });
        save();
    };
    window.apxExoReboot = function () {
        let x = window.state?.exoSuit; if (!x || !x.overloaded) return;
        if (!spendAp(6, 'A System Reboot')) return;
        x.overloaded = false;
        window.APXDice?.notify(`System Reboot: ${x.name || 'your Exo-Suit'} is back online.`, { kind: 'note' });
        save();
    };
    window.apxExoCamo = function () {
        let st = window.state, x = st?.exoSuit; if (!x || !window.apxExoActive(st)) return;
        let max = window.apxExoCamoMax(st, (window.calc?.mods || {}).AGI);
        if ((x.camoUsed || 0) >= max) { window.APXDice?.notify('No Active Camouflage left until a Short Rest.', { kind: 'warn' }); return; }
        if (!spendAp(2, 'Active Camouflage')) return;
        x.camoUsed = (x.camoUsed || 0) + 1;
        window.APXDice?.notify(`Active Camouflage: you're Invisible until the start of your next turn${(x.systems || []).includes('decoy') ? ' (you can leave a Decoy of yourself in this square)' : ''}. ${max - x.camoUsed} left.`, { kind: 'note', open: true });
        save();
    };
    // A single hit over the Wound Threshold (the suit's, with Plating) overloads the Power Core
    window.apxExoOnDamage = function (amount, wt) {
        let st = window.state; if (!st || !window.apxExoActive(st)) return;
        if ((amount || 0) > (wt || 0)) window.apxExoOverload(`${amount} damage, over your WT of ${wt}`);
    };

    // ── The Exo-Suit Forge ──
    window.openExoForge = function () {
        let st = window.state; if (!st) return;
        if (!st.exoSuit && !window.apxExoAllowed()) { window.APXDice?.notify('Exo-Suits aren\'t allowed in this world (your GM\'s World Settings).', { kind: 'warn', open: true }); return; }
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
        let cost = () => {
            let c = have ? 0 : EXO.base;
            d.systems.forEach(id => { if (!owned.has(id) || (have && have.frame !== d.frame)) { let s = sysDef(d.frame, id); if (s) c += s.cost; } });
            return c;
        };
        let draw = () => {
            let f = EXO.frames[d.frame], list = EXO.systems[d.frame] || [], toPay = cost();
            body.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem"><div style="font-size:1rem;font-weight:900;color:#f0abfc">Exo-Suit Forge</div>
                    <button data-x style="background:none;border:0;color:#94a3b8;font-size:1.1rem;cursor:pointer">✕</button></div>
                <div style="font-size:.7rem;color:#94a3b8;margin-bottom:.6rem;line-height:1.35">A Base Suit costs ${EXO.base.toLocaleString()} Currency and holds up to ${EXO.maxSystems} Integrated Systems from its framework's list. Swapping systems later takes 1 hour at a Workbench: systems you've already bought can be put back in for free. Entering or leaving the suit takes 1 minute (6 AP in combat for a Juggernaut).</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.6rem">
                    ${Object.keys(EXO.frames).map(k => { let F = EXO.frames[k], on = d.frame === k, locked = have && have.frame !== k;
                        return `<label style="display:block;border:1px solid ${on ? '#d946ef' : '#334155'};background:${on ? 'rgba(162,28,175,.15)' : '#0b1220'};border-radius:.5rem;padding:.5rem;cursor:${locked ? 'not-allowed' : 'pointer'};opacity:${locked ? .45 : 1}">
                            <div style="display:flex;gap:.35rem;align-items:center"><input type="radio" name="exoFrame" value="${k}" ${on ? 'checked' : ''} ${locked ? 'disabled' : ''}><b style="font-size:.85rem">${F.name}</b></div>
                            <div style="font-size:.62rem;color:#94a3b8;margin:.25rem 0">${F.blurb}</div>
                            <ul style="font-size:.62rem;color:#cbd5e1;margin:0;padding-left:1rem">${F.features.map(t => `<li>${t}</li>`).join('')}</ul>
                            ${locked ? '<div style="font-size:.6rem;color:#fca5a5;margin-top:.25rem">Your suit is a ' + EXO.frames[have.frame].name + ': scrap it to build the other kind.</div>' : ''}</label>`; }).join('')}
                </div>
                <label style="display:block;font-size:.7rem;font-weight:800;margin-bottom:.15rem">Name</label>
                <input data-name type="text" value="${esc(d.name)}" placeholder="${f.name} Exo-Suit" style="width:100%;background:#1e293b;border:1px solid #334155;border-radius:.3rem;padding:.3rem .45rem;color:#e2e8f0;font-size:.8rem;margin-bottom:.6rem">
                <div style="font-size:.75rem;font-weight:900;margin-bottom:.25rem">Integrated Systems <span style="color:#94a3b8;font-weight:700">(${d.systems.length}/${EXO.maxSystems})</span></div>
                <div style="display:flex;flex-direction:column;gap:.3rem;margin-bottom:.6rem">
                    ${list.map(s => { let on = d.systems.includes(s.id), swap = (s.id === 'assault' && d.systems.includes('dreadnought')) || (s.id === 'dreadnought' && d.systems.includes('assault')), full = !on && !swap && d.systems.length >= EXO.maxSystems;
                        let own = owned.has(s.id) && have && have.frame === d.frame;
                        return `<label style="display:flex;gap:.45rem;align-items:flex-start;border:1px solid ${on ? '#d946ef' : '#334155'};border-radius:.4rem;padding:.35rem .45rem;background:${on ? 'rgba(162,28,175,.12)' : '#0b1220'};opacity:${full ? .5 : 1};cursor:${full ? 'not-allowed' : 'pointer'}">
                            <input type="checkbox" data-sys="${s.id}" ${on ? 'checked' : ''} ${full ? 'disabled' : ''} style="margin-top:.15rem">
                            <div style="flex:1"><div style="font-size:.75rem;font-weight:800">${s.name} <span style="color:#facc15;font-weight:700">${own ? 'owned' : s.cost.toLocaleString() + ' Cu'}</span></div>
                            <div style="font-size:.62rem;color:#94a3b8;line-height:1.3">${s.desc}</div></div></label>`; }).join('')}
                </div>
                ${d.frame === 'juggernaut' ? '<div style="font-size:.62rem;color:#94a3b8;margin:-.35rem 0 .6rem">Assault and Dreadnought Plating replace each other (one Plating at a time).</div>' : ''}
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
                    if (d.systems.length < EXO.maxSystems) d.systems.push(id);
                } else d.systems = d.systems.filter(x => x !== id);
                draw();
            });
            let sc = body.querySelector('[data-scrap]');
            if (sc) sc.onclick = async () => {
                let ok = await window.apxConfirm(`Scrap ${have.name || 'your Exo-Suit'}? It's gone for good (no Currency back).`, { title: 'Scrap Exo-Suit', okLabel: 'Scrap', danger: true });
                if (!ok) return;
                delete st.exoSuit; back.remove(); save();
            };
            body.querySelector('[data-ok]').onclick = () => {
                let total = cost(), name = (d.name || '').trim() || (EXO.frames[d.frame].name + ' Exo-Suit');
                let apply = paid => {
                    let ow = new Set(have && have.frame === d.frame ? (have.owned || have.systems || []) : []);
                    d.systems.forEach(id => ow.add(id));
                    st.exoSuit = Object.assign({}, have || {}, { frame: d.frame, name, systems: d.systems.slice(), owned: [...ow],
                        paidCost: ((have && have.paidCost) || 0) + (paid ? total : 0), worn: have ? !!have.worn : false, overloaded: have ? !!have.overloaded : false, camoUsed: have ? (have.camoUsed || 0) : 0 });
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
