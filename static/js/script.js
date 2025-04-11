const socket = io();

const chatMessages = document.getElementById("chat-messages");
const messageInput = document.getElementById("message-input");
const sendButton = document.getElementById("send-button");
const voiceButton = document.getElementById("voice-button");
const emotionText = document.getElementById("emotion-text");

// Username overlay elements
const usernameOverlay = document.getElementById("username-overlay");
const usernameInput = document.getElementById("overlay-username-input");
const startButton = document.getElementById("overlay-start-button");
const userDisplayName = document.getElementById("user-display-name");

let myUsername = null;

const userColors = {};
const colorPalette = [
    "#f94144", "#f3722c", "#f9c74f", "#90be6d", "#577590",
    "#9b5de5", "#00bbf9", "#ffc300", "#ff6d00"
];

let femaleVoice;

function getVoices() {
    return new Promise((resolve, reject) => {
        let voices = speechSynthesis.getVoices();
        if (voices.length > 0) {
            resolve(voices);
        } else {
            speechSynthesis.onvoiceschanged = function() {
                voices = speechSynthesis.getVoices();
                resolve(voices);
            };
        }
    });
}

getVoices().then((voices) => {
    //console.log(voices);
    femaleVoice = voices.find((voice) => voice.name.includes("Female"));
});

// Initialize socket connection only after user enters their name
let socketInitialized = false;

function initializeSocket(username) {
    if (socketInitialized) return;
    
    // Set the username in the socket connection
    socket.emit("set_custom_username", { username });
    
    // Socket event listeners
    socket.on("new_message", (data) => {
        appendMessage(data);
    });

    socket.on("username_updated", (data) => {
        if (data.old_username === myUsername) {
            myUsername = data.new_username;
            userDisplayName.textContent = myUsername;
        }
        appendMessage({
            username: "System",
            message: `${data.old_username} changed their name to ${data.new_username}`
        });
    });

    socket.on("user_joined", (data) => {
        appendMessage({
            username: "System",
            message: `${data.username} joined the chat.`
        });
    });

    socket.on("user_left", (data) => {
        appendMessage({
            username: "System",
            message: `${data.username} left the chat.`
        });
    });

    socket.on("set_username", (data) => {
        myUsername = data.username;
        userDisplayName.textContent = ``;
    });
    
    socketInitialized = true;
}

function assignColor(username) {
    if (!userColors[username]) {
        const availableColors = colorPalette.filter(c => !Object.values(userColors).includes(c));
        const color = availableColors.length > 0
            ? availableColors[Math.floor(Math.random() * availableColors.length)]
            : "#" + Math.floor(Math.random()*16777215).toString(16);
        userColors[username] = color;
    }
    return userColors[username];
}

// Assign a special color for Gideon
userColors["Gideon"] = "#4c4cff";

// Username overlay event listeners
startButton.addEventListener("click", () => {
    let username = usernameInput.value.trim();
    if (username) {
        if (username.length > 20) {
            username = username.substring(0, 20); // Limit username length
        }
        myUsername = username;
        userDisplayName.textContent = `(${myUsername})`;
        usernameOverlay.style.display = "none";
        
        // Initialize socket AFTER hiding the overlay
        initializeSocket(username);
    } else {
        alert("Please enter a name to continue");
    }
});

usernameInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") startButton.click();
});

document.addEventListener('DOMContentLoaded', function() {
    const videoStream = document.getElementById('video-stream');
    
    // Add error handling for the video feed
    videoStream.onerror = function() {
        console.error("Error loading video feed");
        // Try reloading the video feed
        setTimeout(() => {
            videoStream.src = "/video_feed?" + new Date().getTime(); // Add timestamp to avoid caching
        }, 2000);
    };
    
    // Ensure the video feed is visible
    videoStream.style.display = 'block';
    videoStream.style.width = '100%';
    
    // Set focus to username input
    usernameInput.focus();
    
    // Give a socket connection ready signal with delay
    socket.on("connect", function() {
        // Give time for robot-face.js to fully initialize
        setTimeout(() => {
            //console.log("Socket ready for messages");
        }, 1000);
    });
});

function appendMessage({ username, avatar, message }) {
    const msgEl = document.createElement("div");
    if (username === "System") {
        msgEl.className = "system-message";
        msgEl.textContent = message;
    } else {
        const isSelf = username === myUsername;                
        msgEl.classList.add("message");
        
        if (isSelf) {
            msgEl.classList.add("self");
        } else {
            const userColor = assignColor(username);
            msgEl.style.setProperty('--bubble-color', userColor);
        }

        msgEl.innerHTML = `
        <img src="${avatar}" alt="avatar" class="avatar" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2230%22 height=%2230%22 viewBox=%220 0 24 24%22><circle cx=%2212%22 cy=%2212%22 r=%2210%22 fill=%22%23${username === 'Gideon' ? '4c4cff' : '888888'}%22 /><text x=%2212%22 y=%2216%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2214%22>${username.charAt(0)}</text></svg>'">
        <div class="message-content">
            <strong>${username}</strong>
            <span>${message}</span>
        </div>
        `;
    }
    chatMessages.appendChild(msgEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // If it's from Gideon, speak the message
    if (username === "Gideon") {
        speakMessage(message);
    }
}

function speakMessage(message) {
    // Make sure startSpeaking is called before speech synthesis
    if (window.startSpeaking) {
        window.startSpeaking();
    }
    
    getVoices().then((voices) => {
        const femaleVoice = voices.find((voice) => voice.name.includes("Female"));
        
        // Create and configure the speech utterance
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.lang = "en-US";
        utterance.rate = 1.0; // Normal rate
        utterance.pitch = 1.0; // Normal pitch
        utterance.volume = 1.0; // Full volume
        
        if (femaleVoice) {
            utterance.voice = femaleVoice;
        } else {
            console.log("No female voice found");
        }
        
        // Make sure the mouth stops moving after speech ends
        utterance.onend = function() {
            if (window.stopSpeaking) {
                window.stopSpeaking();
            }
        };
        
        // Stop any ongoing speech before starting new one
        speechSynthesis.cancel();
        
        // Start speaking
        speechSynthesis.speak(utterance);
        
        // Set a backup timer in case the onend event doesn't fire
        setTimeout(() => {
            if (window.stopSpeaking) {
                window.stopSpeaking();
            }
        }, message.length * 100 + 2000); // Rough estimate plus buffer
    });
}

let recognition = null;
let isRecording = false;

voiceButton.addEventListener("click", () => {
    if (!isRecording) {
        // Start recording
        recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.lang = "en-US";
        recognition.continuous = true;
        recognition.interimResults = false;
        
        recognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            messageInput.value = transcript;
        };
        
        recognition.onerror = function(event) {
            console.error("Speech recognition error:", event);
            stopRecording();
        };
        
        recognition.onend = function() {
            // Only call stopRecording if we're still recording
            // This prevents duplicate handling when we call stop() ourselves
            if (isRecording) {
                stopRecording();
            }
        };
        
        recognition.start();
        isRecording = true;
        voiceButton.textContent = "🛑";
        voiceButton.classList.add("recording");
    } else {
        // Stop recording
        stopRecording();
    }
});

function stopRecording() {
    if (recognition) {
        recognition.stop();
    }
    isRecording = false;
    voiceButton.textContent = "🎤";
    voiceButton.classList.remove("recording");
    
    // If there's text in the input, automatically send it
    if (messageInput.value.trim()) {
        sendButton.click();
    }
}

// Update emotion text
setInterval(function() {
    fetch('/emotion')
        .then(response => response.text())
        .then(data => {
            emotionText.innerText = data;
        })
        .catch(err => console.error("Error fetching emotion:", err));
}, 500);

sendButton.addEventListener("click", () => {
    const message = messageInput.value.trim();
    if (message) {
        socket.emit("send_message", { message });
        messageInput.value = "";
    }
});

messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendButton.click();
});