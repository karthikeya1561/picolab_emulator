/**
 * project_actions.js
 * 
 * Handles strictly UI-layer actions for saving and sharing projects.
 * Does not modify internal state or serialization logic.
 */

/**
 * Triggers a browser download of the provided string content.
 * 
 * @param {string} code - The source code to save
 * @param {string} filename - The name of the file to save (default: main.py)
 */
export function handleSaveCode(code, filename = 'main.py') {
    if (!code) {
        console.warn('No code to save.');
        return;
    }

    try {
        const blob = new Blob([code], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        
        // Append to DOM, click, and cleanup
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        
        console.log(`[Project Actions] Saved code to ${filename}`);
    } catch (err) {
        console.error('[Project Actions] Failed to save code:', err);
        alert('Failed to save code. Please try again.');
    }
}

/**
 * Displays a shareable URL to the user.
 * Currently uses a native prompt for simplicity and robust clipboard access.
 * 
 * @param {string} shareUrl - The fully assembled URL containing the project data
 */
export function handleShareProject(shareUrl) {
    if (!shareUrl) return;

    // Get modal elements
    const modal = document.getElementById('share-modal');
    const input = document.getElementById('share-modal-input');
    const copyBtn = document.getElementById('share-modal-copy-btn');
    const copyText = document.getElementById('share-modal-copy-text');
    const closeBtn = document.getElementById('share-modal-close-btn');
    const closeIcon = document.getElementById('share-modal-close-icon');

    if (!modal || !input || !copyBtn) {
        console.error('[Project Actions] Missing share modal elements in the DOM.');
        return;
    }

    // Set URL
    input.value = shareUrl;

    // Reset copy button state
    copyBtn.classList.remove('bg-success');
    copyBtn.classList.add('bg-primary');
    copyText.textContent = 'Copy';

    // Show modal
    modal.classList.remove('hidden');

    // Select text for easy copying manually as well
    input.select();

    // Setup Copy Handler
    copyBtn.onclick = () => {
        navigator.clipboard.writeText(shareUrl).then(() => {
            // Success Feedback
            copyText.textContent = 'Copied!';
            copyBtn.classList.remove('bg-primary');
            copyBtn.classList.add('bg-success');

            // Reset after 1.5 seconds
            setTimeout(() => {
                copyText.textContent = 'Copy';
                copyBtn.classList.remove('bg-success');
                copyBtn.classList.add('bg-primary');
            }, 1500);
        }).catch(err => {
            console.error('[Project Actions] Could not copy text: ', err);
            alert('Failed to copy. Please manually copy the text.');
        });
    };

    // Setup Close Handlers
    const hideModal = () => modal.classList.add('hidden');
    if (closeBtn) closeBtn.onclick = hideModal;
    if (closeIcon) closeIcon.onclick = hideModal;

    // Close if clicking outside the modal box
    modal.onclick = (e) => {
        if (e.target === modal) hideModal();
    };
}
