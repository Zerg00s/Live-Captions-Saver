document.addEventListener('DOMContentLoaded', function () {
    // Code inside this block will execute after the extension is fully loaded
    console.log('popup.js loaded!');   

    document.getElementById('saveButton').addEventListener('click', function () {
        console.log('save_captions clicked!');
        
        // Get active tab and send message
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {message: "return_transcript"});
        });
    });

    document.getElementById('viewButton').addEventListener('click', function () {
        console.log('view_captions clicked!');
        
        // Get active tab and send message
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {message: "get_captions_for_viewing"});
        });
    });
});