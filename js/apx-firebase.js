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
            saveWorldMapFirestore: () => Promise.resolve(),
            loadWorldMapFirestore: () => Promise.resolve(null),
            deleteWorldMapFirestore: () => Promise.resolve(),
            savePublicWorldMap: () => Promise.resolve(),
            loadPublicWorldMap: () => Promise.resolve(null),
            loadWorldMapForPlayer: () => Promise.resolve(null),
            setGmHpOverride: () => Promise.resolve() };
        return;
    }

    // Init Firebase
    firebase.initializeApp(window.FIREBASE_CONFIG);
    const auth = firebase.auth();
    const db   = firebase.firestore();
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
        let doc = {
            state: stateObj,
            name: stateObj.name || 'Unnamed Character',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (meta) Object.assign(doc, meta); // folderId, worldCode, etc.
        await db.collection('users').doc(user.uid)
            .collection('characters').doc(charId).set(doc, { merge: true });

        // Sync character state into the world players sub-collection so the GM's
        // party panel can display live stats without needing cross-user Firestore access.
        let worldCode = meta?.worldCode || stateObj.worldCode;
        if (worldCode) {
            await db.collection('worldCodes').doc(worldCode)
                .collection('players').doc(user.uid).set({
                    uid:       user.uid,
                    charName:  (stateObj.name || 'Unknown Player').slice(0, 60),
                    charState: stateObj,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true }).catch(e => console.warn('World char sync:', e.message));
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
            .set({ races: racesArray, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
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
            .set({ npcs: npcsArray, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
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

    // --- setGmHpOverride: GM writes an HP value that the player's charsheet listens for ---
    // Stored in worldCodes/{inviteCode}/players/{uid} as { _gmHp: { hp, at } }.
    // The player never writes this field — only the GM does — so there's no sync loop.
    async function setGmHpOverride(inviteCode, uid, hp) {
        if (!inviteCode || !uid) return;
        await db.collection('worldCodes').doc(inviteCode)
            .collection('players').doc(uid)
            .set({ _gmHp: { hp, at: firebase.firestore.FieldValue.serverTimestamp() } }, { merge: true });
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

    async function saveWorld(worldId, gmPrivateData, publicData) {
        let user = currentUser();
        if (!user) return;
        if (gmPrivateData && Object.keys(gmPrivateData).length)
            await db.collection('users').doc(user.uid).collection('worlds').doc(worldId).set(gmPrivateData, { merge: true });
        if (publicData && Object.keys(publicData).length) {
            let worldDoc = await db.collection('users').doc(user.uid).collection('worlds').doc(worldId).get();
            let inviteCode = worldDoc.exists ? worldDoc.data().inviteCode : null;
            if (inviteCode) await db.collection('worldCodes').doc(inviteCode).set({
                ...publicData,
                gmUid: user.uid  // always include gmUid so update rule passes on older docs
            }, { merge: true });
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
        // Register this player + share their character name (consent = entering the code).
        // The full state is shared via auto-save after joining — storing it here on join
        // risks Firestore 1MB document limits and requires the player to be signed in.
        if (playerState && currentUser()) {
            let uid = currentUser().uid;
            await db.collection('worldCodes').doc(inviteCode.toUpperCase().trim())
                .collection('players').doc(uid).set({
                    uid,
                    charName: (playerState.name || 'Unknown Player').slice(0, 60),
                    joinedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true }).catch(() => {}); // non-blocking — join succeeds even if registration fails
        }
        return {
            gmUid: data.gmUid, worldId: data.worldId,
            worldName: data.worldName, name: data.worldName,
            races: data.races || [],
            notesV2: {
                locations:       data.publicNotes?.locations       || [],
                npcs:            data.publicNotes?.npcs            || [],
                secrets:         data.publicNotes?.revealedSecrets || []
            }
        };
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
        savePublicWorldMap, loadPublicWorldMap, loadWorldMapForPlayer, setGmHpOverride,
        listenWorldPlayers,
        scheduleAutoSave, setActiveCharId,
        renderAuthBar,
    };
})();
