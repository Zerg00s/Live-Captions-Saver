document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const captionsContainer = document.getElementById('captions-container');
    const searchBox = document.getElementById('search-box');
    const speakerFiltersContainer = document.getElementById('speaker-filters');
    const copyAllBtn = document.getElementById('copy-all-btn');
    const saveAllBtn = document.getElementById('save-all-btn');
    const historyBtn = document.getElementById('history-btn');
    const sessionModal = document.getElementById('sessionModal');
    const sessionListModal = document.getElementById('sessionListModal');
    const closeModal = document.querySelector('.close-modal');

    // --- State ---
    let allCaptions = [];
    let searchDebounceTimer = null;
    let meetingStartTime = null;
    let meetingEndTime = null;
    const SEARCH_DEBOUNCE_DELAY = 300;
    
    // Live streaming state
    let isLiveStreaming = false;
    let lastUpdateTime = Date.now();
    let activeSearch = '';
    let autoScroll = true;
    let pendingUpdates = [];
    let updateTimer = null;

    // --- Utility ---
    function escapeHtml(str) {
        const p = document.createElement("p");
        p.textContent = str;
        return p.innerHTML;
    }
    
    // --- Helper Functions ---
    function highlightSearchTerm(element, searchTerm) {
        if (!searchTerm) return;
        
        const textElement = element.querySelector('.text');
        if (!textElement) return;
        
        const text = textElement.textContent;
        const regex = new RegExp(`(${searchTerm})`, 'gi');
        const highlightedText = text.replace(regex, '<mark>$1</mark>');
        textElement.innerHTML = highlightedText;
    }
    
    // --- Live Update Functions ---
    function appendNewCaption(caption) {
        // Add to data array
        allCaptions.push(caption);
        
        // Create HTML for new caption
        const newCaptionHTML = createCaptionHTML(caption, allCaptions.length - 1);
        
        // Remove "no captions" message if it exists
        const statusMessage = captionsContainer.querySelector('.status-message');
        if (statusMessage) {
            statusMessage.remove();
        }
        
        // Append to DOM
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = newCaptionHTML;
        const newCaptionElement = tempDiv.firstElementChild;
        captionsContainer.appendChild(newCaptionElement);
        
        // Apply search filter if active
        if (activeSearch) {
            const matchesSearch = caption.Text.toLowerCase().includes(activeSearch.toLowerCase()) ||
                                 caption.Name.toLowerCase().includes(activeSearch.toLowerCase());
            if (!matchesSearch) {
                newCaptionElement.style.display = 'none';
            } else {
                highlightSearchTerm(newCaptionElement, activeSearch);
            }
        }
        
        // Auto-scroll if enabled
        if (autoScroll) {
            newCaptionElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
        
        // Update analytics
        updateAnalyticsIncremental(caption);
        
        // Update export button states
        updateExportButtonStates();
        
        // Update last update time
        lastUpdateTime = Date.now();
        updateLiveIndicator();
    }
    
    function updateExistingCaption(caption) {
        const captionElement = captionsContainer.querySelector(`[data-index="${allCaptions.findIndex(c => c.key === caption.key)}"]`);
        if (captionElement) {
            const textElement = captionElement.querySelector('.text');
            if (textElement) {
                textElement.textContent = caption.Text;
            }
        }
        
        // Update in data array
        const index = allCaptions.findIndex(c => c.key === caption.key);
        if (index !== -1) {
            allCaptions[index] = caption;
        }
    }
    
    function batchProcessUpdates() {
        if (pendingUpdates.length === 0) return;
        
        // Process all pending updates
        pendingUpdates.forEach(update => {
            if (update.type === 'new') {
                appendNewCaption(update.caption);
            } else if (update.type === 'update') {
                updateExistingCaption(update.caption);
            }
        });
        
        pendingUpdates = [];
        updateTimer = null;
    }
    
    function queueUpdate(update) {
        pendingUpdates.push(update);
        
        // Batch updates every 100ms for performance
        if (!updateTimer) {
            updateTimer = setTimeout(batchProcessUpdates, 100);
        }
    }
    
    function updateAnalyticsIncremental(caption) {
        // Check if this is a new speaker we haven't seen before
        const speakerButton = speakerFiltersContainer.querySelector(`button[data-speaker="${caption.Name}"]`);
        if (!speakerButton) {
            // New speaker detected, add their button
            const btn = document.createElement('button');
            btn.textContent = caption.Name;
            btn.dataset.speaker = caption.Name;
            btn.setAttribute('aria-label', `Filter by ${caption.Name}`);
            speakerFiltersContainer.appendChild(btn);
        }
        
        // Recalculate and display analytics
        const analytics = calculateAnalytics(allCaptions);
        if (analytics) {
            displayAnalytics(analytics);
        }
    }
    
    function updateLiveIndicator() {
        const indicator = document.getElementById('live-indicator');
        if (!indicator) {
            // Create live indicator if it doesn't exist
            const headerElement = document.querySelector('h1');
            if (headerElement) {
                const liveIndicator = document.createElement('span');
                liveIndicator.id = 'live-indicator';
                liveIndicator.className = 'live-indicator';
                liveIndicator.innerHTML = '<span class="live-dot"></span> LIVE';
                headerElement.appendChild(liveIndicator);
            }
        } else {
            // Update indicator status
            indicator.classList.toggle('active', isLiveStreaming);
            
            // Stop dot animation when not live
            const liveDot = indicator.querySelector('.live-dot');
            if (liveDot) {
                if (!isLiveStreaming) {
                    liveDot.style.animation = 'none';
                } else {
                    liveDot.style.animation = '';
                }
            }
        }
    }

    // --- Rendering Functions ---
    function createCaptionHTML(item, index) {
        const copyIconSVG = `
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>`;
        
        return `
            <div class="caption" data-speaker="${escapeHtml(item.Name)}" data-index="${index}">
                <button class="copy-btn" title="Copy this line" aria-label="Copy this line">
                    ${copyIconSVG}
                    <span class="tooltip-text">Copy</span>
                </button>
                <div class="caption-header">
                    <span class="name">${escapeHtml(item.Name)}</span>
                    <span class="time">${escapeHtml(item.Time)}</span>
                </div>
                <p class="text">${escapeHtml(item.Text)}</p>
            </div>
        `;
    }

    function renderCaptions(transcriptArray) {
        allCaptions = transcriptArray;
        const htmlContent = transcriptArray.map(createCaptionHTML).join('');
        captionsContainer.innerHTML = htmlContent || '<p class="status-message">No captions to display.</p>';
        updateExportButtonStates();
    }

    function populateSpeakerFilters(transcriptArray) {
        // Get all unique speakers from transcript
        const speakers = [...new Set(transcriptArray.map(item => item.Name))];
        
        // Get existing speaker buttons (to track what we already have)
        const existingSpeakers = new Set();
        speakerFiltersContainer.querySelectorAll('button:not(#show-all-btn)').forEach(btn => {
            existingSpeakers.add(btn.dataset.speaker);
        });
        
        // Only add new speakers that don't already have buttons
        speakers.forEach(speaker => {
            if (!existingSpeakers.has(speaker)) {
                const btn = document.createElement('button');
                btn.textContent = speaker;
                btn.dataset.speaker = speaker;
                btn.setAttribute('aria-label', `Filter by ${speaker}`);
                speakerFiltersContainer.appendChild(btn);
            }
        });
    }

    // --- Interactivity & Filtering ---
    function applyFilters() {
        const searchTerm = searchBox.value.toLowerCase().trim();
        activeSearch = searchTerm; // Store for live updates
        const activeSpeakerFilter = speakerFiltersContainer.querySelector('button.active');
        const speakerToFilter = activeSpeakerFilter?.id === 'show-all-btn' ? null : activeSpeakerFilter?.dataset.speaker;

        document.querySelectorAll('.caption').forEach(captionDiv => {
            const text = captionDiv.querySelector('.text').textContent.toLowerCase();
            const speaker = captionDiv.dataset.speaker;

            const matchesSearch = !searchTerm || text.includes(searchTerm) || speaker.toLowerCase().includes(searchTerm);
            const matchesSpeaker = !speakerToFilter || speaker === speakerToFilter;

            captionDiv.style.display = (matchesSearch && matchesSpeaker) ? 'block' : 'none';
        });
        
        // Update export button states
        updateExportButtonStates();
    }
    
    function updateExportButtonStates() {
        const visibleCount = getVisibleCaptions().length;
        const hasVisibleCaptions = visibleCount > 0;
        
        copyAllBtn.disabled = !hasVisibleCaptions;
        saveAllBtn.disabled = !hasVisibleCaptions;
        
        // Update titles with count
        copyAllBtn.title = hasVisibleCaptions 
            ? `Copy ${visibleCount} visible caption(s) to clipboard`
            : 'No visible captions to copy';
        saveAllBtn.title = hasVisibleCaptions 
            ? `Save ${visibleCount} visible caption(s) as file`
            : 'No visible captions to save';
    }

    function debouncedApplyFilters() {
        if (searchDebounceTimer) {
            clearTimeout(searchDebounceTimer);
        }
        searchDebounceTimer = setTimeout(applyFilters, SEARCH_DEBOUNCE_DELAY);
    }

    function handleSpeakerFilterClick(e) {
        if (e.target.tagName !== 'BUTTON') return;
        
        speakerFiltersContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        applyFilters();
    }

    async function handleCopyClick(e) {
        const copyButton = e.target.closest('.copy-btn');
        if (!copyButton) return;

        const captionDiv = copyButton.closest('.caption');
        const index = parseInt(captionDiv.dataset.index, 10);
        const captionData = allCaptions[index];

        if (!captionData) return;

        const textToCopy = `[${captionData.Time}] ${captionData.Name}: ${captionData.Text}`;
        try {
            await navigator.clipboard.writeText(textToCopy);
            copyButton.classList.add('copied');
            copyButton.querySelector('.tooltip-text').textContent = 'Copied!';
            
            setTimeout(() => {
                copyButton.classList.remove('copied');
                copyButton.querySelector('.tooltip-text').textContent = 'Copy';
            }, 1500); // TODO: Extract to TIMING constant
        } catch (err) {
            console.error('Failed to copy text: ', err);
            copyButton.querySelector('.tooltip-text').textContent = 'Copy failed';
            // Show user-friendly error
            const errorMsg = document.createElement('div');
            errorMsg.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #dc3545; color: white; padding: 10px; border-radius: 4px; z-index: 1000;';
            errorMsg.textContent = 'Failed to copy text to clipboard';
            document.body.appendChild(errorMsg);
            setTimeout(() => document.body.removeChild(errorMsg), 3000);
        }
    }
    
    // --- Export Functions ---
    function getVisibleCaptions() {
        const visibleCaptions = [];
        const captionElements = captionsContainer.querySelectorAll('.caption');
        
        captionElements.forEach(captionElement => {
            if (captionElement.style.display !== 'none') {
                const index = parseInt(captionElement.dataset.index, 10);
                if (!isNaN(index) && allCaptions[index]) {
                    visibleCaptions.push(allCaptions[index]);
                }
            }
        });
        
        return visibleCaptions;
    }
    
    function formatTranscriptForExport(captions, format = 'txt') {
        if (!captions || captions.length === 0) {
            return 'No captions to export.';
        }
        
        if (format === 'markdown') {
            return captions.map(entry => `**${entry.Name}** (${entry.Time}): ${entry.Text}`).join('\n\n');
        } else {
            return captions.map(entry => `[${entry.Time}] ${entry.Name}: ${entry.Text}`).join('\n');
        }
    }
    
    async function handleCopyAllClick() {
        const visibleCaptions = getVisibleCaptions();
        
        if (visibleCaptions.length === 0) {
            showNotification('No visible captions to copy', 'warning');
            return;
        }
        
        const textToCopy = formatTranscriptForExport(visibleCaptions);
        
        try {
            await navigator.clipboard.writeText(textToCopy);
            showButtonSuccess(copyAllBtn, 'Copied!', 'Copy All');
            showNotification(`Copied ${visibleCaptions.length} caption(s) to clipboard`, 'success');
        } catch (err) {
            console.error('Failed to copy transcript: ', err);
            showNotification('Failed to copy to clipboard', 'error');
        }
    }
    
    async function handleSaveAllClick() {
        const visibleCaptions = getVisibleCaptions();
        
        if (visibleCaptions.length === 0) {
            showNotification('No visible captions to save', 'warning');
            return;
        }
        
        // Create download
        const content = formatTranscriptForExport(visibleCaptions);
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        const filename = `filtered-transcript-${dateStr}-${timeStr}.txt`;
        
        try {
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showButtonSuccess(saveAllBtn, 'Saved!', 'Save');
            showNotification(`Saved ${visibleCaptions.length} caption(s) to ${filename}`, 'success');
            
            // Update meeting ended message to show it's been saved
            if (document.getElementById('meeting-ended-message')) {
                await addMeetingEndedMessage(true);
            }
        } catch (err) {
            console.error('Failed to save transcript: ', err);
            showNotification('Failed to save file', 'error');
        }
    }
    
    function showButtonSuccess(button, successText, originalText) {
        const originalHtml = button.innerHTML;
        button.classList.add('success');
        const svg = button.querySelector('svg');
        button.innerHTML = `${svg.outerHTML}${successText}`;
        
        setTimeout(() => {
            button.classList.remove('success');
            button.innerHTML = originalHtml;
        }, 2000);
    }
    
    function showNotification(message, type = 'info') {
        // Remove existing notification if any
        const existingNotification = document.getElementById('notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        const notification = document.createElement('div');
        notification.id = 'notification';
        notification.textContent = message;
        
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type] || colors.info};
            color: white;
            padding: 12px 16px;
            border-radius: 6px;
            z-index: 10000;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideInFromRight 0.3s ease-out;
        `;
        
        // Add slide-in animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInFromRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideInFromRight 0.3s ease-out reverse';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
                if (style.parentNode) {
                    style.remove();
                }
            }, 300);
        }, 3000);
    }
    
    // --- Initialization ---
    function setupEventListeners() {
        searchBox.addEventListener('input', debouncedApplyFilters);
        speakerFiltersContainer.addEventListener('click', handleSpeakerFilterClick);
        captionsContainer.addEventListener('click', handleCopyClick);
        copyAllBtn.addEventListener('click', handleCopyAllClick);
        saveAllBtn.addEventListener('click', handleSaveAllClick);
        
        // Session history handlers
        historyBtn.addEventListener('click', showSessionHistory);
        closeModal.addEventListener('click', () => sessionModal.style.display = 'none');
        window.addEventListener('click', (e) => {
            if (e.target === sessionModal) {
                sessionModal.style.display = 'none';
            }
        });
    }
    
    // --- Session History Functions ---
    async function showSessionHistory() {
        sessionModal.style.display = 'block';
        await loadSessionHistory();
    }
    
    async function loadSessionHistory() {
        try {
            // Check if SessionManager already exists or load it
            if (typeof SessionManager === 'undefined') {
                const script = document.createElement('script');
                script.src = chrome.runtime.getURL('sessionManager.js');
                document.head.appendChild(script);
                
                await new Promise(resolve => {
                    script.onload = resolve;
                    setTimeout(resolve, 200);
                });
            }
            
            const sessionManager = new SessionManager();
            const sessions = await sessionManager.getSessionIndex();
            
            if (!sessions || sessions.length === 0) {
                sessionListModal.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">No saved sessions available</div>';
                return;
            }
            
            let html = '';
            for (const session of sessions) {
                const timeAgo = getTimeAgo(new Date(session.timestamp));
                html += `
                    <div class="session-item" onclick="loadSessionFromHistory('${session.id}')">
                        <div class="session-title">${escapeHtml(session.title)}</div>
                        <div class="session-meta">
                            ${session.date} • ${session.duration} • ${session.captionCount} captions • ${timeAgo}
                        </div>
                    </div>
                `;
            }
            
            sessionListModal.innerHTML = html;
            
        } catch (error) {
            console.error('[Session History] Failed to load:', error);
            sessionListModal.innerHTML = '<div style="text-align: center; color: #dc3545; padding: 20px;">Error loading sessions</div>';
        }
    }
    
    window.loadSessionFromHistory = async function(sessionId) {
        try {
            const sessionManager = new SessionManager();
            const sessionData = await sessionManager.loadSession(sessionId);
            
            // Close modal
            sessionModal.style.display = 'none';
            
            // Load the transcript
            allCaptions = sessionData.transcript;
            isLiveStreaming = false; // Historical data, not live
            
            // Update title
            document.querySelector('h1').innerHTML = `${escapeHtml(sessionData.metadata.title)} <span style="font-size: 0.5em; color: #666;">(Historical)</span>`;
            
            // Calculate and display analytics
            const analytics = calculateAnalytics(allCaptions);
            if (analytics) {
                displayAnalytics(analytics);
            }
            
            // Render the transcript
            renderCaptions(allCaptions);
            populateSpeakerFilters(allCaptions);
            
            // Clear any live indicators
            const liveIndicator = document.getElementById('live-indicator');
            if (liveIndicator) {
                liveIndicator.classList.remove('active');
            }
            
        } catch (error) {
            console.error('[Session History] Failed to load session:', error);
            alert('Failed to load session');
        }
    }
    
    function getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        const intervals = {
            year: 31536000,
            month: 2592000,
            week: 604800,
            day: 86400,
            hour: 3600,
            minute: 60
        };
        
        for (const [unit, secondsInUnit] of Object.entries(intervals)) {
            const interval = Math.floor(seconds / secondsInUnit);
            if (interval >= 1) {
                return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
            }
        }
        return 'just now';
    }

    async function initialize() {
        try {
            // Check if we have captions passed via storage (from popup)
            const result = await chrome.storage.local.get(['captionsToView', 'viewerData']);
            let transcript = result.captionsToView;
            let viewerData = result.viewerData;
            
            // Use viewerData if captionsToView is not available
            if (!transcript && viewerData && viewerData.transcriptArray) {
                transcript = viewerData.transcriptArray;
                // Update title if it's historical data
                if (viewerData.isHistorical && viewerData.meetingTitle) {
                    document.querySelector('h1').innerHTML = `${escapeHtml(viewerData.meetingTitle)} <span style="font-size: 0.5em; color: #666;">(Historical)</span>`;
                }
            }

            if (transcript && transcript.length > 0) {
                // Calculate and display analytics
                const analytics = calculateAnalytics(transcript);
                if (analytics) {
                    displayAnalytics(analytics);
                }
                
                renderCaptions(transcript);
                populateSpeakerFilters(transcript);
                setupEventListeners();
                
                // Setup live streaming after initial load
                setupLiveStreaming();
                
                // Check if this is a completed meeting (not live)
                // If we have captions but no live connection after setup, show meeting ended
                setTimeout(async () => {
                    if (!isLiveStreaming && transcript.length > 0) {
                        await addMeetingEndedMessage();
                    }
                }, 1000);
            } else {
                // Check if user navigated directly to the page
                const isDirectNavigation = !result.captionsToView;
                if (isDirectNavigation) {
                    captionsContainer.innerHTML = '<p class="status-message">No transcript data available.<br><br>Please use the "View Transcript" button in the extension popup to load a transcript.</p>';
                } else {
                    captionsContainer.innerHTML = '<p class="status-message">Waiting for live captions...</p>';
                    // Still setup live streaming even if no initial captions
                    setupLiveStreaming();
                }
            }
        } catch (error) {
            console.error("Error loading captions:", error);
            captionsContainer.innerHTML = '<p class="status-message">Unable to load captions. Please try opening the extension popup again.</p>';
        } finally {
            // Clean up storage to prevent re-displaying on next open
            chrome.storage.local.remove(['captionsToView', 'viewerData']);
        }
    }
    
    async function addMeetingEndedMessage() {
        // Check if message already exists
        if (document.getElementById('meeting-ended-message')) return;
        
        // Check if auto-save is enabled
        const { autoSaveOnEnd } = await chrome.storage.sync.get('autoSaveOnEnd');
        
        const endedMessage = document.createElement('div');
        endedMessage.id = 'meeting-ended-message';
        endedMessage.style.cssText = `
            text-align: center;
            padding: 20px;
            margin: 20px 0;
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            color: #6c757d;
            font-size: 16px;
        `;
        
        let subtext = autoSaveOnEnd 
            ? 'The transcript has been auto-saved.'
            : 'The transcript is ready to save.';
            
        endedMessage.innerHTML = `<strong>Meeting Ended</strong><br><span style="font-size: 14px;">${subtext}</span>`;
        
        captionsContainer.appendChild(endedMessage);
        
        // Auto-scroll to show the message
        if (autoScroll) {
            endedMessage.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }
    
    function removeMeetingEndedMessage() {
        const message = document.getElementById('meeting-ended-message');
        if (message) {
            message.remove();
        }
    }
    
    // --- Live Streaming Setup ---
    async function setupLiveStreaming() {
        // Check if content script is available and streaming
        try {
            const tabs = await chrome.tabs.query({ url: "https://teams.microsoft.com/*" });
            if (tabs.length > 0) {
                const response = await chrome.tabs.sendMessage(tabs[0].id, { message: "viewer_ready" });
                if (response && response.streaming) {
                    isLiveStreaming = true;
                    lastUpdateTime = Date.now(); // Initialize timestamp
                    updateLiveIndicator();
                    console.log("Connected to live caption stream");
                }
            }
        } catch (error) {
            console.log("Content script not ready for streaming:", error);
        }
        
        // Setup message listener for live updates
        chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
            if (request.message === "live_caption_update") {
                isLiveStreaming = true;
                lastUpdateTime = Date.now(); // Update timestamp when receiving messages
                queueUpdate(request);
                
                // Remove "Meeting Ended" message if we're receiving updates again
                removeMeetingEndedMessage();
            } else if (request.message === "live_attendee_update") {
                // Handle attendee updates if needed
                console.log("Attendee update:", request);
                lastUpdateTime = Date.now(); // Update timestamp for attendee updates too
            } else if (request.message === "meeting_ended") {
                // Handle explicit meeting end signal
                isLiveStreaming = false;
                updateLiveIndicator();
                await addMeetingEndedMessage();
            }
        });
        
        // Setup auto-scroll toggle
        setupAutoScrollToggle();
        
        // Heartbeat to check connection
        setInterval(checkConnectionStatus, 5000);
    }
    
    function setupAutoScrollToggle() {
        // Create auto-scroll toggle button
        const searchContainer = document.querySelector('.search-container');
        if (searchContainer && !document.getElementById('auto-scroll-toggle')) {
            const autoScrollBtn = document.createElement('button');
            autoScrollBtn.id = 'auto-scroll-toggle';
            autoScrollBtn.className = 'filter-btn active';
            autoScrollBtn.textContent = `Auto-scroll: ${autoScroll ? 'ON' : 'OFF'}`;
            autoScrollBtn.onclick = () => {
                autoScroll = !autoScroll;
                autoScrollBtn.textContent = `Auto-scroll: ${autoScroll ? 'ON' : 'OFF'}`;
                autoScrollBtn.classList.toggle('active', autoScroll);
            };
            searchContainer.appendChild(autoScrollBtn);
        }
    }
    
    async function checkConnectionStatus() {
        if (!isLiveStreaming) return;
        
        // Check if we're still receiving updates
        const timeSinceLastUpdate = Date.now() - lastUpdateTime;
        if (timeSinceLastUpdate > 30000) { // 30 seconds without updates
            isLiveStreaming = false;
            updateLiveIndicator();
            console.log("Lost connection to live stream");
            
            // Add "Meeting Ended" message
            await addMeetingEndedMessage();
            
            // Try to reconnect
            const tabs = await chrome.tabs.query({ url: "https://teams.microsoft.com/*" });
            if (tabs.length > 0) {
                try {
                    const response = await chrome.tabs.sendMessage(tabs[0].id, { message: "viewer_ready" });
                    if (response && response.streaming) {
                        isLiveStreaming = true;
                        lastUpdateTime = Date.now(); // Reset timeout
                        updateLiveIndicator();
                        console.log("Reconnected to live stream");
                        
                        // Remove "Meeting Ended" message if reconnected
                        removeMeetingEndedMessage();
                    }
                } catch (error) {
                    // Silent fail
                }
            }
        }
    }

    // --- Analytics Functions ---
    function calculateAnalytics(captions) {
        if (!captions || captions.length === 0) return null;
        
        const speakerStats = {};
        let totalWords = 0;
        
        // Calculate speaker statistics
        captions.forEach(caption => {
            const speaker = caption.Name;
            const words = caption.Text.split(/\s+/).length;
            
            if (!speakerStats[speaker]) {
                speakerStats[speaker] = {
                    messageCount: 0,
                    wordCount: 0,
                    firstMessage: caption.Time,
                    lastMessage: caption.Time
                };
            }
            
            speakerStats[speaker].messageCount++;
            speakerStats[speaker].wordCount += words;
            speakerStats[speaker].lastMessage = caption.Time;
            totalWords += words;
        });
        
        // Calculate percentages
        Object.keys(speakerStats).forEach(speaker => {
            speakerStats[speaker].wordPercentage = ((speakerStats[speaker].wordCount / totalWords) * 100).toFixed(1);
        });
        
        return {
            totalMessages: captions.length,
            totalWords: totalWords,
            uniqueSpeakers: Object.keys(speakerStats).length,
            speakerStats: speakerStats
        };
    }
    
    function displayAnalytics(analytics) {
        if (!analytics) return;
        
        // Check if analytics container already exists
        let analyticsContainer = document.getElementById('meeting-analytics');
        
        // Sort speakers by word count
        const sortedSpeakers = Object.entries(analytics.speakerStats)
            .sort((a, b) => b[1].wordCount - a[1].wordCount);
        
        let analyticsHTML = `
                <h3 style="margin-top: 0; color: #495057;">Meeting Analytics</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 15px;">
                    <div>
                        <div style="font-size: 24px; font-weight: bold; color: #17a2b8;">${analytics.totalMessages}</div>
                        <div style="font-size: 12px; color: #6c757d;">Total Messages</div>
                    </div>
                    <div>
                        <div style="font-size: 24px; font-weight: bold; color: #28a745;">${analytics.totalWords}</div>
                        <div style="font-size: 12px; color: #6c757d;">Total Words</div>
                    </div>
                    <div>
                        <div style="font-size: 24px; font-weight: bold; color: #ffc107;">${analytics.uniqueSpeakers}</div>
                        <div style="font-size: 12px; color: #6c757d;">Speakers</div>
                    </div>
                </div>
                <h4 style="margin-top: 15px; margin-bottom: 10px; color: #495057;">Speaker Participation</h4>
                <div style="space-y: 8px;">
        `;
        
        sortedSpeakers.slice(0, 5).forEach(([speaker, stats]) => {
            const percentage = stats.wordPercentage;
            analyticsHTML += `
                <div style="margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                        <span style="font-size: 14px; color: #495057;">${escapeHtml(speaker)}</span>
                        <span style="font-size: 12px; color: #6c757d;">${stats.wordCount} words (${percentage}%)</span>
                    </div>
                    <div style="background: #e9ecef; border-radius: 4px; height: 20px; overflow: hidden;">
                        <div style="background: linear-gradient(90deg, #17a2b8, #28a745); height: 100%; width: ${percentage}%; transition: width 0.3s ease;"></div>
                    </div>
                </div>
            `;
        });
        
        if (sortedSpeakers.length > 5) {
            analyticsHTML += `<div style="font-size: 12px; color: #6c757d; margin-top: 8px;">...and ${sortedSpeakers.length - 5} more speakers</div>`;
        }
        
        analyticsHTML += `
                </div>
        `;
        
        // Update existing analytics or create new one
        const container = document.getElementById('captions-container');
        
        if (analyticsContainer) {
            // Update existing analytics
            analyticsContainer.innerHTML = analyticsHTML;
        } else {
            // Create new analytics container
            analyticsContainer = document.createElement('div');
            analyticsContainer.id = 'meeting-analytics';
            analyticsContainer.style.cssText = 'background: #f8f9fa; padding: 15px; margin-bottom: 20px; border-radius: 8px; border: 1px solid #dee2e6;';
            analyticsContainer.innerHTML = analyticsHTML;
            container.parentNode.insertBefore(analyticsContainer, container);
        }
    }
    
    // --- Keyboard Shortcuts ---
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + F for search focus
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            searchBox.focus();
        }
        
        // Escape to clear search
        if (e.key === 'Escape' && document.activeElement === searchBox) {
            searchBox.value = '';
            applyFilters();
        }
    });

    initialize();
});