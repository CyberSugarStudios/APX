// ============================================================
// APX Your Summons (character sheet)
// ============================================================
// A floating panel for the creatures your powers summoned, while they're in your GM's fight: each one's HP,
// Temp HP, AP, AC, Speed and Conditions (from your GM's tracker), which one is on turn, and its attacks to
// roll. Its rolls go to your dice tray and your GM's, and its AP comes off the GM's tracker. On its turn you
// move its token on your battle map like your own (its AP pays for the moves).
// Data: window._pwCombatTurn.summons[yourUid] = [{ id, name, hp, maxHp, temp, ap, apMax, ac, speed, conds, down, atks, img }]
// ============================================================
(function () {
    'use strict';
    const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    let closedSig = null;   // closed by hand: stays closed until a new creature is summoned

    function mine() {
        let ct = window._pwCombatTurn, me = window.apxAuth && window.apxAuth.user && window.apxAuth.user.uid;
        return ct && ct.id && !ct.ended && me && ct.summons ? (ct.summons[me] || []) : [];
    }
    function sigOf(list) { return list.map(x => x.id).sort().join(','); }

    function rowHtml(s, onTurn) {
        let hpPct = s.maxHp > 0 ? Math.max(0, Math.min(100, (s.hp || 0) / s.maxHp * 100)) : 0;
        let hpCol = hpPct > 50 ? '#059669' : hpPct > 20 ? '#d97706' : '#dc2626';
        let pips = Array.from({ length: Math.max(s.apMax || 3, s.ap || 0) }, (_, i) => `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:2px;background:${i < (s.ap || 0) ? '#3b82f6' : '#1e293b'};border:1px solid #60a5fa"></span>`).join('');
        let atks = (s.atks || []).map(a => {
            let attr = window.APXDice ? ` data-apx-roll='${window.APXDice.attr({ type: 'attack', who: s.name, label: a.label, bonus: a.bonus || 0, dice: a.dice, dmgType: a.dmgType || '', critMult: a.critMult || 2, apCost: a.ap || 3, summonInit: s.id, perks: false, gambleAllowed: false, hit: { weapon: a.label, props: a.props || [] } })}'` : '';
            return `<button type="button" data-sum-atk="${esc(s.id)}"${attr} title="Roll ${esc(a.label)}: attack + damage (${a.ap || 3} AP from its tracker)" style="font-size:.62rem;font-weight:800;padding:.12rem .4rem;border-radius:.25rem;border:1px solid #7c3aed;background:#2e1065;color:#ede9fe;cursor:pointer;margin:.15rem .2rem 0 0">${esc(a.label)} ${a.bonus >= 0 ? '+' : ''}${a.bonus} · ${esc(a.dice)}${a.dmgType ? ' ' + esc(a.dmgType) : ''} · ${a.ap || 3} AP</button>`;
        }).join('');
        return `<div data-sum-row="${esc(s.id)}" style="border:1px solid ${onTurn ? '#22c55e' : '#334155'};background:${onTurn ? 'rgba(20,83,45,.35)' : '#0f172a'};border-radius:.45rem;padding:.4rem .5rem;margin-bottom:.4rem;${s.down ? 'opacity:.55' : ''}">
            <div style="display:flex;align-items:center;gap:.45rem">
                ${s.img ? `<img src="${esc(s.img)}" alt="" style="width:30px;height:30px;border-radius:50%;object-fit:cover;border:1px solid #475569">` : ''}
                <div style="flex:1;min-width:0">
                    <div style="font-size:.78rem;font-weight:900;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(s.name)}${onTurn ? ' <span style="font-size:.58rem;color:#86efac">· its turn (move it on your map)</span>' : ''}${s.down ? ' <span style="font-size:.58rem;color:#fca5a5">· down</span>' : ''}</div>
                    <div style="font-size:.6rem;color:#94a3b8">AC ${s.ac ?? '?'} · Speed ${s.speed ?? 3}</div>
                </div>
            </div>
            <div style="margin-top:.3rem">
                <div style="display:flex;justify-content:space-between;font-size:.6rem;color:#cbd5e1"><span>HP</span><span>${s.hp ?? '?'} / ${s.maxHp ?? '?'}${s.temp ? ` (+${s.temp} temp)` : ''}</span></div>
                <div style="height:6px;background:#1e293b;border-radius:3px;overflow:hidden"><div style="height:100%;width:${hpPct}%;background:${hpCol}"></div></div>
            </div>
            <div style="margin-top:.3rem;font-size:.6rem;color:#cbd5e1;display:flex;align-items:center;gap:.3rem">AP ${pips}<span style="color:#94a3b8">${s.ap || 0}/${s.apMax || 3}</span></div>
            ${(s.conds || []).length ? `<div style="margin-top:.25rem;display:flex;flex-wrap:wrap;gap:.2rem">${s.conds.map(c => `<span style="font-size:.56rem;font-weight:800;padding:0 .3rem;border-radius:.25rem;background:#7f1d1d;color:#fecaca">${esc(c)}</span>`).join('')}</div>` : ''}
            ${atks ? `<div style="margin-top:.2rem">${atks}</div>` : ''}
        </div>`;
    }

    window.apxSummonsRefresh = function (force) {
        let list = mine(), win = document.getElementById('apxSummonsWin');
        if (!list.length) { if (win) win.remove(); closedSig = null; return; }
        let sig = sigOf(list);
        if (!win && !force && closedSig === sig) return;   // (you closed it: a new summon opens it again)
        if (!win) {
            win = document.createElement('div');
            win.id = 'apxSummonsWin';
            win.style.cssText = 'position:fixed;right:16px;top:120px;width:min(300px,calc(100vw - 32px));max-height:70vh;display:flex;flex-direction:column;background:#020617;border:1px solid #7c3aed;border-radius:.6rem;box-shadow:0 10px 40px rgba(0,0,0,.6);z-index:2147483020';
            win.innerHTML = `<div data-sum-hdr style="display:flex;align-items:center;justify-content:space-between;padding:.35rem .6rem;background:#2e1065;border-radius:.6rem .6rem 0 0;cursor:move">
                    <span style="font-size:.72rem;font-weight:900;color:#ede9fe">Your Summons</span>
                    <button type="button" data-sum-close title="Close (it opens again when you summon another creature; Your Summons in Powers reopens it)" style="background:none;border:0;color:#c4b5fd;font-weight:900;cursor:pointer">✕</button></div>
                <div data-sum-body class="apx-dice-scope" style="overflow-y:auto;padding:.45rem"></div>`;
            document.body.appendChild(win);
            if (window.apxMakeDraggable) window.apxMakeDraggable(win, win.querySelector('[data-sum-hdr]'));
            win.querySelector('[data-sum-close]').onclick = () => { closedSig = sigOf(mine()); win.remove(); };
            if (window.apxFront) window.apxFront(win);
        }
        let ct = window._pwCombatTurn || {}, turnId = ct.summonTurn && ct.summonTurn.uid === (window.apxAuth?.user?.uid) ? ct.summonTurn.entryId : null;
        win.querySelector('[data-sum-body]').innerHTML = list.map(s => rowHtml(s, s.id === turnId)).join('');
    };
    window.apxOpenSummonsPanel = function () {
        if (!mine().length) { window.APXDice?.notify('You have no summoned creatures in your GM\'s fight right now.', { kind: 'note' }); return; }
        closedSig = null; window.apxSummonsRefresh(true);
    };
    // (the GM's tracker publishes the fight every few seconds; this also catches a fight that ended)
    setInterval(() => { try { window.apxSummonsRefresh(); } catch (e) { } }, 2000);
})();
