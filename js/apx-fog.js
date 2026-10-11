// ============================================================
// APX per-player Fog of War (GM Tools + Character Sheet)
// ============================================================
// Every player has their own Fog of War on a battle map: the GM's fog (the shared base, painted
// in the GM Tools) minus that player's own reveals. A player's reveals are a mask (opaque where
// revealed), kept at worldCodes/{code}/players/{uid}/fog/{mapId}:
//   • the player adds to it (Room reveal, Vision cone, coming out of a portal)
//   • the GM adds to it (revealing for that one player) or takes from it (covering in their view,
//     or covering for everyone, which re-hides what any player had revealed there)
// Masks are canvases the size of the map's fog canvas; edits made before a mask has loaded wait
// for it, so nothing ever overwrites a player's saved reveals with a blank one.
// ============================================================
(function () {
    'use strict';
    const masks = {};   // key -> { code, uid, mapId, canvas, loaded, unsub, subs: Set, queue: [], dirty, saveT, seq }
    const keyOf = (code, uid, mapId) => String(code || '').toUpperCase().trim() + '|' + uid + '|' + mapId;
    const online = () => !!(window.apxAuth && window.apxAuth.enabled && window.apxAuth.user);

    function entry(code, uid, mapId) {
        let k = keyOf(code, uid, mapId);
        let e = masks[k];
        if (!e) {
            e = masks[k] = { key: k, code: String(code || '').toUpperCase().trim(), uid, mapId, canvas: document.createElement('canvas'), loaded: false, subs: new Set(), queue: [], seq: 0, img: null };
            e.canvas.width = 1; e.canvas.height = 1;
            if (!online() || !e.code) { e.loaded = true; }
            else {
                e.unsub = window.apxAuth.listenFogMask(e.code, uid, mapId, (png, pending, err) => {
                    if (pending) return;                    // our own write coming back
                    if (e.dirty && e.loaded) return;        // unsaved edits here win; they save shortly
                    let done = () => { let first = !e.loaded; e.loaded = true; flush(e); if (!first || e.subs.size) notify(e); };
                    if (!png || err) { e.img = null; if (!e.dirty) clear(e); done(); return; }
                    let seq = ++e.seq, im = new Image();
                    im.onload = () => { if (seq !== e.seq) return; e.img = im; draw(e); done(); };
                    im.onerror = () => done();
                    im.src = png;
                });
            }
        }
        return e;
    }
    function clear(e) { let c = e.canvas; c.getContext('2d').clearRect(0, 0, c.width, c.height); }
    function draw(e) { clear(e); if (e.img) e.canvas.getContext('2d').drawImage(e.img, 0, 0, e.canvas.width, e.canvas.height); }
    function notify(e) { e.subs.forEach(fn => { try { fn(e); } catch (er) { console.warn('Fog mask:', er); } }); }
    function flush(e) { let q = e.queue; e.queue = []; q.forEach(fn => { try { fn(); } catch (er) { console.warn('Fog mask edit:', er); } }); }
    // Match the mask to a fog canvas (w × h canvas pixels); what it holds is scaled along
    function fit(e, w, h) {
        let c = e.canvas;
        if (!(w > 0 && h > 0) || (c.width === w && c.height === h)) return;
        let keep = null;
        if (c.width > 1 && c.height > 1) { keep = document.createElement('canvas'); keep.width = c.width; keep.height = c.height; keep.getContext('2d').drawImage(c, 0, 0); }
        c.width = w; c.height = h;
        if (keep) c.getContext('2d').drawImage(keep, 0, 0, w, h); else if (e.img) draw(e);
    }
    let tmp = null;
    function save(e) {
        e.dirty = true;
        clearTimeout(e.saveT);
        e.saveT = setTimeout(() => {
            if (!online() || !e.code) { e.dirty = false; return; }
            let c = e.canvas, sf = Math.min(512 / c.width, 512 / c.height, 1);
            tmp = tmp || document.createElement('canvas');
            tmp.width = Math.max(1, Math.round(c.width * sf)); tmp.height = Math.max(1, Math.round(c.height * sf));
            let t = tmp.getContext('2d'); t.clearRect(0, 0, tmp.width, tmp.height); t.drawImage(c, 0, 0, tmp.width, tmp.height);
            let png = tmp.toDataURL('image/png');
            window.apxAuth.saveFogMask(e.code, e.uid, e.mapId, png).then(() => { e.dirty = false; }).catch(er => { e.dirty = false; console.warn('Fog mask save:', er.message); });
        }, 800);
    }
    // Run an edit on a mask once it has loaded. fn(ctx, canvas) draws on it; reveal (true) adds, false takes away.
    function edit(code, uid, mapId, w, h, fn, reveal) {
        if (!uid || !mapId) return;
        let e = entry(code, uid, mapId);
        let run = () => {
            fit(e, w, h);
            let ctx = e.canvas.getContext('2d');
            ctx.save();
            ctx.globalCompositeOperation = reveal ? 'source-over' : 'destination-out';
            ctx.fillStyle = '#000'; ctx.strokeStyle = '#000';
            fn(ctx, e.canvas);
            ctx.restore();
            save(e); notify(e);
        };
        if (e.loaded) run(); else e.queue.push(run);
    }

    window.APXFog = {
        // Follow a player's mask (fires when it loads or changes, from either side). Returns unsubscribe.
        watch(code, uid, mapId, fn) {
            if (!uid || !mapId) return () => { };
            let e = entry(code, uid, mapId);
            if (fn) { e.subs.add(fn); if (e.loaded) setTimeout(() => fn(e), 0); }
            return () => { if (fn) e.subs.delete(fn); };
        },
        mask(code, uid, mapId) { let e = masks[keyOf(code, uid, mapId)]; return e && e.loaded ? e : null; },
        // Masks this page has open for a map (GM: to re-hide areas for every player)
        masksFor(code, mapId) { return Object.values(masks).filter(e => e.code === String(code || '').toUpperCase().trim() && e.mapId === mapId); },
        // Polygons are in fog-canvas pixels: [[{x, y}…], …] (evenodd, so later rings cut holes)
        polys(code, uid, mapId, w, h, rings, reveal) {
            edit(code, uid, mapId, w, h, ctx => {
                ctx.beginPath();
                rings.forEach(r => { r.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); });
                ctx.fill('evenodd');
            }, reveal);
        },
        circle(code, uid, mapId, w, h, x, y, r, reveal) {
            edit(code, uid, mapId, w, h, ctx => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }, reveal);
        },
        all(code, uid, mapId, w, h, reveal) {
            edit(code, uid, mapId, w, h, (ctx, c) => { ctx.fillRect(0, 0, c.width, c.height); }, reveal);
        },
        // What a player sees: the base fog (an image or canvas) minus their mask, drawn on `into`
        compose(into, base, maskEntry) {
            let ctx = into.getContext('2d');
            ctx.save();
            ctx.globalCompositeOperation = 'source-over';
            ctx.clearRect(0, 0, into.width, into.height);
            if (base) ctx.drawImage(base, 0, 0, into.width, into.height);
            if (base && maskEntry && maskEntry.canvas.width > 1) {
                ctx.globalCompositeOperation = 'destination-out';
                ctx.drawImage(maskEntry.canvas, 0, 0, into.width, into.height);
            }
            ctx.restore();
        },
        // A room's outline (grid units) -> fog-canvas pixel rings, given the map's grid and the canvas scale k
        roomRings(room, g, k) {
            let G = window.APXBattle.grid(g), o = window.APXBattle.origin(G), cs = G.cellSize;
            let tp = p => ({ x: (o.ox + p.x * cs) * k, y: (o.oy + p.y * cs) * k });
            return [room.poly.map(tp)].concat((room.holes || []).map(h => h.map(tp)));
        },
        // A vision fan (grid units) -> fog-canvas pixels
        gridRing(pts, g, k) {
            let G = window.APXBattle.grid(g), o = window.APXBattle.origin(G), cs = G.cellSize;
            return pts.map(p => ({ x: (o.ox + p.x * cs) * k, y: (o.oy + p.y * cs) * k }));
        },
        stop(code, uid, mapId) {
            let k = keyOf(code, uid, mapId), e = masks[k]; if (!e) return;
            if (e.subs.size) return;
            try { e.unsub && e.unsub(); } catch (er) { }
            delete masks[k];
        }
    };
})();
