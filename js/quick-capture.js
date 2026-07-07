// --- QUICK CAPTURE ---
// A floating + button always visible on screen. Opens a fast-entry popup
// where you can fire off a note to any section without leaving your current view.
// Ctrl+Space to open, Ctrl+Enter to save, Escape to close.

// --- OPEN / CLOSE ---
window.openQuickCapture = function() {
    var modal = document.getElementById('quick-capture-modal');
    var input = document.getElementById('quick-capture-text');
    if (!modal || !input) return;

    modal.classList.remove('hidden');
    input.innerHTML = '';
    input.focus();
    updateQuickCapturePreview();
};

window.closeQuickCapture = function() {
    var modal = document.getElementById('quick-capture-modal');
    if (modal) modal.classList.add('hidden');
    // Dismiss any open @mention dropdown left behind from the QC editor.
    var dropdown = document.getElementById('mention-dropdown');
    if (dropdown) dropdown.classList.add('hidden');
};

// --- KEYBOARD SHORTCUTS ---
// Shared guard: true while the user is typing somewhere (input, textarea,
// or a contenteditable note), so shortcuts never steal keystrokes.
function qcIsTypingContext() {
    var el = document.activeElement;
    if (!el) return false;
    var tag = el.tagName;
    return el.isContentEditable ||
        tag === 'TEXTAREA' ||
        (tag === 'INPUT' && el.type !== 'button');
}

document.addEventListener('keydown', function(e) {
    // "/" or Ctrl+K jumps to the global search from anywhere (retrieval
    // counterpart to Ctrl+Space capture). Skipped while typing, and when
    // the search bar is hidden (narrow layouts hide it below the sm
    // breakpoint — focusing an invisible input would just eat keys).
    var wantsSearch = (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) ||
                      ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'k' || e.key === 'K'));
    if (wantsSearch && !qcIsTypingContext()) {
        var searchInput = document.getElementById('global-search-input');
        if (searchInput && searchInput.offsetParent !== null) {
            e.preventDefault(); // "/" would type into the box; Ctrl+K is a browser shortcut
            searchInput.focus();
            searchInput.select();
        }
        return;
    }

    // Ctrl+Space to open (only when not already typing in an input/contenteditable)
    if (e.ctrlKey && e.code === 'Space') {
        if (!qcIsTypingContext()) {
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
    var dest  = document.getElementById('quick-capture-dest');
    var input = document.getElementById('quick-capture-text');
    if (!dest || !input) return;

    // html  → passed to HTML-aware destinations (thread, session, misc)
    // plain → used as plain-text titles (quest, npc, location)
    var html  = (input.innerHTML  || '').trim();
    var plain = (input.innerText  || input.textContent || '').trim();
    if (!plain) { input.focus(); return; }

    // Strip trailing empty-div/br artifacts that Chrome appends to contenteditable
    html = html.replace(/(<div>\s*<br\s*\/?>\s*<\/div>\s*)+$/i, '').trim();
    html = html.replace(/(<br\s*\/?>\s*)+$/i, '').trim();

    var type    = dest.value;
    var success = false;

    try {
        if (type === 'thread') {
            success = captureToThread(html);
        } else if (type === 'session') {
            success = captureToSession(html);
        } else if (type === 'npc') {
            success = captureToNPC(plain);
        } else if (type === 'quest') {
            success = captureToQuest(plain);
        } else if (type === 'location') {
            success = captureToLocation(plain);
        } else if (type === 'unsorted') {
            success = captureToMisc(html);
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
        // The Campaign dashboard ('campaignNotes') surfaces threads, sessions,
        // and quests, so a capture of any of those should refresh it too —
        // otherwise a thread added via the dashboard's "New" button wouldn't
        // appear until the next render.
        var dashboardTypes = ['thread', 'session', 'quest'];
        if (activeTab === tabMap[type] ||
            (activeTab === 'campaignNotes' && dashboardTypes.indexOf(type) !== -1)) {
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

function captureToThread(html) {
    var cn = characterData.campaignNotes;
    if (!Array.isArray(cn.threads)) cn.threads = [];
    cn.threads.push({
        id: 'thread_' + Date.now(),
        text: html,
        tags: [],
        resolved: false,
        resolution: ''
    });
    return true;
}

function captureToSession(html) {
    var notes = characterData.campaignNotes.sessionNotes;

    if (notes.length > 0) {
        var latest = notes[0];
        var existing = latest.notes || '';
        if (existing && existing !== '<ul><li><br></li></ul>' && existing.trim() !== '') {
            if (existing.includes('</ul>')) {
                latest.notes = existing.replace(/<\/ul>\s*$/, '<li>' + html + '</li></ul>');
            } else {
                latest.notes = existing + '<br>' + html;
            }
        } else {
            latest.notes = '<ul><li>' + html + '</li></ul>';
        }
    } else {
        var today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        notes.unshift({
            id: 'sess_' + Date.now(),
            title: 'Session Notes',
            date: today,
            notes: '<ul><li>' + html + '</li></ul>',
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

function captureToMisc(html) {
    var existing  = characterData.campaignNotes.misc || '';
    var timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    var entry     = '[' + timestamp + '] ' + html;

    if (existing && existing.trim() !== '') {
        if (existing.includes('</ul>')) {
            characterData.campaignNotes.misc = existing.replace(/<\/ul>\s*$/, '<li>' + entry + '</li></ul>');
        } else {
            characterData.campaignNotes.misc = existing + '<br>' + entry;
        }
    } else {
        characterData.campaignNotes.misc = '<ul><li>' + entry + '</li></ul>';
    }
    return true;
}
