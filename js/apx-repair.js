// ============================================================
// APX Character Sheet: Breaking and Repairing equipment (Rulebook Chapter 8: Repairing)
// ============================================================
// Any item but Crafting Materials can be broken (🔍 → Break). A broken item can't be equipped or used until it's
// repaired at a Workbench or with a Toolkit (🔍 → Repair, or its Repair button). A repair takes Crafting Materials
// worth half of what crafting it took: a quarter of its Currency Value (rounded down), or half of a discounted
// crafting cost (Artisan); Tinker halves it again. Any rarity works. Time, DC and workspace follow the crafting rules
// for the item's full value. On a failed check the time is wasted, the materials are lost and it stays broken.
// The same screen repairs a Broken Helmet, and an Exo-Suit damaged while overloaded (its repair takes materials
// equal to the damage the suit took, and its time and DC go by that amount).
//   item.broken: a broken inventory item (it never stacks with intact ones)
// It's the crafting panel the forges use (craftCheckPanelHtml in js/apx-craft-shared.js, kind 'repair').
// ============================================================
(function () {
    'use strict';
    let R = null;   // what's being repaired: { kind: 'item'|'exo', item, discount, dmg }
    const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const isMats = it => /Crafting Materials$/i.test((it && it.name) || '');
    let save = () => { window.recalculateMath?.(); window.scheduleAutoSave?.(); };
    let note = (t, o) => window.APXDice?.notify(t, Object.assign({ kind: 'note' }, o || {}));
    window.apxIsBroken = it => !!(it && (it.broken || it.isBrokenHelmet));

    // Break one item (from a stack, one comes off broken)
    window.apxBreakItem = function (idx) {
        let st = window.state, it = st && (st.items || [])[idx];
        if (!it || isMats(it) || window.apxIsBroken(it)) return;
        if (it.storageWorn) { note(`Take ${it.name} off first (Unequip), then break it.`, { kind: 'warn', open: true }); return; }
        window.showConfirm(`Break ${(parseInt(it.ct) || 1) > 1 ? 'one ' : ''}${it.name}? A broken item can't be equipped or used until it's repaired (Crafting Materials worth a quarter of its value, at a Workbench or with a Toolkit).`, () => {
            let one;
            if ((parseInt(it.ct) || 1) > 1) {
                one = JSON.parse(JSON.stringify(it)); one.ct = 1; delete one.noSellCt;
                window.apxTakeOne(it);
                one.broken = true; one.equipped = false;
                one = window.apxStashItem ? window.apxStashItem(one) : (st.items.push(one), one);
            } else { it.broken = true; it.equipped = false; one = it; }
            window.closeModal('itemDetailModal');
            note(`${it.name} is broken. Repair it from its 🔍 (or its Repair button) to use it again.`);
            save();
        });
    };

    // What's being repaired: its name, the value its time and DC go by, and the materials it takes
    function target() {
        let st = window.state; if (!st || !R) return null;
        let { bsRank, artisanRank } = craftPerkRanks(), tinker = !!((st.perks || {}).gen_tinker);
        if (R.kind === 'exo') {
            let x = st.exoSuit; if (!x || !x.damaged) return null;
            let dmg = Math.max(0, R.dmg ?? (parseInt(x.damage) || 0));
            let mats = tinker ? Math.floor(dmg / 2) : dmg;
            return { name: x.name || 'Exo-Suit', basis: dmg, mats, exo: true, dmg, tinker, bsRank, artisanRank };
        }
        let it = R.item, i = (st.items || []).indexOf(it);
        if (i < 0 || !window.apxIsBroken(it)) return null;
        let value = it.isBrokenHelmet ? (parseInt((st.equippedHelmet || {}).cost) || 0) : Math.max(0, parseInt(it.val) || 0);
        let mats = Math.floor(Math.floor(value / 2) / 2);   // half of what crafting it took (half its value)
        if (R.discount) mats = Math.floor(Math.floor(Math.floor(value / 2) / 2) / 2);   // half of a discounted crafting cost
        if (tinker) mats = Math.floor(mats / 2);
        return { name: it.isBrokenHelmet ? 'Helmet' : it.name, basis: value, mats, value, item: it, idx: i, tinker, bsRank, artisanRank };
    }
    function repairMath() {
        let t = target(); if (!t) return null;
        let craftAttr = t.bsRank >= 1 ? (window.state.craftSkillPref || 'INT') : 'INT';
        let dc = 10 + Math.ceil(t.basis / 100), hours = Math.max(1, Math.ceil(t.basis / 100));
        if (craftAttr === 'STR' && t.bsRank >= 4) hours = Math.max(1, Math.floor(hours / 2));
        if (R.discount && t.artisanRank >= 4) hours = Math.max(1, Math.floor(hours / 2));
        let mats = craftMatsFor(t.mats, { kind: 'repair', noMins: true });
        return { t, nominalDelta: t.basis, always: true, craftAttr, dc, hours, bsRank: t.bsRank, artisanRank: t.artisanRank,
            minRareCt: mats.minRareCt, minUncommonCt: mats.minUncommonCt, commonCt: mats.commonCt, matCost: mats.matCost, mins: mats.mins, matsValid: mats.valid, matsValue: mats.value,
            hasFailRecovery: craftHasFailRecovery(craftAttr, t.bsRank, t.artisanRank),
            valueLabel: t.exo ? 'Damage to repair' : 'Item value', valueTxt: t.exo ? `${t.dmg}` : `${t.basis} Cu`, okTxt: 'It\'s repaired. Materials used.', noTxt: 'Still broken.' };
    }

    function modal() {
        let m = document.getElementById('apxRepairModal');
        if (m) return m;
        m = document.createElement('div');
        m.className = 'modal-overlay'; m.id = 'apxRepairModal';
        m.innerHTML = `<div class="modal-content max-w-[420px]"><h3 class="text-lg font-bold text-white mb-2 border-b border-slate-600 pb-2" id="apxRepairTitle">Repair</h3>
            <div id="apxRepairBody"></div>
            <div class="flex justify-end mt-3"><button onclick="window.closeModal('apxRepairModal')" class="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold transition">Close</button></div></div>`;
        document.body.appendChild(m);
        return m;
    }
    window.apxRepairRender = function () {
        let el = document.getElementById('apxRepairBody'); if (!el) return;
        let m = repairMath();
        if (!m) { window.closeModal('apxRepairModal'); return; }
        let t = m.t, st = window.state;
        document.getElementById('apxRepairTitle').textContent = `Repair: ${t.name}`;
        let canAfford = (() => { let h = craftMaterialCounts(); return h.common >= m.commonCt && h.uncommon >= m.minUncommonCt && h.rare >= m.minRareCt; })();
        let how = t.exo
            ? `Damaged while it was overloaded. Its repair takes Crafting Materials worth the damage it took (${t.dmg}${t.tinker ? ', halved by Tinker' : ''}), in any rarity. After the repair, a System Reboot (6 AP) brings it back online.`
            : `Broken. A repair takes Crafting Materials worth half of what crafting it took: a quarter of its value (${t.value} Cu)${R.discount ? ', halved again for a discounted craft' : ''}${t.tinker ? ', halved by Tinker' : ''}, in any rarity. Time and DC go by its full value.`;
        let strToggle = t.bsRank >= 1 ? `<div class="flex items-center gap-3 mb-2 bg-slate-900 border border-slate-700 rounded p-2">
            <span class="text-[10px] text-slate-400 font-bold uppercase">Craft with:</span>
            <label class="flex items-center gap-1 text-xs text-white"><input type="radio" name="repairAttr" ${st.craftSkillPref !== 'STR' ? 'checked' : ''} onchange="window.apxRepairSet('attr','INT')"> INT (Craft)</label>
            <label class="flex items-center gap-1 text-xs text-white"><input type="radio" name="repairAttr" ${st.craftSkillPref === 'STR' ? 'checked' : ''} onchange="window.apxRepairSet('attr','STR')"> STR (Craft) <span class="text-[9px] text-slate-500">(Black Smith)</span></label></div>` : '';
        let disc = !t.exo ? `<label class="flex items-start gap-2 mb-2 bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white cursor-pointer">
            <input type="checkbox" class="mt-0.5" ${R.discount ? 'checked' : ''} onchange="window.apxRepairSet('discount',this.checked)">
            <span>I crafted it at a discount <span class="block text-[9px] text-slate-400">(such as an Artisan specialization): the repair takes half of that discounted material cost</span></span></label>` : '';
        let dmgIn = t.exo ? `<div class="flex items-center gap-2 mb-2 bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white">
            <span class="flex-1">Damage the suit took while overloaded <span class="block text-[9px] text-slate-400">Tracked as you take hits: your GM can correct it</span></span>
            <input type="number" min="0" value="${t.dmg}" onchange="window.apxRepairSet('dmg',this.value)" class="bg-slate-800 border-slate-600 text-xs text-center font-bold w-20 text-white"></div>` : '';
        el.innerHTML = `<div class="text-xs text-slate-300 mb-2 leading-snug">${esc(how)}</div>${strToggle}${disc}${dmgIn}${craftCheckPanelHtml('repair', m, canAfford)}`;
    };
    window.apxRepairSet = function (what, v) {
        if (!R) return;
        if (what === 'attr') window.state.craftSkillPref = v === 'STR' ? 'STR' : 'INT';
        else if (what === 'discount') R.discount = !!v;
        else if (what === 'dmg') {
            R.dmg = Math.max(0, parseInt(v) || 0);
            let x = window.state.exoSuit; if (x) x.damage = R.dmg;
            window.scheduleAutoSave?.();
        }
        window.apxRepairRender();
    };
    // Open the Repair screen: { kind: 'item', idx } (an inventory item), { kind: 'helmet' } (your Broken Helmet) or
    // { kind: 'exo' } (your damaged Exo-Suit)
    window.apxOpenRepair = function (o) {
        let st = window.state; if (!st || !o) return;
        if (o.kind === 'exo') {
            if (!st.exoSuit || !st.exoSuit.damaged) return;
            R = { kind: 'exo' };
        } else {
            let it = o.kind === 'helmet' ? (st.items || []).find(i => i.isBrokenHelmet || (i.isHelmet && i.broken)) : (st.items || [])[o.idx];
            if (!it || !window.apxIsBroken(it)) { if (o.kind === 'helmet') note('You have no broken Helmet to repair.', { kind: 'warn' }); return; }
            R = { kind: 'item', item: it, discount: false };
        }
        window._craftAlloc.repair = null;
        if (window._craftRoll && window._craftRoll.kind === 'repair') window._craftRoll = null;
        window.closeModal('itemDetailModal');
        modal();
        window.apxRepairRender();
        window.openModal('apxRepairModal');
    };
    function fixIt(t) {
        let st = window.state;
        if (t.exo) {
            let x = st.exoSuit; x.damaged = false; x.damage = 0;
            note(`${x.name || 'Your Exo-Suit'} is repaired. A System Reboot (6 AP) brings it back online.`, { open: true });
            try { window.apxOnRollEvent?.({ id: 'exr' + Date.now().toString(36), kind: 'action', label: 'Exo-Suit repaired', text: `${st.name || 'A player'} repairs their Exo-Suit.` }); } catch (e) { }
            window.apxRenderExo?.();
            return;
        }
        let it = t.item;
        if (it.isBrokenHelmet) {
            // A Broken Helmet: it's your Helmet again (worn, if your head is free)
            window.apxTakeOne(it);
            let h = st.equippedHelmet || {};
            let inSuit = window.apxExoNoHelmet && window.apxExoNoHelmet();
            if (!h.equipped && !inSuit) { h.equipped = true; h.broken = false; note('Your Helmet is repaired and back on.', { open: true }); }
            else { h.broken = false; window.apxStashItem({ name: 'Helmet', wt: h.wt, ct: 1, val: h.cost, isHelmet: true, isLocked: true, desc: `Helmet: +${h.ac} AC/DR/ER` }); note('Your Helmet is repaired: it\'s in your inventory.', { open: true }); }
            return;
        }
        if ((parseInt(it.ct) || 1) > 1) {
            let one = JSON.parse(JSON.stringify(it)); one.ct = 1; delete one.broken; delete one.noSellCt;
            window.apxTakeOne(it);
            window.apxStashItem(one);
        } else {
            delete it.broken;
            // (it rejoins a matching stack)
            let i = st.items.indexOf(it);
            if (i >= 0 && st.items.some(x => x !== it && window.apxItemsStack(x, it))) { st.items.splice(i, 1); window.apxStashItem(it); }
        }
        note(`${t.name} is repaired.`, { open: true });
    }
    // The rolled (or typed-in) outcome. Materials are spent either way; a plain Fail with Black Smith 2 (STR) or
    // Artisan 3 gets half of them back.
    function apply(outcome) {
        let m = repairMath(); if (!m) return;
        let t = m.t, spend = { common: m.commonCt, uncommon: m.minUncommonCt, rare: m.minRareCt };
        craftSpendMaterials(spend);
        window._craftAlloc.repair = null;
        if (outcome === 'success') {
            fixIt(t);
            window.closeModal('apxRepairModal');
            R = null;
        } else {
            let back = '';
            if (outcome === 'fail' && m.hasFailRecovery) {
                let half = { common: Math.floor(spend.common / 2), uncommon: Math.floor(spend.uncommon / 2), rare: Math.floor(spend.rare / 2) };
                craftAddMaterials(half);
                back = ` Your perk recovers ${[[half.common, 'Common'], [half.uncommon, 'Uncommon'], [half.rare, 'Rare']].filter(x => x[0] > 0).map(x => x[0] + ' ' + x[1]).join(', ') || 'nothing'}.`;
            }
            note(`The repair failed: ${t.name} is still broken, and the materials are lost.${back}`, { kind: 'warn', open: true });
            setTimeout(() => window.apxRepairRender(), 0);
        }
        save();
    }
    window.apxCraftKinds = window.apxCraftKinds || {};
    window.apxCraftKinds.repair = { title: 'Repair', math: repairMath, render: () => window.apxRepairRender(), apply };

    // ── Back to the Weapon Forge from your inventory (🔍 → Forge): the weapon comes out of its stack, the Forge edits it
    // like Return to Forge, and it goes back to your inventory when the Forge closes (made or not) ──
    window._apxInvForge = null;
    window.apxForgeFromInventory = function (idx) {
        let st = window.state, it = st && (st.items || [])[idx];
        if (!it || !it.isWeapon || !it.weaponData || typeof window.openWeaponForge !== 'function') return;
        if (window.apxIsBroken(it)) { note(`${it.name} is broken: repair it first.`, { kind: 'warn', open: true }); return; }
        let w = JSON.parse(JSON.stringify(it.weaponData)); delete w.hands; delete w.hand;
        window.closeModal('itemDetailModal');
        window.apxTakeOne(it);
        st.weapons = st.weapons || [];
        st.weapons.push(w);
        let wi = st.weapons.length - 1;
        let orig = JSON.parse(JSON.stringify(it.weaponData));
        window.openWeaponForge(wi);
        window._apxInvForge = { wi, w, n: st.weapons.length, orig };
    };
    // Any other Forge opened clears it (it only ever means the weapon that came from the inventory)
    let _owf = window.openWeaponForge;
    if (typeof _owf === 'function' && !_owf._apxInv) {
        window.openWeaponForge = function () { window._apxInvForge = null; return _owf.apply(this, arguments); };
        window.openWeaponForge._apxInv = true;
    }
    window.apxInvForgeClosed = function () {
        let f = window._apxInvForge; window._apxInvForge = null;
        let st = window.state; if (!f || !st || !Array.isArray(st.weapons)) return;
        let i = st.weapons.indexOf(f.w);
        if (i < 0 && st.weapons.length === f.n && st.weapons[f.wi] && st.weapons[f.wi].forged) i = f.wi;   // (saved: the Forge put the new one in its place)
        if (i < 0) return;
        let w = st.weapons[i] === f.w ? f.orig : st.weapons[i];   // (closed without a change: exactly as it was, so it rejoins its stack)
        st.weapons.splice(i, 1);
        let same = st.items.find(x => x.isWeapon && !x.broken && window.weaponsAreStackable && window.weaponsAreStackable(x.weaponData, w));
        if (same) same.ct = (parseInt(same.ct) || 0) + 1;
        else st.items.push({ name: w.name, wt: w.weight || 0, ct: 1, val: w.paidCost || 0, isWeapon: true, isLocked: true, weaponData: JSON.parse(JSON.stringify(w)), desc: `Weapon: ${w.dmg} damage, ${w.ap} AP` });
        save();
    };
})();
