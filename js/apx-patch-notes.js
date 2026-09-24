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
        version: 'v2026.9.24.1022',
        released: '2026-09-24T10:22:00',
        releasedText: 'September 24, 2026 · 10:22 AM',
        title: 'Playtest Update',
        intro: 'This update is built from our latest playtests. It adds world rules for GMs, loot and trading, Loyal Companions who fight beside the party, a dice roller that doubles as a combat log, and many rules updates. Your characters and worlds update automatically when you open them. Nothing is lost, and anything whose rules changed tells you what changed.',
        index: [
            ['Worlds and Parties', [
                'World Settings: GMs choose Starting XP, Max GP, starting Cu, and Point Buy or Standard Array for every character in their world.',
                'XP comes from the GM in a world, arriving with each character\'s own bonuses. Characters outside a world still manage their own XP and GP.',
                'Luck and Looting: a Loot / Scavenge button rolls LUC (Loot) for Currency (LUC × enemies defeated ÷ 2) and ammunition (LUC − 3d6 rounds), or scavenges for Crafting Materials using the new table.',
                'Fallen enemies leave their gear for the GM to hand out, and players can give any inventory item to a party member.',
                'Loyal Companions join the party: they get their own token portrait, show in the Party tab, take a place in initiative, and heal when their owner rests.'
            ]],
            ['Combat', [
                'Dice and Notifications: one tray for every roll, the combat log and messages (rests, XP, loot, warnings). Clear keeps it clear.',
                'The combat log shows the fight to the whole table. Wound Threshold saves and Bleed Out checks are resolved there in order. Damage players deal to NPCs is reported without the number, so DR and ER stay secret.',
                'Action Points are 6 + half your AGI modifier, tracked for everyone, carried over between turns and spent automatically by attacks. Surprised creatures get 1 AP on their first turn.',
                'Click skills, saves, weapons, powers and stat block dice to roll them, with perks, Advantage and Disadvantage, crits and Luck rerolls built in.',
                'Rest and Recover buttons: Short and Full Rests, Shake it Off and Shrug It Off.'
            ]],
            ['Battle Maps', [
                'Select several tokens (Shift+drag) and move them together, add movable images with layers, and measure distances with M.',
                'Smooth maps: fog, grid, panning and window resizing stay responsive on large maps.'
            ]],
            ['Rules', [
                'Point Buy: every attribute starts at 4, with 7 points to spend (maximum 7, minimum 2).',
                'High Roller and Fortunate Fighter (Rank 1) rewritten; Regenerative and Mobile updated; Power Crafting caps die steps at 8 dice and adds Mythic Utilities (130 XP).',
                'Wound Threshold reminders with the CON save DC, and Permanent Injuries.',
                'NPCs: manufactured weapons, armor, shields and helmets cost Threat Points, and defeating NPCs is worth 1 / 5 / 10 / 15 / 25 / 35 XP for Tiers 0–5 (+10 per Tier after).'
            ]],
            ['Everything Else', [
                'Larger small text everywhere (a little larger again in the Fantasy theme), XP bonuses from INT, Educated and Expertise, conditions that apply their linked conditions, and many fixes.',
                'Open the Character Sheet or GM Tools for the full notes.'
            ]]
        ],
        sheet: [
            ['Your World', [
                'In a world, your GM sets the rules: Starting XP, Max GP, starting Cu, and whether attributes use Point Buy or Standard Array. New characters receive the Starting XP and Cu once.',
                'XP comes from your GM and arrives automatically with your bonuses (INT modifier, Educated, Expertise). The XP fields are locked while your character belongs to a world. Characters outside a world still edit XP and Max GP freely.',
                'Standard Array replaces the attribute boxes with dropdowns of 7, 6, 5, 5, 5, 4 and 3. Each value can be used once.',
                'Party tab: your allies and their Loyal Companions, with portraits. Map pins open popups with their details.'
            ]],
            ['Luck and Looting', [
                'New Loot / Scavenge button beside + Add Item.',
                'Loot Currency: roll LUC (Loot) and multiply it by the number of enemies defeated. The party finds half that total (rounded down). Example: 12 mercenaries and a 16 on the check find 96 Cu.',
                'Loot Ammunition: roll LUC (Loot) and subtract 3d6. What\'s left is the number of rounds (or arrows or energy cells) recovered, added to your Light, Medium or Heavy Ammo.',
                'Scavenge (about 1 hour): roll LUC (Loot), PER (Notice), CON (Survive) or INT (Encyclopedia). Searching for Crafting Materials rolls the table for you and adds them to your inventory: 2–10 finds 1d4 Common and 1d4−1 Uncommon, 11–15 adds Rare, 16+ finds more, a natural 20 finds the most, and a natural 1 triggers a trap or hazard.',
                'A Luck reroll or Omen on these rolls updates what you found.'
            ]],
            ['Trading', [
                'Every inventory item has a Give button that opens a "Give to" list of your party. Pick a name (and how many, for a stack) and the item moves to their inventory.',
                'Items and Cu the GM hands out arrive in your inventory automatically, with a notification.',
                'When the GM asks for a LUC (Loot) check, your sheet opens Loot Currency with the number of enemies filled in and sends your result to the GM.'
            ]],
            ['Action Points', [
                'Your AP is 6 + half your AGI modifier (rounded down, minimum 6), minus Fatigue.',
                'Unspent AP carries over with no cap. The tracker shows your AP plus one empty pip and grows as you bank more. Click pips to spend or refund.',
                'In combat your AP pool empties when combat starts and fills when your turn comes up. If you were Surprised, you get only 1 AP on your first turn.',
                'Attacks spend their AP automatically. A popup appears when you Aim (Aim AP + attack AP), when a perk might change the cost (Martial Arts, Flurry), or when you don\'t have enough AP.'
            ]],
            ['Dice and Notifications', [
                'One tray for rolls and messages: rest results, XP, loot, HP changes from the GM and warnings. A red dot on the dice button means something new, and cleared entries stay cleared.',
                'Combat log: during combat the tray shows the fight. Damage enemies deal to you shows the amount; damage the party deals to enemies doesn\'t, so their DR and ER stay hidden. Your checks and saves go to the GM, and a Luck reroll updates them.',
                'Wound Threshold and Bleed Out: when you\'re hit past your Wound Threshold, your next CON save is your roll to resist being Wounded. If you\'re also Bleeding Out, the CON (Survive) check after that sets how many rounds you have.',
                'Click any skill, save, attribute, weapon attack, damage, power or stat block dice to roll it. Conditions add Advantage or Disadvantage automatically.',
                'The d4–d100 buttons build a dice pool, a number in the box is added as a modifier, and Roll rolls the pool and clears it.',
                'Critical hits multiply the number of damage dice. Spend a Luck Point to reroll a d20 right from the roll.',
                'Damage perks apply automatically: High Roller, Melee Prowess and Sharpshooter (Rank 2: roll damage twice and keep the higher; Rank 5: maximum critical damage on a confirmed crit), plus a toggle for Instigator. Omen Dice are stored and usable from the roller.'
            ]],
            ['Rest and Recover', [
                'Rest button: Short Rest (spend Rest Dice one at a time, each healing the die + your CON modifier; CHA Power Slots come back) or Full Rest (full HP, −1 Fatigue, half your max Rest Dice back, all Power Slots, Luck).',
                'Recover button: Shake it Off (1 AP, roll up to half your max Rest Dice + CON each) and Shrug It Off (3 AP, heal one Wounded limb). Each is usable once per Short or Full Rest.',
                'Regenerative costs 3 GP: at the start of your turn in combat, press Regen to expend a Rest Die and heal the roll.'
            ]],
            ['Loyal Companions', [
                'Upload a portrait for your companion. It becomes their token and appears in the Party tab.',
                'Your companion is a party member: the GM can add them to initiative and track their HP, and changes reach your sheet.',
                'Rests: whenever you use a Rest Die, your companion heals for the amount rolled plus their CON modifier. A Full Rest restores their Power Slots and charges; a Short Rest restores them if their powers use CHA.',
                'Companions can carry a Shield (4 TP) and a Helmet (2 TP). The stat block counts free hands and has an Equip/Stow Shield button; attacks that need more hands than are free can\'t be rolled.',
                '+2 DR/ER purchases add 2 per purchase, and manufactured weapons and armor count against your companion\'s TP.'
            ]],
            ['Conditions and Injuries', [
                'While Unconscious, Paralyzed or Incapacitated, your attacks and powers show why (for example "(Unconscious)") and can\'t be rolled. Unconscious auto-fails STR, AGI, PER, INT and CHA checks (CON still works, for your Bleed Out roll); Paralyzed auto-fails STR and AGI checks.',
                'Burning deals 1d10 Fire damage automatically at the start of your turn in combat (ignoring ER), unless you\'re immune to Fire.',
                'Conditions apply the ones they include: Bleeding Out → Unconscious → Incapacitated (and you fall Prone), Paralyzed → Incapacitated, Diseased → Infected. Frenzy Rank 5 keeps you conscious while Provoked. Remove any condition with the × on its tag under Vitals.',
                'Permanent Injuries: if a Wounded limb is Wounded again, press Re-wounded to choose an attribute to lower by 1. Remove the injury when it heals to get the point back.'
            ]],
            ['Rules', [
                'Point Buy: all seven attributes start at 4 and you have 7 points. Raising an attribute by 1 costs a point and lowering it by 1 gives one back. The maximum is 7 and the minimum is 2.',
                'High Roller: a Gamble that hits deals +5 damage (+10 and 1 AP from Rank 4); Rank 2 rerolls 1s and 2s on damage; Rank 3 Luck rerolls can use Advantage or Disadvantage; Rank 5 is a Dice Explosion once per Full Rest.',
                'Fortunate Fighter Rank 1: when determining your AC, you may replace your AGI with your LUC. The sheet uses whichever is higher.',
                'Mobile Rank 1: each time you spend AP to move, it costs 1 less (minimum 0), and you ignore difficult terrain.',
                'Power Crafting: at most 8 dice per die step, and Sacrifice also stops you regaining HP until your next turn. Affected powers show "Recraft (Free)".',
                'Mythic Utilities in Power Crafter Step 5: Dominate, Vehicle Scale, Wish, Create a Sentient Being and Stop Time. Each is a flat 130 XP, not multiplied by Area of Effect or discounted by HP Capacity Pool. A Mythic power can\'t have other utilities, gets no refunds from Steps 6–8, pays double for Duration and AP, and skips Step 6 or 7 where the utility says so.',
                'Heavy ranged weapons show AGI in the ATT column.'
            ]],
            ['Inventory and Display', [
                'Ammo stacks: another bundle adds 20 rounds to your "Medium Ammo".',
                'Power Crafter Step 5 shows Minor and Moderate Utilities together in one column, and Major, Master and Mythic in the other.',
                'The perk list can show only the perks you own.',
                'Small text is larger everywhere, and a little larger again in the Fantasy theme. The line under the dice roller\'s Roll button stays in place as the log grows.'
            ]],
            ['Battle Maps', [
                'Measure with M (middle-drag still pans), see token numbers and conditions, and resize map windows from the corner grip.'
            ]]
        ],
        gm: [
            ['World Settings', [
                'A new World Settings tab sets the rules for every character in your world: Starting XP (default 25), Max GP (default 15), a starting Cu bonus, and Point Buy or Standard Array (7, 6, 5, 5, 5, 4, 3).',
                'Players in your world can\'t add their own XP or change Max GP. Use Grant XP, which applies each player\'s bonuses and logs the reason.',
                'Starting XP and Cu are given once, to fresh characters. Existing characters keep what they have.'
            ]],
            ['Loot', [
                'When an enemy dies in initiative, its weapons, armor, shield and helmet go to the Loot list under the tracker.',
                'Each item has a "Give to" menu of your party; it lands straight in that player\'s inventory. Remove anything you don\'t want to hand out.',
                'Currency follows Luck and Looting: the party finds LUC (Loot) × enemies defeated ÷ 2 (rounded down). The panel counts the enemies defeated since combat started (you can change it).',
                'Ask for a LUC (Loot) check: players\' sheets open the roll with the enemy count filled in, and each result appears in the Loot panel with its Cu. Press Use, then give the Cu to one player or split it among the party.',
                'Gear is your call: remove anything a headshot or fireball ruined before handing it out.',
                'Players can pass items to each other from their inventories.'
            ]],
            ['Loyal Companions', [
                'Companions appear under their owner in the Party panel with their stat block, portrait and a + Initiative button. Add Party places their tokens on the map too.',
                'In initiative a companion is an ally: its HP syncs with its owner\'s sheet, it isn\'t removed at 0 HP, and it doesn\'t take a share of combat XP.'
            ]],
            ['Initiative and Combat', [
                'Bleed Out is one clear row: "Bleeding Out: N rounds left" with − Round, + Round and Stabilize buttons.',
                'End Combat checks for players who are still Bleeding Out first. The XP award is the last line of the combat log.',
                'Combat log in the dice tray. Everyone sees damage and healing, but players see "Ari dealt damage to Goblin" with no number, so DR and ER can\'t be worked out; you see the amounts. Damage to players shows the amount for everyone. Every player check and save shows for you only (marked GM) and updates live with Luck or Omen. Hidden tokens show as "an unseen creature".',
                'Wound Threshold and Bleed Out rolls are matched automatically, Wound Threshold first: the player\'s next CON save resolves the wound against the DC (10, or half the damage), then their CON (Survive) check sets the Bleed Out rounds (half the result, minimum 1).',
                'AP is tracked for every creature and carries over. Surprised creatures gain just 1 AP on their first turn, including ones added mid-fight. Attacks rolled from a stat block spend that creature\'s AP.',
                'Conditions on NPCs and players include their linked conditions, and changes you make reach players\' sheets. Saved NPCs keep current HP in step with max HP, and NPCs join initiative at full HP.',
                'Messages go to Dice and Notifications. Click a party member\'s name for their full stat block.'
            ]],
            ['NPC Crafter', [
                'Shields (+2 AC/DR/ER, 4 TP, one hand) and Helmets (+1 AC/DR/ER, 2 TP). Stat blocks count free hands and have an Equip/Stow Shield button; two-handed attacks can\'t be rolled while the shield is up.',
                '+2 DR/ER [1 TP each] adds 2 per purchase.',
                'Maxed die-step and extra-dice buttons are disabled, so clicking them does nothing.',
                'XP rewards per Tier: 1 / 5 / 10 / 15 / 25 / 35 XP for Tiers 0–5, then +10 per Tier, divided among the players.',
                'Manufactured weapons and armor cost Threat Points, priced like the innate features they imitate.',
                'Power Crafter: at most 8 dice per die step, a warning when Sacrifice is combined with healing, Minor and Moderate utilities in one column, and Mythic Utilities (a flat 130 XP).'
            ]],
            ['Battle Maps', [
                'Shift+drag to select several tokens and move them together; right-click for group options.',
                'Movable images (carts, tower floors, overlays) with layers, size, lock, reveal and opacity. Players see the same layering.',
                'Token numbers, sizes from the character sheet, condition badges and companion tokens.',
                'Measure with M: squares count inclusively and snap to token corners; middle-drag pans while measuring.',
                'Fog: F toggles the fog painter and Clear asks first. The grid, fog and window resizing stay light on big maps; resize from the corner grip.'
            ]],
            ['World', [
                'Reveal toggles beside Edit on pins and on every sub-note in popups. Races stay with their own world, and locations can link NPCs.'
            ]],
            ['Fixes', [
                'Fixed auto-save errors (including on Brave) and the "write stream exhausted" error during long sessions.'
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
