// ============================================================
// APX Map Tiles — full-resolution maps without Firebase Storage
// ============================================================
// Every uploaded map gets a compressed PREVIEW (longest side 1600 px) that
// loads instantly. Grid squares, tokens, pins and fog all use the preview's
// pixel size, exactly as before, so nothing else in the app changes.
//
// A map small enough to fit in the preview without shrinking stops there.
// A bigger one (where shrinking would blur text and fine lines) is also cut
// into TILES: 512 px squares at full resolution, plus half-resolution
// (and quarter…) levels for very large maps. Each tile is its own Firestore
// document, kept well under the 1 MiB limit (a tile that comes out too big
// is re-encoded at lower quality, or split into four smaller tiles).
//
// While viewing, only the tiles needed are loaded: the ones inside the map
// window, at the level that matches how far you're zoomed in (on this
// screen's pixel density). Zoomed out, the preview alone is sharp enough and
// no tiles load at all. Tiles are kept in this browser (IndexedDB) so each
// one downloads only once.
//
// A map's tile list (its "manifest") lives with the map in the world notes:
//   { v, w, h, pw, ph, ts, fmt, levels: [{ s, cols, rows, split: ['r_c', …] }] }
// Tile document ids: `${mapKey}_${v}_${level}_${row}_${col}` (+ `_q0..3` for split tiles)
// ============================================================
(function () {
    'use strict';

    const PREVIEW_MAX = 1600;        // longest side of the preview (the size everything is positioned on)
    const TILE = 512;                // tile edge, in the tile level's own pixels (small tiles keep quality high)
    const TILE_MAX_CHARS = 800000;   // a tile's data URL stays under this (Firestore's limit is 1,048,576 bytes per document)
    const PREVIEW_MAX_CHARS = 750000;
    const QUALITIES = [0.92, 0.86, 0.8, 0.72];
    const STREAM_RESET_BYTES = 4 * 1024 * 1024;   // restart Firestore's write connection this often while uploading tiles
    const COMPRESSOR_URLS = ['js/vendor/browser-image-compression.js',
        'https://cdn.jsdelivr.net/npm/browser-image-compression@2.0.2/dist/browser-image-compression.js'];

    // ── Encoding ──────────────────────────────────────────────────────────
    let _webp = null;
    function encodeType() {
        if (_webp === null) {
            try { let c = document.createElement('canvas'); c.width = c.height = 2; _webp = c.toDataURL('image/webp').startsWith('data:image/webp'); }
            catch (e) { _webp = false; }
        }
        return _webp ? 'image/webp' : 'image/jpeg';
    }
    function canvasToBlob(canvas, type, q) {
        return new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('Could not encode the image')), type, q));
    }
    function blobToDataUrl(blob) {
        return new Promise((res, rej) => { let r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
    }
    function dataUrlToBlob(u) {
        let i = u.indexOf(','), meta = u.slice(5, i), b64 = meta.includes('base64');
        let bin = b64 ? atob(u.slice(i + 1)) : decodeURIComponent(u.slice(i + 1));
        let arr = new Uint8Array(bin.length);
        for (let k = 0; k < bin.length; k++) arr[k] = bin.charCodeAt(k);
        return new Blob([arr], { type: meta.split(';')[0] || 'image/jpeg' });
    }
    function makeCanvas(w, h) { let c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
    function ctx2d(c) { let x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; return x; }

    // browser-image-compression (loaded on first use: a local copy in js/vendor/, else jsdelivr).
    // If neither loads, the built-in encoder below does the same job.
    let _compressorP = null;
    function loadCompressor() {
        if (window.imageCompression) return Promise.resolve(window.imageCompression);
        if (_compressorP) return _compressorP;
        _compressorP = (async () => {
            for (let url of COMPRESSOR_URLS) {
                let ok = await new Promise(res => {
                    let s = document.createElement('script');
                    s.src = url; s.async = true;
                    let t = setTimeout(() => res(false), 8000);
                    s.onload = () => { clearTimeout(t); res(!!window.imageCompression); };
                    s.onerror = () => { clearTimeout(t); s.remove(); res(false); };
                    document.head.appendChild(s);
                });
                if (ok) return window.imageCompression;
            }
            return null;
        })();
        return _compressorP;
    }

    // Decode an uploaded file once (full resolution)
    async function decode(file) {
        if (window.createImageBitmap) {
            try { return await createImageBitmap(file); } catch (e) { /* fall back to <img> */ }
        }
        let url = URL.createObjectURL(file);
        try {
            let img = new Image();
            img.decoding = 'async';
            await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('That file could not be opened as an image.')); img.src = url; });
            return img;
        } finally { setTimeout(() => URL.revokeObjectURL(url), 30000); }
    }
    const dims = src => ({ w: src.naturalWidth || src.width, h: src.naturalHeight || src.height });

    // Scale down in halving steps (much sharper than one big jump)
    function downscale(src, tw, th) {
        let { w, h } = dims(src), cur = src;
        while (w / 2 >= tw * 1.01 && h / 2 >= th * 1.01) {
            let c = makeCanvas(Math.ceil(w / 2), Math.ceil(h / 2));
            ctx2d(c).drawImage(cur, 0, 0, c.width, c.height);
            if (cur !== src && cur.width) { cur.width = cur.height = 0; }
            cur = c; w = c.width; h = c.height;
        }
        let out = makeCanvas(tw, th);
        ctx2d(out).drawImage(cur, 0, 0, out.width, out.height);
        if (cur !== src && cur.width) { cur.width = cur.height = 0; }
        return out;
    }

    // Built-in size-targeted encoder: best quality that fits, then smaller if it must
    async function fitEncode(canvas, maxChars) {
        let type = encodeType(), c = canvas;
        for (let pass = 0; pass < 6; pass++) {
            for (let q of [0.9, 0.82].concat(QUALITIES.slice(1))) {
                let u = await blobToDataUrl(await canvasToBlob(c, type, q));
                if (u.length <= maxChars) return u;
            }
            c = downscale(c, c.width * 0.85, c.height * 0.85);
        }
        throw new Error('This image could not be made small enough to save.');
    }

    // The preview: longest side ≤ 1600 px and under the size cap. browser-image-compression
    // does the size targeting when it's available.
    async function makePreview(src, file) {
        let { w, h } = dims(src);
        let r = Math.min(1, PREVIEW_MAX / Math.max(w, h));
        let pw = Math.max(1, Math.round(w * r)), ph = Math.max(1, Math.round(h * r));
        let canvas = r < 1 ? downscale(src, pw, ph) : (() => { let c = makeCanvas(w, h); ctx2d(c).drawImage(src, 0, 0); return c; })();
        let lib = await loadCompressor().catch(() => null);
        if (lib) {
            try {
                // Hand it the already-sized image (never the huge original), lossless
                let input = r < 1 || !file ? new File([await canvasToBlob(canvas, 'image/png')], 'map.png', { type: 'image/png' }) : file;
                let out = await lib(input, { maxSizeMB: 0.52, maxWidthOrHeight: PREVIEW_MAX, initialQuality: 0.9, useWebWorker: true, fileType: encodeType() });
                let u = await blobToDataUrl(out);
                if (u.length <= PREVIEW_MAX_CHARS) {
                    let im = await decode(out);
                    let d = dims(im);
                    // Keep the exact preview size (the library may shave a pixel or shrink further)
                    if (d.w === canvas.width && d.h === canvas.height) return { dataUrl: u, pw: d.w, ph: d.h };
                }
            } catch (e) { console.warn('browser-image-compression:', e.message || e); }
        }
        let u = await fitEncode(canvas, PREVIEW_MAX_CHARS);
        let d = dims(await decode(dataUrlToBlob(u)));
        return { dataUrl: u, pw: d.w, ph: d.h };
    }

    // Encode one tile region (in full-resolution pixels) at level scale s
    async function encodeTile(src, x, y, w, h, s, type) {
        let c = makeCanvas(Math.ceil(w * s), Math.ceil(h * s));
        ctx2d(c).drawImage(src, x, y, w, h, 0, 0, c.width, c.height);
        for (let q of QUALITIES) {
            let u = await blobToDataUrl(await canvasToBlob(c, type, q));
            if (u.length <= TILE_MAX_CHARS) { c.width = c.height = 0; return u; }
        }
        c.width = c.height = 0;
        return null;   // too detailed for one document: split it
    }

    // Plan the levels for a W×H image
    function planLevels(W, H) {
        let levels = [], s = 1;
        while (true) {
            let lw = Math.ceil(W * s), lh = Math.ceil(H * s);
            levels.push({ s, cols: Math.ceil(lw / TILE), rows: Math.ceil(lh / TILE), split: [] });
            s /= 2;
            // Stop once the next level would be no sharper than the preview
            if (Math.max(W, H) * s <= PREVIEW_MAX * 1.5) break;
        }
        return levels;
    }
    // A tile's area in full-resolution pixels
    function tileRect(m, li, r, c, q) {
        let L = m.levels[li], step = m.ts / L.s;
        let x = c * step, y = r * step, w = Math.min(step, m.w - x), h = Math.min(step, m.h - y);
        if (q == null) return { x, y, w, h };
        let hw = Math.ceil(w / 2), hh = Math.ceil(h / 2);
        return { x: x + (q % 2 ? hw : 0), y: y + (q > 1 ? hh : 0), w: q % 2 ? w - hw : hw, h: q > 1 ? h - hh : hh };
    }
    // A tile also carries a few pixels past its right and bottom edges (the "bleed"), so neighbouring
    // tiles overlap with identical image content: no gaps and no stretching at any zoom.
    const BLEED = 3;   // in the tile level's pixels
    function tileRectBleed(m, li, r, c, q) {
        let rc = tileRect(m, li, r, c, q), b = (m.bleed || 0) / m.levels[li].s;
        return { x: rc.x, y: rc.y, w: Math.min(rc.w + b, m.w - rc.x), h: Math.min(rc.h + b, m.h - rc.y) };
    }
    const tileId = (key, v, li, r, c, q) => `${key}_${v}_${li}_${r}_${c}` + (q == null ? '' : `_q${q}`);

    // ── Upload ────────────────────────────────────────────────────────────
    // processUpload(file, { mapKey, onPreview(dataUrl, manifest|null), saveTile(docId, dataUrl, i, n), onProgress(text) })
    // Resolves { preview, manifest } once every tile is saved (manifest is null for a small map).
    async function processUpload(file, o) {
        o = o || {};
        let say = t => { try { o.onProgress && o.onProgress(t); } catch (e) { } };
        say('reading…');
        let src = await decode(file);
        let { w: W, h: H } = dims(src);
        say('compressing…');
        let pre = await makePreview(src, file);
        let tiled = Math.max(W, H) > PREVIEW_MAX && typeof o.saveTile === 'function';
        let manifest = null;
        if (tiled) {
            let key = String(o.mapKey || 'map').replace(/[^\w-]/g, '_');
            manifest = { v: Date.now().toString(36), key, w: W, h: H, pw: pre.pw, ph: pre.ph, ts: TILE, bleed: BLEED, fmt: encodeType().split('/')[1], levels: planLevels(W, H) };
        }
        if (o.onPreview) { try { await o.onPreview(pre.dataUrl, manifest); } catch (e) { console.warn('Map preview:', e); } }
        if (!manifest) { if (src.close) src.close(); return { preview: pre.dataUrl, manifest: null }; }

        // Coarse levels first: they're what a zoomed-out view needs soonest
        let jobs = [];
        for (let li = manifest.levels.length - 1; li >= 0; li--) {
            let L = manifest.levels[li];
            for (let r = 0; r < L.rows; r++) for (let c = 0; c < L.cols; c++) jobs.push({ li, r, c });
        }
        let type = encodeType(), done = 0, total = jobs.length, sent = 0;
        // Each tile is saved (and confirmed) before the next. Every few MB the write connection is
        // restarted: Firestore refuses a connection that has carried too much ("write stream exhausted").
        let save = async (id, u) => {
            if (sent > STREAM_RESET_BYTES && o.resetStream) { sent = 0; try { await o.resetStream(); } catch (e) { } }
            for (let attempt = 0; ; attempt++) {
                try { await o.saveTile(id, u, done + 1, total); break; }
                catch (e) {
                    if (attempt >= 4) throw e;
                    say(`connection busy, retrying tile ${done + 1}/${total}…`);
                    if (o.resetStream) { try { await o.resetStream(); } catch (e2) { } }
                    await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
                }
            }
            sent += u.length;
        };
        for (let j of jobs) {
            let L = manifest.levels[j.li];
            let rc = tileRectBleed(manifest, j.li, j.r, j.c);
            let u = await encodeTile(src, rc.x, rc.y, rc.w, rc.h, L.s, type);
            if (u) {
                let id = tileId(manifest.key, manifest.v, j.li, j.r, j.c);
                cachePutDataUrl(o.cachePrefix, id, u);
                await save(id, u);
            } else {
                L.split.push(j.r + '_' + j.c);
                for (let q = 0; q < 4; q++) {
                    let qr = tileRectBleed(manifest, j.li, j.r, j.c, q);
                    let qu = await encodeTile(src, qr.x, qr.y, qr.w, qr.h, L.s, type);
                    if (!qu) {   // extremely noisy: shrink this quarter until it fits
                        let c = makeCanvas(Math.ceil(qr.w * L.s), Math.ceil(qr.h * L.s));
                        ctx2d(c).drawImage(src, qr.x, qr.y, qr.w, qr.h, 0, 0, c.width, c.height);
                        qu = await fitEncode(c, TILE_MAX_CHARS);
                    }
                    let id = tileId(manifest.key, manifest.v, j.li, j.r, j.c, q);
                    cachePutDataUrl(o.cachePrefix, id, qu);
                    await save(id, qu);
                }
            }
            done++;
            say(`saving tiles ${done}/${total}…`);
        }
        if (src.close) src.close();
        return { preview: pre.dataUrl, manifest };
    }

    // ── Tile cache (this browser) ────────────────────────────────────────
    let _dbP = null;
    function idb() {
        if (_dbP) return _dbP;
        _dbP = new Promise(res => {
            try {
                let rq = indexedDB.open('apxMapTiles', 1);
                rq.onupgradeneeded = () => { rq.result.createObjectStore('tiles'); };
                rq.onsuccess = () => res(rq.result);
                rq.onerror = () => res(null);
            } catch (e) { res(null); }
        });
        return _dbP;
    }
    async function idbGet(key) {
        let db = await idb(); if (!db) return null;
        return new Promise(res => {
            try { let rq = db.transaction('tiles').objectStore('tiles').get(key); rq.onsuccess = () => res(rq.result ? rq.result.blob : null); rq.onerror = () => res(null); }
            catch (e) { res(null); }
        });
    }
    let _putCount = 0;
    async function idbPut(key, blob) {
        let db = await idb(); if (!db) return;
        try { db.transaction('tiles', 'readwrite').objectStore('tiles').put({ blob, t: Date.now() }, key); } catch (e) { return; }
        if (++_putCount % 50 === 0) idbTrim(db);
    }
    // Keep the cache to the ~1500 most recently saved tiles
    function idbTrim(db) {
        try {
            let st = db.transaction('tiles', 'readwrite').objectStore('tiles'), all = [];
            st.openCursor().onsuccess = e => {
                let cur = e.target.result;
                if (cur) { all.push([cur.key, cur.value.t || 0]); cur.continue(); return; }
                if (all.length <= 1500) return;
                all.sort((a, b) => a[1] - b[1]).slice(0, all.length - 1500).forEach(([k]) => st.delete(k));
            };
        } catch (e) { }
    }
    const _mem = new Map();   // key -> object URL (most recent last)
    function memPut(key, blob) {
        let url = URL.createObjectURL(blob);
        _mem.set(key, url);
        while (_mem.size > 400) { let [k, u] = _mem.entries().next().value; _mem.delete(k); URL.revokeObjectURL(u); }
        return url;
    }
    function cachePutDataUrl(prefix, id, dataUrl) {
        if (!prefix) return;
        let blob = dataUrlToBlob(dataUrl), key = prefix + id;
        memPut(key, blob); idbPut(key, blob);
    }
    async function tileUrl(prefix, id, fetchTile) {
        let key = prefix + id;
        if (_mem.has(key)) { let u = _mem.get(key); _mem.delete(key); _mem.set(key, u); return u; }
        let blob = await idbGet(key);
        if (!blob) {
            let d = await fetchTile(id);
            if (!d) return null;
            blob = dataUrlToBlob(d);
            idbPut(key, blob);
        }
        return memPut(key, blob);
    }

    // ── Viewer ───────────────────────────────────────────────────────────
    // attach(img, clipEl, manifest, { prefix, fetchTile(docId) → dataUrl })
    // Draws tiles over the preview <img>, inside whatever pans/zooms it.
    const _views = new Set();
    let _timer = 0;
    function attach(img, clip, manifest, opts) {
        detach(img);
        if (!img || !manifest || !manifest.levels || !opts || typeof opts.fetchTile !== 'function') return null;
        let layer = document.createElement('div');
        layer.className = 'apx-tile-layer';
        // z-index 0 makes the layer its own stacking context: tiles can never rise above fog, grid or tokens
        layer.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;display:none;z-index:0;';
        img.insertAdjacentElement('afterend', layer);
        let view = { img, clip, m: manifest, opts, layer, els: new Map(), loading: new Set(), failed: new Map(), sig: '', queue: [] };
        img._apxTiles = view;
        _views.add(view);
        if (!_timer) _timer = setInterval(tick, 200);
        update(view, true);
        return view;
    }
    function detach(img) {
        let v = img && img._apxTiles; if (!v) return;
        _views.delete(v); v.layer.remove(); img._apxTiles = null;
        if (!_views.size && _timer) { clearInterval(_timer); _timer = 0; }
    }
    function tick() {
        _views.forEach(v => {
            if (!v.img.isConnected) { detach(v.img); return; }
            update(v, false);
            resharpen(v);
        });
    }
    // Map viewports use will-change: transform for smooth panning, and Chrome may keep drawing that
    // layer at the zoom it was first painted at, so zoomed-in detail looks soft. Once the zoom
    // settles, drop and restore will-change so it repaints at the current zoom.
    function resharpen(v) {
        if (v.layer.style.display === 'none') return;
        let vp = v.img.parentElement; if (!vp) return;
        let z = Math.round(v.img.getBoundingClientRect().width);
        let now = Date.now();
        if (z !== v.zoomW) { v.zoomW = z; v.zoomAt = now; v.sharpAt = 0; return; }
        if (v.sharpAt || now - v.zoomAt < 300) return;
        v.sharpAt = now;
        if (!/transform/.test(vp.style.willChange || getComputedStyle(vp).willChange)) return;
        vp.style.willChange = 'auto';
        requestAnimationFrame(() => requestAnimationFrame(() => { vp.style.willChange = 'transform'; }));
    }
    function update(v, force) {
        let img = v.img, m = v.m;
        let shown = img.style.display !== 'none' && img.naturalWidth > 0 && img.offsetParent !== null;
        if (!shown) { v.layer.style.display = 'none'; return; }
        let r = img.getBoundingClientRect(), cr = (v.clip || img.parentElement).getBoundingClientRect();
        let dpr = window.devicePixelRatio || 1;
        let sig = [r.left, r.top, r.width, r.height, cr.left, cr.top, cr.width, cr.height, dpr, img.naturalWidth].map(n => Math.round(n)).join(',');
        if (!force && sig === v.sig && !v.failed.size) return;
        v.sig = sig;
        v.layer.style.width = img.naturalWidth + 'px';
        v.layer.style.height = img.naturalHeight + 'px';
        // Screen pixels per full-resolution pixel
        let need = r.width * dpr / m.w;
        let previewScale = img.naturalWidth / m.w;
        if (need <= previewScale * 1.2 || r.width < 2) { v.layer.style.display = 'none'; return; }
        v.layer.style.display = '';
        // The coarsest level that still has at least one tile pixel per screen pixel here
        // (never a stretched lower level); past full size, full resolution is all there is
        let li = 0;
        m.levels.forEach((L, i) => { if (L.s >= need && L.s < m.levels[li].s) li = i; });
        // Visible part of the image, in full-resolution pixels (with a margin so panning is seamless)
        let k = m.w / r.width;
        let x0 = (cr.left - r.left) * k, y0 = (cr.top - r.top) * k, x1 = (cr.right - r.left) * k, y1 = (cr.bottom - r.top) * k;
        let mx = (x1 - x0) * 0.15, my = (y1 - y0) * 0.15;
        x0 = Math.max(0, x0 - mx); y0 = Math.max(0, y0 - my); x1 = Math.min(m.w, x1 + mx); y1 = Math.min(m.h, y1 + my);
        if (x1 <= x0 || y1 <= y0) return;
        let L = m.levels[li], step = m.ts / L.s;
        let wanted = [];
        for (let rr = Math.floor(y0 / step); rr <= Math.min(L.rows - 1, Math.floor((y1 - 1) / step)); rr++)
            for (let cc = Math.floor(x0 / step); cc <= Math.min(L.cols - 1, Math.floor((x1 - 1) / step)); cc++) {
                if ((L.split || []).includes(rr + '_' + cc)) for (let q = 0; q < 4; q++) wanted.push({ li, r: rr, c: cc, q });
                else wanted.push({ li, r: rr, c: cc });
            }
        let now = Date.now();
        wanted.forEach(t => {
            let id = tileId(m.key, m.v, t.li, t.r, t.c, t.q);
            let el = v.els.get(id);
            if (el) { el._seen = now; return; }
            let f = v.failed.get(id);
            if (f && now - f < 8000) return;   // try a failed tile again after a few seconds
            v.failed.delete(id);
            if (v.loading.has(id)) return;
            v.queue.push({ id, t });
        });
        // Finer levels draw on top of coarser ones
        pump(v);
        // Forget tiles far from view once there are many
        if (v.els.size > 180) {
            [...v.els.entries()].sort((a, b) => a[1]._seen - b[1]._seen).slice(0, v.els.size - 140).forEach(([id, el]) => { el.remove(); v.els.delete(id); });
        }
    }
    function pump(v) {
        // Newest requests first (what's on screen now), at most 4 downloads at a time
        while (v.loading.size < 6 && v.queue.length) {
            let job = v.queue.pop();
            if (v.els.has(job.id) || v.loading.has(job.id)) continue;
            v.loading.add(job.id);
            load(v, job).finally(() => { v.loading.delete(job.id); pump(v); });
        }
        if (v.queue.length > 60) v.queue = v.queue.slice(-60);
    }
    async function load(v, job) {
        let url = null;
        try { url = await tileUrl(v.opts.prefix || '', job.id, v.opts.fetchTile); } catch (e) { }
        if (!_views.has(v)) return;
        if (!url) { v.failed.set(job.id, Date.now()); return; }
        let m = v.m, t = job.t, rc = tileRectBleed(m, t.li, t.r, t.c, t.q);
        let el = new Image();
        el.decoding = 'async';
        el.draggable = false;
        // Positioned exactly (in percent of the preview box). The bleed overlaps the next tile with
        // the same pixels, so there's never a gap and nothing is stretched out of line.
        el.style.cssText = `position:absolute;left:${rc.x / m.w * 100}%;top:${rc.y / m.h * 100}%;width:${rc.w / m.w * 100}%;height:${rc.h / m.h * 100}%;`
            + `max-width:none;pointer-events:none;user-select:none;z-index:${10 - t.li};`;
        el._seen = Date.now();
        await new Promise(res => { el.onload = res; el.onerror = res; el.src = url; });
        if (!_views.has(v) || !el.naturalWidth) { if (!el.naturalWidth) v.failed.set(job.id, Date.now()); return; }
        v.layer.appendChild(el);
        v.els.set(job.id, el);
    }

    // Every tile document id a manifest uses (for tests and cleanup)
    function tileIds(m) {
        let out = [];
        (m && m.levels || []).forEach((L, li) => { for (let r = 0; r < L.rows; r++) for (let c = 0; c < L.cols; c++) {
            if ((L.split || []).includes(r + '_' + c)) for (let q = 0; q < 4; q++) out.push(tileId(m.key, m.v, li, r, c, q));
            else out.push(tileId(m.key, m.v, li, r, c));
        } });
        return out;
    }

    window.APXTiles = { processUpload, attach, detach, tileIds, loadCompressor, PREVIEW_MAX, TILE, TILE_MAX_CHARS,
        _views, _planLevels: planLevels, _tileRect: tileRect };
})();
