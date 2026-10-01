// --- CHARACTER SELECTOR VAULT MANAGERS ---
window.openCharacterModal = function() { document.getElementById('character-modal').classList.remove('hidden'); document.getElementById('character-modal-search').value = ''; window.renderCharacterModalList(); lucide.createIcons(); };
window.hideCharacterModal = function() { document.getElementById('character-modal').classList.add('hidden'); };

window.renderCharacterModalList = function() {
    const listContainer = document.getElementById('character-modal-list');
    if (!listContainer) return;
    const searchQuery = (document.getElementById('character-modal-search')?.value || '').toLowerCase();
    const filtered = characterList.filter(c => c.name.toLowerCase().includes(searchQuery) || c.race.toLowerCase().includes(searchQuery) || c.class.toLowerCase().includes(searchQuery) );

    if (filtered.length === 0) {
        listContainer.innerHTML = `<p class="text-stone-400 italic text-center py-6 text-xs">No matching sheets found.</p>`;
        return;
    }

    listContainer.innerHTML = filtered.map(char => {
        const isActive = char.id === currentCharacterId;
        const isLocked = window.isCharacterLocked(char.id);
        const borderClass = isActive ? 'border-emerald-500 bg-emerald-50/50' : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 bg-white dark:bg-stone-900';
        const activeBadge = isActive ? `<span class="px-2.5 py-0.5 text-[10px] font-bold bg-emerald-600 text-white rounded-full uppercase tracking-wider shadow-sm flex items-center space-x-1"><i data-lucide="check" class="w-3 h-3"></i><span>Active</span></span>` : '';
        const titleColor = isActive ? 'text-emerald-900 dark:text-emerald-400 font-extrabold' : 'text-stone-800 dark:text-stone-100 font-bold';

        return `
            <div onclick="window.switchCharacter('${char.id}')" class="p-4 border rounded-xl flex items-center justify-between cursor-pointer transition-all ${borderClass}">
                <div class="flex items-center space-x-3 min-w-0 flex-1">
                    <div class="w-9 h-9 rounded-full ${isActive ? 'bg-emerald-600 text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-500'} flex items-center justify-center font-bold text-xs flex-shrink-0">
                        ${char.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div class="min-w-0">
                        <h5 class="${titleColor} text-sm tracking-tight truncate">${escapeHtml(char.name)}</h5>
                        <p class="text-xs text-stone-500 dark:text-stone-400 truncate font-semibold">${escapeHtml(char.race)} • ${escapeHtml(char.class)}</p>
                    </div>
                </div>
                <div class="flex items-center space-x-2 flex-shrink-0 ml-4">
                    ${activeBadge}
                    <button onclick="window.toggleCharacterLock(event, '${char.id}')" class="${isLocked ? 'text-amber-500 hover:text-amber-600 bg-amber-50 dark:bg-amber-950/30' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-100 dark:hover:bg-stone-800'} p-1.5 rounded-lg transition-colors" title="${isLocked ? 'Locked \u2014 click to unlock' : 'Lock to prevent deletion'}">
                        <i data-lucide="${isLocked ? 'lock' : 'lock-open'}" class="w-4 h-4"></i>
                    </button>
                    ${isLocked ? '' : `<button onclick="window.deleteCharacter(event, '${char.id}')" class="text-stone-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-stone-800 transition-colors" title="Delete Sheet">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>`}
                </div>
            </div>`;
    }).join('');
    lucide.createIcons();
};

window.filterCharacterModalList = function() { window.renderCharacterModalList(); };

// --- VAULT DELETION LOCKS (device-local guard against accidental deletion) ---
// Lock state lives in THIS browser (localStorage), kept fully separate from the
// synced character data. A locked character hides its delete button and is
// refused by deleteCharacter; unlocking requires typing "unlock".
function getVaultLocks() {
    try { return JSON.parse(localStorage.getItem('vault_locks')) || []; }
    catch (e) { return []; }
}
window.isCharacterLocked = function(charId) { return getVaultLocks().indexOf(charId) !== -1; };
function setVaultLock(charId, locked) {
    var locks = getVaultLocks();
    var idx = locks.indexOf(charId);
    if (locked && idx === -1) locks.push(charId);
    else if (!locked && idx !== -1) locks.splice(idx, 1);
    localStorage.setItem('vault_locks', JSON.stringify(locks));
}
window.toggleCharacterLock = function(event, charId) {
    event.stopPropagation();
    var targetChar = characterList.find(function(c) { return c.id === charId; });
    var charName = targetChar ? targetChar.name : "this character";
    if (window.isCharacterLocked(charId)) {
        window.showCustomConfirm('Unlock Character?', 'Type "unlock" to remove deletion protection from "' + charName + '".', '\uD83D\uDD13', function() {
            setVaultLock(charId, false);
            window.renderCharacterModalList();
        }, "unlock");
    } else {
        setVaultLock(charId, true);
        window.renderCharacterModalList();
    }
};

window.createNewCharacter = async function() {
    const name = document.getElementById('new-char-name').value.trim();
    if (!name) { window.showCustomAlert("Validation Error", "Please provide a valid character name.", "✍️"); return; }
    const race = document.getElementById('new-char-race').value.trim() || "Unknown Race";
    const charClass = document.getElementById('new-char-class').value.trim() || "Unknown Class";

    const newCharData = getCleanCharacterData(name, race, charClass);
    const newCharId = 'char_' + Date.now();

    document.getElementById('new-char-name').value = '';
    document.getElementById('new-char-race').value = '';
    document.getElementById('new-char-class').value = '';
    window.hideCharacterModal();

    if (isCloudReady && cloudUser && db) {
        updateCloudUIStatus("Creating Character...", "loader-2", "bg-amber-900/50 text-amber-400 animate-pulse");
        try {
            await db.collection('artifacts').doc(appId).collection('users').doc(cloudUser.uid).collection('characters').doc(newCharId).set(toCloudDoc(newCharData));
            window.switchCharacter(newCharId);
        } catch (e) { console.error("Failed to write new character to cloud: ", e); handleSyncError(e); }
    } else {
        localStorage.setItem('character_data_' + newCharId, JSON.stringify(newCharData));
        characterList.push({ id: newCharId, name, race, class: charClass });
        localStorage.setItem('character_list', JSON.stringify(characterList));
        window.switchCharacter(newCharId);
    }
};

window.switchCharacter = function(charId) {
    // 1. FLUSH FIRST: push any pending debounced cloud write for the CURRENT
    //    character before the id changes. performCloudSave reads characterData
    //    and currentCharacterId synchronously, so calling it here writes the
    //    right data to the right document. (Its pendingSaveCharId guard also
    //    protects us if this flush is ever skipped.)
    if (typeof performCloudSave === 'function') performCloudSave();
    // 2. CLEAR THE EDIT LOCK: otherwise a switch within 4s of typing makes the
    //    incoming character's first snapshot get ignored, leaving the previous
    //    character's data on screen under the new id.
    if (typeof lastLocalEditTime !== 'undefined') lastLocalEditTime = 0;

    currentCharacterId = charId;
    localStorage.setItem('current_character_id', currentCharacterId);
    currentSearchQueries = { sessionNotes: '', mainQuests: '', backstoryQuests: '', quests: '', locations: '', npcs: '', backstory: '', personality: '' };
    // Reset per-character snapshot timers so version history doesn't fire
    // against the wrong character.
    if (typeof window.refreshVersionHistoryForCharacter === 'function') window.refreshVersionHistoryForCharacter();

    // 3. HYDRATE IMMEDIATELY from the local copy when one exists, even in cloud
    //    mode. The UI then never shows the previous character's data while
    //    waiting for the Firestore snapshot (and switching works offline).
    //    The snapshot, when it arrives, simply refreshes over this.
    const loaded = JSON.parse(localStorage.getItem('character_data_' + charId));
    if (loaded) {
        characterData = { ...JSON.parse(JSON.stringify(initialCharacterData)), ...loaded };
        migrateData(characterData);
        document.getElementById('header-name-input').value = characterData.name;
    } else if (!(isCloudReady && cloudUser && db)) {
        // Offline with no local copy: fall back to a clean sheet (old behaviour).
        characterData = JSON.parse(JSON.stringify(initialCharacterData));
        migrateData(characterData);
        document.getElementById('header-name-input').value = characterData.name;
    }
    // (Cloud mode with no local copy: keep current data on screen briefly and
    // let the snapshot listener below populate it, as before.)

    if (isCloudReady && cloudUser && db) {
        listenToActiveCharacter();
    }
    window.setTab('campaignNotes');
    window.hideCharacterModal();
};

window.deleteCharacter = function(event, charId) {
    event.stopPropagation();
    if (window.isCharacterLocked(charId)) {
        const lockedChar = characterList.find(c => c.id === charId);
        window.showCustomAlert("Character Locked", `"${lockedChar ? lockedChar.name : 'This character'}" is locked to prevent deletion. Unlock it from the vault first.`, "\uD83D\uDD12");
        return;
    }
    if (characterList.length <= 1) { window.showCustomAlert("Cannot Delete", "You must keep at least one character in your vault.", "🚫"); return; }
    const targetChar = characterList.find(c => c.id === charId);
    const charName = targetChar ? targetChar.name : "this character";

    window.showCustomConfirm('Delete Character?', `Are you absolutely sure you want to delete "${charName}"? This will remove all associated notes, stats, and builds.`, '🗑️', () => {
        setTimeout(() => {
            window.showCustomConfirm('Double Verification Required', `This is your final warning. To permanently erase "${charName}" and purge all campaign files from cloud nodes, type "Delete ${charName}" below.`, '🔥', async () => {
                characterList = characterList.filter(c => c.id !== charId);
                localStorage.setItem('character_list', JSON.stringify(characterList));
                localStorage.removeItem('character_data_' + charId);

                if (isCloudReady && cloudUser && db) {
                    try { await db.collection('artifacts').doc(appId).collection('users').doc(cloudUser.uid).collection('characters').doc(charId).delete(); } 
                    catch (e) { console.error("Failed to delete character on cloud: ", e); handleSyncError(e); }
                }
                if (charId === currentCharacterId) window.switchCharacter(characterList[0].id);
                else window.renderCharacterModalList();
            }, `Delete ${charName}`);
        }, 300);
    });
};

// --- AVATAR UPLOADS (DIRECT CLOUD STORAGE OBSERVERS WITH EXPLICIT TRAPS) ---
window.handleCharAvatarUpload = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const TARGET_SIZE = 512;
            let size = Math.min(img.width, img.height);
            let xOffset = (img.width - size) / 2;
            let yOffset = (img.height - size) / 2;
            canvas.width = TARGET_SIZE; canvas.height = TARGET_SIZE;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, xOffset, yOffset, size, size, 0, 0, TARGET_SIZE, TARGET_SIZE);
            
            if (typeof isCloudReady !== 'undefined' && isCloudReady && cloudUser && typeof storage !== 'undefined') {
                if (window.updateCloudUIStatus) {
                    window.updateCloudUIStatus("Uploading Portrait...", "loader-2", "bg-amber-900/50 text-amber-400 animate-pulse");
                }
                canvas.toBlob(function(blob) {
                    if (!blob) {
                        window.showCustomAlert("Image Error", "Failed to process image canvas metrics locally.", "❌");
                        if (window.updateCloudUIStatus) window.updateCloudUIStatus("Cloud Sync Active", "cloud-lightning", "bg-emerald-900/50 text-emerald-400");
                        return;
                    }
                    
                    var fileRef = storage.ref().child('users/' + cloudUser.uid + '/characters/' + currentCharacterId + '/avatar.jpg');
                    var uploadTask = fileRef.put(blob);
                    
                    // Wire state observer to intercept explicit Firebase errors
                    uploadTask.on('state_changed', 
                        function(snapshot) { /* Progress tracking channel */ }, 
                        function(error) {
                            console.error("Cloud avatar upload failed:", error);
                            window.showCustomAlert("Upload Blocked", `Google Cloud rejected file save: ${error.message}\n\nPlease check your Firebase Storage setup or rules configuration.`, "❌");
                            if (window.updateCloudUIStatus) window.updateCloudUIStatus("Cloud Sync Active", "cloud-lightning", "bg-emerald-900/50 text-emerald-400");
                        }, 
                        function() {
                            uploadTask.snapshot.ref.getDownloadURL().then(function(url) {
                                characterData.avatar = url;
                                window.saveData(); 
                                window.renderContent(); 
                                if (window.updateCloudUIStatus) window.updateCloudUIStatus("Cloud Sync Active", "cloud-lightning", "bg-emerald-900/50 text-emerald-400");
                                if (window.lucide) lucide.createIcons();
                            });
                        }
                    );
                }, 'image/jpeg', 0.85);
            } else {
                characterData.avatar = canvas.toDataURL('image/jpeg', 0.75);
                window.saveData(); window.renderContent(); lucide.createIcons();
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};
window.deleteCharAvatar = function(event) { event.stopPropagation(); delete characterData.avatar; window.saveData(); window.renderContent(); lucide.createIcons(); };

window.handleNPCAvatarUpload = function(event, facId, npcId) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const TARGET_SIZE = 512;
            let size = Math.min(img.width, img.height);
            let xOffset = (img.width - size) / 2;
            let yOffset = (img.height - size) / 2;
            canvas.width = TARGET_SIZE; canvas.height = TARGET_SIZE;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, xOffset, yOffset, size, size, 0, 0, TARGET_SIZE, TARGET_SIZE);
            
            if (typeof isCloudReady !== 'undefined' && isCloudReady && cloudUser && typeof storage !== 'undefined') {
                if (window.updateCloudUIStatus) {
                    window.updateCloudUIStatus("Uploading NPC...", "loader-2", "bg-amber-900/50 text-amber-400 animate-pulse");
                }
                canvas.toBlob(function(blob) {
                    if (!blob) {
                        window.showCustomAlert("Image Error", "Failed to process image canvas metrics locally.", "❌");
                        if (window.updateCloudUIStatus) window.updateCloudUIStatus("Cloud Sync Active", "cloud-lightning", "bg-emerald-900/50 text-emerald-400");
                        return;
                    }
                    
                    var fileRef = storage.ref().child('users/' + cloudUser.uid + '/characters/' + currentCharacterId + '/npcs/' + npcId + '.jpg');
                    var uploadTask = fileRef.put(blob);
                    
                    // Wire state observer to intercept explicit Firebase errors
                    uploadTask.on('state_changed', 
                        function(snapshot) { /* Progress tracking channel */ }, 
                        function(error) {
                            console.error("Cloud NPC upload failed:", error);
                            window.showCustomAlert("Upload Blocked", `Google Cloud rejected file save: ${error.message}\n\nPlease check your Firebase Storage setup or rules configuration.`, "❌");
                            if (window.updateCloudUIStatus) window.updateCloudUIStatus("Cloud Sync Active", "cloud-lightning", "bg-emerald-900/50 text-emerald-400");
                        }, 
                        function() {
                            uploadTask.snapshot.ref.getDownloadURL().then(function(url) {
                                const fac = characterData.campaignNotes.npcs.find(f => f.id === facId);
                                if (fac) {
                                    const npc = fac.members.find(n => n.id === npcId);
                                    if (npc) { npc.avatar = url; window.saveData(); window.renderContent(); }
                                }
                                if (window.updateCloudUIStatus) window.updateCloudUIStatus("Cloud Sync Active", "cloud-lightning", "bg-emerald-900/50 text-emerald-400");
                                if (window.lucide) lucide.createIcons();
                            });
                        }
                    );
                }, 'image/jpeg', 0.85);
            } else {
                const fac = characterData.campaignNotes.npcs.find(f => f.id === facId);
                if (fac) {
                    const npc = fac.members.find(n => n.id === npcId);
                    if (npc) { npc.avatar = canvas.toDataURL('image/jpeg', 0.75); window.saveData(); window.renderContent(); lucide.createIcons(); }
                }
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};
window.deleteNPCAvatar = function(event, facId, npcId) {
    event.stopPropagation();
    const fac = characterData.campaignNotes.npcs.find(f => f.id === facId);
    if (fac) {
        const npc = fac.members.find(n => n.id === npcId);
        if (npc) { delete npc.avatar; window.saveData(); window.renderContent(); lucide.createIcons(); }
    }
};