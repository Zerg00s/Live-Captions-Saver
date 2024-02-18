const transcriptArray = [];

function checkCaptions() {
    const iframe = document.querySelector('iframe');
    if (!iframe) return;
    
    const transcripts = iframe.contentWindow.document.querySelectorAll('.ui-chat__item');
    if(transcripts && transcripts.length > 0){

    }else{
        // alert("Please, click 'More' > 'Language and speech' > 'Turn on life captions'");
        // console.log("Please, click 'More' > 'Language and speech' > 'Turn on life captions'");
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
          
        }
        
    });
}

let observer = null;

function startTranscription() {
    observer = new MutationObserver(checkCaptions);
    observer.observe(document.body, { childList: true, subtree: true });
    setInterval(checkCaptions, 3000);
    console.log("3️⃣", "checking every 3 seconds");
}

function stopTranscription() {
    if (observer) {
        observer.disconnect();
        observer = null;
    }
}

// Listen for messages from the background.js script.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === 'start_capture') {
        console.log('start_capture triggered!');
        startTranscription();
    } else if (request.message === 'stop_capture') {
        console.log('stop_capture triggered!');
        stopTranscription();
    } else if (request.message === 'save_captions') {
        saveTranscripts();
    }
});

console.log("3️⃣","LISTENING in content.js");

function jsonToYaml(json) {
    return json.map(entry => {
        return `Name: ${entry.Name}\nText: ${entry.Text}\nTime: ${entry.Time}\n----`;
    }).join('\n');
}

function saveTranscripts() {
    // Convert transcriptArray to YAML format
    const yamlContent = jsonToYaml(transcriptArray);
  
    // Create data URI for the YAML content
    const dataURI = "data:text/plain;charset=utf-8," + encodeURIComponent(yamlContent);
  
    const tabTitle = document.querySelector('title').innerText;

    // Create a link element for the download
    const downloadLink = document.createElement("a");
    downloadLink.href = dataURI;
    downloadLink.download = `${tabTitle}.yaml`;
  
    // Programmatically click the link to trigger the download
    downloadLink.click();
}

