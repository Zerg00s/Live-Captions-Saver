const transcriptArray = [];

function checkCaptions() {
    const iframe = document.querySelector('iframe');
    if (!iframe) return;
    
    const transcripts = iframe.contentWindow.document.querySelectorAll('.ui-chat__item');
    if(transcripts && transcripts.length > 0){

    }else{
        alert("Please, click 'More' > 'Language and speech' > 'Turn on life captions'");
        return;
    }

    transcripts.forEach(transcript => {
        const ID = transcript.querySelector('.fui-Flex > .ui-chat__message').id;
        if(transcript.querySelector('.ui-chat__message__author')!= null){
            const Name = transcript.querySelector('.ui-chat__message__author').innerText;
            const Text = transcript.querySelector('.fui-StyledText').innerText;
            const Time = new Date().toISOString().replace('T', ' ').slice(11, 19); // Keep only hours, minutes, seconds
    
            const index = transcriptArray.findIndex(t => t.ID === ID);
    
            if (index > -1) {
                if (transcriptArray[index].Text !== Text) {
                    // Update the transcript if text changed
                    transcriptArray[index] = { Name, Text, Time, ID };
                }
            } else {
                console.log({ Name, Text, Time, ID });
                // Add new transcript
                transcriptArray.push({ Name, Text, Time, ID });
            }
    
            // Send the updated transcripts to the background script
            console.log("Send the update_transcripts message to the background.js script");
            chrome.runtime.sendMessage({message: "update_transcripts", transcripts: transcriptArray});
        }
        
    });
}

let observer = null;

function startTranscription() {
    observer = new MutationObserver(checkCaptions);
    observer.observe(document.body, { childList: true, subtree: true });
    setInterval(checkCaptions, 3000);
    console.log("checking every 3 seconds");
}

function stopTranscription() {
    if (observer) {
        observer.disconnect();
        observer = null;
    }
}

// Listen for messages from the background script.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log(request);
    if (request.message === 'start_capture') {
        console.log('start_capture triggered!');
        startTranscription();
    } else if (request.message === 'stop_capture') {
        console.log('stop_capture triggered!');
        stopTranscription();
    }
});

console.log("LISTENING in content.js");