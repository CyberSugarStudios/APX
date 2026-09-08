// ============================================================
// APX Character Sheet — Weapon Crafting Wizard
// Step 1: Category (Melee/Ranged) + Weight Class + Damage Type
// Step 2: Damage Dice tier + Critical Multiplier tier
// Step 3: Range Increment (ranged only) + Elemental + Properties
// On Finish, pushes a fully-statted weapon onto window.state.weapons,
// using the exact same {name, attr, tr, dmg, ap} shape the rest of
// the sheet already renders/calculates against.
// ============================================================

let weaponForgeDraft = null;
let currentWeaponStep = 1;
let weaponForgeEditIndex = null;     // null = crafting a new weapon; otherwise index into the target array
let weaponForgeOriginalDraft = null; // snapshot at open time (for session delta)
let weaponForgeBasePaid = 0;         // paidCost snapshot at open time
let weaponForgeSpecialized = false;  // this session's "is this an Artisan specialization" answer
let weaponForgeTarget = 'player';    // 'player', 'companion', or 'gm' -- whose weapon list this session edits

// Returns whichever weapons array this session is targeting.
function getTargetWeapons() {
    if (weaponForgeTarget === 'gm') return ncActiveCompanion().weapons;
    return weaponForgeTarget === 'companion' ? window.state.companion.weapons : window.state.weapons;
}

function getBlankWeaponDraft() {
    return {
        category: 'melee', weightClass: 'light', dmgType: 'Bludgeoning',
        dmgTier: 0, critTier: 0, rangeTier: 0,
        elemental: null,
        properties: { concealed: false, reach: false, thrown: false, sturdy: false, grappling: false, tearing: false, crushing: false, flurry: false, stunning: false }
    };
}

window.weaponForgeCalcTotals = function(draftOverride) {
    let d = draftOverride || weaponForgeDraft;
    let isRanged = d.category === 'ranged';
    let wc = WEAPON_WEIGHT_CLASSES[d.weightClass];

    let baseCost = isRanged ? WEAPON_BASE.rangedCost : WEAPON_BASE.meleeCost;
    let baseWt = isRanged ? WEAPON_BASE.rangedWt : WEAPON_BASE.meleeWt;

    // Ranged weapons pay double Currency for Step 2 (Damage) upgrades only.
    let dmgCostMult = isRanged ? 2 : 1;
    let dmgCumCost = 0, dmgCumWt = 0;
    for (let i = 1; i <= d.dmgTier; i++) { dmgCumCost += WEAPON_DMG_TIERS[i].cost; dmgCumWt += WEAPON_DMG_TIERS[i].wt; }
    dmgCumCost *= dmgCostMult;

    let critCumCost = 0, critCumWt = 0;
    for (let i = 1; i <= d.critTier; i++) { critCumCost += WEAPON_CRIT_TIERS[i].cost; critCumWt += WEAPON_CRIT_TIERS[i].wt; }

    let rangeCost = isRanged ? WEAPON_RANGE_TIERS[d.rangeTier].cost : 0;
    let propsCost = WEAPON_PROPERTIES.reduce((s, p) => s + (d.properties[p.key] ? p.cost : 0), 0);
    let elementalCost = d.elemental ? WEAPON_ELEMENTAL_COST : 0;

    let totalWeight = baseWt + wc.wtChange + dmgCumWt + critCumWt;
    let totalCost = baseCost + dmgCumCost + critCumCost + rangeCost + propsCost + elementalCost;

    return {
        weight: totalWeight, cost: totalCost,
        dice: WEAPON_DMG_TIERS[d.dmgTier].dice,
        critMult: WEAPON_CRIT_TIERS[d.critTier].mult,
        range: isRanged ? WEAPON_RANGE_TIERS[d.rangeTier].range : null,
        ap: wc.apCost,
        effectiveDmgType: d.elemental || d.dmgType
    };
};

function weaponForgeCtx() {
    return {
        category: weaponForgeDraft.category,
        weightClass: weaponForgeDraft.weightClass,
        effectiveDmgType: weaponForgeDraft.elemental ? 'Energy' : weaponForgeDraft.dmgType,
        elemental: weaponForgeDraft.elemental
    };
}

// If the player changes weight class / damage type / elemental such that a
// previously-checked property no longer qualifies, silently uncheck it
// rather than leaving a checkbox stuck disabled-but-checked.
function revalidateWeaponProperties() {
    let ctx = weaponForgeCtx();
    WEAPON_PROPERTIES.forEach(p => {
        if (weaponForgeDraft.properties[p.key] && !p.reqCheck(ctx)) {
            weaponForgeDraft.properties[p.key] = false;
        }
    });
}

function draftFromWeapon(w) {
    return {
        category: w.category, weightClass: w.weightClass,
        dmgType: w.dmgType, // the physical type chosen in Step 1, stored separately from elemental
        dmgTier: WEAPON_DMG_TIERS.findIndex(t => t.dice === w.dmg),
        critTier: WEAPON_CRIT_TIERS.findIndex(t => t.mult === w.critMult),
        rangeTier: w.range ? WEAPON_RANGE_TIERS.findIndex(t => t.range === w.range) : 0,
        elemental: w.elemental || null,
        properties: { ...(w.properties || getBlankWeaponDraft().properties) }
    };
}

// idx omitted (or null) -> forge a brand new weapon. idx provided -> "Return
// to Forge" on an existing one: Step 1 (category/weight/damage type) locks,
// since those define the item's identity; only tiers/properties/elemental
// can be added to or removed from an already-crafted weapon.
window.openWeaponForge = function(idx, target) {
    weaponForgeTarget = (target === 'companion' || target === 'gm') ? target : 'player';
    weaponForgeEditIndex = (typeof idx === 'number') ? idx : null;

    if (weaponForgeEditIndex !== null) {
        let w = getTargetWeapons()[weaponForgeEditIndex];
        weaponForgeDraft = draftFromWeapon(w);
        if (weaponForgeDraft.dmgTier < 0) weaponForgeDraft.dmgTier = 0;
        if (weaponForgeDraft.critTier < 0) weaponForgeDraft.critTier = 0;
        if (weaponForgeDraft.rangeTier < 0) weaponForgeDraft.rangeTier = 0;
        if (!w.craftBatches) w.craftBatches = {}; // migrate legacy/manually-added weapons
        weaponForgeBasePaid = w.paidCost || 0;
        document.getElementById('weaponForgeName').value = w.name || '';
    } else {
        weaponForgeDraft = getBlankWeaponDraft();
        weaponForgeBasePaid = 0;
        document.getElementById('weaponForgeName').value = '';
    }
    weaponForgeOriginalDraft = JSON.parse(JSON.stringify(weaponForgeDraft));

    currentWeaponStep = 1;
    document.getElementById('wpnStep1').classList.add('active');
    document.getElementById('wpnStep2').classList.remove('active');
    document.getElementById('wpnStep3').classList.remove('active');
    document.getElementById('wpnBtnPrev').style.display = 'none';
    document.getElementById('wpnBtnNext').style.display = 'block';
    document.getElementById('wpnBtnPurchase').style.display = 'none';
    document.getElementById('wpnBtnCraft').style.display = 'none';
    document.getElementById('wpnBtnGmAdd').style.display = 'none';

    document.getElementById('wpnElementalCheck').checked = !!weaponForgeDraft.elemental;
    document.getElementById('wpnElementalType').classList.toggle('hidden', !weaponForgeDraft.elemental);
    populateWeaponElementalDropdown();
    if (weaponForgeDraft.elemental) document.getElementById('wpnElementalType').value = weaponForgeDraft.elemental;

    document.querySelector(`input[name="wpnCategory"][value="${weaponForgeDraft.category}"]`).checked = true;
    document.querySelector(`input[name="wpnDmgType"][value="${weaponForgeDraft.dmgType}"]`).checked = true;

    let locked = weaponForgeEditIndex !== null;
    document.querySelectorAll('input[name="wpnCategory"], input[name="wpnDmgType"]').forEach(el => el.disabled = locked);
    document.getElementById('wpnLockedNote').classList.toggle('hidden', !locked);

    renderWeaponForgeWeightClassOptions();
    renderWeaponForgeStep2();
    renderWeaponForgeStep3();
    renderWeaponForgeSummary();
    window.updateWizardTabs('wpnTab', 1, 3);
    window.openModal('weaponForgeModal');
};

function populateWeaponElementalDropdown() {
    document.getElementById('wpnElementalType').innerHTML = WEAPON_ELEMENTAL_TYPES.map(t => `<option value="${t}">${t}</option>`).join('');
}

window.navWeaponWizard = function(dir) {
    window.jumpToWpnStep(currentWeaponStep + dir);
};

window.jumpToWpnStep = function(n) {
    if (n < 1 || n > 3) return;
    document.getElementById(`wpnStep${currentWeaponStep}`).classList.remove('active');
    currentWeaponStep = n;
    document.getElementById(`wpnStep${currentWeaponStep}`).classList.add('active');

    document.getElementById('wpnBtnPrev').style.display = currentWeaponStep > 1 ? 'block' : 'none';
    document.getElementById('wpnBtnNext').style.display = currentWeaponStep < 3 ? 'block' : 'none';
    let atLastStep = currentWeaponStep === 3;
    document.getElementById('wpnBtnPurchase').style.display = (atLastStep && weaponForgeTarget !== 'gm') ? 'block' : 'none';
    document.getElementById('wpnBtnCraft').style.display = (atLastStep && weaponForgeTarget !== 'gm') ? 'block' : 'none';
    document.getElementById('wpnBtnGmAdd').style.display = (atLastStep && weaponForgeTarget === 'gm') ? 'block' : 'none';

    if (currentWeaponStep === 2) renderWeaponForgeStep2();
    if (currentWeaponStep === 3) renderWeaponForgeStep3();
    window.updateWizardTabs('wpnTab', currentWeaponStep, 3);
};

window.setWeaponForgeName = function(val) {
    // name isn't stored on the draft itself; read directly from the input at Finish time
};

window.setWeaponForgeField = function(field, val) {
    weaponForgeDraft[field] = val;

    if (field === 'weightClass') {
        let wc = WEAPON_WEIGHT_CLASSES[val];
        if (weaponForgeDraft.dmgTier > wc.maxDmgTier) weaponForgeDraft.dmgTier = wc.maxDmgTier;
        if (weaponForgeDraft.rangeTier > wc.maxRangeTier) weaponForgeDraft.rangeTier = wc.maxRangeTier;
        renderWeaponForgeWeightClassOptions();
    }
    if (field === 'category' || field === 'weightClass' || field === 'dmgType' || field === 'elemental') {
        revalidateWeaponProperties();
    }

    renderWeaponForgeStep2();
    renderWeaponForgeStep3();
    renderWeaponForgeSummary();
};

window.toggleWeaponElemental = function(checked) {
    weaponForgeDraft.elemental = checked ? (weaponForgeDraft.elemental || WEAPON_ELEMENTAL_TYPES[0]) : null;
    document.getElementById('wpnElementalType').value = weaponForgeDraft.elemental || WEAPON_ELEMENTAL_TYPES[0];
    document.getElementById('wpnElementalType').classList.toggle('hidden', !checked);
    revalidateWeaponProperties();
    renderWeaponForgeStep3();
    renderWeaponForgeSummary();
};

window.toggleWeaponProperty = function(key, checked) {
    if (checked) {
        let propDef = WEAPON_PROPERTIES.find(p => p.key === key);
        if (propDef && !propDef.reqCheck(weaponForgeCtx())) return; // prerequisite not met, refuse
    }
    weaponForgeDraft.properties[key] = checked;
    renderWeaponForgeStep3();
    renderWeaponForgeSummary();
};

window.setWeaponForgeDmgTier = function(idx) {
    let maxTier = WEAPON_WEIGHT_CLASSES[weaponForgeDraft.weightClass].maxDmgTier;
    if (idx > maxTier) idx = maxTier;
    weaponForgeDraft.dmgTier = idx;
    renderWeaponForgeStep2();
    renderWeaponForgeSummary();
};
window.setWeaponForgeCritTier = function(idx) {
    if (idx < 0) idx = 0;
    if (idx > WEAPON_CRIT_TIERS.length - 1) idx = WEAPON_CRIT_TIERS.length - 1;
    weaponForgeDraft.critTier = idx;
    renderWeaponForgeStep2();
    renderWeaponForgeSummary();
};
window.setWeaponForgeRangeTier = function(idx) {
    let maxTier = WEAPON_WEIGHT_CLASSES[weaponForgeDraft.weightClass].maxRangeTier;
    if (idx > maxTier) idx = maxTier;
    weaponForgeDraft.rangeTier = idx;
    renderWeaponForgeStep3();
    renderWeaponForgeSummary();
};

function renderWeaponForgeWeightClassOptions() {
    let locked = weaponForgeEditIndex !== null;
    let html = Object.keys(WEAPON_WEIGHT_CLASSES).map(key => {
        let wc = WEAPON_WEIGHT_CLASSES[key];
        let checked = weaponForgeDraft.weightClass === key ? 'checked' : '';
        return `
            <label class="bg-slate-900 border ${checked ? 'border-orange-600' : 'border-slate-700'} rounded p-2 flex flex-col gap-1 ${locked ? '' : 'cursor-pointer'}">
                <div class="flex items-center gap-2"><input type="radio" name="wpnWeightClass" value="${key}" ${checked} ${locked ? 'disabled' : ''} onchange="window.setWeaponForgeField('weightClass', '${key}')"> <span class="text-sm font-bold text-white">${wc.label}</span></div>
                <div class="text-[9px] text-slate-500 pl-5">${wc.apCost} AP &middot; ${wc.hands}-handed<br>max ${WEAPON_DMG_TIERS[wc.maxDmgTier].dice}</div>
            </label>
        `;
    }).join('');
    document.getElementById('wpnWeightClassOptions').innerHTML = html;
}

function renderWeaponForgeStep2() {
    let isRanged = weaponForgeDraft.category === 'ranged';
    let wc = WEAPON_WEIGHT_CLASSES[weaponForgeDraft.weightClass];

    let dmgHtml = WEAPON_DMG_TIERS.map((t, idx) => {
        let disabled = idx > wc.maxDmgTier;
        let checked = weaponForgeDraft.dmgTier === idx;
        let cumCost = 0;
        for (let i = 1; i <= idx; i++) cumCost += WEAPON_DMG_TIERS[i].cost;
        cumCost *= (isRanged ? 2 : 1);
        return `
            <label class="flex items-center justify-between bg-slate-900 border border-slate-700 rounded px-2 py-1.5 ${disabled ? 'opacity-40' : 'cursor-pointer'}">
                <span class="flex items-center gap-2 text-xs font-bold text-white"><input type="radio" name="wpnDmgTier" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} onchange="window.setWeaponForgeDmgTier(${idx})"> ${t.label}</span>
                <span class="text-[10px] text-yellow-400 font-bold">${idx === 0 ? 'Free' : cumCost + ' Cu'}</span>
            </label>
        `;
    }).join('');
    document.getElementById('wpnDmgTierOptions').innerHTML = dmgHtml;

    let critHtml = WEAPON_CRIT_TIERS.map((t, idx) => {
        let checked = weaponForgeDraft.critTier === idx;
        let cumCost = 0;
        for (let i = 1; i <= idx; i++) cumCost += WEAPON_CRIT_TIERS[i].cost;
        return `
            <label class="flex items-center justify-between bg-slate-900 border border-slate-700 rounded px-2 py-1.5 cursor-pointer">
                <span class="flex items-center gap-2 text-xs font-bold text-white"><input type="radio" name="wpnCritTier" ${checked ? 'checked' : ''} onchange="window.setWeaponForgeCritTier(${idx})"> ${t.label}</span>
                <span class="text-[10px] text-yellow-400 font-bold">${idx === 0 ? 'Free' : cumCost + ' Cu'}</span>
            </label>
        `;
    }).join('');
    document.getElementById('wpnCritTierOptions').innerHTML = critHtml;
}

function renderWeaponForgeStep3() {
    let isRanged = weaponForgeDraft.category === 'ranged';
    document.getElementById('wpnRangeSection').style.display = isRanged ? 'block' : 'none';

    if (isRanged) {
        let wc = WEAPON_WEIGHT_CLASSES[weaponForgeDraft.weightClass];
        let rangeHtml = WEAPON_RANGE_TIERS.map((t, idx) => {
            let disabled = idx > wc.maxRangeTier;
            let checked = weaponForgeDraft.rangeTier === idx;
            return `
                <label class="flex items-center justify-between bg-slate-900 border border-slate-700 rounded px-2 py-1.5 ${disabled ? 'opacity-40' : 'cursor-pointer'}">
                    <span class="flex items-center gap-2 text-xs font-bold text-white"><input type="radio" name="wpnRangeTier" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} onchange="window.setWeaponForgeRangeTier(${idx})"> ${t.label}</span>
                    <span class="text-[10px] text-yellow-400 font-bold">${idx === 0 ? 'Free' : t.cost + ' Cu'}</span>
                </label>
            `;
        }).join('');
        document.getElementById('wpnRangeTierOptions').innerHTML = rangeHtml;
    }

    let ctx = weaponForgeCtx();
    let propsHtml = WEAPON_PROPERTIES.map(p => {
        let meetsReq = p.reqCheck(ctx);
        let checked = !!weaponForgeDraft.properties[p.key];
        return `
            <label class="flex items-start gap-2 bg-slate-900 border border-slate-700 rounded p-2 ${!meetsReq ? 'opacity-50' : 'cursor-pointer'}">
                <input type="checkbox" class="mt-0.5" ${checked ? 'checked' : ''} ${!meetsReq ? 'disabled' : ''} onchange="window.toggleWeaponProperty('${p.key}', this.checked)">
                <div class="flex-1">
                    <div class="text-[11px] font-bold text-slate-200">${p.name} <span class="text-yellow-500">[${p.cost} Cu]</span></div>
                    <div class="text-[9px] text-slate-500 leading-tight">${p.desc}</div>
                    ${!meetsReq ? `<div class="text-[9px] text-red-400 font-bold">Requires: ${p.reqLabel}</div>` : ''}
                </div>
            </label>
        `;
    }).join('');
    document.getElementById('wpnPropertiesList').innerHTML = propsHtml;
}

function renderWeaponForgeSummary() {
    let t = window.weaponForgeCalcTotals();
    let delta = Math.max(0, t.cost - weaponForgeBasePaid);
    document.getElementById('wpnSumWeight').innerText = t.weight + ' lb';
    document.getElementById('wpnSumDmg').innerText = t.dice;
    document.getElementById('wpnSumCrit').innerText = `x${t.critMult}`;
    document.getElementById('wpnSumAp').innerText = t.ap;
    document.getElementById('wpnSumCost').innerText = `${t.cost} Cu`;
    document.getElementById('wpnSumPaid').innerText = `${weaponForgeBasePaid} Cu`;
    document.getElementById('wpnSumCostNow').innerText = `${delta} Cu`;
}

// ------------------------------------------------------------------
// Session delta: which components changed since the forge was opened.
// dmgTier/critTier are cumulative (cost = sum of intermediate tiers
// crossed); rangeTier is a single absolute pick (cost = flat difference
// between the two tiers); properties/elemental are booleans.
// ------------------------------------------------------------------
function weaponForgeComponentDeltas() {
    let d = weaponForgeDraft, orig = weaponForgeOriginalDraft;
    let isRanged = d.category === 'ranged';
    let deltas = {};

    if (d.dmgTier !== orig.dmgTier) {
        let lo = Math.min(d.dmgTier, orig.dmgTier), hi = Math.max(d.dmgTier, orig.dmgTier);
        let costSum = 0;
        for (let i = lo + 1; i <= hi; i++) costSum += WEAPON_DMG_TIERS[i].cost;
        costSum *= (isRanged ? 2 : 1);
        deltas.dmgTier = { direction: d.dmgTier > orig.dmgTier ? 'up' : 'down', costPortion: costSum, units: hi - lo };
    }
    if (d.critTier !== orig.critTier) {
        let lo = Math.min(d.critTier, orig.critTier), hi = Math.max(d.critTier, orig.critTier);
        let costSum = 0;
        for (let i = lo + 1; i <= hi; i++) costSum += WEAPON_CRIT_TIERS[i].cost;
        deltas.critTier = { direction: d.critTier > orig.critTier ? 'up' : 'down', costPortion: costSum, units: hi - lo };
    }
    if (isRanged && d.rangeTier !== orig.rangeTier) {
        let costDiff = WEAPON_RANGE_TIERS[d.rangeTier].cost - WEAPON_RANGE_TIERS[orig.rangeTier].cost;
        deltas.rangeTier = { direction: costDiff > 0 ? 'up' : 'down', costPortion: Math.abs(costDiff), units: 1 };
    }
    WEAPON_PROPERTIES.forEach(p => {
        if (!!d.properties[p.key] !== !!orig.properties[p.key]) {
            deltas['prop_' + p.key] = { direction: d.properties[p.key] ? 'up' : 'down', costPortion: p.cost, units: 1 };
        }
    });
    if (!!d.elemental !== !!orig.elemental) {
        deltas.elemental = { direction: d.elemental ? 'up' : 'down', costPortion: WEAPON_ELEMENTAL_COST, units: 1 };
    }
    return deltas;
}

function revertComponent(draft, key) {
    if (key === 'dmgTier') draft.dmgTier = weaponForgeOriginalDraft.dmgTier;
    else if (key === 'critTier') draft.critTier = weaponForgeOriginalDraft.critTier;
    else if (key === 'rangeTier') draft.rangeTier = weaponForgeOriginalDraft.rangeTier;
    else if (key === 'elemental') draft.elemental = weaponForgeOriginalDraft.elemental;
    else if (key.startsWith('prop_')) draft.properties[key.slice(5)] = weaponForgeOriginalDraft.properties[key.slice(5)];
}

function weaponForgeCraftMath() {
    let totals = window.weaponForgeCalcTotals();
    let nominalDelta = Math.max(0, totals.cost - weaponForgeBasePaid);
    let { bsRank, artisanRank } = craftPerkRanks();
    let craftAttr = (bsRank >= 1) ? (window.state.craftSkillPref || 'INT') : 'INT';
    if (craftAttr === 'STR' && bsRank < 1) craftAttr = 'INT';

    let dc = 10 + Math.ceil(nominalDelta / 100);
    let hours = nominalDelta === 0 ? 0 : Math.max(1, Math.ceil(nominalDelta / 100));
    if (craftAttr === 'STR' && bsRank >= 4) hours = nominalDelta === 0 ? 0 : Math.max(1, Math.floor(hours / 2));
    if (weaponForgeSpecialized && artisanRank >= 4) hours = nominalDelta === 0 ? 0 : Math.max(1, Math.floor(hours / 2));

    let mats = craftMaterialsForCost(nominalDelta, { bsRank, artisanRank, specialized: weaponForgeSpecialized });
    let hasFailRecovery = craftHasFailRecovery(craftAttr, bsRank, artisanRank);

    return { totals, nominalDelta, bsRank, artisanRank, craftAttr, dc, hours, minRareCt: mats.minRareCt, minUncommonCt: mats.minUncommonCt, commonCt: mats.commonCt, hasFailRecovery };
}

// ------------------------------------------------------------------
// Applies a final draft to state.weapons -- either updating the weapon
// being edited, or pushing a new one. `batches` is the craftBatches
// object (existing weapon's, or a fresh {} for a brand new one).
// ------------------------------------------------------------------
function applyWeaponForgeFinal(finalDraft, batches) {
    let totals = window.weaponForgeCalcTotals(finalDraft);
    let name = document.getElementById('weaponForgeName').value ||
        (finalDraft.category === 'melee' ? 'Custom Melee Weapon' : 'Custom Ranged Weapon');
    let existing = weaponForgeEditIndex !== null ? getTargetWeapons()[weaponForgeEditIndex] : null;
    // Ranged attacks always use AGI regardless of weight class (Ch.9); only
    // melee Heavy forces STR. Preserve the player's existing choice when editing.
    let defaultAttr = finalDraft.category === 'ranged' ? 'AGI' : 'STR';

    let weaponObj = {
        name,
        attr: existing ? existing.attr : defaultAttr,
        tr: existing ? existing.tr : false,
        dmg: totals.dice, ap: totals.ap, isUnarmed: false,
        forged: true,
        category: finalDraft.category, weightClass: finalDraft.weightClass,
        dmgType: finalDraft.dmgType, critMult: totals.critMult, range: totals.range,
        elemental: finalDraft.elemental, properties: { ...finalDraft.properties },
        weight: totals.weight, paidCost: totals.cost,
        craftBatches: batches
    };

    if (weaponForgeEditIndex !== null) {
        getTargetWeapons()[weaponForgeEditIndex] = weaponObj;
    } else {
        // If there's no free hand for it right now, the weapon still gets
        // made -- it just goes straight to inventory instead of the
        // equipped weapons list, ready to equip whenever a hand frees up.
        // Building something you can't immediately wield isn't invalid;
        // refusing to let the player have it at all was the wrong call.
        if (weaponForgeTarget !== 'companion' && typeof window.calcTotalHands === 'function') {
            getTargetWeapons().push(weaponObj);
            let handsFree = window.calcTotalHands() - window.calcHandsUsed();
            if (handsFree < 0) {
                getTargetWeapons().pop();
                let existing = window.state.items.find(i => i.isWeapon && window.weaponsAreStackable && window.weaponsAreStackable(i.weaponData, weaponObj));
                if (existing) {
                    existing.ct += 1;
                } else {
                    window.state.items.push({
                        name: weaponObj.name, wt: weaponObj.weight || 0, ct: 1, val: weaponObj.paidCost || 0,
                        isWeapon: true, isLocked: true, weaponData: JSON.parse(JSON.stringify(weaponObj)),
                        desc: `Weapon: ${weaponObj.dmg} damage, ${weaponObj.ap} AP`
                    });
                }
                window.showConfirm(`${name} was forged, but you don't have a free hand for it right now -- it's been added to your inventory instead. Equip it whenever you free up a hand.`, null, true);
            }
        } else {
            getTargetWeapons().push(weaponObj);
        }
    }

    window.closeModal('weaponCraftModal');
    window.closeModal('weaponForgeModal');
    window.recalculateMath();
    // The underlying NPC Crafter modal (still open behind this one when
    // target is 'companion' or 'gm') has its own independent render cycle
    // -- nothing else would tell its Step 5 list to refresh with the newly
    // equipped weapon until it was manually reopened.
    if ((weaponForgeTarget === 'companion' || weaponForgeTarget === 'gm') && typeof ncRenderAll === 'function') ncRenderAll();
}

// A GM designing an NPC isn't buying or crafting anything -- no Currency,
// no Crafting Materials, no roll. This just finalizes whatever's currently
// configured directly onto the NPC for free.
window.gmAddWeaponFree = function() {
    let batches = weaponForgeEditIndex !== null ? getTargetWeapons()[weaponForgeEditIndex].craftBatches : {};
    applyWeaponForgeFinal(weaponForgeDraft, batches);
};

// ------------------------------------------------------------------
// Purchase: Currency only, no roll, always "succeeds" instantly.
// Decreases are honored (lower the paid-for total) but never refund
// Currency, and any crafted-material history for the removed units is
// discarded (not refunded) since Purchase never invested materials.
// ------------------------------------------------------------------
window.purchaseWeapon = function() {
    let totals = window.weaponForgeCalcTotals();
    let delta = Math.max(0, totals.cost - weaponForgeBasePaid);
    let deltas = weaponForgeComponentDeltas();
    let decreasedKeys = Object.keys(deltas).filter(k => deltas[k].direction === 'down');
    let batches = weaponForgeEditIndex !== null ? getTargetWeapons()[weaponForgeEditIndex].craftBatches : {};

    let doPurchase = () => {
        decreasedKeys.forEach(key => {
            if (key === 'dmgTier') craftReconcileBatchesDown(batches, key, weaponForgeDraft.dmgTier);
            else if (key === 'critTier') craftReconcileBatchesDown(batches, key, weaponForgeDraft.critTier);
            else if (key === 'rangeTier') { batches.rangeTier = []; } // not cumulative -- always a full replace
            else { craftReconcileBatchesDown(batches, key, 0); } // properties/elemental: fully off
        });
        window.state.currency = (window.state.currency || 0) - delta;
        applyWeaponForgeFinal(weaponForgeDraft, batches);
    };

    if (delta > (window.state.currency || 0)) {
        window.showConfirm(`You need ${delta} Currency but only have ${window.state.currency || 0}. Purchase anyway (currency will go negative)?`, doPurchase);
        return;
    }
    doPurchase();
};

// ------------------------------------------------------------------
// Craft: Materials + a DC roll for the ADDED components only. Removed
// components always succeed and refund materials. Perk-aware, exactly
// mirroring the Armor Forge (see apx-craft-shared.js).
// ------------------------------------------------------------------
window.openWeaponCraftModal = function() {
    weaponForgeSpecialized = false;
    window.renderWeaponCraftBody();
    window.openModal('weaponCraftModal');
};

window.setWeaponCraftAttr = function(val) {
    window.state.craftSkillPref = val;
    window.renderWeaponCraftBody();
};

window.setWeaponCraftSpecialized = function(checked) {
    weaponForgeSpecialized = checked;
    window.renderWeaponCraftBody();
};

window.renderWeaponCraftBody = function() {
    let m = weaponForgeCraftMath();
    let deltas = weaponForgeComponentDeltas();
    let increasedKeys = Object.keys(deltas).filter(k => deltas[k].direction === 'up');
    let hasRemovals = Object.keys(deltas).some(k => deltas[k].direction === 'down');
    let craftingBaseOnly = m.nominalDelta > 0 && increasedKeys.length === 0;

    let have = craftMaterialCounts();
    let need = { common: m.commonCt, uncommon: m.minUncommonCt, rare: m.minRareCt };
    let canAfford = have.common >= need.common && have.uncommon >= need.uncommon && have.rare >= need.rare;

    let matRowsHtml = [['Common', 'common'], ['Uncommon', 'uncommon'], ['Rare', 'rare']].map(([label, k]) => {
        let ok = have[k] >= need[k];
        return `<div class="flex justify-between text-xs py-1 ${ok ? 'text-slate-300' : 'text-red-400 font-bold'}">
            <span>${label} Crafting Materials</span>
            <span>${need[k]} needed <span class="text-slate-500">(have ${have[k]})</span></span>
        </div>`;
    }).join('');

    let strToggle = m.bsRank >= 1 ? `
        <div class="flex items-center gap-3 mb-3 bg-slate-900 border border-slate-700 rounded p-2">
            <span class="text-[10px] text-slate-400 font-bold uppercase">Craft with:</span>
            <label class="flex items-center gap-1 text-xs text-white"><input type="radio" name="wpnCraftAttr" ${window.state.craftSkillPref !== 'STR' ? 'checked' : ''} onchange="window.setWeaponCraftAttr('INT')"> INT (Craft)</label>
            <label class="flex items-center gap-1 text-xs text-white"><input type="radio" name="wpnCraftAttr" ${window.state.craftSkillPref === 'STR' ? 'checked' : ''} onchange="window.setWeaponCraftAttr('STR')"> STR (Craft) <span class="text-[9px] text-slate-500">(Black Smith)</span></label>
        </div>
    ` : '';

    let specToggle = m.artisanRank >= 1 ? `
        <label class="flex items-center gap-2 mb-3 bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white cursor-pointer">
            <input type="checkbox" ${weaponForgeSpecialized ? 'checked' : ''} onchange="window.setWeaponCraftSpecialized(this.checked)">
            This weapon falls under one of my Artisan Specializations
        </label>
    ` : '';

    let craftBonus = craftBonusFor(m.craftAttr);

    let removalsHtml = hasRemovals ? `
        <div class="text-[10px] text-emerald-400 font-bold mt-3 text-center">Removed components always succeed and refund half their original crafting materials automatically -- no roll needed for those.</div>
    ` : '';

    document.getElementById('weaponCraftBody').innerHTML = `
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
        <div class="text-[10px] text-slate-500 uppercase font-bold mb-1">Materials Required (${m.nominalDelta} Cu of ${craftingBaseOnly ? 'the unpaid Base Weapon -- no upgrades selected' : 'new upgrades'}${m.bsRank >= 5 || (weaponForgeSpecialized && m.artisanRank >= 2) ? ', discounted' : ''})</div>
        <div class="bg-slate-900 border border-slate-700 rounded p-3">${m.nominalDelta === 0 ? '<div class="text-xs text-slate-500 text-center">No new upgrades to craft.</div>' : matRowsHtml}</div>
        ${craftingBaseOnly ? '<div class="text-[10px] text-amber-400 mt-2 text-center">No upgrades are selected -- this attempt is only to craft the Base Weapon itself (it isn\'t free). Failing it wastes the materials above but grants nothing.</div>' : ''}
        ${!canAfford && m.nominalDelta > 0 ? '<div class="text-[11px] text-red-400 font-bold mt-2 text-center">Not enough Crafting Materials on hand for a Success/partial-Fail outcome.</div>' : ''}
        ${removalsHtml}

        ${m.nominalDelta > 0 ? `
        <div class="mt-4 bg-slate-900 border border-orange-800/50 rounded-lg p-3">
            <div class="text-[10px] text-slate-500 uppercase font-bold mb-1 text-center">Your Craft Check</div>
            <div class="text-center text-xs text-slate-400 mb-2">${m.craftAttr} (Craft) bonus: <span class="font-bold text-white">${craftBonus >= 0 ? '+' : ''}${craftBonus}</span> vs DC <span class="font-bold text-white">${m.dc}</span></div>
            <button onclick="window.weaponForgeRollForMe()" class="w-full bg-indigo-600/20 border border-indigo-700/50 text-indigo-300 hover:bg-indigo-600/40 text-xs font-bold py-2 rounded transition mb-3">🎲 Roll For Me</button>
            <div class="text-[10px] text-slate-500 uppercase font-bold mb-1 text-center">Or Enter Your Own Roll's Outcome</div>
            <div class="grid grid-cols-3 gap-2">
                <button onclick="window.weaponForgeApplyOutcome('success')" ${!canAfford ? 'disabled' : ''} class="px-2 py-2 rounded ${!canAfford ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'} text-xs font-bold transition">Success</button>
                <button onclick="window.weaponForgeApplyOutcome('fail')" class="px-2 py-2 rounded bg-amber-700 hover:bg-amber-600 text-white text-xs font-bold transition">Failed<br><span class="text-[9px] font-normal">${m.hasFailRecovery ? '(half mats back)' : '(all mats lost)'}</span></button>
                <button onclick="window.weaponForgeApplyOutcome('failhard')" class="px-2 py-2 rounded bg-red-700 hover:bg-red-600 text-white text-xs font-bold transition">Failed by 5+<br><span class="text-[9px] font-normal">/ Crit Fail</span></button>
            </div>
        </div>
        ` : `<div class="flex justify-end mt-4"><button onclick="window.weaponForgeApplyOutcome('success')" class="px-6 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black transition">Confirm (Removals Only)</button></div>`}

        <div class="flex justify-end mt-3">
            <button onclick="window.closeModal('weaponCraftModal')" class="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold transition">Cancel</button>
        </div>
    `;
};

window.weaponForgeRollForMe = function() {
    let m = weaponForgeCraftMath();
    let craftBonus = craftBonusFor(m.craftAttr);
    let d20 = 1 + Math.floor(Math.random() * 20);
    let result = craftRollOutcome(d20, craftBonus, m.dc);

    window.showConfirm(`Rolled ${d20} + ${craftBonus} = ${result.total} vs DC ${m.dc}.\nResult: ${result.label}.\n\nApply this result?`, () => {
        window.weaponForgeApplyOutcome(result.outcome);
    });
};

window.weaponForgeApplyOutcome = function(outcome) {
    let m = weaponForgeCraftMath();
    let deltas = weaponForgeComponentDeltas();
    let increasedKeys = Object.keys(deltas).filter(k => deltas[k].direction === 'up');
    let decreasedKeys = Object.keys(deltas).filter(k => deltas[k].direction === 'down');

    // Guard against spending materials the player doesn't have.
    if (m.nominalDelta > 0) {
        let need = { common: m.commonCt, uncommon: m.minUncommonCt, rare: m.minRareCt };
        let have = craftMaterialCounts();
        if (have.common < need.common || have.uncommon < need.uncommon || have.rare < need.rare) {
            window.showConfirm("Not enough Crafting Materials on hand to attempt this craft.", null, true);
            return;
        }
    }

    let batches = weaponForgeEditIndex !== null ? getTargetWeapons()[weaponForgeEditIndex].craftBatches : {};

    // Removals always succeed, no check needed.
    let totalRefund = { common: 0, uncommon: 0, rare: 0 };
    decreasedKeys.forEach(key => {
        let refund = craftPopRefund(batches, key, deltas[key].units);
        totalRefund.common += refund.common;
        totalRefund.uncommon += refund.uncommon;
        totalRefund.rare += refund.rare;
    });
    craftAddMaterials(totalRefund);

    // Build the final draft: removals always land; additions land only on
    // success (a failed attempt reverts each added component individually).
    let finalDraft = JSON.parse(JSON.stringify(weaponForgeDraft));
    if (outcome !== 'success') {
        increasedKeys.forEach(key => revertComponent(finalDraft, key));
    }

    if (m.nominalDelta > 0) {
        let need = { common: m.commonCt, uncommon: m.minUncommonCt, rare: m.minRareCt };
        let spend;

        if (outcome === 'success') {
            spend = { ...need };
        } else if (outcome === 'fail' && m.hasFailRecovery) {
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
            let totalCostShare = increasedKeys.reduce((s, k) => s + deltas[k].costPortion, 0);
            increasedKeys.forEach(key => {
                let frac = totalCostShare > 0 ? (deltas[key].costPortion / totalCostShare) : 0;
                let cP = Math.floor(spend.common * frac), uP = Math.floor(spend.uncommon * frac), rP = Math.floor(spend.rare * frac);
                if (key === 'rangeTier') batches.rangeTier = []; // not cumulative -- replace, don't stack
                craftPushBatch(batches, key, deltas[key].units, cP, uP, rP);
            });
        }
    }

    // The Base Weapon itself costs Currency and has to be earned like
    // anything else. If nothing has ever been paid for this weapon and this
    // session neither succeeded nor removed anything, there's nothing to
    // commit -- don't let a failed roll manifest a weapon out of nowhere.
    let earnedSomething = (outcome === 'success') || decreasedKeys.length > 0 || weaponForgeBasePaid > 0;
    if (!earnedSomething) {
        window.closeModal('weaponCraftModal');
        window.closeModal('weaponForgeModal');
        window.recalculateMath();
        return;
    }

    applyWeaponForgeFinal(finalDraft, batches);
};
