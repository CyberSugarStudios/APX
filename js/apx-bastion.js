// ----------------------------------------------------------------
// APX Bastion (Rulebook Chapter 13: Bases & Bastions)
// ----------------------------------------------------------------
// The party's shared Bastion. The GM turns it on in World Settings; then everyone in the world
// has a Bastion window (the same one on the GM's page and on every sheet):
//   Overview  the Bastion sheet (Population, Supplies, Power, Defense), Bastion checks, the vault
//             (Currency and Crafting Materials), time, construction, Relaxation at a Medical Plot
//   Build     the builder: levels above and below the surface, the GM's terrain (water, no building,
//             their own kinds), Plots, Walls, Weapon Emplacements, Workbenches. Managers draw
//             suggestions, everyone votes, and the GM starts building the ones the party wants
//   Recruits  who works where (an understaffed Plot produces nothing), weekly recruitment
//   Defense   Defense, Militia, Raids and Structural Damage
//   Log       what happened, and when
//   Setup     (GM) name, managers, location costs, names and pictures for the setting
//
// Storage: worldCodes/{code}/bastion/main is written only by the GM's app. Players write to its
// sub-collections: sugs (suggestions), reqs (asking the GM's app to do something: a deposit,
// assigning a Recruit, a Bastion check's result), imgs (pictures) and live (the shared Structural
// Damage choices). The GM's app applies those while it's open, so building happens with the GM
// online. Without the cloud (a local world) the same data lives in this browser's storage.
// Nothing here is part of a character's save.
// ----------------------------------------------------------------
(function () {
    'use strict';

    // ── The rules ───────────────────────────────────────────────
    const TRAITS = ['Strong', 'Agile', 'Perceptive', 'Intelligent', 'Charismatic', 'Lucky'];
    const RECRUIT_TABLE = { 1: 'No One', 2: 'Strong', 3: 'Agile', 4: 'Perceptive', 5: 'Intelligent', 6: 'Charismatic', 7: 'Elite Recruit', 8: 'Lucky' };
    // Plot Types: upgrade cost per square, the Traits that can work it (Lucky works anything)
    const TYPES = {
        empty:    { name: 'Empty',    cost: 0,  traits: null, color: '#64748b' },
        housing:  { name: 'Housing',  cost: 5,  traits: null, color: '#b45309', noStaff: true },
        supply:   { name: 'Supply',   cost: 10, traits: ['Strong', 'Intelligent'], color: '#15803d' },
        power:    { name: 'Power',    cost: 20, traits: ['Intelligent', 'Perceptive'], color: '#ca8a04' },
        commerce: { name: 'Commerce', cost: 20, traits: ['Charismatic'], color: '#0e7490' },
        command:  { name: 'Command',  cost: 30, traits: ['Charismatic', 'Intelligent'], color: '#7c3aed' },
        medical:  { name: 'Medical',  cost: 15, traits: ['Intelligent', 'Perceptive'], color: '#dc2626' },
        arsenal:  { name: 'Arsenal',  cost: 15, traits: ['Strong', 'Charismatic'], color: '#9a3412' },
        crafting: { name: 'Crafting', cost: 10, traits: ['Intelligent', 'Strong'], color: '#4d7c0f' },
    };
    const TYPE_ORDER = ['housing', 'supply', 'power', 'commerce', 'command', 'medical', 'arsenal', 'crafting', 'empty'];
    const EMP_TRAITS = ['Agile', 'Perceptive'];
    const EMP_COST = 500, EMP_AUTO_COST = 1000, BENCH_COST = 2000, DOCK_COST = 5000, WALL_COST = 10, PLOT_COST = 10;
    const UNITS = {
        squad:   { name: 'Squad',   recruits: 5,  cost: 1000,  size: 'Large (2×2)',   hp: 50,  ac: 12, attack: '2d10', garrison: 5 },
        platoon: { name: 'Platoon', recruits: 20, cost: 5000,  size: 'Huge (3×3)',    hp: 150, ac: 14, attack: '4d10', garrison: 20 },
        company: { name: 'Company', recruits: 50, cost: 15000, size: 'Massive (4×4)', hp: 350, ac: 16, attack: '6d10', garrison: 50 },
    };
    const THREATS = [['Nuisance', 30], ['Organized', 60], ['Deadly', 90], ['Apocalyptic', 120]];
    const STATS = { population: 'Population', supplies: 'Supplies', power: 'Power', defense: 'Defense' };
    const FOUNDED = { granted: 'Granted', purchased: 'Purchased', conquered: 'Conquered', claimed: 'Claimed' };
    const KINDS = { air: 'Hovering / Flying', surface: 'Surface', below: 'Underground' };
    const MAT_CU = { rare: 20, uncommon: 10, common: 2 };   // what one Crafting Material pays toward building (twice its value)
    const MAT_NAMES = { common: 'Common Crafting Materials', uncommon: 'Uncommon Crafting Materials', rare: 'Rare Crafting Materials' };

    // ── Small helpers ───────────────────────────────────────────
    const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const fmt = n => (Math.round(Number(n) || 0)).toLocaleString('en-US');
    const rid = p => (p || 'b') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const clone = o => JSON.parse(JSON.stringify(o));
    const int = (v, d) => { let n = parseInt(v, 10); return isFinite(n) ? n : (d || 0); };
    const ck = (x, y) => x + ',' + y;
    const pk = k => k.split(',').map(Number);
    const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
    function notify(t, kind, open) { try { window.APXDice && window.APXDice.notify(t, { kind: kind || 'note', open: !!open }); } catch (e) { } }
    function rand(n) { let a = new Uint32Array(1); (window.crypto || window.msCrypto).getRandomValues(a); return 1 + (a[0] % n); }
    function confirmBox(msg, o) { return window.apxConfirm ? window.apxConfirm(msg, o || {}) : Promise.resolve(window.confirm(msg)); }
    function form(title, fields, o) { return window.apxForm ? window.apxForm(title, fields, o) : Promise.resolve(null); }
    function traitText(traits) { return traits ? traits.concat(['Lucky']).join(', ').replace(/, ([^,]*)$/, ' or $1') : 'anyone'; }
    function typeName(b, t) { return ((b && b.names) || {})[t] || (TYPES[t] || TYPES.empty).name; }
    function qualifies(r, traits) { return !traits || r.traits.includes('Lucky') || r.traits.some(t => traits.includes(t)); }
    function recText(r) { return (r.name ? r.name + ': ' : '') + r.traits.join(' & '); }
    function week(b) { return Math.floor(b.day / 7) + 1; }
    function month(b) { return Math.floor(b.day / 28) + 1; }
    function when(b) { return `Day ${b.day + 1} · Week ${week(b)} · Month ${month(b)}`; }
    function sqOf(p) { return (p.cells || []).length; }
    function lvl(b, id) { return (b.levels || []).find(l => l.id === id) || null; }
    function plotName(b, p) { return (p.label ? '“' + p.label + '” ' : '') + typeName(b, p.type) + ' Plot'; }

    // A new Bastion
    function newBastion(o) {
        o = o || {};
        let cols = Math.max(8, Math.min(120, int(o.cols, 40))), rows = Math.max(8, Math.min(120, int(o.rows, 28)));
        return {
            v: 1, name: o.name || 'Bastion', founded: FOUNDED[o.founded] ? o.founded : 'granted', note: o.note || '',
            managers: o.managers || [], day: 0, created: Date.now(), updated: Date.now(),
            vault: { cu: 0, common: 0, uncommon: 0, rare: 0 }, matsFirst: true,
            grid: { cols, rows },
            levels: [{ id: 'L' + Date.now().toString(36), name: 'Surface', kind: 'surface', img: null, imgOpacity: 1, terrain: {} }],
            terrains: [
                { id: 'water', name: 'Water', color: '#2563eb', mult: { air: 10, surface: 1, below: 5 } },
                { id: 'nobuild', name: 'No building', color: '#991b1b', noBuild: true },
            ],
            landMult: { air: 10, surface: 1, below: 2 },
            names: {}, art: {}, adj: { supplies: 0, power: 0, defense: 0, popCap: 0 },
            plots: [], walls: {}, emps: [], benches: [], projects: [], recruits: [], militia: [],
            recruitWeek: 0, monthDue: 0, ask: null, raid: null, sd: null, seen: [], log: [],
        };
    }
    // Older or partial data gets everything it's missing (never removes anything)
    function normalize(d) {
        let b = Object.assign(newBastion({ name: d.name, cols: d.grid && d.grid.cols, rows: d.grid && d.grid.rows }), d);
        ['plots', 'emps', 'benches', 'projects', 'recruits', 'militia', 'seen', 'log', 'managers', 'terrains', 'levels'].forEach(k => { if (!Array.isArray(b[k])) b[k] = []; });
        if (!b.levels.length) b.levels = newBastion().levels;
        b.levels.forEach(l => { l.terrain = l.terrain || {}; l.kind = KINDS[l.kind] ? l.kind : 'surface'; });
        b.vault = Object.assign({ cu: 0, common: 0, uncommon: 0, rare: 0 }, b.vault || {});
        b.walls = b.walls && typeof b.walls === 'object' ? b.walls : {};
        b.adj = Object.assign({ supplies: 0, power: 0, defense: 0, popCap: 0 }, b.adj || {});
        b.names = b.names || {}; b.art = b.art || {};
        b.landMult = Object.assign({ air: 10, surface: 1, below: 2 }, b.landMult || {});
        b.recruits.forEach(r => { r.traits = Array.isArray(r.traits) && r.traits.length ? r.traits : ['Strong']; if (r.job === undefined) r.job = null; });
        return b;
    }

    // ── Location costs ──────────────────────────────────────────
    // A square's multiplier comes from its level (above, at or below the surface) and the GM's terrain
    // painted there (Water: Underwater below the surface). null: nothing can be built there.
    function terrainOf(b, lv, key) { let id = (lv.terrain || {})[key]; return id ? b.terrains.find(t => t.id === id) || null : null; }
    function cellMult(b, lv, key) {
        let t = terrainOf(b, lv, key);
        if (t && t.noBuild) return null;
        let m = (t && t.mult) || b.landMult || {};
        let v = m[lv.kind];
        return v == null || v === '' ? 1 : Math.max(0, Number(v) || 0);
    }
    function cellLoc(b, lv, key) {
        let t = terrainOf(b, lv, key), k = lv.kind;
        if (!t) return k === 'air' ? 'Hovering / Flying' : k === 'below' ? 'Underground' : 'Surface';
        if (t.id === 'water') return k === 'air' ? 'Flying (over water)' : k === 'below' ? 'Underwater' : 'Surface (on the water)';
        return `${t.name} (${KINDS[k]})`;
    }
    function inGrid(b, x, y) { return x >= 0 && y >= 0 && x < b.grid.cols && y < b.grid.rows; }

    // ── What a Plot does ────────────────────────────────────────
    // A Plot that needs workers needs 1 for every 25 squares (at least 1); with fewer it produces nothing.
    function needWorkers(type, sq) { let t = TYPES[type]; return !t || !t.traits || t.noStaff ? 0 : Math.max(1, Math.floor(sq / 25)); }
    function workersOf(b, k, id) { return b.recruits.filter(r => r.job && r.job.k === k && r.job.id === id); }
    function gives(type, sq) {
        let f10 = Math.floor(sq / 10);
        switch (type) {
            case 'housing': return `+${Math.floor(sq / 4)} to the Population cap`;
            case 'supply': return `${f10} Supplies a week, +${f10} to Supply checks`;
            case 'power': return `${f10} Power a week, +${f10} to Power checks`;
            case 'commerce': return `${f10 * 25} Currency a week`;
            case 'command': return `+${Math.floor(sq / 20)} to every Bastion check`;
            case 'medical': return 'free Relaxation that heals two Permanent Injuries; saves the first 5 casualties of a Raid or disaster';
            case 'arsenal': return 'lets you draft and keep Militia Units';
            case 'crafting': return 'holds Specialized Workbenches and a Vehicle Dock';
            default: return 'nothing until it gets a Plot Type';
        }
    }
    // Walls: +1 Defense for every 10 connected squares of Wall. A segment is the top ('h') or left ('v')
    // edge of a square: "x,y,h" runs from corner (x,y) to (x+1,y), "x,y,v" from (x,y) to (x,y+1).
    function segEnds(s) { let [x, y, d] = s.split(','); x = +x; y = +y; return d === 'h' ? [ck(x, y), ck(x + 1, y)] : [ck(x, y), ck(x, y + 1)]; }
    function wallRuns(segs) {
        let parent = {};
        let find = a => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
        (segs || []).forEach(s => { let [a, c] = segEnds(s); if (!(a in parent)) parent[a] = a; if (!(c in parent)) parent[c] = c; let ra = find(a), rc = find(c); if (ra !== rc) parent[ra] = rc; });
        let count = {};
        (segs || []).forEach(s => { let r = find(segEnds(s)[0]); count[r] = (count[r] || 0) + 1; });
        return Object.values(count).sort((a, c) => c - a);
    }

    // The Bastion sheet, worked out from what's built and who works where
    function stats(b) {
        let s = { pop: b.recruits.length, popCap: 0, supplies: 0, supplyBonus: 0, power: 0, powerBonus: 0, commerce: 0, route: 0, command: 0,
            medical: false, arsenal: false, wallDef: 0, empDef: 0, garrison: 0, powerUsed: 0, plots: {}, emps: {}, idle: [], tips: {} };
        let tip = (k, line) => (s.tips[k] = s.tips[k] || []).push(line);
        b.plots.forEach(p => {
            let sq = sqOf(p), need = needWorkers(p.type, sq), have = workersOf(b, 'plot', p.id).length;
            let active = p.type !== 'empty' && have >= need;
            s.plots[p.id] = { sq, need, have, active };
            if (!active) { if (p.type !== 'empty') s.idle.push(`${plotName(b, p)}: ${have}/${need} workers, so it produces nothing`); return; }
            let f10 = Math.floor(sq / 10), name = plotName(b, p);
            if (p.type === 'housing') { s.popCap += Math.floor(sq / 4); tip('popCap', `${name} (${sq} sq): +${Math.floor(sq / 4)}`); }
            if (p.type === 'supply') { s.supplies += f10; s.supplyBonus += f10; tip('supplies', `${name} (${sq} sq): +${f10}`); }
            if (p.type === 'power') { s.power += f10; s.powerBonus += f10; tip('power', `${name} (${sq} sq): +${f10}`); }
            if (p.type === 'commerce') { s.commerce += f10 * 25; if (p.route) s.route += 100; tip('commerce', `${name} (${sq} sq): ${f10 * 25} Cu${p.route ? ' + 100 Cu (Supply Route)' : ''}`); }
            if (p.type === 'command') { s.command += Math.floor(sq / 20); tip('command', `${name} (${sq} sq): +${Math.floor(sq / 20)}`); }
            if (p.type === 'medical') s.medical = true;
            if (p.type === 'arsenal') s.arsenal = true;
        });
        let adj = b.adj || {};
        if (adj.popCap) { s.popCap += int(adj.popCap); tip('popCap', `GM adjustment: ${int(adj.popCap) >= 0 ? '+' : ''}${int(adj.popCap)}`); }
        if (adj.supplies) { s.supplies += int(adj.supplies); tip('supplies', `GM adjustment: ${int(adj.supplies) >= 0 ? '+' : ''}${int(adj.supplies)}`); }
        if (adj.power) { s.power += int(adj.power); tip('power', `GM adjustment: ${int(adj.power) >= 0 ? '+' : ''}${int(adj.power)}`); }
        // Weapon Emplacements: manned ones need a Recruit; Automated ones draw 1 Power a week each
        let autos = b.emps.filter(e => e.auto);
        s.powerUsed = autos.length;
        let powered = Math.max(0, Math.min(autos.length, s.power));
        autos.forEach((e, i) => { s.emps[e.id] = { on: i < powered, why: i < powered ? 'powered' : 'no Power left' }; });
        b.emps.filter(e => !e.auto).forEach(e => { let on = workersOf(b, 'emp', e.id).length >= 1; s.emps[e.id] = { on, why: on ? 'manned' : 'no one manning it' }; });
        let empsOn = b.emps.filter(e => s.emps[e.id].on).length;
        s.empDef = 5 * empsOn;
        b.levels.forEach(l => { wallRuns((b.walls || {})[l.id]).forEach(n => { s.wallDef += Math.floor(n / 10); }); });
        b.militia.forEach(m => { if (m.stationed && UNITS[m.size]) s.garrison += UNITS[m.size].garrison; });
        s.defense = 10 + s.wallDef + s.empDef + s.garrison + int(adj.defense);
        tip('defense', 'Base: 10');
        if (s.wallDef) tip('defense', `Walls (+1 per 10 connected squares): +${s.wallDef}`);
        if (s.empDef) tip('defense', `Weapon Emplacements (${empsOn} working × 5): +${s.empDef}`);
        if (s.garrison) tip('defense', `Militia stationed here (Garrison Defense): +${s.garrison}`);
        if (adj.defense) tip('defense', `GM adjustment: ${int(adj.defense) >= 0 ? '+' : ''}${int(adj.defense)}`);
        // Bastion checks: d100 + the score (+ Supply/Power Plot bonuses), + Command Plots on every check
        s.checks = {
            population: s.pop + s.command,
            supplies: s.supplies + s.supplyBonus + s.command,
            power: s.power + s.powerBonus + s.command,
            defense: s.defense + s.command,
        };
        s.deficit = Math.max(0, s.pop - s.supplies);
        s.weeklyCu = s.commerce + s.route;
        return s;
    }

    // ── The vault ───────────────────────────────────────────────
    // Building takes Currency, or half as much value in Crafting Materials (a Common one pays 2 Cu, an
    // Uncommon 10, a Rare 20). buildValue: what the vault can pay toward building.
    function buildValue(v) { return (v.cu || 0) + (v.common || 0) * MAT_CU.common + (v.uncommon || 0) * MAT_CU.uncommon + (v.rare || 0) * MAT_CU.rare; }
    function vaultText(v) {
        let parts = [`${fmt(v.cu || 0)} Cu`];
        ['common', 'uncommon', 'rare'].forEach(k => { if (v[k]) parts.push(`${fmt(v[k])} ${k[0].toUpperCase() + k.slice(1)}`); });
        return parts.join(', ');
    }
    // How the vault pays `need` Cu of building (null: it can't). Materials first or Currency first;
    // a last material may pay a little over (a Common one for the final 1 Cu).
    function payPlan(v, need, matsFirst) {
        let have = Object.assign({ cu: 0, common: 0, uncommon: 0, rare: 0 }, v), out = { cu: 0, common: 0, uncommon: 0, rare: 0 }, left = need;
        let mats = over => {
            ['rare', 'uncommon', 'common'].forEach(k => { while (have[k] > 0 && left >= MAT_CU[k]) { have[k]--; out[k]++; left -= MAT_CU[k]; } });
            if (over) while (left > 0) { let k = ['common', 'uncommon', 'rare'].find(x => have[x] > 0); if (!k) break; have[k]--; out[k]++; left -= MAT_CU[k]; }
        };
        let cu = () => { let n = Math.max(0, Math.min(have.cu, left)); have.cu -= n; out.cu += n; left -= n; };
        if (matsFirst) { mats(false); cu(); mats(true); } else { cu(); mats(true); }
        return left <= 0 ? out : null;
    }
    function spend(v, plan) { ['cu', 'common', 'uncommon', 'rare'].forEach(k => { v[k] = (v[k] || 0) - (plan[k] || 0); }); }
    function addTo(v, plan) { ['cu', 'common', 'uncommon', 'rare'].forEach(k => { v[k] = (v[k] || 0) + Math.max(0, int(plan[k])); }); }

    // ── Construction items ──────────────────────────────────────
    //   plot  { level, cells: ['x,y'], type, label }    a new Plot (its Plot Type chosen up front)
    //   type  { plot, type }                             a built Plot gets a (new) Plot Type
    //   wall  { level, segs: ['x,y,h'] }                 Wall along square edges
    //   emp   { level, x, y, auto, label }               a Weapon Emplacement
    //   auto  { emp }                                    automate a manned Emplacement
    //   bench { plot, spec } / dock { plot }             in a Crafting Plot
    // Time: 1 Day for every 100 Currency of the final cost (rounded down, at least 1 Day).
    function daysFor(cost) { return Math.max(1, Math.floor(cost / 100)); }
    function itemInfo(b, it) {
        let o = { cost: 0, lines: [], title: '', err: null, gives: '' };
        if (it.k === 'plot') {
            let lv = lvl(b, it.level);
            if (!lv) return Object.assign(o, { title: 'Plot', err: 'Its level was removed.' });
            let groups = {}, base = 0, bad = 0;
            (it.cells || []).forEach(key => {
                let m = cellMult(b, lv, key);
                if (m == null) { bad++; return; }
                let g = cellLoc(b, lv, key) + ' ×' + m;
                groups[g] = groups[g] || { n: 0 }; groups[g].n++;
                base += PLOT_COST * m;
            });
            let sq = (it.cells || []).length, t = TYPES[it.type] || TYPES.empty, tc = t.cost * sq;
            o.title = `${it.label ? '“' + it.label + '” ' : ''}${typeName(b, it.type)} Plot, ${sq} sq (${lv.name})`;
            o.lines.push(`Building: ${Object.entries(groups).map(([g, v]) => `${v.n} sq ${g}`).join(' + ') || 'no squares'} × ${PLOT_COST} Cu = ${fmt(base)} Cu`);
            if (tc) o.lines.push(`${typeName(b, it.type)} fittings: ${sq} sq × ${t.cost} Cu = ${fmt(tc)} Cu`);
            let need = needWorkers(it.type, sq);
            if (need) o.lines.push(`Needs ${plural(need, 'worker')} (${traitText(t.traits)})`);
            o.gives = gives(it.type, sq);
            if (bad) o.err = `${plural(bad, 'square')} can't be built on.`;
            if (!sq) o.err = 'No squares.';
            o.cost = base + tc;
        } else if (it.k === 'type') {
            let p = b.plots.find(x => x.id === it.plot);
            if (!p) return Object.assign(o, { title: 'Plot Type', err: 'That Plot is gone.' });
            let sq = sqOf(p), t = TYPES[it.type] || TYPES.empty;
            o.title = `${plotName(b, p)} becomes ${typeName(b, it.type)} (${sq} sq)`;
            o.cost = t.cost * sq;
            o.lines.push(`${typeName(b, it.type)} fittings: ${sq} sq × ${t.cost} Cu = ${fmt(o.cost)} Cu`);
            let need = needWorkers(it.type, sq);
            if (need) o.lines.push(`Needs ${plural(need, 'worker')} (${traitText(t.traits)})`);
            o.gives = gives(it.type, sq);
            if (p.type === it.type) o.err = 'It already is one.';
        } else if (it.k === 'wall') {
            let n = (it.segs || []).length, lv = lvl(b, it.level);
            o.title = `Wall, ${plural(n, 'square')} long${lv ? ' (' + lv.name + ')' : ''}`;
            o.cost = n * WALL_COST;
            o.lines.push(`${n} × ${WALL_COST} Cu = ${fmt(o.cost)} Cu`);
            o.gives = '+1 Defense for every 10 connected squares of Wall';
            if (!n) o.err = 'No squares.';
            if (!lv) o.err = 'Its level was removed.';
        } else if (it.k === 'emp') {
            o.title = `${it.auto ? 'Automated ' : ''}Weapon Emplacement${it.label ? ' “' + it.label + '”' : ''}`;
            o.cost = it.auto ? EMP_AUTO_COST : EMP_COST;
            o.lines.push(`${fmt(o.cost)} Cu${it.auto ? ' (doubled: Automated)' : ''}`);
            o.lines.push(it.auto ? 'No crew: draws 1 Power a week' : `Manned by 1 Recruit (${traitText(EMP_TRAITS)})`);
            o.gives = '+5 Defense while it works';
        } else if (it.k === 'auto') {
            let e = b.emps.find(x => x.id === it.emp);
            o.title = 'Automate a Weapon Emplacement';
            o.cost = EMP_AUTO_COST - EMP_COST;
            o.lines.push(`${fmt(o.cost)} Cu more (an Automated one costs ${fmt(EMP_AUTO_COST)} Cu)`, 'No crew: draws 1 Power a week');
            if (!e) o.err = 'That Emplacement is gone.'; else if (e.auto) o.err = 'It already is.';
        } else if (it.k === 'bench' || it.k === 'dock') {
            let p = b.plots.find(x => x.id === it.plot);
            o.title = it.k === 'dock' ? 'Vehicle Dock' : `Specialized Workbench: ${it.spec || '?'}`;
            o.cost = it.k === 'dock' ? DOCK_COST : BENCH_COST;
            o.lines.push(`${fmt(o.cost)} Cu, in ${p ? plotName(b, p) : 'a Crafting Plot'}`);
            o.gives = it.k === 'dock' ? 'lets the party forge Vehicles (Chapter 11)' : `Advantage on Craft checks for ${it.spec || 'its specialization'}`;
            if (!p) o.err = 'That Plot is gone.'; else if (p.type !== 'crafting') o.err = 'Only a Crafting Plot holds one.';
            if (it.k === 'bench' && !String(it.spec || '').trim()) o.err = 'Name its specialization.';
        }
        o.days = daysFor(o.cost);
        return o;
    }
    // What's already on a level (built, or being built), to keep new things from overlapping it
    function taken(b, levelId, skipItems) {
        let cells = new Set(), segs = new Set(), emps = new Set();
        b.plots.forEach(p => { if (p.level === levelId) p.cells.forEach(c => cells.add(c)); });
        ((b.walls || {})[levelId] || []).forEach(s => segs.add(s));
        b.emps.forEach(e => { if (e.level === levelId) emps.add(ck(e.x, e.y)); });
        b.projects.forEach(p => {
            let it = p.item; if (!it || it.level !== levelId) return;
            if (it.k === 'plot') it.cells.forEach(c => cells.add(c));
            if (it.k === 'wall') it.segs.forEach(s => segs.add(s));
            if (it.k === 'emp') emps.add(ck(it.x, it.y));
        });
        return { cells, segs, emps };
    }
    // The problem with each item (null when it's fine), counting the items against each other too
    function checkItems(b, items) {
        let by = {}, plotBusy = new Set(b.projects.filter(p => p.item && (p.item.k === 'type')).map(p => p.item.plot));
        let get = l => (by[l] = by[l] || taken(b, l));
        return items.map(it => {
            let inf = itemInfo(b, it);
            if (inf.err) return inf.err;
            if (it.k === 'plot') {
                let t = get(it.level), lv = lvl(b, it.level);
                for (let c of it.cells) {
                    let [x, y] = pk(c);
                    if (!inGrid(b, x, y)) return 'Part of it is off the map.';
                    if (cellMult(b, lv, c) == null) return 'Part of it is on ground marked No building.';
                    if (t.cells.has(c)) return 'It overlaps something already there (or another item).';
                }
                it.cells.forEach(c => t.cells.add(c));
            } else if (it.k === 'wall') {
                let t = get(it.level);
                for (let s of it.segs) { if (t.segs.has(s)) return 'Part of that Wall is already there.'; }
                it.segs.forEach(s => t.segs.add(s));
            } else if (it.k === 'emp') {
                let t = get(it.level), lv = lvl(b, it.level), c = ck(it.x, it.y);
                if (!lv || !inGrid(b, it.x, it.y)) return 'It is off the map.';
                if (cellMult(b, lv, c) == null) return 'That square is marked No building.';
                if (t.emps.has(c)) return 'There is already an Emplacement there.';
                t.emps.add(c);
            } else if (it.k === 'type') {
                if (plotBusy.has(it.plot)) return 'That Plot is already getting a Plot Type.';
                plotBusy.add(it.plot);
            }
            return null;
        });
    }
    function itemsCost(b, items) { return items.reduce((a, it) => a + itemInfo(b, it).cost, 0); }

    // ── Time: days, weeks, months ───────────────────────────────
    // Each day, every project pays for one day of work (its cost spread over its days); a project the
    // vault can't pay for that day waits (Paused) until there's enough again.
    function workDay(b, log) {
        b.projects.forEach(p => {
            if (p.status === 'done') return;
            let share = Math.floor(p.cost * (p.daysDone + 1) / p.days) - Math.floor(p.cost * p.daysDone / p.days);
            let plan = share > 0 ? payPlan(b.vault, share, b.matsFirst !== false) : { cu: 0 };
            if (!plan) {
                if (p.status !== 'paused') log(`${p.title}: building paused. The vault needs ${fmt(share)} Cu (or half that in Crafting Materials) for the next day of work.`);
                p.status = 'paused'; p.need = share;
                return;
            }
            spend(b.vault, plan);
            p.spent = p.spent || { cu: 0, common: 0, uncommon: 0, rare: 0 };
            addTo(p.spent, plan);
            p.paid = (p.paid || 0) + share; p.daysDone++; p.status = 'building'; delete p.need;
            if (p.daysDone >= p.days) finishProject(b, p, log);
        });
        b.projects = b.projects.filter(p => p.status !== 'done');
    }
    function finishProject(b, p, log) {
        let it = p.item;
        if (it.k === 'plot') b.plots.push({ id: it.id || rid('p'), level: it.level, cells: it.cells.slice(), type: it.type || 'empty', label: it.label || '', by: p.by || '', day: b.day });
        else if (it.k === 'type') {
            let pl = b.plots.find(x => x.id === it.plot);
            if (pl) { pl.type = it.type; workersOf(b, 'plot', pl.id).forEach(r => { if (!qualifies(r, (TYPES[pl.type] || {}).traits) || needWorkers(pl.type, sqOf(pl)) === 0) r.job = null; }); }
        } else if (it.k === 'wall') {
            let set = new Set((b.walls[it.level] || []).concat(it.segs));
            b.walls[it.level] = [...set];
        } else if (it.k === 'emp') b.emps.push({ id: it.id || rid('e'), level: it.level, x: it.x, y: it.y, auto: !!it.auto, label: it.label || '' });
        else if (it.k === 'auto') { let e = b.emps.find(x => x.id === it.emp); if (e) { e.auto = true; workersOf(b, 'emp', e.id).forEach(r => { r.job = null; }); } }
        else if (it.k === 'bench' || it.k === 'dock') b.benches.push({ id: it.id || rid('w'), plot: it.plot, kind: it.k, spec: it.k === 'dock' ? 'Vehicle Dock' : String(it.spec || '').trim() });
        p.status = 'done';
        log(`Finished: ${p.title}.`);
    }
    function weekEnd(b, n, log) {
        let s = stats(b);
        if (s.weeklyCu) { b.vault.cu = (b.vault.cu || 0) + s.weeklyCu; log(`Week ${n}: Commerce brought in ${fmt(s.weeklyCu)} Cu${s.route ? ` (${fmt(s.route)} of it from Supply Routes)` : ''}.`); }
        // Every Recruit eats 1 Supply a week; with less Supply than Population, the difference leaves or starves
        if (s.deficit > 0) {
            let units = b.militia.length, gone = loseRecruits(b, s.deficit);
            tidyJobs(b);
            log(`Week ${n}: only ${s.supplies} Supplies for a Population of ${s.pop}. ${plural(gone.length, 'Recruit')} abandoned the Bastion or starved${units > b.militia.length ? ` (${plural(units - b.militia.length, 'Militia Unit')} lost everyone)` : ''}.`);
        }
        if (s.powerUsed > s.power) log(`Week ${n}: not enough Power for every Automated Emplacement (${s.powerUsed} need it, ${Math.max(0, s.power)} Power): ${s.powerUsed - Math.max(0, s.power)} stayed offline.`);
    }
    // Who leaves first: no job, then workers (Plots, Emplacements), then Militia; the Supply Plots'
    // workers last (losing them would only make a shortage worse)
    function loseRecruits(b, n) {
        let supply = new Set(b.plots.filter(p => p.type === 'supply').map(p => p.id));
        let order = r => !r.job ? 0 : r.job.k === 'plot' ? (supply.has(r.job.id) ? 4 : 1) : r.job.k === 'emp' ? 2 : 3;
        let list = b.recruits.slice().sort((a, c) => order(a) - order(c) || (c.day || 0) - (a.day || 0)).slice(0, Math.max(0, n));
        let ids = new Set(list.map(r => r.id));
        b.recruits = b.recruits.filter(r => !ids.has(r.id));
        return list;
    }
    function advance(b, days, log) {
        for (let i = 0; i < days; i++) {
            workDay(b, log);
            b.day++;
            if (b.day % 7 === 0) weekEnd(b, b.day / 7, log);
            if (b.day % 28 === 0) { b.monthDue = b.day / 28; log(`End of Month ${b.day / 28}: the GM rolls to see if a hostile force raids the Bastion.`); }
        }
    }

    // ── Recruits ────────────────────────────────────────────────
    // Recruitment, once a week: 1d8. A 7 (Elite Recruit) rolls twice more, ignoring 1s, 7s and 8s,
    // and the Recruit has both Traits. rolls: every d8 in order (the ignored ones too).
    function rollRecruitment() {
        let rolls = [rand(8)];
        if (rolls[0] === 7) { let got = 0; while (got < 2 && rolls.length < 40) { let r = rand(8); rolls.push(r); if (r >= 2 && r <= 6) got++; } }
        return rolls;
    }
    function recruitFrom(rolls) {
        let first = rolls[0];
        if (first === 1) return { none: true, text: '1: No One. No one arrives this week.' };
        if (first === 8) return { traits: ['Lucky'], text: '8: Lucky. A wildcard: they can work ANY job.' };
        if (first !== 7) return { traits: [RECRUIT_TABLE[first]], text: `${first}: ${RECRUIT_TABLE[first]}.` };
        let extra = rolls.slice(1).filter(r => r >= 2 && r <= 6).slice(0, 2);
        let traits = [...new Set(extra.map(r => RECRUIT_TABLE[r]))];
        return { traits: traits.length ? traits : ['Strong'], elite: true, text: `7: Elite Recruit. Rolled ${rolls.slice(1).map(r => (r >= 2 && r <= 6) ? r : r + ' (ignored)').join(', ')}: ${traits.join(' and ')}.` };
    }
    function addRecruit(b, traits, extra) {
        let r = Object.assign({ id: rid('r'), traits: traits.slice(), job: null, day: b.day }, extra || {});
        b.recruits.push(r);
        return r;
    }
    function jobTraits(b, k, id) {
        if (k === 'plot') { let p = b.plots.find(x => x.id === id); return p ? (TYPES[p.type] || {}).traits || null : undefined; }
        if (k === 'emp') { let e = b.emps.find(x => x.id === id); return e ? (e.auto ? undefined : EMP_TRAITS) : undefined; }
        return undefined;
    }
    function jobNeed(b, k, id) {
        if (k === 'plot') { let p = b.plots.find(x => x.id === id); return p ? needWorkers(p.type, sqOf(p)) : 0; }
        if (k === 'emp') { let e = b.emps.find(x => x.id === id); return e && !e.auto ? 1 : 0; }
        return 0;
    }
    // The least flexible fit first: a Recruit with the exact Trait before an Elite, a Lucky one last
    function fitScore(r) { return r.traits.includes('Lucky') ? 10 : r.traits.length; }
    function assignOne(b, k, id, add) {
        if (add > 0) {
            let traits = jobTraits(b, k, id);
            if (traits === undefined) return 'That job is gone.';
            if (workersOf(b, k, id).length >= jobNeed(b, k, id)) return 'It already has everyone it needs.';
            let free = b.recruits.filter(r => !r.job && qualifies(r, traits)).sort((a, c) => fitScore(a) - fitScore(c));
            if (!free.length) return `No unassigned Recruit can work there (it needs ${traitText(traits)}).`;
            free[0].job = { k, id };
            return null;
        }
        let w = workersOf(b, k, id);
        if (!w.length) return 'No one works there.';
        w[w.length - 1].job = null;
        return null;
    }
    // Fill every job that's short, in this order: Supply, Power, Medical, Command, Commerce, Arsenal, Crafting, Emplacements
    function autoAssign(b) {
        tidyJobs(b);
        let n = 0, order = ['supply', 'power', 'medical', 'command', 'commerce', 'arsenal', 'crafting'];
        let jobs = [];
        order.forEach(t => b.plots.filter(p => p.type === t).forEach(p => jobs.push(['plot', p.id])));
        b.emps.filter(e => !e.auto).forEach(e => jobs.push(['emp', e.id]));
        jobs.forEach(([k, id]) => { while (workersOf(b, k, id).length < jobNeed(b, k, id) && !assignOne(b, k, id, 1)) n++; });
        return n;
    }
    // Jobs that no longer exist (a Plot destroyed, an Emplacement automated) free their workers;
    // a Militia Unit with no one left in it is gone
    function tidyJobs(b) {
        b.militia = b.militia.filter(m => b.recruits.some(r => r.job && r.job.k === 'mil' && r.job.id === m.id));
        b.recruits.forEach(r => {
            if (!r.job) return;
            if (r.job.k === 'mil') { if (!b.militia.some(m => m.id === r.job.id)) r.job = null; return; }
            let traits = jobTraits(b, r.job.k, r.job.id);
            if (traits === undefined || !qualifies(r, traits) || jobNeed(b, r.job.k, r.job.id) === 0) r.job = null;
        });
        ['plot', 'emp'].forEach(k => {
            let ids = new Set(b.recruits.filter(r => r.job && r.job.k === k).map(r => r.job.id));
            ids.forEach(id => { let w = workersOf(b, k, id), need = jobNeed(b, k, id); w.slice(need).forEach(r => { r.job = null; }); });
        });
    }

    // ── Structural Damage ───────────────────────────────────────
    // Each point is absorbed by losing 1 Recruit, 100 Currency, 1 square of Wall or Plot, or a Weapon
    // Emplacement (5 points). No category absorbs more than half the total (rounded down, at least 1).
    // alloc: { rec, cu, sq: { 'p:<plotId>': n, 'w:<levelId>': n }, emps: [ids] }
    function sdCap(total) { return Math.max(1, Math.floor(total / 2)); }
    function sdSums(alloc) {
        alloc = alloc || {};
        let sq = Object.values(alloc.sq || {}).reduce((a, v) => a + Math.max(0, int(v)), 0);
        let o = { rec: Math.max(0, int(alloc.rec)), cu: Math.max(0, int(alloc.cu)), sq, emp: (alloc.emps || []).length * 5 };
        o.total = o.rec + o.cu + o.sq + o.emp;
        return o;
    }
    // How many more of each the allocation could take
    function sdRoom(b, alloc, total) {
        let cap = sdCap(total), u = sdSums(alloc), left = Math.max(0, total - u.total);
        let room = {
            rec: Math.min(cap - u.rec, b.recruits.length - u.rec),
            cu: Math.min(cap - u.cu, Math.floor((b.vault.cu || 0) / 100) - u.cu),
            sq: cap - u.sq,
            emp: Math.max(0, Math.min(Math.floor((cap - u.emp) / 5), b.emps.length - (alloc.emps || []).length)),
        };
        room.sqItems = {};
        b.plots.forEach(p => { room.sqItems['p:' + p.id] = sqOf(p) - int((alloc.sq || {})['p:' + p.id]); });
        b.levels.forEach(l => { room.sqItems['w:' + l.id] = ((b.walls || {})[l.id] || []).length - int((alloc.sq || {})['w:' + l.id]); });
        let anyMore = left > 0 && (room.rec > 0 || room.cu > 0 || room.emp > 0 || (room.sq > 0 && Object.values(room.sqItems).some(v => v > 0)));
        return { cap, used: u, left, room, done: left <= 0 || !anyMore };
    }
    function applySD(b, alloc, log) {
        let sd = b.sd; if (!sd) return;
        let s = stats(b), u = sdSums(alloc), parts = [];
        let saved = s.medical ? Math.min(5, u.rec) : 0;
        if (u.rec) {
            let lost = loseRecruits(b, u.rec - saved);
            parts.push(`${plural(u.rec, 'Recruit')}${saved ? ` (the Medical staff saved ${saved}; ${lost.length} lost)` : ''}`);
        }
        if (u.cu) { b.vault.cu = Math.max(0, (b.vault.cu || 0) - u.cu * 100); parts.push(`${fmt(u.cu * 100)} Cu from the vault`); }
        Object.entries(alloc.sq || {}).forEach(([k, n]) => {
            n = Math.max(0, int(n)); if (!n) return;
            if (k.startsWith('p:')) {
                let p = b.plots.find(x => x.id === k.slice(2)); if (!p) return;
                p.cells = p.cells.slice(0, Math.max(0, p.cells.length - n));
                parts.push(`${plural(n, 'square')} of ${plotName(b, p)}${p.cells.length ? '' : ' (destroyed)'}`);
                if (!p.cells.length) b.plots = b.plots.filter(x => x !== p);
            } else if (k.startsWith('w:')) {
                let l = k.slice(2), segs = (b.walls || {})[l] || [];
                b.walls[l] = segs.slice(0, Math.max(0, segs.length - n));
                parts.push(`${plural(n, 'square')} of Wall${lvl(b, l) ? ' (' + lvl(b, l).name + ')' : ''}`);
            }
        });
        (alloc.emps || []).forEach(id => { let e = b.emps.find(x => x.id === id); if (e) { b.emps = b.emps.filter(x => x !== e); parts.push(`a Weapon Emplacement${e.label ? ' “' + e.label + '”' : ''}`); } });
        b.benches = b.benches.filter(w => b.plots.some(p => p.id === w.plot));
        tidyJobs(b);
        log(`Structural Damage ${sd.total}${sd.reason ? ' (' + sd.reason + ')' : ''} absorbed: ${parts.join(', ') || 'nothing could absorb it'}.`);
        b.sd = null;
    }

    // ── Militia ─────────────────────────────────────────────────
    function unitCost(size, mech) { return (UNITS[size] ? UNITS[size].cost : 0) * (mech ? 2 : 1); }
    function draftCheck(b, size, mech) {
        let u = UNITS[size]; if (!u) return 'Pick a unit.';
        let s = stats(b);
        if (!s.arsenal) return 'You need a working Arsenal Plot (fully staffed) to draft and keep Militia.';
        let free = b.recruits.filter(r => !r.job).length;
        if (free < u.recruits) return `A ${u.name} takes ${u.recruits} unassigned Recruits; you have ${free}.`;
        if ((b.vault.cu || 0) < unitCost(size, mech)) return `A ${mech ? 'Mechanized ' : ''}${u.name} costs ${fmt(unitCost(size, mech))} Cu (Currency only); the vault has ${fmt(b.vault.cu || 0)} Cu.`;
        return null;
    }
    function draft(b, size, mech, name) {
        let err = draftCheck(b, size, mech); if (err) return err;
        let u = UNITS[size], m = { id: rid('m'), size, mech: !!mech, name: name || '', hp: u.hp, stationed: true, day: b.day };
        b.vault.cu -= unitCost(size, mech);
        b.recruits.filter(r => !r.job).sort((a, c) => fitScore(a) - fitScore(c)).slice(0, u.recruits).forEach(r => { r.job = { k: 'mil', id: m.id }; });
        b.militia.push(m);
        return null;
    }
    function unitName(m) { let u = UNITS[m.size] || {}; return (m.name ? '“' + m.name + '” ' : '') + (m.mech ? 'Mechanized ' : '') + (u.name || 'Unit'); }
    // An attacking force for an Active Defense: Militia templates whose Garrison Defense adds up to the TL
    function enemyForce(tl) {
        let left = Math.max(0, int(tl)), out = [];
        let many = { company: 'Companies', platoon: 'Platoons', squad: 'Squads' };
        [['company', 50], ['platoon', 20], ['squad', 5]].forEach(([k, g]) => { let n = Math.floor(left / g); if (n) { out.push(n + ' ' + (n > 1 ? many[k] : UNITS[k].name)); left -= n * g; } });
        return { text: out.join(' + ') || 'none', left };
    }

    // ── Storage ─────────────────────────────────────────────────
    // The cloud (the world's invite code) or, for a local world, this browser. Same calls either way:
    //   listenMain(code, cb) / saveMain(code, data): the Bastion itself (only the GM's app saves it)
    //   listenCol(code, sub, cb) / putDoc / delDoc / getDoc: its sub-collections
    //   vote(code, sugId, uid, v): a vote on a suggestion (1, -1, or 0 to take it back)
    const LOCAL = {
        k: (code, sub) => 'apx_bastion_' + code + (sub ? '__' + sub : ''),
        subs: {},
        get(key, dflt) { try { let v = localStorage.getItem(key); return v ? JSON.parse(v) : dflt; } catch (e) { return dflt; } },
        set(key, v) {
            try { if (v == null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(v)); }
            catch (e) { return Promise.reject(new Error('This browser is out of storage space.')); }
            this.fire(key); return Promise.resolve();
        },
        fire(key) { let s = this.subs[key]; if (s) s.forEach(cb => setTimeout(cb, 0)); },
        on(key, cb) { (this.subs[key] = this.subs[key] || new Set()).add(cb); setTimeout(cb, 0); return () => { if (this.subs[key]) this.subs[key].delete(cb); }; },
        listenMain(code, cb) { let key = this.k(code); return this.on(key, () => cb(this.get(key, null))); },
        saveMain(code, data) { return this.set(this.k(code), data); },
        listenCol(code, sub, cb) { let key = this.k(code, sub); return this.on(key, () => { let o = this.get(key, {}); cb(Object.keys(o).map(id => Object.assign({ id }, o[id]))); }); },
        putDoc(code, sub, id, data, merge) {
            if (sub === 'imgs') return this.set(this.k(code, 'img_' + id), data);
            let key = this.k(code, sub), o = this.get(key, {});
            o[id] = merge ? Object.assign({}, o[id] || {}, data) : data;
            return this.set(key, o);
        },
        delDoc(code, sub, id) {
            if (sub === 'imgs') return this.set(this.k(code, 'img_' + id), null);
            let key = this.k(code, sub), o = this.get(key, {}); delete o[id]; return this.set(key, o);
        },
        getDoc(code, sub, id) { return Promise.resolve(sub === 'imgs' ? this.get(this.k(code, 'img_' + id), null) : (this.get(this.k(code, sub), {})[id] || null)); },
        vote(code, sid, uid, v) {
            let key = this.k(code, 'sugs'), o = this.get(key, {});
            if (!o[sid]) return Promise.resolve();
            let vs = Object.assign({}, o[sid].votes || {}); if (v) vs[uid] = v; else delete vs[uid];
            o[sid].votes = vs; return this.set(key, o);
        },
    };
    window.addEventListener('storage', e => { if (e.key && e.key.indexOf('apx_bastion_') === 0) LOCAL.fire(e.key); });
    const FIRE = {
        listenMain: (code, cb, err) => window.apxAuth.listenBastion(code, cb, err),
        saveMain: (code, data) => window.apxAuth.saveBastion(code, data),
        listenCol: (code, sub, cb, err) => window.apxAuth.listenBastionCol(code, sub, cb, err),
        putDoc: (code, sub, id, data, merge) => window.apxAuth.putBastionDoc(code, sub, id, data, merge),
        delDoc: (code, sub, id) => window.apxAuth.delBastionDoc(code, sub, id),
        getDoc: (code, sub, id) => window.apxAuth.getBastionDoc(code, sub, id),
        vote: (code, sid, uid, v) => window.apxAuth.voteBastionSug(code, sid, uid, v),
    };
    function pickStore(code) {
        let a = window.apxAuth;
        return !/^local_/.test(code) && a && a.enabled && a.user && typeof a.listenBastion === 'function' ? FIRE : LOCAL;
    }

    // ── This page's view of the Bastion ─────────────────────────
    const S = {
        gm: !!document.getElementById('gmWorldModal'),
        code: null, store: LOCAL, unsubs: [],
        b: null, loaded: false, sugs: [], reqs: [], live: {}, err: null,
        win: null, tab: 'overview',
        imgs: {}, done: new Set(), saving: 0, statusQueue: [], seenStatus: {}, firstData: true,
    };
    function me() {
        let uid = (window.apxAuth && window.apxAuth.user && window.apxAuth.user.uid) || window.APX_TEST_UID || (S.gm ? 'gm' : 'player');
        let name = S.gm ? 'GM' : ((window.state && window.state.name) || 'Player');
        return { uid, name };
    }
    function isManagerUid(b, uid) { let m = (b && b.managers) || []; return !m.length || m.includes(uid); }
    function canManage() { return S.gm || isManagerUid(S.b, me().uid); }
    // Which world's Bastion this page shows: the GM's open world, or the open character's world
    function ctx() {
        if (S.gm) {
            let w = typeof window.apxGmBastionWorld === 'function' ? window.apxGmBastionWorld() : null;
            if (!w || !w.worldId) return null;
            return { code: w.code ? String(w.code).toUpperCase().trim() : 'local_' + w.worldId, enabled: !!(w.settings && w.settings.bastion), world: w };
        }
        let code = window.apxActiveWorldCode ? window.apxActiveWorldCode() : null;
        if (!code) return null;
        let ws = window.apxActiveWorldSettings ? window.apxActiveWorldSettings() : null;
        return { code: String(code).toUpperCase().trim(), enabled: !!(ws && ws.bastion) };
    }
    function detach() {
        S.unsubs.forEach(u => { try { u(); } catch (e) { } });
        Object.assign(S, { unsubs: [], code: null, b: null, loaded: false, sugs: [], reqs: [], live: {}, err: null, statusQueue: [], seenStatus: {}, firstData: true });
        S.done = new Set();
    }
    function attach(code) {
        detach();
        S.code = code; S.store = pickStore(code);
        let onErr = e => { S.err = (e && (e.code || e.message)) || 'error'; render(); };
        S.unsubs.push(S.store.listenMain(code, d => {
            // (the GM's app is the only one that saves it: its own copy wins while a save is on its way)
            if (S.gm && S.b && (S.saving || !d || d.deleted || (d.updated || 0) < (S.b.updated || 0))) { S.loaded = true; return; }
            S.b = d && !d.deleted ? normalize(d) : null; S.loaded = true; S.err = null; changed();
        }, onErr));
        S.unsubs.push(S.store.listenCol(code, 'sugs', list => { S.sugs = list.sort((a, c) => (a.at || 0) - (c.at || 0)); changed(); }, onErr));
        S.unsubs.push(S.store.listenCol(code, 'reqs', list => { S.reqs = list.sort((a, c) => (a.at || 0) - (c.at || 0)); changed(); }, onErr));
        S.unsubs.push(S.store.listenCol(code, 'live', list => { S.live = {}; list.forEach(d => { S.live[d.id] = d; }); changed(); }, onErr));
        loadDraftOnce();
    }

    // ── The GM's app keeps the Bastion ──────────────────────────
    let _saveT = null, _waiters = [];
    function addLog(text, by) {
        if (!S.b) return;
        S.b.log = [{ t: Date.now(), day: S.b.day, text: String(text).slice(0, 600), by: by || '' }].concat(S.b.log || []).slice(0, 250);
    }
    function commit(text, by) {
        if (!S.gm || !S.b) return Promise.resolve(false);
        if (text) addLog(text, by);
        S.b.updated = Date.now();
        render(); draw();
        return new Promise(res => { _waiters.push(res); clearTimeout(_saveT); _saveT = setTimeout(() => { saveNow(); }, 300); });
    }
    function saveNow() {
        clearTimeout(_saveT);
        let ws = _waiters; _waiters = [];
        if (!S.gm || !S.b || !S.code) { ws.forEach(r => r(false)); return Promise.resolve(false); }
        let code = S.code, data = clone(S.b);
        S.saving++;
        return S.store.saveMain(code, data).then(() => true, e => { notify(rulesHint(e) || ('The Bastion could not be saved: ' + (e && e.message || e)), 'warn', true); return false; })
            .then(ok => { S.saving = Math.max(0, S.saving - 1); ws.forEach(r => r(ok)); if (ok) flushStatus(); return ok; });
    }
    // Answers to requests go out once the Bastion they changed is saved
    function flushStatus() {
        let q = S.statusQueue; S.statusQueue = [];
        q.forEach(([id, st]) => S.store.putDoc(S.code, 'reqs', id, st, true).catch(() => {}));
    }
    let _procT = null, _procBusy = false;
    function gmProcessSoon() { if (S.gm && S.b) { clearTimeout(_procT); _procT = setTimeout(gmProcess, 120); } }
    function gmProcess() {
        if (!S.gm || !S.b || _procBusy) return;
        _procBusy = true;
        try {
            let b = S.b, now = Date.now(), n = 0;
            b.seen = b.seen || [];
            S.reqs.forEach(r => {
                if (r.status === 'done' || r.status === 'declined') {
                    if (now - (r.doneAt || r.at || 0) > 120000 && !S.done.has('del:' + r.id)) { S.done.add('del:' + r.id); S.store.delDoc(S.code, 'reqs', r.id).catch(() => {}); }
                    return;
                }
                if (r.status === 'waiting' || S.done.has(r.id)) return;
                S.done.add(r.id);
                let res = b.seen.includes(r.id) ? { status: 'done', reply: 'Done.' } : applyReq(b, r);
                if (res.status !== 'waiting') { b.seen = [r.id].concat(b.seen).slice(0, 300); res.doneAt = Date.now(); }
                S.statusQueue.push([r.id, res]);
                n++;
            });
            // The shared Structural Damage choices, confirmed by a manager
            let sd = S.live.sd;
            if (sd && sd.confirm && b.sd && sd.sdId === b.sd.id && !S.done.has('sd:' + sd.sdId)) {
                let chk = sdRoom(b, sd.alloc, b.sd.total);
                if (chk.done && isManagerUid(b, sd.by)) {
                    S.done.add('sd:' + sd.sdId);
                    applySD(b, sd.alloc || {}, t => addLog(t, sd.byName || ''));
                    S.store.delDoc(S.code, 'live', 'sd').catch(() => {});
                    n++;
                }
            }
            if (!n) return;
            b.updated = Date.now();
            render(); draw();
            saveNow();
        } finally { _procBusy = false; }
    }
    function cleanAmt(r) { return { cu: Math.max(0, int(r.cu)), common: Math.max(0, int(r.common)), uncommon: Math.max(0, int(r.uncommon)), rare: Math.max(0, int(r.rare)) }; }
    function applyReq(b, r) {
        let who = r.byName || 'A player', mgr = isManagerUid(b, r.by), log = t => addLog(t, who);
        let only = () => ({ status: 'declined', reply: 'Only the Bastion\'s managers can do that.' });
        switch (r.kind) {
            case 'deposit': {
                let amt = cleanAmt(r);
                addTo(b.vault, amt);
                log(`${who} put ${vaultText(amt)} in the vault.`);
                return { status: 'done', reply: 'Added to the vault.' };
            }
            case 'withdraw': case 'draft':
                return mgr ? { status: 'waiting', reply: 'Waiting for the GM to approve it.' } : only();
            case 'assign': {
                if (!mgr) return only();
                let err = assignOne(b, r.k, r.target, int(r.add) > 0 ? 1 : -1);
                return err ? { status: 'declined', reply: err } : { status: 'done', reply: 'Done.' };
            }
            case 'autoAssign': {
                if (!mgr) return only();
                let n = autoAssign(b);
                if (n) log(`${who} put ${plural(n, 'Recruit')} to work.`);
                return { status: 'done', reply: n ? `${plural(n, 'Recruit')} put to work.` : 'No job could be filled.' };
            }
            case 'recruit': {
                if (!mgr) return only();
                if (b.recruitWeek === week(b)) return { status: 'declined', reply: `The Bastion already recruited in Week ${week(b)}.` };
                b.recruitWeek = week(b);
                let res = recruitFrom(r.rolls || [1]);
                return { status: 'done', reply: recruitArrives(b, res, who) };
            }
            case 'check': {
                resolveCheck(b, { stat: r.stat, total: int(r.total), nat: int(r.nat), who, askId: r.askId || null }, log);
                return { status: 'done', reply: 'Logged.' };
            }
            case 'militia': {
                if (!mgr) return only();
                let m = b.militia.find(x => x.id === r.target);
                if (!m) return { status: 'declined', reply: 'That unit is gone.' };
                if (r.op === 'station' || r.op === 'deploy') { m.stationed = r.op === 'station'; log(`${unitName(m)} ${m.stationed ? 'is stationed at the Bastion (Garrison Defense)' : 'deployed: it leaves the Bastion'}.`); }
                if (r.op === 'disband') { disband(b, m); log(`${unitName(m)} was disbanded: its Recruits are back without a job.`); }
                return { status: 'done', reply: 'Done.' };
            }
            case 'levelImg': {
                let l = lvl(b, r.level);
                if (!l) return { status: 'declined', reply: 'That level is gone.' };
                if (l.img && !mgr) return { status: 'declined', reply: 'Only a manager can replace a level\'s picture.' };
                l.img = r.img || null;
                log(`${who} ${r.img ? 'set a picture for' : 'removed the picture from'} the ${l.name} level.`);
                return { status: 'done', reply: 'Done.' };
            }
            case 'relax':
                log(`${who} spent a week of downtime relaxing at the Medical Plot (free): ${String(r.text || '').slice(0, 300)}`);
                return { status: 'done', reply: 'Logged.' };
            default:
                return { status: 'declined', reply: 'The GM\'s app doesn\'t know that request.' };
        }
    }
    function recruitArrives(b, res, who) {
        let s = stats(b), log = t => addLog(t, who);
        if (res.none) { log(`Recruitment (Week ${week(b)}): ${res.text}`); return res.text; }
        if (s.pop >= s.popCap) { let t = `Recruitment (Week ${week(b)}): ${res.text} But there's no room for them (Population ${s.pop}, Housing cap ${s.popCap}), so they were turned away.`; log(t); return t; }
        let r = addRecruit(b, res.traits);
        let t = `Recruitment (Week ${week(b)}): ${res.text} A new ${r.traits.join(' & ')} Recruit joins the Bastion.`;
        log(t); return t;
    }
    function resolveCheck(b, o, log) {
        let a = b.ask, label = STATS[o.stat] || 'Bastion';
        let line = `${o.who} rolled a ${label} check: ${o.total}${o.nat ? ` (d100 ${o.nat})` : ''}`;
        if (a && o.askId === a.id) {
            if (o.total >= a.tl) log(`${line} against TL ${a.tl}${a.reason ? ' (' + a.reason + ')' : ''}: the Bastion endures it unscathed.`);
            else {
                let dmg = a.tl - o.total;
                b.sd = { id: rid('d'), total: dmg, reason: a.reason || (a.raid ? 'Raid' : label + ' check'), at: Date.now() };
                log(`${line} against TL ${a.tl}${a.reason ? ' (' + a.reason + ')' : ''}: failed by ${dmg}. The Bastion suffers ${dmg} Structural Damage.`);
            }
            b.ask = null;
            return;
        }
        log(line + '.');
    }
    function disband(b, m) {
        b.recruits.forEach(r => { if (r.job && r.job.k === 'mil' && r.job.id === m.id) r.job = null; });
        b.militia = b.militia.filter(x => x !== m);
    }
    // Send a request (anyone in the world). The GM's own page acts directly instead.
    function send(kind, data) {
        if (!S.code) return Promise.reject(new Error('There is no Bastion here.'));
        let m = me(), id = rid('q');
        let doc = Object.assign({ kind, by: m.uid, byName: m.name, at: Date.now(), status: 'new' }, data || {});
        return S.store.putDoc(S.code, 'reqs', id, doc, false).then(() => id).catch(e => { notify(rulesHint(e) || ('Could not reach the Bastion: ' + (e && e.message || e)), 'warn', true); throw e; });
    }
    function rulesHint(e) {
        let m = String((e && (e.code || e.message)) || e || '');
        if (!/permission/i.test(m)) return '';
        return S.gm ? 'The Bastion needs the new Firestore rules: paste FIREBASE_RULES.txt into the Firebase Console (Firestore Database > Rules), then reload.'
            : 'The Bastion needs the new Firestore rules: ask your GM to paste FIREBASE_RULES.txt into the Firebase Console (Firestore Database > Rules).';
    }

    // ── The window ──────────────────────────────────────────────
    const CSS = `
#apxBastionWin{position:fixed;z-index:2000;display:flex;flex-direction:column;resize:both;overflow:hidden;min-width:320px;min-height:260px;max-width:100vw;max-height:100vh;background:var(--c-surface2,#0f172a);color:var(--c-text,#e2e8f0);border:1px solid #b45309;border-radius:.6rem;box-shadow:0 14px 50px rgba(0,0,0,.6);font-size:.78rem;line-height:1.35}
#apxBastionWin .bx-head{display:flex;align-items:center;gap:.5rem;padding:.4rem .6rem;background:var(--c-surface,#1e293b);border-bottom:1px solid var(--c-border,#334155);border-radius:.6rem .6rem 0 0}
#apxBastionWin .bx-title{font-weight:900;color:#f59e0b;font-size:.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#apxBastionWin .bx-when{font-size:.68rem;color:var(--c-text-muted,#94a3b8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#apxBastionWin .bx-x{background:none;border:0;color:var(--c-text-muted,#94a3b8);font-size:1rem;cursor:pointer;padding:0 .2rem}
#apxBastionWin .bx-tabs{display:flex;gap:.25rem;flex-wrap:wrap;padding:.35rem .5rem;border-bottom:1px solid var(--c-border,#334155)}
#apxBastionWin .bx-tabs button{font-size:.72rem;font-weight:800;padding:.25rem .6rem;border-radius:.35rem;border:1px solid var(--c-border2,#475569);background:var(--c-surface,#1e293b);color:var(--c-text-dimmer,#cbd5e1);cursor:pointer}
#apxBastionWin .bx-tabs button.on{background:#b45309;border-color:#f59e0b;color:#fff}
#apxBastionWin .bx-badge{display:inline-block;min-width:1.1em;padding:0 .3em;border-radius:1em;background:#dc2626;color:#fff;font-size:.62rem;text-align:center}
#apxBastionWin .bx-body{flex:1;min-height:0;overflow:auto;padding:.6rem}
#apxBastionWin .bx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:.5rem;margin-bottom:.5rem}
#apxBastionWin .bx-card{border:1px solid var(--c-border,#334155);background:var(--c-surface,#1e293b);border-radius:.5rem;padding:.55rem;margin-bottom:.5rem;min-width:0}
#apxBastionWin .bx-grid>.bx-card{margin-bottom:0}
#apxBastionWin .bx-h{font-size:.64rem;font-weight:900;text-transform:uppercase;letter-spacing:.05em;color:var(--c-text-muted,#94a3b8);margin:0 0 .3rem}
#apxBastionWin .bx-v{font-size:1.4rem;font-weight:900;color:var(--c-text,#fff);line-height:1.1}
#apxBastionWin .bx-m{font-size:.68rem;color:var(--c-text-muted,#94a3b8);line-height:1.35}
#apxBastionWin .bx-row{display:flex;align-items:center;gap:.35rem;flex-wrap:wrap}
#apxBastionWin .bx-btn{font-size:.7rem;font-weight:800;padding:.22rem .55rem;border-radius:.35rem;border:1px solid var(--c-border2,#475569);background:var(--c-surface2,#0f172a);color:var(--c-text,#e2e8f0);cursor:pointer;white-space:nowrap}
#apxBastionWin .bx-btn:hover{filter:brightness(1.25)}
#apxBastionWin .bx-btn.pri{background:#b45309;border-color:#f59e0b;color:#fff}
#apxBastionWin .bx-btn.ok{background:#065f46;border-color:#10b981;color:#ecfdf5}
#apxBastionWin .bx-btn.bad{background:#7f1d1d;border-color:#ef4444;color:#fee2e2}
#apxBastionWin .bx-btn.on{outline:2px solid #f59e0b;outline-offset:-1px;background:#78350f;color:#fff}
#apxBastionWin .bx-btn:disabled{opacity:.45;cursor:not-allowed;filter:none}
#apxBastionWin .bx-btn.sm{padding:.05rem .4rem;font-size:.68rem}
#apxBastionWin .bx-in{background:var(--c-surface2,#0f172a);color:inherit;border:1px solid var(--c-border2,#475569);border-radius:.3rem;font-size:.72rem;padding:.15rem .3rem;min-width:0}
#apxBastionWin .bx-ban{border-radius:.5rem;padding:.5rem .6rem;margin-bottom:.5rem;border:1px solid #f59e0b;background:rgba(180,83,9,.18)}
#apxBastionWin .bx-ban.red{border-color:#ef4444;background:rgba(127,29,29,.28)}
#apxBastionWin .bx-ban.blue{border-color:#38bdf8;background:rgba(14,116,144,.22)}
#apxBastionWin .bx-bar{height:.4rem;border-radius:1rem;background:var(--c-surface2,#0f172a);overflow:hidden;border:1px solid var(--c-border,#334155);margin:.2rem 0}
#apxBastionWin .bx-bar>i{display:block;height:100%;background:#f59e0b}
#apxBastionWin .bx-chip{display:inline-flex;align-items:center;gap:.25rem;font-size:.66rem;font-weight:800;padding:.1rem .45rem;border-radius:1rem;border:1px solid var(--c-border2,#475569);background:var(--c-surface2,#0f172a);margin:0 .2rem .25rem 0}
#apxBastionWin .bx-tbl{width:100%;border-collapse:collapse;font-size:.72rem}
#apxBastionWin .bx-tbl td,#apxBastionWin .bx-tbl th{padding:.25rem .3rem;border-bottom:1px solid var(--c-border,#334155);text-align:left;vertical-align:middle}
#apxBastionWin .bx-tbl th{font-size:.62rem;text-transform:uppercase;color:var(--c-text-muted,#94a3b8)}
#apxBastionWin .bx-good{color:#34d399}#apxBastionWin .bx-warn{color:#fbbf24}#apxBastionWin .bx-badc{color:#f87171}
#apxBastionWin .bx-log{padding:.3rem 0;border-bottom:1px solid var(--c-border,#334155)}
#apxBastionWin .bx-pj{padding:.35rem 0;border-bottom:1px solid var(--c-border,#334155)}
#apxBastionWin .bx-num{display:inline-block;min-width:1.8em;text-align:center;font-weight:900}
#apxBastionWin .bx-bld{display:flex;gap:.5rem;height:100%;min-height:0}
#apxBastionWin .bx-bld.col{flex-direction:column;height:auto}
#apxBastionWin .bx-bld-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:.35rem;min-height:0}
#apxBastionWin .bx-bld.col .bx-bld-main{min-height:420px}
#apxBastionWin .bx-cv{flex:1;position:relative;min-height:240px;border-radius:.45rem;overflow:hidden;border:1px solid var(--c-border,#334155);background:#020617;touch-action:none}
#apxBastionWin .bx-cv canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
#apxBastionWin .bx-cv-hint{position:absolute;left:.4rem;bottom:.35rem;right:.4rem;font-size:.66rem;color:#e2e8f0;text-shadow:0 1px 3px #000;pointer-events:none}
#apxBastionWin .bx-side{width:310px;flex-shrink:0;overflow:auto;min-height:0}
#apxBastionWin .bx-bld.col .bx-side{width:auto;overflow:visible}
#apxBastionWin .bx-sug{border:1px solid var(--c-border,#334155);border-radius:.45rem;padding:.4rem;margin-bottom:.35rem;background:var(--c-surface2,#0f172a)}
#apxBastionWin .bx-dot{display:inline-block;width:.65rem;height:.65rem;border-radius:.2rem;vertical-align:-1px}
#apxBastionWin .bx-tools .bx-btn{padding:.2rem .45rem}
#apxBastionWin select.bx-in{width:auto;max-width:100%}
#apxBastionWin .bx-bld.col .bx-cv{flex:none;height:min(62vh,540px)}
`;
    function injectCss() {
        if (document.getElementById('apxBastionCss')) return;
        let s = document.createElement('style'); s.id = 'apxBastionCss'; s.textContent = CSS; document.head.appendChild(s);
    }
    function winPos() {
        let d = { w: Math.min(1100, innerWidth - 16), h: Math.min(760, innerHeight - 70) };
        d.x = Math.max(4, Math.round((innerWidth - d.w) / 2)); d.y = Math.max(4, Math.min(56, innerHeight - d.h - 8));
        try { let p = JSON.parse(localStorage.getItem('apx_bastion_win') || 'null'); if (p && p.w > 200) d = p; } catch (e) { }
        d.w = Math.min(d.w, innerWidth - 4); d.h = Math.min(d.h, innerHeight - 4);
        d.x = Math.max(0, Math.min(d.x, innerWidth - 80)); d.y = Math.max(0, Math.min(d.y, innerHeight - 40));
        return d;
    }
    let _posT = null;
    function savePosSoon() {
        clearTimeout(_posT);
        _posT = setTimeout(() => { let w = S.win; if (!w || !w.isConnected || w.dataset.apxMin) return; let r = w.getBoundingClientRect(); try { localStorage.setItem('apx_bastion_win', JSON.stringify({ x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) })); } catch (e) { } }, 400);
    }
    function openWin(tab) {
        if (!S.code) { notify(S.gm ? 'Turn the Bastion on in World Settings first (with a world open).' : 'Your GM hasn\'t given the party a Bastion in this world yet.', 'warn', true); return; }
        injectCss();
        if (tab) S.tab = tab;
        if (S.win && S.win.isConnected) { window.apxFront && window.apxFront(S.win); render(); return; }
        let p = winPos();
        let w = document.createElement('div');
        w.id = 'apxBastionWin'; w.dataset.apxTitle = 'Bastion';
        w.style.left = p.x + 'px'; w.style.top = p.y + 'px'; w.style.width = p.w + 'px'; w.style.height = p.h + 'px';
        w.innerHTML = `<div class="bx-head" data-bx-head><b class="bx-title" data-win-title>Bastion</b><span class="bx-when" data-bx-when></span><span style="flex:1"></span><button class="bx-x" data-act="close" title="Close">✕</button></div>
            <div class="bx-tabs" data-bx-tabs></div><div class="bx-body" data-bx-body></div>`;
        document.body.appendChild(w);
        S.win = w;
        if (window.apxMakeDraggable) window.apxMakeDraggable(w, w.querySelector('[data-bx-head]'));
        w.querySelector('[data-bx-head]').addEventListener('pointerup', savePosSoon);
        if (window.apxFront) window.apxFront(w);
        wire(w);
        if (window.ResizeObserver) new ResizeObserver(() => { savePosSoon(); if (S.tab === 'build') { layoutBuild(); if (!BL.moved) BL.view = null; draw(); } }).observe(w);
        render();
    }
    function closeWin() { if (S.win) { S.win.remove(); S.win = null; } BL.cv = null; }

    let _renderPending = false;
    function render() {
        let w = S.win; if (!w || !w.isConnected) return;
        let body = w.querySelector('[data-bx-body]');
        // Never redraw a box someone's typing in: wait until they leave it
        let a = document.activeElement;
        if (a && body.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'checkbox' && a.type !== 'radio') { _renderPending = true; return; }
        _renderPending = false;
        w.querySelector('[data-bx-when]').textContent = S.b ? when(S.b) : '';
        w.querySelector('.bx-title').textContent = S.b ? S.b.name : 'Bastion';
        w.querySelector('[data-bx-tabs]').innerHTML = S.b ? tabsHtml() : '';
        w.querySelector('[data-bx-tabs]').style.display = S.b ? '' : 'none';
        if (S.b && S.tab === 'build') { renderBuild(body); return; }
        BL.cv = null;
        let top = body.scrollTop;
        body.innerHTML = bodyHtml();
        body.scrollTop = top;
    }
    function tabsHtml() {
        let b = S.b, list = [['overview', 'Overview'], ['build', 'Build'], ['recruits', 'Recruits'], ['defense', 'Defense'], ['log', 'Log']];
        if (S.gm) list.push(['setup', 'Setup']);
        let open = S.sugs.filter(x => x.status === 'open').length;
        let badge = { build: open || '', defense: b.sd ? '!' : '', overview: (b.ask && canManage()) || (S.gm && (b.monthDue || S.reqs.some(r => r.status === 'waiting'))) ? '!' : '' };
        return list.map(([k, l]) => `<button data-act="tab" data-tab="${k}" class="${S.tab === k ? 'on' : ''}">${l}${badge[k] ? ` <span class="bx-badge">${badge[k]}</span>` : ''}</button>`).join('');
    }
    function bodyHtml() {
        if (S.err && !S.b) return `<div class="bx-ban red">${esc(rulesHint(S.err) || 'The Bastion could not be loaded: ' + S.err)}</div>`;
        if (!S.loaded) return '<div class="bx-m">Loading the Bastion…</div>';
        if (!S.b) return S.gm ? foundHtml() : `<div class="bx-card"><div class="bx-h">Bastion</div><div>Your GM has turned on Bastions for this world, but hasn't founded yours yet. It appears here as soon as they do.</div></div>`;
        switch (S.tab) {
            case 'recruits': return recruitsHtml();
            case 'defense': return defenseHtml();
            case 'log': return logHtml();
            case 'setup': return S.gm ? setupHtml() : overviewHtml();
            default: return overviewHtml();
        }
    }

    // ── Founding (GM) ───────────────────────────────────────────
    function partyList() {
        let out = [], seen = new Set();
        (window.gmParty || []).forEach(p => { if (p && p.fileName && !seen.has(p.fileName)) { seen.add(p.fileName); out.push({ uid: p.fileName, name: (p.state && p.state.name) || (p.summary && p.summary.name) || 'Player' }); } });
        S.sugs.concat(S.reqs).forEach(x => { if (x.by && x.by !== 'gm' && !seen.has(x.by)) { seen.add(x.by); out.push({ uid: x.by, name: x.byName || 'Player' }); } });
        ((S.b && S.b.managers) || []).forEach(u => { if (!seen.has(u)) { seen.add(u); out.push({ uid: u, name: 'Player (' + u.slice(0, 6) + ')' }); } });
        return out;
    }
    function managersHtml(sel) {
        let party = partyList();
        if (!party.length) return '<div class="bx-m">No players in this world yet. With no managers picked, every player is a manager.</div>';
        return `<div class="bx-row">${party.map(p => `<label class="bx-chip" style="cursor:pointer"><input type="checkbox" data-mgr="${esc(p.uid)}" ${sel.includes(p.uid) ? 'checked' : ''}> ${esc(p.name)}</label>`).join('')}</div>
            <div class="bx-m">Managers draw and submit building suggestions, assign Recruits, roll the Bastion's checks and ask for Currency from the vault (you approve spending). None picked: every player is a manager.</div>`;
    }
    function foundHtml() {
        let w = (window.apxGmBastionWorld && window.apxGmBastionWorld()) || {};
        return `<div class="bx-card" style="max-width:640px">
            <div class="bx-h">Found the party's Bastion</div>
            <div class="bx-m" style="margin-bottom:.5rem">The party has earned a Bastion: a sanctuary, a trading post, the start of a new society. Name it, say how it was founded, and pick who manages it. Everything else (the land, levels above and below, water) is set up on the Build tab.</div>
            <div class="bx-row" style="margin-bottom:.4rem"><span style="width:7rem">Name</span><input class="bx-in" data-f="name" value="${esc((w.name ? w.name + ' ' : '') + 'Bastion')}" style="flex:1"></div>
            <div class="bx-row" style="margin-bottom:.4rem"><span style="width:7rem">Founded</span><select class="bx-in" data-f="founded">${Object.entries(FOUNDED).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
                <span class="bx-m">Granted (a charter or deed), Purchased, Conquered (cleared of its last owners) or Claimed (a stake in the ground)</span></div>
            <div class="bx-row" style="margin-bottom:.4rem"><span style="width:7rem">Story note</span><input class="bx-in" data-f="note" placeholder="Granted by the Governor after the siege" style="flex:1"></div>
            <div class="bx-row" style="margin-bottom:.4rem"><span style="width:7rem">Map size</span><input class="bx-in" data-f="cols" type="number" min="8" max="120" value="40" style="width:4.5rem"> × <input class="bx-in" data-f="rows" type="number" min="8" max="120" value="28" style="width:4.5rem"> <span class="bx-m">squares (you can change it later)</span></div>
            <div style="margin:.5rem 0 .3rem;font-weight:800">Managers</div>${managersHtml([])}
            <div class="bx-row" style="margin-top:.6rem"><button class="bx-btn pri" data-act="found">Found the Bastion</button></div></div>`;
    }

    // ── Overview ────────────────────────────────────────────────
    function statCard(key, label, value, sub, lines, s, mgr) {
        let chk = key ? s.checks[key] : null;
        return `<div class="bx-card" data-tip="${esc(lines.filter(Boolean).join('\n'))}">
            <div class="bx-h">${label}</div><div class="bx-v">${value}</div><div class="bx-m">${sub}</div>
            ${chk != null ? `<div class="bx-row" style="margin-top:.35rem"><span class="bx-m">${label} check: d100 + ${chk}</span>${mgr ? `<button class="bx-btn sm" data-act="roll" data-stat="${key}">Roll</button>` : ''}</div>` : ''}</div>`;
    }
    function bannersHtml(b, s, mgr) {
        let out = [];
        if (S.err) out.push(`<div class="bx-ban red">${esc(rulesHint(S.err) || 'Connection problem: ' + S.err)}</div>`);
        if (b.ask) out.push(`<div class="bx-ban"><b>${b.ask.raid ? 'Raid! ' : ''}The GM asks for a ${STATS[b.ask.stat]} check</b> against TL ${b.ask.tl}${b.ask.reason ? ': ' + esc(b.ask.reason) : ''}.
            <div class="bx-m">d100 + ${s.checks[b.ask.stat]}. Meet or beat the TL and the Bastion endures it unscathed; otherwise it takes Structural Damage equal to the difference.</div>
            <div class="bx-row" style="margin-top:.3rem">${mgr ? `<button class="bx-btn pri" data-act="roll" data-stat="${b.ask.stat}">Roll the ${STATS[b.ask.stat]} check</button>` : '<span class="bx-m">One of the Bastion\'s managers rolls it.</span>'}${S.gm ? '<button class="bx-btn" data-act="askCancel">Call it off</button>' : ''}</div></div>`);
        if (b.raid) {
            let f = enemyForce(b.raid.tl);
            out.push(`<div class="bx-ban red"><b>Active Defense</b> against a TL ${b.raid.tl} Raid${b.raid.reason ? ' (' + esc(b.raid.reason) + ')' : ''}.
                <div class="bx-m">Play it out on the battle map at Vehicle Scale. The attackers (Garrison Defense adding up to the TL): ${esc(f.text)}${f.left ? ` (+${f.left} left over)` : ''}. If the Bastion's Militia are defeated, it takes ${b.raid.tl} Structural Damage.</div>
                ${S.gm ? `<div class="bx-row" style="margin-top:.3rem"><button class="bx-btn ok" data-act="raidEnd" data-won="1">The Militia held</button><button class="bx-btn bad" data-act="raidEnd" data-won="0">The Militia were defeated</button></div>` : ''}</div>`);
        }
        if (b.sd) out.push(`<div class="bx-ban red"><b>${b.sd.total} Structural Damage</b>${b.sd.reason ? ' (' + esc(b.sd.reason) + ')' : ''} to absorb. ${mgr ? 'Choose what the Bastion loses.' : 'The managers and GM choose what the Bastion loses.'} <button class="bx-btn pri sm" data-act="tab" data-tab="defense">Open</button></div>`);
        if (S.gm && b.monthDue) out.push(`<div class="bx-ban"><b>End of Month ${b.monthDue}.</b> Roll to see if a hostile faction, a wandering monster horde or a desperate raider gang attacks the Bastion.
            <div class="bx-row" style="margin-top:.3rem">Chance <input class="bx-in" data-raidchance type="number" min="0" max="100" value="${int(b.raidChance, 50)}" style="width:3.6rem">% <button class="bx-btn pri" data-act="raidRoll">Roll d100</button><button class="bx-btn" data-act="raidForm">A Raid comes…</button><button class="bx-btn" data-act="raidNone">No raid this month</button></div></div>`);
        if (s.deficit > 0) out.push(`<div class="bx-ban red">Only ${s.supplies} Supplies for a Population of ${s.pop}: at the end of the week ${plural(s.deficit, 'Recruit')} will abandon the Bastion or starve. Staff (or build) more Supply Plots.</div>`);
        return out.join('');
    }
    function overviewHtml() {
        let b = S.b, s = stats(b), mgr = canManage();
        let cmd = s.command ? ` + Command ${s.command}` : '';
        let cards = [
            statCard('population', 'Population', `${s.pop}<span style="font-size:.8rem;color:var(--c-text-muted)"> / ${s.popCap}</span>`, 'Recruits / Housing cap',
                ['Population: every living Recruit.', `Recruits: ${s.pop}`, `Population cap (Housing Plots, +1 per 4 squares): ${s.popCap}`].concat(s.tips.popCap || [], [`Check: d100 + Population ${s.pop}${cmd}`]), s, mgr),
            statCard('supplies', 'Supplies', s.supplies, `a week · ${s.pop} eaten (1 per Recruit)${s.deficit ? ' · <span class="bx-badc">short ' + s.deficit + '</span>' : ''}`,
                ['Supplies: weekly food, water and basic medical gear.'].concat(s.tips.supplies || ['(no working Supply Plots)'], [`Check: d100 + Supplies ${s.supplies} + Supply Plots ${s.supplyBonus}${cmd}`]), s, mgr),
            statCard('power', 'Power', s.power, `a week${s.powerUsed ? ` · ${s.powerUsed} drawn by Automated Emplacements` : ''}`,
                ['Power: weekly energy (electricity, leylines, steam, solar).'].concat(s.tips.power || ['(no working Power Plots)'], [`Check: d100 + Power ${s.power} + Power Plots ${s.powerBonus}${cmd}`]), s, mgr),
            statCard('defense', 'Defense', s.defense, 'Base 10 + Walls + Emplacements + Militia', (s.tips.defense || []).concat([`Check: d100 + Defense ${s.defense}${cmd}`]), s, mgr),
        ];
        let v = b.vault;
        let myPending = S.reqs.filter(r => r.status === 'new' && (r.kind === 'deposit'));
        let vault = `<div class="bx-card"><div class="bx-h">Vault</div>
            <div class="bx-v" style="font-size:1.05rem">${fmt(v.cu)} Cu</div>
            <div class="bx-m">Crafting Materials: ${fmt(v.common)} Common, ${fmt(v.uncommon)} Uncommon, ${fmt(v.rare)} Rare</div>
            <div class="bx-m" data-tip="Building takes Currency, or half as much value in Crafting Materials: a Common one pays 2 Cu of building, an Uncommon 10, a Rare 20.">Worth ${fmt(buildValue(v))} Cu toward building${s.weeklyCu ? ` · Commerce: +${fmt(s.weeklyCu)} Cu a week` : ''}</div>
            ${myPending.length ? `<div class="bx-m bx-warn">${plural(myPending.length, 'deposit')} on the way (your GM's app adds ${myPending.length === 1 ? 'it' : 'them'})</div>` : ''}
            <div class="bx-row" style="margin-top:.35rem">${S.gm ? '<button class="bx-btn" data-act="vaultEdit">Add or take out…</button>' : '<button class="bx-btn ok" data-act="deposit">Deposit…</button>' + (mgr ? '<button class="bx-btn" data-act="withdraw">Withdraw…</button>' : '')}</div></div>`;
        let dw = 7 - (b.day % 7), dm = 28 - (b.day % 28);
        let time = `<div class="bx-card"><div class="bx-h">Time</div><div class="bx-v" style="font-size:1.05rem">Day ${b.day + 1}</div>
            <div class="bx-m">Week ${week(b)} ends in ${plural(dw, 'day')} · Month ${month(b)} in ${plural(dm, 'day')}</div>
            ${S.gm ? `<div class="bx-row" style="margin-top:.35rem"><button class="bx-btn pri" data-act="adv" data-n="1">+1 Day</button><button class="bx-btn pri" data-act="adv" data-n="7">+1 Week</button><button class="bx-btn" data-act="advN">+ Days…</button></div>
                <div class="bx-m" style="margin-top:.25rem">Each day pays for a day of building. Each week: Commerce Currency comes in and every Recruit eats 1 Supply. Each month: your Raid roll.</div>` : '<div class="bx-m" style="margin-top:.25rem">Your GM moves the Bastion\'s time forward.</div>'}</div>`;
        let canRecruit = b.recruitWeek !== week(b);
        let recruit = `<div class="bx-card"><div class="bx-h">Recruitment</div>
            <div class="bx-m">Once a week, broadcast a signal, post bounties or send out flyers: roll 1d8 to see who arrives. Room for ${Math.max(0, s.popCap - s.pop)} more (Housing).</div>
            <div class="bx-row" style="margin-top:.35rem">${mgr ? `<button class="bx-btn ok" data-act="recruit" ${canRecruit ? '' : 'disabled'}>Recruit (1d8)</button>` : ''}<span class="bx-m">${canRecruit ? 'Not done yet this week.' : 'Done this week.'}</span></div></div>`;
        return bannersHtml(b, s, mgr) + `<div class="bx-grid">${cards.join('')}</div><div class="bx-grid">${vault}${time}${recruit}</div>` + projectsHtml(b) + requestsHtml(b) + idleHtml(s) + relaxHtml(s);
    }
    function projectsHtml(b) {
        if (!b.projects.length) return `<div class="bx-card"><div class="bx-h">Construction</div><div class="bx-m">Nothing being built. Managers draw suggestions on the Build tab; the GM starts the ones the party wants.</div></div>`;
        let rows = b.projects.map((p, i) => {
            let pct = Math.round(100 * p.daysDone / Math.max(1, p.days));
            let st = p.status === 'paused' ? `<span class="bx-badc">Paused: the vault needs ${fmt(p.need)} Cu (or half that in Crafting Materials) for the next day</span>` : p.daysDone ? '<span class="bx-good">Building</span>' : '<span class="bx-warn">Starts with the next day of work</span>';
            return `<div class="bx-pj"><div class="bx-row"><b style="flex:1;min-width:10rem">${esc(p.title)}</b><span class="bx-m">${fmt(p.cost)} Cu · day ${p.daysDone} of ${p.days}</span>
                ${S.gm ? `${i ? `<button class="bx-btn sm" data-act="pjUp" data-id="${p.id}" title="Build it sooner (it pays first each day)">↑</button>` : ''}<button class="bx-btn sm ok" data-act="pjFinish" data-id="${p.id}">Finish now</button><button class="bx-btn sm bad" data-act="pjCancel" data-id="${p.id}">Cancel</button>` : ''}</div>
                <div class="bx-bar"><i style="width:${pct}%"></i></div><div class="bx-m">${st}${p.by ? ' · suggested by ' + esc(p.by) : ''}</div></div>`;
        }).join('');
        let next = b.projects.reduce((a, p) => a + (Math.floor(p.cost * (p.daysDone + 1) / p.days) - Math.floor(p.cost * p.daysDone / p.days)), 0);
        return `<div class="bx-card"><div class="bx-h">Construction (${b.projects.length})</div>${rows}<div class="bx-m" style="margin-top:.3rem">The next day of work costs ${fmt(next)} Cu in all. When the vault runs short, building pauses until more is added.</div></div>`;
    }
    function reqLabel(r) {
        let amt = vaultText(cleanAmt(r));
        switch (r.kind) {
            case 'deposit': return `Deposit ${amt}`;
            case 'withdraw': return `Withdraw ${amt}`;
            case 'draft': return `Draft a ${r.mech ? 'Mechanized ' : ''}${(UNITS[r.size] || {}).name || 'unit'}${r.name ? ' “' + r.name + '”' : ''} (${fmt(unitCost(r.size, r.mech))} Cu)`;
            case 'assign': return r.add > 0 ? 'Assign a Recruit' : 'Take a Recruit off a job';
            case 'autoAssign': return 'Put Recruits to work';
            case 'recruit': return 'Recruitment';
            case 'check': return `${STATS[r.stat] || ''} check: ${r.total}`;
            case 'militia': return 'Militia orders';
            case 'levelImg': return 'Level picture';
            case 'relax': return 'Relaxation';
            default: return r.kind;
        }
    }
    function requestsHtml(b) {
        let uid = me().uid;
        if (S.gm) {
            let wait = S.reqs.filter(r => r.status === 'waiting');
            if (!wait.length) return '';
            return `<div class="bx-card" style="border-color:#f59e0b"><div class="bx-h">Waiting for you</div>${wait.map(r => `<div class="bx-row bx-pj"><span style="flex:1"><b>${esc(r.byName || 'A player')}</b> asks: ${esc(reqLabel(r))}</span>
                <button class="bx-btn sm ok" data-act="reqYes" data-id="${r.id}">Approve</button><button class="bx-btn sm bad" data-act="reqNo" data-id="${r.id}">Decline</button></div>`).join('')}</div>`;
        }
        let mine = S.reqs.filter(r => r.by === uid && r.kind !== 'check');
        if (!mine.length) return '';
        let st = r => r.status === 'done' ? `<span class="bx-good">${esc(r.reply || 'Done')}</span>` : r.status === 'declined' ? `<span class="bx-badc">${esc(r.reply || 'Declined')}</span>` : r.status === 'waiting' ? '<span class="bx-warn">Waiting for the GM to approve it</span>' : '<span class="bx-warn">On its way (your GM\'s app applies it while their world is open)</span>';
        return `<div class="bx-card"><div class="bx-h">Your requests</div>${mine.slice(-8).reverse().map(r => `<div class="bx-pj"><b>${esc(reqLabel(r))}</b> · ${st(r)}</div>`).join('')}</div>`;
    }
    function idleHtml(s) {
        if (!s.idle.length) return '';
        return `<div class="bx-card"><div class="bx-h">Not working</div>${s.idle.map(t => `<div class="bx-m bx-warn">${esc(t)}</div>`).join('')}<div class="bx-m" style="margin-top:.25rem">A Plot needs 1 Recruit with a fitting Trait for every 25 squares (at least 1). Short-handed, it produces nothing. See the Recruits tab.</div></div>`;
    }
    function relaxHtml(s) {
        if (S.gm || !window.state) return '';
        let inj = window.state.permanentInjuries || [];
        if (!s.medical) return '';
        return `<div class="bx-card"><div class="bx-h">Medical Plot</div><div class="bx-m">Relaxation here (1 week of downtime) costs 0 Currency and heals two Permanent Injuries instead of one.</div>
            <div class="bx-row" style="margin-top:.35rem"><button class="bx-btn ok" data-act="relax" ${inj.length ? '' : 'disabled'}>Relax at the Medical Plot</button><span class="bx-m">${inj.length ? plural(inj.length, 'Permanent Injury', 'Permanent Injuries') + ' on your sheet' : 'You have no Permanent Injuries.'}</span></div></div>`;
    }

    // ── Recruits ────────────────────────────────────────────────
    function spies() { try { let w = window.apxGmBastionWorld && window.apxGmBastionWorld(); return (w && w.priv && w.priv.bastionGm && w.priv.bastionGm.spies) || []; } catch (e) { return []; } }
    function recruitsHtml() {
        let b = S.b, s = stats(b), mgr = canManage(), spy = S.gm ? spies() : [];
        let free = b.recruits.filter(r => !r.job);
        let groups = {};
        free.forEach(r => { let k = r.traits.slice().sort().join(' & ') + (spy.includes(r.id) ? ' (secret infiltrator)' : ''); (groups[k] = groups[k] || []).push(r); });
        let counts = {}; b.recruits.forEach(r => r.traits.forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
        let jobRow = (k, id, name, sub, traits, have, need, active) => `<tr><td><b>${esc(name)}</b><div class="bx-m">${sub}</div></td><td class="bx-m">${esc(traitText(traits))}</td>
            <td class="${active ? 'bx-good' : 'bx-badc'}" style="white-space:nowrap">${have}/${need} ${active ? 'working' : 'idle'}</td>
            <td style="white-space:nowrap">${mgr ? `<button class="bx-btn sm" data-act="assign" data-k="${k}" data-id="${id}" data-add="-1" ${have ? '' : 'disabled'}>−</button> <button class="bx-btn sm" data-act="assign" data-k="${k}" data-id="${id}" data-add="1" ${have < need ? '' : 'disabled'}>+</button>` : ''}</td></tr>`;
        let rows = [];
        b.plots.forEach(p => {
            let ps = s.plots[p.id]; if (!ps || !ps.need) return;
            rows.push(jobRow('plot', p.id, plotName(b, p), `${ps.sq} sq · ${esc((lvl(b, p.level) || {}).name || '')} · ${gives(p.type, ps.sq)}`, (TYPES[p.type] || {}).traits, ps.have, ps.need, ps.active));
        });
        b.emps.forEach(e => {
            if (e.auto) return;
            let have = workersOf(b, 'emp', e.id).length;
            rows.push(jobRow('emp', e.id, 'Weapon Emplacement' + (e.label ? ' “' + e.label + '”' : ''), `${esc((lvl(b, e.level) || {}).name || '')} · +5 Defense while manned`, EMP_TRAITS, have, 1, have >= 1));
        });
        let mil = b.militia.map(m => `<span class="bx-chip">${esc(unitName(m))}: ${workersOf(b, 'mil', m.id).length}</span>`).join('');
        return `<div class="bx-grid">
            <div class="bx-card"><div class="bx-h">Population</div><div class="bx-v">${s.pop}<span style="font-size:.8rem;color:var(--c-text-muted)"> / ${s.popCap}</span></div><div class="bx-m">${free.length} without a job · ${s.pop - free.length} working or drafted</div>
                <div style="margin-top:.35rem">${TRAITS.map(t => counts[t] ? `<span class="bx-chip">${t} ${counts[t]}</span>` : '').join('')}</div></div>
            <div class="bx-card"><div class="bx-h">Traits</div><div class="bx-m">A Recruit's Trait says which Plots they can work: Strong (heavy labor, frontline defense), Agile (scouting, rapid response), Perceptive (guard duty, precision work), Intelligent (engineering, crafting, research), Charismatic (commerce, negotiation). Lucky Recruits can work ANY job. Elite Recruits have two Traits.</div></div>
            <div class="bx-card"><div class="bx-h">Put them to work</div><div class="bx-m">Fill every short-handed job with the best fit (someone with the exact Trait before a Lucky one).</div>
                <div class="bx-row" style="margin-top:.35rem">${mgr ? '<button class="bx-btn pri" data-act="autoAssign">Auto-assign</button>' : ''}${mgr ? `<button class="bx-btn ok" data-act="recruit" ${b.recruitWeek !== week(b) ? '' : 'disabled'}>Recruit (1d8)</button>` : ''}${S.gm ? '<button class="bx-btn" data-act="recAdd">+ Recruit…</button>' : ''}</div></div></div>
            <div class="bx-card"><div class="bx-h">Jobs</div>${rows.length ? `<table class="bx-tbl"><tr><th>Where</th><th>Who can work it</th><th>Workers</th><th></th></tr>${rows.join('')}</table>` : '<div class="bx-m">No Plots or Emplacements need workers yet (Housing needs none).</div>'}</div>
            <div class="bx-card"><div class="bx-h">Without a job (${free.length})</div>${Object.keys(groups).length ? Object.entries(groups).sort().map(([k, list]) => `<span class="bx-chip">${esc(k)} ×${list.length}${S.gm ? ` <button class="bx-btn sm" data-act="recDel" data-id="${list[list.length - 1].id}" title="Remove one">−</button>` : ''}</span>`).join('') : '<div class="bx-m">Everyone has a job.</div>'}
                ${mil ? `<div class="bx-h" style="margin-top:.4rem">Drafted into Militia</div>${mil}` : ''}</div>`;
    }

    // ── Defense ─────────────────────────────────────────────────
    function defenseHtml() {
        let b = S.b, s = stats(b), mgr = canManage();
        let runs = b.levels.map(l => { let r = wallRuns((b.walls || {})[l.id]); return r.length ? `<div class="bx-m">${esc(l.name)}: ${r.map(n => `${n} sq (+${Math.floor(n / 10)})`).join(', ')}</div>` : ''; }).join('');
        let emps = b.emps.map(e => `<div class="bx-row bx-pj"><span style="flex:1">${e.auto ? 'Automated ' : ''}Weapon Emplacement${e.label ? ' “' + esc(e.label) + '”' : ''} <span class="bx-m">${esc((lvl(b, e.level) || {}).name || '')}</span></span><span class="${s.emps[e.id].on ? 'bx-good' : 'bx-badc'}">${s.emps[e.id].on ? '+5' : 'off: ' + s.emps[e.id].why}</span></div>`).join('');
        let units = b.militia.map(m => {
            let u = UNITS[m.size] || UNITS.squad, n = workersOf(b, 'mil', m.id).length;
            return `<div class="bx-sug"><div class="bx-row"><b style="flex:1">${esc(unitName(m))}</b><span class="${m.stationed ? 'bx-good' : 'bx-warn'}">${m.stationed ? `Stationed: +${u.garrison} Defense` : 'Deployed'}</span></div>
                <div class="bx-m">${u.size} · HP ${m.hp} / ${u.hp} · AC ${u.ac} · Speed ${m.mech ? 4 : 2}${m.mech ? ' (ignores difficult terrain)' : ''} · Attack ${u.attack} damage · ${n}/${u.recruits} Recruits</div>
                <div class="bx-row" style="margin-top:.3rem">
                    <button class="bx-btn sm" data-act="milDmg" data-id="${m.id}">Roll ${u.attack}</button>
                    ${!S.gm ? `<button class="bx-btn sm" data-act="milCmd" data-id="${m.id}" data-attr="INT">Command (d20 + INT)</button><button class="bx-btn sm" data-act="milCmd" data-id="${m.id}" data-attr="CHA">Command (d20 + CHA)</button>` : ''}
                    ${S.gm ? `<span class="bx-m">HP</span><button class="bx-btn sm" data-act="milHp" data-id="${m.id}" data-d="-10">−10</button><button class="bx-btn sm" data-act="milHp" data-id="${m.id}" data-d="-1">−1</button><button class="bx-btn sm" data-act="milHp" data-id="${m.id}" data-d="1">+1</button><button class="bx-btn sm" data-act="milHp" data-id="${m.id}" data-d="10">+10</button>` : ''}
                    ${mgr ? `<button class="bx-btn sm" data-act="milOp" data-id="${m.id}" data-op="${m.stationed ? 'deploy' : 'station'}">${m.stationed ? 'Deploy' : 'Station here'}</button><button class="bx-btn sm bad" data-act="milOp" data-id="${m.id}" data-op="disband">Disband</button>` : ''}</div></div>`;
        }).join('');
        let free = b.recruits.filter(r => !r.job).length;
        let draftBox = mgr ? `<div class="bx-row" style="margin-top:.4rem">
            <select class="bx-in" data-draft-size>${Object.entries(UNITS).map(([k, u]) => `<option value="${k}">${u.name}: ${u.recruits} Recruits, ${fmt(u.cost)} Cu</option>`).join('')}</select>
            <label class="bx-row" style="gap:.2rem"><input type="checkbox" data-draft-mech> Mechanized / Cavalry (×2 Cu)</label>
            <input class="bx-in" data-draft-name placeholder="Name (optional)" style="width:9rem">
            <button class="bx-btn pri" data-act="draft">${S.gm ? 'Draft' : 'Ask to draft'}</button></div>
            <div class="bx-m">Needs a working Arsenal Plot (${s.arsenal ? '<span class="bx-good">you have one</span>' : '<span class="bx-badc">none working</span>'}), unassigned Recruits (${free} free) and Currency from the vault. Drafted Recruits don't work Plots.</div>` : '';
        let sd = b.sd ? sdHtml() : '';
        let gmBox = S.gm ? `<div class="bx-card"><div class="bx-h">Threats</div><div class="bx-m">When a massive event threatens the settlement (a disease, a famine, an EMP storm, a Raid), the Bastion itself rolls: d100 + the matching score against your Threat Level. Failing it means Structural Damage equal to the difference.</div>
            <div class="bx-row" style="margin-top:.35rem"><button class="bx-btn pri" data-act="askForm">Ask for a Bastion check…</button><button class="bx-btn bad" data-act="raidForm">Raid…</button></div>
            <div class="bx-m" style="margin-top:.25rem">Raid Threat Levels: ${THREATS.map(t => t[0] + ' ' + t[1]).join(' · ')}.</div></div>` : '';
        return sd + `<div class="bx-grid">
            <div class="bx-card" data-tip="${esc((s.tips.defense || []).join('\n'))}"><div class="bx-h">Defense</div><div class="bx-v">${s.defense}</div><div class="bx-m">${(s.tips.defense || []).map(esc).join('<br>')}</div>${s.command ? `<div class="bx-m">Command Plots: +${s.command} to the Defense check</div>` : ''}</div>
            <div class="bx-card"><div class="bx-h">Walls</div>${runs || '<div class="bx-m">No Walls yet.</div>'}<div class="bx-m" style="margin-top:.25rem">+1 Defense for every 10 connected squares of Wall (10 Cu a square of length, along square edges).</div></div>
            <div class="bx-card"><div class="bx-h">Weapon Emplacements</div>${emps || '<div class="bx-m">None yet.</div>'}<div class="bx-m" style="margin-top:.25rem">500 Cu: +5 Defense while a Recruit mans it (Agile, Perceptive or Lucky). Automated (1,000 Cu): no crew, 1 Power a week.</div></div></div>
            <div class="bx-card"><div class="bx-h">Militia</div>${units || '<div class="bx-m">No units yet.</div>'}
                <div class="bx-m" style="margin-top:.3rem">Army Units are massive creatures on the battlefield: Vehicle Scale (1 square is roughly 10 to 15 feet), double damage from Heavy Weapons. A player Commander embeds in the unit (Total Cover), spends their own AP to have it Move or Attack, and rolls d20 + INT or CHA for its attacks. Stationed at the Bastion, a unit adds its Garrison Defense.</div>${draftBox}</div>${gmBox}`;
    }
    function sdHtml() {
        let b = S.b, sd = b.sd, live = S.live.sd && S.live.sd.sdId === sd.id ? S.live.sd : null;
        let alloc = (live && live.alloc) || {}, chk = sdRoom(b, alloc, sd.total), mgr = canManage(), s = stats(b), u = chk.used;
        let pm = (f, key, val, canMinus, canPlus) => mgr ? `<button class="bx-btn sm" data-act="sd" data-f="${f}" data-key="${key || ''}" data-d="-1" ${canMinus ? '' : 'disabled'}>−</button><span class="bx-num">${val}</span><button class="bx-btn sm" data-act="sd" data-f="${f}" data-key="${key || ''}" data-d="1" ${canPlus ? '' : 'disabled'}>+</button>` : `<span class="bx-num">${val}</span>`;
        let sqRows = [];
        b.plots.forEach(p => { let n = int((alloc.sq || {})['p:' + p.id]); sqRows.push(`<div class="bx-row"><span style="flex:1">${esc(plotName(b, p))} <span class="bx-m">${sqOf(p)} sq, ${esc((lvl(b, p.level) || {}).name || '')}</span></span>${pm('sq', 'p:' + p.id, n, n > 0, chk.room.sq > 0 && chk.room.sqItems['p:' + p.id] > 0)}</div>`); });
        b.levels.forEach(l => { let len = ((b.walls || {})[l.id] || []).length; if (!len) return; let n = int((alloc.sq || {})['w:' + l.id]); sqRows.push(`<div class="bx-row"><span style="flex:1">Wall <span class="bx-m">${len} sq, ${esc(l.name)}</span></span>${pm('sq', 'w:' + l.id, n, n > 0, chk.room.sq > 0 && chk.room.sqItems['w:' + l.id] > 0)}</div>`); });
        let empRows = b.emps.map(e => { let on = (alloc.emps || []).includes(e.id); return `<label class="bx-chip" style="cursor:${mgr ? 'pointer' : 'default'}"><input type="checkbox" data-sdemp="${e.id}" ${on ? 'checked' : ''} ${mgr && (on || chk.room.emp > 0) ? '' : 'disabled'}> ${e.auto ? 'Automated ' : ''}Emplacement${e.label ? ' “' + esc(e.label) + '”' : ''}</label>`; }).join('');
        return `<div class="bx-card" style="border-color:#ef4444"><div class="bx-h" style="color:#f87171">Structural Damage: ${sd.total}${sd.reason ? ' (' + esc(sd.reason) + ')' : ''}</div>
            <div class="bx-m">The defenses were breached: absorb every point by permanently losing resources. No single category can absorb more than ${chk.cap} (half the total, rounded down).${live && live.byName ? ` Last changed by ${esc(live.byName)}.` : ''}</div>
            <table class="bx-tbl" style="margin-top:.3rem">
                <tr><td><b>Recruits</b><div class="bx-m">1 point each · Population ${s.pop}${s.medical ? ' · a working Medical Plot saves the first 5' : ''}</div></td><td style="white-space:nowrap;text-align:right">${pm('rec', '', u.rec, u.rec > 0, chk.room.rec > 0 && chk.left > 0)}</td></tr>
                <tr><td><b>Currency from the vault</b><div class="bx-m">1 point per 100 Cu · the vault has ${fmt(b.vault.cu)} Cu</div></td><td style="white-space:nowrap;text-align:right">${pm('cu', '', u.cu, u.cu > 0, chk.room.cu > 0 && chk.left > 0)}</td></tr>
                <tr><td colspan="2"><b>Squares of Wall or Plot</b> <span class="bx-m">1 point each, together ${u.sq} of ${chk.cap} at most (a Plot shrinks; at 0 squares it's gone)</span>${sqRows.length ? sqRows.join('') : '<div class="bx-m">Nothing built.</div>'}</td></tr>
                <tr><td colspan="2"><b>Weapon Emplacements</b> <span class="bx-m">5 points each</span><div>${empRows || '<span class="bx-m">None.</span>'}</div></td></tr>
            </table>
            <div class="bx-row" style="margin-top:.4rem"><b class="${chk.left ? 'bx-warn' : 'bx-good'}">Absorbed ${u.total} of ${sd.total}</b>${chk.left && chk.done ? '<span class="bx-m">Nothing else can absorb it (the rest is lost harmlessly).</span>' : ''}<span style="flex:1"></span>
                ${mgr ? `<button class="bx-btn pri" data-act="sdConfirm" ${chk.done ? '' : 'disabled'}>Confirm</button>` : ''}</div>
            ${live && live.confirm && !S.gm ? '<div class="bx-m bx-warn">Confirmed: your GM\'s app applies it.</div>' : ''}</div>`;
    }

    // ── Log ─────────────────────────────────────────────────────
    function logHtml() {
        let list = S.b.log || [];
        return `<div class="bx-card"><div class="bx-h">Log</div>${list.length ? list.map(e => `<div class="bx-log"><span class="bx-m">Day ${int(e.day) + 1}${e.by ? ' · ' + esc(e.by) : ''}</span><div>${esc(e.text)}</div></div>`).join('') : '<div class="bx-m">Nothing yet.</div>'}</div>`;
    }

    // ── Setup (GM) ──────────────────────────────────────────────
    function setupHtml() {
        let b = S.b;
        let multRow = (label, m, key, del) => `<tr><td>${label}</td>${['air', 'surface', 'below'].map(k => `<td><input class="bx-in" type="number" min="0" step="0.5" value="${m[k] ?? ''}" data-chg="mult" data-t="${key}" data-kind="${k}" style="width:4rem"></td>`).join('')}<td>${del ? `<button class="bx-btn sm bad" data-act="terrDel" data-id="${key}">Remove</button>` : ''}</td></tr>`;
        let terr = b.terrains.filter(t => !t.noBuild).map(t => multRow(`<span class="bx-dot" style="background:${esc(t.color)}"></span> ${esc(t.name)}`, t.mult || {}, t.id, t.id !== 'water')).join('');
        let noBuild = b.terrains.filter(t => t.noBuild).map(t => `<span class="bx-chip"><span class="bx-dot" style="background:${esc(t.color)}"></span>${esc(t.name)} (no building)${t.id !== 'nobuild' ? ` <button class="bx-btn sm bad" data-act="terrDel" data-id="${t.id}">×</button>` : ''}</span>`).join('');
        let names = TYPE_ORDER.map(k => `<tr><td><span class="bx-dot" style="background:${TYPES[k].color}"></span> ${TYPES[k].name}</td><td><input class="bx-in" data-chg="tname" data-t="${k}" value="${esc(b.names[k] || '')}" placeholder="${TYPES[k].name}" style="width:9rem"></td>
            <td>${b.art[k] ? '<span class="bx-good">picture set</span> ' : ''}<button class="bx-btn sm" data-act="artUp" data-t="${k}">${b.art[k] ? 'Replace' : 'Picture…'}</button>${b.art[k] ? ` <button class="bx-btn sm" data-act="artDel" data-t="${k}">Remove</button>` : ''}</td></tr>`).join('');
        let adj = b.adj;
        return `<div class="bx-card"><div class="bx-h">The Bastion</div>
            <div class="bx-row" style="margin-bottom:.35rem"><span style="width:6.5rem">Name</span><input class="bx-in" data-chg="set" data-k="name" value="${esc(b.name)}" style="flex:1"></div>
            <div class="bx-row" style="margin-bottom:.35rem"><span style="width:6.5rem">Founded</span><select class="bx-in" data-chg="set" data-k="founded">${Object.entries(FOUNDED).map(([k, v]) => `<option value="${k}" ${b.founded === k ? 'selected' : ''}>${v}</option>`).join('')}</select><input class="bx-in" data-chg="set" data-k="note" value="${esc(b.note)}" placeholder="Story note" style="flex:1"></div>
            <div style="font-weight:800;margin:.35rem 0 .2rem">Managers</div>${managersHtml(b.managers)}</div>
            <div class="bx-card"><div class="bx-h">Location costs</div>
                <div class="bx-m">Each Plot square costs 10 Currency × its location's multiplier, from its level (above, at or below the surface) and the terrain you paint on the Build tab. Bend them to fit a culture: Mer-folk might pay ×1 Underwater and ×5 for a floating dock on the surface; mole-people might halve Underground costs. (Plot Type fittings are never multiplied.)</div>
                <table class="bx-tbl" style="margin-top:.3rem"><tr><th>Terrain</th><th>Above (flying)</th><th>Surface</th><th>Below</th><th></th></tr>${multRow('Land (unpainted)', b.landMult, '_land', false)}${terr}</table>
                <div class="bx-row" style="margin-top:.35rem">${noBuild}<button class="bx-btn" data-act="terrAdd">+ Terrain…</button></div></div>
            <div class="bx-card"><div class="bx-h">Map</div>
                <div class="bx-row">Size <input class="bx-in" type="number" min="8" max="120" value="${b.grid.cols}" data-grid="cols" style="width:4.5rem"> × <input class="bx-in" type="number" min="8" max="120" value="${b.grid.rows}" data-grid="rows" style="width:4.5rem"> squares <button class="bx-btn" data-act="gridSet">Apply</button></div>
                <div class="bx-m">Every level shares this grid (a level's picture stretches over all of it). Levels, pictures and terrain are on the Build tab.</div></div>
            <div class="bx-card"><div class="bx-h">Your setting's names and pictures</div>
                <div class="bx-m">Rename the Plot Types for your setting (a Supply Plot can be Hydroponics, a Power Plot a Leyline Tap) and give each a picture: it tiles one per square inside that kind of Plot on the map.</div>
                <table class="bx-tbl" style="margin-top:.3rem"><tr><th>Plot Type</th><th>Called</th><th>Picture</th></tr>${names}</table></div>
            <div class="bx-card"><div class="bx-h">The vault</div>
                <label class="bx-row"><input type="radio" name="bxMats" data-chg="mats" value="1" ${b.matsFirst !== false ? 'checked' : ''}> Building uses Crafting Materials first, then Currency</label>
                <label class="bx-row"><input type="radio" name="bxMats" data-chg="mats" value="0" ${b.matsFirst === false ? 'checked' : ''}> Building uses Currency first, then Crafting Materials</label></div>
            <div class="bx-card"><div class="bx-h">Adjustments</div><div class="bx-m">For what the map doesn't show: a Supply Route linking pools with an ally, a story reward, a curse.</div>
                <div class="bx-row" style="margin-top:.3rem">${[['supplies', 'Supplies'], ['power', 'Power'], ['defense', 'Defense'], ['popCap', 'Population cap']].map(([k, l]) => `<label class="bx-row" style="gap:.2rem">${l} <input class="bx-in" type="number" value="${int(adj[k])}" data-chg="adj" data-k="${k}" style="width:4rem"></label>`).join('')}</div></div>
            <div class="bx-card"><div class="bx-h">Start over</div><div class="bx-row"><button class="bx-btn bad" data-act="reset">Delete this Bastion…</button><span class="bx-m">Removes everything: buildings, Recruits, the vault, suggestions. To only hide it, turn Bastions off in World Settings (nothing is lost).</span></div></div>`;
    }

    // ── The builder (Build tab) ─────────────────────────────────
    // Levels stack like floors: above the surface (flying), the surface, and below it (underground,
    // or underwater where the GM painted Water). Managers draw a draft (Plots with their Plot Type
    // chosen up front, Walls along square edges, Weapon Emplacements) and submit it as a suggestion;
    // everyone sees every suggestion on the map and votes; the GM starts building the ones they pick.
    const CELL = 22;
    const BL = { level: null, tool: 'look', type: 'housing', label: '', auto: false, terr: 'water', brush: 1, view: null, drag: null, hover: null,
        show: {}, showAll: true, sel: null, editBuilt: false, cv: null, pick: {}, hint: '', hintT: 0, pat: {},
        draft: { items: [], editing: null, title: '', note: '' }, draftCode: null };
    function loadDraftOnce() {
        if (BL.draftCode === S.code) return;
        BL.draftCode = S.code; BL.level = null; BL.view = null; BL.sel = null; BL.pick = {};
        let d = null; try { d = JSON.parse(localStorage.getItem('apx_bastion_draft_' + S.code) || 'null'); } catch (e) { }
        BL.draft = Object.assign({ items: [], editing: null, title: '', note: '' }, d || {});
    }
    function saveDraft() { try { localStorage.setItem('apx_bastion_draft_' + S.code, JSON.stringify(BL.draft)); } catch (e) { } }
    function curLevel() {
        let b = S.b;
        if (!BL.level || !lvl(b, BL.level)) BL.level = (b.levels.find(l => l.kind === 'surface') || b.levels[0]).id;
        return lvl(b, BL.level);
    }
    function hint(t) { BL.hint = t; BL.hintT = Date.now(); let el = S.win && S.win.querySelector('[data-bld-hint]'); if (el) el.textContent = t; setTimeout(() => { if (Date.now() - BL.hintT >= 4900) { BL.hint = ''; draw(); } }, 5000); }
    function renderBuild(body) {
        curLevel();
        if (!body.querySelector('[data-bld]')) {
            body.innerHTML = `<div class="bx-bld" data-bld><div class="bx-bld-main"><div data-bld-bar></div><div class="bx-cv" data-bld-cv><canvas></canvas><div class="bx-cv-hint" data-bld-hint></div></div></div><div class="bx-side" data-bld-side></div></div>`;
            body.scrollTop = 0;
            wireCanvas(body.querySelector('canvas'));
        }
        BL.cv = body.querySelector('canvas');
        layoutBuild();
        let a = document.activeElement, typing = el => a && el.contains(a) && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName) && a.type !== 'checkbox' && a.type !== 'radio';
        let bar = body.querySelector('[data-bld-bar]'), side = body.querySelector('[data-bld-side]');
        if (!typing(bar)) bar.innerHTML = barHtml();
        if (!typing(side)) { let t = side.scrollTop; side.innerHTML = sideHtml(); side.scrollTop = t; }
        draw();
    }
    function layoutBuild() {
        let w = S.win, el = w && w.querySelector('[data-bld]'); if (!el) return;
        el.classList.toggle('col', w.clientWidth < 760);
    }
    function barHtml() {
        let b = S.b, lv = curLevel(), i = b.levels.indexOf(lv), mgr = canManage();
        let tool = (t, label, tip) => `<button class="bx-btn ${BL.tool === t ? 'on' : ''}" data-act="tool" data-t="${t}" data-tip="${esc(tip)}">${label}</button>`;
        let landM = (b.landMult || {})[lv.kind];
        let canPic = S.gm || mgr || !lv.img;
        let row1 = `<div class="bx-row bx-tools" style="margin-bottom:.25rem">
            <button class="bx-btn" data-act="lvGo" data-d="-1" ${i > 0 ? '' : 'disabled'} title="The level above">▲</button>
            <b style="min-width:6rem">${esc(lv.name)}</b><span class="bx-m">${KINDS[lv.kind]} · land ×${landM ?? 1} · level ${i + 1} of ${b.levels.length}</span>
            <button class="bx-btn" data-act="lvGo" data-d="1" ${i < b.levels.length - 1 ? '' : 'disabled'} title="The level below">▼</button>
            ${S.gm ? '<button class="bx-btn" data-act="lvAdd" data-where="above">+ Above</button><button class="bx-btn" data-act="lvAdd" data-where="below">+ Below</button><button class="bx-btn" data-act="lvEdit">Level…</button>' : ''}
            ${canPic ? `<button class="bx-btn" data-act="lvImg" data-tip="A picture of this level: an empty field, a cave system, a castle's floor plan. It stretches over the whole grid.">${lv.img ? 'New picture…' : 'Picture…'}</button>` : ''}
            ${lv.img && (S.gm || mgr) ? '<button class="bx-btn" data-act="lvImgDel">Remove picture</button>' : ''}
            </div>`;
        let tools = tool('look', 'Look', 'Drag to move around, scroll to zoom, click something to see it') +
            (mgr ? tool('plot', 'Plot', 'Drag a rectangle of squares. Shift+drag adds to your last Plot (L shapes, wings)') + tool('wall', 'Wall', 'Drag along the grid lines') + tool('emp', 'Emplacement', 'Click a square for a Weapon Emplacement') + tool('erase', 'Erase', 'Click your draft to take parts of it away') : '') +
            (S.gm ? tool('terrain', 'Terrain', 'Paint water, ground that can\'t be built on, or your own kinds of terrain') : '');
        let pal = '';
        if (BL.tool === 'plot') pal = `Plot Type <select class="bx-in" data-bl="type">${TYPE_ORDER.map(k => `<option value="${k}" ${BL.type === k ? 'selected' : ''}>${esc(typeName(b, k))} (+${TYPES[k].cost} Cu/sq)</option>`).join('')}</select>
            Label <input class="bx-in" data-bl="label" value="${esc(BL.label)}" placeholder="Dock, storage shed…" style="width:9rem">`;
        else if (BL.tool === 'emp') pal = `<label class="bx-row" style="gap:.2rem"><input type="checkbox" data-bl="auto" ${BL.auto ? 'checked' : ''}> Automated (1,000 Cu, no crew, 1 Power a week)</label>`;
        else if (BL.tool === 'erase' && S.gm) pal = `<label class="bx-row" style="gap:.2rem"><input type="checkbox" data-bl="editBuilt" ${BL.editBuilt ? 'checked' : ''}> Also remove what's built (GM)</label>`;
        else if (BL.tool === 'terrain') pal = `Paint <select class="bx-in" data-bl="terr">${b.terrains.map(t => `<option value="${t.id}" ${BL.terr === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}<option value="_land" ${BL.terr === '_land' ? 'selected' : ''}>Land (erase)</option></select>
            Brush ${[1, 3, 5].map(n => `<button class="bx-btn sm ${BL.brush === n ? 'on' : ''}" data-act="brush" data-n="${n}">${n}</button>`).join('')}`;
        else if (BL.tool === 'look') pal = `<label class="bx-row" style="gap:.2rem"><input type="checkbox" data-bl="showAll" ${BL.showAll ? 'checked' : ''}> Show every open suggestion</label>`;
        let zoom = '<span style="flex:1"></span><button class="bx-btn" data-act="zoom" data-d="1" title="Zoom in">+</button><button class="bx-btn" data-act="zoom" data-d="-1" title="Zoom out">−</button><button class="bx-btn" data-act="fit" title="Show the whole map">Fit</button>';
        return row1 + `<div class="bx-row bx-tools">${tools}<span style="width:.5rem"></span>${pal}${zoom}</div>`;
    }

    // ── Builder: the side panel ─────────────────────────────────
    const SUG_COLORS = ['#f472b6', '#a78bfa', '#34d399', '#fbbf24', '#60a5fa', '#fb923c', '#f87171', '#2dd4bf', '#c084fc', '#a3e635'];
    function sugColor(id) { let h = 0; for (let c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return SUG_COLORS[h % SUG_COLORS.length]; }
    function itemHtml(b, it, err, i, editable) {
        let inf = itemInfo(b, it);
        let edit = editable && it.k === 'plot' ? `<div class="bx-row" style="margin-top:.2rem"><select class="bx-in" data-chg="dType" data-i="${i}">${TYPE_ORDER.map(k => `<option value="${k}" ${it.type === k ? 'selected' : ''}>${esc(typeName(b, k))}</option>`).join('')}</select><input class="bx-in" data-chg="dLabel" data-i="${i}" value="${esc(it.label || '')}" placeholder="Label" style="width:7.5rem"></div>` : '';
        return `<div class="bx-pj"><div class="bx-row"><b style="flex:1">${esc(inf.title)}</b><span class="bx-warn">${fmt(inf.cost)} Cu · ${plural(inf.days, 'day')}</span>${editable ? `<button class="bx-btn sm" data-act="dDel" data-i="${i}" title="Take it out">×</button>` : ''}</div>
            ${inf.lines.map(l => `<div class="bx-m">${esc(l)}</div>`).join('')}${inf.gives ? `<div class="bx-m bx-good">${esc(inf.gives)}</div>` : ''}${err ? `<div class="bx-m bx-badc">${esc(err)}</div>` : ''}${edit}</div>`;
    }
    function sideHtml() {
        let b = S.b, mgr = canManage(), out = [];
        out.push(selHtml());
        if (mgr) {
            let d = BL.draft, errs = checkItems(b, d.items), cost = itemsCost(b, d.items);
            let longest = d.items.reduce((a, it) => Math.max(a, itemInfo(b, it).days), 0);
            out.push(`<div class="bx-card" style="border-color:#22d3ee"><div class="bx-h" style="color:#67e8f9">${d.editing ? 'Editing your suggestion' : 'Your draft'}</div>
                ${d.items.length ? d.items.map((it, i) => itemHtml(b, it, errs[i], i, true)).join('') : '<div class="bx-m">Pick Plot, Wall or Emplacement above and draw on the map. Choose the Plot Type first to see the full cost and time.</div>'}
                ${d.items.length ? `<div class="bx-row" style="margin:.35rem 0"><b>Total ${fmt(cost)} Cu</b><span class="bx-m">(or half that value in Crafting Materials) · each item builds alongside the others; the longest takes ${plural(longest, 'day')}</span></div>
                <input class="bx-in" data-chg="dTitle" value="${esc(d.title)}" placeholder="Name it (East wing, Harbor…)" style="width:100%;margin-bottom:.25rem">
                <textarea class="bx-in" data-chg="dNote" rows="2" placeholder="Why, or what it looks like (optional)" style="width:100%">${esc(d.note)}</textarea>
                <div class="bx-row" style="margin-top:.3rem"><button class="bx-btn pri" data-act="dSubmit" ${errs.some(Boolean) ? 'disabled' : ''}>${d.editing ? 'Update suggestion' : 'Submit suggestion'}</button>${S.gm ? `<button class="bx-btn ok" data-act="dBuild" ${errs.some(Boolean) ? 'disabled' : ''}>Build it now</button>` : ''}<button class="bx-btn" data-act="dClear">${d.editing ? 'Stop editing' : 'Clear'}</button></div>` : ''}</div>`);
        }
        let open = S.sugs.filter(s => s.status === 'open'), rest = S.sugs.filter(s => s.status !== 'open').slice(-6).reverse();
        let uid = me().uid;
        let sug = s => {
            let votes = s.votes || {}, yes = Object.values(votes).filter(v => v > 0).length, no = Object.values(votes).filter(v => v < 0).length, mine = votes[uid] || 0;
            let errs = s.status === 'open' ? checkItems(b, s.items || []) : [];
            let cost = itemsCost(b, s.items || []), shown = BL.showAll || BL.show[s.id];
            return `<div class="bx-sug" style="border-left:4px solid ${sugColor(s.id)}">
                <div class="bx-row">${S.gm && s.status === 'open' ? `<input type="checkbox" data-pick="${s.id}" ${BL.pick[s.id] ? 'checked' : ''} title="Pick it to start building">` : ''}<b style="flex:1">${esc(s.title || 'Suggestion')}</b>
                    ${s.status === 'open' ? `<button class="bx-btn sm ${shown ? 'on' : ''}" data-act="sugShow" data-id="${s.id}" title="Show it on the map">${shown ? 'Shown' : 'Show'}</button>` : `<span class="${s.status === 'building' ? 'bx-good' : 'bx-badc'}">${s.status === 'building' ? 'Being built' : 'Declined'}</span>`}</div>
                <div class="bx-m">by ${esc(s.byName || 'a player')} · ${plural((s.items || []).length, 'item')} · ${fmt(cost)} Cu${s.note ? ' · ' + esc(s.note) : ''}</div>
                ${(s.items || []).map((it, i) => `<div class="bx-m">• ${esc(itemInfo(b, it).title)}${errs[i] ? ` <span class="bx-badc">(${esc(errs[i])})</span>` : ''}</div>`).join('')}
                ${s.status === 'open' ? `<div class="bx-row" style="margin-top:.25rem"><button class="bx-btn sm ${mine > 0 ? 'ok' : ''}" data-act="vote" data-id="${s.id}" data-v="1">Yes ${yes}</button><button class="bx-btn sm ${mine < 0 ? 'bad' : ''}" data-act="vote" data-id="${s.id}" data-v="-1">No ${no}</button>
                    ${s.by === uid ? `<button class="bx-btn sm" data-act="sugEdit" data-id="${s.id}">Edit</button>` : ''}${s.by === uid || S.gm ? `<button class="bx-btn sm" data-act="sugDel" data-id="${s.id}">${s.by === uid ? 'Withdraw' : 'Delete'}</button>` : ''}${S.gm ? `<button class="bx-btn sm bad" data-act="sugDecline" data-id="${s.id}">Decline</button>` : ''}</div>` : ''}</div>`;
        };
        let picked = Object.keys(BL.pick).filter(id => BL.pick[id] && open.some(s => s.id === id));
        out.push(`<div class="bx-card"><div class="bx-h">Suggestions (${open.length} open)</div>
            ${open.length ? open.map(sug).join('') : '<div class="bx-m">None yet. Managers draw a draft and submit it; everyone can vote.</div>'}
            ${S.gm && open.length ? `<div class="bx-row" style="margin-top:.3rem"><button class="bx-btn ok" data-act="sugStart" ${picked.length ? '' : 'disabled'}>Start building ${picked.length ? '(' + picked.length + ')' : 'the picked ones'}</button><span class="bx-m">Tick the ones the party wants. Building pauses whenever the vault runs short.</span></div>` : ''}
            ${rest.length ? `<div class="bx-h" style="margin-top:.4rem">Earlier</div>${rest.map(sug).join('')}` : ''}</div>`);
        return out.join('');
    }
    function selHtml() {
        let b = S.b, sel = BL.sel; if (!sel) return '';
        let mgr = canManage(), s = stats(b);
        if (sel.kind === 'plot') {
            let p = b.plots.find(x => x.id === sel.id); if (!p) return '';
            let ps = s.plots[p.id], lv = lvl(b, p.level), benches = b.benches.filter(w => w.plot === p.id);
            let busy = b.projects.some(j => j.item && j.item.k === 'type' && j.item.plot === p.id);
            return `<div class="bx-card" style="border-color:#f59e0b"><div class="bx-row"><b style="flex:1">${esc(plotName(b, p))}</b><button class="bx-btn sm" data-act="selClose">×</button></div>
                <div class="bx-m">${ps.sq} sq · ${esc(lv ? lv.name : '')} · ${gives(p.type, ps.sq)}</div>
                ${ps.need ? `<div class="bx-m ${ps.active ? 'bx-good' : 'bx-badc'}">${ps.have}/${ps.need} workers (${esc(traitText((TYPES[p.type] || {}).traits))})${ps.active ? '' : ': produces nothing'}</div>` : ''}
                ${benches.length ? `<div class="bx-m">Inside: ${benches.map(w => esc(w.kind === 'dock' ? 'Vehicle Dock' : 'Workbench: ' + w.spec)).join(', ')}</div>` : ''}
                ${p.type === 'commerce' && S.gm ? `<label class="bx-row" style="margin-top:.25rem"><input type="checkbox" data-chg="route" data-id="${p.id}" ${p.route ? 'checked' : ''}> On a Supply Route (+100 Cu a week)</label>${p.route ? `<input class="bx-in" data-chg="routeName" data-id="${p.id}" value="${esc(p.route === true ? '' : p.route)}" placeholder="To which allied settlement?" style="width:100%">` : ''}` : (p.route ? `<div class="bx-m">Supply Route${p.route !== true ? ' to ' + esc(p.route) : ''}: +100 Cu a week</div>` : '')}
                <div class="bx-row" style="margin-top:.3rem">${mgr && !busy ? `<select class="bx-in" data-seltype>${TYPE_ORDER.filter(k => k !== p.type && k !== 'empty').map(k => `<option value="${k}">${esc(typeName(b, k))} (${fmt(TYPES[k].cost * ps.sq)} Cu)</option>`).join('')}</select><button class="bx-btn sm" data-act="selType" data-id="${p.id}">Suggest this Plot Type</button>` : ''}
                    ${mgr && p.type === 'crafting' ? `<button class="bx-btn sm" data-act="selBench" data-id="${p.id}">Suggest a Workbench</button>${benches.some(w => w.kind === 'dock') ? '' : `<button class="bx-btn sm" data-act="selDock" data-id="${p.id}">Suggest a Vehicle Dock</button>`}` : ''}
                    ${S.gm ? `<button class="bx-btn sm" data-act="selRename" data-id="${p.id}">Label…</button><button class="bx-btn sm bad" data-act="selDemolish" data-id="${p.id}">Demolish</button>` : ''}</div></div>`;
        }
        if (sel.kind === 'emp') {
            let e = b.emps.find(x => x.id === sel.id); if (!e) return '';
            return `<div class="bx-card" style="border-color:#f59e0b"><div class="bx-row"><b style="flex:1">${e.auto ? 'Automated ' : ''}Weapon Emplacement${e.label ? ' “' + esc(e.label) + '”' : ''}</b><button class="bx-btn sm" data-act="selClose">×</button></div>
                <div class="bx-m ${s.emps[e.id].on ? 'bx-good' : 'bx-badc'}">${s.emps[e.id].on ? '+5 Defense' : 'Off: ' + s.emps[e.id].why}</div>
                <div class="bx-row" style="margin-top:.3rem">${mgr && !e.auto && !b.projects.some(j => j.item && j.item.k === 'auto' && j.item.emp === e.id) ? `<button class="bx-btn sm" data-act="selAuto" data-id="${e.id}">Suggest automating it (+500 Cu)</button>` : ''}${S.gm ? `<button class="bx-btn sm bad" data-act="selEmpDel" data-id="${e.id}">Remove</button>` : ''}</div></div>`;
        }
        if (sel.kind === 'proj') {
            let p = b.projects.find(x => x.id === sel.id); if (!p) return '';
            return `<div class="bx-card" style="border-color:#f59e0b"><div class="bx-row"><b style="flex:1">${esc(p.title)}</b><button class="bx-btn sm" data-act="selClose">×</button></div>
                <div class="bx-m">Under construction: day ${p.daysDone} of ${p.days} · ${fmt(p.paid || 0)} of ${fmt(p.cost)} Cu paid${p.status === 'paused' ? ' · <span class="bx-badc">paused</span>' : ''}</div>
                ${S.gm ? `<div class="bx-row" style="margin-top:.3rem"><button class="bx-btn sm ok" data-act="pjFinish" data-id="${p.id}">Finish now</button><button class="bx-btn sm bad" data-act="pjCancel" data-id="${p.id}">Cancel</button></div>` : ''}</div>`;
        }
        if (sel.kind === 'sug') {
            let sg = S.sugs.find(x => x.id === sel.id); if (!sg) return '';
            let it = (sg.items || [])[sel.i]; if (!it) return '';
            return `<div class="bx-card" style="border-color:${sugColor(sg.id)}"><div class="bx-row"><b style="flex:1">${esc(sg.title || 'Suggestion')}</b><button class="bx-btn sm" data-act="selClose">×</button></div><div class="bx-m">by ${esc(sg.byName || 'a player')}</div>${itemHtml(b, it, null, -1, false)}</div>`;
        }
        return '';
    }

    // ── Builder: the map ────────────────────────────────────────
    let _raf = false;
    function draw() { if (_raf || !BL.cv) return; _raf = true; requestAnimationFrame(() => { _raf = false; try { drawNow(); } catch (e) { console.warn('Bastion map:', e); } }); }
    function rgba(hex, a) { let h = String(hex || '#888').replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); let n = parseInt(h, 16) || 0; return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
    function getImg(id) {
        if (!id || !S.code) return null;
        let v = S.imgs[id];
        if (v instanceof HTMLImageElement) return v.complete && v.naturalWidth ? v : null;
        if (v) return null;
        S.imgs[id] = 'loading';
        S.store.getDoc(S.code, 'imgs', id).then(d => {
            if (!d || !d.src) { S.imgs[id] = 'missing'; return; }
            let im = new Image(); im.onload = () => { BL.pat = {}; draw(); }; im.src = d.src; S.imgs[id] = im;
        }).catch(() => { S.imgs[id] = 'missing'; });
        return null;
    }
    function fitView() {
        let cv = BL.cv, b = S.b; if (!cv || !b) return;
        let W = cv.clientWidth || 600, H = cv.clientHeight || 400;
        let z = Math.max(0.15, Math.min(4, Math.min((W - 20) / (b.grid.cols * CELL), (H - 20) / (b.grid.rows * CELL))));
        BL.view = { z, x: Math.round((W - b.grid.cols * CELL * z) / 2), y: Math.round((H - b.grid.rows * CELL * z) / 2) };
    }
    function zoomAt(px, py, f) {
        let v = BL.view; if (!v) return;
        let z = Math.max(0.15, Math.min(5, v.z * f)), k = z / v.z;
        BL.moved = true;
        v.x = px - (px - v.x) * k; v.y = py - (py - v.y) * k; v.z = z;
        draw();
    }
    function regionPath(ctx, cells, cs) {
        let set = new Set(cells);
        ctx.beginPath();
        cells.forEach(k => {
            let [x, y] = pk(k), X = x * cs, Y = y * cs;
            if (!set.has(ck(x, y - 1))) { ctx.moveTo(X, Y); ctx.lineTo(X + cs, Y); }
            if (!set.has(ck(x, y + 1))) { ctx.moveTo(X, Y + cs); ctx.lineTo(X + cs, Y + cs); }
            if (!set.has(ck(x - 1, y))) { ctx.moveTo(X, Y); ctx.lineTo(X, Y + cs); }
            if (!set.has(ck(x + 1, y))) { ctx.moveTo(X + cs, Y); ctx.lineTo(X + cs, Y + cs); }
        });
    }
    function fillCells(ctx, cells, cs, style) { ctx.fillStyle = style; cells.forEach(k => { let [x, y] = pk(k); ctx.fillRect(x * cs, y * cs, cs, cs); }); }
    function stripes(ctx, cells, cs, color) {
        ctx.save(); ctx.beginPath(); cells.forEach(k => { let [x, y] = pk(k); ctx.rect(x * cs, y * cs, cs, cs); }); ctx.clip();
        let xs = cells.map(k => pk(k)[0]), ys = cells.map(k => pk(k)[1]);
        let x0 = Math.min(...xs) * cs, x1 = (Math.max(...xs) + 1) * cs, y0 = Math.min(...ys) * cs, y1 = (Math.max(...ys) + 1) * cs;
        ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, cs * 0.12); ctx.beginPath();
        for (let d = x0 - (y1 - y0); d < x1; d += Math.max(6, cs * 0.6)) { ctx.moveTo(d, y1); ctx.lineTo(d + (y1 - y0), y0); }
        ctx.stroke(); ctx.restore();
    }
    function labelAt(ctx, cells, cs, lines, color) {
        if (cs < 9 || !cells.length) return;
        let sx = 0, sy = 0; cells.forEach(k => { let [x, y] = pk(k); sx += x + 0.5; sy += y + 0.5; });
        let cx = sx / cells.length * cs, cy = sy / cells.length * cs, fs = Math.max(9, Math.min(14, cs * 0.5));
        ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowColor = '#000'; ctx.shadowBlur = 3;
        lines.filter(Boolean).forEach((t, i, arr) => { ctx.font = `${i ? 600 : 800} ${i ? fs * 0.82 : fs}px system-ui,sans-serif`; ctx.fillStyle = i ? '#e2e8f0' : (color || '#fff'); ctx.fillText(t, cx, cy + (i - (arr.length - 1) / 2) * fs * 1.15); });
        ctx.restore();
    }
    function segLine(ctx, s, cs) { let [a, c] = segEnds(s).map(pk); ctx.moveTo(a[0] * cs, a[1] * cs); ctx.lineTo(c[0] * cs, c[1] * cs); }
    function drawWalls(ctx, segs, cs, color, w, dash) {
        if (!segs || !segs.length) return;
        ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.setLineDash(dash || []);
        ctx.beginPath(); segs.forEach(s => segLine(ctx, s, cs)); ctx.stroke(); ctx.restore();
    }
    function drawEmp(ctx, x, y, cs, fill, ring, letter, dash) {
        ctx.save(); let cx = (x + 0.5) * cs, cy = (y + 0.5) * cs, r = cs * 0.36;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        ctx.strokeStyle = ring; ctx.lineWidth = Math.max(1.5, cs * 0.08); ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
        if (cs >= 12) { ctx.fillStyle = '#fff'; ctx.font = `900 ${Math.round(cs * 0.42)}px system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(letter, cx, cy + 1); }
        ctx.restore();
    }
    function typePattern(ctx, b, type, cs) {
        let id = b.art[type]; if (!id) return null;
        let im = getImg(id); if (!im) return null;
        let key = type + ':' + id + ':' + Math.round(cs);
        if (BL.pat[key]) return BL.pat[key];
        try { let p = ctx.createPattern(im, 'repeat'); if (p && p.setTransform && window.DOMMatrix) p.setTransform(new DOMMatrix().scale(cs / im.naturalWidth, cs / im.naturalHeight)); BL.pat[key] = p; return p; } catch (e) { return null; }
    }
    function drawItems(ctx, b, items, lvId, cs, color, dash, alpha, labelPrefix) {
        items.forEach(it => {
            if (it.level !== lvId) return;
            if (it.k === 'plot' && it.cells.length) {
                fillCells(ctx, it.cells, cs, rgba(color, alpha));
                ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash(dash); regionPath(ctx, it.cells, cs); ctx.stroke(); ctx.restore();
                labelAt(ctx, it.cells, cs, [(labelPrefix || '') + (it.label || typeName(b, it.type)), it.label ? typeName(b, it.type) : ''], color);
            }
            if (it.k === 'wall') drawWalls(ctx, it.segs, cs, color, Math.max(2, cs * 0.16), dash);
            if (it.k === 'emp') drawEmp(ctx, it.x, it.y, cs, rgba(color, 0.25), color, it.auto ? 'A' : 'E', dash);
        });
    }
    function drawNow() {
        let cv = BL.cv, b = S.b; if (!cv || !b || !cv.isConnected) return;
        let W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return;
        let dpr = Math.min(2, window.devicePixelRatio || 1);
        if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
        if (!BL.view) fitView();
        let ctx = cv.getContext('2d'), v = BL.view, cs = CELL * v.z, lv = curLevel(), cols = b.grid.cols, rows = b.grid.rows;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, W, H);
        ctx.save(); ctx.translate(v.x, v.y);
        ctx.fillStyle = lv.kind === 'air' ? '#0c2340' : lv.kind === 'below' ? '#241c14' : '#15261a';
        ctx.fillRect(0, 0, cols * cs, rows * cs);
        let bg = lv.img && getImg(lv.img);
        if (bg) { ctx.globalAlpha = lv.imgOpacity == null ? 1 : lv.imgOpacity; ctx.drawImage(bg, 0, 0, cols * cs, rows * cs); ctx.globalAlpha = 1; }
        // Terrain the GM painted
        let byT = {};
        Object.entries(lv.terrain || {}).forEach(([k, id]) => { (byT[id] = byT[id] || []).push(k); });
        Object.entries(byT).forEach(([id, cells]) => {
            let t = b.terrains.find(x => x.id === id); if (!t) return;
            fillCells(ctx, cells, cs, rgba(t.color, t.noBuild ? 0.3 : 0.38));
            if (t.noBuild) stripes(ctx, cells, cs, rgba(t.color, 0.75));
            else if (t.id === 'water' && cs >= 10) {
                ctx.save(); ctx.strokeStyle = 'rgba(191,219,254,.45)'; ctx.lineWidth = 1; ctx.beginPath();
                cells.forEach(k => { let [x, y] = pk(k), X = x * cs, Y = (y + 0.55) * cs; ctx.moveTo(X + cs * 0.15, Y); ctx.quadraticCurveTo(X + cs * 0.32, Y - cs * 0.18, X + cs * 0.5, Y); ctx.quadraticCurveTo(X + cs * 0.68, Y + cs * 0.18, X + cs * 0.85, Y); });
                ctx.stroke(); ctx.restore();
            }
        });
        // The neighbouring level toward the surface, faintly (to line things up, like a floor plan)
        let i = b.levels.indexOf(lv), ghost = lv.kind === 'below' ? b.levels[i - 1] : lv.kind === 'air' ? b.levels[i + 1] : null;
        if (ghost) {
            b.plots.filter(p => p.level === ghost.id).forEach(p => { ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1; regionPath(ctx, p.cells, cs); ctx.stroke(); ctx.restore(); });
            drawWalls(ctx, (b.walls || {})[ghost.id], cs, 'rgba(255,255,255,.22)', 1.5);
        }
        // Grid
        if (cs >= 6) {
            ctx.beginPath();
            for (let x = 0; x <= cols; x++) { ctx.moveTo(x * cs, 0); ctx.lineTo(x * cs, rows * cs); }
            for (let y = 0; y <= rows; y++) { ctx.moveTo(0, y * cs); ctx.lineTo(cols * cs, y * cs); }
            ctx.strokeStyle = 'rgba(255,255,255,.09)'; ctx.lineWidth = 1; ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(245,158,11,.6)'; ctx.lineWidth = 2; ctx.strokeRect(0, 0, cols * cs, rows * cs);
        let s = stats(b);
        // Built Plots
        b.plots.filter(p => p.level === lv.id).forEach(p => {
            let t = TYPES[p.type] || TYPES.empty, pat = typePattern(ctx, b, p.type, cs), on = s.plots[p.id] && (s.plots[p.id].active || p.type === 'empty');
            if (pat) { ctx.save(); ctx.translate(0, 0); fillCells(ctx, p.cells, cs, pat); ctx.restore(); fillCells(ctx, p.cells, cs, rgba(t.color, 0.15)); }
            else fillCells(ctx, p.cells, cs, rgba(t.color, 0.5));
            ctx.save(); ctx.strokeStyle = BL.sel && BL.sel.kind === 'plot' && BL.sel.id === p.id ? '#facc15' : rgba(t.color, 1); ctx.lineWidth = BL.sel && BL.sel.id === p.id ? 3 : 2; regionPath(ctx, p.cells, cs); ctx.stroke(); ctx.restore();
            labelAt(ctx, p.cells, cs, [p.label || typeName(b, p.type), (p.label ? typeName(b, p.type) : '') + (on ? '' : (p.label ? ' · ' : '') + 'idle')], on ? '#fff' : '#fca5a5');
        });
        // Under construction
        b.projects.forEach(j => {
            let it = j.item; if (!it || it.level !== lv.id) return;
            let tag = j.status === 'paused' ? 'Paused' : `Building ${j.daysDone}/${j.days} days`;
            if (it.k === 'plot') {
                let t = TYPES[it.type] || TYPES.empty;
                fillCells(ctx, it.cells, cs, rgba(t.color, 0.22)); stripes(ctx, it.cells, cs, 'rgba(245,158,11,.35)');
                ctx.save(); ctx.strokeStyle = BL.sel && BL.sel.id === j.id ? '#facc15' : '#f59e0b'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); regionPath(ctx, it.cells, cs); ctx.stroke(); ctx.restore();
                labelAt(ctx, it.cells, cs, [it.label || typeName(b, it.type), tag], '#fde68a');
            }
            if (it.k === 'wall') drawWalls(ctx, it.segs, cs, '#f59e0b', Math.max(2, cs * 0.16), [6, 4]);
            if (it.k === 'emp') drawEmp(ctx, it.x, it.y, cs, 'rgba(245,158,11,.25)', '#f59e0b', it.auto ? 'A' : 'E', [3, 3]);
        });
        drawWalls(ctx, (b.walls || {})[lv.id], cs, '#e5e7eb', Math.max(2.5, cs * 0.18));
        b.emps.filter(e => e.level === lv.id).forEach(e => { let on = s.emps[e.id] && s.emps[e.id].on; drawEmp(ctx, e.x, e.y, cs, on ? (e.auto ? '#7c3aed' : '#b91c1c') : '#4b5563', BL.sel && BL.sel.id === e.id ? '#facc15' : '#f8fafc', e.auto ? 'A' : 'E'); });
        // Suggestions, then your draft on top
        S.sugs.filter(sg => sg.status === 'open' && (BL.showAll || BL.show[sg.id]) && !(BL.draft.editing === sg.id)).forEach(sg => drawItems(ctx, b, sg.items || [], lv.id, cs, sugColor(sg.id), [5, 4], 0.2, ''));
        if (canManage()) drawItems(ctx, b, BL.draft.items, lv.id, cs, '#22d3ee', [4, 3], 0.25, '');
        // What's being drawn right now
        let d = BL.drag;
        if (d && d.mode === 'rect') {
            let x0 = Math.min(d.a[0], d.b[0]), y0 = Math.min(d.a[1], d.b[1]), w = Math.abs(d.a[0] - d.b[0]) + 1, h = Math.abs(d.a[1] - d.b[1]) + 1;
            ctx.fillStyle = 'rgba(34,211,238,.18)'; ctx.fillRect(x0 * cs, y0 * cs, w * cs, h * cs);
            ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2; ctx.strokeRect(x0 * cs, y0 * cs, w * cs, h * cs);
            let n = w * h, cost = n * PLOT_COST * (cellMult(b, lv, ck(d.a[0], d.a[1])) || 1) + n * (TYPES[BL.type] || TYPES.empty).cost;
            labelAt(ctx, [ck(x0 + Math.floor(w / 2), y0 + Math.floor(h / 2))], cs, [`${w}×${h} = ${n} sq`, `about ${fmt(cost)} Cu`], '#67e8f9');
        }
        if (d && d.mode === 'wall') {
            let segs = wallSegs(d.a, d.b);
            drawWalls(ctx, segs, cs, '#22d3ee', Math.max(2, cs * 0.16));
            if (segs.length) labelAt(ctx, [ck(d.b[0], d.b[1])], cs, [`${segs.length} sq · ${fmt(segs.length * WALL_COST)} Cu`], '#67e8f9');
        }
        // The square under the pointer
        let hv = BL.hover;
        if (hv && BL.tool !== 'look' && BL.tool !== 'wall') {
            let r = BL.tool === 'terrain' ? Math.floor(BL.brush / 2) : 0;
            ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.5;
            ctx.strokeRect((hv.x - r) * cs, (hv.y - r) * cs, (2 * r + 1) * cs, (2 * r + 1) * cs);
        }
        if (hv && BL.tool === 'wall') { ctx.fillStyle = '#22d3ee'; ctx.beginPath(); ctx.arc(Math.round(hv.fx) * cs, Math.round(hv.fy) * cs, Math.max(3, cs * 0.15), 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
        let el = S.win && S.win.querySelector('[data-bld-hint]');
        if (el) el.textContent = BL.hint && Date.now() - BL.hintT < 5000 ? BL.hint : hoverText();
    }
    function hoverText() {
        let b = S.b, hv = BL.hover, lv = curLevel();
        let help = { look: 'Drag to move around · scroll to zoom · click a Plot, Emplacement or suggestion to see it', plot: 'Drag a rectangle · Shift+drag adds to your last Plot', wall: 'Drag along the grid lines (straight runs)', emp: 'Click a square', erase: 'Click part of your draft to remove it', terrain: 'Drag to paint' }[BL.tool] || '';
        if (!hv || !inGrid(b, hv.x, hv.y)) return help;
        let key = ck(hv.x, hv.y), m = cellMult(b, lv, key);
        return `${help} · square ${hv.x + 1},${hv.y + 1}: ${m == null ? 'no building here' : cellLoc(b, lv, key) + ' ×' + m}`;
    }

    // ── Builder: drawing with the pointer ───────────────────────
    function wallSegs(a, c) {
        let b = S.b, out = [], dx = c[0] - a[0], dy = c[1] - a[1];
        if (Math.abs(dx) >= Math.abs(dy)) { let y = a[1]; for (let x = Math.min(a[0], c[0]); x < Math.max(a[0], c[0]); x++) if (x >= 0 && x < b.grid.cols && y >= 0 && y <= b.grid.rows) out.push(`${x},${y},h`); }
        else { let x = a[0]; for (let y = Math.min(a[1], c[1]); y < Math.max(a[1], c[1]); y++) if (y >= 0 && y < b.grid.rows && x >= 0 && x <= b.grid.cols) out.push(`${x},${y},v`); }
        return out;
    }
    function ptr(e) { let r = BL.cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top, cs = CELL * BL.view.z; let fx = (px - BL.view.x) / cs, fy = (py - BL.view.y) / cs; return { px, py, fx, fy, x: Math.floor(fx), y: Math.floor(fy) }; }
    function wireCanvas(cv) {
        cv.addEventListener('contextmenu', e => e.preventDefault());
        cv.addEventListener('wheel', e => { e.preventDefault(); if (!BL.view) return; let p = ptr(e); zoomAt(p.px, p.py, e.deltaY < 0 ? 1.15 : 1 / 1.15); }, { passive: false });
        cv.addEventListener('pointerdown', e => {
            if (!S.b || !BL.view) return;
            // (a tool someone may no longer use: managers draw, only the GM paints terrain)
            if ((BL.tool !== 'look' && !canManage()) || (BL.tool === 'terrain' && !S.gm)) BL.tool = 'look';
            let p = ptr(e);
            try { cv.setPointerCapture(e.pointerId); } catch (x) { }
            if (BL.tool === 'look' || e.button === 1 || e.button === 2) { BL.drag = { mode: 'pan', sx: p.px, sy: p.py, vx: BL.view.x, vy: BL.view.y, moved: false, p }; return; }
            if (e.button !== 0) return;
            if (BL.tool === 'plot') BL.drag = { mode: 'rect', a: [p.x, p.y], b: [p.x, p.y], shift: e.shiftKey };
            else if (BL.tool === 'wall') BL.drag = { mode: 'wall', a: [Math.round(p.fx), Math.round(p.fy)], b: [Math.round(p.fx), Math.round(p.fy)] };
            else if (BL.tool === 'terrain') { BL.drag = { mode: 'paint', last: p }; paintAt(p); }
            else BL.drag = { mode: 'click', p };
            draw();
        });
        cv.addEventListener('pointermove', e => {
            if (!S.b || !BL.view) return;
            let p = ptr(e), d = BL.drag;
            BL.hover = p;
            if (d && d.mode === 'pan') { if (Math.abs(p.px - d.sx) + Math.abs(p.py - d.sy) > 4) { d.moved = true; BL.moved = true; } BL.view.x = d.vx + (p.px - d.sx); BL.view.y = d.vy + (p.py - d.sy); }
            else if (d && d.mode === 'rect') d.b = [Math.max(0, Math.min(S.b.grid.cols - 1, p.x)), Math.max(0, Math.min(S.b.grid.rows - 1, p.y))];
            else if (d && d.mode === 'wall') d.b = [Math.round(p.fx), Math.round(p.fy)];
            else if (d && d.mode === 'paint') {
                // every square along the stroke, however fast the pointer moved
                let n = Math.max(Math.abs(p.x - d.last.x), Math.abs(p.y - d.last.y));
                for (let i = 1; i <= n; i++) paintAt({ x: Math.round(d.last.x + (p.x - d.last.x) * i / n), y: Math.round(d.last.y + (p.y - d.last.y) * i / n) });
                d.last = p;
            }
            draw();
        });
        let end = e => {
            let d = BL.drag; BL.drag = null;
            if (!d || !S.b) { draw(); return; }
            if (d.mode === 'pan' && !d.moved && e.type === 'pointerup' && BL.tool === 'look') pickAt(d.p);
            else if (d.mode === 'rect' && e.type === 'pointerup') addPlotRect(d.a, d.b, d.shift);
            else if (d.mode === 'wall' && e.type === 'pointerup') addWall(d.a, d.b);
            else if (d.mode === 'paint') { commit(); }
            else if (d.mode === 'click' && e.type === 'pointerup') { if (BL.tool === 'emp') addEmp(d.p); else if (BL.tool === 'erase') eraseAt(d.p); }
            draw();
        };
        cv.addEventListener('pointerup', end);
        cv.addEventListener('pointercancel', end);
        cv.addEventListener('pointerleave', () => { BL.hover = null; draw(); });
    }
    function draftChanged() { saveDraft(); let side = S.win && S.win.querySelector('[data-bld-side]'); if (side) { let t = side.scrollTop; side.innerHTML = sideHtml(); side.scrollTop = t; } draw(); }
    function draftCells(lvId) { let set = new Set(); BL.draft.items.forEach(it => { if (it.k === 'plot' && it.level === lvId) it.cells.forEach(c => set.add(c)); }); return set; }
    function addPlotRect(a, c, merge) {
        let b = S.b, lv = curLevel();
        let x0 = Math.max(0, Math.min(a[0], c[0])), x1 = Math.min(b.grid.cols - 1, Math.max(a[0], c[0]));
        let y0 = Math.max(0, Math.min(a[1], c[1])), y1 = Math.min(b.grid.rows - 1, Math.max(a[1], c[1]));
        let t = taken(b, lv.id), mine = draftCells(lv.id);
        let target = merge ? BL.draft.items.slice().reverse().find(it => it.k === 'plot' && it.level === lv.id) : null;
        let cells = [], skipped = 0;
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
            let key = ck(x, y);
            if (target && target.cells.includes(key)) continue;
            if (t.cells.has(key) || mine.has(key) || cellMult(b, lv, key) == null) { skipped++; continue; }
            cells.push(key);
        }
        if (!cells.length) { hint(skipped ? 'Nothing new to build there: it\'s already built, planned, or No building.' : 'Drag across some squares.'); return; }
        if (target) target.cells = target.cells.concat(cells);
        else BL.draft.items.push({ k: 'plot', id: rid('p'), level: lv.id, cells, type: BL.type, label: BL.label.trim() });
        if (skipped) hint(`${plural(skipped, 'square')} left out (already built, planned, or No building).`);
        draftChanged();
    }
    function addWall(a, c) {
        let b = S.b, lv = curLevel(), t = taken(b, lv.id);
        let have = new Set(); BL.draft.items.forEach(it => { if (it.k === 'wall' && it.level === lv.id) it.segs.forEach(s => have.add(s)); });
        let segs = wallSegs(a, c).filter(s => !t.segs.has(s) && !have.has(s));
        if (!segs.length) { hint('Drag along the grid lines between two corners.'); return; }
        let it = BL.draft.items.find(x => x.k === 'wall' && x.level === lv.id);
        if (it) it.segs = it.segs.concat(segs); else BL.draft.items.push({ k: 'wall', level: lv.id, segs });
        draftChanged();
    }
    function addEmp(p) {
        let b = S.b, lv = curLevel(), key = ck(p.x, p.y);
        if (!inGrid(b, p.x, p.y)) return;
        if (cellMult(b, lv, key) == null) { hint('That square is marked No building.'); return; }
        if (taken(b, lv.id).emps.has(key) || BL.draft.items.some(it => it.k === 'emp' && it.level === lv.id && it.x === p.x && it.y === p.y)) { hint('There is already an Emplacement there.'); return; }
        BL.draft.items.push({ k: 'emp', id: rid('e'), level: lv.id, x: p.x, y: p.y, auto: !!BL.auto, label: '' });
        draftChanged();
    }
    function nearSeg(segs, p) {
        let best = null, bd = 0.3;
        (segs || []).forEach(s => { let [a, c] = segEnds(s).map(pk); let dx = c[0] - a[0], dy = c[1] - a[1]; let t = Math.max(0, Math.min(1, ((p.fx - a[0]) * dx + (p.fy - a[1]) * dy) / (dx * dx + dy * dy))); let d = Math.hypot(p.fx - (a[0] + t * dx), p.fy - (a[1] + t * dy)); if (d < bd) { bd = d; best = s; } });
        return best;
    }
    function eraseAt(p) {
        let b = S.b, lv = curLevel(), key = ck(p.x, p.y), items = BL.draft.items;
        let ei = items.findIndex(it => it.k === 'emp' && it.level === lv.id && it.x === p.x && it.y === p.y);
        if (ei >= 0) { items.splice(ei, 1); draftChanged(); return; }
        for (let it of items) if (it.k === 'wall' && it.level === lv.id) { let s = nearSeg(it.segs, p); if (s) { it.segs = it.segs.filter(x => x !== s); BL.draft.items = items.filter(x => !(x.k === 'wall' && !x.segs.length)); draftChanged(); return; } }
        let pi = items.findIndex(it => it.k === 'plot' && it.level === lv.id && it.cells.includes(key));
        if (pi >= 0) { let it = items[pi]; it.cells = it.cells.filter(c => c !== key); if (!it.cells.length) items.splice(pi, 1); draftChanged(); return; }
        if (S.gm && BL.editBuilt) {
            let e = b.emps.find(x => x.level === lv.id && x.x === p.x && x.y === p.y);
            if (e) { b.emps = b.emps.filter(x => x !== e); tidyJobs(b); commit('The GM removed a Weapon Emplacement.'); return; }
            let s = nearSeg((b.walls || {})[lv.id], p);
            if (s) { b.walls[lv.id] = b.walls[lv.id].filter(x => x !== s); commit(); return; }
            let pl = b.plots.find(x => x.level === lv.id && x.cells.includes(key));
            if (pl) { pl.cells = pl.cells.filter(c => c !== key); if (!pl.cells.length) b.plots = b.plots.filter(x => x !== pl); b.benches = b.benches.filter(w => b.plots.some(q => q.id === w.plot)); tidyJobs(b); commit(); return; }
        }
        hint('Nothing of your draft there.');
    }
    function paintAt(p) {
        let b = S.b, lv = curLevel(), r = Math.floor(BL.brush / 2);
        lv.terrain = lv.terrain || {};
        for (let y = p.y - r; y <= p.y + r; y++) for (let x = p.x - r; x <= p.x + r; x++) {
            if (!inGrid(b, x, y)) continue;
            if (BL.terr === '_land') delete lv.terrain[ck(x, y)]; else lv.terrain[ck(x, y)] = BL.terr;
        }
        b.updated = Date.now();
    }
    function pickAt(p) {
        let b = S.b, lv = curLevel(), key = ck(p.x, p.y), sel = null;
        let e = b.emps.find(x => x.level === lv.id && x.x === p.x && x.y === p.y);
        if (e) sel = { kind: 'emp', id: e.id };
        if (!sel) { let j = b.projects.find(x => x.item && x.item.level === lv.id && ((x.item.k === 'plot' && x.item.cells.includes(key)) || (x.item.k === 'emp' && x.item.x === p.x && x.item.y === p.y))); if (j) sel = { kind: 'proj', id: j.id }; }
        if (!sel) { let pl = b.plots.find(x => x.level === lv.id && x.cells.includes(key)); if (pl) sel = { kind: 'plot', id: pl.id }; }
        if (!sel) S.sugs.filter(sg => sg.status === 'open' && (BL.showAll || BL.show[sg.id])).some(sg => (sg.items || []).some((it, i) => {
            if (it.level === lv.id && ((it.k === 'plot' && it.cells.includes(key)) || (it.k === 'emp' && it.x === p.x && it.y === p.y))) { sel = { kind: 'sug', id: sg.id, i }; return true; }
            return false;
        }));
        BL.sel = sel;
        draftChanged();
    }

    // ── What the buttons do ─────────────────────────────────────
    function who() { return me().name; }
    function rollD100(label, bonus) {
        let c = null;
        try { c = window.APXDice && window.APXDice.formula(label, `1d100+${bonus}`, who()); } catch (e) { c = null; }
        if (c && c.parts && c.parts[0]) {
            let g = ((c.parts[0].roll || {}).groups || [])[0], nat = g && g.dice && g.dice[0] ? g.dice[0].v : 0;
            return { total: c.parts[0].total, nat };
        }
        let nat = rand(100); return { total: nat + bonus, nat };
    }
    function rollCheck(stat) {
        let b = S.b; if (!b || !STATS[stat]) return;
        if (!canManage()) { notify('Only the Bastion\'s managers roll its checks.', 'warn', true); return; }
        let s = stats(b), bonus = s.checks[stat], askId = b.ask && b.ask.stat === stat ? b.ask.id : null;
        let r = rollD100(`${b.name}: ${STATS[stat]} check${askId ? ` (TL ${b.ask.tl})` : ''}`, bonus);
        if (S.gm) { resolveCheck(b, { stat, total: r.total, nat: r.nat, who: 'GM', askId }, t => addLog(t, 'GM')); commit(); }
        else send('check', { stat, total: r.total, nat: r.nat, askId }).catch(() => { });
    }
    function amtFields(have, lead) {
        let f = [{ type: 'note', label: lead }];
        [['cu', 'Currency'], ['common', 'Common Crafting Materials'], ['uncommon', 'Uncommon Crafting Materials'], ['rare', 'Rare Crafting Materials']].forEach(([k, l]) => {
            f.push({ key: k, label: have ? `${l} (${k === 'cu' ? fmt(have[k]) + ' Cu' : fmt(have[k])} available)` : l, type: 'number', value: 0, min: have ? 0 : undefined });
        });
        return f;
    }
    function myMats() {
        let st = window.state || {}, items = st.items || [], o = { cu: int(st.currency) };
        Object.entries(MAT_NAMES).forEach(([k, n]) => { let it = items.find(i => i.name === n); o[k] = it ? int(it.ct) : 0; });
        return o;
    }
    function moveMats(amt, sign) {
        let st = window.state; if (!st) return;
        st.currency = int(st.currency) + sign * amt.cu;
        st.items = st.items || [];
        Object.entries(MAT_NAMES).forEach(([k, n]) => {
            if (!amt[k]) return;
            let it = st.items.find(i => i.name === n);
            if (!it) { it = { name: n, wt: k === 'rare' ? 5 : k === 'uncommon' ? 2 : 1, ct: 0, val: k === 'rare' ? 10 : k === 'uncommon' ? 5 : 1, isLocked: true }; st.items.push(it); }
            it.ct = Math.max(0, int(it.ct) + sign * amt[k]);
        });
        try { window.recalculateMath && window.recalculateMath(); } catch (e) { }
        try { window.scheduleAutoSave && window.scheduleAutoSave(); } catch (e) { }
    }
    function amtEmpty(a) { return !(a.cu || a.common || a.uncommon || a.rare); }
    async function gmAnswer(id, yes) {
        let r = S.reqs.find(x => x.id === id), b = S.b; if (!r || !b || !S.gm) return;
        let res;
        if (!yes) res = { status: 'declined', reply: 'Your GM said no.' };
        else if (r.kind === 'withdraw') {
            let amt = cleanAmt(r), short = ['cu', 'common', 'uncommon', 'rare'].find(k => amt[k] > (b.vault[k] || 0));
            if (short) { notify(`The vault doesn't have that much: it holds ${vaultText(b.vault)}.`, 'warn', true); return; }
            spend(b.vault, amt);
            addLog(`${r.byName || 'A player'} took ${vaultText(amt)} out of the vault (approved by the GM).`, 'GM');
            giveToPlayer(r.by, amt, 'bastion_' + r.id);
            res = { status: 'done', reply: 'Approved: it\'s on your sheet.' };
        } else if (r.kind === 'draft') {
            let err = draft(b, r.size, !!r.mech, String(r.name || '').slice(0, 60));
            if (err) { notify(err, 'warn', true); res = { status: 'declined', reply: err }; }
            else { addLog(`The Bastion drafted a ${r.mech ? 'Mechanized ' : ''}${UNITS[r.size].name}${r.name ? ' “' + r.name + '”' : ''} (${r.byName || 'a manager'} asked; the GM approved).`, 'GM'); res = { status: 'done', reply: 'Drafted.' }; }
        } else return;
        b.seen = [r.id].concat(b.seen || []).slice(0, 300);
        S.done.add(r.id);
        res.doneAt = Date.now();
        S.statusQueue.push([r.id, res]);
        commit();
    }
    function giveToPlayer(uid, amt, id) {
        if (S.store === FIRE && window.apxAuth && window.apxAuth.gmGiveToPlayer) {
            window.apxAuth.gmGiveToPlayer(S.code, uid, { id, from: 'Bastion', cu: amt.cu || 0, mats: { common: amt.common || 0, uncommon: amt.uncommon || 0, rare: amt.rare || 0 } })
                .catch(e => notify('Could not send it to the player: ' + e.message, 'warn', true));
        } else notify(`Hand ${vaultText(amt)} to the player yourself (this world isn't in the cloud).`, 'note', true);
    }
    function advanceDays(n) {
        let b = S.b; if (!S.gm || !b) return;
        n = Math.max(1, Math.min(366, int(n, 1)));
        let lines = [];
        advance(b, n, t => lines.push({ t, day: b.day }));
        lines.forEach(l => { addLog(l.t, ''); b.log[0].day = l.day; });
        addLog(`Time passes: ${plural(n, 'day')}. It is now ${when(b)}.`, 'GM');
        commit();
    }
    function queueItem(b, it, by) {
        let inf = itemInfo(b, it);
        b.projects.push({ id: rid('j'), title: inf.title, item: clone(it), cost: inf.cost, days: inf.days, daysDone: 0, paid: 0, status: 'waiting', by: by || '', at: Date.now() });
    }
    function startItems(groups) {   // [{ title, by, items }] → started, or false (with a notice)
        let b = S.b, items = [], owner = [];
        groups.forEach(g => (g.items || []).forEach(it => { items.push(clone(it)); owner.push(g); }));
        if (!items.length) return false;
        let errs = checkItems(b, items), bad = errs.map((e, i) => e ? `${owner[i].title}: ${itemInfo(b, items[i]).title}: ${e}` : null).filter(Boolean);
        if (bad.length) { window.apxAlertDialog ? window.apxAlertDialog('These can\'t be built together as they are:\n\n' + bad.join('\n'), { title: 'Start building' }) : notify(bad.join(' '), 'warn', true); return false; }
        items.forEach((it, i) => queueItem(b, it, owner[i].by));
        commit(`The GM started building ${groups.map(g => '“' + g.title + '”').join(', ')}: ${fmt(itemsCost(b, items))} Cu in all, paid day by day.`, 'GM');
        return true;
    }
    function autoTitle(items) {
        let p = items.find(it => it.k === 'plot');
        return p ? (p.label || typeName(S.b, p.type) + ' Plot') + (items.length > 1 ? ` and ${plural(items.length - 1, 'more thing')}` : '') : items.length ? itemInfo(S.b, items[0]).title : 'Suggestion';
    }
    function pickFile(cb) {
        let i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
        i.onchange = () => { let f = i.files && i.files[0]; if (f) cb(f); };
        i.click();
    }
    async function uploadImg(file, maxSide) {
        let comp = window.APXBattle && window.APXBattle.compressImage;
        if (!comp) throw new Error('Pictures can\'t be added on this page.');
        let r = await comp(file, maxSide || 1800);
        let id = rid('i'), m = me();
        await S.store.putDoc(S.code, 'imgs', id, { src: r.src, w: r.w, h: r.h, by: m.uid, byName: m.name, at: Date.now() }, false);
        let im = new Image(); im.onload = () => { BL.pat = {}; draw(); }; im.src = r.src; S.imgs[id] = im;
        return { id, w: r.w, h: r.h };
    }
    function sdEdit(f, key, d) {
        let b = S.b; if (!b || !b.sd || !canManage()) return;
        let live = S.live.sd && S.live.sd.sdId === b.sd.id ? S.live.sd : null;
        let alloc = clone((live && live.alloc) || {}); alloc.sq = alloc.sq || {}; alloc.emps = alloc.emps || [];
        let chk = sdRoom(b, alloc, b.sd.total);
        if (d > 0) {
            if (chk.left <= 0) return;
            if ((f === 'rec' && chk.room.rec <= 0) || (f === 'cu' && chk.room.cu <= 0) || (f === 'sq' && (chk.room.sq <= 0 || chk.room.sqItems[key] <= 0))) return;
        }
        if (f === 'rec') alloc.rec = Math.max(0, int(alloc.rec) + d);
        if (f === 'cu') alloc.cu = Math.max(0, int(alloc.cu) + d);
        if (f === 'sq') { alloc.sq[key] = Math.max(0, int(alloc.sq[key]) + d); if (!alloc.sq[key]) delete alloc.sq[key]; }
        putLiveSd(alloc, false);
    }
    function putLiveSd(alloc, confirm) {
        let m = me(), doc = { sdId: S.b.sd.id, alloc, by: m.uid, byName: m.name, at: Date.now(), confirm: !!confirm };
        S.live.sd = Object.assign({ id: 'sd' }, doc);
        render();
        S.store.putDoc(S.code, 'live', 'sd', doc, false).catch(e => notify(rulesHint(e) || ('Could not save it: ' + e.message), 'warn', true));
    }
    function liveAlloc() { let b = S.b, l = S.live.sd; return b && b.sd && l && l.sdId === b.sd.id ? clone(l.alloc || {}) : {}; }
    const askStatField = () => ({ key: 'stat', label: 'Which check', type: 'select', value: 'defense', options: Object.entries(STATS).map(([k, v]) => [k, `${v} (d100 + ${stats(S.b).checks[k]})`]) });

    const ACT = {
        close() { closeWin(); },
        tab(el) { S.tab = el.dataset.tab; render(); },
        found() {
            if (!S.gm) return;
            let w = S.win, q = k => w.querySelector(`[data-f="${k}"]`);
            let mgrs = [...w.querySelectorAll('[data-mgr]')].filter(x => x.checked).map(x => x.dataset.mgr);
            S.b = newBastion({ name: (q('name').value || 'Bastion').trim().slice(0, 80), founded: q('founded').value, note: q('note').value.trim().slice(0, 300), managers: mgrs, cols: q('cols').value, rows: q('rows').value });
            S.loaded = true;
            commit(`${S.b.name} was founded (${FOUNDED[S.b.founded]}${S.b.note ? ': ' + S.b.note : ''}).`, 'GM');
            S.tab = 'build'; render();
            notify(`${S.b.name} is founded. Next: a picture and terrain on the Build tab, and its first Recruits (Recruits tab).`, 'note');
        },
        roll(el) { rollCheck(el.dataset.stat); },
        recruit() {
            let b = S.b; if (!b || !canManage()) return;
            if (b.recruitWeek === week(b)) { notify('The Bastion already recruited this week.', 'warn', true); return; }
            let rolls = rollRecruitment(), res = recruitFrom(rolls);
            try { window.APXDice && window.APXDice.info({ label: `${b.name}: Recruitment (1d8)`, who: who(), text: res.text }); } catch (e) { }
            if (S.gm) { b.recruitWeek = week(b); recruitArrives(b, res, 'GM'); commit(); }
            else send('recruit', { rolls }).catch(() => { });
        },
        async deposit() {
            if (!window.state) return;
            let have = myMats();
            let r = await form('Deposit in the vault', amtFields(have, 'Move Currency and Crafting Materials from your character into the Bastion\'s vault. Building takes Currency, or half as much value in Crafting Materials.'), { okLabel: 'Deposit' });
            if (!r) return;
            let amt = cleanAmt(r);
            let over = ['cu', 'common', 'uncommon', 'rare'].find(k => amt[k] > have[k]);
            if (over) { notify('You don\'t have that much to deposit.', 'warn', true); return; }
            if (amtEmpty(amt)) return;
            moveMats(amt, -1);   // (off your character now; your GM's app adds it to the vault)
            send('deposit', amt).then(() => notify(`Sent ${vaultText(amt)} to ${S.b.name}'s vault.`, 'loot')).catch(() => moveMats(amt, 1));
        },
        async withdraw() {
            let b = S.b; if (!b || !canManage()) return;
            let r = await form('Ask for something from the vault', amtFields(b.vault, 'Your GM approves it, then it arrives on your sheet.'), { okLabel: 'Ask the GM' });
            if (!r) return;
            let amt = cleanAmt(r);
            if (['cu', 'common', 'uncommon', 'rare'].some(k => amt[k] > (b.vault[k] || 0))) { notify('The vault doesn\'t hold that much.', 'warn', true); return; }
            if (amtEmpty(amt)) return;
            send('withdraw', amt).then(() => notify('Asked your GM. It arrives on your sheet once they approve it.', 'note')).catch(() => { });
        },
        async vaultEdit() {
            let b = S.b; if (!S.gm || !b) return;
            let f = amtFields(null, `The vault holds ${vaultText(b.vault)}. Positive numbers add, negative ones take out.`).concat([{ key: 'why', label: 'Why (for the log)', type: 'text', value: '' }]);
            let r = await form('Change the vault', f, { okLabel: 'Change it' });
            if (!r) return;
            let ch = {}; ['cu', 'common', 'uncommon', 'rare'].forEach(k => { ch[k] = int(r[k]); b.vault[k] = Math.max(0, (b.vault[k] || 0) + ch[k]); });
            let parts = ['cu', 'common', 'uncommon', 'rare'].filter(k => ch[k]).map(k => `${ch[k] > 0 ? '+' : ''}${fmt(ch[k])} ${k === 'cu' ? 'Cu' : k[0].toUpperCase() + k.slice(1)}`);
            if (parts.length) commit(`The GM changed the vault: ${parts.join(', ')}${r.why ? ' (' + r.why + ')' : ''}.`, 'GM');
        },
        adv(el) { advanceDays(int(el.dataset.n, 1)); },
        async advN() {
            let r = await form('Move time forward', [{ key: 'n', label: 'Days', type: 'number', value: 3, min: 1, max: 366, hint: 'Each day pays for a day of building; each 7th day ends a week, each 28th a month.' }], { okLabel: 'Advance' });
            if (r && r.n) advanceDays(r.n);
        },
        reqYes(el) { gmAnswer(el.dataset.id, true); },
        reqNo(el) { gmAnswer(el.dataset.id, false); },
        pjUp(el) { let b = S.b, i = b.projects.findIndex(p => p.id === el.dataset.id); if (S.gm && i > 0) { let [p] = b.projects.splice(i, 1); b.projects.splice(i - 1, 0, p); commit(); } },
        async pjFinish(el) {
            let b = S.b, p = S.gm && b.projects.find(x => x.id === el.dataset.id); if (!p) return;
            let rest = Math.max(0, p.cost - (p.paid || 0)), plan = rest ? payPlan(b.vault, rest, b.matsFirst !== false) : { cu: 0 }, free = false;
            if (!plan) { if (!await confirmBox(`The vault can't pay the remaining ${fmt(rest)} Cu for ${p.title}. Finish it anyway, for free?`, { title: 'Finish now', okLabel: 'Finish it free' })) return; free = true; }
            else if (rest && !await confirmBox(`Finish ${p.title} now? The vault pays the remaining ${fmt(rest)} Cu.`, { title: 'Finish now', okLabel: 'Finish it' })) return;
            if (!free && rest) { spend(b.vault, plan); p.spent = p.spent || {}; addTo(p.spent, plan); p.paid = p.cost; }
            finishProject(b, p, t => addLog(t + (free ? ' (the GM finished it for free)' : ' (the GM finished it early)'), 'GM'));
            b.projects = b.projects.filter(x => x.status !== 'done');
            commit();
        },
        async pjCancel(el) {
            let b = S.b, p = S.gm && b.projects.find(x => x.id === el.dataset.id); if (!p) return;
            if (!await confirmBox(`Stop building ${p.title}? What it used so far (${vaultText(p.spent || {})}) goes back to the vault.`, { title: 'Cancel construction', okLabel: 'Cancel it', danger: true })) return;
            addTo(b.vault, p.spent || {});
            b.projects = b.projects.filter(x => x !== p);
            commit(`The GM cancelled ${p.title}; what it used went back to the vault.`, 'GM');
        },
        assign(el) {
            let k = el.dataset.k, id = el.dataset.id, add = int(el.dataset.add);
            if (S.gm) { let err = assignOne(S.b, k, id, add); if (err) notify(err, 'warn', true); else commit(); }
            else send('assign', { k, target: id, add }).catch(() => { });
        },
        autoAssign() {
            if (S.gm) { let n = autoAssign(S.b); notify(n ? `${plural(n, 'Recruit')} put to work.` : 'No job could be filled with the Recruits you have.', 'note'); if (n) commit(`The GM put ${plural(n, 'Recruit')} to work.`, 'GM'); else commit(); }
            else send('autoAssign', {}).catch(() => { });
        },
        async recAdd() {
            if (!S.gm) return;
            let opts = TRAITS.map(t => [t, t]);
            let r = await form('Add Recruits', [
                { key: 't1', label: 'Trait', type: 'select', value: 'Strong', options: opts },
                { key: 't2', label: 'Second Trait (an Elite Recruit)', type: 'select', value: '', options: [['', 'None']].concat(opts) },
                { key: 'n', label: 'How many', type: 'number', value: 1, min: 1, max: 200 },
                { key: 'name', label: 'Name (optional)', type: 'text', value: '' },
                { key: 'spy', label: 'Secret infiltrator', type: 'checkbox', value: false, hint: 'An android infiltrator, a raider spy, a shapeshifter. Only you see this; to the players they look like any other Recruit.' },
            ], { okLabel: 'Add' });
            if (!r) return;
            let traits = [...new Set([r.t1, r.t2].filter(Boolean))], n = Math.max(1, Math.min(200, int(r.n, 1))), added = [];
            for (let i = 0; i < n; i++) added.push(addRecruit(S.b, traits, r.name ? { name: String(r.name).slice(0, 40) + (n > 1 ? ' ' + (i + 1) : '') } : null));
            if (r.spy) { let w = window.apxGmBastionWorld && window.apxGmBastionWorld(); if (w && w.priv) { w.priv.bastionGm = w.priv.bastionGm || {}; w.priv.bastionGm.spies = (w.priv.bastionGm.spies || []).concat(added.map(x => x.id)); w.save && w.save(); } }
            commit(`${plural(n, traits.join(' & ') + ' Recruit')} joined the Bastion.`, 'GM');
        },
        recDel(el) {
            let b = S.b, r = S.gm && b.recruits.find(x => x.id === el.dataset.id); if (!r) return;
            b.recruits = b.recruits.filter(x => x !== r);
            commit(`A ${r.traits.join(' & ')} Recruit left the Bastion.`, 'GM');
        },
        async relax() {
            let st = window.state, inj = (st && st.permanentInjuries) || []; if (!inj.length) return;
            let picks = inj.slice(0, 2);
            if (inj.length > 2 && window.APXDice && window.APXDice.ask) {
                picks = [];
                for (let n = 0; n < 2; n++) {
                    let left = inj.filter(x => !picks.includes(x));
                    let v = await window.APXDice.ask('Relaxation at the Medical Plot', `Pick the ${n ? 'second' : 'first'} Permanent Injury to heal.`, left.map(x => [x.id, `${x.attr} −1${x.limb ? ' (' + x.limb + ')' : ''}`, 'pri']), { grid: true });
                    if (!v) return;
                    picks.push(left.find(x => x.id === v));
                }
            }
            let txt = picks.map(x => `${x.attr} −1${x.limb ? ' (' + x.limb + ')' : ''}`).join(' and ');
            if (!await confirmBox(`Spend a week of downtime relaxing at the Medical Plot? It's free here, and it heals ${txt}.`, { title: 'Relaxation', okLabel: 'Relax' })) return;
            st.attrAdj = st.attrAdj || {};
            picks.forEach(x => { st.attrAdj[x.attr] = (st.attrAdj[x.attr] || 0) + 1; });
            st.permanentInjuries = inj.filter(x => !picks.includes(x));
            try { window.recalculateMath && window.recalculateMath(); window.scheduleAutoSave && window.scheduleAutoSave(); } catch (e) { }
            notify(`A week of rest at the Medical Plot: healed ${txt}.`, 'note');
            send('relax', { text: `healed ${txt}` }).catch(() => { });
            render();
        },
        async askForm() {
            if (!S.gm) return;
            let r = await form('Ask for a Bastion check', [askStatField(),
                { key: 'tl', label: 'Threat Level (TL)', type: 'number', value: 60, min: 1 },
                { key: 'reason', label: 'What threatens it', type: 'text', value: '', placeholder: 'A harsh winter, a plague, an EMP storm' }], { okLabel: 'Ask' });
            if (!r || !STATS[r.stat]) return;
            S.b.ask = { id: rid('a'), stat: r.stat, tl: Math.max(1, int(r.tl, 60)), reason: String(r.reason || '').slice(0, 120), at: Date.now() };
            commit(`The GM calls for a ${STATS[r.stat]} check against TL ${S.b.ask.tl}${S.b.ask.reason ? ': ' + S.b.ask.reason : ''}.`, 'GM');
        },
        askCancel() { if (S.gm && S.b.ask) { S.b.ask = null; commit('The GM called off the Bastion check.', 'GM'); } },
        async raidForm() {
            if (!S.gm) return;
            let stationed = S.b.militia.some(m => m.stationed);
            let r = await form('A Raid', [
                { key: 'tier', label: 'Threat Level', type: 'select', value: '60', options: THREATS.map(t => [String(t[1]), `${t[0]}: TL ${t[1]}`]).concat([['custom', 'Custom']]) },
                { key: 'tl', label: 'Custom TL', type: 'number', value: 45, min: 1 },
                { key: 'reason', label: 'Who attacks', type: 'text', value: '', placeholder: 'A raider gang, a monster horde, a hostile faction' },
                { key: 'how', label: 'How to resolve it', type: 'select', value: 'abstract', options: [['abstract', 'Abstract Defense: a Defense check (d100 + Defense)'], ['active', `Active Defense: fight it on the battle map (Militia, Vehicle Scale)${stationed ? '' : ' (no Militia stationed!)'}`]] },
            ], { okLabel: 'Raid' });
            if (!r) return;
            let tl = r.tier === 'custom' ? Math.max(1, int(r.tl, 45)) : int(r.tier, 60), reason = String(r.reason || '').slice(0, 120);
            S.b.monthDue = 0;
            if (r.how === 'active') { S.b.raid = { id: rid('r'), tl, reason, at: Date.now() }; commit(`A Raid on the Bastion (TL ${tl}${reason ? ', ' + reason : ''}): the party meets it in an Active Defense.`, 'GM'); }
            else { S.b.ask = { id: rid('a'), stat: 'defense', tl, reason: reason || 'Raid', raid: true, at: Date.now() }; commit(`A Raid on the Bastion (TL ${tl}${reason ? ', ' + reason : ''})! A manager rolls the Defense check.`, 'GM'); }
        },
        raidRoll() {
            let b = S.b; if (!S.gm || !b) return;
            let inp = S.win && S.win.querySelector('[data-raidchance]'), chance = Math.max(0, Math.min(100, int(inp && inp.value, 50)));
            b.raidChance = chance;
            let c = null; try { c = window.APXDice && window.APXDice.formula(`Raid roll (a Raid on ${chance} or less)`, '1d100', 'GM'); } catch (e) { }
            let v = c && c.parts && c.parts[0] ? c.parts[0].total : rand(100), m = b.monthDue;
            b.monthDue = 0;
            if (v <= chance) { commit(`Month ${m}: the Raid roll comes up ${v} (${chance}% chance). A hostile force is coming!`, 'GM'); ACT.raidForm(); }
            else commit(`Month ${m}: the Raid roll comes up ${v} (${chance}% chance). No Raid this month.`, 'GM');
        },
        raidNone() { let b = S.b; if (!S.gm || !b) return; let m = b.monthDue; b.monthDue = 0; commit(`Month ${m}: no Raid this month.`, 'GM'); },
        raidEnd(el) {
            let b = S.b; if (!S.gm || !b.raid) return;
            let r = b.raid; b.raid = null;
            if (el.dataset.won === '1') commit(`Active Defense (TL ${r.tl}): the Militia held. The attackers are repelled.`, 'GM');
            else { b.sd = { id: rid('d'), total: r.tl, reason: 'Raid: the Militia were defeated', at: Date.now() }; commit(`Active Defense (TL ${r.tl}): the Militia were defeated. The Bastion suffers ${r.tl} Structural Damage.`, 'GM'); }
        },
        sd(el) { sdEdit(el.dataset.f, el.dataset.key, int(el.dataset.d)); },
        sdConfirm() {
            let b = S.b; if (!b || !b.sd || !canManage()) return;
            let alloc = liveAlloc();
            if (!sdRoom(b, alloc, b.sd.total).done) return;
            if (S.gm) { applySD(b, alloc, t => addLog(t, 'GM')); S.store.delDoc(S.code, 'live', 'sd').catch(() => { }); delete S.live.sd; commit(); }
            else putLiveSd(alloc, true);
        },
        draft() {
            let w = S.win, size = w.querySelector('[data-draft-size]').value, mech = w.querySelector('[data-draft-mech]').checked, name = w.querySelector('[data-draft-name]').value.trim().slice(0, 60);
            if (S.gm) {
                let err = draft(S.b, size, mech, name);
                if (err) { notify(err, 'warn', true); return; }
                commit(`The Bastion drafted a ${mech ? 'Mechanized ' : ''}${UNITS[size].name}${name ? ' “' + name + '”' : ''} (${fmt(unitCost(size, mech))} Cu).`, 'GM');
            } else {
                let err = draftCheck(S.b, size, mech);
                if (err) { notify(err, 'warn', true); return; }
                send('draft', { size, mech, name }).then(() => notify('Asked your GM to approve the draft.', 'note')).catch(() => { });
            }
        },
        milOp(el) {
            let b = S.b, m = b.militia.find(x => x.id === el.dataset.id); if (!m || !canManage()) return;
            let op = el.dataset.op;
            if (S.gm) {
                if (op === 'disband') { disband(b, m); commit(`${unitName(m)} was disbanded: its Recruits are back without a job.`, 'GM'); }
                else { m.stationed = op === 'station'; commit(`${unitName(m)} ${m.stationed ? 'is stationed at the Bastion (Garrison Defense)' : 'deployed: it leaves the Bastion'}.`, 'GM'); }
            } else send('militia', { op, target: m.id }).catch(() => { });
        },
        milHp(el) { let m = S.gm && S.b.militia.find(x => x.id === el.dataset.id); if (!m) return; let u = UNITS[m.size]; m.hp = Math.max(0, Math.min(u.hp, int(m.hp) + int(el.dataset.d))); commit(); },
        milDmg(el) { let m = S.b.militia.find(x => x.id === el.dataset.id); if (!m) return; try { window.APXDice.formula(`${unitName(m)}: attack damage (Vehicle Scale)`, UNITS[m.size].attack, who()); } catch (e) { } },
        milCmd(el) {
            let m = S.b.militia.find(x => x.id === el.dataset.id); if (!m || !window.APXDice) return;
            let attr = el.dataset.attr === 'CHA' ? 'CHA' : 'INT', bonus = 0;
            try { bonus = (typeof calc !== 'undefined' && calc.mods && calc.mods[attr]) || 0; } catch (e) { }
            window.APXDice.check({ label: `${unitName(m)}: Commander's attack (d20 + ${attr})`, attr, bonus, who: who() });
        },
        async terrAdd() {
            if (!S.gm) return;
            let r = await form('A kind of terrain', [
                { key: 'name', label: 'Name', type: 'text', value: '', placeholder: 'Lava, swamp, crystal field' },
                { key: 'color', label: 'Color (#rrggbb)', type: 'text', value: '#a855f7' },
                { key: 'noBuild', label: 'Nothing can be built on it', type: 'checkbox', value: false },
                { key: 'air', label: 'Multiplier above the surface', type: 'number', value: 10, min: 0 },
                { key: 'surface', label: 'Multiplier on the surface', type: 'number', value: 1, min: 0 },
                { key: 'below', label: 'Multiplier below the surface', type: 'number', value: 2, min: 0 },
            ], { okLabel: 'Add' });
            if (!r || !String(r.name || '').trim()) return;
            let color = /^#[0-9a-f]{3,8}$/i.test(String(r.color || '').trim()) ? r.color.trim() : '#a855f7';
            S.b.terrains.push(r.noBuild ? { id: rid('t'), name: r.name.trim().slice(0, 40), color, noBuild: true } : { id: rid('t'), name: r.name.trim().slice(0, 40), color, mult: { air: Number(r.air) || 0, surface: Number(r.surface) || 0, below: Number(r.below) || 0 } });
            commit();
        },
        async terrDel(el) {
            let b = S.b, t = S.gm && b.terrains.find(x => x.id === el.dataset.id); if (!t) return;
            if (!await confirmBox(`Remove the ${t.name} terrain? Squares painted with it go back to plain land.`, { title: 'Remove terrain', okLabel: 'Remove', danger: true })) return;
            b.terrains = b.terrains.filter(x => x !== t);
            b.levels.forEach(l => Object.keys(l.terrain || {}).forEach(k => { if (l.terrain[k] === t.id) delete l.terrain[k]; }));
            commit();
        },
        gridSet() {
            let b = S.b; if (!S.gm) return;
            let q = k => S.win.querySelector(`[data-grid="${k}"]`), cols = Math.max(8, Math.min(120, int(q('cols').value, b.grid.cols))), rows = Math.max(8, Math.min(120, int(q('rows').value, b.grid.rows)));
            let out = (x, y) => x >= cols || y >= rows;
            let hit = b.plots.some(p => p.cells.some(c => out(...pk(c)))) || b.emps.some(e => out(e.x, e.y)) || b.projects.some(j => j.item && ((j.item.cells || []).some(c => out(...pk(c))) || (j.item.k === 'emp' && out(j.item.x, j.item.y))))
                || Object.values(b.walls).some(segs => segs.some(s => { let [x, y, d] = s.split(','); return d === 'h' ? (+x >= cols || +y > rows) : (+x > cols || +y >= rows); }));
            if (hit) { notify('Something is built (or being built) outside that size. Make it bigger, or demolish it first.', 'warn', true); return; }
            b.grid = { cols, rows };
            b.levels.forEach(l => Object.keys(l.terrain || {}).forEach(k => { let [x, y] = pk(k); if (out(x, y)) delete l.terrain[k]; }));
            BL.view = null;
            commit();
        },
        artUp(el) {
            let t = el.dataset.t; if (!S.gm) return;
            pickFile(async f => { try { let r = await uploadImg(f, 400); S.b.art[t] = r.id; BL.pat = {}; commit(); } catch (e) { notify(rulesHint(e) || ('Could not add that picture: ' + e.message), 'warn', true); } });
        },
        artDel(el) { let t = el.dataset.t; if (!S.gm || !S.b.art[t]) return; S.store.delDoc(S.code, 'imgs', S.b.art[t]).catch(() => { }); delete S.b.art[t]; BL.pat = {}; commit(); },
        async reset() {
            if (!S.gm || !S.b) return;
            if (!await confirmBox(`Delete ${S.b.name} for good? Its buildings, Recruits, vault, Militia, suggestions and log are all removed. This can't be undone.`, { title: 'Delete the Bastion', okLabel: 'Delete it', danger: true })) return;
            let code = S.code;
            S.sugs.forEach(x => S.store.delDoc(code, 'sugs', x.id).catch(() => { }));
            S.reqs.forEach(x => S.store.delDoc(code, 'reqs', x.id).catch(() => { }));
            S.store.delDoc(code, 'live', 'sd').catch(() => { });
            S.b = null; S.saving++;
            S.store.saveMain(code, { deleted: true, updated: Date.now() }).catch(() => { }).then(() => { S.saving = Math.max(0, S.saving - 1); });
            S.tab = 'overview'; render(); updateButton();
        },
        // the builder
        lvGo(el) { let b = S.b, i = b.levels.indexOf(curLevel()) + int(el.dataset.d), l = b.levels[i]; if (l) { BL.level = l.id; BL.sel = null; render(); } },
        async lvAdd(el) {
            let b = S.b; if (!S.gm) return;
            let cur = curLevel(), above = el.dataset.where === 'above';
            let kind = above ? (cur.kind === 'below' ? 'below' : 'air') : (cur.kind === 'air' ? 'air' : 'below');
            let r = await form(above ? 'A level above' : 'A level below', [
                { key: 'name', label: 'Name', type: 'text', value: kind === 'air' ? 'Upper level' : kind === 'below' ? 'Underground' : 'Level' },
                { key: 'kind', label: 'Where it is', type: 'select', value: kind, options: Object.entries(KINDS).map(([k, v]) => [k, v]), hint: 'Below the surface, squares you paint as Water count as Underwater.' },
                { key: 'water', label: 'Copy the water from this level', type: 'checkbox', value: !above && cur.kind !== 'air', hint: 'Water usually goes on down: the lake above becomes the water below.' },
            ], { okLabel: 'Add level' });
            if (!r) return;
            let l = { id: rid('L'), name: String(r.name || 'Level').trim().slice(0, 40) || 'Level', kind: KINDS[r.kind] ? r.kind : kind, img: null, imgOpacity: 1, terrain: {} };
            if (r.water) Object.entries(cur.terrain || {}).forEach(([k, id]) => { if (id === 'water') l.terrain[k] = id; });
            let i = b.levels.indexOf(cur);
            b.levels.splice(above ? i : i + 1, 0, l);
            BL.level = l.id; BL.sel = null;
            commit(`The GM added a level: ${l.name} (${KINDS[l.kind]}).`, 'GM');
        },
        async lvEdit() {
            let b = S.b, l = curLevel(); if (!S.gm) return;
            let used = b.plots.some(p => p.level === l.id) || b.emps.some(e => e.level === l.id) || ((b.walls || {})[l.id] || []).length || b.projects.some(j => j.item && j.item.level === l.id);
            let r = await form('This level', [
                { key: 'name', label: 'Name', type: 'text', value: l.name },
                { key: 'kind', label: 'Where it is', type: 'select', value: l.kind, options: Object.entries(KINDS).map(([k, v]) => [k, v]) },
                { key: 'op', label: 'Picture strength (%)', type: 'number', value: Math.round(100 * (l.imgOpacity == null ? 1 : l.imgOpacity)), min: 0, max: 100 },
                { key: 'del', label: 'Delete this level', type: 'checkbox', value: false, hint: used ? 'Something is built on it: demolish that first.' : 'Nothing is built on it.' },
            ], { okLabel: 'Save' });
            if (!r) return;
            if (r.del) {
                if (used || b.levels.length < 2) { notify(used ? 'Something is built on this level. Demolish it first.' : 'The Bastion needs at least one level.', 'warn', true); return; }
                b.levels = b.levels.filter(x => x !== l); delete b.walls[l.id]; BL.level = null;
                commit(`The GM removed the ${l.name} level.`, 'GM'); return;
            }
            l.name = String(r.name || l.name).trim().slice(0, 40) || l.name;
            l.kind = KINDS[r.kind] ? r.kind : l.kind;
            l.imgOpacity = Math.max(0, Math.min(100, int(r.op, 100))) / 100;
            commit();
        },
        lvImg() {
            let l = curLevel(), lvId = l.id;
            pickFile(async f => {
                try {
                    hint('Adding the picture…');
                    let r = await uploadImg(f, 2000), b = S.b, lv = lvl(b, lvId); if (!lv) return;
                    if (S.gm) {
                        lv.img = r.id;
                        let rows = Math.max(8, Math.min(120, Math.round(b.grid.cols * r.h / r.w)));
                        let empty = !b.plots.length && !b.emps.length && !b.projects.length && !Object.values(b.walls).some(s => s.length);
                        if (empty && rows !== b.grid.rows && await confirmBox(`Make the grid ${b.grid.cols} × ${rows} squares, so the picture keeps its shape?`, { title: 'Picture', okLabel: 'Yes', cancelLabel: 'Keep ' + b.grid.cols + ' × ' + b.grid.rows })) { b.grid.rows = rows; BL.view = null; }
                        commit(`The GM set a picture for the ${lv.name} level.`, 'GM');
                    } else { await send('levelImg', { level: lvId, img: r.id }); hint('Picture sent: it shows up once your GM\'s app adds it.'); }
                } catch (e) { notify(rulesHint(e) || ('Could not add that picture: ' + e.message), 'warn', true); }
            });
        },
        lvImgDel() {
            let l = curLevel(); if (!l.img) return;
            if (S.gm) { S.store.delDoc(S.code, 'imgs', l.img).catch(() => { }); l.img = null; commit(); }
            else if (canManage()) send('levelImg', { level: l.id, img: null }).catch(() => { });
        },
        tool(el) { BL.tool = el.dataset.t; BL.drag = null; render(); },
        zoom(el) { let cv = BL.cv; if (cv && BL.view) zoomAt(cv.clientWidth / 2, cv.clientHeight / 2, int(el.dataset.d) > 0 ? 1.25 : 0.8); },
        fit() { BL.moved = false; fitView(); draw(); },
        brush(el) { BL.brush = int(el.dataset.n, 1); render(); },
        dDel(el) { BL.draft.items.splice(int(el.dataset.i), 1); draftChanged(); },
        async dSubmit() {
            let b = S.b, d = BL.draft; if (!canManage() || !d.items.length) return;
            if (checkItems(b, d.items).some(Boolean)) { notify('Part of your draft can\'t be built as it is (see the red notes).', 'warn', true); return; }
            let m = me(), id = d.editing || rid('s');
            let doc = { by: m.uid, byName: m.name, title: (d.title || '').trim().slice(0, 80) || autoTitle(d.items), note: (d.note || '').trim().slice(0, 400), items: clone(d.items), status: 'open', at: Date.now() };
            let old = d.editing && S.sugs.find(x => x.id === d.editing);
            if (old) { doc.at = old.at || doc.at; doc.updatedAt = Date.now(); doc.votes = old.votes || {}; } else doc.votes = {};
            try { await S.store.putDoc(S.code, 'sugs', id, doc, false); }
            catch (e) { notify(rulesHint(e) || ('Could not send it: ' + e.message), 'warn', true); return; }
            BL.draft = { items: [], editing: null, title: '', note: '' }; BL.show[id] = true; BL.sel = null;
            draftChanged();
            notify(old ? 'Suggestion updated.' : 'Suggestion sent: everyone sees it on the Build tab and can vote on it.', 'note');
        },
        dBuild() {
            let d = BL.draft; if (!S.gm || !d.items.length) return;
            if (startItems([{ title: (d.title || '').trim() || autoTitle(d.items), by: 'GM', items: d.items }])) {
                if (d.editing) S.store.putDoc(S.code, 'sugs', d.editing, { status: 'building', startedAt: Date.now() }, true).catch(() => { });
                BL.draft = { items: [], editing: null, title: '', note: '' }; draftChanged();
            }
        },
        async dClear() {
            if (BL.draft.items.length && !BL.draft.editing && !await confirmBox('Clear your whole draft?', { title: 'Clear', okLabel: 'Clear it' })) return;
            BL.draft = { items: [], editing: null, title: '', note: '' }; draftChanged();
        },
        vote(el) {
            let sg = S.sugs.find(x => x.id === el.dataset.id); if (!sg) return;
            let uid = me().uid, v = int(el.dataset.v), cur = (sg.votes || {})[uid] || 0, next = cur === v ? 0 : v;
            sg.votes = Object.assign({}, sg.votes || {}); if (next) sg.votes[uid] = next; else delete sg.votes[uid];
            draftChanged();
            S.store.vote(S.code, sg.id, uid, next).catch(e => notify(rulesHint(e) || ('Could not vote: ' + e.message), 'warn', true));
        },
        sugShow(el) {
            let id = el.dataset.id;
            if (BL.showAll) { BL.showAll = false; S.sugs.forEach(s => { BL.show[s.id] = s.id !== id; }); }
            else BL.show[id] = !BL.show[id];
            render();
        },
        async sugEdit(el) {
            let sg = S.sugs.find(x => x.id === el.dataset.id); if (!sg || sg.by !== me().uid) return;
            if (BL.draft.items.length && BL.draft.editing !== sg.id && !await confirmBox('Put your current draft aside and edit this suggestion instead?', { title: 'Edit', okLabel: 'Edit it' })) return;
            BL.draft = { items: clone(sg.items || []), editing: sg.id, title: sg.title || '', note: sg.note || '' };
            draftChanged();
        },
        async sugDel(el) {
            let sg = S.sugs.find(x => x.id === el.dataset.id); if (!sg || !(sg.by === me().uid || S.gm)) return;
            if (!await confirmBox(`${sg.by === me().uid ? 'Withdraw' : 'Delete'} “${sg.title}”?`, { title: 'Suggestion', okLabel: 'Yes', danger: true })) return;
            S.store.delDoc(S.code, 'sugs', sg.id).catch(e => notify(rulesHint(e) || e.message, 'warn', true));
            if (BL.draft.editing === sg.id) BL.draft.editing = null;
        },
        sugDecline(el) {
            let sg = S.gm && S.sugs.find(x => x.id === el.dataset.id); if (!sg) return;
            S.store.putDoc(S.code, 'sugs', sg.id, { status: 'declined', doneAt: Date.now() }, true).catch(() => { });
            commit(`The GM declined “${sg.title}” (suggested by ${sg.byName || 'a player'}).`, 'GM');
        },
        sugStart() {
            if (!S.gm) return;
            let picked = S.sugs.filter(s => s.status === 'open' && BL.pick[s.id]);
            if (!picked.length) return;
            if (startItems(picked.map(s => ({ title: s.title || 'Suggestion', by: s.byName || '', items: s.items || [] })))) {
                picked.forEach(s => { delete BL.pick[s.id]; S.store.putDoc(S.code, 'sugs', s.id, { status: 'building', startedAt: Date.now() }, true).catch(() => { }); });
            }
        },
        selClose() { BL.sel = null; draftChanged(); },
        selType(el) {
            let sel = S.win.querySelector('[data-seltype]'), t = sel && sel.value; if (!t) return;
            BL.draft.items = BL.draft.items.filter(it => !(it.k === 'type' && it.plot === el.dataset.id));
            BL.draft.items.push({ k: 'type', plot: el.dataset.id, type: t }); hint('Added to your draft.'); draftChanged();
        },
        async selBench(el) {
            let r = await form('A Specialized Workbench', [{ key: 'spec', label: 'Its specialization', type: 'text', value: '', placeholder: 'Smithy, Ammo Press, Alchemy Lab, Enchanting Table' }, { type: 'note', label: '2,000 Currency. Whoever crafts an item related to its specialization here has Advantage on the INT (Craft) or STR (Craft) check.' }], { okLabel: 'Add to draft' });
            if (!r || !String(r.spec || '').trim()) return;
            BL.draft.items.push({ k: 'bench', id: rid('w'), plot: el.dataset.id, spec: String(r.spec).trim().slice(0, 40) }); draftChanged();
        },
        selDock(el) { BL.draft.items.push({ k: 'dock', id: rid('w'), plot: el.dataset.id }); hint('Added to your draft.'); draftChanged(); },
        selAuto(el) { if (!BL.draft.items.some(it => it.k === 'auto' && it.emp === el.dataset.id)) BL.draft.items.push({ k: 'auto', emp: el.dataset.id }); hint('Added to your draft.'); draftChanged(); },
        async selRename(el) {
            let p = S.gm && S.b.plots.find(x => x.id === el.dataset.id); if (!p) return;
            let r = await form('Label', [{ key: 'label', label: 'What it is', type: 'text', value: p.label || '', placeholder: 'Dock, storage shed, the Grand Hall' }], { okLabel: 'Save' });
            if (r) { p.label = String(r.label || '').trim().slice(0, 40); commit(); }
        },
        async selDemolish(el) {
            let b = S.b, p = S.gm && b.plots.find(x => x.id === el.dataset.id); if (!p) return;
            if (!await confirmBox(`Demolish ${plotName(b, p)}? Its workers lose their jobs and anything inside it goes too.`, { title: 'Demolish', okLabel: 'Demolish', danger: true })) return;
            b.plots = b.plots.filter(x => x !== p); b.benches = b.benches.filter(w => w.plot !== p.id); tidyJobs(b); BL.sel = null;
            commit(`The GM demolished ${plotName(b, p)}.`, 'GM');
        },
        selEmpDel(el) { let b = S.b, e = S.gm && b.emps.find(x => x.id === el.dataset.id); if (!e) return; b.emps = b.emps.filter(x => x !== e); tidyJobs(b); BL.sel = null; commit('The GM removed a Weapon Emplacement.', 'GM'); },
    };
    const CHG = {
        set(el) { if (!S.gm) return; let k = el.dataset.k, v = String(el.value || '').slice(0, k === 'note' ? 300 : 80); if (k === 'name' && !v.trim()) return; S.b[k] = k === 'founded' ? (FOUNDED[v] ? v : 'granted') : v.trim(); commit(); },
        mult(el) {
            if (!S.gm) return;
            let v = el.value === '' ? null : Math.max(0, Number(el.value) || 0), t = el.dataset.t, k = el.dataset.kind;
            let m = t === '_land' ? S.b.landMult : ((S.b.terrains.find(x => x.id === t) || {}).mult);
            if (!m) return;
            if (v == null) delete m[k]; else m[k] = v;
            commit();
        },
        tname(el) { if (!S.gm) return; let v = String(el.value || '').trim().slice(0, 30); if (v) S.b.names[el.dataset.t] = v; else delete S.b.names[el.dataset.t]; commit(); },
        mats(el) { if (S.gm) { S.b.matsFirst = el.value === '1'; commit(); } },
        adj(el) { if (S.gm) { S.b.adj[el.dataset.k] = int(el.value); commit(); } },
        dType(el) { let it = BL.draft.items[int(el.dataset.i)]; if (it) { it.type = TYPES[el.value] ? el.value : 'empty'; draftChanged(); } },
        dLabel(el) { let it = BL.draft.items[int(el.dataset.i)]; if (it) { it.label = String(el.value || '').trim().slice(0, 40); draftChanged(); } },
        dTitle(el) { BL.draft.title = String(el.value || '').slice(0, 80); saveDraft(); },
        dNote(el) { BL.draft.note = String(el.value || '').slice(0, 400); saveDraft(); },
        route(el) { let p = S.gm && S.b.plots.find(x => x.id === el.dataset.id); if (p) { p.route = el.checked ? (p.route || true) : false; commit(`${plotName(S.b, p)} ${el.checked ? 'is now on' : 'is no longer on'} a Supply Route.`, 'GM'); } },
        routeName(el) { let p = S.gm && S.b.plots.find(x => x.id === el.dataset.id); if (p && p.route) { p.route = String(el.value || '').trim().slice(0, 60) || true; commit(); } },
    };
    function wire(w) {
        w.addEventListener('click', e => {
            let el = e.target.closest('[data-act]');
            if (!el || !w.contains(el) || el.disabled) return;
            let f = ACT[el.dataset.act]; if (!f) return;
            e.preventDefault();
            try { let p = f(el, e); if (p && p.catch) p.catch(x => { console.warn('Bastion:', x); notify('Something went wrong: ' + (x && x.message || x), 'warn', true); }); }
            catch (x) { console.warn('Bastion:', x); notify('Something went wrong: ' + x.message, 'warn', true); }
        });
        w.addEventListener('change', e => {
            let el = e.target;
            if (el.dataset.chg && CHG[el.dataset.chg]) { CHG[el.dataset.chg](el); return; }
            if (el.dataset.bl) {
                let k = el.dataset.bl;
                if (k === 'type') BL.type = TYPES[el.value] ? el.value : 'housing';
                else if (k === 'label') BL.label = String(el.value || '').slice(0, 40);
                else if (k === 'terr') BL.terr = el.value;
                else BL[k] = !!el.checked;
                render(); return;
            }
            if (el.dataset.mgr !== undefined && S.gm && S.b && S.tab === 'setup') {
                let uid = el.dataset.mgr, m = S.b.managers || [];
                S.b.managers = el.checked ? [...new Set(m.concat([uid]))] : m.filter(x => x !== uid);
                commit(); return;
            }
            if (el.dataset.sdemp) {
                let alloc = liveAlloc(), b = S.b; alloc.emps = alloc.emps || []; alloc.sq = alloc.sq || {};
                if (el.checked) { let chk = sdRoom(b, alloc, b.sd.total); if (chk.room.emp > 0 && chk.left > 0) alloc.emps.push(el.dataset.sdemp); }
                else alloc.emps = alloc.emps.filter(x => x !== el.dataset.sdemp);
                putLiveSd(alloc, false); return;
            }
            if (el.dataset.pick) { BL.pick[el.dataset.pick] = el.checked; draftChanged(); }
        });
        w.addEventListener('focusout', () => setTimeout(() => { if (_renderPending) render(); }, 0));
    }

    // ── Keeping everyone in the loop ────────────────────────────
    const NEWS = { code: null, t: 0, sugs: null, reqs: {}, waiting: new Set() };
    function news() {
        let b = S.b, uid = me().uid;
        if (NEWS.code !== S.code) { NEWS.code = S.code; NEWS.t = 0; NEWS.sugs = null; NEWS.reqs = {}; NEWS.waiting = new Set(); NEWS.ready = false; }
        if (!b) return;
        if (!NEWS.ready) { NEWS.ready = true; NEWS.t = Math.max(0, ...(b.log || []).map(e => e.t || 0)); }
        let fresh = (b.log || []).filter(e => (e.t || 0) > NEWS.t && !(S.gm && (e.by === 'GM' || !e.by))).reverse();
        NEWS.t = Math.max(NEWS.t, ...(b.log || []).map(e => e.t || 0));
        if (fresh.length) notify(`${b.name}: ${fresh.slice(-3).map(e => e.text).join(' ')}${fresh.length > 3 ? ` (+${fresh.length - 3} more in its Log)` : ''}`, 'note');
        // New suggestions (someone else's), and what became of yours
        let sugMap = {}; S.sugs.forEach(s => { sugMap[s.id] = s.status; });
        if (NEWS.sugs) S.sugs.forEach(s => {
            let was = NEWS.sugs[s.id];
            if (!was && s.by !== uid && s.status === 'open') notify(`${s.byName || 'Someone'} suggested “${s.title}” for ${b.name}: see it on the Build tab and vote.`, 'note');
            if (was === 'open' && s.status !== 'open' && s.by === uid) notify(`Your Bastion suggestion “${s.title}” was ${s.status === 'building' ? 'started: it\'s being built' : 'declined by the GM'}.`, 'note');
        });
        NEWS.sugs = sugMap;
        // Your requests that were turned down; for the GM, requests waiting on them
        S.reqs.forEach(r => {
            let was = NEWS.reqs[r.id];
            if (r.by === uid && was && was !== r.status && r.status === 'declined') notify(`Bastion: ${reqLabel(r)}: ${r.reply || 'declined'}.`, 'warn');
            NEWS.reqs[r.id] = r.status;
            if (S.gm && r.status === 'waiting' && !NEWS.waiting.has(r.id)) { NEWS.waiting.add(r.id); notify(`${r.byName || 'A player'} asks: ${reqLabel(r)}. Approve or decline it in the Bastion.`, 'note'); }
        });
    }
    function changed() {
        render(); draw(); updateButton();
        if (S.gm) gmProcessSoon();
        try { news(); } catch (e) { }
    }
    function updateButton() {
        let el = document.getElementById(S.gm ? 'gmBastionBtn' : 'playerBastionBtn'); if (!el) return;
        el.classList.toggle('hidden', !S.code);
        let b = S.b, uid = me().uid, mgr = canManage();
        let att = !!b && !!((b.ask && mgr) || (b.sd && mgr) || (S.gm && (b.monthDue || S.reqs.some(r => r.status === 'waiting'))) || S.sugs.some(s => s.status === 'open' && s.by !== uid && !(s.votes || {})[uid]));
        let t = att ? 'Bastion •' : 'Bastion';
        if (el.textContent !== t) el.textContent = t;
    }
    function tickCtx() {
        let c = ctx(), code = c && c.enabled ? c.code : null;
        if (code !== S.code || (code && pickStore(code) !== S.store)) { if (code) attach(code); else { detach(); closeWin(); } }
        updateButton();
    }
    setInterval(tickCtx, 1000);
    setTimeout(tickCtx, 200);

    // ── For the rest of the app ─────────────────────────────────
    window.APXBastion = {
        open: openWin,
        isOn: () => !!S.code,
        data: () => S.b,
        // The Bastion's Specialized Workbenches (the Craft panel offers them): { id, spec, active }
        benches() {
            let b = S.b; if (!b) return [];
            let s = stats(b);
            return b.benches.filter(w => w.kind === 'bench').map(w => ({ id: w.id, spec: w.spec, active: !!(s.plots[w.plot] && s.plots[w.plot].active) }));
        },
        settingChanged(on) { setTimeout(() => { tickCtx(); if (S.gm && window.renderWorldSettings) { try { window.renderWorldSettings(); } catch (e) { } } if (on) openWin(); else closeWin(); }, 60); },
        _t: { S, BL, stats, newBastion, normalize, payPlan, advance, itemInfo, checkItems, sdRoom, sdCap, applySD, recruitFrom, wallRuns, autoAssign, draft, enemyForce, gmProcess, tickCtx, LOCAL, TYPES, UNITS },
    };
})();
