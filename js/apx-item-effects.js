// ============================================================
// APX Item Effects: what an equipped custom item can change
// ============================================================
// Custom equippable items (rings, circlets, charms...) carry `bonuses`:
//   ac, dr, er, speedBonus          flat values (the original fields)
//   attrBonuses  [{ target: 'STR', amount }]      Core Attribute scores
//   skillBonuses [{ target: 'Notice', amount }]   skill checks
//   erBonuses    [{ target: 'Fire', amount }]     resistance to one energy type
//   statBonuses  [{ target: <key below>, amount }] everything else on the sheet
// Any number of rows, negative amounts allowed (cursed items).
// Shared by the Character Sheet (engine, Add Item, item details), GM Tools
// (Loot Maker, party summaries) so every place reads items the same way.
// ============================================================
(function () {
    'use strict';
    const ATTRS = ['STR', 'AGI', 'CON', 'PER', 'INT', 'CHA', 'LUC'];
    // Everything else an item can modify, grouped for the dropdown
    const STAT_GROUPS = [
        ['Defense', [['ac', 'AC'], ['dr', 'DR'], ['er', 'ER (all energy)'], ['wt', 'Wound Threshold']]],
        ['Vitals and Movement', [['maxHp', 'Max HP'], ['maxAp', 'Max AP'], ['speed', 'Speed (squares)'], ['init', 'Initiative'],
            ['maxRestDice', 'Max Rest Dice'], ['maxLuck', 'Max Luck Points'], ['carryCap', 'Carry Capacity (lbs)']]],
        ['Attacks and Powers', [['meleeAtk', 'Melee attack rolls'], ['meleeDmg', 'Melee damage'], ['rangedAtk', 'Ranged attack rolls'], ['rangedDmg', 'Ranged damage'],
            ['powerAtk', 'Power attack rolls'], ['powerDc', 'Power save DC']]],
        ['Saving Throws', [['saveAll', 'All saving throws']].concat(ATTRS.map(a => ['save_' + a, a + ' saves']))],
        ['Checks', [['checkAll', 'All checks (skills and attributes)']].concat(ATTRS.map(a => ['check_' + a, a + ' checks (and its skills)']))],
        ['Power Slots', [['slot_1', 'Level 1 Power Slots (INT)'], ['slot_2', 'Level 2 Power Slots (INT)'], ['slot_3', 'Level 3 Power Slots (INT)'],
            ['slot_4', 'Level 4 Power Slots (INT)'], ['slot_5', 'Level 5 Power Slots (INT)'], ['slot_CHA', 'Power Slots (CHA pool)']]]
    ];
    const STAT_LABEL = {};
    STAT_GROUPS.forEach(([, list]) => list.forEach(([k, l]) => { STAT_LABEL[k] = l; }));
    window.APX_ITEM_STAT_GROUPS = STAT_GROUPS;
    window.APX_ITEM_STAT_LABEL = STAT_LABEL;

    function num(v) { return parseInt(v) || 0; }

    // Everything the equipped custom items add up to, for one character state
    window.apxItemEffects = function (state) {
        let fx = { attr: {}, skill: {}, er: [], stat: {}, sources: [] };
        ATTRS.forEach(a => { fx.attr[a] = 0; });
        let addStat = (k, v) => { if (v) fx.stat[k] = (fx.stat[k] || 0) + v; };
        ((state && state.items) || []).forEach(item => {
            if (!(item && item.isCustomEquippable && item.equipped && item.bonuses)) return;
            let b = item.bonuses;
            fx.sources.push(item.name);
            addStat('ac', num(b.ac)); addStat('dr', num(b.dr)); addStat('er', num(b.er)); addStat('speed', num(b.speedBonus));
            (b.attrBonuses || []).forEach(r => { if (r && fx.attr[r.target] !== undefined) fx.attr[r.target] += num(r.amount); });
            if (b.attrTarget && fx.attr[b.attrTarget] !== undefined) fx.attr[b.attrTarget] += num(b.attrBonus);   // older single-slot items
            (b.skillBonuses || []).forEach(r => { if (r && r.target && num(r.amount)) fx.skill[r.target] = (fx.skill[r.target] || 0) + num(r.amount); });
            if (b.skillTarget && num(b.skillBonus)) fx.skill[b.skillTarget] = (fx.skill[b.skillTarget] || 0) + num(b.skillBonus);
            (b.erBonuses || []).forEach(r => { if (r && r.target && num(r.amount)) fx.er.push({ type: r.target, amount: num(r.amount), source: item.name }); });
            (b.statBonuses || []).forEach(r => { if (r && STAT_LABEL[r.target]) addStat(r.target, num(r.amount)); });
        });
        return fx;
    };
    window.apxItemStat = (fx, k) => (fx && fx.stat && fx.stat[k]) || 0;
    // Save / check bonus for one attribute (its own + "all")
    window.apxItemSaveBonus = (fx, a) => window.apxItemStat(fx, 'saveAll') + window.apxItemStat(fx, 'save_' + a);
    window.apxItemCheckBonus = (fx, a) => window.apxItemStat(fx, 'checkAll') + window.apxItemStat(fx, 'check_' + a);

    // "+1 STR, +2 Notice, +1 Level 1 Power Slots…" for item lists and details
    window.apxItemBonusText = function (b) {
        if (!b) return '';
        let sg = v => (v >= 0 ? '+' : '−') + Math.abs(v);
        let out = [];
        if (num(b.ac)) out.push(`${sg(num(b.ac))} AC`);
        if (num(b.dr)) out.push(`${sg(num(b.dr))} DR`);
        if (num(b.er)) out.push(`${sg(num(b.er))} ER`);
        if (num(b.speedBonus)) out.push(`${sg(num(b.speedBonus))} Speed`);
        (b.attrBonuses || []).forEach(r => { if (num(r.amount)) out.push(`${sg(num(r.amount))} ${r.target}`); });
        if (b.attrTarget && num(b.attrBonus)) out.push(`${sg(num(b.attrBonus))} ${b.attrTarget}`);
        (b.skillBonuses || []).forEach(r => { if (num(r.amount)) out.push(`${sg(num(r.amount))} ${r.target}`); });
        if (b.skillTarget && num(b.skillBonus)) out.push(`${sg(num(b.skillBonus))} ${b.skillTarget}`);
        (b.erBonuses || []).forEach(r => { if (num(r.amount)) out.push(`${sg(num(r.amount))} ${r.target} ER`); });
        (b.statBonuses || []).forEach(r => { if (num(r.amount) && STAT_LABEL[r.target]) out.push(`${sg(num(r.amount))} ${STAT_LABEL[r.target]}`); });
        return out.join(', ');
    };

    // One dropdown with every kind of bonus: values look like 'attr:STR', 'skill:Notice',
    // 'er:Fire' or 'stat:maxHp'. Used by the GM's Loot Maker.
    window.apxItemBonusOptions = function (selected) {
        let esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
        let opt = (v, l) => `<option value="${esc(v)}" ${v === selected ? 'selected' : ''}>${esc(l)}</option>`;
        let skills = (typeof SKILLS !== 'undefined' ? SKILLS : []).map(s => s.name);
        let energy = (typeof NPC_ENERGY_TYPES !== 'undefined' ? NPC_ENERGY_TYPES : ['Fire', 'Cold', 'Lightning', 'Acid', 'Poison', 'Necrotic', 'Radiant', 'Psychic', 'Thunder', 'Force']);
        return `<optgroup label="Core Attributes">${ATTRS.map(a => opt('attr:' + a, a + ' score')).join('')}</optgroup>`
            + STAT_GROUPS.map(([g, list]) => `<optgroup label="${esc(g)}">${list.map(([k, l]) => opt('stat:' + k, l)).join('')}</optgroup>`).join('')
            + `<optgroup label="Skills">${skills.map(s => opt('skill:' + s, s)).join('')}</optgroup>`
            + `<optgroup label="Energy Resistance (one type)">${energy.map(e => opt('er:' + e, e + ' resistance')).join('')}</optgroup>`;
    };
    // [{ key: 'attr:STR', amount }] → the item's bonuses object
    window.apxItemBonusesFromRows = function (rows) {
        let b = { ac: 0, dr: 0, er: 0, speedBonus: 0, attrBonuses: [], skillBonuses: [], erBonuses: [], statBonuses: [] };
        (rows || []).forEach(r => {
            let amt = num(r.amount); if (!amt || !r.key) return;
            let i = r.key.indexOf(':'), kind = r.key.slice(0, i), target = r.key.slice(i + 1);
            if (kind === 'attr') b.attrBonuses.push({ target, amount: amt });
            else if (kind === 'skill') b.skillBonuses.push({ target, amount: amt });
            else if (kind === 'er') b.erBonuses.push({ target, amount: amt });
            else if (kind === 'stat') b.statBonuses.push({ target, amount: amt });
        });
        return b;
    };
})();
