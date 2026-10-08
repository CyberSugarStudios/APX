// ============================================================
// APX: asking the party for a Luck Point
// ============================================================
// A player with no Luck Points left can ask on any of their d20 rolls (the dice tray's "Ask for a Luck
// Point"). Allies in the same world who have a Luck Point get a prompt; the FIRST to spend one pays it, and
// the asker's d20 is rerolled. The ask and the answer travel in the world chat (js/apx-firebase.js askLuck /
// claimLuck): an answer is a chat message with a fixed id that can only ever be created once, so when two
// allies click at the same moment only one of them is charged and the other is told someone beat them to it.
// ============================================================
(function () {
    'use strict';

    const ASK_FOR = 3 * 60 * 1000;   // an ask stays open for 3 minutes
    const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const myUid = () => window.apxAuth?.user?.uid || null;
    const code = () => {
        let c = window.apxActiveWorldCode ? window.apxActiveWorldCode() : null;
        return (c && window._pwBattleCode === c && window.apxAuth?.enabled && window.apxAuth?.user) ? c : null;
    };
    const myName = () => (window.state && window.state.name) || 'A party member';
    const asks = {};        // my open asks: reqId -> { rollId, label, at, to }
    const handled = new Set();   // reqIds this sheet has finished with (answered, dismissed or applied)

    // Allies in this world who have a Luck Point to spare
    window.apxLuckAllies = function () {
        if (!code() || !window.APXBattle?.party) return [];
        let me = myUid(), world = window._playerWorldData || {};
        let gone = new Set([...(world.kicked || []), ...(world.banned || [])]);
        return window.APXBattle.party().filter(p => p && p.uid && p.uid !== me && p.name && !gone.has(p.uid) && (p.luckPts || 0) > 0)
            .map(p => ({ uid: p.uid, name: p.name, luckPts: p.luckPts || 0 }));
    };

    // Ask (from a dice tray card). Returns the ask's id, or null when nobody can answer.
    window.apxAskLuck = function (roll) {
        let c = code(), allies = window.apxLuckAllies();
        if (!c || !allies.length) { window.APXDice?.notify('Nobody in your world has a Luck Point to spare right now.', { kind: 'warn', open: true }); return null; }
        let reqId = 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        let label = String(roll.label || 'a roll');
        asks[reqId] = { rollId: roll.rollId, label, at: Date.now(), to: allies.map(a => a.uid) };
        let text = `🍀 ${myName()} is out of Luck Points and asks for one to reroll ${label}${roll.nat ? ` (natural ${roll.nat})` : ''}.`;
        window.apxAuth.askLuck(c, { reqId, rollId: roll.rollId, label, fromName: myName(), to: [myUid()].concat(allies.map(a => a.uid)), text })
            .then(() => window.APXDice?.notify(`You asked ${allies.map(a => a.name).join(', ')} for a Luck Point. The first to answer spends one, and your roll is rerolled.`, { kind: 'note' }))
            .catch(e => { delete asks[reqId]; window.APXDice?.clearLuckAsk?.(roll.rollId); window.APXDice?.notify('Could not ask: ' + e.message, { kind: 'warn', open: true }); });
        // Nobody answered in time: the button comes back
        setTimeout(() => { if (asks[reqId] && !handled.has(reqId)) { delete asks[reqId]; window.APXDice?.clearLuckAsk?.(roll.rollId); } }, ASK_FOR);
        return reqId;
    };

    // ── The prompt allies see ──
    function box() {
        let b = document.getElementById('apxLuckAsks');
        if (!b) {
            b = document.createElement('div'); b.id = 'apxLuckAsks';
            b.style.cssText = 'position:fixed;right:16px;bottom:84px;z-index:9500;display:flex;flex-direction:column;gap:8px;max-width:min(320px,calc(100vw - 32px))';
            document.body.appendChild(b);
        }
        return b;
    }
    function dropPrompt(reqId) { document.querySelector(`#apxLuckAsks [data-req="${reqId}"]`)?.remove(); }
    function showPrompt(m) {
        if (document.querySelector(`#apxLuckAsks [data-req="${m.reqId}"]`)) return;
        let st = window.state, have = (st && st.luckPts) || 0;
        if (have <= 0) return;   // nothing to give
        let el = document.createElement('div');
        el.setAttribute('data-req', m.reqId);
        el.style.cssText = 'background:#0f172a;border:1px solid #22c55e;border-radius:.6rem;padding:.6rem .7rem;color:#e2e8f0;box-shadow:0 10px 30px rgba(0,0,0,.55);font:600 12px system-ui,sans-serif';
        el.innerHTML = `<div style="font-weight:900;color:#86efac;margin-bottom:.2rem">🍀 ${esc(m.fromName || 'An ally')} needs a Luck Point</div>
            <div style="color:#cbd5e1;line-height:1.35">Spend one of yours (you have ${have}) so they can reroll <b>${esc(m.label || 'their roll')}</b>? The first ally to answer pays it.</div>
            <div style="display:flex;gap:.4rem;justify-content:flex-end;margin-top:.5rem">
                <button data-no style="background:transparent;border:1px solid #475569;color:#cbd5e1;border-radius:.35rem;padding:.25rem .6rem;font-weight:800;cursor:pointer">Not now</button>
                <button data-yes style="background:#15803d;border:1px solid #22c55e;color:#fff;border-radius:.35rem;padding:.25rem .7rem;font-weight:900;cursor:pointer">Spend 1 Luck Point</button></div>`;
        el.querySelector('[data-no]').onclick = () => { handled.add(m.reqId); el.remove(); };
        el.querySelector('[data-yes]').onclick = async () => {
            let yes = el.querySelector('[data-yes]'); if (yes.disabled) return;
            let st2 = window.state;
            if (!st2 || (st2.luckPts || 0) <= 0) { el.remove(); window.APXDice?.notify('You have no Luck Points left to give.', { kind: 'warn' }); return; }
            yes.disabled = true; yes.textContent = 'Spending…';
            let c = code(), won = false;
            try {
                won = await window.apxAuth.claimLuck(c, { reqId: m.reqId, asker: m.from, rollId: m.rollId, fromName: myName(),
                    to: [m.from, myUid()].concat((m.to || []).filter(u => u !== myUid() && u !== m.from)),
                    text: `🍀 ${myName()} spends a Luck Point: ${m.fromName || 'their ally'} rerolls ${m.label || 'their roll'}.` });
            } catch (e) { yes.disabled = false; yes.textContent = 'Spend 1 Luck Point'; window.APXDice?.notify('Could not send it: ' + e.message, { kind: 'warn' }); return; }
            handled.add(m.reqId); el.remove();
            if (!won) { window.APXDice?.notify(`Someone else already spent a Luck Point for ${m.fromName || 'them'}: yours is kept.`, { kind: 'note' }); return; }
            // Only the ally whose answer got through pays
            st2.luckPts = Math.max(0, (st2.luckPts || 0) - 1);
            let li = document.getElementById('luckPtsInput'); if (li) li.value = st2.luckPts;
            window.recalculateMath?.(); window.scheduleAutoSave?.();
            window.APXDice?.notify(`You spent a Luck Point: ${m.fromName || 'your ally'} rerolls ${m.label || 'their roll'} (${st2.luckPts} left).`, { kind: 'note' });
        };
        box().appendChild(el);
        setTimeout(() => el.remove(), Math.max(1000, ASK_FOR - (Date.now() - (m.t || Date.now()))));
    }

    // Every world chat update (js/apx-chat.js): asks for me, and answers to anyone's ask
    window.apxLuckOnChat = function (list) {
        let me = myUid(); if (!me || !Array.isArray(list)) return;
        let now = Date.now();
        let gives = {};
        list.forEach(m => { if (m && m.kind === 'luckGive' && m.reqId) gives[m.reqId] = m; });
        // Answered: close the prompt; on my own ask, reroll
        Object.values(gives).forEach(g => {
            dropPrompt(g.reqId);
            if (g.asker === me && asks[g.reqId] && !handled.has(g.reqId)) {
                handled.add(g.reqId);
                let a = asks[g.reqId]; delete asks[g.reqId];
                if (!(window.APXDice && window.APXDice.applyAllyLuck(a.rollId, g.fromName)))
                    window.APXDice?.notify(`${g.fromName || 'An ally'} spent a Luck Point for you: reroll ${a.label} (that roll is no longer in your tray).`, { kind: 'note', open: true });
            }
        });
        // Open asks naming me
        list.forEach(m => {
            if (!m || m.kind !== 'luckReq' || !m.reqId || m.from === me || gives[m.reqId] || handled.has(m.reqId)) return;
            if (!(m.to || []).includes(me) || now - (m.t || 0) > ASK_FOR) return;
            showPrompt(m);
        });
    };
})();
