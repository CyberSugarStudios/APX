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
        document.getElementById('apxRestToast')?.remove();
        let t = document.createElement('div');
        t.id = 'apxRestToast';
        t.textContent = msg;
        t.style.cssText = 'position:fixed;bottom:4.5rem;left:50%;transform:translateX(-50%);z-index:99999;background:#1e1b4b;color:#c7d2fe;font-size:0.78rem;font-weight:800;padding:0.55rem 1.1rem;border-radius:0.5rem;border:1px solid #6366f1;pointer-events:none;max-width:90vw;text-align:center;';
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 5000);
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
        refresh();
        return { rolled, healed: s.currentHp - before };
    }

    // ── Short Rest ───────────────────────────────────────────────
    window.apxShortRest = function () {
        if (!needHp()) return;
        let log = [];
        let back = panel('Short Rest', '');
        let draw = () => {
            let s = st(), mh = maxHp(), dice = s.restDice || 0, cm = conMod();
            back.querySelector('[data-body]').innerHTML = `
                <div class="apxdlg-msg" style="margin-bottom:.6rem">Spend Rest Dice one at a time. Each heals <b>${dieStep()} ${cm >= 0 ? '+' : '−'} ${Math.abs(cm)}</b> (CON)${wellRested() ? ', rolled twice keeping the higher (Well Rested)' : ''}. Spent dice come back on a Full Rest.</div>
                <div style="display:flex;gap:.5rem;margin-bottom:.6rem">
                    <div style="flex:1;border:1px solid var(--c-border);background:var(--c-surface2);border-radius:.45rem;padding:.45rem;text-align:center">
                        <div style="font-size:.6rem;font-weight:800;text-transform:uppercase;color:var(--c-text-muted)">HP</div>
                        <div style="font-size:1.2rem;font-weight:900;color:var(--c-emerald-lt,#6ee7b7)">${s.currentHp}<span style="font-size:.75rem;color:var(--c-text-muted)"> / ${mh}</span></div></div>
                    <div style="flex:1;border:1px solid var(--c-border);background:var(--c-surface2);border-radius:.45rem;padding:.45rem;text-align:center">
                        <div style="font-size:.6rem;font-weight:800;text-transform:uppercase;color:var(--c-text-muted)">Rest Dice</div>
                        <div style="font-size:1.2rem;font-weight:900;color:var(--c-text)">${dice}<span style="font-size:.75rem;color:var(--c-text-muted)"> ${dieStep()}</span></div></div>
                </div>
                ${log.length ? `<div style="font-size:.7rem;color:var(--c-text-dimmer);margin-bottom:.6rem;max-height:110px;overflow-y:auto">${log.map(l => `<div>${esc(l)}</div>`).join('')}</div>` : ''}
                <div class="apxdlg-row" style="flex-wrap:wrap">
                    <button class="apxdlg-btn apxdlg-cancel" data-cancel>Cancel</button>
                    <button class="apxdlg-btn apxdlg-ok" data-spend ${dice <= 0 || s.currentHp >= mh ? 'disabled style="opacity:.45;cursor:default"' : ''}>${dice <= 0 ? 'No Rest Dice left' : s.currentHp >= mh ? 'HP is full' : 'Spend a Rest Die'}</button>
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
                if (r) log.push(`Rest Die: rolled ${r.rolled} → healed ${r.healed} HP`);
                draw();
            };
            back.querySelector('[data-finish]').onclick = () => {
                let s = st();
                let chaBack = (s.usedPowerSlots && s.usedPowerSlots.CHA) || 0;
                if (s.usedPowerSlots) s.usedPowerSlots.CHA = 0;
                refresh();
                back.remove();
                let spent = log.length;
                toast(`Short Rest done${spent ? `: ${spent} Rest Di${spent > 1 ? 'ce' : 'e'} spent` : ''}${chaBack ? `, ${chaBack} CHA Power use${chaBack > 1 ? 's' : ''} restored` : ''}.`);
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
            s.companion ? `Companion: full HP, power slots and charges` : null,
            omenRank ? (unusedOmen ? `Omen Dice: you still have ${unusedOmen}. Keep them or roll new ones` : `New Omen Dice rolled`) : null,
            (s.perks || {}).luc_highroller >= 5 ? `High Roller: Exploding Dice ready again` : null
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
            s2.apUsed = 0;
            if (s2.companion) {
                if (s2.companion.usedPowerSlots) Object.keys(s2.companion.usedPowerSlots).forEach(k => s2.companion.usedPowerSlots[k] = 0);
                s2.companion.powerChargesUsed = {};
                try { let sb = window.companionStatBlock && window.companionStatBlock(); if (sb && sb.maxHp) s2.companion.currentHp = sb.maxHp; } catch (e) { }
            }
            if (window.APXDice) window.APXDice.onFullRest({ keepOmen });
            refresh();
            back.remove();
            toast('Full Rest done: HP full, Rest Dice, Power Slots and Luck restored.');
        });
    };

    // ── Regenerative (ancestry trait) ────────────────────────────
    // "At the beginning of your turn in combat you can expend a Rest Die, rolling it,
    //  and healing for an amount equal to the result."
    window.apxRegenerate = function () {
        let s = st();
        if ((s.restDice || 0) <= 0) { window.apxAlert('No Rest Dice left to expend.', { title: 'Regenerative' }); return; }
        let r = spendRestDie('Regenerative', false);
        if (r) toast(`Regenerative: healed ${r.healed} HP (1 Rest Die spent).`);
    };
    // Show the Regen button only for characters with the trait
    let _orig = window.apxRenderApPips;
    window.apxRenderApPips = function () {
        if (_orig) _orig();
        let b = document.getElementById('regenBtn');
        if (b) b.classList.toggle('hidden', !((st().ancestry?.traits || []).includes('t_reg')));
    };
})();
