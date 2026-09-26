// ============================================================
// APX Character Sheet — Derived Stat Engine
// ============================================================
        // Click-to-roll attribute for the dice roller (see js/apx-dice.js)
        function apxRollAttr(o) {
            if (!window.APXDice) return '';
            return ` data-apx-roll='${window.APXDice.attr(Object.assign({ who: window.state?.name || '' }, o))}'`;
        }
        window.apxRollAttr = apxRollAttr;

        window.recalculateMath = function() {
            // Bring older saves up to the current rules (non-destructive, runs once per character)
            if (typeof window.apxMigrateCharacter === 'function') window.apxMigrateCharacter(window.state);
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
            // Bleeding Out ends as soon as the character has HP again
            if ((window.state.currentHp || 0) > 0 && window.state.conditions.includes('bleedingout'))
                window.state.conditions = window.state.conditions.filter(c => c !== 'bleedingout');
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
                    autoFailSaveByAttr: { STR: [], AGI: [], CON: [], PER: [], INT: [], CHA: [], LUC: [] },
                    autoFailCheckByAttr: { STR: [], AGI: [], CON: [], PER: [], INT: [], CHA: [], LUC: [] }
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
                if (Array.isArray(def.autoFailChecks)) def.autoFailChecks.forEach(a => calc.disadv.autoFailCheckByAttr[a] && calc.disadv.autoFailCheckByAttr[a].push(label));
                if (def.speedZero) calc.speedForcedZero = true;
                if (def.apZero) calc.apForcedZero = true;
                if (def.noActions) calc.cantAct = true;
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
            // Everything equipped custom items add (see js/apx-item-effects.js)
            let itemFx = calc.itemFx = window.apxItemEffects ? window.apxItemEffects(window.state) : { attr: {}, skill: {}, er: [], stat: {} };
            let fxStat = k => (itemFx.stat && itemFx.stat[k]) || 0;
            ATTRIBUTES.forEach(a => { if (itemFx.attr[a]) calc.scores[a] += itemFx.attr[a]; });

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

            calc.maxRestDice = calc.scores.CON + (calc.maxRestDice - 5) + fxStat('maxRestDice');
            calc.maxRestDice = Math.max(0, calc.maxRestDice);

            let vitalHpRank = window.state.perks['con_vitality'] || 0;
            let maxHp = (calc.scores.CON * 5) + (vitalHpRank * 5) + window.state.xpHpBought - calc.maxHpPenalty + fxStat('maxHp');
            maxHp = Math.max(5, maxHp);
            calc.maxHp = maxHp;
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
            calc.carryCap = calc.scores.STR * sizeMult + (calc.carryCap - 150) + fxStat('carryCap');

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
            calc.customItemErBonuses = itemFx.er.slice();
            armorAc += fxStat('ac');
            armorDr += fxStat('dr');
            armorEr += fxStat('er');
            calc.speed += fxStat('speed');
            Object.keys(itemFx.skill).forEach(t => {
                // Items name skills by their display name ("Animal Handling"); the sheet keys them by id
                let sk = [...SKILLS, ...(window.state.customSkills || [])].find(x => x.name === t || x.id === t);
                let key = sk ? sk.id : t;
                calc.skills[key] = (calc.skills[key] || 0) + itemFx.skill[t];
            });
            calc.bonusMeleeAtk += fxStat('meleeAtk'); calc.bonusMeleeDmg += fxStat('meleeDmg');
            calc.bonusRangedAtk += fxStat('rangedAtk'); calc.bonusRangedDmg += fxStat('rangedDmg');

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
            // Conditions in effect = the ones set + the ones they bring with them
            // (Bleeding Out -> Unconscious -> Incapacitated, Paralyzed -> Incapacitated...)
            let effConds = window.apxEffectiveConditions ? window.apxEffectiveConditions(window.state.conditions, window.state) : (window.state.conditions || []).map(id => ({ id }));
            // "falls Prone": added once when it begins, and stays until they stand up
            let startsNow = effConds.map(c => c.id).filter(id => !(window.state._condsInEffect || []).includes(id));
            startsNow.forEach(id => (typeof CONDITION_ON_START !== 'undefined' ? CONDITION_ON_START[id] || [] : []).forEach(extra => {
                if (!window.state.conditions.includes(extra)) { window.state.conditions.push(extra); effConds.push({ id: extra, from: null }); }
            }));
            window.state._condsInEffect = effConds.map(c => c.id);
            effConds.forEach(ec => {
                let cDef = CONDITIONS.find(c => c.id === ec.id);
                if (cDef) applyEffectSource(ec.from ? `${cDef.name} (from ${(CONDITIONS.find(c => c.id === ec.from) || {}).name || ec.from})` : cDef.name, cDef);
            });
            // Can't act at all (Incapacitated, and what brings it): attacks show why instead of "(Disadv)" and don't roll
            {
                let ids = effConds.map(c => c.id);
                calc.cantAct = ids.includes('incapacitated');
                calc.cantActLabel = !calc.cantAct ? '' : ids.includes('unconscious') ? 'Unconscious' : ids.includes('paralyzed') ? 'Paralyzed' : 'Incapacitated';
            }

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

            // Fortunate Fighter Rank 1: LUC may replace AGI for AC -- the higher one is used
            let acAttr = (calc.lucAc && (calc.mods.LUC || 0) > (calc.mods.AGI || 0)) ? 'LUC' : 'AGI';
            let acAttrMod = calc.mods[acAttr] || 0;
            let allowedAgi;
            if (isHeavy) {
                allowedAgi = 0; // Heavy Armor: AGI modifier never applies to AC, positive or negative
            } else if (acAttrMod < 0) {
                allowedAgi = acAttrMod; // negative AGI is never capped outside Heavy Armor
            } else {
                allowedAgi = Math.min(acAttrMod, agiCap);
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
            calc.ac += allowedAgi + armorAc;
            document.getElementById('dispAc').innerText = calc.ac;
            // Update AC label tooltip dynamically
            {
                let acLabel = document.getElementById('acLabel') || document.querySelector('div[data-tip*="AGI modifier"]');
                if (acLabel) {
                    let defRank = window.state.perks['con_defensive'] || 0;
                    let ffRank  = window.state.perks['luc_fortunatefighter'] || 0;
                    if (defRank >= 1 && armorWt === 0) {
                        acLabel.setAttribute('data-tip', 'Unarmored with Defensive perk: 10 + AGI mod + CON mod. Equipping armor/shield removes the CON bonus.');
                    } else if (ffRank >= 1) {
                        acLabel.setAttribute('data-tip', '10 + AGI or LUC modifier, whichever is higher (Fortunate Fighter) + Armor + Shield + bonuses');
                    } else {
                        acLabel.setAttribute('data-tip', '10 + AGI modifier + Armor + Shield + other bonuses');
                    }
                }
            }
            document.getElementById('dispAcCalc').innerText = `10+${allowedAgi}(${acAttr})+${armorAc}`;
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
                    let parts = lines.length ? ['Energy Resistances: ' + lines.join(', ')] : [];
                    // Defensive Rank 4: unarmored, DR and ER against traps, hazards and falling go up by your CON score
                    if ((window.state.perks['con_defensive'] || 0) >= 4 && armorWt === 0) {
                        let con = (calc.scores && calc.scores.CON) || 0;
                        parts.push(`<span class="text-cyan-300" title="Defensive Rank 4: while unarmored, your DR and ER against traps, hazards and falling increase by your CON score (${con})">Traps, Hazards &amp; Falling: DR ${calc.dr + con} / ER ${calc.er + con}</span> <span class="text-slate-500">(Defensive)</span>`);
                    }
                    envEl.innerHTML = parts.join('<br>');
                }
            }

            let tirelessRank = window.state.perks['gen_tireless'] || 0;
            let effectiveFatigue = Math.max(0, window.state.fatigue - tirelessRank);
            calc.effectiveFatigue = effectiveFatigue;
            calc.maxAp = calc.apForcedZero ? 0 : Math.max(0, Math.max(6, 6 + Math.floor(calc.mods.AGI / 2)) - effectiveFatigue + fxStat('maxAp'));   // 6 + half AGI mod (round down), min 6 — Sept 23, 2026 update
            
            window.syncInitStatCheckboxes(); // may revert state.initStat if its perk was removed, so this runs before calc.init uses it
            calc.init = 10 + (calc.mods[window.state.initStat] || 0) + (calc.init - 10) + fxStat('init');

            document.getElementById('dispGlobalTb').innerText = window.state.trainingBonus;
            document.getElementById('dispAp').innerText = calc.maxAp;
            window.apxRenderApPips && window.apxRenderApPips();
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
            calc.woundThreshold = (calc.scores.CON * 2) + calc.wtBoost + fxStat('wt');
            document.getElementById('dispWt').innerText = calc.woundThreshold;
            let newMaxLuck = Math.max(0, Math.max(1, calc.mods.LUC) + fxStat('maxLuck'));
            calc.maxLuck = newMaxLuck;
            document.getElementById('dispMaxLuck').innerText = newMaxLuck;
            // Auto-adjust current luckPts when LUC changes (same pattern as restDice)
            if (window.state.lastKnownMaxLuck !== undefined && newMaxLuck !== window.state.lastKnownMaxLuck) {
                window.state.luckPts = Math.max(0, Math.min(newMaxLuck, (window.state.luckPts || 0) + (newMaxLuck - window.state.lastKnownMaxLuck)));
                let lpEl = document.getElementById('luckPtsInput');
                if (lpEl) lpEl.value = window.state.luckPts;
            }
            window.state.lastKnownMaxLuck = newMaxLuck;

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
                let saveBonus = mod + (saveTrained ? window.state.trainingBonus : 0) + (window.apxItemSaveBonus ? window.apxItemSaveBonus(calc.itemFx, attr) : 0);
                let checkItemBonus = window.apxItemCheckBonus ? window.apxItemCheckBonus(calc.itemFx, attr) : 0;
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
                                <div class="w-10 h-8 flex items-center justify-center font-black text-lg rounded shadow-inner border ${bgClass} apx-rollable" title="Click to roll a ${attr} check"${apxRollAttr({ type: 'check', label: attr + ' check', bonus: mod + checkItemBonus, attr, disSources: calc.disadv.checkByAttr[attr] || [], autoFail: (calc.disadv.autoFailCheckByAttr[attr] || []).join(', ') || undefined })}>${(mod + checkItemBonus) >= 0 ? '+'+(mod + checkItemBonus) : (mod + checkItemBonus)}</div>
                            </div>
                        </div>
                        <div class="flex items-center justify-between px-2 py-1 bg-slate-800/60 border-b border-slate-700/50 text-[10px] apx-rollable" title="Click to roll a ${attr} save"${apxRollAttr({ type: 'check', kind: 'save', attr, label: attr + ' Save', bonus: saveBonus, disSources: saveDisadvSources, autoFail: saveAutoFailSources.join(', ') || undefined })}>
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
                    let total = mod + (isTr ? window.state.trainingBonus : 0) + perkBonus + checkItemBonus;

                    let pasText = "--";
                    if (skill.pass) {
                        if (skill.reqTr && !isTr) pasText = "--";
                        else pasText = 10 + total;
                    }

                    let checkDisadvSources = calc.disadv.checkByAttr[attr] || [];
                    let checkAutoFail = (calc.disadv.autoFailCheckByAttr[attr] || []).join(', ') || undefined;
                    let disadvHtml = checkAutoFail ? `<span class="text-[8px] text-red-500 font-black ml-1" title="${checkAutoFail}">(Auto-Fail)</span>`
                        : checkDisadvSources.length ? `<span class="text-[8px] text-red-400 ml-1" title="${checkDisadvSources.join(', ')}">(Disadv)</span>` : '';
                    let displayName = skill.name.startsWith('Encyclopedia (') ? skill.name.replace('Encyclopedia (', '').replace(')', '') : skill.name;

                    return `
                        <div class="flex items-center justify-between text-[11px] py-1 px-2 hover:bg-slate-800/50 transition relative group">
                            ${skill.isCustom && !skill.name.startsWith('Encyclopedia') ? `<button onclick="window.deleteCustomSkill('${skill.id}')" class="absolute -left-1 text-red-500 hover:text-red-400 opacity-0 group-hover:opacity-100">&times;</button>` : ''}
                            <div class="flex items-center gap-2 flex-1 ${indent ? 'pl-5' : (skill.isCustom ? 'pl-3' : '')}">
                                <input type="checkbox" ${isTr ? 'checked' : ''} disabled title="Trained via Origin, Ancestry, or Spend XP -- not manually toggled here" class="w-3 h-3 cursor-not-allowed opacity-70">
                                <span class="${isTr ? 'text-blue-300 font-bold' : 'text-slate-300'} apx-rollable" ${isTr && window.state.skillSource[skill.id] ? `data-tip="Trained via: ${window.state.skillSource[skill.id]}"` : ''}${apxRollAttr({ type: 'check', label: displayName + ' (' + attr + ')', bonus: total, attr, skill: skill.id, disSources: checkDisadvSources, autoFail: checkAutoFail })}>${displayName}</span>
                            </div>
                            <div class="w-auto text-center font-bold ${total < 0 ? 'skill-mod-negative' : (isTr ? 'text-blue-400' : 'text-slate-500')} text-xs apx-rollable"${apxRollAttr({ type: 'check', label: displayName + ' (' + attr + ')', bonus: total, attr, skill: skill.id, disSources: checkDisadvSources, autoFail: checkAutoFail })}>${total >= 0 ? '+'+total : total}${disadvHtml}</div>
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
            let giveTargets = [];
            try { giveTargets = (typeof window.apxGiveTargets === 'function' && window.apxGiveTargets()) || []; } catch (e) { }
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
                // Give to a party member (only for characters in a world with other players)
                let giveSel = giveTargets.length ? `<button onclick="window.apxGiveMenu(${idx}, this)" title="Give to a party member" class="text-[9px] text-emerald-400 hover:text-emerald-300 font-bold mr-1">Give</button>` : '';
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
                let nameHtml = `<div class="text-xs ${item.isLocked ? 'text-slate-400' : 'text-slate-200'} font-bold px-1 truncate" title="${item.name}">${item.name}${item.isLocked && !window.state.craftingMatWeightEnabled ? ' <span class="text-[9px] text-slate-600">(wt off)</span>' : ''}</div>`
                    + (item.isCustomEquippable && item.bonuses && window.apxItemBonusText && window.apxItemBonusText(item.bonuses)
                        ? `<div class="text-[9px] ${item.equipped ? 'text-cyan-400' : 'text-slate-500'} px-1 truncate" title="${window.apxItemBonusText(item.bonuses).replace(/"/g, '&quot;')}">${window.apxItemBonusText(item.bonuses)}</div>` : '');
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
                            ${giveSel}
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

        function forgedWeaponBadge(w, exclude2HOnlyProps) {
            if (!w.forged) return '';
            let bits = [w.elemental || w.dmgType, `x${w.critMult}`];
            let rng = effectiveWeaponRange(w);
            if (rng) bits.push(rng + ' sq');
            let props = WEAPON_PROPERTIES.filter(p => {
                if (!w.properties) return false;
                let val = w.properties[p.key];
                if (!val && val !== 0) return false;
                let count = (typeof val === 'number') ? val : (val ? 1 : 0);
                if (!count) return false;
                // On medium melee, reach only applies to the 2H row — suppress on 1H badge
                if (exclude2HOnlyProps && p.key === 'reach' && w.weightClass === 'medium') return false;
                return true;
            }).filter(p => !p.addonOf).map(p => {
                let val = w.properties[p.key];
                let count = (typeof val === 'number') ? val : 1;
                // An add-on shows with its property: "Thrown (Returning)"
                let adds = WEAPON_PROPERTIES.filter(x => x.addonOf === p.key && w.properties[x.key]).map(x => x.name.replace(/\s*\(.*\)$/, ''));
                let name = adds.length ? `${p.name} (${adds.join(', ')})` : p.name;
                return count > 1 ? `${name} ${count}` : name;
            });
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
                // Ranged damage: AGI (or LUC if player selected it); heavy ranged doubles AGI
                let atkAttr = w.attr === 'LUC' ? 'LUC' : 'AGI';
                let agiMod = calc.mods[atkAttr] || 0;
                let mult = (w.weightClass === 'heavy') ? 2 : 1;
                return (agiMod * mult) + (calc.bonusRangedDmg || 0) + aimBonus;
            }

            let attr = attrOverride || (w.weightClass === 'heavy' ? 'STR' : w.attr);
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

        // ── AP for the player's own attacks ────────────────────────
        // Clicking an attack spends its AP from the tracker. When a perk or feature
        // might change the cost, when Aiming, or when there isn't enough AP, the
        // player gets a short popup first. The card shows what was spent.
        window.apxBeforeAttack = function(o) {
            // Your Loyal Companion's attacks (from its stat block) spend the companion's AP
            if (o && o.companion && typeof window.apxCompApCurrent === 'function' && window.state?.companion) {
                let cost = Math.max(0, parseInt(o.apCost) || 3), have = window.apxCompApCurrent();
                if (have < cost) return { note: `Not enough AP: ${window.state.companion.name || 'your companion'} has ${have}, needs ${cost}`, warn: true };
                window.apxCompSpendAp(cost);
                return { note: `${window.state.companion.name || 'Companion'}: −${cost} AP (${window.apxCompApCurrent()} left)` };
            }
            if (!o || !o.pcAttack || typeof window.apxApCurrent !== 'function') return null;
            let st = window.state || {}, perks = st.perks || {};
            let have = window.apxApCurrent();
            let base = Math.max(0, parseInt(o.apCost) || 0);
            let aimAp = o.aimed ? Math.max(0, parseInt(st.aimAp) || 1) : 0;
            let effIds = (window.apxEffectiveConditions ? window.apxEffectiveConditions(st.conditions || [], st) : (st.conditions || []).map(id => ({ id }))).map(c => c.id);
            let staggered = o.aimed && effIds.includes('staggered');
            // Modifiers that may apply (the player decides which ones do)
            let mods = [];
            let ma = perks['str_martialarts'] || 0;
            if (o.unarmed && ma >= 1) mods.push({ id: 'ma', label: 'Martial Arts: unarmed attacks cost 1 AP', set: 1, on: true });
            let fl = perks['agi_flurry'] || 0;
            if (fl >= 1) mods.push({ id: 'flurry', label: 'Flurry perk: your last weapon attack hit', delta: -1, stack: fl >= 3 ? 2 : 1, on: false,
                tip: fl >= 3 ? 'Rank 3: the reduction stacks up to 2 times (one per consecutive hit).' : 'Rank 1: a weapon hit reduces the AP of your next attack by 1 (min 1).' });
            let flGm = window._pwCombatTurn && window._pwCombatTurn.flurry;
            let flOn = !!(flGm && flGm.uid === window.apxAuth?.user?.uid && o.hit && flGm.weapon === o.hit.weapon);
            if (o.wFlurry) mods.push({ id: 'wflurry', label: flOn ? `Flurry: you hit ${flGm.target || 'them'} with this weapon this turn (attacking them again?)` : 'Flurry weapon: you already hit this target this turn', delta: -1, on: flOn,
                tip: 'Flurry property: each attack after a hit on the same target costs 1 less AP (min 1) until you miss or your turn ends.' });
            let needPopup = mods.length > 0 || o.aimed;
            let compute = (sel, aim, extra) => {
                let cost = base;
                let setTo = null;
                mods.forEach(m => { if (!sel[m.id]) return; if (m.set != null) setTo = m.set; });
                if (setTo != null) cost = setTo;
                mods.forEach(m => { if (!sel[m.id] || m.delta == null) return; cost += m.delta * (typeof sel[m.id] === 'number' ? sel[m.id] : 1); });
                if (mods.some(m => sel[m.id] && m.delta != null)) cost = Math.max(1, cost);
                cost = Math.max(0, cost + (parseInt(extra) || 0));
                return { atk: cost, aim: staggered ? 0 : aim, total: cost + (staggered ? 0 : aim) };
            };
            let finish = (c, spend) => {
                let parts = c.aim ? ` (${c.atk} attack + ${c.aim} Aim)` : '';
                if (!spend) return { note: c.total > have ? `Not enough AP: had ${have}, needed ${c.total}${parts}` : `AP not spent (${c.total} AP${parts})`, warn: c.total > have };
                window.apxSpendAp(c.total);
                return { note: `-${c.total} AP${parts} · ${window.apxApCurrent()} left` };
            };
            if (!needPopup) {
                let c = compute({}, 0, 0);
                if (c.total <= have) return finish(c, true);
            }
            // Popup
            window.APXDice?.css?.();
            let esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
            return new Promise(res => {
                let back = document.createElement('div');
                back.className = 'apxd-ask';
                back.setAttribute('data-ap-popup', '1');
                let modRows = mods.map(m => m.stack > 1
                    ? `<label style="display:flex;align-items:center;gap:.4rem;font-size:.72rem;margin:.25rem 0" title="${esc(m.tip || '')}"><select data-m="${m.id}" style="background:var(--c-surface2,#0f172a);color:inherit;border:1px solid var(--c-border2,#475569);border-radius:.3rem;font-size:.7rem"><option value="0">No hits</option><option value="1">1 hit (-1 AP)</option><option value="2">2 hits (-2 AP)</option></select>${esc(m.label)}</label>`
                    : `<label style="display:flex;align-items:center;gap:.4rem;font-size:.72rem;margin:.25rem 0;cursor:pointer" title="${esc(m.tip || '')}"><input type="checkbox" data-m="${m.id}" ${m.on ? 'checked' : ''}> ${esc(m.label)}</label>`).join('');
                back.innerHTML = `<div data-ap-box>
                    <h4>${esc(o.label || 'Attack')}: AP</h4>
                    <p style="margin:0 0 .5rem">Attack cost: <b>${base} AP</b>. You have <b>${have} AP</b>.</p>
                    ${o.aimed ? `<label style="display:flex;align-items:center;gap:.4rem;font-size:.72rem;margin:.25rem 0">Aim: <input type="number" min="0" max="20" data-aim value="${aimAp}" style="width:48px;background:var(--c-surface2,#0f172a);color:inherit;border:1px solid var(--c-border2,#475569);border-radius:.3rem;font-size:.72rem;padding:.1rem .3rem"> AP <span style="color:var(--c-text-muted,#94a3b8)">(spent to Aim before the attack)</span></label>` : ''}
                    ${staggered ? `<div style="font-size:.7rem;color:#fca5a5;margin:.25rem 0">You're Staggered: you can't spend AP to Aim, so no Aim AP is counted. Untick Aimed on the weapon for the right attack bonus.</div>` : ''}
                    ${modRows ? `<div style="font-size:.6rem;font-weight:800;text-transform:uppercase;color:var(--c-text-muted,#94a3b8);margin-top:.5rem">Might change the cost</div>${modRows}` : ''}
                    <label style="display:flex;align-items:center;gap:.4rem;font-size:.72rem;margin:.25rem 0">Other change: <input type="number" data-extra value="0" style="width:48px;background:var(--c-surface2,#0f172a);color:inherit;border:1px solid var(--c-border2,#475569);border-radius:.3rem;font-size:.72rem;padding:.1rem .3rem"> AP</label>
                    <div data-ap-total style="margin:.6rem 0 .8rem;font-size:.8rem;font-weight:800"></div>
                    <div class="row"><button data-v="cancel">Cancel</button><button data-v="free" title="Roll without taking AP from your tracker">Roll, don't spend</button><button class="ok" data-v="spend"></button></div>
                </div>`;
                let read = () => {
                    let sel = {};
                    back.querySelectorAll('[data-m]').forEach(el => { sel[el.dataset.m] = el.tagName === 'SELECT' ? (parseInt(el.value) || 0) : el.checked; });
                    let aim = o.aimed ? Math.max(0, parseInt(back.querySelector('[data-aim]')?.value) || 0) : 0;
                    return compute(sel, aim, back.querySelector('[data-extra]').value);
                };
                let upd = () => {
                    let c = read(), short = c.total > have;
                    back.querySelector('[data-ap-total]').innerHTML = `Total: ${c.total} AP${c.aim ? ` <span style="font-weight:600;color:var(--c-text-muted,#94a3b8)">(${c.atk} attack + ${c.aim} Aim)</span>` : ''}`
                        + (short ? `<div style="color:#fca5a5;font-size:.72rem;margin-top:.2rem">Not enough AP: you have ${have}.</div>` : '');
                    let b = back.querySelector('[data-v="spend"]');
                    b.textContent = short ? 'Roll anyway' : `Spend ${c.total} AP & roll`;
                    b.className = short ? 'pri' : 'ok';
                    b.dataset.short = short ? '1' : '';
                    back.querySelector('[data-v="free"]').style.display = short ? 'none' : '';
                };
                back.addEventListener('input', upd); back.addEventListener('change', upd);
                let key = e => { if (e.key === 'Escape') { e.stopPropagation(); done('cancel'); } };
                let done = v => {
                    let c = read();
                    back.remove(); document.removeEventListener('keydown', key, true);
                    if (v === 'cancel') return res(false);
                    if (o.aimed && !staggered) { window.state.aimAp = c.aim; }
                    let short = c.total > have;
                    res(finish(c, v === 'spend' && !short));
                };
                back.querySelectorAll('[data-v]').forEach(b => b.onclick = () => done(b.dataset.v));
                back.addEventListener('mousedown', e => { if (e.target === back) done('cancel'); });
                document.addEventListener('keydown', key, true);
                document.body.appendChild(back);
                upd();
                back.querySelector('[data-v="spend"]').focus();
            });
        };

        function renderWeaponRow(w, idx, opts) {
            let dmgMod = weaponDmgModifier(w, opts.attr);
            let atk = weaponAtkBonus(w, opts.attr);
            let dmgText = fmtDmg(opts.dice, dmgMod);
            let cat = weaponCategory(w);
            let disadvSources = calc.disadv.atkGeneral.concat(cat === 'melee' ? calc.disadv.atkMelee : []);
            let advSources = cat === 'ranged' ? calc.disadv.atkRangedAdv : [];
            // Fortunate Fighter Rank 4: crit multiplier +1
            let critMult = (w.critMult || 2) + ((window.state.perks['luc_fortunatefighter'] || 0) >= 4 ? 1 : 0);
            let rollName = (w.name || 'Weapon') + (opts.label ? (opts.attr === 'STR' && /2-Handed/.test(opts.label) ? ' (2-Handed)' : /Aimed/.test(opts.label) ? ' (Aimed)' : '') : '');
            // What a hit with it can do (Crushing, Stunning, Flurry…): read by the GM's tracker
            let hitMeta = { weapon: w.name || 'Weapon', props: Object.keys(w.properties || {}).filter(k => { let v = w.properties[k]; return typeof v === 'number' ? v > 0 : !!v; }),
                die: '1d' + ((String(opts.dice || '').match(/\d*d(\d+)/) || [0, 6])[1]), strMod: calc.mods.STR || 0, intMod: calc.mods.INT || 0, elec: w.elemental === 'Electric' };
            // pcAttack/apCost/aimed: the sheet's AP hook (apxBeforeAttack) spends AP for this attack
            let atkRoll = apxRollAttr({ type: 'attack', label: rollName, bonus: atk, dice: opts.dice, dmgMod, critMult, dmgType: w.elemental || w.dmgType || '', disSources: disadvSources, advSources,
                pcAttack: true, wcat: cat, apCost: parseInt(opts.ap) || 0, ranged: cat === 'ranged', aimed: cat === 'ranged' && !!w.aimed, unarmed: !!w.isUnarmed,
                wFlurry: !!(w.properties && w.properties.flurry) || undefined, hit: hitMeta });
            // Remember each attack option, so martial powers can roll with the weapon they're used through
            let variant = opts.label ? (/Aimed/.test(opts.label) ? 'aimed' : /2-Handed/.test(opts.label) ? '2h' : '') : '';
            (calc.weaponAttacks = calc.weaponAttacks || []).push({ key: (w.name || 'Weapon') + '|' + variant, label: rollName, bonus: atk, disSources: disadvSources, advSources,
                unarmed: !!w.isUnarmed, innate: !!w.isAncestry, wcat: cat, dice: opts.dice, dmgMod, dmgType: w.elemental || w.dmgType || '', critMult, hit: hitMeta, ap: parseInt(opts.ap) || 0 });
            if (calc.cantAct) {
                // Incapacitated / Unconscious: no attacking until it ends
                let why = calc.cantActLabel;
                atkRoll = ` data-no-roll data-apx-blocked="${why}" title="You're ${why} and can't attack until that ends"`;
            }
            let dmgRoll = apxRollAttr({ type: 'damage', label: rollName + ' damage', formula: opts.dice + (dmgMod ? (dmgMod > 0 ? '+' : '') + dmgMod : ''), dmgType: w.elemental || w.dmgType || '', wcat: cat });
            if (calc.cantAct) dmgRoll = ` data-no-roll data-apx-blocked="${calc.cantActLabel}" title="You're ${calc.cantActLabel} and can't attack until that ends"`;
            let disadvHtml = calc.cantAct
                ? `<span class="text-[8px] text-red-500 font-black block -mt-1 leading-none" title="You can't take actions">(${calc.cantActLabel})</span>`
                : disadvSources.length
                ? `<span class="text-[8px] text-red-400 block -mt-1 leading-none" title="${disadvSources.join(', ')}">(Disadv)</span>`
                : (advSources.length ? `<span class="text-[8px] text-emerald-400 block -mt-1 leading-none" title="${advSources.join(', ')}">(Adv)</span>` : '');

            if (!opts.editable) {
                return `
                    <tr class="bg-slate-800/30 border-b border-slate-700/50">
                        <td class="px-1 py-1 pl-4 text-[10px] text-slate-400 italic" colspan="1">${opts.label}</td>
                        <td class="px-1 py-1 text-[10px] text-slate-400 text-center font-bold">${opts.attr||'STR'}</td>
                        <td class="px-1 py-1"></td>
                        <td class="px-1 py-1 text-center">
                            <div class="font-black text-emerald-400/80 text-xs bg-slate-900 rounded border border-slate-700 py-0.5 apx-rollable" title="Roll attack + damage"${atkRoll}>${atk >= 0 ? '+' + atk : atk}</div>
                            ${disadvHtml}
                        </td>
                        <td class="px-1 py-1 text-center text-[11px] text-slate-300 font-bold apx-rollable" title="Roll damage only"${dmgRoll}>${dmgText}</td>
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
                            : `<input type="text" value="${(w.name||'').replace(/"/g,'&quot;')}" onchange="window.updateWeaponName(${idx}, this.value)" placeholder="Weapon Name" class="bg-slate-900 border-slate-700 text-xs font-bold w-full h-7">`}
                        ${forgedWeaponBadge(w, w.weightClass === 'medium')}
                        ${w.forged ? `<button onclick="window.openWeaponForge(${idx})" class="text-[9px] text-orange-400 hover:text-orange-300 font-bold mt-0.5">Return to Forge</button>` : ''}
                        ${w.category === 'melee' && w.weightClass === 'medium' ? '<div class="text-[9px] text-slate-500 mt-0.5">1-Handed (2H row below)</div>' : ''}
                        ${cat === 'ranged' && opts.editable ? `<label class="flex items-center gap-1 mt-0.5 cursor-pointer"><input type="checkbox" ${w.aimed ? 'checked' : ''} onchange="window.toggleWeaponAim(${idx}, this.checked)" class="w-3 h-3"><span class="text-[9px] ${w.aimed ? 'text-amber-400 font-bold' : 'text-slate-500'}">Aimed (+PER)</span></label>` : ''}
                    </td>
                    <td class="px-1 py-2 w-14">
                        ${cat === 'ranged'
                            ? (() => {
                                let ffRank = window.state.perks['luc_fortunatefighter'] || 0;
                                let isTrained = weaponIsTrained(w);
                                let isHeavyR = w.weightClass === 'heavy';
                                if (ffRank >= 3 && !isTrained) {
                                    let suffix = '';
                                    let atkOpts = [{ val:'AGI', label:`AGI${suffix}` }, { val:'LUC', label:`LUC${suffix}` }];
                                    return `<select onchange="window.updateWeaponAttr(${idx}, this.value)" class="bg-slate-900 border-slate-700 text-[10px] font-bold p-1 h-7 w-20" title="Fortunate Fighter: use LUC instead of AGI for untrained ranged attacks">${atkOpts.map(o=>`<option value="${o.val}" ${w.attr===o.val?'selected':''}>${o.label}</option>`).join('')}</select>`;
                                }
                                return `<div class="text-[10px] font-bold text-slate-300 p-1 h-7 flex items-center justify-center" title="Ranged attack and damage rolls always use AGI${isHeavyR?'; Heavy ranged also adds STR to damage':''}">AGI</div>`;
                              })()
                            : (() => {
                                let isTrained = weaponIsTrained(w);
                                if (w.isCustom) {
                                    return `<select onchange="window.updateWeaponAttr(${idx}, this.value)" class="bg-slate-900 border-slate-700 text-[10px] font-bold p-1 h-7 w-14">${ATTRIBUTES.map(a=>`<option value="${a}" ${a===w.attr?'selected':''}>${a}</option>`).join('')}</select>`;
                                }
                                let ffRank = window.state.perks['luc_fortunatefighter'] || 0;
                                let meleeAttrs = ['STR','AGI'];
                                if (ffRank >= 3 && !isTrained) meleeAttrs.push('LUC');
                                if (!meleeAttrs.includes(w.attr)) { w.attr = 'STR'; }
                                return `<select onchange="window.updateWeaponAttr(${idx}, this.value)" class="bg-slate-900 border-slate-700 text-[10px] font-bold p-1 h-7 w-14">${meleeAttrs.map(a=>`<option value="${a}" ${a===w.attr?'selected':''}>${a}</option>`).join('')}</select>`;
                              })()}
                    </td>
                    <td class="px-1 py-2 text-center"><input type="checkbox" ${weaponIsTrained(w) ? 'checked' : ''} ${w.isUnarmed || w.isAncestry || window.state.trainedWeaponTypes.includes(companionWeaponTypeLabel(w)) ? `disabled title="${(w.isUnarmed || w.isAncestry) ? 'All creatures are inherently trained in their innate weapons' : 'Trained via Weapon Type training'}"` : ''} onchange="window.updateWeaponTr(${idx}, this.checked)" class="w-4 h-4"></td>
                    <td class="px-1 py-2 text-center">
                        <div class="font-black text-emerald-400 text-sm bg-slate-900 rounded border border-slate-700 py-0.5 apx-rollable" title="Roll attack + damage"${atkRoll}>${atk >= 0 ? '+' + atk : atk}</div>
                        ${disadvHtml}
                    </td>
                    <td class="px-1 py-2 text-center text-[11px] text-slate-300 font-bold apx-rollable" title="Roll damage only"${dmgRoll}>${dmgText}</td>
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
            calc.weaponAttacks = [];
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
                    let reachVal = w.properties?.reach;
                    let reachCount = reachVal ? (typeof reachVal === 'number' ? reachVal : 1) : 0;
                    let twoHLabel = '↳ 2-Handed (STR, +1 AP, +1 die step)' + (reachCount ? `, Reach ${reachCount} sq` : '');
                    html += renderWeaponRow(w, idx, { label: twoHLabel, attr: 'STR', dice: twoHDice, ap: 4, editable: false });
                }
                if (isMediumRanged && w.aimed) {
                    // Temporarily enable twoHanded for the calc, then restore — do NOT mutate permanently
                    let wasTwo = w.twoHanded;
                    w.twoHanded = true;
                    html += renderWeaponRow(w, idx, { label: '↳ Aimed (AGI, 2-Handed, 2× PER bonus)', attr: 'AGI', dice: w.dmg, ap: w.ap, editable: false });
                    w.twoHanded = wasTwo;
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
                    // One row per innate weapon (claws, bite, horns...)
                    (sb.innateAttacks && sb.innateAttacks.length ? sb.innateAttacks : [{ name: 'Innate Attack', attackBonus: sb.attackBonus, dmgText: sb.dmgText, typeText: '' }]).forEach((ia, iaIdx) => {
                    html += `
                        <tr class="bg-purple-900/20 border-b border-purple-800/50">
                            <td class="px-1 py-2">
                                <div class="text-xs font-bold text-purple-300">${sb.name} -- ${ia.name}</div>
                                ${ia.typeText ? `<div class="text-[9px] text-slate-500">${ia.typeText}${ia.range > 1 ? ` · Range ${ia.range} sq` : ''}</div>` : ''}
                                ${iaIdx === 0 ? `<button onclick="window.openCompanionDetail()" class="text-[9px] text-purple-400 hover:text-purple-300 font-bold">View Stat Block</button>` : ''}
                            </td>
                            <td class="px-1 py-2 text-center text-[10px] text-slate-400">--</td>
                            <td class="px-1 py-2 text-center"><input type="checkbox" checked disabled class="w-4 h-4 opacity-50"></td>
                            <td class="px-1 py-2 text-center"><div class="font-black text-emerald-400/80 text-sm bg-slate-900 rounded border border-slate-700 py-0.5 apx-rollable" title="Roll attack + damage"${apxRollAttr({ type: 'attack', who: sb.name, label: ia.name, bonus: ia.attackBonus, dice: ia.dmgText, dmgType: ia.typeText, perks: false, gambleAllowed: false })}>+${ia.attackBonus}</div></td>
                            <td class="px-1 py-2 text-center text-[11px] text-slate-300 font-bold apx-rollable" title="Roll damage only"${apxRollAttr({ type: 'damage', who: sb.name, label: ia.name + ' damage', formula: ia.dmgText, perks: false })}>${ia.dmgText}</td>
                            <td class="px-1 py-2 text-center text-[11px] text-blue-400 font-bold">3</td>
                            <td class="px-1 py-2"></td>
                        </tr>
                    `;
                    });
                    if (sb.hasShield) html += `<tr class="bg-purple-900/10 border-b border-purple-800/40"><td colspan="8" class="px-2 py-1 text-[10px] text-purple-200">${sb.name}'s shield is <b>${sb.shieldOn ? 'held' : 'stowed'}</b> (${sb.freeHands} of ${sb.hands} hands free)
                        <button onclick="window.npcToggleShieldEquipped(null)" class="ml-2 px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-white font-bold">${sb.shieldOn ? 'Stow shield' : 'Equip shield'}</button></td></tr>`;
                    sb.equippedWeapons.forEach(w => {
                        if ((w.hands || 1) > sb.freeHands) return;   // two-handed attacks need 2 free hands (shield held)
                        html += `
                            <tr class="bg-purple-900/20 border-b border-purple-800/50">
                                <td class="px-1 py-2 ${w.isTwoHanded ? 'pl-4' : ''}">
                                    <div class="text-xs font-bold text-purple-300">${w.isTwoHanded ? '↳ ' : sb.name + ' -- '}${w.name}</div>
                                    <div class="text-[9px] text-slate-500">${w.typeLabel}${w.attr ? ` (${w.attr})` : ''}</div>
                                    ${w.category === 'ranged' && !w.isTwoHanded ? `<label class="flex items-center gap-1 mt-0.5 cursor-pointer"><input type="checkbox" ${w.aimed ? 'checked' : ''} onchange="window.ncToggleCompanionWeaponAim(${w.weaponIdx}, this.checked)" class="w-3 h-3"><span class="text-[9px] ${w.aimed ? 'text-amber-400 font-bold' : 'text-slate-500'}">Aimed (+PER)</span></label>` : ''}
                                </td>
                                <td class="px-1 py-2 text-center text-[10px] text-slate-400">${w.attr || '--'}</td>
                                <td class="px-1 py-2 text-center"><input type="checkbox" ${w.trained ? 'checked' : ''} disabled class="w-4 h-4 opacity-50" title="Trained: ${w.trained}"></td>
                                <td class="px-1 py-2 text-center"><div class="font-black text-emerald-400/80 text-sm bg-slate-900 rounded border border-slate-700 py-0.5 apx-rollable" title="Roll attack + damage"${apxRollAttr({ type: 'attack', who: sb.name, label: w.name, bonus: w.atk, dice: String(w.dmg), critMult: w.critMult || 2, perks: false, gambleAllowed: false })}>+${w.atk}</div></td>
                                <td class="px-1 py-2 text-center text-[11px] text-slate-300 font-bold apx-rollable" title="Roll damage only"${apxRollAttr({ type: 'damage', who: sb.name, label: w.name + ' damage', formula: String(w.dmg), perks: false })}>${w.dmg}</td>
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
            let fx = (typeof calc !== 'undefined' && calc && calc.itemFx && calc.itemFx.stat) || {};
            if(attr === 'INT') {
                let timesBought = (window.state.pwrIntRanks && window.state.pwrIntRanks[lvl]) ? window.state.pwrIntRanks[lvl] : 0;
                let per = { 1: 3, 2: 2, 3: 2, 4: 1, 5: 1 }[lvl] || 0;
                return Math.max(0, per * timesBought + (fx['slot_' + lvl] || 0));   // + items that grant extra slots
            } else {
                return Math.max(0, (window.state.perks["pwr_cha"] || 0) + (fx.slot_CHA || 0));
            }
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

            let pfx = k => (calc.itemFx && calc.itemFx.stat && calc.itemFx.stat[k]) || 0;
            let atk = mod + window.state.trainingBonus + maxLvl + pfx('powerAtk');
            let dc = 10 + mod + maxLvl + pfx('powerDc');

            document.getElementById('dispPwrAtk').innerText = (atk >= 0 ? '+'+atk : atk);
            calc.powerAtk = atk; calc.powerDc = dc;
            // Clicking "Atk: +X" rolls a power attack
            let atkWrap = document.getElementById('dispPwrAtk').parentElement;
            if (atkWrap && window.APXDice) {
                atkWrap.classList.add('apx-rollable'); atkWrap.style.cursor = 'pointer';
                if (calc.cantAct) {
                    atkWrap.removeAttribute('data-apx-roll'); atkWrap.setAttribute('data-apx-blocked', calc.cantActLabel); atkWrap.title = `You're ${calc.cantActLabel}`;
                } else {
                    atkWrap.removeAttribute('data-apx-blocked');
                    atkWrap.setAttribute('data-apx-roll', JSON.stringify({ type: 'check', kind: 'attack', label: 'Power Attack', who: window.state?.name || '', bonus: atk, omen: true,
                        disSources: (calc.disadv && calc.disadv.atkGeneral) || [] }));
                    atkWrap.title = 'Roll a power attack (d20 ' + (atk >= 0 ? '+' : '') + atk + ')';
                }
            }
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
                let slotMax = Math.max(0, maxLvl + pfx('slot_CHA'));
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

        // A power's D/H value rolls as damage (so High Roller's damage perks apply) or as healing
        function apxPowerDmgHtml(p) {
            let txt = String(p.dmg || '');
            let m = txt.match(/^\s*((?:\d*d\d+)(?:\s*[+-]\s*(?:\d*d\d+|\d+))*)\s*(.*)$/i);
            if (!m || !window.APXDice) return txt;
            let heal = /heal/i.test(m[2]);
            let attr = calc.cantAct ? ` data-no-roll data-apx-blocked="${calc.cantActLabel}"`
                : apxRollAttr({ type: 'damage', label: (p.name || 'Power') + (heal ? ' healing' : ' damage'), formula: m[1].replace(/\s+/g, ''), dmgType: heal ? '' : m[2].trim(), heal: heal || undefined, wcat: 'power' });
            return `<span class="apx-rollable" style="text-decoration:underline dotted;text-underline-offset:2px" title="Click to roll"${attr}>${m[1]}</span> ${m[2]}`;
        }

        // ── Rolling powers ──────────────────────────────────────────────
        // A/S: how the power lands. Attack Roll / Save Negates powers choose one (in the Power
        // Crafter); an Attack Roll is either a Power Attack (d20 + Power Atk) or a martial
        // improvement that rides a normal weapon attack (d20 + that weapon's attack bonus).
        function apxPowerAtkInfo(p) {
            let d = p.draft || {};
            let step = d.step1 || (/save halves/i.test(p.atk || '') ? 'saveHalves' : /guaranteed/i.test(p.atk || '') ? 'guaranteed' : /friendly/i.test(p.atk || '') ? 'friendly' : /hp capacity/i.test(p.atk || '') ? 'hpPool' : 'atkSave');
            if (step === 'saveHalves') return { kind: 'save', text: `Save Halves · DC ${calc.powerDc}` };
            if (step !== 'atkSave') return { kind: 'none', text: p.atk || '-' };
            if (d.atkMode === 'save') return { kind: 'save', text: `Save Negates · DC ${calc.powerDc}` };
            if (d.atkKind === 'martial') {
                let opts = calc.weaponAttacks || [];
                let w = opts.find(x => x.key === d.atkWeapon) || opts.find(x => x.key.split('|')[0] === String(d.atkWeapon || '').split('|')[0]) || opts[0];
                return { kind: 'martial', w, text: w ? `Martial · ${w.label} ${w.bonus >= 0 ? '+' : ''}${w.bonus}` : 'Martial · no weapon' };
            }
            return { kind: 'power', text: `Power Attack ${calc.powerAtk >= 0 ? '+' : ''}${calc.powerAtk}` };
        }
        function apxPowerAtkHtml(p, idx) {
            let info = apxPowerAtkInfo(p);
            let esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
            if (info.kind === 'none' || info.kind === 'save') return esc(info.text);
            let blocked = calc.cantAct ? ` data-no-roll data-apx-blocked="${calc.cantActLabel}"` : '';
            let roll = info.kind === 'power'
                ? apxRollAttr({ type: 'check', kind: 'attack', label: (p.name || 'Power') + ': Power Attack', bonus: calc.powerAtk, omen: true, disSources: (calc.disadv && calc.disadv.atkGeneral) || [] })
                : info.w ? apxRollAttr({ type: 'check', kind: 'attack', label: (p.name || 'Power') + ': ' + info.w.label + ' attack', bonus: info.w.bonus, omen: true, disSources: info.w.disSources, advSources: info.w.advSources }) : '';
            let span = `<span class="apx-rollable" style="text-decoration:underline dotted;text-underline-offset:2px;cursor:pointer" title="Roll the attack (d20)"${blocked || roll}>${esc(info.text)}</span>`;
            if (info.kind !== 'martial') return span;
            // Martial improvement: change the weapon right here (equipment changes between fights)
            let opts = calc.weaponAttacks || [];
            if (opts.length < 2) return span;
            return span + `<select onchange="window.apxSetPowerWeapon(${idx}, this.value)" title="Weapon used for this power's attack" class="block mt-0.5 bg-slate-800 border-slate-700 text-[9px] py-0 w-full">${opts.map(o => `<option value="${esc(o.key)}" ${info.w && o.key === info.w.key ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
        }
        window.apxSetPowerWeapon = function(idx, key) {
            let p = window.state.powers[idx]; if (!p) return;
            p.draft = p.draft || {}; p.draft.atkWeapon = key;
            window.recalculateMath();
        };
        window.apxWeaponAttackOptions = function() { return (calc.weaponAttacks || []).slice(); };
        // Using a power (click "Lvl X | Y AP"): spend its AP, then roll its damage or healing
        // Using a power (click its name or its "Lvl X | Y AP" tag): it takes its AP and a Power Slot
        // (INT: one of its level; CHA: one from the pool), then rolls like a weapon: an attack power
        // rolls the d20 and its damage together (a critical hit doubles the damage dice). Save and
        // Guaranteed powers roll their damage or healing, and anything that needs a saving throw tells
        // the GM (with your Power DC). A power with no roll shows its description.
        function apxPowerDamage(p) {
            let m = String(p.dmg || '').match(/^\s*((?:\d*d\d+)(?:\s*[+-]\s*(?:\d*d\d+|\d+))*)\s*(.*)$/i);
            if (!m) return null;
            let heal = /heal/i.test(m[2]);
            let formula = m[1].replace(/\s+/g, '');
            if (/\+\s*Attr/i.test(m[2])) { let am = calc.mods[window.state.powerAttr] || 0; if (am) formula += (am > 0 ? '+' : '') + am; }
            return { formula, heal, type: m[2].replace(/\+\s*Attr/i, '').replace(/\(Heal\)/i, '').trim() };
        }
        window.apxUsePower = async function(idx) {
            let p = window.state.powers[idx]; if (!p || !window.APXDice) return;
            if (calc.cantAct) { APXDice.notify(`You're ${calc.cantActLabel}, so you can't use powers until that ends.`, { kind: 'warn', open: true }); return; }
            let name = p.name || 'Power', who = window.state.name || '';
            // Power Slot: INT uses a slot of the power's level, CHA one from its pool
            let isCha = window.state.powerAttr === 'CHA', slotKey = isCha ? 'CHA' : (parseInt(p.lvl) || 1);
            let slotMax = getMaxSlotsForLevel(slotKey), slotUsed = window.state.usedPowerSlots[slotKey] || 0;
            let slotLabel = isCha ? 'Power Slot' : `Level ${slotKey} Power Slot`;
            let cost = Math.max(0, parseInt(p.ap) || 0);
            let have = typeof window.apxApCurrent === 'function' ? window.apxApCurrent() : cost;
            // Whatever you have is spent: a slot if one's left, the AP if there's enough. Short on
            // either, you're asked first; "Use anyway" still takes what's there.
            let slotOk = slotUsed < slotMax, apOk = cost <= have;
            let short = [];
            if (!slotOk) short.push(`You have no ${slotLabel}s left (${slotUsed}/${slotMax} used).`);
            if (!apOk) short.push(`It costs ${cost} AP and you have ${have}.`);
            let pay = true;
            if (short.length) {
                let ans = APXDice.ask ? await APXDice.ask(`${name}`, short.join('\n'), [['use', 'Use anyway', 'pri']]) : 'use';
                if (ans !== 'use') return;
                pay = false;
            }
            let notes = [];
            if (apOk && cost > 0) { window.apxSpendAp(cost); notes.push(`-${cost} AP (${window.apxApCurrent()} left)`); }
            else if (!apOk) notes.push(`AP short (needed ${cost}, had ${have})`);
            if (slotOk) { window.state.usedPowerSlots[slotKey] = slotUsed + 1; notes.push(`-1 ${slotLabel} (${Math.max(0, slotMax - slotUsed - 1)} left)`); }
            else notes.push(`no ${slotLabel} left`);
            window.recalculateMath();
            let useNote = notes.join(' · ');
            let info = apxPowerAtkInfo(p), dmg = apxPowerDamage(p);
            let flavor = String(p.desc || '').trim();
            let dc = calc.powerDc;
            let tell = text => { if (typeof window.apxOnRollEvent === 'function') window.apxOnRollEvent({ id: 'pw' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), kind: 'power', label: name, text }); };
            if (info.kind === 'power' || info.kind === 'martial') {
                let bonus = info.kind === 'power' ? calc.powerAtk : (info.w ? info.w.bonus : calc.powerAtk);
                let via = info.kind === 'martial' && info.w ? ` (${info.w.label})` : '';
                let o = { label: name + via, who, bonus, perks: true, gambleAllowed: false, omen: true, power: true, useNote, useWarn: !pay, flavor,
                    disSources: info.kind === 'martial' && info.w ? info.w.disSources : ((calc.disadv && calc.disadv.atkGeneral) || []),
                    advSources: info.kind === 'martial' && info.w ? info.w.advSources : [],
                    hit: info.kind === 'martial' && info.w ? info.w.hit : { weapon: name, props: [] } };
                // A martial improvement rides a normal weapon attack: the weapon's damage plus the power's
                let wpn = info.kind === 'martial' && info.w && info.w.dice ? info.w : null;
                let wf = wpn ? String(wpn.dice) + (wpn.dmgMod ? (wpn.dmgMod > 0 ? '+' : '') + wpn.dmgMod : '') : '';
                if (dmg && !dmg.heal) { o.dice = wf ? wf + '+' + dmg.formula : dmg.formula; o.dmgType = [wpn && wpn.dmgType, dmg.type].filter(Boolean).join(' + '); o.critMult = wpn ? (wpn.critMult || 2) : 2; o.wcat = wpn && wpn.wcat ? wpn.wcat : 'power'; APXDice.attack(o); }
                else if (wpn) { o.dice = wf; o.dmgType = wpn.dmgType; o.critMult = wpn.critMult || 2; o.wcat = wpn.wcat || ''; APXDice.attack(o); }
                else { o.kind = 'attack'; o.note = useNote; APXDice.check(o); }
                tell(`${who || 'A player'} uses ${name}${via}: attack roll.`);
                return;
            }
            let saveKind = info.kind === 'save' ? (/halves/i.test(info.text) ? 'halves' : 'negates') : null;
            let saveText = saveKind ? `Targets make a saving throw against DC ${dc}: a success ${saveKind === 'halves' ? 'halves it' : 'negates it'}.` : '';
            if (dmg) {
                APXDice.damage({ label: name + (dmg.heal ? ' healing' : ' damage'), who, formula: dmg.formula, dmgType: dmg.heal ? '' : dmg.type, heal: dmg.heal || undefined, wcat: 'power',
                    apNote: useNote, apWarn: !pay, note: saveText || null, flavor });
            } else {
                APXDice.info({ label: name, who, text: flavor || 'Power used.', badges: [[pay ? 'info' : 'fum', useNote]].concat(saveText ? [['info', saveText]] : []) });
            }
            tell(saveText ? `${who || 'A player'} uses ${name}. ${saveText}` : `${who || 'A player'} uses ${name}.`);
        };

        function renderPowers() {
            let html = window.state.powers.map((p, idx) => `
                <div class="bg-slate-900 p-2 rounded border border-slate-700 relative group shadow-inner" data-roll-label="${String(p.name||'Power').replace(/"/g,'&quot;')}">
                    <button onclick="window.deletePower(${idx})" class="absolute top-1 right-1 text-red-500 hover:text-red-400 font-bold opacity-0 group-hover:opacity-100">&times;</button>
                    <div class="flex justify-between items-center mb-1">
                        <span class="font-bold text-sm text-indigo-300 cursor-pointer hover:text-indigo-200" onclick="window.apxUsePower(${idx})" title="Use this power: spend its AP and a Power Slot, and roll it">${p.name}</span>
                        <span class="text-[10px] bg-slate-800 px-2 py-0.5 rounded border border-slate-600 text-slate-400 font-bold shadow cursor-pointer hover:border-indigo-400 hover:text-indigo-200" onclick="window.apxUsePower(${idx})" title="Use this power: spend ${p.ap} AP and a Power Slot, and roll it">Lvl ${p.lvl} | ${p.ap} AP</span>
                    </div>
                    <div class="grid grid-cols-3 gap-1 mb-1 text-[10px] text-slate-400">
                        <div><span class="text-slate-500">A/S:</span> ${apxPowerAtkHtml(p, idx)}</div>
                        <div><span class="text-slate-500">R/A:</span> ${p.rng}</div>
                        <div><span class="text-slate-500">D/H:</span> ${apxPowerDmgHtml(p)}</div>
                    </div>
                    <div class="text-[10px] text-slate-500 leading-tight font-medium">${p.desc}</div>
                    ${p.draft ? `<button onclick="window.openPowerEditor(${idx})" class="text-[9px] text-purple-400 hover:text-purple-300 font-bold mt-1">Edit in Power Crafter${p.wasFree ? ' (Free)' : ''}</button>` : ''}
                    ${window.apxRecraftBadge ? window.apxRecraftBadge(p, `window.openPowerEditor(${idx})`) : ''}
                </div>
            `).join('');
            let pc = document.getElementById('powersContainer');
            pc.classList.add('apx-dice-scope');
            pc.innerHTML = html;
        }

