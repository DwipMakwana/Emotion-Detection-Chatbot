# Gideon - Mental Health Assistant

Gideon is an AI-powered mental health assistant that uses facial emotion recognition to provide supportive responses.

## Features

- Real-time facial emotion detection
- AI-generated responses considering detected emotions
- Interactive chat interface
- Voice input capability
- Animated 3D face to represent Gideon

## Running with Docker

### Prerequisites

- Docker and Docker Compose installed
- Webcam
- OpenAI and/or Anthropic API key

### Setup

1. Clone this repository
2. Create a `.env` file with your API keys (copy from `.env.example`)
3. Build and run with Docker Compose:

```bash
docker-compose up
```

4. Open your browser and navigate to `http://localhost:5000`

## Access from Other Devices

If you want to allow others on your local network to access Gideon:

1. Find your local IP address
2. Share the URL: `http://YOUR_IP_ADDRESS:5000`

## Notes for Development

- The application uses Flask and SocketIO for the web interface
- Emotion detection is performed using the FER library
- AI responses are generated using OpenAI or Anthropic APIs
- The 3D face is rendered using Three.js

## Troubleshooting

If the webcam doesn't work:
- Make sure your webcam is not being used by another application
- You may need to modify the device path in docker-compose.yml
- On Windows, you might need to use WSL2 with additional configuration for webcam access