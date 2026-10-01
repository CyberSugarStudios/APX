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
})();
