// == MS Teams Live Captions Saver (Console Edition) v2.0 ==
//
// HOW TO USE:
// 1. In a Microsoft Teams meeting in your browser (Chrome, Edge, Firefox).
// 2. Open the Developer Tools (press F12 or Ctrl+Shift+I).
// 3. Go to the "Console" tab.
// 4. (Optional) To try the auto-enable feature, change the line below to `true`.
// 5. Copy this entire script and paste it into the console, then press Enter.
//
// NEW FEATURES v2.0:
// - Attendee tracking with join/leave times
// - Speaker aliasing system to rename speakers
// - Enhanced duplicate prevention with debouncing
//
(() => {
    // --- CONFIGURATION ---
    const AUTO_ENABLE_CAPTIONS_EXPERIMENTAL = true; // Change to `false` to disable

    // --- PREVENT DUPLICATE EXECUTION ---
    if (document.getElementById('teams-caption-saver-ui')) {
        alert("Caption Saver is already running. Please use the existing control panel or refresh the page to start over.");
        return;
    }

    // --- SCRIPT STATE ---
    const transcriptArray = [];
    const attendeesList = new Map(); // Track unique attendees
    const attendeesHistory = []; // Track join/leave events
    const speakerAliases = new Map(); // Store speaker name mappings
    let capturing = false;
    let meetingTitleOnStart = '';
    let recordingStartTime = null;
    let observer = null;
    let attendeeObserver = null;
    let observedElement = null;
    let mainLoopInterval = null;
    let hasAttemptedAutoEnable = false;
    
    // Debouncing state for captions
    let captionDebounceTimer = null;
    const pendingCaptions = new Map();
    const DEBOUNCE_DELAY = 500; // milliseconds

    // --- CORE LOGIC ---
    const SELECTORS = {
        // Updated to match the extension's selectors
        CAPTIONS_RENDERER: "[data-tid='closed-caption-v2-window-wrapper'], [data-tid='closed-captions-renderer'], [data-tid*='closed-caption']",
        CHAT_MESSAGE: '.fui-ChatMessageCompact, .fui-ChatMessageContent__root',
        AUTHOR: '[data-tid="author"]',
        CAPTION_TEXT: '[data-tid="closed-caption-text"]',
        LEAVE_BUTTONS: [
            "button[data-tid='hangup-main-btn']",
            "button[data-tid='hangup-leave-button']",
            "button[data-tid='hangup-end-meeting-button']",
            "button[data-tid='hangup-button']",
            "button[data-tid='anon-hangup-button']",
            "div#hangup-button button",
            "#hangup-button"
        ].join(','),
        MORE_BUTTON: "button[data-tid='more-button'], button[id='callingButtons-showMoreBtn']",
        MORE_BUTTON_EXPANDED: "button[data-tid='more-button'][aria-expanded='true'], button[id='callingButtons-showMoreBtn'][aria-expanded='true']",
        LANGUAGE_SPEECH_BUTTON: "div[id='LanguageSpeechMenuControl-id']",
        TURN_ON_CAPTIONS_BUTTON: "div[id='closed-captions-button']",
        CAPTIONS_BUTTON: "button[id='captions-button'], button[data-tid='cc-toggle-button']",
        ROSTER_BUTTON: "button[data-tid='calling-toolbar-people-button'], button[id='roster-button']",
        AVATAR_LIST: '.fui-AvatarList',
        MEETING_HEADING: 'span.heading-18',
        ROSTER_PANEL: '[role="tabpanel"][aria-label*="Roster"]',
        ATTENDEE_TREE: "[role='tree'][aria-label='Attendees']",
        ATTENDEE_ITEM: "[data-tid^='participantsInCall-']"
    };

    // --- ATTENDEE TRACKING ---
    function trackAttendees() {
        const avatarLists = document.querySelectorAll(SELECTORS.AVATAR_LIST);
        const currentAttendees = new Set();
        
        avatarLists.forEach(list => {
            const heading = list.closest('div')?.querySelector(SELECTORS.MEETING_HEADING);
            if (heading && heading.textContent.includes('In this meeting')) {
                const avatars = list.querySelectorAll('li[role="listitem"]');
                avatars.forEach(avatar => {
                    const nameEl = avatar.querySelector('[class*="fui-Tooltip"]');
                    if (nameEl) {
                        const name = nameEl.getAttribute('aria-label') || nameEl.textContent;
                        if (name && name.trim()) {
                            const cleanName = name.trim();
                            currentAttendees.add(cleanName);
                            
                            if (!attendeesList.has(cleanName)) {
                                attendeesList.set(cleanName, {
                                    name: cleanName,
                                    joinTime: new Date().toLocaleTimeString(),
                                    leaveTime: null
                                });
                                attendeesHistory.push({
                                    type: 'join',
                                    name: cleanName,
                                    time: new Date().toLocaleTimeString()
                                });
                                console.log(`Attendee joined: ${cleanName}`);
                            }
                        }
                    }
                });
            }
        });
        
        // Check for attendees who left
        attendeesList.forEach((data, name) => {
            if (!currentAttendees.has(name) && !data.leaveTime) {
                data.leaveTime = new Date().toLocaleTimeString();
                attendeesHistory.push({
                    type: 'leave',
                    name: name,
                    time: new Date().toLocaleTimeString()
                });
                console.log(`Attendee left: ${name}`);
            }
        });
    }

    function startAttendeeTracking() {
        const rosterContainer = document.querySelector('[role="tabpanel"][aria-label*="Roster"]');
        if (rosterContainer && !attendeeObserver) {
            attendeeObserver = new MutationObserver(() => {
                trackAttendees();
            });
            attendeeObserver.observe(rosterContainer, { 
                childList: true, 
                subtree: true,
                attributes: true,
                attributeFilter: ['aria-label']
            });
            trackAttendees(); // Initial scan
        }
    }

    function stopAttendeeTracking() {
        if (attendeeObserver) {
            attendeeObserver.disconnect();
            attendeeObserver = null;
        }
    }

    // --- SPEAKER ALIASING ---
    function applySpeakerAlias(name) {
        return speakerAliases.get(name) || name;
    }

    function setSpeakerAlias(originalName, aliasName) {
        if (aliasName && aliasName.trim()) {
            speakerAliases.set(originalName, aliasName.trim());
            // Update existing transcript entries
            transcriptArray.forEach(entry => {
                if (entry.OriginalName === originalName) {
                    entry.Name = aliasName.trim();
                }
            });
            console.log(`Alias set: "${originalName}" → "${aliasName.trim()}"`);
        } else {
            speakerAliases.delete(originalName);
            // Restore original names in transcript
            transcriptArray.forEach(entry => {
                if (entry.OriginalName === originalName) {
                    entry.Name = originalName;
                }
            });
            console.log(`Alias removed for: "${originalName}"`);
        }
        updateUIMessage();
    }

    // --- ENHANCED CAPTION PROCESSING WITH DEBOUNCING ---
    function processCaptionUpdates() {
        const container = document.querySelector(SELECTORS.CAPTIONS_RENDERER);
        if (!container) return;
        
        container.querySelectorAll(SELECTORS.CHAT_MESSAGE).forEach(element => {
            const authorEl = element.querySelector(SELECTORS.AUTHOR);
            const textEl = element.querySelector(SELECTORS.CAPTION_TEXT);
            
            // Debug logging to see what we're finding
            if (!authorEl) {
                console.debug("No author element found in caption element:", element);
            }
            if (!textEl) {
                console.debug("No text element found in caption element:", element);
            }
            
            if (!authorEl || !textEl) return;
            
            const originalName = authorEl.innerText?.trim() || authorEl.textContent?.trim() || "Unknown Speaker";
            const text = textEl.innerText?.trim() || textEl.textContent?.trim() || "";
            
            if (text.length === 0) return;
            
            // Log speaker name for debugging
            console.debug(`Captured speaker: "${originalName}", text: "${text.substring(0, 50)}..."`)
            
            // Generate a unique key for this caption element
            let captionId = element.getAttribute('data-caption-id-script');
            if (!captionId) {
                captionId = `caption_${Date.now()}_${Math.random()}`;
                element.setAttribute('data-caption-id-script', captionId);
            }
            
            // Store in pending captions for debouncing
            pendingCaptions.set(captionId, {
                originalName,
                text,
                element
            });
        });
        
        // Debounce the actual processing
        if (captionDebounceTimer) {
            clearTimeout(captionDebounceTimer);
        }
        
        captionDebounceTimer = setTimeout(() => {
            processPendingCaptions();
        }, DEBOUNCE_DELAY);
    }

    function processPendingCaptions() {
        const time = new Date().toLocaleTimeString();
        
        pendingCaptions.forEach((captionData, captionId) => {
            const { originalName, text } = captionData;
            const aliasedName = applySpeakerAlias(originalName);
            
            // Check if this caption already exists
            const existingIndex = transcriptArray.findIndex(e => e.key === captionId);
            
            if (existingIndex !== -1) {
                // Update existing caption if text changed
                if (transcriptArray[existingIndex].Text !== text) {
                    transcriptArray[existingIndex].Text = text;
                    transcriptArray[existingIndex].Time = time;
                    transcriptArray[existingIndex].Name = aliasedName;
                }
            } else {
                // Check for duplicate text from same speaker within last few entries
                const recentDuplicateIndex = findRecentDuplicate(originalName, text, 5);
                
                if (recentDuplicateIndex === -1) {
                    // Add new caption
                    transcriptArray.push({ 
                        Name: aliasedName,
                        OriginalName: originalName,
                        Text: text, 
                        Time: time, 
                        key: captionId 
                    });
                }
            }
        });
        
        pendingCaptions.clear();
        updateUIMessage();
    }

    function findRecentDuplicate(speaker, text, lookback = 5) {
        const startIndex = Math.max(0, transcriptArray.length - lookback);
        for (let i = transcriptArray.length - 1; i >= startIndex; i--) {
            if (transcriptArray[i].OriginalName === speaker && 
                transcriptArray[i].Text === text) {
                return i;
            }
        }
        return -1;
    }

    function ensureObserverIsActive() {
        if (!capturing) return;
        const captionContainer = document.querySelector(SELECTORS.CAPTIONS_RENDERER);
        if (!captionContainer || captionContainer !== observedElement) {
            if (observer) observer.disconnect();
            if (captionContainer) {
                observer = new MutationObserver(processCaptionUpdates);
                observer.observe(captionContainer, { childList: true, subtree: true, characterData: true });
                observedElement = captionContainer;
                processCaptionUpdates();
            } else {
                observedElement = null;
            }
        }
    }

    async function startCaptureSession() {
        if (capturing) return;
        capturing = true;
        meetingTitleOnStart = document.title;
        recordingStartTime = new Date();
        console.log("Caption capture STARTED.");
        updateUIMessage();
        ensureObserverIsActive();
        
        // Try to open roster panel for attendee tracking after short delay
        setTimeout(async () => {
            await openRosterPanel();
            startAttendeeTracking();
        }, 1500);
    }

    function stopCaptureSession() {
        if (!capturing) return;
        capturing = false;
        if (observer) observer.disconnect();
        if (captionDebounceTimer) {
            clearTimeout(captionDebounceTimer);
            processPendingCaptions(); // Process any pending captions
        }
        observer = null;
        observedElement = null;
        stopAttendeeTracking();
        console.log("Caption capture STOPPED. Data is preserved for download.");
        updateUIMessage();
    }

    // --- AUTO-ENABLE FEATURE ---
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    async function attemptAutoEnableCaptions() {
        hasAttemptedAutoEnable = true;
        const statusEl = document.getElementById('tcs-status');
        if (statusEl) {
            statusEl.textContent = `⚙️ Attempting to auto-enable captions...`;
            statusEl.style.color = '#ffc107';
        }
        console.log("Attempting to auto-enable captions...");
        
        try {
            // Step 1: Find and click the More button
            const moreButton = document.querySelector(SELECTORS.MORE_BUTTON);
            if (!moreButton) {
                console.log("Could not find More button.");
                return;
            }
            
            // Check if More menu is already expanded
            const isExpanded = document.querySelector(SELECTORS.MORE_BUTTON_EXPANDED);
            if (!isExpanded) {
                console.log("Clicking More button...");
                moreButton.click();
                await delay(400);
            }
            
            // Step 2: Click Language and speech
            const langAndSpeechButton = document.querySelector(SELECTORS.LANGUAGE_SPEECH_BUTTON);
            if (!langAndSpeechButton) {
                console.log("Could not find 'Language and speech' button. Looking for alternative...");
                // Try alternative: look for any menu item with "Language" or "Speech" text
                const menuItems = document.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"], button[class*="menu"]');
                const langItem = Array.from(menuItems).find(item => 
                    item.textContent && (
                        item.textContent.includes('Language') || 
                        item.textContent.includes('speech') ||
                        item.textContent.includes('Speech')
                    )
                );
                if (langItem) {
                    console.log("Found alternative language menu item, clicking...");
                    langItem.click();
                    await delay(400);
                } else {
                    console.log("Could not find Language and speech option.");
                    // Try to close the menu
                    const expandedMore = document.querySelector(SELECTORS.MORE_BUTTON_EXPANDED);
                    if (expandedMore) expandedMore.click();
                    return;
                }
            } else {
                console.log("Clicking Language and speech...");
                langAndSpeechButton.click();
                await delay(400);
            }
            
            // Step 3: Click Turn on live captions
            const turnOnCaptionsButton = document.querySelector(SELECTORS.TURN_ON_CAPTIONS_BUTTON);
            if (!turnOnCaptionsButton) {
                console.log("Could not find 'Turn on live captions' button. Looking for alternative...");
                // Try alternative: look for any element with "caption" text
                const captionElements = document.querySelectorAll('div[role="menuitem"], button, div[class*="menu"]');
                const captionItem = Array.from(captionElements).find(item => 
                    item.textContent && (
                        item.textContent.includes('Turn on live captions') || 
                        item.textContent.includes('Live captions') ||
                        item.textContent.includes('Captions')
                    )
                );
                if (captionItem) {
                    console.log("Found alternative caption item, clicking...");
                    captionItem.click();
                    await delay(400);
                } else {
                    console.log("Could not find caption option.");
                }
            } else {
                console.log("Clicking 'Turn on live captions'...");
                turnOnCaptionsButton.click();
                await delay(400);
            }
            
            // Step 4: Close the More menu
            const expandedMoreButton = document.querySelector(SELECTORS.MORE_BUTTON_EXPANDED);
            if (expandedMoreButton) {
                console.log("Closing More menu...");
                expandedMoreButton.click();
            }
            
            // Verify captions are now enabled
            await delay(1000);
            if (document.querySelector(SELECTORS.CAPTIONS_RENDERER)) {
                console.log("✅ Captions successfully enabled!");
                if (statusEl) {
                    statusEl.textContent = `✅ Captions enabled!`;
                    statusEl.style.color = '#28a745';
                }
            } else {
                console.log("Captions not detected after auto-enable attempt.");
                if (statusEl) {
                    statusEl.textContent = `⚠️ Could not auto-enable captions`;
                    statusEl.style.color = '#ffc107';
                }
            }
        } catch (e) {
            console.error("Auto-enable FAILED:", e);
            if (statusEl) {
                statusEl.textContent = `❌ Auto-enable failed`;
                statusEl.style.color = '#dc3545';
            }
            updateUIMessage();
        }
    }
    
    async function openRosterPanel() {
        try {
            // Check if roster is already open
            if (document.querySelector(SELECTORS.ROSTER_PANEL)) {
                console.log("Roster panel already open.");
                return;
            }
            
            // Try to find and click the roster/people button
            const rosterButton = document.querySelector(SELECTORS.ROSTER_BUTTON);
            if (rosterButton) {
                console.log("Opening roster panel...");
                rosterButton.click();
                await delay(500);
            } else {
                console.log("Could not find roster button.");
            }
        } catch (e) {
            console.error("Failed to open roster:", e);
        }
    }
    
    // --- UI and Actions ---
    function injectUI() {
        function createElement(tag, options = {}) {
            const el = document.createElement(tag);
            if (options.id) el.id = options.id;
            if (options.className) el.className = options.className;
            if (options.text) el.textContent = options.text;
            if (options.css) Object.assign(el.style, options.css);
            if (options.attributes) {
                for (const [key, value] of Object.entries(options.attributes)) {
                    el.setAttribute(key, value);
                }
            }
            return el;
        }

        const uiContainer = createElement('div', {
            id: 'teams-caption-saver-ui',
            css: {
                position: 'fixed', top: '20px', right: '20px', zIndex: '99999',
                backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #ccc',
                borderRadius: '8px', padding: '15px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                width: '360px', cursor: 'move', userSelect: 'none', maxHeight: '85vh', overflow: 'visible'
            }
        });

        const title = createElement('div', { text: 'Teams Caption Saver v2.0', css: { fontWeight: 'bold', fontSize: '16px', marginBottom: '10px', textAlign: 'center', color: '#333' } });

        const status = createElement('div', {
            id: 'tcs-status', text: 'Initializing...',
            css: { fontSize: '14px', marginBottom: '15px', textAlign: 'center', color: '#555', minHeight: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'pre-wrap' }
        });

        // Attendees section
        const attendeesSection = createElement('div', {
            id: 'tcs-attendees-section',
            css: { marginBottom: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px', display: 'none' }
        });
        
        const attendeesTitle = createElement('div', { 
            css: { marginBottom: '8px', fontSize: '14px', color: '#495057' }
        });
        
        // Create attendees title with safe DOM manipulation
        const attendeesIcon = document.createTextNode('👥 ');
        const attendeesLabel = document.createElement('strong');
        attendeesLabel.textContent = 'Attendees';
        const attendeesCountText = document.createTextNode(' (');
        const attendeesCount = document.createElement('span');
        attendeesCount.id = 'tcs-attendee-count';
        attendeesCount.textContent = '0';
        const attendeesCloseParen = document.createTextNode(')');
        
        attendeesTitle.appendChild(attendeesIcon);
        attendeesTitle.appendChild(attendeesLabel);
        attendeesTitle.appendChild(attendeesCountText);
        attendeesTitle.appendChild(attendeesCount);
        attendeesTitle.appendChild(attendeesCloseParen);
        
        const attendeesList = createElement('div', {
            id: 'tcs-attendees-list',
            css: { fontSize: '12px', color: '#6c757d', maxHeight: '120px', overflowY: 'auto' }
        });
        
        attendeesSection.appendChild(attendeesTitle);
        attendeesSection.appendChild(attendeesList);

        // Speaker aliases section
        const aliasSection = createElement('div', {
            css: { marginBottom: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }
        });
        
        const aliasTitle = createElement('div', { 
            text: '🏷️ Speaker Aliases',
            css: { marginBottom: '8px', fontSize: '14px', fontWeight: 'bold', color: '#495057' }
        });
        
        const aliasButton = createElement('button', {
            id: 'tcs-alias-btn', text: 'Manage Aliases',
            css: { width: '100%', backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '6px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }
        });
        
        const aliasesContainer = createElement('div', {
            id: 'tcs-aliases-container',
            css: { display: 'none', marginTop: '10px', fontSize: '12px' }
        });
        
        aliasSection.appendChild(aliasTitle);
        aliasSection.appendChild(aliasButton);
        aliasSection.appendChild(aliasesContainer);

        const buttonRow = createElement('div', { css: { display: 'flex', gap: '10px', marginBottom: '10px' } });

        // --- Create Split Buttons ---
        const formats = [
            { label: 'as TXT', type: 'txt' },
            { label: 'as Markdown', type: 'md' },
            { label: 'as JSON', type: 'json' },
            { label: 'as YAML', type: 'yaml' }
        ];

        // SAVE BUTTON
        const saveSplitButton = createSplitButton('Save', formats, (format) => downloadTranscript(format));
        buttonRow.appendChild(saveSplitButton);
        
        // COPY BUTTON
        const copySplitButton = createSplitButton('Copy', formats, (format) => copyTranscript(format));
        buttonRow.appendChild(copySplitButton);

        const closeButton = createElement('button', {
            id: 'tcs-close', text: 'Close & Clean Up',
            css: { width: '100%', backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '8px', borderRadius: '4px', fontSize: '13px', cursor: 'pointer' }
        });
        closeButton.addEventListener('click', cleanUp);

        // Alias button handler
        aliasButton.addEventListener('click', () => {
            const container = document.getElementById('tcs-aliases-container');
            if (container.style.display === 'none') {
                showAliasManager();
                container.style.display = 'block';
                aliasButton.textContent = 'Hide Aliases';
            } else {
                container.style.display = 'none';
                aliasButton.textContent = 'Manage Aliases';
            }
        });

        // Create a scrollable content wrapper for sections that might overflow
        const scrollableContent = createElement('div', {
            css: { 
                maxHeight: 'calc(85vh - 200px)', 
                overflowY: 'auto',
                marginBottom: '10px'
            }
        });
        
        scrollableContent.appendChild(attendeesSection);
        scrollableContent.appendChild(aliasSection);
        
        uiContainer.appendChild(title);
        uiContainer.appendChild(status);
        uiContainer.appendChild(scrollableContent);
        uiContainer.appendChild(buttonRow);
        uiContainer.appendChild(closeButton);
        document.body.appendChild(uiContainer);

        const style = createElement('style', {
            text: `
                .tcs-split-button { position: relative; display: flex; flex-grow: 1; }
                .tcs-main-btn { flex-grow: 1; background-color: #0078d4; color: white; border: none; padding: 10px; border-radius: 4px 0 0 4px; font-size: 14px; cursor: pointer; transition: background-color 0.2s; }
                .tcs-dropdown-btn { background-color: #0078d4; color: white; border: none; border-left: 1px solid rgba(255,255,255,0.3); padding: 10px 8px; border-radius: 0 4px 4px 0; cursor: pointer; transition: background-color 0.2s; }
                .tcs-main-btn:hover, .tcs-dropdown-btn:hover { background-color: #005a9e; }
                .tcs-main-btn:disabled, .tcs-dropdown-btn:disabled { background-color: #ccc !important; cursor: not-allowed; }
                .tcs-options { display: none; position: fixed; background-color: white; border: 1px solid #ccc; border-radius: 4px; box-shadow: 0 4px 8px rgba(0,0,0,0.2); z-index: 100000; overflow: hidden; box-sizing: border-box; }
                .tcs-option { display: block; padding: 10px 15px; color: black; text-decoration: none; font-size: 13px; cursor: pointer; }
                .tcs-option:hover { background-color: #f0f0f0; }
                #tcs-close:hover { background-color: #c82333; }
                #tcs-alias-btn:hover { background-color: #5a6268; }
                .tcs-alias-row { display: flex; gap: 5px; margin-bottom: 5px; align-items: center; background-color: white; padding: 3px; border-radius: 3px; }
                .tcs-alias-row span { color: #333 !important; }
                .tcs-alias-input { flex: 1; padding: 4px; border: 1px solid #ced4da; border-radius: 3px; font-size: 11px; color: #000 !important; background-color: #fff !important; }
                .tcs-alias-input::placeholder { color: #999; }
                .tcs-alias-save { padding: 4px 8px; background-color: #28a745; color: white; border: none; border-radius: 3px; font-size: 11px; cursor: pointer; }
                .tcs-alias-save:hover { background-color: #218838; }
            `
        });
        document.head.appendChild(style);

        // Close dropdowns when clicking elsewhere
        document.addEventListener('click', (e) => {
            document.querySelectorAll('.tcs-options').forEach(el => {
                if (!el.parentElement.contains(e.target)) {
                    el.style.display = 'none';
                }
            });
        });

        // Draggable logic
        let isDragging = false, offsetX, offsetY;
        uiContainer.addEventListener('mousedown', (e) => { 
            if (e.target.closest('button') || e.target.closest('input')) return; 
            isDragging = true; 
            offsetX = e.clientX - uiContainer.getBoundingClientRect().left; 
            offsetY = e.clientY - uiContainer.getBoundingClientRect().top; 
            uiContainer.style.transition = 'none'; 
        });
        document.addEventListener('mousemove', (e) => { 
            if (!isDragging) return; 
            uiContainer.style.left = `${e.clientX - offsetX}px`; 
            uiContainer.style.top = `${e.clientY - offsetY}px`; 
        });
        document.addEventListener('mouseup', () => { 
            isDragging = false; 
            uiContainer.style.transition = ''; 
        });
    }

    function showAliasManager() {
        const container = document.getElementById('tcs-aliases-container');
        // Clear existing content safely
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
        
        // Get unique speakers from transcript
        const speakers = new Set();
        transcriptArray.forEach(entry => {
            speakers.add(entry.OriginalName || entry.Name);
        });
        
        if (speakers.size === 0) {
            const noSpeakersDiv = document.createElement('div');
            noSpeakersDiv.style.color = '#6c757d';
            noSpeakersDiv.style.textAlign = 'center';
            noSpeakersDiv.textContent = 'No speakers detected yet';
            container.appendChild(noSpeakersDiv);
            return;
        }
        
        speakers.forEach(speaker => {
            const row = document.createElement('div');
            row.className = 'tcs-alias-row';
            
            const label = document.createElement('span');
            label.textContent = speaker + ':';
            label.style.minWidth = '100px';
            label.style.fontSize = '11px';
            label.style.color = '#333'; // Ensure text is visible
            label.style.fontWeight = '500'; // Make it slightly bolder
            
            const input = document.createElement('input');
            input.className = 'tcs-alias-input';
            input.placeholder = 'Enter alias';
            input.value = speakerAliases.get(speaker) || '';
            input.style.color = '#000'; // Ensure input text is black
            input.style.backgroundColor = '#fff'; // White background
            
            const saveBtn = document.createElement('button');
            saveBtn.className = 'tcs-alias-save';
            saveBtn.textContent = 'Set';
            saveBtn.onclick = () => {
                setSpeakerAlias(speaker, input.value);
                saveBtn.textContent = '✓';
                setTimeout(() => { saveBtn.textContent = 'Set'; }, 1000);
            };
            
            row.appendChild(label);
            row.appendChild(input);
            row.appendChild(saveBtn);
            container.appendChild(row);
        });
    }

    function createSplitButton(baseLabel, formats, actionCallback) {
        function createElement(tag, options = {}) {
            const el = document.createElement(tag);
            if (options.id) el.id = options.id;
            if (options.className) el.className = options.className;
            if (options.text) el.textContent = options.text;
            if (options.css) Object.assign(el.style, options.css);
            return el;
        }

        const container = createElement('div', { className: 'tcs-split-button' });
        const mainBtn = createElement('button', { className: 'tcs-main-btn', text: `${baseLabel} ${formats[0].label}` });
        const dropdownBtn = createElement('button', { className: 'tcs-dropdown-btn', text: '▾' });
        const optionsDiv = createElement('div', { className: 'tcs-options' });

        mainBtn.addEventListener('click', () => actionCallback(formats[0].type));
        
        dropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (optionsDiv.style.display === 'block') {
                optionsDiv.style.display = 'none';
            } else {
                // Position the dropdown relative to the button
                const containerRect = container.getBoundingClientRect();
                const btnRect = dropdownBtn.getBoundingClientRect();
                optionsDiv.style.top = (btnRect.bottom + 2) + 'px';
                optionsDiv.style.left = containerRect.left + 'px'; // Align with container left edge
                optionsDiv.style.width = containerRect.width + 'px'; // Match container width
                optionsDiv.style.display = 'block';
            }
        });

        formats.forEach(format => {
            const option = createElement('a', { className: 'tcs-option', text: `${baseLabel} ${format.label}` });
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                mainBtn.textContent = `${baseLabel} ${format.label}`;
                actionCallback(format.type);
                optionsDiv.style.display = 'none';
            });
            optionsDiv.appendChild(option);
        });

        container.appendChild(mainBtn);
        container.appendChild(dropdownBtn);
        // Append dropdown to body for proper positioning
        document.body.appendChild(optionsDiv);
        
        // Store reference for cleanup
        container.dataset.optionsId = 'options-' + Math.random().toString(36).substr(2, 9);
        optionsDiv.dataset.parentId = container.dataset.optionsId;
        
        return container;
    }

    function updateUIMessage() {
        const statusEl = document.getElementById('tcs-status');
        const buttons = document.querySelectorAll('.tcs-main-btn, .tcs-dropdown-btn');
        const attendeesSection = document.getElementById('tcs-attendees-section');
        const attendeeCount = document.getElementById('tcs-attendee-count');
        const attendeesListEl = document.getElementById('tcs-attendees-list');
        
        if (!statusEl) return;

        // Update attendees display
        if (attendeesList.size > 0 && attendeesSection) {
            attendeesSection.style.display = 'block';
            attendeeCount.textContent = attendeesList.size;
            
            const attendeesArray = Array.from(attendeesList.values());
            // Clear existing content safely
            attendeesListEl.textContent = '';
            // Add each attendee as a separate div element
            attendeesArray.forEach(a => {
                const attendeeDiv = document.createElement('div');
                const status = a.leaveTime ? ` (left ${a.leaveTime})` : ' ✓';
                attendeeDiv.textContent = a.name + status;
                attendeesListEl.appendChild(attendeeDiv);
            });
        }

        if (capturing) {
            const aliasCount = speakerAliases.size > 0 ? ` | ${speakerAliases.size} aliases` : '';
            statusEl.textContent = `✅ Capturing...\n(${transcriptArray.length} lines${aliasCount})`;
            statusEl.style.color = '#28a745';
        } else if (document.querySelector(SELECTORS.LEAVE_BUTTONS)) {
            statusEl.textContent = `⚠️ In meeting, but captions are off.\n(Turn them on to start capture)`;
            statusEl.style.color = '#ffc107';
        } else {
            statusEl.textContent = `Not in a meeting.\n${transcriptArray.length > 0 ? `(${transcriptArray.length} lines available)` : ''}`;
            statusEl.style.color = '#6c757d';
        }
        
        const hasData = transcriptArray.length > 0;
        buttons.forEach(btn => btn.disabled = !hasData);
    }
    
    // --- FORMATTING & ACTIONS ---
    function formatTranscript(format) {
        const cleanTranscript = transcriptArray.map(({ key, OriginalName, ...rest }) => rest);
        let content;
        
        // Add attendees info header for all formats
        const attendeesHeader = attendeesList.size > 0 ? 
            `Attendees (${attendeesList.size}):\n${Array.from(attendeesList.values()).map(a => 
                `- ${a.name} (joined: ${a.joinTime}${a.leaveTime ? `, left: ${a.leaveTime}` : ''})`
            ).join('\n')}\n\n---\n\n` : '';
        
        switch(format) {
            case 'txt':
                content = attendeesHeader + cleanTranscript.map(e => `[${e.Time}] ${e.Name}: ${e.Text}`).join('\n');
                break;
            case 'md':
                let lastSpeaker = null;
                const transcriptMd = cleanTranscript.map(e => {
                    if (e.Name !== lastSpeaker) {
                        lastSpeaker = e.Name;
                        return `\n**${e.Name}** (${e.Time}):\n> ${e.Text}`;
                    }
                    return `> ${e.Text}`;
                }).join('\n').trim();
                content = attendeesHeader.replace(/---/g, '___') + transcriptMd;
                break;
            case 'json':
                const jsonData = {
                    meetingTitle: meetingTitleOnStart,
                    recordingStartTime: recordingStartTime,
                    attendees: Array.from(attendeesList.values()),
                    attendeesHistory: attendeesHistory,
                    transcript: cleanTranscript
                };
                content = JSON.stringify(jsonData, null, 2);
                break;
            case 'yaml':
                const yamlAttendees = attendeesList.size > 0 ?
                    `attendees:\n${Array.from(attendeesList.values()).map(a => 
                        `  - name: ${a.name}\n    joinTime: ${a.joinTime}${a.leaveTime ? `\n    leaveTime: ${a.leaveTime}` : ''}`
                    ).join('\n')}\n\n` : '';
                const yamlTranscript = cleanTranscript.map(e => 
                    `-\n  Name: ${e.Name}\n  Text: ${e.Text}\n  Time: ${e.Time}`
                ).join('\n');
                content = yamlAttendees + 'transcript:\n' + yamlTranscript;
                break;
        }
        return content;
    }

    async function copyTranscript(format) {
        if (transcriptArray.length === 0) {
            alert("No captions were captured to copy.");
            return;
        }
        const content = formatTranscript(format);
        try {
            await navigator.clipboard.writeText(content);
            const statusEl = document.getElementById('tcs-status');
            const originalText = statusEl.textContent;
            statusEl.textContent = 'Copied to clipboard!';
            statusEl.style.color = '#28a745';
            setTimeout(() => {
                statusEl.textContent = originalText;
                updateUIMessage();
            }, 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
            alert('Failed to copy text to clipboard.');
        }
    }

    function downloadTranscript(format) {
        if (transcriptArray.length === 0) {
            alert("No captions were captured to download.");
            return;
        }

        try {
            const content = formatTranscript(format);
            const meetingName = (meetingTitleOnStart.split('|')[0] || "Meeting").trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
            const date = recordingStartTime || new Date();
            const datePrefix = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            
            let mimeType, extension;
            switch(format) {
                case 'txt': mimeType = 'text/plain'; extension = 'txt'; break;
                case 'md': mimeType = 'text/markdown'; extension = 'md'; break;
                case 'json': mimeType = 'application/json'; extension = 'json'; break;
                case 'yaml': mimeType = 'application/x-yaml'; extension = 'yaml'; break;
                default: mimeType = 'text/plain'; extension = 'txt';
            }

            const filename = `${datePrefix} - ${meetingName}.${extension}`;
            
            // Use Blob for better compatibility
            const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
            const url = URL.createObjectURL(blob);
            
            const downloadNode = document.createElement('a');
            downloadNode.href = url;
            downloadNode.download = filename;
            downloadNode.style.display = 'none';
            document.body.appendChild(downloadNode);
            
            // Trigger download
            downloadNode.click();
            
            // Cleanup
            setTimeout(() => {
                document.body.removeChild(downloadNode);
                URL.revokeObjectURL(url);
            }, 100);
            
            console.log(`Downloaded: ${filename}`);
            
            // Visual feedback
            const statusEl = document.getElementById('tcs-status');
            if (statusEl) {
                const originalText = statusEl.textContent;
                statusEl.textContent = `Downloaded: ${filename}`;
                statusEl.style.color = '#28a745';
                setTimeout(() => {
                    statusEl.textContent = originalText;
                    updateUIMessage();
                }, 2000);
            }
        } catch (error) {
            console.error('Download failed:', error);
            alert('Failed to download transcript. Please try copying to clipboard instead.');
        }
    }

    // --- MAIN LOOP & CLEANUP ---
    async function main() {
        const inMeeting = !!document.querySelector(SELECTORS.LEAVE_BUTTONS);
        const captionsOn = !!document.querySelector(SELECTORS.CAPTIONS_RENDERER);

        if (inMeeting) {
            if (captionsOn) {
                await startCaptureSession();
            } else {
                stopCaptureSession();
                if (AUTO_ENABLE_CAPTIONS_EXPERIMENTAL && !hasAttemptedAutoEnable) {
                    await attemptAutoEnableCaptions();
                }
            }
        } else {
            stopCaptureSession();
            hasAttemptedAutoEnable = false;
        }
        ensureObserverIsActive();
    }

    function cleanUp() {
        stopCaptureSession();
        if (mainLoopInterval) clearInterval(mainLoopInterval);
        
        // Remove all dropdown menus
        document.querySelectorAll('.tcs-options').forEach(el => el.remove());
        
        const ui = document.getElementById('teams-caption-saver-ui');
        if (ui) ui.remove();
        const style = document.head.querySelector('style');
        if (style && style.textContent.includes('.tcs-split-button')) style.remove();
        console.log("Teams Caption Saver has been shut down and cleaned up.");
    }

    // --- SCRIPT INITIALIZATION ---
    injectUI();
    mainLoopInterval = setInterval(main, 3000);
    main();
    console.log("Teams Caption Saver v2.0 (Console Edition) is running with attendee tracking and speaker aliases!");

})();