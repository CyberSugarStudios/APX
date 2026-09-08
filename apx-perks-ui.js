// ============================================================
// APX Character Sheet — Perk Forge UI & XP Spending
// ============================================================
        window.renderPerkCard = function(p, currentRank, choiceText = '') {
            let currentDesc = p.ranks[currentRank - 1] || p.baseDesc;
            let ranksHtml = p.ranks.slice(0, currentRank).map((r, i) => `<div class="mb-1"><span class="font-bold text-slate-300">Rank ${i+1}:</span> ${r}</div>`).join('');
            let rankText = (currentRank >= p.max) ? "Maxed" : (p.attr === 'GEN' ? `${currentRank} / ${p.max}` : `Rank ${currentRank}`);
            
            return `
                <div class="bg-slate-900 p-2 rounded border border-slate-700 relative shadow-inner mb-2">
                    <div class="flex justify-between items-center mb-1">
                        <span class="font-bold text-sm text-purple-300">${p.name} <span class="text-xs text-purple-400 font-normal">${choiceText}</span></span>
                        <span class="text-[10px] bg-slate-800 px-2 py-0.5 rounded border border-slate-600 text-slate-400 font-bold shadow">${rankText}</span>
                    </div>
                    <div class="text-[10px] text-slate-400 leading-tight italic">${currentDesc}</div>
                    
                    <details class="mt-2 outline-none group">
                        <summary class="text-[9px] text-blue-400 cursor-pointer list-none select-none hover:text-blue-300 transition uppercase tracking-wider font-bold">▶ View Details & Past Ranks</summary>
                        <div class="text-[10px] text-slate-400 mt-2 pl-2 border-l border-slate-600 border-dashed">
                            <div class="italic mb-2">${p.baseDesc}</div>
                            ${ranksHtml}
                        </div>
                    </details>
                </div>
            `;
        }

        function renderActivePerks() {
            let html = '';
            
            if (window.state.origin && window.state.origin.feature) {
                html += `
                    <div class="bg-slate-900 p-2 rounded border border-pink-700/50 relative shadow-inner mb-2">
                        <div class="flex justify-between items-center mb-1">
                            <span class="font-bold text-sm text-pink-400">Origin: ${window.state.origin.name}</span>
                            <span class="text-[10px] bg-pink-900/30 px-2 py-0.5 rounded border border-pink-800 text-pink-300 font-bold shadow">Feature</span>
                        </div>
                        <div class="text-[10px] text-slate-300 leading-relaxed italic whitespace-pre-wrap">${window.state.origin.feature}</div>
                    </div>
                `;
            }

            let keys = Object.keys(window.state.perks);

            // Loyal Companion is pinned to the top with an always-visible
            // quick reference (AC/Speed) and an inline HP tracker that
            // doesn't require opening the full stat block. Show a
            // build-prompt version if the perk is owned but no companion
            // has been created yet (openNpcCrafter() is what creates it).
            if ((window.state.perks['cha_loyalcompanion'] || 0) >= 1) {
                if (!window.state.companion) {
                    html += `
                        <div class="bg-slate-900 p-2 rounded border border-purple-600 relative shadow-inner mb-2">
                            <div class="flex justify-between items-center">
                                <span class="font-bold text-sm text-purple-300">🐾 Loyal Companion</span>
                                <button onclick="window.openNpcCrafter()" class="text-[9px] bg-purple-900/30 px-2 py-0.5 rounded border border-purple-800 text-purple-300 font-bold shadow hover:bg-purple-900/50">Build Companion</button>
                            </div>
                        </div>
                    `;
                } else {
                    let sb = window.companionStatBlock();
                    html += `
                        <div class="bg-slate-900 p-2 rounded border border-purple-600 relative shadow-inner mb-2">
                            <div class="flex justify-between items-center mb-1">
                                <span class="font-bold text-sm text-purple-300">🐾 ${sb.name}</span>
                                <div class="flex gap-1">
                                    <button onclick="window.openNpcCrafter()" class="text-[9px] bg-slate-800 px-2 py-0.5 rounded border border-slate-600 text-slate-300 font-bold shadow hover:bg-slate-700">Edit</button>
                                    <button onclick="window.openCompanionDetail()" class="text-[9px] bg-purple-900/30 px-2 py-0.5 rounded border border-purple-800 text-purple-300 font-bold shadow hover:bg-purple-900/50">Full Stat Block</button>
                                </div>
                            </div>
                            <div class="grid grid-cols-4 gap-1 mb-1.5 text-[10px] text-slate-400">
                                <div><span class="text-slate-500">Tier:</span> ${sb.tier}</div>
                                <div><span class="text-slate-500">AC:</span> ${sb.ac}</div>
                                <div><span class="text-slate-500">Speed:</span> ${sb.speed}</div>
                                <div><span class="text-slate-500">AP:</span> ${sb.ap}</div>
                            </div>
                            <div class="flex items-center justify-between bg-slate-800 border border-red-800/50 rounded px-2 py-1">
                                <span class="text-[10px] font-bold text-red-400 uppercase">HP</span>
                                <div class="flex items-center gap-1.5">
                                    <button onclick="window.adjustCompanionHp(-1)" class="w-5 h-5 rounded bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold">-</button>
                                    <input type="number" value="${sb.currentHp}" onchange="window.setCompanionHp(this.value)" class="w-10 text-center bg-slate-900 border-slate-600 text-white text-xs font-bold h-5 px-0">
                                    <span class="text-[10px] text-slate-500 font-bold">/ ${sb.maxHp}</span>
                                    <button onclick="window.adjustCompanionHp(1)" class="w-5 h-5 rounded bg-amber-700 hover:bg-amber-600 text-white text-xs font-bold">+</button>
                                </div>
                            </div>
                            ${sb.powerCards.length ? `
                            <details class="mt-1.5">
                                <summary class="text-[10px] font-bold text-purple-400 cursor-pointer select-none">🔮 Powers (${sb.powerCards.length})</summary>
                                <div class="mt-1.5 space-y-1.5">
                                    ${sb.powerCards.map(p => `
                                        <div class="bg-slate-800 p-1.5 rounded border border-slate-700">
                                            <div class="flex justify-between items-center mb-0.5">
                                                <span class="font-bold text-[10px] text-purple-300">${p.name}</span>
                                                <span class="text-[8px] bg-slate-900 px-1.5 py-0.5 rounded border border-slate-600 text-slate-400 font-bold">Lvl ${p.lvl} | ${p.ap} AP</span>
                                            </div>
                                            <div class="grid grid-cols-3 gap-1 mb-0.5 text-[9px] text-slate-400">
                                                <div><span class="text-slate-500">A/S:</span> ${p.atk}</div>
                                                <div><span class="text-slate-500">R/A:</span> ${p.rng}</div>
                                                <div><span class="text-slate-500">D/H:</span> ${p.dmg}</div>
                                            </div>
                                            <div class="text-[9px] text-slate-500 leading-tight">${p.desc}</div>
                                        </div>
                                    `).join('')}
                                </div>
                            </details>` : ''}
                        </div>
                    `;
                }
            }

            keys.forEach(id => {
                let p = PERKS_DB.find(x => x.id === id);
                if(!p) return;
                let currentRank = window.state.perks[id];
                // Fixed-rank choices (e.g. Armor Master at Rank 2, or
                // Artisan's specializations at Ranks 1/4/5) should keep
                // showing every choice made so far, not just whatever the
                // current rank happens to be.
                let choiceRanksForDisplay = p.choiceAtRanks || (p.choiceAtRank !== undefined ? [p.choiceAtRank] : null);
                let storedChoice;
                if (choiceRanksForDisplay) {
                    let allChoices = choiceRanksForDisplay
                        .map(r => window.state.perkChoices[id] ? window.state.perkChoices[id][r] : null)
                        .filter(Boolean);
                    storedChoice = allChoices.length ? allChoices.join(', ') : null;
                } else {
                    storedChoice = window.state.perkChoices[id] ? window.state.perkChoices[id][currentRank] : null;
                }
                let choiceText = storedChoice ? `(${storedChoice})` : '';
                
                if (id === 'pwr_int' && window.state.pwrIntRanks) {
                    let textArr = [];
                    for (let i=1; i<=5; i++) {
                        if (window.state.pwrIntRanks[i] > 0) textArr.push(`Rank ${i} (x${window.state.pwrIntRanks[i]})`);
                    }
                    let customRankText = textArr.join(', ');
                    html += `
                        <div class="bg-slate-900 p-2 rounded border border-slate-700 relative shadow-inner mb-2">
                            <div class="flex justify-between items-center mb-1">
                                <span class="font-bold text-sm text-purple-300">${p.name}</span>
                                <span class="text-[10px] bg-slate-800 px-2 py-0.5 rounded border border-slate-600 text-slate-400 font-bold shadow">${customRankText}</span>
                            </div>
                            <div class="text-[10px] text-slate-400 leading-tight italic">You have multiple power slot upgrades.</div>
                            
                            <details class="mt-2 outline-none group">
                                <summary class="text-[9px] text-blue-400 cursor-pointer list-none select-none hover:text-blue-300 transition uppercase tracking-wider font-bold">▶ View Details & Past Ranks</summary>
                                <div class="text-[10px] text-slate-400 mt-2 pl-2 border-l border-slate-600 border-dashed">
                                    <div class="italic mb-2">${p.baseDesc}</div>
                                    ${p.ranks.map((r, i) => `<div class="mb-1"><span class="font-bold text-slate-300">Rank ${i+1}:</span> ${r}</div>`).join('')}
                                </div>
                            </details>
                        </div>
                    `;
                } else {
                    html += window.renderPerkCard(p, currentRank, choiceText);
                }
            });

            (window.state.ancestryBonusPerks || []).forEach(bp => {
                let p = PERKS_DB.find(x => x.id === bp.perkId);
                if (p) {
                    let choiceTag = bp.choice ? ` - ${bp.choice}` : '';
                    html += window.renderPerkCard(p, 1, `(Ancestry Bonus${choiceTag})`);
                }
            });

            if (html === '') {
                html = `<div class="text-sm text-slate-500 font-bold text-center py-8" id="noPerksMsg">No perks purchased yet. Open the forge to spend XP.</div>`;
            }
            
            document.getElementById('activePerksContainer').innerHTML = html;
        }

        window.renderPerkList = function() {
            let filter = document.getElementById('perkFilter').value;
            let search = (document.getElementById('perkSearch').value || '').trim().toLowerCase();
            let unspent = parseInt(document.getElementById('unspentXp').value) || 0;
            document.getElementById('modalDispUnspent').innerText = unspent;

            let html = '';
            PERKS_DB.filter(p => filter === 'ALL' || p.attr === filter)
                .filter(p => !search || p.name.toLowerCase().includes(search) || p.baseDesc.toLowerCase().includes(search))
                .forEach(p => {
                let currentRank = window.state.perks[p.id] || 0;
                // A General Perk gained for free via an Ancestry Bonus Perk
                // trait still counts toward its own Max Purchases cap -- it
                // stays a separate card in Active Perks (with its own
                // Ancestry tag), but shouldn't let the Forge sell 'max' more
                // copies on top of that free one.
                let ancestryBonusCount = p.attr === 'GEN' ? (window.state.ancestryBonusPerks || []).filter(bp => bp.perkId === p.id).length : 0;
                let effectiveOwned = currentRank + ancestryBonusCount;
                let nextRank = currentRank + 1;
                let isMaxed = effectiveOwned >= p.max;
                
                let cost = 0;
                let meetsAttr = true;

                if (!isMaxed) {
                    if (p.attr === 'GEN' || p.attr === 'PWR') {
                        cost = p.baseCost || 10;
                        if(p.attr === 'PWR') cost = (nextRank === 1 ? 10 : (nextRank === 2 ? 20 : (nextRank === 3 ? 30 : (nextRank === 4 ? 50 : 80))));
                    } else {
                        let sc = calc.scores[p.attr] || 0;
                        if (sc < nextRank * 2) meetsAttr = false;
                        cost = (nextRank === 1 ? 10 : (nextRank === 2 ? 20 : (nextRank === 3 ? 30 : (nextRank === 4 ? 50 : 80))));
                    }
                }

                let canAfford = unspent >= cost;
                let isDisabled = isMaxed || !canAfford || !meetsAttr;
                let btnDisabled = isDisabled ? 'opacity-50 cursor-not-allowed bg-slate-700 text-slate-500' : 'bg-purple-600 hover:bg-purple-500 text-white';
                let errText = !isMaxed && !meetsAttr ? `(Req ${p.attr} ${nextRank*2})` : '';
                let nextDesc = isMaxed ? "Maximum rank achieved." : (p.ranks[nextRank - 1] || p.baseDesc);

                let actionAreaHtml = '';
                if (p.id === 'pwr_int') {
                    let maxUnlocked = (window.state.perks['pwr_int'] || 0) + 1;
                    if (maxUnlocked > 5) maxUnlocked = 5;
                    let btns = '';
                    for(let i=1; i<=maxUnlocked; i++) {
                        let rCost = (i === 1 ? 10 : (i === 2 ? 20 : (i === 3 ? 30 : (i === 4 ? 50 : 80))));
                        let rCanAfford = unspent >= rCost;
                        let rBtnDisabled = !rCanAfford ? 'opacity-50 cursor-not-allowed bg-slate-700 text-slate-500' : 'bg-purple-600 hover:bg-purple-500 text-white';
                        let timesBought = (window.state.pwrIntRanks && window.state.pwrIntRanks[i]) ? window.state.pwrIntRanks[i] : 0;
                        btns += `<button onclick="window.buyPerk('${p.id}', ${rCost}, ${i})" class="w-full px-2 py-1 rounded text-[10px] font-bold transition shadow mb-1 ${rBtnDisabled}" ${!rCanAfford ? 'disabled' : ''}>Buy Rank ${i} (${rCost} XP) [Owned: ${timesBought}]</button>`;
                    }
                    actionAreaHtml = `<div class="flex flex-col items-end gap-1 ml-4 min-w-[150px]">${btns}</div>`;
                } else {
                    actionAreaHtml = `<div class="flex flex-col items-end gap-1 ml-4 min-w-[120px]">
                        <span class="text-[9px] text-red-400 font-bold text-right">${errText}</span>
                        <button onclick="window.buyPerk('${p.id}', ${cost}, ${nextRank})" class="w-full px-3 py-1.5 rounded text-xs font-bold transition shadow ${btnDisabled}" ${isDisabled ? 'disabled' : ''}>
                            ${isMaxed ? 'Maxed' : `Buy Rank ${nextRank} (${cost} XP)`}
                        </button>
                    </div>`;
                }

                html += `
                    <div class="bg-slate-800 p-3 rounded border border-slate-600 flex flex-col gap-2">
                        <div class="flex justify-between items-start">
                            <div class="flex-1">
                                <div class="font-bold text-sm text-slate-200">${p.name} <span class="text-[9px] text-slate-500 ml-2 border border-slate-600 px-1 rounded">${p.attr}</span></div>
                                <div class="text-[10px] text-slate-400 mt-1">${p.baseDesc}</div>
                                ${(!isMaxed && p.id !== 'pwr_int') ? `<div class="text-xs text-emerald-400 font-bold mt-2">Next Rank (${nextRank}):</div><div class="text-[10px] text-slate-300 italic leading-tight">${nextDesc}</div>` : ''}
                                ${ancestryBonusCount > 0 ? `<div class="text-[9px] text-pink-400 mt-1">1 already granted free by Ancestry -- counts toward the Max Purchases cap of ${p.max}.</div>` : ''}
                            </div>
                            ${actionAreaHtml}
                        </div>
                        <details class="mt-1 group outline-none">
                            <summary class="text-[10px] text-blue-400 cursor-pointer hover:text-blue-300 transition outline-none list-none select-none uppercase tracking-wider font-bold">▶ View All Ranks</summary>
                            <div class="text-[10px] text-slate-400 mt-2 space-y-1 pl-2 border-l border-slate-700 border-dashed">
                                ${p.ranks.map((r, i) => `<div class="${i + 1 === currentRank && p.id !== 'pwr_int' ? 'text-purple-300 font-bold' : ''}"><span class="text-slate-500 font-bold">Rank ${i+1}:</span> ${r}</div>`).join('')}
                            </div>
                        </details>
                    </div>
                `;
            });
            document.getElementById('perkListContainer').innerHTML = html;
        }

        // Perks whose choices are computed dynamically from current state
        // rather than a fixed list (Latent Potential: only Core Attributes
        // currently below 4 are valid targets). Shared by the Forge and the
        // Ancestry Bonus Perk trait so both paths apply the same rule.
        window.getDynamicChoicesFor = function(p) {
            if (p.id === 'gen_latentpot') {
                return ATTRIBUTES.filter(a => (calc.scores[a] || 0) < 4);
            }
            return p.choiceOptions;
        };

        // Generic "pick one option" flow reused by both the Perk Forge and
        // the Ancestry Bonus Perk trait. `onConfirm(choice)` is called with
        // the selected string once the player confirms.
        let pendingChoiceCallback = null;
        window.openPerkChoicePicker = function(p, contextLabel, choices, onConfirm) {
            pendingChoiceCallback = onConfirm;
            document.getElementById('perkChoiceSelect').classList.remove('hidden');
            document.getElementById('perkChoiceTextInput').classList.add('hidden');
            let select = document.getElementById('perkChoiceSelect');
            select.innerHTML = choices.map(opt => `<option value="${opt}">${opt}</option>`).join('');
            document.getElementById('perkChoiceDesc').innerText = `Choose how you want to apply the effects of ${p.name} (${contextLabel}).`;
            window.openModal('perkChoiceModal');
        };

        // Free-text variant (e.g. Artisan's craft specializations) --
        // reuses the same modal/confirm plumbing as the dropdown picker,
        // just swaps which input is visible.
        window.openPerkTextPicker = function(p, contextLabel, onConfirm, placeholder) {
            pendingChoiceCallback = onConfirm;
            document.getElementById('perkChoiceSelect').classList.add('hidden');
            let textInput = document.getElementById('perkChoiceTextInput');
            textInput.classList.remove('hidden');
            textInput.value = '';
            textInput.placeholder = placeholder || 'Name your specialization...';
            document.getElementById('perkChoiceDesc').innerText = `Name a new specialization for ${p.name} (${contextLabel}).`;
            window.openModal('perkChoiceModal');
        };

        // Normalizes choiceAtRank (single) / choiceAtRanks (array) into one
        // array, or null meaning "every rank".
        function getChoiceRanks(p) {
            if (p.choiceAtRanks) return p.choiceAtRanks;
            if (p.choiceAtRank !== undefined) return [p.choiceAtRank];
            return null;
        }

        window.buyPerk = function(id, cost, rank) {
            let p = PERKS_DB.find(x => x.id === id);

            let dynamicChoices = window.getDynamicChoicesFor(p);
            if (id === 'gen_latentpot' && dynamicChoices.length === 0) {
                window.showConfirm("No Core Attributes are below 4. You cannot purchase this perk.", null, true);
                return;
            }

            // Most choice-perks prompt a (possibly different) choice at
            // every rank purchased (e.g. Silver Tongue: "+1 choice of
            // Barter/Bribe/Persuade per rank"). Some make their choice at
            // one or a few specific ranks only (Armor Master: Rank 2 only;
            // Artisan: Ranks 1, 4, 5 for its 1st/2nd/3rd specialization) --
            // these set choiceAtRank/choiceAtRanks and skip other ranks.
            let choiceRanks = getChoiceRanks(p);
            let hasChoiceMechanism = (dynamicChoices && dynamicChoices.length > 0) || p.textChoice;
            let choiceAppliesThisRank = hasChoiceMechanism && (choiceRanks === null || choiceRanks.includes(rank));

            if (choiceAppliesThisRank) {
                if (p.textChoice) {
                    window.openPerkTextPicker(p, `Rank ${rank}`, (text) => {
                        executePerkBuy(id, cost, rank, text);
                    });
                } else {
                    window.openPerkChoicePicker(p, `Rank ${rank}`, dynamicChoices, (choice) => {
                        executePerkBuy(id, cost, rank, choice);
                    });
                }
                return;
            }
            executePerkBuy(id, cost, rank, null);
        }

        document.getElementById('perkChoiceConfirmBtn').onclick = () => {
            let isTextMode = !document.getElementById('perkChoiceTextInput').classList.contains('hidden');
            let choice = isTextMode ? document.getElementById('perkChoiceTextInput').value.trim() : document.getElementById('perkChoiceSelect').value;
            if (isTextMode && !choice) return; // require a non-empty specialization name
            if (pendingChoiceCallback) pendingChoiceCallback(choice);
            pendingChoiceCallback = null;
            window.closeModal('perkChoiceModal');
        };

        function executePerkBuy(id, cost, rank, choice) {
            let p = PERKS_DB.find(x => x.id === id);
            // Hard cap enforcement, not just a disabled button: a General
            // Perk already granted free by Ancestry counts toward its own
            // Max Purchases, and no perk's rank should ever exceed p.max
            // regardless of what called this function.
            if (p) {
                let ancestryBonusCount = p.attr === 'GEN' ? (window.state.ancestryBonusPerks || []).filter(bp => bp.perkId === id).length : 0;
                if (rank + ancestryBonusCount > p.max) return;
            }

            let unspentEl = document.getElementById('unspentXp');
            let spentEl = document.getElementById('spentXp');
            let unspent = parseInt(unspentEl.value) || 0;
            let spent = parseInt(spentEl.value) || 0;

            if (unspent >= cost) {
                unspentEl.value = unspent - cost;
                if(spentEl) spentEl.value = spent + cost;
                window.updateState('unspentXp', unspent - cost);
                window.updateState('spentXp', spent + cost);

                // "The first time you take a new Rank of this perk, you can
                // make a Power you are capable of using for free" (Ch.7).
                // For Int Powers, ranks are repeatable (more slots), so this
                // only fires the first time a given rank is newly reached.
                // For Cha Powers, every successful purchase is a new rank.
                let isNewFreePowerRank = false;
                let isNewChaRank = null; // the specific new rank reached, only for pwr_cha

                if (id === 'pwr_int') {
                    if (!window.state.pwrIntRanks) window.state.pwrIntRanks = {1:0, 2:0, 3:0, 4:0, 5:0};
                    window.state.pwrIntRanks[rank] = (window.state.pwrIntRanks[rank] || 0) + 1;
                    if ((window.state.perks[id] || 0) < rank) {
                        window.state.perks[id] = rank;
                        isNewFreePowerRank = true;
                    }
                } else {
                    if (id === 'pwr_cha' && (window.state.perks[id] || 0) < rank) {
                        isNewChaRank = rank;
                    }
                    window.state.perks[id] = rank;
                    if(choice) {
                        if(!window.state.perkChoices[id]) window.state.perkChoices[id] = {};
                        window.state.perkChoices[id][rank] = choice;
                    }
                }
                
                if(id === 'str_martialarts') window.updateUnarmedStrike(rank);
                
                window.recalculateMath(); 
                
                let container = document.getElementById('perkListContainer');
                let scrollPos = container ? container.scrollTop : 0;
                window.renderPerkList();
                if(container) container.scrollTop = scrollPos;

                if (isNewFreePowerRank && typeof window.openPowerCrafter === 'function') {
                    window.state.powerAttr = 'INT';
                    window.state.freePowersOwed = (window.state.freePowersOwed || 0) + 1;
                    window.recalculateMath();
                    window.showConfirm(`You unlocked a new Power rank! You have ${window.state.freePowersOwed} free Power${window.state.freePowersOwed > 1 ? 's' : ''} banked. Open the Power Crafter now?`, () => {
                        window.closeModal('perkModal');
                        window.openPowerCrafter(true);
                    });
                }

                // Charisma Powers: a free Power at the newly-unlocked Level,
                // plus (Rank 2+) a free upgrade of an existing Power one
                // Level lower up to this new Level. Tracked separately by
                // Level, not a flat counter, since the free power/upgrade
                // has to land on a specific Level to match the rank.
                if (isNewChaRank !== null && typeof window.openPowerCrafter === 'function') {
                    window.state.powerAttr = 'CHA';
                    window.state.chaFreePowerLevels.push(isNewChaRank);
                    if (isNewChaRank >= 2) window.state.chaFreeUpgrades.push({ fromLevel: isNewChaRank - 1, toLevel: isNewChaRank });
                    window.recalculateMath();
                    window.showConfirm(`You unlocked Charisma Powers Rank ${isNewChaRank}! You have a free Level ${isNewChaRank} Power to create${isNewChaRank >= 2 ? `, plus a free upgrade of a Level ${isNewChaRank - 1} Power to Level ${isNewChaRank}` : ''}. Open the Power Crafter now?`, () => {
                        window.closeModal('perkModal');
                        window.openPowerCrafter(true);
                    });
                }
            }
        }

        window.updateUnarmedStrike = function(rank) {
            let dmgDice = "1d4";
            if(rank === 1) dmgDice = "1d6";
            if(rank === 2) dmgDice = "1d8";
            if(rank === 3) dmgDice = "1d10";
            if(rank === 4) dmgDice = "1d12";
            if(rank === 5) dmgDice = "2d6";
            let ap = rank >= 1 ? 1 : 2; 

            let existing = window.state.weapons.find(w => w.isUnarmed);
            if (existing) {
                existing.dmg = dmgDice;
                existing.ap = ap;
            } else {
                window.state.weapons.push({ name: "Unarmed Strike", isUnarmed: true, attr: "STR", tr: true, dmg: dmgDice, ap: ap });
            }
            window.recalculateMath();
        }

        window.updateXpCosts = function() {
            let unspent = window.state.unspentXp;
            document.getElementById('modalXpDisp').innerText = unspent;

            let attr = document.getElementById('xpAttrSelect').value;
            let totalSc = window.state.baseStats[attr] + (window.state.ancestry.bonuses[attr] || 0);
            document.getElementById('xpAttrCurrent').innerText = totalSc;
            let attrCost = 0;
            if(totalSc <= 5) attrCost = 5 * totalSc;
            else if(totalSc <= 10) attrCost = 10 * totalSc;
            else attrCost = 15 * totalSc;
            
            document.getElementById('xpAttrCost').innerText = attrCost;
            let btnAttr = document.getElementById('btnBuyAttr');
            btnAttr.disabled = unspent < attrCost;
            btnAttr.className = btnAttr.disabled ? 'bg-slate-700 text-slate-500 font-bold px-4 py-1.5 rounded text-xs cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-1.5 rounded transition text-xs shadow';

            let tbCost = 25 * window.state.trainingBonus;
            document.getElementById('xpTbCurrent').innerText = window.state.trainingBonus;
            let btnTb = document.getElementById('btnBuyTb');
            btnTb.innerText = `Buy (${tbCost} XP)`;
            btnTb.disabled = unspent < tbCost;
            btnTb.className = btnTb.disabled ? 'bg-slate-700 text-slate-500 font-bold px-4 py-1.5 rounded text-xs cursor-not-allowed w-28 text-right' : 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-1.5 rounded transition text-xs shadow w-28 text-right';

            let numTrained = Object.values(window.state.skillsTrained).filter(v => v).length;
            document.getElementById('xpSkillCount').innerText = numTrained;
            let skillCost = 5 * numTrained;
            let btnSkill = document.getElementById('btnBuySkill');
            btnSkill.innerText = `Buy (${skillCost} XP)`;
            btnSkill.disabled = unspent < skillCost;
            btnSkill.className = btnSkill.disabled ? 'bg-slate-700 text-slate-500 font-bold px-4 py-1.5 rounded text-xs cursor-not-allowed w-28 text-right' : 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-1.5 rounded transition text-xs shadow w-28 text-right';

            let numSavesTrained = Object.values(window.state.savesTrained).filter(v => v).length;
            document.getElementById('xpSaveCount').innerText = numSavesTrained;
            let saveCost = 25 * numSavesTrained;
            let btnSave = document.getElementById('btnBuySave');
            btnSave.innerText = `Buy (${saveCost} XP)`;
            btnSave.disabled = unspent < saveCost;
            btnSave.className = btnSave.disabled ? 'bg-slate-700 text-slate-500 font-bold px-4 py-1.5 rounded text-xs cursor-not-allowed w-28 text-right' : 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-1.5 rounded transition text-xs shadow w-28 text-right';

            // Max HP: disabled once unaffordable OR the CON x 10 cap is reached.
            // The CON x 10 limit (Ch.6) caps TOTAL Max HP, not the XP-bought
            // portion alone -- base HP (CON x 5) already counts against it,
            // so the actual headroom for XP purchases is (CON x 10) - (CON x 5).
            // Perk-granted HP (e.g. Vitality) explicitly doesn't count
            // against this cap, so it's deliberately left out of both sides.
            let btnHp = document.getElementById('btnBuyHp');
            let maxXpHp = Math.max(0, (calc.scores.CON * 10) - (calc.scores.CON * 5));
            let hpCapped = (window.state.xpHpBought || 0) >= maxXpHp;
            btnHp.disabled = unspent < 1 || hpCapped;
            btnHp.innerText = hpCapped ? 'Cap Reached' : 'Buy (1 XP)';
            btnHp.className = btnHp.disabled ? 'bg-slate-700 text-slate-500 font-bold px-4 py-1.5 rounded text-xs cursor-not-allowed w-28 text-right' : 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-1.5 rounded transition text-xs shadow w-28 text-right';

            // Custom weapon types (for GM homebrew) are always purchasable
            // regardless of the 6 standard types' training status -- only
            // affordability gates this button.
            let btnWpn = document.getElementById('btnBuyWpn');
            btnWpn.disabled = unspent < 10;
            btnWpn.innerText = 'Train (10 XP)';
            btnWpn.className = btnWpn.disabled ? 'bg-slate-700 text-slate-500 font-bold px-4 py-1.5 rounded text-xs cursor-not-allowed w-28 text-right' : 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-1.5 rounded transition text-xs shadow w-28 text-right';
        }

        window.buyXpUpgrade = function(type) {
            let unspentEl = document.getElementById('unspentXp');
            let spentEl = document.getElementById('spentXp');
            let unspent = parseInt(unspentEl.value) || 0;
            let spent = parseInt(spentEl.value) || 0;
            
            if(type === 'hp' && unspent >= 1) {
                let maxXpHp = Math.max(0, (calc.scores.CON * 10) - (calc.scores.CON * 5));
                if(window.state.xpHpBought < maxXpHp) {
                    unspentEl.value = unspent - 1;
                    if(spentEl) spentEl.value = spent + 1;
                    window.updateState('unspentXp', unspent - 1);
                    window.updateState('spentXp', spent + 1);
                    window.state.xpHpBought += 1;
                }
            } else if(type === 'tb') {
                // 25 XP x current Training Bonus (Ch.6: +2 -> +3 costs 50, +3 -> +4 costs 75, ...)
                let cost = 25 * window.state.trainingBonus;
                if(unspent >= cost) {
                    unspentEl.value = unspent - cost;
                    if(spentEl) spentEl.value = spent + cost;
                    window.updateState('unspentXp', unspent - cost);
                    window.updateState('spentXp', spent + cost);
                    window.state.trainingBonus += 1;
                }
            } else if(type === 'attr') {
                let attr = document.getElementById('xpAttrSelect').value;
                let totalSc = window.state.baseStats[attr] + (window.state.ancestry.bonuses[attr] || 0);
                let cost = 0;
                if(totalSc <= 5) cost = 5 * totalSc;
                else if(totalSc <= 10) cost = 10 * totalSc;
                else cost = 15 * totalSc;
                
                if(unspent >= cost) {
                    unspentEl.value = unspent - cost;
                    if(spentEl) spentEl.value = spent + cost;
                    window.updateState('unspentXp', unspent - cost);
                    window.updateState('spentXp', spent + cost);
                    window.state.baseStats[attr] += 1;
                }
            } else if(type === 'skill') {
                // 5 XP x the number of skills already trained (Ch.6: trained
                // in 4 already -> a 5th costs 20). Opens the shared picker so
                // the skill is actually selected and auto-trained, not just
                // paid for and left for the player to check a box themselves.
                let numTrained = Object.values(window.state.skillsTrained).filter(v => v).length;
                let cost = 5 * numTrained;
                if (unspent < cost) {
                    window.showConfirm(`Not enough XP. Training a new skill costs ${cost} XP at your current trained count.`, null, true);
                    return;
                }
                window.openSkillTrainPicker(() => {
                    window.updateState('unspentXp', (parseInt(document.getElementById('unspentXp').value) || 0) - cost);
                    window.updateState('spentXp', (parseInt(document.getElementById('spentXp').value) || 0) + cost);
                    window.updateXpCosts();
                }, 'Choose a Skill to Train (Spend XP)', 'Spend XP');
                return; // cost is only paid once a skill is actually chosen, inside the callback above
            } else if(type === 'save') {
                // 25 XP x the number of Saving Throws already trained (Ch.6:
                // a third trained save costs 50).
                let numTrained = Object.values(window.state.savesTrained).filter(v => v).length;
                let cost = 25 * numTrained;
                if (unspent < cost) {
                    window.showConfirm(`Not enough XP. Training a new Saving Throw costs ${cost} XP at your current trained count.`, null, true);
                    return;
                }
                window.openSaveTrainPicker(() => {
                    window.updateState('unspentXp', (parseInt(document.getElementById('unspentXp').value) || 0) - cost);
                    window.updateState('spentXp', (parseInt(document.getElementById('spentXp').value) || 0) + cost);
                    window.updateXpCosts();
                });
                return;
            }
            
            window.recalculateMath();
            window.updateXpCosts();
        }

        // Simple picker for training a new Saving Throw -- just the 7
        // attributes, no Encyclopedia-style sub-choice needed the way
        // skills have. Already-trained saves are disabled, same idea as
        // the shared skill picker.
        window.openSaveTrainPicker = function(callback) {
            let body = document.getElementById('saveTrainPickerBody');
            body.innerHTML = ATTRIBUTES.map(a => {
                let trained = !!window.state.savesTrained[a];
                return `<button ${trained ? 'disabled' : ''} onclick="window.selectSaveForTraining('${a}')" class="w-full text-left text-xs px-2 py-1.5 rounded border ${trained ? 'bg-slate-800 text-slate-600 border-slate-800 cursor-not-allowed' : 'bg-slate-900 text-slate-200 border-slate-700 hover:border-blue-500'}">${a} Save${trained ? ' -- already trained' : ''}</button>`;
            }).join('');
            savePickerCallback = callback;
            window.openModal('saveTrainPickerModal');
        };
        let savePickerCallback = null;
        window.selectSaveForTraining = function(attr) {
            window.state.savesTrained[attr] = true;
            window.closeModal('saveTrainPickerModal');
            window.recalculateMath();
            let cb = savePickerCallback;
            savePickerCallback = null;
            if (cb) cb(attr);
        };

        // Weapon Type training: 10 XP flat (Ch.6), auto-applies to every
        // equipped weapon of that type via weaponIsTrained() rather than
        // requiring the player to hunt down and check each one by hand.
        window.openWeaponTypePicker = function() {
            let unspent = window.state.unspentXp;
            let cost = 10;
            let rows = WEAPON_TYPE_TRAININGS.map(t => {
                let already = window.state.trainedWeaponTypes.includes(t);
                let disabled = already || unspent < cost;
                return `<button ${disabled ? 'disabled' : ''} onclick="window.trainWeaponType('${t}')" class="w-full text-left text-xs px-2 py-1.5 rounded border ${already ? 'bg-slate-800 text-slate-600 border-slate-800 cursor-not-allowed' : (unspent < cost ? 'bg-slate-800 text-slate-600 border-slate-800 cursor-not-allowed' : 'bg-slate-900 text-slate-200 border-slate-700 hover:border-emerald-600')}">${t}${already ? ' (already trained)' : ''}</button>`;
            }).join('');
            document.getElementById('weaponTypePickerBody').innerHTML = `
                ${rows}
                <div class="pt-2 mt-2 border-t border-slate-700">
                    <label class="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">Custom Weapon Type (for custom games)</label>
                    <div class="flex gap-1">
                        <input type="text" id="customWeaponTypeInput" placeholder="e.g. Exotic Weapons" class="bg-slate-900 border-slate-700 text-xs flex-1">
                        <button onclick="window.trainCustomWeaponType()" class="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold ${unspent < cost ? 'opacity-50 cursor-not-allowed' : ''}" ${unspent < cost ? 'disabled' : ''}>Train (${cost} XP)</button>
                    </div>
                </div>
            `;
            window.openModal('weaponTypePickerModal');
        };
        window.trainWeaponType = function(type) {
            let cost = 10;
            if (window.state.unspentXp < cost || window.state.trainedWeaponTypes.includes(type)) return;
            window.state.unspentXp -= cost;
            window.state.spentXp = (window.state.spentXp || 0) + cost;
            window.state.trainedWeaponTypes.push(type);
            window.closeModal('weaponTypePickerModal');
            window.recalculateMath();
            window.updateXpCosts();
        };
        window.trainCustomWeaponType = function() {
            let val = (document.getElementById('customWeaponTypeInput').value || '').trim();
            if (!val) return;
            window.trainWeaponType(val);
        };

