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

app = Flask(__name__, template_folder='./templates', static_folder='static')
socketio = SocketIO(app)

# Initialize the emotion detector
emotion_detector = FER(mtcnn=True)

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

def get_mental_health_response(emotion):
    """Generate mental health responses based on detected emotion"""
    responses = {
        "angry": [
            "I'm noticing you seem upset. Would you like to talk about what's bothering you?",
            "Taking deep breaths can help when feeling angry. Would you like me to guide you through a quick exercise?",
            "It's okay to feel angry. Would it help to talk about what triggered these feelings?"
        ],
        "sad": [
            "I notice you're feeling down. Remember that it's okay to not be okay sometimes.",
            "Would sharing what's on your mind help you process these feelings?",
            "Is there something specific that's making you feel sad today?"
        ],
        "fear": [
            "I'm detecting signs of anxiety. Would you like to try a grounding exercise?",
            "Remember that you're safe right now. Would talking about your concerns help?",
            "Fear is a natural response. Can I help you work through what's causing this feeling?"
        ],
        "disgust": [
            "I notice you seem uncomfortable. Would you like to talk about what's bothering you?",
            "Sometimes changing our environment can help when we feel disgusted or uncomfortable.",
            "Would it help to focus on something positive right now?"
        ]
    }
    
    if emotion in responses:
        return random.choice(responses[emotion])
    else:
        return "How are you feeling today? I'm here to talk if you need me."

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
    username = f"User{random.randint(1000, 9999)}"
    gender = random.choice(["girl", "boy"])
    avatar_url = "/static/avatar.png"
    users[request.sid] = {"username": username, "avatar": avatar_url}
    emit("user_joined", {"username": username, "avatar": avatar_url}, broadcast=True)
    emit("set_username", {"username": username})
    
    # Welcome message from Gideon
    socketio.emit("new_message", {
        "username": "Gideon",
        "avatar": "/static/gideon.png",
        "message": "Hello! I'm Gideon, your mental health assistant. I can see how you're feeling and I'm here to help. How are you doing today?"
    }, to=request.sid)

@socketio.on("disconnect")
def handle_disconnect():
    user = users.pop(request.sid, None)
    if user:
        emit("user_left", {"username": user["username"]}, broadcast=True)

def process_mental_health_query(query, detected_emotion=""):
    """Process mental health related queries with emotion context"""
    query_lower = query.lower()
    
    # Enhanced responses that incorporate detected emotion
    if detected_emotion in ["angry", "disgust"]:
        if "anxious" in query_lower or "anxiety" in query_lower:
            return "I understand you're feeling frustrated. For anxiety, try the 3-3-3 rule: Name 3 things you see, 3 sounds you hear, and move 3 parts of your body. This can help redirect that energy to the present moment."
    elif detected_emotion in ["sad", "fear"]:
        if "anxious" in query_lower or "anxiety" in query_lower:
            return "I can see you're feeling down. Anxiety often accompanies sadness, and that's completely normal. The 3-3-3 grounding technique might help: Notice 3 things you see, 3 sounds you hear, and move 3 parts of your body gently."
    
    # Original responses as fallback
    if "anxious" in query_lower or "anxiety" in query_lower:
        return "Anxiety is common and treatable. Try the 3-3-3 rule: Name 3 things you see, 3 sounds you hear, and move 3 parts of your body. This can help ground you in the present moment."
    
    elif "sad" in query_lower or "depressed" in query_lower or "depression" in query_lower:
        return "I'm sorry you're feeling this way. Depression is real and valid. Small steps like getting some sunlight, talking to someone you trust, or doing one small enjoyable activity can help. Would you like to talk more about what's bothering you?"
    
    elif "stress" in query_lower or "stressed" in query_lower:
        return "Stress affects everyone differently. Taking a few minutes for deep breathing, going for a walk, or writing down your thoughts can help manage stress. What specifically is causing you stress right now?"
    
    elif "lonely" in query_lower or "alone" in query_lower:
        return "Feeling lonely is tough, but remember that connection comes in many forms. Could you reach out to someone today, even just for a brief chat? Or perhaps join an online community with shared interests?"
    
    elif "tired" in query_lower or "exhausted" in query_lower or "fatigue" in query_lower:
        return "Mental and physical fatigue can be closely linked. Are you getting enough rest? Sometimes, a short break doing something you enjoy can be rejuvenating."
    
    elif "help" in query_lower or "resources" in query_lower:
        return "If you need immediate support, consider calling a mental health helpline. For the US, the 988 Suicide & Crisis Lifeline is available 24/7. Would you like me to provide more specific resources?"
    
    elif "hello" in query_lower or "hi" in query_lower or "hey" in query_lower:
        return "Hello there! How are you feeling today? I'm here to listen and support you."
    
    elif "thank" in query_lower:
        return "You're welcome! I'm here anytime you need to talk. Taking care of your mental health is important, and I'm glad I could help."
    
    elif "bye" in query_lower or "goodbye" in query_lower:
        return "Take care of yourself! Remember I'm here whenever you need support. Have a peaceful day."
    
    else:
        return "I'm here to listen and support you. Could you tell me more about how you're feeling?"

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
        
        # Always respond to the message without needing /gideon command
        # Consider the detected emotion when drafting the response
        emotion_context = ""
        emotion_type = ""
        
        if "Detected emotion:" in current_user_emotion:
            emotion_parts = current_user_emotion.split(": ")[1].split(" (")
            if len(emotion_parts) > 0:
                emotion_type = emotion_parts[0].lower()
                emotion_context = f"I notice you seem {emotion_type}. "
        
        # Generate response considering both message content and emotion
        reply = process_mental_health_query(message, emotion_type)
        
        # Add a small delay to make the response feel more natural
        time.sleep(1)
        
        socketio.emit("new_message", {
            "username": "Gideon",
            "avatar": "/static/gideon.png",
            "message": emotion_context + reply
        }, to=request.sid)  # Send only to the user who sent the message


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