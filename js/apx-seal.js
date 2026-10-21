// ============================================================
// APX Character files: sealed exports, checked imports
// ============================================================
// Export JSON seals the file: a fingerprint (SHA-256) of the character, saved with it and in a record on your
// account (users/{uid}/exports/{id}) along with a short summary (XP, attributes, perks, Currency…).
// Import JSON checks the file against that record:
//   - unchanged since you exported it from this account: imported as it was;
//   - changed afterwards, exported from another account, or from before files were sealed: still imported, but
//     marked (state.importFlag). The GM of any world it joins sees the mark (with what changed, when the record
//     shows it) on its Party card and in the World's Players list until they clear it.
// An imported file is always a new character: it never replaces the one you have open, or a world's.
// (It all runs in the browser: this stops editing a file in a text editor, not someone rewriting the app.)
(function () {
    'use strict';
    const PEPPER = 'apx|character-seal|v1';
    // Top-level fields left out of the fingerprint (the seal itself, undo history, the local id). An "Imported file"
    // mark is part of it, so exporting a marked character and importing it again doesn't shed the mark.
    const SKIP = new Set(['_apxExport', '_undoStack', '_redoStack', 'id']);
    const ATTRS = ['STR', 'AGI', 'CON', 'PER', 'INT', 'CHA', 'LUC'];
    const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

    // Stable JSON: keys sorted, so the same character always gives the same text
    function canon(v) {
        if (Array.isArray(v)) return '[' + v.map(x => canon(x === undefined ? null : x)).join(',') + ']';
        if (v && typeof v === 'object') return '{' + Object.keys(v).filter(k => v[k] !== undefined && typeof v[k] !== 'function').sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
        return JSON.stringify(v === undefined ? null : v);
    }
    function body(o) { let out = {}; Object.keys(o || {}).forEach(k => { if (!SKIP.has(k)) out[k] = o[k]; }); return out; }
    async function sha(text) {
        if (window.crypto && crypto.subtle && window.TextEncoder) {
            try { let buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)); return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join(''); } catch (e) { }
        }
        // (no Web Crypto, e.g. a page opened over plain http: two 32-bit FNV-1a passes)
        let h1 = 0x811c9dc5, h2 = 0x01000193 ^ text.length;
        for (let i = 0; i < text.length; i++) { let c = text.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = Math.imul(h2 ^ c, 2246822519) >>> 0; }
        return 'f' + h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
    }
    function fingerprint(o, sealId) { return sha(PEPPER + '|' + sealId + '|' + canon(body(o))); }
    function uid() { return (window.apxAuth && window.apxAuth.enabled && window.apxAuth.user && window.apxAuth.user.uid) || null; }
    function db() { return window._apxDb || null; }

    // What the GM is shown when a file was changed: these, before and after
    function summary(s) {
        s = s || {};
        let scores = {}; ATTRS.forEach(a => { scores[a] = parseInt((s.baseStats || {})[a]) || 0; });
        return {
            name: String(s.name || ''), unspentXp: parseInt(s.unspentXp) || 0, spentXp: parseInt(s.spentXp) || 0, currency: parseInt(s.currency) || 0,
            scores, perks: Object.assign({}, s.perks || {}), powers: (s.powers || []).map(p => `${p && p.name || 'Power'} (Lvl ${p && p.lvl || 1})`),
            items: (s.items || []).reduce((t, it) => t + (parseInt(it && it.ct) || 0), 0), hpBought: parseInt(s.xpHpBought) || 0,
            gpUsed: parseInt(((s.ancestry || {}).gpUsed)) || 0
        };
    }
    function diffOf(a, b) {
        if (!a || !b) return [];
        let out = [], num = (k, label) => { if ((a[k] || 0) !== (b[k] || 0)) out.push(`${label}: ${a[k] || 0} → ${b[k] || 0}`); };
        num('unspentXp', 'Unspent XP'); num('spentXp', 'Spent XP'); num('currency', 'Currency'); num('hpBought', 'HP bought'); num('gpUsed', 'Genetic Points used'); num('items', 'Items carried');
        ATTRS.forEach(k => { if ((a.scores || {})[k] !== (b.scores || {})[k]) out.push(`${k}: ${(a.scores || {})[k]} → ${(b.scores || {})[k]}`); });
        let pk = new Set(Object.keys(a.perks || {}).concat(Object.keys(b.perks || {})));
        pk.forEach(k => { let x = (a.perks || {})[k] || 0, y = (b.perks || {})[k] || 0; if (x !== y) { let p = (typeof PERKS_DB !== 'undefined' ? PERKS_DB : []).find(q => q.id === k); out.push(`${p ? p.name : k}: Rank ${x} → ${y}`); } });
        let pa = (a.powers || []).join(' · '), pb = (b.powers || []).join(' · ');
        if (pa !== pb) out.push(`Powers: ${(a.powers || []).length} → ${(b.powers || []).length}${pb && pb !== pa ? ` (now ${pb})` : ''}`);
        if (a.name !== b.name) out.push(`Name: ${a.name || '—'} → ${b.name || '—'}`);
        return out.slice(0, 24);
    }

    // ── Export ──
    window.apxExportCharacter = async function () {
        let st = window.state; if (!st) return;
        let saveState = JSON.parse(JSON.stringify(Object.assign({}, st, { id: (typeof activeCharId !== 'undefined' && activeCharId) || st.id || undefined })));
        delete saveState._undoStack; delete saveState._redoStack;
        let sealId = 'ex' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        let me = uid();
        let hash = await fingerprint(saveState, sealId);
        saveState._apxExport = { v: 1, id: sealId, uid: me, at: Date.now(), hash };
        // The account's record of it (what an import is checked against)
        if (me && db()) {
            try { await db().collection('users').doc(me).collection('exports').doc(sealId).set({ hash, at: Date.now(), charName: st.name || '', charId: window._activeCloudCharId || null, summary: summary(saveState) }); }
            catch (e) { console.warn('Export record:', e.message); }
        }
        let a = document.createElement('a');
        a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(saveState, null, 2));
        a.download = (st.name ? st.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'apx_character') + '.json';
        document.body.appendChild(a); a.click(); a.remove();
        window.APXDice?.notify(me ? 'Character exported and sealed: importing it back into this account keeps it unmarked, as long as the file isn\'t changed.' : 'Character exported. (Signed in, the file is also recorded on your account, so a world\'s GM can see it\'s unchanged when you import it.)', { kind: 'note' });
    };

    // ── Import: check it, then make it a new character ──
    // → { kind: 'ok' | 'edited' | 'unsealed' | 'foreign' | 'unchecked', diff: [...] }
    window.apxCheckCharacterFile = async function (data) {
        let seal = data && data._apxExport, me = uid();
        if (!seal || !seal.id || !seal.hash) return { kind: 'unsealed', diff: [] };
        let hash = await fingerprint(data, seal.id);
        if (seal.uid && me && seal.uid !== me) return { kind: 'foreign', diff: [] };
        if (!me || !db()) return { kind: hash === seal.hash ? 'unchecked' : 'edited', diff: [] };
        let rec = null;
        try { let d = await db().collection('users').doc(me).collection('exports').doc(seal.id).get(); rec = d.exists ? d.data() : null; } catch (e) { console.warn('Export record:', e.message); }
        if (!rec) return { kind: hash === seal.hash ? 'unrecorded' : 'edited', diff: [] };
        let ok = rec.hash === seal.hash && hash === seal.hash;
        return { kind: ok ? 'ok' : 'edited', diff: ok ? [] : diffOf(rec.summary, summary(data)), exportedAt: rec.at || seal.at || null };
    };
    const KIND_TEXT = {
        edited: 'changed after it was exported',
        unsealed: 'not a sealed APX export (made before sealing, or by hand)',
        foreign: 'exported from a different account',
        unrecorded: 'sealed, but not recorded on this account',
        unchecked: 'sealed, but couldn\'t be checked (not signed in)'
    };
    window.apxImportFlagText = f => f ? (KIND_TEXT[f.kind] || 'imported from a file that couldn\'t be checked') : '';
    window.apxImportCharacterFile = async function (file) {
        if (!file) return;
        let text = await file.text().catch(() => null), data = null;
        try { data = JSON.parse(text); } catch (e) { }
        if (!data || typeof data !== 'object' || Array.isArray(data) || !data.baseStats) { window.showConfirm ? window.showConfirm('That isn\'t an APX character file.', null, true) : window.apxAlert?.('That isn\'t an APX character file.'); return; }
        let res = await window.apxCheckCharacterFile(data);
        // (an unchanged file of a character that was already marked keeps its mark)
        let flag = res.kind === 'ok' ? (data.importFlag && typeof data.importFlag === 'object' ? data.importFlag : null) : { kind: res.kind, at: Date.now(), file: String(file.name || '').slice(0, 80), diff: res.diff || [], exportedAt: res.exportedAt || (data._apxExport && data._apxExport.at) || null };
        if (flag && res.kind !== 'ok' && window.apxConfirm) {
            let msg = `<div style="text-align:left;line-height:1.45">This file is <b>${esc(KIND_TEXT[flag.kind] || 'unchecked')}</b>.<br>It's imported as a new character marked <b>Imported file</b>: if it joins a world, the GM sees that mark${flag.diff.length ? ' and what changed' : ''} until they clear it.${flag.diff.length ? `<div style="margin-top:.4rem;font-size:.85em;opacity:.85">${flag.diff.map(esc).join('<br>')}</div>` : ''}</div>`;
            let go = await window.apxConfirm(msg, { title: 'Import Character', okLabel: 'Import it', cancelLabel: 'Cancel', html: true });
            if (!go) return;
        }
        let imported = window.apxPrepareLoadedState ? window.apxPrepareLoadedState(JSON.parse(JSON.stringify(data))) : JSON.parse(JSON.stringify(data));
        delete imported._apxExport; delete imported._undoStack; delete imported._redoStack;
        if (res.kind !== 'ok') delete imported.importFlagCleared;
        if (flag) imported.importFlag = flag; else delete imported.importFlag;
        let fresh = Object.assign(typeof getInitialState === 'function' ? getInitialState() : {}, imported);
        // Signed in: a new character on the account (not in a world, in no folder). Signed out: the local sheet.
        if (window.apxAuth && window.apxAuth.enabled && Array.isArray(window._sidebarChars)) {
            if (typeof _saveActiveCharacter === 'function') { try { await _saveActiveCharacter(); } catch (e) { } }
            let newId = 'char_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
            window._sidebarChars.push({ id: newId, name: fresh.name || 'Imported Character', state: null, folderId: null, worldCode: null });
            window._activeCloudCharId = newId;
            window.apxAuth.setActiveCharId && window.apxAuth.setActiveCharId(newId);
            if (typeof _resetSheetState === 'function') _resetSheetState(fresh);
            else { Object.keys(window.state).forEach(k => delete window.state[k]); Object.assign(window.state, fresh); }
            window.syncDOM?.(); window.recalculateMath?.();
            window.apxActivateCharacterWorld?.();
            window.apxAuth.saveCharacter(newId, window.state, { folderId: null, worldCode: null }).catch(() => {});
            let entry = window._sidebarChars.find(c => c.id === newId); if (entry) entry.state = JSON.parse(JSON.stringify(window.state));
            window.renderSidebarCharList?.();
            let lobby = document.getElementById('characterLobby'); if (lobby) lobby.style.display = 'none';
            if (typeof _closeSidebar === 'function') _closeSidebar();
        } else {
            Object.keys(window.state).forEach(k => delete window.state[k]); Object.assign(window.state, fresh);
            if (typeof activeCharId !== 'undefined') { try { activeCharId = window.state.id || crypto.randomUUID(); window.state.id = activeCharId; if (typeof localRoster !== 'undefined') localRoster[activeCharId] = { ...window.state }; } catch (e) { } }
            window.apxClearUndo?.(); window.syncDOM?.(); window.recalculateMath?.(); window.renderLocalRoster?.();
            let sb = document.getElementById('sidebar'); if (sb && sb.classList.contains('active')) window.toggleSidebar?.();
        }
        window.APXDice?.notify(flag ? `Imported ${fresh.name || 'the character'} as a new character, marked "Imported file" (${KIND_TEXT[flag.kind] || 'unchecked'}).` : `Imported ${fresh.name || 'the character'} as a new character: the file is unchanged since you exported it.`, { kind: flag ? 'warn' : 'note', open: true });
    };
    // The old buttons call these
    window.saveToLocal = function () { window.apxExportCharacter(); };
    window.loadFromLocal = function (event) {
        let input = event && event.target, file = input && input.files && input.files[0];
        if (input) input.value = '';
        if (file) window.apxImportCharacterFile(file);
    };

    // ── The GM's view: a mark on the player's card until the GM clears it ──
    window.apxImportFlagBadge = function (st, uidOf) {
        let f = st && st.importFlag; if (!f) return '';
        let tip = `Imported from a file that was ${KIND_TEXT[f.kind] || 'unchecked'}${f.file ? ' (' + f.file + ')' : ''}${f.at ? ', ' + new Date(f.at).toLocaleDateString() : ''}.` + (f.diff && f.diff.length ? '\nChanged: ' + f.diff.join('; ') : '');
        let btn = uidOf && window.gmClearImportFlag ? ` <button type="button" onclick="event.stopPropagation();window.gmClearImportFlag('${esc(uidOf)}')" style="margin-left:.25rem;font-size:.55rem;font-weight:800;padding:0 .3rem;border-radius:.25rem;border:1px solid #b45309;background:#451a03;color:#fde68a;cursor:pointer" title="You've checked this character: clear the mark">Clear</button>` : '';
        return `<span data-import-flag style="display:inline-flex;align-items:center;font-size:.55rem;font-weight:900;color:#fbbf24;background:rgba(120,53,15,.45);border:1px solid #b45309;border-radius:.25rem;padding:0 .3rem;margin-left:.3rem;white-space:nowrap" title="${esc(tip)}">⚠ Imported file${f.diff && f.diff.length ? ` (${f.diff.length} change${f.diff.length === 1 ? '' : 's'})` : ''}</span>${btn}`;
    };
    // GM: the player's sheet clears its mark when it sees this (worldCodes/{code}/players/{uid}._gmImportOk)
    window.gmClearImportFlag = async function (playerUid) {
        let p = (window.gmParty || []).find(x => x.fileName === playerUid), st = p && (p.state || p.charState);
        let f = st && st.importFlag; if (!f) return;
        let code = typeof _gmInviteCode === 'function' ? _gmInviteCode() : null;
        let ok = window.apxConfirm ? await window.apxConfirm(`Clear the "Imported file" mark on ${st.name || 'this character'}? Do this once you've checked the character${f.diff && f.diff.length ? ` (changed: ${f.diff.join('; ')})` : ''}.`, { title: 'Imported Character', okLabel: 'Clear the mark' }) : true;
        if (!ok) return;
        if (code && db()) {
            try { await db().collection('worldCodes').doc(code).collection('players').doc(playerUid).set({ _gmImportOk: f.at }, { merge: true }); }
            catch (e) { window.APXDice?.notify('Couldn\'t clear it: ' + e.message, { kind: 'warn' }); return; }
        }
        st.importFlagCleared = Object.assign({}, f, { clearedAt: Date.now() }); delete st.importFlag;
        window.renderGmScreen?.(); window.renderPlayersList?.();
        window.APXDice?.notify(`Cleared the "Imported file" mark on ${st.name || 'the character'}.`, { kind: 'note' });
    };
    // Player: the GM cleared the mark
    window.apxImportFlagAck = function (okAt) {
        let st = window.state, f = st && st.importFlag;
        if (!f || !okAt || okAt !== f.at) return;
        st.importFlagCleared = Object.assign({}, f, { clearedAt: Date.now(), byGm: true }); delete st.importFlag;
        window.APXDice?.notify('Your GM checked your imported character and cleared its "Imported file" mark.', { kind: 'note' });
        window.recalculateMath?.(); window.scheduleAutoSave?.();
    };
})();
