const transcriptArray = [];
let capturing = false;
let observer = null;
let transcriptIdCounter = 0; // Since IDs are not reliable in new structure
let processedCaptions = new Set(); // Track captions we've already processed
let lastCaptionTime = 0; // Track when we last saw a caption change (0 = never)
let silenceCheckTimer = null; // Timer to check for silence periods
let lastCaptionSnapshot = ''; // Track the actual content to detect real changes

function checkCaptions() {
    // Get all caption text elements directly from the document
    const captionTextElements = document.querySelectorAll('[data-tid="closed-caption-text"]');
    
    // Create a snapshot of current caption content to detect real changes
    if (captionTextElements.length > 0) {
        const currentSnapshot = Array.from(captionTextElements).map(el => el.innerText.trim()).join('|');
        
        // Only update timing if the content actually changed
        if (currentSnapshot !== lastCaptionSnapshot) {
            lastCaptionSnapshot = currentSnapshot;
            lastCaptionTime = Date.now();
            
            console.log('Caption content changed, resetting silence timer');
            
            // Reset the silence check timer
            if (silenceCheckTimer) {
                clearTimeout(silenceCheckTimer);
            }
            
            // Set a timer to check for recent captions after 5 seconds of silence
            silenceCheckTimer = setTimeout(checkRecentCaptions, 5000);
        }
    }
    
    // Be very conservative - skip the last 5 elements to ensure we only get truly stable captions
    // and only process if we have at least 6 captions total
    if (captionTextElements.length < 6) {
        console.log(`Only ${captionTextElements.length} captions, need at least 6 for stable processing`);
        return; // Not enough captions to safely determine which are stable
    }
    
    const numStableElements = captionTextElements.length - 5;
    
    for (let i = 0; i < numStableElements; i++) {
        const textElement = captionTextElements[i];
        const Text = textElement.innerText.trim();
        if (Text.length === 0) continue;
        
        // Find the parent ChatMessageCompact element to get the author
        const transcript = textElement.closest('.fui-ChatMessageCompact');
        if (!transcript) continue;
        
        // Generate a unique ID for the transcript element if it doesn't have one
        // This handles Teams removing caption IDs
        if (!transcript.getAttribute('data-caption-id')) {
            const uniqueId = `caption_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            transcript.setAttribute('data-caption-id', uniqueId);
        }
        
        const authorElement = transcript.querySelector('[data-tid="author"]');
        if (!authorElement) continue;
        
        const Name = authorElement.innerText.trim();
        
        // Create a unique key using name and text only
        const captionKey = `${Name}:${Text}`;
        
        // Skip if we've already processed this exact caption
        if (processedCaptions.has(captionKey)) {
            continue;
        }
        
        // Mark as processed
        processedCaptions.add(captionKey);
        
        // Add to transcript array
        const Time = new Date().toLocaleTimeString();
        const newCaption = {
            Name,
            Text,
            Time,
            ID: captionKey
        };
        
        transcriptArray.push(newCaption);
        console.log('FINAL STABLE CAPTION:', newCaption);
    }
}

function checkRecentCaptions() {
    console.log('checkRecentCaptions called - checking for silence-based captions');
    
    // After 5 seconds of silence, check if there are recent captions we can safely capture
    const captionTextElements = document.querySelectorAll('[data-tid="closed-caption-text"]');
    
    if (captionTextElements.length === 0) {
        console.log('No caption elements found for silence check');
        return;
    }
    
    console.log(`Found ${captionTextElements.length} caption elements for silence check`);
    
    // If it's been 5+ seconds since last activity, consider the last 2-3 captions as stable
    const timeSinceLastCaption = Date.now() - lastCaptionTime;
    console.log(`Time since last caption: ${timeSinceLastCaption}ms`);
    
    if (timeSinceLastCaption >= 4500) { // Slightly less than 5000 to account for timer timing
        console.log('Processing recent captions due to silence...');
        
        // Process the more recent captions 
        // Cover the gap between stable processing (last 5) and current processing
        const startIndex = Math.max(0, captionTextElements.length - 5); 
        let endIndex = captionTextElements.length - 1; // Usually skip the very last one
        
        // If this is triggered by user export request, try to include the very last caption too
        // Check if the last caption looks complete (ends with punctuation)
        if (captionTextElements.length > 0) {
            const lastElement = captionTextElements[captionTextElements.length - 1];
            const lastText = lastElement.innerText.trim();
            if (lastText.match(/[.!?]$/)) {
                console.log('Last caption ends with punctuation, including it:', lastText);
                endIndex = captionTextElements.length; // Include the very last one
            }
        }
        
        console.log(`Processing captions from index ${startIndex} to ${endIndex - 1}`);
        
        for (let i = startIndex; i < endIndex; i++) {
            const textElement = captionTextElements[i];
            const Text = textElement.innerText.trim();
            if (Text.length === 0) continue;
            
            // Find the parent ChatMessageCompact element to get the author
            const transcript = textElement.closest('.fui-ChatMessageCompact');
            if (!transcript) continue;
            
            // Generate a unique ID for the transcript element if it doesn't have one
            // This handles Teams removing caption IDs
            if (!transcript.getAttribute('data-caption-id')) {
                const uniqueId = `caption_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                transcript.setAttribute('data-caption-id', uniqueId);
            }
            
            const authorElement = transcript.querySelector('[data-tid="author"]');
            if (!authorElement) continue;
            
            const Name = authorElement.innerText.trim();
            
            // Create a unique key using name and text only
            const captionKey = `${Name}:${Text}`;
            
            // Skip if we've already processed this exact caption
            if (processedCaptions.has(captionKey)) {
                console.log(`Skipping duplicate silence caption: ${Text}`);
                continue;
            }
            
            // Mark as processed
            processedCaptions.add(captionKey);
            
            // Add to transcript array
            const Time = new Date().toLocaleTimeString();
            const newCaption = {
                Name,
                Text,
                Time,
                ID: captionKey
            };
            
            transcriptArray.push(newCaption);
            console.log('SILENCE-DETECTED STABLE CAPTION:', newCaption);
        }
    } else {
        console.log('Not enough silence time elapsed');
    }
}

// Add a periodic check for silence in case MutationObserver stops firing
setInterval(() => {
    if (lastCaptionTime === 0) {
        // No captions have been processed yet, skip silence check
        return;
    }
    
    const timeSinceLastCaption = Date.now() - lastCaptionTime;
    if (timeSinceLastCaption >= 5000 && timeSinceLastCaption <= 6000) {
        console.log('Periodic silence check triggered');
        checkRecentCaptions();
    }
}, 1000);

// run startTranscription every 5 seconds
// cancel the interval if capturing is true
function startTranscription() {
    // Check if we're in a meeting - look for various indicators
    const meetingIndicators = [
        document.getElementById("call-duration-custom"),
        document.querySelector("[data-tid='call-status-container-test-id']"),
        document.querySelector("#call-status"),
        // New: check for the "Waiting for others to join..." text
        Array.from(document.querySelectorAll('span')).find(el => 
            el.textContent && el.textContent.includes("Waiting for others to join")
        )
    ];
    
    const inMeeting = meetingIndicators.some(indicator => indicator !== null && indicator !== undefined);
    
    if (!inMeeting) {
        setTimeout(startTranscription, 5000);
        return false;
    }

    // Use multiple selectors to find captions container (resilient to Teams UI changes)
    const captionSelectors = [
        "[data-tid='closed-caption-v2-window-wrapper']",  // Teams v2 wrapper
        "[data-tid='closed-captions-renderer']",          // Original selector
        "[data-tid*='closed-caption']"                    // Wildcard fallback
    ];
    
    let closedCaptionsContainer = null;
    for (const selector of captionSelectors) {
        closedCaptionsContainer = document.querySelector(selector);
        if (closedCaptionsContainer) {
            console.log(`Found captions container using selector: ${selector}`);
            break;
        }
    }
    
    if (!closedCaptionsContainer) {
        console.log("Please, click 'More' > 'Language and speech' > 'Turn on live captions'");
        setTimeout(startTranscription, 5000);
        return false;
    }

    console.log("Found captions container, setting up observer...");
    capturing = true;
    observer = new MutationObserver((mutations) => {
        console.log('MutationObserver fired with', mutations.length, 'mutations');
        checkCaptions();
    });
    observer.observe(closedCaptionsContainer, {
        childList: true,
        subtree: true,
        characterData: true // Also watch for text changes
    });
    
    console.log("Observer set up, doing initial check...");
    // Do an initial check
    checkCaptions();
    
    // Also set up a fallback timer to check periodically
    setInterval(() => {
        console.log("Fallback timer check...");
        checkCaptions();
    }, 2000);
    

    return true;
}

function sortTranscriptsByScreenOrder() {
    // Get the current order of captions as they appear on screen
    const captionTextElements = document.querySelectorAll('[data-tid="closed-caption-text"]');
    const screenOrder = [];
    
    captionTextElements.forEach((element, index) => {
        const text = element.innerText.trim();
        const transcript = element.closest('.fui-ChatMessageCompact');
        if (transcript) {
            const authorElement = transcript.querySelector('[data-tid="author"]');
            if (authorElement) {
                const name = authorElement.innerText.trim();
                screenOrder.push({
                    text: text,
                    name: name,
                    screenPosition: index
                });
            }
        }
    });
    
    // Create a map for quick lookup of screen positions
    const positionMap = new Map();
    screenOrder.forEach(item => {
        const key = `${item.name}:${item.text}`;
        positionMap.set(key, item.screenPosition);
    });
    
    // Sort transcriptArray based on screen order
    const orderedTranscripts = [...transcriptArray].sort((a, b) => {
        const keyA = `${a.Name}:${a.Text}`;
        const keyB = `${b.Name}:${b.Text}`;
        
        const posA = positionMap.get(keyA);
        const posB = positionMap.get(keyB);
        
        // If both have screen positions, sort by screen order
        if (posA !== undefined && posB !== undefined) {
            return posA - posB;
        }
        
        // If only one has a screen position, put it first
        if (posA !== undefined) return -1;
        if (posB !== undefined) return 1;
        
        // If neither has a screen position, maintain original order
        return 0;
    });
    
    console.log("Sorted transcripts by screen order:", orderedTranscripts);
    return orderedTranscripts;
}

console.log("Starting transcription...");
const startResult = startTranscription();
console.log("startTranscription returned:", startResult);

// Manual silence check for testing - runs regardless of startTranscription result
setTimeout(() => {
    console.log("MANUAL SILENCE CHECK - forcing checkRecentCaptions()");
    lastCaptionTime = Date.now() - 6000; // Pretend last caption was 6 seconds ago
    checkRecentCaptions();
}, 10000); // Run this once after 10 seconds

// Listen for messages from the popup.js or service_worker.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Content script received message:", request);
    
    switch (request.message) {
        case 'return_transcript':
            console.log("return_transcript request received:", transcriptArray);
            
            // Before sending, try to capture any recent captions that might not have been processed yet
            console.log("Attempting to capture recent captions before download...");
            lastCaptionTime = Date.now() - 6000; // Force silence detection
            checkRecentCaptions();
            
            if (!capturing || transcriptArray.length === 0) {
                alert("Oops! No captions were captured. Please make sure captions are turned on.");
                sendResponse({success: false});
                return;
            }

            // Sort transcripts by the order they appear on screen (not by capture time)
            const orderedForDownload = sortTranscriptsByScreenOrder();
            
            let meetingTitle = document.title.replace("__Microsoft_Teams", '').replace(/[^a-z0-9 ]/gi, '');
            chrome.runtime.sendMessage({
                message: "download_captions",
                transcriptArray: orderedForDownload.map(({ID, ...rest}) => rest), // Remove ID property
                meetingTitle: meetingTitle
            });
            sendResponse({success: true});
            break;

        case 'get_captions_for_viewing':
            console.log("get_captions_for_viewing request received:", transcriptArray);
            
            // Before sending, try to capture any recent captions that might not have been processed yet
            console.log("Attempting to capture recent captions before viewing...");
            lastCaptionTime = Date.now() - 6000; // Force silence detection
            checkRecentCaptions();
            
            if (!capturing || transcriptArray.length === 0) {
                alert("Oops! No captions were captured. Please make sure captions are turned on.");
                sendResponse({success: false});
                return;
            }

            // Sort transcripts by the order they appear on screen (not by capture time)
            const orderedForViewing = sortTranscriptsByScreenOrder();
            
            // Remove ID property from each item in the array before sending
            const viewableTranscripts = orderedForViewing.map(({ID, ...rest}) => rest);
            
            chrome.runtime.sendMessage({
                message: "display_captions",
                transcriptArray: viewableTranscripts
            });
            sendResponse({success: true});
            break;

        default:
            sendResponse({success: false, error: "Unknown message"});
            break;
    }
    
    return true; // Keep the message channel open for async response
});

console.log("content_script.js is running");