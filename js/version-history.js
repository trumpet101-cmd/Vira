// --- VERSION HISTORY / TIME MACHINE ---
// Takes a silent snapshot of the current character at most once every 5 minutes,
// only when actual edits have been made. Keeps the last 10 snapshots per character
// in localStorage. No cloud storage used — all local and free.

var VERSION_HISTORY_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
var VERSION_HISTORY_MAX_SNAPSHOTS = 10;
var versionHistoryLastSnapshot = 0;      // timestamp of last snapshot taken
var versionHistoryPendingChange = false; // flipped to true when saveData fires

// --- HOOK INTO THE EXISTING SAVE SYSTEM ---
// We wrap window.saveData so we don't have to touch cloud.js at all.
// Every time the app saves, we flag that a change happened. Then our
// interval timer checks that flag and takes a snapshot if it's set.
(function() {
    var _originalSaveData = window.saveData;
    window.saveData = function() {
        versionHistoryPendingChange = true;
        return _originalSaveData.apply(this, arguments);
    };
})();

// Check every 30 seconds whether a snapshot is due.
setInterval(function() {
    if (!versionHistoryPendingChange) return;
    var now = Date.now();
    if (now - versionHistoryLastSnapshot < VERSION_HISTORY_INTERVAL_MS) return;
    takeVersionSnapshot();
}, 30 * 1000);

function takeVersionSnapshot() {
    try {
        var snapshot = {
            timestamp: Date.now(),
            characterId: currentCharacterId,
            data: JSON.parse(JSON.stringify(characterData))
        };

        var key = 'version_history_' + currentCharacterId;
        var history = getVersionHistory();
        history.unshift(snapshot); // newest first
        if (history.length > VERSION_HISTORY_MAX_SNAPSHOTS) {
            history = history.slice(0, VERSION_HISTORY_MAX_SNAPSHOTS);
        }

        localStorage.setItem(key, JSON.stringify(history));
        versionHistoryLastSnapshot = Date.now();
        versionHistoryPendingChange = false;
        updateVersionHistoryBadge();
    } catch(e) {
        console.warn("Version snapshot failed (localStorage may be full):", e);
    }
}

function getVersionHistory() {
    try {
        var key = 'version_history_' + currentCharacterId;
        return JSON.parse(localStorage.getItem(key)) || [];
    } catch(e) {
        return [];
    }
}

// Called when switching characters so the badge count stays accurate
window.refreshVersionHistoryForCharacter = function() {
    versionHistoryLastSnapshot = 0;
    versionHistoryPendingChange = false;
    updateVersionHistoryBadge();
};

// --- BADGE: shows snapshot count on the button ---
function updateVersionHistoryBadge() {
    var badge = document.getElementById('version-history-badge');
    if (!badge) return;
    var count = getVersionHistory().length;
    if (count > 0) {
        badge.textContent = count;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

// --- MODAL: open the history panel ---
window.openVersionHistory = function() {
    var history = getVersionHistory();
    var modal = document.getElementById('version-history-modal');
    var list  = document.getElementById('version-history-list');
    if (!modal || !list) return;

    if (history.length === 0) {
        list.innerHTML = `
            <div class="text-center py-10 text-stone-400 dark:text-stone-500">
                <div class="text-4xl mb-3">⏱️</div>
                <p class="font-semibold text-sm">No snapshots yet.</p>
                <p class="text-xs mt-1">Snapshots are taken automatically every 5 minutes while you edit.</p>
            </div>`;
    } else {
        list.innerHTML = history.map(function(snap, i) {
            var date  = new Date(snap.timestamp);
            var timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            var dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
            var age   = formatSnapshotAge(snap.timestamp);
            var isNewest = i === 0;

            return `
            <div class="flex items-center justify-between p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/60 hover:border-emerald-400 dark:hover:border-emerald-700 transition-all group">
                <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isNewest ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400' : 'bg-stone-100 dark:bg-stone-800 text-stone-400'}">
                        <i data-lucide="${isNewest ? 'clock' : 'history'}" class="w-4 h-4"></i>
                    </div>
                    <div>
                        <div class="text-sm font-bold text-stone-800 dark:text-stone-100 flex items-center space-x-2">
                            <span>${age}</span>
                            ${isNewest ? '<span class="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded uppercase tracking-wider">Latest</span>' : ''}
                        </div>
                        <div class="text-xs text-stone-400 dark:text-stone-500 font-medium">${dateStr} at ${timeStr}</div>
                    </div>
                </div>
                <button
                    onclick="window.restoreVersionSnapshot(${i})"
                    class="px-3 py-1.5 text-xs font-bold rounded-lg border border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 dark:hover:bg-emerald-700 dark:hover:border-emerald-700 transition-all opacity-0 group-hover:opacity-100">
                    Restore
                </button>
            </div>`;
        }).join('');
    }

    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
};

window.closeVersionHistory = function() {
    var modal = document.getElementById('version-history-modal');
    if (modal) modal.classList.add('hidden');
};

// --- RESTORE a snapshot ---
window.restoreVersionSnapshot = function(index) {
    var history = getVersionHistory();
    var snap = history[index];
    if (!snap) return;

    var age = formatSnapshotAge(snap.timestamp);
    window.closeVersionHistory();

    window.showCustomConfirm(
        'Restore this version?',
        'Your sheet will revert to the snapshot from ' + age + '. Your current state will be saved as a new snapshot first so you can undo this restore too.',
        '⏪',
        function() {
            // Save current state as a snapshot before overwriting
            takeVersionSnapshot();

            // Restore
            characterData = JSON.parse(JSON.stringify(snap.data));
            migrateData(characterData);
            localStorage.setItem('character_data_' + currentCharacterId, JSON.stringify(characterData));

            // Push to cloud if connected
            if (typeof isCloudReady !== 'undefined' && isCloudReady && cloudUser && db) {
                db.collection('artifacts').doc(appId)
                  .collection('users').doc(cloudUser.uid)
                  .collection('characters').doc(currentCharacterId)
                  .set(characterData)
                  .catch(function(e) { console.error("Restore cloud sync failed:", e); });
            }

            document.getElementById('header-name-input').value = characterData.name;
            window.renderContent();
            if (window.lucide) lucide.createIcons();
            updateVersionHistoryBadge();

            if (typeof flashSuccessIndicator === 'function') {
                flashSuccessIndicator('Version restored!');
            }
        }
    );
};

// --- HELPER: human-readable age string ---
function formatSnapshotAge(timestamp) {
    var seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60)  return 'Just now';
    var minutes = Math.floor(seconds / 60);
    if (minutes < 60)  return minutes + ' minute' + (minutes === 1 ? '' : 's') + ' ago';
    var hours = Math.floor(minutes / 60);
    if (hours < 24)    return hours + ' hour' + (hours === 1 ? '' : 's') + ' ago';
    var days = Math.floor(hours / 24);
    return days + ' day' + (days === 1 ? '' : 's') + ' ago';
}

// Initialise badge on page load
updateVersionHistoryBadge();
