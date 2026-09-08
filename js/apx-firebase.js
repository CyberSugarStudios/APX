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
            connectToGm: () => Promise.resolve([]) };
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
        scheduleAutoSave, setActiveCharId,
        renderAuthBar,
    };
})();
