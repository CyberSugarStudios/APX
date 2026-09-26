// ============================================================
// APX Damage: DR, ER, resistances and immunities
// ============================================================
// Damage is entered in full ("-8") and reduced here by the target's defences:
//   Physical damage (Bludgeoning, Piercing, Slashing) → DR
//   Energy damage (Fire, Cold, Electric, …)           → ER
// plus a specific resistance for that type (ER +5 Fire), a Vulnerability (it
// lowers the reduction), or an Immunity (no damage). Damage of two types
// ("Slashing + Fire") is split evenly between them. Attacks that ignore DR/ER
// (all, half, or X) and an Incapacitated target (all resistances bypassed)
// are handled too, so a hit that deals 0 damage is always recognised as one.
// Shared by the Character Sheet and the GM Tools.
// ============================================================
(function () {
    'use strict';
    const PHYS = ['Bludgeoning', 'Piercing', 'Slashing'];
    const ENERGY = () => (typeof NPC_ENERGY_TYPES !== 'undefined' ? NPC_ENERGY_TYPES : ['Fire', 'Cold', 'Electric', 'Acid', 'Poison', 'Sonic', 'Radiation', 'Force', 'Psychic']);
    const ALIAS = { lightning: 'Electric', electricity: 'Electric', electrical: 'Electric', shock: 'Electric', elec: 'Electric', thunder: 'Sonic', sound: 'Sonic',
        rad: 'Radiation', radiant: 'Radiation', necrotic: 'Radiation', psionic: 'Psychic', mental: 'Psychic', frost: 'Cold', ice: 'Cold', flame: 'Fire', heat: 'Fire',
        toxic: 'Poison', corrosive: 'Acid', blunt: 'Bludgeoning', bludgeon: 'Bludgeoning', pierce: 'Piercing', slash: 'Slashing', cut: 'Slashing',
        physical: 'Physical', phys: 'Physical', p: 'Physical', true: 'True', pure: 'True', none: 'True', raw: 'True', t: 'True', f: 'Fire', c: 'Cold', e: 'Electric' };

    // One word → a damage type ('Physical' = DR, 'True' = nothing reduces it), or null
    function norm(word) {
        let w = String(word || '').trim().toLowerCase().replace(/[^a-z]/g, '');
        if (!w) return null;
        if (ALIAS[w]) return ALIAS[w];
        let all = PHYS.concat(ENERGY());
        return all.find(t => t.toLowerCase() === w) || all.find(t => w.length >= 3 && t.toLowerCase().startsWith(w)) || null;
    }
    // "Slashing + Fire (split)" → ['Slashing', 'Fire']
    function parts(text) {
        if (!text) return [];
        let out = [];
        String(text).replace(/\(.*?\)/g, ' ').split(/[+,/&]|\band\b|\s+/i).forEach(p => { let t = norm(p); if (t && !out.includes(t)) out.push(t); });
        return out;
    }
    function isEnergy(t) { return ENERGY().includes(t); }
    function label(t) { return t === 'True' ? 'true damage' : t === 'Physical' ? 'physical' : t; }

    // def: { dr, er, res: { Type: +N resist / −N vulnerable }, immune: [types] }
    // opts: { ignore: 'all' | 'half' | N, bypassRes: bool, halfBypass: bool (Ironclad R4) }
    function mitigate(raw, types, def, opts) {
        raw = Math.max(0, Math.floor(Number(raw) || 0));
        def = def || {}; opts = opts || {};
        types = (types && types.length ? types : ['Physical']).slice();
        if (types.includes('True')) return { dmg: raw, raw, reduced: 0, text: `${raw} true damage (no DR/ER)` };
        let n = types.length, base = Math.floor(raw / n), extra = raw - base * n, total = 0, bits = [];
        types.forEach((t, i) => {
            let part = base + (i < extra ? 1 : 0);
            if (!part && raw) { bits.push(`0 ${label(t)}`); return; }
            let immune = (def.immune || []).some(x => x === t || (t === 'Physical' && PHYS.includes(x)));
            if (immune) { bits.push(`${part} ${label(t)} → 0 (Immune)`); return; }
            let energy = isEnergy(t);
            let pool = Math.max(0, energy ? (def.er || 0) : (def.dr || 0));
            let res = (def.res || {})[t] || 0;
            let why = [];
            if (opts.bypassRes) { if (pool) why.push(`${energy ? 'ER' : 'DR'} bypassed`); pool = 0; res = Math.min(0, res); }
            let ign = 0;
            if (opts.ignore === 'all') ign = pool;
            else if (opts.ignore === 'half') ign = Math.floor(pool / 2);
            else if (Number(opts.ignore) > 0) ign = Math.min(pool, Number(opts.ignore));
            if (ign && opts.halfBypass) ign = Math.floor(ign / 2);
            if (ign) why.push(`ignores ${ign}`);
            pool -= ign;
            let reduction = pool + res;
            let dmg = Math.max(0, part - reduction);
            total += dmg;
            let red = '';
            if (pool) red += ` − ${energy ? 'ER' : 'DR'} ${pool}`;
            if (res > 0) red += ` − ${t} resistance ${res}`;
            if (res < 0) red += ` + ${t} vulnerability ${-res}`;
            bits.push(`${part} ${label(t)}${red}${why.length ? ' (' + why.join(', ') + ')' : ''} = ${dmg}`);
        });
        return { dmg: total, raw, reduced: raw - total, text: bits.join('; ') };
    }

    // The weapon's own DR/ER-ignoring property (NPC weapons: Ignore X / half / all)
    function ignoreOf(hit) {
        let props = (hit && hit.props) || [];
        if (props.includes('ignoreall')) return 'all';
        if (props.includes('ignorehalf')) return 'half';
        if (props.includes('ignoreX')) return Math.max(1, hit.tier || 1);
        return null;
    }

    // Buttons for "what kind of damage was it?" (when nothing says)
    async function askType(title, text, def) {
        let ask = window.APXDice && window.APXDice.ask;
        if (!ask) return ['Physical'];
        def = def || {};
        let choices = [['Physical', `Physical (DR ${def.dr || 0})`, 'pri']]
            .concat(ENERGY().map(t => [t, `${t}${(def.immune || []).includes(t) ? ' (Immune)' : ''}`, '']))
            .concat([['True', 'Ignores DR/ER', '']]);
        let v = await ask(title, text, choices);
        return v ? [v] : null;
    }

    window.APXDamage = { PHYS, ENERGY, norm, parts, isEnergy, mitigate, ignoreOf, askType };
})();
