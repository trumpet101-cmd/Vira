// --- RENDERERS ---

// NPC relationship status config
var NPC_RELATIONSHIPS = {
    unknown:  { label: 'Unknown',  emoji: '⬜', classes: 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400 border-stone-200 dark:border-stone-700' },
    friendly: { label: 'Friendly', emoji: '🟢', classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
    neutral:  { label: 'Neutral',  emoji: '🔵', classes: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border-blue-200 dark:border-blue-800' },
    wary:     { label: 'Wary',     emoji: '🟡', classes: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
    hostile:  { label: 'Hostile',  emoji: '🔴', classes: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400 border-red-200 dark:border-red-800' }
};

function renderRelationshipBadge(facId, npcId, current) {
    var rel = NPC_RELATIONSHIPS[current] || NPC_RELATIONSHIPS.unknown;
    return `
    <div class="relative inline-block flex-shrink-0" id="rel-wrapper-${npcId}">
        <select
            onchange="window.updateNPCRelationship('${facId}', '${npcId}', this.value)"
            class="appearance-none text-[11px] font-bold pl-2 pr-6 py-0.5 rounded-full border cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 ${rel.classes}"
            title="Relationship status">
            ${Object.entries(NPC_RELATIONSHIPS).map(([key, r]) =>
                `<option value="${key}" ${key === (current || 'unknown') ? 'selected' : ''}>${r.emoji} ${r.label}</option>`
            ).join('')}
        </select>
        <div class="pointer-events-none absolute inset-y-0 right-1.5 flex items-center">
            <svg class="w-2.5 h-2.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 9l-7 7-7-7"/></svg>
        </div>
    </div>`;
}

// ============================================================
// --- UTILITY: Strip HTML to plain text ---
// Used by the backlink and tag engines for threads (which store text as HTML).
// Also used by renderThreadsPanel for snippet display.
function stripHtmlToText(html) {
    if (!html) return '';
    try {
        var doc = new DOMParser().parseFromString('<div>' + html + '</div>', 'text/html');
        return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
    } catch(e) {
        return html.replace(/<[^>]+>/g, '').trim();
    }
}

// ============================================================
// --- BACKLINKS ENGINE ---
// Derives "Referenced in" links for any entry by scanning every
// session / quest / location note for @mention links that point at it.
// Nothing is stored: the index is rebuilt from existing data on each
// full render. Per-card type toggles are ephemeral (reset on reload).
// ============================================================

var BACKLINK_COLLAPSED = 4;          // how many rows show before "Show all"
var BACKLINK_FILTER_TYPE = 'session'; // which type exposes the text filter

var BACKLINK_TYPES = [
    { key: 'session',   label: 'Sessions',      icon: 'scroll-text', tab: 'campaign_sessionNotes' },
    { key: 'mainquest', label: 'Main Campaign', icon: 'crown',       tab: 'campaign_mainQuests' },
    { key: 'bkquest',   label: 'Backstory Q.',  icon: 'sprout',      tab: 'campaign_backstoryQuests' },
    { key: 'quest',     label: 'Side Quests',   icon: 'swords',      tab: 'campaign_quests' },
    { key: 'location',  label: 'Locations',     icon: 'map-pin',     tab: 'campaign_locations' },
    { key: 'thread',    label: 'Threads',       icon: 'help-circle', tab: 'campaign_sessionNotes' }
];
var BACKLINK_ICONS = { session: 'scroll-text', mainquest: 'crown', bkquest: 'sprout', quest: 'swords', location: 'map-pin', thread: 'help-circle' };

// targetEntryId -> [ { tabId, sourceId, sourceType, title, meta, snippet, mentionText } ]
var backlinkIndex = {};

// entryId -> { active: {session, quest, location}, expanded, query }   (ephemeral)
var backlinkState = {};

function getBacklinkState(entryId) {
    if (!backlinkState[entryId]) {
        backlinkState[entryId] = {
            active: { session: false, mainquest: true, bkquest: true, quest: true, location: true, thread: true }, // global default
            expanded: false,
            query: ''
        };
    }
    return backlinkState[entryId];
}

// Pull every @mention target id (and its anchor, for snippet text) out of a notes HTML blob.
function extractMentionTargets(html) {
    var out = [];
    if (!html || html.indexOf('setTab') === -1) return out;
    try {
        var doc = new DOMParser().parseFromString('<div>' + html + '</div>', 'text/html');
        var anchors = doc.querySelectorAll('a[onclick]');
        anchors.forEach(function(a) {
            var oc = a.getAttribute('onclick') || '';
            var m = oc.match(/setTab\(\s*'([^']*)'\s*,\s*'([^']*)'\s*\)/);
            if (m && m[2]) {
                var block = a.closest('li, p, div') || a.parentNode;
                var raw = (block ? block.textContent : a.textContent) || '';
                out.push({
                    itemId: m[2],
                    mentionText: (a.textContent || '').trim(),
                    snippet: raw.replace(/\s+/g, ' ').trim()
                });
            }
        });
    } catch (e) { /* malformed html — skip silently */ }
    return out;
}

// Rebuild the whole index from current characterData. Called at the top of renderContent.
window.rebuildBacklinkIndex = function() {
    backlinkIndex = {};
    var cn = (typeof characterData !== 'undefined' && characterData) ? characterData.campaignNotes : null;
    if (!cn) return;

    function addSource(html, srcId, srcType, tabId, title, meta) {
        var targets = extractMentionTargets(html);
        var seen = {};
        targets.forEach(function(t) {
            if (t.itemId === srcId) return;   // never list an entry as referencing itself
            if (seen[t.itemId]) return;       // one backlink per source entry, even if mentioned twice
            seen[t.itemId] = true;
            if (!backlinkIndex[t.itemId]) backlinkIndex[t.itemId] = [];
            backlinkIndex[t.itemId].push({
                tabId: tabId, sourceId: srcId, sourceType: srcType,
                title: title || '(untitled)', meta: meta || '',
                snippet: t.snippet, mentionText: t.mentionText
            });
        });
    }

    (cn.sessionNotes || []).forEach(function(s) { addSource(s.notes, s.id, 'session',  'campaign_sessionNotes', s.title || 'Untitled session', s.date || ''); });
    (cn.mainQuests || []).forEach(function(s)      { addSource(s.notes, s.id, 'mainquest', 'campaign_mainQuests',      s.title || 'Untitled entry', 'Main Campaign'); });
    (cn.backstoryQuests || []).forEach(function(s) { addSource(s.notes, s.id, 'bkquest',   'campaign_backstoryQuests', s.title || 'Untitled entry', 'Backstory Quest'); });
    (cn.quests || []).forEach(function(q)       { addSource(q.notes, q.id, 'quest',    'campaign_quests',       q.title || 'Untitled quest', 'Quest'); });
    (cn.locations || []).forEach(function(l)    { addSource(l.notes, l.id, 'location', 'campaign_locations',    l.title || 'Untitled location', 'Location'); });
    (cn.threads || []).forEach(function(t)      { addSource(t.text,  t.id, 'thread',   'campaign_sessionNotes', stripHtmlToText(t.text).slice(0, 60) || 'Open thread', 'Thread'); });
};

function getBacklinks(entryId) { return backlinkIndex[entryId] || []; }

function clipBacklinkSnippet(raw, mentionText) {
    if (!raw) return '';
    var MAX = 160;
    if (raw.length <= MAX) return raw;
    var idx = mentionText ? raw.indexOf(mentionText) : -1;
    if (idx === -1) return raw.slice(0, MAX).trim() + '…';
    var start = Math.max(0, idx - 55);
    var end = Math.min(raw.length, idx + mentionText.length + 85);
    var s = raw.slice(start, end).trim();
    if (start > 0) s = '…' + s;
    if (end < raw.length) s = s + '…';
    return s;
}

function highlightBacklinkSnippet(clipped, mentionText) {
    var esc = escapeHtml(clipped || '');
    if (mentionText) {
        var escM = escapeHtml(mentionText);
        if (escM && esc.indexOf(escM) !== -1) {
            esc = esc.split(escM).join('<span class="text-emerald-700 bg-emerald-100/70 dark:text-emerald-300 dark:bg-emerald-950/50 font-semibold px-1 rounded">' + escM + '</span>');
        }
    }
    return esc;
}

// Apply the active type toggles + text filter, then collapse to N unless expanded/searching.
function computeBacklinkView(entryId) {
    var all = getBacklinks(entryId);
    var st = getBacklinkState(entryId);
    var q = (st.query || '').toLowerCase();

    var filtered = all.filter(function(b) {
        if (!st.active[b.sourceType]) return false;
        if (q) {
            var hay = ((b.title || '') + ' ' + (b.snippet || '')).toLowerCase();
            if (hay.indexOf(q) === -1) return false;
        }
        return true;
    });

    var hiddenExist = all.some(function(b) { return !st.active[b.sourceType]; });
    var shown = (q || st.expanded) ? filtered : filtered.slice(0, BACKLINK_COLLAPSED);

    var emptyMsg = '';
    if (filtered.length === 0) {
        if (q) emptyMsg = 'No mentions match that filter.';
        else if (hiddenExist) emptyMsg = 'Tap a type above to view its references.';
        else emptyMsg = 'No references yet.';
    }

    return {
        shown: shown,
        emptyMsg: emptyMsg,
        showBtn: !q && filtered.length > BACKLINK_COLLAPSED,
        btnLabel: st.expanded ? 'Show fewer' : ('Show all ' + filtered.length)
    };
}

function renderBacklinkRowHtml(b) {
    var icon = BACKLINK_ICONS[b.sourceType] || 'file-text';
    var metaHtml = b.meta ? ' <span class="text-[11px] font-normal text-stone-400 dark:text-stone-500">· ' + escapeHtml(b.meta) + '</span>' : '';
    var snip = highlightBacklinkSnippet(clipBacklinkSnippet(b.snippet, b.mentionText), b.mentionText);
    return '<button onclick="window.setTab(\'' + b.tabId + '\', \'' + b.sourceId + '\'); return false;" '
        + 'class="w-full text-left flex items-start gap-2.5 p-2 rounded-lg bg-stone-50 dark:bg-stone-950 border border-transparent hover:border-stone-200 dark:hover:border-stone-700 hover:bg-stone-100/70 dark:hover:bg-stone-800/40 transition-all group">'
        + '<i data-lucide="' + icon + '" class="w-4 h-4 text-stone-400 mt-0.5 flex-shrink-0"></i>'
        + '<span class="flex-1 min-w-0">'
        +   '<span class="block text-sm font-semibold text-stone-700 dark:text-stone-200 truncate">' + escapeHtml(b.title) + metaHtml + '</span>'
        +   '<span class="block text-xs text-stone-500 dark:text-stone-400 leading-snug mt-0.5">' + snip + '</span>'
        + '</span>'
        + '<i data-lucide="chevron-right" class="w-4 h-4 text-stone-300 dark:text-stone-600 group-hover:text-emerald-500 self-center flex-shrink-0"></i>'
        + '</button>';
}

// Full panel. Returns '' when an entry has no backlinks at all, so clean cards stay clean.
function renderBacklinksPanel(entryId) {
    var all = getBacklinks(entryId);
    if (!all.length) return '';

    var st = getBacklinkState(entryId);
    var counts = { session: 0, mainquest: 0, bkquest: 0, quest: 0, location: 0, thread: 0 };
    all.forEach(function(b) { if (counts[b.sourceType] !== undefined) counts[b.sourceType]++; });

    var chips = BACKLINK_TYPES.filter(function(t) { return counts[t.key] > 0; }).map(function(t) {
        var on = st.active[t.key];
        var chipCls = on
            ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
            : 'bg-transparent text-stone-400 dark:text-stone-500 border-stone-200 dark:border-stone-700 hover:text-stone-600 dark:hover:text-stone-300';
        var numCls = on
            ? 'bg-emerald-600 text-white dark:bg-emerald-500'
            : 'bg-stone-100 text-stone-400 dark:bg-stone-800 dark:text-stone-500';
        return '<button onclick="window.toggleBacklinkType(\'' + entryId + '\', \'' + t.key + '\')" '
            + 'class="inline-flex items-center gap-1.5 text-xs font-semibold pl-2.5 pr-1.5 py-1 rounded-full border transition-all focus:outline-none ' + chipCls + '">'
            + '<i data-lucide="' + t.icon + '" class="w-3.5 h-3.5"></i>' + t.label
            + '<span class="text-[10px] leading-none px-1.5 py-0.5 rounded-full ' + numCls + '">' + counts[t.key] + '</span>'
            + '</button>';
    }).join('');

    var searchHtml = st.active[BACKLINK_FILTER_TYPE]
        ? '<div class="relative mb-2.5">'
            + '<i data-lucide="search" class="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2"></i>'
            + '<input type="text" value="' + escapeHtml(st.query) + '" oninput="window.filterBacklinks(\'' + entryId + '\', this.value)" placeholder="Filter mentions..." '
            + 'class="seamless-input w-full text-xs pl-7 pr-2.5 py-1.5 border border-stone-200 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 rounded-lg bg-white focus:ring-1 focus:ring-emerald-500 focus:outline-none">'
            + '</div>'
        : '';

    var view = computeBacklinkView(entryId);
    var rowsHtml = view.shown.map(renderBacklinkRowHtml).join('');

    return '<div id="backlinks-' + entryId + '" class="mt-3 pt-3 border-t border-stone-100 dark:border-stone-800">'
        + '<div class="flex items-center gap-2 mb-2">'
        +   '<i data-lucide="link" class="w-4 h-4 text-emerald-600 dark:text-emerald-400"></i>'
        +   '<span class="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Referenced in</span>'
        + '</div>'
        + '<div class="flex flex-wrap gap-1.5 mb-2.5">' + chips + '</div>'
        + searchHtml
        + '<div id="bl-list-' + entryId + '" class="space-y-1.5">' + rowsHtml + '</div>'
        + '<p id="bl-empty-' + entryId + '" class="text-xs text-stone-400 dark:text-stone-500 italic py-2 ' + (view.emptyMsg ? '' : 'hidden') + '">' + (view.emptyMsg || '') + '</p>'
        + '<button id="bl-btn-' + entryId + '" onclick="window.toggleBacklinkExpand(\'' + entryId + '\')" '
        +   'class="' + (view.showBtn ? '' : 'hidden') + ' w-full mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 py-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors">'
        +   view.btnLabel
        + '</button>'
        + '</div>';
}

// Re-render only the list/empty/button region — preserves focus in the filter input.
function updateBacklinkList(entryId) {
    var view = computeBacklinkView(entryId);
    var listEl = document.getElementById('bl-list-' + entryId);
    var emptyEl = document.getElementById('bl-empty-' + entryId);
    var btnEl = document.getElementById('bl-btn-' + entryId);
    if (listEl) listEl.innerHTML = view.shown.map(renderBacklinkRowHtml).join('');
    if (emptyEl) { emptyEl.textContent = view.emptyMsg; emptyEl.classList.toggle('hidden', !view.emptyMsg); }
    if (btnEl) { btnEl.textContent = view.btnLabel; btnEl.classList.toggle('hidden', !view.showBtn); }
    if (window.lucide) lucide.createIcons();
}

// Toggling a type rebuilds the whole panel (no input focused at click time).
window.toggleBacklinkType = function(entryId, type) {
    var st = getBacklinkState(entryId);
    st.active[type] = !st.active[type];
    st.expanded = false;
    if (!st.active[BACKLINK_FILTER_TYPE]) st.query = '';   // search hides with sessions; clear it
    var el = document.getElementById('backlinks-' + entryId);
    if (el) {
        el.outerHTML = renderBacklinksPanel(entryId);
        if (window.lucide) lucide.createIcons();
    }
};

window.toggleBacklinkExpand = function(entryId) {
    var st = getBacklinkState(entryId);
    st.expanded = !st.expanded;
    updateBacklinkList(entryId);
};

window.filterBacklinks = function(entryId, value) {
    var st = getBacklinkState(entryId);
    st.query = value;
    st.expanded = false;
    updateBacklinkList(entryId);
};

// ============================================================
// --- TAGS ENGINE ---
// Freeform tags on sessions, quests, NPCs, and locations (entry.tags).
// Surfaced two ways: a chip row in each card header (glanceable when
// collapsed, editable when expanded) and a dedicated "Tags" browse page
// that gathers everything sharing a tag across all four sections. The
// tag index is derived from current data on each full render.
// ============================================================

var TAG_TYPES = {
    session:   { tab: 'campaign_sessionNotes',    icon: 'scroll-text', label: 'Sessions' },
    mainquest: { tab: 'campaign_mainQuests',      icon: 'crown',       label: 'Main Campaign' },
    bkquest:   { tab: 'campaign_backstoryQuests', icon: 'sprout',      label: 'Backstory Quest' },
    quest:     { tab: 'campaign_quests',           icon: 'swords',      label: 'Side Quests' },
    npc:       { tab: 'campaign_npcs',              icon: 'users',       label: 'NPCs' },
    location:  { tab: 'campaign_locations',         icon: 'map-pin',     label: 'Locations' },
    thread:    { tab: 'campaign_sessionNotes',      icon: 'help-circle', label: 'Threads' }
};
var TAG_TYPE_ORDER = ['session', 'mainquest', 'bkquest', 'quest', 'npc', 'location', 'thread'];

var tagIndex = {};                 // tagKey -> { display, entries: [ {type, tabId, itemId, title, meta} ] }
var tagUiState = {};               // entryId -> { adding } (ephemeral header add-input state)
var tagBrowse = { selected: '', filter: '' };  // dedicated-page browse state
var tagRowClass = {};              // entryId -> extra classes for its header tag row

function getTagUi(id) { if (!tagUiState[id]) tagUiState[id] = { adding: false }; return tagUiState[id]; }
function entryTags(entry) { return Array.isArray(entry.tags) ? entry.tags : []; }

// Locate any taggable entry by id across all four sections.
function findTaggableEntry(entryId) {
    var cn = (typeof characterData !== 'undefined' && characterData) ? characterData.campaignNotes : null;
    if (!cn) return null;
    var hit = null;
    (cn.sessionNotes || []).forEach(function(s) { if (s.id === entryId) hit = { entry: s, type: 'session' }; });
    if (hit) return hit;
    (cn.mainQuests || []).forEach(function(s) { if (s.id === entryId) hit = { entry: s, type: 'mainquest' }; });
    if (hit) return hit;
    (cn.backstoryQuests || []).forEach(function(s) { if (s.id === entryId) hit = { entry: s, type: 'bkquest' }; });
    if (hit) return hit;
    (cn.quests || []).forEach(function(q) { if (q.id === entryId) hit = { entry: q, type: 'quest' }; });
    if (hit) return hit;
    (cn.locations || []).forEach(function(l) { if (l.id === entryId) hit = { entry: l, type: 'location' }; });
    if (hit) return hit;
    (cn.npcs || []).forEach(function(fac) { (fac.members || []).forEach(function(n) { if (n.id === entryId) hit = { entry: n, type: 'npc', factionId: fac.id }; }); });
    if (hit) return hit;
    (cn.threads || []).forEach(function(t) { if (t.id === entryId) hit = { entry: t, type: 'thread' }; });
    return hit;
}

window.rebuildTagIndex = function() {
    tagIndex = {};
    var cn = (typeof characterData !== 'undefined' && characterData) ? characterData.campaignNotes : null;
    if (!cn) return;
    function add(entry, type, title, meta) {
        entryTags(entry).forEach(function(t) {
            var raw = (t || '').trim(); if (!raw) return;
            var key = raw.toLowerCase();
            if (!tagIndex[key]) tagIndex[key] = { display: raw, entries: [] };
            tagIndex[key].entries.push({ type: type, tabId: TAG_TYPES[type].tab, itemId: entry.id, title: title || '(untitled)', meta: meta || '' });
        });
    }
    (cn.sessionNotes || []).forEach(function(s) { add(s, 'session', s.title || 'Untitled session', s.date || ''); });
    (cn.mainQuests || []).forEach(function(s) { add(s, 'mainquest', s.title || 'Untitled entry', s.date || 'Main Campaign'); });
    (cn.backstoryQuests || []).forEach(function(s) { add(s, 'bkquest', s.title || 'Untitled entry', s.date || 'Backstory Quest'); });
    (cn.quests || []).forEach(function(q) { add(q, 'quest', q.title || 'Untitled quest', q.subtitle || 'Quest'); });
    (cn.locations || []).forEach(function(l) { add(l, 'location', l.title || 'Untitled location', l.subtitle || 'Location'); });
    (cn.npcs || []).forEach(function(fac) { (fac.members || []).forEach(function(n) { add(n, 'npc', n.name || 'Unnamed NPC', n.subtitle || ''); }); });
    (cn.threads || []).forEach(function(t) { add(t, 'thread', stripHtmlToText(t.text).slice(0, 60) || 'Untitled thread', 'Thread'); });
};

window.getAllTagsSorted = function() {
    return Object.keys(tagIndex).map(function(k) { return { key: k, display: tagIndex[k].display, count: tagIndex[k].entries.length }; })
        .sort(function(a, b) { return b.count - a.count || a.display.localeCompare(b.display); });
};

function getTagSuggestions(entryId, q) {
    var ent = findTaggableEntry(entryId);
    var existing = ent ? entryTags(ent.entry).map(function(t) { return t.toLowerCase(); }) : [];
    var ql = (q || '').trim().toLowerCase();
    return window.getAllTagsSorted().filter(function(t) {
        return existing.indexOf(t.key) === -1 && (!ql || t.key.indexOf(ql) !== -1);
    }).slice(0, 6);
}

// ---------- card header tag row ----------
function tagChipHtml(entryId, tag, editable) {
    var safe = escapeHtml(tag);
    var jsTag = tag.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    var remove = editable
        ? '<button onclick="window.removeEntryTag(\'' + entryId + '\', \'' + jsTag + '\')" class="text-stone-400 hover:text-red-500 transition-colors flex items-center" title="Remove tag"><i data-lucide="x" class="w-3 h-3"></i></button>'
        : '';
    return '<span class="inline-flex items-center gap-1 text-xs font-medium pl-2 ' + (editable ? 'pr-1.5' : 'pr-2.5') + ' py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">'
        + '<button onclick="window.openTag(\'' + jsTag + '\')" class="inline-flex items-center gap-1 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors" title="View everything tagged &quot;' + safe + '&quot;">'
        +   '<i data-lucide="tag" class="w-3 h-3 text-stone-400"></i>' + safe
        + '</button>'
        + remove
        + '</span>';
}

function renderTagRow(entryId, extraClass) {
    if (extraClass !== undefined) tagRowClass[entryId] = extraClass;
    var cls = tagRowClass[entryId] || '';
    var ent = findTaggableEntry(entryId);
    if (!ent) return '';
    var tags = entryTags(ent.entry);
    var editable = !ent.entry.isCollapsed;          // quests have no isCollapsed -> editable
    if (tags.length === 0 && !editable) return '';  // empty + collapsed -> nothing
    var ui = getTagUi(entryId);

    var chips = tags.map(function(t) { return tagChipHtml(entryId, t, editable); }).join('');

    var addControl = '';
    if (editable) {
        if (ui.adding) {
            addControl = '<span class="inline-flex items-center gap-1.5 flex-wrap">'
                + '<input id="tag-input-' + entryId + '" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" enterkeyhint="done" placeholder="tag\u2026" '
                +   'oninput="window.tagInputChanged(\'' + entryId + '\', this.value)" onkeydown="window.tagInputKey(event, \'' + entryId + '\')" onblur="window.tagInputBlur(\'' + entryId + '\')" '
                +   'class="seamless-input text-xs w-24 px-2.5 py-0.5 rounded-full border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 focus:ring-1 focus:ring-emerald-500 focus:outline-none">'
                + '<span id="tag-sugg-' + entryId + '" class="inline-flex items-center gap-1.5 flex-wrap"></span>'
                + '</span>';
        } else {
            addControl = '<button onclick="window.toggleTagInput(\'' + entryId + '\')" class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border border-dashed border-stone-300 dark:border-stone-700 text-stone-400 dark:text-stone-500 hover:text-emerald-600 hover:border-emerald-400 dark:hover:text-emerald-400 transition-colors"><i data-lucide="plus" class="w-3 h-3"></i>tag</button>';
        }
    }

    return '<div id="tagrow-' + entryId + '" class="flex flex-wrap items-center gap-1.5 mt-2 ' + cls + '">' + chips + addControl + '</div>';
}

function rerenderTagRow(entryId) {
    var el = document.getElementById('tagrow-' + entryId);
    var html = renderTagRow(entryId);
    if (el) {
        if (html) {
            el.outerHTML = html;
        } else { el.remove(); return; }
    }
    if (window.lucide) lucide.createIcons();
    if (getTagUi(entryId).adding) { var inp = document.getElementById('tag-input-' + entryId); if (inp) inp.focus(); }
}

window.toggleTagInput = function(entryId) {
    var ui = getTagUi(entryId);
    ui.adding = !ui.adding;
    rerenderTagRow(entryId);
};

// Renders suggestion chips for the tag add-input, with keyboard-selection highlight.
function renderTagSuggChips(entryId) {
    var ui = getTagUi(entryId);
    var sugg = ui.suggestions || [];
    return sugg.map(function(t, i) {
        var jsTag = t.display.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        var isSelected = (i === ui.selectedSuggIdx);
        var cls = isSelected
            ? 'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-400 dark:ring-emerald-600 font-semibold transition-colors'
            : 'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors';
        return '<button onmousedown="event.preventDefault(); window.commitTag(\'' + entryId + '\', \'' + jsTag + '\')" class="' + cls + '"><i data-lucide="tag" class="w-3 h-3"></i>' + escapeHtml(t.display) + '</button>';
    }).join('');
}

window.tagInputChanged = function(entryId, value) {
    var ui = getTagUi(entryId);
    ui.suggestions = getTagSuggestions(entryId, value);
    ui.selectedSuggIdx = -1;
    var box = document.getElementById('tag-sugg-' + entryId);
    if (!box) return;
    box.innerHTML = renderTagSuggChips(entryId);
    if (window.lucide) lucide.createIcons();
};

// Write a tag to the entry (no DOM work). Returns true if a new tag was added.
function doAddTag(entryId, value) {
    var raw = (value || '').trim();
    if (!raw) return false;
    var ent = findTaggableEntry(entryId);
    if (!ent) return false;
    if (!Array.isArray(ent.entry.tags)) ent.entry.tags = [];
    var dup = ent.entry.tags.some(function(x) { return x.toLowerCase() === raw.toLowerCase(); });
    if (!dup) ent.entry.tags.push(raw);
    if (typeof window.saveData === 'function') window.saveData();
    window.rebuildTagIndex();
    return true;
}

// Enter key or suggestion tap: add the tag and close the input.
window.commitTag = function(entryId, value) {
    doAddTag(entryId, value);
    getTagUi(entryId).adding = false;
    rerenderTagRow(entryId);
};

window.tagInputKey = function(event, entryId) {
    var ui = getTagUi(entryId);
    var sugg = ui.suggestions || [];
    var box = document.getElementById('tag-sugg-' + entryId);

    if (event.key === 'ArrowDown') {
        event.preventDefault();
        ui.selectedSuggIdx = sugg.length ? Math.min(ui.selectedSuggIdx + 1, sugg.length - 1) : -1;
        if (box) { box.innerHTML = renderTagSuggChips(entryId); if (window.lucide) lucide.createIcons(); }
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        ui.selectedSuggIdx = Math.max(ui.selectedSuggIdx - 1, -1);
        if (box) { box.innerHTML = renderTagSuggChips(entryId); if (window.lucide) lucide.createIcons(); }
    } else if (event.key === 'Tab') {
        // Tab selects the highlighted suggestion, or the first one if none highlighted.
        if (sugg.length > 0) {
            event.preventDefault();
            var idx = ui.selectedSuggIdx >= 0 ? ui.selectedSuggIdx : 0;
            window.commitTag(entryId, sugg[idx].display);
        }
        // No suggestions — let Tab move focus naturally (don't prevent default).
    } else if (event.key === 'Enter' || event.keyCode === 13) {
        event.preventDefault();
        if (ui.selectedSuggIdx >= 0 && sugg[ui.selectedSuggIdx]) {
            // A suggestion is highlighted — commit it.
            window.commitTag(entryId, sugg[ui.selectedSuggIdx].display);
        } else {
            // Nothing highlighted — commit whatever is typed.
            window.commitTag(entryId, event.target.value);
        }
    } else if (event.key === 'Escape') {
        event.preventDefault();
        ui.selectedSuggIdx = -1;
        ui.suggestions = [];
        ui.adding = false;
        rerenderTagRow(entryId);
    }
};

// Losing focus (tapping away, or the mobile keyboard's Done/Next/Enter that fires
// blur rather than a reliable keydown): SAVE whatever was typed, then close.
window.tagInputBlur = function(entryId) {
    var inp = document.getElementById('tag-input-' + entryId);
    var pending = inp ? inp.value : '';
    // Delay so a suggestion's mousedown (which commits) can run before we close.
    setTimeout(function() {
        var ui = getTagUi(entryId);
        if (!ui.adding) return;            // already committed/closed by another path
        if (pending && pending.trim()) doAddTag(entryId, pending);
        ui.adding = false;
        rerenderTagRow(entryId);
    }, 160);
};

window.removeEntryTag = function(entryId, tag) {
    var ent = findTaggableEntry(entryId);
    if (!ent || !Array.isArray(ent.entry.tags)) return;
    ent.entry.tags = ent.entry.tags.filter(function(x) { return x.toLowerCase() !== tag.toLowerCase(); });
    if (typeof window.saveData === 'function') window.saveData();
    window.rebuildTagIndex();
    rerenderTagRow(entryId);
};

window.openTag = function(tag) {
    tagBrowse.selected = (tag || '').toLowerCase();
    tagBrowse.filter = '';
    window.setTab('tags');
};

// ---------- dedicated Tags page ----------
function tagBrowseListHtml() {
    var all = window.getAllTagsSorted();
    var q = (tagBrowse.filter || '').toLowerCase();
    var shown = q ? all.filter(function(t) { return t.key.indexOf(q) !== -1; }) : all;
    if (shown.length === 0) return '<p class="text-xs text-stone-400 dark:text-stone-500 italic px-2 py-2">No tags match.</p>';
    return shown.map(function(t) {
        var on = t.key === tagBrowse.selected;
        var base = 'w-full flex items-center justify-between gap-2 text-left text-sm px-3 py-2 rounded-lg transition-colors ';
        var cls = on
            ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-semibold'
            : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800/60';
        var jsKey = t.key.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        return '<button onclick="window.selectBrowseTag(\'' + jsKey + '\')" class="' + base + cls + '">'
            + '<span class="flex items-center gap-2 min-w-0"><i data-lucide="tag" class="w-3.5 h-3.5 flex-shrink-0 ' + (on ? '' : 'text-stone-400') + '"></i><span class="truncate">' + escapeHtml(t.display) + '</span></span>'
            + '<span class="text-xs ' + (on ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-400 dark:text-stone-500') + '">' + t.count + '</span>'
            + '</button>';
    }).join('');
}

function tagBrowseResultsHtml() {
    var sel = tagBrowse.selected;
    var rec = sel ? tagIndex[sel] : null;
    if (!rec || rec.entries.length === 0) {
        return '<p class="text-stone-400 dark:text-stone-500 italic text-center py-10">Select a tag on the left to see everything that carries it.</p>';
    }
    var groups = TAG_TYPE_ORDER.map(function(type) {
        var rows = rec.entries.filter(function(e) { return e.type === type; });
        if (rows.length === 0) return '';
        var meta = TAG_TYPES[type];
        var rowsHtml = rows.map(function(r) {
            var metaHtml = r.meta ? ' <span class="text-xs font-normal text-stone-400 dark:text-stone-500">\u00b7 ' + escapeHtml(r.meta) + '</span>' : '';
            return '<button onclick="window.setTab(\'' + r.tabId + '\', \'' + r.itemId + '\'); return false;" class="w-full text-left flex items-center gap-3 p-3 rounded-lg bg-stone-50 dark:bg-stone-950 border border-transparent hover:border-stone-200 dark:hover:border-stone-700 hover:bg-stone-100/70 dark:hover:bg-stone-800/40 transition-all group">'
                + '<i data-lucide="' + meta.icon + '" class="w-4 h-4 text-stone-400 flex-shrink-0"></i>'
                + '<span class="flex-1 min-w-0 text-sm font-semibold text-stone-700 dark:text-stone-200 truncate">' + escapeHtml(r.title) + metaHtml + '</span>'
                + '<i data-lucide="chevron-right" class="w-4 h-4 text-stone-300 dark:text-stone-600 group-hover:text-emerald-500 flex-shrink-0"></i>'
                + '</button>';
        }).join('');
        return '<div class="mb-5">'
            + '<div class="flex items-center gap-2 mb-2"><i data-lucide="' + meta.icon + '" class="w-4 h-4 text-stone-400"></i><span class="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">' + meta.label + '</span><span class="text-xs text-stone-400 dark:text-stone-500">(' + rows.length + ')</span></div>'
            + '<div class="space-y-2">' + rowsHtml + '</div>'
            + '</div>';
    }).join('');
    var sectionCount = TAG_TYPE_ORDER.filter(function(type) { return rec.entries.some(function(e) { return e.type === type; }); }).length;
    var head = '<div class="mb-4 pb-3 border-b border-stone-100 dark:border-stone-800"><p class="text-lg font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2"><i data-lucide="tag" class="w-4 h-4 text-emerald-500"></i>' + escapeHtml(rec.display) + '</p><p class="text-xs text-stone-400 dark:text-stone-500 mt-1">' + rec.entries.length + ' entries across ' + sectionCount + ' section' + (sectionCount === 1 ? '' : 's') + '</p></div>';
    return head + groups;
}

window.selectBrowseTag = function(key) {
    tagBrowse.selected = key;
    var listEl = document.getElementById('tagbrowse-list');
    var resEl = document.getElementById('tagbrowse-results');
    if (listEl) listEl.innerHTML = tagBrowseListHtml();
    if (resEl) resEl.innerHTML = tagBrowseResultsHtml();
    if (window.lucide) lucide.createIcons();
};

window.filterBrowseTags = function(value) {
    tagBrowse.filter = value || '';
    var listEl = document.getElementById('tagbrowse-list');
    if (listEl) listEl.innerHTML = tagBrowseListHtml();
    if (window.lucide) lucide.createIcons();
};

function renderTagsPage() {
    var all = window.getAllTagsSorted();
    if (all.length === 0) {
        return '<div class="space-y-6 animate-fade-in"><section class="bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-800">'
            + '<h3 class="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-2 flex items-center space-x-2"><i data-lucide="tags" class="text-emerald-600"></i><span>Tags</span></h3>'
            + '<p class="text-stone-500 dark:text-stone-400 mt-4 italic">No tags yet. Add a tag to any session, quest, NPC, or location and it will show up here \u2014 letting you pull together everything about a theme, faction, or arc in one place.</p>'
            + '</section></div>';
    }
    // default selection: keep current if still valid, else top tag
    if (!tagBrowse.selected || !tagIndex[tagBrowse.selected]) tagBrowse.selected = all[0].key;

    return '<div class="space-y-6 animate-fade-in"><section class="bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-800">'
        + '<h3 class="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-1 flex items-center space-x-2 border-b border-stone-100 dark:border-stone-800/80 pb-4"><i data-lucide="tags" class="text-emerald-600"></i><span>Tags</span></h3>'
        + '<p class="text-sm text-stone-500 dark:text-stone-400 mt-3 mb-5">Browse your campaign by theme. Tags cut across sessions, quests, NPCs, and locations.</p>'
        + '<div class="grid grid-cols-1 md:grid-cols-[230px_minmax(0,1fr)] gap-6">'
        +   '<div class="md:border-r md:border-stone-100 dark:md:border-stone-800 md:pr-6">'
        +     '<input type="text" id="tagbrowse-filter" oninput="window.filterBrowseTags(this.value)" value="' + escapeHtml(tagBrowse.filter) + '" placeholder="Filter tags..." class="seamless-input w-full text-sm mb-3 px-3 py-2 border border-stone-200 dark:border-stone-700 dark:bg-stone-800 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none">'
        +     '<div id="tagbrowse-list" class="space-y-1">' + tagBrowseListHtml() + '</div>'
        +   '</div>'
        +   '<div id="tagbrowse-results">' + tagBrowseResultsHtml() + '</div>'
        + '</div>'
        + '</section></div>';
}

function renderActionButtons(type, id, isFirst, isLast) {
    return `
    <button onclick="window.move${type}('${id}', -1)" ${isFirst ? 'disabled class="text-stone-300 dark:text-stone-700 cursor-not-allowed p-1.5"' : 'class="text-stone-500 hover:text-emerald-600 transition-colors p-1.5 rounded hover:bg-stone-100 dark:hover:bg-stone-800"'} title="Move Up"><i data-lucide="arrow-up" class="w-4 h-4"></i></button>
    <button onclick="window.move${type}('${id}', 1)" ${isLast ? 'disabled class="text-stone-300 dark:text-stone-700 cursor-not-allowed p-1.5"' : 'class="text-stone-500 hover:text-emerald-600 transition-colors p-1.5 rounded hover:bg-stone-100 dark:hover:bg-stone-800"'} title="Move Down"><i data-lucide="arrow-down" class="w-4 h-4"></i></button>
    <button onclick="window.delete${type}('${id}')" class="text-stone-300 dark:text-stone-600 hover:text-red-500 transition-colors p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/20" title="Delete"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
    `;
}

function renderSectionHeader(searchId, placeholder, filterFunc, toggleAllFunc, addFunc) {
    return `
    <div class="mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div class="relative w-full sm:w-2/3">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><i data-lucide="search" class="w-5 h-5 text-stone-400"></i></div>
            <input type="text" id="${searchId}" oninput="window.${filterFunc}(this.value)" placeholder="${placeholder}" class="seamless-input w-full pl-10 pr-4 py-3 border border-stone-200 dark:border-stone-800 rounded-xl bg-white dark:bg-stone-900 dark:text-stone-100 shadow-sm">
        </div>
        ${toggleAllFunc ? `
        <div class="flex space-x-2 w-full sm:w-auto">
            <button onclick="window.${toggleAllFunc}(false)" class="flex-1 sm:flex-none px-3 py-2 bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-lg text-sm font-medium transition-colors border border-stone-200 dark:border-stone-800">Expand All</button>
            <button onclick="window.${toggleAllFunc}(true)" class="flex-1 sm:flex-none px-3 py-2 bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-lg text-sm font-medium transition-colors border border-stone-200 dark:border-stone-800">Collapse All</button>
            <button onclick="window.${addFunc}()" class="flex-1 sm:flex-none flex justify-center items-center px-3 py-2 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-medium rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-900 transition-colors shadow-sm"><i data-lucide="plus" class="w-5 h-5"></i></button>
        </div>
        ` : `<button onclick="window.${addFunc}()" class="flex items-center space-x-2 px-4 py-3 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-medium rounded-xl hover:bg-emerald-200 dark:hover:bg-emerald-900 transition-colors shadow-sm w-full sm:w-auto"><i data-lucide="plus" class="w-5 h-5"></i><span class="hidden sm:inline">Add New</span></button>`}
    </div>`;
}

function renderTocCard(title, targetTab, icon, description) {
    return `<div onclick="window.setTab('${targetTab}')" class="bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-800/80 hover:border-emerald-400 dark:hover:border-emerald-500 hover:shadow-md cursor-pointer transition-all group flex flex-col h-full"><div class="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4 group-hover:scale-110 transition-transform"><i data-lucide="${icon}"></i></div><h4 class="text-lg font-bold text-stone-800 dark:text-stone-100 mb-2">${title}</h4><p class="text-sm text-stone-500 dark:text-stone-400 flex-grow">${description}</p><div class="mt-4 text-emerald-600 dark:text-emerald-400 text-sm font-medium flex items-center opacity-0 group-hover:opacity-100 transition-opacity"><span>Open</span><i data-lucide="chevron-right" class="w-4 h-4 ml-1"></i></div></div>`;
}

function renderNavItemHtml(item, isSubItem) {
    const isActive = activeTab === item.id;
    const paddingClass = isSubItem ? 'pl-11 pr-4 py-2.5 text-sm' : 'px-4 py-3';
    const iconSize = isSubItem ? 'w-4 h-4 opacity-70' : 'w-5 h-5';
    const activeColors = isActive ? 'bg-emerald-800 text-white shadow-md' : 'hover:bg-stone-800 text-stone-400 hover:text-stone-200';
    return `<button onclick="window.setTab('${item.id}')" class="w-full flex items-center space-x-3 rounded-lg transition-colors mb-1 ${paddingClass} ${activeColors}">
        <i data-lucide="${item.icon}" class="${iconSize}"></i>
        <span class="font-medium">${item.label}</span>
    </button>`;
}

function renderNavigation() {
    const container = document.getElementById('nav-container');

    // A group holding the active tab is always shown expanded, so the emerald
    // highlight can never be hidden behind a collapsed header (deep links,
    // search jumps, and @mentions land inside groups all the time).
    navItems.forEach(entry => {
        if (entry.group && entry.items.some(i => i.id === activeTab) && navGroupCollapsed[entry.group]) {
            navGroupCollapsed[entry.group] = false;
            saveNavGroupState();
        }
    });

    container.innerHTML = navItems.map(entry => {
        if (!entry.group) return renderNavItemHtml(entry, false);

        const collapsed = !!navGroupCollapsed[entry.group];
        const header = `<button onclick="window.toggleNavGroup('${entry.group}')" class="w-full flex items-center justify-between px-4 py-2 mt-2 mb-1 rounded-lg text-stone-500 hover:text-stone-300 transition-colors">
            <span class="flex items-center space-x-2">
                <i data-lucide="${entry.icon}" class="w-4 h-4"></i>
                <span class="text-[11px] font-black uppercase tracking-widest">${entry.label}</span>
            </span>
            <i data-lucide="chevron-down" class="w-4 h-4 chevron ${collapsed ? 'collapsed' : ''}"></i>
        </button>`;
        const children = entry.items.map(i => renderNavItemHtml(i, true)).join('');
        return header + `<div class="collapsible-content ${collapsed ? 'collapsed' : ''} mb-2">${children}</div>`;
    }).join('');
}

window.toggleNavGroup = function(groupKey) {
    navGroupCollapsed[groupKey] = !navGroupCollapsed[groupKey];
    saveNavGroupState();
    renderNavigation();
    if (window.lucide) lucide.createIcons();
};

// ============================================================
// --- OPEN THREADS PANEL ---
// Renders the amber panel that replaces the old pinned-notes widget at the
// top of the Session Notes page.  All state mutations are in editors.js;
// this function is pure render.
// ============================================================
function renderThreadsPanel() {
    var cn = characterData.campaignNotes;
    var threads = cn.threads || [];
    var open     = threads.filter(function(t) { return !t.resolved; });
    var resolved = threads.filter(function(t) { return  t.resolved; });

    // ── Header row ────────────────────────────────────────────────────────
    var headerHtml =
        '<div class="flex items-center justify-between px-4 py-3 border-b border-amber-200 dark:border-amber-900/60">'
      +   '<div class="flex items-center space-x-2">'
      +     '<i data-lucide="help-circle" class="w-4 h-4 text-amber-600 dark:text-amber-400"></i>'
      +     '<span class="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Open Threads</span>'
      +   '</div>'
      +   '<span class="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">'
      +     open.length + ' open'
      +   '</span>'
      + '</div>';

    // ── Unresolved thread cards ────────────────────────────────────────────
    var bodyHtml = '';
    if (open.length > 0) {
        bodyHtml += '<div class="p-3 space-y-2">';
        open.forEach(function(t) {
            var safeSearchable = escapeHtml(stripHtmlToText(t.text));
            bodyHtml +=
                '<div id="' + t.id + '" class="flex items-start gap-2.5 bg-white dark:bg-stone-900 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5" data-searchable="' + safeSearchable + '">'
              // Checkbox — click to resolve
              + '<button onclick="window.toggleThreadResolved(\'' + t.id + '\')" '
              +   'class="flex-shrink-0 mt-0.5 w-5 h-5 rounded border-2 border-amber-400 dark:border-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400" '
              +   'title="Mark as resolved"></button>'
              // Thread content
              + '<div class="flex-1 min-w-0">'
              +   '<div contenteditable="true" '
              +       'data-editor-section="campaignNotes_thread" data-editor-field="' + t.id + '" '
              +       'onkeydown="window.handleKeyDown(event)" '
              +       'oninput="window.handleInput(event, \'campaignNotes_thread\', \'' + t.id + '\')" '
              +       'onpaste="window.handlePaste(event)" '
              +       'class="seamless-input flex-1 text-sm text-stone-700 dark:text-stone-300 leading-relaxed rounded px-1 -mx-1 focus:outline-none focus:ring-1 focus:ring-amber-400 min-h-[20px] empty:before:content-[attr(data-placeholder)] empty:before:text-stone-400 dark:empty:before:text-stone-600 empty:before:pointer-events-none" '
              +       'data-placeholder="What needs investigating...">'
              +   renderHTML(t.text)
              +   '</div>'
              +   renderTagRow(t.id, 'mt-1.5')
              + '</div>'
              // Promote to quest button
              + '<button onclick="window.promoteThreadToQuest(\'' + t.id + '\')" '
              +   'class="flex-shrink-0 p-1.5 rounded border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors focus:outline-none" '
              +   'title="Promote to Quest"><i data-lucide="swords" class="w-3.5 h-3.5"></i>'
              + '</button>'
              + '</div>';
        });
        bodyHtml += '</div>';
    }

    // ── Add row (always visible) ───────────────────────────────────────────
    var addRowHtml =
        '<div class="px-3 py-2 ' + (open.length > 0 ? 'border-t border-amber-100 dark:border-amber-900/40' : '') + '">'
      + '<div class="flex items-center gap-2">'
      +   '<i data-lucide="plus" class="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 flex-shrink-0 pointer-events-none"></i>'
      +   '<div contenteditable="true" id="thread-add-input" '
      +        'data-editor-section="thread_add" data-editor-field="thread_new" '
      +        'onkeydown="window.handleThreadAddKeyDown(event)" '
      +        'oninput="window.handleThreadAddInput(event)" '
      +        'onblur="window.handleThreadAddBlur(event)" '
      +        'onpaste="window.handlePaste(event)" '
      +        'class="flex-1 seamless-input text-sm text-stone-700 dark:text-stone-300 rounded px-2 py-1 min-h-[28px] '
      +             'focus:outline-none focus:ring-1 focus:ring-amber-400 '
      +             'empty:before:content-[attr(data-placeholder)] empty:before:text-stone-300 '
      +             'dark:empty:before:text-stone-600 empty:before:pointer-events-none" '
      +        'data-placeholder="Add a thread… (@ to mention)"></div>'
      + '</div>'
      + '</div>';

    // ── Resolved section (collapsible, collapsed by default) ──────────────
    var resolvedHtml = '';
    if (resolved.length > 0) {
        resolvedHtml +=
            '<div class="border-t border-amber-200 dark:border-amber-900/60">'
          + '<div onclick="window.toggleThreadsResolved()" '
          +      'class="cursor-pointer flex items-center justify-between px-4 py-2.5 hover:bg-amber-100/50 dark:hover:bg-amber-950/30 transition-colors">'
          +   '<span class="text-xs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider">Resolved (' + resolved.length + ')</span>'
          +   '<i data-lucide="' + (threadsResolvedCollapsed ? 'chevron-right' : 'chevron-down') + '" class="w-4 h-4 text-amber-500 dark:text-amber-500"></i>'
          + '</div>';

        if (!threadsResolvedCollapsed) {
            resolvedHtml += '<div class="px-3 pb-3 space-y-1.5">';
            resolved.forEach(function(t) {
                var displayHtml = renderHTML(t.text)
                    + (t.resolution ? ' <span class="text-stone-400 dark:text-stone-500">— ' + escapeHtml(t.resolution) + '</span>' : '');
                resolvedHtml +=
                    '<div class="flex items-start gap-2 p-2 rounded">'
                  + '<i data-lucide="check-circle" class="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5"></i>'
                  + '<div class="flex-1 min-w-0 text-sm text-stone-400 dark:text-stone-500 line-through leading-relaxed opacity-80">' + displayHtml + '</div>'
                  + '<button onclick="window.deleteThread(\'' + t.id + '\')" '
                  +   'class="flex-shrink-0 p-1 rounded text-stone-300 dark:text-stone-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors focus:outline-none" '
                  +   'title="Permanently delete thread"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i>'
                  + '</button>'
                  + '</div>';
            });
            resolvedHtml += '</div>';
        }
        resolvedHtml += '</div>';
    }

    return '<div class="mb-6 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20 overflow-hidden">'
        + headerHtml
        + bodyHtml
        + addRowHtml
        + resolvedHtml
        + '</div>';
}

window.renderContent = function() {
    // Rebuild the backlink index from current data before anything renders.
    if (typeof window.rebuildBacklinkIndex === 'function') window.rebuildBacklinkIndex();
    if (typeof window.rebuildTagIndex === 'function') window.rebuildTagIndex();

    // FOCUS & POSITION GUARD PRESERVATION
    var activeEl = document.activeElement;
    var activeSection = null;
    var activeField = null;
    var activeInputId = null;
    var caretOffset = 0;
    var selectionStart = 0;
    var selectionEnd = 0;
    
    try {
        if (activeEl && typeof activeEl.hasAttribute === 'function') {
            if (activeEl.hasAttribute('data-editor-field')) {
                activeSection = activeEl.getAttribute('data-editor-section');
                activeField = activeEl.getAttribute('data-editor-field');
                
                var selection = window.getSelection();
                if (selection.rangeCount > 0) {
                    var range = selection.getRangeAt(0);
                    if (activeEl.contains(range.startContainer)) {
                        var preCaretRange = range.cloneRange();
                        preCaretRange.selectNodeContents(activeEl);
                        preCaretRange.setEnd(range.startContainer, range.startOffset);
                        caretOffset = preCaretRange.toString().length;
                    }
                }
            } else if (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') {
                activeInputId = activeEl.id;
                selectionStart = activeEl.selectionStart || 0;
                selectionEnd = activeEl.selectionEnd || 0;
            }
        }
    } catch(e) { console.warn("Focus guard capture safely bypassed: ", e); }

    const container = document.getElementById('content-area');
    let html = '';
    window.updateDarkModeUI();

    const headerAvatar = document.getElementById('header-avatar-container');
    if (headerAvatar) {
        headerAvatar.innerHTML = characterData.avatar 
            ? `<img src="${characterData.avatar}" class="w-full h-full object-cover cursor-pointer hover:opacity-90" onclick="window.openLightbox(this.src)" title="Expand Portrait">` 
            : `<span class="text-sm">🧝‍♀️</span>`;
    }

    function getMentionableDiv(section, field, value, extraClasses = "") {
        const sectionArg = section ? `'${section}'` : 'null';
        return `<div contenteditable="true" data-editor-section="${section || ''}" data-editor-field="${field}" oninput="window.handleInput(event, ${sectionArg}, '${field}')" onkeydown="window.handleKeyDown(event)" onpaste="window.handlePaste(event)" class="w-full seamless-input rounded-lg p-3 -mx-3 min-h-[40px] cursor-text focus:bg-white dark:focus:bg-stone-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none whitespace-pre-wrap font-sans leading-relaxed text-stone-700 dark:text-stone-300 bg-transparent ${extraClasses}" data-placeholder="Click to type... Type @ to link notes.">${renderHTML(value)}</div>`;
    }

    function getOutlineNotesEditor(section, field, value, extraClasses = "min-h-[150px]", placeholder = "Start typing... Hitting Enter starts a bullet point, Tab indents, Shift+Tab outdents. Type @ to link notes.") {
        const sectionArg = section ? `'${section}'` : 'null';
        return `<div contenteditable="true" data-editor-section="${section || ''}" data-editor-field="${field}" oninput="window.handleInput(event, ${sectionArg}, '${field}')" onkeydown="window.handleOutlineKeyDown(event)" onfocus="window.handleOutlineFocus(event)" onblur="window.handleOutlineBlur(event)" onpaste="window.handlePaste(event)" class="w-full seamless-input rounded-lg p-3 -mx-3 cursor-text focus:bg-white dark:focus:bg-stone-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none whitespace-pre-wrap font-sans leading-relaxed text-stone-700 dark:text-stone-200 bg-transparent ${extraClasses}" data-placeholder="${escapeHtml(placeholder)}">${renderHTML(value)}</div>`;
    }

    if (activeTab === 'backstory') {
        let contentHtml = `
        <div class="bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-800 mb-6 animate-fade-in">
            <div class="flex flex-col md:flex-row gap-6 items-start">
                <div class="flex-shrink-0 flex items-start">
                    <div class="relative w-24 h-24 rounded-full border-2 border-stone-200 dark:border-stone-800 hover:border-emerald-400 bg-stone-50 dark:bg-stone-800 flex items-center justify-center overflow-hidden group shadow-inner transition-all duration-200" title="Character portrait">
                        ${characterData.avatar ? `
                            <img src="${characterData.avatar}" class="w-full h-full object-cover cursor-zoom-in animate-fade-in" onclick="window.openLightbox(this.src)">
                            <div class="absolute inset-0 bg-stone-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200 pointer-events-none">
                                <button onclick="event.stopPropagation(); document.getElementById('char-avatar-input').click()" class="pointer-events-auto p-1.5 bg-stone-900/85 hover:bg-emerald-600 text-white rounded-full mr-1.5 transition-all shadow-md" title="Change portrait">
                                    <i data-lucide="camera" class="w-4 h-4"></i>
                                </button>
                                <button onclick="event.stopPropagation(); window.deleteCharAvatar(event)" class="pointer-events-auto p-1.5 bg-stone-900/85 hover:bg-red-600 text-white rounded-full transition-all shadow-md" title="Remove portrait">
                                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                                </button>
                            </div>
                        ` : `
                            <span class="text-4xl cursor-pointer" onclick="document.getElementById('char-avatar-input').click()">🧝‍♀️</span>
                            <div onclick="document.getElementById('char-avatar-input').click()" class="absolute inset-0 bg-stone-900/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200 cursor-pointer">
                                <i data-lucide="camera" class="w-6 h-6 text-white"></i>
                            </div>
                        `}
                    </div>
                    <input type="file" id="char-avatar-input" accept="image/*" class="hidden" onchange="window.handleCharAvatarUpload(event)">
                </div>
                <div class="flex-1 w-full">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="bg-stone-50 dark:bg-stone-950 p-3 rounded-lg border border-stone-100 dark:border-stone-800 col-span-1 md:col-span-3">
                            <div class="text-xs text-stone-400 dark:text-stone-500 font-semibold uppercase tracking-wider mb-1">Character Name</div>
                            <input type="text" id="inline-name-input" oninput="window.updateField(null, 'name', this.value)" value="${escapeHtml(characterData.name)}" class="seamless-input w-full bg-transparent font-black text-xl text-stone-800 dark:text-stone-100 rounded px-1 -mx-1 py-0.5 focus:outline-none">
                        </div>
                        ${Object.entries(characterData.basics).map(([key, val]) => `
                            <div class="bg-stone-50 dark:bg-stone-950 p-3 rounded-lg border border-stone-100 dark:border-stone-800">
                                <div class="text-xs text-stone-400 dark:text-stone-500 font-semibold uppercase tracking-wider mb-1 capitalize">${key}</div>
                                <input type="text" id="input-basic-${key}" oninput="window.updateField('basics', '${key}', this.value)" value="${escapeHtml(val)}" class="seamless-input w-full bg-transparent font-medium text-stone-800 dark:text-stone-200 rounded px-1 -mx-1 py-0.5 focus:outline-none">
                            </div>`).join('')}
                    </div>
                </div>
            </div>
        </div>`;

        contentHtml += renderSectionHeader('backstory-search', 'Search backstory...', 'filterBackstory', 'toggleAllBackstory', 'addBackstory');

        if (characterData.backstory.length === 0) contentHtml += `<p class="text-stone-500 text-center py-8 italic">No backstory segments added yet.</p>`;

        characterData.backstory.forEach((b, idx) => {
            const isCollapsed = b.isCollapsed;
            const isFirst = idx === 0;
            const isLast = idx === characterData.backstory.length - 1;
            contentHtml += `
                <div id="${b.id}" class="backstory-block mb-4 border border-stone-200 dark:border-stone-800/80 rounded-xl bg-white dark:bg-stone-900 shadow-sm overflow-hidden" data-searchable="${escapeHtml(b.title)} ${escapeHtml(stripHtmlToText(b.notes))}">
                    <div class="bg-stone-50/80 dark:bg-stone-800/60 border-b border-stone-200 dark:border-stone-800 px-5 py-4 flex justify-between items-start transition-colors">
                        <div class="flex-1 flex flex-col sm:flex-row sm:items-center gap-2">
                            <button onclick="window.toggleBackstoryCollapse('${b.id}')" class="p-1 hover:bg-stone-200 dark:hover:bg-stone-700 rounded transition-colors focus:outline-none hidden sm:block"><i data-lucide="chevron-down" class="w-5 h-5 text-stone-400 chevron ${isCollapsed ? 'collapsed' : ''}"></i></button>
                            <input type="text" id="input-b-title-${b.id}" oninput="window.updateBackstory('${b.id}', 'title', this.value)" value="${escapeHtml(b.title)}" class="seamless-input font-bold text-lg text-stone-800 dark:text-stone-100 bg-transparent px-2 py-1 -ml-2 w-full sm:w-auto rounded" placeholder="Backstory Title">
                        </div>
                        <div class="flex items-center space-x-1 ml-2">
                            ${renderActionButtons('Backstory', b.id, isFirst, isLast)}
                        </div>
                    </div>
                    <div class="collapsible-content ${isCollapsed ? 'collapsed' : ''} ${window.isDeepLinking ? 'no-transition' : ''}">
                        <div class="p-5">${getMentionableDiv('backstory', b.id, b.notes, 'min-h-[150px]')}</div>
                    </div>
                </div>`;
        });

        html = `<div class="space-y-6 animate-fade-in"><section class="bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-800"><h3 class="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-6 flex items-center space-x-2 border-b border-stone-100 dark:border-stone-800/80 pb-4"><i data-lucide="book-open" class="text-emerald-600"></i><span>Backstory & Overview</span></h3><div>${contentHtml}</div></section></div>`;
    }
    else if (activeTab === 'personality') {
        let contentHtml = renderSectionHeader('personality-search', 'Search traits...', 'filterPersonality', 'toggleAllPersonality', 'addPersonality');
        if (characterData.personality.length === 0) contentHtml += `<p class="text-stone-500 text-center py-8 italic">No personality traits added yet.</p>`;

        characterData.personality.forEach((p, idx) => {
            contentHtml += `
                <div id="${p.id}" class="personality-block mb-4 border rounded-xl shadow-sm overflow-hidden bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800" data-searchable="${escapeHtml(p.title)} ${escapeHtml(p.subtitle)} ${escapeHtml(stripHtmlToText(p.notes))}">
                    <div class="bg-stone-50/40 dark:bg-stone-800/40 border-b border-stone-200/50 dark:border-stone-800 px-5 py-4 flex justify-between items-start transition-colors">
                        <div class="flex-1 flex flex-col sm:flex-row sm:items-center gap-2">
                            <button onclick="window.togglePersonalityCollapse('${p.id}')" class="p-1 hover:bg-stone-200 dark:hover:bg-stone-700 rounded transition-colors focus:outline-none hidden sm:block"><i data-lucide="chevron-down" class="w-5 h-5 text-stone-400 chevron ${p.isCollapsed ? 'collapsed' : ''}"></i></button>
                            <input type="text" id="input-p-title-${p.id}" oninput="window.updatePersonality('${p.id}', 'title', this.value)" value="${escapeHtml(p.title)}" class="seamless-input text-lg bg-transparent px-2 py-1 -ml-2 w-full sm:w-auto rounded text-stone-800 dark:text-stone-100 font-bold" placeholder="Trait Title">
                            <input type="text" id="input-p-sub-${p.id}" oninput="window.updatePersonality('${p.id}', 'subtitle', this.value)" value="${escapeHtml(p.subtitle)}" class="seamless-input text-sm font-semibold bg-transparent px-2 py-1 w-full sm:w-auto rounded text-emerald-600 dark:text-emerald-400" placeholder="Subheading / State">
                        </div>
                        <div class="flex items-center space-x-1 ml-2">
                            ${renderActionButtons('Personality', p.id, idx === 0, idx === characterData.personality.length - 1)}
                        </div>
                    </div>
                    <div class="collapsible-content ${p.isCollapsed ? 'collapsed' : ''} ${window.isDeepLinking ? 'no-transition' : ''}">
                        <div class="p-5">${getOutlineNotesEditor('personality', p.id, p.notes, 'min-h-[100px] hover:bg-stone-100/30 dark:hover:bg-stone-800/40', 'Start typing traits... Enter starts a bullet, Tab indents, Shift+Tab outdents. Type @ to link notes.')}</div>
                    </div>
                </div>`;
        });

        html = `<div class="space-y-6 animate-fade-in"><section class="bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-800"><h3 class="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-6 flex items-center space-x-2 border-b border-stone-100 dark:border-stone-800 pb-4"><i data-lucide="brain" class="text-emerald-600"></i><span>Personality & Traits</span></h3><div>${contentHtml}</div></section></div>`;
    }
    else if (activeTab === 'build') {
        const abilities = characterData.build.abilities;
        const feats = characterData.build.feats || {};
        const keys = [ { key: 'starting', label: 'Starting' }, { key: 'species', label: 'Species' }, { key: 'lvl1', label: 'Lvl 1', labelLong: 'Level 1', featLabel: 'Origin Feat' }, { key: 'lvl4', label: 'Lvl 4', labelLong: 'Level 4', featLabel: 'ASI/Feat' }, { key: 'lvl8', label: 'Lvl 8', labelLong: 'Level 8', featLabel: 'ASI/Feat' }, { key: 'lvl12', label: 'Lvl 12', labelLong: 'Level 12', featLabel: 'ASI/Feat' }, { key: 'lvl16', label: 'Lvl 16', labelLong: 'Level 16', featLabel: 'ASI/Feat' }, { key: 'lvl19', label: 'Lvl 19', labelLong: 'Level 19', featLabel: 'Epic Boon' }, { key: 'lvl20', label: 'Lvl 20', labelLong: 'Level 20', featLabel: 'Primal Power' } ];

        let modifierRows = abilities.map((ability, aIdx) => `
            <tr class="border-b border-stone-100 dark:border-stone-800 hover:bg-stone-50/50 dark:hover:bg-stone-800/30 transition-colors">
                <td class="px-4 py-3 font-bold text-stone-700 dark:text-stone-300 bg-stone-50 dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800">${ability.name}</td>
                <td class="px-2 py-3 text-center"><input type="number" id="input-ability-start-${aIdx}" oninput="window.updateAbilityPoint(${aIdx}, 'starting', this.value)" value="${ability.starting || 0}" class="seamless-input w-14 text-center bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg py-1 px-1.5 focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-stone-800 text-stone-800 dark:text-stone-100 font-semibold focus:outline-none"></td>
                <td class="px-2 py-3 text-center border-r border-stone-200 dark:border-stone-800 bg-stone-50/40 dark:bg-stone-900/30"><input type="number" id="input-ability-spec-${aIdx}" oninput="window.updateAbilityPoint(${aIdx}, 'species', this.value)" value="${ability.species || 0}" class="seamless-input w-12 text-center bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg py-1 px-1 focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-stone-800 text-emerald-700 dark:text-emerald-400 font-bold focus:outline-none"></td>
                ${keys.slice(2).map(col => `<td class="px-2 py-3 text-center"><input type="number" id="input-ability-${col.key}-${aIdx}" oninput="window.updateAbilityPoint(${aIdx}, '${col.key}', this.value)" value="${ability[col.key] || 0}" class="seamless-input w-12 text-center bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg py-1 px-1 focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-stone-800 text-stone-700 dark:text-stone-200 focus:outline-none"></td>`).join('')}
            </tr>`).join('');

        let calculatedProgressRows = abilities.map((ability, aIdx) => `
            <tr class="border-b border-stone-100 dark:border-stone-800 hover:bg-emerald-50/10 dark:hover:bg-emerald-950/10 transition-colors">
                <td class="px-4 py-3 font-bold text-stone-700 dark:text-stone-300 bg-stone-50 dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800">${ability.name}</td>
                <td class="px-3 py-3 text-center" id="score-cell-${aIdx}-starting"></td><td class="px-3 py-3 text-center border-r border-stone-200 dark:border-stone-800 bg-stone-50/20 dark:bg-stone-900/10" id="score-cell-${aIdx}-species"></td>
                ${keys.slice(2).map(col => `<td class="px-3 py-3 text-center" id="score-cell-${aIdx}-${col.key}"></td>`).join('')}
            </tr>`).join('');

        const selectedArmors = (characterData.build.acSelection || []).filter(item => item !== "");
        let acRowsHtml = "";
        for (let rIdx = 0; rIdx < selectedArmors.length + (selectedArmors.length < 5 ? 1 : 0); rIdx++) {
            const armorKey = selectedArmors[rIdx] || "";
            const armorDef = ARMOR_OPTIONS[armorKey] || { name: "", type: "-", stealth: "-", isDisadv: false, formula: "" };
            const stealthHtml = armorDef.isDisadv ? `<span class="text-red-600 dark:text-red-400 font-bold text-xs">Disadv.</span>` : (armorKey !== "" ? `<span class="text-stone-500 dark:text-stone-400 font-medium text-xs">Normal</span>` : `-`);

            acRowsHtml += `
                <tr class="border-b border-stone-100 dark:border-stone-800 hover:bg-stone-50/40 dark:hover:bg-stone-900/30">
                    <td class="px-4 py-3 font-semibold text-stone-700 dark:text-stone-300 bg-stone-50 dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800">
                        <select id="input-armor-select-${rIdx}" onchange="window.updateAcSelection(${rIdx}, this.value)" class="seamless-input font-bold text-sm bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-800 rounded-lg py-1.5 px-2.5 text-stone-700 dark:text-stone-200 focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-stone-800 focus:outline-none w-full max-w-[220px]">
                            <option value="" class="bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200">Select Armor...</option>
                            <option value="unarmored" ${armorKey === 'unarmored' ? 'selected' : ''} class="bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200">Unarmored Barbarian</option>
                            <option value="unarmored_monk" ${armorKey === 'unarmored_monk' ? 'selected' : ''} class="bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200">Unarmored Monk</option>
                            <option value="studded" ${armorKey === 'studded' ? 'selected' : ''} class="bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200">Studded Leather (Light)</option>
                            <option value="chainshirt" ${armorKey === 'chainshirt' ? 'selected' : ''} class="bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200">Chain Shirt (Medium)</option>
                            <option value="scalemail" ${armorKey === 'scalemail' ? 'selected' : ''} class="bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200">Scale Mail (Medium)</option>
                            <option value="breastplate" ${armorKey === 'breastplate' ? 'selected' : ''} class="bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200">Breastplate (Medium)</option>
                            <option value="halfplate" ${armorKey === 'halfplate' ? 'selected' : ''} class="bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200">Halfplate (Medium)</option>
                            <option value="chainmail" ${armorKey === 'chainmail' ? 'selected' : ''} class="bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200">Chain Mail (Heavy)</option>
                            <option value="splint" ${armorKey === 'splint' ? 'selected' : ''} class="bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200">Splint (Heavy)</option>
                            <option value="plate" ${armorKey === 'plate' ? 'selected' : ''} class="bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200">Plate (Heavy)</option>
                        </select>
                        ${armorKey !== "" && armorDef.formula ? `<div class="text-[10px] text-stone-400 dark:text-stone-500 mt-1 pl-1 font-medium italic animate-fade-in">${armorDef.formula}</div>` : ''}
                    </td>
                    <td class="px-3 py-3 text-center text-stone-600 dark:text-stone-400 text-sm font-semibold">${armorDef.type}</td><td class="px-3 py-3 text-center border-r border-stone-200 dark:border-stone-800 text-sm">${stealthHtml}</td>
                    ${keys.slice(2).map(col => `<td class="px-3 py-3 text-center font-black text-emerald-700 dark:text-emerald-400 text-sm" id="ac-val-${rIdx}-${col.key}">-</td>`).join('')}
                </tr>`;
        }

        html = `
        <div class="space-y-8 animate-fade-in">
            <div class="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm overflow-hidden">
                <div class="bg-emerald-950 px-6 py-4 border-b border-stone-800 flex items-center justify-between"><div class="flex items-center space-x-3"><span class="p-2 bg-emerald-900 rounded-xl text-emerald-300"><i data-lucide="calculator" class="w-5 h-5"></i></span><div><h3 class="font-extrabold text-white text-lg tracking-tight">Character Progression Parker</h3><p class="text-xs text-emerald-400">Distribute Feat increases and preview overall growth milestones</p></div></div></div>
                <div class="p-6 overflow-x-auto custom-scrollbar">
                    <div class="min-w-[900px] space-y-8">
                        <table class="w-full text-sm text-left border-collapse">
                            <thead>
                                <tr class="bg-stone-800 dark:bg-stone-950 text-stone-200 dark:text-stone-400 text-xs font-bold uppercase border-b border-stone-700 dark:border-stone-800"><th class="p-4 rounded-tl-xl border-r border-stone-700 dark:border-stone-800 text-[11px] w-[180px]">Progression Matrix</th><th class="p-3 text-center text-[11px]">Starting</th><th class="p-3 text-center border-r border-stone-700 dark:border-stone-800 text-[11px]">Species</th>${keys.slice(2).map(col => `<th class="p-3 text-center"><div class="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1">${col.featLabel}</div><div class="text-[11px] text-stone-100 font-extrabold">${col.labelLong}</div></th>`).join('')}</tr>
                                <tr class="bg-stone-900/5 dark:bg-stone-900/20 border-b border-stone-200 dark:border-stone-800"><td class="p-3 font-semibold text-stone-400 text-xs italic bg-stone-50 dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800">Associated Feat / ASI</td><td class="p-3 text-center text-stone-300 bg-stone-50/10">-</td><td class="p-3 text-center text-stone-300 border-r border-stone-200 dark:border-stone-800 bg-stone-50/10">-</td>${keys.slice(2).map(col => `<td class="p-2 text-center"><input type="text" id="input-feat-${col.key}" oninput="window.updateFeatName('${col.key}', this.value)" value="${escapeHtml(feats[col.key] || '')}" class="seamless-input w-full text-xs text-center border border-stone-200 dark:border-stone-800 rounded-lg py-1 px-1.5 font-bold text-stone-700 dark:text-stone-300 bg-white dark:bg-stone-800 placeholder-stone-300 shadow-sm focus:ring-1 focus:ring-emerald-500 dark:focus:bg-stone-800" placeholder="Feat Name"></td>`).join('')}</tr>
                            </thead>
                            <tbody>${modifierRows}</tbody>
                        </table>
                        <div><h4 class="font-extrabold text-stone-800 dark:text-stone-200 text-sm uppercase tracking-wider mb-3 flex items-center space-x-2"><span class="w-1.5 h-4 bg-emerald-600 rounded-full"></span><span>Cumulative Progression scores</span></h4><table class="w-full text-sm text-left border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden shadow-sm"><thead><tr class="bg-stone-100/80 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-xs font-extrabold uppercase border-b border-stone-200 dark:border-stone-800"><th class="p-3 border-r border-stone-200 dark:border-stone-800 w-[180px]">Stats</th><th class="p-3 text-center">Starting</th><th class="p-3 text-center border-r border-stone-200 dark:border-stone-800">Species</th>${keys.slice(2).map(col => `<th class="p-3 text-center font-black text-emerald-800 dark:text-emerald-400">${col.label} Score</th>`).join('')}</tr></thead><tbody class="bg-white dark:bg-stone-900">${calculatedProgressRows}</tbody></table></div>
                        <div><h4 class="font-extrabold text-stone-800 dark:text-stone-200 text-sm uppercase tracking-wider mb-3 flex items-center space-x-2"><span class="w-1.5 h-4 bg-emerald-600 rounded-full"></span><span>Dynamic AC Progression Preview</span></h4><table class="w-full text-sm text-left border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden shadow-sm"><thead><tr class="bg-emerald-950 text-emerald-50 text-xs font-extrabold uppercase border-b border-emerald-900"><th class="p-3 border-r border-emerald-900 w-[240px]">AC calculation options</th><th class="p-3 text-center w-[120px]">Armor Type</th><th class="p-3 text-center border-r border-emerald-900 w-[100px]">Stealth</th>${keys.slice(2).map(col => `<th class="p-3 text-center text-emerald-300 font-extrabold">${col.label} AC</th>`).join('')}</tr></thead><tbody class="bg-white dark:bg-stone-900">${acRowsHtml}</tbody></table></div>
                        <div class="mt-4 flex items-center justify-start bg-stone-50 dark:bg-stone-900/50 p-4 rounded-xl border border-stone-200 dark:border-stone-800 space-x-4">
                            <label class="relative inline-flex inline-flex items-center cursor-pointer flex-shrink-0"><input type="checkbox" id="shield-toggle" onchange="window.toggleShieldActive(this.checked)" ${characterData.build.shieldActive ? 'checked' : ''} class="sr-only peer"><div class="w-11 h-6 bg-stone-200 dark:bg-stone-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div></label>
                            <div class="flex items-center space-x-3"><span class="p-2 bg-emerald-100 dark:bg-emerald-950/40 rounded-xl text-emerald-700 dark:text-emerald-300 shadow-sm"><i data-lucide="shield" class="w-5 h-5"></i></span><div><h5 class="font-bold text-stone-800 dark:text-stone-200 text-sm">Equip Shield</h5><p class="text-xs text-stone-400 dark:text-stone-500">Adds +2 to all AC calculation rows when active</p></div></div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="grid md:grid-cols-2 gap-8 animate-fade-in">
                <section class="bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-800"><h3 class="text-xl font-bold text-stone-800 dark:text-stone-100 mb-2 flex items-center space-x-2 border-b border-stone-100 dark:border-stone-800 pb-2"><span class="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg text-emerald-600 dark:text-emerald-400"><i data-lucide="feather" class="w-4 h-4"></i></span><span>Features & Traits</span></h3>${getOutlineNotesEditor('build', 'features', characterData.build.features, 'min-h-[150px]', 'Start typing features... Hitting Enter starts a bullet, Tab indents, Shift+Tab outdents. Type @ to link notes.')}</section>
                <section class="bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-800"><h3 class="text-xl font-bold text-stone-800 dark:text-stone-100 mb-2 flex items-center space-x-2 border-b border-stone-100 dark:border-stone-800 pb-2"><span class="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg text-emerald-600 dark:text-emerald-400"><i data-lucide="clipboard" class="w-4 h-4"></i></span><span>Misc Notes</span></h3>${getOutlineNotesEditor('build', 'equipment', characterData.build.equipment, 'min-h-[150px]', 'Start typing notes or equipment... Hitting Enter starts a bullet, Tab indents, Shift+Tab outdents. Type @ to link notes.')}</section>
            </div>
        </div>`;
    }
    else if (activeTab === 'campaignNotes') {
        // === CAMPAIGN DASHBOARD ===
        // Replaces the old table-of-contents cards with an at-a-glance landing
        // page: open threads up top, then last-session recap + active quests.
        // Reads existing data only; nothing new is stored. Rows deep-link via
        // setTab() into the relevant tab/entry.
        var cn = characterData.campaignNotes || {};
        var DASH_CAP = 5;

        // Arrays are already newest-first (entries are unshift-ed on create).
        var openThreads  = (cn.threads || []).filter(function(t) { return !t.resolved; });
        var activeQuests = (cn.quests  || []).filter(function(q) { return !q.isCompleted; });
        // Urgent first; recency preserved within each group (stable sort).
        var sortedQuests = activeQuests.slice().sort(function(a, b) {
            return (b.isUrgent ? 1 : 0) - (a.isUrgent ? 1 : 0);
        });
        var latestSession = (cn.sessionNotes && cn.sessionNotes.length) ? cn.sessionNotes[0] : null;

        var threadsShown = openThreads.slice(0, DASH_CAP);
        var questsShown  = sortedQuests.slice(0, DASH_CAP);
        var threadsMore  = openThreads.length  - threadsShown.length;
        var questsMore   = sortedQuests.length - questsShown.length;

        // Last ~2 sentences of the freshest session note (the "most recent part").
        function dashSessionTail(rawHtml) {
            var clean = stripHtmlToText(rawHtml);
            if (!clean) return '';
            var parts = clean.match(/[^.!?]+[.!?]*/g);
            if (!parts || parts.length <= 2) return clean;
            return '… ' + parts.slice(-2).join(' ').trim();
        }

        // --- Identity strip ---
        var basics = characterData.basics || {};
        var idLine = [basics.race, basics.class, basics.tribe].filter(Boolean).join(' · ');
        var avatarHtml = characterData.avatar
            ? '<img src="' + characterData.avatar + '" class="w-full h-full object-cover cursor-pointer hover:opacity-90" onclick="window.openLightbox(this.src)">'
            : '<span class="text-2xl">🧝‍♀️</span>';
        var lastPlayed = (latestSession && latestSession.date) ? latestSession.date : '—';

        var headerHtml =
            '<div class="flex items-center gap-4 bg-white dark:bg-stone-900 p-4 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-800">'
          +   '<div class="w-12 h-12 rounded-full border-2 border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800 flex items-center justify-center overflow-hidden flex-shrink-0">' + avatarHtml + '</div>'
          +   '<div class="min-w-0">'
          +     '<p class="text-lg font-bold text-stone-800 dark:text-stone-100 truncate">' + escapeHtml(characterData.name || 'Unnamed Character') + '</p>'
          +     '<p class="text-xs text-stone-500 dark:text-stone-400 truncate">' + escapeHtml(idLine) + '</p>'
          +   '</div>'
          +   '<div class="ml-auto text-right flex-shrink-0">'
          +     '<p class="text-[10px] uppercase tracking-wider text-stone-400 dark:text-stone-500 font-bold">Last played</p>'
          +     '<p class="text-xs font-semibold text-stone-600 dark:text-stone-300">' + escapeHtml(lastPlayed) + '</p>'
          +   '</div>'
          + '</div>';

        // --- Open threads (prominent, top) ---
        var threadsBody = '';
        if (threadsShown.length > 0) {
            threadsShown.forEach(function(t) {
                var line = escapeHtml(stripHtmlToText(t.text)) || '<span class="italic text-stone-400">Empty thread</span>';
                threadsBody +=
                    '<div onclick="window.setTab(\'campaign_sessionNotes\', \'' + t.id + '\')" class="group flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-amber-100/60 dark:hover:bg-amber-950/30 cursor-pointer transition-colors">'
                  +   '<button onclick="event.stopPropagation(); window.toggleThreadResolved(\'' + t.id + '\')" class="flex-shrink-0 w-4 h-4 rounded-full border-2 border-amber-400 dark:border-amber-600 hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400" title="Mark resolved"></button>'
                  +   '<span class="flex-1 min-w-0 text-sm text-stone-700 dark:text-stone-200 truncate">' + line + '</span>'
                  +   '<i data-lucide="chevron-right" class="w-4 h-4 text-amber-400 dark:text-amber-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"></i>'
                  + '</div>';
            });
            if (threadsMore > 0) {
                threadsBody += '<button onclick="window.setTab(\'campaign_sessionNotes\')" class="w-full text-left px-2 py-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline">+ ' + threadsMore + ' more →</button>';
            }
        } else {
            threadsBody = '<p class="px-2 py-6 text-center text-sm text-stone-400 dark:text-stone-500">No open threads. Loose ends you jot down will show up here.</p>';
        }

        var threadsCard =
            '<div class="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20 p-4">'
          +   '<div class="flex items-center gap-2 mb-2">'
          +     '<i data-lucide="help-circle" class="w-5 h-5 text-amber-600 dark:text-amber-400"></i>'
          +     '<span class="font-bold text-stone-800 dark:text-stone-100">Open Threads</span>'
          +     '<span class="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">' + openThreads.length + '</span>'
          +     '<button onclick="var d=document.getElementById(\'quick-capture-dest\'); if(d) d.value=\'thread\'; window.openQuickCapture();" class="ml-auto flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors"><i data-lucide="plus" class="w-3.5 h-3.5"></i><span>New</span></button>'
          +   '</div>'
          +   '<div class="space-y-0.5">' + threadsBody + '</div>'
          + '</div>';

        // --- Last session (left) ---
        var sessionCard;
        if (latestSession) {
            var sTitle = escapeHtml(latestSession.title || 'Untitled session');
            var sDate  = latestSession.date ? '<p class="text-xs text-stone-400 dark:text-stone-500 mb-2">' + escapeHtml(latestSession.date) + '</p>' : '';
            var sTail  = escapeHtml(dashSessionTail(latestSession.notes)) || '<span class="italic text-stone-400">No notes written yet.</span>';
            sessionCard =
                '<div class="bg-white dark:bg-stone-900 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-800 p-5">'
              +   '<div class="flex items-center gap-2 mb-3"><i data-lucide="scroll-text" class="w-5 h-5 text-emerald-600"></i><span class="font-bold text-stone-800 dark:text-stone-100">Last Session</span></div>'
              +   '<p class="font-semibold text-stone-800 dark:text-stone-100">' + sTitle + '</p>'
              +   sDate
              +   '<p class="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">' + sTail + '</p>'
              +   '<button onclick="window.setTab(\'campaign_sessionNotes\', \'' + latestSession.id + '\')" class="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline">Read full note <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i></button>'
              + '</div>';
        } else {
            sessionCard =
                '<div class="bg-white dark:bg-stone-900 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-800 p-5">'
              +   '<div class="flex items-center gap-2 mb-3"><i data-lucide="scroll-text" class="w-5 h-5 text-emerald-600"></i><span class="font-bold text-stone-800 dark:text-stone-100">Last Session</span></div>'
              +   '<p class="text-sm text-stone-400 dark:text-stone-500">No session logged yet. <button onclick="window.setTab(\'campaign_sessionNotes\')" class="font-bold text-emerald-600 dark:text-emerald-400 hover:underline">Start one →</button></p>'
              + '</div>';
        }

        // --- Active quests (right) ---
        var questsBody = '';
        if (questsShown.length > 0) {
            questsShown.forEach(function(q) {
                var pill = q.isUrgent
                    ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 flex-shrink-0">Urgent</span>'
                    : '<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 flex-shrink-0">Active</span>';
                var qTitle = escapeHtml(q.title || 'Untitled quest');
                questsBody +=
                    '<div onclick="window.setTab(\'campaign_quests\', \'' + q.id + '\')" class="group flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800/60 cursor-pointer transition-colors">'
                  +   pill
                  +   '<span class="flex-1 min-w-0 text-sm font-medium text-stone-700 dark:text-stone-200 truncate">' + qTitle + '</span>'
                  +   '<i data-lucide="chevron-right" class="w-4 h-4 text-stone-300 dark:text-stone-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"></i>'
                  + '</div>';
            });
            if (questsMore > 0) {
                questsBody += '<button onclick="window.setTab(\'campaign_quests\')" class="w-full text-left px-2 py-1.5 text-xs font-semibold text-stone-500 dark:text-stone-400 hover:underline">+ ' + questsMore + ' more →</button>';
            }
        } else {
            questsBody = '<p class="px-2 py-6 text-center text-sm text-stone-400 dark:text-stone-500">No active quests right now.</p>';
        }

        var questsCard =
            '<div class="bg-white dark:bg-stone-900 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-800 p-5">'
          +   '<div class="flex items-center gap-2 mb-2">'
          +     '<i data-lucide="swords" class="w-5 h-5 text-emerald-600"></i>'
          +     '<span class="font-bold text-stone-800 dark:text-stone-100">Side Quests</span>'
          +     '<span class="text-xs font-bold px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400">' + activeQuests.length + ' active</span>'
          +   '</div>'
          +   '<div class="space-y-0.5">' + questsBody + '</div>'
          + '</div>';

        html =
            '<div class="space-y-5 animate-fade-in">'
          +   headerHtml
          +   threadsCard
          +   '<div class="grid grid-cols-1 lg:grid-cols-2 gap-5">' + sessionCard + questsCard + '</div>'
          + '</div>';
    }
    else if (activeTab.startsWith('campaign_')) {
        const subSection = activeTab.replace('campaign_', '');
        const titleMap = { sessionNotes: { title: 'Session Notes', icon: 'scroll-text' }, mainQuests: { title: 'Main Campaign', icon: 'crown' }, backstoryQuests: { title: 'Backstory Quest', icon: 'sprout' }, quests: { title: 'Side Quests', icon: 'swords' }, npcs: { title: 'NPCs', icon: 'users' }, locations: { title: 'Locations', icon: 'map-pin' }, misc: { title: 'Misc & Loot', icon: 'package' } };
        let contentHtml = '';

        if (JOURNAL_SECTIONS[subSection]) {
            // Session Notes, Main Campaign, and Backstory Quest all share this
            // layout: the shared Open Threads panel on top, then the entry list.
            const journalCfg = JOURNAL_SECTIONS[subSection];
            const journalArr = characterData.campaignNotes[subSection];
            contentHtml = renderSectionHeader('session-search', journalCfg.searchPlaceholder, 'filterSessions', 'toggleAllSessions', 'addSession') + renderThreadsPanel();
            if (journalArr.length === 0) contentHtml += `<p class="text-stone-500 text-center py-8 italic">${journalCfg.emptyMsg}</p>`;
            journalArr.forEach((sess, idx) => {
                contentHtml += `
                    <div id="${sess.id}" class="session-block mb-4 border border-stone-200 dark:border-stone-800/80 rounded-xl bg-white dark:bg-stone-900 shadow-sm overflow-hidden" data-searchable="${escapeHtml(sess.title)} ${escapeHtml(sess.date)} ${escapeHtml(stripHtmlToText(sess.notes))} ${escapeHtml((sess.tags || []).join(' '))}">
                        <div class="bg-stone-50/80 dark:bg-stone-800/60 border-b border-stone-200 dark:border-stone-800 px-5 py-4 flex justify-between items-start transition-colors">
                            <div class="flex-1 flex flex-col sm:flex-row sm:items-center gap-2">
                                <button onclick="window.toggleSessionCollapse('${sess.id}')" class="p-1 hover:bg-stone-200 dark:hover:bg-stone-700 rounded transition-colors focus:outline-none hidden sm:block"><i data-lucide="chevron-down" class="w-5 h-5 text-stone-400 chevron ${sess.isCollapsed ? 'collapsed' : ''}"></i></button>
                                <input type="text" id="input-sess-title-${sess.id}" oninput="window.updateSession('${sess.id}', 'title', this.value)" value="${escapeHtml(sess.title)}" class="seamless-input font-bold text-lg text-stone-800 dark:text-stone-100 bg-transparent px-2 py-1 -ml-2 w-full sm:w-auto rounded placeholder-stone-400" placeholder="${subSection === 'sessionNotes' ? 'Session Title' : 'Entry Title'}">
                                <input type="text" id="input-sess-date-${sess.id}" oninput="window.updateSession('${sess.id}', 'date', this.value)" value="${escapeHtml(sess.date)}" class="seamless-input text-sm text-stone-500 bg-transparent px-2 py-1 w-full sm:w-auto rounded placeholder-stone-400" placeholder="${subSection === 'sessionNotes' ? 'Date' : 'Date (optional)'}">
                            </div>
                            <div class="flex items-center space-x-1 ml-2">
                                <button onclick="window.copySessionAsText('${sess.id}')" class="text-stone-500 hover:text-emerald-600 transition-colors p-1.5 rounded hover:bg-stone-100 dark:hover:bg-stone-800" title="Copy entry as text"><i data-lucide="copy" class="w-4 h-4"></i></button>
                                ${renderActionButtons('Session', sess.id, idx === 0, idx === journalArr.length - 1)}
                            </div>
                        </div>
                        ${renderTagRow(sess.id, 'px-5 pb-3')}
                        <div class="collapsible-content ${sess.isCollapsed ? 'collapsed' : ''} ${window.isDeepLinking ? 'no-transition' : ''}">
                            <div class="p-5">${getOutlineNotesEditor('campaignNotes_session', sess.id, sess.notes, 'min-h-[150px]', subSection === 'sessionNotes' ? 'Start typing your session notes... Hitting Enter starts a bullet point, Tab indents, Shift+Tab outdents. Type @ to link notes.' : 'Major information, handouts, lore... Enter starts a bullet, Tab indents, @ to link. Next steps belong in Open Threads above.')}</div>
                        </div>
                    </div>`;
            });
        }
        else if (subSection === 'quests') {
            contentHtml = renderSectionHeader('quest-search', 'Search quests...', 'filterQuests', null, 'addQuest');
            const renderQuestCategory = (title, quests, categoryKey, isUrgentSection = false) => {
                const isCollapsed = questSectionsState[categoryKey];
                const headerColor = isUrgentSection
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-stone-700 dark:text-stone-300';
                const headerIcon = isUrgentSection ? 'flame' : 'chevron-down';
                let sectionHtml = `<div class="quest-section mb-8" data-section-type="${categoryKey}">
                    <div class="flex items-center justify-between mb-4 cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800/30 p-2 rounded -mx-2 transition-colors" onclick="window.toggleQuestSectionCollapse('${categoryKey}')">
                        <h4 class="text-lg font-bold ${headerColor} flex items-center space-x-2">
                            <i data-lucide="${isUrgentSection ? 'flame' : 'chevron-down'}" class="w-5 h-5 ${isUrgentSection ? 'text-red-500' : 'text-stone-400 chevron ' + (isCollapsed ? 'collapsed' : '')}"></i>
                            <span>${title} (${quests.length})</span>
                        </h4>
                    </div>
                    <div class="collapsible-content space-y-4 ${isCollapsed ? 'collapsed' : ''} ${window.isDeepLinking ? 'no-transition' : ''}">`;

                if (quests.length === 0) sectionHtml += `<p class="text-stone-400 italic px-8 py-2">No quests in this category.</p>`;

                quests.forEach((quest, qIdx) => {
                    const cardBorder = quest.isUrgent
                        ? 'border-red-200 dark:border-red-900/60'
                        : 'border-stone-200 dark:border-stone-800';
                    const leftBg = quest.isUrgent
                        ? 'bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/40'
                        : 'bg-stone-50 dark:bg-stone-950 border-stone-100 dark:border-stone-800';

                    sectionHtml += `
                        <div id="${quest.id}" class="quest-card bg-white dark:bg-stone-900 border ${cardBorder} rounded-xl shadow-sm overflow-hidden flex" data-searchable="${escapeHtml(quest.title)} ${escapeHtml(quest.subtitle)} ${escapeHtml(stripHtmlToText(quest.notes))} ${escapeHtml((quest.tags || []).join(' '))}">
                            <div class="${leftBg} px-4 py-5 flex flex-col items-center justify-start space-y-3 border-r">
                                <button onclick="window.toggleQuestCompletion('${quest.id}')" class="text-stone-300 dark:text-stone-600 hover:text-emerald-500 transition-colors focus:outline-none" title="Mark complete">
                                    ${quest.isCompleted ? `<i data-lucide="check-square" class="w-6 h-6 text-emerald-500"></i>` : `<i data-lucide="square" class="w-6 h-6 hover:text-emerald-400"></i>`}
                                </button>
                                ${!quest.isCompleted ? `
                                <button onclick="window.toggleQuestUrgency('${quest.id}')" class="transition-colors focus:outline-none" title="${quest.isUrgent ? 'Remove urgent flag' : 'Mark as urgent'}">
                                    <i data-lucide="flame" class="w-5 h-5 ${quest.isUrgent ? 'text-red-500' : 'text-stone-300 dark:text-stone-600 hover:text-red-400'}"></i>
                                </button>` : ''}
                            </div>
                            <div class="p-5 flex-1 flex flex-col">
                                <div class="flex justify-between items-start mb-2">
                                    <div class="flex-1">
                                        <input type="text" id="input-quest-title-${quest.id}" oninput="window.updateQuest('${quest.id}', 'title', this.value)" value="${escapeHtml(quest.title)}" class="seamless-input font-bold text-lg ${quest.isCompleted ? 'text-stone-500 dark:text-stone-400 line-through' : quest.isUrgent ? 'text-red-700 dark:text-red-400' : 'text-stone-800 dark:text-stone-100'} bg-transparent w-full mb-1 rounded px-2 -ml-2 py-0.5 placeholder-stone-400/70" placeholder="Quest Title">
                                        <input type="text" id="input-quest-sub-${quest.id}" oninput="window.updateQuest('${quest.id}', 'subtitle', this.value)" value="${escapeHtml(quest.subtitle)}" class="seamless-input text-sm font-medium text-emerald-600 dark:text-emerald-400 bg-transparent w-full rounded px-2 -ml-2 py-0.5 placeholder-emerald-600/40 dark:placeholder-emerald-400/30" placeholder="Subtitle / Category">
                                    </div>
                                    <div class="flex items-center space-x-1 ml-4">
                                        ${renderActionButtons('Quest', quest.id, qIdx === 0, qIdx === quests.length - 1)}
                                    </div>
                                </div>
                                ${renderTagRow(quest.id, '')}
                                <div class="mt-2 text-stone-600 dark:text-stone-300 ${quest.isCompleted ? 'opacity-75' : ''}">${getOutlineNotesEditor('campaignNotes_quest', quest.id, quest.notes, 'min-h-[60px]', 'Quest description or sub-objectives... Enter starts a bullet, Tab indents, @ to link.')}</div>
                                ${renderBacklinksPanel(quest.id)}
                            </div>
                        </div>`;
                });
                sectionHtml += `</div></div>`;
                return sectionHtml;
            };
            const urgentQuests = characterData.campaignNotes.quests.filter(q => q.isUrgent && !q.isCompleted);
            const inProgressQuests = characterData.campaignNotes.quests.filter(q => !q.isCompleted && !q.isUrgent);
            const completedQuests = characterData.campaignNotes.quests.filter(q => q.isCompleted);
            if (urgentQuests.length > 0) contentHtml += renderQuestCategory('Urgent', urgentQuests, 'urgent', true);
            contentHtml += renderQuestCategory('In Progress', inProgressQuests, 'inProgress');
            contentHtml += renderQuestCategory('Completed', completedQuests, 'completed');
        }
        else if (subSection === 'locations') {
            contentHtml = renderSectionHeader('location-search', 'Search locations...', 'filterLocations', 'toggleAllLocations', 'addLocation');
            if (characterData.campaignNotes.locations.length === 0) contentHtml += `<p class="text-stone-500 text-center py-8 italic">No locations added yet.</p>`;
            characterData.campaignNotes.locations.forEach((loc, idx) => {
                contentHtml += `
                    <div id="${loc.id}" class="location-block mb-4 border border-stone-200 dark:border-stone-800/80 rounded-xl bg-white dark:bg-stone-900 shadow-sm overflow-hidden" data-searchable="${escapeHtml(loc.title)} ${escapeHtml(loc.subtitle)} ${escapeHtml(stripHtmlToText(loc.notes))} ${escapeHtml((loc.tags || []).join(' '))}">
                        <div class="bg-stone-50/80 dark:bg-stone-800/60 border-b border-stone-200 dark:border-stone-800 px-5 py-4 flex justify-between items-start transition-colors">
                            <div class="flex-1 flex flex-col sm:flex-row sm:items-center gap-2">
                                <button onclick="window.toggleLocationCollapse('${loc.id}')" class="p-1 hover:bg-stone-200 dark:hover:bg-stone-700 rounded transition-colors focus:outline-none hidden sm:block"><i data-lucide="chevron-down" class="w-5 h-5 text-stone-400 chevron ${loc.isCollapsed ? 'collapsed' : ''}"></i></button>
                                <input type="text" id="input-loc-title-${loc.id}" oninput="window.updateLocation('${loc.id}', 'title', this.value)" value="${escapeHtml(loc.title)}" class="seamless-input font-bold text-lg text-stone-800 dark:text-stone-100 bg-transparent px-2 py-1 -ml-2 w-full sm:w-auto rounded placeholder-stone-400/70" placeholder="Location Name">
                                <input type="text" id="input-loc-sub-${loc.id}" oninput="window.updateLocation('${loc.id}', 'subtitle', this.value)" value="${escapeHtml(loc.subtitle)}" class="seamless-input text-sm font-medium text-emerald-600 dark:text-emerald-400 bg-transparent px-2 py-1 w-full sm:w-auto rounded placeholder-emerald-600/40 dark:placeholder-emerald-400/30" placeholder="Region / Details">
                            </div>
                            <div class="flex items-center space-x-1 ml-2">
                                ${renderActionButtons('Location', loc.id, idx === 0, idx === characterData.campaignNotes.locations.length - 1)}
                            </div>
                        </div>
                        ${renderTagRow(loc.id, 'px-5 pb-3')}
                        <div class="collapsible-content ${loc.isCollapsed ? 'collapsed' : ''} ${window.isDeepLinking ? 'no-transition' : ''}">
                            <div class="p-5">${getOutlineNotesEditor('campaignNotes_location', loc.id, loc.notes, 'min-h-[100px]', 'Location details, points of interest, or resident lists... Enter starts a bullet, Tab indents, @ to link.')}${renderBacklinksPanel(loc.id)}</div>
                        </div>
                    </div>`;
            });
        }
        else if (subSection === 'npcs') {
            contentHtml = renderSectionHeader('npc-search', 'Search NPCs...', 'filterNPCs', 'toggleAllFactions', 'addFaction');
            if (characterData.campaignNotes.npcs.length === 0) contentHtml += `<p class="text-stone-500 text-center py-8 italic">No NPCs added yet.</p>`;
            characterData.campaignNotes.npcs.forEach((faction, fIdx) => {
                contentHtml += `
                    <div id="${faction.id}" class="npc-faction-block mb-8 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden bg-stone-50 dark:bg-stone-950" data-faction-name="${escapeHtml(faction.name)}">
                        <div class="bg-stone-200/50 dark:bg-stone-800/50 px-4 py-3 border-b border-stone-200 dark:border-stone-800 flex justify-between items-center">
                            <div class="flex items-center space-x-2 flex-1 min-w-0">
                                <button onclick="window.toggleFactionCollapse('${faction.id}')" class="p-1 hover:bg-stone-300/50 dark:hover:bg-stone-700/50 rounded transition-colors focus:outline-none"><i data-lucide="chevron-down" class="w-5 h-5 text-stone-500 chevron ${faction.isCollapsed ? 'collapsed' : ''}"></i></button>
                                <input type="text" id="input-fac-name-${faction.id}" oninput="window.updateFaction('${faction.id}', this.value)" value="${escapeHtml(faction.name)}" class="seamless-input font-bold text-lg text-stone-800 dark:text-stone-100 bg-transparent w-full rounded px-2 py-0.5 placeholder-stone-400/70" placeholder="Faction Name">
                            </div>
                            <div class="flex items-center space-x-1 ml-2">
                                ${renderActionButtons('Faction', faction.id, fIdx === 0, fIdx === characterData.campaignNotes.npcs.length - 1)}
                            </div>
                        </div>
                        <div class="collapsible-content ${faction.isCollapsed ? 'collapsed' : ''} ${window.isDeepLinking ? 'no-transition' : ''}">
                            <div class="p-4 space-y-4">
                                ${faction.members.map((npc, nIdx) => `
                                    <div id="${npc.id}" class="npc-card bg-white dark:bg-stone-900 p-4 rounded-lg border border-stone-200 dark:border-stone-800/80 shadow-sm flex gap-4 transition-all" data-searchable="${escapeHtml(npc.name)} ${escapeHtml(npc.subtitle || '')} ${escapeHtml(stripHtmlToText(npc.notes))} ${escapeHtml((npc.tags || []).join(' '))}">
                                        <div class="flex-shrink-0 flex flex-col items-center gap-2 mt-1">
                                            <div class="relative w-14 h-14 rounded-full border border-stone-200 dark:border-stone-800 hover:border-emerald-400 bg-stone-50 dark:bg-stone-800 flex items-center justify-center overflow-hidden group shadow-inner transition-all animate-fade-in" title="Character avatar">
                                                ${npc.avatar ? `
                                                    <img src="${npc.avatar}" class="w-full h-full object-cover cursor-zoom-in" onclick="window.openLightbox(this.src)">
                                                    <div class="absolute inset-0 bg-stone-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200 pointer-events-none">
                                                        <button onclick="event.stopPropagation(); document.getElementById('avatar-input-${faction.id}-${npc.id}').click()" class="pointer-events-auto p-1 bg-stone-900/80 hover:bg-emerald-600 text-white rounded-full mr-1 transition-colors shadow-sm" title="Change avatar">
                                                            <i data-lucide="camera" class="w-3 h-3"></i>
                                                        </button>
                                                        <button onclick="event.stopPropagation(); window.deleteNPCAvatar(event, '${faction.id}', '${npc.id}')" class="pointer-events-auto p-1 bg-stone-900/80 hover:bg-red-600 text-white rounded-full transition-colors shadow-sm" title="Remove avatar">
                                                            <i data-lucide="trash-2" class="w-3 h-3"></i>
                                                        </button>
                                                    </div>
                                                ` : `
                                                    <i data-lucide="user" class="w-6 h-6 text-stone-400 cursor-pointer" onclick="document.getElementById('avatar-input-${faction.id}-${npc.id}').click()"></i>
                                                    <div onclick="document.getElementById('avatar-input-${faction.id}-${npc.id}').click()" class="absolute inset-0 bg-stone-900/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200 cursor-pointer">
                                                        <i data-lucide="camera" class="w-4 h-4 text-white"></i>
                                                    </div>
                                                `}
                                            </div>
                                            <input type="file" id="avatar-input-${faction.id}-${npc.id}" accept="image/*" class="hidden" onchange="window.handleNPCAvatarUpload(event, '${faction.id}', '${npc.id}')">
                                            ${renderRelationshipBadge(faction.id, npc.id, npc.relationship || 'unknown')}
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center space-x-2 w-full">
                                                <button onclick="window.toggleNpcCollapse('${faction.id}', '${npc.id}')" class="p-1 hover:bg-stone-100 dark:hover:bg-stone-800 rounded transition-colors focus:outline-none flex-shrink-0"><i data-lucide="chevron-down" class="w-4 h-4 text-stone-400 chevron ${npc.isCollapsed ? 'collapsed' : ''}"></i></button>
                                                <input type="text" id="input-npc-name-${faction.id}-${npc.id}" oninput="window.updateNPC('${faction.id}', '${npc.id}', 'name', this.value)" value="${escapeHtml(npc.name)}" class="seamless-input font-bold text-stone-800 dark:text-stone-100 min-w-0 flex-1 bg-transparent rounded px-2 py-0.5 placeholder-stone-400/70" placeholder="Character Name">
                                            </div>
                                            <div class="ml-7 mt-0.5 mb-1">
                                                <input type="text" id="input-npc-sub-${faction.id}-${npc.id}" oninput="window.updateNPC('${faction.id}', '${npc.id}', 'subtitle', this.value)" value="${escapeHtml(npc.subtitle || '')}" class="seamless-input text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-transparent w-full rounded px-2 py-0.5 placeholder-emerald-600/40 dark:placeholder-emerald-400/30" placeholder="Role, Title, or Allegiance (e.g., Carnival Owner)">
                                            </div>
                                            ${renderTagRow(npc.id, 'ml-7')}
                                            <div class="collapsible-content ${npc.isCollapsed ? 'collapsed' : ''} ${window.isDeepLinking ? 'no-transition' : ''}">
                                                ${getOutlineNotesEditor('campaignNotes_npc', faction.id + '##' + npc.id, npc.notes, 'min-h-[40px] text-sm mt-1', 'Character details, traits, affiliations... Enter starts a bullet, Tab indents, @ to link.')}
                                                ${renderBacklinksPanel(npc.id)}
                                            </div>
                                        </div>
                                        <div class="flex flex-col justify-between items-end border-l border-stone-100 dark:border-stone-800 pl-3 self-stretch flex-shrink-0">
                                            <button onclick="window.deleteNPC('${faction.id}', '${npc.id}')" class="text-stone-300 dark:text-stone-600 hover:text-red-500 transition-colors p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/20" title="Delete NPC"><i data-lucide="x" class="w-4 h-4"></i></button>
                                            <div class="relative" title="Move to another faction">
                                                <span class="block text-stone-400 hover:text-emerald-600 transition-colors p-1.5 rounded hover:bg-stone-100 dark:hover:bg-stone-800"><i data-lucide="folder-input" class="w-4 h-4"></i></span>
                                                <select onchange="window.moveNPCToFaction('${faction.id}', '${npc.id}', this.value)" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
                                                    <option value="" selected disabled>Move to faction\u2026</option>
                                                    ${characterData.campaignNotes.npcs.filter(f => f.id !== faction.id).map(f => `<option value="${f.id}">${escapeHtml(f.name || 'Unnamed Faction')}</option>`).join('')}
                                                    <option value="__new__">\u2795 New Faction\u2026</option>
                                                </select>
                                            </div>
                                            <div class="flex space-x-0.5 mt-2">
                                                <button onclick="window.moveNPC('${faction.id}', '${npc.id}', -1)" ${nIdx === 0 ? 'disabled class="text-stone-200 dark:text-stone-700 cursor-not-allowed p-1"' : 'class="text-stone-400 hover:text-emerald-600 transition-colors p-1 rounded hover:bg-stone-100 dark:hover:bg-stone-800"'} title="Move NPC Up"><i data-lucide="arrow-up" class="w-3.5 h-3.5"></i></button>
                                                <button onclick="window.moveNPC('${faction.id}', '${npc.id}', 1)" ${nIdx === faction.members.length - 1 ? 'disabled class="text-stone-200 dark:text-stone-700 cursor-not-allowed p-1"' : 'class="text-stone-400 hover:text-emerald-600 transition-colors p-1 rounded hover:bg-stone-100 dark:hover:bg-stone-800"'} title="Move NPC Down"><i data-lucide="arrow-down" class="w-3.5 h-3.5"></i></button>
                                            </div>
                                        </div>
                                    </div>`).join('')}
                                <button onclick="window.addNPC('${faction.id}')" class="w-full py-2 mt-2 border-2 border-dashed border-stone-300 dark:border-stone-800 text-stone-500 dark:text-stone-400 rounded-lg hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors flex items-center justify-center space-x-2"><i data-lucide="user-plus" class="w-4 h-4"></i><span>Add Character to Faction</span></button>
                            </div>
                        </div>
                    </div>`;
            });
        } 
        else {
            contentHtml = getOutlineNotesEditor('campaignNotes', subSection, characterData.campaignNotes[subSection], 'min-h-[250px]', 'Party inventory, loot lists, campaign rules, or general scratchpad... Enter starts a bullet, Tab indents, @ to link.');
        }

        html = `<div class="space-y-6 animate-fade-in"><section class="bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-800"><h3 class="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-6 flex items-center space-x-2 border-b border-stone-100 dark:border-stone-800/80 pb-4"><i data-lucide="${titleMap[subSection].icon}" class="text-emerald-600"></i><span>${titleMap[subSection].title}</span></h3><div>${contentHtml}</div></section></div>`;
    }
    else if (activeTab === 'tags') {
        html = renderTagsPage();
    }

    container.innerHTML = html;

    if (activeTab === 'build') window.recalculateBuildScores();

    var journalRestoreKey = activeTab.startsWith('campaign_') ? activeTab.replace('campaign_', '') : null;
    if (journalRestoreKey && JOURNAL_SECTIONS[journalRestoreKey] && currentSearchQueries[journalRestoreKey]) { document.getElementById('session-search').value = currentSearchQueries[journalRestoreKey]; window.filterSessions(currentSearchQueries[journalRestoreKey]); }
    else if (activeTab === 'campaign_quests' && currentSearchQueries.quests) { document.getElementById('quest-search').value = currentSearchQueries.quests; window.filterQuests(currentSearchQueries.quests); }
    else if (activeTab === 'campaign_locations' && currentSearchQueries.locations) { document.getElementById('location-search').value = currentSearchQueries.locations; window.filterLocations(currentSearchQueries.locations); }
    else if (activeTab === 'campaign_npcs' && currentSearchQueries.npcs) { document.getElementById('npc-search').value = currentSearchQueries.npcs; window.filterNPCs(currentSearchQueries.npcs); }
    else if (activeTab === 'backstory' && currentSearchQueries.backstory) { document.getElementById('backstory-search').value = currentSearchQueries.backstory; window.filterBackstory(currentSearchQueries.backstory); }
    else if (activeTab === 'personality' && currentSearchQueries.personality) { document.getElementById('personality-search').value = currentSearchQueries.personality; window.filterPersonality(currentSearchQueries.personality); }

    // RESTORE FOCUS & CARET POSITION: Safely bypassed if components were destroyed during transition
    try {
        if (activeInputId) {
            var targetInput = document.getElementById(activeInputId);
            if (targetInput) {
                targetInput.focus();
                try {
                    targetInput.setSelectionRange(selectionStart, selectionEnd);
                } catch(e) {}
            }
        } else if (activeField) {
            var querySelector = `[data-editor-field="${activeField}"]`;
            if (activeSection) {
                querySelector += `[data-editor-section="${activeSection}"]`;
            }
            var targetEl = container.querySelector(querySelector);
            if (targetEl) {
                targetEl.focus();
                
                var range = document.createRange();
                var sel = window.getSelection();
                var charCount = 0;
                var stop = false;
                
                function traverse(node) {
                    if (stop) return;
                    if (node.nodeType === Node.TEXT_NODE) {
                        var nextCount = charCount + node.length;
                        if (caretOffset >= charCount && caretOffset <= nextCount) {
                            range.setStart(node, caretOffset - charCount);
                            range.collapse(true);
                            stop = true;
                        }
                        charCount = nextCount;
                    } else {
                        for (var i = 0; i < node.childNodes.length; i++) {
                            traverse(node.childNodes[i]);
                            if (stop) break;
                        }
                    }
                }
                traverse(targetEl);
                if (stop) {
                    sel.removeAllRanges();
                    sel.addRange(range);
                } else {
                    var rangeEnd = document.createRange();
                    rangeEnd.selectNodeContents(targetEl);
                    rangeEnd.collapse(false);
                    sel.removeAllRanges();
                    sel.addRange(rangeEnd);
                }
            }
        }
    } catch(e) { console.warn("Focus guard restore safely bypassed: ", e); }
}