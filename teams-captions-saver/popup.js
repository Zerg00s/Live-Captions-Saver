document.addEventListener('DOMContentLoaded', function() {
    // Code inside this block will execute after the page is fully loaded
    console.log('popup.js loaded!');

    const startStopButton = document.getElementById('startStopButton');
    
    startStopButton.addEventListener('click', function() {
        const buttonText = startStopButton.innerText;
        
        // Send a message to background.js to toggle the transcription
        chrome.runtime.sendMessage({message: 'toggle_transcription'});

        // Toggle the button text
        if (buttonText === 'Start Transcription') {
            startStopButton.innerText = 'Stop Transcription';
        } else {
            startStopButton.innerText = 'Start Transcription';
        }
        console.log('toggle_transcription clicked!');
    });
  
    document.getElementById('saveButton').addEventListener('click', function() {
        console.log('save_transcripts clicked!');
        chrome.runtime.sendMessage({message: 'save_transcripts'});
    });
});
