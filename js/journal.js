// =========================================================================
// JOURNAL — side panel and session recap
// =========================================================================
// The side panel sits beside the session list and stays in view while the
// page scrolls. Top half: who and what the current session @mentions (built
// from the notes, nothing stored). Bottom half: the shared Open Threads box.
// The only stored addition is an optional plain-text `recap` on a session.

// Which session the panel describes: the one last clicked into, else the
// first open one, else the newest.
var journalPanelSessionId = '';

function journalPanelSession() {
    var list = characterData.campaignNotes.sessionNotes || [];
    var hit = list.find(function(s) { return s.id === journalPanelSessionId; });
    if (!hit) hit = list.find(function(s) { return !s.isCollapsed; }) || list[0] || null;
    return hit;
}

// The "Previously on…" box shown at the top of an open session.
function journalRecapHtml(sess) {
    return '<div class="mb-4 px-4 py-3 rounded-xl bg-emerald-950/30 border border-emerald-900/60">'
        + '<div class="text-[11px] font-bold tracking-wider text-emerald-400 mb-1">PREVIOUSLY ON…</div>'
        + '<div contenteditable="true" data-editor-section="journal_recap" data-editor-field="' + sess.id + '" '
        +   'oninput="window.updateSession(\'' + sess.id + '\', \'recap\', this.innerText.replace(/\\n+$/, \'\'))" onpaste="window.handlePaste(event)" '
        +   'class="seamless-input rounded px-1 -mx-1 min-h-[24px] text-stone-200 leading-relaxed whitespace-pre-wrap focus:outline-none" '
        +   'data-placeholder="Optional: two or three lines to jog your memory next time.">' + escapeHtml(sess.recap || '') + '</div>'
        + '</div>';
}

function journalContextHtml() {
    var sess = journalPanelSession();
    var head = '<div class="text-[11px] font-bold tracking-wider text-stone-400">IN THIS SESSION</div>';
    if (!sess) return head + '<p class="text-sm text-stone-500 mt-2">Add a session to start.</p>';
    head += '<div class="text-sm font-semibold text-stone-200 mt-0.5 truncate">' + (escapeHtml(sess.title) || 'Untitled session') + (sess.date ? ' <span class="font-normal text-stone-500">· ' + escapeHtml(sess.date) + '</span>' : '') + '</div>';

    var people = [], places = [], quests = [], seen = {};
    extractMentionTargets(sess.notes).forEach(function(t) {
        if (seen[t.itemId]) return;
        seen[t.itemId] = true;
        var quest = characterData.campaignNotes.quests.find(function(q) { return q.id === t.itemId; });
        if (quest) { quests.push(quest); return; }
        var hit = (typeof codexFind === 'function') ? codexFind(t.itemId) : null;
        if (!hit) return;
        if (hit.kind === 'npc') people.push({ id: t.itemId, label: hit.npc.name, rel: hit.npc.relationship, avatar: hit.npc.avatar });
        else if (hit.kind === 'faction') people.push({ id: t.itemId, label: hit.faction.name, group: true });
        else if (hit.kind === 'location') places.push({ id: t.itemId, label: hit.loc.title });
    });

    function block(title, rowsHtml) {
        return '<div class="mt-4"><div class="text-xs font-semibold text-stone-400 mb-1.5">' + title + '</div><div class="space-y-1">' + rowsHtml + '</div></div>';
    }
    function row(tab, id, left, label, right) {
        return '<button onclick="window.setTab(\'' + tab + '\', \'' + id + '\')" class="w-full flex items-center gap-2.5 text-left px-2.5 py-2 rounded-lg bg-stone-800/50 hover:bg-stone-800 transition-colors">'
            + left + '<span class="flex-1 min-w-0 text-sm font-medium text-stone-200 truncate">' + (escapeHtml(label) || 'Unnamed') + '</span>' + (right || '') + '</button>';
    }
    var REL_TEXT = { unknown: 'text-stone-500', friendly: 'text-emerald-400', neutral: 'text-blue-400', wary: 'text-amber-400', hostile: 'text-red-400' };

    var html = head;
    if (people.length) html += block('People', people.map(function(p) {
        var left = p.group
            ? '<span class="w-6 h-6 rounded-full bg-stone-700 text-stone-300 flex items-center justify-center flex-shrink-0"><i data-lucide="users" class="w-3 h-3"></i></span>'
            : (p.avatar ? '<img src="' + p.avatar + '" class="w-6 h-6 rounded-full object-cover flex-shrink-0">'
                        : '<span class="w-6 h-6 rounded-full bg-stone-700 text-stone-300 flex items-center justify-center text-[11px] font-bold flex-shrink-0">' + escapeHtml((p.label || '?').charAt(0).toUpperCase()) + '</span>');
        var relCfg = NPC_RELATIONSHIPS[p.rel] || NPC_RELATIONSHIPS.unknown;
        var right = p.group ? '<span class="text-[11px] text-stone-500 flex-shrink-0">Group</span>'
            : (p.rel && p.rel !== 'unknown' ? '<span class="text-[11px] font-semibold flex-shrink-0 ' + (REL_TEXT[p.rel] || REL_TEXT.unknown) + '">' + relCfg.label + '</span>' : '');
        return row('campaign_npcs', p.id, left, p.label, right);
    }).join(''));
    if (places.length) html += block('Places', places.map(function(p) {
        return row('campaign_locations', p.id, '<span class="w-6 h-6 rounded-full bg-stone-700 text-stone-300 flex items-center justify-center flex-shrink-0"><i data-lucide="map-pin" class="w-3 h-3"></i></span>', p.label, '');
    }).join(''));
    if (quests.length) html += block('Quests', quests.map(function(q) {
        var t = QUEST_TYPES[q.type] || QUEST_TYPES.side;
        return row('campaign_quests', q.id, '<span class="w-2 h-2 rounded-full flex-shrink-0 ' + t.dot + '"></span>', q.title, '<span class="text-[11px] text-stone-500 flex-shrink-0">' + t.label + (q.isCompleted ? ' · done' : '') + '</span>');
    }).join(''));
    if (!people.length && !places.length && !quests.length) {
        html += '<p class="text-sm text-stone-500 mt-3 leading-relaxed">Type @ in your notes to link people, places and quests. They collect here.</p>';
    }
    return html;
}

function renderJournalSidePanel() {
    return '<aside class="order-first lg:order-none lg:sticky lg:top-0 lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto custom-scrollbar space-y-4">'
        + '<div id="journal-context" class="rounded-xl border border-stone-800 bg-stone-950/60 p-4">' + journalContextHtml() + '</div>'
        + '<div id="journal-threads">' + renderThreadsPanel() + '</div>'
        + '</aside>';
}

// Redraw only the "In this session" box, so typing in notes or in the
// thread box is never interrupted.
function journalRefreshContext() {
    var el = document.getElementById('journal-context');
    if (!el) return;
    el.innerHTML = journalContextHtml();
    if (window.lucide) lucide.createIcons();
}

window.journalFocusSession = function(sessId) {
    if (journalPanelSessionId === sessId) return;
    var before = journalPanelSession();
    journalPanelSessionId = sessId;
    if (!before || before.id !== sessId) journalRefreshContext();
};

// Called from handleInput while session notes are being typed.
var journalRefreshTimer = null;
window.journalNotesChanged = function(sessId) {
    journalPanelSessionId = sessId;
    clearTimeout(journalRefreshTimer);
    journalRefreshTimer = setTimeout(journalRefreshContext, 400);
};
