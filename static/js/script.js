const socket = io();

        const chatMessages = document.getElementById("chat-messages");
        const messageInput = document.getElementById("message-input");
        const sendButton = document.getElementById("send-button");
        const usernameInput = document.getElementById("username-input");
        //const updateUsernameButton = document.getElementById("update-username-button");
        const currentUsername = document.getElementById("current-username");
        const voiceButton = document.getElementById("voice-button");
        const emotionText = document.getElementById("emotion-text");

        let myUsername = null;

        const userColors = {};
        const colorPalette = [
            "#f94144", "#f3722c", "#f9c74f", "#90be6d", "#577590",
            "#9b5de5", "#00bbf9", "#ffc300", "#ff6d00"
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

        // Assign a special color for Gideon
        userColors["Gideon"] = "#4c4cff";

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
                speak(message);
            }
        }

        function speak(message) {
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(message);
                utterance.lang = "en-US";
                speechSynthesis.speak(utterance);
            }
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
                voiceButton.textContent = "🛑 Stop";
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
            voiceButton.textContent = "🎤 Speak";
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

        // socket.on("set_username", (data) => {
        //     myUsername = data.username;
        //     currentUsername.textContent = myUsername;
        // });

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

        // updateUsernameButton.addEventListener("click", () => {
        //     const newUsername = usernameInput.value.trim();
        //     if (newUsername) {
        //         socket.emit("update_username", { username: newUsername });
        //         usernameInput.value = "";
        //     }
        // });

        socket.on("username_updated", (data) => {
            if (data.old_username === myUsername) {
                myUsername = data.new_username;
                currentUsername.textContent = myUsername;
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
        });