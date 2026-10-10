// ============================================================
// APX GM content outside a world (GM Tools)
// ============================================================
// Race Templates, Origin Templates, NPCs & Enemies, Powers and Loot & Items are made once and
// reused: each is tagged with the worlds it belongs to.
//   • apxWt: the World filter and "tag the selected ones" bar every one of those lists has
//   • Origin Templates: the GM's Origin Builder (each field locked, or left for the player)
//   • Publishing: a world's Origin Templates and learnable powers are copied to its public doc
//     (worldCodes/{code}.origins / .gmPowers), where the player's sheet reads them
//
//   window.gmOrigins = [{ id, name, wealth, feature, commonLanguage, comps: [{ type, value }] ×4,
//                         locks: { name, wealth, feature, lang, comps: [bool ×4] }, worldTags: [worldId] }]
//   Saved under the GM's account: users/{uid}/gmOrigins/all
// ============================================================
(function () {
    'use strict';
    const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
    const clone = o => JSON.parse(JSON.stringify(o));
    function worlds() { return (typeof _gmWorlds !== 'undefined' ? _gmWorlds : window._gmWorlds) || []; }
    const wid = w => w ? (w.worldId || w.id) : null;
    function worldById(id) { return worlds().find(w => wid(w) === id) || null; }
    function worldName(id) { let w = worldById(id); return w ? (w.name || 'Unnamed world') : 'Another world'; }
    function saveLocalWorlds() { if (!window.apxAuth?.enabled) try { localStorage.setItem('apxLocalWorlds', JSON.stringify(worlds())); } catch (e) { } }

    // ── The World filter / tagging bar ───────────────────────────────
    // Every list keeps its own filter ('' every world, '__none' untagged, or a world id) and its own
    // selection. A list renders apxWt.check(key, id) on each row and calls apxWt.bar() after.
    const WT = {};
    const wt = {
        state(key) { return WT[key] || (WT[key] = { filter: '', sel: new Set() }); },
        // tags: the world ids an entry is tagged with
        match(key, tags) {
            let f = wt.state(key).filter; tags = tags || [];
            return !f ? true : f === '__none' ? !tags.length : tags.includes(f);
        },
        check(key, id) {
            let on = wt.state(key).sel.has(id);
            return `<input type="checkbox" data-wt-sel="${esc(id)}" ${on ? 'checked' : ''} title="Select (to tag several at once)" style="width:15px;height:15px;flex-shrink:0;accent-color:#f59e0b;cursor:pointer">`;
        },
        // cfg: { key, ids: [visible ids], untagged: label, onApply(ids, worldId, add), rerender, note }
        bar(listEl, cfg) {
            if (!listEl) return;
            let st = wt.state(cfg.key), ws = worlds();
            // drop selections that are no longer shown
            let vis = new Set(cfg.ids || []);
            [...st.sel].forEach(id => { if (!vis.has(id)) st.sel.delete(id); });
            if (st.filter && st.filter !== '__none' && !worldById(st.filter)) st.filter = '';
            let bar = listEl.parentNode.querySelector(`[data-wtbar="${cfg.key}"]`);
            if (!bar) { bar = document.createElement('div'); bar.setAttribute('data-wtbar', cfg.key); listEl.parentNode.insertBefore(bar, listEl); }
            let n = st.sel.size, all = (cfg.ids || []).length;
            let tagTo = st.tagTo && worldById(st.tagTo) ? st.tagTo : (st.filter && st.filter !== '__none' ? st.filter : (wid(window.apxGmActiveWorld ? window.apxGmActiveWorld() : null) || wid(ws[0])));
            st.tagTo = tagTo;
            let sel = 'background:#0f172a;border:1px solid #475569;color:#e2e8f0;font-size:11px;border-radius:.3rem;padding:.15rem .3rem;max-width:11rem';
            let b = 'font-size:10px;font-weight:800;border-radius:.3rem;padding:.2rem .5rem;cursor:pointer';
            bar.className = 'flex flex-wrap items-center gap-2 mb-2 p-2 rounded border border-slate-700 bg-slate-900/60';
            bar.innerHTML = `<label class="flex items-center gap-1 text-[11px] text-slate-400 font-bold">World
                    <select data-wt-filter style="${sel}"><option value="">Every world</option><option value="__none" ${st.filter === '__none' ? 'selected' : ''}>${esc(cfg.untagged || 'Untagged')}</option>
                    ${ws.map(w => `<option value="${esc(wid(w))}" ${st.filter === wid(w) ? 'selected' : ''}>${esc(w.name || 'Unnamed world')}</option>`).join('')}</select></label>
                <label class="flex items-center gap-1 text-[11px] text-slate-300 cursor-pointer"><input type="checkbox" data-wt-all ${all && n === all ? 'checked' : ''} ${all ? '' : 'disabled'}> Select all</label>
                <span class="flex-1"></span>
                <span class="text-[10px] ${n ? 'text-amber-300' : 'text-slate-500'} font-bold">${n} selected</span>
                ${ws.length ? `<select data-wt-to title="The world to tag them with" style="${sel}">${ws.map(w => `<option value="${esc(wid(w))}" ${tagTo === wid(w) ? 'selected' : ''}>${esc(w.name || 'Unnamed world')}</option>`).join('')}</select>
                <button data-wt-add ${n ? '' : 'disabled'} style="${b};background:${n ? '#b45309' : '#334155'};border:1px solid ${n ? '#f59e0b' : '#475569'};color:${n ? '#fff' : '#94a3b8'}" title="Tag every selected one with this world">Tag</button>
                <button data-wt-rem ${n ? '' : 'disabled'} style="${b};background:#1e293b;border:1px solid #475569;color:${n ? '#fca5a5' : '#64748b'}" title="Take this world's tag off every selected one">Untag</button>`
                : '<span class="text-[10px] text-slate-500">Create a world to tag things with it.</span>'}
                ${(cfg.extra || []).map(([l, t], i) => `<button data-wt-x="${i}" ${n ? '' : 'disabled'} title="${esc(t)}" style="${b};background:#1e293b;border:1px solid #475569;color:${n ? '#e2e8f0' : '#64748b'}">${esc(l)}</button>`).join('')}
                ${cfg.note ? `<div class="w-full text-[10px] text-slate-500">${cfg.note}</div>` : ''}`;
            bar.querySelector('[data-wt-filter]').onchange = e => { st.filter = e.target.value; st.sel.clear(); cfg.rerender(); };
            let allBox = bar.querySelector('[data-wt-all]');
            if (allBox) allBox.onchange = e => { st.sel.clear(); if (e.target.checked) (cfg.ids || []).forEach(id => st.sel.add(id)); cfg.rerender(); };
            let to = bar.querySelector('[data-wt-to]'); if (to) to.onchange = e => { st.tagTo = e.target.value; };
            let go = add => async () => {
                let ids = [...st.sel], w = bar.querySelector('[data-wt-to]')?.value;
                if (!ids.length || !w) return;
                try { await cfg.onApply(ids, w, add); } catch (e) { console.warn('World tags:', e); }
                window.APXDice?.notify(`${ids.length} ${add ? 'tagged with' : 'untagged from'} ${worldName(w)}.`, { kind: 'note' });
                st.sel.clear(); cfg.rerender();
            };
            bar.querySelector('[data-wt-add]') && (bar.querySelector('[data-wt-add]').onclick = go(true));
            bar.querySelectorAll('[data-wt-x]').forEach(x => x.onclick = () => { let ids = [...st.sel]; if (!ids.length) return; cfg.extra[+x.dataset.wtX][2](ids); st.sel.clear(); cfg.rerender(); });
            bar.querySelector('[data-wt-rem]') && (bar.querySelector('[data-wt-rem]').onclick = go(false));
            // the row checkboxes
            listEl.querySelectorAll('[data-wt-sel]').forEach(c => c.onchange = () => {
                if (c.checked) st.sel.add(c.dataset.wtSel); else st.sel.delete(c.dataset.wtSel);
                wt.bar(listEl, cfg);   // (just the count and buttons)
            });
        },
        // Pick the worlds for one thing. current: [worldIds]
        pick(title, note, current, onDone) {
            document.getElementById('apxWtPick')?.remove();
            if (window.apxInjectDialogStyles) window.apxInjectDialogStyles();
            let back = document.createElement('div');
            back.id = 'apxWtPick'; back.className = 'apxdlg-back'; back.style.zIndex = 2147483400;
            let ws = worlds();
            back.innerHTML = `<div class="apxdlg" style="width:min(380px,100%)"><div class="apxdlg-title">${esc(title)}</div>
                ${note ? `<div class="apxdlg-msg">${note}</div>` : ''}
                <div style="display:flex;flex-direction:column;gap:.3rem;max-height:50vh;overflow-y:auto;margin-bottom:.8rem">
                ${ws.map(w => `<label style="display:flex;align-items:center;gap:.5rem;font-size:.8rem;cursor:pointer;background:#0f172a;border:1px solid #334155;border-radius:.35rem;padding:.4rem .55rem"><input type="checkbox" data-w="${esc(wid(w))}" ${(current || []).includes(wid(w)) ? 'checked' : ''} style="accent-color:#f59e0b"> <span style="flex:1">${esc(w.name || 'Unnamed world')}</span><span style="font-size:.65rem;color:#f59e0b;font-family:monospace">${esc(w.inviteCode || '')}</span></label>`).join('') || '<div style="font-size:.75rem;opacity:.7">No worlds yet. Create a world first.</div>'}
                </div><div class="apxdlg-row"><button class="apxdlg-btn" data-x>Cancel</button><button class="apxdlg-btn apxdlg-ok" data-ok>Save</button></div></div>`;
            back.querySelector('[data-x]').onclick = () => back.remove();
            back.querySelector('[data-ok]').onclick = () => { let ids = [...back.querySelectorAll('[data-w]')].filter(c => c.checked).map(c => c.dataset.w); back.remove(); onDone(ids); };
            document.body.appendChild(back);
        },
        badges(ids, emptyLabel) {
            ids = (ids || []).filter(id => worldById(id));
            return ids.length ? ids.map(id => `<span class="bg-amber-900/30 border border-amber-700/50 text-amber-400 px-1.5 py-0.5 rounded text-[9px] font-bold">${esc(worldName(id))}</span>`).join(' ')
                : `<span class="text-[9px] text-slate-600 italic">${esc(emptyLabel || 'Not assigned to any world')}</span>`;
        }
    };
    window.apxWt = wt;

    // ── Race Templates: tagging (a world's races live on the world itself) ──
    window.apxRaceWorldIds = raceId => worlds().filter(w => (w.races || []).some(r => r.id === raceId)).map(wid);
    async function saveRacesOf(w) {
        if (window.apxAuth?.enabled && w.inviteCode) await window.apxAuth.saveWorldRaces(wid(w), w.races || []).catch(e => console.warn('Race assign save failed:', e.message));
    }
    window.apxApplyRaceTags = async function (ids, worldId, add) {
        let w = worldById(worldId); if (!w) return;
        if (!w.races) w.races = [];
        ids.forEach(id => {
            let race = (window.gmRaces || []).find(r => r.id === id); if (!race) return;
            if (add) { if (!w.races.some(r => r.id === id)) w.races.push(clone(race)); }
            else w.races = w.races.filter(r => r.id !== id);
        });
        await saveRacesOf(w);
        saveLocalWorlds();
    };
    // A race template edited or deleted: every world that has it gets the new version (or loses it)
    window.apxSyncRacesToWorlds = function () {
        let list = window.gmRaces || [];
        worlds().forEach(w => {
            if (!Array.isArray(w.races) || !w.races.length) return;
            let next = w.races.map(r => list.find(g => g.id === r.id)).filter(Boolean).map(clone);
            if (JSON.stringify(next) !== JSON.stringify(w.races)) { w.races = next; saveRacesOf(w); }
        });
        saveLocalWorlds();
    };
    document.addEventListener('apxGmRacesSaved', () => { try { window.apxSyncRacesToWorlds(); } catch (e) { console.warn('Race sync:', e); } });

    // ── NPCs & Enemies: tags are world names (older ones: invite codes or ids) ──
    window.apxNpcWorldIds = function (entry) {
        let tags = (entry && Array.isArray(entry.worldTags)) ? entry.worldTags.filter(Boolean) : [];
        return worlds().filter(w => tags.includes(w.name || 'Unnamed') || (w.inviteCode && tags.includes(w.inviteCode)) || tags.includes(wid(w))).map(wid);
    };
    window.apxApplyNpcTags = async function (ids, worldId, add) {
        let w = worldById(worldId); if (!w) return;
        let names = [w.name || 'Unnamed', w.inviteCode, wid(w)].filter(Boolean);
        ids.forEach(id => {
            let e = (window.gmNpcs || []).find(n => n.id === id); if (!e) return;
            let tags = (e.worldTags || []).filter(t => !names.includes(t));
            if (add) tags.push(w.name || 'Unnamed');
            e.worldTags = tags;
        });
        if (window.apxAuth?.enabled) await window.apxAuth.saveGmNpcs(window.gmNpcs || []).catch(() => { });
    };

    // ── Publishing a world's Origin Templates and learnable powers ───────
    // Copied to the world's public doc whenever they change (only worlds whose copy is out of date are written).
    const pubSig = {};
    let pubT = 0;
    function pubPowers(id) {
        let seen = new Set();
        return (window.gmLibrary || []).filter(e => e.kind === 'power' && e.playable && e.data && e.data.draft && (e.worldTags || []).includes(id))
            .filter(e => { let k = String(e.name || '').toLowerCase() + '|' + e.data.lvl; if (seen.has(k)) return false; seen.add(k); return true; }).map(e => {
            let p = e.data;
            return { id: e.id, name: e.name || p.name, lvl: p.lvl, ap: p.ap, atk: p.atk || '', rng: p.rng || '', dmg: p.dmg || '', desc: p.desc || '', draft: p.draft };
        });
    }
    function pubOrigins(id) {
        return (window.gmOrigins || []).filter(o => (o.worldTags || []).includes(id)).map(o => { let c = clone(o); delete c.worldTags; return c; });
    }
    window.apxPublishWorldContent = function (now) {
        clearTimeout(pubT);
        pubT = setTimeout(() => {
            if (!window.apxAuth?.enabled || !window.apxAuth.user) return;
            worlds().forEach(w => {
                let id = wid(w); if (!id || !w.inviteCode) return;
                let data = { origins: pubOrigins(id), gmPowers: pubPowers(id) };
                let s = JSON.stringify(data);
                if (pubSig[id] === s) return;
                pubSig[id] = s;
                window.apxAuth.saveWorld(id, null, data).catch(e => { delete pubSig[id]; console.warn('World content publish:', e.message); });
            });
        }, now ? 0 : 900);
    };

    // ── Origin Templates ─────────────────────────────────────────────
    window.gmOrigins = window.gmOrigins || [];
    const WEALTH = [['', 'Player\'s choice'], ['0', 'None'], ['150', 'Impoverished (+150)'], ['300', 'Working / Traveler (+300)'], ['600', 'Wealthy / Funded (+600)']];
    const wealthLabel = v => (WEALTH.find(x => x[0] === String(v ?? '')) || WEALTH[0])[1];
    let oSaveT = 0;
    function saveOrigins() {
        clearTimeout(oSaveT);
        oSaveT = setTimeout(() => {
            if (window.apxAuth?.enabled && window.apxAuth.user) window.apxAuth.saveGmOrigins(window.gmOrigins).catch(e => console.warn('Origin save failed:', e.message));
            else try { localStorage.setItem('apxGmOrigins', JSON.stringify(window.gmOrigins)); } catch (e) { }
        }, 400);
        window.apxPublishWorldContent();
    }
    window.apxLoadGmOrigins = async function () {
        let list = [];
        try {
            if (window.apxAuth?.enabled && window.apxAuth.user) list = await window.apxAuth.loadGmOrigins();
            else list = JSON.parse(localStorage.getItem('apxGmOrigins') || '[]') || [];
        } catch (e) { console.warn('Origin load failed:', e.message); }
        let have = new Set(window.gmOrigins.map(o => o.id));
        (list || []).forEach(o => { if (o && o.id && !have.has(o.id)) window.gmOrigins.push(o); });
        window.renderGmOriginList();
    };
    function blankOrigin() {
        return { id: uid(), name: '', wealth: '', feature: '', commonLanguage: '', comps: [0, 1, 2, 3].map(() => ({ type: '', value: '' })),
            locks: { name: false, wealth: false, feature: false, lang: false, comps: [false, false, false, false] }, worldTags: [] };
    }
    function compLabel(c) {
        if (!c || !c.type) return 'Player\'s choice';
        if (c.type === 'language') return 'Language: ' + (c.value || 'player names it');
        if (c.type === 'skill') { let s = (typeof SKILLS !== 'undefined' ? SKILLS : []).find(x => x.id === c.value); return 'Skill: ' + (s ? s.name : 'player picks'); }
        return 'Weapon Type: ' + (c.value || 'player picks');
    }

    window.openGmOriginRosterModal = function () { window.renderGmOriginList(); window.openModal('gmOriginRosterModal'); };
    window.renderGmOriginList = function () {
        let body = document.getElementById('gmOriginListBody'); if (!body) return;
        let all = window.gmOrigins;
        let shown = all.filter(o => wt.match('origins', o.worldTags));
        let lock = on => on ? '<span title="Locked: the player can\'t change it">🔒</span>' : '';
        body.innerHTML = !all.length ? '<div class="text-xs text-slate-500 text-center py-6">No Origin Templates yet. Click "+ New Origin" to build one.</div>'
            : !shown.length ? '<div class="text-xs text-slate-500 text-center py-6">None in that world.</div>'
            : shown.map(o => {
                let L = o.locks || {};
                return `<div class="bg-slate-900 border border-slate-700 rounded p-2 flex gap-2 items-start">
                    ${wt.check('origins', o.id)}
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between gap-2">
                            <div class="text-sm font-bold text-pink-300 truncate">${esc(o.name || 'Unnamed Origin')} ${lock(L.name)}</div>
                            <div class="flex gap-1 flex-shrink-0">
                                <button onclick="window.openGmOriginBuilder('${esc(o.id)}')" class="text-[10px] text-pink-400 hover:text-amber-300 font-bold px-2 py-1">Edit</button>
                                <button onclick="window.gmOriginWorlds('${esc(o.id)}')" class="text-[10px] text-amber-400 hover:text-amber-300 font-bold px-2 py-1">Worlds</button>
                                <button onclick="window.exportGmOrigin('${esc(o.id)}')" class="text-[10px] text-slate-400 hover:text-slate-300 font-bold px-2 py-1">Export</button>
                                <button onclick="window.deleteGmOrigin('${esc(o.id)}')" class="text-[10px] text-red-400 hover:text-red-300 font-bold px-2 py-1">Delete</button>
                            </div>
                        </div>
                        <div class="text-[10px] text-slate-400">Wealth: ${esc(wealthLabel(o.wealth))} ${lock(L.wealth)} · Common language: ${esc(o.commonLanguage || 'player\'s choice')} ${lock(L.lang)}${o.feature ? ` · Feature ${lock(L.feature)}` : ''}</div>
                        <div class="text-[10px] text-slate-500">${(o.comps || []).map((c, i) => esc(compLabel(c)) + ' ' + lock((L.comps || [])[i])).join(' · ')}</div>
                        <div class="flex gap-1 flex-wrap mt-1">${wt.badges(o.worldTags, 'Not in any world (players can\'t pick it yet)')}</div>
                    </div></div>`;
            }).join('');
        wt.bar(body, { key: 'origins', ids: shown.map(o => o.id), untagged: 'Not in any world', rerender: window.renderGmOriginList,
            onApply: (ids, w, add) => { ids.forEach(id => { let o = window.gmOrigins.find(x => x.id === id); if (!o) return; o.worldTags = (o.worldTags || []).filter(t => t !== w); if (add) o.worldTags.push(w); }); saveOrigins(); },
            note: 'Players in a world pick its Origin Templates in their Origin Builder.' });
    };
    window.gmOriginWorlds = function (id) {
        let o = window.gmOrigins.find(x => x.id === id); if (!o) return;
        wt.pick(`Worlds for ${o.name || 'this origin'}`, 'Players in every world ticked here can pick it in their Origin Builder.', o.worldTags || [], ids => { o.worldTags = ids; saveOrigins(); window.renderGmOriginList(); });
    };
    window.deleteGmOrigin = async function (id) {
        let o = window.gmOrigins.find(x => x.id === id); if (!o) return;
        let ok = window.apxConfirm ? await window.apxConfirm(`Delete ${o.name || 'this Origin Template'}? Characters who already used it keep their origin.`, { title: 'Delete Origin Template', okLabel: 'Delete', danger: true }) : confirm('Delete?');
        if (!ok) return;
        window.gmOrigins = window.gmOrigins.filter(x => x.id !== id);
        saveOrigins(); window.renderGmOriginList();
    };
    function download(name, data) {
        let a = document.createElement('a');
        a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
        a.download = name; document.body.appendChild(a); a.click(); a.remove();
    }
    window.exportGmOrigin = function (id) {
        let o = window.gmOrigins.find(x => x.id === id); if (!o) return;
        let c = clone(o); delete c.worldTags;
        download((o.name || 'origin').replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_origin.json', c);
    };
    window.exportAllGmOrigins = function () {
        if (!window.gmOrigins.length) { window.apxAlert ? window.apxAlert('No Origin Templates to export yet.') : alert('No Origin Templates to export yet.'); return; }
        download('gm_origin_templates.json', window.gmOrigins.map(o => { let c = clone(o); delete c.worldTags; return c; }));
    };
    window.importGmOrigin = function (ev) {
        let files = Array.from(ev.target.files || []); if (!files.length) return;
        let left = files.length, bad = false;
        files.forEach(f => {
            let rd = new FileReader();
            rd.onload = e => {
                try {
                    let parsed = JSON.parse(e.target.result);
                    (Array.isArray(parsed) ? parsed : [parsed]).forEach(o => {
                        if (!o || !Array.isArray(o.comps) || o.ancestry) return;   // not an origin file
                        let c = Object.assign(blankOrigin(), o);
                        if (!c.id || window.gmOrigins.some(x => x.id === c.id)) c.id = uid();
                        c.worldTags = [];
                        window.gmOrigins.push(c);
                    });
                } catch (err) { bad = true; }
                if (--left === 0) { ev.target.value = ''; saveOrigins(); window.renderGmOriginList(); if (bad) window.apxAlert?.('One or more files weren\'t valid Origin Template files and were skipped.'); }
            };
            rd.readAsText(f);
        });
    };

    // The builder: the same fields as the player's Origin Builder, each with a Lock
    window.openGmOriginBuilder = function (id) {
        let src = id ? window.gmOrigins.find(x => x.id === id) : null;
        let o = src ? Object.assign(blankOrigin(), clone(src)) : blankOrigin();
        if (!o.locks) o.locks = blankOrigin().locks;
        if (!Array.isArray(o.locks.comps)) o.locks.comps = [false, false, false, false];
        while (o.comps.length < 4) o.comps.push({ type: '', value: '' });
        if (!src) { let f = wt.state('origins').filter; if (f && f !== '__none') o.worldTags = [f]; }
        document.getElementById('apxOriginBuilder')?.remove();
        if (window.apxInjectDialogStyles) window.apxInjectDialogStyles();
        let back = document.createElement('div');
        back.id = 'apxOriginBuilder'; back.className = 'apxdlg-back'; back.style.zIndex = 2147483300;
        const inCss = 'background:#0f172a;border:1px solid #334155;color:#e2e8f0;font-size:.78rem;border-radius:.3rem;padding:.3rem .45rem;width:100%;box-sizing:border-box';
        const lbl = 'display:block;font-size:.62rem;color:#94a3b8;font-weight:800;text-transform:uppercase;letter-spacing:.04em;margin-bottom:.2rem';
        const lockBox = (k, on) => `<label title="Locked: players who pick this template can't change it. Unlocked: what you fill in is only a starting point (blank: the player chooses)." style="display:flex;align-items:center;gap:.25rem;font-size:.66rem;font-weight:800;color:${on ? '#f9a8d4' : '#64748b'};cursor:pointer;white-space:nowrap"><input type="checkbox" data-lock="${k}" ${on ? 'checked' : ''} style="accent-color:#ec4899"> Lock</label>`;
        const skills = typeof SKILLS !== 'undefined' ? SKILLS : [];
        const wtypes = typeof WEAPON_TYPE_TRAININGS !== 'undefined' ? WEAPON_TYPE_TRAININGS : [];
        function compValue(i) {
            let c = o.comps[i];
            if (c.type === 'language') return `<input data-cv="${i}" value="${esc(c.value)}" placeholder="Language (blank: the player names it)" style="${inCss}">`;
            if (c.type === 'skill') return `<select data-cv="${i}" style="${inCss}"><option value="">The player picks a skill</option>${skills.map(s => `<option value="${esc(s.id)}" ${c.value === s.id ? 'selected' : ''}>${esc(s.name)} (${s.attr})</option>`).join('')}</select>`;
            if (c.type === 'weapon') {
                let custom = c.value && !wtypes.includes(c.value);
                return `<select data-cv="${i}" style="${inCss}"><option value="">The player picks a weapon type</option>${wtypes.map(w => `<option value="${esc(w)}" ${c.value === w ? 'selected' : ''}>${esc(w)}</option>`).join('')}<option value="__custom__" ${custom ? 'selected' : ''}>Custom…</option></select>
                    ${custom ? `<input data-cvc="${i}" value="${esc(c.value)}" placeholder="Custom weapon type" style="${inCss};margin-top:.25rem">` : ''}`;
            }
            return '<div style="font-size:.7rem;color:#64748b;padding:.3rem 0">The player chooses Language, Skill or Weapon Type.</div>';
        }
        function render() {
            let L = o.locks;
            back.innerHTML = `<div class="apxdlg" style="width:min(860px,100%);max-height:92vh;display:flex;flex-direction:column">
                <div class="apxdlg-title">${src ? 'Edit' : 'New'} Origin Template</div>
                <div class="apxdlg-msg">Fill in what this origin gives. <b>Lock</b> a field and players who pick this template can't change it; leave it unlocked (or blank) for the player to choose.</div>
                <div style="overflow-y:auto;flex:1;min-height:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:.8rem;padding-right:.2rem">
                    <div style="display:flex;flex-direction:column;gap:.6rem">
                        <div><div style="display:flex;justify-content:space-between;align-items:center"><span style="${lbl}">Origin Name</span>${lockBox('name', L.name)}</div><input data-f="name" value="${esc(o.name)}" placeholder="e.g. Space Wizard Apprentice" style="${inCss};font-weight:800;color:#f9a8d4"></div>
                        <div><div style="display:flex;justify-content:space-between;align-items:center"><span style="${lbl}">Starting Wealth</span>${lockBox('wealth', L.wealth)}</div>
                            <select data-f="wealth" style="${inCss}">${WEALTH.map(([v, l]) => `<option value="${v}" ${String(o.wealth ?? '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
                        <div><div style="display:flex;justify-content:space-between;align-items:center"><span style="${lbl}">Origin Feature</span>${lockBox('feature', L.feature)}</div>
                            <textarea data-f="feature" rows="5" placeholder="Social access, specialized knowledge or shelter…" style="${inCss};resize:vertical">${esc(o.feature)}</textarea></div>
                        <div><div style="display:flex;justify-content:space-between;align-items:center"><span style="${lbl}">Common Language</span>${lockBox('lang', L.lang)}</div><input data-f="commonLanguage" value="${esc(o.commonLanguage)}" placeholder="e.g. Common" style="${inCss}"></div>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:.5rem">
                        <span style="${lbl}">Competencies</span>
                        ${o.comps.map((c, i) => `<div style="border:1px solid #334155;border-radius:.4rem;padding:.45rem;background:#0b1220">
                            <div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.3rem">
                                <span style="font-size:.62rem;color:#94a3b8;font-weight:900;text-transform:uppercase;flex-shrink:0">Competency ${i + 1}</span>
                                <select data-ct="${i}" style="${inCss};width:auto;flex:1">${[['', 'Player\'s choice'], ['language', 'Language'], ['skill', 'Skill'], ['weapon', 'Weapon Type']].map(([v, l]) => `<option value="${v}" ${c.type === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
                                ${lockBox('c' + i, !!L.comps[i])}
                            </div>${compValue(i)}</div>`).join('')}
                        <div><span style="${lbl}">Worlds</span>
                            <div style="display:flex;flex-wrap:wrap;gap:.3rem">${worlds().map(w => `<label style="display:flex;align-items:center;gap:.3rem;font-size:.7rem;background:#0f172a;border:1px solid #334155;border-radius:.3rem;padding:.2rem .4rem;cursor:pointer"><input type="checkbox" data-ow="${esc(wid(w))}" ${(o.worldTags || []).includes(wid(w)) ? 'checked' : ''} style="accent-color:#f59e0b"> ${esc(w.name || 'Unnamed world')}</label>`).join('') || '<span style="font-size:.7rem;color:#64748b">No worlds yet.</span>'}</div></div>
                    </div>
                </div>
                <div class="apxdlg-row" style="margin-top:.8rem"><button class="apxdlg-btn" data-x>Cancel</button><button class="apxdlg-btn apxdlg-ok" data-ok>Save Origin Template</button></div></div>`;
            wire();
        }
        function read() {
            back.querySelectorAll('[data-f]').forEach(el => { o[el.dataset.f] = el.value; });
            back.querySelectorAll('[data-lock]').forEach(el => { let k = el.dataset.lock; if (/^c\d$/.test(k)) o.locks.comps[+k[1]] = el.checked; else o.locks[k] = el.checked; });
            back.querySelectorAll('[data-cv]').forEach(el => { let i = +el.dataset.cv; o.comps[i].value = el.value === '__custom__' ? (back.querySelector(`[data-cvc="${i}"]`)?.value || '__custom__') : el.value; });
            back.querySelectorAll('[data-cvc]').forEach(el => { let i = +el.dataset.cvc; if (back.querySelector(`[data-cv="${i}"]`)?.value === '__custom__') o.comps[i].value = el.value || '__custom__'; });
            if (back.querySelector('[data-ow]')) o.worldTags = [...back.querySelectorAll('[data-ow]')].filter(c => c.checked).map(c => c.dataset.ow);
        }
        function wire() {
            back.querySelectorAll('[data-ct]').forEach(el => el.onchange = () => { read(); let i = +el.dataset.ct; o.comps[i] = { type: el.value, value: '' }; render(); });
            back.querySelectorAll('[data-cv]').forEach(el => { if (el.tagName === 'SELECT') el.onchange = () => { read(); render(); }; });
            back.querySelectorAll('[data-lock]').forEach(el => el.onchange = () => { el.parentNode.style.color = el.checked ? '#f9a8d4' : '#64748b'; });
            back.querySelector('[data-x]').onclick = () => back.remove();
            back.querySelector('[data-ok]').onclick = () => {
                read();
                o.name = String(o.name || '').trim();
                if (!o.name) { window.apxAlert ? window.apxAlert('Give the Origin Template a name (the list shows it, even if the player may rename it).') : alert('Name it first.'); return; }
                o.comps.forEach(c => { if (c.value === '__custom__') c.value = ''; });
                // A lock on nothing (a blank field, or a competency left to the player) would only stop the player choosing
                if (o.wealth === '') o.locks.wealth = false;
                if (!String(o.feature || '').trim()) o.locks.feature = false;
                if (!String(o.commonLanguage || '').trim()) o.locks.lang = false;
                o.comps.forEach((c, i) => { if (!c.type || !c.value) o.locks.comps[i] = false; });
                o.t = Date.now();
                let at = window.gmOrigins.findIndex(x => x.id === o.id);
                if (at >= 0) window.gmOrigins[at] = o; else window.gmOrigins.push(o);
                back.remove();
                saveOrigins(); window.renderGmOriginList();
                window.APXDice?.notify(`${o.name} saved to your Origin Templates${(o.worldTags || []).length ? ' for ' + o.worldTags.map(worldName).join(', ') : ''}.`, { kind: 'note' });
            };
        }
        render();
        document.body.appendChild(back);
    };

    // ── Powers and Loot & Items (moved out of the World screen: they're the GM's Library) ──
    window.openGmPowerLibModal = function () { window.openModal('gmPowerLibModal'); window.apxLibRenderTab && window.apxLibRenderTab('power'); };
    window.openGmItemLibModal = function () { window.openModal('gmItemLibModal'); window.apxLibRenderTab && window.apxLibRenderTab('item'); };
    // + New Power: the Power Crafter, keeping what's made in the Library (tagged with the filtered world)
    window.apxNewLibPower = function () {
        if (typeof window.openPowerCrafter !== 'function') return;
        let f = wt.state('lib-power').filter;
        window._pcLibPowers = [];
        window._pcLibOnChange = power => {
            if (!power) return;
            window.apxLibAdd('power', power, { worlds: f && f !== '__none' ? [f] : [], playable: true });
            window.apxLibRenderTab && window.apxLibRenderTab('power');
        };
        window.openPowerCrafter(false, 'lib');
    };
    // + New Item: the Loot Maker, keeping what's made in the Library
    window.apxNewLibItem = function () {
        let f = wt.state('lib-item').filter;
        window.openLootMaker && window.openLootMaker({ kind: 'libnew', worlds: f && f !== '__none' ? [f] : [] });
    };

    // Loaded with the GM's other things once signed in (APX_GMTools.html onApxAuthReady), or from this browser
    document.addEventListener('DOMContentLoaded', () => setTimeout(() => { if (!window.apxAuth?.enabled) window.apxLoadGmOrigins(); }, 500));
})();
