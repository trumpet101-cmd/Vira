// --- QUICK CAPTURE ---
// A floating + button always visible on screen. Opens a fast-entry popup
// where you can fire off a note to any section without leaving your current view.
// Ctrl+Space to open, Ctrl+Enter to save, Escape to close.

// --- OPEN / CLOSE ---
window.openQuickCapture = function() {
    var modal = document.getElementById('quick-capture-modal');
    var textarea = document.getElementById('quick-capture-text');
    if (!modal || !textarea) return;

    modal.classList.remove('hidden');
    textarea.value = '';
    textarea.focus();
    updateQuickCapturePreview();
};

window.closeQuickCapture = function() {
    var modal = document.getElementById('quick-capture-modal');
    if (modal) modal.classList.add('hidden');
};

// --- KEYBOARD SHORTCUTS ---
document.addEventListener('keydown', function(e) {
    // Ctrl+Space to open (only when not already typing in an input/contenteditable)
    if (e.ctrlKey && e.code === 'Space') {
        var tag = document.activeElement && document.activeElement.tagName;
        var isEditing = document.activeElement &&
            (document.activeElement.isContentEditable ||
             tag === 'TEXTAREA' ||
             (tag === 'INPUT' && document.activeElement.type !== 'button'));

        if (!isEditing) {
            e.preventDefault();
            window.openQuickCapture();
            return;
        }
    }

    // Escape to close
    if (e.key === 'Escape') {
        var modal = document.getElementById('quick-capture-modal');
        if (modal && !modal.classList.contains('hidden')) {
            window.closeQuickCapture();
        }
    }
});

// Ctrl+Enter inside the textarea to save
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'Enter') {
        var modal = document.getElementById('quick-capture-modal');
        if (modal && !modal.classList.contains('hidden')) {
            e.preventDefault();
            window.saveQuickCapture();
        }
    }
});

// --- DESTINATION PREVIEW ---
// Shows a small hint under the dropdown so the user knows exactly where
// their note will land before they hit save.
window.updateQuickCapturePreview = function() {
    var dest = document.getElementById('quick-capture-dest');
    var preview = document.getElementById('quick-capture-preview');
    if (!dest || !preview) return;

    var messages = {
        'thread':    '🧵 Adds a new open thread — a question or loose end to investigate.',
        'session':   '📋 Appends to your most recent session note (or creates a new one).',
        'npc':       '👤 Creates a new NPC inside a "Quick Capture" faction.',
        'quest':     '⚔️ Adds a new in-progress quest with your text as the title.',
        'location':  '📍 Adds a new location with your text as the title.',
        'unsorted':  '📦 Appends to the Misc & Loot scratchpad.'
    };

    preview.textContent = messages[dest.value] || '';
};

// --- SAVE ---
window.saveQuickCapture = function() {
    var dest     = document.getElementById('quick-capture-dest');
    var textarea = document.getElementById('quick-capture-text');
    if (!dest || !textarea) return;

    var text = textarea.value.trim();
    if (!text) {
        textarea.focus();
        return;
    }

    var type = dest.value;
    var success = false;

    try {
        if (type === 'thread') {
            success = captureToThread(text);
        } else if (type === 'session') {
            success = captureToSession(text);
        } else if (type === 'npc') {
            success = captureToNPC(text);
        } else if (type === 'quest') {
            success = captureToQuest(text);
        } else if (type === 'location') {
            success = captureToLocation(text);
        } else if (type === 'unsorted') {
            success = captureToMisc(text);
        }
    } catch(e) {
        console.error("Quick capture save failed:", e);
    }

    if (success) {
        window.saveData();
        window.closeQuickCapture();

        // Re-render only if the user is already on the destination tab,
        // so we don't yank them away from wherever they were.
        var tabMap = {
            'thread':   'campaign_sessionNotes',
            'session':  'campaign_sessionNotes',
            'npc':      'campaign_npcs',
            'quest':    'campaign_quests',
            'location': 'campaign_locations',
            'unsorted': 'campaign_misc'
        };
        if (activeTab === tabMap[type]) {
            window.renderContent();
            if (window.lucide) lucide.createIcons();
        }

        if (typeof flashSuccessIndicator === 'function') {
            var labels = {
                'thread':   'Thread added!',
                'session':  'Note added to Session Log!',
                'npc':      'NPC added to Quick Capture faction!',
                'quest':    'Quest added!',
                'location': 'Location added!',
                'unsorted': 'Note added to Misc & Loot!'
            };
            flashSuccessIndicator(labels[type] || 'Captured!');
        }
    }
};

// --- CAPTURE HANDLERS ---

function captureToThread(text) {
    var cn = characterData.campaignNotes;
    if (!Array.isArray(cn.threads)) cn.threads = [];
    cn.threads.push({
        id: 'thread_' + Date.now(),
        text: escapeHtml(text),
        tags: [],
        resolved: false,
        resolution: ''
    });
    return true;
}

function captureToSession(text) {
    var notes = characterData.campaignNotes.sessionNotes;

    if (notes.length > 0) {
        // Append to the most recent session note
        var latest = notes[0];
        var existing = latest.notes || '';
        // If there's already content, add a line break before the new text
        if (existing && existing !== '<ul><li><br></li></ul>' && existing.trim() !== '') {
            // Append as a new bullet item inside existing list, or as a new paragraph
            if (existing.includes('</ul>')) {
                latest.notes = existing.replace(/<\/ul>\s*$/, '<li>' + escapeHtml(text) + '</li></ul>');
            } else {
                latest.notes = existing + '<br>' + escapeHtml(text);
            }
        } else {
            latest.notes = '<ul><li>' + escapeHtml(text) + '</li></ul>';
        }
    } else {
        // No session notes exist yet — create one
        var today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        notes.unshift({
            id: 'sess_' + Date.now(),
            title: 'Session Notes',
            date: today,
            notes: '<ul><li>' + escapeHtml(text) + '</li></ul>',
            isCollapsed: false
        });
    }
    return true;
}

function captureToNPC(text) {
    var npcs = characterData.campaignNotes.npcs;

    // Find or create the "Quick Capture" faction
    var faction = npcs.find(function(f) { return f.name === 'Quick Capture'; });
    if (!faction) {
        faction = {
            id: 'fac_quickcapture',
            name: 'Quick Capture',
            isCollapsed: false,
            members: []
        };
        npcs.unshift(faction);
    }

    faction.members.push({
        id: 'npc_' + Date.now(),
        name: text,
        subtitle: '',
        notes: '',
        isCollapsed: false
    });
    return true;
}

function captureToQuest(text) {
    characterData.campaignNotes.quests.unshift({
        id: 'quest_' + Date.now(),
        title: text,
        subtitle: '',
        notes: '',
        isCompleted: false
    });
    return true;
}

function captureToLocation(text) {
    characterData.campaignNotes.locations.unshift({
        id: 'loc_' + Date.now(),
        title: text,
        subtitle: '',
        notes: '',
        isCollapsed: false
    });
    return true;
}

function captureToMisc(text) {
    var existing = characterData.campaignNotes.misc || '';
    var timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (existing && existing.trim() !== '') {
        if (existing.includes('</ul>')) {
            characterData.campaignNotes.misc = existing.replace(
                /<\/ul>\s*$/,
                '<li>[' + timestamp + '] ' + escapeHtml(text) + '</li></ul>'
            );
        } else {
            characterData.campaignNotes.misc = existing + '<br>[' + timestamp + '] ' + escapeHtml(text);
        }
    } else {
        characterData.campaignNotes.misc = '<ul><li>[' + timestamp + '] ' + escapeHtml(text) + '</li></ul>';
    }
    return true;
}
