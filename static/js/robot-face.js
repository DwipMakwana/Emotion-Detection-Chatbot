// robot-face.js
// This file creates and animates a 3D robot face for the Gideon assistant

// Initialize global variables
let scene, camera, renderer;
let robotFace = {
    head: null,
    eyes: {
        left: null,
        right: null
    },
    mouth: null
};
let isAnimating = false;
let animationFrameId = null;

// Colors
const ROBOT_COLORS = {
    primary: 0x4c4cff,    // Blue color matching Gideon's chat bubble
    secondary: 0x00aaff,   // Lighter blue for accents
    highlight: 0xf9c74f,   // Yellow highlight for eyes
    dark: 0x1a1a2e         // Dark blue for shading
};

// Initialize the 3D scene
function initRobotFace() {
    const container = document.getElementById('robot-face-container');
    
    // Get container dimensions instead of window
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.background.alpha = 0;

    // Create camera - adjusted for container
    camera = new THREE.PerspectiveCamera(
        45,
        containerWidth / containerHeight,
        0.1,
        1000
    );
    camera.position.z = 7; // Moved closer

    // Create renderer with transparency
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(containerWidth, containerHeight);
    container.appendChild(renderer.domElement);

    // Create ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Create directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // Create robot face components
    createRobotFace();
    
    // Update resize handler to use container dimensions
    window.addEventListener('resize', onWindowResize);
    
    // Start animation loop
    animate();
}

function createRobotFace() {
    // Create robot head
    const headGeometry = new THREE.SphereGeometry(2, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.8);
    const headMaterial = new THREE.MeshPhongMaterial({
        color: ROBOT_COLORS.primary,
        specular: 0x111111,
        shininess: 30,
        transparent: true,
        opacity: 0.9
    });
    
    robotFace.head = new THREE.Mesh(headGeometry, headMaterial);
    robotFace.head.position.y = 0.5;
    scene.add(robotFace.head);
    
    // Add face plate
    const facePlateGeometry = new THREE.SphereGeometry(1.9, 32, 32, Math.PI * 0.2, Math.PI * 1.6, Math.PI * 0.1, Math.PI * 0.6);
    const facePlateMaterial = new THREE.MeshPhongMaterial({
        color: ROBOT_COLORS.dark,
        specular: 0x222222,
        shininess: 30,
        transparent: true,
        opacity: 0.8
    });
    
    const facePlate = new THREE.Mesh(facePlateGeometry, facePlateMaterial);
    facePlate.position.z = 0.1;
    robotFace.head.add(facePlate);
    
    // Create left eye
    const eyeGeometry = new THREE.SphereGeometry(0.3, 32, 32);
    const eyeMaterial = new THREE.MeshPhongMaterial({
        color: ROBOT_COLORS.highlight,
        emissive: ROBOT_COLORS.highlight,
        emissiveIntensity: 0.5,
        specular: 0xffffff
    });
    
    robotFace.eyes.left = new THREE.Mesh(eyeGeometry, eyeMaterial);
    robotFace.eyes.left.position.set(-0.8, 0.5, 1.5);
    scene.add(robotFace.eyes.left);
    
    // Create right eye
    robotFace.eyes.right = new THREE.Mesh(eyeGeometry, eyeMaterial);
    robotFace.eyes.right.position.set(0.8, 0.5, 1.5);
    scene.add(robotFace.eyes.right);
    
    // Create mouth
    const mouthGeometry = new THREE.BoxGeometry(1.6, 0.1, 0.1);
    const mouthMaterial = new THREE.MeshPhongMaterial({
        color: ROBOT_COLORS.secondary,
        emissive: ROBOT_COLORS.secondary,
        emissiveIntensity: 0.2
    });
    
    robotFace.mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
    robotFace.mouth.position.set(0, -0.5, 1.7);
    scene.add(robotFace.mouth);
    
    // Add circuitry details to the head
    addCircuitryDetails();
}

function addCircuitryDetails() {
    // Add circuit lines to the head
    for (let i = 0; i < 5; i++) {
        const lineGeometry = new THREE.BoxGeometry(0.05, 0.05, 4);
        const lineMaterial = new THREE.MeshPhongMaterial({
            color: ROBOT_COLORS.secondary,
            emissive: ROBOT_COLORS.secondary,
            emissiveIntensity: 0.3
        });
        
        const line = new THREE.Mesh(lineGeometry, lineMaterial);
        line.position.set(-1.5 + i * 0.75, 1.5, 0);
        line.rotation.x = Math.PI / 2;
        robotFace.head.add(line);
    }
    
    // Add glowing nodes
    for (let i = 0; i < 8; i++) {
        const nodeGeometry = new THREE.SphereGeometry(0.08, 16, 16);
        const nodeMaterial = new THREE.MeshPhongMaterial({
            color: ROBOT_COLORS.highlight,
            emissive: ROBOT_COLORS.highlight,
            emissiveIntensity: 0.5
        });
        
        const node = new THREE.Mesh(nodeGeometry, nodeMaterial);
        const angle = (i / 8) * Math.PI * 2;
        node.position.set(
            Math.sin(angle) * 1.8,
            Math.cos(angle) * 1.8 * 0.7 + 0.3,
            Math.cos(angle) * Math.sin(angle) * 0.5
        );
        robotFace.head.add(node);
    }
}

function animateSpeaking() {
    if (!isAnimating) return;
    
    // Animate mouth
    const time = Date.now() * 0.001;
    robotFace.mouth.scale.y = 1 + Math.sin(time * 15) * 0.5 + 0.5;
    
    // Subtle eye pulsing
    const pulseIntensity = (Math.sin(time * 3) * 0.1) + 0.9;
    robotFace.eyes.left.scale.set(pulseIntensity, pulseIntensity, pulseIntensity);
    robotFace.eyes.right.scale.set(pulseIntensity, pulseIntensity, pulseIntensity);
    
    // Subtle head movement
    robotFace.head.rotation.y = Math.sin(time * 0.5) * 0.05;
    robotFace.head.rotation.x = Math.sin(time * 0.7) * 0.03;
}

function onWindowResize() {
    const container = document.getElementById('robot-face-container');
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    camera.aspect = containerWidth / containerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(containerWidth, containerHeight);
}

function animate() {
    animationFrameId = requestAnimationFrame(animate);
    
    // Animate speaking if active
    if (isAnimating) {
        animateSpeaking();
    } else {
        // Reset mouth when not speaking
        if (robotFace.mouth) {
            robotFace.mouth.scale.y = 1;
        }
    }
    
    // Always rotate the head slightly to give a "floating" effect
    if (robotFace.head) {
        const time = Date.now() * 0.001;
        robotFace.head.position.y = 0.5 + Math.sin(time) * 0.05;
    }
    
    renderer.render(scene, camera);
}

// Start speaking animation
function startSpeaking() {
    console.log("Start speaking animation");
    isAnimating = true;
}

// Stop speaking animation
function stopSpeaking() {
    console.log("Stop speaking animation");
    isAnimating = false;
    
    // Reset mouth
    if (robotFace.mouth) {
        robotFace.mouth.scale.y = 1;
    }
}

// Initialize when document is loaded
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        initRobotFace();
        
        // Make functions globally accessible
        window.startSpeaking = startSpeaking;
        window.stopSpeaking = stopSpeaking;
        
        // Initially mouth should not be animated
        isAnimating = false;
    }, 500); // Small delay to ensure DOM is fully ready
});