from flask import Flask, Response, render_template, request, send_from_directory
from flask_socketio import SocketIO, emit
import cv2
import numpy as np
from fer import FER
import threading
import time
import os
import sys
import random
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
    openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
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
camera = None
users = {}

def get_camera():
    """Get or create camera object"""
    global camera
    if camera is None:
        camera = cv2.VideoCapture(0)
        # Give camera time to initialize
        time.sleep(1)
    return camera

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

shutdown_event = threading.Event()

def generate_frames():
    """Generator function for video streaming"""
    global current_emotion
    
    # Try to get the camera
    try:
        cap = get_camera()
        if not cap.isOpened():
            print("Could not open webcam")
            yield (b'--frame\r\n'
                b'Content-Type: text/plain\r\n\r\n'
                b'Could not open webcam\r\n')
            return
    except Exception as e:
        print(f"Error opening camera: {e}")
        yield (b'--frame\r\n'
            b'Content-Type: text/plain\r\n\r\n'
            b'Error opening camera\r\n')
        return
    
    while not shutdown_event.is_set():
        try:
            success, frame = cap.read()
            if not success:
                print("Failed to capture image")
                time.sleep(0.1)
                continue
            
            # Process frame for emotion in a separate thread to avoid blocking
            emotion_thread = threading.Thread(target=detect_emotion, args=(frame.copy(),), daemon=True)
            emotion_thread.start()
            
            # # Add emotion text to the frame
            # with lock:
            #     emotion_text = current_emotion

            # font = cv2.FONT_HERSHEY_SIMPLEX
            # cv2.putText(frame, emotion_text, (10, frame.shape[0] - 20), font, 0.8, (0, 255, 0), 2)
            
            # Encode the frame as JPEG
            ret, buffer = cv2.imencode('.jpg', frame)
            frame_bytes = buffer.tobytes()
            
            # Yield the frame in the HTTP response - NOTE: Fixed backslashes here
            yield (b'--frame\r\n'
                  b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            
            # Wait for emotion thread to complete
            emotion_thread.join(timeout=0.1)
            
            # Small delay to reduce CPU usage
            time.sleep(0.01)
        except Exception as e:
            print(f"Error in frame generation: {e}")
            time.sleep(0.1)

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

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/video_feed')
def video_feed():
    """Video streaming route with proper headers"""
    response = Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')
    # Add headers to prevent caching
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory('static', path)

@app.route('/emotion')
def get_emotion():
    """Return the current detected emotion"""
    with lock:
        return current_emotion

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

def cleanup():
    shutdown_event.set()
    global camera
    if camera is not None and camera.isOpened():
        camera.release()
    print("Camera resources released")

if __name__ == '__main__':
    try:
        # Register cleanup handler
        import atexit
        atexit.register(cleanup)
        
        # Create static folder if it doesn't exist
        os.makedirs("static", exist_ok=True)
        
        print("Starting Gideon Mental Health Assistant")
        socketio.run(app, debug=False, host='0.0.0.0', port=5000)
    except Exception as e:
        print(f"Error starting app: {e}")
        cleanup()
        sys.exit(1)