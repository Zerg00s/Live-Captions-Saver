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

function saveTranscripts(meetingTitle, transcriptArray) {
    const yaml = jsonToYaml(transcriptArray);
    console.log(yaml);

    chrome.downloads.download({
        url: 'data:text/plain;charset=utf-8,' + encodeURIComponent(yaml),
        filename: meetingTitle + ".txt",
        saveAs: true
    });
}

function createViewerTab(transcriptArray) {
    // Create a data URL containing the HTML content for viewing captions
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>MS Teams Captions Viewer</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    margin: 0;
                    padding: 20px;
                    background-color: #f5f5f5;
                }
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                    background-color: white;
                    padding: 20px;
                    border-radius: 5px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                }
                h1 {
                    color: #333;
                    text-align: center;
                }
                .caption {
                    border-bottom: 1px solid #eee;
                    padding: 10px 0;
                    margin-bottom: 10px;
                }
                .name {
                    font-weight: bold;
                    color: #0078d4;
                }
                .text {
                    margin: 5px 0;
                }
                .time {
                    color: #666;
                    font-size: 0.85em;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>MS Teams Captions</h1>
                <div id="captions-container">
                    ${transcriptArray.map(item => `
                        <div class="caption">
                            <div class="name">${item.Name}</div>
                            <div class="text">${item.Text}</div>
                            <div class="time">${item.Time}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </body>
        </html>
    `;
    
    // Create a new tab with this HTML content
    chrome.tabs.create({
        url: 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent)
    });
}

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    console.log("Service worker received message:", message);
    
    switch (message.message) {
        case 'download_captions': // message from Content script
            console.log('download_captions triggered!', message);
            saveTranscripts(message.meetingTitle, message.transcriptArray);
            break;

        case 'display_captions': // message from Content script with captions for viewing
            console.log('display_captions triggered!', message);
            createViewerTab(message.transcriptArray);
            break;

        default:
            break;
    }
});