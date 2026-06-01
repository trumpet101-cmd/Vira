// --- FIREBASE CONFIG & INITIALIZATION ---
// SETUP INSTRUCTIONS:
//   1. Copy this file and rename the copy to: firebase-config.js
//   2. Fill in your real values from the Firebase console:
//      Firebase Console > Project Settings > Your Apps > SDK setup and configuration
//   3. Never commit firebase-config.js to GitHub (it's in .gitignore)

var firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID",
    measurementId: "YOUR_MEASUREMENT_ID"
};
var appId = 'vira-dnd-notes';

// Initialize Firebase with UMD Compat API
var appInstance = firebase.initializeApp(firebaseConfig);
var auth = firebase.auth();
var db = firebase.firestore();
var storage = firebase.storage();

// Cloud sync state vars (used across cloud.js)
var cloudUser = null;
var isCloudReady = false;
var saveTimeout = null;
var isLocalSaving = false;
var unsubscribeCharacters = null;
var unsubscribeActiveCharacter = null;
