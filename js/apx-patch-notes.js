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
        version: 'v2026.9.24.1117',
        released: '2026-09-24T11:17:00',
        releasedText: 'September 24, 2026 · 11:17 AM',
        title: 'Playtest Update',
        intro: 'Shaped by our latest playtests, this update brings world rules for GMs, Luck and Looting, trading between players, Loyal Companions who fight at the party\'s side, and a dice roller that doubles as the combat log. Characters and worlds update themselves when you open them. Nothing is lost, and if a rule changed something on your character, you\'ll be told what.',
        index: [
            ['Your Table, Your Rules', [
                'World Settings let the GM choose Starting XP, Max GP, starting Cu, and Point Buy or Standard Array for every character in the world.',
                'In a world, XP comes from the GM with each character\'s own bonuses applied. Characters outside a world keep full control of their XP and GP.'
            ]],
            ['Loot, Trade and Companions', [
                'Luck and Looting: roll LUC (Loot) after a fight for Currency (LUC × enemies defeated ÷ 2) and ammunition (LUC − 3d6 rounds), or spend an hour scavenging for Crafting Materials.',
                'Defeated enemies drop their gear for the GM to hand out, and players can pass any inventory item to one another.',
                'Loyal Companions are full party members: their own token art, a spot in the Party tab and in initiative, and healing whenever their owner rests.'
            ]],
            ['At the Table', [
                'Dice and Notifications: every roll, the combat log and your messages (rests, XP, loot, warnings) in one tray.',
                'The combat log shows the fight to everyone and resolves Wound Threshold and Bleed Out rolls in order. Damage the party deals to enemies is reported without numbers, so DR and ER stay a mystery.',
                'Click skills, saves, weapons, powers and stat block dice to roll them, with perks, Advantage and Disadvantage, crits and Luck rerolls built in.',
                'Action Points are 6 + half your AGI modifier, tracked for every creature, carried between turns and spent automatically by attacks.',
                'Rest and Recover buttons cover Short and Full Rests, Shake it Off and Shrug It Off.'
            ]],
            ['Battle Maps', [
                'Shift+drag to move groups of tokens, place movable images with layers, and measure with M. Fog, grid, panning and resizing stay smooth on big maps.'
            ]],
            ['Rules', [
                'Point Buy: attributes start at 4 with 7 points to spend (2 to 7).',
                'High Roller and Fortunate Fighter rewritten; Regenerative and Mobile updated; Power Crafting caps each die step at 8 dice and adds Mythic Utilities (130 XP).',
                'Wound Threshold reminders with the CON save DC, and Permanent Injuries.',
                'NPC gear (weapons, armor, shields, helmets) costs Threat Points, and defeating NPCs is worth 1 / 5 / 10 / 15 / 25 / 35 XP for Tiers 0–5 (+10 per Tier after).'
            ]],
            ['And More', [
                'Easier-to-read small text, XP bonuses from INT, Educated and Expertise, conditions that bring their linked conditions with them, and plenty of fixes.',
                'Open the Character Sheet or GM Tools for the full notes.'
            ]]
        ],
        sheet: [
            ['Joining a World', [
                'Your GM sets the world\'s rules: Starting XP, Max GP, starting Cu, and how attributes are chosen. A brand-new character receives the Starting XP and Cu once.',
                'XP arrives from your GM with your bonuses already added (INT modifier, Educated, Expertise), and the XP fields are locked while you\'re in the world. Outside a world, you edit XP and Max GP yourself.',
                'Standard Array: each attribute has a dropdown that starts on "Choose". Picking a value takes it off the other dropdowns, and setting an attribute back to Choose frees its value again. Every value (7, 6, 5, 5, 5, 4, 3) is used once.',
                'Point Buy: all seven attributes start at 4 and you have 7 points. Raising an attribute by 1 costs a point, lowering one gives a point back, and each stays between 2 and 7.'
            ]],
            ['Party', [
                'The Party tab shows everyone in your world, with each Loyal Companion right after its owner.',
                'Click a portrait to see the full picture, not just the round token.'
            ]],
            ['Luck and Looting', [
                'The Loot / Scavenge button (beside + Add Item) handles all three rolls.',
                'Currency: roll LUC (Loot) and multiply by the number of enemies defeated. The party finds half of that, rounded down. Twelve mercenaries and a 16 on the check come to 96 Cu.',
                'Ammunition: roll LUC (Loot) and subtract 3d6. Whatever is left is the number of rounds (or arrows or energy cells) you recover, added to your Light, Medium or Heavy Ammo.',
                'Scavenging takes about an hour: roll LUC (Loot), PER (Notice), CON (Survive) or INT (Encyclopedia). When you\'re after Crafting Materials, the sheet rolls the table and adds what you find: 2–10 gives 1d4 Common and 1d4−1 Uncommon, 11–15 adds Rare, 16+ finds more, a natural 20 finds the most, and a natural 1 sets off a trap or hazard.',
                'Spend Luck or an Omen on any of these rolls and what you found updates to match.',
                'When your GM asks for a Loot check, your sheet opens the Currency roll with the enemy count already filled in and sends your result to the GM.'
            ]],
            ['Trading', [
                'Every inventory item has a Give button listing your party. Choose who gets it (and how many, for a stack) and it moves to their inventory.',
                'Items and Cu from your GM appear in your inventory with a notification.'
            ]],
            ['Loyal Companions', [
                'Give your companion its own picture: upload an image, then drag and zoom it inside the circle to frame the token. Adjust re-frames it later, and clicking the token shows the full picture.',
                'Your companion fights beside you. The GM can add it to initiative, and its HP stays in step with your sheet.',
                'Rests: whenever you use a Rest Die, your companion heals the amount rolled plus its CON modifier. The Short Rest window shows your companion\'s HP, and you can keep spending Rest Dice for it even when you\'re at full HP.',
                'A Full Rest restores your companion\'s Power Slots and charges. A Short Rest restores them too if its powers use CHA.',
                'Companions can carry a Shield (4 TP) and a Helmet (2 TP). The stat block tracks free hands and has an Equip/Stow Shield button, and attacks that need more hands than are free can\'t be rolled.',
                'Each +2 DR/ER purchase adds 2, and manufactured weapons and armor count against your companion\'s TP.'
            ]],
            ['Action Points', [
                'AP is 6 + half your AGI modifier (rounded down, minimum 6), minus Fatigue.',
                'Unspent AP carries over with no cap. The tracker shows your AP plus one empty pip and grows as you bank more. Click a pip to spend or refund.',
                'In combat your pool empties when the fight starts and refills when your turn comes up. Surprised characters get just 1 AP on their first turn.',
                'Attacks spend AP on their own. You\'re asked when you Aim (Aim AP + attack AP), when a perk might change the cost (Martial Arts, Flurry), or when you\'re short on AP.'
            ]],
            ['Dice and Notifications', [
                'Rolls and messages share one tray: rest results, XP, loot, HP changes from the GM and warnings. A red dot on the dice button means something new, and anything you clear stays cleared.',
                'During combat the tray is the fight\'s log. Damage enemies deal to you shows the amount. Damage the party deals to enemies doesn\'t, so their DR and ER stay hidden. Your checks and saves reach the GM, and a Luck reroll updates them.',
                'Wound Threshold and Bleed Out: when a hit takes you past your Wound Threshold, your next CON save is your roll to avoid being Wounded. If you\'re also Bleeding Out, the CON (Survive) check that follows sets how many rounds you have.',
                'Click any skill, save, attribute, weapon attack, damage, power or stat block dice to roll it. Conditions add Advantage or Disadvantage for you.',
                'The d4–d100 buttons build a dice pool, a number in the box is added as a modifier, and Roll rolls the pool and clears it.',
                'Critical hits multiply the number of damage dice. Spend a Luck Point to reroll a d20 straight from the roll.',
                'Damage perks apply themselves: High Roller, Melee Prowess and Sharpshooter (Rank 2 rolls damage twice and keeps the higher; Rank 5 maximizes damage on a confirmed crit), plus a toggle for Instigator. Omen Dice are stored and used from the roller.'
            ]],
            ['Rest and Recover', [
                'Rest: a Short Rest spends Rest Dice one at a time (each heals the die + your CON modifier) and brings back CHA Power Slots. A Full Rest restores all HP and Power Slots, half your max Rest Dice and your Luck, and removes 1 Fatigue.',
                'Recover: Shake it Off (1 AP, roll up to half your max Rest Dice, adding CON to each) and Shrug It Off (3 AP, heal one Wounded limb), each once per Short or Full Rest.',
                'Regenerative costs 3 GP: at the start of your turn in combat, press Regen to spend a Rest Die and heal the roll.'
            ]],
            ['Conditions and Injuries', [
                'Unconscious, Paralyzed or Incapacitated characters see why their attacks and powers are unavailable (for example "(Unconscious)"). Unconscious auto-fails STR, AGI, PER, INT and CHA checks (CON still works, for Bleed Out); Paralyzed auto-fails STR and AGI checks.',
                'Burning deals 1d10 Fire damage at the start of your turn in combat (ignoring ER) unless you\'re immune to Fire.',
                'Conditions bring the ones they include: Bleeding Out → Unconscious → Incapacitated (and Prone), Paralyzed → Incapacitated, Diseased → Infected. Frenzy Rank 5 keeps you conscious while Provoked. Remove any condition with the × on its tag under Vitals.',
                'Permanent Injuries: when a Wounded limb is Wounded again, press Re-wounded and choose an attribute to lower by 1. Remove the injury once it heals to get the point back.'
            ]],
            ['Rules', [
                'High Roller: a Gamble that hits deals +5 damage (+10 and 1 AP from Rank 4). Rank 2 rerolls 1s and 2s on damage, Rank 3 Luck rerolls can use Advantage or Disadvantage, and Rank 5 is a Dice Explosion once per Full Rest.',
                'Fortunate Fighter Rank 1: you may use LUC instead of AGI for your AC. The sheet picks whichever is higher.',
                'Mobile Rank 1: moving costs 1 less AP each time (minimum 0), and you ignore difficult terrain.',
                'Power Crafting: at most 8 dice per die step, and Sacrifice also stops you regaining HP until your next turn. Affected powers show "Recraft (Free)".',
                'Mythic Utilities (Power Crafter Step 5): Dominate, Vehicle Scale, Wish, Create a Sentient Being and Stop Time. Each costs a flat 130 XP, unaffected by Area of Effect or HP Capacity Pool. A Mythic power takes no other utilities, gets no refunds from Steps 6–8, pays double for Duration and AP, and skips Step 6 or 7 where its utility says so.',
                'Heavy ranged weapons show AGI in the ATT column.'
            ]],
            ['Inventory and Display', [
                'Ammo is one stack per type: another bundle adds 20 rounds to your "Medium Ammo".',
                'Power Crafter Step 5 lists Minor and Moderate Utilities in one column and Major, Master and Mythic in the other.',
                'The perk list can show just the perks you own.',
                'Small text is larger throughout, and a touch larger again in the Fantasy theme.'
            ]],
            ['Battle Maps', [
                'Measure with M (middle-drag still pans), see token numbers and conditions, and resize map windows from the corner grip.'
            ]]
        ],
        gm: [
            ['World Settings', [
                'The World Settings tab sets the rules for every character in your world: Starting XP (25 by default), Max GP (15), a starting Cu bonus, and Point Buy or Standard Array (7, 6, 5, 5, 5, 4, 3).',
                'Players in your world don\'t edit their own XP or Max GP. Grant XP adds each player\'s bonuses and logs the reason.',
                'Starting XP and Cu go to brand-new characters once. Existing characters keep what they have.'
            ]],
            ['Loot', [
                'When an enemy dies in initiative, its weapons, armor, shield and helmet appear in the Loot panel under the tracker, grouped by who dropped them.',
                'Choose a party member beside each item and press Give; it goes straight into their inventory. Your other choices stay as they are while you hand things out, and ✕ removes anything that didn\'t survive the fight.',
                'Currency: the party finds LUC (Loot) × enemies defeated ÷ 2, rounded down. The panel counts the enemies defeated this combat, and you can change the number.',
                'Ask players to roll: their sheets open the Loot roll with the enemy count filled in. Each result shows up with its Cu. Press Use, then give it to one player or split it across the party.',
                'Players can also trade items with each other from their inventories.'
            ]],
            ['Loyal Companions', [
                'Companions sit under their owner in the Party panel with their stat block, token picture and a + Initiative button. Add Party places their tokens on the map as well.',
                'In initiative a companion is an ally: its HP stays in step with its owner\'s sheet, it isn\'t removed at 0 HP, and it doesn\'t take a share of combat XP.'
            ]],
            ['Initiative and Combat', [
                'Bleed Out is a single row: "Bleeding Out: N rounds left" with − Round, + Round and Stabilize.',
                'End Combat checks for anyone still Bleeding Out first, and the XP award closes the combat log.',
                'The combat log lives in the dice tray. Everyone sees damage and healing, but players see "Ari dealt damage to Goblin" without the number, so DR and ER stay secret; you see every amount. Damage to players shows its amount to everyone. Player checks and saves appear for you alone (marked GM) and update live with Luck or Omen. Hidden tokens show as "an unseen creature".',
                'Wound Threshold and Bleed Out rolls are matched for you, Wound Threshold first: the player\'s next CON save settles the wound against its DC (10, or half the damage), then their CON (Survive) check sets the Bleed Out rounds (half the result, minimum 1).',
                'AP is tracked for every creature and carries over. Surprised creatures gain only 1 AP on their first turn, even if added mid-fight, and attacks rolled from a stat block spend that creature\'s AP.',
                'Conditions include their linked conditions and reach players\' sheets. Saved NPCs keep current HP in step with max HP, and NPCs join initiative at full HP.',
                'Messages go to Dice and Notifications. Click a party member\'s name for their full stat block.'
            ]],
            ['NPC Crafter', [
                'Shields (+2 AC/DR/ER, 4 TP, one hand) and Helmets (+1 AC/DR/ER, 2 TP). Stat blocks track free hands and have an Equip/Stow Shield button; two-handed attacks can\'t be rolled while the shield is up.',
                'Each +2 DR/ER purchase (1 TP) adds 2.',
                'Die-step and extra-dice buttons switch off at their maximum, so clicks don\'t fall through to anything behind them.',
                'XP rewards per Tier: 1 / 5 / 10 / 15 / 25 / 35 XP for Tiers 0–5, then +10 per Tier, divided among the players.',
                'Manufactured weapons and armor cost Threat Points, priced like the innate features they imitate.',
                'Power Crafter: at most 8 dice per die step, a warning when Sacrifice meets healing, Minor and Moderate utilities in one column, and Mythic Utilities (a flat 130 XP).'
            ]],
            ['Battle Maps', [
                'Shift+drag selects several tokens to move together; right-click for group options.',
                'Movable images (carts, tower floors, overlays) with layers, size, lock, reveal and opacity. Players see the same layering.',
                'Token numbers, sizes from the character sheet, condition badges and companion tokens with their own art.',
                'Measure with M: squares count inclusively and snap to token corners, and middle-drag pans while measuring.',
                'F toggles the fog painter and Clear asks first. Grid, fog and window resizing stay light on large maps; resize from the corner grip.'
            ]],
            ['World', [
                'Reveal toggles sit beside Edit on pins and on every sub-note in popups. Races stay with their own world, and locations can link NPCs.'
            ]],
            ['Fixes', [
                'Auto-save works reliably again (including on Brave), with no more "write stream exhausted" errors in long sessions.'
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
