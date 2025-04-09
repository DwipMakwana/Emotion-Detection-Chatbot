from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit
import random

app = Flask(__name__)
socketio = SocketIO(app)

users = {}

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on("connect")
def handle_connect():
    username = f"User_{random.randint(1000, 9999)}"
    gender = random.choice(["girl", "boy"])
    avatar_url = f"https://avatar.iran.liara.run/public/{gender}?username={username}"
    users[request.sid] = {"username": username, "avatar": avatar_url}
    emit("user_joined", {"username": username, "avatar": avatar_url}, broadcast=True)
    emit("set_username", {"username": username})

@socketio.on("disconnect")
def handle_disconnect():
    user = users.pop(request.sid, None)
    if user:
        emit("user_left", {"username": user["username"]}, broadcast=True)

def process_bot_command(query):
    lower = query.lower()
    if "reverse a list" in lower:
        return "In Python, use `my_list[::-1]` or `my_list.reverse()`."
    elif "hello" in lower:
        return "Hi there! Need coding help? Type `/bot your question`."
    else:
        return "I'm just a baby bot. I only understand a few commands right now."

@socketio.on("send_message")
def handle_message(data):
    user = users.get(request.sid)
    message = data["message"]
    if user:
        emit("new_message", {
            "username": user["username"],
            "avatar": user["avatar"],
            "message": message
        }, broadcast=True)

        if message.startswith("/bot "):
            query = message[5:].strip()
            reply = process_bot_command(query)
            socketio.emit("new_message", {
                "username": "Assistant",
                "message": reply
            }, to=request.sid)

@socketio.on("update_username")
def handle_update_username(data):
    old_username = users[request.sid]["username"]
    new_username = data["username"]
    users[request.sid]["username"] = new_username
    emit("username_updated", {
        "old_username": old_username,
        "new_username": new_username
    }, broadcast=True)

if __name__ == '__main__':
    socketio.run(app)
