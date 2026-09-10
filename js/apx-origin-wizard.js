// ============================================================
// APX Character Sheet — Origin Wizard
// ============================================================
        let currentOriginStep = 1;

        window.navOriginWizard = function(dir) {
            window.jumpToOrigStep(currentOriginStep + dir);
        }

        window.jumpToOrigStep = function(n) {
            if (n < 1 || n > 2) return;
            document.getElementById(`origStep${currentOriginStep}`).classList.remove('active');
            currentOriginStep = n;
            document.getElementById(`origStep${currentOriginStep}`).classList.add('active');
            
            document.getElementById('origBtnPrev').style.display = currentOriginStep > 1 ? 'block' : 'none';
            document.getElementById('origBtnNext').style.display = currentOriginStep < 2 ? 'block' : 'none';
            document.getElementById('origBtnFinish').style.display = 'block';
            window.updateWizardTabs('origTab', currentOriginStep, 2);
        }

        window.syncOriginWizard = function() {
            document.getElementById('origName').value = window.state.origin.name !== "Unknown" ? window.state.origin.name : "";
            document.getElementById('origCommonLanguage').value = window.state.origin.commonLanguage || "";
            renderOrigCompsGrid();
            document.getElementById('origFeature').value = window.state.origin.feature || "";
            document.getElementById('origWealth').value = "0"; 
            window.jumpToOrigStep(1);
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

        function renderOrigCompsGrid() {
            let body = document.getElementById('origCompsGrid');
            if (!body) return;
            body.innerHTML = window.state.origin.comps.map((comp, idx) => {
                let detail = '';
                if (comp.type === 'language') {
                    detail = `<input type="text" value="${comp.value || ''}" onchange="window.origSetCompLanguage(${idx}, this.value)" placeholder="Language name..." class="bg-slate-900 text-xs w-full">`;
                } else if (comp.type === 'skill') {
                    detail = `<span class="text-xs text-slate-200">${comp.value || ''}</span>`;
                } else if (comp.type === 'weapon') {
                    let isCustom = comp.value === '__custom__';
                    detail = `
                        <select onchange="window.origSetCompWeaponType(${idx}, this.value)" class="bg-slate-900 text-xs w-full">
                            <option value="">Choose...</option>
                            ${WEAPON_TYPE_TRAININGS.map(w => `<option value="${w}" ${comp.value === w ? 'selected' : ''}>${w}</option>`).join('')}
                            <option value="__custom__" ${isCustom ? 'selected' : ''}>Custom...</option>
                        </select>
                        ${isCustom ? `<input type="text" value="${comp.customValue || ''}" onchange="window.origSetCompCustomWeapon(${idx}, this.value)" placeholder="Custom weapon type..." class="bg-slate-900 text-xs w-full mt-1">` : ''}
                    `;
                }
                return `
                    <div class="grid grid-cols-[24px_24px_24px_1fr] gap-2 items-start mb-1.5">
                        <input type="checkbox" class="mt-1" ${comp.type === 'language' ? 'checked' : ''} onchange="window.origToggleCompType(${idx}, 'language', this.checked)">
                        <input type="checkbox" class="mt-1" ${comp.type === 'skill' ? 'checked' : ''} onchange="window.origToggleCompType(${idx}, 'skill', this.checked)">
                        <input type="checkbox" class="mt-1" ${comp.type === 'weapon' ? 'checked' : ''} onchange="window.origToggleCompType(${idx}, 'weapon', this.checked)">
                        <div>${detail}</div>
                    </div>
                `;
            }).join('');
        }

        window.finishOrigin = function() {
            window.state.origin.name = document.getElementById('origName').value || "Unknown Origin";
            window.state.origin.feature = document.getElementById('origFeature').value;

            let wealthSelect = document.getElementById('origWealth');
            let wealthVal = parseInt(wealthSelect.value) || 0;

            if (!window.state.origin.wealthApplied && wealthVal > 0) {
                window.state.currency += wealthVal;
                window.state.origin.wealthApplied = true;
            }

            // Auto-fill the languages field with the common language from this origin.
            // Only add it if the language field is empty or doesn't already contain it.
            let commonLang = window.state.origin.commonLanguage || '';
            if (commonLang) {
                let langInput = document.getElementById('languages');
                let current = (langInput?.value || '').trim();
                if (!current.toLowerCase().includes(commonLang.toLowerCase())) {
                    langInput.value = current ? current + ', ' + commonLang : commonLang;
                    window.updateState('languages', langInput.value);
                }
            }

            window.closeModal('originModal');
            window.recalculateMath();
        }

