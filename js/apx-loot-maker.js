// ============================================================
// APX Loot Maker (GM Tools)
// ============================================================
// Lets the GM make loot the same ways players get gear: the Weapon Forge,
// the Armor Forge, Shields and Helmets, the Adventuring Gear list, custom
// weapons and custom items. Loot goes either to the general Loot list
// (initiative panel) or into an Area Circle on a map, where each item has a
// "Give to" dropdown and the area can hold Currency to give to one player or
// split across the party.
//
// Area loot is stored on the map token:  tok.loot = { items: [{ id, item }], cu }
// (GM-only: saved with the private world data, never published to players).
// ============================================================
(function () {
    'use strict';
    const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
    const notes = () => (typeof _wNotes !== 'undefined' && _wNotes) ? _wNotes : null;
    const save = () => { if (typeof window.saveWorldNotes === 'function') window.saveWorldNotes(); };
    const party = () => (window.gmParty || []).map(p => ({ uid: p.fileName, name: p.summary?.name || p.state?.name || 'Player' }));
    window._gmLootSel = window._gmLootSel || {};

    // ── Item helpers ─────────────────────────────────────────────
    function kindOf(it) {
        return it.isWeapon ? 'Weapon' : it.isArmor ? 'Armor' : it.isShield ? 'Shield' : it.isHelmet ? 'Helmet' : it.isConsumable ? 'Consumable' : it.isCustomEquippable ? 'Equippable' : 'Item';
    }
    function statsOf(it) {
        if (it.isWeapon) { let w = it.weaponData || {}; return `${w.dmg || '?'}${w.dmgType ? ' ' + w.dmgType : ''}, ${w.ap || '?'} AP`; }
        if (it.isArmor) { let a = it.armorData || {}; return `+${a.ac || 0} AC, +${a.dr || 0} DR, +${a.er || 0} ER`; }
        if (it.isShield) return '+2 AC/DR/ER';
        if (it.isHelmet) return '+1 AC/DR/ER';
        if (it.isConsumable) {
            let sum = null; try { sum = it.draft && window.ccBuildTextSummary ? window.ccBuildTextSummary(it.draft) : null; } catch (e) { }
            let ch = it.charges > 1 ? `${it.chargesRemaining ?? it.charges}/${it.charges} charges` : '1 use';
            return [ch, sum && sum.dmg && sum.dmg !== '-' ? sum.dmg : '', sum && sum.utilityBits && sum.utilityBits.length ? sum.utilityBits.join(', ') : ''].filter(Boolean).join(' · ');
        }
        let b = it.bonuses || {};
        let bits = [b.ac ? `+${b.ac} AC` : '', b.dr ? `+${b.dr} DR` : '', b.er ? `+${b.er} ER` : '', b.speedBonus ? `+${b.speedBonus} Speed` : ''].filter(Boolean);
        return bits.length ? bits.join(', ') : (it.desc || '');
    }
    window.apxLootKind = kindOf; window.apxLootStats = statsOf;
    function weaponItem(w) {
        let wd = JSON.parse(JSON.stringify(w)); delete wd.aimed; delete wd.twoHanded;
        return { name: w.name, wt: w.weight || 0, ct: 1, val: w.paidCost || 0, isWeapon: true, isLocked: true, weaponData: wd, desc: `Weapon: ${w.dmg} damage, ${w.ap} AP` };
    }
    function armorItem(a) {
        return { name: a.name || 'Armor', wt: a.wt || 0, ct: 1, val: a.paidCost || 0, isArmor: true, isLocked: true, armorData: JSON.parse(JSON.stringify(a)), desc: `Armor: +${a.ac} AC, +${a.dr} DR, +${a.er} ER` };
    }
    const SHIELD = () => ({ name: 'Shield', wt: 6, ct: 1, val: 50, isShield: true, isLocked: true, desc: 'Shield: +2 AC/DR/ER' });
    const HELMET = () => ({ name: 'Helmet', wt: 3, ct: 1, val: 30, isHelmet: true, isLocked: true, desc: 'Helmet: +1 AC/DR/ER' });

    // ── Where loot goes ──────────────────────────────────────────
    function areaTok(mapId, tokId) {
        let n = notes(); let map = (n?.otherMaps || []).find(m => m.id === mapId);
        return map?.tokens?.find(t => t.id === tokId) || null;
    }
    function areaLoot(tok) {
        if (!tok.loot || typeof tok.loot !== 'object') tok.loot = { items: [], cu: 0 };
        if (!Array.isArray(tok.loot.items)) tok.loot.items = [];
        tok.loot.cu = Math.max(0, parseInt(tok.loot.cu) || 0);
        return tok.loot;
    }
    function areaLabel(tok) { return `Area ${tok.letter}${tok.name ? ' (' + tok.name + ')' : ''}`; }
    // NPC stat blocks (NPC Crafter) carry their own gear: npc.carriedItems = [{ id, item }], npc.carriedCu
    function npcOf(npcId) { return (window.gmNpcs || []).find(n => n.id === npcId)?.npc || null; }
    function npcLoot(c) {
        if (!Array.isArray(c.carriedItems)) c.carriedItems = [];
        c.carriedCu = Math.max(0, parseInt(c.carriedCu) || 0);
        return c;
    }
    window.apxNpcCarried = npcLoot;
    function saveNpcs() {
        if (window.apxAuth?.enabled && window.apxAuth.saveGmNpcs) window.apxAuth.saveGmNpcs(window.gmNpcs || []).catch(e => console.warn('NPC save failed:', e.message));
    }
    function resolve(t) {
        if (t && t.kind === 'area') {
            let tok = areaTok(t.mapId, t.tokId); if (!tok) return null;
            let loot = areaLoot(tok);
            return { items: loot.items, tok, label: areaLabel(tok), cu: () => loot.cu, setCu: v => { loot.cu = v; }, save };
        }
        if (t && t.kind === 'npc') {
            let c = npcOf(t.npcId); if (!c) return null;
            npcLoot(c);
            return { items: c.carriedItems, npc: c, label: `${c.name || 'this NPC'}'s gear`, cu: () => c.carriedCu, setCu: v => { c.carriedCu = v; }, save: saveNpcs };
        }
        return { items: window._gmLootList ? window._gmLootList() : [], tok: null, label: 'the Loot list', save };
    }
    function refreshAll(t) {
        window.renderGmLoot && window.renderGmLoot();
        if (t && t.kind === 'area') window.apxRefreshAreaLoot(t.mapId, t.tokId);
        if (t && t.kind === 'npc') refreshNpcViews(t.npcId);
        renderMaker();
    }
    function refreshNpcViews(npcId) {
        // NPC Crafter (if this NPC is open), stat blocks, and world NPC windows linked to it
        try { if (typeof ncTarget !== 'undefined' && ncTarget === 'gm' && typeof ncActiveGmNpcId !== 'undefined' && ncActiveGmNpcId === npcId && document.getElementById('npcCrafterModal')?.classList.contains('active')) ncRenderAll(); } catch (e) { }
        window.refreshOpenStatBlocks && window.refreshOpenStatBlocks();
        document.querySelectorAll(`[data-npc-loot="${npcId}"]`).forEach(el => { el.innerHTML = window.apxNpcLootHtml(npcId); });
    }
    function addTo(t, item) {
        let r = resolve(t); if (!r) return;
        r.items.push(r.tok || r.npc ? { id: uid(), item } : { id: uid(), from: 'Loot Maker', item });
        r.save(); refreshAll(t);
        window.APXDice?.notify(`${item.ct > 1 ? item.ct + '× ' : ''}${item.name} added to ${r.label}.`, { kind: 'loot' });
    }
    window.apxAddLoot = addTo;

    // ── Loot Maker panel ─────────────────────────────────────────
    let maker = null;   // { target, view }
    const inCss = 'background:#0f172a;border:1px solid #334155;color:#e2e8f0;font-size:.75rem;border-radius:.3rem;padding:.3rem .45rem;width:100%;box-sizing:border-box';
    const lbl = 'display:block;font-size:.62rem;color:#94a3b8;font-weight:800;text-transform:uppercase;margin-bottom:.15rem';
    function field(label, html) { return `<div><label style="${lbl}">${label}</label>${html}</div>`; }

    window.openLootMaker = function (target) {
        maker = { target: target || { kind: 'pool' }, view: 'home', gearQ: '' };
        if (window.apxInjectDialogStyles) window.apxInjectDialogStyles();
        document.getElementById('apxLootMaker')?.remove();
        let back = document.createElement('div');
        back.id = 'apxLootMaker';
        back.className = 'apxdlg-back';
        back.style.zIndex = 2147482000;
        back.innerHTML = `<div class="apxdlg" style="width:min(640px,100%);max-height:92vh;display:flex;flex-direction:column;padding:0;overflow:hidden">
            <div style="padding:.8rem 1rem .6rem;border-bottom:1px solid #334155;display:flex;align-items:center;gap:.5rem">
                <div style="flex:1;min-width:0"><div class="apxdlg-title" style="margin:0">Loot Maker</div><div data-lm-where style="font-size:.7rem;color:#94a3b8"></div></div>
                <button data-lm-close class="apxdlg-btn apxdlg-ok">Done</button></div>
            <div data-lm-body style="overflow-y:auto;padding:.8rem 1rem;flex:1"></div></div>`;
        back.addEventListener('mousedown', e => { if (e.target === back) window.closeLootMaker(); });
        back.querySelector('[data-lm-close]').onclick = () => window.closeLootMaker();
        document.body.appendChild(back);
        renderMaker();
    };
    window.closeLootMaker = function () { document.getElementById('apxLootMaker')?.remove(); maker = null; };

    function sourceBtn(view, title, sub, color) {
        let on = maker.view === view;
        return `<button data-lm-view="${view}" style="text-align:left;padding:.5rem .6rem;border-radius:.45rem;border:1px solid ${on ? color : '#334155'};background:${on ? 'rgba(99,102,241,.15)' : '#0f172a'};color:#e2e8f0;cursor:pointer">
            <div style="font-weight:900;font-size:.78rem;color:${color}">${title}</div><div style="font-size:.62rem;color:#94a3b8;font-weight:600">${sub}</div></button>`;
    }
    function renderMaker() {
        let back = document.getElementById('apxLootMaker'); if (!back || !maker) return;
        let r = resolve(maker.target);
        if (!r) { window.closeLootMaker(); return; }
        back.querySelector('[data-lm-where]').textContent = `Adding to ${r.label}`;
        let body = back.querySelector('[data-lm-body]');
        let view = maker.view;
        let form = '';
        if (view === 'gear') {
            let q = (maker.gearQ || '').toLowerCase();
            let gear = (typeof ADVENTURING_GEAR !== 'undefined' ? ADVENTURING_GEAR : []).filter(g => !q || g.name.toLowerCase().includes(q) || (g.cat || '').toLowerCase().includes(q));
            form = `<input data-lm-gearq placeholder="Search gear…" value="${esc(maker.gearQ)}" style="${inCss};margin-bottom:.5rem">
                <div style="max-height:240px;overflow-y:auto;border:1px solid #334155;border-radius:.4rem">
                ${gear.map(g => `<div style="display:flex;align-items:center;gap:.5rem;padding:.3rem .5rem;border-bottom:1px solid #1e293b">
                    <div style="flex:1;min-width:0"><div style="font-size:.75rem;font-weight:800;color:#fde68a">${esc(g.name)} <span style="font-size:.6rem;color:#64748b;font-weight:700">${esc(g.cat || '')}</span></div>
                        <div style="font-size:.62rem;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(g.desc || '')}</div></div>
                    <span style="font-size:.62rem;color:#94a3b8;white-space:nowrap">${g.wt} wt · ${g.cost} Cu</span>
                    <input type="number" min="1" value="1" data-lm-gqty style="${inCss};width:3.2rem;text-align:center">
                    <button data-lm-gadd="${esc(g.name)}" class="apxdlg-btn apxdlg-ok" style="padding:.25rem .6rem;font-size:.7rem">Add</button></div>`).join('') || '<div style="padding:.6rem;font-size:.7rem;color:#64748b">No gear matches.</div>'}
                </div>`;
        } else if (view === 'cweapon') {
            form = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
                ${field('Name', `<input data-cw="name" placeholder="Rusty Cleaver" style="${inCss}">`)}
                ${field('Damage', `<input data-cw="dmg" value="1d6" style="${inCss}">`)}
                ${field('Category', `<select data-cw="category" style="${inCss}"><option value="melee">Melee</option><option value="ranged">Ranged</option></select>`)}
                ${field('Attribute', `<select data-cw="attr" style="${inCss}">${['STR', 'AGI', 'CON', 'PER', 'INT', 'CHA', 'LUC'].map(a => `<option>${a}</option>`).join('')}</select>`)}
                ${field('Weight class', `<select data-cw="wc" style="${inCss}"><option value="light">Light (2 AP)</option><option value="medium">Medium (3 AP)</option><option value="heavy">Heavy (4 AP, two hands)</option></select>`)}
                ${field('Weight / Value (Cu)', `<div style="display:flex;gap:.3rem"><input data-cw="wt" type="number" min="0" step="0.5" value="2" style="${inCss}"><input data-cw="val" type="number" min="0" value="0" style="${inCss}"></div>`)}
                <div style="grid-column:1/-1">${field('Notes', `<input data-cw="notes" placeholder="Special properties, history…" style="${inCss}">`)}</div>
                </div><div style="text-align:right;margin-top:.6rem"><button data-lm-cwadd class="apxdlg-btn apxdlg-ok">Add Weapon</button></div>`;
        } else if (view === 'citem') {
            form = `<div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:.5rem">
                ${field('Name', `<input data-ci="name" placeholder="Silver Locket" style="${inCss}">`)}
                ${field('Weight', `<input data-ci="wt" type="number" min="0" step="0.1" value="0" style="${inCss}">`)}
                ${field('Value (Cu)', `<input data-ci="val" type="number" min="0" value="0" style="${inCss}">`)}
                ${field('Count', `<input data-ci="ct" type="number" min="1" value="1" style="${inCss}">`)}
                <div style="grid-column:1/-1">${field('Description', `<textarea data-ci="desc" rows="2" placeholder="What is it? What does it do?" style="${inCss};resize:vertical"></textarea>`)}</div>
                <label style="grid-column:1/-1;display:flex;align-items:center;gap:.4rem;font-size:.72rem;color:#cbd5e1;cursor:pointer"><input type="checkbox" data-ci="eq"> Equippable (gives bonuses while worn)</label>
                <div data-ci-bonus style="grid-column:1/-1;display:none;grid-template-columns:repeat(4,1fr);gap:.5rem">
                    ${['ac:AC', 'dr:DR', 'er:ER', 'speed:Speed'].map(x => { let [k, l] = x.split(':'); return field('+' + l, `<input data-ci="${k}" type="number" value="0" style="${inCss}">`); }).join('')}
                </div></div>
                <div style="text-align:right;margin-top:.6rem"><button data-lm-ciadd class="apxdlg-btn apxdlg-ok">Add Item</button></div>`;
        }
        let items = r.items;
        let listHtml = items.length ? items.map(l => `<div style="display:flex;align-items:center;gap:.4rem;padding:.3rem .5rem;border:1px solid #334155;border-radius:.35rem;margin-bottom:.25rem;background:#0f172a">
                <span style="font-size:.74rem;font-weight:800;color:#fde68a">${esc(l.item.name)}${l.item.ct > 1 ? ` ×${l.item.ct}` : ''}</span>
                <span style="font-size:.62rem;color:#94a3b8;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${kindOf(l.item)} · ${esc(statsOf(l.item))}</span>
                <button data-lm-del="${esc(l.id)}" title="Remove" style="background:#334155;border:none;color:#cbd5e1;border-radius:.25rem;width:1.3rem;height:1.3rem;cursor:pointer;font-weight:900">✕</button></div>`).join('')
            : `<div style="font-size:.7rem;color:#64748b">Nothing here yet.</div>`;
        body.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:.4rem;margin-bottom:.7rem">
                ${sourceBtn('wforge', 'Weapon Forge', 'Build a weapon step by step', '#fca5a5')}
                ${sourceBtn('aforge', 'Armor Forge', 'Build armor from mods', '#93c5fd')}
                ${sourceBtn('consumable', 'Consumable', 'Potions, grenades, scrolls…', '#f0abfc')}
                ${sourceBtn('gear', 'Adventuring Gear', 'Pick from the gear list', '#fde68a')}
                ${sourceBtn('cweapon', 'Custom Weapon', 'Quick weapon: damage, AP, weight', '#fdba74')}
                ${sourceBtn('citem', 'Custom Item', 'Anything else, equippable or not', '#c4b5fd')}
                ${sourceBtn('shield', 'Shield', '+2 AC/DR/ER, one hand', '#86efac')}
                ${sourceBtn('helmet', 'Helmet', '+1 AC/DR/ER', '#86efac')}
            </div>
            ${form ? `<div style="border:1px solid #334155;border-radius:.5rem;padding:.6rem;margin-bottom:.8rem;background:rgba(15,23,42,.6)">${form}</div>` : ''}
            <div style="${lbl};margin-bottom:.35rem">In ${esc(r.label)} (${items.length})</div>
            ${listHtml}
            ${r.cu ? `<div style="display:flex;align-items:center;gap:.5rem;margin-top:.6rem;font-size:.72rem;color:#cbd5e1">
                <label style="display:flex;align-items:center;gap:.35rem">${r.npc ? 'Currency carried' : 'Currency here'} <input data-lm-cu type="number" min="0" value="${r.cu()}" style="${inCss};width:5rem;text-align:center"> Cu</label>
                <span style="color:#64748b;font-size:.65rem">${r.npc ? 'Dropped with its gear when it dies.' : 'Hand it out from the area\'s popup.'}</span></div>` : ''}`;
        // Wire up
        body.querySelectorAll('[data-lm-view]').forEach(b => b.onclick = () => {
            let v = b.dataset.lmView;
            if (v === 'wforge') return openForge('weapon');
            if (v === 'aforge') return openForge('armor');
            if (v === 'consumable') return openForge('consumable');
            if (v === 'shield') return addTo(maker.target, SHIELD());
            if (v === 'helmet') return addTo(maker.target, HELMET());
            maker.view = maker.view === v ? 'home' : v; renderMaker();
        });
        body.querySelectorAll('[data-lm-del]').forEach(b => b.onclick = () => {
            let r2 = resolve(maker.target); let i = r2.items.findIndex(x => x.id === b.dataset.lmDel);
            if (i >= 0) { r2.items.splice(i, 1); r2.save(); refreshAll(maker.target); }
        });
        let cu = body.querySelector('[data-lm-cu]');
        if (cu) cu.onchange = () => { let r2 = resolve(maker.target); r2.setCu(Math.max(0, parseInt(cu.value) || 0)); r2.save(); refreshAll(maker.target); };
        let gq = body.querySelector('[data-lm-gearq]');
        if (gq) { gq.oninput = () => { maker.gearQ = gq.value; let pos = gq.selectionStart; renderMaker(); let n = document.querySelector('#apxLootMaker [data-lm-gearq]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }; }
        body.querySelectorAll('[data-lm-gadd]').forEach(b => b.onclick = () => {
            let g = ADVENTURING_GEAR.find(x => x.name === b.dataset.lmGadd); if (!g) return;
            let qty = Math.max(1, parseInt(b.parentElement.querySelector('[data-lm-gqty]').value) || 1);
            if (g.cat === 'Ammo') {
                // Ammo is carried as single rounds (a bundle is 20)
                let name = g.stack || g.name.replace(/\s*\(20\)\s*$/, '');
                addTo(maker.target, { name, wt: g.wt / 20, ct: 20 * qty, val: g.cost / 20, desc: g.desc });
            } else addTo(maker.target, { name: g.name, wt: g.wt, ct: qty, val: g.cost, desc: g.desc });
        });
        let cwb = body.querySelector('[data-lm-cwadd]');
        if (cwb) cwb.onclick = () => {
            let v = k => body.querySelector(`[data-cw="${k}"]`).value;
            let name = v('name').trim() || 'Custom Weapon';
            let dmg = v('dmg').trim() || '1d6';
            if (!/^\d+d\d+([+-]\d+)?$/i.test(dmg.replace(/\s+/g, ''))) { window.apxAlert('Damage should look like 1d6 or 2d8+1.'); return; }
            let wc = v('wc'), apMap = { light: 2, medium: 3, heavy: 4 };
            let w = { name, attr: v('attr'), tr: false, dmg: dmg.replace(/\s+/g, ''), ap: apMap[wc] || 2, isUnarmed: false, isCustom: true,
                category: v('category'), weightClass: wc, weight: parseFloat(v('wt')) || 0, paidCost: parseInt(v('val')) || 0, notes: v('notes').trim() };
            addTo(maker.target, weaponItem(w));
        };
        let ci = body.querySelector('[data-ci="eq"]');
        if (ci) ci.onchange = () => { body.querySelector('[data-ci-bonus]').style.display = ci.checked ? 'grid' : 'none'; };
        let cib = body.querySelector('[data-lm-ciadd]');
        if (cib) cib.onclick = () => {
            let v = k => body.querySelector(`[data-ci="${k}"]`);
            let name = v('name').value.trim();
            if (!name) { window.apxAlert('Give the item a name.'); return; }
            let item = { name, wt: parseFloat(v('wt').value) || 0, ct: Math.max(1, parseInt(v('ct').value) || 1), val: parseInt(v('val').value) || 0, desc: v('desc').value.trim() };
            if (v('eq').checked) {
                item.isCustomEquippable = true; item.equipped = false;
                item.bonuses = { ac: parseInt(v('ac').value) || 0, dr: parseInt(v('dr').value) || 0, er: parseInt(v('er').value) || 0, speedBonus: parseInt(v('speed').value) || 0, attrBonuses: [], skillBonuses: [], erBonuses: [] };
            }
            addTo(maker.target, item);
        };
    }

    // Weapon / Armor Forge in "loot" mode: the forge sits above the Loot Maker, then hands the result back
    function openForge(which) {
        if (!maker) return;
        window._lootMakerTarget = maker.target;
        let id = which === 'weapon' ? 'weaponForgeModal' : which === 'armor' ? 'armorForgeModal' : 'consumableCrafterModal';
        const MODALS = ['weaponForgeModal', 'weaponCraftModal', 'armorForgeModal', 'armorCraftModal', 'consumableCrafterModal'];
        MODALS.forEach(m => { let el = document.getElementById(m); if (el) { el.dataset.lmZ = el.dataset.lmZ || el.style.zIndex; el.style.zIndex = 2147482500; } });
        if (which === 'weapon') window.openWeaponForge(null, 'loot');
        else if (which === 'armor') window.openArmorForge('loot');
        else {
            let t = maker.target;
            window.openConsumableCrafter({ label: t.kind === 'npc' ? 'Give to NPC' : 'Add to Loot', onMade: item => addTo(t, item) });
        }
        // Put the z-order back once the forge closes (made something or cancelled)
        let el = document.getElementById(id);
        let watch = setInterval(() => {
            if (el && el.classList.contains('active')) return;
            clearInterval(watch);
            MODALS.forEach(m => { let e = document.getElementById(m); if (e && e.dataset.lmZ !== undefined) { e.style.zIndex = e.dataset.lmZ; delete e.dataset.lmZ; } });
        }, 300);
    }
    window._lootMakerReceive = function (made) {
        let t = window._lootMakerTarget || (maker && maker.target) || { kind: 'pool' };
        if (made.weapon) addTo(t, weaponItem(made.weapon));
        if (made.armor) addTo(t, armorItem(made.armor));
    };

    // ── Loot section (Area Circle popups, world NPC windows) ──────
    // Targets are named by a key so the inline handlers stay simple:
    //   'area|<mapId>|<tokId>'  or  'npc|<gmNpcId>'
    function keyOf(t) { return t.kind === 'area' ? `area|${t.mapId}|${t.tokId}` : `npc|${t.npcId}`; }
    function fromKey(k) { let p = String(k).split('|'); return p[0] === 'area' ? { kind: 'area', mapId: p[1], tokId: p[2] } : { kind: 'npc', npcId: p[1] }; }
    function sectionHtml(t) {
        let r = resolve(t); if (!r) return '';
        let key = keyOf(t);
        let pl = party(), ids = new Set(pl.map(p => p.uid)), sel = window._gmLootSel;
        let opts = cur => pl.map(p => `<option value="${esc(p.uid)}" ${p.uid === cur ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
        let s = 'background:#0f172a;border:1px solid #334155;color:#e2e8f0;font-size:.65rem;border-radius:.25rem;padding:.15rem .25rem';
        let btn = (bg, bd, c) => `background:${bg};border:1px solid ${bd};color:${c};font-size:.62rem;font-weight:800;padding:.18rem .45rem;border-radius:.25rem;cursor:pointer`;
        let pool = t.kind === 'area' && window._gmLootList ? window._gmLootList() : [];
        let cuKey = 'cu_' + key;
        let cuTo = sel[cuKey] === '__split' || ids.has(sel[cuKey]) ? sel[cuKey] : '';
        let k = esc(key), cu = r.cu();
        let targetJs = t.kind === 'area' ? `{kind:'area',mapId:'${esc(t.mapId)}',tokId:'${esc(t.tokId)}'}` : `{kind:'npc',npcId:'${esc(t.npcId)}'}`;
        return `
            <div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.3rem">
                <span style="font-size:.65rem;color:#fcd34d;font-weight:800;text-transform:uppercase;flex:1">${t.kind === 'npc' ? 'Carried Loot' : 'Loot'}${r.items.length ? ` (${r.items.length})` : ''}</span>
                <button onclick="window.openLootMaker(${targetJs})" style="${btn('#312e81', '#4f46e5', '#c7d2fe')}">+ Loot Maker</button>
            </div>
            ${r.items.map(l => {
                let cur = ids.has(sel[l.id]) ? sel[l.id] : '';
                return `<div style="border:1px solid #334155;background:#0f172a;border-radius:.3rem;padding:.3rem .4rem;margin-bottom:.25rem">
                    <div style="font-size:.7rem;font-weight:800;color:#fde68a;line-height:1.2">${esc(l.item.name)}${l.item.ct > 1 ? ` ×${l.item.ct}` : ''}</div>
                    <div title="${esc(statsOf(l.item))}" style="font-size:.58rem;color:#94a3b8;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${kindOf(l.item)} · ${esc(statsOf(l.item))}</div>
                    <div style="display:flex;gap:.25rem;margin-top:.25rem">
                        <select onchange="window._gmLootSel['${esc(l.id)}']=this.value" style="${s};flex:1;min-width:0" ${pl.length ? '' : 'disabled'}><option value="">Give to…</option>${opts(cur)}</select>
                        <button onclick="window.apxGiveSectionLoot('${k}','${esc(l.id)}',this)" style="${btn('#047857', '#059669', '#fff')}">Give</button>
                        <button onclick="window.apxRemoveSectionLoot('${k}','${esc(l.id)}')" title="Remove" style="${btn('#1e293b', '#475569', '#cbd5e1')}">✕</button>
                    </div></div>`;
            }).join('') || `<div style="font-size:.62rem;color:#64748b;margin-bottom:.25rem">${t.kind === 'npc' ? 'Nothing carried. Items added here drop as loot when this NPC dies.' : 'No items. Use Loot Maker to stock this area.'}</div>`}
            ${pool.length ? `<select onchange="if(this.value){window.apxMoveLootToArea('${esc(t.mapId)}','${esc(t.tokId)}',this.value)}" style="${s};width:100%;margin-bottom:.3rem;color:#94a3b8">
                <option value="">Move an item here from the Loot list…</option>${pool.map(l => `<option value="${esc(l.id)}">${esc(l.item.name)}${l.from ? ' (' + esc(l.from) + ')' : ''}</option>`).join('')}</select>` : ''}
            <div style="display:flex;align-items:center;gap:.25rem;margin-top:.15rem">
                <input type="number" min="0" value="${cu || ''}" placeholder="0" title="${t.kind === 'npc' ? 'Currency carried' : 'Currency found here'}"
                    onchange="window.apxSetSectionCu('${k}',this.value)" style="${s};width:3.6rem;text-align:center">
                <span style="font-size:.62rem;color:#fcd34d;font-weight:800">Cu</span>
                <select onchange="window._gmLootSel['${esc(cuKey)}']=this.value" style="${s};flex:1;min-width:0" ${pl.length ? '' : 'disabled'}>
                    <option value="">Give to…</option><option value="__split" ${cuTo === '__split' ? 'selected' : ''}>Split among the party</option>${opts(cuTo)}</select>
                <button onclick="window.apxGiveSectionCu('${k}',this)" style="${btn('#047857', '#059669', '#fff')}" ${cu > 0 ? '' : 'disabled'}>Give</button>
            </div>
            ${pl.length ? '' : '<div style="font-size:.58rem;color:#64748b;margin-top:.2rem">Load the party to hand loot out.</div>'}`;
    }
    window.apxAreaLootHtml = (mapId, tokId) => sectionHtml({ kind: 'area', mapId, tokId });
    // Area Circle popup: loot lives on the NPCs linked to the area (their stat block's carried
    // gear), so a chest, a corpse or a merchant is simply an NPC placed there. Areas that
    // already had loot of their own keep it (shown below the NPCs).
    window.apxAreaLinkedLootHtml = function (mapId, tokId, winId) {
        let tok = areaTok(mapId, tokId); if (!tok) return '';
        let n = notes();
        let linked = (tok.linkedNpcs || []).map(id => (n?.npcs || []).find(w => w.id === id)).filter(Boolean);
        let withSb = linked.filter(w => w.statBlockId && (window.gmNpcs || []).some(g => g.id === w.statBlockId));
        let own = tok.loot && ((tok.loot.items || []).length || tok.loot.cu);
        let box = (inner, color) => `<div style="border:1px solid ${color};background:rgba(15,23,42,.35);border-radius:.35rem;padding:.4rem;margin-bottom:.35rem">${inner}</div>`;
        let parts = withSb.map(w => box(`<div style="font-size:.6rem;color:#f0abfc;font-weight:800;margin-bottom:.2rem">${esc(w.name || 'NPC')}</div>
            <div data-npc-loot="${esc(w.statBlockId)}">${window.apxNpcLootHtml(w.statBlockId)}</div>`, '#701a75'));
        if (own) parts.push(box(`<div id="${esc(winId)}_loot">${sectionHtml({ kind: 'area', mapId, tokId })}</div>`, '#78350f'));
        if (!parts.length) {
            let why = linked.length ? 'Give a linked NPC a stat block to place loot here.' : 'Loot is carried by NPCs: link an NPC (with a stat block) to this area, then add its loot.';
            return `<div style="font-size:.62rem;color:#64748b;margin-bottom:.25rem">${why}</div>`;
        }
        return `<div style="font-size:.65rem;color:#fcd34d;font-weight:800;text-transform:uppercase;margin-bottom:.3rem">Loot here</div>` + parts.join('');
    };
    window.apxNpcLootHtml = npcId => sectionHtml({ kind: 'npc', npcId });
    window.apxRefreshAreaLoot = function (mapId, tokId) {
        let el = document.getElementById(`omTok_${tokId}_loot`);
        if (el) el.innerHTML = window.apxAreaLootHtml(mapId, tokId);
    };
    window.apxGiveSectionLoot = function (key, id, btn) {
        let t = fromKey(key), r = resolve(t); if (!r) return;
        let i = r.items.findIndex(l => l.id === id); if (i < 0) return;
        let to = btn?.parentElement?.querySelector('select')?.value || window._gmLootSel[id];
        if (!to) { window.apxAlert && window.apxAlert('Pick who gets it first.'); return; }
        let l = r.items[i];
        if (typeof _gmSendGift !== 'function' || !_gmSendGift(to, { id: uid(), item: l.item, from: 'GM', at: Date.now() })) return;
        r.items.splice(i, 1); delete window._gmLootSel[id];
        let who = party().find(p => p.uid === to)?.name || 'A player';
        let from = t.kind === 'npc' ? (r.npc.name || 'an NPC') : areaLabel(r.tok);
        if (typeof window.gmLog === 'function') window.gmLog({ text: `${who} took ${l.item.name} from ${from}.`, kind: 'loot', force: true });
        r.save(); refreshAll(t);
    };
    window.apxRemoveSectionLoot = function (key, id) {
        let t = fromKey(key), r = resolve(t); if (!r) return;
        let i = r.items.findIndex(l => l.id === id); if (i < 0) return;
        r.items.splice(i, 1); r.save(); refreshAll(t);
    };
    window.apxSetSectionCu = function (key, v) {
        let t = fromKey(key), r = resolve(t); if (!r) return;
        r.setCu(Math.max(0, parseInt(v) || 0)); r.save(); refreshAll(t);
    };
    window.apxGiveSectionCu = function (key, btn) {
        let t = fromKey(key), r = resolve(t); if (!r) return;
        let amt = r.cu(); if (!amt) return;
        let to = btn?.parentElement?.querySelector('select')?.value || window._gmLootSel['cu_' + key];
        if (!to) { window.apxAlert && window.apxAlert('Pick who gets the Cu, or split it among the party.'); return; }
        let where = t.kind === 'npc' ? `from ${r.npc.name || 'an NPC'}` : `in ${areaLabel(r.tok)}`;
        if (!window._gmGiveCu || !window._gmGiveCu(amt, to, where)) return;
        r.setCu(0); r.save(); refreshAll(t);
    };
    window.apxMoveLootToArea = function (mapId, tokId, poolId) {
        let tok = areaTok(mapId, tokId); if (!tok || typeof _gmLootList !== 'function') return;
        let pool = _gmLootList(), i = pool.findIndex(l => l.id === poolId); if (i < 0) return;
        let l = pool.splice(i, 1)[0];
        areaLoot(tok).items.push({ id: l.id, item: l.item });
        save(); refreshAll({ kind: 'area', mapId, tokId });
    };
})();
