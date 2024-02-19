document.addEventListener('DOMContentLoaded', function () {
    // Code inside this block will execute after the extension is fully loaded
    console.log('popup.js loaded!');   

    document.getElementById('saveButton').addEventListener('click', function () {
        console.log('save_captions clicked!');

        chrome.runtime.sendMessage({
            message: "save_captions"
        });

    });
});