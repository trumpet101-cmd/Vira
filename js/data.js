// --- INITIAL DATA (MODULAR TEMPLATE) ---
var initialCharacterData = {
    name: "Víra Tahlwyn",
    basics: { race: "Wood Elf", class: "Barbarian (World Tree)", age: 27, background: "Nomadic Tribesman (Custom)", tribe: "Eryndral Tribe (Orroyen)", familiar: "Tato (Squirrel)" },
    backstory: [
        { id: 'b_1', title: "Early Life", notes: `Growing up, Vira had a very traditional nomadic life within the Orroyen tribe...\n\nFrom her mother she learned to be upbeat, friendly and open - always seeing meeting others as a chance to “plant new seeds of friendship”.\n\nHer father was the careful balance to that - he taught her discipline, patience, vigilance.`, isCollapsed: false },
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
    campaignNotes: { sessionNotes: [], quests: [], npcs: [], locations: [], misc: "" }
};

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
        campaignNotes: { sessionNotes: [], quests: [], npcs: [], locations: [], misc: "" }
    };
}

// --- ROBUST LORE & DATA MIGRATION ENGINE ---
function migrateData(data) {
    if (!data) return;
    if (!data.name) data.name = "Unnamed Character";
    if (!data.basics || typeof data.basics !== 'object') {
        data.basics = { race: "", class: "", age: "", background: "", tribe: "", familiar: "" };
    } else {
        const basicsKeys = ["race", "class", "age", "background", "tribe", "familiar"];
        basicsKeys.forEach(k => { if (data.basics[k] === undefined) data.basics[k] = ""; });
    }

    if (!data.campaignNotes || typeof data.campaignNotes !== 'object') {
        data.campaignNotes = { sessionNotes: [], quests: [], npcs: [], locations: [], misc: "" };
    }
    if (!Array.isArray(data.campaignNotes.sessionNotes)) data.campaignNotes.sessionNotes = [];
    if (!Array.isArray(data.campaignNotes.quests)) data.campaignNotes.quests = [];
    if (!Array.isArray(data.campaignNotes.npcs)) data.campaignNotes.npcs = [];
    if (!Array.isArray(data.campaignNotes.locations)) data.campaignNotes.locations = [];
    if (typeof data.campaignNotes.misc !== 'string') data.campaignNotes.misc = "";
    
    if (typeof data.campaignNotes.sessionNotes === 'string') {
        data.campaignNotes.sessionNotes = [ { id: 'sess_migrated', title: 'Imported Session Notes', date: '', notes: data.campaignNotes.sessionNotes, isCollapsed: false } ];
    }
    if (typeof data.campaignNotes.npcs === 'string') {
        data.campaignNotes.npcs = [];
    }
    
    data.campaignNotes.npcs.forEach((fac, facIdx) => {
        if (!fac.id) fac.id = 'fac_migrated_' + facIdx + '_' + Date.now();
        if (fac.isCollapsed === undefined) fac.isCollapsed = false;
        if (!Array.isArray(fac.members)) fac.members = [];
        else fac.members.forEach((npc, npcIdx) => { 
            if (!npc.id) npc.id = 'npc_migrated_' + facIdx + '_' + npcIdx + '_' + Date.now(); 
            if (npc.isCollapsed === undefined) npc.isCollapsed = false;
            if (npc.subtitle === undefined) npc.subtitle = "";
        });
    });

    data.campaignNotes.sessionNotes.forEach((s, sIdx) => { if (!s.id) s.id = 'sess_migrated_' + sIdx + '_' + Date.now(); });
    data.campaignNotes.quests.forEach((q, qIdx) => { if (!q.id) q.id = 'quest_migrated_' + qIdx + '_' + Date.now(); });
    data.campaignNotes.locations.forEach((l, lIdx) => { if (!l.id) l.id = 'loc_migrated_' + lIdx + '_' + Date.now(); });
    
    if (!data.backstory || !Array.isArray(data.backstory)) {
        data.backstory = [
            { id: 'b_1', title: "Early Life", notes: "", isCollapsed: false }, { id: 'b_2', title: "The Threat", notes: "", isCollapsed: false },
            { id: 'b_3', title: "The Vision", notes: "", isCollapsed: false }, { id: 'b_4', title: "The Journey", notes: "", isCollapsed: false }
        ];
    } else {
        data.backstory.forEach((b, bIdx) => { if (b.isCollapsed === undefined) b.isCollapsed = false; if (!b.id) b.id = 'b_migrated_' + bIdx + '_' + Date.now(); });
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