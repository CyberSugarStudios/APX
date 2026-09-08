// ============================================================
// APX Character Sheet — Inventory, Weapons, Powers & Skills UI
// ============================================================
        window.toggleSkillTraining = (id, checked) => { window.state.skillsTrained[id] = checked; window.recalculateMath(); };
        window.toggleWeaponAim = (idx, checked) => { window.state.weapons[idx].aimed = checked; window.recalculateMath(); };
        window.toggleWeaponTwoHanded = (idx, checked) => {
            if (checked) {
                let w = window.state.weapons[idx];
                let handsFree = window.calcTotalHands() - window.calcHandsUsed(idx);
                if (handsFree < 2) {
                    window.showConfirm(`Not enough free hands to wield ${w.name} two-handed.`, null, true);
                    return;
                }
            }
            window.state.weapons[idx].twoHanded = checked;
            window.recalculateMath();
        };
        window.toggleSaveTraining = (attr, checked) => {
            if (!window.state.savesTrained) window.state.savesTrained = {};
            window.state.savesTrained[attr] = checked;
            window.recalculateMath();
        };
        window.deleteCustomSkill = (id) => { window.showConfirm('Delete this custom skill?', () => { window.state.customSkills = window.state.customSkills.filter(s => s.id !== id); window.recalculateMath(); }); };
        window.updateItemName = (idx, val) => { window.state.items[idx].name = val; window.recalculateMath(); };
        window.updateItemWt = (idx, val) => { window.state.items[idx].wt = parseFloat(val)||0; window.recalculateMath(); };
        window.updateItemCt = (idx, val) => { window.state.items[idx].ct = parseInt(val)||0; window.recalculateMath(); };
        window.updateItemVal = (idx, val) => { window.state.items[idx].val = parseInt(val)||0; window.recalculateMath(); };
        window.deleteItem = (idx) => { window.showConfirm('Delete item?', () => { window.state.items.splice(idx, 1); window.recalculateMath(); }); };

        // Returns the full list of limb slots for the Wounded condition,
        // expanding past the base 6 if the character has any trait that
        // grants extra arms/legs (Polymelia today; any future trait with
        // an `extraLegs` field works automatically, no code change needed).
        window.calcWoundedSlots = function() {
            let slots = [...WOUND_LIMBS_BASE];
            let extraArms = 0, extraLegs = 0;
            (window.state.ancestry.traits || []).forEach(tId => {
                let tDef = ANCESTRY_TRAITS.find(t => t.id === tId);
                if (tDef && tDef.extraArms) extraArms = Math.max(extraArms, tDef.extraArms);
                if (tDef && tDef.extraLegs) extraLegs = Math.max(extraLegs, tDef.extraLegs);
            });
            for (let i = 0; i < extraArms; i++) slots.push(`Extra Arm ${i + 1}`);
            for (let i = 0; i < extraLegs; i++) slots.push(`Extra Leg ${i + 1}`);
            return slots;
        };

        window.openConditionPicker = function() {
            let condRows = CONDITIONS.map(c => {
                let active = window.state.conditions.includes(c.id);
                return `
                    <label class="flex items-start gap-2 bg-slate-900 border ${active ? 'border-red-600' : 'border-slate-700'} rounded p-2 cursor-pointer">
                        <input type="checkbox" class="mt-1" ${active ? 'checked' : ''} onchange="window.toggleCondition('${c.id}', this.checked)">
                        <div><div class="text-xs font-bold text-slate-200">${c.name}</div><div class="text-[10px] text-slate-500 leading-tight">${c.desc}</div></div>
                    </label>
                `;
            }).join('');

            let woundSlots = window.calcWoundedSlots();
            let woundRows = woundSlots.map(limb => {
                let active = window.state.woundedLimbs.includes(limb);
                let limbType = limb.includes('Leg') ? 'Leg' : limb.includes('Arm') ? 'Arm' : limb;
                let limbDesc = (WOUND_LIMB_EFFECTS[limbType] || {}).desc || '';
                return `
                    <label class="flex items-start gap-2 bg-slate-900 border ${active ? 'border-red-600' : 'border-slate-700'} rounded p-2 cursor-pointer">
                        <input type="checkbox" class="mt-1" ${active ? 'checked' : ''} onchange="window.toggleWoundedLimb('${limb}', this.checked)">
                        <div><div class="text-xs font-bold text-slate-200">${limb}</div><div class="text-[9px] text-slate-500 leading-tight">${limbDesc}</div></div>
                    </label>
                `;
            }).join('');

            document.getElementById('conditionPickerList').innerHTML = condRows;
            document.getElementById('woundedLimbsList').innerHTML = woundRows;
            document.getElementById('fatigueLevelDisplay').innerText = window.state.fatigue || 0;
            window.openModal('conditionPickerModal');
        };

        window.toggleCondition = function(id, checked) {
            if (checked) {
                if (!window.state.conditions.includes(id)) window.state.conditions.push(id);
            } else {
                window.state.conditions = window.state.conditions.filter(x => x !== id);
            }
            window.recalculateMath();
        };

        window.toggleWoundedLimb = function(limb, checked) {
            if (checked) {
                if (!window.state.woundedLimbs.includes(limb)) window.state.woundedLimbs.push(limb);
            } else {
                window.state.woundedLimbs = window.state.woundedLimbs.filter(x => x !== limb);
            }
            window.recalculateMath();
        };

        window.adjustFatigueFromPicker = function(delta) {
            let next = Math.max(0, (window.state.fatigue || 0) + delta);
            window.updateState('fatigue', next);
            document.getElementById('fatigueLevelDisplay').innerText = next;
        };

        window.renderActiveConditions = function() {
            let el = document.getElementById('activeConditionsDisplay');
            if (!el) return;
            let condTags = window.state.conditions.map(id => {
                let c = CONDITIONS.find(x => x.id === id);
                return c ? `<span class="text-[9px] bg-red-900/40 text-red-300 border border-red-800/50 px-1.5 py-0.5 rounded font-bold">${c.name}</span>` : '';
            });
            let limbTags = window.state.woundedLimbs.map(limb =>
                `<span class="text-[9px] bg-red-900/40 text-red-300 border border-red-800/50 px-1.5 py-0.5 rounded font-bold">Wounded: ${limb}</span>`
            );
            let fatigueTag = window.state.fatigue > 0
                ? [`<span class="text-[9px] bg-amber-900/40 text-amber-300 border border-amber-800/50 px-1.5 py-0.5 rounded font-bold">Fatigue ${window.state.fatigue}</span>`]
                : [];
            let allTags = condTags.concat(limbTags).concat(fatigueTag);
            el.innerHTML = allTags.length ? allTags.join(' ') : '<span class="text-[10px] text-slate-600">No active conditions.</span>';
        };

        window.openItemDetail = function(idx) {
            let item = window.state.items[idx];
            if (!item) return;
            window._itemDetailIdx = idx;

            // Editing Name/Weight/Value now lives here instead of inline in
            // the main inventory row (which only leaves Count editable) --
            // except for isLocked items (unequipped armor/weapons/forged
            // gear), which stay fully read-only here too, so moving armor
            // to inventory and back still can't be used to quietly change
            // its stats for free.
            let statsHtml = item.isLocked
                ? `<div class="text-xs text-slate-400 mb-3">Weight: <span class="text-slate-300 font-bold">${item.wt}</span> lb each &middot; Value: <span class="text-yellow-500/70 font-bold">${item.val}</span> Cu each</div>`
                : `<div class="grid grid-cols-2 gap-2 mb-3">
                    <div>
                        <label class="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Weight (each)</label>
                        <input type="number" id="itemDetailWt" value="${item.wt}" onchange="window.updateItemWt(${idx}, this.value)" class="bg-slate-900 text-xs w-full text-center">
                    </div>
                    <div>
                        <label class="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Value (each)</label>
                        <input type="number" id="itemDetailVal" value="${item.val}" onchange="window.updateItemVal(${idx}, this.value)" class="bg-slate-900 text-yellow-400 text-xs w-full text-center">
                    </div>
                   </div>`;

            if (item.isCustomEquippable && item.bonuses && !item.isLocked) {
                let b = item.bonuses;
                let prefix = `itemDetail${idx}`;
                window._bonusDrafts[prefix] = {
                    attr: JSON.parse(JSON.stringify(b.attrBonuses || (b.attrTarget ? [{ target: b.attrTarget, amount: b.attrBonus }] : []))),
                    skill: JSON.parse(JSON.stringify(b.skillBonuses || (b.skillTarget ? [{ target: b.skillTarget, amount: b.skillBonus }] : []))),
                    er: JSON.parse(JSON.stringify(b.erBonuses || [])),
                };
                statsHtml += `
                    <div class="bg-slate-900 border border-slate-700 rounded p-2 mb-3 space-y-3">
                        <div class="grid grid-cols-3 gap-2">
                            <div><label class="block text-[10px] text-slate-500 mb-1">+AC</label><input type="number" value="${b.ac||0}" onchange="window.updateItemBonusFlat(${idx}, 'ac', this.value)" class="bg-slate-800 text-xs w-full"></div>
                            <div><label class="block text-[10px] text-slate-500 mb-1">+DR</label><input type="number" value="${b.dr||0}" onchange="window.updateItemBonusFlat(${idx}, 'dr', this.value)" class="bg-slate-800 text-xs w-full"></div>
                            <div><label class="block text-[10px] text-slate-500 mb-1">+ER (generic)</label><input type="number" value="${b.er||0}" onchange="window.updateItemBonusFlat(${idx}, 'er', this.value)" class="bg-slate-800 text-xs w-full"></div>
                        </div>
                        <div><label class="block text-[10px] text-slate-500 mb-1">+Speed</label><input type="number" value="${b.speedBonus||0}" onchange="window.updateItemBonusFlat(${idx}, 'speedBonus', this.value)" class="bg-slate-800 text-xs w-full"></div>
                        <div>
                            <label class="block text-[10px] text-slate-500 mb-1">Attribute Bonuses</label>
                            <div id="${prefix}AttrBonusList" class="space-y-1 mb-1"></div>
                            <button type="button" onclick="window.addBonusDraftRow('${prefix}', 'attr'); window.commitItemBonusDraft(${idx})" class="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold">+ Add Attribute Bonus</button>
                        </div>
                        <div>
                            <label class="block text-[10px] text-slate-500 mb-1">Skill Bonuses</label>
                            <div id="${prefix}SkillBonusList" class="space-y-1 mb-1"></div>
                            <button type="button" onclick="window.addBonusDraftRow('${prefix}', 'skill'); window.commitItemBonusDraft(${idx})" class="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold">+ Add Skill Bonus</button>
                        </div>
                        <div>
                            <label class="block text-[10px] text-slate-500 mb-1">Energy Resistance Bonuses</label>
                            <div id="${prefix}ErBonusList" class="space-y-1 mb-1"></div>
                            <button type="button" onclick="window.addBonusDraftRow('${prefix}', 'er'); window.commitItemBonusDraft(${idx})" class="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold">+ Add Energy Resistance Bonus</button>
                        </div>
                    </div>
                `;
            }

            let body;
            if (item.isConsumable && item.draft) {
                let lines = window.ccDetailLines(item.draft);
                let linesHtml = lines.map(l => `<div class="flex justify-between text-xs py-1 border-b border-slate-800"><span class="text-slate-500">${l.label}</span><span class="text-slate-200 font-bold text-right max-w-[60%]">${l.value}</span></div>`).join('');
                body = `
                    <div class="text-[10px] text-purple-400 uppercase font-bold tracking-wider mb-1">Consumable -- Power Crafter Settings</div>
                    <div class="bg-slate-900 border border-slate-700 rounded p-2 mb-3">${linesHtml}</div>
                    <div class="flex items-center justify-between bg-slate-900 border border-purple-800/50 rounded p-2 mb-3">
                        <span class="text-xs font-bold text-slate-200">Charges Remaining</span>
                        <div class="flex items-center gap-2">
                            <button onclick="window.adjustItemCharges(${idx}, -1)" class="w-7 h-7 rounded bg-slate-700 hover:bg-slate-600 text-white font-bold">-</button>
                            <span class="w-14 text-center font-black text-lg text-white">${item.chargesRemaining} / ${item.charges}</span>
                            <button onclick="window.adjustItemCharges(${idx}, 1)" class="w-7 h-7 rounded bg-amber-700 hover:bg-amber-600 text-white font-bold">+</button>
                        </div>
                    </div>
                `;
            } else {
                body = '';
            }
            body = statsHtml + body;

            body += `
                <label class="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Description</label>
                <textarea id="itemDetailDesc" onchange="window.updateItemDetailDesc(${idx}, this.value)" class="bg-slate-900 text-xs h-20 resize-none w-full" placeholder="What does this item do?">${item.desc || ''}</textarea>
            `;

            document.getElementById('itemDetailTitle').innerHTML = item.isLocked
                ? item.name
                : `<input type="text" id="itemDetailName" value="${item.name}" onchange="window.updateItemName(${idx}, this.value)" class="bg-slate-900 text-white font-bold text-lg w-full">`;
            document.getElementById('itemDetailBody').innerHTML = body;
            if (item.isCustomEquippable && item.bonuses && !item.isLocked) {
                renderAllBonusDraftLists(`itemDetail${idx}`);
            }
            window.openModal('itemDetailModal');
        };

        window.updateItemDetailDesc = function(idx, val) {
            window.state.items[idx].desc = val;
        };

        // Sell/Discard work regardless of isLocked -- that flag exists to
        // stop free stat-editing on unequipped armor/weapons/forged gear,
        // not to trap an item in inventory forever. Selling pays out half
        // total value (rounded down) for however many units are sold;
        // Discard removes the whole stack for nothing. Both close the
        // detail popup since the item they were inspecting may no longer
        // exist afterward.
        window.sellItem = function(idx) {
            let item = window.state.items[idx];
            if (!item) return;
            if ((item.ct || 1) <= 1) {
                let payout = Math.floor((item.val || 0) / 2);
                window.showConfirm(`Sell ${item.name} for ${payout} Currency?`, () => {
                    window.state.currency = (window.state.currency || 0) + payout;
                    window.state.items.splice(idx, 1);
                    window.closeModal('itemDetailModal');
                    window.recalculateMath();
                });
                return;
            }
            // More than one in the stack -- ask how many, rather than
            // assuming the player wants to liquidate the whole pile of
            // (for example) 50 Common Crafting Materials at once.
            window._sellQtyIdx = idx;
            document.getElementById('sellQtyItemName').innerText = item.name;
            document.getElementById('sellQtyMax').innerText = item.ct;
            let qtyInput = document.getElementById('sellQtyInput');
            qtyInput.value = item.ct;
            qtyInput.max = item.ct;
            window.updateSellQtyPayout();
            window.openModal('sellQuantityModal');
        };
        window.updateSellQtyPayout = function() {
            let item = window.state.items[window._sellQtyIdx];
            if (!item) return;
            let qty = Math.max(1, Math.min(item.ct, parseInt(document.getElementById('sellQtyInput').value) || 1));
            document.getElementById('sellQtyPayout').innerText = Math.floor((item.val || 0) * qty / 2);
        };
        window.confirmSellQuantity = function() {
            let idx = window._sellQtyIdx;
            let item = window.state.items[idx];
            if (!item) return;
            let qty = Math.max(1, Math.min(item.ct, parseInt(document.getElementById('sellQtyInput').value) || 1));
            let payout = Math.floor((item.val || 0) * qty / 2);
            window.state.currency = (window.state.currency || 0) + payout;
            if (qty >= item.ct) {
                window.state.items.splice(idx, 1);
            } else {
                item.ct -= qty;
            }
            window.closeModal('sellQuantityModal');
            window.closeModal('itemDetailModal');
            window.recalculateMath();
        };
        window.discardItem = function(idx) {
            let item = window.state.items[idx];
            if (!item) return;
            window.showConfirm(`Discard ${item.ct > 1 ? item.ct + 'x ' : ''}${item.name}? This can't be undone.`, () => {
                window.state.items.splice(idx, 1);
                window.closeModal('itemDetailModal');
                window.recalculateMath();
            });
        };

        window.adjustItemCharges = function(idx, delta) {
            let item = window.state.items[idx];
            if (!item) return;
            let next = (item.chargesRemaining || 0) + delta;
            if (next < 0) next = 0;
            if (next > item.charges) next = item.charges;
            item.chargesRemaining = next;
            if (window._itemDetailIdx === idx) {
                window.openItemDetail(idx); // refresh the open detail modal in place
            } else {
                window.recalculateMath(); // just refresh the inventory row
            }
        };

        window.openGearPicker = function() {
            let categories = [...new Set(ADVENTURING_GEAR.map(g => g.cat))];
            let html = categories.map(cat => {
                let rows = ADVENTURING_GEAR.filter(g => g.cat === cat).map(g => `
                    <div class="flex items-center justify-between gap-2 bg-slate-900 border border-slate-700 rounded px-2 py-1.5">
                        <div class="flex-1 min-w-0">
                            <div class="text-xs font-bold text-slate-200">${g.name} <span class="text-yellow-500 text-[10px]">[${g.cost} Cu, ${g.wt} lb]</span></div>
                            <div class="text-[9px] text-slate-500 leading-tight">${g.desc}</div>
                        </div>
                        <button onclick="window.addGearItem('${g.name.replace(/'/g, "\\'")}')" class="shrink-0 w-7 h-7 rounded bg-amber-700 hover:bg-amber-600 text-white font-bold text-sm">+</button>
                    </div>
                `).join('');
                return `<div><div class="text-[10px] font-black text-amber-400 uppercase tracking-wider mb-1">${cat}</div><div class="space-y-1">${rows}</div></div>`;
            }).join('');
            document.getElementById('gearPickerList').innerHTML = html;
            window.openModal('gearPickerModal');
        };

        // ------------------------------------------------------------------
        // Shared "how are you getting this?" prompt for anything added to
        // inventory with a Currency cost -- base gear, custom items, and
        // crafted consumables all funnel through this rather than each
        // silently deducting (or, as it turned out, in two of the three
        // cases, never deducting at all). A GM granting an item for free
        // is common enough that a hard "always charge" default was wrong.
        // ------------------------------------------------------------------
        let payOrGrantCallback = null;
        window.askPayOrGrant = function(itemName, cost, onResolve) {
            if (!cost) { onResolve(false); return; } // free items skip the prompt entirely
            payOrGrantCallback = onResolve;
            document.getElementById('payOrGrantMessage').innerText = `${itemName} costs ${cost} Currency. How are you acquiring it?`;
            let payBtn = document.getElementById('payOrGrantPayBtn');
            let canAfford = (window.state.currency || 0) >= cost;
            payBtn.disabled = !canAfford;
            payBtn.classList.toggle('opacity-50', !canAfford);
            payBtn.classList.toggle('cursor-not-allowed', !canAfford);
            payBtn.title = canAfford ? '' : `Not enough Currency (you have ${window.state.currency || 0})`;
            window.openModal('payOrGrantModal');
        };
        window.resolvePayOrGrant = function(paid) {
            let cb = payOrGrantCallback;
            payOrGrantCallback = null;
            window.closeModal('payOrGrantModal');
            if (cb) cb(paid);
        };

        window.addGearItem = function(name) {
            let g = ADVENTURING_GEAR.find(x => x.name === name);
            if (!g) return;
            window.askPayOrGrant(g.name, g.cost, (paid) => {
                let existing = window.state.items.find(i => i.name === g.name && i.wt === g.wt && i.val === g.cost && !i.isConsumable);
                if (existing) existing.ct += 1;
                else window.state.items.push({ name: g.name, wt: g.wt, ct: 1, val: g.cost, desc: g.desc });
                if (paid) window.state.currency = (window.state.currency || 0) - g.cost;
                window.recalculateMath();
            });
        };
        
        window.addWeapon = function() {
            // Reset form fields and show the creation popup rather than
            // pushing directly -- avoids the inconsistency where the
            // hand-check was bypassed at creation time but enforced on
            // re-equip from inventory.
            document.getElementById('cwName').value = '';
            document.getElementById('cwDmg').value = '2d4';
            document.getElementById('cwCategory').value = 'melee';
            document.getElementById('cwAttr').value = 'STR';
            document.getElementById('cwWeightClass').value = 'light';
            document.getElementById('cwWt').value = '2';
            document.getElementById('cwVal').value = '0';
            document.getElementById('cwNotes').value = '';
            window.updateCwApPreview();
            window.openModal('customWeaponModal');
        };
        window.updateCwApPreview = function() {
            let wc = document.getElementById('cwWeightClass').value;
            let apMap = { light: { ap: 2, hands: '1 Hand' }, medium: { ap: 3, hands: '1 Hand' }, heavy: { ap: 4, hands: '2 Hands' } };
            let info = apMap[wc] || apMap.light;
            document.getElementById('cwApPreview').innerText = `AP: ${info.ap} · ${info.hands}`;
            // Show warning if this weight class can't be equipped right now
            let handsNeeded = wc === 'heavy' ? 2 : 1;
            let testWeap = { weightClass: wc, category: document.getElementById('cwCategory').value };
            let freeAfterAdd = (window.calcTotalHands ? window.calcTotalHands() : 2) - (window.calcHandsUsed ? window.calcHandsUsed() : 0) - handsNeeded;
            let warn = document.getElementById('cwHandsWarning');
            if (warn) warn.classList.toggle('hidden', freeAfterAdd >= 0);
        };
        window.confirmAddCustomWeapon = function() {
            let name = document.getElementById('cwName').value.trim() || 'Custom Weapon';
            let wc = document.getElementById('cwWeightClass').value;
            let apMap = { light: 2, medium: 3, heavy: 4 };
            let weapon = {
                name, attr: document.getElementById('cwAttr').value,
                tr: false, dmg: document.getElementById('cwDmg').value,
                ap: apMap[wc] || 2, isUnarmed: false, isCustom: true,
                category: document.getElementById('cwCategory').value,
                weightClass: wc, weight: parseFloat(document.getElementById('cwWt').value) || 0,
                paidCost: parseInt(document.getElementById('cwVal').value) || 0,
                notes: document.getElementById('cwNotes').value.trim()
            };
            // Hand-check: if not enough hands, route to inventory instead
            // of the active weapons list -- same logic as the Weapon Forge's
            // fallback, so creation and re-equip are now consistent.
            let handsNeeded = wc === 'heavy' ? 2 : 1;
            let handsFree = (window.calcTotalHands ? window.calcTotalHands() : 2) - (window.calcHandsUsed ? window.calcHandsUsed() : 0);
            if (handsFree >= handsNeeded) {
                window.state.weapons.push(weapon);
            } else {
                window.state.items.push({
                    name: weapon.name, wt: weapon.weight || 0, ct: 1, val: weapon.paidCost || 0,
                    isWeapon: true, isLocked: true, weaponData: JSON.parse(JSON.stringify(weapon)),
                    desc: `Weapon: ${weapon.dmg} damage, ${weapon.ap} AP`
                });
                window.showConfirm(`${weapon.name} was added to your Inventory -- not enough free hands to wield it right now. Equip it from inventory whenever a hand is free.`, null, true);
            }
            window.closeModal('customWeaponModal');
            window.recalculateMath();
        };
        window.updateWeaponNotes = (idx, val) => { window.state.weapons[idx].notes = val; };
        window.updateWeaponName = (idx, val) => { window.state.weapons[idx].name = val; window.recalculateMath(); };
        window.updateWeaponAttr = (idx, val) => { window.state.weapons[idx].attr = val; window.recalculateMath(); };
        window.updateWeaponTr = (idx, val) => { window.state.weapons[idx].tr = val; window.recalculateMath(); };
        window.updateWeaponDmg = (idx, val) => { window.state.weapons[idx].dmg = val; window.recalculateMath(); };
        window.updateWeaponAp = (idx, val) => { window.state.weapons[idx].ap = parseInt(val)||1; window.recalculateMath(); };
        window.deleteWeapon = (idx) => { window.showConfirm('Delete weapon?', () => { window.state.weapons.splice(idx, 1); window.recalculateMath(); }); };
        window.removeEquippedArmor = function() {
            let armor = window.state.equippedArmor;
            if (!armor.name) return;
            window.showConfirm(`Remove ${armor.name}? It'll move to your inventory, where you can re-equip it later.`, () => {
                window.state.items.push({
                    name: armor.name, wt: armor.wt, ct: 1, val: armor.paidCost || 0,
                    isArmor: true, isLocked: true, armorData: JSON.parse(JSON.stringify(armor)),
                    desc: `Armor: +${armor.ac} AC, +${armor.dr} DR, +${armor.er} ER`
                });
                window.state.equippedArmor = {
                    name: "", wt: 0, ac: 0, dr: 0, er: 0,
                    stealthMod: 0, athleticsMod: 0, speedMod: 0,
                    mods: { acBonus: 0, drBonus: 0, erBonus: 0, wtReduction: 0, wtIncrease: 0, stealthBonus: 0, athleticsBonus: 0, stealthPenalty: 0, athleticsPenalty: 0, speedPenalty: 0 },
                    craftBatches: {}, paidCost: 0
                };
                window.recalculateMath();
            });
        };
        window.equipArmorFromInventory = function(idx) {
            let item = window.state.items[idx];
            if (!item || !item.isArmor) return;
            let doEquip = () => {
                if (window.state.equippedArmor.name) {
                    // Swap: whatever's currently worn goes back to the inventory first.
                    let current = window.state.equippedArmor;
                    window.state.items.push({
                        name: current.name, wt: current.wt, ct: 1, val: current.paidCost || 0,
                        isArmor: true, isLocked: true, armorData: JSON.parse(JSON.stringify(current)),
                        desc: `Armor: +${current.ac} AC, +${current.dr} DR, +${current.er} ER`
                    });
                }
                window.state.equippedArmor = JSON.parse(JSON.stringify(item.armorData));
                window.state.items.splice(idx, 1);
                window.recalculateMath();
            };
            if (window.state.equippedArmor.name) {
                window.showConfirm(`Equip ${item.name}? Your currently worn ${window.state.equippedArmor.name} will move to your inventory.`, doEquip);
            } else {
                doEquip();
            }
        };
        
        window.deletePower = (idx) => { window.showConfirm('Delete this power?', () => { window.state.powers.splice(idx, 1); window.recalculateMath(); }); };

        // ------------------------------------------------------------------
        // Weapon equip/unequip -- mirrors Armor's inventory<->equipped
        // pattern, but weapons don't "swap" (you can carry several equipped
        // at once), so this is just a plain move each direction. Innate
        // weapons (Unarmed Strike, Ancestry's Innate Weapon trait) are
        // permanent and never offered an Unequip button in the first place.
        // ------------------------------------------------------------------
        // Two unequipped weapons stack into one inventory entry only if
        // EVERY intrinsic property matches -- name, damage, weight, AP,
        // category, weight class, and anything a forged weapon carries
        // (damage type, crit multiplier, range, properties, etc). Usage-
        // state fields (trained, aimed, wielded two-handed) are excluded
        // since those describe how a weapon is currently being used, not
        // what it physically is -- two otherwise-identical daggers don't
        // stop being the same dagger because one was aimed and the other
        // wasn't. A misspelled "Daggre" naturally won't stack with
        // "Dagger" until the name is corrected, since name is compared
        // like everything else.
        function weaponsAreStackable(a, b) {
            let volatileFields = ['tr', 'aimed', 'twoHanded'];
            let strip = (w) => {
                let copy = { ...w };
                volatileFields.forEach(f => delete copy[f]);
                return copy;
            };
            return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
        }
        window.weaponsAreStackable = weaponsAreStackable;

        window.unequipWeapon = function(idx) {
            let w = window.state.weapons[idx];
            if (!w || w.isUnarmed || w.isAncestry) return;
            window.showConfirm(`Unequip ${w.name}? It'll move to your inventory, where you can re-equip it later.`, () => {
                let existing = window.state.items.find(i => i.isWeapon && weaponsAreStackable(i.weaponData, w));
                if (existing) {
                    existing.ct += 1;
                } else {
                    window.state.items.push({
                        name: w.name, wt: w.weight || 0, ct: 1, val: w.paidCost || 0,
                        isWeapon: true, isLocked: true, weaponData: JSON.parse(JSON.stringify(w)),
                        desc: `Weapon: ${w.dmg} damage, ${w.ap} AP`
                    });
                }
                window.state.weapons.splice(idx, 1);
                window.recalculateMath();
            });
        };
        window.equipWeaponFromInventory = function(idx) {
            let item = window.state.items[idx];
            if (!item || !item.isWeapon) return;
            window.state.weapons.push(JSON.parse(JSON.stringify(item.weaponData)));
            let handsFree = window.calcTotalHands() - window.calcHandsUsed();
            if (handsFree < 0) {
                window.state.weapons.pop();
                window.showConfirm(`Not enough free hands to wield ${item.name} alongside what you already have equipped.`, null, true);
                return;
            }
            // Equipping one out of a stack only removes ONE unit -- the
            // rest stay in inventory, ready to equip again -- rather than
            // the whole stack vanishing at once.
            item.ct -= 1;
            if (item.ct <= 0) window.state.items.splice(idx, 1);
            window.recalculateMath();
        };


        // ------------------------------------------------------------------
        // Shield & Helmet: simpler than the full Armor Forge system since
        // these are fixed off-the-shelf items, not custom-built gear.
        // Equipping when not yet owned buys it outright (deducting
        // Currency); equipping again just re-equips what's already owned.
        // The Helmet can additionally be broken (loses its AC bonus but
        // keeps its weight, matching a piece of ruined but still-carried
        // gear) and requires a repair check before it can be worn again.
        // ------------------------------------------------------------------
        // A Shield takes a hand to wield. Heavy weapons (melee or ranged)
        // always need both hands, so they're structurally incompatible
        // with a Shield and move to inventory automatically. Anything
        // else that's using both hands (dual-wielding two Light weapons,
        // a Medium weapon held two-handed, etc.) has no single "obviously
        // wrong" item to remove on the player's behalf, so that case
        // blocks with a message instead of guessing.
        function unequipHeavyWeaponsForShield() {
            let moved = [];
            for (let i = window.state.weapons.length - 1; i >= 0; i--) {
                let w = window.state.weapons[i];
                if (w.weightClass === 'heavy' && !w.isUnarmed && !w.isAncestry) {
                    window.state.items.push({
                        name: w.name, wt: w.weight || 0, ct: 1, val: w.paidCost || 0,
                        isWeapon: true, isLocked: true, weaponData: JSON.parse(JSON.stringify(w)),
                        desc: `Weapon: ${w.dmg} damage, ${w.ap} AP`
                    });
                    window.state.weapons.splice(i, 1);
                    moved.push(w.name);
                }
            }
            if (moved.length) {
                window.showConfirm(`Equipping a Shield requires a free hand -- ${moved.join(', ')} (Heavy, requiring both hands) moved to your inventory.`, null, true);
            }
        }
        // Returns true if the shield can actually be worn once Heavy
        // weapons (which always get bumped) are accounted for.
        function canFitShieldAfterHeavyRemoved() {
            let handsUsedByNonHeavy = 0;
            window.state.weapons.forEach(w => {
                if (w.weightClass === 'heavy') return; // these are leaving regardless
                handsUsedByNonHeavy += (w.isUnarmed || w.isAncestry) ? 0 : (w.weightClass === 'medium' && w.twoHanded ? 2 : 1);
            });
            return window.calcTotalHands() - handsUsedByNonHeavy >= 1;
        }
        window.toggleEquipShield = function() {
            let s = window.state.equippedShield;
            if (s.equipped) {
                window.showConfirm('Remove your Shield? It\'ll move to your inventory, where you can re-equip it later.', () => {
                    s.equipped = false;
                    window.state.items.push({ name: 'Shield', wt: s.wt, ct: 1, val: s.cost, isShield: true, isLocked: true, desc: `Shield: +${s.ac} AC/DR/ER` });
                    window.recalculateMath();
                });
                return;
            }
            let owned = window.state.items.find(i => i.isShield);
            if (owned) {
                if (!canFitShieldAfterHeavyRemoved()) {
                    window.showConfirm('Not enough free hands to equip a Shield. Unequip a weapon first, or switch a two-handed Medium weapon to one-handed.', null, true);
                    return;
                }
                window.state.items.splice(window.state.items.indexOf(owned), 1);
                s.equipped = true;
                unequipHeavyWeaponsForShield();
                window.recalculateMath();
                return;
            }
            if ((window.state.currency || 0) < s.cost) {
                window.showConfirm(`Not enough Currency. A Shield costs ${s.cost}, you have ${window.state.currency || 0}.`, null, true);
                return;
            }
            if (!canFitShieldAfterHeavyRemoved()) {
                window.showConfirm('Not enough free hands to equip a Shield. Unequip a weapon first, or switch a two-handed Medium weapon to one-handed.', null, true);
                return;
            }
            window.showConfirm(`Buy and equip a Shield for ${s.cost} Currency?`, () => {
                window.state.currency = (window.state.currency || 0) - s.cost;
                s.equipped = true;
                unequipHeavyWeaponsForShield();
                window.recalculateMath();
            });
        };
        window.toggleEquipHelmet = function() {
            let h = window.state.equippedHelmet;
            if (h.equipped) {
                window.showConfirm('Remove your Helmet? It\'ll move to your inventory, where you can re-equip it later.', () => {
                    h.equipped = false;
                    window.state.items.push({ name: 'Helmet', wt: h.wt, ct: 1, val: h.cost, isHelmet: true, isLocked: true, desc: `Helmet: +${h.ac} AC/DR/ER` });
                    window.recalculateMath();
                });
                return;
            }
            let brokenOwned = window.state.items.find(i => i.isBrokenHelmet);
            if (brokenOwned) {
                window.openHelmetRepairModal();
                return;
            }
            let owned = window.state.items.find(i => i.isHelmet);
            if (owned) {
                window.state.items.splice(window.state.items.indexOf(owned), 1);
                h.equipped = true;
                h.broken = false;
                window.recalculateMath();
                return;
            }
            if ((window.state.currency || 0) < h.cost) {
                window.showConfirm(`Not enough Currency. A Helmet costs ${h.cost}, you have ${window.state.currency || 0}.`, null, true);
                return;
            }
            window.showConfirm(`Buy and equip a Helmet for ${h.cost} Currency?`, () => {
                window.state.currency = (window.state.currency || 0) - h.cost;
                h.equipped = true;
                h.broken = false;
                window.recalculateMath();
            });
        };
        window.breakHelmet = function() {
            let h = window.state.equippedHelmet;
            if (!h.equipped) return;
            window.showConfirm('Break your Helmet? It stops providing its AC bonus (though you still carry its weight) until repaired.', () => {
                h.equipped = false;
                h.broken = true;
                window.state.items.push({
                    name: 'Broken Helmet', wt: h.wt, ct: 1, val: 0,
                    isBrokenHelmet: true,
                    desc: 'A damaged helmet. Provides no AC bonus until repaired.'
                });
                window.recalculateMath();
            });
        };
        window.openHelmetRepairModal = function() {
            let h = window.state.equippedHelmet;
            // Follows the same crafting-cost rules as the Armor/Weapon
            // Forges: DC = 10 + ceil(materials cost / 100). Repair
            // materials are half the item's Currency value.
            let matsCost = Math.ceil(h.cost / 2);
            let dc = 10 + Math.ceil(matsCost / 100);
            document.getElementById('helmetRepairDc').innerText = dc;
            document.getElementById('helmetRepairMats').innerText = `${matsCost} Common Crafting Materials`;
            window.openModal('helmetRepairModal');
        };
        window.confirmHelmetRepair = function() {
            let brokenItem = window.state.items.find(i => i.isBrokenHelmet);
            if (!brokenItem) { window.closeModal('helmetRepairModal'); return; }
            let h = window.state.equippedHelmet;
            let matsCost = Math.ceil(h.cost / 2);
            // Deduct materials if the player happens to have them on hand,
            // but don't block the repair if not -- materials could just as
            // easily come from another player, an NPC, or be handled
            // off-sheet entirely. A successful repair is a successful
            // repair regardless of whose pack the materials came out of.
            let matsIdx = window.state.items.findIndex(i => i.name === 'Common Crafting Materials' && (i.ct || 0) >= matsCost);
            if (matsIdx !== -1) window.state.items[matsIdx].ct -= matsCost;
            window.state.items.splice(window.state.items.indexOf(brokenItem), 1);
            window.state.equippedHelmet.broken = false;
            window.state.equippedHelmet.equipped = true;
            window.closeModal('helmetRepairModal');
            window.recalculateMath();
        };


        window.openEncyclopediaModal = function() {
            document.getElementById('encTextInput').value = '';
            window.openModal('addEncyclopediaModal');
        }

        window.saveEncyclopedia = function() {
            let val = document.getElementById('encTextInput').value;
            if(!val) return;
            let newSkill = {
                id: 'enc_' + Date.now(),
                name: 'Encyclopedia (' + val + ')',
                attr: 'INT', pass: true, reqTr: false, isCustom: true
            };
            window.state.customSkills.push(newSkill);
            window.closeModal('addEncyclopediaModal');
            // If this Encyclopedia was opened from the shared training
            // picker (Origin Competencies, Ancestry Skill Aptitude, etc.),
            // auto-train it too and hand the new skill back to whoever
            // asked for it, same as picking a normal skill would.
            if (skillPickerCallback) {
                window.state.skillsTrained[newSkill.id] = true;
                if (!window.state.skillSource) window.state.skillSource = {};
                window.state.skillSource[newSkill.id] = skillPickerSource || 'Unknown';
                let cb = skillPickerCallback;
                skillPickerCallback = null;
                skillPickerSource = null;
                window.recalculateMath();
                cb(newSkill.id, newSkill.name);
            } else {
                window.recalculateMath();
            }
        }

        // ------------------------------------------------------------------
        // Shared "train a skill" picker: lists every skill (showing which
        // are already trained), plus an Encyclopedia option. Used anywhere
        // a rule grants training in a skill of the player's choice --
        // Origin Competencies, Ancestry's Skill Aptitude trait, Ancestry's
        // final training step, and Spend XP's Gain Training. Auto-trains
        // the chosen skill and hands its id/name back to the caller via
        // callback, so the caller can track what it granted (e.g. Origin
        // needs to remember which competency slot got which skill)
        // without re-implementing this list itself. Also records which of
        // those systems granted it (source), purely for the "where did
        // this training come from" tooltip in Core Attributes & Skills.
        // ------------------------------------------------------------------
        let skillPickerCallback = null;
        let skillPickerSource = null;
        window.openSkillTrainPicker = function(callback, title, source) {
            skillPickerCallback = callback;
            skillPickerSource = source || 'Unknown';
            document.getElementById('skillTrainPickerTitle').innerText = title || 'Choose a Skill to Train';
            renderSkillTrainPickerList();
            window.openModal('skillTrainPickerModal');
        };
        function renderSkillTrainPickerList() {
            let body = document.getElementById('skillTrainPickerBody');
            let rows = SKILLS.map(s => {
                let trained = !!window.state.skillsTrained[s.id];
                return `<button ${trained ? 'disabled' : ''} onclick="window.selectSkillForTraining('${s.id}', '${s.name.replace(/'/g, "\\'")}')" class="w-full text-left text-xs px-2 py-1.5 rounded border ${trained ? 'bg-slate-800 text-slate-600 border-slate-800 cursor-not-allowed' : 'bg-slate-900 text-slate-200 border-slate-700 hover:border-blue-500'}">${s.name} (${s.attr})${trained ? ' -- already trained' : ''}</button>`;
            }).join('');
            let playerChoiceRow = window.ancTarget === 'gmRace'
                ? `<button onclick="window.selectSkillForTraining(null, null)" class="w-full text-left text-xs px-2 py-1.5 rounded border bg-indigo-900/30 text-indigo-300 border-indigo-700/50 hover:border-indigo-400 mb-1 font-bold">Player's Choice -- let the player pick when they take this race</button>`
                : '';
            body.innerHTML = playerChoiceRow + rows + `
                <button onclick="window.selectEncyclopediaForTraining()" class="w-full text-left text-xs px-2 py-1.5 rounded border bg-slate-900 text-slate-200 border-slate-700 hover:border-blue-500 mt-1">
                    Encyclopedia (choose a Field of Study)...
                </button>
            `;
        }
        window.selectSkillForTraining = function(skillId, skillName) {
            if (skillId === null) {
                // GM's "Player's Choice" -- don't train anything yet, just
                // record the pending choice via the callback's own logic
                // (setAncCount handles pushing the sentinel to
                // ancestrySkillAptitudeSkills).
                window.closeModal('skillTrainPickerModal');
                let cb = skillPickerCallback;
                skillPickerCallback = null;
                skillPickerSource = null;
                if (cb) cb(null, null);
                return;
            }
            window.state.skillsTrained[skillId] = true;
            if (!window.state.skillSource) window.state.skillSource = {};
            window.state.skillSource[skillId] = skillPickerSource || 'Unknown';
            window.closeModal('skillTrainPickerModal');
            window.recalculateMath();
            let cb = skillPickerCallback;
            skillPickerCallback = null;
            skillPickerSource = null;
            if (cb) cb(skillId, skillName);
        };
        window.selectEncyclopediaForTraining = function() {
            // Leave skillPickerCallback/skillPickerSource set -- saveEncyclopedia()
            // checks for them and completes the training-picker flow itself
            // once the field-of-study text is entered.
            window.closeModal('skillTrainPickerModal');
            window.openEncyclopediaModal();
        };


        // ------------------------------------------------------------------
        // Shared multi-bonus draft editor, used both by the Add Item
        // modal (building a new custom equippable item) and the item
        // detail popup (editing bonuses on one already in inventory).
        // Each "prefix" gets its own independent draft of attr/skill/er
        // bonus rows, since both contexts can be open-ish at different
        // times and shouldn't bleed into each other.
        // ------------------------------------------------------------------
        window._bonusDrafts = {};
        function getBonusDraft(prefix) {
            if (!window._bonusDrafts[prefix]) window._bonusDrafts[prefix] = { attr: [], skill: [], er: [] };
            return window._bonusDrafts[prefix];
        }
        const BONUS_TYPE_CONFIG = {
            attr: { options: ATTRIBUTES, label: 'Attribute' },
            skill: { options: SKILLS.map(s => s.name), label: 'Skill' },
            er: { options: NPC_ENERGY_TYPES, label: 'Energy Type' },
        };
        window.addBonusDraftRow = function(prefix, type) {
            let draft = getBonusDraft(prefix);
            let opts = BONUS_TYPE_CONFIG[type].options;
            draft[type].push({ target: opts[0], amount: 1 });
            window.renderBonusDraftList(prefix, type);
            autoCommitBonusDraft(prefix);
        };
        window.removeBonusDraftRow = function(prefix, type, idx) {
            getBonusDraft(prefix)[type].splice(idx, 1);
            window.renderBonusDraftList(prefix, type);
            autoCommitBonusDraft(prefix);
        };
        window.updateBonusDraftRow = function(prefix, type, idx, field, value) {
            let row = getBonusDraft(prefix)[type][idx];
            if (!row) return;
            row[field] = field === 'amount' ? (parseInt(value) || 0) : value;
            autoCommitBonusDraft(prefix);
        };
        // Item-detail-popup bonus rows commit back to the real item
        // immediately on every change (add/remove/edit); the Add Item
        // modal's "newItem" draft instead gets read once, on Save.
        function autoCommitBonusDraft(prefix) {
            let m = /^itemDetail(\d+)$/.exec(prefix);
            if (m) window.commitItemBonusDraft(parseInt(m[1]));
        }
        window.commitItemBonusDraft = function(idx) {
            let item = window.state.items[idx];
            let draft = getBonusDraft(`itemDetail${idx}`);
            if (!item || !item.bonuses) return;
            item.bonuses.attrBonuses = JSON.parse(JSON.stringify(draft.attr));
            item.bonuses.skillBonuses = JSON.parse(JSON.stringify(draft.skill));
            item.bonuses.erBonuses = JSON.parse(JSON.stringify(draft.er));
            // Clear the legacy single-slot fields once edited through the
            // new list UI, so they don't double-apply alongside the array.
            delete item.bonuses.attrTarget; delete item.bonuses.attrBonus;
            delete item.bonuses.skillTarget; delete item.bonuses.skillBonus;
            window.recalculateMath();
        };
        window.updateItemBonusFlat = function(idx, field, value) {
            let item = window.state.items[idx];
            if (!item || !item.bonuses) return;
            item.bonuses[field] = parseInt(value) || 0;
            window.recalculateMath();
        };
        window.renderBonusDraftList = function(prefix, type) {
            let draft = getBonusDraft(prefix);
            let cfg = BONUS_TYPE_CONFIG[type];
            let container = document.getElementById(`${prefix}${type[0].toUpperCase()}${type.slice(1)}BonusList`);
            if (!container) return;
            // Stacked (dropdown on its own row, amount+remove below) rather
            // than crammed into one horizontal row -- the Add Item modal
            // is only 400px wide, and options like "Lightning"/"Necrotic"
            // left the dropdown squeezed down to a few unusable pixels
            // when sharing a row with the amount field and remove button.
            container.innerHTML = draft[type].map((row, idx) => `
                <div class="bg-slate-800 border border-slate-700 rounded p-1.5 space-y-1">
                    <select onchange="window.updateBonusDraftRow('${prefix}', '${type}', ${idx}, 'target', this.value)" class="bg-slate-900 text-xs w-full">
                        ${cfg.options.map(o => `<option value="${o}" ${o === row.target ? 'selected' : ''}>${o}</option>`).join('')}
                    </select>
                    <div class="flex items-center gap-1">
                        <span class="text-[10px] text-slate-500" data-tip="Negative amounts are allowed, for a penalty instead of a bonus.">Amount:</span>
                        <input type="number" value="${row.amount}" onchange="window.updateBonusDraftRow('${prefix}', '${type}', ${idx}, 'amount', this.value)" class="bg-slate-900 text-xs w-14 text-center">
                        <button type="button" onclick="window.removeBonusDraftRow('${prefix}', '${type}', ${idx})" class="text-red-500 hover:text-red-400 font-bold text-sm px-1 ml-auto">&times; Remove</button>
                    </div>
                </div>
            `).join('');
        };
        function renderAllBonusDraftLists(prefix) {
            ['attr', 'skill', 'er'].forEach(type => window.renderBonusDraftList(prefix, type));
        }

        window.toggleNewItemEquippable = function(checked) {
            document.getElementById('newItemEquipFields').classList.toggle('hidden', !checked);
            if (checked) {
                window._bonusDrafts['newItem'] = { attr: [], skill: [], er: [] };
                renderAllBonusDraftLists('newItem');
            }
        };
        window.toggleCustomItemEquip = function(idx) {
            let item = window.state.items[idx];
            if (!item || !item.isCustomEquippable) return;
            item.equipped = !item.equipped;
            window.recalculateMath();
        };
        window.saveItem = function() {
            let name = document.getElementById('newItemName').value;
            if(!name) return;
            let val = parseInt(document.getElementById('newItemVal').value) || 0;
            let ct = parseInt(document.getElementById('newItemCt').value) || 1;
            let isEquippable = document.getElementById('newItemEquippable').checked;
            let newItem = {
                name: name,
                wt: parseFloat(document.getElementById('newItemWt').value) || 0,
                ct: ct,
                val: val,
                desc: document.getElementById('newItemDesc').value || ""
            };
            if (isEquippable) {
                newItem.isCustomEquippable = true;
                newItem.equipped = false;
                let draft = getBonusDraft('newItem');
                newItem.bonuses = {
                    ac: parseInt(document.getElementById('newItemAcBonus').value) || 0,
                    dr: parseInt(document.getElementById('newItemDrBonus').value) || 0,
                    er: parseInt(document.getElementById('newItemErBonus').value) || 0,
                    speedBonus: parseInt(document.getElementById('newItemSpeedBonus').value) || 0,
                    attrBonuses: JSON.parse(JSON.stringify(draft.attr)),
                    skillBonuses: JSON.parse(JSON.stringify(draft.skill)),
                    erBonuses: JSON.parse(JSON.stringify(draft.er)),
                };
            }
            window.state.items.unshift(newItem);
            document.getElementById('newItemName').value = "";
            document.getElementById('newItemDesc').value = "";
            document.getElementById('newItemEquippable').checked = false;
            document.getElementById('newItemEquipFields').classList.add('hidden');
            window.closeModal('itemModal');
            // Adding an item to inventory represents acquiring it -- ask
            // whether it's a purchase (deduct Currency) or GM-granted
            // (free), rather than assuming every addition is paid for.
            window.askPayOrGrant(name, val * ct, (paid) => {
                if (paid) window.state.currency = (window.state.currency || 0) - (val * ct);
                window.recalculateMath();
            });
        }

        window.savePower = function() {
            let name = document.getElementById('newPwrName').value;
            if(!name) return;
            window.state.powers.push({
                name: name, lvl: document.getElementById('newPwrLvl').value,
                ap: document.getElementById('newPwrAp').value, atk: document.getElementById('newPwrAtk').value,
                rng: document.getElementById('newPwrRng').value, dmg: document.getElementById('newPwrDmg').value,
                desc: document.getElementById('newPwrDesc').value
            });
            
            document.getElementById('newPwrName').value = "";
            document.getElementById('newPwrDesc').value = "";
            window.closeModal('powerModal');
            window.recalculateMath();
        }

