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
        version: 'v2026.9.26.2345',
        released: '2026-09-26T23:45:00',
        releasedText: 'September 26, 2026 · 11:45 PM',
        title: 'Playtest Update',
        intro: 'Everything in this update was shaped at the table. GMs get world rules, a Loot Maker that stocks NPCs and map areas, magic items that can grant powers and change almost anything on a sheet, and NPCs that wear, carry and use their gear. Players get Luck and Looting, trading, shareable Omen dice, Loyal Companions with their own turns, powers that roll like weapons, weapon properties that apply themselves, a one-screen Origin Builder, maps that stay sharp at any zoom, and a dice tray that is also the combat log. Damage is typed in full and the app takes off DR, ER, resistances and immunities for you, whether the GM or the player enters it. Each character sees only its own world, fog included. Pages load faster, especially on phones, and your characters and worlds update when you open them without losing anything.',
        index: [
            ['For GMs', [
                'World Settings: choose Starting XP, Max GP, starting Cu, and Point Buy or Standard Array for every character in your world.',
                'Loot Maker: make loot with the same forges and crafters players use, plus custom items you can edit later. Stock an NPC, an Area Circle on a map, or the Loot list.',
                'Magic items can raise or lower almost anything on a sheet and can grant powers to whoever equips them. NPCs can equip them too, with a toggle.',
                'Damage you type is the full amount: the tracker takes off the target\'s DR or ER (by damage type), resistances and immunities, shows the math on the row, and always counts a hit that ends up dealing 0.',
                'NPC stat blocks roll their powers when you click the power\'s name or its Lvl tag, have a SAVE button under each Core Attribute, and suffer conditions (Burning, Stunned, Poisoned…) just as players do.',
                'Stat blocks tagged with a world appear only in that world\'s lists. Untagged ones appear everywhere.',
                'Initiative works with or without a battle map.'
            ]],
            ['For Players', [
                'A new character starts in the world you pick, with its rules and races, or in no world at all. A character with no world sees only the Join World box: no maps, notes or fog from anyone else\'s world.',
                'Powers roll like weapons: click a power\'s name to spend its AP and a Power Slot and roll attack and damage together. Powers from equipped magic items join your list and need no Power Slot.',
                'Powers that cost 1 AP can be made Reactions instead.',
                'Luck and Looting, trading with your party, Omen dice you can pass to the GM or a friend, and Loyal Companions with their own AP and turns.',
                'Luck Points have − and + buttons, and clicking your Rest Dice spends one to heal.',
                'Four-armed characters get Left Arm 2 and Right Arm 2, extra hands for weapons, and a shield in each Off Hand.'
            ]],
            ['At the Table', [
                'One tray holds every roll, the combat log and your messages. Every die has its own shape.',
                'The log asks for each save in order (Wound Threshold, the hit\'s own saves, Bleed Out) with a button to roll it. Players never see the numbers of their hits on enemies, so DR and ER stay hidden.',
                'Weapon properties apply themselves on a hit, and every weapon has a damage type (unarmed strikes are Bludgeoning).',
                'AP is tracked for everyone, refills each turn and carries over.'
            ]],
            ['Maps', [
                'Area Circles stay about the same size on screen as you zoom and show their name the instant your mouse is over them.',
                'Linked maps open in the same spot on screen, one slightly offset from the next, never off the edge.',
                'Maps keep full resolution at any size: a preview opens instantly and sharp detail loads for the part you zoom into.'
            ]],
            ['Rules', [
                'Point Buy: attributes start at 4 with 7 points to spend, each between 2 and 7.',
                'NPCs and Loyal Companions train saving throws at 2 TP each. NPC gear costs Threat Points, and defeated NPCs are worth 1 / 5 / 10 / 15 / 25 / 35 XP for Tiers 0–5, plus 10 per Tier after that.',
                'High Roller, Fortunate Fighter, Regenerative and Mobile are updated, and Power Crafting caps die steps at 8 dice and adds Mythic Utilities.'
            ]],
            ['Also', [
                'Deleting an account removes all of its data. Pages load faster, closed windows no longer cause blank patches on phones, and an open page moves itself onto a new version when one is released.',
                'See the Character Sheet and GM Tools for the full details.'
            ]]
        ],
        sheet: [
            ['Characters and Worlds', [
                'New Character asks where the character plays when one of your worlds has an empty slot: in that world (its rules, races and settings from the start) or in no world. It is saved straight away.',
                'Each character sees only its own world. A character with no world gets a World tab with just the Join World box. Switching characters clears the maps, notes and fog of the last one before the next world loads, so nothing from World A ever shows up in World B.',
                'Fog of War always belongs to the world on screen and always loads: after clearing your browser data, on a new device, or with a brand-new character. The map stays hidden until its fog is ready.',
                'Deleting the open character takes you back to the character screen. Undo history belongs to the character you have open.',
                'Your GM sets the world\'s Starting XP, Max GP, starting Cu, and Point Buy or Standard Array. A new character receives the Starting XP and Cu once, and only XP granted after it joined.',
                'XP from your GM arrives with your bonuses (INT modifier, Educated, Expertise), and the XP fields are locked in a world. The XP Log beside Spend XP lists what you gained and spent.',
                'Standard Array: 7, 6, 5, 5, 5, 4 and 3, each used once. Point Buy: every attribute starts at 4 with 7 points, between 2 and 7.'
            ]],
            ['Origin Builder', [
                'One screen: Origin Name, Starting Wealth and Origin Feature on the left; the common language and four competencies on the right.',
                'Each competency card has Language, Skill and Weapon Type buttons. Pick one, pick another to switch, or click it again to clear it.',
                'Starting Wealth is added to your Currency when you save and can be chosen once. Save Origin adds your languages to a Languages note.'
            ]],
            ['Powers', [
                'Click a power\'s name or its "Lvl X | Y AP" tag to use it: it spends its AP and a Power Slot (INT: a slot of its level; CHA: one from the pool) and asks first if you\'re short. "Use anyway" spends what you have.',
                'Attack powers roll the d20 and damage together (damage dice doubled on a crit). Save powers roll their effect and show your DC, and the GM is told. Powers without a roll show their description.',
                'Attack Roll / Save Negates powers choose one in the Power Crafter. An Attack Roll is a Power Attack or a Martial Improvement riding one of your weapons, switchable from the power\'s card.',
                '1 AP or Reaction: in Power Crafter Step 7, a power built at 1 AP can be used as a Reaction instead. It then shows "Reaction" in place of its AP and costs no AP when used.',
                'Powers from magic items: an equipped item that grants powers adds them to your Powers, marked with the item\'s name and uses ("Once per Full Rest", "3 charges per Full Rest"…). They spend AP but no Power Slot, and they leave your list when you unequip the item.'
            ]],
            ['Magic and Custom Items', [
                'Equippable items can carry any number of bonuses, or penalties for cursed items: Core Attributes, skills, AC, DR, ER, one energy resistance, Max HP, Max AP, Speed, Initiative, Wound Threshold, Max Rest Dice, Max Luck Points, Carry Capacity, attack and damage rolls, power attack and DC, saves, checks, and extra Power Slots.',
                'Make your own with Add Item (tick Equippable) and edit them from their details. Items from your GM keep the bonuses and powers the GM gave them: the item\'s details list both, and its inventory row shows "Powers: …".',
                'Bonuses and powers apply only while the item is equipped. Items handed to you always arrive unequipped.'
            ]],
            ['Weapons and Shields', [
                'On a hit, a weapon\'s properties take effect: Crushing (STR save or Prone, or an extra die against a Prone target), Stunning (CON save or Stunned), Concealed (an extra die against a Surprised target), and Flurry\'s AP reduction on your next attack with it this turn.',
                'Every weapon has a damage type, shown on it and its rolls: forged weapons use theirs, unarmed strikes are Bludgeoning, and custom or innate weapons pick one. It decides whether DR or ER applies.',
                'Every weapon shows its hand: Main Hand, Off Hand, and Off Hands 2 and 3 with four arms (Polymelia). Two-handed weapons take a pair, and choosing a taken hand swaps the weapons.',
                'Four arms: Off, Off 2 and Off 3 shield buttons sit side by side, each with its own Unequip beneath. Every shield held adds its +AC/DR/ER.',
                'Thrown weapons can be made Returning in the Weapon Forge for 300 more Currency.'
            ]],
            ['Damage and Defense', [
                'Type the full damage in your HP box ("-9", "35-9" after the 35 already there, or a phone\'s minus sign). Your DR (physical) or ER (energy), resistances, vulnerabilities and immunities are taken off using the type of the attack your GM just rolled; "-9 fire" names it, and otherwise you\'re asked. The tray shows the math.',
                'A hit that comes to 0 still counts, so its effects (a Stunning save, for one) apply. Your sheet sends the damage and its math to the GM.',
                'Your GM sees the same AC, DR, ER, Wound Threshold and resistances your sheet shows, shields, helmet, perks and magic items included.',
                'Defensive Rank 4: while unarmored, the line under DR and ER lists your DR and ER against traps, hazards and falling.'
            ]],
            ['Conditions and Injuries', [
                'Wound Threshold and Bleed Out: your next CON save settles a Wound, then CON (Survive) sets your Bleed Out rounds. If a Luck reroll or Omen die turns the Wound save into a success, the GM\'s limb choice disappears and any limb already picked heals.',
                'Critical Hits on you: the tray offers "React: Turn to normal hit (Defensive)" with Defensive Rank 5 while unarmored, and "React: Break Helmet (normal hit)" with an intact Helmet. Either gives back the crit\'s extra damage and adjusts your Wound save.',
                'Torso Wound: each hit on you adds one more die, the largest the attack rolled. Both legs Wounded: you\'re Prone and can\'t stand until a leg heals. Four arms add Left Arm 2 and Right Arm 2 to the Wound list.',
                'Stunned: your turn starts with 0 AP, and a Stunning weapon\'s stun ends at the end of the attacker\'s next turn. Burning deals 1d10 Fire at the start of your turn, ignoring ER.',
                'Unconscious, Paralyzed and Incapacitated block attacks and powers and auto-fail the checks they should. Conditions bring their linked conditions, and Permanent Injuries are tracked.'
            ]],
            ['Dice and Notifications', [
                'Rolls, rest results, XP, loot, HP changes and warnings share one tray, with a red dot for anything new.',
                'In combat the tray is the fight\'s log. Each save the GM needs from you has a button that rolls it with your bonuses, in the order they were asked.',
                'Every die has its own shape: d4 and d8 triangles (the d8 points down), a square d6, a kite d10, a pentagon d12, a hexagon d20 and a round d100. Omen dice are purple hexagons.',
                'Click skills, saves, attributes, weapons, damage and powers to roll them. Perks, Advantage, Disadvantage, crits and Luck rerolls are built in, and the d4–d100 buttons build a dice pool.',
                'Fortunate Fighter Rank 5 turns a hit into a Critical Hit for a Luck Point, once per turn. High Roller, Melee Prowess and Sharpshooter apply themselves, and a Dice Explosion shows every die it adds.'
            ]],
            ['Omen', [
                'Held Omen dice sit in the dice tray. Pass one to the GM (for any creature\'s d20) or a party member, as rolled or (Rank 2) plus or minus your LUC modifier.',
                'Each Omen die has its own buttons on your rolls and your companion\'s. At Rank 3 one can trade places with a natural 1 or 20.',
                'Full Rest: choose which Omen dice to reroll (Ranks 1–4), or place your Natural 1, 10 and Natural 20 in the slots you want (Rank 5).'
            ]],
            ['Rest, Recover and Luck', [
                'Luck Points: − spends one, + regains one.',
                'Click the Rest Dice die (or the words "Rest Dice") to spend one and heal the roll plus your CON modifier. At full HP nothing happens.',
                'Short and Full Rest, Shake it Off and Shrug It Off each have a button, and your GM\'s log says where the healing came from. Regenerative costs 3 GP and has a Regen button on your turn.'
            ]],
            ['Luck and Looting', [
                'Loot / Scavenge, beside + Add Item, rolls Currency (LUC × enemies defeated ÷ 2), Ammunition (LUC − 3d6 rounds) or an hour of scavenging for Crafting Materials.',
                'When your GM asks for a Loot roll, it opens with the enemy count filled in and your result goes back to the GM.'
            ]],
            ['Loyal Companions', [
                'Your companion has its own AP pips, which empty when a fight begins and refill on its turn. Attacks from its stat block and its powers\' Use buttons spend them.',
                'Its stat block has a SAVE button under each Core Attribute, and Saving Throw Training (2 TP each) grants its Training Bonus to one save.',
                'Its HP stays in step everywhere, every Rest Die you use heals it too, it can have its own token art, and it can carry a Shield and Helmet. Your Omen dice work on its rolls.'
            ]],
            ['Party and Trading', [
                'The Party tab lists everyone in your world, companions beside their owners.',
                'Give moves an item to a party member. Gear, magic items and Cu from your GM arrive in your inventory with a notice.'
            ]],
            ['Action Points', [
                'AP is 6 + half your AGI modifier (minimum 6), minus Fatigue, plus item bonuses. Unspent AP carries over.',
                'Your pool empties when a fight begins and refills on your turn, with or without a battle map (1 AP if Surprised). Standing from Prone costs 2 AP in combat.',
                'Attacks and powers spend their own AP, and you\'re asked when you\'re short or a perk might change the cost.'
            ]],
            ['Maps', [
                'Area Circles stay about the same size on screen as you zoom, so zoomed in they sit on one building and zoomed out they never cover more than 3% of the map.',
                'Hover over an Area Circle and its name appears at once.',
                'Linked maps you open from your world all appear in the same place on screen, each a little offset from the last.',
                'Your GM\'s maps stay sharp when you zoom: the full-resolution detail loads for the part you\'re looking at. Measure with M.'
            ]],
            ['Rules', [
                'High Roller, Fortunate Fighter (Rank 1 uses LUC for AC if higher), Mobile and Regenerative are rewritten or updated.',
                'Power Crafting: at most 8 dice per die step, Sacrifice stops the caster regaining HP until their next turn, and Mythic Utilities cost a flat 130 XP. Affected powers show "Recraft (Free)".'
            ]],
            ['Layout and Account', [
                'Settings sits beside World. Undo and Redo are at the bottom of the Roster menu (Ctrl+Z / Ctrl+Y still work).',
                'The Owned perk filter shows perks you can still upgrade and leaves out maxed ones.',
                'Small text is larger, pages load faster (the styling is one small prebuilt file), and closed windows no longer blur the page behind them on phones.',
                'Delete Account removes every character, folder, world and image tied to your account, and this browser\'s saved settings.'
            ]]
        ],
        gm: [
            ['World Settings', [
                'Set your world\'s Starting XP (default 25), Max GP (default 15), starting Cu, and Point Buy or Standard Array.',
                'Players in your world can\'t change their own XP or Max GP. Grant XP adds each player\'s bonuses and records the reason.'
            ]],
            ['NPC Stat Blocks and Worlds', [
                'Tag a stat block with worlds (NPC Roster → World) and it shows up only in those worlds: the NPC Roster, the Saved NPC list for initiative, and Link Stat Block all hide stat blocks tagged for other worlds. Untagged stat blocks show everywhere.',
                'Each list says how many are hidden. The Roster has "Show all" to find and re-tag them, and "Only this world" to go back.'
            ]],
            ['Loot Maker', [
                'Make loot with the tools players use: the Weapon Forge and Armor Forge (free for you), the Consumable Crafter, the Adventuring Gear list, quick custom weapons, custom items, Shields and Helmets.',
                'Custom items can be equippable, with any number of bonuses or penalties: Core Attributes, skills, AC, DR, ER, one energy resistance, Max HP, Max AP, Speed, Initiative, Wound Threshold, Rest Dice, Luck Points, Carry Capacity, attack and damage rolls, power attack and DC, saves, checks and Power Slots.',
                'Powers on items: under "Powers while equipped", + Craft Power opens the Power Crafter on top of the Loot Maker (no TP or XP is spent; it finishes with "Add Power to Item"), or copy any of your NPCs\' powers from the dropdown. Whoever equips the item gets the powers: players in their Powers, NPCs on their stat block.',
                'Edit: every custom item has an Edit button wherever it sits (an NPC\'s carried gear, an Area Circle, the Loot list, or the Loot Maker\'s own list). The form opens filled in, bonuses and powers included, and Save Changes updates the item in place.',
                'Open the Loot Maker from the Loot panel, from an NPC, or from an Area Circle.'
            ]],
            ['NPC Gear', [
                'NPCs carry items and Currency, added from the NPC Crafter or the NPC\'s window. Carried gear costs no Threat Points.',
                'Equip toggle: an equippable item an NPC carries has an Equip / Equipped button in its loot list and an Equip / Unequip button on the stat block. Worn, its bonuses count on the stat block (attributes, AC, DR, ER, HP, AP, Speed, Initiative, saves, skills, attack and damage, power attack and DC), its energy resistances reduce damage in the tracker, and its powers join the stat block\'s Powers marked "From <item>".',
                'Consumables show their charges and a Use button (3 AP and a charge, tracked per creature in initiative).',
                'When an NPC dies, its equipment, what it still carries and its Currency drop into the Loot panel, with worn items taken off.'
            ]],
            ['Loot on Maps', [
                'Every Area Circle has its own loot: a chest, a hidden cache, a shop counter. Stock it with + Loot Maker in the area\'s popup, no NPC needed, and hand items and Cu out from there.',
                'An area\'s popup shows only that area\'s loot. NPCs keep their own carried loot on their stat blocks and windows.',
                'Loot stays yours alone until you give it away, and items arrive in players\' packs unequipped.'
            ]],
            ['Loot After a Fight', [
                'Defeated enemies\' gear appears in the Loot panel, grouped by who dropped it. Pick a player beside each item and press Give, or ✕ what didn\'t survive.',
                'Currency is LUC (Loot) × enemies defeated ÷ 2. The panel counts this fight\'s defeated enemies, adds fallen NPCs\' Currency to the Cu box, and can ask the whole party or one player for the Loot roll.'
            ]],
            ['Damage and the Tracker', [
                'One damage system handles the HP box, the Temp HP box and damage players type on their sheets: the attack that hit, its damage type, extra dice, the target\'s defences, HP, the log, Reactions, the Wound Threshold save, the weapon\'s own saves, then Bleed Out. It works before Start Combat and without a battle map.',
                'Type the full damage ("-8"). The target\'s DR (physical) or ER (energy) comes off, plus Damage Resistances, Vulnerabilities, Immunities and weapons that ignore DR/ER. The type comes from the attack just rolled; "-8 fire" names it; otherwise one click chooses. "70-7" in a box showing 70 is 7 damage, phone minus signs work, and clicking the box selects its number.',
                'Each row shows the DR and ER in use, live from the NPC\'s stat block or the player\'s own sheet, and a "Last hit" line with the math. NPCs without a stat block get DR and ER boxes.',
                'A hit that deals 0 is still a hit. Players see "Ari hit Goblin."; you see the damage or "…but Goblin took no damage."',
                'Torso Wound adds the attack\'s largest die. Incapacitated targets take every hit as a Critical Hit. Crushing, Stunning and Concealed apply to the target, and a Stunning weapon\'s stun ends by itself at the end of the attacker\'s next turn.',
                'Reactions to a Critical Hit (Defensive Rank 5, or breaking a Helmet) give back the crit\'s extra damage and re-check the Wound Threshold.',
                'When a player fails a Wound save your tray shows a button per limb (Left Arm 2 and Right Arm 2 for four arms). A Luck or Omen reroll that saves them withdraws the choice.'
            ]],
            ['NPC Powers, Saves and Conditions', [
                'Click a power\'s name or its "Lvl X | Y AP" tag on any NPC or Loyal Companion stat block to use it, as players do: an attack power rolls d20 + Power Attack Bonus with its damage, a save power shows its DC and rolls its effect, and anything else shows its description. Its AP comes off the creature taking its turn, and a Reaction power costs none.',
                '1 AP or Reaction: in Power Crafter Step 7, a 1 AP power can be marked as a Reaction instead. The stat block shows "Reaction" in its tag.',
                'Every stat block has a SAVE button under each Core Attribute. Saving Throw Training (Step 5, 2 TP each) grants the Training Bonus to one save.',
                'Conditions work on NPCs as on players: Stunned, Incapacitated, Paralyzed, Unconscious and Bleeding Out leave no AP at the start of their turn; Burning rolls 1d10 Fire; Poisoned, Frightened, Blinded, Prone and the rest add Disadvantage or Advantage; Paralyzed auto-fails STR and AGI.',
                'Remove Power asks for confirmation in front of the NPC Crafter, where you can see it.'
            ]],
            ['NPC Crafter and Weapon Forge', [
                'NPC weapons stay fully editable: reopen one in the Weapon Forge to change melee or ranged, Light, Medium or Heavy, and its damage type at any time.',
                'Each weapon shows its hand on the stat block, with ⇄ to switch. Shields (4 TP) and Helmets (2 TP) count free hands, with an Equip/Stow Shield button.',
                'Each +2 DR/ER purchase adds 2. Manufactured weapons and armor cost Threat Points. XP rewards per Tier are 1 / 5 / 10 / 15 / 25 / 35 for Tiers 0–5, then +10 per Tier.',
                'Power Crafter: at most 8 dice per die step and Mythic Utilities (a flat 130 XP).'
            ]],
            ['Initiative and Combat', [
                'The tracker works on its own. A battle map is used only when it\'s open or picked as the fight\'s Battle map.',
                'Every creature\'s AP is tracked and carries over. Surprised creatures get 1 AP on their first turn, and players\' AP refills on their turn even without a map.',
                'The combat log lives in the dice tray. Players see hits on enemies without numbers; you see every amount and every real name.',
                'Saves are rolled from the tray: players from theirs, NPCs from a button in your log. End Combat checks for anyone still Bleeding Out.',
                'When a player passes you an Omen die, it waits in your tray and replaces any creature\'s d20.'
            ]],
            ['Party and Companions', [
                'Party stat blocks show each player\'s AC, DR, ER, Max HP, AP, Initiative and Wound Threshold exactly as their sheet does.',
                'Loyal Companions sit under their owners with stat blocks, token art and + Initiative. Their HP follows their owner\'s sheet.'
            ]],
            ['Maps', [
                'Linked maps open in the same place: the first near the centre, each next one a little offset, and never off the screen, however many you open.',
                'Hover over an Area Circle and its name appears at once, for you and your players.',
                'Area Circles stay about the same size on screen as you zoom, so zoomed in on a city they mark one building, and zoomed out they never cover more than 3% of the map.',
                'Upload maps of any size: a compressed preview loads instantly and full-resolution tiles load as you zoom in, with no seams and no paid Firebase plan.',
                'Shift+drag moves groups of tokens, images have layers, M measures, F toggles the fog painter, and windows resize from the corner grip.'
            ]],
            ['Worlds and Accounts', [
                'Deleting a world removes its maps, fog, portraits, images, invite code and player list. Deleting your account does that for every world you run, plus your characters, races, NPCs and profile.',
                'Update your Firestore rules from FIREBASE_RULES.txt (v2026.9.25b).'
            ]],
            ['Fixes', [
                'Pages load faster, and an open page that finds a newer version reloads onto it.',
                'Closed windows no longer blur the page behind them on Android phones, and auto-save is dependable in long sessions.'
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
