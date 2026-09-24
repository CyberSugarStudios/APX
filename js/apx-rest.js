// ============================================================
// APX Rests (character sheet)
// ============================================================
// Short Rest (1 hour, need at least 1 HP)
//   Spend any number of Rest Dice, one at a time: each heals the die roll + CON mod
//   (Well Rested: roll twice, keep the higher). Spent dice stay spent until a Full Rest.
//   CHA-based Power Slots come back.
// Full Rest (8 hours, need at least 1 HP)
//   All HP, -1 Fatigue, half your MAX Rest Dice back (rounded down, up to max), all Power
//   Slots (INT and CHA), Luck Points refilled, companion slots/charges/HP, High
//   Roller's Exploding Dice, and new Omen Dice (or keep unused ones).
// Recover (Shake it Off 1 AP / Shrug It Off 3 AP): once each per Short or Full Rest.
// Other perk features that recharge on rests are tracked by the player for now.
// ============================================================
(function () {
    'use strict';
    const st = () => window.state;
    const C = () => (typeof calc !== 'undefined' ? calc : {});
    function esc(t) { return String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
    function maxHp() { return C().maxHp || parseInt(document.getElementById('dispMaxHp')?.innerText) || st().currentHp || 0; }
    function conMod() { return (C().mods && C().mods.CON) || 0; }
    function dieStep() { return C().restDieStep || 'd6'; }
    function wellRested() { return ((st().perks || {}).gen_wellrested || 0) > 0; }
    function refresh() { window.recalculateMath(); window.apxRefreshHpInputs?.(); }

    function panel(title, bodyHtml, wide) {
        if (window.apxInjectDialogStyles) window.apxInjectDialogStyles();
        document.getElementById('apxRestPanel')?.remove();
        let back = document.createElement('div');
        back.id = 'apxRestPanel';
        back.className = 'apxdlg-back';
        back.innerHTML = `<div class="apxdlg" style="width:min(${wide || 420}px,100%)"><div class="apxdlg-title">${title}</div><div data-body>${bodyHtml}</div></div>`;
        document.body.appendChild(back);
        return back;
    }
    function needHp() {
        if ((st().currentHp || 0) >= 1) return true;
        window.apxAlert('You need at least 1 HP to begin a rest.', { title: 'Can\'t Rest' });
        return false;
    }
    function toast(msg) {
        if (window.APXDice && window.APXDice.notify) { window.APXDice.notify(msg, { kind: 'note' }); return; }
        document.getElementById('apxRestToast')?.remove();
        let t = document.createElement('div');
        t.id = 'apxRestToast';
        t.textContent = msg;
        t.style.cssText = 'position:fixed;bottom:4.5rem;left:50%;transform:translateX(-50%);z-index:99999;background:#1e1b4b;color:#c7d2fe;font-size:0.78rem;font-weight:800;padding:0.55rem 1.1rem;border-radius:0.5rem;border:1px solid #6366f1;pointer-events:none;max-width:90vw;text-align:center;';
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 5000);
    }

    // ── Loyal Companion ──────────────────────────────────────────
    // "Whenever you use a Rest Die, your Companion heals for the amount rolled plus their CON mod."
    function companionSb() {
        let s = st(); if (!s || !s.companion || !window.companionStatBlock) return null;
        try { if (typeof ncTarget !== 'undefined') ncTarget = 'companion'; return window.companionStatBlock(); } catch (e) { return null; }
    }
    function healCompanion(rawRolled, diceCount) {
        let s = st(), sb = companionSb();
        if (!sb || !s.companion) return '';
        let conMod = (sb.mods && sb.mods.CON) || 0;
        let amount = Math.max(0, rawRolled + conMod * (diceCount || 1));
        let before = s.companion.currentHp ?? sb.maxHp;
        s.companion.currentHp = Math.min(sb.maxHp, before + amount);
        let healed = s.companion.currentHp - before;
        return healed > 0 ? `${sb.name || 'Your companion'} healed ${healed} HP` : '';
    }
    window.apxCompanionRestHeal = healCompanion;
    // Rests restore the companion's power slots too (Short: if it casts with CHA; Full: all)
    function restoreCompanionSlots(fullRest) {
        let s = st(), c = s && s.companion; if (!c || !c.usedPowerSlots) return 0;
        let sb = companionSb();
        let attr = sb && sb.powerAttrChoice;
        if (!fullRest && attr !== 'CHA') return 0;
        let n = Object.values(c.usedPowerSlots).reduce((a, b) => a + (b || 0), 0);
        Object.keys(c.usedPowerSlots).forEach(k => c.usedPowerSlots[k] = 0);
        if (fullRest) c.powerChargesUsed = {};
        return n;
    }

    // Roll one Rest Die (+ bonus per die) in the dice tray and heal. Returns HP healed, or null.
    function spendRestDie(label, addCon) {
        let s = st();
        if ((s.restDice || 0) <= 0) return null;
        let flat = addCon ? conMod() : 0;
        let rolled = window.APXDice
            ? window.APXDice.rest({ label, who: s.name || '', dieStep: dieStep(), count: 1, flat, wellRested: wellRested() })
            : Math.floor(Math.random() * (parseInt(dieStep().slice(1)) || 6)) + 1 + flat;
        let heal = Math.max(0, rolled);
        let before = s.currentHp || 0;
        s.currentHp = Math.min(maxHp(), before + heal);
        s.restDice = (s.restDice || 0) - 1;
        let comp = healCompanion(rolled - flat, 1);
        refresh();
        return { rolled, healed: s.currentHp - before, comp };
    }

    // ── Short Rest ───────────────────────────────────────────────
    window.apxShortRest = function () {
        if (!needHp()) return;
        let log = [];
        let back = panel('Short Rest', '');
        let draw = () => {
            let s = st(), mh = maxHp(), dice = s.restDice || 0, cm = conMod();
            // The companion heals from your Rest Dice too, so you can keep spending while it's hurt
            let csb = companionSb();
            let compHp = csb ? (s.companion.currentHp ?? csb.maxHp) : null, compMax = csb ? csb.maxHp : null;
            let compHurt = csb && compHp < compMax;
            let canSpend = dice > 0 && (s.currentHp < mh || compHurt);
            let spendLabel = dice <= 0 ? 'No Rest Dice left' : !canSpend ? (csb ? 'Everyone is at full HP' : 'HP is full') : (s.currentHp >= mh ? `Spend a Rest Die (heals ${esc(csb.name || 'your companion')})` : 'Spend a Rest Die');
            back.querySelector('[data-body]').innerHTML = `
                <div class="apxdlg-msg" style="margin-bottom:.6rem">Spend Rest Dice one at a time. Each heals <b>${dieStep()} ${cm >= 0 ? '+' : '−'} ${Math.abs(cm)}</b> (CON)${wellRested() ? ', rolled twice keeping the higher (Well Rested)' : ''}.${s.companion ? ` ${esc(s.companion.name || 'Your companion')} heals the roll + its CON modifier too.` : ''} Spent dice come back on a Full Rest.</div>
                <div style="display:flex;gap:.5rem;margin-bottom:.6rem">
                    <div style="flex:1;border:1px solid var(--c-border);background:var(--c-surface2);border-radius:.45rem;padding:.45rem;text-align:center">
                        <div style="font-size:.6rem;font-weight:800;text-transform:uppercase;color:var(--c-text-muted)">HP</div>
                        <div style="font-size:1.2rem;font-weight:900;color:var(--c-emerald-lt,#6ee7b7)">${s.currentHp}<span style="font-size:.75rem;color:var(--c-text-muted)"> / ${mh}</span></div></div>
                    ${csb ? `<div style="flex:1;border:1px solid #16a34a;background:var(--c-surface2);border-radius:.45rem;padding:.45rem;text-align:center">
                        <div style="font-size:.6rem;font-weight:800;text-transform:uppercase;color:#86efac;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(csb.name || 'Companion')} HP</div>
                        <div style="font-size:1.2rem;font-weight:900;color:#bbf7d0">${compHp}<span style="font-size:.75rem;color:var(--c-text-muted)"> / ${compMax}</span></div></div>` : ''}
                    <div style="flex:1;border:1px solid var(--c-border);background:var(--c-surface2);border-radius:.45rem;padding:.45rem;text-align:center">
                        <div style="font-size:.6rem;font-weight:800;text-transform:uppercase;color:var(--c-text-muted)">Rest Dice</div>
                        <div style="font-size:1.2rem;font-weight:900;color:var(--c-text)">${dice}<span style="font-size:.75rem;color:var(--c-text-muted)"> ${dieStep()}</span></div></div>
                </div>
                ${log.length ? `<div style="font-size:.7rem;color:var(--c-text-dimmer);margin-bottom:.6rem;max-height:110px;overflow-y:auto">${log.map(l => `<div>${esc(l)}</div>`).join('')}</div>` : ''}
                <div class="apxdlg-row" style="flex-wrap:wrap">
                    <button class="apxdlg-btn apxdlg-cancel" data-cancel>Cancel</button>
                    <button class="apxdlg-btn apxdlg-ok" data-spend ${!canSpend ? 'disabled style="opacity:.45;cursor:default"' : ''}>${spendLabel}</button>
                    <button class="apxdlg-btn apxdlg-ok" data-finish style="background:var(--c-indigo,#4f46e5)">Finish Short Rest</button>
                </div>`;
            back.querySelector('[data-cancel]').onclick = () => {
                if (log.length) { window.apxAlert('Rest Dice already spent stay spent. Press "Finish Short Rest" to also get your CHA Power Slots back.', { title: 'Short Rest' }); return; }
                back.remove();
            };
            let sp = back.querySelector('[data-spend]');
            sp.onclick = () => {
                if (sp.disabled) return;
                let r = spendRestDie('Short Rest: Rest Die', true);
                if (r) log.push(`Rest Die: rolled ${r.rolled} → healed ${r.healed} HP${r.comp ? ` (${r.comp})` : ''}`);
                draw();
            };
            back.querySelector('[data-finish]').onclick = () => {
                let s = st();
                let chaBack = (s.usedPowerSlots && s.usedPowerSlots.CHA) || 0;
                if (s.usedPowerSlots) s.usedPowerSlots.CHA = 0;
                let recBack = recoverUsedList(s);
                s.recoverUsed = {};
                let compSlots = restoreCompanionSlots(false);
                refresh();
                back.remove();
                let spent = log.length;
                toast(`Short Rest done${spent ? `: ${spent} Rest Di${spent > 1 ? 'ce' : 'e'} spent` : ''}${chaBack ? `, ${chaBack} CHA Power use${chaBack > 1 ? 's' : ''} restored` : ''}${recBack ? `, ${recBack} ready again` : ''}${compSlots ? `, companion's CHA power slots restored` : ''}.`);
            };
        };
        draw();
    };

    // ── Full Rest ────────────────────────────────────────────────
    window.apxFullRest = async function () {
        if (!needHp()) return;
        let s = st(), c = C();
        let mh = maxHp();
        let maxDice = c.maxRestDice || s.restDice || 0;
        let spent = Math.max(0, maxDice - (s.restDice || 0));
        let diceBack = Math.min(spent, Math.floor(maxDice / 2));   // half of the max pool, rounded down
        let slotsUsed = Object.values(s.usedPowerSlots || {}).reduce((a, b) => a + (b || 0), 0);
        let maxLuck = c.maxLuck || Math.max(1, (c.mods && c.mods.LUC) || 0);
        let omenRank = (s.perks || {}).luc_omen || 0;
        let unusedOmen = (s.omenDice || []).length;
        let lines = [
            `HP back to full (${s.currentHp} → ${mh})`,
            s.fatigue > 0 ? `Fatigue ${s.fatigue} → ${s.fatigue - 1}` : null,
            `Rest Dice +${diceBack} (half your max of ${maxDice}, rounded down) → ${Math.min(maxDice, (s.restDice || 0) + diceBack)} / ${maxDice}`,
            slotsUsed ? `All Power Slots restored (${slotsUsed} used)` : 'Power Slots: all available',
            `Luck Points → ${maxLuck}`,
            s.companion ? `${s.companion.name || 'Companion'}: full HP, power slots and charges` : null,
            omenRank ? (unusedOmen ? `Omen Dice: you still have ${unusedOmen}. Keep them or roll new ones` : `New Omen Dice rolled`) : null,
            (s.perks || {}).luc_highroller >= 5 ? `High Roller: Exploding Dice ready again` : null,
            recoverUsedList(s) ? `Recover: ${recoverUsedList(s)} ready again` : null
        ].filter(Boolean);
        let back = panel('Full Rest', `<div class="apxdlg-msg" style="margin-bottom:.5rem">8 hours of rest (6 asleep). This will:</div>
            <ul style="margin:0 0 .8rem 1.1rem;padding:0;list-style:disc;font-size:.76rem;color:var(--c-text-dimmer);line-height:1.5">${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>
            <div class="apxdlg-msg" style="font-size:.68rem;margin-bottom:.8rem">Other perk features that recharge on a rest: update those yourself for now.</div>
            <div class="apxdlg-row" style="flex-wrap:wrap"><button class="apxdlg-btn apxdlg-cancel" data-cancel>Cancel</button>
                ${omenRank && unusedOmen ? `<button class="apxdlg-btn apxdlg-ok" data-go="keep" style="background:#6b21a8">Rest, keep Omen Dice</button><button class="apxdlg-btn apxdlg-ok" data-go="roll">Rest, roll new Omen Dice</button>`
                    : `<button class="apxdlg-btn apxdlg-ok" data-go="roll">Take Full Rest</button>`}</div>`, 440);
        back.querySelector('[data-cancel]').onclick = () => back.remove();
        back.querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
            let keepOmen = b.dataset.go === 'keep';
            let s2 = st();
            s2.currentHp = mh;
            if ((s2.fatigue || 0) > 0) s2.fatigue -= 1;
            s2.restDice = Math.min(maxDice, (s2.restDice || 0) + diceBack);
            if (s2.usedPowerSlots) Object.keys(s2.usedPowerSlots).forEach(k => s2.usedPowerSlots[k] = 0);
            s2.luckPts = maxLuck;
            s2.recoverUsed = {};
            s2.apCurrent = (typeof calc !== 'undefined' && calc.maxAp) || 6; delete s2.apUsed;
            if (s2.companion) {
                restoreCompanionSlots(true);
                try { let sb = window.companionStatBlock && window.companionStatBlock(); if (sb && sb.maxHp) s2.companion.currentHp = sb.maxHp; } catch (e) { }
            }
            if (window.APXDice) window.APXDice.onFullRest({ keepOmen });
            refresh();
            back.remove();
            toast('Full Rest done: HP full, Rest Dice, Power Slots and Luck restored.');
        });
    };

    // ── Rest button: Short or Full? ──────────────────────────────
    window.apxRestMenu = function () {
        let back = panel('Rest', `<div class="apxdlg-msg" style="margin-bottom:.8rem">Take a Short Rest or a Full Rest?</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.8rem">
                <button class="apxdlg-btn" data-r="short" style="padding:.7rem .5rem;background:var(--c-surface2,#0f172a);border:1px solid var(--c-emerald,#059669);color:var(--c-emerald-lt,#6ee7b7);text-align:left">
                    <div style="font-weight:900;font-size:.85rem">Short Rest</div><div style="font-size:.68rem;font-weight:600;color:var(--c-text-dimmer)">1 hour. Spend Rest Dice to heal (die + CON), CHA Power Slots and Recover come back.</div></button>
                <button class="apxdlg-btn" data-r="full" style="padding:.7rem .5rem;background:var(--c-surface2,#0f172a);border:1px solid var(--c-indigo,#4f46e5);color:var(--c-indigo-lt,#a5b4fc);text-align:left">
                    <div style="font-weight:900;font-size:.85rem">Full Rest</div><div style="font-size:.68rem;font-weight:600;color:var(--c-text-dimmer)">8 hours. Full HP, half your max Rest Dice, all Power Slots, Luck, Recover, −1 Fatigue.</div></button>
            </div>
            <div class="apxdlg-row"><button class="apxdlg-btn apxdlg-cancel" data-cancel>Cancel</button></div>`, 440);
        back.querySelector('[data-cancel]').onclick = () => back.remove();
        back.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { back.remove(); b.dataset.r === 'short' ? window.apxShortRest() : window.apxFullRest(); });
    };

    // ── Recover: Shake it Off / Shrug It Off ─────────────────────
    // Shake it Off (1 AP): roll up to half your max Rest Dice (rounded down), each + CON mod; heal that much.
    // Shrug It Off (3 AP): completely heal one Wounded limb of your choice.
    // Each once per Short or Full Rest.
    const RECOVER = { shake: { name: 'Shake it Off', ap: 1 }, shrug: { name: 'Shrug It Off', ap: 3 } };
    function recoverUsedList(s) {
        let u = (s || st()).recoverUsed || {};
        let names = Object.keys(RECOVER).filter(k => u[k]).map(k => RECOVER[k].name);
        return names.length ? names.join(' and ') : '';
    }
    window.apxRecoverMenu = function () {
        let s = st(), used = s.recoverUsed || {};
        let apHave = window.apxApCurrent ? window.apxApCurrent() : 0;
        let maxDice = C().maxRestDice || 0, dice = s.restDice || 0;
        let shakeMax = Math.min(Math.floor(maxDice / 2), dice);
        let limbs = s.woundedLimbs || [];
        let cm = conMod();
        let back = panel('Recover', '', 460);
        let draw = () => {
            let apNote = cost => apHave < cost ? `<span style="color:#fca5a5">Not enough AP (you have ${apHave})</span>` : `<span style="color:var(--c-text-muted)">You have ${apHave} AP</span>`;
            let shakeWhy = used.shake ? 'Already used. It comes back on a Short or Full Rest.'
                : shakeMax <= 0 ? (dice <= 0 ? 'No Rest Dice left.' : 'Your max Rest Dice is too low (half of it rounds down to 0).') : '';
            let shrugWhy = used.shrug ? 'Already used. It comes back on a Short or Full Rest.' : !limbs.length ? 'You have no Wounded limbs.' : '';
            back.querySelector('[data-body]').innerHTML = `
                <div class="apxdlg-msg" style="margin-bottom:.6rem">Shake it Off or Shrug It Off? Each can be used once per Short or Full Rest.</div>
                <div style="border:1px solid var(--c-border);background:var(--c-surface2);border-radius:.5rem;padding:.6rem;margin-bottom:.5rem;${shakeWhy ? 'opacity:.6' : ''}">
                    <div style="display:flex;align-items:baseline;gap:.4rem"><b style="font-size:.85rem">Shake it Off</b><span style="font-size:.7rem;font-weight:800;color:var(--c-indigo-lt,#a5b4fc)">1 AP</span><span style="margin-left:auto;font-size:.65rem">${apNote(1)}</span></div>
                    <div style="font-size:.72rem;color:var(--c-text-dimmer);margin:.2rem 0 .45rem">Roll up to half your max Rest Dice (rounded down) and add your CON modifier to each die. Regain that much HP. The Rest Dice rolled are spent.</div>
                    ${shakeWhy ? `<div style="font-size:.7rem;color:#fca5a5">${shakeWhy}</div>` : `
                    <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;font-size:.72rem">
                        Roll <select data-shake-n style="width:auto;background:var(--c-surface,#1e293b);color:inherit;border:1px solid var(--c-border2,#475569);border-radius:.3rem;font-size:.75rem;padding:.1rem .3rem">
                            ${Array.from({ length: shakeMax }, (_, i) => `<option value="${i + 1}" ${i + 1 === shakeMax ? 'selected' : ''}>${i + 1}</option>`).join('')}</select>
                        ${dieStep()} ${cm >= 0 ? '+' : '−'} ${Math.abs(cm)} each <span style="color:var(--c-text-muted)">(up to ${shakeMax}; ${dice} Rest Dice left)</span>
                        <button class="apxdlg-btn apxdlg-ok" data-go="shake" style="margin-left:auto">${apHave < 1 ? 'Use anyway' : 'Shake it Off'}</button></div>`}
                </div>
                <div style="border:1px solid var(--c-border);background:var(--c-surface2);border-radius:.5rem;padding:.6rem;margin-bottom:.8rem;${shrugWhy ? 'opacity:.6' : ''}">
                    <div style="display:flex;align-items:baseline;gap:.4rem"><b style="font-size:.85rem">Shrug It Off</b><span style="font-size:.7rem;font-weight:800;color:var(--c-indigo-lt,#a5b4fc)">3 AP</span><span style="margin-left:auto;font-size:.65rem">${apNote(3)}</span></div>
                    <div style="font-size:.72rem;color:var(--c-text-dimmer);margin:.2rem 0 .45rem">Completely heal one Wounded limb of your choice.</div>
                    ${shrugWhy ? `<div style="font-size:.7rem;color:#fca5a5">${shrugWhy}</div>` : `
                    <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;font-size:.72rem">
                        Heal <select data-shrug-limb style="width:auto;background:var(--c-surface,#1e293b);color:inherit;border:1px solid var(--c-border2,#475569);border-radius:.3rem;font-size:.75rem;padding:.1rem .3rem">
                            ${limbs.map(l => `<option value="${esc(l)}">${esc(l)}</option>`).join('')}</select>
                        <button class="apxdlg-btn apxdlg-ok" data-go="shrug" style="margin-left:auto">${apHave < 3 ? 'Use anyway' : 'Shrug It Off'}</button></div>`}
                </div>
                <div class="apxdlg-row"><button class="apxdlg-btn apxdlg-cancel" data-cancel>Close</button></div>`;
            back.querySelector('[data-cancel]').onclick = () => back.remove();
            back.querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
                let kind = b.dataset.go, cost = RECOVER[kind].ap;
                let paid = apHave >= cost;
                if (paid && window.apxSpendAp) window.apxSpendAp(cost);
                let s2 = st();
                s2.recoverUsed = Object.assign({}, s2.recoverUsed, { [kind]: true });
                let apTxt = paid ? `${cost} AP spent` : `not enough AP, none spent`;
                if (kind === 'shake') {
                    let n = Math.max(1, Math.min(shakeMax, parseInt(back.querySelector('[data-shake-n]').value) || 1));
                    let rolled = window.APXDice
                        ? window.APXDice.rest({ label: 'Recover: Shake it Off', who: s2.name || '', dieStep: dieStep(), count: n, flat: cm, note: apTxt })
                        : n * (Math.floor(Math.random() * (parseInt(dieStep().slice(1)) || 6)) + 1 + cm);
                    let heal = Math.max(0, rolled), before = s2.currentHp || 0;
                    s2.currentHp = Math.min(maxHp(), before + heal);
                    s2.restDice = Math.max(0, (s2.restDice || 0) - n);
                    let comp = healCompanion(rolled - cm * n, n);
                    refresh(); back.remove();
                    toast(`Shake it Off: rolled ${rolled}, healed ${s2.currentHp - before} HP (${n} Rest Di${n > 1 ? 'ce' : 'e'} spent, ${apTxt})${comp ? '. ' + comp : ''}.`);
                } else {
                    let limb = back.querySelector('[data-shrug-limb]').value;
                    s2.woundedLimbs = (s2.woundedLimbs || []).filter(l => l !== limb);
                    refresh(); back.remove();
                    toast(`Shrug It Off: ${limb} is no longer Wounded (${apTxt}).`);
                }
            });
        };
        draw();
    };

    // ── Burning: 1d10 Fire damage at the start of each of your turns (bypasses ER) ──
    // Called when your turn starts in the GM's initiative. Immune to Fire: no damage.
    window.apxBurnTick = function () {
        let s = st(); if (!s) return;
        let eff = (window.apxEffectiveConditions ? window.apxEffectiveConditions(s.conditions || [], s) : (s.conditions || []).map(id => ({ id }))).map(c => c.id);
        if (!eff.includes('burning')) return;
        let immune = (s.ancestryEnvResistances || []).some(e => e.type === 'Fire' && e.immune);
        if (immune) { window.APXDice?.notify('Burning: you\'re immune to Fire damage, so it deals nothing.', { kind: 'note' }); return; }
        let vuln = 5 * (s.ancestryEnvVulnerabilities || []).filter(e => e.type === 'Fire').length;
        let card = window.APXDice ? window.APXDice.damage({ label: 'Burning (start of your turn)', who: s.name || '', formula: '1d10', dmgType: 'Fire', perks: false }) : null;
        let rolled = card && card.parts && card.parts[0] ? card.parts[0].total : Math.floor(Math.random() * 10) + 1;
        let dmg = rolled + vuln;
        let r = window.apxApplyHpInput ? window.apxApplyHpInput('-' + dmg, s.currentHp, s.tempHp || 0, maxHp()) : null;
        if (r) { s.currentHp = r.currentHp; s.tempHp = r.tempHp; } else s.currentHp = Math.max(0, (s.currentHp || 0) - dmg);
        refresh();
        window.APXDice?.notify(`Burning: you took ${dmg} Fire damage${vuln ? ` (${rolled} + ${vuln} Fire Vulnerability)` : ''}, ignoring ER. Spend 3 AP to put it out (you or an adjacent ally).`, { kind: 'warn' });
        if (typeof window.apxOnRollEvent === 'function') window.apxOnRollEvent({ id: 'burn' + Date.now().toString(36), kind: 'burn', attr: '', label: 'Burning', nat: rolled, total: dmg, bonus: vuln, mode: 'normal', luck: false, omen: false });
    };

    // ── Regenerative (ancestry trait) ────────────────────────────
    // "At the beginning of your turn in combat you can expend a Rest Die, rolling it,
    //  and healing for an amount equal to the result."
    window.apxRegenerate = function () {
        let s = st();
        if ((s.restDice || 0) <= 0) { window.apxAlert('No Rest Dice left to expend.', { title: 'Regenerative' }); return; }
        let r = spendRestDie('Regenerative', false);
        if (r) toast(`Regenerative: healed ${r.healed} HP (1 Rest Die spent)${r.comp ? '. ' + r.comp : ''}.`);
    };
    // Show the Regen button only for characters with the trait
    let _orig = window.apxRenderApPips;
    window.apxRenderApPips = function () {
        if (_orig) _orig();
        let b = document.getElementById('regenBtn');
        if (b) b.classList.toggle('hidden', !((st().ancestry?.traits || []).includes('t_reg')));
    };
})();
