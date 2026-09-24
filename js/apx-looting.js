// ============================================================
// APX Luck and Looting (character sheet)
// ============================================================
// Looting (right after a fight, LUC (Loot) checks):
//   Ammunition: LUC (Loot) − 3d6 = single rounds recovered (0 or lower: none).
//   Currency:   LUC (Loot) × enemies defeated; the party finds half (rounded down).
//   Gear:       the GM decides what's salvageable (GM Tools Loot list).
// Scavenging (about 1 hour per attempt): LUC (Loot), PER (Notice), CON (Survive)
//   or INT (Encyclopedia). Searching for Crafting Materials uses the table:
//     Critical Failure (natural 1): nothing, and you trigger a trap or hazard
//     2–10:  1d4 Common, 1d4−1 Uncommon
//     11–15: 1d6 Common, 1d6−1 Uncommon, 1d4−1 Rare
//     16+:   1d8 Common, 1d6 Uncommon, 1d4 Rare
//     Critical Success (natural 20): 2d6 Common, 2d6 Uncommon, 2d4 Rare
// Results follow Luck rerolls and Omens: whatever was added is swapped for the new result.
// ============================================================
(function () {
    'use strict';
    const st = () => window.state;
    const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const AMMO = ['Light Ammo', 'Medium Ammo', 'Heavy Ammo'];
    const MATS = { common: 'Common Crafting Materials', uncommon: 'Uncommon Crafting Materials', rare: 'Rare Crafting Materials' };
    // Crafting Materials table: [min result, dice per rarity]
    const SCAVENGE_TABLE = [
        { min: 16, label: '16+', dice: { common: '1d8', uncommon: '1d6', rare: '1d4' } },
        { min: 11, label: '11–15', dice: { common: '1d6', uncommon: '1d6-1', rare: '1d4-1' } },
        { min: 2, label: '2–10', dice: { common: '1d4', uncommon: '1d4-1' } }
    ];
    const SCAVENGE_CRIT = { common: '2d6', uncommon: '2d6', rare: '2d4' };

    function d(sides) { return window.APXDice ? window.APXDice.rnd(sides) : 1 + Math.floor(Math.random() * sides); }
    // "1d4-1" → { total (min 0), text }
    function rollExpr(expr) {
        let m = String(expr).match(/^(\d+)d(\d+)([+-]\d+)?$/);
        if (!m) return { total: 0, text: expr };
        let rolls = Array.from({ length: +m[1] }, () => d(+m[2]));
        let flat = parseInt(m[3] || '0');
        let total = Math.max(0, rolls.reduce((a, b) => a + b, 0) + flat);
        return { total, rolls, text: `${expr.replace('-', '−')} [${rolls.join('+')}${flat ? (flat > 0 ? '+' : '−') + Math.abs(flat) : ''}]` };
    }
    window.apxRollExpr = rollExpr;

    // The same roll the sheet's own skill/attribute buttons make (bonuses, auto-fail, Disadvantage)
    function specs() {
        let out = [];
        document.querySelectorAll('[data-apx-roll]').forEach(el => {
            try { out.push(JSON.parse(el.getAttribute('data-apx-roll'))); } catch (e) { }
        });
        return out;
    }
    function skillSpec(id) { return specs().find(o => o.type === 'check' && o.skill === id && o.kind !== 'save') || null; }
    function encyclopediaSpecs() {
        let seen = new Set();
        return specs().filter(o => o.type === 'check' && /^Encyclopedia/.test(o.label || '') && !seen.has(o.label) && seen.add(o.label));
    }
    function attrSpec(attr) { return specs().find(o => o.type === 'check' && o.label === attr + ' check') || null; }
    function rollCheck(spec, extra) {
        if (!window.APXDice) return;
        let o = Object.assign({ who: st()?.name || '' }, spec || {}, extra);
        delete o.type;
        return window.APXDice.check(o);
    }
    function lootSpec() {
        let s = skillSpec('Loot') || attrSpec('LUC') || { type: 'check', attr: 'LUC', bonus: 0 };
        return Object.assign({}, s, { skill: 'Loot', attr: 'LUC' });
    }

    function item(name) { return (st().items || []).find(i => i && i.name === name && !i.isConsumable); }
    function addAmmo(name, n) {
        if (!n) return;
        window.apxNormalizeAmmo?.(st());
        let it = item(name);
        if (it) it.ct = Math.max(0, (parseInt(it.ct) || 0) + n);
        else if (n > 0) {
            let g = (typeof ADVENTURING_GEAR !== 'undefined' ? ADVENTURING_GEAR : []).find(x => x.stack === name);
            st().items.push({ name, wt: g ? g.wt / 20 : 0, ct: n, val: g ? g.cost / 20 : 0, desc: g ? g.desc : '' });
        }
    }
    function addMats(found, sign) {
        Object.keys(MATS).forEach(k => {
            let n = (found[k] || 0) * sign; if (!n) return;
            let it = item(MATS[k]);
            if (it) it.ct = Math.max(0, (parseInt(it.ct) || 0) + n);
        });
    }
    function refresh() { window.recalculateMath?.(); window.scheduleAutoSave?.(); }
    function notify(text) { window.APXDice?.notify(text, { kind: 'loot' }); }

    // Which ammo your ranged weapons use (to preselect it)
    function likelyAmmo() {
        let ranged = (st().weapons || []).find(w => w.category === 'ranged' && !w.isUnarmed);
        if (ranged) {
            let wc = (typeof WEAPON_WEIGHT_CLASSES !== 'undefined' && WEAPON_WEIGHT_CLASSES[ranged.weightClass]) || null;
            if (wc && wc.ammo) return wc.ammo;
            if (ranged.weightClass) return ranged.weightClass[0].toUpperCase() + ranged.weightClass.slice(1) + ' Ammo';
        }
        let owned = AMMO.map(n => [n, parseInt(item(n)?.ct) || 0]).sort((a, b) => b[1] - a[1]);
        return owned[0][1] > 0 ? owned[0][0] : 'Medium Ammo';
    }

    // ── Rolls ────────────────────────────────────────────────────
    window.apxLootAmmo = function (ammo) {
        let applied = 0;
        rollCheck(lootSpec(), {
            label: 'LUC (Loot): Ammunition', purpose: 'ammo',
            onResult: r => {
                let dice = rollExpr('3d6');
                let n = r.autoFail ? 0 : Math.max(0, r.total - dice.total);
                addAmmo(ammo, n - applied); applied = n; refresh();
                return n > 0 ? `Recovered ${n} ${ammo} (${r.total} − 3d6 [${dice.rolls.join('+')}] = ${n})`
                    : `No usable ammo remains (${r.total} − 3d6 [${dice.rolls.join('+')}] = ${r.total - dice.total})`;
            }
        });
    };
    window.apxLootCurrency = function (enemies, addToMe) {
        enemies = Math.max(0, parseInt(enemies) || 0);
        let applied = 0;
        rollCheck(lootSpec(), {
            label: `LUC (Loot): Currency (${enemies} ${enemies === 1 ? 'enemy' : 'enemies'})`, purpose: 'cu',
            onResult: r => {
                let cu = r.autoFail ? 0 : Math.max(0, Math.floor(r.total * enemies / 2));
                if (addToMe) { st().currency = (parseInt(st().currency) || 0) + cu - applied; applied = cu; refresh(); }
                let txt = `The party finds ${cu} Cu (${r.total} × ${enemies} ÷ 2, rounded down)` + (addToMe ? ', added to your Currency' : '');
                return { text: txt, extra: { cu, enemies } };
            }
        });
    };
    window.apxScavenge = function (spec, forMats) {
        let applied = null;
        let label = 'Scavenge: ' + (spec.label || '').replace(/\s*check$/, '');
        rollCheck(spec, {
            label, purpose: 'scavenge',
            onResult: r => {
                if (!forMats) return 'Searching for food, water or supplies: your GM decides what you find.';
                if (applied) addMats(applied, -1);
                let found = { common: 0, uncommon: 0, rare: 0 }, parts = [], head;
                if (r.nat === 1 || r.autoFail) head = 'Critical Failure: you find nothing, and you trigger a trap or hazard!';
                else {
                    let row = r.nat === 20 ? { label: 'Critical Success', dice: SCAVENGE_CRIT } : SCAVENGE_TABLE.find(t => r.total >= t.min);
                    if (!row) head = 'You find nothing useful.';
                    else {
                        Object.entries(row.dice).forEach(([k, ex]) => { let x = rollExpr(ex); found[k] = x.total; parts.push(`${x.total} ${k[0].toUpperCase() + k.slice(1)} (${x.text})`); });
                        head = `${row.label}: found ${parts.join(', ')}`;
                    }
                }
                addMats(found, 1); applied = found; refresh();
                return head;
            }
        });
    };

    // ── Loot button ──────────────────────────────────────────────
    function panel(title, bodyHtml) {
        if (window.apxInjectDialogStyles) window.apxInjectDialogStyles();
        document.getElementById('apxLootPanel')?.remove();
        let back = document.createElement('div');
        back.id = 'apxLootPanel';
        back.className = 'apxdlg-back';
        back.innerHTML = `<div class="apxdlg" style="width:min(500px,100%);max-height:90vh;overflow-y:auto"><div class="apxdlg-title">${title}</div><div data-body>${bodyHtml}</div></div>`;
        back.addEventListener('mousedown', e => { if (e.target === back) back.remove(); });
        document.body.appendChild(back);
        return back;
    }
    const box = 'border:1px solid var(--c-border,#334155);background:var(--c-surface2,#0f172a);border-radius:.5rem;padding:.6rem;margin-bottom:.5rem';
    const selCss = 'width:auto;background:var(--c-surface,#1e293b);color:inherit;border:1px solid var(--c-border2,#475569);border-radius:.3rem;font-size:.75rem;padding:.1rem .3rem';
    const small = 'font-size:.72rem;color:var(--c-text-dimmer,#cbd5e1);margin:.2rem 0 .45rem';

    window.apxLootMenu = function (opts) {
        opts = opts || {};
        let inWorld = !!(window.apxActiveWorldCode && window.apxActiveWorldCode());
        let req = window._pwLootReq && Date.now() < (window._pwLootUntil || 0) ? window._pwLootReq : null;
        let enemies = opts.enemies ?? (req && req.defeated) ?? 1;
        let ammo = likelyAmmo();
        let ency = encyclopediaSpecs();
        let scavOpts = [['Loot', 'LUC (Loot): lucky finds in unexpected places'], ['Notice', 'PER (Notice): hidden caches or overlooked items'], ['Survive', 'CON (Survive): dig through toxic trash or harsh terrain']];
        ency.forEach((o, i) => scavOpts.push(['ency:' + i, `INT (${o.label.replace(/\s*\(INT\)\s*$/, '')}): edible plants or salvageable tech`]));
        if (!ency.length) scavOpts.push(['ency:int', 'INT (Encyclopedia): edible plants or salvageable tech']);
        let back = panel('Luck and Looting', `
            <div class="apxdlg-msg" style="margin-bottom:.6rem">Looting happens right after a fight and relies on sheer luck. Scavenging is slower: about an hour of searching per attempt.</div>
            <div style="${box}${opts.focus === 'cu' ? ';border-color:#f59e0b' : ''}">
                <b style="font-size:.85rem">Loot Currency</b> <span style="font-size:.7rem;font-weight:800;color:#fcd34d">LUC (Loot)</span>
                <div style="${small}">Roll LUC (Loot) and multiply it by the number of enemies defeated. The party finds half that total in Currency (rounded down).${req ? ' <b style="color:#fcd34d">Your GM asked for this roll.</b>' : ''}</div>
                <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;font-size:.72rem">
                    Enemies defeated <input data-enemies type="number" min="0" value="${esc(enemies)}" style="${selCss};width:4.5rem;text-align:center">
                    ${inWorld ? '<span style="color:var(--c-text-muted)">Your GM hands out the Cu.</span>' : '<label style="display:flex;align-items:center;gap:.25rem"><input type="checkbox" data-addme checked> Add it to my Currency</label>'}
                    <button class="apxdlg-btn apxdlg-ok" data-go="cu" style="margin-left:auto">Roll</button></div>
            </div>
            <div style="${box}">
                <b style="font-size:.85rem">Loot Ammunition</b> <span style="font-size:.7rem;font-weight:800;color:#fcd34d">LUC (Loot) − 3d6</span>
                <div style="${small}">Most ammo is spent in a fight. Roll LUC (Loot) and subtract 3d6: what's left is the number of single rounds (or arrows or energy cells) you recover. Zero or lower: none.</div>
                <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;font-size:.72rem">
                    Ammo <select data-ammo style="${selCss}">${AMMO.map(a => `<option ${a === ammo ? 'selected' : ''}>${a}</option>`).join('')}</select>
                    <button class="apxdlg-btn apxdlg-ok" data-go="ammo" style="margin-left:auto">Roll</button></div>
            </div>
            <div style="${box}">
                <b style="font-size:.85rem">Scavenge</b> <span style="font-size:.7rem;font-weight:800;color:var(--c-text-muted)">about 1 hour</span>
                <div style="${small}">Comb through ruins, broken-down vehicles or abandoned camps for food, water or Crafting Materials. Searching for Crafting Materials: the higher the result, the more (and rarer) materials you find. A natural 1 triggers a trap or hazard.</div>
                <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;font-size:.72rem">
                    <select data-scav style="${selCss};max-width:100%">${scavOpts.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('')}</select>
                    <label style="display:flex;align-items:center;gap:.25rem"><input type="checkbox" data-mats checked> For Crafting Materials</label>
                    <button class="apxdlg-btn apxdlg-ok" data-go="scav" style="margin-left:auto">Roll</button></div>
                <table style="width:100%;margin-top:.5rem;font-size:.65rem;border-collapse:collapse;color:var(--c-text-dimmer,#cbd5e1)">
                    <tr style="color:var(--c-text-muted)"><th style="text-align:left;padding:.15rem">Result</th><th style="text-align:left;padding:.15rem">Crafting Materials Found</th></tr>
                    <tr><td style="padding:.15rem">Critical Failure</td><td style="padding:.15rem">Nothing, and you trigger a trap or hazard</td></tr>
                    <tr><td style="padding:.15rem">2–10</td><td style="padding:.15rem">1d4 Common, 1d4−1 Uncommon</td></tr>
                    <tr><td style="padding:.15rem">11–15</td><td style="padding:.15rem">1d6 Common, 1d6−1 Uncommon, 1d4−1 Rare</td></tr>
                    <tr><td style="padding:.15rem">16+</td><td style="padding:.15rem">1d8 Common, 1d6 Uncommon, 1d4 Rare</td></tr>
                    <tr><td style="padding:.15rem">Critical Success</td><td style="padding:.15rem">2d6 Common, 2d6 Uncommon, 2d4 Rare</td></tr>
                </table>
            </div>
            <div style="font-size:.68rem;color:var(--c-text-muted);margin-bottom:.6rem">Armor, weapons and valuables are lootable too, but what survives depends on the enemy and how the fight ended. Your GM decides what's salvageable.</div>
            <div class="apxdlg-row"><button class="apxdlg-btn apxdlg-cancel" data-cancel>Close</button></div>`);
        back.querySelector('[data-cancel]').onclick = () => back.remove();
        back.querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
            let go = b.dataset.go;
            if (go === 'cu') {
                let n = parseInt(back.querySelector('[data-enemies]').value) || 0;
                let addMe = !inWorld && !!back.querySelector('[data-addme]')?.checked;
                back.remove(); window.apxLootCurrency(n, addMe);
            } else if (go === 'ammo') {
                let a = back.querySelector('[data-ammo]').value;
                back.remove(); window.apxLootAmmo(a);
            } else {
                let v = back.querySelector('[data-scav]').value, mats = back.querySelector('[data-mats]').checked;
                let spec = v.startsWith('ency:') ? (v === 'ency:int' ? Object.assign({}, attrSpec('INT') || { type: 'check', attr: 'INT', bonus: 0 }, { label: 'INT (Encyclopedia) check' }) : ency[+v.slice(5)])
                    : Object.assign({}, skillSpec(v) || {}, { skill: v });
                back.remove(); window.apxScavenge(spec, mats);
            }
        });
        return back;
    };
})();
