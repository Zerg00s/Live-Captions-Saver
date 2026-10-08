// --- Constants ---
const TIMING = {
    BUTTON_CLICK_DELAY: 400,
    OBSERVER_CHECK_INTERVAL: 10000,
    ATTENDEE_UPDATE_INTERVAL: 60000, // Check attendees every minute
    INITIAL_ATTENDEE_DELAY: 1500, // Wait 1.5s after meeting start before first check
};

const SELECTORS = {
    // Caption window candidates, tried one at a time in this order. A comma-joined
    // list would return whichever element comes first in DOM order - in the 2026
    // captions redesign that is the toolbar's Captions control, not the caption panel.
    CAPTIONS_RENDERERS: [
        "[data-tid='closed-caption-renderer-wrapper']",   // 2026 redesign (panel + virtual list)
        "[data-tid='closed-caption-v2-window-wrapper']",
        "[data-tid='closed-captions-renderer']"
    ],
    // Last resort for unknown layouts; only accepted when it holds caption text
    CAPTIONS_RENDERER_LOOSE: "[data-tid*='closed-caption']",
    CHAT_MESSAGE: '.fui-ChatMessageCompact',
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
    // 2026 redesign: one Captions toggle - a toolbar <button> when pinned, otherwise a
    // menuitemcheckbox in the More menu. data-tid ends in "-on"/"-off" with its state.
    CAPTIONS_TOGGLE: "[id='closed-captions-button'][data-tid^='closed-captions-button-']",
    // Attendee tracking selectors
    ATTENDEE_TREE: "[role='tree'][aria-label='Attendees']",
    ATTENDEE_ITEM: "[data-tid^='participantsInCall-']",
    ATTENDEE_COUNT: "#roster-title-section-2",
    ATTENDEE_NAME: "[id^='roster-avatar-img-']",
    ATTENDEE_ROLE: "[data-tid='ts-roster-organizer-status']",
    PEOPLE_BUTTON: "button[data-tid='calling-toolbar-people-button'], button[id='roster-button']",
};

// --- State ---
const transcriptArray = [];
let capturing = false;
let meetingTitleOnStart = '';
let recordingStartTime = null;
let observer = null;
let observedElement = null;
let hasInitializedListeners = false;
let wasInMeeting = false;
let meetingObserver = null;
let captionsObserver = null;
let cachedElements = new Map();
let autoEnableInProgress = false;
let autoEnableLastAttempt = 0;
let autoEnableDebounceTimer = null;
let autoSaveTriggered = false;
let lastMeetingId = null;
let currentMeetingId = null;  // id of this meeting's record in IndexedDB (via service worker)
let lastFlushedCount = 0;     // caption count at the last flush, for growth-triggered flushes
let pendingResume = null;     // {id, normTitle, endedAt, silent} - last session ended in this page
const RESUME_WINDOW_MS = 10 * 60 * 1000; // how recent a previous session must be to offer a merge

// --- Attendee Tracking State ---
let attendeeUpdateInterval = null;
let backupInterval = null;
let attendeeData = {
    allAttendees: new Set(), // All unique attendees who joined
    currentAttendees: new Map(), // Currently in meeting (name -> role)
    attendeeHistory: [], // Detailed tracking with timestamps
    lastUpdated: null,
    meetingStartTime: null,
};

// --- Real-time Broadcasting ---
function broadcastCaptionUpdate(data) {
    try {
        chrome.runtime.sendMessage({
            message: "live_caption_update",
            ...data
        }).catch(() => {
            // Viewer might not be open, ignore error
        });
    } catch (error) {
        // Silent fail if no listeners
    }
}

// --- Error Handling & Logging ---
class ErrorHandler {
    static log(error, context = '', silent = false) {
        const timestamp = new Date().toISOString();
        const errorInfo = {
            timestamp,
            context,
            message: error.message || String(error),
            stack: error.stack,
            url: window.location.href
        };
        
        console.error(`[Teams Caption Saver] ${context}:`, errorInfo);
        
        if (!silent) {
            // Could send to analytics or show user notification
            chrome.runtime.sendMessage({
                message: "error_logged",
                error: errorInfo
            }).catch(() => {}); // Prevent recursive errors
        }
        
        return errorInfo;
    }
    
    static wrap(fn, context = '', fallback = null) {
        return async function(...args) {
            try {
                return await fn.apply(this, args);
            } catch (error) {
                ErrorHandler.log(error, context);
                return fallback;
            }
        };
    }
}

// --- Utility Functions ---
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getCleanTranscript = () => transcriptArray.map(({ key, ...rest }) => rest);

// --- DOM Element Caching ---
function getCachedElement(selector, expiry = 5000, resolve = () => document.querySelector(selector)) {
    const now = Date.now();
    const cached = cachedElements.get(selector);

    if (cached && (now - cached.timestamp) < expiry && document.contains(cached.element)) {
        return cached.element;
    }

    const element = resolve();
    if (element) {
        cachedElements.set(selector, { element, timestamp: now });
    }
    return element;
}

function clearElementCache() {
    cachedElements.clear();
}

function findCaptionsContainer() {
    for (const selector of SELECTORS.CAPTIONS_RENDERERS) {
        const element = document.querySelector(selector);
        if (element) return element;
    }
    // Unknown layout: take the outermost loose match that wraps real caption text
    const text = document.querySelector(SELECTORS.CAPTION_TEXT);
    let container = null;
    for (let el = text?.parentElement; el; el = el.parentElement) {
        if (el.matches(SELECTORS.CAPTIONS_RENDERER_LOOSE)) container = el;
    }
    return container;
}

const getCaptionsContainer = () => getCachedElement('captions-container', 5000, findCaptionsContainer);

// Captions only render inside a call, so a caption window also proves we are in a
// meeting - this keeps capture working if Teams renames the Leave button again.
const isUserInMeeting = () => getCachedElement(SELECTORS.LEAVE_BUTTONS) !== null || getCaptionsContainer() !== null;

// --- Core Logic ---
const processCaptionUpdates = ErrorHandler.wrap(function() {
    const closedCaptionsContainer = getCaptionsContainer();
    if (!closedCaptionsContainer) return;

    const transcriptElements = closedCaptionsContainer.querySelectorAll(SELECTORS.CHAT_MESSAGE);

    transcriptElements.forEach(element => {
        try {
            const authorElement = element.querySelector(SELECTORS.AUTHOR);
            const textElement = element.querySelector(SELECTORS.CAPTION_TEXT);

            if (!authorElement || !textElement) return;

            const name = authorElement.innerText.trim();
            const text = textElement.innerText.trim();
            if (text.length === 0) return;

            let captionId = element.getAttribute('data-caption-id');
            if (!captionId) {
                captionId = `caption_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                element.setAttribute('data-caption-id', captionId);
            }

            const existingIndex = transcriptArray.findIndex(entry => entry.key === captionId);
            const time = new Date().toLocaleTimeString();

            if (existingIndex !== -1) {
                // Update existing entry if text has changed
                if (transcriptArray[existingIndex].Text !== text) {
                    transcriptArray[existingIndex].Text = text;
                    transcriptArray[existingIndex].Time = time;
                    // Broadcast update to viewer
                    broadcastCaptionUpdate({
                        type: 'update',
                        caption: transcriptArray[existingIndex]
                    });
                }
            } else {
                // Add new entry
                const newCaption = { Name: name, Text: text, Time: time, key: captionId };
                transcriptArray.push(newCaption);
                // Broadcast new caption to viewer
                broadcastCaptionUpdate({
                    type: 'new',
                    caption: newCaption
                });
                // Flush early if the transcript grew a lot since the last flush
                if (transcriptArray.length - lastFlushedCount >= 25) {
                    flushMeetingSnapshot();
                }
            }
        } catch (error) {
            ErrorHandler.log(error, 'Processing individual caption element', true);
        }
    });
}, 'Caption updates processing');

// --- Attendee Tracking Functions ---
function updateAttendeesFromTranscript() {
    // Fallback method: Extract unique speakers from transcript
    const speakers = [...new Set(transcriptArray.map(item => item.Name))];
    const currentTime = new Date().toLocaleTimeString();
    
    speakers.forEach(name => {
        if (!attendeeData.allAttendees.has(name)) {
            attendeeData.allAttendees.add(name);
            attendeeData.currentAttendees.set(name, 'Speaker');
            
            attendeeData.attendeeHistory.push({
                name,
                role: 'Speaker',
                action: 'detected from transcript',
                time: currentTime
            });
            
            console.log(`Speaker detected from transcript: ${name}`);
        }
    });
    
    attendeeData.lastUpdated = currentTime;
    console.log(`Attendee update from transcript. Speakers found: ${speakers.length}`);
}
function updateAttendeeList() {
    try {
        const attendeeTree = document.querySelector(SELECTORS.ATTENDEE_TREE);
        if (!attendeeTree) {
            console.log("Attendee tree not found, roster might not be open");
            // Fallback: Add speakers from transcript as attendees
            updateAttendeesFromTranscript();
            return;
        }
        
        const attendeeItems = document.querySelectorAll(SELECTORS.ATTENDEE_ITEM);
        const currentTime = new Date().toLocaleTimeString();
        
        // Clear current attendees for fresh update
        const previousAttendees = new Set(attendeeData.currentAttendees.keys());
        attendeeData.currentAttendees.clear();
        
        // Process each attendee
        attendeeItems.forEach(item => {
            const nameElement = item.querySelector(SELECTORS.ATTENDEE_NAME);
            const roleElement = item.querySelector(SELECTORS.ATTENDEE_ROLE);
            
            if (nameElement) {
                const name = nameElement.textContent.trim();
                const role = roleElement ? roleElement.textContent.trim() : 'Attendee';
                
                // Add to current attendees
                attendeeData.currentAttendees.set(name, role);
                
                // Track in all attendees
                if (!attendeeData.allAttendees.has(name)) {
                    attendeeData.allAttendees.add(name);
                    
                    // Add to history as new join
                    attendeeData.attendeeHistory.push({
                        name,
                        role,
                        action: 'joined',
                        time: currentTime
                    });
                    
                    console.log(`New attendee detected: ${name} (${role})`);
                }
            }
        });
        
        // Check for attendees who left
        previousAttendees.forEach(name => {
            if (!attendeeData.currentAttendees.has(name)) {
                attendeeData.attendeeHistory.push({
                    name,
                    action: 'left',
                    time: currentTime
                });
                console.log(`Attendee left: ${name}`);
            }
        });
        
        attendeeData.lastUpdated = currentTime;
        
        // Get count from header
        const countElement = document.querySelector(SELECTORS.ATTENDEE_COUNT);
        if (countElement) {
            const countMatch = countElement.textContent.match(/\((\d+)\)/);
            if (countMatch) {
                console.log(`Total attendees in meeting: ${countMatch[1]}`);
            }
        }
        
        console.log(`Attendee update complete. Current: ${attendeeData.currentAttendees.size}, Total: ${attendeeData.allAttendees.size}`);
        
    } catch (error) {
        ErrorHandler.log(error, 'Updating attendee list', true);
    }
}

async function tryOpenParticipantPanel() {
    try {
        const peopleButton = document.querySelector(SELECTORS.PEOPLE_BUTTON);
        if (peopleButton && peopleButton.getAttribute('aria-pressed') !== 'true') {
            console.log("Attempting to open participant panel for attendee tracking...");
            peopleButton.click();
            await delay(500); // Wait for panel to open
            return true;
        }
        return false;
    } catch (error) {
        console.log("Could not open participant panel:", error);
        return false;
    }
}

async function startAttendeeTracking() {
    // Check if attendee tracking is enabled
    const { trackAttendees, autoOpenAttendees } = await chrome.storage.sync.get(['trackAttendees', 'autoOpenAttendees']);
    if (trackAttendees === false) {
        console.log("Attendee tracking is disabled in settings");
        return;
    }
    
    if (attendeeUpdateInterval) {
        clearInterval(attendeeUpdateInterval);
    }
    
    // Reset attendee data for new meeting
    attendeeData = {
        allAttendees: new Set(),
        currentAttendees: new Map(),
        attendeeHistory: [],
        lastUpdated: null,
        meetingStartTime: new Date().toISOString(),
    };
    
    console.log("Starting attendee tracking...");
    
    // Initial update after delay
    setTimeout(async () => {
        // Only auto-open participant panel if setting is enabled
        if (autoOpenAttendees) {
            await tryOpenParticipantPanel();
        }
        
        updateAttendeeList();
        
        // Then update every minute
        attendeeUpdateInterval = setInterval(updateAttendeeList, TIMING.ATTENDEE_UPDATE_INTERVAL);
    }, TIMING.INITIAL_ATTENDEE_DELAY);
}

function stopAttendeeTracking() {
    if (attendeeUpdateInterval) {
        clearInterval(attendeeUpdateInterval);
        attendeeUpdateInterval = null;
        console.log("Stopped attendee tracking");
    }
}

async function getAttendeeReport() {
    // Check if attendee tracking is enabled
    const { trackAttendees } = await chrome.storage.sync.get('trackAttendees');
    if (trackAttendees === false) {
        return null; // Return null if tracking is disabled
    }
    
    const report = {
        meetingStartTime: attendeeData.meetingStartTime,
        lastUpdated: attendeeData.lastUpdated,
        totalUniqueAttendees: attendeeData.allAttendees.size,
        currentAttendeeCount: attendeeData.currentAttendees.size,
        attendeeList: Array.from(attendeeData.allAttendees),
        currentAttendees: Array.from(attendeeData.currentAttendees.entries()).map(([name, role]) => ({
            name,
            role
        })),
        attendeeHistory: attendeeData.attendeeHistory
    };
    
    console.log("[Teams Caption Saver] Attendee report generated:", {
        totalAttendees: report.totalUniqueAttendees,
        attendees: report.attendeeList
    });
    
    return report;
}

// --- Event-Driven Meeting Detection ---
let meetingStateDebounceTimer = null;
let captionsStateDebounceTimer = null;

function setupMeetingObserver() {
    if (meetingObserver) return;
    
    meetingObserver = new MutationObserver(() => {
        // Debounce meeting state changes to prevent excessive calls
        if (meetingStateDebounceTimer) {
            clearTimeout(meetingStateDebounceTimer);
        }
        meetingStateDebounceTimer = setTimeout(() => {
            handleMeetingStateChange();
        }, 1000);
    });
    
    meetingObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributeFilter: ['data-tid']
    });
}

function setupCaptionsObserver() {
    if (captionsObserver) return;
    
    captionsObserver = new MutationObserver(() => {
        // Debounce captions state changes to prevent excessive calls
        if (captionsStateDebounceTimer) {
            clearTimeout(captionsStateDebounceTimer);
        }
        captionsStateDebounceTimer = setTimeout(() => {
            handleCaptionsStateChange();
        }, 1500);
    });
    
    captionsObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributeFilter: ['data-tid']
    });
}

const handleMeetingStateChange = ErrorHandler.wrap(async function() {
    const nowInMeeting = isUserInMeeting();
    
    if (wasInMeeting && !nowInMeeting) {
        console.log("Meeting transition detected: In -> Out. Checking for auto-save.");
        
        // Send meeting ended signal to viewer
        try {
            chrome.runtime.sendMessage({
                message: "meeting_ended"
            }).catch(() => {
                // Viewer might not be open, ignore error
            });
        } catch (error) {
            // Silent fail if no listeners
        }
        
        // Generate a unique meeting session ID (dedup key for auto-save, distinct
        // from the module-level currentMeetingId used for IndexedDB records)
        const autoSaveSessionKey = `${meetingTitleOnStart}_${recordingStartTime?.toISOString() || Date.now()}`;

        // Prevent duplicate auto-saves for the same meeting session
        if (autoSaveTriggered && lastMeetingId === autoSaveSessionKey) {
            console.log("Auto-save already triggered for this meeting session, skipping...");
            clearElementCache();
            wasInMeeting = nowInMeeting;
            return;
        }
        
        try {
            const { autoSaveOnEnd } = await chrome.storage.sync.get('autoSaveOnEnd');
            if (autoSaveOnEnd && transcriptArray.length > 0) {
                console.log("Auto-save is ON and transcript has data. Triggering save.");
                
                // Mark auto-save as triggered before sending message
                autoSaveTriggered = true;
                lastMeetingId = autoSaveSessionKey;
                
                // Send save message without retry (let service worker handle retries if needed)
                const attendeeReport = await getAttendeeReport();
                await chrome.runtime.sendMessage({
                    message: "save_on_leave",
                    transcriptArray: getCleanTranscript(),
                    meetingTitle: meetingTitleOnStart,
                    recordingStartTime: recordingStartTime ? recordingStartTime.toISOString() : new Date().toISOString(),
                    attendeeReport: attendeeReport
                });
                
                console.log("Auto-save message sent successfully.");
            }
        } catch (error) {
            ErrorHandler.log(error, 'Auto-save on meeting end', false);
            // Reset auto-save state on error so it can be retried
            autoSaveTriggered = false;
        }
        
        clearElementCache();
    }
    
    const justJoined = !wasInMeeting && nowInMeeting;
    wasInMeeting = nowInMeeting;

    if (!nowInMeeting) {
        stopCaptureSession();
        stopAttendeeTracking();
        return;
    } else if (justJoined) {
        // Reset auto-save state when joining a new meeting
        console.log("Meeting transition detected: Out -> In. Resetting auto-save state.");
        autoSaveTriggered = false;
        lastMeetingId = null;
        // Start attendee tracking when entering meeting
        startAttendeeTracking();
    }
    
    handleCaptionsStateChange();
}, 'Meeting state change handler');

const handleCaptionsStateChange = ErrorHandler.wrap(async function() {
    if (!isUserInMeeting()) return;
    
    const { trackCaptions } = await chrome.storage.sync.get('trackCaptions');
    if (trackCaptions === false) {
        console.log("Caption tracking disabled, skipping caption state handling");
        return;
    }
    
    const captionsContainer = getCaptionsContainer();
    if (captionsContainer) {
        startCaptureSession();
    } else {
        stopCaptureSession();
        
        const { autoEnableCaptions } = await chrome.storage.sync.get('autoEnableCaptions');
        if (autoEnableCaptions) {
            // Use debounced version to prevent rapid firing
            debouncedAutoEnableCaptions();
        }
    }
}, 'Captions state change handler');

function ensureObserverIsActive() {
    if (!capturing) return;

    const captionContainer = getCaptionsContainer();
    
    // If the container doesn't exist or has changed, re-initialize the observer
    if (!captionContainer || captionContainer !== observedElement) {
        if (observer) {
            observer.disconnect();
        }

        if (captionContainer) {
            observer = new MutationObserver(processCaptionUpdates);
            observer.observe(captionContainer, {
                childList: true,
                subtree: true,
                characterData: true,
            });
            observedElement = captionContainer;
            processCaptionUpdates(); // Initial scan
        } else {
            observedElement = null;
        }
    }
}

async function startCaptureSession() {
    // Check if caption tracking is enabled
    const { trackCaptions } = await chrome.storage.sync.get('trackCaptions');
    if (trackCaptions === false) {
        console.log("Caption tracking is disabled in settings");
        // Still start attendee tracking if captions are disabled
        startAttendeeTracking();
        return;
    }
    
    if (capturing) return;

    console.log("New caption session detected. Starting capture.");
    transcriptArray.length = 0;
    // Note: speakerAliases is cleared by the service worker on update_badge_status
    // (capturing: true) - content scripts cannot access chrome.storage.session.

    capturing = true;
    meetingTitleOnStart = document.title;
    recordingStartTime = new Date();
    currentMeetingId = `meeting_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    lastFlushedCount = 0;

    console.log(`Capture started. Title: "${meetingTitleOnStart}", Time: ${recordingStartTime.toLocaleString()}`);
    
    // Start periodic backup
    startPeriodicBackup();
    
    // Start attendee tracking
    startAttendeeTracking();
    
    chrome.runtime.sendMessage({ message: "update_badge_status", capturing: true });

    ensureObserverIsActive();

    // Offer to continue a recent transcript of the same meeting (leave & rejoin)
    maybeOfferResume();
}

// Comparable meeting identity from a document.title. Must stay in sync with the
// copy in service_worker.js.
function normalizeMeetingTitle(fullTitle) {
    if (!fullTitle) return 'meeting';
    const parts = fullTitle.split('|');
    const meetingName = parts.length > 2 ? parts[1] : parts[0];
    const cleanedName = meetingName.replace('Microsoft Teams', '').trim();
    return (cleanedName.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_') || 'Meeting')
        .replace(/^\(\d+\)\s*/, '').trim().toLowerCase();
}

async function maybeOfferResume() {
    const normTitle = normalizeMeetingTitle(meetingTitleOnStart);

    // Silent fast-path: capture restarted in this same page without leaving the
    // meeting (captions toggled off/on) - unquestionably the same meeting, merge.
    if (pendingResume && pendingResume.silent && pendingResume.normTitle === normTitle &&
        Date.now() - pendingResume.endedAt < RESUME_WINDOW_MS) {
        const resumeId = pendingResume.id;
        pendingResume = null;
        console.log('[Teams Caption Saver] Captions re-enabled in the same meeting; continuing transcript.');
        await adoptPreviousMeeting(resumeId);
        return;
    }
    pendingResume = null;

    // Rejoin after leaving (or after a tab reload): ask the service worker for a
    // recent same-title meeting, then let the user decide.
    try {
        const response = await chrome.runtime.sendMessage({
            message: 'get_resumable_meeting',
            meetingTitle: meetingTitleOnStart,
            excludeId: currentMeetingId
        });
        if (response?.candidate && capturing) {
            showResumeToast(response.candidate);
        }
    } catch (error) {
        // Service worker unavailable; just keep the new transcript
    }
}

// Continue a previous meeting record: prepend its transcript to the in-memory
// array, adopt its id and start time, and drop the interim record created since.
async function adoptPreviousMeeting(previousId) {
    try {
        const response = await chrome.runtime.sendMessage({
            message: 'get_meeting_transcript',
            meetingId: previousId
        });
        if (!response?.transcript || !capturing) return;

        const interimId = currentMeetingId;
        const restored = response.transcript.map((caption, i) => ({
            ...caption,
            key: `restored_${previousId}_${i}`
        }));
        transcriptArray.unshift(...restored);
        currentMeetingId = previousId;
        if (response.startedAt) {
            recordingStartTime = new Date(response.startedAt);
        }
        lastFlushedCount = 0;

        if (interimId && interimId !== previousId) {
            chrome.runtime.sendMessage({ message: 'delete_meeting', meetingId: interimId }).catch(() => {});
        }
        await flushMeetingSnapshot();
        console.log(`[Teams Caption Saver] Continued previous transcript (${restored.length} restored captions).`);
    } catch (error) {
        ErrorHandler.log(error, 'Adopting previous meeting transcript', true);
    }
}

function showResumeToast(candidate) {
    // Only one toast at a time
    document.getElementById('tcs-resume-toast')?.remove();

    const toast = document.createElement('div');
    toast.id = 'tcs-resume-toast';
    toast.style.cssText = 'position:fixed; bottom:24px; right:24px; z-index:2147483647;' +
        'background:#292929; color:#fff; padding:12px 16px; border-radius:8px;' +
        'box-shadow:0 4px 16px rgba(0,0,0,0.4); font-family:"Segoe UI",sans-serif; font-size:13px;' +
        'max-width:320px;';

    const text = document.createElement('div');
    text.textContent = 'Looks like the same meeting. Continue previous transcript?';
    text.style.cssText = 'margin-bottom:10px;';

    const buttonRow = document.createElement('div');
    buttonRow.style.cssText = 'display:flex; gap:8px;';

    const continueBtn = document.createElement('button');
    continueBtn.textContent = `Continue (${candidate.captionCount} captions)`;
    continueBtn.style.cssText = 'flex-grow:1; padding:5px 10px; border:none; border-radius:4px;' +
        'background:#6264a7; color:#fff; cursor:pointer; font-size:12px;';

    const newBtn = document.createElement('button');
    newBtn.textContent = 'Start new';
    newBtn.style.cssText = 'padding:5px 10px; border:1px solid #666; border-radius:4px;' +
        'background:transparent; color:#fff; cursor:pointer; font-size:12px;';

    const dismissTimer = setTimeout(() => toast.remove(), 30000);
    continueBtn.addEventListener('click', () => {
        clearTimeout(dismissTimer);
        toast.remove();
        adoptPreviousMeeting(candidate.id);
    });
    newBtn.addEventListener('click', () => {
        clearTimeout(dismissTimer);
        toast.remove();
    });

    buttonRow.append(continueBtn, newBtn);
    toast.append(text, buttonRow);
    document.body.appendChild(toast);
}

// Send the current transcript snapshot to the service worker, which persists it
// to IndexedDB with status 'live'. A crash loses at most one flush window.
async function flushMeetingSnapshot() {
    if (!capturing || !currentMeetingId || transcriptArray.length === 0) return;
    lastFlushedCount = transcriptArray.length;
    // Snapshot mutable state before any await: stopCaptureSession may run while we
    // wait, and a late flush with a nulled id (or after finalize) would corrupt the
    // record or resurrect a completed meeting as 'live'.
    const meetingId = currentMeetingId;
    const meetingTitle = meetingTitleOnStart;
    const startedAt = recordingStartTime ? recordingStartTime.toISOString() : null;
    const transcript = getCleanTranscript();
    try {
        const attendeeReport = await getAttendeeReport();
        if (currentMeetingId !== meetingId) return; // meeting ended while we awaited
        await chrome.runtime.sendMessage({
            message: 'flush_meeting',
            meetingId: meetingId,
            meetingTitle: meetingTitle,
            recordingStartTime: startedAt,
            transcriptArray: transcript,
            attendeeReport: attendeeReport
        });
    } catch (error) {
        if (String(error?.message).includes('Extension context invalidated')) {
            // The extension was reloaded/updated, orphaning this content script: it can
            // never reach the service worker again. Stop flushing quietly - after the
            // Teams tab reloads, the new content script takes over, and this meeting's
            // stale 'live' record gets promoted to 'recovered'.
            if (backupInterval) {
                clearInterval(backupInterval);
                backupInterval = null;
            }
            currentMeetingId = null;
            console.log("[Teams Caption Saver] Extension was reloaded; refresh this tab to resume capture.");
            return;
        }
        console.warn("[Teams Caption Saver] Flush failed:", error);
    }
}

function startPeriodicBackup() {
    // Clear any existing backup interval
    if (backupInterval) {
        clearInterval(backupInterval);
    }

    // Flush transcript to IndexedDB (via service worker) every 15 seconds
    backupInterval = setInterval(flushMeetingSnapshot, 15000);
}

function stopCaptureSession() {
    if (!capturing) return;

    console.log("Captions turned off or meeting ended. Capture stopped. Data preserved.");
    capturing = false;
    if (observer) {
        observer.disconnect();
        observer = null;
    }
    observedElement = null;
    
    // Stop periodic backup
    if (backupInterval) {
        clearInterval(backupInterval);
        backupInterval = null;
    }
    
    // Save to session history when meeting ends (even if < 5 minutes)
    if (transcriptArray.length > 0) {
        // Remember this session so a quick restart can offer (or silently do) a merge.
        // silent=true means the user never left the meeting - captions just toggled off.
        pendingResume = {
            id: currentMeetingId,
            normTitle: normalizeMeetingTitle(meetingTitleOnStart),
            endedAt: Date.now(),
            silent: isUserInMeeting()
        };
        saveToSessionHistory();
    }
    currentMeetingId = null;
    
    // Stop attendee tracking
    stopAttendeeTracking();
    
    chrome.runtime.sendMessage({ message: "update_badge_status", capturing: false });
}

// Save current transcript to session history
async function saveToSessionHistory() {
    if (transcriptArray.length === 0) return;
    // Capture before any await: the caller may reset currentMeetingId right after this call
    const meetingId = currentMeetingId;

    try {
        // Use message passing to save session (content scripts can't import modules)
        const attendeeReport = await getAttendeeReport();
        await chrome.runtime.sendMessage({
            message: "save_session_history",
            meetingId: meetingId,
            transcriptArray: getCleanTranscript(),
            meetingTitle: meetingTitleOnStart || 'Untitled Meeting',
            recordingStartTime: recordingStartTime ? recordingStartTime.toISOString() : null,
            attendeeReport: attendeeReport
        });
        
        console.log('[Teams Caption Saver] Session saved to history');
    } catch (error) {
        console.log('[Teams Caption Saver] Could not save to session history:', error);
    }
}

// --- Automated Features ---
async function attemptAutoEnableCaptions() {
    // Prevent multiple simultaneous auto-enable attempts
    if (autoEnableInProgress) {
        console.log("Auto-enable already in progress, skipping...");
        return;
    }
    
    // Prevent too frequent attempts (min 10 seconds between attempts)
    const now = Date.now();
    if (now - autoEnableLastAttempt < 10000) {
        console.log("Auto-enable attempted too recently, skipping...");
        return;
    }
    
    autoEnableInProgress = true;
    autoEnableLastAttempt = now;
    
    try {
        console.log("Starting auto-enable captions attempt...");

        // Redesign with Captions pinned to the toolbar: one click, no menu
        const pinnedToggle = document.querySelector(SELECTORS.CAPTIONS_TOGGLE);
        if (pinnedToggle) {
            clickCaptionsToggle(pinnedToggle);
            return;
        }
        
        const moreButton = getCachedElement(SELECTORS.MORE_BUTTON);
        if (!moreButton) {
            console.error("Auto-enable FAILED: Could not find 'More' button.");
            return;
        }
        
        // Check if More menu is already expanded
        const expandedMoreButton = getCachedElement(SELECTORS.MORE_BUTTON_EXPANDED);
        if (!expandedMoreButton) {
            console.log("Clicking More button...");
            moreButton.click();
            await delay(TIMING.BUTTON_CLICK_DELAY);
        } else {
            console.log("More menu already expanded, proceeding...");
        }

        // Redesign: Captions sits directly in the More menu
        const menuToggle = document.querySelector(SELECTORS.CAPTIONS_TOGGLE);
        if (menuToggle) {
            clickCaptionsToggle(menuToggle);
            await delay(TIMING.BUTTON_CLICK_DELAY);
            const stillExpanded = getCachedElement(SELECTORS.MORE_BUTTON_EXPANDED);
            if (stillExpanded) {
                stillExpanded.click();
            }
            return;
        }

        // Classic Teams: More > Language and speech > Turn on live captions
        const langAndSpeechButton = getCachedElement(SELECTORS.LANGUAGE_SPEECH_BUTTON);
        if (!langAndSpeechButton) {
            console.error("Auto-enable FAILED: Could not find 'Language and speech' menu item.");
            // Close the More menu if we opened it
            const currentExpandedButton = getCachedElement(SELECTORS.MORE_BUTTON_EXPANDED);
            if (currentExpandedButton) {
                currentExpandedButton.click();
            }
            return;
        }
        
        console.log("Clicking Language and speech...");
        langAndSpeechButton.click();
        await delay(TIMING.BUTTON_CLICK_DELAY);

        const turnOnCaptionsButton = getCachedElement(SELECTORS.TURN_ON_CAPTIONS_BUTTON);
        if (turnOnCaptionsButton) {
            console.log("Clicking Turn on live captions...");
            turnOnCaptionsButton.click();
            await delay(TIMING.BUTTON_CLICK_DELAY);
        } else {
            console.error("Auto-enable FAILED: Could not find 'Turn on live captions' button.");
        }

        // Attempt to close the 'More' menu
        const finalExpandedButton = getCachedElement(SELECTORS.MORE_BUTTON_EXPANDED);
        if (finalExpandedButton) {
            console.log("Closing More menu...");
            finalExpandedButton.click();
        }
        
        console.log("Auto-enable captions attempt completed.");
    } catch (e) {
        console.error("Error during auto-enable captions attempt:", e);
    } finally {
        autoEnableInProgress = false;
    }
}

// Clicks the redesign's Captions toggle unless it already reports captions on -
// clicking it then would turn captions off.
function clickCaptionsToggle(toggle) {
    const isOn = toggle.getAttribute('data-tid') === 'closed-captions-button-on' ||
        toggle.getAttribute('aria-checked') === 'true' ||
        toggle.getAttribute('aria-pressed') === 'true';
    if (isOn) {
        console.log("Captions toggle already on; nothing to click.");
        return;
    }
    console.log("Clicking Captions toggle...");
    toggle.click();
}

function debouncedAutoEnableCaptions() {
    if (autoEnableDebounceTimer) {
        clearTimeout(autoEnableDebounceTimer);
    }
    
    autoEnableDebounceTimer = setTimeout(() => {
        attemptAutoEnableCaptions();
    }, 2000); // 2 second debounce to prevent rapid firing
}

// --- Event-Driven Initialization ---
function initializeEventDrivenSystem() {
    if (hasInitializedListeners) return;
    
    console.log("Initializing event-driven caption system...");
    
    // Set up observers for meeting state changes
    setupMeetingObserver();
    setupCaptionsObserver();
    
    // Periodically check observer status (much less frequent than before)
    setInterval(ensureObserverIsActive, TIMING.OBSERVER_CHECK_INTERVAL);
    
    // Initial state check
    handleMeetingStateChange();
    
    hasInitializedListeners = true;
}

// --- Memory Leak Prevention ---
function cleanupObservers() {
    if (observer) {
        observer.disconnect();
        observer = null;
    }
    if (meetingObserver) {
        meetingObserver.disconnect();
        meetingObserver = null;
    }
    if (captionsObserver) {
        captionsObserver.disconnect();
        captionsObserver = null;
    }
    
    // Clear all debounce timers
    if (meetingStateDebounceTimer) {
        clearTimeout(meetingStateDebounceTimer);
        meetingStateDebounceTimer = null;
    }
    if (captionsStateDebounceTimer) {
        clearTimeout(captionsStateDebounceTimer);
        captionsStateDebounceTimer = null;
    }
    if (autoEnableDebounceTimer) {
        clearTimeout(autoEnableDebounceTimer);
        autoEnableDebounceTimer = null;
    }
    
    // Reset auto-enable state
    autoEnableInProgress = false;
    
    // Stop attendee tracking
    stopAttendeeTracking();
    
    clearElementCache();
}

// Last-gasp flush: fires synchronously (no awaits before sendMessage) so the
// snapshot still reaches the service worker while the page is being torn down.
function lastGaspFlush() {
    if (!capturing || !currentMeetingId || transcriptArray.length === 0) return;
    lastFlushedCount = transcriptArray.length;
    try {
        chrome.runtime.sendMessage({
            message: 'flush_meeting',
            meetingId: currentMeetingId,
            meetingTitle: meetingTitleOnStart,
            recordingStartTime: recordingStartTime ? recordingStartTime.toISOString() : null,
            transcriptArray: getCleanTranscript(),
            attendeeReport: null
        }).catch(() => {});
    } catch (error) {
        // Extension context may already be gone; nothing to do
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', cleanupObservers);
window.addEventListener('pagehide', lastGaspFlush);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        lastGaspFlush();
    }
});

// Initialize the system
initializeEventDrivenSystem();

// --- Message Handling ---
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    switch (request.message) {
        case 'viewer_ready':
            // Viewer is ready to receive live updates
            sendResponse({
                streaming: capturing,
                captionCount: transcriptArray.length
            });
            return true;
            
        case 'get_status':
            (async () => {
                const { trackCaptions } = await chrome.storage.sync.get('trackCaptions');
                const attendeeReport = await getAttendeeReport();
                sendResponse({
                    capturing: trackCaptions !== false ? capturing : false,
                    captionCount: transcriptArray.length,
                    isInMeeting: isUserInMeeting(),
                    attendeeCount: attendeeReport ? attendeeReport.totalUniqueAttendees : 0
                });
            })();
            return true; // Will respond asynchronously

        case 'return_transcript':
            if (transcriptArray.length > 0) {
                (async () => {
                    const attendeeReport = await getAttendeeReport();
                    console.log("[Teams Caption Saver] Sending transcript with attendee report:", {
                        transcriptCount: transcriptArray.length,
                        attendeeCount: attendeeReport ? attendeeReport.totalUniqueAttendees : 0,
                        attendees: attendeeReport ? attendeeReport.attendeeList : []
                    });
                    chrome.runtime.sendMessage({
                        message: "download_captions",
                        transcriptArray: getCleanTranscript(),
                        meetingTitle: meetingTitleOnStart,
                        format: request.format,
                        recordingStartTime: recordingStartTime ? recordingStartTime.toISOString() : new Date().toISOString(),
                        attendeeReport: attendeeReport
                    });
                })();
            } else {
                alert("No captions were captured. Please ensure captions are turned on in the meeting.");
            }
            break;

        case 'get_transcript_for_copying':
            sendResponse({ transcriptArray: getCleanTranscript() });
            break;

        case 'get_captions_for_viewing':
            if (transcriptArray.length > 0) {
                chrome.runtime.sendMessage({
                    message: "display_captions",
                    transcriptArray: getCleanTranscript()
                });
            } else {
                alert("No captions were captured. Please ensure captions are turned on in the meeting.");
            }
            break;

        case 'get_unique_speakers':
            const speakers = [...new Set(transcriptArray.map(item => item.Name))];
            sendResponse({ speakers });
            break;
            
        case 'get_attendee_report':
            (async () => {
                const attendeeReport = await getAttendeeReport();
                sendResponse({ attendeeReport: attendeeReport });
            })();
            return true; // Will respond asynchronously
        
        default:
            console.log("Unhandled message received in content script:", request.message);
            break;
    }

    // Cases that respond asynchronously return true themselves; everything else has
    // already responded (or never will), so close the channel - a dangling `true`
    // makes awaiting senders reject with "message channel closed".
    return false;
});

console.log("Teams Captions Saver content script is running.");