// ============================================================
// APX Powers in play: the GM's tracker and battle maps (GM Tools only)
// ============================================================
// The GM's page is the authority for what powers do on the map and to the creatures in the tracker:
//   - a power's instance (pi) for as long as it lasts: everything it did carries the id, and _gmEndPi(pi)
//     takes all of it away again (buffs, Conditions, map effects, a Sensor, a resized or invisible token)
//   - map effects: map.powerFx [{ id, pi, kind: 'zone'|'terrain'|'hazard'|'wall'|'sensor', sub, cells, dmg, type,
//     label, by, byUid, casterId, left }] (published to the players with the map)
//   - zones of blinding: Blinded while inside one, not once they leave
//   - hazardous terrain (its damage for each square walked through) and hazardous walls (once, to pass through)
//   - a Sensor: a token its owner moves; once a power is used from it, it's visible and tangible (AC 10, 10 HP);
//     destroyed, the power ends and the rest of the damage is dealt to its owner as Psychic
//   - teleports and pushes, growing or shrinking a creature, ending a power (dispel)
//   - an NPC's own lasting powers (entry._casts): their time on the initiative, Concentration (2 AP each
//     turn, a CON save when it takes damage), a beneficial power's Damage Interrupt
// ============================================================
(function () {
    'use strict';
    if (!/GMTools/i.test(location.pathname)) return;
    const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const rid = p => (p || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const maps = () => (typeof _wNotes !== 'undefined' && _wNotes ? _wNotes.otherMaps : null) || [];
    const mapById = id => maps().find(m => m.id === id) || null;
    const list = () => window.gmInitiative || [];
    const entryFor = (mapId, tokId) => (typeof _gmEntryForToken === 'function' ? _gmEntryForToken(mapId, tokId) : null);
    const pub = e => (typeof _gmPublicName === 'function' ? _gmPublicName(e) : (e && e.name) || 'Someone');
    const gmn = e => (typeof _gmGmName === 'function' ? _gmGmName(e) : (e && e.name) || 'Someone');
    const log = o => { if (typeof gmLog === 'function') gmLog(Object.assign({ kind: 'info' }, o)); };
    const save = () => { if (typeof window.saveWorldNotes === 'function') window.saveWorldNotes(); };
    const redraw = () => { if (typeof window._btRefreshAllOpenMaps === 'function') window._btRefreshAllOpenMaps(); if (typeof window.renderInitiativeTracker === 'function') window.renderInitiativeTracker(); };
    const party = () => (window.gmParty || []).map(p => p.fileName).filter(Boolean);
    const conds = e => (window._gmEntryConditions ? window._gmEntryConditions(e.id) : (e.conditions || []));
    const playerConds = e => (typeof _gmPlayerCondList === 'function' ? _gmPlayerCondList(e) : []);
    const hasCond = (e, c) => (e.faction === 'player' && e.playerUid && !e.companionOf ? playerConds(e) : conds(e)).includes(c);

    // ── Instances ──
    window._gmCastReg = window._gmCastReg || {};   // pi -> { pi, name, lvl, dur, uid, casterId, by, players: Set }
    function reg(pi, o) { let r = window._gmCastReg[pi] = window._gmCastReg[pi] || { pi, players: new Set() }; Object.assign(r, o); return r; }
    // Buffs sent to a player for this instance: remembered, so ending it reaches them
    let origSend = null;
    (function hookSend(tries) {
        if (typeof window._gmSendBuff !== 'function') { if ((tries || 0) < 50) setTimeout(() => hookSend((tries || 0) + 1), 200); return; }
        if (window._gmSendBuff._apxPi) return;
        origSend = window._gmSendBuff;
        let w = function (uid, b) { if (b && b.pi && !b.endPi) reg(b.pi, {}).players.add(uid); return origSend.apply(this, arguments); };
        w._apxPi = true; window._gmSendBuff = w;
    })(0);

    // A lasting power is over: everything it did, everywhere
    window._gmEndPi = function (pi, why, o) {
        if (!pi) return;
        o = o || {};
        let changed = false, r = window._gmCastReg[pi] || null;
        list().forEach(e => {
            let fx = Array.isArray(e._fx) ? e._fx : [], gone = fx.filter(f => f.powerBuff && f.pi === pi);
            if (gone.length) { e._fx = fx.filter(f => !gone.includes(f)); log({ text: `${gone[0].name || 'A power'} on ${pub(e)} ends${why ? ` (${why})` : ''}.` }); changed = true; }
            (e._powerFx || []).filter(f => f.pi === pi).forEach(f => { if (typeof _gmEndPfx === 'function') _gmEndPfx(e, f.id, why || 'the power ended'); changed = true; });
            if (Array.isArray(e._casts) && e._casts.some(c => c.pi === pi)) {
                let c = e._casts.find(x => x.pi === pi); e._casts = e._casts.filter(x => x !== c); changed = true;
                // (an NPC's Overexertion: its Fatigue now, with its chip)
                let ox = (Array.isArray(e._fx) ? e._fx : []).find(f => f.overexert && f.key === 'ox:' + c.name);
                if (ox && typeof window.gmEndEntryFx === 'function') window.gmEndEntryFx(e.id, ox.id);
            }
        });
        maps().forEach(m => {
            let goneFx = (m.powerFx || []).filter(f => f.pi === pi);
            if (goneFx.length) {
                m.powerFx = m.powerFx.filter(f => f.pi !== pi); changed = true;
                goneFx.forEach(f => { if (f.kind === 'sensor') removeSensor(m, f, null); });
                log({ text: `${goneFx[0].label || 'A power'}'s ${goneFx.map(f => fxName(f)).join(', ')} ${goneFx.length > 1 ? 'are' : 'is'} gone${why ? ` (${why})` : ''}.` });
            }
            (m.battleTokens || []).forEach(t => {
                if (t._sizeFx && t._sizeFx.pi === pi) { t.size = t._sizeFx.base; if (!t._sizeFx.had) delete t.sizeOverride; sizeToPlayer(t, null); delete t._sizeFx; changed = true; log({ text: `${t.name || 'A creature'} is back to its own size.` }); }
                if (t.invisible === pi) { delete t.invisible; changed = true; }
            });
        });
        // The players who have its buffs (all of them, when it isn't known who), and its owner if someone else ended it
        let to = r && r.players && r.players.size ? [...r.players] : party();
        to.forEach(u => window._gmSendBuff && window._gmSendBuff(u, { endPi: pi, why: why || '' }));
        if (r && r.uid && !o.fromPlayer && o.endOwner !== false) window._gmSendBuff && window._gmSendBuff(r.uid, { endOwn: pi, why: why || '' });
        delete window._gmCastReg[pi];
        if (changed) { zoneSync(); save(); redraw(); }
    };
    function fxName(f) { return f.kind === 'zone' ? ({ dark: 'darkness', fog: 'fog', light: 'light' }[f.sub] || 'zone') : f.kind === 'wall' ? 'wall' : f.kind === 'sensor' ? 'Sensor' : f.kind === 'hazard' ? 'hazardous ground' : 'difficult terrain'; }

    // ── A player's (or NPC's) power: what it does on the map and to its targets ──
    window._gmPowerWorldEvent = function (uid, ev, caster, name, o) {
        o = o || {};
        if (!ev) return;
        if (ev.pi) reg(ev.pi, { name: ev.label || 'Power', lvl: ev.lvl || 1, dur: ev.dur || 'instant', uid: uid || null, casterId: caster ? caster.id : null, by: name || '' });
        let meta = { pi: ev.pi || null, label: ev.label || 'Power', by: name || (caster ? gmn(caster) : ''), byUid: uid || null, casterId: caster ? caster.id : null, dur: ev.dur || 'instant', lvl: ev.lvl || 1 };
        if (ev.mapFx && ev.mapFx.length && ev.mapId) addMapFx(ev.mapId, ev.mapFx, meta);
        (ev.moves || []).forEach(mv => moveTok(mv, meta));
        if (ev.resize) resize(ev.resize, meta);
        if (ev.fromSensor) sensorTangible(ev.fromSensor, meta);
        if (ev.buff && ev.buff.invisible) markInvisible(ev, uid, meta);
        if (o.mapOnly) { save(); redraw(); return; }
        if (ev.dispel) dispel(ev.dispel, meta, uid);
        // Targets picked within range (not an area, not an attack: those resolve on their own): saves, damage,
        // healing, the Conditions it inflicts or ends, all without asking
        if (ev.targets && ev.targets.tokenIds && ev.targets.tokenIds.length && caster && !ev.attackRoll && !ev.area && typeof window._gmAreaResolve === 'function')
            window._gmAreaResolve(caster, Object.assign({}, ev, { area: ev.targets, auto: true }));
        save(); redraw();
    };
    // Conditions a power ends (on a target it reached)
    window._gmPowerEnds = function (e, ends, label) {
        (ends || []).forEach(c => {
            if (!hasCond(e, c)) return;
            if (e.faction === 'player' && e.playerUid && !e.companionOf && typeof _gmSetPlayerCondition === 'function') _gmSetPlayerCondition(e, c, false);
            else if (window._gmRemoveEntryCondition) window._gmRemoveEntryCondition(e.id, c);
            (e._powerFx || []).filter(f => (f.conds || []).includes(c)).forEach(f => { f.conds = f.conds.filter(x => x !== c); if (!f.conds.length && typeof _gmEndPfx === 'function') _gmEndPfx(e, f.id, null); });
            let cn = window._gmCondName ? window._gmCondName(c) : c;
            log({ text: `${pub(e)} is no longer ${cn} (${label}).`, gmText: `${gmn(e)} is no longer ${cn} (${label}).` });
        });
        redraw();
    };
    // Damage that heals: half of what was dealt, to the creature picked (or the user)
    window._gmPowerDrain = function (drain, dealt, label, caster) {
        let n = Math.floor((dealt || 0) / 2); if (!n || !drain) return;
        let e = drain.self ? caster : entryFor(drain.mapId, drain.tokenId);
        if (!e || !list().includes(e)) return;
        let nh = window.apxNoHealCond && window.apxNoHealCond(e.faction === 'player' && e.playerUid ? playerConds(e) : (typeof _gmEffConds === 'function' ? _gmEffConds(e) : conds(e)));
        if (nh) { log({ text: `${pub(e)} can't regain Hit Points (${nh}): ${label} doesn't heal it.` }); return; }
        let wasAbove = e.currentHp === null || e.currentHp > 0, before = (e.currentHp || 0) + (e.tempHp || 0);
        let res = window.apxApplyHpInput ? window.apxApplyHpInput('+' + n, e.currentHp, e.tempHp, e.maxHp) : null;
        if (res) { e.currentHp = res.currentHp; e.tempHp = res.tempHp; }
        if (typeof _gmLogHpChange === 'function') _gmLogHpChange(e, before, (e.currentHp || 0) + (e.tempHp || 0), wasAbove, 0, null, `${label} (half the damage it dealt)`);
        if (typeof _afterHpChange === 'function') _afterHpChange(e, wasAbove);
        redraw();
    };

    // ── Map effects ──
    function addMapFx(mapId, fxList, meta) {
        let m = mapById(mapId); if (!m) return;
        m.powerFx = m.powerFx || [];
        let made = [];
        fxList.forEach(f => {
            let cells = (f.cells || []).filter(c => Array.isArray(c) && isFinite(c[0]) && isFinite(c[1])).slice(0, 600).map(c => [Math.round(c[0]), Math.round(c[1])]);
            if (!cells.length) return;
            let fx = { id: rid('pf'), pi: meta.pi, kind: f.kind, sub: f.sub || null, cells, dmg: f.dmg || null, type: f.type || null, label: meta.label, by: meta.by || '', byUid: meta.byUid || null, casterId: meta.casterId || null,
                left: meta.pi ? null : 2, t: Date.now() };   // (an Instant one: through its user's next turn)
            if (f.kind === 'sensor') makeSensor(m, fx, meta, f);
            m.powerFx.push(fx); made.push(fx);
        });
        if (!made.length) return;
        log({ text: `${meta.by || 'Someone'}'s ${meta.label}: ${made.map(fxName).join(', ')} on ${m.name || 'the battle map'}.`, gmText: `${meta.by || 'Someone'}'s ${meta.label}: ${made.map(f => `${fxName(f)} (${f.cells.length} sq${f.dmg ? `, ${f.dmg} ${f.type || ''}` : ''})`).join(', ')} on ${m.name || 'the battle map'}.` });
        zoneSync(); save(); redraw();
    }
    window._gmAddMapFx = addMapFx;
    window._gmRemoveMapFx = function (mapId, fxId) {
        let m = mapById(mapId); if (!m) return;
        let f = (m.powerFx || []).find(x => x.id === fxId); if (!f) return;
        if (f.pi) { window._gmEndPi(f.pi, 'ended by the GM'); return; }
        m.powerFx = m.powerFx.filter(x => x !== f);
        if (f.kind === 'sensor') removeSensor(m, f, null);
        zoneSync(); save(); redraw();
    };
    // ── The Sensor ──
    function makeSensor(m, fx, meta, f) {
        let c = fx.cells[0];
        let tok = { id: rid('bt_sen'), type: 'npc', name: `${meta.by || 'A'}'s Sensor`, baseName: 'Sensor', size: 'tiny', gridX: c[0], gridY: c[1], color: '#a855f7',
            worldNpcId: null, playerUid: null, initiativeId: null, revealed: true, faction: 'ally', sensor: true, sensorHidden: true, pi: meta.pi || null, sizeOverride: true };
        if (meta.byUid) tok.ownerUid = meta.byUid;   // (its owner moves it)
        // (it sees what its owner would from there: their token's Fog of War reveal, if the GM gave them one)
        let pt = meta.byUid ? (m.battleTokens || []).find(t => t.type === 'player' && t.playerUid === meta.byUid) : null;
        if (pt && pt.fogReveal) tok.fogReveal = JSON.parse(JSON.stringify(pt.fogReveal));
        tok.sensorFrom = meta.casterId || null; tok.sensorReach = f.reach === Infinity ? null : (f.reach || null);
        m.battleTokens = m.battleTokens || [];
        m.battleTokens.push(tok);
        fx.tokenId = tok.id;
    }
    function removeSensor(m, fx, why) {
        let tok = (m.battleTokens || []).find(t => t.id === fx.tokenId);
        if (tok && tok.initiativeId) { window.gmInitiative = list().filter(e => e.id !== tok.initiativeId); }
        m.battleTokens = (m.battleTokens || []).filter(t => t.id !== fx.tokenId);
        if (why) log({ text: `${tok ? tok.name : 'A Sensor'} is gone (${why}).` });
    }
    function sensorTangible(tokenId, meta) {
        maps().forEach(m => {
            let tok = (m.battleTokens || []).find(t => t.id === tokenId && t.sensor); if (!tok || tok.tangible) return;
            tok.sensorHidden = false; tok.tangible = true;
            let owner = meta.casterId ? list().find(e => e.id === meta.casterId) : null;
            let en = { id: rid('sen'), name: tok.name, baseName: tok.name, faction: owner ? owner.faction === 'enemy' ? 'enemy' : 'ally' : 'ally', currentHp: 10, maxHp: 10, tempHp: 0, ac: 10, ap: 0, apCur: 0,
                baseInitiative: owner ? owner.baseInitiative : 0, conditions: [], sensor: true, sensorPi: tok.pi, sensorOwnerId: meta.casterId || null, sensorOwnerUid: tok.ownerUid || null };
            let i = owner ? list().indexOf(owner) : -1;
            if (i >= 0) window.gmInitiative.splice(i + 1, 0, en); else window.gmInitiative.push(en);
            tok.initiativeId = en.id;
            log({ text: `${tok.name} is used as the source of ${meta.label}: it's visible and tangible now (AC 10, 10 HP).` });
        });
    }
    // ── Zones of blinding: Blinded while inside ──
    function zoneSync() {
        let inside = new Set();
        maps().forEach(m => {
            let zs = (m.powerFx || []).filter(f => f.kind === 'zone'); if (!zs.length || !m.battleMapEnabled) return;
            let cells = new Set(); zs.forEach(z => z.cells.forEach(c => cells.add(c[0] + ',' + c[1])));
            (m.battleTokens || []).forEach(t => {
                if (t.sensor || !window.apxTokFoot) return;
                let f = window.apxTokFoot(m.id, t), hit = false;
                for (let x = f.x0; x <= f.x1 && !hit; x++) for (let y = f.y0; y <= f.y1 && !hit; y++) if (cells.has(x + ',' + y)) hit = true;
                if (!hit) return;
                let e = entryFor(m.id, t.id); if (e) inside.add(e.id);
            });
        });
        list().forEach(e => {
            if (inside.has(e.id) && !e._zoneBlind) {
                e._zoneBlind = true;
                if (hasCond(e, 'blinded')) e._zoneBlindHad = true;
                else { if (typeof _gmAddCondition === 'function') _gmAddCondition(e, 'blinded'); log({ text: `${pub(e)} is Blinded (inside a zone of blinding).` }); }
            } else if (!inside.has(e.id) && e._zoneBlind) {
                delete e._zoneBlind;
                let keep = e._zoneBlindHad || (e._powerFx || []).some(f => (f.conds || []).includes('blinded'));
                delete e._zoneBlindHad;
                if (!keep) { if (e.faction === 'player' && e.playerUid && !e.companionOf && typeof _gmSetPlayerCondition === 'function') _gmSetPlayerCondition(e, 'blinded', false); else if (typeof _gmRemoveCondition === 'function') _gmRemoveCondition(e, 'blinded'); log({ text: `${pub(e)} is out of the zone: no longer Blinded.` }); }
            }
        });
    }
    window._gmZoneSync = zoneSync;
    setInterval(() => { try { if (maps().some(m => (m.powerFx || []).some(f => f.kind === 'zone')) || list().some(e => e._zoneBlind)) zoneSync(); } catch (e) { } }, 2000);
    // ── Moving through hazards (and into or out of zones) ──
    function lineCellsBetween(a, b) {
        let out = [], dx = b.gridX - a.gridX, dy = b.gridY - a.gridY, n = Math.max(Math.abs(dx), Math.abs(dy));
        for (let i = 1; i <= n; i++) out.push([Math.round(a.gridX + dx * i / n), Math.round(a.gridY + dy * i / n)]);
        return out;
    }
    window._gmPowerMoved = function (mapId, tok, from, to) {
        if (!tok || !from || !to || (from.gridX === to.gridX && from.gridY === to.gridY)) return;
        if (tok._noHazard) { delete tok._noHazard; setTimeout(zoneSync, 0); return; }
        let m = mapById(mapId); if (!m) return;
        let hz = (m.powerFx || []).filter(f => f.dmg && (f.kind === 'hazard' || (f.kind === 'wall' && f.sub === 'hazard')));
        if (hz.length && !tok.sensor) {
            let e = entryFor(mapId, tok.id), sp = window.APXBattle ? window.APXBattle.span(tok.size || 'medium') : 1;
            let steps = lineCellsBetween(from, to);
            hz.forEach(f => {
                let set = new Set(f.cells.map(c => c[0] + ',' + c[1]));
                let hits = steps.filter(s => { for (let x = s[0]; x < s[0] + sp; x++) for (let y = s[1]; y < s[1] + sp; y++) if (set.has(x + ',' + y)) return true; return false; }).length;
                if (!hits || !e || !window.APXDice) return;
                let times = f.kind === 'hazard' ? hits : 1;
                let card = APXDice.damage({ label: `${f.label}: ${f.kind === 'wall' ? 'passing through the wall' : `hazardous ground (${times} square${times > 1 ? 's' : ''})`}`, who: gmn(e), formula: Array(times).fill(f.dmg).join('+'), dmgType: f.type || '', perks: false });
                let n = card && card.parts ? card.parts.filter(p => p.kind === 'dmg').reduce((t, p) => t + (p.total || 0), 0) : 0;
                let types = window.APXDamage && f.type ? window.APXDamage.parts(f.type) : ['True'];
                if (n > 0 && typeof _gmDamage === 'function') _gmDamage(e, { raw: n, types: types.length ? types : ['True'], hit: null, src: `${f.label} (${f.kind === 'wall' ? 'hazardous wall' : 'hazardous ground'})` });
            });
        }
        setTimeout(zoneSync, 0);
    };
    // ── Teleports and pushes ──
    function moveTok(mv, meta) {
        let m = mapById(mv.mapId); if (!m) return;
        let tok = (m.battleTokens || []).find(t => t.id === mv.tokenId); if (!tok) return;
        if (mv.kind === 'teleport') tok._noHazard = true;   // (teleporting doesn't pass through anything)
        if (typeof _btCommitMove === 'function') _btCommitMove(mv.mapId, 'omWin_' + mv.mapId, tok.id, mv.gx, mv.gy, { noPortal: true });
        else { tok.gridX = mv.gx; tok.gridY = mv.gy; }
        log({ text: `${tok.name || 'A creature'} ${mv.kind === 'teleport' ? 'teleports' : 'is moved'} (${meta.by ? meta.by + '\'s ' : ''}${meta.label}).` });
    }
    // ── Growing or shrinking ──
    function sizeToPlayer(t, size) {
        if (t.type === 'player' && t.playerUid && window._gmSendBuff) window._gmSendBuff(t.playerUid, { size: size || null });
    }
    function resize(rz, meta) {
        let m = mapById(rz.mapId); if (!m || !window.APXBattle) return;
        let L = window.APXBattle.SIZE_LIST;
        (rz.tokenIds || []).forEach(id => {
            let t = (m.battleTokens || []).find(x => x.id === id); if (!t) return;
            let base = t._sizeFx ? t._sizeFx.base : (t.size || 'medium'), i = Math.max(0, L.indexOf(base));
            let ni = Math.max(0, Math.min(L.length - 1, i + (rz.dir === 'shrink' ? -1 : 1)));
            if (ni === i) { log({ text: `${t.name || 'It'} can't get any ${rz.dir === 'shrink' ? 'smaller' : 'bigger'}.` }); return; }
            t._sizeFx = { pi: meta.pi, base, had: !!t.sizeOverride && !t._sizeFx };
            t.size = L[ni]; t.sizeOverride = true;
            sizeToPlayer(t, L[ni]);
            log({ text: `${t.name || 'A creature'} ${rz.dir === 'shrink' ? 'shrinks' : 'grows'} to ${L[ni][0].toUpperCase() + L[ni].slice(1)} (${meta.label}).` });
        });
    }
    // ── Invisible: hidden from the players (its owner still sees their own token) ──
    function markInvisible(ev, uid, meta) {
        let mark = (mapId, id) => { let m = mapById(mapId), t = m && (m.battleTokens || []).find(x => x.id === id); if (t) t.invisible = meta.pi || true; };
        let bt = ev.buffTarget || {};
        if (bt.tokenIds) bt.tokenIds.forEach(id => mark(bt.mapId, id));
        if (bt.tokenId) mark(bt.mapId, bt.tokenId);
        if (bt.self && uid) maps().forEach(m => (m.battleTokens || []).forEach(t => { if (t.type === 'player' && t.playerUid === uid) t.invisible = meta.pi || true; }));
    }
    window._gmBuffDropped = function (uid, ev) {
        let changed = false;
        maps().forEach(m => (m.battleTokens || []).forEach(t => { if (t.type === 'player' && t.playerUid === uid && t.invisible && (!ev.pi || t.invisible === ev.pi)) { delete t.invisible; changed = true; } }));
        if (changed) { log({ text: `${ev.who || 'A player'} is visible again.` }); save(); redraw(); }
    };
    // ── What's active on each creature (to end one: published with the fight for players' Dispel) ──
    window._gmPowersOn = function () {
        let out = {};
        // (one row per power: its buff, its Conditions and its cast are the same instance)
        let add = (k, x) => { let l = out[k] = out[k] || [], had = x.pi ? l.find(y => y.pi === x.pi) : null; if (had) { if (!had.by && x.by) had.by = x.by; return; } l.push(x); };
        list().forEach(e => {
            let k = e.faction === 'player' && e.playerUid && !e.companionOf ? 'u:' + e.playerUid : e.companionOf ? 'c:' + e.companionOf : e.id;
            (Array.isArray(e._fx) ? e._fx : []).filter(f => f.powerBuff).forEach(f => add(k, { pi: f.pi || null, fxId: f.id, entryId: e.id, kind: 'buff', name: f.name || 'Power', lvl: f.lvl || 1, by: f.from || '' }));
            (e._powerFx || []).forEach(f => add(k, { pi: f.pi || null, fxId: f.id, entryId: e.id, kind: 'pfx', name: f.label || 'Power', lvl: f.lvl || 1, by: '' }));
            (e._casts || []).forEach(c => add(k, { pi: c.pi, entryId: e.id, kind: 'cast', name: c.name, lvl: c.lvl || 1, by: gmn(e) }));
        });
        // A player's own powers (from their sheet) and the buffs on them
        (window.gmParty || []).forEach(pm => {
            let st = pm.state || {}, k = 'u:' + pm.fileName;
            (st.activePowers || []).forEach(a => { if (!(out[k] || []).some(x => x.pi === a.id)) add(k, { pi: a.id, kind: 'own', uid: pm.fileName, name: a.name, lvl: a.lvl || 1, by: (pm.summary && pm.summary.name) || '' }); });
            (st.powerBuffs || []).forEach(b => { if (b.pi && !(out[k] || []).some(x => x.pi === b.pi)) add(k, { pi: b.pi, kind: 'pbuff', uid: pm.fileName, name: b.name || 'Power', lvl: b.lvl || 1, by: b.from || '' }); });
        });
        return out;
    };
    function endOne(item, why) {
        if (item.pi) {
            // a player's own power: their sheet ends it (and tells the tracker); anything else, here
            if (item.kind === 'own' && item.uid && window._gmSendBuff) { window._gmSendBuff(item.uid, { endOwn: item.pi, why }); return; }
            let r = window._gmCastReg[item.pi];
            if (r && r.uid && window._gmSendBuff) window._gmSendBuff(r.uid, { endOwn: item.pi, why });
            window._gmEndPi(item.pi, why, { endOwner: false });
            if (item.kind === 'pbuff' && item.uid && window._gmSendBuff) window._gmSendBuff(item.uid, { endPi: item.pi, why });
            return;
        }
        let e = list().find(x => x.id === item.entryId); if (!e) return;
        if (item.kind === 'buff') { e._fx = (e._fx || []).filter(f => f.id !== item.fxId); log({ text: `${item.name} on ${pub(e)} ends (${why}).` }); }
        else if (item.kind === 'pfx' && typeof _gmEndPfx === 'function') _gmEndPfx(e, item.fxId, why);
        redraw(); save();
    }
    async function dispel(d, meta, uid) {
        let e = entryFor(d.mapId, d.tokenId); if (!e) { log({ gmOnly: true, text: `${meta.by}'s ${meta.label} tries to end a power, but its target isn't in the tracker: do it by hand.` }); return; }
        let all = window._gmPowersOn(), k = e.faction === 'player' && e.playerUid && !e.companionOf ? 'u:' + e.playerUid : e.companionOf ? 'c:' + e.companionOf : e.id;
        let ok = (all[k] || []).filter(x => (parseInt(x.lvl) || 1) <= (parseInt(d.lvl) || 1) && x.pi !== meta.pi);
        let why = `ended by ${meta.by ? meta.by + '\'s ' : ''}${meta.label}`;
        let pickd = !d.ask && (d.pi || d.fxId) ? ok.find(x => (d.pi && x.pi === d.pi) || (d.fxId && x.fxId === d.fxId)) : null;
        if (!pickd) {
            if (!ok.length) { log({ text: `${meta.by}'s ${meta.label}: ${pub(e)} has no power of Level ${d.lvl} or lower on it to end.` }); return; }
            if (ok.length === 1) pickd = ok[0];
            else if (window.APXDice && APXDice.ask) {
                let a = await APXDice.ask(meta.label, `End which power on ${gmn(e)}? (Level ${d.lvl} or lower)`, ok.slice(0, 10).map((x, i) => ['d' + i, `${x.name} (Level ${x.lvl}${x.by ? ', ' + x.by : ''})`, i ? '' : 'pri']));
                if (!a) return;
                pickd = ok[+a.slice(1)];
            }
        }
        if (!pickd) return;
        endOne(pickd, why);
        log({ text: `${meta.by || 'Someone'}'s ${meta.label} ends ${pickd.name} on ${pub(e)}.` });
    }

    // ── An NPC's own lasting powers ──
    window._gmNpcCastStart = function (e, p, play) {
        let d = (p && p.draft) || {}, dur = d.duration || 'instant';
        if (!e || dur === 'instant') return null;
        play = play || (window.apxPowerPlay ? window.apxPowerPlay(d, p.lvl) : {});
        e._casts = (e._casts || []).filter(c => { if (c.name === (p.name || 'Power')) { setTimeout(() => window._gmEndPi(c.pi, 'used again'), 0); return false; } return true; });
        let dm = d.durationMods || {};
        let c = { pi: rid('pi'), name: p.name || 'Power', lvl: parseInt(p.lvl) || 1, dur, left: window.gmCombatStarted && window.apxDurTurns ? window.apxDurTurns(dur) : null,
            conc: !!(d.refunds && d.refunds.concentration), dmgInt: !!dm.dmgInterrupt, beneficial: !play.harmful };
        e._casts.push(c);
        reg(c.pi, { name: c.name, lvl: c.lvl, dur, uid: null, casterId: e.id, by: gmn(e) });
        return { id: c.pi, dur, lvl: c.lvl };
    };
    // Its turn starts: its powers run down, Concentration costs 2 AP, an Instant map effect is over
    window._gmPowerTurnStart = function (e) {
        maps().forEach(m => {
            let gone = (m.powerFx || []).filter(f => !f.pi && f.casterId === e.id && f.left != null && --f.left <= 0);
            if (gone.length) { m.powerFx = m.powerFx.filter(f => !gone.includes(f)); gone.forEach(f => { if (f.kind === 'sensor') removeSensor(m, f, null); }); log({ text: `${gone[0].label}'s ${gone.map(fxName).join(', ')} ${gone.length > 1 ? 'are' : 'is'} gone.` }); zoneSync(); save(); }
        });
        (e._casts || []).slice().forEach(c => { if (c.left != null && --c.left <= 0) window._gmEndPi(c.pi, 'its time is up'); });
        let conc = (e._casts || []).filter(c => c.conc);
        if (conc.length && e.faction !== 'player' && window.APXDice && APXDice.ask) setTimeout(async () => {
            for (let c of conc) {
                if (!(e._casts || []).includes(c)) continue;
                let have = typeof gmApCurrent === 'function' ? gmApCurrent(e) : 2;
                let a = await APXDice.ask(`Concentration: ${c.name}`, `${gmn(e)} keeps ${c.name} up? It costs 2 AP at the start of each of its turns (it has ${have}).`, [['keep', 'Spend 2 AP', 'pri'], ['end', 'Let it end']]);
                if (a === 'keep') { e.apCur = Math.max(0, have - 2); log({ text: `${pub(e)} keeps ${c.name} up (Concentration: 2 AP).` }); redraw(); }
                else window._gmEndPi(c.pi, 'it let its Concentration go');
            }
        }, 400);
    };
    // It took damage: a Sensor destroyed, Concentration saves, a beneficial power's Damage Interrupt
    window._gmOnHpDrop = function (e, before, after, dmg) {
        if (e.sensor && after <= 0 && list().includes(e)) {
            let over = Math.max(0, (dmg || 0) - Math.max(0, before));
            let m = maps().find(x => (x.battleTokens || []).some(t => t.initiativeId === e.id));
            log({ text: `${e.name} is destroyed${e.sensorPi ? ': its power ends' : ''}${over ? `, and ${over} damage goes through to its owner as Psychic` : ''}.` });
            let owner = e.sensorOwnerId ? list().find(x => x.id === e.sensorOwnerId) : null;
            if (e.sensorPi) window._gmEndPi(e.sensorPi, 'its Sensor was destroyed');
            else if (m) { let t = (m.battleTokens || []).find(x => x.initiativeId === e.id); if (t) m.battleTokens = m.battleTokens.filter(x => x !== t); }
            window.gmInitiative = list().filter(x => x !== e);
            if (over > 0 && owner && typeof _gmDamage === 'function') setTimeout(() => _gmDamage(owner, { raw: over, types: ['Psychic'], hit: null, src: 'its Sensor being destroyed' }), 0);
            save(); redraw();
            return;
        }
        (e._casts || []).slice().forEach(c => {
            if (c.dmgInt && c.beneficial) { window._gmEndPi(c.pi, 'it took damage (Damage Interrupt)'); return; }
            if (!c.conc || !window.APXDice) return;
            let dc = Math.max(10, Math.floor((dmg || 0) / 2));
            let sb = e.sourceNpcId && typeof ncStatBlockFor === 'function' ? ncStatBlockFor(e.sourceNpcId) : null;
            let bonus = sb ? ((sb.saves || {}).CON ?? ((sb.mods || {}).CON || 0)) : 0;
            let first = true;
            APXDice.check({ kind: 'save', attr: 'CON', label: `Concentration: ${c.name} (DC ${dc})`, who: gmn(e), bonus, perks: false, initId: e.id,
                onResult: r => { if (!first) return; first = false; if (r.total >= dc) return `${gmn(e)} keeps ${c.name} up.`; window._gmEndPi(c.pi, `Concentration lost (${r.total} vs DC ${dc})`); return `Concentration lost: ${c.name} ends.`; } });
        });
    };
    // An Invisible NPC (a power) attacking: a Concentration check, DC 10 +5 for each hostile action before
    window._gmNpcHostile = function (e) {
        if (!e) return;
        (Array.isArray(e._fx) ? e._fx : []).filter(f => f.powerBuff && (f.invisible || f.actInt)).forEach(f => {
            if (f.actInt && !f.harmful) { e._fx = e._fx.filter(x => x !== f); log({ text: `${f.name} on ${pub(e)} ends (it attacked: Action Interrupt).` }); return; }
            let n = parseInt(f.invisN) || 0, dc = 10 + 5 * n; f.invisN = n + 1;
            let sb = e.sourceNpcId && typeof ncStatBlockFor === 'function' ? ncStatBlockFor(e.sourceNpcId) : null;
            let bonus = sb ? ((sb.saves || {}).CON ?? ((sb.mods || {}).CON || 0)) : 0, first = true;
            if (window.APXDice) APXDice.check({ kind: 'save', attr: 'CON', label: `Stay Invisible: Concentration (DC ${dc})`, who: gmn(e), bonus, perks: false, initId: e.id,
                onResult: r => { if (!first) return; first = false; if (r.total >= dc) return `${gmn(e)} stays Invisible.`; e._fx = (e._fx || []).filter(x => x !== f); maps().forEach(m => (m.battleTokens || []).forEach(t => { if (t.initiativeId === e.id && t.invisible) delete t.invisible; })); save(); redraw(); return `${gmn(e)} is visible again.`; } });
        });
    };
})();
