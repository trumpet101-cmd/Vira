// --- FIREBASE CONFIG & INITIALIZATION ---
// Note: Firebase web API keys are not secrets - they're meant to be public.
// What protects your data is your Firestore Security Rules (set in the Firebase console).

var firebaseConfig = {
    apiKey: "AIzaSyBbmh-jibUxCwbqVvzEDHX78YEweb_ld04",
    authDomain: "vira-dnd.firebaseapp.com",
    projectId: "vira-dnd",
    storageBucket: "vira-dnd.firebasestorage.app",
    messagingSenderId: "464258497921",
    appId: "1:464258497921:web:b2ab64f9507ba6775dbc80",
    measurementId: "G-VXZHJNQD1S"
};
var appId = 'vira-dnd-notes';

// Initialize Firebase with UMD Compat API
var appInstance = firebase.initializeApp(firebaseConfig);
var auth = firebase.auth();
var db = firebase.firestore();

// --- OFFLINE PERSISTENCE ---
// Queued writes survive tab close/reload and resend automatically when the
// connection returns, closing the "typed a note, killed the tab within a
// second" data-loss window. synchronizeTabs lets multiple open tabs share
// the same cache instead of the second tab failing to acquire it.
// Failure is safe: 'failed-precondition' (another tab already owns the
// cache in an SDK without multi-tab support) or 'unimplemented' (browser
// lacks IndexedDB) simply leaves the app running exactly as before.
db.enablePersistence({ synchronizeTabs: true }).catch(function(e) {
    console.warn('Firestore persistence unavailable:', e && e.code ? e.code : e);
});

var storage = firebase.storage();

// Cloud sync state vars (used across cloud.js)
var cloudUser = null;
var isCloudReady = false;
var saveTimeout = null;
var isLocalSaving = false;
var unsubscribeCharacters = null;
var unsubscribeActiveCharacter = null;