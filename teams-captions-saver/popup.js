document.addEventListener('DOMContentLoaded', function () {
    // Code inside this block will execute after the page is fully loaded
    console.log('popup.js loaded!');

    const startStopButton = document.getElementById('startStopButton');

    startStopButton.addEventListener('click', function () {
        const buttonText = startStopButton.innerText;

        // Toggle the button text
        if (buttonText === 'Start Capturing') {
            chrome.tabs.query({
                url: "https://teams.microsoft.com/*"
            }, function (tabs) {
                console.log("Tabs query result:", tabs);
                if (tabs[0]) {
                    console.log("sending message start_capture");
                    chrome.tabs.sendMessage(tabs[0].id, {
                        message: "start_capture"
                    });
                    console.log("message start_capture sent!");
                }
            });
            
            startStopButton.innerText = 'Stop Capturing';
        } else {
            startStopButton.innerText = 'Start Capturing';
           
        }
    });

    document.getElementById('saveButton').addEventListener('click', function () {
        console.log("1️", 'save_captions clicked!');
        chrome.tabs.query({
            url: "https://teams.microsoft.com/*"
        }, function (tabs) {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    message: "save_captions"
                });
            }
        });


    });
});