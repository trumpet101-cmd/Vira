// --- UTILS ---
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
window.escapeHtml = escapeHtml;

function renderHTML(val) {
    if (!val) return '';
    if (!/<[a-z][\s\S]*>/i.test(val)) return escapeHtml(val).replace(/\n/g, '<br>');
    return val;
}

// --- APP STATE ---
var activeTab = 'campaign_sessionNotes';   // the app opens on the journal
var isMobileMenuOpen = false;
var questSectionsState = { completedCollapsed: true };
var questTypeFilter = 'all';   // 'all' | 'main' | 'backstory' | 'side'

// Display config for the three quest types (data key -> label/icon/colors).
var QUEST_TYPES = {
    main:      { label: 'Main',      icon: 'crown',  chip: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800', dot: 'bg-violet-400' },
    backstory: { label: 'Backstory', icon: 'sprout', chip: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800', dot: 'bg-emerald-400' },
    side:      { label: 'Side',      icon: 'swords', chip: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800', dot: 'bg-sky-400' }
};

// Old tab ids still appear inside saved @mention links (the link stores the
// tab it was created for). They are never rewritten in the notes; instead
// setTab() maps a retired tab id to the page that replaced it.
var TAB_ALIASES = {
    campaignNotes: 'campaign_sessionNotes',
    campaign_mainQuests: 'campaign_quests',
    campaign_backstoryQuests: 'campaign_quests'
};
function resolveTabId(tabId) { return TAB_ALIASES[tabId] || tabId; }
var currentSearchQueries = { sessionNotes: '', mainQuests: '', backstoryQuests: '', quests: '', locations: '', npcs: '', backstory: '', personality: '' };
var characterData = JSON.parse(JSON.stringify(initialCharacterData));
var currentCharacterId = localStorage.getItem('current_character_id') || 'default';
var characterList = JSON.parse(localStorage.getItem('character_list')) || [];

// --- ARMOR GLOBAL REFERENCE ---
var ARMOR_OPTIONS = {
    unarmored: { name: "Unarmored Barbarian", type: "Unarmored", stealth: "Normal", isDisadv: false, formula: "10 + Dex Mod + Con Mod" },
    unarmored_monk: { name: "Unarmored Monk", type: "Unarmored", stealth: "Normal", isDisadv: false, formula: "10 + Dex Mod + Wis Mod" },
    studded: { name: "Studded Leather (Light)", type: "Light", stealth: "Normal", isDisadv: false, formula: "12 + Dex Mod" },
    chainshirt: { name: "Chain Shirt (Medium)", type: "Medium", stealth: "Normal", isDisadv: false, formula: "13 + Dex Mod (Max 2)" },
    scalemail: { name: "Scale Mail (Medium)", type: "Medium", stealth: "Disadv.", isDisadv: true, formula: "14 + Dex Mod (Max 2)" },
    breastplate: { name: "Breastplate (Medium)", type: "Medium", stealth: "Normal", isDisadv: false, formula: "14 + Dex Mod (Max 2)" },
    halfplate: { name: "Halfplate (Medium)", type: "Medium", stealth: "Disadv.", isDisadv: true, formula: "15 + Dex Mod (Max 2)" },
    chainmail: { name: "Chain Mail (Heavy)", type: "Heavy", stealth: "Disadv.", isDisadv: true, formula: "16" },
    splint: { name: "Splint (Heavy)", type: "Heavy", stealth: "Disadv.", isDisadv: true, formula: "17" },
    plate: { name: "Plate (Heavy)", type: "Heavy", stealth: "Disadv.", isDisadv: true, formula: "18" }
};

// --- JOURNAL SECTIONS ---
// The three session-style pages (Session Notes, Main Campaign, Backstory
// Quest) share one data shape and one set of CRUD/render machinery. Entry ids
// are unique across all three arrays, so lookups search every section.
// The shared Open Threads panel renders at the top of all three pages and
// reads/writes the single campaignNotes.threads array.
var JOURNAL_SECTIONS = {
    sessionNotes:    { tab: 'campaign_sessionNotes',    title: 'Session Notes',   icon: 'scroll-text', idPrefix: 'sess',  deleteNoun: 'session log entry',      emptyMsg: 'No sessions added yet.', searchPlaceholder: 'Search sessions...', autoDate: true },
};

function journalKeyFromTab(tabId) {
    for (var key in JOURNAL_SECTIONS) {
        if (JOURNAL_SECTIONS[key].tab === tabId) return key;
    }
    return null;
}
function getActiveJournalKey() {
    return journalKeyFromTab(activeTab) || 'sessionNotes';
}
// Locate a journal entry by id across all three section arrays.
function findJournalEntry(entryId) {
    var cn = (typeof characterData !== 'undefined' && characterData) ? characterData.campaignNotes : null;
    if (!cn) return null;
    for (var key in JOURNAL_SECTIONS) {
        var arr = cn[key] || [];
        for (var i = 0; i < arr.length; i++) {
            if (arr[i].id === entryId) return { key: key, arr: arr, entry: arr[i], idx: i };
        }
    }
    return null;
}

// --- NAVIGATION CONFIGURATION ---
// Two shapes: { id, label, icon } is a clickable tab; { group, label, icon,
// items: [...] } is a collapsible group of tabs. Collapse state persists in
// localStorage, and a group auto-expands whenever it contains the active tab.
var navItems = [
    { id: 'campaign_sessionNotes', label: 'Session Notes', icon: 'scroll-text' },
    { id: 'campaign_quests', label: 'Quests', icon: 'swords' },
    { id: 'campaign_npcs', label: 'NPCs', icon: 'users' },
    { id: 'campaign_locations', label: 'Locations', icon: 'map-pin' },
    { id: 'campaign_misc', label: 'Misc & Loot', icon: 'package' },
    { id: 'tags', label: 'Tags', icon: 'tags' },
    { group: 'charinfo', label: 'Character Info', icon: 'user', items: [
        { id: 'personality', label: 'Personality & Traits', icon: 'brain' },
        { id: 'build', label: 'Character Build', icon: 'shield' },
        { id: 'backstory', label: 'Backstory', icon: 'book-open' }
    ]}
];

// Collapse state: Character Info starts collapsed on first ever load;
// afterwards whatever the user last chose wins.
var navGroupCollapsed = (function() {
    try {
        var saved = JSON.parse(localStorage.getItem('nav_groups_collapsed'));
        if (saved && typeof saved === 'object') return { quests: !!saved.quests, charinfo: !!saved.charinfo };
    } catch (e) { /* corrupted state — fall through to defaults */ }
    return { quests: false, charinfo: true };
})();
function saveNavGroupState() {
    localStorage.setItem('nav_groups_collapsed', JSON.stringify(navGroupCollapsed));
}
