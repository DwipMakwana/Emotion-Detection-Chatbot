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

let textAnimator = null;
let currentSpeakingAnimation = null;

/**
 * Text to Mouth Animation Generator
 * Creates facial morphtarget animations for a speaking 3D character
 */

class TextToMouthAnimation {
    constructor() {
      // Map of phonemes to mouth shapes
      this.phonemeToMouthMap = {
        // Vowels
        'AA': { jawOpen: 0.7, mouthSmile_L: 0.1, mouthSmile_R: 0.1 },  // "ah" as in "father"
        'AE': { jawOpen: 0.5, mouthSmile_L: 0.3, mouthSmile_R: 0.3 },  // "ae" as in "cat"
        'AH': { jawOpen: 0.4, mouthSmile_L: 0.1, mouthSmile_R: 0.1 },  // "uh" as in "but"
        'AO': { jawOpen: 0.6, mouthPucker: 0.3 },                      // "aw" as in "dog"
        'AW': { jawOpen: 0.5, mouthPucker: 0.5 },                      // "ow" as in "cow"
        'AY': { jawOpen: 0.5, mouthSmile_L: 0.5, mouthSmile_R: 0.5 },  // "eye" as in "my"
        'EH': { jawOpen: 0.3, mouthSmile_L: 0.4, mouthSmile_R: 0.4 },  // "eh" as in "bed"
        'ER': { jawOpen: 0.3, mouthPucker: 0.2 },                      // "er" as in "bird"
        'EY': { jawOpen: 0.3, mouthSmile_L: 0.6, mouthSmile_R: 0.6 },  // "ay" as in "say"
        'IH': { jawOpen: 0.3, mouthSmile_L: 0.3, mouthSmile_R: 0.3 },  // "ih" as in "bit"
        'IY': { jawOpen: 0.2, mouthSmile_L: 0.7, mouthSmile_R: 0.7 },  // "ee" as in "see"
        'OW': { jawOpen: 0.4, mouthPucker: 0.6 },                      // "oh" as in "go"
        'OY': { jawOpen: 0.4, mouthPucker: 0.5 },                      // "oy" as in "boy"
        'UH': { jawOpen: 0.3, mouthPucker: 0.7 },                      // "oo" as in "good"
        'UW': { jawOpen: 0.2, mouthPucker: 0.8 },                      // "oo" as in "food"
        
        // Consonants
        'B': { mouthClose: 0.8, mouthPress_L: 0.5, mouthPress_R: 0.5 },    // "b" as in "bat"
        'CH': { jawOpen: 0.2, mouthPucker: 0.5 },                          // "ch" as in "chat"
        'D': { jawOpen: 0.2, tongueOut: 0.3 },                             // "d" as in "dog"
        'DH': { jawOpen: 0.2, tongueOut: 0.5 },                            // "th" as in "that"
        'F': { jawOpen: 0.1, mouthPress_L: 0.3, mouthPress_R: 0.3 },       // "f" as in "fat"
        'G': { jawOpen: 0.3 },                                             // "g" as in "got"
        'HH': { jawOpen: 0.2 },                                            // "h" as in "hat"
        'JH': { jawOpen: 0.2, mouthPucker: 0.3 },                          // "j" as in "jump"
        'K': { jawOpen: 0.3 },                                             // "k" as in "cat"
        'L': { jawOpen: 0.3, tongueOut: 0.5 },                             // "l" as in "lot"
        'M': { mouthClose: 0.8, mouthPress_L: 0.5, mouthPress_R: 0.5 },    // "m" as in "mom"
        'N': { jawOpen: 0.2, tongueOut: 0.2 },                             // "n" as in "not"
        'NG': { jawOpen: 0.2, tongueOut: 0.3 },                            // "ng" as in "sing"
        'P': { mouthClose: 0.9, mouthPress_L: 0.7, mouthPress_R: 0.7 },    // "p" as in "pot"
        'R': { jawOpen: 0.3, mouthPucker: 0.4 },                           // "r" as in "rot"
        'S': { jawOpen: 0.2, mouthStretch_L: 0.3, mouthStretch_R: 0.3 },   // "s" as in "sit"
        'SH': { jawOpen: 0.2, mouthPucker: 0.6 },                          // "sh" as in "ship"
        'T': { jawOpen: 0.2, tongueOut: 0.3 },                             // "t" as in "top"
        'TH': { jawOpen: 0.1, tongueOut: 0.6 },                            // "th" as in "thin"
        'V': { jawOpen: 0.1, mouthPress_L: 0.3, mouthPress_R: 0.3 },       // "v" as in "vat"
        'W': { jawOpen: 0.1, mouthPucker: 0.8 },                           // "w" as in "wit"
        'Y': { jawOpen: 0.3, mouthSmile_L: 0.3, mouthSmile_R: 0.3 },       // "y" as in "yes"
        'Z': { jawOpen: 0.2, mouthStretch_L: 0.3, mouthStretch_R: 0.3 },   // "z" as in "zip"
        'ZH': { jawOpen: 0.2, mouthPucker: 0.5 },                          // "zh" as in "vision"
        
        // Special cases
        'SPACE': { jawOpen: 0.1, mouthSmile_L: 0.1, mouthSmile_R: 0.1 },   // Subtle movement between words
        'PAUSE': { jawOpen: 0.02, mouthClose: 0.3 },                       // For punctuation pauses
        'DEFAULT': { jawOpen: 0 }                                          // Default neutral position
      };
  
      // Simple word-to-phoneme mapping for common words
      this.wordToPhonemeMap = {
        'hello': ['HH', 'EH', 'L', 'OW'],
        'hi': ['HH', 'AY'],
        'yes': ['Y', 'EH', 'S'],
        'no': ['N', 'OW'],
        'the': ['DH', 'AH'],
        'and': ['AE', 'N', 'D'],
        'to': ['T', 'UW'],
        'a': ['AH'],
        'of': ['AH', 'V'],
        'in': ['IH', 'N'],
        'for': ['F', 'ER'],
        'is': ['IH', 'Z'],
        'on': ['AA', 'N'],
        'that': ['DH', 'AE', 'T'],
        'by': ['B', 'AY'],
        'this': ['DH', 'IH', 'S'],
        'with': ['W', 'IH', 'TH'],
        'you': ['Y', 'UW'],
        'it': ['IH', 'T'],
        'have': ['HH', 'AE', 'V'],
        'are': ['AA', 'R'],
        'be': ['B', 'IY'],
        'at': ['AE', 'T'],
        'or': ['ER'],
        'your': ['Y', 'UH', 'R'],
        'from': ['F', 'R', 'AH', 'M'],
        'but': ['B', 'AH', 'T'],
        'not': ['N', 'AA', 'T'],
      };
      
      // Default viseme patterns for letters
      this.letterToPhoneme = {
        'a': 'AE',
        'b': 'B',
        'c': 'K',
        'd': 'D',
        'e': 'EH',
        'f': 'F',
        'g': 'G',
        'h': 'HH',
        'i': 'IY',
        'j': 'JH',
        'k': 'K',
        'l': 'L',
        'm': 'M',
        'n': 'N',
        'o': 'OW',
        'p': 'P',
        'q': 'K',
        'r': 'R',
        's': 'S',
        't': 'T',
        'u': 'UH',
        'v': 'V',
        'w': 'W',
        'x': 'K', // Approximation
        'y': 'Y',
        'z': 'Z',
        ' ': 'SPACE',
        '.': 'PAUSE',
        ',': 'PAUSE',
        '!': 'PAUSE',
        '?': 'PAUSE'
      };
    }
  
    /**
     * Convert text to a sequence of morphtarget frames
     * @param {string} text - The text to be spoken
     * @param {number} durationMs - Total animation duration in milliseconds
     * @param {number} fps - Frames per second for the animation
     * @return {Array} Array of frames with morphtarget values
     */
    textToMouthAnimation(text, durationMs = 2000, fps = 30) {
      // Clean the text and split it into words
      const cleanText = text.toLowerCase().trim();
      const words = cleanText.split(/\s+/);
      
      // Convert words to phonemes
      const allPhonemes = [];
      words.forEach(word => {
        if (this.wordToPhonemeMap[word]) {
          // Use predefined phoneme mapping if available
          allPhonemes.push(...this.wordToPhonemeMap[word]);
        } else {
          // Otherwise map each letter to a phoneme
          for (let i = 0; i < word.length; i++) {
            const letter = word[i];
            allPhonemes.push(this.letterToPhoneme[letter] || 'DEFAULT');
          }
        }
        // Add a space between words
        allPhonemes.push('SPACE');
      });
      
      // Remove the last space
      if (allPhonemes.length > 0 && allPhonemes[allPhonemes.length - 1] === 'SPACE') {
        allPhonemes.pop();
      }
      
      // Calculate frames
      const totalFrames = Math.floor(durationMs * fps / 1000);
      const phonemesPerFrame = allPhonemes.length / totalFrames;
      const frames = [];
      
      // Generate frames
      for (let frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
        const phonemeIdx = Math.min(Math.floor(frameIdx * phonemesPerFrame), allPhonemes.length - 1);
        const phoneme = allPhonemes[phonemeIdx];
        const mouthShape = this.phonemeToMouthMap[phoneme] || this.phonemeToMouthMap['DEFAULT'];
        
        // Create a frame with all morphtargets initialized to 0
        const frame = this.createEmptyMorphTargetFrame();
        
        // Apply the mouth shape values to the frame
        Object.keys(mouthShape).forEach(key => {
          if (frame.hasOwnProperty(key)) {
            frame[key] = mouthShape[key];
          }
        });
        
        // Add some randomness for natural eye blinks
        if (Math.random() < 0.02) { // 2% chance per frame for a blink
          frame.eyeBlink_L = 0.9;
          frame.eyeBlink_R = 0.9;
        }
        
        frames.push(frame);
      }
      
      return frames;
    }
    
    /**
     * Create an empty frame with all morphtargets set to 0
     * @return {Object} Empty morphtarget frame
     */
    createEmptyMorphTargetFrame() {
      return {
        browInnerUp: 0,
        browDown_L: 0,
        browDown_R: 0,
        browOuterUp_L: 0,
        browOuterUp_R: 0,
        eyeLookUp_L: 0,
        eyeLookUp_R: 0,
        eyeLookDown_L: 0,
        eyeLookDown_R: 0,
        eyeLookIn_L: 0,
        eyeLookIn_R: 0,
        eyeLookOut_L: 0,
        eyeLookOut_R: 0,
        eyeBlink_L: 0,
        eyeBlink_R: 0,
        eyeSquint_L: 0,
        eyeSquint_R: 0,
        eyeWide_L: 0,
        eyeWide_R: 0,
        cheekPuff: 0,
        cheekSquint_L: 0,
        cheekSquint_R: 0,
        noseSneer_L: 0,
        noseSneer_R: 0,
        jawOpen: 0,
        jawForward: 0,
        jawLeft: 0,
        jawRight: 0,
        mouthFunnel: 0,
        mouthPucker: 0,
        mouthLeft: 0,
        mouthRight: 0,
        mouthRollUpper: 0,
        mouthRollLower: 0,
        mouthShrugUpper: 0,
        mouthShrugLower: 0,
        mouthClose: 0,
        mouthSmile_L: 0,
        mouthSmile_R: 0,
        mouthFrown_L: 0,
        mouthFrown_R: 0,
        mouthDimple_L: 0,
        mouthDimple_R: 0,
        mouthUpperUp_L: 0,
        mouthUpperUp_R: 0,
        mouthLowerDown_L: 0,
        mouthLowerDown_R: 0,
        mouthPress_L: 0,
        mouthPress_R: 0,
        mouthStretch_L: 0,
        mouthStretch_R: 0,
        tongueOut: 0
      };
    }
    
    /**
     * Add emotions to the animation frames
     * @param {Array} frames - Animation frames 
     * @param {string} emotion - Emotion type (happy, sad, angry, surprised)
     * @param {number} intensity - Emotion intensity from 0 to 1
     * @return {Array} Updated animation frames
     */
    addEmotion(frames, emotion, intensity = 0.5) {
      const emotions = {
        happy: {
          mouthSmile_L: 0.7,
          mouthSmile_R: 0.7,
          eyeSquint_L: 0.3,
          eyeSquint_R: 0.3,
          cheekSquint_L: 0.3,
          cheekSquint_R: 0.3
        },
        sad: {
          mouthFrown_L: 0.7,
          mouthFrown_R: 0.7,
          browInnerUp: 0.5,
          mouthLowerDown_L: 0.3,
          mouthLowerDown_R: 0.3
        },
        angry: {
          browDown_L: 0.6,
          browDown_R: 0.6,
          noseSneer_L: 0.4,
          noseSneer_R: 0.4,
          mouthPress_L: 0.4,
          mouthPress_R: 0.4
        },
        surprised: {
          eyeWide_L: 0.7,
          eyeWide_R: 0.7,
          browInnerUp: 0.6,
          browOuterUp_L: 0.6,
          browOuterUp_R: 0.6,
          jawOpen: 0.3
        }
      };
      
      const emotionShape = emotions[emotion] || emotions['happy'];
      
      // Apply emotion to all frames
      return frames.map(frame => {
        const newFrame = {...frame};
        Object.keys(emotionShape).forEach(key => {
          if (newFrame.hasOwnProperty(key)) {
            // Blend existing value with emotion value based on intensity
            newFrame[key] = newFrame[key] * (1 - intensity) + emotionShape[key] * intensity;
          }
        });
        return newFrame;
      });
    }
  }
  
  // Usage example:
  function animateText(text, durationMs = 2000, emotion = null, emotionIntensity = 0.5) {
    const animator = new TextToMouthAnimation();
    let frames = animator.textToMouthAnimation(text, durationMs);
    
    // Add emotion if specified
    if (emotion) {
      frames = animator.addEmotion(frames, emotion, emotionIntensity);
    }
    
    return frames;
  }
  
  // Integration with 3D model example:
  function applyAnimationToModel(model, frames, fps = 30) {
    let frameIndex = 0;
    const interval = 1000 / fps;
    
    // Apply first frame immediately
    applyFrameToModel(model, frames[0]);
    
    // Then set up interval for the rest
    const animationInterval = setInterval(() => {
      frameIndex++;
      
      if (frameIndex >= frames.length) {
        clearInterval(animationInterval);
        // Reset to neutral pose
        applyFrameToModel(model, animator.createEmptyMorphTargetFrame());
        return;
      }
      
      applyFrameToModel(model, frames[frameIndex]);
    }, interval);
    
    return animationInterval; // Return so it can be cleared if needed
  }
  
  // Helper function to apply a single frame to the model
  function applyFrameToModel(model, frame) {
    // Assuming model.morphTargetInfluences is accessible and maps to the same names
    Object.keys(frame).forEach(key => {
      const morphTargetIndex = model.morphTargetDictionary[key];
      if (morphTargetIndex !== undefined) {
        model.morphTargetInfluences[morphTargetIndex] = frame[key];
      }
    });
  }

// Initialize the 3D scene
function initRobotFace() {
    console.log("Initializing robot face");
    
    textAnimator = new TextToMouthAnimation();

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
function startSpeaking(text, duration) {
    // Stop idle animation when speaking
    stopIdleAnimation();
    
    if (speakingInterval) {
        clearInterval(speakingInterval);
        speakingInterval = null;
    }
    
    // If no text is provided, use the default random speaking animation
    if (!text) {
        console.log("Starting default speaking animation");
        // Your existing random speaking animation code here
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
    } else {
        // Use text-based mouth animation
        console.log("Starting text-based speaking animation:", text);
        
        // Calculate appropriate duration if not provided
        if (!duration) {
            // Rough estimate: 100ms per character with a minimum of 1000ms
            duration = Math.max(text.length * 100, 1000);
        }
        
        // Generate frames for the text
        const frames = textAnimator.textToMouthAnimation(text, duration);
        
        // Apply the frames
        let frameIndex = 0;
        const fps = 30;
        const frameInterval = 1000 / fps;
        
        // Initial expression setup
        animateMorphTarget('browInnerUp', 0, 0.3, 300);
        animateMorphTarget('eyeWide_L', 0, 0.2, 300);
        animateMorphTarget('eyeWide_R', 0, 0.2, 300);
        
        // Apply each frame in sequence
        if (currentSpeakingAnimation) {
            clearInterval(currentSpeakingAnimation);
        }
        
        currentSpeakingAnimation = setInterval(() => {
            if (frameIndex >= frames.length) {
                clearInterval(currentSpeakingAnimation);
                currentSpeakingAnimation = null;
                stopSpeaking();
                return;
            }
            
            const frame = frames[frameIndex];
            
            // Apply all morphtargets from the frame
            Object.keys(frame).forEach(morphTarget => {
                setMorphTarget(morphTarget, frame[morphTarget]);
            });
            
            // Add occasional random eye movements
            if (frameIndex % 15 === 0 && Math.random() < 0.3) {
                const randomEye = Math.random() > 0.5 ? 'eyeLookUp_' : 'eyeLookDown_';
                const side = Math.random() > 0.5 ? 'L' : 'R';
                animateMorphTarget(randomEye + side, 0, 0.3, 400);
                
                setTimeout(() => {
                    animateMorphTarget(randomEye + side, 0.3, 0, 400);
                }, 600);
            }
            
            frameIndex++;
        }, frameInterval);
    }
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
window.startSpeaking = function(text, duration) {
    startSpeaking(text, duration);
};
window.stopSpeaking = stopSpeaking;
window.startIdleAnimation = startIdleAnimation;
window.stopIdleAnimation = stopIdleAnimation;