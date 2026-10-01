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

// ------------------------------------------------------------------
// The Craft check, the modern way (Playtest 2): rolled in the Dice tray
// (so Luck Points, Omens, conditions and Advantage all work on it), with
// the workspace choice and every cost spelled out before you roll.
//   Workspace (Ch.8): your own Workbench; a rented one (100 Cu per hour of
//   work, paid whatever the result); or a Toolkit (Disadvantage).
// Each forge passes its own math (m) and an apply(outcome) function.
// ------------------------------------------------------------------
const CRAFT_RENT_PER_HOUR = 100;
window._craftRoll = null;   // { kind, outcome, nat, total, dc, applied }

function craftWorkspace() { return window.state.craftWorkspace || 'bench'; }
window.setCraftWorkspace = function(kind, ws) {
    window.state.craftWorkspace = ws;
    if (kind === 'weapon') window.renderWeaponCraftBody(); else window.renderArmorCraftBody();
};
function craftRentCost(m) { return craftWorkspace() === 'rent' ? (m.hours || 0) * CRAFT_RENT_PER_HOUR : 0; }

// The sheet's own Craft roll (training, item and perk bonuses, injuries), switched to STR for Black Smith
function craftCheckSpec(attr) {
    let spec = null;
    document.querySelectorAll('[data-apx-roll]').forEach(el => {
        if (spec) return;
        try { let o = JSON.parse(el.getAttribute('data-apx-roll')); if (o.type === 'check' && o.skill === 'Craft' && o.kind !== 'save') spec = o; } catch (e) { }
    });
    let bonus;
    if (spec) {
        bonus = parseInt(spec.bonus) || 0;
        if (attr === 'STR') bonus += ((calc.mods && calc.mods.STR) || 0) - ((calc.mods && calc.mods.INT) || 0);
    } else bonus = craftBonusFor(attr);
    let o = Object.assign({}, spec || {}, { attr, skill: 'Craft', bonus, who: window.state.name || '' });
    delete o.type; delete o.label;
    return o;
}

function craftOutcomeOf(nat, total, dc, autoFail) {
    if (total >= dc && !autoFail) return { outcome: 'success', label: 'Success' };
    if (autoFail || nat === 1 || dc - total >= 5) return { outcome: 'failhard', label: nat === 1 ? 'Critical Failure' : autoFail ? 'Failed (auto-fail)' : 'Failed by 5 or more' };
    return { outcome: 'fail', label: 'Failed' };
}

// Rolls the check in the tray. A Luck reroll or Omen on that roll updates the result here too.
window.craftRollCheck = function(kind) {
    if (!window.APXDice) return;
    let m = kind === 'weapon' ? weaponForgeCraftMath() : armorForgeCraftMath();
    let rent = craftRentCost(m);
    if (rent > (parseInt(window.state.currency) || 0)) {
        window.showConfirm(`Renting a Workbench for ${m.hours} hour${m.hours === 1 ? '' : 's'} costs ${rent} Cu, and you have ${parseInt(window.state.currency) || 0}. Pick another workspace, or find more Currency first.`, null, true);
        return;
    }
    let spec = craftCheckSpec(m.craftAttr);
    if (craftWorkspace() === 'toolkit') spec.disSources = (spec.disSources || []).concat(['Toolkit']);
    let roll = window._craftRoll = { kind, dc: m.dc, applied: false };
    window.APXDice.check(Object.assign(spec, {
        label: `${m.craftAttr} (Craft): ${kind === 'weapon' ? 'Weapon' : 'Armor'} Forge, DC ${m.dc}`, purpose: 'craft',
        onResult: r => {
            if (roll.applied) return roll.note;
            let res = craftOutcomeOf(r.nat, r.total, m.dc, r.autoFail);
            Object.assign(roll, { nat: r.nat, total: r.total, outcome: res.outcome, label: res.label });
            roll.note = `${res.label} (${r.total} vs DC ${m.dc})`;
            setTimeout(() => { if (window._craftRoll === roll) (kind === 'weapon' ? window.renderWeaponCraftBody : window.renderArmorCraftBody)(); }, 0);
            return roll.note;
        }
    }));
};

// Applies the rolled (or typed-in) outcome: pays any Workbench rent, then the forge does the rest
window.craftApply = function(kind, outcome) {
    let m = kind === 'weapon' ? weaponForgeCraftMath() : armorForgeCraftMath();
    let rent = m.nominalDelta > 0 ? craftRentCost(m) : 0;
    if (rent > (parseInt(window.state.currency) || 0)) {
        window.showConfirm(`Renting the Workbench costs ${rent} Cu, and you have ${parseInt(window.state.currency) || 0}.`, null, true);
        return;
    }
    if (m.nominalDelta > 0) {
        let have = craftMaterialCounts();
        if (have.common < m.commonCt || have.uncommon < m.minUncommonCt || have.rare < m.minRareCt) {
            window.showConfirm("Not enough Crafting Materials on hand to attempt this craft.", null, true);
            return;
        }
    }
    let roll = window._craftRoll;
    if (roll && roll.kind === kind) roll.applied = true;
    window._craftRoll = null;
    let before = parseInt(window.state.currency) || 0;
    (kind === 'weapon' ? window.weaponForgeApplyOutcome : window.armorForgeApplyOutcome)(outcome);
    if (rent > 0) {
        window.state.currency = before - rent;
        window.APXDice?.notify(`Paid ${rent} Cu to rent a Workbench for ${m.hours} hour${m.hours === 1 ? '' : 's'}.`, { kind: 'loot' });
        window.recalculateMath && window.recalculateMath();
    }
};

// The panel both forges show: workspace, a plain cost summary, and the roll
function craftCheckPanelHtml(kind, m, canAfford) {
    let ws = craftWorkspace(), rent = m.hours * CRAFT_RENT_PER_HOUR, cu = parseInt(window.state.currency) || 0;
    let spec = craftCheckSpec(m.craftAttr), bonus = spec.bonus;
    let need = { common: m.commonCt, uncommon: m.minUncommonCt, rare: m.minRareCt };
    let matsTxt = [['common', 'Common'], ['uncommon', 'Uncommon'], ['rare', 'Rare']].filter(([k]) => need[k] > 0).map(([k, l]) => `${need[k]} ${l}`).join(', ') || 'no materials';
    let halfTxt = [['common', 'Common'], ['uncommon', 'Uncommon'], ['rare', 'Rare']].filter(([k]) => need[k] > 0).map(([k, l]) => `${Math.floor(need[k] / 2)} ${l}`).join(', ') || 'nothing';
    let days = Math.ceil(m.hours / 8);
    let roll = window._craftRoll && window._craftRoll.kind === kind && window._craftRoll.dc === m.dc ? window._craftRoll : null;
    let radio = (v, label, sub) => `<label class="flex items-start gap-1.5 text-xs text-white cursor-pointer flex-1 min-w-[150px] bg-slate-800/60 border ${ws === v ? 'border-orange-500' : 'border-slate-700'} rounded p-1.5">
        <input type="radio" name="${kind}CraftWs" ${ws === v ? 'checked' : ''} onchange="window.setCraftWorkspace('${kind}','${v}')" class="mt-0.5"><span>${label}<span class="block text-[9px] text-slate-400">${sub}</span></span></label>`;
    let outcomeColor = o => o === 'success' ? 'text-emerald-400' : o === 'fail' ? 'text-amber-400' : 'text-red-400';
    return `
        <div class="mt-4 bg-slate-900 border border-orange-800/50 rounded-lg p-3">
            <div class="text-[10px] text-slate-500 uppercase font-bold mb-1">Where you're working</div>
            <div class="flex flex-wrap gap-2 mb-3">
                ${radio('bench', 'Your Workbench', 'At your base or a friend\'s')}
                ${radio('rent', `Rent a Workbench`, `${CRAFT_RENT_PER_HOUR} Cu per hour: ${rent} Cu here`)}
                ${radio('toolkit', 'Toolkit', 'Anywhere, with Disadvantage')}
            </div>
            <div class="text-[10px] text-slate-500 uppercase font-bold mb-1">What this costs</div>
            <table class="w-full text-[11px] text-slate-300 mb-3">
                <tr><td class="py-0.5 text-slate-500">Value crafted</td><td class="text-right font-bold text-white">${m.nominalDelta} Cu</td></tr>
                <tr><td class="py-0.5 text-slate-500">Materials</td><td class="text-right font-bold ${canAfford ? 'text-white' : 'text-red-400'}">${matsTxt}</td></tr>
                <tr><td class="py-0.5 text-slate-500">Time</td><td class="text-right font-bold text-white">${m.hours} hour${m.hours === 1 ? '' : 's'}${days > 1 ? ` (${days} days at 8 hours a day)` : ''}</td></tr>
                ${ws === 'rent' ? `<tr><td class="py-0.5 text-slate-500">Workbench rent</td><td class="text-right font-bold ${rent > cu ? 'text-red-400' : 'text-yellow-400'}">${rent} Cu <span class="text-slate-500 font-normal">(you have ${cu})</span></td></tr>` : ''}
            </table>
            <div class="grid grid-cols-3 gap-1.5 mb-3 text-[10px] text-center">
                <div class="rounded border border-emerald-800/60 bg-emerald-900/20 p-1.5"><div class="font-black text-emerald-400">Success</div><div class="text-slate-300">It's made. Materials used.</div></div>
                <div class="rounded border border-amber-800/60 bg-amber-900/20 p-1.5"><div class="font-black text-amber-400">Failed</div><div class="text-slate-300">${m.hasFailRecovery ? `Not made. ${halfTxt} come back.` : 'Not made. Materials lost.'}</div></div>
                <div class="rounded border border-red-800/60 bg-red-900/20 p-1.5"><div class="font-black text-red-400">By 5+ / Nat 1</div><div class="text-slate-300">Not made. Materials lost.</div></div>
            </div>
            <div class="text-center text-xs text-slate-400 mb-2">${m.craftAttr} (Craft) <span class="font-bold text-white">${bonus >= 0 ? '+' : ''}${bonus}</span> vs DC <span class="font-bold text-white">${m.dc}</span>${ws === 'toolkit' ? ' <span class="text-red-400 font-bold">with Disadvantage</span>' : ''}</div>
            ${roll && roll.outcome ? `
            <div class="rounded border border-slate-600 bg-slate-800 p-2 mb-2 text-center">
                <div class="text-[10px] text-slate-500 uppercase font-bold">Your roll</div>
                <div class="text-lg font-black ${outcomeColor(roll.outcome)}">${roll.total} vs DC ${m.dc}: ${roll.label}</div>
                <div class="text-[10px] text-slate-400">Natural ${roll.nat}. Spend a Luck Point or an Omen on it in the dice tray to change it; this updates.</div>
                <button onclick="window.craftApply('${kind}','${roll.outcome}')" ${roll.outcome === 'success' && !canAfford ? 'disabled' : ''} class="mt-2 w-full px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition">Apply: ${roll.label}${ws === 'rent' ? ` (pay ${rent} Cu rent)` : ''}</button>
            </div>` : `
            <button onclick="window.craftRollCheck('${kind}')" ${!canAfford ? 'disabled' : ''} class="w-full ${canAfford ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-slate-800 text-slate-600 cursor-not-allowed'} text-xs font-black py-2 rounded transition mb-2">Roll Craft Check</button>`}
            <details class="mt-1"><summary class="text-[10px] text-slate-500 uppercase font-bold cursor-pointer text-center">Rolled it yourself? Enter the outcome</summary>
            <div class="grid grid-cols-3 gap-2 mt-2">
                <button onclick="window.craftApply('${kind}','success')" ${!canAfford ? 'disabled' : ''} class="px-2 py-2 rounded ${!canAfford ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'} text-xs font-bold transition">Success</button>
                <button onclick="window.craftApply('${kind}','fail')" class="px-2 py-2 rounded bg-amber-700 hover:bg-amber-600 text-white text-xs font-bold transition">Failed</button>
                <button onclick="window.craftApply('${kind}','failhard')" class="px-2 py-2 rounded bg-red-700 hover:bg-red-600 text-white text-xs font-bold transition">Failed by 5+<br><span class="text-[9px] font-normal">/ Crit Fail</span></button>
            </div></details>
        </div>`;
}

// One line under a forge's "Cost Now": what buying leaves you, and what crafting it would take instead
function craftBuyOrCraftHtml(delta, m) {
    if (!(delta > 0) || !window.state) return '';
    let cu = parseInt(window.state.currency) || 0;
    let buy = cu >= delta ? `<span class="text-emerald-400 font-bold">Buy: ${cu - delta} Cu left</span> <span class="text-slate-500">(of ${cu})</span>`
        : `<span class="text-red-400 font-bold">Buy: ${delta - cu} Cu short</span> <span class="text-slate-500">(you have ${cu})</span>`;
    let mats = [[m.commonCt, 'Common'], [m.minUncommonCt, 'Uncommon'], [m.minRareCt, 'Rare']].filter(x => x[0] > 0).map(x => x[0] + ' ' + x[1]).join(', ') || 'no materials';
    return `<div class="text-[10px] text-slate-400 mt-1.5 flex flex-wrap justify-between gap-x-3 gap-y-0.5">${buy}<span><span class="text-orange-300 font-bold">Craft:</span> ${mats} · DC ${m.dc} · ${m.hours} hr</span></div>`;
}
