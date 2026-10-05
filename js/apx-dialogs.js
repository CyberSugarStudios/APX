// Today's date in the person's own time zone, as YYYY-MM-DD. (toISOString() gives the UTC date,
// which is already tomorrow on an evening in the Americas.)
window.apxToday = function (d) {
    d = d != null ? new Date(d) : new Date();
    let p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
};
// ----------------------------------------------------------------
// APX Dialogs — themed replacements for the browser's alert / confirm / prompt
// ----------------------------------------------------------------
// Every colour comes from the active theme's CSS variables (css/apx-themes.css),
// so these match Modern, Fantasy, Cyberpunk, Futuristic and Kawaii automatically.
//
//   await apxConfirm('Delete this pin?', { title:'Delete', okLabel:'Delete', danger:true })  → true / false
//   await apxAlert('Saved!')                                                                 → undefined
//   await apxPrompt('World name:', 'Default', { title:'New World' })                          → string / null
//
// window.alert is routed here too, so any remaining alert() call shows a themed box.
// ----------------------------------------------------------------
(function () {
    'use strict';
    const Z = 2147483646;

    function esc(s) {
        return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function injectStyles() {
        if (document.getElementById('apxDialogStyles')) return;
        let st = document.createElement('style');
        st.id = 'apxDialogStyles';
        st.textContent = `
        .apxdlg-back{position:fixed;inset:0;z-index:${Z};background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px;animation:apxdlgFade .12s ease-out}
        .apxdlg{background:var(--c-surface,#1e293b);border:1px solid var(--c-border2,#475569);border-radius:.75rem;box-shadow:0 20px 60px rgba(0,0,0,.6);
                width:min(380px,100%);padding:1.1rem 1.2rem 1rem;font-family:var(--c-font,inherit);color:var(--c-text,#fff);animation:apxdlgPop .14s ease-out}
        .apxdlg-title{font-family:var(--c-heading-font,inherit);font-weight:800;font-size:.95rem;margin:0 0 .35rem;color:var(--c-text,#fff)}
        .apxdlg-msg{font-size:.8rem;line-height:1.45;color:var(--c-text-dimmer,#cbd5e1);white-space:pre-line;margin:0 0 1rem}
        .apxdlg-input{width:100%;box-sizing:border-box;background:var(--c-surface2,#0f172a);border:1px solid var(--c-border,#334155);color:var(--c-text,#fff);
                border-radius:.4rem;padding:.5rem .65rem;font-size:.85rem;margin:-.4rem 0 1rem;font-family:inherit;outline:none}
        .apxdlg-input:focus{border-color:var(--c-blue-lt,#3b82f6)}
        .apxdlg-row{display:flex;gap:.5rem;justify-content:flex-end}
        .apxdlg-btn{border:1px solid transparent;border-radius:.4rem;padding:.45rem 1rem;font-size:.78rem;font-weight:800;cursor:pointer;font-family:inherit}
        .apxdlg-cancel{background:var(--c-border,#334155);color:var(--c-text-dimmer,#cbd5e1)}
        .apxdlg-cancel:hover{background:var(--c-border2,#475569)}
        .apxdlg-ok{background:var(--c-emerald,#059669);color:#fff}
        .apxdlg-ok:hover{filter:brightness(1.1)}
        .apxdlg-danger{background:var(--c-red,#dc2626);color:#fff}
        .apxdlg-danger:hover{filter:brightness(1.1)}
        @keyframes apxdlgFade{from{opacity:0}to{opacity:1}}
        @keyframes apxdlgPop{from{transform:scale(.96);opacity:0}to{transform:none;opacity:1}}`;
        document.head.appendChild(st);
    }

    // kind: 'alert' | 'confirm' | 'prompt'
    function open(kind, msg, opts) {
        opts = opts || {};
        injectStyles();
        return new Promise(resolve => {
            let back = document.createElement('div');
            back.className = 'apxdlg-back';
            back.setAttribute('data-apx-dialog', kind);
            let okCls = opts.danger ? 'apxdlg-danger' : 'apxdlg-ok';
            let okLabel = opts.okLabel || (kind === 'confirm' ? (opts.danger ? 'Delete' : 'OK') : 'OK');
            back.innerHTML = `<div class="apxdlg" role="dialog" aria-modal="true">
                ${opts.title ? `<div class="apxdlg-title">${esc(opts.title)}</div>` : ''}
                <div class="apxdlg-msg">${esc(msg)}</div>
                ${kind === 'prompt' ? `<input class="apxdlg-input" type="${opts.password ? 'password' : 'text'}" value="${esc(opts.defaultValue ?? '')}" placeholder="${esc(opts.placeholder || '')}">` : ''}
                <div class="apxdlg-row">
                    ${kind !== 'alert' ? `<button class="apxdlg-btn apxdlg-cancel" data-act="cancel">${esc(opts.cancelLabel || 'Cancel')}</button>` : ''}
                    <button class="apxdlg-btn ${okCls}" data-act="ok">${esc(okLabel)}</button>
                </div></div>`;
            let input = back.querySelector('.apxdlg-input');
            let done = (ok) => {
                document.removeEventListener('keydown', onKey, true);
                back.remove();
                if (kind === 'alert') resolve();
                else if (kind === 'confirm') resolve(!!ok);
                else resolve(ok ? input.value : null);
            };
            let onKey = (e) => {
                if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); }
                else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); done(true); }
            };
            back.addEventListener('mousedown', e => { if (e.target === back && kind !== 'alert') done(false); });
            back.querySelector('[data-act="ok"]').onclick = () => done(true);
            let c = back.querySelector('[data-act="cancel"]'); if (c) c.onclick = () => done(false);
            document.addEventListener('keydown', onKey, true);
            document.body.appendChild(back);
            setTimeout(() => { if (input) { input.focus(); input.select(); } else back.querySelector('[data-act="ok"]').focus(); }, 20);
        });
    }

    // Make any fixed-position panel draggable by a handle (its header).
    // Buttons/inputs inside the handle still work normally. Stays on-screen.
    window.apxMakeDraggable = function(win, handle) {
        if (!win || !handle) return;
        handle.style.cursor = 'grab';
        handle.style.userSelect = 'none';
        handle.style.touchAction = 'none';
        handle.addEventListener('pointerdown', e => {
            if (e.button !== 0 || e.target.closest('button, input, select, textarea, a')) return;
            let r = win.getBoundingClientRect();
            let ox = e.clientX - r.left, oy = e.clientY - r.top;
            win.style.left = r.left + 'px'; win.style.top = r.top + 'px'; win.style.right = 'auto'; win.style.bottom = 'auto';
            handle.setPointerCapture(e.pointerId);
            handle.style.cursor = 'grabbing';
            let move = ev => {
                let x = Math.max(0, Math.min(window.innerWidth - 60, ev.clientX - ox));
                let y = Math.max(0, Math.min(window.innerHeight - 30, ev.clientY - oy));
                win.style.left = x + 'px'; win.style.top = y + 'px';
            };
            let up = () => { handle.style.cursor = 'grab'; handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', up); };
            handle.addEventListener('pointermove', move);
            handle.addEventListener('pointerup', up);
            handle.addEventListener('pointercancel', up);
            e.preventDefault();
        });
    };

    // A small themed form: fields = [{ key, label, type: 'number'|'text'|'select'|'checkbox'|'note', value, options: [[value, label]], min, max, hint }]
    // → resolves to { key: value, … } (numbers as numbers, checkboxes as true/false), or null when cancelled.
    window.apxForm = function(title, fields, opts) {
        opts = opts || {};
        injectStyles();
        return new Promise(resolve => {
            let back = document.createElement('div');
            back.className = 'apxdlg-back';
            back.setAttribute('data-apx-dialog', 'form');
            let row = f => {
                let lab = `<div style="font-size:.7rem;font-weight:800;color:var(--c-text-dimmer,#cbd5e1);margin-bottom:.2rem">${esc(f.label || '')}</div>`;
                let hint = f.hint ? `<div style="font-size:.64rem;color:var(--c-text-muted,#94a3b8);margin-top:.15rem;line-height:1.35">${esc(f.hint)}</div>` : '';
                if (f.type === 'note') return `<div style="font-size:.72rem;line-height:1.4;color:var(--c-text-dimmer,#cbd5e1);margin:0 0 .6rem">${esc(f.label || '')}</div>`;
                if (f.type === 'checkbox') return `<label style="display:flex;gap:.45rem;align-items:flex-start;margin:0 0 .6rem;cursor:pointer"><input type="checkbox" data-k="${esc(f.key)}" ${f.value ? 'checked' : ''} style="margin-top:.15rem"><span><span style="font-size:.74rem;font-weight:700;color:var(--c-text,#fff)">${esc(f.label || '')}</span>${hint}</span></label>`;
                if (f.type === 'select') return `<div style="margin:0 0 .6rem">${lab}<select data-k="${esc(f.key)}" class="apxdlg-input" style="margin:0">${(f.options || []).map(o => { let v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o; return `<option value="${esc(v)}" ${String(v) === String(f.value) ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select>${hint}</div>`;
                return `<div style="margin:0 0 .6rem">${lab}<input data-k="${esc(f.key)}" type="${f.type === 'number' ? 'number' : 'text'}" class="apxdlg-input" style="margin:0" value="${esc(f.value ?? '')}" ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''} placeholder="${esc(f.placeholder || '')}">${hint}</div>`;
            };
            back.innerHTML = `<div class="apxdlg" role="dialog" aria-modal="true" style="width:min(${opts.width || 400}px,100%)">
                ${title ? `<div class="apxdlg-title">${esc(title)}</div>` : ''}
                ${opts.text ? `<div class="apxdlg-msg" style="margin-bottom:.7rem">${esc(opts.text)}</div>` : ''}
                ${(fields || []).map(row).join('')}
                <div class="apxdlg-row" style="margin-top:.3rem">
                    <button class="apxdlg-btn apxdlg-cancel" data-act="cancel">${esc(opts.cancelLabel || 'Cancel')}</button>
                    <button class="apxdlg-btn ${opts.danger ? 'apxdlg-danger' : 'apxdlg-ok'}" data-act="ok">${esc(opts.okLabel || 'OK')}</button>
                </div></div>`;
            let done = ok => {
                document.removeEventListener('keydown', onKey, true);
                let out = null;
                if (ok) {
                    out = {};
                    (fields || []).forEach(f => {
                        if (!f.key) return;
                        let el = back.querySelector(`[data-k="${CSS.escape(f.key)}"]`); if (!el) return;
                        out[f.key] = f.type === 'checkbox' ? el.checked : f.type === 'number' ? (el.value === '' ? null : Number(el.value)) : el.value;
                    });
                }
                back.remove();
                resolve(out);
            };
            let onKey = e => {
                if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); }
                else if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); e.stopPropagation(); done(true); }
            };
            back.addEventListener('mousedown', e => { if (e.target === back) done(false); });
            back.querySelector('[data-act="ok"]').onclick = () => done(true);
            back.querySelector('[data-act="cancel"]').onclick = () => done(false);
            document.addEventListener('keydown', onKey, true);
            document.body.appendChild(back);
            setTimeout(() => { let f = back.querySelector('input:not([type=checkbox]),select'); if (f) { f.focus(); if (f.select) f.select(); } }, 20);
        });
    };

    // Image windows take the picture's own shape (no forced square, nothing cut off).
    // win._ratio (height / width) is kept so resizing keeps the same shape.
    window.apxAspectFit = function(win, area, src) {
        if (!win || !area || !src) return;
        let im = new Image();
        im.onload = () => {
            let r = im.naturalHeight / Math.max(1, im.naturalWidth);
            win._ratio = r;
            let w = parseFloat(area.style.width) || area.offsetWidth || 260;
            let maxH = window.innerHeight * 0.78, maxW = window.innerWidth * 0.9;
            if (w * r > maxH) w = Math.max(140, maxH / r);
            w = Math.min(w, maxW);
            win.style.width = Math.round(w) + 'px'; area.style.width = Math.round(w) + 'px'; area.style.height = Math.round(w * r) + 'px';
            area.querySelectorAll('img').forEach(i => { i.style.objectFit = 'contain'; });
            let rect = win.getBoundingClientRect();
            if (rect.bottom > window.innerHeight - 8) win.style.top = Math.max(8, window.innerHeight - rect.height - 8) + 'px';
        };
        im.src = src;
    };

    window.apxInjectDialogStyles = injectStyles;
    // Alerts are notifications: they go to the Dice and Notifications tray (which opens so
    // it's seen). apxAlertDialog still shows a real dialog where one is needed.
    window.apxAlertDialog = (msg, opts) => open('alert', msg, opts);
    window.apxAlert   = (msg, opts) => {
        if (window.APXDice && window.APXDice.notify) {
            opts = opts || {};
            window.APXDice.notify((opts.title ? opts.title + ': ' : '') + String(msg ?? ''), { kind: opts.kind || 'note', open: opts.open !== false });
            return Promise.resolve();
        }
        return open('alert', msg, opts);
    };
    window.apxConfirm = (msg, opts) => open('confirm', msg, opts);
    window.apxPrompt  = (msg, defaultValue, opts) => open('prompt', msg, Object.assign({ defaultValue }, opts || {}));

    // Any leftover alert() becomes a themed, non-blocking box
    window.alert = (msg) => { window.apxAlert(msg); };

    // ── One stacking order for every floating window ─────────────────────
    // Map windows, stat blocks, area / NPC popups and the dice tray all share it: whichever you last
    // opened, clicked or dragged is on top. (Dialogs that need an answer, the tutorial and the sign-in
    // notice always stay above all of them.) apxFront(el) puts el on top; apxFront(null) just hands
    // out the next layer.
    const FRONT_BASE = 2147483010, FRONT_MAX = 2147483250;
    window.apxFront = function (el) {
        let z = Math.max((window._apxPopZ || FRONT_BASE) + 1, FRONT_BASE);
        if (z > FRONT_MAX) {
            // Out of room: renumber everything in its current order, from the bottom
            let els = [...document.querySelectorAll('[data-apx-front]')].filter(e => e !== el)
                .sort((a, b) => (parseInt(a.style.zIndex) || 0) - (parseInt(b.style.zIndex) || 0));
            z = FRONT_BASE;
            els.forEach(e => { e.style.zIndex = ++z; });
            z++;
        }
        window._apxPopZ = z;
        if (el && el.dataset && el.dataset.apxMin) { restoreMin(el); if (el._apxTab) el._apxTab.remove(); }   // minimized: bring it back
        if (el) { el.setAttribute('data-apx-front', ''); el.style.zIndex = z; }
        return z;
    };
    // Which element is "the window" a click landed in: a fixed panel that isn't a full-screen
    // backdrop or a must-answer dialog
    function floatingOf(t) {
        for (let n = t; n && n !== document.body; n = n.parentElement) {
            if (n.parentElement !== document.body && !(n.parentElement && n.parentElement.id === 'floatingWindowContainer')) continue;
            if (n.classList.contains('apxd-fab') || n.classList.contains('modal-overlay')) return null;
            let cs = getComputedStyle(n);
            if (cs.position !== 'fixed') return null;
            let z = parseInt(cs.zIndex) || 0;
            if (z < 1500 || z > 2147483300) return null;
            let r = n.getBoundingClientRect();
            if (r.width >= innerWidth - 2 && r.height >= innerHeight - 2) return null;   // a backdrop
            return n;
        }
        return null;
    }
    // (after the window's own handlers, which may set a z-index of their own)
    document.addEventListener('mousedown', e => { let w = floatingOf(e.target); if (w) setTimeout(() => window.apxFront(w), 0); }, true);
    document.addEventListener('touchstart', e => { let w = floatingOf(e.target); if (w) setTimeout(() => window.apxFront(w), 0); }, { capture: true, passive: true });
    // ── Tabs: double-click a window's title bar to minimize it ───────────
    // It becomes a tab along the bottom of the screen; click the tab to bring it back (in front).
    function tabBar() {
        let b = document.getElementById('apxTabBar');
        if (!b) {
            b = document.createElement('div');
            b.id = 'apxTabBar';
            b.style.cssText = 'position:fixed;left:8px;bottom:8px;right:84px;display:flex;flex-wrap:wrap-reverse;gap:4px;z-index:2147483260;pointer-events:none';
            document.body.appendChild(b);
        }
        return b;
    }
    // Minimized windows stay laid out (hidden, not display:none), so maps and canvases inside keep
    // their size and live updates; bringing one back nudges anything that sizes itself to redraw
    function restoreMin(w) {
        w.style.visibility = w.dataset.apxMinVis || ''; w.style.pointerEvents = w.dataset.apxMinPe || '';
        delete w.dataset.apxMin; delete w.dataset.apxMinVis; delete w.dataset.apxMinPe;
        setTimeout(() => { try { window.dispatchEvent(new Event('resize')); } catch (e) { } }, 0);
    }
    // A tab's name: what the window calls itself (a map's or Area Circle's name), else its title,
    // never the buttons and boxes that share the title bar ("Revealed + − Reset Fog…", "Edit")
    function titleOf(w) {
        let clean = t => String(t || '').replace(/\s+/g, ' ').trim();
        try { if (typeof w._apxTitle === 'function') { let t = clean(w._apxTitle()); if (t) return t; } } catch (e) { }
        if (clean(w.dataset.apxTitle)) return clean(w.dataset.apxTitle);
        let hdr = w.firstElementChild; if (!hdr) return w.id || 'Window';
        let marked = hdr.querySelector('[data-win-title], .apx-pw-pop-title');
        if (marked && clean(marked.textContent)) return clean(marked.textContent);
        let c = hdr.cloneNode(true);
        c.querySelectorAll('button, input, select, textarea, img, svg, canvas, label, [data-tab-skip]').forEach(n => n.remove());
        let walk = document.createTreeWalker(c, NodeFilter.SHOW_TEXT), n;
        while ((n = walk.nextNode())) { let t = clean(n.textContent); if (t.length > 1) return t; }
        return clean(c.textContent) || w.id || 'Window';
    }
    function minimize(w) {
        if (!w || w.style.display === 'none' || w.dataset.apxMin) return;
        let title = titleOf(w).slice(0, 40) || 'Window';
        w.dataset.apxMin = '1';
        w.dataset.apxMinVis = w.style.visibility || ''; w.dataset.apxMinPe = w.style.pointerEvents || '';
        w.style.visibility = 'hidden'; w.style.pointerEvents = 'none';
        let t = document.createElement('button');
        t.textContent = title;
        t.title = 'Bring it back';
        t.style.cssText = 'pointer-events:auto;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.7rem;font-weight:800;padding:.3rem .6rem;border-radius:.4rem .4rem 0 0;border:1px solid var(--c-border2,#475569);background:var(--c-surface,#1e293b);color:var(--c-text,#fff);box-shadow:0 4px 14px rgba(0,0,0,.5);cursor:pointer';
        t.onclick = () => { t.remove(); restoreMin(w); window.apxFront(w); };
        // the window closing for good takes its tab with it
        let mo = new MutationObserver(() => { if (!w.isConnected) { t.remove(); mo.disconnect(); } });
        mo.observe(w.parentNode || document.body, { childList: true });
        w._apxTab = t;
        tabBar().appendChild(t);
    }
    window.apxMinimizeWindow = minimize;
    document.addEventListener('dblclick', e => {
        if (e.target.closest('button, input, select, textarea, a, [contenteditable="true"]')) return;
        let w = floatingOf(e.target); if (!w) return;
        let hdr = w.firstElementChild;
        if (!hdr || !hdr.contains(e.target)) return;   // only the title bar (the top strip)
        e.preventDefault();
        minimize(w);
    }, true);

    // A window that just opened goes on top too
    let watchNew = () => new MutationObserver(list => list.forEach(m => m.addedNodes.forEach(n => {
        if (n.nodeType !== 1) return;
        setTimeout(() => { if (n.isConnected && floatingOf(n) === n && !n.classList.contains('apxd-tray')) window.apxFront(n); }, 0);
    }))).observe(document.body, { childList: true });
    if (document.body) watchNew(); else document.addEventListener('DOMContentLoaded', watchNew);
})();

// ── Tactician (INT perk) choices: shared by the player's sheet and the GM's "choose for them" ──
// o: { rank: 1 | 5, who, order: [{ id, name, faction, surprised, me }] }
// done({ a, b }) for Rank 1 (swap a and b), done({ ally }) for Rank 5, done(null) to pass.
window.apxTacticianDialog = function (o, done) {
    let esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    if (window.apxInjectDialogStyles) window.apxInjectDialogStyles();
    document.querySelectorAll('[data-apx-tactician]').forEach(n => n.remove());
    let back = document.createElement('div');
    back.className = 'apxdlg-back'; back.setAttribute('data-apx-tactician', o.rank);
    let isAlly = r => r.faction === 'player' || r.faction === 'ally';
    let facCol = { player: '#60a5fa', ally: '#4ade80', enemy: '#f87171', neutral: '#cbd5e1' };
    let facLbl = { player: 'Player', ally: 'Ally', enemy: 'Enemy', neutral: 'Neutral' };
    let row = (r, i, inputs) => `<div style="display:flex;align-items:center;gap:.5rem;padding:.3rem .45rem;border:1px solid var(--c-border,#334155);border-radius:.4rem;margin-bottom:.25rem;background:var(--c-surface2,#0f172a)">
        <span style="width:1.3rem;text-align:right;font-size:.7rem;color:var(--c-text-dimmer,#94a3b8);font-weight:800">${i + 1}.</span>
        <span style="flex:1;min-width:0;font-size:.78rem;font-weight:700;color:var(--c-text,#e2e8f0)">${esc(r.name)}${r.me ? ' <span style="font-size:.62rem;color:#a78bfa">(you)</span>' : ''}
            <span style="font-size:.6rem;font-weight:800;color:${facCol[r.faction] || '#cbd5e1'};margin-left:.25rem">${facLbl[r.faction] || ''}</span>
            ${r.surprised ? '<span style="font-size:.58rem;font-weight:800;color:#fbbf24;border:1px solid #b45309;border-radius:.25rem;padding:0 .25rem;margin-left:.25rem">Surprised</span>' : ''}</span>
        ${inputs}</div>`;
    let order = o.order || [];
    let body;
    if (o.rank === 5) {
        let allies = order.filter(r => isAlly(r) && !r.me);
        body = `<div class="apxdlg-title">Tactician: skip your turn?</div>
            <div class="apxdlg-msg" style="margin-bottom:.6rem">Once this combat, you can skip your turn to give an ally a full turn right now. Afterward, initiative carries on from the creature after you.</div>
            ${allies.length ? allies.map((r, i) => row(r, order.indexOf(r), `<input type="radio" name="apxTac5" value="${esc(r.id)}" ${i === 0 ? 'checked' : ''} aria-label="Give ${esc(r.name)} a turn">`)).join('')
                : '<div class="apxdlg-msg">No allies to give a turn to.</div>'}
            <div class="apxdlg-row" style="margin-top:.7rem"><button class="apxdlg-btn apxdlg-cancel" data-tac-pass>Keep my turn</button>
                ${allies.length ? '<button class="apxdlg-btn apxdlg-ok" data-tac-ok>Give them my turn</button>' : ''}</div>`;
    } else {
        body = `<div class="apxdlg-title">Tactician: swap initiative places</div>
            <div class="apxdlg-msg" style="margin-bottom:.6rem">${o.who ? esc(o.who) + ', c' : 'C'}hoose an ally and the creature they trade places with in the initiative order. The ally is no longer Surprised.</div>
            <div style="display:flex;justify-content:flex-end;gap:.9rem;font-size:.6rem;font-weight:800;color:var(--c-text-dimmer,#94a3b8);padding:0 .55rem .15rem">
                <span>Ally</span><span>Swap with</span></div>
            ${order.map((r, i) => row(r, i, `<input type="radio" name="apxTacA" value="${esc(r.id)}" ${isAlly(r) ? '' : 'disabled'} aria-label="Ally: ${esc(r.name)}" style="margin-right:.85rem">
                <input type="radio" name="apxTacB" value="${esc(r.id)}" aria-label="Swap with ${esc(r.name)}" style="margin-right:1.1rem">`)).join('')}
            <div data-tac-err style="font-size:.7rem;color:#f87171;min-height:1rem;margin-top:.2rem"></div>
            <div class="apxdlg-row" style="margin-top:.4rem"><button class="apxdlg-btn apxdlg-cancel" data-tac-pass>Don't swap</button>
                <button class="apxdlg-btn apxdlg-ok" data-tac-ok>Swap</button></div>`;
    }
    back.innerHTML = `<div class="apxdlg" style="width:min(460px,100%);max-height:85vh;overflow:auto">${body}</div>`;
    document.body.appendChild(back);
    let finish = v => { back.remove(); try { done && done(v); } catch (e) { console.warn('Tactician:', e); } };
    back.querySelector('[data-tac-pass]').onclick = () => finish(null);
    let ok = back.querySelector('[data-tac-ok]');
    if (ok) ok.onclick = () => {
        if (o.rank === 5) { let r = back.querySelector('input[name="apxTac5"]:checked'); if (r) finish({ ally: r.value }); return; }
        let a = back.querySelector('input[name="apxTacA"]:checked'), b = back.querySelector('input[name="apxTacB"]:checked');
        let err = back.querySelector('[data-tac-err]');
        if (!a || !b) { err.textContent = 'Pick an ally and who they swap with.'; return; }
        if (a.value === b.value) { err.textContent = 'Pick two different creatures.'; return; }
        finish({ a: a.value, b: b.value });
    };
    return back;
};
