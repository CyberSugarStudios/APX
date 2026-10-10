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

    ATTRIBUTES.forEach(a => { calc.scores[a] = state.baseStats[a] + (state.ancestry.bonuses[a] || 0) + ((state.attrAdj || {})[a] || 0); });

    Object.keys(state.perks || {}).forEach(perkId => {
        let pDef = PERKS_DB.find(p => p.id === perkId);
        let rank = state.perks[perkId];
        let choices = (state.perkChoices || {})[perkId] || null;
        if (pDef && pDef.effect && rank > 0) pDef.effect(calc, rank, choices);
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
    if (window.apxApplyItemAttrSets) window.apxApplyItemAttrSets(calc.scores, itemFx);
    // A worn, powered Exo-Suit: STR or AGI 15 (20 with Powerful) unless already higher
    // (only when the sheet says it's in effect: the GM can turn Exo-Suits off for the world)
    let exo = state.derived && state.derived.exo && window.apxExoActive ? window.apxExoActive(state) : null;
    if (exo) calc.scores[exo.attr] = Math.max(calc.scores[exo.attr], exo.attrFloor);
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
    // Shield and Helmet (same as the sheet): +AC/DR/ER, and the shield's weight counts as armor
    let sh = state.equippedShield, hm = state.equippedHelmet;
    if (sh && sh.equipped) { armorAc += sh.ac || 0; armorDr += sh.dr || 0; armorEr += sh.er || 0; armorWt += sh.wt || 0; }
    (state.extraShields || []).forEach(x => { armorAc += x.ac || 0; armorDr += x.dr || 0; armorEr += x.er || 0; armorWt += x.wt || 0; });
    if (hm && hm.equipped && !hm.broken) { armorAc += hm.ac || 0; armorDr += hm.dr || 0; armorEr += hm.er || 0; armorWt += hm.wt || 0; }

    let classWt = Math.max(0, armorWt - 5 * ((state.perks || {}).str_armormaster || 0));   // Armor Master: 5 lb lighter per rank
    // The STR requirement uses that lighter weight too, the same as the sheet (not met: Disadvantage on
    // attacks, attribute checks and saves)
    let reqStr = Math.floor(classWt / 10);
    let meetsStr = calc.scores.STR >= reqStr;
    calc.hasArmorDisadvantage = (!meetsStr && armorWt > 0);
    let armorClass = armorWt === 0 ? null : (classWt > 70 ? 'Heavily' : (classWt > 30 ? 'Moderately' : 'Lightly'));
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

    let tirelessRank = window.apxPerkRank ? window.apxPerkRank(state, 'gen_tireless') : ((state.perks || {})['gen_tireless'] || 0);
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

    // Skills: every skill whose roll isn't just the plain attribute check (trained, its own bonus,
    // or Advantage / Disadvantage from size), the same rule as NPC stat blocks
    let szv = parseInt(state.ancestry && state.ancestry.size) || 30, szKey = szv <= 15 ? 'small' : szv >= 60 ? 'large' : 'medium';
    let trainedSkills = SKILLS.map(s => {
        let tr = !!(state.skillsTrained && state.skillsTrained[s.id]);
        let perkBonus = calc.skills[s.id] || 0;
        if (s.name === 'Notice' && calc.skills['Notice']) perkBonus = calc.skills['Notice'];
        let adv = szKey === 'small' && s.id === 'Stealth' ? ['Small size'] : [];
        let dis = szKey === 'large' && s.id === 'Stealth' ? ['Large size'] : [];
        if (!tr && !perkBonus && !adv.length && !dis.length) return null;
        return { name: s.name, trained: tr, adv, dis, total: calc.mods[s.attr] + (tr ? (state.trainingBonus || 2) : 0) + perkBonus + (window.apxItemCheckBonus ? window.apxItemCheckBonus(itemFx, s.attr) : 0) };
    }).filter(Boolean);
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

    let out = {
        name: state.name || 'Unnamed', ancestryName: state.ancestry.name || 'Unknown',
        ac: calc.ac, dr: calc.dr, er: calc.er, maxHp, currentHp: state.currentHp, tempHp: state.tempHp || 0,
        ap: calc.maxAp, speed: dispSpeed, initiative, mods: calc.mods, saves,
        trainedSkills, hasArmorDisadvantage: calc.hasArmorDisadvantage,
        fatigue: state.fatigue || 0, luckPts: state.luckPts || 0,
        woundThreshold: ((calc.scores.CON || 0) * 2) + (calc.wtBoost || 0) + fxStat('wt'),
        envLines, envTypes: envByType,
    };
    // The player's own sheet saves the numbers it shows: those are the real ones (shield, helmet,
    // perks, magic items…), so they win over this reconstruction
    let d = state.derived;
    if (d && typeof d === 'object') {
        ['ac', 'dr', 'er', 'maxHp', 'ap', 'speed'].forEach(k => { if (typeof d[k] === 'number') out[k] = d[k]; });
        if (typeof d.wt === 'number') out.woundThreshold = d.wt;
        if (typeof d.init === 'number') out.initiative = d.init;
        out.derived = d;
    }
    return out;
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
            return { fileName: p.uid, state, summary: computeCharSummary(state), world: String(inviteCode).toUpperCase().trim() };
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
    let code = String(inviteCode).toUpperCase().trim();
    _partyUnsubscribe = window.apxAuth.listenWorldPlayers(inviteCode, (players, meta) => {
        let changed = false;
        // Players who left the world (deleted their character there, left or deleted the world
        // folder, were kicked) and players from another world drop off the party list. Parties
        // loaded from a folder of JSON files have no world and are left alone.
        if (!(meta && meta.fromCache && !players.length)) {
            let here = new Set(players.map(p => p.uid));
            for (let i = window.gmParty.length - 1; i >= 0; i--) {
                let x = window.gmParty[i];
                if (x.world && !(x.world === code && here.has(x.fileName))) { window.gmParty.splice(i, 1); changed = true; }
            }
            // the World tab's Players list, if it's open, follows along
            let pl = document.getElementById('playersList');
            let n = pl ? pl.querySelectorAll('button[onclick*="gmKickPlayer"]').length : 0;
            if (pl && pl.offsetParent && n !== players.length && typeof window.renderPlayersList === 'function') window.renderPlayersList();
        }
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
                        try { _gmLogHpChange(e, before, e.currentHp, wasUp); } catch (err) { console.warn('HP log:', err); }
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
                entry.world   = code;
                changed = true;
            } else {
                let summ = computeCharSummary(state);
                summ.charPortrait = state.charPortrait || null;
                window.gmParty.push({ fileName: p.uid, state, summary: summ, world: code });
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
                        // Just changed HP here: a sheet save from before it received that is stale (unless it's a heal made there)
                        if (e._gmHpSetAt && Date.now() - e._gmHpSetAt < 8000 && (e.currentHp !== newHp || (e.tempHp || 0) !== newTempHp)
                            && !(state.hpNote && state.hpNote.t > e._gmHpSetAt)) return;
                        let wasUp = e.currentHp === null || e.currentHp > 0;
                        let before = (e.currentHp || 0) + (e.tempHp || 0), after = (newHp || 0) + (newTempHp || 0);
                        let hpChanged = e.currentHp !== null && (e.currentHp !== newHp || (e.tempHp || 0) !== newTempHp);
                        // Player's own sheet took them to 0 → start bleeding out (not dead)
                        let dropped = wasUp && newHp <= 0 && e.faction === 'player' && e.bleedOutTurns == null;
                        // (their sheet's roller asks for the CON (Survive) check; the popup is only for untracked players)
                        if (dropped && !(e.playerUid && window.gmCombatStarted)) setTimeout(() => window.openBleedOutModal(e.id), 0);
                        if (newHp > 0) { if (e.bleedOutTurns != null) _gmSetPlayerCondition(e, 'bleedingout', false); e.bleedOutTurns = null; e.stabilized = false; }
                        let tempBefore = Math.max(0, e.tempHp || 0);
                        e.currentHp = newHp;
                        e.tempHp    = newTempHp;
                        // HP the player changed on their own sheet. Damage typed there arrives as a damage
                        // event (with its type and the math) and goes through the combat core; a drop with no
                        // event (an older sheet, or HP set by hand) is taken as damage already reduced.
                        if (hpChanged && before !== after) {
                            if (after > before) {
                                // Healing from the player's own sheet says where it came from (a rest, Recover…)
                                let note = state.hpNote, why = null;
                                if (note && note.t && Date.now() - note.t < 120000 && e._hpNoteT !== note.t) { why = note.text; e._hpNoteT = note.t; }
                                try { _gmLogHpChange(e, before, after, wasUp, 0, null, why); } catch (err) { console.warn('HP log:', err); }
                            } else if (!(e._sheetDmgAt && Date.now() - e._sheetDmgAt < 8000)) {
                                // wait a moment: the sheet's damage event (sent just before) may still be on its way
                                let t0 = Date.now(), entryId = e.id;
                                setTimeout(() => {
                                    let en = (window.gmInitiative || []).find(x => x.id === entryId);
                                    if (!en || (en._sheetDmgAt && en._sheetDmgAt >= t0 - 8000)) return;
                                    let hit = _gmTakeHit(en);
                                    let extras = hit ? _gmHitExtraDamage(en, hit) : [];
                                    let extra = extras.reduce((t, x) => t + x.n, 0);
                                    let aft = after;
                                    if (extra > 0) {
                                        let r2 = window.apxApplyHpInput('-' + extra, en.currentHp, en.tempHp, en.maxHp);
                                        if (r2) { en.currentHp = r2.currentHp; en.tempHp = r2.tempHp; aft = (en.currentHp || 0) + (en.tempHp || 0); _syncHpToPlayer(en); }
                                    }
                                    _gmLogHpChange(en, before, aft, wasUp, before - aft, hit);
                                    let defId = hit ? _gmOfferDefensive(en, hit, before - aft, extras) : null;
                                    _gmCheckWoundThreshold(en, (before - aft) - Math.min(tempBefore, before - aft), defId);   // (only what got past Temp HP)
                                    if (hit) _gmHitEffects(en, hit, extras);
                                    if (dropped) _gmQueueBleed(en);
                                    window.renderInitiativeTracker();
                                }, 1500);
                            }
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

function _gmPartyShut() { try { return JSON.parse(localStorage.getItem('apxPartyShut') || '{}') || {}; } catch (e) { return {}; } }
window._gmPartyToggle = function(uid) {
    let m = _gmPartyShut();
    if (m[uid]) delete m[uid]; else m[uid] = 1;
    try { localStorage.setItem('apxPartyShut', JSON.stringify(m)); } catch (e) { }
    window.renderGmScreen();
};
window.renderGmScreen = function() {
    try { window.renderGmLoot && window.renderGmLoot(); } catch (e) { }
    let body = document.getElementById('gmScreenBody');
    if (!body) return;
    if (!window.gmParty.length) {
        body.innerHTML = '<div class="text-xs text-slate-500 text-center py-6">No party yet. Load a world (World) and its players\' characters show up here on their own.</div>';
        return;
    }
    let cards = window.gmParty.map((p, idx) => {
        let s = p.summary;
        // Same full stat block as double-clicking the player's token
        let sb = typeof window._gmPlayerStatBlock === 'function' ? window._gmPlayerStatBlock(p, s.name, true) : null;
        if (sb) {
            let uid = String(p.fileName || '').replace(/'/g, '');
            // Shrunk: just the portrait, name, ancestry and + Initiative (remembered per player on this device)
            let shut = !!_gmPartyShut()[uid];
            return `
            <div class="rounded-lg mb-2 overflow-hidden" style="background:#0f172a;border:1px solid #6366f1;">
                <div style="background:#1e1b4b;padding:0.5rem 0.75rem;display:flex;align-items:center;gap:0.6rem;">
                    <button onclick="window._gmPartyToggle('${uid}')" title="${shut ? 'Expand this stat block' : 'Shrink to portrait, name, ancestry and + Initiative'}" style="background:none;border:0;color:#a5b4fc;font-size:.8rem;font-weight:900;cursor:pointer;padding:0 .1rem;line-height:1">${shut ? '▸' : '▾'}</button>
                    ${sb.portrait}
                    <div style="flex:1;min-width:0;cursor:pointer;" onclick="window._btOpenPlayerSummary && window._btOpenPlayerSummary('${String(s.name).replace(/'/g, '')}','${uid}')" title="Open in its own window">
                        <div style="font-size:0.85rem;font-weight:900;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${sb.name}</div>
                        <div style="font-size:0.58rem;color:#818cf8;">${sb.subtitle}${s.hasArmorDisadvantage ? ' <span style="color:#f87171;font-weight:700">(Armor STR not met)</span>' : ''}</div>
                    </div>
                    <button onclick="window.addToInitiative(${idx}, 'party')" class="text-[9px] px-2 py-1 rounded bg-indigo-700 hover:bg-indigo-600 text-white font-bold">+ Initiative</button>
                </div>
                ${shut ? '' : sb.body + _gmCompanionRow(p, idx)}
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
                    <summary class="cursor-pointer text-slate-400 font-bold select-none">Saving Throws &amp; Skills</summary>
                    <div class="grid grid-cols-7 gap-1 mt-1 mb-1">
                        ${ATTRIBUTES.map(a => `<div class="text-center bg-slate-800 rounded py-0.5"><div class="text-[7px] text-slate-500 font-bold">${a} Save</div><div class="text-[10px] font-black text-blue-300">${s.saves[a] >= 0 ? '+' : ''}${s.saves[a]}</div></div>`).join('')}
                    </div>
                    <div class="flex flex-wrap gap-1">
                        ${s.trainedSkills.length ? s.trainedSkills.map(sk => `<span class="bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 ${sk.trained === false ? 'text-slate-400' : 'text-slate-300'}">${sk.name} <span class="text-emerald-400 font-bold">${sk.total >= 0 ? '+' : ''}${sk.total}</span>${(sk.adv || []).length ? ' <span class="text-emerald-400">Adv</span>' : ''}${(sk.dis || []).length ? ' <span class="text-red-400">Disadv</span>' : ''}</span>`).join('') : '<span class="text-slate-600">None beyond attribute checks</span>'}
                    </div>
                </details>
            </div>
        `;
    });
    // Two columns that each stack tight: every card sits right under the one above it in its column,
    // however long its neighbour is (each card goes to whichever column is shorter so far)
    body.innerHTML = '<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 items-start" data-party-cols><div class="flex flex-col min-w-0" data-col="0"></div><div class="flex flex-col min-w-0" data-col="1"></div></div>';
    let grid = body.querySelector('[data-party-cols]'), cols = body.querySelectorAll('[data-col]'), hgt = [0, 0];
    let wide = getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length > 1;
    cards.forEach((html, i) => {
        let t = document.createElement('template'); t.innerHTML = html.trim();
        let k = wide ? (hgt[0] <= hgt[1] ? 0 : 1) : 0;
        let nodes = [...t.content.childNodes];
        nodes.forEach(n => cols[k].appendChild(n));
        hgt[k] += nodes.reduce((a, n) => a + (n.offsetHeight || 0), 0) + 8 + 0.001 * i;   // (hidden panel: heights are 0, so it alternates)
    });
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

// A Loyal Companion acts on its owner's turn, so it shares its owner's initiative (and sorts right after them)
function _gmCompanionOwner(e) {
    if (e && e.summonOfEntry) return (window.gmInitiative || []).find(x => x.id === e.summonOfEntry) || null;   // summoned by a companion or an NPC
    let u = e && (e.companionOf || e.summonOf); return u ? (window.gmInitiative || []).find(x => x.playerUid === u && !x.companionOf && !x.summonOf) : null;
}
function effInit(e) { let o = _gmCompanionOwner(e); if (o) return effInit(o); return e.baseInitiative - (e.surprised ? 10 : 0); }

// PCs automatically win initiative ties against non-PCs (no manual
// resolution needed); everything else (PC-vs-PC, NPC-vs-NPC) is a true
// tie the GM breaks manually with the up/down arrows.
function initiativeCompare(a, b) {
    let ea = effInit(a), eb = effInit(b);
    if (ea !== eb) return eb - ea;
    if (a.summonOfEntry && a.summonOfEntry === b.id) return 1;    // a creature's summons act right after it
    if (b.summonOfEntry && b.summonOfEntry === a.id) return -1;
    let ua = a.companionOf || a.summonOf, ub = b.companionOf || b.summonOf;
    if (ua && ua === b.playerUid && !ub) return 1;    // right after its owner
    if (ub && ub === a.playerUid && !ua) return -1;
    if (ua && ub && ua === ub && !!a.summonOf !== !!b.summonOf) return a.summonOf ? 1 : -1;   // companion before summons
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
        let ou = entry.companionOf || entry.summonOf;
        let oi = entry.summonOfEntry ? window.gmInitiative.findIndex(x => x.id === entry.summonOfEntry)
            : ou ? window.gmInitiative.findIndex(x => x.playerUid === ou && !x.companionOf && !x.summonOf) : -1;
        let ownerId = oi >= 0 ? window.gmInitiative[oi].id : null;
        while (oi >= 0 && oi + 1 < window.gmInitiative.length && ((ou && (window.gmInitiative[oi + 1].companionOf === ou || window.gmInitiative[oi + 1].summonOf === ou)) || window.gmInitiative[oi + 1].summonOfEntry === ownerId)) oi++;   // after their other companions/summons
        if (oi >= 0) { window.gmInitiative.splice(oi + 1, 0, entry); if (oi + 1 <= window.gmCurrentTurnIdx) window.gmCurrentTurnIdx++; }
        else window.gmInitiative.push(entry);
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
        let owner = (window.gmInitiative || []).find(x => x.playerUid === p.fileName && !x.companionOf);
        entry = { id: crypto.randomUUID(), name: sb.name || 'Companion', baseInitiative: owner ? owner.baseInitiative : (p.summary?.initiative ?? sb.initiative), surprised: false,
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
        entry = { id: crypto.randomUUID(), name: entryName, baseInitiative: sb.initiative, surprised: false, currentHp: sb.maxHp, maxHp: sb.maxHp, tempHp: 0, ap: sb.ap, ac: sb.ac, dr: sb.dr, er: sb.er, faction: resolvedFaction, bleedOutTurns: null, tpValue: window.npcXpForTier(npcTierForTP(n.npc.gmTpBudget || 0).tier) * (n.npc.mythicAwakening ? 2 : 1), sourceNpcId: n.id, hasLairActions: !!n.npc.lairActions, lairTraitNote: null, powerUsage: {} };
        // Limited-use powers (Charges or Recharge) get their own tracked
        // usage on the initiative entry itself, independent of the NPC's
        // own saved data -- so two copies of the same monster in the same
        // fight track their charges separately, and closing the tracker
        // doesn't burn a real charge off the NPC's master sheet.
        sb.powerCards.concat(sb.lairActionPowerCards, sb.awakenedPowerCards || []).forEach((p, i) => {
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

// World tags (NPC Roster → World): a stat block tagged with worlds only shows up in those worlds.
// Untagged stat blocks show everywhere. Tags are world names (older ones) or invite codes / ids.
function _gmActiveWorld() {
    let worlds = typeof _gmWorlds !== 'undefined' ? _gmWorlds : (window._gmWorlds || []);
    let id = typeof _activeWorldId !== 'undefined' ? _activeWorldId : null;
    return (worlds || []).find(w => (w.worldId || w.id) === id) || null;
}
window.apxGmActiveWorld = _gmActiveWorld;
window.apxNpcInActiveWorld = function(entry) {
    let tags = (entry && Array.isArray(entry.worldTags)) ? entry.worldTags.filter(Boolean) : [];
    if (!tags.length) return true;
    let w = _gmActiveWorld(); if (!w) return true;
    return tags.includes(w.name || 'Unnamed') || (w.inviteCode && tags.includes(w.inviteCode)) || tags.includes(w.worldId || w.id);
};
// "3 stat blocks from other worlds are hidden." (with a Show them link) for NPC lists
window.apxNpcHiddenNote = function(hidden, showAllJs) {
    if (!hidden) return '';
    let w = _gmActiveWorld();
    return `<div class="text-[10px] text-slate-500 mb-1">${hidden} stat block${hidden === 1 ? '' : 's'} tagged for other worlds ${hidden === 1 ? 'is' : 'are'} hidden in ${String(w?.name || 'this world').replace(/</g, '&lt;')}.${showAllJs ? ` <button onclick="${showAllJs}" class="text-amber-400 hover:text-amber-300 font-bold underline">Show all</button>` : ''}</div>`;
};

window.renderSavedNpcPickerList = function() {
    let body = document.getElementById('savedNpcPickerList');
    if (!body) return;
    if (!window.gmNpcs.length) {
        body.innerHTML = '<div class="text-xs text-slate-500 text-center py-6">No saved NPCs yet. Build one from "NPCs & Enemies" first.</div>';
        return;
    }
    let search = (document.getElementById('savedNpcSearch').value || '').trim().toLowerCase();
    let inWorld = window.gmNpcs.map((n, idx) => ({ n, idx })).filter(x => window.apxNpcInActiveWorld(x.n));
    let hidden = window.gmNpcs.length - inWorld.length;
    let rows = inWorld
        .map(({ n, idx }) => ({ idx, npc: n.npc, sb: ncStatBlockFor(n.id), tier: npcTierForTP(n.npc.gmTpBudget || 0).tier }))
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
        body.innerHTML = window.apxNpcHiddenNote(hidden) + `<div class="text-xs text-slate-500 text-center py-6">${search ? 'No NPCs match that search.' : 'No stat blocks for this world yet. Tag one for it in the NPC Roster (World button).'}</div>`;
        return;
    }
    body.innerHTML = window.apxNpcHiddenNote(hidden) + rows.map(r => `
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
    // A grapple ends when either creature leaves the fight
    try { let gone = window.gmInitiative[idx]; if (gone.grappling) { let t = _gmEntryById(gone.grappling); if (t) _gmEndGrapple(t, `${_gmPublicName(gone)} is out of the fight`); } if (gone.grappledBy) _gmEndGrapple(gone, null, true); } catch (e) { console.warn('Grapple end:', e); }
    let wasCurrent = (idx === window.gmCurrentTurnIdx) && window.gmCombatStarted;
    if (opts?.dead) {
        // (its loot first: a named NPC's own loot is found through its token, which marking it dead unlinks)
        try { _gmCaptureLoot(window.gmInitiative[idx]); } catch (e) { console.warn('Loot capture:', e); }
        if (typeof window._gmMarkTokenDead === 'function') window._gmMarkTokenDead(id);
    }
    else if (typeof window._gmUnlinkEntry === 'function') window._gmUnlinkEntry(id);
    let gone = window.gmInitiative[idx];
    try { _gmClearNpcWtAsks(gone); } catch (e) { }
    window.gmInitiative.splice(idx, 1);
    if (typeof window._gmRenumber === 'function') window._gmRenumber();
    if (idx < window.gmCurrentTurnIdx) window.gmCurrentTurnIdx--;
    else if (wasCurrent) {
        window.gmCurrentTurnIdx = window.gmInitiative.length
            ? window.gmCurrentTurnIdx % window.gmInitiative.length : 0;
    }
    // Its stat block window stays open while another creature in the order uses the same stat block
    let sbWin = window.gmFloatingWindows[id];
    let heir = sbWin && gone && gone.sourceNpcId
        ? window.gmInitiative.find(x => x.sourceNpcId === gone.sourceNpcId && x.faction !== 'player' && !window.gmFloatingWindows[x.id]) : null;
    if (heir) {
        let pos = { left: sbWin.style.left, top: sbWin.style.top, width: sbWin.style.width, height: sbWin.style.height, z: sbWin.style.zIndex };
        window.closeFloatingStatBlock(id);
        window.openFloatingStatBlock(heir.id);
        let nw = window.gmFloatingWindows[heir.id];
        if (nw) { nw.style.left = pos.left; nw.style.top = pos.top; if (pos.width) nw.style.width = pos.width; if (pos.height) nw.style.height = pos.height; nw.style.zIndex = pos.z; }
    } else window.closeFloatingStatBlock(id);
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
        if (it.isCustomEquippable) it.equipped = false;   // taken off the body
        if (it.isConsumable) {
            // What's left of the stack after the fight (used charges come off the first ones)
            let used = (entry && entry.carriedUsed && entry.carriedUsed[l.id]) || 0;
            it = window.apxStackAfterUse ? window.apxStackAfterUse(it, used) : it;
            if (!it) return;   // used up in the fight
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
// The world NPC an initiative creature is (its battle token's world NPC, or the one world NPC with its
// name and stat block): its own loot drops with it
function _gmEntryWorldNpc(entry) {
    if (typeof _wNotes === 'undefined' || !_wNotes) return null;
    let wid = entry.worldNpcId || null;
    if (!wid) (_wNotes.otherMaps || []).some(m => (m.battleTokens || []).some(t => { if (t.initiativeId === entry.id && t.worldNpcId) { wid = t.worldNpcId; return true; } return false; }));
    if (wid) return (_wNotes.npcs || []).find(n => n.id === wid) || null;
    let base = String(entry.baseName || entry.name || '').trim();
    let m = (_wNotes.npcs || []).filter(n => n.name && n.name.trim() === base && (!entry.sourceNpcId || n.statBlockId === entry.sourceNpcId));
    return m.length === 1 ? m[0] : null;
}
window._gmEntryWorldNpc = _gmEntryWorldNpc;
function _gmCaptureLoot(entry) {
    if (!entry || entry.faction === 'player' || entry.companionOf) return;
    if (entry.faction === 'enemy') { _gmSetLootDefeated(_gmLootDefeated() + 1); window.renderGmLoot(); }
    let n = entry.sourceNpcId ? (window.gmNpcs || []).find(x => x.id === entry.sourceNpcId) : null;
    // Generic Drops (the stat block's, for every creature built from it) + this NPC's own loot
    let items = n && n.npc ? _gmNpcLootItems(n.npc, entry) : [];
    let cu = n && n.npc ? Math.max(0, parseInt(n.npc.carriedCu) || 0) : 0;
    let wn = _gmEntryWorldNpc(entry);
    if (wn && wn.loot && ((wn.loot.items || []).length || wn.loot.cu)) {
        (wn.loot.items || []).forEach(l => { if (l && l.item) { let it = JSON.parse(JSON.stringify(l.item)); if (it.isCustomEquippable) it.equipped = false; items.push(it); } });
        cu += Math.max(0, parseInt(wn.loot.cu) || 0);
        wn.loot = { items: [], cu: 0 };   // it's dropped: now in the Loot list
        if (typeof window.saveWorldNotes === 'function') window.saveWorldNotes();
    }
    if (!items.length && !cu) return;
    let list = _gmLootList();
    items.forEach(it => {
        // identical drops from the same creature share one row (2× Dagger)
        let same = !it.isConsumable && list.find(l => l.from === entry.name && window.apxItemsStack && window.apxItemsStack(l.item, it));
        if (same) same.item.ct = (parseInt(same.item.ct) || 1) + (parseInt(it.ct) || 1);
        else list.push({ id: crypto.randomUUID(), from: entry.name, item: it });
    });
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
    let it = l.item, base = window.apxStackCharges ? window.apxStackCharges(it) : (it.chargesRemaining ?? it.charges ?? 1);   // a stack shares its charges
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
        : it.isShield ? '+2 AC/DR/ER' : it.isHelmet ? '+1 AC/DR/ER' : (window.apxLootStats ? window.apxLootStats(it) : (it.desc || ''));
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
                let canEdit = window.apxLootIsEditable && window.apxLootIsEditable(l.item);
                let many = (parseInt(l.item.ct) || 1) > 1;
                return `<div class="grid items-center gap-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 mb-1" style="grid-template-columns:minmax(0,1fr) auto auto ${many ? 'auto ' : ''}auto" data-loot="${esc(l.id)}">
                    <div class="min-w-0 leading-tight">
                        <span class="text-[11px] font-bold text-amber-200">${esc(l.item.name)}${l.item.ct > 1 ? ` ×${l.item.ct}` : ''}</span>
                        <span class="text-[9px] text-slate-500 ml-1">${kind(l.item)} · ${esc(stats(l.item))}</span>
                        ${canEdit ? `<button onclick="window.apxEditPoolLoot('${esc(l.id)}')" title="Edit this item" class="text-[9px] text-amber-300 hover:text-amber-200 font-bold ml-1 underline">Edit</button>` : ''}
                    </div>
                    <select class="gm-loot-to ${selCls}" style="width:6.5rem" onchange="window._gmLootSel['${esc(l.id)}']=this.value" ${party.length ? '' : 'disabled'}>
                        <option value="">Give to…</option>${opts(cur)}</select>
                    <button onclick="window.gmGiveLoot('${esc(l.id)}', this)" title="${many ? 'Give one' : 'Give it'}" class="text-[10px] px-2 py-0.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-bold">Give</button>
                    ${many ? `<button onclick="window.gmGiveLoot('${esc(l.id)}', this, true)" title="Give all ${parseInt(l.item.ct)}" class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900 hover:bg-emerald-800 text-emerald-200 font-bold border border-emerald-700">All</button>` : ''}
                    <button onclick="window.gmDiscardLoot('${esc(l.id)}')" title="Not salvageable: remove it from the list" class="text-[10px] w-5 h-5 rounded bg-slate-700 hover:bg-red-800 text-slate-300 font-bold leading-none">✕</button>
                </div>`;
            }).join('')}
        </div>`).join('') : '<div class="text-[10px] text-slate-500 mb-2">Nothing yet. When an enemy dies, its weapons, armor, shield and helmet appear here. Use Loot Maker to create your own.</div>';
    let cuTo = form.to === '__split' || partyIds.has(form.to) ? form.to : '';
    el.innerHTML = `
        <label class="flex items-center gap-1.5 mb-1.5 text-[10px] text-slate-300 cursor-pointer" title="On: what you hand out isn't announced to the other players (the player who gets it still sees it). Off: everyone sees who got what.">
            <input type="checkbox" ${window._gmLootSecret ? 'checked' : ''} onchange="window._gmLootSecret=this.checked" class="w-3 h-3"> Hide what I give from the other players</label>
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
// Give hands over ONE of a stack ("Black Cloak ×3" → ×2), and the chosen player stays picked so
// Give can be pressed again. all = true hands over the whole stack.
function _gmLootGiftOf(item, all) {
    let ct = Math.max(1, parseInt(item.ct) || 1), n = all ? ct : 1;
    let gift = JSON.parse(JSON.stringify(item)); gift.ct = n;
    if (gift.isCustomEquippable) gift.equipped = false;   // arrives in the pack; the player equips it
    return { gift, n, left: ct - n };
}
window._gmLootGiftOf = _gmLootGiftOf;
window.gmGiveLoot = function(id, btn, all) {
    let list = _gmLootList(), i = list.findIndex(l => l.id === id); if (i < 0) return;
    let row = btn?.closest?.('[data-loot]') || btn?.parentElement;
    let uid = row?.querySelector('.gm-loot-to')?.value || window._gmLootSel[id];
    if (!uid) { window.apxAlert && window.apxAlert('Pick who gets it first.'); return; }
    let l = list[i], g = _gmLootGiftOf(l.item, all);
    if (!_gmSendGift(uid, { id: crypto.randomUUID(), item: g.gift, from: 'GM', at: Date.now() })) return;
    if (g.left > 0) { l.item.ct = g.left; window._gmLootSel[id] = uid; }
    else { list.splice(i, 1); delete window._gmLootSel[id]; }
    if (typeof gmLog === 'function') gmLog({ text: `${_gmPartyName(uid)} received ${g.n > 1 ? g.n + '× ' : ''}${l.item.name}.`, kind: 'loot', force: true, gmOnly: !!window._gmLootSecret });
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
        if (typeof gmLog === 'function') gmLog({ text: `The party split ${amt} Cu${src}.`, kind: 'loot', force: true, gmOnly: !!window._gmLootSecret });
    } else {
        if (!_gmSendGift(to, { id: crypto.randomUUID(), cu: amt, from: 'GM', at: Date.now() })) return false;
        if (typeof gmLog === 'function') gmLog({ text: `${_gmPartyName(to)} found ${amt} Cu${src}.`, kind: 'loot', force: true, gmOnly: !!window._gmLootSecret });
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
    entry._gmHpSetAt = Date.now();   // for a few seconds, the sheet's older HP (saved before it got this) is ignored
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
// A fight is on when combat has started, or creatures are already in the tracker (damage before "Start Combat" counts)
function _gmFightOn() { return !!window.gmCombatStarted || (window.gmInitiative || []).length > 0; }
window._gmFightOn = _gmFightOn;
function gmLog(e) {
    if (!e || (!_gmFightOn() && !e.force)) return null;
    e.id = e.id || 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    e.t = e.t || Date.now();
    let i = window.gmCombatLog.findIndex(x => x.id === e.id);
    if (i >= 0) window.gmCombatLog[i] = Object.assign({}, window.gmCombatLog[i], e, { t: window.gmCombatLog[i].t });
    else window.gmCombatLog.push(e);
    window.gmCombatLog = window.gmCombatLog.slice(-80);
    let shown = window.gmCombatLog.find(x => x.id === e.id);
    // Before Start Combat (the GM trying things out, or a fight the players only watch), players get
    // just the outline: who took damage or went down, plus anything that asks them to roll, loot or XP.
    if (!e.gmOnly && !window.gmCombatStarted && !e.ask && !/^(loot|xp)$/.test(e.kind || '')) {
        if (e.pubSummary) shown.pubText = e.pubSummary; else shown._noPub = true;
    }
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
        let pub = window.gmCombatLog.filter(x => !x.gmOnly && !x._noPub).slice(-40).map(x => ({ id: x.id, t: x.t, text: x.pubText || x.text, kind: x.kind || 'info', ask: x.ask || null }));
        window.apxAuth.publishCombatLog(code, pub, _gmLogSession, window._gmLastNpcAtk || null).catch(err => console.warn('Combat log:', err.message));
    }, 400);
}
// HP change on a tracker entry → "<active creature> dealt X damage to <target>."
function _gmLogHpChange(entry, before, after, wasAboveZero, rawDmg, hit, why) {
    if (entry && after < before) { try { _gmPfxOnDamage(entry); } catch (e) { console.warn('Damage Interrupt:', e); } }
    let d = before - after;
    if (d > 0 && rawDmg > d) d = rawDmg;   // the whole hit, even past 0 HP
    if (!_gmFightOn()) return;
    if (!d && !hit) return;
    let burn = entry.playerUid && window._gmRecentBurn[entry.playerUid];
    if (burn && d > 0 && Date.now() - burn.t < 15000 && (burn.amt === d || burn.amt === before - after)) { delete window._gmRecentBurn[entry.playerUid]; return; }
    let cur = window.gmCombatStarted ? window.gmInitiative[window.gmCurrentTurnIdx] : null;   // (before Start Combat, nobody's turn)
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
        let down = d > 0 && wasAboveZero && entry.currentHp !== null && entry.currentHp <= 0;
        if (down) { text += ` ${tgt} is down!`; gmText += ` ${gTgt} is down!`; }
        gmLog({ text, gmText: gmText === text ? null : gmText, kind: 'dmg', pubSummary: d > 0 ? `${tgt} took damage${down ? ' and went down!' : '.'}` : null });
        return;
    }
    if (!d) return;
    let tgt = _gmPublicName(entry);
    // A player hurting an NPC doesn't reveal the amount (players could work out its DR/ER);
    // damage to players, and anything NPCs do, is shown in full.
    let hideAmt = entry.faction !== 'player' && cur && (cur.faction === 'player' || !!cur.companionOf);
    let srcWhy = d > 0 && why ? why : null;   // damage with a named source (a fall, an aura…), not the active creature
    let text = d > 0
        ? (srcWhy ? `${tgt} took ${entry.faction !== 'player' ? 'damage' : d + ' damage'} (${srcWhy}).` : cur && cur !== entry ? (hideAmt ? `${_gmPublicName(cur)} hit ${tgt}.` : `${_gmPublicName(cur)} dealt ${d} damage to ${tgt}.`) : `${tgt} took ${entry.faction !== 'player' ? 'damage' : d + ' damage'}.`)
        : (entry.faction !== 'player' ? `${tgt} regained HP.` : `${tgt} regained ${-d} HP${why ? ` (${why})` : ''}.`);
    // The GM always sees real names and amounts (hidden tokens are marked as such)
    let gTgt = _gmGmName(entry);
    let gmText = d > 0 ? `${srcWhy ? gTgt + ' took ' + d + ' damage (' + srcWhy + ')' : cur && cur !== entry ? _gmGmName(cur) + ' dealt ' + d + ' damage to ' + gTgt : gTgt + ' took ' + d + ' damage'}.` : `${gTgt} regained ${-d} HP${why ? ` (${why})` : ''}.`;
    if (gmText === text) gmText = null;
    let down = d > 0 && wasAboveZero && entry.currentHp !== null && entry.currentHp <= 0;
    if (down) { text += ` ${tgt} is down!`; if (gmText) gmText += ` ${gTgt} is down!`; }
    gmLog({ text, gmText, kind: d > 0 ? 'dmg' : 'heal', pubSummary: d > 0 ? `${tgt} took damage${down ? ' and went down!' : '.'}` : null });
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
    try { _gmPfxOnAction(a.attacker); } catch (e) { console.warn('Action Interrupt:', e); }
    window._gmLastAttack = Object.assign({ t: Date.now(), used: new Set(), turn: window.gmCombatStarted ? window.gmTurnNumber : null, round: window.gmCombatStarted ? window.gmRoundNumber : null }, a);
}
// Which creature in initiative a GM-side attack roll belongs to. When several creatures share a
// stat block, the one taking its turn is the one attacking, whichever copy's window was used.
function _gmAttackerFor(o, kind) {
    let init = window.gmInitiative || [], cur = init[window.gmCurrentTurnIdx];
    if (o.companion && o.compOwner) return init.find(x => x.companionOf === o.compOwner) || null;
    let byId = o.initId ? init.find(x => x.id === o.initId) || null : null;
    let npcId = o.npcId || (byId && byId.sourceNpcId) || null;
    if ((kind || 'attack') === 'attack' && npcId && window.gmCombatStarted && cur && cur.faction !== 'player' && !cur.companionOf && cur.sourceNpcId === npcId) return cur;
    if (byId) return byId;
    if (npcId) {
        let list = init.filter(x => x.sourceNpcId === npcId && x.faction !== 'player');
        return (cur && list.includes(cur)) ? cur : (list[0] || null);
    }
    return cur || null;
}
window._gmAttackerFor = _gmAttackerFor;
// An attack only counts as "what just hit" during the turn it was rolled (in combat), or for two
// minutes outside combat. Older ones are never reused for later damage.
function _gmAtkLive(a) {
    if (!a) return false;
    if (window.gmCombatStarted) return a.turn === window.gmTurnNumber && a.round === window.gmRoundNumber;
    return Date.now() - (a.t || 0) < 120000;
}
window.apxOnAttackRoll = function(o, r) {
    if (!o || !_gmFightOn()) return;
    let e = _gmAttackerFor(o); if (!e) return;
    _gmRecordAttack({ id: r.id, attacker: e, label: o.label || 'an attack', hit: o.hit || null, crit: !!r.crit, fumble: !!r.fumble, total: r.total,
        dice: o.dice || '', critMult: o.critMult || 2, reroll12: false, critExtra: r.critExtra || 0, dmgType: o.dmgType || (o.hit && o.hit.dmgType) || '',
        dmgShares: r.dmgParts ? r.dmgParts.map(x => x.dmg) : null });   // (NPC stat blocks don't use perks)
    // Players' sheets learn what just attacked (and its damage type), so they can reduce damage typed there
    if (e.faction !== 'player' && !e.companionOf) {
        window._gmLastNpcAtk = { id: r.id, t: Date.now(), turnNo: window.gmCombatStarted ? window.gmTurnNumber : null, round: window.gmCombatStarted ? window.gmRoundNumber : null, by: _gmPublicName(e), label: o.label || 'an attack', dmgType: o.dmgType || (o.hit && o.hit.dmgType) || '', props: (o.hit && o.hit.props) || [], tier: (o.hit && o.hit.tier) || 0, crit: !!r.crit };
        _gmPublishLogSoon();
    }
};
// A power used from a stat block that has no attack roll (a save power, or one that just deals
// damage): it becomes "what just hit" for the damage the GM enters next, with its own damage type,
// so a save-for-half power is never mistaken for an earlier weapon attack.
window.apxOnNpcPowerUse = function(o, info) {
    if (!o || !info) return null;
    let e = _gmAttackerFor(o); if (!e) return null;
    if (!_gmFightOn()) return e;
    let id = info.id || ('pw' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5));
    _gmRecordAttack({ id, attacker: e, label: info.label || o.label || 'a power', hit: { weapon: info.label || 'Power', props: [], dmgType: info.dmgType || '' }, crit: false, fumble: false, total: 0,
        dice: info.dice || '', critMult: 2, reroll12: false, critExtra: 0, dmgType: info.dmgType || '', power: true, save: info.save || null, aoe: !!info.aoe });
    if (e.faction !== 'player' && !e.companionOf) {
        window._gmLastNpcAtk = { id, t: Date.now(), turnNo: window.gmCombatStarted ? window.gmTurnNumber : null, round: window.gmCombatStarted ? window.gmRoundNumber : null, by: _gmPublicName(e), label: info.label || 'a power', dmgType: info.dmgType || '', props: [], tier: 0, crit: false, save: info.save || null };
        _gmPublishLogSoon();
    }
    return e;
};
// ── Power areas ───────────────────────────────────────────────────────────
// A power placed on the battle map as an area (a Line, Cone or Burst): everyone in it rolls the power's
// saving throw, and takes its damage by their roll (a success halves it, or negates it). The GM sees the
// rolls first and can leave anyone out before anything is dealt.
function _gmEntryForToken(mapId, tokenId) {
    let map = (typeof _wNotes !== 'undefined' && _wNotes ? _wNotes.otherMaps || [] : []).find(m => m.id === mapId);
    let t = map && (map.battleTokens || []).find(x => x.id === tokenId);
    if (!t) return null;
    let list = window.gmInitiative || [];
    if (t.initiativeId) return list.find(e => e.id === t.initiativeId) || null;
    if (t.type === 'player' && t.playerUid) return list.find(e => e.playerUid === t.playerUid && e.faction === 'player' && !e.companionOf && !e.summonOf) || null;
    if (t.type === 'companion' && t.playerUid) return list.find(e => e.companionOf === t.playerUid) || null;
    return null;
}
window._gmEntryForToken = _gmEntryForToken;
// A creature's saving throw bonus: a player's from their sheet, an NPC's or companion's from its stat block
function _gmSaveBonus(entry, attr) {
    if (!attr) return null;
    let sb = null;
    if (entry.companionOf) { let pm = (window.gmParty || []).find(p => p.fileName === entry.companionOf); try { sb = pm ? gmCompanionSb(pm) : null; } catch (e) { } }
    else if (entry.faction === 'player' && entry.playerUid) {
        let v = (((window.gmParty || []).find(p => p.fileName === entry.playerUid) || {}).summary || {}).saves;
        return v && typeof v[attr] === 'number' ? v[attr] : null;
    } else if (entry.sourceNpcId) { try { sb = (window.gmNpcs || []).some(n => n.id === entry.sourceNpcId) ? ncStatBlockFor(entry.sourceNpcId) : null; } catch (e) { } }
    return sb && sb.saves && sb.saves[attr] != null ? (parseInt(sb.saves[attr]) || 0) : null;
}
// info: { id, label, area: { mapId, tokenIds }, save: { dc, kind, attr } | null, dmgTotal, dmgType, heal, attackRoll, fx }
// Every use makes everyone in it roll a NEW save: NPCs and companions roll from your dice tray, players
// are asked to roll theirs, and each one takes the damage when their own roll comes in.
window._gmAreaResolve = function(attacker, info) {
    let a = info && info.area; if (!a) return;
    let label = info.label || 'a power', seen = new Set(), rows = [];
    (a.tokenIds || []).forEach(id => { let e = _gmEntryForToken(a.mapId, id); if (e && !seen.has(e.id) && window.gmInitiative.includes(e)) { seen.add(e.id); rows.push({ e }); } });
    let byName = attacker ? _gmGmName(attacker) : 'Someone';
    if (!rows.length) { gmLog({ gmOnly: true, kind: 'info', force: true, text: `${byName}'s ${label}: no one in the tracker is in its area.` }); return; }
    let total = typeof info.dmgTotal === 'number' ? info.dmgTotal : null, save = info.save || null;
    // An attack roll (each target is its own hit), or nothing to roll or deal: just say who's in it
    if (info.attackRoll || (total == null && !save)) {
        gmLog({ gmOnly: true, kind: 'info', force: true, text: `In ${byName}'s ${label}: ${rows.map(r => _gmGmName(r.e)).join(', ')}.` });
        return;
    }
    let heal = !!info.heal;
    if (heal) save = null;
    rows.forEach(r => {
        r.player = !!(r.e.faction === 'player' && r.e.playerUid && !r.e.companionOf);
        r.bonus = save ? _gmSaveBonus(r.e, save.attr) : null;
    });
    let esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    let sign = n => (n >= 0 ? '+' : '−') + Math.abs(n);
    let half = total == null ? 0 : save && save.kind === 'halves' ? Math.floor(total / 2) : 0;
    let head = heal ? `${total} healing` : [save ? `DC ${save.dc} ${save.attr ? save.attr + ' ' : ''}save (success ${save.kind === 'halves' ? 'halves it' : 'negates it'})` : 'No save',
        total != null ? `${total}${info.dmgType ? ' ' + esc(info.dmgType) : ''} damage rolled` : 'no damage'].join(' · ');
    let box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:0;z-index:2147483300;background:rgba(2,6,23,.6);display:flex;align-items:center;justify-content:center;padding:16px;';
    box.innerHTML = `<div style="background:#0f172a;border:1px solid #7e22ce;border-radius:10px;max-width:520px;width:100%;max-height:85vh;overflow:auto;padding:14px;color:#e2e8f0;font-family:system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.6)">
        <div style="font-weight:900;font-size:14px;color:#e9d5ff">${esc(byName)}: ${esc(label)} (area)</div>
        <div style="font-size:11px;color:#94a3b8;margin:2px 0 10px">${head}</div>
        ${rows.map((r, i) => `<label style="display:flex;align-items:center;gap:8px;padding:5px 6px;border-top:1px solid #1e293b;font-size:12px;cursor:pointer">
            <input type="checkbox" data-row="${i}" checked>
            <span style="flex:1;font-weight:700">${esc(_gmGmName(r.e))}</span>
            ${save ? `<span style="color:#94a3b8;font-weight:700">${r.player ? 'rolls their own save' : `rolls its save (${r.bonus == null ? '+0?' : sign(r.bonus)})`}</span>` : ''}
            <span style="min-width:84px;text-align:right;font-weight:900;color:${heal ? '#4ade80' : '#fca5a5'}">${heal ? '+' + total : save ? `−${total} / ${half ? '−' + half : 'none'}` : '−' + total}</span>
        </label>`).join('')}
        <div style="font-size:10px;color:#64748b;margin-top:8px">${save ? 'Everyone makes a new save: NPCs roll now in your dice tray, players are asked to roll theirs, and each takes the damage (fail / success) when their roll comes in. ' : ''}Damage reduction, resistances and Swarms (double from areas) are worked out as it's dealt. Untick anyone it shouldn't touch.</div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">
            <button data-x style="padding:6px 14px;border-radius:6px;background:#334155;color:#fff;font-weight:700;font-size:12px;border:0;cursor:pointer">Cancel</button>
            <button data-go style="padding:6px 14px;border-radius:6px;background:#7e22ce;color:#fff;font-weight:800;font-size:12px;border:0;cursor:pointer">${heal ? 'Heal them' : save ? 'Roll saves' : 'Deal it'}</button>
        </div></div>`;
    document.body.appendChild(box);
    let close = () => box.remove();
    box.querySelector('[data-x]').onclick = close;
    box.addEventListener('mousedown', e => { if (e.target === box) close(); });
    // Deals one target's share (the attack it hit with, so a split roll, Swarms and extra dice count)
    let deal = (e, amt) => {
        if (!amt || !window.gmInitiative.includes(e)) return;
        let la = window._gmLastAttack;
        let hit = la && la.id === info.id ? _gmTakeHit(e) : null;
        if (hit && Array.isArray(hit.dmgShares) && total && amt !== total) hit = Object.assign({}, hit, { dmgShares: hit.dmgShares.map(x => Math.floor(x * amt / total)) });
        let types = _gmDamageTypes({ typed: false }, hit) || (info.dmgType && window.APXDamage ? window.APXDamage.parts(info.dmgType) : null);
        if (!types || !types.length) types = ['True'];
        _gmDamage(e, { raw: amt, types, hit, swarmMode: 'area', src: hit ? null : `${_gmGmName(attacker)}'s ${label}` });
        if (typeof window._btRefreshAllOpenMaps === 'function') window._btRefreshAllOpenMaps();
        if (typeof window.saveWorldNotes === 'function') window.saveWorldNotes();
    };
    // A failed save also brings the power's Conditions (and a lasting effect with its Escape Save)
    let fx = info.fx && attacker ? Object.assign({}, info.fx, { conds: (info.fx.conds || []).filter(c => c && c !== 'wounded') }) : null;
    let rec = fx && (fx.conds.length || fx.lasting) ? _gmPfxRecord({ casterId: attacker.id, label, fx }) : null;
    let what = fx ? _gmCondNames(fx.conds) : '';
    box.querySelector('[data-go]').onclick = () => {
        box.querySelectorAll('[data-row]').forEach(cb => { rows[+cb.dataset.row].on = cb.checked; });
        close();
        let picked = rows.filter(r => r.on && window.gmInitiative.includes(r.e));
        picked.forEach(r => {
            if (heal) {
                if (!total) return;
                let wasAboveZero = r.e.currentHp === null || r.e.currentHp > 0, before = (r.e.currentHp || 0) + (r.e.tempHp || 0);
                let res = window.apxApplyHpInput('+' + total, r.e.currentHp, r.e.tempHp, r.e.maxHp);
                if (res) { r.e.currentHp = res.currentHp; r.e.tempHp = res.tempHp; }
                _gmLogHpChange(r.e, before, (r.e.currentHp || 0) + (r.e.tempHp || 0), wasAboveZero, 0, null, label);
                _afterHpChange(r.e, wasAboveZero);
                return;
            }
            if (!save) { deal(r.e, total); return; }
            let full = what ? `takes the full damage and is ${what}` : 'takes the full damage', fullInf = what ? `take the full damage and be ${what}` : 'take the full damage';
            let item = { attr: save.attr || 'AGI', dc: save.dc, cond: fx && fx.conds[0] || null, why: label, saveKind: save.kind, pfx: rec,
                fail: full, failInf: fullInf, area: { total, half, kind: save.kind, deal, dealt: null } };
            if (r.player) _gmAskSave(r.e, item);
            else _gmRollNpcSave(r.e, item);
        });
        window.renderInitiativeTracker();
        if (typeof window._btRefreshAllOpenMaps === 'function') window._btRefreshAllOpenMaps();
        if (typeof window.saveWorldNotes === 'function') window.saveWorldNotes();
    };
};
// An area power's save came in: the damage by that roll. A reroll that changes it is flagged for the GM.
function _gmAreaSaveDamage(entry, item, pass, again) {
    let a = item.area, amt = pass ? (a.kind === 'halves' ? a.half : 0) : a.total;
    if (again) {
        if (a.dealt !== amt) gmLog({ gmOnly: true, kind: 'info', force: true, text: `${_gmGmName(entry)}'s reroll changes ${item.why}'s damage from ${a.dealt} to ${amt}: adjust their HP by hand.` });
        return;
    }
    a.dealt = amt;
    if (amt > 0) a.deal(entry, amt);
}
// No attack roll to match (dice rolled at the table): a typed "-N" (even -0) is still a hit,
// by whoever is taking their turn
function _gmTurnHit(target) {
    let cur = (window.gmInitiative || [])[window.gmCurrentTurnIdx];
    if (!window.gmCombatStarted || !cur || cur.id === target.id) return null;
    return { attacker: cur, hit: null, crit: false, dice: '', noRoll: true, label: 'attack' };
}
// The attack that just hit `target` (once per target, so an area power can hit several)
// The attack that would hit `target` right now (not used up): for its damage type
function _gmPeekHit(target) {
    let a = window._gmLastAttack;
    if (!a || !_gmFightOn() || !_gmAtkLive(a)) return null;
    if (a.attacker.id === target.id || a.used.has(target.id) || a.fumble) return null;
    return a;
}
function _gmTakeHit(target) {
    let a = window._gmLastAttack;
    if (!a || !_gmFightOn() || !_gmAtkLive(a)) return null;
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
// ── Grappling ─────────────────────────────────────────────────────────────
// Grapple (3 AP, contested): the target is Grappled and the grappler is Staggered for as long as it
// holds on. Pin (2 AP, contested): Grappled → Pinned (also Restrained and Prone). Choke (2 AP): unarmed
// damage on a Pinned creature, no attack roll, lethal or non-lethal. Escape (4 AP, contested) ends both.
// Links: target.grappledBy = grappler id; grappler.grappling = target id; grappler.grappleStagger when
// the grapple is what made it Staggered (so ending the grapple takes only that off).
function _gmEntryById(id) { return id ? (window.gmInitiative || []).find(e => e.id === id) || null : null; }
function _gmRemoveCondition(entry, condId) {
    if (entry.faction === 'player') _gmSetPlayerCondition(entry, condId, false);
    else if (window._gmRemoveEntryCondition) window._gmRemoveEntryCondition(entry.id, condId);
}
let _gmGrappleBusy = false;
function _gmStartGrapple(grappler, target, pin, opts) {
    if (!grappler || !target || grappler === target) return;
    _gmGrappleBusy = true;
    try {
        if (target.grappledBy && target.grappledBy !== grappler.id) _gmEndGrapple(target, null, true);
        if (grappler.grappling && grappler.grappling !== target.id) { let old = _gmEntryById(grappler.grappling); if (old) _gmEndGrapple(old, null, true); }
        target.grappledBy = grappler.id; grappler.grappling = target.id;
        _gmAddCondition(target, pin ? 'pinned' : 'grappled');
        let brute = grappler.faction === 'player' && ((((window.gmParty || []).find(p => p.fileName === grappler.playerUid) || {}).state || {}).perks || {}).str_brute >= 2;   // Brute Rank 2: not Staggered
        if (!brute && ((opts && opts.staggered) || !_gmEffConds(grappler).includes('staggered'))) {
            grappler.grappleStagger = true;
            if (!(opts && opts.staggered)) _gmAddCondition(grappler, 'staggered');
        }
    } finally { _gmGrappleBusy = false; }
    gmLog({ text: `${_gmPublicName(grappler)} ${pin ? 'pins' : 'grapples'} ${_gmPublicName(target)}${opts && opts.via ? ` (${opts.via})` : ''}. ${_gmPublicName(target)} is ${pin ? 'Pinned' : 'Grappled'}; ${_gmPublicName(grappler)} is Staggered while holding on.`, kind: 'info', force: true });
    window.renderInitiativeTracker();
    if (typeof window.saveWorldNotes === 'function') window.saveWorldNotes();
}
function _gmPin(target) {
    _gmGrappleBusy = true;
    try { _gmAddCondition(target, 'pinned'); } finally { _gmGrappleBusy = false; }
    let g = _gmEntryById(target.grappledBy);
    gmLog({ text: `${g ? _gmPublicName(g) + ' pins ' : ''}${_gmPublicName(target)}${g ? '' : ' is Pinned'}: Restrained and Prone.`, kind: 'info', force: true });
    window.renderInitiativeTracker();
}
function _gmEndGrapple(target, why, quiet) {
    if (!target) return;
    let g = _gmEntryById(target.grappledBy);
    _gmGrappleBusy = true;
    try {
        target.grappledBy = null;
        ['pinned', 'grappled'].forEach(c => _gmRemoveCondition(target, c));
        if (g) {
            g.grappling = null;
            if (g.grappleStagger) { g.grappleStagger = false; _gmRemoveCondition(g, 'staggered'); }
        }
    } finally { _gmGrappleBusy = false; }
    if (!quiet) gmLog({ text: `${why ? why + ': ' : ''}${g ? _gmPublicName(g) + '\'s grapple on ' : 'The grapple on '}${_gmPublicName(target)} ends.`, kind: 'info', force: true });
    window.renderInitiativeTracker();
    if (typeof window.saveWorldNotes === 'function') window.saveWorldNotes();
}
// Who's doing the grappling? The creature touching it on the battle map when there's only one;
// otherwise the GM picks (or leaves it unlinked)
async function _gmPickGrappler(target, title, filterFn) {
    let adj = typeof window._btAdjacentEntries === 'function' ? window._btAdjacentEntries(target) : [];
    if (filterFn) adj = adj.filter(filterFn);
    if (adj.length === 1) return adj[0];
    let pool = adj.length ? adj : (window.gmInitiative || []).filter(e => e !== target && (!filterFn || filterFn(e)));
    if (!pool.length || !window.APXDice || !APXDice.ask) return null;
    let ans = await APXDice.ask(title, adj.length ? 'More than one creature is next to it.' : 'Nothing is next to it on a battle map.', pool.slice(0, 12).map((e, i) => [e.id, _gmGmName(e), i ? '' : 'pri']).concat([['__none', 'Nobody (no link)']]));
    return ans && ans !== '__none' ? _gmEntryById(ans) : null;
}
// Conditions changed by hand (the tracker, a token, a player's own sheet): keep the grapple in step
window._gmOnCondChange = async function(entryId, condId, on) {
    if (_gmGrappleBusy) return;
    let entry = _gmEntryById(entryId); if (!entry) return;
    let eff = entry.faction === 'player' && typeof _gmPlayerCondList === 'function' && window.apxEffectiveConditions
        ? window.apxEffectiveConditions(_gmPlayerCondList(entry)).map(c => c.id) : _gmEffConds(entry);   // (players: including what was just set)
    if (on && (condId === 'grappled' || condId === 'pinned') && !entry.grappledBy) {
        let g = await _gmPickGrappler(entry, `Who is grappling ${_gmGmName(entry)}?`);
        if (g) {
            entry.grappledBy = g.id; g.grappling = entry.id;
            if (!_gmEffConds(g).includes('staggered')) { g.grappleStagger = true; _gmGrappleBusy = true; try { _gmAddCondition(g, 'staggered'); } finally { _gmGrappleBusy = false; } }
            gmLog({ text: `${_gmPublicName(g)} is grappling ${_gmPublicName(entry)} (Staggered while holding on).`, kind: 'info', force: true });
            window.renderInitiativeTracker();
        }
        return;
    }
    if (!on && (condId === 'grappled' || condId === 'pinned') && entry.grappledBy && !eff.includes('grappled')) { _gmEndGrapple(entry); return; }
    if (on && entry.grappling && eff.includes('incapacitated')) { let t = _gmEntryById(entry.grappling); if (t) _gmEndGrapple(t, `${_gmPublicName(entry)} is Incapacitated`); }
};
// A player's grappling actions, from their sheet's Actions list
async function _gmGrappleEvent(uid, ev) {
    let me = ev.companion ? (window.gmInitiative || []).find(e => e.companionOf === uid) : (window.gmInitiative || []).find(e => e.playerUid === uid && !e.companionOf && !e.summonOf);
    let who = me ? _gmPublicName(me) : (ev.who || 'A player');
    if (!me) { gmLog({ text: `${who}: ${ev.text || ev.action}`, kind: 'info', force: true }); return; }
    if (ev.action === 'grapple' || (ev.action === 'pin' && !me.grappling)) {
        let t = await _gmPickGrappler(me, `Who did ${_gmGmName(me)} ${ev.action === 'pin' ? 'pin' : 'grapple'}?`, e => !(e.companionOf === uid));
        if (t) _gmStartGrapple(me, t, ev.action === 'pin', { staggered: !!ev.staggered });
        else gmLog({ text: `${who} grapples a creature: mark it Grappled from its conditions.`, kind: 'info', force: true });
    } else if (ev.action === 'pin') {
        let t = _gmEntryById(me.grappling); if (t) _gmPin(t);
    } else if (ev.action === 'escape') {
        if (me.grappledBy) _gmEndGrapple(me, `${who} escapes`);
        else gmLog({ text: `${who} escapes a grapple.`, kind: 'info', force: true });
    } else if (ev.action === 'release') {
        let t = _gmEntryById(me.grappling); if (t) _gmEndGrapple(t, `${who} lets go`);
    } else if (ev.action === 'choke') {
        let t = _gmEntryById(me.grappling);
        if (t && ev.total != null) _gmDamage(t, { raw: parseInt(ev.total) || 0, types: ['Bludgeoning'], hit: null, src: `${me.name}'s Choke`, nonlethal: !!ev.nonlethal });
        else gmLog({ text: `${who} chokes a creature: ${ev.total} Bludgeoning${ev.nonlethal ? ' (non-lethal)' : ''}.`, kind: 'info', force: true });
    }
}
window._gmGrappleEvent = _gmGrappleEvent;
window._gmStartGrapple = _gmStartGrapple; window._gmEndGrapple = _gmEndGrapple;
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
    // Torso Wound: every time they take damage, they take one more die of it (the largest die the attack rolled)
    {
        let pm = target.faction === 'player' ? (window.gmParty || []).find(p => p.fileName === target.playerUid) : null;
        // (each Torso Wound adds one more die)
        let torso = (target.faction === 'player' ? (pm?.state?.woundedLimbs || []) : (target.wounds || [])).filter(l => l === 'Torso').length;
        if (torso) {
            let sides = 0;
            String(hit.dice || (hit.hit && hit.hit.die) || '').replace(/(\d*)d(\d+)/gi, (m, n, s) => { sides = Math.max(sides, parseInt(s, 10)); return m; });
            if (sides) {
                let n = _gmRollDie(torso + 'd' + sides);
                out.push({ n, why: 'Torso Wound', pub: `${_gmPublicName(target)}'s Wounded Torso takes ${torso > 1 ? torso + ' extra damage dice' : 'an extra damage die'}.`, gm: `Torso Wound${torso > 1 ? ' ×' + torso : ''}: ${_gmGmName(target)} takes ${torso > 1 ? torso + ' extra dice' : 'an extra die'}, +${n} damage (${torso}d${sides}).` });
            } else gmLog({ gmOnly: true, kind: 'info', text: `${_gmGmName(target)} has ${torso > 1 ? torso + ' Torso Wounds' : 'a Wounded Torso'}: add ${torso > 1 ? torso + ' more dice' : 'one more die'} of this attack's damage by hand (no roll to take it from).` });
        }
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
    if (props.includes('grappling') && a) _gmStartGrapple(a, target, false, { via: `${h.weapon || 'weapon'}, Grappling` });
    // Ammo: Light lets the shooter move for free once a turn; Medium slows (crit: the target is Wounded, the
    // shooter picks the limb); Heavy can push 2 squares (crit: Staggered) and does double damage to objects
    if (h.ammo === 'light') {
        gmLog({ text: `${_gmPublicName(a)} can move up to their Speed for 0 AP before the end of this turn (Light Ammo, once per turn).`, kind: 'info' });
    } else if (h.ammo === 'medium') {
        gmLog({ text: `${_gmPublicName(target)}'s Speed is 1 lower until the end of its next turn (Medium Ammo).`, kind: 'info' });
        if (hit.crit) {
            let lid = 'ammolimb_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
            if (target.faction === 'player' && target.playerUid) {
                let pm = (window.gmParty || []).find(p => p.fileName === target.playerUid), already = pm?.state?.woundedLimbs || [];
                let limbs = window.apxWoundSlotsFor ? window.apxWoundSlotsFor(pm?.state) : (typeof WOUND_LIMBS_BASE !== 'undefined' ? WOUND_LIMBS_BASE.slice() : ['Head', 'Torso', 'Left Arm', 'Right Arm', 'Left Leg', 'Right Leg']);
                gmLog({ id: lid, gmOnly: true, force: true, kind: 'wt', text: `Critical Hit with Medium Ammo: ${_gmGmName(target)} is Wounded. ${_gmGmName(a)} chooses the limb:`,
                    ask: { gm: true, entryId: target.id, kind: 'limb', logId: lid, choices: limbs.map(l => already.includes(l) && l !== 'Torso' ? l + ' (again)' : l) } });
            } else {
                let already = target.wounds || [];
                window._gmNpcLimbState = window._gmNpcLimbState || {}; window._gmNpcLimbState[lid] = { limbLog: lid };
                gmLog({ id: lid, gmOnly: true, force: true, kind: 'wt', text: `Critical Hit with Medium Ammo: ${_gmGmName(target)} is Wounded. ${_gmGmName(a)} chooses the limb:`,
                    ask: { gm: true, entryId: target.id, kind: 'npclimb', logId: lid, choices: _gmNpcLimbs(target).filter(l => l === 'Torso' || !already.includes(l)) } });
            }
            gmLog({ text: `Critical Hit: ${_gmPublicName(target)} is Wounded (Medium Ammo).`, kind: 'info' });
        }
    } else if (h.ammo === 'heavy') {
        gmLog({ text: `${_gmPublicName(a)} can push ${_gmPublicName(target)} up to 2 squares away (Heavy Ammo).${hit.crit ? ` Critical Hit: ${_gmPublicName(target)} is Staggered.` : ''}`, kind: 'info' });
        if (hit.crit) _gmAddCondition(target, 'staggered');
    }
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
        let itemKey = (item.pfx || item.escape) ? 'si' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) : null;
        if (itemKey) window._gmPfxItems[itemKey] = item;
        gmLog({ text, gmText: `${_gmGmName(target)} must make a DC ${item.dc} ${item.attr} save or ${item.failInf || item.fail} (${item.why}).`, kind: 'wt',
            ask: { gm: true, entryId: target.id, roll: 'save', attr: item.attr, dc: item.dc, cond: item.cond, fail: item.fail, byId: item.byId || null, turn: item.turn || null, itemKey, label: `Roll ${_gmGmName(target)}'s ${item.attr} save (DC ${item.dc})` } });
    }
}
function _gmCondResult(entry, item, ev, again) {
    let pass = !ev.autoFail && ev.total >= item.dc;
    let name = _gmPublicName(entry);
    if (item.escape) return _gmEscapeResult(entry, item, pass, ev);
    if (item.area) _gmAreaSaveDamage(entry, item, pass, again);   // an area power: its damage, by this roll
    if (item.area && !item.pfx) return pass ? `${name} succeeds on the ${item.attr} save against ${item.why} (${ev.total} vs DC ${item.dc}): ${item.saveKind === 'halves' ? 'half damage' : 'unaffected'}.`
        : `${name} fails the ${item.attr} save against ${item.why} (${ev.total} vs DC ${item.dc}) and ${item.fail}.`;
    if (item.pfx) {
        // A power's saving throw: on a failure its Conditions go on (and a lasting one is tracked)
        if (!pass && !item.applied && item.pfx.conds.length) _gmApplyPfx(entry, item.pfx);
        else if (pass && again && item.applied) _gmEndPfx(entry, item.pfx.key, null);
        item.applied = !pass && item.pfx.conds.length > 0;
        let tail = item.saveKind === 'halves' ? ': half damage' + (item.pfx.conds.length ? ' and no other effects' : '') : ': unaffected';
        return pass ? `${name} succeeds on the ${item.attr} save against ${item.why} (${ev.total} vs DC ${item.dc})${tail}.`
                    : `${name} fails the ${item.attr} save against ${item.why} (${ev.total} vs DC ${item.dc}) and ${item.fail}.`;
    }
    if (!pass) { _gmAddCondition(entry, item.cond); if (item.byId) _gmSetCondTimer(entry, item); }
    else if (again && item.applied) { _gmClearCondTimer(entry, item); if (entry.faction === 'player') _gmSetPlayerCondition(entry, item.cond, false); else if (window._gmRemoveEntryCondition) window._gmRemoveEntryCondition(entry.id, item.cond); }
    item.applied = !pass;
    return pass ? `${name} succeeds on the ${item.attr} save (${ev.total} vs DC ${item.dc}).`
                : `${name} fails the ${item.attr} save (${ev.total} vs DC ${item.dc}) and ${item.fail}.`;
}

// ── Power effects: saving throws, Conditions and Escape Saves ─────────────
// A power that calls for a save or inflicts Conditions puts a button in the GM's dice tray: pick its
// targets, and NPCs' saves are rolled (players are asked to roll theirs). On a failed save (or
// straight away, for a power with no save) its Conditions go on. A lasting effect is tracked on the
// creature: it makes its Escape Save at the end of each of its turns (and whenever it takes damage,
// with Damage Interrupt), and Action Interrupt ends it when the creature attacks. An effect that lasts
// until the end of the target's next turn wears off then.
window._gmPfx = window._gmPfx || {};            // offer id -> { casterId, label, fx }
window._gmPfxItems = window._gmPfxItems || {};  // NPC save button -> its save item
function _gmCondNames(conds) {
    let n = (conds || []).map(c => window._gmCondName ? window._gmCondName(c) : c);
    return n.length > 1 ? n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1] : (n[0] || '');
}
window._gmPowerFxOffer = function(caster, label, fx) {
    if (!caster || !fx || !_gmFightOn()) return null;
    let conds = (fx.conds || []).filter(c => c && c !== 'wounded');
    let save = !!(fx.saveKind && fx.saveAttr);
    if (!conds.length && !save) return null;
    let id = 'pfx_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    window._gmPfx[id] = { casterId: caster.id, label: label || 'a power', fx: Object.assign({}, fx, { conds }) };
    let what = _gmCondNames(conds);
    let text = `${_gmGmName(caster)} used ${label || 'a power'}` + (save ? `: targets make a DC ${fx.dc} ${fx.saveAttr} save${what ? ' or are ' + what : ''}` : what ? `, which inflicts ${what}` : '')
        + (fx.lasting && fx.escapeAttr ? ` (Escape Save: ${fx.escapeAttr})` : what ? ' (until the end of the target\'s next turn)' : '') + '.';
    return gmLog({ id, gmOnly: true, kind: 'info', text,
        ask: { gm: true, free: true, entryId: caster.id, kind: 'pfx', pfx: id, label: save ? `Roll targets' ${fx.saveAttr} saves` : `Apply ${what} to the targets it hit`, doneLabel: save ? 'Saves rolled' : 'Applied' } });
};
// Choose the targets (everyone in initiative but the user)
function _gmPfxPick(id) {
    let o = window._gmPfx[id]; if (!o) return;
    let fx = o.fx, save = !!(fx.saveKind && fx.saveAttr);
    let list = (window.gmInitiative || []).filter(e => e.id !== o.casterId);
    if (!list.length) { window.APXDice?.notify('No one else is in the initiative order.', { kind: 'warn' }); return; }
    if (window.apxInjectDialogStyles) window.apxInjectDialogStyles();
    document.getElementById('apxPfxPick')?.remove();
    let esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    let col = { player: '#60a5fa', ally: '#4ade80', neutral: '#e2e8f0', enemy: '#f87171' };
    let back = document.createElement('div');
    back.id = 'apxPfxPick'; back.className = 'apxdlg-back'; back.style.zIndex = 2147483300;
    back.innerHTML = `<div class="apxdlg" style="width:min(380px,100%)"><div class="apxdlg-title">${esc(o.label)}</div>
        <div class="apxdlg-msg">${save ? `Who has to make the DC ${fx.dc} ${fx.saveAttr} save? NPCs' saves are rolled now; players are asked to roll theirs.` : `Who did it hit? They are ${esc(_gmCondNames(fx.conds))}.`}</div>
        <div style="display:flex;flex-direction:column;gap:.3rem;max-height:50vh;overflow-y:auto;margin-bottom:.8rem">
        ${list.map(e => `<label style="display:flex;align-items:center;gap:.45rem;font-size:.78rem;cursor:pointer"><input type="checkbox" data-t="${esc(e.id)}"> <span style="color:${col[e.faction] || '#e2e8f0'};font-weight:700">${esc(_gmGmName(e))}</span></label>`).join('')}
        </div><div class="apxdlg-row"><button class="apxdlg-btn" data-x>Cancel</button><button class="apxdlg-btn apxdlg-ok" data-ok>${save ? 'Roll Saves' : 'Apply'}</button></div></div>`;
    back.querySelector('[data-x]').onclick = () => back.remove();
    back.querySelector('[data-ok]').onclick = () => {
        let ids = [...back.querySelectorAll('[data-t]')].filter(c => c.checked).map(c => c.dataset.t);
        back.remove();
        ids.forEach(tid => { let t = (window.gmInitiative || []).find(e => e.id === tid); if (t) _gmPfxResolve(o, t); });
        window.renderInitiativeTracker();
    };
    document.body.appendChild(back);
}
window._gmPfxPick = _gmPfxPick;
function _gmPfxRecord(o) {
    let fx = o.fx;
    return { key: o.casterId + '|' + o.label, label: o.label, conds: fx.conds.slice(), attr: fx.lasting ? fx.escapeAttr || null : null, dc: fx.dc,
        byId: o.casterId, lasting: !!fx.lasting, dur: fx.dur || 'instant', dmgInt: !!fx.dmgInt, actInt: !!fx.actInt };
}
function _gmPfxResolve(o, t) {
    let fx = o.fx, rec = _gmPfxRecord(o), what = _gmCondNames(fx.conds);
    if (fx.saveKind && fx.saveAttr) {
        let item = { attr: fx.saveAttr, dc: fx.dc, cond: fx.conds[0] || null, why: o.label, saveKind: fx.saveKind, pfx: rec,
            fail: fx.conds.length ? `is ${what}` : (fx.saveKind === 'halves' ? 'takes the full damage' : 'is affected'),
            failInf: fx.conds.length ? `be ${what}` : (fx.saveKind === 'halves' ? 'take the full damage' : 'be affected') };
        if (t.faction === 'player' && t.playerUid) _gmAskSave(t, item);
        else _gmRollNpcSave(t, item);
        return;
    }
    if (!fx.conds.length) return;
    _gmApplyPfx(t, rec);
    gmLog({ text: `${_gmPublicName(t)} is ${what} (${o.label}).`, gmText: `${_gmGmName(t)} is ${what} (${o.label}).`, kind: 'info' });
}
// An NPC's (or companion's) save, rolled from its stat block (its conditions count: auto-fails, Disadvantage)
function _gmRollNpcSave(t, item) {
    if (!window.APXDice) return;
    let sb = t.sourceNpcId && typeof ncStatBlockFor === 'function' ? ncStatBlockFor(t.sourceNpcId) : null;
    if (!sb && t.companionOf) { let pm = (window.gmParty || []).find(p => p.fileName === t.companionOf); try { sb = pm ? gmCompanionSb(pm) : null; } catch (e) { } }
    let bonus = sb ? ((sb.saves || {})[item.attr] ?? (sb.mods ? (sb.mods[item.attr] || 0) : 0)) : 0;
    let first = true, logId = 'pfs_' + t.id + '_' + Date.now().toString(36);
    APXDice.check({ kind: 'save', attr: item.attr, label: `${item.attr} Save (DC ${item.dc})${item.escape ? ': Escape' : ''}`, who: t.name, bonus, perks: false, initId: t.id,
        note: sb ? null : 'No stat block: add their save bonus yourself',
        onResult: r => {
            let txt = _gmCondResult(t, item, { total: r.total, autoFail: r.autoFail }, !first);
            gmLog({ id: logId, text: txt, kind: 'wt' });
            first = false;
            window.renderInitiativeTracker();
            return txt;
        } });
}
window._gmRollNpcSave = _gmRollNpcSave;
function _gmApplyPfx(entry, rec) {
    let r = Object.assign({}, rec, { id: 'fx' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), turn: window.gmTurnNumber || 0 });
    entry._powerFx = (entry._powerFx || []).filter(f => f.key !== r.key).concat(r);
    r.conds.forEach(c => _gmAddCondition(entry, c));
    // Instant / End of Next Turn: gone at the end of the target's next turn
    if (!r.lasting) r.conds.forEach(c => _gmSetCondTimer(entry, { cond: c, byId: entry.id, turn: r.turn }));
    return r;
}
window._gmApplyPfx = _gmApplyPfx;
function _gmEndPfx(entry, keyOrId, why) {
    let list = entry._powerFx || [];
    let f = list.find(x => x.id === keyOrId || x.key === keyOrId); if (!f) return;
    entry._powerFx = list.filter(x => x !== f);
    let still = new Set(entry._powerFx.reduce((a, x) => a.concat(x.conds), []));
    entry._noStandCost = true;
    try {
        f.conds.forEach(c => {
            if (still.has(c)) return;
            if (entry.faction === 'player') _gmSetPlayerCondition(entry, c, false);
            else if (window._gmRemoveEntryCondition) window._gmRemoveEntryCondition(entry.id, c);
        });
    } finally { delete entry._noStandCost; }
    if (entry._condTimers) entry._condTimers = entry._condTimers.filter(t => !(f.conds.includes(t.cond) && !still.has(t.cond)));
    if (why) gmLog({ text: `${_gmPublicName(entry)} is no longer ${_gmCondNames(f.conds)} (${f.label}: ${why}).`, gmText: `${_gmGmName(entry)} is no longer ${_gmCondNames(f.conds)} (${f.label}: ${why}).`, kind: 'info' });
    window.renderInitiativeTracker();
}
window._gmEndPfx = _gmEndPfx;
function _gmPfxAskEscape(entry, f, why) {
    let what = _gmCondNames(f.conds);
    let item = { attr: f.attr, dc: f.dc, cond: f.conds[0] || null, escape: f.id, label: f.label, why: `Escape Save against ${f.label}${why ? ', ' + why : ''}`,
        fail: `stays ${what}`, failInf: `stay ${what}` };
    _gmAskSave(entry, item);   // players roll it from their dice tray; NPCs get a button in the GM's
}
function _gmEscapeResult(entry, item, pass, ev) {
    let name = _gmPublicName(entry);
    let f = (entry._powerFx || []).find(x => x.id === item.escape);
    let what = f ? _gmCondNames(f.conds) : 'affected';
    if (pass) {
        if (f) _gmEndPfx(entry, f.id, null);
        return `${name} makes the ${item.attr} Escape Save (${ev.total} vs DC ${item.dc}) and breaks free of ${item.label || 'the power'}${f ? `: no longer ${what}` : ''}.`;
    }
    return `${name} fails the ${item.attr} Escape Save (${ev.total} vs DC ${item.dc}) and stays ${what}.`;
}
// End of a creature's turn: Escape Saves against lasting effects; end-of-next-turn effects are done
function _gmPfxTurnEnd(ending) {
    if (!ending || !window.gmCombatStarted || !(ending._powerFx || []).length) return;
    ending._powerFx = ending._powerFx.filter(f => f.lasting || !(window.gmTurnNumber > f.turn));
    ending._powerFx.filter(f => f.lasting && f.attr).forEach(f => _gmPfxAskEscape(ending, f, null));
}
// Damage Interrupt: taking damage calls for the Escape Save (or ends an effect that has none)
function _gmPfxOnDamage(entry) {
    (entry && entry._powerFx || []).filter(f => f.dmgInt).forEach(f => {
        if (f.lasting && f.attr) _gmPfxAskEscape(entry, f, 'it took damage (Damage Interrupt)');
        else _gmEndPfx(entry, f.id, 'it took damage (Damage Interrupt)');
    });
}
// Action Interrupt: attacking (or using a harmful power) ends the effect
function _gmPfxOnAction(entry) {
    (entry && entry._powerFx || []).filter(f => f.actInt).forEach(f => _gmEndPfx(entry, f.id, 'it attacked (Action Interrupt)'));
}
// The tracker row: each lasting effect, its Escape Save, and buttons to roll it now or end it
window._gmPfxEscapeNow = function(entryId, fxId, pay) {
    let e = (window.gmInitiative || []).find(x => x.id === entryId); if (!e) return;
    let f = (e._powerFx || []).find(x => x.id === fxId); if (!f || !f.attr) return;
    if (pay && e.faction !== 'player') e.apCur = Math.max(0, (parseInt(e.apCur) || 0) - 3);
    _gmPfxAskEscape(e, f, pay ? 'spending 3 AP (Action Interrupt)' : null);
    window.renderInitiativeTracker();
};
window._gmPfxEnd = function(entryId, fxId) {
    let e = (window.gmInitiative || []).find(x => x.id === entryId); if (!e) return;
    _gmEndPfx(e, fxId, 'ended by the GM');
};
function _gmPowerFxHtml(e) {
    let l = e._powerFx || []; if (!l.length) return '';
    let esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    let b = 'font-size:8px;font-weight:800;padding:0 .3rem;border-radius:.2rem;background:#4c1d95;color:#ede9fe;border:1px solid #7c3aed;cursor:pointer;margin-left:.2rem';
    return `<div class="flex items-center gap-1 flex-wrap">${l.map(f => {
        let tip = f.lasting && f.attr ? `Escape Save ${f.attr} (DC ${f.dc}) at the end of each of its turns${f.dmgInt ? ' and when it takes damage' : ''}${f.actInt ? '; attacking ends it, or 3 AP repeats the Escape Save' : ''}` : 'Ends at the end of its next turn';
        return `<span class="apx-cond-chip" style="border-color:#a78bfa;color:#ddd6fe" title="${esc(tip)}">${esc(f.label)}: ${esc(_gmCondNames(f.conds))}${f.lasting && f.attr ? ` · Escape ${f.attr} ${f.dc}` : ''}`
            + (f.lasting && f.attr ? `<button style="${b}" onclick="window._gmPfxEscapeNow('${e.id}','${f.id}',false)" title="Roll its Escape Save now">Save</button>` : '')
            + (f.lasting && f.attr && f.actInt ? `<button style="${b}" onclick="window._gmPfxEscapeNow('${e.id}','${f.id}',true)" title="Spend 3 AP to repeat the Escape Save (Action Interrupt)">3 AP</button>` : '')
            + `<button onclick="window._gmPfxEnd('${e.id}','${f.id}')" title="End it">&times;</button></span>`;
    }).join('')}</div>`;
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
// NPCs' and companions' conditions change their rolls, as a player's do on their sheet:
// Disadvantage (Poisoned, Frightened, Prone melee…), Advantage (Prone ranged), auto-fails
// (Paralyzed STR/AGI…), and a warning before an Incapacitated creature attacks
window.apxRollConditions = function(o, kind) {
    let init = window.gmInitiative || []; if (!init.length || !o) return null;
    let e = _gmAttackerFor(o, kind);
    if (!e || e.faction === 'player') return null;
    let conds = _gmEffConds(e), wdis = _gmWoundRollMods(e, kind, o.attr);
    if (!conds.length && !wdis.length) return null;
    let m = conds.length && window.apxConditionRollMods ? window.apxConditionRollMods(conds, kind, o.attr, !!o.ranged) : null;
    m = m || { dis: [], adv: [], autoFail: [] };
    if (wdis.length) m.dis = (m.dis || []).concat(wdis);
    return m;
};
// NPC saves from the GM's dice tray button (the log message asks for them)
window.apxLogAsk = function(ask) { return !!(ask && ask.gm && (ask.kind === 'pfx' ? !!window._gmPfx[ask.pfx] : true) && (window.gmInitiative || []).some(e => e.id === ask.entryId)); };
window.apxRollFromAsk = function(ask, choice) {
    let e = (window.gmInitiative || []).find(x => x.id === ask.entryId); if (!e || !window.APXDice) return;
    if (ask.kind === 'limb') { if (choice) _gmApplyWound(e, choice, ask.logId); return; }
    if (ask.kind === 'npclimb') { if (choice) _gmApplyNpcWound(e, choice, ask.logId); return; }
    if (ask.kind === 'npcwound') { _gmNpcWoundSave(e, ask); return; }
    let sb = e.sourceNpcId && typeof ncStatBlockFor === 'function' ? ncStatBlockFor(e.sourceNpcId) : null;
    let bonus = sb ? ((sb.saves || {})[ask.attr] ?? (sb.mods ? (sb.mods[ask.attr] || 0) : 0)) : 0;   // trained saves add the Training Bonus
    if (ask.kind === 'pfx') { _gmPfxPick(ask.pfx); return; }
    let item = (ask.itemKey && window._gmPfxItems[ask.itemKey]) || { attr: ask.attr, dc: ask.dc, cond: ask.cond, fail: ask.fail, byId: ask.byId || null, turn: ask.turn || null };
    if (item.pfx || item.escape) { _gmRollNpcSave(e, item); return; }
    let first = true;
    APXDice.check({ kind: 'save', attr: ask.attr, label: `${ask.attr} Save (DC ${ask.dc})`, who: e.name, bonus, perks: false, initId: e.id,
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
    let lid = 'limb_' + ev.id;
    if (!failed) {
        // A Luck reroll or an Omen die turned the failure into a success: no Wound after all
        _gmRetractLimbs(entry, lid, `${entry.name} succeeded on the reroll (${ev.total} vs DC ${item.dc}): no limb is Wounded.`, 'succeeds on the reroll');
        return;
    }
    if (window._gmWoundChosen[lid] && !window._gmWoundChosen[lid].undone) return;   // already picked for this roll
    let pm = (window.gmParty || []).find(p => p.fileName === entry.playerUid);
    let already = pm?.state?.woundedLimbs || [];
    let limbs = window.apxWoundSlotsFor ? window.apxWoundSlotsFor(pm?.state) : (typeof WOUND_LIMBS_BASE !== 'undefined' ? WOUND_LIMBS_BASE : ['Head', 'Torso', 'Left Arm', 'Right Arm', 'Left Leg', 'Right Leg']).slice();
    already.forEach(l => { if (!limbs.includes(l)) limbs.push(l); });
    gmLog({ id: 'limb_' + ev.id, gmOnly: true, kind: 'wt', force: true,
        text: `Choose the limb ${entry.name} Wounds (based on the attack)${already.length ? `. Already Wounded: ${already.join(', ')} (Wounding one again is a Permanent Injury, except the Torso, which takes another extra damage die)` : ''}:`,
        ask: { gm: true, entryId: entry.id, kind: 'limb', logId: lid, choices: limbs.map(l => already.includes(l) && l !== 'Torso' ? l + ' (again)' : l) } });
}
window._gmWoundChosen = {};
// Take back the limb choice for a Wound Threshold save that no longer fails (and the Wound, if one was picked)
function _gmRetractLimbs(entry, lid, gmText, why) {
    if (!window.gmCombatLog.some(x => x.id === lid)) return;
    let chosen = window._gmWoundChosen[lid];
    if (chosen && !chosen.undone) {
        chosen.undone = true;
        let code = _gmInviteCode();
        if (code && window.apxAuth?.enabled && typeof window.apxAuth.setGmWound === 'function')
            window.apxAuth.setGmWound(code, entry.playerUid, chosen.limb, true).catch(e => console.warn('Wound to player:', e.message));
        gmLog({ text: `${entry.name} ${why}, so their ${chosen.limb} is not Wounded after all.`, kind: 'wt', force: true });
    }
    gmLog({ id: lid, gmOnly: true, kind: 'wt', force: true, ask: null, text: gmText });
}
// Defensive Rank 5 (Reaction, unarmored): a Critical Hit against you becomes a normal hit.
// The player gets a button; using it undoes the crit's extra damage and re-checks the Wound Threshold.
window._gmCritHits = {};
function _gmDefensiveOk(entry) {
    let pm = (window.gmParty || []).find(p => p.fileName === entry.playerUid);
    let st = pm?.state; if (!st) return false;
    let d = st.derived;
    if (d && typeof d.unarmored === 'boolean') return (d.defensive || 0) >= 5 && d.unarmored;   // what their sheet says
    return ((st.perks || {}).con_defensive || 0) >= 5 && !((st.equippedArmor || {}).wt > 0);
}
// A Helmet can be destroyed (Reaction) to do the same
function _gmHelmetOk(entry) {
    let pm = (window.gmParty || []).find(p => p.fileName === entry.playerUid);
    let h = pm?.state?.equippedHelmet;
    return !!(h && h.equipped && !h.broken);
}
function _gmOfferDefensive(entry, hit, dmg, extras) {
    if (!entry || entry.faction !== 'player' || !entry.playerUid || !hit || !(dmg > 0)) return null;
    let defOk = _gmDefensiveOk(entry), helmOk = _gmHelmetOk(entry);
    if (!defOk && !helmOk) return null;
    let portion = hit.crit ? (hit.critExtra || 0) : (extras || []).filter(x => x.why === 'Incapacitated').reduce((t, x) => t + x.n, 0);
    if (!(portion > 0)) return null;
    let hid = 'dh' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    window._gmCritHits[hid] = { entryId: entry.id, dmg, refund: Math.min(dmg, Math.max(0, portion)), by: hit.attacker ? _gmPublicName(hit.attacker) : null };
    let choices = (defOk ? ['React: Turn to normal hit (Defensive)'] : []).concat(helmOk ? ['React: Break Helmet (normal hit)'] : []);
    gmLog({ id: 'def_' + hid, kind: 'wt',
        text: `${entry.name} took a Critical Hit. They can use their Reaction to turn it into a normal hit (${[defOk ? 'Defensive Rank 5' : '', helmOk ? 'by destroying their Helmet' : ''].filter(Boolean).join(', or ')}).`,
        ask: { uid: entry.playerUid, roll: 'react', hitId: hid, label: choices[0], choices } });
    return hid;
}
function _gmDefensiveReact(entry, hid, via) {
    let rec = window._gmCritHits[hid];
    if (!rec || rec.used || rec.entryId !== entry.id) return;
    rec.used = true;
    let wasUp = entry.currentHp === null || entry.currentHp > 0;
    let newDmg = Math.max(0, rec.dmg - rec.refund);
    if (rec.refund > 0 && entry.currentHp !== null) entry.currentHp = Math.min(entry.maxHp || Infinity, (entry.currentHp || 0) + rec.refund);
    gmLog({ id: 'def_' + hid, kind: 'wt', ask: null,
        text: `${entry.name} uses their Reaction (${via === 'helmet' ? 'destroying their Helmet' : 'Defensive'}): the Critical Hit becomes a normal hit. They take ${newDmg} damage instead of ${rec.dmg}.` });
    // Wound Threshold: a save still waiting is dropped (or its DC lowered); one already rolled is re-judged
    let wt = _gmWoundThreshold(entry), past = wt != null && newDmg > wt, dc = Math.max(10, Math.floor(newDmg / 2));
    let q = window._gmPendingSaves[entry.id] || [];
    let qi = q.findIndex(x => x.type === 'wt' && x.hitId === hid);
    if (qi >= 0) {
        let item = q[qi];
        if (!past) {
            q.splice(qi, 1);
            if (item.logId) gmLog({ id: item.logId, kind: 'wt', ask: null, text: `${entry.name} took ${newDmg} damage after all, not more than their Wound Threshold (${wt}): no CON save needed.` });
        } else {
            item.dc = dc; item.dmg = newDmg;
            if (item.logId) gmLog({ id: item.logId, kind: 'wt', ask: { uid: entry.playerUid, roll: 'save', dc },
                text: `${entry.name} took ${newDmg} damage, more than their Wound Threshold (${wt}). They must make a DC ${dc} CON save to resist being wounded.` });
        }
    } else {
        let evId = Object.keys(window._gmResolvedSaves).find(k => window._gmResolvedSaves[k].item.hitId === hid && window._gmResolvedSaves[k].entryId === entry.id);
        let done = evId && window._gmResolvedSaves[evId];
        if (done) {
            let ev = done.ev || {};
            if (!past) _gmRetractLimbs(entry, 'limb_' + evId, `${entry.name}'s hit is no longer past their Wound Threshold (Defensive): no limb is Wounded.`, 'turned the Critical Hit into a normal hit');
            else {
                done.item.dc = dc;
                if (!ev.autoFail && ev.total >= dc) _gmRetractLimbs(entry, 'limb_' + evId, `With the lower DC ${dc}, ${entry.name}'s save of ${ev.total} succeeds: no limb is Wounded.`, 'turned the Critical Hit into a normal hit');
                gmLog({ id: 'res_' + evId, kind: 'wt', text: _gmResolveText(entry, done.item, ev).text + ' (Defensive: DC now ' + dc + ')' });
            }
        }
    }
    // Back above 0 HP: no Bleed Out roll needed
    if (entry.currentHp > 0) {
        let bi = q.findIndex(x => x.type === 'bleed');
        if (bi >= 0) { let b = q.splice(bi, 1)[0]; if (b.logId) gmLog({ id: b.logId, kind: 'bleed', ask: null, text: `${entry.name} is back above 0 HP and no longer Bleeding Out.` }); }
    }
    _afterHpChange(entry, wasUp);
    if (entry.currentHp > 0) _syncHpToPlayer(entry);
}
window._gmDefensiveReact = _gmDefensiveReact;   // limb log id -> { limb, again } (so a successful reroll can take it back)
function _gmApplyWound(entry, choice, logId) {
    let limb = String(choice).replace(/ \(again\)$/, '');
    let again = / \(again\)$/.test(choice);
    if (logId) window._gmWoundChosen[logId] = { limb, again };
    let code = _gmInviteCode();
    if (code && window.apxAuth?.enabled && typeof window.apxAuth.setGmWound === 'function')
        window.apxAuth.setGmWound(code, entry.playerUid, limb).catch(e => console.warn('Wound to player:', e.message));
    let pmW = (window.gmParty || []).find(p => p.fileName === entry.playerUid), torsoN = limb === 'Torso' ? ((pmW?.state?.woundedLimbs || []).filter(l => l === 'Torso').length + 1) : 0;
    gmLog({ text: again ? `${entry.name}'s ${limb} is Wounded again: a Permanent Injury.` : torsoN > 1 ? `${entry.name}'s Torso is Wounded again (${torsoN} Torso Wounds: ${torsoN} extra damage dice from each hit).` : `${entry.name}'s ${limb} is Wounded.`, kind: 'wt', force: true });
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
    // A fight brought back from a saved session: rolls made before it was saved were already handled
    if (firstSeen && window._gmRollCutoff && (ev.t || 0) && ev.t <= window._gmRollCutoff) return;
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
    // Grapple / Pin / Escape / Choke / let go, from a player's Actions list
    if (ev.kind === 'tactician') { if (firstSeen) _gmTacAnswer(uid, ev); return; }
    if (ev.kind === 'grapple') { if (firstSeen && (ev.t || Date.now()) > Date.now() - 600000) _gmGrappleEvent(uid, ev); return; }
    // Summon a Creature: its creatures join next to the caster (in or out of combat)
    if (ev.kind === 'power' && ev.summon && firstSeen && (ev.t || Date.now()) > Date.now() - 600000) {
        if (typeof window._gmSpawnSummon === 'function') window._gmSpawnSummon(uid, ev);
    }
    let entry0 = (window.gmInitiative || []).find(e => e.playerUid === uid && e.faction === 'player');
    if (entry0 && ev.kind === 'check' && _gmFallFromRoll(entry0, ev)) return;
    // Checks and saves show for the GM whenever a player in this world rolls one (not only in combat)
    if (!_gmFightOn()) {
        if ((ev.kind === 'check' || ev.kind === 'save') && (ev.t || 0) > Date.now() - 300000) {
            let pname = ((window.gmParty || []).find(p => p.fileName === uid)?.summary?.name) || ev.who || 'A player';
            let mode0 = ev.mode === 'adv' ? ', Advantage' : ev.mode === 'dis' ? ', Disadvantage' : '';
            gmLog({ id: 'ev_' + ev.id, gmOnly: true, force: true, kind: 'roll',
                text: `${pname} rolled ${ev.label || 'a d20'}: ${ev.total} (d20 ${ev.nat}${ev.bonus ? (ev.bonus > 0 ? ' +' : ' −') + Math.abs(ev.bonus) : ''}${mode0})${ev.luck ? ' · Luck reroll' : ''}${ev.omen ? ' · Omen' : ''}${ev.autoFail ? ' · auto-fail' : ''}` });
        }
        return;
    }
    let entry = (window.gmInitiative || []).find(e => e.playerUid === uid);
    if (ev.kind === 'react') { if (entry && firstSeen) _gmDefensiveReact(entry, ev.hitId, ev.via); return; }
    if (ev.kind === 'damage') { if (firstSeen) _gmSheetDamageEvent(uid, ev); return; }
    let name = entry ? entry.name : (ev.who || 'A player');
    // A player's attack (weapon or power) becomes "the last attack", for hits and weapon properties
    if (ev.kind === 'attack') {
        let atkEntry = ev.companion ? (window.gmInitiative || []).find(e => e.companionOf === uid) : entry;
        if (atkEntry) _gmRecordAttack({ id: ev.id, attacker: atkEntry, label: ev.label || 'an attack', hit: ev.hit || null, crit: !!ev.crit, fumble: !!ev.fumble, total: ev.total,
            dice: ev.dice || '', critMult: ev.critMult || 2, reroll12: !!ev.reroll12, dmgType: ev.dmgType || (ev.hit && ev.hit.dmgType) || '',
            dmgShares: Array.isArray(ev.dmgParts) ? ev.dmgParts.map(x => x.dmg) : null });
        gmLog({ id: 'ev_' + ev.id, gmOnly: true, kind: 'roll',
            text: `${atkEntry ? atkEntry.name : name} attacked with ${ev.label || 'a weapon'}: ${ev.total} (d20 ${ev.nat}${ev.bonus ? (ev.bonus > 0 ? ' +' : ' −') + Math.abs(ev.bonus) : ''})${ev.crit ? ' · critical hit' : ev.fumble ? ' · natural 1' : ''}${ev.dmg != null ? ` · ${ev.dmg} damage before DR/ER` : ''}` });
        return;
    }
    // A power used from a player's sheet (and whether its targets must save)
    if (ev.kind === 'power') {
        if (firstSeen && ev.text) gmLog({ id: 'pw_' + ev.id, text: ev.text, kind: 'info' });
        // A save / damage power (no attack roll): the next damage entered is this power, with its type
        let pwEntry = ev.companion ? (window.gmInitiative || []).find(e => e.companionOf === uid) : entry;
        if (firstSeen && pwEntry && !ev.attackRoll && (ev.dmgType || ev.save)) _gmRecordAttack({ id: ev.id, attacker: pwEntry, label: ev.label || 'a power', hit: { weapon: ev.label || 'Power', props: [], dmgType: ev.dmgType || '' },
            crit: false, fumble: false, total: 0, dice: ev.dice || '', critMult: 2, reroll12: false, dmgType: ev.dmgType || '', power: true, save: ev.save || null, aoe: !!ev.aoe,
            dmgShares: Array.isArray(ev.dmgParts) ? ev.dmgParts.map(x => x.dmg) : null });
        if (firstSeen && pwEntry && ev.fx && !(ev.area && ev.save && !ev.attackRoll)) { try { window._gmPowerFxOffer(pwEntry, ev.label || 'a power', ev.fx); } catch (e) { console.warn('Power effects:', e); } }   // (an area's own saves bring its Conditions)
        // Placed on the battle map as an area: roll everyone's saves in it and deal the damage
        if (firstSeen && pwEntry && ev.area) { try { window._gmAreaResolve(pwEntry, ev); } catch (e) { console.warn('Power area:', e); } }
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
        done.ev = ev;
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
    window._gmResolvedSaves[ev.id] = { item: head, entryId: entry.id, ev };
    let r = _gmResolveText(entry, head, ev);
    gmLog({ id: 'res_' + ev.id, text: r.text, kind: r.kind });
    _gmOfferLimbs(entry, head, ev);
    if (head.type === 'bleed' && entry.currentHp !== null && entry.currentHp <= 0) _gmApplyBleed(entry, r.turns);
}
window._gmHandleRollEvent = _gmHandleRollEvent;

// ── A fight that survives the session ─────────────────────────────────────
// The whole fight is saved with the world as it changes: the initiative order (HP, Temp HP, AP,
// conditions, wounds, timers, power uses…), whose turn it is, the round, unpaid XP, the saves still
// waiting and the combat log. Loading the world brings it back exactly as it was; the token positions
// are on the maps already, and each player's own HP, AP and conditions are on their sheet.
let _gmCombatSaveT = 0;
function _gmCombatSaveSoon() {
    if (window._gmRestoringCombat) return;
    clearTimeout(_gmCombatSaveT);
    _gmCombatSaveT = setTimeout(() => { if (typeof window.saveWorldNotes === 'function') window.saveWorldNotes(); }, 1500);
}
window._gmCombatSaveSoon = _gmCombatSaveSoon;
function _gmPlain(v) {
    // (Sets become arrays; functions, like an area power's damage hook, aren't saved)
    return v == null ? v : JSON.parse(JSON.stringify(v, (k, x) => x instanceof Set ? [...x] : typeof x === 'function' ? undefined : x));
}
function _gmSaveQueue(q) {
    let out = {};
    Object.keys(q || {}).forEach(id => {
        let items = (q[id] || []).filter(it => it && !it.area);   // an area power's waiting saves end with the session
        if (items.length) out[id] = _gmPlain(items);
    });
    return out;
}
window._gmCombatSnapshot = function() {
    if (!(window.gmInitiative || []).length && !window.gmCombatStarted) return null;
    let body = JSON.stringify({
        initiative: _gmPlain(window.gmInitiative || []),
        curIdx: window.gmCurrentTurnIdx || 0, started: !!window.gmCombatStarted,
        round: window.gmRoundNumber || 1, turn: window.gmTurnNumber || 1,
        pendingXp: window.gmPendingXp || 0, mapId: window.gmCombatMapId || null,
        lairKey: window.gmLairSharedTraitKey || null, inLair: !!window.gmInLair,
        extraTurn: _gmPlain(window._gmExtraTurn || null),
        log: _gmPlain((window.gmCombatLog || []).slice(-80)), logSession: _gmLogSession || null,
        pendingSaves: _gmSaveQueue(window._gmPendingSaves), condSaves: _gmSaveQueue(window._gmCondSaves),
        npcWtAsks: _gmPlain(window._gmNpcWtAsks || {}), flurry: _gmPlain(window._gmFlurry || {}),
        lastNpcAtk: _gmPlain(window._gmLastNpcAtk || null)
    });
    // (stamped when the fight last changed, so an unchanged fight isn't written again)
    if (body !== window._gmLastCombatBody) { window._gmLastCombatBody = body; window._gmLastCombatAt = Date.now(); }
    return JSON.stringify({ v: 1, savedAt: window._gmLastCombatAt, fight: body });
};
window._gmRestoreCombat = function(json) {
    let s = null;
    try {
        let outer = typeof json === 'string' ? JSON.parse(json) : json;
        s = outer && outer.fight ? Object.assign(JSON.parse(outer.fight), { savedAt: outer.savedAt }) : outer;
    } catch (e) { console.warn('Saved combat:', e); }
    if (!s || !Array.isArray(s.initiative) || !s.initiative.length) return false;
    window._gmRestoringCombat = true;
    try {
        let sets = q => { Object.keys(q || {}).forEach(id => (q[id] || []).forEach(it => { it.known = new Set(Array.isArray(it.known) ? it.known : []); })); return q || {}; };
        window.gmInitiative = s.initiative;
        window.gmCurrentTurnIdx = Math.min(Math.max(0, s.curIdx || 0), Math.max(0, s.initiative.length - 1));
        window.gmCombatStarted = !!s.started;
        window.gmRoundNumber = s.round || 1; window.gmTurnNumber = s.turn || 1;
        window.gmPendingXp = s.pendingXp || 0; window.gmCombatMapId = s.mapId || null;
        window.gmLairSharedTraitKey = s.lairKey || null; window.gmInLair = !!s.inLair;
        window._gmExtraTurn = s.extraTurn || null;
        window._gmPendingSaves = sets(s.pendingSaves); window._gmCondSaves = sets(s.condSaves);
        window._gmNpcWtAsks = s.npcWtAsks || {}; window._gmFlurry = s.flurry || {};
        window._gmLastNpcAtk = s.lastNpcAtk || null;
        _gmLogSession = s.logSession || _gmLogSession;
        // Players' rolls from before the save were already handled: only newer ones count (no damage twice)
        window._gmRollCutoff = s.savedAt || Date.now();
        window.gmCombatLog = (s.log || []).slice();
        if (window.APXDice && APXDice.logEntry) window.gmCombatLog.forEach(e => APXDice.logEntry(e.gmText ? Object.assign({}, e, { text: e.gmText }) : e));
        window.renderInitiativeTracker();
        if (typeof window._btRefreshAllOpenMaps === 'function') window._btRefreshAllOpenMaps();
    } finally { window._gmRestoringCombat = false; }
    let cur = window.gmInitiative[window.gmCurrentTurnIdx];
    if (window.APXDice && APXDice.notify) APXDice.notify(window.gmCombatStarted
        ? `The fight you left off in is back: Round ${window.gmRoundNumber}, ${cur ? _gmGmName(cur) + "'s turn" : 'turn ' + window.gmTurnNumber}.`
        : `The initiative tracker you left off with is back (${window.gmInitiative.length} in it, combat not started).`, { kind: 'note', open: true });
    _gmPublishLogSoon();
    return true;
};

// XP for defeating an initiative entry: from its stat block's current Tier (so older
// combats pick up XP table changes); quick-add NPCs keep their stored value (0).
window._gmEntryXp = function(entry) {
    if (!entry || entry.faction === 'player') return 0;
    let n = entry.sourceNpcId && (window.gmNpcs || []).find(x => x.id === entry.sourceNpcId);
    if (n && window.npcXpForTier) {
        let xp = window.npcXpForTier(npcTierForTP(n.npc.gmTpBudget || 0).tier);
        if (n.npc.mythicAwakening) xp *= 2;   // Mythic Awakening: the party fights it twice
        entry.tpValue = xp;
        return xp;
    }
    return entry.tpValue || 0;
};

function _gmQueueBleed(entry) {
    if (!entry || entry.faction !== 'player' || entry.bleedOutTurns != null) return;
    _gmQueueSave(entry, { type: 'bleed' });
    let bItem = (window._gmPendingSaves[entry.id] || []).find(x => x.type === 'bleed');
    // ask: the player's roller shows a button to roll the check straight from this message
    if (entry.playerUid) { let id = gmLog({ text: `${entry.name} is Bleeding Out. Their next CON (Survive) check sets how many rounds they have.`, kind: 'bleed', ask: { uid: entry.playerUid, roll: 'survive' } }); if (bItem) bItem.logId = id; }
}

// Shared after-change handling: 0 HP → bleed out (players) / killed (NPCs); healed → clear bleed-out
// ── Non-lethal damage ──
// A creature brought to 0 HP by non-lethal damage is knocked out: Unconscious (no Bleeding Out, not
// killed), shown grey with snoring Z's on the battle map. Healing wakes it; lethal damage while it's
// down finishes the job as normal (Bleeding Out for players, defeated for NPCs).
function _gmKoCheck(entry, wasAboveZero) {
    let nl = entry._dmgNl, lethal = entry._dmgLethal;
    entry._dmgNl = undefined; entry._dmgLethal = undefined;
    let down = entry.currentHp !== null && entry.currentHp <= 0;
    if (down && nl && (wasAboveZero || entry.ko)) { if (!entry.ko) _gmSetKo(entry, true); return 'ko'; }
    if (entry.ko && !down) { _gmSetKo(entry, false); return 'woke'; }
    if (entry.ko && down && lethal) { _gmSetKo(entry, false, true); return 'lethal'; }
    return null;
}
function _gmSetKo(entry, on, quiet) {
    entry.ko = !!on;
    if (on) {
        if (entry.faction === 'player' && entry.bleedOutTurns != null) { _gmSetPlayerCondition(entry, 'bleedingout', false); entry.bleedOutTurns = null; }
        _gmAddCondition(entry, 'unconscious');
        gmLog({ text: `${_gmPublicName(entry)} is knocked out (non-lethal damage): Unconscious, not Bleeding Out.`, kind: 'info', force: true });
    } else {
        if (entry.faction === 'player') _gmSetPlayerCondition(entry, 'unconscious', false);
        else if (window._gmRemoveEntryCondition) window._gmRemoveEntryCondition(entry.id, 'unconscious');
        if (!quiet) gmLog({ text: `${_gmPublicName(entry)} comes to.`, kind: 'info' });
    }
    // Tokens carry it too, so it shows (and is saved) on every map
    (typeof _wNotes !== 'undefined' ? (_wNotes.otherMaps || []) : []).forEach(m => (m.battleTokens || []).forEach(t => {
        if (t.initiativeId === entry.id || (entry.faction === 'player' && entry.playerUid && t.type === 'player' && t.playerUid === entry.playerUid)) t.ko = !!on;
    }));
    if (typeof window.saveWorldNotes === 'function') window.saveWorldNotes();
    if (typeof window._btRefreshAllOpenMaps === 'function') window._btRefreshAllOpenMaps();
}
window._gmSetKo = _gmSetKo;
function _afterHpChange(entry, wasAboveZero) {
    if (entry.faction !== 'player' && !entry.companionOf && entry.currentHp !== null && entry.currentHp <= 0) _gmClearNpcWtAsks(entry);   // down: no Wound Threshold save
    let ko = _gmKoCheck(entry, wasAboveZero);
    if (ko === 'lethal') wasAboveZero = true;   // treated as just dropping
    if (ko === 'ko' && !entry.companionOf) {
        if (entry.faction === 'player') _syncHpToPlayer(entry);
        window.renderInitiativeTracker();
        return;
    }
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
        } else if (_gmUndeadDown(entry)) {
            return;
        } else if (!entry.awakened && _gmHasMythic(entry)) {
            _gmAwaken(entry, 'auto');
            return;
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
function _gmCheckWoundThreshold(entry, dmg, hitId) {
    if (!entry || entry.faction !== 'player' || !(dmg > 0)) return;
    let wt = _gmWoundThreshold(entry);
    if (wt == null || dmg <= wt) return;
    // CON save DC: 10, or half the damage taken (rounded down), whichever is higher
    let dc = Math.max(10, Math.floor(dmg / 2));
    let who = entry.name || 'This character';
    // (no popup: the player's dice tray asks for the save, and the combat log tracks it)
    let wItem = { type: 'wt', dc, dmg, hitId: hitId || null };
    _gmQueueSave(entry, wItem);
    wItem.logId = gmLog({ text: `${who} took ${dmg} damage, more than their Wound Threshold (${wt}). They must make a DC ${dc} CON save to resist being wounded.`, kind: 'wt',
        ask: entry.playerUid ? { uid: entry.playerUid, roll: 'save', dc } : null });
}
window._gmCheckWoundThreshold = _gmCheckWoundThreshold;

// ── NPC Wound Threshold and Wounds ─────────────────────────────────────────
// NPCs have a Wound Threshold too (double their CON score, plus worn items). A single hit past it
// calls for a CON save (DC 10 or half the damage, whichever is higher); on a failure the GM picks
// the limb, and the Wound is tracked on the creature's tracker card (each copy separately).
function _gmNpcSb(entry) {
    try { return entry && entry.sourceNpcId && typeof ncStatBlockFor === 'function' && (window.gmNpcs || []).some(n => n.id === entry.sourceNpcId) ? ncStatBlockFor(entry.sourceNpcId) : null; } catch (e) { return null; }
}
function _gmNpcWt(entry) {
    let sb = _gmNpcSb(entry);
    return sb && sb.woundThreshold ? sb.woundThreshold : null;
}
window._gmNpcWt = _gmNpcWt;
function _gmNpcWoundCheck(entry, dmg, hit) {
    if (!entry || !(dmg > 0) || entry.currentHp === null || entry.currentHp <= 0) return;
    let wt = _gmNpcWt(entry); if (wt == null || dmg <= wt) return;
    // NPCs don't carry lasting injuries: with every limb already Wounded there's nothing left to Wound
    if (_gmNpcLimbs(entry).every(l => (entry.wounds || []).includes(l))) return;
    let dc = Math.max(10, Math.floor(dmg / 2));
    let sb = _gmNpcSb(entry), traits = (sb && sb.traitList || []).map(t => t.key);
    let notes = [];
    if (traits.includes('multiheaded')) notes.push('Multi-Headed: one of its heads is severed (two grow back at the start of its next turn unless it took Energy damage)');
    if (traits.includes('swallowwhole')) notes.push('Swallow Whole: it regurgitates any creature it has swallowed');
    let id = 'nwt_' + entry.id + '_' + Date.now().toString(36);
    (window._gmNpcWtAsks[entry.id] = window._gmNpcWtAsks[entry.id] || []).push(id);
    gmLog({ id, gmOnly: true, force: true, kind: 'wt',
        text: `${_gmGmName(entry)} took ${dmg} damage, more than its Wound Threshold (${wt}): DC ${dc} CON save, or a limb is Wounded.${notes.length ? ' ' + notes.join('. ') + '.' : ''}`,
        ask: { gm: true, entryId: entry.id, roll: 'save', kind: 'npcwound', attr: 'CON', dc, logId: id, label: `Roll ${_gmGmName(entry)}'s CON save (DC ${dc})` } });
    if (notes.length) gmLog({ text: `${_gmPublicName(entry)} reels from the blow!`, kind: 'wt' });
}
window._gmNpcWoundCheck = _gmNpcWoundCheck;
// An NPC's Wound Threshold saves still waiting when it goes down: settled, so they don't clog the tray
window._gmNpcWtAsks = window._gmNpcWtAsks || {};   // entry id -> its WT save log ids
function _gmClearNpcWtAsks(entry) {
    let ids = entry && window._gmNpcWtAsks[entry.id]; if (!ids) return;
    delete window._gmNpcWtAsks[entry.id];
    ids.forEach(id => {
        let L = (window.gmCombatLog || []).find(x => x.id === id);
        if (L && L.ask) gmLog({ id, gmOnly: true, force: true, kind: 'wt', ask: null, text: `${_gmGmName(entry)} went down before its Wound Threshold save: no save needed.` });
    });
}
window._gmClearNpcWtAsks = _gmClearNpcWtAsks;
function _gmNpcLimbs(entry) {
    let base = (typeof WOUND_LIMBS_BASE !== 'undefined' ? WOUND_LIMBS_BASE : ['Head', 'Torso', 'Left Arm', 'Right Arm', 'Left Leg', 'Right Leg']).slice();
    (entry.wounds || []).forEach(l => { if (!base.includes(l)) base.push(l); });
    return base;
}
// The NPC's CON save for a Wound (from the GM's dice tray button). Rerolls (Luck, Omen) re-judge it.
function _gmNpcWoundSave(e, ask) {
    let sb = _gmNpcSb(e);
    let bonus = sb ? ((sb.saves || {}).CON ?? ((sb.mods || {}).CON || 0)) : 0;
    let st = { limbLog: null };
    APXDice.check({ kind: 'save', attr: 'CON', label: `CON Save (DC ${ask.dc}): Wound`, who: e.name, bonus, perks: false, initId: e.id,
        onResult: r => {
            let pass = !r.autoFail && r.total >= ask.dc;
            if (window._gmNpcWtAsks[e.id]) window._gmNpcWtAsks[e.id] = window._gmNpcWtAsks[e.id].filter(x => x !== ask.logId);
            if (pass) {
                if (st.limbLog) {
                    if (st.limb) _gmHealNpcWoundEntry(e, st.limb, true);
                    gmLog({ id: st.limbLog, gmOnly: true, force: true, kind: 'wt', ask: null, text: `${_gmGmName(e)} succeeded on the reroll (${r.total} vs DC ${ask.dc}): no limb is Wounded.` });
                }
                gmLog({ id: ask.logId, gmOnly: true, force: true, kind: 'wt', ask: null, text: `${_gmGmName(e)} succeeds on the CON save (${r.total} vs DC ${ask.dc}): no Wound.` });
                return `Success: no Wound`;
            }
            gmLog({ id: ask.logId, gmOnly: true, force: true, kind: 'wt', ask: null, text: `${_gmGmName(e)} fails the CON save (${r.total} vs DC ${ask.dc}): a limb is Wounded.` });
            if (!st.limbLog) {
                st.limbLog = 'nlimb_' + ask.logId;
                let already = e.wounds || [];
                gmLog({ id: st.limbLog, gmOnly: true, force: true, kind: 'wt',
                    text: `Choose the limb ${_gmGmName(e)} Wounds (based on the attack)${already.length ? `. Already Wounded: ${already.join(', ')}` : ''}:`,
                    ask: { gm: true, entryId: e.id, kind: 'npclimb', logId: st.limbLog, choices: _gmNpcLimbs(e).filter(l => l === 'Torso' || !already.includes(l)) } });   // (an NPC can't take the same Wound twice, except the Torso)
                window._gmNpcLimbState = window._gmNpcLimbState || {};
                window._gmNpcLimbState[st.limbLog] = st;
            }
            return `Failed: a limb is Wounded`;
        } });
}
function _gmApplyNpcWound(e, choice, logId) {
    let limb = String(choice).replace(/ \(again\)$/, '');
    let again = (e.wounds || []).includes(limb);
    // A Torso stacks (each Wound one more extra damage die); other limbs are Wounded once
    e.wounds = limb === 'Torso' ? (e.wounds || []).concat([limb]) : (e.wounds || []).filter(l => l !== limb).concat([limb]);
    let st = (window._gmNpcLimbState || {})[logId]; if (st) st.limb = limb;
    // Leg: Staggered; all of its legs: Prone
    if (/Leg/.test(limb)) {
        if (window._gmAddEntryCondition) window._gmAddEntryCondition(e.id, 'staggered');
        let legs = _gmNpcLimbs(e).filter(l => /Leg/.test(l));
        if (legs.length && legs.every(l => e.wounds.includes(l)) && window._gmAddEntryCondition) window._gmAddEntryCondition(e.id, 'prone');
    }
    let tN = limb === 'Torso' ? e.wounds.filter(l => l === 'Torso').length : 0;
    gmLog({ id: logId, gmOnly: true, force: true, kind: 'wt', ask: null, text: `${_gmGmName(e)}'s ${limb} is Wounded${tN > 1 ? ` again (${tN} Torso Wounds: ${tN} extra dice from each hit)` : again ? ' again (a lasting injury)' : ''}. ${_gmWoundEffect(limb)}` });
    gmLog({ text: `${_gmPublicName(e)}'s ${limb} is Wounded.`, kind: 'wt' });
    window.renderInitiativeTracker();
    if (typeof window.saveWorldNotes === 'function') window.saveWorldNotes();
}
function _gmHealNpcWoundEntry(e, limb, quiet) {
    { let i = (e.wounds || []).lastIndexOf(limb); e.wounds = (e.wounds || []).slice(); if (limb === 'Torso' && i >= 0) e.wounds.splice(i, 1); else e.wounds = e.wounds.filter(l => l !== limb); }
    if (/Leg/.test(limb) && !(e.wounds || []).some(l => /Leg/.test(l)) && window._gmRemoveEntryCondition) window._gmRemoveEntryCondition(e.id, 'staggered');
    if (!quiet) gmLog({ gmOnly: true, force: true, kind: 'info', text: `${_gmGmName(e)}'s ${limb} is no longer Wounded.` });
    window.renderInitiativeTracker();
}
window._gmHealNpcWound = function(entryId, limb) { let e = (window.gmInitiative || []).find(x => x.id === entryId); if (e) _gmHealNpcWoundEntry(e, limb); };
function _gmWoundEffect(limb) {
    let k = /Leg/.test(limb) ? 'Leg' : /Arm/.test(limb) ? 'Arm' : limb;
    let d = (typeof WOUND_LIMB_EFFECTS !== 'undefined' && WOUND_LIMB_EFFECTS[k]) ? WOUND_LIMB_EFFECTS[k].desc : '';
    return d.replace(/ \(Added automatically[^)]*\)/, '');
}
// Its Wounds change its rolls like a player's: Head (Disadvantage on attacks and PER/INT checks), Arm (attacks)
function _gmWoundRollMods(e, kind, attr) {
    let w = e && e.wounds || [], dis = [];
    if (!w.length) return dis;
    if (w.includes('Head') && (kind === 'attack' || (kind === 'check' && (attr === 'PER' || attr === 'INT')))) dis.push('Head Wound');
    if (kind === 'attack' && w.some(l => /Arm/.test(l))) dis.push('Arm Wound');
    return dis;
}

// ── Fall damage ────────────────────────────────────────────────────────────
// 1d10 for every square fallen after the first (Bludgeoning or Force). An AGI (Acrobatics) check
// as a Reaction takes off 1d10 for every 5 rolled (a natural 20 takes off at least 4d10); no
// Reaction, full damage. Soft Landing shortens the fall by 5 squares per rank, and Defensive
// Rank 4 (unarmored) adds the CON score to DR/ER. Any damage from the fall knocks it Prone.
window._gmFallPending = {};
function _gmPerkCount(st, id) {
    return ((st && st.perks || {})[id] || 0) + ((st && st.ancestryBonusPerks) || []).filter(b => b.perkId === id).length;
}
window.gmFallDamage = async function(entryId) {
    let e = (window.gmInitiative || []).find(x => x.id === entryId); if (!e || !window.apxForm) return;
    let pm = e.faction === 'player' ? (window.gmParty || []).find(p => p.fileName === e.playerUid) : null;
    let st = pm && pm.state;
    let soft = st ? _gmPerkCount(st, 'gen_softlanding') : 0;
    let isPc = e.faction === 'player' && !!e.playerUid;
    let f = await window.apxForm(`Fall damage: ${_gmGmName(e)}`, [
        { key: 'sq', label: 'Squares fallen', type: 'number', value: 3, min: 1, hint: `1d10 for every square after the first.${soft ? ` Soft Landing ${soft}: the fall counts as ${soft * 5} squares shorter.` : ''}` },
        { key: 'type', label: 'Damage type', type: 'select', value: 'Bludgeoning', options: [['Bludgeoning', 'Bludgeoning (Physical: DR)'], ['Force', 'Force (Energy: ER)']] },
        { key: 'react', label: 'Reaction: AGI (Acrobatics)', type: 'select', value: 'roll', options: [['roll', isPc ? 'Ask the player to roll it' : 'Roll it now'], ['typed', 'I\'ll type the result below'], ['none', 'No Reaction: full damage']] },
        { key: 'total', label: 'Acrobatics result (if typed)', type: 'number', value: '' },
        { key: 'nat20', label: 'It was a natural 20', type: 'checkbox', value: false }
    ], { okLabel: 'Fall', text: 'Every 5 on the Acrobatics check takes off 1d10. Any damage taken knocks it Prone.' });
    if (!f) return;
    let sq = Math.max(1, Math.floor(f.sq || 1));
    let eff = Math.max(0, sq - soft * 5), n = Math.max(0, eff - 1);
    let who = _gmPublicName(e);
    if (n <= 0) {
        gmLog({ text: `${who} falls ${sq} square${sq === 1 ? '' : 's'} and lands without harm${soft && sq > 1 ? ' (Soft Landing)' : ''}.`, kind: 'info', force: true });
        return;
    }
    let pool = Array.from({ length: n }, () => window.APXDice ? APXDice.rnd(10) : 1 + Math.floor(Math.random() * 10));
    // Defensive Rank 4, unarmored: + CON score to DR and ER against falling
    let defAdd = null;
    if (st) {
        let d = st.derived || {}, defR = d.defensive != null ? d.defensive : ((st.perks || {}).con_defensive || 0);
        let unarmored = typeof d.unarmored === 'boolean' ? d.unarmored : !((st.equippedArmor || {}).wt > 0);
        let sum = null; try { sum = computeCharSummary(st); } catch (er) { }
        let con = sum && sum.mods ? (sum.mods.CON || 0) + 5 : 5;
        if (defR >= 4 && unarmored) defAdd = { dr: con, er: con, why: `Defensive R4 +${con}` };
    }
    let item = { id: 'fall_' + Date.now().toString(36), entryId: e.id, sq, eff, soft, n, pool, type: f.type || 'Bludgeoning', defAdd, applied: null };
    gmLog({ id: item.id, text: `${who} falls ${sq} square${sq === 1 ? '' : 's'}${soft ? ` (Soft Landing: as ${eff})` : ''}: ${n}d10 ${item.type} damage${f.react === 'none' ? ', with no Reaction' : ''}.`, kind: 'dmg', force: true });
    if (f.react === 'none') { _gmFallResolve(item, null); return; }
    if (f.react === 'typed') { _gmFallResolve(item, { total: Number(f.total) || 0, nat: f.nat20 ? 20 : 0 }); return; }
    if (isPc) {
        item.known = new Set((window._gmPlayerRollLogs[e.playerUid] || []).map(x => x.id));
        window._gmFallPending[e.id] = item;
        gmLog({ id: item.id + '_ask', text: `${e.name} can use their Reaction to roll AGI (Acrobatics) and soften the fall: every 5 takes off 1d10.`, kind: 'wt', force: true,
            ask: { uid: e.playerUid, roll: 'check', skill: 'Acrobatics', attr: 'AGI', label: 'Roll AGI (Acrobatics): soften the fall' } });
        if (window.APXDice && APXDice.notify) APXDice.notify(`Waiting for ${e.name}'s Acrobatics roll. (No roll? Use Fall again with "No Reaction".)`, { kind: 'note' });
        return;
    }
    // NPCs and companions roll it here: trained Acrobatics, or its AGI modifier
    let sb = e.companionOf ? null : _gmNpcSb(e);
    let tr = sb && (sb.trainedSkills || []).find(x => /^Acrobatics$/i.test(x.name));
    let bonus = tr ? tr.total : (sb && sb.mods ? (sb.mods.AGI || 0) : 0);
    if (!window.APXDice) { _gmFallResolve(item, null); return; }
    APXDice.check({ kind: 'check', attr: 'AGI', skill: 'Acrobatics', label: 'AGI (Acrobatics) Reaction: fall', who: e.name, bonus, perks: false, initId: e.id,
        note: sb ? null : 'No stat block: add its bonus yourself',
        onResult: r => _gmFallResolve(item, { total: r.total, nat: r.nat, autoFail: r.autoFail }) });
};
// (re-run when a Luck reroll or Omen changes the Acrobatics roll: the HP difference is made up)
function _gmFallResolve(item, roll) {
    let e = (window.gmInitiative || []).find(x => x.id === item.entryId); if (!e) return '';
    let off = 0;
    if (roll && !roll.autoFail) { off = Math.floor(Math.max(0, roll.total || 0) / 5); if (roll.nat === 20) off = Math.max(off, 4); }
    let k = Math.max(0, item.n - off);
    let raw = item.pool.slice(0, k).reduce((t, v) => t + v, 0);
    let rollTxt = roll ? `Acrobatics ${roll.total}${roll.nat === 20 ? ' (natural 20)' : ''}: −${Math.min(item.n, off)}d10` : 'no Reaction';
    if (item.applied == null) {
        let wasProne = _gmEffConds(e).includes('prone');
        let res = k > 0 ? _gmDamage(e, { raw, types: [item.type], hit: null, src: `fall, ${k}d10 ${item.type}`, defAdd: item.defAdd }) : { dmg: 0 };
        item.applied = res.dmg; item.k = k;
        if (res.dmg > 0 && !wasProne && (window.gmInitiative || []).includes(e)) { _gmAddCondition(e, 'prone'); item.proned = true; }
        gmLog({ id: item.id + '_res', text: `${_gmPublicName(e)}'s fall: ${rollTxt} → ${k}d10${k ? ` = ${raw}` : ''}. ${res.dmg > 0 ? `${e.faction === 'player' ? res.dmg + ' damage after DR/ER, and' : 'It takes damage and'} falls Prone.` : 'No damage.'}`, kind: 'dmg', force: true });
        return `${k}d10 = ${raw}${res.dmg > 0 ? ' · Prone' : ''}`;
    }
    // A reroll changed it: take back or add the difference
    let def = _gmDefenseOf(e); if (item.defAdd) { def.dr += item.defAdd.dr; def.er += item.defAdd.er; }
    let now = k > 0 && window.APXDamage ? APXDamage.mitigate(raw, [item.type], def, { halfBypass: def.halfBypass }).dmg : raw;
    let diff = now - item.applied;
    if (diff) {
        let wasUp = e.currentHp === null || e.currentHp > 0;
        let r = window.apxApplyHpInput((diff > 0 ? '-' : '+') + Math.abs(diff), e.currentHp, e.tempHp, e.maxHp);
        if (r) { e.currentHp = r.currentHp; e.tempHp = r.tempHp; }
        item.applied = now;
        if (now === 0 && item.proned) { if (e.faction === 'player') _gmSetPlayerCondition(e, 'prone', false); else if (window._gmRemoveEntryCondition) window._gmRemoveEntryCondition(e.id, 'prone'); item.proned = false; }
        if (now > 0 && !item.proned && !_gmEffConds(e).includes('prone')) { _gmAddCondition(e, 'prone'); item.proned = true; }
        _afterHpChange(e, wasUp);
    }
    gmLog({ id: item.id + '_res', text: `${_gmPublicName(e)}'s fall (rerolled): ${rollTxt} → ${k}d10${k ? ` = ${raw}` : ''}. ${now > 0 ? 'Takes damage and falls Prone.' : 'No damage.'}`, kind: 'dmg', force: true });
    return `${k}d10 = ${raw}`;
}
// A player's Acrobatics roll answering a fall (from their roll log)
function _gmFallFromRoll(entry, ev) {
    let item = entry && window._gmFallPending[entry.id];
    if (!item || ev.skill !== 'Acrobatics') return false;
    if (!item.evId) { if (item.known && item.known.has(ev.id)) return false; item.evId = ev.id; }
    else if (item.evId !== ev.id) return false;
    _gmFallResolve(item, { total: ev.total, nat: ev.nat, autoFail: ev.autoFail });
    gmLog({ id: item.id + '_ask', ask: null, kind: 'wt', force: true, text: `${entry.name} rolled AGI (Acrobatics) ${ev.total} to soften the fall.` });
    return true;
}

// ── Damage Aura (NPC trait) ────────────────────────────────────────────────
// A creature that ends its turn within 1 square of it takes Xd6 of its Energy type (X = its Tier,
// min 1). Automatic only while combat is running, on a battle map in use (it needs both tokens).
function _gmAuraTick(ending) {
    if (!ending || !window.gmCombatStarted || typeof window._btFootprintOf !== 'function') return;
    if (ending.currentHp !== null && ending.currentHp <= 0 && ending.faction !== 'player') return;
    let fpE = window._btFootprintOf(ending.id); if (!fpE) return;
    (window.gmInitiative || []).slice().forEach(src => {
        if (src.id === ending.id || src.faction === 'player' || src.companionOf || !src.sourceNpcId) return;
        if (src.currentHp !== null && src.currentHp <= 0) return;
        if (!(window.gmInitiative || []).includes(ending)) return;
        let sb = _gmNpcSb(src); if (!sb || !sb.aura) return;
        let fpS = window._btFootprintOf(src.id); if (!fpS || fpS.mapId !== fpE.mapId) return;
        let dx = Math.max(0, fpS.x0 - fpE.x1, fpE.x0 - fpS.x1), dy = Math.max(0, fpS.y0 - fpE.y1, fpE.y0 - fpS.y1);
        if (Math.max(dx, dy) > (sb.aura.radius || 1)) return;
        let type = sb.aura.type || 'Fire';
        let card = window.APXDice ? APXDice.damage({ label: `Damage Aura (${type}) → ${ending.name}`, who: src.name, formula: sb.aura.dice, dmgType: type, perks: false }) : null;
        let raw = card && card.parts && card.parts[0] ? card.parts[0].total : _gmRollDie(sb.aura.dice);
        gmLog({ text: `${_gmPublicName(ending)} ends its turn in ${_gmPublicName(src)}'s ${type} aura.`, gmText: `${_gmGmName(ending)} ends its turn in ${_gmGmName(src)}'s Damage Aura: ${sb.aura.dice} ${type} = ${raw}.`, kind: 'dmg' });
        _gmDamage(ending, { raw, types: [type], hit: null, src: `${_gmPublicName(src)}'s ${type} aura` });
    });
}
window._gmAuraTick = _gmAuraTick;
// ════════════════════════════════════════════════════════════════════════════
// COMBAT CORE: damage
// ════════════════════════════════════════════════════════════════════════════
// Every way damage reaches a creature in the tracker goes through _gmDamage():
//   • the GM types "-N" (or "-N fire") in a tracker HP or Temp HP box
//   • a player types "-N" in their own sheet's HP box (their sheet sends the damage event)
// Damage is the FULL amount. The pipeline:
//   1. which attack hit it: the last attack rolled (players' sheets and the GM's stat blocks)
//      that hasn't hit this creature yet; with no roll, whoever's turn it is
//   2. its damage type: typed ("-8 fire") > the attack's type > physical if the attack has none;
//      with no attack at all, the GM picks it with one click
//   3. extra dice from the hit: Incapacitated (auto-crit), Crushing (Prone), Concealed
//      (Surprised), Torso Wound: added to the damage BEFORE DR/ER
//   4. the target's defences reduce it: DR (physical) or ER (energy), resistances, vulnerabilities,
//      immunities, weapons that ignore DR/ER, Incapacitated bypassing resistances, Ironclad R4.
//      Players' DR/ER are the numbers their own sheet shows (saved with the character).
//   5. HP (Temp HP first), synced to the player's sheet
//   6. the log: the GM sees the math, players see "X hit Y" (no numbers for hits on enemies)
//   7. then, in order: a Reaction for a Critical Hit (Defensive R5 / Helmet), the Wound Threshold
//      save, the weapon's own saves (Crushing, Stunning), Grappling and Flurry, and Bleed Out.
// None of this needs a battle map, and it works before "Start Combat" too.

// What protects this creature, by damage type: { dr, er, res: { Type: +resist / −vuln }, immune: [types] }
function _gmDefenseOf(entry) {
    let def = { dr: 0, er: 0, res: {}, immune: [], src: '' };
    let N = t => (window.APXDamage ? window.APXDamage.norm(t) : null) || t;
    if (entry.companionOf) {
        let pm = (window.gmParty || []).find(p => p.fileName === entry.companionOf);
        let csb = pm && typeof gmCompanionSb === 'function' ? gmCompanionSb(pm) : null;
        if (csb) {
            if (window.APXDamage && window.APXDamage.fromStatBlock) Object.assign(def, window.APXDamage.fromStatBlock(csb));
            else { def.dr = csb.dr || 0; def.er = csb.er || 0; }
            def.src = 'companion stat block'; return def;
        }
        def.dr = parseInt(entry.dr) || 0; def.er = parseInt(entry.er) || 0; def.src = 'tracker';
        return def;
    }
    if (entry.faction === 'player' && entry.playerUid) {
        let pm = (window.gmParty || []).find(p => p.fileName === entry.playerUid);
        let d = pm?.state?.derived;
        if (d && typeof d.dr === 'number') {
            // exactly what the player's sheet shows
            def.dr = d.dr; def.er = d.er || 0; def.res = Object.assign({}, d.res || {}); def.immune = (d.immune || []).slice(); def.halfBypass = !!d.halfBypass;
            def.src = 'their sheet';
            return def;
        }
        let sum = null;
        try { sum = pm?.state ? computeCharSummary(pm.state) : null; } catch (e) { }
        sum = sum || pm?.summary;
        if (sum) {
            def.dr = sum.dr || 0; def.er = sum.er || 0; def.src = 'party panel';
            Object.entries(sum.envTypes || {}).forEach(([t, v]) => { if (v.immune) def.immune.push(N(t)); else if (v.net) def.res[N(t)] = v.net; });
            def.halfBypass = ((pm?.state?.perks || {}).con_ironclad || 0) >= 4;
        } else { def.dr = parseInt(entry.dr) || 0; def.er = parseInt(entry.er) || 0; def.src = 'tracker'; }
        return def;
    }
    let sb = null;
    try { sb = entry.sourceNpcId && typeof ncStatBlockFor === 'function' && (window.gmNpcs || []).some(n => n.id === entry.sourceNpcId) ? ncStatBlockFor(entry.sourceNpcId) : null; } catch (e) { sb = null; }
    if (sb) {
        def.dr = sb.dr || 0; def.er = sb.er || 0; def.src = 'stat block';
        (sb.damageResistances || []).forEach(t => { let k = N(t); def.res[k] = (def.res[k] || 0) + 5; });
        (sb.energyVulnerabilities || []).forEach(t => { let k = N(t); def.res[k] = (def.res[k] || 0) - 5; });
        (sb.energyImmunities || []).forEach(t => def.immune.push(N(t)));
        (sb.itemEr || []).forEach(r => { let k = N(r.type); if (k) def.res[k] = (def.res[k] || 0) + (parseInt(r.amount) || 0); });   // worn items
    } else { def.dr = parseInt(entry.dr) || 0; def.er = parseInt(entry.er) || 0; def.src = 'tracker'; }
    return def;
}
window._gmDefenseOf = _gmDefenseOf;
function _gmDefText(def) {
    let bits = [`DR ${def.dr}`, `ER ${def.er}`];
    Object.entries(def.res || {}).forEach(([t, v]) => bits.push(v > 0 ? `${t} +${v}` : `${t} vulnerable ${-v}`));
    (def.immune || []).forEach(t => bits.push(`${t} immune`));
    return bits.join(', ');
}
window._gmDefText = _gmDefText;

// "-8", "-8 fire", "- 8 slashing + fire" → { raw: 8, types: [...] } (null when it isn't damage)
// (also "70-8" typed after the 70 already in the box, and phone keyboards' − – — dashes)
function _gmParseDamage(value, cur) {
    if (window.APXDamage && window.APXDamage.parseHpEntry) return window.APXDamage.parseHpEntry(value, cur);
    let m = String(value ?? '').trim().match(/^-\s*(\d+)\s*([a-z][a-z +&/,]*)?$/i);
    if (!m) return null;
    return { raw: parseInt(m[1], 10), types: [], typed: false };
}
// The damage type for this hit: typed > the attack's own type > physical for an attack with none
function _gmDamageTypes(parsed, hit) {
    if (parsed.typed) return parsed.types;
    if (!window.APXDamage) return ['True'];
    if (hit && hit.dmgType) { let t = window.APXDamage.parts(hit.dmgType); if (t.length) return t; }
    return null;   // nothing says what kind of damage it was (no attack, or one with no damage type): ask
}

// The core. opts:
//   raw, types   the full damage and its type(s)
//   hit          the attack that hit (already taken); null = none
//   sheet        { dmg, raw } the player's sheet already reduced its own HP by dmg (their HP is synced)
function _gmDamage(entry, opts) {
    let wasAboveZero = entry.currentHp === null || entry.currentHp > 0;
    let nonlethal = !!(opts.nonlethal || (opts.types && opts.types.nonlethal) || (opts.hit && opts.hit.nonlethal));
    let hit = opts.hit || null;
    let extras = hit ? _gmHitExtraDamage(entry, hit) : [];
    let extraSum = extras.reduce((t, x) => t + x.n, 0);
    let def = _gmDefenseOf(entry);
    if (opts.defAdd) { def.dr += opts.defAdd.dr || 0; def.er += opts.defAdd.er || 0; if (opts.defAdd.why) def.src = (def.src || 'tracker') + ', ' + opts.defAdd.why; }
    let incap = _gmEffConds(entry).includes('incapacitated');
    let mopt = { ignore: hit && hit.hit && window.APXDamage ? window.APXDamage.ignoreOf(hit.hit) : null, bypassRes: incap, halfBypass: def.halfBypass,
        shares: hit && Array.isArray(hit.dmgShares) && opts.types && hit.dmgShares.length === opts.types.length ? hit.dmgShares : null };   // a split roll: each type its own amount
    // Temp HP takes its share unreduced; only what gets past it is reduced by DR, ER, resistances and immunities
    // (a player's sheet already did this for its own HP, and says how much Temp HP it had)
    let tempNow = opts.sheet ? Math.max(0, opts.sheet.tempBefore || 0) : Math.max(0, entry.tempHp || 0);
    let M = (raw) => window.APXDamage ? (window.APXDamage.throughTemp && tempNow ? window.APXDamage.throughTemp(raw, tempNow, opts.types, def, mopt) : window.APXDamage.mitigate(raw, opts.types, def, mopt)) : { dmg: raw, raw, reduced: 0, text: `${raw} damage` };
    let res = M(opts.raw + extraSum);
    // Swarm: half damage from attacks that target a single creature, double from area effects
    let swarmSb = _gmTraitSb(entry);
    if (swarmSb && swarmSb.swarm) {
        let mode = opts.swarmMode || (hit ? (hit.aoe ? 'area' : 'single') : null);
        if (mode === 'single' || mode === 'area') {
            let was = res.dmg;
            res = Object.assign({}, res, { dmg: mode === 'single' ? Math.floor(was / 2) : was * 2 });
            res.text = `${res.text}, ${mode === 'single' ? 'halved' : 'doubled'} (Swarm, ${mode === 'single' ? 'single target' : 'area'}) = ${res.dmg}`;
        }
    }
    let before = (entry.currentHp || 0) + (entry.tempHp || 0);
    let dmg = res.dmg;
    // The Wound Threshold looks only at what gets past Temp HP into Hit Points
    let woundDmg = 0;
    if (opts.sheet) {
        // The sheet already took off what it worked out; add what the extra dice make it here
        let base = typeof opts.sheet.dmg === 'number' ? opts.sheet.dmg : M(opts.raw).dmg;
        let more = Math.max(0, res.dmg - M(opts.raw).dmg);
        before += base;   // (the tracker already shows the sheet's new HP)
        woundDmg = typeof opts.sheet.hpDmg === 'number' ? opts.sheet.hpDmg : base;
        if (more > 0) {
            woundDmg += more - Math.min(Math.max(0, entry.tempHp || 0), more);
            let r2 = window.apxApplyHpInput('-' + more, entry.currentHp, entry.tempHp, entry.maxHp);
            if (r2) { entry.currentHp = r2.currentHp; entry.tempHp = r2.tempHp; }
        }
        dmg = base + more;
    } else {
        woundDmg = dmg - Math.min(Math.max(0, entry.tempHp || 0), dmg);
        let r = window.apxApplyHpInput('-' + dmg, entry.currentHp, entry.tempHp, entry.maxHp);
        if (r) { entry.currentHp = r.currentHp; entry.tempHp = r.tempHp; }
    }
    let after = (entry.currentHp || 0) + (entry.tempHp || 0);
    let who = hit && hit.attacker ? `${_gmGmName(hit.attacker)}'s ${hit.label || 'attack'}` : (opts.src || 'damage');
    let math = `${opts.raw}${extraSum ? ' + ' + extraSum + ' (' + extras.map(x => x.why).join(', ') + ')' : ''} → ${res.text}${incap ? ' · Incapacitated: resistances bypassed' : ''}`;
    entry.lastHit = { text: `${who}: ${math}${nonlethal ? ' (non-lethal)' : ''}`, dmg, t: Date.now() };
    entry._dmgNl = nonlethal; entry._dmgLethal = !nonlethal && dmg > 0;
    gmLog({ gmOnly: true, kind: 'info', force: true, text: `${_gmGmName(entry)} ← ${who}: ${math}. (${_gmDefText(def)}, from ${def.src || 'tracker'})` });
    _gmLogHpChange(entry, before, after, wasAboveZero, dmg, hit, hit ? null : opts.src);
    let defId = hit ? _gmOfferDefensive(entry, hit, dmg, extras) : null;   // a Reaction to a Critical Hit, before the saves
    _gmCheckWoundThreshold(entry, woundDmg, defId);                       // Wound Threshold (damage past Temp HP), then the hit's own saves, then Bleed Out
    if (entry.faction !== 'player' && !entry.companionOf) _gmNpcWoundCheck(entry, woundDmg, hit);   // NPCs have a Wound Threshold too
    if (hit) _gmHitEffects(entry, hit, extras);
    // Undead / Unalive Structure traits
    let tsb = _gmTraitSb(entry);
    if (tsb && tsb.undead) {
        let phys = ['Bludgeoning', 'Slashing', 'Piercing'], en = window.APXDamage ? window.APXDamage.ENERGY() : [];
        let ok = (opts.types || []).length && opts.types.every(t => phys.includes(t) || (en.includes(t) && t !== 'Fire'));
        entry._undeadOk = ok && !(hit && hit.crit); entry._undeadDc = dmg;
        // Already down: a Critical Hit, Fire, or damage that isn't Physical or Energy finishes it
        if (entry.undeadDown && !wasAboveZero && (opts.raw || 0) > 0 && !entry._undeadOk) {
            entry._undeadOk = undefined; entry._undeadDc = undefined;
            _gmUndeadDestroy(entry, hit && hit.crit ? 'a Critical Hit while it was down' : 'Fire, or damage that isn\'t Physical or Energy, while it was down');
            return { dmg, res };
        }
    }
    if (tsb && tsb.unalive && dmg > 0 && (opts.types || []).includes('Electric') && entry.currentHp > 0) _gmUnaliveShock(entry, tsb, dmg);
    if (opts.sheet) {
        _syncHpToPlayer(entry);
        let ko = _gmKoCheck(entry, wasAboveZero);
        if (ko !== 'ko' && (wasAboveZero || ko === 'lethal') && entry.currentHp !== null && entry.currentHp <= 0 && entry.faction === 'player' && entry.bleedOutTurns == null) _gmQueueBleed(entry);
        window.renderInitiativeTracker();
    } else _afterHpChange(entry, wasAboveZero);
    return { dmg, res };
}
window._gmDamage = _gmDamage;

// ── Undead / Unalive Structure (NPC traits) ──
function _gmTraitSb(entry) {
    if (!entry || entry.faction === 'player' || entry.companionOf || !entry.sourceNpcId) return null;
    try { return (window.gmNpcs || []).some(n => n.id === entry.sourceNpcId) ? ncStatBlockFor(entry.sourceNpcId) : null; } catch (e) { return null; }
}
window._gmTraitSb = _gmTraitSb;
// Undead at 0 HP from non-critical Physical (or non-Fire Energy) damage: Prone and Incapacitated instead of destroyed
function _gmUndeadDown(entry) {
    let sb = _gmTraitSb(entry);
    if (!sb || !sb.undead) return false;
    let ok = entry._undeadOk !== false, dc = entry._undeadDc || 0;
    entry._undeadOk = undefined; entry._undeadDc = undefined;
    if (!ok) { gmLog({ text: `${_gmGmName(entry)} (Undead) is destroyed: the final blow was a Critical Hit, Fire, or not Physical/Energy damage.`, kind: 'info' }); return false; }
    entry.currentHp = 0; entry.undeadDown = { dc: Math.max(1, dc) };
    ['prone', 'incapacitated'].forEach(c => { if (typeof window._gmAddEntryCondition === 'function') window._gmAddEntryCondition(entry.id, c); else { entry.conditions = entry.conditions || []; if (!entry.conditions.includes(c)) entry.conditions.push(c); } });
    gmLog({ text: `${_gmGmName(entry)} (Undead) falls Prone and Incapacitated instead of being destroyed. At the start of its next turn it makes a CON save (DC ${entry.undeadDown.dc}).`, kind: 'info', force: true });
    window.renderInitiativeTracker();
    if (typeof window._btRefreshAllOpenMaps === 'function') window._btRefreshAllOpenMaps();
    return true;
}
// Its revival save at the start of its turn rolls itself (CON, DC = the damage of the final blow)
function _gmUndeadRevive(entry) {
    let dc = entry.undeadDown.dc, sb = _gmTraitSb(entry);
    let bonus = sb && sb.saves ? (parseInt(sb.saves.CON) || 0) : 0;
    let nat = 1 + Math.floor(Math.random() * 20), total = nat + bonus;
    let roll = `${total} (d20 ${nat}${bonus ? (bonus > 0 ? ' +' : ' −') + Math.abs(bonus) : ''}) vs DC ${dc}`;
    if (!window.gmInitiative.includes(entry)) return;
    if (total >= dc) {
        entry.undeadDown = null;
        entry.currentHp = 1;
        ['prone', 'incapacitated'].forEach(c => { if (typeof window._gmRemoveEntryCondition === 'function') window._gmRemoveEntryCondition(entry.id, c); else entry.conditions = (entry.conditions || []).filter(x => x !== c); });
        gmLog({ text: `${_gmPublicName(entry)} rises again!`, gmText: `${_gmGmName(entry)} (Undead) rolls its revival CON save: ${roll}. It rises again with 1 HP.`, kind: 'info', force: true });
        window.renderInitiativeTracker();
        if (typeof window._btRefreshAllOpenMaps === 'function') window._btRefreshAllOpenMaps();
    } else _gmUndeadDestroy(entry, `it failed its revival CON save (${roll})`);
}
// Destroyed for good: out of the fight, its XP to the party
function _gmUndeadDestroy(entry, why) {
    if (!window.gmInitiative.includes(entry)) return;
    entry.undeadDown = null; entry._undeadOk = false;
    gmLog({ text: `${_gmPublicName(entry)} is destroyed.`, gmText: `${_gmGmName(entry)} (Undead) is permanently destroyed: ${why}.`, kind: 'info', force: true });
    window.gmPendingXp += window._gmEntryXp(entry);
    window.removeFromInitiative(entry.id, { dead: true });
    window.renderInitiativeTracker();
    if (typeof window._btRefreshAllOpenMaps === 'function') window._btRefreshAllOpenMaps();
}
// Unalive Structure hit by Electric damage: CON save (DC 10 + half the damage) or Stunned until the end of its next turn
async function _gmUnaliveShock(entry, sb, dmg) {
    let dc = 10 + Math.floor(dmg / 2), bonus = sb.saves ? (parseInt(sb.saves.CON) || 0) : 0;
    let nat = 1 + Math.floor(Math.random() * 20), total = nat + bonus;
    let ans = window.APXDice && APXDice.ask ? await APXDice.ask(`${_gmGmName(entry)}: Electric surge`, `Unalive Structure: CON save, DC ${dc}. Rolled ${total} (d20 ${nat}${bonus ? (bonus > 0 ? ' +' : ' −') + Math.abs(bonus) : ''}).`,
        [['pass', 'Saved', total >= dc ? 'pri' : ''], ['fail', 'Failed: Stunned', total < dc ? 'pri' : '']]) : (total >= dc ? 'pass' : 'fail');
    if (ans !== 'fail' || !window.gmInitiative.includes(entry)) return;
    if (typeof window._gmAddEntryCondition === 'function') window._gmAddEntryCondition(entry.id, 'stunned');
    gmLog({ text: `${_gmGmName(entry)} is Stunned by the Electric surge until the end of its next turn.`, kind: 'info', force: true });
}

// Tracker HP box: "-N" is damage (in full), "+N" heals, "N" sets.
window.updateInitiativeHp = function(id, value, pre) {
    let entry = window.gmInitiative.find(e => e.id === id);
    if (!entry) return;
    let parsed = _gmParseDamage(value, entry.currentHp);
    if (parsed) {
        let peek = _gmPeekHit(entry);
        let types = pre && pre.types ? pre.types : _gmDamageTypes(parsed, peek || _gmTurnHit(entry));
        if (!types) {
            // Nothing says what kind of damage it was: one click picks it
            window.renderInitiativeTracker();
            let def = _gmDefenseOf(entry);
            window.APXDamage.askType(`${parsed.raw} damage to ${_gmGmName(entry)}`, `Nothing says what kind of damage this is. ${entry.name}: ${_gmDefText(def)}. Tip: type "-${parsed.raw} fire" (or slashing, true…, and "nl" for non-lethal) to skip this.`, def, { nonlethal: parsed.nonlethal })
                .then(t => { if (t) window.updateInitiativeHp(id, '-' + parsed.raw, { types: t, nonlethal: !!t.nonlethal }); else window.renderInitiativeTracker(); });
            return;
        }
        // A Swarm with no attack behind the damage: was it one target, or an area?
        let swsb = !(pre && pre.swarmMode) && !_gmPeekHit(entry) && !_gmTurnHit(entry) ? _gmTraitSb(entry) : null;
        if (swsb && swsb.swarm && window.APXDice && APXDice.ask) {
            window.renderInitiativeTracker();
            APXDice.ask(`${parsed.raw} damage to ${_gmGmName(entry)} (Swarm)`, 'A swarm takes half damage from attacks that target a single creature and double damage from area effects.',
                [['single', 'Single target: half', 'pri'], ['area', 'Area effect: double'], ['none', 'Neither (full)']]).then(m => {
                    if (m) window.updateInitiativeHp(id, value, Object.assign({}, pre || {}, { types, swarmMode: m, nonlethal: !!((pre && pre.nonlethal) || parsed.nonlethal || types.nonlethal) }));
                });
            return;
        }
        let hit = _gmTakeHit(entry) || _gmTurnHit(entry);
        _gmDamage(entry, { raw: parsed.raw, types, hit, nonlethal: !!((pre && pre.nonlethal) || parsed.nonlethal || types.nonlethal), swarmMode: pre && pre.swarmMode });
        return;
    }
    let wasAboveZero = entry.currentHp === null || entry.currentHp > 0;
    let r = window.apxApplyHpInput(value, entry.currentHp, entry.tempHp, entry.maxHp);
    if (!r) { window.renderInitiativeTracker(); return; }
    // Unalive Structure: only mechanical repairs (3 AP, Xd6 HP) heal it
    if (!(pre && pre.repair) && r.currentHp > (entry.currentHp || 0) && _gmTraitSb(entry)?.unalive && window.APXDice && APXDice.ask) {
        window.renderInitiativeTracker();
        APXDice.ask(`Heal ${_gmGmName(entry)}?`, `It's an Unalive Structure: it can't regain HP from resting or biological healing, only from mechanical repairs (an adjacent creature spends 3 AP: Xd6 HP, X = their INT modifier, min 1).`,
            [['repair', 'It\'s a repair: heal it', 'pri'], ['no', 'Cancel']]).then(a => { if (a === 'repair') window.updateInitiativeHp(id, value, { repair: true }); });
        return;
    }
    let before = (entry.currentHp || 0) + (entry.tempHp || 0), tempBefore = Math.max(0, entry.tempHp || 0);
    entry.currentHp = r.currentHp;
    entry.tempHp = r.tempHp;
    let after = (entry.currentHp || 0) + (entry.tempHp || 0);
    // A plain number that lowers HP is taken as the result, already reduced (no DR/ER applied)
    let dmg = Math.max(0, before - after);
    let hit = dmg > 0 ? _gmTakeHit(entry) : null;
    if (dmg > 0) { entry._undeadDc = dmg; entry._undeadOk = !(hit && hit.crit); }
    _gmLogHpChange(entry, before, after, wasAboveZero, dmg, hit);
    _gmCheckWoundThreshold(entry, dmg - Math.min(tempBefore, dmg));   // (only what got past Temp HP)
    if (hit) _gmHitEffects(entry, hit, []);
    _afterHpChange(entry, wasAboveZero);
};
// Temp HP box: "-N" is damage like the HP box (Temp HP goes first anyway); a number sets Temp HP
window.setInitiativeTempHp = function(id, value) {
    let entry = window.gmInitiative.find(e => e.id === id);
    if (!entry) return;
    if (_gmParseDamage(value, entry.tempHp || 0)) { let p = _gmParseDamage(value, entry.tempHp || 0); window.updateInitiativeHp(id, '-' + p.raw + (p.typed ? ' ' + p.types.join(' ') : '')); return; }
    let result = window.parseMathExpression(value, entry.tempHp || 0);
    if (result === null) { window.renderInitiativeTracker(); return; }
    // Temporary Hit Points don't stack: gaining more ("+5") while it has some asks which total to keep
    let oldTemp = entry.tempHp || 0;
    if (/^\s*\+/.test(String(value)) && oldTemp > 0 && result > oldTemp && window.APXDice && APXDice.ask) {
        let gain = result - oldTemp;
        window.renderInitiativeTracker();
        APXDice.ask(`${_gmGmName(entry)}: Temporary Hit Points`, `Temporary Hit Points don't stack. It has ${oldTemp}: keep them, or take the new ${gain}?`,
            [['new', `Take the new ${gain}`, gain > oldTemp ? 'pri' : ''], ['keep', `Keep ${oldTemp}`, gain > oldTemp ? '' : 'pri']])
            .then(a => { if (a === 'new' && window.gmInitiative.includes(entry)) window.setInitiativeTempHp(id, String(gain)); });
        return;
    }
    let wasAboveZero = entry.currentHp === null || entry.currentHp > 0;
    let before = (entry.currentHp || 0) + (entry.tempHp || 0);
    if (result < 0) {
        let r = window.apxApplyHpInput(String(result), entry.currentHp, 0, entry.maxHp);
        entry.tempHp = 0;
        if (r) entry.currentHp = r.currentHp;
    } else entry.tempHp = result;
    let after = (entry.currentHp || 0) + (entry.tempHp || 0);
    _gmLogHpChange(entry, before, after, wasAboveZero, Math.max(0, before - after), null);
    _afterHpChange(entry, wasAboveZero);
};
// Quick NPCs (no stat block): DR and ER typed on their tracker row
window.setInitiativeDef = function(id, key, value) {
    let entry = window.gmInitiative.find(e => e.id === id); if (!entry) return;
    entry[key] = Math.max(0, parseInt(value) || 0);
    window.renderInitiativeTracker();
    if (typeof window.saveWorldNotes === 'function') window.saveWorldNotes();
};

// A player typed damage on their own sheet. Their sheet reduced it with its own DR/ER and sends
// { raw, types, dmg, hpAfter, tempAfter }; here it becomes a hit (extra dice, reactions, saves…).
window._gmSheetDamage = {};   // uid -> { ev, t } handled
function _gmSheetDamageEvent(uid, ev) {
    let e = (window.gmInitiative || []).find(x => x.playerUid === uid && x.faction === 'player');
    if (!e) return;
    let types = Array.isArray(ev.types) && ev.types.length ? ev.types.slice() : ['Physical'];
    if (ev.ignoreRes) types.ignoreRes = true;   // the player ticked "Ignore resistances"
    // the tracker takes the sheet's new HP (it's the player's own entry)
    if (typeof ev.hpAfter === 'number') { e.currentHp = ev.hpAfter; e.tempHp = ev.tempAfter || 0; }
    let hit = (ev.atkId && window._gmLastAttack && window._gmLastAttack.id === ev.atkId ? _gmTakeHit(e) : null) || _gmTakeHit(e) || _gmTurnHit(e);
    e._sheetDmgAt = Date.now();
    _gmDamage(e, { raw: ev.raw || 0, types, hit, sheet: { dmg: ev.dmg || 0, hpDmg: typeof ev.hpDmg === 'number' ? ev.hpDmg : undefined, tempBefore: typeof ev.tempBefore === 'number' ? ev.tempBefore : undefined }, nonlethal: !!ev.nonlethal });
}

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
    // A fight in progress (one brought back after a refresh, say) whose map isn't open: "Battle map" opens it
    let lab = document.getElementById('gmCombatMapLabel');
    if (lab) {
        let fm = (window.gmInitiative || []).length ? _gmFightMap() : null;
        let want = fm && !document.getElementById('omWin_' + fm.id)
            ? `<button onclick="window.gmOpenFightMap()" title="Open ${esc(fm.name || 'the map')}, where this fight is happening" class="text-[10px] font-bold whitespace-nowrap px-2 py-0.5 rounded bg-emerald-800 hover:bg-emerald-700 text-white border border-emerald-500">Battle map ▸</button>`
            : `<label for="gmCombatMapSel" class="text-[10px] text-slate-400 font-bold whitespace-nowrap">Battle map</label>`;
        if (lab.innerHTML !== want) lab.innerHTML = want;
    }
}
// The map this fight is on: the one picked for it, or else the map holding most of its creatures' tokens
function _gmFightMap() {
    let maps = (typeof _wNotes !== 'undefined' && _wNotes.otherMaps) || [];
    if (window.gmCombatMapId) { let m = maps.find(x => x.id === window.gmCombatMapId); if (m) return m; }
    let ids = new Set((window.gmInitiative || []).map(e => e.id)), uids = new Set((window.gmInitiative || []).map(e => e.playerUid || e.companionOf).filter(Boolean));
    let best = null, bestN = 0;
    maps.filter(m => m.battleMapEnabled).forEach(m => {
        let n = (m.battleTokens || []).filter(t => ids.has(t.initiativeId) || ((t.type === 'player' || t.type === 'companion') && uids.has(t.playerUid))).length;
        if (n > bestN) { best = m; bestN = n; }
    });
    return best;
}
window.gmOpenFightMap = function() {
    let m = _gmFightMap(); if (!m || typeof window.openOtherMapWindow !== 'function') return;
    window.openOtherMapWindow(m.id);
    setTimeout(() => window.renderInitiativeTracker && window.renderInitiativeTracker(), 50);
};
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
        window._gmExtraTurn = null; _gmTac = null; _gmTacWaitClose();
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
                        name: `Combat (Round ${window.gmRoundNumber})`, date: window.apxToday(),
                        session: (typeof _wNotes !== 'undefined' && (_wNotes.session || []).length) || null,
                        description: `${totalXp} XP split between ${split}.` })
                        .catch(err => console.warn('XP grant error:', err.message));
                }
            });
        }
        window.gmInitiative = [];
        window.gmCurrentTurnIdx = 0;
        window.gmCombatStarted = false;
        window._gmExtraTurn = null;
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


// ── Tactician (INT perk) ──────────────────────────────────────────────
// Rank 1: when Start Combat is pressed, a Tactician player swaps an ally's initiative place with another
// creature's (the ally is no longer Surprised). The GM waits for the choice (or chooses for them).
// Rank 5: at the start of their turn (once per combat) they can skip it to give an ally a full turn now;
// afterward initiative carries on from the creature after the Tactician.
let _gmTac = null;   // { key, waiting: { entryId: { uid, name, status, order } }, swaps: [{ by, a, b }] }
window._gmExtraTurn = null;   // { tacId, allyId } while an ally takes a Tactician's turn
function _gmTacRank(e) {
    if (!e || e.faction !== 'player' || !e.playerUid || e.companionOf || e.summonOf) return 0;
    let pm = (window.gmParty || []).find(p => p.fileName === e.playerUid || p.summary?.playerUid === e.playerUid);
    return parseInt((((pm && (pm.state || pm.charState)) || {}).perks || {}).int_tactician) || 0;
}
window._gmTacRank = _gmTacRank;
function _gmTacFollower(e) { return !!(e && (e.companionOf || e.summonOf || e.summonOfEntry)); }
function _gmTacAlly(e) { return !!e && (e.faction === 'player' || e.faction === 'ally'); }
// What a Tactician player sees: the order by name (hidden creatures left out), side, and who's Surprised
function _gmTacOrder(list, me) {
    return list.filter(e => !_gmTacFollower(e) && !_gmIsHidden(e))
        .map(e => ({ id: e.id, name: _gmPublicName(e), faction: e.faction || 'enemy', surprised: !!e.surprised, me: !!(me && e.id === me.id) }));
}
// Two creatures trade places, each with the companion and summons that act right after it
function _gmTacSwap(aId, bId) {
    let L = window.gmInitiative;
    let rootOf = e => { let o = _gmCompanionOwner(e); return o && o !== e ? rootOf(o) : e; };
    let block = id => { let i = L.findIndex(e => e.id === id); if (i < 0) return null; let j = i + 1; while (j < L.length && _gmTacFollower(L[j]) && rootOf(L[j]) === L[i]) j++; return [i, j]; };
    let A = block(aId), B = block(bId);
    if (!A || !B || A[0] === B[0]) return false;
    if (A[0] > B[0]) { let t = A; A = B; B = t; }
    window.gmInitiative = L.slice(0, A[0]).concat(L.slice(B[0], B[1]), L.slice(A[1], B[0]), L.slice(A[0], A[1]), L.slice(B[1]));
    return true;
}
function _gmTacValid(pick) {
    if (!pick) return false;
    let a = window.gmInitiative.find(e => e.id === pick.a), b = window.gmInitiative.find(e => e.id === pick.b);
    return !!(a && b && a !== b && _gmTacAlly(a) && !_gmTacFollower(a) && !_gmTacFollower(b));
}
function _gmTacStart() {
    let L = window.gmInitiative.slice().sort(initiativeCompare);
    let tacs = L.filter(e => _gmTacRank(e) >= 1);
    if (!tacs.length) return false;
    _gmTac = { key: 'tac' + Date.now().toString(36), waiting: {}, swaps: [] };
    tacs.forEach(e => {
        let order = _gmTacOrder(L, e);
        _gmTac.waiting[e.id] = { uid: e.playerUid, name: e.name, status: 'wait', order };
        gmLog({ id: _gmTac.key + '_' + e.id, force: true, kind: 'info',
            text: `${e.name}: Tactician lets you swap an ally's place in the initiative order with another creature's before the fight begins.`,
            ask: { uid: e.playerUid, roll: 'tactician', rank: 1, free: true, label: 'Choose your Tactician swap', key: _gmTac.key, entryId: e.id, order } });
    });
    _gmTacWaitUi();
    return true;
}
function _gmTacWaitClose() { document.getElementById('gmTacWait')?.remove(); }
function _gmTacWaitUi() {
    if (!_gmTac) return _gmTacWaitClose();
    if (window.apxInjectDialogStyles) window.apxInjectDialogStyles();
    let back = document.getElementById('gmTacWait');
    if (!back) { back = document.createElement('div'); back.id = 'gmTacWait'; back.className = 'apxdlg-back'; document.body.appendChild(back); }
    let esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    let rows = Object.keys(_gmTac.waiting).map(id => {
        let w = _gmTac.waiting[id];
        let st = w.status === 'wait' ? '<span style="color:#fbbf24">Waiting…</span>' : w.status === 'done' ? '<span style="color:#4ade80">Swapped</span>' : '<span style="color:#94a3b8">No swap</span>';
        return `<div style="display:flex;align-items:center;gap:.5rem;border:1px solid var(--c-border,#334155);border-radius:.45rem;padding:.4rem .55rem;margin-bottom:.3rem;background:var(--c-surface2,#0f172a)">
            <span style="flex:1;font-weight:800;font-size:.8rem">${esc(w.name)}</span><span style="font-size:.7rem;font-weight:800">${st}</span>
            ${w.status === 'wait' ? `<button class="apxdlg-btn apxdlg-cancel" style="padding:.25rem .6rem;font-size:.68rem" data-tac-for="${esc(id)}">Choose for them</button>` : ''}</div>`;
    }).join('');
    back.innerHTML = `<div class="apxdlg" style="width:min(440px,100%)">
        <div class="apxdlg-title">Waiting on Tactician choice</div>
        <div class="apxdlg-msg" style="margin-bottom:.6rem">Tactician (Rank 1) lets these players swap an ally's place in the initiative order with another creature's before the fight begins. Combat starts once they've chosen.</div>
        ${rows}
        <div class="apxdlg-row" style="margin-top:.7rem"><button class="apxdlg-btn apxdlg-cancel" data-tac-cancel>Cancel</button><button class="apxdlg-btn apxdlg-ok" data-tac-go>Start without waiting</button></div></div>`;
    back.querySelectorAll('[data-tac-for]').forEach(b => b.onclick = () => {
        let id = b.dataset.tacFor, w = _gmTac && _gmTac.waiting[id]; if (!w) return;
        window.apxTacticianDialog({ rank: 1, who: w.name, order: w.order }, v => { if (_gmTac && _gmTac.waiting[id] && _gmTac.waiting[id].status === 'wait') _gmTacResolve(id, v); });
    });
    back.querySelector('[data-tac-cancel]').onclick = () => { _gmTac = null; _gmTacWaitClose(); };
    back.querySelector('[data-tac-go]').onclick = () => { _gmTacWaitClose(); window.startCombat(true); };
}
function _gmTacResolve(entryId, pick) {
    if (!_gmTac || !_gmTac.waiting[entryId]) return;
    let ok = pick && _gmTacValid(pick);
    _gmTac.waiting[entryId].status = ok ? 'done' : 'pass';
    if (ok) _gmTac.swaps.push({ by: entryId, a: pick.a, b: pick.b });
    if (Object.values(_gmTac.waiting).every(x => x.status !== 'wait')) { _gmTacWaitClose(); window.startCombat(true); }
    else _gmTacWaitUi();
}
// Applied right after Start Combat locks the order
function _gmTacApply(swaps) {
    (swaps || []).forEach(s => {
        if (!_gmTacValid(s)) return;
        let by = window.gmInitiative.find(e => e.id === s.by), a = window.gmInitiative.find(e => e.id === s.a), b = window.gmInitiative.find(e => e.id === s.b);
        if (!_gmTacSwap(s.a, s.b)) return;
        let freed = [a, b].filter(x => _gmTacAlly(x) && x.surprised);
        freed.forEach(x => { x.surprised = false; });
        let tail = freed.length ? ` ${freed.map(_gmPublicName).join(' and ')} ${freed.length > 1 ? 'are' : 'is'} no longer Surprised.` : '';
        let tailGm = freed.length ? ` ${freed.map(_gmGmName).join(' and ')} ${freed.length > 1 ? 'are' : 'is'} no longer Surprised.` : '';
        gmLog({ text: `${by ? by.name : 'A Tactician'} (Tactician) swaps ${_gmPublicName(a)} and ${_gmPublicName(b)} in the initiative order.${tail}`,
            gmText: `${by ? by.name : 'A Tactician'} (Tactician) swaps ${_gmGmName(a)} and ${_gmGmName(b)} in the initiative order.${tailGm}`, kind: 'info' });
    });
}
// Rank 5: offered at the start of the Tactician's turn, once per combat
function _gmTac5Offer(e) {
    if (!window.gmCombatStarted || !e || _gmTacRank(e) < 5 || e._tac5Used || window._gmExtraTurn) return;
    let allies = window.gmInitiative.filter(x => x !== e && _gmTacAlly(x) && !_gmTacFollower(x) && !_gmIsHidden(x));
    if (!allies.length) return;
    let key = 'tac5_' + e.id + '_' + window.gmTurnNumber;
    gmLog({ id: key, kind: 'info', text: `${e.name}: Tactician lets you skip this turn to give an ally a full turn right now (once per combat).`,
        ask: { uid: e.playerUid, roll: 'tactician', rank: 5, free: true, label: 'Tactician: give an ally your turn?', key, entryId: e.id, turnNo: window.gmTurnNumber, order: _gmTacOrder(window.gmInitiative, e) } });
    gmLog({ id: key + '_gm', gmOnly: true, kind: 'info', text: `${e.name} can skip this turn for an ally's (Tactician). Their turn carries on as normal unless they choose to.` });
}
window._gmTac5Give = function(entryId, allyId) {
    let e = window.gmInitiative.find(x => x.id === entryId), ally = window.gmInitiative.find(x => x.id === allyId);
    if (!e || !ally || e === ally || !_gmTacAlly(ally) || _gmTacFollower(ally) || e._tac5Used) return false;
    if (window.gmInitiative[window.gmCurrentTurnIdx] !== e) return false;   // only on the Tactician's own turn
    e._tac5Used = true;
    try { _gmExpireCondTimers(e); _gmPfxTurnEnd(e); } catch (err) { console.warn('Tactician turn end:', err); }
    window._gmExtraTurn = { tacId: e.id, allyId: ally.id };
    window.gmCurrentTurnIdx = window.gmInitiative.indexOf(ally);
    window.gmTurnNumber++;
    gmStartTurnAp(ally); _gmBurnTick(ally);
    gmLog({ text: `${_gmPublicName(e)} skips their turn (Tactician): ${_gmPublicName(ally)} takes a full turn now. Then it's back to the creature after ${_gmPublicName(e)}.`,
        gmText: `${_gmGmName(e)} skips their turn (Tactician): ${_gmGmName(ally)} takes a full turn now. Next Turn then goes to whoever comes after ${_gmGmName(e)}.`, kind: 'info' });
    window.renderInitiativeTracker();
    if (typeof window._btRefreshAllOpenMaps === 'function') window._btRefreshAllOpenMaps();
    if (typeof window.saveWorldNotes === 'function') window.saveWorldNotes();
    return true;
};
// A Tactician player's answer (from their sheet)
function _gmTacAnswer(uid, ev) {
    let e = window.gmInitiative.find(x => x.id === ev.entryId);
    if (!e || e.playerUid !== uid) return;
    if (ev.rank === 5) {
        if (ev.pass || !ev.ally) { gmLog({ gmOnly: true, kind: 'info', text: `${e.name} keeps their turn (Tactician).` }); return; }
        if (window.gmTurnNumber !== ev.turnNo) return;   // their turn has already passed
        window._gmTac5Give(e.id, ev.ally);
        return;
    }
    if (!_gmTac || ev.key !== _gmTac.key || !_gmTac.waiting[e.id] || _gmTac.waiting[e.id].status !== 'wait') return;
    _gmTacResolve(e.id, ev.pass ? null : { a: ev.a, b: ev.b });
}

// Locks the current order in (one final stable sort, so any manual tie
// breaks the GM already made are preserved) and starts Round 1, Turn 1.
// After this, new arrivals join at the bottom instead of auto-sorting in.
// A Tactician (Rank 1) in the fight is asked first (skipTac: already asked).
window.startCombat = function(skipTac) {
    if (skipTac !== true && _gmTacStart()) return;
    let swaps = _gmTac ? _gmTac.swaps : [];
    _gmTac = null; _gmTacWaitClose();
    window.gmInitiative.sort(initiativeCompare);
    window.gmCombatStarted = true;
    window.gmCurrentTurnIdx = 0;
    window.gmRoundNumber = 1;
    window.gmTurnNumber = 1;
    window._gmExtraTurn = null;
    window.gmInitiative.forEach(x => { x.apCur = 0; x._apTurns = 0; x._apFirstSurprised = false; x._tac5Used = false; });
    window.gmCombatLog = []; window._gmPendingSaves = {}; window._gmResolvedSaves = {};
    _gmSetLootDefeated(0); window.renderGmLoot && window.renderGmLoot();   // counts the enemies of this fight
    _gmLogSession = 'c' + Date.now().toString(36);
    gmLog({ text: 'Combat started. Round 1.', kind: 'info' });
    _gmTacApply(swaps);
    if (window.gmInitiative[0]) { gmStartTurnAp(window.gmInitiative[0]); _gmBurnTick(window.gmInitiative[0]); _gmTac5Offer(window.gmInitiative[0]); }
    window.renderInitiativeTracker();
    if (typeof window._btRefreshAllOpenMaps === 'function') window._btRefreshAllOpenMaps();
    if (typeof window.saveWorldNotes === 'function') window.saveWorldNotes();
};

window.nextInitiativeTurn = function() {
    if (!window.gmInitiative.length) return;
    // Damage Aura: the creature ending its turn next to one takes its damage (it may not survive it)
    let endIdx = window.gmCurrentTurnIdx, ending = window.gmInitiative[endIdx];
    if (window.gmCombatStarted && ending) { try { _gmAuraTick(ending); } catch (e) { console.warn('Damage Aura:', e); } }
    if (ending && !window.gmInitiative.includes(ending)) {
        if (!window.gmInitiative.length) { window.renderInitiativeTracker(); return; }
        window.gmCurrentTurnIdx = endIdx - 1;   // it was removed: the turn goes to whoever came after it
    } else { _gmExpireCondTimers(ending); try { _gmPfxTurnEnd(ending); } catch (e) { console.warn('Escape Saves:', e); } }
    // An ally's Tactician turn just ended: initiative carries on from the creature after the Tactician
    if (window._gmExtraTurn) {
        let x = window._gmExtraTurn; window._gmExtraTurn = null;
        let ti = window.gmInitiative.findIndex(q => q.id === x.tacId);
        if (ti >= 0) window.gmCurrentTurnIdx = ti;
    }
    window.gmCurrentTurnIdx++;
    if (window.gmCurrentTurnIdx >= window.gmInitiative.length) {
        window.gmCurrentTurnIdx = 0;
        window.gmRoundNumber++;
        gmLog({ text: `Round ${window.gmRoundNumber}.`, kind: 'info' });
    }
    window.gmTurnNumber++;
    let current = window.gmInitiative[window.gmCurrentTurnIdx];
    // A downed Undead rolls its revival before anything else (no AP while it's down). Destroyed, the next
    // creature's turn starts exactly as if Next Turn had been pressed: AP, Burning, Tactician and all.
    while (current && current.undeadDown) {
        let at = window.gmCurrentTurnIdx;
        _gmUndeadRevive(current);
        if (window.gmInitiative.includes(current)) break;   // it rose: its turn
        if (!window.gmInitiative.length) { window.renderInitiativeTracker(); return; }
        if (at >= window.gmInitiative.length) {
            at = 0; window.gmRoundNumber++;
            gmLog({ text: `Round ${window.gmRoundNumber}.`, kind: 'info' });
        }
        window.gmCurrentTurnIdx = at;
        window.gmTurnNumber++;
        current = window.gmInitiative[window.gmCurrentTurnIdx];
    }
    if (current) gmStartTurnAp(current);
    if (current) _gmBurnTick(current);
    if (current) _gmTac5Offer(current);
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
    window._gmExtraTurn = null;
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
// Caster (Power) Slots of an NPC in the tracker, used up per creature (each copy has its own)
function _gmCasterSlotsHtml(e, sb) {
    let cs = (sb && sb.casterSlots) || {};
    let levels = [1, 2, 3, 4, 5].filter(L => (parseInt(cs[L]) || 0) > 0);
    if (!levels.length) return '';
    e.slotUsed = e.slotUsed || {};
    return `<div class="flex items-center gap-2 text-[9px] text-slate-400 flex-wrap"><span class="font-bold">Power Slots</span>${levels.map(L => {
        let max = parseInt(cs[L]) || 0, used = Math.min(max, e.slotUsed[L] || 0);
        return `<span class="flex items-center gap-0.5" title="Level ${L}: ${max - used} of ${max} left. Click a pip to use or restore one.">L${L}${Array.from({ length: max }, (_, i) => `<button onclick="window.gmToggleCasterSlot('${e.id}', ${L}, ${i})" style="width:8px;height:8px;border-radius:50%;padding:0;border:1px solid #a78bfa;background:${i < max - used ? '#8b5cf6' : 'transparent'};cursor:pointer"></button>`).join('')}</span>`;
    }).join('')}</div>`;
}
window.gmToggleCasterSlot = function(entryId, L, i) {
    let e = (window.gmInitiative || []).find(x => x.id === entryId); if (!e) return;
    let sb = e.sourceNpcId ? ncStatBlockFor(e.sourceNpcId) : null; let max = parseInt(((sb && sb.casterSlots) || {})[L]) || 0;
    e.slotUsed = e.slotUsed || {};
    let avail = max - (e.slotUsed[L] || 0);
    e.slotUsed[L] = i < avail ? Math.min(max, (e.slotUsed[L] || 0) + 1) : Math.max(0, max - (i + 1));
    window.renderInitiativeTracker();
    if (typeof window.refreshOpenStatBlocks === 'function') window.refreshOpenStatBlocks();
};
// Spends a Power Slot of this Level, or the lowest higher one left. Returns the Level used, or null.
window.gmSpendCasterSlot = function(entryId, lvl) {
    let e = (window.gmInitiative || []).find(x => x.id === entryId); if (!e) return null;
    let sb = e.sourceNpcId ? ncStatBlockFor(e.sourceNpcId) : null; let cs = (sb && sb.casterSlots) || {};
    e.slotUsed = e.slotUsed || {};
    for (let L = Math.max(1, lvl || 1); L <= 5; L++) {
        let max = parseInt(cs[L]) || 0;
        if ((e.slotUsed[L] || 0) < max) { e.slotUsed[L] = (e.slotUsed[L] || 0) + 1; window.renderInitiativeTracker(); return L; }
    }
    return null;
};
function renderInitiativePowerBubbles(e) {
    let sb = ncStatBlockFor(e.sourceNpcId);
    if (!sb) return '';
    let slotsHtml = _gmCasterSlotsHtml(e, sb);
    let limitedPowers = sb.powerCards.concat(sb.lairActionPowerCards, e.awakened ? (sb.awakenedPowerCards || []) : []).filter(p => p.usageType === 'charges' || p.usageType === 'recharge');
    if (!limitedPowers.length) return slotsHtml;
    if (!e.powerUsage) e.powerUsage = {};
    return slotsHtml + limitedPowers.map(p => {
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
        let rc = _gmRechargeOn(p), cost = _gmRechargeCost(p);
        let nm = p.name.replace(/'/g, "\\'");
        return `
            <div class="flex items-center gap-2 text-[9px] text-slate-400">
                <span class="font-bold shrink-0">${p.name} <span class="text-slate-500">(Recharge ${rc === 6 ? '6' : rc + '-6'})</span></span>
                <button onclick="window.adjustInitiativePowerCharges('${e.id}', '${nm}', -1)" class="w-4 h-4 rounded bg-slate-700 hover:bg-slate-600 text-white font-bold text-[9px] leading-none">-</button>
                <span>${isUsed ? 'Used' : 'Available'}</span>
                <button onclick="window.adjustInitiativePowerCharges('${e.id}', '${nm}', 1)" class="w-4 h-4 rounded bg-slate-700 hover:bg-slate-600 text-white font-bold text-[9px] leading-none">+</button>
                ${isUsed ? `<button onclick="window._gmRechargeTry('${e.id}', '${nm}')" title="Spend ${cost} AP (half its AP, rounded down, minimum 1) to roll a d6 to recharge it" class="px-1.5 h-4 rounded bg-indigo-700 hover:bg-indigo-600 text-white font-bold text-[9px] leading-none">Recharge (${cost} AP)</button>` : ''}
            </div>
        `;
    }).join('');
}
// ── Recharge powers ──
// At the start of the creature's turn, each used Recharge power rolls a d6 and recharges on its number
// (5-6, or 6). The creature can also spend half the power's AP (rounded down, minimum 1) to roll for it.
function _gmRechargeOn(p) { return parseInt(p && p.rechargeOn) === 6 ? 6 : 5; }
function _gmRechargeCost(p) { return Math.max(1, Math.floor((parseInt(p && p.ap) || 0) / 2)); }
function _gmRechargeRoll(e, p, why) {
    let r = window.APXDice ? APXDice.rnd(6) : 1 + Math.floor(Math.random() * 6);
    let ok = r >= _gmRechargeOn(p);
    if (ok) e.powerUsage[p.name] = 0;
    gmLog({ text: `${_gmGmName(e)}'s ${p.name}: recharge roll ${r}${why ? ' (' + why + ')' : ''}, ${ok ? 'recharged' : 'not yet'}.`, kind: 'info', gmOnly: true });
    return ok;
}
function _gmRechargeTick(e) {
    if (!e || e.faction === 'player' || !e.sourceNpcId || !e.powerUsage || typeof ncStatBlockFor !== 'function') return;
    let sb = ncStatBlockFor(e.sourceNpcId); if (!sb) return;
    sb.powerCards.concat(sb.lairActionPowerCards, e.awakened ? (sb.awakenedPowerCards || []) : [])
        .filter(p => p.usageType === 'recharge' && (e.powerUsage[p.name] || 0) > 0)
        .forEach(p => _gmRechargeRoll(e, p, 'start of its turn'));
}
window._gmRechargeTry = function(entryId, name) {
    let e = (window.gmInitiative || []).find(x => x.id === entryId); if (!e) return;
    let sb = e.sourceNpcId && typeof ncStatBlockFor === 'function' ? ncStatBlockFor(e.sourceNpcId) : null; if (!sb) return;
    let p = sb.powerCards.concat(sb.lairActionPowerCards, sb.awakenedPowerCards || []).find(x => x.name === name); if (!p) return;
    let cost = _gmRechargeCost(p), have = gmApCurrent(e);
    if (have < cost) { window.APXDice?.notify(`${_gmGmName(e)} needs ${cost} AP to try to recharge ${name} (it has ${have}).`, { kind: 'warn', open: true }); return; }
    e.apCur = have - cost;
    if (!e.powerUsage) e.powerUsage = {};
    _gmRechargeRoll(e, p, `spent ${cost} AP`);
    window.renderInitiativeTracker();
};

// ── Mythic Awakening ──
// The first time it drops to 0 HP it doesn't die: HP fully restored, negative conditions gone, full AP,
// and initiative skips to its turn. Its Awakened powers unlock. Ticking "Awakened" does the same by hand.
function _gmHasMythic(e) {
    let n = e && e.sourceNpcId && (window.gmNpcs || []).find(x => x.id === e.sourceNpcId);
    return !!(n && n.npc && n.npc.mythicAwakening);
}
function _gmAwaken(e, how) {
    e.awakened = true;
    e.currentHp = e.maxHp; e.ko = false;
    let conds = window._gmEntryConditions ? window._gmEntryConditions(e.id) : [];
    e._noStandCost = true;
    try { conds.forEach(c => { if (window._gmRemoveEntryCondition) window._gmRemoveEntryCondition(e.id, c); }); } finally { delete e._noStandCost; }
    e._powerFx = []; e._condTimers = []; e.bleedOutTurns = null;
    e.apCur = gmApMax(e);
    let i = window.gmInitiative.indexOf(e);
    if (window.gmCombatStarted && i >= 0 && i !== window.gmCurrentTurnIdx) { window.gmCurrentTurnIdx = i; window.gmTurnNumber = (window.gmTurnNumber || 1) + 1; }
    gmLog({ text: `${_gmPublicName(e)} Awakens! ${how === 'gm' ? '' : 'It refuses to fall: '}its wounds close and it rises at full strength${window.gmCombatStarted ? ', taking its turn now' : ''}.`, gmText: `${_gmGmName(e)} Awakens (Mythic Awakening): full HP, conditions cleared, full AP${window.gmCombatStarted ? ', its turn now' : ''}. Its Awakened powers are unlocked.`, kind: 'info', force: true });
    window.renderInitiativeTracker();
    if (typeof window._btRefreshAllOpenMaps === 'function') window._btRefreshAllOpenMaps();
    if (typeof window.refreshOpenStatBlocks === 'function') window.refreshOpenStatBlocks();
    if (typeof window.saveWorldNotes === 'function') window.saveWorldNotes();
}
window._gmToggleAwakened = function(entryId, on) {
    let e = (window.gmInitiative || []).find(x => x.id === entryId); if (!e) return;
    if (on) _gmAwaken(e, 'gm');
    else { e.awakened = false; window.renderInitiativeTracker(); if (typeof window.refreshOpenStatBlocks === 'function') window.refreshOpenStatBlocks(); }
};
function _gmMythicHtml(e) {
    if (e.faction === 'player' || !_gmHasMythic(e)) return '';
    return `<label class="flex items-center gap-1 text-[9px] font-bold ${e.awakened ? 'text-amber-300' : 'text-slate-400'} cursor-pointer" title="Mythic Awakening: the first time it drops to 0 HP it Awakens on its own (full HP, conditions cleared, full AP, its turn now). Tick to Awaken it now; its Awakened powers unlock.">
        <input type="checkbox" ${e.awakened ? 'checked' : ''} onchange="window._gmToggleAwakened('${e.id}', this.checked)" style="width:11px;height:11px"> Mythic Awakening: ${e.awakened ? 'Awakened' : 'not yet'}</label>`;
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
// Bloodied Frenzy (NPC trait): at or below half HP, +2 AP at the start of its turn (a summoned creature's hard
// 3 AP rises to 5 while it lasts)
function _gmBloodiedFrenzy(e) {
    if (!e || e.faction === 'player' || e.currentHp == null || !(e.maxHp > 0) || e.currentHp <= 0 || e.currentHp > e.maxHp / 2) return false;
    let sb = typeof _gmNpcSb === 'function' ? _gmNpcSb(e) : null;
    return !!(sb && (sb.traitList || []).some(t => t && t.key === 'bloodiedfrenzy'));
}
function gmApMax(e) { return e && e.summoned ? (_gmBloodiedFrenzy(e) ? 5 : 3) : Math.max(0, parseInt(e.ap) || 0); }
function gmApCurrent(e) {
    let max = gmApMax(e);
    let cur = e.apCur;
    if (cur === undefined || cur === null) cur = window.gmCombatStarted ? 0 : max;   // gains AP at the start of its first turn
    return Math.max(0, Math.floor(Number(cur) || 0));
}
// A Surprised creature gains only 1 AP at the start of its first turn of combat
// (this includes creatures added mid-combat that enter Surprised).
function gmStartTurnAp(e) {
    if (e && e.faction !== 'player' && window.gmCombatStarted) { try { _gmRechargeTick(e); } catch (err) { console.warn('Recharge:', err); } }
    let first = e._apTurns === 0 || (e._apTurns == null && e.apCur == null);   // older saved combats: only brand-new entries
    e._apTurns = (e._apTurns || 0) + 1;
    e._apFirstSurprised = !!(first && e.surprised);
    if (e.faction === 'player') return;   // players' sheets add their own AP when their turn starts
    // A creature summoned by a power: a hard 3 AP, gained fresh each turn (nothing banked)
    if (e.summoned) e.apCur = e._apFirstSurprised ? 1 : 3;
    else e.apCur = gmApCurrent(e) + (e._apFirstSurprised ? 1 : gmApMax(e));
    // Bloodied Frenzy: at or below half HP, +2 AP (a summoned creature's cap goes from 3 to 5)
    if (_gmBloodiedFrenzy(e)) {
        e.apCur = e.summoned ? Math.min(5, e.apCur + 2) : e.apCur + 2;
        gmLog({ text: `${_gmPublicName(e)} is Bloodied and frenzied: +2 AP this turn.`, gmText: `Bloodied Frenzy: ${_gmGmName(e)} is at or below half HP, +2 AP (${e.apCur} AP)${e.summoned ? '; its summoned 3 AP cap is 5 while it lasts' : ''}.`, kind: 'info' });
    }
    // Conditions that take away AP (Stunned, Incapacitated, Paralyzed, Unconscious…): no AP this turn
    let noAp = _gmEffConds(e).map(id => (typeof CONDITIONS !== 'undefined' ? CONDITIONS : []).find(c => c.id === id)).filter(c => c && c.apZero);
    if (noAp.length) {
        let why = (noAp.find(c => ['stunned', 'unconscious', 'paralyzed', 'bleedingout'].includes(c.id)) || noAp[0]).name;
        let named = ['Stunned', 'Unconscious', 'Paralyzed', 'Bleeding Out'].find(n => _gmEffConds(e).some(id => (CONDITIONS.find(c => c.id === id) || {}).name === n)) || why;
        e.apCur = 0;
        gmLog({ text: `${_gmPublicName(e)} is ${named} and has no AP this turn.`, gmText: `${_gmGmName(e)} is ${named}: AP set to 0.`, kind: 'info' });
    }
}
// Burning, for NPCs and companions (players' sheets roll their own): 1d10 Fire at the start of the
// creature's turn, ignoring ER. Immune to Fire: nothing; a Fire Vulnerability adds to it.
function _gmBurnTick(e) {
    if (!e || e.faction === 'player' || !_gmEffConds(e).includes('burning') || e.currentHp === null) return;
    let def = _gmDefenseOf(e);
    if ((def.immune || []).includes('Fire')) { gmLog({ text: `${_gmPublicName(e)} is Burning but immune to Fire.`, gmText: `${_gmGmName(e)} is Burning but immune to Fire: no damage.`, kind: 'info' }); return; }
    let card = window.APXDice ? window.APXDice.damage({ label: 'Burning (start of turn)', who: e.name, formula: '1d10', dmgType: 'Fire', perks: false }) : null;
    let rolled = card && card.parts && card.parts[0] ? card.parts[0].total : 1 + Math.floor(Math.random() * 10);
    let vuln0 = Math.max(0, -((def.res || {}).Fire || 0));
    // Temp HP soaks it unmodified; a Fire Vulnerability only adds to what gets past it
    let toTemp = Math.min(rolled, Math.max(0, e.tempHp || 0)), vuln = rolled - toTemp > 0 ? vuln0 : 0;
    let dmg = rolled + vuln, wasUp = e.currentHp > 0;
    let r = window.apxApplyHpInput('-' + dmg, e.currentHp, e.tempHp, e.maxHp);
    if (r) { e.currentHp = r.currentHp; e.tempHp = r.tempHp; }
    e.lastHit = { text: `Burning: ${rolled}${vuln ? ' + ' + vuln + ' Fire Vulnerability' : ''} Fire, ignoring ER = ${dmg}`, dmg, t: Date.now() };
    let down = wasUp && e.currentHp <= 0;
    gmLog({ text: `${_gmPublicName(e)} ${e.faction === 'enemy' ? 'takes Fire damage from Burning' : 'burns for ' + dmg + ' Fire damage'}.${down ? ` ${_gmPublicName(e)} is down!` : ''}`,
        gmText: `${_gmGmName(e)} burns for ${dmg} Fire damage (1d10: ${rolled}${vuln ? ', +' + vuln + ' Fire Vulnerability' : ''}, ignoring ER).${down ? ' Down!' : ''}`, kind: 'dmg' });
    _afterHpChange(e, wasUp);
}
window._gmBurnTick = _gmBurnTick;
// Prone removed during combat: standing up cost the creature 2 AP (NPCs; players' sheets handle their own)
window._gmStandUpAp = function(entryId) {
    let e = (window.gmInitiative || []).find(x => x.id === entryId);
    if (!e || !window.gmCombatStarted || e.faction === 'player' || e._noStandCost) return;   // (an effect ending it isn't standing up)
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
// Swarm below half HP: its attacks roll half their damage dice (rounded down, at least 1 die)
function _gmSwarmDice(o) {
    if (!o || !o.dice || o.companion) return null;
    let init = window.gmInitiative || [];
    let list = o.npcId ? init.filter(x => x.sourceNpcId === o.npcId) : [];
    let cur = init[window.gmCurrentTurnIdx];
    let e = (o.initId && init.find(x => x.id === o.initId)) || (cur && list.includes(cur) ? cur : null) || (list.length === 1 ? list[0] : null);
    if (!e || e.currentHp == null || !e.maxHp || e.currentHp >= e.maxHp / 2) return null;
    let sb = _gmTraitSb(e); if (!sb || !sb.swarm) return null;
    let was = String(o.dice);
    o.dice = was.replace(/(\d*)d(\d+)/gi, (m, n, d) => Math.max(1, Math.floor((parseInt(n) || 1) / 2)) + 'd' + d);
    return o.dice !== was ? `Swarm below half HP: half its damage dice (${was} → ${o.dice})` : null;
}
window._gmSwarmDice = _gmSwarmDice;
window.apxBeforeAttack = function(o) {
    let sw = _gmSwarmDice(o);
    let r = _gmBeforeAttackAp(o);
    if (sw) { r = r || {}; r.note = [r.note, sw].filter(Boolean).join(' · '); }
    return r;
};
function _gmBeforeAttackAp(o) {
    // A player's Loyal Companion (stat block opened from the Party panel): its initiative entry pays
    if (o && o.companion && o.compOwner && window.gmCombatStarted) {
        let e = (window.gmInitiative || []).find(x => x.companionOf === o.compOwner);
        if (!e) return null;
        let cost = Math.max(0, (o.apCost === 0 || o.apCost === "0") ? 0 : (parseInt(o.apCost) || 3)), have = gmApCurrent(e);
        if (have < cost) return { note: `Not enough AP: ${e.name} has ${have}, needs ${cost}`, warn: true };
        e.apCur = have - cost; window.renderInitiativeTracker();
        return { note: `${e.name}: -${cost} AP (${e.apCur} left)` };
    }
    if (!o || !o.npcId || !window.gmCombatStarted) return null;
    let cost = Math.max(0, (o.apCost === 0 || o.apCost === "0") ? 0 : (parseInt(o.apCost) || 3));
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

// Conditions on a player from the tracker (any time, like an NPC's): their sheet picks it up.
// What the GM just changed is shown at once and held until the player's sheet reports the same
// (a save the sheet made before it heard about the change mustn't flip it back), or for 20 seconds.
window._gmCondPending = window._gmCondPending || {};   // uid -> { condId: { on, t } }
function _gmPlayerCondList(e) {
    let pm = (window.gmParty || []).find(p => p.fileName === e.playerUid);
    let list = (pm?.state?.conditions || []).slice();
    let pend = window._gmCondPending[e.playerUid] || {};
    Object.keys(pend).forEach(cid => {
        let p = pend[cid], has = list.includes(cid);
        if (has === p.on || Date.now() - p.t > 20000) { delete pend[cid]; return; }   // the sheet caught up (or gave up)
        if (p.on) list.push(cid); else list = list.filter(c => c !== cid);
    });
    return list;
}
window._gmPlayerCondList = _gmPlayerCondList;
window._gmTogglePlayerCond = async function(entryId, condId, on) {
    let e = (window.gmInitiative || []).find(x => x.id === entryId); if (!e || !e.playerUid) return;
    let name = window._gmCondName ? window._gmCondName(condId) : condId;
    if (condId === 'bleedingout') {
        if (on) {
            // Bleeding Out is what happens at 0 HP: drop them there and start it properly
            if (e.bleedOutTurns != null) return;
            let ok = (e.currentHp || 0) <= 0 || !window.apxConfirm ? true
                : await window.apxConfirm(`Bleeding Out happens at 0 HP. Drop ${e.name} to 0 HP and start their Bleed Out? Their sheet asks them for the CON (Survive) check that sets how many rounds they have.`, { title: 'Bleeding Out', okLabel: 'Drop to 0 HP' });
            if (!ok) return;
            let wasUp = e.currentHp === null || e.currentHp > 0;
            e.currentHp = 0; e.tempHp = 0; e._gmHpSetAt = Date.now();
            (window._gmCondPending[e.playerUid] = window._gmCondPending[e.playerUid] || {})[condId] = { on: true, t: Date.now() };
            _gmSetPlayerCondition(e, 'bleedingout', true);
            _syncHpToPlayer(e);
            gmLog({ text: `${e.name} is down and Bleeding Out.`, kind: 'bleed', force: true });
            if (wasUp || e.bleedOutTurns == null) _gmQueueBleed(e);
        } else {
            // Taken off by hand: they're stable
            e.bleedOutTurns = null; e.stabilized = true;
            (window._gmPendingSaves[e.id] || []).splice(0);
            (window._gmCondPending[e.playerUid] = window._gmCondPending[e.playerUid] || {})[condId] = { on: false, t: Date.now() };
            _gmSetPlayerCondition(e, 'bleedingout', false);
            gmLog({ text: `${e.name} is stable and no longer Bleeding Out.`, kind: 'heal', force: true });
        }
        window.renderInitiativeTracker();
        return;
    }
    (window._gmCondPending[e.playerUid] = window._gmCondPending[e.playerUid] || {})[condId] = { on: !!on, t: Date.now() };
    _gmSetPlayerCondition(e, condId, on);
    gmLog({ text: `${e.name} ${on ? 'is now' : 'is no longer'} ${name}.`, kind: 'info', force: true });
    if (window._gmOnCondChange) window._gmOnCondChange(entryId, condId, on);
    window.renderInitiativeTracker();
    if (typeof window._btRefreshAllOpenMaps === 'function') window._btRefreshAllOpenMaps();
};
window._gmPlayerCondPicker = function(entryId, ev) {
    let e = (window.gmInitiative || []).find(x => x.id === entryId); if (!e || typeof window._apxCondPicker !== 'function') return;
    let r = ev?.target?.getBoundingClientRect?.() || { left: 200, bottom: 200 };
    let pmOf = () => (window.gmParty || []).find(p => p.fileName === e.playerUid);
    window._apxCondPicker(r.left, r.bottom + 4, () => _gmPlayerCondList(e).filter(c => c !== 'bleedingout' || e.bleedOutTurns != null), (id, on) => window._gmTogglePlayerCond(entryId, id, on), 'Conditions: ' + (e.name || ''));
};
// A player's Power Slots (live from their sheet) and powers, for the GM's stat block window
// One of a player's powers, in full (the stat block, the party panel and the power's own popup)
function _gmPlayerPowerCard(p, st, mods, big) {
    let esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let attr = window.apxPowerAttr ? window.apxPowerAttr(p, st) : '';
    let pool = window.apxPowerPool ? (window.apxPowerPool(p, st) === 'short' ? 'Short Rest' : 'Full Rest') : '';
    let dmg = window.apxAttrDmgText ? window.apxAttrDmgText(p.dmg || '-', (mods || {})[attr]) : (p.dmg || '-');
    let lines = p.draft && window.apxPowerSaveLines ? window.apxPowerSaveLines(p.draft) : null;
    let cast = window.apxPowerCastTime ? window.apxPowerCastTime(p) : '';
    let fs = big ? '.75rem' : '.58rem';
    return `<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.3rem;font-size:${fs};color:#94a3b8;margin:.15rem 0">
            <div><span style="color:#64748b">A/S:</span> ${esc(p.atk || '-')}</div><div><span style="color:#64748b">R/A:</span> ${esc(p.rng || '-')}</div><div><span style="color:#64748b">D/H:</span> ${esc(dmg)}</div></div>
        <div style="font-size:${fs};color:#a78bfa;font-weight:700">${[attr, pool, cast ? 'Lengthy Cast Time: ' + cast : ''].filter(Boolean).map(esc).join(' · ')}</div>
        ${lines && lines.escape ? `<div style="font-size:${fs};color:#c4b5fd;font-weight:700">${esc(lines.escape)}</div>` : ''}
        ${p.desc ? `<div style="font-size:${fs};color:#cbd5e1;line-height:1.4;white-space:pre-wrap;margin-top:.15rem">${esc(p.desc)}</div>` : ''}`;
}
// Click a power's name (party panel, a player's stat block): the power in its own window
window._gmPlayerPowerPopup = function(uid, idx) {
    let pm = (window.gmParty || []).find(x => x.fileName === uid || x.summary?.playerUid === uid);
    let st = pm && pm.state, p = st && (st.powers || [])[idx]; if (!p) return;
    let winId = 'pwrPop_' + String(uid).replace(/[^a-z0-9_-]/gi, '') + '_' + idx;
    document.getElementById(winId)?.remove();
    let esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let spot = window.apxWindowSpot ? window.apxWindowSpot(380, 320, 0) : { left: 200, top: 120, w: 380 };
    let win = document.createElement('div');
    win.id = winId;
    win.style.cssText = `position:fixed;left:${spot.left}px;top:${spot.top}px;width:${spot.w}px;max-height:70vh;background:#0f172a;border:1px solid #7c3aed;border-radius:.6rem;z-index:${(window.apxFloatingZTop = (window.apxFloatingZTop || 2000) + 1)};box-shadow:0 10px 40px rgba(0,0,0,.85);display:flex;flex-direction:column;overflow:hidden`;
    win.innerHTML = `<div id="${winId}_hdr" style="cursor:grab;user-select:none;background:#2e1065;padding:.5rem .7rem;display:flex;align-items:center;gap:.5rem">
            <div style="flex:1;min-width:0"><div data-win-title style="font-size:.9rem;font-weight:900;color:#ede9fe">${esc(p.name || 'Power')}</div>
            <div style="font-size:.62rem;color:#c4b5fd">${esc(pm.summary?.name || 'Player')} · Lvl ${esc(p.lvl)} · ${esc(window.apxPowerApLabel ? window.apxPowerApLabel(p) : (p.ap + ' AP'))}</div></div>
            <button data-x title="Close" style="background:none;border:none;color:#c4b5fd;font-size:1.05rem;font-weight:800;cursor:pointer">X</button></div>
        <div style="padding:.6rem .8rem;overflow-y:auto">${_gmPlayerPowerCard(p, st, pm.summary && pm.summary.mods, true)}</div>`;
    win.querySelector('[data-x]').onclick = () => win.remove();
    document.body.appendChild(win);
    if (typeof window.makeDraggable === 'function') window.makeDraggable(win, document.getElementById(winId + '_hdr'));
    else if (typeof window.apxMakeDraggable === 'function') window.apxMakeDraggable(win, document.getElementById(winId + '_hdr'));
};
window._gmPlayerPowersHtml = function(st, hdr, uid, mods, compact) {
    if (!st) return '';
    let perks = st.perks || {}, used = st.usedPowerSlots || {};
    let fx = {}; try { fx = (window.apxItemEffects ? window.apxItemEffects(st).stat : {}) || {}; } catch (e) { }
    let pips = (max, u) => Array.from({ length: max }, (_, i) => `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:2px;border:1px solid #a78bfa;background:${i < max - u ? '#8b5cf6' : 'transparent'}"></span>`).join('');
    let rows = [];
    let ranks = st.pwrIntRanks || {};
    let per = { 1: 3, 2: 2, 3: 2, 4: 1, 5: 1 };
    for (let L = 1; L <= 5; L++) {
        let max = Math.max(0, per[L] * (ranks[L] || 0) + (fx['slot_' + L] || 0));
        if (max) { let u = Math.min(max, used[L] || 0); rows.push(`<div style="display:flex;align-items:center;gap:.4rem;font-size:.6rem;color:#cbd5e1"><span style="width:62px;color:#93c5fd;font-weight:800">Full L${L}</span>${pips(max, u)}<span style="color:#94a3b8">${max - u}/${max}</span></div>`); }
    }
    let cmax = Math.max(0, (perks.pwr_cha || 0) + (fx.slot_CHA || 0));
    if (cmax) { let u = Math.min(cmax, used.CHA || 0); rows.push(`<div style="display:flex;align-items:center;gap:.4rem;font-size:.6rem;color:#cbd5e1"><span style="width:62px;color:#fcd34d;font-weight:800">Short Rest</span>${pips(cmax, u)}<span style="color:#94a3b8">${cmax - u}/${cmax}${(perks.pwr_cha || 0) >= 5 ? ' · L1 free' : ''}</span></div>`); }
    let u = String(uid || '').replace(/'/g, '');
    let powers = (st.powers || []).map((p, i) => `<div style="border:1px solid #4c1d95;border-radius:.3rem;padding:.3rem .4rem;margin:.2rem 0;background:rgba(76,29,149,.12)">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:.3rem">
            <span ${u ? `onclick="window._gmPlayerPowerPopup('${u}', ${i})" title="Open this power in its own window"` : ''} style="font-weight:900;font-size:.66rem;color:#d8b4fe;${u ? 'cursor:pointer;text-decoration:underline dotted;text-underline-offset:2px' : ''}">${String(p.name || 'Power').replace(/</g, '&lt;')}</span>
            <span style="font-size:.56rem;color:#94a3b8;white-space:nowrap">Lvl ${p.lvl} | ${window.apxPowerApLabel ? window.apxPowerApLabel(p) : p.ap + ' AP'}</span></div>
        ${compact ? '' : _gmPlayerPowerCard(p, st, mods, false)}</div>`);
    // Powers from Ancestry Traits (Discharging Internals)
    (st.traitPowers || []).forEach(p => powers.push(`<div style="border:1px solid #92400e;border-radius:.3rem;padding:.3rem .4rem;margin:.2rem 0;background:rgba(146,64,14,.12)">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:.3rem"><span style="font-weight:900;font-size:.66rem;color:#fdba74">${String(p.name || 'Power').replace(/</g, '&lt;')}</span>
        <span style="font-size:.56rem;color:#94a3b8;white-space:nowrap">Trait | ${p.ap} AP · ${Math.max(0, (p.usesMax || 1) - (p.used || 0))}/${p.usesMax || 1} per Short Rest</span></div>
        ${compact ? '' : `<div style="font-size:.6rem;color:#cbd5e1">${String(p.desc || '').replace(/</g, '&lt;')}</div>`}</div>`));
    if (!rows.length && !powers.length) return '';
    return (hdr ? hdr('Powers') : '<div style="font-weight:900;font-size:.6rem">Powers</div>')
        + (rows.length ? `<div style="display:flex;flex-direction:column;gap:2px;padding:.15rem 0">${rows.join('')}</div>` : '')
        + (powers.length ? `<div style="padding:0.15rem 0">${powers.join('')}</div>` : '');
};
window.renderInitiativeTracker = function() {
    let body = document.getElementById('initiativeTrackerBody');
    if (!body) return;
    _gmCombatSaveSoon();   // every change to the fight is saved with the world (a session can end mid-combat)
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
    // Don't redraw the list under a box the GM is typing in (a player's sheet saving, a roll arriving…):
    // that would throw away what they typed, and a "-0" would vanish without a trace. Redraw once they're done.
    if (!body._apxGuard) {
        body._apxGuard = true;
        body.addEventListener('change', e => { if (e.target) e.target._apxCommitted = true; }, true);
        body.addEventListener('focusout', () => { if (body._apxDeferred) { body._apxDeferred = false; setTimeout(() => window.renderInitiativeTracker(), 0); } });
    }
    let typing = document.activeElement;
    if (typing && body.contains(typing) && typing.tagName === 'INPUT' && typing.type !== 'checkbox' && !typing._apxCommitted && typing.value !== typing.defaultValue) {
        body._apxDeferred = true;
        return;
    }
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
                    <input type="text" value="${e.currentHp}" onfocus="this.select()" onkeydown="if(event.key==='Enter')this.blur()" onchange="window.updateInitiativeHp('${e.id}', this.value)" title="Type a number to set HP, or +N/-N to heal/damage" class="w-12 text-center bg-slate-800 border-red-800/50 text-red-300 text-xs font-bold">
                    <span class="text-[10px] text-slate-500">/ ${e.maxHp}</span>
                ` : '<span class="text-[9px] text-slate-600 w-20 text-center">no HP tracked</span>'}
                <button onclick="window.removeFromInitiative('${e.id}')" class="text-red-500 hover:text-red-400 font-bold text-xs">&times;</button>
            </div>
            <div class="pl-6 mt-1 space-y-0.5">
                <div class="flex items-center gap-2 flex-wrap text-[9px] ${fs.text} opacity-90">
                    <span>${fs.label}</span>
                    ${e.ap !== undefined && e.ap !== null ? gmApPipsHtml(e) : ''}
                    ${(e.ac !== undefined && e.ac !== null) ? `<span>AC <b class="text-white">${e.ac}</b></span>` : ''}
                    ${e.faction !== 'player' && !e.companionOf ? (() => { let wt = _gmNpcWt(e); return wt != null ? `<span title="Wound Threshold: a single hit of more damage than this (after DR/ER) calls for a CON save or a limb is Wounded">WT <b class="text-white">${wt}</b></span>` : ''; })() : ''}
                    ${(() => {
                        // The DR and ER damage is actually reduced by (live: stat block, the player's own sheet…)
                        let d = _gmDefenseOf(e), tip = `Damage typed as "-N" is reduced by these. ${_gmDefText(d)} (from ${d.src || 'tracker'})`.replace(/"/g, '&quot;');
                        if (d.src === 'tracker' && !e.companionOf) return `<span title="${tip}">DR <input type="text" value="${d.dr}" onchange="window.setInitiativeDef('${e.id}','dr',this.value)" class="w-6 text-center bg-slate-800 border-slate-600 text-white text-[9px] font-bold px-0"></span>
                            <span title="${tip}">ER <input type="text" value="${d.er}" onchange="window.setInitiativeDef('${e.id}','er',this.value)" class="w-6 text-center bg-slate-800 border-slate-600 text-white text-[9px] font-bold px-0"></span>`;
                        let extra = Object.keys(d.res || {}).length + (d.immune || []).length;
                        return `<span title="${tip}">DR <b class="text-white">${d.dr}</b></span><span title="${tip}">ER <b class="text-white">${d.er}</b>${extra ? '<b class="text-cyan-300">*</b>' : ''}</span>`;
                    })()}
                    ${e.maxHp !== null ? `
                        <span class="flex items-center gap-1 text-cyan-400">Temp
                            <input type="text" value="${e.tempHp || 0}" onfocus="this.select()" onkeydown="if(event.key==='Enter')this.blur()" onchange="window.setInitiativeTempHp('${e.id}', this.value)" title="Type a number to set Temp HP, or +N/-N to adjust" class="w-8 text-center bg-slate-800 border-cyan-800/50 text-cyan-300 text-[9px] font-bold px-0.5">
                        </span>
                    ` : ''}
                </div>
                ${e.lairTraitNote ? `<div class="text-[9px] text-amber-400 font-bold">${e.lairTraitNote}</div>` : ''}
                ${e.lastHit && Date.now() - e.lastHit.t < 1800000 ? `<div class="text-[9px] text-rose-300/90 font-bold truncate" title="${String(e.lastHit.text).replace(/"/g, '&quot;')}">Last hit: ${String(e.lastHit.text).replace(/</g, '&lt;')}</div>` : ''}
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
                ${e.faction === 'player' && e.playerUid ? (() => {
                    // Players' conditions: shown and changed here like an NPC's (synced to their sheet)
                    let pm = (window.gmParty || []).find(p => p.fileName === e.playerUid);
                    let conds = _gmPlayerCondList(e).filter(c => c !== 'bleedingout' || e.bleedOutTurns != null || (window._gmCondPending[e.playerUid] || {}).bleedingout);
                    let nm = id => window._gmCondName ? window._gmCondName(id) : id;
                    let eff = window.apxEffectiveConditions ? window.apxEffectiveConditions(conds) : conds.map(id => ({ id }));
                    return `<div class="flex items-center gap-1 flex-wrap">
                        ${eff.map(c => c.from
                            ? `<span class="apx-cond-chip" style="border-style:dashed;opacity:.8" title="From ${nm(c.from)}">${nm(c.id)}</span>`
                            : `<span class="apx-cond-chip" title="Click × to remove (their sheet updates)">${nm(c.id)}<button onclick="window._gmTogglePlayerCond('${e.id}','${c.id}',false)">&times;</button></span>`).join('')}
                        <button onclick="window._gmPlayerCondPicker('${e.id}', event)" class="text-[9px] font-bold text-orange-300 hover:text-orange-200">+ Condition</button>
                    </div>`;
                })() : ''}
                ${(e.wounds || []).length ? `<div class="flex items-center gap-1 flex-wrap">${e.wounds.map(l => `<span class="apx-cond-chip" style="border-color:#f87171;color:#fecaca" title="${String(_gmWoundEffect(l)).replace(/"/g, '&quot;')} Click × when it heals.">${l} Wound<button onclick="window._gmHealNpcWound('${e.id}','${l.replace(/'/g, '')}')">&times;</button></span>`).join('')}</div>` : ''}
                ${_gmMythicHtml(e)}
                ${_gmPowerFxHtml(e)}
                ${e.sourceNpcId ? renderInitiativePowerBubbles(e) : ''}
                ${isCurrent ? '<div class="text-[9px] text-amber-300 font-bold">Current Turn</div>' : ''}
                <div class="flex items-center gap-3">
                    <label class="flex items-center gap-1 text-[9px] text-slate-400">
                        <input type="checkbox" ${e.surprised ? 'checked' : ''} onchange="window.toggleSurprised('${e.id}', this.checked)" title="-10 initiative, and gains only 1 AP at the start of its first turn"> Surprised (-10)
                    </label>
                    ${e.maxHp !== null ? `<button onclick="window.gmFallDamage('${e.id}')" class="text-[9px] font-bold text-sky-300 hover:text-sky-200" title="Fall damage: 1d10 per square after the first, softened by an Acrobatics Reaction; any damage knocks it Prone">⤓ Fall</button>` : ''}
                </div>
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
        if (window.apxFront) window.apxFront(window.gmFloatingWindows[entryId]);   // (also brings back a minimized one)
        else { window.apxFloatingZTop++; window.gmFloatingWindows[entryId].style.zIndex = window.apxFloatingZTop; }
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
            <label>Date<input id="gxDate" type="date" value="${window.apxToday()}"></label>
            <div class="gx-full gx-radios"><span>Type</span>
                <label><input type="radio" name="gxCat" value="discovery" checked> Discovery</label>
                <label><input type="radio" name="gxCat" value="roleplay"> Role Play</label>
                <label title="Everyone's XP for showing up: 5 + INT"><input type="radio" name="gxCat" value="session"> Start Session</label>
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
    // Start Session: 5 XP (each sheet adds INT), named for the session, so it reads cleanly in the log
    back.querySelectorAll('input[name="gxCat"]').forEach(rb => rb.addEventListener('change', () => {
        let nm = back.querySelector('#gxName');
        if (cat() === 'session') {
            back.querySelector('#gxAmt').value = 5;
            if (!nm.value.trim() || nm.dataset.auto) { nm.value = `Session ${back.querySelector('#gxSession').value || sessions || 1}`; nm.dataset.auto = '1'; }
            let d = back.querySelector('#gxDesc'); if (!d.value.trim()) { d.value = 'Start of session XP (5 + INT).'; d.dataset.auto = '1'; }
        } else {
            if (nm.dataset.auto) { nm.value = ''; delete nm.dataset.auto; }
            let d = back.querySelector('#gxDesc'); if (d.dataset.auto) { d.value = ''; delete d.dataset.auto; }
        }
        preview();
    }));
    back.querySelector('#gxSession').addEventListener('input', () => { let nm = back.querySelector('#gxName'); if (nm.dataset.auto) nm.value = `Session ${back.querySelector('#gxSession').value || 1}`; });
    back.querySelector('#gxName').addEventListener('input', e => { delete e.target.dataset.auto; });
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
