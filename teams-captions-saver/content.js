if (localStorage.getItem("transcripts") !== null) {
    localStorage.removeItem("transcripts");
}

const transcriptArray = JSON.parse(localStorage.getItem("transcripts")) || [];

function checkTranscripts() {
    const iframe = document.querySelector('iframe');
    
    // const transcripts = document.querySelectorAll('.ui-chat__item');
    const transcripts = iframe.contentWindow.document.querySelectorAll('.ui-chat__item');
    console.log(transcripts);
    transcripts.forEach(transcript => {
        const ID = transcript.querySelector('.fui-Flex > .ui-chat__message').id;
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
        chrome.runtime.sendMessage({message: "update_transcripts", transcripts: transcriptArray});
    });

    localStorage.setItem('transcripts', JSON.stringify(transcriptArray));
}

let observer = null;

function startTranscription() {
    observer = new MutationObserver(checkTranscripts);
    observer.observe(document.body, { childList: true, subtree: true });
    setInterval(checkTranscripts, 3000);
}

function stopTranscription() {
    if (observer) {
        observer.disconnect();
        observer = null;
    }
}

// Listen for messages from the background script.
// Call the appropriate function based on the received message.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === 'start_transcription') {
        console.log('start_transcription triggered!');
        startTranscription();
    } else if (request.message === 'stop_transcription') {
        console.log('stop_transcription triggered!');
        stopTranscription();
    }
});
