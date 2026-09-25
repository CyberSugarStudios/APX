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
        version: 'v2026.9.25.0941',
        released: '2026-09-25T09:41:00',
        releasedText: 'September 25, 2026 · 9:41 AM',
        title: 'Playtest Update',
        intro: 'Everything here comes from our playtest tables. GMs can shape their world\'s rules, arm and supply NPCs, and hand out magic items that change almost anything on a character sheet. Players get Luck and Looting, trading, Omen dice they can share, Loyal Companions that act on their own turns, and a dice roller that doubles as the combat log. Open your characters and worlds as usual: they update themselves, nothing is lost, and any rule change that affected you is explained.',
        index: [
            ['For GMs', [
                'World Settings: Starting XP, Max GP, starting Cu, and Point Buy or Standard Array for everyone in the world.',
                'Loot Maker: build loot with the same forges and crafters players use (consumables included) and give it to NPCs. NPCs use their consumables in a fight and drop what\'s left when they fall.',
                'Magic items can raise or lower almost anything on a sheet: Core Attributes, skills, Max HP, AP, Initiative, Wound Threshold, Rest Dice, Luck Points, Power Slots, attacks, saves and more.',
                'Hand out loot from the Loot panel, an NPC\'s window or any Area Circle it stands in.'
            ]],
            ['For Players', [
                'Luck and Looting: LUC (Loot) for Currency (LUC × enemies defeated ÷ 2) and ammunition (LUC − 3d6 rounds), or scavenge for an hour for Crafting Materials.',
                'Omen dice can be passed to the GM (for any creature\'s roll) or to a party member, work on your companion\'s rolls, swap in natural 1s and 20s, and are rerolled one by one on a Full Rest.',
                'Loyal Companions have their own AP that refills on their turn in initiative, token art, and healing whenever you use a Rest Die.',
                'Trade items with your party. In a world, XP comes from the GM with your bonuses applied.'
            ]],
            ['At the Table', [
                'Dice and Notifications holds every roll, the combat log and your messages in one tray.',
                'The combat log shows the whole table the fight and resolves Wound Threshold and Bleed Out rolls in order. The party\'s damage to enemies is shown without numbers, keeping DR and ER hidden.',
                'Click skills, saves, weapons, powers and stat block dice to roll them, with perks, Advantage and Disadvantage, crits and Luck rerolls built in.',
                'Action Points are 6 + half your AGI modifier, tracked for every creature, carried between turns and spent by attacks automatically.',
                'Rest and Recover buttons: Short and Full Rests, Shake it Off and Shrug It Off.'
            ]],
            ['Battle Maps', [
                'Move token groups with Shift+drag, layer images on the map, and measure with M. Big maps stay smooth.'
            ]],
            ['Rules', [
                'Point Buy: attributes start at 4 with 7 points to spend, each between 2 and 7.',
                'High Roller and Fortunate Fighter rewritten; Regenerative and Mobile updated; Power Crafting caps die steps at 8 dice and adds Mythic Utilities (130 XP).',
                'Wound Threshold reminders with the CON save DC, and Permanent Injuries.',
                'NPC weapons, armor, shields and helmets cost Threat Points, and defeated NPCs are worth 1 / 5 / 10 / 15 / 25 / 35 XP for Tiers 0–5 (+10 per Tier after).'
            ]],
            ['Also', [
                'Easier-to-read small text, XP bonuses from INT, Educated and Expertise, linked conditions, a tidier Character Sheet toolbar, and many fixes.',
                'The Character Sheet and GM Tools have the full details.'
            ]]
        ],
        sheet: [
            ['Your World', [
                'Your GM sets the world\'s rules: Starting XP, Max GP, starting Cu, and how attributes are chosen. A brand-new character receives the Starting XP and Cu once.',
                'XP comes from your GM with your bonuses (INT modifier, Educated, Expertise) added, and the XP fields are locked while you\'re in the world. Outside a world, XP and Max GP are yours to set.',
                'A new character only receives XP granted after it joins the world. XP still waiting from before (for an earlier character of yours) never lands on it.',
                'Standard Array: each attribute begins on "Choose", and a value you pick leaves the other dropdowns until you free it. Use 7, 6, 5, 5, 5, 4 and 3 once each.',
                'Point Buy: every attribute starts at 4 with 7 points to spend. Each +1 costs a point, each −1 gives one back, and attributes stay between 2 and 7.'
            ]],
            ['Loyal Companions', [
                'Your companion has its own AP, shown as pips on its card under Perks and in its stat block popup. Click pips to spend or refund, just like your own tracker. Unspent AP carries over.',
                'In combat, its AP empties when the fight begins and refills when its turn comes up in the GM\'s initiative (1 AP if it was Surprised).',
                'Attacks rolled from its stat block spend its AP automatically, and each of its powers has a Use button that spends the power\'s AP.',
                'Your Omen dice work on your companion\'s rolls, including dice passed to you by other players.',
                'Its HP stays in step everywhere: changes from the popup, the Perks card or the GM show up in both places at once.',
                'Give it its own picture: upload one, then drag and zoom inside the circle to frame the token. Adjust re-frames it later, and clicking the token shows the full image.',
                'Every Rest Die you use also heals your companion by the roll plus its CON modifier. The Short Rest window shows its HP, and you can keep spending dice for it while you\'re at full HP. A Full Rest restores its Power Slots and charges; so does a Short Rest if its powers use CHA.',
                'Companions can carry a Shield (4 TP) and a Helmet (2 TP). The stat block counts free hands and has an Equip/Stow Shield button, and attacks needing more hands than are free can\'t be rolled. Each +2 DR/ER purchase adds 2, and manufactured weapons and armor use its TP.'
            ]],
            ['Omen', [
                'Your Omen dice sit under Disadv | Normal | Adv in the dice tray. Click one to pass it on: pick the die as it is or (from Rank 2) plus or minus your LUC modifier, then pick who gets it.',
                'The GM can use it to replace any creature\'s d20, such as an enemy\'s critical hit. A party member gets it in their dice roller (even without the Omen perk) to use on their own roll or to pass along.',
                'On your own rolls, and your companion\'s, use a die from the roll\'s buttons.',
                'Banking a natural 1 or 20 (Rank 3) is a swap: the natural roll joins your Omen dice, and the held die you give up becomes that roll (plus or minus LUC from Rank 2).',
                'On a Full Rest, choose which held Omen dice, if any, to roll again. The rest are kept and empty slots are filled. At Rank 5, dice rolled again come back as whichever of 1, 10 and 20 is missing.'
            ]],
            ['Magic and Custom Items', [
                'Equippable items can carry any number of bonuses (or penalties, for cursed items): Core Attributes, any skill, AC, DR, ER, resistance to one energy type, Max HP, Max AP, Speed, Initiative, Wound Threshold, Max Rest Dice, Max Luck Points, Carry Capacity, melee and ranged attack and damage rolls, power attack rolls and save DC, saving throws, checks, and extra Power Slots of any level (or for the CHA pool).',
                'Make them with Add Item (tick Equippable, then add Other Bonuses beside the attribute, skill and energy bonuses), and edit your own later from their details.',
                'Bonuses apply while the item is equipped and are listed under its name in your inventory. Items from your GM keep the bonuses the GM gave them.'
            ]],
            ['Luck and Looting', [
                'Loot / Scavenge (beside + Add Item) has all three rolls.',
                'Currency: LUC (Loot) × enemies defeated, halved and rounded down, is what the party finds. A 16 after twelve mercenaries turns up 96 Cu.',
                'Ammunition: LUC (Loot) − 3d6 rounds (or arrows or energy cells) recovered, added to your Light, Medium or Heavy Ammo.',
                'Scavenging takes about an hour with LUC (Loot), PER (Notice), CON (Survive) or INT (Encyclopedia). Hunting for Crafting Materials rolls the table for you: 2–10 finds 1d4 Common and 1d4−1 Uncommon, 11–15 adds Rare, 16+ finds more, a natural 20 finds the most, and a natural 1 sets off a trap or hazard.',
                'Luck rerolls and Omens update what you found. When the GM asks for a Loot check, the Currency roll opens with the enemy count filled in and your result goes to the GM.'
            ]],
            ['Party, Trading and Gifts', [
                'The Party tab lists everyone in your world, each Loyal Companion right after its owner. Click a portrait to see the full picture.',
                'Each inventory item has a Give button listing your party. Choose who gets it (and how many, for stacks) and it moves to their inventory.',
                'Gear, consumables, magic items and Cu from your GM arrive in your inventory with a notification.'
            ]],
            ['Action Points', [
                'AP is 6 + half your AGI modifier (rounded down, minimum 6), minus Fatigue, plus item bonuses.',
                'Unspent AP carries over with no cap. The tracker shows your AP plus one empty pip and grows as you bank more. Click a pip to spend or refund.',
                'In combat your pool empties when the fight begins and refills when your turn comes up. Surprised characters get only 1 AP on their first turn.',
                'Attacks spend their own AP. You\'re asked when you Aim (Aim AP + attack AP), when a perk might change the cost (Martial Arts, Flurry), or when you\'re short on AP.'
            ]],
            ['Dice and Notifications', [
                'Rolls and messages share one tray: rest results, XP, loot, HP changes from the GM and warnings. A red dot on the dice button marks something new, and cleared entries stay cleared.',
                'In combat the tray is the fight\'s log. Damage enemies deal to you shows the amount; damage the party deals to enemies doesn\'t, so their DR and ER stay hidden. Your checks and saves reach the GM, and Luck rerolls update them.',
                'Wound Threshold and Bleed Out: when a hit goes past your Wound Threshold, your next CON save is the roll to avoid being Wounded. If you\'re also Bleeding Out, the CON (Survive) check that follows sets how many rounds you have.',
                'Click any skill, save, attribute, weapon attack, damage, power or stat block dice to roll it. Conditions add Advantage or Disadvantage for you.',
                'The d4–d100 buttons build a dice pool, the box adds a modifier, and Roll rolls the pool and clears it.',
                'Critical hits multiply the damage dice. A Luck Point rerolls a d20 right from the roll.',
                'Damage perks apply themselves: High Roller, Melee Prowess and Sharpshooter (Rank 2 rolls damage twice and keeps the higher, Rank 5 maximizes damage on a confirmed crit), plus a toggle for Instigator.'
            ]],
            ['Rest and Recover', [
                'Rest: a Short Rest spends Rest Dice one at a time (each heals the die + your CON modifier) and restores CHA Power Slots. A Full Rest restores all HP and Power Slots, half your max Rest Dice and your Luck, and removes 1 Fatigue.',
                'Recover: Shake it Off (1 AP, roll up to half your max Rest Dice, each + CON) and Shrug It Off (3 AP, heal one Wounded limb), each once per Short or Full Rest.',
                'Regenerative costs 3 GP: at the start of your turn in combat, press Regen to spend a Rest Die and heal the roll.'
            ]],
            ['Conditions and Injuries', [
                'Unconscious, Paralyzed or Incapacitated characters see why their attacks and powers are unavailable (for example "(Unconscious)"). Unconscious auto-fails STR, AGI, PER, INT and CHA checks (CON still works, for Bleed Out); Paralyzed auto-fails STR and AGI checks.',
                'Burning deals 1d10 Fire damage at the start of your turn in combat (ignoring ER) unless you\'re immune to Fire.',
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
                'Settings now sits beside World at the top of the Character Sheet, and Undo and Redo live at the bottom of the Roster menu (Ctrl+Z and Ctrl+Y still work anywhere).',
                'Ammo is one stack per type: another bundle adds 20 rounds to your "Medium Ammo".',
                'Power Crafter Step 5 puts Minor and Moderate Utilities in one column and Major, Master and Mythic in the other.',
                'The perk list can show only the perks you own. Small text is larger everywhere, and slightly larger again in the Fantasy theme.'
            ]],
            ['Battle Maps', [
                'Measure with M (middle-drag still pans), see token numbers and conditions, and resize map windows from the corner grip.'
            ]]
        ],
        gm: [
            ['World Settings', [
                'The World Settings tab sets your world\'s rules: Starting XP (default 25), Max GP (default 15), a starting Cu bonus, and Point Buy or Standard Array (7, 6, 5, 5, 5, 4, 3).',
                'Players in your world can\'t edit their own XP or Max GP. Grant XP applies each player\'s bonuses and records the reason.',
                'Starting XP and Cu go to brand-new characters once; existing characters keep what they have.'
            ]],
            ['Loyal Companions', [
                'Companions sit under their owner in the Party panel with their stat block, token art and a + Initiative button. Add Party places their tokens on the map too.',
                'In initiative a companion is an ally with its own AP: attacks rolled from its stat block spend it, and when its turn comes up its owner\'s sheet refills the companion\'s AP pips as well.',
                'Its HP follows its owner\'s sheet, it stays in the order at 0 HP, and it doesn\'t take a share of combat XP.'
            ]],
            ['Omen Dice on Your Rolls', [
                'When a player passes you an Omen die, the combat log announces it and the die waits in your dice tray, above the dice buttons, with the player\'s name. (Players can also pass Omen dice straight to each other.)',
                'Every d20 roll in your tray gains a "Seer\'s Omen 6" style button. Press it on the roll it replaces (an NPC\'s attack, check or save) and that d20 becomes the Omen die, LUC adjustment included. A critical hit turned into a 6 is no longer a critical.',
                'The log tells the table the new result and shows you the before and after. Dismiss an Omen with ✕ if it was handled another way.'
            ]],
            ['Loot Maker', [
                'Build loot with the tools players use: the Weapon Forge and Armor Forge (free for you, finishing with "Add to Loot"), the Consumable Crafter (potions, grenades, scrolls and more), the Adventuring Gear list, quick custom weapons, Shields and Helmets.',
                'Custom items can be made equippable with any number of bonuses or penalties, picked from one list: Core Attributes, any skill, AC, DR, ER, a single energy resistance, Max HP, Max AP, Speed, Initiative, Wound Threshold, Max Rest Dice, Max Luck Points, Carry Capacity, attack and damage rolls, power attack and DC, saving throws, checks, and extra Power Slots of any level or for the CHA pool. Players can read these bonuses but can\'t edit them.',
                'Open the Loot Maker from the Loot panel to fill your Loot list, or from an NPC to stock what it carries.'
            ]],
            ['NPC Gear and Consumables', [
                'Every NPC stat block can carry items and Currency, added from the NPC Crafter ("Carried Items and Loot") or from the NPC\'s window in your world notes. Carried gear costs no Threat Points.',
                'Consumables appear on the stat block with their charges and a Use button: 3 AP and one charge, tracked per creature in initiative, so goblins sharing a stat block each have their own.',
                'When the NPC dies, its equipment, whatever it still carries (consumables with charges left) and its Currency drop into the Loot panel.',
                'An NPC\'s window has its own Loot section: a "Give to" dropdown per item and a Currency box to give to one player or split across the party, for loot that changes hands without a fight.'
            ]],
            ['Loot on Maps', [
                'Loot lives on NPCs. Link an NPC to an Area Circle and the area\'s popup shows its loot, ready to hand out. A chest, a fallen soldier or a shopkeeper is simply an NPC placed there.',
                'Battle-map tokens work the same way: a token linked to an NPC drops that NPC\'s loot when it falls.',
                'Loot stays yours alone until you give it away.'
            ]],
            ['Loot After a Fight', [
                'Defeated enemies\' gear appears in the Loot panel under the tracker, grouped by who dropped it.',
                'Choose a party member beside each item and press Give; it goes straight into their inventory. Your other picks stay put while you hand things out, and ✕ removes anything that didn\'t survive the fight.',
                'Currency: the party finds LUC (Loot) × enemies defeated ÷ 2, rounded down. The panel counts this combat\'s defeated enemies (you can change it), and Currency carried by fallen NPCs is added to the Cu box.',
                'Ask players to roll: their sheets open the Loot roll with the enemy count ready, and each result arrives with its Cu. Press Use, then give it to one player or split it across the party.',
                'Players can also trade items among themselves.'
            ]],
            ['Party', [
                'Party stat blocks include the bonuses from each player\'s equipped items (Max HP, AP, saves, Wound Threshold and the rest).'
            ]],
            ['Initiative and Combat', [
                'Bleed Out is one row: "Bleeding Out: N rounds left" with − Round, + Round and Stabilize.',
                'End Combat checks for anyone still Bleeding Out first, and the XP award closes the combat log.',
                'The combat log lives in the dice tray. Everyone sees damage and healing, but players see "Ari dealt damage to Goblin" with no number so DR and ER stay secret; you see every amount. Damage to players shows its amount to everyone. Player checks and saves appear for you alone (marked GM) and update live with Luck or Omen. Hidden tokens show as "an unseen creature".',
                'Wound Threshold and Bleed Out rolls are matched for you, Wound Threshold first: the player\'s next CON save settles the wound against its DC (10, or half the damage), then their CON (Survive) check sets the Bleed Out rounds (half the result, minimum 1).',
                'Every creature\'s AP is tracked and carries over. Surprised creatures gain only 1 AP on their first turn, even when added mid-fight, and attacks and consumables used from a stat block spend that creature\'s AP.',
                'Conditions include their linked conditions and reach players\' sheets. Saved NPCs keep current HP in step with max HP, and NPCs join initiative at full HP.',
                'Messages go to Dice and Notifications. Click a party member\'s name for their full stat block.'
            ]],
            ['NPC Crafter', [
                'Shields (+2 AC/DR/ER, 4 TP, one hand) and Helmets (+1 AC/DR/ER, 2 TP). Stat blocks count free hands and have an Equip/Stow Shield button; two-handed attacks can\'t be rolled while the shield is up.',
                'Each +2 DR/ER purchase (1 TP) adds 2.',
                'Die-step and extra-dice buttons switch off at their maximum, so clicks never land on what\'s behind them.',
                'XP rewards per Tier: 1 / 5 / 10 / 15 / 25 / 35 XP for Tiers 0–5, then +10 per Tier, divided among the players.',
                'Manufactured weapons and armor cost Threat Points, priced like the innate features they imitate.',
                'Power Crafter: at most 8 dice per die step, a warning when Sacrifice meets healing, Minor and Moderate utilities in one column, and Mythic Utilities (a flat 130 XP).'
            ]],
            ['Battle Maps', [
                'Shift+drag selects several tokens to move together; right-click for group options.',
                'Movable images (carts, tower floors, overlays) with layers, size, lock, reveal and opacity. Players see the same layering.',
                'Token numbers, sizes from the character sheet, condition badges, and companion tokens with their own art.',
                'Measure with M: squares count inclusively and snap to token corners, and middle-drag pans while measuring.',
                'F toggles the fog painter and Clear asks first. Grid, fog and window resizing stay light on large maps; resize from the corner grip.'
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
