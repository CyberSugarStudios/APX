// ----------------------------------------------------------------
// APX Battle Map — shared token engine (GM Tools + Character Sheet)
// ----------------------------------------------------------------
// ONE implementation used by BOTH the GM map and the player map, so
// geometry, collision, rendering and image quality are identical.
//
// POSITION AUTHORITY
//   NPC / monster tokens  -> the GM's token list (published to players
//                            via worldCodes/{code}.publicNotes.otherMaps)
//   PLAYER tokens         -> worldCodes/{code}/players/{playerUid}
//                            field battlePositions.{mapId}.{tokenId}
//   Both the GM and the owning player write that same field, and both
//   listen to it. Firestore orders the writes, so whoever moved last
//   wins on every screen — no timestamps, caches or locks needed.
//
// RENDERING
//   Tokens are NOT placed inside the zoomed/panned viewport (a CSS
//   scale() layer the browser rasterises once and then stretches —
//   that is what made tokens blurry). They live in a screen-space
//   layer and are re-laid-out at their real on-screen pixel size on
//   every pan/zoom, so portraits are always drawn at native resolution.
// ----------------------------------------------------------------
(function () {
    'use strict';

    const SIZES     = { tiny: 0.5, small: 0.75, medium: 1, large: 2, huge: 3, gargantuan: 4 };
    const SIZE_LIST = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'];

    // ── Geometry ─────────────────────────────────────────────────
    function grid(g) {
        g = g || {};
        let cs = parseFloat(g.cellSize); if (!(cs > 0)) cs = 50;
        let op = parseFloat(g.opacity);
        return { cellSize: cs, offsetX: parseFloat(g.offsetX) || 0, offsetY: parseFloat(g.offsetY) || 0,
            // line style (the GM's Grid settings): colour, thickness in screen pixels, opacity
            color: /^#[0-9a-f]{3,8}$/i.test(g.color || '') ? g.color : '#ffffff',
            thickness: Math.max(1, Math.min(8, parseInt(g.thickness, 10) || 1)),
            opacity: isFinite(op) ? Math.max(0, Math.min(1, op)) : 0.35 };
    }
    // Same origin math as the grid-line drawing code on both pages
    function origin(g) { return { ox: g.offsetX % g.cellSize, oy: g.offsetY % g.cellSize }; }
    function mult(size) { return SIZES[size || 'medium'] || 1; }
    // Number of grid cells a token covers along each side
    function span(size) { let m = mult(size); return m <= 1 ? 1 : m; }
    function center(g, gx, gy, size) {
        let m = mult(size), off = m <= 1 ? 0.5 : m / 2, o = origin(g);
        return { px: o.ox + (gx + off) * g.cellSize, py: o.oy + (gy + off) * g.cellSize };
    }
    function diameter(g, size) {
        let m = mult(size);
        return Math.max(12, g.cellSize * (m <= 1 ? m * 0.85 : m * 0.9));
    }
    // Image-pixel point -> top-left grid cell, keeping the token centred on the pointer
    function pointToCell(g, x, y, size) {
        let o = origin(g), s = span(size);
        return {
            gridX: Math.round((x - o.ox) / g.cellSize - s / 2),
            gridY: Math.round((y - o.oy) / g.cellSize - s / 2)
        };
    }

    // ── Collision ────────────────────────────────────────────────
    // Two tokens collide when they are the SAME size and occupy the same
    // grid square(s). (Different sizes may share a square — a tiny rat
    // can sit under an ogre.) For tiny/small/medium this is exactly
    // "same size AND same gridX/gridY"; for large+ the full footprint is
    // compared so two 2x2 tokens can't half-overlap either.
    function collides(sizeA, ax, ay, sizeB, bx, by) {
        if (mult(sizeA) !== mult(sizeB)) return false;
        let s = span(sizeA);
        return ax < bx + s && bx < ax + s && ay < by + s && by < ay + s;
    }
    // tokens: array of token objects; moving: {id, size}; posOf(tok) -> {gridX, gridY}
    // A Swarm shares squares with any creature, so it never blocks or is blocked
    function findBlocker(tokens, moving, gx, gy, posOf) {
        let me = moving.swarm ? moving : (tokens || []).find(t => t && t.id === moving.id);
        if (me && me.swarm) return null;
        for (let o of (tokens || [])) {
            if (!o || o.id === moving.id || o.swarm || o._down || o.down) continue;   // a dead, downed or Prone creature can be stood over
            let p = posOf(o);
            if (collides(moving.size, gx, gy, o.size, p.gridX, p.gridY)) return o;
        }
        return null;
    }
    // Nearest free cell (ring search). Used when ADDING a token — there is
    // no "last spot" to return to, so it goes to the closest open square.
    function findFreeCell(tokens, moving, gx, gy, posOf, maxR) {
        if (!findBlocker(tokens, moving, gx, gy, posOf)) return { gridX: gx, gridY: gy };
        let step = span(moving.size);
        for (let r = 1; r <= (maxR || 15); r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (let dy = -r; dy <= r; dy++) {
                    if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                    let nx = gx + dx * step, ny = gy + dy * step;
                    if (!findBlocker(tokens, moving, nx, ny, posOf)) return { gridX: nx, gridY: ny };
                }
            }
        }
        return null;
    }

    // ── Player-position store (live from Firestore) ─────────────
    const store = { byUid: {}, portraits: {}, profiles: {}, mail: {}, measures: {}, pings: {}, draws: {} };
    const changeHandlers = new Set();
    let _unsub = null, _code = null;

    function _num(v) { return typeof v === 'number' && isFinite(v); }

    // Effective position of any token. Player tokens read the live
    // authority first; everything else uses the GM's token data.
    function posOf(mapId, tok) {
        if (tok && (tok.type === 'player' || tok.type === 'companion') && tok.playerUid) {   // players move their own (and their companion's) tokens
            let p = store.byUid[tok.playerUid]?.[mapId]?.[tok.id];
            if (p && _num(p.gridX) && _num(p.gridY)) return { gridX: p.gridX, gridY: p.gridY };
        }
        return { gridX: parseInt(tok?.gridX, 10) || 0, gridY: parseInt(tok?.gridY, 10) || 0 };
    }
    // Players' measurements on a map (each player shares theirs): [{ uid, who, g }]
    function measuresFor(mapId, exceptUid) {
        return Object.keys(store.measures).filter(u => u !== exceptUid && store.measures[u].map === mapId)
            .map(u => ({ uid: u, who: (store.profiles[u] && store.profiles[u].name) || 'A player', g: store.measures[u].g }));
    }
    // Share (or clear, g = null) your measurement on a map with the GM and the other players
    function writeMeasure(inviteCode, uid, mapId, g) {
        let code = (inviteCode || _code || '').toUpperCase().trim();
        if (!uid) return Promise.resolve();
        if (g) store.measures[uid] = { map: mapId, g }; else delete store.measures[uid];
        if (!code || typeof window.apxAuth?.writeBattleMeasure !== 'function') return Promise.resolve();
        return window.apxAuth.writeBattleMeasure(code, uid, g ? { map: mapId, g } : null).catch(e => console.warn('Measure share failed:', e.message));
    }
    // Players' pings on a map (each player's latest): [{ id, x, y, who, t }]
    function pingsFor(mapId) {
        return Object.keys(store.pings).map(u => store.pings[u]).filter(p => p && p.map === mapId && p.id)
            .map(p => ({ id: p.id, x: p.x, y: p.y, t: p.t, who: p.who || 'A player' }));
    }
    // Everyone's drawings on a map (all players'), each stroke tagged with whose it is
    function drawingsFor(mapId) {
        let out = [];
        Object.keys(store.draws).forEach(u => ((store.draws[u] || {})[mapId] || []).forEach(st => out.push(Object.assign({ by: u }, st))));
        return out;
    }
    function myDrawings(uid, mapId) { return (((store.draws[uid] || {})[mapId]) || []).slice(); }
    // Share your ping / drawings (players: on your own record; the page passes the GM's elsewhere)
    function writePing(inviteCode, uid, mapId, ping) {
        let code = (inviteCode || _code || '').toUpperCase().trim();
        let p = Object.assign({ map: mapId }, ping);
        if (uid) store.pings[uid] = p;
        _notify();
        if (!code || !uid || typeof window.apxAuth?.writePlayerBattle !== 'function') return Promise.resolve();
        return window.apxAuth.writePlayerBattle(code, uid, { battlePing: p }).catch(e => console.warn('Ping failed:', e.message));
    }
    function writeDrawings(inviteCode, uid, mapId, strokes) {
        let code = (inviteCode || _code || '').toUpperCase().trim();
        if (!uid) return Promise.resolve();
        store.draws[uid] = Object.assign({}, store.draws[uid] || {}, { [mapId]: strokes });
        _notify();
        if (!code || typeof window.apxAuth?.writePlayerBattle !== 'function') return Promise.resolve();
        return window.apxAuth.writePlayerBattle(code, uid, { ['battleDraw.' + mapId]: strokes }).catch(e => console.warn('Drawing save failed:', e.message));
    }
    function portraitOf(uid) { return (uid && store.portraits[uid]) || ''; }
    function companionOf(uid) { return (uid && store.profiles[uid] && store.profiles[uid].companion) || { name: '', portrait: '' }; }

    function _notify() { changeHandlers.forEach(fn => { try { fn(); } catch (e) { console.warn('APXBattle handler:', e); } }); }
    function onChange(fn) { changeHandlers.add(fn); return () => changeHandlers.delete(fn); }

    function start(inviteCode) {
        let code = (inviteCode || '').toUpperCase().trim();
        if (!code) return;
        if (code === _code && _unsub) return;
        stop();
        _code = code;
        if (!window.apxAuth?.enabled || typeof window.apxAuth.listenBattlePositions !== 'function') return;
        _unsub = window.apxAuth.listenBattlePositions(code, docs => {
            let next = {}, profiles = {}, measures = {};
            docs.forEach(d => {
                if (!d.uid) return;
                next[d.uid] = d.battlePositions || {};
                if (d.battleMeasure && d.battleMeasure.map && d.battleMeasure.g) measures[d.uid] = d.battleMeasure;
                if (d.battlePing && d.battlePing.map) store.pings[d.uid] = d.battlePing;
                store.draws[d.uid] = d.battleDraw || {};
                if (d.charPortrait) store.portraits[d.uid] = d.charPortrait;
                if (d.profile) profiles[d.uid] = Object.assign({ uid: d.uid, portrait: d.charPortrait || '' }, d.profile);
                store.mail[d.uid] = { outbox: d.outbox || {}, giftAcks: d.giftAcks || {} };
            });
            store.byUid = next;
            store.profiles = profiles;
            store.measures = measures;
            _notify();
        });
    }
    function stop() {
        if (_unsub) { try { _unsub(); } catch (e) {} }
        _unsub = null; _code = null; store.byUid = {}; store.profiles = {}; store.measures = {}; store.pings = {}; store.draws = {};
    }

    // Move a PLAYER token: update locally at once, then write the authority.
    // Firestore applies the write to its local cache immediately, so the
    // listener confirms it on this client within the same tick.
    function move(inviteCode, playerUid, mapId, tokenId, gridX, gridY) {
        if (!playerUid || !mapId || !tokenId) return Promise.resolve();
        if (!store.byUid[playerUid]) store.byUid[playerUid] = {};
        if (!store.byUid[playerUid][mapId]) store.byUid[playerUid][mapId] = {};
        store.byUid[playerUid][mapId][tokenId] = { gridX, gridY };
        _notify();
        let code = (inviteCode || _code || '').toUpperCase().trim();
        if (!code || typeof window.apxAuth?.writeBattlePosition !== 'function') return Promise.resolve();
        return window.apxAuth.writeBattlePosition(code, playerUid, mapId, tokenId, gridX, gridY)
            .catch(e => console.warn('Battle position write failed:', e.message));
    }

    // ── Screen-space rendering ───────────────────────────────────
    // opts = {
    //   winId, win (has _scale/_offX/_offY), area (the map's viewport element), grid,
    //   tokens: [tokenVM], props: [propVM],
    //   onMove(vm,gx,gy), resolveDrop(vm,gx,gy)->{gridX,gridY}|null, previewBlocked(vm,gx,gy)->bool,
    //   onDblClick(vm), onContextMenu(vm,e), onPropContextMenu(pvm,e),
    //   fogId            canvas id: the fog is lifted into this layer so props/tokens
    //                    can sit under it (a prop half in fog is half hidden)
    //   aboveFog: Set    token ids drawn above the fog (a player's own token)
    //   selection: Set   ids (tokens + props) currently selected — GM only
    //   onSelect(ids, additive), onGroupMove([{kind,vm,gx,gy}|{kind:'prop',vm,x,y}]),
    //   canGroupMove([...])->bool, onPropMove(pvm,x,y), onPropResize(pvm,w,h),
    //   marquee: bool    Shift+drag on empty map draws a selection box
    // }
    // tokenVM = { id, gridX, gridY, size, layer, label, bg, borderColor, borderW, glow, tint,
    //   opacity, filter, portrait, title, draggable, interactive, badge, num, numColor, conds, attrs:{},
    //   ko (knocked out: snoring Z's), swarm (shares squares; drawn under others with a handle) }
    // propVM  = { id, src, x, y, w, h, layer, opacity, title, draggable, locked, resizable }
    // Stacking: layer first; within a layer, images keep their list order (so every
    // screen stacks overlapping images the same way) and tokens sit above images.
    const Z_BASE = 100, Z_FOG = 10000000, Z_ABOVE_FOG = 10000100, Z_DRAG = 20000000, Z_UI = 21000000;
    function zFor(layer, sub) { return Z_BASE + Math.max(0, (Number(layer) || 0) + 500) * 1000 + (sub || 0); }

    function _layer(area, winId) {
        let id = winId + '_btScreen';
        let l = document.getElementById(id);
        if (!l) {
            l = document.createElement('div');
            l.id = id;
            l.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:5;';
            area.appendChild(l);
            _hookArea(area, l);
        }
        return l;
    }

    // Put the fog canvas back where the page originally had it
    function _restoreFog(layer) {
        let fog = layer && layer._fog;
        if (!fog) return;
        if (fog._home && fog.parentNode === layer) {
            fog._home.insertBefore(fog, fog._homeNext && fog._homeNext.parentNode === fog._home ? fog._homeNext : null);
        }
        fog.style.transform = ''; fog.style.transformOrigin = ''; fog.style.willChange = ''; fog.style.zIndex = fog._homeZ || '3';
        layer._fog = null;
    }

    function clear(winId) {
        let l = document.getElementById(winId + '_btScreen');
        if (!l) return;
        exitMeasure(winId);   // (while the page can still hear that the measurement is gone)
        _restoreFog(l);
        l.querySelectorAll('[data-bt],[data-btp],[data-bt-ui],[data-bt-grid],[data-bt-aura]').forEach(el => el.remove());
        l._opts = null;
    }

    // ── Tokens ───────────────────────────────────────────────────
    function _paintContent(el, vm) {
        let key = (vm.portrait || '') + '|' + (vm.label || '');
        if (el._contentKey === key) return;
        el._contentKey = key;
        el._inner.innerHTML = '';
        el._label = null;
        if (vm.portrait) {
            let im = document.createElement('img');
            im.src = vm.portrait;
            im.alt = '';
            im.draggable = false;
            im.decoding = 'async';
            im.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;pointer-events:none;user-select:none;';
            el._inner.appendChild(im);
        } else {
            let sp = document.createElement('span');
            sp.style.cssText = 'font-weight:900;color:#fff;pointer-events:none;line-height:1;';
            sp.textContent = vm.label || '?';
            el._inner.appendChild(sp);
            el._label = sp;
        }
    }

    function _styleStatic(el, vm, opts) {
        let conds = (vm.conds || []).filter(Boolean);
        el.title = (vm.title || '') + (conds.length ? '\nConditions: ' + conds.join(', ') : '');
        el.style.background = vm.portrait ? 'transparent' : (vm.bg || '#475569');
        el.style.borderColor = vm.borderColor || '#e2e8f0';
        el.style.opacity = vm.opacity == null ? 1 : vm.opacity;
        el.style.filter = vm.filter || 'none';
        el.style.cursor = vm.draggable ? 'grab' : 'default';
        el.style.pointerEvents = vm.interactive === false ? 'none' : 'auto';
        el._tint.style.background = vm.tint || 'transparent';
        if (el._zzz) el._zzz.style.display = vm.ko ? 'block' : 'none';
        let hasBadge = vm.badge !== null && vm.badge !== undefined && vm.badge !== '';
        el._badge.textContent = hasBadge ? String(vm.badge) : '';
        el._badge.style.display = hasBadge ? 'flex' : 'none';
        // Small corner number (Monster 1, Monster 2 …) in the token's faction colour
        let hasNum = vm.num !== null && vm.num !== undefined && vm.num !== '';
        el._num.textContent = hasNum ? String(vm.num) : '';
        el._num.style.display = hasNum ? 'flex' : 'none';
        el._num.style.color = vm.numColor || '#fff';
        el._num.style.borderColor = vm.numColor || '#fff';
        el._num.style.opacity = vm.opacity == null ? 1 : Math.max(0.6, vm.opacity);
        // Condition marker (top-left): how many conditions are on this creature
        el._cond.textContent = conds.length ? String(conds.length) : '';
        el._cond.style.display = conds.length ? 'flex' : 'none';
        let sel = !!(opts.selection && opts.selection.has(vm.id));
        el._sel = sel;
        el.style.outline = sel ? '2px solid #22d3ee' : 'none';
        el.style.outlineOffset = sel ? '2px' : '0';
        Object.entries(vm.attrs || {}).forEach(([k, v]) => { if (v != null) el.setAttribute(k, v); });
        _paintContent(el, vm);
    }

    // Damage Aura ring (NPC trait): a see-through circle reaching `radius` squares past the token,
    // in its Energy type's colour. Drawn under every token (but over map images), hidden with it.
    const AURA_COLORS = { Fire: '#f97316', Cold: '#38bdf8', Electric: '#facc15', Acid: '#84cc16', Poison: '#a855f7', Sonic: '#e879f9', Radiation: '#22c55e', Force: '#818cf8', Psychic: '#ec4899' };
    function auraColor(type) { return AURA_COLORS[type] || (/^#/.test(type || '') ? type : '#f97316'); }
    function _hexA(hex, a) {
        let h = String(hex).replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join('');
        let n = parseInt(h.slice(0, 6), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    }
    function _styleAura(layer, el, vm) {
        if (!vm.aura) { if (el._aura) { el._aura.remove(); el._aura = null; } return; }
        if (!el._aura) {
            el._aura = document.createElement('div');
            el._aura.setAttribute('data-bt-aura', vm.id);
            el._aura.style.cssText = 'position:absolute;transform:translate(-50%,-50%);border-radius:50%;pointer-events:none;box-sizing:border-box;';
            layer.appendChild(el._aura);
        }
        let c = auraColor(vm.aura.type);
        el._aura.style.background = `radial-gradient(circle, ${_hexA(c, 0.10)} 0%, ${_hexA(c, 0.22)} 70%, ${_hexA(c, 0.32)} 100%)`;
        el._aura.style.border = `2px solid ${_hexA(c, 0.75)}`;
        el._aura.style.opacity = String(vm.opacity == null ? 1 : vm.opacity);
        el._aura.title = vm.aura.title || '';
    }
    function _placeAura(el, g, s, offX, offY, gx, gy) {
        let a = el._aura, vm = el._vm; if (!a) return;
        let c = center(g, gx, gy, vm.size);
        let side = (span(vm.size) + 2 * (vm.aura.radius || 1)) * g.cellSize * s;
        a.style.left = (offX + c.px * s) + 'px'; a.style.top = (offY + c.py * s) + 'px';
        a.style.width = side + 'px'; a.style.height = side + 'px';
        let o = el._layerRef && el._layerRef._opts;
        a.style.zIndex = String(zFor(o && o._minTokLayer != null ? o._minTokLayer : 0, 850));
    }

    function _tokenZ(el) {
        let vm = el._vm;
        if (el._drag) return Z_DRAG;
        let o = el._layerRef && el._layerRef._opts;
        if (o && o.aboveFog && o.aboveFog.has(vm.id)) return Z_ABOVE_FOG + SIZE_LIST.length - SIZE_LIST.indexOf(vm.size || 'medium');
        // Smaller tokens sit above larger ones on the same layer; a Swarm sits under every other token
        return zFor(vm.layer == null ? 1 : vm.layer, (vm.swarm ? 100 : 900) + SIZE_LIST.length - SIZE_LIST.indexOf(vm.size || 'medium'));
    }

    function _place(el, g, s, offX, offY, gx, gy) {
        let vm = el._vm;
        let c = center(g, gx, gy, vm.size);
        let d = diameter(g, vm.size) * s;
        // Borders scale with the token, so a Tiny or Small token's turn ring doesn't swallow its picture
        let bw = Math.max(1, Math.min((vm.borderW || 2) * s, d * ((vm.borderW || 2) >= 3 ? 0.075 : 0.05)));
        el.style.left = (offX + c.px * s) + 'px';
        el.style.top  = (offY + c.py * s) + 'px';
        el.style.width = d + 'px';
        el.style.height = d + 'px';
        el.style.borderWidth = bw + 'px';
        let gs = Math.min(1, d / Math.max(1, g.cellSize * 0.85 * s));   // glow shrinks with smaller tokens too
        let glow = vm.glow ? `0 0 ${Math.max(3, 20 * s * gs)}px ${Math.max(1, 5 * s * gs)}px ${vm.glow},` : '';
        el.style.boxShadow = `${glow}0 ${Math.max(1, 2 * s)}px ${Math.max(2, 8 * s)}px rgba(0,0,0,0.8)`;
        if (el._label) el._label.style.fontSize = Math.max(6, Math.round(d * 0.42)) + 'px';
        if (el._badge) el._badge.style.fontSize = Math.max(8, Math.round(d * 0.55)) + 'px';
        let nd = Math.max(13, Math.round(d * 0.4));
        [el._num, el._cond].forEach(b => {
            b.style.width = b.style.height = nd + 'px';
            b.style.fontSize = Math.max(8, Math.round(nd * 0.62)) + 'px';
            b.style.borderWidth = Math.max(1, Math.round(nd * 0.09)) + 'px';
        });
        el.style.zIndex = String(_tokenZ(el));
        if (el._aura) _placeAura(el, g, s, offX, offY, gx, gy);
    }

    // ── Props (movable map images) ───────────────────────────────
    function _placeProp(el, s, offX, offY, x, y) {
        let vm = el._vm;
        el.style.left = (offX + x * s) + 'px';
        el.style.top = (offY + y * s) + 'px';
        el.style.width = Math.max(4, vm.w * s) + 'px';
        el.style.height = Math.max(4, vm.h * s) + 'px';
        el.style.zIndex = String(el._drag ? Z_DRAG - 1 : zFor(vm.layer || 0, Math.min(800, vm._order || 0)));
    }

    function _styleProp(el, vm, opts) {
        el.title = vm.title || '';
        el.style.opacity = vm.opacity == null ? 1 : vm.opacity;
        el.style.pointerEvents = vm.interactive === false ? 'none' : 'auto';
        el.style.cursor = vm.locked ? 'default' : (vm.draggable ? 'grab' : 'default');
        if (el._src !== vm.src) {
            el._src = vm.src;
            el._img.style.display = vm.src ? 'block' : 'none';
            if (vm.src) el._img.src = vm.src;
        }
        el._ph.style.display = vm.src ? 'none' : 'flex';
        let sel = !!(opts.selection && opts.selection.has(vm.id));
        el._sel = sel;
        el.style.outline = sel ? '2px dashed #22d3ee' : (vm.hiddenMark ? '1px dashed rgba(255,255,255,.35)' : 'none');
        el._handle.style.display = (sel && vm.resizable && !vm.locked) ? 'block' : 'none';
    }

    function _createProp(layer) {
        let el = document.createElement('div');
        el.style.cssText = 'position:absolute;box-sizing:border-box;user-select:none;-webkit-user-select:none;touch-action:none;';
        let img = document.createElement('img');
        img.alt = ''; img.draggable = false; img.decoding = 'async';
        img.style.cssText = 'width:100%;height:100%;display:none;pointer-events:none;user-select:none;object-fit:fill;';
        let ph = document.createElement('div');
        ph.textContent = 'Loading image…';
        ph.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:11px;color:#cbd5e1;background:rgba(15,23,42,.5);border:1px dashed #64748b;';
        let handle = document.createElement('div');
        handle.title = 'Drag to resize';
        handle.style.cssText = 'position:absolute;right:-7px;bottom:-7px;width:14px;height:14px;background:#22d3ee;border:2px solid #0f172a;border-radius:3px;cursor:nwse-resize;display:none;pointer-events:auto;';
        el.appendChild(img); el.appendChild(ph); el.appendChild(handle);
        el._img = img; el._ph = ph; el._handle = handle;
        el._layerRef = layer;
        _attachProp(layer, el);
        return el;
    }

    // ── Layout ───────────────────────────────────────────────────
    function layout(winId) {
        let layer = document.getElementById(winId + '_btScreen');
        if (!layer || !layer._opts) return;
        let o = layer._opts, win = o.win;
        let s = win?._scale || 1, ox = win?._offX || 0, oy = win?._offY || 0;
        layer.querySelectorAll('[data-btp]').forEach(el => {
            if (!el._vm) return;
            let x = el._drag ? el._drag.x : el._vm.x, y = el._drag ? el._drag.y : el._vm.y;
            _placeProp(el, s, ox, oy, x, y);
        });
        layer.querySelectorAll('[data-bt]').forEach(el => {
            if (!el._vm) return;
            let gx = el._drag ? el._drag.gx : el._vm.gridX;
            let gy = el._drag ? el._drag.gy : el._vm.gridY;
            _place(el, o.grid, s, ox, oy, gx, gy);
        });
        if (layer._fog) {
            layer._fog.style.transform = `translate(${ox}px,${oy}px) scale(${s})`;
        }
        _layoutSwarmHandles(layer, o, s, ox, oy);
        _drawGrid(layer);
        _layoutMarks(layer);
        _layoutMeasure(layer);
        _layoutArea(layer);
        _layoutShared(layer);
        layer.querySelectorAll('[data-bt]').forEach(el => { if (el._drag && el._drag.path) _drawPath(layer, el); });
    }

    // ── Swarms under other creatures ─────────────────────────────
    // A Swarm sharing a square with another creature is drawn under it; a small handle beside that
    // creature stands in for it: hover for its details (what this viewer may see), drag it to move
    // the swarm, right-click for its menu, double-click to open it.
    function _layoutSwarmHandles(layer, o, s, offX, offY) {
        let els = [...layer.querySelectorAll('[data-bt]')].filter(el => el._vm);
        let live = new Set();
        let at = el => ({ gx: el._drag ? el._drag.gx : el._vm.gridX, gy: el._drag ? el._drag.gy : el._vm.gridY, sp: span(el._vm.size) });
        let used = new Map();   // covering token id -> handles already beside it
        els.forEach(sw => {
            if (!sw._vm.swarm || sw._drag) return;
            let a = at(sw);
            let cover = els.find(c => c !== sw && !c._vm.swarm && (() => { let b = at(c); return a.gx < b.gx + b.sp && b.gx < a.gx + a.sp && a.gy < b.gy + b.sp && b.gy < a.gy + a.sp; })());
            if (!cover) return;
            live.add(sw._vm.id);
            let h = layer.querySelector(`[data-bt-handle="${CSS.escape(sw._vm.id)}"]`);
            if (!h) {
                h = document.createElement('div');
                h.setAttribute('data-bt-handle', sw._vm.id);
                h.setAttribute('data-bt-ui', 'swarm');
                h.style.cssText = 'position:absolute;transform:translate(-50%,-50%);border-radius:50%;border:2px dashed #e2e8f0;box-sizing:border-box;overflow:hidden;display:flex;align-items:center;justify-content:center;font-weight:900;color:#fff;cursor:grab;pointer-events:auto;box-shadow:0 1px 4px rgba(0,0,0,.8);touch-action:none;';
                ['mousedown', 'mouseup', 'click'].forEach(t => h.addEventListener(t, e => e.stopPropagation()));
                h.addEventListener('dblclick', e => { e.stopPropagation(); e.preventDefault(); });
                h.addEventListener('pointerdown', e => {
                    e.stopPropagation(); e.preventDefault();
                    let tok = layer.querySelector(`[data-bt="${CSS.escape(h.getAttribute('data-bt-handle'))}"]`); if (!tok) return;
                    // the swarm's own token takes it from here (drag, select, double-click)
                    tok.dispatchEvent(new PointerEvent('pointerdown', { bubbles: false, cancelable: true, pointerId: e.pointerId, pointerType: e.pointerType, isPrimary: e.isPrimary,
                        button: e.button, buttons: e.buttons, clientX: e.clientX, clientY: e.clientY, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey }));
                });
                h.addEventListener('contextmenu', e => {
                    e.preventDefault(); e.stopPropagation();
                    let tok = layer.querySelector(`[data-bt="${CSS.escape(h.getAttribute('data-bt-handle'))}"]`);
                    if (tok && layer._opts && layer._opts.onContextMenu) layer._opts.onContextMenu(tok._vm, e);
                });
                layer.appendChild(h);
            }
            let vm = sw._vm, b = at(cover);
            let c = center(o.grid, b.gx, b.gy, cover._vm.size), d = diameter(o.grid, cover._vm.size) * s;
            let n = used.get(cover) || 0; used.set(cover, n + 1);
            let hd = Math.max(16, Math.min(30, d * 0.5));
            let ang = (135 + n * 40) * Math.PI / 180, rr = d / 2 + hd * 0.15;   // lower-left of the creature, then around it
            h.style.left = (offX + c.px * s + Math.cos(ang) * rr) + 'px';
            h.style.top = (offY + c.py * s + Math.sin(ang) * rr) + 'px';
            h.style.width = h.style.height = hd + 'px';
            h.style.fontSize = Math.max(7, Math.round(hd * 0.5)) + 'px';
            h.style.background = vm.portrait ? `center/cover no-repeat url("${String(vm.portrait).replace(/"/g, '%22')}")` : (vm.bg || '#475569');
            h.style.borderColor = vm.borderColor || '#e2e8f0';
            h.style.opacity = vm.opacity == null ? 1 : vm.opacity;
            h.style.filter = vm.filter || 'none';
            h.textContent = vm.portrait ? '' : (vm.label || 'S');
            h.title = 'Swarm under ' + (cover._vm.name || 'a creature') + ' — drag to move it\n' + (sw.title || '');
            h.style.pointerEvents = vm.interactive === false ? 'none' : 'auto';
            h.style.cursor = vm.draggable ? 'grab' : 'default';
            h.style.zIndex = String(_tokenZ(cover) + 1);
        });
        layer.querySelectorAll('[data-bt-handle]').forEach(h => { if (!live.has(h.getAttribute('data-bt-handle'))) h.remove(); });
    }

    // Grid: a canvas the size of the visible map area (not the whole map), redrawn only
    // when the view changes. Nothing map-sized is repainted when the window is resized.
    function _drawGrid(layer) {
        let cv = layer.querySelector('[data-bt-grid]'), o = layer._opts;
        if (!cv || !o || !o.imgSize || !o.imgSize.w) return;
        let area = o.area || layer.parentNode, win = o.win;
        // The area's size comes from a ResizeObserver: reading it here, right after the tokens moved,
        // forced a full layout every frame while zooming
        if (!area._btSize) {
            area._btSize = { w: area.clientWidth, h: area.clientHeight };
            if (window.ResizeObserver) {
                try { new ResizeObserver(en => { let c = en[0] && en[0].contentRect; if (c) { area._btSize = { w: Math.round(c.width), h: Math.round(c.height) }; requestAnimationFrame(() => _drawGrid(layer)); } }).observe(area); } catch (e) { }
            } else area._btSize = null;
        }
        let W = area._btSize ? area._btSize.w : area.clientWidth, H = area._btSize ? area._btSize.h : area.clientHeight;
        let dpr = Math.min(3, window.devicePixelRatio || 1);
        let pw = Math.max(1, Math.round(W * dpr)), ph = Math.max(1, Math.round(H * dpr));
        let s = win?._scale || 1, ox = win?._offX || 0, oy = win?._offY || 0;
        let g = o.grid, org = origin(g), cs = g.cellSize * s;
        let key = [pw, ph, s, ox, oy, g.cellSize, org.ox, org.oy, o.imgSize.w, o.imgSize.h, g.color, g.thickness, g.opacity].join('|');
        if (cv._key === key) return;
        cv._key = key;
        cv.style.opacity = String(g.opacity);
        if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
        let ctx = cv.getContext('2d');
        ctx.clearRect(0, 0, pw, ph);
        if (!(cs >= 4)) return;   // too dense to be useful when zoomed far out
        let x0 = Math.max(0, ox), x1 = Math.min(W, ox + o.imgSize.w * s);
        let y0 = Math.max(0, oy), y1 = Math.min(H, oy + o.imgSize.h * s);
        if (x1 <= x0 || y1 <= y0) return;
        let lw = Math.max(1, Math.round(g.thickness * dpr)), half = Math.floor(lw / 2);
        ctx.fillStyle = g.color;
        let startX = ox + org.ox * s; startX -= Math.ceil((startX - x0) / cs) * cs;
        for (let x = startX; x <= x1; x += cs) { if (x < x0 - 0.01) continue; ctx.fillRect(Math.round(x * dpr) - half, Math.round(y0 * dpr), lw, Math.round((y1 - y0) * dpr)); }
        let startY = oy + org.oy * s; startY -= Math.ceil((startY - y0) / cs) * cs;
        for (let y = startY; y <= y1; y += cs) { if (y < y0 - 0.01) continue; ctx.fillRect(Math.round(x0 * dpr), Math.round(y * dpr) - half, Math.round((x1 - x0) * dpr), lw); }
    }

    function _imgPoint(layer, e) {
        let o = layer._opts, win = o.win, area = o.area;
        let r = area.getBoundingClientRect();
        let s = win._scale || 1;
        return { x: (e.clientX - r.left - (win._offX || 0)) / s, y: (e.clientY - r.top - (win._offY || 0)) / s };
    }
    function _pointerCell(layer, el, e) {
        let p = _imgPoint(layer, e);
        return pointToCell(layer._opts.grid, p.x, p.y, el._vm.size);
    }

    // Everything selected (other than the one being dragged) moves with it
    function _groupMembers(layer, leader) {
        let o = layer._opts;
        if (!o.selection || !o.selection.has(leader._vm.id) || o.selection.size < 2) return [];
        let out = [];
        layer.querySelectorAll('[data-bt],[data-btp]').forEach(el => {
            if (el === leader || !el._vm || !o.selection.has(el._vm.id)) return;
            if (el.hasAttribute('data-btp') && el._vm.locked) return;
            out.push(el);
        });
        return out;
    }

    function _beginGroup(layer, members) {
        members.forEach(m => {
            if (m.hasAttribute('data-btp')) m._drag = { x0: m._vm.x, y0: m._vm.y, x: m._vm.x, y: m._vm.y };
            else m._drag = { sx: m._vm.gridX, sy: m._vm.gridY, gx: m._vm.gridX, gy: m._vm.gridY };
        });
    }
    function _applyGroupDelta(layer, members, dcx, dcy) {
        let cs = layer._opts.grid.cellSize;
        members.forEach(m => {
            if (m.hasAttribute('data-btp')) { m._drag.x = m._drag.x0 + dcx * cs; m._drag.y = m._drag.y0 + dcy * cs; }
            else { m._drag.gx = m._drag.sx + dcx; m._drag.gy = m._drag.sy + dcy; }
        });
    }
    function _moveList(leader, members) {
        return [leader].concat(members).map(m => m.hasAttribute('data-btp')
            ? { kind: 'prop', vm: m._vm, x: m._drag.x, y: m._drag.y }
            : { kind: 'token', vm: m._vm, gx: m._drag.gx, gy: m._drag.gy });
    }
    function _endGroup(layer, leader, members, cancelled) {
        let o = layer._opts;
        let all = [leader].concat(members);
        let moved = all.some(m => m.hasAttribute('data-btp') ? (m._drag.x !== m._drag.x0 || m._drag.y !== m._drag.y0)
                                                           : (m._drag.gx !== m._drag.sx || m._drag.gy !== m._drag.sy));
        let list = _moveList(leader, members);
        let ok = !cancelled && moved && o && (!o.canGroupMove || o.canGroupMove(list));
        all.forEach(m => { m._drag = null; m.style.opacity = String(m._vm.opacity == null ? 1 : m._vm.opacity); });
        if (!o) return;
        if (!ok) {
            if (moved && !cancelled) _glideBack(layer, all);
            else layout(o.winId);
            return;
        }
        list.forEach(mv => {
            if (mv.kind === 'prop') { mv.vm.x = mv.x; mv.vm.y = mv.y; }
            else { mv.vm.gridX = mv.gx; mv.vm.gridY = mv.gy; }
        });
        layout(o.winId);
        if (o.onGroupMove) o.onGroupMove(list);
    }
    function _glideBack(layer, els) {
        els.forEach(el => el.style.transition = 'left .15s ease-out, top .15s ease-out');
        layout(layer._opts.winId);
        setTimeout(() => els.forEach(el => el.style.transition = 'none'), 180);
    }

    function _attach(layer, el) {
        el.style.touchAction = 'none';
        el._layerRef = layer;
        // Keep the map's own pan/placement handlers from ever seeing token clicks
        el.addEventListener('mousedown', e => e.stopPropagation());
        el.addEventListener('mouseup',   e => e.stopPropagation());
        el.addEventListener('click',     e => e.stopPropagation());
        el.addEventListener('dblclick',  e => { e.stopPropagation(); e.preventDefault(); });
        el.addEventListener('wheel', () => {}, { passive: true }); // let wheel bubble to zoom

        el.addEventListener('contextmenu', e => {
            e.preventDefault(); e.stopPropagation();
            let o = layer._opts;
            if (o?.onContextMenu) o.onContextMenu(el._vm, e);
        });

        el.addEventListener('pointerdown', e => {
            let o = layer._opts; if (!o) return;
            e.stopPropagation();
            if (e.button !== 0) return;
            e.preventDefault();
            let now = Date.now();
            if (el._lastTap && now - el._lastTap < 350) {
                el._lastTap = 0;
                if (o.onDblClick) o.onDblClick(el._vm);
                return;
            }
            el._lastTap = now;
            // Selection (GM): Shift/Ctrl-click adds/removes; a plain click on an
            // unselected token selects just that token.
            if (o.onSelect) {
                if (e.shiftKey || e.ctrlKey || e.metaKey) { o.onSelect([el._vm.id], 'toggle'); return; }
                if (!o.selection || !o.selection.has(el._vm.id)) o.onSelect([el._vm.id], false);
            }
            if (!el._vm.draggable || !o.onMove) { if (o.onClick) o.onClick(el._vm, e); return; }
            el._startDrag(e);
        });
        // Starts dragging this token (also used when a Measure's start point on this creature is grabbed)
        el._startDrag = e => {
            let o = layer._opts; if (!o) return;
            try { el.setPointerCapture(e.pointerId); } catch (_) {}
            let p = _imgPoint(layer, e);
            el._drag = { sx: el._vm.gridX, sy: el._vm.gridY, gx: el._vm.gridX, gy: el._vm.gridY, px: p.x, py: p.y, alt: e.altKey };
            el._group = _groupMembers(layer, el);
            _beginGroup(layer, el._group);
            // In combat, a creature on its turn shows its path and what the move costs in AP
            let mp = !el._group.length && o.movePath ? o.movePath(el._vm) : null;
            if (mp) { el._drag.mp = mp; el._drag.path = [{ gx: el._vm.gridX, gy: el._vm.gridY }]; el._drag.diff = _diffFor(layer, el._vm); _drawPath(layer, el); }
            // Walls stop this token (a player's own): its route is followed so a wall can't be skipped over
            if (!el._group.length && (o.walls || []).length && o.wallsBlock && o.wallsBlock(el._vm)) el._drag.trail = [{ gx: el._vm.gridX, gy: el._vm.gridY }];
            el.style.transition = 'none';
            el.style.cursor = 'grabbing';
            el.style.zIndex = String(Z_DRAG);
        };

        el.addEventListener('pointermove', e => {
            if (!el._drag) return;
            let o = layer._opts; if (!o) return;
            let c = _pointerCell(layer, el, e);
            if (el._drag.path && el._drag.alt !== e.altKey) { el._drag.alt = e.altKey; _drawPath(layer, el); }
            if (c.gridX === el._drag.gx && c.gridY === el._drag.gy) return;
            el._drag.gx = c.gridX; el._drag.gy = c.gridY;
            if (el._drag.path) { _extendPath(el._drag.path, c.gridX, c.gridY); _drawPath(layer, el); }
            if (el._drag.trail) _extendPath(el._drag.trail, c.gridX, c.gridY);
            if (el._group && el._group.length) {
                _applyGroupDelta(layer, el._group, c.gridX - el._drag.sx, c.gridY - el._drag.sy);
                let ok = !o.canGroupMove || o.canGroupMove(_moveList(el, el._group));
                [el].concat(el._group).forEach(m => m.style.opacity = ok ? String(m._vm.opacity == null ? 1 : m._vm.opacity) : '0.4');
                el.style.outline = ok ? (el._sel ? '2px solid #22d3ee' : 'none') : '2px dashed #ef4444';
            } else {
                let bad = (o.previewBlocked ? !!o.previewBlocked(el._vm, c.gridX, c.gridY) : false) || !!(el._drag.trail && wallBlocking(o.walls, el._vm.size, el._drag.trail));
                el.style.opacity = bad ? '0.4' : String(el._vm.opacity == null ? 1 : el._vm.opacity);
                el.style.outline = bad ? '2px dashed #ef4444' : (el._sel ? '2px solid #22d3ee' : 'none');
            }
            layout(o.winId);
        });

        let finish = (cancelled) => {
            let d = el._drag; if (!d) return;
            let o = layer._opts;
            el.style.cursor = el._vm.draggable ? 'grab' : 'default';
            el.style.outline = el._sel ? '2px solid #22d3ee' : 'none';
            if (el._group && el._group.length) {
                let g = el._group; el._group = null;
                _endGroup(layer, el, g, cancelled);
                return;
            }
            let pinfo = _pathInfo(d);
            el._drag = null;
            _drawPath(layer, el);   // (clears the path)
            el.style.opacity = String(el._vm.opacity == null ? 1 : el._vm.opacity);
            if (!o) return;
            if (cancelled || (d.gx === d.sx && d.gy === d.sy)) { layout(o.winId); return; }
            // A wall (or a closed door) in the way: back to the last spot
            if (d.trail && wallBlocking(o.walls, el._vm.size, d.trail)) { toast(o.area, 'A wall is in the way.'); _glideBack(layer, [el]); return; }
            let dest = o.resolveDrop ? o.resolveDrop(el._vm, d.gx, d.gy) : { gridX: d.gx, gridY: d.gy };
            if (!dest || (dest.gridX === d.sx && dest.gridY === d.sy)) { _glideBack(layer, [el]); return; }  // blocked -> back to last spot
            if (d.trail && (dest.gridX !== d.gx || dest.gridY !== d.gy) && wallBlocking(o.walls, el._vm.size, [{ gx: d.gx, gy: d.gy }, { gx: dest.gridX, gy: dest.gridY }])) { toast(o.area, 'A wall is in the way.'); _glideBack(layer, [el]); return; }
            // The page can refuse a move (not enough AP for the path): the token goes back
            if (pinfo && o.beforeMove && o.beforeMove(el._vm, dest.gridX, dest.gridY, pinfo) === false) { _glideBack(layer, [el]); return; }
            el._vm.gridX = dest.gridX; el._vm.gridY = dest.gridY;
            layout(o.winId);
            o.onMove(el._vm, dest.gridX, dest.gridY, pinfo);
        };
        el.addEventListener('pointerup',     () => finish(false));
        el.addEventListener('pointercancel', () => finish(true));
        el.addEventListener('lostpointercapture', () => { if (el._drag) finish(false); });
    }

    function _attachProp(layer, el) {
        // A LOCKED prop lets clicks fall through to the map (so you can pan over a
        // floor image), but still answers right-click so it can be unlocked.
        el.addEventListener('mousedown', e => { if (!el._vm?.locked) e.stopPropagation(); });
        el.addEventListener('mouseup',   e => { if (!el._vm?.locked) e.stopPropagation(); });
        el.addEventListener('click',     e => { if (!el._vm?.locked) e.stopPropagation(); });
        el.addEventListener('contextmenu', e => {
            e.preventDefault(); e.stopPropagation();
            let o = layer._opts;
            if (o?.onPropContextMenu) o.onPropContextMenu(el._vm, e);
        });

        // Resize handle (keeps aspect ratio; Alt = free)
        el._handle.addEventListener('pointerdown', e => {
            let o = layer._opts; if (!o || e.button !== 0) return;
            e.stopPropagation(); e.preventDefault();
            try { el._handle.setPointerCapture(e.pointerId); } catch (_) {}
            let p = _imgPoint(layer, e);
            el._rs = { px: p.x, py: p.y, w: el._vm.w, h: el._vm.h, ratio: el._vm.h / Math.max(1, el._vm.w) };
        });
        el._handle.addEventListener('pointermove', e => {
            if (!el._rs) return;
            let p = _imgPoint(layer, e), rs = el._rs;
            let w = Math.max(10, rs.w + (p.x - rs.px));
            let h = e.altKey ? Math.max(10, rs.h + (p.y - rs.py)) : w * rs.ratio;
            el._vm.w = w; el._vm.h = h;
            layout(layer._opts.winId);
        });
        let endRs = () => {
            if (!el._rs) return;
            el._rs = null;
            let o = layer._opts;
            if (o?.onPropResize) o.onPropResize(el._vm, Math.round(el._vm.w), Math.round(el._vm.h));
        };
        el._handle.addEventListener('pointerup', endRs);
        el._handle.addEventListener('pointercancel', endRs);

        el.addEventListener('pointerdown', e => {
            let o = layer._opts; if (!o || !el._vm) return;
            if (el._vm.locked) return;               // fall through to the map
            e.stopPropagation();
            if (e.button !== 0) return;
            e.preventDefault();
            if (o.onSelect) {
                if (e.shiftKey || e.ctrlKey || e.metaKey) { o.onSelect([el._vm.id], 'toggle'); return; }
                if (!o.selection || !o.selection.has(el._vm.id)) o.onSelect([el._vm.id], false);
            }
            if (!el._vm.draggable) return;
            try { el.setPointerCapture(e.pointerId); } catch (_) {}
            let p = _imgPoint(layer, e);
            el._drag = { x0: el._vm.x, y0: el._vm.y, x: el._vm.x, y: el._vm.y, px: p.x, py: p.y };
            el._group = _groupMembers(layer, el);
            _beginGroup(layer, el._group);
            el.style.cursor = 'grabbing';
        });
        el.addEventListener('pointermove', e => {
            let d = el._drag; if (!d) return;
            let o = layer._opts; if (!o) return;
            let p = _imgPoint(layer, e), cs = o.grid.cellSize;
            // Moves in whole grid squares so it stays lined up with tokens (Alt = free move)
            let dx = p.x - d.px, dy = p.y - d.py;
            let dcx = Math.round(dx / cs), dcy = Math.round(dy / cs);
            let nx = e.altKey && !(el._group && el._group.length) ? d.x0 + dx : d.x0 + dcx * cs;
            let ny = e.altKey && !(el._group && el._group.length) ? d.y0 + dy : d.y0 + dcy * cs;
            if (nx === d.x && ny === d.y) return;
            d.x = nx; d.y = ny;
            if (el._group && el._group.length) {
                _applyGroupDelta(layer, el._group, dcx, dcy);
                let ok = !o.canGroupMove || o.canGroupMove(_moveList(el, el._group));
                [el].concat(el._group).forEach(m => m.style.opacity = ok ? String(m._vm.opacity == null ? 1 : m._vm.opacity) : '0.4');
            }
            layout(o.winId);
        });
        let finish = (cancelled) => {
            let d = el._drag; if (!d) return;
            let o = layer._opts;
            el.style.cursor = 'grab';
            if (el._group && el._group.length) {
                let g = el._group; el._group = null;
                _endGroup(layer, el, g, cancelled);
                return;
            }
            el._drag = null;
            if (!o) return;
            if (cancelled || (d.x === d.x0 && d.y === d.y0)) { layout(o.winId); return; }
            el._vm.x = d.x; el._vm.y = d.y;
            layout(o.winId);
            if (o.onPropMove) o.onPropMove(el._vm, d.x, d.y);
        };
        el.addEventListener('pointerup', () => finish(false));
        el.addEventListener('pointercancel', () => finish(true));
        el.addEventListener('lostpointercapture', () => { if (el._drag) finish(false); });
    }

    function _create(layer) {
        let el = document.createElement('div');
        el.style.cssText = 'position:absolute;transform:translate(-50%,-50%);border-style:solid;border-radius:50%;' +
            'box-sizing:border-box;overflow:visible;user-select:none;-webkit-user-select:none;';
        let inner = document.createElement('div');
        inner.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;border-radius:50%;overflow:hidden;';
        let tint = document.createElement('div');
        tint.style.cssText = 'position:absolute;inset:0;border-radius:50%;pointer-events:none;';
        // Big centred number (e.g. bleed-out turns remaining)
        let badge = document.createElement('div');
        badge.style.cssText = 'position:absolute;inset:0;display:none;align-items:center;justify-content:center;pointer-events:none;' +
            'color:#fff;font-weight:900;line-height:1;text-shadow:0 0 3px #000,0 0 6px #000,0 1px 2px #000;';
        let chip = 'position:absolute;display:none;align-items:center;justify-content:center;pointer-events:none;' +
            'border-radius:50%;border-style:solid;font-weight:900;line-height:1;box-sizing:border-box;box-shadow:0 1px 3px rgba(0,0,0,.8);';
        let num = document.createElement('div');
        num.style.cssText = chip + 'right:-12%;bottom:-12%;background:rgba(10,10,15,.92);';
        let cond = document.createElement('div');
        cond.style.cssText = chip + 'left:-12%;top:-12%;background:#7c2d12;color:#fed7aa;border-color:#fb923c;';
        // Knocked out (non-lethal damage): three snoring Z's rising diagonally from the token's centre, each larger
        let zzz = document.createElement('div');
        zzz.style.cssText = 'position:absolute;left:46%;bottom:46%;width:120%;height:120%;display:none;pointer-events:none;';
        zzz.innerHTML = '<svg viewBox="0 0 100 100" width="100%" height="100%" style="overflow:visible">'
            + [[4, 96, 26], [26, 70, 38], [54, 38, 54]].map(([x, y, f], i) => `<text x="${x}" y="${y}" font-size="${f}" font-weight="900" font-family="Arial Black,Arial,sans-serif" fill="#f8fafc" stroke="#0f172a" stroke-width="${f / 6}" paint-order="stroke" transform="rotate(-14 ${x} ${y})">Z<animate attributeName="opacity" values="1;.55;1" dur="2.4s" begin="${i * 0.4}s" repeatCount="indefinite"/></text>`).join('')
            + '</svg>';
        el.appendChild(inner); el.appendChild(tint); el.appendChild(badge); el.appendChild(num); el.appendChild(cond); el.appendChild(zzz);
        el._inner = inner; el._tint = tint; el._badge = badge; el._num = num; el._cond = cond; el._zzz = zzz;
        _attach(layer, el);
        return el;
    }

    function render(opts) {
        if (!opts || !opts.area || !opts.winId) return;
        let layer = _layer(opts.area, opts.winId);
        opts.grid = grid(opts.grid);
        layer._opts = opts;
        // Re-lay out (grid canvas, tokens) once per frame when the map area changes size
        if (!layer._ro && window.ResizeObserver) {
            let raf = 0;
            layer._ro = new ResizeObserver(() => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; layout(opts.winId); }); });
            layer._ro.observe(opts.area);
        }

        // Fog lives in this layer while the battle map is on, so it can cover props/tokens
        let fog = opts.fogId ? document.getElementById(opts.fogId) : null;
        if (fog && layer._fog !== fog) {
            _restoreFog(layer);
            if (fog.parentNode !== layer) {
                fog._home = fog.parentNode; fog._homeNext = fog.nextSibling; fog._homeZ = fog.style.zIndex;
                layer.appendChild(fog);
            }
            fog.style.transformOrigin = '0 0';
            fog.style.willChange = 'transform';   // its own GPU layer: panning just moves it, no repaint
            fog.style.zIndex = String(Z_FOG);
            layer._fog = fog;
        } else if (!fog && layer._fog) _restoreFog(layer);

        // Grid: one screen-space element with a CSS line pattern, always 1 px and sharp
        let gridEl = layer.querySelector('[data-bt-grid]');
        if (opts.imgSize && opts.imgSize.w) {
            if (gridEl && gridEl.tagName !== 'CANVAS') { gridEl.remove(); gridEl = null; }
            if (!gridEl) {
                gridEl = document.createElement('canvas');
                gridEl.setAttribute('data-bt-grid', '1');
                gridEl.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;opacity:' + opts.grid.opacity + ';z-index:50;';
                layer.insertBefore(gridEl, layer.firstChild);
            }
            gridEl._key = null;
        } else if (gridEl) gridEl.remove();

        // Props
        let existingP = new Map();
        layer.querySelectorAll('[data-btp]').forEach(el => existingP.set(el.getAttribute('data-btp'), el));
        (opts.props || []).forEach((vm, i) => {
            vm._order = i;
            let el = existingP.get(vm.id);
            if (el) existingP.delete(vm.id);
            else { el = _createProp(layer); el.setAttribute('data-btp', vm.id); layer.appendChild(el); }
            if (!el._drag && !el._rs) el._vm = vm;
            _styleProp(el, el._vm, opts);
        });
        existingP.forEach(el => { if (!el._drag && !el._rs) el.remove(); });

        // Tokens
        let existing = new Map();
        layer.querySelectorAll('[data-bt]').forEach(el => existing.set(el.getAttribute('data-bt'), el));
        (opts.tokens || []).forEach(vm => {
            let el = existing.get(vm.id);
            if (el) existing.delete(vm.id);
            else { el = _create(layer); el.setAttribute('data-bt', vm.id); layer.appendChild(el); }
            if (el._drag) { vm.gridX = el._vm.gridX; vm.gridY = el._vm.gridY; }
            el._vm = vm;
            _styleStatic(el, vm, opts);
            _styleAura(layer, el, vm);
        });
        opts._minTokLayer = (opts.tokens || []).reduce((mn, t) => Math.min(mn, t.layer == null ? 1 : Number(t.layer) || 0), 1);
        // Remove tokens that are gone (never yank one out from under an active drag)
        existing.forEach(el => { if (!el._drag) { if (el._aura) el._aura.remove(); el.remove(); } });
        layout(opts.winId);
    }

    // ── Area hooks: marquee select, click-to-deselect, hover tracking ──
    let _hoverWin = null;
    function _hookArea(area, layer) {
        area.addEventListener('mousemove', e => { _hoverWin = layer.id.replace(/_btScreen$/, ''); if (layer._opts) { try { layer._mouse = _imgPoint(layer, e); } catch (_) { } } });
        area.addEventListener('mousedown', e => {
            let o = layer._opts;
            if (!o || e.button !== 0 || layer._measure) return;
            if (e.target.closest && e.target.closest('[data-bt],[data-btp],[data-bt-ui],button,input')) return;
            if (o.marquee && e.shiftKey && (!o.marqueeAllowed || o.marqueeAllowed())) {
                e.preventDefault(); e.stopImmediatePropagation();
                _startMarquee(layer, e);
                return;
            }
            // A click (not a drag) on empty map clears the selection
            if (o.onSelect && o.selection && o.selection.size) {
                let sx = e.clientX, sy = e.clientY;
                let up = ev => {
                    window.removeEventListener('mouseup', up, true);
                    if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 5 && layer._opts) layer._opts.onSelect([], false);
                };
                window.addEventListener('mouseup', up, true);
            }
        }, true);
    }

    function _startMarquee(layer, e) {
        let o = layer._opts, area = o.area;
        let r = area.getBoundingClientRect();
        let box = document.createElement('div');
        box.setAttribute('data-bt-ui', 'marquee');
        box.style.cssText = `position:absolute;border:1px dashed #22d3ee;background:rgba(34,211,238,.12);z-index:${Z_UI};pointer-events:none;`;
        layer.appendChild(box);
        let x0 = e.clientX - r.left, y0 = e.clientY - r.top;
        let draw = ev => {
            let x1 = ev.clientX - r.left, y1 = ev.clientY - r.top;
            box.style.left = Math.min(x0, x1) + 'px'; box.style.top = Math.min(y0, y1) + 'px';
            box.style.width = Math.abs(x1 - x0) + 'px'; box.style.height = Math.abs(y1 - y0) + 'px';
        };
        draw(e);
        let up = ev => {
            window.removeEventListener('mousemove', draw, true);
            window.removeEventListener('mouseup', up, true);
            let br = box.getBoundingClientRect();
            box.remove();
            if (!layer._opts) return;
            let ids = [];
            layer.querySelectorAll('[data-bt],[data-btp]').forEach(el => {
                if (!el._vm || el.style.pointerEvents === 'none') return;
                if (el.hasAttribute('data-btp') && el._vm.locked) return;
                let tr = el.getBoundingClientRect();
                let cx = tr.left + tr.width / 2, cy = tr.top + tr.height / 2;
                if (cx >= br.left && cx <= br.right && cy >= br.top && cy <= br.bottom) ids.push(el._vm.id);
            });
            layer._opts.onSelect(ids, true);
        };
        window.addEventListener('mousemove', draw, true);
        window.addEventListener('mouseup', up, true);
    }

    // ── Measure tool (M) ─────────────────────────────────────────
    // Every other diagonal counts as 2 squares (1, 2, 1, 2 …), so a move of
    // dx, dy squares costs max + floor(min / 2). Points snap DOWN to the square
    // they're in. Starting or ending on a token measures from its nearest edge
    // square, so two adjacent tokens are 1 square apart whatever their size.
    // Modes: Line (right-click drops a corner point, for paths around walls), Cone, and
    // Burst (a radius blast); Cone and Burst shade the squares they cover and name who's in them.
    function squaresBetween(dx, dy) {
        dx = Math.abs(dx); dy = Math.abs(dy);
        return Math.max(dx, dy) + Math.floor(Math.min(dx, dy) / 2);
    }
    // Squares along a path of cells; the 1, 2, 1, 2 diagonal count carries on across corners
    function pathSquares(cells) {
        let sq = 0, diag = 0;
        for (let i = 1; i < (cells || []).length; i++) {
            let dx = Math.abs(cells[i].gx - cells[i - 1].gx), dy = Math.abs(cells[i].gy - cells[i - 1].gy);
            let d = Math.min(dx, dy), st = Math.max(dx, dy) - d;
            sq += st + d + Math.floor((diag + d) / 2) - Math.floor(diag / 2);
            diag += d;
        }
        return sq;
    }
    // AP for moving `squares` more this turn. mp = { speed, moves: Move actions already taken this turn,
    // left: squares still unused from the last one, mobile: AP off each Move (Mobile R1, min 0),
    // staggered: moving costs double AP }. The 1st Move costs 1 AP, the 2nd 2 AP, and so on;
    // each one covers up to Speed squares.
    function moveCost(mp, squares) {
        mp = mp || {};
        let speed = Math.max(0, parseInt(mp.speed, 10) || 0), left = Math.max(0, mp.left || 0), n = Math.max(0, mp.moves || 0), ap = 0, actions = 0;
        let rem = Math.max(0, squares || 0), use = Math.min(left, rem);
        rem -= use; left -= use;
        while (rem > 0) {
            if (speed <= 0) return { ap: Infinity, moves: n, left: 0, actions, stuck: true };
            n++; actions++;
            let c = Math.max(0, n - (mp.mobile || 0)); if (mp.staggered) c *= 2;
            ap += c;
            let take = Math.min(speed, rem); rem -= take; left = speed - take;
        }
        return { ap, moves: n, left, actions };
    }
    // King-step from the path's end to (gx, gy); stepping back onto the path erases the loop
    function _extendPath(path, gx, gy) {
        let last = path[path.length - 1];
        if (last.gx === gx && last.gy === gy) return;
        let cur = { gx: last.gx, gy: last.gy }, guard = 0;
        while ((cur.gx !== gx || cur.gy !== gy) && guard++ < 400) {
            cur = { gx: cur.gx + Math.sign(gx - cur.gx), gy: cur.gy + Math.sign(gy - cur.gy) };
            let i = path.findIndex(p => p.gx === cur.gx && p.gy === cur.gy);
            if (i >= 0) path.length = i + 1; else path.push(cur);
            // A hand-drawn diagonal wobbles into a staircase (→ ↓ → ↓): whenever the square two back is a
            // king's step from this one, the corner between them is dropped, so the path runs diagonally
            // and costs what the move really is (bigger tokens, whose anchor jumps more, wobble the most)
            while (path.length >= 3) {
                let a = path[path.length - 3], c = path[path.length - 1];
                if (Math.max(Math.abs(a.gx - c.gx), Math.abs(a.gy - c.gy)) > 1) break;
                path.splice(path.length - 2, 1);
            }
        }
    }
    function _pathInfo(d) {
        if (!d || !d.path) return null;
        let plain = pathSquares(d.path), squares = d.diff ? pathCost(d.path, d.diff) : plain;
        return { squares, plain, difficult: squares > plain, path: d.path.slice(), free: !!d.alt, mp: d.mp, cost: moveCost(d.mp, squares) };
    }
    // Squares of movement along a path, where each step into difficult terrain counts double (2 squares for 1)
    function pathCost(cells, isDiff) {
        let sq = 0, diag = 0;
        for (let i = 1; i < (cells || []).length; i++) {
            let dx = Math.abs(cells[i].gx - cells[i - 1].gx), dy = Math.abs(cells[i].gy - cells[i - 1].gy);
            let d = Math.min(dx, dy), st = Math.max(dx, dy) - d;
            let inc = st + d + Math.floor((diag + d) / 2) - Math.floor(diag / 2);
            diag += d;
            if (isDiff && isDiff(cells[i])) inc *= 2;
            sq += inc;
        }
        return sq;
    }
    // Is a square difficult terrain for a creature of this size? (the map's difficult squares, plus any square
    // a dead, downed or Prone creature lies in)
    function _diffFor(layer, vm) {
        let o = layer._opts || {}, set = new Set(o.difficult || []);
        (o.tokens || []).forEach(t => {
            if (!t || t.id === vm.id || !(t.down || t._down)) return;
            let p = _tokPos(layer, t.id) || { gx: t.gridX, gy: t.gridY }, sp = span(t.size);
            for (let x = p.gx; x < p.gx + sp; x++) for (let y = p.gy; y < p.gy + sp; y++) set.add(x + ',' + y);
        });
        if (!set.size) return null;
        let sp = span(vm.size);
        return c => { for (let x = c.gx; x < c.gx + sp; x++) for (let y = c.gy; y < c.gy + sp; y++) if (set.has(x + ',' + y)) return true; return false; };
    }
    // Walls: a token's path (anchor squares) that crosses a wall or a closed door. A wall runs between grid corners.
    function _orient(ax, ay, bx, by, cx, cy) { let v = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax); return Math.abs(v) < 1e-9 ? 0 : v > 0 ? 1 : -1; }
    function _segHits(ax, ay, bx, by, w, touch) {
        let d1 = _orient(w.x1, w.y1, w.x2, w.y2, ax, ay), d2 = _orient(w.x1, w.y1, w.x2, w.y2, bx, by);
        let d3 = _orient(ax, ay, bx, by, w.x1, w.y1), d4 = _orient(ax, ay, bx, by, w.x2, w.y2);
        if (d1 && d2 && d3 && d4) return d1 !== d2 && d3 !== d4;
        if (!touch) return false;
        // touching (not running along it): a step through a wall's end corner counts as crossing it
        if (!d1 && !d2) return false;
        let on = (px, py, qx, qy, rx, ry) => Math.min(px, qx) - 1e-9 <= rx && rx <= Math.max(px, qx) + 1e-9 && Math.min(py, qy) - 1e-9 <= ry && ry <= Math.max(py, qy) + 1e-9;
        return (!d1 && on(w.x1, w.y1, w.x2, w.y2, ax, ay)) || (!d2 && on(w.x1, w.y1, w.x2, w.y2, bx, by))
            || (!d3 && on(ax, ay, bx, by, w.x1, w.y1)) || (!d4 && on(ax, ay, bx, by, w.x2, w.y2));
    }
    function wallBlocking(walls, size, cells) {
        let ws = (walls || []).filter(w => w && !(w.door && w.open));
        if (!ws.length || !cells || cells.length < 2) return null;
        let sp = span(size), h = sp / 2, touch = sp % 2 === 1;
        for (let i = 1; i < cells.length; i++) {
            let ax = cells[i - 1].gx + h, ay = cells[i - 1].gy + h, bx = cells[i].gx + h, by = cells[i].gy + h;
            for (let w of ws) if (_segHits(ax, ay, bx, by, w, touch)) return w;
        }
        return null;
    }
    function _drawPath(layer, el) {
        let d = el._drag, o = layer._opts;
        let svg = layer.querySelector('[data-bt-ui="path"]');
        if (!d || !d.path || !o) { if (svg) svg.remove(); return; }
        if (!svg) {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('data-bt-ui', 'path');
            svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
            svg.style.cssText = `position:absolute;inset:0;pointer-events:none;overflow:visible;z-index:${Z_DRAG - 2};`;
            layer.appendChild(svg);
        }
        let g = o.grid, win = o.win, sc = win._scale || 1, ox = win._offX || 0, oy = win._offY || 0;
        let pts = d.path.map(c => { let p = center(g, c.gx, c.gy, el._vm.size); return { x: ox + p.px * sc, y: oy + p.py * sc }; });
        let info = _pathInfo(d), cost = info.cost, have = d.mp.apHave;
        let over = !d.alt && have != null && cost.ap > have;
        let col = d.alt ? '#a5b4fc' : over ? '#f87171' : '#4ade80';
        let sqTxt = info.difficult ? `${info.squares} sq (difficult terrain)` : `${info.squares} sq`;
        let label = info.squares === 0 ? 'Drag to move' : d.alt ? `${sqTxt} · free move (Alt)` : cost.stuck ? `${sqTxt} · Speed 0` : `${sqTxt} · ${cost.ap} AP${have != null ? ` (of ${have})` : ''}`;
        let end = pts[pts.length - 1];
        svg.innerHTML = (pts.length > 1 ? `<polyline points="${pts.map(p => p.x + ',' + p.y).join(' ')}" fill="none" stroke="#000" stroke-opacity=".55" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>
            <polyline points="${pts.map(p => p.x + ',' + p.y).join(' ')}" fill="none" stroke="${col}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>` : '')
            + pts.slice(1).map(p => `<circle cx="${p.x}" cy="${p.y}" r="3" fill="${col}"/>`).join('')
            + `<g transform="translate(${end.x + 16},${end.y - 18})"><rect x="-4" y="-15" rx="4" width="${label.length * 7 + 12}" height="22" fill="rgba(15,23,42,.94)" stroke="${col}"/><text x="2" y="1" fill="#f8fafc" font-size="12.5" font-weight="800" font-family="system-ui,sans-serif">${label}</text></g>`
            + (over ? `<g transform="translate(${end.x + 16},${end.y + 8})"><rect x="-4" y="-15" rx="4" width="150" height="22" fill="rgba(127,29,29,.94)" stroke="#f87171"/><text x="2" y="1" fill="#fecaca" font-size="11.5" font-weight="800" font-family="system-ui,sans-serif">Not enough AP</text></g>` : '');
    }
    function _cellAt(g, x, y) {
        let o = origin(g);
        return { gx: Math.floor((x - o.ox) / g.cellSize), gy: Math.floor((y - o.oy) / g.cellSize) };
    }
    function _footprintAt(layer, cell) {
        let o = layer._opts;
        for (let vm of (o.tokens || [])) {
            let sp = span(vm.size);
            if (cell.gx >= vm.gridX && cell.gx < vm.gridX + sp && cell.gy >= vm.gridY && cell.gy < vm.gridY + sp)
                return { x0: vm.gridX, y0: vm.gridY, x1: vm.gridX + sp - 1, y1: vm.gridY + sp - 1, name: vm.name || vm.title, token: true, id: vm.id };
        }
        return { x0: cell.gx, y0: cell.gy, x1: cell.gx, y1: cell.gy };
    }
    function _nearest(a, b) {
        // nearest cell of footprint a to footprint b, per axis
        let pick = (a0, a1, b0, b1) => b1 < a0 ? a0 : b0 > a1 ? a1 : Math.max(a0, b0);
        return { gx: pick(a.x0, a.x1, b.x0, b.x1), gy: pick(a.y0, a.y1, b.y0, b.y1) };
    }
    const CONE_HALF = Math.atan(0.5);   // a cone is as wide at its end as it is long
    let _measureMode = 'line';
    function _measureLabel(x, y, label, color, text) {
        let w = label.length * 7 + 12;
        return `<g transform="translate(${x},${y})"><rect x="-4" y="-15" rx="4" width="${w}" height="22" fill="rgba(15,23,42,.92)" stroke="${color || '#facc15'}"/>
            <text x="2" y="1" fill="${text || '#fde68a'}" font-size="12.5" font-weight="800" font-family="system-ui,sans-serif">${String(label).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></g>`;
    }
    // A measurement is kept relative to its start, so it can be moved, turned, and ride along on a creature:
    //   { mode, a: {gx,gy} start square, anchor: token id it starts on (or null), rel: {dx,dy} start minus that
    //     token's square, vec: {dx,dy} end minus start, wayRel: [{dx,dy}] a Line's corners,
    //     L: a Cone's / Burst's length and n: a Line's length in squares (both fixed once it's placed) }
    function _tokPos(layer, id) {
        let el = layer.querySelector(`[data-bt="${CSS.escape(id)}"]`);
        if (el && el._vm) return { gx: el._drag ? el._drag.gx : el._vm.gridX, gy: el._drag ? el._drag.gy : el._vm.gridY };
        return null;
    }
    function _mResolve(layer, g) {
        let a = { gx: g.a.gx, gy: g.a.gy };
        if (g.anchor) { let p = _tokPos(layer, g.anchor); if (p) a = { gx: p.gx + (g.rel ? g.rel.dx : 0), gy: p.gy + (g.rel ? g.rel.dy : 0) }; }
        let v = g.vec || { dx: 0, dy: 0 };
        return { mode: g.mode, a, b: { gx: a.gx + v.dx, gy: a.gy + v.dy }, way: (g.wayRel || []).map(w => ({ gx: a.gx + w.dx, gy: a.gy + w.dy })), L: g.L || null, n: g.n || null };
    }
    // Where a footprint is while its token is being dragged
    function _footNow(layer, cell) {
        let f = _footprintAt(layer, cell);
        if (f.token) { let p = _tokPos(layer, f.id); if (p) { let w = f.x1 - f.x0; f = Object.assign({}, f, { x0: p.gx, y0: p.gy, x1: p.gx + w, y1: p.gy + w }); } }
        return f;
    }
    // How far a square is from a Line's start, the way the Line's length is counted: from a creature, the
    // squares between them (adjacent = 1); from a plain square, including that square (next door = 2)
    function _lineDist(fa, c) {
        let near = _nearest(fa, { x0: c.gx, x1: c.gx, y0: c.gy, y1: c.gy });
        return squaresBetween(c.gx - near.gx, c.gy - near.gy) + (fa.token ? 0 : 1);
    }
    // The squares a Line covers, from its start toward b, in king steps: a shallow line runs straight, steps
    // diagonally, then runs straight again (3 forward, 1 diagonal, 2 forward…). A creature's own space isn't
    // counted; a plain starting square is. n: its length in squares (a placed Line keeps its length as it
    // turns, so a diagonal one covers fewer squares, the way every other diagonal counts as 2).
    function lineCells(fa, b, n) {
        let cx = (fa.x0 + fa.x1 + 1) / 2, cy = (fa.y0 + fa.y1 + 1) / 2;
        let dx = b.gx + 0.5 - cx, dy = b.gy + 0.5 - cy, maj = Math.max(Math.abs(dx), Math.abs(dy));
        if (maj < 1e-9) return fa.token ? [] : [{ gx: b.gx, gy: b.gy }];
        let sx = dx / maj, sy = dy / maj, cells = [], seen = new Set();
        for (let i = 0; n ? i < 4 * n + 20 : i <= maj + 1e-9; i++) {
            let gx = Math.floor(cx + sx * i + 1e-9), gy = Math.floor(cy + sy * i + 1e-9);
            if (fa.token && gx >= fa.x0 && gx <= fa.x1 && gy >= fa.y0 && gy <= fa.y1) continue;
            let k = gx + ',' + gy; if (seen.has(k)) continue;
            if (n && _lineDist(fa, { gx, gy }) > n) break;
            seen.add(k); cells.push({ gx, gy });
        }
        return cells;
    }
    // Who's in a set of squares (names), leaving out the creature it starts from
    function _whoIn(layer, cells, skipId) {
        let set = new Set(cells.map(c => c.gx + ',' + c.gy)), hit = [];
        (layer._opts.tokens || []).forEach(vm => {
            if (skipId && vm.id === skipId) return;
            let p = _tokPos(layer, vm.id) || { gx: vm.gridX, gy: vm.gridY }, sp = span(vm.size), inside = false;
            for (let x = p.gx; x < p.gx + sp && !inside; x++) for (let y = p.gy; y < p.gy + sp && !inside; y++) if (set.has(x + ',' + y)) inside = true;
            if (inside) hit.push(vm.name || String(vm.title || '').split(' (')[0] || 'Token');
        });
        return hit;
    }
    // Square to square: counts every square the line covers, INCLUDING the starting
    // square (next-door squares = 2). Token to token (or token to square): counts the
    // squares between them the way movement does (adjacent = 1), and the line snaps to
    // the nearest CORNER of each token's space, so it doubles as a cover check.
    // who: the name of whoever placed someone else's measurement (drawn in blue).
    function _measureHtml(layer, R, who) {
        let o = layer._opts, g = o.grid, win = o.win;
        let s = win._scale || 1, ox = win._offX || 0, oy = win._offY || 0;
        let org = origin(g), cs = g.cellSize;
        let scr = (x, y) => ({ x: ox + (org.ox + x * cs) * s, y: oy + (org.oy + y * cs) * s });   // grid units -> screen
        let rect = (x0, y0, x1, y1, fill, stroke, dash) => { let tl = scr(x0, y0), br = scr(x1 + 1, y1 + 1);
            return `<rect x="${tl.x}" y="${tl.y}" width="${br.x - tl.x}" height="${br.y - tl.y}" fill="${fill}" stroke="${stroke}" stroke-width="1" ${dash ? 'stroke-dasharray="4 3"' : ''}/>`; };
        let tag = t => who ? who + ': ' + t : t;
        let col = who ? '#38bdf8' : '#facc15', rgb = who ? '56,189,248' : '250,204,21', txt = who ? '#e0f2fe' : '#fde68a';
        if (R.mode === 'cone' || R.mode === 'burst') return _areaHtml(layer, R, scr, rect, s, cs, tag, who);
        if (R.way && R.way.length) {
            // A path with corners: squares moved along it
            let pts = [R.a].concat(R.way, [R.b]);
            let n = pathSquares(pts);
            let ps = pts.map(c => scr(c.gx + 0.5, c.gy + 0.5));
            let poly = ps.map(p => `${p.x},${p.y}`).join(' ');
            let end = ps[ps.length - 1];
            return { last: n, html: `${rect(R.a.gx, R.a.gy, R.a.gx, R.a.gy, `rgba(${rgb},.18)`, `rgba(${rgb},.7)`)}${rect(R.b.gx, R.b.gy, R.b.gx, R.b.gy, `rgba(${rgb},.18)`, `rgba(${rgb},.7)`)}
                <polyline points="${poly}" fill="none" stroke="#000" stroke-opacity=".6" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>
                <polyline points="${poly}" fill="none" stroke="${col}" stroke-width="2.5" stroke-dasharray="7 5" stroke-linejoin="round" stroke-linecap="round"/>
                ${ps.map((p, i) => `<circle cx="${p.x}" cy="${p.y}" r="${i && i < ps.length - 1 ? 5 : 4}" fill="${i && i < ps.length - 1 ? '#fb923c' : col}" stroke="#000" stroke-width="1"/>`).join('')}
                ${_measureLabel(end.x + 14, end.y - 14, tag(`${n} square${n === 1 ? '' : 's'} (path)`), col, txt)}` };
        }
        let fa = _footNow(layer, R.a);
        let cover = lineCells(fa, R.b, R.n);
        let endCell = R.n && cover.length ? cover[cover.length - 1] : R.b;
        let fb = _footNow(layer, endCell);
        let ca = _nearest(fa, fb), cb = _nearest(fb, fa);
        let anyToken = fa.token || fb.token;
        let n = R.n || (squaresBetween(cb.gx - ca.gx, cb.gy - ca.gy) + (anyToken ? 0 : 1));
        let centerPts = f => [{ x: f.x0 + 0.5, y: f.y0 + 0.5 }];
        let cornerPts = f => [{ x: f.x0, y: f.y0 }, { x: f.x1 + 1, y: f.y0 }, { x: f.x0, y: f.y1 + 1 }, { x: f.x1 + 1, y: f.y1 + 1 }];
        let pa = fa.token ? cornerPts(fa) : centerPts(fa), pb = fb.token ? cornerPts(fb) : centerPts(fb);
        let best = null;
        pa.forEach(A => pb.forEach(B => { let d = (A.x - B.x) ** 2 + (A.y - B.y) ** 2; if (!best || d < best.d) best = { d, A, B }; }));
        let p1 = scr(best.A.x, best.A.y), p2 = scr(best.B.x, best.B.y);
        let hl = f => rect(f.x0, f.y0, f.x1, f.y1, `rgba(${rgb},${f.token ? '.08' : '.18'})`, `rgba(${rgb},.7)`, f.token);
        let label = `${n} square${n === 1 ? '' : 's'}`;
        let shade = cover.map(c => rect(c.gx, c.gy, c.gx, c.gy, `rgba(${rgb},.13)`, 'rgba(0,0,0,.18)')).join('');
        let hit = _whoIn(layer, cover, fa.token ? fa.id : null);
        let html = `${shade}${hl(fa)}${fb.token || !R.n ? hl(fb) : ''}
            <line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="#000" stroke-opacity=".6" stroke-width="5" stroke-linecap="round"/>
            <line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${col}" stroke-width="2.5" stroke-dasharray="7 5" stroke-linecap="round"/>
            <circle cx="${p1.x}" cy="${p1.y}" r="4" fill="${col}"/><circle cx="${p2.x}" cy="${p2.y}" r="4" fill="${col}"/>
            ${_measureLabel(p2.x + 14, p2.y - 14, tag(label), col, txt)}
            ${_measureLabel(p2.x + 14, p2.y + 12, `Line covers ${cover.length}${hit.length ? ' · ' + hit.slice(0, 4).join(', ') + (hit.length > 4 ? ` +${hit.length - 4}` : '') : ''}`, col, txt)}`;
        return { last: n, html };
    }
    // Cone / Burst: the squares an area covers from its origin (a square, or a creature's edge).
    // Lfix: a placed area's length (it keeps it as it turns).
    function areaCells(fa, target, mode, samples, Lfix) {   // samples: per-side sampling (12 by default; fewer for big previews)
        let near = _nearest(fa, { x0: target.gx, x1: target.gx, y0: target.gy, y1: target.gy });
        let L = Lfix || Math.max(1, squaresBetween(target.gx - near.gx, target.gy - near.gy));
        let cx = (fa.x0 + fa.x1 + 1) / 2, cy = (fa.y0 + fa.y1 + 1) / 2;
        let dx = target.gx + 0.5 - cx, dy = target.gy + 0.5 - cy, dl = Math.hypot(dx, dy) || 1;
        if (!dx && !dy) dx = dl = 1;   // pointing nowhere yet: point right
        // A Cone's point sits on the edge of the creature's (or square's) space, where the direction leaves it,
        // so the creature itself is never in its own cone, however big it is
        let ux = dx / dl, uy = dy / dl, half = (fa.x1 - fa.x0 + 1) / 2;
        let edge = half / Math.max(Math.abs(ux), Math.abs(uy), 1e-9);
        let ax = cx + ux * edge, ay = cy + uy * edge;
        let cells = [];
        for (let gx = fa.x0 - L - 1; gx <= fa.x1 + L + 1; gx++) for (let gy = fa.y0 - L - 1; gy <= fa.y1 + L + 1; gy++) {
            let inside = gx >= fa.x0 && gx <= fa.x1 && gy >= fa.y0 && gy <= fa.y1;
            if (inside) { if (mode === 'burst') cells.push({ gx, gy }); continue; }
            if (mode === 'cone') {
                // A square is in the cone when at least a quarter of it lies inside the cone as drawn
                // (the point on the edge of the space, the arc L squares out from it)
                let cosH = Math.cos(CONE_HALF), inN = 0, N = samples || 12;
                for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
                    let vx = gx + (i + 0.5) / N - ax, vy = gy + (j + 0.5) / N - ay, vl = Math.hypot(vx, vy);
                    if (vl <= L && vl > 0 && (vx * ux + vy * uy) / vl >= cosH - 1e-9) inN++;
                }
                if (inN * 4 < N * N) continue;
                cells.push({ gx, gy });
                continue;
            }
            // Burst: a square is in it when at least half of it lies inside the circle as drawn
            // (centered on the creature, reaching L squares past its edge)
            let R = L + (fa.x1 - fa.x0 + 1) / 2, N = samples || 12, inN = 0;
            for (let i = 0; i < N; i++) for (let j = 0; j < N; j++)
                if (Math.hypot(gx + (i + 0.5) / N - cx, gy + (j + 0.5) / N - cy) <= R) inN++;
            if (inN * 2 < N * N) continue;
            cells.push({ gx, gy });
        }
        return { cells, L, cx, cy, ax, ay, ang: Math.atan2(dy, dx) };
    }
    function _areaHtml(layer, R, scr, rect, s, cs, tag, who) {
        let fa = _footNow(layer, R.a);
        let A = areaCells(fa, R.b, R.mode, null, R.L);
        let hit = _whoIn(layer, A.cells, R.mode === 'cone' && fa.token ? fa.id : null);
        let fill = R.mode === 'cone' ? 'rgba(251,146,60,.26)' : 'rgba(248,113,113,.24)';
        let line = who ? '#38bdf8' : R.mode === 'cone' ? 'rgba(251,146,60,.85)' : 'rgba(248,113,113,.85)';
        let html = A.cells.map(c => rect(c.gx, c.gy, c.gx, c.gy, fill, 'rgba(0,0,0,.25)')).join('');
        html += rect(fa.x0, fa.y0, fa.x1, fa.y1, 'rgba(250,204,21,.12)', 'rgba(250,204,21,.8)', fa.token);
        let c0 = R.mode === 'cone' ? scr(A.ax, A.ay) : scr(A.cx, A.cy), Rr = (A.L + (R.mode === 'cone' ? 0 : (fa.x1 - fa.x0 + 1) / 2)) * cs * s;
        if (R.mode === 'burst') html += `<circle cx="${c0.x}" cy="${c0.y}" r="${Rr}" fill="none" stroke="${line}" stroke-width="2" stroke-dasharray="6 4"/>`;
        else {
            let e1 = { x: c0.x + Rr * Math.cos(A.ang - CONE_HALF), y: c0.y + Rr * Math.sin(A.ang - CONE_HALF) }, e2 = { x: c0.x + Rr * Math.cos(A.ang + CONE_HALF), y: c0.y + Rr * Math.sin(A.ang + CONE_HALF) };
            html += `<path d="M${c0.x},${c0.y} L${e1.x},${e1.y} A${Rr},${Rr} 0 0 1 ${e2.x},${e2.y} Z" fill="none" stroke="${line}" stroke-width="2" stroke-dasharray="6 4"/>`;
        }
        // The label sits at the far edge (a placed area's end square can sit inside it once it has turned)
        let far = R.mode === 'burst' ? scr(R.b.gx + 0.5, R.b.gy + 0.5) : { x: c0.x + Rr * Math.cos(A.ang), y: c0.y + Rr * Math.sin(A.ang) };
        html += `<circle cx="${c0.x}" cy="${c0.y}" r="4" fill="#facc15"/><circle cx="${far.x}" cy="${far.y}" r="3" fill="${line}"/>`;
        let label = tag(`${R.mode === 'cone' ? 'Cone' : 'Radius'} ${A.L} sq · ${A.cells.length} squares`);
        html += _measureLabel(far.x + 14, far.y - 14, label, line, who ? '#e0f2fe' : undefined);
        if (hit.length) html += _measureLabel(far.x + 14, far.y + 12, 'In it: ' + hit.slice(0, 5).join(', ') + (hit.length > 5 ? ` +${hit.length - 5}` : ''), line, who ? '#e0f2fe' : undefined);
        return { last: A.L, html };
    }
    function _layoutMeasure(layer) {
        let m = layer._measure; if (!m) return;
        if (m.bar) {
            m.bar.querySelectorAll('[data-mmode]').forEach(b => { let on = b.dataset.mmode === m.mode; b.style.background = on ? '#a16207' : 'rgba(15,23,42,.92)'; b.style.color = on ? '#fff' : '#fde68a'; });
            let sb = m.bar.querySelector('[data-mshow]');
            if (sb) { sb.textContent = layer._mShow ? 'Players see it (V)' : 'Only you see it (V)'; sb.style.background = layer._mShow ? '#0369a1' : 'rgba(15,23,42,.92)'; sb.style.color = layer._mShow ? '#fff' : '#bae6fd'; }
        }
        if (!m.g || !layer._opts) { m.svg.innerHTML = ''; return; }
        let R = _mResolve(layer, m.g);
        let out = _measureHtml(layer, R);
        // A placed measurement's start can be grabbed: a ring marks it
        let grab = '';
        if (m.placed) {
            let f = _footNow(layer, R.a), o = layer._opts, g = o.grid, win = o.win, s = win._scale || 1, org = origin(g), cs = g.cellSize;
            let cx = (win._offX || 0) + (org.ox + (f.x0 + f.x1 + 1) / 2 * cs) * s, cy = (win._offY || 0) + (org.oy + (f.y0 + f.y1 + 1) / 2 * cs) * s;
            grab = `<circle cx="${cx}" cy="${cy}" r="${Math.max(9, (f.x1 - f.x0 + 1) * cs * s * 0.5 + 3)}" fill="none" stroke="#fde68a" stroke-width="1.5" stroke-dasharray="3 3" opacity=".9"/>`;
        }
        m.svg.innerHTML = out.html + grab;
        m.last = out.last;
    }
    // Other people's measurements (players', and the GM's when shown), drawn in blue for everyone
    function _layoutShared(layer) {
        let o = layer._opts;
        let svg = layer.querySelector('[data-bt-ui="shared-measure"]');
        let list = (o && o.sharedMeasures) || [];
        if (!list.length) { if (svg) svg.remove(); return; }
        if (!svg) {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('data-bt-ui', 'shared-measure');
            svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
            svg.style.cssText = `position:absolute;inset:0;pointer-events:none;overflow:visible;z-index:${Z_UI - 1};`;
            layer.appendChild(svg);
        }
        svg.innerHTML = list.map(sm => { try { return sm && sm.g && sm.g.a ? _measureHtml(layer, _mResolve(layer, sm.g), sm.who || 'Someone').html : ''; } catch (e) { return ''; } }).join('');
    }
    // Tell the page about this window's measurement (players share theirs; the GM's is shared when shown)
    function _mShare(layer) {
        let o = layer._opts, m = layer._measure;
        if (!o || !o.onMeasureShare) return;
        let show = o.measureShare !== 'toggle' || !!layer._mShow;
        let g = null;
        if (show && m && m.g && m.placed) {
            let R = _mResolve(layer, m.g);
            g = { mode: m.g.mode, a: R.a, anchor: m.g.anchor || null, rel: m.g.rel || null, vec: m.g.vec, wayRel: m.g.wayRel || [], L: m.g.L || null, n: m.g.n || null };
        }
        if (!g && !layer._mShared) return;
        layer._mShared = !!g;
        try { o.onMeasureShare(g); } catch (e) { console.warn('Measure share:', e); }
    }
    function enterMeasure(winId, mode) {
        let layer = document.getElementById(winId + '_btScreen');
        if (!layer || !layer._opts || layer._measure || layer._area) return false;
        if (layer._tool) exitTool(winId);
        let ov = document.createElement('div');
        ov.setAttribute('data-bt-ui', 'measure');
        ov.style.cssText = `position:absolute;inset:0;z-index:${Z_UI};pointer-events:auto;cursor:crosshair;`;
        let svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
        svg.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:visible;';
        let bar = document.createElement('div');
        bar.style.cssText = 'position:absolute;left:8px;right:8px;top:8px;display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:4px;pointer-events:none;cursor:default;';   // wraps in small windows instead of running off the edges
        let tipTxt = { line: 'Drag between squares or tokens · right-click adds a corner', cone: 'Drag from where the cone starts, toward where it points', burst: 'Drag from the center out to the radius' };
        let toggle = layer._opts.measureShare === 'toggle';
        bar.innerHTML = ['line', 'cone', 'burst'].map(md => `<button data-mmode="${md}" style="pointer-events:auto;border:1px solid #facc15;border-radius:5px;font-size:11px;font-weight:800;padding:2px 8px;cursor:pointer;background:rgba(15,23,42,.92);color:#fde68a">${md === 'line' ? 'Line' : md === 'cone' ? 'Cone' : 'Burst'}</button>`).join('')
            + (toggle ? `<button data-mshow title="Show this measurement to your players (V)" style="pointer-events:auto;border:1px solid #38bdf8;border-radius:5px;font-size:11px;font-weight:800;padding:2px 8px;cursor:pointer;background:rgba(15,23,42,.92);color:#bae6fd"></button>` : '')
            + `<span data-mtip style="background:rgba(15,23,42,.92);border:1px solid #facc15;color:#fde68a;font-size:11px;font-weight:700;padding:3px 8px;border-radius:5px;white-space:normal;max-width:100%;text-align:center;pointer-events:none"></span>`;
        ov.appendChild(svg); ov.appendChild(bar);
        layer.appendChild(ov);
        // Keep the bar clear of the map window's own controls (zoom, Reset, Measure…): drop it below any it would sit under
        let placeBar = () => {
            if (!bar.isConnected) return;
            bar.style.top = '8px';
            let lr = layer.getBoundingClientRect();
            let win = document.getElementById(winId) || layer.parentElement;   // the map window (its own zoom / Reset / Measure controls)
            let ctrls = [...(win || document).querySelectorAll('button, input, select, [data-bt-ctrl]')].filter(el => !ov.contains(el) && el.offsetParent !== null);
            for (let pass = 0; pass < 3; pass++) {
                let br = bar.getBoundingClientRect(), push = 0;
                ctrls.forEach(el => { let r = el.getBoundingClientRect(); if (r.width && r.bottom > br.top && r.top < br.bottom && r.right > br.left && r.left < br.right && r.top >= lr.top - 2 && r.top < lr.top + lr.height / 2) push = Math.max(push, r.bottom - lr.top + 6); });
                if (!push) break;
                bar.style.top = push + 'px';
            }
        };
        requestAnimationFrame(placeBar);
        if (window.ResizeObserver) { let ro = new ResizeObserver(() => placeBar()); ro.observe(layer); ov._ro = ro; }
        let m = layer._measure = { ov, svg, bar, g: null, placed: false, down: false, follow: false, held: null, mode: mode || _measureMode };
        let setTip = () => { let t = bar.querySelector('[data-mtip]'); if (t) t.textContent = tipTxt[m.mode] + (m.placed ? ' · drag its start to move it, scroll while dragging it to turn it' : '') + ' · M or Esc to exit'; };
        setTip();
        let shareT = 0;
        let share = now => { clearTimeout(shareT); if (now) _mShare(layer); else shareT = setTimeout(() => _mShare(layer), 250); };
        m.share = share;
        bar.addEventListener('mousedown', e => e.stopPropagation());
        bar.addEventListener('pointerdown', e => e.stopPropagation());
        bar.querySelectorAll('[data-mmode]').forEach(b => b.addEventListener('click', e => {
            e.stopPropagation(); m.mode = _measureMode = b.dataset.mmode; m.follow = false;
            // A placed measurement changes shape where it is
            if (m.g) { m.g.mode = m.mode; m.g.wayRel = []; m.g.L = m.g.n = null; if (m.placed) freeze(); share(); }
            setTip(); _layoutMeasure(layer);
        }));
        let sb = bar.querySelector('[data-mshow]');
        if (sb) sb.addEventListener('click', e => { e.stopPropagation(); _toggleShow(layer); });
        let cellOf = e => { let p = _imgPoint(layer, e); return _cellAt(layer._opts.grid, p.x, p.y); };
        let R = () => m.g ? _mResolve(layer, m.g) : null;
        let onOrigin = c => { if (!m.placed || !m.g) return false; let f = _footNow(layer, R().a); return c.gx >= f.x0 && c.gx <= f.x1 && c.gy >= f.y0 && c.gy <= f.y1; };
        // Fix a Line's squares and a Cone's / Burst's length, so it keeps them as it moves and turns
        let freeze = () => {
            let r = R(); if (!r) return;
            let fa = _footNow(layer, r.a);
            m.g.L = m.g.n = null;
            if (r.mode === 'line' && !(m.g.wayRel || []).length) { let cv = lineCells(fa, r.b); if (cv.length) m.g.n = _lineDist(fa, cv[cv.length - 1]); }
            if (r.mode === 'cone' || r.mode === 'burst') m.g.L = areaCells(fa, r.b, r.mode).L;
            m.placed = true; setTip();
        };
        // Turn a Line or Cone around its start, one square at a time along its far edge
        let rotate = dir => {
            let r = R(); if (!r || !(r.mode === 'cone' || (r.mode === 'line' && !r.way.length))) return;
            let fa = _footNow(layer, r.a);
            let cx = (fa.x0 + fa.x1 + 1) / 2, cy = (fa.y0 + fa.y1 + 1) / 2;
            let tx = r.b.gx + 0.5 - cx, ty = r.b.gy + 0.5 - cy, rad = Math.hypot(tx, ty);
            if (rad < 0.5) return;
            let th = Math.atan2(ty, tx), step = dir * 0.3 / rad;
            for (let k = 0; k < 4000; k++) {
                th += step;
                let gx = Math.floor(cx + rad * Math.cos(th)), gy = Math.floor(cy + rad * Math.sin(th));
                if (gx === r.b.gx && gy === r.b.gy) continue;
                if (gx >= fa.x0 && gx <= fa.x1 && gy >= fa.y0 && gy <= fa.y1) continue;
                m.g.vec = { dx: gx - r.a.gx, dy: gy - r.a.gy };
                break;
            }
            _layoutMeasure(layer); share();
        };
        // Middle-click (or Ctrl+left) passes through to the map so it can pan while measuring
        let isPan = e => e.button === 1 || (e.button === 0 && (e.ctrlKey || e.metaKey));
        // Grabbing a placed measurement's start moves it. Started on a creature you can move, the creature
        // moves (with its path and AP in combat) and the measurement rides along. Shift+drag measures anew.
        ov.addEventListener('pointerdown', e => {
            if (e.button !== 0 || isPan(e) || e.shiftKey || m.follow) return;
            let c = cellOf(e);
            if (!onOrigin(c)) return;
            e.stopPropagation(); e.preventDefault();
            let r = R(), f = _footNow(layer, r.a), o = layer._opts;
            let el = f.token ? layer.querySelector(`[data-bt="${CSS.escape(f.id)}"]`) : null;
            let done = () => { window.removeEventListener('pointerup', done, true); window.removeEventListener('pointercancel', done, true); window.removeEventListener('pointermove', mv, true); end(); };
            let mv = () => {}, end = () => {};
            if (el && el._vm && el._vm.draggable && o.onMove && el._startDrag) {
                if (m.g.anchor !== f.id) { m.g.anchor = f.id; m.g.rel = { dx: r.a.gx - el._vm.gridX, dy: r.a.gy - el._vm.gridY }; }
                m.held = 'token';
                el._startDrag(e);
                end = () => { m.held = null; setTimeout(() => { _layoutMeasure(layer); share(); }, 60); };
            } else {
                m.held = 'move';
                let from = c, a0 = r.a;
                m.g.anchor = null; m.g.rel = null; m.g.a = a0;
                mv = ev => {
                    let cc = cellOf(ev), na = { gx: a0.gx + cc.gx - from.gx, gy: a0.gy + cc.gy - from.gy };
                    if (na.gx === m.g.a.gx && na.gy === m.g.a.gy) return;
                    m.g.a = na; _layoutMeasure(layer);
                };
                end = () => {
                    m.held = null;
                    // Dropped on a creature: it starts from (and moves with) that creature now
                    let ff = _footprintAt(layer, m.g.a);
                    if (ff.token) { m.g.anchor = ff.id; m.g.rel = { dx: m.g.a.gx - ff.x0, dy: m.g.a.gy - ff.y0 }; }
                    _layoutMeasure(layer); share();
                };
            }
            window.addEventListener('pointermove', mv, true);
            window.addEventListener('pointerup', done, true);
            window.addEventListener('pointercancel', done, true);
        });
        ov.addEventListener('mousedown', e => {
            if (isPan(e)) return; e.stopPropagation(); e.preventDefault(); if (e.button !== 0 || m.held) return;
            let c = cellOf(e);
            if (m.follow) { m.follow = false; let r = R(); m.g.vec = { dx: c.gx - r.a.gx, dy: c.gy - r.a.gy }; freeze(); share(); _layoutMeasure(layer); return; }   // a click ends a path being extended
            let f = _footprintAt(layer, c);
            m.down = true; m.placed = false; setTip();
            m.g = { mode: m.mode, a: c, anchor: f.token ? f.id : null, rel: f.token ? { dx: c.gx - f.x0, dy: c.gy - f.y0 } : null, vec: { dx: 0, dy: 0 }, wayRel: [], L: null, n: null };
            _layoutMeasure(layer);
        });
        ov.addEventListener('mousemove', e => {
            if (m.held) return;
            let c = cellOf(e);
            if (!m.down && !m.follow) { ov.style.cursor = onOrigin(c) ? 'move' : 'crosshair'; return; }
            let r = R(), nv = { dx: c.gx - r.a.gx, dy: c.gy - r.a.gy };
            if (m.g.vec && nv.dx === m.g.vec.dx && nv.dy === m.g.vec.dy) return;
            m.g.vec = nv; _layoutMeasure(layer);
        });
        ov.addEventListener('mouseup', e => { if (!m.down) return; e.stopPropagation(); m.down = false; freeze(); share(); _layoutMeasure(layer); });
        // Scroll while dragging a placed Line's or Cone's start: turns it. While it's still being drawn,
        // scrolling doesn't turn it (a plain scroll still zooms the map).
        ov.addEventListener('wheel', e => {
            if (!m.held || !m.placed || !m.g) return;
            e.preventDefault(); e.stopPropagation();
            rotate(e.deltaY > 0 ? 1 : -1);
        }, { passive: false });
        // Right-click: a corner point on a Line (keeps going from there; click to finish). With nothing measured, it exits.
        ov.addEventListener('contextmenu', e => {
            e.preventDefault(); e.stopPropagation();
            if (m.mode === 'line' && m.g) {
                let c = cellOf(e), r = R(), last = r.way.length ? r.way[r.way.length - 1] : r.a;
                if (c.gx !== last.gx || c.gy !== last.gy) m.g.wayRel.push({ dx: c.gx - r.a.gx, dy: c.gy - r.a.gy });
                m.g.vec = { dx: c.gx - r.a.gx, dy: c.gy - r.a.gy }; m.g.n = null;
                if (!m.down) m.follow = true;
                _layoutMeasure(layer);
                return;
            }
            if (!m.g) exitMeasure(winId);
        });
        (layer._opts.onMeasureChange || (() => {}))(true);
        _layoutMeasure(layer);
        return true;
    }
    function _toggleShow(layer) {
        if (!layer || !layer._opts || layer._opts.measureShare !== 'toggle') return false;
        layer._mShow = !layer._mShow;
        _layoutMeasure(layer); _mShare(layer);
        toast(layer._opts.area, layer._mShow ? 'Your measurements on this map are shown to your players (V hides them).' : 'Your measurements on this map are only shown to you (V shows them to players).', 'info');
        return true;
    }
    function exitMeasure(winId) {
        let layer = document.getElementById(winId + '_btScreen');
        if (!layer || !layer._measure) return false;
        try { layer._measure.ov._ro && layer._measure.ov._ro.disconnect(); } catch (e) { }
        layer._measure.g = null; _mShare(layer);
        layer._measure.ov.remove();
        layer._measure = null;
        if (layer._opts?.onMeasureChange) layer._opts.onMeasureChange(false);
        return true;
    }

    // ── Power areas ──────────────────────────────────────────────
    // A power with an area (a Line, Cone or Burst crafted to an exact size) is placed on the map when it's
    // used. Its shape and size are fixed by the power; only where it starts and which way it points change.
    //   opts: { mode: 'line'|'cone'|'burst', size, casterId: the user's token (or null), range: squares from
    //           the user (0 = Self/Touch, Infinity = anywhere), label, safeZone: may pick creatures to leave out }
    // Resolves { tokenIds, safeIds, names }, 'skip' (use the power without the map) or null (cancelled).
    function _areaFoot(layer, P) {
        if (P.anchor && P.casterId) {
            let el = layer.querySelector(`[data-bt="${CSS.escape(P.casterId)}"]`);
            if (el && el._vm) { let p = _tokPos(layer, P.casterId), w = span(el._vm.size) - 1; return { x0: p.gx, y0: p.gy, x1: p.gx + w, y1: p.gy + w, token: true, id: P.casterId }; }
        }
        return P.a ? { x0: P.a.gx, y0: P.a.gy, x1: P.a.gx, y1: P.a.gy } : null;
    }
    function _casterFoot(layer, P) {
        if (!P.casterId) return null;
        let el = layer.querySelector(`[data-bt="${CSS.escape(P.casterId)}"]`);
        if (!el || !el._vm) return null;
        let p = _tokPos(layer, P.casterId), w = span(el._vm.size) - 1;
        return { x0: p.gx, y0: p.gy, x1: p.gx + w, y1: p.gy + w, token: true, id: P.casterId };
    }
    // How far the area's start is from its user (0 when it starts from them)
    function _areaReach(layer, P) {
        let cf = _casterFoot(layer, P), fa = _areaFoot(layer, P);
        if (!cf || !fa || fa.token) return 0;
        let n = _nearest(cf, fa);
        return squaresBetween(fa.x0 - n.gx, fa.y0 - n.gy);
    }
    function _areaOk(layer, P) { return P.range === Infinity || !_casterFoot(layer, P) || _areaReach(layer, P) <= Math.max(1, P.range); }
    function _areaCalc(layer, P) {
        let fa = _areaFoot(layer, P); if (!fa) return null;
        let cx = (fa.x0 + fa.x1 + 1) / 2, cy = (fa.y0 + fa.y1 + 1) / 2, D = Math.max(20, P.size * 3);
        let b = { gx: Math.floor(cx + Math.cos(P.ang) * D), gy: Math.floor(cy + Math.sin(P.ang) * D) };
        let cells = P.mode === 'line' ? lineCells(fa, b, P.size) : areaCells(fa, b, P.mode, P.size > 120 ? 3 : P.size > 40 ? 5 : 12, P.size).cells;
        let set = new Set(cells.map(c => c.gx + ',' + c.gy)), hits = [];
        (layer._opts.tokens || []).forEach(vm => {
            let p = _tokPos(layer, vm.id) || { gx: vm.gridX, gy: vm.gridY }, sp = span(vm.size), inside = false;
            for (let x = p.gx; x < p.gx + sp && !inside; x++) for (let y = p.gy; y < p.gy + sp && !inside; y++) if (set.has(x + ',' + y)) inside = true;
            if (inside) hits.push({ vm, x0: p.gx, y0: p.gy, x1: p.gx + sp - 1, y1: p.gy + sp - 1 });
        });
        return { fa, b, cells, hits };
    }
    function _layoutArea(layer) {
        let P = layer._area; if (!P || !layer._opts) return;
        let o = layer._opts, g = o.grid, win = o.win, s = win._scale || 1, ox = win._offX || 0, oy = win._offY || 0, org = origin(g), cs = g.cellSize;
        let scr = (x, y) => ({ x: ox + (org.ox + x * cs) * s, y: oy + (org.oy + y * cs) * s });
        let rect = (x0, y0, x1, y1, fill, stroke, w, dash) => { let tl = scr(x0, y0), br = scr(x1 + 1, y1 + 1);
            return `<rect x="${tl.x}" y="${tl.y}" width="${br.x - tl.x}" height="${br.y - tl.y}" fill="${fill}" stroke="${stroke}" stroke-width="${w || 1}" ${dash ? 'stroke-dasharray="5 3"' : ''}/>`; };
        let A = _areaCalc(layer, P);
        let tip = P.bar.querySelector('[data-atip]'), go = P.bar.querySelector('[data-ago]');
        if (!A) { P.svg.innerHTML = ''; return; }
        let ok = _areaOk(layer, P), reach = _areaReach(layer, P);
        let fill = ok ? 'rgba(192,132,252,.30)' : 'rgba(248,113,113,.28)', edge = ok ? '#c084fc' : '#f87171';
        let html = A.cells.map(c => rect(c.gx, c.gy, c.gx, c.gy, fill, 'rgba(0,0,0,.25)')).join('');
        html += rect(A.fa.x0, A.fa.y0, A.fa.x1, A.fa.y1, 'rgba(250,204,21,.14)', '#facc15', 1.5, A.fa.token);
        let hitN = 0;
        A.hits.forEach(h => {
            let safe = P.safe.has(h.vm.id);
            if (!safe) hitN++;
            html += rect(h.x0, h.y0, h.x1, h.y1, 'none', safe ? '#4ade80' : '#f43f5e', 3, safe);
        });
        // A grab ring on its start, once it's placed
        let c0 = scr((A.fa.x0 + A.fa.x1 + 1) / 2, (A.fa.y0 + A.fa.y1 + 1) / 2);
        if (P.placed) html += `<circle cx="${c0.x}" cy="${c0.y}" r="${Math.max(9, (A.fa.x1 - A.fa.x0 + 1) * cs * s * 0.5 + 3)}" fill="none" stroke="#fde68a" stroke-width="1.5" stroke-dasharray="3 3"/>`;
        let shape = P.mode === 'burst' ? `${P.size}-sq Burst` : `${P.size}-sq ${P.mode === 'line' ? 'Line' : 'Cone'}`;
        html += _measureLabel(c0.x + 16, c0.y - 18, `${P.label}: ${shape} · ${hitN} creature${hitN === 1 ? '' : 's'}${P.safe.size ? ` (${P.safe.size} safe)` : ''}`, edge, '#f5f3ff');
        if (!ok) html += _measureLabel(c0.x + 16, c0.y + 8, P.range === 0 ? 'Too far: it starts from you (or the square next to you)' : `Out of range: ${reach} of ${P.range} squares`, '#f87171', '#fecaca');
        P.svg.innerHTML = html;
        if (go) { go.style.opacity = P.placed && ok ? '1' : '.5'; }
        if (tip) {
            let t = !P.placed ? `Move to aim, click to place it${P.range && P.range !== Infinity ? ` (range ${P.range} squares)` : ''}`
                : `Drag its start to move it${P.mode === 'burst' ? ' · click a square to move it there' : ' · scroll to turn it (Alt+scroll: finer) · click a square to point it there'}`;
            if (P.safeZone) t += ' · Shift+click a creature to keep it safe (Safe Zone)';
            tip.textContent = t + ' · Enter to use it, Esc or right-click to cancel';
        }
    }
    // The direction each power's Line or Cone was last used in (remembered on this device)
    const _areaAngs = (() => { try { return JSON.parse(localStorage.getItem('apxAreaAngles') || '{}') || {}; } catch (e) { return {}; } })();
    function _areaAng(key, ang) {
        if (ang === undefined) return typeof _areaAngs[key] === 'number' ? _areaAngs[key] : 0;
        _areaAngs[key] = Math.atan2(Math.sin(ang), Math.cos(ang));
        try { localStorage.setItem('apxAreaAngles', JSON.stringify(_areaAngs)); } catch (e) { }
    }
    function placeArea(winId, opts) {
        let layer = document.getElementById(winId + '_btScreen');
        if (!layer || !layer._opts || !opts || !['line', 'cone', 'burst'].includes(opts.mode)) return Promise.resolve('skip');
        if (layer._measure) exitMeasure(winId);
        if (layer._area) layer._area.finish(null);
        return new Promise(resolve => {
            let ov = document.createElement('div');
            ov.setAttribute('data-bt-ui', 'area');
            ov.style.cssText = `position:absolute;inset:0;z-index:${Z_UI};pointer-events:auto;cursor:crosshair;`;
            let svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
            svg.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:visible;';
            let bar = document.createElement('div');
            bar.style.cssText = 'position:absolute;left:8px;right:8px;bottom:8px;display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:4px;pointer-events:none;cursor:default;';
            let btn = (attr, txt, bg, bd) => `<button ${attr} style="pointer-events:auto;border:1px solid ${bd};border-radius:5px;font-size:11px;font-weight:800;padding:3px 10px;cursor:pointer;background:${bg};color:#fff">${txt}</button>`;
            bar.innerHTML = btn('data-ago', 'Use power', '#7e22ce', '#c084fc') + btn('data-askip', 'Use without the map', 'rgba(15,23,42,.92)', '#64748b') + btn('data-acancel', 'Cancel', 'rgba(15,23,42,.92)', '#64748b')
                + `<span data-atip style="background:rgba(15,23,42,.92);border:1px solid #c084fc;color:#f5f3ff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:5px;white-space:normal;max-width:100%;text-align:center;pointer-events:none"></span>`;
            ov.appendChild(svg); ov.appendChild(bar);
            layer.appendChild(ov);
            let size = Math.max(1, parseInt(opts.size) || 1);
            let range = opts.range === Infinity || opts.range == null ? Infinity : Math.max(0, parseInt(opts.range) || 0);
            // A Line or Cone points the way it last did for this power (no turning it back around every time)
            let angKey = (opts.key || opts.label || 'Power') + '|' + opts.mode;
            let P = layer._area = { ov, svg, bar, mode: opts.mode, size, range, casterId: opts.casterId || null, label: opts.label || 'Power', safeZone: !!opts.safeZone,
                safe: new Set(), anchor: false, a: null, ang: _areaAng(angKey), placed: false, drag: false };
            // Self / Touch: it starts from its user, pointing away from the map's middle-ish (right)
            let cf = _casterFoot(layer, P);
            if (cf && range === 0) { P.anchor = true; P.placed = true; }
            else if (cf) { P.a = { gx: cf.x1 + 1, gy: cf.y0 }; }
            let cellOf = e => { let p = _imgPoint(layer, e); return _cellAt(layer._opts.grid, p.x, p.y); };
            let inCaster = c => { let f = _casterFoot(layer, P); return f && c.gx >= f.x0 && c.gx <= f.x1 && c.gy >= f.y0 && c.gy <= f.y1; };
            let onStart = c => { let f = _areaFoot(layer, P); return f && c.gx >= f.x0 && c.gx <= f.x1 && c.gy >= f.y0 && c.gy <= f.y1; };
            let setStart = c => { if (inCaster(c) && range === 0) { P.anchor = true; P.a = null; } else { P.anchor = false; P.a = c; } };
            let aim = c => { let f = _areaFoot(layer, P); if (!f) return; let dx = c.gx + 0.5 - (f.x0 + f.x1 + 1) / 2, dy = c.gy + 0.5 - (f.y0 + f.y1 + 1) / 2; if (dx || dy) P.ang = Math.atan2(dy, dx); };
            let isPan = e => e.button === 1 || (e.button === 0 && (e.ctrlKey || e.metaKey));
            let finish = res => {
                if (layer._area !== P) return;
                document.removeEventListener('keydown', onKey, true);
                window.removeEventListener('mouseup', onUp, true);
                ov.remove(); layer._area = null;
                resolve(res);
            };
            P.finish = finish;
            let confirm = () => {
                if (!P.placed) { toast(layer._opts.area, 'Click on the map to place the area first.'); return; }
                if (!_areaOk(layer, P)) { toast(layer._opts.area, P.range === 0 ? 'This power starts from you: move its start onto you or the square next to you.' : `That's out of range (${_areaReach(layer, P)} of ${P.range} squares).`); return; }
                let A = _areaCalc(layer, P); if (!A) return;
                let hit = A.hits.filter(h => !P.safe.has(h.vm.id));
                let res = { tokenIds: hit.map(h => h.vm.id), safeIds: A.hits.filter(h => P.safe.has(h.vm.id)).map(h => h.vm.id),
                    names: hit.map(h => h.vm.name || String(h.vm.title || '').split(' (')[0] || 'Token'), squares: A.cells.length };
                if (P.mode !== 'burst') _areaAng(angKey, P.ang);
                // Everyone sees where it landed for a few seconds (as this window's shared measurement)
                let o = layer._opts;
                if (o.onMeasureShare && !layer._measure) {
                    let g = { mode: P.mode, a: P.anchor ? { gx: A.fa.x0, gy: A.fa.y0 } : P.a, anchor: P.anchor ? P.casterId : null, rel: P.anchor ? { dx: 0, dy: 0 } : null,
                        vec: { dx: A.b.gx - A.fa.x0, dy: A.b.gy - A.fa.y0 }, wayRel: [], L: P.mode === 'line' ? null : P.size, n: P.mode === 'line' ? P.size : null };
                    try { o.onMeasureShare(g); layer._areaShared = g; layer._mShared = true; } catch (e) { }
                    setTimeout(() => { if (layer._areaShared === g && !layer._measure && layer._opts && layer._opts.onMeasureShare) { layer._areaShared = null; layer._mShared = false; try { layer._opts.onMeasureShare(null); } catch (e) { } } }, 15000);
                }
                finish(res);
            };
            let onKey = e => {
                let t = e.target;
                if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;   // typing in the chat, a box…
                if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(null); }
                else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); confirm(); }
            };
            let onUp = () => { if (P.drag) { P.drag = false; _layoutArea(layer); } };
            document.addEventListener('keydown', onKey, true);
            window.addEventListener('mouseup', onUp, true);
            bar.addEventListener('mousedown', e => e.stopPropagation());
            bar.addEventListener('pointerdown', e => e.stopPropagation());
            bar.querySelector('[data-ago]').addEventListener('click', e => { e.stopPropagation(); confirm(); });
            bar.querySelector('[data-askip]').addEventListener('click', e => { e.stopPropagation(); finish('skip'); });
            bar.querySelector('[data-acancel]').addEventListener('click', e => { e.stopPropagation(); finish(null); });
            ov.addEventListener('pointerdown', e => { if (!isPan(e)) e.stopPropagation(); });
            ov.addEventListener('mousedown', e => {
                if (isPan(e)) return; e.stopPropagation(); e.preventDefault(); if (e.button !== 0) return;
                let c = cellOf(e);
                if (e.shiftKey && P.safeZone && P.placed) { toggleSafe(c); return; }   // Safe Zone: Shift+click a creature in it
                if (!P.placed) { setStart(c); P.placed = true; }
                else if (onStart(c)) P.drag = true;
                else if (P.mode === 'burst') setStart(c);
                else aim(c);
                _layoutArea(layer);
            });
            ov.addEventListener('mousemove', e => {
                let c = cellOf(e);
                if (!P.placed || P.drag) {
                    let f = _areaFoot(layer, P);
                    if (!f || (P.anchor ? !inCaster(c) : (c.gx !== P.a.gx || c.gy !== P.a.gy))) { setStart(c); _layoutArea(layer); }
                    return;
                }
                ov.style.cursor = onStart(c) ? 'move' : 'crosshair';
            });
            // Scroll turns a Line or Cone (Shift+scroll, or a Burst, still zooms the map)
            ov.addEventListener('wheel', e => {
                if (P.mode === 'burst' || e.shiftKey) return;
                e.preventDefault(); e.stopPropagation();
                P.ang += (e.deltaY > 0 ? 1 : -1) * (e.altKey ? Math.max(Math.PI / 48, Math.min(Math.PI / 12, 1 / P.size)) : Math.PI / 12);   // 15° a notch; Alt for a square at a time
                _layoutArea(layer);
            }, { passive: false });
            let toggleSafe = c => {
                let A = _areaCalc(layer, P); if (!A) return;
                let h = A.hits.find(h => c.gx >= h.x0 && c.gx <= h.x1 && c.gy >= h.y0 && c.gy <= h.y1);
                if (!h) return;
                if (P.safe.has(h.vm.id)) P.safe.delete(h.vm.id); else P.safe.add(h.vm.id);
                _layoutArea(layer);
            };
            // Right-click: the same as Cancel
            ov.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); finish(null); });
            _layoutArea(layer);
        });
    }
    function isPlacingArea(winId) { return !!document.getElementById(winId + '_btScreen')?._area; }


    // ── Markings: difficult terrain, drawings, walls & doors, pings ─────
    //   opts.difficult  ["gx,gy"]: squares of difficult terrain (diagonal lines; under the fog like the map)
    //   opts.walls      [{ id, x1, y1, x2, y2 (grid corners), door, open }]: invisible except while editing them;
    //                   opts.wallsBlock(vm) -> true for the tokens they stop (a player's own)
    //   opts.doorButtons (GM): a small open / close button on each door; opts.onDoorToggle(id)
    //   opts.drawings   [{ id, c (colour), w (width, map px), p: [x, y, x, y…] (map px) }]
    //   opts.pings      [{ id, x, y (map px), who, gm, t }]
    function _marksSvg(layer) {
        let svg = layer.querySelector('[data-bt-ui="marks"]');
        if (!svg) {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('data-bt-ui', 'marks');
            svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
            svg.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:visible;z-index:60;';
            layer.insertBefore(svg, layer.firstChild);
        }
        return svg;
    }
    function _layoutMarks(layer) {
        let o = layer._opts; if (!o) return;
        let g = o.grid, win = o.win, s = win._scale || 1, ox = win._offX || 0, oy = win._offY || 0, org = origin(g), cs = g.cellSize;
        let scr = (x, y) => ({ x: ox + (org.ox + x * cs) * s, y: oy + (org.oy + y * cs) * s });   // grid units -> screen
        let px = (x, y) => ({ x: ox + x * s, y: oy + y * s });                                     // map pixels -> screen
        let tool = layer._tool;
        let diff = tool && tool.kind === 'terrain' ? [...tool.set] : (o.difficult || []);
        let draws = (o.drawings || []).concat(tool && tool.kind === 'draw' && tool.stroke ? [tool.stroke] : []);
        let walls = tool && tool.kind === 'walls' ? tool.walls : (o.walls || []);
        let showWalls = !!(tool && tool.kind === 'walls');
        if (!diff.length && !draws.length && !showWalls) {
            let old = layer.querySelector('[data-bt-ui="marks"]'); if (old) old.innerHTML = '';
        } else {
            let svg = _marksSvg(layer), pid = 'apxHatch_' + layer.id;
            let hs = Math.max(4, cs * s / 5);
            let html = `<defs><pattern id="${pid}" patternUnits="userSpaceOnUse" width="${hs}" height="${hs}" patternTransform="rotate(45)"><rect width="${hs}" height="${hs}" fill="rgba(120,53,15,.18)"/><line x1="0" y1="0" x2="0" y2="${hs}" stroke="rgba(251,191,36,.75)" stroke-width="${Math.max(1, hs / 4)}"/></pattern></defs>`;
            // Difficult terrain: rows of squares merged into strips
            let rows = {};
            diff.forEach(k => { let [x, y] = String(k).split(',').map(Number); if (isFinite(x) && isFinite(y)) (rows[y] = rows[y] || []).push(x); });
            Object.keys(rows).forEach(y => {
                let xs = rows[y].sort((a, b) => a - b), st = xs[0], pv = xs[0];
                for (let i = 1; i <= xs.length; i++) {
                    if (i < xs.length && xs[i] === pv + 1) { pv = xs[i]; continue; }
                    let a = scr(st, +y), b = scr(pv + 1, +y + 1);
                    html += `<rect x="${a.x}" y="${a.y}" width="${b.x - a.x}" height="${b.y - a.y}" fill="url(#${pid})" stroke="rgba(251,191,36,.45)" stroke-width="1"/>`;
                    if (i < xs.length) st = pv = xs[i];
                }
            });
            // Drawings
            draws.forEach(d => {
                let p = d.p || []; if (p.length < 2) return;
                let pts = [];
                for (let i = 0; i + 1 < p.length; i += 2) { let q = px(p[i], p[i + 1]); pts.push(q.x.toFixed(1) + ',' + q.y.toFixed(1)); }
                if (pts.length === 1) pts.push(pts[0]);
                let col = String(d.c || '#f43f5e').replace(/[^#a-zA-Z0-9(),.%\s]/g, '');
                html += `<polyline points="${pts.join(' ')}" fill="none" stroke="${col}" stroke-width="${Math.max(1, (d.w || 4) * s)}" stroke-linecap="round" stroke-linejoin="round"/>`;
            });
            // Walls and doors: only while editing them (red walls; doors amber when closed, green when open)
            if (showWalls) {
                walls.forEach(w => {
                    let a = scr(w.x1, w.y1), b = scr(w.x2, w.y2);
                    let col = w.door ? (w.open ? '#4ade80' : '#f59e0b') : '#ef4444';
                    html += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#000" stroke-opacity=".6" stroke-width="7" stroke-linecap="round"/>
                        <line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${col}" stroke-width="4" stroke-linecap="round" ${w.door && w.open ? 'stroke-dasharray="8 6"' : ''}/>`;
                });
                if (tool.drag) { let a = scr(tool.drag.x1, tool.drag.y1), b = scr(tool.drag.x2, tool.drag.y2); html += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#fca5a5" stroke-width="3" stroke-dasharray="6 4"/><circle cx="${a.x}" cy="${a.y}" r="4" fill="#fca5a5"/><circle cx="${b.x}" cy="${b.y}" r="4" fill="#fca5a5"/>`; }
                if (tool.corner) { let c = scr(tool.corner.x, tool.corner.y); html += `<circle cx="${c.x}" cy="${c.y}" r="5" fill="none" stroke="#fca5a5" stroke-width="2"/>`; }
            }
            svg.innerHTML = html;
        }
        _layoutDoorBtns(layer, o.doorButtons ? walls.filter(w => w && w.door) : []);
        _layoutPings(layer);
    }
    // GM: an open / close button on each door (players never see doors or walls)
    function _layoutDoorBtns(layer, doors) {
        let box = layer.querySelector('[data-bt-ui="doors"]');
        if (!doors.length) { if (box) box.remove(); return; }
        if (!box) {
            box = document.createElement('div'); box.setAttribute('data-bt-ui', 'doors');
            box.style.cssText = `position:absolute;inset:0;pointer-events:none;z-index:${Z_UI - 3};`;
            layer.appendChild(box);
        }
        let o = layer._opts, g = o.grid, win = o.win, s = win._scale || 1, ox = win._offX || 0, oy = win._offY || 0, org = origin(g), cs = g.cellSize;
        let keep = new Set();
        doors.forEach(w => {
            keep.add(w.id);
            let b = box.querySelector(`[data-door="${CSS.escape(w.id)}"]`);
            if (!b) {
                b = document.createElement('button'); b.setAttribute('data-door', w.id);
                b.style.cssText = 'position:absolute;pointer-events:auto;transform:translate(-50%,-50%);font:800 9px system-ui,sans-serif;padding:1px 5px;border-radius:4px;cursor:pointer;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.7)';
                b.addEventListener('mousedown', e => e.stopPropagation());
                b.addEventListener('pointerdown', e => e.stopPropagation());
                b.addEventListener('click', e => { e.stopPropagation(); let oo = layer._opts; if (oo && oo.onDoorToggle) oo.onDoorToggle(b.getAttribute('data-door')); });
                box.appendChild(b);
            }
            let mx = ox + (org.ox + (w.x1 + w.x2) / 2 * cs) * s, my = oy + (org.oy + (w.y1 + w.y2) / 2 * cs) * s;
            b.style.left = mx + 'px'; b.style.top = my + 'px';
            b.textContent = w.open ? 'Door: open' : 'Door: closed';
            b.title = (w.open ? 'Open: tokens can pass. Click to close it.' : 'Closed: tokens can\'t pass. Click to open it.') + ' (Only you see this button.)';
            b.style.background = w.open ? '#065f46' : '#78350f'; b.style.color = '#fff'; b.style.border = '1px solid ' + (w.open ? '#34d399' : '#f59e0b');
        });
        box.querySelectorAll('[data-door]').forEach(b => { if (!keep.has(b.getAttribute('data-door'))) b.remove(); });
    }
    // Pings: a pulse, a chime and who pinged, for a few seconds
    const _pingSeen = {};
    let _audio = null;
    function _chime() {
        try {
            _audio = _audio || new (window.AudioContext || window.webkitAudioContext)();
            if (_audio.state === 'suspended') _audio.resume().catch(() => { });
            let t = _audio.currentTime;
            [[880, 0], [1320, 0.12]].forEach(([f, d]) => {
                let osc = _audio.createOscillator(), gain = _audio.createGain();
                osc.type = 'sine'; osc.frequency.value = f;
                gain.gain.setValueAtTime(0.0001, t + d); gain.gain.exponentialRampToValueAtTime(0.18, t + d + 0.02); gain.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.5);
                osc.connect(gain); gain.connect(_audio.destination); osc.start(t + d); osc.stop(t + d + 0.55);
            });
        } catch (e) { }
    }
    // Browsers keep sound off until the page has been clicked or typed in: unlock it then, so pings from
    // others can chime even when you haven't pinged yourself
    ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, function unlock() {
        try { _audio = _audio || new (window.AudioContext || window.webkitAudioContext)(); if (_audio.state === 'suspended') _audio.resume().catch(() => { }); } catch (e) { }
        document.removeEventListener(ev, unlock, true);
    }, true));
    function _layoutPings(layer) {
        let o = layer._opts; if (!o) return;
        let now = Date.now(), live = [];
        (o.pings || []).forEach(pg => {
            if (!pg || !pg.id) return;
            let seen = _pingSeen[pg.id];
            if (!seen) {
                seen = _pingSeen[pg.id] = { at: now };
                if (now - (pg.t || now) < 15000) { seen.fresh = true; _chime(); }
            }
            if (seen.fresh && now - seen.at < 6000) live.push(pg);
        });
        let box = layer.querySelector('[data-bt-ui="pings"]');
        if (!live.length) { if (box) box.remove(); return; }
        if (!box) {
            box = document.createElement('div'); box.setAttribute('data-bt-ui', 'pings');
            box.style.cssText = `position:absolute;inset:0;pointer-events:none;z-index:${Z_UI - 2};`;
            if (!document.getElementById('apxPingCss')) {
                let st = document.createElement('style'); st.id = 'apxPingCss';
                st.textContent = '@keyframes apxPing{0%{transform:translate(-50%,-50%) scale(.2);opacity:1}100%{transform:translate(-50%,-50%) scale(2.6);opacity:0}}';
                document.head.appendChild(st);
            }
            layer.appendChild(box);
        }
        let win = o.win, s = win._scale || 1, ox = win._offX || 0, oy = win._offY || 0;
        let keep = new Set();
        live.forEach(pg => {
            keep.add(pg.id);
            let el = box.querySelector(`[data-ping="${CSS.escape(pg.id)}"]`);
            if (!el) {
                el = document.createElement('div'); el.setAttribute('data-ping', pg.id);
                el.style.cssText = 'position:absolute;width:0;height:0';
                let col = pg.gm ? '#f59e0b' : '#38bdf8';
                el.innerHTML = [0, 0.5, 1].map(d => `<div style="position:absolute;left:0;top:0;width:56px;height:56px;border-radius:50%;border:3px solid ${col};transform:translate(-50%,-50%) scale(.2);opacity:0;animation:apxPing 1.5s ease-out ${d}s 3 both"></div>`).join('')
                    + `<div style="position:absolute;left:0;top:0;width:12px;height:12px;border-radius:50%;background:${col};transform:translate(-50%,-50%);box-shadow:0 0 10px ${col}"></div>`
                    + `<div style="position:absolute;left:14px;top:-26px;white-space:nowrap;background:rgba(15,23,42,.92);border:1px solid ${col};color:#fff;font:800 12px system-ui,sans-serif;padding:2px 7px;border-radius:5px"></div>`;
                el.lastChild.textContent = pg.who || 'Someone';
                box.appendChild(el);
                let left = Math.max(500, 6000 - (now - _pingSeen[pg.id].at));
                setTimeout(() => { el.remove(); if (box.isConnected && !box.children.length) box.remove(); }, left);
            }
            el.style.left = (ox + pg.x * s) + 'px'; el.style.top = (oy + pg.y * s) + 'px';
        });
        box.querySelectorAll('[data-ping]').forEach(el => { if (!keep.has(el.getAttribute('data-ping'))) el.remove(); });
    }

    // ── Editing tools: difficult terrain and walls (GM), drawing (everyone), ping ──
    // One at a time, in place of Measure. The page's buttons call toggleTool(winId, kind); Esc stops.
    function exitTool(winId) {
        let layer = document.getElementById(winId + '_btScreen');
        if (!layer || !layer._tool) return false;
        let t = layer._tool; layer._tool = null;
        try { t.ov.remove(); } catch (e) { }
        if (t.winUp) window.removeEventListener('mouseup', t.winUp, true);
        if (layer._opts && layer._opts.onToolChange) layer._opts.onToolChange(null);
        _layoutMarks(layer);
        return true;
    }
    function toggleTool(winId, kind) {
        let layer = document.getElementById(winId + '_btScreen');
        if (!layer) return false;
        if (layer._tool && layer._tool.kind === kind) { exitTool(winId); return false; }
        return enterTool(winId, kind);
    }
    function toolOf(winId) { let l = document.getElementById(winId + '_btScreen'); return l && l._tool ? l._tool.kind : null; }
    const _DRAW_PREFS = (() => { try { return JSON.parse(localStorage.getItem('apxDrawPrefs') || '{}') || {}; } catch (e) { return {}; } })();
    function enterTool(winId, kind) {
        let layer = document.getElementById(winId + '_btScreen');
        if (!layer || !layer._opts) return false;
        if (layer._measure) exitMeasure(winId);
        if (layer._area) return false;
        if (layer._tool) exitTool(winId);
        let o = layer._opts;
        let ov = document.createElement('div');
        ov.setAttribute('data-bt-ui', 'tool');
        ov.style.cssText = `position:absolute;inset:0;z-index:${Z_UI};pointer-events:auto;cursor:crosshair;`;
        let bar = document.createElement('div');
        bar.style.cssText = 'position:absolute;left:8px;right:8px;bottom:8px;display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:5px;pointer-events:none;cursor:default;';
        let chip = 'pointer-events:auto;border:1px solid #64748b;border-radius:5px;font-size:11px;font-weight:800;padding:2px 8px;cursor:pointer;background:rgba(15,23,42,.92);color:#e2e8f0';
        let tip = t => `<span style="background:rgba(15,23,42,.92);border:1px solid #94a3b8;color:#f1f5f9;font-size:11px;font-weight:700;padding:3px 8px;border-radius:5px;white-space:normal;max-width:100%;text-align:center;pointer-events:none">${t}</span>`;
        let T = layer._tool = { kind, ov, bar, down: false };
        if (kind === 'terrain') {
            T.set = new Set(o.difficult || []);
            bar.innerHTML = tip('Difficult terrain: click or drag across squares to add or remove it (moving into one costs 2 squares; it hides under fog like the map) · Esc or the button to stop');
        } else if (kind === 'walls') {
            T.walls = JSON.parse(JSON.stringify(o.walls || []));
            bar.innerHTML = tip('Walls: drag between grid corners to draw one · Shift+click a wall to make it a door (or a wall again) · right-click a wall to delete it · players\' tokens can\'t cross walls or closed doors · only you see walls, and only while this is on');
        } else if (kind === 'draw') {
            T.color = _DRAW_PREFS.c || '#f43f5e'; T.size = _DRAW_PREFS.w || 3;
            bar.innerHTML = `<label style="${chip};display:flex;align-items:center;gap:4px">Colour <input data-dcol type="color" value="${T.color}" style="width:26px;height:18px;border:0;padding:0;background:none;cursor:pointer"></label>
                <label style="${chip};display:flex;align-items:center;gap:4px">Size <input data-dsize type="range" min="1" max="10" value="${T.size}" style="width:80px"><b data-dsizev>${T.size}</b></label>
                <button data-dundo style="${chip}">Undo</button><button data-dclear style="${chip}">Clear mine</button>${o.isGM ? `<button data-dclearall style="${chip};border-color:#ef4444;color:#fecaca">Clear everyone's</button>` : ''}`
                + tip('Draw: drag on the map · everyone at the table sees it · Esc, right-click or the button to stop');
        } else if (kind === 'ping') {
            bar.innerHTML = tip('Click where you want everyone to look (or press P with your mouse there, any time)');
        }
        ov.appendChild(bar); layer.appendChild(ov);
        bar.addEventListener('mousedown', e => e.stopPropagation());
        bar.addEventListener('pointerdown', e => e.stopPropagation());
        if (kind === 'draw') {
            let save = () => { _DRAW_PREFS.c = T.color; _DRAW_PREFS.w = T.size; try { localStorage.setItem('apxDrawPrefs', JSON.stringify(_DRAW_PREFS)); } catch (e) { } };
            bar.querySelector('[data-dcol]').addEventListener('input', e => { T.color = e.target.value; save(); });
            bar.querySelector('[data-dsize]').addEventListener('input', e => { T.size = parseInt(e.target.value) || 3; bar.querySelector('[data-dsizev]').textContent = T.size; save(); });
            bar.querySelector('[data-dundo]').addEventListener('click', e => { e.stopPropagation(); let oo = layer._opts; if (oo.onDrawUndo) oo.onDrawUndo(); });
            bar.querySelector('[data-dclear]').addEventListener('click', e => { e.stopPropagation(); let oo = layer._opts; if (oo.onDrawClear) oo.onDrawClear(false); });
            let ca = bar.querySelector('[data-dclearall]'); if (ca) ca.addEventListener('click', e => { e.stopPropagation(); let oo = layer._opts; if (oo.onDrawClear) oo.onDrawClear(true); });
        }
        let isPan = e => e.button === 1 || (e.button === 0 && (e.ctrlKey || e.metaKey));
        let cellOf = e => { let p = _imgPoint(layer, e); return _cellAt(layer._opts.grid, p.x, p.y); };
        let gridPt = e => { let p = _imgPoint(layer, e), g = layer._opts.grid, org = origin(g); return { x: (p.x - org.ox) / g.cellSize, y: (p.y - org.oy) / g.cellSize }; };
        let cornerOf = e => { let q = gridPt(e); return { x: Math.round(q.x), y: Math.round(q.y) }; };
        let nearWall = e => {
            let q = gridPt(e), best = null, bd = 0.35;
            T.walls.forEach(w => {
                let vx = w.x2 - w.x1, vy = w.y2 - w.y1, L = vx * vx + vy * vy || 1;
                let t = Math.max(0, Math.min(1, ((q.x - w.x1) * vx + (q.y - w.y1) * vy) / L));
                let d = Math.hypot(q.x - (w.x1 + t * vx), q.y - (w.y1 + t * vy));
                if (d < bd) { bd = d; best = w; }
            });
            return best;
        };
        let wallsOut = () => { let oo = layer._opts; if (oo.onWallsChange) oo.onWallsChange(JSON.parse(JSON.stringify(T.walls))); };
        let paint = c => { let k = c.gx + ',' + c.gy; if (T.mode === 'add') T.set.add(k); else T.set.delete(k); };
        ov.addEventListener('mousedown', e => {
            if (isPan(e)) return;
            e.stopPropagation(); e.preventDefault();
            if (e.button !== 0) return;
            let oo = layer._opts;
            if (kind === 'ping') { let p = _imgPoint(layer, e); if (oo.onPing) oo.onPing({ x: Math.round(p.x), y: Math.round(p.y) }); exitTool(winId); return; }
            if (kind === 'terrain') { let c = cellOf(e); T.down = true; T.mode = T.set.has(c.gx + ',' + c.gy) ? 'remove' : 'add'; T.last = c.gx + ',' + c.gy; paint(c); _layoutMarks(layer); return; }
            if (kind === 'walls') {
                if (e.shiftKey) { let w = nearWall(e); if (w) { w.door = !w.door; w.open = false; wallsOut(); _layoutMarks(layer); } return; }
                let c = cornerOf(e); T.down = true; T.drag = { x1: c.x, y1: c.y, x2: c.x, y2: c.y }; _layoutMarks(layer); return;
            }
            if (kind === 'draw') { let p = _imgPoint(layer, e); T.down = true; T.stroke = { c: T.color, w: Math.round(T.size * (oo.grid.cellSize || 50) / 25 * 10) / 10, p: [Math.round(p.x), Math.round(p.y)] }; _layoutMarks(layer); }
        });
        ov.addEventListener('mousemove', e => {
            if (kind === 'walls' && !T.down) { T.corner = cornerOf(e); _layoutMarks(layer); return; }
            if (!T.down) return;
            if (kind === 'terrain') { let c = cellOf(e), k = c.gx + ',' + c.gy; if (k === T.last) return; T.last = k; paint(c); _layoutMarks(layer); return; }
            if (kind === 'walls') { let c = cornerOf(e); T.drag.x2 = c.x; T.drag.y2 = c.y; T.corner = c; _layoutMarks(layer); return; }
            if (kind === 'draw') {
                let p = _imgPoint(layer, e), pts = T.stroke.p, lx = pts[pts.length - 2], ly = pts[pts.length - 1];
                if (Math.hypot(p.x - lx, p.y - ly) * (layer._opts.win._scale || 1) < 3 || pts.length > 1600) return;
                pts.push(Math.round(p.x), Math.round(p.y)); _layoutMarks(layer);
            }
        });
        let up = () => {
            if (!T.down || layer._tool !== T) return;
            T.down = false;
            let oo = layer._opts;
            if (kind === 'terrain' && oo.onTerrainChange) oo.onTerrainChange([...T.set]);
            if (kind === 'walls' && T.drag) {
                let d = T.drag; T.drag = null;
                if (d.x1 !== d.x2 || d.y1 !== d.y2) {
                    T.walls.push({ id: 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2, door: false, open: false });
                    wallsOut();
                }
            }
            if (kind === 'draw' && T.stroke) {
                let st = T.stroke; T.stroke = null;
                if (st.p.length === 2) st.p.push(st.p[0] + 1, st.p[1]);   // a dot
                if (oo.onDraw) oo.onDraw(Object.assign({ id: 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) }, st));
            }
            _layoutMarks(layer);
        };
        ov.addEventListener('mouseup', up);
        T.winUp = () => up();
        window.addEventListener('mouseup', T.winUp, true);
        ov.addEventListener('contextmenu', e => {
            e.preventDefault(); e.stopPropagation();
            if (kind === 'walls') { let w = nearWall(e); if (w) { T.walls = T.walls.filter(x => x !== w); wallsOut(); _layoutMarks(layer); return; } }
            exitTool(winId);
        });
        if (o.onToolChange) o.onToolChange(kind);
        _layoutMarks(layer);
        return true;
    }
    // P: ping where your mouse is on the map you're over
    function pingHere(winId) {
        let layer = document.getElementById(winId + '_btScreen');
        if (!layer || !layer._opts || !layer._opts.onPing || !layer._mouse) return false;
        layer._opts.onPing({ x: Math.round(layer._mouse.x), y: Math.round(layer._mouse.y) });
        return true;
    }

    function toggleMeasure(winId) { return exitMeasure(winId) ? false : enterMeasure(winId); }
    function isMeasuring(winId) { return !!document.getElementById(winId + '_btScreen')?._measure; }

    document.addEventListener('keydown', e => {
        let t = e.target;
        if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === 'm' || e.key === 'M') {
            let win = _hoverWin && document.getElementById(_hoverWin + '_btScreen') ? _hoverWin : null;
            if (!win) {
                // fall back to the only battle map with tokens rendered
                let live = [...document.querySelectorAll('[id$="_btScreen"]')].filter(l => l._opts);
                if (live.length === 1) win = live[0].id.replace(/_btScreen$/, '');
            }
            if (win) { e.preventDefault(); toggleMeasure(win); }
        } else if (e.key === 'v' || e.key === 'V') {
            // GM: show / hide your measurements to your players
            let win = _hoverWin && document.getElementById(_hoverWin + '_btScreen') ? _hoverWin : null;
            let l = win ? document.getElementById(win + '_btScreen') : [...document.querySelectorAll('[id$="_btScreen"]')].find(x => x._opts && x._opts.measureShare === 'toggle');
            if (l && _toggleShow(l)) e.preventDefault();
        } else if (e.key === 'p' || e.key === 'P') {
            let win = _hoverWin && document.getElementById(_hoverWin + '_btScreen') ? _hoverWin : null;
            if (win && pingHere(win)) e.preventDefault();
        } else if (e.key === 'Escape') {
            document.querySelectorAll('[id$="_btScreen"]').forEach(l => {
                let w = l.id.replace(/_btScreen$/, '');
                if (l._tool) exitTool(w);
                if (l._measure) exitMeasure(w);
                else if (l._opts?.onSelect && l._opts.selection?.size) l._opts.onSelect([], false);
            });
        }
    });

    function toast(area, msg, kind) {
        if (window.APXDice && window.APXDice.notify) { window.APXDice.notify(msg, { kind: kind === 'info' ? 'note' : 'warn' }); return; }
        if (!area) return;
        let t = document.createElement('div');
        t.textContent = msg;
        let info = kind === 'info';
        t.style.cssText = 'position:absolute;left:50%;bottom:12px;transform:translateX(-50%);z-index:' + (Z_UI + 10) + ';' +
            (info ? 'background:rgba(15,23,42,.95);border:1px solid #3b82f6;color:#dbeafe;' : 'background:rgba(127,29,29,.95);border:1px solid #ef4444;color:#fecaca;') +
            'font-size:0.7rem;font-weight:700;' +
            'padding:0.3rem 0.7rem;border-radius:0.35rem;pointer-events:none;white-space:nowrap;';
        area.appendChild(t);
        setTimeout(() => t.remove(), 1800);
    }

    // "Goblin 2" -> 2 ; "Goblin" -> null
    function numberOf(name) { let m = /\s(\d+)\s*$/.exec(String(name || '')); return m ? Number(m[1]) : null; }

    // Character sheet size (ancestry.size = lbs-per-STR multiplier: 15 small, 30 medium, 60 large)
    function sizeFromCharState(st) {
        let v = parseInt(st?.ancestry?.size, 10);
        if (!v) return null;
        return v <= 15 ? 'small' : v >= 60 ? 'large' : 'medium';
    }

    // Downscale an uploaded image for storage in one Firestore document (< ~900 KB).
    // Keeps transparency (WebP), so cut-out props like carts and tower floors work.
    function compressImage(file, maxSide) {
        return new Promise((resolve, reject) => {
            let fr = new FileReader();
            fr.onerror = () => reject(new Error('Could not read that file'));
            fr.onload = () => {
                let im = new Image();
                im.onerror = () => reject(new Error('That file is not an image'));
                im.onload = () => {
                    let side = maxSide || 1600, q = 0.86, out = null;
                    for (let i = 0; i < 8; i++) {
                        let sf = Math.min(1, side / Math.max(im.naturalWidth, im.naturalHeight));
                        let c = document.createElement('canvas');
                        c.width = Math.max(1, Math.round(im.naturalWidth * sf));
                        c.height = Math.max(1, Math.round(im.naturalHeight * sf));
                        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
                        out = c.toDataURL('image/webp', q);
                        if (!out.startsWith('data:image/webp')) out = c.toDataURL('image/png');
                        if (out.length < 900000) return resolve({ src: out, w: c.width, h: c.height });
                        side = Math.round(side * 0.8); q = Math.max(0.6, q - 0.06);
                    }
                    resolve({ src: out, w: im.naturalWidth, h: im.naturalHeight });
                };
                im.src = fr.result;
            };
            fr.readAsDataURL(file);
        });
    }

    // Fog of War doesn't need the map's full resolution (it's saved at 512 px anyway).
    // A full-size canvas on a big map is hundreds of MB of GPU memory, which is what
    // made panning, resizing and dragging the GM's map window lag. The canvas keeps a
    // capped pixel size and is simply displayed at the map's size.
    const FOG_MAX = 1536;
    function sizeFogCanvas(fc, iw, ih) {
        if (!fc || !iw || !ih) return false;
        let k = Math.min(1, FOG_MAX / Math.max(iw, ih));
        let w = Math.max(1, Math.round(iw * k)), h = Math.max(1, Math.round(ih * k));
        fc.style.width = iw + 'px'; fc.style.height = ih + 'px';
        fc._imgW = iw; fc._imgH = ih; fc._k = w / iw;
        if (fc.width === w && fc.height === h) return false;
        fc.width = w; fc.height = h;   // (resizing wipes the canvas)
        return true;
    }

    // The page's old full-size grid element is no longer drawn (a map-sized bitmap
    // was costly); the grid is drawn in screen space by render()/layout() instead.
    function styleGrid(el) {
        if (!el) return;
        if (el.tagName === 'CANVAS') { el.width = 0; el.height = 0; }
        el.style.backgroundImage = 'none'; el.style.width = '0px'; el.style.height = '0px';
    }

    // Window resizing without live re-layout: dragging the corner grip shows an outline,
    // and the window takes the new size once, on release. (The browser's own live
    // resize re-renders the whole map on every frame, which lags on big maps.)
    function outlineResize(win, opts) {
        opts = opts || {};
        if (!win || win._outlineResize) return;
        win._outlineResize = true;
        win.style.resize = 'none';
        let grip = document.createElement('div');
        grip.setAttribute('data-resize-grip', '1');
        grip.title = 'Drag to resize';
        grip.style.cssText = 'position:absolute;right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize;z-index:2147480000;touch-action:none;' +
            'background:linear-gradient(135deg,transparent 0 45%,#64748b 45% 52%,transparent 52% 65%,#64748b 65% 72%,transparent 72%);border-bottom-right-radius:inherit;';
        win.appendChild(grip);
        grip.addEventListener('pointerdown', e => {
            if (e.button !== 0) return;
            e.preventDefault(); e.stopPropagation();
            let r = win.getBoundingClientRect(), sx = e.clientX, sy = e.clientY;
            let minW = opts.minW || 300, minH = opts.minH || 220;
            let ol = document.createElement('div');
            ol.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;border:2px dashed #60a5fa;background:rgba(96,165,250,.06);border-radius:0.75rem;z-index:2147483600;pointer-events:none;box-sizing:border-box;`;
            document.body.appendChild(ol);
            let w = r.width, h = r.height;
            grip.setPointerCapture(e.pointerId);
            let move = ev => {
                w = Math.max(minW, Math.min(window.innerWidth - r.left, r.width + ev.clientX - sx));
                h = Math.max(minH, Math.min(window.innerHeight - r.top, r.height + ev.clientY - sy));
                ol.style.width = w + 'px'; ol.style.height = h + 'px';
            };
            let up = () => {
                grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); grip.removeEventListener('pointercancel', up);
                ol.remove();
                win.style.width = Math.round(w) + 'px'; win.style.height = Math.round(h) + 'px';
                if (opts.onResize) opts.onResize(w, h);
                requestAnimationFrame(() => win.querySelectorAll('[id$="_btScreen"]').forEach(l => layout(l.id.replace(/_btScreen$/, ''))));
            };
            grip.addEventListener('pointermove', move);
            grip.addEventListener('pointerup', up);
            grip.addEventListener('pointercancel', up);
        });
    }

    window.APXBattle = {
        outlineResize,
        sizeFogCanvas, styleGrid,
        SIZES, SIZE_LIST,
        grid, origin, mult, span, center, diameter, pointToCell,
        collides, findBlocker, findFreeCell,
        posOf, portraitOf, start, stop, move, onChange,
        party: () => Object.values(store.profiles), companionOf, mail: () => store.mail,
        render, layout, clear, toast,
        numberOf, sizeFromCharState, compressImage,
        squaresBetween, pathSquares, areaCells, lineCells, measuresFor, writeMeasure, moveCost, auraColor, enterMeasure, exitMeasure, toggleMeasure, isMeasuring,
        placeArea, isPlacingArea,
        pathCost, wallBlocking, enterTool, exitTool, toggleTool, toolOf, pingHere,
        pingsFor, drawingsFor, myDrawings, writePing, writeDrawings, draws: () => store.draws
    };
})();
