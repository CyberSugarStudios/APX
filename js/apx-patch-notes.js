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
        version: 'v2026.9.24.0610',
        released: '2026-09-24T06:10:00',
        releasedText: 'September 24, 2026 · 6:10 AM',
        title: 'Playtest Update',
        intro: 'A big round of fixes and features from the latest playtests. Your characters and worlds update automatically. Nothing is lost, and anything whose rules changed tells you what changed when you open it.',
        index: [
            ['Combat', [
                'AP now follows the new rule (6 + half your AGI modifier, rounded down) and is tracked for everyone. Unspent AP carries over, attacks spend it automatically, and Surprised creatures get just 1 AP on their first turn.',
                'A dice roller on every page: click skills, saves, weapons, powers and stat block dice to roll, with perks, Advantage/Disadvantage, crits and Luck rerolls built in.',
                'New Rest and Recover buttons: Short and Full Rests, Shake it Off and Shrug It Off.'
            ]],
            ['Battle Maps', [
                'Select several tokens (Shift+drag), move them together, add movable images with layers, and measure distances with M.',
                'Much smoother maps: fog, grid, panning and window resizing no longer lag on big maps.'
            ]],
            ['Rules Updates', [
                'High Roller and Fortunate Fighter (Rank 1) rewritten; Regenerative and Mobile updated; Power Crafting now allows at most 8 dice per die step and adds Mythic Utilities (130 XP).',
                'Wound Threshold reminders with the CON save DC, and Permanent Injuries.',
                'NPC manufactured weapons and armor now cost Threat Points, and XP rewards for defeating NPCs follow the new Threat table (1 / 5 / 10 / 15 / 25 / 35 XP for Tiers 0–5, +10 per Tier after).'
            ]],
            ['Everything Else', [
                'Larger small text everywhere (and a bit more for the Fantasy theme), XP bonuses from INT, Educated and Expertise, conditions that apply their linked conditions, and many fixes.',
                'Open the Character Sheet or GM Tools for the full notes.'
            ]]
        ],
        sheet: [
            ['Action Points', [
                'Your AP is 6 + half your AGI modifier (rounded down, minimum 6), minus Fatigue.',
                'Unspent AP carries over with no cap. The tracker shows your AP plus one empty pip, and adds more as you bank AP. Click pips to spend or refund.',
                'In combat your AP pool empties when combat starts and fills when your turn comes up. If you were Surprised, you get only 1 AP on your first turn.',
                'Attacks spend their AP automatically. You get a popup when you Aim (Aim AP + attack AP), when a perk or feature might change the cost (Martial Arts, Flurry), or when you don\'t have enough AP.'
            ]],
            ['Dice Roller', [
                'Click any skill, save, attribute, weapon attack, damage, power or dice in a stat block to roll it. Conditions add Advantage or Disadvantage automatically.',
                'The d4–d100 buttons build a dice pool; a number in the box is added as a modifier; Roll rolls the pool and clears it.',
                'Critical hits multiply the number of damage dice.',
                'Spend a Luck Point to reroll a d20 right from the roll.',
                'Damage perks apply automatically: High Roller, Melee Prowess and Sharpshooter (Rank 2: roll damage twice, keep the higher; Rank 5: max critical damage on a confirmed crit), and a toggle for Instigator. Omen Dice are stored and usable from the roller.'
            ]],
            ['Rest and Recover', [
                'One Rest button: Short Rest (spend Rest Dice one at a time, each heals the die + your CON modifier; CHA Power Slots come back) or Full Rest (full HP, −1 Fatigue, half your max Rest Dice back, all Power Slots, Luck).',
                'New Recover button: Shake it Off (1 AP, roll up to half your max Rest Dice + CON each) and Shrug It Off (3 AP, heal one Wounded limb). Each is once per Short or Full Rest.',
                'Regenerative now costs 3 GP: at the start of your turn in combat, press Regen to expend a Rest Die and heal the roll.'
            ]],
            ['Conditions and Injuries', [
                'Remove any condition with the × on its tag under Vitals.',
                'Conditions apply the ones they include: Bleeding Out → Unconscious → Incapacitated (and you fall Prone), Paralyzed → Incapacitated, Diseased → Infected. Frenzy Rank 5 keeps you conscious while Provoked.',
                'Bleeding Out now shows on your sheet. Burning deals 1d10.',
                'Permanent Injuries: if a Wounded limb is Wounded again, press Re-wounded to choose an attribute to lower by 1. Remove it when it heals to get the point back.'
            ]],
            ['XP', [
                'XP from your GM arrives automatically with your bonuses: your INT modifier, Educated and Expertise. See it all in the new XP Log.'
            ]],
            ['Rules Changes', [
                'High Roller: a Gamble that hits deals +5 damage (+10 and 1 AP from Rank 4); Rank 2 rerolls 1s and 2s on damage; Rank 3 Luck rerolls can use Advantage or Disadvantage; Rank 5 is a Dice Explosion once per Full Rest.',
                'Fortunate Fighter Rank 1: when determining your AC, you may replace your AGI with your LUC. The sheet uses whichever is higher.',
                'Mobile Rank 1: each time you spend AP to move, it costs 1 less (minimum 0), and you ignore difficult terrain.',
                'Power Crafting: at most 8 dice per die step, and Sacrifice now also stops you regaining HP until your next turn. Affected powers show "Recraft (Free)".',
                'New Mythic Utilities in Power Crafter Step 5 (now shown in two columns): Dominate, Vehicle Scale, Wish, Create a Sentient Being and Stop Time. Each is a flat 130 XP, not multiplied by Area of Effect or discounted by HP Capacity Pool. A Mythic power can\'t have other utilities, gets no refunds from Steps 6–8, pays double for Duration and AP, and skips Step 6 or 7 where the utility says so.',
                'Loyal Companions: manufactured weapons and armor now count against your companion\'s TP.',
                'Heavy ranged weapons show AGI in the ATT column.'
            ]],
            ['Inventory and Display', [
                'Ammo now stacks: buying another bundle adds 20 rounds to your "Medium Ammo" (older duplicate stacks were merged).',
                'The perk list can show only the perks you own.',
                'Small text is larger everywhere, and a little larger again in the Fantasy theme.'
            ]],
            ['Your World and Maps', [
                'A Party tab shows your allies, and map pins open popups with their details.',
                'Battle maps: measure with M (middle-drag still pans), see token numbers and conditions, and resize map windows from the corner grip.'
            ]]
        ],
        gm: [
            ['Initiative and Combat', [
                'Click a party member\'s name for their full stat block; the Party panel shows stat blocks too.',
                'AP is tracked for every creature and carries over between turns. Surprised creatures gain just 1 AP on their first turn of combat, including ones added mid-fight.',
                'Attacks rolled from an NPC stat block spend that creature\'s AP (the one whose turn it is, when several share a stat block). Without enough AP it still rolls, with a note.',
                'Damage above a player\'s Wound Threshold shows a reminder with the CON save DC (10, or half the damage).',
                'Conditions on NPCs and players include their linked conditions; changes you make reach players\' sheets.',
                'New Grant XP button; XP splits include each player\'s bonuses.'
            ]],
            ['Battle Maps', [
                'Shift+drag to select several tokens and move them together; right-click for group options.',
                'Add movable images (carts, tower floors, overlays) with layers, size, lock, reveal and opacity. Players see the same layering.',
                'Token numbers, sizes taken from the character sheet, and condition badges.',
                'Measure with M: squares count inclusively and snap to token corners; middle-drag pans while measuring.',
                'Fog: F toggles the fog painter, Clear asks first, and painting no longer flickers.',
                'Performance: the grid, fog and window resizing are much lighter. Resize from the corner grip (it shows an outline and applies on release).'
            ]],
            ['World', [
                'Reveal toggles beside Edit on pins, and on every sub-note in the popups.',
                'Races stay with their own world; locations can link NPCs; Add Party brings in your players.'
            ]],
            ['NPC Crafter', [
                'New XP rewards per Tier: 1 / 5 / 10 / 15 / 25 / 35 XP for Tiers 0–5, then +10 per Tier (divided evenly among the players). Combats already in the tracker use the new values too.',
                'Manufactured weapons and armor cost Threat Points, priced like the innate features they imitate.',
                'Power Crafter: at most 8 dice per die step, a warning when Sacrifice is combined with healing, Step 5 utilities in two columns, and the new Mythic Utilities (a flat 130 XP, not multiplied by Area of Effect).'
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
