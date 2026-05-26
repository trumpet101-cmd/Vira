// --- DARK MODE LOGIC COHESIVE SYSTEM ---
window.toggleDarkMode = function() {
    const html = document.documentElement;
    const isDark = html.classList.toggle('dark');
    localStorage.setItem('dark_mode_active', isDark ? 'true' : 'false');
    window.updateDarkModeUI();
};

window.updateDarkModeUI = function() {
    const isDark = document.documentElement.classList.contains('dark');
    const labelText = document.getElementById('dark-mode-text');
    const dot = document.getElementById('dark-mode-switch-dot');
    const moonIcon = document.getElementById('dark-mode-moon-icon');
    const sunIcon = document.getElementById('dark-mode-sun-icon');
    
    if (isDark) {
        if (labelText) labelText.innerText = "Dark Mode";
        if (dot) { dot.style.transform = "translateX(16px)"; dot.classList.remove('bg-stone-100'); dot.classList.add('bg-emerald-400'); }
        if (moonIcon) moonIcon.classList.add('hidden');
        if (sunIcon) sunIcon.classList.remove('hidden');
    } else {
        if (labelText) labelText.innerText = "Light Mode";
        if (dot) { dot.style.transform = "translateX(0px)"; dot.classList.remove('bg-emerald-400'); dot.classList.add('bg-stone-100'); }
        if (moonIcon) moonIcon.classList.remove('hidden');
        if (sunIcon) sunIcon.classList.add('hidden');
    }
};

// --- CUSTOM MODAL DIALOG CONTROLLERS ---
window.showCustomConfirm = function(title, message, icon, onConfirm, requiredInputText = null) {
    const dialog = document.getElementById('custom-dialog');
    document.getElementById('dialog-title').innerText = title;
    document.getElementById('dialog-message').innerText = message;
    document.getElementById('dialog-icon').innerText = icon || '⚠️';
    
    const confirmBtn = document.getElementById('dialog-confirm-btn');
    const cancelBtn = document.getElementById('dialog-cancel-btn');
    const inputContainer = document.getElementById('dialog-input-container');
    const dialogInput = document.getElementById('dialog-input');
    
    const newConfirmBtn = confirmBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    
    cancelBtn.classList.remove('hidden');
    newConfirmBtn.innerText = "Confirm";
    
    if (requiredInputText) {
        inputContainer.classList.remove('hidden');
        dialogInput.value = '';
        newConfirmBtn.disabled = true;
        newConfirmBtn.className = "flex-1 py-2.5 bg-red-300 text-white font-semibold rounded-xl cursor-not-allowed transition-all";
        document.getElementById('dialog-input-label').innerText = `Type "${requiredInputText}" to confirm`;
        
        dialogInput.oninput = function() {
            if (dialogInput.value === requiredInputText) {
                newConfirmBtn.disabled = false;
                newConfirmBtn.className = "flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-all shadow-md shadow-red-600/10";
            } else {
                newConfirmBtn.disabled = true;
                newConfirmBtn.className = "flex-1 py-2.5 bg-red-300 text-white font-semibold rounded-xl cursor-not-allowed transition-all";
            }
        };
        setTimeout(() => dialogInput.focus(), 100);
    } else {
        inputContainer.classList.add('hidden');
        newConfirmBtn.disabled = false;
        newConfirmBtn.className = "flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-all";
    }
    
    newConfirmBtn.addEventListener('click', () => { dialog.classList.add('hidden'); inputContainer.classList.add('hidden'); onConfirm(); });
    newCancelBtn.addEventListener('click', () => { dialog.classList.add('hidden'); inputContainer.classList.add('hidden'); });
    dialog.classList.remove('hidden');
};

window.showCustomAlert = function(title, message, icon) {
    const dialog = document.getElementById('custom-dialog');
    document.getElementById('dialog-title').innerText = title;
    document.getElementById('dialog-message').innerText = message;
    document.getElementById('dialog-icon').innerText = icon || '⚠️';
    
    const confirmBtn = document.getElementById('dialog-confirm-btn');
    const cancelBtn = document.getElementById('dialog-cancel-btn');
    const inputContainer = document.getElementById('dialog-input-container');
    if (inputContainer) inputContainer.classList.add('hidden');
    
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    
    cancelBtn.classList.add('hidden');
    newConfirmBtn.innerText = "OK";
    newConfirmBtn.disabled = false;
    newConfirmBtn.className = "flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-all";
    
    newConfirmBtn.addEventListener('click', () => { dialog.classList.add('hidden'); });
    dialog.classList.remove('hidden');
};

// --- MOBILE MENU ---
window.toggleMobileMenu = function() {
    isMobileMenuOpen = !isMobileMenuOpen;
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobile-overlay');
    if (isMobileMenuOpen) { sidebar.classList.remove('-translate-x-full'); overlay.classList.remove('hidden'); } 
    else { sidebar.classList.add('-translate-x-full'); overlay.classList.add('hidden'); }
};

// --- GLOBAL DYNAMIC @MENTION REFERENCE HOVER TOOLTIPS ---
document.addEventListener('mouseover', function(event) {
    // Target any text reference anchors built via insertMention deep linking paths
    const anchor = event.target.closest('a[onclick*="window.setTab"]');
    if (!anchor) return;

    const onclickValue = anchor.getAttribute('onclick') || '';
    const parsingMatrix = onclickValue.match(/window\.setTab\s*\(\s*'(.*?)'\s*,\s*'(.*?)'\s*\)/);
    if (!parsingMatrix) return;

    const targetTabId = parsingMatrix[1];
    const targetItemId = parsingMatrix[2];
    
    let previewContent = '';
    let categoryLabel = '';

    // Route entity query criteria down to global state scopes safely
    if (targetTabId === 'campaign_sessionNotes') {
        const row = characterData.campaignNotes.sessionNotes.find(s => s.id === targetItemId);
        if (row) { previewContent = row.notes; categoryLabel = 'Session Notes'; }
    } else if (targetTabId === 'campaign_quests') {
        const row = characterData.campaignNotes.quests.find(q => q.id === targetItemId);
        if (row) { previewContent = row.notes; categoryLabel = 'Quest Log'; }
    } else if (targetTabId === 'campaign_locations') {
        const row = characterData.campaignNotes.locations.find(l => l.id === targetItemId);
        if (row) { previewContent = row.notes; categoryLabel = 'Location Details'; }
    } else if (targetTabId === 'campaign_npcs') {
        characterData.campaignNotes.npcs.forEach(faction => {
            if (faction.id === targetItemId) {
                previewContent = faction.name ? 'Campaign Faction / Alliance Group Directory.' : '';
                categoryLabel = 'Faction Group';
            } else if (faction.members) {
                const npc = faction.members.find(n => n.id === targetItemId);
                if (npc) {
                    previewContent = (npc.subtitle ? `[${npc.subtitle}] ` : '') + (npc.notes || '');
                    categoryLabel = 'NPC Profile';
                }
            }
        });
    } else if (targetTabId === 'backstory') {
        const row = characterData.backstory.find(b => b.id === targetItemId);
        if (row) { previewContent = row.notes; categoryLabel = 'Character Backstory'; }
    } else if (targetTabId === 'personality') {
        const row = characterData.personality.find(p => p.id === targetItemId);
        if (row) { previewContent = row.notes; categoryLabel = 'Trait / Core Behavior'; }
    }

    // Process notes text strings and extract tags gracefully 
    const sanitizerNode = document.createElement('div');
    sanitizerNode.innerHTML = previewContent;
    let cleanSnippet = sanitizerNode.innerText || sanitizerNode.textContent || '';
    cleanSnippet = cleanSnippet.trim().replace(/\s+/g, ' ');

    if (!cleanSnippet || cleanSnippet === '<br>') {
        cleanSnippet = 'No description or logs recorded for this entry yet.';
    } else if (cleanSnippet.length > 160) {
        cleanSnippet = cleanSnippet.substring(0, 157) + '...';
    }

    const frame = document.getElementById('mention-tooltip');
    if (frame) {
        frame.innerHTML = `<span class="text-[10px] font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-wider">${categoryLabel}</span><p class="text-stone-200 dark:text-stone-300 font-medium">${window.escapeHtml(cleanSnippet)}</p>`;
        frame.classList.remove('hidden');

        // Initial cursor placement positioning callback tracking parameters
        adjustTooltipPosition(event, frame);

        const onMouseMove = function(moveEvent) {
            adjustTooltipPosition(moveEvent, frame);
        };

        const onMouseLeave = function() {
            frame.classList.add('hidden');
            anchor.removeEventListener('mousemove', onMouseMove);
            anchor.removeEventListener('mouseleave', onMouseLeave);
        };

        anchor.addEventListener('mousemove', onMouseMove);
        anchor.addEventListener('mouseleave', onMouseLeave);
    }
});

function adjustTooltipPosition(event, tooltipElement) {
    const cursorSpacingOffset = 15;
    let coordinateX = event.clientX + cursorSpacingOffset;
    let coordinateY = event.clientY + cursorSpacingOffset;

    const dimensions = tooltipElement.getBoundingClientRect();
    
    // Reverse bounds calculations safely if floating off the visible workspace edges
    if (coordinateX + dimensions.width > window.innerWidth) {
        coordinateX = event.clientX - dimensions.width - cursorSpacingOffset;
    }
    if (coordinateY + dimensions.height > window.innerHeight) {
        coordinateY = event.clientY - dimensions.height - cursorSpacingOffset;
    }

    tooltipElement.style.left = coordinateX + 'px';
    tooltipElement.style.top = coordinateY + 'px';
}