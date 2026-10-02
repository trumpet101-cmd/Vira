// =========================================================================
// CODEX — one page for people, places and loot
// =========================================================================
// A VIEW over existing data; nothing is stored differently:
//   people -> campaignNotes.npcs (factions -> members)
//   places -> campaignNotes.locations
//   loot   -> campaignNotes.misc (one notes block)
// Saved @mention links still name the old tabs (campaign_npcs,
// campaign_locations, campaign_misc). TAB_ALIASES in state.js sends those
// here, and setTab() selects the entry by its id.

var CODEX_LOOT_ID = '__codex_loot';
// Ephemeral view state (resets on reload).
var codexState = { selectedId: '', filter: 'all', query: '' };

var CODEX_FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'people', label: 'People' },
    { key: 'places', label: 'Places' },
    { key: 'party', label: 'Party' },
    { key: 'loot', label: 'Loot' }
];
var CODEX_REL_DOT = { unknown: 'bg-stone-500', friendly: 'bg-emerald-400', neutral: 'bg-blue-400', wary: 'bg-amber-400', hostile: 'bg-red-400' };

// ---------- lookups ----------
function codexFind(id) {
    var cn = characterData.campaignNotes;
    if (id === CODEX_LOOT_ID) return { kind: 'loot' };
    for (var f = 0; f < cn.npcs.length; f++) {
        var fac = cn.npcs[f];
        if (fac.id === id) return { kind: 'faction', faction: fac, index: f };
        var members = fac.members || [];
        for (var n = 0; n < members.length; n++) {
            if (members[n].id === id) return { kind: 'npc', npc: members[n], faction: fac, index: n };
        }
    }
    for (var l = 0; l < cn.locations.length; l++) {
        if (cn.locations[l].id === id) return { kind: 'location', loc: cn.locations[l], index: l };
    }
    return null;
}

function codexIsParty(npc, fac) {
    if ((npc.tags || []).some(function(t) { return String(t).toLowerCase() === 'party'; })) return true;
    return /party/i.test(fac.name || '');
}

function codexDefaultSelection() {
    var cn = characterData.campaignNotes;
    for (var f = 0; f < cn.npcs.length; f++) {
        if ((cn.npcs[f].members || []).length) return cn.npcs[f].members[0].id;
    }
    if (cn.locations.length) return cn.locations[0].id;
    return CODEX_LOOT_ID;
}

// ---------- every mention of every entry ----------
// Unlike the backlink index (one row per source entry), this keeps each
// separate mention, so an entry page can show every line that names it.
var codexMentionIndex = {};
function codexRebuildMentions() {
    codexMentionIndex = {};
    var cd = characterData, cn = cd.campaignNotes;
    function add(html, srcId, tabId, icon, title, meta) {
        var seen = {};
        extractMentionTargets(html).forEach(function(t) {
            if (t.itemId === srcId) return;
            var key = t.itemId + '|' + t.snippet;
            if (seen[key]) return;   // two links to the same entry in one line = one row
            seen[key] = true;
            (codexMentionIndex[t.itemId] = codexMentionIndex[t.itemId] || []).push({
                tabId: tabId, sourceId: srcId, icon: icon, title: title, meta: meta,
                snippet: t.snippet, mentionText: t.mentionText
            });
        });
    }
    (cn.sessionNotes || []).forEach(function(s) { add(s.notes, s.id, 'campaign_sessionNotes', 'scroll-text', s.title || 'Untitled session', s.date || ''); });
    (cn.quests || []).forEach(function(q) { add(q.notes, q.id, 'campaign_quests', 'swords', q.title || 'Untitled quest', ((QUEST_TYPES[q.type] || QUEST_TYPES.side).label) + ' quest'); });
    (cn.threads || []).forEach(function(t) { add(t.text, t.id, 'campaign_sessionNotes', 'help-circle', 'Open thread', ''); });
    (cn.npcs || []).forEach(function(fac) { (fac.members || []).forEach(function(n) { add(n.notes, n.id, 'campaign_npcs', 'user', n.name || 'Unnamed', 'Person'); }); });
    (cn.locations || []).forEach(function(l) { add(l.notes, l.id, 'campaign_locations', 'map-pin', l.title || 'Untitled place', 'Place'); });
    if (typeof cn.misc === 'string') add(cn.misc, CODEX_LOOT_ID, 'campaign_misc', 'package', 'Loot & misc', '');
    (cd.backstory || []).forEach(function(b) { add(b.notes, b.id, 'backstory', 'book-open', b.title || 'Backstory', 'Backstory'); });
    (cd.personality || []).forEach(function(p) { add(p.notes, p.id, 'personality', 'brain', p.title || 'Personality', 'Personality'); });
}
function codexMentionsOf(id) { return codexMentionIndex[id] || []; }

// ---------- left column: the list ----------
function codexMatches(q, parts) {
    if (!q) return true;
    return parts.join(' ').toLowerCase().indexOf(q) !== -1;
}

function codexRowHtml(id, label, sub, leftHtml) {
    var on = id === codexState.selectedId;
    var count = codexMentionsOf(id).length;
    return '<button id="cx-row-' + id + '" onclick="window.codexSelect(\'' + id + '\')" class="w-full flex items-center gap-2.5 text-left px-2.5 py-2 rounded-lg transition-colors '
        + (on ? 'bg-emerald-800 text-white' : 'text-stone-200 hover:bg-stone-800/70') + '">'
        + leftHtml
        + '<span class="flex-1 min-w-0"><span class="cx-row-label block text-sm font-semibold truncate">' + (escapeHtml(label) || '<span class="italic opacity-60">Unnamed</span>') + '</span>'
        + (sub ? '<span class="block text-[11px] truncate ' + (on ? 'text-emerald-200' : 'text-stone-500') + '">' + escapeHtml(sub) + '</span>' : '')
        + '</span>'
        + (count ? '<span class="text-[11px] flex-shrink-0 ' + (on ? 'text-emerald-200' : 'text-stone-500') + '" title="' + count + ' mention' + (count === 1 ? '' : 's') + '">' + count + '</span>' : '')
        + '</button>';
}

function codexListHtml() {
    var cn = characterData.campaignNotes;
    var q = (codexState.query || '').trim().toLowerCase();
    var filter = codexState.filter;
    var out = '';
    var any = false;

    if (filter === 'all' || filter === 'people' || filter === 'party') {
        cn.npcs.forEach(function(fac) {
            var rows = (fac.members || []).filter(function(n) {
                if (filter === 'party' && !codexIsParty(n, fac)) return false;
                return codexMatches(q, [n.name, n.subtitle || '', stripHtmlToText(n.notes), (n.tags || []).join(' '), fac.name || '']);
            });
            // Empty groups still show (so they can be renamed or filled), except while searching or in the Party filter.
            if (!rows.length && (q || filter === 'party')) return;
            any = true;
            var facOn = fac.id === codexState.selectedId;
            out += '<button id="cx-row-' + fac.id + '" onclick="window.codexSelect(\'' + fac.id + '\')" class="w-full flex items-center gap-2 text-left px-2.5 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider transition-colors '
                + (facOn ? 'text-emerald-400' : 'text-stone-500 hover:text-stone-300') + '" title="Open this group">'
                + '<i data-lucide="users" class="w-3.5 h-3.5 flex-shrink-0"></i><span class="cx-row-label truncate">' + (escapeHtml(fac.name) || 'Unnamed group') + '</span></button>';
            rows.forEach(function(n) {
                var avatar = n.avatar
                    ? '<img src="' + n.avatar + '" class="w-7 h-7 rounded-full object-cover flex-shrink-0">'
                    : '<span class="w-7 h-7 rounded-full bg-stone-700 text-stone-300 flex items-center justify-center text-xs font-bold flex-shrink-0">' + escapeHtml((n.name || '?').charAt(0).toUpperCase()) + '</span>';
                var dot = '<span id="cx-rel-' + n.id + '" class="w-2 h-2 rounded-full flex-shrink-0 ' + (CODEX_REL_DOT[n.relationship] || CODEX_REL_DOT.unknown) + '" title="' + escapeHtml((NPC_RELATIONSHIPS[n.relationship] || NPC_RELATIONSHIPS.unknown).label) + '"></span>';
                out += codexRowHtml(n.id, n.name, n.subtitle, avatar + dot);
            });
        });
    }

    if (filter === 'all' || filter === 'places') {
        var locs = cn.locations.filter(function(l) { return codexMatches(q, [l.title, l.subtitle || '', stripHtmlToText(l.notes), (l.tags || []).join(' ')]); });
        if (locs.length) {
            any = true;
            out += '<div class="flex items-center gap-2 px-2.5 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-stone-500"><i data-lucide="map-pin" class="w-3.5 h-3.5"></i><span>Places</span></div>';
            locs.forEach(function(l) {
                out += codexRowHtml(l.id, l.title, l.subtitle, '<span class="w-7 h-7 rounded-full bg-stone-700 text-stone-300 flex items-center justify-center flex-shrink-0"><i data-lucide="map-pin" class="w-3.5 h-3.5"></i></span>');
            });
        }
    }

    if ((filter === 'all' || filter === 'loot') && codexMatches(q, ['loot misc', stripHtmlToText(cn.misc || '')])) {
        any = true;
        out += '<div class="flex items-center gap-2 px-2.5 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-stone-500"><i data-lucide="package" class="w-3.5 h-3.5"></i><span>Loot</span></div>';
        out += codexRowHtml(CODEX_LOOT_ID, 'Loot & misc', 'Party inventory and scratchpad', '<span class="w-7 h-7 rounded-full bg-stone-700 text-stone-300 flex items-center justify-center flex-shrink-0"><i data-lucide="package" class="w-3.5 h-3.5"></i></span>');
    }

    if (!any) out = '<p class="px-2.5 py-6 text-sm text-stone-500 italic text-center">Nothing matches.</p>';
    return out;
}

// ---------- right column: the selected entry ----------
function codexTimelineHtml(id) {
    var rows = codexMentionsOf(id);
    var head = '<div class="flex items-center gap-2 mt-6 mb-3 pt-4 border-t border-stone-800"><i data-lucide="link" class="w-4 h-4 text-emerald-400"></i><span class="text-xs font-bold text-stone-400 uppercase tracking-wider">Every mention' + (rows.length ? ' (' + rows.length + ')' : '') + '</span></div>';
    if (!rows.length) return head + '<p class="text-sm text-stone-500 italic">Not mentioned anywhere yet. Type @ in any note to link here.</p>';
    return head + '<div class="space-y-2">' + rows.map(function(b) {
        var snip = highlightBacklinkSnippet(clipBacklinkSnippet(b.snippet, b.mentionText), b.mentionText);
        return '<button onclick="window.setTab(\'' + b.tabId + '\', \'' + (b.sourceId === CODEX_LOOT_ID ? '' : b.sourceId) + '\'); return false;" class="w-full text-left flex items-start gap-3 p-3 rounded-lg bg-stone-950 border border-stone-800 hover:border-stone-600 transition-colors group">'
            + '<i data-lucide="' + b.icon + '" class="w-4 h-4 text-stone-500 mt-0.5 flex-shrink-0"></i>'
            + '<span class="flex-1 min-w-0"><span class="block text-xs font-bold text-stone-400">' + escapeHtml(b.title) + (b.meta ? ' <span class="font-normal text-stone-500">· ' + escapeHtml(b.meta) + '</span>' : '') + '</span>'
            + '<span class="block text-sm text-stone-300 leading-snug mt-1">' + snip + '</span></span>'
            + '<i data-lucide="chevron-right" class="w-4 h-4 text-stone-600 group-hover:text-emerald-500 self-center flex-shrink-0"></i>'
            + '</button>';
    }).join('') + '</div>';
}

function codexIconBtn(onclick, icon, title, disabled, danger) {
    if (disabled) return '<button disabled class="p-1.5 text-stone-700 cursor-not-allowed" title="' + title + '"><i data-lucide="' + icon + '" class="w-4 h-4"></i></button>';
    return '<button onclick="' + onclick + '" class="p-1.5 rounded transition-colors text-stone-500 ' + (danger ? 'hover:text-red-500 hover:bg-red-950/20' : 'hover:text-emerald-500 hover:bg-stone-800') + '" title="' + title + '"><i data-lucide="' + icon + '" class="w-4 h-4"></i></button>';
}

function codexDetailHtml(editorFn) {
    var hit = codexFind(codexState.selectedId);
    if (!hit) return '<p class="text-stone-500 italic py-10 text-center">Pick something from the list.</p>';
    var cn = characterData.campaignNotes;
    var id = codexState.selectedId;

    if (hit.kind === 'loot') {
        return '<div><div class="flex items-center gap-3 mb-4"><span class="w-12 h-12 rounded-full bg-stone-800 flex items-center justify-center text-stone-300"><i data-lucide="package" class="w-5 h-5"></i></span>'
            + '<div><h4 class="text-xl font-bold text-stone-100">Loot &amp; misc</h4><p class="text-xs text-stone-500">Party inventory, loot lists, house rules, scratchpad</p></div></div>'
            + editorFn('campaignNotes', 'misc', cn.misc, 'min-h-[250px]', 'Party inventory, loot lists, campaign rules, or general scratchpad... Enter starts a bullet, Tab indents, @ to link.')
            + '</div>';
    }

    if (hit.kind === 'faction') {
        var fac = hit.faction;
        var count = (fac.members || []).length;
        return '<div id="' + fac.id + '" class="rounded-xl">'
            + '<div class="flex items-start gap-3 mb-4"><span class="w-12 h-12 rounded-full bg-stone-800 flex items-center justify-center text-stone-300 flex-shrink-0"><i data-lucide="users" class="w-5 h-5"></i></span>'
            + '<div class="flex-1 min-w-0"><input type="text" id="input-fac-name-' + fac.id + '" oninput="window.updateFaction(\'' + fac.id + '\', this.value); window.codexSyncRow(\'' + fac.id + '\', this.value)" value="' + escapeHtml(fac.name) + '" class="seamless-input font-bold text-xl text-stone-100 bg-transparent w-full rounded px-2 -ml-2 py-0.5 placeholder-stone-400/70" placeholder="Group name">'
            + '<p class="text-xs text-stone-500 mt-1">Group · ' + count + ' ' + (count === 1 ? 'person' : 'people') + '</p></div>'
            + '<div class="flex items-center space-x-1 flex-shrink-0">'
            + codexIconBtn("window.moveFaction('" + fac.id + "', -1)", 'arrow-up', 'Move group up', hit.index === 0)
            + codexIconBtn("window.moveFaction('" + fac.id + "', 1)", 'arrow-down', 'Move group down', hit.index === cn.npcs.length - 1)
            + codexIconBtn("window.deleteFaction('" + fac.id + "')", 'trash-2', 'Delete group and its people', false, true)
            + '</div></div>'
            + '<button onclick="window.codexAddPerson(\'' + fac.id + '\')" class="w-full py-2 border-2 border-dashed border-stone-800 text-stone-400 rounded-lg hover:border-emerald-400 hover:text-emerald-400 transition-colors flex items-center justify-center space-x-2"><i data-lucide="user-plus" class="w-4 h-4"></i><span>Add a person to this group</span></button>'
            + codexTimelineHtml(fac.id)
            + '</div>';
    }

    if (hit.kind === 'location') {
        var loc = hit.loc;
        return '<div id="' + loc.id + '" class="rounded-xl">'
            + '<div class="flex items-start gap-3 mb-2"><span class="w-12 h-12 rounded-full bg-stone-800 flex items-center justify-center text-stone-300 flex-shrink-0"><i data-lucide="map-pin" class="w-5 h-5"></i></span>'
            + '<div class="flex-1 min-w-0">'
            + '<input type="text" id="input-loc-title-' + loc.id + '" oninput="window.updateLocation(\'' + loc.id + '\', \'title\', this.value); window.codexSyncRow(\'' + loc.id + '\', this.value)" value="' + escapeHtml(loc.title) + '" class="seamless-input font-bold text-xl text-stone-100 bg-transparent w-full rounded px-2 -ml-2 py-0.5 placeholder-stone-400/70" placeholder="Place name">'
            + '<input type="text" id="input-loc-sub-' + loc.id + '" oninput="window.updateLocation(\'' + loc.id + '\', \'subtitle\', this.value)" value="' + escapeHtml(loc.subtitle) + '" class="seamless-input text-sm font-medium text-emerald-400 bg-transparent w-full rounded px-2 -ml-2 py-0.5 placeholder-emerald-400/30" placeholder="Region / details">'
            + '</div>'
            + '<div class="flex items-center space-x-1 flex-shrink-0">'
            + codexIconBtn("window.moveLocation('" + loc.id + "', -1)", 'arrow-up', 'Move up', hit.index === 0)
            + codexIconBtn("window.moveLocation('" + loc.id + "', 1)", 'arrow-down', 'Move down', hit.index === cn.locations.length - 1)
            + codexIconBtn("window.deleteLocation('" + loc.id + "')", 'trash-2', 'Delete place', false, true)
            + '</div></div>'
            + renderTagRow(loc.id, 'mb-3', true)
            + editorFn('campaignNotes_location', loc.id, loc.notes, 'min-h-[120px]', 'Details, points of interest, who lives here... Enter starts a bullet, Tab indents, @ to link.')
            + codexTimelineHtml(loc.id)
            + '</div>';
    }

    // person
    var npc = hit.npc, f = hit.faction;
    var inputId = 'avatar-input-' + f.id + '-' + npc.id;
    var portrait = npc.avatar
        ? '<img src="' + npc.avatar + '" class="w-full h-full object-cover cursor-zoom-in" onclick="window.openLightbox(this.src)">'
          + '<div class="absolute inset-0 bg-stone-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200 pointer-events-none">'
          + '<button onclick="event.stopPropagation(); document.getElementById(\'' + inputId + '\').click()" class="pointer-events-auto p-1.5 bg-stone-900/80 hover:bg-emerald-600 text-white rounded-full mr-1 transition-colors" title="Change portrait"><i data-lucide="camera" class="w-3.5 h-3.5"></i></button>'
          + '<button onclick="event.stopPropagation(); window.deleteNPCAvatar(event, \'' + f.id + '\', \'' + npc.id + '\')" class="pointer-events-auto p-1.5 bg-stone-900/80 hover:bg-red-600 text-white rounded-full transition-colors" title="Remove portrait"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button></div>'
        : '<button onclick="document.getElementById(\'' + inputId + '\').click()" class="w-full h-full flex items-center justify-center text-stone-400 hover:text-emerald-400" title="Add a portrait"><i data-lucide="camera" class="w-6 h-6"></i></button>';
    var groupOptions = cn.npcs.filter(function(x) { return x.id !== f.id; }).map(function(x) { return '<option value="' + x.id + '">' + escapeHtml(x.name || 'Unnamed group') + '</option>'; }).join('');

    return '<div id="' + npc.id + '" class="rounded-xl">'
        + '<div class="flex items-start gap-4 mb-2">'
        +   '<div class="flex flex-col items-center gap-2 flex-shrink-0">'
        +     '<div class="relative w-20 h-20 rounded-full border border-stone-700 bg-stone-800 flex items-center justify-center overflow-hidden group">' + portrait + '</div>'
        +     '<input type="file" id="' + inputId + '" accept="image/*" class="hidden" onchange="window.handleNPCAvatarUpload(event, \'' + f.id + '\', \'' + npc.id + '\')">'
        +     renderRelationshipBadge(f.id, npc.id, npc.relationship || 'unknown')
        +   '</div>'
        +   '<div class="flex-1 min-w-0">'
        +     '<input type="text" id="input-npc-name-' + f.id + '-' + npc.id + '" oninput="window.updateNPC(\'' + f.id + '\', \'' + npc.id + '\', \'name\', this.value); window.codexSyncRow(\'' + npc.id + '\', this.value)" value="' + escapeHtml(npc.name) + '" class="seamless-input font-bold text-2xl text-stone-100 bg-transparent w-full rounded px-2 -ml-2 py-0.5 placeholder-stone-400/70" placeholder="Name">'
        +     '<input type="text" id="input-npc-sub-' + f.id + '-' + npc.id + '" oninput="window.updateNPC(\'' + f.id + '\', \'' + npc.id + '\', \'subtitle\', this.value)" value="' + escapeHtml(npc.subtitle || '') + '" class="seamless-input text-sm font-medium text-emerald-400 bg-transparent w-full rounded px-2 -ml-2 py-0.5 placeholder-emerald-400/30" placeholder="Role, title or allegiance">'
        +     '<div class="flex items-center gap-2 mt-1.5 text-xs text-stone-500"><i data-lucide="users" class="w-3.5 h-3.5"></i>'
        +       '<select onchange="window.moveNPCToFaction(\'' + f.id + '\', \'' + npc.id + '\', this.value)" class="bg-transparent text-stone-400 hover:text-stone-200 cursor-pointer focus:outline-none rounded" title="Move to another group">'
        +         '<option value="" selected>' + escapeHtml(f.name || 'Unnamed group') + '</option>' + groupOptions + '<option value="__new__">➕ New group…</option>'
        +       '</select></div>'
        +     renderTagRow(npc.id, '', true)
        +   '</div>'
        +   '<div class="flex items-center space-x-1 flex-shrink-0">'
        +     codexIconBtn("window.moveNPC('" + f.id + "', '" + npc.id + "', -1)", 'arrow-up', 'Move up in group', hit.index === 0)
        +     codexIconBtn("window.moveNPC('" + f.id + "', '" + npc.id + "', 1)", 'arrow-down', 'Move down in group', hit.index === f.members.length - 1)
        +     codexIconBtn("window.deleteNPC('" + f.id + "', '" + npc.id + "')", 'trash-2', 'Delete person', false, true)
        +   '</div>'
        + '</div>'
        + '<div class="mt-3">' + editorFn('campaignNotes_npc', f.id + '##' + npc.id, npc.notes, 'min-h-[120px]', 'Who they are, what you know... Enter starts a bullet, Tab indents, @ to link.') + '</div>'
        + codexTimelineHtml(npc.id)
        + '</div>';
}

// ---------- the page ----------
function renderCodexPage(editorFn) {
    codexRebuildMentions();
    if (!codexFind(codexState.selectedId)) codexState.selectedId = codexDefaultSelection();

    var chips = CODEX_FILTERS.map(function(f) {
        var on = codexState.filter === f.key;
        return '<button onclick="window.codexSetFilter(\'' + f.key + '\')" class="text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors '
            + (on ? 'bg-emerald-800 text-white border-emerald-700' : 'bg-stone-900 text-stone-300 border-stone-700 hover:border-emerald-400') + '">' + f.label + '</button>';
    }).join('');
    var addBtn = function(fn, icon, label) {
        return '<button onclick="' + fn + '" class="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 bg-emerald-950/40 text-emerald-300 text-xs font-semibold rounded-lg hover:bg-emerald-900 transition-colors"><i data-lucide="' + icon + '" class="w-3.5 h-3.5"></i>' + label + '</button>';
    };

    return '<div class="space-y-6 animate-fade-in"><section class="bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-800">'
        + '<h3 class="text-2xl font-bold text-stone-100 mb-6 flex items-center space-x-2 border-b border-stone-800/80 pb-4"><i data-lucide="library" class="text-emerald-600"></i><span>Codex</span></h3>'
        + '<div class="grid grid-cols-1 md:grid-cols-[290px_minmax(0,1fr)] gap-6">'
        +   '<div class="md:border-r md:border-stone-800 md:pr-5">'
        +     '<div class="relative mb-3"><div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><i data-lucide="search" class="w-4 h-4 text-stone-400"></i></div>'
        +     '<input type="text" id="codex-search" oninput="window.codexSearch(this.value)" value="' + escapeHtml(codexState.query) + '" placeholder="Filter the codex..." class="seamless-input w-full pl-9 pr-3 py-2 text-sm border border-stone-800 rounded-lg bg-stone-950 text-stone-100"></div>'
        +     '<div class="flex flex-wrap gap-1.5 mb-3">' + chips + '</div>'
        +     '<div class="flex gap-1.5 mb-2">' + addBtn('window.codexAddPerson()', 'user-plus', 'Person') + addBtn('window.codexAddPlace()', 'map-pin', 'Place') + addBtn('window.codexAddGroup()', 'users', 'Group') + '</div>'
        +     '<div id="codex-list" class="md:max-h-[65vh] overflow-y-auto custom-scrollbar pr-1 space-y-0.5">' + codexListHtml() + '</div>'
        +   '</div>'
        +   '<div id="codex-detail" class="min-w-0">' + codexDetailHtml(editorFn) + '</div>'
        + '</div></section></div>';
}

// ---------- actions ----------
function codexRefresh() { window.renderContent(); if (window.lucide) lucide.createIcons(); }

window.codexSelect = function(id) { codexState.selectedId = id; codexRefresh(); };
window.codexSetFilter = function(key) { codexState.filter = key; codexRefresh(); };

// Typing in the filter box redraws only the list, so the box keeps focus.
window.codexSearch = function(value) {
    codexState.query = value || '';
    var el = document.getElementById('codex-list');
    if (el) { el.innerHTML = codexListHtml(); if (window.lucide) lucide.createIcons(); }
};

// Keep the list label in step while a name is being typed.
window.codexSyncRow = function(id, value) {
    var row = document.getElementById('cx-row-' + id);
    var label = row ? row.querySelector('.cx-row-label') : null;
    if (label) label.textContent = value || 'Unnamed';
};

window.codexAddPerson = function(facId) {
    var cn = characterData.campaignNotes;
    var fac = facId ? cn.npcs.find(function(f) { return f.id === facId; }) : null;
    if (!fac) {
        var cur = codexFind(codexState.selectedId);
        if (cur && (cur.kind === 'npc' || cur.kind === 'faction')) fac = cur.faction;
    }
    if (!fac) fac = cn.npcs[0];
    if (!fac) { fac = { id: 'fac_' + Date.now(), name: 'Unsorted', isCollapsed: false, members: [] }; cn.npcs.push(fac); }
    var npc = { id: 'npc_' + Date.now(), name: '', subtitle: '', notes: '', isCollapsed: false, relationship: 'unknown', tags: [] };
    fac.members.push(npc);
    codexState.selectedId = npc.id; codexState.query = '';
    if (codexState.filter !== 'people') codexState.filter = 'all';
    window.saveData(); codexRefresh();
    var input = document.getElementById('input-npc-name-' + fac.id + '-' + npc.id);
    if (input) input.focus();
};

window.codexAddPlace = function() {
    var loc = { id: 'loc_' + Date.now(), title: '', subtitle: '', notes: '', isCollapsed: false, tags: [] };
    characterData.campaignNotes.locations.unshift(loc);
    codexState.selectedId = loc.id; codexState.query = '';
    if (codexState.filter !== 'places') codexState.filter = 'all';
    window.saveData(); codexRefresh();
    var input = document.getElementById('input-loc-title-' + loc.id);
    if (input) input.focus();
};

window.codexAddGroup = function() {
    var fac = { id: 'fac_' + Date.now(), name: '', isCollapsed: false, members: [] };
    characterData.campaignNotes.npcs.unshift(fac);
    codexState.selectedId = fac.id; codexState.query = '';
    if (codexState.filter !== 'people') codexState.filter = 'all';
    window.saveData(); codexRefresh();
    var input = document.getElementById('input-fac-name-' + fac.id);
    if (input) input.focus();
};

// The relationship badge restyles itself in place (editors.js); also recolor the dot in the list.
(function() {
    var original = window.updateNPCRelationship;
    window.updateNPCRelationship = function(facId, npcId, val) {
        if (typeof original === 'function') original(facId, npcId, val);
        var dot = document.getElementById('cx-rel-' + npcId);
        if (dot) dot.className = 'w-2 h-2 rounded-full flex-shrink-0 ' + (CODEX_REL_DOT[val] || CODEX_REL_DOT.unknown);
    };
})();
