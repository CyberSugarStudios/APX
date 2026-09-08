// ============================================================
// APX Character Sheet — Armor Crafting Wizard
// Single-screen forge: base armor is always present, every row in
// ARMOR_MODS (apx-data.js) is a repeatable +/- stepper. "Purchase"
// spends Currency for whatever hasn't been paid for yet, no roll
// needed. "Craft" spends Crafting Materials instead, is subject to
// a DC roll, and is perk-aware (Black Smith / Artisan discounts).
// Saving equips the result directly onto window.state.equippedArmor
// (there's only ever one suit equipped, so re-opening this modal on
// existing armor IS "Return to Forge").
// ============================================================

let armorForgeDraft = null;          // working copy being edited
let armorForgeOriginalMods = null;   // snapshot of mods at open time (for session delta)
let armorForgeBasePaid = 0;          // paidCost snapshot at time of opening
let armorForgeSpecialized = false;   // this session's "is this an Artisan specialization" answer
let armorForgeTarget = 'player';     // 'player', 'companion', or 'gm' -- who this session's armor belongs to

// Returns whichever equippedArmor object this session is targeting.
function getTargetArmor() {
    if (armorForgeTarget === 'gm') return ncActiveCompanion().equippedArmor;
    return armorForgeTarget === 'companion' ? window.state.companion.equippedArmor : window.state.equippedArmor;
}

window.armorForgeCalcTotals = function(draft) {
    let wt = ARMOR_BASE.wt, ac = ARMOR_BASE.ac, dr = ARMOR_BASE.dr, er = ARMOR_BASE.er;
    let stealth = 0, athletics = 0, speed = 0, cost = ARMOR_BASE.cost;
    ARMOR_MODS.forEach(m => {
        let qty = draft.mods[m.key] || 0;
        cost += qty * m.cost;
        wt += qty * (m.wt || 0);
        if (m.field === 'ac') ac += qty * m.amt;
        else if (m.field === 'dr') dr += qty * m.amt;
        else if (m.field === 'er') er += qty * m.amt;
        else if (m.field === 'stealth') stealth += qty * m.amt;
        else if (m.field === 'athletics') athletics += qty * m.amt;
        else if (m.field === 'speed') speed += qty * m.amt;
    });
    return { wt: Math.max(0, wt), ac, dr, er, stealth, athletics, speed, cost: Math.max(0, cost), rawCost: cost };
};

// ------------------------------------------------------------------
// Armor-specific helpers (perk/roll/material math now lives in
// apx-craft-shared.js, shared with the Weapon Forge)
// ------------------------------------------------------------------
function armorForgeEffectiveMax(m) {
    // Black Smith Rank 5 ignores the Maximum Purchases limit on +1 AC/DR/ER mods.
    let { bsRank } = craftPerkRanks();
    if (bsRank >= 5 && (m.field === 'ac' || m.field === 'dr' || m.field === 'er')) return null;
    return m.max;
}

// ------------------------------------------------------------------
// Open / reset / edit
// ------------------------------------------------------------------
window.openArmorForge = function(target) {
    armorForgeTarget = (target === 'companion' || target === 'gm') ? target : 'player';
    armorForgeDraft = JSON.parse(JSON.stringify(getTargetArmor()));
    armorForgeOriginalMods = { ...armorForgeDraft.mods };
    armorForgeBasePaid = armorForgeDraft.paidCost || 0;
    if (!armorForgeDraft.name) armorForgeDraft.name = "";
    document.getElementById('armorForgeName').value = armorForgeDraft.name;
    document.getElementById('armorBtnPurchase').classList.toggle('hidden', armorForgeTarget === 'gm');
    document.getElementById('armorBtnCraft').classList.toggle('hidden', armorForgeTarget === 'gm');
    document.getElementById('armorBtnGmAdd').classList.toggle('hidden', armorForgeTarget !== 'gm');
    window.renderArmorForge();
    window.openModal('armorForgeModal');
};

window.resetArmorForge = function() {
    window.showConfirm('Reset to a blank Base Armor? This clears every mod below (your equipped armor is not changed until you Purchase or Craft again).', () => {
        let name = armorForgeDraft.name;
        armorForgeDraft = JSON.parse(JSON.stringify(getInitialState().equippedArmor));
        armorForgeDraft.name = name;
        armorForgeOriginalMods = { ...armorForgeDraft.mods };
        armorForgeBasePaid = 0; // treat as a fresh item: nothing paid yet
        window.renderArmorForge();
    });
};

window.setArmorForgeName = function(val) {
    armorForgeDraft.name = val;
};

// Baseline Speed the character would have WITHOUT the currently-equipped
// armor's Speed penalty -- used to preview what a draft change would do.
function armorForgeSpeedBaseline() {
    return (calc.speed || 0) - (getTargetArmor().speedMod || 0);
}

window.setArmorModQty = function(key, delta) {
    let modDef = ARMOR_MODS.find(m => m.key === key);
    let cur = armorForgeDraft.mods[key] || 0;
    let next = cur + delta;
    if (next < 0) next = 0;

    let effMax = armorForgeEffectiveMax(modDef);
    if (effMax !== null && next > effMax) next = effMax;

    if (next > cur) {
        // Refund-cost mods can't be bought past the point where total
        // armor cost would go negative.
        if (modDef.cost < 0) {
            let projectedTotals = window.armorForgeCalcTotals({ mods: { ...armorForgeDraft.mods, [key]: next } });
            if (projectedTotals.rawCost < 0) next = cur;
        }
        // Speed can never be reduced to 0 or below by armor alone.
        if (modDef.field === 'speed') {
            let projectedTotals = window.armorForgeCalcTotals({ mods: { ...armorForgeDraft.mods, [key]: next } });
            if (armorForgeSpeedBaseline() + projectedTotals.speed <= 0) next = cur;
        }
    }

    armorForgeDraft.mods[key] = next;
    window.renderArmorForge();
};

window.renderArmorForge = function() {
    let totals = window.armorForgeCalcTotals(armorForgeDraft);
    let delta = Math.max(0, totals.cost - armorForgeBasePaid);
    let reqStr = Math.floor(totals.wt / 10);
    let speedBaseline = armorForgeSpeedBaseline();

    let rows = ARMOR_MODS.map(m => {
        let qty = armorForgeDraft.mods[m.key] || 0;
        let effMax = armorForgeEffectiveMax(m);
        let hitsMax = (effMax !== null && qty >= effMax);

        let wouldGoNegative = (m.cost < 0) && (totals.rawCost + m.cost < 0);

        let wouldZeroSpeed = false;
        if (m.field === 'speed') {
            let projected = window.armorForgeCalcTotals({ mods: { ...armorForgeDraft.mods, [m.key]: qty + 1 } });
            wouldZeroSpeed = (speedBaseline + projected.speed) <= 0;
        }

        let atMax = hitsMax || wouldGoNegative || wouldZeroSpeed;
        let subtotal = qty * m.cost;
        let capLabel = effMax !== null ? ` &middot; max ${effMax}` : (m.max !== null ? ` &middot; unlimited (Black Smith 5)` : '');
        return `
            <div class="flex items-center justify-between bg-slate-900 border border-slate-700 rounded px-3 py-2">
                <div class="flex-1 min-w-0">
                    <div class="text-xs font-bold text-slate-200">${m.label}</div>
                    <div class="text-[10px] text-slate-500">${m.cost >= 0 ? m.cost + ' Cu' : 'Refunds ' + Math.abs(m.cost) + ' Cu'} each${capLabel}</div>
                    ${wouldZeroSpeed ? '<div class="text-[9px] text-red-400 font-bold">Would reduce Speed to 0</div>' : ''}
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <button onclick="window.setArmorModQty('${m.key}', -1)" ${qty <= 0 ? 'disabled' : ''} class="w-6 h-6 shrink-0 rounded ${qty <= 0 ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600 text-white'} font-bold">-</button>
                    <span class="w-7 text-center font-bold text-sm text-white">${qty}</span>
                    <button onclick="window.setArmorModQty('${m.key}', 1)" ${atMax ? 'disabled' : ''} class="w-6 h-6 shrink-0 rounded ${atMax ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-amber-700 hover:bg-amber-600 text-white'} font-bold">+</button>
                    <span class="w-16 text-right text-[10px] ${subtotal !== 0 ? 'text-yellow-400' : 'text-slate-600'} font-bold">${subtotal} Cu</span>
                </div>
            </div>
        `;
    }).join('');

    let html = `
        <div class="text-[10px] text-slate-500 mb-3">Base Armor is always included: 10 lbs, +1 AC / +1 DR / +1 ER, 50 Currency.</div>
        <div class="grid grid-cols-1 sm:grid-cols-2 sm:grid-flow-col sm:grid-rows-5 gap-1.5 max-h-[45vh] overflow-y-auto pr-1">${rows}</div>

        <div class="grid grid-cols-4 gap-2 mt-4 bg-slate-900 border border-slate-700 rounded-lg p-3">
            <div class="text-center"><div class="text-[9px] text-slate-500 uppercase font-bold">Weight</div><div class="text-lg font-black text-white">${totals.wt}</div></div>
            <div class="text-center"><div class="text-[9px] text-slate-500 uppercase font-bold">AC / DR / ER</div><div class="text-lg font-black text-white">+${totals.ac}/+${totals.dr}/+${totals.er}</div></div>
            <div class="text-center"><div class="text-[9px] text-slate-500 uppercase font-bold">Stealth / Athl.</div><div class="text-lg font-black text-white">${totals.stealth >= 0 ? '+' : ''}${totals.stealth} / ${totals.athletics >= 0 ? '+' : ''}${totals.athletics}</div></div>
            <div class="text-center"><div class="text-[9px] text-slate-500 uppercase font-bold">Speed Mod</div><div class="text-lg font-black text-white">${totals.speed} <span class="text-[9px] text-slate-500">(→ ${Math.max(0, speedBaseline + totals.speed)})</span></div></div>
        </div>
        <div class="text-[10px] text-slate-500 mt-2 text-center">STR requirement to avoid penalties: <span class="font-bold text-slate-300">${reqStr}</span> (based on total weight)</div>

        <div class="flex justify-between items-center mt-4 bg-slate-900 border border-amber-800/50 rounded-lg p-3">
            <div>
                <div class="text-[10px] text-slate-500 uppercase font-bold">Total Item Cost</div>
                <div class="text-xl font-black text-yellow-400">${totals.cost} Cu</div>
            </div>
            <div class="text-right">
                <div class="text-[10px] text-slate-500 uppercase font-bold">Already Paid For</div>
                <div class="text-sm font-bold text-slate-400">${armorForgeBasePaid} Cu</div>
            </div>
            <div class="text-right">
                <div class="text-[10px] text-slate-500 uppercase font-bold">Cost Now</div>
                <div class="text-xl font-black ${delta > 0 ? 'text-emerald-400' : 'text-slate-500'}">${delta} Cu</div>
            </div>
        </div>
    `;
    document.getElementById('armorForgeBody').innerHTML = html;
};

// ------------------------------------------------------------------
// Session delta: which mod keys were increased / decreased this visit
// ------------------------------------------------------------------
function armorForgeSessionDelta() {
    let increased = {}, decreased = {};
    ARMOR_MODS.forEach(m => {
        let origQty = armorForgeOriginalMods[m.key] || 0;
        let curQty = armorForgeDraft.mods[m.key] || 0;
        if (curQty > origQty) increased[m.key] = curQty - origQty;
        else if (curQty < origQty) decreased[m.key] = origQty - curQty;
    });
    return { increased, decreased };
}

// ------------------------------------------------------------------
// Applies a final mods object to the equipped armor slot.
// ------------------------------------------------------------------
function applyArmorForgeFinal(finalMods) {
    let totals = window.armorForgeCalcTotals({ mods: finalMods });
    getTargetArmor().name = armorForgeDraft.name || "Custom Armor";
    getTargetArmor().wt = totals.wt;
    getTargetArmor().ac = totals.ac;
    getTargetArmor().dr = totals.dr;
    getTargetArmor().er = totals.er;
    getTargetArmor().stealthMod = totals.stealth;
    getTargetArmor().athleticsMod = totals.athletics;
    getTargetArmor().speedMod = totals.speed;
    getTargetArmor().mods = { ...finalMods };
    getTargetArmor().paidCost = totals.cost;
    window.closeModal('armorCraftModal');
    window.closeModal('armorForgeModal');
    window.recalculateMath();
    if ((armorForgeTarget === 'companion' || armorForgeTarget === 'gm') && typeof ncRenderAll === 'function') ncRenderAll();
}

// A GM designing an NPC isn't buying or crafting anything -- no Currency,
// no Crafting Materials, no roll. This just finalizes whatever's currently
// configured directly onto the NPC for free.
window.gmAddArmorFree = function() {
    applyArmorForgeFinal(armorForgeDraft.mods);
};

// ------------------------------------------------------------------
// Purchase: Currency only, no roll, always "succeeds" instantly.
// Decreases are honored (lower the paid-for total) but never refund
// Currency, and any crafted-material history for the removed units is
// discarded (not refunded) since Purchase never invested materials.
// ------------------------------------------------------------------
window.purchaseArmor = function() {
    let totals = window.armorForgeCalcTotals(armorForgeDraft);
    let delta = Math.max(0, totals.cost - armorForgeBasePaid);
    let { decreased } = armorForgeSessionDelta();

    let doPurchase = () => {
        Object.keys(decreased).forEach(key => {
            craftReconcileBatchesDown(getTargetArmor().craftBatches, key, armorForgeDraft.mods[key] || 0);
        });
        window.state.currency = (window.state.currency || 0) - delta;
        applyArmorForgeFinal(armorForgeDraft.mods);
    };

    if (delta > (window.state.currency || 0)) {
        window.showConfirm(`You need ${delta} Currency but only have ${window.state.currency || 0}. Purchase anyway (currency will go negative)?`, doPurchase);
        return;
    }
    doPurchase();
};

// ------------------------------------------------------------------
// Craft: Materials + a DC roll for the ADDED mods only. Removed mods
// always succeed and refund materials (no check needed to take
// something off your own armor). Perk-aware: Black Smith 5 halves
// the Currency used to compute materials; Black Smith 2 (if crafting
// with STR) or Artisan 3 recover half materials on a plain failure;
// Artisan 2 halves materials if this is a chosen specialization.
// ------------------------------------------------------------------
window.openArmorCraftModal = function() {
    armorForgeSpecialized = false;
    window.renderArmorCraftBody();
    window.openModal('armorCraftModal');
};

window.setCraftAttr = function(val) {
    window.state.craftSkillPref = val;
    window.renderArmorCraftBody();
};

window.setCraftSpecialized = function(checked) {
    armorForgeSpecialized = checked;
    window.renderArmorCraftBody();
};

function armorForgeCraftMath() {
    let totals = window.armorForgeCalcTotals(armorForgeDraft);
    let nominalDelta = Math.max(0, totals.cost - armorForgeBasePaid);
    let { bsRank, artisanRank } = craftPerkRanks();
    let craftAttr = (bsRank >= 1) ? (window.state.craftSkillPref || 'INT') : 'INT';
    if (craftAttr === 'STR' && bsRank < 1) craftAttr = 'INT';

    let dc = 10 + Math.ceil(nominalDelta / 100);
    let hours = nominalDelta === 0 ? 0 : Math.max(1, Math.ceil(nominalDelta / 100));
    if (craftAttr === 'STR' && bsRank >= 4) hours = nominalDelta === 0 ? 0 : Math.max(1, Math.floor(hours / 2));
    if (armorForgeSpecialized && artisanRank >= 4) hours = nominalDelta === 0 ? 0 : Math.max(1, Math.floor(hours / 2));

    let mats = craftMaterialsForCost(nominalDelta, { bsRank, artisanRank, specialized: armorForgeSpecialized });
    let hasFailRecovery = craftHasFailRecovery(craftAttr, bsRank, artisanRank);

    return { totals, nominalDelta, bsRank, artisanRank, craftAttr, dc, hours, minRareCt: mats.minRareCt, minUncommonCt: mats.minUncommonCt, commonCt: mats.commonCt, hasFailRecovery };
}

window.renderArmorCraftBody = function() {
    let m = armorForgeCraftMath();
    let { increased, decreased } = armorForgeSessionDelta();
    let hasRemovals = Object.keys(decreased).length > 0;
    let craftingBaseOnly = m.nominalDelta > 0 && Object.keys(increased).length === 0;

    let have = {
        Common: craftMaterialCounts().common,
        Uncommon: craftMaterialCounts().uncommon,
        Rare: craftMaterialCounts().rare,
    };
    let need = { Common: m.commonCt, Uncommon: m.minUncommonCt, Rare: m.minRareCt };
    let canAfford = have.Common >= need.Common && have.Uncommon >= need.Uncommon && have.Rare >= need.Rare;

    let matRowsHtml = ['Common', 'Uncommon', 'Rare'].map(tier => {
        let ok = have[tier] >= need[tier];
        return `<div class="flex justify-between text-xs py-1 ${ok ? 'text-slate-300' : 'text-red-400 font-bold'}">
            <span>${tier} Crafting Materials</span>
            <span>${need[tier]} needed <span class="text-slate-500">(have ${have[tier]})</span></span>
        </div>`;
    }).join('');

    let strToggle = m.bsRank >= 1 ? `
        <div class="flex items-center gap-3 mb-3 bg-slate-900 border border-slate-700 rounded p-2">
            <span class="text-[10px] text-slate-400 font-bold uppercase">Craft with:</span>
            <label class="flex items-center gap-1 text-xs text-white"><input type="radio" name="craftAttr" ${window.state.craftSkillPref !== 'STR' ? 'checked' : ''} onchange="window.setCraftAttr('INT')"> INT (Craft)</label>
            <label class="flex items-center gap-1 text-xs text-white"><input type="radio" name="craftAttr" ${window.state.craftSkillPref === 'STR' ? 'checked' : ''} onchange="window.setCraftAttr('STR')"> STR (Craft) <span class="text-[9px] text-slate-500">(Black Smith)</span></label>
        </div>
    ` : '';

    let specToggle = m.artisanRank >= 1 ? `
        <label class="flex items-center gap-2 mb-3 bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white cursor-pointer">
            <input type="checkbox" ${armorForgeSpecialized ? 'checked' : ''} onchange="window.setCraftSpecialized(this.checked)">
            This armor falls under one of my Artisan Specializations
        </label>
    ` : '';

    let craftBonus = craftBonusFor(m.craftAttr);

    let removalsHtml = hasRemovals ? `
        <div class="text-[10px] text-emerald-400 font-bold mt-3 text-center">Removed mods always succeed and refund half their original crafting materials automatically -- no roll needed for those.</div>
    ` : '';

    document.getElementById('armorCraftBody').innerHTML = `
        ${strToggle}
        ${specToggle}
        <div class="grid grid-cols-2 gap-3 mb-3">
            <div class="bg-slate-900 border border-slate-700 rounded p-3 text-center">
                <div class="text-[10px] text-slate-500 uppercase font-bold">Crafting DC</div>
                <div class="text-2xl font-black text-white">${m.dc}</div>
            </div>
            <div class="bg-slate-900 border border-slate-700 rounded p-3 text-center">
                <div class="text-[10px] text-slate-500 uppercase font-bold">Crafting Time</div>
                <div class="text-2xl font-black text-white">${m.hours} hr${m.hours === 1 ? '' : 's'}</div>
            </div>
        </div>
        <div class="text-[10px] text-slate-500 uppercase font-bold mb-1">Materials Required (${m.nominalDelta} Cu of ${craftingBaseOnly ? 'the unpaid Base Armor -- no mods selected' : 'new mods'}${m.bsRank >= 5 || (armorForgeSpecialized && m.artisanRank >= 2) ? ', discounted' : ''})</div>
        <div class="bg-slate-900 border border-slate-700 rounded p-3">${m.nominalDelta === 0 ? '<div class="text-xs text-slate-500 text-center">No new mods to craft.</div>' : matRowsHtml}</div>
        ${craftingBaseOnly ? '<div class="text-[10px] text-amber-400 mt-2 text-center">No mods are selected -- this attempt is only to craft the Base Armor itself (it isn\'t free). Failing it wastes the materials above but equips nothing.</div>' : ''}
        ${!canAfford && m.nominalDelta > 0 ? '<div class="text-[11px] text-red-400 font-bold mt-2 text-center">Not enough Crafting Materials on hand for a Success/partial-Fail outcome.</div>' : ''}
        ${removalsHtml}

        ${m.nominalDelta > 0 ? `
        <div class="mt-4 bg-slate-900 border border-orange-800/50 rounded-lg p-3">
            <div class="text-[10px] text-slate-500 uppercase font-bold mb-1 text-center">Your Craft Check</div>
            <div class="text-center text-xs text-slate-400 mb-2">${m.craftAttr} (Craft) bonus: <span class="font-bold text-white">${craftBonus >= 0 ? '+' : ''}${craftBonus}</span> vs DC <span class="font-bold text-white">${m.dc}</span></div>
            <button onclick="window.armorForgeRollForMe()" class="w-full bg-indigo-600/20 border border-indigo-700/50 text-indigo-300 hover:bg-indigo-600/40 text-xs font-bold py-2 rounded transition mb-3">🎲 Roll For Me</button>
            <div class="text-[10px] text-slate-500 uppercase font-bold mb-1 text-center">Or Enter Your Own Roll's Outcome</div>
            <div class="grid grid-cols-3 gap-2">
                <button onclick="window.armorForgeApplyOutcome('success')" ${!canAfford ? 'disabled' : ''} class="px-2 py-2 rounded ${!canAfford ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'} text-xs font-bold transition">Success</button>
                <button onclick="window.armorForgeApplyOutcome('fail')" class="px-2 py-2 rounded bg-amber-700 hover:bg-amber-600 text-white text-xs font-bold transition">Failed<br><span class="text-[9px] font-normal">${m.hasFailRecovery ? '(half mats back)' : '(all mats lost)'}</span></button>
                <button onclick="window.armorForgeApplyOutcome('failhard')" class="px-2 py-2 rounded bg-red-700 hover:bg-red-600 text-white text-xs font-bold transition">Failed by 5+<br><span class="text-[9px] font-normal">/ Crit Fail</span></button>
            </div>
        </div>
        ` : `<div class="flex justify-end mt-4"><button onclick="window.armorForgeApplyOutcome('success')" class="px-6 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black transition">Confirm (Removals Only)</button></div>`}

        <div class="flex justify-end mt-3">
            <button onclick="window.closeModal('armorCraftModal')" class="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold transition">Cancel</button>
        </div>
    `;
};

window.armorForgeRollForMe = function() {
    let m = armorForgeCraftMath();
    let craftBonus = craftBonusFor(m.craftAttr);
    let d20 = 1 + Math.floor(Math.random() * 20);
    let result = craftRollOutcome(d20, craftBonus, m.dc);

    window.showConfirm(`Rolled ${d20} + ${craftBonus} = ${result.total} vs DC ${m.dc}.\nResult: ${result.label}.\n\nApply this result?`, () => {
        window.armorForgeApplyOutcome(result.outcome);
    });
};

window.armorForgeApplyOutcome = function(outcome) {
    let m = armorForgeCraftMath();
    let { increased, decreased } = armorForgeSessionDelta();

    // Guard against spending materials the player doesn't have -- this must
    // live here, not just on the button's `disabled` state, since nothing
    // else calls this function.
    if (m.nominalDelta > 0) {
        let need = { common: m.commonCt, uncommon: m.minUncommonCt, rare: m.minRareCt };
        let have = craftMaterialCounts();
        if (have.common < need.common || have.uncommon < need.uncommon || have.rare < need.rare) {
            window.showConfirm("Not enough Crafting Materials on hand to attempt this craft.", null, true);
            return;
        }
    }

    // Removals always succeed, no check needed.
    let totalRefund = { common: 0, uncommon: 0, rare: 0 };
    Object.keys(decreased).forEach(key => {
        let refund = craftPopRefund(getTargetArmor().craftBatches, key, decreased[key]);
        totalRefund.common += refund.common;
        totalRefund.uncommon += refund.uncommon;
        totalRefund.rare += refund.rare;
    });
    craftAddMaterials(totalRefund);

    // Build the final mods object: removals always land; additions land
    // only on success (a failed attempt reverts back to what was there before).
    let finalMods = { ...armorForgeDraft.mods };
    Object.keys(increased).forEach(key => {
        if (outcome !== 'success') finalMods[key] = armorForgeOriginalMods[key] || 0;
    });

    if (m.nominalDelta > 0) {
        let need = { common: m.commonCt, uncommon: m.minUncommonCt, rare: m.minRareCt };
        let spend;

        if (outcome === 'success') {
            spend = { ...need };
        } else if (outcome === 'fail' && m.hasFailRecovery) {
            // "recover half the materials (rounded down)" == you keep floor(need/2),
            // i.e. you actually spend need - floor(need/2) of each tier.
            spend = {
                common: need.common - Math.floor(need.common / 2),
                uncommon: need.uncommon - Math.floor(need.uncommon / 2),
                rare: need.rare - Math.floor(need.rare / 2)
            };
        } else {
            spend = { ...need }; // plain fail with no recovery perk, or fail-by-5+/crit fail: all wasted
        }

        craftSpendMaterials(spend);

        if (outcome === 'success') {
            let totalCostShare = Object.keys(increased).reduce((s, k) => s + ARMOR_MODS.find(x => x.key === k).cost * increased[k], 0);
            Object.keys(increased).forEach(key => {
                let keyCostShare = ARMOR_MODS.find(x => x.key === key).cost * increased[key];
                let frac = totalCostShare > 0 ? (keyCostShare / totalCostShare) : 0;
                craftPushBatch(
                    getTargetArmor().craftBatches, key, increased[key],
                    Math.floor(spend.common * frac), Math.floor(spend.uncommon * frac), Math.floor(spend.rare * frac)
                );
            });
        }
    }

    // The Base Armor itself costs 50 Cu and has to be earned like anything
    // else -- it isn't free just because armorForgeCalcTotals always
    // includes it in `cost`. If this character has never actually equipped
    // anything before (nothing paid for yet), and this session neither
    // succeeded nor removed anything, there is nothing to commit: don't
    // let a failed roll manifest the Base Armor out of nowhere. The
    // materials for the failed attempt above are still spent/wasted as
    // normal; only the "equip it" step is skipped.
    let earnedSomething = (outcome === 'success') || Object.keys(decreased).length > 0 || armorForgeBasePaid > 0;
    if (!earnedSomething) {
        window.closeModal('armorCraftModal');
        window.closeModal('armorForgeModal');
        window.recalculateMath();
        return;
    }

    applyArmorForgeFinal(finalMods);
};
