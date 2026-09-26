// ============================================================
// APX Patch Notes
// ============================================================
// One popup per page: the index shows the overview, the Character Sheet and
// GM Tools show their own detailed notes. Each page remembers (in this
// browser) when you tick "Don't show this again" for a version; the notes
// also stop appearing on their own 14 days after release. They can always be
// reopened by clicking the version label (index footer, Settings on the tools).
// ============================================================
(function () {
    'use strict';

    const NOTES = [{
        version: 'v2026.9.25.1822',
        released: '2026-09-25T18:22:00',
        releasedText: 'September 25, 2026 · 6:22 PM',
        title: 'Playtest Update',
        intro: 'This update comes straight from our playtest tables. GMs get world rules, a Loot Maker, NPCs that carry and use gear, and magic items that can change almost anything on a sheet. Players get Luck and Looting, trading, shareable Omen dice, Loyal Companions that act on their own turns, powers that roll like weapons and use their AP and Power Slots, weapon properties that apply themselves on a hit, a one-screen Origin Builder, full-resolution maps at any size, and a dice roller with a distinct shape for every die that doubles as the combat log and asks for your Wound and Bleed Out saves. Initiative runs with or without a battle map, characters are created and switched cleanly, and deleting an account removes all of its data. Your characters and worlds update when you open them. Nothing is lost, and anything a rule change touched is explained.',
        index: [
            ['For GMs', [
                'World Settings: Starting XP, Max GP, starting Cu, and Point Buy or Standard Array for every character in your world.',
                'Loot Maker: build loot with the same forges and crafters players use, consumables included. Give it to NPCs, who use their consumables in a fight and drop whatever is left when they fall.',
                'Magic items can raise or lower almost anything on a sheet: Core Attributes, skills, Max HP, AP, Initiative, Wound Threshold, Rest Dice, Luck Points, Power Slots, attacks, saves and more.',
                'Hand out loot from the Loot panel, an NPC\'s window or any Area Circle the NPC stands in. Ask the whole party or a single player for the Loot roll.',
                'Initiative works on its own. It uses a battle map only when that map is open or picked as the fight\'s Battle map, so a quick fight never turns into "an unseen creature".',
                'Saved NPC sorting flips direction with a second click (A–Z to Z–A, highest to lowest), with an arrow on the active sort.'
            ]],
            ['For Players', [
                'Each new character starts in the world you choose, with that world\'s rules, races and settings, or in no world at all.',
                'Powers roll like weapons: click a power\'s name to spend its AP and a Power Slot and roll the attack and damage together. Attack Roll / Save Negates powers choose one, an attack can be a Power Attack or a martial improvement riding one of your weapons, and save powers tell the GM the DC.',
                'The Origin Builder fits on one screen: name, starting wealth and feature on one side, languages and competencies on the other.',
                'Luck and Looting: LUC (Loot) for Currency (LUC × enemies defeated ÷ 2) and ammunition (LUC − 3d6 rounds), or an hour of scavenging for Crafting Materials.',
                'Omen dice can go to the GM (for any creature\'s roll) or to a party member. They work on your companion\'s rolls, can swap in natural 1s and 20s, and are rerolled one by one on a Full Rest.',
                'Loyal Companions have their own AP that refills on their turn, their own token art, and healing whenever you use a Rest Die. You can also trade items with your party and receive XP from your GM with your bonuses applied.'
            ]],
            ['At the Table', [
                'Dice and Notifications holds every roll, the combat log and your messages in one tray.',
                'Every die has its own shape, on its button and in every roll: triangles for the d4 and d8, a square d6, a kite d10, a pentagon d12, a hexagon d20 and a round d100.',
                'The combat log shows the table the fight and resolves every save in order (Wound Threshold, a hit\'s own saves, then Bleed Out), with a button in the tray to roll each one. The party\'s hits on enemies show no numbers, so DR and ER stay hidden.',
                'Weapon properties apply themselves on a hit: Crushing and Stunning ask for their saves and add Prone or Stunned on a failure, Crushing and Concealed add their extra damage die, and Flurry lowers the AP of your next attacks. A hit that deals no damage still counts.',
                'Click skills, saves, weapons, powers and stat block dice to roll them. Perks, Advantage and Disadvantage, crits and Luck rerolls are built in.',
                'Action Points are 6 + half your AGI modifier. They are tracked for every creature, refill on each turn (map or no map), carry between turns, reset when a fight starts and ends, and are spent by attacks, powers and standing up from Prone.',
                'Rest and Recover buttons cover Short and Full Rests, Shake it Off and Shrug It Off.'
            ]],
            ['Battle Maps', [
                'Maps keep their full resolution at any size. A large map opens instantly as a preview, and the sharp detail loads for just the part you zoom into, so small text and fine lines stay readable.',
                'Move groups of tokens with Shift+drag, layer images on the map, and measure with M. Large maps stay smooth.'
            ]],
            ['Rules', [
                'Point Buy: attributes start at 4 with 7 points to spend, and each stays between 2 and 7.',
                'High Roller and Fortunate Fighter are rewritten, and Regenerative and Mobile are updated. Power Crafting caps die steps at 8 dice and adds Mythic Utilities (130 XP).',
                'Wound Threshold reminders include the CON save DC, and Permanent Injuries are tracked.',
                'NPC weapons, armor, shields and helmets cost Threat Points. Defeated NPCs are worth 1 / 5 / 10 / 15 / 25 / 35 XP for Tiers 0–5, plus 10 per Tier after that.'
            ]],
            ['Your Account', [
                'Deleting your account removes everything tied to it: characters, folders, worlds with their maps, fog, portraits and images, invite codes, your place in worlds you joined, races, NPCs, your profile and this browser\'s saved settings.'
            ]],
            ['Also', [
                'Small text is easier to read. XP bonuses from INT, Educated and Expertise apply automatically, conditions bring their linked conditions, the toolbar is tidier, and there are many fixes.',
                'See the Character Sheet and GM Tools for the full details.'
            ]]
        ],
        sheet: [
            ['Characters', [
                'When one of your worlds has an empty character slot, New Character asks where the character plays: in that world, with its rules, races and settings from the first moment, or in no world. The new character is saved straight away.',
                'Deleting the character you have open takes you back to the character screen instead of leaving a half-filled sheet. Load another character or start a new one from there.',
                'Switching characters switches worlds cleanly. The sheet follows only the open character\'s world (its races, Standard Array or Point Buy, Max GP, XP rules and combat turns), and a character outside any world is never affected by one.',
                'Undo history belongs to the character you have open. Switching characters starts it fresh, so Undo can\'t bring back another character\'s sheet.'
            ]],
            ['Origin Builder', [
                'Everything is on one screen. The left side has the Origin Name, Starting Wealth and Origin Feature. The right side has the setting\'s common language and your four competencies.',
                'Each competency is a card with Language, Skill and Weapon Type buttons. Pick one to fill it in (a language name, a skill to train, or a weapon type), pick another to switch, or click the active one again to clear it. Switching or clearing undoes what the old choice granted.',
                'Starting Wealth is added to your Currency when you save and can only be chosen once. After that the choices stay locked and the note says it has been added.',
                'Save Origin adds your languages to a Languages note (new ones are appended to an existing note).'
            ]],
            ['Your World', [
                'Your GM sets the world\'s rules: Starting XP, Max GP, starting Cu, and how attributes are chosen. A brand-new character receives the Starting XP and Cu once.',
                'XP comes from your GM with your bonuses (INT modifier, Educated, Expertise) added, and the XP fields are locked while you\'re in the world. Outside a world, XP and Max GP are yours to set.',
                'A new character receives only XP granted after it joins the world. XP that was waiting from before never lands on it.',
                'Standard Array: each attribute begins on "Choose", and a value you pick leaves the other dropdowns until you free it. Use 7, 6, 5, 5, 5, 4 and 3 once each.',
                'Point Buy: every attribute starts at 4 with 7 points to spend. Each +1 costs a point, each −1 gives one back, and attributes stay between 2 and 7.'
            ]],
            ['XP', [
                'The XP Log button sits beside Spend XP. It lists everything you gained (reason, session, date and bonuses) and everything you spent XP on.'
            ]],
            ['Loyal Companions', [
                'Your companion has its own AP, shown as pips on its card under Perks and in its stat block popup. Click pips to spend or refund, as on your own tracker. Unspent AP carries over.',
                'In combat its AP empties when the fight begins and refills when its turn comes up in the GM\'s initiative (1 AP if it was Surprised).',
                'Attacks rolled from its stat block spend its AP automatically, and each of its powers has a Use button that spends the power\'s AP.',
                'Your Omen dice work on its rolls, including dice passed to you by other players.',
                'Its HP stays in step everywhere. Changes from the popup, the Perks card, the GM or a rest show up in every place at once.',
                'Give it its own picture: upload one, then drag and zoom inside the circle to frame the token. Adjust re-frames it later, and clicking the token shows the full image.',
                'Every Rest Die you use also heals your companion by the roll plus its CON modifier. The Short Rest window shows its HP, and you can keep spending dice for it while you\'re at full HP. A Full Rest restores its Power Slots and charges, and so does a Short Rest if its powers use CHA.',
                'Companions can carry a Shield (4 TP) and a Helmet (2 TP). The stat block counts free hands and has an Equip/Stow Shield button, and attacks that need more hands than are free can\'t be rolled. Each +2 DR/ER purchase adds 2, and manufactured weapons and armor use its TP.'
            ]],
            ['Omen', [
                'Your Omen dice sit under Disadv | Normal | Adv in the dice tray. Click one to pass it on: choose the die as it is or (from Rank 2) plus or minus your LUC modifier, then choose who gets it.',
                'The GM can use it to replace any creature\'s d20, such as an enemy\'s critical hit. A party member gets it in their dice roller, even without the Omen perk, to use on their own roll or pass along.',
                'On your own rolls and your companion\'s, use a die from the roll\'s buttons.',
                'Banking a natural 1 or 20 (Rank 3) is a swap: the natural roll joins your Omen dice, and the held die you give up becomes that roll (plus or minus LUC from Rank 2).',
                'On a Full Rest, choose which held Omen dice, if any, to roll again. The rest are kept and empty slots are filled. At Rank 5, dice rolled again come back as whichever of 1, 10 and 20 is missing.'
            ]],
            ['Powers', [
                'Click a power\'s name or its "Lvl X | Y AP" tag to use it. It spends its AP and a Power Slot (INT powers use a slot of their level; CHA powers take 1 from the pool), and asks first if you\'re out of either.',
                'Attack powers roll like weapons: the d20 and the damage in one roll, with the damage dice doubled on a critical hit.',
                'Save powers roll their damage or healing and show the DC your targets roll against. The GM is told as well. Powers with no roll show their description in the dice tray.',
                'In the Power Crafter, Attack Roll / Save Negates asks which one the power uses. An Attack Roll is a Power Attack (d20 + Power Atk) or a Martial Improvement, which triggers with a normal attack from the equipped weapon you pick (unarmed strikes and innate weapons included). A martial power rolls with that weapon\'s attack bonus and adds the weapon\'s damage to its own.',
                'A martial power\'s card has a dropdown to switch weapons when your gear changes, and "Atk: +X" in the Powers header rolls a plain power attack. Powers made before this update roll as Power Attacks.'
            ]],
            ['Weapons', [
                'When you hit, your weapon\'s properties take effect on their own. Crushing asks the target for a STR save (DC 10 + your STR modifier) and knocks them Prone on a failure; if they\'re already Prone, the hit deals an extra damage die instead. Stunning asks for a CON save (DC 10 + STR, or INT for an Electric weapon) or they\'re Stunned. Concealed deals an extra die against a Surprised creature.',
                'Flurry: once your GM records a hit, your next attack with that weapon this turn has the Flurry AP reduction ticked for you (untick it if you switch targets).',
                'Thrown weapons can be made Returning in the Weapon Forge for 300 more Currency, so they come back to you after the attack.'
            ]],
            ['Magic and Custom Items', [
                'Equippable items can carry any number of bonuses, or penalties for cursed items: Core Attributes, any skill, AC, DR, ER, resistance to one energy type, Max HP, Max AP, Speed, Initiative, Wound Threshold, Max Rest Dice, Max Luck Points, Carry Capacity, melee and ranged attack and damage rolls, power attack rolls and save DC, saving throws, checks, and extra Power Slots of any level or for the CHA pool.',
                'Make them with Add Item: tick Equippable, then add Other Bonuses beside the attribute, skill and energy bonuses. Edit your own later from their details.',
                'Bonuses apply while the item is equipped and are listed under its name in your inventory. Items from your GM keep the bonuses the GM gave them.'
            ]],
            ['Luck and Looting', [
                'Loot / Scavenge, beside + Add Item, has all three rolls.',
                'Currency: LUC (Loot) × enemies defeated, halved and rounded down, is what the party finds. A 16 after twelve mercenaries turns up 96 Cu.',
                'Ammunition: LUC (Loot) − 3d6 rounds (or arrows or energy cells) are recovered and added to your Light, Medium or Heavy Ammo.',
                'Scavenging takes about an hour with LUC (Loot), PER (Notice), CON (Survive) or INT (Encyclopedia). Hunting for Crafting Materials rolls the table for you: 2–10 finds 1d4 Common and 1d4−1 Uncommon, 11–15 adds Rare, 16+ finds more, a natural 20 finds the most, and a natural 1 sets off a trap or hazard.',
                'Luck rerolls and Omens update what you found. When the GM asks for a Loot check (from the whole party or from you alone), the Currency roll opens with the enemy count filled in and your result goes to the GM.'
            ]],
            ['Party, Trading and Gifts', [
                'The Party tab lists everyone in your world, with each Loyal Companion right after its owner. Click a portrait to see the full picture.',
                'Each inventory item has a Give button that lists your party. Choose who gets it (and how many, for stacks) and it moves to their inventory.',
                'Gear, consumables, magic items and Cu from your GM arrive in your inventory with a notification.'
            ]],
            ['Action Points', [
                'AP is 6 + half your AGI modifier (rounded down, minimum 6), minus Fatigue, plus item bonuses.',
                'Unspent AP carries over with no cap. The tracker shows your AP plus one empty pip and grows as you bank more. Click a pip to spend or refund.',
                'In combat your pool empties when the fight begins (banked AP is lost) and refills when your turn comes up, whether or not your GM uses a battle map. Surprised characters get only 1 AP on their first turn. When the fight ends, your AP resets to your normal maximum.',
                'Standing up (removing Prone) costs 2 AP during combat, or 0 with Fool\'s Luck Rank 5. If you\'re short you\'re asked first. Outside combat it\'s free.',
                'Attacks spend their own AP. You\'re asked when you Aim (Aim AP + attack AP), when a perk might change the cost (Martial Arts, Flurry), or when you\'re short on AP.'
            ]],
            ['Dice and Notifications', [
                'Rolls and messages share one tray: rest results, XP, loot, HP changes from the GM and warnings. A red dot on the dice button marks something new, and cleared entries stay cleared.',
                'In combat the tray is the fight\'s log. Damage enemies deal to you shows the amount. Damage the party deals to enemies doesn\'t, so their DR and ER stay hidden. Your checks and saves reach the GM, and Luck rerolls update them.',
                'Wound Threshold and Bleed Out: when a hit goes past your Wound Threshold, your next CON save is the roll to avoid being Wounded. If you\'re also Bleeding Out, the CON (Survive) check that follows sets how many rounds you have.',
                'Every save your GM\'s log asks of you has a button to roll it straight from the tray, with all your bonuses ("Roll CON save (DC 12)", "Roll STR save (DC 13)", "Roll CON (Survive)"). Buttons go in the order they were asked, so a later one waits for the earlier save.',
                'Click any skill, save, attribute, weapon attack, damage, power or stat block dice to roll it. Conditions add Advantage or Disadvantage for you.',
                'The d4–d100 buttons build a dice pool, the box adds a modifier, and Roll rolls the pool and clears it.',
                'Each die is drawn in its own shape, on the buttons and in the rolls: the d4 is a triangle, the d6 a square, the d8 a triangle pointing down (so it stands apart from the d4), the d10 a kite, the d12 a pentagon, the d20 a hexagon with a corner up, and the d100 a circle. Omen dice are purple hexagons.',
                'Critical hits multiply the damage dice. A Luck Point rerolls a d20 right from the roll.',
                'Damage perks apply themselves: High Roller, Melee Prowess and Sharpshooter (Rank 2 rolls damage twice and keeps the higher, Rank 5 maximizes damage on a confirmed crit), plus a toggle for Instigator.'
            ]],
            ['Rest and Recover', [
                'Rest: a Short Rest spends Rest Dice one at a time (each heals the die + your CON modifier) and restores CHA Power Slots. A Full Rest restores all HP and Power Slots, half your max Rest Dice and your Luck, and removes 1 Fatigue.',
                'Recover: Shake it Off (1 AP, roll up to half your max Rest Dice, each + CON) and Shrug It Off (3 AP, heal one Wounded limb), each once per Short or Full Rest.',
                'Regenerative costs 3 GP. At the start of your turn in combat, press Regen to spend a Rest Die and heal the roll.'
            ]],
            ['Conditions and Injuries', [
                'Unconscious, Paralyzed or Incapacitated characters see why their attacks and powers are unavailable, for example "(Unconscious)". Unconscious auto-fails STR, AGI, PER, INT and CHA checks (CON still works, for Bleed Out). Paralyzed auto-fails STR and AGI checks.',
                'Burning deals 1d10 Fire damage at the start of your turn in combat, ignoring ER, unless you\'re immune to Fire.',
                'Conditions bring the ones they include: Bleeding Out → Unconscious → Incapacitated (and Prone), Paralyzed → Incapacitated, Diseased → Infected. Frenzy Rank 5 keeps you conscious while Provoked. The × on a condition\'s tag under Vitals removes it.',
                'Permanent Injuries: when a Wounded limb is Wounded again, press Re-wounded and pick an attribute to lower by 1. Remove the injury once it heals to get the point back.'
            ]],
            ['Rules', [
                'High Roller: a Gamble that hits deals +5 damage (+10 and 1 AP from Rank 4). Rank 2 rerolls 1s and 2s on damage, Rank 3 lets Luck rerolls use Advantage or Disadvantage, and Rank 5 is a Dice Explosion once per Full Rest.',
                'Fortunate Fighter Rank 1: use LUC instead of AGI for your AC. The sheet uses whichever is higher.',
                'Mobile Rank 1: moving costs 1 less AP each time (minimum 0), and difficult terrain doesn\'t slow you.',
                'Power Crafting: at most 8 dice per die step, and Sacrifice also stops you regaining HP until your next turn. Affected powers show "Recraft (Free)".',
                'Mythic Utilities (Power Crafter Step 5): Dominate, Vehicle Scale, Wish, Create a Sentient Being and Stop Time. Each costs a flat 130 XP, unaffected by Area of Effect or HP Capacity Pool. A Mythic power takes no other utilities, gets no refunds from Steps 6–8, pays double for Duration and AP, and skips Step 6 or 7 where the utility says so.',
                'Heavy ranged weapons show AGI in the ATT column.'
            ]],
            ['Layout and Display', [
                'Settings sits beside World at the top of the Character Sheet. Undo and Redo are at the bottom of the Roster menu, and Ctrl+Z and Ctrl+Y still work anywhere.',
                'Ammo is one stack per type: another bundle adds 20 rounds to your "Medium Ammo".',
                'Power Crafter Step 5 puts Minor and Moderate Utilities in one column and Major, Master and Mythic in the other.',
                'The perk list can show only the perks you own. Small text is larger everywhere, and slightly larger again in the Fantasy theme.'
            ]],
            ['Battle Maps', [
                'Your GM\'s maps stay sharp when you zoom in: the map appears straight away, and the full-resolution detail loads for the area you\'re looking at. Each piece downloads once and is kept in this browser.',
                'Measure with M (middle-drag still pans), see token numbers and conditions, and resize map windows from the corner grip.'
            ]],
            ['Your Account', [
                'Delete Account removes everything tied to your account: every character and folder, every world you run (with its maps, fog, NPC portraits, battle images, invite code and player list), your place in each world you joined, your races, NPCs and profile, and this browser\'s saved APX settings.',
                'If you\'re asked to re-enter your password, deletion carries on from where it stopped.'
            ]]
        ],
        gm: [
            ['World Settings', [
                'The World Settings tab sets your world\'s rules: Starting XP (default 25), Max GP (default 15), a starting Cu bonus, and Point Buy or Standard Array (7, 6, 5, 5, 5, 4, 3).',
                'Players in your world can\'t edit their own XP or Max GP. Grant XP applies each player\'s bonuses and records the reason.',
                'Starting XP and Cu go to brand-new characters once, and existing characters keep what they have. A player\'s new character never collects XP granted before it joined.'
            ]],
            ['Deleting Worlds and Accounts', [
                'Deleting a world removes all of it: its main map and other maps, fog, NPC portraits, battle images, invite code, player list and public map.',
                'Deleting your account does the same for every world you run, and also removes your characters, folders, races, NPCs, profile and your place in worlds you joined as a player.',
                'Update your Firestore rules from FIREBASE_RULES.txt (v2026.9.25b). Players, including kicked or banned ones, can then remove their own place in a world, and everyone in a world can load full-resolution map tiles.'
            ]],
            ['Full-Resolution Maps', [
                'Upload a map of any size to the World Map or an Other Map. Every map gets a compressed preview (up to 1600 px on its longest side) that loads instantly. Grid squares, tokens, pins and fog are placed on the preview, exactly as before.',
                'A map that fits in the preview without shrinking stops there. A larger one is also cut into full-resolution tiles (512 px squares at high quality, plus half-resolution tiles for very large maps), each saved as its own small record well within Firestore\'s limits. A 6000 × 9000 map makes about 300 tiles. There\'s no Firebase Storage and no paid plan.',
                'Zoomed out, only the preview loads. As you zoom in, the tiles for the visible area load at the detail your screen needs (high-density screens get it sooner), and they are kept in the browser so each downloads once.',
                'Each tile carries a few pixels past its edges, so neighbouring tiles overlap exactly: no seams or cut-off text at any zoom.',
                'Uploads confirm each tile before sending the next, restart the connection every few MB so Firestore never refuses it, and retry a tile if the connection is busy.',
                'The upload shows its progress on the Map tab or in the map window ("saving tiles 120/297…"). The preview appears first, and players get the new tiles when the upload finishes. Uploading a new image removes the old tiles, and deleting a map, a world or an account removes them all.',
                'Previews are compressed with browser-image-compression (loaded by the GM Tools page from jsdelivr), and with the built-in compressor if it can\'t load.'
            ]],
            ['Initiative and Battle Maps', [
                'The initiative tracker works on its own. Adding creatures no longer reaches into a closed map, so a quick fight never shows "an unseen creature" or asks for tokens.',
                'A map is used when you have it open, or when you pick it under Battle map in the tracker. Picking or opening a map links everyone in initiative to their matching tokens there, and hidden tokens stay anonymous to players.',
                'The + Token button appears only while a battle map is open. The Battle map choice resets when you end combat or clear the tracker.',
                'Your own combat log always shows real names and amounts, marking creatures players can\'t see as "(hidden)".'
            ]],
            ['Saved NPCs', [
                'Sort the Saved NPC list by Name, AP, Threat Level or any Core Attribute. Click the active sort again to reverse it (A–Z to Z–A, highest to lowest). An arrow marks the active sort and its direction.'
            ]],
            ['Loyal Companions', [
                'Companions sit under their owner in the Party panel with their stat block, token art and a + Initiative button. Add Party places their tokens on the map too.',
                'In initiative a companion is an ally with its own AP. Attacks rolled from its stat block spend it, and when its turn comes up its owner\'s sheet refills the companion\'s AP pips as well.',
                'Its HP follows its owner\'s sheet, it stays in the order at 0 HP, and it doesn\'t take a share of combat XP.'
            ]],
            ['Omen Dice on Your Rolls', [
                'When a player passes you an Omen die, the combat log announces it and the die waits in your dice tray, above the dice buttons, with the player\'s name. Players can also pass Omen dice straight to each other.',
                'Every d20 roll in your tray gains a "Seer\'s Omen 6" style button. Press it on the roll it replaces (an NPC\'s attack, check or save) and that d20 becomes the Omen die, LUC adjustment included. A critical hit turned into a 6 is no longer a critical.',
                'The log tells the table the new result and shows you the before and after. Dismiss an Omen with ✕ if it was handled another way.'
            ]],
            ['Loot Maker', [
                'Build loot with the tools players use: the Weapon Forge and Armor Forge (free for you, finishing with "Add to Loot"), the Consumable Crafter (potions, grenades, scrolls and more), the Adventuring Gear list, quick custom weapons, Shields and Helmets.',
                'Custom items can be made equippable with any number of bonuses or penalties from one list: Core Attributes, any skill, AC, DR, ER, a single energy resistance, Max HP, Max AP, Speed, Initiative, Wound Threshold, Max Rest Dice, Max Luck Points, Carry Capacity, attack and damage rolls, power attack and DC, saving throws, checks, and extra Power Slots of any level or for the CHA pool. Players can read these bonuses but can\'t edit them.',
                'Open the Loot Maker from the Loot panel to fill your Loot list, or from an NPC to stock what it carries.',
                'The Weapon Forge offers Returning for Thrown weapons (+300 Cu): the weapon comes back after the attack.'
            ]],
            ['NPC Gear and Consumables', [
                'Every NPC stat block can carry items and Currency, added from the NPC Crafter ("Carried Items and Loot") or from the NPC\'s window in your world notes. Carried gear costs no Threat Points.',
                'Consumables appear on the stat block with their charges and a Use button: 3 AP and one charge, tracked per creature in initiative, so goblins sharing a stat block each have their own.',
                'When an NPC dies, its equipment, whatever it still carries (consumables with charges left) and its Currency drop into the Loot panel.',
                'An NPC\'s window has its own Loot section, with a "Give to" dropdown for each item and a Currency box to give to one player or split across the party, for loot that changes hands without a fight.'
            ]],
            ['Loot on Maps', [
                'Loot lives on NPCs. Link an NPC to an Area Circle and the area\'s popup shows its loot, ready to hand out. A chest, a fallen soldier or a shopkeeper is simply an NPC placed there.',
                'Battle-map tokens work the same way: a token linked to an NPC drops that NPC\'s loot when it falls.',
                'Loot stays yours alone until you give it away.'
            ]],
            ['Loot After a Fight', [
                'Defeated enemies\' gear appears in the Loot panel under the tracker, grouped by who dropped it.',
                'Choose a party member beside each item and press Give, and it goes straight into their inventory. Your other picks stay put while you hand things out, and ✕ removes anything that didn\'t survive the fight.',
                'Currency: the party finds LUC (Loot) × enemies defeated ÷ 2, rounded down. The panel counts this combat\'s defeated enemies (you can change the count), and Currency carried by fallen NPCs is added to the Cu box.',
                'Ask to roll: choose the whole party or one player, and their sheets open the Loot roll with the enemy count ready. Each result arrives with its Cu (only from the player you asked, when you chose one).',
                'Press Use on a result to put its Cu in the Cu box, and the result leaves the list. Then give it to one player or split it across the party.',
                'Players can also trade items among themselves.'
            ]],
            ['Party', [
                'Party stat blocks include the bonuses from each player\'s equipped items (Max HP, AP, saves, Wound Threshold and the rest).'
            ]],
            ['Initiative and Combat', [
                'Bleed Out is one row: "Bleeding Out: N rounds left" with − Round, + Round and Stabilize.',
                'No popups for saves. When a player passes their Wound Threshold, or drops to 0 HP with a linked sheet, their dice tray asks for the CON save or CON (Survive) check and the result fills in here. The Bleed Out popup remains for players without a sheet.',
                'Hits: damage you enter right after an attack roll (from a player\'s sheet or your stat blocks) is that attack\'s hit, and "-0" counts when DR or ER stopped all of it. Players see "Ari hit Goblin."; you see the damage, or "Ari hit Goblin, but Goblin took no damage."',
                'The hit weapon\'s properties apply to that target. Crushing: a STR save (DC 10 + the attacker\'s STR modifier) or Prone, or +1 damage die against a Prone target. Stunning: a CON save or Stunned. Concealed: +1 damage die against a Surprised target. Extra dice go straight onto HP and count toward the Wound Threshold. Grappling is noted for you to apply, and Tearing stays manual.',
                'Players roll their saves from their tray. For NPCs, the log gives you a button that rolls the save with the creature\'s bonus and adds Prone or Stunned on a failure (Luck rerolls update it).',
                'Flurry: after a hit, the attacker\'s next attacks with that weapon this turn cost 1 less AP, automatically for NPCs, and ticked for you on the player\'s sheet.',
                'End Combat checks for anyone still Bleeding Out first, and the XP award closes the combat log.',
                'The combat log lives in the dice tray. Everyone sees damage and healing, but players see "Ari hit Goblin" with no number, so DR and ER stay secret, while you see every amount and every real name. Damage to players shows its amount to everyone. Player checks and saves appear only for you (marked GM) and update live with Luck or Omen. Hidden tokens show as "an unseen creature".',
                'Wound Threshold and Bleed Out rolls are matched for you, Wound Threshold first. The player\'s next CON save settles the wound against its DC (10, or half the damage), then their CON (Survive) check sets the Bleed Out rounds (half the result, minimum 1).',
                'Every creature\'s AP is tracked and carries over. Surprised creatures gain only 1 AP on their first turn, even when added mid-fight, and attacks and consumables used from a stat block spend that creature\'s AP.',
                'Players\' AP refills when their turn comes up even with no battle map, since the tracker tells their sheets whose turn it is. Everyone\'s banked AP is cleared when combat starts, and players return to their normal AP when it ends.',
                'Removing Prone from an NPC during combat spends the 2 AP it takes to stand up, and your log notes it.',
                'Conditions include their linked conditions and reach players\' sheets. Saved NPCs keep current HP in step with max HP, and NPCs join initiative at full HP.',
                'Messages go to Dice and Notifications. Click a party member\'s name for their full stat block.'
            ]],
            ['NPC Crafter', [
                'Shields (+2 AC/DR/ER, 4 TP, one hand) and Helmets (+1 AC/DR/ER, 2 TP). Stat blocks count free hands and have an Equip/Stow Shield button, and two-handed attacks can\'t be rolled while the shield is up.',
                'Each +2 DR/ER purchase (1 TP) adds 2.',
                'Die-step and extra-dice buttons switch off at their maximum, so clicks never land on what\'s behind them.',
                'XP rewards per Tier: 1 / 5 / 10 / 15 / 25 / 35 XP for Tiers 0–5, then +10 per Tier, divided among the players.',
                'Manufactured weapons and armor cost Threat Points, priced like the innate features they imitate.',
                'Power Crafter: at most 8 dice per die step, a warning when Sacrifice meets healing, Minor and Moderate utilities in one column, and Mythic Utilities (a flat 130 XP).'
            ]],
            ['Dice', [
                'Each die has its own shape on the buttons and in rolls: d4 and d8 triangles (the d8 points down), a square d6, a kite d10, a pentagon d12, a hexagon d20 and a round d100.'
            ]],
            ['Battle Maps', [
                'Shift+drag selects several tokens to move together, and right-click gives group options.',
                'Movable images (carts, tower floors, overlays) have layers, size, lock, reveal and opacity. Players see the same layering.',
                'Tokens show numbers, sizes from the character sheet and condition badges, and companion tokens use their own art.',
                'Measure with M: squares count inclusively and snap to token corners, and middle-drag pans while measuring.',
                'F toggles the fog painter, and Clear asks first. Grid, fog and window resizing stay light on large maps. Resize windows from the corner grip.'
            ]],
            ['World', [
                'Reveal toggles sit beside Edit on pins and on every sub-note in popups. Races stay with their own world, and locations can link NPCs.'
            ]],
            ['Fixes', [
                'Auto-save is dependable (including on Brave), with no more "write stream exhausted" errors in long sessions.'
            ]]
        ]
    }];

    const LATEST = NOTES[0];
    const EXPIRE_DAYS = 14;

    function page() {
        let p = (location.pathname.split('/').pop() || '').toLowerCase();
        if (p.includes('charsheet')) return 'sheet';
        if (p.includes('gmtools')) return 'gm';
        return 'index';
    }
    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
    function esc(t) { return String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    function css() {
        if (document.getElementById('apxPatchCss')) return;
        let st = document.createElement('style');
        st.id = 'apxPatchCss';
        st.textContent = `
        .apxpn-back{position:fixed;inset:0;z-index:2147483300;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px}
        .apxpn{width:min(620px,100%);max-height:min(86vh,820px);display:flex;flex-direction:column;background:var(--c-surface,#1e293b);color:var(--c-text,#fff);
            border:1px solid var(--c-border2,#475569);border-radius:.8rem;box-shadow:0 24px 70px rgba(0,0,0,.75);font-family:var(--c-font,inherit)}
        .apxpn-hd{padding:1rem 1.2rem .7rem;border-bottom:1px solid var(--c-border,#334155)}
        .apxpn-hd h3{margin:0;font-family:var(--c-heading-font,inherit);font-size:1.15rem;font-weight:900}
        .apxpn-meta{font-size:.72rem;color:var(--c-text-muted,#94a3b8);margin-top:.2rem}
        .apxpn-intro{font-size:.8rem;color:var(--c-text-dimmer,#cbd5e1);line-height:1.45;margin-top:.55rem}
        .apxpn-body{overflow-y:auto;padding:.4rem 1.2rem .8rem}
        .apxpn-sec h4{margin:.8rem 0 .3rem;font-size:.78rem;font-weight:900;text-transform:uppercase;letter-spacing:.04em;color:var(--c-indigo-lt,#a5b4fc)}
        .apxpn-sec ul{margin:0;padding-left:1.1rem;list-style:disc}
        .apxpn-sec li{font-size:.8rem;line-height:1.45;color:var(--c-text-dimmer,#cbd5e1);margin:.18rem 0}
        .apxpn-ft{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;padding:.7rem 1.2rem;border-top:1px solid var(--c-border,#334155)}
        .apxpn-ft label{font-size:.75rem;color:var(--c-text-muted,#94a3b8);display:flex;align-items:center;gap:.35rem;cursor:pointer}
        .apxpn-ft button{margin-left:auto;border:none;border-radius:.45rem;padding:.5rem 1.1rem;font-size:.8rem;font-weight:800;cursor:pointer;background:var(--c-indigo,#4f46e5);color:#fff}
        [data-theme="fantasy"] .apxpn-sec li,[data-theme="fantasy"] .apxpn-intro{font-size:.88rem}`;
        document.head.appendChild(st);
    }

    function show(which, auto) {
        css();
        document.querySelector('.apxpn-back')?.remove();
        let pg = which || page();
        let secs = LATEST[pg] || LATEST.index;
        let label = pg === 'sheet' ? 'Character Sheet' : pg === 'gm' ? 'GM Tools' : 'APX System Tools';
        let back = document.createElement('div');
        back.className = 'apxpn-back';
        back.setAttribute('data-apx-patch-notes', LATEST.version);
        back.innerHTML = `<div class="apxpn" role="dialog" aria-modal="true" aria-label="Patch notes">
            <div class="apxpn-hd"><h3>${esc(LATEST.title)}: ${esc(label)}</h3>
                <div class="apxpn-meta">${esc(LATEST.version)} · Released ${esc(LATEST.releasedText)}</div>
                <div class="apxpn-intro">${esc(LATEST.intro)}</div></div>
            <div class="apxpn-body">${secs.map(([h, items]) => `<div class="apxpn-sec"><h4>${esc(h)}</h4><ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join('')}</div>
            <div class="apxpn-ft"><label><input type="checkbox" data-dont ${auto ? '' : 'checked'}> Don't show this again</label><button data-close>Got it</button></div>
        </div>`;
        let close = () => {
            if (back.querySelector('[data-dont]').checked) lsSet('apx_patch_seen_' + pg, LATEST.version);
            back.remove(); document.removeEventListener('keydown', key, true);
        };
        let key = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
        back.querySelector('[data-close]').onclick = close;
        back.addEventListener('mousedown', e => { if (e.target === back) close(); });
        document.addEventListener('keydown', key, true);
        document.body.appendChild(back);
        back.querySelector('[data-close]').focus();
    }

    function shouldAuto(pg) {
        if (lsGet('apx_patch_seen_' + pg) === LATEST.version) return false;
        let age = (Date.now() - new Date(LATEST.released).getTime()) / 86400000;
        return !(age > EXPIRE_DAYS);
    }

    // Wait until no other popup (like the "rules updated" notice) is open
    function autoShow() {
        let pg = page();
        if (!shouldAuto(pg)) return;
        let tries = 0;
        let tick = () => {
            if (document.querySelector('[data-apx-rules-popup], .apxdlg-back, .apxd-ask') && tries++ < 120) { setTimeout(tick, 1000); return; }
            if (!document.querySelector('.apxpn-back')) show(pg, true);
        };
        setTimeout(tick, 900);
    }

    // Version labels open the notes
    function hookLabels() {
        ['landingVersion', 'settingsVersionLabel', 'gmSettingsVersionLabel'].forEach(id => {
            let el = document.getElementById(id);
            if (!el || el._apxPn) return;
            el._apxPn = true;
            el.style.cursor = 'pointer';
            el.title = 'View patch notes';
            el.addEventListener('click', () => show());
        });
    }

    window.apxPatchNotes = { show, latest: LATEST.version, notes: NOTES };
    let go = () => { hookLabels(); autoShow(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
