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
            // Powers tagged with a world are offered to its players (Add Power)
            window.apxPublishWorldContent && window.apxPublishWorldContent();
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
        if (mergePowerDuplicates()) save();
    };

    // Removed by hand: remembered, so the backfill below never brings it back
    function meta() {
        let m = window.gmLibrary.find(x => x.kind === 'meta');
        if (!m) { m = { id: '__meta', kind: 'meta', name: '', removed: [] }; window.gmLibrary.push(m); }
        if (!Array.isArray(m.removed)) m.removed = [];
        return m;
    }
    // The same power is one Library entry: same name and Level (older builds, copies on other NPCs,
    // a rebuild under newer rules). Which copy is newer: rebuilt under newer rules, or built with the Power Crafter.
    const powerKey = d => String((d && d.name) || '').trim().toLowerCase() + '|' + String((d && d.lvl) ?? '');
    const powerRank = d => [(d && d.rulesRev) || 0, d && d.draft ? 1 : 0];
    function newerPower(a, b) { let x = powerRank(a), y = powerRank(b); return y[0] !== x[0] ? y[0] > x[0] : y[1] > x[1]; }
    // Duplicates already in the Library are merged into one (its worlds, and players' access, combined)
    function mergePowerDuplicates() {
        let groups = {}, changed = false;
        window.gmLibrary.forEach(e => { if (e.kind === 'power' && e.data) (groups[powerKey(e.data)] = groups[powerKey(e.data)] || []).push(e); });
        Object.values(groups).forEach(g => {
            if (g.length < 2) return;
            let keep = g.reduce((a, b) => newerPower(a.data, b.data) || (!newerPower(b.data, a.data) && (b.t || 0) > (a.t || 0)) ? b : a);
            let everywhere = g.some(e => !(e.worldTags || []).length);
            let tags = [...new Set(g.flatMap(e => e.worldTags || []))];
            keep.worldTags = everywhere && !keep.playable && !g.some(e => e.playable) ? [] : tags;
            if (g.some(e => e.playable)) keep.playable = true;
            let m = meta();
            g.forEach(e => { if (e !== keep) { let es = e._sig || sig(e.kind, e.data); if (!m.removed.includes(es)) m.removed.push(es); } });
            window.gmLibrary = window.gmLibrary.filter(e => e === keep || !g.includes(e));
            changed = true;
        });
        return changed;
    }
    window.apxLibMergeDuplicates = function () { if (mergePowerDuplicates()) { save(); tabRefresh(); } };

    // Add something the GM made. Already there: it's also tagged with this world.
    // opts: { quiet, worlds: [worldIds] (default: the open world; [] = every world), backfill }
    window.apxLibAdd = function (kind, data, opts) {
        opts = opts || {};
        if (!data || !data.name) return null;
        let s = sig(kind, data), w = activeId();
        let tags = Array.isArray(opts.worlds) ? opts.worlds.filter(Boolean) : (w ? [w] : []);
        if (opts.backfill && meta().removed.includes(s)) return null;
        let e = window.gmLibrary.find(x => x.kind === kind && x._sig === s) || window.gmLibrary.find(x => x.kind === kind && x.kind !== 'meta' && sig(x.kind, x.data) === s);
        // A power already in the Library under the same name and Level is the same power: a newer
        // version replaces the Library's copy (anything the GM just made is the newest)
        if (!e && kind === 'power') {
            e = window.gmLibrary.find(x => x.kind === 'power' && powerKey(x.data) === powerKey(data));
            if (e && (!opts.backfill || newerPower(e.data, data))) {
                let m = meta(), old = e._sig || sig(e.kind, e.data);
                if (!m.removed.includes(old)) m.removed.push(old);
                e.data = JSON.parse(JSON.stringify(data)); e.name = data.name; e.t = Date.now(); s = sig(kind, data);
                save();
            } else if (e) s = e._sig || sig(e.kind, e.data);   // (the Library keeps its newer copy)
            if (e && opts.playable) { e.playable = true; save(); }
        }
        if (e) {
            e._sig = s;
            // (an entry for every world stays that way)
            if ((e.worldTags || []).length && tags.length) {
                let add = tags.filter(t => !e.worldTags.includes(t));
                if (add.length) { e.worldTags = e.worldTags.concat(add); save(); }
            } else if ((e.worldTags || []).length && !tags.length && opts.worlds && !opts.backfill) { e.worldTags = []; save(); }   // (a backfill only ever adds worlds)
            return e;
        }
        let copy = JSON.parse(JSON.stringify(data));
        if (kind === 'item') { copy.ct = 1; if (copy.isCustomEquippable) copy.equipped = false; }
        e = { id: uid(), kind, name: data.name, data: copy, worldTags: tags, createdIn: tags[0] || w, t: Date.now(), _sig: s };
        if (kind === 'power' && opts.playable) e.playable = true;   // players in its worlds can learn it (Add Power)
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
    // Edited (the Edit button): the Library's own copy changes. Copies already handed out,
    // placed in loot or on NPCs stay as they were.
    window.apxLibUpdate = function (id, data, opts) {
        let e = window.apxLibGet(id); if (!e || !data) return null;
        let copy = JSON.parse(JSON.stringify(data));
        // The version it replaces (still on an NPC, say) isn't brought back by the backfill
        let old = e._sig || sig(e.kind, e.data), m = meta();
        if (!m.removed.includes(old)) m.removed.push(old);
        if (e.kind === 'item') { copy.ct = 1; if (copy.isCustomEquippable) copy.equipped = false; delete copy.chargesRemaining; if (copy.charges) copy.chargesRemaining = copy.charges; }
        e.data = copy; e.name = copy.name || e.name; e._sig = sig(e.kind, copy); e.t = Date.now();
        save();
        (window.apxLibRefresh && window.apxLibRefresh(), tabRefresh());
        if (!(opts && opts.quiet)) window.APXDice?.notify(`${e.name} updated in your Library.`, { kind: 'loot' });
        return e;
    };
    // NPC stat blocks are tagged with world names; the Library tags with world ids
    function worldIdsFromNames(names) {
        let ws = worlds();
        return (names || []).map(n => { let w = ws.find(x => x.name === n || worldIdOf(x) === n); return w ? worldIdOf(w) : null; }).filter(Boolean);
    }
    window.apxLibRemove = async function (id) {
        let e = window.apxLibGet(id); if (!e) return;
        let ok = window.apxConfirm ? await window.apxConfirm(`Remove "${e.name}" from your Library? Copies already given out or placed stay where they are.`, { title: 'Remove from Library', okLabel: 'Remove', danger: true }) : true;
        if (!ok) return;
        let m = meta(), es = e._sig || sig(e.kind, e.data);
        if (!m.removed.includes(es)) m.removed.push(es);
        window.gmLibrary = window.gmLibrary.filter(x => x.id !== id);
        save();
        (window.apxLibRefresh && window.apxLibRefresh(), tabRefresh());
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
            save(); back.remove(); (window.apxLibRefresh && window.apxLibRefresh(), tabRefresh());
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
        let list = (opts.list || window.apxLibList(opts.kind || 'item', !!opts.all)).filter(e => !q || String(e.name || '').toLowerCase().includes(q))
            .sort((a, b) => String(a.name).localeCompare(String(b.name)));
        let btn = 'font-size:.62rem;font-weight:800;border-radius:.25rem;padding:.2rem .45rem;cursor:pointer';
        if (!list.length) return `<div style="font-size:.7rem;color:#64748b;padding:.4rem">${window.gmLibrary.some(e => e.kind === (opts.kind || 'item')) && !opts.all ? 'Nothing in this world\'s Library yet. Tick "All worlds" to see what you made elsewhere.' : 'Nothing here yet. What you make with the Loot Maker and the Power Crafter is kept here.'}</div>`;
        let whereLine = e => {
            let names = (e.worldTags || []).length ? (e.worldTags || []).map(worldName).map(esc).join(', ') : '';
            if (e.kind !== 'power' || !opts.check) return names || 'Every world';
            if (!(e.data && e.data.draft)) return (names || 'Every world') + ' · <span style="color:#94a3b8">NPCs and items only (not built with the Power Crafter, so players can\'t learn it)</span>';
            if (!e.playable) return (names || 'Every world') + ' · <span style="color:#94a3b8">GM only: NPCs and items</span>';
            return names ? `${names} · <span style="color:#86efac">players there can learn it (Add Power)</span>` : 'Every world · <span style="color:#fcd34d">players can learn it once it\'s tagged with their world</span>';
        };
        return list.map(e => `<div style="display:flex;align-items:center;gap:.4rem;padding:.3rem .45rem;border:1px solid #334155;border-radius:.35rem;margin-bottom:.25rem;background:#0f172a">
            ${opts.check && window.apxWt ? window.apxWt.check(opts.check, e.id) : ''}
            <div style="flex:1;min-width:0">
                <div style="font-size:.74rem;font-weight:800;color:${e.kind === 'power' ? '#d8b4fe' : '#fde68a'}">${esc(e.name)}</div>
                <div style="font-size:.6rem;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(statsOf(e))}</div>
                <div style="font-size:.56rem;color:#64748b">${whereLine(e)}</div>
            </div>
            ${opts.check && e.kind === 'power' ? `<button data-lib-play="${esc(e.id)}" ${e.data && e.data.draft ? '' : 'disabled'} title="${e.data && e.data.draft ? 'Can players learn this power (Add Power, in the worlds it\'s tagged with)? Click to switch.' : 'Typed in by hand, not built with the Power Crafter: NPCs and items only'}" style="${btn};background:${e.playable ? '#14532d' : '#1e293b'};border:1px solid ${e.playable ? '#22c55e' : '#475569'};color:${e.playable ? '#bbf7d0' : '#94a3b8'};white-space:nowrap">${e.playable ? 'Players ✓' : 'Players ✕'}</button>` : ''}
            ${opts.edit ? `<button data-lib-edit="${esc(e.id)}" title="${e.kind === 'power' ? 'Edit this power in the Power Crafter' : 'Edit this item'} (copies already given out or placed don't change)" style="${btn};background:#1e293b;border:1px solid #a16207;color:#fde68a">Edit</button>` : ''}
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
    // A power as kept in the Library: no use-tracking or Lair Action placement
    function cleanPower(p) { let c = JSON.parse(JSON.stringify(p)); ['usesLeft', 'chargesLeft', 'isLairAction', 'used'].forEach(k => delete c[k]); return c; }
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
        // NPCs (their world tags, or every world). Saved NPCs are { id, npc, worldTags: [world names] }.
        (window.gmNpcs || []).forEach(entry => {
            let npc = entry && entry.npc ? entry.npc : entry; if (!npc) return;
            let named = Array.isArray(entry.worldTags) ? entry.worldTags.filter(Boolean) : [];
            let tags = worldIdsFromNames(named);
            itemsIn(npc.carriedItems).forEach(it => add('item', it, tags));
            (npc.weapons || []).forEach(wp => { if (wp && wp.name && !wp.isUnarmed && (wp.forged || wp.isCustom)) add('item', weaponAsItem(wp), tags); });
            let a = npc.equippedArmor;
            if (a && a.name && (a.paidCost > 0 || a.mods)) add('item', armorAsItem(a), tags);
            (npc.powers || []).forEach(p => { if (p && p.name) add('power', cleanPower(p), tags); });
            // and the powers of the items it carries
            itemsIn(npc.carriedItems).forEach(it => (Array.isArray(it.powers) ? it.powers : []).forEach(p => { if (p && p.name) add('power', cleanPower(p), tags); }));
        });
        // Powers on items already in the Library (an equippable item's powers)
        window.gmLibrary.filter(e => e.kind === 'item' && Array.isArray(e.data && e.data.powers)).forEach(e =>
            e.data.powers.forEach(p => { if (p && p.name) add('power', cleanPower(p), e.worldTags || []); }));
        if (mergePowerDuplicates()) save();
        let added = window.gmLibrary.filter(e => e.kind !== 'meta').length - before;
        if (added > 0) { save(); (window.apxLibRefresh && window.apxLibRefresh(), tabRefresh()); }
        return added;
    };

    // ── GM Tools → Powers / Loot & Items (the Library) ─────────────────────
    // Searchable, with a type (or Level) filter, the World filter, and multi-select world tagging.
    const tabState = { item: { q: '', sub: '' }, power: { q: '', sub: '' } };
    let tabFilled = null;   // (filled again when more saved NPCs have loaded)
    window.apxLibRenderTab = function (kind) {
        let box = document.getElementById(kind === 'power' ? 'wPanelLibPowers' : 'wPanelLibItems'); if (!box) return;
        // Anything made before the Library existed (NPC powers, item powers…) shows up here too
        let nNpcs = (window.gmNpcs || []).length;
        if (tabFilled !== nNpcs) { tabFilled = nNpcs; try { window.apxLibBackfill(); } catch (e) { console.warn('Library backfill:', e); } }
        let st = tabState[kind], key = 'lib-' + kind, WT = window.apxWt;
        let subs = kind === 'item' ? ['Weapon', 'Armor', 'Consumable', 'Magic Item'] : ['1', '2', '3', '4', '5'];
        let inSub = e => {
            if (!st.sub) return true;
            if (st.sub === 'learn') return !!e.playable;
            if (st.sub === 'gmonly') return !e.playable;
            if (kind === 'power') return String(e.data && e.data.lvl) === st.sub;
            let k = window.apxLootKind ? window.apxLootKind(e.data || {}) : '';
            return st.sub === 'Magic Item' ? /magic|item|equip/i.test(k) && !/weapon|armor|consumable/i.test(k) : k.toLowerCase().includes(st.sub.toLowerCase());
        };
        let base = window.gmLibrary.filter(e => e.kind === kind);
        let q = st.q.toLowerCase();
        let shown = base.filter(e => !WT || WT.match(key, e.worldTags || [])).filter(e => !q || String(e.name || '').toLowerCase().includes(q)).filter(inSub)
            .sort((a, b) => String(a.name).localeCompare(String(b.name)));
        let html = shown.length ? window.apxLibListHtml({ kind, list: shown, check: key, onPick: kind === 'item' ? true : null, pickLabel: 'Add to Loot', edit: true })
            : `<div style="font-size:.7rem;color:#64748b;padding:.4rem">${base.length ? 'Nothing matches.' : kind === 'power' ? 'No powers yet. + New Power builds one in the Power Crafter (powers you give NPCs are kept here too).' : 'No items yet. + New Item opens the Loot Maker (what you make for loot and NPCs is kept here too).'}</div>`;
        box.innerHTML = `<div class="flex flex-wrap items-center gap-2 mb-2 flex-shrink-0">
                <input type="text" data-lt-q value="${esc(st.q)}" placeholder="Search ${kind === 'power' ? 'powers' : 'items'}…" class="bg-slate-900 text-xs flex-1" style="min-width:10rem">
                <select data-lt-sub class="bg-slate-900 text-xs" style="width:auto">${[['', kind === 'power' ? 'Every Level' : 'Every type']].concat(subs.map(x => [x, kind === 'power' ? 'Level ' + x : x])).concat(kind === 'power' ? [['learn', 'Players can learn'], ['gmonly', 'GM only']] : []).map(([v, l]) => `<option value="${v}" ${st.sub === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
                <span class="text-[10px] text-slate-500">${shown.length} of ${base.length}</span>
            </div>
            <div class="text-[10px] text-slate-500 mb-2 flex-shrink-0">${kind === 'power'
                ? 'Every power you\'ve made: for NPCs (the NPC Crafter\'s power picker), items, and players. <b>Players ✓</b> lets players learn a power from Add Power on their sheet, in the worlds it\'s tagged with; <b>Players ✕</b> keeps it for your NPCs and items. Edit reopens it in the Power Crafter.'
                : 'Every custom item, forged weapon and armor, and consumable you\'ve made. Add to Loot puts a copy on the open world\'s Loot list. Edit changes the Library\'s copy (reopening its forge or crafter).'}</div>
            <div data-lt-wrap class="flex-1 flex flex-col min-h-0"><div data-lt-list class="flex-1 overflow-y-auto min-h-0 pr-1">${html}</div></div>`;
        let qi = box.querySelector('[data-lt-q]');
        qi.oninput = () => { st.q = qi.value; let pos = qi.selectionStart; window.apxLibRenderTab(kind); let q2 = box.querySelector('[data-lt-q]'); q2.focus(); try { q2.setSelectionRange(pos, pos); } catch (e) { } };
        box.querySelector('[data-lt-sub]').onchange = e => { st.sub = e.target.value; window.apxLibRenderTab(kind); };
        let listEl = box.querySelector('[data-lt-list]');
        window.apxLibWire(listEl, kind === 'item' ? (data) => {
            if (!activeWorld()) { window.apxAlert ? window.apxAlert('Load a world first: Add to Loot puts the item on the open world\'s Loot list.') : alert('Load a world first.'); return; }
            if (window.apxAddLoot) window.apxAddLoot(null, data);
        } : null);
        if (WT) WT.bar(listEl, { key, ids: shown.map(e => e.id), untagged: 'Untagged (every world)', rerender: () => window.apxLibRenderTab(kind),
            extra: kind === 'power' ? [['Players ✓', 'Let players learn every selected power', ids => window.apxLibSetPlayable(ids, true)], ['Players ✕', 'Keep every selected power for your NPCs and items', ids => window.apxLibSetPlayable(ids, false)]] : null,
            onApply: (ids, w, add) => {
                ids.forEach(id => { let e = window.apxLibGet(id); if (!e) return; e.worldTags = (e.worldTags || []).filter(t => t !== w); if (add) e.worldTags.push(w); });
                save();
            } });
    };
    function tabRefresh() {
        ['item', 'power'].forEach(k => { let el = document.getElementById(k === 'power' ? 'wPanelLibPowers' : 'wPanelLibItems'); if (el && !el.classList.contains('hidden')) window.apxLibRenderTab(k); });
    }

    // Wire a rendered list (buttons) inside `root`
    window.apxLibWire = function (root, onPick) {
        if (!root) return;
        root.querySelectorAll('[data-lib-pick]').forEach(b => b.onclick = () => { let e = window.apxLibGet(b.dataset.libPick); if (e && onPick) onPick(JSON.parse(JSON.stringify(e.data)), e); });
        root.querySelectorAll('[data-lib-worlds]').forEach(b => b.onclick = () => window.apxLibWorlds(b.dataset.libWorlds));
        root.querySelectorAll('[data-lib-del]').forEach(b => b.onclick = () => window.apxLibRemove(b.dataset.libDel));
        root.querySelectorAll('[data-lib-play]').forEach(b => b.onclick = () => window.apxLibSetPlayable([b.dataset.libPlay], null));
        root.querySelectorAll('[data-lib-edit]').forEach(b => b.onclick = () => {
            let e = window.apxLibGet(b.dataset.libEdit); if (!e) return;
            if (e.kind === 'power') window.apxLibEditPower(e.id);
            else if (window.apxEditLibItem) window.apxEditLibItem(e.id);
        });
    };

    // Can players learn these powers (Add Power)? on: true / false, or null to switch each
    window.apxLibSetPlayable = function (ids, on) {
        ids.forEach(id => { let e = window.apxLibGet(id); if (!e || e.kind !== 'power' || !(e.data && e.data.draft)) return; e.playable = on === null ? !e.playable : !!on; });
        save(); tabRefresh();
    };

    // ── Editing a Library power: the Power Crafter, on the Library's copy ──
    // Save to Library changes it; Save as New keeps the original and adds the copy to the Library.
    window.apxLibEditPower = function (id) {
        let e = window.apxLibGet(id); if (!e || e.kind !== 'power') return;
        let p = e.data || {};
        if (!p.draft || typeof window.openPowerEditor !== 'function') { basicPowerEdit(e); return; }
        let list = window._pcLibPowers = [JSON.parse(JSON.stringify(p))];
        window._pcLibOnChange = power => {
            if (!power) return;
            if (power === list[0]) window.apxLibUpdate(id, power);
            else window.apxLibAdd('power', power, { worlds: (e.worldTags || []).slice(), playable: !!e.playable });
            tabRefresh();
        };
        window.openPowerEditor(0, 'lib');
    };
    // Powers that weren't built with the Power Crafter (typed in by hand): their fields, directly
    function basicPowerEdit(e) {
        let p = e.data || {};
        window.apxLibFieldsDialog(`Edit ${p.name || 'power'}`, 'This power wasn\'t built with the Power Crafter, so its fields are edited directly.', [
            ['name', 'Name', p.name || ''], ['lvl', 'Level', p.lvl ?? '', 'number'], ['ap', 'AP', p.ap ?? ''], ['atk', 'Attack / Save', p.atk || ''],
            ['rng', 'Range', p.rng || ''], ['dmg', 'Damage', p.dmg || ''], ['desc', 'Description', p.desc || '', 'textarea']
        ], v => {
            let d = Object.assign({}, p, { name: v.name.trim() || p.name, lvl: parseInt(v.lvl) || p.lvl, ap: /^\d+$/.test(v.ap.trim()) ? parseInt(v.ap) : v.ap.trim(), atk: v.atk.trim(), rng: v.rng.trim(), dmg: v.dmg.trim(), desc: v.desc.trim() });
            window.apxLibUpdate(e.id, d);
        });
    }
    // A small form dialog. fields: [[key, label, value, type?]] (type: 'number' | 'textarea')
    window.apxLibFieldsDialog = function (title, note, fields, onSave) {
        document.getElementById('apxLibEdit')?.remove();
        if (window.apxInjectDialogStyles) window.apxInjectDialogStyles();
        let back = document.createElement('div');
        back.id = 'apxLibEdit'; back.className = 'apxdlg-back'; back.style.zIndex = 2147483300;
        let inCss = 'background:#0f172a;border:1px solid #334155;color:#e2e8f0;font-size:.78rem;border-radius:.3rem;padding:.3rem .45rem;width:100%;box-sizing:border-box';
        back.innerHTML = `<div class="apxdlg" style="width:min(420px,100%)"><div class="apxdlg-title">${esc(title)}</div>
            ${note ? `<div class="apxdlg-msg">${esc(note)}</div>` : ''}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.45rem;margin-bottom:.8rem">
            ${fields.map(([k, l, v, type]) => `<label style="display:block;${type === 'textarea' || k === 'name' ? 'grid-column:1/-1' : ''}"><span style="display:block;font-size:.62rem;color:#94a3b8;font-weight:800;text-transform:uppercase;margin-bottom:.15rem">${esc(l)}</span>
                ${type === 'textarea' ? `<textarea data-f="${k}" rows="3" style="${inCss};resize:vertical">${esc(v)}</textarea>` : `<input data-f="${k}" ${type === 'number' ? 'type="number" step="any"' : ''} value="${esc(v)}" style="${inCss}">`}</label>`).join('')}
            </div><div class="apxdlg-row"><button class="apxdlg-btn" data-x>Cancel</button><button class="apxdlg-btn apxdlg-ok" data-ok>Save to Library</button></div></div>`;
        back.querySelector('[data-x]').onclick = () => back.remove();
        back.querySelector('[data-ok]').onclick = () => {
            let v = {}; back.querySelectorAll('[data-f]').forEach(el => { v[el.dataset.f] = el.value; });
            back.remove(); onSave(v);
        };
        document.body.appendChild(back);
        setTimeout(() => back.querySelector('[data-f]')?.focus(), 30);
    };
})();
