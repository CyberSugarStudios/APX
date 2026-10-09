// ============================================================
// APX: Ancestry Traits on the sheet
// ============================================================
//  • Discharging Internals: a compact crafter (a 3-square Cone or 6-square Line, an Energy type, the attribute
//    for its DC) that gives the character a trait power: 3 AP, 3d6 of that Energy, AGI save for half, DC 10 + the
//    chosen modifier, once per Short Rest (state.traitPowers; used like any power, without a Power Slot).
//  • Integrated Equipment: pick a piece of standard gear for each time the trait was taken; it goes in the
//    inventory as "<item> (Integrated)", built into the body (hidden, can't be disarmed).
//  • An "Ancestry Traits" note (beside Languages) listing every trait and flaw, kept up to date.
// Characters made before these existed are asked to set them up when their sheet opens.
// ============================================================
(function () {
    'use strict';

    const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const ENERGY = () => (typeof NPC_ENERGY_TYPES !== 'undefined' ? NPC_ENERGY_TYPES : ['Fire', 'Cold', 'Electric', 'Acid', 'Poison', 'Sonic', 'Radiation', 'Force', 'Psychic']);
    const ATTRS = () => (typeof ATTRIBUTES !== 'undefined' ? ATTRIBUTES : ['STR', 'AGI', 'CON', 'PER', 'INT', 'CHA', 'LUC']);
    const traitsOf = st => ((st && st.ancestry && st.ancestry.traits) || []);
    const C = () => { try { return (typeof calc !== 'undefined' && calc) || {}; } catch (e) { return {}; } };
    let save = () => { window.recalculateMath?.(); window.scheduleAutoSave?.(); };

    // ── A small window ──
    function panel(title, accent) {
        document.getElementById('apxTraitPanel')?.remove();
        let back = document.createElement('div');
        back.id = 'apxTraitPanel';
        back.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(2,6,23,.65);display:flex;align-items:center;justify-content:center;padding:12px';
        back.innerHTML = `<div style="width:min(420px,100%);max-height:92vh;overflow:auto;background:#0f172a;border:1px solid ${accent};border-radius:.7rem;padding:.9rem;color:#e2e8f0;box-shadow:0 20px 60px rgba(0,0,0,.6);font-family:system-ui,sans-serif">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.35rem"><div style="font-size:1rem;font-weight:900;color:${accent}">${title}</div>
            <button data-x style="background:none;border:0;color:#94a3b8;font-size:1.05rem;cursor:pointer">✕</button></div><div data-body></div></div>`;
        document.body.appendChild(back);
        if (window.apxFront) try { window.apxFront(back); } catch (e) { }
        back.querySelector('[data-x]').onclick = () => back.remove();
        return back;
    }
    const chip = (on, accent) => `border:1px solid ${on ? accent : '#334155'};background:${on ? 'rgba(255,255,255,.07)' : '#0b1220'};color:${on ? '#fff' : '#cbd5e1'};border-radius:.35rem;padding:.3rem .55rem;font-size:.72rem;font-weight:800;cursor:pointer`;

    // A picture of the area: the creature (yellow) and the squares it hits
    function areaSvg(shape) {
        let cs = 18, n = 9, cx = 1, cy = 4, cells = [];
        let fa = { x0: cx, x1: cx, y0: cy, y1: cy, token: true };
        if (shape === 'line') for (let i = 1; i <= 6; i++) cells.push([cx + i, cy]);
        else if (window.APXBattle && window.APXBattle.areaCells) cells = window.APXBattle.areaCells(fa, { gx: cx + 3, gy: cy }, 'cone', 12, 3).cells.map(c => [c.gx, c.gy]);   // the battle map's own cone
        else for (let x = 2; x <= 4; x++) { let d = x - cx; for (let y = cy - Math.floor(d / 2); y <= cy + Math.floor(d / 2); y++) cells.push([x, y]); }
        let g = '';
        for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) g += `<rect x="${x * cs}" y="${y * cs}" width="${cs}" height="${cs}" fill="none" stroke="#1e293b"/>`;
        cells.forEach(([x, y]) => { g += `<rect x="${x * cs + 1}" y="${y * cs + 1}" width="${cs - 2}" height="${cs - 2}" fill="rgba(251,146,60,.45)" stroke="#fb923c"/>`; });
        g += `<circle cx="${cx * cs + cs / 2}" cy="${cy * cs + cs / 2}" r="${cs / 2.6}" fill="#facc15" stroke="#000"/>`;
        if (shape !== 'line') {   // the cone as drawn: from the edge of your space, as wide at its end as it is long
            let ax = (cx + 1) * cs, ay = cy * cs + cs / 2, R = 3 * cs, h = Math.atan(0.5);
            g += `<path d="M${ax},${ay} L${ax + R * Math.cos(-h)},${ay + R * Math.sin(-h)} A${R},${R} 0 0 1 ${ax + R * Math.cos(h)},${ay + R * Math.sin(h)} Z" fill="none" stroke="#fdba74" stroke-dasharray="4 3"/>`;
        }
        return `<svg width="${n * cs}" height="${n * cs}" viewBox="0 0 ${n * cs} ${n * cs}" style="display:block;margin:0 auto;background:#020617;border-radius:.4rem">${g}</svg>`;
    }

    // ── Discharging Internals ──
    function disPower(o) {
        let shape = o.shape === 'line' ? 'line' : 'cone', size = shape === 'line' ? 6 : 3;
        return {
            trait: 't_dis', name: 'Discharging Internals', lvl: 1, ap: 3, attr: o.attr,
            atk: 'Save Halves', rng: shape === 'line' ? '6-sq Line' : '3-sq Cone', dmg: '3d6 ' + o.type,
            desc: `Fire breath, an integrated taser, a plasma vent: everything in your ${shape === 'line' ? '6-square Line' : '3-square Cone'} makes an AGI saving throw (DC 10 + your ${o.attr} modifier) or takes 3d6 ${o.type} damage, half on a success. Once per Short Rest.`,
            usesMax: 1, used: o.used || 0, shape, energy: o.type,
            draft: { step1: 'saveHalves', saveAttr: 'AGI', step2: 'touch', aoe: 'aoe', aoeShape: shape, aoeSize: size,
                dmg: { d4: 0, d6: 3, d8: 0, d10: 0, d12: 0 }, isHealing: false, dmgType: o.type, coreAttr: o.attr,
                utility: { minor: {}, moderate: {}, major: {}, master: {}, mythic: {} }, duration: 'instant', durationMods: {}, apMod: 'ap3', refunds: {} }
        };
    }
    window.apxDischargeSetup = function (idx) {
        let st = window.state; if (!st) return;
        let cur = idx != null ? (st.traitPowers || [])[idx] : null;
        let bestAttr = ATTRS().slice().sort((a, b) => ((C().mods || {})[b] || 0) - ((C().mods || {})[a] || 0))[0];
        let d = { shape: cur ? cur.shape : 'cone', type: cur ? cur.energy : 'Fire', attr: cur ? cur.attr : bestAttr };
        let back = panel('Discharging Internals', '#fb923c'), body = back.querySelector('[data-body]');
        let draw = () => {
            let mod = (C().mods || {})[d.attr] || 0;
            body.innerHTML = `<div style="font-size:.7rem;color:#94a3b8;line-height:1.35;margin-bottom:.5rem">Fire breath, integrated taser, or plasma vent. Once per Short Rest, 3 AP: 3d6 Energy damage to everything in your area. They make an AGI saving throw and take half on a success.</div>
                <div style="display:flex;gap:.4rem;justify-content:center;margin-bottom:.45rem">
                    <button data-shape="cone" style="${chip(d.shape === 'cone', '#fb923c')}">3-square Cone</button>
                    <button data-shape="line" style="${chip(d.shape === 'line', '#fb923c')}">6-square Line</button></div>
                ${areaSvg(d.shape)}
                <div style="font-size:.72rem;font-weight:900;margin:.6rem 0 .25rem">Energy damage type</div>
                <div style="display:flex;flex-wrap:wrap;gap:.3rem">${ENERGY().map(t => `<button data-type="${t}" style="${chip(d.type === t, '#fb923c')}">${t}</button>`).join('')}</div>
                <div style="font-size:.72rem;font-weight:900;margin:.6rem 0 .25rem;display:flex;align-items:center;gap:.3rem;flex-wrap:wrap">Save DC: 10 + your <select data-attr style="width:auto !important;display:inline-block;padding:.1rem .3rem;background:#1e293b;border:1px solid #334155;color:#e2e8f0;border-radius:.3rem;font-size:.72rem">${ATTRS().map(a => `<option ${a === d.attr ? 'selected' : ''}>${a}</option>`).join('')}</select> modifier = <b style="color:#fdba74">${10 + mod}</b></div>
                <div style="display:flex;justify-content:flex-end;gap:.4rem;margin-top:.7rem">
                    <button data-ok style="background:#c2410c;border:1px solid #fb923c;color:#fff;border-radius:.35rem;padding:.35rem .9rem;font-size:.75rem;font-weight:900;cursor:pointer">${cur ? 'Save' : 'Add the power'}</button></div>`;
            body.querySelectorAll('[data-shape]').forEach(b => b.onclick = () => { d.shape = b.dataset.shape; draw(); });
            body.querySelectorAll('[data-type]').forEach(b => b.onclick = () => { d.type = b.dataset.type; draw(); });
            body.querySelector('[data-attr]').onchange = e => { d.attr = e.target.value; draw(); };
            body.querySelector('[data-ok]').onclick = () => {
                st.traitPowers = Array.isArray(st.traitPowers) ? st.traitPowers : [];
                let pw = disPower(Object.assign({}, d, { used: cur ? cur.used : 0 }));
                if (cur) st.traitPowers[idx] = pw; else st.traitPowers.push(pw);
                back.remove(); save();
                window.APXDice?.notify(`Discharging Internals: ${pw.rng} of ${d.type}, in your Powers.`, { kind: 'note' });
            };
        };
        draw();
    };
    window.apxTraitPowerEdit = function (i) {
        let p = ((window.state || {}).traitPowers || [])[i]; if (!p) return;
        if (p.trait === 't_dis') window.apxDischargeSetup(i);
    };

    // ── Integrated Equipment ──
    window.apxIntegratedPick = function (onDone) {
        let st = window.state; if (!st) return;
        let gear = typeof ADVENTURING_GEAR !== 'undefined' ? ADVENTURING_GEAR : [];
        let back = panel('Integrated Equipment', '#22d3ee'), body = back.querySelector('[data-body]');
        let q = '';
        let draw = () => {
            let list = gear.filter(g => !q || (g.name + ' ' + g.cat).toLowerCase().includes(q));
            let cats = [...new Set(list.map(g => g.cat))];
            body.innerHTML = `<div style="font-size:.7rem;color:#94a3b8;line-height:1.35;margin-bottom:.5rem">Choose a piece of standard gear built into your body: hidden from view, and it can't be disarmed. It goes in your inventory as "(Integrated)".</div>
                <input data-q value="${esc(q)}" placeholder="Search gear…" style="width:100%;background:#1e293b;border:1px solid #334155;border-radius:.3rem;padding:.3rem .45rem;color:#e2e8f0;font-size:.75rem;margin-bottom:.4rem">
                <div style="max-height:52vh;overflow:auto">${cats.map(c => `<div style="font-size:.62rem;font-weight:900;color:#67e8f9;text-transform:uppercase;margin:.35rem 0 .15rem">${esc(c)}</div>`
                    + list.filter(g => g.cat === c).map(g => `<button data-g="${esc(g.name)}" style="display:block;width:100%;text-align:left;border:1px solid #1e293b;background:#0b1220;color:#e2e8f0;border-radius:.3rem;padding:.3rem .45rem;margin-bottom:.2rem;cursor:pointer">
                        <span style="font-size:.74rem;font-weight:800">${esc(g.name)}</span><span style="display:block;font-size:.62rem;color:#94a3b8;line-height:1.3">${esc(g.desc || '')}</span></button>`).join('')).join('') || '<div style="font-size:.7rem;color:#94a3b8">Nothing matches.</div>'}</div>`;
            let qi = body.querySelector('[data-q]');
            qi.oninput = e => { q = e.target.value.toLowerCase(); draw(); let n = body.querySelector('[data-q]'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
            body.querySelectorAll('[data-g]').forEach(b => b.onclick = () => {
                let g = gear.find(x => x.name === b.dataset.g); if (!g) return;
                (st.items = st.items || []).unshift({ name: g.name + ' (Integrated)', wt: 0, ct: 1, val: 0, integrated: true,
                    desc: (g.desc ? g.desc + ' ' : '') + 'Integrated Equipment (Ancestry Trait): built into your body, hidden from view, and it can\'t be disarmed.' });
                back.remove(); save();
                window.APXDice?.notify(`${g.name} (Integrated) is in your inventory.`, { kind: 'note' });
                if (onDone) setTimeout(onDone, 300);
            });
        };
        draw();
    };

    // ── The Ancestry Traits note ──
    function traitNoteText(st) {
        let defs = typeof ANCESTRY_TRAITS !== 'undefined' ? ANCESTRY_TRAITS : [], fdefs = typeof ANCESTRY_FLAWS !== 'undefined' ? ANCESTRY_FLAWS : [];
        let count = ids => ids.reduce((m, id) => (m[id] = (m[id] || 0) + 1, m), {});
        let line = (defsList, id, n) => { let d = defsList.find(x => x.id === id); return d ? `• ${d.name}${n > 1 ? ' ×' + n : ''}: ${d.desc}` : null; };
        let t = count(traitsOf(st)), f = count((st.ancestry && st.ancestry.flaws) || []);
        let out = Object.keys(t).map(id => line(defs, id, t[id])).filter(Boolean);
        let fl = Object.keys(f).map(id => line(fdefs, id, f[id])).filter(Boolean);
        (st.traitPowers || []).forEach(p => { if (p.trait === 't_dis') out = out.map(l => l.startsWith('• Discharging Internals') ? l + ` (yours: ${p.rng} of ${p.energy}, DC 10 + ${p.attr})` : l); });
        let integ = (st.items || []).filter(i => i && i.integrated).map(i => i.name.replace(/ \(Integrated\)$/, ''));
        if (integ.length) out = out.map(l => l.startsWith('• Integrated Equipment') ? l + ` (yours: ${integ.join(', ')})` : l);
        return out.join('\n') + (fl.length ? (out.length ? '\n\n' : '') + 'Flaws:\n' + fl.join('\n') : '');
    }
    function syncTraitNote(st) {
        let text = traitNoteText(st);
        st.charNotes = st.charNotes || [];
        let n = st.charNotes.find(x => x && x.autoTraits);
        if (!text) return false;
        if (!n) {
            st.charNotes.push({ id: 'cn_traits_' + Date.now(), title: 'Ancestry Traits', session: 0, date: window.apxToday ? window.apxToday() : '', content: text, autoTraits: true, autoText: text });
            return true;
        }
        // Kept up to date as long as it hasn't been edited by hand
        if (n.content === n.autoText && n.content !== text) { n.content = text; n.autoText = text; return true; }
        return false;
    }

    // ── Asking (new characters, and ones made before this) ──
    let waitT = null, askedDis = false, askedInteq = false;
    function busy() {
        return !!(document.querySelector('.apxtut-back,[data-apx-rules-popup],#apxTraitPanel,#apxExoForge') ||
            [...document.querySelectorAll('.modal.active,[id$="Modal"].active')].length);
    }
    let forChar = null;
    window.apxTraitSetupCheck = function () {
        let st = window.state; if (!st || !st.ancestry || !document.getElementById('charName')) return;
        let who = window._activeCloudCharId || st.id || st.name || '';
        if (who !== forChar) { forChar = who; askedDis = false; askedInteq = false; }
        if (syncTraitNote(st)) { window.renderCharNotes?.(); window.scheduleAutoSave?.(); }
        let traits = traitsOf(st);
        let needDis = traits.includes('t_dis') && !(st.traitPowers || []).some(p => p.trait === 't_dis');
        let inteqWant = traits.filter(t => t === 't_inteq').length, inteqHave = (st.items || []).filter(i => i && i.integrated).length;
        let needInteq = inteqHave < inteqWant;
        if (!needDis && !needInteq) return;
        if (busy()) { clearTimeout(waitT); waitT = setTimeout(window.apxTraitSetupCheck, 2000); return; }
        if (needDis && !askedDis) { askedDis = true; window.apxDischargeSetup(); return; }
        if (needInteq && !askedInteq) {
            askedInteq = true;
            let left = inteqWant - inteqHave;
            window.apxIntegratedPick(() => { askedInteq = false; window.apxTraitSetupCheck(); });
            if (left > 1) window.APXDice?.notify(`Integrated Equipment: choose ${left} pieces of gear, one at a time.`, { kind: 'note' });
        }
    };
    // After the sheet settles (and whenever it recalculates, e.g. after the Race Builder)
    let t0 = null;
    window.apxTraitSetupSoon = function () { clearTimeout(t0); t0 = setTimeout(() => { try { window.apxTraitSetupCheck(); } catch (e) { console.warn('Traits:', e); } }, 1500); };
    // A new character (or a different one) asks again
    window.apxTraitSetupReset = function () { askedDis = false; askedInteq = false; };
})();
