from flask import Flask, Response, render_template, request, send_from_directory, jsonify
from flask_socketio import SocketIO, emit
import cv2
import numpy as np
from fer import FER
import threading
import time
import os
import sys
import random
import base64
from openai import OpenAI
import os
from dotenv import load_dotenv

app = Flask("Gideon", template_folder='./templates', static_folder='static')
socketio = SocketIO(app)

# Initialize the emotion detector
emotion_detector = FER(mtcnn=True)

# Load environment variables for API keys
load_dotenv()

# Configure OpenAI client
try:
    # Initialize OpenAI client
    openai_client = OpenAI(api_key="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")
    
    if os.getenv("OPENAI_API_KEY"):
        print("OpenAI API key loaded successfully")
    else:
        print("Warning: OpenAI API key not found in environment variables")
    
    # Initialize lock for API calls
    api_lock = threading.Lock()
except Exception as e:
    print(f"Error setting up LLM integration: {e}")
    openai_client = None

# Global variables
current_emotion = "No face detected"
lock = threading.Lock()
users = {}

def detect_emotion(frame):
    """Detect emotion in a frame without auto-responding"""
    global current_emotion
    
    try:
        # Detect emotions
        emotions = emotion_detector.detect_emotions(frame)
        
        if emotions:
            # Get the dominant emotion
            dominant_emotion = emotions[0]['emotions']
            emotion_name = max(dominant_emotion, key=dominant_emotion.get)
            emotion_score = dominant_emotion[emotion_name]
            
            with lock:
                current_emotion = f"You feel {round(emotion_score * 100)}% {emotion_name.capitalize()}"
        else:
            with lock:
                current_emotion = "No face detected"
    except Exception as e:
        print(f"Error in emotion detection: {e}")
        with lock:
            current_emotion = "Error in emotion detection"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory('static', path)

@app.route('/emotion')
def get_emotion():
    """Return the current detected emotion"""
    with lock:
        return current_emotion

@app.route('/process_frame', methods=['POST'])
def process_frame():
    """Process frames sent from the browser"""
    try:
        # Get the frame data from the request
        data = request.get_json()
        if not data or 'frame' not in data:
            return jsonify({'error': 'No frame data provided'}), 400
        
        # Decode the base64 image
        frame_data = data['frame'].split(',')[1]  # Remove data URL prefix
        frame_bytes = base64.b64decode(frame_data)
        
        # Convert to numpy array
        np_arr = np.frombuffer(frame_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        
        if frame is None or frame.size == 0:
            print("Received invalid frame")
            return jsonify({'status': 'error', 'message': 'Invalid frame'}), 400
        
        # Process the frame for emotion detection in a separate thread
        threading.Thread(target=detect_emotion, args=(frame.copy(),), daemon=True).start()
        
        return jsonify({'status': 'success'}), 200
    
    except Exception as e:
        print(f"Error processing frame: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

def get_llm_response(query, emotion=None):
    """Get response from LLM based on text and emotion using updated OpenAI API"""
    if not openai_client:
        return "I'm having trouble connecting to my response system. Could you tell me more about how you're feeling?"
    
    try:
        # Prepare prompt based on emotion and query
        if emotion and emotion != "No face detected" and "Error" not in emotion:
            system_prompt = f"""You are Gideon, a mental health assistant. You provide brief, supportive responses 
            to users. The user's facial expression shows they are feeling {emotion}. 
            Acknowledge their emotion appropriately and provide a helpful, empathetic response.
            Keep your response under 3 sentences and focus on practical support."""
        else:
            system_prompt = """You are Gideon, a mental health assistant. You provide brief, supportive responses 
            to users. Keep your response under 3 sentences and focus on practical support."""
        
        with api_lock:  # Thread-safe API usage
            response = openai_client.chat.completions.create(
                model="gpt-3.5-turbo",  # or "gpt-4" for more advanced responses
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": query}
                ],
                max_tokens=150,
                temperature=0.7
            )
        
        # Extract and return the response text (updated for new API response structure)
        if response and response.choices and len(response.choices) > 0:
            return response.choices[0].message.content.strip()
        else:
            return "I'm here to support you. Could you tell me more about what's on your mind?"
    except Exception as e:
        print(f"Error in LLM API call: {e}")
        return "I'm listening and want to help. Can you share more about how you're feeling right now?"
    
def get_claude_response(query, emotion=None):
    """Get response from Claude API based on text and emotion"""
    try:
        import anthropic
        
        client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        
        # Prepare prompt based on emotion and query
        if emotion and emotion != "No face detected" and "Error" not in emotion:
            system_prompt = f"""You are Gideon, a mental health assistant. You provide brief, supportive responses 
            to users. The user's facial expression shows they are feeling {emotion}. 
            Acknowledge their emotion appropriately and provide a helpful, empathetic response.
            Keep your response under 3 sentences and focus on practical support."""
        else:
            system_prompt = """You are Gideon, a mental health assistant. You provide brief, supportive responses 
            to users. Keep your response under 3 sentences and focus on practical support."""
        
        with api_lock:  # Thread-safe API usage
            response = client.messages.create(
                model="claude-3-sonnet-20240229",  # or another Claude model
                system=system_prompt,
                max_tokens=150,
                temperature=0.7,
                messages=[
                    {"role": "user", "content": query}
                ]
            )
        
        # Extract and return the response text
        if response and response.content:
            return response.content[0].text
        else:
            return "I'm here to support you. Could you tell me more about what's on your mind?"
    except Exception as e:
        print(f"Error in Claude API call: {e}")
        return "I'm listening and want to help. Can you share more about how you're feeling right now?"

def process_mental_health_query(query, detected_emotion=""):
    """Process mental health queries using LLM and detected emotion"""
    # Get response from LLM
    llm_response = get_llm_response(query, detected_emotion)
    
    # If we have a response, use it
    if llm_response:
        return llm_response
    
    # Fallback response if LLM fails
    return "I'm here to listen and support you. Could you tell me more about how you're feeling?"

def generate_response(user_input, emotion):
    return process_mental_health_query(user_input, emotion)

@socketio.on("connect")
def handle_connect():
   # Don't do anything here now - wait for set_custom_username event
   pass

@socketio.on("disconnect")
def handle_disconnect():
    user = users.pop(request.sid, None)
    if user:
        emit("user_left", {"username": user["username"]}, broadcast=True)

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

        # Get current emotion to incorporate into response
        with lock:
            current_user_emotion = current_emotion
        
        # Extract emotion type from current_emotion string
        emotion_type = ""
        if "You feel" in current_user_emotion:
            emotion_text = current_user_emotion.lower()
            if "angry" in emotion_text:
                emotion_type = "angry"
            elif "sad" in emotion_text:
                emotion_type = "sad"
            elif "fear" in emotion_text or "afraid" in emotion_text:
                emotion_type = "fear"
            elif "disgust" in emotion_text:
                emotion_type = "disgust"
            elif "happy" in emotion_text:
                emotion_type = "happy"
            elif "surprised" in emotion_text:
                emotion_type = "surprised"
            elif "neutral" in emotion_text:
                emotion_type = "neutral"
        
        # Generate response considering both message content and emotion
        reply = process_mental_health_query(message, emotion_type)
        
        # Add a small delay to make the response feel more natural
        time.sleep(1)
        
        # Include emotion acknowledgment if an emotion is detected
        emotion_context = ""
        if emotion_type and emotion_type not in ["neutral"]:
            emotion_context = f"I notice you seem {emotion_type}. "
        
        socketio.emit("new_message", {
            "username": "Gideon",
            "avatar": "/static/gideon.png",
            "message": emotion_context + reply
        }, to=request.sid)  # Send only to the user who sent the message

@socketio.on("set_custom_username")
def handle_custom_username(data):
    username = data.get("username", f"User{random.randint(1000, 9999)}")
    avatar_url = "/static/avatar.png"
    
    # Store the user information
    users[request.sid] = {"username": username, "avatar": avatar_url}
    
    # Notify about the new user
    emit("user_joined", {"username": username, "avatar": avatar_url}, broadcast=True)
    emit("set_username", {"username": username})
    
    # Send welcome message IMMEDIATELY - no delay
    socketio.emit("new_message", {
        "username": "Gideon",
        "avatar": "/static/gideon.png",
        "message": f"Hello {username}! I'm Gideon, your mental health assistant. I can see how you're feeling and I'm here to help. How are you doing today?"
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
    try:
        # Create static folder if it doesn't exist
        os.makedirs("static", exist_ok=True)
        
        print("Starting Gideon Mental Health Assistant")
        socketio.run(app, debug=False, host='0.0.0.0', port=5000)
    except Exception as e:
        print(f"Error starting app: {e}")
        sys.exit(1)