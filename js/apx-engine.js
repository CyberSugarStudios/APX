// ============================================================
// APX Character Sheet — Derived Stat Engine
// ============================================================
        window.recalculateMath = function() {
            window.syncDOM();
            
            if (!window.state.pwrIntRanks) {
                window.state.pwrIntRanks = {1:0, 2:0, 3:0, 4:0, 5:0};
                let existingRank = window.state.perks['pwr_int'] || 0;
                for(let i=1; i<=existingRank; i++) {
                    window.state.pwrIntRanks[i] = 1;
                }
            }

            // Migrate armor saved before the Armor Forge existed (or hand-edited
            // in the plain AC/DR/ER fields): give it an empty mod/cost history
            // rather than crashing. Its flat ac/dr/er/wt values are left as-is.
            if (!window.state.equippedArmor.mods) {
                window.state.equippedArmor.mods = { acBonus: 0, drBonus: 0, erBonus: 0, wtReduction: 0, wtIncrease: 0, stealthBonus: 0, athleticsBonus: 0, stealthPenalty: 0, athleticsPenalty: 0, speedPenalty: 0 };
                window.state.equippedArmor.paidCost = 0;
                window.state.equippedArmor.stealthMod = window.state.equippedArmor.stealthMod || 0;
                window.state.equippedArmor.athleticsMod = window.state.equippedArmor.athleticsMod || 0;
                window.state.equippedArmor.speedMod = window.state.equippedArmor.speedMod || 0;
            }
            if (!window.state.equippedArmor.craftBatches) window.state.equippedArmor.craftBatches = {};
            if (!window.state.craftSkillPref) window.state.craftSkillPref = "INT";
            if (window.state.freePowersOwed === undefined) window.state.freePowersOwed = 0;
            if (window.state.ancestry.bonusPerkChoice === undefined) window.state.ancestry.bonusPerkChoice = null;
            if (!window.state.conditions) window.state.conditions = [];
            if (!window.state.woundedLimbs) window.state.woundedLimbs = [];
            if (!window.state.savesTrained) window.state.savesTrained = { STR: false, AGI: false, CON: false, PER: false, INT: false, CHA: false, LUC: false };
            if (!window.state.trainedWeaponTypes) window.state.trainedWeaponTypes = [];
            if (!window.state.ancestrySkillAptitudeSkills) window.state.ancestrySkillAptitudeSkills = [];
            if (!window.state.ancestryFinalTraining) window.state.ancestryFinalTraining = { skills: [], saves: [] };
            if (!window.state.chaFreePowerLevels) window.state.chaFreePowerLevels = [];
            if (!window.state.chaFreeUpgrades) window.state.chaFreeUpgrades = [];
            if (!window.state.skillSource) window.state.skillSource = {};
            if (!window.state.ancestryEnvResistances) window.state.ancestryEnvResistances = [];
            if (!window.state.ancestryEnvVulnerabilities) window.state.ancestryEnvVulnerabilities = [];
            if (!window.state.ancestryInnateWeapons) window.state.ancestryInnateWeapons = [];
            if (!window.state.ancestryInnateWeaponLog) window.state.ancestryInnateWeaponLog = [];
            // Any pre-existing single "Ancestry: Innate Weapon" entry
            // from before this system tracked multiple named weapons
            // gets folded into the new arrays so it isn't orphaned --
            // treated as one already-purchased "new" weapon named "Claws".
            {
                let legacyInnate = window.state.weapons.find(w => w.isAncestry && w.ancestryInnateIdx === undefined);
                if (legacyInnate && window.state.ancestryInnateWeapons.length === 0) {
                    legacyInnate.name = legacyInnate.name === 'Ancestry: Innate Weapon' ? 'Claws' : legacyInnate.name;
                    legacyInnate.ancestryInnateIdx = 0;
                    window.state.ancestryInnateWeapons.push({ name: legacyInnate.name, dmg: legacyInnate.dmg });
                    window.state.ancestryInnateWeaponLog.push({ action: 'new', idx: 0 });
                }
            }
            if (!window.state.equippedShield) window.state.equippedShield = { equipped: false, name: "Shield", ac: 2, dr: 2, er: 2, wt: 6, cost: 50 };
            if (!window.state.equippedHelmet) window.state.equippedHelmet = { equipped: false, broken: false, name: "Helmet", ac: 1, dr: 1, er: 1, wt: 3, cost: 30 };
            // Characters saved under an earlier (incorrect) Shield/Helmet
            // stat line predate DR/ER on these items -- correct the
            // numbers in place without touching whether the player
            // actually has one equipped.
            if (window.state.equippedShield.dr === undefined) Object.assign(window.state.equippedShield, { ac: 2, dr: 2, er: 2, wt: 6, cost: 50 });
            if (window.state.equippedHelmet.dr === undefined) Object.assign(window.state.equippedHelmet, { ac: 1, dr: 1, er: 1, wt: 3, cost: 30 });
            // Existing saved weapons predate the isCustom flag -- any
            // weapon that isn't the innate Unarmed Strike, an Ancestry
            // innate weapon, or forged must have been added via the plain
            // + Weapon button, so it should stay damage-editable rather
            // than retroactively locking a player's own custom weapons.
            (window.state.weapons || []).forEach(w => {
                if (w.isCustom === undefined && !w.isUnarmed && !w.isAncestry && !w.forged) w.isCustom = true;
            });
            // Origin Competencies used to be 4 free-text strings; the new
            // structured picker needs {type, value, skillId, customValue}
            // objects instead. There's no reliable way to infer type/skillId
            // from old free text, so old competency choices are reset --
            // the player just re-picks them once, same idea as any other
            // one-time structural migration in this app.
            if (!window.state.origin.commonLanguage && window.state.origin.commonLanguage !== '') window.state.origin.commonLanguage = '';
            if (!Array.isArray(window.state.origin.comps) || typeof window.state.origin.comps[0] === 'string') {
                window.state.origin.comps = [
                    { type: null, value: '', skillId: null, customValue: '' },
                    { type: null, value: '', skillId: null, customValue: '' },
                    { type: null, value: '', skillId: null, customValue: '' },
                    { type: null, value: '', skillId: null, customValue: '' }
                ];
            }
            if (window.state.companion) {
                if (!window.state.companion.weapons) window.state.companion.weapons = [];
                if (!window.state.companion.equippedArmor) {
                    window.state.companion.equippedArmor = {
                        name: "", wt: 0, ac: 0, dr: 0, er: 0,
                        stealthMod: 0, athleticsMod: 0, speedMod: 0,
                        mods: { acBonus: 0, drBonus: 0, erBonus: 0, wtReduction: 0, wtIncrease: 0, stealthBonus: 0, athleticsBonus: 0, stealthPenalty: 0, athleticsPenalty: 0, speedPenalty: 0 },
                        craftBatches: {}, paidCost: 0
                    };
                }
                if (!window.state.companion.otherTrainings) window.state.companion.otherTrainings = [];
            }
            if (!window.state.ancestryBonusPerks) {
                // Migrate the old single-slot Bonus Perk into the new
                // multi-purchase array (Bonus Perk can be taken twice).
                window.state.ancestryBonusPerks = window.state.ancestry.bonusPerk
                    ? [{ perkId: window.state.ancestry.bonusPerk, choice: window.state.ancestry.bonusPerkChoice }]
                    : [];
            }

            if (window.state.craftingMatWeightEnabled === undefined) window.state.craftingMatWeightEnabled = true;
            // Crafting Materials live as locked rows at the bottom of the
            // inventory again. Migrate any values from the brief interlude
            // where they lived in a dedicated craftingMaterials object.
            const requiredMaterials = [
                { name: "Common Crafting Materials", wt: CRAFTING_MATERIAL_INFO.common.wt, val: CRAFTING_MATERIAL_INFO.common.val, legacyKey: "common" },
                { name: "Uncommon Crafting Materials", wt: CRAFTING_MATERIAL_INFO.uncommon.wt, val: CRAFTING_MATERIAL_INFO.uncommon.val, legacyKey: "uncommon" },
                { name: "Rare Crafting Materials", wt: CRAFTING_MATERIAL_INFO.rare.wt, val: CRAFTING_MATERIAL_INFO.rare.val, legacyKey: "rare" }
            ];
            requiredMaterials.forEach(rm => {
                if (!window.state.items.some(i => i.name === rm.name && i.isLocked)) {
                    let legacyCt = (window.state.craftingMaterials && window.state.craftingMaterials[rm.legacyKey]) || 0;
                    window.state.items.push({ name: rm.name, wt: rm.wt, ct: legacyCt, val: rm.val, isLocked: true });
                }
            });
            delete window.state.craftingMaterials;
            window.state.items.sort((a, b) => {
                if (a.isLocked && !b.isLocked) return 1;
                if (!a.isLocked && b.isLocked) return -1;
                return 0;
            });

            calc = {
                scores: {}, mods: {}, skills: {},
                ac: 10, dr: 0, er: 0, speed: (window.state.ancestry.speed || 3),
                maxRestDice: 5, restDieStep: "d6", carryCap: 150, maxAp: 6, init: 10,
                sizeMultBoost: 0, wtBoost: 0, lucAc: false, useIntInit: false,
                bonusMeleeAtk: 0, bonusMeleeDmg: 0, bonusRangedAtk: 0, bonusRangedDmg: 0,
                hasArmorDisadvantage: false, maxHpPenalty: 0,
                speedForcedZero: false, apForcedZero: false,
                disadv: {
                    atkGeneral: [], atkMelee: [], atkRangedAdv: [],
                    saveByAttr: { STR: [], AGI: [], CON: [], PER: [], INT: [], CHA: [], LUC: [] },
                    checkByAttr: { STR: [], AGI: [], CON: [], PER: [], INT: [], CHA: [], LUC: [] },
                    autoFailSaveByAttr: { STR: [], AGI: [], CON: [], PER: [], INT: [], CHA: [], LUC: [] }
                }
            };

            // Folds one condition/wound's effect definition into calc.disadv.
            function applyEffectSource(label, def) {
                if (!def) return;
                if (def.atkDisadvantage === 'general') calc.disadv.atkGeneral.push(label);
                if (def.atkDisadvantage === 'melee') calc.disadv.atkMelee.push(label);
                if (def.rangedAtkAdvantage) calc.disadv.atkRangedAdv.push(label);
                if (def.saveDisadvantage === 'all') ATTRIBUTES.forEach(a => calc.disadv.saveByAttr[a].push(label));
                else if (Array.isArray(def.saveDisadvantage)) def.saveDisadvantage.forEach(a => calc.disadv.saveByAttr[a] && calc.disadv.saveByAttr[a].push(label));
                if (def.checkDisadvantage === 'all') ATTRIBUTES.forEach(a => calc.disadv.checkByAttr[a].push(label));
                else if (Array.isArray(def.checkDisadvantage)) def.checkDisadvantage.forEach(a => calc.disadv.checkByAttr[a] && calc.disadv.checkByAttr[a].push(label));
                if (Array.isArray(def.autoFailSaves)) def.autoFailSaves.forEach(a => calc.disadv.autoFailSaveByAttr[a] && calc.disadv.autoFailSaveByAttr[a].push(label));
                if (def.speedZero) calc.speedForcedZero = true;
                if (def.apZero) calc.apForcedZero = true;
            }

            if(window.state.ancestry.traits.includes('t_sens')) calc.skills['Notice'] = (calc.skills['Notice']||0) + 5;
            let tArmCount = window.state.ancestry.traits.filter(x => x === 't_arm').length;
            if(tArmCount) calc.ac += tArmCount;
            if(window.state.ancestry.traits.includes('t_load')) calc.sizeMultBoost += 1;
            let fragCount = window.state.ancestry.flaws.filter(x => x === 'f_frag').length;
            if(fragCount) calc.maxHpPenalty += 5 * fragCount;

            ATTRIBUTES.forEach(a => {
                calc.scores[a] = window.state.baseStats[a] + (window.state.ancestry.bonuses[a] || 0);
            });

            // Custom equippable items (rings, circlets, etc. from the Add
            // Item popup) can boost -- or, for a cursed item, penalize --
            // an attribute. This adjusts the SCORE itself, not the
            // modifier directly, so the two stay mathematically linked
            // (mod = score - 5) everywhere they're both displayed --
            // applying it only to calc.mods left the Attribute Score
            // shown on the sheet out of sync with its own modifier.
            // attrBonuses is the current array format; attrTarget/
            // attrBonus is kept working for items saved before this
            // became a list.
            (window.state.items || []).forEach(item => {
                if (!(item.isCustomEquippable && item.equipped && item.bonuses)) return;
                let b = item.bonuses;
                (b.attrBonuses || []).forEach(row => {
                    if (calc.scores[row.target] !== undefined) calc.scores[row.target] += (row.amount || 0);
                });
                if (b.attrTarget && calc.scores[b.attrTarget] !== undefined) {
                    calc.scores[b.attrTarget] += (b.attrBonus || 0);
                }
            });

            Object.keys(window.state.perks).forEach(perkId => {
                let pDef = PERKS_DB.find(p => p.id === perkId);
                let rank = window.state.perks[perkId];
                let choices = window.state.perkChoices[perkId] || null;
                if(pDef && pDef.effect) pDef.effect(calc, rank, choices);
            });

            (window.state.ancestryBonusPerks || []).forEach(bp => {
                let bpDef = PERKS_DB.find(p => p.id === bp.perkId);
                if(bpDef && bpDef.effect) {
                    let choices = bp.choice ? { 1: bp.choice } : null;
                    bpDef.effect(calc, 1, choices);
                }
            });

            ATTRIBUTES.forEach(a => {
                calc.mods[a] = calc.scores[a] - 5;
            });

            calc.maxRestDice = calc.scores.CON + (calc.maxRestDice - 5); 

            let vitalHpRank = window.state.perks['con_vitality'] || 0;
            let maxHp = (calc.scores.CON * 5) + (vitalHpRank * 5) + window.state.xpHpBought - calc.maxHpPenalty;
            maxHp = Math.max(5, maxHp);
            // Whenever Max HP changes -- up from leveling CON, buying
            // Vitality, XP-bought HP, or down from a Fragile-type flaw,
            // penalty, etc. -- Current HP shifts by the same delta rather
            // than staying put, symmetric in both directions. Tracked
            // against the last computed value so this only fires on a
            // genuine change, not every re-render.
            if (window.state.lastKnownMaxHp !== undefined && maxHp !== window.state.lastKnownMaxHp) {
                window.state.currentHp = (window.state.currentHp || 0) + (maxHp - window.state.lastKnownMaxHp);
                let curHpEl = document.getElementById('currentHpInput');
                if (curHpEl) curHpEl.value = window.state.currentHp;
            }
            window.state.lastKnownMaxHp = maxHp;
            document.getElementById('dispMaxHp').innerText = maxHp;

            let sizeMult = (parseInt(window.state.ancestry.size) || 30);
            if (calc.sizeMultBoost > 0) sizeMult *= 2; 
            calc.carryCap = calc.scores.STR * sizeMult + (calc.carryCap - 150);

            let armorWt = window.state.equippedArmor.wt;
            let armorAc = window.state.equippedArmor.ac;
            let armorDr = window.state.equippedArmor.dr;
            let armorEr = window.state.equippedArmor.er;

            // Shield/Helmet: simple fixed-stat equipment, not run through
            // the Armor Forge's craftBatches system -- their AC/weight
            // just add directly alongside worn armor's.
            if (window.state.equippedShield.equipped) {
                armorAc += window.state.equippedShield.ac;
                armorDr += window.state.equippedShield.dr;
                armorEr += window.state.equippedShield.er;
                armorWt += window.state.equippedShield.wt;
            }
            if (window.state.equippedHelmet.equipped && !window.state.equippedHelmet.broken) {
                armorAc += window.state.equippedHelmet.ac;
                armorDr += window.state.equippedHelmet.dr;
                armorEr += window.state.equippedHelmet.er;
                armorWt += window.state.equippedHelmet.wt;
            }
            // Override syncDOM's earlier armorWt display (which only knew
            // about the armor piece itself) with the combined total,
            // including Shield/Helmet, now that it's fully computed -- so
            // players can see their actual worn weight at a glance without
            // doing the addition themselves.
            {
                let armorWtEl = document.getElementById('armorWt');
                if (armorWtEl) armorWtEl.innerText = armorWt;
            }

            // Custom equippable items' AC/DR/Speed/Skill/Energy Resistance
            // bonuses. Skill and Energy Resistance can each come from
            // multiple items (or multiple bonuses on one item) via the
            // skillBonuses/erBonuses arrays; ac/dr/speedBonus stay flat
            // single values per item. Legacy skillTarget/skillBonus/er
            // (pre-array format) still applies too.
            calc.customItemErBonuses = [];
            (window.state.items || []).forEach(item => {
                if (item.isCustomEquippable && item.equipped && item.bonuses) {
                    let b = item.bonuses;
                    armorAc += (b.ac || 0);
                    armorDr += (b.dr || 0);
                    armorEr += (b.er || 0); // legacy flat ER field
                    if (b.speedBonus) calc.speed += b.speedBonus;
                    (b.skillBonuses || []).forEach(row => {
                        if (row.target && row.amount) calc.skills[row.target] = (calc.skills[row.target] || 0) + row.amount;
                    });
                    if (b.skillTarget && b.skillBonus) calc.skills[b.skillTarget] = (calc.skills[b.skillTarget] || 0) + b.skillBonus;
                    (b.erBonuses || []).forEach(row => {
                        if (row.target && row.amount) calc.customItemErBonuses.push({ type: row.target, amount: row.amount, source: item.name });
                    });
                }
            });

            // Armor Forge mods (Stealth/Athletics checks, worn Speed penalty)
            if (window.state.equippedArmor.stealthMod) calc.skills.Stealth = (calc.skills.Stealth || 0) + window.state.equippedArmor.stealthMod;
            if (window.state.equippedArmor.athleticsMod) calc.skills.Athletics = (calc.skills.Athletics || 0) + window.state.equippedArmor.athleticsMod;
            if (window.state.equippedArmor.speedMod) calc.speed += window.state.equippedArmor.speedMod;

            let reqStr = Math.floor(armorWt / 10);
            let meetsStr = calc.scores.STR >= reqStr;
            calc.hasArmorDisadvantage = (!meetsStr && armorWt > 0);
            
            let warnEl = document.getElementById('armorWarning');
            warnEl.style.display = calc.hasArmorDisadvantage ? 'block' : 'none';

            // Active Conditions + Wounded limbs -> Disadvantage/Advantage/
            // Speed 0/AP 0, scoped precisely per the rulebook (e.g. Prone
            // is melee Disadvantage + ranged Advantage, not a blanket
            // penalty; Head Wound only affects PER/INT checks).
            if (calc.hasArmorDisadvantage) applyEffectSource('Armor (STR requirement not met)', { atkDisadvantage: 'general' });
            (window.state.conditions || []).forEach(cId => {
                let cDef = CONDITIONS.find(c => c.id === cId);
                if (cDef) applyEffectSource(cDef.name, cDef);
            });

            let legWoundCount = 0;
            (window.state.woundedLimbs || []).forEach(limb => {
                let limbType = limb.includes('Leg') ? 'Leg' : limb.includes('Arm') ? 'Arm' : limb;
                if (limbType === 'Leg') legWoundCount++;
                let limbDef = WOUND_LIMB_EFFECTS[limbType];
                if (limbDef) applyEffectSource(`${limb} Wound`, limbDef);
            });
            if (legWoundCount >= 2) {
                applyEffectSource('Both Legs Wounded (Prone)', { atkDisadvantage: 'melee', rangedAtkAdvantage: true });
            }

            calc.hasDisadvantage = calc.disadv.atkGeneral.length > 0; // back-compat alias for any simple check
            calc.disadvantageSources = calc.disadv.atkGeneral;

            // Armor weight class, derived from total armor weight (no
            // separate tracked field needed): Heavy > 70 lbs, Moderate
            // 31-70 lbs, Light 1-30 lbs, none if unarmored.
            let armorClass = armorWt === 0 ? null : (armorWt > 70 ? 'Heavily' : (armorWt > 30 ? 'Moderately' : 'Lightly'));
            let isHeavy = armorClass === 'Heavily';

            let agiCap = Infinity;
            if (isHeavy) agiCap = 0; 
            else if (armorClass === 'Moderately') agiCap = 2; 

            // Armor Master's choice is made once, at Rank 2, and every
            // higher-rank bonus below checks it against the CURRENTLY
            // worn armor's class -- so switching to different-weight
            // armor correctly turns these bonuses on and off.
            let amRank = window.state.perks["str_armormaster"] || 0;
            let amChoice = window.state.perkChoices['str_armormaster'] ? window.state.perkChoices['str_armormaster'][2] : null;
            let amMatchesChoice = amChoice && armorClass === amChoice;

            if (amRank >= 4 && amChoice === 'Moderately' && armorClass === 'Moderately') agiCap += 1;

            if (!meetsStr) { agiCap = 0; calc.speed -= 2; }

            let allowedAgi;
            if (isHeavy) {
                allowedAgi = 0; // Heavy Armor: AGI modifier never applies to AC, positive or negative
            } else if (calc.mods.AGI < 0) {
                allowedAgi = calc.mods.AGI; // negative AGI is never capped outside Heavy Armor
            } else {
                allowedAgi = Math.min(calc.mods.AGI, agiCap);
            }

            if (amRank >= 2 && amMatchesChoice) {
                calc.ac += 1;
                calc.dr += 1;
            }
            if (amRank >= 3 && armorClass !== null) {
                calc.speed += 1;
            }
            if (amRank >= 5 && amMatchesChoice && amChoice === 'Heavily') {
                calc.dr += 3;
            }

            if (armorWt === 0 && window.state.perks["con_defensive"]) {
                calc.ac += calc.mods.CON; 
                calc.ac += window.state.perks["con_defensive"];
                calc.dr += window.state.perks["con_defensive"];
                calc.er += window.state.perks["con_defensive"];
            }
            if (calc.lucAc) calc.ac += Math.max(1, calc.mods.LUC);

            calc.ac += allowedAgi + armorAc;
            document.getElementById('dispAc').innerText = calc.ac;
            // Update AC label tooltip to reflect Defensive perk formula
            {
                let acLabel = document.querySelector('[data-tip*="Total AC"], div[data-tip*="10 + AGI"]');
                if (!acLabel) acLabel = document.querySelector('div[data-tip*="AGI modifier"]');
                if (acLabel) {
                    let defRank = window.state.perks['con_defensive'] || 0;
                    if (defRank >= 1 && armorWt === 0) {
                        acLabel.setAttribute('data-tip', `Unarmored with Defensive perk: 10 + AGI mod + CON mod. Equipping any armor or shield removes the CON bonus and reverts to the standard formula.`);
                    } else {
                        acLabel.setAttribute('data-tip', `10 + AGI modifier (or LUC if higher, with Lucky) + equipped Armor + Shield + other bonuses`);
                    }
                }
            }
            document.getElementById('dispAcCalc').innerText = `10+${allowedAgi}(AGI)+${armorAc}`;
            {
                let s = window.state.equippedShield, h = window.state.equippedHelmet;
                let shieldStatusEl = document.getElementById('shieldStatus');
                let shieldBtn = document.getElementById('shieldActionBtn');
                if (shieldStatusEl) {
                    shieldStatusEl.innerText = s.equipped ? `Equipped (+${s.ac} AC/DR/ER)` : 'Not Equipped';
                    shieldBtn.innerText = s.equipped ? 'Remove Shield' : 'Equip Shield';
                }
                let helmetStatusEl = document.getElementById('helmetStatus');
                let helmetBtn = document.getElementById('helmetActionBtn');
                let helmetBreakBtn = document.getElementById('helmetBreakBtn');
                if (helmetStatusEl) {
                    if (h.broken) helmetStatusEl.innerText = 'Broken (needs repair)';
                    else helmetStatusEl.innerText = h.equipped ? `Equipped (+${h.ac} AC/DR/ER)` : 'Not Equipped';
                    helmetBtn.innerText = h.equipped ? 'Remove Helmet' : (h.broken ? 'Repair & Equip' : 'Equip Helmet');
                    helmetBreakBtn.classList.toggle('hidden', !h.equipped);
                }
            }

            calc.dr += Math.max(0, calc.mods.CON) + armorDr;
            let baseErMods = [calc.mods.AGI, calc.mods.PER, calc.mods.INT, calc.mods.CHA, calc.mods.LUC].map(v => Math.max(v, 0));
            calc.er += Math.max(...baseErMods) + armorEr;

            document.getElementById('dispDr').innerText = calc.dr;
            document.getElementById('dispEr').innerText = calc.er;
            {
                let envEl = document.getElementById('dispEnvResistances');
                if (envEl) {
                    // A genuine per-energy-type NET, not three separate,
                    // uncoordinated lists -- Resistance, Vulnerability, and
                    // item bonuses were previously displayed independently,
                    // which both duplicated the source item's name once per
                    // energy type it granted, and showed "+5" for a
                    // resistance right next to "+5" for a vulnerability
                    // despite meaning opposite things. Everything for a
                    // given type (ancestry resistance/vulnerability, every
                    // equipped item's bonus) now nets into one number
                    // before anything renders.
                    let byType = {};
                    function ensureType(t) {
                        if (!byType[t]) byType[t] = { net: 0, immune: false, sources: [] };
                        return byType[t];
                    }
                    (window.state.ancestryEnvResistances || []).forEach(e => {
                        if (!e.type) return;
                        let t = ensureType(e.type);
                        if (e.immune) t.immune = true; else t.net += 5;
                    });
                    (window.state.ancestryEnvVulnerabilities || []).forEach(e => {
                        if (!e.type) return;
                        ensureType(e.type).net -= 5;
                    });
                    (calc.customItemErBonuses || []).forEach(b => {
                        let t = ensureType(b.type);
                        t.net += b.amount;
                        if (!t.sources.includes(b.source)) t.sources.push(b.source);
                    });
                    let lines = Object.keys(byType).map(type => {
                        let t = byType[type];
                        let sourceNote = t.sources.length ? ` <span class="text-slate-500">(${t.sources.join(', ')})</span>` : '';
                        // An ancestry-granted Immunity isn't undone by a
                        // single Vulnerability flaw on the same type --
                        // thematically odd combination to begin with, and
                        // treating them as netting against each other numerically
                        // would need an arbitrary equivalence for "how much
                        // resistance is Immunity actually worth", so Immune
                        // simply wins display priority when both are present.
                        if (t.immune) return `<span class="text-emerald-400 font-bold">${type}: Immune</span>${sourceNote}`;
                        if (t.net > 0) return `<span class="text-cyan-300">${type}: ER +${t.net}</span>${sourceNote}`;
                        if (t.net < 0) return `<span class="skill-mod-negative font-bold">${type}: Vulnerable (+${-t.net} dmg taken)</span>${sourceNote}`;
                        return null; // net exactly 0 -- resistance and vulnerability fully cancel, nothing to show
                    }).filter(Boolean);
                    envEl.innerHTML = lines.length ? 'Energy Resistances: ' + lines.join(', ') : '';
                }
            }

            let tirelessRank = window.state.perks['gen_tireless'] || 0;
            let effectiveFatigue = Math.max(0, window.state.fatigue - tirelessRank);
            calc.effectiveFatigue = effectiveFatigue;
            calc.maxAp = calc.apForcedZero ? 0 : Math.max(6, 6 + calc.mods.AGI) - effectiveFatigue;
            
            window.syncInitStatCheckboxes(); // may revert state.initStat if its perk was removed, so this runs before calc.init uses it
            calc.init = 10 + (calc.mods[window.state.initStat] || 0) + (calc.init - 10); 

            document.getElementById('dispGlobalTb').innerText = window.state.trainingBonus;
            document.getElementById('dispAp').innerText = calc.maxAp;
            document.getElementById('dispInit').innerText = calc.init;
            document.getElementById('dispSpeed').innerText = calc.speedForcedZero ? 0 : Math.max(0, calc.speed);
            document.getElementById('dispMaxRest').innerText = calc.maxRestDice;
            document.getElementById('dispRestDieStep').innerText = calc.restDieStep;
            // Same idea as Max HP: whenever Max Rest Dice changes (CON
            // shifting, etc.), Current Rest Dice shifts by the same
            // delta rather than staying put, in both directions.
            if (window.state.lastKnownMaxRestDice !== undefined && calc.maxRestDice !== window.state.lastKnownMaxRestDice) {
                window.state.restDice = (window.state.restDice || 0) + (calc.maxRestDice - window.state.lastKnownMaxRestDice);
                let curRestEl = document.getElementById('currentRestDice');
                if (curRestEl) curRestEl.value = window.state.restDice;
            }
            window.state.lastKnownMaxRestDice = calc.maxRestDice;
            document.getElementById('dispWt').innerText = (calc.scores.CON * 2) + calc.wtBoost;
            document.getElementById('dispMaxLuck').innerText = Math.max(1, calc.mods.LUC);

            renderAttributesAndSkills();
            renderWeapons();
            renderInventory(armorWt);
            if (typeof window.renderActiveConditions === 'function') window.renderActiveConditions();
            renderPowerStats();
            renderPowers();
            renderActivePerks();
        }

        function renderAttributesAndSkills() {
            let html = '';
            let allSkills = [...SKILLS, ...window.state.customSkills];

            ATTRIBUTES.forEach(attr => {
                let sc = calc.scores[attr];
                let mod = calc.mods[attr];
                let bgClass = mod > 0 ? 'bg-emerald-900/50 text-emerald-400 border-emerald-700/50' : (mod < 0 ? 'bg-red-900/50 text-red-400 border-red-700/50' : 'bg-slate-700 text-slate-200 border-transparent');
                let attrSkills = allSkills.filter(s => s.attr === attr);

                let saveTrained = !!(window.state.savesTrained && window.state.savesTrained[attr]);
                let saveBonus = mod + (saveTrained ? window.state.trainingBonus : 0);
                let saveDisadvSources = calc.disadv.saveByAttr[attr] || [];
                let saveAutoFailSources = calc.disadv.autoFailSaveByAttr[attr] || [];
                let saveBadges = '';
                if (saveAutoFailSources.length) saveBadges += `<span class="text-[8px] text-red-500 font-black ml-1" title="${saveAutoFailSources.join(', ')}">(Auto-Fail)</span>`;
                else if (saveDisadvSources.length) saveBadges += `<span class="text-[8px] text-red-400 ml-1" title="${saveDisadvSources.join(', ')}">(Disadv)</span>`;

                html += `
                    <div class="bg-slate-900/50 rounded-lg border border-slate-700/50 overflow-hidden">
                        <div class="flex items-center p-2 bg-slate-800 border-b border-slate-700/50">
                            <div class="text-lg font-black text-slate-200 w-12">${attr}</div>
                            <div class="w-10 text-center text-sm font-bold text-slate-400 mx-2 bg-slate-900 rounded p-1 border border-slate-700">${sc}</div>
                            <div class="flex-1 flex justify-end">
                                <div class="w-10 h-8 flex items-center justify-center font-black text-lg rounded shadow-inner border ${bgClass}">${mod >= 0 ? '+'+mod : mod}</div>
                            </div>
                        </div>
                        <div class="flex items-center justify-between px-2 py-1 bg-slate-800/60 border-b border-slate-700/50 text-[10px]">
                            <div class="flex items-center gap-1.5">
                                <div class="power-bubble static ${saveTrained ? 'filled' : ''}"></div>
                                <span class="text-slate-500 font-bold uppercase tracking-wide">Save</span>
                            </div>
                            <div class="font-bold ${saveTrained ? 'text-blue-400' : 'text-slate-500'}">${saveBonus >= 0 ? '+'+saveBonus : saveBonus}${saveBadges}</div>
                        </div>
                        <div class="divide-y divide-slate-800/50 p-1 relative">
                `;
                
                // Encyclopedia entries are custom, INT-attributed skills,
                // but they're always trained by definition (the only way
                // to get one is via the shared training picker) -- so
                // rather than a full row with a redundant always-checked
                // box and passive number, they render as a simple
                // sub-listing under Investigation, like a header.
                let encyclopediaSkills = attr === 'INT' ? attrSkills.filter(s => s.isCustom && s.name.startsWith('Encyclopedia')) : [];
                let normalAttrSkills = attr === 'INT' ? attrSkills.filter(s => !(s.isCustom && s.name.startsWith('Encyclopedia'))) : attrSkills;

                // Shared row template so Encyclopedia entries render exactly
                // like any other trained skill (checkbox, modifier, passive)
                // -- only the "ENCYCLOPEDIA" label above them is header-style,
                // not the entries themselves.
                function renderSkillRow(skill, indent) {
                    let isTr = window.state.skillsTrained[skill.id] || false;
                    let perkBonus = calc.skills[skill.id] || 0;
                    if(skill.name === 'Notice' && calc.skills['Notice']) perkBonus = calc.skills['Notice'];
                    // Scholar's "+1 to all Encyclopedia checks per rank" can't
                    // rely on calc.skills already having an entry for each
                    // player-named Encyclopedia specialty (History,
                    // Xenobiology, etc.) by the time this runs, so it's
                    // computed directly from the perk's rank here instead.
                    if (skill.name && skill.name.startsWith('Encyclopedia')) perkBonus += (window.state.perks['int_scholar'] || 0);
                    let total = mod + (isTr ? window.state.trainingBonus : 0) + perkBonus;

                    let pasText = "--";
                    if (skill.pass) {
                        if (skill.reqTr && !isTr) pasText = "--";
                        else pasText = 10 + total;
                    }

                    let checkDisadvSources = calc.disadv.checkByAttr[attr] || [];
                    let disadvHtml = checkDisadvSources.length ? `<span class="text-[8px] text-red-400 ml-1" title="${checkDisadvSources.join(', ')}">(Disadv)</span>` : '';
                    let displayName = skill.name.startsWith('Encyclopedia (') ? skill.name.replace('Encyclopedia (', '').replace(')', '') : skill.name;

                    return `
                        <div class="flex items-center justify-between text-[11px] py-1 px-2 hover:bg-slate-800/50 transition relative group">
                            ${skill.isCustom && !skill.name.startsWith('Encyclopedia') ? `<button onclick="window.deleteCustomSkill('${skill.id}')" class="absolute -left-1 text-red-500 hover:text-red-400 opacity-0 group-hover:opacity-100">&times;</button>` : ''}
                            <div class="flex items-center gap-2 flex-1 ${indent ? 'pl-5' : (skill.isCustom ? 'pl-3' : '')}">
                                <input type="checkbox" ${isTr ? 'checked' : ''} disabled title="Trained via Origin, Ancestry, or Spend XP -- not manually toggled here" class="w-3 h-3 cursor-not-allowed opacity-70">
                                <span class="${isTr ? 'text-blue-300 font-bold' : 'text-slate-300'}" ${isTr && window.state.skillSource[skill.id] ? `data-tip="Trained via: ${window.state.skillSource[skill.id]}"` : ''}>${displayName}</span>
                            </div>
                            <div class="w-auto text-center font-bold ${total < 0 ? 'skill-mod-negative' : (isTr ? 'text-blue-400' : 'text-slate-500')} text-xs">${total >= 0 ? '+'+total : total}${disadvHtml}</div>
                            <div class="w-10 text-right ${pasText === '--' ? 'text-slate-600' : 'text-slate-500 font-bold'}">${pasText}</div>
                        </div>
                    `;
                }

                normalAttrSkills.forEach(skill => {
                    html += renderSkillRow(skill, false);
                    if (skill.id === 'Investigation') {
                        // Always shown, even with zero entries -- like a
                        // header announcing this category exists and where
                        // to get it (the shared training picker), not
                        // something that only appears once you already
                        // have one.
                        html += `<div class="pl-5 pr-2 py-0.5 text-[10px] text-slate-500 font-bold uppercase tracking-wide">Encyclopedia</div>`;
                        html += encyclopediaSkills.map(es => renderSkillRow(es, true)).join('');
                    }
                });

                html += `</div></div>`;
            });
            document.getElementById('attrSkillContainer').innerHTML = html;
        }

        function renderInventory(armorWt) {
            let html = '';
            let totWt = 0;
            // Crafting materials are always-present, rarely-interacted-with
            // bulk resources -- pinning them to the bottom keeps armor,
            // weapons, and actual gear (including anything just unequipped)
            // together and easy to scan, rather than crafting materials
            // popping up wherever they happen to sit in the array.
            let sortedIndices = window.state.items.map((_, i) => i).sort((a, b) => {
                let aIsMats = window.state.items[a].name.endsWith('Crafting Materials');
                let bIsMats = window.state.items[b].name.endsWith('Crafting Materials');
                if (aIsMats === bIsMats) return a - b; // preserve original relative order otherwise
                return aIsMats ? 1 : -1;
            });
            sortedIndices.forEach(idx => {
                let item = window.state.items[idx];
                let rowWt = item.wt * item.ct;
                let countsTowardTotal = !item.isLocked || window.state.craftingMatWeightEnabled;
                if (countsTowardTotal) totWt += rowWt;

                let hasDetail = !!item.desc || item.isConsumable;
                let chargesControl = (item.isConsumable && item.charges > 1) ? `
                    <div class="flex items-center gap-1 mt-0.5">
                        <span class="text-[9px] text-purple-400 font-bold">Charges:</span>
                        <button onclick="window.adjustItemCharges(${idx}, -1)" ${item.chargesRemaining<=0?'disabled':''} class="w-4 h-4 rounded ${item.chargesRemaining<=0?'bg-slate-800 text-slate-600':'bg-slate-700 hover:bg-slate-600 text-white'} text-[10px] font-bold leading-none">-</button>
                        <span class="text-[9px] text-slate-300 font-bold w-8 text-center">${item.chargesRemaining}/${item.charges}</span>
                        <button onclick="window.adjustItemCharges(${idx}, 1)" ${item.chargesRemaining>=item.charges?'disabled':''} class="w-4 h-4 rounded ${item.chargesRemaining>=item.charges?'bg-slate-800 text-slate-600':'bg-amber-700 hover:bg-amber-600 text-white'} text-[10px] font-bold leading-none">+</button>
                    </div>
                ` : '';

                let delBtn = item.isLocked ? '' : `<button onclick="window.deleteItem(${idx})" class="text-red-500 font-bold hover:text-red-400">&times;</button>`;
                let equipBtn = item.isArmor ? `<button onclick="window.equipArmorFromInventory(${idx})" class="text-[9px] text-cyan-400 hover:text-cyan-300 font-bold mr-1" title="Equip this armor">Equip</button>` : '';
                if (item.isWeapon) {
                    equipBtn = `<button onclick="window.equipWeaponFromInventory(${idx})" class="text-[9px] text-cyan-400 hover:text-cyan-300 font-bold mr-1" title="Equip this weapon">Equip</button>`;
                }
                if (item.isShield) {
                    equipBtn = `<button onclick="window.toggleEquipShield()" class="text-[9px] text-cyan-400 hover:text-cyan-300 font-bold mr-1" title="Equip this shield">Equip</button>`;
                }
                if (item.isHelmet) {
                    equipBtn = `<button onclick="window.toggleEquipHelmet()" class="text-[9px] text-cyan-400 hover:text-cyan-300 font-bold mr-1" title="Equip this helmet">Equip</button>`;
                }
                if (item.isCustomEquippable) {
                    equipBtn = `<button onclick="window.toggleCustomItemEquip(${idx})" class="text-[9px] ${item.equipped ? 'text-emerald-400 hover:text-emerald-300' : 'text-cyan-400 hover:text-cyan-300'} font-bold mr-1" title="${item.equipped ? 'Currently equipped -- click to unequip' : 'Equip this item'}">${item.equipped ? 'Equipped' : 'Equip'}</button>`;
                }
                // Only Count stays inline-editable for every item; Name/
                // Wt/Value are now read-only in the main row and moved
                // into the magnifying-glass detail popup instead (which
                // itself still fully locks out isLocked items -- armor,
                // weapons, and anything forged that's currently sitting
                // unequipped in inventory -- so this doesn't reopen the
                // free-stat-edit exploit that isLocked exists to close).
                let nameHtml = `<div class="text-xs ${item.isLocked ? 'text-slate-400' : 'text-slate-200'} font-bold px-1 truncate" title="${item.name}">${item.name}${item.isLocked && !window.state.craftingMatWeightEnabled ? ' <span class="text-[9px] text-slate-600">(wt off)</span>' : ''}</div>`;
                let wtHtml = `<div class="text-xs text-slate-500">${item.wt}</div>`;
                let valHtml = `<div class="text-xs ${item.isLocked ? 'text-yellow-500/50' : 'text-yellow-400'}">${item.val}</div>`;

                html += `
                    <tr>
                        <td class="px-1 py-1">
                            ${nameHtml}
                            ${chargesControl}
                        </td>
                        <td class="px-1 py-1 text-center">${wtHtml}</td>
                        <td class="px-1 py-1">
                            <div class="flex items-center justify-center gap-0.5">
                                <button onclick="window.updateItemCt(${idx}, Math.max(0, (window.state.items[${idx}]?.ct||1)-1)); window.recalculateMath();" class="w-5 h-5 rounded bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold leading-none flex items-center justify-center">−</button>
                                <input type="number" value="${item.ct}" onchange="window.updateItemCt(${idx}, this.value)" class="bg-slate-800 border-slate-600 text-xs text-center font-bold text-white w-8 px-0">
                                <button onclick="window.updateItemCt(${idx}, (window.state.items[${idx}]?.ct||0)+1); window.recalculateMath();" class="w-5 h-5 rounded bg-amber-700 hover:bg-amber-600 text-white text-xs font-bold leading-none flex items-center justify-center">+</button>
                            </div>
                        </td>
                        <td class="px-1 py-1 text-center font-bold text-slate-300 text-xs">${rowWt.toFixed(1).replace(/\.0$/, '')}</td>
                        <td class="px-1 py-1 text-center">${valHtml}</td>
                        <td class="px-1 py-1 text-center">
                            ${equipBtn}
                            <button onclick="window.openItemDetail(${idx})" class="text-blue-400 hover:text-blue-300 font-bold mr-1" title="${item.isLocked ? 'View description' : 'View / edit details'}">&#128269;</button>
                            ${delBtn}
                        </td>
                    </tr>
                `;
            });
            document.getElementById('inventoryBody').innerHTML = html;

            totWt += armorWt;
            document.getElementById('dispTotalWeight').innerHTML = `${totWt.toFixed(1).replace(/\.0$/, '')} <span class="text-[10px] text-slate-500 font-normal">lbs</span>`;
            document.getElementById('dispCarryCap').innerHTML = `${calc.carryCap} <span class="text-[10px] text-slate-500 font-normal">lbs</span>`;

            let obWarn = document.getElementById('overburdenedWarning');
            if (totWt > calc.carryCap) {
                obWarn.style.display = 'block';
                document.getElementById('dispTotalWeight').classList.replace('text-white', 'text-red-500');
            } else {
                obWarn.style.display = 'none';
                document.getElementById('dispTotalWeight').classList.replace('text-red-500', 'text-white');
            }

            // Vertical Advantage and Flight both grant a special speed
            // equal to the character's own (fully modified) walking
            // speed, dynamically -- not a fixed number, so this has to
            // be computed here, after everything else that can affect
            // calc.speed (armor penalties, etc.) has already been
            // applied. Flight additionally doesn't work while
            // Encumbered or in Heavy Armor, per the trait's own wording.
            {
                let specialSpeedsEl = document.getElementById('dispSpecialSpeeds');
                if (specialSpeedsEl) {
                    let walkSpeed = calc.speedForcedZero ? 0 : Math.max(0, calc.speed);
                    let lines = [];
                    if (window.state.ancestry.traits.includes('t_vert')) {
                        lines.push(`Climb Speed: ${walkSpeed}`);
                    }
                    if (window.state.ancestry.traits.includes('t_fly')) {
                        let armorClassLocal = armorWt === 0 ? null : (armorWt > 70 ? 'Heavily' : (armorWt > 30 ? 'Moderately' : 'Lightly'));
                        let flyBlocked = armorClassLocal === 'Heavily' || totWt > calc.carryCap;
                        lines.push(flyBlocked ? 'Fly Speed: 0 (Encumbered/Heavy Armor)' : `Fly Speed: ${walkSpeed}`);
                    }
                    specialSpeedsEl.innerHTML = lines.join('<br>');
                }
            }
        }

        // A Thrown weapon's range isn't a fixed value from the range-tier
        // table -- it's derived live from the wielder's STR score (Ch.8:
        // "Effective Range is equal to your STR score, Long Range is
        // double that"), so it must recompute whenever STR changes rather
        // than being baked into the weapon at forge time.
        function effectiveWeaponRange(w) {
            if (w.range) return w.range; // genuine ranged weapon with a purchased range tier
            if (w.properties && w.properties.thrown) {
                let str = calc.scores.STR || 0;
                return `${str}/${str * 2}`;
            }
            return null;
        }

        function forgedWeaponBadge(w) {
            if (!w.forged) return '';
            let bits = [w.elemental || w.dmgType, `x${w.critMult}`];
            let rng = effectiveWeaponRange(w);
            if (rng) bits.push(rng + ' sq');
            let props = WEAPON_PROPERTIES.filter(p => w.properties && w.properties[p.key]).map(p => p.name);
            if (props.length) bits.push(props.join(', '));
            return `<div class="text-[9px] text-orange-400/80 leading-tight mt-0.5">${bits.join(' &middot; ')}</div>`;
        }

        // Manually-added weapons have no `category`/`weightClass` (only
        // Forge-crafted ones do) -- fall back to a reasonable guess from
        // the chosen attribute so old entries still work sensibly.
        // ------------------------------------------------------------------
        // Hand accounting: base 2 (one main, one off), +extraArms from any
        // ancestry trait that grants them (Polymelia today, any future
        // trait with the same field works automatically). Innate weapons
        // (Unarmed Strike, Claws/Fangs from Innate Weapon) don't occupy a
        // hand slot -- they're part of the body, not held. Light weapons
        // and one-handed Medium cost 1 hand; two-handed Medium and Heavy
        // (always two-handed) cost 2; a Shield costs 1.
        // ------------------------------------------------------------------
        window.calcTotalHands = function() {
            let extraArms = 0;
            (window.state.ancestry.traits || []).forEach(tId => {
                let tDef = ANCESTRY_TRAITS.find(t => t.id === tId);
                if (tDef && tDef.extraArms) extraArms = Math.max(extraArms, tDef.extraArms);
            });
            return 2 + extraArms;
        };
        function weaponHandCost(w) {
            if (w.isUnarmed || w.isAncestry) return 0;
            if (w.weightClass === 'heavy') return 2;
            if (w.weightClass === 'medium' && w.twoHanded) return 2;
            return 1;
        }
        // Hands used by everything EXCEPT the weapon at excludeIdx (pass
        // -1 or omit to count everything). Used both to check "is there a
        // free hand right now" and "would there be enough hands if THIS
        // weapon went two-handed" (which needs to discount its own
        // current 1-hand cost first).
        window.calcHandsUsed = function(excludeIdx) {
            let used = window.state.equippedShield.equipped ? 1 : 0;
            window.state.weapons.forEach((w, i) => {
                if (i === excludeIdx) return;
                used += weaponHandCost(w);
            });
            return used;
        };
        window.calcHandsFree = function(excludeIdx) {
            return window.calcTotalHands() - window.calcHandsUsed(excludeIdx);
        };

        function weaponCategory(w) {
            // Unarmed strikes are always melee regardless of which
            // attribute is chosen for them -- AGI is a legitimate choice
            // for an unarmed attack and must not be misread as "ranged"
            // by the fallback heuristic below (which exists only for old
            // manually-added weapons that predate an explicit category).
            if (w.isUnarmed) return 'melee';
            return w.category || (w.attr === 'AGI' ? 'ranged' : 'melee');
        }

        // A weapon counts as trained either because its own checkbox is
        // checked, or because its whole Weapon Type was trained via Spend
        // XP (Ch.6: training a Weapon Type trains every weapon of that
        // type, present and future -- not just one specific weapon).
        function weaponIsTrained(w) {
            // All creatures are inherently trained in their innate weapons
            // (Unarmed Strike, or the Innate Weapon trait's variant like
            // Claws/Fangs) -- not a toggleable state.
            if (w.isUnarmed || w.isAncestry) return true;
            return !!w.tr || window.state.trainedWeaponTypes.includes(companionWeaponTypeLabel(w));
        }

        function weaponAtkBonus(w, attrOverride) {
            let cat = weaponCategory(w);
            // Ch.9 Making Attacks: ranged attack rolls always use AGI --
            // there's no STR-or-AGI choice like melee gets, regardless of
            // weight class. Only melee's attribute is player-selectable.
            // Ranged: use the weapon's attr (AGI normally, or LUC if player chose it via FF)
            let attr = cat === 'ranged' ? (w.attr === 'LUC' ? 'LUC' : 'AGI') : (attrOverride || w.attr);
            let mod = calc.mods[attr] || 0;
            let trained = weaponIsTrained(w);
            // Fortunate Fighter Rank 3+ only applies if the player SELECTED LUC in the
            // ATT dropdown — it doesn't silently substitute regardless of selection.
            // (The dropdown already shows LUC as an option when FF rank >= 3 + untrained.)
            let pBonus = cat === 'melee' ? (calc.bonusMeleeAtk || 0) : (calc.bonusRangedAtk || 0);
            // Aim Action (PER): ranged only, toggled per-weapon since the
            // sheet doesn't simulate individual turns. Sharpshooter Rank 4
            // doubles this specific bonus.
            let aimBonus = 0;
            if (cat === 'ranged' && w.aimed) {
                aimBonus = calc.mods.PER || 0;
                if ((window.state.perks['per_sharpshooter'] || 0) >= 4) aimBonus *= 2;
                if (w.weightClass === 'medium' && w.twoHanded) aimBonus *= 2;
            }
            return mod + (trained ? window.state.trainingBonus : 0) + pBonus + aimBonus;
        }

        // Ch.9 Making Attacks (exact ranged rule, more specific than the
        // Weapon Weight chapter's general summary): ranged damage always
        // uses AGI, with no melee-style STR choice. Heavy ranged is the one
        // exception -- it ADDS STR on top of AGI, it doesn't replace it or
        // double it. Melee keeps its normal weight-class attribute rules.
        function weaponDmgModifier(w, attrOverride) {
            let cat = weaponCategory(w);
            // FF rank 3+ lets the player SELECT LUC as their attack attribute.
            // It does NOT automatically substitute LUC — the player must
            // choose LUC in the ATT dropdown. If they pick STR or AGI,
            // those are used as-is.
            let aimBonus = 0;
            if (cat === 'ranged' && w.aimed) {
                aimBonus = calc.mods.PER || 0;
                if ((window.state.perks['per_sharpshooter'] || 0) >= 4) aimBonus *= 2;
                if (w.weightClass === 'medium' && w.twoHanded) aimBonus *= 2;
            }

            if (cat === 'ranged') {
                // Ranged damage: AGI (or LUC if player selected it) + STR for heavy
                let atkAttr = w.attr === 'LUC' ? 'LUC' : 'AGI';
                let agiMod = calc.mods[atkAttr] || 0;
                let heavyStrBonus = (w.weightClass === 'heavy') ? (calc.mods.STR || 0) : 0;
                return agiMod + heavyStrBonus + (calc.bonusRangedDmg || 0) + aimBonus;
            }

            let attr = attrOverride || w.attr;
            let attrMod = calc.mods[attr] || 0;
            let mult = (w.weightClass === 'heavy') ? 2 : 1;
            return (attrMod * mult) + (calc.bonusMeleeDmg || 0);
        }

        function nextDieTier(dice) {
            let idx = WEAPON_DMG_TIERS.findIndex(t => t.dice === dice);
            if (idx === -1 || idx >= WEAPON_DMG_TIERS.length - 1) return null;
            return WEAPON_DMG_TIERS[idx + 1].dice;
        }
        function prevDieTier(dice) {
            let idx = WEAPON_DMG_TIERS.findIndex(t => t.dice === dice);
            if (idx <= 0) return null;
            return WEAPON_DMG_TIERS[idx - 1].dice;
        }
        window.nextDieTier = nextDieTier;
        window.prevDieTier = prevDieTier;

        function fmtDmg(dice, mod) {
            if (!mod) return dice;
            return `${dice} ${mod >= 0 ? '+' : '-'} ${Math.abs(mod)}`;
        }

        function renderWeaponRow(w, idx, opts) {
            let dmgMod = weaponDmgModifier(w, opts.attr);
            let atk = weaponAtkBonus(w, opts.attr);
            let dmgText = fmtDmg(opts.dice, dmgMod);
            let cat = weaponCategory(w);
            let disadvSources = calc.disadv.atkGeneral.concat(cat === 'melee' ? calc.disadv.atkMelee : []);
            let advSources = cat === 'ranged' ? calc.disadv.atkRangedAdv : [];
            let disadvHtml = disadvSources.length
                ? `<span class="text-[8px] text-red-400 block -mt-1 leading-none" title="${disadvSources.join(', ')}">(Disadv)</span>`
                : (advSources.length ? `<span class="text-[8px] text-emerald-400 block -mt-1 leading-none" title="${advSources.join(', ')}">(Adv)</span>` : '');

            if (!opts.editable) {
                return `
                    <tr class="bg-slate-800/30 border-b border-slate-700/50">
                        <td class="px-1 py-1 pl-4 text-[10px] text-slate-400 italic" colspan="1">${opts.label}</td>
                        <td class="px-1 py-1 text-[10px] text-slate-400 text-center font-bold">STR</td>
                        <td class="px-1 py-1"></td>
                        <td class="px-1 py-1 text-center">
                            <div class="font-black text-emerald-400/80 text-xs bg-slate-900 rounded border border-slate-700 py-0.5">${atk >= 0 ? '+' + atk : atk}</div>
                            ${disadvHtml}
                        </td>
                        <td class="px-1 py-1 text-center text-[11px] text-slate-300 font-bold">${dmgText}</td>
                        <td class="px-1 py-1 text-center text-[11px] text-blue-400 font-bold">${opts.ap}</td>
                        <td class="px-1 py-1"></td>
                    </tr>
                `;
            }

            return `
                <tr class="bg-slate-800/50 border-b border-slate-700/50">
                    <td class="px-1 py-2">
                        ${(w.isUnarmed || w.isAncestry)
                            ? `<div class="text-xs font-bold text-slate-300 p-1 h-7 flex items-center" data-tip="Innate weapon names are set when the trait is purchased, in the Ancestry screen.">${w.name}</div>`
                            : `<input type="text" value="${w.name}" onchange="window.updateWeaponName(${idx}, this.value)" placeholder="Weapon Name" class="bg-slate-900 border-slate-700 text-xs font-bold w-full h-7">`}
                        ${forgedWeaponBadge(w)}
                        ${w.forged ? `<button onclick="window.openWeaponForge(${idx})" class="text-[9px] text-orange-400 hover:text-orange-300 font-bold mt-0.5">Return to Forge</button>` : ''}
                        ${w.category === 'melee' && w.weightClass === 'medium' ? '<div class="text-[9px] text-slate-500 mt-0.5">1-Handed (2H row below)</div>' : ''}
                        ${cat === 'ranged' && opts.editable ? `<label class="flex items-center gap-1 mt-0.5 cursor-pointer"><input type="checkbox" ${w.aimed ? 'checked' : ''} onchange="window.toggleWeaponAim(${idx}, this.checked)" class="w-3 h-3"><span class="text-[9px] ${w.aimed ? 'text-amber-400 font-bold' : 'text-slate-500'}">Aimed (+PER)</span></label>` : ''}
                        ${cat === 'ranged' && w.weightClass === 'medium' && opts.editable ? `<label class="flex items-center gap-1 mt-0.5 ${window.calcTotalHands() - window.calcHandsUsed(idx) >= 2 || w.twoHanded ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}" data-tip="Requires Medium Ammo. May be wielded one- or two-handed; two-handed doubles the Aim action's PER bonus, but needs a free second hand."><input type="checkbox" ${w.twoHanded ? 'checked' : ''} ${(window.calcTotalHands() - window.calcHandsUsed(idx) >= 2 || w.twoHanded) ? '' : 'disabled'} onchange="window.toggleWeaponTwoHanded(${idx}, this.checked)" class="w-3 h-3"><span class="text-[9px] ${w.twoHanded ? 'text-amber-400 font-bold' : 'text-slate-500'}">2-Handed (2x Aim PER)</span></label>` : ''}
                    </td>
                    <td class="px-1 py-2 w-14">
                        ${cat === 'ranged'
                            ? (() => {
                                // Ranged always uses AGI for the attack roll.
                                // With FF rank 3+ and untrained, LUC can substitute.
                                let ffRank = window.state.perks['luc_fortunatefighter'] || 0;
                                let isTrained = weaponIsTrained(w);
                                let isHeavyR = w.weightClass === 'heavy';
                                if (ffRank >= 3 && !isTrained) {
                                    // Light/medium ranged: AGI or LUC
                                    // Heavy ranged: AGI+STR or LUC+STR (STR always adds to heavy ranged damage)
                                    let suffix = isHeavyR ? '+STR' : '';
                                    let opts = [{ val:'AGI', label:`AGI${suffix}` }, { val:'LUC', label:`LUC${suffix}` }];
                                    return `<select onchange="window.updateWeaponAttr(${idx}, this.value)" class="bg-slate-900 border-slate-700 text-[10px] font-bold p-1 h-7 w-20" title="Fortunate Fighter: use LUC instead of AGI for untrained ranged attacks">
                                        ${opts.map(o=>`<option value="${o.val}" ${w.attr===o.val?'selected':''}>${o.label}</option>`).join('')}
                                    </select>`;
                                }
                                // Standard: AGI only (show +STR note for heavy)
                                return `<div class="text-[10px] font-bold text-slate-300 p-1 h-7 flex items-center justify-center" title="Ranged attack and damage rolls always use AGI${isHeavyR?'; Heavy ranged also adds STR to damage':''}">AGI${isHeavyR?'+STR':''}</div>`;
                              })()
                            : (() => {
                                // Custom weapons can use any attribute (player defined).
                                // Forged/standard melee: only STR and AGI per book rules.
                                // Fortunate Fighter rank 3+ adds LUC on untrained weapons only.
                                let isTrained = weaponIsTrained(w);
                                if (w.isCustom) {
                                    // All attributes available for custom weapons
                                    return `<select onchange="window.updateWeaponAttr(${idx}, this.value)" class="bg-slate-900 border-slate-700 text-[10px] font-bold p-1 h-7 w-14">
                                        ${ATTRIBUTES.map(a => `<option value="${a}" ${a===w.attr?'selected':''}>${a}</option>`).join('')}
                                    </select>`;
                                }
                                let ffRank = window.state.perks['luc_fortunatefighter'] || 0;
                                let meleeAttrs = ['STR', 'AGI'];
                                if (ffRank >= 3 && !isTrained) meleeAttrs.push('LUC');
                                if (!meleeAttrs.includes(w.attr)) { w.attr = 'STR'; }
                                return `<select onchange="window.updateWeaponAttr(${idx}, this.value)" class="bg-slate-900 border-slate-700 text-[10px] font-bold p-1 h-7 w-14">
                                    ${meleeAttrs.map(a => `<option value="${a}" ${a===w.attr?'selected':''}>${a}</option>`).join('')}
                                </select>`;
                            })()}
                    </td>
                    <td class="px-1 py-2 text-center"><input type="checkbox" ${weaponIsTrained(w) ? 'checked' : ''} ${w.isUnarmed || w.isAncestry || window.state.trainedWeaponTypes.includes(companionWeaponTypeLabel(w)) ? `disabled title="${(w.isUnarmed || w.isAncestry) ? 'All creatures are inherently trained in their innate weapons' : 'Trained via Weapon Type training'}"` : ''} onchange="window.updateWeaponTr(${idx}, this.checked)" class="w-4 h-4"></td>
                    <td class="px-1 py-2 text-center">
                        <div class="font-black text-emerald-400 text-sm bg-slate-900 rounded border border-slate-700 py-0.5">${atk >= 0 ? '+' + atk : atk}</div>
                        ${disadvHtml}
                    </td>
                    <td class="px-1 py-2">
                        ${w.isCustom
                            ? `<div class="flex items-center gap-1"><input type="text" value="${w.dmg}" onchange="window.updateWeaponDmg(${idx}, this.value)" placeholder="1d6" class="bg-slate-900 border-slate-700 text-center text-xs font-bold h-7 w-14">${dmgMod !== 0 ? `<span class="text-xs font-bold text-slate-300">${dmgMod > 0 ? '+' : ''}${dmgMod}</span>` : ''}</div>`
                            : `<div class="text-xs font-bold text-slate-300 text-center p-1 h-7 flex items-center justify-center" data-tip="This weapon's base damage is fixed. Use the + Weapon button to add a custom weapon with an editable damage die.">${dmgText}</div>`}
                    </td>
                    <td class="px-1 py-2"><div class="text-xs font-bold text-blue-400 text-center p-1 h-7 flex items-center justify-center" data-tip="AP cost is fixed by weapon category and weight class, not freely editable.">${opts.ap}</div></td>
                    <td class="px-1 py-2 text-center">
                        ${!w.isUnarmed && !w.isAncestry ? `<button onclick="window.unequipWeapon(${idx})" class="text-[9px] text-cyan-400 hover:text-cyan-300 font-bold mr-1" title="Move to inventory">Unequip</button>` : ''}
                        ${!w.isUnarmed && !w.isAncestry && !w.forged ? `<button onclick="window.deleteWeapon(${idx})" class="text-red-500 font-bold hover:text-red-400 text-lg px-1 leading-none">&times;</button>` : ''}
                    </td>
                </tr>
            `;
        }

        function renderWeapons() {
            let html = '';
            window.state.weapons.forEach((w, idx) => {
                let isMediumMelee = weaponCategory(w) === 'melee' && w.weightClass === 'medium';
                let isMediumRanged = weaponCategory(w) === 'ranged' && w.weightClass === 'medium';
                // Would going two-handed fit? Discount this weapon's own
                // current cost first (weaponHandCost, not a flat 1) since a
                // twoHanded medium weapon already costs 2 -- excludeIdx
                // alone isn't enough once a weapon can cost more than 1.
                let handsFreeForThis = window.calcTotalHands() - window.calcHandsUsed(idx);
                let couldGoTwoHanded = handsFreeForThis >= 2;
                html += renderWeaponRow(w, idx, { attr: w.attr, dice: w.dmg, ap: w.ap, editable: true });
                if (isMediumMelee && couldGoTwoHanded) {
                    let twoHDice = nextDieTier(w.dmg) || w.dmg;
                    html += renderWeaponRow(w, idx, { label: '↳ 2-Handed (STR, +1 AP, +1 die step)', attr: 'STR', dice: twoHDice, ap: 4, editable: false });
                }
                if (isMediumRanged && w.aimed && !w.twoHanded && couldGoTwoHanded) {
                    w.twoHanded = true;
                    html += renderWeaponRow(w, idx, { label: '↳ 2-Handed Aim (2x PER bonus)', attr: w.attr, dice: w.dmg, ap: w.ap, editable: false });
                    w.twoHanded = false;
                }
                // Notes row AFTER all 2H rows so it never covers the 2H preview
                if (w.isCustom) {
                    html += `<tr><td colspan="7" class="px-2 pb-1.5 pt-0">
                        <input type="text" value="${(w.notes || '').replace(/"/g, '&quot;')}"
                            onchange="window.updateWeaponNotes(${idx}, this.value)"
                            placeholder="Notes: Heavy, Range 20/60, Crit x3, etc."
                            class="bg-slate-800 border-slate-700 text-[9px] text-slate-400 w-full px-1.5 py-0.5 rounded">
                    </td></tr>`;
                }
            });

            if ((window.state.perks['cha_loyalcompanion'] || 0) >= 1 && window.state.companion && typeof window.companionStatBlock === 'function') {
                let sb = window.companionStatBlock();
                if (sb) {
                    html += `
                        <tr class="bg-purple-900/20 border-b border-purple-800/50">
                            <td class="px-1 py-2">
                                <div class="text-xs font-bold text-purple-300">${sb.name} (Innate Attack)</div>
                                <button onclick="window.openCompanionDetail()" class="text-[9px] text-purple-400 hover:text-purple-300 font-bold">View Stat Block</button>
                            </td>
                            <td class="px-1 py-2 text-center text-[10px] text-slate-400">--</td>
                            <td class="px-1 py-2 text-center"><input type="checkbox" checked disabled class="w-4 h-4 opacity-50"></td>
                            <td class="px-1 py-2 text-center"><div class="font-black text-emerald-400/80 text-sm bg-slate-900 rounded border border-slate-700 py-0.5">+${sb.attackBonus}</div></td>
                            <td class="px-1 py-2 text-center text-[11px] text-slate-300 font-bold">${sb.dmgText}</td>
                            <td class="px-1 py-2 text-center text-[11px] text-blue-400 font-bold">3</td>
                            <td class="px-1 py-2"></td>
                        </tr>
                    `;
                    sb.equippedWeapons.forEach(w => {
                        html += `
                            <tr class="bg-purple-900/20 border-b border-purple-800/50">
                                <td class="px-1 py-2 ${w.isTwoHanded ? 'pl-4' : ''}">
                                    <div class="text-xs font-bold text-purple-300">${w.isTwoHanded ? '↳ ' : sb.name + ' -- '}${w.name}</div>
                                    <div class="text-[9px] text-slate-500">${w.typeLabel}${w.attr ? ` (${w.attr})` : ''}</div>
                                    ${w.category === 'ranged' && !w.isTwoHanded ? `<label class="flex items-center gap-1 mt-0.5 cursor-pointer"><input type="checkbox" ${w.aimed ? 'checked' : ''} onchange="window.ncToggleCompanionWeaponAim(${w.weaponIdx}, this.checked)" class="w-3 h-3"><span class="text-[9px] ${w.aimed ? 'text-amber-400 font-bold' : 'text-slate-500'}">Aimed (+PER)</span></label>` : ''}
                                </td>
                                <td class="px-1 py-2 text-center text-[10px] text-slate-400">${w.attr || '--'}</td>
                                <td class="px-1 py-2 text-center"><input type="checkbox" ${w.trained ? 'checked' : ''} disabled class="w-4 h-4 opacity-50" title="Trained: ${w.trained}"></td>
                                <td class="px-1 py-2 text-center"><div class="font-black text-emerald-400/80 text-sm bg-slate-900 rounded border border-slate-700 py-0.5">+${w.atk}</div></td>
                                <td class="px-1 py-2 text-center text-[11px] text-slate-300 font-bold">${w.dmg}</td>
                                <td class="px-1 py-2 text-center text-[11px] text-blue-400 font-bold">${w.ap}</td>
                                <td class="px-1 py-2"></td>
                            </tr>
                        `;
                    });

                    let anySlots = [1,2,3,4,5].some(lvl => (sb.casterSlots[lvl] || 0) > 0);
                    if (anySlots) {
                        let slotsHtml = [1,2,3,4,5].map(lvl => {
                            let max = sb.casterSlots[lvl] || 0;
                            if (max === 0) return '';
                            let used = window.state.companion.usedPowerSlots[lvl] || 0;
                            let bubbles = Array.from({ length: max }, (_, i) => {
                                let isUsed = i < used;
                                return `<div class="power-bubble ${isUsed ? 'empty' : 'filled'}" onclick="window.toggleCompanionPowerSlot(${lvl}, ${i})"></div>`;
                            }).join('');
                            return `<div class="flex items-center gap-1"><span class="text-[9px] text-slate-500 font-bold">Lvl ${lvl}</span><div class="flex gap-1">${bubbles}</div></div>`;
                        }).join('');
                        html += `
                            <tr class="bg-purple-900/10 border-b border-purple-800/50">
                                <td colspan="7" class="px-2 py-2">
                                    <div class="text-[9px] font-black text-purple-400 uppercase mb-1">${sb.name} -- Power Slots</div>
                                    <div class="flex flex-wrap gap-3">${slotsHtml}</div>
                                </td>
                            </tr>
                        `;
                    }

                    let limitedPowers = sb.powerCards.filter(p => p.usageType === 'charges' || p.usageType === 'recharge');
                    if (limitedPowers.length) {
                        if (!window.state.companion.powerChargesUsed) window.state.companion.powerChargesUsed = {};
                        let chargesHtml = limitedPowers.map(p => {
                            let key = p.name;
                            let used = window.state.companion.powerChargesUsed[key] || 0;
                            if (p.usageType === 'charges') {
                                let max = p.maxCharges || 1;
                                if (used > max) used = max;
                                return `
                                    <div class="flex items-center gap-2 text-[10px] text-slate-300">
                                        <span class="font-bold">${p.name}</span>
                                        <button onclick="window.adjustCompanionPowerCharges('${key.replace(/'/g,"\\'")}', -1)" class="w-5 h-5 rounded bg-slate-700 hover:bg-slate-600 text-white font-bold">-</button>
                                        <span>${max - used}/${max} charges</span>
                                        <button onclick="window.adjustCompanionPowerCharges('${key.replace(/'/g,"\\'")}', 1)" class="w-5 h-5 rounded bg-slate-700 hover:bg-slate-600 text-white font-bold">+</button>
                                    </div>
                                `;
                            } else {
                                // Recharge: binary used/available, same +/- control for consistency
                                let isUsed = used > 0;
                                return `
                                    <div class="flex items-center gap-2 text-[10px] text-slate-300">
                                        <span class="font-bold">${p.name}</span> <span class="text-slate-500">(Recharge 5-6)</span>
                                        <button onclick="window.adjustCompanionPowerCharges('${key.replace(/'/g,"\\'")}', -1)" class="w-5 h-5 rounded bg-slate-700 hover:bg-slate-600 text-white font-bold">-</button>
                                        <span>${isUsed ? 'Used' : 'Available'}</span>
                                        <button onclick="window.adjustCompanionPowerCharges('${key.replace(/'/g,"\\'")}', 1)" class="w-5 h-5 rounded bg-slate-700 hover:bg-slate-600 text-white font-bold">+</button>
                                    </div>
                                `;
                            }
                        }).join('');
                        html += `
                            <tr class="bg-purple-900/10 border-b border-purple-800/50">
                                <td colspan="7" class="px-2 py-2">
                                    <div class="text-[9px] font-black text-purple-400 uppercase mb-1">${sb.name} -- Charges</div>
                                    <div class="flex flex-col gap-1">${chargesHtml}</div>
                                </td>
                            </tr>
                        `;
                    }
                }
            }

            document.getElementById('weaponsBody').innerHTML = html;
        }

        function getMaxSlotsForLevel(lvl) {
            let attr = window.state.powerAttr;
            if(attr === 'INT') {
                let timesBought = (window.state.pwrIntRanks && window.state.pwrIntRanks[lvl]) ? window.state.pwrIntRanks[lvl] : 0;
                if(lvl===1) return 3 * timesBought;
                if(lvl===2) return 2 * timesBought;
                if(lvl===3) return 2 * timesBought;
                if(lvl===4) return 1 * timesBought;
                if(lvl===5) return 1 * timesBought;
            } else {
                return window.state.perks["pwr_cha"] || 0;
            }
            return 0;
        }

        // delta directly represents the change to charges REMAINING
        // (matching what the +/- buttons visually show), so a NEGATIVE
        // delta (the "-" button, spending a charge) increases the
        // internal used-count, and a positive delta (the "+" button,
        // restoring one) decreases it.
        window.adjustCompanionPowerCharges = function(powerKey, delta) {
            let c = window.state.companion;
            if (!c.powerChargesUsed) c.powerChargesUsed = {};
            let current = c.powerChargesUsed[powerKey] || 0;
            c.powerChargesUsed[powerKey] = Math.max(0, current - delta);
            window.recalculateMath();
        };

        window.togglePowerSlot = function(lvl, idx) {
            let max = getMaxSlotsForLevel(lvl);
            if(max === 0) return;
            if (lvl === 'CHA') {
                // The Charisma pool renders in the opposite order from the
                // Intelligence levels (available/filled bubbles first at
                // low index, used/empty bubbles last at high index).
                // Clicking a FILLED bubble uses one more (regardless of
                // which filled bubble was clicked -- it always consumes
                // from the end of the filled range). Clicking an EMPTY
                // bubble refills everything from that spot onward.
                let used = window.state.usedPowerSlots['CHA'] || 0;
                let isFilled = idx < (max - used);
                window.state.usedPowerSlots['CHA'] = isFilled ? Math.min(max, used + 1) : (max - (idx + 1));
                window.recalculateMath();
                return;
            }
            // Bubble idx (0-based): the first `used` bubbles are empty,
            // the rest are filled. Clicking a FILLED bubble (idx >= used)
            // uses one more, regardless of which filled bubble was
            // clicked. Clicking an EMPTY bubble (idx < used) refills
            // everything from that spot onward by setting used = idx.
            let used = window.state.usedPowerSlots[lvl] || 0;
            let isFilled = idx >= used;
            window.state.usedPowerSlots[lvl] = isFilled ? Math.min(max, used + 1) : idx;
            window.recalculateMath();
        }

        function renderPowerStats() {
            let attr = window.state.powerAttr;
            let mod = calc.mods[attr] || 0;
            let maxLvl = (attr === 'INT') ? (window.state.perks["pwr_int"] || 0) : (window.state.perks["pwr_cha"] || 0);

            let atk = mod + window.state.trainingBonus + maxLvl;
            let dc = 10 + mod + maxLvl;

            document.getElementById('dispPwrAtk').innerText = (atk >= 0 ? '+'+atk : atk);
            document.getElementById('dispPwrDc').innerText = dc;

            let html = '';
            if (attr === 'INT') {
                for(let lvl = 1; lvl <= 5; lvl++) {
                    let slotMax = getMaxSlotsForLevel(lvl);
                    
                    html += `<div><div class="text-[9px] text-slate-500 uppercase font-bold mb-1">Lvl ${lvl}</div><div class="flex flex-wrap items-center justify-center gap-1">`;
                    if(slotMax === 0) html += `<span class="text-[10px] text-slate-600">-</span>`;
                    for(let i=0; i<slotMax; i++) {
                        let isUsed = i < window.state.usedPowerSlots[lvl];
                        let filledClass = isUsed ? 'empty' : 'filled';
                        html += `<div class="power-bubble ${filledClass}" onclick="window.togglePowerSlot(${lvl}, ${i})"></div>`;
                    }
                    html += `</div></div>`;
                }
            } else if (attr === 'CHA') {
                let slotMax = maxLvl;
                let used = window.state.usedPowerSlots['CHA'] || 0;
                if (used > slotMax) used = slotMax;
                let available = slotMax - used;
                let displayLvl = maxLvl > 0 ? maxLvl : 1;

                html += `<div class="col-span-5 flex flex-col items-center justify-center pt-1"><div class="text-[10px] text-slate-500 uppercase font-bold mb-2">LVL ${displayLvl} (Unified Pool)</div><div class="flex flex-wrap items-center justify-center gap-3">`;
                if(slotMax === 0) {
                    html += `<span class="text-[10px] text-slate-600">No powers unlocked.</span>`;
                } else {
                    for(let i=0; i<slotMax; i++) {
                        let filledClass = i < available ? 'filled' : 'empty';
                        html += `<div class="power-bubble ${filledClass} scale-125" onclick="window.togglePowerSlot('CHA', ${i})"></div>`;
                    }
                }
                html += `</div></div>`;
            }
            document.getElementById('powerSlotsContainer').innerHTML = html;
        }

        function renderPowers() {
            let html = window.state.powers.map((p, idx) => `
                <div class="bg-slate-900 p-2 rounded border border-slate-700 relative group shadow-inner">
                    <button onclick="window.deletePower(${idx})" class="absolute top-1 right-1 text-red-500 hover:text-red-400 font-bold opacity-0 group-hover:opacity-100">&times;</button>
                    <div class="flex justify-between items-center mb-1">
                        <span class="font-bold text-sm text-indigo-300">${p.name}</span>
                        <span class="text-[10px] bg-slate-800 px-2 py-0.5 rounded border border-slate-600 text-slate-400 font-bold shadow">Lvl ${p.lvl} | ${p.ap} AP</span>
                    </div>
                    <div class="grid grid-cols-3 gap-1 mb-1 text-[10px] text-slate-400">
                        <div><span class="text-slate-500">A/S:</span> ${p.atk}</div>
                        <div><span class="text-slate-500">R/A:</span> ${p.rng}</div>
                        <div><span class="text-slate-500">D/H:</span> ${p.dmg}</div>
                    </div>
                    <div class="text-[10px] text-slate-500 leading-tight font-medium">${p.desc}</div>
                    ${p.draft ? `<button onclick="window.openPowerEditor(${idx})" class="text-[9px] text-purple-400 hover:text-purple-300 font-bold mt-1">Edit in Power Crafter${p.wasFree ? ' (Free)' : ''}</button>` : ''}
                </div>
            `).join('');
            document.getElementById('powersContainer').innerHTML = html;
        }

