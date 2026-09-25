// ============================================================
// APX Character Sheet — Origin Wizard
// ============================================================
        // One screen: identity, wealth and feature beside languages and competencies.
        // (Kept for anything that still calls the old step navigation.)
        window.navOriginWizard = function() {};
        window.jumpToOrigStep = function() {};

        window.syncOriginWizard = function() {
            document.getElementById('origName').value = window.state.origin.name !== "Unknown" ? window.state.origin.name : "";
            document.getElementById('origCommonLanguage').value = window.state.origin.commonLanguage || "";
            renderOrigCompsGrid();
            document.getElementById('origFeature').value = window.state.origin.feature || "";
            document.querySelectorAll('input[name="origWealth"]').forEach(r => { r.checked = false; });
            // Wealth is chosen once: after that the choices are locked
            let applied = !!window.state.origin.wealthApplied;
            document.querySelectorAll('.orig-wealth-option input[type="radio"]').forEach(r => {
                r.disabled = applied;
                r.closest('label').style.opacity = applied ? '0.5' : '';
                r.closest('label').style.cursor = applied ? 'not-allowed' : 'pointer';
            });
            let note = document.getElementById('origWealthNote');
            if (note) note.textContent = applied ? 'Already added to your Currency.' : 'Added to your Currency when you save. Chosen once.';
        }

        window.origSetCommonLanguage = function(val) {
            window.state.origin.commonLanguage = val;
        };

        // Each of the 4 competency slots is independently Language, Skill,
        // or Weapon Type -- mutually exclusive within its own row, which a
        // plain checkbox doesn't enforce on its own, so switching types (or
        // unchecking) here also cleans up whatever side effect the
        // previous choice caused (an auto-trained skill, a registered
        // weapon type), the same way removing a trait elsewhere in this
        // app refunds/undoes whatever it granted.
        function origCleanupCompSideEffect(comp) {
            if (comp.type === 'skill' && comp.skillId) {
                window.state.skillsTrained[comp.skillId] = false;
            }
            if (comp.type === 'weapon') {
                let effectiveType = comp.value === '__custom__' ? comp.customValue : comp.value;
                if (effectiveType) window.state.trainedWeaponTypes = window.state.trainedWeaponTypes.filter(t => t !== effectiveType);
            }
        }

        window.origToggleCompType = function(idx, type, checked) {
            let comp = window.state.origin.comps[idx];
            origCleanupCompSideEffect(comp);
            if (!checked) {
                comp.type = null; comp.value = ''; comp.skillId = null; comp.customValue = '';
                renderOrigCompsGrid();
                window.recalculateMath();
                return;
            }
            comp.type = type; comp.value = ''; comp.skillId = null; comp.customValue = '';
            if (type === 'skill') {
                window.openSkillTrainPicker((skillId, skillName) => {
                    comp.skillId = skillId;
                    comp.value = skillName;
                    renderOrigCompsGrid();
                    window.recalculateMath();
                }, 'Choose a Skill to Train (Origin Competency)', 'Origin');
            }
            renderOrigCompsGrid();
            window.recalculateMath();
        };

        window.origSetCompWeaponType = function(idx, val) {
            let comp = window.state.origin.comps[idx];
            let oldEffective = comp.value === '__custom__' ? comp.customValue : comp.value;
            if (oldEffective) window.state.trainedWeaponTypes = window.state.trainedWeaponTypes.filter(t => t !== oldEffective);
            comp.value = val;
            comp.customValue = '';
            if (val && val !== '__custom__' && !window.state.trainedWeaponTypes.includes(val)) {
                window.state.trainedWeaponTypes.push(val);
            }
            renderOrigCompsGrid();
            window.recalculateMath();
        };
        window.origSetCompCustomWeapon = function(idx, val) {
            let comp = window.state.origin.comps[idx];
            let oldEffective = comp.customValue;
            if (oldEffective) window.state.trainedWeaponTypes = window.state.trainedWeaponTypes.filter(t => t !== oldEffective);
            comp.customValue = val;
            if (val && !window.state.trainedWeaponTypes.includes(val)) window.state.trainedWeaponTypes.push(val);
            window.recalculateMath();
        };
        window.origSetCompLanguage = function(idx, val) {
            window.state.origin.comps[idx].value = val;
        };

        // Each competency slot: pick Language, Skill or Weapon Type (click the active one again to clear it)
        function renderOrigCompsGrid() {
            let body = document.getElementById('origCompsGrid');
            if (!body) return;
            let esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
            let seg = (idx, comp, type, label) => {
                let on = comp.type === type;
                return `<button type="button" onclick="window.origToggleCompType(${idx}, '${type}', ${!on})"
                    class="px-2 py-1 text-[10px] font-bold rounded border transition ${on ? 'bg-pink-700 border-pink-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}">${label}</button>`;
            };
            body.innerHTML = window.state.origin.comps.map((comp, idx) => {
                let detail = '<div class="text-[10px] text-slate-600 italic">Choose what this competency is.</div>';
                if (comp.type === 'language') {
                    detail = `<input type="text" value="${esc(comp.value)}" onchange="window.origSetCompLanguage(${idx}, this.value)" placeholder="Language name..." class="bg-slate-900 text-xs w-full">`;
                } else if (comp.type === 'skill') {
                    detail = comp.value ? `<div class="text-xs text-blue-300 font-bold">${esc(comp.value)} <span class="text-[9px] text-slate-500 font-normal">(trained)</span></div>`
                        : `<button type="button" onclick="window.origToggleCompType(${idx}, 'skill', true)" class="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold">Choose a skill…</button>`;
                } else if (comp.type === 'weapon') {
                    let isCustom = comp.value === '__custom__';
                    detail = `
                        <select onchange="window.origSetCompWeaponType(${idx}, this.value)" class="bg-slate-900 text-xs w-full">
                            <option value="">Choose a weapon type...</option>
                            ${WEAPON_TYPE_TRAININGS.map(w => `<option value="${esc(w)}" ${comp.value === w ? 'selected' : ''}>${esc(w)}</option>`).join('')}
                            <option value="__custom__" ${isCustom ? 'selected' : ''}>Custom...</option>
                        </select>
                        ${isCustom ? `<input type="text" value="${esc(comp.customValue)}" onchange="window.origSetCompCustomWeapon(${idx}, this.value)" placeholder="Custom weapon type..." class="bg-slate-900 text-xs w-full mt-1">` : ''}`;
                }
                return `
                    <div class="bg-slate-900/60 border border-slate-700 rounded p-2">
                        <div class="flex items-center gap-1 mb-1.5">
                            <span class="text-[9px] text-slate-500 font-black uppercase mr-1">Competency ${idx + 1}</span>
                            ${seg(idx, comp, 'language', 'Language')}${seg(idx, comp, 'skill', 'Skill')}${seg(idx, comp, 'weapon', 'Weapon Type')}
                        </div>
                        ${detail}
                    </div>`;
            }).join('');
        }

        window.finishOrigin = function() {
            window.state.origin.name = document.getElementById('origName').value || "Unknown Origin";
            window.state.origin.feature = document.getElementById('origFeature').value;

            let wealthRadio = document.querySelector('input[name="origWealth"]:checked');
            let wealthVal = parseInt(wealthRadio?.value || '0') || 0;

            if (!window.state.origin.wealthApplied && wealthVal > 0) {
                window.state.currency += wealthVal;
                window.state.origin.wealthApplied = true;
            }
            if (wealthVal === 0 && !window.state.origin.wealthApplied) {
                window.state.origin.wealthApplied = true; // "None" counts as applied
            }
            // Lock all radio buttons once wealth is applied
            if (window.state.origin.wealthApplied) {
                document.querySelectorAll('.orig-wealth-option input[type="radio"]').forEach(r => {
                    r.disabled = true;
                    r.closest('label').style.opacity = '0.5';
                    r.closest('label').style.cursor = 'not-allowed';
                });
            }

            // Migrate languages → charNote (non-destructive: only if charNotes doesn't already have a Languages note)
            let commonLang = window.state.origin.commonLanguage || '';
            let extraLangs = (window.state.origin.comps || [])
                .filter(c => c.type === 'language' && c.value)
                .map(c => c.value);
            let allLangs = commonLang ? [commonLang, ...extraLangs] : extraLangs;
            if (allLangs.length) {
                let langStr = allLangs.join(', ');
                if (!window.state.charNotes) window.state.charNotes = [];
                let existing = window.state.charNotes.find(n => n.title === 'Languages');
                if (!existing) {
                    window.state.charNotes.push({
                        id: 'cn_lang_' + Date.now(),
                        title: 'Languages',
                        session: 0,
                        date: new Date().toISOString().slice(0,10),
                        content: langStr
                    });
                } else {
                    // Append any new languages not already listed
                    let existingLangs = existing.content.split(',').map(s=>s.trim().toLowerCase());
                    let newLangs = allLangs.filter(l => !existingLangs.includes(l.toLowerCase()));
                    if (newLangs.length) existing.content += ', ' + newLangs.join(', ');
                }
                if (typeof window.renderCharNotes === 'function') window.renderCharNotes();
            }

            window.closeModal('originModal');
            window.recalculateMath();
        }

