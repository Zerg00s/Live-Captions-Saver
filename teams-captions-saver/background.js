// This code is not used. But without it, the extension does not work
let isTranscribing = false;
let transcriptArray = [];

function saveTranscripts() {
    if(transcriptArray === null || transcriptArray.length === 0){
        return;
    }
    if(yamlContent){
        chrome.runtime.sendMessage({message: 'download_transcripts', data: yamlContent});
    }else{
    }    
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log(request);
    if (request.message === 'toggle_capture') {
        chrome.tabs.query({url: "https://teams.microsoft.com/*"}, function(tabs) {
        console.log("Tabs query result:", tabs);
        if (tabs[0]) {
            console.log("sending message start_capture");
            chrome.tabs.sendMessage(tabs[0].id, {message: "start_capture"});
            console.log("message start_capture sent!");
        }
    })      
    } else if (request.message === 'save_captions') {
        console.log('save_captions triggered!');
        saveTranscripts();
    }
});


