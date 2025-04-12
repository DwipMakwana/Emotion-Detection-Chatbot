// Global variables
let videoElement;
let canvasElement;
let canvasContext;
let webcamStream;
let isCapturing = false;
let captureInterval;
const CAPTURE_INTERVAL_MS = 500; // Send a frame every 500ms

// Initialize webcam when document is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log("Initializing browser-based webcam capture");
    
    // Get DOM elements
    videoElement = document.getElementById('webcam-video');
    canvasElement = document.getElementById('webcam-canvas');
    
    if (!videoElement || !canvasElement) {
        console.error("Required video or canvas elements not found");
        return;
    }
    
    // Initialize canvas for frame capture
    canvasContext = canvasElement.getContext('2d');
    
    // Start webcam after user provides username and overlay is removed
    const startButton = document.getElementById('overlay-start-button');
    if (startButton) {
        // We'll initialize the webcam after user starts the chat
        startButton.addEventListener('click', function() {
            // Small delay to ensure the overlay is removed first
            setTimeout(initWebcam, 500);
        });
    } else {
        console.error("Start button not found");
    }
});

// Initialize webcam access and setup
async function initWebcam() {
    try {
        // Request webcam access
        webcamStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 320 },
                height: { ideal: 240 },
                facingMode: 'user'
            },
            audio: false
        });
        
        // Set video source to webcam stream
        videoElement.srcObject = webcamStream;
        videoElement.style.display = 'block';
        
        // Wait for video to be ready
        videoElement.onloadedmetadata = function() {
            // Set canvas dimensions to match video
            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;
            
            console.log(`Webcam initialized: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
            
            // Start capturing frames
            startCapturing();
        };
    } catch (error) {
        console.error("Error accessing webcam:", error.message);
        const emotionText = document.getElementById('emotion-text');
        if (emotionText) {
            emotionText.textContent = "Webcam access denied or unavailable";
        }
    }
}

// Start capturing and sending frames
function startCapturing() {
    if (isCapturing) return;
    
    isCapturing = true;
    console.log("Starting frame capture");
    
    // Capture and send frames at regular intervals
    captureInterval = setInterval(captureAndSendFrame, CAPTURE_INTERVAL_MS);
    
    // Also update the emotion text
    fetchEmotionUpdates();
}

// Stop capturing frames
function stopCapturing() {
    if (!isCapturing) return;
    
    isCapturing = false;
    clearInterval(captureInterval);
    console.log("Stopped frame capture");
}

// Capture frame and send to server
function captureAndSendFrame() {
    if (!isCapturing || !videoElement || !canvasContext) return;
    
    try {
        // Draw current video frame to canvas
        canvasContext.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
        
        // Convert canvas to JPEG data URL
        const frameDataUrl = canvasElement.toDataURL('image/jpeg', 0.8);
        
        // Send to server using fetch
        fetch('/process_frame', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                frame: frameDataUrl
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
        })
        .catch(error => {
            console.error('Error sending frame to server:', error);
        });
    } catch (error) {
        console.error('Error capturing frame:', error);
    }
}

// Periodically fetch emotion updates from server
function fetchEmotionUpdates() {
    setInterval(function() {
        fetch('/emotion')
            .then(response => response.text())
            .then(data => {
                const emotionText = document.getElementById('emotion-text');
                if (emotionText) {
                    emotionText.textContent = data;
                }
            })
            .catch(err => console.error("Error fetching emotion:", err));
    }, 500);
}

// Clean up resources when page is unloaded
window.addEventListener('beforeunload', function() {
    stopCapturing();
    
    // Stop and release webcam stream
    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
    }
});