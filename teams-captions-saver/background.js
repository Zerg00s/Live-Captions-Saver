let isTranscribing = false;
let transcriptArray = [];

function jsonToYaml(json) {
    return json.map(entry => {
        return `Name: ${entry.Name}\nText: ${entry.Text}\nTime: ${entry.Time}\n----`;
    }).join('\n');
}

function toggleTranscription() {
    if (isTranscribing) {
        // console.log("already capturing, stop the process.");
        isTranscribing = false;
    } else {
        isTranscribing = true;
        // console.log("start capturing");
        chrome.tabs.query({url: "https://teams.microsoft.com/*"}, function(tabs) {
            console.log("Tabs query result:", tabs);
            if (tabs[0]) {
                console.log("sending message start_capture");
                chrome.tabs.sendMessage(tabs[0].id, {message: "start_capture"});
                console.log("message start_capture sent!");
            }
        });
        
    }
}



function saveTranscripts() {
    if(transcriptArray === null || transcriptArray.length === 0){
        // console.log("nothing to save!");
        return;
    }
    const yamlContent = jsonToYaml(transcriptArray);
    if(yamlContent){
        // console.log(yamlContent);
        // console.log("saving transactions... Sending download_transcripts message:", yamlContent);
        chrome.runtime.sendMessage({message: 'download_transcripts', data: yamlContent});
        // console.log("message sent...");
    }else{
        // console.log("nothing to save!");
    }    
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log(request);
    if (request.message === 'toggle_capture') {
        // console.log('toggle_capture triggered!');
        toggleTranscription();
    } else if (request.message === 'save_captions') {
        // console.log('save_captions triggered!');
        saveTranscripts();
    } else if (request.message === 'update_transcripts') {
        // console.log('update_transcripts received!', request.transcripts);
        transcriptArray = request.transcripts;
    }
});

console.log("listening to toggle_capture, save_captions and update_transcripts");
