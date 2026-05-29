// --- ARMORED/SHIELD STATE ---
window.updateAcSelection = function(index, value) {
    if (!characterData.build) characterData.build = {};
    if (!characterData.build.acSelection) characterData.build.acSelection = [];
    characterData.build.acSelection[index] = value;
    characterData.build.acSelection = characterData.build.acSelection.filter(item => item !== "");
    window.saveData(); window.renderContent();
};
window.toggleShieldActive = function(checked) {
    if (!characterData.build) characterData.build = {};
    characterData.build.shieldActive = checked;
    window.saveData(); window.recalculateBuildScores();
};
window.updateAbilityPoint = function(index, field, val) {
    const intVal = parseInt(val) || 0;
    characterData.build.abilities[index][field] = intVal;
    window.saveData(); window.recalculateBuildScores();
};
window.updateFeatName = function(key, val) {
    if (!characterData.build.feats) characterData.build.feats = {};
    characterData.build.feats[key] = val; window.saveData();
};

window.recalculateBuildScores = function() {
    const abilities = characterData.build.abilities;
    const keys = ['starting', 'species', 'lvl1', 'lvl4', 'lvl8', 'lvl12', 'lvl16', 'lvl19', 'lvl20'];
    const cumulativeScores = { starting: {}, species: {}, lvl1: {}, lvl4: {}, lvl8: {}, lvl12: {}, lvl16: {}, lvl19: {}, lvl20: {} };

    abilities.forEach((ability, aIdx) => {
        let currentVal = 0;
        keys.forEach((key) => {
            const cellVal = parseInt(ability[key]) || 0;
            currentVal += cellVal;
            cumulativeScores[key][ability.name] = currentVal;
            const scoreCell = document.getElementById(`score-cell-${aIdx}-${key}`);
            if (scoreCell) {
                const mod = Math.floor((currentVal - 10) / 2);
                const modStr = (mod >= 0 ? '+' : '') + mod;
                scoreCell.innerHTML = `<span class="font-extrabold text-stone-800 dark:text-stone-200 text-sm">${currentVal}</span><span class="text-xs text-emerald-600 dark:text-emerald-400 font-bold ml-1">(${modStr})</span>`;
            }
        });
    });

    const selectedArmors = (characterData.build.acSelection || []).filter(item => item !== "");
    const showBlank = selectedArmors.length < 5;
    const totalRows = selectedArmors.length + (showBlank ? 1 : 0);
    const shieldBonus = (characterData.build.shieldActive) ? 2 : 0;
    const levelKeys = keys.slice(2);

    for (let rIdx = 0; rIdx < totalRows; rIdx++) {
        const armorKey = selectedArmors[rIdx] || "";
        levelKeys.forEach(colKey => {
            const dex = cumulativeScores[colKey]["Dexterity"] || 10;
            const con = cumulativeScores[colKey]["Constitution"] || 10;
            const wis = cumulativeScores[colKey]["Wisdom"] || 10;
            const dexMod = Math.floor((dex - 10) / 2);
            const conMod = Math.floor((con - 10) / 2);
            const wisMod = Math.floor((wis - 10) / 2);

            let acVal = "-";
            if (armorKey !== "") {
                let baseAc = 10, dexContribution = dexMod, conContribution = 0, wisContribution = 0;
                if (armorKey === "unarmored") { conContribution = conMod; } 
                else if (armorKey === "unarmored_monk") { wisContribution = wisMod; } 
                else if (armorKey === "studded") { baseAc = 12; } 
                else if (armorKey === "chainshirt") { baseAc = 13; dexContribution = Math.min(2, dexMod); } 
                else if (armorKey === "scalemail") { baseAc = 14; dexContribution = Math.min(2, dexMod); } 
                else if (armorKey === "breastplate") { baseAc = 14; dexContribution = Math.min(2, dexMod); } 
                else if (armorKey === "halfplate") { baseAc = 15; dexContribution = Math.min(2, dexMod); } 
                else if (armorKey === "chainmail") { baseAc = 16; dexContribution = 0; } 
                else if (armorKey === "splint") { baseAc = 17; dexContribution = 0; } 
                else if (armorKey === "plate") { baseAc = 18; dexContribution = 0; }
                acVal = baseAc + dexContribution + conContribution + wisContribution + shieldBonus;
            }

            const valEl = document.getElementById(`ac-val-${rIdx}-${colKey}`);
            if (valEl) valEl.innerText = acVal;
        });
    }
};

// --- DYNAMIC LIST MANAGEMENT ---
window.addBackstory = function() { currentSearchQueries.backstory = ''; characterData.backstory.unshift({ id: 'b_' + Date.now(), title: 'New Lore Section', notes: '', isCollapsed: false }); window.saveData(); window.renderContent(); lucide.createIcons(); }
window.updateBackstory = function(bId, field, val) { const entry = characterData.backstory.find(b => b.id === bId); if(entry) entry[field] = val; window.saveData(); }
window.deleteBackstory = function(bId) { window.showCustomConfirm('Delete Backstory Section?', 'Are you sure you want to permanently delete this backstory section?', '📜', () => { characterData.backstory = characterData.backstory.filter(b => b.id !== bId); window.saveData(); window.renderContent(); lucide.createIcons(); }); }
window.toggleBackstoryCollapse = function(bId) { const entry = characterData.backstory.find(b => b.id === bId); if(entry) { entry.isCollapsed = !entry.isCollapsed; window.saveData(); window.renderContent(); lucide.createIcons(); } }
window.toggleAllBackstory = function(collapse) { characterData.backstory.forEach(b => b.isCollapsed = collapse); window.saveData(); window.renderContent(); lucide.createIcons(); }
window.moveBackstory = function(bId, direction) { const arr = characterData.backstory; const index = arr.findIndex(b => b.id === bId); if (index !== -1) { const targetIdx = index + direction; if (targetIdx >= 0 && targetIdx < arr.length) { [arr[index], arr[targetIdx]] = [arr[targetIdx], arr[index]]; window.saveData(); window.renderContent(); lucide.createIcons(); } } }
window.filterBackstory = function(query) { currentSearchQueries.backstory = query; const q = query.toLowerCase(); document.querySelectorAll('.backstory-block').forEach(block => { if (block.dataset.searchable.toLowerCase().includes(q)) block.classList.remove('hidden'); else block.classList.add('hidden'); }); }

window.addPersonality = function() { currentSearchQueries.personality = ''; characterData.personality.unshift({ id: 'p_' + Date.now(), title: 'New Trait / Code', subtitle: 'A brief state description', notes: '', isCollapsed: false }); window.saveData(); window.renderContent(); lucide.createIcons(); }
window.updatePersonality = function(pId, field, val) { const entry = characterData.personality.find(p => p.id === pId); if(entry) entry[field] = val; window.saveData(); }
window.deletePersonality = function(pId) { window.showCustomConfirm('Delete Personality Trait?', 'Are you sure you want to permanently delete this personality section?', '🧠', () => { characterData.personality = characterData.personality.filter(p => p.id !== pId); window.saveData(); window.renderContent(); lucide.createIcons(); }); }
window.togglePersonalityCollapse = function(pId) { const entry = characterData.personality.find(p => p.id === pId); if(entry) { entry.isCollapsed = !entry.isCollapsed; window.saveData(); window.renderContent(); lucide.createIcons(); } }
window.toggleAllPersonality = function(collapse) { characterData.personality.forEach(p => p.isCollapsed = collapse); window.saveData(); window.renderContent(); lucide.createIcons(); }
window.movePersonality = function(pId, direction) { const arr = characterData.personality; const index = arr.findIndex(p => p.id === pId); if (index !== -1) { const targetIdx = index + direction; if (targetIdx >= 0 && targetIdx < arr.length) { [arr[index], arr[targetIdx]] = [arr[targetIdx], arr[index]]; window.saveData(); window.renderContent(); lucide.createIcons(); } } }
window.filterPersonality = function(query) { currentSearchQueries.personality = query; const q = query.toLowerCase(); document.querySelectorAll('.personality-block').forEach(block => { if (block.dataset.searchable.toLowerCase().includes(q)) block.classList.remove('hidden'); else block.classList.add('hidden'); }); }

window.addSession = function() { currentSearchQueries.sessionNotes = ''; characterData.campaignNotes.sessionNotes.unshift({ id: 'sess_' + Date.now(), title: '', date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), notes: '', isCollapsed: false }); window.saveData(); window.renderContent(); lucide.createIcons(); }
window.updateSession = function(sessId, field, val) { const sess = characterData.campaignNotes.sessionNotes.find(s => s.id === sessId); if(sess) sess[field] = val; window.saveData(); }
window.deleteSession = function(sessId) { window.showCustomConfirm('Delete Session Log?', 'Are you sure you want to permanently delete this session log entry?', '🗑️', () => { characterData.campaignNotes.sessionNotes = characterData.campaignNotes.sessionNotes.filter(s => s.id !== sessId); window.saveData(); window.renderContent(); lucide.createIcons(); }); }
window.toggleSessionCollapse = function(sessId) { const sess = characterData.campaignNotes.sessionNotes.find(s => s.id === sessId); if(sess) { sess.isCollapsed = !sess.isCollapsed; window.saveData(); window.renderContent(); lucide.createIcons(); } }
window.toggleAllSessions = function(collapse) { characterData.campaignNotes.sessionNotes.forEach(s => s.isCollapsed = collapse); window.saveData(); window.renderContent(); lucide.createIcons(); }
window.moveSession = function(sessId, direction) { const arr = characterData.campaignNotes.sessionNotes; const index = arr.findIndex(s => s.id === sessId); if (index !== -1) { const targetIdx = index + direction; if (targetIdx >= 0 && targetIdx < arr.length) { [arr[index], arr[targetIdx]] = [arr[targetIdx], arr[index]]; window.saveData(); window.renderContent(); lucide.createIcons(); } } };
window.filterSessions = function(query) { currentSearchQueries.sessionNotes = query; const q = query.toLowerCase(); document.querySelectorAll('.session-block').forEach(block => { if (block.dataset.searchable.toLowerCase().includes(q)) block.classList.remove('hidden'); else block.classList.add('hidden'); }); }

window.addQuest = function() { currentSearchQueries.quests = ''; characterData.campaignNotes.quests.unshift({ id: 'quest_' + Date.now(), title: '', subtitle: '', notes: '', isCompleted: false }); window.saveData(); window.renderContent(); lucide.createIcons(); }
window.updateQuest = function(questId, field, val) { const quest = characterData.campaignNotes.quests.find(q => q.id === questId); if(quest) quest[field] = val; window.saveData(); }
window.deleteQuest = function(questId) { window.showCustomConfirm('Delete Quest?', 'Are you sure you want to permanently remove this quest objective?', '⚔️', () => { characterData.campaignNotes.quests = characterData.campaignNotes.quests.filter(q => q.id !== questId); window.saveData(); window.renderContent(); lucide.createIcons(); }); }
window.toggleQuestCompletion = function(questId) { const quest = characterData.campaignNotes.quests.find(q => q.id === questId); if(quest) { quest.isCompleted = !quest.isCompleted; window.saveData(); window.renderContent(); lucide.createIcons(); } }
window.toggleQuestSectionCollapse = function(section) { questSectionsState[section] = !questSectionsState[section]; window.renderContent(); lucide.createIcons(); }
window.moveQuest = function(questId, direction) { const arr = characterData.campaignNotes.quests; const index = arr.findIndex(q => q.id === questId); if (index === -1) return; const isCompleted = arr[index].isCompleted; let targetIdx = -1; if (direction === -1) { for (let i = index - 1; i >= 0; i--) if (arr[i].isCompleted === isCompleted) { targetIdx = i; break; } } else { for (let i = index + 1; i < arr.length; i++) if (arr[i].isCompleted === isCompleted) { targetIdx = i; break; } } if (targetIdx !== -1) { [arr[index], arr[targetIdx]] = [arr[targetIdx], arr[index]]; window.saveData(); window.renderContent(); lucide.createIcons(); } };
window.filterQuests = function(query) { currentSearchQueries.quests = query; const q = query.toLowerCase(); document.querySelectorAll('.quest-section').forEach(section => { let visibleQuests = 0; section.querySelectorAll('.quest-card').forEach(quest => { if (quest.dataset.searchable.toLowerCase().includes(q)) { quest.classList.remove('hidden'); visibleQuests++; } else { quest.classList.add('hidden'); } }); const contentDiv = section.querySelector('.collapsible-content'); const chevron = section.querySelector('.chevron'); if (q.length > 0 && visibleQuests > 0) { contentDiv.classList.remove('collapsed'); if(chevron) chevron.classList.remove('collapsed'); } else if (q.length === 0) { const isCollapsed = section.dataset.sectionType === 'inProgress' ? questSectionsState.inProgressCollapsed : questSectionsState.completedCollapsed; if(isCollapsed) { contentDiv.classList.add('collapsed'); if(chevron) chevron.classList.add('collapsed'); } } }); }

window.addLocation = function() { currentSearchQueries.locations = ''; characterData.campaignNotes.locations.unshift({ id: 'loc_' + Date.now(), title: '', subtitle: '', notes: '', isCollapsed: false }); window.saveData(); window.renderContent(); lucide.createIcons(); }
window.updateLocation = function(locId, field, val) { const loc = characterData.campaignNotes.locations.find(l => l.id === locId); if(loc) loc[field] = val; window.saveData(); }
window.deleteLocation = function(locId) { window.showCustomConfirm('Delete Location?', 'Are you sure you want to permanently remove this location?', '📍', () => { characterData.campaignNotes.locations = characterData.campaignNotes.locations.filter(l => l.id !== locId); window.saveData(); window.renderContent(); lucide.createIcons(); }); }
window.toggleLocationCollapse = function(locId) { const loc = characterData.campaignNotes.locations.find(l => l.id === locId); if(loc) { loc.isCollapsed = !loc.isCollapsed; window.saveData(); window.renderContent(); lucide.createIcons(); } }
window.toggleAllLocations = function(collapse) { characterData.campaignNotes.locations.forEach(l => l.isCollapsed = collapse); window.saveData(); window.renderContent(); lucide.createIcons(); }
window.moveLocation = function(locId, direction) { const arr = characterData.campaignNotes.locations; const index = arr.findIndex(l => l.id === locId); if (index !== -1) { const targetIdx = index + direction; if (targetIdx >= 0 && targetIdx < arr.length) { [arr[index], arr[targetIdx]] = [arr[targetIdx], arr[index]]; window.saveData(); window.renderContent(); lucide.createIcons(); } } };
window.filterLocations = function(query) { currentSearchQueries.locations = query; const q = query.toLowerCase(); document.querySelectorAll('.location-block').forEach(block => { if (block.dataset.searchable.toLowerCase().includes(q)) block.classList.remove('hidden'); else block.classList.add('hidden'); }); }

window.addFaction = function() { currentSearchQueries.npcs = ''; characterData.campaignNotes.npcs.unshift({ id: 'fac_' + Date.now(), name: '', isCollapsed: false, members: [] }); window.saveData(); window.renderContent(); lucide.createIcons(); }
window.updateFaction = function(facId, val) { const fac = characterData.campaignNotes.npcs.find(f => f.id === facId); if(fac) fac.name = val; window.saveData(); }
window.deleteFaction = function(facId) { window.showCustomConfirm('Delete Faction?', 'Are you sure you want to delete this faction, its members, and all related logs?', '🛡️', () => { characterData.campaignNotes.npcs = characterData.campaignNotes.npcs.filter(f => f.id !== facId); window.saveData(); window.renderContent(); lucide.createIcons(); }); }
window.toggleFactionCollapse = function(facId) { const fac = characterData.campaignNotes.npcs.find(f => f.id === facId); if (fac) { fac.isCollapsed = !fac.isCollapsed; window.saveData(); window.renderContent(); lucide.createIcons(); } };
window.toggleAllFactions = function(collapse) {
    characterData.campaignNotes.npcs.forEach(f => {
        f.isCollapsed = collapse;
        if (f.members && Array.isArray(f.members)) {
            f.members.forEach(npc => { npc.isCollapsed = collapse; });
        }
    });
    window.saveData(); window.renderContent(); lucide.createIcons();
};
window.moveFaction = function(facId, direction) { const arr = character