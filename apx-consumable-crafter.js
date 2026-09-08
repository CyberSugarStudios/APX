// ============================================================
// APX Character Sheet — Consumable Item Crafter
// Chapter 8: "APX allows you to build custom consumable items using
// the exact same framework as the Power Crafter Perk." Reuses the
// same Step 1/2/3/4/5/6/8 data tables as Powers, but: no AP step
// (always 3 AP flat), capped at 30 XP total, converts to Currency at
// 25 Cu per XP for the first charge, weighs 1 lb per XP spent, and
// each additional charge beyond the first costs half the first
// charge's price.
// ============================================================

let ccDraft = null;
let ccStep = 1;
const CC_LAST_STEP = 7;

function getBlankConsumableDraft() {
    return {
        step1: 'atkSave', step2: 'touch', aoe: 'single',
        dmg: { d4: 0, d6: 0, d8: 0, d10: 0, d12: 0 },
        isHealing: false, dmgType: 'Fire',
        addSecondType: false, addFlatDmgPerDie: false, addAttrToDmg: false,
        utility: { minor: {}, moderate: {}, major: {}, master: {} },
        duration: 'instant', durationMods: { dmgInterrupt: false, actionInterrupt: false },
        refunds: { minorRestriction: 0, concentration: false, overexertion: false, sacrifice: false, costly: 0 },
        flavorText: "",
        charges: 1
    };
}

window.ccCalcXP = function(draft) {
    let step1Def = POWER_STEP1.find(s => s.key === draft.step1);
    let step2Def = POWER_STEP2_RANGE.find(s => s.key === draft.step2);
    let aoeDef = POWER_STEP3_AOE.find(s => s.key === draft.aoe);

    let step1Cost = step1Def.cost;
    let step2Cost = step2Def.cost;

    let totalDiceCount = POWER_DIE_STEPS.reduce((s, step) => s + (draft.dmg[step] || 0), 0);
    let perDieCost = POWER_DIE_STEPS.reduce((s, step) => s + POWER_DIE_COSTS[step] * (draft.dmg[step] || 0), 0);
    if (draft.step1 === 'guaranteed') perDieCost *= 2;
    let dieCostMultiplied = perDieCost * aoeDef.mult;
    let secondTypeCost = (draft.addSecondType && totalDiceCount > 0) ? 5 : 0;
    let flatDmgCost = draft.addFlatDmgPerDie ? totalDiceCount : 0;
    let attrToDmgCost = draft.addAttrToDmg ? 10 : 0;
    let step4Cost = dieCostMultiplied + secondTypeCost + flatDmgCost + attrToDmgCost;

    let step5Cost = 0;
    ['minor', 'moderate', 'major', 'master'].forEach(tier => {
        let basePrice = { minor: 5, moderate: 15, major: 30, master: 50 }[tier];
        if (draft.step1 === 'hpPool') basePrice = Math.max(0, basePrice - 10);
        Object.keys(draft.utility[tier]).forEach(key => {
            let count = draft.utility[tier][key] || 0;
            step5Cost += count * basePrice * aoeDef.mult;
        });
    });

    let durationDef = POWER_DURATION.find(d => d.key === draft.duration);
    let step6Cost = durationDef.cost;
    if (draft.durationMods.dmgInterrupt) step6Cost -= 5;
    if (draft.durationMods.actionInterrupt) step6Cost -= 10;

    let step7Cost = 0;
    step7Cost -= 5 * (draft.refunds.minorRestriction || 0);
    if (draft.refunds.concentration) step7Cost -= 10;
    if (draft.refunds.overexertion) step7Cost -= 15;
    if (draft.refunds.sacrifice) step7Cost -= 20;
    if (draft.refunds.costly) step7Cost += draft.refunds.costly;

    let total = Math.max(0, step1Cost + step2Cost + step4Cost + step5Cost + step6Cost + step7Cost);

    let firstChargeCost = total * 25;
    let perAdditionalCharge = Math.floor(firstChargeCost / 2);
    let charges = Math.max(1, draft.charges || 1);
    let totalCost = firstChargeCost + (charges - 1) * perAdditionalCharge;
    let weight = total; // 1 lb per XP spent (RAW doesn't scale this by charge count)

    return {
        step1Cost, step2Cost, step4Cost, step5Cost, step6Cost, step7Cost, total,
        totalDiceCount, overCap: total > 30, firstChargeCost, perAdditionalCharge, charges, totalCost, weight, ap: 3
    };
};

window.openConsumableCrafter = function() {
    ccDraft = getBlankConsumableDraft();
    ccStep = 1;
    document.getElementById('ccName').value = '';

    for (let i = 1; i <= CC_LAST_STEP; i++) {
        document.getElementById(`ccStep${i}`).classList.toggle('active', i === 1);
    }
    document.getElementById('ccBtnPrev').style.display = 'none';
    document.getElementById('ccBtnNext').style.display = 'block';
    document.getElementById('ccBtnFinish').style.display = 'none';

    ccRenderAll();
    window.updateWizardTabs('ccTab', 1, CC_LAST_STEP);
    window.openModal('consumableCrafterModal');
};

window.navConsumableCrafter = function(dir) {
    window.jumpToCcStep(ccStep + dir);
};

window.jumpToCcStep = function(n) {
    if (n < 1 || n > CC_LAST_STEP) return;
    document.getElementById(`ccStep${ccStep}`).classList.remove('active');
    ccStep = n;
    document.getElementById(`ccStep${ccStep}`).classList.add('active');
    document.getElementById('ccBtnPrev').style.display = ccStep > 1 ? 'block' : 'none';
    document.getElementById('ccBtnNext').style.display = ccStep < CC_LAST_STEP ? 'block' : 'none';
    document.getElementById('ccBtnFinish').style.display = ccStep === CC_LAST_STEP ? 'block' : 'none';
    if (ccStep === CC_LAST_STEP) ccRenderStep7();
    window.updateWizardTabs('ccTab', ccStep, CC_LAST_STEP);
};

// ------------------------------------------------------------------
// Field setters (mirrors the Power Crafter's, operating on ccDraft)
// ------------------------------------------------------------------
window.ccSetStep1 = function(val) { ccDraft.step1 = val; ccRenderAll(); };
window.ccSetStep2 = function(val) { ccDraft.step2 = val; ccRenderAll(); };
window.ccSetAoe = function(val) { ccDraft.aoe = val; ccRenderAll(); };
window.ccSetDie = function(step, delta) {
    let cur = ccDraft.dmg[step] || 0;
    let next = Math.max(0, Math.min(12, cur + delta));
    ccDraft.dmg[step] = next;
    ccRenderAll();
};
window.ccSetHealing = function(checked) { ccDraft.isHealing = checked; ccRenderAll(); };
window.ccSetDmgType = function(val) { ccDraft.dmgType = val; };
window.ccToggleSecondType = function(checked) { ccDraft.addSecondType = checked; ccRenderAll(); };
window.ccToggleFlatDmg = function(checked) { ccDraft.addFlatDmgPerDie = checked; ccRenderAll(); };
window.ccToggleAttrToDmg = function(checked) { ccDraft.addAttrToDmg = checked; ccRenderAll(); };

window.ccSetUtilityCount = function(tier, key, delta) {
    let cur = ccDraft.utility[tier][key] || 0;
    let entry = POWER_UTILITY[tier].find(u => u.key === key);
    let max = entry.rep ? 20 : 1;
    let next = Math.max(0, Math.min(max, cur + delta));
    if (next === 0) delete ccDraft.utility[tier][key];
    else ccDraft.utility[tier][key] = next;
    ccRenderAll();
};

window.ccSetDuration = function(val) {
    ccDraft.duration = val;
    if (!ccDurationAllowsInterrupts(val)) {
        ccDraft.durationMods.dmgInterrupt = false;
        ccDraft.durationMods.actionInterrupt = false;
    }
    ccRenderAll();
};
function ccDurationAllowsInterrupts(durationKey) { return durationKey !== 'instant'; }
window.ccToggleDurationMod = function(key, checked) {
    if (checked && !ccDurationAllowsInterrupts(ccDraft.duration)) return;
    ccDraft.durationMods[key] = checked;
    ccRenderAll();
};

window.ccSetMinorRestriction = function(delta) {
    let next = Math.max(0, Math.min(10, (ccDraft.refunds.minorRestriction || 0) + delta));
    ccDraft.refunds.minorRestriction = next;
    ccRenderAll();
};
window.ccToggleRefund = function(key, checked) { ccDraft.refunds[key] = checked; ccRenderAll(); };
window.ccSetCostly = function(val) { ccDraft.refunds.costly = parseInt(val) || 0; ccRenderAll(); };
window.ccSetCharges = function(val) {
    let n = parseInt(val) || 1;
    if (n < 1) n = 1;
    ccDraft.charges = n;
    ccRenderSummary();
};
window.ccSetFlavorText = function(val) { ccDraft.flavorText = val; };

// ------------------------------------------------------------------
// Rendering -- steps 1/2/3/4/5/6 are near-identical to the Power
// Crafter's; step 7 combines Refunds + Charges + Flavor Text (no
// separate AP-modification step exists for consumables).
// ------------------------------------------------------------------
function ccRenderAll() {
    ccRenderStep1(); ccRenderStep2(); ccRenderStep3(); ccRenderStep4();
    ccRenderStep5(); ccRenderStep6(); ccRenderStep7(); ccRenderSummary();
}

function ccRenderStep1() {
    document.getElementById('ccStep1Options').innerHTML = POWER_STEP1.map(s => `
        <label class="flex items-start gap-2 bg-slate-900 border ${ccDraft.step1 === s.key ? 'border-purple-500' : 'border-slate-700'} rounded p-2 cursor-pointer">
            <input type="radio" name="ccStep1" class="mt-1" ${ccDraft.step1 === s.key ? 'checked' : ''} onchange="window.ccSetStep1('${s.key}')">
            <div><div class="text-xs font-bold text-slate-200">${s.label} <span class="text-yellow-500">[${s.cost} XP]</span></div><div class="text-[10px] text-slate-500 leading-tight">${s.desc}</div></div>
        </label>
    `).join('');
}
function ccRenderStep2() {
    document.getElementById('ccStep2Options').innerHTML = POWER_STEP2_RANGE.map(s => `
        <label class="flex items-start gap-2 bg-slate-900 border ${ccDraft.step2 === s.key ? 'border-purple-500' : 'border-slate-700'} rounded p-2 cursor-pointer">
            <input type="radio" name="ccStep2" class="mt-1" ${ccDraft.step2 === s.key ? 'checked' : ''} onchange="window.ccSetStep2('${s.key}')">
            <div><div class="text-xs font-bold text-slate-200">${s.label} <span class="text-yellow-500">[${s.cost} XP]</span></div><div class="text-[10px] text-slate-500 leading-tight">${s.desc}</div></div>
        </label>
    `).join('');
}
function ccRenderStep3() {
    document.getElementById('ccStep3Options').innerHTML = POWER_STEP3_AOE.map(s => `
        <label class="flex items-start gap-2 bg-slate-900 border ${ccDraft.aoe === s.key ? 'border-purple-500' : 'border-slate-700'} rounded p-2 cursor-pointer">
            <input type="radio" name="ccAoe" class="mt-1" ${ccDraft.aoe === s.key ? 'checked' : ''} onchange="window.ccSetAoe('${s.key}')">
            <div><div class="text-xs font-bold text-slate-200">${s.label} <span class="text-yellow-500">[x${s.mult}]</span></div><div class="text-[10px] text-slate-500 leading-tight">${s.desc}</div></div>
        </label>
    `).join('');
}
function ccRenderStep4() {
    let t = window.ccCalcXP(ccDraft);
    let dieRows = POWER_DIE_STEPS.map(step => `
        <div class="flex items-center justify-between bg-slate-900 border border-slate-700 rounded px-3 py-1.5">
            <span class="text-xs font-bold text-white">${step} <span class="text-[10px] text-slate-500">(${POWER_DIE_COSTS[step]} XP/die${ccDraft.step1 === 'guaranteed' ? ', x2 Guaranteed Hit' : ''})</span></span>
            <div class="flex items-center gap-2">
                <button onclick="window.ccSetDie('${step}', -1)" class="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-white font-bold">-</button>
                <span class="w-6 text-center font-bold text-sm text-white">${ccDraft.dmg[step]}</span>
                <button onclick="window.ccSetDie('${step}', 1)" class="w-6 h-6 rounded bg-amber-700 hover:bg-amber-600 text-white font-bold">+</button>
            </div>
        </div>
    `).join('');
    document.getElementById('ccStep4Dice').innerHTML = dieRows;
    let verb = ccDraft.isHealing ? 'healing' : 'damage';
    document.getElementById('ccStep4Extras').innerHTML = `
        <label class="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white cursor-pointer">
            <input type="checkbox" ${ccDraft.isHealing ? 'checked' : ''} onchange="window.ccSetHealing(this.checked)"> This item Heals instead of dealing Damage
        </label>
        ${!ccDraft.isHealing ? `
        <div class="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded p-2">
            <span class="text-xs text-white font-bold">Damage Type:</span>
            <select onchange="window.ccSetDmgType(this.value)" class="bg-slate-800 text-xs">
                ${["Bludgeoning","Piercing","Slashing","Fire","Cold","Electric","Acid","Poison","Sonic","Radiation","Force","Psychic"].map(t => `<option value="${t}" ${ccDraft.dmgType===t?'selected':''}>${t}</option>`).join('')}
            </select>
        </div>
        <label class="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white cursor-pointer">
            <input type="checkbox" ${ccDraft.addSecondType ? 'checked' : ''} onchange="window.ccToggleSecondType(this.checked)"> Add a second damage type, splitting the dice [+5 XP]
        </label>` : ''}
        <label class="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white cursor-pointer">
            <input type="checkbox" ${ccDraft.addFlatDmgPerDie ? 'checked' : ''} onchange="window.ccToggleFlatDmg(this.checked)"> +1 ${verb} per die [1 XP/die -- ${t.totalDiceCount} XP]
        </label>
        <label class="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white cursor-pointer">
            <input type="checkbox" ${ccDraft.addAttrToDmg ? 'checked' : ''} onchange="window.ccToggleAttrToDmg(this.checked)"> Add Power Attribute modifier to ${verb} [+10 XP]
        </label>
    `;
}
function ccRenderUtilityTier(tier, label, colorClass) {
    let rows = POWER_UTILITY[tier].map(u => {
        let count = ccDraft.utility[tier][u.key] || 0;
        return `
            <div class="flex items-center justify-between bg-slate-900 border border-slate-700 rounded px-2 py-1.5 gap-2">
                <div class="flex-1 text-[10px] text-slate-300 leading-tight">${u.label}${u.rep ? ' <span class="text-slate-600">(repeatable)</span>' : ''}</div>
                <div class="flex items-center gap-1 shrink-0">
                    <button onclick="window.ccSetUtilityCount('${tier}','${u.key}', -1)" ${count<=0?'disabled':''} class="w-5 h-5 rounded ${count<=0?'bg-slate-800 text-slate-600':'bg-slate-700 hover:bg-slate-600 text-white'} text-xs font-bold">-</button>
                    <span class="w-5 text-center text-xs font-bold text-white">${count}</span>
                    <button onclick="window.ccSetUtilityCount('${tier}','${u.key}', 1)" ${(!u.rep && count>=1)?'disabled':''} class="w-5 h-5 rounded ${(!u.rep && count>=1)?'bg-slate-800 text-slate-600':'bg-amber-700 hover:bg-amber-600 text-white'} text-xs font-bold">+</button>
                </div>
            </div>
        `;
    }).join('');
    return `<div class="mb-3"><div class="text-xs font-black ${colorClass} mb-1.5">${label}</div><div class="space-y-1">${rows}</div></div>`;
}
function ccRenderStep5() {
    let discountNote = ccDraft.step1 === 'hpPool' ? '<div class="text-[10px] text-emerald-400 mb-2">HP Capacity Pool: each Utility selection costs 10 XP less (min 0) before AoE multiplier.</div>' : '';
    document.getElementById('ccStep5List').innerHTML = discountNote +
        ccRenderUtilityTier('minor', 'Minor Utility (5 XP each)', 'text-emerald-400') +
        ccRenderUtilityTier('moderate', 'Moderate Utility (15 XP each)', 'text-blue-400') +
        ccRenderUtilityTier('major', 'Major Utility (30 XP each)', 'text-purple-400') +
        ccRenderUtilityTier('master', 'Master Utility (50 XP each)', 'text-red-400');
}
function ccRenderStep6() {
    document.getElementById('ccStep6Options').innerHTML = POWER_DURATION.map(d => `
        <label class="flex items-start gap-2 bg-slate-900 border ${ccDraft.duration === d.key ? 'border-purple-500' : 'border-slate-700'} rounded p-2 cursor-pointer">
            <input type="radio" name="ccDuration" class="mt-1" ${ccDraft.duration === d.key ? 'checked' : ''} onchange="window.ccSetDuration('${d.key}')">
            <div><div class="text-xs font-bold text-slate-200">${d.label} <span class="text-yellow-500">[${d.cost} XP]</span></div>${d.desc ? `<div class="text-[10px] text-slate-500 leading-tight">${d.desc}</div>` : ''}</div>
        </label>
    `).join('');
    let interruptsAllowed = ccDurationAllowsInterrupts(ccDraft.duration);
    document.getElementById('ccStep6Mods').innerHTML = POWER_DURATION_MODS.map(m => `
        <label class="flex items-start gap-2 bg-slate-900 border border-slate-700 rounded p-2 ${interruptsAllowed ? 'cursor-pointer' : 'opacity-40'}">
            <input type="checkbox" class="mt-1" ${ccDraft.durationMods[m.key] ? 'checked' : ''} ${interruptsAllowed ? '' : 'disabled'} onchange="window.ccToggleDurationMod('${m.key}', this.checked)">
            <div><div class="text-xs font-bold text-slate-200">${m.label} <span class="text-emerald-400">[${m.cost} XP]</span></div><div class="text-[10px] text-slate-500 leading-tight">${m.desc}</div></div>
        </label>
    `).join('') + (!interruptsAllowed ? '<div class="text-[10px] text-amber-400 mt-1">Interrupts require a Duration of 1 Minute or longer.</div>' : '');
}
function ccRenderStep7() {
    let mrDef = POWER_REFUNDS.find(r => r.key === 'minorRestriction');
    let mrCount = ccDraft.refunds.minorRestriction || 0;
    let minorRestrictionRow = `
        <div class="flex items-center justify-between bg-slate-900 border border-slate-700 rounded p-2 gap-2">
            <div class="flex-1"><div class="text-xs font-bold text-slate-200">${mrDef.label} <span class="text-emerald-400">[${mrDef.cost} XP each]</span></div><div class="text-[10px] text-slate-500 leading-tight">${mrDef.desc}</div></div>
            <div class="flex items-center gap-1 shrink-0">
                <button onclick="window.ccSetMinorRestriction(-1)" ${mrCount<=0?'disabled':''} class="w-6 h-6 rounded ${mrCount<=0?'bg-slate-800 text-slate-600':'bg-slate-700 hover:bg-slate-600 text-white'} font-bold">-</button>
                <span class="w-6 text-center font-bold text-sm text-white">${mrCount}</span>
                <button onclick="window.ccSetMinorRestriction(1)" class="w-6 h-6 rounded bg-amber-700 hover:bg-amber-600 text-white font-bold">+</button>
            </div>
        </div>
    `;
    let checkboxRows = POWER_REFUNDS.filter(r => r.key !== 'minorRestriction').map(r => `
        <label class="flex items-start gap-2 bg-slate-900 border border-slate-700 rounded p-2 cursor-pointer">
            <input type="checkbox" class="mt-1" ${ccDraft.refunds[r.key] ? 'checked' : ''} onchange="window.ccToggleRefund('${r.key}', this.checked)">
            <div><div class="text-xs font-bold text-slate-200">${r.label} <span class="text-emerald-400">[${r.cost} XP]</span></div><div class="text-[10px] text-slate-500 leading-tight">${r.desc}</div></div>
        </label>
    `).join('');
    let costlyRow = `
        <label class="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded p-2">
            <span class="text-xs font-bold text-slate-200">Costly (requires a rare/expensive component):</span>
            <select onchange="window.ccSetCostly(this.value)" class="bg-slate-800 text-xs ml-auto">
                <option value="0" ${ccDraft.refunds.costly===0?'selected':''}>Not Costly</option>
                <option value="-5" ${ccDraft.refunds.costly===-5?'selected':''}>-5 XP</option>
                <option value="-10" ${ccDraft.refunds.costly===-10?'selected':''}>-10 XP</option>
                <option value="-15" ${ccDraft.refunds.costly===-15?'selected':''}>-15 XP</option>
                <option value="-20" ${ccDraft.refunds.costly===-20?'selected':''}>-20 XP</option>
            </select>
        </label>
    `;
    document.getElementById('ccStep7Refunds').innerHTML = minorRestrictionRow + checkboxRows + costlyRow;

    let t = window.ccCalcXP(ccDraft);
    document.getElementById('ccStep7Reference').innerHTML = `A/S: ${POWER_STEP1.find(s=>s.key===ccDraft.step1).label} | R/A: ${POWER_STEP2_RANGE.find(s=>s.key===ccDraft.step2).label}${ccDraft.aoe!=='single' ? ' / ' + POWER_STEP3_AOE.find(s=>s.key===ccDraft.aoe).label : ''} | Duration: ${POWER_DURATION.find(d=>d.key===ccDraft.duration).label}`;
    let ta = document.getElementById('ccFlavorText');
    if (ta && ta.value !== ccDraft.flavorText) ta.value = ccDraft.flavorText;
    document.getElementById('ccChargesInput').value = ccDraft.charges;
}

function ccRenderSummary() {
    let t = window.ccCalcXP(ccDraft);
    document.getElementById('ccSumXp').innerText = t.total + ' / 30 XP';
    document.getElementById('ccSumXp').className = t.overCap ? 'text-lg font-black text-red-400' : 'text-lg font-black text-white';
    document.getElementById('ccSumWeight').innerText = t.weight + ' lb';
    document.getElementById('ccSumCost').innerText = t.totalCost + ' Cu';

    let capNote = document.getElementById('ccCapNote');
    if (t.overCap) {
        capNote.classList.remove('hidden');
        capNote.innerText = `Consumables can spend at most 30 XP total. Reduce this build by ${t.total - 30} XP.`;
    } else {
        capNote.classList.add('hidden');
    }

    let btn = document.getElementById('ccBtnFinish');
    btn.disabled = t.overCap;
    btn.innerText = `Add to Inventory (${t.totalCost} Cu, ${t.weight} lb)`;
    btn.className = btn.disabled
        ? 'px-6 py-2 rounded bg-slate-700 text-slate-500 cursor-not-allowed text-sm font-bold transition'
        : 'px-6 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition shadow-lg';
}

function ccBuildTextSummary(draftOverride) {
    let d = draftOverride || ccDraft;
    let t = window.ccCalcXP(d);
    let step1Def = POWER_STEP1.find(s => s.key === d.step1);
    let step2Def = POWER_STEP2_RANGE.find(s => s.key === d.step2);
    let aoeDef = POWER_STEP3_AOE.find(s => s.key === d.aoe);

    let atk = step1Def.label;
    let rng = step2Def.label;
    if (aoeDef.key !== 'single') rng += ' / ' + aoeDef.label;

    let dmg = '-';
    if (t.totalDiceCount > 0) {
        let diceStr = POWER_DIE_STEPS.filter(s => d.dmg[s] > 0).map(s => `${d.dmg[s]}${s}`).join('+');
        let flat = d.addFlatDmgPerDie ? `+${t.totalDiceCount}` : '';
        dmg = `${diceStr}${flat} ${d.isHealing ? '(Heal)' : d.dmgType}`;
    }

    let utilityBits = [];
    ['minor', 'moderate', 'major', 'master'].forEach(tier => {
        Object.keys(d.utility[tier]).forEach(key => {
            let entry = POWER_UTILITY[tier].find(u => u.key === key);
            let count = d.utility[tier][key];
            utilityBits.push(count > 1 ? `${entry.label} (x${count})` : entry.label);
        });
    });

    let durationDef = POWER_DURATION.find(dd => dd.key === d.duration);
    let descParts = [];
    if (utilityBits.length) descParts.push(utilityBits.join('; '));
    descParts.push('Duration: ' + durationDef.label);
    descParts.push(`A/S: ${atk} | R/A: ${rng} | D/H: ${dmg}`);

    return { desc: descParts.join(' | '), atk, rng, dmg, utilityBits, durationLabel: durationDef.label };
}
window.ccBuildTextSummary = ccBuildTextSummary;

// Full line-by-line breakdown of a consumable's build, for the inventory
// detail view ("show all Power Crafter Settings").
window.ccDetailLines = function(draft) {
    let step1Def = POWER_STEP1.find(s => s.key === draft.step1);
    let step2Def = POWER_STEP2_RANGE.find(s => s.key === draft.step2);
    let aoeDef = POWER_STEP3_AOE.find(s => s.key === draft.aoe);
    let durationDef = POWER_DURATION.find(d => d.key === draft.duration);
    let t = window.ccCalcXP(draft);

    let dmgLine = 'None';
    if (t.totalDiceCount > 0) {
        let diceStr = POWER_DIE_STEPS.filter(s => draft.dmg[s] > 0).map(s => `${draft.dmg[s]}${s}`).join('+');
        let flat = draft.addFlatDmgPerDie ? ` +${t.totalDiceCount}` : '';
        dmgLine = `${diceStr}${flat} ${draft.isHealing ? '(Heal)' : draft.dmgType}`;
        if (draft.addSecondType) dmgLine += ' (split w/ 2nd type)';
        if (draft.addAttrToDmg) dmgLine += ' +Attribute Mod';
    }

    let utilityLines = [];
    ['minor', 'moderate', 'major', 'master'].forEach(tier => {
        Object.keys(draft.utility[tier]).forEach(key => {
            let entry = POWER_UTILITY[tier].find(u => u.key === key);
            let count = draft.utility[tier][key];
            utilityLines.push(count > 1 ? `${entry.label} (x${count})` : entry.label);
        });
    });

    let durationLine = durationDef.label;
    if (draft.durationMods.dmgInterrupt) durationLine += ', Damage Interrupt';
    if (draft.durationMods.actionInterrupt) durationLine += ', Action Interrupt';

    let refundLines = [];
    if (draft.refunds.minorRestriction) refundLines.push(`Minor Restriction (x${draft.refunds.minorRestriction})`);
    if (draft.refunds.concentration) refundLines.push('Concentration');
    if (draft.refunds.overexertion) refundLines.push('Overexertion');
    if (draft.refunds.sacrifice) refundLines.push('Sacrifice');
    if (draft.refunds.costly) refundLines.push(`Costly (${draft.refunds.costly} XP)`);

    return [
        { label: 'Targeting', value: step1Def.label },
        { label: 'Range', value: step2Def.label },
        { label: 'Area of Effect', value: aoeDef.label },
        { label: 'Damage/Healing', value: dmgLine },
        { label: 'Utility', value: utilityLines.length ? utilityLines.join(', ') : 'None' },
        { label: 'Duration', value: durationLine },
        { label: 'Restrictions', value: refundLines.length ? refundLines.join(', ') : 'None' }
    ];
};

window.finishConsumableCrafter = function() {
    let t = window.ccCalcXP(ccDraft);
    if (t.overCap) return;

    let name = document.getElementById('ccName').value || 'Crafted Consumable';
    let summary = ccBuildTextSummary();
    let flavorText = (ccDraft.flavorText || '').trim() || summary.desc;

    window.closeModal('consumableCrafterModal');
    // Crafting a consumable still represents acquiring it -- ask whether
    // it's paid for out of Currency or GM-granted, same as any other
    // item added to inventory.
    window.askPayOrGrant(name, t.totalCost, (paid) => {
        window.state.items.push({
            name, wt: t.weight, ct: 1, val: t.totalCost,
            isConsumable: true,
            draft: JSON.parse(JSON.stringify(ccDraft)),
            charges: t.charges,
            chargesRemaining: t.charges,
            desc: flavorText
        });
        if (paid) window.state.currency = (window.state.currency || 0) - t.totalCost;
        window.recalculateMath();
    });
};
