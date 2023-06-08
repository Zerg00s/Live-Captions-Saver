let isTranscribing = false;
let transcriptArray = [];

function jsonToYaml(json) {
    return json.map(entry => {
        return `Name: ${entry.Name}\nText: ${entry.Text}\nTime: ${entry.Time}\n----`;
    }).join('\n');
}


// This function will be called by popup.js to start/stop transcription.
function toggleTranscription() {
    if (isTranscribing) {
        // If already transcribing, stop the process.
        console.log("already transcribing, stop the process.");
        isTranscribing = false;
    } else {
        // If not currently transcribing, start the process.
        isTranscribing = true;
        // Message to content script to start transcribing
        console.log("start transcribing");
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {message: "start_transcription"});
        });
    }
}

// This function will be called by popup.js to save the transcripts.
function saveTranscripts() {
    // Convert transcriptArray to YAML format
    const yamlContent = jsonToYaml(transcriptArray);
  
    // Create data URI for the YAML content
    const dataURI = "data:text/plain;charset=utf-8," + encodeURIComponent(yamlContent);
  
    // Create a link element for the download
    const downloadLink = document.createElement("a");
    downloadLink.href = dataURI;
    downloadLink.download = "transcripts.yaml";
  
    // Programmatically click the link to trigger the download
    downloadLink.click();
}

// Listen for messages from the popup script or content scripts.
// Call the appropriate function based on the received message.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === 'toggle_transcription') {
        console.log('toggle_transcription triggered!');
        toggleTranscription();
    } else if (request.message === 'save_transcripts') {
        console.log('save_transcripts triggered!');
        saveTranscripts();
    } else if (request.message === 'update_transcripts') {
        // Update the transcripts received from content.js
        console.log('update_transcripts received!');
        transcriptArray = request.transcripts;
    }
});
