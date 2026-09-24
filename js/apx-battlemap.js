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
        return { cellSize: cs, offsetX: parseFloat(g.offsetX) || 0, offsetY: parseFloat(g.offsetY) || 0 };
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
    function findBlocker(tokens, moving, gx, gy, posOf) {
        for (let o of (tokens || [])) {
            if (!o || o.id === moving.id) continue;
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
    const store = { byUid: {}, portraits: {}, profiles: {} };
    const changeHandlers = new Set();
    let _unsub = null, _code = null;

    function _num(v) { return typeof v === 'number' && isFinite(v); }

    // Effective position of any token. Player tokens read the live
    // authority first; everything else uses the GM's token data.
    function posOf(mapId, tok) {
        if (tok && tok.type === 'player' && tok.playerUid) {
            let p = store.byUid[tok.playerUid]?.[mapId]?.[tok.id];
            if (p && _num(p.gridX) && _num(p.gridY)) return { gridX: p.gridX, gridY: p.gridY };
        }
        return { gridX: parseInt(tok?.gridX, 10) || 0, gridY: parseInt(tok?.gridY, 10) || 0 };
    }
    function portraitOf(uid) { return (uid && store.portraits[uid]) || ''; }

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
            let next = {}, profiles = {};
            docs.forEach(d => {
                if (!d.uid) return;
                next[d.uid] = d.battlePositions || {};
                if (d.charPortrait) store.portraits[d.uid] = d.charPortrait;
                if (d.profile) profiles[d.uid] = Object.assign({ uid: d.uid, portrait: d.charPortrait || '' }, d.profile);
            });
            store.byUid = next;
            store.profiles = profiles;
            _notify();
        });
    }
    function stop() {
        if (_unsub) { try { _unsub(); } catch (e) {} }
        _unsub = null; _code = null; store.byUid = {}; store.profiles = {};
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
    //   opacity, filter, portrait, title, draggable, interactive, badge, num, numColor, conds, attrs:{} }
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
        _restoreFog(l);
        l.querySelectorAll('[data-bt],[data-btp],[data-bt-ui],[data-bt-grid]').forEach(el => el.remove());
        l._opts = null;
        exitMeasure(winId);
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

    function _tokenZ(el) {
        let vm = el._vm;
        if (el._drag) return Z_DRAG;
        let o = el._layerRef && el._layerRef._opts;
        if (o && o.aboveFog && o.aboveFog.has(vm.id)) return Z_ABOVE_FOG + SIZE_LIST.length - SIZE_LIST.indexOf(vm.size || 'medium');
        // Smaller tokens sit above larger ones on the same layer
        return zFor(vm.layer == null ? 1 : vm.layer, 900 + SIZE_LIST.length - SIZE_LIST.indexOf(vm.size || 'medium'));
    }

    function _place(el, g, s, offX, offY, gx, gy) {
        let vm = el._vm;
        let c = center(g, gx, gy, vm.size);
        let d = diameter(g, vm.size) * s;
        let bw = Math.max(1, (vm.borderW || 2) * s);
        el.style.left = (offX + c.px * s) + 'px';
        el.style.top  = (offY + c.py * s) + 'px';
        el.style.width = d + 'px';
        el.style.height = d + 'px';
        el.style.borderWidth = bw + 'px';
        let glow = vm.glow ? `0 0 ${Math.max(4, 20 * s)}px ${Math.max(1, 5 * s)}px ${vm.glow},` : '';
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
        _drawGrid(layer);
        _layoutMeasure(layer);
    }

    // Grid: a canvas the size of the visible map area (not the whole map), redrawn only
    // when the view changes. Nothing map-sized is repainted when the window is resized.
    function _drawGrid(layer) {
        let cv = layer.querySelector('[data-bt-grid]'), o = layer._opts;
        if (!cv || !o || !o.imgSize || !o.imgSize.w) return;
        let area = o.area || layer.parentNode, win = o.win;
        let W = area.clientWidth, H = area.clientHeight;
        let dpr = Math.min(3, window.devicePixelRatio || 1);
        let pw = Math.max(1, Math.round(W * dpr)), ph = Math.max(1, Math.round(H * dpr));
        let s = win?._scale || 1, ox = win?._offX || 0, oy = win?._offY || 0;
        let g = o.grid, org = origin(g), cs = g.cellSize * s;
        let key = [pw, ph, s, ox, oy, g.cellSize, org.ox, org.oy, o.imgSize.w, o.imgSize.h].join('|');
        if (cv._key === key) return;
        cv._key = key;
        if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
        let ctx = cv.getContext('2d');
        ctx.clearRect(0, 0, pw, ph);
        if (!(cs >= 4)) return;   // too dense to be useful when zoomed far out
        let x0 = Math.max(0, ox), x1 = Math.min(W, ox + o.imgSize.w * s);
        let y0 = Math.max(0, oy), y1 = Math.min(H, oy + o.imgSize.h * s);
        if (x1 <= x0 || y1 <= y0) return;
        let lw = Math.max(1, Math.round(dpr));
        ctx.fillStyle = '#fff';
        let startX = ox + org.ox * s; startX -= Math.ceil((startX - x0) / cs) * cs;
        for (let x = startX; x <= x1; x += cs) { if (x < x0 - 0.01) continue; ctx.fillRect(Math.round(x * dpr), Math.round(y0 * dpr), lw, Math.round((y1 - y0) * dpr)); }
        let startY = oy + org.oy * s; startY -= Math.ceil((startY - y0) / cs) * cs;
        for (let y = startY; y <= y1; y += cs) { if (y < y0 - 0.01) continue; ctx.fillRect(Math.round(x0 * dpr), Math.round(y * dpr), Math.round((x1 - x0) * dpr), lw); }
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
            if (!el._vm.draggable || !o.onMove) return;
            try { el.setPointerCapture(e.pointerId); } catch (_) {}
            let p = _imgPoint(layer, e);
            el._drag = { sx: el._vm.gridX, sy: el._vm.gridY, gx: el._vm.gridX, gy: el._vm.gridY, px: p.x, py: p.y };
            el._group = _groupMembers(layer, el);
            _beginGroup(layer, el._group);
            el.style.transition = 'none';
            el.style.cursor = 'grabbing';
            el.style.zIndex = String(Z_DRAG);
        });

        el.addEventListener('pointermove', e => {
            if (!el._drag) return;
            let o = layer._opts; if (!o) return;
            let c = _pointerCell(layer, el, e);
            if (c.gridX === el._drag.gx && c.gridY === el._drag.gy) return;
            el._drag.gx = c.gridX; el._drag.gy = c.gridY;
            if (el._group && el._group.length) {
                _applyGroupDelta(layer, el._group, c.gridX - el._drag.sx, c.gridY - el._drag.sy);
                let ok = !o.canGroupMove || o.canGroupMove(_moveList(el, el._group));
                [el].concat(el._group).forEach(m => m.style.opacity = ok ? String(m._vm.opacity == null ? 1 : m._vm.opacity) : '0.4');
                el.style.outline = ok ? (el._sel ? '2px solid #22d3ee' : 'none') : '2px dashed #ef4444';
            } else {
                let bad = o.previewBlocked ? !!o.previewBlocked(el._vm, c.gridX, c.gridY) : false;
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
            el._drag = null;
            el.style.opacity = String(el._vm.opacity == null ? 1 : el._vm.opacity);
            if (!o) return;
            if (cancelled || (d.gx === d.sx && d.gy === d.sy)) { layout(o.winId); return; }
            let dest = o.resolveDrop ? o.resolveDrop(el._vm, d.gx, d.gy) : { gridX: d.gx, gridY: d.gy };
            if (!dest || (dest.gridX === d.sx && dest.gridY === d.sy)) { _glideBack(layer, [el]); return; }  // blocked -> back to last spot
            el._vm.gridX = dest.gridX; el._vm.gridY = dest.gridY;
            layout(o.winId);
            o.onMove(el._vm, dest.gridX, dest.gridY);
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
        el.appendChild(inner); el.appendChild(tint); el.appendChild(badge); el.appendChild(num); el.appendChild(cond);
        el._inner = inner; el._tint = tint; el._badge = badge; el._num = num; el._cond = cond;
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
                gridEl.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;opacity:.35;z-index:50;';
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
        });
        // Remove tokens that are gone (never yank one out from under an active drag)
        existing.forEach(el => { if (!el._drag) el.remove(); });
        layout(opts.winId);
    }

    // ── Area hooks: marquee select, click-to-deselect, hover tracking ──
    let _hoverWin = null;
    function _hookArea(area, layer) {
        area.addEventListener('mousemove', () => { _hoverWin = layer.id.replace(/_btScreen$/, ''); });
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
    function squaresBetween(dx, dy) {
        dx = Math.abs(dx); dy = Math.abs(dy);
        return Math.max(dx, dy) + Math.floor(Math.min(dx, dy) / 2);
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
                return { x0: vm.gridX, y0: vm.gridY, x1: vm.gridX + sp - 1, y1: vm.gridY + sp - 1, name: vm.name || vm.title, token: true };
        }
        return { x0: cell.gx, y0: cell.gy, x1: cell.gx, y1: cell.gy };
    }
    function _nearest(a, b) {
        // nearest cell of footprint a to footprint b, per axis
        let pick = (a0, a1, b0, b1) => b1 < a0 ? a0 : b0 > a1 ? a1 : Math.max(a0, b0);
        return { gx: pick(a.x0, a.x1, b.x0, b.x1), gy: pick(a.y0, a.y1, b.y0, b.y1) };
    }
    // Square to square: counts every square the line covers, INCLUDING the starting
    // square (next-door squares = 2). Token to token (or token to square): counts the
    // squares between them the way movement does (adjacent = 1), and the line snaps to
    // the nearest CORNER of each token's space, so it doubles as a cover check.
    function _layoutMeasure(layer) {
        let m = layer._measure; if (!m || !m.a || !m.b) { if (m && m.svg) m.svg.innerHTML = ''; return; }
        let o = layer._opts, g = o.grid, win = o.win;
        let s = win._scale || 1, ox = win._offX || 0, oy = win._offY || 0;
        let fa = _footprintAt(layer, m.a), fb = _footprintAt(layer, m.b);
        let ca = _nearest(fa, fb), cb = _nearest(fb, fa);
        let anyToken = fa.token || fb.token;
        let n = squaresBetween(cb.gx - ca.gx, cb.gy - ca.gy) + (anyToken ? 0 : 1);
        let org = origin(g), cs = g.cellSize;
        let scr = (x, y) => ({ x: ox + (org.ox + x * cs) * s, y: oy + (org.oy + y * cs) * s });   // grid units -> screen
        let centerPts = f => [{ x: f.x0 + 0.5, y: f.y0 + 0.5 }];
        let cornerPts = f => [{ x: f.x0, y: f.y0 }, { x: f.x1 + 1, y: f.y0 }, { x: f.x0, y: f.y1 + 1 }, { x: f.x1 + 1, y: f.y1 + 1 }];
        let pa = fa.token ? cornerPts(fa) : centerPts(fa), pb = fb.token ? cornerPts(fb) : centerPts(fb);
        let best = null;
        pa.forEach(A => pb.forEach(B => { let d = (A.x - B.x) ** 2 + (A.y - B.y) ** 2; if (!best || d < best.d) best = { d, A, B }; }));
        let p1 = scr(best.A.x, best.A.y), p2 = scr(best.B.x, best.B.y);
        let hl = f => { let tl = scr(f.x0, f.y0), br = scr(f.x1 + 1, f.y1 + 1);
            return `<rect x="${tl.x}" y="${tl.y}" width="${br.x - tl.x}" height="${br.y - tl.y}" fill="rgba(250,204,21,${f.token ? '.08' : '.18'})" stroke="rgba(250,204,21,.7)" stroke-width="1" ${f.token ? 'stroke-dasharray="4 3"' : ''}/>`; };
        let label = `${n} square${n === 1 ? '' : 's'}`;
        let lx = p2.x + 14, ly = p2.y - 14;
        m.svg.innerHTML = `${hl(fa)}${hl(fb)}
            <line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="#000" stroke-opacity=".6" stroke-width="5" stroke-linecap="round"/>
            <line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="#facc15" stroke-width="2.5" stroke-dasharray="7 5" stroke-linecap="round"/>
            <circle cx="${p1.x}" cy="${p1.y}" r="4" fill="#facc15"/><circle cx="${p2.x}" cy="${p2.y}" r="4" fill="#facc15"/>
            <g transform="translate(${lx},${ly})"><rect x="-4" y="-15" rx="4" width="${label.length * 7.4 + 10}" height="22" fill="rgba(15,23,42,.92)" stroke="#facc15"/>
            <text x="1" y="1" fill="#fde68a" font-size="13" font-weight="800" font-family="system-ui,sans-serif">${label}</text></g>`;
        m.last = n;
    }
    function enterMeasure(winId) {
        let layer = document.getElementById(winId + '_btScreen');
        if (!layer || !layer._opts || layer._measure) return false;
        let ov = document.createElement('div');
        ov.setAttribute('data-bt-ui', 'measure');
        ov.style.cssText = `position:absolute;inset:0;z-index:${Z_UI};pointer-events:auto;cursor:crosshair;`;
        let svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
        svg.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:visible;';
        let tip = document.createElement('div');
        tip.textContent = 'Measure: drag between squares or tokens. Middle-drag to pan. M or Esc to exit.';
        tip.style.cssText = 'position:absolute;left:50%;top:8px;transform:translateX(-50%);background:rgba(15,23,42,.92);border:1px solid #facc15;color:#fde68a;font-size:11px;font-weight:700;padding:3px 8px;border-radius:5px;pointer-events:none;white-space:nowrap;';
        ov.appendChild(svg); ov.appendChild(tip);
        layer.appendChild(ov);
        let m = layer._measure = { ov, svg, a: null, b: null, down: false };
        let cellOf = e => { let p = _imgPoint(layer, e); return _cellAt(layer._opts.grid, p.x, p.y); };
        // Middle-click (or Ctrl+left) passes through to the map so it can pan while measuring
        let isPan = e => e.button === 1 || (e.button === 0 && (e.ctrlKey || e.metaKey));
        ov.addEventListener('mousedown', e => { if (isPan(e)) return; e.stopPropagation(); e.preventDefault(); if (e.button !== 0) return; m.down = true; m.a = cellOf(e); m.b = m.a; _layoutMeasure(layer); });
        ov.addEventListener('mousemove', e => { if (!m.down) return; let c = cellOf(e); if (m.b && c.gx === m.b.gx && c.gy === m.b.gy) return; m.b = c; _layoutMeasure(layer); });
        ov.addEventListener('mouseup', e => { if (!m.down) return; e.stopPropagation(); m.down = false; });
        ov.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); exitMeasure(winId); });
        (layer._opts.onMeasureChange || (() => {}))(true);
        return true;
    }
    function exitMeasure(winId) {
        let layer = document.getElementById(winId + '_btScreen');
        if (!layer || !layer._measure) return false;
        layer._measure.ov.remove();
        layer._measure = null;
        if (layer._opts?.onMeasureChange) layer._opts.onMeasureChange(false);
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
        } else if (e.key === 'Escape') {
            document.querySelectorAll('[id$="_btScreen"]').forEach(l => {
                let w = l.id.replace(/_btScreen$/, '');
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
        party: () => Object.values(store.profiles),
        render, layout, clear, toast,
        numberOf, sizeFromCharState, compressImage,
        squaresBetween, enterMeasure, exitMeasure, toggleMeasure, isMeasuring
    };
})();
