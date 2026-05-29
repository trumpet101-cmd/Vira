// --- RENDERERS ---
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

function renderNavigation() {
    const container = document.getElementById('nav-container');
    container.innerHTML = navItems.map((item, index) => {
        const isActive = activeTab === item.id;
        const isNextSubItem = navItems[index + 1]?.isSubItem;
        const paddingClass = item.isSubItem ? 'pl-11 pr-4 py-2.5 text-sm' : 'px-4 py-3';
        const iconSize = item.isSubItem ? 'w-4 h-4 opacity-70' : 'w-5 h-5';
        const marginClass = (item.isSubItem && !isNextSubItem) ? 'mb-4' : 'mb-1';
        const activeColors = isActive ? 'bg-emerald-800 text-white shadow-md' : 'hover:bg-stone-800 text-stone-400 hover:text-stone-200';
        
        return `<button onclick="window.setTab('${item.id}')" class="w-full flex items-center space-x-3 rounded-lg transition-colors ${paddingClass} ${marginClass} ${activeColors}">
            <i data-lucide="${item.icon}" class="${iconSize}"></i>
            <span class="font-medium">${item.label}</span>
        </button>`;
    }).join('');
}

window.renderContent = function() {
    // FOCUS & POSITION GUARD PRESERVATION: Record layout focus vectors right before innerHTML mutations
    var activeEl = document.activeElement;
    var activeSection = null;
    var activeField = null;
    var activeInputId = null;
    var caretOffset = 0;
    var selectionStart = 0;
    var selectionEnd = 0;
    
    if (activeEl) {
        if (activeEl.hasAttribute('data-editor-field')) {
            activeSection = activeEl.getAttribute('data-editor-section');
            activeField = activeEl.getAttribute('data-editor-field');
            
            var selection = window.getSelection();
            if (selection.rangeCount > 0) {
                var range = selection.getRangeAt(0);
                // VITAL SAFETY CHECK: Prevent fatal DOM index errors if a button was clicked but focus hasn't shifted yet
                if (activeEl.contains(range.startContainer)) {
                    var preCaretRange = range.cloneRange();
                    preCaretRange.selectNodeContents(activeEl);
                    preCaretRange.setEnd(range.startContainer, range.startOffset);
                    caretOffset = preCaretRange.toString().length;
                }
            }
        } else if (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') {
            activeInputId = activeEl.id;
            try {
                selectionStart = activeEl.selectionStart || 0;
                selectionEnd = activeEl.selectionEnd || 0;
            } catch(e) {}
        }
    }

    const container = document.getElementById('content-area');
    let html = '';
    window.updateDarkModeUI();

    // Update dynamic header character portrait
    const headerAvatar = document.getElementById('header-avatar-container');
    if (headerAvatar) {
        headerAvatar.innerHTML = characterData.avatar 
            ? `<img src="${characterData.avatar}" class="w-full h-full object-cover cursor-pointer hover:opacity-90" onclick="window.openLightbox(this.src)" title="Expand Portrait">` 
            : `<span class="text-sm">🧝‍♀️</span>`;
    }

    // Injected track indexing tags into mentionable and outline components
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
                <div id="${b.id}" class="backstory-block mb-4 border border-stone-200 dark:border-stone-800/80 rounded-xl bg-white dark:bg-stone-900 shadow-sm overflow-hidden" data-searchable="${escapeHtml(b.title)} ${escapeHtml(b.notes)}">
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
                <div id="${p.id}" class="personality-block mb-4 border rounded-xl shadow-sm overflow-hidden bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800" data-searchable="${escapeHtml(p.title)} ${escapeHtml(p.subtitle)} ${escapeHtml(p.notes)}">
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
        html = `<div class="space-y-6 animate-fade-in"><div class="bg-emerald-900 text-emerald-50 p-6 rounded-2xl shadow-sm flex items-center space-x-4 mb-8"><div class="bg-emerald-800 p-3 rounded-xl"><i data-lucide="map" class="w-8 h-8 text-emerald-300"></i></div><div><h3 class="text-2xl font-bold text-white">Campaign Notes</h3><p class="text-emerald-200">Organize your ongoing adventure logs here.</p></div></div><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">${renderTocCard('Session Notes', 'campaign_sessionNotes', 'scroll-text', 'Log your session events, summaries, and plot developments.')}${renderTocCard('Quests', 'campaign_quests', 'swords', 'Track active main quests, side quests, and completed objectives.')}${renderTocCard('NPCs', 'campaign_npcs', 'users', 'Details on important characters, allies, and villains you meet.')}${renderTocCard('Locations', 'campaign_locations', 'map-pin', 'Notes on cities, dungeons, and unique points of interest.')}${renderTocCard('Misc & Loot', 'campaign_misc', 'package', 'Party treasury, random thoughts, and other loose notes.')}</div></div>`;
    }
    else if (activeTab.startsWith('campaign_')) {
        const subSection = activeTab.replace('campaign_', '');
        const titleMap = { sessionNotes: { title: 'Session Notes', icon: 'scroll-text' }, quests: { title: 'Quests', icon: 'swords' }, npcs: { title: 'NPCs', icon: 'users' }, locations: { title: 'Locations', icon: 'map-pin' }, misc: { title: 'Misc & Loot', icon: 'package' } };
        let contentHtml = '';

        if (subSection === 'sessionNotes') {
            contentHtml = renderSectionHeader('session-search', 'Search sessions...', 'filterSessions', 'toggleAllSessions', 'addSession');
            if (characterData.campaignNotes.sessionNotes.length === 0) contentHtml += `<p class="text-stone-500 text-center py-8 italic">No sessions added yet.</p>`;
            characterData.campaignNotes.sessionNotes.forEach((sess, idx) => {
                contentHtml += `
                    <div id="${sess.id}" class="session-block mb-4 border border-stone-200 dark:border-stone-800/80 rounded-xl bg-white dark:bg-stone-900 shadow-sm overflow-hidden" data-searchable="${escapeHtml(sess.title)} ${escapeHtml(sess.date)} ${escapeHtml(sess.notes)}">
                        <div class="bg-stone-50/80 dark:bg-stone-800/60 border-b border-stone-200 dark:border-stone-800 px-5 py-4 flex justify-between items-start transition-colors">
                            <div class="flex-1 flex flex-col sm:flex-row sm:items-center gap-2">
                                <button onclick="window.toggleSessionCollapse('${sess.id}')" class="p-1 hover:bg-stone-200 dark:hover:bg-stone-700 rounded transition-colors focus:outline-none hidden sm:block"><i data-lucide="chevron-down" class="w-5 h-5 text-stone-400 chevron ${sess.isCollapsed ? 'collapsed' : ''}"></i></button>
                                <input type="text" id="input-sess-title-${sess.id}" oninput="window.updateSession('${sess.id}', 'title', this.value)" value="${escapeHtml(sess.title)}" class="seamless-input font-bold text-lg text-stone-800 dark:text-stone-100 bg-transparent px-2 py-1 -ml-2 w-full sm:w-auto rounded placeholder-stone-400" placeholder="Session Title">
                                <input type="text" id="input-sess-date-${sess.id}" oninput="window.updateSession('${sess.id}', 'date', this.value)" value="${escapeHtml(sess.date)}" class="seamless-input text-sm text-stone-500 bg-transparent px-2 py-1 w-full sm:w-auto rounded placeholder-stone-400" placeholder="Date">
                            </div>
                            <div class="flex items-center space-x-1 ml-2">
                                ${renderActionButtons('Session', sess.id, idx === 0, idx === characterData.campaignNotes.sessionNotes.length - 1)}
                            </div>
                        </div>
                        <div class="collapsible-content ${sess.isCollapsed ? 'collapsed' : ''} ${window.isDeepLinking ? 'no-transition' : ''}">
                            <div class="p-5">${getOutlineNotesEditor('campaignNotes_session', sess.id, sess.notes, 'min-h-[150px]', 'Start typing your session notes... Hitting Enter starts a bullet point, Tab indents, Shift+Tab outdents. Type @ to link notes.')}</div>
                        </div>
                    </div>`;
            });
        }
        else if (subSection === 'quests') {
            contentHtml = renderSectionHeader('quest-search', 'Search quests...', 'filterQuests', null, 'addQuest');
            const renderQuestCategory = (title, quests, categoryKey) => {
                const isCollapsed = questSectionsState[categoryKey];
                let sectionHtml = `<div class="quest-section mb-8" data-section-type="${categoryKey}"><div class="flex items-center justify-between mb-4 cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800/30 p-2 rounded -mx-2 transition-colors" onclick="window.toggleQuestSectionCollapse('${categoryKey}')"><h4 class="text-lg font-bold text-stone-700 dark:text-stone-300 flex items-center space-x-2"><i data-lucide="chevron-down" class="w-5 h-5 text-stone-400 chevron ${isCollapsed ? 'collapsed' : ''}"></i><span>${title} (${quests.length})</span></h4></div><div class="collapsible-content space-y-4 ${isCollapsed ? 'collapsed' : ''} ${window.isDeepLinking ? 'no-transition' : ''}">`;
                if (quests.length === 0) sectionHtml += `<p class="text-stone-400 italic px-8 py-2">No quests in this category.</p>`;

                quests.forEach((quest, qIdx) => {
                    sectionHtml += `
                        <div id="${quest.id}" class="quest-card bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl shadow-sm overflow-hidden flex" data-searchable="${escapeHtml(quest.title)} ${escapeHtml(quest.subtitle)} ${escapeHtml(quest.notes)}">
                            <div class="bg-stone-50 dark:bg-stone-950 px-4 py-5 flex flex-col items-center justify-start border-r border-stone-100 dark:border-stone-800">
                                <button onclick="window.toggleQuestCompletion('${quest.id}')" class="text-stone-300 dark:text-stone-600 hover:text-emerald-500 transition-colors focus:outline-none">
                                    ${quest.isCompleted ? `<i data-lucide="check-square" class="w-6 h-6 text-emerald-500"></i>` : `<i data-lucide="square" class="w-6 h-6 hover:text-emerald-400"></i>`}
                                </button>
                            </div>
                            <div class="p-5 flex-1 flex flex-col">
                                <div class="flex justify-between items-start mb-2">
                                    <div class="flex-1">
                                        <input type="text" id="input-quest-title-${quest.id}" oninput="window.updateQuest('${quest.id}', 'title', this.value)" value="${escapeHtml(quest.title)}" class="seamless-input font-bold text-lg ${quest.isCompleted ? 'text-stone-500 dark:text-stone-400 line-through' : 'text-stone-800 dark:text-stone-100'} bg-transparent w-full mb-1 rounded px-2 -ml-2 py-0.5 placeholder-stone-400/70" placeholder="Quest Title">
                                        <input type="text" id="input-quest-sub-${quest.id}" oninput="window.updateQuest('${quest.id}', 'subtitle', this.value)" value="${escapeHtml(quest.subtitle)}" class="seamless-input text-sm font-medium text-emerald-600 dark:text-emerald-400 bg-transparent w-full rounded px-2 -ml-2 py-0.5 placeholder-emerald-600/40 dark:placeholder-emerald-400/30" placeholder="Subtitle / Category">
                                    </div>
                                    <div class="flex items-center space-x-1 ml-4">
                                        ${renderActionButtons('Quest', quest.id, qIdx === 0, qIdx === quests.length - 1)}
                                    </div>
                                </div>
                                <div class="mt-2 text-stone-600 dark:text-stone-300 ${quest.isCompleted ? 'opacity-75' : ''}">${getOutlineNotesEditor('campaignNotes_quest', quest.id, quest.notes, 'min-h-[60px]', 'Quest description or sub-objectives... Enter starts a bullet, Tab indents, @ to link.')}</div>
                            </div>
                        </div>`;
                });
                sectionHtml += `</div></div>`;
                return sectionHtml;
            };
            contentHtml += renderQuestCategory('In Progress', characterData.campaignNotes.quests.filter(q => !q.isCompleted), 'inProgress');
            contentHtml += renderQuestCategory('Completed', characterData.campaignNotes.quests.filter(q => q.isCompleted), 'completed');
        }
        else if (subSection === 'locations') {
            contentHtml = renderSectionHeader('location-search', 'Search locations...', 'filterLocations', 'toggleAllLocations', 'addLocation');
            if (characterData.campaignNotes.locations.length === 0) contentHtml += `<p class="text-stone-500 text-center py-8 italic">No locations added yet.</p>`;
            characterData.campaignNotes.locations.forEach((loc, idx) => {
                contentHtml += `
                    <div id="${loc.id}" class="location-block mb-4 border border-stone-200 dark:border-stone-800/80 rounded-xl bg-white dark:bg-stone-900 shadow-sm overflow-hidden" data-searchable="${escapeHtml(loc.title)} ${escapeHtml(loc.subtitle)} ${escapeHtml(loc.notes)}">
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
                        <div class="collapsible-content ${loc.isCollapsed ? 'collapsed' : ''} ${window.isDeepLinking ? 'no-transition' : ''}">
                            <div class="p-5">${getOutlineNotesEditor('campaignNotes_location', loc.id, loc.notes, 'min-h-[100px]', 'Location details, points of interest, or resident lists... Enter starts a bullet, Tab indents, @ to link.')}</div>
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
                                    <div id="${npc.id}" class="npc-card bg-white dark:bg-stone-900 p-4 rounded-lg border border-stone-200 dark:border-stone-800/80 shadow-sm flex gap-4 transition-all" data-searchable="${escapeHtml(npc.name)} ${escapeHtml(npc.subtitle || '')} ${escapeHtml(npc.notes)}">
                                        <div class="flex-shrink-0 flex items-start mt-1">
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
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center space-x-2 w-full">
                                                <button onclick="window.toggleNpcCollapse('${faction.id}', '${npc.id}')" class="p-1 hover:bg-stone-100 dark:hover:bg-stone-800 rounded transition-colors focus:outline-none flex-shrink-0"><i data-lucide="chevron-down" class="w-4 h-4 text-stone-400 chevron ${npc.isCollapsed ? 'collapsed' : ''}"></i></button>
                                                <input type="text" id="input-npc-name-${faction.id}-${npc.id}" oninput="window.updateNPC('${faction.id}', '${npc.id}', 'name', this.value)" value="${escapeHtml(npc.name)}" class="seamless-input font-bold text-stone-800 dark:text-stone-100 w-full bg-transparent rounded px-2 py-0.5 placeholder-stone-400/70" placeholder="Character Name">
                                            </div>
                                            <div class="ml-7 mt-0.5 mb-1">
                                                <input type="text" id="input-npc-sub-${faction.id}-${npc.id}" oninput="window.updateNPC('${faction.id}', '${npc.id}', 'subtitle', this.value)" value="${escapeHtml(npc.subtitle || '')}" class="seamless-input text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-transparent w-full rounded px-2 py-0.5 placeholder-emerald-600/40 dark:placeholder-emerald-400/30" placeholder="Role, Title, or Allegiance (e.g., Carnival Owner)">
                                            </div>
                                            <div class="collapsible-content ${npc.isCollapsed ? 'collapsed' : ''} ${window.isDeepLinking ? 'no-transition' : ''}">
                                                ${getOutlineNotesEditor('campaignNotes_npc', faction.id + '##' + npc.id, npc.notes, 'min-h-[40px] text-sm mt-1', 'Character details, traits, affiliations... Enter starts a bullet, Tab indents, @ to link.')}
                                            </div>
                                        </div>
                                        <div class="flex flex-col justify-between items-end border-l border-stone-100 dark:border-stone-800 pl-3 self-stretch flex-shrink-0">
                                            <button onclick="window.deleteNPC('${faction.id}', '${npc.id}')" class="text-stone-300 dark:text-stone-600 hover:text-red-500 transition-colors p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/20" title="Delete NPC"><i data-lucide="x" class="w-4 h-4"></i></button>
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

    container.innerHTML = html;

    if (activeTab === 'build') window.recalculateBuildScores();

    if (activeTab === 'campaign_sessionNotes' && currentSearchQueries.sessionNotes) { document.getElementById('session-search').value = currentSearchQueries.sessionNotes; window.filterSessions(currentSearchQueries.sessionNotes); }
    else if (activeTab === 'campaign_quests' && currentSearchQueries.quests) { document.getElementById('quest-search').value = currentSearchQueries.quests; window.filterQuests(currentSearchQueries.quests); }
    else if (activeTab === 'campaign_locations' && currentSearchQueries.locations) { document.getElementById('location-search').value = currentSearchQueries.locations; window.filterLocations(currentSearchQueries.locations); }
    else if (activeTab === 'campaign_npcs' && currentSearchQueries.npcs) { document.getElementById('npc-search').value = currentSearchQueries.npcs; window.filterNPCs(currentSearchQueries.npcs); }
    else if (activeTab === 'backstory' && currentSearchQueries.backstory) { document.getElementById('backstory-search').value = currentSearchQueries.backstory; window.filterBackstory(currentSearchQueries.backstory); }
    else if (activeTab === 'personality' && currentSearchQueries.personality) { document.getElementById('personality-search').value = currentSearchQueries.personality; window.filterPersonality(currentSearchQueries.personality); }

    // RESTORE FOCUS & CARET POSITION: Relocate previous caret anchor parameters on reconstructed DOM tree elements
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
                // Safe terminal fallback if elements got truncated or string metrics changed
                var rangeEnd = document.createRange();
                rangeEnd.selectNodeContents(targetEl);
                rangeEnd.collapse(false);
                sel.removeAllRanges();
                sel.addRange(rangeEnd);
            }
        }
    }
}