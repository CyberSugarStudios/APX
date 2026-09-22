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

    // Custom equippable items contribute AC/DR/ER/speed/skill/attribute bonuses
    let customAc=0, customDr=0, customEr=0;
    (state.items||[]).forEach(item => {
        if (!(item.isCustomEquippable && item.equipped && item.bonuses)) return;
        let b = item.bonuses;
        customAc += (b.ac||0); customDr += (b.dr||0); customEr += (b.er||0);
        if (b.speedBonus) calc.speed += b.speedBonus;
        (b.attrBonuses||[]).forEach(r => { if(calc.scores[r.target]!==undefined) calc.scores[r.target]+=(r.amount||0); });
        if (b.attrTarget && calc.scores[b.attrTarget]!==undefined) calc.scores[b.attrTarget]+=(b.attrBonus||0);
        (b.skillBonuses||[]).forEach(r => { if(r.target&&r.amount) calc.skills[r.target]=(calc.skills[r.target]||0)+r.amount; });
        if (b.skillTarget && b.skillBonus) calc.skills[b.skillTarget]=(calc.skills[b.skillTarget]||0)+b.skillBonus;
    });
    // Recalculate mods after any attribute bonuses from items
    ATTRIBUTES.forEach(a => { calc.mods[a] = calc.scores[a] - 5; });

    let vitalHpRank = (state.perks || {})['con_vitality'] || 0;
    let maxHp = Math.max(5, (calc.scores.CON * 5) + (vitalHpRank * 5) + (state.xpHpBought || 0) - calc.maxHpPenalty);

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

    let allowedAgi;
    if (isHeavy) allowedAgi = 0;
    else if (calc.mods.AGI < 0) allowedAgi = calc.mods.AGI;
    else allowedAgi = Math.min(calc.mods.AGI, agiCap);

    if (amRank >= 2 && amMatchesChoice) { calc.ac += 1; calc.dr += 1; }
    if (amRank >= 3 && armorClass !== null) calc.speed += 1;
    if (amRank >= 5 && amMatchesChoice && amChoice === 'Heavily') calc.dr += 3;

    if (armorWt === 0 && (state.perks || {})["con_defensive"]) {
        calc.ac += calc.mods.CON;
        calc.ac += state.perks["con_defensive"];
        calc.dr += state.perks["con_defensive"];
        calc.er += state.perks["con_defensive"];
    }
    if (calc.lucAc) calc.ac += Math.max(1, calc.mods.LUC);

    calc.ac += allowedAgi + armorAc;
    calc.dr += Math.max(0, calc.mods.CON) + armorDr;
    let baseErMods = [calc.mods.AGI, calc.mods.PER, calc.mods.INT, calc.mods.CHA, calc.mods.LUC].map(v => Math.max(v, 0));
    calc.er += Math.max(...baseErMods) + armorEr;

    let tirelessRank = (state.perks || {})['gen_tireless'] || 0;
    let effectiveFatigue = Math.max(0, (state.fatigue || 0) - tirelessRank);
    calc.maxAp = calc.apForcedZero ? 0 : Math.max(6, 6 + calc.mods.AGI) - effectiveFatigue;

    // Passive Initiative (Ch.9): 10 + chosen AGI-or-PER modifier, plus
    // whatever flat bonuses perks like Twitchy already added to calc.init
    // via the generic effect loop above. Mirrors the character sheet's
    // own formula exactly (including that Tactical Mind's useIntInit flag
    // isn't actually consulted here -- that's the main sheet's existing
    // behavior, not something introduced for this summary).
    let initiative = 10 + (calc.mods[state.initStat] || 0) + (calc.init - 10);

    let dispSpeed = calc.speedForcedZero ? 0 : Math.max(0, calc.speed);

    let saves = {};
    ATTRIBUTES.forEach(a => {
        let trained = !!(state.savesTrained && state.savesTrained[a]);
        saves[a] = calc.mods[a] + (trained ? (state.trainingBonus || 2) : 0);
    });

    let trainedSkills = SKILLS.filter(s => state.skillsTrained && state.skillsTrained[s.id]).map(s => {
        let perkBonus = calc.skills[s.id] || 0;
        if (s.name === 'Notice' && calc.skills['Notice']) perkBonus = calc.skills['Notice'];
        return { name: s.name, total: calc.mods[s.attr] + (state.trainingBonus || 2) + perkBonus };
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
                        // Player's own sheet took them to 0 → start bleeding out (not dead)
                        if (wasUp && newHp <= 0 && e.faction === 'player' && e.bleedOutTurns == null) {
                            setTimeout(() => window.openBleedOutModal(e.id), 0);
                        }
                        if (newHp > 0) { e.bleedOutTurns = null; e.stabilized = false; }
                        e.currentHp = newHp;
                        e.tempHp    = newTempHp;
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

window.renderGmScreen = function() {
    let body = document.getElementById('gmScreenBody');
    if (!body) return;
    if (!window.gmParty.length) {
        body.innerHTML = '<div class="text-xs text-slate-500 text-center py-6">No party loaded yet. Click "Load Party" to pull from the active world or load from exported files.</div>';
        return;
    }
    body.innerHTML = window.gmParty.map((p, idx) => {
        let s = p.summary;
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

window.addToInitiative = function(sourceIdx, sourceType, faction, displayName) {
    let entry;
    if (sourceType === 'party') {
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
        entry = { id: crypto.randomUUID(), name: entryName, baseInitiative: sb.initiative, surprised: false, currentHp: sb.currentHp, maxHp: sb.maxHp, tempHp: 0, ap: sb.ap, ac: sb.ac, dr: sb.dr, er: sb.er, faction: resolvedFaction, bleedOutTurns: null, tpValue: window.npcXpForTier(npcTierForTP(n.npc.gmTpBudget || 0).tier), sourceNpcId: n.id, hasLairActions: !!n.npc.lairActions, lairTraitNote: null, powerUsage: {} };
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
let savedNpcSort = 'name';

window.openSavedNpcPickerModal = function() {
    savedNpcSort = 'name';
    document.getElementById('savedNpcSearch').value = '';
    window.renderSavedNpcPickerList();
    window.openModal('savedNpcPickerModal');
};

window.setSavedNpcSort = function(mode) {
    savedNpcSort = mode;
    window.renderSavedNpcPickerList();
};

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
    rows.sort(sortFns[savedNpcSort] || sortFns.name);

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
    if (opts?.dead) { if (typeof window._gmMarkTokenDead === 'function') window._gmMarkTokenDead(id); }
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

// Shared after-change handling: 0 HP → bleed out (players) / killed (NPCs); healed → clear bleed-out
function _afterHpChange(entry, wasAboveZero) {
    if (entry.currentHp !== null && entry.currentHp <= 0 && wasAboveZero) {
        if (entry.faction === 'player') {
            _syncHpToPlayer(entry);
            window.openBleedOutModal(entry.id);
        } else {
            window.gmPendingXp += (entry.tpValue || 0);
            window.removeFromInitiative(entry.id, { dead: true });
            return;
        }
    } else if (entry.currentHp > 0) {
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

// Temp HP box: typed value sets Temp HP; a negative result overflows into HP.
window.setInitiativeTempHp = function(id, value) {
    let entry = window.gmInitiative.find(e => e.id === id);
    if (!entry) return;
    let result = window.parseMathExpression(value, entry.tempHp || 0);
    if (result === null) { window.renderInitiativeTracker(); return; }
    let wasAboveZero = entry.currentHp === null || entry.currentHp > 0;
    if (result < 0) {
        let r = window.apxApplyHpInput(String(result), entry.currentHp, 0, entry.maxHp);
        entry.tempHp = 0;
        if (r) entry.currentHp = r.currentHp;
    } else {
        entry.tempHp = result;
    }
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
    entry.currentHp = r.currentHp;
    entry.tempHp = r.tempHp;
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
    document.getElementById('bleedOutModalName').innerText = `${entry.name} has dropped to 0 HP.`;
    document.getElementById('bleedOutTurnsInput').value = '';
    document.getElementById('bleedOutModal').dataset.entryId = id;
    window.openModal('bleedOutModal');
};

window.confirmBleedOut = function() {
    let id = document.getElementById('bleedOutModal').dataset.entryId;
    let entry = window.gmInitiative.find(e => e.id === id);
    let turns = parseInt(document.getElementById('bleedOutTurnsInput').value);
    if (entry && !isNaN(turns) && turns > 0) entry.bleedOutTurns = turns;
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
window.endCombat = function() {
    // XP is split evenly between EVERY survivor on the party's side: players and allies.
    // Anyone still in the tracker is alive (the dead are removed), including players
    // who are bleeding out. Allies take a share but, being NPCs, their share isn't paid out.
    let survivors = window.gmInitiative.filter(e => e.faction === 'player' || e.faction === 'ally');
    let players   = survivors.filter(e => e.faction === 'player');
    let allyCount = survivors.length - players.length;
    let totalXp = window.gmPendingXp;
    let perPlayer = survivors.length > 0 ? Math.floor(totalXp / survivors.length) : 0;
    let split = `${players.length} player${players.length===1?'':'s'}${allyCount ? ` + ${allyCount} all${allyCount===1?'y':'ies'}` : ''}`;
    let message = survivors.length > 0
        ? `Combat ended. ${totalXp} XP earned — ${perPlayer} XP each, split between ${split}.`
        : `Combat ended. ${totalXp} XP earned, but no surviving players or allies to split it.`;
    window.showConfirm(message, () => {
        // Distribute XP to each surviving player via their initiative entry
        if (perPlayer > 0) {
            let worlds = typeof _gmWorlds !== 'undefined' ? _gmWorlds : [];
            let activeWorld = worlds.find(w => (w.worldId||w.id) === (typeof _activeWorldId !== 'undefined' ? _activeWorldId : null));
            let inviteCode = activeWorld?.inviteCode;
            players.filter(e => e.playerUid).forEach(e => {
                if (inviteCode && window.apxAuth?.enabled && typeof window.apxAuth.addXpToPlayer === 'function') {
                    window.apxAuth.addXpToPlayer(inviteCode, e.playerUid, perPlayer)
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
    window.renderInitiativeTracker();
    if (typeof window._btRefreshAllOpenMaps === 'function') window._btRefreshAllOpenMaps();
    if (typeof window.saveWorldNotes === 'function') window.saveWorldNotes();
};

window.nextInitiativeTurn = function() {
    if (!window.gmInitiative.length) return;
    window.gmCurrentTurnIdx++;
    if (window.gmCurrentTurnIdx >= window.gmInitiative.length) {
        window.gmCurrentTurnIdx = 0;
        window.gmRoundNumber++;
    }
    window.gmTurnNumber++;
    let current = window.gmInitiative[window.gmCurrentTurnIdx];
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
                <span class="flex-1 text-xs font-bold ${isCurrent ? 'text-amber-300' : fs.text} ${e.faction !== 'player' ? 'cursor-pointer hover:underline' : ''}" ${e.faction !== 'player' ? `onclick="window.openFloatingStatBlock('${e.id}')" title="Click for full stat block"` : ''}>${e.name}</span>
                ${e.maxHp !== null ? `
                    <input type="text" value="${e.currentHp}" onchange="window.updateInitiativeHp('${e.id}', this.value)" title="Type a number to set HP, or +N/-N to heal/damage" class="w-12 text-center bg-slate-800 border-red-800/50 text-red-300 text-xs font-bold">
                    <span class="text-[10px] text-slate-500">/ ${e.maxHp}</span>
                ` : '<span class="text-[9px] text-slate-600 w-20 text-center">no HP tracked</span>'}
                <button onclick="window.removeFromInitiative('${e.id}')" class="text-red-500 hover:text-red-400 font-bold text-xs">&times;</button>
            </div>
            <div class="pl-6 mt-1 space-y-0.5">
                <div class="flex items-center gap-2 flex-wrap text-[9px] ${fs.text} opacity-90">
                    <span>${fs.label}${e.ap !== undefined && e.ap !== null ? ` &middot; AP ${e.ap}` : ''}</span>
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
                ${e.sourceNpcId ? renderInitiativePowerBubbles(e) : ''}
                ${isCurrent ? '<div class="text-[9px] text-amber-300 font-bold">Current Turn</div>' : ''}
                <label class="flex items-center gap-1 text-[9px] text-slate-400">
                    <input type="checkbox" ${e.surprised ? 'checked' : ''} onchange="window.toggleSurprised('${e.id}', this.checked)"> Surprised (-10)
                </label>
                ${e.bleedOutTurns !== null && e.bleedOutTurns !== undefined ? `
                    <div class="text-[9px] text-red-400 font-bold flex items-center gap-1">
                        Bleeding Out:
                        <button onclick="window.adjustBleedOutTurns('${e.id}', -2)" class="px-1 bg-red-900 hover:bg-red-800 rounded text-white font-black leading-none" title="Crit hit: -2 turns">-2</button>
                        <button onclick="window.adjustBleedOutTurns('${e.id}', -1)" class="px-1 bg-red-900 hover:bg-red-800 rounded text-white font-black leading-none" title="Hit: -1 turn">-1</button>
                        <span class="text-red-300 font-black mx-0.5">${e.bleedOutTurns}</span>
                        <button onclick="window.adjustBleedOutTurns('${e.id}', +1)" class="px-1 bg-slate-700 hover:bg-slate-600 rounded text-white font-black leading-none" title="+1 turn">+1</button>
                        <button onclick="window.stabilizeEntry('${e.id}')" class="ml-1 underline hover:text-red-300">Stabilize</button>
                    </div>
                ` : ''}
                ${(e.faction !== 'player' && e.sourceNpcId) ? (() => {
                    // Show +Token button if this NPC doesn't have a battle token on any open map
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
