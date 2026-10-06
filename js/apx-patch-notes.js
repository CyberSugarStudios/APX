// ============================================================
// APX Patch Notes
// ============================================================
// One popup per page: the index shows the overview, the Character Sheet and
// GM Tools show their own detailed notes. Your account remembers when you tick
// "Don't show this again" for a version (signed out, nothing pops up); the notes
// also stop appearing on their own 14 days after release. They can always be
// reopened from Settings → Patch Notes or the version labels.
// ============================================================
(function () {
    'use strict';

    const NOTES = [{
        version: 'v2026.10.6.1630',
        released: '2026-10-06T16:30:00',
        releasedText: 'October 6, 2026 · 4:30 PM',
        title: 'Playtest Update',
        intro: 'APX has a home of its own now, playapx.com, and this release gathers up everything our playtest tables asked for. The tools now use your APX account, with a short tutorial to get new players and GMs started. GMs get world rules, a Library of everything they make, loot they can stock anywhere and hand out a piece at a time (openly or in secret), NPCs with loot of their own, apart from their stat blocks, NPC Wound Thresholds, caster slots and damaging auras, fall damage, and grids styled the way they like. Players get reworked powers (each with its own Core Attribute, drawn from Full Rest or Short Rest pools), stacking inventories, Luck and Looting, trading, Omen dice to share, Loyal Companions who take their own turns, forges that roll in the dice tray, and a one-screen Origin Builder. Everyone gets maps that stay sharp at any zoom, movement paths priced in AP, Cone and Burst measuring, area powers placed right on the battle map with every save in them rolled for you, and one dice tray that doubles as the combat log and the table chat. Type damage in full into any HP box and DR, ER, resistances and immunities come off on their own. Characters and worlds bring themselves up to date when opened, and nothing is lost.',
        index: [
            ['A New Home', [
                'APX has moved to playapx.com. Old links and bookmarks to cybersugarstudios.com open the same page here, and cybersugarstudios.com is now the CyberSugar Studios homepage, with a link to APX.',
                'Characters and worlds belong to your account, not to the address: sign in at playapx.com and it\'s all waiting. Browsers remember sign-ins for each address separately, so you\'ll sign in here once.',
                'Played APX in this browser before? "Bring my browser data" on the playapx.com front page copies over what the browser stored at the old address: theme and settings, character folders, joined worlds, and worlds saved without an account.',
                'The tools now need a free APX account: sign in on the front page to open the Player and GM Tools. New players and GMs get a short tutorial the first time (Settings → Show Tutorial reopens it), and patch notes, the tutorial and your saved colours follow your account to every device.',
                'Two new looks: Kawaii is now a true light theme on every screen, and Cyber Sigil is its hot-pink dark twin.'
            ]],
            ['For GMs', [
                'World Settings fix Starting XP, Max GP, starting Cu, and Point Buy or Standard Array for everyone in your world.',
                'The Loot Maker builds loot with the players\' own forges and crafters, or as custom items you can edit later, for an NPC, an Area Circle, a Special Map Marker or the Loot list. Make several at once, and change any row\'s count with − and +.',
                'Give hands over one item from a stack ("Black Cloak ×3" becomes ×2) and keeps your chosen player selected; All hands over the lot.',
                'Magic items can change nearly anything on a sheet and grant powers.',
                'The party list keeps itself current: a player who deletes their character, moves it out of your world or leaves the world drops off it at once, and each world lists only its own players.',
                'Type damage in full. The tracker takes off DR or ER by damage type, plus resistances and immunities, shows its working, and counts a hit that deals 0. Whenever nothing says what kind of damage it was, a chooser lists every damage type with the target\'s defences against it, plus a Bypass resistances button.',
                'NPC stat blocks roll their powers with a click, have a SAVE button under each Core Attribute, and suffer conditions just as players do. A stat block tagged with a world appears only in that world.',
                'A Library keeps every item, weapon, armor, consumable and power you make, tagged by world, ready to reuse.',
                'NPCs have a Wound Threshold and take Wounds, casters have Power Slots in the tracker, and auras like Damaging Aura show as a ring on the map and deal their damage each turn.',
                'Fall damage, conditions on players straight from the tracker, grid colour, thickness and opacity, token sizes, and loot you can hand out without the rest of the party seeing.',
                'Map windows have a Revealed / Hidden button, and everything you made before the Library existed is gathered into it too.',
                'The World screen has Loot & Items and Powers tabs listing everything in your Library for that world, each with an Edit button.',
                'Before you press Start Combat, players only hear that a creature took damage or went down; the full combat log reaches them once the fight starts.',
                'New NPC traits run themselves in the tracker: Undead (falls Prone and Incapacitated at 0 HP and may rise again) and Unalive Structure (repair-only healing, Stunned by Electric damage). Condition immunities are enforced.',
                'Tokens added with + Token from the tracker start hidden, and companions and summoned creatures act right after their owner.',
                'Grapples, knockouts and summons run themselves in the tracker: whoever\'s next to a Grappled creature is linked as its grappler and Staggered, non-lethal 0 HP leaves a creature knocked out with snoring Z\'s, and NPCs can summon creatures next to themselves.',
                'NPC sizes apply themselves: Tiny or Smaller (+2 AC, Advantage on Stealth, reach 0, no Heavy weapons) through Gargantuan (-2 AC, Advantage on Athletics, Disadvantage on Stealth). Swarms share squares and take half damage from single-target attacks, double from areas. Grant XP has a Start Session type (5 + INT).',
                'The Loot Maker adds Crafting Materials too: any amount of Common, Uncommon or Rare, which land in the player\'s own Crafting Materials when given.',
                'Power saves and Escape Saves run in the tracker: pick a power\'s targets, NPC saves roll themselves, the Conditions go on whoever fails, and lasting effects ask for their Escape Save each turn. An NPCs to rebuild list walks you through stat blocks with powers built before these rules.',
                'Mythic Awakening runs itself: at its first 0 HP the creature Awakens (full HP, conditions cleared, full AP, its turn now), its Awakened powers unlock, and its XP reward doubles. Recharge powers roll for themselves at the start of the creature\'s turn, have a Recharge button that spends half their AP, and using one marks it used.',
                'Reorder an NPC\'s or Loyal Companion\'s powers with ▲ ▼, right-click a chat message to delete it, and the Party panel shows two players side by side, each with their powers in full (click a power\'s name for its own window).',
                'NPC stat blocks have a Token Image: the default token for every creature built from them, which a named NPC\'s own picture replaces. Summoning a saved NPC brings its image along.',
                'Tactician players are asked for their swap when you press Start Combat, while you see "Waiting on Tactician choice" (or choose for them); a Rank 5 Tactician can hand their turn to an ally, and the tracker returns to normal after.',
                'Unlimited Uses on an NPC power costs 5 more TP per Power Level, at any Power Level and on an NPC of any Tier.',
                'A Summon a Creature power\'s creature, built in the GM Tools, has a Save Creature button on its last step. The GM-only Legendary step stays out of its way.'
            ]],
            ['For Players', [
                'Identical items stack: three Leather Armors from three bandits make one "Leather Armor ×3" row. Equipping takes one from the stack, taking it off puts it back, and older inventories are joined up the first time you open the character.',
                'A new character starts in the world you choose, or in none, and a character with no world sees only Join World, never another world\'s maps, notes or fog.',
                'Leaving a world takes one step: delete the character, move it out of the world folder, or press × on the world folder. You come off the GM\'s player list, and your character stays yours.',
                'Powers roll like weapons, powers from equipped magic items join your list without using a Power Slot, and a power can be built as a Reaction with a trigger of its own.',
                'Power Crafter Step 3 (Targeting) crafts areas to the exact size: an AoE (x3) is a Line (0.5 XP per square), Cone (3 XP per square of length) or Burst (10 XP per square of radius), sized with − and + while a preview shows the squares it hits and the XP. Powers with the old fixed-size areas need rebuilding.',
                'Power Crafter Step 7 is reworked: set the AP cost with − and + (each AP below 4 costs 10 XP, each AP over 4 refunds 5 XP, up to twice the AP you gain at the start of your turn), or make it a Reaction (15 XP, with a set trigger) or pick a Lengthy Cast Time from 1 Minute (-15 XP) to 24 Hours (-60 XP). Steps 1 and 3 are now called Delivery and Targeting, and every power costs at least 5 XP. Step 4 can let you choose the damage type each time you use the power (+10 XP; both types with a second one).',
                'Powers show the real number from their Core Attribute instead of "+Attr", and the Consumable Crafter follows the Power Crafter\'s save rules, with Artisan raising its XP limit by 5 per rank.',
                'Luck and Looting, trading, Omen dice you can pass on, and Loyal Companions with their own AP, turns and an HP box that takes damage just like yours.',
                'Luck Points have − and + buttons, clicking your Rest Dice spends one to heal, and four-armed characters get extra arms, hands and a shield in every Off Hand.',
                'Powers are reworked: each has its own Core Attribute, chosen when you craft it, and Full Rest Powers (formerly INT) and Short Rest Powers (formerly CHA) are two pools you can mix.',
                'You have one character in each world, your GM\'s Race Templates update your Race Builder live, and your Currency shows wherever you spend it.',
                'The Weapon and Armor Forges roll their Craft check in the dice tray, so Luck Points and Omens work on it, and spell out what buying or crafting costs.',
                'Edit Token re-crops the circle your portrait and token show, without uploading the picture again.',
                'Custom items can set a Core Attribute to a total, "unless higher" if you like: an Exo Suit that makes your STR 15 unless it\'s already more.',
                'Click the Action Points title for every Combat Maneuver and Standard Action, side by side: one click spends the AP and applies the effect (Fight Defensively\'s AC, Block\'s Sturdy-weapon roll, Power Attack\'s damage and more), shown under Armor & Defenses with a ✕ to end it. Pin the ones you use most to Weapons & Attacks.',
                'Summon a Creature powers are built in the NPC Crafter at the Tier you choose (+15 XP per Tier above 1), with all the TP that Tier allows (Tier 1: 29 TP), with a token image if you like, and their creatures appear next to you on your GM\'s battle map.',
                'Tactician runs itself: at Rank 1, pressing Start Combat asks you to swap an ally\'s place in the initiative order with another creature\'s (the ally is no longer Surprised); at Rank 5, your turn can go to an ally once per combat.',
                'Grappling is reworked: Grapple (3 AP) and Pin (2 AP) are contested checks, the grappler is Staggered while holding on, Choke (2 AP) deals unarmed damage to a Pinned creature with no attack roll, and Escape (4 AP) ends it all. The Actions list runs each step and tells your GM\'s tracker.',
                'Non-lethal damage: type "-6 nl" or tick Non-lethal, and 0 HP knocks the creature out (Unconscious, snoring on the battle map) instead of Bleeding Out or dying.',
                'Power saving throws name their Core Attribute, and a power with a lasting effect gives its target an Escape Save at the end of each of its turns, never one the effect makes it automatically fail. Powers built before this show a Powers to rebuild list (free) when your sheet opens.'
            ]],
            ['At the Table', [
                'One tray holds every roll, the combat log and your messages, and every die has a shape of its own.',
                'The log asks for each save in turn (Wound Threshold, then the hit\'s own saves, then Bleed Out) with a button that rolls it. Players never see the numbers on hits against enemies, so DR and ER stay secret.',
                'Weapon properties apply themselves on a hit, and every weapon has a damage type (unarmed strikes are Bludgeoning).',
                'Damage typed into any HP or Temp HP box, a character\'s, an NPC\'s or a companion\'s, is reduced by its type. Whenever nothing says what it was, a chooser lists every damage type, and Bypass resistances lets it through in full. "-5-3" counts as 8.',
                'Everyone\'s AP is tracked, refills on their turn and carries over.',
                'The dice tray has a chat: message everyone, just the GM, or the players you pick.',
                'Your checks and saves reach your GM in or out of combat, your token\'s path shows its AP cost as you drag it, and Measure has Line, Cone and Burst modes.',
                'Measurements stay where you put them: drag the start point to move one (started on your creature, the creature moves with its path and AP) and scroll while dragging it to turn a Line or Cone. Scrolling while you\'re still drawing one doesn\'t turn it. A Line keeps its length as it turns and shows the exact squares it covers, and a Cone starts at the edge of its creature\'s space, so a creature is never caught in its own cone, however big it is. Players\' measurements show for everyone; the GM\'s show when the GM presses V.',
                'Area powers land on the battle map: using a power with a Line, Cone or Burst while a battle map is open has you place its area first, at the size the power was crafted with. A Self or Touch area starts from the creature using it (scroll to turn it, drag its start to move it); a ranged one is placed anywhere within the power\'s range. Everyone in it then makes a new saving throw every time it\'s used: NPCs roll from the GM\'s dice tray, players get a button to roll their own, and each creature takes the damage (and any Conditions) by its own roll. With the Safe Zone perk, right-click creatures to leave them out.'
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
                'High Roller, Fortunate Fighter, Regenerative and Mobile are updated, and Power Crafting caps each die step at 8 dice and adds Mythic Utilities.',
                'NPCs: +1 AP costs 6 TP, at most +1 per Tier (Tier 0 counts as 1).',
                'A Medium weapon used two-handed steps its die size up (2d8 becomes 2d10), Brute\'s carry capacity stacks with your race\'s size, and attributes bought with XP stay separate from your base attributes.',
                'Escape Saves: a power that leaves a lasting negative effect on an unwilling creature (anything longer than Instant / End of Next Turn) names an Escape Save the creature makes at the end of each of its turns. It can\'t be a save the power\'s own Conditions make it automatically fail (not STR or AGI against Paralyzed, Stunned or Unconscious; not PER against Blinded). The save to avoid the power can still be any attribute.',
                'Damage Interrupt: taking damage calls for the Escape Save (an effect with none just ends). Action Interrupt: the power ends when the target attacks or uses a harmful power or ability, and a target that can spend AP can spend 3 AP to repeat its Escape Save; it can\'t be taken with Stunned, Paralyzed or Unconscious. Guaranteed Hit still allows Escape Saves.',
                'Teleportation does not provoke Attacks of Opportunity.',
                'Step 4: for 10 more XP, a power\'s damage type is chosen each time it\'s used (with a second damage type, both are).',
                'Step 7: each AP below 4 costs 10 XP (1 AP is 30 XP), each AP over 4 refunds 5 XP (up to twice the AP the caster gains at the start of its turn: banking AP for a big power is fine, but no further), or choose Reaction (15 XP, with a specific trigger that can\'t change without making a new power) or a Lengthy Cast Time: 1 Minute (-15 XP), 10 Minutes (-20), 1 Hour (-30), 8 Hours (-40), 12 Hours (-50) or 24 Hours (-60). A distraction while casting calls for a CON save (DC 10 or more) as if Concentrating, or the power must start over.',
                'Power Crafter Step 1 is now called Delivery and Step 3 Targeting. Every power costs at least 5 XP.',
                'Step 3 (Targeting): Single Target (x1), Split Target (x2), or AoE (x3) in a shape crafted to an exact size: Line, 1 square wide (0.5 XP per square: 12 squares is 6 XP, 399 is 199), Cone from the edge of your space (3 XP per square of length: 15 squares is 45 XP), or Burst from a central square (10 XP per square of radius: 10 squares is 100 XP). The fixed Small to Massive AoEs are gone.',
                'Tactician: Rank 1\'s swap happens as combat starts, and Rank 5 skips your turn to give an ally a full turn right away; initiative then carries on from the creature after you.',
                'Artisan raises the most XP you can spend crafting a Consumable by 5 for each rank.',
                'Unlimited Uses (NPC powers): for 5 additional TP per Power Level, the creature can use the power an unlimited number of times, at any Power Level and on an NPC of any Tier.'
            ]],
            ['Also', [
                'Switching from one character to another and back keeps every change you made to each.',
                'Every new popup opens on top of whatever is already open (map windows, stat blocks, the dice tray, other popups), so nothing opens hidden behind a window.',
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
            ['Your Account and the Tutorial', [
                'The Character Sheet needs a free APX account. Signed out, it sends you to sign in.',
                'A short tutorial covers the basics the first time you open the sheet: character creation is Race Builder, then Origin, then Spend XP. It also covers rolling, shortcuts and worlds. Settings → Show Tutorial reopens it, and Settings → Patch Notes shows these notes.',
                'Patch notes, the tutorial and your saved colours remember you on your account, not in the browser, and only pop up while you\'re signed in.',
                'Kawaii is a true light theme everywhere: windows that used to stay dark now turn pastel, and no text is left white on pale. Cyber Sigil is Kawaii\'s dark twin: midnight magenta with hot neon pink, lavender and mint (Settings → Theme).'
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
                'Standard Array uses 7, 6, 5, 5, 5, 4 and 3, once each. Point Buy starts every attribute at 4 with 7 points to spend, each between 2 and 7.',
                'Race Templates from your GM update the Race Builder as soon as the GM saves them.',
                'Save & Apply in the Race Builder sends you to Step 4 when training is still missing, and asks first when Genetic Points are left unspent.',
                'Attributes bought with XP (and injuries) are kept apart from your base attributes, so rebuilding your race never loses them. Existing characters are converted the first time you open them.',
                'One character per world: joining, or moving a character into a world that already has one, asks whether to archive or delete the other.',
                'If your GM deletes a world, your characters in it are archived, not lost. Rejoining a world after being kicked brings its folder back.',
                'Click your portrait and press Edit Token to change which part of the picture fills your circle and battle-map token, without uploading it again.',
                'A character with no world sees only the Join World screen: no Party, maps or notes from another character\'s world.'
            ]],
            ['Origin Builder', [
                'It all fits on one screen: Origin Name, Starting Wealth and Origin Feature on the left, the common language and four competencies on the right.',
                'Each competency card has Language, Skill and Weapon Type buttons. Pick one, pick another to switch, or tap the chosen one again to clear it.',
                'Starting Wealth goes into your Currency when you save and can only be chosen once, and Save Origin writes your languages into a Languages note.'
            ]],
            ['Powers', [
                'Saving throws name a Core Attribute: Save Negates and Save Halves powers choose which one targets roll (Power Crafter Step 1), and the card and your GM\'s log say "Targets make an AGI saving throw against DC 13".',
                '"Inflict or end" utilities choose which Condition, and whether the power inflicts or ends it (Step 5).',
                'Escape Saves (Step 6): a power that leaves a lasting effect on its target (a Condition for 1 Minute or more, a command, a polymorph, a banishment) names the save the target makes at the end of each of its turns to break free. Saves the effect makes it automatically fail are greyed out: an AGI save can dodge a paralysis, but it can\'t end one. The Escape Save shows on the power, its card and your GM\'s tracker.',
                'Action Interrupt can\'t be taken on a power that inflicts Stunned, Paralyzed or Unconscious, and the Teleport utilities say they don\'t provoke Attacks of Opportunity.',
                'Powers built before these rules show a Powers to rebuild list when your sheet opens. Rebuild opens each one in the Power Crafter for free; the list updates as you go and goes away once they\'re all done.',
                'Click a power\'s name or its "Lvl X | Y AP" tag to use it. It spends its AP and a use from its pool, and asks first if you\'re short; "Use anyway" spends what you have.',
                'Attack powers roll the d20 and their damage together, doubling the damage dice on a crit. Save powers roll their effect, show your DC and let your GM know. Powers without a roll show their description.',
                'In the Power Crafter, Attack Roll / Save Negates powers choose one or the other. An Attack Roll power is a Power Attack or a Martial Improvement riding on one of your weapons, and you can switch weapons on the power\'s card.',
                'Reaction (Power Crafter Step 7, 15 XP): the power is used as your Reaction instead of AP, with a trigger you write when you craft it ("When an ally within 3 squares is hit"). The trigger shows on the power.',
                'Step 7 sets the AP cost with − and +: 3 AP 10 XP, 2 AP 20 XP, 1 AP 30 XP; 5 AP refunds 5 XP, 6 AP 10 XP, and so on up to twice the AP you gain at the start of your turn (12 AP with 6 AP a turn), so a big power is worth saving AP for. A power over that limit can\'t be saved until it\'s lowered. Lengthy Cast Time is a dropdown of six lengths, from 1 Minute (-15 XP) to 24 Hours (-60 XP), and shows its casting time on the power.',
                'Power Crafter Step 1 is now called Delivery and Step 3 Targeting, in the Power and Consumable Crafters alike. Every power costs at least 5 XP.',
                'Step 3 (Targeting): choose AoE, then Line, Cone or Burst, and size it one square at a time with − and + (or type it). The preview draws the area on a grid the way your GM\'s Measure tool does, with the number of squares it hits, the shape\'s XP and the power\'s total.',
                'Area powers built with Small, Medium, Large or Massive AoE are in the Powers to rebuild list: Rebuild opens them as a Burst of the same radius, ready for you to choose the shape and size.',
                'Choose the damage type when you use it (Step 4, +10 XP): using the power asks which type (both types, for a power with a second one), and that\'s the type it deals. Your companion\'s powers ask whoever uses them.',
                'Powers built with 1 AP, the old 1 AP / Reaction option or a Lengthy Cast Time show in the Powers to rebuild list. Rebuilding is optional: it refunds any XP the power now costs less (a Reaction gets 20 back), and anything else keeps its cost.',
                'Damage that adds your Power Attribute shows the number ("2d6 Fire +3") instead of "+Attr", and rolls it too.',
                'Powers from magic items: equip an item that grants powers and they join your Powers, labelled with the item and how often they can be used ("Once per Full Rest", "3 charges per Full Rest"…). They cost AP but no Power Slot, and they leave your list when you unequip the item.',
                'Every power has its own Core Attribute, picked in the Power Crafter, and its card shows its attack bonus and DC.',
                'Full Rest Powers (formerly INT Powers) give Power Slots that come back after a Full Rest, and a power can use a slot of its Level or higher. Short Rest Powers (formerly CHA Powers) give uses that come back after a Short Rest. Each power belongs to one pool, and when that pool is empty you\'re offered the other.',
                'Existing powers keep the attribute and pool they used before.',
                'Summon a Creature has a Tier (+15 XP per Tier above 1, per creature). Saving the power opens the NPC Crafter to build the creature with everything that Tier allows (Tier 1: 29 TP, Tier 2: 49 TP), and using it places the creatures next to your token on the battle map your GM has open.',
                'A power that summons a creature has an Edit Summoned Creature button, so the creature can be changed without reopening the Power Crafter.',
                'Powers for your Loyal Companion and for a summoned creature are priced in Threat Points from their own budget, never your XP. Building a summoned creature\'s powers from inside the Power Crafter picks your own power back up afterward.',
                'Summoned creatures can\'t summon creatures of their own (the utility is locked when crafting their powers), and have a hard 3 AP each turn with nothing banked, so their NPC Crafter has no AP to buy (TP spent on AP before comes back).',
                'Your Loyal Companion can have a Summon a Creature power, up to its own Tier. Saving it opens the NPC Crafter for the creature and then returns to your companion; using it puts the creatures next to your companion on the battle map.',
                'Area powers on the battle map: with your GM\'s battle map open, using a power with a Line, Cone or Burst has you place its area before anything is spent, at exactly the size you crafted. A Self or Touch area starts from your token: scroll to turn it, click a square to point it there, and drag its start to the square next to you. A Short, Long or Extreme Range area follows your mouse; click to place it within range (it turns red when it\'s out of range), then drag, turn or re-aim it. Enter (or Use power) uses it, Esc cancels, and Use without the map rolls it the old way. Everyone in the area makes a new saving throw each time you use it: if you\'re caught in one, a Roll save button appears in your dice tray, and you take the damage (half or none on a success) by your own roll. Your Loyal Companion\'s area powers work the same way.',
                'Safe Zone: right-click any creature in your area while placing it to keep it safe (it gets a green outline), and the GM\'s tracker leaves it out.',
                '"Add a second damage type, splitting the dice" asks how many of the dice deal the second type (change it with − and + next to the type). The power shows as "2d6 Fire + 1d8 Cold", and using it rolls each type separately with the total underneath. A martial power rolls its weapon\'s damage and its own damage as separate types too.'
            ]],
            ['Magic and Custom Items', [
                'Equippable items can carry any number of bonuses, or penalties if cursed: Core Attributes, skills, AC, DR, ER, one energy resistance, Max HP, Max AP, Speed, Initiative, Wound Threshold, Max Rest Dice, Max Luck Points, Carry Capacity, attack and damage rolls, power attack and DC, saves, checks and extra Power Slots.',
                'Make your own with Add Item (tick Equippable), and edit them later from their details. Items from your GM keep the bonuses and powers they came with: the details list both, and the inventory row shows "Powers: …".',
                'Bonuses and powers work only while the item is equipped, and an item handed to you always arrives unequipped.',
                'Add Item\'s custom item maker matches your GM\'s: any number of bonus rows (each shows what it boosts beside a small amount box), and + Craft Power for item powers. A Core Attribute row can Add to the score or Set it to a total, with an "unless higher" box (an Exo Suit: STR 15 unless yours is higher).',
                'Consumables can split their dice between two damage types the same way, chosen in the Consumable Crafter.'
            ]],
            ['Weapons and Shields', [
                'Weapon properties take effect when you hit: Crushing (STR save or Prone, or an extra die against a Prone target), Stunning (CON save or Stunned), Concealed (an extra die against a Surprised target), and Flurry\'s AP discount on your next attack with that weapon this turn.',
                'Every weapon has a damage type, shown on the weapon and on its rolls. Forged weapons use theirs, unarmed strikes are Bludgeoning, and custom or innate weapons choose one. The type decides whether DR or ER applies.',
                'Every weapon shows the hand that holds it: Main Hand, Off Hand, and with four arms (Polymelia) Off Hands 2 and 3. Two-handed weapons take a pair of hands, and choosing a hand that\'s already in use swaps the weapons.',
                'With four arms, the Off, Off 2 and Off 3 shield buttons sit side by side, each with its own Unequip underneath, and every shield you hold adds its +AC/DR/ER.',
                'The Weapon Forge can make thrown weapons Returning for 300 more Currency.',
                'A Medium weapon used two-handed steps its die size up: 2d8 becomes 2d10.',
                'Ammunition effects (Light, Medium, Heavy) show as badges on ranged rolls.'
            ]],
            ['Weapon and Armor Forges', [
                'Crafting is rebuilt. Pick where you\'re working (your Workbench, a rented one at 100 Cu an hour, or a Toolkit with Disadvantage), see the value, materials, time, rent and what each result costs, then roll the Craft check in the dice tray. A Luck Point or Omen spent on that roll updates the result before you apply it.',
                'Under Cost Now, each forge shows what you\'d have left after buying, or what crafting it would take instead.',
                'Your Currency shows at the top of every screen that spends it: the forges, crafters, Adventuring Gear, Shields and Helmets.',
                'The Armor Forge counts everything you wear: its weight shows the armor alone and your total with every shield (one per Off Hand with four arms) and an intact helmet, and the STR requirement comes from that total, with a note when your STR falls short.',
                '"Reduce armor weight" stops once the armor weighs 0 lb, and the armor class line above the mods never wraps, so the − and + buttons stay put as you click.'
            ]],
            ['Damage and Defense', [
                'Type the whole damage into your HP box: "-9", "35-9" after the 35 already there, several hits at once ("-5-3" is 8), or with a phone\'s minus sign. Your DR (physical) or ER (energy), resistances, vulnerabilities and immunities come off, by the type of the attack your GM just rolled, or the type you add ("-9 fire"). The tray shows the working.',
                'Whenever you type "-X" without a damage type, a chooser asks first, even right after your GM rolls an attack (that attack is offered as the first button, in case it\'s what hit you): a button for every damage type (Bludgeoning, Piercing and Slashing each have their own) showing what your defences do against it (DR 3, ER 2, +5 res, Immune), and a Bypass resistances button that takes the damage in full, with no DR, ER, resistance or immunity reducing it.',
                'The Temp HP box works the same way: "-6" is damage (Temp HP takes it first), and a plain number still sets your Temp HP.',
                'A hit that comes to 0 still counts, so its effects (a Stunning save, for example) still happen, and your sheet sends the damage and its working to your GM.',
                'Your GM sees the same AC, DR, ER, Wound Threshold and resistances your sheet shows, with shields, helmet, perks and magic items included.',
                'Defensive Rank 4: while you\'re unarmored, the line under DR and ER gives your DR and ER against traps, hazards and falling.',
                'The damage type chooser also asks for damage taken on your own turn, and a power that deals half damage on a save uses its own damage type, never an earlier attack\'s.',
                'When your GM has you fall, your tray asks for the AGI (Acrobatics) Reaction: every 5 you roll takes off 1d10.',
                'Typing "-5" in an HP box and pressing Enter asks for the damage type, the same as clicking away does (Enter no longer answers the question for you).',
                'Non-lethal damage: add "nl" ("-6 nl", "-6 fire nl") or tick Non-lethal in the damage chooser. At 0 HP you\'re knocked out (Unconscious, no Bleeding Out) and come to when healed. Your companion\'s HP box works the same way.'
            ]],
            ['Conditions and Injuries', [
                'Wound Threshold and Bleed Out: your next CON save decides the Wound, then CON (Survive) sets your Bleed Out rounds. If a Luck reroll or an Omen die turns the Wound save into a success, the GM\'s limb choice disappears and any limb already chosen heals.',
                'When a Critical Hit lands on you, the tray offers "React: Turn to normal hit (Defensive)" with Defensive Rank 5 while unarmored, and "React: Break Helmet (normal hit)" with an intact Helmet. Either one returns the crit\'s extra damage and adjusts your Wound save.',
                'A Torso Wound adds a die to every hit on you (the largest die the attack rolled), both legs Wounded keeps you Prone until one heals, and four arms add Left Arm 2 and Right Arm 2 to the Wound list.',
                'Stunned starts your turn with 0 AP, and a Stunning weapon\'s stun ends at the end of the attacker\'s next turn. Burning deals 1d10 Fire at the start of your turn, ignoring ER.',
                'Unconscious, Paralyzed and Incapacitated stop attacks and powers and automatically fail the right checks. Conditions bring along the conditions they include, and Permanent Injuries are tracked.',
                'Grappled and Pinned are conditions. Grappled: Speed 0 and Disadvantage on attacks against anyone but the grappler. Pinned: also Grappled, Restrained and Prone. (Grabbed became Grappled.)'
            ]],
            ['Dice and Notifications', [
                'Rolls, rest results, XP, loot, HP changes and warnings share one tray, with a red dot when something new arrives.',
                'During a fight the tray is the combat log, and each save your GM needs has a button that rolls it with your bonuses, in the order asked.',
                'Every die has its own shape: triangles for the d4 and d8 (the d8 points down), a square d6, a kite d10, a pentagon d12, a hexagon d20 and a round d100. Omen dice are purple hexagons.',
                'Click skills, saves, attributes, weapons, damage and powers to roll them, with perks, Advantage, Disadvantage, crits and Luck rerolls built in. The d4–d100 buttons build a dice pool.',
                'Fortunate Fighter Rank 5 turns a hit into a Critical Hit for a Luck Point, once per turn. High Roller, Melee Prowess and Sharpshooter apply themselves, and a Dice Explosion shows every die it adds.',
                'Chat sits at the bottom of the tray: send to All (GM included), just the GM, or any players you pick. Your GM can delete a message.',
                'Your checks and saves reach your GM\'s notifications, in combat or out, and popups always open in front of the tray.',
                'Before your GM presses Start Combat, the log only says who took damage or went down; the full combat log arrives when the fight starts.'
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
                'When your GM calls for a Loot roll, it opens with the enemy count already filled in, and your result goes back to the GM.',
                'The Scavenge list shows your bonus for each roll, and whether it has Advantage or Disadvantage.',
                'INT (Encyclopedia) for scavenging has two choices: Untrained (your INT check) and Encyclopedia - Trained, with the bonus of your trained Encyclopedia skill and its perks.'
            ]],
            ['Loyal Companions', [
                'Your companion has AP pips of its own, which empty when a fight begins and refill on its turn. Attacks from its stat block and its powers\' Use buttons spend them.',
                'Its HP box takes damage just like yours: "-6", "-6 fire", or the quick chooser with its Bypass resistances button, reduced by its DR, ER, resistances and immunities. "+3" heals and a plain number sets its HP.',
                'Its stat block has a SAVE button under each Core Attribute, and Saving Throw Training (2 TP each) adds its Training Bonus to one save.',
                'Its HP matches everywhere, each Rest Die you use heals it too, it can have its own token art, it can carry a Shield and Helmet, and your Omen dice work on its rolls.',
                'Your companion acts on your initiative, right after you.',
                'Forged armor and weapons for your companion cost only TP, never Cu.',
                'The forges show no Cu at all for your companion: its armor and weapons cost only TP, and Purchase reads Equip (TP).',
                'Companions wear armor by the same rules as you: the weight class caps its AGI bonus to AC, and below the STR requirement it loses AGI to AC and 2 Speed and attacks with Disadvantage.'
            ]],
            ['Party and Trading', [
                'The Party tab lists everyone in your world, with each companion beside its owner.',
                'Give moves an item, or several from a stack, to a party member, where it joins their matching stack. Gear, magic items and Cu from your GM arrive with a notice.',
                'Crafting Materials your GM gives you join your Common, Uncommon and Rare Crafting Materials rows.'
            ]],
            ['Action Points', [
                'AP is 6 plus half your AGI modifier (at least 6), minus Fatigue, plus item bonuses, and unspent AP carries over.',
                'Your AP empties when a fight begins and refills on your turn, with or without a map (1 AP if you\'re Surprised). Standing up from Prone costs 2 AP in combat.',
                'Attacks and powers spend their own AP, and you\'re asked first when you\'re short or a perk might change the cost.',
                'AP perks (Adrenaline, Relentless) add their AP when combat starts, and New Turn never gives AP twice.',
                'Tactician Rank 1: when your GM presses Start Combat, a window shows the initiative order (who\'s an ally, who\'s Surprised; hidden creatures aren\'t listed) so you can pick an ally and the creature they swap places with. Rank 5: once per combat, at the start of your turn, you can skip it to give an ally a full turn now.',
                'Drag your token in combat to see its path and AP cost (1, then 2, then 3… per Move); it\'s paid when you drop it. Hold Alt to move without paying.',
                'Click the Action Points title in Vitals for every Combat Maneuver (left) and Standard Action (right). A click spends the AP (asking first if you\'re short) and applies what it can: Fight Defensively adds +4 AC (+2 on a turn you attack), Block doubles your shield or rolls your Sturdy weapon\'s die for AC, Fight Offensively gives Advantage, Power and Precision Attack add STR or AGI to your next melee hit, Charge adds a die, and Feint and Vault roll their checks.',
                'Active effects show under Armor & Defenses with a red ✕ to end them early; they end on their own at your next turn or when you attack.',
                'Repair (Unalive): 3 AP to restore Xd6 HP (X = your INT modifier, min 1) to an adjacent machine or animated object.',
                'A character can be open in one browser tab at a time. Opening it in another tab saves and sends the first one back to the lobby, so AP is never spent twice.',
                'Block needs a shield or a Sturdy weapon (unarmed strikes count from Martial Arts Rank 2) and Shield Bash needs a shield; without one they\'re greyed out. Martial Arts Rank 1 takes 1 AP off every maneuver (minimum 1).',
                'The 📌 beside any action pins it to Weapons & Attacks for one-click use; ✕ unpins it. Recover keeps its own button.',
                'Grapple (3 AP): roll STR (Athletics), say whether you won the contest, and the creature next to you is Grappled while you\'re Staggered. Pin (2 AP) makes it Pinned; Choke (2 AP) deals your unarmed strike damage to it with no attack roll, lethal or non-lethal; ✕ on "Grappling" lets go. Escape (4 AP) frees you from a grapple and any Pin. The grapple carries over between turns, and your GM\'s tracker follows every step.'
            ]],
            ['Maps', [
                'Special Map Markers (the single letters your GM places) are larger and bright yellow with a dark outline, easy to spot on light and dark maps alike, and never too small to read when zoomed out.',
                'Area Circles stay about the same size on screen at any zoom: a single building when zoomed in, never more than 3% of the map when zoomed out.',
                'Rest your mouse on any marker and its name appears at once.',
                'Linked maps open in the same spot on screen, each slightly offset from the one before.',
                'Your GM\'s maps stay sharp as you zoom, loading full-resolution detail for the part you\'re looking at. Press M to measure.',
                'Click a token to see its picture (never its stats), and NPCs your GM has revealed show their pictures in the World viewer.',
                'Discoveries include the map notes your GM reveals, Area Circles under fog stay hidden, and a map closes on your screen when your GM stops sharing it.',
                'Measure has Line, Cone and Burst modes, and right-click drops a waypoint. Pictures keep their shape when you resize their windows.',
                'A measurement stays on the map after you let go. Drag its start point to move it; when it starts on your own token, dragging moves you (with the path and AP cost in combat) and the measurement comes along. Scroll while dragging its start to turn a Line or Cone, one square at a time. Scrolling while you\'re still drawing one doesn\'t turn it. Shift+drag starts a new one.',
                'Lines shade every square they cover, running in king steps (3 forward, 1 diagonal, 2 forward…), and name who\'s in them. A Line keeps its length as it turns: a 12-square Line is 12 squares long at any angle, counting every other diagonal as 2 the way movement does, so it never grows as it swings around.',
                'Your measurement shows on the GM\'s map and the other players\' (in blue, with your name), and theirs show on yours. The GM\'s show up when your GM chooses to share them.',
                'Discoveries also hold revealed sub-notes whose place, NPC or area you haven\'t been shown.',
                'When your GM hides something you have open (a map, an area, a place, an NPC or their picture), its window closes. Open popups update as notes are revealed or hidden.',
                'Map windows, popups and the dice tray share one stacking order: whichever you opened or clicked last is on top, and every new popup or window opens above everything already open.',
                'Movement paths go straight along diagonals instead of zig-zagging, so moves cost what they should, and big creatures measure from their center.',
                'The Measure toolbar wraps onto more lines in small windows instead of being cut off.',
                'Double-click any popup window\'s title bar to minimize it to a tab in the bottom-left corner. The tab is named after what\'s in the window: the map\'s name, the Area Circle\'s or marker\'s name ("Area B" until it has one), the NPC, place or session, never the title bar\'s buttons.',
                'The Measure buttons and tip sit below a map window\'s own controls instead of behind them.',
                'A minimized map comes back with its map, tokens and pins intact.',
                'A Cone starts at the edge of its creature\'s space, as the rules say, so a creature (Large and bigger included) is never in its own cone. Cones mark every square at least a quarter inside the cone as drawn, and Bursts every square at least half inside the circle, so the highlighted squares match the outline at every size and angle.',
                'Knocked-out creatures turn grey with three snoring Z\'s rising from them.',
                'Swarms can share your square; one under another creature shows as a small handle beside it (hover for its name and conditions). Token borders scale with size, so small tokens stay readable on their turn.'
            ]],
            ['Rules', [
                'High Roller, Fortunate Fighter (Rank 1 uses LUC for AC when that\'s higher), Mobile and Regenerative are rewritten or updated.',
                'Power Crafting allows at most 8 dice per die step, Sacrifice keeps the caster from regaining HP until their next turn, and Mythic Utilities cost a flat 130 XP. Powers this affects show "Recraft (Free)".',
                'Brute\'s carry capacity stacks with your race\'s size: each step doubles it again.',
                'Armor Master: each Rank makes your worn armor (with Shield and Helmet) count as 5 lbs lighter for its weight class and STR requirement.',
                'Brute Rank 2: you aren\'t Staggered while you grapple a creature (the grapple rework\'s cost for holding on).',
                'Your size applies itself: Small gives Advantage on AGI (Stealth); Large gives Disadvantage on AGI (Stealth) and Advantage on STR (Athletics) when you Grapple, Pin or Escape.'
            ]],
            ['Layout and Account', [
                'Settings sits beside World, and Undo and Redo are at the bottom of the Roster menu (Ctrl+Z and Ctrl+Y still work).',
                'The Owned perk filter shows the perks you can still upgrade and hides maxed ones.',
                'Small text is larger, pages load faster (the styling is one small prebuilt file), and closed windows no longer blur the page behind them on phones.',
                'Delete Account removes every character, folder, world and image tied to your account, along with the settings this browser saved.',
                'Colour pickers remember your recent colours: click one to use it, hover it for an X to remove it.',
                'The Notes panel is as tall as Vitals and Defenses, Encyclopedia\'s header rolls "Encyclopedia - Generic (No Training)", and the Kawaii theme\'s Luck and Omen buttons are readable.'
            ]]
        ],
        gm: [
            ['A New Home: playapx.com', [
                'APX lives at playapx.com now, and cybersugarstudios.com is the CyberSugar Studios homepage, with a link to APX. Old links to the character sheet, GM Tools and the rest of APX open the same place on playapx.com.',
                'Worlds, maps, fog, NPCs, races and loot are stored in your account, not in the web address, so they\'re all there when you sign in at playapx.com. Invite codes, players and their characters don\'t change.',
                '"Bring my browser data" on the playapx.com front page copies over what this browser stored at the old address, including worlds saved without an account. Map tiles download again the first time you open each map at the new address.',
                'Ask your players to sign in at playapx.com and update their bookmarks.'
            ]],
            ['Your Account, the Tutorial and the Library', [
                'The GM Tools need a free APX account.',
                'A tutorial walks through worlds, NPCs, combat, maps, loot and notes, plus what the tools can and can\'t do. Settings → Show Tutorial reopens it.',
                'Everything you make (Loot Maker items, forged weapons and armor, consumables and NPC powers) goes into your Library, tagged with the world you made it in. Reuse it from the Loot Maker\'s Library view and the NPC power picker, tick "All worlds" to see what you made elsewhere, or tag an entry with more worlds.',
                'Everything you made before the Library existed is gathered into it when the GM Tools open: custom items, forged and custom weapons, forged armor and consumables from each world\'s Loot list, Area Circles and Special Map Markers, plus your NPCs\' gear, loot and powers and the powers on equippable items. Each is tagged with the world it was found in, and anything you remove from the Library stays removed.',
                'Kawaii is a true light theme on every window, and Cyber Sigil is its dark twin (Settings → Theme).',
                'The World screen has Loot & Items and Powers tabs: this world\'s Library, searchable, filtered by type or Level, with All worlds, and Add to Loot for items.',
                'Every Library entry has an Edit button. Powers reopen in the Power Crafter (Save to Library, or Save as New to keep both), forged weapons and armor in their forge, consumables in the Consumable Crafter, custom items in the Loot Maker\'s form, and anything else (gear, shields, helmets, quick custom weapons, Crafting Materials) in a short form. Only the Library\'s copy changes; anything already handed out, placed or on an NPC stays as it was.'
            ]],
            ['Your Party List', [
                'The party list follows your world\'s players as they come and go. A player who deletes their character in your world, moves it out of the world folder, or leaves the world (× on its folder) drops off the list straight away, and so does anyone you kick.',
                'Switching to another world shows only that world\'s players. A party loaded from a folder of character files stays until you load another.',
                'The World tab\'s Players list updates itself while it\'s open.'
            ]],
            ['Damage and the Tracker', [
                'All damage runs through one system: the HP box, the Temp HP box, and damage players type on their sheets. It works out the attack that hit, its damage type, extra dice, the target\'s defences, HP and the log, then Reactions, the Wound Threshold save, the weapon\'s own saves and Bleed Out. It works before Start Combat and without a battle map.',
                'Type the whole damage ("-8"). The target\'s DR (physical) or ER (energy) comes off, along with Damage Resistances, Vulnerabilities, Immunities and weapons that ignore DR/ER. The type comes from the last attack roll, or from what you add ("-8 fire"). "70-7" in a box showing 70 means 7 damage, "-5-3" adds up to 8, phone minus signs work, and clicking a box selects its number.',
                'Whenever nothing says what kind of damage a "-X" is (no attack, or an attack with no damage type), a chooser opens with a button for every damage type showing the target\'s defence against it (DR 5, ER 3, +5 res, Immune), and a Bypass resistances button for damage nothing reduces. Typing "-8 fire" or "-8 true" skips it.',
                'Each row shows the DR and ER in use, live from the NPC\'s stat block or the player\'s own sheet, plus a "Last hit" line with the working. NPCs without a stat block get DR and ER boxes, and a Loyal Companion\'s resistances, vulnerabilities and immunities count as well as its DR and ER.',
                'A hit that deals 0 is still a hit. Players read "Ari hit Goblin."; you read the damage, or "…but Goblin took no damage."',
                'A Torso Wound adds the attack\'s largest die, Incapacitated targets take every hit as a Critical Hit, Crushing, Stunning and Concealed apply to the target, and a Stunning weapon\'s stun ends at the end of the attacker\'s next turn.',
                'Critical Hit Reactions (Defensive Rank 5, or breaking a Helmet) return the crit\'s extra damage and re-check the Wound Threshold.',
                'When a player fails a Wound save, your tray offers a button for each limb (Left Arm 2 and Right Arm 2 for four arms), and a Luck or Omen reroll that saves them withdraws the choice.',
                'NPCs that share a stat block act as whoever\'s turn it is, not whichever stat block window is open.',
                'Damage types come from the current turn\'s attack only, so a save-half power never takes an earlier attack\'s type, and the chooser also asks for damage on a creature\'s own turn.',
                'Fall damage (⤓ Fall in the tracker, or the token menu): 1d10 per square after the first, with the Acrobatics Reaction, Soft Landing and Defensive taken off, and Prone on any damage.',
                'Click a player\'s conditions in the tracker to add or remove them; they reach the player\'s sheet. Players\' Power Slots show on their stat blocks, and their checks and saves show in your notifications.',
                'Turn-start AP is never given twice, and "No map" combat never uses a map that was closed.',
                'Changing a player\'s conditions from the tracker holds steady until their sheet catches up. Adding Bleeding Out drops them to 0 HP and starts their Bleed Out (they roll the CON (Survive) check); taking it off stabilizes them.',
                'A stat block window stays open while any creature in the order still uses that stat block: when one dies, its window passes to the next.',
                'Before Start Combat (testing a build, or a fight the players only watch), players only see that a creature took damage or went down, plus anything that asks them to roll. The full combat log reaches them once combat starts.',
                'Damage from a split roll (two damage types) is divided between its types as it was rolled, not evenly, so each type meets the right DR, ER, resistance or immunity.'
            ]],
            ['Map Marker Popups', [
                'In an Area Circle or Special Map Marker you\'re editing, "+ Add Sub-note" sits right under the sub-notes and above the Loot section, one click away.',
                'Click a linked NPC\'s name and that NPC\'s full window opens, the same one the World NPC list opens: portrait, role, description, sub-notes, carried loot, Edit, and a Stat Block button when one is linked.',
                'Each popup keeps its own loot (a chest, a hidden cache, a shop counter), stocked with + Loot Maker, no NPC needed. Each named NPC keeps its own loot in its window.'
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
                'Loot stays yours alone until you give it, items always arrive in a player\'s pack unequipped, and your log records who took what and from where.',
                'A hide toggle on loot boxes and gifts keeps a grant from being announced to the rest of the party.'
            ]],
            ['World Settings', [
                'Set your world\'s Starting XP (default 25), Max GP (default 15), starting Cu, and Point Buy or Standard Array.',
                'Players in your world can\'t edit their own XP or Max GP, and Grant XP adds each player\'s bonuses and keeps the reason.'
            ]],
            ['World NPCs', [
                'Every NPC window has a Stat Block button whenever a stat block is linked.',
                'Token Image (NPC Crafter, under the name): a stat block\'s default token, shown on every token built from it in the tracker and on battle maps, for you and your players, and beside it in the NPC Roster. A named NPC\'s own picture replaces it on their token.',
                'Tag a stat block with worlds (NPC Roster → World) and it appears only in those worlds: in the NPC Roster, the Saved NPC list for initiative, and Link Stat Block. Untagged stat blocks appear everywhere. Each list says how many it\'s hiding, and the Roster\'s "Show all" brings them back for re-tagging.',
                'Revealed NPCs show their pictures in your players\' World viewer, and revealed map notes appear in their Discoveries.',
                'Session Notes support bullets and bold, and open in a read view with an Edit button.',
                'Revealed sub-notes whose location, NPC or area is still hidden appear in your players\' Discoveries on their own, without the hidden name.'
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
                'Open the Loot Maker from the Loot panel, an NPC, an Area Circle or a Special Map Marker.',
                'A custom item\'s Core Attribute row can Add to the score or Set it to a total, with an "unless higher" box.',
                'Crafting Materials: set how many Common, Uncommon and Rare materials to add. They stack like any loot, and when given they join the player\'s own Crafting Materials rows (weight and value included).'
            ]],
            ['NPC Gear', [
                'A stat block holds only what the creature always carries or wields: its forged weapons, armor, Shield and Helmet. Loot never appears on it or changes it.',
                'Each world NPC has its own loot and Currency, added from its window with + Loot Maker, so NPCs sharing a stat block never share loot. It drops into the Loot panel when that NPC is defeated.',
                'A stat block can also have Generic Drops (NPC Crafter, no TP): what every creature built from it drops, such as a few Cu per goblin.',
                'A slain NPC drops its equipment, its loot and its Currency into the Loot panel, with worn items taken off.'
            ]],
            ['Loot After a Fight', [
                'Fallen enemies\' gear lands in the Loot panel, grouped by who dropped it. Choose a player beside an item and press Give (or All for a stack), or ✕ anything that didn\'t survive.',
                'Currency is LUC (Loot) × enemies defeated ÷ 2. The panel counts this fight\'s defeated enemies, adds the Currency fallen NPCs carried, and can ask the whole party or a single player to roll.'
            ]],
            ['NPC Powers, Saves and Conditions', [
                'On any NPC or Loyal Companion stat block, click a power\'s name or its "Lvl X | Y AP" tag to use it, as players do. Attack powers roll d20 + Power Attack Bonus with their damage, save powers show the DC and roll their effect, and the rest show their description. The AP comes off the creature taking its turn, and a Reaction power costs none.',
                'Reaction powers (Power Crafter Step 7, 15 XP) carry their trigger, and their tag reads "Reaction". Step 7\'s new AP costs (up to twice the AP the creature gains each turn; a summoned creature\'s 3 AP allows 6) and Lengthy Cast Times apply to NPC powers too, and so does Step 3\'s exact-size Line, Cone or Burst; NPCs with old fixed-size area powers are on the NPCs to rebuild list.',
                'An NPC\'s Summon a Creature power can summon an NPC you\'ve already made, token image and all: the Power Crafter lists your saved NPCs at or below the power\'s Tier (never summoners or other summons). The NPC Crafter\'s power list has an Edit Summoned Creature button to change the creature later.',
                'A power whose damage type is chosen on use asks you which type when you use it from the stat block.',
                'Reorder powers: ▲ and ▼ beside each power in the NPC Crafter (Loyal Companions too) set the order its stat block lists them in.',
                'Damage that adds the Power Attribute shows the number ("1d8 Fire +2") instead of "+Attr".',
                'Recharge powers: using one from the stat block marks it used (and asks before using it again before it recharges). At the start of the creature\'s turn each used one rolls a d6 and recharges on its number (5-6, or 6), and a Recharge button in the tracker spends half the power\'s AP (rounded down, minimum 1) to roll for it now. Charges come off the same way.',
                'Mythic Awakening: build Awakened Powers under it in the NPC Crafter (TP like any power). They show on the stat block, locked until the creature Awakens. At its first 0 HP in the tracker it Awakens on its own: full HP, every condition cleared, full AP, and initiative skips to its turn. The Awakened box on its tracker row does it by hand (or locks its Awakened powers again). Its XP reward is doubled, in the NPC Crafter and when it\'s defeated.',
                'Every stat block has a SAVE button under each Core Attribute, and Saving Throw Training (Step 5, 2 TP each) adds the Training Bonus to one save.',
                'Conditions affect NPCs the way they affect players: Stunned, Incapacitated, Paralyzed, Unconscious and Bleeding Out leave no AP at the start of their turn, Burning rolls 1d10 Fire, Poisoned, Frightened, Blinded, Prone and the rest add Disadvantage or Advantage, and Paralyzed automatically fails STR and AGI.',
                'Remove Power asks for confirmation in front of the NPC Crafter, where you can see it.',
                'NPC Wound Thresholds, (5 + CON mod) × 2: a hit that big asks for a CON save, and a failure rolls a Wound. Wounds show on the tracker and can be healed. Leg Wounds stagger, and a Torso Wound adds a die to hits.',
                'NPC casters have Power Slots in the tracker and on the stat block, and a power can use a new "Power Slot" usage that spends a slot of its Level or higher.',
                'Damaging Aura (and other auras) show as a coloured ring on the map and deal their damage to everyone inside at the end of the NPC\'s turn. Traits like Death Burst let you pick the energy type.',
                'NPC powers with a second damage type roll each type separately, like players\' powers.',
                'NPC powers name the Core Attribute of their saving throw and, for a lasting effect, an Escape Save, like players\' powers.',
                'Using a power that calls for a save (or inflicts Conditions), yours or a player\'s, puts a Roll targets\' saves (or Apply) button in your dice tray. Pick the targets: NPCs\' saves are rolled from their stat blocks, with their own Conditions counting, players are asked to roll theirs, and whoever fails gets the Conditions.',
                'Lasting effects show on the creature\'s tracker row with their Escape Save. It\'s asked for at the end of each of the creature\'s turns, and whenever it takes damage with Damage Interrupt; attacking ends the effect with Action Interrupt. Save rolls it now, 3 AP spends the AP to repeat it, and ✕ ends the effect. An effect lasting until the end of the target\'s next turn wears off then.',
                'When a world opens, an NPCs to rebuild list shows stat blocks in that world with powers built before the new save rules. Rebuild opens the NPC and walks you through each of its powers; finished NPCs drop off the list, and it goes away when none are left.',
                'Area powers on the battle map: using a stat block\'s power with a Line, Cone or Burst while the creature\'s token is on an open battle map has you place its area first (Self or Touch from the creature, scroll to turn it; ranged ones anywhere within range, red when out of range). Right-click creatures to keep them out of it. A window then lists everyone in it with the damage on a failed or successful save; untick anyone it shouldn\'t touch and press Roll saves. Every use asks for new saves: NPCs and companions roll from your dice tray, players are asked to roll theirs, and each creature takes the damage (and the power\'s Conditions, on a failure) when its own roll comes in. Swarms take double, and DR, ER and resistances come off as it\'s dealt. Healing areas heal everyone ticked.',
                'Players\' and Loyal Companions\' area powers arrive the same way: the player places the area on their map, and the same window opens in your tracker.',
                'Unlimited Uses (+5 TP per Power Level) works at any Power Level, on an NPC of any Tier.'
            ]],
            ['NPC Crafter and Weapon Forge', [
                'NPC weapons stay fully editable: reopen one in the Weapon Forge to change melee or ranged, Light, Medium or Heavy, and its damage type at any time.',
                'Stat blocks show which hand holds each weapon, with ⇄ to switch. Shields (4 TP) and Helmets (2 TP) count free hands, with an Equip/Stow Shield button.',
                'Each +2 DR/ER purchase adds 2, manufactured weapons and armor cost Threat Points, and XP rewards are 1 / 5 / 10 / 15 / 25 / 35 for Tiers 0–5, then 10 more for each Tier above.',
                'The Power Crafter allows at most 8 dice per die step and adds Mythic Utilities (a flat 130 XP).',
                '+1 AP for an NPC costs 6 TP, at most +1 per Tier (Tier 0 counts as 1), and ranged weapons show their range on the stat block.',
                'Undead (4 TP): immune to Poison and seven conditions, vulnerable to Fire. At 0 HP from non-critical Physical or non-Fire Energy damage it falls Prone and Incapacitated, and at the start of its turn the tracker rolls its CON save (DC = the final blow) to rise with 1 HP or be destroyed.',
                'Unalive Structure (5 TP): immune to Poison, Psychic and ten conditions, vulnerable to Electric. Electric damage asks for its CON save (DC 10 + half the damage) or it\'s Stunned, and healing it asks whether it\'s a mechanical repair.',
                'NPCs wear armor by the players\' rules: the weight class (armor, Shield and Helmet) caps their AGI bonus to AC, and below the STR requirement they lose AGI to AC and 2 Speed and attack with Disadvantage. Their stat blocks show the weight class and STR needed.',
                'The Armor and Weapon Forges show no Cu for NPCs: their gear costs TP.',
                'Sizes: Tiny or Smaller (3 TP: +2 AC, Advantage on AGI (Stealth), melee reach 0, no Heavy weapons), Small (+2 Stealth), Large (+15 HP, +2 Athletics, -2 Stealth), Huge (+20 HP, +4 Athletics, -4 Stealth) and Gargantuan (+30 HP, -2 AC, Advantage on Athletics, Disadvantage on Stealth). Every effect applies on its own: AC, reach, skill bonuses and Advantage or Disadvantage on the rolls. Carrying capacity is gone from the NPC Crafter.',
                'A Loyal Companion can\'t summon creatures above its own Tier (other NPCs can), and a summoned creature can\'t summon at all. A summoned creature gets all the TP its Tier allows (Tier 1: 29 TP, Tier 2: 49 TP). Saving an NPC\'s summon power opens the crafter for its creature, then returns to the NPC.',
                'Building a summoned creature in the GM Tools ends with a Save Creature button, and the GM-only Legendary step isn\'t shown for it.',
                'Stat blocks (NPCs, companions, and players\' summaries) have Skills instead of Trained Skills: every skill whose roll isn\'t the plain attribute check (trained, a bonus of its own, or Advantage or Disadvantage), rolling with those.',
                'Swarms run themselves: half damage from single-target attacks and double from area effects (powers know which; for typed damage you\'re asked), half their damage dice when below half HP, and no size bonuses or penalties.'
            ]],
            ['Initiative and Combat', [
                'The tracker stands on its own and uses a battle map only when one is open or chosen as the fight\'s Battle map.',
                'Every creature\'s AP is tracked and carries over. Surprised creatures get 1 AP on their first turn, and players\' AP refills on their turn even without a map.',
                'Tactician Rank 1: Start Combat shows "Waiting on Tactician choice" while the player picks their swap (Choose for them, or Start without waiting, if they\'re away). The swap and the ally\'s lost Surprise are applied as Round 1 begins.',
                'Tactician Rank 5: at the start of that player\'s turn (once per combat) they can give it to an ally; the ally becomes the active creature, and Next Turn then goes to whoever comes after the Tactician.',
                'The combat log lives in the dice tray: players see hits on enemies without numbers, while you see every amount and every real name.',
                'Players roll their saves from their own tray and NPCs from a button in your log, and End Combat checks whether anyone is still Bleeding Out.',
                'An Omen die a player passes you waits in your tray and can replace any creature\'s d20.',
                'Loyal Companions share their owner\'s initiative and act right after them. A player\'s Summon a Creature joins the same way, placed next to them on the battle map their token is on.',
                'Tokens added with + Token from the tracker start hidden; reveal them from the token\'s menu.',
                'Grappled and Pinned are conditions (Grabbed became Grappled), and a creature\'s condition immunities keep conditions off it.',
                'Grapples: marking a creature Grappled or Pinned links it to the creature next to it (you choose when there are several) and makes that grappler Staggered. Unmarking it, an Escape, the grappler letting go, being Incapacitated or leaving the fight ends the grapple and its Staggered. A Grappling weapon hit grapples on its own, and players\' Grapple, Pin, Choke and Escape from their sheets apply here, Choke damage included.',
                'Non-lethal damage ("-12 nl", or the Non-lethal box): at 0 HP a creature is knocked out: Unconscious, still in the fight, grey with snoring Z\'s on the map (players don\'t Bleed Out). Healing wakes it; lethal damage while it\'s down kills an NPC or starts a player Bleeding Out.',
                'Summoned creatures have a hard 3 AP: 3 at the start of each turn (1 if Surprised), none banked. Their NPC Crafter doesn\'t offer +1 AP, and a saved NPC summoned by a power drops any AP it bought. An NPC\'s Summon a Creature power places its creatures next to it, on its side, acting right after it.',
                'Grant XP has a Start Session type: 5 XP, named for the session (each sheet adds INT), so attendance XP reads cleanly in the log.',
                'NPCs can be immune to Grappled and Pinned (NPC Crafter, Condition Immunity), and the tracker keeps those conditions off them.'
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
                'Shift+drag moves groups of tokens, images have layers, M measures, F toggles the fog painter, and windows resize from the corner grip.',
                'Grid colour, thickness and opacity are saved with each map, and colour pickers remember your recent colours.',
                'Resize player and NPC tokens ("Sheet size" puts a player\'s back). The current NPC\'s path shows its AP cost as you drag and pays it on drop (Alt moves freely).',
                'Measure has Line, Cone and Burst modes that list every token inside, and right-click drops a waypoint.',
                'Measurements stay put: drag the start point to move one, or, when it starts on a creature, to move that creature (path and AP in combat) with the measurement riding along. Scroll while dragging its start to turn a Line or Cone, snapping square by square; scrolling while you\'re still drawing doesn\'t turn it. Lines shade the squares they cover and keep their length as they turn. Shift+drag starts a new one.',
                'Players\' measurements show on your map in blue with their names. Yours stay private until you press V (or "Only you see it" in the Measure bar) to show them to your players; V again hides them.',
                'Area Circles under fog are hidden from players, and stopping sharing a map closes it on their screens.',
                'The map window\'s X stays in its corner, popups open beside the map in front of the dice tray, and pictures keep their shape when resized.',
                'Each map window has a Revealed / Hidden button to show or hide it for your players on the spot.',
                'Map windows, stat blocks, area popups and the dice tray share one stacking order: whichever you opened, clicked or dragged last is on top, and every new popup (an area power\'s saves, a crafter, a confirmation) opens above everything already open.',
                'Painting fog and zooming no longer make the browser redo the page layout on every mouse move (the "Forced reflow" console messages), so both feel smoother.',
                'Resizing a token next to a wall or another token shifts it to fit, player tokens included.',
                'Movement paths follow diagonals without zig-zagging, and Large and bigger creatures measure from their center.',
                'The Measure toolbar wraps in small windows, and double-clicking a window\'s title bar minimizes it to a tab named after the map, Area Circle, NPC or note it shows.',
                'A token\'s menu says Shrink and Grow for its size.',
                'A Cone starts at the edge of its creature\'s space, as the rules say, so a creature (Large and bigger included) is never in its own cone. Cones mark every square at least a quarter inside the cone as drawn, and Bursts every square at least half inside the circle, so the highlighted squares match the outline at every size and angle.',
                'Swarms share squares with any creature. A swarm under another creature is drawn beneath it, with a small handle beside that creature: hover it for the swarm\'s details (players see less), drag it to move the swarm, right-click or double-click it as you would the token.',
                'NPC and companion tokens take their stat block\'s size (Tiny through Gargantuan), and Shrink / Grow keep their size until "Stat block size". Token borders and glows scale with the token, so a Tiny or Small creature\'s turn ring no longer swallows its picture. Hovering a token shows its HP and AC.'
            ]],
            ['Worlds and Accounts', [
                'Deleting a world removes its maps, fog, portraits, images, invite code and player list, and deleting your account does that for every world you run, plus your characters, races, NPCs and profile.',
                'Update your Firestore rules to FIREBASE_RULES.txt v2026.10.1: it adds the dice tray chat. Nothing else in them changed.',
                'Deleting a world archives your players\' characters in it, a kicked player who rejoins gets their world folder back, and Race Template changes reach players\' Race Builders at once.',
                'Chat at the bottom of the dice tray: you see the world\'s whole chat, Clear chat deletes it, and right-clicking a message deletes just that one, for everyone. Messages older than a week are tidied up.',
                'The Party panel shows two players side by side. Each player\'s stat block (there and in its own window) lists their powers in full: Level, AP, attack or save, range, damage with the real attribute number, and description. Click a power\'s name to open it in its own window.'
            ]],
            ['Fixes', [
                'Players who deleted their character or left your world no longer linger in the party list.',
                'Hovering over an Area Circle on your own maps shows its name as intended.',
                'Pages load faster, and an open page that finds a newer release reloads onto it.',
                'Closed windows no longer blur the page behind them on Android phones, and auto-save holds up through long sessions.',
                'Deleting a sub-note no longer wipes another one you were still typing.',
                'A map marker whose name has an apostrophe ("Bob\'s Shop") no longer stops the map from drawing its markers.',
                'Battle Maps in GM Tools draw their tokens again, so Measure and the other map tools work.',
                'Dates filled in for you (the Languages note, XP log entries, session and character notes, XP your GM grants) use your own time zone, so something made on an evening in the Americas is no longer dated the next day. Languages notes already dated a day ahead are corrected.'
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

    // ── Account preferences (users/{uid}/profile/prefs) ──────────────────
    // What you've already seen (patch notes, tutorials) and saved colours belong to your account,
    // so they follow you to any device. Signed out: nothing is shown automatically.
    let prefsCache = null, prefsUid = null, prefsP = null;
    function whenAuth(cb) {
        let tries = 0;
        let go = () => {
            if (!window.apxAuth) { if (tries++ < 100) setTimeout(go, 100); else cb(null); return; }
            if (!window.apxAuth.enabled || typeof window.apxAuth.onAuthChange !== 'function') { cb(null); return; }
            window.apxAuth.onAuthChange(u => cb(u || null));
        };
        go();
    }
    window.apxPrefs = {
        whenAuth,
        uid: () => (window.apxAuth && window.apxAuth.enabled && window.apxAuth.user) ? window.apxAuth.user.uid : null,
        load() {
            let uid = window.apxPrefs.uid();
            if (!uid || typeof window.apxAuth.loadUserPrefs !== 'function') return Promise.resolve({});
            if (prefsCache && prefsUid === uid) return Promise.resolve(prefsCache);
            if (prefsP && prefsUid === uid) return prefsP;
            prefsUid = uid;
            prefsP = window.apxAuth.loadUserPrefs().then(p => { prefsCache = p || {}; return prefsCache; }).catch(() => (prefsCache = {}));
            return prefsP;
        },
        // patch: { patchSeen: { sheet: 'v…' } } — merged into what's saved
        save(patch) {
            let uid = window.apxPrefs.uid(); if (!uid || !patch) return Promise.resolve();
            let deep = (a, b) => { Object.keys(b).forEach(k => { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])) { a[k] = (a[k] && typeof a[k] === 'object') ? a[k] : {}; deep(a[k], b[k]); } else a[k] = b[k]; }); return a; };
            if (prefsCache && prefsUid === uid) deep(prefsCache, JSON.parse(JSON.stringify(patch)));
            return typeof window.apxAuth.saveUserPrefs === 'function' ? window.apxAuth.saveUserPrefs(patch).catch(e => console.warn('Prefs save:', e.message)) : Promise.resolve();
        }
    };

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
            <div class="apxpn-ft">${window.apxPrefs.uid() ? `<label><input type="checkbox" data-dont ${auto ? '' : 'checked'}> Don't show this again</label>` : ''}<button data-close>Got it</button></div>
        </div>`;
        let close = () => {
            let dont = back.querySelector('[data-dont]');
            if (dont && dont.checked) window.apxPrefs.save({ patchSeen: { [pg]: LATEST.version } });   // on your account
            back.remove(); document.removeEventListener('keydown', key, true);
        };
        let key = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
        back.querySelector('[data-close]').onclick = close;
        back.addEventListener('mousedown', e => { if (e.target === back) close(); });
        document.addEventListener('keydown', key, true);
        document.body.appendChild(back);
        back.querySelector('[data-close]').focus();
    }

    function shouldAuto(pg, prefs) {
        if (((prefs || {}).patchSeen || {})[pg] === LATEST.version) return false;
        let age = (Date.now() - new Date(LATEST.released).getTime()) / 86400000;
        return !(age > EXPIRE_DAYS);
    }

    // Only for someone signed in, once their account says they haven't seen this version, and only
    // when no other popup (the "rules updated" notice, the tutorial, the sign-in lock) is open
    let autoDone = false;
    function autoShow() {
        let pg = page();
        whenAuth(user => {
            if (!user || autoDone) return;
            window.apxPrefs.load().then(prefs => {
                if (autoDone || !shouldAuto(pg, prefs)) return;
                autoDone = true;
                let tries = 0;
                let tick = () => {
                    if (document.querySelector('[data-apx-rules-popup], .apxdlg-back, .apxd-ask, [data-apx-tutorial], [data-apx-lock]') && tries++ < 300) { setTimeout(tick, 1000); return; }
                    if (!document.querySelector('.apxpn-back')) show(pg, true);
                };
                setTimeout(tick, 900);
            });
        });
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
        b.style.cssText = 'position:fixed;left:50%;bottom:1rem;transform:translateX(-50%);z-index:2147483280;background:#1e1b4b;border:1px solid #6366f1;color:#e0e7ff;font:700 .78rem system-ui,sans-serif;padding:.5rem .75rem;border-radius:.6rem;display:flex;gap:.6rem;align-items:center;box-shadow:0 8px 30px rgba(0,0,0,.6);max-width:calc(100vw - 2rem)';
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
        b.style.cssText = 'position:fixed;left:50%;bottom:1rem;transform:translateX(-50%);z-index:2147483280;background:#052e2b;border:1px solid #10b981;color:#d1fae5;font:700 .78rem system-ui,sans-serif;padding:.5rem .75rem;border-radius:.6rem;display:flex;gap:.6rem;align-items:center;box-shadow:0 8px 30px rgba(0,0,0,.6);max-width:calc(100vw - 2rem)';
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
