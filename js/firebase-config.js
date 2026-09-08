// ----------------------------------------------------------------
// Firebase Configuration
// ----------------------------------------------------------------
// Replace these placeholder values with your own Firebase project
// credentials. To get them:
//   1. Go to https://console.firebase.google.com
//   2. Create a project (or open an existing one)
//   3. Click "Add app" → Web (</> icon)
//   4. Register the app, copy the firebaseConfig object here
//   5. In the Firebase console, enable:
//      - Authentication → Email/Password
//      - Firestore Database (start in production mode,
//        then add the security rules from FIREBASE_RULES.txt)
// ----------------------------------------------------------------
const FIREBASE_CONFIG = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Set to true once you've filled in real credentials above.
// While false, the app runs in local-only mode (no cloud sync).
const FIREBASE_ENABLED = false;
