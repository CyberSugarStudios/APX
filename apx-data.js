// ============================================================
// APX Character Sheet — Static Game Data
// Core attribute list, skill list, and the default blank-character
// state shape. Ancestry traits/flaws live here too since they're
// static reference data, same as PERKS_DB (kept in its own file).
// ============================================================
        const ATTRIBUTES = ['STR', 'AGI', 'CON', 'PER', 'INT', 'CHA', 'LUC'];
        const CRAFTING_MATERIAL_INFO = {
            common:   { label: "Common",   wt: 1, val: 1 },
            uncommon: { label: "Uncommon", wt: 2, val: 5 },
            rare:     { label: "Rare",     wt: 5, val: 10 }
        };

        // ------------------------------------------------------------------
        // Conditions, matching the rulebook's Conditions chapter exactly.
        // Fields drive what the sheet automates:
        //   atkDisadvantage: 'general' | 'melee' | undefined
        //   rangedAtkAdvantage: true | undefined     (Prone)
        //   saveDisadvantage: 'all' | ['STR',...] | undefined
        //   checkDisadvantage: 'all' | ['PER','INT'] | undefined
        //   autoFailSaves: ['STR','AGI'] | undefined
        //   speedZero: true | undefined
        //   apZero: true | undefined
        // Anything not automatable this way (ongoing damage, AP-cost
        // doubling, conditional saves against DCs that escalate hourly,
        // etc.) is left as reference text only, same as the sheet has
        // always done for turn-by-turn combat detail.
        // ------------------------------------------------------------------
        const CONDITIONS = [
            { id: "bleedingout", name: "Bleeding Out", desc: "Also Unconscious. Make a CON (Survive) check; you survive half the result (rounded down, min 1) in rounds unless stabilized or healed.",
              apZero: true, autoFailSaves: ['STR','AGI'] },
            { id: "blinded", name: "Blinded", desc: "Auto-fail checks/saves relying on sight. Disadvantage on your own attack rolls; attacks against you have Advantage.",
              atkDisadvantage: 'general' },
            { id: "burning", name: "Burning", desc: "1d8 Fire damage at the start of each of your turns, bypassing ER. 3 AP to extinguish (yourself or an adjacent ally)." },
            { id: "deafened", name: "Deafened", desc: "Auto-fail hearing-based checks; can't perceive spoken language without another means." },
            { id: "dehydrated", name: "Dehydrated", desc: "Past 3x your CON score in hours without water: DC 10+ CON save each hour (DC +2/hour) or gain 1 Fatigue." },
            { id: "diseased", name: "Diseased", desc: "Also Infected. Disadvantage on all attack rolls and attribute checks. Symptoms/progression vary by disease.",
              atkDisadvantage: 'general', checkDisadvantage: 'all' },
            { id: "freezing", name: "Freezing", desc: "2x AP to move. +5 damage taken from Bludgeoning. Past your CON score in hours, gain 1 Fatigue/hour until warmed." },
            { id: "frightened", name: "Frightened", desc: "Disadvantage on all attribute checks and attack rolls while the fear source is visible/audible. Can't willingly move toward it.",
              atkDisadvantage: 'general', checkDisadvantage: 'all' },
            { id: "incapacitated", name: "Incapacitated", desc: "AP reduced to 0; can't take actions, Free Actions, or Reactions. Vulnerable to a Coup de Grace or capture.",
              apZero: true },
            { id: "infected", name: "Infected", desc: "Carries a disease with no symptoms or penalties yet. Becomes Diseased after the incubation period." },
            { id: "paralyzed", name: "Paralyzed", desc: "Also Incapacitated. Can't move or speak. Auto-fail STR/AGI saves. Melee hits within 1 square are automatic Critical Hits.",
              apZero: true, autoFailSaves: ['STR','AGI'] },
            { id: "poisoned", name: "Poisoned", desc: "Disadvantage on all attack rolls and attribute checks. Specific poisons may add further effects.",
              atkDisadvantage: 'general', checkDisadvantage: 'all' },
            { id: "prone", name: "Prone", desc: "Disadvantage on melee attack rolls, Advantage on ranged attack rolls. Crawling costs 2x AP; standing costs 2 AP and ends this.",
              atkDisadvantage: 'melee', rangedAtkAdvantage: true },
            { id: "provoked", name: "Provoked", desc: "Can't willingly move except toward the source of your anger; can't target anyone else with an attack." },
            { id: "restrained", name: "Restrained", desc: "Speed 0; can't spend AP to move. Disadvantage on your own attack rolls and all AGI saves. Attacks against you have Advantage.",
              atkDisadvantage: 'general', saveDisadvantage: ['AGI'], speedZero: true },
            { id: "staggered", name: "Staggered", desc: "2x AP to move. Can't spend AP to Aim. (No Disadvantage.)" },
            { id: "starving", name: "Starving", desc: "Past your CON mod in days without food (min 1 day): DC 10+ CON save each day (DC +2/day) or gain 1 Fatigue." },
            { id: "stunned", name: "Stunned", desc: "Can't spend AP to move; can only speak brief, confused sentences. Auto-fail STR/AGI saves. Attacks against you have Advantage.",
              autoFailSaves: ['STR','AGI'], speedZero: true },
            { id: "suffocating", name: "Suffocating", desc: "Can't regain HP. Gain 2 levels of Fatigue at the start of each of your turns." },
            { id: "unconscious", name: "Unconscious", desc: "Drops held items, falls Prone. Also Incapacitated. Auto-fail STR/AGI saves. Melee hits within 1 square are automatic Critical Hits.",
              apZero: true, autoFailSaves: ['STR','AGI'] }
        ];

        // Base 6 body parts for the Wounded condition. Traits that grant
        // extra limbs add matching extra slots (see calcWoundedSlots()).
        const WOUND_LIMBS_BASE = ["Head", "Torso", "Left Arm", "Right Arm", "Left Leg", "Right Leg"];

        // Per-limb-type Wounded penalties (Ch: Conditions -> Wounded).
        // "Leg" also triggers Staggered (no automatable effect) and, if 2+
        // legs are Wounded, Prone -- handled dynamically in calcWoundEffects().
        const WOUND_LIMB_EFFECTS = {
            Head:  { desc: "Disadvantage on all attack rolls, saving throws, and PER and INT attribute checks.",
                     atkDisadvantage: 'general', saveDisadvantage: 'all', checkDisadvantage: ['PER','INT'] },
            Torso: { desc: "Whenever you take damage, you take one additional die of damage from that source. (Apply manually.)" },
            Arm:   { desc: "Drop whatever's held in that arm. Can't wield two-handed weapons or dual wield. Disadvantage on all attack rolls.",
                     atkDisadvantage: 'general' },
            Leg:   { desc: "Gain the Staggered condition. If both legs are Wounded, you fall Prone and can't Stand Up until at least one leg heals." }
        };

        // ------------------------------------------------------------------
        // NPC Crafter (Chapter 15) -- scoped to the Loyal Companion perk.
        // Threat Points (TP) build a companion's stat block. TP budget and
        // which Steps are unlocked come entirely from the perk's rank
        // (companionStepUnlocks on cha_loyalcompanion), not a free choice.
        // ------------------------------------------------------------------
        const NPC_TIER_TP = [
            { tier: 0, tp: 5, hp: 5 },
            { tier: 1, tp: 10, hp: 10 },
            { tier: 2, tp: 30, hp: 20 },
            { tier: 3, tp: 50, hp: 40 },
            { tier: 4, tp: 80, hp: 70 },
            { tier: 5, tp: 100, hp: 100 }
        ];
        // Beyond Tier 5: +20 TP and +50 HP per additional tier.
        function npcTierForTP(totalTp) {
            let tier = 0, hp = 5;
            NPC_TIER_TP.forEach(t => { if (totalTp >= t.tp) { tier = t.tier; hp = t.hp; } });
            if (totalTp >= 100) {
                let extraTiers = Math.floor((totalTp - 100) / 20);
                tier = 5 + extraTiers;
                hp = 100 + extraTiers * 50;
            }
            return { tier, hp };
        }
        window.npcTierForTP = npcTierForTP;

        // XP awarded for defeating an NPC scales by Tier, not TP -- a
        // separate progression from the TP-budget table above. Straight
        // from the book's Threat System table.
        const NPC_TIER_XP = [5, 15, 30, 50, 75, 105];
        function npcXpForTier(tier) {
            if (tier <= 5) return NPC_TIER_XP[Math.max(0, tier)];
            return 105 + 35 * (tier - 5);
        }
        window.npcXpForTier = npcXpForTier;

        const NPC_SIZES = [
            { key: "small", label: "Small (1x1)", tp: 0, hp: 0, desc: "Halves carrying capacity. +2 AGI (Stealth)." },
            { key: "medium", label: "Medium (1x1)", tp: 0, hp: 0, desc: "No bonuses or penalties." },
            { key: "large", label: "Large (2x2)", tp: 3, hp: 15, desc: "Doubles carrying capacity. +2 STR (Athletics), -2 AGI (Stealth)." },
            { key: "huge", label: "Huge (3x3)", tp: 6, hp: 20, desc: "Quadruples carrying capacity. +4 STR (Athletics), -4 AGI (Stealth)." },
            { key: "gargantuan", label: "Gargantuan (4x4+)", tp: 10, hp: 30, desc: "x8 carrying capacity. +6 STR (Athletics), -6 AGI (Stealth)." }
        ];

        const NPC_SENSES = [
            { key: "nightvision", label: "Nightvision", tp: 1, rep: false, desc: "Low light as bright light; darkness as low light. No color in darkness." },
            { key: "keensenses", label: "Keen Senses (choose a sense)", tp: 1, rep: true, desc: "Advantage on PER (Notice) for one specific sense (Sight, Hearing, or Smell)." },
            { key: "vibration", label: "Vibration Senses", tp: 3, rep: false, desc: "Perceive surroundings without sight, range 8 sq, requires a shared surface." },
            { key: "supernatural", label: "Supernatural Senses", tp: 4, rep: false, desc: "Perceive surroundings without sight, range 8 sq." },
            { key: "blinddeaf", label: "Blind/Deaf", tp: -2, rep: false, desc: "Lacks that sense; auto-fails PER (Notice) checks relying on it." }
        ];

        const NPC_WEAPON_PROPERTIES = [
            { key: "tearing", label: "Tearing", tp: 2 },
            { key: "grappling", label: "Grappling", tp: 2 },
            { key: "ignoreX", label: "Ignore X DR/ER (X = Tier)", tp: 2, tierCalc: (tier) => `At Tier ${tier}: ignores ${tier} DR/ER.` },
            { key: "crushing", label: "Crushing", tp: 4 },
            { key: "flurry", label: "Flurry", tp: 4 },
            { key: "stunning", label: "Stunning", tp: 4 },
            { key: "ignorehalf", label: "Ignore half DR/ER (rounded down)", tp: 4 },
            { key: "ignoreall", label: "Ignore all DR/ER", tp: 8 }
        ];

        const NPC_DIE_STEPS = ["1d4","1d6","1d8","1d10","1d12","2d6","2d8","2d10"];
        const NPC_ADDITIONAL_DIE_COST = { d4: 1, d6: 2, d8: 3, d10: 4, d12: 5 };

        // A reasonable standard set of energy damage types for traits like
        // Regeneration's optional "restrict to one type" option -- not
        // pulled from a specific in-book list, since there isn't a single
        // fixed one already defined elsewhere in this data file.
        const NPC_ENERGY_TYPES = ["Fire", "Cold", "Lightning", "Acid", "Poison", "Radiant", "Necrotic", "Force", "Psychic", "Sonic"];

        const NPC_TRAITS = [
            { key: "quantumlocked", label: "Quantum Locked", tp: -4, desc: "While seen by a conscious hostile creature, turns to stone/phases out: immune to damage/conditions, Speed 0, no AP." },
            { key: "tricky", label: "Tricky", tp: 2, desc: "Movement doesn't provoke attacks of opportunity." },
            { key: "ambusher", label: "Ambusher", tp: 2, desc: "Advantage on attacks against Surprised creatures and on AGI (Stealth) checks." },
            { key: "packtactics", label: "Pack Tactics", tp: 2, desc: "Advantage on attack rolls with a conscious ally within 1 square of the target." },
            { key: "deathburst", label: "Death Burst", tp: 2, desc: "On 0 HP, explodes: creatures within 2 sq make an AGI save (DC 10+X) or take Xd6 chosen Energy damage (X = Tier, min 1, + innate weapon dice).", tierCalc: (tier) => { let x = Math.max(1, tier); return `At Tier ${tier}: ${x}d6 (+ innate weapon dice) damage, DC ${10 + x} AGI save.`; } },
            { key: "maul", label: "Maul", tp: 2, desc: "Deals an additional die of damage to a creature it has grappled with the same innate weapon." },
            { key: "energyblood", label: "Energy Blood", tp: 2, desc: "Melee attackers within 1 sq make an AGI save (DC 10+X) or take Xd6 Energy damage (X = Tier, min 1); a mundane weapon used also takes this damage.", tierCalc: (tier) => { let x = Math.max(1, tier); return `At Tier ${tier}: ${x}d6 damage, DC ${10 + x} AGI save.`; } },
            { key: "vampiric", label: "Vampiric", tp: 3, desc: "Regains HP equal to half the damage dealt (rounded down) with innate melee weapons." },
            { key: "damageaura", label: "Damage Aura", tp: 3, desc: "Creatures ending their turn within 1 sq take Xd6 chosen Energy damage (X = Tier, min 1).", tierCalc: (tier) => { let x = Math.max(1, tier); return `At Tier ${tier}: ${x}d6 damage.`; } },
            { key: "incorporeal", label: "Incorporeal Movement", tp: 3, desc: "Moves through solid objects/creatures as difficult terrain. Ending its turn inside an object deals 1d10 Force damage to it." },
            { key: "shapechanger", label: "Shapechanger", tp: 3, desc: "4 AP: mimic any creature/object of its Size. Advantage on AGI (Stealth)/CHA (Deceive) to pass as that form." },
            { key: "bloodiedfrenzy", label: "Bloodied Frenzy", tp: 4, desc: "At or below half HP: +2 AP at the start of its turn, weapon attacks gain Flurry." },
            { key: "regeneration", label: "Regeneration", tp: 4, desc: "Heals 5 HP per Tier at the start of its turn unless it took Energy damage (+1 TP to restrict to one Energy type).", hasEnergyTypeOption: true, tierCalc: (tier) => `At Tier ${tier}: heals ${5 * tier} HP.` },
            { key: "swallowwhole", label: "Swallow Whole", tp: 4, desc: "Large+ only: 2 AP to swallow a grappled smaller target (Blinded, Restrained, Xd6 Acid/turn, X=Tier). Regurgitates if WT is exceeded.", tierCalc: (tier) => `At Tier ${tier}: ${Math.max(1, tier)}d6 Acid/turn.` },
            { key: "hivemind", label: "Hive Mind", tp: 4, desc: "Telepathic link to others with this trait within 20 sq; shares Surprise and up to 3 banked AP; shares damage evenly among linked creatures." },
            { key: "energyabsorption", label: "Energy Absorption", tp: 5, desc: "Choose an Energy type it's already immune to; regains HP equal to that damage instead." },
            { key: "multiheaded", label: "Multi-Headed", tp: 5, desc: "Large+ only: a Critical Hit/WT-exceeded severs a head; two regrow next turn unless it took Energy damage. +1 AP per head." }
        ];

        // ------------------------------------------------------------------
        // Adventuring Gear (Chapter 8) -- offered as a pick-list when adding
        // an inventory item, alongside Add Custom Item / Add Consumable Item.
        // ------------------------------------------------------------------
        const ADVENTURING_GEAR = [
            // Storage
            { cat: "Storage", name: "Canteen", cost: 5, wt: 5, desc: "Holds sufficient daily water to avoid Dehydration for one creature." },
            { cat: "Storage", name: "Backpack", cost: 20, wt: 5, desc: "Holds 50 lbs within 1 cubic foot of space." },
            { cat: "Storage", name: "Bandolier/Utility Belt", cost: 10, wt: 2, desc: "10 slots for small items. Halves the AP required to draw or stow an item on the belt." },
            // Ammo (20-round bundles)
            { cat: "Ammo", name: "Light Ammo (20)", cost: 5, wt: 1, desc: "For pistols, short bows, hand crossbows, and small throwers." },
            { cat: "Ammo", name: "Medium Ammo (20)", cost: 10, wt: 2, desc: "For hunting rifles, longbows, and tactical carbines." },
            { cat: "Ammo", name: "Heavy Ammo (20)", cost: 20, wt: 4, desc: "For heavy machine guns, massive crossbows, and anti-material rifles." },
            // Survival and Travel
            { cat: "Survival & Travel", name: "Bedroll", cost: 10, wt: 7, desc: "Sleeps a creature. Automatically succeed on saves against extreme cold while resting in it." },
            { cat: "Survival & Travel", name: "Blanket", cost: 5, wt: 3, desc: "Advantage on saves against extreme cold while wrapped in it." },
            { cat: "Survival & Travel", name: "Ration", cost: 5, wt: 2, desc: "Feeds one creature for one day and prevents the Starving condition." },
            { cat: "Survival & Travel", name: "Med Kit", cost: 25, wt: 3, desc: "Advantage on the Help action to stabilize a Bleeding Out creature." },
            { cat: "Survival & Travel", name: "Fire Starter", cost: 10, wt: 1, desc: "1 AP to ignite a small flammable source; 1 minute for larger sources." },
            { cat: "Survival & Travel", name: "Tool Kit", cost: 50, wt: 10, desc: "Required to craft away from a Workbench. Disadvantage on the Craft check." },
            { cat: "Survival & Travel", name: "Breaching Tool", cost: 15, wt: 4, desc: "Advantage on STR (Athletics) to force open doors, windows, or containers." },
            { cat: "Survival & Travel", name: "Portable Shelter", cost: 30, wt: 15, desc: "Safe, enclosed resting space for up to 4 Medium creatures against extreme weather." },
            { cat: "Survival & Travel", name: "Breathing Filter", cost: 30, wt: 2, desc: "Advantage on CON saves to resist airborne toxins, diseases, or gases." },
            { cat: "Survival & Travel", name: "Navigation Aid", cost: 20, wt: 1, desc: "Advantage on CON (Survive) checks to navigate or avoid getting lost." },
            { cat: "Survival & Travel", name: "Magnifying Optics", cost: 40, wt: 2, desc: "Clear vision to 1 mile. Advantage on PER (Notice) or INT (Investigation) for fine/distant detail." },
            { cat: "Survival & Travel", name: "Signal Device", cost: 10, wt: 1, desc: "Visual or auditory signal, noticeable up to 1 mile away." },
            { cat: "Survival & Travel", name: "Climbing Gear", cost: 250, wt: 12, desc: "2 AP to anchor yourself; can't fall more than 5 squares while anchored." },
            { cat: "Survival & Travel", name: "Grappling Hook", cost: 30, wt: 9, desc: "2 AP to throw at a surface within 10 squares; DC 15 AGI (Acrobatics) to secure with rope/cable." },
            { cat: "Survival & Travel", name: "Rope/Cable", cost: 10, wt: 4, desc: "10-square length. 2 AP to tie a knot. DC 20 STR (Athletics), 3 AP to break." },
            { cat: "Survival & Travel", name: "Shield", cost: 50, wt: 6, desc: "+2 AC, DR, ER. One hand. Can perform the Block Combat Maneuver." },
            { cat: "Survival & Travel", name: "Helmet", cost: 30, wt: 3, desc: "+1 AC, DR, ER. Reaction: destroy it to turn a Critical Hit into a normal hit." },
            { cat: "Survival & Travel", name: "Traveling Clothes", cost: 5, wt: 4, desc: "Advantage on checks to endure weather conditions." },
            { cat: "Survival & Travel", name: "Costume Clothes", cost: 30, wt: 4, desc: "Required to make disguises." },
            { cat: "Survival & Travel", name: "Dress Clothes", cost: 50, wt: 3, desc: "Advantage on CHA (Persuade) when negotiating with nobility or the upper class." },
            { cat: "Survival & Travel", name: "Perimeter Alarm", cost: 20, wt: 2, desc: "1 minute to set across a 4-square line. Alerts resting characters if crossed." },
            // Illumination
            { cat: "Illumination", name: "Minor Light", cost: 1, wt: 1, desc: "Bright light 1-sq radius, low light +1 sq. Lasts 8 hours." },
            { cat: "Illumination", name: "Area Light", cost: 50, wt: 6, desc: "Bright light 6-sq radius, low light +6 sq. Fuel (10 Cu) lasts 8 hours." },
            { cat: "Illumination", name: "Directional Light", cost: 200, wt: 2, desc: "6-sq cone bright light, 12-sq cone low light. Fuel (10 Cu) lasts 8 hours." },
            // Security
            { cat: "Security", name: "Restraints", cost: 20, wt: 3, desc: "2 AP to bind a Restrained/Unconscious creature. DC 20 Security or DC 25 Athletics, 3 AP to escape." },
            { cat: "Security", name: "Bypass Kit", cost: 15, wt: 0, desc: "For bypassing mechanical or electronic locks with precision. Breaks on a Critical Failure." }
        ];
        
        const WEAPON_TYPE_TRAININGS = [
            "Light Melee Weapons", "Light Ranged Weapons",
            "Medium Melee Weapons", "Medium Ranged Weapons",
            "Heavy Melee Weapons", "Heavy Ranged Weapons"
        ];

        const SKILLS = [
            { id: "Athletics", name: "Athletics", attr: "STR", pass: true, reqTr: true },
            { id: "Acrobatics", name: "Acrobatics", attr: "AGI", pass: true, reqTr: true },
            { id: "Stealth", name: "Stealth", attr: "AGI", pass: true, reqTr: true },
            { id: "Vehicles", name: "Vehicles", attr: "AGI", pass: true, reqTr: true },
            { id: "Survive", name: "Survive", attr: "CON", pass: true, reqTr: false },
            { id: "Demolitions", name: "Demolitions", attr: "PER", pass: false, reqTr: false },
            { id: "Insight", name: "Insight", attr: "PER", pass: true, reqTr: false },
            { id: "Notice", name: "Notice", attr: "PER", pass: true, reqTr: false },
            { id: "Pickpocket", name: "Pickpocket", attr: "PER", pass: false, reqTr: false },
            { id: "Security", name: "Security", attr: "PER", pass: false, reqTr: false },
            { id: "Craft", name: "Craft", attr: "INT", pass: false, reqTr: false },
            { id: "Investigation", name: "Investigation", attr: "INT", pass: true, reqTr: false },
            { id: "AnimalHandling", name: "Animal Handling", attr: "CHA", pass: true, reqTr: true },
            { id: "Barter", name: "Barter", attr: "CHA", pass: false, reqTr: false },
            { id: "Bribe", name: "Bribe", attr: "CHA", pass: false, reqTr: false },
            { id: "Deceive", name: "Deceive", attr: "CHA", pass: true, reqTr: true },
            { id: "Disguise", name: "Disguise", attr: "CHA", pass: false, reqTr: false },
            { id: "Intimidate", name: "Intimidate", attr: "CHA", pass: true, reqTr: true },
            { id: "Perform", name: "Perform", attr: "CHA", pass: false, reqTr: false },
            { id: "Persuade", name: "Persuade", attr: "CHA", pass: true, reqTr: true },
            { id: "Provoke", name: "Provoke", attr: "CHA", pass: false, reqTr: false },
            { id: "Gamble", name: "Gamble", attr: "LUC", pass: false, reqTr: false },
            { id: "Loot", name: "Loot", attr: "LUC", pass: false, reqTr: false }
        ];

        const getInitialState = () => ({
            name: "",
            languages: "",
            currency: 0,
            unspentXp: 25,
            spentXp: 0,
            currentHp: 25,
            tempHp: 0,
            fatigue: 0,
            restDice: 5,
            luckPts: 1,
            wounds: "",
            conditions: [], // array of active condition ids from CONDITIONS
            woundedLimbs: [], // array of active limb names (Head, Torso, Left Arm, ...)
            savesTrained: { STR: false, AGI: false, CON: false, PER: false, INT: false, CHA: false, LUC: false },
            companion: null, // built via the NPC Crafter, gated by the Loyal Companion perk's rank
            initStat: "AGI",
            powerAttr: "INT",
            baseStats: { STR: 5, AGI: 5, CON: 5, PER: 5, INT: 5, CHA: 5, LUC: 5 },
            ancestry: {
                name: "Human", gpUsed: 0, size: 30, speed: 3, lifespan: "Average",
                bonuses: { STR: 0, AGI: 0, CON: 0, PER: 0, INT: 0, CHA: 0, LUC: 0 },
                traits: [], flaws: [], bonusPerk: null, bonusPerkChoice: null
            },
            origin: {
                name: "", feature: "", wealthApplied: false, commonLanguage: "",
                comps: [
                    { type: null, value: '', skillId: null, customValue: '' },
                    { type: null, value: '', skillId: null, customValue: '' },
                    { type: null, value: '', skillId: null, customValue: '' },
                    { type: null, value: '', skillId: null, customValue: '' }
                ]
            },
            equippedArmor: {
                name: "", wt: 0, ac: 0, dr: 0, er: 0,
                stealthMod: 0, athleticsMod: 0, speedMod: 0,
                mods: { acBonus: 0, drBonus: 0, erBonus: 0, wtReduction: 0, wtIncrease: 0, stealthBonus: 0, athleticsBonus: 0, stealthPenalty: 0, athleticsPenalty: 0, speedPenalty: 0 },
                craftBatches: {}, // per mod key: LIFO stack of {qty, common, uncommon, rare} for material refunds on removal
                paidCost: 0
            },
            craftSkillPref: "INT", // "STR" or "INT" -- which attribute governs Craft checks (requires Black Smith perk)
            freePowersOwed: 0, // banked "make a Power for free" credits from Intelligence Powers rank-ups specifically, not yet spent
            chaFreePowerLevels: [], // Charisma Powers: one entry per Level owed for a brand-new free Power (separate system from freePowersOwed above)
            chaFreeUpgrades: [], // Charisma Powers: [{fromLevel, toLevel}] -- free upgrades owed for an existing Power
            ancestryBonusPerks: [], // [{perkId, choice}] -- one entry per Bonus Perk trait purchase (max 2)
            ancestrySkillAptitudeSkills: [], // one skill id per Skill Aptitude trait purchase, in purchase order -- so removing one instance untrains the right skill
            ancestryEnvResistances: [], // one entry per Environmental Resistance purchase: { type: 'Fire', immune: false } for a new energy type, or { upgradesIndex: N } marking that this purchase upgraded an earlier entry to immunity instead of adding a new type
            ancestryEnvVulnerabilities: [], // one entry per Environmental Vulnerability purchase: { type: 'Fire' } -- simpler than resistance, no immunity-upgrade concept, just a fixed +5 damage per chosen type
            ancestryInnateWeapons: [], // one entry per DISTINCT innate weapon (not per purchase): { name: 'Claws', dmg: '1d6' } -- multiple Innate Weapon purchases can either add a new one of these or upgrade an existing one's die step
            ancestryInnateWeaponLog: [], // one entry per Innate Weapon purchase, in order, so decrementing knows whether to undo a brand-new weapon or a die-step upgrade: { action: 'new', idx: N } or { action: 'upgrade', idx: N } (idx into ancestryInnateWeapons)
            equippedShield: { equipped: false, name: "Shield", ac: 2, dr: 2, er: 2, wt: 6, cost: 50 },
            equippedHelmet: { equipped: false, broken: false, name: "Helmet", ac: 1, dr: 1, er: 1, wt: 3, cost: 30 },
            ancestryFinalTraining: { skills: [], saves: [] }, // the final Ancestry step's 4+INT skills and 2 saving throws
            trainingBonus: 2,
            perks: {},
            perkChoices: {}, 
            pwrIntRanks: {1:0, 2:0, 3:0, 4:0, 5:0},
            customSkills: [],
            items: [
                { name: "Common Crafting Materials", wt: CRAFTING_MATERIAL_INFO.common.wt, ct: 0, val: CRAFTING_MATERIAL_INFO.common.val, isLocked: true },
                { name: "Uncommon Crafting Materials", wt: CRAFTING_MATERIAL_INFO.uncommon.wt, ct: 0, val: CRAFTING_MATERIAL_INFO.uncommon.val, isLocked: true },
                { name: "Rare Crafting Materials", wt: CRAFTING_MATERIAL_INFO.rare.wt, ct: 0, val: CRAFTING_MATERIAL_INFO.rare.val, isLocked: true }
            ],
            craftingMatWeightEnabled: true, // optional rule: untick to ignore Crafting Material weight entirely
            weapons: [{ name: "Unarmed Strike", attr: "STR", tr: true, dmg: "1d4", ap: 2, isUnarmed: true, category: 'melee' }],
            powers: [],
            skillsTrained: {},
            skillSource: {}, // skillId -> 'Origin' | 'Ancestry (Skill Aptitude)' | 'Ancestry (Final Training)' | 'Spend XP' -- purely for the "where did this training come from" tooltip
            trainedWeaponTypes: [], // e.g. "Light Melee Weapons" -- auto-applies training to any equipped weapon of that type
            usedPowerSlots: {1:0, 2:0, 3:0, 4:0, 5:0, 'CHA':0},
            xpHpBought: 0
        });

        const ANCESTRY_TRAITS = [
            { id: "t_innwpn", cost: 1, name: "Innate Weapon", desc: "Claws/fangs. Unarmed strikes deal 1d6 (counts as Light melee).", rep: true },
            { id: "t_inteq", cost: 1, name: "Integrated Equipment", desc: "One piece of gear built into body. Hidden, cannot be disarmed.", rep: true },
            { id: "t_nv", cost: 1, name: "Nightvision", desc: "See in dim/darkness as bright/dim light. No color in darkness." },
            { id: "t_atm", cost: 1, name: "Atmospheric Independence", desc: "Hold breath 2x long. Swim speed = walking speed." },
            { id: "t_skap", cost: 1, name: "Skill Aptitude", desc: "Choose one skill. Gain Training in that skill.", rep: true },
            { id: "t_tail", cost: 1, name: "Prehensile Tail", desc: "Hold objects, support weight. Cannot wield weapon/shield." },
            { id: "t_load", cost: 1, name: "Load-Bearing", desc: "Calculate carrying capacity as if one size category larger." },
            { id: "t_leap", cost: 1, name: "Powerful Leaper", desc: "Jump dist x2. Advantage on STR (Athletics) to jump." },
            { id: "t_arm", cost: 2, name: "Innate Armor", desc: "Thick hide. Permanent +1 to AC per purchase.", rep: true, max: 2 },
            { id: "t_env", cost: 2, name: "Environmental Resistance", desc: "Choose one Energy type. Gain ER 5 against it (or immunity if chosen again).", rep: true },
            { id: "t_sens", cost: 2, name: "Keen Senses", desc: "Gain +5 bonus to PER (Notice) passive and checks." },
            { id: "t_ret", cost: 2, name: "Retractable Defense", desc: "2 AP: Withdraw. +4 AC, Speed 0, cannot attack." },
            { id: "t_stb", cost: 2, name: "Stable Locomotion", desc: "Cannot be knocked prone unless attacker is 1+ size larger. 2x AP to climb." },
            { id: "t_dis", cost: 2, name: "Discharging Internals", desc: "Once/Short Rest, 3 AP: 3d6 Energy damage in 3-sq cone/6-sq line." },
            { id: "t_vert", cost: 2, name: "Vertical Advantage", desc: "Climb speed = walking speed." },
            { id: "t_unal", cost: 3, name: "Unalive Physiology", desc: "Immune to Poison/Disease. Don't eat, sleep, or breathe." },
            { id: "t_bp", cost: 3, name: "Bonus Perk", desc: "Gain one General Perk of your choice.", rep: true, max: 2 },
            { id: "t_comm", cost: 3, name: "Distance Communicator", desc: "Communicate telepathically within 12 squares." },
            { id: "t_fly", cost: 4, name: "Flight", desc: "Fly speed = walking speed. Not if Encumbered/Heavy Armor." },
            { id: "t_poly", cost: 4, name: "Polymelia", desc: "Four arms. Hold 4 items. Craft in half time.", extraArms: 2 },
            { id: "t_reg", cost: 4, name: "Regenerative", desc: "Heal HP = CON mod at start of turn. Stops on Energy damage." }
        ];

        const ANCESTRY_FLAWS = [
            { id: "f_mute", cost: -1, name: "Restricted Speech", desc: "Mute/beeps. Communicate via sign language, telepathy, text." },
            { id: "f_ls", cost: -1, name: "Light Sensitive", desc: "Disadvantage on attacks and PER checks in sunlight." },
            { id: "f_obl", cost: -1, name: "Obvious Locomotion", desc: "Loud/bright. Disadvantage on AGI (Stealth)." },
            { id: "f_env", cost: -2, name: "Environmental Vulnerability", desc: "Take +5 damage from specific Energy type.", rep: true },
            { id: "f_food", cost: -2, name: "Food Dependency", desc: "Must consume specific resource daily. Overrides Unalive." },
            { id: "f_frag", cost: -2, name: "Fragile", desc: "Maximum HP is reduced by 5 per purchase. Can't take if Max HP would drop to 5 or less.", rep: true }
        ];

        // ------------------------------------------------------------------
        // Armor Forge data (Chapter 8: The Armor Forge)
        // Base armor is always present and non-removable. Every other line
        // is a repeatable purchase; `max` is the book's Maximum Purchases
        // column (null = unlimited). `field` says which running total the
        // mod feeds: ac/dr/er/wt affect the character sheet directly,
        // stealth/athletics feed calc.skills, speed feeds calc.speed.
        // ------------------------------------------------------------------
        const ARMOR_BASE = { cost: 50, wt: 10, ac: 1, dr: 1, er: 1 };

        // Ordered so that a column-major 2-column grid (first 5 -> col 1,
        // last 5 -> col 2) reads: AC/DR/ER/weight in one column, Stealth/
        // Athletics/Speed adjustments in the other.
        const ARMOR_MODS = [
            { key: "acBonus",        label: "+1 AC",                          cost: 50,  wt: 10, field: "ac",         amt: 1,  max: 10 },
            { key: "drBonus",        label: "+1 DR",                          cost: 30,  wt: 5,  field: "dr",         amt: 1,  max: 5 },
            { key: "erBonus",        label: "+1 ER",                          cost: 30,  wt: 5,  field: "er",         amt: 1,  max: 5 },
            { key: "wtReduction",    label: "Reduce armor weight by 1 lb",    cost: 15,  wt: -1, field: "wt",         amt: -1, max: null },
            { key: "wtIncrease",     label: "Increase armor weight by 1 lb",  cost: -10, wt: 1,  field: "wt",         amt: 1,  max: null },
            { key: "stealthBonus",   label: "+1 AGI (Stealth)",               cost: 25,  wt: 0,  field: "stealth",    amt: 1,  max: 2 },
            { key: "stealthPenalty", label: "-1 AGI (Stealth)",               cost: -15, wt: 0,  field: "stealth",    amt: -1, max: null },
            { key: "athleticsBonus", label: "+1 STR (Athletics)",             cost: 25,  wt: 0,  field: "athletics",  amt: 1,  max: 2 },
            { key: "athleticsPenalty", label: "-1 STR (Athletics)",           cost: -15, wt: 0,  field: "athletics",  amt: -1, max: null },
            { key: "speedPenalty",   label: "Speed reduced by 1 while worn",  cost: -50, wt: 0,  field: "speed",      amt: -1, max: null }
        ];

        // ------------------------------------------------------------------
        // Weapon Forge data (Chapter 8: The Weapon Forge)
        // ------------------------------------------------------------------
        const WEAPON_BASE = { meleeCost: 25, meleeWt: 2, rangedCost: 50, rangedWt: 4, rangedRangeMult: 2, critMult: 2, range: "5/20" };

        // Cost/weight to move UP one tier from the previous one (cumulative).
        // For Ranged weapons, Currency cost here is doubled per RAW.
        const WEAPON_DMG_TIERS = [
            { label: "2d4 (Base)", dice: "2d4", cost: 0,    wt: 0 },
            { label: "2d6",        dice: "2d6", cost: 100,  wt: 1 },
            { label: "2d8",        dice: "2d8", cost: 250,  wt: 1 },
            { label: "3d10",       dice: "3d10", cost: 500,  wt: 1 },
            { label: "4d12",       dice: "4d12", cost: 1000, wt: 1 }
        ];

        const WEAPON_CRIT_TIERS = [
            { label: "x2 (Base)", mult: 2, cost: 0,    wt: 0 },
            { label: "x3",        mult: 3, cost: 1000, wt: 1 },
            { label: "x4",        mult: 4, cost: 3000, wt: 1 }
        ];

        // Not cumulative -- pick the single best tier you qualify for/can afford.
        const WEAPON_RANGE_TIERS = [
            { label: "5/20 (Base)", range: "5/20",  cost: 0 },
            { label: "8/24",        range: "8/24",  cost: 50 },
            { label: "15/60",       range: "15/60", cost: 150 },
            { label: "20/80",       range: "20/80", cost: 300 },
            { label: "30/120",      range: "30/120", cost: 600 }
        ];

        const WEAPON_WEIGHT_CLASSES = {
            light:  { label: "Light",  apCost: 2, wtChange: 0, hands: 1, maxDmgTier: 2, maxRangeTier: 1, ammo: "Light Ammo" },
            medium: { label: "Medium", apCost: 3, wtChange: 2, hands: 1, maxDmgTier: 3, maxRangeTier: 3, ammo: "Medium Ammo" },
            heavy:  { label: "Heavy",  apCost: 4, wtChange: 4, hands: 2, maxDmgTier: 4, maxRangeTier: 4, ammo: "Heavy Ammo" }
        };

        // reqCheck(ctx) receives { category, weightClass, effectiveDmgType }
        // where effectiveDmgType is "Energy" instead of the physical type
        // once Elemental is selected (you can't be both physical and Energy).
        const WEAPON_PROPERTIES = [
            { key: "concealed", name: "Concealed", cost: 100, desc: "Advantage on AGI (Stealth) checks to hide this weapon. Attacks against a Surprised creature deal an additional die of damage.", reqLabel: "Light Weapon", reqCheck: (ctx) => ctx.weightClass === 'light' },
            { key: "reach", name: "Reach", cost: 100, desc: "You can hit creatures 1 square further than your normal melee range allows.", reqLabel: "Two-Handed Melee Weapon", reqCheck: (ctx) => ctx.category === 'melee' && ctx.weightClass === 'heavy' },
            { key: "thrown", name: "Thrown", cost: 50, desc: "You can throw this weapon to make a ranged attack.", reqLabel: "One-Handed Weapon", reqCheck: (ctx) => ctx.weightClass !== 'heavy' },
            { key: "sturdy", name: "Sturdy", cost: 150, desc: "You can perform the Block Combat Maneuver with this weapon, rolling one damage die as your AC bonus.", reqLabel: "Medium Weapon or heavier", reqCheck: (ctx) => ctx.weightClass === 'medium' || ctx.weightClass === 'heavy' },
            { key: "grappling", name: "Grappling", cost: 200, desc: "When you hit a creature, they are automatically Grappled. The weapon can only attack that creature until the Grapple ends.", reqLabel: "Piercing damage", reqCheck: (ctx) => ctx.effectiveDmgType === 'Piercing' },
            { key: "tearing", name: "Tearing", cost: 200, desc: "When you miss, you still deal 2 damage per damage die (ignoring DR/ER).", reqLabel: "Non-Bludgeoning damage", reqCheck: (ctx) => ctx.effectiveDmgType === 'Piercing' || ctx.effectiveDmgType === 'Slashing' },
            { key: "crushing", name: "Crushing", cost: 300, desc: "On a hit, the target makes a STR save or is knocked Prone. If already Prone, deal an additional die of damage instead.", reqLabel: "Bludgeoning damage", reqCheck: (ctx) => ctx.effectiveDmgType === 'Bludgeoning' },
            { key: "flurry", name: "Flurry", cost: 300, desc: "When you hit, each subsequent attack against that target costs 1 less AP (min 1) until you miss or your turn ends.", reqLabel: "Slashing damage", reqCheck: (ctx) => ctx.effectiveDmgType === 'Slashing' },
            { key: "stunning", name: "Stunning", cost: 400, desc: "On a hit, CON save or Stunned until end of your next turn. If Elemental (Electric), use INT for the attack roll, damage roll, and DC instead.", reqLabel: "Two-Handed Weapon or Energy (Electric)", reqCheck: (ctx) => ctx.weightClass === 'heavy' || ctx.elemental === 'Electric' }
        ];

        const WEAPON_ELEMENTAL_COST = 300;
        const WEAPON_ELEMENTAL_TYPES = ["Fire", "Cold", "Poison", "Electric", "Acid"];

        // ------------------------------------------------------------------
        // Power Crafter data (Chapter 7: Power Crafter Perk)
        // ------------------------------------------------------------------
        const POWER_LEVEL_TABLE = [
            { level: 1, min: 0, max: 25 },
            { level: 2, min: 26, max: 50 },
            { level: 3, min: 51, max: 75 },
            { level: 4, min: 76, max: 125 },
            { level: 5, min: 126, max: 200 }
        ];

        const POWER_STEP1 = [
            { key: "friendly", label: "Friendly/Self", cost: 0, desc: "Targets a willing creature or yourself. Automatically succeeds." },
            { key: "hpPool", label: "HP Capacity Pool", cost: 0, desc: "No damage dealt -- damage dice become an HP pool instead. Affects creatures in the area starting with the lowest current HP; each utility effect costs 10 XP less (min 0) in Step 5." },
            { key: "atkSave", label: "Attack Roll / Save Negates", cost: 0, desc: "You make an attack roll, or the target makes a saving throw to negate the power entirely on a success." },
            { key: "saveHalves", label: "Save Halves", cost: 10, desc: "The target's saving throw halves damage/effects on a success instead of negating them entirely." },
            { key: "guaranteed", label: "Guaranteed Hit", cost: 10, desc: "The power always hits -- no attack roll, no saving throw, and it can never critically hit. The base XP cost per damage die (Step 4) is doubled." }
        ];

        const POWER_STEP2_RANGE = [
            { key: "touch", label: "Touch/Self", cost: 0, desc: "Must target a creature within 1 square of you, or your square is the AoE origin." },
            { key: "short", label: "Short Range", cost: 2, desc: "Can target at a range of up to 10 squares." },
            { key: "long", label: "Long Range", cost: 5, desc: "Can target at a range of up to 30 squares." },
            { key: "extreme", label: "Extreme Range", cost: 10, desc: "You can place the target or origin point anywhere you can see." }
        ];

        const POWER_STEP3_AOE = [
            { key: "single", label: "Single Target", mult: 1, desc: "Affects one target within range." },
            { key: "split", label: "Split Target", mult: 2, desc: "Manually divide damage or healing dice between multiple specific targets within range." },
            { key: "small", label: "Small AoE", mult: 3, desc: "1-sq radius blast, 6-sq line, or 3-sq cone." },
            { key: "medium", label: "Medium AoE", mult: 4, desc: "2-sq radius blast, 12-sq line, or 6-sq cone." },
            { key: "large", label: "Large AoE", mult: 5, desc: "4-sq radius blast, 24-sq line, or 12-sq cone." },
            { key: "massive", label: "Massive AoE", mult: 6, desc: "8-sq radius blast, 48-sq line, or 24-sq cone." }
        ];

        const POWER_DIE_COSTS = { d4: 1, d6: 2, d8: 3, d10: 5, d12: 8 };
        const POWER_DIE_STEPS = ["d4", "d6", "d8", "d10", "d12"];

        // Utility effects. `rep: true` = "*" in the book (selectable multiple
        // times, additive). All costs are per-selection before the HP
        // Capacity Pool discount (Step 1) is applied.
        const POWER_UTILITY = {
            minor: [
                { key: "move2", label: "Move the target (creature/object) up to 2 squares.", cost: 5 },
                { key: "teleport3", label: "Teleport yourself or a willing target up to 3 squares.", cost: 5, rep: true },
                { key: "featherFall", label: "Target falls slowly, immune to fall damage for the duration.", cost: 5 },
                { key: "hover", label: "Target can float horiz./vert., 1 sq per AP spent.", cost: 5 },
                { key: "swimClimb", label: "Grant swim or climb speed equal to walking speed.", cost: 5 },
                { key: "noAoO", label: "Target doesn't provoke Attacks of Opportunity for the duration.", cost: 5 },
                { key: "tempHp5", label: "Target gains Temporary HP equal to 5 x Power Level.", cost: 5, rep: true },
                { key: "sensoryFx", label: "Create a minor auditory/visual/olfactory effect in a 1-sq area.", cost: 5, rep: true },
                { key: "lightDark", label: "Create a zone of bright light or pure darkness (10-sq radius).", cost: 5, rep: true },
                { key: "plus1Roll", label: "+1 bonus to a specific roll type (Atk/Save/Skill) for the duration.", cost: 5, rep: true },
                { key: "plus1Ac", label: "+1 bonus to the target's AC for the duration.", cost: 5, rep: true },
                { key: "speed2", label: "Increase the target's movement speed by 2 squares.", cost: 5, rep: true },
                { key: "condInflictMinor", label: "Inflict or end Staggered, Burning, Deafened, Poisoned, or Prone.", cost: 5 },
                { key: "endBleedInfect", label: "End the Bleeding Out or Infected condition.", cost: 5 },
                { key: "revealOutlines", label: "Reveal outlines of chosen creatures/items in range (works through walls).", cost: 5 },
                { key: "summonGear", label: "Summon any mundane piece of general equipment or a tool.", cost: 5, rep: true },
                { key: "difficultTerrain", label: "Terrain in the AoE becomes Difficult Terrain for the duration.", cost: 5 },
                { key: "bonusAp1", label: "Target gains +1 AP at the start of their next turn.", cost: 5, rep: true },
                { key: "foodWater", label: "Create enough food or water to feed 1 creature.", cost: 5, rep: true },
                { key: "oneWordCommand", label: "Force a simple one-word command at the start of its next turn (can't compel self-harm).", cost: 5 },
                { key: "distributeDmg", label: "Distribute damage evenly between targets (can't be Single Target).", cost: 5 }
            ],
            moderate: [
                { key: "teleport10", label: "Teleport yourself or a willing target up to 10 squares.", cost: 15, rep: true },
                { key: "flySpeed", label: "Target gains a Fly Speed equal to their base walking speed.", cost: 15 },
                { key: "summonWeapon", label: "Summon a magical/hard-light/psychic weapon; use Power Attribute for atk/dmg (max 1 die per Power Level).", cost: 15, rep: true },
                { key: "weaponDmgAdd", label: "Target's weapons/fists deal Step 4 damage as bonus damage instead.", cost: 15 },
                { key: "illusion", label: "Create an illusion or hologram to attempt to deceive.", cost: 15 },
                { key: "wall", label: "Create a solid/hazardous wall up to 4 sq long, 1 sq thick (Step 4 dice = pass-through damage).", cost: 15, rep: true },
                { key: "drEr2", label: "Increase the target's DR or ER by 2 for the duration.", cost: 15, rep: true },
                { key: "condInflictMod", label: "Inflict or end Restrained, Blinded, Freezing, Provoked, or Frightened.", cost: 15 },
                { key: "fatigueDisease", label: "Reduce Fatigue by one level, or end the Diseased condition.", cost: 15 },
                { key: "woundOneLimb", label: "Inflict or end the Wounded condition on one specific limb.", cost: 15 },
                { key: "telepathy", label: "Allow targets to telepathically communicate for the duration.", cost: 15 },
                { key: "resizeOne", label: "Change a target's physical size by one category (grow or shrink).", cost: 15 },
                { key: "readSurfaceThoughts", label: "Read the surface thoughts and immediate intentions of the target.", cost: 15 },
                { key: "influenceOpinion", label: "Influence a target's opinion of you (friendly acquaintance) for the duration.", cost: 15 },
                { key: "loseAp1", label: "Target immediately loses 1 AP.", cost: 15, rep: true },
                { key: "hazardTerrain", label: "Terrain in the AoE deals damage per square walked through (max 2 dice in Step 4).", cost: 15 },
                { key: "sensor", label: "Create an invisible Sensor / hack a camera / project your mind to a location in range.", cost: 15 }
            ],
            major: [
                { key: "dmgHeals", label: "Step 4 damage also heals you or another target for half (rounded down).", cost: 30 },
                { key: "dispel", label: "End an ongoing Power of lower level affecting the target (Reaction: prevent it from being used).", cost: 30 },
                { key: "invisible", label: "Turn the target Invisible.", cost: 30 },
                { key: "condInflictMajor", label: "Inflict or end Stunned, Paralyzed, or Unconscious.", cost: 30 },
                { key: "fatigueZeroWoundAll", label: "Reduce Fatigue to zero, or end the Wounded condition on all limbs.", cost: 30 },
                { key: "complexCommand", label: "Issue a complex, multi-step command the target must follow to the best of its ability.", cost: 30 },
                { key: "memory", label: "Alter, erase, read, or implant a memory in the target's mind.", cost: 30 },
                { key: "ethereal", label: "Turn the target Ethereal/Intangible -- passes through objects, immune to non-Energy damage.", cost: 30 },
                { key: "dmgImmunity", label: "Grant the target complete immunity to one specific damage type.", cost: 30 },
                { key: "summonCreature", label: "Summon a creature (NPC Tier 1) to fight under your control; +15 XP per additional Tier.", cost: 30, rep: true }
            ],
            master: [
                { key: "massTeleport", label: "Teleport yourself and any number of willing creatures to a known/visible location.", cost: 50 },
                { key: "dmgImmuneReflect", label: "Immune to damage for the duration; half of damage you'd take is reflected at the attacker.", cost: 50 },
                { key: "revive", label: "Revive a dead target to 1 HP (dead no longer than 1 minute, unless GM rules otherwise).", cost: 50 },
                { key: "banish", label: "Teleport the target to a harmless location (up to 1 mile/Power Level) for the duration; permanent if extradimensional.", cost: 50 },
                { key: "polymorph", label: "Change a target's physical form entirely into another creature/object (CR <= Power's Level).", cost: 50 },
                { key: "storedItem", label: "Power is stored as a scroll/rune/data drive on use; triggered later with 3 AP or a set condition.", cost: 50 }
            ]
        };

        const POWER_DURATION = [
            { key: "instant", label: "Instant / End of Next Turn", cost: 0 },
            { key: "1min", label: "1 Minute", cost: 5 },
            { key: "10min", label: "10 Minutes", cost: 10 },
            { key: "1hr", label: "1 Hour", cost: 15 },
            { key: "8hr", label: "8 Hours", cost: 20 },
            { key: "24hr", label: "24 Hours", cost: 30 },
            { key: "channel", label: "Channeling (up to 1 Minute)", cost: 35, desc: "Spend half the power's AP cost (rounded down, min 1) on your turn to reapply Step 4 or Step 5 (not both) without using another Power Slot." },
            { key: "permanent", label: "Permanent", cost: 50, desc: "Lasts until dispelled, cured, countered, or destroyed. Ending it is a Free Action." }
        ];
        const POWER_DURATION_MODS = [
            { key: "dmgInterrupt", label: "Damage Interrupt", cost: -5, desc: "Effect ends if the target takes damage (or gets a new save on a failed one)." },
            { key: "actionInterrupt", label: "Action Interrupt", cost: -10, desc: "Effect ends immediately if the target spends AP on a Combat Maneuver or Attack." }
        ];

        const POWER_AP_MODS = [
            { key: "ap4", label: "4 AP (Default)", cost: 0, ap: 4 },
            { key: "ap3", label: "3 AP", cost: 10, ap: 3 },
            { key: "ap2", label: "2 AP", cost: 20, ap: 2 },
            { key: "ap1", label: "1 AP or Reaction", cost: 35, ap: 1 },
            { key: "ap5", label: "5 AP", cost: -5, ap: 5 },
            { key: "ap6", label: "6 AP", cost: -10, ap: 6 },
            { key: "lengthy", label: "Lengthy Cast Time (1 full minute, unmodified AP)", cost: -15, ap: 4 }
        ];

        const POWER_REFUNDS = [
            { key: "minorRestriction", label: "Minor Restriction", cost: -5, desc: "A minor condition (light/darkness, a loud noise, a chant, specific gestures) must be met to cast it." },
            { key: "concentration", label: "Concentration", cost: -10, desc: "Spend 2 AP each turn to maintain it; taking damage forces a CON save (DC 10 or half damage) to keep it active." },
            { key: "overexertion", label: "Overexertion", cost: -15, desc: "You gain 1 level of Fatigue after the power ends." },
            { key: "sacrifice", label: "Sacrifice", cost: -20, desc: "Using it deals 1d10 damage per Power Level to you, unpreventable and unmitigable." }
        ];
        // Costly is a slider (GM sets the exact refund, -5 to -20).
