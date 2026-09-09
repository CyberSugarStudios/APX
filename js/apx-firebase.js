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
            loadGmRaces: () => Promise.resolve([]), getShareCode: () => null,
            connectToGm: () => Promise.resolve([]),
            createWorld: () => Promise.resolve(null), loadWorlds: () => Promise.resolve([]),
            saveWorld: () => Promise.resolve(), deleteWorld: () => Promise.resolve(),
            joinWorldByCode: () => Promise.resolve(null) };
        return;
    }

    // Init Firebase
    firebase.initializeApp(window.FIREBASE_CONFIG);
    const auth = firebase.auth();
    const db   = firebase.firestore();

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

    // --- Firestore helpers -----------------------------------------------
    // Data layout:
    //   users/{uid}/characters/{charId}  — one doc per character
    //   users/{uid}/gmRaces/{raceId}     — one doc per GM race template
    //   users/{uid}/profile              — { displayName, shareCode }

    async function saveCharacter(charId, stateObj) {
        let user = currentUser();
        if (!user) return;
        await db.collection('users').doc(user.uid)
            .collection('characters').doc(charId).set({
                state: stateObj,
                name: stateObj.name || 'Unnamed Character',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
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

    async function saveGmRaces(racesArray) {
        let user = currentUser();
        if (!user) return;
        let ref = db.collection('users').doc(user.uid)
            .collection('gmRaces').doc('all');
        await ref.set({ races: racesArray, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    }

    async function loadGmRaces() {
        let user = currentUser();
        if (!user) return [];
        let doc = await db.collection('users').doc(user.uid)
            .collection('gmRaces').doc('all').get();
        return doc.exists ? (doc.data().races || []) : [];
    }

    // --- World system ---------------------------------------------------
    // A GM creates one or more Worlds; each world has a short invite code
    // that players enter to auto-load all the GM's assets for that world.
    // Layout:
    //   users/{uid}/worlds/{worldId}  -- world data (name, notes, races)
    //   worldCodes/{inviteCode}       -- maps invite code to gmUid/worldId

    function generateInviteCode() {
        let chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
        let code = '';
        for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
        return code;
    }

    async function createWorld(name) {
        let user = currentUser();
        if (!user) return null;
        let worldId = 'world_' + Date.now();
        let inviteCode = generateInviteCode();
        let worldData = { name, inviteCode, races: [], notes: {}, createdAt: firebase.firestore.FieldValue.serverTimestamp() };
        await db.collection('users').doc(user.uid).collection('worlds').doc(worldId).set(worldData);
        await db.collection('worldCodes').doc(inviteCode).set({ gmUid: user.uid, worldId, worldName: name });
        return { worldId, inviteCode, ...worldData };
    }

    async function loadWorlds() {
        let user = currentUser();
        if (!user) return [];
        let snap = await db.collection('users').doc(user.uid).collection('worlds').get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    async function saveWorld(worldId, data) {
        let user = currentUser();
        if (!user) return;
        await db.collection('users').doc(user.uid).collection('worlds').doc(worldId).set(data, { merge: true });
    }

    async function deleteWorld(worldId, inviteCode) {
        let user = currentUser();
        if (!user) return;
        await db.collection('users').doc(user.uid).collection('worlds').doc(worldId).delete();
        if (inviteCode) await db.collection('worldCodes').doc(inviteCode).delete().catch(() => {});
    }

    async function joinWorldByCode(inviteCode) {
        let doc = await db.collection('worldCodes').doc(inviteCode.toUpperCase().trim()).get();
        if (!doc.exists) return null;
        let { gmUid, worldId, worldName } = doc.data();
        let worldDoc = await db.collection('users').doc(gmUid).collection('worlds').doc(worldId).get();
        if (!worldDoc.exists) return null;
        return { gmUid, worldId, worldName, ...worldDoc.data() };
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
            bar.innerHTML = `
                <div class="flex items-center gap-3 text-xs">
                    <span class="text-slate-400">${user.email}</span>
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
        saveGmRaces, loadGmRaces,
        getShareCode, connectToGm,
        createWorld, loadWorlds, saveWorld, deleteWorld, joinWorldByCode,
        scheduleAutoSave, setActiveCharId,
        renderAuthBar,
    };
})();
