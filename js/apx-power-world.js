// ============================================================
// APX Powers in play: targets in range, durations, and what a power leaves on the battle map
// ============================================================
// Loaded on both pages. Using a power (a player's, a Loyal Companion's, an NPC's or a summon's):
//   1. Targets: the creatures on the battle map within the power's range (and in sight) are listed to pick
//      from. An area power's targets are the creatures in its area (placed first). No map open: as before.
//   2. What the Utilities do on the map, placed or drawn before anything is spent:
//      Teleport / Move the target (a free square within reach, not through walls), a zone of blinding
//      (Darkness, Fog or Light: Blinded while inside), Difficult or hazardous terrain over the power's area, a
//      wall drawn square by square (Solid: blocks like a wall; Hazardous: its damage to pass through), a
//      Sensor (an origin for your powers: AC 10, 10 HP once it's used).
//   3. A lasting power is an instance (pi) for its whole duration: everything it does carries its id, and
//      ending it (its time runs out on the initiative, a rest long enough, End Power or the Active bubble,
//      a dispel, Concentration lost) ends all of it: buffs, Conditions, map effects, the Sensor.
// Durations on the initiative: 1 round = 6 seconds, so 1 Minute is 10 of the creature's turns, 10 Minutes
// 100, 1 Hour 600… Outside combat nothing counts down: the Active bubble (or End Power) ends it, and a Short
// Rest (1 hour) or Full Rest (8 hours) ends what wouldn't last that long.
// The GM's page is the authority for the map: a player's power sends what it did (ev.mapFx, ev.moves,
// ev.resize…) and the GM's tracker puts it on the map, applies it, and takes it away again.
// ============================================================
(function () {
    'use strict';
    const GM = /GMTools/i.test(location.pathname);
    const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const rid = p => (p || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const B = () => window.APXBattle;

    // ── Durations ──
    const DUR_TURNS = { instant: 2, '1min': 10, '10min': 100, '1hr': 600, '8hr': 4800, '24hr': 14400, channel: 10 };
    const DUR_HOURS = { instant: 0, '1min': 1 / 60, channel: 1 / 60, '10min': 1 / 6, '1hr': 1, '8hr': 8, '24hr': 24 };
    // Turns of the creature it's on (counted at the start of each of its turns); null: not counted (Permanent)
    window.apxDurTurns = dur => { dur = dur || 'instant'; return Object.prototype.hasOwnProperty.call(DUR_TURNS, dur) ? DUR_TURNS[dur] : null; };
    // Is it over after this many hours (a rest)?
    window.apxDurOverAfter = (dur, hours) => { dur = dur || 'instant'; return Object.prototype.hasOwnProperty.call(DUR_HOURS, dur) && DUR_HOURS[dur] <= hours; };
    const DUR_TEXT = { instant: 'until the end of the target\'s next turn', '1min': '1 Minute', '10min': '10 Minutes', '1hr': '1 Hour', '8hr': '8 Hours', '24hr': '24 Hours', channel: 'Channeling', permanent: 'Permanent' };
    window.apxDurText = dur => DUR_TEXT[dur || 'instant'] || dur;

    // ── What a power does ──
    function uc(d, key) { let u = (d && d.utility) || {}; for (let t of ['minor', 'moderate', 'major', 'master', 'mythic']) if (u[t] && u[t][key]) return u[t][key]; return 0; }
    function pk(key, n) { return window.apxCondPickKeys ? window.apxCondPickKeys(key, n) : Array.from({ length: n }, (_, i) => i ? key + '#' + (i + 1) : key); }
    function pick(d, k) { return (d.utilPicks || {})[k]; }
    function dice(d) { return ['d4', 'd6', 'd8', 'd10', 'd12'].reduce((t, k) => t + (parseInt((d.dmg || {})[k]) || 0), 0); }
    window.apxPowerPlay = function (d, lvl) {
        d = d || {};
        let si = window.apxPowerSaveInfo ? window.apxPowerSaveInfo(d) : { inflicts: [], ends: [], saveKind: null };
        let nd = dice(d), buff = window.apxPowerBuff ? window.apxPowerBuff(d, lvl) : null;
        let sw = window.apxSwCount ? window.apxSwCount(d) : 0;
        let r = {
            dmg: nd > 0 && !d.isHealing && !uc(d, 'weaponDmgAdd') && !sw,
            heal: nd > 0 && !!d.isHealing,
            save: si.saveKind || null,
            inflicts: (si.inflicts || []).filter(c => c !== 'wounded'), ends: si.ends || [],
            buff, attack: d.step1 === 'atkSave' && d.atkMode !== 'save',
            teleport: 3 * uc(d, 'teleport3') + 10 * uc(d, 'teleport10'), push: 2 * uc(d, 'move2'),
            resize: uc(d, 'resizeOne') ? (pick(d, 'resizeOne') || 'grow') : null,
            wpnDmg: !!uc(d, 'weaponDmgAdd') && nd > 0, drain: !!uc(d, 'dmgHeals') && nd > 0 && !d.isHealing,
            dispel: !!uc(d, 'dispel'),
            zones: pk('lightDark', uc(d, 'lightDark')).map(k => pick(d, k) || 'dark'),
            walls: pk('wall', uc(d, 'wall')).map(k => pick(d, k) || 'solid'),
            terrain: !!uc(d, 'difficultTerrain'), hazard: !!uc(d, 'hazardTerrain'), sensor: !!uc(d, 'sensor'),
            invisible: !!uc(d, 'invisible'), conc: !!(d.refunds && d.refunds.concentration),
            split: window.apxPowerAoe ? window.apxPowerAoe(d).key === 'split' : d.aoe === 'split',
            aoe: window.apxPowerAoe ? window.apxPowerAoe(d).key === 'aoe' : false,
            dur: d.duration || 'instant'
        };
        r.harmful = !!(r.dmg || r.inflicts.length || (r.save && !r.heal) || (buff && buff.harmful) || r.drain);
        r.targeted = !!(r.dmg || r.heal || r.save || r.inflicts.length || r.ends.length || buff || r.teleport || r.push || r.resize || r.wpnDmg || r.dispel || r.attack);
        r.mapFx = !!(r.zones.length || r.walls.length || r.terrain || r.hazard || r.sensor);
        return r;
    };
    // Does it do something good for its target (healing, or beneficial Utilities)? Overexertion can then give the
    // target the Fatigue instead of the power's user (not a power that only deals damage, debuffs or harms).
    window.apxPowerBeneficial = function (d) {
        d = d || {};
        let p = window.apxPowerPlay(d, 1), b = p.buff;
        let good = b && !!(b.ac || b.dr || b.er || b.speed || b.atk || b.save || b.skill || b.tempHp || b.apMove || b.apTurn || b.fly || b.swim || b.climb || b.hover
            || b.noAoO || b.featherFall || (b.immune || []).length || b.invisible || b.fatigue < 0 || b.fatigueZero || (b.endConds || []).length || b.endWounds);
        return !!(p.heal || good || (p.ends || []).length || p.wpnDmg || p.invisible);
    };
    // Overexertion's Fatigue: 'self' (the power's user) or 'target'
    window.apxOxWho = d => (d && d.refunds && d.refunds.overexertion && d.oxWho === 'target' && window.apxPowerBeneficial(d)) ? 'target' : 'self';
    // Range in squares (Touch / Self: adjacent; Line of Sight / a weapon's range: anywhere in sight)
    window.apxPowerReach = function (p, who) {
        let d = (p && p.draft) || {}, R = window.apxPowerRange ? window.apxPowerRange(d) : { sq: 0 };
        let sq = p && p.thrownRange != null ? p.thrownRange : R.sq;
        if (R.thrown) sq = who === 'player' && typeof calc !== 'undefined' && calc.scores ? (calc.scores.STR || 5) * 2 : 20;
        if (R.weapon || R.ammo || sq == null) sq = Infinity;
        if (who === 'player' && window.apxExoRange && isFinite(sq)) sq = window.apxExoRange(sq);
        return sq === Infinity ? Infinity : Math.max(1, sq || 0);   // (Touch reaches the squares next to you)
    };

    // ── Battle maps: which one, who's on it ──
    function myUid() { return (window.apxAuth && window.apxAuth.user && window.apxAuth.user.uid) || ''; }
    function sheetMaps() { return ((window._playerWorldData || {}).notesV2 || {}).otherMaps || []; }
    function gmMaps() { return (typeof _wNotes !== 'undefined' && _wNotes ? _wNotes.otherMaps : null) || []; }
    window.apxMapById = id => (GM ? gmMaps() : sheetMaps()).find(m => m.id === id) || null;
    function winOf(mapId) { return (GM ? 'omWin_' : 'pwOmWin_') + mapId; }
    function openOnScreen(m) { let l = document.getElementById(winOf(m.id) + '_btScreen'); return !!(m.battleMapEnabled && l && l._opts); }
    // The caster's token on an open battle map. More than one: asked which. → { winId, mapId, tokenId, map } | null | 'cancel'
    // casterTok(map) finds the caster's token on a map
    window.apxPowerMapCtx = async function (casterTok, title) {
        let list = (GM ? gmMaps() : sheetMaps()).filter(openOnScreen).map(m => { let t = casterTok(m); return t ? { winId: winOf(m.id), mapId: m.id, tokenId: t.id, map: m, name: m.name } : null; }).filter(Boolean);
        if (!list.length) return null;
        if (list.length === 1 || !window.APXDice || !APXDice.ask) return list[0];
        let last = window._apxLastPowerMap, i0 = Math.max(0, list.findIndex(c => c.mapId === last));
        let order = [list[i0]].concat(list.filter((c, i) => i !== i0));
        let a = await APXDice.ask(title || 'Which battle map?', 'Your token is on more than one open battle map. Use it on:', order.map((c, i) => ['m' + i, c.name || 'Battle map', i ? '' : 'pri']));
        if (!a) return 'cancel';
        let c = order[+a.slice(1)]; window._apxLastPowerMap = c.mapId; return c;
    };
    // The player's own token / companion token
    window.apxMyTokOn = (m, companion) => { let me = myUid(); return me ? (m.battleTokens || []).find(t => companion ? (t.type === 'companion' && t.playerUid === me) : (t.type === 'player' && t.playerUid === me)) : null; };
    function posFoot(mapId, t) {
        let p = B().posOf(mapId, t), sp = B().span(p.sq || t.size || 'medium');
        return { x0: p.gridX, y0: p.gridY, x1: p.gridX + sp - 1, y1: p.gridY + sp - 1 };
    }
    window.apxTokFoot = posFoot;
    // Walls for sight and movement: the map's own and the solid walls powers made
    function mapWalls(m) { return (m.walls || []).concat(window.apxPowerWallSegs ? window.apxPowerWallSegs(m) : []); }
    window.apxPowerWallSegs = function (m) {
        let out = [];
        (m && m.powerFx || []).forEach(f => { if (f.kind === 'wall' && f.sub !== 'hazard' && B() && B().cellWalls) out = out.concat(B().cellWalls(f.cells || [], f.id)); });
        return out;
    };
    // The squares a power made difficult (its terrain, and a hazardous wall's)
    window.apxPowerDifficult = function (m) {
        let out = [];
        (m && m.powerFx || []).forEach(f => { if (f.kind === 'terrain' || (f.kind === 'wall' && f.sub === 'hazard')) (f.cells || []).forEach(c => out.push(c[0] + ',' + c[1])); });
        return out;
    };
    function canSee(t) {
        if (GM) return true;
        if (t.revealed === false) return false;
        let mine = t.playerUid === myUid() || t.ownerUid === myUid();
        if ((t.sensorHidden || t.invisible) && !mine) return false;
        return true;
    }
    // The creatures on the map a power can reach from the token `fromId`: [{ t, d (squares), self }]
    window.apxTargetsInReach = function (ctx, fromId, reach, o) {
        o = o || {};
        let m = ctx.map, from = (m.battleTokens || []).find(t => t.id === fromId);
        if (!from || !B()) return [];
        let ff = posFoot(ctx.mapId, from), ws = mapWalls(m), out = [];
        (m.battleTokens || []).forEach(t => {
            if (t.sensor || !canSee(t) || t._dead) return;
            let self = t.id === (o.selfId || fromId);
            if (self && !o.allowSelf) return;
            let tf = posFoot(ctx.mapId, t), dist = t.id === fromId ? 0 : B().footDist(ff, tf);
            if (!self && reach !== Infinity && dist > reach) return;
            if (!self && t.id !== fromId && !B().footSight(ws, ff, tf)) return;
            out.push({ t, d: dist, self });
        });
        return out.sort((a, b) => (b.self ? 1 : 0) - (a.self ? 1 : 0) || a.d - b.d);
    };

    // ── Picking targets ──
    // o: { title, msg, ctx, fromId (where the range is measured from), selfId, reach, max (1, or Infinity), allowSelf,
    //      harmful, other: label for "someone not on the map" }
    // → { list: [{ tokenId, name, self, t }], mapId } | { other: true } | null (cancelled)
    window.apxPickTargets = function (o) {
        let rows = window.apxTargetsInReach(o.ctx, o.fromId, o.reach, { allowSelf: o.allowSelf, selfId: o.selfId });
        return new Promise(resolve => {
            if (window.apxInjectDialogStyles) window.apxInjectDialogStyles();
            document.getElementById('apxTgPick')?.remove();
            let col = { player: '#60a5fa', ally: '#4ade80', neutral: '#e2e8f0', enemy: '#f87171' };
            let multi = o.max == null || o.max > 1, rTxt = o.reach === Infinity ? 'in sight' : `within ${o.reach} square${o.reach === 1 ? '' : 's'}`;
            let back = document.createElement('div');
            back.id = 'apxTgPick'; back.className = 'apxdlg-back'; back.style.zIndex = 2147483300;
            back.innerHTML = `<div class="apxdlg" style="width:min(400px,100%)"><div class="apxdlg-title">${esc(o.title || 'Targets')}</div>
                <div class="apxdlg-msg">${esc(o.msg || (multi ? `Who does it target? Creatures ${rTxt} you can see.` : `Who does it target? A creature ${rTxt} you can see.`))}</div>
                <div style="display:flex;flex-direction:column;gap:.25rem;max-height:46vh;overflow-y:auto;margin-bottom:.8rem">
                ${rows.length ? rows.map((r, i) => `<label style="display:flex;align-items:center;gap:.45rem;font-size:.78rem;cursor:pointer;padding:.15rem .2rem;border-radius:.3rem">
                    <input type="${multi ? 'checkbox' : 'radio'}" name="apxTg" data-tg="${i}" ${!multi && i === 0 ? 'checked' : ''}>
                    <span style="flex:1;font-weight:700;color:${col[r.t._faction || r.t.faction || (r.t.type === 'player' ? 'player' : 'enemy')] || '#e2e8f0'}">${esc(r.self ? `${r.t.name || 'You'} (you)` : (r.t.name || 'Creature'))}</span>
                    <span style="font-size:.66rem;color:#94a3b8">${r.self ? '' : r.d + ' sq'}</span></label>`).join('')
                    : `<div style="font-size:.72rem;color:#94a3b8">No one you can see is ${rTxt}.</div>`}
                </div><div class="apxdlg-row" style="flex-wrap:wrap"><button class="apxdlg-btn" data-x>Cancel</button><button class="apxdlg-btn" data-other style="background:var(--c-surface2,#1e293b);color:inherit">${esc(o.other || 'Not on the map (my GM applies it)')}</button>${rows.length ? `<button class="apxdlg-btn apxdlg-ok" data-ok>Target</button>` : ''}</div></div>`;
            let done = v => { back.remove(); resolve(v); };
            back.querySelector('[data-x]').onclick = () => done(null);
            back.querySelector('[data-other]').onclick = () => done({ other: true });
            let ok = back.querySelector('[data-ok]');
            if (ok) ok.onclick = () => {
                let pickd = [...back.querySelectorAll('[data-tg]')].filter(c => c.checked).map(c => rows[+c.dataset.tg]);
                if (!pickd.length) return;
                if (o.max && pickd.length > o.max) pickd = pickd.slice(0, o.max);
                done({ mapId: o.ctx.mapId, list: pickd.map(r => ({ tokenId: r.t.id, name: r.t.name || 'Creature', self: r.self, t: r.t })) });
            };
            back.addEventListener('mousedown', e => { if (e.target === back) done(null); });
            document.body.appendChild(back);
        });
    };

    // ── Split Target: its damage or healing dice divided die by die, its Utilities on up to N targets ──
    const STEPS = ['d4', 'd6', 'd8', 'd10', 'd12'];
    // The power's dice in order (a second damage type's dice last): [{ size: 'd6', type: 'Fire' }]
    window.apxSplitDice = function (d, chosen) {
        d = Object.assign({}, d || {}, chosen || {});
        let sc = d.addSecondType && !d.isHealing && window.apxSplitCounts ? window.apxSplitCounts(d) : {}, a = [], b = [];
        let t1 = d.isHealing ? '' : (d.dmgType || 'Fire'), t2 = d.secondDmgType || 'Cold';
        STEPS.forEach(st => { let c = Math.max(0, parseInt((d.dmg || {})[st]) || 0), k = Math.min(c, sc[st] || 0); for (let i = 0; i < c - k; i++) a.push({ size: st, type: t1 }); for (let i = 0; i < k; i++) b.push({ size: st, type: t2 }); });
        return a.concat(b);
    };
    // One target's share as damage parts: [{ formula: '2d4+2', type }] (o.flat: +1 a die; o.attr: added to the first part;
    // o.crit: dice × o.critMult)
    window.apxSplitParts = function (dice, o) {
        o = o || {};
        let by = {}, order = [];
        (dice || []).forEach(x => { let k = x.type || ''; if (!by[k]) { by[k] = []; order.push(k); } by[k].push(x.size); });
        let mult = o.crit ? Math.max(2, parseInt(o.critMult) || 2) : 1;
        let parts = order.map(k => {
            let arr = by[k], f = STEPS.map(st => { let c = arr.filter(x => x === st).length; return c ? (c * mult) + st : ''; }).filter(Boolean).join('+');
            if (o.flat) f += '+' + arr.length;
            return { formula: f, type: k };
        });
        if (parts.length && o.attr) parts[0].formula += (o.attr > 0 ? '+' : '') + o.attr;
        return parts;
    };
    // Each target's dice from the picker's counts, in order: { tokenId: [dice] }
    window.apxSplitAssign = function (dice, list) {
        let out = {}, i = 0;
        (list || []).forEach(x => { let k = Math.max(0, parseInt(x.dice) || 0); if (!k) return; out[x.tokenId] = (out[x.tokenId] || []).concat(dice.slice(i, i + k)); i += k; });
        return out;
    };
    // Rolls each target's share in the dice tray. o: { name, who, assign: { tokenId: [dice] }, names: { tokenId: name }, flat,
    // extraFirst (the attribute bonus, Medic…: once, on the first target), heal, crit, critMult, maxDmg, note, apNote, apWarn, flavor }
    // → { total, byTok: { tokenId: total }, parts: { tokenId: [{ type, dmg }] } }
    window.apxSplitRoll = function (o) {
        let out = { total: 0, byTok: {}, parts: {} }, first = true;
        Object.keys(o.assign || {}).forEach(tid => {
            let dice = o.assign[tid]; if (!dice || !dice.length) return;
            let parts = window.apxSplitParts(dice, { flat: o.flat, attr: first ? (o.extraFirst || 0) : 0, crit: o.crit, critMult: o.critMult });
            let nm = (o.names || {})[tid] || 'a target';
            let card = window.APXDice ? APXDice.damage({ label: `${o.name || 'Power'} → ${nm} (${dice.length} ${dice.length === 1 ? 'die' : 'dice'})`, who: o.who, formula: parts.map(x => x.formula).join('+'),
                dmgType: o.heal ? '' : parts.map(x => x.type).filter(Boolean).join(' + '), heal: o.heal || undefined, wcat: 'power', maxDmg: o.maxDmg || undefined, breachNote: o.breachNote || undefined, crit: o.crit || undefined,
                split: parts.length > 1 ? parts : undefined, apNote: first ? o.apNote : undefined, apWarn: first ? o.apWarn : undefined, note: first ? (o.note || null) : null, flavor: first ? o.flavor : undefined }) : null;
            let dp = card && Array.isArray(card.parts) ? card.parts.filter(x => x.kind === 'dmg') : [];
            let tot = dp.reduce((t, x) => t + (x.total || 0), 0);
            out.byTok[tid] = tot; out.total += tot;
            if (parts.length > 1) out.parts[tid] = dp.map((x, i) => ({ type: (parts[i] || {}).type, dmg: x.total }));
            first = false;
        });
        return out;
    };
    // The picker. o: { title, ctx, fromId, selfId, reach, allowSelf, nDice, diceText, utilN, heal, other }
    // → { mapId, list: [{ tokenId, name, self, t, dice, util }] } | { other: true } | null
    window.apxPickSplit = function (o) {
        let rows = window.apxTargetsInReach(o.ctx, o.fromId, o.reach, { allowSelf: o.allowSelf, selfId: o.selfId });
        let nD = Math.max(0, o.nDice || 0), nU = Math.max(0, o.utilN || 0);
        return new Promise(resolve => {
            if (window.apxInjectDialogStyles) window.apxInjectDialogStyles();
            document.getElementById('apxSplitPick')?.remove();
            let st = rows.map(() => ({ dice: 0, util: false }));
            let back = document.createElement('div');
            back.id = 'apxSplitPick'; back.className = 'apxdlg-back'; back.style.zIndex = 2147483300;
            let rTxt = o.reach === Infinity ? 'in sight' : `within ${o.reach} square${o.reach === 1 ? '' : 's'}`;
            let left = () => nD - st.reduce((t, x) => t + x.dice, 0), utils = () => st.filter(x => x.util).length;
            let btn = (a, i, t, on) => `<button type="button" data-${a}="${i}" ${on ? '' : 'disabled'} style="width:1.4rem;height:1.4rem;border-radius:.3rem;border:0;font-weight:900;cursor:${on ? 'pointer' : 'default'};background:${on ? (a === 'up' ? '#b45309' : '#334155') : '#1e293b'};color:${on ? '#fff' : '#475569'}">${t}</button>`;
            let draw = () => {
                back.innerHTML = `<div class="apxdlg" style="width:min(460px,100%)"><div class="apxdlg-title">${esc(o.title || 'Split Target')}</div>
                    <div class="apxdlg-msg">${nD ? `Pick a target for each of its ${nD} ${o.heal ? 'healing' : 'damage'} dice (${esc(o.diceText || nD + ' dice')}): one creature can take several. Dice with no target are lost.` : ''}${nD && nU ? ' ' : ''}${nU ? `Its Utilities${o.hasSave ? ' (and their saves)' : ''} reach up to ${nU} creature${nU === 1 ? '' : 's'}: tick them.` : ''} Creatures ${rTxt} you can see.</div>
                    <div style="display:flex;flex-direction:column;gap:.2rem;max-height:46vh;overflow-y:auto;margin-bottom:.5rem">
                    ${rows.length ? rows.map((r, i) => `<div style="display:flex;align-items:center;gap:.45rem;font-size:.78rem;padding:.15rem .2rem;border-radius:.3rem;background:${st[i].dice || st[i].util ? 'rgba(126,34,206,.18)' : 'transparent'}" data-row="${i}">
                        <span style="flex:1;font-weight:700">${esc(r.self ? `${r.t.name || 'You'} (you)` : (r.t.name || 'Creature'))} <span style="font-size:.64rem;color:#94a3b8;font-weight:400">${r.self ? '' : r.d + ' sq'}</span></span>
                        ${nD ? `${btn('down', i, '−', st[i].dice > 0)}<span style="min-width:2.4rem;text-align:center;font-weight:900" data-dice="${i}">${st[i].dice} ${st[i].dice === 1 ? 'die' : 'dice'}</span>${btn('up', i, '+', left() > 0)}` : ''}
                        ${nU ? `<label style="display:flex;align-items:center;gap:.2rem;font-size:.66rem;cursor:pointer"><input type="checkbox" data-util="${i}" ${st[i].util ? 'checked' : ''} ${!st[i].util && utils() >= nU ? 'disabled' : ''}>Utilities</label>` : ''}
                    </div>`).join('') : `<div style="font-size:.72rem;color:#94a3b8">No one you can see is ${rTxt}.</div>`}
                    </div>
                    <div style="font-size:.68rem;color:#cbd5e1;margin-bottom:.6rem;display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">${nD ? `<span data-left><b>${left()}</b> of ${nD} dice left${left() ? ' (lost if no target takes them)' : ''}</span><button type="button" data-even style="font-size:.64rem;padding:.1rem .45rem;border-radius:.3rem;border:1px solid #64748b;background:#1e293b;color:#e2e8f0;cursor:pointer" title="The same number of dice to each creature that has some (or is ticked), rounded down">Split evenly</button>` : ''}${nU ? `<span>${utils()} of ${nU} Utility target${nU === 1 ? '' : 's'}</span>` : ''}</div>
                    <div class="apxdlg-row" style="flex-wrap:wrap"><button class="apxdlg-btn" data-x>Cancel</button><button class="apxdlg-btn" data-other style="background:var(--c-surface2,#1e293b);color:inherit">${esc(o.other || 'Not on the map (my GM applies it)')}</button>${rows.length ? `<button class="apxdlg-btn apxdlg-ok" data-ok>Use it</button>` : ''}</div></div>`;
                back.querySelectorAll('[data-up]').forEach(b => b.onclick = () => { let i = +b.dataset.up; if (left() > 0) st[i].dice++; draw(); });
                back.querySelectorAll('[data-down]').forEach(b => b.onclick = () => { let i = +b.dataset.down; if (st[i].dice > 0) st[i].dice--; draw(); });
                back.querySelectorAll('[data-util]').forEach(c => c.onchange = () => { let i = +c.dataset.util; st[i].util = c.checked && (st[i].util || utils() < nU); draw(); });
                let ev = back.querySelector('[data-even]');
                if (ev) ev.onclick = () => { let on = st.map((x, i) => x.dice > 0 || x.util ? i : -1).filter(i => i >= 0); if (!on.length) return; let each = Math.floor(nD / on.length); st.forEach((x, i) => { x.dice = on.includes(i) ? each : 0; }); draw(); };
                back.querySelector('[data-x]').onclick = () => done(null);
                back.querySelector('[data-other]').onclick = () => done({ other: true });
                let ok = back.querySelector('[data-ok]');
                if (ok) ok.onclick = () => {
                    let pickd = rows.map((r, i) => ({ r, s: st[i] })).filter(x => x.s.dice > 0 || x.s.util);
                    if (!pickd.length) return;
                    done({ mapId: o.ctx.mapId, list: pickd.map(x => ({ tokenId: x.r.t.id, name: x.r.t.name || 'Creature', self: x.r.self, t: x.r.t, dice: x.s.dice, util: !!x.s.util })) });
                };
            };
            let done = v => { back.remove(); resolve(v); };
            back.addEventListener('mousedown', e => { if (e.target === back) done(null); });
            draw();
            document.body.appendChild(back);
        });
    };

    // ── Planning a power before anything is spent ──
    // info: { p, name, lvl, ctx (map), casterId (its token), who ('player' | 'companion' | 'npc'), areaRes, chan,
    //         sensorId (an active Sensor's token on that map) }
    // → plan | null (cancelled). plan: { play, targets, other, origin, moves, resize, drain, dispel, mapFx, skipped }
    window.apxPowerPlan = async function (info) {
        let p = info.p, d = (p && p.draft) || {}, play = window.apxPowerPlay(d, info.lvl), ctx = info.ctx;
        let plan = { play, targets: null, other: false, origin: null, moves: [], resize: null, drain: null, dispel: null, mapFx: [], notes: [] };
        if (!ctx || info.chan || !B()) return plan;
        let reach = window.apxPowerReach(p, info.who), fromId = info.fromId || info.casterId;
        plan.mapId = ctx.mapId;
        // From your Sensor (already picked by the caller, or asked here): its square is where the power comes from
        if (info.origin) { fromId = info.origin; plan.origin = info.origin; }
        else if (info.sensorId && (play.targeted || play.mapFx) && window.APXDice && APXDice.ask) {
            let a = await APXDice.ask(info.name, 'Use it from where?', [['me', 'From you', 'pri'], ['sensor', 'From your Sensor (it becomes visible and tangible)']]);
            if (!a) return null;
            if (a === 'sensor') { fromId = info.sensorId; plan.origin = info.sensorId; }
        }
        plan.fromId = fromId;
        // Targets: an area's are the creatures in it; otherwise picked within range
        if (info.areaRes) plan.targets = { mapId: info.areaRes.mapId, list: (info.areaRes.tokenIds || []).map(id => ({ tokenId: id })) };
        else if (play.targeted) {
            let allowSelf = !play.harmful || !!play.teleport;
            // Split Target: a target for each die, and its Utilities on up to the number bought (Step 3)
            if (play.split) {
                let dice = (play.dmg || play.heal) && window.apxSplitDice ? window.apxSplitDice(d, info.chosen) : [];
                let hasUtil = !!(play.buff || play.inflicts.length || play.ends.length || play.teleport || play.push || play.resize || play.wpnDmg || play.dispel || play.invisible);
                // (one built before this was bought, not rebuilt yet: its Utilities still reach every creature picked)
                let legacy = d.splitTargets === undefined && (parseInt(p && p.rulesRev) || 1) < 12;
                let utilN = hasUtil ? (legacy ? 50 : (window.apxSplitTargets ? window.apxSplitTargets(d) : 1)) : 0;
                let txt = STEPS.map(st => { let c = dice.filter(x => x.size === st).length; return c ? c + st : ''; }).filter(Boolean).join(' + ');
                let r = await window.apxPickSplit({ title: `${info.name}: Split Target`, ctx, fromId, selfId: info.casterId, reach, allowSelf, nDice: dice.length, diceText: txt, utilN, heal: play.heal, hasSave: !!play.save });
                if (r === null) return null;
                if (r.other) plan.other = true;
                else { plan.targets = r; plan.split = { dice, utilN, assign: window.apxSplitAssign(dice, r.list), util: r.list.filter(x => x.util).map(x => x.tokenId) }; }
            } else {
                let r = await window.apxPickTargets({ title: info.name, ctx, fromId, selfId: info.casterId, reach, allowSelf, max: 1 });
                if (r === null) return null;
                if (r.other) plan.other = true; else plan.targets = r;
            }
        }
        // (Split Target: the creatures its Utilities reach)
        let utilList = () => plan.split ? plan.targets.list.filter(x => x.util) : (plan.targets ? plan.targets.list : []);
        let first = plan.targets && plan.targets.list && (plan.split ? utilList()[0] : plan.targets.list[0]);
        let tokOf = id => (ctx.map.battleTokens || []).find(t => t.id === id);
        // Teleport / Move the target: a square within reach of where it is, unoccupied, not through walls
        let moveN = play.teleport || play.push;
        if (moveN && first) {
            let tt = tokOf(first.tokenId);
            if (tt) {
                let sz = tt.size || 'medium';
                let res = await B().placeArea(ctx.winId, { mode: 'square', size: B().span(sz), range: moveN, casterId: tt.id, noShare: true, key: 'teleport',
                    label: `${play.teleport ? 'Teleport' : 'Move'} ${tt.name || 'the target'}: pick a square within ${moveN}`, goLabel: play.teleport ? 'Teleport' : 'Move',
                    validate: r => { if (!r.foot) return null; let blk = B().findBlocker(ctx.map.battleTokens || [], { id: tt.id, size: sz }, r.foot.x0, r.foot.y0, t => B().posOf(ctx.mapId, t)); return blk ? `${blk.name || 'Someone'} is there: pick an empty square.` : null; } });
                if (res === null) return null;
                if (res && res !== 'skip' && res.foot) plan.moves.push({ mapId: ctx.mapId, tokenId: tt.id, gx: res.foot.x0, gy: res.foot.y0, kind: play.teleport ? 'teleport' : 'push', name: tt.name || '' });
            }
        }
        if (play.resize && plan.targets && utilList().length) plan.resize = { dir: play.resize, mapId: plan.targets.mapId, tokenIds: utilList().map(x => x.tokenId) };
        // Damage that heals: who regains half of what it deals
        if (play.drain) {
            let r = await window.apxPickTargets({ title: `${info.name}: healing`, msg: 'Who regains Hit Points equal to half the damage dealt (rounded down)?', ctx, fromId, selfId: info.casterId, reach, allowSelf: true, max: 1, other: 'No one on the map' });
            if (r === null) return null;
            if (r && r.list) plan.drain = { mapId: r.mapId, tokenId: r.list[0].tokenId, self: !!r.list[0].self, name: r.list[0].name };
        }
        // End an ongoing power: one of Level ≤ this one on the target
        if (play.dispel && first) {
            let known = window.apxPowersOn ? window.apxPowersOn(ctx, first.tokenId) : null;
            let ok = (known || []).filter(x => (parseInt(x.lvl) || 1) <= (parseInt(info.lvl) || 1));
            if (known && ok.length && window.APXDice && APXDice.ask) {
                let a = await APXDice.ask(info.name, `End which power on ${first.name || 'them'}? (Level ${info.lvl} or lower)`, ok.slice(0, 10).map((x, i) => ['d' + i, `${x.name} (Level ${x.lvl}${x.by ? ', ' + x.by : ''})`, i ? '' : 'pri']).concat([['gm', 'Let my GM pick']]));
                if (!a) return null;
                plan.dispel = a === 'gm' ? { mapId: ctx.mapId, tokenId: first.tokenId, lvl: info.lvl, ask: true } : Object.assign({ mapId: ctx.mapId, tokenId: first.tokenId, lvl: info.lvl }, ok[+a.slice(1)]);
            } else plan.dispel = { mapId: ctx.mapId, tokenId: first.tokenId, lvl: info.lvl, ask: true };
        }
        // What it makes on the map
        let dmgOf = () => (info.dmgFormula ? { formula: info.dmgFormula, type: info.dmgType || 'Fire' } : null);
        for (let i = 0; i < play.zones.length; i++) {
            let sub = play.zones[i], what = { dark: 'Darkness', fog: 'Fog', light: 'Intense light' }[sub] || 'Zone';
            let res = await B().placeArea(ctx.winId, { mode: 'burst', size: 2, range: reach, casterId: fromId, noShare: true, key: 'zone',
                label: `${info.name}: ${what}${play.zones.length > 1 ? ` (${i + 1} of ${play.zones.length})` : ''}, a 2-square radius`, goLabel: 'Place it' });
            if (res === null) return null;
            if (res && res !== 'skip' && res.cells) plan.mapFx.push({ kind: 'zone', sub, cells: res.cells });
        }
        if (play.terrain || play.hazard) {
            let cells = info.areaRes && info.areaRes.cells ? info.areaRes.cells : null;
            if (!cells) {
                let res = await B().placeArea(ctx.winId, { mode: 'square', size: 1, range: reach, casterId: fromId, noShare: true, key: 'terrain', label: `${info.name}: the terrain it changes`, goLabel: 'Place it' });
                if (res === null) return null;
                if (res && res !== 'skip') cells = res.cells;
            }
            if (cells && play.terrain) plan.mapFx.push({ kind: 'terrain', cells });
            if (cells && play.hazard) plan.mapFx.push(Object.assign({ kind: 'hazard', cells }, dmgOf() ? { dmg: dmgOf().formula, type: dmgOf().type } : {}));
        }
        for (let i = 0; i < play.walls.length; i++) {
            let sub = play.walls[i];
            let res = await B().pickCells(ctx.winId, { max: 4, range: reach, casterId: fromId, noTokens: true, color: sub === 'hazard' ? (B().auraColor(info.dmgType || 'Fire')) : '#94a3b8',
                label: `${info.name}: ${sub === 'hazard' ? 'Hazardous' : 'Solid'} wall${play.walls.length > 1 ? ` ${i + 1} of ${play.walls.length}` : ''}`, goLabel: 'Make the wall' });
            if (res === null) return null;
            if (res && res !== 'skip' && res.cells) plan.mapFx.push(Object.assign({ kind: 'wall', sub, cells: res.cells }, sub === 'hazard' && dmgOf() ? { dmg: dmgOf().formula, type: dmgOf().type } : {}));
        }
        if (play.sensor) {
            let res = await B().placeArea(ctx.winId, { mode: 'square', size: 1, range: reach, casterId: info.casterId, noSight: true, noShare: true, key: 'sensor', label: `${info.name}: place your Sensor (no line of sight needed: somewhere you know)`, goLabel: 'Place it' });
            if (res === null) return null;
            if (res && res !== 'skip' && res.foot) plan.mapFx.push({ kind: 'sensor', cells: [[res.foot.x0, res.foot.y0]], reach });
        }
        return plan;
    };
    // The event fields a plan sends with the power (for the GM's tracker to resolve)
    window.apxPlanEvent = function (plan, inst) {
        if (!plan) return {};
        let out = {};
        if (inst) Object.assign(out, { pi: inst.id, dur: inst.dur, lvl: inst.lvl });
        if (plan.mapId) out.mapId = plan.mapId;
        if (plan.targets && plan.targets.list && plan.targets.list.length) out.targets = { mapId: plan.targets.mapId, tokenIds: plan.targets.list.map(x => x.tokenId) };
        // (Split Target: who its Utilities reach; each target's dice are rolled and sent as splitDmg)
        if (plan.split) out.split = { util: plan.split.util.slice(), dice: Object.fromEntries(Object.entries(plan.split.assign).map(([k, v]) => [k, v.length])) };
        if (plan.play && plan.play.ends && plan.play.ends.length) out.ends = plan.play.ends.slice();
        if (plan.moves && plan.moves.length) out.moves = plan.moves.filter(m => !m.done).map(m => ({ mapId: m.mapId, tokenId: m.tokenId, gx: m.gx, gy: m.gy, kind: m.kind }));
        if (plan.resize) out.resize = plan.resize;
        if (plan.drain) out.drain = plan.drain;
        if (plan.dispel) out.dispel = plan.dispel;
        if (plan.mapFx && plan.mapFx.length) out.mapFx = plan.mapFx;
        if (plan.origin) out.fromSensor = plan.origin;
        if (plan.play && plan.play.invisible) out.invisible = true;
        return out;
    };

    // ── Active powers known to the GM's tracker (published with the fight), for ending one ──
    // combatTurn.powersOn: { [entryId]: [{ key, name, lvl, by }] }; a token's entry: its initiativeId, or a player's
    window.apxPowersOn = function (ctx, tokenId) {
        let ct = window._pwCombatTurn, all = GM ? (window._gmPowersOn ? window._gmPowersOn() : {}) : (ct && ct.powersOn) || null;
        if (!all) return null;
        let t = (ctx.map.battleTokens || []).find(x => x.id === tokenId); if (!t) return [];
        let eid = t.initiativeId || (t.type === 'player' && t.playerUid ? 'u:' + t.playerUid : t.type === 'companion' && t.playerUid ? 'c:' + t.playerUid : null);
        return all[eid] || [];
    };

    // ════════════════════════════ The character sheet ════════════════════════════
    if (!GM) {
        // Your own lasting powers (state.activePowers): ending one ends everything it did
        window.apxMyInstance = pi => ((window.state && window.state.activePowers) || []).find(a => a.id === pi) || null;
        // A power's damage (or anything else) taking you down: Concentration saves, a beneficial power's Damage Interrupt
        window.apxOnSelfDamage = function (n) {
            let st = window.state; if (!st || !(n > 0)) return;
            let list = (st.activePowers || []).slice();
            list.forEach(a => {
                if (a.dmgInt && a.beneficial) { window.apxEndActivePower(a.id, 'you took damage (Damage Interrupt)'); return; }
                if (a.conc) {
                    let dc = Math.max(10, Math.floor(n / 2));
                    if (!window.APXDice) return;
                    let first = true, so = window.apxSaveOpts ? window.apxSaveOpts('CON') : {};
                    // (a Conduit Exo-Suit: Advantage on Concentration saves)
                    if (typeof calc !== 'undefined' && calc.exo && calc.exo.concAdv) so = Object.assign({}, so, { advSources: (so.advSources || []).concat(['Conduit Exo-Suit']) });
                    APXDice.check(Object.assign({ kind: 'save', attr: 'CON', label: `Concentration: ${a.name} (DC ${dc})`, who: st.name || '' }, so, {
                        onResult: r => {
                            if (!first) return; first = false;
                            if (r.total >= dc) return `You keep ${a.name} up.`;
                            if (window.apxMyInstance(a.id)) window.apxEndActivePower(a.id, `Concentration lost (${r.total} vs DC ${dc})`);
                            return `Concentration lost: ${a.name} ends.`;
                        } }));
                }
            });
        };
        // A hostile action while you're Invisible from a power: an attack roll, a power that deals damage or inflicts
        // Conditions (or otherwise harms), a maneuver against a creature (Shove, Grapple, Pin, Choke, Shield Bash, Feint,
        // Ground Strike). Not Fight Defensively or Offensively, Disengage, Vault, Block, Escape, or a Standard Action; a
        // maneuver that only sets up your next attack (Power Attack, Charge…) counts when that attack is made. Each one:
        // spend 2 AP to stay Invisible, or the power ends. Action Interrupt ends a beneficial power on you as you attack.
        window.apxHostileAction = async function (what) {
            let st = window.state; if (!st) return;
            // (one action, one check: a maneuver and the roll it makes don't count twice)
            let now = Date.now(); if (window._apxHostileAt && now - window._apxHostileAt < 1200) return; window._apxHostileAt = now;
            let inv = [];
            (st.powerBuffs || []).slice().forEach(b => {
                if (b.actInt && !b.harmful) { if (window.apxEndBuff) window.apxEndBuff(b.id, 'you attacked (Action Interrupt)'); return; }
                if (b.invisible && !b.camo) inv.push(b);   // (Active Camouflage just lasts until your next turn)
            });
            for (let b of inv) {
                if (!(st.powerBuffs || []).includes(b)) continue;
                let have = window.apxApCurrent ? window.apxApCurrent() : 0, ans = 'end';
                if (have >= 2 && window.APXDice && APXDice.ask)
                    ans = await APXDice.ask(`Stay Invisible: ${b.name || 'Invisible'}`, `${what || 'That'} is a hostile action. Spend 2 AP to stay Invisible, or ${b.name || 'the power'} ends. You have ${have} AP.`, [['keep', 'Spend 2 AP: stay Invisible', 'pri'], ['end', 'Let it end']]);
                if (ans === 'keep') { window.apxSpendAp && window.apxSpendAp(2); window.APXDice?.notify(`${b.name || 'Invisible'}: 2 AP to stay Invisible (${window.apxApCurrent ? window.apxApCurrent() : '?'} AP left).`, { kind: 'note' }); continue; }
                let why = have < 2 ? `a hostile action, and not 2 AP to stay Invisible` : 'a hostile action';
                let mine = b.pi && window.apxMyInstance(b.pi);
                if (mine) window.apxEndActivePower(b.pi, why);
                else if (window.apxEndBuff) window.apxEndBuff(b.id, why, { endPower: true });
                window.APXDice?.notify(`You're visible again: ${b.name || 'the power'} ends (${why}).`, { kind: 'warn', open: true });
            }
            window.scheduleAutoSave?.();
        };
        // Concentration at the start of your turn: 2 AP to keep each one up
        (function hookConc(tries) {
            let orig = window.apxResetAp;
            if (typeof orig !== 'function') { if ((tries || 0) < 50) setTimeout(() => hookConc((tries || 0) + 1), 200); return; }
            if (orig._apxConc) return;
            let w = function () {
                let r = orig.apply(this, arguments);
                let st = window.state, list = ((st && st.activePowers) || []).filter(a => a.conc);
                if (list.length && window._pwCombatCode && window.APXDice && APXDice.ask) setTimeout(async () => {
                    for (let a of list) {
                        if (!window.apxMyInstance(a.id)) continue;
                        let have = window.apxApCurrent ? window.apxApCurrent() : 2;
                        // (a Conduit Exo-Suit: 1 AP less)
                        let cost = Math.max(0, 2 - ((typeof calc !== 'undefined' && calc.exo && calc.exo.concAp) || 0));
                        let ans = await APXDice.ask(`Concentration: ${a.name}`, `Keep ${a.name} up? It costs ${cost} AP at the start of each of your turns${cost < 2 ? ' (1 less: your Conduit Exo-Suit)' : ''} (you have ${have}).`, have >= cost ? [['keep', `Spend ${cost} AP`, 'pri'], ['end', 'Let it end']] : [['end', 'Let it end', 'pri'], ['keep', `Spend ${cost} AP anyway`]]);
                        if (ans === 'keep') { window.apxSpendAp && window.apxSpendAp(Math.min(cost, have)); window.APXDice.notify(`${a.name}: ${cost} AP to keep it up (Concentration).`, { kind: 'note' }); }
                        else window.apxEndActivePower(a.id, 'you let your Concentration go');
                    }
                    window.scheduleAutoSave?.();
                }, 500);
                return r;
            };
            Object.keys(orig).forEach(k => { w[k] = orig[k]; });
            w._apxConc = true; window.apxResetAp = w;
        })(0);
        // Your weapon attacks are hostile actions (a harmful power counts where it's used)
        (function hookAtk(tries) {
            let orig = window.apxBeforeAttack;
            if (typeof orig !== 'function') { if ((tries || 0) < 50) setTimeout(() => hookAtk((tries || 0) + 1), 200); return; }
            if (orig._apxHostile) return;
            let w = async function (o) {
                let pre = await orig.apply(this, arguments);
                if (pre !== false && o && o.pcAttack && !o.power && !o.companion && !o.summonInit && !o._hostileDone) { o._hostileDone = true; try { window.apxHostileAction(o.label); } catch (e) { } }
                // A power on you makes your weapons (or fists) deal extra damage: its dice, rolled as their own part
                let extra = pre !== false && o && o.pcAttack && !o.power && !o.companion && o.dice && window.apxPowerBuffWpnDmg ? window.apxPowerBuffWpnDmg(window.state) : [];
                if (extra.length && !o._wpnDmgDone) {
                    o._wpnDmgDone = true;
                    o.split = (o.split && o.split.length ? o.split : [{ formula: o.dice + (o.dmgMod ? (o.dmgMod > 0 ? '+' : '') + o.dmgMod : ''), type: o.dmgType || 'Weapon' }]).concat(extra.map(x => ({ formula: x.formula, type: x.type || 'Power' })));
                    if (o.dmgMod) o.dmgMod = 0;   // (now part of the weapon's own share)
                    o.dmgType = [...new Set(o.split.map(x => x.type).filter(Boolean))].join(' + ');
                    let nt = `+${extra.map(x => `${x.formula}${x.type ? ' ' + x.type : ''} (${x.name})`).join(', ')}`;
                    pre = Object.assign({}, pre || {}, { note: ((pre && pre.note) ? pre.note + ' · ' : '') + nt });
                }
                return pre;
            };
            Object.keys(orig).forEach(k => { w[k] = orig[k]; });
            w._apxHostile = true; window.apxBeforeAttack = w;
        })(0);
        // Your Sensor on a map (an active power's): its token id
        window.apxMySensorOn = function (mapId) {
            let m = sheetMaps().find(x => x.id === mapId); if (!m) return null;
            let t = (m.battleTokens || []).find(x => x.sensor && x.ownerUid === myUid() && window.apxMyInstance(x.pi));
            return t ? t.id : null;
        };
    }
})();
