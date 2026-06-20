import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { PointerLockControlsCustom } from "./controls.js";
import {
  MeshBVH,
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
} from "three-mesh-bvh";
import RoomManager from "./RoomManager.js";
import { WeaponCrosshair } from "./WeaponCrosshair.js";

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

export default class World {
  constructor() {
    // Initialize arrays FIRST before any methods use them
    this.mixers = [];
    this.objects = [];

    this.time = Date.now();
    this.textureLoader = new THREE.TextureLoader();
    this.gltfLoader = new GLTFLoader(); // Add GLTF loader
    this.player = null;
    this.size = 200000;
    this.environmentLoaded = false;

    // Add RoomManager property
    this.roomManager = null;
    this.spawnPointsRequested = false;

    this.animate = () => {
      requestAnimationFrame(this.animate);

      const delta = Date.now() - this.time;
      const deltaSeconds = delta / 1000;

      if (this.controls) {
        this.controls.update(delta);
      }

      this.updateBarrier(delta);

      // Update all animation mixers
      this.updateAnimations(deltaSeconds);

      if (this.controls) {
        this.controls.applySpineRotation();
      }

      // Update player weapons and bullets
      if (this.player) {
        this.player.update(deltaSeconds);
      }

      // UPDATE ROOM MANAGER - ADD THIS
      if (this.roomManager) {
        this.roomManager.update(deltaSeconds);
      }

      // Update crosshair
      this.updateCrosshair();

      // this.updateTime(delta);
      this.renderer.render(this.scene, this.camera);
      this.time = Date.now();
    };
    this.crosshair3D = null;

    this.controls = null;
    this.init();
  }

  // Add this method to update all mixers
  updateAnimations(delta) {
    if (this.mixers && this.mixers.length > 0) {
      for (const mixer of this.mixers) {
        if (mixer) {
          mixer.update(delta);
        }
      }
    }
  }

  addMixer(mixer) {
    if (mixer && !this.mixers.includes(mixer)) {
      this.mixers.push(mixer);
    }
  }

  removeMixer(mixer) {
    const index = this.mixers.indexOf(mixer);
    if (index >= 0) {
      this.mixers.splice(index, 1);
    }
  }

  addObject(threeObj) {
    this.scene.add(threeObj);
    this.objects.push(threeObj);
  }

  removeObject(threeObj) {
    this.scene.remove(threeObj);
    const index = this.objects.indexOf(threeObj);
    if (index >= 0) this.objects.splice(index, 1);
  }

  getObjects() {
    return this.objects;
  }

  getDistanceTo(threeObj) {
    if (this.player) {
      return this.player.getThreeObj().position.distanceTo(threeObj.position);
    } else {
      return 0;
    }
  }

  // New method to load the environment model
  loadEnvironmentModel() {
    console.log("Loading environment model...");

    this.gltfLoader.load(
      "/assets/models/shooting_game_enviornment_map_tdm5-opt.glb",
      (gltf) => {
        console.log("Environment model loaded successfully");
        const model = gltf.scene;

        // Scale and position the model as needed
        model.scale.set(15, 15, 15); // Adjust scale if needed
        model.position.set(0, 0, 0);
        model.rotation.set(0, 0, 0);

        // Find the ground child
        model.traverse((child) => {
          if (child.isMesh) {
            // Ensure materials are set up correctly
            if (child.material) {
              // If it's an array of materials
              if (Array.isArray(child.material)) {
                child.material.forEach((mat) => {
                  this.fixMaterial(mat);
                });
              } else {
                this.fixMaterial(child.material);
              }
            }

            // Enable shadows
            child.castShadow = true;
            child.receiveShadow = true;

            // Add to objects array for collision detection
            this.objects.push(child);

            // If this is the ground, we'll use it for grass patches
            if (child.name === "ground_ground_0") {
              this.groundMesh = child;
            }
          }
        });

        // Add the entire model to the scene
        this.scene.add(model);
        this.environmentLoaded = true;

        this.findBuildingMeshes();
        this.createMapBarrier(model);

        // Add floating boxes above the ground
        this.addFloatingBoxes();
      },
      (xhr) => {
        console.log(
          `Environment model loading: ${Math.round((xhr.loaded / xhr.total) * 100)}%`,
        );
      },
      (error) => {
        console.error("Error loading environment model:", error);
      },
    );
  }

  createMapBarrier(mapModel) {
    const box = new THREE.Box3().setFromObject(mapModel);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    // Find the actual ground level (lowest point of the map)
    let groundLevel = Infinity;
    mapModel.traverse((child) => {
      if (child.isMesh) {
        const childBox = new THREE.Box3().setFromObject(child);
        groundLevel = Math.min(groundLevel, childBox.min.y);
      }
    });

    // If we couldn't find ground level, use box.min.y
    if (groundLevel === Infinity) {
      groundLevel = box.min.y;
    }

    // Calculate radius based on the largest horizontal dimension
    const mapRadius = Math.max(size.x, size.z) / 2;

    // Store barrier properties for collision detection
    this.barrierData = {
      center: new THREE.Vector3(center.x, groundLevel, center.z), // Center at ground level
      radius: mapRadius, // Slightly larger than map
      height: size.y,
      groundLevel: groundLevel,
    };

    // Create a hemisphere geometry (dome)
    const geometry = new THREE.SphereGeometry(
      this.barrierData.radius, // Use the stored radius
      64,
      32,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2,
    );

    const material = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0x00aaff) },
        glowColor: { value: new THREE.Color(0x44aaff) },
      },
      vertexShader: `
      varying vec2 vUv;
      varying vec3 vPosition;
      varying vec3 vNormal;
      
      void main() {
        vUv = uv;
        vPosition = position;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
      fragmentShader: `
      uniform float time;
      uniform vec3 color;
      uniform vec3 glowColor;
      varying vec2 vUv;
      varying vec3 vPosition;
      varying vec3 vNormal;

      void main() {
        // Create a grid pattern on the dome
        float gridX = sin(vPosition.x * 0.5) * 0.5 + 0.5;
        float gridZ = sin(vPosition.z * 0.5) * 0.5 + 0.5;
        float grid = (gridX + gridZ) * 0.5;
        
        // Scanlines that move from bottom to top
        float scanline = sin(vUv.y * 30.0 - time * 3.0) * 0.5 + 0.5;
        
        // Energy pulse that radiates from the center
        float distFromCenter = length(vPosition);
        float pulse = sin(distFromCenter * 2.0 - time * 4.0) * 0.5 + 0.5;
        
        // Glow at the base and top of the dome
        float baseGlow = 1.0 - abs(vUv.y - 0.0);
        float topGlow = 1.0 - abs(vUv.y - 1.0);
        float verticalGlow = max(baseGlow, topGlow) * 0.5;
        
        // Hexagonal pattern (optional)
        float hexX = sin(vPosition.x * 1.5) * cos(vPosition.z * 1.5);
        float hexY = cos(vPosition.x * 1.5) * sin(vPosition.z * 1.5);
        float hexPattern = abs(hexX + hexY) * 0.3;
        
        // Combine all effects
        float alpha = scanline * 0.15
                    + pulse * 0.2
                    + verticalGlow * 0.3
                    + grid * 0.1
                    + hexPattern;
        
        // Add rim lighting effect based on viewing angle
        float rim = abs(dot(vNormal, vec3(0.0, 1.0, 0.0)));
        rim = pow(1.0 - rim, 2.0) * 0.5;
        alpha += rim;
        
        alpha = clamp(alpha, 0.1, 0.6);
        
        // Mix between base color and glow color based on height
        vec3 finalColor = mix(color, glowColor, vUv.y);
        
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    });

    this.barrierMesh = new THREE.Mesh(geometry, material);

    // Position the dome so its base is exactly at ground level
    // The sphere's origin is at its center, so we need to move it up by radius
    this.barrierMesh.position.set(
      this.barrierData.center.x,
      this.barrierData.groundLevel, // Base at ground level
      this.barrierData.center.z,
    );

    this.scene.add(this.barrierMesh);

    // Add a glowing ring at the base
    this.addBaseRing(this.barrierData.center, this.barrierData.radius);

    // Add a second ring at ground level to show the boundary
    this.addGroundRing(this.barrierData.center, this.barrierData.radius);
  }

  addBaseRing(center, radius) {
    // Create a glowing ring at the base of the dome
    const ringGeometry = new THREE.TorusGeometry(radius, 1, 16, 100);
    const ringMaterial = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0x44aaff) },
      },
      vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
      fragmentShader: `
      uniform float time;
      uniform vec3 color;
      varying vec2 vUv;
      
      void main() {
        float pulse = sin(time * 2.0) * 0.5 + 0.5;
        float alpha = sin(vUv.x * 20.0 - time * 5.0) * 0.3 + 0.3;
        alpha += pulse * 0.2;
        alpha = clamp(alpha, 0.2, 0.6);
        
        gl_FragColor = vec4(color, alpha);
      }
    `,
    });

    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.position.copy(center);
    ring.position.y = center.y + 0.5; // Slightly above ground to avoid z-fighting
    ring.rotation.x = Math.PI / 2; // Lay flat

    this.scene.add(ring);
    this.ringMesh = ring;
  }

  addGroundRing(center, radius) {
    // Add a subtle ring on the ground to show the boundary
    const groundRingGeo = new THREE.RingGeometry(radius - 1, radius, 64);
    const groundRingMat = new THREE.MeshBasicMaterial({
      color: 0x44aaff,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
    });

    const groundRing = new THREE.Mesh(groundRingGeo, groundRingMat);
    groundRing.position.copy(center);
    groundRing.position.y = center.y + 0.1; // Just above ground
    groundRing.rotation.x = -Math.PI / 2; // Lay flat facing up

    this.scene.add(groundRing);
    this.groundRing = groundRing;
  }

  updateBarrier(delta) {
    if (this.barrierMesh) {
      this.barrierMesh.material.uniforms.time.value += delta / 1000;
    }
    if (this.ringMesh) {
      this.ringMesh.material.uniforms.time.value += delta / 1000;
      // Optional: rotate the ring slowly
      this.ringMesh.rotation.y += delta * 0.0001;
    }
  }

  findBuildingMeshes() {
    this.buildingMeshes = [];

    this.scene.traverse((child) => {
      if (child.isMesh && child.name.startsWith("Building_")) {
        // BUILD BVH ONCE
        if (child.geometry && !child.geometry.boundsTree) {
          child.geometry.computeBoundsTree();
        }

        this.buildingMeshes.push(child);

        if (!this.objects.includes(child)) {
          this.objects.push(child);
        }
      }
    });

    console.log(`Found ${this.buildingMeshes.length} building meshes`);
  }

  // Helper method to fix material lighting
  fixMaterial(material) {
    if (material) {
      // Make sure material responds to lights
      material.emissive = material.emissive || new THREE.Color(0x000000);
      material.emissive.setHex(0x000000); // Remove any emission

      // Increase reflectivity
      material.shininess = 30;

      // Ensure material is not too dark
      if (material.color) {
        // Boost color brightness slightly if it's too dark
        const color = material.color;
        const r = Math.min(1, color.r * 1.2);
        const g = Math.min(1, color.g * 1.2);
        const b = Math.min(1, color.b * 1.2);
        color.setRGB(r, g, b);
      }

      material.needsUpdate = true;
    }
  }

  createBoxesAtSpawnPoints(spawnPositions) {
    // Clear existing boxes first
    this.clearSpawnPointBoxes();

    console.log(
      `Creating ${spawnPositions.length} boxes at server spawn points`,
    );

    const material = new THREE.MeshPhongMaterial({
      map: this.textureLoader.load("/assets/textures/cube-map.jpg"),
    });

    // Define UV mappings (keep your existing code)
    const bricks = [
      new THREE.Vector2(0, 0.666),
      new THREE.Vector2(0.5, 0.666),
      new THREE.Vector2(0.5, 1),
      new THREE.Vector2(0, 1),
    ];
    const crate = [
      new THREE.Vector2(0, 0.333),
      new THREE.Vector2(0.5, 0.333),
      new THREE.Vector2(0.5, 0.666),
      new THREE.Vector2(0, 0.666),
    ];
    const stone = [
      new THREE.Vector2(0.5, 0.333),
      new THREE.Vector2(1, 0.333),
      new THREE.Vector2(1, 0.666),
      new THREE.Vector2(0.5, 0.666),
    ];
    const wood = [
      new THREE.Vector2(0.5, 0),
      new THREE.Vector2(1, 0),
      new THREE.Vector2(1, 0.333),
      new THREE.Vector2(0.5, 0.333),
    ];

    const materials = [bricks, crate, stone, wood];
    const geometries = [];

    // Create geometries for each material type
    for (let i = 0; i < materials.length; i++) {
      const geometry = new THREE.BoxGeometry(20, 20, 20);
      const faceUVs = materials[i];
      const newUVs = [];

      for (let face = 0; face < 6; face++) {
        newUVs.push(
          faceUVs[0].x,
          faceUVs[0].y,
          faceUVs[1].x,
          faceUVs[1].y,
          faceUVs[3].x,
          faceUVs[3].y,
          faceUVs[1].x,
          faceUVs[1].y,
          faceUVs[2].x,
          faceUVs[2].y,
          faceUVs[3].x,
          faceUVs[3].y,
        );
      }

      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(newUVs, 2));
      geometries.push(geometry);
    }

    const BOX_SIZE = 1.5;

    // Create boxes at each server-provided spawn position
    spawnPositions.forEach((pos, index) => {
      const randomIndex = Math.floor(Math.random() * geometries.length);

      const mesh = new THREE.Mesh(geometries[randomIndex], material);
      mesh.scale.set(BOX_SIZE, BOX_SIZE, BOX_SIZE);
      mesh.position.set(pos.x, pos.y, pos.z);
      mesh.rotation.y = Math.random() * Math.PI;
      mesh.rotation.z = Math.PI / 2;

      mesh.userData.rotationSpeed = (Math.random() - 0.5) * 0.01;
      mesh.userData.isSpawnPoint = true;
      mesh.userData.spawnPointId = index;

      this.scene.add(mesh);
      this.objects.push(mesh);

      // Store spawn point info
      if (!this.spawnPoints) this.spawnPoints = [];
      this.spawnPoints.push({
        id: index,
        position: { x: pos.x, y: pos.y, z: pos.z },
        rotation: { x: 0, y: mesh.rotation.y },
        mesh: mesh,
      });
    });

    console.log(
      `Created ${spawnPositions.length} boxes at server spawn points`,
    );
  }

  addFloatingBoxes() {
    // Prevent multiple requests
    if (this.spawnPointsRequested) {
      console.log("Spawn points already requested, skipping");
      return;
    }

    if (this.player && this.player.socket) {
      this.spawnPointsRequested = true;
      this.requestSpawnPointsFromServer();
    } else {
      console.log("Waiting for player to request spawn points...");
      const checkInterval = setInterval(() => {
        if (this.player && this.player.socket && !this.spawnPointsRequested) {
          clearInterval(checkInterval);
          this.spawnPointsRequested = true;
          this.requestSpawnPointsFromServer();
        }
      }, 100);

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
      }, 10000);
    }
  }

  requestSpawnPointsFromServer() {
    if (!this.player || !this.player.socket) return;

    console.log("Requesting spawn points from server...");
    this.player.socket.emit("requestSpawnPoints");

    // Listen for spawn points from server
    this.player.socket.once("spawnPoints", (spawnPositions) => {
      console.log(`Received ${spawnPositions.length} spawn points from server`);
      this.createBoxesAtSpawnPoints(spawnPositions);
    });
  }

  spawnPlayerAtPoint(spawnPoint) {
    if (!this.player) return;

    // Position the player at the spawn point
    this.player.setPos({
      x: spawnPoint.x,
      y: spawnPoint.y,
      z: spawnPoint.z,
    });

    console.log(`Player spawned at position:`, spawnPoint);
  }

  initSky() {
    // Remove any existing lights first
    this.scene.children.forEach((child) => {
      if (child instanceof THREE.Light) {
        this.scene.remove(child);
      }
    });

    // Create sun light - fixed at noon position
    this.sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
    this.sunLight.position.set(1000, 2000, 1000); // High noon position
    this.sunLight.castShadow = true;
    this.sunLight.receiveShadow = true;

    // Improve shadow quality
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 5000;
    this.sunLight.shadow.camera.left = -1000;
    this.sunLight.shadow.camera.right = 1000;
    this.sunLight.shadow.camera.top = 1000;
    this.sunLight.shadow.camera.bottom = -1000;
    this.sunLight.shadow.bias = -0.0005;

    this.scene.add(this.sunLight);

    // Add a secondary fill light to brighten shadows
    this.fillLight = new THREE.DirectionalLight(0xffffff, 1.0);
    this.fillLight.position.set(-500, 1000, -500);
    this.scene.add(this.fillLight);

    // Add ambient light for base illumination
    this.ambientLight = new THREE.AmbientLight(0x404060, 1.2);
    this.scene.add(this.ambientLight);

    // Set sky color to bright blue
    this.scene.background = new THREE.Color(0x87ceeb); // Sky blue
  }

  init() {
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      1,
      2000000,
    );
    this.scene = new THREE.Scene();
    this.scene.add(this.camera);
    window.addEventListener("resize", this.onWindowResize.bind(this), false);
    this.initSky();

    // Load environment model instead of grass and cubes
    this.loadEnvironmentModel();

    this.animate();
  }

  initControls(player) {
    this.player = player;
    this.controls = new PointerLockControlsCustom(this.camera, player, this);
    // this.scene.add(this.controls.getObject());

    // Don't add to scene on mobile? Or handle differently
    if (!this.controls.isMobile) {
      this.scene.add(this.controls.getObject());
    } else {
      this.scene.add(this.controls.getObject());
    }

    // Initialize crosshair
    this.crosshair3D = new WeaponCrosshair(this.camera, this.scene);
    this.crosshair3D.hide();

    // INITIALIZE ROOM MANAGER AFTER PLAYER IS CREATED - ADD THIS
    if (player && player.socket) {
      this.roomManager = new RoomManager(this, player.socket, player);
      console.log("RoomManager initialized");
    }
  }

  setAimState(aiming) {
    if (this.crosshair3D) this.crosshair3D.setAiming(aiming);
    if (this.camera) {
      // FOV is handled in controls, but you can also do it here
    }
  }

  // Add method to update crosshair (call in animate loop)
  updateCrosshair() {
    if (this.crosshair3D) {
      this.crosshair3D.update();
    }
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  clearSpawnPointBoxes() {
    if (this.spawnPoints) {
      this.spawnPoints.forEach((spawnPoint) => {
        if (spawnPoint.mesh && spawnPoint.mesh.parent) {
          this.scene.remove(spawnPoint.mesh);
          const index = this.objects.indexOf(spawnPoint.mesh);
          if (index >= 0) this.objects.splice(index, 1);
        }
      });
    }
    this.spawnPoints = [];
    console.log("Cleared existing spawn point boxes");
  }
}
