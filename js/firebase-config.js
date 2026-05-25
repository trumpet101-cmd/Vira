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

// Cloud sync state vars (used across cloud.js)
var cloudUser = null;
var isCloudReady = false;
var saveTimeout = null;
var isLocalSaving = false;
var unsubscribeCharacters = null;
var unsubscribeActiveCharacter = null;
