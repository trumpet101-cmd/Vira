// --- INITIAL DATA (MODULAR TEMPLATE) ---
var initialCharacterData = {
    name: "Víra Tahlwyn",
    basics: { race: "Wood Elf", class: "Barbarian (World Tree)", age: 27, background: "Nomadic Tribesman (Custom)", tribe: "Eryndral Tribe (Orroyen)", familiar: "Tato (Squirrel)" },
    backstory: [
        { id: 'b_1', title: "Early Life", notes: `Growing up, Vira had a very traditional nomadic life within the Orroyen tribe...\n\nFrom her mother she learned to be upbeat, friendly and open - always seeing meeting others as a chance to "plant new seeds of friendship".\n\nHer father was the careful balance to that - he taught her discipline, patience, vigilance.`, isCollapsed: false },
        { id: 'b_2', title: "The Threat", notes: `As with all members of the Orroyen tribes, Vira was well aware of the Iron Authority; the Hobgoblin nation who would see the destruction and conquest of the Jungle and all those who dwell within it.`, isCollapsed: false },
        { id: 'b_3', title: "The Vision", notes: `Many years later, Vira now 27, was led by a playful squirrel (Tato) to a clearing void of the thick dense jungle...`, isCollapsed: false },
        { id: 'b_4', title: "The Journey", notes: `After waking, she sought guidance. Syngorn was unhelpful; the elves were xenophobic and dismissive of her visions...`, isCollapsed: false }
    ],
    personality: [
        { id: 'p_1', title: "Normal Personality", subtitle: "Default State", notes: "Has a very similar personality to her mother. 'Every stranger met is a seed of friendship planted'. A typically positive and upbeat personality. Excited for new opportunities.", isCollapsed: false },
        { id: 'p_2', title: "Raging Personality", subtitle: "Combat State", notes: "Eye Color turns from a vibrant green to a dark oak brown. Ties up her hair into a ponytail. Adopts a personality closer to her father; stern, stoic and intensely focused.", isCollapsed: false },
        { id: 'p_3', title: "Likes", subtitle: "Interests & Preference", notes: "Trees, Jungle life, Flora. Her Halberd. Her nomadic lifestyle. Respects animals as a means of hunting for survival.", isCollapsed: false },
        { id: 'p_4', title: "Dislikes", subtitle: "Fears & Aversions", notes: "Hobgoblins & Goblins of The Iron Authority. Closed spaces (sealed stone structures, caverns, deep caves).", isCollapsed: false }
    ],
    build: {
        abilities: [
            { name: "Strength", starting: 15, species: 2, lvl1: 0, lvl4: 1, lvl8: 1, lvl12: 1, lvl16: 0, lvl19: 0, lvl20: 4 },
            { name: "Dexterity", starting: 13, species: 1, lvl1: 0, lvl4: 0, lvl8: 0, lvl12: 0, lvl16: 0, lvl19: 0, lvl20: 0 },
            { name: "Constitution", starting: 14, species: 0, lvl1: 0, lvl4: 0, lvl8: 0, lvl12: 0, lvl16: 0, lvl19: 0, lvl20: 4 },
            { name: "Intelligence", starting: 12, species: 0, lvl1: 0, lvl4: 0, lvl8: 0, lvl12: 0, lvl16: 0, lvl19: 0, lvl20: 0 },
            { name: "Wisdom", starting: 12, species: 0, lvl1: 0, lvl4: 0, lvl8: 0, lvl12: 0, lvl16: 0, lvl19: 0, lvl20: 0 },
            { name: "Charisma", starting: 6, species: 0, lvl1: 0, lvl4: 0, lvl8: 0, lvl12: 0, lvl16: 0, lvl19: 0, lvl20: 0 }
        ],
        feats: { lvl1: "Magic Initiate", lvl4: "Charger", lvl8: "Mage Slayer", lvl12: "Great Weapon Master", lvl16: "", lvl19: "Epic Boon", lvl20: "Combat Prowess" },
        features: [ "Barbarian (World Tree)", "Speed: 35 feet", "Darkvision: 60 feet", "Fey Ancestry: Advantage on Charm saves", "Trance: 4 hour long rest", "Origin Feat: Magic Initiate (Wizard) - Find Familiar, Message, Mending" ],
        equipment: []
    },
    campaignNotes: { sessionNotes: [], mainQuests: [], backstoryQuests: [], quests: [], npcs: [], locations: [], misc: "", threads: [] }
};

// --- QUEST TYPES (schema v3) ---
// Every quest carries exactly one type. Main Campaign and Backstory Quest
// entries used to live in their own arrays (campaignNotes.mainQuests /
// .backstoryQuests); they now live in campaignNotes.quests with a type.
// The two old arrays are kept as EMPTY arrays so an un-updated tab on another
// device never crashes on a missing field.
var VAULT_SCHEMA_VERSION = 3;
var QUEST_TYPE_KEYS = ['main', 'backstory', 'side'];

// Moves entries out of the two legacy arrays into campaignNotes.quests.
// Safe to run repeatedly: ids are never changed, notes are never touched,
// and an entry whose id is already in quests is left alone.
function mergeLegacyQuestArrays(cn) {
    var moved = [];
    var have = {};
    cn.quests.forEach(function(q) { if (q && q.id) have[q.id] = true; });
    [['mainQuests', 'main'], ['backstoryQuests', 'backstory']].forEach(function(pair) {
        (cn[pair[0]] || []).forEach(function(e) {
            if (!e || (e.id && have[e.id])) return;
            e.type = pair[1];
            if (e.id) have[e.id] = true;
            moved.push(e);
        });
        cn[pair[0]] = [];
    });
    // Main first, then backstory, then the existing side quests.
    if (moved.length) cn.quests = moved.concat(cn.quests);
    return moved.length;
}

// --- DYNAMIC BLANK SLATE MAKER ---
function getCleanCharacterData(name, race, charClass) {
    return {
        name: name || "New Character", avatar: "",
        basics: { race: race || "Unknown Race", class: charClass || "Unknown Class", age: "", background: "", tribe: "", familiar: "" },
        backstory: [
            { id: 'b_1', title: "Early Life", notes: "", isCollapsed: false },
            { id: 'b_2', title: "The Threat", notes: "", isCollapsed: false },
            { id: 'b_3', title: "The Vision", notes: "", isCollapsed: false },
            { id: 'b_4', title: "The Journey", notes: "", isCollapsed: false }
        ],
        personality: [
            { id: 'p_1', title: "Normal Personality", subtitle: "Default State", notes: "", isCollapsed: false },
            { id: 'p_2', title: "Raging Personality", subtitle: "Combat State", notes: "", isCollapsed: false },
            { id: 'p_3', title: "Likes", subtitle: "Interests & Preference", notes: "", isCollapsed: false },
            { id: 'p_4', title: "Dislikes", subtitle: "Fears & Aversions", notes: "", isCollapsed: false }
        ],
        build: {
            abilities: [
                { name: "Strength", starting: 10, species: 0, lvl1: 0, lvl4: 0, lvl8: 0, lvl12: 0, lvl16: 0, lvl19: 0, lvl20: 0 },
                { name: "Dexterity", starting: 10, species: 0, lvl1: 0, lvl4: 0, lvl8: 0, lvl12: 0, lvl16: 0, lvl19: 0, lvl20: 0 },
                { name: "Constitution", starting: 10, species: 0, lvl1: 0, lvl4: 0, lvl8: 0, lvl12: 0, lvl16: 0, lvl19: 0, lvl20: 0 },
                { name: "Intelligence", starting: 10, species: 0, lvl1: 0, lvl4: 0, lvl8: 0, lvl12: 0, lvl16: 0, lvl19: 0, lvl20: 0 },
                { name: "Wisdom", starting: 10, species: 0, lvl1: 0, lvl4: 0, lvl8: 0, lvl12: 0, lvl16: 0, lvl19: 0, lvl20: 0 },
                { name: "Charisma", starting: 10, species: 0, lvl1: 0, lvl4: 0, lvl8: 0, lvl12: 0, lvl16: 0, lvl19: 0, lvl20: 0 }
            ],
            feats: { lvl1: "", lvl4: "", lvl8: "", lvl12: "", lvl16: "", lvl19: "", lvl20: "" },
            features: "", equipment: "", acSelection: ["unarmored", ""], shieldActive: false
        },
        campaignNotes: { sessionNotes: [], mainQuests: [], backstoryQuests: [], quests: [], npcs: [], locations: [], misc: "", threads: [] }
    };
}

// --- ROBUST LORE & DATA MIGRATION ENGINE ---
function migrateData(data, charId) {
    if (!data) return;

    // --- SAFETY COPY before the v3 quest merge ---
    // Stored once per character, before anything is changed, and never
    // overwritten, so the untouched pre-merge data can always be recovered
    // from localStorage key 'pre_v3_backup_<characterId>'.
    try {
        var lcn = data.campaignNotes;
        var hasLegacy = lcn && typeof lcn === 'object' &&
            ((Array.isArray(lcn.mainQuests) && lcn.mainQuests.length) || (Array.isArray(lcn.backstoryQuests) && lcn.backstoryQuests.length));
        if (hasLegacy && typeof localStorage !== 'undefined') {
            var bkId = charId || (typeof currentCharacterId !== 'undefined' ? currentCharacterId : 'default');
            var bkKey = 'pre_v3_backup_' + bkId;
            if (!localStorage.getItem(bkKey)) localStorage.setItem(bkKey, JSON.stringify(data));
        }
    } catch (e) { console.warn('Could not store pre-v3 safety copy:', e); }

    if (!data.name) data.name = "Unnamed Character";
    if (!data.basics || typeof data.basics !== 'object') {
        data.basics = { race: "", class: "", age: "", background: "", tribe: "", familiar: "" };
    } else {
        const basicsKeys = ["race", "class", "age", "background", "tribe", "familiar"];
        basicsKeys.forEach(k => { if (data.basics[k] === undefined) data.basics[k] = ""; });
    }

    if (!data.campaignNotes || typeof data.campaignNotes !== 'object') {
        data.campaignNotes = { sessionNotes: [], mainQuests: [], backstoryQuests: [], quests: [], npcs: [], locations: [], misc: "", threads: [] };
    }
    if (!Array.isArray(data.campaignNotes.sessionNotes)) data.campaignNotes.sessionNotes = [];
    if (!Array.isArray(data.campaignNotes.mainQuests)) data.campaignNotes.mainQuests = [];
    if (!Array.isArray(data.campaignNotes.backstoryQuests)) data.campaignNotes.backstoryQuests = [];
    if (!Array.isArray(data.campaignNotes.quests)) data.campaignNotes.quests = [];
    if (!Array.isArray(data.campaignNotes.npcs)) data.campaignNotes.npcs = [];
    if (!Array.isArray(data.campaignNotes.locations)) data.campaignNotes.locations = [];
    if (typeof data.campaignNotes.misc !== 'string') data.campaignNotes.misc = "";

    // --- Open Threads ---
    if (!Array.isArray(data.campaignNotes.threads)) data.campaignNotes.threads = [];
    data.campaignNotes.threads.forEach(function(t, i) {
        if (!t.id)                            t.id = 'thread_migrated_' + i + '_' + Date.now();
        if (typeof t.text !== 'string')       t.text = '';
        if (!Array.isArray(t.tags))           t.tags = [];
        if (t.resolved === undefined)         t.resolved = false;
        if (typeof t.resolution !== 'string') t.resolution = '';
    });

    // Note: pinnedNotes guard has been removed. Old pinnedNotes data is simply dropped on next save.

    if (typeof data.campaignNotes.sessionNotes === 'string') {
        data.campaignNotes.sessionNotes = [ { id: 'sess_migrated', title: 'Imported Session Notes', date: '', notes: data.campaignNotes.sessionNotes, isCollapsed: false } ];
    }
    if (typeof data.campaignNotes.npcs === 'string') {
        data.campaignNotes.npcs = [];
    }
    
    data.campaignNotes.npcs.forEach((fac, facIdx) => {
        if (!fac.id) fac.id = 'fac_migrated_' + facIdx + '_' + Date.now();
        if (typeof fac.name !== 'string') fac.name = "";
        if (fac.isCollapsed === undefined) fac.isCollapsed = false;
        if (!Array.isArray(fac.members)) fac.members = [];
        else fac.members.forEach((npc, npcIdx) => { 
            if (!npc.id) npc.id = 'npc_migrated_' + facIdx + '_' + npcIdx + '_' + Date.now(); 
            if (npc.isCollapsed === undefined) npc.isCollapsed = false;
            if (typeof npc.name !== 'string') npc.name = "";
            if (typeof npc.notes !== 'string') npc.notes = "";
            if (npc.subtitle === undefined || typeof npc.subtitle !== 'string') npc.subtitle = "";
            if (npc.relationship === undefined) npc.relationship = "unknown";
            if (!Array.isArray(npc.tags)) npc.tags = [];
        });
    });

    // String-field defaults below protect global search and the mention sweep,
    // which call .toLowerCase()/.indexOf() on these fields unguarded. Legacy or
    // hand-imported entries missing a field would otherwise throw and break
    // search for the whole vault.
    data.campaignNotes.sessionNotes.forEach((s, sIdx) => {
        if (!s.id) s.id = 'sess_migrated_' + sIdx + '_' + Date.now();
        if (typeof s.title !== 'string') s.title = "";
        if (typeof s.date !== 'string') s.date = "";
        if (typeof s.notes !== 'string') s.notes = "";
        if (typeof s.recap !== 'string') s.recap = "";   // optional "Previously on…" text
        if (!Array.isArray(s.tags)) s.tags = [];
    });
    // Main Campaign & Backstory Quest entries share the session shape and the
    // same string-field guards (search/mention sweep call .toLowerCase() unguarded).
    [['mainQuests', 'mainq'], ['backstoryQuests', 'bkq']].forEach(function(pair) {
        data.campaignNotes[pair[0]].forEach(function(s, sIdx) {
            if (!s.id) s.id = pair[1] + '_migrated_' + sIdx + '_' + Date.now();
            if (typeof s.title !== 'string') s.title = "";
            if (typeof s.date !== 'string') s.date = "";
            if (typeof s.notes !== 'string') s.notes = "";
            if (s.isCollapsed === undefined) s.isCollapsed = false;
            if (!Array.isArray(s.tags)) s.tags = [];
        });
    });
    // --- v3: one quest list, typed ---
    var firstV3Run = !(data.schemaVersion >= VAULT_SCHEMA_VERSION);
    mergeLegacyQuestArrays(data.campaignNotes);
    data.campaignNotes.quests.forEach((q, qIdx) => {
        if (QUEST_TYPE_KEYS.indexOf(q.type) === -1) q.type = 'side';
        if (typeof q.date !== 'string') q.date = "";
        // Rows start collapsed the first time a vault is opened in v3.
        if (firstV3Run || q.isCollapsed === undefined) q.isCollapsed = true;
        if (!q.id) q.id = 'quest_migrated_' + qIdx + '_' + Date.now();
        if (typeof q.title !== 'string') q.title = "";
        if (typeof q.subtitle !== 'string') q.subtitle = "";
        if (typeof q.notes !== 'string') q.notes = "";
        if (q.isCompleted === undefined) q.isCompleted = false;
        if (q.isUrgent === undefined) q.isUrgent = false;
        if (!Array.isArray(q.tags)) q.tags = [];
    });
    data.schemaVersion = VAULT_SCHEMA_VERSION;
    data.campaignNotes.locations.forEach((l, lIdx) => {
        if (!l.id) l.id = 'loc_migrated_' + lIdx + '_' + Date.now();
        if (typeof l.title !== 'string') l.title = "";
        if (typeof l.subtitle !== 'string') l.subtitle = "";
        if (typeof l.notes !== 'string') l.notes = "";
        if (!Array.isArray(l.tags)) l.tags = [];
    });
    
    if (!data.backstory || !Array.isArray(data.backstory)) {
        data.backstory = [
            { id: 'b_1', title: "Early Life", notes: "", isCollapsed: false }, { id: 'b_2', title: "The Threat", notes: "", isCollapsed: false },
            { id: 'b_3', title: "The Vision", notes: "", isCollapsed: false }, { id: 'b_4', title: "The Journey", notes: "", isCollapsed: false }
        ];
    } else {
        data.backstory.forEach((b, bIdx) => { if (b.isCollapsed === undefined) b.isCollapsed = false; if (!b.id) b.id = 'b_migrated_' + bIdx + '_' + Date.now(); if (typeof b.title !== 'string') b.title = ""; if (typeof b.notes !== 'string') b.notes = ""; });
    }

    if (!data.personality || !Array.isArray(data.personality)) {
        data.personality = [
            { id: 'p_1', title: "Normal Personality", subtitle: "Default State", notes: "", isCollapsed: false },
            { id: 'p_2', title: "Raging Personality", subtitle: "Combat State", notes: "", isCollapsed: false },
            { id: 'p_3', title: "Likes", subtitle: "Interests & Preference", notes: "", isCollapsed: false },
            { id: 'p_4', title: "Dislikes", subtitle: "Fears & Aversions", notes: "", isCollapsed: false }
        ];
    } else {
        data.personality.forEach((p, pIdx) => { 
            if ('isRed' in p) delete p.isRed; 
            if (p.isCollapsed === undefined) p.isCollapsed = false;
            if (!p.id) p.id = 'p_migrated_' + pIdx + '_' + Date.now();
            if (typeof p.title !== 'string') p.title = "";
            if (typeof p.subtitle !== 'string') p.subtitle = "";
            if (typeof p.notes !== 'string') p.notes = "";
        });
    }

    if (!data.build || typeof data.build !== 'object') data.build = {};
    if (!data.build.abilities || !Array.isArray(data.build.abilities)) {
        data.build.abilities = [
            { name: "Strength", starting: 10, species: 0, lvl1: 0, lvl4: 0, lvl8: 0, lvl12: 0, lvl16: 0, lvl19: 0, lvl20: 0 },
            { name: "Dexterity", starting: 10, species: 0, lvl1: 0, lvl4: 0, lvl8: 0, lvl12: 0, lvl16: 0, lvl19: 0, lvl20: 0 },
            { name: "Constitution", starting: 10, species: 0, lvl1: 0, lvl4: 0, lvl8: 0, lvl12: 0, lvl16: 0, lvl19: 0, lvl20: 0 },
            { name: "Intelligence", starting: 10, species: 0, lvl1: 0, lvl4: 0, lvl8: 0, lvl12: 0, lvl16: 0, lvl19: 0, lvl20: 0 },
            { name: "Wisdom", starting: 10, species: 0, lvl1: 0, lvl4: 0, lvl8: 0, lvl12: 0, lvl16: 0, lvl19: 0, lvl20: 0 },
            { name: "Charisma", starting: 10, species: 0, lvl1: 0, lvl4: 0, lvl8: 0, lvl12: 0, lvl16: 0, lvl19: 0, lvl20: 0 }
        ];
    }
    if (!data.build.feats || typeof data.build.feats !== 'object') {
        data.build.feats = { lvl1: "", lvl4: "", lvl8: "", lvl12: "", lvl16: "", lvl19: "", lvl20: "" };
    } else {
        const featKeys = ["lvl1", "lvl4", "lvl8", "lvl12", "lvl16", "lvl19", "lvl20"];
        featKeys.forEach(k => { if (data.build.feats[k] === undefined) data.build.feats[k] = ""; });
    }

    if (data.build) {
        if (Array.isArray(data.build.features)) data.build.features = data.build.features.length > 0 ? '<ul>' + data.build.features.map(f => `<li>${f}</li>`).join('') + '</ul>' : "";
        if (typeof data.build.features !== 'string') data.build.features = "";

        if (Array.isArray(data.build.equipment)) data.build.equipment = data.build.equipment.length > 0 ? '<ul>' + data.build.equipment.map(e => `<li>${e}</li>`).join('') + '</ul>' : "";
        if (typeof data.build.equipment !== 'string') data.build.equipment = "";

        if (!data.build.acSelection || !Array.isArray(data.build.acSelection)) data.build.acSelection = ["unarmored", "breastplate", ""];
        if (data.build.shieldActive === undefined) data.build.shieldActive = false;
    }
}
