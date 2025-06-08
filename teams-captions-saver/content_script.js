const transcriptArray = [];
let capturing = false;
let observer = null;
let transcriptIdCounter = 0; // Since IDs are not reliable in new structure

function checkCaptions() {
    console.log("Checking for captions...");
    // Teams v2 - Updated for new HTML structure
    const closedCaptionsContainer = document.querySelector("[data-tid='closed-captions-renderer']");
    if (!closedCaptionsContainer) {
        // "Please, click 'More' > 'Language and speech' > 'Turn on life captions'"
        return;
    }
    
    // New selector for caption items
    const transcripts = closedCaptionsContainer.querySelectorAll('.fui-ChatMessageCompact');

    transcripts.forEach(transcript => {
        // Get author name
        const authorElement = transcript.querySelector('[data-tid="author"]');
        if (!authorElement) return; // Skip if no author found
        
        const Name = authorElement.innerText.trim();
        
        // Get caption text
        const textElement = transcript.querySelector('[data-tid="closed-caption-text"]');
        if (!textElement) return; // Skip if no text found
        
        const Text = textElement.innerText.trim();
        const Time = new Date().toLocaleTimeString();
        
        // Since we don't have reliable IDs anymore, we'll use a combination of name + text
        // to detect duplicates (checking last few entries to avoid false positives)
        const recentTranscripts = transcriptArray.slice(-10); // Check last 10 entries
        const isDuplicate = recentTranscripts.some(t => 
            t.Name === Name && t.Text === Text
        );
        
        if (!isDuplicate && Text.length > 0) {
            console.log({
                Name,
                Text,
                Time,
                ID: `caption_${transcriptIdCounter++}`
            });
            
            // Add new transcript
            transcriptArray.push({
                Name,
                Text,
                Time,
                ID: `caption_${transcriptIdCounter}`
            });
        }
    });
}

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

    const closedCaptionsContainer = document.querySelector("[data-tid='closed-captions-renderer']");
    if (!closedCaptionsContainer) {
        console.log("Please, click 'More' > 'Language and speech' > 'Turn on live captions'");
        setTimeout(startTranscription, 5000);
        return false;
    }

    capturing = true;
    observer = new MutationObserver(checkCaptions);
    observer.observe(closedCaptionsContainer, {
        childList: true,
        subtree: true,
        characterData: true // Also watch for text changes
    });
    
    // Do an initial check
    checkCaptions();

    return true;
}

startTranscription();

// Listen for messages from the popup.js or service_worker.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Content script received message:", request);
    
    switch (request.message) {
        case 'return_transcript':
            console.log("return_transcript request received:", transcriptArray);
            if (!capturing || transcriptArray.length === 0) {
                alert("Oops! No captions were captured. Please make sure captions are turned on.");
                return;
            }

            let meetingTitle = document.title.replace("__Microsoft_Teams", '').replace(/[^a-z0-9 ]/gi, '');
            chrome.runtime.sendMessage({
                message: "download_captions",
                transcriptArray: transcriptArray.map(({ID, ...rest}) => rest), // Remove ID property
                meetingTitle: meetingTitle
            });
            break;

        case 'get_captions_for_viewing':
            console.log("get_captions_for_viewing request received:", transcriptArray);
            if (!capturing || transcriptArray.length === 0) {
                alert("Oops! No captions were captured. Please make sure captions are turned on.");
                return;
            }

            // Remove ID property from each item in the array before sending
            const viewableTranscripts = transcriptArray.map(({ID, ...rest}) => rest);
            
            chrome.runtime.sendMessage({
                message: "display_captions",
                transcriptArray: viewableTranscripts
            });
            break;

        default:
            break;
    }
});

console.log("content_script.js is running");