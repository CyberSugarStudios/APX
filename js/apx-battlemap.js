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
    const store = { byUid: {}, portraits: {} };
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
            let next = {};
            docs.forEach(d => {
                if (!d.uid) return;
                next[d.uid] = d.battlePositions || {};
                if (d.charPortrait) store.portraits[d.uid] = d.charPortrait;
            });
            store.byUid = next;
            _notify();
        });
    }
    function stop() {
        if (_unsub) { try { _unsub(); } catch (e) {} }
        _unsub = null; _code = null; store.byUid = {};
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
    //   winId, win (has _scale/_offX/_offY), area (the map's viewport element),
    //   grid, tokens: [viewModel], onMove(vm,gx,gy), resolveDrop(vm,gx,gy)->{gridX,gridY}|null,
    //   previewBlocked(vm,gx,gy)->bool, onDblClick(vm), onContextMenu(vm,e)
    // }
    // viewModel = { id, gridX, gridY, size, label, bg, borderColor, borderW, glow, tint,
    //   opacity, filter, portrait, title, draggable, interactive, attrs:{} }
    function _layer(area, winId) {
        let id = winId + '_btScreen';
        let l = document.getElementById(id);
        if (!l) {
            l = document.createElement('div');
            l.id = id;
            l.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:5;';
            area.appendChild(l);
        }
        return l;
    }

    function clear(winId) {
        let l = document.getElementById(winId + '_btScreen');
        if (l) { l.innerHTML = ''; l._opts = null; }
    }

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

    function _styleStatic(el, vm) {
        el.title = vm.title || '';
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
        Object.entries(vm.attrs || {}).forEach(([k, v]) => { if (v != null) el.setAttribute(k, v); });
        _paintContent(el, vm);
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
        // Smaller tokens sit above larger ones
        if (!el._drag) el.style.zIndex = String(Math.round(10 / (SIZES[vm.size] || 1)));
    }

    function layout(winId) {
        let layer = document.getElementById(winId + '_btScreen');
        if (!layer || !layer._opts) return;
        let o = layer._opts, win = o.win;
        let s = win?._scale || 1, ox = win?._offX || 0, oy = win?._offY || 0;
        layer.querySelectorAll('[data-bt]').forEach(el => {
            if (!el._vm) return;
            let gx = el._drag ? el._drag.gx : el._vm.gridX;
            let gy = el._drag ? el._drag.gy : el._vm.gridY;
            _place(el, o.grid, s, ox, oy, gx, gy);
        });
    }

    function _pointerCell(layer, el, e) {
        let o = layer._opts, win = o.win, area = o.area;
        let r = area.getBoundingClientRect();
        let s = win._scale || 1;
        let x = (e.clientX - r.left - (win._offX || 0)) / s;
        let y = (e.clientY - r.top  - (win._offY || 0)) / s;
        return pointToCell(o.grid, x, y, el._vm.size);
    }

    function _attach(layer, el) {
        el.style.touchAction = 'none';
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
            if (!el._vm.draggable || !o.onMove) return;
            try { el.setPointerCapture(e.pointerId); } catch (_) {}
            el._drag = { sx: el._vm.gridX, sy: el._vm.gridY, gx: el._vm.gridX, gy: el._vm.gridY };
            el.style.transition = 'none';
            el.style.cursor = 'grabbing';
            el.style.zIndex = '999';
        });

        el.addEventListener('pointermove', e => {
            if (!el._drag) return;
            let o = layer._opts; if (!o) return;
            let c = _pointerCell(layer, el, e);
            if (c.gridX === el._drag.gx && c.gridY === el._drag.gy) return;
            el._drag.gx = c.gridX; el._drag.gy = c.gridY;
            let bad = o.previewBlocked ? !!o.previewBlocked(el._vm, c.gridX, c.gridY) : false;
            el.style.opacity = bad ? '0.4' : String(el._vm.opacity == null ? 1 : el._vm.opacity);
            el.style.outline = bad ? '2px dashed #ef4444' : 'none';
            layout(o.winId);
        });

        let finish = (cancelled) => {
            let d = el._drag; if (!d) return;
            el._drag = null;
            let o = layer._opts;
            el.style.cursor = el._vm.draggable ? 'grab' : 'default';
            el.style.outline = 'none';
            el.style.opacity = String(el._vm.opacity == null ? 1 : el._vm.opacity);
            if (!o) return;
            if (cancelled || (d.gx === d.sx && d.gy === d.sy)) { layout(o.winId); return; }
            let dest = o.resolveDrop ? o.resolveDrop(el._vm, d.gx, d.gy) : { gridX: d.gx, gridY: d.gy };
            if (!dest || (dest.gridX === d.sx && dest.gridY === d.sy)) {
                // Blocked -> glide back to the last spot
                el.style.transition = 'left .15s ease-out, top .15s ease-out';
                layout(o.winId);
                setTimeout(() => { el.style.transition = 'none'; }, 180);
                return;
            }
            el._vm.gridX = dest.gridX; el._vm.gridY = dest.gridY;
            layout(o.winId);
            o.onMove(el._vm, dest.gridX, dest.gridY);
        };
        el.addEventListener('pointerup',     () => finish(false));
        el.addEventListener('pointercancel', () => finish(true));
        el.addEventListener('lostpointercapture', () => { if (el._drag) finish(false); });
    }

    function _create(layer) {
        let el = document.createElement('div');
        el.style.cssText = 'position:absolute;transform:translate(-50%,-50%);border-style:solid;border-radius:50%;' +
            'box-sizing:border-box;overflow:hidden;user-select:none;-webkit-user-select:none;';
        let inner = document.createElement('div');
        inner.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;border-radius:50%;overflow:hidden;';
        let tint = document.createElement('div');
        tint.style.cssText = 'position:absolute;inset:0;border-radius:50%;pointer-events:none;';
        // Big centred number (e.g. bleed-out turns remaining)
        let badge = document.createElement('div');
        badge.style.cssText = 'position:absolute;inset:0;display:none;align-items:center;justify-content:center;pointer-events:none;' +
            'color:#fff;font-weight:900;line-height:1;text-shadow:0 0 3px #000,0 0 6px #000,0 1px 2px #000;';
        el.appendChild(inner); el.appendChild(tint); el.appendChild(badge);
        el._inner = inner; el._tint = tint; el._badge = badge;
        _attach(layer, el);
        return el;
    }

    function render(opts) {
        if (!opts || !opts.area || !opts.winId) return;
        let layer = _layer(opts.area, opts.winId);
        opts.grid = grid(opts.grid);
        layer._opts = opts;
        let existing = new Map();
        layer.querySelectorAll('[data-bt]').forEach(el => existing.set(el.getAttribute('data-bt'), el));
        (opts.tokens || []).forEach(vm => {
            let el = existing.get(vm.id);
            if (el) existing.delete(vm.id);
            else { el = _create(layer); el.setAttribute('data-bt', vm.id); layer.appendChild(el); }
            el._vm = vm;
            _styleStatic(el, vm);
        });
        // Remove tokens that are gone (never yank one out from under an active drag)
        existing.forEach(el => { if (!el._drag) el.remove(); });
        layout(opts.winId);
    }

    function toast(area, msg) {
        if (!area) return;
        let t = document.createElement('div');
        t.textContent = msg;
        t.style.cssText = 'position:absolute;left:50%;bottom:12px;transform:translateX(-50%);z-index:50;' +
            'background:rgba(127,29,29,.95);border:1px solid #ef4444;color:#fecaca;font-size:0.7rem;font-weight:700;' +
            'padding:0.3rem 0.7rem;border-radius:0.35rem;pointer-events:none;white-space:nowrap;';
        area.appendChild(t);
        setTimeout(() => t.remove(), 1800);
    }

    window.APXBattle = {
        SIZES, SIZE_LIST,
        grid, origin, mult, span, center, diameter, pointToCell,
        collides, findBlocker, findFreeCell,
        posOf, portraitOf, start, stop, move, onChange,
        render, layout, clear, toast
    };
})();
