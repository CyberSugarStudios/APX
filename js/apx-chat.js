// ============================================================
// APX World Chat (bottom of the Dice and Notifications tray)
// ============================================================
// Players and the GM of a world can message everyone (GM included), just the GM, or any player or
// group of players. Messages live in worldCodes/{code}/chat (see FIREBASE_RULES.txt v2026.10.1):
// a message is only readable by the people it was sent to, plus the world's GM.
//
// Works on both pages:
//   Character Sheet: the world of the open character (window.apxActiveWorldCode)
//   GM Tools:        the loaded world (window.apxGmActiveWorld().inviteCode)
// ============================================================
(function () {
    'use strict';
    const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const isGmPage = () => /gmtools/i.test(location.pathname);
    const KEEP_DAYS = 7;
    const chat = { el: null, code: null, unsub: null, msgs: [], to: ['all'], gmUid: null, err: null, seenT: 0, open: true, pruned: {} };
    try { chat.open = localStorage.getItem('apxChatOpen') !== '0'; } catch (e) { }

    function myUid() { return window.apxAuth?.enabled && window.apxAuth.user ? window.apxAuth.user.uid : null; }
    function worldCode() {
        if (isGmPage()) { let w = window.apxGmActiveWorld ? window.apxGmActiveWorld() : null; return w && w.inviteCode ? String(w.inviteCode).toUpperCase().trim() : null; }
        let c = window.apxActiveWorldCode ? window.apxActiveWorldCode() : null;
        return c ? String(c).toUpperCase().trim() : null;
    }
    function myName() {
        if (isGmPage()) return 'GM';
        return (window.state && window.state.name) || window.apxAuth?.user?.displayName || 'Player';
    }
    // The other people in this world you can message: [{ uid, name }]
    function people() {
        let me = myUid(), out = [];
        if (isGmPage()) {
            (window.gmParty || []).forEach(p => {
                if (!p || !p.fileName || p.fileName === me || p.isCompanion) return;
                if (p.world && String(p.world).toUpperCase().trim() !== chat.code) return;
                out.push({ uid: p.fileName, name: p.summary?.name || 'Player' });
            });
        } else {
            (window.apxGiveTargets ? window.apxGiveTargets() : []).forEach(p => out.push({ uid: p.uid, name: p.name }));
        }
        let seen = new Set();
        return out.filter(p => !seen.has(p.uid) && seen.add(p.uid));
    }
    function nameOf(uid) {
        if (uid === myUid()) return 'you';
        if (uid && uid === chat.gmUid) return 'GM';
        let p = people().find(x => x.uid === uid);
        if (p) return p.name;
        let m = chat.msgs.slice().reverse().find(x => x.from === uid);
        return m ? m.fromName : 'a player';
    }

    function css() {
        if (document.getElementById('apxChatCss')) return;
        let st = document.createElement('style');
        st.id = 'apxChatCss';
        st.textContent = `
        .apxc{border-top:1px solid var(--c-border,#334155);background:var(--c-surface2,#0f172a);border-radius:0 0 .75rem .75rem;display:flex;flex-direction:column}
        .apxc-hd{display:flex;align-items:center;gap:.35rem;padding:.35rem .6rem;cursor:pointer;user-select:none}
        .apxc-hd b{font-size:.74rem;font-weight:900;flex:1}
        .apxc-hd .n{font-size:.6rem;font-weight:900;background:#ef4444;color:#fff;border-radius:.6rem;padding:0 .35rem;display:none}
        .apxc-hd .car{font-size:.65rem;color:var(--c-text-muted,#94a3b8)}
        .apxc-hd button{background:none;border:none;color:var(--c-text-muted,#94a3b8);font-size:.6rem;font-weight:800;cursor:pointer;padding:0 .2rem}
        .apxc-body{display:flex;flex-direction:column;gap:.3rem;padding:0 .6rem .5rem}
        .apxc-list{max-height:150px;min-height:40px;overflow-y:auto;display:flex;flex-direction:column;gap:.25rem;padding:.2rem 0}
        .apxc-m{font-size:.72rem;line-height:1.3;padding:.25rem .45rem;border-radius:.45rem;background:var(--c-surface,#1e293b);border:1px solid var(--c-border,#334155);max-width:92%;align-self:flex-start;word-break:break-word}
        .apxc-m.mine{align-self:flex-end;border-color:var(--c-indigo,#4f46e5)}
        .apxc-m.priv{border-style:dashed;border-color:#a855f7}
        .apxc-m .who{font-size:.6rem;font-weight:900;color:var(--c-indigo-lt,#a5b4fc);margin-right:.25rem}
        .apxc-m .to{font-size:.58rem;color:var(--c-text-muted,#94a3b8)}
        .apxc-m .tm{font-size:.56rem;color:var(--c-text-muted,#64748b);margin-left:.3rem}
        .apxc-empty{font-size:.66rem;color:var(--c-text-muted,#64748b);text-align:center;padding:.4rem}
        .apxc-to{display:flex;flex-wrap:wrap;gap:.2rem;align-items:center}
        .apxc-to span{font-size:.6rem;font-weight:800;color:var(--c-text-muted,#94a3b8);margin-right:.1rem}
        .apxc-to button{font-size:.62rem;font-weight:800;padding:.08rem .4rem;border-radius:.6rem;border:1px solid var(--c-border2,#475569);background:none;color:var(--c-text-dimmer,#cbd5e1);cursor:pointer}
        .apxc-to button.on{background:var(--c-indigo,#4f46e5);border-color:var(--c-indigo,#4f46e5);color:#fff}
        .apxc-in{display:flex;gap:.3rem}
        .apxc-in input{flex:1;min-width:0;background:var(--c-surface,#1e293b);border:1px solid var(--c-border,#334155);color:var(--c-text,#fff);font-size:.74rem;padding:.3rem .45rem;border-radius:.35rem}
        .apxc-in button{background:var(--c-emerald,#059669);border:none;color:#fff;font-size:.7rem;font-weight:900;padding:.25rem .65rem;border-radius:.35rem;cursor:pointer}
        .apxc-in button:disabled{opacity:.4;cursor:default}
        .apxc-note{font-size:.64rem;color:var(--c-text-muted,#94a3b8);line-height:1.35}
        .apxc-note.err{color:#fca5a5}
        [data-theme="kawaii"] .apxc-m .who{color:#7c3aed}
        [data-theme="kawaii"] .apxc-to button.on,[data-theme="kawaii"] .apxc-in button{color:#fff}`;
        document.head.appendChild(st);
    }

    function mount() {
        let tray = document.querySelector('.apxd-tray');
        if (!tray || (chat.el && tray.contains(chat.el))) return !!tray;
        css();
        let el = document.createElement('div');
        el.className = 'apxc';
        el.innerHTML = `<div class="apxc-hd" data-tog title="Show or hide the chat"><b>Chat</b><span class="n" data-n></span>
                ${isGmPage() ? '<button data-clearchat title="Delete every message in this world\'s chat">Clear chat</button>' : ''}<span class="car" data-car></span></div>
            <div class="apxc-body" data-body>
                <div class="apxc-list" data-list></div>
                <div class="apxc-to" data-to></div>
                <div class="apxc-in"><input data-text maxlength="1000" placeholder="Message…"><button data-send>Send</button></div>
                <div class="apxc-note" data-note style="display:none"></div>
            </div>`;
        tray.appendChild(el);
        chat.el = el;
        el.querySelector('[data-tog]').onclick = e => {
            if (e.target.closest('[data-clearchat]')) return;
            chat.open = !chat.open;
            try { localStorage.setItem('apxChatOpen', chat.open ? '1' : '0'); } catch (er) { }
            render();
        };
        let cl = el.querySelector('[data-clearchat]');
        if (cl) cl.onclick = clearAll;
        let input = el.querySelector('[data-text]');
        input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
        el.querySelector('[data-send]').onclick = send;
        if (isGmPage()) el.querySelector('[data-list]').addEventListener('contextmenu', e => {
            let m = e.target.closest('[data-mid]'); if (!m || !m.dataset.mid) return;
            e.preventDefault(); deleteOne(m.dataset.mid);
        });
        render();
        return true;
    }

    function toLabel(m) {
        if (!m.to || m.to.includes('all')) return '';
        let names = m.to.filter(u => u !== m.from).map(u => u === chat.gmUid ? 'GM' : nameOf(u));
        return names.length ? 'to ' + names.join(', ') : '';
    }
    function time(t) { try { return new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } }

    function renderTo() {
        let box = chat.el?.querySelector('[data-to]'); if (!box) return;
        let ppl = people();
        // Drop anyone who left
        chat.to = chat.to.filter(u => u === 'all' || u === 'gm' || ppl.some(p => p.uid === u));
        if (!chat.to.length) chat.to = ['all'];
        let on = k => chat.to.includes(k) ? 'on' : '';
        let btns = [`<button data-r="all" class="${on('all')}" title="Everyone in the world, GM included">All</button>`];
        if (!isGmPage()) btns.push(`<button data-r="gm" class="${on('gm')}" title="Only the GM">GM</button>`);
        ppl.forEach(p => btns.push(`<button data-r="${esc(p.uid)}" class="${on(p.uid)}" title="Only ${esc(p.name)} (pick several for a group)">${esc(p.name)}</button>`));
        box.innerHTML = '<span>To:</span>' + btns.join('');
        box.querySelectorAll('[data-r]').forEach(b => b.onclick = () => {
            let r = b.dataset.r;
            if (r === 'all') chat.to = ['all'];
            else {
                let cur = chat.to.filter(x => x !== 'all');
                chat.to = cur.includes(r) ? cur.filter(x => x !== r) : cur.concat([r]);
                if (!chat.to.length) chat.to = ['all'];
            }
            renderTo();
        });
    }

    function render() {
        if (!chat.el) return;
        let body = chat.el.querySelector('[data-body]');
        body.style.display = chat.open ? '' : 'none';
        chat.el.querySelector('[data-car]').textContent = chat.open ? '▾' : '▸';
        let me = myUid();
        let list = chat.el.querySelector('[data-list]'), note = chat.el.querySelector('[data-note]');
        let input = chat.el.querySelector('[data-text]'), sendBtn = chat.el.querySelector('[data-send]');
        let cl = chat.el.querySelector('[data-clearchat]'); if (cl) cl.style.display = chat.code && chat.msgs.length ? '' : 'none';
        let ready = !!(chat.code && me && !chat.err);
        input.disabled = sendBtn.disabled = !ready;
        chat.el.querySelector('[data-to]').style.display = ready ? '' : 'none';
        note.style.display = 'none'; note.className = 'apxc-note';
        if (!me) { list.innerHTML = '<div class="apxc-empty">Sign in to chat.</div>'; }
        else if (!chat.code) { list.innerHTML = `<div class="apxc-empty">${isGmPage() ? 'Load a world to chat with its players.' : 'Join a world (and open a character in it) to chat with your party and GM.'}</div>`; }
        else {
            let shown = chat.msgs.slice(-150);
            list.innerHTML = shown.length ? shown.map(m => {
                let mine = m.from === me, priv = m.to && !m.to.includes('all'), tl = toLabel(m);
                return `<div class="apxc-m${mine ? ' mine' : ''}${priv ? ' priv' : ''}" data-mid="${esc(m.id || '')}"${isGmPage() ? ' title="Right-click to delete"' : ''}><span class="who">${esc(mine ? 'You' : (m.gm ? 'GM' : m.fromName || 'Player'))}</span>${tl ? `<span class="to">${esc(tl)}</span>` : ''}<span class="tm">${esc(time(m.t))}</span><div>${esc(m.text)}</div></div>`;
            }).join('') : '<div class="apxc-empty">No messages yet.</div>';
            list.scrollTop = list.scrollHeight;
            renderTo();
        }
        if (chat.err) {
            note.style.display = ''; note.className = 'apxc-note err';
            note.textContent = /permission/i.test(chat.err) ? 'Chat is waiting on the updated Firestore rules (FIREBASE_RULES.txt, v2026.10.1). Whoever runs this site needs to publish them in the Firebase console.' : 'Chat could not connect: ' + chat.err;
        }
        // Unread count (messages from others since you last looked at the open chat)
        let trayOpen = document.querySelector('.apxd-tray')?.classList.contains('open');
        if (trayOpen && chat.open) chat.seenT = Math.max(chat.seenT, ...chat.msgs.map(m => m.t || 0), 0);
        let unread = chat.msgs.filter(m => m.from !== me && (m.t || 0) > chat.seenT).length;
        let n = chat.el.querySelector('[data-n]'); n.textContent = unread; n.style.display = unread ? 'inline-block' : 'none';
    }

    async function send() {
        let input = chat.el?.querySelector('[data-text]');
        let text = (input?.value || '').trim();
        if (!text || !chat.code || !myUid() || typeof window.apxAuth?.sendChat !== 'function') return;
        let me = myUid(), to;
        if (chat.to.includes('all')) to = ['all'];
        else {
            to = chat.to.map(u => u === 'gm' ? chat.gmUid : u).filter(Boolean);
            if (chat.to.includes('gm') && !chat.gmUid) { window.APXDice?.notify('Still looking up your GM. Try again in a moment.', { kind: 'warn' }); return; }
            to.push(me);
            to = [...new Set(to)];
        }
        input.value = '';
        try { await window.apxAuth.sendChat(chat.code, { fromName: myName(), to, text, gm: isGmPage() }); }
        catch (e) { input.value = text; chat.err = e.message || String(e); render(); }
    }

    // The GM can delete any one message (right-click it): it's gone for everyone
    async function deleteOne(id) {
        if (!id || !chat.code || !isGmPage() || typeof window.apxAuth?.deleteChat !== 'function') return;
        let m = chat.msgs.find(x => x.id === id); if (!m) return;
        let preview = String(m.text || '').slice(0, 80) + (String(m.text || '').length > 80 ? '…' : '');
        let ok = window.apxConfirm ? await window.apxConfirm(`Delete this message for everyone?\n\n"${preview}"`, { title: 'Delete Message', okLabel: 'Delete', danger: true }) : confirm('Delete this message?');
        if (!ok) return;
        try { await window.apxAuth.deleteChat(chat.code, [id]); chat.msgs = chat.msgs.filter(x => x.id !== id); render(); }
        catch (e) { window.APXDice?.notify('Could not delete the message: ' + e.message, { kind: 'warn' }); }
    }
    async function clearAll() {
        if (!chat.code || !chat.msgs.length) return;
        let ok = window.apxConfirm ? await window.apxConfirm('Delete every message in this world\'s chat, for everyone?', { title: 'Clear Chat', okLabel: 'Delete', danger: true }) : confirm('Delete every chat message?');
        if (!ok) return;
        try { await window.apxAuth.deleteChat(chat.code, chat.msgs.map(m => m.id)); } catch (e) { window.APXDice?.notify('Could not clear the chat: ' + e.message, { kind: 'warn' }); }
    }

    function lookupGm(code) {
        let w = window._playerWorldData;
        if (w && w.gmUid) { chat.gmUid = w.gmUid; return; }
        if (isGmPage()) { chat.gmUid = myUid(); return; }
        try {
            window._apxDb?.collection('worldCodes').doc(code).get().then(d => { if (chat.code === code && d.exists) { chat.gmUid = d.data().gmUid || null; render(); } }).catch(() => { });
        } catch (e) { }
    }

    function subscribe() {
        let code = myUid() ? worldCode() : null;
        if (code === chat.code) return;
        if (chat.unsub) { try { chat.unsub(); } catch (e) { } chat.unsub = null; }
        chat.code = code; chat.msgs = []; chat.err = null; chat.gmUid = null; chat.to = ['all'];
        try { chat.seenT = parseInt(localStorage.getItem('apxChatSeen_' + code)) || 0; } catch (e) { chat.seenT = 0; }
        if (code && typeof window.apxAuth?.listenChat === 'function') {
            lookupGm(code);
            let first = true;
            chat.unsub = window.apxAuth.listenChat(code, isGmPage(), list => {
                let me = myUid();
                let fresh = !first && list.filter(m => m.from !== me && !chat.msgs.some(x => x.id === m.id));
                chat.msgs = list; chat.err = null;
                // The GM tidies up messages older than a week
                if (isGmPage() && first && !chat.pruned[code]) {
                    chat.pruned[code] = true;
                    let old = list.filter(m => (m.t || 0) < Date.now() - KEEP_DAYS * 86400000).map(m => m.id);
                    if (old.length) window.apxAuth.deleteChat(code, old).catch(() => { });
                }
                first = false;
                // Asks for a Luck Point (and their answers) ride in the chat: js/apx-luck.js
                if (!isGmPage()) { try { window.apxLuckOnChat?.(list); } catch (e) { console.warn('Luck asks:', e); } }
                if (fresh && fresh.length) {
                    let trayOpen = document.querySelector('.apxd-tray')?.classList.contains('open');
                    if (!trayOpen || !chat.open) document.querySelector('.apxd-fab')?.classList.add('unseen');
                }
                render();
            }, err => { chat.err = err.message || String(err); render(); });
        }
        render();
    }

    // Keep the seen marker per world
    function saveSeen() { if (chat.code) try { localStorage.setItem('apxChatSeen_' + chat.code, String(chat.seenT)); } catch (e) { } }

    let lastPeople = '';
    setInterval(() => {
        if (!mount()) return;
        subscribe();
        let sig = people().map(p => p.uid + p.name).join('|') + (chat.gmUid || '');
        if (sig !== lastPeople) { lastPeople = sig; render(); }
        let trayOpen = document.querySelector('.apxd-tray')?.classList.contains('open');
        if (trayOpen && chat.open && chat.msgs.some(m => m.from !== myUid() && (m.t || 0) > chat.seenT)) { render(); saveSeen(); }
    }, 1500);
    window.apxChat = { refresh: () => { subscribe(); render(); } };
})();
