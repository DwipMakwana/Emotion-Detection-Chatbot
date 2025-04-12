FROM python:3.10-slim

WORKDIR /app

# Install system dependencies including OpenCV dependencies
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    python3-dev \
    gcc \
    g++ \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt
RUN apt-get update && apt-get install -y v4l-utils

# Copy application code
COPY . .

# Create directories if they don't exist
RUN mkdir -p static/models

# Make sure the application is accessible outside the container
EXPOSE 5000

# Command to run the application
CMD ["python", "app.py"]