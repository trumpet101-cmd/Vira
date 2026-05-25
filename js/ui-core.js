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
}
