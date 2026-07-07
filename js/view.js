// =========================================================================
// PUBLIC CAMPAIGN JOURNAL VIEWER
// =========================================================================
// Loads the published snapshot from artifacts/{appId}/published/{charId}
// (charId comes from the ?c= query param) and renders it read-only.
// No sign-in: Firestore rules allow public reads on the published path only.
//
// The Firebase config below must match js/firebase-config.js. Web API keys
// are not secrets — data is protected by Firestore Security Rules.

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

firebase.initializeApp(firebaseConfig);
var db = firebase.firestore();

// --- STATE ---
var journal = null;        // { name, basics, avatar, campaignNotes }
var activeViewTab = 'sessions';
var viewTagIndex = {};     // tagKey -> { display, entries: [...] }
var selectedViewTag = '';

// --- UTILITIES ---
function escapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function stripHtml(html) {
    if (!html) return '';
    try {
        var doc = new DOMParser().parseFromString('<div>' + html + '</div>', 'text/html');
        return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
    } catch (e) { return String(html).replace(/<[^>]+>/g, '').trim(); }
}
function hasNotes(html) { return stripHtml(html).length > 0; }

var NPC_RELATIONSHIPS = {
    unknown:  { label: 'Unknown',  emoji: '⬜', classes: 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400 border-stone-200 dark:border-stone-700' },
    friendly: { label: 'Friendly', emoji: '🟢', classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
    neutral:  { label: 'Neutral',  emoji: '🔵', classes: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border-blue-200 dark:border-blue-800' },
    wary:     { label: 'Wary',     emoji: '🟡', classes: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
    hostile:  { label: 'Hostile',  emoji: '🔴', classes: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400 border-red-200 dark:border-red-800' }
};

var VIEW_TABS = [
    { key: 'sessions',  label: 'Sessions',    icon: 'scroll-text' },
    { key: 'quests',    label: 'Quests',      icon: 'swords' },
    { key: 'npcs',      label: 'NPCs',        icon: 'users' },
    { key: 'locations', label: 'Locations',   icon: 'map-pin' },
    { key: 'misc',      label: 'Misc & Loot', icon: 'package' },
    { key: 'tags',      label: 'Tags',        icon: 'tags' }
];

// Maps the app's tab ids (baked into @mention onclick attributes) to viewer tabs.
var APP_TAB_MAP = {
    campaign_sessionNotes: 'sessions',
    campaign_quests: 'quests',
    campaign_npcs: 'npcs',
    campaign_locations: 'locations',
    campaign_misc: 'misc',
    tags: 'tags'
};

// --- DARK MODE ---
window.toggleViewDark = function() {
    var on = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', on);
    localStorage.setItem('vira_view_dark', on ? 'true' : 'false');
};

// --- LIGHTBOX ---
window.openViewLightbox = function(src) {
    var lb = document.getElementById('view-lightbox');
    document.getElementById('view-lightbox-img').src = src;
    lb.classList.remove('hidden');
    lb.classList.add('flex');
};
window.closeViewLightbox = function() {
    var lb = document.getElementById('view-lightbox');
    lb.classList.add('hidden');
    lb.classList.remove('flex');
};

// --- CARD COLLAPSE (pure DOM toggle; survives until next full tab render) ---
window.toggleCard = function(id) {
    var body = document.getElementById('body-' + id);
    var chev = document.getElementById('chev-' + id);
    if (body) body.classList.toggle('collapsed');
    if (chev) chev.classList.toggle('collapsed');
};
function expandCard(id) {
    var body = document.getElementById('body-' + id);
    var chev = document.getElementById('chev-' + id);
    if (body) body.classList.remove('collapsed');
    if (chev) chev.classList.remove('collapsed');
}

// --- DEEP LINKS (@mention anchors call window.setTab, same as the main app) ---
window.setTab = function(tabId, itemId) {
    var target = APP_TAB_MAP[tabId];
    if (!target) return false; // mention target isn't part of the published journal
    selectViewTab(target);
    if (itemId) {
        setTimeout(function() {
            var el = document.getElementById(itemId);
            if (!el) return;
            expandCard(itemId);
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            el.classList.add('deeplink-flash');
            setTimeout(function() { el.classList.remove('deeplink-flash'); }, 1600);
        }, 80);
    }
    return false;
};

// --- TAGS ---
window.openTag = function(tag) {
    selectedViewTag = (tag || '').toLowerCase();
    selectViewTab('tags');
};
window.selectViewTag = function(key) {
    selectedViewTag = key;
    renderViewContent();
};

function rebuildViewTagIndex() {
    viewTagIndex = {};
    var cn = journal.campaignNotes;
    function add(entry, type, tabId, title, meta) {
        (entry.tags || []).forEach(function(raw) {
            var key = String(raw).toLowerCase().trim();
            if (!key) return;
            if (!viewTagIndex[key]) viewTagIndex[key] = { display: raw, entries: [] };
            viewTagIndex[key].entries.push({ type: type, tabId: tabId, itemId: entry.id, title: title, meta: meta });
        });
    }
    (cn.sessionNotes || []).forEach(function(s) { add(s, 'scroll-text', 'campaign_sessionNotes', s.title || 'Untitled Session', s.date || 'Session'); });
    (cn.quests || []).forEach(function(q) { add(q, 'swords', 'campaign_quests', q.title || 'Untitled Quest', q.isCompleted ? 'Completed quest' : 'Quest'); });
    (cn.npcs || []).forEach(function(f) {
        (f.members || []).forEach(function(n) { add(n, 'users', 'campaign_npcs', n.name || 'Unnamed NPC', f.name || 'NPC'); });
    });
    (cn.locations || []).forEach(function(l) { add(l, 'map-pin', 'campaign_locations', l.title || 'Untitled Location', 'Location'); });
}
function sortedViewTags() {
    return Object.keys(viewTagIndex).map(function(k) {
        return { key: k, display: viewTagIndex[k].display, count: viewTagIndex[k].entries.length };
    }).sort(function(a, b) { return b.count - a.count || a.key.localeCompare(b.key); });
}

// --- SHARED PARTIALS ---
function tagChips(entry) {
    var tags = entry.tags || [];
    if (!tags.length) return '';
    return '<div class="flex flex-wrap gap-1.5 mb-3">' + tags.map(function(t) {
        var jsTag = escapeHtml(String(t).replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
        return '<button onclick="window.openTag(\'' + jsTag + '\')" class="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 border border-stone-200 dark:border-stone-700 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-800 transition-colors">'
            + '<i data-lucide="tag" class="w-3 h-3"></i>' + escapeHtml(t) + '</button>';
    }).join('') + '</div>';
}
function notesBlock(html) {
    if (!hasNotes(html)) return '<p class="text-sm italic text-stone-400 dark:text-stone-500">No notes.</p>';
    return '<div class="notes-view whitespace-pre-wrap font-sans leading-relaxed text-stone-700 dark:text-stone-200 text-[15px]">' + html + '</div>';
}
function card(id, headerHtml, bodyHtml, extraCardClasses) {
    return '<div id="' + id + '" class="mb-4 border border-stone-200 dark:border-stone-800/80 rounded-xl bg-white dark:bg-stone-900 shadow-sm overflow-hidden scroll-mt-20 ' + (extraCardClasses || '') + '">'
        + '<button onclick="window.toggleCard(\'' + id + '\')" class="w-full text-left bg-stone-50/80 dark:bg-stone-800/60 border-b border-stone-200 dark:border-stone-800 px-5 py-4 flex justify-between items-center gap-3 transition-colors hover:bg-stone-100/80 dark:hover:bg-stone-800">'
        +   '<div class="flex-1 min-w-0">' + headerHtml + '</div>'
        +   '<i id="chev-' + id + '" data-lucide="chevron-down" class="w-5 h-5 text-stone-400 chevron flex-shrink-0"></i>'
        + '</button>'
        + '<div id="body-' + id + '" class="collapsible-content"><div class="px-5 py-4">' + bodyHtml + '</div></div>'
        + '</div>';
}
function emptyState(msg) {
    return '<p class="text-stone-500 dark:text-stone-400 text-center py-10 italic">' + escapeHtml(msg) + '</p>';
}
function sectionHeader(icon, title, subtitle) {
    return '<div class="bg-emerald-900 text-emerald-50 p-5 rounded-2xl shadow-sm flex items-center space-x-4 mb-6">'
        + '<div class="bg-emerald-800 p-2.5 rounded-xl"><i data-lucide="' + icon + '" class="w-6 h-6 text-emerald-300"></i></div>'
        + '<div><h3 class="text-xl font-bold text-white">' + escapeHtml(title) + '</h3>'
        + '<p class="text-emerald-200 text-sm">' + escapeHtml(subtitle) + '</p></div></div>';
}

// --- SECTION RENDERERS ---
function renderSessions() {
    var list = journal.campaignNotes.sessionNotes || [];
    var html = sectionHeader('scroll-text', 'Session Notes', 'The adventure log, session by session.');
    if (!list.length) return html + emptyState('No sessions have been published yet.');
    list.forEach(function(s) {
        var header = '<div class="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">'
            + '<span class="font-bold text-stone-800 dark:text-stone-100 truncate">' + escapeHtml(s.title || 'Untitled Session') + '</span>'
            + (s.date ? '<span class="text-xs font-semibold text-stone-400 dark:text-stone-500 flex-shrink-0">' + escapeHtml(s.date) + '</span>' : '')
            + '</div>';
        html += card(s.id, header, tagChips(s) + notesBlock(s.notes));
    });
    return html;
}

function renderQuests() {
    var list = journal.campaignNotes.quests || [];
    var html = sectionHeader('swords', 'Quests', 'Objectives urgent, ongoing, and complete.');
    if (!list.length) return html + emptyState('No quests have been published yet.');
    var groups = [
        { label: 'Urgent',      badge: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400',           filter: function(q) { return q.isUrgent && !q.isCompleted; } },
        { label: 'In Progress', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400', filter: function(q) { return !q.isUrgent && !q.isCompleted; } },
        { label: 'Completed',   badge: 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400',      filter: function(q) { return q.isCompleted; } }
    ];
    groups.forEach(function(g) {
        var items = list.filter(g.filter);
        if (!items.length) return;
        html += '<div class="flex items-center gap-2 mt-6 mb-3"><span class="text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-full ' + g.badge + '">' + g.label + '</span>'
             + '<span class="text-xs text-stone-400 dark:text-stone-500 font-semibold">' + items.length + '</span></div>';
        items.forEach(function(q) {
            var done = !!q.isCompleted;
            var header = '<div class="flex flex-col gap-0.5">'
                + '<span class="font-bold truncate ' + (done ? 'text-stone-400 dark:text-stone-500 line-through' : 'text-stone-800 dark:text-stone-100') + '">' + escapeHtml(q.title || 'Untitled Quest') + '</span>'
                + (q.subtitle ? '<span class="text-xs text-stone-400 dark:text-stone-500 truncate">' + escapeHtml(q.subtitle) + '</span>' : '')
                + '</div>';
            html += card(q.id, header, tagChips(q) + notesBlock(q.notes), done ? 'opacity-80' : '');
        });
    });
    return html;
}

function renderNPCs() {
    var factions = (journal.campaignNotes.npcs || []).filter(function(f) { return (f.members || []).length; });
    var html = sectionHeader('users', 'NPCs', 'Allies, villains, and everyone in between.');
    if (!factions.length) return html + emptyState('No NPCs have been published yet.');
    factions.forEach(function(f) {
        html += '<h4 class="text-sm font-black uppercase tracking-widest text-stone-500 dark:text-stone-400 mt-6 mb-3 flex items-center gap-2"><i data-lucide="shield" class="w-4 h-4 text-emerald-600"></i>' + escapeHtml(f.name || 'Unnamed Faction') + '</h4>';
        (f.members || []).forEach(function(n) {
            var rel = NPC_RELATIONSHIPS[n.relationship] || NPC_RELATIONSHIPS.unknown;
            var avatar;
            if (n.avatar) {
                var src = escapeHtml(n.avatar);
                avatar = '<img src="' + src + '" onclick="event.stopPropagation(); window.openViewLightbox(this.src)" class="w-10 h-10 rounded-full object-cover border border-stone-200 dark:border-stone-700 flex-shrink-0 cursor-zoom-in" alt="">';
            } else {
                avatar = '<div class="w-10 h-10 rounded-full bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center flex-shrink-0 text-stone-400 font-black">' + escapeHtml((n.name || '?').charAt(0).toUpperCase()) + '</div>';
            }
            var header = '<div class="flex items-center gap-3 min-w-0">' + avatar
                + '<div class="min-w-0 flex-1">'
                +   '<div class="flex items-center gap-2 flex-wrap">'
                +     '<span class="font-bold text-stone-800 dark:text-stone-100 truncate">' + escapeHtml(n.name || 'Unnamed NPC') + '</span>'
                +     '<span class="text-[11px] font-bold px-2 py-0.5 rounded-full border ' + rel.classes + '">' + rel.emoji + ' ' + rel.label + '</span>'
                +   '</div>'
                +   (n.subtitle ? '<p class="text-xs text-stone-400 dark:text-stone-500 truncate mt-0.5">' + escapeHtml(n.subtitle) + '</p>' : '')
                + '</div></div>';
            html += card(n.id, header, tagChips(n) + notesBlock(n.notes));
        });
    });
    return html;
}

function renderLocations() {
    var list = journal.campaignNotes.locations || [];
    var html = sectionHeader('map-pin', 'Locations', 'Cities, dungeons, and points of interest.');
    if (!list.length) return html + emptyState('No locations have been published yet.');
    list.forEach(function(l) {
        var header = '<div class="flex flex-col gap-0.5">'
            + '<span class="font-bold text-stone-800 dark:text-stone-100 truncate">' + escapeHtml(l.title || 'Untitled Location') + '</span>'
            + (l.subtitle ? '<span class="text-xs text-stone-400 dark:text-stone-500 truncate">' + escapeHtml(l.subtitle) + '</span>' : '')
            + '</div>';
        html += card(l.id, header, tagChips(l) + notesBlock(l.notes));
    });
    return html;
}

function renderMisc() {
    var misc = journal.campaignNotes.misc || '';
    var html = sectionHeader('package', 'Misc & Loot', 'Party treasury and loose notes.');
    if (!hasNotes(misc)) return html + emptyState('Nothing has been published here yet.');
    return html + '<div class="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800/80 rounded-xl shadow-sm p-5">' + notesBlock(misc) + '</div>';
}

function renderTags() {
    var all = sortedViewTags();
    var html = sectionHeader('tags', 'Tags', 'Browse the journal by theme, faction, or arc.');
    if (!all.length) return html + emptyState('No tags in the published journal.');
    if (!selectedViewTag || !viewTagIndex[selectedViewTag]) selectedViewTag = all[0].key;

    html += '<div class="flex flex-wrap gap-2 mb-6">' + all.map(function(t) {
        var on = t.key === selectedViewTag;
        var jsKey = escapeHtml(t.key.replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
        var cls = on
            ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
            : 'bg-white dark:bg-stone-900 text-stone-500 dark:text-stone-400 border-stone-200 dark:border-stone-700 hover:border-emerald-300 dark:hover:border-emerald-800';
        return '<button onclick="window.selectViewTag(\'' + jsKey + '\')" class="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ' + cls + '">'
            + '<i data-lucide="tag" class="w-3 h-3"></i>' + escapeHtml(t.display)
            + '<span class="opacity-60">' + t.count + '</span></button>';
    }).join('') + '</div>';

    var rec = viewTagIndex[selectedViewTag];
    html += '<div class="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800/80 rounded-xl shadow-sm divide-y divide-stone-100 dark:divide-stone-800">'
        + rec.entries.map(function(e) {
            return '<button onclick="window.setTab(\'' + e.tabId + '\', \'' + escapeHtml(e.itemId || '') + '\')" class="w-full text-left px-5 py-3.5 flex items-center gap-3 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors">'
                + '<i data-lucide="' + e.type + '" class="w-4 h-4 text-emerald-600 flex-shrink-0"></i>'
                + '<div class="min-w-0 flex-1"><p class="font-semibold text-sm text-stone-800 dark:text-stone-100 truncate">' + escapeHtml(e.title) + '</p>'
                + '<p class="text-[11px] text-stone-400 dark:text-stone-500 truncate">' + escapeHtml(e.meta) + '</p></div>'
                + '<i data-lucide="chevron-right" class="w-4 h-4 text-stone-300 dark:text-stone-600 flex-shrink-0"></i></button>';
        }).join('')
        + '</div>';
    return html;
}

// --- TAB BAR + CONTENT ---
function tabCount(key) {
    var cn = journal.campaignNotes;
    if (key === 'sessions')  return (cn.sessionNotes || []).length;
    if (key === 'quests')    return (cn.quests || []).length;
    if (key === 'npcs')      return (cn.npcs || []).reduce(function(sum, f) { return sum + (f.members || []).length; }, 0);
    if (key === 'locations') return (cn.locations || []).length;
    if (key === 'tags')      return sortedViewTags().length;
    return null; // misc has no count
}

function renderViewTabs() {
    document.getElementById('view-tabs').innerHTML = VIEW_TABS.map(function(t) {
        var on = t.key === activeViewTab;
        var count = tabCount(t.key);
        var cls = on
            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
            : 'bg-white dark:bg-stone-900 text-stone-500 dark:text-stone-400 border border-stone-200 dark:border-stone-800 hover:text-emerald-600 dark:hover:text-emerald-400';
        return '<button onclick="window.selectViewTab(\'' + t.key + '\')" class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors ' + cls + '">'
            + '<i data-lucide="' + t.icon + '" class="w-3.5 h-3.5"></i>' + t.label
            + (count !== null && count > 0 ? '<span class="text-[10px] font-black ' + (on ? 'text-emerald-100' : 'text-stone-400 dark:text-stone-500') + '">' + count + '</span>' : '')
            + '</button>';
    }).join('');
}

function renderViewContent() {
    var renderers = { sessions: renderSessions, quests: renderQuests, npcs: renderNPCs, locations: renderLocations, misc: renderMisc, tags: renderTags };
    document.getElementById('view-content').innerHTML =
        '<div class="animate-fade-in">' + renderers[activeViewTab]() + '</div>';
    renderViewTabs();
    if (window.lucide) lucide.createIcons();
}

function selectViewTab(key) {
    activeViewTab = key;
    renderViewContent();
    window.scrollTo({ top: 0 });
}
window.selectViewTab = selectViewTab;

// --- BOOT ---
function showViewError(title, message) {
    document.getElementById('view-loading').classList.add('hidden');
    document.getElementById('view-error-title').innerText = title;
    document.getElementById('view-error-message').innerText = message;
    document.getElementById('view-error').classList.remove('hidden');
}

function formatPublishedDate(ts) {
    if (!ts) return 'Published';
    try {
        var d = new Date(ts);
        return 'Published ' + d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) { return 'Published'; }
}

async function bootViewer() {
    var params = new URLSearchParams(window.location.search);
    var charId = params.get('c');
    if (!charId) {
        showViewError('Incomplete Link', 'This link is missing its journal id. Ask whoever shared it for the full link (it ends in ?c=...).');
        return;
    }
    try {
        var snap = await db.collection('artifacts').doc(appId).collection('published').doc(charId).get();
        if (!snap.exists) {
            showViewError('Journal Not Found', 'This campaign journal isn\'t published right now. It may have been unpublished by its author, or the link may be wrong.');
            return;
        }
        var d = snap.data();
        var body = null;
        if (d._pv && typeof d.payload === 'string' && typeof LZString !== 'undefined') {
            try {
                var json = LZString.decompressFromBase64(d.payload);
                body = json ? JSON.parse(json) : null;
            } catch (e) { body = null; }
        }
        if (!body && d.data) body = d.data;
        if (!body || !body.campaignNotes) {
            showViewError('Journal Unreadable', 'The published snapshot could not be read. The author may need to publish again.');
            return;
        }
        journal = body;
        rebuildViewTagIndex();

        // Header
        document.title = (journal.name || 'Campaign Journal') + ' — Campaign Journal';
        document.getElementById('view-name').innerText = journal.name || 'Campaign Journal';
        var basicsBits = [journal.basics && journal.basics.race, journal.basics && journal.basics.class].filter(Boolean);
        document.getElementById('view-basics').innerText = basicsBits.length ? basicsBits.join(' · ') : 'Campaign Journal';
        document.getElementById('view-published').innerText = formatPublishedDate(d.publishedAt);
        var avatarEl = document.getElementById('view-avatar');
        if (journal.avatar) {
            avatarEl.innerHTML = '<img src="' + escapeHtml(journal.avatar) + '" onclick="window.openViewLightbox(this.src)" class="w-full h-full object-cover cursor-zoom-in" alt="">';
        } else {
            avatarEl.innerHTML = '<span class="text-lg">🌿</span>';
        }

        document.getElementById('view-loading').classList.add('hidden');
        document.getElementById('view-shell').classList.remove('hidden');
        renderViewContent();
    } catch (e) {
        console.error('Journal load failed:', e);
        var msg = (e && e.code === 'permission-denied')
            ? 'The journal\'s cloud rules are blocking public reads. The author needs to add the published-path rule (see PUBLISH-SETUP.md).'
            : 'Something went wrong loading the journal: ' + (e.message || e.code || 'Unknown error');
        showViewError('Could Not Load Journal', msg);
    }
}

bootViewer();
