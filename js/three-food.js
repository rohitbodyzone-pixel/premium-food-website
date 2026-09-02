/**
 * CRAVE & CO. - Culinary 3D Atmosphere & Particle Engine
 * Realistic rising food steam, glowing embers, floating herbs & spices (rosemary, peppercorns,
 * chili slices, Maldon salt flakes), and interactive warm restaurant spotlighting.
 */

class Hero3DFoodScene {
    constructor(canvasId = "hero-3d-canvas") {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.container = this.canvas.parentElement;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.steamParticles = [];
        this.emberParticles = [];
        this.ingredientMeshes = [];
        this.lights = {};
        
        this.mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
        this.scrollProgress = 0;
        this.clock = null;
        this.isReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        this.isVisible = true;

        this.init();
    }

    init() {
        if (!window.THREE) {
            console.warn("Three.js not found. Atmospheric canvas disabled.");
            return;
        }

        try {
            this.setupScene();
            this.setupCamera();
            this.setupRenderer();
            this.setupLighting();
            this.buildRealisticSteam();
            this.buildEmbersAndSpices();
            this.buildFloatingIngredients();
            this.bindEvents();
            this.animate();
        } catch (err) {
            console.error("Culinary atmosphere initialization:", err);
        }
    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.clock = new THREE.Clock();
    }

    setupCamera() {
        const width = this.container.clientWidth || window.innerWidth;
        const height = this.container.clientHeight || window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
        this.camera.position.set(0, 0, 5.5);
    }

    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            alpha: true,
            antialias: true,
            powerPreference: "high-performance"
        });
        
        const width = this.container.clientWidth || window.innerWidth;
        const height = this.container.clientHeight || window.innerHeight;
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }

    setupLighting() {
        // Warm restaurant ambient
        const ambient = new THREE.AmbientLight(0xfff0dd, 0.6);
        this.scene.add(ambient);

        // Golden amber spotlight (simulates restaurant pendant light)
        const warmSpot = new THREE.PointLight(0xff9900, 2.8, 12);
        warmSpot.position.set(2, 3, 3);
        this.scene.add(warmSpot);
        this.lights.warmSpot = warmSpot;

        // Interactive pointer light
        const pointerLight = new THREE.PointLight(0xffb74d, 1.5, 8);
        pointerLight.position.set(0, 0, 3);
        this.scene.add(pointerLight);
        this.lights.pointer = pointerLight;
    }

    /**
     * Realistic Rising Food Steam
     */
    buildRealisticSteam() {
        const steamGroup = new THREE.Group();
        this.scene.add(steamGroup);

        const steamGeo = new THREE.SphereGeometry(0.18, 12, 12);
        const steamMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.10
        });

        for (let i = 0; i < 30; i++) {
            const steam = new THREE.Mesh(steamGeo, steamMat.clone());
            const startY = -0.6 + Math.random() * 0.4;
            steam.position.set(
                (Math.random() - 0.5) * 1.6,
                startY,
                (Math.random() - 0.5) * 1.2
            );
            steam.scale.setScalar(0.7 + Math.random() * 1.4);
            steam.userData = {
                speedY: 0.006 + Math.random() * 0.010,
                driftX: (Math.random() - 0.5) * 0.005,
                driftZ: (Math.random() - 0.5) * 0.003,
                baseY: startY,
                maxHeight: 2.4 + Math.random() * 0.8,
                rotSpeed: (Math.random() - 0.5) * 0.02
            };
            this.steamParticles.push(steam);
            steamGroup.add(steam);
        }
    }

    /**
     * Drifting Wood-Fire Embers & Sea Salt Flakes
     */
    buildEmbersAndSpices() {
        const particleGroup = new THREE.Group();
        this.scene.add(particleGroup);

        // 1. Warm Fire Embers
        const emberGeo = new THREE.SphereGeometry(0.018, 6, 6);
        const emberMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });

        for (let i = 0; i < 25; i++) {
            const ember = new THREE.Mesh(emberGeo, emberMat);
            ember.position.set(
                (Math.random() - 0.5) * 4.5,
                (Math.random() - 0.5) * 3.5,
                (Math.random() - 0.5) * 2.5
            );
            ember.userData = {
                speedY: 0.004 + Math.random() * 0.008,
                driftX: (Math.random() - 0.5) * 0.004,
                pulseSpeed: 1 + Math.random() * 3
            };
            this.emberParticles.push(ember);
            particleGroup.add(ember);
        }

        // 2. Maldon Flaked Sea Salt & Gold Leaf
        const saltGeo = new THREE.PlaneGeometry(0.04, 0.04);
        const saltMat = new THREE.MeshStandardMaterial({
            color: 0xffeedd,
            roughness: 0.2,
            metalness: 0.7,
            side: THREE.DoubleSide
        });

        for (let i = 0; i < 20; i++) {
            const flake = new THREE.Mesh(saltGeo, saltMat);
            flake.position.set(
                (Math.random() - 0.5) * 4.0,
                (Math.random() - 0.5) * 3.0,
                (Math.random() - 0.5) * 2.0
            );
            flake.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
            flake.userData = {
                rotSpeedX: (Math.random() - 0.5) * 0.02,
                rotSpeedY: (Math.random() - 0.5) * 0.02,
                floatSpeed: 0.002 + Math.random() * 0.004
            };
            this.emberParticles.push(flake);
            particleGroup.add(flake);
        }
    }

    /**
     * Floating 3D Culinary Garnish & Ingredients (Rosemary needles, Chili slices, Peppercorns)
     */
    buildFloatingIngredients() {
        const ingredientsGroup = new THREE.Group();
        this.scene.add(ingredientsGroup);

        // 1. Fresh Rosemary Needle Leaves
        const rosemaryGeo = new THREE.CylinderGeometry(0.015, 0.025, 0.35, 6);
        const rosemaryMat = new THREE.MeshStandardMaterial({
            color: 0x2e5a27,
            roughness: 0.6,
            metalness: 0.1
        });

        for (let i = 0; i < 6; i++) {
            const leaf = new THREE.Mesh(rosemaryGeo, rosemaryMat);
            leaf.position.set(
                (Math.random() - 0.5) * 3.8,
                (Math.random() - 0.5) * 2.8,
                (Math.random() - 0.5) * 1.8
            );
            leaf.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            leaf.userData = {
                rotSpeedX: 0.008,
                rotSpeedY: 0.006,
                floatOffset: Math.random() * Math.PI * 2
            };
            this.ingredientMeshes.push(leaf);
            ingredientsGroup.add(leaf);
        }

        // 2. Charred Chili Pepper Rings
        const chiliGeo = new THREE.TorusGeometry(0.12, 0.03, 6, 16);
        const chiliMat = new THREE.MeshStandardMaterial({
            color: 0xb71c1c,
            roughness: 0.35,
            metalness: 0.15
        });

        for (let i = 0; i < 4; i++) {
            const chili = new THREE.Mesh(chiliGeo, chiliMat);
            chili.position.set(
                (Math.random() - 0.5) * 3.6,
                (Math.random() - 0.5) * 2.6,
                (Math.random() - 0.5) * 1.5
            );
            chili.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            chili.userData = {
                rotSpeedX: 0.005,
                rotSpeedY: 0.009,
                floatOffset: Math.random() * Math.PI * 2
            };
            this.ingredientMeshes.push(chili);
            ingredientsGroup.add(chili);
        }

        // 3. Black Peppercorns
        const pepperGeo = new THREE.DodecahedronGeometry(0.04, 1);
        const pepperMat = new THREE.MeshStandardMaterial({
            color: 0x1a1614,
            roughness: 0.8,
            metalness: 0.1
        });

        for (let i = 0; i < 8; i++) {
            const pepper = new THREE.Mesh(pepperGeo, pepperMat);
            pepper.position.set(
                (Math.random() - 0.5) * 3.8,
                (Math.random() - 0.5) * 2.8,
                (Math.random() - 0.5) * 1.5
            );
            pepper.userData = {
                rotSpeedX: 0.012,
                rotSpeedY: 0.010,
                floatOffset: Math.random() * Math.PI * 2
            };
            this.ingredientMeshes.push(pepper);
            ingredientsGroup.add(pepper);
        }
    }

    bindEvents() {
        // Mouse Move Parallax
        window.addEventListener("mousemove", (e) => {
            const x = (e.clientX / window.innerWidth) * 2 - 1;
            const y = -(e.clientY / window.innerHeight) * 2 + 1;
            this.mouse.targetX = x * 0.4;
            this.mouse.targetY = y * 0.3;

            if (this.lights.pointer) {
                this.lights.pointer.position.x = x * 3.0;
                this.lights.pointer.position.y = y * 2.0;
            }

            // Parallax shift hero floating ingredients DOM elements if present
            const floatingEl = document.querySelectorAll(".hero-floating-ingredient");
            floatingEl.forEach((el, idx) => {
                const factor = (idx + 1) * 12;
                el.style.transform = `translate3d(${x * factor}px, ${-y * factor}px, 0)`;
            });
        }, { passive: true });

        // Scroll listener
        window.addEventListener("scroll", () => {
            const scrollY = window.scrollY || window.pageYOffset;
            const heroHeight = this.container.clientHeight || window.innerHeight;
            this.scrollProgress = Math.min(scrollY / heroHeight, 1.5);
        }, { passive: true });

        // Resize handler
        window.addEventListener("resize", () => {
            this.onWindowResize();
        }, { passive: true });

        if ("IntersectionObserver" in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    this.isVisible = entry.isIntersecting;
                });
            }, { threshold: 0.05 });
            observer.observe(this.container);
        }
    }

    onWindowResize() {
        if (!this.container || !this.renderer || !this.camera) return;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        if (!this.isVisible) return;

        const elapsedTime = this.clock ? this.clock.getElapsedTime() : 0;

        this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.05;
        this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.05;

        // Animate Steam
        for (let i = 0; i < this.steamParticles.length; i++) {
            const steam = this.steamParticles[i];
            steam.position.y += steam.userData.speedY;
            steam.position.x += steam.userData.driftX;
            steam.position.z += steam.userData.driftZ;
            steam.rotation.z += steam.userData.rotSpeed;

            // Fade out smoothly
            const progress = (steam.position.y - steam.userData.baseY) / (steam.userData.maxHeight - steam.userData.baseY);
            steam.material.opacity = Math.max(0, 0.10 * (1 - progress));
            steam.scale.setScalar(0.7 + progress * 2.2);

            if (steam.position.y > steam.userData.maxHeight) {
                steam.position.y = steam.userData.baseY;
                steam.position.x = (Math.random() - 0.5) * 1.6;
                steam.position.z = (Math.random() - 0.5) * 1.2;
                steam.material.opacity = 0.10;
            }
        }

        // Animate Embers & Salt
        for (let i = 0; i < this.emberParticles.length; i++) {
            const ember = this.emberParticles[i];
            if (ember.userData.speedY) ember.position.y += ember.userData.speedY;
            if (ember.userData.driftX) ember.position.x += ember.userData.driftX;
            if (ember.userData.rotSpeedX) ember.rotation.x += ember.userData.rotSpeedX;
            if (ember.userData.rotSpeedY) ember.rotation.y += ember.userData.rotSpeedY;

            if (ember.position.y > 2.5) {
                ember.position.y = -2.5;
                ember.position.x = (Math.random() - 0.5) * 4.0;
            }
        }

        // Animate Floating Ingredients
        for (let i = 0; i < this.ingredientMeshes.length; i++) {
            const ing = this.ingredientMeshes[i];
            ing.rotation.x += ing.userData.rotSpeedX;
            ing.rotation.y += ing.userData.rotSpeedY;
            ing.position.y += Math.sin(elapsedTime * 1.5 + ing.userData.floatOffset) * 0.0015;
            ing.position.x += Math.cos(elapsedTime * 1.2 + ing.userData.floatOffset) * 0.001;
        }

        this.renderer.render(this.scene, this.camera);
    }
}

// Attach to window
window.Hero3DFoodScene = Hero3DFoodScene;
