// ============================================================
// APX GM Tools — GM Screen (party dashboard + initiative tracker)
// ============================================================

// Computes the same derived stats the character sheet itself shows (AC,
// DR, ER, Max HP, AP, Speed, Saving Throws, Trained Skills) directly from
// a raw character save file -- without touching window.state or any DOM
// element from the real character sheet. This intentionally reuses the
// actual PERKS_DB effect() functions (they're pure: calc in, calc out, no
// DOM access) so perk bonuses are exactly as accurate as the sheet's own
// engine, rather than an approximation. What it does NOT replicate is
// condition/wound-based Disadvantage tracking, weapon/power stat lines,
// or anything not needed for an at-a-glance summary -- for those, open
// the character's own file.
function computeCharSummary(state) {
    // Null-guard: a freshly-joined player might not have a fully-populated state yet.
    if (!state) state = {};
    if (!state.ancestry) state.ancestry = { name: '', speed: 3, traits: [], flaws: [] };
    if (!state.ancestry.traits) state.ancestry.traits = [];
    if (!state.ancestry.flaws)  state.ancestry.flaws  = [];
    if (!state.skillsTrained)   state.skillsTrained = {};
    if (!state.items)           state.items = [];
    if (!state.baseStats)       state.baseStats = {};
    let calc = {
        scores: {}, mods: {}, skills: {},
        ac: 10, dr: 0, er: 0, speed: (state.ancestry.speed || 3),
        maxAp: 6, sizeMultBoost: 0, lucAc: false, init: 10, useIntInit: false,
        bonusMeleeAtk: 0, bonusMeleeDmg: 0, bonusRangedAtk: 0, bonusRangedDmg: 0,
        hasArmorDisadvantage: false, maxHpPenalty: 0,
        speedForcedZero: false, apForcedZero: false,
        disadv: {
            atkGeneral: [], atkMelee: [], atkRangedAdv: [],
            saveByAttr: { STR: [], AGI: [], CON: [], PER: [], INT: [], CHA: [], LUC: [] },
            checkByAttr: { STR: [], AGI: [], CON: [], PER: [], INT: [], CHA: [], LUC: [] },
            autoFailSaveByAttr: { STR: [], AGI: [], CON: [], PER: [], INT: [], CHA: [], LUC: [] }
        }
    };

    if (state.ancestry.traits.includes('t_sens')) calc.skills['Notice'] = (calc.skills['Notice'] || 0) + 5;
    let tArmCount = state.ancestry.traits.filter(x => x === 't_arm').length;
    if (tArmCount) calc.ac += tArmCount;
    if (state.ancestry.traits.includes('t_load')) calc.sizeMultBoost += 1;
    let fragCount = state.ancestry.flaws.filter(x => x === 'f_frag').length;
    if (fragCount) calc.maxHpPenalty += 5 * fragCount;

    ATTRIBUTES.forEach(a => { calc.scores[a] = state.baseStats[a] + (state.ancestry.bonuses[a] || 0); });

    Object.keys(state.perks || {}).forEach(perkId => {
        let pDef = PERKS_DB.find(p => p.id === perkId);
        let rank = state.perks[perkId];
        let choices = (state.perkChoices || {})[perkId] || null;
        if (pDef && pDef.effect) pDef.effect(calc, rank, choices);
    });
    (state.ancestryBonusPerks || []).forEach(bp => {
        let bpDef = PERKS_DB.find(p => p.id === bp.perkId);
        if (bpDef && bpDef.effect) {
            let choices = bp.choice ? { 1: bp.choice } : null;
            bpDef.effect(calc, 1, choices);
        }
    });

    ATTRIBUTES.forEach(a => { calc.mods[a] = calc.scores[a] - 5; });

    // Custom equippable items: everything they add (js/apx-item-effects.js)
    let itemFx = window.apxItemEffects ? window.apxItemEffects(state) : { attr: {}, skill: {}, er: [], stat: {} };
    let fxStat = k => (itemFx.stat && itemFx.stat[k]) || 0;
    let customAc = fxStat('ac'), customDr = fxStat('dr'), customEr = fxStat('er');
    calc.speed += fxStat('speed');
    ATTRIBUTES.forEach(a => { if (itemFx.attr[a]) calc.scores[a] += itemFx.attr[a]; });
    Object.keys(itemFx.skill).forEach(t => {
        let sk = [...SKILLS, ...(state.customSkills || [])].find(x => x.name === t || x.id === t);
        let key = sk ? sk.id : t;
        calc.skills[key] = (calc.skills[key] || 0) + itemFx.skill[t];
    });
    // Recalculate mods after any attribute bonuses from items
    ATTRIBUTES.forEach(a => { calc.mods[a] = calc.scores[a] - 5; });

    let vitalHpRank = (state.perks || {})['con_vitality'] || 0;
    let maxHp = Math.max(5, (calc.scores.CON * 5) + (vitalHpRank * 5) + (state.xpHpBought || 0) - calc.maxHpPenalty + fxStat('maxHp'));

    let armor = state.equippedArmor || { wt: 0, ac: 0, dr: 0, er: 0 };
    let armorWt = armor.wt || 0, armorAc = (armor.ac||0)+customAc, armorDr = (armor.dr||0)+customDr, armorEr = (armor.er||0)+customEr;
    if (armor.speedMod) calc.speed += armor.speedMod;

    let reqStr = Math.floor(armorWt / 10);
    let meetsStr = calc.scores.STR >= reqStr;
    calc.hasArmorDisadvantage = (!meetsStr && armorWt > 0);

    let armorClass = armorWt === 0 ? null : (armorWt > 70 ? 'Heavily' : (armorWt > 30 ? 'Moderately' : 'Lightly'));
    let isHeavy = armorClass === 'Heavily';

    let agiCap = Infinity;
    if (isHeavy) agiCap = 0;
    else if (armorClass === 'Moderately') agiCap = 2;

    let amRank = (state.perks || {})["str_armormaster"] || 0;
    let amChoice = (state.perkChoices || {})['str_armormaster'] ? state.perkChoices['str_armormaster'][2] : null;
    let amMatchesChoice = amChoice && armorClass === amChoice;
    if (amRank >= 4 && amChoice === 'Moderately' && armorClass === 'Moderately') agiCap += 1;
    if (!meetsStr) { agiCap = 0; calc.speed -= 2; }

    // Fortunate Fighter Rank 1: LUC may replace AGI for AC -- the higher one is used
    let acAttrMod = calc.lucAc ? Math.max(calc.mods.AGI || 0, calc.mods.LUC || 0) : (calc.mods.AGI || 0);
    let allowedAgi;
    if (isHeavy) allowedAgi = 0;
    else if (acAttrMod < 0) allowedAgi = acAttrMod;
    else allowedAgi = Math.min(acAttrMod, agiCap);

    if (amRank >= 2 && amMatchesChoice) { calc.ac += 1; calc.dr += 1; }
    if (amRank >= 3 && armorClass !== null) calc.speed += 1;
    if (amRank >= 5 && amMatchesChoice && amChoice === 'Heavily') calc.dr += 3;

    if (armorWt === 0 && (state.perks || {})["con_defensive"]) {
        calc.ac += calc.mods.CON;
        calc.ac += state.perks["con_defensive"];
        calc.dr += state.perks["con_defensive"];
        calc.er += state.perks["con_defensive"];
    }
    calc.ac += allowedAgi + armorAc;
    calc.dr += Math.max(0, calc.mods.CON) + armorDr;
    let baseErMods = [calc.mods.AGI, calc.mods.PER, calc.mods.INT, calc.mods.CHA, calc.mods.LUC].map(v => Math.max(v, 0));
    calc.er += Math.max(...baseErMods) + armorEr;

    let tirelessRank = (state.perks || {})['gen_tireless'] || 0;
    let effectiveFatigue = Math.max(0, (state.fatigue || 0) - tirelessRank);
    calc.maxAp = calc.apForcedZero ? 0 : Math.max(0, Math.max(6, 6 + Math.floor(calc.mods.AGI / 2)) - effectiveFatigue + fxStat('maxAp'));   // 6 + half AGI mod (round down), min 6 — Sept 23, 2026 update

    // Passive Initiative (Ch.9): 10 + chosen AGI-or-PER modifier, plus
    // whatever flat bonuses perks like Twitchy already added to calc.init
    // via the generic effect loop above. Mirrors the character sheet's
    // own formula exactly (including that Tactical Mind's useIntInit flag
    // isn't actually consulted here -- that's the main sheet's existing
    // behavior, not something introduced for this summary).
    let initiative = 10 + (calc.mods[state.initStat] || 0) + (calc.init - 10) + fxStat('init');

    let dispSpeed = calc.speedForcedZero ? 0 : Math.max(0, calc.speed);

    let saves = {};
    ATTRIBUTES.forEach(a => {
        let trained = !!(state.savesTrained && state.savesTrained[a]);
        saves[a] = calc.mods[a] + (trained ? (state.trainingBonus || 2) : 0) + (window.apxItemSaveBonus ? window.apxItemSaveBonus(itemFx, a) : 0);
    });

    let trainedSkills = SKILLS.filter(s => state.skillsTrained && state.skillsTrained[s.id]).map(s => {
        let perkBonus = calc.skills[s.id] || 0;
        if (s.name === 'Notice' && calc.skills['Notice']) perkBonus = calc.skills['Notice'];
        return { name: s.name, total: calc.mods[s.attr] + (state.trainingBonus || 2) + perkBonus + (window.apxItemCheckBonus ? window.apxItemCheckBonus(itemFx, s.attr) : 0) };
    });
    (state.customSkills || []).filter(s => state.skillsTrained && state.skillsTrained[s.id]).forEach(s => {
        let perkBonus = s.name.startsWith('Encyclopedia') ? ((state.perks || {})['int_scholar'] || 0) : 0;
        trainedSkills.push({ name: s.name, total: calc.mods[s.attr] + (state.trainingBonus || 2) + perkBonus });
    });

    // Same unified per-energy-type net as the character sheet itself:
    // ancestry Resistance/Vulnerability and every equipped item's ER
    // bonus all combine into one number per type before display, rather
    // than three separate, uncoordinated lists.
    let envByType = {};
    function ensureEnvType(t) {
        if (!envByType[t]) envByType[t] = { net: 0, immune: false, sources: [] };
        return envByType[t];
    }
    (state.ancestryEnvResistances || []).forEach(e => {
        if (!e.type) return;
        let t = ensureEnvType(e.type);
        if (e.immune) t.immune = true; else t.net += 5;
    });
    (state.ancestryEnvVulnerabilities || []).forEach(e => {
        if (!e.type) return;
        ensureEnvType(e.type).net -= 5;
    });
    (state.items || []).forEach(item => {
        if (!(item.isCustomEquippable && item.equipped && item.bonuses)) return;
        (item.bonuses.erBonuses || []).forEach(row => {
            if (!row.target || !row.amount) return;
            let t = ensureEnvType(row.target);
            t.net += row.amount;
            if (!t.sources.includes(item.name)) t.sources.push(item.name);
        });
    });
    let envLines = Object.keys(envByType).map(type => {
        let t = envByType[type];
        let sourceNote = t.sources.length ? ` (${t.sources.join(', ')})` : '';
        if (t.immune) return { html: `<span class="text-emerald-400 font-bold">${type}: Immune</span>${sourceNote}` };
        if (t.net > 0) return { html: `<span class="text-cyan-300">${type}: ER +${t.net}</span>${sourceNote}` };
        if (t.net < 0) return { html: `<span class="skill-mod-negative font-bold">${type}: Vulnerable (+${-t.net} dmg taken)</span>${sourceNote}` };
        return null;
    }).filter(Boolean).map(l => l.html);

    return {
        name: state.name || 'Unnamed', ancestryName: state.ancestry.name || 'Unknown',
        ac: calc.ac, dr: calc.dr, er: calc.er, maxHp, currentHp: state.currentHp, tempHp: state.tempHp || 0,
        ap: calc.maxAp, speed: dispSpeed, initiative, mods: calc.mods, saves,
        trainedSkills, hasArmorDisadvantage: calc.hasArmorDisadvantage,
        fatigue: state.fatigue || 0, luckPts: state.luckPts || 0,
        woundThreshold: ((calc.scores.CON || 0) * 2) + (calc.wtBoost || 0) + fxStat('wt'),
        envLines,
    };
}
window.computeCharSummary = computeCharSummary;

// ------------------------------------------------------------------
// Party roster: load a folder of character JSON files (same File System
// Access pattern as the character roster), compute each one's summary.
// ------------------------------------------------------------------
window.gmParty = []; // [{fileName, state, summary}]

window.loadGmPartyFolder = async function() {
    try {
        let dirHandle = await window.showDirectoryPicker({ mode: 'read' });
        let loaded = [];
        for await (const entry of dirHandle.values()) {
            if (entry.kind === 'file' && entry.name.endsWith('.json')) {
                try {
                    const file = await entry.getFile();
                    const text = await file.text();
                    const charData = JSON.parse(text);
                    if (!charData.baseStats || !charData.ancestry) continue;
                    loaded.push({ fileName: entry.name, state: charData, summary: computeCharSummary(charData) });
                } catch (e) {
                    console.warn("Skipping invalid character file:", entry.name, e);
                }
            }
        }
        window.gmParty = loaded;
        window.renderGmScreen();
    } catch (err) {
        console.error(err);
        window.showConfirm("Folder access was denied or is restricted in this browser.", null, true);
    }
};

window.openLoadPartyModal = function() {
    let status = document.getElementById('loadPartyStatus');
    if (status) status.classList.add('hidden');
    window.openModal('loadPartyModal');
};

window.loadGmPartyFromCloud = async function() {
    let statusEl = document.getElementById('loadPartyStatus');
    let showStatus = (msg, color) => {
        if (!statusEl) return;
        statusEl.classList.remove('hidden');
        statusEl.style.color = color || '';
        statusEl.innerText = msg;
    };

    if (!window.apxAuth?.enabled || !window.apxAuth.user) {
        showStatus('Sign in to load players from the cloud.', 'var(--c-red,#ef4444)');
        return;
    }

    // Find invite code — auto-select the one active world if only one exists
    let activeWorldId = typeof _activeWorldId !== 'undefined' ? _activeWorldId : null;
    let worlds = typeof _gmWorlds !== 'undefined' ? _gmWorlds : [];
    let activeWorld = worlds.find(w => (w.worldId || w.id) === activeWorldId);

    // Auto-use the only world if the GM hasn't explicitly selected one
    if (!activeWorld && worlds.length === 1) {
        activeWorld = worlds[0];
        if (typeof window.switchGmWorld === 'function') window.switchGmWorld(activeWorld.worldId || activeWorld.id);
    }

    let inviteCode = activeWorld?.inviteCode;

    if (!inviteCode) {
        let msg = worlds.length === 0
            ? 'No worlds yet. Create a world in the World tab first.'
            : 'Select a world in the World tab, then try again.';
        showStatus(msg, 'var(--c-red,#ef4444)');
        return;
    }

    try {
        showStatus('Fetching players who joined with code ' + inviteCode + '...');
        let players = await window.apxAuth.loadWorldPlayers(inviteCode);
        if (!players.length) {
            showStatus('No players have joined with this invite code yet.', '#94a3b8');
            return;
        }
        // charState (new field name) || state (old field name) || fallback
        let newEntries = players.map(p => {
            let state = p.charState || p.state || { name: p.charName || 'Unknown Player' };
            return { fileName: p.uid, state, summary: computeCharSummary(state) };
        });
        newEntries.forEach(e => {
            if (!window.gmParty.find(p => p.fileName === e.fileName)) window.gmParty.push(e);
        });
        showStatus(`Loaded ${newEntries.length} player(s) from world ${inviteCode}.`, 'var(--c-emerald,#34d399)');
        window.renderGmScreen();
        // Start real-time listener so party auto-updates when players save
        startPartyListener(inviteCode);
        setTimeout(() => window.closeModal('loadPartyModal'), 1500);
    } catch(e) {
        showStatus('Error: ' + e.message, 'var(--c-red,#ef4444)');
    }
};


// ── Real-time party listener ──────────────────────────────────────────────
// Subscribes to worldCodes/{inviteCode}/players/* so the GM's party panel
// refreshes automatically whenever a player saves their character.
let _partyUnsubscribe = null;

function startPartyListener(inviteCode) {
    if (_partyUnsubscribe) { _partyUnsubscribe(); _partyUnsubscribe = null; }
    if (!inviteCode || !window.apxAuth?.enabled) return;
    if (typeof window.apxAuth.listenWorldPlayers !== 'function') return;
    _partyUnsubscribe = window.apxAuth.listenWorldPlayers(inviteCode, players => {
        let changed = false;
        players.forEach(p => {
            // Loyal Companion HP from the player's sheet
            {
                let cs = (p.charState || p.state || {}).companion;
                if (cs && cs.currentHp !== undefined && cs.currentHp !== null) {
                    let gmC = p._gmCompHp, gmAt = gmC?.at?.toMillis ? gmC.at.toMillis() : 0, savAt = p.updatedAt?.toMillis ? p.updatedAt.toMillis() : 0;
                    let hp = (gmC && gmC.hp !== undefined && gmAt >= savAt) ? gmC.hp : cs.currentHp;
                    (window.gmInitiative || []).forEach(e => {
                        if (e.companionOf !== p.uid || e.currentHp === hp) return;
                        let before = e.currentHp || 0, wasUp = before > 0;
                        e.currentHp = Math.max(0, Math.min(e.maxHp || hp, hp));
                        _gmLogHpChange(e, before, e.currentHp, wasUp);
                        if (typeof window.renderInitiativeTracker === 'function') window.renderInitiativeTracker();
                    });
                }
            }
            if (Array.isArray(p._rollLog)) {
                window._gmPlayerRollLogs[p.uid] = p._rollLog;
                p._rollLog.forEach(ev => _gmHandleRollEvent(p.uid, ev));
            }
            let state = p.charState || p.state;
            // Battle token positions are handled by APXBattle's own listener (js/apx-battlemap.js)
            if (!state) return;
            // HP authority: if the GM's last HP write (_gmHp) is newer than the player's last
            // save, the sheet data here is STALE (the player hasn't received it yet) — use the
            // GM's values. Without this, a Revive to 1 HP was instantly overwritten by the
            // sheet's old 0 HP, which re-triggered the bleed-out prompt.
            let gm = p._gmHp;
            if (gm && gm.hp !== undefined) {
                let gmAt  = gm.at?.toMillis ? gm.at.toMillis() : Infinity;   // null = our own pending write
                let savAt = p.updatedAt?.toMillis ? p.updatedAt.toMillis() : 0;
                if (gmAt >= savAt) state = { ...state, currentHp: gm.hp, tempHp: gm.tempHp ?? state.tempHp };
            }
            // Update the party panel
            let entry = window.gmParty.find(x => x.fileName === p.uid);
            if (entry) {
                entry.state   = state;
                entry.summary = computeCharSummary(state);
                entry.summary.charPortrait = state.charPortrait || null;
                changed = true;
            } else {
                let summ = computeCharSummary(state);
                summ.charPortrait = state.charPortrait || null;
                window.gmParty.push({ fileName: p.uid, state, summary: summ });
                changed = true;
            }
            // Also update any matching initiative tracker entry's HP/TempHP so the
            // tracker stays in sync when a player heals, takes damage, or gains temp HP.
            let newHp    = state.currentHp;
            let newTempHp= state.tempHp || 0;
            if (newHp !== undefined) {
                (window.gmInitiative||[]).forEach(e => {
                    if (e.playerUid === p.uid) {
                        // Just revived: ignore a stale "0 HP" from the sheet until it catches up
                        if (e._reviveHoldUntil) {
                            if (newHp > 0 || Date.now() > e._reviveHoldUntil) delete e._reviveHoldUntil;
                            else return;
                        }
                        let wasUp = e.currentHp === null || e.currentHp > 0;
                        let before = (e.currentHp || 0) + (e.tempHp || 0), after = (newHp || 0) + (newTempHp || 0);
                        let hpChanged = e.currentHp !== null && (e.currentHp !== newHp || (e.tempHp || 0) !== newTempHp);
                        // Player's own sheet took them to 0 → start bleeding out (not dead)
                        let dropped = wasUp && newHp <= 0 && e.faction === 'player' && e.bleedOutTurns == null;
                        // (their sheet's roller asks for the CON (Survive) check; the popup is only for untracked players)
                        if (dropped && !(e.playerUid && window.gmCombatStarted)) setTimeout(() => window.openBleedOutModal(e.id), 0);
                        if (newHp > 0) { if (e.bleedOutTurns != null) _gmSetPlayerCondition(e, 'bleedingout', false); e.bleedOutTurns = null; e.stabilized = false; }
                        e.currentHp = newHp;
                        e.tempHp    = newTempHp;
                        // Damage the player applied on their own sheet: log it, and check their
                        // Wound Threshold (queued before the Bleed Out roll)
                        if (hpChanged && before !== after) {
                            // Damage right after an NPC's attack roll: that attack's hit (weapon properties apply)
                            let hit = before > after && window.gmCombatStarted ? _gmTakeHit(e) : null;
                            let extras = hit ? _gmHitExtraDamage(e, hit) : [];
                            let extra = extras.reduce((t, x) => t + x.n, 0);
                            if (extra > 0) {
                                let r2 = window.apxApplyHpInput('-' + extra, e.currentHp, e.tempHp, e.maxHp);
                                if (r2) { e.currentHp = r2.currentHp; e.tempHp = r2.tempHp; after = (e.currentHp || 0) + (e.tempHp || 0); _syncHpToPlayer(e); }
                            }
                            // Healing from the player's own sheet says where it came from (a rest, Recover…)
                            let note = state.hpNote, why = null;
                            if (after > before && note && note.t && Date.now() - note.t < 120000 && e._hpNoteT !== note.t) { why = note.text; e._hpNoteT = note.t; }
                            _gmLogHpChange(e, before, after, wasUp, before - after, hit, why);
                            if (before > after) _gmCheckWoundThreshold(e, before - after);   // Wound Threshold first,
                            if (hit) _gmHitEffects(e, hit, extras);                          // the hit's own saves,
                            if (dropped) _gmQueueBleed(e);                                     // then Bleed Out
                        }
                        e.maxHp     = computeCharSummary(state).maxHp;
                        changed     = true;
                    }
                });
            }
        });
        if (changed) {
            window.renderGmScreen();
            if (typeof window.renderInitiativeTracker === 'function') window.renderInitiativeTracker();
        }
    });
}
window.startPartyListener = startPartyListener;

function statBadge(label, value, colorClass) {
    return `<div class="text-center bg-slate-900 rounded border border-slate-700 py-1"><div class="text-[8px] text-slate-500 uppercase font-bold">${label}</div><div class="text-sm font-black ${colorClass || 'text-white'}">${value}</div></div>`;
}

// Loyal Companion strip under its owner in the party panel
function _gmCompanionRow(p, idx) {
    let csb = gmCompanionSb(p); if (!csb) return '';
    let uid = String(p.fileName || '').replace(/'/g, '');
    let esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    let img = csb.portrait ? `<img src="${csb.portrait}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:2px solid #16a34a;">`
        : `<div style="width:28px;height:28px;border-radius:50%;background:#14532d;border:2px solid #16a34a;display:flex;align-items:center;justify-content:center;font-weight:900;color:#bbf7d0;font-size:.75rem">${esc((csb.name || 'C')[0])}</div>`;
    return `<div style="border-top:1px solid #1e293b;background:#052e16;padding:0.4rem 0.75rem;display:flex;align-items:center;gap:0.5rem;">
        ${img}
        <div style="flex:1;min-width:0;cursor:pointer" onclick="window.gmOpenCompanionStatBlock('${uid}')" title="Open the companion's stat block">
            <div style="font-size:0.75rem;font-weight:900;color:#bbf7d0">${esc(csb.name)} <span style="font-size:.58rem;color:#86efac;font-weight:700">Loyal Companion · Tier ${csb.tier}</span></div>
            <div style="font-size:0.6rem;color:#a7f3d0">HP ${csb.currentHp}/${csb.maxHp} · AC ${csb.ac} · DR ${csb.dr} / ER ${csb.er} · AP ${csb.ap}</div>
        </div>
        <button onclick="window.addToInitiative(${idx}, 'companion')" class="text-[9px] px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-bold">+ Initiative</button>
    </div>`;
}
window.gmOpenCompanionStatBlock = function(uid) {
    let p = (window.gmParty || []).find(x => x.fileName === uid); if (!p) return;
    let csb = gmCompanionSb(p); if (!csb || !window.openFloatingStatBlockRaw) return;
    window.openFloatingStatBlockRaw('comp_' + uid, `${csb.name} (${p.summary?.name || 'player'}'s companion)`, window.buildStatBlockHtml(csb, false));
};

window.renderGmScreen = function() {
    try { window.renderGmLoot && window.renderGmLoot(); } catch (e) { }
    let body = document.getElementById('gmScreenBody');
    if (!body) return;
    if (!window.gmParty.length) {
        body.innerHTML = '<div class="text-xs text-slate-500 text-center py-6">No party loaded yet. Click "Load Party" to pull from the active world or load from exported files.</div>';
        return;
    }
    body.innerHTML = window.gmParty.map((p, idx) => {
        let s = p.summary;
        // Same full stat block as double-clicking the player's token
        let sb = typeof window._gmPlayerStatBlock === 'function' ? window._gmPlayerStatBlock(p, s.name) : null;
        if (sb) {
            let uid = String(p.fileName || '').replace(/'/g, '');
            return `
            <div class="rounded-lg mb-2 overflow-hidden" style="background:#0f172a;border:1px solid #6366f1;">
                <div style="background:#1e1b4b;padding:0.5rem 0.75rem;display:flex;align-items:center;gap:0.6rem;">
                    ${sb.portrait}
                    <div style="flex:1;min-width:0;cursor:pointer;" onclick="window._btOpenPlayerSummary && window._btOpenPlayerSummary('${String(s.name).replace(/'/g, '')}','${uid}')" title="Open in its own window">
                        <div style="font-size:0.85rem;font-weight:900;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${sb.name}</div>
                        <div style="font-size:0.58rem;color:#818cf8;">${sb.subtitle}${s.hasArmorDisadvantage ? ' <span style="color:#f87171;font-weight:700">(Armor STR not met)</span>' : ''}</div>
                    </div>
                    <button onclick="window.addToInitiative(${idx}, 'party')" class="text-[9px] px-2 py-1 rounded bg-indigo-700 hover:bg-indigo-600 text-white font-bold">+ Initiative</button>
                </div>
                ${sb.body}
                ${_gmCompanionRow(p, idx)}
            </div>`;
        }
        let hpPct = s.maxHp > 0 ? Math.max(0, Math.min(100, (s.currentHp / s.maxHp) * 100)) : 0;
        let hpColor = hpPct > 50 ? 'bg-emerald-600' : (hpPct > 20 ? 'bg-amber-600' : 'bg-red-600');
        return `
            <div class="bg-slate-900 border border-slate-700 rounded-lg p-3 mb-2">
                <div class="flex justify-between items-center mb-2">
                    <div>
                        <div class="text-sm font-black text-emerald-300">${s.name}</div>
                        <div class="text-[9px] text-slate-500">${s.ancestryName}${s.hasArmorDisadvantage ? ' <span class="text-red-400 font-bold">(Armor STR not met)</span>' : ''}</div>
                    </div>
                    <button onclick="window.addToInitiative(${idx}, 'party')" class="text-[9px] px-2 py-1 rounded bg-indigo-700 hover:bg-indigo-600 text-white font-bold">+ Initiative</button>
                </div>
                <div class="mb-2">
                    <div class="flex justify-between text-[9px] text-slate-400 mb-0.5"><span>HP</span><span>${s.currentHp} / ${s.maxHp}${s.tempHp ? ` (+${s.tempHp} temp)` : ''}</span></div>
                    <div class="w-full h-2 bg-slate-800 rounded overflow-hidden"><div class="h-full ${hpColor}" style="width:${hpPct}%"></div></div>
                </div>
                <div class="grid grid-cols-7 gap-1 mb-2">
                    ${statBadge('AC', s.ac)}
                    ${statBadge('DR', s.dr)}
                    ${statBadge('ER', s.er)}
                    ${statBadge('AP', s.ap)}
                    ${statBadge('Speed', s.speed)}
                    ${statBadge('Init', s.initiative, 'text-blue-300')}
                    ${statBadge('Fatigue', s.fatigue, s.fatigue > 0 ? 'text-red-400' : 'text-white')}
                </div>
                ${s.envLines.length ? `<div class="text-[9px] text-slate-400 mb-2">Energy Resistances: ${s.envLines.join(', ')}</div>` : ''}
                <div class="grid grid-cols-7 gap-1 mb-2">
                    ${ATTRIBUTES.map(a => `<div class="text-center bg-slate-800 rounded py-0.5"><div class="text-[7px] text-slate-500 font-bold">${a}</div><div class="text-[10px] font-black text-white">${s.mods[a] >= 0 ? '+' : ''}${s.mods[a]}</div></div>`).join('')}
                </div>
                <details class="text-[10px]">
                    <summary class="cursor-pointer text-slate-400 font-bold select-none">Saving Throws &amp; Trained Skills</summary>
                    <div class="grid grid-cols-7 gap-1 mt-1 mb-1">
                        ${ATTRIBUTES.map(a => `<div class="text-center bg-slate-800 rounded py-0.5"><div class="text-[7px] text-slate-500 font-bold">${a} Save</div><div class="text-[10px] font-black text-blue-300">${s.saves[a] >= 0 ? '+' : ''}${s.saves[a]}</div></div>`).join('')}
                    </div>
                    <div class="flex flex-wrap gap-1">
                        ${s.trainedSkills.length ? s.trainedSkills.map(sk => `<span class="bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-300">${sk.name} <span class="text-emerald-400 font-bold">${sk.total >= 0 ? '+' : ''}${sk.total}</span></span>`).join('') : '<span class="text-slate-600">None trained</span>'}
                    </div>
                </details>
            </div>
        `;
    }).join('');
};

// ------------------------------------------------------------------
// Initiative tracker.
//
// window.gmInitiative stores each entry's RAW initiative (baseInitiative)
// separately from a per-creature "surprised" toggle -- effInit() computes
// the effective score (-10 if surprised) used everywhere for sorting and
// display, so toggling Surprised after the fact doesn't require touching
// the stored roll.
//
// Before Start Combat is pressed, new entries insert themselves into
// sorted position automatically. After combat starts, order is locked in
// and new arrivals join at the bottom, joining wherever the fight has
// gotten to rather than jumping the queue.
//
// "Whose turn it is" is a pointer (gmCurrentTurnIdx) into that array, not
// a reordering of the array itself -- the display simply starts
// rendering from that pointer and wraps around, so the current turn
// always visually appears pinned at the top without the underlying data
// ever needing to be shuffled.
// ------------------------------------------------------------------
window.gmInitiative = []; // [{id, name, baseInitiative, surprised, currentHp, maxHp, tempHp, ap, faction, bleedOutTurns, tpValue}]
window.gmCurrentTurnIdx = 0;
window.gmCombatStarted = false;
window.gmRoundNumber = 1;
window.gmTurnNumber = 1;
window.gmPendingXp = 0; // accumulated from defeated non-players, paid out (divided evenly) at End Combat

const FACTION_STYLES = {
    player:  { border: 'border-blue-500',   bg: 'bg-blue-950/40',   text: 'text-blue-300',   label: 'Player'  },
    enemy:   { border: 'border-red-500',    bg: 'bg-red-950/40',    text: 'text-red-300',    label: 'Enemy'   },
    ally:    { border: 'border-green-500',  bg: 'bg-green-950/40',  text: 'text-green-300',  label: 'Ally'    },
    neutral: { border: 'border-slate-500',  bg: 'bg-slate-800/60',  text: 'text-slate-300',  label: 'Neutral' },
};

function effInit(e) { return e.baseInitiative - (e.surprised ? 10 : 0); }

// PCs automatically win initiative ties against non-PCs (no manual
// resolution needed); everything else (PC-vs-PC, NPC-vs-NPC) is a true
// tie the GM breaks manually with the up/down arrows.
function initiativeCompare(a, b) {
    let ea = effInit(a), eb = effInit(b);
    if (ea !== eb) return eb - ea;
    let aP = a.faction === 'player', bP = b.faction === 'player';
    if (aP && !bP) return -1;
    if (bP && !aP) return 1;
    return 0;
}
function isAutoResolvedTie(a, b) {
    let aP = a.faction === 'player', bP = b.faction === 'player';
    return aP !== bP; // exactly one is a player -- already resolved by sort, no arrows needed
}

// Gets a specific NPC's stat block by id without disturbing whichever NPC
// is currently open in the builder (companionStatBlock() always reads
// through ncActiveCompanion(), so this briefly repoints it and restores
// the previous target/id afterward).
function ncStatBlockFor(npcId) {
    let savedTarget = ncTarget, savedId = ncActiveGmNpcId;
    ncTarget = 'gm';
    ncActiveGmNpcId = npcId;
    let sb = window.companionStatBlock();
    ncTarget = savedTarget;
    ncActiveGmNpcId = savedId;
    if (sb) sb._npcId = npcId;   // lets attack rolls find this creature in initiative (AP)
    return sb;
}

function nextAddFaction() {
    let el = document.getElementById('nextAddFaction');
    return el ? el.value : 'neutral';
}

// Before combat starts, keep the list auto-sorted as things are added.
// Once combat is underway, new arrivals go to the bottom of the order
// instead, so they don't jump the current round's queue.
function insertInitiativeEntry(entry) {
    if (!window.gmCombatStarted) {
        let insertIdx = window.gmInitiative.findIndex(e => initiativeCompare(entry, e) < 0);
        if (insertIdx === -1) insertIdx = window.gmInitiative.length;
        window.gmInitiative.splice(insertIdx, 0, entry);
        if (insertIdx <= window.gmCurrentTurnIdx) window.gmCurrentTurnIdx++;
    } else {
        window.gmInitiative.push(entry);
    }
    window.renderInitiativeTracker();
}

window.gmLairSharedTraitKey = null; // the shared trait key, once an NPC carrying one joins combat
window.gmInLair = false; // GM-controlled: is this fight actually happening in that NPC's lair?

// Recomputes every enemy's lairTraitNote from scratch based on the current
// gmInLair toggle -- called whenever the toggle changes or a new enemy
// joins, so the note is always either on every enemy (in the lair) or on
// none of them (not in the lair), never stale from a previous state.
window.recomputeLairTraitNotes = function() {
    let note = null;
    if (window.gmInLair && window.gmLairSharedTraitKey) {
        let traitDef = NPC_TRAITS.find(t => t.key === window.gmLairSharedTraitKey);
        note = traitDef ? `${traitDef.label}: ${traitDef.desc}` : window.gmLairSharedTraitKey;
    }
    window.gmInitiative.forEach(e => { if (e.faction === 'enemy') e.lairTraitNote = note; });
    window.renderInitiativeTracker();
};
window.toggleInLair = function(checked) {
    window.gmInLair = checked;
    window.recomputeLairTraitNotes();
};

// A player's Loyal Companion, built from their sheet (the stat math reads window.state,
// so it's pointed at that player's character for the moment it takes)
function gmCompanionSb(pm) {
    if (!pm || !pm.state || !pm.state.companion || typeof window.companionStatBlock !== 'function') return null;
    let keepState = window.state, keepT = typeof ncTarget !== 'undefined' ? ncTarget : null;
    try {
        window.state = JSON.parse(JSON.stringify(pm.state));
        ncTarget = 'companion';
        let sb = window.companionStatBlock();
        if (sb) { sb.portrait = pm.state.companion.portrait || ''; sb._compOwner = pm.fileName; }
        return sb;
    } catch (e) { console.warn('Companion stat block:', e); return null; }
    finally { window.state = keepState; if (keepT !== null) ncTarget = keepT; }
}
window.gmCompanionSb = gmCompanionSb;

window.addToInitiative = function(sourceIdx, sourceType, faction, displayName) {
    let entry;
    if (sourceType === 'companion') {
        // A player's Loyal Companion: fights on the party's side, HP lives on the player's sheet
        let p = window.gmParty[sourceIdx];
        let sb = gmCompanionSb(p);
        if (!sb) return;
        let hp = p.state.companion.currentHp ?? sb.maxHp;
        entry = { id: crypto.randomUUID(), name: sb.name || 'Companion', baseInitiative: sb.initiative, surprised: false,
            currentHp: Math.min(hp, sb.maxHp), maxHp: sb.maxHp, tempHp: 0, ap: sb.ap, ac: sb.ac, dr: sb.dr, er: sb.er,
            faction: 'ally', bleedOutTurns: null, tpValue: 0, lairTraitNote: null, companionOf: p.fileName };
    } else if (sourceType === 'party') {
        let p = window.gmParty[sourceIdx];
        entry = { id: crypto.randomUUID(), name: p.summary.name, baseInitiative: p.summary.initiative, surprised: false,
            currentHp: p.summary.currentHp, maxHp: p.summary.maxHp, tempHp: p.summary.tempHp || 0,
            ap: p.summary.ap, ac: p.summary.ac, dr: p.summary.dr, er: p.summary.er,
            faction: 'player', bleedOutTurns: null, tpValue: 0, lairTraitNote: null,
            playerUid: p.fileName };
    } else if (sourceType === 'npc') {
        let n = window.gmNpcs[sourceIdx];
        let sb = ncStatBlockFor(n.id);
        let resolvedFaction = faction || nextAddFaction();
        // Use displayName (world NPC name) if provided, otherwise fall back to stat block name
        let entryName = displayName || sb.name;
        entry = { id: crypto.randomUUID(), name: entryName, baseInitiative: sb.initiative, surprised: false, currentHp: sb.maxHp, maxHp: sb.maxHp, tempHp: 0, ap: sb.ap, ac: sb.ac, dr: sb.dr, er: sb.er, faction: resolvedFaction, bleedOutTurns: null, tpValue: window.npcXpForTier(npcTierForTP(n.npc.gmTpBudget || 0).tier), sourceNpcId: n.id, hasLairActions: !!n.npc.lairActions, lairTraitNote: null, powerUsage: {} };
        // Limited-use powers (Charges or Recharge) get their own tracked
        // usage on the initiative entry itself, independent of the NPC's
        // own saved data -- so two copies of the same monster in the same
        // fight track their charges separately, and closing the tracker
        // doesn't burn a real charge off the NPC's master sheet.
        sb.powerCards.concat(sb.lairActionPowerCards).forEach((p, i) => {
            if (p.usageType === 'charges' || p.usageType === 'recharge') {
                entry.powerUsage[p.name] = 0;
            }
        });

        if (n.npc.lairSharedTraitKey) window.gmLairSharedTraitKey = n.npc.lairSharedTraitKey;
    } else {
        return;
    }
    entry.baseName = String(entry.name||'').replace(/\s+#?\d+$/, '').trim() || entry.name;

    // Link to its battle token FIRST, so the tracker never renders it as unlinked.
    //  - from a token (right-click, dbl-click, All to Init): that exact token
    //  - from the tracker panel: the matching token on the map, found automatically
    if (window._pendingTokenInitLink) {
        let { mapId, tokenId } = window._pendingTokenInitLink;
        window._pendingTokenInitLink = null;
        let linkMap = (typeof _wNotes !== 'undefined' ? _wNotes.otherMaps||[] : []).find(m=>m.id===mapId);
        let linkTok = linkMap?.battleTokens?.find(t=>t.id===tokenId);
        if (linkTok) { linkTok.initiativeId = entry.id; linkTok._explicitDead = false; }
        if (linkTok && entry.conditions?.length && linkTok.type !== 'player') { linkTok.conditions = [...new Set([...(linkTok.conditions||[]), ...entry.conditions])]; entry.conditions = []; }
    } else if (typeof window._btAutoLinkEntry === 'function') {
        window._btAutoLinkEntry(entry);
    }

    insertInitiativeEntry(entry);
    if (typeof window._gmRenumber === 'function') window._gmRenumber();
    window.recomputeLairTraitNotes();   // re-renders the tracker with final names/links
    if (typeof window._btRefreshAllOpenMaps === 'function') window._btRefreshAllOpenMaps();
    if (typeof window.saveWorldNotes === 'function') window.saveWorldNotes();

    return entry;
};

// Deliberately does NOT clear the form afterward -- a GM adding a group
// of the same monster (several goblins, etc.) wants to click Add
// repeatedly, not retype everything each time. Matching names get an
// automatic " 2", " 3"... suffix so the list stays distinguishable.
window.addQuickNpc = function() {
    let name = (document.getElementById('quickNpcName').value || '').trim();
    if (!name) return;
    let init = parseInt(document.getElementById('quickNpcInit').value) || 0;
    let hp = document.getElementById('quickNpcHp').value;
    let ap = document.getElementById('quickNpcAp').value;

    let displayName = name;   // numbering (Name / Name 1, Name 2…) is handled by _gmRenumber

    let resolvedFaction = nextAddFaction();
    let entry = {
        id: crypto.randomUUID(), name: displayName, baseInitiative: init, surprised: false,
        currentHp: hp !== '' ? parseInt(hp) : null,
        maxHp: hp !== '' ? parseInt(hp) : null,
        tempHp: 0,
        ap: ap !== '' ? parseInt(ap) : null,
        faction: resolvedFaction, bleedOutTurns: null,
        tpValue: 0, // quick-add NPCs have no formal Tier, so they don't contribute to the end-of-combat XP pool
        lairTraitNote: null, baseName: name,
    };
    insertInitiativeEntry(entry);
    if (typeof window._gmRenumber === 'function') window._gmRenumber();
    window.recomputeLairTraitNotes();
};

// ------------------------------------------------------------------
// Saved NPC picker: a searchable/sortable popup rather than a dropdown,
// since a GM's NPC roster can grow large.
// ------------------------------------------------------------------
// Clicking the active sort again reverses it; an arrow marks the active sort and its direction.
let savedNpcSort = 'name', savedNpcSortDir = 1;   // 1 = natural order (A–Z, highest first), -1 = reversed

window.openSavedNpcPickerModal = function() {
    savedNpcSort = 'name'; savedNpcSortDir = 1;
    document.getElementById('savedNpcSearch').value = '';
    window.renderSavedNpcPickerList();
    window.openModal('savedNpcPickerModal');
};

window.setSavedNpcSort = function(mode) {
    if (savedNpcSort === mode) savedNpcSortDir = -savedNpcSortDir;
    else { savedNpcSort = mode; savedNpcSortDir = 1; }
    window.renderSavedNpcPickerList();
};

function _markSavedNpcSortButtons() {
    document.querySelectorAll('#savedNpcPickerModal .npc-sort-btn').forEach(b => {
        if (!b.dataset.label) b.dataset.label = b.textContent.trim();
        let on = b.dataset.sort === savedNpcSort;
        // Name reads A→Z first; numbers read highest first
        let arrow = !on ? '' : (b.dataset.sort === 'name' ? (savedNpcSortDir === 1 ? ' ▲' : ' ▼') : (savedNpcSortDir === 1 ? ' ▼' : ' ▲'));
        b.textContent = b.dataset.label + arrow;
        b.title = on ? (b.dataset.sort === 'name' ? (savedNpcSortDir === 1 ? 'A to Z (click for Z to A)' : 'Z to A (click for A to Z)') : (savedNpcSortDir === 1 ? 'Highest first (click for lowest first)' : 'Lowest first (click for highest first)')) : 'Sort by ' + b.dataset.label;
        b.style.background = on ? '#0e7490' : ''; b.style.boxShadow = on ? '0 0 0 1px #22d3ee inset' : '';
    });
}

window.renderSavedNpcPickerList = function() {
    let body = document.getElementById('savedNpcPickerList');
    if (!body) return;
    if (!window.gmNpcs.length) {
        body.innerHTML = '<div class="text-xs text-slate-500 text-center py-6">No saved NPCs yet. Build one from "NPCs & Enemies" first.</div>';
        return;
    }
    let search = (document.getElementById('savedNpcSearch').value || '').trim().toLowerCase();
    let rows = window.gmNpcs
        .map((n, idx) => ({ idx, npc: n.npc, sb: ncStatBlockFor(n.id), tier: npcTierForTP(n.npc.gmTpBudget || 0).tier }))
        .filter(r => !search || (r.npc.name || '').toLowerCase().includes(search));

    let sortFns = {
        name: (a, b) => (a.npc.name || '').localeCompare(b.npc.name || ''),
        ap: (a, b) => b.sb.ap - a.sb.ap,
        tier: (a, b) => b.tier - a.tier,
        STR: (a, b) => b.sb.mods.STR - a.sb.mods.STR,
        AGI: (a, b) => b.sb.mods.AGI - a.sb.mods.AGI,
        CON: (a, b) => b.sb.mods.CON - a.sb.mods.CON,
        PER: (a, b) => b.sb.mods.PER - a.sb.mods.PER,
        INT: (a, b) => b.sb.mods.INT - a.sb.mods.INT,
        CHA: (a, b) => b.sb.mods.CHA - a.sb.mods.CHA,
        LUC: (a, b) => b.sb.mods.LUC - a.sb.mods.LUC,
    };
    let sortFn = sortFns[savedNpcSort] || sortFns.name;
    rows.sort((a, b) => savedNpcSortDir * sortFn(a, b) || (a.npc.name || '').localeCompare(b.npc.name || ''));
    _markSavedNpcSortButtons();

    if (!rows.length) {
        body.innerHTML = '<div class="text-xs text-slate-500 text-center py-6">No NPCs match that search.</div>';
        return;
    }
    body.innerHTML = rows.map(r => `
        <div class="flex items-center justify-between bg-slate-900 border border-slate-700 rounded p-2">
            <div>
                <div class="text-sm font-bold text-purple-300">${r.npc.name || 'Unnamed'}</div>
                <div class="text-[9px] text-slate-500">Tier ${r.tier} &middot; Init ${r.sb.initiative} &middot; AP ${r.sb.ap} &middot; HP ${r.sb.maxHp}</div>
            </div>
            <div class="flex gap-1 items-center">
                <input type="text" class="saved-npc-display-name bg-slate-800 border border-slate-600 text-[10px] text-slate-200 rounded px-1.5 py-1 w-24" placeholder="Name (optional)" title="Override the stat block name for this token">
                <select class="saved-npc-faction bg-slate-800 border-slate-600 text-[10px]">
                    <option value="enemy">Enemy</option>
                    <option value="ally">Ally</option>
                    <option value="neutral">Neutral</option>
                </select>
                <button onclick="window.addSavedNpcFromPicker(${r.idx}, this)" class="text-[10px] px-2 py-1 rounded bg-purple-700 hover:bg-purple-600 text-white font-bold">Add</button>
            </div>
        </div>
    `).join('');
};

window.addSavedNpcFromPicker = function(npcIdx, btnEl) {
    let factionSel = btnEl.parentElement.querySelector('.saved-npc-faction');
    let nameSel    = btnEl.parentElement.querySelector('.saved-npc-display-name');
    let displayName = nameSel?.value?.trim() || undefined;
    window.addToInitiative(npcIdx, 'npc', factionSel.value, displayName);
};

// opts.dead = true  → killed (0 HP / bled out): its battle token turns grey (dead)
// otherwise         → just removed from combat: token stays alive, simply unlinked
window.removeFromInitiative = function(id, opts) {
    let idx = window.gmInitiative.findIndex(e => e.id === id);
    if (idx === -1) return;
    let wasCurrent = (idx === window.gmCurrentTurnIdx) && window.gmCombatStarted;
    if (opts?.dead) {
        if (typeof window._gmMarkTokenDead === 'function') window._gmMarkTokenDead(id);
        try { _gmCaptureLoot(window.gmInitiative[idx]); } catch (e) { console.warn('Loot capture:', e); }
    }
    else if (typeof window._gmUnlinkEntry === 'function') window._gmUnlinkEntry(id);
    window.gmInitiative.splice(idx, 1);
    if (typeof window._gmRenumber === 'function') window._gmRenumber();
    if (idx < window.gmCurrentTurnIdx) window.gmCurrentTurnIdx--;
    else if (wasCurrent) {
        window.gmCurrentTurnIdx = window.gmInitiative.length
            ? window.gmCurrentTurnIdx % window.gmInitiative.length : 0;
    }
    window.closeFloatingStatBlock(id);
    window.renderInitiativeTracker();
    if (typeof window._btRefreshAllOpenMaps === 'function') window._btRefreshAllOpenMaps();
    if (typeof window.saveWorldNotes === 'function') window.saveWorldNotes();
};

// Damage (a typed "-N") drains Temp HP first, with any leftover coming
// out of current HP -- healing or an absolute typed value goes straight
// to current HP and doesn't touch Temp HP, matching how Temp HP works on
// the character sheet itself. Non-players who hit 0 are removed
// immediately (their XP value is stashed for the End Combat payout);
// players get the Bleed Out prompt instead of being removed.
// Directly editing the Temp HP field itself, not damage passing through
// it -- same overflow-to-current-HP behavior as the character sheet's own
// Temp HP field for consistency.
// ---------------------------------------------------------------------------
// Loot: when a non-player NPC dies, everything it was carrying (weapons,
// armor, shield, helmet) goes on the GM's Loot list. From there the GM
// hands items (and Cu) out to party members, or asks the party for a
// LUC (Loot) check.
// ---------------------------------------------------------------------------
function _gmActiveCode() {
    let worlds = typeof _gmWorlds !== 'undefined' ? _gmWorlds : [];
    let w = worlds.find(w => (w.worldId||w.id) === (typeof _activeWorldId !== 'undefined' ? _activeWorldId : null));
    return w?.inviteCode || null;
}
window._gmActiveCode = _gmActiveCode;
function _gmLootList() {
    if (typeof _wNotes === 'undefined' || !_wNotes) return (window._gmLootFallback = window._gmLootFallback || []);
    if (!Array.isArray(_wNotes.loot)) _wNotes.loot = [];
    return _wNotes.loot;
}
// entry (optional): the initiative creature that died, so its used consumable charges count
function _gmNpcLootItems(npc, entry) {
    let items = [], clone = o => JSON.parse(JSON.stringify(o));
    // Carried items and consumables (NPC Crafter "Carried Items and Loot")
    (npc.carriedItems || []).forEach(l => {
        if (!l || !l.item) return;
        let it = clone(l.item);
        if (it.isConsumable) {
            let used = (entry && entry.carriedUsed && entry.carriedUsed[l.id]) || 0;
            it.chargesRemaining = Math.max(0, (it.chargesRemaining ?? it.charges ?? 1) - used);
            if (it.chargesRemaining <= 0) return;   // used up in the fight
        }
        items.push(it);
    });
    (npc.weapons || []).forEach(w => {
        let wd = clone(w); delete wd.aimed; delete wd.twoHanded;
        items.push({ name: w.name, wt: w.weight || 0, ct: 1, val: w.paidCost || 0, isWeapon: true, isLocked: true,
            weaponData: wd, desc: `Weapon: ${w.dmg} damage, ${w.ap} AP` });
    });
    let a = npc.equippedArmor;
    if (a && a.name) items.push({ name: a.name, wt: a.wt || 0, ct: 1, val: a.paidCost || 0, isArmor: true, isLocked: true,
        armorData: clone(a), desc: `Armor: +${a.ac} AC, +${a.dr} DR, +${a.er} ER` });
    if (npc.shield && npc.shield.owned) items.push({ name: 'Shield', wt: 6, ct: 1, val: 50, isShield: true, isLocked: true, desc: 'Shield: +2 AC/DR/ER' });
    if (npc.helmet && npc.helmet.owned) items.push({ name: 'Helmet', wt: 3, ct: 1, val: 30, isHelmet: true, isLocked: true, desc: 'Helmet: +1 AC/DR/ER' });
    return items;
}
window._gmNpcLootItems = _gmNpcLootItems;
// Enemies defeated since combat started (for the Currency loot roll: LUC × enemies ÷ 2)
function _gmLootDefeated() { return (typeof _wNotes !== 'undefined' && _wNotes) ? (_wNotes.lootDefeated || 0) : (window._gmLootDefeatedFb || 0); }
function _gmSetLootDefeated(n) {
    n = Math.max(0, parseInt(n) || 0);
    if (typeof _wNotes !== 'undefined' && _wNotes) _wNotes.lootDefeated = n; else window._gmLootDefeatedFb = n;
}
window.gmSetLootDefeated = function(n) { _gmSetLootDefeated(n); window.renderGmLoot(); if (typeof window.saveWorldNotes === 'function') window.saveWorldNotes(); };
function _gmCaptureLoot(entry) {
    if (!entry || entry.faction === 'player' || entry.companionOf) return;
    if (entry.faction === 'enemy') { _gmSetLootDefeated(_gmLootDefeated() + 1); window.renderGmLoot(); }
    if (!entry.sourceNpcId) return;
    let n = (window.gmNpcs || []).find(x => x.id === entry.sourceNpcId);
    if (!n || !n.npc) return;
    let items = _gmNpcLootItems(n.npc, entry);
    let cu = Math.max(0, parseInt(n.npc.carriedCu) || 0);
    if (!items.length && !cu) return;
    let list = _gmLootList();
    items.forEach(it => list.push({ id: crypto.randomUUID(), from: entry.name, item: it }));
    // Carried Currency lands in the Loot panel's Cu box, ready to give or split
    if (cu) {
        let form = window._gmLootCuForm || (window._gmLootCuForm = { amt: '', to: '' });
        form.amt = String((parseInt(form.amt) || 0) + cu);
    }
    let bits = [items.length ? `${items.length} item${items.length === 1 ? '' : 's'}` : '', cu ? `${cu} Cu` : ''].filter(Boolean).join(' and ');
    if (window.APXDice && APXDice.notify) APXDice.notify(`${entry.name} dropped ${bits} — see Loot.`, { kind: 'loot' });
    window.renderGmLoot();
}

// "Use" on a carried consumable (NPC stat block): 3 AP and one charge. In initiative the
// charge comes off that creature only (several goblins can share one stat block).
window.npcUseCarried = function(npcId, initId, itemId) {
    let n = (window.gmNpcs || []).find(x => x.id === npcId); if (!n || !n.npc) return;
    let l = (n.npc.carriedItems || []).find(x => x.id === itemId); if (!l || !l.item) return;
    let it = l.item, base = it.chargesRemaining ?? it.charges ?? 1;
    let list = (window.gmInitiative || []).filter(x => x.sourceNpcId === npcId && x.faction !== 'player');
    let cur = window.gmInitiative[window.gmCurrentTurnIdx];
    let e = (cur && list.includes(cur)) ? cur : (initId && list.find(x => x.id === initId)) || (list.length === 1 ? list[0] : null);
    let note = '';
    if (e) {
        e.carriedUsed = e.carriedUsed || {};
        let left = base - (e.carriedUsed[itemId] || 0);
        if (left <= 0) { window.apxAlert && window.apxAlert(`${e.name} has no ${it.name} left.`); return; }
        e.carriedUsed[itemId] = (e.carriedUsed[itemId] || 0) + 1;
        if (window.gmCombatStarted) {
            let have = gmApCurrent(e);
            if (have >= 3) { e.apCur = have - 3; note = ` (−3 AP, ${e.apCur} left)`; } else note = ` (not enough AP: has ${have})`;
        }
        if (typeof gmLog === 'function') gmLog({ text: `${_gmPublicName(e)} uses ${it.name}.`, gmText: `${e.name} uses ${it.name}${note}.`, kind: 'info' });
        window.renderInitiativeTracker();
    } else {
        // Outside initiative: comes off the stat block itself
        if (base <= 0) return;
        it.chargesRemaining = base - 1;
        if (window.apxAuth?.enabled) window.apxAuth.saveGmNpcs(window.gmNpcs || []).catch(() => {});
    }
    window.APXDice?.notify(`${e ? e.name : (n.npc.name || 'NPC')} used ${it.name}${note}.`, { kind: 'note' });
    window.refreshOpenStatBlocks && window.refreshOpenStatBlocks();
};
window._gmCaptureLoot = _gmCaptureLoot;

// Loot panel. What the GM picked in each dropdown (and the Cu box) is remembered, so
// handing one item out doesn't reset the others.
window._gmLootSel = window._gmLootSel || {};
window._gmLootCuForm = window._gmLootCuForm || { amt: '', to: '' };
window.renderGmLoot = function() {
    let el = document.getElementById('gmLootBody'); if (!el) return;
    let esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    let list = _gmLootList();
    let party = (window.gmParty || []).map(p => ({ uid: p.fileName, name: p.summary?.name || p.state?.name || 'Player' }));
    let sel = window._gmLootSel, form = window._gmLootCuForm;
    let partyIds = new Set(party.map(p => p.uid));
    let opts = cur => party.map(p => `<option value="${esc(p.uid)}" ${p.uid === cur ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
    let cnt = document.getElementById('gmLootCount'); if (cnt) cnt.textContent = list.length ? `(${list.length})` : '';
    let rolls = (window._gmLootRolls || []).slice(-8);
    let defeated = _gmLootDefeated();
    let cuFor = t => Math.max(0, Math.floor((t || 0) * defeated / 2));
    let kind = it => it.isWeapon ? 'Weapon' : it.isArmor ? 'Armor' : it.isShield ? 'Shield' : it.isHelmet ? 'Helmet' : 'Item';
    let stats = it => it.isWeapon ? `${it.weaponData?.dmg || ''}, ${it.weaponData?.ap || '?'} AP`
        : it.isArmor ? `+${it.armorData?.ac || 0} AC, +${it.armorData?.dr || 0} DR, +${it.armorData?.er || 0} ER`
        : it.isShield ? '+2 AC/DR/ER' : it.isHelmet ? '+1 AC/DR/ER' : (it.desc || '');
    // Group items by the creature they came from
    let groups = [];
    list.forEach(l => { let g = groups.find(x => x.from === (l.from || '')); if (!g) groups.push(g = { from: l.from || '', items: [] }); g.items.push(l); });
    let selCls = 'bg-slate-800 border border-slate-600 rounded text-[10px] text-white px-1 py-0.5';
    let head = t => `<div class="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">${t}</div>`;
    let itemsHtml = list.length ? groups.map(g => `
        <div class="mb-2">
            <div class="text-[10px] font-bold text-slate-400 mb-0.5">${g.from ? 'From ' + esc(g.from) : 'Other'}</div>
            ${g.items.map(l => {
                let cur = partyIds.has(sel[l.id]) ? sel[l.id] : '';
                return `<div class="grid items-center gap-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 mb-1" style="grid-template-columns:minmax(0,1fr) auto auto auto" data-loot="${esc(l.id)}">
                    <div class="min-w-0 leading-tight">
                        <span class="text-[11px] font-bold text-amber-200">${esc(l.item.name)}${l.item.ct > 1 ? ` ×${l.item.ct}` : ''}</span>
                        <span class="text-[9px] text-slate-500 ml-1">${kind(l.item)} · ${esc(stats(l.item))}</span>
                    </div>
                    <select class="gm-loot-to ${selCls}" style="width:6.5rem" onchange="window._gmLootSel['${esc(l.id)}']=this.value" ${party.length ? '' : 'disabled'}>
                        <option value="">Give to…</option>${opts(cur)}</select>
                    <button onclick="window.gmGiveLoot('${esc(l.id)}', this)" class="text-[10px] px-2 py-0.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-bold">Give</button>
                    <button onclick="window.gmDiscardLoot('${esc(l.id)}')" title="Not salvageable: remove it from the list" class="text-[10px] w-5 h-5 rounded bg-slate-700 hover:bg-red-800 text-slate-300 font-bold leading-none">✕</button>
                </div>`;
            }).join('')}
        </div>`).join('') : '<div class="text-[10px] text-slate-500 mb-2">Nothing yet. When an enemy dies, its weapons, armor, shield and helmet appear here. Use Loot Maker to create your own.</div>';
    let cuTo = form.to === '__split' || partyIds.has(form.to) ? form.to : '';
    el.innerHTML = `
        <div class="flex items-center justify-between mb-1">${head('Gear').replace('mb-1', 'mb-0')}
            <button onclick="window.openLootMaker({ kind: 'pool' })" class="text-[10px] px-2 py-0.5 rounded bg-indigo-700 hover:bg-indigo-600 text-white font-bold" title="Forge weapons and armor, pick gear or make custom items">+ Loot Maker</button></div>
        ${itemsHtml}
        <div class="border-t border-slate-700 pt-2 mt-1">
            ${head('Currency')}
            <div class="text-[10px] text-slate-400 mb-1.5">The party finds <b class="text-slate-200">LUC (Loot) × enemies defeated ÷ 2</b>, rounded down.</div>
            <div class="flex items-center gap-1.5 mb-1.5">
                <label class="text-[10px] text-slate-300 flex items-center gap-1">Enemies defeated
                    <input type="number" min="0" value="${defeated}" onchange="window.gmSetLootDefeated(this.value)" style="width:3.2rem" class="${selCls} text-center"></label>
            </div>
            <div class="flex items-center gap-1.5 mb-1.5">
                <select id="gmLootAskWho" onchange="window._gmLootAskWho=this.value" class="${selCls} flex-1 min-w-0" ${party.length ? '' : 'disabled'} title="Who is asked to roll">
                    <option value="">Everyone in the party</option>${opts(partyIds.has(window._gmLootAskWho) ? window._gmLootAskWho : '')}</select>
                <button onclick="window.gmAskLootCheck()" class="text-[10px] px-2 py-1 rounded bg-amber-700 hover:bg-amber-600 text-white font-bold whitespace-nowrap" title="The chosen player's sheet (or everyone's) opens the LUC (Loot) roll with this enemy count">Ask to roll</button>
            </div>
            ${rolls.length ? `<div class="mb-1.5">${rolls.map(r => `<div class="flex items-center gap-1 text-[10px] text-slate-400 py-0.5">
                <b class="text-amber-300">${esc(r.name)}</b> rolled ${esc(r.total)} <span class="text-slate-600">→</span> <b class="text-yellow-300">${cuFor(r.total)} Cu</b>
                <button onclick="window.gmUseLootRoll(${cuFor(r.total)}, '${esc(r.evId)}')" class="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-white font-bold" title="Put this amount in the Cu box (the roll is then cleared)">Use</button></div>`).join('')}</div>` : ''}
            <div class="grid items-center gap-1" style="grid-template-columns:4.2rem minmax(0,1fr) auto">
                <input id="gmLootCu" type="number" min="0" placeholder="Cu" value="${esc(form.amt)}" oninput="window._gmLootCuForm.amt=this.value" class="${selCls} text-center">
                <select id="gmLootCuTo" onchange="window._gmLootCuForm.to=this.value" class="${selCls}" ${party.length ? '' : 'disabled'}>
                    <option value="">Give Cu to…</option><option value="__split" ${cuTo === '__split' ? 'selected' : ''}>Split among the party</option>${opts(cuTo)}</select>
                <button onclick="window.gmGiveLootCu()" class="text-[10px] px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-bold">Give Cu</button>
            </div>
        </div>
        ${party.length ? '' : '<div class="text-[9px] text-slate-500 mt-1.5">Load the party to hand out loot.</div>'}`;
};
// Use a player's Loot roll: its Cu goes in the Cu box and the roll is cleared from the list
window._gmLootUsed = new Set();
window.gmUseLootRoll = function(amt, evId) {
    window._gmLootCuForm.amt = String(amt);
    if (evId) {
        window._gmLootUsed.add(evId);
        window._gmLootRolls = (window._gmLootRolls || []).filter(r => r.evId !== evId);
    }
    window.renderGmLoot();
    let i = document.getElementById('gmLootCu'); if (i) { i.value = amt; i.focus(); }
};
function _gmSendGift(uid, gift) {
    let code = _gmActiveCode();
    if (!code || !window.apxAuth?.enabled || typeof window.apxAuth.gmGiveToPlayer !== 'function') {
        window.apxAlert ? window.apxAlert('Loot can only be handed out while an online world is active.') : alert('Loot needs an active online world.');
        return false;
    }
    window.apxAuth.gmGiveToPlayer(code, uid, gift).catch(e => console.warn('Give loot:', e.message));
    return true;
}
// (_gmSendGift and _gmLootList are top-level functions, so the Loot Maker can call them directly)
function _gmPartyName(uid) { let p = (window.gmParty || []).find(x => x.fileName === uid); return p?.summary?.name || 'player'; }
window.gmGiveLoot = function(id, btn) {
    let list = _gmLootList(), i = list.findIndex(l => l.id === id); if (i < 0) return;
    let uid = btn?.parentElement?.querySelector('.gm-loot-to')?.value || window._gmLootSel[id];
    if (!uid) { window.apxAlert && window.apxAlert('Pick who gets it first.'); return; }
    let l = list[i];
    if (!_gmSendGift(uid, { id: crypto.randomUUID(), item: l.item, from: 'GM', at: Date.now() })) return;
    list.splice(i, 1); delete window._gmLootSel[id];
    if (typeof gmLog === 'function') gmLog({ text: `${_gmPartyName(uid)} received ${l.item.name}.`, kind: 'loot', force: true });
    window.renderGmLoot();
    if (typeof window.saveWorldNotes === 'function') window.saveWorldNotes();
};
window.gmDiscardLoot = function(id) {
    let list = _gmLootList(), i = list.findIndex(l => l.id === id); if (i < 0) return;
    list.splice(i, 1); window.renderGmLoot();
    if (typeof window.saveWorldNotes === 'function') window.saveWorldNotes();
};
// Give Cu to one party member, or split it evenly (the first few get any remainder).
// `where` names the source for the log ("from Area B"). Returns true when sent.
window._gmGiveCu = function(amt, to, where) {
    amt = parseInt(amt) || 0;
    if (amt <= 0 || !to) { window.apxAlert && window.apxAlert('Enter an amount of Cu and who gets it.'); return false; }
    let party = (window.gmParty || []).map(p => p.fileName);
    let src = where ? ` ${where}` : '';
    if (to === '__split') {
        if (!party.length) return false;
        let each = Math.floor(amt / party.length), extra = amt - each * party.length;
        let ok = true;
        party.forEach((uid, k) => { let n = each + (k < extra ? 1 : 0); if (n > 0 && ok) ok = _gmSendGift(uid, { id: crypto.randomUUID(), cu: n, from: 'GM', at: Date.now() }); });
        if (!ok) return false;
        if (typeof gmLog === 'function') gmLog({ text: `The party split ${amt} Cu${src}.`, kind: 'loot', force: true });
    } else {
        if (!_gmSendGift(to, { id: crypto.randomUUID(), cu: amt, from: 'GM', at: Date.now() })) return false;
        if (typeof gmLog === 'function') gmLog({ text: `${_gmPartyName(to)} found ${amt} Cu${src}.`, kind: 'loot', force: true });
    }
    return true;
};
window.gmGiveLootCu = function() {
    let amt = parseInt(document.getElementById('gmLootCu')?.value) || 0;
    let to = document.getElementById('gmLootCuTo')?.value;
    if (!window._gmGiveCu(amt, to)) return;
    window._gmLootCuForm.amt = '';
    document.getElementById('gmLootCu').value = '';
};
window.gmAskLootCheck = function() {
    let code = _gmActiveCode();
    if (!code || !window.apxAuth?.enabled || typeof window.apxAuth.publishLootRequest !== 'function') {
        window.apxAlert && window.apxAlert('Asking for a Loot check needs an active online world.'); return;
    }
    let who = document.getElementById('gmLootAskWho')?.value || '';
    if (who && !(window.gmParty || []).some(p => p.fileName === who)) who = '';
    window._gmLootAskWho = who;
    window._gmLootRequestAt = Date.now();
    window._gmLootRequestTo = who || null;
    window._gmLootRolls = [];
    let defeated = _gmLootDefeated();
    window.apxAuth.publishLootRequest(code, { id: crypto.randomUUID(), at: Date.now(), defeated, to: who || null }).catch(e => console.warn('Loot request:', e.message));
    let foes = `${defeated} ${defeated === 1 ? 'enemy' : 'enemies'} defeated`;
    if (typeof gmLog === 'function') gmLog({ text: who ? `The GM asks ${_gmPartyName(who)} for a LUC (Loot) check to find Currency (${foes}).` : `The GM asks for a LUC (Loot) check to find Currency (${foes}).`, kind: 'loot', force: true });
    window.renderGmLoot();
};

// Push the tracker's HP + Temp HP for a party member to their character sheet
function _syncHpToPlayer(entry) {
    if (!entry || entry.faction !== 'player' || !entry.playerUid) return;
    let worlds = typeof _gmWorlds !== 'undefined' ? _gmWorlds : [];
    let activeWorld = worlds.find(w => (w.worldId||w.id) === (typeof _activeWorldId !== 'undefined' ? _activeWorldId : null));
    let inviteCode = activeWorld?.inviteCode;
    if (inviteCode && window.apxAuth?.enabled && typeof window.apxAuth.setGmHpOverride === 'function') {
        window.apxAuth.setGmHpOverride(inviteCode, entry.playerUid, entry.currentHp, entry.tempHp || 0)
            .catch(e => console.warn('HP sync to player:', e.message));
    }
}
window._syncHpToPlayer = _syncHpToPlayer;

// Put a condition on (or take it off) a party member's own character sheet
function _gmSetPlayerCondition(entry, condId, on) {
    if (!entry || entry.faction !== 'player' || !entry.playerUid) return;
    let worlds = typeof _gmWorlds !== 'undefined' ? _gmWorlds : [];
    let activeWorld = worlds.find(w => (w.worldId||w.id) === (typeof _activeWorldId !== 'undefined' ? _activeWorldId : null));
    let code = activeWorld?.inviteCode;
    if (code && window.apxAuth?.enabled && typeof window.apxAuth.setGmCondition === 'function')
        window.apxAuth.setGmCondition(code, entry.playerUid, condId, on).catch(e => console.warn('Condition sync to player:', e.message));
}
window._gmSetPlayerCondition = _gmSetPlayerCondition;

// ── Combat log ─────────────────────────────────────────────────────────────
// While combat is running, the dice tray doubles as a combat log. Damage and
// healing (from the tracker or a player's own sheet) go to everyone; players'
// checks and saves go to the GM only. Wound Threshold and Bleed Out CON rolls
// are matched up automatically: each player has a queue (Wound Threshold save
// first, then the Bleed Out check), and their next matching CON roll resolves
// the item at the front. Luck rerolls update the result live.
window.gmCombatLog = [];
let _gmLogSession = null, _gmLogPubT = 0;
window._gmPendingSaves = {};      // entryId -> [{ type: 'wt'|'bleed', dc, dmg, known:Set }]
window._gmResolvedSaves = {};     // player roll id -> { item, entryId }
window._gmPlayerRollLogs = {};    // uid -> latest _rollLog
window._gmRecentBurn = {};        // uid -> { amt, t } (skip the duplicate plain damage line)
let _gmSeenRoll = {};             // roll id -> signature (skip repeats)

function _gmInviteCode() {
    let worlds = typeof _gmWorlds !== 'undefined' ? _gmWorlds : [];
    let w = worlds.find(x => (x.worldId || x.id) === (typeof _activeWorldId !== 'undefined' ? _activeWorldId : null));
    return w?.inviteCode || null;
}
// Name players see: hidden (unrevealed) tokens stay anonymous
function _gmIsHidden(entry) {
    if (!entry || entry.faction === 'player') return false;
    let maps = (typeof _wNotes !== 'undefined' && _wNotes.otherMaps) || [];
    return maps.some(m => (m.battleTokens || []).some(t => t.initiativeId === entry.id && t.revealed === false));
}
// Name the GM sees: always the real name, marked when players can't see the token
function _gmGmName(entry) {
    if (!entry) return 'Someone';
    return (entry.name || 'Someone') + (_gmIsHidden(entry) ? ' (hidden)' : '');
}
function _gmPublicName(entry) {
    if (!entry) return 'Someone';
    if (entry.faction !== 'player') {
        let maps = (typeof _wNotes !== 'undefined' && _wNotes.otherMaps) || [];
        for (let m of maps) {
            let t = (m.battleTokens || []).find(t => t.initiativeId === entry.id);
            if (t && t.revealed === false) return 'an unseen creature';
        }
    }
    return entry.name || 'Someone';
}
function gmLog(e) {
    if (!e || (!window.gmCombatStarted && !e.force)) return null;
    e.id = e.id || 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    e.t = e.t || Date.now();
    let i = window.gmCombatLog.findIndex(x => x.id === e.id);
    if (i >= 0) window.gmCombatLog[i] = Object.assign({}, window.gmCombatLog[i], e, { t: window.gmCombatLog[i].t });
    else window.gmCombatLog.push(e);
    window.gmCombatLog = window.gmCombatLog.slice(-80);
    let shown = window.gmCombatLog.find(x => x.id === e.id);
    // gmText: what the GM sees (players get text)
    if (window.APXDice && window.APXDice.logEntry) window.APXDice.logEntry(shown.gmText ? Object.assign({}, shown, { text: shown.gmText }) : shown);
    if (!e.gmOnly) _gmPublishLogSoon();
    return e.id;
}
window.gmLog = gmLog;
function _gmPublishLogSoon() {
    clearTimeout(_gmLogPubT);
    _gmLogPubT = setTimeout(() => {
        let code = _gmInviteCode();
        if (!code || !window.apxAuth?.enabled || typeof window.apxAuth.publishCombatLog !== 'function') return;
        let pub = window.gmCombatLog.filter(x => !x.gmOnly).slice(-40).map(x => ({ id: x.id, t: x.t, text: x.text, kind: x.kind || 'info', ask: x.ask || null }));
        window.apxAuth.publishCombatLog(code, pub, _gmLogSession).catch(err => console.warn('Combat log:', err.message));
    }, 400);
}
// HP change on a tracker entry → "<active creature> dealt X damage to <target>."
function _gmLogHpChange(entry, before, after, wasAboveZero, rawDmg, hit, why) {
    let d = before - after;
    if (d > 0 && rawDmg > d) d = rawDmg;   // the whole hit, even past 0 HP
    if (!window.gmCombatStarted) return;
    if (!d && !hit) return;
    let burn = entry.playerUid && window._gmRecentBurn[entry.playerUid];
    if (burn && d > 0 && Date.now() - burn.t < 15000 && (burn.amt === d || burn.amt === before - after)) { delete window._gmRecentBurn[entry.playerUid]; return; }
    let cur = window.gmInitiative[window.gmCurrentTurnIdx];
    if (hit && d >= 0) {
        // Linked to the attack just rolled: "X hit Y." (players never see an NPC's damage numbers)
        let a = hit.attacker, tgt = _gmPublicName(entry), gTgt = _gmGmName(entry);
        let byPlayer = a.faction === 'player' || !!a.companionOf;
        let text, gmText;
        if (d > 0) {
            text = entry.faction !== 'player' && byPlayer ? `${_gmPublicName(a)} hit ${tgt}.` : `${_gmPublicName(a)} dealt ${d} damage to ${tgt}.`;
            gmText = `${_gmGmName(a)} dealt ${d} damage to ${gTgt}.`;
        } else {
            text = entry.faction !== 'player' && byPlayer ? `${_gmPublicName(a)} hit ${tgt}.` : `${_gmPublicName(a)} hit ${tgt}, but ${tgt} took no damage.`;
            gmText = `${_gmGmName(a)} hit ${gTgt}, but ${gTgt} took no damage.`;
        }
        if (d > 0 && wasAboveZero && entry.currentHp !== null && entry.currentHp <= 0) { text += ` ${tgt} is down!`; gmText += ` ${gTgt} is down!`; }
        gmLog({ text, gmText: gmText === text ? null : gmText, kind: 'dmg' });
        return;
    }
    if (!d) return;
    let tgt = _gmPublicName(entry);
    // A player hurting an NPC doesn't reveal the amount (players could work out its DR/ER);
    // damage to players, and anything NPCs do, is shown in full.
    let hideAmt = entry.faction !== 'player' && cur && (cur.faction === 'player' || !!cur.companionOf);
    let text = d > 0
        ? (cur && cur !== entry ? (hideAmt ? `${_gmPublicName(cur)} hit ${tgt}.` : `${_gmPublicName(cur)} dealt ${d} damage to ${tgt}.`) : `${tgt} took ${entry.faction !== 'player' ? 'damage' : d + ' damage'}.`)
        : (entry.faction !== 'player' ? `${tgt} regained HP.` : `${tgt} regained ${-d} HP${why ? ` (${why})` : ''}.`);
    // The GM always sees real names and amounts (hidden tokens are marked as such)
    let gTgt = _gmGmName(entry);
    let gmText = d > 0 ? `${cur && cur !== entry ? _gmGmName(cur) + ' dealt ' + d + ' damage to ' + gTgt : gTgt + ' took ' + d + ' damage'}.` : `${gTgt} regained ${-d} HP${why ? ` (${why})` : ''}.`;
    if (gmText === text) gmText = null;
    if (d > 0 && wasAboveZero && entry.currentHp !== null && entry.currentHp <= 0) { text += ` ${tgt} is down!`; if (gmText) gmText += ` ${gTgt} is down!`; }
    gmLog({ text, gmText, kind: d > 0 ? 'dmg' : 'heal' });
}
window._gmLogHpChange = _gmLogHpChange;

// ── Hits and weapon properties ─────────────────────────────────────────
// Every attack roll (the GM's stat blocks here, players' sheets through their roll log) is
// remembered as "the last attack". Damage entered for a creature soon after (even -0, when DR/ER
// stopped all of it) is that attack hitting it, so the weapon's properties apply to that target:
//   Crushing  - STR save (DC 10 + STR mod) or Prone; already Prone: +1 damage die instead
//   Stunning  - CON save (DC 10 + STR mod, or INT for an Electric weapon) or Stunned
//   Concealed - +1 damage die against a Surprised creature (before its first turn)
//   Flurry    - the attacker's next attacks this turn with that weapon cost 1 less AP
//   Grappling - noted (the GM applies the grapple)
window._gmLastAttack = null;
window._gmFlurry = {};    // attacker entry id -> { weapon, targetId, targetName, turn }
function _gmRecordAttack(a) {
    if (!a || !a.attacker) return;
    let prev = window._gmLastAttack;
    if (prev && prev.id === a.id) { Object.assign(prev, a, { used: prev.used }); return; }   // a reroll of the same attack
    window._gmLastAttack = Object.assign({ t: Date.now(), used: new Set() }, a);
}
// Which creature in initiative a GM-side attack roll belongs to
function _gmAttackerFor(o) {
    let init = window.gmInitiative || [], cur = init[window.gmCurrentTurnIdx];
    if (o.companion && o.compOwner) return init.find(x => x.companionOf === o.compOwner) || null;
    if (o.initId) { let e = init.find(x => x.id === o.initId); if (e) return e; }
    if (o.npcId) {
        let list = init.filter(x => x.sourceNpcId === o.npcId && x.faction !== 'player');
        return (cur && list.includes(cur)) ? cur : (list.length === 1 ? list[0] : list[0] || null);
    }
    return cur || null;
}
window.apxOnAttackRoll = function(o, r) {
    if (!window.gmCombatStarted || !o) return;
    let e = _gmAttackerFor(o); if (!e) return;
    _gmRecordAttack({ id: r.id, attacker: e, label: o.label || 'an attack', hit: o.hit || null, crit: !!r.crit, fumble: !!r.fumble, total: r.total,
        dice: o.dice || '', critMult: o.critMult || 2, reroll12: false });   // (NPC stat blocks don't use perks)
};
// No attack roll to match (dice rolled at the table): a typed "-N" (even -0) is still a hit,
// by whoever is taking their turn
function _gmTurnHit(target) {
    let cur = (window.gmInitiative || [])[window.gmCurrentTurnIdx];
    if (!window.gmCombatStarted || !cur || cur.id === target.id) return null;
    return { attacker: cur, hit: null, crit: false, dice: '' };
}
// The attack that just hit `target` (once per target, so an area power can hit several)
function _gmTakeHit(target) {
    let a = window._gmLastAttack;
    if (!a || !window.gmCombatStarted || Date.now() - a.t > 180000) return null;
    let atk = (window.gmInitiative || []).find(x => x.id === a.attacker.id) || a.attacker;
    if (!atk || atk.id === target.id || a.used.has(target.id) || a.fumble) return null;
    a.used.add(target.id);
    return Object.assign({}, a, { attacker: atk });
}
function _gmEffConds(entry) {
    let ids;
    if (entry.faction === 'player') {
        let pm = (window.gmParty || []).find(p => p.fileName === entry.playerUid);
        ids = (pm?.state?.conditions || []).slice();
    } else ids = window._gmEntryConditions ? window._gmEntryConditions(entry.id) : (entry.conditions || []);
    return window.apxEffectiveConditions ? window.apxEffectiveConditions(ids).map(c => c.id) : ids;
}
function _gmAddCondition(entry, condId) {
    if (entry.faction === 'player') _gmSetPlayerCondition(entry, condId, true);
    else if (window._gmAddEntryCondition) window._gmAddEntryCondition(entry.id, condId);
    window.renderInitiativeTracker();
}
function _gmRollDie(die) {
    let m = String(die || '').match(/(\d*)d(\d+)/); if (!m) return 0;
    let n = parseInt(m[1] || '1', 10), sides = parseInt(m[2], 10), t = 0;
    for (let i = 0; i < n; i++) t += (window.APXDice ? APXDice.rnd(sides) : 1 + Math.floor(Math.random() * sides));
    return t;
}
// The extra dice a critical hit adds to this attack's damage (dice × (multiplier − 1)),
// with the attacker's High Roller rerolls (1s and 2s rolled again, 1s never kept)
function _gmCritExtra(hit) {
    let mult = Math.max(2, hit.critMult || 2), total = 0, parts = [];
    String(hit.dice || '').replace(/\s+/g, '').replace(/([+-]?)(\d*)d(\d+)/gi, (m, sign, n, sides) => {
        if (sign === '-') return m;
        let count = (parseInt(n || '1', 10)) * (mult - 1), s = parseInt(sides, 10);
        for (let i = 0; i < count; i++) {
            let v = window.APXDice ? APXDice.rnd(s) : 1 + Math.floor(Math.random() * s);
            if (hit.reroll12 && v <= 2) { v = APXDice.rnd(s); while (v === 1 && s > 1) v = APXDice.rnd(s); }
            total += v;
        }
        if (count) parts.push(count + 'd' + s);
        return m;
    });
    return { n: total, dice: parts.join('+') };
}
// Before the damage lands: extra damage dice from the weapon's properties
function _gmHitExtraDamage(target, hit) {
    let props = (hit.hit && hit.hit.props) || [], out = [];
    let conds = _gmEffConds(target);
    // Incapacitated: any hit is a Critical Hit (and bypasses their resistances). A hit that didn't
    // roll a crit gets the crit's extra dice here, the same way Crushing adds its die.
    if (conds.includes('incapacitated') && !hit.crit && hit.dice) {
        let x = _gmCritExtra(hit);
        if (x.dice) out.push({ n: x.n, why: 'Incapacitated',
            pub: `${_gmPublicName(target)} is Incapacitated, so the hit is a Critical Hit.`,
            gm: `Incapacitated: automatic Critical Hit, +${x.n} damage (${x.dice}${hit.reroll12 ? ', High Roller rerolls' : ''}). It also bypasses their resistances.` });
    }
    if (props.includes('crushing') && conds.includes('prone')) {
        let n = _gmRollDie(hit.hit.die);
        out.push({ n, why: 'Crushing', pub: `${_gmPublicName(target)} was Prone, so Crushing deals an extra damage die.`, gm: `Crushing: ${_gmGmName(target)} was Prone, +${n} damage (${hit.hit.die}).` });
        hit._crushedProne = true;
    }
    if (props.includes('concealed') && target.surprised && !(target._apTurns > 0)) {
        let n = _gmRollDie(hit.hit.die);
        out.push({ n, why: 'Concealed', pub: `${_gmPublicName(target)} was Surprised, so the Concealed weapon deals an extra damage die.`, gm: `Concealed: ${_gmGmName(target)} was Surprised, +${n} damage (${hit.hit.die}).` });
    }
    return out;
}
// After the damage lands: saving throws, and Flurry for the attacker's next attacks
function _gmHitEffects(target, hit, extras) {
    (extras || []).forEach(x => gmLog({ text: x.pub, gmText: x.gm, kind: 'dmg' }));
    let h = hit.hit || {}, props = h.props || [], a = hit.attacker;
    let str = h.strMod || 0, int = h.intMod || 0;
    if (props.includes('crushing') && !hit._crushedProne)
        _gmAskSave(target, { attr: 'STR', dc: 10 + str, cond: 'prone', why: 'Crushing', failInf: 'be knocked Prone', fail: 'is knocked Prone' });
    if (props.includes('stunning'))
        _gmAskSave(target, { attr: 'CON', dc: 10 + (h.elec ? Math.max(str, int) : str), cond: 'stunned', why: 'Stunning', byId: a && a.id, turn: window.gmTurnNumber, failInf: `be Stunned until the end of ${_gmPublicName(a)}'s next turn`, fail: `is Stunned until the end of ${_gmPublicName(a)}'s next turn` });
    if (props.includes('grappling'))
        gmLog({ text: `${_gmPublicName(target)} is grappled by ${_gmPublicName(a)}'s ${h.weapon || 'weapon'} (Grappling).`, kind: 'info' });
    if (props.includes('flurry')) {
        window._gmFlurry[a.id] = { weapon: h.weapon, targetId: target.id, targetName: _gmPublicName(target), turn: window.gmTurnNumber };
        gmLog({ text: `Flurry: ${_gmPublicName(a)}'s next attacks on ${_gmPublicName(target)} with ${h.weapon || 'that weapon'} cost 1 less AP this turn.`, gmOnly: a.faction !== 'player', kind: 'info' });
        if (typeof window.saveWorldNotes === 'function') window.saveWorldNotes();   // the player's sheet picks it up
    }
}
// A saving throw a hit calls for. Players get a button in their dice tray; NPCs get one in yours.
window._gmCondSaves = {};   // entry id -> [{ attr, dc, cond, why, fail, known:Set }]
window._gmCondResolved = {};  // player roll id -> { entryId, item }
function _gmAskSave(target, item) {
    let who = _gmPublicName(target);
    let text = `${who} must make a DC ${item.dc} ${item.attr} save or ${item.failInf || item.fail} (${item.why}).`;
    if (target.faction === 'player' && target.playerUid) {
        item.known = new Set((window._gmPlayerRollLogs[target.playerUid] || []).map(x => x.id));
        (window._gmCondSaves[target.id] = window._gmCondSaves[target.id] || []).push(item);
        gmLog({ text, kind: 'wt', ask: { uid: target.playerUid, roll: 'save', attr: item.attr, dc: item.dc, label: `Roll ${item.attr} save (DC ${item.dc})` } });
    } else {
        gmLog({ text, gmText: `${_gmGmName(target)} must make a DC ${item.dc} ${item.attr} save or ${item.failInf || item.fail} (${item.why}).`, kind: 'wt',
            ask: { gm: true, entryId: target.id, roll: 'save', attr: item.attr, dc: item.dc, cond: item.cond, fail: item.fail, byId: item.byId || null, turn: item.turn || null, label: `Roll ${_gmGmName(target)}'s ${item.attr} save (DC ${item.dc})` } });
    }
}
function _gmCondResult(entry, item, ev, again) {
    let pass = !ev.autoFail && ev.total >= item.dc;
    let name = _gmPublicName(entry);
    if (!pass) { _gmAddCondition(entry, item.cond); if (item.byId) _gmSetCondTimer(entry, item); }
    else if (again && item.applied) { _gmClearCondTimer(entry, item); if (entry.faction === 'player') _gmSetPlayerCondition(entry, item.cond, false); else if (window._gmRemoveEntryCondition) window._gmRemoveEntryCondition(entry.id, item.cond); }
    item.applied = !pass;
    return pass ? `${name} succeeds on the ${item.attr} save (${ev.total} vs DC ${item.dc}).`
                : `${name} fails the ${item.attr} save (${ev.total} vs DC ${item.dc}) and ${item.fail}.`;
}
// Conditions that last "until the end of X's next turn" (Stunning). A new one from the same
// source replaces the old timer, so being Stunned again keeps the creature Stunned.
function _gmSetCondTimer(entry, item) {
    let list = (entry._condTimers || []).filter(t => t.cond !== item.cond);
    list.push({ cond: item.cond, byId: item.byId, turn: item.turn != null ? item.turn : window.gmTurnNumber });
    entry._condTimers = list;
}
function _gmClearCondTimer(entry, item) {
    if (entry._condTimers) entry._condTimers = entry._condTimers.filter(t => !(t.cond === item.cond && t.byId === item.byId));
}
// The creature whose turn is ending: anything that lasted until the end of its next turn wears off
function _gmExpireCondTimers(ending) {
    if (!ending || !window.gmCombatStarted) return;
    (window.gmInitiative || []).forEach(e => {
        if (!e._condTimers || !e._condTimers.length) return;
        let keep = [];
        e._condTimers.forEach(t => {
            if (t.byId !== ending.id || !(window.gmTurnNumber > t.turn)) { keep.push(t); return; }
            let has = e.faction === 'player' ? true : (window._gmEntryConditions ? window._gmEntryConditions(e.id).includes(t.cond) : true);
            if (!has) return;
            if (e.faction === 'player') _gmSetPlayerCondition(e, t.cond, false);
            else if (window._gmRemoveEntryCondition) window._gmRemoveEntryCondition(e.id, t.cond);
            let cn = window._gmCondName ? window._gmCondName(t.cond) : t.cond;
            gmLog({ text: `${_gmPublicName(e)} is no longer ${cn} (${_gmPublicName(ending)}'s turn ended).`, gmText: `${_gmGmName(e)} is no longer ${cn} (${_gmGmName(ending)}'s turn ended).`, kind: 'info' });
        });
        e._condTimers = keep;
    });
}
window._gmExpireCondTimers = _gmExpireCondTimers;
// Is this creature Stunned right now? (NPC tokens / tracker, or the player's own sheet)
function _gmIsStunned(e) {
    if (e.faction === 'player') {
        let pm = (window.gmParty || []).find(p => p.fileName === e.playerUid || p.summary?.playerUid === e.playerUid);
        let st = pm?.state || {};
        let c = [].concat(st.conditions || [], st.gmConditions || []);
        return c.includes('stunned');
    }
    return window._gmEntryConditions ? window._gmEntryConditions(e.id).includes('stunned') : false;
}
// NPC saves from the GM's dice tray button (the log message asks for them)
window.apxLogAsk = function(ask) { return !!(ask && ask.gm && (window.gmInitiative || []).some(e => e.id === ask.entryId)); };
window.apxRollFromAsk = function(ask, choice) {
    let e = (window.gmInitiative || []).find(x => x.id === ask.entryId); if (!e || !window.APXDice) return;
    if (ask.kind === 'limb') { if (choice) _gmApplyWound(e, choice); return; }
    let sb = e.sourceNpcId && typeof ncStatBlockFor === 'function' ? ncStatBlockFor(e.sourceNpcId) : null;
    let bonus = sb && sb.mods ? (sb.mods[ask.attr] || 0) : 0;
    let item = { attr: ask.attr, dc: ask.dc, cond: ask.cond, fail: ask.fail, byId: ask.byId || null, turn: ask.turn || null };
    let first = true;
    APXDice.check({ kind: 'save', attr: ask.attr, label: `${ask.attr} Save (DC ${ask.dc})`, who: e.name, bonus, perks: false,
        note: sb ? null : 'No stat block: add their save bonus yourself',
        onResult: r => {
            let txt = _gmCondResult(e, item, { total: r.total, autoFail: r.autoFail }, !first);
            gmLog({ id: 'ncs_' + ask.entryId + '_' + ask.attr + '_' + ask.dc, text: txt, kind: 'wt' });
            first = false;
            return txt;
        } });
};

// Queue a CON roll the player owes: Wound Threshold saves always go before Bleed Out
function _gmQueueSave(entry, item) {
    if (!entry || !entry.playerUid) return;
    let q = window._gmPendingSaves[entry.id] || (window._gmPendingSaves[entry.id] = []);
    item.known = new Set((window._gmPlayerRollLogs[entry.playerUid] || []).map(x => x.id));
    if (item.type === 'wt') {
        let i = q.findIndex(x => x.type === 'bleed');
        if (i < 0) q.push(item); else q.splice(i, 0, item);
    } else if (!q.some(x => x.type === 'bleed')) q.push(item);
}
window._gmQueueSave = _gmQueueSave;

function _gmResolveText(entry, item, ev) {
    let name = entry ? entry.name : (ev.who || 'A player');
    if (item.type === 'wt') {
        let ok = !ev.autoFail && ev.total >= item.dc;
        return { text: `${name} rolled a ${ev.total} on a DC ${item.dc} check to resist being wounded. They ${ok ? 'succeeded' : 'failed'}.` + (ok ? '' : ' The GM chooses a limb to become Wounded.'), kind: 'wt' };
    }
    let turns = Math.max(1, Math.floor(ev.total / 2));
    return { text: `${name} rolled a ${ev.total} on their Bleed Out CON check: they will bleed out in ${turns} round${turns === 1 ? '' : 's'} unless stabilized or healed.`, kind: 'bleed', turns };
}
// A failed Wound Threshold save: the GM picks the limb in the dice tray, and it's added to the
// player's sheet (a limb that was already Wounded asks the player for the Permanent Injury)
function _gmOfferLimbs(entry, item, ev) {
    if (!entry || item.type !== 'wt') return;
    let failed = ev.autoFail || ev.total < item.dc;
    if (!failed) return;
    let pm = (window.gmParty || []).find(p => p.fileName === entry.playerUid);
    let already = pm?.state?.woundedLimbs || [];
    let limbs = (typeof WOUND_LIMBS_BASE !== 'undefined' ? WOUND_LIMBS_BASE : ['Head', 'Torso', 'Left Arm', 'Right Arm', 'Left Leg', 'Right Leg']).slice();
    already.forEach(l => { if (!limbs.includes(l)) limbs.push(l); });
    gmLog({ id: 'limb_' + ev.id, gmOnly: true, kind: 'wt', force: true,
        text: `Choose the limb ${entry.name} Wounds (based on the attack)${already.length ? `. Already Wounded: ${already.join(', ')} (Wounding one again is a Permanent Injury)` : ''}:`,
        ask: { gm: true, entryId: entry.id, kind: 'limb', choices: limbs.map(l => already.includes(l) ? l + ' (again)' : l) } });
}
function _gmApplyWound(entry, choice) {
    let limb = String(choice).replace(/ \(again\)$/, '');
    let again = / \(again\)$/.test(choice);
    let code = _gmInviteCode();
    if (code && window.apxAuth?.enabled && typeof window.apxAuth.setGmWound === 'function')
        window.apxAuth.setGmWound(code, entry.playerUid, limb).catch(e => console.warn('Wound to player:', e.message));
    gmLog({ text: again ? `${entry.name}'s ${limb} is Wounded again: a Permanent Injury.` : `${entry.name}'s ${limb} is Wounded.`, kind: 'wt', force: true });
}
function _gmApplyBleed(entry, turns) {
    if (!entry) return;
    entry.bleedOutTurns = turns;
    _gmSetPlayerCondition(entry, 'bleedingout', true);
    let m = document.getElementById('bleedOutModal');
    if (m && m.dataset.entryId === entry.id && m.classList.contains('active')) window.closeModal('bleedOutModal');
    window.renderInitiativeTracker();
    if (typeof window._btRefreshAllOpenMaps === 'function') window._btRefreshAllOpenMaps();
    if (typeof window.saveWorldNotes === 'function') window.saveWorldNotes();
}
// One of a player's check/save rolls arrived (new, or updated by a Luck reroll / Omen)
function _gmHandleRollEvent(uid, ev) {
    if (!ev || !ev.id) return;
    let sig = [ev.nat, ev.total, ev.luck, ev.omen].join('|');
    if (_gmSeenRoll[ev.id] === sig) return;
    let firstSeen = !(ev.id in _gmSeenRoll);
    _gmSeenRoll[ev.id] = sig;
    // A player spent an Omen die on someone else's roll: it waits in the GM's dice tray
    if (ev.kind === 'omen') {
        if (!firstSeen) return;
        let who = ((window.gmParty || []).find(p => p.fileName === uid)?.summary?.name) || ev.who || 'A player';
        let adjTxt = ev.adj ? (ev.adj > 0 ? '+' : '−') + Math.abs(ev.adj) : '';
        if (window.APXDice && APXDice.offerOmen) APXDice.offerOmen({ id: ev.id, value: ev.value, adj: ev.adj || 0, who });
        gmLog({ id: 'omen_' + ev.id, text: `${who} spends an Omen die (${ev.value}${adjTxt}) on another creature's roll.`, kind: 'info', force: true });
        if (window.APXDice && APXDice.notify) APXDice.notify(`${who} spent an Omen die (${ev.value}${adjTxt}). Apply it from the roll it replaces, using the "${who}'s Omen" button.`, { kind: 'note', open: true });
        return;
    }
    // LUC (Loot) checks answer the GM's Loot request, in or out of combat
    if (ev.skill === 'Loot' && (ev.purpose === 'cu' || !ev.purpose) && window._gmLootRequestAt && (ev.t || Date.now()) >= window._gmLootRequestAt - 60000
        && (!window._gmLootRequestTo || window._gmLootRequestTo === uid)) {
        if (window._gmLootUsed && window._gmLootUsed.has(ev.id)) return;   // already used
        let who = ((window.gmParty || []).find(p => p.fileName === uid)?.summary?.name) || ev.who || 'A player';
        let rs = window._gmLootRolls = window._gmLootRolls || [];
        let prev = rs.find(r => r.evId === ev.id);
        if (prev) prev.total = ev.total; else rs.push({ evId: ev.id, name: who, total: ev.total });
        let cu = Math.max(0, Math.floor((ev.total || 0) * _gmLootDefeated() / 2));
        gmLog({ id: 'loot_' + ev.id, gmOnly: true, kind: 'roll', force: true, text: `${who} rolled LUC (Loot): ${ev.total} (d20 ${ev.nat})${ev.luck ? ' · Luck reroll' : ''} → ${cu} Cu for the party` });
        window.renderGmLoot && window.renderGmLoot();
        return;
    }
    if (!window.gmCombatStarted) return;
    let entry = (window.gmInitiative || []).find(e => e.playerUid === uid);
    let name = entry ? entry.name : (ev.who || 'A player');
    // A player's attack (weapon or power) becomes "the last attack", for hits and weapon properties
    if (ev.kind === 'attack') {
        let atkEntry = ev.companion ? (window.gmInitiative || []).find(e => e.companionOf === uid) : entry;
        if (atkEntry) _gmRecordAttack({ id: ev.id, attacker: atkEntry, label: ev.label || 'an attack', hit: ev.hit || null, crit: !!ev.crit, fumble: !!ev.fumble, total: ev.total,
            dice: ev.dice || '', critMult: ev.critMult || 2, reroll12: !!ev.reroll12 });
        gmLog({ id: 'ev_' + ev.id, gmOnly: true, kind: 'roll',
            text: `${atkEntry ? atkEntry.name : name} attacked with ${ev.label || 'a weapon'}: ${ev.total} (d20 ${ev.nat}${ev.bonus ? (ev.bonus > 0 ? ' +' : ' −') + Math.abs(ev.bonus) : ''})${ev.crit ? ' · critical hit' : ev.fumble ? ' · natural 1' : ''}${ev.dmg != null ? ` · ${ev.dmg} damage before DR/ER` : ''}` });
        return;
    }
    // A power used from a player's sheet (and whether its targets must save)
    if (ev.kind === 'power') {
        if (firstSeen && ev.text) gmLog({ id: 'pw_' + ev.id, text: ev.text, kind: 'info' });
        return;
    }
    // Burning ticked at the start of their turn: say why they lost HP (instead of a plain damage line)
    if (ev.kind === 'burn') {
        if (!firstSeen) return;
        window._gmRecentBurn[uid] = { amt: ev.total, t: Date.now() };
        gmLog({ id: 'burn_' + ev.id, text: `${name} burns for ${ev.total} Fire damage.`, kind: 'dmg' });
        return;
    }
    // Everything a player rolls shows for the GM (updates in place)
    let mode = ev.mode === 'adv' ? ', Advantage' : ev.mode === 'dis' ? ', Disadvantage' : '';
    gmLog({ id: 'ev_' + ev.id, gmOnly: true, kind: 'roll',
        text: `${name} rolled ${ev.label || 'a d20'}: ${ev.total} (d20 ${ev.nat}${ev.bonus ? (ev.bonus > 0 ? ' +' : ' −') + Math.abs(ev.bonus) : ''}${mode})${ev.luck ? ' · Luck reroll' : ''}${ev.omen ? ' · Omen' : ''}${ev.autoFail ? ' · auto-fail' : ''}` });
    // Already matched to a Wound Threshold / Bleed Out roll: update the result
    let done = window._gmResolvedSaves[ev.id];
    if (done) {
        let en = window.gmInitiative.find(e => e.id === done.entryId);
        let r = _gmResolveText(en, done.item, ev);
        gmLog({ id: 'res_' + ev.id, text: r.text + ' (rerolled)', kind: r.kind });
        if (en) _gmOfferLimbs(en, done.item, ev);
        if (done.item.type === 'bleed' && en && en.bleedOutTurns != null) _gmApplyBleed(en, r.turns);
        return;
    }
    // A save a hit called for (Crushing, Stunning): matched by attribute, rerolls update it
    let cdone = window._gmCondResolved[ev.id];
    if (cdone) {
        let en = window.gmInitiative.find(e => e.id === cdone.entryId);
        if (en) gmLog({ id: 'cres_' + ev.id, text: _gmCondResult(en, cdone.item, ev, true) + ' (rerolled)', kind: 'wt' });
        return;
    }
    let wtFirst = ev.attr === 'CON' && ((window._gmPendingSaves[entry?.id] || [])[0] || {}).type === 'wt';
    if (firstSeen && entry && ev.kind === 'save' && !wtFirst) {
        let cq = window._gmCondSaves[entry.id] || [];
        let ci = cq.findIndex(x => x.attr === ev.attr && !x.known.has(ev.id));
        if (ci >= 0) {
            let item = cq.splice(ci, 1)[0];
            window._gmCondResolved[ev.id] = { entryId: entry.id, item };
            gmLog({ id: 'cres_' + ev.id, text: _gmCondResult(entry, item, ev, false), kind: 'wt' });
            return;
        }
    }
    if (!firstSeen || !entry) return;
    let q = window._gmPendingSaves[entry.id];
    if (!q || !q.length) return;
    let head = q[0];
    if (head.known.has(ev.id) || ev.attr !== 'CON') return;
    let fits = head.type === 'wt' ? ev.kind === 'save' : (ev.kind === 'save' || ev.skill === 'Survive');
    if (!fits) return;
    q.shift();
    window._gmResolvedSaves[ev.id] = { item: head, entryId: entry.id };
    let r = _gmResolveText(entry, head, ev);
    gmLog({ id: 'res_' + ev.id, text: r.text, kind: r.kind });
    _gmOfferLimbs(entry, head, ev);
    if (head.type === 'bleed' && entry.currentHp !== null && entry.currentHp <= 0) _gmApplyBleed(entry, r.turns);
}
window._gmHandleRollEvent = _gmHandleRollEvent;

// XP for defeating an initiative entry: from its stat block's current Tier (so older
// combats pick up XP table changes); quick-add NPCs keep their stored value (0).
window._gmEntryXp = function(entry) {
    if (!entry || entry.faction === 'player') return 0;
    let n = entry.sourceNpcId && (window.gmNpcs || []).find(x => x.id === entry.sourceNpcId);
    if (n && window.npcXpForTier) {
        let xp = window.npcXpForTier(npcTierForTP(n.npc.gmTpBudget || 0).tier);
        entry.tpValue = xp;
        return xp;
    }
    return entry.tpValue || 0;
};

function _gmQueueBleed(entry) {
    if (!entry || entry.faction !== 'player' || entry.bleedOutTurns != null) return;
    _gmQueueSave(entry, { type: 'bleed' });
    // ask: the player's roller shows a button to roll the check straight from this message
    if (entry.playerUid) gmLog({ text: `${entry.name} is Bleeding Out. Their next CON (Survive) check sets how many rounds they have.`, kind: 'bleed', ask: { uid: entry.playerUid, roll: 'survive' } });
}

// Shared after-change handling: 0 HP → bleed out (players) / killed (NPCs); healed → clear bleed-out
function _afterHpChange(entry, wasAboveZero) {
    if (entry.companionOf) {
        // Loyal Companion: its HP lives on the owner's sheet; at 0 HP it stays in the fight (down)
        let code = _gmInviteCode();
        if (code && window.apxAuth?.enabled && typeof window.apxAuth.setGmCompanionHp === 'function')
            window.apxAuth.setGmCompanionHp(code, entry.companionOf, entry.currentHp).catch(e => console.warn('Companion HP sync:', e.message));
        window.renderInitiativeTracker();
        if (typeof window._btRefreshAllOpenMaps === 'function') window._btRefreshAllOpenMaps();
        return;
    }
    if (entry.currentHp !== null && entry.currentHp <= 0 && wasAboveZero) {
        if (entry.faction === 'player') {
            _syncHpToPlayer(entry);
            _gmQueueBleed(entry);
            // A player with a sheet rolls their Bleed Out check from their dice roller, and the rounds fill in here
            // on their own. The popup is only for players without a linked sheet (or outside combat).
            if (!(entry.playerUid && window.gmCombatStarted)) window.openBleedOutModal(entry.id);
        } else {
            window.gmPendingXp += window._gmEntryXp(entry);
            window.removeFromInitiative(entry.id, { dead: true });
            let foesLeft = window.gmInitiative.some(e => e.faction === 'enemy');
            let bleeding = _gmBleedingPlayers();
            if (!foesLeft && bleeding.length && window.gmCombatStarted)
                gmLog({ text: `All enemies are down, but ${bleeding.map(e => e.name).join(' and ')} ${bleeding.length > 1 ? 'are' : 'is'} still Bleeding Out. Combat continues so the party can save them.`, kind: 'bleed' });
            return;
        }
    } else if (entry.currentHp > 0) {
        if (entry.bleedOutTurns != null) _gmSetPlayerCondition(entry, 'bleedingout', false);
        entry.bleedOutTurns = null;
        entry.stabilized = false;
        _syncHpToPlayer(entry);
    } else {
        _syncHpToPlayer(entry);
    }
    window.renderInitiativeTracker();
    // Refresh token colours (dead/bleed-out). Combat never ends here — a player at
    // 0 HP is BLEEDING OUT, not dead (see _killBledOutPlayer).
    if (typeof window._btRefreshAllOpenMaps === 'function') window._btRefreshAllOpenMaps();
}

// Wound Threshold reminder: a party member hit by more damage than their
// Wound Threshold (CON score x2, plus perk boosts) in one go.
function _gmWoundThreshold(entry) {
    let pm = (window.gmParty || []).find(p => p.fileName === entry.playerUid || p.summary?.playerUid === entry.playerUid || (p.summary?.name && p.summary.name === entry.name));
    let wt = pm?.summary?.woundThreshold;
    if (wt == null && pm?.state && typeof computeCharSummary === 'function') { try { wt = computeCharSummary(pm.state).woundThreshold; } catch (e) {} }
    return wt == null || isNaN(wt) ? null : wt;
}
function _gmCheckWoundThreshold(entry, dmg) {
    if (!entry || entry.faction !== 'player' || !(dmg > 0)) return;
    let wt = _gmWoundThreshold(entry);
    if (wt == null || dmg <= wt) return;
    // CON save DC: 10, or half the damage taken (rounded down), whichever is higher
    let dc = Math.max(10, Math.floor(dmg / 2));
    let who = entry.name || 'This character';
    // (no popup: the player's dice tray asks for the save, and the combat log tracks it)
    _gmQueueSave(entry, { type: 'wt', dc, dmg });
    gmLog({ text: `${who} took ${dmg} damage, more than their Wound Threshold (${wt}). They must make a DC ${dc} CON save to resist being wounded.`, kind: 'wt',
        ask: entry.playerUid ? { uid: entry.playerUid, roll: 'save', dc } : null });
}
window._gmCheckWoundThreshold = _gmCheckWoundThreshold;
// Damage typed as "-N" (or a lower value) in the tracker
function _gmDamageFrom(value, beforeTotal, afterTotal) {
    let m = String(value).trim().match(/^-\s*(\d+)$/);
    if (m) return parseInt(m[1], 10);
    return Math.max(0, beforeTotal - afterTotal);
}

// Temp HP box: typed value sets Temp HP; a negative result overflows into HP.
window.setInitiativeTempHp = function(id, value) {
    let entry = window.gmInitiative.find(e => e.id === id);
    if (!entry) return;
    let result = window.parseMathExpression(value, entry.tempHp || 0);
    if (result === null) { window.renderInitiativeTracker(); return; }
    let wasAboveZero = entry.currentHp === null || entry.currentHp > 0;
    let before = (entry.currentHp || 0) + (entry.tempHp || 0);
    if (result < 0) {
        let r = window.apxApplyHpInput(String(result), entry.currentHp, 0, entry.maxHp);
        entry.tempHp = 0;
        if (r) entry.currentHp = r.currentHp;
    } else {
        entry.tempHp = result;
    }
    let tmpAfter = (entry.currentHp || 0) + (entry.tempHp || 0);
    let tmpDmg = _gmDamageFrom(value, before, tmpAfter);
    let tmpTyped = /^\s*-\s*\d+\s*$/.test(String(value));
    let tmpHit = (tmpTyped || tmpDmg > 0) ? (_gmTakeHit(entry) || (tmpTyped ? _gmTurnHit(entry) : null)) : null;
    let tmpExtras = tmpHit ? _gmHitExtraDamage(entry, tmpHit) : [];
    let tmpExtra = tmpExtras.reduce((t, x) => t + x.n, 0);
    if (tmpExtra > 0) {
        let r2 = window.apxApplyHpInput('-' + tmpExtra, entry.currentHp, entry.tempHp, entry.maxHp);
        if (r2) { entry.currentHp = r2.currentHp; entry.tempHp = r2.tempHp; }
        tmpAfter = (entry.currentHp || 0) + (entry.tempHp || 0);
        tmpDmg += tmpExtra;
    }
    _gmLogHpChange(entry, before, tmpAfter, wasAboveZero, tmpDmg, tmpHit);
    _gmCheckWoundThreshold(entry, tmpDmg);       // Wound Threshold first, then the hit's own saves, then Bleed Out
    if (tmpHit) _gmHitEffects(entry, tmpHit, tmpExtras);
    _afterHpChange(entry, wasAboveZero);
};

// HP box: "-N" damage hits Temp HP first, leftover carries to HP; "+N" heals; "N" sets.
// Same rule as the character sheet (window.apxApplyHpInput), and both values sync.
window.updateInitiativeHp = function(id, value) {
    let entry = window.gmInitiative.find(e => e.id === id);
    if (!entry) return;
    let wasAboveZero = entry.currentHp === null || entry.currentHp > 0;
    let r = window.apxApplyHpInput(value, entry.currentHp, entry.tempHp, entry.maxHp);
    if (!r) { window.renderInitiativeTracker(); return; }
    let before = (entry.currentHp || 0) + (entry.tempHp || 0);
    entry.currentHp = r.currentHp;
    entry.tempHp = r.tempHp;
    let after = (entry.currentHp || 0) + (entry.tempHp || 0);
    let dmg = _gmDamageFrom(value, before, after);
    // Damage right after an attack roll (even -0: DR/ER stopped it all) is that attack's hit
    let typedHit = /^\s*-\s*\d+\s*$/.test(String(value));
    let hit = (typedHit || dmg > 0) ? (_gmTakeHit(entry) || (typedHit ? _gmTurnHit(entry) : null)) : null;
    let extras = hit ? _gmHitExtraDamage(entry, hit) : [];
    let extra = extras.reduce((t, x) => t + x.n, 0);
    if (extra > 0) {
        let r2 = window.apxApplyHpInput('-' + extra, entry.currentHp, entry.tempHp, entry.maxHp);
        if (r2) { entry.currentHp = r2.currentHp; entry.tempHp = r2.tempHp; }
        after = (entry.currentHp || 0) + (entry.tempHp || 0);
        dmg += extra;   // counts toward the Wound Threshold as part of the same hit
    }
    _gmLogHpChange(entry, before, after, wasAboveZero, dmg, hit);
    _gmCheckWoundThreshold(entry, dmg);          // Wound Threshold first, then the hit's own saves, then Bleed Out
    if (hit) _gmHitEffects(entry, hit, extras);
    _afterHpChange(entry, wasAboveZero);
};

window.toggleSurprised = function(id, checked) {
    let entry = window.gmInitiative.find(e => e.id === id);
    if (!entry) return;
    entry.surprised = checked;
    // Pre-combat, the list stays auto-sorted -- a changed score should
    // re-place them. Mid-combat, order is locked in; only their
    // displayed number changes, since repositioning would disturb whose
    // turn is currently up.
    if (!window.gmCombatStarted) {
        let idx = window.gmInitiative.findIndex(e => e.id === id);
        let wasCurrent = idx === window.gmCurrentTurnIdx;
        window.gmInitiative.splice(idx, 1);
        if (idx < window.gmCurrentTurnIdx) window.gmCurrentTurnIdx--;
        let insertIdx = window.gmInitiative.findIndex(e => initiativeCompare(entry, e) < 0);
        if (insertIdx === -1) insertIdx = window.gmInitiative.length;
        window.gmInitiative.splice(insertIdx, 0, entry);
        if (insertIdx <= window.gmCurrentTurnIdx) window.gmCurrentTurnIdx++;
        if (wasCurrent) window.gmCurrentTurnIdx = insertIdx;
    }
    window.renderInitiativeTracker();
};

// ── Player death ──────────────────────────────────────────────────────────
// 0 HP  → BLEEDING OUT (red token, counter ticks each of their turns)
// counter hits 0 → DEAD (grey token, removed from initiative)
// Combat only offers to end once EVERY player in the fight has actually died.
function _killBledOutPlayer(entry) {
    let name = entry.name;
    _gmSetPlayerCondition(entry, 'bleedingout', false);
    window.removeFromInitiative(entry.id, { dead: true });   // token turns grey
    let anyPlayerLeft = window.gmInitiative.some(e => e.faction === 'player');
    setTimeout(() => {
        if (window.gmCombatStarted && !anyPlayerLeft) {
            window.showConfirm(`${name} has bled out and died. All players are dead — end combat?`, () => window.endCombat(), true);
        } else {
            window.showConfirm(`${name} has bled out and died.`, null, true);
        }
    }, 150);
}

window.adjustBleedOutTurns = function(id, delta) {
    let entry = window.gmInitiative.find(e => e.id === id);
    if (!entry || entry.bleedOutTurns === null || entry.bleedOutTurns === undefined) return;
    entry.bleedOutTurns = Math.max(0, entry.bleedOutTurns + delta);
    if (entry.bleedOutTurns === 0) { _killBledOutPlayer(entry); return; }
    window.renderInitiativeTracker();
    if (typeof window._btRefreshAllOpenMaps === 'function') window._btRefreshAllOpenMaps();
    if (typeof window.saveWorldNotes === 'function') window.saveWorldNotes();
};

window.openBleedOutModal = function(id) {
    let entry = window.gmInitiative.find(e => e.id === id);
    if (!entry) return;
    document.getElementById('bleedOutModalName').innerText = `${entry.name} has dropped to 0 HP.` +
        (entry.playerUid && window.gmCombatStarted ? ` Their CON (Survive) check sets the rounds (half the result, rounded down, min 1). It fills in automatically when they roll it${(window._gmPendingSaves[entry.id] || []).some(x => x.type === 'wt') ? ', after their Wound Threshold save' : ''}, or type it here.` : '');
    document.getElementById('bleedOutTurnsInput').value = '';
    document.getElementById('bleedOutModal').dataset.entryId = id;
    window.openModal('bleedOutModal');
};

window.confirmBleedOut = function() {
    let id = document.getElementById('bleedOutModal').dataset.entryId;
    let entry = window.gmInitiative.find(e => e.id === id);
    let turns = parseInt(document.getElementById('bleedOutTurnsInput').value);
    if (entry && !isNaN(turns) && turns > 0) { entry.bleedOutTurns = turns; _gmSetPlayerCondition(entry, 'bleedingout', true); }
    window.closeModal('bleedOutModal');
    window.renderInitiativeTracker();
    // Save immediately so player maps show bleed-out state without waiting for the next turn cycle
    if (typeof window._btRefreshAllOpenMaps === 'function') window._btRefreshAllOpenMaps();
    if (typeof window.saveWorldNotes === 'function') window.saveWorldNotes();
};

window.stabilizeEntry = function(id) {
    let entry = window.gmInitiative.find(e => e.id === id);
    if (!entry) return;
    entry.bleedOutTurns = null;
    entry.stabilized = true;   // still at 0 HP, but no longer bleeding
    _gmSetPlayerCondition(entry, 'bleedingout', false);
    window.renderInitiativeTracker();
    if (typeof window._btRefreshAllOpenMaps === 'function') window._btRefreshAllOpenMaps();
    if (typeof window.saveWorldNotes === 'function') window.saveWorldNotes();
};

// Arrows only ever appear for a genuine, unresolved tie (same effective
// initiative, and not the auto-resolved PC-vs-NPC case) -- and only ever
// swap with a neighbor that's part of that same tie, so a tied pair can
// never accidentally get shuffled out into a different initiative tier.
window.moveInitiativeEntry = function(id, dir) {
    let idx = window.gmInitiative.findIndex(e => e.id === id);
    if (idx === -1) return;
    let newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= window.gmInitiative.length) return;
    let a = window.gmInitiative[idx], b = window.gmInitiative[newIdx];
    if (effInit(a) !== effInit(b) || isAutoResolvedTie(a, b)) return;
    window.gmInitiative[idx] = b;
    window.gmInitiative[newIdx] = a;
    if (window.gmCurrentTurnIdx === idx) window.gmCurrentTurnIdx = newIdx;
    else if (window.gmCurrentTurnIdx === newIdx) window.gmCurrentTurnIdx = idx;
    window.renderInitiativeTracker();
};

// ── Battle map for this fight (optional) ─────────────────────────────
// null = only maps the GM has open. Picking a map links the tracker to its tokens
// even while it's closed. Cleared when the tracker is cleared or combat ends.
window.gmCombatMapId = null;
function _gmRenderCombatMapSel() {
    let sel = document.getElementById('gmCombatMapSel'); if (!sel) return;
    let maps = (typeof _wNotes !== 'undefined' && _wNotes.otherMaps) || [];
    if (window.gmCombatMapId && !maps.some(m => m.id === window.gmCombatMapId)) window.gmCombatMapId = null;
    let esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    let html = `<option value="">No map (or whichever map is open)</option>` +
        maps.map(m => `<option value="${esc(m.id)}" ${m.id === window.gmCombatMapId ? 'selected' : ''}>${esc(m.name || 'Untitled map')}</option>`).join('');
    if (sel.innerHTML !== html) sel.innerHTML = html;
    sel.value = window.gmCombatMapId || '';
}
window.setCombatMap = function(mapId) {
    window.gmCombatMapId = mapId || null;
    if (window.gmCombatMapId && typeof window._btLinkUnlinked === 'function') window._btLinkUnlinked(window.gmCombatMapId);
    window.renderInitiativeTracker();
    if (typeof window._btRefreshAllOpenMaps === 'function') window._btRefreshAllOpenMaps();
    if (typeof window.saveWorldNotes === 'function') window.saveWorldNotes();
};

window.clearInitiative = function() {
    window.showConfirm("Clear the entire initiative tracker? This also ends combat and discards any unpaid XP.", () => {
        window.gmInitiative = [];
        window.gmCurrentTurnIdx = 0;
        window.gmCombatStarted = false;
        window.gmRoundNumber = 1;
        window.gmTurnNumber = 1;
        window.gmPendingXp = 0;
        window.gmLairSharedTraitKey = null;
        window.gmInLair = false;
        window.gmCombatMapId = null;
        window.closeAllFloatingStatBlocks();
        window.renderInitiativeTracker();
        // Push cleared state to maps so gold highlights disappear on GM and player maps
        if (typeof window._btRefreshAllOpenMaps === 'function') window._btRefreshAllOpenMaps();
        if (typeof window.saveWorldNotes === 'function') window.saveWorldNotes();
    });
};

// Totals XP from every defeated enemy/ally/neutral this combat (their TP
// value, stashed at the moment they were removed for hitting 0 HP) and
// splits it evenly across however many players are currently in the
// tracker, rounded down. Combat never ends on its own just because every
// non-player hit 0 -- the GM might still add more, or a Mythic Awakening
// could bring one back -- so this is the only thing that actually ends it.
// Players at 0 HP who are still Bleeding Out (not stabilized, not dead)
function _gmBleedingPlayers() {
    return (window.gmInitiative || []).filter(e => e.faction === 'player' && e.currentHp !== null && e.currentHp <= 0 && !e.stabilized);
}
window.endCombat = async function(force) {
    // Someone still Bleeding Out: the fight isn't over until they're saved (or lost)
    let bleeding = force === true ? [] : _gmBleedingPlayers();
    if (bleeding.length && window.gmCombatStarted) {
        let names = bleeding.map(e => e.name + (e.bleedOutTurns != null ? ` (${e.bleedOutTurns} round${e.bleedOutTurns === 1 ? '' : 's'} left)` : '')).join(', ');
        let ok = window.apxConfirm ? await window.apxConfirm(`${names} ${bleeding.length > 1 ? 'are' : 'is'} still Bleeding Out. Combat keeps going so the party can stabilize or heal them. End combat anyway?`, { title: 'Someone is Bleeding Out', okLabel: 'End anyway', danger: true }) : true;
        if (!ok) return;
    }
    // XP is split evenly between EVERY survivor on the party's side: players and allies.
    // Anyone still in the tracker is alive (the dead are removed), including players
    // who are bleeding out. Allies take a share but, being NPCs, their share isn't paid out.
    let survivors = window.gmInitiative.filter(e => (e.faction === 'player' || e.faction === 'ally') && !e.companionOf);   // Loyal Companions don't take a share
    let players   = survivors.filter(e => e.faction === 'player');
    let allyCount = survivors.length - players.length;
    let totalXp = window.gmPendingXp;
    let perPlayer = survivors.length > 0 ? Math.floor(totalXp / survivors.length) : 0;
    let split = `${players.length} player${players.length===1?'':'s'}${allyCount ? ` + ${allyCount} all${allyCount===1?'y':'ies'}` : ''}`;
    let message = survivors.length > 0
        ? `Combat ended. ${totalXp} XP earned — ${perPlayer} XP each, split between ${split}.`
        : `Combat ended. ${totalXp} XP earned, but no surviving players or allies to split it.`;
    window.showConfirm(message, () => {
        gmLog({ text: message, kind: 'xp' });
        // Distribute XP to each surviving player via their initiative entry
        if (perPlayer > 0) {
            let worlds = typeof _gmWorlds !== 'undefined' ? _gmWorlds : [];
            let activeWorld = worlds.find(w => (w.worldId||w.id) === (typeof _activeWorldId !== 'undefined' ? _activeWorldId : null));
            let inviteCode = activeWorld?.inviteCode;
            players.filter(e => e.playerUid).forEach(e => {
                if (inviteCode && window.apxAuth?.enabled && typeof window.apxAuth.addXpToPlayer === 'function') {
                    window.apxAuth.addXpToPlayer(inviteCode, e.playerUid, perPlayer, {
                        name: `Combat (Round ${window.gmRoundNumber})`, date: new Date().toISOString().slice(0, 10),
                        session: (typeof _wNotes !== 'undefined' && (_wNotes.session || []).length) || null,
                        description: `${totalXp} XP split between ${split}.` })
                        .catch(err => console.warn('XP grant error:', err.message));
                }
            });
        }
        window.gmInitiative = [];
        window.gmCurrentTurnIdx = 0;
        window.gmCombatStarted = false;
        window.gmRoundNumber = 1;
        window.gmTurnNumber = 1;
        window.gmPendingXp = 0;
        window.gmLairSharedTraitKey = null;
        window.gmInLair = false;
        window.gmCombatMapId = null;
        window.closeAllFloatingStatBlocks();
        window.renderInitiativeTracker();
        if (typeof window._btRefreshAllOpenMaps === 'function') window._btRefreshAllOpenMaps();
        if (typeof window.saveWorldNotes === 'function') window.saveWorldNotes();
    }, true);
};

// Locks the current order in (one final stable sort, so any manual tie
// breaks the GM already made are preserved) and starts Round 1, Turn 1.
// After this, new arrivals join at the bottom instead of auto-sorting in.
window.startCombat = function() {
    window.gmInitiative.sort(initiativeCompare);
    window.gmCombatStarted = true;
    window.gmCurrentTurnIdx = 0;
    window.gmRoundNumber = 1;
    window.gmTurnNumber = 1;
    window.gmInitiative.forEach(x => { x.apCur = 0; x._apTurns = 0; x._apFirstSurprised = false; });
    window.gmCombatLog = []; window._gmPendingSaves = {}; window._gmResolvedSaves = {};
    _gmSetLootDefeated(0); window.renderGmLoot && window.renderGmLoot();   // counts the enemies of this fight
    _gmLogSession = 'c' + Date.now().toString(36);
    gmLog({ text: 'Combat started. Round 1.', kind: 'info' });
    if (window.gmInitiative[0]) gmStartTurnAp(window.gmInitiative[0]);
    window.renderInitiativeTracker();
    if (typeof window._btRefreshAllOpenMaps === 'function') window._btRefreshAllOpenMaps();
    if (typeof window.saveWorldNotes === 'function') window.saveWorldNotes();
};

window.nextInitiativeTurn = function() {
    if (!window.gmInitiative.length) return;
    _gmExpireCondTimers(window.gmInitiative[window.gmCurrentTurnIdx]);
    window.gmCurrentTurnIdx++;
    if (window.gmCurrentTurnIdx >= window.gmInitiative.length) {
        window.gmCurrentTurnIdx = 0;
        window.gmRoundNumber++;
        gmLog({ text: `Round ${window.gmRoundNumber}.`, kind: 'info' });
    }
    window.gmTurnNumber++;
    let current = window.gmInitiative[window.gmCurrentTurnIdx];
    if (current) gmStartTurnAp(current);
    if (current && current.bleedOutTurns > 0) {
        current.bleedOutTurns--;
        if (current.bleedOutTurns === 0) { _killBledOutPlayer(current); return; }
    }
    window.renderInitiativeTracker();
    // Refresh battle map tokens and push current-turn data to players
    if (typeof window._btRefreshAllOpenMaps === 'function') window._btRefreshAllOpenMaps();
    if (typeof window.saveWorldNotes === 'function') window.saveWorldNotes();
};

window.prevInitiativeTurn = function() {
    if (!window.gmInitiative.length) return;
    window.gmCurrentTurnIdx--;
    if (window.gmCurrentTurnIdx < 0) {
        window.gmCurrentTurnIdx = window.gmInitiative.length - 1;
        window.gmRoundNumber = Math.max(1, window.gmRoundNumber - 1);
    }
    window.gmTurnNumber = Math.max(1, window.gmTurnNumber - 1);
    window.renderInitiativeTracker();
    if (typeof window._btRefreshAllOpenMaps === 'function') window._btRefreshAllOpenMaps();
};

// Limited-use Power bubbles on an NPC's initiative card -- only for
// Powers with Charges or Recharge (Unlimited ones need no tracking).
// Usage lives on the initiative entry itself, not the NPC's saved data,
// so multiple copies of the same monster track independently and closing
// the tracker never burns a charge off the NPC's master sheet.
function renderInitiativePowerBubbles(e) {
    let sb = ncStatBlockFor(e.sourceNpcId);
    if (!sb) return '';
    let limitedPowers = sb.powerCards.concat(sb.lairActionPowerCards).filter(p => p.usageType === 'charges' || p.usageType === 'recharge');
    if (!limitedPowers.length) return '';
    if (!e.powerUsage) e.powerUsage = {};
    return limitedPowers.map(p => {
        let used = e.powerUsage[p.name] || 0;
        if (p.usageType === 'charges') {
            let max = p.maxCharges || 1;
            if (used > max) used = max;
            return `
                <div class="flex items-center gap-2 text-[9px] text-slate-400">
                    <span class="font-bold shrink-0">${p.name}</span>
                    <button onclick="window.adjustInitiativePowerCharges('${e.id}', '${p.name.replace(/'/g, "\\'")}', -1)" class="w-4 h-4 rounded bg-slate-700 hover:bg-slate-600 text-white font-bold text-[9px] leading-none">-</button>
                    <span>${max - used}/${max}</span>
                    <button onclick="window.adjustInitiativePowerCharges('${e.id}', '${p.name.replace(/'/g, "\\'")}', 1)" class="w-4 h-4 rounded bg-slate-700 hover:bg-slate-600 text-white font-bold text-[9px] leading-none">+</button>
                </div>
            `;
        }
        let isUsed = used > 0;
        return `
            <div class="flex items-center gap-2 text-[9px] text-slate-400">
                <span class="font-bold shrink-0">${p.name} <span class="text-slate-500">(Recharge 5-6)</span></span>
                <button onclick="window.adjustInitiativePowerCharges('${e.id}', '${p.name.replace(/'/g, "\\'")}', -1)" class="w-4 h-4 rounded bg-slate-700 hover:bg-slate-600 text-white font-bold text-[9px] leading-none">-</button>
                <span>${isUsed ? 'Used' : 'Available'}</span>
                <button onclick="window.adjustInitiativePowerCharges('${e.id}', '${p.name.replace(/'/g, "\\'")}', 1)" class="w-4 h-4 rounded bg-slate-700 hover:bg-slate-600 text-white font-bold text-[9px] leading-none">+</button>
            </div>
        `;
    }).join('');
}
// Same "delta matches what's displayed" convention as the companion's own
// charges control: "-" spends a charge (displayed remaining count drops),
// "+" restores one, regardless of whether this is Charges or Recharge.
window.adjustInitiativePowerCharges = function(entryId, powerName, delta) {
    let e = window.gmInitiative.find(x => x.id === entryId);
    if (!e) return;
    if (!e.powerUsage) e.powerUsage = {};
    let current = e.powerUsage[powerName] || 0;
    e.powerUsage[powerName] = Math.max(0, current - delta);
    window.renderInitiativeTracker();
};
window.toggleInitiativePowerSlot = function(entryId, powerName, idx) {
    let e = window.gmInitiative.find(x => x.id === entryId);
    if (!e) return;
    if (!e.powerUsage) e.powerUsage = {};
    let current = e.powerUsage[powerName] || 0;
    let target = idx + 1;
    e.powerUsage[powerName] = (current === target) ? idx : target;
    window.renderInitiativeTracker();
};

// AP pool per creature. Unspent AP carries over between turns with no cap;
// pips show its AP plus one empty stored pip, growing as the pool fills.
// NPCs: click pips to spend/refund. Players: mirrors their sheet.
function gmApMax(e) { return Math.max(0, parseInt(e.ap) || 0); }
function gmApCurrent(e) {
    let max = gmApMax(e);
    let cur = e.apCur;
    if (cur === undefined || cur === null) cur = window.gmCombatStarted ? 0 : max;   // gains AP at the start of its first turn
    return Math.max(0, Math.floor(Number(cur) || 0));
}
// A Surprised creature gains only 1 AP at the start of its first turn of combat
// (this includes creatures added mid-combat that enter Surprised).
function gmStartTurnAp(e) {
    let first = e._apTurns === 0 || (e._apTurns == null && e.apCur == null);   // older saved combats: only brand-new entries
    e._apTurns = (e._apTurns || 0) + 1;
    e._apFirstSurprised = !!(first && e.surprised);
    if (e.faction === 'player') return;   // players' sheets add their own AP when their turn starts
    e.apCur = gmApCurrent(e) + (e._apFirstSurprised ? 1 : gmApMax(e));
    if (_gmIsStunned(e)) {   // a Stunned creature starts its turn with no AP
        e.apCur = 0;
        gmLog({ text: `${_gmPublicName(e)} is Stunned and has no AP this turn.`, gmText: `${_gmGmName(e)} is Stunned: AP set to 0.`, kind: 'info' });
    }
}
// Prone removed during combat: standing up cost the creature 2 AP (NPCs; players' sheets handle their own)
window._gmStandUpAp = function(entryId) {
    let e = (window.gmInitiative || []).find(x => x.id === entryId);
    if (!e || !window.gmCombatStarted || e.faction === 'player') return;
    let have = gmApCurrent(e), cost = 2;
    e.apCur = Math.max(0, have - cost);
    gmLog({ text: `${e.name} stands up.`, gmText: `${e.name} stands up (−${Math.min(have, cost)} AP${have < cost ? `, had only ${have}` : ''}, ${e.apCur} left).`, kind: 'info' });
};
function gmApPipsHtml(e) {
    let max = gmApMax(e);
    let cur, isPlayer = e.faction === 'player' && e.playerUid;
    if (isPlayer) {
        let pm = (window.gmParty || []).find(p => p.fileName === e.playerUid || p.summary?.playerUid === e.playerUid);
        let st = pm?.state || {};
        cur = st.apCurrent !== undefined && st.apCurrent !== null ? st.apCurrent : max - (st.apUsed || 0);
        cur = Math.max(0, Math.floor(Number(cur) || 0));
    } else cur = gmApCurrent(e);
    let pips = Array.from({ length: Math.min(500, Math.max(max, cur) + 1) }, (_, i) => {
        let filled = i < cur, stored = i >= max;
        let st = `width:7px;height:7px;border-radius:50%;display:inline-block;padding:0;border:1px ${stored ? 'dashed #67e8f9' : 'solid #60a5fa'};background:${filled ? (stored ? '#06b6d4' : '#3b82f6') : 'transparent'};${i === max ? 'margin-left:3px;' : ''}`;
        return isPlayer ? `<span style="${st}"></span>`
            : `<button onclick="window.gmClickApPip('${e.id}', ${i})" title="${filled ? 'Spend' : 'Add'} AP" style="${st}cursor:pointer"></button>`;
    }).join('');
    return `<span class="flex items-center gap-0.5 flex-wrap" title="${isPlayer ? 'Tracked on the player\'s sheet' : 'AP now (gains its AP at the start of each turn; unspent AP carries over, no cap)'}"><b class="${cur === 0 ? 'text-red-400' : 'text-blue-300'}">AP ${cur}/${max}</b>${pips}</span>`;
}
// NPC attack rolls from a stat block spend that creature's AP. When several
// initiative entries share the stat block, the one whose turn it is pays
// (or the one whose stat block window was opened from its initiative card).
// Not enough AP: the attack still rolls, with a note for the GM.
window.apxBeforeAttack = function(o) {
    // A player's Loyal Companion (stat block opened from the Party panel): its initiative entry pays
    if (o && o.companion && o.compOwner && window.gmCombatStarted) {
        let e = (window.gmInitiative || []).find(x => x.companionOf === o.compOwner);
        if (!e) return null;
        let cost = Math.max(0, parseInt(o.apCost) || 3), have = gmApCurrent(e);
        if (have < cost) return { note: `Not enough AP: ${e.name} has ${have}, needs ${cost}`, warn: true };
        e.apCur = have - cost; window.renderInitiativeTracker();
        return { note: `${e.name}: -${cost} AP (${e.apCur} left)` };
    }
    if (!o || !o.npcId || !window.gmCombatStarted) return null;
    let cost = Math.max(0, parseInt(o.apCost) || 3);
    let list = (window.gmInitiative || []).filter(x => x.sourceNpcId === o.npcId && x.faction !== 'player');
    if (!list.length) return null;
    let cur = window.gmInitiative[window.gmCurrentTurnIdx];
    let e = (cur && list.includes(cur)) ? cur
        : (o.initId && list.find(x => x.id === o.initId)) || (list.length === 1 ? list[0] : null);
    if (!e) return { note: `AP not spent: ${list.length} creatures use this stat block and none is taking its turn`, warn: true };
    let have = gmApCurrent(e);
    // Flurry: this creature hit with this weapon earlier this turn
    let fl = window._gmFlurry[e.id], flurryNote = '';
    if (fl && fl.turn === window.gmTurnNumber && o.hit && fl.weapon === o.hit.weapon && cost > 1) { cost -= 1; flurryNote = ` · Flurry −1 AP (if attacking ${fl.targetName} again)`; }
    let flurryTip = o.flurry ? 'Flurry: after a hit, later attacks on that target cost 1 less AP (min 1). Click a pip to refund it.' : '';
    if (have < cost) return { note: `Not enough AP: ${e.name} has ${have}, needs ${cost}`, warn: true, tip: flurryTip };
    e.apCur = have - cost;
    window.renderInitiativeTracker();
    return { note: `${e.name}: -${cost} AP (${e.apCur} left)${flurryNote}`, tip: flurryTip };
};

window.gmClickApPip = function(id, i) {
    let e = window.gmInitiative.find(x => x.id === id); if (!e) return;
    let cur = gmApCurrent(e);
    e.apCur = Math.max(0, i < cur ? i : i + 1);
    window.renderInitiativeTracker();
};

window.renderInitiativeTracker = function() {
    let body = document.getElementById('initiativeTrackerBody');
    if (!body) return;
    let roundTurnEl = document.getElementById('initiativeRoundTurn');
    if (roundTurnEl) roundTurnEl.innerText = window.gmCombatStarted ? `Round ${window.gmRoundNumber} -- Turn ${window.gmTurnNumber}` : 'Combat not started';
    let xpEl = document.getElementById('pendingXpDisplay');
    if (xpEl) xpEl.innerText = window.gmPendingXp > 0 ? `Pending XP from defeated foes: ${window.gmPendingXp}` : '';
    let lairWrap = document.getElementById('inLairToggleWrap');
    if (lairWrap) {
        lairWrap.classList.toggle('hidden', !window.gmLairSharedTraitKey);
        document.getElementById('inLairToggle').checked = window.gmInLair;
    }

    _gmRenderCombatMapSel();
    if (!window.gmInitiative.length) {
        body.innerHTML = '<div class="text-xs text-slate-500 text-center py-4">No one in the initiative order yet. Add party members, NPCs, or a quick NPC above.</div>';
        return;
    }
    let n = window.gmInitiative.length;
    let order = Array.from({ length: n }, (_, i) => (window.gmCurrentTurnIdx + i) % n);

    body.innerHTML = order.map((idx, pos) => {
        let e = window.gmInitiative[idx];
        let fs = FACTION_STYLES[e.faction] || FACTION_STYLES.neutral;
        let isCurrent = window.gmCombatStarted && pos === 0;

        let upNeighbor = window.gmInitiative[idx - 1], downNeighbor = window.gmInitiative[idx + 1];
        let upEnabled = idx > 0 && effInit(e) === effInit(upNeighbor) && !isAutoResolvedTie(e, upNeighbor);
        let downEnabled = idx < n - 1 && effInit(e) === effInit(downNeighbor) && !isAutoResolvedTie(e, downNeighbor);

        return `
        <div class="${fs.bg} border ${isCurrent ? 'border-amber-400' : fs.border} rounded p-2">
            <div class="flex items-center gap-2">
                <div class="flex flex-col">
                    <button onclick="window.moveInitiativeEntry('${e.id}', -1)" ${upEnabled ? '' : 'disabled'} class="leading-none ${upEnabled ? 'text-slate-300 hover:text-white' : 'text-slate-700'}">&#9650;</button>
                    <button onclick="window.moveInitiativeEntry('${e.id}', 1)" ${downEnabled ? '' : 'disabled'} class="leading-none ${downEnabled ? 'text-slate-300 hover:text-white' : 'text-slate-700'}">&#9660;</button>
                </div>
                <div class="w-8 text-center text-sm font-black ${fs.text}">${effInit(e)}</div>
                <span class="flex-1 text-xs font-bold ${isCurrent ? 'text-amber-300' : fs.text} ${(e.faction !== 'player' || e.playerUid) ? 'cursor-pointer hover:underline' : ''}" ${e.faction !== 'player' ? `onclick="window.openFloatingStatBlock('${e.id}')" title="Click for full stat block"` : (e.playerUid ? `onclick="window._btOpenPlayerSummary && window._btOpenPlayerSummary('${String(e.name).replace(/'/g, '')}','${e.playerUid}')" title="Click for this player's stats"` : '')}>${e.name}</span>
                ${e.maxHp !== null ? `
                    <input type="text" value="${e.currentHp}" onchange="window.updateInitiativeHp('${e.id}', this.value)" title="Type a number to set HP, or +N/-N to heal/damage" class="w-12 text-center bg-slate-800 border-red-800/50 text-red-300 text-xs font-bold">
                    <span class="text-[10px] text-slate-500">/ ${e.maxHp}</span>
                ` : '<span class="text-[9px] text-slate-600 w-20 text-center">no HP tracked</span>'}
                <button onclick="window.removeFromInitiative('${e.id}')" class="text-red-500 hover:text-red-400 font-bold text-xs">&times;</button>
            </div>
            <div class="pl-6 mt-1 space-y-0.5">
                <div class="flex items-center gap-2 flex-wrap text-[9px] ${fs.text} opacity-90">
                    <span>${fs.label}</span>
                    ${e.ap !== undefined && e.ap !== null ? gmApPipsHtml(e) : ''}
                    ${(e.ac !== undefined && e.ac !== null) ? `<span>AC <b class="text-white">${e.ac}</b></span>` : ''}
                    ${(e.dr !== undefined && e.dr !== null) ? `<span>DR <b class="text-white">${e.dr}</b></span>` : ''}
                    ${(e.er !== undefined && e.er !== null) ? `<span>ER <b class="text-white">${e.er}</b></span>` : ''}
                    ${e.maxHp !== null ? `
                        <span class="flex items-center gap-1 text-cyan-400">Temp
                            <input type="text" value="${e.tempHp || 0}" onchange="window.setInitiativeTempHp('${e.id}', this.value)" title="Type a number to set Temp HP, or +N/-N to adjust" class="w-8 text-center bg-slate-800 border-cyan-800/50 text-cyan-300 text-[9px] font-bold px-0.5">
                        </span>
                    ` : ''}
                </div>
                ${e.lairTraitNote ? `<div class="text-[9px] text-amber-400 font-bold">${e.lairTraitNote}</div>` : ''}
                ${e.faction !== 'player' ? (() => {
                    let conds = window._gmEntryConditions ? window._gmEntryConditions(e.id) : (e.conditions || []);
                    let nm = id => window._gmCondName ? window._gmCondName(id) : id;
                    let eff = window.apxEffectiveConditions ? window.apxEffectiveConditions(conds) : conds.map(id => ({ id }));
                    return `<div class="flex items-center gap-1 flex-wrap">
                        ${eff.map(c => c.from
                            ? `<span class="apx-cond-chip" style="border-style:dashed;opacity:.8" title="From ${nm(c.from)}: ends when ${nm(c.from)} ends">${nm(c.id)}</span>`
                            : `<span class="apx-cond-chip" title="Click × to remove">${nm(c.id)}<button onclick="window._gmRemoveEntryCondition ? window._gmRemoveEntryCondition('${e.id}','${c.id}') : null">&times;</button></span>`).join('')}
                        <button onclick="window._gmEntryCondPicker && window._gmEntryCondPicker('${e.id}', event)" class="text-[9px] font-bold text-orange-300 hover:text-orange-200">+ Condition</button>
                    </div>`;
                })() : ''}
                ${e.sourceNpcId ? renderInitiativePowerBubbles(e) : ''}
                ${isCurrent ? '<div class="text-[9px] text-amber-300 font-bold">Current Turn</div>' : ''}
                <label class="flex items-center gap-1 text-[9px] text-slate-400">
                    <input type="checkbox" ${e.surprised ? 'checked' : ''} onchange="window.toggleSurprised('${e.id}', this.checked)" title="-10 initiative, and gains only 1 AP at the start of its first turn"> Surprised (-10)
                </label>
                ${e.bleedOutTurns !== null && e.bleedOutTurns !== undefined ? `
                    <div class="mt-1 flex items-center gap-2 flex-wrap rounded border border-red-800/70 bg-red-950/40 px-2 py-1" title="Rounds until ${String(e.name || '').replace(/"/g, '&quot;')} bleeds out. It ticks down at the start of each of their turns.">
                        <span class="text-[10px] font-black uppercase tracking-wide text-red-300">Bleeding Out</span>
                        <span class="text-sm font-black text-white leading-none">${e.bleedOutTurns}</span>
                        <span class="text-[10px] text-red-200">round${e.bleedOutTurns === 1 ? '' : 's'} left</span>
                        <span class="flex items-center gap-1 ml-auto">
                            <button onclick="window.adjustBleedOutTurns('${e.id}', -1)" class="px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-900 hover:bg-red-800 text-white" title="Remove a round (for example, they took more damage)">− Round</button>
                            <button onclick="window.adjustBleedOutTurns('${e.id}', +1)" class="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-700 hover:bg-slate-600 text-white" title="Add a round">+ Round</button>
                            <button onclick="window.stabilizeEntry('${e.id}')" class="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-800 hover:bg-emerald-700 text-white" title="They stop bleeding out (still at 0 HP)">Stabilize</button>
                        </span>
                    </div>
                ` : ''}
                ${(e.faction !== 'player' && e.sourceNpcId) ? (() => {
                    // Show +Token button if this NPC doesn't have a battle token on any open map
                    // (only when a battle map is open to put it on: a map-free fight has no token buttons)
                    let mapOpen = typeof _wNotes !== 'undefined' && (_wNotes.otherMaps||[]).some(m => m.battleMapEnabled && document.getElementById('omWin_'+m.id));
                    if (!mapOpen) return '';
                    let hasToken = false;
                    if (typeof _wNotes !== 'undefined') {
                        (_wNotes.otherMaps||[]).forEach(m => {
                            if ((m.battleTokens||[]).some(t=>t.initiativeId===e.id)) hasToken=true;
                        });
                    }
                    return hasToken ? '' : `<button onclick="window._spawnTokenForInitEntry('${e.id}')" class="text-[9px] px-1.5 py-0.5 rounded font-bold mt-0.5" style="background:#065f46;border:1px solid #10b981;color:#6ee7b7;">+ Token</button>`;
                })() : ''}
            </div>
        </div>
    `; }).join('');
};

// ------------------------------------------------------------------
// Floating stat-block windows: clicking an NPC's name in the initiative
// tracker opens a draggable, non-blocking window with its full stat
// block. Unlike the app's modal system, these have no backdrop, so the
// tracker underneath stays fully interactable while one (or several) is
// open. Quick-add NPCs (no underlying saved NPC to look up) get a
// simpler read-only summary instead, since there's no fuller stat block
// to show for them.
// ------------------------------------------------------------------
window.gmFloatingWindows = {}; // entryId -> DOM element
window.apxFloatingZTop = window.apxFloatingZTop || 2000;

window.openFloatingStatBlock = function(entryId) {
    let entry = window.gmInitiative.find(e => e.id === entryId);
    if (!entry || entry.faction === 'player') return;

    if (window.gmFloatingWindows[entryId]) {
        window.apxFloatingZTop++;
        window.gmFloatingWindows[entryId].style.zIndex = window.apxFloatingZTop;
        return;
    }

    let bodyHtml;
    // Build display title: "First Name (Stat Block Name)" or just stat block name
    let sbName  = entry.name || 'NPC';
    let dispName = entry.name || 'NPC';
    if (entry.sourceNpcId && window.gmNpcs.some(n => n.id === entry.sourceNpcId)) {
        let sb   = ncStatBlockFor(entry.sourceNpcId);
        if (sb) sb._initId = entry.id;
        let gmNpc = window.gmNpcs.find(n => n.id === entry.sourceNpcId);
        sbName   = gmNpc?.npc?.name || sbName;
        // If the initiative entry name differs from the stat block name, show "First Name (Stat Block)"
        if (entry.name && entry.name !== sbName) {
            let firstName = entry.name.split(' ')[0];
            dispName = firstName + ' (' + sbName + ')';
        } else {
            dispName = sbName;
        }
        bodyHtml = window.buildStatBlockHtml(sb, false);
    } else {
        bodyHtml = `
            <div class="text-[10px] text-slate-500 mb-2">No detailed stat block on file for this quick-added NPC -- here's what's tracked in the initiative order:</div>
            <div class="grid grid-cols-3 gap-1">
                <div class="text-center bg-slate-900 border border-slate-700 rounded p-1"><div class="text-[9px] text-slate-500 font-bold">Init</div><div class="text-sm font-black text-white">${effInit(entry)}</div></div>
                <div class="text-center bg-slate-900 border border-slate-700 rounded p-1"><div class="text-[9px] text-slate-500 font-bold">HP</div><div class="text-sm font-black text-white">${entry.currentHp !== null ? `${entry.currentHp}/${entry.maxHp}` : '--'}</div></div>
                <div class="text-center bg-slate-900 border border-slate-700 rounded p-1"><div class="text-[9px] text-slate-500 font-bold">AP</div><div class="text-sm font-black text-white">${entry.ap !== null && entry.ap !== undefined ? entry.ap : '--'}</div></div>
            </div>
        `;
    }

    let win = document.createElement('div');
    win.className = 'floating-stat-window';
    win.style.left = `${120 + Object.keys(window.gmFloatingWindows).length * 24}px`;
    win.style.top = `${100 + Object.keys(window.gmFloatingWindows).length * 24}px`;
    window.apxFloatingZTop++;
    win.style.zIndex = window.apxFloatingZTop;
    win.innerHTML = `
        <div class="floating-stat-window-header">
            <span class="text-sm font-black text-white">${dispName}</span>
            <button class="text-slate-400 hover:text-white font-bold text-lg leading-none px-1" onclick="window.closeFloatingStatBlock('${entryId}')">&times;</button>
        </div>
        <div class="floating-stat-window-body">${bodyHtml}</div>
    `;
    document.getElementById('floatingWindowContainer').appendChild(win);
    window.gmFloatingWindows[entryId] = win;

    win.addEventListener('mousedown', () => {
        window.apxFloatingZTop++;
        win.style.zIndex = window.apxFloatingZTop;
    });

    let header = win.querySelector('.floating-stat-window-header');
    let dragging = false, offsetX = 0, offsetY = 0;
    function onMouseDown(e) {
        if (e.target.tagName === 'BUTTON') return; // don't start a drag from the close button
        dragging = true;
        let rect = win.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        e.preventDefault();
    }
    function onMouseMove(e) {
        if (!dragging) return;
        let x = Math.max(0, Math.min(window.innerWidth - 60, e.clientX - offsetX));
        let y = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - offsetY));
        win.style.left = `${x}px`;
        win.style.top = `${y}px`;
    }
    function onMouseUp() { dragging = false; }
    header.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    // Stashed so closeFloatingStatBlock can remove exactly these listeners
    // rather than leaving them piled up on the document indefinitely.
    win._dragCleanup = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };
};

window.closeFloatingStatBlock = function(entryId) {
    let win = window.gmFloatingWindows[entryId];
    if (win) {
        if (win._dragCleanup) win._dragCleanup();
        win.remove();
        delete window.gmFloatingWindows[entryId];
    }
};
window.closeAllFloatingStatBlocks = function() {
    Object.keys(window.gmFloatingWindows).forEach(id => window.closeFloatingStatBlock(id));
};

// Generic floating window spawner — used by companion detail and world NPC
// stat blocks so they open in the same draggable panel as initiative entries.
window.openFloatingStatBlockRaw = function(winId, title, bodyHtml) {
    if (window.gmFloatingWindows[winId]) {
        window.apxFloatingZTop++;
        window.gmFloatingWindows[winId].style.zIndex = window.apxFloatingZTop;
        return;
    }
    let win = document.createElement('div');
    win.className = 'floating-stat-window';
    win.style.left = `${120 + Object.keys(window.gmFloatingWindows).length * 24}px`;
    win.style.top  = `${100 + Object.keys(window.gmFloatingWindows).length * 24}px`;
    window.apxFloatingZTop++;
    win.style.zIndex = window.apxFloatingZTop;
    win.innerHTML = `
        <div class="floating-stat-window-header">
            <span class="text-sm font-black text-white">${title}</span>
            <div style="display:flex;align-items:center;gap:0.35rem;">
                <button style="font-size:9px;font-weight:700;padding:2px 6px;background:#1d4ed8;color:#fff;border:none;border-radius:3px;cursor:pointer;"
                    onclick="window._floatAddToInit('${winId}')">+ Initiative</button>
                <button class="text-slate-400 hover:text-white font-bold text-lg leading-none px-1" onclick="window.closeFloatingStatBlock('${winId}')">&times;</button>
            </div>
        </div>
        <div class="floating-stat-window-body">${bodyHtml}</div>
    `;
    let container = document.getElementById('floatingWindowContainer');
    if (!container) { document.body.appendChild(win); }
    else container.appendChild(win);
    window.gmFloatingWindows[winId] = win;

    win.addEventListener('mousedown', () => { window.apxFloatingZTop++; win.style.zIndex = window.apxFloatingZTop; });
    let header = win.querySelector('.floating-stat-window-header');
    let dragging = false, offsetX = 0, offsetY = 0;
    function onMouseDown(e) {
        if (e.target.tagName === 'BUTTON') return;
        dragging = true;
        let rect = win.getBoundingClientRect();
        offsetX = e.clientX - rect.left; offsetY = e.clientY - rect.top;
        e.preventDefault();
    }
    function onMouseMove(e) {
        if (!dragging) return;
        win.style.left = `${Math.max(0, Math.min(window.innerWidth - 60, e.clientX - offsetX))}px`;
        win.style.top  = `${Math.max(0, Math.min(window.innerHeight - 40, e.clientY - offsetY))}px`;
    }
    function onMouseUp() { dragging = false; }
    header.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    win._dragCleanup = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };
};


// ------------------------------------------------------------------
// Grant XP (Discovery / Role Play). Each player's sheet adds its own
// bonuses (Educated, Expertise, INT) when the grant arrives — the preview
// here uses the same rule (window.apxXpBonus) so the GM sees the real totals.
// ------------------------------------------------------------------
window.openGrantXpModal = function() {
    document.getElementById('gmGrantXp')?.remove();
    // Only players who joined the world online can receive XP (local-file party members have no account)
    let party = (window.gmParty || []).filter(p => p.fileName && !/\.json$/i.test(p.fileName));
    let esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    let sessions = (typeof _wNotes !== 'undefined' && _wNotes.session) ? _wNotes.session.length : 0;
    let log = (typeof _wNotes !== 'undefined' && _wNotes.xpLog) ? _wNotes.xpLog : [];
    let back = document.createElement('div');
    back.id = 'gmGrantXp';
    if (window.apxInjectDialogStyles) window.apxInjectDialogStyles();
    back.className = 'apxdlg-back';
    back.innerHTML = `<div class="apxdlg" style="width:min(560px,100%);max-height:90vh;overflow-y:auto">
        <div class="apxdlg-title">Grant XP</div>
        <div class="gx-grid">
            <label class="gx-full">Name<input id="gxName" placeholder="Found the hidden library"></label>
            <label class="gx-full">Description<textarea id="gxDesc" rows="2" placeholder="What the party did (shows in each player's XP log)"></textarea></label>
            <label>XP each<input id="gxAmt" type="number" min="1" value="5"></label>
            <label>Session<input id="gxSession" type="number" min="1" value="${sessions || 1}"></label>
            <label>Date<input id="gxDate" type="date" value="${new Date().toISOString().slice(0, 10)}"></label>
            <div class="gx-full gx-radios"><span>Type</span>
                <label><input type="radio" name="gxCat" value="discovery" checked> Discovery</label>
                <label><input type="radio" name="gxCat" value="roleplay"> Role Play</label>
                <span class="gx-note">Combat XP is granted automatically when you end combat.</span></div>
        </div>
        <div class="gx-sec">Players</div>
        <div id="gxPlayers">${party.length ? party.map(p => `<label class="gx-p"><input type="checkbox" data-uid="${esc(p.fileName)}" checked> <b>${esc(p.summary?.name || 'Player')}</b> <span data-prev="${esc(p.fileName)}"></span></label>`).join('')
            : '<div class="apxdlg-msg">No players have joined this world yet.</div>'}</div>
        ${log.length ? `<div class="gx-sec">Recent grants</div><div class="gx-log">${log.slice(0, 6).map(l => `<div><b>${esc(l.name)}</b> +${l.amount} ${esc(l.categoryLabel || l.category)} · S${esc(l.session || '-')} · ${esc(l.date || '')} <span>(${esc((l.to || []).join(', '))})</span></div>`).join('')}</div>` : ''}
        <div class="apxdlg-row" style="margin-top:.8rem"><button class="apxdlg-btn apxdlg-cancel" data-x>Cancel</button><button class="apxdlg-btn apxdlg-ok" data-go ${party.length ? '' : 'disabled'}>Grant XP</button></div>
    </div>`;
    if (!document.getElementById('gxCss')) {
        let st = document.createElement('style'); st.id = 'gxCss';
        st.textContent = `.gx-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.45rem;margin:.3rem 0 .5rem}.gx-full{grid-column:1/-1}
        .gx-grid label{display:flex;flex-direction:column;gap:.15rem;font-size:.62rem;font-weight:800;text-transform:uppercase;color:var(--c-text-muted,#94a3b8)}
        .gx-grid input,.gx-grid textarea{background:var(--c-surface2,#0f172a);border:1px solid var(--c-border,#334155);color:var(--c-text,#fff);border-radius:.35rem;padding:.35rem .5rem;font-size:.78rem;text-transform:none;font-weight:600}
        .gx-radios{display:flex;align-items:center;gap:.8rem;flex-wrap:wrap;font-size:.72rem;color:var(--c-text,#fff)}.gx-radios>span:first-child{font-size:.62rem;font-weight:800;text-transform:uppercase;color:var(--c-text-muted,#94a3b8)}
        .gx-radios label{display:flex;align-items:center;gap:.25rem;cursor:pointer}.gx-note{font-size:.62rem;color:var(--c-text-muted,#94a3b8)}
        .gx-sec{font-size:.62rem;font-weight:800;text-transform:uppercase;color:var(--c-text-muted,#94a3b8);margin:.5rem 0 .25rem}
        .gx-p{display:flex;align-items:center;gap:.4rem;font-size:.76rem;color:var(--c-text,#fff);padding:.25rem .1rem;cursor:pointer}.gx-p span{margin-left:auto;font-size:.7rem;color:var(--c-emerald-lt,#6ee7b7);font-weight:800}
        .gx-log{font-size:.66rem;color:var(--c-text-dimmer,#cbd5e1);display:flex;flex-direction:column;gap:.15rem}.gx-log span{color:var(--c-text-muted,#94a3b8)}`;
        document.head.appendChild(st);
    }
    document.body.appendChild(back);
    let cat = () => back.querySelector('input[name="gxCat"]:checked')?.value || 'discovery';
    let preview = () => {
        let amt = Math.max(0, parseInt(back.querySelector('#gxAmt').value) || 0);
        party.forEach(p => {
            let el = back.querySelector(`[data-prev="${CSS.escape(p.fileName)}"]`); if (!el) return;
            let b = window.apxXpBonus ? window.apxXpBonus(p.state, cat(), amt, p.summary?.mods?.INT) : { bonus: 0, parts: [] };
            el.textContent = amt ? `+${amt + b.bonus} XP` + (b.bonus ? ` (${amt} + ${b.parts.map(x => x.label + ' ' + x.amount).join(' + ')})` : '') : '';
        });
    };
    back.addEventListener('input', preview); back.addEventListener('change', preview); preview();
    back.querySelector('[data-x]').onclick = () => back.remove();
    back.addEventListener('mousedown', e => { if (e.target === back) back.remove(); });
    back.querySelector('#gxName').focus();
    back.querySelector('[data-go]').onclick = async () => {
        let amt = Math.max(0, parseInt(back.querySelector('#gxAmt').value) || 0);
        let name = back.querySelector('#gxName').value.trim();
        if (!amt) { window.apxAlert('Enter how much XP to give.', { title: 'Grant XP' }); return; }
        if (!name) { window.apxAlert('Give the grant a name (it shows in each player\'s XP log).', { title: 'Grant XP' }); return; }
        let uids = [...back.querySelectorAll('[data-uid]:checked')].map(c => c.dataset.uid);
        if (!uids.length) { window.apxAlert('Pick at least one player.', { title: 'Grant XP' }); return; }
        let grant = { id: 'xp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), amount: amt, category: cat(), name,
            description: back.querySelector('#gxDesc').value.trim(), date: back.querySelector('#gxDate').value, session: parseInt(back.querySelector('#gxSession').value) || null };
        let worlds = typeof _gmWorlds !== 'undefined' ? _gmWorlds : [];
        let world = worlds.find(w => (w.worldId || w.id) === (typeof _activeWorldId !== 'undefined' ? _activeWorldId : null));
        let code = world?.inviteCode;
        if (!code || !window.apxAuth?.enabled) { window.apxAlert('Open a world (with sign-in) first, so XP can reach the players.', { title: 'Grant XP' }); return; }
        try {
            await Promise.all(uids.map(uid => window.apxAuth.addXpGrant(code, uid, Object.assign({}, grant, { id: grant.id }))));
        } catch (e) { window.apxAlert('Could not send XP: ' + e.message, { title: 'Grant XP' }); return; }
        if (typeof _wNotes !== 'undefined') {
            (_wNotes.xpLog = _wNotes.xpLog || []).unshift({ id: grant.id, name, amount: amt, category: grant.category,
                categoryLabel: (typeof XP_CATEGORY_LABELS !== 'undefined' ? XP_CATEGORY_LABELS[grant.category] : grant.category),
                session: grant.session, date: grant.date, to: uids.map(u => party.find(p => p.fileName === u)?.summary?.name || 'Player') });
            _wNotes.xpLog = _wNotes.xpLog.slice(0, 100);
            if (typeof window.saveWorldNotes === 'function') window.saveWorldNotes();
        }
        back.remove();
        window.apxAlert(`Sent ${amt} XP to ${uids.length} player${uids.length > 1 ? 's' : ''}. Each sheet adds its own bonuses.`, { title: 'XP Granted' });
    };
};
