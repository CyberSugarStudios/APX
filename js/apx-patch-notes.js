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
        version: 'v2026.9.27.1107',
        released: '2026-09-27T11:07:00',
        releasedText: 'September 27, 2026 · 11:07 AM',
        title: 'Playtest Update',
        intro: 'This release is built from what came up at our playtest tables. GMs can set world rules, stock NPCs, Area Circles and Special Map Markers with the Loot Maker, make magic items that grant powers, and run NPCs that wear, carry and use their gear. Players get Luck and Looting, trading, shareable Omen dice, Loyal Companions with their own turns, powers that roll like weapons, weapon properties that apply themselves, a one-screen Origin Builder, maps that stay sharp at any zoom, and one dice tray that is also the combat log. Type damage in full, on the tracker or on a sheet, and DR, ER, resistances and immunities come off by themselves. Every character sees only its own world and fog. Pages load faster, especially on phones, and existing characters and worlds update themselves when opened, with nothing lost.',
        index: [
            ['For GMs', [
                'World Settings: Starting XP, Max GP, starting Cu, and Point Buy or Standard Array for everyone in your world.',
                'Loot Maker: build loot with the players\' own forges and crafters, or make custom items you can edit at any time. Put it on an NPC, an Area Circle, a Special Map Marker or the Loot list.',
                'Magic items can change almost anything on a sheet and can grant powers. NPCs equip them with a toggle.',
                'Type damage in full: the tracker removes DR or ER by damage type, plus resistances and immunities, shows its math, and counts a hit that deals 0.',
                'NPC stat blocks roll their powers with a click, have a SAVE button under each Core Attribute, and suffer conditions just as players do.',
                'Stat blocks tagged with a world only appear in that world. Untagged ones appear in all of them.'
            ]],
            ['For Players', [
                'Pick a world for each new character, or none. A character without a world sees only the Join World box, never another world\'s maps, notes or fog.',
                'Powers roll like weapons: click one to spend its AP and a Power Slot and roll it. Powers from equipped magic items join your list and need no slot.',
                'A power that costs 1 AP can be built as a Reaction instead.',
                'Luck and Looting, trading, Omen dice you can pass on, and Loyal Companions with their own AP and turns.',
                'Luck Points have − and + buttons, and clicking your Rest Dice spends one to heal.',
                'Four-armed characters get Left Arm 2 and Right Arm 2, two more hands for weapons, and a shield in every Off Hand.'
            ]],
            ['At the Table', [
                'One tray for every roll, the combat log and your messages, with a distinct shape for every die.',
                'The log asks for each save in turn (Wound Threshold, the hit\'s own saves, Bleed Out) with a button to roll it. Hits on enemies show players no numbers, so DR and ER stay secret.',
                'Weapon properties apply on a hit, and every weapon has a damage type (unarmed strikes are Bludgeoning).',
                'AP is tracked for everyone, refills each turn and carries over.'
            ]],
            ['Maps', [
                'Special Map Markers are larger and bright: yellow with a dark outline (magenta for you while still hidden), and never too small to read when zoomed out. They can hold loot too.',
                'Area Circles keep about the same size on screen at any zoom, and every marker shows its name the moment your mouse is over it.',
                'Linked maps open in the same place on screen, each slightly offset, never off the edge.',
                'Maps keep their full resolution: a preview opens at once and sharp detail loads where you zoom.'
            ]],
            ['Rules', [
                'Point Buy: attributes start at 4 with 7 points, each between 2 and 7.',
                'NPCs and Loyal Companions train saving throws for 2 TP each. NPC gear costs Threat Points, and defeated NPCs are worth 1 / 5 / 10 / 15 / 25 / 35 XP for Tiers 0–5, then 10 more per Tier.',
                'High Roller, Fortunate Fighter, Regenerative and Mobile are updated. Power Crafting caps each die step at 8 dice and adds Mythic Utilities.'
            ]],
            ['Also', [
                'Deleting an account removes all of its data. Pages load faster, closed windows no longer leave blank patches on phones, and an open page moves itself onto a new release.',
                'The Character Sheet and GM Tools have the full details.'
            ]]
        ],
        sheet: [
            ['Characters and Worlds', [
                'If one of your worlds has an open slot, New Character asks where the character plays: in that world, with its rules, races and settings from the first moment, or in no world. It is saved right away.',
                'A character only ever sees its own world. With no world, the World tab holds just the Join World box. Switching characters clears the last world\'s maps, notes and fog before the next one loads.',
                'Fog of War always matches the world on screen and always loads, even after clearing browser data, on a new device, or for a brand-new character. The map stays covered until its fog is ready.',
                'Deleting the character you have open returns you to the character screen, and Undo history stays with the character it belongs to.',
                'Your GM sets Starting XP, Max GP, starting Cu, and Point Buy or Standard Array. A new character gets the Starting XP and Cu once, and only XP granted after it joined.',
                'XP from your GM includes your bonuses (INT modifier, Educated, Expertise), and the XP fields lock while you\'re in a world. The XP Log beside Spend XP lists everything gained and spent.',
                'Standard Array uses 7, 6, 5, 5, 5, 4 and 3 once each. Point Buy starts every attribute at 4 with 7 points, each staying between 2 and 7.'
            ]],
            ['Origin Builder', [
                'Everything fits on one screen: Origin Name, Starting Wealth and Origin Feature on the left, the common language and four competencies on the right.',
                'Each competency card has Language, Skill and Weapon Type buttons. Choose one, choose another to switch, or tap the active one to clear it.',
                'Starting Wealth goes into your Currency when you save and can be chosen once. Save Origin writes your languages into a Languages note.'
            ]],
            ['Powers', [
                'Use a power by clicking its name or its "Lvl X | Y AP" tag. It spends its AP and a Power Slot (INT: a slot of its level; CHA: one from the pool), asking first if you\'re short. "Use anyway" spends whatever you have.',
                'Attack powers roll the d20 and damage together, doubling the damage dice on a crit. Save powers roll their effect and show your DC, and your GM is told. Powers with no roll show their description.',
                'Attack Roll / Save Negates powers pick one in the Power Crafter. An Attack Roll is either a Power Attack or a Martial Improvement riding one of your weapons, which you can switch on the power\'s card.',
                '1 AP or Reaction: a power built at 1 AP (Power Crafter Step 7) can be set to use your Reaction instead. It then reads "Reaction" and costs no AP.',
                'Powers from magic items: equip an item that grants powers and they appear in your Powers, labelled with the item and how often they can be used ("Once per Full Rest", "3 charges per Full Rest"…). They cost AP but no Power Slot, and they go away when you unequip the item.'
            ]],
            ['Magic and Custom Items', [
                'Equippable items can carry any number of bonuses, or penalties when cursed: Core Attributes, skills, AC, DR, ER, one energy resistance, Max HP, Max AP, Speed, Initiative, Wound Threshold, Max Rest Dice, Max Luck Points, Carry Capacity, attack and damage rolls, power attack and DC, saves, checks and extra Power Slots.',
                'Make your own with Add Item (tick Equippable) and edit them from their details. Items from your GM keep the bonuses and powers they were given: the details list both, and the inventory row shows "Powers: …".',
                'Bonuses and powers count only while the item is equipped, and items handed to you always arrive unequipped.'
            ]],
            ['Weapons and Shields', [
                'Weapon properties apply when you hit: Crushing (STR save or Prone, or an extra die against a Prone target), Stunning (CON save or Stunned), Concealed (an extra die against a Surprised target), and Flurry\'s AP discount on your next attack with it that turn.',
                'Every weapon has a damage type, shown on the weapon and its rolls. Forged weapons use theirs, unarmed strikes are Bludgeoning, and custom or innate weapons pick one. The type decides whether DR or ER applies.',
                'Every weapon shows the hand holding it: Main Hand, Off Hand, and Off Hands 2 and 3 with four arms (Polymelia). Two-handed weapons take a pair, and picking a hand that\'s in use swaps the weapons.',
                'With four arms, Off, Off 2 and Off 3 shield buttons sit side by side, each with its own Unequip beneath. Every shield held adds its +AC/DR/ER.',
                'Thrown weapons can be made Returning in the Weapon Forge for 300 more Currency.'
            ]],
            ['Damage and Defense', [
                'Type the whole damage into your HP box: "-9", "35-9" after the 35 already there, or with a phone\'s minus sign. Your DR (physical) or ER (energy), resistances, vulnerabilities and immunities come off, using the type of the attack your GM just rolled. "-9 fire" names the type; otherwise you\'re asked. The tray shows the math.',
                'A hit that works out to 0 still counts, so its effects (a Stunning save, say) still happen. Your sheet sends the damage and its math to your GM.',
                'Your GM sees the AC, DR, ER, Wound Threshold and resistances your sheet shows, with shields, helmet, perks and magic items included.',
                'Defensive Rank 4: while unarmored, the line under DR and ER shows your DR and ER against traps, hazards and falling.'
            ]],
            ['Conditions and Injuries', [
                'Wound Threshold and Bleed Out: your next CON save settles the Wound, then CON (Survive) sets your Bleed Out rounds. If a Luck reroll or Omen die turns the Wound save into a success, the GM\'s limb choice vanishes and any limb already picked heals.',
                'When a Critical Hit lands on you, the tray offers "React: Turn to normal hit (Defensive)" with Defensive Rank 5 while unarmored, and "React: Break Helmet (normal hit)" with an intact Helmet. Either one returns the crit\'s extra damage and adjusts your Wound save.',
                'A Torso Wound adds one die to each hit on you, the largest die the attack rolled. Both legs Wounded leaves you Prone until a leg heals. Four arms add Left Arm 2 and Right Arm 2 to the Wound list.',
                'Stunned starts your turn with 0 AP, and a Stunning weapon\'s stun ends at the end of the attacker\'s next turn. Burning deals 1d10 Fire at the start of your turn, ignoring ER.',
                'Unconscious, Paralyzed and Incapacitated stop attacks and powers and auto-fail the right checks. Conditions add the conditions they include, and Permanent Injuries are tracked.'
            ]],
            ['Dice and Notifications', [
                'Rolls, rest results, XP, loot, HP changes and warnings share one tray, with a red dot when something is new.',
                'During a fight the tray is the combat log. Each save your GM needs has a button that rolls it with your bonuses, in the order asked.',
                'Each die has its own shape: d4 and d8 triangles (the d8 points down), a square d6, a kite d10, a pentagon d12, a hexagon d20 and a round d100. Omen dice are purple hexagons.',
                'Click skills, saves, attributes, weapons, damage and powers to roll them, with perks, Advantage, Disadvantage, crits and Luck rerolls built in. The d4–d100 buttons build a dice pool.',
                'Fortunate Fighter Rank 5 turns a hit into a Critical Hit for a Luck Point, once a turn. High Roller, Melee Prowess and Sharpshooter apply themselves, and a Dice Explosion shows every die it adds.'
            ]],
            ['Omen', [
                'Your Omen dice wait in the dice tray. Pass one to the GM (for any creature\'s d20) or to a party member, as rolled or (Rank 2) plus or minus your LUC modifier.',
                'Every Omen die has its own buttons on your rolls and your companion\'s, and at Rank 3 one can swap with a natural 1 or 20.',
                'On a Full Rest, choose which Omen dice to reroll (Ranks 1–4), or place your Natural 1, 10 and Natural 20 in the slots you want (Rank 5).'
            ]],
            ['Rest, Recover and Luck', [
                'Luck Points: − spends one and + regains one.',
                'Click the Rest Dice die, or the words "Rest Dice", to spend one and heal the roll plus your CON modifier. At full HP nothing happens.',
                'Short Rest, Full Rest, Shake it Off and Shrug It Off each have a button, and your GM\'s log says where the healing came from. Regenerative costs 3 GP and gives you a Regen button on your turn.'
            ]],
            ['Luck and Looting', [
                'Loot / Scavenge, beside + Add Item, rolls Currency (LUC × enemies defeated ÷ 2), Ammunition (LUC − 3d6 rounds), or an hour of scavenging for Crafting Materials.',
                'When your GM asks for a Loot roll it opens with the enemy count ready, and your result goes back to the GM.'
            ]],
            ['Loyal Companions', [
                'Your companion has its own AP pips. They empty when a fight begins and refill on its turn, and attacks from its stat block and its powers\' Use buttons spend them.',
                'Its stat block has a SAVE button under each Core Attribute, and Saving Throw Training (2 TP each) adds its Training Bonus to one save.',
                'Its HP matches everywhere, each Rest Die you use heals it too, it can have its own token art, and it can carry a Shield and Helmet. Your Omen dice work on its rolls.'
            ]],
            ['Party and Trading', [
                'The Party tab lists everyone in your world, each companion beside its owner.',
                'Give moves an item to a party member. Gear, magic items and Cu from your GM land in your inventory with a notice.'
            ]],
            ['Action Points', [
                'AP is 6 + half your AGI modifier (at least 6), minus Fatigue, plus item bonuses. Unspent AP carries over.',
                'Your AP empties when a fight begins and refills on your turn, with or without a battle map (1 AP if Surprised). Standing up from Prone costs 2 AP in combat.',
                'Attacks and powers spend their own AP, and you\'re asked first when you\'re short or a perk might change the cost.'
            ]],
            ['Maps', [
                'Special Map Markers (the single letters your GM places) are bigger and bright yellow with a dark outline, so they stand out on light and dark maps alike, and they never shrink too small to read when you zoom out.',
                'Area Circles keep about the same size on screen at any zoom: one building when zoomed in, never more than 3% of the map when zoomed out.',
                'Rest your mouse on any marker and its name appears instantly.',
                'Linked maps open in the same place on screen, each a little offset from the last.',
                'Your GM\'s maps stay sharp as you zoom, with full-resolution detail loading for the part you\'re viewing. Measure with M.'
            ]],
            ['Rules', [
                'High Roller, Fortunate Fighter (Rank 1 uses LUC for AC when it\'s higher), Mobile and Regenerative are rewritten or updated.',
                'Power Crafting allows at most 8 dice per die step, Sacrifice stops the caster regaining HP until their next turn, and Mythic Utilities cost a flat 130 XP. Affected powers show "Recraft (Free)".'
            ]],
            ['Layout and Account', [
                'Settings sits beside World, and Undo and Redo are at the bottom of the Roster menu (Ctrl+Z and Ctrl+Y still work).',
                'The Owned perk filter shows perks you can still upgrade and hides maxed ones.',
                'Small text is larger, pages load faster (the styling is one small prebuilt file), and closed windows no longer blur the page behind them on phones.',
                'Delete Account removes every character, folder, world and image tied to your account, and this browser\'s saved settings.'
            ]]
        ],
        gm: [
            ['World Settings', [
                'Choose your world\'s Starting XP (default 25), Max GP (default 15), starting Cu, and Point Buy or Standard Array.',
                'Players in your world can\'t edit their own XP or Max GP. Grant XP adds each player\'s bonuses and keeps the reason.'
            ]],
            ['Special Map Markers', [
                'Special Map Markers (the single-letter markers from * Special) are larger and much brighter: bright yellow once revealed, bright magenta while still hidden, each with a crisp dark outline that reads on parchment, stone or night maps. Zoomed out, they never shrink below a readable size.',
                'Each one now holds its own loot, just like an Area Circle: open the marker and use + Loot Maker to stock it (a trapped altar\'s offering, a secret door\'s cache), then hand items and Cu to a player or split the Cu across the party. Loot is stored with the marker and stays hidden from players until you give it.',
                'The popup header shows the marker\'s own letter and colour, and hovering over a marker shows its name (or "Marker T" if it has none).'
            ]],
            ['Loot Maker', [
                'Make loot with the players\' own tools: the Weapon Forge and Armor Forge (free for you), the Consumable Crafter, the Adventuring Gear list, quick custom weapons, custom items, Shields and Helmets.',
                'Custom items can be equippable, with any number of bonuses or penalties: Core Attributes, skills, AC, DR, ER, one energy resistance, Max HP, Max AP, Speed, Initiative, Wound Threshold, Rest Dice, Luck Points, Carry Capacity, attack and damage rolls, power attack and DC, saves, checks and Power Slots.',
                'Item powers: under "Powers while equipped", + Craft Power opens the Power Crafter over the Loot Maker (nothing is charged; it ends with "Add Power to Item"), or copy a power from any of your NPCs. Whoever equips the item gets its powers: players in their Powers list, NPCs on their stat block.',
                'Every custom item has an Edit button wherever it is: an NPC\'s carried gear, an Area Circle, a Special Map Marker, the Loot list, or the Loot Maker\'s own list. The form reopens filled in, bonuses and powers included, and Save Changes updates the item where it sits.',
                'Open the Loot Maker from the Loot panel, an NPC, an Area Circle or a Special Map Marker.'
            ]],
            ['Loot on Maps', [
                'Area Circles and Special Map Markers each keep their own loot: a chest, a hidden cache, a shop counter. Stock them from their popup with + Loot Maker, no NPC required, and give items and Cu out from there.',
                'A marker\'s popup lists only its own loot. NPCs keep their carried loot on their stat blocks and windows.',
                'Loot is yours alone until you hand it out, and every item arrives in a player\'s pack unequipped. Your log records who took what, and from where ("Ari took Helmet from Marker T (Trapped Altar)").'
            ]],
            ['NPC Stat Blocks and Worlds', [
                'Tag a stat block with worlds (NPC Roster → World) and it appears only in those worlds: in the NPC Roster, in the Saved NPC list for initiative, and in Link Stat Block. Untagged stat blocks appear in every world.',
                'Each list says how many stat blocks it is hiding. The Roster\'s "Show all" brings them back for re-tagging, and "Only this world" returns to the filtered view.'
            ]],
            ['NPC Gear', [
                'NPCs carry items and Currency, added in the NPC Crafter or from the NPC\'s window, at no Threat Point cost.',
                'Equippable items an NPC carries have an Equip / Equipped button in its loot list and Equip / Unequip on its stat block. When worn, their bonuses count on the stat block (attributes, AC, DR, ER, HP, AP, Speed, Initiative, saves, skills, attack and damage, power attack and DC), their energy resistances reduce damage in the tracker, and their powers join the stat block\'s Powers labelled "From <item>".',
                'Consumables show their charges and a Use button: 3 AP and one charge, tracked for each creature in initiative.',
                'A slain NPC drops its equipment, what it still carries and its Currency into the Loot panel, with worn items taken off.'
            ]],
            ['Loot After a Fight', [
                'Fallen enemies\' gear lands in the Loot panel, grouped by who dropped it. Choose a player beside an item and press Give, or ✕ anything that didn\'t survive.',
                'Currency is LUC (Loot) × enemies defeated ÷ 2. The panel counts this fight\'s defeated enemies, adds the Currency fallen NPCs carried, and can ask the whole party or one player to roll.'
            ]],
            ['Damage and the Tracker', [
                'Every way of dealing damage goes through one system: the HP box, the Temp HP box, and damage players type on their sheets. It works out the attack that hit, its damage type, extra dice, the target\'s defences, HP and the log, then Reactions, the Wound Threshold save, the weapon\'s own saves and Bleed Out. It works before Start Combat and without a battle map.',
                'Type the whole damage ("-8"). The target\'s DR (physical) or ER (energy) is removed, along with Damage Resistances, Vulnerabilities, Immunities and weapons that ignore DR/ER. The type comes from the last attack roll; "-8 fire" names it; otherwise one click picks it. "70-7" in a box showing 70 means 7 damage, phone minus signs work, and clicking a box selects its number.',
                'Each row shows the DR and ER in use, live from the NPC\'s stat block or the player\'s own sheet, plus a "Last hit" line with the math. NPCs with no stat block get DR and ER boxes.',
                'A hit dealing 0 is still a hit. Players read "Ari hit Goblin."; you read the damage, or "…but Goblin took no damage."',
                'A Torso Wound adds the attack\'s largest die, Incapacitated targets take every hit as a Critical Hit, Crushing, Stunning and Concealed apply to the target, and a Stunning weapon\'s stun wears off at the end of the attacker\'s next turn.',
                'Critical Hit Reactions (Defensive Rank 5, or breaking a Helmet) return the crit\'s extra damage and re-check the Wound Threshold.',
                'When a player fails a Wound save, your tray offers a button per limb (Left Arm 2 and Right Arm 2 for four arms). A Luck or Omen reroll that saves them withdraws the choice.'
            ]],
            ['NPC Powers, Saves and Conditions', [
                'On any NPC or Loyal Companion stat block, click a power\'s name or its "Lvl X | Y AP" tag to use it, as players do. Attack powers roll d20 + Power Attack Bonus with their damage, save powers show the DC and roll their effect, and the rest show their description. The AP comes off the creature taking its turn; a Reaction power costs none.',
                '1 AP or Reaction: a 1 AP power (Power Crafter Step 7) can be marked as a Reaction, and its tag says "Reaction".',
                'Each stat block has a SAVE button under every Core Attribute. Saving Throw Training (Step 5, 2 TP each) adds the Training Bonus to one save.',
                'Conditions affect NPCs as they do players: Stunned, Incapacitated, Paralyzed, Unconscious and Bleeding Out leave no AP at the start of their turn, Burning rolls 1d10 Fire, conditions like Poisoned, Frightened, Blinded and Prone add Disadvantage or Advantage, and Paralyzed auto-fails STR and AGI.',
                'Remove Power asks for confirmation in front of the NPC Crafter, where you can see it.'
            ]],
            ['NPC Crafter and Weapon Forge', [
                'NPC weapons stay fully editable: reopen one in the Weapon Forge to change melee or ranged, Light, Medium or Heavy, and damage type whenever you like.',
                'Stat blocks show each weapon\'s hand, with ⇄ to switch. Shields (4 TP) and Helmets (2 TP) count free hands, with an Equip/Stow Shield button.',
                'Each +2 DR/ER purchase adds 2, manufactured weapons and armor cost Threat Points, and XP rewards per Tier are 1 / 5 / 10 / 15 / 25 / 35 for Tiers 0–5, then 10 more per Tier.',
                'The Power Crafter allows at most 8 dice per die step and adds Mythic Utilities (a flat 130 XP).'
            ]],
            ['Initiative and Combat', [
                'The tracker stands on its own and uses a battle map only when one is open or picked as the fight\'s Battle map.',
                'Every creature\'s AP is tracked and carries over. Surprised creatures get 1 AP on their first turn, and players\' AP refills on their turn even without a map.',
                'The combat log lives in the dice tray. Players see hits on enemies without numbers, while you see every amount and every real name.',
                'Players roll their saves from their own tray and NPCs from a button in your log. End Combat checks for anyone still Bleeding Out.',
                'An Omen die a player passes you waits in your tray and can replace any creature\'s d20.'
            ]],
            ['Party and Companions', [
                'Party stat blocks show each player\'s AC, DR, ER, Max HP, AP, Initiative and Wound Threshold exactly as their sheet does.',
                'Loyal Companions sit under their owners with stat blocks, token art and + Initiative, and their HP follows their owner\'s sheet.'
            ]],
            ['Maps', [
                'Linked maps open in the same place: the first near the middle of the screen, each next one slightly offset, and never off screen however many are open.',
                'Hover over an Area Circle or Special Map Marker and its name appears at once, for you and your players.',
                'Area Circles keep about the same size on screen as you zoom: one building on a city map zoomed in, never more than 3% of the map zoomed out.',
                'Upload maps of any size: a compressed preview loads instantly and full-resolution tiles load as you zoom, seamlessly and with no paid Firebase plan.',
                'Shift+drag moves groups of tokens, images have layers, M measures, F toggles the fog painter, and windows resize from the corner grip.'
            ]],
            ['Worlds and Accounts', [
                'Deleting a world removes its maps, fog, portraits, images, invite code and player list. Deleting your account does that for every world you run, and removes your characters, races, NPCs and profile.',
                'Update your Firestore rules from FIREBASE_RULES.txt (v2026.9.25b).'
            ]],
            ['Fixes', [
                'Hovering over an Area Circle on your own maps now shows its name as intended.',
                'Pages load faster, and an open page that finds a newer release reloads onto it.',
                'Closed windows no longer blur the page behind them on Android phones, and auto-save holds up through long sessions.'
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

    // ── Never run an old copy ─────────────────────────────────────────────
    // Browsers (and some web hosts) can keep serving an old copy of a page after an update.
    // version.json is fetched fresh every time; if the site has a newer version than this page,
    // the page reloads itself onto a fresh address (?apx=<version>), which no cache can have.
    // A page left open (a phone tab, the GM's laptop) also checks when you come back to it and every
    // 10 minutes: coming back reloads onto the new version, otherwise a banner offers the reload.
    function updateBanner(v) {
        if (document.getElementById('apxUpdateBanner')) return;
        let b = document.createElement('div');
        b.id = 'apxUpdateBanner';
        b.style.cssText = 'position:fixed;left:50%;bottom:1rem;transform:translateX(-50%);z-index:2147483000;background:#1e1b4b;border:1px solid #6366f1;color:#e0e7ff;font:700 .78rem system-ui,sans-serif;padding:.5rem .75rem;border-radius:.6rem;display:flex;gap:.6rem;align-items:center;box-shadow:0 8px 30px rgba(0,0,0,.6);max-width:calc(100vw - 2rem)';
        b.innerHTML = `<span>A new version of APX is ready (${v}).</span><button style="background:#4f46e5;color:#fff;border:0;border-radius:.4rem;padding:.3rem .6rem;font-weight:800;cursor:pointer">Reload</button><button aria-label="Later" style="background:none;border:0;color:#a5b4fc;cursor:pointer;font-weight:800">✕</button>`;
        let [reload, later] = b.querySelectorAll('button');
        reload.onclick = () => { let u = new URL(location.href); u.searchParams.set('apx', v.replace(/^v/, '')); location.replace(u.toString()); };
        later.onclick = () => b.remove();
        document.body.appendChild(b);
    }
    function recheck(reloadNow) {
        if (!/^https?:/.test(location.protocol)) return;
        fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => {
            if (!j || !j.version || j.version === LATEST.version) return;
            let typing = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
            if (reloadNow && !typing) { let u = new URL(location.href); u.searchParams.set('apx', j.version.replace(/^v/, '')); location.replace(u.toString()); }
            else updateBanner(j.version);
        }).catch(() => { });
    }
    let hiddenAt = 0;
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) { hiddenAt = Date.now(); return; }
        if (hiddenAt && Date.now() - hiddenAt > 60000) recheck(true);   // back after a while: pick up any update
    });
    setInterval(() => { if (!document.hidden) recheck(false); }, 600000);
    function checkForUpdate() {
        if (!/^https?:/.test(location.protocol)) return;
        fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => {
            if (!j || !j.version || j.version === LATEST.version) return;
            let key = 'apxReloadedFor';
            let tried = null; try { tried = sessionStorage.getItem(key); } catch (e) { }
            if (tried === j.version) return;   // already tried once this session: don't loop
            try { sessionStorage.setItem(key, j.version); } catch (e) { }
            let u = new URL(location.href);
            u.searchParams.set('apx', j.version.replace(/^v/, ''));
            location.replace(u.toString());
        }).catch(() => { });
    }

    window.apxPatchNotes = { show, latest: LATEST.version, notes: NOTES };
    let go = () => { hookLabels(); autoShow(); checkForUpdate(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
