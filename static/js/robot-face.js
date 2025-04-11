// Initialize global variables
let scene, camera, renderer;
let robotFace = {
    model: null,
    head: null,
    eyes: {
        left: null,
        right: null
    },
    mouth: null,
    morphTargets: {} // Store morph targets
};
let isAnimating = false;
let animationFrameId = null;
let mixer = null;
let clock = null;
let morphTargetInfluences = {}; // Store current morph target influences
let speakingInterval = null; // Interval for speaking animation

let cameraZoom = 2;

// Initialize the 3D scene
function initRobotFace() {
    console.log("Initializing robot face");
    
    const container = document.getElementById('robot-face-container');
    if (!container) {
        console.error("Container element not found");
        return;
    }
    
    // Get container dimensions
    const containerWidth = container.clientWidth || 300;
    const containerHeight = container.clientHeight || 300;
    
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.background.alpha = 0;

    // Create camera
    camera = new THREE.PerspectiveCamera(
        45,
        containerWidth / containerHeight,
        0.1,
        1000
    );
    camera.position.z = cameraZoom * (containerWidth / containerHeight);

    // Create renderer with transparency
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(containerWidth, containerHeight);
    container.appendChild(renderer.domElement);

    // Create lights
    const directionalLight = new THREE.DirectionalLight(0x1a1a2e, 30.0);
    directionalLight.position.set(10, 10, 7.5);
    scene.add(directionalLight);

    const directionalLight2 = new THREE.DirectionalLight(0x1a1a2e, 30.0);
    directionalLight2.position.set(-10, 10, 7.5);
    scene.add(directionalLight2);

    const pointLight = new THREE.PointLight(0xffffff, 10.0);
    pointLight.position.set(0, 1.5, 0.5);
    scene.add(pointLight);
    
    const pointLight2 = new THREE.PointLight(0xffffff, 10.0);
    pointLight2.position.set(0, -0.5, 1);
    scene.add(pointLight2);

    // Initialize clock for animations
    clock = new THREE.Clock();
    
    // Load model
    loadModel();
    
    // Handle window resizing
    window.addEventListener('resize', onWindowResize);
    
    // Start animation loop
    animate();

    function modifyInitRobotFace() {
        // Start idle animation after model is loaded
        setTimeout(() => {
            startIdleAnimation();
        }, 1000);
    }
}

function loadModel() {
    if (typeof THREE.GLTFLoader === 'undefined') {
        console.error("GLTFLoader not available, using fallback");
        createFallbackFace();
        return;
    }
    
    const loader = new THREE.GLTFLoader();
    
    loader.load(
        '/static/models/face.glb',
        (gltf) => {
            robotFace.model = gltf.scene;
            
            // Scale and position
            gltf.scene.scale.set(1, 1, 1);
            gltf.scene.position.set(0, -0.1, 0);
            gltf.scene.rotation.set(0, 0, 0.0349066); // 2 degrees in radians
            
            scene.add(robotFace.model);
            
            // Find components and initialize morph targets
            gltf.scene.traverse((node) => {
                if (node.isMesh) {
                    const name = node.name.toLowerCase();
                    
                    // Store references to key face parts
                    if (name.includes('head')) {
                        robotFace.head = node;
                    } else if (name.includes('eye') && name.includes('left')) {
                        robotFace.eyes.left = node;
                    } else if (name.includes('eye') && name.includes('right')) {
                        robotFace.eyes.right = node;
                    } else if (name.includes('mouth')) {
                        robotFace.mouth = node;
                    }
                    
                    // Check for morph targets
                    if (node.morphTargetDictionary && node.morphTargetInfluences) {
                        console.log("Found morph targets on node:", node.name);
                        
                        // Store reference to the node with morph targets
                        robotFace.morphTargets[node.name] = {
                            node: node,
                            dictionary: node.morphTargetDictionary,
                            influences: node.morphTargetInfluences
                        };
                        
                        // Initialize morph target influences
                        Object.keys(node.morphTargetDictionary).forEach(key => {
                            const index = node.morphTargetDictionary[key];
                            morphTargetInfluences[key] = node.morphTargetInfluences[index] || 0;
                        });
                        
                        console.log("Morph targets dictionary:", node.morphTargetDictionary);
                    }
                    
                    // Enhance materials
                    if (node.material) {
                        node.material.needsUpdate = true;
                        
                        if (name.includes('eye')) {
                            node.material.emissive = new THREE.Color(0x4c4cff);
                            node.material.emissiveIntensity = 1.5;
                        }
                    }
                }
            });
            
            // Set up animations if present
            if (gltf.animations && gltf.animations.length > 0) {
                mixer = new THREE.AnimationMixer(robotFace.model);
                if (mixer) {
                    mixer.stopAllAction();
                    gltf.animations.forEach((clip) => {
                        const action = mixer.clipAction(clip);
                        action.stop();
                    });
                }
            }

            // Start idle animation when model is fully loaded
            startIdleAnimation();
        },
        (xhr) => {
            const progress = (xhr.loaded / xhr.total) * 100;
        },
        (error) => {
            console.error('Error loading GLB model:', error);
        }
    );
}

function onWindowResize() {
    const container = document.getElementById('robot-face-container');
    if (container) {
        const width = container.clientWidth || 300;
        const height = container.clientHeight || 300;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);

        // Update camera position to maintain a consistent zoom level
        camera.position.z = cameraZoom * (width / height);
    }
}

function animate() {
    animationFrameId = requestAnimationFrame(animate);
    
    if (mixer) {
        mixer.update(clock.getDelta());
    }
    
    if (robotFace.head) {
        // Add some subtle movement to the head
        robotFace.head.rotation.y += 0.001;
    }
    
    renderer.render(scene, camera);
}

// Set a morph target influence value
function setMorphTarget(targetName, value) {
    // Find which node has this morph target
    for (const nodeName in robotFace.morphTargets) {
        const morphData = robotFace.morphTargets[nodeName];
        if (targetName in morphData.dictionary) {
            const index = morphData.dictionary[targetName];
            morphData.influences[index] = value;
            morphTargetInfluences[targetName] = value;
            return true;
        }
    }
    return false;
}

// Improved animate morph target with better easing
function animateMorphTarget(targetName, fromValue, toValue, duration = 200) {
    const startTime = Date.now();
    
    function update() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Use cubic easing for smoother motion
        const easedProgress = easeInOutCubic(progress);
        
        const currentValue = fromValue + (toValue - fromValue) * easedProgress;
        setMorphTarget(targetName, currentValue);
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    update();
}

// Reset all morph targets to zero
function resetAllMorphTargets() {
    for (const targetName in morphTargetInfluences) {
        setMorphTarget(targetName, 0);
    }
}

// Enhanced start speaking with smoother transitions
function startSpeaking() {
    // Stop idle animation when speaking
    stopIdleAnimation();
    
    if (speakingInterval) {
        clearInterval(speakingInterval);
    }
    
    console.log("Starting speaking animation");
    
    // Define speaking animation patterns
    const mouthTargets = [
        'mouthOpen', 'jawOpen', 'mouthFunnel', 'mouthPucker'
    ];
    
    // Initial expression setup - more gradual
    animateMorphTarget('browInnerUp', 0, 0.3, 500);
    animateMorphTarget('eyeWide_L', 0, 0.2, 500);
    animateMorphTarget('eyeWide_R', 0, 0.2, 500);
    
    // Create more varied and natural speaking patterns
    let speakingStep = 0;
    let lastMouthShape = -1;
    let transitionDuration = 120; // Base duration for transitions
    
    speakingInterval = setInterval(() => {
        // Select a mouth shape that's different from the last one
        let mouthShape;
        do {
            mouthShape = Math.floor(Math.random() * 5);
        } while (mouthShape === lastMouthShape);
        
        lastMouthShape = mouthShape;
        
        // Vary the strength and duration slightly for natural movement
        const strengthVariation = 0.8 + Math.random() * 0.4; // 0.8-1.2 multiplier
        const durationVariation = 0.9 + Math.random() * 0.2; // 0.9-1.1 multiplier
        const actualDuration = Math.floor(transitionDuration * durationVariation);
        
        // Reset previous mouth positions gradually
        mouthTargets.forEach(target => {
            const currentValue = morphTargetInfluences[target] || 0;
            if (currentValue > 0) {
                animateMorphTarget(target, currentValue, 0, actualDuration);
            }
        });
        
        // Apply new mouth shape with varied intensity
        switch (mouthShape) {
            case 0:
                animateMorphTarget('jawOpen', 0, 0.6 * strengthVariation, actualDuration);
                animateMorphTarget('mouthOpen', 0, 0.7 * strengthVariation, actualDuration);
                break;
            case 1:
                animateMorphTarget('mouthFunnel', 0, 0.5 * strengthVariation, actualDuration);
                animateMorphTarget('jawOpen', 0, 0.3 * strengthVariation, actualDuration);
                break;
            case 2:
                animateMorphTarget('mouthPucker', 0, 0.4 * strengthVariation, actualDuration);
                animateMorphTarget('jawOpen', 0, 0.2 * strengthVariation, actualDuration);
                break;
            case 3:
                animateMorphTarget('mouthOpen', 0, 0.3 * strengthVariation, actualDuration);
                animateMorphTarget('jawOpen', 0, 0.5 * strengthVariation, actualDuration);
                break;
            case 4:
                // Sometimes move mouth horizontally
                if (Math.random() > 0.5) {
                    animateMorphTarget('mouthLeft', 0, 0.3 * strengthVariation, actualDuration);
                } else {
                    animateMorphTarget('mouthRight', 0, 0.3 * strengthVariation, actualDuration);
                }
                animateMorphTarget('jawOpen', 0, 0.3 * strengthVariation, actualDuration);
                break;
        }
        
        // Occasional tongue movement
        if (Math.random() < 0.05) {
            animateMorphTarget('tongueOut', 0, 0.3, actualDuration * 2);
            setTimeout(() => {
                animateMorphTarget('tongueOut', 0.3, 0, actualDuration * 2);
            }, actualDuration * 2);
        }
        
        // Occasional eye movements and expressions with smoother timing
        if (speakingStep % 6 === 0) {
            const randomEye = Math.random() > 0.5 ? 'eyeLookUp_' : 'eyeLookDown_';
            const side = Math.random() > 0.5 ? 'L' : 'R';
            const otherSide = side === 'L' ? 'R' : 'L';
            
            animateMorphTarget(randomEye + side, 0, 0.3, 400);
            
            // Sometimes move both eyes
            if (Math.random() > 0.5) {
                animateMorphTarget(randomEye + otherSide, 0, 0.3, 400);
            }
            
            setTimeout(() => {
                animateMorphTarget(randomEye + side, 0.3, 0, 400);
                if (Math.random() > 0.5) {
                    animateMorphTarget(randomEye + otherSide, 0.3, 0, 400);
                }
            }, 600);
        }
        
        // Eyebrow movement variation
        if (speakingStep % 8 === 0) {
            const browMove = Math.random();
            
            if (browMove < 0.33) {
                // Raise inner brows
                animateMorphTarget('browInnerUp', morphTargetInfluences['browInnerUp'] || 0, 
                                   0.5 * strengthVariation, 400);
                setTimeout(() => {
                    animateMorphTarget('browInnerUp', 0.5 * strengthVariation, 0.3, 400);
                }, 600);
            } else if (browMove < 0.66) {
                // Raise outer brows
                animateMorphTarget('browOuterUp_L', 0, 0.4 * strengthVariation, 400);
                animateMorphTarget('browOuterUp_R', 0, 0.4 * strengthVariation, 400);
                setTimeout(() => {
                    animateMorphTarget('browOuterUp_L', 0.4 * strengthVariation, 0, 400);
                    animateMorphTarget('browOuterUp_R', 0.4 * strengthVariation, 0, 400);
                }, 600);
            } else {
                // Lower brows
                animateMorphTarget('browDown_L', 0, 0.3 * strengthVariation, 400);
                animateMorphTarget('browDown_R', 0, 0.3 * strengthVariation, 400);
                setTimeout(() => {
                    animateMorphTarget('browDown_L', 0.3 * strengthVariation, 0, 400);
                    animateMorphTarget('browDown_R', 0.3 * strengthVariation, 0, 400);
                }, 600);
            }
        }
        
        // Random blinks during speaking
        if (Math.random() < 0.05 && !blinkInProgress) {
            blinkInProgress = true;
            animateMorphTarget('eyeBlink_L', 0, 1, 150);
            animateMorphTarget('eyeBlink_R', 0, 1, 150);
            setTimeout(() => {
                animateMorphTarget('eyeBlink_L', 1, 0, 150);
                animateMorphTarget('eyeBlink_R', 1, 0, 150);
                blinkInProgress = false;
            }, 150);
        }
        
        speakingStep++;
    }, 180); // Slightly longer interval for more natural speech rhythm
}

// Enhanced stop speaking with smoother transitions
function stopSpeaking() {
    console.log("Stopping speaking animation");
    
    if (speakingInterval) {
        clearInterval(speakingInterval);
        speakingInterval = null;
    }
    
    // Gradual transition back to neutral
    const mouthTargets = [
        'jawOpen', 'mouthOpen', 'mouthFunnel', 'mouthPucker', 
        'mouthLeft', 'mouthRight', 'tongueOut'
    ];
    
    // Reset mouth-related morph targets with a natural speed
    mouthTargets.forEach(target => {
        const currentValue = morphTargetInfluences[target] || 0;
        if (currentValue > 0) {
            animateMorphTarget(target, currentValue, 0, 400);
        }
    });
    
    // Return to slight smile - do this after a short delay
    setTimeout(() => {
        animateMorphTarget('mouthSmile_L', morphTargetInfluences['mouthSmile_L'] || 0, 0.2, 600);
        animateMorphTarget('mouthSmile_R', morphTargetInfluences['mouthSmile_R'] || 0, 0.2, 600);
        
        // Return brows to neutral
        animateMorphTarget('browInnerUp', morphTargetInfluences['browInnerUp'] || 0, 0, 600);
        animateMorphTarget('browOuterUp_L', morphTargetInfluences['browOuterUp_L'] || 0, 0, 600);
        animateMorphTarget('browOuterUp_R', morphTargetInfluences['browOuterUp_R'] || 0, 0, 600);
        animateMorphTarget('browDown_L', morphTargetInfluences['browDown_L'] || 0, 0, 600);
        animateMorphTarget('browDown_R', morphTargetInfluences['browDown_R'] || 0, 0, 600);
        
        // Natural blink after speaking
        setTimeout(() => {
            blinkInProgress = true;
            animateMorphTarget('eyeBlink_L', 0, 1, 150);
            animateMorphTarget('eyeBlink_R', 0, 1, 150);
            
            setTimeout(() => {
                animateMorphTarget('eyeBlink_L', 1, 0, 150);
                animateMorphTarget('eyeBlink_R', 1, 0, 150);
                blinkInProgress = false;
                
                // Return eyes to neutral
                animateMorphTarget('eyeWide_L', morphTargetInfluences['eyeWide_L'] || 0, 0, 400);
                animateMorphTarget('eyeWide_R', morphTargetInfluences['eyeWide_R'] || 0, 0, 400);
                
                // Start idle animation after everything else is done
                startIdleAnimation();
            }, 150);
        }, 400);
    }, 200);
}

// Idle animation patterns
let idleAnimationActive = false;
let idleInterval = null;
let lastBlinkTime = 0;
let blinkInProgress = false;

// Start idle animation with natural random variations
function startIdleAnimation() {
    if (idleAnimationActive) return;
    idleAnimationActive = true;
    
    console.log("Starting idle animation");
    
    // Set a slight smile as the default expression
    animateMorphTarget('mouthSmile_L', 0, 0.15, 800);
    animateMorphTarget('mouthSmile_R', 0, 0.15, 800);
    
    // Random subtle movements for lifelike appearance
    idleInterval = setInterval(() => {
        // Random chance of different idle behaviors
        const randomAction = Math.random();
        
        // Occasional random eye movements (looking around)
        if (randomAction < 0.3 && !blinkInProgress) {
            const directions = ['eyeLookUp_', 'eyeLookDown_', 'eyeLookIn_', 'eyeLookOut_'];
            const randomDirection = directions[Math.floor(Math.random() * directions.length)];
            const side = Math.random() > 0.5 ? 'L' : 'R';
            const otherSide = side === 'L' ? 'R' : 'L';
            const strength = Math.random() * 0.3 + 0.1;
            
            // Look in a direction
            animateMorphTarget(randomDirection + side, 0, strength, 600);
            
            // Sometimes move both eyes together
            if (Math.random() > 0.3) {
                animateMorphTarget(randomDirection + otherSide, 0, strength, 600);
            }
            
            // Return to neutral after a random delay
            setTimeout(() => {
                animateMorphTarget(randomDirection + side, strength, 0, 800);
                if (Math.random() > 0.3) {
                    animateMorphTarget(randomDirection + otherSide, strength, 0, 800);
                }
            }, 800 + Math.random() * 1200);
        }
        
        // Subtle eyebrow movements
        if (randomAction >= 0.3 && randomAction < 0.4) {
            if (Math.random() > 0.5) {
                // Raise eyebrows slightly
                const strength = Math.random() * 0.2 + 0.1;
                animateMorphTarget('browInnerUp', 0, strength, 700);
                setTimeout(() => {
                    animateMorphTarget('browInnerUp', strength, 0, 800);
                }, 1000 + Math.random() * 1000);
            } else {
                // Raise outer eyebrows
                const strength = Math.random() * 0.2 + 0.1;
                animateMorphTarget('browOuterUp_L', 0, strength, 700);
                animateMorphTarget('browOuterUp_R', 0, strength, 700);
                
                setTimeout(() => {
                    animateMorphTarget('browOuterUp_L', strength, 0, 800);
                    animateMorphTarget('browOuterUp_R', strength, 0, 800);
                }, 1000 + Math.random() * 1000);
            }
        }
        
        // Very subtle mouth movements
        if (randomAction >= 0.4 && randomAction < 0.5) {
            const mouthMoves = ['mouthPucker', 'mouthLeft', 'mouthRight', 'mouthRollUpper'];
            const randomMouth = mouthMoves[Math.floor(Math.random() * mouthMoves.length)];
            const strength = Math.random() * 0.1 + 0.05;
            
            animateMorphTarget(randomMouth, 0, strength, 600);
            setTimeout(() => {
                animateMorphTarget(randomMouth, strength, 0, 600);
            }, 800 + Math.random() * 500);
        }
        
    }, 3000 + Math.random() * 2000); // Varying interval for more natural feel
    
    // Handle blinking separately for more realistic timing
    function handleBlinking() {
        const now = Date.now();
        
        // Don't blink if we're already blinking or it's too soon
        if (blinkInProgress || now - lastBlinkTime < 2000) {
            requestAnimationFrame(handleBlinking);
            return;
        }
        
        // Random chance to blink
        if (Math.random() < 0.1) {
            blinkInProgress = true;
            lastBlinkTime = now;
            
            // Blink both eyes
            animateMorphTarget('eyeBlink_L', 0, 1, 150);
            animateMorphTarget('eyeBlink_R', 0, 1, 150);
            
            // Open eyes after blinking
            setTimeout(() => {
                animateMorphTarget('eyeBlink_L', 1, 0, 200);
                animateMorphTarget('eyeBlink_R', 1, 0, 200);
                
                // Double-blink occasionally
                if (Math.random() < 0.2) {
                    setTimeout(() => {
                        animateMorphTarget('eyeBlink_L', 0, 1, 150);
                        animateMorphTarget('eyeBlink_R', 0, 1, 150);
                        
                        setTimeout(() => {
                            animateMorphTarget('eyeBlink_L', 1, 0, 200);
                            animateMorphTarget('eyeBlink_R', 1, 0, 200);
                            blinkInProgress = false;
                        }, 150);
                    }, 200);
                } else {
                    blinkInProgress = false;
                }
            }, 150);
        }
        
        requestAnimationFrame(handleBlinking);
    }
    
    handleBlinking();
}

// Stop idle animation
function stopIdleAnimation() {
    if (!idleAnimationActive) return;
    idleAnimationActive = false;
    
    if (idleInterval) {
        clearInterval(idleInterval);
        idleInterval = null;
    }
    
    // Reset to neutral
    resetAllMorphTargets();
}

// More advanced animation timing function for smoother transitions
function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Initialize the robot face when the document is ready
document.addEventListener('DOMContentLoaded', () => {
    initRobotFace();
    
    // Start idle animation after a short delay to ensure model loading
    setTimeout(() => {
        startIdleAnimation();
    }, 2000);
});

// Make functions available globally
window.startSpeaking = startSpeaking;
window.stopSpeaking = stopSpeaking;
window.startIdleAnimation = startIdleAnimation;
window.stopIdleAnimation = stopIdleAnimation;