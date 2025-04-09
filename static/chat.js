const socket = io();

const chatMessages = document.getElementById("chat-messages");
const messageInput = document.getElementById("message-input");
const sendButton = document.getElementById("send-button");
const usernameInput = document.getElementById("username-input");
const updateUsernameButton = document.getElementById("update-username-button");
const currentUsername = document.getElementById("current-username");
const webcam = document.getElementById("webcam");
const voiceButton = document.getElementById("voice-button");

let myUsername = null;
const userColors = {};
const colorPalette = [
    "#f94144", "#f3722c", "#f9c74f", "#90be6d", "#577590",
    "#9b5de5", "#00bbf9", "#00f5d4", "#ffc300", "#ff6d00"
];

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

async function startWebcam() {
    console.log("Requesting webcam access...");
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        webcam.srcObject = stream;
        console.log("Webcam stream connected");
    } catch (err) {
        console.error("Webcam error:", err);
    }
}

startWebcam();

function appendMessage({ username, avatar, message }) {
    const msgEl = document.createElement("div");
    if (username === "System") {
        msgEl.style.textAlign = "center";
        msgEl.style.fontStyle = "italic";
        msgEl.style.color = "#888";
        msgEl.style.margin = "10px 0";
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
            <img src="${avatar}" alt="avatar" class="avatar">
            <div class="message-content">
                <strong>${username}</strong>
                <span>${message}</span>
            </div>
        `;
    }
    chatMessages.appendChild(msgEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    if (username === "Assistant") {
        speak(message);
    }
}

function speak(message) {
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = "en-US";
    speechSynthesis.speak(utterance);
}

function startContinuousSpeechBot() {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = function(event) {
        const transcript = event.results[event.results.length - 1][0].transcript.trim();
        console.log("Voice captured:", transcript);
        if (transcript) {
            socket.emit("send_message", { message: `/bot ${transcript}` });
        }
    };

    recognition.onerror = function(event) {
        console.error("Speech recognition error:", event);
        recognition.stop();
        setTimeout(() => recognition.start(), 1000); // Restart on error
    };

    recognition.onend = () => {
        console.warn("Speech recognition ended, restarting...");
        recognition.start();
    };

    recognition.start();
    console.log("Continuous speech bot started");
}

startContinuousSpeechBot();

socket.on("set_username", (data) => {
    myUsername = data.username;
    currentUsername.textContent = myUsername;
});

socket.on("new_message", (data) => {
    appendMessage(data);
});

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

voiceButton.addEventListener("click", () => {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = "en-US";
    recognition.start();

    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        messageInput.value = transcript;
    };

    recognition.onerror = function(event) {
        console.error("Speech recognition error:", event);
    };
});

updateUsernameButton.addEventListener("click", () => {
    const newUsername = usernameInput.value.trim();
    if (newUsername) {
        socket.emit("update_username", { username: newUsername });
        usernameInput.value = "";
    }
});

socket.on("username_updated", (data) => {
    if (currentUsername.textContent === data.old_username) {
        currentUsername.textContent = data.new_username;
    }
});

socket.on("user_joined", (data) => {
    appendMessage({
        username: "System",
        avatar: "",
        message: `${data.username} joined the chat.`
    });
});

socket.on("user_left", (data) => {
    appendMessage({
        username: "System",
        avatar: "",
        message: `${data.username} left the chat.`
    });
});
