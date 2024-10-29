// Service worker is a script that your browser runs in the background, separate from a web page, opening the door to features that don't need a web page 
// or user interaction.
// Service worker script will be forcefully terminated after about 30 seconds of inactivity, and restarted when it's next needed.
// https://stackoverflow.com/questions/66618136/persistent-service-worker-in-chrome-extension/66618269#66618269

// This code is not used. But without it, the extension does not work
let isTranscribing = false;
let transcriptArray = [];

function jsonToYaml(json) {
    return json.map(entry => {
        return `Name: ${entry.Name}\nText: ${entry.Text}\nTime: ${entry.Time}\n----`;
    }).join('\n');
}

function saveTranscripts(meetingTitle, transcriptArray, meetingDate) {
    const yaml = `Meeting Date: ${meetingDate}\n\n` + jsonToYaml(transcriptArray); // Add meeting date to the top
    console.log(yaml);

    chrome.downloads.download({
        url: 'data:text/plain,' + yaml,
        filename: meetingTitle + ".txt",
        saveAs: true
    });
}


chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    console.log(message);
    switch (message.message) {
        case 'download_captions': // message from Content script
            console.log('download_captions triggered!', message);
            saveTranscripts(message.meetingTitle, message.transcriptArray, message.meetingDate); // Pass meeting date
            break;
        case 'save_captions': // message from Popup
            console.log('save_captions triggered!');

            const [tab] = await chrome.tabs.query({
                active: true,
                lastFocusedWindow: true
            });
            console.log("Tabs query result:", tab);

            console.log("sending message return_transcript");
            chrome.tabs.sendMessage(tab.id, {
                message: "return_transcript"
            });

            console.log("message start_capture sent!");

            break;
        default:
            break;
    }
});
