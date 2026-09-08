// ============================================================
// APX Character Sheet — Shared Crafting Primitives
// Used by both the Armor Forge and Weapon Forge so their Purchase/
// Craft systems stay genuinely identical rather than two separate
// implementations that can drift apart. Chapter 8 crafting rules,
// plus Black Smith / Artisan perk interactions.
// ============================================================

function craftPerkRanks() {
    return {
        bsRank: window.state.perks['str_blacksmith'] || 0,
        artisanRank: window.state.perks['int_artisan'] || 0
    };
}

function craftBonusFor(attr) {
    let attrMod = (calc.mods && calc.mods[attr]) || 0;
    let isTrained = window.state.skillsTrained['Craft'] || false;
    let trBonus = isTrained ? window.state.trainingBonus : 0;
    let perkBonus = (calc.skills && calc.skills.Craft) || 0;
    return attrMod + trBonus + perkBonus;
}

function craftMaterialCounts() {
    let common = window.state.items.find(i => i.name === "Common Crafting Materials");
    let uncommon = window.state.items.find(i => i.name === "Uncommon Crafting Materials");
    let rare = window.state.items.find(i => i.name === "Rare Crafting Materials");
    return {
        common: common ? common.ct : 0,
        uncommon: uncommon ? uncommon.ct : 0,
        rare: rare ? rare.ct : 0
    };
}

function craftSpendMaterials(spend) {
    let common = window.state.items.find(i => i.name === "Common Crafting Materials");
    let uncommon = window.state.items.find(i => i.name === "Uncommon Crafting Materials");
    let rare = window.state.items.find(i => i.name === "Rare Crafting Materials");
    if (common) common.ct -= spend.common;
    if (uncommon) uncommon.ct -= spend.uncommon;
    if (rare) rare.ct -= spend.rare;
}

function craftAddMaterials(refund) {
    let common = window.state.items.find(i => i.name === "Common Crafting Materials");
    let uncommon = window.state.items.find(i => i.name === "Uncommon Crafting Materials");
    let rare = window.state.items.find(i => i.name === "Rare Crafting Materials");
    if (common) common.ct += refund.common;
    if (uncommon) uncommon.ct += refund.uncommon;
    if (rare) rare.ct += refund.rare;
}

// Material tiers for a given nominal Currency delta. Black Smith 5 halves
// the Currency used for this calculation (not DC/time); Artisan 2 halves
// the resulting material counts if the item falls under a specialization.
function craftMaterialsForCost(nominalDelta, opts) {
    let bsRank = opts.bsRank, artisanRank = opts.artisanRank, specialized = opts.specialized;
    let costForMats = (bsRank >= 5) ? Math.floor(nominalDelta / 2) : nominalDelta;
    let matBudget = Math.floor(costForMats / 2);
    let tiers = Math.floor(costForMats / 200);
    let minRareCt = tiers * 5;
    let minUncommonCt = tiers * 10;
    let commonCt = Math.max(0, matBudget - (minRareCt * 10) - (minUncommonCt * 5));

    if (specialized && artisanRank >= 2) {
        minRareCt = Math.floor(minRareCt / 2);
        minUncommonCt = Math.floor(minUncommonCt / 2);
        commonCt = Math.floor(commonCt / 2);
    }
    return { minRareCt, minUncommonCt, commonCt };
}

// Black Smith 2 (only when crafting with STR) or Artisan 3 (regardless of
// which attribute governs the check) recover half materials on a plain Fail.
function craftHasFailRecovery(craftAttr, bsRank, artisanRank) {
    return (craftAttr === 'STR' && bsRank >= 2) || (artisanRank >= 3);
}

function craftRollOutcome(d20, craftBonus, dc) {
    let total = d20 + craftBonus;
    let margin = dc - total;
    let outcome, label;
    if (total >= dc) { outcome = 'success'; label = 'SUCCESS'; }
    else if (margin >= 5 || d20 === 1) { outcome = 'failhard'; label = 'FAILED BY 5+ / CRITICAL FAILURE'; }
    else { outcome = 'fail'; label = 'FAILED'; }
    return { outcome, label, total };
}

// ------------------------------------------------------------------
// LIFO batch bookkeeping (Ch.8: "recover Crafting Materials equal to
// half of the materials you originally spent to craft it, rounded
// down"). `batches` is a plain object keyed by component name, each
// value a stack of {qty, common, uncommon, rare}. Shared by Armor's
// per-mod batches and each Weapon's per-component batches.
// ------------------------------------------------------------------
function craftPushBatch(batches, key, qty, common, uncommon, rare) {
    if (qty <= 0) return;
    if (!batches[key]) batches[key] = [];
    batches[key].push({ qty, common, uncommon, rare });
}

function craftPopRefund(batches, key, unitsToRemove) {
    let refund = { common: 0, uncommon: 0, rare: 0 };
    let stack = batches[key];
    if (!stack) return refund;
    let remaining = unitsToRemove;
    while (remaining > 0 && stack.length > 0) {
        let top = stack[stack.length - 1];
        let perUnit = {
            common: Math.floor(top.common / top.qty),
            uncommon: Math.floor(top.uncommon / top.qty),
            rare: Math.floor(top.rare / top.qty)
        };
        refund.common += Math.floor(perUnit.common / 2);
        refund.uncommon += Math.floor(perUnit.uncommon / 2);
        refund.rare += Math.floor(perUnit.rare / 2);

        top.common -= perUnit.common;
        top.uncommon -= perUnit.uncommon;
        top.rare -= perUnit.rare;
        top.qty -= 1;
        remaining -= 1;
        if (top.qty <= 0) stack.pop();
    }
    return refund;
}

// Used when Purchase (not Craft) reduces a component that has crafted
// history: no refund is owed, but the bookkeeping still needs to shrink
// so a *later* Craft-based removal can't over-refund against stale records.
function craftReconcileBatchesDown(batches, key, newQty) {
    let stack = batches[key];
    if (!stack) return;
    let total = stack.reduce((s, b) => s + b.qty, 0);
    let excess = total - newQty;
    while (excess > 0 && stack.length > 0) {
        let top = stack[stack.length - 1];
        if (top.qty <= excess) {
            excess -= top.qty;
            stack.pop();
        } else {
            let frac = excess / top.qty;
            top.common = Math.floor(top.common * (1 - frac));
            top.uncommon = Math.floor(top.uncommon * (1 - frac));
            top.rare = Math.floor(top.rare * (1 - frac));
            top.qty -= excess;
            excess = 0;
        }
    }
}
