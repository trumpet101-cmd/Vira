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
window.moveFaction = function(facId, direction) { const arr = characterData.campaignNotes.npcs; const index = arr.findIndex(f => f.id === facId); if (index !== -1) { const targetIdx = index + direction; if (targetIdx >= 0 && targetIdx < arr.length) { [arr[index], arr[targetIdx]] = [arr[targetIdx], arr[index]]; window.saveData(); window.renderContent(); lucide.createIcons(); } } };

window.addNPC = function(facId) { currentSearchQueries.npcs = ''; const fac = characterData.campaignNotes.npcs.find(f => f.id === facId); if(fac) { fac.members.push({ id: 'npc_' + Date.now(), name: '', subtitle: '', notes: '', isCollapsed: false }); window.saveData(); window.renderContent(); lucide.createIcons(); } }
window.updateNPC = function(facId, npcId, field, val) { const fac = characterData.campaignNotes.npcs.find(f => f.id === facId); if(fac) { const npc = fac.members.find(n => n.id === npcId); if(npc) npc[field] = val; } window.saveData(); }
window.deleteNPC = function(facId, npcId) { window.showCustomConfirm('Delete Character?', 'Are you sure you want to permanently remove this NPC?', '👤', () => { const fac = characterData.campaignNotes.npcs.find(f => f.id === facId); if(fac) fac.members = fac.members.filter(n => n.id !== npcId); window.saveData(); window.renderContent(); lucide.createIcons(); }); }
window.toggleNpcCollapse = function(facId, npcId) { const fac = characterData.campaignNotes.npcs.find(f => f.id === facId); if (fac) { const npc = fac.members.find(n => n.id === npcId); if (npc) { npc.isCollapsed = !npc.isCollapsed; window.saveData(); window.renderContent(); lucide.createIcons(); } } };
window.moveNPC = function(facId, npcId, direction) { const faction = characterData.campaignNotes.npcs.find(f => f.id === facId); if (!faction) return; const arr = faction.members; const index = arr.findIndex(n => n.id === npcId); if (index !== -1) { const targetIdx = index + direction; if (targetIdx >= 0 && targetIdx < arr.length) { [arr[index], arr[targetIdx]] = [arr[targetIdx], arr[index]]; window.saveData(); window.renderContent(); lucide.createIcons(); } } };

window.filterNPCs = function(query) {
    currentSearchQueries.npcs = query;
    const q = query.toLowerCase();
    document.querySelectorAll('.npc-faction-block').forEach(faction => {
        const facName = faction.dataset.factionName.toLowerCase();
        let factionHasMatch = facName.includes(q), visibleNpcs = 0;
        faction.querySelectorAll('.npc-card').forEach(npc => {
            const hasMatch = npc.dataset.searchable.toLowerCase().includes(q) || factionHasMatch;
            if (hasMatch) { 
                npc.classList.remove('hidden'); 
                visibleNpcs++; 
                const cardContent = npc.querySelector('.collapsible-content');
                const cardChevron = npc.querySelector('.chevron');
                if (q.length > 0 && cardContent) {
                    cardContent.classList.remove('collapsed');
                    if (cardChevron) cardChevron.classList.remove('collapsed');
                } else if (q.length === 0 && cardContent) {
                    const facId = faction.id;
                    const npcId = npc.id;
                    const fRef = characterData.campaignNotes.npcs.find(f => f.id === facId);
                    if (fRef) {
                        const nRef = fRef.members.find(n => n.id === npcId);
                        if (nRef && nRef.isCollapsed) {
                            cardContent.classList.add('collapsed');
                            if (cardChevron) cardChevron.classList.add('collapsed');
                        }
                    }
                }
            } 
            else { npc.classList.add('hidden'); }
        });
        
        const contentDiv = faction.querySelector('.collapsible-content');
        const chevron = faction.querySelector('.chevron');
        if (q.length > 0 && (visibleNpcs > 0 || factionHasMatch)) {
            if (contentDiv) contentDiv.classList.remove('collapsed');
            if (chevron) chevron.classList.remove('collapsed');
        } else if (q.length === 0) {
            const facId = faction.id;
            const fac = characterData.campaignNotes.npcs.find(f => f.id === facId);
            if (fac) {
                if (fac.isCollapsed) {
                    if (contentDiv) contentDiv.classList.add('collapsed');
                    if (chevron) chevron.classList.add('collapsed');
                } else {
                    if (contentDiv) contentDiv.classList.remove('collapsed');
                    if (chevron) chevron.classList.remove('collapsed');
                }
            }
        }
        if (visibleNpcs > 0 || factionHasMatch) faction.classList.remove('hidden');
        else faction.classList.add('hidden');
    });
}

// --- KEYBOARD OUTLINE HANDLERS (VANILLA DOM TREE MUTATIONS REPLACING EXECCOMMAND) ---
window.handleOutlineKeyDown = function(event) {
    const div = event.currentTarget;
    const dropdown = document.getElementById('mention-dropdown');
    
    if (dropdown && !dropdown.classList.contains('hidden') && mentionContext) {
        if (event.key === 'Tab' || event.key === 'Enter' || event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            window.handleKeyDown(event);
            return;
        }
    }
    
    if (event.key === 'Tab') {
        event.preventDefault();
        
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            
            // Insert a temporary tracking bookmark to secure layout focus
            const marker = document.createElement('span');
            marker.id = 'caret-marker';
            range.insertNode(marker);

            let currentLi = marker.closest('li');
            if (currentLi) {
                let parentUl = currentLi.parentElement;
                let parentLi = parentUl ? parentUl.closest('li') : null;
                
                if (event.shiftKey && !parentLi) {
                    // BASE-LEVEL OUTDENT: Convert active list item into a regular plain text row line block
                    const plainDiv = document.createElement('div');
                    plainDiv.className = "mb-1";
                    while (currentLi.firstChild) {
                        plainDiv.appendChild(currentLi.firstChild);
                    }
                    
                    // Split the trailing UL list elements cleanly if we unwrap a row right out of the middle
                    if (currentLi.nextElementSibling) {
                        const splitUl = document.createElement('ul');
                        while (currentLi.nextElementSibling) {
                            splitUl.appendChild(currentLi.nextElementSibling);
                        }
                        parentUl.parentNode.insertBefore(splitUl, parentUl.nextSibling);
                    }
                    
                    parentUl.parentNode.insertBefore(plainDiv, parentUl.nextSibling);
                    currentLi.remove();
                    if (parentUl.children.length === 0) parentUl.remove();
                } else {
                    if (event.shiftKey) {
                        // STANDARD LAYER OUTDENT: Move active row up one nested level higher in list layout
                        if (parentUl && parentUl.tagName === 'UL' && parentLi) {
                            parentLi.parentNode.insertBefore(currentLi, parentLi.nextSibling);
                            if (parentUl.children.length === 0) {
                                parentUl.remove();
                            }
                        }
                    } else {
                        // STANDARD LAYER INDENT: Group active row inside previous sibling element's sublist
                        let prevLi = currentLi.previousElementSibling;
                        if (prevLi && prevLi.tagName === 'LI') {
                            let subUl = prevLi.querySelector('ul');
                            if (!subUl) {
                                subUl = document.createElement('ul');
                                prevLi.appendChild(subUl);
                            }
                            subUl.appendChild(currentLi);
                        }
                    }
                }
            } else {
                // HOTKEY LINE CONVERSION: User hit Tab while free-typing outside of any list frame arrays!
                if (!event.shiftKey) {
                    // Find the top-level boundary wrapper housing the active line
                    let topLevelNode = marker;
                    while (topLevelNode.parentNode && topLevelNode.parentNode !== div) {
                        topLevelNode = topLevelNode.parentNode;
                    }

                    const newUl = document.createElement('ul');
                    const newLi = document.createElement('li');
                    newUl.appendChild(newLi);

                    if (topLevelNode !== marker && (topLevelNode.tagName === 'DIV' || topLevelNode.tagName === 'P')) {
                        // Scenario A: The browser wrapped the free text in a block element
                        while (topLevelNode.firstChild) {
                            newLi.appendChild(topLevelNode.firstChild);
                        }
                        topLevelNode.parentNode.replaceChild(newUl, topLevelNode);
                    } else {
                        // Scenario B: The browser is using raw inline nodes and line-break tags
                        let nodesToWrap = [marker];
                        
                        let prev = marker.previousSibling;
                        while (prev && prev.tagName !== 'BR' && prev.tagName !== 'UL' && prev.tagName !== 'DIV' && prev.tagName !== 'P') {
                            nodesToWrap.unshift(prev);
                            prev = prev.previousSibling;
                        }
                        
                        let next = marker.nextSibling;
                        while (next && next.tagName !== 'BR' && next.tagName !== 'UL' && next.tagName !== 'DIV' && next.tagName !== 'P') {
                            nodesToWrap.push(next);
                            next = next.nextSibling;
                        }

                        // RELATIVE PARENT INSERTION: Dynamically hook insertion into the specific node's actual parent wrapper
                        nodesToWrap[0].parentNode.insertBefore(newUl, nodesToWrap[0]);
                        nodesToWrap.forEach(n => newLi.appendChild(n));
                        
                        // Clean up trailing line breaks to prevent structural double spacing
                        if (next && next.tagName === 'BR') next.remove();
                        if (prev && prev.tagName === 'BR' && !prev.previousSibling) prev.remove();
                    }
                }
            }

            // Restore text cursor caret selection back into place next to active bookmark node before removal
            const foundMarker = div.querySelector('#caret-marker');
            if (foundMarker) {
                const restoreRange = document.createRange();
                if (foundMarker.nextSibling && foundMarker.nextSibling.nodeType === Node.TEXT_NODE) {
                    restoreRange.setStart(foundMarker.nextSibling, 0);
                } else if (foundMarker.previousSibling && foundMarker.previousSibling.nodeType === Node.TEXT_NODE) {
                    restoreRange.setStart(foundMarker.previousSibling, foundMarker.previousSibling.length);
                } else {
                    restoreRange.setStartBefore(foundMarker);
                }
                restoreRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(restoreRange);
                foundMarker.remove();
            }
        }
        
        div.dispatchEvent(new Event('input', { bubbles: true }));
        return;
    }
    window.handleKeyDown(event);
};

window.handleOutlineFocus = function(event) {
    const div = event.currentTarget;
    const html = div.innerHTML.trim();
    if (html === "" || html === "<br>" || html === "<div><br></div>" || !div.querySelector('ul')) {
        div.innerHTML = "<ul><li><br></li></ul>";
        setTimeout(() => {
            const range = document.createRange();
            const sel = window.getSelection();
            const li = div.querySelector('li');
            if (li) { range.setStart(li, 0); range.collapse(true); sel.removeAllRanges(); sel.addRange(range); }
        }, 0);
        div.dispatchEvent(new Event('input', { bubbles: true }));
    }
};

window.handleOutlineBlur = function(event) {
    const div = event.currentTarget;
    if (div.innerText.trim() === "") { div.innerHTML = ""; div.dispatchEvent(new Event('input', { bubbles: true })); }
};

window.handlePaste = function(e) {
    e.preventDefault();
    const text = (e.originalEvent || e).clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
};

// --- THE MENTION SYSTEM ---
var mentionContext = null;

function getMentionSuggestions(query) {
    const q = query.toLowerCase();
    let results = [];
    characterData.campaignNotes.sessionNotes.forEach(s => { if (s.title && s.title.toLowerCase().includes(q)) results.push({ type: 'Session', id: 'campaign_sessionNotes', itemId: s.id, label: s.title }); });
    characterData.campaignNotes.quests.forEach(qItem => { if (qItem.title && qItem.title.toLowerCase().includes(q)) results.push({ type: 'Quest', id: 'campaign_quests', itemId: qItem.id, label: qItem.title }); });
    characterData.campaignNotes.npcs.forEach(fac => {
        if (fac.name && fac.name.toLowerCase().includes(q)) results.push({ type: 'Faction', id: 'campaign_npcs', itemId: fac.id, label: fac.name });
        fac.members.forEach(npc => { if (npc.name && npc.name.toLowerCase().includes(q)) results.push({ type: 'NPC', id: 'campaign_npcs', itemId: npc.id, label: npc.name }); });
    });
    characterData.campaignNotes.locations.forEach(loc => { if (loc.title && loc.title.toLowerCase().includes(q)) results.push({ type: 'Location', id: 'campaign_locations', itemId: loc.id, label: loc.title }); });
    characterData.backstory.forEach(b => { if (b.title && b.title.toLowerCase().includes(q)) results.push({ type: 'Backstory', id: 'backstory', itemId: b.id, label: b.title }); });
    characterData.personality.forEach(p => { if