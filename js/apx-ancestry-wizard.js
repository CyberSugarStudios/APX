// ============================================================
// APX Character Sheet — Ancestry & Genetics Wizard
// Also reused by GM Tools to build Race Templates: same wizard, same
// window.state.ancestry it always wrote to, but Finish either applies it
// to the current character (ancTarget 'player') or saves/exports it as a
// standalone race template (ancTarget 'gmRace') instead of touching any
// character's baseStats.
// ============================================================
        let currentAncestryStep = 1;
        let ancTarget = 'player'; // 'player' or 'gmRace'
        window.ancTarget = ancTarget; // mirrored on window so other files (skill/perk pickers) can check which context is active
        let ancRaceEditId = null; // which window.gmRaces entry, when ancTarget === 'gmRace'
        window.gmRaces = window.gmRaces || [];
        let envResistPickerCallback = null;

        window.openEnvResistPicker = function(callback) {
            envResistPickerCallback = callback;
            let rows = NPC_ENERGY_TYPES.map(type => {
                let existingIdx = window.state.ancestryEnvResistances.findIndex(e => e.type === type);
                if (existingIdx === -1) {
                    return `<button onclick="window.selectEnvResistType('${type}')" class="w-full text-left text-xs px-2 py-1.5 rounded border bg-slate-900 text-slate-200 border-slate-700 hover:border-blue-500">${type} <span class="text-slate-500">(gain ER 5)</span></button>`;
                }
                let entry = window.state.ancestryEnvResistances[existingIdx];
                if (entry.immune) {
                    return `<button disabled class="w-full text-left text-xs px-2 py-1.5 rounded border bg-slate-800 text-slate-600 border-slate-800 cursor-not-allowed">${type} -- already Immune</button>`;
                }
                return `<button onclick="window.selectEnvResistType('${type}')" class="w-full text-left text-xs px-2 py-1.5 rounded border bg-emerald-900/30 text-emerald-300 border-emerald-700/50 hover:border-emerald-500">${type} <span class="text-slate-400">(ER 5 -- choose again for Immunity)</span></button>`;
            }).join('');
            let playerChoiceRow = window.ancTarget === 'gmRace'
                ? `<button onclick="window.selectEnvResistType(null)" class="w-full text-left text-xs px-2 py-1.5 rounded border bg-indigo-900/30 text-indigo-300 border-indigo-700/50 hover:border-indigo-400 mb-1 font-bold">Player's Choice -- let the player pick when they take this race</button>`
                : '';
            document.getElementById('envResistPickerBody').innerHTML = playerChoiceRow + rows;
            window.openModal('envResistPickerModal');
        };
        window.selectEnvResistType = function(type) {
            if (type === null) {
                window.closeModal('envResistPickerModal');
                let cb = envResistPickerCallback;
                envResistPickerCallback = null;
                if (cb) cb({ playerChoice: true });
                return;
            }
            let existingIdx = window.state.ancestryEnvResistances.findIndex(e => e.type === type);
            if (existingIdx === -1) {
                window.state.ancestryEnvResistances.push({ type, immune: false });
            } else {
                window.state.ancestryEnvResistances[existingIdx].immune = true;
                window.state.ancestryEnvResistances.push({ upgradesIndex: existingIdx });
            }
            window.closeModal('envResistPickerModal');
            window.recalculateMath();
            let cb = envResistPickerCallback;
            envResistPickerCallback = null;
            if (cb) cb();
        };

        // Environmental Vulnerability -- the flaw counterpart to
        // Environmental Resistance, same picker shape but simpler: each
        // purchase just names a new energy type at a fixed +5 damage, no
        // immunity-upgrade concept, so re-picking an already-vulnerable
        // type is simply disabled rather than offering an "upgrade".
        let envVulnPickerCallback = null;
        window.openEnvVulnPicker = function(callback) {
            envVulnPickerCallback = callback;
            let rows = NPC_ENERGY_TYPES.map(type => {
                let already = window.state.ancestryEnvVulnerabilities.some(e => e.type === type);
                if (already) {
                    return `<button disabled class="w-full text-left text-xs px-2 py-1.5 rounded border bg-slate-800 text-slate-600 border-slate-800 cursor-not-allowed">${type} -- already vulnerable</button>`;
                }
                return `<button onclick="window.selectEnvVulnType('${type}')" class="w-full text-left text-xs px-2 py-1.5 rounded border bg-slate-900 text-slate-200 border-slate-700 hover:border-red-500">${type} <span class="text-slate-500">(+5 damage taken)</span></button>`;
            }).join('');
            let playerChoiceRow = window.ancTarget === 'gmRace'
                ? `<button onclick="window.selectEnvVulnType(null)" class="w-full text-left text-xs px-2 py-1.5 rounded border bg-indigo-900/30 text-indigo-300 border-indigo-700/50 hover:border-indigo-400 mb-1 font-bold">Player's Choice -- let the player pick when they take this race</button>`
                : '';
            document.getElementById('envVulnPickerBody').innerHTML = playerChoiceRow + rows;
            window.openModal('envVulnPickerModal');
        };
        window.selectEnvVulnType = function(type) {
            if (type === null) {
                window.closeModal('envVulnPickerModal');
                let cb = envVulnPickerCallback;
                envVulnPickerCallback = null;
                if (cb) cb({ playerChoice: true });
                return;
            }
            window.state.ancestryEnvVulnerabilities.push({ type });
            window.closeModal('envVulnPickerModal');
            window.recalculateMath();
            let cb = envVulnPickerCallback;
            envVulnPickerCallback = null;
            if (cb) cb();
        };

        window.navWizard = function(dir) {
            window.jumpToAncStep(currentAncestryStep + dir);
        }

        // GM's opt-in feature lock list: every distinct trait/flaw (with
        // its sub-choice detail spelled out where one exists -- Skill
        // Aptitude shows which skill, Bonus Perk shows which perk, etc.)
        // plus any non-zero attribute modifier, each with a checkbox
        // defaulting UNCHECKED. Checking one locks ALL of that feature's
        // current instances against player removal; anything left
        // unchecked stays fully player-adjustable, same as an ordinary
        // player-built ancestry always has been.
        function renderAncLockFeatureList() {
            // Sync the ancestry bonus array from whatever the GM currently
            // has in the form fields before reading it -- the wizard fields
            // are the live source of truth during building, and the state
            // object only gets written to at finishAncestry() time.
            ATTRIBUTES.forEach(a => {
                let modEl = document.getElementById(`wizMod_${a}`);
                if (modEl) window.state.ancestry.bonuses[a] = parseInt(modEl.value) || 0;
            });
            // Also sync biology fields
            let sizeEl = document.getElementById('wizSize'); if (sizeEl) window.state.ancestry.size = parseInt(sizeEl.value) || 30;
            let speedEl = document.getElementById('wizSpeed'); if (speedEl) window.state.ancestry.speed = parseInt(speedEl.value) || 3;
            let lifeEl = document.getElementById('wizLife'); if (lifeEl && lifeEl.options[lifeEl.selectedIndex]) window.state.ancestry.lifespan = lifeEl.options[lifeEl.selectedIndex].text;

            if (!window.state.ancestry.gmLockedFeatures) window.state.ancestry.gmLockedFeatures = {};
            let locked = window.state.ancestry.gmLockedFeatures;
            if (!locked.traits)  locked.traits  = {};
            if (!locked.flaws)   locked.flaws   = {};
            if (!locked.attrs)   locked.attrs   = {};
            if (!locked.biology) locked.biology  = {};

            let rows = [];

            function traitDetail(id, instanceIdx) {
                if (id === 't_skap') {
                    let skill = window.state.ancestrySkillAptitudeSkills[instanceIdx];
                    let name = skill ? (SKILLS.find(sk => sk.id === skill)?.name || skill) : "Player's Choice";
                    return ` (${name})`;
                }
                if (id === 't_env') {
                    let e = window.state.ancestryEnvResistances[instanceIdx];
                    if (!e) return '';
                    return ` (${e.playerChoice ? "Player's Choice" : `${e.type}${e.immune ? ' Immune' : ''}`})`;
                }
                if (id === 't_bp') {
                    let bp = window.state.ancestryBonusPerks[instanceIdx];
                    if (!bp) return '';
                    return ` (${bp.playerChoice ? "Player's Choice" : (PERKS_DB.find(p=>p.id===bp.perkId)?.name || bp.perkId)})`;
                }
                if (id === 't_innwpn') {
                    let w = window.state.ancestryInnateWeapons[instanceIdx];
                    return w ? ` (${w.name} ${w.dmg})` : '';
                }
                return '';
            }
            function flawDetail(id, instanceIdx) {
                if (id === 'f_env') {
                    let e = window.state.ancestryEnvVulnerabilities[instanceIdx];
                    return e ? ` (${e.playerChoice ? "Player's Choice" : e.type})` : '';
                }
                return '';
            }

            // Traits — one row per purchased instance so each can be locked independently
            let traitInstanceCounters = {};
            window.state.ancestry.traits.forEach((id, arrIdx) => {
                let def = ANCESTRY_TRAITS.find(t => t.id === id);
                if (!def) return;
                if (!(id in traitInstanceCounters)) traitInstanceCounters[id] = 0;
                let instIdx = traitInstanceCounters[id]++;
                let lockKey = id + '_' + arrIdx; // unique per array position
                rows.push(`
                    <label class="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded p-2 cursor-pointer hover:border-emerald-600">
                        <input type="checkbox" ${locked.traits[lockKey] ? 'checked' : ''} onchange="window.toggleAncFeatureLock('traits', '${lockKey}', this.checked)" class="w-4 h-4">
                        <span class="text-xs text-slate-200"><span class="font-bold text-emerald-400">${def.name}</span>${traitDetail(id, instIdx)}</span>
                    </label>
                `);
            });

            let flawInstanceCounters = {};
            window.state.ancestry.flaws.forEach((id, arrIdx) => {
                let def = ANCESTRY_FLAWS.find(f => f.id === id);
                if (!def) return;
                if (!(id in flawInstanceCounters)) flawInstanceCounters[id] = 0;
                let instIdx = flawInstanceCounters[id]++;
                let lockKey = id + '_' + arrIdx;
                rows.push(`
                    <label class="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded p-2 cursor-pointer hover:border-red-600">
                        <input type="checkbox" ${locked.flaws[lockKey] ? 'checked' : ''} onchange="window.toggleAncFeatureLock('flaws', '${lockKey}', this.checked)" class="w-4 h-4">
                        <span class="text-xs text-slate-200"><span class="font-bold text-red-400">${def.name}</span>${flawDetail(id, instIdx)}</span>
                    </label>
                `);
            });

            ATTRIBUTES.forEach(a => {
                let mod = window.state.ancestry.bonuses[a] || 0;
                if (!mod) return;
                rows.push(`
                    <label class="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded p-2 cursor-pointer hover:border-blue-600">
                        <input type="checkbox" ${locked.attrs[a] ? 'checked' : ''} onchange="window.toggleAncFeatureLock('attrs', '${a}', this.checked)" class="w-4 h-4">
                        <span class="text-xs text-slate-200"><span class="font-bold text-blue-400">${mod > 0 ? '+' : ''}${mod} to ${a}</span></span>
                    </label>
                `);
            });

            // Biology: Size, Speed, and Lifespan are lockable so the GM can
            // define a race that always moves at Speed 4, or always starts
            // Medium -- players can't reflavor those unless the GM leaves
            // them unlocked.
            let bioFields = [];
            let anc = window.state.ancestry;
            if (anc.size && anc.size !== 30) bioFields.push({ key: 'size', label: `Size: ${anc.size}` });
            else bioFields.push({ key: 'size', label: `Size: ${anc.size || 30} (Medium)` });
            bioFields.push({ key: 'speed', label: `Speed: ${anc.speed || 3} sq` });
            let lifeText = (anc.lifespan || '').replace(/\s*\[.*\]/, '');
            bioFields.push({ key: 'lifespan', label: `Lifespan: ${lifeText || 'Average'}` });

            let bioSection = `
                <div class="mt-3 mb-1 text-[10px] text-slate-500 uppercase font-bold tracking-wider">Biology</div>
                ${bioFields.map(f => `
                <label class="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded p-2 cursor-pointer hover:border-cyan-600">
                    <input type="checkbox" ${locked.biology[f.key] ? 'checked' : ''} onchange="window.toggleAncFeatureLock('biology', '${f.key}', this.checked)" class="w-4 h-4">
                    <span class="text-xs text-slate-200 font-bold" style="color:var(--c-cyan,#22d3ee);">${f.label}</span>
                </label>`).join('')}
            `;
            rows.push(bioSection);

            document.getElementById('ancLockFeatureList').innerHTML = rows.length
                ? `<div class="flex justify-end mb-2"><button onclick="window.lockAllFeatures()" class="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold">Lock All</button></div>` + rows.join('')
                : '<div class="text-xs text-slate-500 italic">No traits, flaws, or attribute bonuses to lock yet.</div>';
        }
        window.toggleAncFeatureLock = function(category, key, checked) {
            if (!window.state.ancestry.gmLockedFeatures) window.state.ancestry.gmLockedFeatures = { traits: {}, flaws: {}, attrs: {}, biology: {} };
            window.state.ancestry.gmLockedFeatures[category][key] = checked;
        };
        window.lockAllFeatures = function() {
            if (!window.state.ancestry.gmLockedFeatures) window.state.ancestry.gmLockedFeatures = { traits:{}, flaws:{}, attrs:{}, biology:{} };
            let lf = window.state.ancestry.gmLockedFeatures;
            // Lock every individual trait instance
            window.state.ancestry.traits.forEach((id, i) => { lf.traits[id + '_' + i] = true; });
            window.state.ancestry.flaws.forEach((id, i) => { lf.flaws[id + '_' + i] = true; });
            ATTRIBUTES.forEach(a => { if (window.state.ancestry.bonuses[a]) lf.attrs[a] = true; });
            ['size','speed','lifespan'].forEach(k => lf.biology[k] = true);
            renderAncLockFeatureList();
        };

        window.jumpToAncStep = function(n) {
            let maxStep = 4;
            if (n < 1 || n > maxStep) return;
            document.getElementById(`ancStep${currentAncestryStep}`).classList.remove('active');
            currentAncestryStep = n;
            document.getElementById(`ancStep${currentAncestryStep}`).classList.add('active');
            if (n === 4) {
                let player4 = document.getElementById('ancStep4Player');
                let gm4 = document.getElementById('ancStep4Gm');
                if (ancTarget === 'gmRace') {
                    if (player4) player4.classList.add('hidden');
                    if (gm4) gm4.classList.remove('hidden');
                    renderAncLockFeatureList();
                } else {
                    if (player4) player4.classList.remove('hidden');
                    if (gm4) gm4.classList.add('hidden');
                    renderAncFinalTraining();
                }
            }

            document.getElementById('wizBtnPrev').style.display = currentAncestryStep > 1 ? 'block' : 'none';
            document.getElementById('wizBtnNext').style.display = currentAncestryStep < maxStep ? 'block' : 'none';
            document.getElementById('wizBtnFinish').style.display = 'block';
            window.updateWizardTabs('ancTab', currentAncestryStep, maxStep);
        }

        // Base attribute scores (wizBase_*) are the PLAYER's own point-buy
        // allocation, not a property of the race itself -- a GM Race
        // Template only ever defines the ancestry MODIFIER (wizMod_*,
        // e.g. "+1 STR for this species"), which stays fully visible and
        // editable for the GM, same as it always has.
        function toggleWizBaseAttrFields(hide) {
            ATTRIBUTES.forEach(a => {
                let input = document.getElementById(`wizBase_${a}`);
                let note = document.getElementById(`wizBaseGmNote_${a}`);
                if (input) input.classList.toggle('hidden', hide);
                if (note) note.classList.toggle('hidden', !hide);
            });
        }

        // After a GM race is imported, re-apply any locked feature states
        // to the DOM -- syncAncestryWizard() already ran (when the modal
        // opened), but it ran before the race data was copied to state, so
        // it didn't know what was locked yet. Called at the end of
        // selectGmRace to bring the DOM in sync.
        function applyGmFeatureLocksToDom() {
            let locked = (window.state.ancestry.gmLockedFeatures || {});
            ATTRIBUTES.forEach(a => {
                let modEl = document.getElementById(`wizMod_${a}`);
                if (modEl) modEl.disabled = !!((locked.attrs || {})[a]);
            });
            // Biology locks — disable fields and show the "Species-Locked" badge
            let bio = locked.biology || {};
            let fields = [
                { key: 'size',     elId: 'wizSize',  badgeId: 'bioLockBadge_size' },
                { key: 'speed',    elId: 'wizSpeed', badgeId: 'bioLockBadge_speed' },
                { key: 'lifespan', elId: 'wizLife',  badgeId: 'bioLockBadge_lifespan' },
            ];
            fields.forEach(({ key, elId, badgeId }) => {
                let el    = document.getElementById(elId);
                let badge = document.getElementById(badgeId);
                let isLocked = !!bio[key];
                if (el)    el.disabled = isLocked;
                if (badge) badge.classList.toggle('hidden', !isLocked);
            });
        }
        window.applyGmFeatureLocksToDom = applyGmFeatureLocksToDom;

        window.syncAncestryWizard = function() {
            ancTarget = 'player';
            window.ancTarget = ancTarget;
            ancRaceEditId = null;
            document.getElementById('ancestryWizardTitle').innerText = 'Ancestry & Genetics Builder';
            document.getElementById('wizBtnFinish').innerText = 'Save & Apply';
            toggleWizBaseAttrFields(false);
            ATTRIBUTES.forEach(a => {
                document.getElementById(`wizBase_${a}`).value = window.state.baseStats[a] || 5;
                document.getElementById(`wizMod_${a}`).value = window.state.ancestry.bonuses[a] || 0;
                // A GM-locked attribute bonus can't be changed by the
                // player at all -- everything else about attribute mods
                // stays freely adjustable.
                let modLocked = !!((window.state.ancestry.gmLockedFeatures || {}).attrs || {})[a];
                document.getElementById(`wizMod_${a}`).disabled = modLocked;
            });
            // Re-apply biology locks (size, speed, lifespan)
            {
                let bio = ((window.state.ancestry.gmLockedFeatures || {}).biology) || {};
                let sizeEl  = document.getElementById('wizSize');
                let speedEl = document.getElementById('wizSpeed');
                let lifeEl  = document.getElementById('wizLife');
                if (sizeEl)  sizeEl.disabled  = !!bio.size;
                if (speedEl) speedEl.disabled = !!bio.speed;
                if (lifeEl)  lifeEl.disabled  = !!bio.lifespan;
            }
            document.getElementById('wizSize').value = window.state.ancestry.size;
            document.getElementById('wizSpeed').value = window.state.ancestry.speed;
            
            let lsOpts = document.getElementById('wizLife').options;
            for(let i=0; i<lsOpts.length; i++) {
                if(lsOpts[i].text === window.state.ancestry.lifespan) { document.getElementById('wizLife').selectedIndex = i; break; }
            }
            document.getElementById('wizName').value = window.state.ancestry.name;
            window.buildAncestryLists();
            window.jumpToAncStep(1);
            if (typeof window.renderImportedRaceList === 'function') window.renderImportedRaceList();
        }

        // Keeps each attribute's Base (Point Buy/Standard Array, 2-10) and
        // ancestry Mod (-2 to +2) from ever combining into a final score
        // below 2 or above 10, per Ch.2/Ch.3 rules. Runs before GP is
        // totaled so a clamp always reflects in what's displayed/saved.
        function clampAncestryAttrInputs() {
            ATTRIBUTES.forEach(a => {
                let baseEl = document.getElementById(`wizBase_${a}`);
                let modEl = document.getElementById(`wizMod_${a}`);
                if (!baseEl || !modEl) return;

                let base = parseInt(baseEl.value) || 5;
                if (base < 2) base = 2;
                if (base > 10) base = 10;
                baseEl.value = base;

                let mod = parseInt(modEl.value) || 0;
                if (mod > 2) mod = 2;
                if (mod < -2) mod = -2;
                if (base + mod > 10) mod = 10 - base;
                if (base + mod < 2) mod = 2 - base;
                modEl.value = mod;
            });

            let speedEl = document.getElementById('wizSpeed');
            if (speedEl) {
                let speed = parseInt(speedEl.value);
                if (isNaN(speed)) speed = 3;
                if (speed < 0) speed = 0;
                if (speed > 6) speed = 6;
                speedEl.value = speed;
            }
        }

        function traitCount(id) { return window.state.ancestry.traits.filter(x => x === id).length; }
        function flawCount(id) { return window.state.ancestry.flaws.filter(x => x === id).length; }

        // Flaws only ever refund up to 5 GP total (Ch.3), so once the raw
        // sum of already-selected flaws reaches that, one more flaw would
        // apply its full mechanical drawback for zero additional benefit.
        function currentFlawRefundRaw() {
            let sum = 0;
            window.state.ancestry.flaws.forEach(fId => {
                let fDef = ANCESTRY_FLAWS.find(x => x.id === fId);
                if (fDef) sum += Math.abs(fDef.cost);
            });
            return sum;
        }

        function renderAncEntry(def, count, isFlaw) {
            let costLabel = isFlaw ? `Refunds ${Math.abs(def.cost)} GP each` : `${def.cost} GP each`;
            if (def.rep) {
                let atMax = def.max ? count >= def.max : false;
                let grantedSkillsNote = (def.id === 't_skap' && window.state.ancestrySkillAptitudeSkills.length)
                    ? `<div class="text-[9px] text-emerald-400 mt-0.5">Trained: ${window.state.ancestrySkillAptitudeSkills.map(id => {
                        let custom = window.state.customSkills.find(s => s.id === id);
                        return custom ? custom.name : id;
                    }).join(', ')}</div>` : '';
                return `
                    <div class="flex items-center justify-between gap-2 p-1.5 rounded border border-transparent hover:border-slate-700 hover:bg-slate-800 transition">
                        <div class="flex-1">
                            <div class="text-[10px] font-bold text-slate-300 leading-tight">${def.name} <span class="${isFlaw ? 'text-red-500' : 'text-emerald-500'}">[${costLabel}${def.max ? `, max ${def.max}` : ''}]</span></div>
                            <div class="text-[9px] text-slate-500 leading-tight">${def.desc}</div>
                            ${grantedSkillsNote}
                        </div>
                        <div class="flex items-center gap-1 shrink-0">
                            <button onclick="window.setAncCount('${isFlaw ? 'flaw' : 'trait'}', '${def.id}', -1)" ${count<=0?'disabled':''} class="w-5 h-5 rounded ${count<=0?'bg-slate-800 text-slate-600':'bg-slate-700 hover:bg-slate-600 text-white'} text-xs font-bold">-</button>
                            <span class="w-5 text-center text-xs font-bold text-white">${count}</span>
                            <button onclick="window.setAncCount('${isFlaw ? 'flaw' : 'trait'}', '${def.id}', 1)" ${atMax?'disabled':''} class="w-5 h-5 rounded ${atMax?'bg-slate-800 text-slate-600':'bg-amber-700 hover:bg-amber-600 text-white'} text-xs font-bold">+</button>
                        </div>
                    </div>
                `;
            }
            let isChecked = count > 0 ? 'checked' : '';
            return `<label class="flex items-start gap-2 p-1.5 hover:bg-slate-800 rounded cursor-pointer transition border border-transparent hover:border-slate-700">
                <input type="checkbox" class="mt-0.5" value="${def.id}" ${isChecked} onchange="window.toggleAnc('${isFlaw ? 'flaw' : 'trait'}', '${def.id}', this.checked)">
                <div><div class="text-[10px] font-bold text-slate-300 leading-tight">${def.name} <span class="${isFlaw ? 'text-red-500' : 'text-emerald-500'}">[${costLabel.replace(' each','')}]</span></div><div class="text-[9px] text-slate-500 leading-tight">${def.desc}</div></div>
            </label>`;
        }

        window.buildAncestryLists = function() {
            document.getElementById('wizTraitsList').innerHTML = ANCESTRY_TRAITS.map(t => renderAncEntry(t, traitCount(t.id), false)).join('');
            document.getElementById('wizFlawsList').innerHTML = ANCESTRY_FLAWS.map(f => renderAncEntry(f, flawCount(f.id), true)).join('');
            window.calcAncestryGp();
        }

        // Non-repeatable traits/flaws: plain checkbox on/off.
        window.toggleAnc = function(type, id, isChecked) {
            if(type === 'trait') {
                if(isChecked) {
                    window.state.ancestry.traits.push(id);
                } else {
                    window.state.ancestry.traits = window.state.ancestry.traits.filter(x => x !== id);
                }
            } else {
                if(isChecked) {
                    if (currentFlawRefundRaw() >= 5) {
                        window.showConfirm("Flaws only refund up to 5 GP total. You already have enough selected -- taking another would apply its drawback for no further benefit.", null, true);
                        window.buildAncestryLists(); // resets the checkbox back to unchecked
                        return;
                    }
                    window.state.ancestry.flaws.push(id);
                }
                else window.state.ancestry.flaws = window.state.ancestry.flaws.filter(x => x !== id);
            }
            window.buildAncestryLists();
        }

        // Repeatable traits/flaws: +/- stepper. Handles the two special
        // cases that need more than "just push/pop an id" -- Bonus Perk
        // (opens a picker; only recorded once a perk, and choice if
        // needed, is actually confirmed) and Fragile (blocked once Max HP
        // would drop to 5 or less).
        window.setAncCount = function(type, id, delta) {
            let isFlaw = type === 'flaw';
            let def = isFlaw ? ANCESTRY_FLAWS.find(x => x.id === id) : ANCESTRY_TRAITS.find(x => x.id === id);
            if (!def) return;
            let arr = isFlaw ? window.state.ancestry.flaws : window.state.ancestry.traits;
            let count = arr.filter(x => x === id).length;

            if (delta > 0) {
                if (def.max && count >= def.max) return;

                if (isFlaw && currentFlawRefundRaw() >= 5) {
                    window.showConfirm("Flaws only refund up to 5 GP total. You already have enough selected -- taking another would apply its drawback for no further benefit.", null, true);
                    return;
                }

                if (id === 't_bp') {
                    window.openAncBonusPerkModal();
                    return; // 't_bp' is only pushed once a perk (+choice) is actually confirmed
                }
                if (id === 't_skap') {
                    window.openSkillTrainPicker((skillId) => {
                        arr.push(id);
                        window.state.ancestrySkillAptitudeSkills.push(skillId);
                        window.buildAncestryLists();
                    }, 'Choose a Skill to Train (Skill Aptitude)', 'Ancestry (Skill Aptitude)');
                    return; // only pushed once a skill is actually chosen, same idea as 't_bp' above
                }
                if (id === 't_env') {
                    window.openEnvResistPicker((sentinel) => {
                        arr.push(id);
                        // Real type selections already push their own
                        // entry inside selectEnvResistType; a Player's
                        // Choice sentinel arrives here instead and needs
                        // pushing explicitly so the array stays in sync
                        // with arr's purchase count.
                        if (sentinel) window.state.ancestryEnvResistances.push(sentinel);
                        window.buildAncestryLists();
                    });
                    return; // only pushed once a type (or immunity upgrade) is actually chosen
                }
                if (id === 'f_env') {
                    window.openEnvVulnPicker((sentinel) => {
                        arr.push(id);
                        if (sentinel) window.state.ancestryEnvVulnerabilities.push(sentinel);
                        window.buildAncestryLists();
                    });
                    return; // only pushed once a type is actually chosen
                }
                if (id === 't_innwpn') {
                    window.openInnateWeaponPicker(() => {
                        arr.push(id);
                        window.buildAncestryLists();
                    });
                    return; // only pushed once the name (or upgrade target) is actually chosen
                }
                if (id === 'f_frag') {
                    let con = parseInt(document.getElementById('wizBase_CON').value) || 5;
                    if ((5 * con) - (5 * (count + 1)) <= 5) {
                        window.showConfirm("Your Maximum HP would drop to 5 or less. You cannot take Fragile again.", null, true);
                        return;
                    }
                }

                arr.push(id);
            } else {
                if (count <= 0) return;
                // Opt-in lock: only blocked if the GM specifically checked
                // this exact instance on the Lock Features screen.
                // Keys are stored as "traitId_arrayIndex" so each purchase
                // is independently lockable (two Skill Aptitude picks can
                // lock one and leave the other player-editable).
                let lockCategory = isFlaw ? 'flaws' : 'traits';
                let lockFeatures = (window.state.ancestry.gmLockedFeatures || {})[lockCategory] || {};
                // Find the last instance of this trait/flaw and check its lock
                let arr = isFlaw ? window.state.ancestry.flaws : window.state.ancestry.traits;
                let lastIdx = arr.lastIndexOf(id);
                let isLocked = lockFeatures[id + '_' + lastIdx];
                if (isLocked) {
                    window.showConfirm(`This ${isFlaw ? 'flaw' : 'trait'} was locked in by your species and can't be removed. You can still adjust anything the GM left unlocked.`, null, true);
                    return;
                }
                if (id === 't_bp') {
                    window.state.ancestryBonusPerks.pop();
                }
                if (id === 't_skap') {
                    let skillId = window.state.ancestrySkillAptitudeSkills.pop();
                    if (skillId) window.state.skillsTrained[skillId] = false;
                }
                if (id === 't_env') {
                    let last = window.state.ancestryEnvResistances.pop();
                    if (last && last.upgradesIndex !== undefined) {
                        let target = window.state.ancestryEnvResistances[last.upgradesIndex];
                        if (target) target.immune = false;
                    }
                }
                if (id === 'f_env') {
                    window.state.ancestryEnvVulnerabilities.pop();
                }
                if (id === 't_innwpn') {
                    window.undoLastInnateWeaponPurchase();
                }
                let idx = arr.lastIndexOf(id);
                if (idx >= 0) arr.splice(idx, 1);
            }
            window.buildAncestryLists();
        }

        // ------------------------------------------------------------------
        // Innate Weapon: each purchase either names a brand-new innate
        // weapon (Claws, Fangs, Horns...) or upgrades an existing one's
        // die step, tracked in ancestryInnateWeapons (one entry per
        // DISTINCT weapon) and ancestryInnateWeaponLog (one entry per
        // PURCHASE, recording which of the two it was, so decrementing
        // knows exactly what to undo). Each weapon gets added as its own
        // real row in window.state.weapons -- alongside Unarmed Strike,
        // never replacing it, since a creature with claws can presumably
        // still throw an unarmed punch too.
        // ------------------------------------------------------------------
        // A dedicated, simple single-die progression for Innate Weapons
        // (1d6 -> 1d8 -> 1d10 -> 1d12 -> 2d6, its actual max) -- deliberately separate from
        // WEAPON_DMG_TIERS, which is the Weapon Forge's own multi-die
        // scale (2d4/2d6/2d8/3d10/4d12) for fully crafted weapons and
        // doesn't even contain "1d6", the die this trait's own
        // description starts natural weapons at.
        const INNATE_WEAPON_DIE_TIERS = ['1d6', '1d8', '1d10', '1d12', '2d6'];
        function nextInnateDieTier(dice) {
            let idx = INNATE_WEAPON_DIE_TIERS.indexOf(dice);
            if (idx === -1 || idx >= INNATE_WEAPON_DIE_TIERS.length - 1) return null;
            return INNATE_WEAPON_DIE_TIERS[idx + 1];
        }
        function prevInnateDieTier(dice) {
            let idx = INNATE_WEAPON_DIE_TIERS.indexOf(dice);
            if (idx <= 0) return null;
            return INNATE_WEAPON_DIE_TIERS[idx - 1];
        }

        let innateWeaponPickerCallback = null;
        window.openInnateWeaponPicker = function(callback) {
            innateWeaponPickerCallback = callback;
            let existing = window.state.ancestryInnateWeapons || [];
            let newSection = `
                <div>
                    <label class="block text-[10px] text-slate-500 uppercase font-bold mb-1">Add a New Innate Weapon</label>
                    <div class="flex gap-1">
                        <input type="text" id="innateWeaponNameInput" placeholder="e.g. Claws, Fangs, Horns" class="bg-slate-900 text-xs flex-1">
                        <button onclick="window.confirmNewInnateWeapon()" class="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition">Add</button>
                    </div>
                </div>
            `;
            let upgradeSection = existing.length ? `
                <div>
                    <label class="block text-[10px] text-slate-500 uppercase font-bold mb-1">Or Upgrade an Existing One's Die Step</label>
                    <div class="space-y-1">
                        ${existing.map((w, i) => {
                            let next = nextInnateDieTier(w.dmg);
                            return `<button ${next ? '' : 'disabled'} onclick="window.confirmUpgradeInnateWeapon(${i})" class="w-full text-left text-xs px-2 py-1.5 rounded border ${next ? 'bg-slate-900 text-slate-200 border-slate-700 hover:border-blue-500' : 'bg-slate-800 text-slate-600 border-slate-800 cursor-not-allowed'}">${w.name}: ${w.dmg}${next ? ` &rarr; ${next}` : ' (max die step)'}</button>`;
                        }).join('')}
                    </div>
                </div>
            ` : '';
            document.getElementById('innateWeaponPickerBody').innerHTML = newSection + upgradeSection;
            window.openModal('innateWeaponPickerModal');
        };
        window.confirmNewInnateWeapon = function() {
            let name = document.getElementById('innateWeaponNameInput').value.trim();
            if (!name) { window.showConfirm('Give your innate weapon a name first.', null, true); return; }
            let newWeapon = { name, dmg: '1d6' };
            window.state.ancestryInnateWeapons.push(newWeapon);
            let weaponIdx = window.state.ancestryInnateWeapons.length - 1;
            window.state.ancestryInnateWeaponLog.push({ action: 'new', idx: weaponIdx });
            window.state.weapons.push({ name, attr: 'STR', tr: true, dmg: '1d6', ap: 2, isAncestry: true, ancestryInnateIdx: weaponIdx, category: 'melee' });
            window.closeModal('innateWeaponPickerModal');
            window.recalculateMath();
            let cb = innateWeaponPickerCallback; innateWeaponPickerCallback = null;
            if (cb) cb();
        };
        window.confirmUpgradeInnateWeapon = function(weaponIdx) {
            let w = window.state.ancestryInnateWeapons[weaponIdx];
            let next = nextInnateDieTier(w.dmg);
            if (!w || !next) return;
            w.dmg = next;
            window.state.ancestryInnateWeaponLog.push({ action: 'upgrade', idx: weaponIdx });
            let liveWeapon = window.state.weapons.find(x => x.isAncestry && x.ancestryInnateIdx === weaponIdx);
            if (liveWeapon) liveWeapon.dmg = next;
            window.closeModal('innateWeaponPickerModal');
            window.recalculateMath();
            let cb = innateWeaponPickerCallback; innateWeaponPickerCallback = null;
            if (cb) cb();
        };
        window.undoLastInnateWeaponPurchase = function() {
            let log = window.state.ancestryInnateWeaponLog || [];
            let last = log.pop();
            if (!last) return;
            if (last.action === 'new') {
                window.state.weapons = window.state.weapons.filter(w => !(w.isAncestry && w.ancestryInnateIdx === last.idx));
                window.state.ancestryInnateWeapons.splice(last.idx, 1);
                // Every weapon pointing at an innate weapon AFTER the one
                // just removed needs its index shifted down by one to
                // stay correctly linked, since the array it indexes into
                // just shrank.
                window.state.weapons.forEach(w => {
                    if (w.isAncestry && w.ancestryInnateIdx > last.idx) w.ancestryInnateIdx -= 1;
                });
                log.forEach(entry => { if (entry.idx > last.idx) entry.idx -= 1; });
            } else if (last.action === 'upgrade') {
                let w = window.state.ancestryInnateWeapons[last.idx];
                if (w) {
                    let prev = prevInnateDieTier(w.dmg);
                    if (prev) {
                        w.dmg = prev;
                        let liveWeapon = window.state.weapons.find(x => x.isAncestry && x.ancestryInnateIdx === last.idx);
                        if (liveWeapon) liveWeapon.dmg = prev;
                    }
                }
            }
            window.recalculateMath();
        };

        window.openAncBonusPerkModal = function() {
            let alreadyChosen = window.state.ancestryBonusPerks.map(bp => bp.perkId);
            let genPerks = PERKS_DB.filter(p => p.attr === 'GEN').filter(p => {
                let timesChosen = alreadyChosen.filter(id => id === p.id).length;
                if (timesChosen === 0) return true;
                return p.max > timesChosen; // only offer again if it can still be taken further
            });
            let playerChoiceHtml = window.ancTarget === 'gmRace'
                ? `<div class="p-2 bg-indigo-900/30 hover:bg-indigo-900/50 rounded border border-indigo-700/50 cursor-pointer transition mb-2" onclick="window.selectAncBonusPerk(null)">
                    <div class="font-bold text-indigo-300 text-sm">Player's Choice</div>
                    <div class="text-[10px] text-slate-400 leading-tight">Let the player pick when they take this race</div>
                   </div>`
                : '';
            let html = genPerks.map(p => `
                <div class="p-2 bg-slate-800 hover:bg-slate-700 rounded border border-slate-600 cursor-pointer transition" onclick="window.selectAncBonusPerk('${p.id}')">
                    <div class="font-bold text-slate-200 text-sm">${p.name}</div>
                    <div class="text-[10px] text-slate-400 leading-tight">${p.baseDesc}</div>
                </div>
            `).join('');
            document.getElementById('ancBonusPerkList').innerHTML = playerChoiceHtml + html;
            window.openModal('ancBonusPerkModal');
        }

        // Set immediately before opening the Bonus Perk picker when
        // resolving a queued Player's Choice; selectAncBonusPerk's own
        // commit() calls this (and clears it) at the point the choice is
        // ACTUALLY finalized -- which, for a perk with its own dynamic
        // sub-choice (e.g. Latent Potential asking which Attribute), is
        // only after that second picker resolves too, not right when the
        // Bonus Perk itself is clicked. Advancing the pending-choice
        // queue on click rather than on true commit was the root cause
        // of the sub-picker opening behind the next queued picker, and
        // of a "max 1" perk being selectable a second time before the
        // first selection had actually landed in ancestryBonusPerks.
        let ancBonusPerkAfterCommit = null;
        window.selectAncBonusPerk = function(id) {
            if (id === null) {
                window.closeModal('ancBonusPerkModal');
                window.state.ancestry.traits.push('t_bp');
                window.state.ancestryBonusPerks.push({ playerChoice: true });
                window.recalculateMath();
                window.buildAncestryLists();
                let cb = ancBonusPerkAfterCommit; ancBonusPerkAfterCommit = null;
                if (cb) cb();
                return;
            }
            let p = PERKS_DB.find(x => x.id === id);
            let dynamicChoices = window.getDynamicChoicesFor(p);

            if (id === 'gen_latentpot' && dynamicChoices.length === 0) {
                window.showConfirm("No Core Attributes are below 4. You cannot select this perk.", null, true);
                return; // leave the Bonus Perk list open so they can pick something else
            }

            window.closeModal('ancBonusPerkModal');

            let commit = (choice) => {
                window.state.ancestry.traits.push('t_bp');
                window.state.ancestryBonusPerks.push({ perkId: id, choice: choice || null });
                window.recalculateMath();
                window.buildAncestryLists();
                let cb = ancBonusPerkAfterCommit; ancBonusPerkAfterCommit = null;
                if (cb) cb();
            };

            if (dynamicChoices && dynamicChoices.length > 0) {
                window.openPerkChoicePicker(p, 'Ancestry Bonus', dynamicChoices, commit);
                return;
            }

            commit(null);
        }

        window.cancelAncBonusPerk = function() {
            // Nothing is tentatively recorded until a perk (and choice, if
            // any) is actually confirmed, so cancelling just closes it.
            window.closeModal('ancBonusPerkModal');
        }

        window.calcAncestryGp = function() {
            clampAncestryAttrInputs();

            let gp = 0;
            let limit = parseInt(document.getElementById('wizGpLimit').value) || 15;
            // dispGpLimit lives in the main character sheet's header (next
            // to the Ancestry button), not inside this modal -- it doesn't
            // exist when this wizard is reused standalone in GM Tools.
            let dispLimitEl = document.getElementById('dispGpLimit');
            if (dispLimitEl) dispLimitEl.innerText = limit;

            ATTRIBUTES.forEach(a => {
                let mod = parseInt(document.getElementById(`wizMod_${a}`).value) || 0;
                if(mod > 0) gp += mod;
                if(mod < 0) gp += mod; 
            });
            
            gp += parseInt(document.getElementById('wizLife').value) || 0;
            
            let size = parseInt(document.getElementById('wizSize').value) || 30;
            if(size !== 30) gp += 1;
            
            let speed = parseInt(document.getElementById('wizSpeed').value) || 3;
            gp += (speed - 3);

            let flawRefund = 0;
            window.state.ancestry.flaws.forEach(fId => {
                let fDef = ANCESTRY_FLAWS.find(x => x.id === fId);
                if(fDef) flawRefund += Math.abs(fDef.cost);
            });
            if(flawRefund > 5) flawRefund = 5;
            gp -= flawRefund;

            window.state.ancestry.traits.forEach(tId => {
                let tDef = ANCESTRY_TRAITS.find(x => x.id === tId);
                if(tDef) gp += tDef.cost;
            });

            document.getElementById('wizGpUsed').innerText = gp;
            let errEl = document.getElementById('wizError');
            if(gp > limit) {
                errEl.style.display = 'block';
                document.getElementById('wizBtnFinish').disabled = true;
                document.getElementById('wizBtnFinish').classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                errEl.style.display = 'none';
                document.getElementById('wizBtnFinish').disabled = false;
                document.getElementById('wizBtnFinish').classList.remove('opacity-50', 'cursor-not-allowed');
            }
            window.state.ancestry.gpUsed = gp;

            // Advisory only, never blocking: Point Buy and Standard Array
            // both redistribute points from a baseline of 5 per Core
            // Attribute (35 total across all 7), so the modifiers should
            // sum to 0. This varies table to table (some GMs deliberately
            // run stronger/weaker campaigns), so this is just a heads-up.
            let baseTotal = ATTRIBUTES.reduce((sum, a) => sum + (parseInt(document.getElementById(`wizBase_${a}`).value) || 0), 0);
            let baseNote = document.getElementById('wizBaseStatNote');
            if (baseNote) {
                let diff = baseTotal - 35;
                if (diff === 0) {
                    baseNote.classList.add('hidden');
                } else {
                    baseNote.classList.remove('hidden');
                    baseNote.innerText = `Base attributes total ${baseTotal} (${diff > 0 ? '+' : ''}${diff} vs. the standard 35 for Point Buy/Standard Array). This may be intentional for your table.`;
                }
            }
        }

        // ---- Step 4: Final Training (4 + INT mod skills, 2 Saving Throws) ----
        function ancFinalSkillLimit() {
            let base = parseInt(document.getElementById('wizBase_INT').value) || 5;
            let mod = parseInt(document.getElementById('wizMod_INT').value) || 0;
            let intMod = (base + mod) - 5;
            // 4 is a floor, not a starting point that can be whittled down
            // by a negative INT -- even a very low-INT character is still
            // trained in 4 skills at character creation.
            return Math.max(4, 4 + intMod);
        }
        function ancSkillDisplayName(id) {
            let custom = window.state.customSkills.find(s => s.id === id);
            if (custom) return custom.name;
            let s = SKILLS.find(x => x.id === id);
            return s ? s.name : id;
        }
        function renderAncFinalTraining() {
            let limit = ancFinalSkillLimit();
            let ft = window.state.ancestryFinalTraining;
            document.getElementById('ancFinalSkillCount').innerText = limit;
            document.getElementById('ancFinalSkillProgress').innerText = `${ft.skills.length}/${limit}`;
            document.getElementById('ancFinalSkillList').innerHTML = ft.skills.length ? ft.skills.map((id, idx) => `
                <div class="flex items-center justify-between bg-slate-800 border border-slate-700 rounded px-2 py-1">
                    <span class="text-xs text-slate-200">${ancSkillDisplayName(id)}</span>
                    <button onclick="window.ancRemoveFinalSkill(${idx})" class="text-red-500 hover:text-red-400 font-bold text-xs">&times;</button>
                </div>
            `).join('') : '<div class="text-[10px] text-slate-600">None chosen yet</div>';
            let addBtn = document.getElementById('ancAddFinalSkillBtn');
            addBtn.disabled = ft.skills.length >= limit;
            addBtn.classList.toggle('opacity-50', ft.skills.length >= limit);

            document.getElementById('ancFinalSaveProgress').innerText = `${ft.saves.length}/2`;
            document.getElementById('ancFinalSaveGrid').innerHTML = ATTRIBUTES.map(a => {
                let checked = ft.saves.includes(a);
                let disabled = !checked && ft.saves.length >= 2;
                return `<label class="flex items-center gap-1 text-xs text-slate-300 ${disabled ? 'opacity-40' : ''}">
                    <input type="checkbox" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} onchange="window.ancToggleFinalSave('${a}', this.checked)"> ${a}
                </label>`;
            }).join('');
        }
        window.ancAddFinalSkill = function() {
            let ft = window.state.ancestryFinalTraining;
            if (ft.skills.length >= ancFinalSkillLimit()) return;
            window.openSkillTrainPicker((skillId) => {
                ft.skills.push(skillId);
                renderAncFinalTraining();
            }, 'Choose a Skill to Train (Ancestry Training)', 'Ancestry (Final Training)');
        };
        window.ancRemoveFinalSkill = function(idx) {
            let ft = window.state.ancestryFinalTraining;
            let skillId = ft.skills[idx];
            window.state.skillsTrained[skillId] = false;
            ft.skills.splice(idx, 1);
            renderAncFinalTraining();
            window.recalculateMath();
        };
        window.ancToggleFinalSave = function(attr, checked) {
            let ft = window.state.ancestryFinalTraining;
            if (checked) {
                if (ft.saves.length >= 2) return;
                ft.saves.push(attr);
                window.state.savesTrained[attr] = true;
            } else {
                ft.saves = ft.saves.filter(a => a !== attr);
                window.state.savesTrained[attr] = false;
            }
            renderAncFinalTraining();
            window.recalculateMath();
        };

        window.finishAncestry = function() {
            let limit = parseInt(document.getElementById('wizGpLimit').value) || 15;
            if(window.state.ancestry.gpUsed > limit) return;
            window.state.ancestry.name = document.getElementById('wizName').value || "Unknown Species";

            // Only apply biology fields that the GM hasn't locked -- if a
            // field is locked, the DOM element is disabled and its value
            // reflects the original imported value anyway, so skipping it
            // here prevents a disabled (locked) field from accidentally
            // clearing the saved value on a player's second open-and-save.
            let bio = ((window.state.ancestry.gmLockedFeatures || {}).biology) || {};
            if (!bio.size)     window.state.ancestry.size     = parseInt(document.getElementById('wizSize').value) || 30;
            if (!bio.speed)    window.state.ancestry.speed    = parseInt(document.getElementById('wizSpeed').value) || 3;
            if (!bio.lifespan) window.state.ancestry.lifespan = document.getElementById('wizLife').options[document.getElementById('wizLife').selectedIndex].text;

            ATTRIBUTES.forEach(a => {
                let locked = !!((window.state.ancestry.gmLockedFeatures || {}).attrs || {})[a];
                if (!locked) window.state.ancestry.bonuses[a] = parseInt(document.getElementById(`wizMod_${a}`).value) || 0;
            });

            if (ancTarget === 'gmRace') {
                // A race template only ever captures the ancestry itself
                // (mods/size/speed/lifespan/traits/flaws + its Bonus Perk
                // choices) -- never baseStats, which is a player's own
                // Point Buy/Standard Array allocation, not part of a race.
                let entry = {
                    id: ancRaceEditId || crypto.randomUUID(),
                    name: window.state.ancestry.name,
                    ancestry: JSON.parse(JSON.stringify(window.state.ancestry)),
                    ancestryBonusPerks: JSON.parse(JSON.stringify(window.state.ancestryBonusPerks)),
                    // Skill Aptitude and Environmental Resistance both need
                    // more than just the trait count in ancestry.traits --
                    // which specific skill was trained, which energy type
                    // was chosen -- so a race template has to carry these
                    // parallel arrays too, or a player importing it gets a
                    // trait that LOOKS purchased but never actually applied.
                    ancestrySkillAptitudeSkills: JSON.parse(JSON.stringify(window.state.ancestrySkillAptitudeSkills || [])),
                    ancestryEnvResistances: JSON.parse(JSON.stringify(window.state.ancestryEnvResistances || [])),
                    ancestryEnvVulnerabilities: JSON.parse(JSON.stringify(window.state.ancestryEnvVulnerabilities || [])),
                    ancestryInnateWeapons: JSON.parse(JSON.stringify(window.state.ancestryInnateWeapons || [])),
                    ancestryInnateWeaponLog: JSON.parse(JSON.stringify(window.state.ancestryInnateWeaponLog || []))
                };
                let existingIdx = window.gmRaces.findIndex(r => r.id === entry.id);
                if (existingIdx >= 0) window.gmRaces[existingIdx] = entry;
                else window.gmRaces.push(entry);

                // Fire cloud-sync event so Firebase listener can save to Firestore
                document.dispatchEvent(new CustomEvent('apxGmRacesSaved'));

                window.closeModal('ancestryModal');
                if (typeof window.renderGmRaceList === 'function') window.renderGmRaceList();
                if (typeof window.openGmRaceRosterModal === 'function') {
                    window.openGmRaceRosterModal();
                    window.showConfirm(`${entry.name} is saved to your Race Templates. Use Export to save it to a file.`, null, true);
                }
                return;
            }

            // Player's own base attribute allocation -- irrelevant to (and
            // never overwritten by) a race template, since a species'
            // modifiers layer on top of whatever a player separately chose.
            ATTRIBUTES.forEach(a => {
                window.state.baseStats[a] = parseInt(document.getElementById(`wizBase_${a}`).value) || 5;
            });

            window.closeModal('ancestryModal');
            window.recalculateMath();
        }

        // ------------------------------------------------------------------
        // GM Race Templates: build, list, delete, export/import. Entirely
        // separate from any character's save data, same pattern as the GM
        // NPC roster -- window.gmRaces holds them, saved to their own file.
        // ------------------------------------------------------------------
        window.openGmRaceBuilder = function(raceId) {
            if (raceId) {
                let entry = window.gmRaces.find(r => r.id === raceId);
                if (!entry) return;
                ancRaceEditId = raceId;
                window.state.ancestry = JSON.parse(JSON.stringify(entry.ancestry));
                window.state.ancestryBonusPerks = JSON.parse(JSON.stringify(entry.ancestryBonusPerks || []));
                window.state.ancestrySkillAptitudeSkills = JSON.parse(JSON.stringify(entry.ancestrySkillAptitudeSkills || []));
                window.state.ancestryEnvResistances = JSON.parse(JSON.stringify(entry.ancestryEnvResistances || []));
                window.state.ancestryEnvVulnerabilities = JSON.parse(JSON.stringify(entry.ancestryEnvVulnerabilities || []));
                window.state.ancestryInnateWeapons = JSON.parse(JSON.stringify(entry.ancestryInnateWeapons || []));
                window.state.ancestryInnateWeaponLog = JSON.parse(JSON.stringify(entry.ancestryInnateWeaponLog || []));
            } else {
                ancRaceEditId = null;
                window.state.ancestry = JSON.parse(JSON.stringify(getInitialState().ancestry));
                window.state.ancestryBonusPerks = [];
                window.state.ancestrySkillAptitudeSkills = [];
                window.state.ancestryEnvResistances = [];
                window.state.ancestryEnvVulnerabilities = [];
                window.state.ancestryInnateWeapons = [];
                window.state.ancestryInnateWeaponLog = [];
            }
            // Same leak this fixed for Skill Aptitude applies to Innate
            // Weapon too -- any weapon the LAST race (built or edited in
            // this same session) added stays in window.state.weapons
            // unless explicitly cleared, since it's a real weapons-list
            // entry, not something the ancestry reset above touches.
            window.state.weapons = window.state.weapons.filter(w => !w.isAncestry);
            (window.state.ancestryInnateWeapons || []).forEach((w, idx) => {
                window.state.weapons.push({ name: w.name, attr: 'STR', tr: true, dmg: w.dmg, ap: 2, isAncestry: true, ancestryInnateIdx: idx, category: 'melee' });
            });
            // The race builder shares window.state with whatever
            // character happens to be loaded, so anything the LAST race
            // (built or edited in this same session) trained via Skill
            // Aptitude needs to be explicitly untrained here -- otherwise
            // it silently carries into every race built afterward, since
            // skillsTrained itself was never part of the ancestry reset
            // above. Editing an existing race re-applies its own trained
            // skills right after this, same as selectGmRace does on import.
            Object.keys(window.state.skillSource || {}).forEach(skillId => {
                if (window.state.skillSource[skillId] === 'Ancestry (Skill Aptitude)') {
                    window.state.skillsTrained[skillId] = false;
                    delete window.state.skillSource[skillId];
                }
            });
            if (raceId) {
                if (!window.state.skillSource) window.state.skillSource = {};
                window.state.ancestrySkillAptitudeSkills.forEach(skillId => {
                    if (!skillId) return; // a still-unresolved Player's Choice sentinel
                    window.state.skillsTrained[skillId] = true;
                    window.state.skillSource[skillId] = 'Ancestry (Skill Aptitude)';
                });
            }
            window.openModal('ancestryModal'); // this calls syncAncestryWizard(), which resets ancTarget to 'player'
            ancTarget = 'gmRace'; // ...so it's set back to 'gmRace' immediately after
            window.ancTarget = ancTarget;
            document.getElementById('ancestryWizardTitle').innerText = 'Race Template Builder';
            toggleWizBaseAttrFields(true);
            document.getElementById('wizBtnFinish').innerText = 'Save Race Template';
        };

        window.openGmRaceRosterModal = function() {
            window.renderGmRaceList();
            window.openModal('gmRaceRosterModal');
        };

        window.renderGmRaceList = function() {
            let body = document.getElementById('gmRaceListBody');
            if (!body) return;
            if (!window.gmRaces.length) {
                body.innerHTML = '<div class="text-xs text-slate-500 text-center py-6">No race templates yet. Click "+ New Race" to build one.</div>';
                return;
            }
            body.innerHTML = window.gmRaces.map(entry => `
                <div class="flex items-center justify-between bg-slate-900 border border-slate-700 rounded p-2">
                    <div>
                        <div class="text-sm font-bold text-indigo-300">${entry.name || 'Unnamed Race'}</div>
                        <div class="text-[10px] text-slate-500">${entry.ancestry.gpUsed} / 15 GP spent${entry.ancestry.gpUsed < 15 ? ` -- ${15 - entry.ancestry.gpUsed} GP left for subrace customization` : ''}</div>
                    </div>
                    <div class="flex gap-1">
                        <button onclick="window.openGmRaceBuilder('${entry.id}')" class="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold px-2 py-1">Edit</button>
                        <button onclick="window.exportGmRace('${entry.id}')" class="text-[10px] text-slate-400 hover:text-slate-300 font-bold px-2 py-1">Export</button>
                        <button onclick="window.deleteGmRace('${entry.id}')" class="text-[10px] text-red-400 hover:text-red-300 font-bold px-2 py-1">Delete</button>
                    </div>
                </div>
            `).join('');
        };

        window.deleteGmRace = function(id) {
            let entry = window.gmRaces.find(r => r.id === id);
            if (!entry) return;
            window.showConfirm(`Delete ${entry.name || 'this race'}? This cannot be undone.`, () => {
                window.gmRaces = window.gmRaces.filter(r => r.id !== id);
                window.renderGmRaceList();
            });
        };

        function ancDownloadJson(filename, data) {
            let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
            let anchor = document.createElement('a');
            anchor.setAttribute("href", dataStr);
            anchor.setAttribute("download", filename);
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
        }

        window.exportGmRace = function(id) {
            let entry = window.gmRaces.find(r => r.id === id);
            if (!entry) return;
            let fileName = (entry.name || 'race').replace(/[^a-z0-9]/gi, '_').toLowerCase();
            ancDownloadJson(fileName + ".json", entry);
        };

        window.exportAllGmRaces = function() {
            if (!window.gmRaces.length) {
                window.showConfirm("No race templates to export yet.", null, true);
                return;
            }
            ancDownloadJson("gm_race_templates.json", window.gmRaces);
        };

        window.importGmRace = function(event) {
            let files = Array.from(event.target.files || []);
            if (!files.length) return;
            let remaining = files.length;
            let hadError = false;
            files.forEach(file => {
                let reader = new FileReader();
                reader.onload = function(e) {
                    try {
                        let parsed = JSON.parse(e.target.result);
                        let entries = Array.isArray(parsed) ? parsed : [parsed];
                        entries.forEach(entry => {
                            if (!entry || !entry.ancestry) return; // not a recognizable race file, skip silently
                            entry.id = entry.id || crypto.randomUUID();
                            if (window.gmRaces.some(r => r.id === entry.id)) entry.id = crypto.randomUUID();
                            window.gmRaces.push(entry);
                        });
                    } catch (err) {
                        console.error("Failed to parse race file:", file.name, err);
                        hadError = true;
                    }
                    remaining--;
                    if (remaining === 0) {
                        if (typeof window.renderGmRaceList === 'function') window.renderGmRaceList();
                        if (typeof window.renderImportedRaceList === 'function') window.renderImportedRaceList();
                        event.target.value = '';
                        if (hadError) window.showConfirm("One or more selected files weren't valid race files and were skipped.", null, true);
                    }
                };
                reader.readAsText(file);
            });
        };

// Player-side: shows whatever GM race templates have been imported as a
// "choose a starting race" list in Step 1. Only exists on the main
// character sheet (GM Tools has no such UI, so this quietly no-ops there
// via the element-existence check).
window.renderImportedRaceList = function() {
    let wrap = document.getElementById('importedRaceListWrap');
    let list = document.getElementById('importedRaceList');
    if (!wrap || !list) return;
    if (!window.gmRaces.length) {
        wrap.classList.add('hidden');
        return;
    }
    wrap.classList.remove('hidden');
    list.innerHTML = window.gmRaces.map(entry => `
        <button onclick="window.selectGmRace('${entry.id}')" class="text-left p-2 bg-slate-900 border border-slate-700 hover:border-indigo-500 rounded transition">
            <div class="text-xs font-bold text-indigo-300">${entry.name || 'Unnamed Race'}</div>
            <div class="text-[9px] text-slate-500">${entry.ancestry.gpUsed} / 15 GP spent${entry.ancestry.gpUsed < 15 ? ` (${15 - entry.ancestry.gpUsed} left for you to customize)` : ''}</div>
        </button>
    `).join('');
};

// Loads a GM race template as this character's starting ancestry. Never
// touches baseStats -- a species' modifiers layer on top of whatever
// Point Buy/Standard Array allocation the player already has, which is a
// separate, personal choice.
window.selectGmRace = function(raceId) {
    let entry = window.gmRaces.find(r => r.id === raceId);
    if (!entry) return;

    // Selecting a (possibly different) race template replaces the
    // ancestry-granted Skill Aptitude training from whatever was there
    // before -- untrain those first so switching races doesn't leave
    // stale skills marked trained from a race the player no longer has.
    (window.state.ancestrySkillAptitudeSkills || []).forEach(skillId => {
        if (window.state.skillSource && window.state.skillSource[skillId] === 'Ancestry (Skill Aptitude)') {
            window.state.skillsTrained[skillId] = false;
            delete window.state.skillSource[skillId];
        }
    });

    window.state.ancestry = JSON.parse(JSON.stringify(entry.ancestry));
    // Snapshot of what the GM granted, per trait/flaw id, so the player
    // can freely ADD more of their own choosing on top, but can't remove
    // what the GM specifically gave them. Attribute mods/size/speed/
    // lifespan aren't tracked here at all -- those stay fully editable,
    // since a species' raw stat block is something a player is always
    // meant to be able to tune to their character.
    window.state.ancestry.gmBaselineCounts = {};
    window.state.ancestry.traits.forEach(id => {
        window.state.ancestry.gmBaselineCounts[id] = (window.state.ancestry.gmBaselineCounts[id] || 0) + 1;
    });
    window.state.ancestry.flaws.forEach(id => {
        window.state.ancestry.gmBaselineCounts['flaw:' + id] = (window.state.ancestry.gmBaselineCounts['flaw:' + id] || 0) + 1;
    });
    window.state.ancestryBonusPerks = JSON.parse(JSON.stringify(entry.ancestryBonusPerks || []));
    window.state.ancestrySkillAptitudeSkills = JSON.parse(JSON.stringify(entry.ancestrySkillAptitudeSkills || []));
    window.state.ancestryEnvResistances = JSON.parse(JSON.stringify(entry.ancestryEnvResistances || []));
    window.state.ancestryEnvVulnerabilities = JSON.parse(JSON.stringify(entry.ancestryEnvVulnerabilities || []));
    // Same idea as Skill Aptitude above: the parallel array only records
    // WHICH innate weapons and die steps the GM chose -- the character
    // sheet's own weapons list has to be updated to actually contain
    // them, or the trait shows as purchased with nothing to show for it.
    // Any of the player's own PRE-EXISTING innate weapons (e.g. from
    // switching to a different race template) are cleared first.
    window.state.weapons = window.state.weapons.filter(w => !w.isAncestry);
    window.state.ancestryInnateWeapons = JSON.parse(JSON.stringify(entry.ancestryInnateWeapons || []));
    window.state.ancestryInnateWeaponLog = JSON.parse(JSON.stringify(entry.ancestryInnateWeaponLog || []));
    window.state.ancestryInnateWeapons.forEach((w, idx) => {
        window.state.weapons.push({ name: w.name, attr: 'STR', tr: true, dmg: w.dmg, ap: 2, isAncestry: true, ancestryInnateIdx: idx, category: 'melee' });
    });

    // Now actually apply what the GM chose -- the parallel arrays above
    // only record WHICH skill/energy type was picked; the character
    // sheet's own trained-skill state has to be updated to match, or the
    // skill just sits there un-trained despite the trait being present.
    // Entries that are still a "Player's Choice" sentinel (null, or
    // {playerChoice:true}) are skipped here -- they get resolved below,
    // through the sequential pop-up queue, instead.
    if (!window.state.skillSource) window.state.skillSource = {};
    window.state.ancestrySkillAptitudeSkills.forEach(skillId => {
        if (!skillId) return;
        window.state.skillsTrained[skillId] = true;
        window.state.skillSource[skillId] = 'Ancestry (Skill Aptitude)';
    });

    ATTRIBUTES.forEach(a => {
        document.getElementById(`wizMod_${a}`).value = window.state.ancestry.bonuses[a] || 0;
    });
    document.getElementById('wizSize').value = window.state.ancestry.size;
    document.getElementById('wizSpeed').value = window.state.ancestry.speed;
    let lsOpts = document.getElementById('wizLife').options;
    for (let i = 0; i < lsOpts.length; i++) {
        if (lsOpts[i].text === window.state.ancestry.lifespan) { document.getElementById('wizLife').selectedIndex = i; break; }
    }
    // Show the GM's chosen name verbatim, even if it happens to be
    // "Human" -- that's the blank-wizard DEFAULT's placeholder-hiding
    // behavior, not something that should apply to a name a GM
    // deliberately typed in when building this specific race template.
    document.getElementById('wizName').value = window.state.ancestry.name;
    window.buildAncestryLists();
    window.recalculateMath();

    // Queue up one pop-up per unresolved "Player's Choice" the GM left in
    // this race, then work through them one at a time.
    window.queuePendingRaceChoices();
    // Re-apply any feature locks to the DOM -- syncAncestryWizard ran
    // before this function copied the race data to state, so it didn't
    // know about locked features yet.
    applyGmFeatureLocksToDom();
};

// ----------------------------------------------------------------------
// Player's Choice resolution: a GM building a race template can leave
// Skill Aptitude, Environmental Resistance, Environmental Vulnerability,
// or Bonus Perk as "the player's choice" instead of picking for them. On
// import, those show up as sentinels (null for a skill, {playerChoice:
// true} for the others) in the same parallel arrays real choices live
// in. Rather than pre-computing a queue of array indices up front, this
// RE-SCANS for the first remaining sentinel every time it's called --
// resolving one entry (splicing a placeholder out, pushing a real entry
// in) shifts every later index in that same array, so a queue built
// once up front goes stale the moment more than one pending choice of
// the same type exists. Re-scanning fresh each time sidesteps that
// entirely: it always finds wherever the next sentinel actually is now,
// not wherever it used to be.
// ----------------------------------------------------------------------
window.queuePendingRaceChoices = function() {
    window.processNextPendingRaceChoice();
};
window.processNextPendingRaceChoice = function() {
    let skillIdx = (window.state.ancestrySkillAptitudeSkills || []).findIndex(s => !s);
    if (skillIdx !== -1) {
        window.openSkillTrainPicker((skillId) => {
            window.state.ancestrySkillAptitudeSkills[skillIdx] = skillId;
            window.state.skillsTrained[skillId] = true;
            if (!window.state.skillSource) window.state.skillSource = {};
            window.state.skillSource[skillId] = 'Ancestry (Skill Aptitude)';
            window.recalculateMath();
            window.processNextPendingRaceChoice();
        }, 'Your Species grants Skill Aptitude -- choose a Skill to Train', 'Ancestry (Skill Aptitude)');
        return;
    }
    let envResistIdx = (window.state.ancestryEnvResistances || []).findIndex(e => e && e.playerChoice);
    if (envResistIdx !== -1) {
        window.openEnvResistPicker((sentinel) => {
            // selectEnvResistType already pushed a NEW entry onto the
            // array for a real type choice (or upgraded an existing one
            // to Immune) -- the placeholder sentinel this pending entry
            // occupied needs removing so it doesn't linger as a second,
            // bogus resistance. Re-find it fresh rather than trusting the
            // index captured before the picker opened, in case an
            // earlier resolution in this same batch already shifted it.
            if (!sentinel) {
                let stillAt = window.state.ancestryEnvResistances.indexOf(window.state.ancestryEnvResistances.find(e => e.__placeholder));
                if (stillAt !== -1) window.state.ancestryEnvResistances.splice(stillAt, 1);
            }
            window.recalculateMath();
            window.processNextPendingRaceChoice();
        });
        // Re-point the picker at "first purchase" framing by temporarily
        // clearing this placeholder so it doesn't show up as an already-
        // taken type in the list the player is choosing from.
        window.state.ancestryEnvResistances[envResistIdx] = { __placeholder: true };
        return;
    }
    let envVulnIdx = (window.state.ancestryEnvVulnerabilities || []).findIndex(e => e && e.playerChoice);
    if (envVulnIdx !== -1) {
        window.openEnvVulnPicker((sentinel) => {
            if (!sentinel) {
                let stillAt = window.state.ancestryEnvVulnerabilities.indexOf(window.state.ancestryEnvVulnerabilities.find(e => e.__placeholder));
                if (stillAt !== -1) window.state.ancestryEnvVulnerabilities.splice(stillAt, 1);
            }
            window.recalculateMath();
            window.processNextPendingRaceChoice();
        });
        window.state.ancestryEnvVulnerabilities[envVulnIdx] = { __placeholder: true };
        return;
    }
    let bonusPerkIdx = (window.state.ancestryBonusPerks || []).findIndex(e => e && e.playerChoice);
    if (bonusPerkIdx !== -1) {
        window.state.ancestryBonusPerks.splice(bonusPerkIdx, 1); // remove the placeholder; selectAncBonusPerk's commit() pushes a fresh real entry
        // The trait-count side of this Player's Choice purchase was
        // already established by the GM's original purchase, so once
        // selectAncBonusPerk's commit() actually finalizes (immediately
        // for a plain perk, or only after a dynamic sub-choice like
        // Latent Potential's Attribute picker resolves), the extra
        // 't_bp' entry it pushes needs popping back off to avoid
        // double-counting -- while keeping the real perk choice itself.
        ancBonusPerkAfterCommit = () => {
            let traits = window.state.ancestry.traits;
            let lastBpIdx = traits.lastIndexOf('t_bp');
            if (lastBpIdx !== -1) traits.splice(lastBpIdx, 1);
            window.recalculateMath();
            window.buildAncestryLists();
            window.processNextPendingRaceChoice();
        };
        window.openAncBonusPerkModal();
        return;
    }
};
