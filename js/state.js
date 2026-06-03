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
var activeTab = 'campaignNotes';
var isMobileMenuOpen = false;
var questSectionsState = { inProgressCollapsed: false, completedCollapsed: false };
var currentSearchQueries = { sessionNotes: '', quests: '', locations: '', npcs: '', backstory: '', personality: '' };
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

// --- NAVIGATION CONFIGURATION ---
var navItems = [
    { id: 'campaignNotes', label: 'Campaign Notes', icon: 'map' },
    { id: 'campaign_sessionNotes', label: 'Session Notes', icon: 'scroll-text', isSubItem: true },
    { id: 'campaign_quests', label: 'Quests', icon: 'swords', isSubItem: true },
    { id: 'campaign_npcs', label: 'NPCs', icon: 'users', isSubItem: true },
    { id: 'campaign_locations', label: 'Locations', icon: 'map-pin', isSubItem: true },
    { id: 'campaign_misc', label: 'Misc & Loot', icon: 'package', isSubItem: true },
    { id: 'tags', label: 'Tags', icon: 'tags', isSubItem: true },
    { id: 'personality', label: 'Personality & Traits', icon: 'brain' },
    { id: 'build', label: 'Character Build', icon: 'shield' },
    { id: 'backstory', label: 'Backstory', icon: 'book-open' },
];
