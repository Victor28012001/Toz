// classes/World.js
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { PointerLockControlsCustom } from "./controls.js";
import {
  MeshBVH,
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
} from "three-mesh-bvh";
import RoomManager from "./RoomManager.js";
import { WeaponCrosshair } from "./WeaponCrosshair.js";
import { initLabelRenderer, renderLabels } from "./Player.js";
import MapManager, { MAPS } from "./MapManager.js";

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

export default class World {
  constructor() {
    this.isMobile = /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent);
    this.mixers = [];
    this.objects = [];
    this.time = Date.now();
    this.textureLoader = new THREE.TextureLoader();
    this.gltfLoader = new GLTFLoader();
    this.player = null;
    this.size = 200000;
    this.environmentLoaded = false;
    this.roomManager = null;
    this.mapManager = null;
    this.spawnPointsRequested = false;

    this.controls = null;

    // Jetpack pickups array (multiple per greeble map)
    this.jetpackPickups = [];
    this.jetpackGLB = null; // cached jetpack model

    this.waterSurfaceY = null;

    // Mobile perf
    this.targetFrameRate = 60;
    this.lastFrameTime = 0;
    this.frameInterval = 1000 / 60;
    this.isReducedPerformance = false;
    this.frameCounter = 0;
    this.collisionFrameSkip = this.isMobile ? 2 : 1;
    this.minimapFrameSkip = this.isMobile ? 3 : 1;
    // this.animationFrameSkip = this.isMobile ? 2 : 1;
    this.animationFrameSkip = this.isMobile ? 1 : 1;
    this.roomManagerFrameSkip = this.isMobile ? 2 : 1;

    this.groundRaycaster = new THREE.Raycaster();

    this.animate = () => {
      requestAnimationFrame(this.animate);
      const now = performance.now();
      let delta = now - this.time;
      const deltaSeconds = delta / 1000;
      this.time = now;
      this.frameCounter++;

      if (
        this.isReducedPerformance &&
        now - this.lastFrameTime < this.frameInterval
      ) {
        this.renderer.render(this.scene, this.camera);
        return;
      }
      this.lastFrameTime = now;

      if (this.controls) this.controls.update(delta);

      if (!this.isMobile || this.frameCounter % 2 === 0) {
        this.updateBarrier(delta);
      }

      if (!this.isMobile || this.frameCounter % this.animationFrameSkip === 0) {
        this.updateAnimations(deltaSeconds);
      }

      if (this.controls && !this.controls.isMobile) {
        this.controls.applySpineRotation();
      }

      if (this.player) this.player.update(deltaSeconds);

      if (this.roomManager) {
        if (
          !this.isMobile ||
          this.frameCounter % this.roomManagerFrameSkip === 0
        ) {
          this.roomManager.update(deltaSeconds);
        }
      }

      if (!this.isMobile || this.frameCounter % this.minimapFrameSkip === 0) {
        if (
          window.minimap &&
          typeof window.minimap.updateAll === "function" &&
          this.frameCounter % 2 === 0
        ) {
          window.minimap.updateAll();
        }
        if (window.updateInteractionPrompt) window.updateInteractionPrompt();
      }

      if (!this.isMobile || this.frameCounter % 2 === 0) {
        if (window.players) {
          const allPlayers = window.players.getAll();
          for (let i = 0; i < allPlayers.length; i++) {
            const p = allPlayers[i];
            // if (p !== window.self_player && p.interpolate) p.interpolate();
            if (p !== window.self_player && p.interpolate && !p.isDead) {
              p.interpolate();
            }
          }
        }
      }

      if (this.isMobile && window.mobileControls) {
        window.mobileControls.updateSmoothing();
      }

      this.updateCrosshair();

      if (window.syncPlayerToServer) {
        const syncInterval = this.isMobile ? 100 : 50;
        if (this.lastSyncTime === undefined) this.lastSyncTime = now;
        if (now - this.lastSyncTime >= syncInterval) {
          this.lastSyncTime = now;
          window.syncPlayerToServer();
        }
      }

      this.updateInstanceVisibility();

      // ── GREEBLE MAP GROUND CHECK ───────────────────────────────────────
      if (
        this.mapManager?.currentMap === "greeble_map" &&
        this.player &&
        !this.player.isDead
      ) {
        const playerPos = this.player.threeObj.position;
        const playerHeight = 17;
        const origin = new THREE.Vector3(
          playerPos.x,
          playerPos.y + playerHeight / 2,
          playerPos.z,
        );
        this.groundRaycaster.set(origin, new THREE.Vector3(0, -1, 0), 0, 20);
        const hits = this.groundRaycaster.intersectObjects(this.objects, true);

        if (hits.length > 0) {
          const distanceToGround = hits[0].distance;
          const groundY = hits[0].point.y;
          if (
            distanceToGround < playerHeight / 2 + 0.5 ||
            playerPos.y <= groundY + 0.1
          ) {
            this.player.threeObj.position.y = groundY;
            this.controls.velocity.y = 0;
            this.controls.isOnObject = true;
            this.controls.canJump = true;
          } else {
            this.controls.velocity.y -= 0.2 * deltaSeconds;
            this.controls.isOnObject = false;
            this.controls.canJump = false;
            this.player.threeObj.position.y +=
              this.controls.velocity.y * deltaSeconds;
          }
        } else {
          this.controls.velocity.y -= 0.2 * deltaSeconds;
          this.controls.isOnObject = false;
          this.controls.canJump = false;
          this.player.threeObj.position.y +=
            this.controls.velocity.y * deltaSeconds;
        }
      }

      // ── JETPACK PICKUPS (greeble map only) ────────────────────────────
      if (this.mapManager?.currentMap === "greeble_map") {
        this.updateJetpackPickups(deltaSeconds);
        // Update attached jetpack model on player back
        this.updateAttachedJetpackModel();
      }

      // ── SOUNDS ────────────────────────────────────────────────────────
      if (this.controls?.enabled && this.player && !this.player.isDead) {
        const isMoving =
          Math.abs(this.controls.velocity.x) > 0.05 ||
          Math.abs(this.controls.velocity.z) > 0.05;
        const isRunning = isMoving && this.controls.isRunning;
        const isOnGround = this.controls.isOnObject || this.controls.canJump;
        const shouldPlayFootsteps =
          isMoving && this.controls.enabled && isOnGround;

        if (isRunning) {
          window.targetBreathInterval = 0.5;
          window.targetBreathVolume = 0.03;
        } else if (isMoving) {
          window.targetBreathInterval = 0.6;
          window.targetBreathVolume = 0.015;
        } else {
          window.targetBreathInterval = 0.8;
          window.targetBreathVolume = 0.005;
        }

        window.breathInterval +=
          (window.targetBreathInterval - window.breathInterval) *
          deltaSeconds *
          3;
        window.breathVolume +=
          (window.targetBreathVolume - window.breathVolume) * deltaSeconds * 3;
        const safeBreathVolume = Math.max(0, Math.min(1, window.breathVolume));
        if (window.breathingSounds) {
          window.breathingSounds.forEach((s) => {
            if (s) s.volume = safeBreathVolume;
          });
        }

        window.breathTimer += deltaSeconds;
        if (window.breathTimer >= window.breathInterval) {
          window.breathTimer = 0;
          if (window.breathingSounds) {
            window.breathingSounds.forEach((s) => {
              if (s) {
                s.pause();
                s.currentTime = 0;
              }
            });
          }
          const snd =
            window.breathingSounds?.[
              window.breathIndex % window.breathingSounds.length
            ];
          if (snd) snd.play().catch(() => {});
          window.breathIndex++;
        }

        let interval = isRunning ? 0.35 : 0.55;
        if (isRunning !== window.wasRunning) {
          window.footstepTimer = interval * 0.5;
          window.wasRunning = isRunning;
        }
        if (shouldPlayFootsteps) {
          window.footstepTimer += deltaSeconds;
          if (window.footstepTimer >= interval) {
            window.footstepTimer = 0;
            const snd =
              window.footstepSounds?.[
                window.footstepIndex % window.footstepSounds.length
              ];
            if (snd) {
              snd.currentTime = 0;
              snd.play().catch(() => {});
            }
            window.footstepIndex++;
          }
        } else {
          window.footstepTimer = 0;
          window.wasRunning = false;
        }
      }

      this.renderer.render(this.scene, this.camera);
      renderLabels(this.scene, this.camera);
    };

    this.crosshair3D = null;
    this.controls = null;
    this.init();
    this.performanceMode = "balanced";
    this.drawDistance = 2000;
    this.shadowQuality = "medium";
    this.assetCache = {
      ammoCrate: null,
      vaccineCase: null,
      ammoContents: null,
      syringe: null,
    };
    this.assetsLoaded = false;
    this.pickupRaycaster = new THREE.Raycaster();
  }

  // ── JETPACK PICKUP SYSTEM (greeble map) ─────────────────────────────────

  /** Preload the jetpack GLB once */
  async _loadJetpackGLB() {
    if (this.jetpackGLB) return Promise.resolve(this.jetpackGLB);
    return new Promise((resolve) => {
      this.gltfLoader.load(
        "/assets/models/jetpack.glb",
        (gltf) => {
          this.jetpackGLB = gltf.scene;
          console.log("✅ Jetpack GLB loaded");
          resolve(this.jetpackGLB);
        },
        undefined,
        (err) => {
          console.warn("Jetpack GLB failed, using fallback box:", err);
          resolve(null);
        },
      );
    });
  }

  /** Spawn N jetpack pickups scattered around the greeble map */
  async spawnJetpackPickups(mapConfig) {
    // Clear existing pickups first
    this.jetpackPickups.forEach((p) => {
      if (p.mesh) this.scene.remove(p.mesh);
      if (p.modelMesh) this.scene.remove(p.modelMesh);
    });
    this.jetpackPickups = [];

    await this._loadJetpackGLB();

    const count = mapConfig.jetpackSpawnCount || 5;
    const radius = mapConfig.jetpackSpawnRadius || 80;
    // Spawn at a high altitude so they fall down
    const spawnHeight = 150;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const r = radius * (0.4 + Math.random() * 0.6);
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;

      // Spawn at high altitude with random XZ position
      const spawnPos = new THREE.Vector3(
        x,
        spawnHeight + Math.random() * 30,
        z,
      );
      this._spawnOneJetpackPickup(spawnPos);
    }
  }

  updateJetpackPickups(deltaSeconds) {
    const now = performance.now() * 0.001;
    const GRAVITY = -25; // Same as player gravity

    this.jetpackPickups.forEach((pickup, idx) => {
      if (pickup.collected) return;

      // If pickup hasn't landed yet, apply gravity
      if (pickup.isFalling && !pickup.hasLanded) {
        // Apply gravity
        pickup.velocity.y += GRAVITY * deltaSeconds;
        pickup.position.y += pickup.velocity.y * deltaSeconds;

        // Raycast downward to find ground
        const raycaster = this.pickupRaycaster;
        const rayOrigin = pickup.position.clone();
        rayOrigin.y += 2; // Start from above the pickup
        raycaster.set(rayOrigin, new THREE.Vector3(0, -1, 0));

        // Check collision with world objects (excluding other pickups)
        const hits = raycaster.intersectObjects(this.objects, true);

        let hitGround = false;
        for (const hit of hits) {
          // Skip hitting the pickup itself or other pickups
          if (hit.object === pickup.mesh || hit.object === pickup.modelMesh)
            continue;

          // Check if we hit the ground
          if (hit.distance < 3 && hit.point.y < pickup.position.y + 1) {
            hitGround = true;
            pickup.groundY = hit.point.y;
            break;
          }
        }

        if (hitGround && pickup.velocity.y <= 0) {
          // Land on ground
          pickup.position.y = pickup.groundY + 0.5; // Slight offset above ground
          pickup.velocity.y = 0;
          pickup.isFalling = false;
          pickup.hasLanded = true;
        }
      }

      // Only animate floating/rotation after landing
      if (pickup.hasLanded) {
        const floatY = Math.sin(now * 1.8 + pickup.angle) * 0.35;
        const newY = pickup.position.y + floatY;

        if (pickup.mesh) {
          pickup.mesh.position.y = newY;
          pickup.mesh.rotation.y += 0.025;
        }
        if (pickup.modelMesh) {
          pickup.modelMesh.position.y = newY;
          pickup.modelMesh.rotation.y += 0.025;
        }
        if (pickup.light) {
          pickup.light.position.y = newY;
          pickup.light.intensity = 1.2 + Math.sin(now * 3 + pickup.angle) * 0.4;
        }
      } else {
        // While falling, update positions directly
        if (pickup.mesh) {
          pickup.mesh.position.copy(pickup.position);
        }
        if (pickup.modelMesh) {
          pickup.modelMesh.position.copy(pickup.position);
        }
        if (pickup.light) {
          pickup.light.position.copy(pickup.position);
        }
      }

      // Collision with player
      if (this.player && this.controls) {
        const playerPos = this.player.threeObj.position;
        const dist = playerPos.distanceTo(pickup.position);
        if (dist < 4) {
          pickup.collected = true;

          // remove visuals immediately (cheap)
          pickup.mesh.visible = false;
          pickup.modelMesh.visible = false;
          pickup.light.visible = false;

          // defer heavy stuff
          requestAnimationFrame(() => {
            this._handleJetpackPickup();
          });

          return;
        }
      }
    });
  }

  _handleJetpackPickup() {
    if (this.controls.jetpackActive) {
      this.controls.jetpackFuel = Math.min(
        this.controls.jetpackFuel + 50,
        this.controls.maxJetpackFuel,
      );
    } else {
      this.controls.activateJetpack();
      if (this.controls.attachedJetpackModel) {
        this.controls.attachedJetpackModel.visible = true;
      }
    }

    // Play pickup animation
    if (this.controls.playPickupAnimation) {
      this.controls.playPickupAnimation();
    }

    if (window.roomManager?.showNotification) {
      window.roomManager.showNotification("⛽ JETPACK", "#00ffaa");
    }
  }

  updateAttachedJetpackModel() {
    if (!this.controls?.attachedJetpackModel) return;
    if (!this.controls.isJetpacking) return;

    // Get cylinders - could be from model.userData or stored reference
    let cylinders = this.controls.attachedJetpackCylinders;

    // If cylinders array is empty, try to find them again
    if (!cylinders || cylinders.length === 0) return;

    // Throttle particles for performance
    if (this.frameCounter % 2 !== 0) return;

    // Spawn particles from each cylinder
    cylinders.forEach((cyl) => {
      if (cyl && cyl.parent) {
        this._spawnCometTrail(cyl);
      }
    });
  }

  _spawnCometTrail(sourceMesh) {
    const worldPos = new THREE.Vector3();
    sourceMesh.getWorldPosition(worldPos);

    const particleCount = 4;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = worldPos.x + (Math.random() - 0.5) * 0.3;
      positions[i * 3 + 1] = worldPos.y;
      positions[i * 3 + 2] = worldPos.z + (Math.random() - 0.5) * 0.3;

      const t = i / particleCount;
      colors[i * 3] = 1.0;
      colors[i * 3 + 1] = Math.max(0, 0.6 - t * 0.5);
      colors[i * 3 + 2] = Math.max(0, 0.2 - t * 0.2);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.35 + Math.random() * 0.25,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.9,
    });

    const points = new THREE.Points(geo, mat);
    this.scene.add(points);

    let life = 0;
    const maxLife = 0.3 + Math.random() * 0.2;
    const velY = -1.5 - Math.random() * 1.5;
    const velX = (Math.random() - 0.5) * 0.8;
    const velZ = (Math.random() - 0.5) * 0.8;

    let lastTime = performance.now();

    const tick = () => {
      const now = performance.now();
      let dt = Math.min(0.033, (now - lastTime) / 1000);
      lastTime = now;

      life += dt;
      if (life >= maxLife) {
        this.scene.remove(points);
        geo.dispose();
        mat.dispose();
        return;
      }

      const progress = life / maxLife;
      const pos = geo.attributes.position.array;

      for (let i = 0; i < particleCount; i++) {
        pos[i * 3] += velX * dt * (1 - i / particleCount);
        pos[i * 3 + 1] += velY * dt;
        pos[i * 3 + 2] += velZ * dt * (1 - i / particleCount);
      }

      geo.attributes.position.needsUpdate = true;
      mat.opacity = 0.9 * (1 - progress);

      requestAnimationFrame(tick);
    };

    lastTime = performance.now();
    requestAnimationFrame(tick);
  }

  // ── EXISTING METHODS ────────────────────────────────────────────────────

  async preloadRoomAssets() {
    if (
      this.mapManager?.currentMapConfig &&
      !this.mapManager.currentMapConfig.hasRooms
    ) {
      console.log("Current map doesn't need room assets, skipping...");
      return;
    }
    if (this.assetsLoaded) return;

    console.log("Preloading room assets...");
    const loader = new GLTFLoader();
    const promises = [
      new Promise((resolve) => {
        loader.load(
          "/assets/models/soviet_weapons_ammo_crate_box_animated_low_poly-opt-opt.glb",
          (gltf) => {
            this.assetCache.ammoCrate = gltf.scene;
            resolve();
          },
          undefined,
          () => resolve(),
        );
      }),
      new Promise((resolve) => {
        loader.load(
          "/assets/models/pelican_case_game_ready-opt.glb",
          (gltf) => {
            this.assetCache.vaccineCase = gltf.scene;
            resolve();
          },
          undefined,
          () => resolve(),
        );
      }),
      new Promise((resolve) => {
        loader.load(
          "/assets/models/ammo_boxes_pack_low-poly_game-ready-opt.glb",
          (gltf) => {
            this.assetCache.ammoContents = gltf.scene;
            resolve();
          },
          undefined,
          () => resolve(),
        );
      }),
      new Promise((resolve) => {
        loader.load(
          "/assets/models/syringe-opt.glb",
          (gltf) => {
            this.assetCache.syringe = gltf.scene;
            resolve();
          },
          undefined,
          () => resolve(),
        );
      }),
    ];
    await Promise.all(promises);
    this.assetsLoaded = true;
    console.log("✅ All room assets preloaded");
  }

  setPerformanceMode(mode) {
    this.performanceMode = mode;
    switch (mode) {
      case "high":
        this.drawDistance = 3000;
        this.setShadowQuality("high");
        this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
        break;
      case "balanced":
        this.drawDistance = 1500;
        this.setShadowQuality("medium");
        this.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio));
        break;
      case "low":
        this.drawDistance = 800;
        this.setShadowQuality("low");
        this.renderer.setPixelRatio(1);
        break;
    }
    this.camera.far = this.drawDistance;
    this.camera.updateProjectionMatrix();
  }

  setShadowQuality(quality) {
    if (!this.sunLight) return;
    switch (quality) {
      case "high":
        this.sunLight.shadow.mapSize.width =
          this.sunLight.shadow.mapSize.height = 2048;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        break;
      case "medium":
        this.sunLight.shadow.mapSize.width =
          this.sunLight.shadow.mapSize.height = 1024;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        break;
      case "low":
        this.sunLight.shadow.mapSize.width =
          this.sunLight.shadow.mapSize.height = 512;
        this.renderer.shadowMap.enabled = false;
        break;
    }
  }

  setMobileQuality() {
    if (this.sunLight) {
      this.sunLight.shadow.mapSize.width =
        this.sunLight.shadow.mapSize.height = 512;
      this.sunLight.shadow.camera.far = 1000;
    }
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.camera.far = 1500;
    this.camera.updateProjectionMatrix();
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.updateDistanceThreshold = 100;
  }

  setReducedPerformance(reduced) {
    this.isReducedPerformance = reduced;
    if (reduced) {
      this.targetFrameRate = 30;
      this.frameInterval = 1000 / 30;
      this.renderer.setPixelRatio(1);
      if (this.sunLight) {
        this.sunLight.shadow.mapSize.width =
          this.sunLight.shadow.mapSize.height = 256;
      }
      this.renderer.shadowMap.enabled = false;
      if (!this._originalUpdateBarrier)
        this._originalUpdateBarrier = this.updateBarrier;
      this.updateBarrier = () => {};
      this.animationUpdateSkip = 2;
      this.frameCounter = 0;
    } else {
      this.targetFrameRate = 60;
      this.frameInterval = 1000 / 60;
      this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
      this.renderer.shadowMap.enabled = true;
      if (this.sunLight) {
        this.sunLight.shadow.mapSize.width =
          this.sunLight.shadow.mapSize.height = 512;
      }
      if (this._originalUpdateBarrier)
        this.updateBarrier = this._originalUpdateBarrier;
      this.animationUpdateSkip = 0;
    }
  }

  updateAnimations(delta) {
    if (this.isReducedPerformance && this.animationUpdateSkip) {
      this.frameCounter = (this.frameCounter || 0) + 1;
      if (this.frameCounter % this.animationUpdateSkip === 0) return;
    }
    if (this.mixers?.length > 0) {
      for (const mixer of this.mixers) {
        if (mixer) mixer.update(delta);
      }
    }
  }

  addMixer(mixer) {
    if (mixer && !this.mixers.includes(mixer)) this.mixers.push(mixer);
  }
  removeMixer(mixer) {
    const i = this.mixers.indexOf(mixer);
    if (i >= 0) this.mixers.splice(i, 1);
  }
  addObject(threeObj) {
    this.scene.add(threeObj);
    this.objects.push(threeObj);
  }
  removeObject(threeObj) {
    this.scene.remove(threeObj);
    const i = this.objects.indexOf(threeObj);
    if (i >= 0) this.objects.splice(i, 1);
  }
  getObjects() {
    return this.objects;
  }
  getDistanceTo(threeObj) {
    return this.player
      ? this.player.getThreeObj().position.distanceTo(threeObj.position)
      : 0;
  }

  updateInstanceVisibility() {
    if (!this.player || !this.instancedMeshes) return;
    const playerPos = this.player.getThreeObj().position;
    const hideDistance = this.drawDistance;
    this.instancedMeshes.forEach((imesh) => {
      imesh.visible = imesh.position.distanceTo(playerPos) < hideDistance + 500;
    });
  }

  updateShadowCamera() {
    if (!this.sunLight || !this.player) return;
    const playerPos = this.player.getThreeObj().position;
    this.sunLight.position.set(
      playerPos.x + 1000,
      playerPos.y + 2000,
      playerPos.z + 1000,
    );
    this.sunLight.target = this.player.getThreeObj();
  }

  createMapBarrier(mapModel) {
    const box = new THREE.Box3().setFromObject(mapModel);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    let groundLevel = Infinity;
    mapModel.traverse((child) => {
      if (child.isMesh) {
        const cb = new THREE.Box3().setFromObject(child);
        groundLevel = Math.min(groundLevel, cb.min.y);
      }
    });
    if (groundLevel === Infinity) groundLevel = box.min.y;

    const mapRadius = Math.max(size.x, size.z) / 2;
    this.barrierData = {
      center: new THREE.Vector3(center.x, groundLevel, center.z),
      radius: mapRadius,
      height: size.y,
      groundLevel,
    };

    const geometry = new THREE.SphereGeometry(
      this.barrierData.radius,
      64,
      32,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2,
    );
    const isMobile = this.isMobile;
    let material;
    if (isMobile) {
      material = new THREE.MeshPhongMaterial({
        color: 0x00aaff,
        transparent: true,
        opacity: 0.1,
        side: THREE.BackSide,
      });
    } else {
      material = new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          time: { value: 0 },
          color: { value: new THREE.Color(0x00aaff) },
          glowColor: { value: new THREE.Color(0x44aaff) },
        },
        vertexShader: `varying vec2 vUv;varying vec3 vPosition;varying vec3 vNormal;void main(){vUv=uv;vPosition=position;vNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
        fragmentShader: `uniform float time;uniform vec3 color;uniform vec3 glowColor;varying vec2 vUv;varying vec3 vPosition;varying vec3 vNormal;void main(){float gridX=sin(vPosition.x*0.5)*0.5+0.5;float gridZ=sin(vPosition.z*0.5)*0.5+0.5;float grid=(gridX+gridZ)*0.5;float scanline=sin(vUv.y*30.0-time*3.0)*0.5+0.5;float distFromCenter=length(vPosition);float pulse=sin(distFromCenter*2.0-time*4.0)*0.5+0.5;float baseGlow=1.0-abs(vUv.y-0.0);float topGlow=1.0-abs(vUv.y-1.0);float verticalGlow=max(baseGlow,topGlow)*0.5;float hexX=sin(vPosition.x*1.5)*cos(vPosition.z*1.5);float hexY=cos(vPosition.x*1.5)*sin(vPosition.z*1.5);float hexPattern=abs(hexX+hexY)*0.3;float alpha=scanline*0.15+pulse*0.2+verticalGlow*0.3+grid*0.1+hexPattern;float rim=abs(dot(vNormal,vec3(0.0,1.0,0.0)));rim=pow(1.0-rim,2.0)*0.5;alpha+=rim;alpha=clamp(alpha,0.1,0.6);vec3 finalColor=mix(color,glowColor,vUv.y);gl_FragColor=vec4(finalColor,alpha);}`,
      });
    }
    this.barrierMesh = new THREE.Mesh(geometry, material);
    this.barrierMesh.matrixAutoUpdate = false;
    this.barrierMesh.position.set(
      this.barrierData.center.x,
      this.barrierData.groundLevel,
      this.barrierData.center.z,
    );
    this.barrierMesh.updateMatrix();
    this.scene.add(this.barrierMesh);
    this.addBaseRing(this.barrierData.center, this.barrierData.radius);
    this.addGroundRing(this.barrierData.center, this.barrierData.radius);
  }

  addBaseRing(center, radius) {
    const ringGeometry = new THREE.TorusGeometry(radius, 1, 16, 100);
    let ringMaterial;
    if (this.isMobile) {
      ringMaterial = new THREE.MeshBasicMaterial({
        color: 0x44aaff,
        transparent: true,
        opacity: 0.3,
      });
    } else {
      ringMaterial = new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.DoubleSide,
        uniforms: {
          time: { value: 0 },
          color: { value: new THREE.Color(0x44aaff) },
        },
        vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
        fragmentShader: `uniform float time;uniform vec3 color;varying vec2 vUv;void main(){float pulse=sin(time*2.0)*0.5+0.5;float alpha=sin(vUv.x*20.0-time*5.0)*0.3+0.3;alpha+=pulse*0.2;alpha=clamp(alpha,0.2,0.6);gl_FragColor=vec4(color,alpha);}`,
      });
    }
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.position.copy(center);
    ring.position.y = center.y + 0.5;
    ring.rotation.x = Math.PI / 2;
    ring.matrixAutoUpdate = false;
    ring.updateMatrix();
    this.scene.add(ring);
    this.ringMesh = ring;
  }

  addGroundRing(center, radius) {
    const groundRingGeo = new THREE.RingGeometry(radius - 1, radius, 64);
    const groundRingMat = new THREE.MeshBasicMaterial({
      color: 0x44aaff,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
    });
    const groundRing = new THREE.Mesh(groundRingGeo, groundRingMat);
    groundRing.position.copy(center);
    groundRing.position.y = center.y + 0.1;
    groundRing.rotation.x = -Math.PI / 2;
    groundRing.matrixAutoUpdate = false;
    groundRing.updateMatrix();
    this.scene.add(groundRing);
    this.groundRing = groundRing;
  }

  updateBarrier(delta) {
    if (this.isMobile) return;
    if (this.barrierMesh?.material?.uniforms)
      this.barrierMesh.material.uniforms.time.value += delta / 1000;
    if (this.ringMesh?.material?.uniforms) {
      this.ringMesh.material.uniforms.time.value += delta / 1000;
      this.ringMesh.rotation.y += delta * 0.0001;
    }
  }

  findBuildingMeshes() {
    this.buildingMeshes = [];
    this.scene.traverse((child) => {
      if (child.isMesh && child.name.startsWith("Building_")) {
        if (child.geometry && !child.geometry.boundsTree)
          child.geometry.computeBoundsTree();
        this.buildingMeshes.push(child);
        if (!this.objects.includes(child)) this.objects.push(child);
      }
    });
    console.log(`Found ${this.buildingMeshes.length} building meshes`);
  }

  fixMaterial(material) {
    if (material) {
      material.emissive = material.emissive || new THREE.Color(0x000000);
      material.emissive.setHex(0x000000);
      material.shininess = 30;
      if (material.color) {
        const c = material.color;
        c.setRGB(
          Math.min(1, c.r * 1.2),
          Math.min(1, c.g * 1.2),
          Math.min(1, c.b * 1.2),
        );
      }
      material.needsUpdate = true;
    }
  }

  createBoxesAtSpawnPoints(spawnPositions) {
    this.clearSpawnPointBoxes();
    const isMobile = this.isMobile;
    let positionsToUse = isMobile
      ? spawnPositions.filter((_, i) => i % 3 === 0)
      : spawnPositions;
    const texture = this.textureLoader.load("/assets/textures/cube-map.jpg");
    const material = new THREE.MeshPhongMaterial({ map: texture });
    const uvSets = [
      [
        [0, 0.666],
        [0.5, 0.666],
        [0.5, 1],
        [0, 1],
      ],
      [
        [0, 0.333],
        [0.5, 0.333],
        [0.5, 0.666],
        [0, 0.666],
      ],
      [
        [0.5, 0.333],
        [1, 0.333],
        [1, 0.666],
        [0.5, 0.666],
      ],
      [
        [0.5, 0],
        [1, 0],
        [1, 0.333],
        [0.5, 0.333],
      ],
    ].map((faceUVs) => {
      const geometry = new THREE.BoxGeometry(20, 20, 20);
      const uvArr = [];
      for (let f = 0; f < 6; f++) {
        uvArr.push(
          faceUVs[0][0],
          faceUVs[0][1],
          faceUVs[1][0],
          faceUVs[1][1],
          faceUVs[3][0],
          faceUVs[3][1],
          faceUVs[1][0],
          faceUVs[1][1],
          faceUVs[2][0],
          faceUVs[2][1],
          faceUVs[3][0],
          faceUVs[3][1],
        );
      }
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvArr, 2));
      return geometry;
    });
    const BOX_SIZE = 1.5;
    this.instancedMeshes = [];

    // ✅ Store spawn box positions for quick lookup
    this.spawnBoxPositions = [];

    uvSets.forEach((geo) => {
      const count = Math.ceil(positionsToUse.length / uvSets.length) + 1;
      const imesh = new THREE.InstancedMesh(geo, material, count);
      imesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      imesh.castShadow = !this.isReducedPerformance;
      imesh.receiveShadow = !this.isReducedPerformance;
      this.scene.add(imesh);
      this.instancedMeshes.push(imesh);
      this.objects.push(imesh);
    });

    const dummy = new THREE.Object3D();
    positionsToUse.forEach((pos, index) => {
      const geoIndex = index % uvSets.length;
      const instanceIndex = Math.floor(index / uvSets.length);
      const imesh = this.instancedMeshes[geoIndex];
      dummy.position.set(pos.x, pos.y, pos.z);
      dummy.rotation.set(0, Math.random() * Math.PI, Math.PI / 2);
      dummy.scale.set(BOX_SIZE, BOX_SIZE, BOX_SIZE);
      dummy.updateMatrix();
      imesh.setMatrixAt(instanceIndex, dummy.matrix);

      // ✅ Store spawn box position for collision/zone detection
      this.spawnBoxPositions.push(new THREE.Vector3(pos.x, pos.y, pos.z));
    });

    this.instancedMeshes.forEach((m) => (m.instanceMatrix.needsUpdate = true));

    console.log(`✅ Created ${this.spawnBoxPositions.length} spawn boxes`);
  }

  isPlayerInSpawnBox(playerPos) {
    if (!this.spawnBoxPositions || this.spawnBoxPositions.length === 0)
      return false;

    for (const boxPos of this.spawnBoxPositions) {
      const dx = Math.abs(playerPos.x - boxPos.x);
      const dz = Math.abs(playerPos.z - boxPos.z);
      const dy = Math.abs(playerPos.y - boxPos.y);

      // Box dimensions: 1.5 x 1.5 x 1.5, player is about 2 units tall
      // Check if player is within the box area (with some tolerance)
      if (dx < 1.2 && dz < 1.2 && dy < 2.5) {
        return true;
      }
    }
    return false;
  }

  requestSpawnPointsFromServer() {
    if (
      this.mapManager?.currentMapConfig &&
      !this.mapManager.currentMapConfig.hasSpawnBoxes
    ) {
      console.log("Current map doesn't need spawn boxes, skipping...");
      return;
    }
    if (!this.player?.socket) return;
    console.log("Requesting spawn points from server...");
    this.player.socket.emit("requestSpawnPoints");
    this.player.socket.once("spawnPoints", (spawnPositions) => {
      console.log(`Received ${spawnPositions.length} spawn points from server`);
      this.createBoxesAtSpawnPoints(spawnPositions);
    });
  }

  initSky() {
    this.scene.children.forEach((child) => {
      if (child instanceof THREE.Light) this.scene.remove(child);
    });
    this.sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
    this.sunLight.position.set(1000, 2000, 1000);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width =
      this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 5000;
    this.sunLight.shadow.camera.left = -1000;
    this.sunLight.shadow.camera.right = 1000;
    this.sunLight.shadow.camera.top = 1000;
    this.sunLight.shadow.camera.bottom = -1000;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);
    this.fillLight = new THREE.DirectionalLight(0xffffff, 1.0);
    this.fillLight.position.set(-500, 1000, -500);
    this.scene.add(this.fillLight);
    this.ambientLight = new THREE.AmbientLight(0x404060, 1.2);
    this.scene.add(this.ambientLight);
    this.scene.background = new THREE.Color(0x87ceeb);
    // this.updateShadowCamera();
    if (this.frameCounter % 10 === 0) {
      this.updateShadowCamera();
    }
    if (this.isMobile) {
      this.setMobileQuality();
      this.setPerformanceMode("low");
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
      this.targetFrameRate = 30;
      this.frameInterval = 1000 / 30;
    }
  }

  async init() {
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);
    initLabelRenderer();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.01,
      2000000,
    );
    this.scene = new THREE.Scene();
    // this.scene.fog = new THREE.FogExp2(0x40FD14, 0.009);
    this.scene.add(this.camera);
    window.addEventListener("resize", this.onWindowResize.bind(this), false);
    this.initSky();
    this.mapManager = new MapManager(this);

    // ✅ Preload jetpack GLB immediately
    this._loadJetpackGLB();

    this.animate();
    // Don't auto-load a map here — UIFlow will call selectMap
  }

  /**
   * Called by main.js after UIFlow resolves with { name, mapKey }
   * Selects the map, then waits for server session before loading player.
   */
  loadMapForSession(mapKey) {
    const mapConfig = MAPS[mapKey];
    if (!mapConfig) {
      console.error("Unknown map key:", mapKey);
      return;
    }
    this.mapManager.selectMap(mapKey, mapConfig);
  }

  isPlayerInSpawnBox(playerPos) {
    if (!this.instancedMeshes) return false;

    // Get all spawn box positions from instanced meshes
    for (const imesh of this.instancedMeshes) {
      const matrix = new THREE.Matrix4();
      for (let i = 0; i < imesh.count; i++) {
        imesh.getMatrixAt(i, matrix);
        const boxPos = new THREE.Vector3();
        boxPos.setFromMatrixPosition(matrix);

        // Boxes are about 1.5 units wide, check if player is inside
        const dx = Math.abs(playerPos.x - boxPos.x);
        const dz = Math.abs(playerPos.z - boxPos.z);
        const dy = Math.abs(playerPos.y - boxPos.y);

        // Box dimensions: 1.5 x 1.5 x 1.5
        if (dx < 1.0 && dz < 1.0 && dy < 2.0) {
          return true;
        }
      }
    }
    return false;
  }

  forceJetpackActivation() {
    if (!this.mapManager?.currentMapConfig?.useJetpack) return;
    if (!this.controls) return;

    console.log("Force activating jetpack...");

    // Activate the jetpack functionality
    this.controls.activateJetpack();

    // Ensure the model is attached and visible
    if (!this.controls.attachedJetpackModel) {
      console.log("Jetpack model not attached yet, attaching now...");
      this._attachJetpackModelToPlayer();
    } else {
      // Make sure model is visible
      this.controls.attachedJetpackModel.visible = true;
      console.log("Jetpack model visibility set to true");
    }
  }
  showMapLoadingScreen(mapName) {
    // Remove existing loading overlay
    this.hideMapLoadingScreen();

    const overlay = document.createElement("div");
    overlay.id = "map-loading-overlay";
    overlay.className = "map-loading-overlay";
    overlay.innerHTML = `
        <div class="map-loading-container">
            <div class="loading-map-name">${mapName.toUpperCase()}</div>
            <div class="loading-subtitle">DEPLOYING TO BATTLEFIELD</div>
            <div class="loading-progress-bar">
                <div class="loading-progress-fill" id="loading-progress-fill"></div>
            </div>
            <div class="loading-percent" id="loading-percent">0%</div>
            <div class="loading-steps">
                <div class="loading-step" id="step-map">MAP</div>
                <div class="loading-step" id="step-player">PLAYER</div>
                <div class="loading-step" id="-step-ready">READY</div>
            </div>
            <div class="loading-status" id="loading-status">Initializing...</div>
        </div>
    `;
    document.body.appendChild(overlay);
  }

  hideMapLoadingScreen() {
    const overlay = document.getElementById("map-loading-overlay");
    if (overlay) {
      overlay.style.opacity = "0";
      setTimeout(() => {
        if (overlay && overlay.remove) overlay.remove();
      }, 500);
    }
  }

  updateLoadingProgress(percent, status, step) {
    const fill = document.getElementById("loading-progress-fill");
    const percentEl = document.getElementById("loading-percent");
    const statusEl = document.getElementById("loading-status");

    if (fill) fill.style.width = `${percent}%`;
    if (percentEl) percentEl.textContent = `${Math.floor(percent)}%`;
    if (statusEl && status) statusEl.textContent = status;

    // Update step indicators
    if (step === "map") {
      const stepEl = document.getElementById("step-map");
      if (stepEl) {
        stepEl.classList.add("complete");
        stepEl.classList.remove("active");
      }
      const nextStep = document.getElementById("step-player");
      if (nextStep) nextStep.classList.add("active");
    } else if (step === "player") {
      const stepEl = document.getElementById("step-player");
      if (stepEl) {
        stepEl.classList.add("complete");
        stepEl.classList.remove("active");
      }
      const nextStep = document.getElementById("-step-ready");
      if (nextStep) nextStep.classList.add("active");
    }
  }

  showReadyButton() {
    // Update the blocker to show the start button
    const blocker = document.getElementById("blocker");
    if (blocker) {
      const newPlayerDiv = document.getElementById("newPlayer");
      const startGameDiv = document.getElementById("startGame");

      if (newPlayerDiv) newPlayerDiv.style.display = "none";
      if (startGameDiv) startGameDiv.style.display = "block";

      // Auto-focus the button for non-mobile
      if (!this.isMobile) {
        const btnStart = document.getElementById("btnStart");
        if (btnStart) btnStart.focus();
      }

      console.log("✅ Ready button shown");
    }
  }

  initControls(player) {
    this.player = player;
    this.controls = new PointerLockControlsCustom(this.camera, player, this);
    this.scene.add(this.controls.getObject());
    this.crosshair3D = new WeaponCrosshair(this.camera, this.scene);
    this.crosshair3D.hide();
    if (player?.socket) {
      this.roomManager = new RoomManager(this, player.socket, player);
      console.log("RoomManager initialized");
    }

    // ── NEW: if map loaded before player was ready, position now ─────────

    // ✅ Apply deferred spawn for ALL maps (removed clientSideSpawn check)
    if (
      this.mapManager &&
      this._pendingSpawnModel &&
      this._pendingSpawnConfig
    ) {
      console.log(
        "Applying deferred spawn for map:",
        this._pendingSpawnConfig.name,
      );
      this.mapManager.positionPlayerOnMap(
        this._pendingSpawnModel,
        this._pendingSpawnConfig,
      );
      this._pendingSpawnModel = null;
      this._pendingSpawnConfig = null;
    } else if (
      this.mapManager?.currentMapConfig &&
      this.currentEnvironmentModel
    ) {
      // ✅ Map already fully loaded and pending was cleared — reposition now
      // This handles the race where map loaded, pending was set, but
      // something else cleared it before initControls ran
      console.log("Map already loaded, repositioning player now");
      this.mapManager.positionPlayerOnMap(
        this.currentEnvironmentModel,
        this.mapManager.currentMapConfig,
      );
    }

    // ✅ For greeble map, pre-attach the jetpack model (hidden until activated)
    if (this.mapManager?.currentMap === "greeble_map") {
      console.log("Greeble map detected, pre-loading jetpack model...");
      this._preloadJetpackModel();

      // Spawn jetpack pickups after a short delay
      setTimeout(() => {
        this.mapManager.spawnJetpackPickupsForCurrentMap();
      }, 500);
    }

    // Force jetpack activation for greeble map after a short delay
    if (this.mapManager?.currentMap === "greeble_map") {
      setTimeout(() => this.forceJetpackActivation(), 1000);
    }
  }

  // Add this new method to preload and attach jetpack model (hidden)
  _preloadJetpackModel() {
    if (!this.jetpackGLB) {
      this._loadJetpackGLB().then(() => {
        this._attachJetpackModelToPlayer();
      });
    } else {
      this._attachJetpackModelToPlayer();
    }
  }

  // Separate method for attaching the model (without activating jetpack)
  _attachJetpackModelToPlayer() {
    // Skip if already attached
    if (this.controls.attachedJetpackModel) {
      console.log("Jetpack model already attached");
      return;
    }

    if (!this.jetpackGLB) {
      console.log("Jetpack GLB not ready, waiting...");
      setTimeout(() => this._attachJetpackModelToPlayer(), 200);
      return;
    }

    if (!this.player?.modelLoaded || !this.controls?.spineBone) {
      console.log("Waiting for player model or spine bone...");
      setTimeout(() => this._attachJetpackModelToPlayer(), 200);
      return;
    }

    console.log("Attaching jetpack model to spine bone");

    // Clone the jetpack model
    const model = this.jetpackGLB.clone();
    model.scale.set(0.18, 0.18, 0.18);

    // Find cylinders for particle effects - with better detection
    const cylinders = [];
    model.traverse((child) => {
      if (child.isMesh) {
        console.log("Found mesh in jetpack:", child.name);
        if (child.name === "Cylinder" || child.name.includes("Cylinder")) {
          cylinders.push(child);
          console.log("Found cylinder for particle trail:", child.name);
        }
      }
    });

    console.log(`Found ${cylinders.length} cylinders for particle effects`);
    model.userData.cylinders = cylinders;
    model.userData.hasCylinders = cylinders.length > 0;

    // Attach to spine bone
    const spineTarget = this.controls.spineBone;

    // Adjust position relative to spine
    model.position.set(0, 0.5, -1.1);
    model.rotation.set(0, Math.PI, 0);
    model.visible = true;

    // Add to spine
    spineTarget.add(model);

    // Store references
    this.controls.attachedJetpackModel = model;
    this.controls.attachedJetpackCylinders = cylinders;

    console.log("Jetpack model attached successfully");
  }

  _spawnOneJetpackPickup(position) {
    // Glowing orb indicator
    const geo = new THREE.SphereGeometry(1.2, 12, 12);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x00aaff,
      emissive: 0x0066cc,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.7,
      metalness: 0.5,
      roughness: 0.2,
    });
    const orbMesh = new THREE.Mesh(geo, mat);
    orbMesh.position.copy(position);
    this.scene.add(orbMesh);

    // GLB model or fallback box
    let modelMesh = null;
    if (this.jetpackGLB) {
      modelMesh = this.jetpackGLB.clone();
      modelMesh.scale.set(1, 1, 1);
      modelMesh.position.copy(position);
      const cylinders = [];
      modelMesh.traverse((child) => {
        if (child.isMesh && child.name === "Cylinder") {
          cylinders.push(child);
        }
      });
      modelMesh.userData.cylinders = cylinders;
      this.scene.add(modelMesh);
    }

    // Point light
    const light = new THREE.PointLight(0x00aaff, 1.5, 12);
    light.position.copy(position);
    this.scene.add(light);

    // ✅ ADD PHYSICS PROPERTIES
    const pickup = {
      mesh: orbMesh,
      modelMesh,
      light,
      position: position.clone(),
      originalY: position.y,
      angle: Math.random() * Math.PI * 2,
      collected: false,
      // Physics properties
      velocity: new THREE.Vector3(0, 0, 0),
      hasGravity: true,
      isFalling: true,
      hasLanded: false,
      groundY: null,
    };

    this.jetpackPickups.push(pickup);
  }

  setAimState(aiming) {
    if (this.crosshair3D) this.crosshair3D.setAiming(aiming);
  }
  updateCrosshair() {
    if (this.crosshair3D) this.crosshair3D.update();
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  clearSpawnPointBoxes() {
    if (this.instancedMeshes) {
      this.instancedMeshes.forEach((imesh) => {
        this.scene.remove(imesh);
        imesh.geometry.dispose();
        const idx = this.objects.indexOf(imesh);
        if (idx >= 0) this.objects.splice(idx, 1);
      });
      this.instancedMeshes = [];
    }
    this.spawnPoints = [];
  }

  cleanup() {
    if (this.controls) this.controls.cleanup();
  }
}
