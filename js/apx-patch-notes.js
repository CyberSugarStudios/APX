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
        version: 'v2026.9.28.2122',
        released: '2026-09-28T21:22:00',
        releasedText: 'September 28, 2026 · 9:22 PM',
        title: 'Playtest Update',
        intro: 'APX has a home of its own now, playapx.com, and this release gathers up everything our playtest tables asked for. GMs get world rules, loot they can stock anywhere (NPCs, Area Circles, Special Map Markers) and hand out a piece at a time, magic items that grant powers, and NPCs that wear, carry and use their gear. Players get stacking inventories, Luck and Looting, trading, Omen dice to share, Loyal Companions who take their own turns, powers that roll like weapons, weapon properties that apply themselves and a one-screen Origin Builder. Everyone gets maps that stay sharp at any zoom and one dice tray that doubles as the combat log. Type damage in full into any HP box and DR, ER, resistances and immunities come off on their own; when nothing says what kind of damage it was, a quick chooser asks, with an Ignore resistances box. Each character sees only its own world, the GM\'s player list keeps up as players come and go, and pages load faster, especially on phones. Characters and worlds bring themselves up to date when opened, and nothing is lost.',
        index: [
            ['A New Home', [
                'APX has moved to playapx.com. Old links and bookmarks to cybersugarstudios.com open the same page here, and cybersugarstudios.com is now the CyberSugar Studios homepage, with a link to APX.',
                'Characters and worlds belong to your account, not to the address: sign in at playapx.com and it\'s all waiting. Browsers remember sign-ins for each address separately, so you\'ll sign in here once.',
                'Played APX in this browser before? "Bring my browser data" on the playapx.com front page copies over what the browser stored at the old address: theme and settings, character folders, joined worlds, and worlds saved without an account.'
            ]],
            ['For GMs', [
                'World Settings fix Starting XP, Max GP, starting Cu, and Point Buy or Standard Array for everyone in your world.',
                'The Loot Maker builds loot with the players\' own forges and crafters, or as custom items you can edit later, for an NPC, an Area Circle, a Special Map Marker or the Loot list. Make several at once, and change any row\'s count with − and +.',
                'Give hands over one item from a stack ("Black Cloak ×3" becomes ×2) and keeps your chosen player selected; All hands over the lot.',
                'Magic items can change nearly anything on a sheet and grant powers, and NPCs can wear them.',
                'The party list keeps itself current: a player who deletes their character, moves it out of your world or leaves the world drops off it at once, and each world lists only its own players.',
                'Type damage in full. The tracker takes off DR or ER by damage type, plus resistances and immunities, shows its working, and counts a hit that deals 0. With no attack to go by, pick the type from buttons that show the target\'s defences, or tick Ignore resistances.',
                'NPC stat blocks roll their powers with a click, have a SAVE button under each Core Attribute, and suffer conditions just as players do. A stat block tagged with a world appears only in that world.'
            ]],
            ['For Players', [
                'Identical items stack: three Leather Armors from three bandits make one "Leather Armor ×3" row. Equipping takes one from the stack, taking it off puts it back, and older inventories are joined up the first time you open the character.',
                'A new character starts in the world you choose, or in none, and a character with no world sees only Join World, never another world\'s maps, notes or fog.',
                'Leaving a world takes one step: delete the character, move it out of the world folder, or press × on the world folder. You come off the GM\'s player list, and your character stays yours.',
                'Powers roll like weapons, powers from equipped magic items join your list without using a Power Slot, and a 1 AP power can be built as a Reaction.',
                'Luck and Looting, trading, Omen dice you can pass on, and Loyal Companions with their own AP, turns and an HP box that takes damage just like yours.',
                'Luck Points have − and + buttons, clicking your Rest Dice spends one to heal, and four-armed characters get extra arms, hands and a shield in every Off Hand.'
            ]],
            ['At the Table', [
                'One tray holds every roll, the combat log and your messages, and every die has a shape of its own.',
                'The log asks for each save in turn (Wound Threshold, then the hit\'s own saves, then Bleed Out) with a button that rolls it. Players never see the numbers on hits against enemies, so DR and ER stay secret.',
                'Weapon properties apply themselves on a hit, and every weapon has a damage type (unarmed strikes are Bludgeoning).',
                'Damage typed into any HP or Temp HP box, a character\'s, an NPC\'s or a companion\'s, is reduced by its type. When no attack says what it was, a chooser asks, and Ignore resistances lets it through in full. "-5-3" counts as 8.',
                'Everyone\'s AP is tracked, refills on their turn and carries over.'
            ]],
            ['Maps', [
                'Special Map Markers are larger and bright yellow with a dark outline (magenta for the GM while hidden), stay readable when zoomed out, and can hold loot.',
                'Area Circles stay about the same size on screen at any zoom, every marker shows its name the instant your mouse is over it, and a linked NPC\'s name opens that NPC\'s full window.',
                'Linked maps open in one spot on screen, each a little offset from the last, never off the edge.',
                'Maps keep their full resolution: a preview appears straight away and sharp detail loads wherever you zoom.'
            ]],
            ['Rules', [
                'Point Buy: every attribute starts at 4, with 7 points to spend and each attribute between 2 and 7.',
                'NPCs and Loyal Companions can train saving throws for 2 TP each. NPC gear costs Threat Points, and a defeated NPC is worth 1 / 5 / 10 / 15 / 25 / 35 XP at Tiers 0–5, then 10 more for each Tier above.',
                'High Roller, Fortunate Fighter, Regenerative and Mobile are updated, and Power Crafting caps each die step at 8 dice and adds Mythic Utilities.'
            ]],
            ['Also', [
                'Switching from one character to another and back keeps every change you made to each.',
                'Deleting an account removes all of its data. Pages load faster, closed windows no longer leave blurred patches on phones, and an open page moves itself onto a new release.',
                'The Character Sheet and GM Tools notes have all the details.'
            ]]
        ],
        sheet: [
            ['A New Home: playapx.com', [
                'APX\'s home is now playapx.com. Links and bookmarks to the old address (cybersugarstudios.com) open the same page here, and an APX page still open at the old address moves itself here the next time it checks for an update.',
                'Your account comes along: characters, folders you made while signed in, worlds and their maps. Browsers keep sign-ins separately for each address, so sign in once at the new one.',
                'Saved settings are kept per address as well. "Bring my browser data" on the playapx.com front page opens a small window on the old address and fetches what this browser stored there: theme and settings, character folders, joined worlds, and worlds saved without an account. Anything you\'ve already set here is kept, and lists are merged.',
                'Point your bookmarks and home-screen shortcuts at playapx.com.'
            ]],
            ['Inventory Stacks', [
                'Identical items share one row with a count: armor, shields, helmets, weapons, magic items, consumables and everyday gear. Loot from your GM, gifts from other players and gear you take off all join a matching stack.',
                'Equipping takes one item from the stack and leaves the rest in your pack; taking it off puts it back. This works the same for armor, shields, helmets and weapons.',
                'The magic item you\'re wearing gets a row of its own marked Equipped, so it\'s clear which bonuses and powers are in use. Take it off and it rejoins its stack.',
                'Unused consumables stack. The first in the stack shows its charges, and when it runs dry the next full one takes over. A part-used consumable keeps its own row, and when you give away part of a stack, the part-used one stays with you.',
                'Inventories from before this update have their matching rows joined the next time you open the character, with nothing lost.'
            ]],
            ['Characters and Worlds', [
                'When one of your worlds has a free slot, New Character asks where the character plays: in that world, with its rules, races and settings from the first moment, or in no world. The character is saved straight away.',
                'A character sees only its own world. With no world, the World tab shows just the Join World box, and switching characters clears the previous world\'s maps, notes and fog before the next one loads.',
                'Leaving a world: press × on its world folder and confirm. You\'re taken off your GM\'s player list, the world\'s maps, notes and fog leave your sheet, and the character that played there stays in your roster, outside any world. Rejoin whenever you like with the world\'s invite code.',
                'Deleting your character in a world, or moving it out of the world folder, also takes you off the GM\'s player list. Moving a character into a world folder puts you back on it.',
                'Switch to another character and back, and each keeps every change you made to it. Adding a character that isn\'t open to a folder now saves that character, not the one on screen.',
                'Fog of War always matches the world you\'re looking at and always loads, even after clearing browser data, on a new device or for a new character. The map stays covered until its fog is ready.',
                'Deleting the open character takes you back to the character screen, and Undo history stays with the character it belongs to.',
                'Your GM chooses Starting XP, Max GP, starting Cu, and Point Buy or Standard Array. A new character receives the Starting XP and Cu once, and only XP granted after it joined.',
                'XP from your GM includes your bonuses (INT modifier, Educated, Expertise), the XP fields lock while you\'re in a world, and the XP Log beside Spend XP lists everything gained and spent.',
                'Standard Array uses 7, 6, 5, 5, 5, 4 and 3, once each. Point Buy starts every attribute at 4 with 7 points to spend, each between 2 and 7.'
            ]],
            ['Origin Builder', [
                'It all fits on one screen: Origin Name, Starting Wealth and Origin Feature on the left, the common language and four competencies on the right.',
                'Each competency card has Language, Skill and Weapon Type buttons. Pick one, pick another to switch, or tap the chosen one again to clear it.',
                'Starting Wealth goes into your Currency when you save and can only be chosen once, and Save Origin writes your languages into a Languages note.'
            ]],
            ['Powers', [
                'Click a power\'s name or its "Lvl X | Y AP" tag to use it. It spends its AP and a Power Slot (INT: a slot of the power\'s level; CHA: one from your pool), and asks first if you\'re short; "Use anyway" spends what you have.',
                'Attack powers roll the d20 and their damage together, doubling the damage dice on a crit. Save powers roll their effect, show your DC and let your GM know. Powers without a roll show their description.',
                'In the Power Crafter, Attack Roll / Save Negates powers choose one or the other. An Attack Roll power is a Power Attack or a Martial Improvement riding on one of your weapons, and you can switch weapons on the power\'s card.',
                '1 AP or Reaction: a power built at 1 AP (Power Crafter Step 7) can use your Reaction instead. It then reads "Reaction" and costs no AP.',
                'Powers from magic items: equip an item that grants powers and they join your Powers, labelled with the item and how often they can be used ("Once per Full Rest", "3 charges per Full Rest"…). They cost AP but no Power Slot, and they leave your list when you unequip the item.'
            ]],
            ['Magic and Custom Items', [
                'Equippable items can carry any number of bonuses, or penalties if cursed: Core Attributes, skills, AC, DR, ER, one energy resistance, Max HP, Max AP, Speed, Initiative, Wound Threshold, Max Rest Dice, Max Luck Points, Carry Capacity, attack and damage rolls, power attack and DC, saves, checks and extra Power Slots.',
                'Make your own with Add Item (tick Equippable), and edit them later from their details. Items from your GM keep the bonuses and powers they came with: the details list both, and the inventory row shows "Powers: …".',
                'Bonuses and powers work only while the item is equipped, and an item handed to you always arrives unequipped.'
            ]],
            ['Weapons and Shields', [
                'Weapon properties take effect when you hit: Crushing (STR save or Prone, or an extra die against a Prone target), Stunning (CON save or Stunned), Concealed (an extra die against a Surprised target), and Flurry\'s AP discount on your next attack with that weapon this turn.',
                'Every weapon has a damage type, shown on the weapon and on its rolls. Forged weapons use theirs, unarmed strikes are Bludgeoning, and custom or innate weapons choose one. The type decides whether DR or ER applies.',
                'Every weapon shows the hand that holds it: Main Hand, Off Hand, and with four arms (Polymelia) Off Hands 2 and 3. Two-handed weapons take a pair of hands, and choosing a hand that\'s already in use swaps the weapons.',
                'With four arms, the Off, Off 2 and Off 3 shield buttons sit side by side, each with its own Unequip underneath, and every shield you hold adds its +AC/DR/ER.',
                'The Weapon Forge can make thrown weapons Returning for 300 more Currency.'
            ]],
            ['Damage and Defense', [
                'Type the whole damage into your HP box: "-9", "35-9" after the 35 already there, several hits at once ("-5-3" is 8), or with a phone\'s minus sign. Your DR (physical) or ER (energy), resistances, vulnerabilities and immunities come off, by the type of the attack your GM just rolled, or the type you add ("-9 fire"). The tray shows the working.',
                'When nothing says what kind of damage it was, a chooser asks. Each type\'s button shows what your defences do against it (DR 3, ER 2, +5 res, Immune), and ticking "Ignore resistances" takes the damage in full, with no DR, ER, resistance or immunity reducing it.',
                'The Temp HP box works the same way: "-6" is damage (Temp HP takes it first), and a plain number still sets your Temp HP.',
                'A hit that comes to 0 still counts, so its effects (a Stunning save, for example) still happen, and your sheet sends the damage and its working to your GM.',
                'Your GM sees the same AC, DR, ER, Wound Threshold and resistances your sheet shows, with shields, helmet, perks and magic items included.',
                'Defensive Rank 4: while you\'re unarmored, the line under DR and ER gives your DR and ER against traps, hazards and falling.'
            ]],
            ['Conditions and Injuries', [
                'Wound Threshold and Bleed Out: your next CON save decides the Wound, then CON (Survive) sets your Bleed Out rounds. If a Luck reroll or an Omen die turns the Wound save into a success, the GM\'s limb choice disappears and any limb already chosen heals.',
                'When a Critical Hit lands on you, the tray offers "React: Turn to normal hit (Defensive)" with Defensive Rank 5 while unarmored, and "React: Break Helmet (normal hit)" with an intact Helmet. Either one returns the crit\'s extra damage and adjusts your Wound save.',
                'A Torso Wound adds a die to every hit on you (the largest die the attack rolled), both legs Wounded keeps you Prone until one heals, and four arms add Left Arm 2 and Right Arm 2 to the Wound list.',
                'Stunned starts your turn with 0 AP, and a Stunning weapon\'s stun ends at the end of the attacker\'s next turn. Burning deals 1d10 Fire at the start of your turn, ignoring ER.',
                'Unconscious, Paralyzed and Incapacitated stop attacks and powers and automatically fail the right checks. Conditions bring along the conditions they include, and Permanent Injuries are tracked.'
            ]],
            ['Dice and Notifications', [
                'Rolls, rest results, XP, loot, HP changes and warnings share one tray, with a red dot when something new arrives.',
                'During a fight the tray is the combat log, and each save your GM needs has a button that rolls it with your bonuses, in the order asked.',
                'Every die has its own shape: triangles for the d4 and d8 (the d8 points down), a square d6, a kite d10, a pentagon d12, a hexagon d20 and a round d100. Omen dice are purple hexagons.',
                'Click skills, saves, attributes, weapons, damage and powers to roll them, with perks, Advantage, Disadvantage, crits and Luck rerolls built in. The d4–d100 buttons build a dice pool.',
                'Fortunate Fighter Rank 5 turns a hit into a Critical Hit for a Luck Point, once per turn. High Roller, Melee Prowess and Sharpshooter apply themselves, and a Dice Explosion shows every die it adds.'
            ]],
            ['Omen', [
                'Your Omen dice wait in the dice tray. Pass one to the GM (for any creature\'s d20) or to a party member, as rolled or, at Rank 2, plus or minus your LUC modifier.',
                'Each Omen die has its own buttons on your rolls and your companion\'s, and at Rank 3 one can swap places with a natural 1 or 20.',
                'On a Full Rest, choose which Omen dice to reroll (Ranks 1–4), or put your Natural 1, 10 and Natural 20 in the slots you want (Rank 5).'
            ]],
            ['Rest, Recover and Luck', [
                'Luck Points: − spends one and + gets one back.',
                'Click the Rest Dice die, or the words "Rest Dice", to spend one and heal the roll plus your CON modifier. At full HP nothing is spent.',
                'Short Rest, Full Rest, Shake it Off and Shrug It Off each have a button, and your GM\'s log says where the healing came from. Regenerative costs 3 GP and adds a Regen button on your turn.'
            ]],
            ['Luck and Looting', [
                'Loot / Scavenge, next to + Add Item, rolls Currency (LUC × enemies defeated ÷ 2), Ammunition (LUC − 3d6 rounds) or an hour of scavenging for Crafting Materials.',
                'When your GM calls for a Loot roll, it opens with the enemy count already filled in, and your result goes back to the GM.'
            ]],
            ['Loyal Companions', [
                'Your companion has AP pips of its own, which empty when a fight begins and refill on its turn. Attacks from its stat block and its powers\' Use buttons spend them.',
                'Its HP box takes damage just like yours: "-6", "-6 fire", or the quick chooser with Ignore resistances, reduced by its DR, ER, resistances and immunities. "+3" heals and a plain number sets its HP.',
                'Its stat block has a SAVE button under each Core Attribute, and Saving Throw Training (2 TP each) adds its Training Bonus to one save.',
                'Its HP matches everywhere, each Rest Die you use heals it too, it can have its own token art, it can carry a Shield and Helmet, and your Omen dice work on its rolls.'
            ]],
            ['Party and Trading', [
                'The Party tab lists everyone in your world, with each companion beside its owner.',
                'Give moves an item, or several from a stack, to a party member, where it joins their matching stack. Gear, magic items and Cu from your GM arrive with a notice.'
            ]],
            ['Action Points', [
                'AP is 6 plus half your AGI modifier (at least 6), minus Fatigue, plus item bonuses, and unspent AP carries over.',
                'Your AP empties when a fight begins and refills on your turn, with or without a map (1 AP if you\'re Surprised). Standing up from Prone costs 2 AP in combat.',
                'Attacks and powers spend their own AP, and you\'re asked first when you\'re short or a perk might change the cost.'
            ]],
            ['Maps', [
                'Special Map Markers (the single letters your GM places) are larger and bright yellow with a dark outline, easy to spot on light and dark maps alike, and never too small to read when zoomed out.',
                'Area Circles stay about the same size on screen at any zoom: a single building when zoomed in, never more than 3% of the map when zoomed out.',
                'Rest your mouse on any marker and its name appears at once.',
                'Linked maps open in the same spot on screen, each slightly offset from the one before.',
                'Your GM\'s maps stay sharp as you zoom, loading full-resolution detail for the part you\'re looking at. Press M to measure.'
            ]],
            ['Rules', [
                'High Roller, Fortunate Fighter (Rank 1 uses LUC for AC when that\'s higher), Mobile and Regenerative are rewritten or updated.',
                'Power Crafting allows at most 8 dice per die step, Sacrifice keeps the caster from regaining HP until their next turn, and Mythic Utilities cost a flat 130 XP. Powers this affects show "Recraft (Free)".'
            ]],
            ['Layout and Account', [
                'Settings sits beside World, and Undo and Redo are at the bottom of the Roster menu (Ctrl+Z and Ctrl+Y still work).',
                'The Owned perk filter shows the perks you can still upgrade and hides maxed ones.',
                'Small text is larger, pages load faster (the styling is one small prebuilt file), and closed windows no longer blur the page behind them on phones.',
                'Delete Account removes every character, folder, world and image tied to your account, along with the settings this browser saved.'
            ]]
        ],
        gm: [
            ['A New Home: playapx.com', [
                'APX lives at playapx.com now, and cybersugarstudios.com is the CyberSugar Studios homepage, with a link to APX. Old links to the character sheet, GM Tools and the rest of APX open the same place on playapx.com.',
                'Worlds, maps, fog, NPCs, races and loot are stored in your account, not in the web address, so they\'re all there when you sign in at playapx.com. Invite codes, players and their characters don\'t change.',
                '"Bring my browser data" on the playapx.com front page copies over what this browser stored at the old address, including worlds saved without an account. Map tiles download again the first time you open each map at the new address.',
                'Ask your players to sign in at playapx.com and update their bookmarks.'
            ]],
            ['Your Party List', [
                'The party list follows your world\'s players as they come and go. A player who deletes their character in your world, moves it out of the world folder, or leaves the world (× on its folder) drops off the list straight away, and so does anyone you kick.',
                'Switching to another world shows only that world\'s players. A party loaded from a folder of character files stays until you load another.',
                'The World tab\'s Players list updates itself while it\'s open.'
            ]],
            ['Damage and the Tracker', [
                'All damage runs through one system: the HP box, the Temp HP box, and damage players type on their sheets. It works out the attack that hit, its damage type, extra dice, the target\'s defences, HP and the log, then Reactions, the Wound Threshold save, the weapon\'s own saves and Bleed Out. It works before Start Combat and without a battle map.',
                'Type the whole damage ("-8"). The target\'s DR (physical) or ER (energy) comes off, along with Damage Resistances, Vulnerabilities, Immunities and weapons that ignore DR/ER. The type comes from the last attack roll, or from what you add ("-8 fire"). "70-7" in a box showing 70 means 7 damage, "-5-3" adds up to 8, phone minus signs work, and clicking a box selects its number.',
                'When nothing says what kind of damage it was, a chooser opens with a button for each type showing the target\'s defence against it (DR 5, ER 3, +5 res, Immune). Tick "Ignore resistances" for damage nothing reduces; typing "-8 true" does the same without the chooser.',
                'Each row shows the DR and ER in use, live from the NPC\'s stat block or the player\'s own sheet, plus a "Last hit" line with the working. NPCs without a stat block get DR and ER boxes, and a Loyal Companion\'s resistances, vulnerabilities and immunities count as well as its DR and ER.',
                'A hit that deals 0 is still a hit. Players read "Ari hit Goblin."; you read the damage, or "…but Goblin took no damage."',
                'A Torso Wound adds the attack\'s largest die, Incapacitated targets take every hit as a Critical Hit, Crushing, Stunning and Concealed apply to the target, and a Stunning weapon\'s stun ends at the end of the attacker\'s next turn.',
                'Critical Hit Reactions (Defensive Rank 5, or breaking a Helmet) return the crit\'s extra damage and re-check the Wound Threshold.',
                'When a player fails a Wound save, your tray offers a button for each limb (Left Arm 2 and Right Arm 2 for four arms), and a Luck or Omen reroll that saves them withdraws the choice.'
            ]],
            ['Map Marker Popups', [
                'In an Area Circle or Special Map Marker you\'re editing, "+ Add Sub-note" sits right under the sub-notes and above the Loot section, one click away.',
                'Click a linked NPC\'s name and that NPC\'s full window opens, the same one the World NPC list opens: portrait, role, description, sub-notes, carried loot, Edit, and a Stat Block button when one is linked.',
                'Each popup keeps its own loot (a chest, a hidden cache, a shop counter), stocked with + Loot Maker, no NPC needed. NPCs keep their carried loot on their stat blocks and windows.'
            ]],
            ['Several of an Item', [
                'Making a consumable for loot? The Consumable Crafter\'s last step has a "How many" box beside Give to NPC / Add to Loot, so five Healing Draughts take one trip through the crafter, not five.',
                'Every loot row has − and + to change the count: an NPC\'s carried loot, Area Circles, Special Map Markers and the Loot Maker\'s own list. + adds another of exactly the same item, whatever it is.',
                'An item that\'s already there joins its stack instead of starting a new row, NPC consumables included.',
                'An NPC\'s stack of consumables shares its charges: "3× Healing Draught" at 2 charges each shows 6/6 charges on the stat block, and Use draws from the stack (3 AP and one charge, tracked separately for each creature in initiative).',
                'When the NPC falls, what\'s left drops as a stack: after 5 of 12 charges are used, 4 Healing Draughts land in the Loot panel, the first with 1 charge left.'
            ]],
            ['Handing Out Loot', [
                'Give hands over one item from a stack: "Black Cloak ×3" becomes ×2 and the player you picked stays selected, so pressing Give again passes the next one. When the last one goes, the row goes too.',
                'Stacks also have an All button beside Give that hands over the whole stack in one go, handy for ammunition.',
                'It works the same in the Loot panel, Area Circles, Special Map Markers and an NPC\'s carried loot, and your log records the count ("Ari took 2× Torch from Area A (Tent)").',
                'Identical drops from one creature share a row, and players\' inventories stack identical items too, so the same armor looted from several enemies becomes one "Leather Armor ×3" row.',
                'Loot stays yours alone until you give it, items always arrive in a player\'s pack unequipped, and your log records who took what and from where.'
            ]],
            ['World Settings', [
                'Set your world\'s Starting XP (default 25), Max GP (default 15), starting Cu, and Point Buy or Standard Array.',
                'Players in your world can\'t edit their own XP or Max GP, and Grant XP adds each player\'s bonuses and keeps the reason.'
            ]],
            ['World NPCs', [
                'Every NPC window has a Stat Block button whenever a stat block is linked.',
                'Tag a stat block with worlds (NPC Roster → World) and it appears only in those worlds: in the NPC Roster, the Saved NPC list for initiative, and Link Stat Block. Untagged stat blocks appear everywhere. Each list says how many it\'s hiding, and the Roster\'s "Show all" brings them back for re-tagging.'
            ]],
            ['Special Map Markers', [
                'Special Map Markers (the single-letter markers from * Special) are larger and far brighter: bright yellow once revealed and bright magenta while hidden, each with a crisp dark outline that reads on parchment, stone or night maps. Zoomed out, they never shrink below a readable size.',
                'Each marker holds its own loot, just like an Area Circle: stock it with + Loot Maker (a trapped altar\'s offering, a secret door\'s cache), then hand out the items and Cu, or split the Cu across the party. The loot is stored with the marker and stays hidden from players until given.',
                'The popup header shows the marker\'s letter in its own colour, and hovering shows its name ("Marker T" if it has none).'
            ]],
            ['Loot Maker', [
                'Make loot with the players\' own tools: the Weapon Forge and Armor Forge (free for you), the Consumable Crafter, the Adventuring Gear list, quick custom weapons, custom items, Shields and Helmets.',
                'Custom items can be equippable, with any number of bonuses or penalties: Core Attributes, skills, AC, DR, ER, one energy resistance, Max HP, Max AP, Speed, Initiative, Wound Threshold, Rest Dice, Luck Points, Carry Capacity, attack and damage rolls, power attack and DC, saves, checks and Power Slots.',
                'Item powers: under "Powers while equipped", + Craft Power opens the Power Crafter above the Loot Maker (nothing is charged, and it finishes with "Add Power to Item"), or copy a power from any of your NPCs. Whoever equips the item gets its powers: players in their Powers list, NPCs on their stat block.',
                'Every custom item has an Edit button wherever it is: an NPC\'s gear, an Area Circle, a Special Map Marker, the Loot list or the Loot Maker\'s own list. The form reopens filled in, bonuses and powers included, and Save Changes updates the item in place.',
                'Open the Loot Maker from the Loot panel, an NPC, an Area Circle or a Special Map Marker.'
            ]],
            ['NPC Gear', [
                'NPCs carry items and Currency, added in the NPC Crafter or from the NPC\'s window, at no Threat Point cost.',
                'Equippable items an NPC carries have an Equip / Equipped button in its loot list and Equip / Unequip on its stat block. While worn, their bonuses count on the stat block (attributes, AC, DR, ER, HP, AP, Speed, Initiative, saves, skills, attack and damage, power attack and DC), their energy resistances reduce damage in the tracker, and their powers join the stat block\'s Powers marked "From <item>".',
                'A slain NPC drops its equipment, whatever it still carries and its Currency into the Loot panel, with worn items taken off.'
            ]],
            ['Loot After a Fight', [
                'Fallen enemies\' gear lands in the Loot panel, grouped by who dropped it. Choose a player beside an item and press Give (or All for a stack), or ✕ anything that didn\'t survive.',
                'Currency is LUC (Loot) × enemies defeated ÷ 2. The panel counts this fight\'s defeated enemies, adds the Currency fallen NPCs carried, and can ask the whole party or a single player to roll.'
            ]],
            ['NPC Powers, Saves and Conditions', [
                'On any NPC or Loyal Companion stat block, click a power\'s name or its "Lvl X | Y AP" tag to use it, as players do. Attack powers roll d20 + Power Attack Bonus with their damage, save powers show the DC and roll their effect, and the rest show their description. The AP comes off the creature taking its turn, and a Reaction power costs none.',
                '1 AP or Reaction: a 1 AP power (Power Crafter Step 7) can be marked as a Reaction, and its tag then reads "Reaction".',
                'Every stat block has a SAVE button under each Core Attribute, and Saving Throw Training (Step 5, 2 TP each) adds the Training Bonus to one save.',
                'Conditions affect NPCs the way they affect players: Stunned, Incapacitated, Paralyzed, Unconscious and Bleeding Out leave no AP at the start of their turn, Burning rolls 1d10 Fire, Poisoned, Frightened, Blinded, Prone and the rest add Disadvantage or Advantage, and Paralyzed automatically fails STR and AGI.',
                'Remove Power asks for confirmation in front of the NPC Crafter, where you can see it.'
            ]],
            ['NPC Crafter and Weapon Forge', [
                'NPC weapons stay fully editable: reopen one in the Weapon Forge to change melee or ranged, Light, Medium or Heavy, and its damage type at any time.',
                'Stat blocks show which hand holds each weapon, with ⇄ to switch. Shields (4 TP) and Helmets (2 TP) count free hands, with an Equip/Stow Shield button.',
                'Each +2 DR/ER purchase adds 2, manufactured weapons and armor cost Threat Points, and XP rewards are 1 / 5 / 10 / 15 / 25 / 35 for Tiers 0–5, then 10 more for each Tier above.',
                'The Power Crafter allows at most 8 dice per die step and adds Mythic Utilities (a flat 130 XP).'
            ]],
            ['Initiative and Combat', [
                'The tracker stands on its own and uses a battle map only when one is open or chosen as the fight\'s Battle map.',
                'Every creature\'s AP is tracked and carries over. Surprised creatures get 1 AP on their first turn, and players\' AP refills on their turn even without a map.',
                'The combat log lives in the dice tray: players see hits on enemies without numbers, while you see every amount and every real name.',
                'Players roll their saves from their own tray and NPCs from a button in your log, and End Combat checks whether anyone is still Bleeding Out.',
                'An Omen die a player passes you waits in your tray and can replace any creature\'s d20.'
            ]],
            ['Party and Companions', [
                'Party stat blocks show each player\'s AC, DR, ER, Max HP, AP, Initiative and Wound Threshold exactly as their sheet does.',
                'Loyal Companions sit under their owners with stat blocks, token art and + Initiative, and their HP follows their owner\'s sheet, including damage typed into the companion\'s HP box there.'
            ]],
            ['Maps', [
                'Linked maps open in the same spot: the first near the middle of the screen, each next one slightly offset, and never off screen however many are open.',
                'Hover over an Area Circle or Special Map Marker and its name appears at once, for you and your players.',
                'Area Circles stay about the same size on screen as you zoom: one building on a city map zoomed in, never more than 3% of the map zoomed out.',
                'Upload maps of any size: a compressed preview loads instantly and full-resolution tiles load as you zoom, seamlessly and without a paid Firebase plan.',
                'Shift+drag moves groups of tokens, images have layers, M measures, F toggles the fog painter, and windows resize from the corner grip.'
            ]],
            ['Worlds and Accounts', [
                'Deleting a world removes its maps, fog, portraits, images, invite code and player list, and deleting your account does that for every world you run, plus your characters, races, NPCs and profile.',
                'Your Firestore rules stay as they are (FIREBASE_RULES.txt, v2026.9.25b): nothing in them depends on the web address, and players could already remove themselves from a world.'
            ]],
            ['Fixes', [
                'Players who deleted their character or left your world no longer linger in the party list.',
                'Hovering over an Area Circle on your own maps shows its name as intended.',
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
    // APX moved (the old address's version.json says { movedTo: 'https://playapx.com' }): same page, new home
    function movedUrl(j) {
        try {
            if (!j || !j.movedTo) return null;
            let to = new URL(j.movedTo);
            if (to.origin === location.origin) return null;
            let u = new URL(location.pathname.replace(/^.*\//, '/') + location.search + location.hash, to.origin);
            u.searchParams.set('apxmoved', '1');
            return u.toString();
        } catch (e) { return null; }
    }
    function movedBanner(url) {
        if (document.getElementById('apxMovedBanner')) return;
        let b = document.createElement('div');
        b.id = 'apxMovedBanner';
        b.style.cssText = 'position:fixed;left:50%;bottom:1rem;transform:translateX(-50%);z-index:2147483000;background:#052e2b;border:1px solid #10b981;color:#d1fae5;font:700 .78rem system-ui,sans-serif;padding:.5rem .75rem;border-radius:.6rem;display:flex;gap:.6rem;align-items:center;box-shadow:0 8px 30px rgba(0,0,0,.6);max-width:calc(100vw - 2rem)';
        b.innerHTML = `<span>APX has moved to ${esc(new URL(url).host)}.</span><button style="background:#059669;color:#fff;border:0;border-radius:.4rem;padding:.3rem .6rem;font-weight:800;cursor:pointer">Go there</button>`;
        b.querySelector('button').onclick = () => location.replace(url);
        document.body.appendChild(b);
    }
    function recheck(reloadNow) {
        if (!/^https?:/.test(location.protocol)) return;
        fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => {
            let mv = movedUrl(j); if (mv) { movedBanner(mv); return; }
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
            let mv = movedUrl(j); if (mv) { location.replace(mv); return; }
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
