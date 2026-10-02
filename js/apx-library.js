// ============================================================
// APX GM Library (GM Tools)
// ============================================================
// Everything the GM makes (custom items, forged weapons and armor, consumables, NPC powers) is kept
// in one library, so it can be reused: stock a shopkeeper with the same Healing Draught that's in
// the dungeon loot, or give two NPCs the same power. Each entry is tagged with the world it was
// made in, and can be tagged with other worlds too (it then shows up there as well).
//
//   window.gmLibrary = [{ id, kind: 'item' | 'power', name, data, worldTags: [worldId], createdIn, t }]
//   Saved under the GM's account: users/{uid}/gmLibrary/all
// ============================================================
(function () {
    'use strict';
    const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'lib' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
    window.gmLibrary = window.gmLibrary || [];

    function worlds() { return (typeof _gmWorlds !== 'undefined' ? _gmWorlds : window._gmWorlds) || []; }
    function activeWorld() { return window.apxGmActiveWorld ? window.apxGmActiveWorld() : null; }
    function worldIdOf(w) { return w ? (w.worldId || w.id) : null; }
    function activeId() { return worldIdOf(activeWorld()); }
    function worldName(id) { let w = worlds().find(x => worldIdOf(x) === id); return w ? (w.name || 'Unnamed world') : 'Another world'; }

    // Same thing made twice is one entry (count, worn state and ids don't matter)
    function sig(kind, data) {
        let d = JSON.parse(JSON.stringify(data || {}));
        ['id', 'ct', 'equipped', 'chargesRemaining', 'tp', 'isLairAction', 'from'].forEach(k => delete d[k]);
        return kind + ':' + (window.apxItemStackKey && kind === 'item' ? window.apxItemStackKey(Object.assign({}, d, { ct: 1 })) : JSON.stringify(d));
    }

    let saveT = 0;
    function save() {
        clearTimeout(saveT);
        saveT = setTimeout(() => {
            if (window.apxAuth?.enabled && typeof window.apxAuth.saveGmLibrary === 'function')
                window.apxAuth.saveGmLibrary(window.gmLibrary).catch(e => console.warn('Library save failed:', e.message));
            else try { localStorage.setItem('apxGmLibrary', JSON.stringify(window.gmLibrary)); } catch (e) { }
        }, 600);
    }
    window.apxLibLoad = async function () {
        let list = [];
        try {
            if (window.apxAuth?.enabled && typeof window.apxAuth.loadGmLibrary === 'function') list = await window.apxAuth.loadGmLibrary();
            else list = JSON.parse(localStorage.getItem('apxGmLibrary') || '[]') || [];
        } catch (e) { console.warn('Library load failed:', e.message); }
        let have = new Set(window.gmLibrary.map(e => e.id));
        (list || []).forEach(e => { if (e && e.id && !have.has(e.id)) window.gmLibrary.push(e); });
    };

    // Removed by hand: remembered, so the backfill below never brings it back
    function meta() {
        let m = window.gmLibrary.find(x => x.kind === 'meta');
        if (!m) { m = { id: '__meta', kind: 'meta', name: '', removed: [] }; window.gmLibrary.push(m); }
        if (!Array.isArray(m.removed)) m.removed = [];
        return m;
    }
    // Add something the GM made. Already there: it's also tagged with this world.
    // opts: { quiet, worlds: [worldIds] (default: the open world; [] = every world), backfill }
    window.apxLibAdd = function (kind, data, opts) {
        opts = opts || {};
        if (!data || !data.name) return null;
        let s = sig(kind, data), w = activeId();
        let tags = Array.isArray(opts.worlds) ? opts.worlds.filter(Boolean) : (w ? [w] : []);
        if (opts.backfill && meta().removed.includes(s)) return null;
        let e = window.gmLibrary.find(x => x.kind === kind && x._sig === s) || window.gmLibrary.find(x => x.kind === kind && x.kind !== 'meta' && sig(x.kind, x.data) === s);
        if (e) {
            e._sig = s;
            // (an entry for every world stays that way)
            if ((e.worldTags || []).length && tags.length) {
                let add = tags.filter(t => !e.worldTags.includes(t));
                if (add.length) { e.worldTags = e.worldTags.concat(add); save(); }
            } else if ((e.worldTags || []).length && !tags.length && opts.worlds) { e.worldTags = []; save(); }
            return e;
        }
        let copy = JSON.parse(JSON.stringify(data));
        if (kind === 'item') { copy.ct = 1; if (copy.isCustomEquippable) copy.equipped = false; }
        e = { id: uid(), kind, name: data.name, data: copy, worldTags: tags, createdIn: tags[0] || w, t: Date.now(), _sig: s };
        window.gmLibrary.push(e);
        save();
        if (!(opts && opts.quiet)) window.APXDice?.notify(`${data.name} is in your Library${w ? ' for ' + worldName(w) : ''}.`, { kind: 'loot' });
        return e;
    };
    // This world's entries (or every world's)
    window.apxLibList = function (kind, all) {
        let w = activeId();
        return window.gmLibrary.filter(e => e.kind === kind && e.kind !== 'meta' && (all || !w || !(e.worldTags || []).length || e.worldTags.includes(w)));
    };
    window.apxLibGet = id => window.gmLibrary.find(e => e.id === id) || null;
    window.apxLibRemove = async function (id) {
        let e = window.apxLibGet(id); if (!e) return;
        let ok = window.apxConfirm ? await window.apxConfirm(`Remove "${e.name}" from your Library? Copies already given out or placed stay where they are.`, { title: 'Remove from Library', okLabel: 'Remove', danger: true }) : true;
        if (!ok) return;
        let m = meta(), es = e._sig || sig(e.kind, e.data);
        if (!m.removed.includes(es)) m.removed.push(es);
        window.gmLibrary = window.gmLibrary.filter(x => x.id !== id);
        save();
        window.apxLibRefresh && window.apxLibRefresh();
    };

    // Which worlds an entry belongs to
    window.apxLibWorlds = function (id) {
        let e = window.apxLibGet(id); if (!e) return;
        document.getElementById('apxLibWorlds')?.remove();
        if (window.apxInjectDialogStyles) window.apxInjectDialogStyles();
        let back = document.createElement('div');
        back.id = 'apxLibWorlds'; back.className = 'apxdlg-back'; back.style.zIndex = 2147483300;
        let ws = worlds();
        back.innerHTML = `<div class="apxdlg" style="width:min(360px,100%)"><div class="apxdlg-title">Worlds for ${esc(e.name)}</div>
            <div class="apxdlg-msg">It shows up in the Library of every world ticked here.</div>
            <div style="display:flex;flex-direction:column;gap:.3rem;max-height:50vh;overflow-y:auto;margin-bottom:.8rem">
            ${ws.map(w => `<label style="display:flex;align-items:center;gap:.45rem;font-size:.78rem;cursor:pointer"><input type="checkbox" data-w="${esc(worldIdOf(w))}" ${(e.worldTags || []).includes(worldIdOf(w)) ? 'checked' : ''}> ${esc(w.name || 'Unnamed world')}${worldIdOf(w) === e.createdIn ? ' <span style="opacity:.6;font-size:.68rem">(made here)</span>' : ''}</label>`).join('') || '<div style="font-size:.75rem;opacity:.7">No worlds yet.</div>'}
            </div><div class="apxdlg-row"><button class="apxdlg-btn apxdlg-ok" data-ok>Done</button></div></div>`;
        back.querySelector('[data-ok]').onclick = () => {
            e.worldTags = [...back.querySelectorAll('[data-w]')].filter(c => c.checked).map(c => c.dataset.w);
            save(); back.remove(); window.apxLibRefresh && window.apxLibRefresh();
        };
        back.addEventListener('mousedown', ev => { if (ev.target === back) back.querySelector('[data-ok]').click(); });
        document.body.appendChild(back);
    };

    // One row of the Library list
    function statsOf(e) {
        if (e.kind === 'power') {
            let p = e.data || {};
            return [`Lvl ${p.lvl}`, window.apxPowerApLabel ? window.apxPowerApLabel(p) : (p.ap + ' AP'), p.atk, p.dmg && p.dmg !== '-' ? p.dmg : ''].filter(Boolean).join(' · ');
        }
        let it = e.data || {};
        return (window.apxLootKind ? window.apxLootKind(it) : 'Item') + (window.apxLootStats ? ' · ' + window.apxLootStats(it) : '');
    }
    // The Library list. opts: { kind, all, q, onPick: entry => …, pickLabel }
    window.apxLibListHtml = function (opts) {
        opts = opts || {};
        let q = String(opts.q || '').toLowerCase();
        let list = window.apxLibList(opts.kind || 'item', !!opts.all).filter(e => !q || String(e.name || '').toLowerCase().includes(q))
            .sort((a, b) => String(a.name).localeCompare(String(b.name)));
        let btn = 'font-size:.62rem;font-weight:800;border-radius:.25rem;padding:.2rem .45rem;cursor:pointer';
        if (!list.length) return `<div style="font-size:.7rem;color:#64748b;padding:.4rem">${window.gmLibrary.some(e => e.kind === (opts.kind || 'item')) && !opts.all ? 'Nothing in this world\'s Library yet. Tick "All worlds" to see what you made elsewhere.' : 'Nothing here yet. What you make with the Loot Maker and the Power Crafter is kept here.'}</div>`;
        return list.map(e => `<div style="display:flex;align-items:center;gap:.4rem;padding:.3rem .45rem;border:1px solid #334155;border-radius:.35rem;margin-bottom:.25rem;background:#0f172a">
            <div style="flex:1;min-width:0">
                <div style="font-size:.74rem;font-weight:800;color:${e.kind === 'power' ? '#d8b4fe' : '#fde68a'}">${esc(e.name)}</div>
                <div style="font-size:.6rem;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(statsOf(e))}</div>
                <div style="font-size:.56rem;color:#64748b">${(e.worldTags || []).length ? (e.worldTags || []).map(worldName).map(esc).join(', ') : 'Every world'}</div>
            </div>
            ${opts.onPick ? `<button data-lib-pick="${esc(e.id)}" style="${btn};background:#047857;border:1px solid #059669;color:#fff">${esc(opts.pickLabel || 'Add')}</button>` : ''}
            <button data-lib-worlds="${esc(e.id)}" title="Which worlds it shows up in" style="${btn};background:#1e293b;border:1px solid #475569;color:#93c5fd">Worlds</button>
            <button data-lib-del="${esc(e.id)}" title="Remove from the Library" style="${btn};background:#1e293b;border:1px solid #475569;color:#cbd5e1">✕</button></div>`).join('');
    };
    // ── Backfill: everything made before the Library existed ─────────────
    // Custom items, forged and custom weapons, forged armor and consumables wherever they are (each
    // world's Loot list, Area Circles and Special Map Markers; NPCs' gear and carried loot) and NPC
    // powers. Each is tagged with the world it was found in (an NPC's own world tags, or every world).
    // Runs each time the GM Tools open; anything already in the Library is skipped, and anything
    // removed from the Library by hand stays removed.
    function isMadeItem(it) {
        if (!it || !it.name || it.isShield || it.isHelmet) return false;
        return !!(it.isCustomEquippable || it.isConsumable || it.isWeapon || it.isArmor);
    }
    function weaponAsItem(w) {
        let wd = JSON.parse(JSON.stringify(w)); delete wd.aimed; delete wd.twoHanded; delete wd.hands; delete wd.hand; delete wd.equipped;
        return { name: w.name, wt: w.weight || 0, ct: 1, val: w.paidCost || 0, isWeapon: true, isLocked: true, weaponData: wd, desc: `Weapon: ${w.dmg} damage, ${w.ap} AP` };
    }
    function armorAsItem(a) {
        return { name: a.name || 'Armor', wt: a.wt || 0, ct: 1, val: a.paidCost || 0, isArmor: true, isLocked: true, armorData: JSON.parse(JSON.stringify(a)), desc: `Armor: +${a.ac} AC, +${a.dr} DR, +${a.er} ER` };
    }
    window.apxLibBackfill = function () {
        let before = window.gmLibrary.filter(e => e.kind !== 'meta').length;
        let add = (kind, data, worlds) => { try { window.apxLibAdd(kind, data, { quiet: true, worlds, backfill: true }); } catch (e) { } };
        let itemsIn = list => (list || []).map(l => l && (l.item || l)).filter(isMadeItem);
        // Each world's own content
        worlds().forEach(w => {
            let id = worldIdOf(w), n = (id === activeId() && typeof _wNotes !== 'undefined' && _wNotes) ? _wNotes : (w.notesV2 || {});
            itemsIn(n.loot).forEach(it => add('item', it, [id]));
            (n.otherMaps || []).forEach(m => (m.tokens || []).forEach(t => itemsIn(t.loot && t.loot.items).forEach(it => add('item', it, [id]))));
        });
        // NPCs (their world tags, or every world)
        (window.gmNpcs || []).forEach(npc => {
            let tags = Array.isArray(npc.worldTags) ? npc.worldTags.filter(Boolean) : [];
            itemsIn(npc.carriedItems).forEach(it => add('item', it, tags));
            (npc.weapons || []).forEach(wp => { if (wp && wp.name && !wp.isUnarmed && (wp.forged || wp.isCustom)) add('item', weaponAsItem(wp), tags); });
            let a = npc.equippedArmor;
            if (a && a.name && (a.paidCost > 0 || a.mods)) add('item', armorAsItem(a), tags);
            (npc.powers || []).forEach(p => { if (p && p.name) add('power', p, tags); });
        });
        let added = window.gmLibrary.filter(e => e.kind !== 'meta').length - before;
        if (added > 0) { save(); window.apxLibRefresh && window.apxLibRefresh(); }
        return added;
    };

    // Wire a rendered list (buttons) inside `root`
    window.apxLibWire = function (root, onPick) {
        if (!root) return;
        root.querySelectorAll('[data-lib-pick]').forEach(b => b.onclick = () => { let e = window.apxLibGet(b.dataset.libPick); if (e && onPick) onPick(JSON.parse(JSON.stringify(e.data)), e); });
        root.querySelectorAll('[data-lib-worlds]').forEach(b => b.onclick = () => window.apxLibWorlds(b.dataset.libWorlds));
        root.querySelectorAll('[data-lib-del]').forEach(b => b.onclick = () => window.apxLibRemove(b.dataset.libDel));
    };
})();
