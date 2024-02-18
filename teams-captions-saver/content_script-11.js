const transcriptArray = [];
let capturing = false;

function checkCaptions() {
    // Teams v2 
    const closedCaptionsContainer = document.querySelector("[data-tid='closed-captions-renderer']")
    if (!closedCaptionsContainer) {
        // alert("Please, click 'More' > 'Language and speech' > 'Turn on life captions'");
        return;
    }
    const transcripts = closedCaptionsContainer.querySelectorAll('.ui-chat__item');

    transcripts.forEach(transcript => {
        const ID = transcript.querySelector('.fui-Flex > .ui-chat__message').id;
        if (transcript.querySelector('.ui-chat__message__author') != null) {
            const Name = transcript.querySelector('.ui-chat__message__author').innerText;
            const Text = transcript.querySelector('.fui-StyledText').innerText;
            const Time = new Date().toLocaleTimeString(); 

            const index = transcriptArray.findIndex(t => t.ID === ID);

            if (index > -1) {
                if (transcriptArray[index].Text !== Text) {
                    // Update the transcript if text changed
                    transcriptArray[index] = {
                        Name,
                        Text,
                        Time,
                        ID
                    };
                }
            } else {
                console.log({
                    Name,
                    Text,
                    Time,
                    ID
                });
                // Add new transcript
                transcriptArray.push({
                    Name,
                    Text,
                    Time,
                    ID
                });
            }

        }

    });
}

let observer = null;

function startTranscription() {
    const closedCaptionsContainer = document.querySelector("[data-tid='closed-captions-renderer']")
    if (!closedCaptionsContainer) {
        alert("Please, click 'More' > 'Language and speech' > 'Turn on life captions'");
        return;
    }
    capturing = true;
    observer = new MutationObserver(checkCaptions);
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    setInterval(checkCaptions, 3000);
    console.log("3️⃣", "checking every 3 seconds");
}

// Listen for messages from the service_worker.js script.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.message) {
        case 'start_capture':
            console.log('start_capture triggered!');
            startTranscription();
            break;
        case 'return_transcript':
            console.log("response:", transcriptArray);
            if (!capturing) {
                alert("Oops! You didn't Start Capturing. Start Capturing and try again.");
                return;
            }

            let meetingTitle = document.title.replace("__Microsoft_Teams", '').replace(/[^a-z0-9 ]/gi, '');
            chrome.runtime.sendMessage({
                message: "download_captions",
                transcriptArray: transcriptArray,
                meetingTitle: meetingTitle
            });


        default:
            break;
    }

});

console.log("3️⃣", "LISTENING in content.js");