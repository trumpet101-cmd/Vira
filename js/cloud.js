// --- LOCAL STORAGE FIRST LOAD BOOTSTRAP ---
var loadedData = JSON.parse(localStorage.getItem('character_data_' + currentCharacterId));
if (!loadedData && currentCharacterId === 'default') {
    let legacyData = JSON.parse(localStorage.getItem('viraDndNotes'));
    if (legacyData) {
        loadedData = legacyData;
        localStorage.setItem('character_data_default', JSON.stringify(legacyData));
        characterList = [{ id: 'default', name: legacyData.name || 'Víra Tahlwyn', race: legacyData.basics?.race || 'Wood Elf', class: legacyData.basics?.class || 'Barbarian (World Tree)' }];
        localStorage.setItem('character_list', JSON.stringify(characterList));
    }
}

if (loadedData) characterData = { ...JSON.parse(JSON.stringify(initialCharacterData)), ...loadedData };
else {
    characterData = JSON.parse(JSON.stringify(initialCharacterData));
    characterList = [{ id: 'default', name: initialCharacterData.name, race: initialCharacterData.basics.race, class: initialCharacterData.basics.class }];
    localStorage.setItem('character_list', JSON.stringify(characterList));
    localStorage.setItem('character_data_default', JSON.stringify(characterData));
    localStorage.setItem('current_character_id', 'default');
    currentCharacterId = 'default';
}
migrateData(characterData);

// --- HYBRID CLOUD LOGIC ---
var lastLocalEditTime = 0; // The Edit Lock timer
var saveTimeout = null;    // Debounce handle for the cloud write

// Track Auth State changes
auth.onAuthStateChanged(async (u) => {
    try {
        const authOverlay = document.getElementById('auth-overlay');
        if (u && !u.isAnonymous) {
            cloudUser = u;
            isCloudReady = true;
            if(authOverlay) authOverlay.classList.add('hidden');
            updateCloudUIStatus("Connecting...", "loader-2", "bg-amber-900/50 text-amber-400 animate-pulse");
            listenToCharactersList();
        } else {
            if (u && u.isAnonymous) await auth.signOut();
            if (unsubscribeActiveCharacter) { unsubscribeActiveCharacter(); unsubscribeActiveCharacter = null; }
            if (unsubscribeCharacters) { unsubscribeCharacters(); unsubscribeCharacters = null; }
            cloudUser = null; isCloudReady = false;
            if(authOverlay) authOverlay.classList.remove('hidden');
            updateCloudUIStatus("Please Sign In", "lock", "bg-stone-800 text-stone-400");
        }
    } catch (err) { handleSyncError(err); }
});

// Setup real-time character collections listener
function listenToCharactersList() {
    try {
        if (!cloudUser || !db) return;
        const colRef = db.collection('artifacts').doc(appId).collection('users').doc(cloudUser.uid).collection('characters');
        
        unsubscribeCharacters = colRef.onSnapshot(async (querySnap) => {
            const list = [];
            querySnap.forEach(docSnap => {
                const data = docSnap.data();
                list.push({ id: docSnap.id, name: data.name || "Unnamed Character", race: data.basics?.race || "Unknown Race", class: data.basics?.class || "Unknown Class" });
            });

            characterList = list;
            localStorage.setItem('character_list', JSON.stringify(characterList));
            window.renderCharacterModalList();

            if (list.length === 0) {
                const legacyDocRef = db.collection('artifacts').doc(appId).collection('users').doc(cloudUser.uid).collection('character_data').doc('sheet');
                try {
                    updateCloudUIStatus("Checking Legacy Notes...", "loader-2", "bg-amber-900/50 text-amber-400 animate-pulse");
                    const legacySnap = await legacyDocRef.get();
                    if (legacySnap.exists) {
                        updateCloudUIStatus("Migrating Legacy Notes...", "loader-2", "bg-amber-900/50 text-amber-400 animate-pulse");
                        const legacyData = legacySnap.data();
                        const newCharId = 'char_' + Date.now();
                        await db.collection('artifacts').doc(appId).collection('users').doc(cloudUser.uid).collection('characters').doc(newCharId).set(toCloudDoc(legacyData));
                        currentCharacterId = newCharId;
                        localStorage.setItem('current_character_id', currentCharacterId);
                        await legacyDocRef.delete();
                    } else {
                        const defaultId = 'char_' + Date.now();
                        await db.collection('artifacts').doc(appId).collection('users').doc(cloudUser.uid).collection('characters').doc(defaultId).set(toCloudDoc(JSON.parse(JSON.stringify(initialCharacterData))));
                        currentCharacterId = defaultId;
                        localStorage.setItem('current_character_id', currentCharacterId);
                    }
                } catch (e) { console.error("Migration check failed", e); }
            } else {
                const activeExists = list.some(c => c.id === currentCharacterId);
                if (!activeExists) {
                    currentCharacterId = list[0].id;
                    localStorage.setItem('current_character_id', currentCharacterId);
                }
            }
            listenToActiveCharacter();
        }, (error) => handleSyncError(error));
    } catch (err) { handleSyncError(err); }
}

function listenToActiveCharacter() {
    if (unsubscribeActiveCharacter) { unsubscribeActiveCharacter(); unsubscribeActiveCharacter = null; }
    if (!cloudUser || !db || !currentCharacterId) return;
    const docRef = db.collection('artifacts').doc(appId).collection('users').doc(cloudUser.uid).collection('characters').doc(currentCharacterId);

    unsubscribeActiveCharacter = docRef.onSnapshot({ includeMetadataChanges: true }, (docSnap) => {
        // FILTER LOCAL ECHOES: Ignore any incoming snapshots if this specific browser tab is the one typing
        if (docSnap.metadata.hasPendingWrites) return;
        
        // EDIT LOCK PREVENTING SYNC STOMPING: If the user typed anything within the last 4 seconds, ignore cloud echoes
        if (Date.now() - lastLocalEditTime < 4000) return;
        
        if (docSnap.exists) {
            characterData = { ...JSON.parse(JSON.stringify(initialCharacterData)), ...fromCloudDoc(docSnap.data()) };
            migrateData(characterData);
            localStorage.setItem('character_data_' + currentCharacterId, JSON.stringify(characterData));
            document.getElementById('header-name-input').value = characterData.name;
            window.renderContent();
            if (window.lucide) lucide.createIcons();
            updateCloudUIStatus("Cloud Sync Active", "cloud-lightning", "bg-emerald-900/50 text-emerald-400");
        }
    }, (error) => handleSyncError(error));
}

function handleSyncError(error) {
    console.error("Firestore operation failed:", error);
    if (error.code === 'permission-denied') {
        updateCloudUIStatus("Rules Error: Denied", "shield-alert", "bg-red-950 text-red-400 border border-red-800");
    } else {
        updateCloudUIStatus("Sync Error: " + (error.code || error.message || "Unknown"), "cloud-off", "bg-red-950 text-red-400");
    }
}

function updateCloudUIStatus(text, icon, classes) {
    const btn = document.getElementById('cloud-status-btn');
    if(btn) {
        btn.className = `w-full flex items-center justify-center space-x-2 px-4 py-2 rounded text-sm transition-all ${classes}`;
        btn.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4"></i><span>${text}</span>`;
        if (window.lucide) lucide.createIcons();
    }
}

function triggerSaveIndicator() {
    const ind = document.getElementById('save-indicator');
    const iconWrapper = document.getElementById('save-icon-wrapper');
    const text = document.getElementById('save-text');
    
    ind.classList.remove('opacity-50');
    iconWrapper.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 text-emerald-500 animate-spin"></i>`;
    text.innerText = "Saving...";
    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
        iconWrapper.innerHTML = `<i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-500"></i>`;
        text.innerText = isCloudReady ? "Saved to Cloud" : "Saved automatically";
        ind.classList.add('opacity-50');
        if (window.lucide) lucide.createIcons();
    }, 600);
}

function flashSuccessIndicator(textMsg) {
    const ind = document.getElementById('save-indicator');
    const iconWrapper = document.getElementById('save-icon-wrapper');
    const text = document.getElementById('save-text');
    
    ind.classList.remove('opacity-50');
    iconWrapper.innerHTML = `<i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-500"></i>`;
    text.innerText = textMsg;
    if (window.lucide) lucide.createIcons();
    
    setTimeout(() => {
        ind.classList.add('opacity-50');
        text.innerText = isCloudReady ? "Saved to Cloud" : "Saved automatically";
        if (window.lucide) lucide.createIcons();
    }, 4000);
}

// Tracks whether an edit is waiting on the debounced cloud write.
// Lets the visibility/unload flush below know there is work to push.
var pendingCloudWrite = false;

// The actual Firestore write, extracted from saveData so it can be invoked
// immediately (flush) as well as on the debounce timer.
// =========================================================================
// CLOUD PAYLOAD COMPRESSION
// =========================================================================
// Characters are stored in Firestore as a compressed payload so a large
// campaign stays well under the 1 MiB per-document limit. A little metadata
// (name, race, class) is kept in plain fields so the sidebar list can read it
// without decompressing every doc. Reads are tolerant: an older uncompressed
// document (no _cv marker) is returned as-is, so existing data still loads and
// simply gets rewritten compressed on its next save. This covers the CLOUD
// copy only -- localStorage stays uncompressed.

function compressPayload(obj) {
    try {
        if (typeof LZString === 'undefined') return null;
        return LZString.compressToBase64(JSON.stringify(obj));
    } catch (e) { console.warn('Compression failed, storing plain:', e); return null; }
}

function decompressPayload(str) {
    try {
        if (typeof LZString === 'undefined') return null;
        var json = LZString.decompressFromBase64(str);
        return json ? JSON.parse(json) : null;
    } catch (e) { console.warn('Decompression failed:', e); return null; }
}

// Wrap a character object into the shape written to a Firestore character doc.
function toCloudDoc(charObj) {
    var payload = compressPayload(charObj);
    if (payload === null) {
        // Library missing/failed -> store the plain object so saving never breaks.
        return JSON.parse(JSON.stringify(charObj));
    }
    return {
        _cv: 1,
        name: charObj.name || 'Unnamed Character',
        basics: {
            race: (charObj.basics && charObj.basics.race) || 'Unknown Race',
            class: (charObj.basics && charObj.basics.class) || 'Unknown Class'
        },
        payload: payload
    };
}

// Unwrap a Firestore character doc back into a plain character object.
function fromCloudDoc(data) {
    if (data && data._cv && typeof data.payload === 'string') {
        var obj = decompressPayload(data.payload);
        if (obj) return obj;
    }
    return data; // uncompressed/legacy doc, or a decompress failure
}
window.compressPayload = compressPayload;
window.decompressPayload = decompressPayload;
window.toCloudDoc = toCloudDoc;
window.fromCloudDoc = fromCloudDoc;


async function performCloudSave() {
    clearTimeout(saveTimeout);
    if (!pendingCloudWrite) return;
    pendingCloudWrite = false;
    if (isCloudReady && cloudUser && db && currentCharacterId) {
        try {
            // Deep clone so we don't mutate characterData in memory
            const dataToSave = toCloudDoc(characterData);
            await db.collection('artifacts').doc(appId).collection('users').doc(cloudUser.uid).collection('characters').doc(currentCharacterId).set(dataToSave);
            triggerSaveIndicator();
        } catch (e) {
            console.error("Cloud save failed, relying on local backup", e);
            pendingCloudWrite = true; // still dirty — a later flush can retry
            handleSyncError(e);
            triggerSaveIndicator();
        }
    } else { triggerSaveIndicator(); }
}

// --- FLUSH ON TAB HIDE / CLOSE ---
// localStorage is written synchronously, but the cloud write is debounced 800ms.
// Without this, closing the tab right after typing leaves the cloud copy stale,
// and the next page load's snapshot listener stomps localStorage with that stale
// copy (lastLocalEditTime starts at 0 on load). Flushing on 'hidden' covers tab
// close, tab switch, and mobile app backgrounding; beforeunload is a fallback.
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') performCloudSave();
});
window.addEventListener('beforeunload', function() { performCloudSave(); });

// --- LOCAL SAVE GUARD (quota-safe) ---------------------------------------
// The cloud write scheduled at the end of saveData is the durable copy, so a
// full-storage error on the local write must never abort saveData. For the
// main character document we also try to reclaim space once by dropping THIS
// character's local version-history snapshots -- those are only a convenience
// layer (cloud snapshots cover real history), so live character data wins.
function saveCharacterDataLocal() {
    var key = 'character_data_' + currentCharacterId;
    try {
        localStorage.setItem(key, JSON.stringify(characterData));
        return true;
    } catch (e) {
        // Reclaim the biggest local consumer for this character, then retry once.
        try { localStorage.removeItem('version_history_' + currentCharacterId); } catch (_) {}
        try {
            localStorage.setItem(key, JSON.stringify(characterData));
            return true;
        } catch (e2) {
            warnLocalStorageFullOnce();
            return false;
        }
    }
}

// Generic best-effort write for small keys (e.g. the character list).
function safeSetItem(key, value) {
    try { localStorage.setItem(key, value); return true; }
    catch (e) { warnLocalStorageFullOnce(); return false; }
}

// One-time, honest heads-up. Message adapts to whether the cloud copy is live.
function warnLocalStorageFullOnce() {
    console.warn('localStorage quota exceeded -- a local copy could not be written.');
    if (window._localSaveQuotaWarned) return;
    window._localSaveQuotaWarned = true;
    if (typeof window.showCustomAlert !== 'function') return;
    var cloudOn = (typeof isCloudReady !== 'undefined' && isCloudReady &&
                   typeof cloudUser !== 'undefined' && cloudUser);
    var msg = cloudOn
        ? "Your browser storage is full, so this device couldn't save a local copy of your most recent changes. They're still being saved to the cloud, so your data is safe. To restore the local backup layer, use Backup All to export, then remove characters you no longer need."
        : "Your browser storage is full and cloud sync is off, so your most recent changes may not be saved. Please use Backup All to export your data now, then remove old characters to free up space.";
    window.showCustomAlert('Storage Full', msg, '\u26A0\uFE0F');
}

window.saveData = function() {
    lastLocalEditTime = Date.now(); // Trip the Edit Lock to stop sync stomping
    clearTimeout(saveTimeout);
    pendingCloudWrite = true;
    saveCharacterDataLocal();

    const index = characterList.findIndex(c => c.id === currentCharacterId);
    if (index !== -1) {
        let nameChanged = characterList[index].name !== characterData.name;
        let raceChanged = characterList[index].race !== characterData.basics.race;
        let classChanged = characterList[index].class !== characterData.basics.class;
        if (nameChanged || raceChanged || classChanged) {
            characterList[index].name = characterData.name;
            characterList[index].race = characterData.basics.race;
            characterList[index].class = characterData.basics.class;
            safeSetItem('character_list', JSON.stringify(characterList));
            window.renderCharacterModalList();
        }
    }
    
    saveTimeout = setTimeout(performCloudSave, 800);
}

window.updateField = function(section, field, value) {
    if (section) characterData[section][field] = value;
    else characterData[field] = value;
    window.saveData();
    if(!section && field === 'name') {
        const headerInput = document.getElementById('header-name-input');
        const inlineInput = document.getElementById('inline-name-input');
        if (headerInput && headerInput.value !== value) headerInput.value = value;
        if (inlineInput && inlineInput.value !== value) inlineInput.value = value;
    }
};

window.exportJSON = async function() {
    const backupPayload = { vira_vault_backup: true, version: "2.0", currentCharacterId: currentCharacterId, characterList: characterList, characters: {} };
    updateCloudUIStatus("Preparing Backup...", "loader-2", "bg-amber-900/50 text-amber-400 animate-pulse");
    
    if (isCloudReady && cloudUser && db) {
        try {
            for (const char of characterList) {
                const docSnap = await db.collection('artifacts').doc(appId).collection('users').doc(cloudUser.uid).collection('characters').doc(char.id).get();
                if (docSnap.exists) { backupPayload.characters[char.id] = fromCloudDoc(docSnap.data()); } 
                else {
                    const localData = localStorage.getItem('character_data_' + char.id);
                    if (localData) backupPayload.characters[char.id] = JSON.parse(localData);
                    else if (char.id === currentCharacterId) backupPayload.characters[char.id] = characterData;
                }
            }
        } catch (e) {
            console.error("Cloud fetch during backup failed, relying on local browser cache", e);
            characterList.forEach(char => {
                const data = localStorage.getItem('character_data_' + char.id);
                if (data) backupPayload.characters[char.id] = JSON.parse(data);
                else if (char.id === currentCharacterId) backupPayload.characters[char.id] = characterData;
            });
        }
    } else {
        characterList.forEach(char => {
            const data = localStorage.getItem('character_data_' + char.id);
            if (data) backupPayload.characters[char.id] = JSON.parse(data);
            else if (char.id === currentCharacterId) backupPayload.characters[char.id] = characterData;
        });
    }
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupPayload, null, 2));
    const a = document.createElement('a');
    a.setAttribute("href", dataStr);
    a.setAttribute("download", `dnd_vault_full_backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
    
    if (isCloudReady) updateCloudUIStatus("Cloud Sync Active", "cloud-lightning", "bg-emerald-900/50 text-emerald-400");
    else updateCloudUIStatus("Local Storage Active", "hard-drive", "bg-stone-800 text-stone-400");
};

window.importJSON = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const parsedData = JSON.parse(e.target.result);
            if (parsedData.vira_vault_backup === true) {
                window.showCustomConfirm(
                    'Import Full Vault?', 'Are you sure you want to proceed? This will overwrite ALL characters currently in your vault with the characters inside this backup.', '📥', 
                    async () => {
                        updateCloudUIStatus("Importing Vault...", "loader-2", "bg-amber-950/50 text-amber-400 animate-pulse");
                        characterList.forEach(c => { localStorage.removeItem('character_data_' + c.id); });
                        const oldList = [...characterList];
                        characterList = parsedData.characterList || [];
                        localStorage.setItem('character_list', JSON.stringify(characterList));
                        const newIds = new Set(characterList.map(c => c.id));
                        
                        if (isCloudReady && cloudUser && db) {
                            for (const oldChar of oldList) {
                                if (!newIds.has(oldChar.id)) {
                                    try { await db.collection('artifacts').doc(appId).collection('users').doc(cloudUser.uid).collection('characters').doc(oldChar.id).delete(); } catch (e) { console.error("Clean-up purge failed for ID: " + oldChar.id, e); }
                                }
                            }
                        }
                        
                        for (const [charId, charData] of Object.entries(parsedData.characters)) {
                            migrateData(charData);
                            localStorage.setItem('character_data_' + charId, JSON.stringify(charData));
                            if (isCloudReady && cloudUser && db) await db.collection('artifacts').doc(appId).collection('users').doc(cloudUser.uid).collection('characters').doc(charId).set(toCloudDoc(charData));
                        }
                        
                        const targetId = parsedData.currentCharacterId || characterList[0]?.id || 'default';
                        window.switchCharacter(targetId);
                        flashSuccessIndicator("Full Vault imported successfully!");
                    }
                );
            } 
            else if (parsedData.name || parsedData.basics || parsedData.campaignNotes) {
                window.showCustomConfirm(
                    'Import Character?', `Do you want to add this sheet ("${parsedData.name || 'Unnamed'}") as a new character in your vault?`, '📥', 
                    async () => {
                        updateCloudUIStatus("Importing Character...", "loader-2", "bg-amber-900/50 text-amber-400 animate-pulse");
                        const newCharData = { ...JSON.parse(JSON.stringify(initialCharacterData)), ...parsedData };
                        migrateData(newCharData);
                        const newCharId = 'char_' + Date.now();
                        const newCharName = newCharData.name || "Imported Character";
                        const newCharRace = newCharData.basics?.race || "Unknown Race";
                        const newCharClass = newCharData.basics?.class || "Unknown Class";
                        
                        characterList.push({ id: newCharId, name: newCharName, race: newCharRace, class: newCharClass });
                        localStorage.setItem('character_list', JSON.stringify(characterList));
                        localStorage.setItem('character_data_' + newCharId, JSON.stringify(newCharData));
                        
                        if (isCloudReady && cloudUser && db) await db.collection('artifacts').doc(appId).collection('users').doc(cloudUser.uid).collection('characters').doc(newCharId).set(toCloudDoc(newCharData));
                        window.switchCharacter(newCharId);
                        flashSuccessIndicator("Character imported successfully!");
                    }
                );
            } else { throw new Error("Invalid or unrecognized file format."); }
        } catch (err) {
            console.error("Backup Import Failed: ", err);
            window.showCustomAlert("Import Failed", "The selected file is corrupt or is not structured as an eligible notes backup: " + err.message, "❌");
        } finally { event.target.value = ''; }
    };
    reader.readAsText(file);
};

// Sign-In/Register Flow Controllers
var isSignUpMode = false;
var authForm = document.getElementById('auth-form');
var authToggleBtn = document.getElementById('auth-btn-toggle');
var authTitle = document.getElementById('auth-title');
var authSubtitle = document.getElementById('auth-subtitle');
var authBtnText = document.getElementById('auth-btn-text');
var authError = document.getElementById('auth-error');

authToggleBtn.addEventListener('click', () => {
    isSignUpMode = !isSignUpMode;
    authError.classList.add('hidden');
    if (isSignUpMode) {
        authTitle.innerText = "Create Your Vault Account";
        authSubtitle.innerText = "Register your credentials to secure your custom character build";
        authBtnText.innerText = "Register Account";
        authToggleBtn.innerText = "Already have an account? Sign In";
    } else {
        authTitle.innerText = "D&D Vault Authentication";
        authSubtitle.innerText = "Log in to sync your character sheets and notes";
        authBtnText.innerText = "Sign In";
        authToggleBtn.innerText = "Need an account? Register Here";
    }
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.classList.add('hidden');
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;

    try {
        if (isSignUpMode) await auth.createUserWithEmailAndPassword(email, password);
        else await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        console.error("Authentication Error: ", error);
        authError.innerText = error.message.replace("Firebase: ", "");
        authError.classList.remove('hidden');
    }
});

window.handleSignOut = async function() {
    window.showCustomConfirm('Sign Out?', 'Are you sure you want to sign out? Your active cloud session on this device will close.', '🚪', async () => {
        try { await auth.signOut(); } catch(e) { console.error("Sign out failed: ", e); }
    });
};


// =========================================================================
// STORAGE USAGE TOOLTIP (hover the cloud-status pill)
// =========================================================================
// localStorage is the tightest budget (~5MB per browser origin, shared across
// every character plus their local snapshots). This adds a hover tooltip to the
// cloud-status pill so you can keep an eye on it. Usage is summed live on hover;
// there is no reliable browser API for the exact quota, so this is an estimate
// against a conservative 5MB budget, not a precise gauge.

var STORAGE_BUDGET_BYTES = 5 * 1024 * 1024;

function computeStorageReport() {
    var totalBytes = 0, charCount = 0;
    var thisCharDataBytes = 0, thisCharSnapBytes = 0, thisCharSnapCount = 0;
    var activeKey = 'character_data_' + currentCharacterId;
    var histKey   = 'version_history_' + currentCharacterId;
    for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k === null) continue;
        var v = localStorage.getItem(k) || '';
        // Browsers store localStorage as UTF-16, so ~2 bytes per code unit.
        var bytes = (k.length + v.length) * 2;
        totalBytes += bytes;
        if (k.indexOf('character_data_') === 0) charCount++;
        if (k === activeKey) thisCharDataBytes = bytes;
        if (k === histKey) {
            thisCharSnapBytes = bytes;
            try { thisCharSnapCount = (JSON.parse(v) || []).length; } catch (e) {}
        }
    }
    return {
        totalBytes: totalBytes,
        charCount: charCount,
        thisCharBytes: thisCharDataBytes + thisCharSnapBytes,
        thisCharSnapCount: thisCharSnapCount
    };
}

function formatStorageMB(bytes) {
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function updateCloudStatusTooltip() {
    var el = document.getElementById('cloud-status-btn');
    if (!el) return;
    var r = computeStorageReport();
    var pct = Math.round(r.totalBytes / STORAGE_BUDGET_BYTES * 100);
    var snapWord = r.thisCharSnapCount === 1 ? 'snapshot' : 'snapshots';
    var charWord = r.charCount === 1 ? 'character' : 'characters';
    el.title =
        'Local storage: ' + formatStorageMB(r.totalBytes) + ' used (~' + pct + '% of ~5 MB)' + '\n' +
        'This character: ' + formatStorageMB(r.thisCharBytes) + ' (data + ' + r.thisCharSnapCount + ' local ' + snapWord + ')' + '\n' +
        r.charCount + ' ' + charWord + ' stored on this device' + '\n' +
        'Full version history is also saved to the cloud.';
}

// Refresh the tooltip text right before it shows, so it is always current.
(function initStorageTooltip() {
    function attach() {
        var el = document.getElementById('cloud-status-btn');
        if (!el || el._storageTooltipWired) return;
        el._storageTooltipWired = true;
        el.addEventListener('mouseenter', updateCloudStatusTooltip);
        updateCloudStatusTooltip();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attach);
    } else {
        attach();
    }
})();
