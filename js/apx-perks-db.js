// ============================================================
// APX Character Sheet — Perk Database
// ============================================================
        const PERKS_DB = [
            // STR PERKS
            { id: "str_martialarts", name: "Martial Arts", attr: "STR", max: 5, baseDesc: "Unarmed strike damage increases 1 step per rank (1d4 > 1d6 > 1d8 > 1d10 > 1d12 > 2d6).", ranks: [
                "Rank 1. Unarmed attacks cost 1 AP. Combat maneuver AP cost reduced by 1 (min 1).",
                "Rank 2. Consecutive attacks total damage before resistances. Strikes gain Sturdy property. Can counter-attack on successful block.",
                "Rank 3. Critical range increases to 19-20. Unarmed maneuvers no longer suffer Disadvantage.",
                "Rank 4. Critical range increases to 18-20. Unarmed strikes gain Crushing property.",
                "Rank 5. Critical hits force CON save or Paralyze target until end of next turn."
            ]},
            { id: "str_meleeprowess", name: "Melee Prowess", attr: "STR", max: 5, baseDesc: "+1 bonus to melee attack/damage rolls per rank.", ranks: [
                "Rank 1. Bludgeoning gains Crushing, Slashing gains Flurry, Piercing gains Tearing.",
                "Rank 2. Roll damage twice and keep the highest total.",
                "Rank 3. Maneuvers that normally impose Disadvantage no longer do so.",
                "Rank 4. Combat maneuvers with melee weapons gain Advantage.",
                "Rank 5. On Critical hit, roll attack again. If hits, deal maximum possible critical damage."
            ], effect: (c, r) => { c.bonusMeleeAtk += r; c.bonusMeleeDmg += r; } },
            { id: "str_armormaster", name: "Armor Master", attr: "STR", max: 5, baseDesc: "Mastery over wearing armor.", ranks: [
                "Rank 1. Equip/remove armor in half time.",
                "Rank 2. Choose Lightly, Moderately, or Heavily armored. While wearing it, gain +1 AC and +1 DR.",
                "Rank 3. While at least Lightly armored, Speed increases by +1.",
                "Rank 4. While Moderately armored, Max AC from AGI increases by 1. Armor penalties reduced by rank.",
                "Rank 5. While Heavily armored, gain +3 DR."
            ], choiceOptions: ['Lightly', 'Moderately', 'Heavily'], choiceAtRank: 2 },
            { id: "str_blacksmith", name: "Black Smith", attr: "STR", max: 5, baseDesc: "+1 bonus to Craft checks per rank.", ranks: [
                "Rank 1. Use STR instead of INT for armor/melee weapon crafting.",
                "Rank 2. Recover half materials on failed craft check.",
                "Rank 3. Apply 1 modification to new melee weapon/armor for 0 Currency.",
                "Rank 4. Craft with STR in half time.",
                "Rank 5. Currency cost of melee/armor mods halved. Ignore max purchase limit on +1 AC/DR/ER."
            ], effect: (c, r) => { c.skills.Craft = (c.skills.Craft||0)+r; } },
            { id: "str_brute", name: "Brute", attr: "STR", max: 5, baseDesc: "+1 bonus to STR (Athletics) per rank.", ranks: [
                "Rank 1. Considered 1 Size larger for carrying/pushing. Deal double damage to objects.",
                "Rank 2. No movement penalty when grappling. 2 AP to end grapple by throwing target.",
                "Rank 3. Range of thrown/improvised weapons doubled.",
                "Rank 4. Moving in straight line can auto-break doors/windows, knock enemies Prone.",
                "Rank 5. 3 AP: Strike ground with Heavy weapon. 2-sq radius AGI save or take STR damage and fall Prone."
            ], effect: (c, r) => { c.skills.Athletics = (c.skills.Athletics||0)+r; c.sizeMultBoost += 1; } },

            // AGI PERKS
            { id: "agi_stealth", name: "Stealth", attr: "AGI", max: 5, baseDesc: "+1 bonus to AGI (Stealth) per rank.", ranks: [
                "Rank 1. Can enter stealth lightly obscured.",
                "Rank 2. Move at full speed without losing stealth.",
                "Rank 3. Remain in stealth moving across line of sight if ending hidden.",
                "Rank 4. Treat rolls of 2-9 on Stealth checks as a 10.",
                "Rank 5. Attacking from stealth and dropping target to 0 HP (or missing) keeps you in stealth."
            ], effect: (c, r) => { c.skills.Stealth = (c.skills.Stealth||0)+r; } },
            { id: "agi_flurry", name: "Flurry", attr: "AGI", max: 5, baseDesc: "+1 damage per consecutive weapon hit. Resets on miss or turn end.", ranks: [
                "Rank 1. Weapon hit reduces AP of next attack by 1 (min 1).",
                "Rank 2. Weapon hit allows 1 sq free movement (no opportunity attacks).",
                "Rank 3. AP reduction stacks up to 2 times.",
                "Rank 4. Missing no longer resets AP reduction or damage bonus.",
                "Rank 5. Critical hits refund their AP cost."
            ]},
            { id: "agi_mobile", name: "Mobile", attr: "AGI", max: 5, baseDesc: "+1 AC per rank until next turn when spending AP to move (once/round).", ranks: [
                "Rank 1. Ignore difficult terrain penalties.",
                "Rank 2. Move through occupied squares (cannot end there).",
                "Rank 3. AGI save for half damage instead takes 0 damage on success.",
                "Rank 4. Movement does not provoke attacks of opportunity.",
                "Rank 5. Traverse vertical surfaces, ceilings, liquids unharmed. Must end on solid ground."
            ]},
            { id: "agi_ambusher", name: "Ambusher", attr: "AGI", max: 5, baseDesc: "+1 damage per rank against unaware targets.", ranks: [
                "Rank 1. Advantage vs Surprised/unacted creatures.",
                "Rank 2. Hitting from stealth Staggers target.",
                "Rank 3. Attacks from stealth bypass DR and ER.",
                "Rank 4. Critical Multiplier +1 when attacking from stealth.",
                "Rank 5. Hit from stealth allows spending 2 AP to auto-crit."
            ]},
            { id: "agi_relentless", name: "Relentless", attr: "AGI", max: 5, baseDesc: "Regain AP equal to rank when reducing target to 0 HP (limited uses/rest).", ranks: [
                "Rank 1. Once/turn, 1 AP non-attack action costs 0 AP.",
                "Rank 2. Ranged attacks suffer no penalty in Short Range.",
                "Rank 3. Once/turn, 3 AP non-attack action costs 0 AP.",
                "Rank 4. Gain one additional Reaction per round.",
                "Rank 5. Gain 4 AP at start of combat."
            ]},

            // CON PERKS
            { id: "con_survivalist", name: "Survivalist", attr: "CON", max: 5, baseDesc: "+1 bonus to CON (Survive) per rank.", ranks: [
                "Rank 1. Need half food/water. Can eat raw/toxic food safely.",
                "Rank 2. Advantage on CON saves vs weather/hazards. Cannot get lost naturally.",
                "Rank 3. Ignore non-magical difficult terrain. Short Rest reduces Fatigue by 1.",
                "Rank 4. Fast travel causes no Stealth/Notice penalties. Leave no track.",
                "Rank 5. Allies traveling with you gain benefits of Ranks 1-4."
            ], effect: (c, r) => { c.skills.Survive = (c.skills.Survive||0)+r; } },
            { id: "con_ironclad", name: "Ironclad", attr: "CON", max: 5, baseDesc: "+1 DR and ER per rank.", ranks: [
                "Rank 1. Advantage on saves vs poison and disease.",
                "Rank 2. +1 Wound Threshold per rank.",
                "Rank 3. Once/round (Reaction): gain DR/ER equal to CON Score against one attack.",
                "Rank 4. Attacks bypassing DR/ER only bypass half of it.",
                "Rank 5. 1 AP: End Wounded condition on one limb (uses = rank/rest)."
            ], effect: (c, r) => { c.dr += r; c.er += r; c.wtBoost += r; } },
            { id: "con_vitality", name: "Vitality", attr: "CON", max: 5, baseDesc: "+5 Maximum HP per rank.", ranks: [
                "Rank 1. Regain additional HP equal to CON mod when healed.",
                "Rank 2. Bleed Out timer uses full CON (Survive) check result, not half.",
                "Rank 3. Healing dice automatically grant maximum possible value.",
                "Rank 4. Dropping to 0 HP drops to 1 HP instead (Once/Full Rest).",
                "Rank 5. Immune to diseases/poisons, no longer age."
            ], effect: (c, r) => {  } },
            { id: "con_defensive", name: "Defensive", attr: "CON", max: 5, baseDesc: "While unarmored, +1 AC, DR, ER per rank.", ranks: [
                "Rank 1. Unarmored AC = 10 + AGI mod + CON mod.",
                "Rank 2. Advantage on checks vs being held/forcefully moved.",
                "Rank 3. Enemy missing melee attack pays +1 AP for next attack against you.",
                "Rank 4. Unarmored DR/ER vs traps/hazards/falling increases by CON score.",
                "Rank 5. Unarmored (Reaction): Turn Critical Hit against you into normal hit."
            ], effect: (c, r) => { c.defensiveRank = r; } },
            { id: "con_frenzy", name: "Frenzy", attr: "CON", max: 5, baseDesc: "While Provoked, +1 melee damage per rank.", ranks: [
                "Rank 1. Free Action: Voluntarily become Provoked by specific enemy.",
                "Rank 2. First damage from anger source grants AP = rank.",
                "Rank 3. While Provoked, immune to Frightened, Staggered, Stunned.",
                "Rank 4. Can use Reaction to follow moving source. Reassign source if they die.",
                "Rank 5. Dropping to 0 HP while Provoked doesn't cause Unconscious. If source dies, regain 1 HP."
            ]},

            // PER PERKS
            { id: "per_dangersense", name: "Danger Sense", attr: "PER", max: 5, baseDesc: "+1 Initiative, Notice, Insight per rank.", ranks: [
                "Rank 1. 1 AP: Insight vs AC to learn target HP, AC, DR, ER, or top stats.",
                "Rank 2. Cannot be Surprised.",
                "Rank 3. Auto-stop movement before stepping on hidden trap/hazard.",
                "Rank 4. Unseen attackers do not gain Advantage.",
                "Rank 5. Auto-sense creatures within 3 squares on same ground through walls."
            ], effect: (c, r) => { c.init += r; c.skills.Notice = (c.skills.Notice||0)+r; c.skills.Insight = (c.skills.Insight||0)+r; } },
            { id: "per_sharpshooter", name: "Sharpshooter", attr: "PER", max: 5, baseDesc: "+1 attack/damage with ranged weapons per rank.", ranks: [
                "Rank 1. Ignore Partial and Half Cover.",
                "Rank 2. Roll ranged damage twice, keep highest.",
                "Rank 3. Ignore 3/4 Cover. Killing target lets attack pierce to enemy behind.",
                "Rank 4. Aim action bonus doubled.",
                "Rank 5. Critical hit allows second attack roll; if it hits, deal max critical damage."
            ], effect: (c, r) => { c.bonusRangedAtk += r; c.bonusRangedDmg += r; } },
            { id: "per_lightfingers", name: "Light Fingers", attr: "PER", max: 5, baseDesc: "+1 Pickpocket per rank.", ranks: [
                "Rank 1. Advantage to conceal items on person.",
                "Rank 2. Pickpocket in combat no longer imposes Disadvantage.",
                "Rank 3. Advantage on Disarm maneuver. Can use Pickpocket vs AC instead.",
                "Rank 4. 2 AP: Contested steal check against enemy belt/pocket in combat.",
                "Rank 5. Disarm costs 1 less AP. Auto-catch item, no opportunity attack on fail."
            ], effect: (c, r) => { c.skills.Pickpocket = (c.skills.Pickpocket||0)+r; } },
            { id: "per_infiltrator", name: "Infiltrator", attr: "PER", max: 5, baseDesc: "+1 Security per rank.", ranks: [
                "Rank 1. Advantage finding hidden compartments/traps/sensors.",
                "Rank 2. Security checks in combat do not impose Disadvantage.",
                "Rank 3. First failed Security check can be re-rolled (unless Crit Fail).",
                "Rank 4. 1 AP: Auto-know DC of lock/trap, gain Advantage to bypass.",
                "Rank 5. Once/Full Rest, 6 AP: Auto-succeed any Security check with bonus perks."
            ], effect: (c, r) => { c.skills.Security = (c.skills.Security||0)+r; } },
            { id: "per_demolitions", name: "Demolitions", attr: "PER", max: 5, baseDesc: "+1 Demolitions and +1 Explosive Save DC per rank.", ranks: [
                "Rank 1. Auto-succeed saves vs your own explosives/traps.",
                "Rank 2. Targets failing explosive saves suffer condition (Burning/Stunned/etc).",
                "Rank 3. 2 AP: Jury-rig explosive triggers (contact, tripwire, etc).",
                "Rank 4. Double explosion AoE or change shape (cone/line).",
                "Rank 5. Reroll 1s and 2s on explosive damage. Double damage to structures."
            ], effect: (c, r) => { c.skills.Demolitions = (c.skills.Demolitions||0)+r; } },

            // INT PERKS
            { id: "int_medic", name: "Medic", attr: "INT", max: 5, baseDesc: "Healing output increased by (Rank x 2).", ranks: [
                "Rank 1. Med item AP cost reduced by 1 (min 1).",
                "Rank 2. Can remove conditions (Poison, Staggered, etc) instead of raw healing.",
                "Rank 3. Removing a condition also restores half the normal HP amount.",
                "Rank 4. Overhealing converts into Temporary HP.",
                "Rank 5. Once/Full Rest, 6 AP: Full heal target, clear conditions, or revive dead (1 min limit)."
            ]},
            { id: "int_artisan", name: "Artisan", attr: "INT", max: 5, baseDesc: "+1 Crafting per rank. Max XP for Consumables +5 per rank.", ranks: [
                "Rank 1. Choose craft spec. No Disadvantage using Toolkit instead of Workbench.",
                "Rank 2. Spec items cost half Crafting Materials.",
                "Rank 3. Recover half materials on failed check.",
                "Rank 4. Second spec. Craft specs in half time.",
                "Rank 5. Third spec. Once/combat, 3 AP: Insta-craft and use consumable from inventory."
            ], effect: (c, r) => { c.skills.Craft = (c.skills.Craft||0)+r; }, textChoice: true, choiceAtRanks: [1, 4, 5] },
            { id: "int_scholar", name: "Scholar", attr: "INT", max: 5, baseDesc: "+1 to all Encyclopedia checks per rank.", ranks: [
                "Rank 1. Perfect recall (1 month). Advantage identifying creatures/items.",
                "Rank 2. 2 AP: Encyc check vs AC. Success adds INT score to next ally attack damage.",
                "Rank 3. 1 min observing language grants basic communication ability.",
                "Rank 4. Rank 2 feature also grants Advantage and ignores DR/ER = Rank.",
                "Rank 5. Rank 2 feature 24-hr immunity removed. Can spam on same target."
            ], effect: (c, r) => { 
                Object.keys(c.skills).forEach(k => {
                    if(k.startsWith('Encyclopedia')) c.skills[k] += r;
                });
            } },
            { id: "int_investigator", name: "Investigator", attr: "INT", max: 5, baseDesc: "+1 Investigation per rank.", ranks: [
                "Rank 1. 1 min exam reveals creature count, sizes, timeline of past 24 hrs.",
                "Rank 2. Investigation vs Insight reveals emotions and hidden weapons.",
                "Rank 3. Treat rolls of 2-9 on Investigation as a 10.",
                "Rank 4. Reaction: Add INT score to ally's check/save (Uses = Rank/Rest).",
                "Rank 5. Once/combat, Reaction: Auto-miss incoming attack or auto-succeed save by deducing plan."
            ], effect: (c, r) => { c.skills.Investigation = (c.skills.Investigation||0)+r; } },
            { id: "int_tactician", name: "Tactician", attr: "INT", max: 5, baseDesc: "Allies in earshot gain +1 Initiative per rank.", ranks: [
                "Rank 1. Once/combat, 2 AP: Swap ally/enemy initiative order (cures Surprise).",
                "Rank 2. Reaction on hit: Grant ally free Reaction to make weapon attack on same target.",
                "Rank 3. 3 AP: Three allies move up to speed as Free Action (no opportunity attacks).",
                "Rank 4. Reaction on enemy miss: Grant ally 2 AP.",
                "Rank 5. Once/combat: Skip your turn to grant immediate, full extra turn to ally."
            ], effect: (c, r) => { c.init += r; } },

            // CHA PERKS
            { id: "cha_loyalcompanion", name: "Loyal Companion", attr: "CHA", max: 5, baseDesc: "Gain a loyal companion (pet/drone) built with Threat Points.", ranks: [
                "Rank 1. Companion built with a baseline of 10 TP, restricted to Steps 1-5 of the NPC Crafter. Extra TP costs 20 XP each.",
                "Rank 2. Companion instantly gains +5 TP, and you unlock Step 6 (Powers). Extra TP now costs 15 XP each.",
                "Rank 3. Companion instantly gains +5 TP, and you unlock Step 7 (Traits). Extra TP now costs 10 XP each.",
                "Rank 4. Companion instantly gains +10 TP. Extra TP now costs 5 XP each. You may choose one Step 7 trait costing 4 TP or less that your companion possesses and gain its effects yourself, using your companion's Tier for any of its calculations.",
                "Rank 5. Companion instantly gains +10 TP. Once per round, when your companion reduces a creature to 0 HP, you immediately gain 2 AP. Once per round, when you reduce a creature to 0 HP, your companion immediately gains 2 AP."
            ], companionStepUnlocks: { 1: 5, 2: 6, 3: 7, 4: 7, 5: 7 } },
            { id: "cha_leadership", name: "Leadership", attr: "CHA", max: 5, baseDesc: "Projects aura (Radius = Rank x 2 sq).", ranks: [
                "Rank 1. Allies in aura gain +1 to all saves per rank.",
                "Rank 2. Help action AP reduced by 1. Grants Temp HP = CHA score.",
                "Rank 3. After Rest, party gains Temp HP = CHA score.",
                "Rank 4. Allies in aura immune to Frightened/Provoked.",
                "Rank 5. Once/combat (Reaction): Ally dropping to 0 HP drops to 1 HP instead, gains massive Temp HP, free move."
            ]},
            { id: "cha_silvertongue", name: "Silver Tongue", attr: "CHA", max: 5, baseDesc: "+1 to choice of Barter, Bribe, or Persuade per rank.", ranks: [
                "Rank 1. Advantage on Persuade/Barter with neutral NPCs.",
                "Rank 2. Hostile NPCs decline bribes politely. Crit Bribe = free tip/favor.",
                "Rank 3. Bypass language barriers through body language/tone.",
                "Rank 4. Treat rolls of 2-9 as a 10 for Barter/Bribe/Persuade.",
                "Rank 5. Flashback: Retroactively declare you bribed/convinced an obstacle NPC off-screen."
            ], choiceOptions: ['Barter', 'Bribe', 'Persuade'], effect: (c, r, choices) => {
                if(choices) {
                    for(let i=1; i<=r; i++) {
                        let skill = choices[i];
                        if(skill) c.skills[skill] = (c.skills[skill]||0) + 1;
                    }
                }
            }},
            { id: "cha_charlatan", name: "Charlatan", attr: "CHA", max: 5, baseDesc: "+1 choice of Deceive, Disguise, Perform per rank.", ranks: [
                "Rank 1. Create disguise in 1 minute.",
                "Rank 2. 2 AP: CHA check vs AC. Success = target has Disadv against you.",
                "Rank 3. Flawless voice mimic. Disguise checks suffer Disadvantage.",
                "Rank 4. Reaction on damage: Play dead/Prone. Enemies ignore you. Next attack from Prone is auto-crit.",
                "Rank 5. Plant subconscious commands during conversation (Deceive vs Insight)."
            ], choiceOptions: ['Deceive', 'Disguise', 'Perform'], effect: (c, r, choices) => {
                if(choices) {
                    for(let i=1; i<=r; i++) {
                        let skill = choices[i];
                        if(skill) c.skills[skill] = (c.skills[skill]||0) + 1;
                    }
                }
            }},
            { id: "cha_instigator", name: "Instigator", attr: "CHA", max: 5, baseDesc: "+1 choice of Intimidate or Provoke per rank.", ranks: [
                "Rank 1. Advantage on Intimidate and Provoke.",
                "Rank 2. No Disadvantage using CHA skills in combat. Target not immune on fail.",
                "Rank 3. Target Frightened/Provoked takes extra damage die, weapon crit mult +1.",
                "Rank 4. Provoke target onto another ally. Combat CHA checks cost -1 AP.",
                "Rank 5. Killing Provoked/Frightened target triggers mass fear/provoke check on enemies."
            ], choiceOptions: ['Intimidate', 'Provoke'], effect: (c, r, choices) => {
                if(choices) {
                    for(let i=1; i<=r; i++) {
                        let skill = choices[i];
                        if(skill) c.skills[skill] = (c.skills[skill]||0) + 1;
                    }
                }
            }},

            // LUC PERKS
            { id: "luc_omen", name: "Omen", attr: "LUC", max: 5, baseDesc: "Manipulate fate with Omen Dice.", ranks: [
                "Rank 1. Roll 1d20 after Full Rest. Substitute it for any roll later.",
                "Rank 2. Can add/sub LUC mod from expended Omen Die.",
                "Rank 3. Nat 1/20 can be banked into Omen Die. Gain 2 Omen Dice/Rest.",
                "Rank 4. Gain 3 Omen Dice/Rest.",
                "Rank 5. Do not roll. Automatically get a 1, a 10, and a 20."
            ]},
            { id: "luc_treasurehunter", name: "Treasure Hunter", attr: "LUC", max: 5, baseDesc: "+1 Loot checks per rank.", ranks: [
                "Rank 1. Advantage on LUC (Loot).",
                "Rank 2. Find bonus Currency = Loot roll result. Crit finds double.",
                "Rank 3. Crit Loot finds map/note to hidden stash.",
                "Rank 4. Spend Luck Points to find extra Crafting Materials.",
                "Rank 5. Once/session: Miraculously pull needed mundane item from bag."
            ], effect: (c, r) => { c.skills.Loot = (c.skills.Loot||0)+r; } },
            { id: "luc_fortunatefighter", name: "Fortunate Fighter", attr: "LUC", max: 5, baseDesc: "Luck keeps you alive.", ranks: [
                "Rank 1. +AC equal to LUC mod (min 1).",
                "Rank 2. Once/turn: Add LUC mod to damage.",
                "Rank 3. Substitute LUC mod for attack AND damage rolls with weapons you're untrained in. Once/combat: add LUC to a missed attack roll, possibly turning it into a hit.",
                "Rank 4. Crit multiplier increased by 1.",
                "Rank 5. Once/turn: Spend Luck Point to auto-crit on hit."
            ], effect: (c, r) => { c.lucAc = true; } },
            { id: "luc_highroller", name: "High Roller", attr: "LUC", max: 5, baseDesc: "Massive risks for massive rewards.", ranks: [
                "Rank 1. Gamble: Attack with uncancelable Disadvantage. +10 damage on hit.",
                "Rank 2. Reroll 1s and 2s on all damage.",
                "Rank 3. Spend Luck Point to reroll d20 with Advantage/Disadvantage.",
                "Rank 4. Landing a Gamble (Rank 1) grants +1 AP.",
                "Rank 5. Once/Full Rest: Exploding Dice (max rolls roll again and add)."
            ]},
            { id: "luc_foolsluck", name: "Fool's Luck", attr: "LUC", max: 5, baseDesc: "Fail forward.", ranks: [
                "Rank 1. Natural 1 grants 1 Luck Point.",
                "Rank 2. Once/combat: Slip Prone to force an attack to miss.",
                "Rank 3. Once/combat: Accidental Success. Miss deals half damage via ricochet/mishap.",
                "Rank 4. Falling Prone/forced move grants +2 AC until next turn.",
                "Rank 5. No Prone penalties. 0 AP to stand. Reaction from Rank 2 miss is an auto-crit."
            ]},

            // GENERAL PERKS
            { id: "gen_agile", name: "Agile", attr: "GEN", max: 1, baseCost: 10, baseDesc: "+1 bonus to AC.", ranks: ["+1 bonus to AC."], effect: (c) => { c.ac += 1; } },
            { id: "gen_educated", name: "Educated", attr: "GEN", max: 1, baseCost: 10, baseDesc: "Gain 1 extra XP whenever you gain XP.", ranks: ["Gain 1 extra XP whenever you gain XP."] },
            { id: "gen_expertise", name: "Expertise", attr: "GEN", max: 1, baseCost: 10, baseDesc: "Bonus XP choice.", ranks: ["Choice of: +2 XP combat, +2 XP discovery, or +2 XP role play."], choiceOptions: ['+2 XP Combat', '+2 XP Discovery', '+2 XP Role Play'] },
            { id: "gen_lucky", name: "Lucky", attr: "GEN", max: 1, baseCost: 10, baseDesc: "Once/Full Rest: Use LUC save instead.", ranks: ["Once/Full Rest: Use LUC save instead."] },
            { id: "gen_sacrificial", name: "Sacrificial", attr: "GEN", max: 1, baseCost: 10, baseDesc: "Reaction: Swap places with attacked ally.", ranks: ["Reaction: Swap places with attacked ally."] },
            { id: "gen_safezone", name: "Safe Zone", attr: "GEN", max: 1, baseCost: 10, baseDesc: "Designate safe targets in your AoE.", ranks: ["Designate safe targets in your AoE."] },
            { id: "gen_tacticalmind", name: "Tactical Mind", attr: "GEN", max: 1, baseCost: 10, baseDesc: "Use INT for Initiative.", ranks: ["Use INT for Initiative."], effect: (c) => { c.useIntInit = true; } },
            { id: "gen_tinker", name: "Tinker", attr: "GEN", max: 1, baseCost: 10, baseDesc: "Repair items for half Materials.", ranks: ["Repair items for half Materials."] },
            { id: "gen_wellrested", name: "Well Rested", attr: "GEN", max: 1, baseCost: 10, baseDesc: "Roll Rest Dice twice, keep highest.", ranks: ["Roll Rest Dice twice, keep highest."] },
            { id: "gen_latentpot", name: "Latent Potential", attr: "GEN", max: 2, baseCost: 10, baseDesc: "+1 to chosen Core Attribute below 4.", ranks: ["+1 to Attribute.", "+1 to Attribute."], choiceOptions: ['STR', 'AGI', 'CON', 'PER', 'INT', 'CHA', 'LUC'], effect: (c, r, choices) => {
                if(choices) {
                    for(let i=1; i<=r; i++) {
                        let stat = choices[i];
                        if(stat) { c.scores[stat] += 1; c.mods[stat] = c.scores[stat] - 5; }
                    }
                }
            }},
            { id: "gen_resistant", name: "Resistant", attr: "GEN", max: 2, baseCost: 10, baseDesc: "Increase DR or ER by 1.", ranks: ["+1 DR/ER.", "+1 DR/ER."], choiceOptions: ['DR', 'ER'], effect: (c, r, choices) => {
                if(choices) {
                    for(let i=1; i<=r; i++) {
                        if(choices[i] === 'DR') c.dr += 1;
                        if(choices[i] === 'ER') c.er += 1;
                    }
                }
            }},
            { id: "gen_adrenaline", name: "Adrenaline", attr: "GEN", max: 3, baseCost: 10, baseDesc: "Generate extra AP at start of combat.", ranks: ["+1 AP at combat start.", "+2 AP at combat start.", "+3 AP at combat start."] },
            { id: "gen_cautious", name: "Cautious", attr: "GEN", max: 3, baseCost: 10, baseDesc: "+1 to PER (Notice) per rank.", ranks: ["+1 Notice.", "+2 Notice.", "+3 Notice."], effect: (c, r) => { c.skills.Notice = (c.skills.Notice||0)+r; } },
            { id: "gen_fast", name: "Fast", attr: "GEN", max: 3, baseCost: 10, baseDesc: "Speed increases by 1 square per rank.", ranks: ["+1 Speed.", "+2 Speed.", "+3 Speed."], effect: (c, r) => { c.speed += r; } },
            { id: "gen_ghost", name: "Ghost", attr: "GEN", max: 3, baseCost: 10, baseDesc: "+1 to AGI (Stealth) per rank.", ranks: ["+1 Stealth.", "+2 Stealth.", "+3 Stealth."], effect: (c, r) => { c.skills.Stealth = (c.skills.Stealth||0)+r; } },
            { id: "gen_heavysleeper", name: "Heavy Sleeper", attr: "GEN", max: 3, baseCost: 10, baseDesc: "Sleep in armor without penalty.", ranks: ["Sleep in Light armor.", "Sleep in Medium armor.", "Sleep in Heavy armor."] },
            { id: "gen_planted", name: "Planted", attr: "GEN", max: 3, baseCost: 10, baseDesc: "+1 to resist Prone/forced move per rank.", ranks: ["+1 bonus.", "+2 bonus.", "+3 bonus."] },
            { id: "gen_resilient", name: "Resilient", attr: "GEN", max: 3, baseCost: 10, baseDesc: "Rest Dice step increases (d6 > d8 > d10 > d12).", ranks: ["d8s.", "d10s.", "d12s."], effect: (c, r) => { 
                if(r===1) c.restDieStep="d8"; if(r===2) c.restDieStep="d10"; if(r===3) c.restDieStep="d12"; 
            }},
            { id: "gen_strongarm", name: "Strong Arm", attr: "GEN", max: 3, baseCost: 10, baseDesc: "Throw distance +1 square per rank.", ranks: ["+1 sq.", "+2 sq.", "+3 sq."] },
            { id: "gen_twitchy", name: "Twitchy", attr: "GEN", max: 3, baseCost: 10, baseDesc: "+1 Initiative per rank.", ranks: ["+1 Init.", "+2 Init.", "+3 Init."], effect: (c, r) => { c.init += r; } },
            { id: "gen_suspicious", name: "Suspicious", attr: "GEN", max: 3, baseCost: 10, baseDesc: "+1 PER (Insight) per rank.", ranks: ["+1 Insight.", "+2 Insight.", "+3 Insight."], effect: (c, r) => { c.skills.Insight = (c.skills.Insight||0)+r; } },
            { id: "gen_strider", name: "Strider", attr: "GEN", max: 3, baseCost: 10, baseDesc: "No double AP climb/swim. Jump +1 sq per rank.", ranks: ["Normal AP. Jump +1 sq.", "Jump +2 sq.", "Jump +3 sq."] },
            { id: "gen_softlanding", name: "Soft Landing", attr: "GEN", max: 6, baseCost: 10, baseDesc: "Reduce fall dist by 5 squares per rank.", ranks: ["-5 sq.", "-10 sq.", "-15 sq.", "-20 sq.", "-25 sq.", "-30 sq."] },
            { id: "gen_tireless", name: "Tireless", attr: "GEN", max: 6, baseCost: 10, baseDesc: "Ignore 1 level of Fatigue per rank.", ranks: ["Ignore 1 level.", "Ignore 2 levels.", "Ignore 3 levels.", "Ignore 4 levels.", "Ignore 5 levels.", "Ignore 6 levels."] },
            { id: "gen_organized", name: "Organized", attr: "GEN", max: 10, baseCost: 10, baseDesc: "+15 lb Carry Capacity per rank.", ranks: ["+15 lbs", "+30 lbs", "+45 lbs", "+60 lbs", "+75 lbs", "+90 lbs", "+105 lbs", "+120 lbs", "+135 lbs", "+150 lbs"], effect: (c, r) => { c.carryCap += (r*15); } },
            { id: "gen_tough", name: "Tough", attr: "GEN", max: 20, baseCost: 10, baseDesc: "Max Rest Dice +1 per rank.", ranks: ["+1 Die", "+2 Dice", "+3 Dice", "+4 Dice", "+5 Dice"], effect: (c, r) => { c.maxRestDice += r; } },

            // POWER PERKS
            { id: "pwr_int", name: "Intelligence Powers", attr: "PWR", max: 5, baseDesc: "Use INT for powers.", ranks: [
                "Rank 1. Gain 3x Level 1 Slots.",
                "Rank 2. Gain 2x Level 2 Slots.",
                "Rank 3. Gain 2x Level 3 Slots.",
                "Rank 4. Gain 1x Level 4 Slot.",
                "Rank 5. Gain 1x Level 5 Slot."
            ], effect: (c, r) => { c.hasIntPwr=r; } },
            { id: "pwr_cha", name: "Charisma Powers", attr: "PWR", max: 5, baseDesc: "Charisma based power users made deals with devils, were experimented on by aliens, or blessed by the gods. They are empowered by chance or negotiation. The number of Powers you can use per Short Rest is equal to your highest Rank in this perk. Each time you purchase a new Rank of this perk, you can create one free Power at that newly unlocked Level. When purchasing Rank 2 or higher, you also gain a free Power upgrade. You may select one of your existing Powers from the previous Level and upgrade it to your new Level for free.", ranks: [
                "Rank 1. Unlock Level 1 Powers. Create one free Level 1 Power.",
                "Rank 2. Unlock Level 2 Powers. Create one free Level 2 Power, and upgrade one existing Level 1 Power to Level 2 for free.",
                "Rank 3. Unlock Level 3 Powers. Create one free Level 3 Power, and upgrade one existing Level 2 Power to Level 3 for free.",
                "Rank 4. Unlock Level 4 Powers. Create one free Level 4 Power, and upgrade one existing Level 3 Power to Level 4 for free.",
                "Rank 5. Unlock Level 5 Powers. Create one free Level 5 Power, and upgrade one existing Level 4 Power to Level 5 for free."
            ], effect: (c, r) => { c.hasChaPwr=r; } }
        ];

