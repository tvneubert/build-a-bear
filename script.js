// --- IMPORTS ---
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// --- CONFIG ---
const CONFIG = {
    models: {
        bear: 'models/bear/Bear.glb',
        accessories: {
            hat: 'models/accessories/TopHat.glb',
            beanie: 'models/accessories/Beanie.glb',
            scarf: 'models/accessories/Scarf.glb'
        }
    },
    textures: {
        brown: 'textures/bear_brown.png',
        panda: 'textures/bear_panda.png',
        pink: 'textures/bear_pink.png',
        blue: 'textures/bear_blue.png'
    },
    camera: {
        position: { x: 0, y: 1.5, z: 4 },
        fov: 45
    },
    defaults: {
        skin: 'brown',
        eyeColor: 0x000000,
        noseColor: 0x000000,
        accessoryColor: 0xFFFFFF,
        hat: 'none'
    }
};

// --- STATE ---
const state = {
    skin: CONFIG.defaults.skin,
    eyeColor: CONFIG.defaults.eyeColor,
    noseColor: CONFIG.defaults.noseColor,
    currentHat: CONFIG.defaults.hat,
    scarfVisible: false,
    currentAccessoryColor: CONFIG.defaults.accessoryColor
};

// --- SCENE SETUP ---
const canvas = document.getElementById('canvas3d');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xFFF5F7);

// Set up camera
const camera = new THREE.PerspectiveCamera(
    CONFIG.camera.fov,
    canvas.clientWidth / canvas.clientHeight,
    0.1,
    1000
);
camera.position.set(CONFIG.camera.position.x, CONFIG.camera.position.y, CONFIG.camera.position.z);

// Renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(canvas.clientWidth, canvas.clientHeight);
renderer.shadowMap.enabled = true;

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
mainLight.position.set(5, 5, 5);
mainLight.castShadow = true;
scene.add(mainLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
fillLight.position.set(-5, 3, -5);
scene.add(fillLight);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 2;
controls.maxDistance = 10;
controls.maxPolarAngle = Math.PI / 2;
controls.target.set(0, 1, 0);

// --- LOADERS ---
const gltfLoader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();

// Models are already Y-Up, no rotation needed.

// Load textures
const textures = {};
Object.keys(CONFIG.textures).forEach(key => {
    textures[key] = textureLoader.load(CONFIG.textures[key]);
    textures[key].flipY = false; // Important for GLTF textures
});

// --- MODELS ---
let bear = null;
const accessories = { hat: null, beanie: null, scarf: null };
let bearParts = { body: null, eyes: null, nose: null };

// Loading status
const loadingStatus = {
    bear: false,
    hat: false,
    beanie: false,
    scarf: false
};

function checkAllLoaded() {
    const allLoaded = Object.values(loadingStatus).every(status => status === true);
    if (allLoaded) {
        console.log('All models loaded!');
        document.querySelectorAll('button, input').forEach(el => el.disabled = false);
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.classList.add('hidden');
        }
    }
    return allLoaded;
}

// --- LOAD BEAR ---
function loadBear() {
    gltfLoader.load(CONFIG.models.bear, (gltf) => {
        bear = gltf.scene;
        
        // Rotate bear to face camera
        bear.rotation.y = Math.PI;
        
        // Get bounding box
        const box = new THREE.Box3().setFromObject(bear);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        // Center model after rotation
        bear.position.x = -center.x;
        bear.position.y = -box.min.y;  // Position feet at ground level
        bear.position.z = -center.z;
        
        // Normalize scale
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 2 / maxDim;
        bear.scale.setScalar(scale);
        
        // Find bear parts
        bear.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                
                const name = child.name.toLowerCase();
                
                // Find nose first (more specific name)
                if (name.includes('nose')) {
                    bearParts.nose = child;
                }
                // Eyes
                else if (name.includes('eye')) {
                    if (!bearParts.eyes) bearParts.eyes = [];
                    bearParts.eyes.push(child);
                }
                // Assume largest mesh is the body
                else {
                    if (!bearParts.body || child.geometry.attributes.position.count > bearParts.body.geometry.attributes.position.count) {
                        bearParts.body = child;
                    }
                }
            }
        });
        
        scene.add(bear);
        
        // Apply defaults
        updateBearSkin(state.skin);
        updatePartColor('eyes', state.eyeColor);
        updatePartColor('nose', state.noseColor);
        
        loadingStatus.bear = true;
        checkAllLoaded();
    }, undefined, (error) => {
        console.error('Error loading bear:', error);
    });
}

// --- LOAD ACCESSORIES ---
function loadAccessory(name, path) {
    gltfLoader.load(path, (gltf) => {
        const accessory = gltf.scene;
        
        // No rotation needed, using Y-Up from Blender
        
        // Set accessory position (Y is up)
        const positions = {
            hat: { x: 0, y: 1.96, z: -0.1, scale: 1, rotX: 0, rotY: 0, rotZ: 0 },
            beanie: { x: 0.22, y: 1.75, z: -0.1, scale: 1, rotX: 0, rotY: 0, rotZ: 0 },
            scarf: { x: 0, y: 1.15, z: 0.125, scale: 0.85, rotX: 0, rotY: 180, rotZ: 0 }
        };
        
        const pos = positions[name] || { x: 0, y: 1.5, z: 0, scale: 0.5, rotX: 0, rotY: 0, rotZ: 0 };
        
        accessory.position.set(pos.x, pos.y, pos.z);
        accessory.scale.setScalar(pos.scale);
        accessory.rotation.set(
            pos.rotX * Math.PI / 180,
            pos.rotY * Math.PI / 180,
            pos.rotZ * Math.PI / 180
        );
        
        // Default to a white material
        accessory.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                child.material = new THREE.MeshStandardMaterial({
                    color: CONFIG.defaults.accessoryColor,
                    roughness: 0.7,
                    metalness: 0.1
                });
            }
        });
        
        accessory.visible = false;
        scene.add(accessory);
        accessories[name] = accessory;
        
        loadingStatus[name] = true;
        console.log(`${name.toUpperCase()} loaded.`);
        checkAllLoaded();
    }, 
    undefined,
    (error) => {
        console.error(`Error loading ${name}:`, error);
    });
}

function loadAccessories() {
    loadAccessory('hat', CONFIG.models.accessories.hat);
    loadAccessory('beanie', CONFIG.models.accessories.beanie);
    loadAccessory('scarf', CONFIG.models.accessories.scarf);
}

// --- UPDATE FUNCTIONS ---
function updateBearSkin(skinName) {
    if (!textures[skinName] || !bear) return;
    
    bear.traverse((child) => {
        if (child.isMesh) {
            const isEye = bearParts.eyes && bearParts.eyes.includes(child);
            const isNose = bearParts.nose === child;
            
            if (!isEye && !isNose) {
                if (!child.material.userData.isCloned) {
                    child.material = child.material.clone();
                    child.material.userData.isCloned = true;
                }
                child.material.map = textures[skinName];
                child.material.needsUpdate = true;
            }
        }
    });
    
    state.skin = skinName;
}

function updatePartColor(part, colorHex) {
    if (part === 'eyes') {
        const eyeMeshes = bearParts.eyes;
        if (!eyeMeshes || eyeMeshes.length === 0) return;
        
        eyeMeshes.forEach(mesh => {
            if (!mesh.material.userData.isEyeCloned) {
                mesh.material = mesh.material.clone();
                mesh.material.userData.isEyeCloned = true;
            }
            mesh.material.color.setHex(colorHex);
        });
        
        state.eyeColor = colorHex;
    } 
    else if (part === 'nose') {
        const noseMesh = bearParts.nose;
        if (!noseMesh) return;
        
        if (!noseMesh.material.userData.isNoseCloned) {
            noseMesh.material = noseMesh.material.clone();
            noseMesh.material.userData.isNoseCloned = true;
        }
        noseMesh.material.color.setHex(colorHex);
        
        state.noseColor = colorHex;
    }
}

function updateHat(hatType) {
    // Hide all hats first
    if (accessories.hat) accessories.hat.visible = false;
    if (accessories.beanie) accessories.beanie.visible = false;
    
    // Show the selected one
    if (hatType !== 'none' && accessories[hatType]) {
        accessories[hatType].visible = true;
        updateAccessoryColor(hatType, state.currentAccessoryColor);
    }
    
    state.currentHat = hatType;
    updateAccessoryColorSection();
}

function toggleScarf(visible) {
    if (accessories.scarf) {
        accessories.scarf.visible = visible;
        if (visible) {
            updateAccessoryColor('scarf', state.currentAccessoryColor);
        }
    }
    state.scarfVisible = visible;
    updateAccessoryColorSection();
}

function updateAccessoryColor(name, colorHex) {
    const accessory = accessories[name];
    if (!accessory) return;
    
    accessory.traverse((child) => {
        if (child.isMesh) {
            child.material.color.setHex(colorHex);
        }
    });
}

function updateCurrentAccessoryColor(colorHex) {
    state.currentAccessoryColor = colorHex;
    if (state.currentHat !== 'none') {
        updateAccessoryColor(state.currentHat, colorHex);
    }
    if (state.scarfVisible) {
        updateAccessoryColor('scarf', colorHex);
    }
}

function updateAccessoryColorSection() {
    const section = document.getElementById('accessory-color-section');
    const hasAccessory = state.currentHat !== 'none' || state.scarfVisible;
    section.style.display = hasAccessory ? 'block' : 'none';
}

// --- UI EVENT LISTENERS ---
document.querySelectorAll('[data-skin]').forEach(btn => {
    btn.addEventListener('click', () => {
        updateBearSkin(btn.dataset.skin);
        setActive(btn, '[data-skin]');
    });
});

document.querySelectorAll('[data-part]').forEach(btn => {
    btn.addEventListener('click', () => {
        updatePartColor(btn.dataset.part, parseInt(btn.dataset.color));
        setActive(btn, `[data-part="${btn.dataset.part}"]`);
    });
});

document.querySelectorAll('input[name="hat"]').forEach(radio => {
    radio.addEventListener('change', () => {
        if (radio.checked) updateHat(radio.value);
    });
});

document.getElementById('acc-scarf').addEventListener('change', (e) => {
    toggleScarf(e.target.checked);
});

document.querySelectorAll('[data-acc-color]').forEach(btn => {
    btn.addEventListener('click', () => {
        updateCurrentAccessoryColor(parseInt(btn.dataset.accColor));
        setActive(btn, '[data-acc-color]');
    });
});

document.getElementById('resetCamera').addEventListener('click', () => {
    camera.position.set(CONFIG.camera.position.x, CONFIG.camera.position.y, CONFIG.camera.position.z);
    controls.target.set(0, 1, 0);
});

document.getElementById('resetAll').addEventListener('click', resetAll);

// --- HELPER FUNCTIONS ---
function setActive(activeBtn, selector) {
    document.querySelectorAll(selector).forEach(btn => btn.classList.remove('active'));
    activeBtn.classList.add('active');
}

function resetAll() {
    state.skin = CONFIG.defaults.skin;
    state.eyeColor = CONFIG.defaults.eyeColor;
    state.noseColor = CONFIG.defaults.noseColor;
    state.currentHat = CONFIG.defaults.hat;
    state.scarfVisible = false;
    state.currentAccessoryColor = CONFIG.defaults.accessoryColor;
    
    updateBearSkin(CONFIG.defaults.skin);
    updatePartColor('eyes', CONFIG.defaults.eyeColor);
    updatePartColor('nose', CONFIG.defaults.noseColor);
    updateHat('none');
    toggleScarf(false);
    updateCurrentAccessoryColor(CONFIG.defaults.accessoryColor);
    
    // Also reset UI elements
    document.querySelectorAll('[data-skin]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.skin === CONFIG.defaults.skin);
    });
    
    document.querySelectorAll('[data-part]').forEach(btn => {
        const isEyeDefault = btn.dataset.part === 'eyes' && parseInt(btn.dataset.color) === CONFIG.defaults.eyeColor;
        const isNoseDefault = btn.dataset.part === 'nose' && parseInt(btn.dataset.color) === CONFIG.defaults.noseColor;
        btn.classList.toggle('active', isEyeDefault || isNoseDefault);
    });
    
    document.querySelector('input[value="none"]').checked = true;
    document.getElementById('acc-scarf').checked = false;
    
    document.querySelectorAll('[data-acc-color]').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.accColor) === CONFIG.defaults.accessoryColor);
    });
    
    updateAccessoryColorSection();
}

// --- RESIZE ---
window.addEventListener('resize', () => {
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
});

// --- ANIMATION ---
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// --- INIT ---
document.querySelectorAll('button, input').forEach(el => el.disabled = true);
console.log('Loading models...');

loadBear();
loadAccessories();
animate();

setTimeout(() => {
    if (!checkAllLoaded()) {
        console.warn('Enabling UI anyway (models may be missing)');
        document.querySelectorAll('button, input').forEach(el => el.disabled = false);
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) loadingIndicator.classList.add('hidden');
    }
}, 3000);
