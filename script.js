// ===== IMPORTS =====
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ===== CONFIGURATION =====
const CONFIG = {
    colors: {
        fur: {
            brown: 0x8B4513,
            beige: 0xD2B48C,
            white: 0xF5F5DC,
            pink: 0xFFB6C1
        },
        eyes: {
            black: 0x000000,
            blue: 0x4169E1,
            brown: 0x654321,
            green: 0x228B22
        }
    },
    camera: {
        position: { x: 0, y: 1.5, z: -4 },
        fov: 45
    },
    defaultState: {
        form: 'sitting',
        furColor: 'brown',
        eyeColor: 'black',
        accessories: {
            hat: false,
            bow: false,
            scarf: false
        }
    }
};

// ===== STATE MANAGEMENT =====
class BearState {
    constructor() {
        this.currentForm = CONFIG.defaultState.form;
        this.furColor = CONFIG.defaultState.furColor;
        this.eyeColor = CONFIG.defaultState.eyeColor;
        this.accessories = { ...CONFIG.defaultState.accessories };
    }

    reset() {
        this.currentForm = CONFIG.defaultState.form;
        this.furColor = CONFIG.defaultState.furColor;
        this.eyeColor = CONFIG.defaultState.eyeColor;
        this.accessories = { ...CONFIG.defaultState.accessories };
    }
}

// ===== THREE.JS SCENE MANAGER =====
class SceneManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.lights = [];
        this.bearModels = {};
        this.accessories = {};
        this.currentBear = null;
        
        this.init();
    }

    init() {
        this.setupScene();
        this.setupCamera();
        this.setupRenderer();
        this.setupLights();
        this.setupControls();
        this.animate();
        this.handleResize();
    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xFFF5F7);
    }

    setupCamera() {
        const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
        this.camera = new THREE.PerspectiveCamera(
            CONFIG.camera.fov,
            aspect,
            0.1,
            1000
        );
        this.camera.position.set(
            CONFIG.camera.position.x,
            CONFIG.camera.position.y,
            CONFIG.camera.position.z
        );
    }

    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    setupLights() {
        // Ambient Light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        this.lights.push(ambientLight);

        // Main Directional Light
        const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
        mainLight.position.set(5, 5, 5);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 1024;
        mainLight.shadow.mapSize.height = 1024;
        this.scene.add(mainLight);
        this.lights.push(mainLight);

        // Fill Light
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
        fillLight.position.set(-5, 3, -5);
        this.scene.add(fillLight);
        this.lights.push(fillLight);
    }

    setupControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 2;
        this.controls.maxDistance = 10;
        this.controls.maxPolarAngle = Math.PI / 2;
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    handleResize() {
        window.addEventListener('resize', () => {
            const width = this.canvas.clientWidth;
            const height = this.canvas.clientHeight;
            
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        });
    }

    resetCamera() {
        this.camera.position.set(
            CONFIG.camera.position.x,
            CONFIG.camera.position.y,
            CONFIG.camera.position.z
        );
        this.controls.reset();
    }

    loadModel(path, name, callback) {
        const loader = new GLTFLoader();
        loader.load(
            path,
            (gltf) => {
                const model = gltf.scene;
                model.visible = false;
                
                // Center and scale model
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                
                // Center model
                model.position.x = -center.x;
                model.position.y = -center.y;
                model.position.z = -center.z;
                
                // Scale to fit (target height ~2 units)
                const maxDim = Math.max(size.x, size.y, size.z);
                const scale = 2 / maxDim;
                model.scale.setScalar(scale);
                
                this.scene.add(model);
                
                // Enable shadows
                model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                
                if (callback) callback(model);
            },
            (progress) => {
                console.log(`Loading ${name}: ${(progress.loaded / progress.total * 100).toFixed(0)}%`);
            },
            (error) => {
                console.error(`Error loading ${name}:`, error);
            }
        );
    }

    switchBearForm(formName) {
        // Hide current bear
        if (this.currentBear) {
            this.currentBear.visible = false;
        }

        // Show new bear
        const newBear = this.bearModels[formName];
        if (newBear) {
            newBear.visible = true;
            this.currentBear = newBear;
            
            // Reposition accessories for different bear forms
            this.repositionAccessories(formName);
        }
    }
    
    repositionAccessories(formName) {
        // Adjust accessory positions based on bear form
        const positions = {
            sitting: {
                hat: { y: 1.7, scale: 1.0 },
                bow: { x: 0.3, y: 1.6, scale: 0.8 },
                scarf: { y: 1.0, scale: 1.0 }
            },
            standing: {
                hat: { y: 2.0, scale: 1.0 },
                bow: { x: 0.28, y: 1.9, scale: 0.8 },
                scarf: { y: 1.5, scale: 1.0 }
            },
            compact: {
                hat: { y: 1.4, scale: 0.9 },
                bow: { x: 0.3, y: 1.3, scale: 0.7 },
                scarf: { y: 0.8, scale: 0.9 }
            }
        };
        
        const pos = positions[formName];
        if (!pos) return;
        
        if (this.accessories.hat) {
            this.accessories.hat.position.y = pos.hat.y;
            this.accessories.hat.scale.setScalar(pos.hat.scale);
        }
        
        if (this.accessories.bow) {
            this.accessories.bow.position.set(pos.bow.x, pos.bow.y, 0);
            this.accessories.bow.scale.setScalar(pos.bow.scale);
        }
        
        if (this.accessories.scarf) {
            this.accessories.scarf.position.y = pos.scarf.y;
            this.accessories.scarf.scale.setScalar(pos.scarf.scale);
        }
    }

    updateFurColor(colorName) {
        if (!this.currentBear) return;
        
        const color = new THREE.Color(CONFIG.colors.fur[colorName]);
        this.currentBear.traverse((child) => {
            if (child.isMesh) {
                // Prüfe ob das Material für Fell ist (nicht Augen/Nase)
                if (child.material && child.material.name !== 'EyeBlack') {
                    // Kopiere Material falls es geteilt wird
                    if (!child.material.userData.isCloned) {
                        child.material = child.material.clone();
                        child.material.userData.isCloned = true;
                    }
                    child.material.color.copy(color);
                }
            }
        });
    }

    updateEyeColor(colorName) {
        if (!this.currentBear) return;
        
        const color = new THREE.Color(CONFIG.colors.eyes[colorName]);
        this.currentBear.traverse((child) => {
            if (child.isMesh) {
                // Nur Meshes mit EyeBlack Material färben
                if (child.material && child.material.name === 'EyeBlack') {
                    if (!child.material.userData.isEyeCloned) {
                        child.material = child.material.clone();
                        child.material.userData.isEyeCloned = true;
                    }
                    child.material.color.copy(color);
                }
            }
        });
    }

    toggleAccessory(accessoryName, visible) {
        const accessory = this.accessories[accessoryName];
        if (accessory) {
            accessory.visible = visible;
        }
    }
}

// ===== UI CONTROLLER =====
class UIController {
    constructor(sceneManager, bearState) {
        this.sceneManager = sceneManager;
        this.bearState = bearState;
        this.init();
    }

    init() {
        this.setupFormButtons();
        this.setupColorButtons();
        this.setupEyeButtons();
        this.setupAccessoryToggles();
        this.setupResetButtons();
    }

    setupFormButtons() {
        document.querySelectorAll('[data-form]').forEach(btn => {
            btn.addEventListener('click', () => {
                const form = btn.dataset.form;
                this.bearState.currentForm = form;
                this.sceneManager.switchBearForm(form);
                this.updateActiveButton(btn, '[data-form]');
            });
        });
    }

    setupColorButtons() {
        document.querySelectorAll('[data-color]').forEach(btn => {
            btn.addEventListener('click', () => {
                const color = btn.dataset.color;
                this.bearState.furColor = color;
                this.sceneManager.updateFurColor(color);
                this.updateActiveButton(btn, '[data-color]');
            });
        });
    }

    setupEyeButtons() {
        document.querySelectorAll('[data-eye]').forEach(btn => {
            btn.addEventListener('click', () => {
                const color = btn.dataset.eye;
                this.bearState.eyeColor = color;
                this.sceneManager.updateEyeColor(color);
                this.updateActiveButton(btn, '[data-eye]');
            });
        });
    }

    setupAccessoryToggles() {
        document.querySelectorAll('[data-accessory]').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const accessory = checkbox.dataset.accessory;
                const isChecked = checkbox.checked;
                this.bearState.accessories[accessory] = isChecked;
                this.sceneManager.toggleAccessory(accessory, isChecked);
            });
        });
    }

    setupResetButtons() {
        document.getElementById('resetCamera').addEventListener('click', () => {
            this.sceneManager.resetCamera();
        });

        document.getElementById('resetAll').addEventListener('click', () => {
            this.resetAll();
        });
    }

    updateActiveButton(activeBtn, selector) {
        document.querySelectorAll(selector).forEach(btn => {
            btn.classList.remove('active');
        });
        activeBtn.classList.add('active');
    }

    resetAll() {
        this.bearState.reset();
        
        // Reset UI
        document.querySelectorAll('[data-form]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.form === CONFIG.defaultState.form);
        });
        
        document.querySelectorAll('[data-color]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.color === CONFIG.defaultState.furColor);
        });
        
        document.querySelectorAll('[data-eye]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.eye === CONFIG.defaultState.eyeColor);
        });
        
        document.querySelectorAll('[data-accessory]').forEach(checkbox => {
            checkbox.checked = false;
        });

        // Reset scene
        this.sceneManager.switchBearForm(CONFIG.defaultState.form);
        this.sceneManager.updateFurColor(CONFIG.defaultState.furColor);
        this.sceneManager.updateEyeColor(CONFIG.defaultState.eyeColor);
        
        Object.keys(CONFIG.defaultState.accessories).forEach(acc => {
            this.sceneManager.toggleAccessory(acc, false);
        });
    }
}

// ===== APPLICATION INITIALIZATION =====
class BearConfigurator {
    constructor() {
        this.canvas = document.getElementById('canvas3d');
        this.bearState = new BearState();
        this.sceneManager = new SceneManager(this.canvas);
        this.uiController = new UIController(this.sceneManager, this.bearState);
        
        this.loadAssets();
    }

    loadAssets() {
        // Load all bear models
        this.sceneManager.loadModel('models/bears/bear_sitting.glb', 'sitting', (model) => {
            this.sceneManager.bearModels.sitting = model;
            this.sceneManager.currentBear = model;
            model.visible = true;
            
            // Apply default colors
            this.sceneManager.updateFurColor(this.bearState.furColor);
            this.sceneManager.updateEyeColor(this.bearState.eyeColor);
        });
        
        this.sceneManager.loadModel('models/bears/bear_standing.glb', 'standing', (model) => {
            this.sceneManager.bearModels.standing = model;
        });
        
        this.sceneManager.loadModel('models/bears/bear_compact.glb', 'compact', (model) => {
            this.sceneManager.bearModels.compact = model;
        });
        
        // Load accessories
        this.sceneManager.loadModel('models/accessories/hat.glb', 'hat', (model) => {
            this.sceneManager.accessories.hat = model;
            model.visible = false;
            model.position.set(0, 1.7, 0);  // Position on bear's head
        });
        
        this.sceneManager.loadModel('models/accessories/bow.glb', 'bow', (model) => {
            this.sceneManager.accessories.bow = model;
            model.visible = false;
            model.position.set(0.3, 1.6, 0);  // Position on bear's ear
            model.scale.set(0.8, 0.8, 0.8);
        });
        
        this.sceneManager.loadModel('models/accessories/scarf.glb', 'scarf', (model) => {
            this.sceneManager.accessories.scarf = model;
            model.visible = false;
            model.position.set(0, 1.0, 0);  // Position on bear's neck
        });
    }
}

// ===== START APPLICATION =====
window.addEventListener('DOMContentLoaded', () => {
    new BearConfigurator();
});