// ============================================================
// APX Character Sheet — Core State & Generic UI Plumbing
// ============================================================
// Build version: year.month.day.HHMM (24-hr, update each release)
window.APX_VERSION = 'v2026.9.12.0631';

        window.state = getInitialState();

        let calc = {
            scores: {}, mods: {}, skills: {},
            ac: 10, dr: 0, er: 0, speed: 3,
            maxRestDice: 5, restDieStep: "d6", carryCap: 150, maxAp: 6, init: 10,
            sizeMultBoost: 0, wtBoost: 0, lucAc: false, useIntInit: false,
            bonusMeleeAtk: 0, bonusMeleeDmg: 0, bonusRangedAtk: 0, bonusRangedDmg: 0,
            hasArmorDisadvantage: false, maxHpPenalty: 0
        };

        // ------------------------------------------------------------------
        // Undo / Redo
        // ------------------------------------------------------------------
        // Snapshot-based rather than action-based: this app mutates
        // window.state directly from dozens of files with no central
        // dispatcher, so there's no single choke point to hook per-action
        // undo into. Instead, a capture-phase listener on click/change
        // snapshots state right before whatever handler is about to run,
        // deduped against the last snapshot so non-mutating clicks (opening
        // a modal, hitting Cancel) don't pollute the stack.
        //
        // Critical: clicks on the Undo/Redo buttons themselves must NOT be
        // snapshotted. Missing this was the root cause of undo silently
        // corrupting after one step -- clicking Undo would snapshot the
        // current (already-restored) state as if it were a new action,
        // throwing off every subsequent undo/redo's sense of "top of stack".
        let undoStack = [];
        let redoStack = [];
        window.appSettings = window.appSettings || { undoHistorySize: 60, theme: 'modern' };
        // App-level preferences (undo history size, visual theme) are
        // deliberately kept separate from window.state -- they're a
        // browser/user preference, not part of any individual character,
        // so they persist via localStorage instead of the roster's
        // save/load system and are never touched by undo/redo.
        try {
            let saved = JSON.parse(localStorage.getItem('apxAppSettings') || 'null');
            if (saved) window.appSettings = Object.assign(window.appSettings, saved);
            // apxTheme is the single source of truth for the active theme --
            // both the landing page and the in-app selector write here, so
            // there's no merging logic needed; just read it directly.
            var storedTheme = localStorage.getItem('apxTheme');
            if (storedTheme) window.appSettings.theme = storedTheme;
        } catch (e) { /* corrupt or inaccessible storage -- fall back to defaults */ }

        function apxSaveAppSettings() {
            try {
                localStorage.setItem('apxAppSettings', JSON.stringify(window.appSettings));
                localStorage.setItem('apxTheme', window.appSettings.theme);
            } catch (e) { /* storage unavailable (private browsing, etc.) -- setting still applies for this session */ }
        }
        window.setUndoHistorySize = function(val) {
            window.appSettings.undoHistorySize = Math.max(10, parseInt(val) || 60);
            document.getElementById('undoHistoryValue').innerText = window.appSettings.undoHistorySize;
            apxSaveAppSettings();
        };
        window.setTheme = function(val) {
            window.appSettings.theme = val;
            document.documentElement.setAttribute('data-theme', val);
            apxSaveAppSettings();
        };
        window.applyAppSettingsToUI = function() {
            document.documentElement.setAttribute('data-theme', window.appSettings.theme);
            let slider = document.getElementById('undoHistorySlider');
            let sliderLabel = document.getElementById('undoHistoryValue');
            let themeSel = document.getElementById('themeSelector');
            if (slider) slider.value = window.appSettings.undoHistorySize;
            if (sliderLabel) sliderLabel.innerText = window.appSettings.undoHistorySize;
            if (themeSel) themeSel.value = window.appSettings.theme;
        };
        window.applyAppSettingsToUI();

        function apxIsUndoRedoControl(target) {
            return !!(target && target.closest && target.closest('#btnUndo, #btnRedo, .undo-redo-cluster, #settingsModal'));
        }

        // Two-phase capture: record state on the way IN (capture phase,
        // before whatever handler is about to run), then only actually
        // commit it to the undo stack on the way back OUT (bubble phase,
        // after that handler has finished) if state genuinely changed.
        // This is what keeps opening/canceling a menu -- or any click that
        // doesn't touch window.state at all -- out of the undo log,
        // rather than the old approach of always recording the very first
        // click seen (since an empty stack has nothing to de-duplicate
        // against yet).
        // ------------------------------------------------------------------
        // Instant tooltips (data-tip="...") -- portaled to document.body
        // rather than a CSS ::after pseudo-element, because ::after is
        // positioned relative to its own element and gets silently
        // clipped by any scrolling ancestor with overflow:hidden/auto --
        // no z-index can fix that, since it's a containing-block/overflow
        // issue, not a stacking one. Rendering the tooltip as a real,
        // body-level element and positioning it with getBoundingClientRect
        // sidesteps that entirely.
        // ------------------------------------------------------------------
        (function() {
            let tooltipEl = null;
            function showTooltip(target) {
                let text = target.getAttribute('data-tip');
                if (!text) return;
                hideTooltip();
                tooltipEl = document.createElement('div');
                tooltipEl.className = 'apx-portal-tooltip';
                tooltipEl.textContent = text;
                tooltipEl.style.cssText = 'position:fixed; background:var(--c-surface2); color:var(--c-text); border:1px solid var(--c-border2); padding:5px 8px; border-radius:4px; font-size:10px; font-family:var(--c-body-ui-font, var(--c-font)); max-width:220px; width:max-content; white-space:pre-line; z-index:99999; pointer-events:none; box-shadow:0 4px 10px rgba(0,0,0,0.5); text-align:left; line-height:1.3;';
                document.body.appendChild(tooltipEl);
                let rect = target.getBoundingClientRect();
                let tipRect = tooltipEl.getBoundingClientRect();
                let left = rect.left + rect.width / 2 - tipRect.width / 2;
                left = Math.max(4, Math.min(left, window.innerWidth - tipRect.width - 4));
                let top = rect.top - tipRect.height - 8;
                if (top < 4) top = rect.bottom + 8; // flip below when there's no room above
                tooltipEl.style.left = left + 'px';
                tooltipEl.style.top = top + 'px';
            }
            function hideTooltip() {
                if (tooltipEl) { tooltipEl.remove(); tooltipEl = null; }
            }
            document.addEventListener('mouseover', function(e) {
                let target = e.target.closest && e.target.closest('[data-tip]');
                if (target) showTooltip(target);
            });
            document.addEventListener('mouseout', function(e) {
                let target = e.target.closest && e.target.closest('[data-tip]');
                if (target) hideTooltip();
            });
            document.addEventListener('scroll', hideTooltip, true);
            document.addEventListener('click', hideTooltip, true);
        })();

        let pendingUndoSnapshot = null;
        function apxCaptureBeforeState(e) {
            if (e && apxIsUndoRedoControl(e.target)) { pendingUndoSnapshot = null; return; }
            pendingUndoSnapshot = JSON.stringify(window.state);
        }
        function apxCommitUndoSnapshotIfChanged() {
            if (pendingUndoSnapshot === null) return;
            let before = pendingUndoSnapshot;
            pendingUndoSnapshot = null;
            let after = JSON.stringify(window.state);
            if (after === before) return; // nothing actually changed -- e.g. opening/canceling a menu
            if (undoStack.length === 0 || undoStack[undoStack.length - 1] !== before) {
                undoStack.push(before);
                let cap = window.appSettings.undoHistorySize || 60;
                while (undoStack.length > cap) undoStack.shift();
                redoStack = []; // a fresh action invalidates whatever redo history existed
                window.updateUndoRedoButtons();
            }
        }
        document.addEventListener('click', apxCaptureBeforeState, true);
        document.addEventListener('click', apxCommitUndoSnapshotIfChanged, false);
        document.addEventListener('change', apxCaptureBeforeState, true);
        document.addEventListener('change', apxCommitUndoSnapshotIfChanged, false);

        function apxRestoreState(json) {
            let restored = JSON.parse(json);
            Object.keys(window.state).forEach(k => delete window.state[k]);
            Object.assign(window.state, restored);
            // Any open modal's own step/wizard UI (which lives outside
            // window.state) could now be referencing data that no longer
            // matches -- close them rather than risk a stale form silently
            // overwriting the just-restored values on its next save.
            document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
            window.recalculateMath();
            window.updateUndoRedoButtons();
        }

        // With undo/redo-button clicks excluded from snapshotting, the top
        // of undoStack always genuinely reflects "state right before the
        // last real action" -- no defensive double-popping needed.
        window.performUndo = function() {
            if (undoStack.length === 0) return;
            let currentJson = JSON.stringify(window.state);
            let target = undoStack.pop();
            redoStack.push(currentJson);
            apxRestoreState(target);
        };
        window.performRedo = function() {
            if (redoStack.length === 0) return;
            let currentJson = JSON.stringify(window.state);
            let target = redoStack.pop();
            undoStack.push(currentJson);
            apxRestoreState(target);
        };
        window.updateUndoRedoButtons = function() {
            let undoBtn = document.getElementById('btnUndo');
            let redoBtn = document.getElementById('btnRedo');
            if (undoBtn) undoBtn.disabled = undoStack.length === 0;
            if (redoBtn) redoBtn.disabled = redoStack.length === 0;
        };
        document.addEventListener('keydown', (e) => {
            let z = e.key === 'z' || e.key === 'Z';
            let y = e.key === 'y' || e.key === 'Y';
            if ((e.ctrlKey || e.metaKey) && z && !e.shiftKey) {
                e.preventDefault();
                window.performUndo();
            } else if ((e.ctrlKey || e.metaKey) && ((z && e.shiftKey) || y)) {
                e.preventDefault();
                window.performRedo();
            }
        });

        window.setInitStat = function(stat, checked) {
            if (!checked) {
                // Exactly one must always be selected -- unchecking the
                // active one without picking a replacement isn't
                // meaningful, so just re-check it.
                document.getElementById('initStat' + stat).checked = true;
                return;
            }
            window.updateState('initStat', stat);
            window.syncInitStatCheckboxes();
        };
        window.syncInitStatCheckboxes = function() {
            if (window.state.initStat === 'INT' && !calc.useIntInit) {
                // Tactical Mind was removed (perk sold, undo, etc.) while INT
                // was selected -- revert rather than silently keep using an
                // Initiative stat the character can no longer actually use.
                window.state.initStat = 'AGI';
            }
            ['AGI', 'PER', 'INT'].forEach(s => {
                let box = document.getElementById('initStat' + s);
                if (box) box.checked = (window.state.initStat === s);
            });
            let intBox = document.getElementById('initStatINT');
            if (intBox) intBox.disabled = !calc.useIntInit;
        };

        window.openModal = function(id) {
            document.getElementById(id).classList.add('active');
            if(id === 'perkModal') window.renderPerkList();
            if(id === 'ancestryModal') window.syncAncestryWizard();
            if(id === 'spendXpModal') window.updateXpCosts();
            if(id === 'settingsModal') window.applyAppSettingsToUI();
            if(id === 'originModal') {
                currentOriginStep = 1;
                document.getElementById('origStep1').classList.add('active');
                document.getElementById('origStep2').classList.remove('active');
                document.getElementById('origBtnPrev').style.display = 'none';
                document.getElementById('origBtnNext').style.display = 'block';
                window.syncOriginWizard();
            }
        }
        
        window.closeModal = function(id) {
            if (id === 'itemDetailModal' && window._itemDetailIdx !== null && window._itemDetailIdx !== undefined) {
                let item = window.state.items[window._itemDetailIdx];
                if (item && item.isConsumable && item.chargesRemaining <= 0) {
                    window.state.items.splice(window._itemDetailIdx, 1);
                    window.recalculateMath();
                }
                window._itemDetailIdx = null;
            }
            document.getElementById(id).classList.remove('active');
        }

        window.updateState = function(key, val) {
            window.state[key] = val;
            window.recalculateMath();
        }

        // Parses a typed math-input string ("+3", "-80", "2500", etc.) into
        // a final numeric result relative to currentValue, with the same
        // safety fixes: "+X"/"-X" adds/subtracts as a delta rather than
        // string-concatenating, and leading zeros are stripped so digit
        // strings like "00002500" never get silently misread as a legacy
        // octal literal (00002500 -> 1344, not 2500) by the expression
        // evaluator below. Returns null if the input doesn't parse.
        window.parseMathExpression = function(rawValue, currentValue) {
            let cleanVal = (rawValue || '').replace(/[^0-9\+\-\s]/g, '');
            if (cleanVal.trim() === "") return 0;
            cleanVal = cleanVal.replace(/\b0+(?=\d)/g, '');
            let result;
            if (cleanVal.startsWith('+') || cleanVal.startsWith('-')) {
                let delta = Math.floor(new Function('return ' + cleanVal)());
                delta = isNaN(delta) ? 0 : delta;
                result = (currentValue || 0) + delta;
            } else {
                result = Math.floor(new Function('return ' + cleanVal)());
                result = isNaN(result) ? null : result;
            }
            return result;
        };

        window.handleMathInput = function(stateKey, inputEl) {
            let val = inputEl.value;
            try {
                let result = window.parseMathExpression(val, window.state[stateKey]);
                if (result === null) throw new Error('unparseable');

                if (stateKey === 'currentHp') {
                    let vitalHpRank = window.state.perks['con_vitality'] || 0;
                    let maxHp = Math.max(5, (calc.scores.CON * 5) + (vitalHpRank * 5) + window.state.xpHpBought - calc.maxHpPenalty);
                    result = Math.max(0, Math.min(result, maxHp));
                }
                if (stateKey === 'tempHp' && result < 0) {
                    // Temp HP can never go negative. Any negative overflow
                    // comes out of current HP instead, same as it would in
                    // play (Temp HP absorbs damage first; once it's gone,
                    // the rest hits real HP).
                    let overflow = result; // negative
                    let vitalHpRank = window.state.perks['con_vitality'] || 0;
                    let maxHp = Math.max(5, (calc.scores.CON * 5) + (vitalHpRank * 5) + window.state.xpHpBought - calc.maxHpPenalty);
                    window.state.currentHp = Math.max(0, Math.min(maxHp, (window.state.currentHp || 0) + overflow));
                    result = 0;
                }
                if (['fatigue', 'restDice', 'luckPts', 'unspentXp'].includes(stateKey)) {
                    result = Math.max(0, result);
                }

                window.updateState(stateKey, result);
            } catch(e) {
                inputEl.value = window.state[stateKey];
            }
        };

        window.updateNestedState = function(obj, key, val) {
            window.state[obj][key] = val;
            window.recalculateMath();
        }

        // Shared by every multi-step wizard's numbered tab bar: highlights
        // the current step and, optionally, dims steps beyond a locked
        // limit (used by wizards that gate later steps behind a rank).
        window.updateWizardTabs = function(prefix, activeStep, totalSteps, unlockedUpTo) {
            for (let i = 1; i <= totalSteps; i++) {
                let tab = document.getElementById(`${prefix}${i}`);
                if (!tab) continue;
                tab.classList.toggle('wiz-tab-active', i === activeStep);
                if (unlockedUpTo !== undefined) tab.classList.toggle('opacity-30', i > unlockedUpTo);
            }
        };

        window.toggleCraftMatWeight = function(checked) {
            window.updateState('craftingMatWeightEnabled', checked);
        };

        let pendingConfirmCallback = null;
        let confirmReopenedByCallback = false;
        window.showConfirm = function(msg, callback, alertOnly = false) {
            document.getElementById('confirmMessage').innerText = msg;
            pendingConfirmCallback = callback;
            document.getElementById('btnConfirmNo').style.display = alertOnly ? 'none' : 'block';
            document.getElementById('confirmModal').classList.add('active');
            confirmReopenedByCallback = true; // tells executeConfirm a nested showConfirm just fired
        }

        window.executeConfirm = function() {
            let cb = pendingConfirmCallback;
            pendingConfirmCallback = null;
            confirmReopenedByCallback = false;
            if (cb) cb();
            // If cb() itself called showConfirm() again (e.g. an "insufficient
            // materials" follow-up alert), that new dialog is now showing --
            // don't blow it away by closing right after we opened it.
            if (!confirmReopenedByCallback) {
                window.closeModal('confirmModal');
            }
        }

        window.cancelConfirm = function() {
            pendingConfirmCallback = null;
            window.closeModal('confirmModal');
        }

        window.syncDOM = function() {
            document.getElementById('charName').value = window.state.name;
            document.getElementById('languages').value = window.state.languages;
            document.getElementById('currency').value = window.state.currency;
            document.getElementById('craftMatWeightToggle').checked = window.state.craftingMatWeightEnabled;
            document.getElementById('unspentXp').value = window.state.unspentXp;
            document.getElementById('spentXp').value = window.state.spentXp;
            document.getElementById('currentHpInput').value = window.state.currentHp;
            document.getElementById('tempHpInput').value = window.state.tempHp;
            document.getElementById('fatigueInput').value = window.state.fatigue;
            document.getElementById('currentRestDice').value = window.state.restDice;
            document.getElementById('luckPtsInput').value = window.state.luckPts;
            document.getElementById('woundsInput').value = window.state.wounds;
            window.syncInitStatCheckboxes();
            document.getElementById('powerAttr').value = window.state.powerAttr;
            
            document.getElementById('armorName').value = window.state.equippedArmor.name;
            document.getElementById('armorWt').innerText = window.state.equippedArmor.wt;
            document.getElementById('armorAc').innerText = window.state.equippedArmor.ac;
            document.getElementById('armorDr').innerText = window.state.equippedArmor.dr;
            document.getElementById('armorEr').innerText = window.state.equippedArmor.er;
            document.getElementById('removeArmorBtn').classList.toggle('hidden', !window.state.equippedArmor.name);
            
            document.getElementById('dispAncestryName').innerText = window.state.ancestry.name;
            document.getElementById('dispGpUsed').innerText = window.state.ancestry.gpUsed;
            document.getElementById('dispOriginName').innerText = window.state.origin.name !== "" ? window.state.origin.name : "Unknown";
        }

