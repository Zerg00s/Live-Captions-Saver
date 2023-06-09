
if (localStorage.getItem("transcripts") !== null) {
    localStorage.removeItem("transcripts");
}

const transcriptArray = JSON.parse(localStorage.getItem("transcripts")) || [];

function checkTranscripts() {
    const transcripts = document.querySelectorAll('.ui-chat__item');
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
    });

    localStorage.setItem('transcripts', JSON.stringify(transcriptArray));
}

const observer = new MutationObserver(checkTranscripts);
observer.observe(document.body, { childList: true, subtree: true });

setInterval(checkTranscripts, 20000);

function jsonToYaml(json) {
    return Object.keys(json).map(key => {
        let value = json[key];
        if (typeof value === 'object') {
            value = jsonToYaml(value);
        }
        return `${key}: ${value}`;
    }).join('\n');
}


function checkTranscripts() {
    const transcripts = document.querySelectorAll('.ui-chat__item');
    transcripts.forEach(transcript => {
        const ID = transcript.querySelector('.fui-Flex > .ui-chat__message').id;
        const Name = transcript.querySelector('.ui-chat__message__author').innerText;
        const Text = transcript.querySelector('.fui-StyledText').innerText;
        const Time = new Date().toLocaleTimeString([], { hour12: false });

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
    });

    localStorage.setItem('transcripts', JSON.stringify(transcriptArray));
}


// Download YAML
// downloadYAML();
