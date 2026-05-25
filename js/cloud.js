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
                        await db.collection('artifacts').doc(appId).collection('users').doc(cloudUser.uid).collection('characters').doc(newCharId).set(legacyData);
                        currentCharacterId = newCharId;
                        localStorage.setItem('current_character_id', currentCharacterId);
                        await legacyDocRef.delete();
                    } else {
                        const defaultId = 'char_' + Date.now();
                        await db.collection('artifacts').doc(appId).collection('users').doc(cloudUser.uid).collection('characters').doc(defaultId).set(JSON.parse(JSON.stringify(initialCharacterData)));
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

    unsubscribeActiveCharacter = docRef.onSnapshot((docSnap) => {
        if (isLocalSaving) return;
        if (docSnap.exists) {
            characterData = { ...JSON.parse(JSON.stringify(initialCharacterData)), ...docSnap.data() };
            migrateData(characterData);
            localStorage.setItem('character_data_' + currentCharacterId, JSON.stringify(characterData));
            document.getElementById('header-name-input').value = characterData.name;
            window.renderContent();
            lucide.createIcons();
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
        lucide.createIcons();
    }
}

function triggerSaveIndicator() {
    const ind = document.getElementById('save-indicator');
    const iconWrapper = document.getElementById('save-icon-wrapper');
    const text = document.getElementById('save-text');
    
    ind.classList.remove('opacity-50');
    iconWrapper.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 text-emerald-500 animate-spin"></i>`;
    text.innerText = "Saving...";
    lucide.createIcons();

    setTimeout(() => {
        iconWrapper.innerHTML = `<i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-500"></i>`;
        text.innerText = isCloudReady ? "Saved to Cloud" : "Saved automatically";
        ind.classList.add('opacity-50');
        lucide.createIcons();
    }, 600);
}

// --- SUCCESS SAVE NOTIFICATIONS ---
function flashSuccessIndicator(textMsg) {
    const ind = document.getElementById('save-indicator');
    const iconWrapper = document.getElementById('save-icon-wrapper');
    const text = document.getElementById('save-text');
    
    ind.classList.remove('opacity-50');
    iconWrapper.innerHTML = `<i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-500"></i>`;
    text.innerText = textMsg;
    lucide.createIcons();
    
    setTimeout(() => {
        ind.classList.add('opacity-50');
        text.innerText = isCloudReady ? "Saved to Cloud" : "Saved automatically";
        lucide.createIcons();
    }, 4000);
}

window.saveData = function() {
    clearTimeout(saveTimeout);
    localStorage.setItem('character_data_' + currentCharacterId, JSON.stringify(characterData));

    const index = characterList.findIndex(c => c.id === currentCharacterId);
    if (index !== -1) {
        let nameChanged = characterList[index].name !== characterData.name;
        let raceChanged = characterList[index].race !== characterData.basics.race;
        let classChanged = characterList[index].class !== characterData.basics.class;
        if (nameChanged || raceChanged || classChanged) {
            characterList[index].name = characterData.name;
            characterList[index].race = characterData.basics.race;
            characterList[index].class = characterData.basics.class;
            localStorage.setItem('character_list', JSON.stringify(characterList));
            window.renderCharacterModalList();
        }
    }
    
    saveTimeout = setTimeout(async () => {
        if (isCloudReady && cloudUser && db && currentCharacterId) {
            try {
                isLocalSaving = true;
                await db.collection('artifacts').doc(appId).collection('users').doc(cloudUser.uid).collection('characters').doc(currentCharacterId).set(characterData);
                triggerSaveIndicator();
                setTimeout(() => { isLocalSaving = false; }, 1000);
            } catch (e) {
                console.error("Cloud save failed, relying on local backup", e);
                isLocalSaving = false;
                handleSyncError(e);
                triggerSaveIndicator();
            }
        } else { triggerSaveIndicator(); }
    }, 500);
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

// --- FULL-VAULT (ALL CHARACTERS) BACKUP EXPORT & IMPORT FLOW ---
window.exportJSON = async function() {
    const backupPayload = { vira_vault_backup: true, version: "2.0", currentCharacterId: currentCharacterId, characterList: characterList, characters: {} };
    updateCloudUIStatus("Preparing Backup...", "loader-2", "bg-amber-900/50 text-amber-400 animate-pulse");
    
    if (isCloudReady && cloudUser && db) {
        try {
            for (const char of characterList) {
                const docSnap = await db.collection('artifacts').doc(appId).collection('users').doc(cloudUser.uid).collection('characters').doc(char.id).get();
                if (docSnap.exists) { backupPayload.characters[char.id] = docSnap.data(); } 
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
                            if (isCloudReady && cloudUser && db) await db.collection('artifacts').doc(appId).collection('users').doc(cloudUser.uid).collection('characters').doc(charId).set(charData);
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
                        
                        if (isCloudReady && cloudUser && db) await db.collection('artifacts').doc(appId).collection('users').doc(cloudUser.uid).collection('characters').doc(newCharId).set(newCharData);
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

    if (email.toLowerCase() !== "trumpet101@gmail.com") {
        authError.innerText = "Access Denied: This system is private and restricted to the authorized campaign administrator.";
        authError.classList.remove('hidden');
        return;
    }

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
