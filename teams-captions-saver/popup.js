document.addEventListener('DOMContentLoaded', function() {
    // Code inside this block will execute after the page is fully loaded
    console.log('popup.js loaded!');

    const startStopButton = document.getElementById('startStopButton');
    
    startStopButton.addEventListener('click', function() {
        const buttonText = startStopButton.innerText;
        
        // Send a message to background.js to toggle the transcription
        chrome.runtime.sendMessage({message: 'toggle_capture'});

        // Toggle the button text
        if (buttonText === 'Start Capturing') {
            startStopButton.innerText = 'Stop Capturing';
        } else {
            startStopButton.innerText = 'Start Capturing';
        }
        console.log('toggle_capture clicked!');
    });
  
    document.getElementById('saveButton').addEventListener('click', function() {
        console.log('save_captions clicked!');
        chrome.runtime.sendMessage({message: 'save_captions'});
    });
});
