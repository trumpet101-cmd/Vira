// --- VERSION HISTORY / TIME MACHINE ---
//
// Two layers of automatic backup:
//
//   LOCAL  - 4 snapshots in localStorage, taken at most every 5 minutes while
//            actively editing. Cheap, instant, but capped at ~5MB browser quota
//            and tied to one device. Purpose: quick undo for "I just mangled
//            this note, roll back 20 minutes."
//
//   CLOUD  - Up to 60 snapshots in Firestore, taken once per day of actual use
//            (first edit of the day triggers it, idle days write nothing).
//            Survives clearing browser data, dead laptops, and device switches.
//            Pruned with a staggered policy: last 14 days = every daily snapshot,
//            15-60 days = one per week, 60+ days = one per month. So 60
//            snapshots can cover well over a year of campaign history.
//
// Both lists are merged and shown together in the Version History modal,
// labeled with a source badge so you can see at a glance what's local vs cloud.

// --- LOCAL SNAPSHOTS ---
var VERSION_HISTORY_INTERVAL_MS = 5 * 60 * 1000; // min spacing between local snapshots
var VERSION_HISTORY_MAX_SNAPSHOTS = 4;           // localStorage is precious; 4 covers ~20min of undo
var versionHistoryLastSnapshot = 0;
var versionHistoryPendingChange = false;

// --- CLOUD SNAPSHOTS ---
var CLOUD_SNAPSHOT_MAX_ENTRIES = 60;             // hard cap after staggered pruning
var CLOUD_SNAPSHOT_DAILY_WINDOW_DAYS = 14;       // <= this age -> one per day
var CLOUD_SNAPSHOT_WEEKLY_WINDOW_DAYS = 60;      // <= this age (and > daily) -> one per week
                                                 // older than weekly window -> one per month
var CLOUD_SNAPSHOT_QUEUE_DELAY_MS = 30 * 1000;   // wait 30s after first edit of day before writing
var cloudSnapshotTimer = null;

// --- HOOK INTO THE EXISTING SAVE SYSTEM ---
// Wrap window.saveData so every edit (a) flips the pending flag for local
// snapshots, and (b) queues a cloud snapshot if today hasn't been captured yet.
(function() {
    var _originalSaveData = window.saveData;
    window.saveData = function() {
        versionHistoryPendingChange = true;
        queueDailyCloudSnapshot();
        return _originalSaveData.apply(this, arguments);
    };
})();

// Local snapshot timer: every 30s, take one if there are pending edits and 5min have passed.
setInterval(function() {
    if (!versionHistoryPendingChange) return;
    var now = Date.now();
    if (now - versionHistoryLastSnapshot < VERSION_HISTORY_INTERVAL_MS) return;
    takeVersionSnapshot();
}, 30 * 1000);

// --- LOCAL SNAPSHOT WRITE (with quota hardening) ---
// If localStorage is full (typical 5MB quota), we trim aggressively and retry
// once before giving up, so the safety net keeps working even at high note volume.
function takeVersionSnapshot() {
    var key = 'version_history_' + currentCharacterId;
    var snapshot = {
        timestamp: Date.now(),
        characterId: currentCharacterId,
        data: JSON.parse(JSON.stringify(characterData))
    };
    var history = getVersionHistory();
    history.unshift(snapshot);
    if (history.length > VERSION_HISTORY_MAX_SNAPSHOTS) {
        history = history.slice(0, VERSION_HISTORY_MAX_SNAPSHOTS);
    }

    if (tryWriteHistory(key, history)) {
        versionHistoryLastSnapshot = Date.now();
        versionHistoryPendingChange = false;
        updateVersionHistoryBadge();
        return;
    }

    // Quota exceeded: trim down to just the newest snapshot and try once more.
    // Cloud snapshots still cover the user beyond this point, so a hard local
    // trim is acceptable rather than losing the snapshot entirely.
    console.warn("Local snapshot storage full; trimming to 1 entry and retrying");
    history = history.slice(0, 1);
    if (tryWriteHistory(key, history)) {
        versionHistoryLastSnapshot = Date.now();
        versionHistoryPendingChange = false;
        updateVersionHistoryBadge();
    } else {
        // Surface the issue once so the user knows the local layer is degraded.
        // Cloud snapshots are unaffected.
        if (!window._versionHistoryQuotaWarned) {
            window._versionHistoryQuotaWarned = true;
            if (typeof showCustomAlert === 'function') {
                showCustomAlert(
                    'Local Backup Storage Full',
                    'Your browser storage is full, so local snapshots are paused. Cloud snapshots are still running normally. To free space, you can switch characters less frequently or use Backup All to export and remove old characters.',
                    '⚠️'
                );
            }
        }
    }
}

function tryWriteHistory(key, history) {
    try {
        localStorage.setItem(key, JSON.stringify(history));
        return true;
    } catch(e) {
        return false;
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

// Called when switching characters so timers don't fire on the wrong char.
window.refreshVersionHistoryForCharacter = function() {
    versionHistoryLastSnapshot = 0;
    versionHistoryPendingChange = false;
    clearTimeout(cloudSnapshotTimer);
    cloudSnapshotTimer = null;
    updateVersionHistoryBadge();
};

// Badge is intentionally a no-op; the count is visible inside the modal itself.
function updateVersionHistoryBadge() { /* no-op */ }

// =========================================================================
// CLOUD SNAPSHOTS
// =========================================================================

// "First edit of the day" trigger. We debounce 30s so we capture the user's
// in-progress state, not a half-typed sentence. The captured charId guards
// against the user switching characters during the delay.
function queueDailyCloudSnapshot() {
    if (typeof isCloudReady === 'undefined' || !isCloudReady) return;
    if (!cloudUser || !db || !currentCharacterId) return;

    var today = todayDateString();
    var charId = currentCharacterId;
    var lastKey = 'cloud_snapshot_last_date_' + charId;
    if (localStorage.getItem(lastKey) === today) return; // already snapshotted today

    clearTimeout(cloudSnapshotTimer);
    cloudSnapshotTimer = setTimeout(function() {
        // Re-check inside the timeout in case the user switched characters
        // or a parallel tab snapshotted in the meantime.
        if (currentCharacterId !== charId) return;
        var todayCheck = todayDateString();
        if (localStorage.getItem('cloud_snapshot_last_date_' + charId) === todayCheck) return;
        takeCloudSnapshot(charId, todayCheck);
    }, CLOUD_SNAPSHOT_QUEUE_DELAY_MS);
}

async function takeCloudSnapshot(charId, todayDate) {
    try {
        var ts = Date.now();
        var docId = 'snap_' + ts;
        var dataClone = JSON.parse(JSON.stringify(characterData));

        var charDocRef = db.collection('artifacts').doc(appId)
            .collection('users').doc(cloudUser.uid)
            .collection('characters').doc(charId);
        var snapshotsRef = charDocRef.collection('snapshots');

        // 1. Write the full snapshot doc (data compressed to stay under 1 MiB)
        var snapPayload = (typeof window.compressPayload === 'function') ? window.compressPayload(dataClone) : null;
        await snapshotsRef.doc(docId).set(
            snapPayload !== null
                ? { timestamp: ts, characterId: charId, _cv: 1, data: snapPayload }
                : { timestamp: ts, characterId: charId, data: dataClone }
        );

        // 2. Read the current index (tiny doc), add the new entry, prune
        var indexRef = snapshotsRef.doc('_index');
        var indexSnap = await indexRef.get();
        var entries = (indexSnap.exists && Array.isArray(indexSnap.data().entries))
            ? indexSnap.data().entries.slice()
            : [];
        entries.unshift({ ts: ts, docId: docId });
        entries.sort(function(a, b) { return b.ts - a.ts; }); // newest first

        var prune = computeSnapshotsToPrune(entries);
        if (prune.toDelete.length > 0) {
            // Batched deletes (one round-trip)
            var batch = db.batch();
            prune.toDelete.forEach(function(id) { batch.delete(snapshotsRef.doc(id)); });
            try { await batch.commit(); } catch(e) {
                // Non-fatal: if some deletes fail, the next prune will catch up.
                console.warn('Snapshot prune deletes partially failed:', e);
            }
        }

        // 3. Write updated index
        await indexRef.set({ entries: prune.toKeep });

        // 4. Mark today as done locally so we don't re-trigger
        localStorage.setItem('cloud_snapshot_last_date_' + charId, todayDate);
    } catch(e) {
        console.warn('Cloud snapshot failed; will retry on next edit:', e);
        // Don't mark the day as done -- the next saveData will queue another attempt.
    }
}

// --- STAGGERED PRUNING ---
// Walk entries newest-first. Each entry gets a bucket key based on its age:
//   <=14 days  -> bucket = YYYY-MM-DD              (one per day)
//   15-60 days -> bucket = ISO week (YYYY-Www)     (one per week)
//   >60 days   -> bucket = YYYY-MM                 (one per month)
// First entry seen in a bucket wins (it's the newest); the rest in that
// bucket are marked for deletion. Then enforce the overall cap.
function computeSnapshotsToPrune(entries) {
    var now = Date.now();
    var DAY = 24 * 60 * 60 * 1000;
    var seen = {};
    var toKeep = [];
    var toDelete = [];

    entries.forEach(function(e) {
        var ageDays = (now - e.ts) / DAY;
        var bucket;
        if (ageDays <= CLOUD_SNAPSHOT_DAILY_WINDOW_DAYS) {
            bucket = 'd:' + new Date(e.ts).toISOString().slice(0, 10);
        } else if (ageDays <= CLOUD_SNAPSHOT_WEEKLY_WINDOW_DAYS) {
            bucket = 'w:' + isoWeekKey(e.ts);
        } else {
            bucket = 'm:' + new Date(e.ts).toISOString().slice(0, 7);
        }
        if (seen[bucket]) {
            toDelete.push(e.docId);
        } else {
            seen[bucket] = true;
            toKeep.push(e);
        }
    });

    // Cap enforcement: if we still have more than the max, drop the oldest excess.
    if (toKeep.length > CLOUD_SNAPSHOT_MAX_ENTRIES) {
        var excess = toKeep.slice(CLOUD_SNAPSHOT_MAX_ENTRIES);
        excess.forEach(function(e) { toDelete.push(e.docId); });
        toKeep = toKeep.slice(0, CLOUD_SNAPSHOT_MAX_ENTRIES);
    }

    return { toKeep: toKeep, toDelete: toDelete };
}

// ISO week key (YYYY-Www). Used by the prune to bucket "15-60 days old"
// snapshots into one per calendar week.
function isoWeekKey(ts) {
    var d = new Date(ts);
    // Move to nearest Thursday: current date + 4 - current day number (Sunday = 0 -> 7)
    d.setUTCHours(0, 0, 0, 0);
    var dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return d.getUTCFullYear() + '-W' + (week < 10 ? '0' : '') + week;
}

function todayDateString() {
    return new Date().toISOString().slice(0, 10);
}

async function fetchCloudSnapshotIndex() {
    if (typeof isCloudReady === 'undefined' || !isCloudReady) return [];
    if (!cloudUser || !db || !currentCharacterId) return [];
    try {
        var indexRef = db.collection('artifacts').doc(appId)
            .collection('users').doc(cloudUser.uid)
            .collection('characters').doc(currentCharacterId)
            .collection('snapshots').doc('_index');
        var snap = await indexRef.get();
        if (!snap.exists) return [];
        var entries = snap.data().entries;
        return Array.isArray(entries) ? entries : [];
    } catch(e) {
        console.warn('Failed to fetch cloud snapshot index:', e);
        return [];
    }
}

// =========================================================================
// MODAL
// =========================================================================

window.openVersionHistory = async function() {
    var modal = document.getElementById('version-history-modal');
    var list  = document.getElementById('version-history-list');
    if (!modal || !list) return;

    // Show modal with a loading placeholder while we fetch the cloud index.
    modal.classList.remove('hidden');
    list.innerHTML = '<div class="text-center py-10 text-stone-400 dark:text-stone-500"><div class="text-2xl mb-2">⏳</div><p class="text-xs font-medium">Loading snapshots\u2026</p></div>';

    var localHistory = getVersionHistory();
    var cloudEntries = await fetchCloudSnapshotIndex();

    // Merge into a single chronological list with source tags.
    var merged = [];
    localHistory.forEach(function(snap, i) {
        merged.push({ source: 'local', timestamp: snap.timestamp, key: String(i) });
    });
    cloudEntries.forEach(function(entry) {
        merged.push({ source: 'cloud', timestamp: entry.ts, key: entry.docId });
    });
    merged.sort(function(a, b) { return b.timestamp - a.timestamp; });

    if (merged.length === 0) {
        list.innerHTML = '<div class="text-center py-10 text-stone-400 dark:text-stone-500"><div class="text-4xl mb-3">\u23F1\uFE0F</div><p class="font-semibold text-sm">No snapshots yet.</p><p class="text-xs mt-1">Snapshots are taken automatically as you edit.</p></div>';
        if (window.lucide) lucide.createIcons();
        return;
    }

    list.innerHTML = merged.map(function(s, idx) {
        var date    = new Date(s.timestamp);
        var timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        var dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        var age     = formatSnapshotAge(s.timestamp);
        var isNewest = idx === 0;

        var sourceBadge = s.source === 'cloud'
            ? '<span class="inline-flex items-center gap-1 text-[10px] font-bold bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-400 px-1.5 py-0.5 rounded uppercase tracking-wider"><i data-lucide="cloud" class="w-2.5 h-2.5"></i>Cloud</span>'
            : '<span class="inline-flex items-center gap-1 text-[10px] font-bold bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 px-1.5 py-0.5 rounded uppercase tracking-wider"><i data-lucide="hard-drive" class="w-2.5 h-2.5"></i>Local</span>';

        var iconName = isNewest ? 'clock' : (s.source === 'cloud' ? 'cloud' : 'history');
        var iconBg = isNewest
            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
            : 'bg-stone-100 dark:bg-stone-800 text-stone-400';

        return '<div class="flex items-center justify-between p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/60 hover:border-emerald-400 dark:hover:border-emerald-700 transition-all group">' +
            '<div class="flex items-center space-x-3">' +
                '<div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ' + iconBg + '"><i data-lucide="' + iconName + '" class="w-4 h-4"></i></div>' +
                '<div>' +
                    '<div class="text-sm font-bold text-stone-800 dark:text-stone-100 flex items-center space-x-2 flex-wrap gap-y-1">' +
                        '<span>' + age + '</span>' +
                        (isNewest ? '<span class="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded uppercase tracking-wider">Latest</span>' : '') +
                        sourceBadge +
                    '</div>' +
                    '<div class="text-xs text-stone-400 dark:text-stone-500 font-medium">' + dateStr + ' at ' + timeStr + '</div>' +
                '</div>' +
            '</div>' +
            '<button onclick="window.restoreSnapshot(\'' + s.source + '\', \'' + s.key + '\')" class="px-3 py-1.5 text-xs font-bold rounded-lg border border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 dark:hover:bg-emerald-700 dark:hover:border-emerald-700 transition-all opacity-0 group-hover:opacity-100">Restore</button>' +
        '</div>';
    }).join('');

    if (window.lucide) lucide.createIcons();
};

window.closeVersionHistory = function() {
    var modal = document.getElementById('version-history-modal');
    if (modal) modal.classList.add('hidden');
};

// --- UNIFIED RESTORE (handles both local and cloud sources) ---
window.restoreSnapshot = async function(source, key) {
    var snapshotData = null;
    var snapshotTs = null;

    if (source === 'local') {
        var history = getVersionHistory();
        var snap = history[parseInt(key, 10)];
        if (!snap) return;
        snapshotData = snap.data;
        snapshotTs = snap.timestamp;
    } else if (source === 'cloud') {
        try {
            var docRef = db.collection('artifacts').doc(appId)
                .collection('users').doc(cloudUser.uid)
                .collection('characters').doc(currentCharacterId)
                .collection('snapshots').doc(key);
            var docSnap = await docRef.get();
            if (!docSnap.exists) {
                if (typeof showCustomAlert === 'function') {
                    showCustomAlert('Restore Failed', 'This cloud snapshot could not be found. It may have been pruned. Reopen Version History to refresh the list.', '\u274C');
                }
                return;
            }
            var d = docSnap.data();
            var raw = (d._cv && typeof window.decompressPayload === 'function') ? window.decompressPayload(d.data) : d.data;
            if (!raw) {
                if (typeof showCustomAlert === 'function') {
                    showCustomAlert('Restore Failed', 'This cloud snapshot could not be read. It may be corrupted.', '\u274C');
                }
                return;
            }
            snapshotData = raw;
            snapshotTs = d.timestamp || Date.now();
        } catch(e) {
            console.error('Cloud snapshot fetch failed:', e);
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('Restore Failed', 'Could not retrieve snapshot from the cloud: ' + e.message, '\u274C');
            }
            return;
        }
    } else {
        return;
    }

    var age = formatSnapshotAge(snapshotTs);
    window.closeVersionHistory();

    window.showCustomConfirm(
        'Restore this version?',
        'Your sheet will revert to the snapshot from ' + age + '. Your current state will be saved as a new snapshot first so you can undo this restore too.',
        '\u23EA',
        function() {
            // Save current state as a local snapshot before overwriting
            takeVersionSnapshot();

            // Restore the data into the live character
            characterData = JSON.parse(JSON.stringify(snapshotData));
            migrateData(characterData);
            localStorage.setItem('character_data_' + currentCharacterId, JSON.stringify(characterData));

            // Push to cloud if connected (matches the original restore behaviour)
            if (typeof isCloudReady !== 'undefined' && isCloudReady && cloudUser && db) {
                db.collection('artifacts').doc(appId)
                  .collection('users').doc(cloudUser.uid)
                  .collection('characters').doc(currentCharacterId)
                  .set((typeof window.toCloudDoc === 'function') ? window.toCloudDoc(characterData) : characterData)
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

// Back-compat: anything still calling the old name routes through the new path.
window.restoreVersionSnapshot = function(index) {
    return window.restoreSnapshot('local', String(index));
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
    if (days < 31)     return days + ' day' + (days === 1 ? '' : 's') + ' ago';
    var months = Math.floor(days / 30);
    if (months < 12)   return months + ' month' + (months === 1 ? '' : 's') + ' ago';
    var years = Math.floor(days / 365);
    return years + ' year' + (years === 1 ? '' : 's') + ' ago';
}

// Initial badge update
updateVersionHistoryBadge();
