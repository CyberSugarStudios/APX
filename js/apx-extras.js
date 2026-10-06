// ============================================================
// APX Extras (Character Sheet and GM Tools)
// ============================================================
//   • Sign-in lock: the tools need an account
//   • First-time tutorial for players and GMs (Settings → Show Tutorial reopens it)
//   • Colour swatches on every colour picker (recent colours; hover one for its X)
//   • "Currency" chip in every screen that spends Cu (Character Sheet)
// Loaded last on both pages.
// ============================================================
(function () {
    'use strict';
    const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const PAGE = /gmtools/i.test(location.pathname) ? 'gm' : 'sheet';
    const TOP = 2147483400;
    const prefs = () => window.apxPrefs || { whenAuth: cb => cb(null), uid: () => null, load: () => Promise.resolve({}), save: () => Promise.resolve() };

    function css() {
        if (document.getElementById('apxExtrasCss')) return;
        let st = document.createElement('style');
        st.id = 'apxExtrasCss';
        st.textContent = `
        .apxlock{position:fixed;inset:0;z-index:${TOP + 200};background:var(--c-bg,#020617);display:flex;align-items:center;justify-content:center;padding:16px}
        .apxlock>div{width:min(400px,100%);text-align:center;background:var(--c-surface,#1e293b);border:1px solid var(--c-border2,#475569);border-radius:.9rem;padding:1.6rem 1.4rem;color:var(--c-text,#fff);box-shadow:0 24px 70px rgba(0,0,0,.7)}
        .apxlock h2{margin:0 0 .5rem;font-size:1.25rem;font-weight:900;font-family:var(--c-heading-font,inherit)}
        .apxlock p{margin:0 0 1.1rem;font-size:.85rem;line-height:1.5;color:var(--c-text-dimmer,#cbd5e1)}
        .apxlock a{display:inline-block;background:var(--c-indigo,#4f46e5);color:#fff;font-weight:800;font-size:.85rem;padding:.6rem 1.3rem;border-radius:.5rem;text-decoration:none}
        .apxtut-back{position:fixed;inset:0;z-index:${TOP};background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;padding:16px}
        .apxtut{width:min(560px,100%);max-height:min(88vh,760px);display:flex;flex-direction:column;background:var(--c-surface,#1e293b);color:var(--c-text,#fff);
            border:1px solid var(--c-border2,#475569);border-radius:.85rem;box-shadow:0 24px 70px rgba(0,0,0,.75);font-family:var(--c-font,inherit)}
        .apxtut-hd{padding:1rem 1.2rem .6rem;border-bottom:1px solid var(--c-border,#334155)}
        .apxtut-hd small{display:block;font-size:.66rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--c-indigo-lt,#a5b4fc)}
        .apxtut-hd h3{margin:.15rem 0 0;font-size:1.15rem;font-weight:900;font-family:var(--c-heading-font,inherit)}
        .apxtut-body{overflow-y:auto;padding:.8rem 1.2rem 1rem;font-size:.84rem;line-height:1.5;color:var(--c-text-dimmer,#cbd5e1)}
        .apxtut-body p{margin:0 0 .6rem}
        .apxtut-body ul,.apxtut-body ol{margin:.2rem 0 .7rem;padding-left:1.2rem}
        .apxtut-body ul{list-style:disc} .apxtut-body ol{list-style:decimal}
        .apxtut-body li{margin:.2rem 0}
        .apxtut-body b{color:var(--c-text,#fff)}
        .apxtut-body kbd{font-family:inherit;font-size:.72rem;font-weight:800;padding:.02rem .35rem;border-radius:.25rem;border:1px solid var(--c-border2,#475569);background:var(--c-surface2,#0f172a);color:var(--c-text,#fff)}
        .apxtut-steps{display:flex;gap:.6rem;margin:.3rem 0 .8rem}
        .apxtut-steps div{flex:1;border:1px solid var(--c-border2,#475569);border-radius:.5rem;padding:.45rem .5rem;text-align:center;font-size:.72rem;background:var(--c-surface2,#0f172a)}
        .apxtut-steps div b{display:block;font-size:1rem}
        .apxtut-ft{display:flex;align-items:center;gap:.5rem;padding:.7rem 1.2rem;border-top:1px solid var(--c-border,#334155)}
        .apxtut-dots{display:flex;gap:.3rem;flex:1;flex-wrap:wrap}
        .apxtut-dots i{width:8px;height:8px;border-radius:50%;background:var(--c-border2,#475569);cursor:pointer}
        .apxtut-dots i.on{background:var(--c-indigo,#6366f1)}
        .apxtut-ft button{border:none;border-radius:.45rem;padding:.48rem 1rem;font-size:.8rem;font-weight:800;cursor:pointer;background:var(--c-border,#334155);color:var(--c-text,#fff)}
        .apxtut-ft button.pri{background:var(--c-indigo,#4f46e5);color:#fff}
        .apxtut-ft button:disabled{opacity:.35;cursor:default}
        .apxsw{position:fixed;z-index:${TOP + 300};display:flex;flex-wrap:wrap;gap:4px;max-width:176px;padding:5px;border-radius:.4rem;background:var(--c-surface,#1e293b);border:1px solid var(--c-border2,#475569);box-shadow:0 8px 24px rgba(0,0,0,.6)}
        .apxsw .sw{position:relative;width:18px;height:18px;border-radius:4px;border:1px solid rgba(255,255,255,.35);cursor:pointer;padding:0}
        .apxsw .sw .x{position:absolute;top:-6px;right:-6px;width:13px;height:13px;border-radius:50%;background:#dc2626;color:#fff;font-size:9px;font-weight:900;line-height:13px;text-align:center;display:none;cursor:pointer}
        .apxsw .sw:hover .x{display:block}
        .apxsw .lbl{width:100%;font-size:.58rem;font-weight:800;color:var(--c-text-muted,#94a3b8)}
        .apxcur{display:flex;justify-content:flex-end;margin:-.2rem 0 .45rem}
        .apxcur span{font-size:.72rem;font-weight:800;color:#fde68a;background:rgba(234,179,8,.12);border:1px solid rgba(234,179,8,.45);border-radius:1rem;padding:.12rem .6rem}
        [data-theme="kawaii"] .apxcur span{color:#854d0e;background:#fef9c3;border-color:#ca8a04}`;
        document.head.appendChild(st);
    }

    // ── Sign-in lock (#12) ───────────────────────────────────────────────
    // The Player and GM Tools need an account. Signed out: a full-page notice that links to sign-in.
    function lock(on, offline) {
        let el = document.querySelector('[data-apx-lock]');
        if (!on) { el && el.remove(); return; }
        if (el) return;
        css();
        el = document.createElement('div');
        el.className = 'apxlock';
        el.setAttribute('data-apx-lock', '1');
        el.innerHTML = offline
            ? `<div><h2>Can't reach your account</h2>
            <p>APX couldn't load its sign-in service. Check your internet connection, and that an ad or script blocker isn't blocking gstatic.com or googleapis.com, then reload.</p>
            <a href="" onclick="location.reload();return false;">Reload</a></div>`
            : `<div><h2>Sign in to use APX Tools</h2>
            <p>The Character Sheet and GM Tools need a free APX account. Your characters, worlds and settings are kept in it, so they're on every device you sign in on.</p>
            <a href="index.html">Sign in or create an account</a></div>`;
        document.body.appendChild(el);
    }
    try { sessionStorage.removeItem('apxLocalOnly'); } catch (e) { }
    if (window.FIREBASE_ENABLED) prefs().whenAuth(user => lock(!user, !(window.apxAuth && window.apxAuth.enabled)));

    // ── Tutorial (#11) ───────────────────────────────────────────────────
    const SHEET_STEPS = [
        ['Welcome', 'Welcome to the APX Character Sheet', `
            <p>This is where you build and play your APX characters. Everything you do saves to your account on its own, so your characters are on every device you sign in on.</p>
            <ul><li>Your characters are in the <b>Roster</b> sidebar. Sort them into folders, archive old ones, or start a new one.</li>
            <li>A character belongs to <b>one world</b> at a time, and you have one character in each world.</li>
            <li>Hover almost anything for a tooltip that explains it.</li></ul>`],
        ['Making a character', 'Character creation: three steps, in order', `
            <div class="apxtut-steps"><div><b>1</b>Race Builder</div><div><b>2</b>Origin</div><div><b>3</b>Spend XP</div></div>
            <p>A character is finished by doing all three, in this order. Each one is a button at the top of the sheet.</p>
            <ol><li><b>Race Builder</b> (the Ancestry button): pick a race your GM made (or build your own), spend its Genetic Points, and choose its training. <b>Save &amp; Apply</b> sends you back to any step that's still missing something.</li>
            <li><b>Origin</b>: your life before adventuring: languages and trainings, starting wealth, and an Origin feature.</li>
            <li><b>Spend XP</b>: buy attributes, skill ranks, perks, Hit Points and powers. Everything you gain and spend is in the <b>XP Log</b>.</li></ol>`],
        ['Rolling', 'Rolling dice', `
            <p>Click any skill, attribute, save, weapon or power on the sheet to roll it. Results show up in the <b>Dice and Notifications tray</b> (the d20 button in the bottom-right corner).</p>
            <ul><li>The tray has Advantage and Disadvantage for the next d20, a dice pool for any other roll, and buttons to spend <b>Luck Points</b> or <b>Omen dice</b> on a roll you just made.</li>
            <li>Conditions, wounds and your perks are added to rolls for you, and the badges on a roll show what changed it.</li>
            <li>A power or consumable with a <b>second damage type</b> splits its dice (you choose how many go to the second type when you craft it), and each type is rolled on its own with the total underneath.</li>
            <li>The <b>Chat</b> at the bottom of the tray messages everyone, just the GM, or any players you pick.</li>
            <li><b>Power saves:</b> a power that calls for a saving throw names which Core Attribute its targets roll (you pick it in Step 1 of the Power Crafter). A power that leaves a lasting effect on its target (a Condition for 1 Minute or more, a command, a polymorph…) also names an <b>Escape Save</b> (Step 6): the target rolls it at the end of each of its turns to break free, and it can't be a save the effect makes it automatically fail (no STR or AGI against Paralyzed, Stunned or Unconscious; no PER against Blinded).</li>
            <li>Powers built before these rules show a <b>Powers to rebuild</b> list when your sheet opens. Rebuild each one for free; the list goes away once they're all done.</li>
            <li><b>Step 3 (Targeting):</b> pick <b>AoE</b> (x3), then a <b>Line</b> (0.5 XP per square), <b>Cone</b> (3 XP per square of length) or <b>Burst</b> (10 XP per square of radius), and size it with <b>−</b> and <b>+</b>. The preview shows the squares it hits, the shape's XP and the power's total. Old Small to Massive area powers are on the rebuild list.</li>
            <li><b>Step 7 (AP):</b> set the AP cost with <b>−</b> and <b>+</b>: each AP below 4 costs 10 XP and each AP over 4 refunds 5 XP, up to twice the AP you gain at the start of your turn (AP can be banked for a big power). Or make the power a <b>Reaction</b> (15 XP) with a trigger you write, or pick a <b>Lengthy Cast Time</b> (1 Minute to 24 Hours) from the dropdown for XP back. Steps 1 and 3 are called <b>Delivery</b> and <b>Targeting</b>, and every power costs at least 5 XP. Powers built under the old Step 7 can be rebuilt for any XP they now save, or kept.</li>
            <li><b>Choose the damage type on use</b> (Step 4, +10 XP): using the power asks which type it deals (both, with a second type).</li>
            <li>Damage that adds your Power Attribute shows the number ("2d6 Fire +3"). The <b>Consumable Crafter</b> follows the same save and Escape Save rules, and <b>Artisan</b> raises its XP limit by 5 per rank.</li></ul>`],
        ['Actions', 'Actions and AP', `
            <ul><li>Click the <b>Action Points</b> title in Vitals for every Combat Maneuver and Standard Action. Clicking one spends its AP (short on AP? you're asked first) and applies what it can: Fight Defensively's AC, Power Attack's damage on your next melee attack, Feint's Advantage, and so on.</li>
            <li>Combat Maneuvers are on the left, Standard Actions on the right. Greyed-out ones need something you don't have (Block needs a shield or a Sturdy weapon, Shield Bash a shield). Block with a Sturdy weapon rolls its die for you.</li>
            <li><b>Grappling:</b> Grapple (3 AP) and Pin (2 AP) roll your Athletics and ask whether you won the contest; you're Staggered while you hold on, and your GM's tracker marks the creature next to you. Choke (2 AP) deals your unarmed damage to a Pinned creature, lethal or non-lethal. Escape (4 AP) breaks free; ✕ on "Grappling" lets go.</li>
            <li>The 📌 beside an action pins it to <b>Weapons &amp; Attacks</b>, so the ones you build around are one click away. Click ✕ on a pinned action to unpin it.</li>
            <li>Active effects show under <b>Armor &amp; Defenses</b> with a red <b>✕</b> to end them early. Most end on their own at your next turn or when you attack.</li>
            <li><b>Teleporting</b> doesn't provoke Attacks of Opportunity.</li>
            <li><b>Tactician:</b> at Rank 1, when your GM starts combat a window shows the initiative order (allies, enemies, who's Surprised) so you can swap an ally's place with another creature's. At Rank 5, once per combat, the start of your turn asks whether to give it to an ally instead.</li>
            <li>Powers with <b>Summon a Creature</b> have you build the creature in the NPC Crafter when you save the power; <b>Edit Summoned Creature</b> on the power changes it later. It gets all the TP its Tier allows (Tier 1: 29 TP), and its own powers cost TP from that budget, never your XP. Summoned creatures have a hard 3 AP each turn and can't summon creatures of their own; a Loyal Companion's summons can't be a higher Tier than it. Using it puts the creatures next to your token on your GM's battle map.</li>
            <li>Your Loyal Companion's forged armor and weapons cost only Threat Points, and follow the same armor rules as yours (weight class, STR requirement).</li>
            <li><b>Area powers on the battle map:</b> with your GM's battle map open, using a power with a Line, Cone or Burst has you place its area first, at the size you crafted. A <b>Self or Touch</b> area starts from your token: <b>scroll</b> to turn it, click a square to point it there, or drag its start to the square next to you. A <b>ranged</b> area follows your mouse: click to place it within range (red means out of range), then drag, turn or re-aim it. <kbd>Enter</kbd> uses it, <kbd>Esc</kbd> cancels, and <b>Use without the map</b> skips placing it. Your GM's tracker rolls everyone's saves in it and deals the damage. With <b>Safe Zone</b>, right-click a creature in the area to keep it safe.</li></ul>`],
        ['Shortcuts', 'Shortcuts worth knowing', `
            <ul><li>Number boxes do math: type <kbd>+5</kbd> or <kbd>-3</kbd> to add or subtract, or <kbd>35-9</kbd> after what's there.</li>
            <li>Hit Points: <kbd>-9</kbd> takes 9 damage, through Temp HP first. <kbd>-9 fire</kbd> uses that damage type, so your DR/ER, resistances and immunities apply. Hit by the GM's creature? Its damage type is used for you. Add <kbd>nl</kbd> (or tick Non-lethal) for non-lethal damage: 0 HP knocks you out instead of Bleeding Out.</li>
            <li><kbd>Ctrl</kbd>+<kbd>Z</kbd> undoes and <kbd>Ctrl</kbd>+<kbd>Y</kbd> redoes changes on the sheet. <kbd>Enter</kbd> confirms a box.</li>
            <li>Double-click a popup window's title bar to minimize it to a tab in the bottom-left corner, named after the map, area or NPC in it; click the tab to bring it back.</li>
            <li>A character can be open in one browser tab at a time: opening it in a second tab sends the first one back to the lobby, so AP and HP never get spent twice.</li>
            <li>On battle maps: <kbd>M</kbd> measures (right-click drops a waypoint, the toolbar switches to Cone or Burst, <kbd>Esc</kbd> stops). A measurement stays after you let go: drag its <b>start point</b> to move it (from your own token, that moves you, AP and all), and <b>scroll while dragging</b> its start to turn a Line or Cone (a Line keeps its length as it turns; scrolling while you're still drawing doesn't turn it). A Cone starts at the edge of your space, so you're never in your own cone. <kbd>Shift</kbd>-drag starts a new one. Everyone at the table sees your measurement. In combat, dragging your token shows the path and its AP cost; hold <kbd>Alt</kbd> to move without paying AP. Wheel zooms; <kbd>Ctrl</kbd>-drag or middle-drag pans.</li></ul>`],
        ['Worlds', 'Playing in your GM\'s world', `
            <ul><li>Your GM gives you an <b>invite code</b>. Join the world from the lobby (or the World screen's <b>+ Join World</b>) and pick, or make, the character you'll play there.</li>
            <li>The <b>World</b> button opens what your GM shares: maps, locations, NPCs you've met, notes and discoveries, and the party.</li>
            <li>In combat your GM's tracker and your sheet stay in sync: damage, conditions, wounds, AP and turns. New Turn refreshes your AP.</li>
            <li>Give items to other players from your inventory, and loot the GM shares lands in your inventory.</li></ul>`],
        ['Find it again', 'That\'s the basics', `
            <p>You can open this tutorial again any time: <b>Settings → Show Tutorial</b>. The same place has the <b>Patch Notes</b> for what changed in each update.</p>
            <p>The rules themselves are in the APX rulebook. The sheet follows them, but every number can still be edited by hand when your GM rules otherwise.</p>`]
    ];
    const GM_STEPS = [
        ['Welcome', 'Welcome to the APX GM Tools', `
            <p>Everything you need to run APX: worlds, players, NPCs, combat, maps, loot and notes. It all saves to your account and syncs to your players live.</p>
            <ul><li>Start with <b>+ New World</b>, or <b>Load World</b> to open one you made.</li>
            <li>Every world has an <b>invite code</b> (in the <b>World</b> screen; click it to copy). Players join with it from their Character Sheet; <b>Load Party</b> brings their characters into your tracker.</li>
            <li>The World screen's player list is also where you kick a player (with or without a ban).</li></ul>`],
        ['NPCs', 'NPCs, races and the Library', `
            <ul><li>The <b>NPC Crafter</b> builds stat blocks from a Tier and a TP budget: attributes, weapons, armor, perks, traits and powers. Stat blocks roll straight from their dice, and a power with two damage types rolls each separately; the tracker splits the damage you enter the same way.</li>
            <li><b>Race Templates</b> are the races your players can pick in their Race Builder; changes reach them live.</li>
            <li>NPC sizes run from Tiny or Smaller (3 TP: +2 AC, Advantage on Stealth, reach 0, no Heavy weapons) to Gargantuan (−2 AC, Advantage on Athletics, Disadvantage on Stealth). A size's effects apply on their own, and stat blocks list every <b>Skill</b> that isn't a plain attribute check (trained, its own bonus, Advantage or Disadvantage).</li>
            <li><b>Swarms</b> share squares with other creatures and tuck under them; a small handle beside the creature shows the swarm (hover for details, drag to move it). They take half damage from single-target attacks and double from area effects (you're asked when it's unclear), and roll half their damage dice below half HP.</li>
            <li>NPC and companion tokens follow their stat block's size (Tiny … Gargantuan) unless you Shrink or Grow them; "Stat block size" puts it back.</li>
            <li>Items, forged weapons and armor, consumables and powers you make go into your <b>Library</b>, tagged with the world you made them in, so you can reuse them anywhere. Powers your NPCs and their items already have are in it too.</li>
            <li>Powers name the Core Attribute of their saving throw, and a power with a lasting effect names an <b>Escape Save</b> its target can actually pass. When a world opens, the <b>NPCs to rebuild</b> list shows any stat blocks whose powers were built before these rules: <b>Rebuild</b> opens the NPC and walks you through each power, and finished NPCs drop off the list.</li>
            <li><b>Unlimited Uses</b> on an NPC power costs 5 more TP per Power Level, at any Power Level and Tier.</li>
            <li>An NPC's <b>Summon a Creature</b> power can summon an NPC you've already made: pick it from the list in the Power Crafter (only NPCs at or below the power's Tier that don't summon). <b>Edit Summoned Creature</b> in the NPC Crafter's power list changes the creature later. A summoned creature you build ends with <b>Save Creature</b> on its last step.</li>
            <li><b>Token Image</b> (NPC Crafter, under the name) is a stat block's default token on battle maps and in the tracker, for you and your players. A named NPC's own picture replaces it on their token, and a summoned NPC brings its image along.</li>
            <li>▲ ▼ beside an NPC's (or Loyal Companion's) powers in the NPC Crafter set the order its stat block lists them in.</li>
            <li><b>Mythic Awakening:</b> build <b>Awakened Powers</b> under it in the NPC Crafter. They're locked on the stat block until the creature Awakens, which happens on its own at its first 0 HP in the tracker (full HP, conditions cleared, full AP, its turn now), or tick <b>Awakened</b> on its tracker row. Its XP reward is doubled.</li>
            <li>In the World screen's <b>Loot &amp; Items</b> and <b>Powers</b> tabs, every entry has an <b>Edit</b> button: powers reopen in the Power Crafter, forged weapons and armor in their forge, consumables in the Consumable Crafter, and other items in a quick form. Only the Library's copy changes; anything already handed out or placed stays as it was.</li></ul>`],
        ['Combat', 'Running combat', `
            <ul><li>Add NPCs and players to the <b>initiative tracker</b>, then <b>Start Combat</b> and use <b>Next Turn</b>. AP, reactions, condition timers and auras are handled turn by turn.</li>
            <li>Damage is entered as a number (or <kbd>-12 fire</kbd>): DR/ER, resistances, wounds and Wound Thresholds are applied for you, and saves and wound checks are asked of the right player. <kbd>-12 nl</kbd> (or the Non-lethal box) is non-lethal: at 0 HP the creature is knocked out, grey with snoring Z's on the map, instead of dying or Bleeding Out.</li>
            <li><b>Grapples</b> keep themselves in step: marking a creature Grappled or Pinned links it to whoever's next to it (you're asked if there's more than one), and the grappler is Staggered until the grapple ends (Escape, letting go, Incapacitated, or out of the fight). A Grappling weapon hit grapples on its own.</li>
            <li><b>Tactician:</b> a player with Tactician Rank 1 is asked for an initiative swap when you press <b>Start Combat</b>; you see <b>Waiting on Tactician choice</b> (with <b>Choose for them</b> and <b>Start without waiting</b>). At Rank 5 they can give their turn to an ally once per combat; <b>Next Turn</b> then carries on after the Tactician.</li>
            <li>Summoned creatures (players', companions' and your NPCs') appear next to their summoner on the battle map and act right after it, with a hard 3 AP each turn.</li>
            <li><b>Power saves and Escape Saves:</b> when a power that calls for a save (or inflicts Conditions) is used, your dice tray gets a <b>Roll targets' saves</b> (or <b>Apply</b>) button. Pick the targets: NPCs' saves are rolled for you, players are asked to roll theirs, and whoever fails gets the Conditions. A lasting effect shows on the creature's tracker row; its Escape Save is asked for at the end of each of its turns (and when it takes damage, with Damage Interrupt), and attacking ends it with Action Interrupt. <b>Save</b> rolls it now, <b>3 AP</b> spends AP to repeat it, and ✕ ends it.</li>
            <li><b>Area powers on the battle map:</b> using a power with a Line, Cone or Burst (from a stat block, or a player's or companion's) while its user's token is on an open battle map has its area placed first: from the creature for Self or Touch (<b>scroll</b> to turn it), anywhere in range for the rest. Right-click creatures to leave them out. A window then lists everyone in it with their save already rolled and the damage each takes; untick anyone it shouldn't touch and press <b>Deal it</b>. DR, ER, resistances and Swarms are worked out as it's dealt.</li>
            <li><b>Recharge powers:</b> using one from the stat block marks it used. At the start of the creature's turn it rolls a d6 to recharge (5-6, or 6), and the <b>Recharge</b> button on its tracker row spends half the power's AP to roll for it now. A power whose damage type is chosen on use asks you which type.</li>
            <li>The <b>Party</b> panel shows two players side by side, with their powers in full; click a power's name to open it in its own window. Right-click a chat message to delete it for everyone.</li>
            <li>Click a creature's conditions to change them, players included (Grappled and Pinned are there too). Condition immunities are enforced. <b>⤓ Fall</b> rolls fall damage with the Acrobatics reaction.</li>
            <li>Loyal Companions and summoned creatures act on their owner's initiative, right after them. A player's Summon a Creature power places its creatures next to them on the battle map they're on.</li>
            <li>NPCs follow the armor rules too: weight class caps their AGI bonus to AC, and an unmet STR requirement costs them their AGI to AC, 2 Speed, and gives Disadvantage on attacks. Their forged gear costs TP, never Cu.</li>
            <li><b>Undead</b> and <b>Unalive Structure</b> NPC traits run themselves: immunities, vulnerabilities, the Undead revival save at the start of its turn, the Electric Stun save, and repair-only healing.</li>
            <li>The combat log and your players' rolls show up in your dice tray.</li></ul>`],
        ['Maps', 'Maps and battle maps', `
            <ul><li><b>Upload Map</b> for world maps, dungeons and buildings. Pin locations with notes and subnotes; what you reveal becomes your players' Discoveries.</li>
            <li>Turn on the <b>Grid</b> (size, offset, colour, thickness, opacity), place tokens, resize them, and paint <b>Fog</b> of war.</li>
            <li><b>Measure</b> (<kbd>M</kbd>) has Line, Cone and Burst modes and lists who's inside an area. A Cone covers every square at least a quarter inside the cone as drawn, and a Burst every square at least half inside its circle. Right-click drops waypoints.</li>
            <li>A measurement stays put: drag its <b>start point</b> to move it (on a creature, that moves the creature, with its path and AP in combat), and <b>scroll while dragging</b> its start to turn a Line or Cone square by square (scrolling while you're still drawing doesn't turn it). Lines shade the squares they cover and keep their length as they turn, and a Cone starts at the edge of its creature's space, so it never covers that creature. Players' measurements show on your map in blue; yours reach them only while you show them with <kbd>V</kbd>.</li>
            <li>Share a map with your players, and stop sharing to close it on their screens.</li>
            <li>Tokens added with <b>+ Token</b> from the tracker start hidden; reveal them from the token's menu. <b>Shrink</b> and <b>Grow</b> in a token's menu change its size. Double-click a window's title bar to minimize it to a tab, named after its map, Area Circle (its name, or "Area B" without one), NPC or note.</li></ul>`],
        ['Loot and notes', 'Loot, crafting and notes', `
            <ul><li>The <b>Loot Maker</b> builds loot boxes and gives items or Currency to players; a hidden grant isn't shown to the rest of the party. Its <b>Crafting Materials</b> button adds Common, Uncommon and Rare materials in any amounts, and they join a player's own Crafting Materials when given.</li>
            <li>Each named NPC keeps its <b>own loot</b> in its NPC window (+ Loot Maker), dropped when it's defeated. Stat blocks never show loot: only what the creature always carries or wields. A stat block's <b>Generic Drops</b> (NPC Crafter) drop from every creature built from it.</li>
            <li>The Weapon and Armor Forges and the Consumable Crafter make custom gear for shops and loot.</li>
            <li><b>Session Notes</b> keep a log of each session, with bullets and bold, and a read view.</li>
            <li><b>Grant XP</b> has a <b>Start Session</b> type: 5 XP (each sheet adds its INT), named for the session, for everyone who showed up.</li></ul>`],
        ['Limits', 'What the tools do, and what they don\'t', `
            <p><b>They do:</b> track your worlds, NPCs and combat; do APX's math (damage, mitigation, conditions, wounds, AP); and keep your players' sheets in sync with your tracker in real time.</p>
            <p><b>Keep in mind:</b></p>
            <ul><li>Everyone needs an account and an internet connection. Players must have a character in your world to see it.</li>
            <li>The automation covers the APX rules. Anything unusual (a homebrew effect, a ruling at the table) you apply by hand; every number can be edited.</li>
            <li>Images are stored in your account, so very large maps are saved in tiles and can take a moment to load for players.</li>
            <li>Chat is text only, and messages older than a week are cleared. There's no voice or video.</li>
            <li>Works best in a desktop browser. Phones are fine for character sheets; battle maps want a bigger screen.</li></ul>
            <p>Open this again from <b>Settings → Show Tutorial</b>. Patch Notes are there too.</p>`]
    ];

    window.apxShowTutorial = function (auto) {
        css();
        document.querySelector('[data-apx-tutorial]')?.remove();
        let steps = PAGE === 'gm' ? GM_STEPS : SHEET_STEPS, i = 0;
        let back = document.createElement('div');
        back.className = 'apxtut-back';
        back.setAttribute('data-apx-tutorial', PAGE);
        back.innerHTML = `<div class="apxtut" role="dialog" aria-modal="true" aria-label="Tutorial"><div class="apxtut-hd"><small data-k></small><h3 data-t></h3></div>
            <div class="apxtut-body" data-b></div>
            <div class="apxtut-ft"><div class="apxtut-dots" data-dots></div><button data-skip>${auto ? 'Skip' : 'Close'}</button><button data-prev>Back</button><button class="pri" data-next>Next</button></div></div>`;
        let draw = () => {
            let [k, t, b] = steps[i];
            back.querySelector('[data-k]').textContent = `${PAGE === 'gm' ? 'GM Tools' : 'Character Sheet'} · ${i + 1} of ${steps.length} · ${k}`;
            back.querySelector('[data-t]').textContent = t;
            back.querySelector('[data-b]').innerHTML = b;
            back.querySelector('[data-b]').scrollTop = 0;
            back.querySelector('[data-prev]').disabled = i === 0;
            back.querySelector('[data-next]').textContent = i === steps.length - 1 ? 'Done' : 'Next';
            back.querySelector('[data-dots]').innerHTML = steps.map((s, j) => `<i class="${j === i ? 'on' : ''}" data-j="${j}" title="${esc(s[0])}"></i>`).join('');
            back.querySelectorAll('[data-j]').forEach(d => d.onclick = () => { i = +d.dataset.j; draw(); });
        };
        let close = () => {
            prefs().save({ tutorialSeen: { [PAGE]: true } });
            back.remove(); document.removeEventListener('keydown', key, true);
        };
        let key = e => {
            if (e.key === 'Escape') { e.stopPropagation(); close(); }
            else if (e.key === 'ArrowRight' && i < steps.length - 1) { i++; draw(); }
            else if (e.key === 'ArrowLeft' && i > 0) { i--; draw(); }
        };
        back.querySelector('[data-skip]').onclick = close;
        back.querySelector('[data-prev]').onclick = () => { if (i > 0) { i--; draw(); } };
        back.querySelector('[data-next]').onclick = () => { if (i < steps.length - 1) { i++; draw(); } else close(); };
        document.addEventListener('keydown', key, true);
        document.body.appendChild(back);
        draw();
        back.querySelector('[data-next]').focus();
    };
    // First time on this page with this account
    let tutChecked = false;
    prefs().whenAuth(user => {
        if (!user || tutChecked) return;
        tutChecked = true;
        prefs().load().then(p => {
            if (((p || {}).tutorialSeen || {})[PAGE]) return;
            let tries = 0;
            let go = () => {
                if (document.querySelector('[data-apx-lock], [data-apx-rules-popup], .apxpn-back') && tries++ < 300) { setTimeout(go, 1000); return; }
                if (!document.querySelector('[data-apx-tutorial]')) window.apxShowTutorial(true);
            };
            setTimeout(go, 300);
        });
    });

    // ── Colour swatches (#15) ────────────────────────────────────────────
    // Colours you pick are kept (most recent first) and offered beside every colour picker.
    // Click one to use it; hover it for an X that removes it.
    const SW_MAX = 16;
    let swatches = [];
    try { swatches = JSON.parse(localStorage.getItem('apxSwatches') || '[]') || []; } catch (e) { }
    prefs().whenAuth(user => {
        if (!user) return;
        prefs().load().then(p => {
            let acc = Array.isArray((p || {}).swatches) ? p.swatches : null;
            if (acc) { swatches = acc.concat(swatches.filter(c => !acc.includes(c))).slice(0, SW_MAX); storeSwatches(false); }
        });
    });
    function storeSwatches(toAccount) {
        try { localStorage.setItem('apxSwatches', JSON.stringify(swatches)); } catch (e) { }
        if (toAccount !== false) prefs().save({ swatches: swatches.slice() });
    }
    function norm(c) { c = String(c || '').toLowerCase().trim(); return /^#[0-9a-f]{6}$/.test(c) ? c : null; }
    function remember(c) {
        c = norm(c); if (!c) return;
        swatches = [c].concat(swatches.filter(x => x !== c)).slice(0, SW_MAX);
        storeSwatches();
    }
    document.addEventListener('change', e => { let t = e.target; if (t && t.tagName === 'INPUT' && t.type === 'color') remember(t.value); }, true);

    let swEl = null, swFor = null, swHideT = 0;
    function hideSw() { clearTimeout(swHideT); swHideT = setTimeout(() => { swEl && swEl.remove(); swEl = null; swFor = null; }, 350); }
    function drawSw(input) {
        if (!swatches.length) { swEl && swEl.remove(); swEl = null; return; }
        css();
        if (!swEl) {
            swEl = document.createElement('div');
            swEl.className = 'apxsw';
            swEl.addEventListener('mouseenter', () => clearTimeout(swHideT));
            swEl.addEventListener('mouseleave', hideSw);
            document.body.appendChild(swEl);
        }
        swFor = input;
        swEl.innerHTML = '<div class="lbl">Recent colours</div>' + swatches.map(c => `<button type="button" class="sw" data-c="${c}" style="background:${c}" title="${c}"><span class="x" data-x="${c}" title="Remove">×</span></button>`).join('');
        let r = input.getBoundingClientRect();
        let left = Math.min(window.innerWidth - 190, Math.max(4, r.left));
        let top = r.bottom + 4;
        swEl.style.left = left + 'px'; swEl.style.top = top + 'px';
        let h = swEl.getBoundingClientRect().height;
        if (top + h > window.innerHeight - 4) swEl.style.top = Math.max(4, r.top - h - 4) + 'px';
        swEl.querySelectorAll('[data-x]').forEach(x => x.onclick = ev => {
            ev.stopPropagation();
            swatches = swatches.filter(c => c !== x.dataset.x); storeSwatches();
            swFor && document.body.contains(swFor) ? drawSw(swFor) : hideSw();
        });
        swEl.querySelectorAll('[data-c]').forEach(b => b.onclick = ev => {
            if (ev.target.closest('[data-x]')) return;
            let inp = swFor; if (!inp || !document.body.contains(inp)) return;
            inp.value = b.dataset.c;
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            inp.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }
    document.addEventListener('mouseover', e => {
        let t = e.target;
        if (t && t.tagName === 'INPUT' && t.type === 'color' && !t.disabled) { clearTimeout(swHideT); if (swFor !== t || !swEl) drawSw(t); }
    });
    document.addEventListener('mouseout', e => { let t = e.target; if (t && t.tagName === 'INPUT' && t.type === 'color') hideSw(); });
    document.addEventListener('focusin', e => { let t = e.target; if (t && t.tagName === 'INPUT' && t.type === 'color') drawSw(t); });
    window.addEventListener('scroll', () => { if (swEl) { swEl.remove(); swEl = null; swFor = null; } }, true);

    // ── Currency in purchase screens (#23) ───────────────────────────────
    const SHOP_MODALS = ['gearPickerModal', 'itemModal', 'weaponForgeModal', 'weaponCraftModal', 'armorForgeModal', 'armorCraftModal',
        'consumableCrafterModal', 'payOrGrantModal', 'helmetRepairModal', 'customWeaponModal'];
    function curText() { let n = parseInt(window.state && window.state.currency) || 0; return `Your Currency: ${n.toLocaleString()} Cu`; }
    function chipFor(modal) {
        let box = modal.querySelector('.modal-content') || modal.firstElementChild; if (!box) return;
        let chip = box.querySelector(':scope > .apxcur');
        if (!chip) {
            css();
            chip = document.createElement('div');
            chip.className = 'apxcur';
            chip.innerHTML = '<span title="What you have to spend"></span>';
            box.insertBefore(chip, box.firstChild);
        }
        let s = chip.querySelector('span'), t = curText();
        if (s.textContent !== t) s.textContent = t;
    }
    if (PAGE === 'sheet') {
        setInterval(() => {
            if (!window.state) return;
            SHOP_MODALS.forEach(id => { let m = document.getElementById(id); if (m && m.classList.contains('active')) chipFor(m); });
        }, 400);
    }

    // ── One tab per character ────────────────────────────────────────────
    // A character open in two tabs got its AP twice (both tabs reacted to New Turn and combat start)
    // and the two tabs overwrote each other's saves. The tab that opens a character takes it over:
    // any other tab of this browser with the same character goes back to the character list.
    if (PAGE === 'sheet' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('apx-sheet-tabs');
        const me = Math.random().toString(36).slice(2);
        let mine = null;
        let claim = () => { if (mine) bc.postMessage({ t: 'claim', id: mine, from: me }); };
        setInterval(() => {
            let id = window._activeCloudCharId || null;
            if (id !== mine) { mine = id; claim(); }
        }, 600);
        bc.onmessage = e => {
            let m = e.data || {};
            if (m.t !== 'claim' || m.from === me || !m.id || m.id !== window._activeCloudCharId) return;
            // Another tab just opened this character: step aside (saves have already gone out as you played)
            try { window.scheduleSave && window.scheduleSave(); } catch (er) { }
            try { sessionStorage.setItem('apxTabMoved', (window.state && window.state.name) || 'This character'); } catch (er) { }
            window._activeCloudCharId = null;   // stop reacting to this character while the page reloads
            setTimeout(() => location.reload(), 150);
        };
        let moved = null; try { moved = sessionStorage.getItem('apxTabMoved'); sessionStorage.removeItem('apxTabMoved'); } catch (e) { }
        if (moved) setTimeout(() => {
            let msg = `${moved} was opened in another tab, so this tab went back to your characters. A character can only be open in one tab at a time (otherwise both tabs count its AP).`;
            if (window.apxAlert) window.apxAlert(msg, { title: 'Opened in Another Tab' }); else window.APXDice?.notify(msg, { kind: 'note' });
        }, 1200);
    }
})();
