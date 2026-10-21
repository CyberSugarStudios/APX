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
            <li><b>Export JSON</b> saves a sealed copy of a character. <b>Import JSON</b> always makes it a <i>new</i> character (never over the one you have open, or a world's). A file you exported from this account and didn't change comes in as it was; one that was changed, came from another account, or predates sealing is marked <b>Imported file</b>, and the GM of any world it joins sees the mark and what changed until they clear it.</li>
            <li>A character belongs to <b>one world</b> at a time, and you have one character in each world.</li>
            <li>Hover almost anything for a tooltip that explains it.</li></ul>`],
        ['Making a character', 'Character creation: three steps, in order', `
            <div class="apxtut-steps"><div><b>1</b>Race Builder</div><div><b>2</b>Origin</div><div><b>3</b>Spend XP</div></div>
            <p>A character is finished by doing all three, in this order. Each one is a button at the top of the sheet.</p>
            <ol><li><b>Race Builder</b> (the Ancestry button): pick a race your GM made (or build your own), spend its Genetic Points, and choose its training. <b>Save &amp; Apply</b> sends you back to any step that's still missing something. Some traits set themselves up next: <b>Discharging Internals</b> opens a small crafter (a 3-square Cone or 6-square Line, an Energy type, and the attribute for its DC) and adds it to your Powers, used once per Short Rest without a Power Slot; <b>Integrated Equipment</b> has you pick standard gear for each time you took it, added to your inventory as "(Integrated)". Traits and flaws the sheet doesn't already show somewhere (Nightvision, a Prehensile Tail, Light Sensitive…) are listed in an <b>Ancestry Traits</b> note beside Languages. Notes keep your line breaks and bullets: start a line with "- ", "* " or "1. " for a list.</li>
            <li><b>Origin</b>: your life before adventuring: languages and trainings, starting wealth, and an Origin feature. If your GM made <b>Origin Templates</b> for your world, they're at the top of the Origin Builder: pick one to start from it. What your GM locked (🔒) is fixed; everything else is yours to choose. <b>Build my own</b> goes back to a blank origin.</li>
            <li><b>Spend XP</b>: buy attributes, skill ranks, perks, Hit Points and powers. <b>+ Add Power</b> (Powers) lists the powers your GM made for your world: <b>Learn</b> opens one in the Power Crafter, where you pay its XP and choose its Core Attribute; or build your own with the <b>Power Crafter</b>. Everything you gain and spend is in the <b>XP Log</b>. A General Perk you got from your race (a Racial Bonus Perk) counts toward that perk: ranks you buy later add to it, up to its max.</li></ol>
            <p><b>Changed your mind about a perk?</b> <b>− Rank</b> beside a perk's rank (or <b>Remove Rank</b> in the Perk Forge) takes off its top rank and gives back the XP it cost, one rank at a time. Whatever that rank set up goes with it: its choice, its Power Slots and a free power you haven't made yet, Martial Arts' unarmed strike, extra Omen Dice, a Loyal Companion's bought TP. Uses per rest stay used, and a free power you already made stays (buying the rank again won't give a second one). Your GM can turn this off for their world.</p>`],
        ['Rolling', 'Rolling dice', `
            <p>Click any skill, attribute, save, weapon or power on the sheet to roll it. Results show up in the <b>Dice and Notifications tray</b> (the d20 button in the bottom-right corner).</p>
            <ul><li>The tray has Advantage and Disadvantage for the next d20, a dice pool for any other roll, and buttons to spend <b>Luck Points</b> or <b>Omen dice</b> on a roll you just made.</li>
            <li><b>Out of Luck?</b> With no Luck Points left, a d20 roll offers <b>Ask for a Luck Point</b> when someone else in your world still has one. Every ally with a Luck Point gets a prompt (and the ask shows in the chat): the first to click <b>Spend 1 Luck Point</b> pays it and your roll is rerolled. If two allies click at once, only one is charged. Unanswered asks close after 3 minutes.</li>
            <li>Conditions, wounds and your perks are added to rolls for you, and the badges on a roll show what changed it.</li>
            <li>A power or consumable with a <b>second damage type</b> splits its dice (when you craft it, ◀ ▶ beside each die size moves its dice between the two types, so 2d4 + 2d6 can be 2d6 Piercing + 2d4 Poison), and each type is rolled on its own with the total underneath.</li>
            <li>The <b>Chat</b> at the bottom of the tray messages everyone, just the GM, or any players you pick.</li>
            <li>A roll your GM asks you for (a Wound Threshold save, a power's save) stays <b>pinned to the top</b> of the tray, marked <b>Waiting on you</b>, until you roll it. Double-click the tray's title bar to close it, like the d20 button.</li>
            <li><b>Power saves:</b> a power that calls for a saving throw names which Core Attribute its targets roll (you pick it in Step 1 of the Power Crafter). A power that leaves a lasting effect on its target (a Condition for 1 Minute or more, a command, a polymorph…) also names an <b>Escape Save</b> (Step 6): the target rolls it at the end of each of its turns to break free, and it can't be a save the effect makes it automatically fail (no STR or AGI against Paralyzed, Stunned or Unconscious; no PER against Blinded).</li>
            <li><b>Damage Interrupt</b> (Step 6): whenever the target of a negative Utility takes damage, it makes its Escape Save at once, ending the effect on a success. When the target is gaining a beneficial Utility, the interrupt comes when <i>you</i> take damage instead, ending the effect at once.</li>
            <li><b>Immune to Damage</b> (Master Utility) can't go with the <b>Damage Interrupt</b> duration modifier: the crafter greys it out, and a power that had both is listed to rebuild for free.</li>
            <li><b>200 XP cap:</b> no power can cost more than 200 XP (the top of Level 5), free powers included. A power over it is listed in <b>Powers to rebuild</b> and can't be used until you rebuild it to 200 XP or less: the rebuild is free, and any XP you paid over the new cost comes back.</li>
            <li><b>Exo-Suits</b> (when your GM allows them, or always outside a world): the <b>Exo-Suit</b> slot beside your Shield and Helmet (Armor &amp; Defenses) opens the <b>Exo-Suit Forge</b>. A suit costs 3,000 Currency, is worn <i>with</i> your armor, and holds up to 3 Integrated Systems. A <b>Juggernaut</b> (STR +4 to a maximum of 16, Advantage on Athletics, Speed 4, one Size larger, and its Plating <i>added</i> to your defenses: Standard AC/WT +5, DR/ER +2; Assault +10/+4, Speed 3; Dreadnought +15/+6, Speed 2), a <b>Phantom</b> (AGI +4 to 16, Advantage on Stealth, Speed +1, Active Camouflage) or a <b>Conduit</b> (Power Attack Bonus and Save DC +2, +5 ER, one more Power Slot). All of it is applied for you while it's powered: <b>Powerful</b> raises STR to 18, <b>Bulwark</b> (2 AP) gives Temp HP equal to your AC (your STR modifier in uses per Short Rest, in the suit's pop-up), Climbing Grips and the Flight Module add Climb and Fly speeds, <b>Breach</b> (pick an Energy type; take it again for another) makes your Powers ignore Resistance to it and gives you +5 ER against it, <b>Nullifier</b> turns Immunity to it into Resistance, <b>Amplifier</b> deals maximum damage with Powers of that type, and <b>Emitter</b> adds 10 squares to ranged Powers (Touch Powers reach 3). <b>Enter Suit</b> in its slot powers it up (the numbers it changes are outlined). Click <b>EXO-SUIT</b> in the slot for everything it does and its buttons (Active Camouflage, Bulwark). <b>Overload Exo-Suit</b> sits under Rest and Recover in Vitals, and turns into <b>Reboot Exo-Suit (6 AP)</b>; a Conduit's overload also ends your Concentration Powers. A Critical Hit from your GM's tracker, or one hit over your Wound Threshold, overloads it on its own (Overload Exo-Suit does it by hand). A shut-down Juggernaut with STR 16 or less leaves you <b>Overburdened</b>: Speed 1, moving costs double AP, and Disadvantage on attacks, checks and saves until the Reboot.</li>
            <li><b>Ammo:</b> in combat, each ranged attack fires a round of its Ammo Type (Light, Medium or Heavy, by the weapon's weight) from your inventory; with none left, the weapon can't be used. Light: once per turn a hit lets you move up to your Speed for 0 AP. Medium: a hit slows the target by 1 square, and a Critical Hit Wounds it (you pick the limb). Heavy: a hit can push it 2 squares, and a Critical Hit Staggers it.</li>
            <li><b>Wounds:</b> a Wounded Leg makes you Staggered (all legs: Prone until one heals; <b>Stable Locomotion</b> counts as 4 legs, so it takes 4 Leg Wounds, and the Wound list shows Extra Leg 1 and 2); each Torso Wound adds another die to every hit on you (it can be Wounded again without a Permanent Injury: +1 on its tag); a Head Wound gives Disadvantage on attacks and PER and INT checks.</li>
            <li><b>Weapon Forge properties:</b> Thrown (and Returning) and Grappling are for melee weapons only. Reach and Stunning can go on a Medium melee weapon, but only work in its two-handed attack (a Stunning weapon that deals Energy (Electric) damage works either way); Heavy weapons have them all the time.</li>
            <li>Powers built before these rules show a <b>Powers to rebuild</b> list when your sheet opens. Rebuild each one for free; the list goes away once they're all done.</li>
            <li><b>Step 3 (Targeting):</b> pick <b>AoE</b> (x3), then a <b>Line</b> (0.5 XP per square), <b>Cone</b> (3 XP per square of length) or <b>Burst</b> (10 XP per square of radius), and size it with <b>−</b> and <b>+</b>. The preview shows the squares it hits, the shape's XP and the power's total. Old Small to Massive area powers are on the rebuild list.</li>
            <li><b>Step 7 (AP):</b> set the AP cost with <b>−</b> and <b>+</b>: each AP below 4 costs 10 XP and each AP over 4 refunds 5 XP, up to twice the AP you gain at the start of your turn (AP can be banked for a big power). Or make the power a <b>Reaction</b> (15 XP) with a trigger you write, or pick a <b>Lengthy Cast Time</b> (1 Minute to 24 Hours) from the dropdown for XP back. Steps 1 and 3 are called <b>Delivery</b> and <b>Targeting</b>, and every power costs at least 5 XP. Powers built under the old Step 7 can be rebuilt for any XP they now save, or kept.</li>
            <li><b>Choose the damage type on use</b> (Step 4, +10 XP): using the power asks which type it deals (both, with a second type).</li>
            <li>Damage that adds your Power Attribute shows the number ("2d6 Fire +3"). The <b>Consumable Crafter</b> follows the same save and Escape Save rules, and <b>Artisan</b> raises its XP limit by 5 per rank.</li>
            <li><b>Consumables</b> cost <b>5 Currency per XP</b> (half that for each extra charge) and weigh <b>¼ lb per XP</b>, rounded down, with up to 30 XP (+5 per Artisan rank). Consumables you made under the old prices are listed in <b>Consumables to remake</b> when your sheet opens: <b>Remake</b> one in the Consumable Crafter, <b>Keep</b> it at its new price and weight, or take a <b>Refund</b> of what you paid over the new price.</li>
            <li>A crafted consumable's <b>Use (3 AP)</b> button (in your inventory, or its details) runs its effect like a power: its attack or save (your attribute modifier, plus training for the attack), damage or healing, and one charge.</li>
            <li><b>Channeling</b> powers repeat their Damage or their Utility (you choose which when you craft it). Once you use one, <b>Channel</b> (half its AP) above your Powers and Attacks reapplies it to the same target each turn, for up to 1 Minute (10 rounds), with no Power Slot; <b>Stop Channeling</b> ends it. Channeling powers made before need a free rebuild first.</li>
            <li>Your <b>Loyal Companion</b> shares your turn: you both get your AP when it starts, both tokens light up, and you move and act with each (its own path, AP and Move actions), in any order.</li>
            <li>On your turn, your battle map shows how many <b>Move actions</b> you (and your companion) have used, back to 0 when your next turn starts.</li>
            <li><b>Overburdened:</b> carrying more than your carrying capacity (STR score × your size) makes you Overburdened: Speed 1, no jumping or climbing, you sink when swimming, and Disadvantage on every attack, check and save. A <b>Backpack</b> (STR counts as 2 higher for this) or <b>Bandolier / Utility Belt</b> (1 higher) helps once you <b>Wear</b> it from your inventory; only your best one counts. Your carry limit in Inventory includes it.</li>
            <li><b>Squeezing:</b> when your Large or bigger token squeezes into a smaller space on a battle map (a narrow gap, a portal), you have Disadvantage on attack rolls and AGI saves until it's back in the open. Your companion's rolls get the same.</li>
            <li><b>Vitality Rank 4:</b> the first time you'd drop to 0 HP, you're left at 1 HP instead and can spend up to your Rank in Rest Dice to heal at once (Rank 3 rolls them at their maximum). It comes back after a Full Rest.</li>
            <li><b>Power ranges</b> (Step 2) are bought by the square: Touch/Self is free, every 5 squares of range cost 1 XP (<b>−</b> and <b>+</b>, or type it), and <b>Line of Sight</b> is 15 XP. A power made with an older range (Short, Long, Extreme) keeps it and its cost. A <b>Martial Improvement</b> on a ranged weapon uses the weapon's range, so Step 2 is free.</li>
            <li>A power uses <b>one die size</b> (8d6, not 4d4 + 3d6); Step 4 won't add a second size. Older powers that mix them still work, with a free <b>Recraft</b>.</li>
            <li>New Utilities: <b>Charmed</b> (with Restrained, Frightened…: it can't attack or target its charmer, and the charmer has Advantage on CHA checks against it), <b>Can't Regain HP</b>, and <b>Telekinesis</b>. Moving a target 2 squares (Minor) can now be taken more than once.</li>
            <li><b>Can't Regain HP</b> (and Suffocating): healing in your HP box does nothing until it ends; Temp HP still works.</li>
            <li><b>Consumables</b> show their price against a cap (150 Cu for one charge, +25 per Artisan rank). In Step 2 they can be <b>Thrown</b> (your STR / twice it) or <b>Ammunition</b>: fired from your ranged weapon of that ammo type, with its AP, range and attack (the inventory button reads <b>Fire</b>).</li>
            <li><b>Short Rest Powers' free upgrade</b> makes a new copy at the higher Level: you keep the lower-Level power too.</li>
            <li><b>Summon a Creature:</b> the creature's Tier can go no higher than the power's Level (Tier 5 at most); the Tier counter shows how high this power can go, and adding XP elsewhere (damage, range…) can raise it. Summoned creatures act immediately after you in initiative. Older powers over the cap still work and list a free <b>Recraft</b>. <b>End a Power</b> now ends powers of an equal or lower Level.</li>
            <li><b>Several summons in one power:</b> each time you take Summon a Creature you get another row (#1, #2…) with its own <b>Tier</b> and creature, so one power can summon a Tier 4 creature and three Tier 1s. A new copy starts as a copy of the one above it; change its Tier or <b>Edit creature</b>. Powers you already have summon what they always did.</li>
            <li>Your GM can share their own creatures for summons: they're in each row's list as <b>your GM's creatures</b>, at or below that row's Tier. Pick one and it's summoned as your GM built it (only your GM can change it).</li>
            <li><b>Summon a Weapon</b> (Moderate Utility): each copy gets a row to name its weapon, make it Melee or Ranged, and add Weapon Properties for 10 XP each (only ones a Medium weapon of that kind could have). Step 4's dice are its damage (1 die per Power Level at most). Using the power puts the weapon in <b>Weapons &amp; Attacks</b>: Medium, Trained, 3 AP an attack, rolled with your Power Attack Bonus (a Conduit Exo-Suit's too) plus your Power Attribute on damage, and its properties' saves use your Power Save DC. It fades when the power's duration ends (Instant: after your next turn; 1 Minute: 10 rounds), or <b>Dismiss</b> it. A Sturdy or Parrying one can Block.</li>
            <li><b>Inflict or end a Condition</b> Utilities (and Wounded on one limb) are marked <b>*</b>: take one more than once and each copy gets its own <b>Inflict / End</b> and Condition picker (#1, #2…), so one power can, say, inflict Prone and end Poisoned.</li>
            <li><b>New weapon properties</b> (Weapon Forge): <b>Finesse</b> (Medium melee: STR or AGI; other Medium melee weapons forged now use STR), <b>Quickdraw</b> (Light: Draw / Stow for 0 AP), <b>Unwieldy</b> (with Reach, −100 Cu: you're asked whether the target is within 1 square, for Disadvantage). The Ranged section under the range increments has <b>Loading</b>, <b>Scatter</b> (a 3-square Cone, no range increments) and <b>Repeating</b> (+2 AP, 3 ammo, a 2x2 square; half damage at Long Range): with a battle map open you place the area and your GM's tracker compares your roll with each creature in it. <b>Elemental Critical</b> sits under Elemental once you've picked an Energy, and lasts until the end of the target's next turn (Acid too). A Tearing weapon's roll shows its least damage (2 per damage die, hit or miss).</li>
            <li><b>Keen</b> (300 Cu, a Ranged weapon or a melee weapon that uses AGI: Light or Finesse): a natural 19 or 20 is a Critical Hit, and the roll says so. <b>Parrying</b> (200 Cu, the same melee weapons): Block with it as if it were Sturdy, for your Reaction instead of AP (Block's option reads <b>Parrying</b> and costs 0 AP). <b>Suppressed</b> (300 Cu, in the Ranged section): attacking from stealth with it doesn't reveal you, and the roll reminds you.</li>
            <li><b>Utilities marked * stack up to the power's Level</b> (5 copies at Level 5): + stops there and says so. Raise the Level (more XP elsewhere) to take more. <b>Pinned</b> is now in the Moderate Inflict or end a Condition list.</li>
            <li><b>Utilities that are numbers are applied for you:</b> +1 AC, +2 DR or ER, Temporary HP, +2 Speed, +1 to a roll, +1 AP next turn, −1 AP, a Fly / Swim / Climb speed, Hover, Immunity, Fatigue and more. A Utility with a choice (DR or ER, which roll, which damage type) gets a pick for each copy in Step 5. Using the power asks who it targets (you, your Loyal Companion, or a creature on your GM's battle map; an area power's targets are the creatures in its area). On you, it shows above your Powers and Attacks with how many turns are left and an <b>✕</b> to end it early.</li>
            <li><b>Overexertion</b> now gives its Fatigue when the power <i>ends</i>: an Instant power right away, a lasting one when its time runs out, when you click <b>End Power</b> above your Powers and Attacks, or when you rest.</li>
            <li><b>Summoning in range:</b> with your GM's battle map open, a Summon a Creature power with a range has you place each creature within it (Esc puts the rest next to you). On their turn you drag their tokens like your companion's (their AP pays for it), and the <b>Your Summons</b> window (it opens when you summon, or from <b>Your Summons</b> on the power) shows each one's HP, AP, AC, Speed and Conditions with buttons to roll its attacks. Building one, the NPC Crafter warns about any attack or power over 3 AP (a summoned creature only ever has 3).</li>
            <li><b>Medical consumables</b> (ones that heal or end a Condition) say <b>Medical</b> on their Use button; <b>Medic</b> Rank 1 takes 1 AP off using them.</li>
            <li><b>Regenerative</b> heals like any Rest Die you spend: the roll plus your CON modifier, with Vitality's bonuses (+ your CON modifier at Rank 1, maximum dice at Rank 3). Your sheet offers it at the start of your turn, once a turn.</li></ul>`],
        ['Actions', 'Actions and AP', `
            <ul><li>Click the <b>Action Points</b> title in Vitals for every Combat Maneuver and Standard Action. Clicking one spends its AP (short on AP? you're asked first) and applies what it can: Fight Defensively's AC, Power Attack's damage on your next melee attack, Feint's Advantage, and so on.</li>
            <li>Combat Maneuvers are on the left, Standard Actions on the right. Greyed-out ones need something you don't have (Block needs a shield or a Sturdy weapon, Shield Bash a shield). Block with a Sturdy weapon rolls its die for you.</li>
            <li><b>Grappling:</b> Grapple (3 AP) and Pin (2 AP) roll your Athletics and ask whether you won the contest; you're Staggered while you hold on, and your GM's tracker marks the creature next to you. Choke (2 AP) deals your unarmed damage to a Pinned creature, lethal or non-lethal, ignoring its DR, ER and resistances (it counts as an attack, so Fight Defensively gives +2 AC, not +4, that turn). Escape (4 AP) breaks free; ✕ on "Grappling" lets go.</li>
            <li><b>Innate Weapons</b> (claws, fangs, horns…) are weapons of their own, not unarmed strikes: always trained and needing no hands, but unarmed boosts like Martial Arts (and Choke) use your Unarmed Strike.</li>
            <li>The 📌 beside an action pins it to <b>Weapons &amp; Attacks</b>, so the ones you build around are one click away. Click ✕ on a pinned action to unpin it.</li>
            <li>Active effects show under <b>Armor &amp; Defenses</b> with a red <b>✕</b> to end them early. Most end on their own at your next turn or when you attack.</li>
            <li><b>Teleporting</b> doesn't provoke Attacks of Opportunity.</li>
            <li><b>Tactician:</b> at Rank 1, when your GM starts combat a window shows the initiative order (allies, enemies, who's Surprised) so you can swap an ally's place with another creature's. At Rank 5, once per combat, the start of your turn asks whether to give it to an ally instead.</li>
            <li>Powers with <b>Summon a Creature</b> have you build the creature in the NPC Crafter when you save the power; <b>Edit Summoned Creature</b> on the power changes it later. It gets all the TP its Tier allows (Tier 1: 29 TP), and its own powers cost TP from that budget, never your XP. Summoned creatures have a hard 3 AP each turn and can't summon creatures of their own; a Loyal Companion's summons can't be a higher Tier than it. Using it puts the creatures next to your token on your GM's battle map. A summoned creature has a hard 3 AP each turn, or 5 with the Bloodied Frenzy trait while it's at or below half HP.</li>
            <li>Your Loyal Companion's forged armor and weapons cost only Threat Points, and follow the same armor rules as yours (weight class, STR requirement).</li>
            <li><b>⚔ Actions</b> on your Loyal Companion's card (and its full stat block) lists the same maneuvers and standard actions for it, spending its AP. Fight Defensively, Fight Offensively and next-attack maneuvers (Sweeping Strike, Feint…) change its rolls and show as chips on its card until its next turn.</li>
            <li><b>Jump</b> (Standard Actions) costs AP like a Move (the first move or jump this turn 1 AP, the next 2…). You jump your STR modifier in squares; further rolls Athletics. <b>Draw / Stow</b> costs 1 AP for an item on a Bandolier or Utility Belt you wear.</li>
            <li><b>Weapon properties:</b> <b>Loading</b> weapons need <b>Reload (2 AP)</b> under their name after each attack in combat (you need ammo to load). <b>Brutal</b> rerolls 1s on damage once. <b>Cleave</b>: when your GM's tracker sees it drop a creature, your next attack with it this turn is 0 AP. <b>Elemental Critical</b> adds the Energy's effect on a crit; Acid lowers DR until <b>Repaired</b> (a button under your DR). Medium weapons now top out at 3d8 (3d10 two-handed).</li>
            <li><b>Companion Gear:</b> in your Inventory, <b>Give</b> an item and pick your companion to hand it over; it shows under <b>Gear</b> on its card (with the weight it carries). <b>Take</b> moves it back. A weapon you give it can be <b>Wielded</b>, and then it's on its stat block like its own weapons (no TP).</li>
            <li><b>Area powers on the battle map:</b> with your GM's battle map open, using a power with a Line, Cone or Burst has you place its area first, at the size you crafted. A <b>Self or Touch</b> area starts from your token: <b>scroll</b> to turn it, click a square to point it there, or drag its start to the square next to you. A <b>ranged</b> area follows your mouse: click to place it within range (red means out of range), then drag, turn or re-aim it. <kbd>Enter</kbd> uses it, <kbd>Esc</kbd> or right-click cancels, and <b>Use without the map</b> skips placing it. Each scroll notch turns it 15° (<kbd>Alt</kbd>+scroll for finer), and a Line or Cone starts pointing the way you last used that power. Everyone in it makes a new save each time: caught in one yourself? a <b>Roll save</b> button appears in your dice tray, and you take the damage by your roll. With <b>Safe Zone</b>, <kbd>Shift</kbd>+click a creature in the area to keep it safe.</li>
            <li><b>Shove</b> and <b>Shield Bash</b> roll their STR attack for you (Shove asks whether the target is larger, for Disadvantage) and count as an attack for Fight Defensively and Block.</li>
            <li><b>Melee Prowess</b> Rank 3: combat maneuvers (Fight Defensively, Sweeping Strike, Charge, Shove…) no longer give your melee attacks Disadvantage; Rank 4: a maneuver made with a melee attack has Advantage. Both are added to the roll for you.</li>
            <li><b>Mobile:</b> moving in combat (dragging your token, Move or Jump) gives you +1 AC per rank until the start of your next turn, once per round; it shows under Armor &amp; Defenses and on your GM's tracker.</li>
            <li><b>Flurry, two things:</b> the Flurry <i>perk</i> (any weapon hit makes your next weapon attack cheaper) and the Flurry weapon <i>property</i> (after a hit, more attacks on that same target are cheaper) are separate lines in an attack's AP pop-up, each explaining itself; your GM's tracker ticks them when it saw the hit.</li>
            <li><b>Draw / Stow</b> asks what you're drawing when it can be cheaper: a <b>Quickdraw</b> weapon (0 AP) or an item on your belt (1 AP).</li>
            <li>Block, Fight Defensively and your other actions show up in your GM's dice tray and notifications, and your AC on their tracker updates as they change it.</li>
            <li><b>Ground Strike</b> (Brute Rank 5, in the Actions list): 3 AP once per turn with a Heavy weapon, or the creature you're grappling. With a battle map open you place the 2-square burst around you, and your GM's tracker rolls everyone's DC (10 + STR modifier + 5) AGI save: 5d8 + twice your STR modifier Bludgeoning and Prone, or half on a save. Strike with the creature you're grappling and it takes the maximum.</li>
            <li><b>Found Earlier</b> (Treasure Hunter Rank 5, under <b>+ Add Item</b> in your Inventory): once per Short Rest, then a Luck Point each time, pull out general equipment, ammunition or a consumable (built in the Consumable Crafter) worth up to 10 Cu × your LUC modifier (minimum 50). It's free and marked <i>found</i>: it can't be sold.</li>
            <li><b>Charmed:</b> while a power has you Charmed, attacking asks first. The creature that charmed you can't be your target, so you confirm you're attacking someone else or cancel. The Charm ends when the charmer or one of their allies damages you or hits you with a harmful power.</li>
            <li><b>Ambusher:</b> the AP window before an attack has <b>Ambusher</b> to tick when you attack from stealth (or a creature that's unaware of you): its damage, Advantage, Stagger (Rank 2), ignoring DR and ER (Rank 3) and crit multiplier (Rank 4) are added for you. Rank 5 adds <b>make it a Critical Hit (+2 AP)</b> there, and an <b>Ambusher: crit (2 AP)</b> button on the roll if you decide after: the crit counts only if the attack hits.</li>
            <li><b>Charge:</b> its movement is part of its 3 AP (drag your token: no Move AP), and the melee attack after it costs 1 AP in the AP window.</li>
            <li><b>Relentless:</b> when your hit drops a creature, your GM's tracker tells your sheet and you're offered your AP back (uses per Short Rest shown). Ranks 1 and 3: once per turn an action that isn't an attack or a move is free (it says so when you use it).</li>
            <li><b>Thrown weapons</b> have their own <b>↳ Thrown</b> row (a ranged attack, STR / twice STR squares) that still counts as a melee weapon for <b>Melee Prowess</b>.</li></ul>`],
        ['Shortcuts', 'Shortcuts worth knowing', `
            <ul><li>Number boxes do math: type <kbd>+5</kbd> or <kbd>-3</kbd> to add or subtract, or <kbd>35-9</kbd> after what's there.</li>
            <li>Hit Points: <kbd>-9</kbd> takes 9 damage, through Temp HP first. Damage to <b>Temp HP</b> isn't reduced by DR, ER, resistances or immunities (only what gets past it into your HP is). Only the damage that gets past your Temp HP counts toward your Wound Threshold. (WT 10, DR 3, 10 Temp HP, hit for 24: the 10 Temp HP are gone, 14 is left, DR 3 makes it 11, you lose 11 HP, and 11 is over your WT, so you make the CON save.) Temp HP doesn't stack: typing <kbd>+5</kbd> in the Temp HP box while you have some asks which total to keep. <kbd>-9 fire</kbd> uses that damage type, so your DR/ER, resistances and immunities apply. Hit by the GM's creature? Its damage type is used for you. Add <kbd>nl</kbd> (or tick Non-lethal) for non-lethal damage: 0 HP knocks you out instead of Bleeding Out.</li>
            <li><kbd>Ctrl</kbd>+<kbd>Z</kbd> undoes and <kbd>Ctrl</kbd>+<kbd>Y</kbd> redoes changes on the sheet. <kbd>Enter</kbd> confirms a box.</li>
            <li>Double-click a popup window's title bar to minimize it to a tab in the bottom-left corner, named after the map, area or NPC in it; click the tab to bring it back.</li>
            <li>A picker or pop-up always opens <b>on top of what it's changing</b>: choosing a companion's immunities, a trait or a world opens above the crafter or window you opened it from.</li>
            <li>A character can be open in one browser tab at a time: opening it in a second tab sends the first one back to the lobby, so AP and HP never get spent twice.</li>
            <li><b>⇆</b> (top left, beside Settings) centres the sheet or pins it to the left or right of the screen. Pinned, drag the handle on its inner edge to make it narrower or wider (double-click it for full width), leaving room for maps and pop-ups. Narrow, its sections stack the way they do on a phone, so nothing gets squashed.</li>
            <li><b>Flying:</b> with the Flight trait, your token flies when you drag it on your turn: difficult terrain doesn't slow you (the path shows Walk or Fly). Press <kbd>S</kbd> while dragging to switch speeds (Walk, Fly…). Your companion uses its other speeds the same way, starting on the faster of its Walk and Fly.</li>
            <li>Maps open where you left them: the same place, size, zoom and view as last time. An Area Circle your GM gave a picture opens straight to it.</li>
            <li><b>Ping</b> (<kbd>P</kbd>, or the Ping button): press P with your mouse over a spot on a battle map and everyone sees a pulse there with your character's name, with a chime (your browser plays it once you've clicked anywhere on the page). Point out a target to your GM, or something your party should look at. Holding P sends one ping; you have 3 pings in a row, and one comes back every 3 seconds. A ping outside the part of the map you're looking at shows up on the edge of your view, with an arrow pointing toward it.</li>
            <li><b>Draw</b> (battle map bar): draw freehand on the map in any colour and size; everyone sees it. Turn on <b>Snap</b> (or hold <kbd>Alt</kbd> while you draw) for straight lines between square corners and centres. <b>Undo</b> and <b>Clear mine</b> take back your own lines.</li>
            <li><b>Your own Fog of War:</b> on a battle map you see your GM's fog minus what <i>you</i> have revealed. If your GM turns it on for your token, <b>Room reveal</b> opens a fogged room when you move into it, and a <b>Vision</b> cone reveals what your token sees as it moves (walls block it, and opening a door lets it see through). Press <b>C</b> over the map to show your cone; while you hold your token, <b>R</b> turns it (Shift+R the other way), so you can look around before you put it down, or turn on the spot. (Room reveal only opens a room when your token steps into it.) A <b>Large</b> or bigger token <b>squeezes</b> into a smaller space where walls leave no room (amber outline while dragging; Disadvantage on attacks and AGI saves while squeezing) and is its own size again where it fits. <b>Portals</b> (violet rings, numbered in pairs) carry your token to the other end, and your view follows it there when you're zoomed in; some ask your GM first, and you wait until they let you through.</li>
            <li>Squares with diagonal lines are <b>difficult terrain</b>: moving into one costs 2 squares (your path shows it). The same goes for a square a dead, downed or Prone creature lies in; you can move through it or stop there. Your GM may also have <b>walls</b> and <b>doors</b> you can't see: if your token won't go somewhere, something is in the way. Drag your token around a wall's corner in one go: its path bends around the corner on its own, so you don't need to let go there.</li>
            <li>On battle maps: <kbd>M</kbd> measures (right-click drops a waypoint, the toolbar switches to Cone or Burst, <kbd>Esc</kbd> stops). A measurement stays after you let go: drag its <b>start point</b> to move it (from your own token, that moves you, AP and all), and <b>scroll while dragging</b> its start to turn a Line or Cone (a Line keeps its length as it turns; scrolling while you're still drawing doesn't turn it). A Cone starts at the edge of your space, so you're never in your own cone. <kbd>Shift</kbd>-drag starts a new one. Everyone at the table sees your measurement. In combat, dragging your token shows the path and its AP cost; hold <kbd>Alt</kbd> to move without paying AP. Wheel zooms; <kbd>Ctrl</kbd>-drag or middle-drag pans.</li>
            <li>The <b>Dice and Notifications</b> tray comes to the front whenever something new lands in it, so it's never hidden behind another window.</li></ul>`],
        ['Worlds', 'Playing in your GM\'s world', `
            <ul><li>Your GM gives you an <b>invite code</b>. Join the world from the lobby (or the World screen's <b>+ Join World</b>) and pick, or make, the character you'll play there.</li>
            <li>The <b>World</b> button opens what your GM shares: maps, locations, NPCs you've met, notes and discoveries, and the party.</li>
            <li>In combat your GM's tracker and your sheet stay in sync: damage, conditions, wounds, AP and turns. Your AP comes in by itself when your turn starts, even the first turn after you open your sheet mid-fight or your GM brings back a saved fight (reloading during your own turn never adds it twice). New Turn does the same by hand.</li>
            <li>Give items to other players from your inventory, and loot the GM shares lands in your inventory.</li></ul>`],
        ['Find it again', 'That\'s the basics', `
            <p>You can open this tutorial again any time: <b>Settings → Show Tutorial</b>. The same place has the <b>Patch Notes</b> for what changed in each update.</p>
            <p>The rules themselves are in the APX rulebook. The sheet follows them, but every number can still be edited by hand when your GM rules otherwise.</p>`]
    ];
    const GM_STEPS = [
        ['Welcome', 'Welcome to the APX GM Tools', `
            <p>Everything you need to run APX: worlds, players, NPCs, combat, maps, loot and notes. It all saves to your account and syncs to your players live.</p>
            <ul><li>Start with <b>+ New World</b>, or <b>Load World</b> to open one you made.</li>
            <li>The GM Tools sit on one side of the screen so maps, stat blocks and other windows have the rest; new windows open in that free space. <b>⇆</b> (beside the title) centres them or pins them left or right, and the handle on their inner edge squashes or stretches them (double-click: full width); narrow, their sections stack instead of squashing. Maps reopen where you left them: same place, size, zoom and view.</li>
            <li>Every world has an <b>invite code</b> (in the <b>World</b> screen; click it to copy). Players join with it from their Character Sheet, and their characters show up in your party on their own.</li>
            <li><b>World Settings</b> (World screen): Starting XP, Max GP, starting Cu and the attribute method for everyone. <b>Give a player more</b> sends one player extra GP (their Ancestry budget), Cu or Starting XP. <b>Allow Exo-Suits</b> adds the Exo-Suit slot and Forge to your players' sheets; turning it off switches off suits they already own in your world. <b>Players can remove perk ranks</b> (on unless you untick it) lets them take a perk's top rank back for its XP; each one shows in your dice tray.</li>
            <li>A character imported from a file that was changed, came from another account, or predates sealing carries a <b>⚠ Imported file</b> mark on its Party card and in the Players list. Hover it for what changed; <b>Clear</b> it once you've checked the character.</li>
            <li>The World screen's player list is also where you kick a player (with or without a ban).</li></ul>`],
        ['NPCs', 'NPCs, templates and the Library', `
            <ul><li>The <b>NPC Crafter</b> builds stat blocks from a Tier and a TP budget: attributes, weapons, armor, perks, traits and powers. Stat blocks roll straight from their dice, and a power with two damage types rolls each separately; the tracker splits the damage you enter the same way.</li>
            <li><b>Race Templates</b> are the races your players can pick in their Race Builder; changes reach them live.</li>
            <li><b>Origin Templates</b> (toolbar) work the same way for the Origin Builder: a Name, Starting Wealth, Origin Feature, Common Language and all four Competencies (Language, Skill or Weapon Type). <b>Lock</b> a field and players can't change it; leave it unlocked (or blank) for them to choose.</li>
            <li><b>Race Templates, Origin Templates, NPCs &amp; Enemies, Powers and Loot &amp; Items</b> are yours across every world: make something once, then tag it with the worlds it belongs to. Each list has a <b>World</b> filter (every world, untagged, or one world), and a checkbox on every entry: tick several (or <b>Select all</b>), pick a world, then <b>Tag</b> or <b>Untag</b> them all at once. <b>Worlds</b> on an entry sets its worlds one at a time.</li>
            <li><b>Powers</b> (toolbar): <b>+ New Power</b> builds one in the Power Crafter. Each power has a <b>Players ✓ / ✕</b> switch: with ✓, players in the worlds it's tagged with can learn it from <b>+ Add Power</b> on their sheet (they pay its XP); with ✕ it stays yours, for NPCs and items (an Avalanche of Bones made for a skeletal giant, say). New powers you make here start at ✓, your NPCs' powers at ✕. Select several to switch them all at once, and the Level filter can show only what players can learn, or only what's GM only. Powers you give NPCs are kept here too, once each: copies of the same power (same name and Level) on several NPCs, or rebuilt under newer rules, are one entry.</li>
            <li>NPC sizes run from Tiny or Smaller (3 TP: +2 AC, Advantage on Stealth, reach 0, no Heavy weapons) to Gargantuan (−2 AC, Advantage on Athletics, Disadvantage on Stealth). A size's effects apply on their own, and stat blocks list every <b>Skill</b> that isn't a plain attribute check (trained, its own bonus, Advantage or Disadvantage).</li>
            <li><b>Swarms</b> share squares with other creatures and tuck under them; a small handle beside the creature shows the swarm (hover for details, drag to move it). They take half damage from single-target attacks and double from area effects (you're asked when it's unclear), and roll half their damage dice below half HP.</li>
            <li>NPC and companion tokens follow their stat block's size (Tiny … Gargantuan) unless you Shrink or Grow them; "Stat block size" puts it back.</li>
            <li>Items, forged weapons and armor, consumables and powers you make go into your <b>Library</b> (the toolbar's <b>Powers</b> and <b>Loot &amp; Items</b>), tagged with the world you made them in, so you can reuse them anywhere. Powers your NPCs and their items already have are in it too. Loot &amp; Items filters by type (Weapon, Armor, Consumable, Equippable or Other) as well as by world. <b>+ New Item</b> opens the Loot Maker straight into the Library; <b>Add to Loot</b> puts a copy on the open world's Loot list.</li>
            <li>Powers name the Core Attribute of their saving throw, and a power with a lasting effect names an <b>Escape Save</b> its target can actually pass. When a world opens, the <b>NPCs to rebuild</b> list shows any stat blocks whose powers were built before these rules: <b>Rebuild</b> opens the NPC and walks you through each power, and finished NPCs drop off the list.</li>
            <li>An NPC's Attack Roll power can be a <b>Power Attack</b> or a <b>Martial Improvement</b> (Power Crafter, Step 1): a Martial Improvement rides one of the creature's own attacks, rolling with that attack's bonus and dealing its damage plus the power's. The weapon's TP is already paid, so the power costs only its own TP.</li>
            <li><b>Unlimited Uses</b> on an NPC power costs 5 more TP per Power Level, at any Power Level and Tier.</li>
            <li>Editing an NPC you've already saved, <b>Save NPC</b> is on every step. Forges show what equipping costs: <b>Equip on NPC (X TP)</b>. Armor's other mods (Stealth, Athletics, lighter or heavier) now count too, 1 TP per 100 Cu (penalties take TP off), for armor forged from now on. Crits cost 3 TP (x3) and 6 TP (x4).</li>
            <li><b>Vehicle Scale</b> (Mythic) areas keep their shape on the battle map, each square a 5x5 block (a 4-square Line is 20 long and 5 wide).</li>
            <li>Raising an NPC's Core Attribute costs <b>1 TP per point up to a score of 10, and 2 TP per point above it</b>. Stat blocks made before this keep their old price until you move them over (Step 1 has a button), so nothing you've built changes on its own.</li>
            <li>An NPC's <b>Summon a Creature</b> power can summon an NPC you've already made: pick it from the list in the Power Crafter (only NPCs at or below the power's Tier that don't summon). <b>Edit Summoned Creature</b> in the NPC Crafter's power list changes the creature later. A summoned creature you build ends with <b>Save Creature</b> on its last step. Summoned creatures have a hard 3 AP; with Bloodied Frenzy the tracker gives them 2 more (up to 5) while they're at or below half HP, and other NPCs with it get +2 AP then too.</li>
            <li><b>Token Image</b> (NPC Crafter, under the name) is a stat block's default token on battle maps and in the tracker, for you and your players. A named NPC's own picture replaces it on their token, and a summoned NPC brings its image along.</li>
            <li><b>Summon ✓ / ✕</b> on an NPC's row in your NPC list lets players pick it for their Summon a Creature powers. It's shared with every world it's tagged for (all of them, if it has no tags) at its Tier, and players see it as their GM's creature but can't edit it. Turning it off stops new picks; powers that already summon it keep their copy.</li>
            <li>An NPC's Summon a Creature power gets a row for each time it's taken, each with its own Tier and creature, so it can summon a Tier 4 and three Tier 1s. They all appear next to it and act right after it.</li>
            <li>The NPC Crafter's <b>Condition Immunities</b> include <b>Charmed</b> and <b>Can't Regain HP</b>.</li>
            <li>An NPC's <b>Summon a Weapon</b> power lists each weapon under it on the stat block (its Power Attack Bonus, Step 4 dice + its Power Attribute, 3 AP): click it to attack while the weapon's out. Using the power rolls no damage of its own.</li>
            <li>▲ ▼ beside an NPC's (or Loyal Companion's) powers in the NPC Crafter set the order its stat block lists them in.</li>
            <li>Pickers and pop-ups open <b>on top of what they're changing</b>: an NPC's Condition or Damage Immunities, its world tags, a forge opened from the NPC Crafter, a kick or ban prompt, all above the window you opened them from.</li>
            <li>Powers top out at Level 5 for NPCs too: the Power Crafter tells you the Level 5 TP for the power's usage and how far past it a build is, so you can trim it to fit.</li>
            <li><b>Mythic Awakening:</b> build <b>Awakened Powers</b> under it in the NPC Crafter. They're locked on the stat block until the creature Awakens, which happens on its own at its first 0 HP in the tracker (full HP, conditions cleared, full AP, its turn now), or tick <b>Awakened</b> on its tracker row. Its XP reward is doubled.</li>
            <li>In <b>Loot &amp; Items</b> and <b>Powers</b>, every entry has an <b>Edit</b> button: powers reopen in the Power Crafter, forged weapons and armor in their forge, consumables in the Consumable Crafter, and other items in a quick form. Only the Library's copy changes; anything already handed out or placed stays as it was.</li></ul>`],
        ['Combat', 'Running combat', `
            <ul><li>Add NPCs and players to the <b>initiative tracker</b>, then <b>Start Combat</b> and use <b>Next Turn</b>. AP, reactions, condition timers and auras are handled turn by turn.</li>
            <li><b>Combat is saved as you go:</b> end a session mid-fight and the initiative order, whose turn it is, the round, HP, Temp HP, conditions, wounds, unpaid XP, saves still waiting and the combat log are all back when you load the world (token positions stay on the maps, and players' HP and AP on their sheets). If the fight's map isn't open, the tracker's <b>Battle map</b> label becomes a button that opens it.</li>
            <li>Damage is entered as a number (or <kbd>-12 fire</kbd>): damage soaked by Temp HP isn't reduced by DR, ER, resistances or immunities; only what gets past it is, and only that counts toward the Wound Threshold (24 damage on 10 Temp HP and DR 3: 10 to Temp HP, 14 − 3 = 11 to HP). The log shows the split. A player's sheet sends the same split, so their DR never comes off the part their Temp HP took. DR/ER, resistances, wounds and Wound Thresholds are applied for you, and saves and wound checks are asked of the right player. <kbd>-12 nl</kbd> (or the Non-lethal box) is non-lethal: at 0 HP the creature is knocked out, grey with snoring Z's on the map, instead of dying or Bleeding Out.</li>
            <li><b>Grapples</b> keep themselves in step: marking a creature Grappled or Pinned links it to whoever's next to it (you're asked if there's more than one), and the grappler is Staggered until the grapple ends (Escape, letting go, Incapacitated, or out of the fight). A Grappling weapon hit grapples on its own.</li>
            <li><b>Tactician:</b> a player with Tactician Rank 1 is asked for an initiative swap when you press <b>Start Combat</b>; you see <b>Waiting on Tactician choice</b> (with <b>Choose for them</b> and <b>Start without waiting</b>). At Rank 5 they can give their turn to an ally once per combat; <b>Next Turn</b> then carries on after the Tactician.</li>
            <li>Summoned creatures (players', companions' and your NPCs') appear next to their summoner on the battle map and act immediately after it in initiative (their Tier is no higher than the summoning power's Level, Tier 5 at most), with a hard 3 AP each turn (so the NPC Crafter has no AP for them to buy).</li>
            <li><b>Power saves and Escape Saves:</b> when a power that calls for a save (or inflicts Conditions) is used, your dice tray gets a <b>Roll targets' saves</b> (or <b>Apply</b>) button. Pick the targets: NPCs' saves are rolled for you, players are asked to roll theirs, and whoever fails gets the Conditions. A lasting effect shows on the creature's tracker row; its Escape Save is asked for at the end of each of its turns (and when it takes damage, with Damage Interrupt), and attacking ends it with Action Interrupt. <b>Save</b> rolls it now, <b>3 AP</b> spends AP to repeat it, and ✕ ends it.</li>
            <li><b>Area powers on the battle map:</b> using a power with a Line, Cone or Burst (from a stat block, or a player's or companion's) while its user's token is on an open battle map has its area placed first: from the creature for Self or Touch (<b>scroll</b> to turn it), anywhere in range for the rest; a Line or Cone starts pointing the way that power was last used. <kbd>Shift</kbd>+click creatures to leave them out, and right-click cancels. A window then lists everyone in it; untick anyone it shouldn't touch and press <b>Roll saves</b>. Every use asks for new saves: NPCs roll from your dice tray, players are asked to roll theirs, and each takes the damage (and the power's Conditions) when its own roll comes in. DR, ER, resistances and Swarms are worked out as it's dealt. Walls (and closed doors) block areas too: an area has to start somewhere its user can see, a Line stops at the first wall, a Cone doesn't reach behind one, and a Burst spreads around corners only as far as its radius reaches along the way.</li>
            <li><b>Recharge powers:</b> using one from the stat block marks it used. At the start of the creature's turn it rolls a d6 to recharge (5-6, or 6), and the <b>Recharge</b> button on its tracker row spends half the power's AP to roll for it now. A power whose damage type is chosen on use asks you which type.</li>
            <li>The <b>Party</b> panel shows two players side by side, with each power listed by name, Level and AP: click a power's name to open it in its own window, or the player's name for their full stat block with every power in full. The ▾ beside a portrait shrinks a card to just the portrait, name, ancestry and + Initiative (▸ opens it again). Cards stack in two columns, each one right under the one above it, so a long stat block never leaves a gap beside a short one. Right-click a chat message to delete it for everyone.</li>
            <li>Click a creature's conditions to change them, players included (Grappled and Pinned are there too). Condition immunities are enforced. <b>⤓ Fall</b> rolls fall damage with the Acrobatics reaction.</li>
            <li>The tracker shows the creature on turn's <b>Moves</b> (Move actions used this turn, from 0). A player's pop-out (their token's name) has their whole sheet: weapons, gear, inventory and Currency, perks, Ancestry, Origin, companion and notes. A creature's stat block window shows its token image (the one on the battle map).</li>
            <li><b>Other speeds:</b> a creature you drag on its turn moves with the faster of its Walk and Fly speeds. Press <kbd>S</kbd> while dragging to switch (Walk, Fly, Swim, Climb, Burrow; the path shows which). It moves at that speed, and flying or burrowing ignores difficult terrain. A creature that <b>Hovers</b> always ignores difficult terrain. Clicking the map with tokens selected just lets go of them (no Area Circle). <b>All to Init</b> adds players' Loyal Companions too, joined to their owner's turn. A creature that dies stays dead on its map (grey) even if that map was closed when it died, and All to Init never brings a dead token back: only <b>Revive</b> (right-click it) does. A creature still in the fight whose map was closed gets its own token back, not a second place in the order.</li>
            <li>An <b>Area Circle</b> (or marker) can have an <b>image</b> (Edit → + Add Image). With <b>Image mode</b> on, clicking it on a player's map shows just the picture, with its description above it if it has one.</li>
            <li>A <b>Loyal Companion shares its owner's turn</b>: one block in the order holding both entries (HP, AP, Moves and conditions each), both highlighted and both getting their AP when that turn starts (Next Turn passes over it). Summoned creatures act on their owner's initiative, right after them. A player's Summon a Creature power places its creatures next to them on the battle map they're on.</li>
            <li><b>⚔ Actions</b> on an NPC's (or summoned creature's, or Loyal Companion's) tracker card, and <b>⚔ Maneuvers &amp; Actions</b> on its stat block, list every Combat Maneuver and Standard Action with its AP. Picking one spends that creature's AP (a companion's AP stays on its owner's sheet) and applies what it can: Fight Defensively's AC (shown on the card) and Disadvantage, Fight Offensively's Advantage, next-attack maneuvers on its next attack, Fall Prone, Stand Up, a Grapple's Staggered. Effects show as chips on its card until its next turn (✕ ends one early).</li>
            <li><b>Weapon properties in the tracker:</b> <b>Tearing</b> deals at least 2 damage per damage die, hit or miss. <b>Cleave</b>: a hit that drops a creature gives its attacker one 0 AP attack with that weapon this turn ("Cleave ready" on its card; players get it on their sheet). <b>Loading</b>: an NPC's weapon needs <b>Reload (2 AP)</b> on its card after each attack. <b>Elemental Critical</b>: until the end of the target's next turn, a crit sets Burning (Fire), Poisoned (Poison) or Staggered (Electric), slows (Cold), or lowers DR by 1 (Acid). <b>Sunder</b> notes double damage to objects.</li>
            <li><b>Charmed</b> and <b>Can't Regain HP</b> are conditions: healing a creature that can't regain HP (or is Suffocating) does nothing.</li>
            <li><b>Jump</b> is in every creature's Actions, costed like a Move.</li>
            <li><b>Squeezing:</b> a Large or bigger creature squeezed into a smaller space on a battle map has Disadvantage on attack rolls and AGI saves, added to its rolls for you (players' too, on their sheets).</li>
            <li>A Loyal Companion added to the tracker by hand shows the AP from its owner's sheet, where they spend it. A player with <b>Vitality Rank 4</b> who drops to 0 HP from your tracker is left at 1 HP instead (once per Full Rest), and their sheet asks how many Rest Dice to heal with.</li>
            <li>NPCs follow the armor rules too: weight class caps their AGI bonus to AC, and an unmet STR requirement costs them their AGI to AC, 2 Speed, and gives Disadvantage on attacks. Their forged gear costs TP, never Cu.</li>
            <li><b>Undead</b> and <b>Unalive Structure</b> NPC traits run themselves: immunities, vulnerabilities, the Undead revival save (rolled for you at the start of its turn; while it's down its token looks dead, and a Critical Hit, Fire, or damage that isn't Physical or Energy destroys it for good), the Electric Stun save, and repair-only healing.</li>
            <li>The combat log and your players' rolls show up in your dice tray. Requests waiting on you (an NPC's save, a limb to pick, a power's targets) stay <b>pinned to the top</b> until you answer them. Double-click the tray's title bar to close it.</li>
            <li><b>NPC Wounds:</b> the limb list never offers one that's already Wounded, a creature with every limb Wounded isn't asked for its Wound Threshold save, and a save still waiting when it goes down is settled for you.</li>
            <li>Allies and other named NPCs drop their own loot into the Loot panel when they die, just like enemies.</li>
            <li><b>NPC maneuvers roll themselves:</b> Grapple, Pin and Escape roll its Athletics (or Acrobatics), Feint its Deceive, Vault its Acrobatics, and Shove and Shield Bash its STR melee attack (Shove asks whether the target is larger, for Disadvantage); then you're asked whether it won. An NPC that already attacked this turn gets +2 from Fight Defensively, not +4, and Fight Offensively gives attacks <i>against</i> it Advantage (you're asked who's being attacked).</li>
            <li><b>Recover</b> is in every NPC's Actions: <b>Shake It Off</b> (1 AP: half its Rest Dice, its CON score in d6, each + CON) and <b>Shrug It Off</b> (3 AP: heals one Wounded limb), each once per fight.</li>
            <li><b>NPC wounds and fatigue:</b> <b>+ Wound</b> on a tracker card wounds a limb by hand; <b>Fatigue − / +</b> tracks its fatigue (it gets that much less AP each turn, and dies past its limit). An Overexertion power adds a level for you, players and NPCs alike.</li>
            <li><b>Helmets:</b> when a Critical Hit lands on an NPC with a helmet, you're asked whether it breaks its helmet (a normal hit instead). A broken helmet comes off its stat block (−1 AC, DR and ER) for the rest of the fight.</li>
            <li><b>Tracker AC</b> is live: Fight Defensively, Block, Mobile and a broken helmet show beside a creature's AC (players' come from their sheet).</li>
            <li><b>Elemental Criticals</b> all last until the end of the target's next turn (Acid's −1 DR too). Recharge rolls show their d6 in your dice tray. A <b>Tearing</b> weapon deals at least 2 per damage die even on a miss: an area attack's misses take it, and the attack card shows it. Stat blocks list each weapon's properties under it.</li>
            <li><b>Area weapons:</b> an NPC's (or player's) Scatter or Repeating weapon has you place its Cone or 2x2 square on the battle map, and its roll is compared with each creature's AC there (Repeating at Long Range: half damage). Unwieldy asks whether the target is within 1 square.</li>
            <li>A player's <b>Ground Strike</b> (Brute Rank 5) arrives like an area power: everyone in its 2-square burst makes the AGI save from your dice tray (players roll theirs), taking the damage and Prone on a failure, half on a success. A creature they used as the weapon takes the maximum on your tracker.</li>
            <li>An NPC's Weapon Forge prices are in TP: dice steps, critical multipliers and properties show what each one adds.</li>
            <li><b>NPC Block</b> adds real AC until its next turn: a shield +2 (2 AP), or a Sturdy weapon's die rolled for you (2 AP). A <b>Parrying</b> weapon blocks like a Sturdy one for its Reaction, 0 AP. The card's AC shows it.</li>
            <li><b>Keen</b> weapons crit on a natural 19 or 20 (NPCs' and players'), and a <b>Suppressed</b> weapon's attack card reminds you its attacker stays in stealth.</li>
            <li><b>Charmed</b> by a power: a charmed NPC that attacks is asked whether it's attacking someone other than its charmer, and the Charm ends on its own (with a log line) when the charmer or one of the charmer's allies damages it or hits it with a harmful power.</li>
            <li><b>Power buffs on the tracker:</b> a player's power with +1 AC, +2 DR/ER, Temp HP, +1 to rolls, Speed, AP or Immunity lands on the creature they picked (or everyone in its area): an NPC gets a chip on its row (AC, DR/ER, saves, attack rolls and its move Speed and Fly count it) that runs out on its turns; a player gets it on their sheet. When an NPC uses such a power from its stat block, you're asked who gets it.</li>
            <li><b>Grapple, Pin and Shove</b> (⚔ Actions on an NPC): after a win you pick who it grabbed, pinned or knocked Prone, and a player's sheet gets the Condition.</li>
            <li><b>Summons join the order by themselves:</b> a player's summoned creatures go right after their summoner (no prompt, even mid-fight). The summoner moves their tokens and rolls their attacks; their AP comes off your tracker.</li>
            <li><b>NPC Overexertion</b> on a lasting power (1 Minute, Channeling…) gives its Fatigue when the power ends: its chip counts down its turns, and its <b>×</b> ends it early (with the Fatigue).</li>
            <li>An Ambusher or Fortunate Fighter crit bought before the roll counts only if the total hits; the log says so.</li>
            <li>Your players' notifications no longer show how much damage NPCs deal to each other (only that they hit), so DR and ER can't be worked out from them.</li></ul>`],
        ['Maps', 'Maps and battle maps', `
            <ul><li><b>Upload Map</b> for world maps, dungeons and buildings. Pin locations with notes and subnotes; what you reveal becomes your players' Discoveries.</li>
            <li>Turn on the <b>Grid</b> (size, offset, colour, thickness, opacity), place tokens, resize them, and paint <b>Fog</b> of war.</li>
            <li><b>Terrain</b> (battle map bar): click or drag across squares to mark them as <b>difficult terrain</b> (diagonal lines everyone sees, hidden under fog like the map). Moving into one costs 2 squares. A square a dead, downed or Prone creature lies in counts too: others can move through it or stand there, and if the creature gets up, whoever is standing over it moves to the nearest open square.</li>
            <li><b>Walls</b>: drag anywhere on the map to draw walls players' tokens can't cross (they snap back, like fog). Walls go exactly where you draw them, at any angle; an end placed near another wall's end joins it, and holding Alt snaps to grid corners. Shift+click a wall to make it a <b>door</b>, right-click to delete one. Walls are only shown while Walls is on. Each door has a small, faint door icon only you see, set along the wall: a bar across it means closed (amber), a bar swung open means open (green). Hover it to bring it forward and click to open or close the door (secret doors stay shut until you open them). When walls close a loop they make a <b>room</b>: a small, faint cloud icon tucked into its top-left corner, out of the way (only you see it) covers the whole room in fog of war with one click, or reveals it again.</li>
            <li><b>Portals</b> (battle map bar): click a square, then the square it leads to. A token that steps into one comes out at the other end, as near as it fits (a Large or bigger creature squeezes into a smaller space if it has to), and a player's own fog opens up where they come out. Turn on <b>ask me first</b> (the bar's button for new ones, or Shift+click a portal) and a player who steps in waits for you: <b>Allow this time</b>, <b>Always allow</b> (that player, that portal) or <b>Not this time</b>. Right-click a portal to delete the pair.</li>
            <li><b>Each player has their own Fog of War</b> on a battle map: your fog, minus what they've revealed. <b>Fog for</b> (beside Fog) picks whose you see and edit. <b>Everyone</b> (the default): what you reveal, everyone sees, and what you cover is covered for everyone, their own reveals included. A player: you see their fog, and painting, room buttons and Clear reveal (or re-hide) just for them.</li>
            <li>Right-click a player's (or companion's) token for its <b>Fog</b> reveal: <b>Room</b> (moving into a fogged room, walls all round, reveals the whole room for them) or <b>Vision</b> (a cone, 30° to all round, out to a distance you set, reveals what the token sees as it moves; walls and closed doors block it). The cone is drawn on the map as you change it. <b>C</b> shows these cones, and <b>R</b> turns one while you hold its token. Opening or closing a door updates players' Vision cones at once (Room reveal only opens a room when the token steps in). A player's Large or bigger token squeezes into a smaller space where walls leave no room. Off by default.</li>
            <li><b>Draw</b> draws freehand on the map for everyone (colour and size; Undo, Clear mine, Clear everyone's); <b>Snap</b> (or holding <kbd>Alt</kbd>) draws straight lines between square corners and centres instead. <b>Ping</b> (<kbd>P</kbd>) puts a pulse, a chime and "GM" wherever your mouse is; players' pings show their character's name. Holding P sends one ping, and everyone gets 3 in a row, with one back every 3 seconds. A ping off screen shows on the edge of the view, with an arrow pointing toward it.</li>
            <li><b>Measure</b> (<kbd>M</kbd>) has Line, Cone and Burst modes and lists who's inside an area. A Cone covers every square at least a quarter inside the cone as drawn, and a Burst every square at least half inside its circle. Right-click drops waypoints.</li>
            <li>A measurement stays put: drag its <b>start point</b> to move it (on a creature, that moves the creature, with its path and AP in combat), and <b>scroll while dragging</b> its start to turn a Line or Cone square by square (scrolling while you're still drawing doesn't turn it). Lines shade the squares they cover and keep their length as they turn, and a Cone starts at the edge of its creature's space, so it never covers that creature. Players' measurements show on your map in blue; yours reach them only while you show them with <kbd>V</kbd>.</li>
            <li>Share a map with your players, and stop sharing to close it on their screens.</li>
            <li><b>All Tokens</b> (battle map bar) adds a token for every NPC in the tracker that has none on that map. <kbd>Delete</kbd> removes the selected tokens (or the one under your mouse). Opening a map from the World menu closes the World menu.</li>
            <li>The <b>Add Token</b> list stays open as you add tokens, so you can add several in a row (it counts them); its X closes it.</li>
            <li>Tokens added with <b>+ Token</b> from the tracker start hidden; reveal them from the token's menu. <b>Shrink</b> and <b>Grow</b> in a token's menu change its size. Double-click a window's title bar to minimize it to a tab, named after its map, Area Circle (its name, or "Area B" without one), NPC or note.</li>
            <li><b>+ Token</b> on a battle map: search NPCs by name, filter by Tier and sort by Name, Tier or HP. It lists this world's NPCs by default; tick <b>All worlds</b> for every saved stat block. A token added while combat is on asks whether it joins the initiative.</li>
            <li>Smaller tokens always draw on top of larger ones, so a Large creature never hides a Medium one under it.</li></ul>`],
        ['Loot and notes', 'Loot, crafting and notes', `
            <ul><li>The <b>Loot Maker</b> builds loot boxes and gives items or Currency to players; a hidden grant isn't shown to the rest of the party. Its <b>Crafting Materials</b> button adds Common, Uncommon and Rare materials in any amounts, and they join a player's own Crafting Materials when given.</li>
            <li>Each named NPC keeps its <b>own loot</b> in its NPC window (+ Loot Maker), dropped when it's defeated. Stat blocks never show loot: only what the creature always carries or wields. A stat block's <b>Generic Drops</b> (NPC Crafter) drop from every creature built from it.</li>
            <li>The Weapon and Armor Forges and the Consumable Crafter make custom gear for shops and loot. Consumables cost 5 Currency per XP and weigh ¼ lb per XP (rounded down); any made under the old prices are listed in <b>Consumables to remake</b> when the GM Tools open, to <b>Remake</b> or <b>Update</b> (players are asked about their own copies).</li>
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
