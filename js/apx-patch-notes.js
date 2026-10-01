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
        version: 'v2026.10.1.1200',
        released: '2026-10-01T12:00:00',
        releasedText: 'October 1, 2026 · 12:00 PM',
        title: 'Playtest 2 Update',
        intro: 'This update works through every note from our second playtest. The tools now need an account, and a short tutorial greets new players and GMs. Powers have been reworked: each power has its own Core Attribute, and the two power perks are now Full Rest Powers and Short Rest Powers. NPCs get Wound Thresholds and Wounds, caster slots and damaging auras. Combat gets fall damage, AP-priced movement paths, and Cone and Burst measuring. There is a chat at the bottom of the dice tray, a Library for everything a GM makes, and the forges now roll in the dice tray with Luck Points and spell out every cost. Characters bring themselves up to date when opened, and nothing is lost.',
        index: [
            ['Accounts', [
                'The Player and GM Tools now need a free APX account. Sign in on the front page to open them.',
                'New players and GMs get a short tutorial the first time they open the tools. Open it again any time from Settings → Show Tutorial.',
                'Patch notes, the tutorial and your saved colours belong to your account, so they follow you to every device. Patch notes only appear when you\'re signed in.'
            ]],
            ['For GMs', [
                'NPCs have a Wound Threshold, (5 + CON mod) × 2, and take Wounds just as players do.',
                'NPC casters have Power Slots in the tracker and on their stat block, and auras like Damaging Aura show as a ring on the map and deal their damage each turn.',
                'Fall damage, conditions on players straight from the tracker, and Cone and Burst areas that list who\'s inside.',
                'A Library keeps every item, weapon, armor, consumable and power you make, tagged by world, ready to reuse.',
                'Grid colour, thickness and opacity, token sizes for players and NPCs, and loot you can grant without the rest of the party seeing.'
            ]],
            ['For Players', [
                'Powers rework: every power has its own Core Attribute, chosen when you craft it. Full Rest Powers (formerly INT) and Short Rest Powers (formerly CHA) are now two pools you can mix.',
                'You have one character in each world, and your GM\'s Race Templates update your Race Builder live.',
                'The Weapon and Armor Forges roll their Craft check in the dice tray, so Luck Points and Omens work on it, and show exactly what buying or crafting costs.',
                'Your Currency shows in every screen that spends it, and in combat your movement path shows its AP cost as you drag.'
            ]],
            ['At the Table', [
                'Chat at the bottom of the dice tray: message everyone, just the GM, or any players you pick.',
                'Your checks and saves reach your GM\'s notifications, in combat or out.',
                'Ammo effects show on the roll, and popups always open in front of the dice tray.'
            ]],
            ['Rules', [
                'NPC AP: +1 AP now costs 6 TP (was 3), at most +1 per Tier (Tier 0 counts as 1).',
                'A Medium weapon used two-handed steps its die size up: 2d8 becomes 2d10.',
                'Brute\'s carry capacity now stacks with your race\'s size: each step doubles it again.',
                'Attributes bought with XP no longer change your base attributes.'
            ]]
        ],
        sheet: [
            ['Getting Started', [
                'The Character Sheet needs an account now. Signed out, you\'re sent to sign in.',
                'A short tutorial covers the basics the first time you open the sheet: character creation is Race Builder, then Origin, then Spend XP. It also covers rolling, shortcuts and worlds. Reopen it from Settings → Show Tutorial. Patch Notes are there too.',
                'Patch notes remember that you\'ve seen them on your account, not in the browser.'
            ]],
            ['Character Creation', [
                'Race Templates from your GM update the Race Builder as soon as the GM saves them, with a notification.',
                'Save & Apply in the Race Builder sends you to Step 4 when training is still missing, and asks before saving with Genetic Points left unspent.',
                'Attributes bought with XP (and injuries) are now kept apart from your base attributes, so rebuilding your race never loses them. Existing characters are converted the first time you open them.',
                'One character per world: joining or moving a character into a world that already has one asks whether to archive or delete the old one.',
                'Rejoining a world after being kicked recreates its folder.',
                'Encyclopedia\'s header rolls "Encyclopedia - Generic (No Training)".'
            ]],
            ['Powers', [
                'Every power has its own Core Attribute, picked in the Power Crafter. Its attack and DC show on the power card.',
                'Full Rest Powers (formerly INT Powers) give Power Slots that come back after a Full Rest; Short Rest Powers (formerly CHA Powers) give uses that come back after a Short Rest. Each power belongs to one pool, and when one is empty you\'re offered the other.',
                'A Full Rest power can use a slot of its Level or higher.',
                'Existing powers keep the attribute and pool they used before.',
                'The custom item maker now matches the GM\'s: several stat rows and powers on one item.'
            ]],
            ['Combat', [
                'AP perks (Adrenaline, Relentless) add their AP at the start of combat, and New Turn no longer gives AP twice.',
                'Drag your token in combat to see your path and what it costs in AP (1, then 2, then 3… per Move); it\'s paid when you drop. Hold Alt to move freely.',
                'When nothing says what damage type hit you, a chooser asks, including damage on your own turn.',
                'Powers that deal half damage on a save use the damage type of the power that hit you, not an earlier one.',
                'Your checks and saves reach your GM\'s notifications, in combat or out.',
                'Ammo effects (Light, Medium, Heavy) show as badges on the roll.',
                'Popups now open in front of the dice tray.'
            ]],
            ['Gear and Crafting', [
                'The Weapon and Armor Forges are rebuilt: pick where you\'re working (your Workbench, a rented one at 100 Cu an hour, or a Toolkit with Disadvantage), see the value, materials, time, rent and what each result costs, then roll the Craft check in the dice tray. A Luck Point or Omen spent on that roll updates the result before you apply it.',
                'Each forge shows what you\'d have left after buying, or what crafting it would take instead.',
                'Your Currency shows at the top of every screen that spends it.',
                'A Medium weapon used two-handed now steps its die size up (2d8 becomes 2d10).',
                'Brute\'s carry capacity bonus stacks with your race\'s size modifier.'
            ]],
            ['Worlds and Maps', [
                'Chat at the bottom of the dice tray: send to All (GM included), just the GM, or any players you pick.',
                'Click a token on the map to see its picture (never its stats). NPCs your GM has revealed show their pictures in the World viewer.',
                'Discoveries include the notes your GM reveals on maps.',
                'Area Circles under fog stay hidden and can\'t be clicked.',
                'When your GM stops sharing a map, its window closes for you.',
                'If your GM deletes a world, your characters in it are archived, not lost.',
                'Measure has Line, Cone and Burst modes; right-click drops a waypoint.',
                'Pictures keep their shape when you resize their windows.'
            ]],
            ['Also', [
                'Colour pickers remember your recent colours: click one to use it, hover it for an X to remove it.',
                'The Notes panel is now as tall as Vitals and Defenses.',
                'The Kawaii theme\'s Luck and Omen buttons are readable again.'
            ]]
        ],
        gm: [
            ['Getting Started', [
                'The GM Tools need an account now.',
                'A tutorial walks through worlds, NPCs, combat, maps, loot and notes, plus what the tools can and can\'t do. Reopen it from Settings → Show Tutorial.',
                'Patch notes remember that you\'ve seen them on your account.'
            ]],
            ['Library', [
                'Everything you make (Loot Maker items, forged weapons and armor, consumables and NPC powers) goes into your Library, tagged with the world you made it in.',
                'Reuse it anywhere: the Loot Maker\'s Library view, and the NPC power picker. Tick "All worlds" to see what you made elsewhere, or tag an entry with more worlds.'
            ]],
            ['NPCs', [
                'NPC Wound Thresholds, (5 + CON mod) × 2: a hit that big asks for a CON save, and a failure rolls a Wound. Wounds show on the tracker and can be healed. Leg wounds stagger, and a torso wound adds a die to hits.',
                'NPC caster slots appear in the tracker and on the stat block. Powers can use a new "Power Slot" usage, which spends a slot of its Level or higher.',
                'Damaging Aura (and other auras) show as a coloured ring on the map and deal their damage to everyone inside at the end of the NPC\'s turn. Traits like Death Burst let you pick the energy type.',
                'Ranged weapons show their range on the stat block.',
                '+1 AP for NPCs now costs 6 TP, at most +1 per Tier (Tier 0 counts as 1).'
            ]],
            ['Combat', [
                'NPCs that share a stat block now act as whoever\'s turn it is, not whichever stat block window you opened.',
                'Damage types come from the current turn\'s attack only: no more save-half powers using an earlier damage type, and a type chooser when there\'s no attack, including damage on a creature\'s own turn.',
                'Fall damage (⤓ Fall in the tracker, or the token menu): 1d10 per square after the first, with the Acrobatics reaction, Soft Landing and Defensive taken off, and Prone on any damage.',
                'Click a player\'s conditions in the tracker to add or remove them; they reach the player\'s sheet.',
                'Players\' Power Slots show on their stat blocks, and their checks and saves show in your notifications.',
                'The current NPC\'s token shows its movement path and AP cost as you drag it, and pays the AP when dropped (Alt moves freely).',
                'Turn-start AP is never given twice.',
                '"No map" combat no longer uses a map that was closed.'
            ]],
            ['Maps', [
                'Grid colour, thickness and opacity, saved with each map. Colour pickers remember recent colours.',
                'Resize player and NPC tokens; "Sheet size" puts a player\'s token back.',
                'Measure: right-click drops a waypoint, and Cone and Burst modes list every token inside.',
                'Area Circles under fog are hidden from players.',
                'Stopping sharing a map closes it on your players\' screens.',
                'The map window\'s X stays in its corner, and popups open beside the map, in front of the dice tray.',
                'Pictures keep their shape when you resize their windows.'
            ]],
            ['Notes and Worlds', [
                'Session Notes support bullets and bold, and open in a read view with an Edit button.',
                'Deleting a subnote no longer wipes another one you were still typing.',
                'Revealed map notes appear in your players\' Discoveries, and revealed NPCs show their pictures.',
                'Deleting a world archives your players\' characters in it, and a kicked player who rejoins gets their world folder back.'
            ]],
            ['Loot and Chat', [
                'Loot boxes and gifts have a hide toggle: a hidden grant isn\'t announced to the rest of the party.',
                'The Weapon and Armor Forges roll in the dice tray and spell out every cost.',
                'Chat at the bottom of the dice tray. You see your world\'s whole chat, and Clear chat deletes it. Messages older than a week are tidied up. Chat needs the updated Firestore rules (FIREBASE_RULES.txt, v2026.10.1).'
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
