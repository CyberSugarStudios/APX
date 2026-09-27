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
    // The reverse: an item's bonuses → [{ key, amount }] rows (to edit an item after it's made)
    window.apxItemRowsFromBonuses = function (b) {
        let rows = [];
        if (!b) return rows;
        [['ac', 'ac'], ['dr', 'dr'], ['er', 'er'], ['speedBonus', 'speed']].forEach(([f, k]) => { if (num(b[f])) rows.push({ key: 'stat:' + k, amount: num(b[f]) }); });
        (b.attrBonuses || []).forEach(r => { if (r && num(r.amount)) rows.push({ key: 'attr:' + r.target, amount: num(r.amount) }); });
        if (b.attrTarget && num(b.attrBonus)) rows.push({ key: 'attr:' + b.attrTarget, amount: num(b.attrBonus) });
        (b.skillBonuses || []).forEach(r => { if (r && num(r.amount)) rows.push({ key: 'skill:' + r.target, amount: num(r.amount) }); });
        if (b.skillTarget && num(b.skillBonus)) rows.push({ key: 'skill:' + b.skillTarget, amount: num(b.skillBonus) });
        (b.erBonuses || []).forEach(r => { if (r && num(r.amount)) rows.push({ key: 'er:' + r.target, amount: num(r.amount) }); });
        (b.statBonuses || []).forEach(r => { if (r && num(r.amount)) rows.push({ key: 'stat:' + r.target, amount: num(r.amount) }); });
        return rows;
    };
    // ── Stacking ─────────────────────────────────────────────────
    // Two items are the same thing (one stack) when everything about them matches except how many
    // there are and how they're being used right now (worn, aimed, which hand holds it).
    function stable(v) {
        if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
        if (v && typeof v === 'object') return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
        return JSON.stringify(v === undefined ? null : v);
    }
    const KINDS = ['isWeapon', 'isArmor', 'isShield', 'isHelmet', 'isBrokenHelmet', 'isConsumable', 'isCustomEquippable'];
    window.apxItemStackKey = function (it) {
        if (!it) return '';
        let c = JSON.parse(JSON.stringify(it));
        delete c.ct; delete c.equipped; delete c.id;
        if (c.isConsumable) delete c.chargesRemaining;
        if (c.weaponData) ['tr', 'aimed', 'twoHanded', 'hands', 'hand'].forEach(f => delete c.weaponData[f]);
        if (c.armorData) {
            // Armor that's been worn picks up empty bookkeeping (no mods, no craft history) and can lose its
            // price; none of that makes it a different suit of armor
            let a = c.armorData;
            delete a.paidCost; delete c.val;
            if (a.craftBatches && !Object.keys(a.craftBatches).length) delete a.craftBatches;
            if (a.mods && Object.values(a.mods).every(v => !v)) delete a.mods;
            ['stealthMod', 'athleticsMod', 'speedMod'].forEach(k => { if (!a[k]) delete a[k]; });
        }
        return stable(c);
    };
    // Can `incoming` join the stack `existing`?
    window.apxItemsStack = function (existing, incoming) {
        if (!existing || !incoming || existing === incoming) return false;
        if (existing.isCustomEquippable && existing.equipped) return false;   // a worn item stays on its own row
        if (incoming.isConsumable) {
            // Consumables: only unused ones join (a stack's first one may be part-used; the rest are full)
            let full = x => (x.chargesRemaining ?? x.charges ?? 1) >= (x.charges ?? 1);
            if (!full(incoming)) return false;
        }
        if (window.apxItemStackKey(existing) === window.apxItemStackKey(incoming)) return true;
        // Plain gear (rope, torches, ammo…): the same name, weight and description is the same thing
        let plain = x => !KINDS.some(k => x[k]);
        return plain(existing) && plain(incoming) && existing.name === incoming.name && (existing.wt || 0) === (incoming.wt || 0) && (existing.desc || '') === (incoming.desc || '');
    };
    // Character sheet: put an item into the inventory, joining a matching stack if there is one
    window.apxStashItem = function (item) {
        let st = window.state; if (!st || !item) return null;
        st.items = Array.isArray(st.items) ? st.items : [];
        let it = JSON.parse(JSON.stringify(item));
        it.ct = Math.max(1, parseInt(it.ct) || 1);
        if (it.isCustomEquippable) it.equipped = false;
        let same = st.items.find(i => window.apxItemsStack(i, it));
        if (same) { same.ct = (parseInt(same.ct) || 0) + it.ct; return same; }
        st.items.push(it);
        return it;
    };
    // Character sheet: take one item off its stack (the row goes when the last one does)
    window.apxTakeOne = function (item) {
        let st = window.state; if (!st || !item) return;
        let i = (st.items || []).indexOf(item); if (i < 0) return;
        let n = (parseInt(item.ct) || 1) - 1;
        if (n <= 0) st.items.splice(i, 1); else item.ct = n;
    };
    // Powers an equipped item grants (made in the Loot Maker with the Power Crafter)
    window.apxItemPowers = function (item) {
        return item && (item.isCustomEquippable ? item.equipped : false) && Array.isArray(item.powers) ? item.powers : [];
    };
    // "Once per Full Rest", "3 charges", "Recharge 5-6", "Unlimited" for an item power
    window.apxItemPowerUsage = function (p) {
        if (!p) return '';
        if (p.usageType === 'charges') return `${p.maxCharges || 2} charges per Full Rest`;
        if (p.usageType === 'recharge') return `Recharge ${p.rechargeOn === 6 ? '6' : (p.rechargeOn || 5) + '-6'}`;
        if (p.usageType === 'unlimitedPaid') return 'Unlimited uses';
        return 'Once per Full Rest';
    };
})();
