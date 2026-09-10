// ============================================================
// APX Character Sheet — NPC Crafter (Loyal Companion + GM NPC Builder)
// Chapter 15's Threat Point system. Two independent uses share this same
// wizard: a player's Loyal Companion (budget/steps gated by the perk's
// rank, saved inside the character file) and a GM's standalone NPCs
// (free TP budget, all 8 steps, saved to a separate GM roster/file that
// is NOT part of any character's save data).
//
// This file is loaded both by the main character sheet (alongside
// apx-engine.js, for Loyal Companion) and by the standalone
// APX_GMTools.html (which has no apx-engine.js at all). The one small
// utility it needs from there, nextDieTier, is defined as a fallback
// below only if apx-engine.js hasn't already provided it.
// ============================================================

window.nextDieTier = window.nextDieTier || function(dice) {
    let idx = WEAPON_DMG_TIERS.findIndex(t => t.dice === dice);
    if (idx === -1 || idx >= WEAPON_DMG_TIERS.length - 1) return null;
    return WEAPON_DMG_TIERS[idx + 1].dice;
};

let ncStep = 1;
let ncTarget = 'companion'; // 'companion' | 'gm' -- which pool this session edits
let ncActiveGmNpcId = null; // which entry in window.gmNpcs, when ncTarget === 'gm'

// GM NPCs live entirely outside window.state -- they're not part of any
// character's save file. Kept here as a standalone in-memory list; saving
// this to disk is handled by the GM Roster export/import functions below.
window.gmNpcs = window.gmNpcs || [];

// The single point every NPC Crafter function reads/writes through. This
// is what makes the wizard "target-aware" without duplicating any of its
// ~40 editing functions -- they all already do `let c = ...`, so this one
// helper is the entire generalization.
function ncActiveCompanion() {
    let c;
    if (ncTarget === 'gm') {
        let entry = window.gmNpcs.find(n => n.id === ncActiveGmNpcId);
        c = entry ? entry.npc : null;
    } else {
        c = window.state.companion;
    }
    if (c) ncMigrateCompanionFields(c);
    return c;
}

// Backfills fields added to the companion/NPC shape after a given save
// was made (own characters, imported GM NPC files, etc.) so an older file
// never crashes the builder just because a newer field is missing --
// this runs every time the active companion is fetched, which is the one
// choke point nearly everything in this file goes through.
function ncMigrateCompanionFields(c) {
    if (c.gmTpBudget === undefined) c.gmTpBudget = 5;
    if (c.legendaryResistances === undefined) c.legendaryResistances = 0;
    if (c.legendaryApPool === undefined) c.legendaryApPool = 0;
    if (c.lairActions === undefined) c.lairActions = false;
    if (c.lairActionsText === undefined) c.lairActionsText = '';
    if (c.mythicAwakening === undefined) c.mythicAwakening = false;
    if (c.mythicAwakeningText === undefined) c.mythicAwakeningText = '';
    if (!c.traitEnergyTypes) c.traitEnergyTypes = {};
    if (c.lairSharedTraitKey === undefined) c.lairSharedTraitKey = null;
}

function getBlankCompanion() {
    return {
        name: "New NPC",
        currentHp: null, // null = not yet set, defaults to computed Max HP
        extraTpPurchased: 0,
        weapons: [], // manufactured weapons, built via the same Weapon Forge as the player (target: 'companion')
        equippedArmor: {
            name: "", wt: 0, ac: 0, dr: 0, er: 0,
            stealthMod: 0, athleticsMod: 0, speedMod: 0,
            mods: { acBonus: 0, drBonus: 0, erBonus: 0, wtReduction: 0, wtIncrease: 0, stealthBonus: 0, athleticsBonus: 0, stealthPenalty: 0, athleticsPenalty: 0, speedPenalty: 0 },
            craftBatches: {}, paidCost: 0
        },
        attrBonuses: { STR: 0, AGI: 0, CON: 0, PER: 0, INT: 0, CHA: 0, LUC: 0 },
        hpTierBonus: 0,
        apBonus: 0,
        gmTpBudget: 5, // only used when built standalone by a GM (ncTarget === 'gm'); a Loyal Companion's budget instead comes entirely from the perk's rank. 5 TP = Tier 0, matching NPC_TIER_TP's baseline.
        legendaryResistances: 0, // ranks, 4 TP each -- auto-succeed a failed save, N times per day
        legendaryApPool: 0, // bonus AP pool for acting on other creatures' turns, purchased in +3 increments at 5 TP each
        lairActions: false, // 10 TP, requires legendaryApPool > 0
        lairActionsText: '', // GM's own description of what the lair does when it acts
        mythicAwakening: false, // 20 TP
        mythicAwakeningText: '', // GM's own description of the creature's second, more dangerous phase
        size: 'medium',
        swarm: false,
        speedBonus: 0,
        altLocomotion: [], // [{type, doubled}]
        hover: false,
        senses: { nightvision: false, keensenses: [], vibration: false, supernatural: false, blinddeaf: [] },
        acBonus: 0, drBonus: 0, erBonus: 0,
        conditionImmunities: [], conditionalDmgImmunities: [], energyImmunities: [], energyVulnerabilities: [],
        trainingBonus: 2, // starts at +2 like PCs; +2 TP per +1 increase
        otherTrainings: [], // free-text list of trained skills/weapon types (Innate Weapon is always trained for free), 1 TP each
        innateDieStepIndex: 0,
        additionalDiceCount: 0, // extra dice beyond the step's base count, always the SAME type as the current step (e.g. step=1d6 + count=2 -> 3d6)
        addAttrToDamage: null,
        weaponRangeBonus: 0,
        weaponProperties: [],
        powers: [], // [{name, lvl, ap, atk, rng, dmg, desc, draft, tp}]
        casterSlots: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        usedPowerSlots: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        powerChargesUsed: {}, // power name -> charges/uses spent since the last Full Rest
        traits: [],
        traitEnergyTypes: {}, // trait key -> chosen energy type, for traits like Regeneration with an optional +1 TP restriction
        lairSharedTraitKey: null // a trait broadcast as a note to every enemy in the initiative order once this NPC joins combat
    };
}

function lcRank() { return window.state.perks['cha_loyalcompanion'] || 0; }
function lcStepsUnlocked() {
    let def = PERKS_DB.find(p => p.id === 'cha_loyalcompanion');
    return def && def.companionStepUnlocks ? (def.companionStepUnlocks[lcRank()] || 0) : 0;
}
// A GM building a standalone NPC isn't gated by any perk rank -- all of
// Steps 1-8 are open immediately. Step 8 (Legendary Resistance, Legendary
// Actions, Lair Actions, Mythic Awakening) is GM-only; a Loyal Companion
// never unlocks it, matching its perk-defined cap of 7.
function ncStepsUnlocked() {
    return ncTarget === 'gm' ? 8 : lcStepsUnlocked();
}
function lcTpXpCost() {
    let rank = lcRank();
    if (rank >= 4) return 5;
    if (rank === 3) return 10;
    if (rank === 2) return 15;
    return 20; // rank 1
}
function lcGrantedTp() {
    // Cumulative TP granted for free by the perk's current rank: 10/15/20/30/40
    let rank = lcRank();
    let table = { 0: 0, 1: 10, 2: 15, 3: 20, 4: 30, 5: 40 };
    return table[rank] || 0;
}

// Splits an NPC_DIE_STEPS entry like "2d6" into {count: 2, type: "d6"}.
function parseDieStep(stepStr) {
    let m = stepStr.match(/^(\d+)(d\d+)$/);
    return { count: parseInt(m[1]), type: m[2] };
}

window.companionTotalTp = function() {
    let c = ncActiveCompanion();
    if (!c) return 0;
    if (ncTarget === 'gm') return c.gmTpBudget || 0;
    return lcGrantedTp() + c.extraTpPurchased;
};

window.companionTpSpent = function() {
    let c = ncActiveCompanion();
    if (!c) return 0;
    let spent = 0;
    ATTRIBUTES.forEach(a => { spent += c.attrBonuses[a]; }); // negative bonuses refund automatically via sum
    spent += c.hpTierBonus;
    // "If the NPC wears manufactured armor... use the armor's stats at
    // cost of 1 TP per AC the armor provides." (Ch.15 Step 4)
    if (c.equippedArmor && c.equippedArmor.ac) spent += Math.max(0, c.equippedArmor.ac);
    spent += c.apBonus * 3;
    let sizeDef = NPC_SIZES.find(s => s.key === c.size);
    spent += sizeDef ? sizeDef.tp : 0;
    if (c.swarm) spent += 3;
    spent += c.speedBonus;
    c.altLocomotion.forEach(l => { spent += l.doubled ? 4 : 2; });
    if (c.hover) spent += 4;
    if (c.senses.nightvision) spent += 1;
    spent += c.senses.keensenses.length * 1;
    if (c.senses.vibration) spent += 3;
    if (c.senses.supernatural) spent += 4;
    spent += c.senses.blinddeaf.length * -2;
    spent += c.acBonus + c.drBonus + c.erBonus;
    spent += c.conditionImmunities.length * 2;
    spent += c.conditionalDmgImmunities.length * 3;
    spent += c.energyImmunities.length * 4;
    spent += c.energyVulnerabilities.length * -3;
    spent += (c.trainingBonus - 2) * 2; // Training Bonus purchases, 2 TP per +1 above the starting +2
    spent += c.otherTrainings.length; // Skill/Weapon Training, 1 TP each (Innate Weapon itself is free/automatic)
    spent += c.innateDieStepIndex; // 1 TP per step
    spent += c.additionalDiceCount * NPC_ADDITIONAL_DIE_COST[parseDieStep(NPC_DIE_STEPS[c.innateDieStepIndex]).type];
    if (c.addAttrToDamage) spent += 2;
    spent += (c.weaponRangeBonus / 1) * 2; // stored in squares, 2TP each
    c.weaponProperties.forEach(pk => { let p = NPC_WEAPON_PROPERTIES.find(x => x.key === pk); if (p) spent += p.tp; });
    c.powers.forEach(p => { spent += p.tp; });
    [1, 2, 3, 4, 5].forEach(lvl => { spent += c.casterSlots[lvl] * ({ 1: 1, 2: 2, 3: 3, 4: 5, 5: 10 })[lvl]; });
    c.traits.forEach(tk => { let t = NPC_TRAITS.find(x => x.key === tk); if (t) spent += t.tp; });
    spent += Object.keys(c.traitEnergyTypes || {}).length; // +1 TP each, for traits with an optional Energy Type restriction
    spent += (c.legendaryResistances || 0) * 4;
    spent += ((c.legendaryApPool || 0) / 3) * 5;
    if (c.lairActions) spent += 10;
    if (c.mythicAwakening) spent += 20;
    return spent;
};

window.companionRemainingTp = function() {
    return window.companionTotalTp() - window.companionTpSpent();
};

window.openNpcCrafter = function() {
    if (lcRank() < 1) {
        window.showConfirm("You need at least Rank 1 of Loyal Companion before you can build a companion.", null, true);
        return;
    }
    ncTarget = 'companion';
    ncActiveGmNpcId = null;
    if (!window.state.companion) window.state.companion = getBlankCompanion();
    ncStep = 1;
    for (let i = 1; i <= 8; i++) {
        let el = document.getElementById(`ncStep${i}`);
        if (el) el.classList.toggle('active', i === 1);
    }
    ncRenderAll();
    window.openModal('npcCrafterModal');
};

// GM entry point. Pass an existing gmNpcs id to edit it, or omit to create
// a fresh NPC and open straight into the builder for it.
window.openGmNpcBuilder = function(npcId) {
    ncTarget = 'gm';
    if (npcId) {
        ncActiveGmNpcId = npcId;
    } else {
        let id = crypto.randomUUID();
        window.gmNpcs.push({ id, npc: getBlankCompanion() });
        ncActiveGmNpcId = id;
    }
    ncStep = 1;
    for (let i = 1; i <= 8; i++) {
        let el = document.getElementById(`ncStep${i}`);
        if (el) el.classList.toggle('active', i === 1);
    }
    ncRenderAll();
    window.renderGmNpcList();
    window.openModal('npcCrafterModal');
};

window.navNpcCrafter = function(dir) {
    window.jumpToNcStep(ncStep + dir);
};

window.jumpToNcStep = function(n) {
    let unlocked = ncStepsUnlocked();
    if (n > unlocked || n < 1) return;
    document.getElementById(`ncStep${ncStep}`).classList.remove('active');
    ncStep = n;
    document.getElementById(`ncStep${ncStep}`).classList.add('active');
    ncRenderAll();
};

window.ncBuyExtraTp = function(amount) {
    let c = ncActiveCompanion();
    if (ncTarget === 'gm') {
        // A GM isn't spending a character's XP -- their TP budget is
        // just a free-form pool they set directly for the encounter.
        c.gmTpBudget = Math.max(0, (c.gmTpBudget || 0) + amount);
        ncRenderAll();
        return;
    }
    let cost = lcTpXpCost() * amount;
    let unspent = window.state.unspentXp || 0;
    if (unspent < cost) {
        window.showConfirm(`Not enough XP. Buying ${amount} TP costs ${cost} XP at your current rank.`, null, true);
        return;
    }
    window.updateState('unspentXp', unspent - cost);
    c.extraTpPurchased += amount;
    ncRenderAll();
};

// A GM NPC's budget auto-expands to whatever tier accommodates the TP
// just spent, rather than blocking the purchase -- e.g. spending past 5
// TP (Tier 0's ceiling) bumps the budget straight to 10 (Tier 1), past
// 10 bumps to 30 (Tier 2), matching NPC_TIER_TP's thresholds exactly.
// Loyal Companions keep the older "not enough TP" block, since their
// budget is tied to the perk's rank rather than something a GM can just
// expand on the fly.
function npcTpBudgetForSpend(spent) {
    for (let i = 0; i < NPC_TIER_TP.length; i++) {
        if (NPC_TIER_TP[i].tp >= spent) return NPC_TIER_TP[i].tp;
    }
    let extraTiers = Math.ceil((spent - 100) / 20);
    return 100 + extraTiers * 20;
}
function ncEnsureTierForSpend(newSpentTotal) {
    if (ncTarget !== 'gm') return;
    let c = ncActiveCompanion();
    if (!c) return;
    if (newSpentTotal > (c.gmTpBudget || 0)) {
        c.gmTpBudget = npcTpBudgetForSpend(newSpentTotal);
    }
}
window.npcTpBudgetForSpend = npcTpBudgetForSpend;
window.ncEnsureTierForSpend = ncEnsureTierForSpend;

function ncSpend(delta, applyFn) {
    if (delta > 0) {
        if (ncTarget === 'gm') {
            ncEnsureTierForSpend(window.companionTpSpent() + delta);
        } else {
            let remaining = window.companionRemainingTp();
            if (delta > remaining) {
                window.showConfirm(`Not enough Threat Points. This costs ${delta} TP, you have ${remaining} remaining.`, null, true);
                return false;
            }
        }
    }
    applyFn();
    ncRenderAll();
    return true;
}

// ---- Step 1: Attributes & Vitals ----
window.ncAdjustAttr = function(attr, delta) {
    let c = ncActiveCompanion();
    let cost = delta; // +1 costs 1 TP, -1 refunds 1 TP
    ncSpend(cost, () => { c.attrBonuses[attr] += delta; });
};
window.ncAdjustHpTier = function(delta) {
    let c = ncActiveCompanion();
    if (c.hpTierBonus + delta < 0) return;
    ncSpend(delta, () => { c.hpTierBonus += delta; });
};
window.ncAdjustAp = function(delta) {
    let c = ncActiveCompanion();
    let tierInfo = npcTierForTP(window.companionTotalTp());
    let maxApBonus = (tierInfo.tier + 1) * 2; // "+2 AP per Tier" max, tier 0 allows 2
    if (c.apBonus + delta < 0 || c.apBonus + delta > maxApBonus) return;
    ncSpend(delta * 3, () => { c.apBonus += delta; });
};

// ---- Step 2: Size & Locomotion ----
window.ncSetSize = function(key) {
    let c = ncActiveCompanion();
    let oldDef = NPC_SIZES.find(s => s.key === c.size);
    let newDef = NPC_SIZES.find(s => s.key === key);
    let delta = newDef.tp - oldDef.tp;
    ncSpend(delta, () => { c.size = key; });
};
window.ncToggleSwarm = function(checked) {
    let c = ncActiveCompanion();
    ncSpend(checked ? 3 : -3, () => { c.swarm = checked; });
};
window.ncAdjustSpeed = function(delta) {
    let c = ncActiveCompanion();
    ncSpend(delta, () => { c.speedBonus += delta; });
};
window.ncAddLocomotion = function(type) {
    let c = ncActiveCompanion();
    let existing = c.altLocomotion.find(l => l.type === type);
    if (existing) {
        if (existing.doubled) return; // can only double once
        ncSpend(2, () => { existing.doubled = true; });
    } else {
        ncSpend(2, () => { c.altLocomotion.push({ type, doubled: false }); });
    }
};
window.ncRemoveLocomotion = function(type) {
    let c = ncActiveCompanion();
    let idx = c.altLocomotion.findIndex(l => l.type === type);
    if (idx === -1) return;
    let refund = c.altLocomotion[idx].doubled ? 4 : 2;
    ncSpend(-refund, () => { c.altLocomotion.splice(idx, 1); });
};
window.ncToggleHover = function(checked) {
    ncSpend(checked ? 4 : -4, () => { ncActiveCompanion().hover = checked; });
};

// ---- Step 3: Senses ----
window.ncToggleSense = function(key, checked) {
    let c = ncActiveCompanion();
    let def = NPC_SENSES.find(s => s.key === key);
    ncSpend(checked ? def.tp : -def.tp, () => { c.senses[key] = checked; });
};
window.ncToggleSenseOption = function(key, option, checked) {
    let c = ncActiveCompanion();
    let def = NPC_SENSES.find(s => s.key === key);
    let arr = c.senses[key];
    if (checked) {
        ncSpend(def.tp, () => { arr.push(option); });
    } else {
        let idx = arr.indexOf(option);
        if (idx === -1) return;
        ncSpend(def.tp, () => { arr.splice(idx, 1); }); // negative not needed, refund handled by removal below
    }
};

// ---- Step 4: Defenses ----
window.ncAdjustDef = function(field, delta, tpPer) {
    let c = ncActiveCompanion();
    let tierInfo = npcTierForTP(window.companionTotalTp());
    let max = Math.max(1, tierInfo.tier); // "max +1 AC / +2 DR / +2 ER per Tier"
    if (c[field] + delta < 0 || c[field] + delta > max) return;
    ncSpend(delta * tpPer, () => { c[field] += delta; });
};
window.ncAddTextImmunity = function(field, tp, label) {
    window.openPerkTextPicker({ name: label }, 'Companion', (text) => {
        if (!text) return;
        ncSpend(tp, () => { ncActiveCompanion()[field].push(text); });
    }, 'Name the condition/type...');
};
window.ncRemoveTextImmunity = function(field, idx, tp) {
    let c = ncActiveCompanion();
    ncSpend(-tp, () => { c[field].splice(idx, 1); });
};

// ---- Step 5: Weapons ----
function ncTrainingCount(c) { return c.otherTrainings.length; }

// Manufactured weapons on a companion get the Training Bonus only if the
// matching weapon-type training was purchased (Ch.15: "you only need to
// purchase Skill Training for them" -- unlike Innate Weapons, nothing is
// automatic here).
function companionWeaponTypeLabel(w) {
    let cat = w.category === 'ranged' ? 'Ranged' : 'Melee';
    let wc = w.weightClass ? (w.weightClass.charAt(0).toUpperCase() + w.weightClass.slice(1)) : 'Light';
    return `${wc} ${cat} Weapons`;
}
// Which attribute(s) can govern this weapon (Ch.8/9): Ranged is always AGI.
// Heavy melee (and Medium wielded 2-handed) is STR only. Light and Medium
// (1-handed) melee let the wielder pick whichever of STR/AGI is better --
// so for a companion (no per-weapon attr toggle of its own) we always take
// the higher of the two automatically.
function companionWeaponGoverningAttrs(w, twoHanded) {
    if (w.category === 'ranged') return ['AGI'];
    if (w.weightClass === 'heavy' || twoHanded) return ['STR'];
    return ['STR', 'AGI'];
}
function companionWeaponBestAttr(w, mods, twoHanded) {
    let allowed = companionWeaponGoverningAttrs(w, twoHanded);
    return allowed.reduce((best, a) => ((mods[a] || 0) > (mods[best] || 0) ? a : best), allowed[0]);
}
// Mirrors weaponAtkBonus/weaponDmgModifier from apx-engine.js against the
// companion's own attribute mods instead of the player's calc. Returns the
// trained flag explicitly rather than inferring it from the bonus being
// nonzero (an attribute bonus alone doesn't mean the weapon is trained).
function companionWeaponAttackBonus(c, w, mods, twoHanded) {
    let attr = companionWeaponBestAttr(w, mods, twoHanded);
    let attrMod = mods[attr] || 0;
    let trained = c.otherTrainings.includes(companionWeaponTypeLabel(w));
    let aimBonus = 0;
    if (w.category === 'ranged' && w.aimed) {
        aimBonus = mods.PER || 0;
        if ((window.state.perks['per_sharpshooter'] || 0) >= 4) aimBonus *= 2;
    }
    return { bonus: attrMod + (trained ? c.trainingBonus : 0) + aimBonus, trained, attr };
}
// Ch.9 Making Attacks (exact ranged rule): ranged damage always uses AGI,
// no melee-style STR choice. Heavy ranged is the one exception -- it ADDS
// STR on top of AGI, it doesn't replace or double it. Melee keeps its
// normal weight-class attribute rules (STR-or-AGI choice, Heavy doubles).
function companionWeaponDamageModifier(w, mods, twoHanded) {
    let aimBonus = 0;
    if (w.category === 'ranged' && w.aimed) {
        aimBonus = mods.PER || 0;
        if ((window.state.perks['per_sharpshooter'] || 0) >= 4) aimBonus *= 2;
    }
    if (w.category === 'ranged') {
        let agiMod = mods.AGI || 0;
        let heavyStrBonus = (w.weightClass === 'heavy') ? (mods.STR || 0) : 0;
        return agiMod + heavyStrBonus + aimBonus;
    }
    let attr = companionWeaponBestAttr(w, mods, twoHanded);
    let attrMod = mods[attr] || 0;
    let mult = (w.weightClass === 'heavy' || twoHanded) ? 2 : 1;
    return (attrMod * mult) + aimBonus;
}

window.ncAdjustTrainingBonus = function(delta) {
    let c = ncActiveCompanion();
    if (c.trainingBonus + delta < 2) return; // can't go below the starting +2
    ncSpend(delta * 2, () => { c.trainingBonus += delta; });
};
window.ncAddOtherTraining = function() {
    let c = ncActiveCompanion();
    let tierInfo = npcTierForTP(window.companionTotalTp());
    let max = 2 * tierInfo.tier;
    if (ncTrainingCount(c) >= max) {
        window.showConfirm(`Max Training TP reached (2x Tier = ${max}).`, null, true);
        return;
    }
    let skillNames = [...new Set(SKILLS.map(s => s.name))];
    let renderPickRow = (name) => {
        let already = c.otherTrainings.includes(name);
        return `<button ${already ? 'disabled' : ''} onclick="window.ncPickTraining('${name}')" class="text-left text-[10px] px-2 py-1 rounded border ${already ? 'bg-slate-800 text-slate-600 border-slate-800 cursor-not-allowed' : 'bg-slate-900 text-slate-200 border-slate-700 hover:border-amber-600'}">${name}${already ? ' (trained)' : ''}</button>`;
    };
    // Encyclopedia isn't a fixed skill name (each Field of Study is its own
    // named skill, same as the player's own Encyclopedia entries), so it
    // gets its own prompt instead of a static picker row.
    let encyclopediaRow = `<button onclick="window.ncPickEncyclopedia()" class="text-left text-[10px] px-2 py-1 rounded border bg-slate-900 text-slate-200 border-slate-700 hover:border-amber-600 col-span-2">Encyclopedia (choose a Field of Study)...</button>`;
    document.getElementById('ncTrainingPickerBody').innerHTML = `
        <div class="text-[10px] font-black text-amber-400 uppercase mb-1">Skills</div>
        <div class="grid grid-cols-2 gap-1 mb-3">${skillNames.map(renderPickRow).join('')}${encyclopediaRow}</div>
        <div class="text-[10px] font-black text-amber-400 uppercase mb-1">Weapon Types</div>
        <div class="grid grid-cols-2 gap-1">${WEAPON_TYPE_TRAININGS.map(renderPickRow).join('')}</div>
    `;
    window.openModal('ncTrainingPickerModal');
};

window.ncPickEncyclopedia = function() {
    window.closeModal('ncTrainingPickerModal');
    window.openPerkTextPicker({ name: 'Encyclopedia' }, 'Companion Training', (field) => {
        if (!field) return;
        window.ncPickTraining(`Encyclopedia (${field})`);
    }, 'e.g. History, Xenobiology...');
};

window.ncPickTraining = function(name) {
    let c = ncActiveCompanion();
    ncSpend(1, () => { c.otherTrainings.push(name); });
    window.closeModal('ncTrainingPickerModal');
};
window.ncRemoveOtherTraining = function(idx) {
    let c = ncActiveCompanion();
    ncSpend(-1, () => { c.otherTrainings.splice(idx, 1); });
};
window.ncRemoveCompanionWeapon = function(idx) {
    // Manufactured gear is bought with Currency/Crafting Materials, not TP
    // (unlike everything else in this wizard), so removing it doesn't run
    // through ncSpend -- there's no TP to refund.
    let c = ncActiveCompanion();
    if (!c || !c.weapons[idx]) return;
    window.showConfirm(`Remove ${c.weapons[idx].name}?`, () => {
        c.weapons.splice(idx, 1);
        ncRenderAll();
    });
};
window.ncToggleCompanionWeaponAim = function(idx, checked) {
    let c = ncActiveCompanion();
    if (!c || !c.weapons[idx]) return;
    c.weapons[idx].aimed = checked;
    window.recalculateMath();
};
window.ncRemoveCompanionPower = function(idx) {
    let c = ncActiveCompanion();
    if (!c || !c.powers[idx]) return;
    window.showConfirm(`Remove ${c.powers[idx].name}?`, () => {
        c.powers.splice(idx, 1);
        ncRenderAll();
    });
};
window.toggleCompanionPowerSlot = function(lvl, idx) {
    let c = ncActiveCompanion();
    if (!c) return;
    let max = c.casterSlots[lvl] || 0;
    if (max === 0) return;
    let used = c.usedPowerSlots[lvl] || 0;
    let isFilled = idx >= used;
    c.usedPowerSlots[lvl] = isFilled ? Math.min(max, used + 1) : idx;
    window.recalculateMath();
};
// Lair Actions' Shared Trait: pick any NPC trait to broadcast as a note on
// every enemy in the initiative order once this NPC joins combat.
window.openLairSharedTraitPicker = function() {
    let rows = NPC_TRAITS.map(t => `
        <div class="flex items-center justify-between bg-slate-900 border border-slate-700 rounded p-2">
            <div>
                <div class="text-xs font-bold text-purple-300">${t.label}</div>
                <div class="text-[9px] text-slate-500 leading-tight">${t.desc}</div>
            </div>
            <button onclick="window.ncSetLairSharedTrait('${t.key}')" class="text-[10px] text-amber-400 hover:text-amber-300 font-bold shrink-0 ml-2">Select</button>
        </div>
    `).join('');
    document.getElementById('ncTrainingPickerBody').innerHTML = `
        <div class="text-[10px] font-black text-amber-400 uppercase mb-1">Choose a Shared Trait</div>
        ${rows}
    `;
    document.getElementById('ncTrainingPickerModal').querySelector('h3').innerText = 'Select Shared Trait';
    window.openModal('ncTrainingPickerModal');
};
window.ncSetLairSharedTrait = function(traitKey) {
    ncActiveCompanion().lairSharedTraitKey = traitKey;
    window.closeModal('ncTrainingPickerModal');
    document.getElementById('ncTrainingPickerModal').querySelector('h3').innerText = 'Choose Training';
    ncRenderAll();
};
window.ncClearLairSharedTrait = function() {
    ncActiveCompanion().lairSharedTraitKey = null;
    ncRenderAll();
};

// Quick-add: copy one of the player's own already-crafted powers onto the
// companion at the appropriate TP cost for its Level, rather than
// rebuilding it from scratch in the Power Crafter.
window.ncOpenPowerPicker = function() {
    let playerPowers = window.state.powers || [];
    let rows = playerPowers.map((p, i) => {
        let tpCost = NPC_POWER_LEVEL_TP[p.lvl];
        return `
            <div class="flex items-center justify-between bg-slate-900 border border-slate-700 rounded p-2">
                <div>
                    <div class="text-xs font-bold text-purple-300">${p.name}</div>
                    <div class="text-[9px] text-slate-500">Level ${p.lvl} | ${tpCost} TP</div>
                </div>
                <button onclick="window.ncQuickAddPower(${i})" class="text-[10px] text-amber-400 hover:text-amber-300 font-bold">+ Add</button>
            </div>
        `;
    }).join('');
    document.getElementById('ncTrainingPickerBody').innerHTML = `
        <div class="text-[10px] font-black text-amber-400 uppercase mb-1">Your Powers</div>
        ${rows || '<div class="text-[10px] text-slate-600">You have not crafted any powers of your own yet.</div>'}
    `;
    document.getElementById('ncTrainingPickerModal').querySelector('h3').innerText = 'Quick Add a Power';
    window.openModal('ncTrainingPickerModal');
};
window.ncQuickAddPower = function(playerPowerIdx) {
    let p = window.state.powers[playerPowerIdx];
    if (!p) return;
    let tp = NPC_POWER_LEVEL_TP[p.lvl];
    if (ncTarget === 'gm') {
        ncEnsureTierForSpend(window.companionTpSpent() + tp);
    } else {
        let remaining = window.companionRemainingTp();
        if (tp > remaining) {
            window.showConfirm(`Not enough Threat Points. This costs ${tp} TP, you have ${remaining} remaining.`, null, true);
            return;
        }
    }
    ncActiveCompanion().powers.push({
        name: p.name, lvl: p.lvl, ap: p.ap, atk: p.atk, rng: p.rng, dmg: p.dmg, desc: p.desc,
        draft: p.draft ? JSON.parse(JSON.stringify(p.draft)) : null, tp
    });
    window.closeModal('ncTrainingPickerModal');
    document.getElementById('ncTrainingPickerModal').querySelector('h3').innerText = 'Choose Training';
    ncRenderAll();
};
window.ncAdjustDieStep = function(delta) {
    let c = ncActiveCompanion();
    let tierInfo = npcTierForTP(window.companionTotalTp());
    let max = Math.min(NPC_DIE_STEPS.length - 1, tierInfo.tier);
    let newIndex = c.innateDieStepIndex + delta;
    if (newIndex < 0 || newIndex > max) return;
    ncSpend(delta, () => {
        c.innateDieStepIndex = newIndex;
        // Additional dice always match the current step's die type -- they
        // don't need "converting", but the step's own base die count can
        // change (e.g. 1d12 -> 2d6), so re-clamp against the 2xTier cap.
        let maxDiceTotal = 2 * tierInfo.tier;
        let baseCount = parseDieStep(NPC_DIE_STEPS[c.innateDieStepIndex]).count;
        if (baseCount + c.additionalDiceCount > maxDiceTotal) {
            c.additionalDiceCount = Math.max(0, maxDiceTotal - baseCount);
        }
    });
};
function ncTotalDice() {
    let c = ncActiveCompanion();
    let baseCount = parseDieStep(NPC_DIE_STEPS[c.innateDieStepIndex]).count;
    return baseCount + c.additionalDiceCount;
}
window.ncAdjustAdditionalDice = function(delta) {
    let c = ncActiveCompanion();
    let tierInfo = npcTierForTP(window.companionTotalTp());
    let maxDice = 2 * tierInfo.tier;
    if (delta > 0 && ncTotalDice() >= maxDice) {
        window.showConfirm(`Max dice reached (2x Tier = ${maxDice}).`, null, true);
        return;
    }
    if (c.additionalDiceCount + delta < 0) return;
    let dieType = parseDieStep(NPC_DIE_STEPS[c.innateDieStepIndex]).type;
    ncSpend(delta * NPC_ADDITIONAL_DIE_COST[dieType], () => { c.additionalDiceCount += delta; });
};
window.ncSetAttrToDamage = function(attr) {
    let c = ncActiveCompanion();
    if (c.addAttrToDamage === attr) {
        ncSpend(-2, () => { c.addAttrToDamage = null; });
    } else {
        let wasNull = !c.addAttrToDamage;
        ncSpend(wasNull ? 2 : 0, () => { c.addAttrToDamage = attr; });
    }
};
window.ncAdjustWeaponRange = function(delta) {
    let c = ncActiveCompanion();
    if (c.weaponRangeBonus + delta < 0) return;
    ncSpend(delta * 2, () => { c.weaponRangeBonus += delta; });
};
window.ncToggleWeaponProperty = function(key, checked) {
    let c = ncActiveCompanion();
    let def = NPC_WEAPON_PROPERTIES.find(p => p.key === key);
    if (checked) {
        ncSpend(def.tp, () => { c.weaponProperties.push(key); });
    } else {
        ncSpend(-def.tp, () => { c.weaponProperties = c.weaponProperties.filter(k => k !== key); });
    }
};

// ---- Step 6: Powers ----
const NPC_POWER_LEVEL_TP = { 1: 2, 2: 4, 3: 8, 4: 12, 5: 20 };

// Book-accurate TP costs for a Power's usage type, added on top of its
// base Level cost:
// - Charges: +half the base cost (rounded down) per charge BEYOND the
//   first. A Level 3 Power (base 8 TP) with 3 charges/day: 8 + 4 + 4 = 16.
// - Recharge: +1 TP per Power Level. Always a flat 5-6 on a d6 at the
//   start of its turn (not a configurable threshold -- that's the book's
//   actual rule, not a GM choice).
// - Unlimited Uses: +5 TP per Power Level. Restricted to Level 1 Powers
//   on Tier 1-3 NPCs, or Level 2 Powers on Tier 4-5 NPCs.
// Anything else (the "once per Full Rest" default) costs just the base.
function npcPowerUsageExtraTp(level, usageType, maxCharges) {
    let base = NPC_POWER_LEVEL_TP[level] || 0;
    if (usageType === 'charges') {
        let charges = Math.max(1, maxCharges || 1);
        return (charges - 1) * Math.floor(base / 2);
    }
    if (usageType === 'recharge') return level;
    if (usageType === 'unlimitedPaid') return 5 * level;
    return 0;
}
function npcPowerTotalTp(level, usageType, maxCharges) {
    return (NPC_POWER_LEVEL_TP[level] || 0) + npcPowerUsageExtraTp(level, usageType, maxCharges);
}
// Unlimited Uses is only ever a legal choice for a Level 1 Power on a
// Tier 1-3 NPC, or a Level 2 Power on a Tier 4-5 NPC.
function npcUnlimitedUsesAllowed(level, npcTier) {
    if (level === 1) return npcTier >= 1 && npcTier <= 3;
    if (level === 2) return npcTier >= 4 && npcTier <= 5;
    return false;
}
window.npcPowerTotalTp = npcPowerTotalTp;
window.npcPowerUsageExtraTp = npcPowerUsageExtraTp;
window.npcUnlimitedUsesAllowed = npcUnlimitedUsesAllowed;
const NPC_CASTER_SLOT_TP = { 1: 1, 2: 2, 3: 3, 4: 5, 5: 10 };
window.ncAdjustCasterSlot = function(level, delta) {
    let c = ncActiveCompanion();
    if (c.casterSlots[level] + delta < 0) return;
    ncSpend(delta * NPC_CASTER_SLOT_TP[level], () => { c.casterSlots[level] += delta; });
};

// ---- Step 7: Traits ----
window.ncToggleTrait = function(key, checked) {
    let c = ncActiveCompanion();
    let def = NPC_TRAITS.find(t => t.key === key);
    if (checked) {
        ncSpend(def.tp, () => { c.traits.push(key); });
    } else {
        // Dropping the trait also drops (and refunds) any Energy Type
        // restriction bought for it -- that sub-choice can't exist
        // without the trait itself.
        let hadEnergyType = !!c.traitEnergyTypes[key];
        ncSpend(-(def.tp + (hadEnergyType ? 1 : 0)), () => {
            c.traits = c.traits.filter(k => k !== key);
            delete c.traitEnergyTypes[key];
        });
    }
};

window.ncUpdateName = function(val) {
    ncActiveCompanion().name = val;
};

window.closeNpcCrafter = function() {
    window.closeModal('npcCrafterModal');
    window.recalculateMath();
    if (ncTarget === 'gm') window.renderGmNpcList();
};

window.finishGmNpc = function() {
    let c = ncActiveCompanion();
    window.closeModal('npcCrafterModal');
    window.renderGmNpcList();
    // Auto-save GM NPCs to Firestore
    if (window.apxAuth?.enabled) {
        window.apxAuth.saveGmNpcs(window.gmNpcs || []).catch(e => console.warn('NPC save failed:', e.message));
    }
    // If this NPC was created via "Link Stat Block" from a world NPC note,
    // auto-link it and return to the world modal instead of the NPC roster.
    if (window._pendingLinkNpcNoteId && ncActiveGmNpcId) {
        let noteId = window._pendingLinkNpcNoteId;
        window._pendingLinkNpcNoteId = null;
        // Use the world-system-scoped function so it can access _wNotes
        if (typeof window.linkNpcNoteToStatBlock === 'function') {
            window.linkNpcNoteToStatBlock(noteId, ncActiveGmNpcId);
        }
        return;
    }
    window.openGmNpcRosterModal();
    window.showConfirm(`${c.name || 'This NPC'} is saved to your NPC roster. Use Export to save it to a file.`, null, true);
};

// ------------------------------------------------------------------
// GM NPC Roster: list, delete, export/import. Entirely separate from
// character save data -- these live in window.gmNpcs and are saved to
// their own JSON file(s), the same way character export/import works.
// ------------------------------------------------------------------
window.openGmNpcRosterModal = function() {
    window.renderGmNpcList();
    window.openModal('gmNpcRosterModal');
};

window.renderGmNpcList = function() {
    let body = document.getElementById('gmNpcListBody');
    if (!body) return;
    if (!window.gmNpcs.length) {
        body.innerHTML = '<div class="text-xs text-slate-500 text-center py-6">No NPCs yet. Click "+ New NPC" to build one.</div>';
        return;
    }
    let searchEl = document.getElementById('gmNpcSearch');
    let search = searchEl ? (searchEl.value || '').trim().toLowerCase() : '';
    let filtered = window.gmNpcs.filter(entry => !search || (entry.npc.name || '').toLowerCase().includes(search));
    if (!filtered.length) {
        body.innerHTML = '<div class="text-xs text-slate-500 text-center py-6">No NPCs match that search.</div>';
        return;
    }
    body.innerHTML = filtered.map(entry => {
        let tierInfo = npcTierForTP(entry.npc.gmTpBudget || 0);
        return `
            <div class="flex items-center justify-between bg-slate-900 border border-slate-700 rounded p-2">
                <div>
                    <div class="text-sm font-bold text-purple-300">${entry.npc.name || 'Unnamed NPC'}</div>
                    <div class="text-[10px] text-slate-500">Tier ${tierInfo.tier} &middot; ${entry.npc.gmTpBudget || 0} TP budget</div>
                </div>
                <div class="flex gap-1">
                    <button onclick="window.openGmNpcBuilder('${entry.id}')" class="text-[10px] text-purple-400 hover:text-purple-300 font-bold px-2 py-1">Edit</button>
                    <button onclick="window.exportGmNpc('${entry.id}')" class="text-[10px] text-slate-400 hover:text-slate-300 font-bold px-2 py-1">Export</button>
                    <button onclick="window.deleteGmNpc('${entry.id}')" class="text-[10px] text-red-400 hover:text-red-300 font-bold px-2 py-1">Delete</button>
                </div>
            </div>
        `;
    }).join('');
};

window.deleteGmNpc = function(id) {
    let entry = window.gmNpcs.find(n => n.id === id);
    if (!entry) return;
    window.showConfirm(`Delete ${entry.npc.name || 'this NPC'}? This cannot be undone.`, () => {
        window.gmNpcs = window.gmNpcs.filter(n => n.id !== id);
        window.renderGmNpcList();
        if (window.apxAuth?.enabled) window.apxAuth.saveGmNpcs(window.gmNpcs || []).catch(()=>{});
    });
};

function ncDownloadJson(filename, data) {
    let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    let anchor = document.createElement('a');
    anchor.setAttribute("href", dataStr);
    anchor.setAttribute("download", filename);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
}

window.exportGmNpc = function(id) {
    let entry = window.gmNpcs.find(n => n.id === id);
    if (!entry) return;
    let fileName = (entry.npc.name || 'npc').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    ncDownloadJson(fileName + ".json", entry);
};

window.exportAllGmNpcs = function() {
    if (!window.gmNpcs.length) {
        window.showConfirm("No NPCs to export yet.", null, true);
        return;
    }
    ncDownloadJson("gm_npc_roster.json", window.gmNpcs);
};

window.importGmNpc = function(event) {
    let files = Array.from(event.target.files || []);
    if (!files.length) return;
    let remaining = files.length;
    let hadError = false;
    files.forEach(file => {
        let reader = new FileReader();
        reader.onload = function(e) {
            try {
                let parsed = JSON.parse(e.target.result);
                let entries = Array.isArray(parsed) ? parsed : [parsed];
                entries.forEach(entry => {
                    if (!entry || !entry.npc) return; // not a recognizable NPC file, skip silently
                    entry.id = entry.id || crypto.randomUUID();
                    if (window.gmNpcs.some(n => n.id === entry.id)) entry.id = crypto.randomUUID();
                    window.gmNpcs.push(entry);
                });
            } catch (err) {
                console.error("Failed to parse NPC file:", file.name, err);
                hadError = true;
            }
            remaining--;
            if (remaining === 0) {
                window.renderGmNpcList();
                document.getElementById('gmNpcImportFile').value = '';
                if (hadError) window.showConfirm("One or more selected files weren't valid NPC files and were skipped.", null, true);
            }
        };
        reader.readAsText(file);
    });
};

// ------------------------------------------------------------------
// Full computed stat block, used by the pinned quick-reference card,
// the Companion Attacks weapon row, the HP tracker, and the detail popup.
// ------------------------------------------------------------------
window.companionStatBlock = function() {
    let c = ncActiveCompanion();
    if (!c) return null;
    let totalTp = window.companionTotalTp();
    let tierInfo = npcTierForTP(totalTp);
    let tier = tierInfo.tier;

    let mods = {}; // base score is always 5, so mod == the TP-purchased bonus directly
    ATTRIBUTES.forEach(a => { mods[a] = c.attrBonuses[a]; });

    let maxHp = tierInfo.hp + (c.hpTierBonus * 5 * Math.max(1, tier));
    let sizeDef = NPC_SIZES.find(s => s.key === c.size);
    if (sizeDef) maxHp += sizeDef.hp;
    maxHp = Math.max(1, maxHp);

    let armor = c.equippedArmor || {};
    let ac = 10 + mods.AGI + c.acBonus + (armor.ac || 0);
    let dr = mods.CON + c.drBonus + (armor.dr || 0);
    let nonConStr = ATTRIBUTES.filter(a => a !== 'CON' && a !== 'STR').map(a => mods[a]);
    let er = Math.max(0, ...nonConStr, 0) + c.erBonus + (armor.er || 0);
    let speed = 3 + c.speedBonus + (armor.speedMod || 0);
    let ap = 6 + c.apBonus * 1; // AP purchases add flat +1 each (not tied to AGI for NPCs, per Ch.15 baseline "6 AP")
    // NPCs don't get a chosen initStat like players (AGI or PER) --
    // AGI is the standard default for Passive Initiative.
    let initiative = 10 + mods.AGI;

    let dieInfo = parseDieStep(NPC_DIE_STEPS[c.innateDieStepIndex]);
    let totalDiceCount = dieInfo.count + c.additionalDiceCount;
    let dmgDiceText = `${totalDiceCount}${dieInfo.type}`;
    let attackAttrMod = c.addAttrToDamage ? mods[c.addAttrToDamage] : 0;
    let dmgText = dmgDiceText + (attackAttrMod ? ` ${attackAttrMod >= 0 ? '+' : '-'} ${Math.abs(attackAttrMod)}` : '');
    // Attack roll always uses whichever of STR/AGI is better (mirroring
    // equipped-weapon melee attacks and Ch.9 Making Attacks generally --
    // an attack roll always draws on the creature's own physical stats,
    // not just its training). "Add Attribute to Damage" is a separate,
    // optional purchase that only affects the damage roll.
    let attackAttrChoice = (mods.AGI || 0) > (mods.STR || 0) ? 'AGI' : 'STR';
    let attackBonus = c.trainingBonus + (mods[attackAttrChoice] || 0);
    let range = 1 + c.weaponRangeBonus;
    let propNames = c.weaponProperties.map(k => (NPC_WEAPON_PROPERTIES.find(p => p.key === k) || {}).label).filter(Boolean);

    let senseList = [];
    if (c.senses.nightvision) senseList.push('Nightvision');
    c.senses.keensenses.forEach(s => senseList.push(`Keen Senses (${s})`));
    if (c.senses.vibration) senseList.push('Vibration Senses (8 sq)');
    if (c.senses.supernatural) senseList.push('Supernatural Senses (8 sq)');
    c.senses.blinddeaf.forEach(s => senseList.push(`Blind/Deaf (${s})`));

    let traitList = c.traits.map(k => NPC_TRAITS.find(t => t.key === k)).filter(Boolean)
        .map(t => (c.traitEnergyTypes || {})[t.key] ? { ...t, label: `${t.label} (${(c.traitEnergyTypes || {})[t.key]})` } : t)
        .map(t => t.tierCalc ? { ...t, tierNote: t.tierCalc(tier) } : t);
    let powerCards = c.powers.filter(p => !p.isLairAction).map(p => ({ name: p.name, lvl: p.lvl, ap: p.ap, atk: p.atk, rng: p.rng, dmg: p.dmg, desc: p.desc, usageType: p.usageType, maxCharges: p.maxCharges, rechargeOn: p.rechargeOn }));
    let lairActionPowerCards = c.powers.filter(p => p.isLairAction).map(p => ({ name: p.name, lvl: p.lvl, ap: p.ap, atk: p.atk, rng: p.rng, dmg: p.dmg, desc: p.desc, usageType: p.usageType, maxCharges: p.maxCharges, rechargeOn: p.rechargeOn }));
    // Power Attack Bonus / Save DC: same shape as a weapon's trained
    // attack bonus (Training Bonus + attribute mod), auto-picking
    // whichever of INT/CHA is better -- mirrors how a player's own Powers
    // are governed by whichever Powers perk (Intelligence or Charisma)
    // they've taken.
    let powerAttrChoice = (mods.CHA || 0) > (mods.INT || 0) ? 'CHA' : 'INT';
    let powerAttackBonus = c.trainingBonus + (mods[powerAttrChoice] || 0);
    let powerSaveDc = 10 + c.trainingBonus + (mods[powerAttrChoice] || 0);
    let powerList = powerCards.map(p => `${p.name} (Level ${p.lvl})`);
    // otherTrainings mixes weapon-type strings and skill names together;
    // split them out here so skills can get their own computed bonus line.
    let trainedSkills = c.otherTrainings
        .filter(name => !WEAPON_TYPE_TRAININGS.includes(name))
        .map(name => {
            let base = name.startsWith('Encyclopedia') ? 'Encyclopedia' : name;
            let skillDef = SKILLS.find(s => s.name === base);
            let attr = skillDef ? skillDef.attr : (base === 'Encyclopedia' ? 'INT' : null);
            let attrMod = attr ? (mods[attr] || 0) : 0;
            let total = attrMod + c.trainingBonus;
            return { name, attr, attrMod, trainingBonus: c.trainingBonus, total };
        });
    let equippedWeapons = [];
    (c.weapons || []).forEach((w, wIdx) => {
        let dmgMod = companionWeaponDamageModifier(w, mods);
        let dmgText = dmgMod !== 0 ? `${w.dmg} ${dmgMod >= 0 ? '+' : '-'} ${Math.abs(dmgMod)}` : w.dmg;
        let atkInfo = companionWeaponAttackBonus(c, w, mods);
        equippedWeapons.push({
            name: w.name, dmg: dmgText, ap: w.ap, weaponIdx: wIdx,
            atk: atkInfo.bonus, trained: atkInfo.trained, attr: atkInfo.attr,
            typeLabel: companionWeaponTypeLabel(w), category: w.category, aimed: !!w.aimed
        });
        // Medium melee weapons can also be wielded 2-handed: STR only,
        // +1 AP, +1 die step -- shown as a second linked row, same as the
        // player's own weapon table already does.
        if (w.category !== 'ranged' && w.weightClass === 'medium') {
            let twoHDice = nextDieTier(w.dmg) || w.dmg;
            let twoHDmgMod = companionWeaponDamageModifier(w, mods, true);
            let twoHDmgText = twoHDmgMod !== 0 ? `${twoHDice} ${twoHDmgMod >= 0 ? '+' : ''}${twoHDmgMod}` : twoHDice;
            let twoHAtkInfo = companionWeaponAttackBonus(c, w, mods, true);
            equippedWeapons.push({
                name: `${w.name} (2-Handed)`, dmg: twoHDmgText, ap: w.ap + 1,
                atk: twoHAtkInfo.bonus, trained: twoHAtkInfo.trained, attr: twoHAtkInfo.attr,
                typeLabel: companionWeaponTypeLabel(w), isTwoHanded: true, category: w.category
            });
        }
    });

    if (c.currentHp === null || c.currentHp === undefined) c.currentHp = maxHp;
    c.currentHp = Math.min(c.currentHp, maxHp);

    return {
        name: c.name, tier, totalTp, spentTp: window.companionTpSpent(),
        maxHp, currentHp: c.currentHp, ac, dr, er, speed, ap, initiative,
        legendaryResistances: c.legendaryResistances || 0,
        legendaryApPool: c.legendaryApPool || 0,
        lairActions: !!c.lairActions,
        lairActionsText: c.lairActionsText || '',
        mythicAwakening: !!c.mythicAwakening,
        mythicAwakeningText: c.mythicAwakeningText || '',
        size: sizeDef ? sizeDef.label : 'Medium', swarm: c.swarm,
        altLocomotion: c.altLocomotion, hover: c.hover,
        mods, dmgText, attackBonus, range, propNames, trainingBonus: c.trainingBonus,
        otherTrainings: c.otherTrainings, equippedWeapons, equippedArmorName: armor.name || null, trainedSkills,
        senseList, traitList, powerList, powerCards, lairActionPowerCards, casterSlots: c.casterSlots,
        powerAttrChoice, powerAttackBonus, powerSaveDc,
        conditionImmunities: c.conditionImmunities, conditionalDmgImmunities: c.conditionalDmgImmunities,
        energyImmunities: c.energyImmunities, energyVulnerabilities: c.energyVulnerabilities
    };
};

window.adjustCompanionHp = function(delta) {
    let sb = window.companionStatBlock();
    if (!sb) return;
    let c = ncActiveCompanion();
    c.currentHp = Math.max(0, Math.min(sb.maxHp, sb.currentHp + delta));
    window.recalculateMath();
};

window.setCompanionHp = function(val) {
    let sb = window.companionStatBlock();
    if (!sb) return;
    let c = ncActiveCompanion();
    let n = parseInt(val);
    if (isNaN(n)) n = sb.currentHp;
    c.currentHp = Math.max(0, Math.min(sb.maxHp, n));
    window.recalculateMath();
};

window.openCompanionDetail = function() {
    let sb = window.companionStatBlock();
    if (!sb) return;
    // Use the same floating window system as the GM screen's NPC stat blocks
    // so the companion card can be dragged around and left open during play.
    let winId = 'companion';
    if (window.gmFloatingWindows && window.gmFloatingWindows[winId]) {
        window.gmFloatingWindows[winId].style.zIndex = ++window.gmFloatingZTop;
        return;
    }
    // If the floating window system isn't available (e.g. GM screen not open),
    // fall back to the modal.
    if (!window.openFloatingStatBlockRaw) {
        document.getElementById('companionDetailTitle').innerText = sb.name;
        document.getElementById('companionDetailBody').innerHTML = buildStatBlockHtml(sb, true);
        window.openModal('companionDetailModal');
        return;
    }
    window.openFloatingStatBlockRaw(winId, sb.name, buildStatBlockHtml(sb, true));
};

// Allow opening any NPC stat block as a floating window by gmNpc ID.
// Used from the World Notes NPC list and the NPC roster.
window.openFloatingNpcStatBlockById = function(gmNpcId) {
    let entry = (window.gmNpcs || []).find(n => n.id === gmNpcId);
    if (!entry) return;
    let winId = 'npc_' + gmNpcId;
    if (window.gmFloatingWindows && window.gmFloatingWindows[winId]) {
        window.gmFloatingWindows[winId].style.zIndex = ++window.gmFloatingZTop;
        return;
    }
    if (!window.openFloatingStatBlockRaw) return;
    let sb = ncStatBlockFor(gmNpcId);
    window.openFloatingStatBlockRaw(winId, entry.npc?.name || 'NPC', window.buildStatBlockHtml(sb, false));
};

// Shared by the builder's own detail popup (editable HP) and the GM
// Screen's read-only floating stat-block windows -- one source of truth
// for this markup instead of two copies drifting apart.
function buildStatBlockHtml(sb, editable) {
    let hpControls = editable ? `
        <div class="flex items-center gap-2">
            <button onclick="window.adjustCompanionHp(-1)" class="w-7 h-7 rounded bg-slate-700 hover:bg-slate-600 text-white font-bold">-</button>
            <input type="number" value="${sb.currentHp}" onchange="window.setCompanionHp(this.value); window.openCompanionDetail();" class="w-14 text-center bg-slate-800 border-slate-600 text-white font-black">
            <span class="text-slate-500 font-bold">/ ${sb.maxHp}</span>
            <button onclick="window.adjustCompanionHp(1)" class="w-7 h-7 rounded bg-amber-700 hover:bg-amber-600 text-white font-bold">+</button>
        </div>
    ` : `
        <div class="text-white font-black">${sb.currentHp} <span class="text-slate-500 font-bold">/ ${sb.maxHp}</span></div>
    `;
    return `
        <div class="grid grid-cols-5 gap-2 mb-3 bg-slate-900 border border-purple-800/50 rounded-lg p-2">
            <div class="text-center"><div class="text-[9px] text-slate-500 uppercase font-bold">Tier</div><div class="text-lg font-black text-white">${sb.tier}</div></div>
            <div class="text-center"><div class="text-[9px] text-slate-500 uppercase font-bold">AC</div><div class="text-lg font-black text-white">${sb.ac}</div></div>
            <div class="text-center"><div class="text-[9px] text-slate-500 uppercase font-bold">DR / ER</div><div class="text-lg font-black text-white">${sb.dr} / ${sb.er}</div></div>
            <div class="text-center"><div class="text-[9px] text-slate-500 uppercase font-bold">Speed</div><div class="text-lg font-black text-white">${sb.speed}</div></div>
            <div class="text-center"><div class="text-[9px] text-slate-500 uppercase font-bold">AP</div><div class="text-lg font-black text-white">${sb.ap}</div></div>
        </div>
        <div class="flex items-center justify-between bg-slate-900 border border-red-800/50 rounded p-2 mb-3">
            <span class="text-xs font-bold text-slate-200">Hit Points</span>
            ${hpControls}
        </div>
        <div class="grid grid-cols-7 gap-1 mb-3">
            ${ATTRIBUTES.map(a => `<div class="text-center bg-slate-900 border border-slate-700 rounded p-1"><div class="text-[9px] text-slate-500 font-bold">${a}</div><div class="text-xs font-black text-white">${sb.mods[a]>=0?'+':''}${sb.mods[a]}</div></div>`).join('')}
        </div>
        <div class="bg-slate-900 border border-slate-700 rounded p-2 mb-2">
            <div class="text-[10px] font-black text-amber-400 uppercase mb-1">Innate Attack</div>
            <div class="text-xs text-slate-200">+${sb.attackBonus} to hit, ${sb.dmgText} damage, Range ${sb.range} sq, 3 AP</div>
            ${sb.propNames.length ? `<div class="text-[10px] text-slate-500 mt-1">${sb.propNames.join(', ')}</div>` : ''}
        </div>
        ${(sb.equippedWeapons.length || sb.equippedArmorName) ? `<div class="bg-slate-900 border border-orange-800/50 rounded p-2 mb-2">
            <div class="text-[10px] font-black text-orange-400 uppercase mb-1">Equipped Gear</div>
            ${sb.equippedWeapons.length ? sb.equippedWeapons.map(w => `<div class="text-xs text-slate-200">${w.name}: +${w.atk} to hit, ${w.dmg} damage, ${w.ap} AP <span class="text-[10px] text-slate-500">(${w.typeLabel})</span></div>`).join('') : ''}
            ${sb.equippedArmorName ? `<div class="text-xs text-slate-200 mt-1">Armor: ${sb.equippedArmorName}</div>` : ''}
        </div>` : ''}
        <div class="bg-slate-900 border border-emerald-800/50 rounded p-2 mb-2">
            <div class="text-[10px] font-black text-emerald-400 uppercase mb-1">Trained Skills</div>
            ${sb.trainedSkills.length ? sb.trainedSkills.map(s => `<div class="text-xs text-slate-200">${s.name} (${s.total >= 0 ? '+' : ''}${s.total})</div>`).join('') : '<div class="text-[10px] text-slate-600">No skills trained</div>'}
        </div>
        <div class="grid grid-cols-2 gap-2">
            <div class="bg-slate-900 border border-slate-700 rounded p-2">
                <div class="text-[10px] font-black text-blue-400 uppercase mb-1">Size / Movement</div>
                <div class="text-[10px] text-slate-300">${sb.size}${sb.swarm ? ' (Swarm)' : ''}</div>
                ${sb.altLocomotion.map(l => `<div class="text-[10px] text-slate-300">${l.type} Speed ${sb.speed * (l.doubled ? 2 : 1)}</div>`).join('')}
                ${sb.hover ? '<div class="text-[10px] text-slate-300">Hover</div>' : ''}
            </div>
            <div class="bg-slate-900 border border-slate-700 rounded p-2">
                <div class="text-[10px] font-black text-blue-400 uppercase mb-1">Senses</div>
                ${sb.senseList.length ? sb.senseList.map(s => `<div class="text-[10px] text-slate-300">${s}</div>`).join('') : '<div class="text-[10px] text-slate-600">None</div>'}
            </div>
            <div class="bg-slate-900 border border-slate-700 rounded p-2">
                <div class="text-[10px] font-black text-emerald-400 uppercase mb-1">Immunities</div>
                ${sb.conditionImmunities.concat(sb.energyImmunities).map(v => `<div class="text-[10px] text-slate-300">${v}</div>`).join('') || '<div class="text-[10px] text-slate-600">None</div>'}
            </div>
            <div class="bg-slate-900 border border-slate-700 rounded p-2">
                <div class="text-[10px] font-black text-red-400 uppercase mb-1">Vulnerabilities</div>
                ${sb.energyVulnerabilities.map(v => `<div class="text-[10px] text-slate-300">${v}</div>`).join('') || '<div class="text-[10px] text-slate-600">None</div>'}
            </div>
        </div>
        ${sb.traitList.length ? `<div class="bg-slate-900 border border-slate-700 rounded p-2 mt-2">
            <div class="text-[10px] font-black text-purple-400 uppercase mb-1">Traits</div>
            ${sb.traitList.map(t => `<div class="text-[10px] text-slate-300 mb-1"><span class="font-bold text-slate-200">${t.label}:</span> ${t.desc}${t.tierNote ? `<div class="text-emerald-400 font-bold mt-0.5">${t.tierNote}</div>` : ''}</div>`).join('')}
        </div>` : ''}
        ${(sb.legendaryResistances > 0 || sb.legendaryApPool > 0 || sb.lairActions || sb.mythicAwakening) ? `<div class="bg-slate-900 border border-amber-800/50 rounded p-2 mt-2">
            <div class="text-[10px] font-black text-amber-400 uppercase mb-1">Legendary Features</div>
            ${sb.legendaryResistances > 0 ? `<div class="text-[10px] text-slate-300">Legendary Resistance (${sb.legendaryResistances}/day)</div>` : ''}
            ${sb.legendaryApPool > 0 ? `<div class="text-[10px] text-slate-300">Legendary Actions: ${sb.legendaryApPool} bonus AP</div>` : ''}
            ${sb.lairActions ? `<div class="text-[10px] text-slate-300 mt-1">
                <span class="font-bold">Lair Actions</span>
                ${sb.lairActionsText ? `<div style="white-space: pre-line" class="mt-0.5">${sb.lairActionsText}</div>` : ''}
            </div>` : ''}
            ${sb.lairActionPowerCards.length ? sb.lairActionPowerCards.map(p => powerCardHtml(p)).join('') : ''}
            ${sb.mythicAwakening ? `<div class="text-[10px] text-slate-300 mt-1">
                <span class="font-bold">Mythic Awakening</span>
                ${sb.mythicAwakeningText ? `<div style="white-space: pre-line" class="mt-0.5">${sb.mythicAwakeningText}</div>` : ''}
            </div>` : ''}
        </div>` : ''}
        ${sb.powerCards.length ? `<div class="bg-slate-900 border border-slate-700 rounded p-2 mt-2">
            <div class="flex items-center justify-between mb-1">
                <div class="text-[10px] font-black text-purple-400 uppercase">Powers</div>
                <div class="text-[10px] text-slate-300 font-bold">Power Attack Bonus: <span class="text-white">${sb.powerAttackBonus >= 0 ? '+' : ''}${sb.powerAttackBonus}</span> &middot; Save DC: <span class="text-white">${sb.powerSaveDc}</span> <span class="text-slate-500 font-normal">(${sb.powerAttrChoice})</span></div>
            </div>
            ${sb.powerCards.map(p => powerCardHtml(p)).join('')}
        </div>` : ''}
    `;
}
function powerCardHtml(p) {
    let usageLabel = '';
    if (p.usageType === 'charges') usageLabel = `Charges: ${p.maxCharges}/day`;
    else if (p.usageType === 'recharge') usageLabel = `Recharge ${p.rechargeOn === 6 ? '6' : p.rechargeOn + '-6'}`;
    return `
        <div class="bg-slate-800 p-1.5 rounded border border-slate-700 mb-1">
            <div class="flex justify-between items-center mb-0.5">
                <span class="font-bold text-[10px] text-purple-300">${p.name}</span>
                <span class="text-[8px] bg-slate-900 px-1.5 py-0.5 rounded border border-slate-600 text-slate-400 font-bold">Lvl ${p.lvl} | ${p.ap} AP</span>
            </div>
            ${usageLabel ? `<div class="text-[9px] text-amber-400 font-bold mb-0.5">${usageLabel}</div>` : ''}
            <div class="grid grid-cols-3 gap-1 mb-0.5 text-[9px] text-slate-400">
                <div><span class="text-slate-500">A/S:</span> ${p.atk}</div>
                <div><span class="text-slate-500">R/A:</span> ${p.rng}</div>
                <div><span class="text-slate-500">D/H:</span> ${p.dmg}</div>
            </div>
            <div class="text-[9px] text-slate-500 leading-tight">${p.desc}</div>
        </div>
    `;
}
window.buildStatBlockHtml = buildStatBlockHtml;

// ------------------------------------------------------------------
// Rendering
// ------------------------------------------------------------------
function ncRenderAll() {
    let unlocked = ncStepsUnlocked();
    window.updateWizardTabs('ncTab', ncStep, 8, unlocked);
    ncRenderStep1(); ncRenderStep2(); ncRenderStep3(); ncRenderStep4();
    ncRenderStep5(); ncRenderStep6(); ncRenderStep7();
    if (ncTarget === 'gm') ncRenderStep8();
    ncRenderSummary();
    document.getElementById('ncBtnPrev').style.display = ncStep > 1 ? 'block' : 'none';
    document.getElementById('ncBtnNext').style.display = ncStep < unlocked ? 'block' : 'none';
    // GM NPCs auto-save as you edit them (same as a companion always has),
    // but with potentially many NPCs to juggle, an explicit "done" action
    // at the last step gives a clear moment to wrap up and go back to the
    // list -- rather than an unlabeled Close being the only way out.
    document.getElementById('ncBtnFinishGm').style.display = (ncTarget === 'gm' && ncStep >= unlocked) ? 'block' : 'none';
    let companionFinishBtn = document.getElementById('ncBtnFinishCompanion');
    if (companionFinishBtn) companionFinishBtn.style.display = (ncTarget === 'companion' && ncStep >= unlocked) ? 'block' : 'none';
}

function ncRenderSummary() {
    let c = ncActiveCompanion();
    let total = window.companionTotalTp();
    let spent = window.companionTpSpent();
    let remaining = total - spent;
    let tierInfo = npcTierForTP(total);
    document.getElementById('ncName').value = c.name;
    document.getElementById('ncSumTier').innerText = tierInfo.tier;
    document.getElementById('ncSumTp').innerText = `${spent} / ${total}`;
    document.getElementById('ncSumTp').className = remaining < 0 ? 'text-lg font-black text-red-400' : 'text-lg font-black text-white';
    document.getElementById('ncSumHp').innerText = tierInfo.hp + (c.hpTierBonus * 5 * Math.max(1, tierInfo.tier));
    // XP Reward only applies to GM NPCs -- a Loyal Companion isn't
    // something that gets "defeated" for XP, and the main character sheet
    // doesn't even have this element in its copy of the modal.
    let xpWrap = document.getElementById('ncSumXpWrap');
    if (xpWrap) {
        xpWrap.classList.toggle('hidden', ncTarget !== 'gm');
        if (ncTarget === 'gm') document.getElementById('ncSumXp').innerText = window.npcXpForTier(tierInfo.tier); // matches the XP stashed on defeat in the GM Screen's initiative tracker
    }
    document.getElementById('npcCrafterTitle').innerText = ncTarget === 'gm' ? 'The NPC Crafter -- GM NPC' : 'The NPC Crafter -- Loyal Companion';
    let tpBanner = document.getElementById('ncTpBannerText');
    let tpButtons = document.getElementById('ncTpBannerButtons');
    if (ncTarget === 'gm') {
        tpBanner.innerText = 'GM Threat Points -- a free budget you set directly, not paid for with XP.';
        tpButtons.innerHTML = `
            <button onclick="window.ncBuyExtraTp(-5)" class="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold">-5 TP</button>
            <button onclick="window.ncBuyExtraTp(-1)" class="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold">-1 TP</button>
            <button onclick="window.ncBuyExtraTp(1)" class="px-2 py-1 rounded bg-amber-700 hover:bg-amber-600 text-white text-[10px] font-bold">+1 TP</button>
            <button onclick="window.ncBuyExtraTp(5)" class="px-2 py-1 rounded bg-amber-700 hover:bg-amber-600 text-white text-[10px] font-bold">+5 TP</button>
        `;
    } else {
        tpBanner.innerText = `Buy more TP with XP -- currently ${lcTpXpCost()} XP/TP (Unspent XP: ${window.state.unspentXp || 0})`;
        tpButtons.innerHTML = `
            <button onclick="window.ncBuyExtraTp(1)" class="px-2 py-1 rounded bg-amber-700 hover:bg-amber-600 text-white text-[10px] font-bold">+1 TP</button>
            <button onclick="window.ncBuyExtraTp(5)" class="px-2 py-1 rounded bg-amber-700 hover:bg-amber-600 text-white text-[10px] font-bold">+5 TP</button>
        `;
    }
}

function ncRenderStep1() {
    let c = ncActiveCompanion();
    let rows = ATTRIBUTES.map(a => `
        <div class="flex items-center justify-between bg-slate-900 border border-slate-700 rounded px-2 py-1.5">
            <span class="text-xs font-bold text-white w-10">${a}</span>
            <span class="text-[10px] text-slate-500">5 ${c.attrBonuses[a] >= 0 ? '+' : ''}${c.attrBonuses[a]} = ${5 + c.attrBonuses[a]}</span>
            <div class="flex items-center gap-1">
                <button onclick="window.ncAdjustAttr('${a}', -1)" class="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-white font-bold">-</button>
                <button onclick="window.ncAdjustAttr('${a}', 1)" class="w-6 h-6 rounded bg-amber-700 hover:bg-amber-600 text-white font-bold">+</button>
            </div>
        </div>
    `).join('');
    document.getElementById('ncStep1Attrs').innerHTML = rows;
    document.getElementById('ncStep1Extras').innerHTML = `
        <div class="flex items-center justify-between bg-slate-900 border border-slate-700 rounded px-2 py-1.5">
            <span class="text-xs font-bold text-white">Max HP (+5/Tier per purchase): x${c.hpTierBonus}</span>
            <div class="flex items-center gap-1">
                <button onclick="window.ncAdjustHpTier(-1)" class="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-white font-bold">-</button>
                <button onclick="window.ncAdjustHpTier(1)" class="w-6 h-6 rounded bg-amber-700 hover:bg-amber-600 text-white font-bold">+</button>
            </div>
        </div>
        <div class="flex items-center justify-between bg-slate-900 border border-slate-700 rounded px-2 py-1.5">
            <span class="text-xs font-bold text-white">+1 AP (max +2/Tier, 3 TP each): x${c.apBonus}</span>
            <div class="flex items-center gap-1">
                <button onclick="window.ncAdjustAp(-1)" class="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-white font-bold">-</button>
                <button onclick="window.ncAdjustAp(1)" class="w-6 h-6 rounded bg-amber-700 hover:bg-amber-600 text-white font-bold">+</button>
            </div>
        </div>
    `;
}

function ncRenderStep2() {
    let c = ncActiveCompanion();
    document.getElementById('ncStep2Sizes').innerHTML = NPC_SIZES.map(s => `
        <label class="flex items-start gap-2 bg-slate-900 border ${c.size === s.key ? 'border-purple-500' : 'border-slate-700'} rounded p-2 cursor-pointer">
            <input type="radio" name="ncSize" class="mt-1" ${c.size === s.key ? 'checked' : ''} onchange="window.ncSetSize('${s.key}')">
            <div><div class="text-xs font-bold text-slate-200">${s.label} <span class="text-yellow-500">[${s.tp} TP]</span></div><div class="text-[10px] text-slate-500 leading-tight">${s.desc}</div></div>
        </label>
    `).join('');
    let locOptions = ['Fly', 'Climb', 'Burrow', 'Swim'];
    document.getElementById('ncStep2Loc').innerHTML = `
        <label class="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded p-2 cursor-pointer">
            <input type="checkbox" ${c.swarm ? 'checked' : ''} onchange="window.ncToggleSwarm(this.checked)"> Swarm [+3 TP]
        </label>
        <div class="flex items-center justify-between bg-slate-900 border border-slate-700 rounded px-2 py-1.5">
            <span class="text-xs font-bold text-white">Speed +1 sq (1 TP each)</span>
            <div class="flex items-center gap-1">
                <button onclick="window.ncAdjustSpeed(-1)" class="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-white font-bold">-</button>
                <span class="w-6 text-center text-white font-bold">${c.speedBonus}</span>
                <button onclick="window.ncAdjustSpeed(1)" class="w-6 h-6 rounded bg-amber-700 hover:bg-amber-600 text-white font-bold">+</button>
            </div>
        </div>
        <label class="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded p-2 cursor-pointer">
            <input type="checkbox" ${c.hover ? 'checked' : ''} onchange="window.ncToggleHover(this.checked)"> Hover [4 TP] -- immune to difficult terrain, pressure plates, liquid surfaces
        </label>
        <div class="text-[10px] font-black text-slate-400 uppercase mt-2">Alternative Locomotion (2 TP each, doubling +2 TP)</div>
        ${locOptions.map(type => {
            let existing = c.altLocomotion.find(l => l.type === type);
            return `<div class="flex items-center justify-between bg-slate-900 border border-slate-700 rounded px-2 py-1.5">
                <span class="text-xs font-bold text-white">${type}${existing && existing.doubled ? ' (x2 speed)' : ''}</span>
                <div class="flex items-center gap-1">
                    ${existing ? `<button onclick="window.ncRemoveLocomotion('${type}')" class="text-[10px] text-red-400 hover:text-red-300 font-bold mr-1">Remove</button>` : ''}
                    <button onclick="window.ncAddLocomotion('${type}')" ${existing && existing.doubled ? 'disabled' : ''} class="w-6 h-6 rounded ${existing && existing.doubled ? 'bg-slate-800 text-slate-600' : 'bg-amber-700 hover:bg-amber-600 text-white'} font-bold">+</button>
                </div>
            </div>`;
        }).join('')}
    `;
}

function ncRenderStep3() {
    let c = ncActiveCompanion();
    let simple = NPC_SENSES.filter(s => !['keensenses', 'blinddeaf'].includes(s.key));
    let rows = simple.map(s => `
        <label class="flex items-start gap-2 bg-slate-900 border border-slate-700 rounded p-2 cursor-pointer">
            <input type="checkbox" class="mt-1" ${c.senses[s.key] ? 'checked' : ''} onchange="window.ncToggleSense('${s.key}', this.checked)">
            <div><div class="text-xs font-bold text-slate-200">${s.label} <span class="${s.tp<0?'text-emerald-400':'text-yellow-500'}">[${s.tp} TP]</span></div><div class="text-[10px] text-slate-500 leading-tight">${s.desc}</div></div>
        </label>
    `).join('');
    let senseOptions = ['Sight', 'Hearing', 'Smell'];
    let keenRow = `<div class="bg-slate-900 border border-slate-700 rounded p-2">
        <div class="text-xs font-bold text-slate-200 mb-1">Keen Senses (choose sense, 1 TP each) <span class="text-yellow-500">[1 TP]</span></div>
        <div class="flex gap-2">${senseOptions.map(o => `<label class="flex items-center gap-1 text-[10px] text-slate-300"><input type="checkbox" ${c.senses.keensenses.includes(o)?'checked':''} onchange="window.ncToggleSenseOption('keensenses','${o}',this.checked)">${o}</label>`).join('')}</div>
    </div>`;
    let blindRow = `<div class="bg-slate-900 border border-slate-700 rounded p-2">
        <div class="text-xs font-bold text-slate-200 mb-1">Blind/Deaf (choose sense) <span class="text-emerald-400">[-2 TP]</span></div>
        <div class="flex gap-2">${senseOptions.map(o => `<label class="flex items-center gap-1 text-[10px] text-slate-300"><input type="checkbox" ${c.senses.blinddeaf.includes(o)?'checked':''} onchange="window.ncToggleSenseOption('blinddeaf','${o}',this.checked)">${o}</label>`).join('')}</div>
    </div>`;
    document.getElementById('ncStep3').querySelector('.ncSensesList').innerHTML = rows + keenRow + blindRow;
}

function ncRenderStep4() {
    let c = ncActiveCompanion();
    let tierInfo = npcTierForTP(window.companionTotalTp());
    let statRow = (label, field, tpPer, maxPerTier) => `
        <div class="flex items-center justify-between bg-slate-900 border border-slate-700 rounded px-2 py-1.5">
            <span class="text-xs font-bold text-white">${label} (max +${maxPerTier}/Tier, ${tpPer} TP each): +${c[field]}</span>
            <div class="flex items-center gap-1">
                <button onclick="window.ncAdjustDef('${field}', -1, ${tpPer})" class="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-white font-bold">-</button>
                <button onclick="window.ncAdjustDef('${field}', 1, ${tpPer})" class="w-6 h-6 rounded bg-amber-700 hover:bg-amber-600 text-white font-bold">+</button>
            </div>
        </div>
    `;
    let textList = (field, label, tp) => `
        <div class="bg-slate-900 border border-slate-700 rounded p-2">
            <div class="flex items-center justify-between mb-1">
                <span class="text-xs font-bold text-white">${label} [${tp} TP each]</span>
                <button onclick="window.ncAddTextImmunity('${field}', ${tp}, '${label}')" class="text-[10px] text-amber-400 hover:text-amber-300 font-bold">+ Add</button>
            </div>
            <div class="flex flex-wrap gap-1">${c[field].map((v, i) => `<span class="text-[9px] bg-slate-800 border border-slate-600 rounded px-1.5 py-0.5 text-slate-300">${v} <button onclick="window.ncRemoveTextImmunity('${field}', ${i}, ${tp})" class="text-red-400 font-bold ml-1">&times;</button></span>`).join('')}</div>
        </div>
    `;
    document.getElementById('ncStep4').querySelector('.ncDefList').innerHTML =
        statRow('AC', 'acBonus', 1, tierInfo.tier || 1) +
        statRow('DR (+2)', 'drBonus', 1, tierInfo.tier || 1) +
        statRow('ER (+2)', 'erBonus', 1, tierInfo.tier || 1) +
        textList('conditionImmunities', 'Condition Immunity', 2) +
        textList('conditionalDmgImmunities', 'Conditional Damage Immunity', 3) +
        textList('energyImmunities', 'Energy Immunity', 4) +
        textList('energyVulnerabilities', 'Energy Vulnerability (-3 TP refund)', -3);
}

function ncRenderStep5() {
    let c = ncActiveCompanion();
    let tierInfo = npcTierForTP(window.companionTotalTp());
    let stepper = (label, cur, onDec, onInc, extra = '') => `
        <div class="flex items-center justify-between bg-slate-900 border border-slate-700 rounded px-2 py-1.5">
            <span class="text-xs font-bold text-white">${label}${extra}</span>
            <div class="flex items-center gap-1">
                <button onclick="${onDec}" class="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-white font-bold">-</button>
                <span class="w-6 text-center text-white font-bold">${cur}</span>
                <button onclick="${onInc}" class="w-6 h-6 rounded bg-amber-700 hover:bg-amber-600 text-white font-bold">+</button>
            </div>
        </div>
    `;
    let dieInfo = parseDieStep(NPC_DIE_STEPS[c.innateDieStepIndex]);
    let perDieCost = NPC_ADDITIONAL_DIE_COST[dieInfo.type];
    let totalDice = ncTotalDice();
    let diceRows = stepper(`Additional ${dieInfo.type} dice (${perDieCost} TP each, currently ${totalDice}${dieInfo.type} total)`, c.additionalDiceCount,
        `window.ncAdjustAdditionalDice(-1)`, `window.ncAdjustAdditionalDice(1)`);
    document.getElementById('ncStep5').querySelector('.ncWeaponList').innerHTML = `
        ${stepper(`Training Bonus (2 TP per +1, starts at +2)`, c.trainingBonus, `window.ncAdjustTrainingBonus(-1)`, `window.ncAdjustTrainingBonus(1)`)}
        <div class="bg-slate-900 border border-emerald-800/50 rounded p-2 text-[10px] text-emerald-300">
            Innate Weapons are inherently trained -- the attack roll already includes the Training Bonus above (+${c.trainingBonus}) at no TP cost.
        </div>
        <div class="bg-slate-900 border border-slate-700 rounded p-2">
            <div class="flex items-center justify-between mb-1">
                <span class="text-xs font-bold text-white">Other Skill/Weapon Training [1 TP each, max ${2*(tierInfo.tier||0)} TP total]</span>
                <button onclick="window.ncAddOtherTraining()" class="text-[10px] text-amber-400 hover:text-amber-300 font-bold">+ Add</button>
            </div>
            <div class="flex flex-wrap gap-1">${c.otherTrainings.map((v, i) => `<span class="text-[9px] bg-slate-800 border border-slate-600 rounded px-1.5 py-0.5 text-slate-300">${v} <button onclick="window.ncRemoveOtherTraining(${i})" class="text-red-400 font-bold ml-1">&times;</button></span>`).join('') || '<span class="text-[9px] text-slate-600">None</span>'}</div>
        </div>
        ${stepper(`Innate Weapon Die Step (currently ${NPC_DIE_STEPS[c.innateDieStepIndex]})`, c.innateDieStepIndex, `window.ncAdjustDieStep(-1)`, `window.ncAdjustDieStep(1)`)}
        ${diceRows}
        <div class="flex items-center gap-3 bg-slate-900 border border-slate-700 rounded px-2 py-1.5">
            <span class="text-xs font-bold text-white">Add Attribute to Damage [2 TP]</span>
            <label class="flex items-center gap-1 text-[10px] text-slate-300"><input type="radio" name="ncAttrDmg" ${c.addAttrToDamage==='STR'?'checked':''} onchange="window.ncSetAttrToDamage('STR')">STR</label>
            <label class="flex items-center gap-1 text-[10px] text-slate-300"><input type="radio" name="ncAttrDmg" ${c.addAttrToDamage==='AGI'?'checked':''} onchange="window.ncSetAttrToDamage('AGI')">AGI</label>
            <label class="flex items-center gap-1 text-[10px] text-slate-300"><input type="radio" name="ncAttrDmg" ${!c.addAttrToDamage?'checked':''} onchange="window.ncSetAttrToDamage(null)">None</label>
        </div>
        ${stepper('Weapon Range +1 sq (2 TP each)', c.weaponRangeBonus, `window.ncAdjustWeaponRange(-1)`, `window.ncAdjustWeaponRange(1)`)}
        <div class="text-[10px] font-black text-slate-400 uppercase mt-2">Weapon Properties</div>
        ${NPC_WEAPON_PROPERTIES.map(p => `
            <label class="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded p-2 cursor-pointer">
                <input type="checkbox" ${c.weaponProperties.includes(p.key)?'checked':''} onchange="window.ncToggleWeaponProperty('${p.key}', this.checked)">
                <span class="text-xs text-slate-200">${p.label} <span class="text-yellow-500">[${p.tp} TP]</span></span>
            </label>
        `).join('')}
        <div class="text-[10px] font-black text-slate-400 uppercase mt-3 mb-1">Manufactured Gear (built with Currency/Crafting Materials, not TP)</div>
        <div class="bg-slate-900 border border-slate-700 rounded p-2 mb-1.5">
            <div class="flex items-center justify-between mb-1">
                <span class="text-xs font-bold text-white">Equipped Weapons</span>
                <button onclick="window.openWeaponForge(null, ncTarget)" class="text-[10px] text-orange-400 hover:text-orange-300 font-bold">+ Forge Weapon</button>
            </div>
            ${c.weapons.length ? c.weapons.map((w, i) => `
                <div class="flex items-center justify-between text-[10px] text-slate-300 py-0.5">
                    <span>${w.name} (${w.dmg}, ${w.ap} AP)</span>
                    <div class="flex gap-1">
                        <button onclick="window.openWeaponForge(${i}, ncTarget)" class="text-orange-400 hover:text-orange-300 font-bold">Edit</button>
                        <button onclick="window.ncRemoveCompanionWeapon(${i})" class="text-red-400 hover:text-red-300 font-bold">Remove</button>
                    </div>
                </div>
            `).join('') : '<div class="text-[10px] text-slate-600">None equipped</div>'}
        </div>
        <div class="bg-slate-900 border border-slate-700 rounded p-2">
            <div class="flex items-center justify-between mb-1">
                <span class="text-xs font-bold text-white">Equipped Armor [1 TP per point of AC it grants]</span>
                <button onclick="window.openArmorForge(ncTarget)" class="text-[10px] text-orange-400 hover:text-orange-300 font-bold">${c.equippedArmor.name ? 'Edit' : '+ Forge Armor'}</button>
            </div>
            ${c.equippedArmor.name ? `<div class="text-[10px] text-slate-300">${c.equippedArmor.name} (AC +${c.equippedArmor.ac}, DR +${c.equippedArmor.dr}, ER +${c.equippedArmor.er})</div>` : '<div class="text-[10px] text-slate-600">None equipped</div>'}
        </div>
    `;
}

function ncRenderStep6() {
    let c = ncActiveCompanion();
    let powerRows = c.powers.map((p, i) => `
        <div class="bg-slate-900 border border-slate-700 rounded p-2">
            <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-purple-300">${p.name} <span class="text-slate-500 font-normal">(Lvl ${p.lvl}, ${p.ap} AP, ${p.tp} TP)</span></span>
                <div class="flex gap-2">
                    ${p.draft ? `<button onclick="window.openPowerEditor(${i}, ncTarget)" class="text-[10px] text-purple-400 hover:text-purple-300 font-bold">Edit</button>` : ''}
                    <button onclick="window.ncRemoveCompanionPower(${i})" class="text-[10px] text-red-400 hover:text-red-300 font-bold">Remove</button>
                </div>
            </div>
            <div class="text-[9px] text-slate-500 mt-1">${p.desc || ''}</div>
        </div>
    `).join('');
    let slotRows = [1,2,3,4,5].map(lvl => `
        <div class="flex items-center justify-between bg-slate-900 border border-slate-700 rounded px-2 py-1.5">
            <span class="text-xs font-bold text-white">Slot Level ${lvl} (${NPC_CASTER_SLOT_TP[lvl]} TP each): ${c.casterSlots[lvl]}</span>
            <div class="flex items-center gap-1">
                <button onclick="window.ncAdjustCasterSlot(${lvl}, -1)" class="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-white font-bold">-</button>
                <button onclick="window.ncAdjustCasterSlot(${lvl}, 1)" class="w-6 h-6 rounded bg-amber-700 hover:bg-amber-600 text-white font-bold">+</button>
            </div>
        </div>
    `).join('');
    document.getElementById('ncStep6').querySelector('.ncPowerList').innerHTML = `
        <p class="text-[10px] text-slate-400 mb-2">Powers are built with the same Power Crafter used for your own character. Its XP-derived Level determines the flat TP cost charged to your companion's budget instead. Powers default to once per day/combat unless you buy Caster Slots below for repeated Full-Rest uses.</p>
        <div class="flex flex-wrap gap-2 mb-2">
            <button onclick="window.openPowerCrafter(false, ncTarget)" class="px-3 py-1.5 rounded bg-purple-700 hover:bg-purple-600 text-white text-[10px] font-bold">Craft New Power</button>
            <button onclick="window.ncOpenPowerPicker()" class="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold">+ Quick Add from Your Powers</button>
        </div>
        ${powerRows || '<div class="text-[10px] text-slate-600">No powers granted yet.</div>'}
        <div class="text-[10px] font-black text-slate-400 uppercase mt-3 mb-1">Caster Slots (uses per Full Rest)</div>
        ${slotRows}
    `;
}

function ncRenderStep7() {
    let c = ncActiveCompanion();
    document.getElementById('ncStep7').querySelector('.ncTraitList').innerHTML = NPC_TRAITS.map(t => {
        let checked = c.traits.includes(t.key);
        let energyOption = (t.hasEnergyTypeOption && checked) ? `
            <div class="mt-1.5 pl-1 border-l-2 border-slate-700">
                <label class="flex items-center gap-1 text-[10px] text-slate-400 mb-1">
                    <input type="checkbox" ${(c.traitEnergyTypes || {})[t.key] ? 'checked' : ''} onchange="window.ncToggleTraitEnergyType('${t.key}', this.checked)">
                    Restrict to one Energy type (+1 TP)
                </label>
                ${(c.traitEnergyTypes || {})[t.key] ? `
                    <select onchange="window.ncSetTraitEnergyType('${t.key}', this.value)" class="bg-slate-800 border-slate-600 text-[10px]">
                        ${NPC_ENERGY_TYPES.map(e => `<option value="${e}" ${(c.traitEnergyTypes || {})[t.key] === e ? 'selected' : ''}>${e}</option>`).join('')}
                    </select>
                ` : ''}
            </div>
        ` : '';
        return `
        <label class="flex items-start gap-2 bg-slate-900 border border-slate-700 rounded p-2 cursor-pointer">
            <input type="checkbox" class="mt-1" ${checked?'checked':''} onchange="window.ncToggleTrait('${t.key}', this.checked)">
            <div class="flex-1"><div class="text-xs font-bold text-slate-200">${t.label} <span class="${t.tp<0?'text-emerald-400':'text-yellow-500'}">[${t.tp} TP]</span></div><div class="text-[10px] text-slate-500 leading-tight">${t.desc}</div>${energyOption}</div>
        </label>
    `; }).join('');
}
window.ncToggleTraitEnergyType = function(traitKey, checked) {
    let c = ncActiveCompanion();
    if (checked) {
        ncSpend(1, () => { c.traitEnergyTypes[traitKey] = NPC_ENERGY_TYPES[0]; });
    } else {
        ncSpend(-1, () => { delete c.traitEnergyTypes[traitKey]; });
    }
};
window.ncSetTraitEnergyType = function(traitKey, value) {
    ncActiveCompanion().traitEnergyTypes[traitKey] = value;
    ncRenderAll();
};

// ---- Step 8: Legendary Features (GM NPCs only) ----
window.ncAdjustLegendaryResistance = function(delta) {
    let c = ncActiveCompanion();
    if (delta < 0 && c.legendaryResistances <= 0) return;
    ncSpend(delta * 4, () => { c.legendaryResistances += delta; });
};
window.ncAdjustLegendaryAp = function(delta) {
    let c = ncActiveCompanion();
    if (delta < 0 && c.legendaryApPool <= 0) return;
    let cost = delta > 0 ? 5 : -5;
    ncSpend(cost, () => {
        c.legendaryApPool = Math.max(0, c.legendaryApPool + delta * 3);
        if (c.legendaryApPool === 0) c.lairActions = false; // prereq no longer met
    });
};
window.ncToggleLairActions = function(checked) {
    let c = ncActiveCompanion();
    if (checked && c.legendaryApPool <= 0) {
        window.showConfirm("Lair Actions require at least one rank of Legendary Actions (Legendary AP) first.", null, true);
        ncRenderStep8();
        return;
    }
    ncSpend(checked ? 10 : -10, () => { c.lairActions = checked; });
};
window.ncToggleMythicAwakening = function(checked) {
    let c = ncActiveCompanion();
    ncSpend(checked ? 20 : -20, () => { c.mythicAwakening = checked; });
};
window.ncSetLairActionsText = function(val) {
    ncActiveCompanion().lairActionsText = val;
};
window.ncSetMythicAwakeningText = function(val) {
    ncActiveCompanion().mythicAwakeningText = val;
};

function ncRenderStep8() {
    let c = ncActiveCompanion();
    document.getElementById('ncLegendaryBody').innerHTML = `
        <div class="bg-slate-900 border border-slate-700 rounded p-2">
            <div class="flex justify-between items-center">
                <div>
                    <div class="text-xs font-bold text-slate-200">Legendary Resistance <span class="text-yellow-500">[4 TP/rank]</span></div>
                    <div class="text-[10px] text-slate-500 leading-tight">Automatically succeeds on a failed save, a limited number of times per day equal to its ranks.</div>
                </div>
                <div class="flex items-center gap-2 shrink-0 ml-2">
                    <button onclick="window.ncAdjustLegendaryResistance(-1)" class="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-white font-bold">-</button>
                    <span class="w-6 text-center font-black text-white">${c.legendaryResistances}</span>
                    <button onclick="window.ncAdjustLegendaryResistance(1)" class="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-white font-bold">+</button>
                </div>
            </div>
        </div>
        <div class="bg-slate-900 border border-slate-700 rounded p-2">
            <div class="flex justify-between items-center">
                <div>
                    <div class="text-xs font-bold text-slate-200">Legendary Actions (Legendary AP) <span class="text-yellow-500">[5 TP per +3 AP]</span></div>
                    <div class="text-[10px] text-slate-500 leading-tight">A pool of bonus AP this NPC can spend to act during other creatures' turns.</div>
                </div>
                <div class="flex items-center gap-2 shrink-0 ml-2">
                    <button onclick="window.ncAdjustLegendaryAp(-1)" class="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-white font-bold">-</button>
                    <span class="w-6 text-center font-black text-white">${c.legendaryApPool}</span>
                    <button onclick="window.ncAdjustLegendaryAp(1)" class="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-white font-bold">+</button>
                </div>
            </div>
        </div>
        <div class="bg-slate-900 border border-slate-700 rounded p-2">
            <label class="flex items-start gap-2 cursor-pointer ${c.legendaryApPool <= 0 ? 'opacity-50' : ''}">
                <input type="checkbox" class="mt-1" ${c.lairActions ? 'checked' : ''} onchange="window.ncToggleLairActions(this.checked)">
                <div>
                    <div class="text-xs font-bold text-slate-200">Lair Actions <span class="text-yellow-500">[10 TP]</span></div>
                    <div class="text-[10px] text-slate-500 leading-tight">Requires at least one rank of Legendary Actions (Legendary AP).</div>
                </div>
            </label>
            <div class="text-[10px] text-slate-400 bg-slate-800/60 border border-slate-700 rounded p-1.5 mt-2 leading-snug">
                <span class="font-bold text-slate-300">Quick reference:</span> On initiative count 20 (losing ties), the lair itself can take one effect from a
                list you define -- a hazard, terrain shift, or environmental attack. The same effect usually can't be used
                two rounds in a row. This is a general summary to work from, not a verbatim rule -- check your book for
                exact wording.
            </div>
            <div class="mt-2">
                <label class="block text-[9px] text-slate-500 uppercase tracking-wider mb-1">Describe what the lair does</label>
                <textarea id="ncLairActionsText" onchange="window.ncSetLairActionsText(this.value)" rows="3" placeholder="e.g. Cracks spread across the floor, dealing 2d6 damage to all creatures standing over them..." class="w-full bg-slate-800 border-slate-600 text-xs text-slate-200">${c.lairActionsText || ''}</textarea>
            </div>
            <button onclick="window.openLairActionPowerCrafter()" class="mt-2 px-3 py-1.5 rounded bg-purple-700 hover:bg-purple-600 text-white text-[10px] font-bold">
                Build a Power for This Lair Action
            </button>
            <div class="text-[9px] text-slate-500 mt-1">Gives the effect real mechanics (AP cost, damage, range, etc.) alongside your description above -- it'll show up under Powers on the stat block.</div>
            <div class="mt-2 pt-2 border-t border-slate-700">
                <label class="block text-[9px] text-slate-500 uppercase tracking-wider mb-1">Shared Trait (broadcast to every enemy in the fight)</label>
                ${c.lairSharedTraitKey ? `
                    <div class="flex items-center justify-between bg-slate-800 border border-amber-700/50 rounded px-2 py-1">
                        <span class="text-[10px] text-amber-300 font-bold">${(NPC_TRAITS.find(t => t.key === c.lairSharedTraitKey) || {}).label || c.lairSharedTraitKey}</span>
                        <button onclick="window.ncClearLairSharedTrait()" class="text-[9px] text-red-400 hover:text-red-300 font-bold">Clear</button>
                    </div>
                ` : `
                    <button onclick="window.openLairSharedTraitPicker()" class="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold">Select Shared Trait...</button>
                `}
                <div class="text-[9px] text-slate-500 mt-1">Once this NPC joins the Initiative Tracker, this trait's name is added as a note on every enemy already in the fight -- and on any enemy added afterward, too.</div>
            </div>
        </div>
        <div class="bg-slate-900 border border-slate-700 rounded p-2">
            <label class="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" class="mt-1" ${c.mythicAwakening ? 'checked' : ''} onchange="window.ncToggleMythicAwakening(this.checked)">
                <div>
                    <div class="text-xs font-bold text-slate-200">Mythic Awakening <span class="text-yellow-500">[20 TP]</span></div>
                    <div class="text-[10px] text-slate-500 leading-tight">A second, more dangerous phase once brought to 0 HP.</div>
                </div>
            </label>
            <div class="text-[10px] text-slate-400 bg-slate-800/60 border border-slate-700 rounded p-1.5 mt-2 leading-snug">
                <span class="font-bold text-slate-300">Quick reference:</span> Instead of dying or falling unconscious at 0 HP, the creature transforms --
                typically gaining a fresh pool of HP, new or upgraded actions, and often a change in its immunities or
                resistances, at the GM's discretion. This is a general summary to work from, not a verbatim rule -- check
                your book for exact wording.
            </div>
            <div class="mt-2">
                <label class="block text-[9px] text-slate-500 uppercase tracking-wider mb-1">Describe the awakened form</label>
                <textarea id="ncMythicAwakeningText" onchange="window.ncSetMythicAwakeningText(this.value)" rows="3" placeholder="e.g. At 0 HP, the dragon's wounds cauterize into molten scars. It gains 50 temp HP and its breath weapon recharges immediately..." class="w-full bg-slate-800 border-slate-600 text-xs text-slate-200">${c.mythicAwakeningText || ''}</textarea>
            </div>
        </div>
    `;
}

