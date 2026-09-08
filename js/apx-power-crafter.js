// ============================================================
// APX Character Sheet — Power Crafter Wizard
// 9 steps: Chapter 7's Power Crafter Perk (8 steps), plus a final
// Flavor Text step to turn the mechanical build into prose. Live XP
// total and computed Power Level shown throughout. Two entry points:
const DMG_TYPES = ["Bludgeoning","Piercing","Slashing","Fire","Cold","Electric","Acid","Poison","Sonic","Radiation","Force","Psychic"];
// the normal Power Crafter (costs XP from the unspent pool, capped at
// the character's currently unlocked max Power Level), and a free-
// power mode auto-offered the first time a new Int/Cha Powers rank is
// purchased (per Ch.7: "the first time you take a new Rank of this
// perk, you can make a Power you are capable of using for free").
// ============================================================

let pcDraft = null;
let pcStep = 1;
let pcFreeMode = false;
let pcEditIndex = null; // reserved for future "edit an existing crafted power" support
let pcTarget = 'player'; // 'player', 'companion', or 'gm' -- whose powers list this session edits
const PC_LAST_STEP = 9;

function getTargetPowers() {
    if (pcTarget === 'gm') return ncActiveCompanion().powers;
    return pcTarget !== 'player' ? window.state.companion.powers : window.state.powers;
}

// Companion powers are charged in Threat Points (Ch.15 Step 6's flat
// per-Level table), not XP -- the Power Crafter still builds the power
// using the normal XP-based math to determine its Level, but the actual
// cost charged against the companion's budget comes from that Level.
// Returns false (and applies nothing) if the delta can't be afforded.
function pcApplyCompanionTpDelta(newLevel, oldTp, usageType, maxCharges) {
    let newTp = window.npcPowerTotalTp(newLevel, usageType, maxCharges);
    let delta = newTp - (oldTp || 0);
    if (delta > 0) {
        if (pcTarget === 'gm') {
            window.ncEnsureTierForSpend(window.companionTpSpent() + delta);
        } else {
            let remaining = window.companionRemainingTp();
            if (delta > remaining) {
                window.showConfirm(`Not enough Threat Points. This costs ${delta} TP, you have ${remaining} remaining.`, null, true);
                return null;
            }
        }
    }
    return newTp;
}

function getBlankPowerDraft() {
    return {
        step1: 'atkSave', step2: 'touch', aoe: 'single',
        dmg: { d4: 0, d6: 0, d8: 0, d10: 0, d12: 0 },
        isHealing: false, dmgType: 'Fire',
        addSecondType: false, secondDmgType: 'Cold', addFlatDmgPerDie: false, addAttrToDmg: false,
        utility: { minor: {}, moderate: {}, major: {}, master: {} },
        duration: 'instant', durationMods: { dmgInterrupt: false, actionInterrupt: false },
        apMod: 'ap4',
        refunds: { minorRestriction: 0, concentration: false, overexertion: false, sacrifice: false, costly: 0 },
        flavorText: "",
        usageType: 'unlimited', maxCharges: 1, rechargeOn: 5 // GM/companion powers only
    };
}

function pcMaxUnlockedLevel() {
    let attr = window.state.powerAttr;
    return attr === 'INT' ? (window.state.perks['pwr_int'] || 0) : (window.state.perks['pwr_cha'] || 0);
}

// ------------------------------------------------------------------
// XP calculation, matching the book's step-by-step math exactly.
// ------------------------------------------------------------------
window.pcCalcXP = function(draft) {
    let step1Def = POWER_STEP1.find(s => s.key === draft.step1);
    let step2Def = POWER_STEP2_RANGE.find(s => s.key === draft.step2);
    let aoeDef = POWER_STEP3_AOE.find(s => s.key === draft.aoe);

    let step1Cost = step1Def.cost;
    let step2Cost = step2Def.cost;

    // Step 4: Damage or Healing. Only the die-table cost and Step 5 Utility
    // get multiplied by Area of Effect (Ch.7: "[AoE] applies a multiplier
    // to the cost of Damage Dice and Utility effects").
    let totalDiceCount = POWER_DIE_STEPS.reduce((s, step) => s + (draft.dmg[step] || 0), 0);
    let perDieCost = POWER_DIE_STEPS.reduce((s, step) => s + POWER_DIE_COSTS[step] * (draft.dmg[step] || 0), 0);
    if (draft.step1 === 'guaranteed') perDieCost *= 2;
    let dieCostMultiplied = perDieCost * aoeDef.mult;
    let secondTypeCost = (draft.addSecondType && totalDiceCount > 0) ? 5 : 0;
    let flatDmgCost = draft.addFlatDmgPerDie ? totalDiceCount : 0;
    let attrToDmgCost = draft.addAttrToDmg ? 10 : 0;
    let step4Cost = dieCostMultiplied + secondTypeCost + flatDmgCost + attrToDmgCost;

    // Step 5: Utility (AoE-multiplied; HP Capacity Pool discounts each
    // tier's per-selection price by 10, floored at 0, before that multiply).
    let step5Cost = 0;
    let step5Count = 0;
    ['minor', 'moderate', 'major', 'master'].forEach(tier => {
        let basePrice = { minor: 5, moderate: 15, major: 30, master: 50 }[tier];
        if (draft.step1 === 'hpPool') basePrice = Math.max(0, basePrice - 10);
        Object.keys(draft.utility[tier]).forEach(key => {
            let count = draft.utility[tier][key] || 0;
            step5Cost += count * basePrice * aoeDef.mult;
            step5Count += count;
        });
    });

    let durationDef = POWER_DURATION.find(d => d.key === draft.duration);
    let step6Cost = durationDef.cost;
    if (draft.durationMods.dmgInterrupt) step6Cost -= 5;
    if (draft.durationMods.actionInterrupt) step6Cost -= 10;

    let apDef = POWER_AP_MODS.find(a => a.key === draft.apMod);
    let step7Cost = apDef.cost;

    let step8Cost = 0;
    step8Cost -= 5 * (draft.refunds.minorRestriction || 0);
    if (draft.refunds.concentration) step8Cost -= 10;
    if (draft.refunds.overexertion) step8Cost -= 15;
    if (draft.refunds.sacrifice) step8Cost -= 20;
    if (draft.refunds.costly) step8Cost += draft.refunds.costly;

    let total = Math.max(0, step1Cost + step2Cost + step4Cost + step5Cost + step6Cost + step7Cost + step8Cost);
    let levelDef = POWER_LEVEL_TABLE.find(l => total >= l.min && total <= l.max) || POWER_LEVEL_TABLE[POWER_LEVEL_TABLE.length - 1];

    return {
        step1Cost, step2Cost, step4Cost, step5Cost, step6Cost, step7Cost, step8Cost, total,
        level: levelDef.level, totalDiceCount, ap: apDef.ap, step5Count
    };
};

// ------------------------------------------------------------------
// Open / navigate
// ------------------------------------------------------------------
function pcOpenCommon() {
    pcStep = 1;
    for (let i = 1; i <= PC_LAST_STEP; i++) {
        document.getElementById(`pcStep${i}`).classList.toggle('active', i === 1);
    }
    document.getElementById('pcBtnPrev').style.display = 'none';
    document.getElementById('pcBtnNext').style.display = 'block';
    pcRenderFreeBanner();
    pcRenderUsageSection();
    pcRenderAll();
    window.updateWizardTabs('pcTab', 1, PC_LAST_STEP);
    window.openModal('powerCrafterModal');
}

// Charges/Recharge/Unlimited is a GM-NPC-only concept -- players track
// their own power usage informally during play, so this section only
// shows for companion/GM targets.
function pcCurrentNpcTier() {
    if (pcTarget === 'gm') return npcTierForTP(window.companionTotalTp()).tier;
    if (pcTarget === 'companion') return typeof lcRank === 'function' ? lcRank() : 0;
    return 0;
}
function pcRenderUsageSection() {
    let section = document.getElementById('pcUsageTypeSection');
    if (!section) return; // the main character sheet's copy of this modal doesn't have this section -- Charges/Recharge is a GM/companion-only concept
    if (pcTarget === 'player') {
        section.classList.add('hidden');
        return;
    }
    section.classList.remove('hidden');
    if (!pcDraft.usageType) pcDraft.usageType = 'unlimited';

    let level = window.pcCalcXP(pcDraft).level;
    let tier = pcCurrentNpcTier();
    let eligible = window.npcUnlimitedUsesAllowed(level, tier);
    if (pcDraft.usageType === 'unlimitedPaid' && !eligible) pcDraft.usageType = 'unlimited'; // no longer eligible (level/tier changed) -- fall back rather than silently keep an illegal selection

    document.querySelector(`input[name="pcUsageType"][value="${pcDraft.usageType}"]`).checked = true;
    let unlimitedRadio = document.querySelector('input[name="pcUsageType"][value="unlimitedPaid"]');
    unlimitedRadio.disabled = !eligible;
    document.getElementById('pcUnlimitedPaidLabel').classList.toggle('opacity-40', !eligible);
    document.getElementById('pcUnlimitedPaidWarning').classList.toggle('hidden', eligible);

    document.getElementById('pcChargesFields').classList.toggle('hidden', pcDraft.usageType !== 'charges');
    document.getElementById('pcRechargeFields').classList.toggle('hidden', pcDraft.usageType !== 'recharge');
    document.getElementById('pcMaxCharges').value = pcDraft.maxCharges || 2;
    if (pcDraft.usageType === 'recharge') pcDraft.rechargeOn = 5; // always 5-6 per the book -- not a GM choice

    let extraTp = window.npcPowerUsageExtraTp ? window.npcPowerUsageExtraTp(level, pcDraft.usageType, pcDraft.maxCharges) : 0;
    document.getElementById('pcUsageTpNote').innerText = extraTp > 0 ? `+${extraTp} TP for this usage type (on top of the base Level ${level} cost).` : '';
}

window.pcSetUsageType = function(val) {
    pcDraft.usageType = val;
    pcRenderUsageSection();
    pcRenderSummary();
};
window.pcSetMaxCharges = function(val) {
    pcDraft.maxCharges = Math.max(1, parseInt(val) || 1);
    pcRenderUsageSection();
    pcRenderSummary();
};
window.pcSetRechargeOn = function(val) {
    pcDraft.rechargeOn = parseInt(val);
};

let pcIsLairAction = false; // set by the "Build a Power for This Lair Action" button; tags the finished power so it displays under Lair Actions instead of the general Powers list
window.openLairActionPowerCrafter = function() {
    window.openPowerCrafter(false, ncTarget); // resets pcIsLairAction to false as part of its own normal setup...
    pcIsLairAction = true; // ...so this has to happen after, not before
};

window.openPowerCrafter = function(freeMode, target) {
    pcTarget = (target === 'companion' || target === 'gm') ? target : 'player';
    pcIsLairAction = false; // only ever true when explicitly set by openLairActionPowerCrafter, right after this call
    if (pcTarget === 'player' && pcMaxUnlockedLevel() < 1) {
        window.showConfirm("You need at least Rank 1 of Intelligence Powers or Charisma Powers before you can craft a Power.", null, true);
        return;
    }
    pcEditIndex = null;
    // Free mode (banked free-power credits) is a player-only concept tied
    // to Int/Cha Powers rank-ups -- companions never have one.
    pcFreeMode = pcTarget === 'player' && !!freeMode && (window.state.freePowersOwed || 0) > 0;
    pcDraft = getBlankPowerDraft();
    pcChaFreeCredit = null; pcChaFreeCreditDeclined = false; // freshly derived by pcRenderFreeBanner() once the modal opens
    document.getElementById('pcName').value = '';
    pcOpenCommon();
};

// "Return to Forge" for an existing crafted Power -- reloads its exact
// original build so edits start from precisely what's already there.
window.openPowerEditor = function(idx, target) {
    pcTarget = (target === 'companion' || target === 'gm') ? target : 'player';
    let power = getTargetPowers()[idx];
    if (!power || !power.draft) {
        window.showConfirm("This power wasn't built with the Power Crafter (it was added manually, or predates this feature), so it can't be reopened here. You can still edit its fields directly in the table.", null, true);
        return;
    }
    if (pcTarget === 'player' && pcMaxUnlockedLevel() < 1) {
        window.showConfirm("You need at least Rank 1 of Intelligence Powers or Charisma Powers before you can use the Power Crafter.", null, true);
        return;
    }
    pcEditIndex = idx;
    pcFreeMode = false; // only relevant to the "Save as New" path; "Save Changes" follows the power's own wasFree flag
    pcIsLairAction = !!power.isLairAction; // preserve whichever section this power already belongs to
    pcDraft = JSON.parse(JSON.stringify(power.draft));
    pcChaFreeCredit = null; pcChaFreeCreditDeclined = false; // freshly derived by pcRenderFreeBanner() once the modal opens
    document.getElementById('pcName').value = power.name || '';
    pcOpenCommon();
};

let pcChaFreeCredit = null; // {type:'new', level} or {type:'upgrade', fromLevel, toLevel} -- whichever Charisma Powers credit currently matches this draft, if any
let pcChaFreeCreditDeclined = false; // player explicitly unchecked the "use it" box for this power-building session -- otherwise every re-render would silently re-enable it the moment the level matches again

function pcRenderFreeBanner() {
    let banner = document.getElementById('pcFreeBanner');

    // Banked free-power credits are a player-only concept (granted by
    // Int/Cha Powers rank-ups); a companion session shows the TP cost
    // context instead, handled by pcRenderSummary.
    if (pcTarget !== 'player') {
        banner.classList.add('hidden');
        return;
    }

    let owed = window.state.freePowersOwed || 0;
    let computedLevel = window.pcCalcXP(pcDraft).level;
    pcChaFreeCredit = null;

    if (pcEditIndex !== null) {
        let power = getTargetPowers()[pcEditIndex];
        if (power.wasFree) {
            banner.classList.remove('hidden');
            let alsoUpgrade = window.state.chaFreeUpgrades.some(u => u.fromLevel === power.lvl && u.toLevel === computedLevel);
            banner.innerHTML = `<div class="text-center">This Power was originally free -- Saving Changes to it will never cost XP, no matter what you change.${alsoUpgrade ? ' (This will also spend your free Charisma Powers upgrade credit.)' : ''}</div>`;
            return;
        }
        // A free Charisma Powers upgrade only matches if this power's
        // original Level is exactly one Rank below the credited upgrade,
        // and the build's current (edited) Level exactly matches where
        // that credit lands -- building past that Level doesn't qualify.
        let upgradeIdx = window.state.chaFreeUpgrades.findIndex(u => u.fromLevel === power.lvl && u.toLevel === computedLevel);
        if (upgradeIdx !== -1) {
            if (!pcChaFreeCreditDeclined) pcChaFreeCredit = { type: 'upgrade', fromLevel: power.lvl, toLevel: computedLevel };
            banner.classList.remove('hidden');
            banner.innerHTML = `
                <label class="flex items-center justify-center gap-2 cursor-pointer">
                    <input type="checkbox" ${pcChaFreeCreditDeclined ? '' : 'checked'} onchange="window.pcToggleChaFreeCredit(this.checked)">
                    Use your free Charisma Powers upgrade (Level ${power.lvl} -> ${computedLevel}) -- no XP will be spent.
                </label>
            `;
            return;
        }
        if (owed <= 0) { banner.classList.add('hidden'); return; }
        banner.classList.remove('hidden');
        banner.innerHTML = `
            <label class="flex items-center justify-center gap-2 cursor-pointer">
                <input type="checkbox" ${pcFreeMode ? 'checked' : ''} onchange="window.pcToggleFreeMode(this.checked)">
                If you Save as New, use a free Power (${owed} banked) for the copy instead of paying XP.
            </label>
        `;
        return;
    }

    // Brand-new Power: a free Charisma Powers credit only matches if this
    // build's computed Level is exactly the Level that credit unlocked.
    let newIdx = window.state.chaFreePowerLevels.indexOf(computedLevel);
    if (newIdx !== -1) {
        if (!pcChaFreeCreditDeclined) pcChaFreeCredit = { type: 'new', level: computedLevel };
        banner.classList.remove('hidden');
        banner.innerHTML = `
            <label class="flex items-center justify-center gap-2 cursor-pointer">
                <input type="checkbox" ${pcChaFreeCreditDeclined ? '' : 'checked'} onchange="window.pcToggleChaFreeCredit(this.checked)">
                Use your free Charisma Powers Level ${computedLevel} Power -- no XP will be spent.
            </label>
        `;
        return;
    }

    if (owed <= 0) {
        banner.classList.add('hidden');
        return;
    }
    banner.classList.remove('hidden');
    banner.innerHTML = `
        <label class="flex items-center justify-center gap-2 cursor-pointer">
            <input type="checkbox" ${pcFreeMode ? 'checked' : ''} onchange="window.pcToggleFreeMode(this.checked)">
            Use a free Power (${owed} banked) -- no XP will be spent for this one.
        </label>
    `;
}
window.pcToggleChaFreeCredit = function(checked) {
    pcChaFreeCreditDeclined = !checked;
    pcRenderFreeBanner();
    pcRenderSummary();
};

window.pcToggleFreeMode = function(checked) {
    pcFreeMode = checked && (window.state.freePowersOwed || 0) > 0;
    pcRenderFreeBanner();
    pcRenderSummary();
};

window.navPowerCrafter = function(dir) {
    window.jumpToPcStep(pcStep + dir);
};

window.jumpToPcStep = function(n) {
    if (n < 1 || n > PC_LAST_STEP) return;
    document.getElementById(`pcStep${pcStep}`).classList.remove('active');
    pcStep = n;
    document.getElementById(`pcStep${pcStep}`).classList.add('active');
    document.getElementById('pcBtnPrev').style.display = pcStep > 1 ? 'block' : 'none';
    document.getElementById('pcBtnNext').style.display = pcStep < PC_LAST_STEP ? 'block' : 'none';
    if (pcStep === PC_LAST_STEP) pcRenderStep9();
    pcRenderFreeBanner();
    pcRenderSummary();
    window.updateWizardTabs('pcTab', pcStep, PC_LAST_STEP);
};

// ------------------------------------------------------------------
// Field setters
// ------------------------------------------------------------------
window.pcSetStep1 = function(val) {
    pcDraft.step1 = val;
    if (val === 'hpPool' && pcDraft.addSecondType) {
        // HP Capacity Pool doesn't deal typed damage at all, so a second
        // damage type makes no sense while it's selected -- clear it
        // rather than just visually disabling the (still-checked) box.
        pcDraft.addSecondType = false;
    }
    pcRenderAll();
};
window.pcSetStep2 = function(val) { pcDraft.step2 = val; pcRenderAll(); };
window.pcSetAoe = function(val) { pcDraft.aoe = val; pcRenderAll(); };
window.pcSetDie = function(step, delta) {
    let cur = pcDraft.dmg[step] || 0;
    let next = Math.max(0, Math.min(12, cur + delta));
    pcDraft.dmg[step] = next;
    pcRenderAll();
};
window.pcSetHealing = function(checked) { pcDraft.isHealing = checked; pcRenderAll(); };
window.pcSetDmgType = function(val) { pcDraft.dmgType = val; };
window.pcSetSecondDmgType = function(val) { pcDraft.secondDmgType = val; };
window.pcToggleSecondType = function(checked) { pcDraft.addSecondType = checked; pcRenderAll(); };
window.pcToggleFlatDmg = function(checked) { pcDraft.addFlatDmgPerDie = checked; pcRenderAll(); };
window.pcToggleAttrToDmg = function(checked) { pcDraft.addAttrToDmg = checked; pcRenderAll(); };

window.pcSetUtilityCount = function(tier, key, delta) {
    let cur = pcDraft.utility[tier][key] || 0;
    let entry = POWER_UTILITY[tier].find(u => u.key === key);
    let max = entry.rep ? 20 : 1;
    let next = Math.max(0, Math.min(max, cur + delta));
    if (next === 0) delete pcDraft.utility[tier][key];
    else pcDraft.utility[tier][key] = next;
    pcRenderAll();
};

window.pcSetDuration = function(val) {
    pcDraft.duration = val;
    // Interrupts only make sense for durations of 1 minute or longer --
    // silently clear them rather than leaving a disabled-but-checked box.
    if (!pcDurationAllowsInterrupts(val)) {
        pcDraft.durationMods.dmgInterrupt = false;
        pcDraft.durationMods.actionInterrupt = false;
    }
    pcRenderAll();
};
function pcDurationAllowsInterrupts(durationKey) {
    return durationKey !== 'instant';
}
window.pcToggleDurationMod = function(key, checked) {
    if (checked && !pcDurationAllowsInterrupts(pcDraft.duration)) return; // guard, mirrors disabled UI state
    pcDraft.durationMods[key] = checked;
    pcRenderAll();
};
window.pcSetApMod = function(val) { pcDraft.apMod = val; pcRenderAll(); };
window.pcToggleRefund = function(key, checked) { pcDraft.refunds[key] = checked; pcRenderAll(); };
window.pcSetMinorRestriction = function(delta) {
    let next = Math.max(0, Math.min(10, (pcDraft.refunds.minorRestriction || 0) + delta));
    pcDraft.refunds.minorRestriction = next;
    pcRenderAll();
};
window.pcSetCostly = function(val) { pcDraft.refunds.costly = parseInt(val) || 0; pcRenderAll(); };
window.pcSetFlavorText = function(val) { pcDraft.flavorText = val; };

// ------------------------------------------------------------------
// Rendering
// ------------------------------------------------------------------
function pcRenderAll() {
    pcRenderStep1();
    pcRenderStep2();
    pcRenderStep3();
    pcRenderStep4();
    pcRenderStep5();
    pcRenderStep6();
    pcRenderStep7();
    pcRenderStep8();
    pcRenderStep9();
    pcRenderFreeBanner();
    pcRenderSummary();
}

function pcRenderStep1() {
    document.getElementById('pcStep1Options').innerHTML = POWER_STEP1.map(s => `
        <label class="flex items-start gap-2 bg-slate-900 border ${pcDraft.step1 === s.key ? 'border-purple-500' : 'border-slate-700'} rounded p-2 cursor-pointer">
            <input type="radio" name="pcStep1" class="mt-1" ${pcDraft.step1 === s.key ? 'checked' : ''} onchange="window.pcSetStep1('${s.key}')">
            <div><div class="text-xs font-bold text-slate-200">${s.label} <span class="text-yellow-500">[${s.cost} XP]</span></div><div class="text-[10px] text-slate-500 leading-tight">${s.desc}</div></div>
        </label>
    `).join('');
}

function pcRenderStep2() {
    document.getElementById('pcStep2Options').innerHTML = POWER_STEP2_RANGE.map(s => `
        <label class="flex items-start gap-2 bg-slate-900 border ${pcDraft.step2 === s.key ? 'border-purple-500' : 'border-slate-700'} rounded p-2 cursor-pointer">
            <input type="radio" name="pcStep2" class="mt-1" ${pcDraft.step2 === s.key ? 'checked' : ''} onchange="window.pcSetStep2('${s.key}')">
            <div><div class="text-xs font-bold text-slate-200">${s.label} <span class="text-yellow-500">[${s.cost} XP]</span></div><div class="text-[10px] text-slate-500 leading-tight">${s.desc}</div></div>
        </label>
    `).join('');
}

function pcRenderStep3() {
    document.getElementById('pcStep3Options').innerHTML = POWER_STEP3_AOE.map(s => `
        <label class="flex items-start gap-2 bg-slate-900 border ${pcDraft.aoe === s.key ? 'border-purple-500' : 'border-slate-700'} rounded p-2 cursor-pointer">
            <input type="radio" name="pcAoe" class="mt-1" ${pcDraft.aoe === s.key ? 'checked' : ''} onchange="window.pcSetAoe('${s.key}')">
            <div><div class="text-xs font-bold text-slate-200">${s.label} <span class="text-yellow-500">[x${s.mult}]</span></div><div class="text-[10px] text-slate-500 leading-tight">${s.desc}</div></div>
        </label>
    `).join('');
}

function pcRenderStep4() {
    let t = window.pcCalcXP(pcDraft);
    let dieRows = POWER_DIE_STEPS.map(step => `
        <div class="flex items-center justify-between bg-slate-900 border border-slate-700 rounded px-3 py-1.5">
            <span class="text-xs font-bold text-white">${step} <span class="text-[10px] text-slate-500">(${POWER_DIE_COSTS[step]} XP/die${pcDraft.step1 === 'guaranteed' ? ', x2 Guaranteed Hit' : ''})</span></span>
            <div class="flex items-center gap-2">
                <button onclick="window.pcSetDie('${step}', -1)" class="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-white font-bold">-</button>
                <span class="w-6 text-center font-bold text-sm text-white">${pcDraft.dmg[step]}</span>
                <button onclick="window.pcSetDie('${step}', 1)" class="w-6 h-6 rounded bg-amber-700 hover:bg-amber-600 text-white font-bold">+</button>
            </div>
        </div>
    `).join('');

    let verb = pcDraft.isHealing ? 'healing' : 'damage';
    document.getElementById('pcStep4Dice').innerHTML = dieRows;
    document.getElementById('pcStep4Extras').innerHTML = `
        <label class="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white cursor-pointer">
            <input type="checkbox" ${pcDraft.isHealing ? 'checked' : ''} onchange="window.pcSetHealing(this.checked)"> This power Heals instead of dealing Damage
        </label>
        ${!pcDraft.isHealing ? `
        <div class="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded p-2">
            <span class="text-xs text-white font-bold">Damage Type:</span>
            <select onchange="window.pcSetDmgType(this.value)" ${pcDraft.step1 === 'hpPool' ? 'disabled' : ''} class="bg-slate-800 text-xs ${pcDraft.step1 === 'hpPool' ? 'opacity-50 cursor-not-allowed' : ''}">
                ${DMG_TYPES.map(t => `<option value="${t}" ${pcDraft.dmgType===t?'selected':''}>${t}</option>`).join('')}
            </select>
            ${pcDraft.step1 === 'hpPool' ? '<span class="text-[9px] text-slate-500">(HP Capacity Pool doesn\'t deal typed damage)</span>' : ''}
        </div>
        <label class="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white cursor-pointer">
            <input type="checkbox" ${pcDraft.addSecondType ? 'checked' : ''} ${pcDraft.step1 === 'hpPool' ? 'disabled' : ''} onchange="window.pcToggleSecondType(this.checked)"> Add a second damage type, splitting the dice [+5 XP]
        </label>
        ${pcDraft.addSecondType ? `
        <div class="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded p-2">
            <span class="text-xs text-white font-bold">Second Damage Type:</span>
            <select onchange="window.pcSetSecondDmgType(this.value)" class="bg-slate-800 text-xs">
                ${DMG_TYPES.map(t => `<option value="${t}" ${pcDraft.secondDmgType===t?'selected':''}>${t}</option>`).join('')}
            </select>
        </div>` : ''}` : ''}
        <label class="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white cursor-pointer">
            <input type="checkbox" ${pcDraft.addFlatDmgPerDie ? 'checked' : ''} onchange="window.pcToggleFlatDmg(this.checked)"> +1 ${verb} per die [1 XP/die -- ${t.totalDiceCount} XP]
        </label>
        <label class="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white cursor-pointer">
            <input type="checkbox" ${pcDraft.addAttrToDmg ? 'checked' : ''} onchange="window.pcToggleAttrToDmg(this.checked)"> Add Power Attribute modifier to ${verb} [+10 XP]
        </label>
    `;
}

function pcRenderUtilityTier(tier, label, colorClass) {
    let rows = POWER_UTILITY[tier].map(u => {
        let count = pcDraft.utility[tier][u.key] || 0;
        return `
            <div class="flex items-center justify-between bg-slate-900 border border-slate-700 rounded px-2 py-1.5 gap-2">
                <div class="flex-1 text-[10px] text-slate-300 leading-tight">${u.label}${u.rep ? ' <span class="text-slate-600">(repeatable)</span>' : ''}</div>
                <div class="flex items-center gap-1 shrink-0">
                    <button onclick="window.pcSetUtilityCount('${tier}','${u.key}', -1)" ${count<=0?'disabled':''} class="w-5 h-5 rounded ${count<=0?'bg-slate-800 text-slate-600':'bg-slate-700 hover:bg-slate-600 text-white'} text-xs font-bold">-</button>
                    <span class="w-5 text-center text-xs font-bold text-white">${count}</span>
                    <button onclick="window.pcSetUtilityCount('${tier}','${u.key}', 1)" ${(!u.rep && count>=1)?'disabled':''} class="w-5 h-5 rounded ${(!u.rep && count>=1)?'bg-slate-800 text-slate-600':'bg-amber-700 hover:bg-amber-600 text-white'} text-xs font-bold">+</button>
                </div>
            </div>
        `;
    }).join('');
    return `<div class="mb-3"><div class="text-xs font-black ${colorClass} mb-1.5">${label}</div><div class="space-y-1">${rows}</div></div>`;
}

function pcRenderStep5() {
    let discountNote = pcDraft.step1 === 'hpPool' ? '<div class="text-[10px] text-emerald-400 mb-2">HP Capacity Pool: each Utility selection costs 10 XP less (min 0) before AoE multiplier.</div>' : '';
    document.getElementById('pcStep5List').innerHTML = discountNote +
        pcRenderUtilityTier('minor', 'Minor Utility (5 XP each)', 'text-emerald-400') +
        pcRenderUtilityTier('moderate', 'Moderate Utility (15 XP each)', 'text-blue-400') +
        pcRenderUtilityTier('major', 'Major Utility (30 XP each)', 'text-purple-400') +
        pcRenderUtilityTier('master', 'Master Utility (50 XP each)', 'text-red-400');
}

function pcRenderStep6() {
    document.getElementById('pcStep6Options').innerHTML = POWER_DURATION.map(d => `
        <label class="flex items-start gap-2 bg-slate-900 border ${pcDraft.duration === d.key ? 'border-purple-500' : 'border-slate-700'} rounded p-2 cursor-pointer">
            <input type="radio" name="pcDuration" class="mt-1" ${pcDraft.duration === d.key ? 'checked' : ''} onchange="window.pcSetDuration('${d.key}')">
            <div><div class="text-xs font-bold text-slate-200">${d.label} <span class="text-yellow-500">[${d.cost} XP]</span></div>${d.desc ? `<div class="text-[10px] text-slate-500 leading-tight">${d.desc}</div>` : ''}</div>
        </label>
    `).join('');
    let interruptsAllowed = pcDurationAllowsInterrupts(pcDraft.duration);
    document.getElementById('pcStep6Mods').innerHTML = POWER_DURATION_MODS.map(m => `
        <label class="flex items-start gap-2 bg-slate-900 border border-slate-700 rounded p-2 ${interruptsAllowed ? 'cursor-pointer' : 'opacity-40'}">
            <input type="checkbox" class="mt-1" ${pcDraft.durationMods[m.key] ? 'checked' : ''} ${interruptsAllowed ? '' : 'disabled'} onchange="window.pcToggleDurationMod('${m.key}', this.checked)">
            <div><div class="text-xs font-bold text-slate-200">${m.label} <span class="text-emerald-400">[${m.cost} XP]</span></div><div class="text-[10px] text-slate-500 leading-tight">${m.desc}</div></div>
        </label>
    `).join('');
    if (!interruptsAllowed) {
        document.getElementById('pcStep6Mods').innerHTML += '<div class="text-[10px] text-amber-400 mt-1">Interrupts require a Duration of 1 Minute or longer.</div>';
    }
}

function pcRenderStep7() {
    document.getElementById('pcStep7Options').innerHTML = POWER_AP_MODS.map(a => `
        <label class="flex items-center gap-2 bg-slate-900 border ${pcDraft.apMod === a.key ? 'border-purple-500' : 'border-slate-700'} rounded p-2 cursor-pointer">
            <input type="radio" name="pcApMod" ${pcDraft.apMod === a.key ? 'checked' : ''} onchange="window.pcSetApMod('${a.key}')">
            <span class="text-xs font-bold text-slate-200">${a.label}</span>
            <span class="text-[10px] ${a.cost < 0 ? 'text-slate-500' : 'text-yellow-500'} ml-auto">${a.cost >= 0 ? a.cost + ' XP' : a.cost + ' XP'}</span>
        </label>
    `).join('');
}

function pcRenderStep8() {
    let mrDef = POWER_REFUNDS.find(r => r.key === 'minorRestriction');
    let mrCount = pcDraft.refunds.minorRestriction || 0;
    let minorRestrictionRow = `
        <div class="flex items-center justify-between bg-slate-900 border border-slate-700 rounded p-2 gap-2">
            <div class="flex-1"><div class="text-xs font-bold text-slate-200">${mrDef.label} <span class="text-emerald-400">[${mrDef.cost} XP each]</span> <span class="text-slate-600">(repeatable -- stack distinct clauses like Verbal, Somatic, etc.)</span></div><div class="text-[10px] text-slate-500 leading-tight">${mrDef.desc}</div></div>
            <div class="flex items-center gap-1 shrink-0">
                <button onclick="window.pcSetMinorRestriction(-1)" ${mrCount<=0?'disabled':''} class="w-6 h-6 rounded ${mrCount<=0?'bg-slate-800 text-slate-600':'bg-slate-700 hover:bg-slate-600 text-white'} font-bold">-</button>
                <span class="w-6 text-center font-bold text-sm text-white">${mrCount}</span>
                <button onclick="window.pcSetMinorRestriction(1)" class="w-6 h-6 rounded bg-amber-700 hover:bg-amber-600 text-white font-bold">+</button>
            </div>
        </div>
    `;
    let checkboxRows = POWER_REFUNDS.filter(r => r.key !== 'minorRestriction').map(r => `
        <label class="flex items-start gap-2 bg-slate-900 border border-slate-700 rounded p-2 cursor-pointer">
            <input type="checkbox" class="mt-1" ${pcDraft.refunds[r.key] ? 'checked' : ''} onchange="window.pcToggleRefund('${r.key}', this.checked)">
            <div><div class="text-xs font-bold text-slate-200">${r.label} <span class="text-emerald-400">[${r.cost} XP]</span></div><div class="text-[10px] text-slate-500 leading-tight">${r.desc}</div></div>
        </label>
    `).join('');
    let costlyRow = `
        <label class="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded p-2">
            <span class="text-xs font-bold text-slate-200">Costly (requires a rare/expensive item):</span>
            <select onchange="window.pcSetCostly(this.value)" class="bg-slate-800 text-xs ml-auto">
                <option value="0" ${pcDraft.refunds.costly===0?'selected':''}>Not Costly</option>
                <option value="-5" ${pcDraft.refunds.costly===-5?'selected':''}>-5 XP (minor item)</option>
                <option value="-10" ${pcDraft.refunds.costly===-10?'selected':''}>-10 XP</option>
                <option value="-15" ${pcDraft.refunds.costly===-15?'selected':''}>-15 XP</option>
                <option value="-20" ${pcDraft.refunds.costly===-20?'selected':''}>-20 XP (rare item)</option>
            </select>
        </label>
    `;
    document.getElementById('pcStep8Options').innerHTML = minorRestrictionRow + checkboxRows + costlyRow;
}

function pcRenderStep9() {
    let summary = pcBuildTextSummary();
    document.getElementById('pcStep9Reference').innerHTML = `
        A/S: ${summary.atk} | R/A: ${summary.rng} | D/H: ${summary.dmg} | Duration: ${summary.durationText}${summary.restrictionText ? ' | Restrictions: ' + summary.restrictionText : ''}${summary.utilityText ? '<br>Effects: ' + summary.utilityText : ''}
    `;
    let ta = document.getElementById('pcFlavorText');
    if (ta && ta.value !== pcDraft.flavorText) ta.value = pcDraft.flavorText;
}

function pcStyleBtn(btn) {
    btn.className = btn.disabled
        ? 'px-4 py-2 rounded bg-slate-700 text-slate-500 cursor-not-allowed text-sm font-bold transition'
        : 'px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition shadow-lg';
}

function pcRenderSummary() {
    let t = window.pcCalcXP(pcDraft);
    let maxLevel = pcTarget !== 'player' ? 5 : pcMaxUnlockedLevel();
    let overCap = t.level > maxLevel;
    document.getElementById('pcSumXp').innerText = t.total + ' XP';
    document.getElementById('pcSumLevel').innerText = 'Level ' + t.level;
    document.getElementById('pcSumLevel').className = overCap ? 'text-lg font-black text-red-400' : 'text-lg font-black text-white';
    document.getElementById('pcSumAp').innerText = t.ap + ' AP';

    let capNote = document.getElementById('pcCapNote');
    if (overCap) {
        capNote.classList.remove('hidden');
        capNote.innerText = `This power is Level ${t.level}, but you can only use up to Level ${maxLevel} Powers. Reduce its XP total to ${POWER_LEVEL_TABLE[maxLevel-1] ? POWER_LEVEL_TABLE[maxLevel-1].max : 0} or less.`;
    } else {
        capNote.classList.add('hidden');
    }

    let atLastStep = pcStep === PC_LAST_STEP;
    let finishBtn = document.getElementById('pcBtnFinish');
    let saveChangesBtn = document.getElementById('pcBtnSaveChanges');
    let saveAsNewBtn = document.getElementById('pcBtnSaveAsNew');

    let showFinish = atLastStep && pcEditIndex === null;
    let showEditPair = atLastStep && pcEditIndex !== null;
    finishBtn.style.display = showFinish ? 'block' : 'none';
    saveChangesBtn.style.display = showEditPair ? 'block' : 'none';
    saveAsNewBtn.style.display = showEditPair ? 'block' : 'none';

    if (pcTarget !== 'player') {
        let tpCost = window.npcPowerTotalTp(t.level, pcDraft.usageType, pcDraft.maxCharges);
        let remaining = window.companionRemainingTp();
        // GM NPCs auto-expand their budget to cover whatever's spent
        // (see ncEnsureTierForSpend), so these buttons are never blocked
        // by "not enough TP" the way a Loyal Companion's are.
        let tpGates = pcTarget !== 'gm';
        if (showFinish) {
            finishBtn.innerText = `Add Power (${tpCost} TP)`;
            finishBtn.disabled = tpGates && tpCost > remaining;
            pcStyleBtn(finishBtn);
        }
        if (showEditPair) {
            let power = getTargetPowers()[pcEditIndex];
            let delta = tpCost - (power.tp || 0);
            if (delta > 0) saveChangesBtn.innerText = `Save Changes (+${delta} TP)`;
            else if (delta < 0) saveChangesBtn.innerText = `Save Changes (${delta} TP refund)`;
            else saveChangesBtn.innerText = 'Save Changes (No Cost Change)';
            saveChangesBtn.disabled = tpGates && delta > remaining;
            pcStyleBtn(saveChangesBtn);
            saveAsNewBtn.innerText = `Save as New (${tpCost} TP)`;
            saveAsNewBtn.disabled = tpGates && tpCost > remaining;
            pcStyleBtn(saveAsNewBtn);
        }
        return;
    }

    let unspent = parseInt(document.getElementById('unspentXp') ? document.getElementById('unspentXp').value : 0) || 0;

    if (showFinish) {
        if (pcFreeMode || pcChaFreeCredit?.type === 'new') {
            finishBtn.innerText = 'Claim Free Power';
            finishBtn.disabled = overCap;
        } else {
            finishBtn.innerText = `Learn Power (${t.total} XP)`;
            finishBtn.disabled = overCap || unspent < t.total;
        }
        pcStyleBtn(finishBtn);
    }

    if (showEditPair) {
        let power = getTargetPowers()[pcEditIndex];

        if (power.wasFree) {
            saveChangesBtn.innerText = 'Save Changes (Free)';
            saveChangesBtn.disabled = overCap;
        } else if (pcChaFreeCredit?.type === 'upgrade') {
            saveChangesBtn.innerText = `Save Changes (Free Upgrade to Lvl ${pcChaFreeCredit.toLevel})`;
            saveChangesBtn.disabled = overCap;
        } else {
            let delta = t.total - (power.paidXP || 0);
            if (delta > 0) saveChangesBtn.innerText = `Save Changes (+${delta} XP)`;
            else if (delta < 0) saveChangesBtn.innerText = `Save Changes (${delta} XP refund)`;
            else saveChangesBtn.innerText = 'Save Changes (No Cost Change)';
            saveChangesBtn.disabled = overCap || (delta > 0 && unspent < delta);
        }
        pcStyleBtn(saveChangesBtn);

        if (pcFreeMode || pcChaFreeCredit?.type === 'upgrade') {
            saveAsNewBtn.innerText = 'Save as New (Free)';
            saveAsNewBtn.disabled = overCap;
        } else {
            saveAsNewBtn.innerText = `Save as New (${t.total} XP)`;
            saveAsNewBtn.disabled = overCap || unspent < t.total;
        }
        pcStyleBtn(saveAsNewBtn);
    }
}

// ------------------------------------------------------------------
// Text summaries for the existing {atk, rng, dmg, desc} power fields
// ------------------------------------------------------------------
function pcBuildTextSummary() {
    let t = window.pcCalcXP(pcDraft);
    let step1Def = POWER_STEP1.find(s => s.key === pcDraft.step1);
    let step2Def = POWER_STEP2_RANGE.find(s => s.key === pcDraft.step2);
    let aoeDef = POWER_STEP3_AOE.find(s => s.key === pcDraft.aoe);

    let atk = step1Def.label;

    let rng = step2Def.label;
    if (aoeDef.key !== 'single') rng += ' / ' + aoeDef.label;

    let dmg = '-';
    if (t.totalDiceCount > 0) {
        let diceStr = POWER_DIE_STEPS.filter(s => pcDraft.dmg[s] > 0).map(s => `${pcDraft.dmg[s]}${s}`).join('+');
        let flat = pcDraft.addFlatDmgPerDie ? `+${t.totalDiceCount}` : '';
        dmg = `${diceStr}${flat} ${pcDraft.isHealing ? '(Heal)' : pcDraft.dmgType}`;
        if (pcDraft.addSecondType) dmg += ` + ${pcDraft.secondDmgType}`;
        if (pcDraft.addAttrToDmg) dmg += ' +Attr';
    }

    let utilityBits = [];
    ['minor', 'moderate', 'major', 'master'].forEach(tier => {
        Object.keys(pcDraft.utility[tier]).forEach(key => {
            let entry = POWER_UTILITY[tier].find(u => u.key === key);
            let count = pcDraft.utility[tier][key];
            utilityBits.push(count > 1 ? `${entry.label} (x${count})` : entry.label);
        });
    });

    let durationDef = POWER_DURATION.find(d => d.key === pcDraft.duration);
    let durationBits = [durationDef.label];
    if (pcDraft.durationMods.dmgInterrupt) durationBits.push('Damage Interrupt');
    if (pcDraft.durationMods.actionInterrupt) durationBits.push('Action Interrupt');

    let refundBits = [];
    let mrCount = pcDraft.refunds.minorRestriction || 0;
    if (mrCount > 0) refundBits.push(mrCount > 1 ? `Minor Restriction (x${mrCount})` : 'Minor Restriction');
    POWER_REFUNDS.filter(r => r.key !== 'minorRestriction').forEach(r => { if (pcDraft.refunds[r.key]) refundBits.push(r.label); });
    if (pcDraft.refunds.costly) refundBits.push(`Costly (${pcDraft.refunds.costly} XP)`);

    let utilityText = utilityBits.join('; ');
    let durationText = durationBits.join(', ');
    let restrictionText = refundBits.join(', ');

    let descParts = [];
    if (utilityText) descParts.push(utilityText);
    descParts.push('Duration: ' + durationText);
    if (restrictionText) descParts.push('Restrictions: ' + restrictionText);

    return { atk, rng, dmg, desc: descParts.join(' | '), utilityText, durationText, restrictionText };
}

// Applies a Currency-of-XP delta to the unspent pool. Positive = charge,
// negative = refund. Returns false (and applies nothing) if a positive
// charge can't be afforded.
function pcApplyXpDelta(delta) {
    if (delta === 0) return true;
    let unspentEl = document.getElementById('unspentXp');
    let spentEl = document.getElementById('spentXp');
    let unspent = parseInt(unspentEl.value) || 0;
    let spent = parseInt(spentEl.value) || 0;
    if (delta > 0 && unspent < delta) return false;
    unspentEl.value = unspent - delta;
    if (spentEl) spentEl.value = Math.max(0, spent + delta);
    window.updateState('unspentXp', unspent - delta);
    window.updateState('spentXp', Math.max(0, spent + delta));
    return true;
}

window.finishPowerCrafter = function() {
    let t = window.pcCalcXP(pcDraft);
    if (pcTarget === 'player') {
        let maxLevel = pcMaxUnlockedLevel();
        if (t.level > maxLevel) return; // guarded by disabled button, but double-check
    }

    let name = document.getElementById('pcName').value || `Crafted Power (Lvl ${t.level})`;
    let summary = pcBuildTextSummary();
    let finalDesc = (pcDraft.flavorText || '').trim() || summary.desc;

    if (pcTarget !== 'player') {
        let tp = pcApplyCompanionTpDelta(t.level, 0, pcDraft.usageType, pcDraft.maxCharges);
        if (tp === null) return;
        getTargetPowers().push({
            name, lvl: t.level, ap: t.ap, atk: summary.atk, rng: summary.rng, dmg: summary.dmg, desc: finalDesc,
            draft: JSON.parse(JSON.stringify(pcDraft)), tp, isLairAction: pcIsLairAction,
            usageType: pcDraft.usageType, maxCharges: pcDraft.maxCharges, rechargeOn: pcDraft.rechargeOn
        });
        pcIsLairAction = false;
        window.closeModal('powerCrafterModal');
        window.recalculateMath();
        if (typeof ncRenderAll === 'function') ncRenderAll();
        return;
    }

    // Defense in depth: only actually spend a banked credit if one still
    // exists at the moment of Finish (it could only have changed via a
    // rank-up while this modal was open, which is an edge case, but never
    // silently grant a power for free without a credit to back it).
    let useFree = pcFreeMode && (window.state.freePowersOwed || 0) > 0;
    let useChaFree = pcChaFreeCredit?.type === 'new' && window.state.chaFreePowerLevels.includes(t.level);
    let paidXP = 0;

    if (useChaFree) {
        let idx = window.state.chaFreePowerLevels.indexOf(t.level);
        window.state.chaFreePowerLevels.splice(idx, 1);
    } else if (useFree) {
        window.state.freePowersOwed = Math.max(0, (window.state.freePowersOwed || 0) - 1);
    } else {
        if (!pcApplyXpDelta(t.total)) return;
        paidXP = t.total;
    }

    window.state.powers.push({
        name, lvl: t.level, ap: t.ap, atk: summary.atk, rng: summary.rng, dmg: summary.dmg, desc: finalDesc,
        draft: JSON.parse(JSON.stringify(pcDraft)), wasFree: useFree || useChaFree, paidXP
    });

    window.closeModal('powerCrafterModal');
    window.recalculateMath();

    // "When done it then asks which Level [X-1] Power to upgrade for
    // free" -- the upgrade offer comes right after finishing the new
    // free Power that unlocked it, not before.
    if (useChaFree) window.pcOfferChaFreeUpgradeIfAny(t.level);
};

window.pcOfferChaFreeUpgradeIfAny = function(justCreatedLevel) {
    let upgradeIdx = window.state.chaFreeUpgrades.findIndex(u => u.toLevel === justCreatedLevel);
    if (upgradeIdx === -1) return; // Rank 1 grants no upgrade; nothing to offer
    let upgrade = window.state.chaFreeUpgrades[upgradeIdx];
    let eligiblePowers = window.state.powers.map((p, idx) => ({ p, idx })).filter(x => x.p.lvl === upgrade.fromLevel);
    if (!eligiblePowers.length) {
        window.showConfirm(`You also have a free upgrade from Level ${upgrade.fromLevel} to Level ${upgrade.toLevel}, but you don't have any Level ${upgrade.fromLevel} Powers yet to upgrade. It'll stay available until you do.`, null, true);
        return;
    }
    document.getElementById('chaUpgradePickerBody').innerHTML = eligiblePowers.map(x => `
        <button onclick="window.pcSelectChaFreeUpgradeTarget(${x.idx})" class="w-full text-left text-xs px-2 py-1.5 rounded border bg-slate-900 text-slate-200 border-slate-700 hover:border-purple-500 mb-1">
            ${x.p.name} (Level ${x.p.lvl})
        </button>
    `).join('');
    window.openModal('chaUpgradePickerModal');
};
window.pcSelectChaFreeUpgradeTarget = function(idx) {
    window.closeModal('chaUpgradePickerModal');
    window.openPowerEditor(idx, 'player');
};

// Editing in place. A power that was originally free stays free no matter
// how the rebuild's cost changes -- you're fixing it, not making a second
// one. A power that was originally paid charges (or refunds) only the
// difference between its old and new cost.
window.savePowerChanges = function() {
    if (pcEditIndex === null) return;
    let t = window.pcCalcXP(pcDraft);
    let targetPowers = getTargetPowers();
    let power = targetPowers[pcEditIndex];

    if (pcTarget !== 'player') {
        let name = document.getElementById('pcName').value || power.name;
        let summary = pcBuildTextSummary();
        let finalDesc = (pcDraft.flavorText || '').trim() || summary.desc;
        let tp = pcApplyCompanionTpDelta(t.level, power.tp || 0, pcDraft.usageType, pcDraft.maxCharges);
        if (tp === null) return;
        power.tp = tp;
        power.name = name;
        power.lvl = t.level; power.ap = t.ap;
        power.atk = summary.atk; power.rng = summary.rng; power.dmg = summary.dmg; power.desc = finalDesc;
        power.draft = JSON.parse(JSON.stringify(pcDraft));
        power.usageType = pcDraft.usageType; power.maxCharges = pcDraft.maxCharges; power.rechargeOn = pcDraft.rechargeOn;
        window.closeModal('powerCrafterModal');
        window.recalculateMath();
        if (typeof ncRenderAll === 'function') ncRenderAll();
        return;
    }

    let maxLevel = pcMaxUnlockedLevel();
    if (t.level > maxLevel) return;

    let name = document.getElementById('pcName').value || power.name;
    let summary = pcBuildTextSummary();
    let finalDesc = (pcDraft.flavorText || '').trim() || summary.desc;
    let oldLevel = power.lvl; // capture before it gets overwritten below

    // Defense in depth, same idea as the free-power check in
    // finishPowerCrafter: re-verify the credit is still actually there
    // rather than trusting whatever pcChaFreeCredit was computed as
    // earlier in the session. An already-free power has no checkbox to
    // decline with (see pcRenderFreeBanner), so it always consumes a
    // matching credit; a normal power respects pcChaFreeCreditDeclined
    // the same way the other free-credit types do.
    let matchesUpgrade = window.state.chaFreeUpgrades.some(u => u.fromLevel === oldLevel && u.toLevel === t.level);
    let useChaFreeUpgrade = matchesUpgrade && (power.wasFree || !pcChaFreeCreditDeclined);
    if (useChaFreeUpgrade) {
        let idx = window.state.chaFreeUpgrades.findIndex(u => u.fromLevel === oldLevel && u.toLevel === t.level);
        window.state.chaFreeUpgrades.splice(idx, 1);
    }

    if (power.wasFree) {
        // stays free no matter what changes, same as the existing rule
    } else if (useChaFreeUpgrade) {
        power.wasFree = true;
        power.paidXP = 0;
    } else {
        let delta = t.total - (power.paidXP || 0);
        if (!pcApplyXpDelta(delta)) return;
        power.paidXP = t.total;
    }

    power.name = name;
    power.lvl = t.level; power.ap = t.ap;
    power.atk = summary.atk; power.rng = summary.rng; power.dmg = summary.dmg; power.desc = finalDesc;
    power.draft = JSON.parse(JSON.stringify(pcDraft));

    window.closeModal('powerCrafterModal');
    window.recalculateMath();
};

// Leaves the original power untouched and creates a separate new one from
// the current (possibly edited) draft. Can spend a banked free credit for
// the copy if the player opts in via the free-mode toggle.
window.savePowerAsNew = function() {
    let t = window.pcCalcXP(pcDraft);
    let name = document.getElementById('pcName').value || `Crafted Power (Lvl ${t.level})`;
    let summary = pcBuildTextSummary();
    let finalDesc = (pcDraft.flavorText || '').trim() || summary.desc;

    if (pcTarget !== 'player') {
        let tp = pcApplyCompanionTpDelta(t.level, 0, pcDraft.usageType, pcDraft.maxCharges);
        if (tp === null) return;
        getTargetPowers().push({
            name, lvl: t.level, ap: t.ap, atk: summary.atk, rng: summary.rng, dmg: summary.dmg, desc: finalDesc,
            draft: JSON.parse(JSON.stringify(pcDraft)), tp, isLairAction: pcIsLairAction,
            usageType: pcDraft.usageType, maxCharges: pcDraft.maxCharges, rechargeOn: pcDraft.rechargeOn
        });
        window.closeModal('powerCrafterModal');
        window.recalculateMath();
        if (typeof ncRenderAll === 'function') ncRenderAll();
        return;
    }

    let maxLevel = pcMaxUnlockedLevel();
    if (t.level > maxLevel) return;

    let originalPower = pcEditIndex !== null ? getTargetPowers()[pcEditIndex] : null;
    let useChaFreeUpgrade = originalPower && !originalPower.wasFree && !pcChaFreeCreditDeclined &&
        window.state.chaFreeUpgrades.some(u => u.fromLevel === originalPower.lvl && u.toLevel === t.level);

    let useFree = pcFreeMode && (window.state.freePowersOwed || 0) > 0;
    let paidXP = 0;
    if (useChaFreeUpgrade) {
        let idx = window.state.chaFreeUpgrades.findIndex(u => u.fromLevel === originalPower.lvl && u.toLevel === t.level);
        window.state.chaFreeUpgrades.splice(idx, 1);
    } else if (useFree) {
        window.state.freePowersOwed = Math.max(0, (window.state.freePowersOwed || 0) - 1);
    } else {
        if (!pcApplyXpDelta(t.total)) return;
        paidXP = t.total;
    }

    window.state.powers.push({
        name, lvl: t.level, ap: t.ap, atk: summary.atk, rng: summary.rng, dmg: summary.dmg, desc: finalDesc,
        draft: JSON.parse(JSON.stringify(pcDraft)), wasFree: useFree || useChaFreeUpgrade, paidXP
    });

    window.closeModal('powerCrafterModal');
    window.recalculateMath();
};
