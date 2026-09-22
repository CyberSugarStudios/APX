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

    window.apxAlert   = (msg, opts) => open('alert', msg, opts);
    window.apxConfirm = (msg, opts) => open('confirm', msg, opts);
    window.apxPrompt  = (msg, defaultValue, opts) => open('prompt', msg, Object.assign({ defaultValue }, opts || {}));

    // Any leftover alert() becomes a themed, non-blocking box
    window.alert = (msg) => { window.apxAlert(msg); };
})();
