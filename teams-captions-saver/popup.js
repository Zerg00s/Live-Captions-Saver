document.addEventListener('DOMContentLoaded', function () {
    // Code inside this block will execute after the extension is fully loaded
    console.log('popup.js loaded!');

    const startStopButton = document.getElementById('startStopButton');

    startStopButton.addEventListener('click', function () {
        const buttonText = startStopButton.innerText;
        chrome.runtime.sendMessage({
            message: "start_capture"
        });
        console.log("message start_capture sent!");

    });

    document.getElementById('saveButton').addEventListener('click', function () {
        console.log('save_captions clicked!');

        chrome.runtime.sendMessage({
            message: "save_captions"
        });

    });
});