// ----------------------------------------------------------------
// APX Firebase Auth + Cloud Sync
// ----------------------------------------------------------------
// Handles sign-in/sign-up/sign-out, and bi-directional Firestore
// sync for characters and GM race templates. Requires Firebase SDK
// (loaded via CDN in the HTML) and a filled-in firebase-config.js.
//
// When FIREBASE_ENABLED is false (the default until you add your
// credentials), everything in this file is a no-op and the app
// behaves exactly as the local-JSON version always did.
// ----------------------------------------------------------------

(function () {
    if (!window.FIREBASE_ENABLED) {
        window.apxAuth = { user: null, enabled: false,
            signIn: () => {}, signUp: () => {}, signOut: () => {},
            onAuthChange: () => {}, saveCharacter: () => Promise.resolve(),
            loadCharacters: () => Promise.resolve([]), saveGmRaces: () => Promise.resolve(),
            loadGmRaces: () => Promise.resolve([]), saveGmNpcs: () => Promise.resolve(),
            loadGmNpcs: () => Promise.resolve([]), getShareCode: () => null,
            connectToGm: () => Promise.resolve([],),
            loadFolders: () => Promise.resolve([]), saveFolder: () => Promise.resolve(),
            deleteFolder: () => Promise.resolve(),
            createWorld: () => Promise.resolve(null), loadWorlds: () => Promise.resolve([]),
            saveWorld: () => Promise.resolve(), saveWorldRaces: () => Promise.resolve(),
            saveRacesToAllWorlds: () => Promise.resolve(), deleteWorld: () => Promise.resolve(), joinWorldByCode: () => Promise.resolve(null),
            loadWorldPlayers: () => Promise.resolve([]),
            listenWorldPlayers: () => (() => {}),
            listenPublicWorldNotes: () => (() => {}),
            kickWorldPlayer: () => Promise.resolve(),
            saveWorldMapFirestore: () => Promise.resolve(),
            loadWorldMapFirestore: () => Promise.resolve(null),
            deleteWorldMapFirestore: () => Promise.resolve(),
            savePublicWorldMap: () => Promise.resolve(),
            loadPublicWorldMap: () => Promise.resolve(null),
            loadWorldMapForPlayer: () => Promise.resolve(null),
            setGmHpOverride: () => Promise.resolve(),
            saveOtherMapImage: () => Promise.resolve(),
            loadOtherMapImage: () => Promise.resolve(null),
            loadOtherMapImageForPlayer: () => Promise.resolve(null),
            deleteOtherMapImage: () => Promise.resolve(),
            saveBattleImage: () => Promise.resolve(), loadBattleImage: () => Promise.resolve(null),
            setActiveCharId: () => {}, setGmCondition: () => Promise.resolve(),
            addXpGrant: () => Promise.resolve(), ackXpGrants: () => Promise.resolve(), addXpToPlayer: () => Promise.resolve(),
            loadBattleImageForPlayer: () => Promise.resolve(null), deleteBattleImage: () => Promise.resolve(),
            saveFogData: () => Promise.resolve(),
            loadFogData: () => Promise.resolve(null),
            loadFogDataForPlayer: () => Promise.resolve(null),
            writeBattlePosition: () => Promise.resolve(),
            listenBattlePositions: () => (() => {}) };
        return;
    }

    // Init Firebase
    firebase.initializeApp(window.FIREBASE_CONFIG);
    const auth = firebase.auth();
    const db   = firebase.firestore();
    // Never let a stray `undefined` anywhere in a payload kill a save.
    try { db.settings({ ignoreUndefinedProperties: true, merge: true }); } catch (e) { console.warn('Firestore settings:', e.message); }

    // Skip writes whose content hasn't changed since the last write to that document.
    // The sheet recalculates (and asks to save) very often; re-sending an identical
    // 100 KB+ character over and over is what filled Firestore's write queue
    // ("Write stream exhausted maximum allowed queued writes"), especially when a
    // browser blocker slows the connection.
    const _lastWrite = new Map();
    function _sameAsLast(key, data) {
        let sig;
        try { sig = JSON.stringify(data, (k, v) => (k === 'updatedAt' ? undefined : v)); } catch (e) { return false; }
        if (_lastWrite.get(key) === sig) return true;
        _lastWrite.set(key, sig);
        return false;
    }
    function _forgetWrite(key) { _lastWrite.delete(key); }

    // Deep-clean a plain-data object for Firestore: drops undefined / functions,
    // turns undefined array slots into null, and NaN/Infinity into 0.
    function apxClean(v) {
        if (v === undefined || typeof v === 'function' || typeof v === 'symbol') return undefined;
        if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
        if (v === null || typeof v !== 'object') return v;
        if (Array.isArray(v)) return v.map(x => { let c = apxClean(x); return c === undefined ? null : c; });
        if (v instanceof Date) return v;
        let proto = Object.getPrototypeOf(v);
        if (proto !== Object.prototype && proto !== null) return v; // Firestore sentinels, Timestamps, etc.
        let out = {};
        for (let k in v) {
            if (!Object.prototype.hasOwnProperty.call(v, k)) continue;
            let c = apxClean(v[k]);
            if (c !== undefined) out[k] = c;
        }
        return out;
    }
    window.apxCleanForFirestore = apxClean;
    window._apxDb = db; // expose for GMTools inline scripts that need cross-user reads

    // --- Auth helpers ---------------------------------------------------
    async function signIn(email, password) {
        return auth.signInWithEmailAndPassword(email, password);
    }
    async function signUp(email, password) {
        return auth.createUserWithEmailAndPassword(email, password);
    }
    async function signOut() {
        return auth.signOut();
    }
    function onAuthChange(cb) {
        auth.onAuthStateChanged(cb);
    }
    function currentUser() {
        return auth.currentUser;
    }
    // Returns display name if set, otherwise falls back to email prefix
    function getUserDisplay(user) {
        if (!user) return '';
        return user.displayName || user.email?.split('@')[0] || user.email || '';
    }
    window.apxGetUserDisplay = getUserDisplay;

    // --- Firestore helpers -----------------------------------------------
    // Data layout:
    //   users/{uid}/characters/{charId}  — one doc per character
    //   users/{uid}/gmRaces/{raceId}     — one doc per GM race template
    //   users/{uid}/profile              — { displayName, shareCode }

    async function saveCharacter(charId, stateObj, meta) {
        let user = currentUser();
        if (!user) return;
        stateObj = apxClean(stateObj) || {};
        if (meta) meta = apxClean(meta);
        let doc = {
            state: stateObj,
            name: stateObj.name || 'Unnamed Character',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (meta) Object.assign(doc, meta); // folderId, worldCode, etc.
        let ckey = 'char:' + user.uid + ':' + charId;
        if (!_sameAsLast(ckey, doc)) {
            try {
                await db.collection('users').doc(user.uid)
                    .collection('characters').doc(charId).set(doc, { merge: true });
            } catch (e) { _forgetWrite(ckey); throw e; }
        }

        // Sync character state into the world players sub-collection so the GM's
        // party panel can display live stats without needing cross-user Firestore access.
        let worldCode = meta?.worldCode || stateObj.worldCode;
        if (worldCode) {
            // The GM only needs the character, not the sheet's undo history
            let { _undoStack, _redoStack, ...pub } = stateObj;
            let wdoc = { uid: user.uid, charName: (stateObj.name || 'Unknown Player').slice(0, 60), charState: pub,
                         updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
            let wkey = 'wplayer:' + worldCode + ':' + user.uid;
            if (!_sameAsLast(wkey, wdoc)) {
                await db.collection('worldCodes').doc(worldCode)
                    .collection('players').doc(user.uid).set(wdoc, { merge: true })
                    .catch(e => { _forgetWrite(wkey); console.warn('World char sync:', e.message); });
            }
        }
    }

    async function loadCharacters() {
        let user = currentUser();
        if (!user) return [];
        let snap = await db.collection('users').doc(user.uid)
            .collection('characters').orderBy('updatedAt', 'desc').get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    async function deleteCharacter(charId) {
        let user = currentUser();
        if (!user) return;
        await db.collection('users').doc(user.uid)
            .collection('characters').doc(charId).delete();
    }

    // Folders: simple name-keyed collection
    async function loadFolders() {
        let user = currentUser();
        if (!user) return [];
        let snap = await db.collection('users').doc(user.uid)
            .collection('folders').orderBy('createdAt').get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    async function saveFolder(folderId, name, extra) {
        let user = currentUser();
        if (!user) return;
        let data = { name, createdAt: firebase.firestore.FieldValue.serverTimestamp() };
        if (extra) Object.assign(data, extra); // worldCode, worldName, etc.
        await db.collection('users').doc(user.uid).collection('folders').doc(folderId).set(data, { merge: true });
    }

    async function deleteFolder(folderId) {
        let user = currentUser();
        if (!user) return;
        await db.collection('users').doc(user.uid).collection('folders').doc(folderId).delete();
    }

    async function saveGmRaces(racesArray) {
        let user = currentUser();
        if (!user) return;
        await db.collection('users').doc(user.uid).collection('gmRaces').doc('all')
            .set({ races: apxClean(racesArray) || [], updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    }
    async function loadGmRaces() {
        let user = currentUser();
        if (!user) return [];
        let doc = await db.collection('users').doc(user.uid).collection('gmRaces').doc('all').get();
        return doc.exists ? (doc.data().races || []) : [];
    }
    async function saveGmNpcs(npcsArray) {
        let user = currentUser();
        if (!user) return;
        await db.collection('users').doc(user.uid).collection('gmNpcs').doc('all')
            .set({ npcs: apxClean(npcsArray) || [], updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    }
    async function loadGmNpcs() {
        let user = currentUser();
        if (!user) return [];
        let doc = await db.collection('users').doc(user.uid).collection('gmNpcs').doc('all').get();
        return doc.exists ? (doc.data().npcs || []) : [];
    }

    // --- World system ---------------------------------------------------
    // Layout:
    //   users/{uid}/worlds/{worldId}  -- GM-only private world data
    //   worldCodes/{inviteCode}       -- public: gmUid, worldId, races, publicNotes
    //
    // CRITICAL: players cannot read users/{otherUid}/... due to Firestore rules.
    // All data that players need (races, locations, NPCs) is stored on the
    // worldCodes document, which any signed-in user can read. The GM-only
    // data (session notes, GM secrets) stays in users/{uid}/worlds/.

    function generateInviteCode() {
        let chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
        return code;
    }

    async function createWorld(name) {
        let user = currentUser();
        if (!user) return null;
        let worldId = 'world_' + Date.now();
        let inviteCode = generateInviteCode();
        // Private GM data
        let worldData = { name, inviteCode, notesV2: null, createdAt: firebase.firestore.FieldValue.serverTimestamp() };
        await db.collection('users').doc(user.uid).collection('worlds').doc(worldId).set(worldData);
        // Public data (readable by players)
        await db.collection('worldCodes').doc(inviteCode).set({ gmUid: user.uid, worldId, worldName: name, races: [], publicNotes: {} });
        return { worldId, inviteCode, ...worldData };
    }

    async function loadWorlds() {
        let user = currentUser();
        if (!user) return [];
        let snap = await db.collection('users').doc(user.uid).collection('worlds').get();
        return snap.docs.map(d => ({ id: d.id, worldId: d.id, ...d.data() }));
    }

    // --- World map images via Firestore sub-document --------------------
    // Stores the compressed map image in its own dedicated document so it
    // never counts against the 1 MB limit of the main world document.
    //
    // Path: users/{uid}/worlds/{worldId}/mapImage/data
    //
    // The existing Firestore rule  match /users/{userId}/{document=**}
    // already covers this path — no rule changes required.
    // Works on the Spark (free) plan. No Firebase Storage / Blaze needed.

    // --- Public world map (readable by all players in the world) -----------
    // Stored at: worldCodes/{inviteCode}/mapImage/data
    // Players can read worldCodes sub-collections (see FIREBASE_RULES.txt).
    // The GM writes here when uploading a map; players load from here.

    // --- Real-time listener for player characters in a world ----------------
    // Returns an unsubscribe function. Call it to stop receiving updates.
    // Real-time listener on a world's public notes so the player's world
    // tab updates live as the GM reveals locations, NPCs, notes, and pins.
    function listenPublicWorldNotes(inviteCode, callback) {
        if (!inviteCode) return () => {};
        return db.collection('worldCodes').doc(inviteCode.toUpperCase().trim())
            .onSnapshot(snap => {
                if (snap.exists) callback(snap.data());
            }, err => console.warn('World notes listener:', err.message));
    }

    function listenWorldPlayers(inviteCode, callback) {
        if (!inviteCode) return () => {};
        return db.collection('worldCodes').doc(inviteCode.toUpperCase().trim())
            .collection('players').onSnapshot(snap => {
                callback(snap.docs.map(d => d.data()));
            }, err => console.warn('Party listener error:', err.message));
    }

    // --- loadWorldMapForPlayer: read the GM's map image DIRECTLY using gmUid + worldId ----
    // This is the same path the GM reads from — users/{gmUid}/worlds/{worldId}/mapImage/data.
    // Players know gmUid and worldId from their connected-worlds localStorage after joining.
    // A Firestore rule override allows any authenticated user to READ map images
    // (see FIREBASE_RULES.txt: match /users/{userId}/worlds/{worldId}/mapImage/{docId}).
    // Because the path requires the specific gmUid + worldId (not guessable without the invite
    // code), this is acceptable for a party TTRPG tool.
    async function loadWorldMapForPlayer(gmUid, worldId) {
        if (!gmUid || !worldId) return null;
        let snap = await db.collection('users').doc(gmUid)
            .collection('worlds').doc(worldId)
            .collection('mapImage').doc('data').get();
        return snap.exists ? (snap.data().imageData || null) : null;
    }

    // addXpToPlayer: adds XP to a player's unspent XP via their world record
    // XP grants are queued per player (_xpGrants.{grantId}) so several grants in a row
    // are never lost. The player's sheet adds its own bonuses (Educated, Expertise…),
    // logs the grant, then removes it from the queue (ackXpGrants).
    async function addXpGrant(inviteCode, playerUid, grant) {
        if (!inviteCode || !playerUid || !grant || !grant.amount) return;
        let id = grant.id || ('xp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));
        let g = apxClean(Object.assign({}, grant, { id }));
        g.at = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('worldCodes').doc(inviteCode)
            .collection('players').doc(playerUid)
            .set({ _xpGrants: { [id]: g } }, { merge: true });
    }
    async function addXpToPlayer(inviteCode, playerUid, xp, meta) {
        if (!inviteCode || !playerUid || !xp) return;
        return addXpGrant(inviteCode, playerUid, Object.assign({ amount: xp, category: 'combat', name: 'Combat' }, meta || {}));
    }
    async function ackXpGrants(inviteCode, ids) {
        let user = currentUser(); if (!user || !inviteCode || !ids || !ids.length) return;
        let upd = {};
        ids.forEach(id => { upd['_xpGrants.' + id] = firebase.firestore.FieldValue.delete(); });
        await db.collection('worldCodes').doc(inviteCode).collection('players').doc(user.uid).update(upd).catch(() => {});
    }

    // --- Battle-map PLAYER token positions --------------------------------
    // Single source of truth for where a player's token is:
    //   worldCodes/{inviteCode}/players/{playerUid}  →  battlePositions.{mapId}.{tokenId} = {gridX, gridY, by, at}
    // The owning player AND the GM both write this exact field (rules allow both),
    // and both listen to it, so the last move made by either side shows on every screen.
    //
    // NOTE: uses update() with a FieldPath. The old code used set({'a.b.c': v}, {merge:true}),
    // which Firestore stores as ONE literal field literally named "battlePositions.map.tok" —
    // nobody ever read that field, which is why moves stopped syncing.
    async function writeBattlePosition(inviteCode, playerUid, mapId, tokenId, gridX, gridY) {
        let user = currentUser();
        if (!user || !inviteCode || !playerUid || !mapId || !tokenId) return;
        let code = inviteCode.toUpperCase().trim();
        let ref = db.collection('worldCodes').doc(code).collection('players').doc(playerUid);
        let val = { gridX, gridY, by: user.uid, at: firebase.firestore.FieldValue.serverTimestamp() };
        try {
            await ref.update(new firebase.firestore.FieldPath('battlePositions', mapId, tokenId), val);
        } catch (e) {
            // Player's own doc missing (rare) → create it with a proper nested map.
            // The GM never creates a player doc (would add a phantom party member).
            if (e.code === 'not-found' && user.uid === playerUid) {
                await ref.set({ uid: user.uid, battlePositions: { [mapId]: { [tokenId]: val } } }, { merge: true });
            } else throw e;
        }
    }

    // Live listener on every player's battle positions in a world.
    // callback([{ uid, battlePositions, charPortrait }])
    function listenBattlePositions(inviteCode, callback) {
        if (!inviteCode) return () => {};
        return db.collection('worldCodes').doc(inviteCode.toUpperCase().trim())
            .collection('players').onSnapshot(snap => {
                callback(snap.docs.map(d => {
                    let data = d.data() || {};
                    let cs = data.charState || {};
                    return {
                        uid: data.uid || d.id,
                        outbox: data._outbox || {}, giftAcks: data._giftAcks || {},
                        battlePositions: data.battlePositions || {},
                        charPortrait: cs.charPortrait || '',
                        // Basic public info for the players' Party view (no stats)
                        profile: {
                            name: data.charName || cs.name || '',
                            portraitFull: cs.charPortraitFull || '',
                            ancestry: cs.ancestry?.name || '',
                            origin: cs.origin?.name || '',
                            age: cs.charAge || '',
                            size: cs.ancestry?.size || null,
                            companion: cs.companion ? { name: cs.companion.name || 'Companion', portrait: cs.companion.portrait || '', portraitFull: cs.companion.portraitFull || '', size: cs.companion.size || 'medium' } : null
                        }
                    };
                }));
            }, err => console.warn('Battle position listener:', err.message));
    }

    // Back-compat wrappers
    async function gmSetPlayerBattlePos(inviteCode, playerUid, mapId, tokenId, gridX, gridY) {
        return writeBattlePosition(inviteCode, playerUid, mapId, tokenId, gridX, gridY);
    }
    async function updatePlayerBattlePos(inviteCode, mapId, tokenId, gridX, gridY) {
        let user = currentUser(); if (!user) return;
        return writeBattlePosition(inviteCode, user.uid, mapId, tokenId, gridX, gridY);
    }

    // --- setGmHpOverride: GM writes HP + Temp HP that the player's charsheet listens for ---
    // Stored in worldCodes/{inviteCode}/players/{uid} as { _gmHp: { hp, tempHp, at } }.
    // The player never writes this field — only the GM does. Both sides compare _gmHp.at
    // with the doc's updatedAt (the player's last save) to know which value is newer.
    async function setGmHpOverride(inviteCode, uid, hp, tempHp) {
        if (!inviteCode || !uid) return;
        let v = { hp, at: firebase.firestore.FieldValue.serverTimestamp() };
        if (tempHp !== undefined && tempHp !== null) v.tempHp = tempHp;
        await db.collection('worldCodes').doc(inviteCode)
            .collection('players').doc(uid)
            .set({ _gmHp: v }, { merge: true });
    }

    // ── Loot and item transfers ──────────────────────────────────────────────
    // GM → player: queued gifts on the player's doc (_gmGifts.{id}), removed once applied.
    async function gmGiveToPlayer(inviteCode, uid, gift) {
        if (!inviteCode || !uid || !gift || !gift.id) return;
        await db.collection('worldCodes').doc(inviteCode.toUpperCase().trim()).collection('players').doc(uid)
            .set({ _gmGifts: { [gift.id]: apxClean(Object.assign({}, gift, { at: firebase.firestore.FieldValue.serverTimestamp() })) } }, { merge: true });
    }
    async function ackGmGifts(inviteCode, ids) {
        let user = currentUser(); if (!inviteCode || !user || !ids || !ids.length) return;
        let upd = {}; ids.forEach(id => { upd['_gmGifts.' + id] = firebase.firestore.FieldValue.delete(); });
        await db.collection('worldCodes').doc(inviteCode.toUpperCase().trim()).collection('players').doc(user.uid).update(upd).catch(() => {});
    }
    // Player → player: the giver lists it in their own _outbox; the receiver adds it and
    // writes _giftAcks.{id} on their own doc; the giver then clears the outbox entry.
    async function writeOutbox(inviteCode, entry) {
        let user = currentUser(); if (!inviteCode || !user || !entry || !entry.id) return;
        await db.collection('worldCodes').doc(inviteCode.toUpperCase().trim()).collection('players').doc(user.uid)
            .set({ _outbox: { [entry.id]: apxClean(entry) } }, { merge: true });
    }
    async function clearOutbox(inviteCode, ids) {
        let user = currentUser(); if (!inviteCode || !user || !ids || !ids.length) return;
        let upd = {}; ids.forEach(id => { upd['_outbox.' + id] = firebase.firestore.FieldValue.delete(); });
        await db.collection('worldCodes').doc(inviteCode.toUpperCase().trim()).collection('players').doc(user.uid).update(upd).catch(() => {});
    }
    async function ackGift(inviteCode, id) {
        let user = currentUser(); if (!inviteCode || !user || !id) return;
        await db.collection('worldCodes').doc(inviteCode.toUpperCase().trim()).collection('players').doc(user.uid)
            .set({ _giftAcks: { [id]: Date.now() } }, { merge: true });
    }
    // GM asks the party for a LUC (Loot) check
    async function publishLootRequest(inviteCode, req) {
        if (!inviteCode) return;
        await db.collection('worldCodes').doc(inviteCode.toUpperCase().trim()).set({ lootRequest: apxClean(req) }, { merge: true });
    }

    // GM sets a player's Loyal Companion HP (initiative tracker); the sheet applies it
    async function setGmCompanionHp(inviteCode, uid, hp) {
        if (!inviteCode || !uid) return;
        await db.collection('worldCodes').doc(inviteCode).collection('players').doc(uid)
            .set({ _gmCompHp: { hp, at: firebase.firestore.FieldValue.serverTimestamp() } }, { merge: true });
    }

    // GM turns a condition on/off on a player's sheet (e.g. Bleeding Out at 0 HP)
    async function setGmCondition(inviteCode, uid, condId, on) {
        if (!inviteCode || !uid || !condId) return;
        await db.collection('worldCodes').doc(inviteCode).collection('players').doc(uid)
            .set({ _gmConds: { [condId]: { on: !!on, at: firebase.firestore.FieldValue.serverTimestamp() } } }, { merge: true });
    }

    // --- Combat log ---------------------------------------------------------------
    // The GM publishes the shared combat log on the world's invite-code doc (players
    // already listen to it). Players post their own check/save rolls to their player
    // doc (_rollLog), which the GM already listens to. No new Firestore rules needed.
    async function publishCombatLog(inviteCode, entries, sessionId) {
        if (!inviteCode) return;
        await db.collection('worldCodes').doc(inviteCode.toUpperCase().trim())
            .set({ combatLog: { session: sessionId || null, entries: apxClean(entries || []), at: Date.now() } }, { merge: true });
    }
    async function writeRollLog(inviteCode, uid, entries) {
        if (!inviteCode || !uid) return;
        await db.collection('worldCodes').doc(inviteCode.toUpperCase().trim())
            .collection('players').doc(uid)
            .set({ _rollLog: apxClean(entries || []) }, { merge: true });
    }

    // --- NPC portraits (stored separately to keep world doc under 1MB limit) ---
    // Path: users/{uid}/worlds/{worldId}/npcPortraits/{npcId}
    async function saveNpcPortrait(worldId, npcId, circleData, fullData) {
        let user = currentUser(); if (!user) return;
        await db.collection('users').doc(user.uid)
            .collection('worlds').doc(worldId)
            .collection('npcPortraits').doc(npcId)
            .set({ portrait: circleData, portraitFull: fullData || circleData,
                   updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    }
    async function loadNpcPortrait(worldId, npcId) {
        let user = currentUser(); if (!user) return null;
        let snap = await db.collection('users').doc(user.uid)
            .collection('worlds').doc(worldId)
            .collection('npcPortraits').doc(npcId).get();
        return snap.exists ? snap.data() : null;
    }
    // Players load NPC portraits via the GM's user path (publicly readable by auth users per rules)
    async function loadNpcPortraitForPlayer(gmUid, worldId, npcId) {
        let snap = await db.collection('users').doc(gmUid)
            .collection('worlds').doc(worldId)
            .collection('npcPortraits').doc(npcId).get();
        return snap.exists ? snap.data() : null;
    }
    // Path: users/{uid}/worlds/{worldId}/otherMaps/{mapId}
    // Firestore rule allows any auth user to READ (for player loading).
    async function saveOtherMapImage(worldId, mapId, base64DataUrl) {
        let user = currentUser(); if (!user) return;
        await db.collection('users').doc(user.uid)
            .collection('worlds').doc(worldId)
            .collection('otherMaps').doc(mapId)
            .set({ imageData: base64DataUrl, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    }
    async function loadOtherMapImage(worldId, mapId) {
        let user = currentUser(); if (!user) return null;
        let snap = await db.collection('users').doc(user.uid)
            .collection('worlds').doc(worldId)
            .collection('otherMaps').doc(mapId).get();
        return snap.exists ? (snap.data().imageData || null) : null;
    }
    async function loadOtherMapImageForPlayer(gmUid, worldId, mapId) {
        if (!gmUid || !worldId || !mapId) return null;
        let snap = await db.collection('users').doc(gmUid)
            .collection('worlds').doc(worldId)
            .collection('otherMaps').doc(mapId).get();
        return snap.exists ? (snap.data().imageData || null) : null;
    }
    async function deleteOtherMapImage(worldId, mapId) {
        let user = currentUser(); if (!user) return;
        await db.collection('users').doc(user.uid)
            .collection('worlds').doc(worldId)
            .collection('otherMaps').doc(mapId).delete().catch(()=>{});
    }

    // Battle-map props (carts, tower floors, overlays): one image per document.
    // Path: users/{uid}/worlds/{worldId}/battleImages/{imgId} — players may READ.
    function _bimg(uid, worldId, imgId) {
        return db.collection('users').doc(uid).collection('worlds').doc(worldId).collection('battleImages').doc(imgId);
    }
    async function saveBattleImage(worldId, imgId, base64DataUrl) {
        let user = currentUser(); if (!user) return;
        await _bimg(user.uid, worldId, imgId).set({ imageData: base64DataUrl, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    }
    async function loadBattleImage(worldId, imgId) {
        let user = currentUser(); if (!user) return null;
        let snap = await _bimg(user.uid, worldId, imgId).get();
        return snap.exists ? (snap.data().imageData || null) : null;
    }
    async function loadBattleImageForPlayer(gmUid, worldId, imgId) {
        if (!gmUid || !worldId || !imgId) return null;
        let snap = await _bimg(gmUid, worldId, imgId).get();
        return snap.exists ? (snap.data().imageData || null) : null;
    }
    async function deleteBattleImage(worldId, imgId) {
        let user = currentUser(); if (!user) return;
        await _bimg(user.uid, worldId, imgId).delete().catch(() => {});
    }

    // --- Fog of War data storage ------------------------------------
    // Path: users/{uid}/worlds/{worldId}/fogData/{mapId}
    // mapId = 'worldmap' for the world map, or the other-map's ID.
    // Firestore rule allows any auth user to READ (for player loading).
    async function saveFogData(worldId, mapId, base64Png) {
        let user = currentUser(); if (!user) return;
        await db.collection('users').doc(user.uid)
            .collection('worlds').doc(worldId)
            .collection('fogData').doc(mapId)
            .set({ fogData: base64Png, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    }
    async function loadFogData(worldId, mapId) {
        let user = currentUser(); if (!user) return null;
        let snap = await db.collection('users').doc(user.uid)
            .collection('worlds').doc(worldId)
            .collection('fogData').doc(mapId).get();
        return snap.exists ? (snap.data().fogData || null) : null;
    }
    async function loadFogDataForPlayer(gmUid, worldId, mapId) {
        if (!gmUid || !worldId || !mapId) return null;
        let snap = await db.collection('users').doc(gmUid)
            .collection('worlds').doc(worldId)
            .collection('fogData').doc(mapId).get();
        return snap.exists ? (snap.data().fogData || null) : null;
    }

    // Real-time fog listener — fires whenever GM saves new fog state for a map.
    // Returns an unsubscribe function; call it when the Other Map window closes.
    function listenFogDataForPlayer(gmUid, worldId, mapId, callback) {
        if (!gmUid || !worldId || !mapId) return () => {};
        return db.collection('users').doc(gmUid)
            .collection('worlds').doc(worldId)
            .collection('fogData').doc(mapId)
            .onSnapshot(
                snap => callback(snap.exists ? (snap.data().fogData || null) : null),
                err  => console.warn('Fog listener:', err.message)
            );
    }

        async function savePublicWorldMap(inviteCode, base64DataUrl) {
        if (!inviteCode) return;
        await db.collection('worldCodes').doc(inviteCode)
            .collection('mapImage').doc('data')
            .set({ imageData: base64DataUrl, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    }

    async function loadPublicWorldMap(inviteCode) {
        if (!inviteCode) return null;
        let snap = await db.collection('worldCodes').doc(inviteCode.toUpperCase().trim())
            .collection('mapImage').doc('data').get();
        return snap.exists ? (snap.data().imageData || null) : null;
    }

    async function saveWorldMapFirestore(worldId, base64DataUrl) {
        let user = currentUser();
        if (!user) return;
        await db.collection('users').doc(user.uid)
            .collection('worlds').doc(worldId)
            .collection('mapImage').doc('data')
            .set({
                imageData:  base64DataUrl,
                updatedAt:  firebase.firestore.FieldValue.serverTimestamp()
            });
    }

    async function loadWorldMapFirestore(worldId) {
        let user = currentUser();
        if (!user) return null;
        let snap = await db.collection('users').doc(user.uid)
            .collection('worlds').doc(worldId)
            .collection('mapImage').doc('data').get();
        return snap.exists ? (snap.data().imageData || null) : null;
    }

    async function deleteWorldMapFirestore(worldId) {
        let user = currentUser();
        if (!user) return;
        await db.collection('users').doc(user.uid)
            .collection('worlds').doc(worldId)
            .collection('mapImage').doc('data')
            .delete().catch(() => {}); // ignore "not found"
    }

    const _inviteCodeCache = {};
    async function saveWorld(worldId, gmPrivateData, publicData) {
        let user = currentUser();
        if (!user) return;
        if (gmPrivateData && Object.keys(gmPrivateData).length) {
            let priv = apxClean(gmPrivateData), pkey = 'wpriv:' + user.uid + ':' + worldId;
            if (!_sameAsLast(pkey, priv)) {
                try { await db.collection('users').doc(user.uid).collection('worlds').doc(worldId).set(priv, { merge: true }); }
                catch (e) { _forgetWrite(pkey); throw e; }
            }
        }
        if (publicData && Object.keys(publicData).length) {
            let pub = { ...apxClean(publicData), gmUid: user.uid, worldId };  // worldId: players load portraits from users/{gmUid}/worlds/{worldId}/npcPortraits
            let qkey = 'wpub:' + user.uid + ':' + worldId;
            if (_sameAsLast(qkey, pub)) return;
            try {
                if (!_inviteCodeCache[worldId]) {
                    let worldDoc = await db.collection('users').doc(user.uid).collection('worlds').doc(worldId).get();
                    _inviteCodeCache[worldId] = worldDoc.exists ? worldDoc.data().inviteCode : null;
                }
                let inviteCode = _inviteCodeCache[worldId];
                if (inviteCode) await db.collection('worldCodes').doc(inviteCode).set(pub, { merge: true });
            } catch (e) { _forgetWrite(qkey); throw e; }
        }
    }

    async function saveWorldRaces(worldId, races) {
        let user = currentUser();
        if (!user) return;
        let worldDoc = await db.collection('users').doc(user.uid).collection('worlds').doc(worldId).get();
        let inviteCode = worldDoc.exists ? worldDoc.data().inviteCode : null;
        if (inviteCode) await db.collection('worldCodes').doc(inviteCode).set({ races, gmUid: user.uid }, { merge: true });
    }

    // Push the current gmRaces to EVERY world this GM has created,
    // so players who joined any world always get all race templates.
    async function saveRacesToAllWorlds(races) {
        let user = currentUser();
        if (!user) return;
        let snap = await db.collection('users').doc(user.uid).collection('worlds').get().catch(()=>({docs:[]}));
        await Promise.all(snap.docs.map(async d => {
            let code = d.data().inviteCode;
            if (code) await db.collection('worldCodes').doc(code).set({ races }, { merge: true }).catch(()=>{});
        }));
    }

    async function deleteWorld(worldId, inviteCode) {
        let user = currentUser();
        if (!user) return;
        await db.collection('users').doc(user.uid).collection('worlds').doc(worldId).delete();
        if (inviteCode) await db.collection('worldCodes').doc(inviteCode).delete().catch(() => {});
    }

    async function joinWorldByCode(inviteCode, playerState) {
        let doc = await db.collection('worldCodes').doc(inviteCode.toUpperCase().trim()).get();
        if (!doc.exists) return null;
        let data = doc.data();
        let user = currentUser();
        // Banned players are permanently blocked — throw so the caller can clean up
        if (user && (data.banned||[]).includes(user.uid)) {
            throw new Error('BANNED: You have been removed from this world by the GM.');
        }
        // Kicked players are blocked from auto-rejoin (no playerState) but can
        // manually rejoin by entering the code again (playerState present).
        if (user && (data.kicked||[]).includes(user.uid)) {
            if (!playerState) return null; // auto-load silently blocked
            // Manual rejoin — remove from kicked list, then proceed
            await db.collection('worldCodes').doc(inviteCode.toUpperCase().trim())
                .update({ kicked: firebase.firestore.FieldValue.arrayRemove(user.uid) }).catch(()=>{});
        }
        if (playerState && user) {
            await db.collection('worldCodes').doc(inviteCode.toUpperCase().trim())
                .collection('players').doc(user.uid).set({
                    uid: user.uid,
                    charName: (playerState.name || 'Unknown Player').slice(0, 60),
                    joinedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true }).catch(() => {});
        }
        return {
            inviteCode: inviteCode.toUpperCase().trim(),
            gmUid: data.gmUid, worldId: data.worldId,
            worldName: data.worldName, name: data.worldName,
            races: data.races || [],
            worldSettings: data.worldSettings || null,
            notesV2: {
                locations: data.publicNotes?.locations || [],
                npcs:      data.publicNotes?.npcs      || [],
                notes:     data.publicNotes?.notes     || data.publicNotes?.revealedSecrets || [],
                otherMaps: data.publicNotes?.otherMaps || []
            }
        };
    }

    async function kickWorldPlayer(inviteCode, uid, ban) {
        // Remove from the players sub-collection
        await db.collection('worldCodes').doc(inviteCode)
            .collection('players').doc(uid).delete().catch(()=>{});
        // Add to banned (permanent) or kicked (blocks auto-rejoin, allows manual rejoin)
        let field = ban ? 'banned' : 'kicked';
        await db.collection('worldCodes').doc(inviteCode)
            .update({ [field]: firebase.firestore.FieldValue.arrayUnion(uid) });
    }

    async function loadWorldPlayers(inviteCode) {
        let snap = await db.collection('worldCodes').doc(inviteCode.toUpperCase().trim())
            .collection('players').get();
        return snap.docs.map(d => d.data());
    }

    // A player can "connect to a GM" by entering the GM's share code
    // (which is just their Firebase UID). The player's sheet then pulls
    // that GM's public race templates from Firestore.
    function getShareCode() {
        let user = currentUser();
        return user ? user.uid : null;
    }

    async function connectToGm(gmUid) {
        if (!gmUid) return [];
        let doc = await db.collection('users').doc(gmUid)
            .collection('gmRaces').doc('all').get();
        return doc.exists ? (doc.data().races || []) : [];
    }

    // --- Auto-save (debounced) ------------------------------------------
    let _saveTimer = null;
    let _currentCharId = null;

    function scheduleAutoSave(stateObj) {
        if (!currentUser() || !_currentCharId) return;
        clearTimeout(_saveTimer);
        _saveTimer = setTimeout(() => saveCharacter(_currentCharId, stateObj), 3000);
    }

    function setActiveCharId(id) {
        _currentCharId = id;
    }

    // --- Auth state UI --------------------------------------------------
    // Inject a compact auth bar into every app page.
    function renderAuthBar() {
        let bar = document.getElementById('apxAuthBar');
        if (!bar) return;
        let user = currentUser();
        if (user) {
            let display = getUserDisplay(user);
            bar.innerHTML = `
                <div class="flex items-center gap-3 text-xs">
                    <span class="text-slate-400">${display}</span>
                    <button onclick="window.apxAuth.signOut().then(() => location.reload())"
                        class="text-slate-500 hover:text-slate-300 transition">Sign Out</button>
                </div>`;
        } else {
            bar.innerHTML = `
                <div class="flex items-center gap-2 text-xs">
                    <a href="index.html" class="text-slate-500 hover:text-slate-300 transition">Sign in to sync characters</a>
                </div>`;
        }
    }

    auth.onAuthStateChanged(user => {
        renderAuthBar();
        if (user && typeof window.onApxAuthReady === 'function') {
            window.onApxAuthReady(user);
        }
    });

    // --- Public API -----------------------------------------------------
    window.apxAuth = {
        enabled: true,
        get user() { return currentUser(); },
        signIn, signUp, signOut, onAuthChange,
        saveCharacter, loadCharacters, deleteCharacter,
        loadFolders, saveFolder, deleteFolder,
        saveGmRaces, loadGmRaces, saveGmNpcs, loadGmNpcs,
        getShareCode, connectToGm,
        createWorld, loadWorlds, saveWorld, saveWorldRaces, saveRacesToAllWorlds, deleteWorld, joinWorldByCode,
        loadWorldPlayers,
        saveWorldMapFirestore, loadWorldMapFirestore, deleteWorldMapFirestore,
        saveNpcPortrait, loadNpcPortrait, loadNpcPortraitForPlayer, addXpToPlayer, gmSetPlayerBattlePos,
        savePublicWorldMap, loadPublicWorldMap, loadWorldMapForPlayer, setGmHpOverride, updatePlayerBattlePos,
        writeBattlePosition, listenBattlePositions,
        saveOtherMapImage, loadOtherMapImage, loadOtherMapImageForPlayer, deleteOtherMapImage,
        saveBattleImage, loadBattleImage, loadBattleImageForPlayer, deleteBattleImage,
        addXpGrant, ackXpGrants, setGmCondition, publishCombatLog, writeRollLog, setGmCompanionHp,
        gmGiveToPlayer, ackGmGifts, writeOutbox, clearOutbox, ackGift, publishLootRequest,
        saveFogData, loadFogData, loadFogDataForPlayer, listenFogDataForPlayer,
        listenWorldPlayers, listenPublicWorldNotes, kickWorldPlayer,
        scheduleAutoSave, setActiveCharId,
        renderAuthBar,
    };
})();
