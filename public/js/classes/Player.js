// Player.js
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import Weapon from "./Weapon.js";
import { WEAPON_CONFIGS } from "./constants.js";

export default class Player {
  constructor(
    id,
    name,
    color = null,
    socket = null,
    world = null,
    position = null,
  ) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.socket = socket;
    this.world = world;

    this.modelLoaded = false;
    this.modelLoading = false;
    this.currentAnimation = "idle";
    this.jumpAnimationLoaded = false;
    this.pendingJumpAnimation = false;
    this.speechObj = new THREE.Object3D();
    this.speechObj.position.set(-15, 15, 0);
    this.nameObj = new THREE.Object3D();
    this.nameObj.position.set(0, 15, 0);

    // Weapon system properties
    this.weapons = [];
    this.currentWeaponIndex = 0;
    this.bullets = [];
    this.weaponSwitchCooldown = 0;
    this.WEAPON_SWITCH_COOLDOWN = 0.5;
    this.lastSwitchTime = 0;

    // Create container for the model
    this.modelContainer = new THREE.Object3D();
    this.threeObj = new THREE.Object3D();

    this.threeObj.userData.playerId = id;
    this.threeObj.userData.isPlayer = true;
    this.threeObj.userData.playerName = name;

    // ✅ Set initial position if provided
    if (position) {
      this.threeObj.position.set(position.x, position.y, position.z);
    }

    this.threeObj.add(this.speechObj);
    this.threeObj.add(this.nameObj);

    // Pitch object for vertical rotation
    this.pitchObj = new THREE.Object3D();

    // Load the GLB model
    this.loadModel(this.color);
    // this.loadAllWeapons();

    this.velocity = new THREE.Vector3();

    // Loadout system
    this.loadoutWeapons = []; // Array of weapon objects in loadout
    this.holsteredWeapons = []; // Array of holstered weapon models
    this.backHolsterPoint = null; // Reference point on back
    this.waistHolsterPoint = null;
    this.loadoutConfirmed = false;
    this.pendingLoadout = [];

    // Find back holster point after model loads
    this.findBackHolsterPoint();
    this.findWaistHolsterPoint();

    this.targetPosition = null;
    this.targetRotationY = 0;
    this.interpSpeed = 0.2;

    this.health = 100;
    this.maxHealth = 100;
    this.isDead = false;
    this.deathTime = null;
    this.RESPAWN_DELAY = 5000;

    this.laserLine = null;
    this.laserEndPoint = null;
    this.laserDistance = 100; // Max laser distance
    this.showLaser = true; // Always show laser for debugging
    this.weaponReserves = {}; // { weaponName: reserveCount }

    this.muzzleFlashTexture = new THREE.TextureLoader().load(
      "/assets/textures/muzzle_flash.png",
    );
    this.isFiring = false; // Track if firing button is held
    this.fireInterval = null;
  }

  startShooting() {
    if (this.isFiring) return;

    const currentWeapon = this.weapons[this.currentWeaponIndex];
    if (!currentWeapon) return;

    // Check if weapon can fire before starting
    if (!currentWeapon.canFire()) return;

    this.isFiring = true;

    if (currentWeapon.fireMode === "auto") {
      // Auto-fire: start continuous firing
      this.autoFireLoop();
    } else {
      // Semi-auto or other modes: fire once
      this.shoot();
      // For semi-auto, we don't keep firing, so stop immediately
      this.isFiring = false;
    }
  }

  // Update autoFireLoop() to use weapon's canFire:
  autoFireLoop() {
    if (!this.isFiring) return;

    const currentWeapon = this.weapons[this.currentWeaponIndex];
    if (!currentWeapon) {
      this.stopShooting();
      return;
    }

    // Check if weapon can fire
    if (currentWeapon.canFire()) {
      this.shoot();
    }

    // If weapon is out of ammo or reloading, stop firing
    if (currentWeapon.ammo <= 0 || currentWeapon.isReloading) {
      this.stopShooting();
      return;
    }

    // Schedule next shot based on fire rate
    const fireDelay = Math.max(50, currentWeapon.fireRate * 1000);
    this.fireInterval = setTimeout(() => {
      this.autoFireLoop();
    }, fireDelay);
  }

  autoFireLoop() {
    if (!this.isFiring) return;

    const currentWeapon = this.weapons[this.currentWeaponIndex];
    if (!currentWeapon) {
      this.stopShooting();
      return;
    }

    // Check if weapon can fire
    if (currentWeapon.canFire()) {
      this.shoot();
    }

    // Schedule next shot based on fire rate
    const fireDelay = Math.max(50, currentWeapon.fireRate * 1000);
    this.fireInterval = setTimeout(() => {
      this.autoFireLoop();
    }, fireDelay);
  }

  // Add new method:
  interpolate() {
    if (!this.targetPosition) return;
    this.threeObj.position.lerp(this.targetPosition, this.interpSpeed);

    // Lerp rotation
    let rotDiff = this.targetRotationY - this.threeObj.rotation.y;
    rotDiff = Math.atan2(Math.sin(rotDiff), Math.cos(rotDiff));
    this.threeObj.rotation.y += rotDiff * this.interpSpeed;
  }

  // Find back bone for holstering weapons
  findBackHolsterPoint() {
    if (!this.modelLoaded) {
      setTimeout(() => this.findBackHolsterPoint(), 500);
      return;
    }

    const model = this.pitchObj.children[0];
    if (!model) return;

    // Try to find spine or back bone
    const backNames = [
      "mixamorigSpine",
      "mixamorigSpine2",
      "Spine",
      "Spine2",
      "mixamorigSpine1",
    ];

    for (const name of backNames) {
      const bone = model.getObjectByName(name);
      if (bone) {
        this.backHolsterPoint = bone;
        console.log("Found back holster point:", name);
        break;
      }
    }

    // If no bone found, create a dummy point
    if (!this.backHolsterPoint) {
      this.backHolsterPoint = new THREE.Object3D();
      this.backHolsterPoint.position.set(0, 8, -5);
      this.threeObj.add(this.backHolsterPoint);
    }
  }

  findWaistHolsterPoint() {
    if (!this.modelLoaded) {
      setTimeout(() => this.findWaistHolsterPoint(), 500);
      return;
    }

    const model = this.pitchObj.children[0];
    if (!model) return;

    const waistNames = ["mixamorigHips", "Hips", "mixamorigSpine"];

    for (const name of waistNames) {
      const bone = model.getObjectByName(name);
      if (bone) {
        this.waistHolsterPoint = bone;
        console.log("Found waist holster point:", name);
        return;
      }
    }

    // fallback
    this.waistHolsterPoint = new THREE.Object3D();
    this.waistHolsterPoint.position.set(0, 10, 0);
    this.threeObj.add(this.waistHolsterPoint);
  }

  setLoadout(weaponConfigs) {
    console.log(`=== SETTING LOADOUT for ${this.name} ===`);
    console.log(
      `Selected weapons: ${weaponConfigs.map((w) => w.name).join(", ")}`,
    );

    // Clear existing weapons first
    this.weapons = [];
    this.loadoutWeapons = [];
    this.holsteredWeapons = [];

    // Clear any existing weapon models from the scene
    if (this.pitchObj) {
      this.pitchObj.children.forEach((child) => {
        if (child.name && child.name.includes("weapon_")) {
          console.log(`Removing weapon from pitchObj: ${child.name}`);
          this.pitchObj.remove(child);
        }
      });
    }

    if (this.threeObj) {
      this.threeObj.children.forEach((child) => {
        if (child.name && child.name.includes("weapon_")) {
          console.log(`Removing weapon from threeObj: ${child.name}`);
          this.threeObj.remove(child);
        }
      });
    }

    // Clear back holster point
    if (this.backHolsterPoint) {
      while (this.backHolsterPoint.children.length > 0) {
        const child = this.backHolsterPoint.children[0];
        console.log(`Removing from back holster: ${child.name}`);
        this.backHolsterPoint.remove(child);
      }
    }

    this.pendingLoadout = weaponConfigs;

    // Load ONLY the selected weapons
    let loadedCount = 0;
    weaponConfigs.forEach((config, index) => {
      console.log(`Loading weapon ${config.name}...`);
      const weapon = new Weapon(config);
      weapon.config = config;
      this.weapons.push(weapon);

      // Load the weapon model
      this.loadWeaponModel(config)
        .then((model) => {
          weapon.model = model;
          loadedCount++;
          console.log(
            `✅ Loaded weapon ${config.name} (${loadedCount}/${weaponConfigs.length})`,
          );

          // After all weapons are loaded, set up callbacks and attach
          if (loadedCount === weaponConfigs.length) {
            console.log(
              `All ${weaponConfigs.length} weapons loaded for ${this.name}`,
            );

            // Set up reload callbacks
            this.setupWeaponCallbacks();
            this.isLoadoutSet = true;

            // Wait for model to be ready and then attach current weapon
            const checkModelInterval = setInterval(() => {
              if (this.modelLoaded) {
                clearInterval(checkModelInterval);
                console.log("Model ready, attaching weapon...");
                this.attachCurrentWeapon();
                console.log(
                  `Current weapon attached: ${this.weapons[this.currentWeaponIndex]?.name}`,
                );
                this.updateHolsteredWeapons();
              } else {
                console.log("Waiting for model to load...");
              }
            }, 100);
          }
        })
        .catch((error) => {
          console.error(`❌ Failed to load weapon ${config.name}:`, error);
          loadedCount++;
        });
    });

    this.loadoutConfirmed = true;
    this.weaponReserves = {};
    weaponConfigs.forEach((config) => {
      // Each weapon spawns with 1 extra reserve reload
      this.weaponReserves[config.name] = 1;
    });
  }

  // ── NEW: update the ammo HUD ─────────────────────────────────────────────────
  updateAmmoHUD() {
    const weapon = this.weapons[this.currentWeaponIndex];
    if (!weapon) return;

    const ammoEl = document.getElementById("ammo-current");
    const maxEl = document.getElementById("ammo-max");
    const resEl = document.getElementById("ammo-reserves");

    if (ammoEl) ammoEl.textContent = weapon.ammo;
    if (maxEl) maxEl.textContent = weapon.maxAmmo;
    if (resEl) {
      const reserves = this.weaponReserves[weapon.name] || 0;
      resEl.textContent = reserves > 0 ? `×${reserves}` : "EMPTY";
      resEl.style.color = reserves > 0 ? "#ffcc00" : "#ff4444";
    }
  }

  // Update holstered weapons on back
  updateHolsteredWeapons() {
    if (!this.backHolsterPoint || !this.waistHolsterPoint) {
      this.findBackHolsterPoint();
      this.findWaistHolsterPoint();
      setTimeout(() => this.updateHolsteredWeapons(), 500);
      return;
    }

    // clear existing
    this.holsteredWeapons.forEach((weapon) => {
      if (weapon.holsteredModel?.parent) {
        weapon.holsteredModel.parent.remove(weapon.holsteredModel);
      }
    });
    this.holsteredWeapons = [];

    let backIndex = 0;
    let waistIndex = 0;

    this.weapons.forEach((weapon, index) => {
      if (index === this.currentWeaponIndex) return;
      if (!weapon.model) return;

      try {
        if (weapon.config.category === "primary") {
          // BACK (long guns)
          const pos = this.getBackPosition(backIndex++);
          weapon.attachHolstered(this.backHolsterPoint, pos, pos.rot);
        } else {
          // WAIST (short guns)
          const pos = this.getWaistPosition(waistIndex++);
          weapon.attachHolstered(this.waistHolsterPoint, pos, pos.rot);
        }

        this.holsteredWeapons.push(weapon);
      } catch (e) {
        console.error("Holster error:", weapon.name, e);
      }
    });
  }

  getBackPosition(index) {
    const positions = [
      { x: 0.45, y: 1.8, z: -0.6, rot: { x: Math.PI / 2, y: 0, z: Math.PI } },
      { x: -0.45, y: 1.8, z: -0.6, rot: { x: Math.PI / 2, y: 0, z: Math.PI } },
    ];
    return positions[index % positions.length];
  }

  getWaistPosition(index) {
    const positions = [
      { x: 0.9, y: 0.8, z: 0.2, rot: { x: 1.4, y: 0, z: 0 } }, // right hip
      { x: -0.9, y: 0.8, z: 0.2, rot: { x: 1.4, y: 0, z: 0 } }, // left hip
    ];
    return positions[index % positions.length];
  }

  // ✅ Set up reload callbacks for all weapons
  // setupWeaponCallbacks() {
  //   this.weapons.forEach((weapon) => {
  //     weapon.onReloadStart = () => {
  //       // ✅ broadcast = true only if this is the local player (has socket)
  //       this.playAnimation("reloading", !!this.socket, false);

  //       if (this.socket) {
  //         this.socket.emit("playerReload", { id: this.id });
  //       }
  //     };

  //     weapon.onReloadComplete = () => {
  //       const isMoving =
  //         Math.abs(this.velocity?.x || 0) > 0.01 ||
  //         Math.abs(this.velocity?.z || 0) > 0.01;

  //       if (isMoving) {
  //         this.playAnimation(
  //           this.isRunning ? "run" : "walk",
  //           !!this.socket,
  //           true,
  //         );
  //       } else {
  //         this.playAnimation("idle", !!this.socket, true);
  //       }
  //     };
  //   });
  // }

  setupWeaponCallbacks() {
    this.weapons.forEach((weapon) => {
      weapon.onReloadStart = () => {
        this.playAnimation("reloading", !!this.socket, false);
        if (this.socket) {
          this.socket.emit("playerReload", { id: this.id });
        }
      };

      weapon.onReloadComplete = () => {
        // Consume one reserve on reload complete
        if (this.weaponReserves[weapon.name] > 0) {
          this.weaponReserves[weapon.name]--;
        }
        this.updateAmmoHUD();

        const isMoving =
          Math.abs(this.velocity?.x || 0) > 0.01 ||
          Math.abs(this.velocity?.z || 0) > 0.01;
        if (isMoving) {
          this.playAnimation(
            this.isRunning ? "run" : "walk",
            !!this.socket,
            true,
          );
        } else {
          this.playAnimation("idle", !!this.socket, true);
        }
      };
    });
  }

  async loadAllWeapons() {
    console.log(`Loading all weapons for player: ${this.name}`);
    this.weapons = [];

    // Load weapons sequentially to avoid race conditions
    for (const [key, config] of Object.entries(WEAPON_CONFIGS)) {
      try {
        const weaponModel = await this.loadWeaponModel(config);
        const weapon = new Weapon(config);
        weapon.model = weaponModel;
        this.weapons.push(weapon);
      } catch (error) {
        console.error(`Failed to load weapon ${key}:`, error);
      }
    }

    // ✅ Set up callbacks for all weapons at once
    this.setupWeaponCallbacks();

    if (this.weapons.length > 0 && this.currentWeaponIndex === 0) {
      if (this.modelLoaded) {
        this.attachCurrentWeapon();
      }
    }
  }

  // Load individual weapon model
  loadWeaponModel(config) {
    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.load(
        config.modelPath,
        (gltf) => {
          const weaponModel = gltf.scene;
          weaponModel.scale.set(config.scale, config.scale, config.scale);
          weaponModel.updateMatrixWorld(true);
          resolve(weaponModel);
        },
        undefined,
        (error) => reject(error),
      );
    });
  }

  attachCurrentWeapon() {
    if (!this.modelLoaded) return;

    const model = this.pitchObj.children[0];
    if (!model) return;

    let rightHand = model.getObjectByName("mixamorigRightHand");

    // Find right hand if not found
    if (!rightHand) {
      const handNames = [
        "mixamorigRightHand",
        "RightHand",
        "hand_r",
        "hand_right",
      ];
      for (const name of handNames) {
        rightHand = model.getObjectByName(name);
        if (rightHand) break;
      }
    }

    // Remove existing weapons from hand
    if (rightHand) {
      rightHand.children.forEach((child) => {
        if (child.name && child.name.includes("weapon_")) {
          rightHand.remove(child);
        }
      });
    }

    const currentWeapon = this.weapons[this.currentWeaponIndex];
    if (!currentWeapon || !currentWeapon.model) return;

    const weaponClone = currentWeapon.model.clone();
    weaponClone.name = `weapon_${currentWeapon.name}_${this.id}`;

    weaponClone.position.set(
      currentWeapon.position.x,
      currentWeapon.position.y,
      currentWeapon.position.z,
    );

    weaponClone.rotation.set(
      currentWeapon.rotation.x,
      currentWeapon.rotation.y,
      currentWeapon.rotation.z,
    );

    if (rightHand) {
      rightHand.add(weaponClone);
    } else {
      this.threeObj.add(weaponClone);
    }

    // Update holstered weapons after switching
    this.updateHolsteredWeapons();

    console.log(`Attached weapon ${currentWeapon.name} to hand`);
  }

  // Override switchWeapon to update holstered weapons
  switchWeapon(index, broadcast = true) {
    if (this.isFiring) {
      this.stopShooting();
    }

    if (index < 0 || index >= this.weapons.length) return;
    if (index === this.currentWeaponIndex) return;

    const currentWeapon = this.weapons[this.currentWeaponIndex];
    if (currentWeapon && currentWeapon.isReloading) return;

    this.currentWeaponIndex = index;

    this.attachCurrentWeapon();

    if (broadcast && this.socket) {
      this.socket.emit("playerWeaponSwitch", {
        id: this.id,
        weaponIndex: this.currentWeaponIndex,
      });
    }
  }

  // In Player.js - add method to sync loadout from server
  setLoadoutFromServer(weaponNames) {
    console.log(`Setting loadout for ${this.name}:`, weaponNames);

    // Import WEAPON_CONFIGS (you'll need to make this available globally or import)
    const weaponConfigs = weaponNames
      .map((weaponName) => {
        // Find the weapon config by name
        const found = Object.entries(window.WEAPON_CONFIGS || {}).find(
          ([key, config]) => config.name === weaponName,
        );
        return found ? found[1] : null;
      })
      .filter((w) => w);

    if (weaponConfigs.length === 4) {
      this.setLoadout(weaponConfigs);
    } else {
      console.warn(
        `Could not load all weapons for ${this.name}, got ${weaponConfigs.length} of 4`,
      );
      // Fallback to default weapons if needed
      this.loadDefaultWeapons();
    }
  }

  loadDefaultWeapons() {
    console.log(`Loading default weapons for ${this.name}`);
    const defaultWeaponNames = ["desert_eagle", "glock", "shotgun", "dragunov"];
    const defaultConfigs = defaultWeaponNames
      .map((name) => WEAPON_CONFIGS[name])
      .filter((w) => w);
    if (defaultConfigs.length === 4) {
      this.setLoadout(defaultConfigs);
    }
  }

  shoot() {
    const currentWeapon = this.weapons[this.currentWeaponIndex];
    if (!currentWeapon) return false;
    if (!currentWeapon.canFire()) return false;

    if (!currentWeapon.fire(this.world?.scene, this.pitchObj, this.threeObj))
      return false;

    this.createMuzzleFlash();

    const origin = this.world.camera.position.clone();
    const direction = new THREE.Vector3();
    this.world.camera.getWorldDirection(direction);

    let hitPlayer = null;
    let hitPoint = null;
    let hitDistance = Infinity;
    let isHeadshot = false;

    if (window.players) {
      window.players.getAll().forEach((player) => {
        if (player === this) return;
        if (player.isDead) return;

        const hitbox = player.getHitbox();

        // Check head first (priority for headshots)
        const headHit = this.rayIntersectsCylinder(
          origin,
          direction,
          hitbox.head,
        );
        if (headHit && headHit.distance > 0 && headHit.distance < hitDistance) {
          hitDistance = headHit.distance;
          hitPlayer = player.id;
          hitPoint = headHit.point;
          isHeadshot = true;
          console.log(
            `🎯 HEADSHOT on ${player.name} at distance ${hitDistance.toFixed(2)}`,
          );
        }

        // Check body if no headshot
        if (!isHeadshot) {
          const bodyHit = this.rayIntersectsCylinder(
            origin,
            direction,
            hitbox.body,
          );
          if (
            bodyHit &&
            bodyHit.distance > 0 &&
            bodyHit.distance < hitDistance
          ) {
            hitDistance = bodyHit.distance;
            hitPlayer = player.id;
            hitPoint = bodyHit.point;
            isHeadshot = false;
            console.log(
              `💥 BODY HIT on ${player.name} at distance ${hitDistance.toFixed(2)}`,
            );
          }
        }
      });
    }

    // Calculate damage (headshot does 2x damage)
    const damage = isHeadshot ? 50 : 25;

    const hitResult = hitPlayer
      ? { targetId: hitPlayer, point: hitPoint, isHeadshot, damage }
      : null;

    if (this.socket) {
      this.socket.emit("fireWeapon", {
        position: origin,
        direction: direction,
        weaponIndex: this.currentWeaponIndex,
        targetId: hitResult?.targetId || null,
        hitPoint: hitResult?.point || null,
        isHeadshot: isHeadshot || false,
        damage: damage,
        clientPing: this.socket.lastPing || 0,
      });
    }

    return true;
  }

  getHitbox() {
    // Body hitbox
    let bodyHeight = 17; // default
    let bodyRadius = 4; // default

    // Try to get actual model bounds
    if (this.modelLoaded && this.pitchObj.children[0]) {
      const model = this.pitchObj.children[0];
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);

      // Adjust based on actual model size
      bodyHeight = size.y * 0.85;
      bodyRadius = Math.max(size.x, size.z) * 0.4;
    }

    const center = this.threeObj.position.clone();
    const bodyMinY = center.y;
    const bodyMaxY = center.y + bodyHeight;

    // Head hitbox (above body)
    const headRadius = bodyRadius * 0.7;
    const headHeight = bodyHeight * 0.2; // Head is about 1/4 of body height
    const headMinY = bodyMaxY;
    const headMaxY = bodyMaxY + headHeight;
    const headCenter = new THREE.Vector3(
      center.x,
      headMinY + headHeight / 2,
      center.z,
    );

    return {
      // Body hitbox
      body: {
        center,
        radius: bodyRadius,
        minY: bodyMinY,
        maxY: bodyMaxY,
        height: bodyHeight,
      },
      // Head hitbox
      head: {
        center: headCenter,
        radius: headRadius,
        minY: headMinY,
        maxY: headMaxY,
        height: headHeight,
      },
    };
  }

  createHitboxVisualizer() {
    if (!this.world || !this.world.scene) return;

    // Remove existing visualizer if any
    if (this.hitboxVisualizer) {
      this.hitboxVisualizer.forEach((item) => {
        this.world.scene.remove(item);
        if (item.geometry) item.geometry.dispose();
        if (item.material) item.material.dispose();
      });
    }

    const hitbox = this.getHitbox();
    this.hitboxVisualizer = [];

    // Body cylinder (green)
    const bodyGeo = new THREE.CylinderGeometry(
      hitbox.body.radius,
      hitbox.body.radius,
      hitbox.body.height,
      32,
      32,
    );
    const bodyMat = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
    });
    const bodyVisualizer = new THREE.Mesh(bodyGeo, bodyMat);
    bodyVisualizer.position.copy(hitbox.body.center);
    bodyVisualizer.position.y = hitbox.body.minY + hitbox.body.height / 2;
    this.world.scene.add(bodyVisualizer);
    this.hitboxVisualizer.push(bodyVisualizer);

    // Head cylinder (red - critical area)
    const headGeo = new THREE.CylinderGeometry(
      hitbox.head.radius,
      hitbox.head.radius,
      hitbox.head.height,
      32,
      32,
    );
    const headMat = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      wireframe: true,
      transparent: true,
      opacity: 0.7,
    });
    const headVisualizer = new THREE.Mesh(headGeo, headMat);
    headVisualizer.position.copy(hitbox.head.center);
    this.world.scene.add(headVisualizer);
    this.hitboxVisualizer.push(headVisualizer);
  }

  updateHitboxVisualizer() {
    if (!this.hitboxVisualizer) return;

    const hitbox = this.getHitbox();

    // Update body visualizer
    if (this.hitboxVisualizer[0]) {
      this.hitboxVisualizer[0].position.copy(hitbox.body.center);
      this.hitboxVisualizer[0].position.y =
        hitbox.body.minY + hitbox.body.height / 2;
    }

    // Update head visualizer
    if (this.hitboxVisualizer[1]) {
      this.hitboxVisualizer[1].position.copy(hitbox.head.center);
    }
  }

  // Call this after model is loaded
  enableHitboxVisualization(enable = true) {
    if (enable) {
      this.createHitboxVisualizer();
    } else if (this.hitboxVisualizer) {
      this.world.scene.remove(this.hitboxVisualizer);
      this.hitboxVisualizer.geometry.dispose();
      this.hitboxVisualizer = null;
    }
  }

  rayIntersectsCylinder(origin, direction, cylinder) {
    // Ray parameters
    const rayDir = direction.clone().normalize();
    const rayOrigin = origin.clone();

    // Cylinder parameters (aligned with Y axis)
    const center = cylinder.center.clone();
    const radius = cylinder.radius;
    const minY = cylinder.minY;
    const maxY = cylinder.maxY;

    // Solve quadratic for infinite cylinder along Y axis
    const dx = rayOrigin.x - center.x;
    const dz = rayOrigin.z - center.z;
    const vx = rayDir.x;
    const vz = rayDir.z;

    const a = vx * vx + vz * vz;
    const b = 2 * (dx * vx + dz * vz);
    const c = dx * dx + dz * dz - radius * radius;

    const discriminant = b * b - 4 * a * c;

    if (discriminant < 0) return null;

    const sqrtDisc = Math.sqrt(discriminant);
    let t1 = (-b - sqrtDisc) / (2 * a);
    let t2 = (-b + sqrtDisc) / (2 * a);

    // Sort so t1 is the closest
    if (t1 > t2) [t1, t2] = [t2, t1];

    // Check if intersection points are within cylinder height
    const y1 = rayOrigin.y + t1 * rayDir.y;
    const y2 = rayOrigin.y + t2 * rayDir.y;

    let hitDistance = null;
    let hitPoint = null;

    // Check first intersection (t1)
    if (t1 > 0 && y1 >= minY && y1 <= maxY) {
      hitDistance = t1;
      hitPoint = rayOrigin.clone().add(rayDir.clone().multiplyScalar(t1));
    }
    // Check second intersection (t2)
    else if (t2 > 0 && y2 >= minY && y2 <= maxY) {
      hitDistance = t2;
      hitPoint = rayOrigin.clone().add(rayDir.clone().multiplyScalar(t2));
    }
    // Check top cap
    else {
      const tTop = (maxY - rayOrigin.y) / rayDir.y;
      if (tTop > 0) {
        const xTop = rayOrigin.x + tTop * rayDir.x;
        const zTop = rayOrigin.z + tTop * rayDir.z;
        const distFromCenter = Math.hypot(xTop - center.x, zTop - center.z);
        if (distFromCenter <= radius) {
          hitDistance = tTop;
          hitPoint = new THREE.Vector3(xTop, maxY, zTop);
        }
      }

      // Check bottom cap (if not already hit)
      if (hitDistance === null) {
        const tBottom = (minY - rayOrigin.y) / rayDir.y;
        if (tBottom > 0) {
          const xBottom = rayOrigin.x + tBottom * rayDir.x;
          const zBottom = rayOrigin.z + tBottom * rayDir.z;
          const distFromCenter = Math.hypot(
            xBottom - center.x,
            zBottom - center.z,
          );
          if (distFromCenter <= radius) {
            hitDistance = tBottom;
            hitPoint = new THREE.Vector3(xBottom, minY, zBottom);
          }
        }
      }
    }

    if (hitDistance !== null) {
      return { distance: hitDistance, point: hitPoint };
    }

    return null;
  }

  // createMuzzleFlash() {
  //   if (!this.world || !this.muzzleFlashTexture) return;

  //   const currentWeapon = this.weapons[this.currentWeaponIndex];
  //   if (!currentWeapon) return;

  //   let basePos = new THREE.Vector3();

  //   let cylinderMesh = null;
  //   this.pitchObj.traverse((child) => {
  //     if (child.name === "Cylinder" && !cylinderMesh) {
  //       cylinderMesh = child;
  //     }
  //   });

  //   if (cylinderMesh) {
  //     cylinderMesh.getWorldPosition(basePos);
  //   } else {
  //     basePos.copy(this.threeObj.position);
  //     basePos.y += 12;
  //   }

  //   const dir = this.getCameraDirection();

  //   const burstCount = 4; // number of planes
  //   const delayStep = 10; // ms between each

  //   for (let i = 0; i < burstCount; i++) {
  //     setTimeout(() => {
  //       const material = new THREE.SpriteMaterial({
  //         map: this.muzzleFlashTexture,
  //         blending: THREE.AdditiveBlending,
  //         transparent: true,
  //         depthWrite: false,
  //       });

  //       const sprite = new THREE.Sprite(material);

  //       // Slight forward offset
  //       const pos = basePos.clone().add(dir.clone().multiplyScalar(1.5));
  //       sprite.position.copy(pos);

  //       // 🔥 KEY: progressive growth (liAke your GLB)
  //       const scale = 1 + i * 0.6 + Math.random() * 0.3;
  //       sprite.scale.set(scale, scale, scale);

  //       // 🔥 KEY: rotation variation
  //       sprite.material.rotation = Math.random() * Math.PI;

  //       // 🔥 KEY: slight spread
  //       sprite.position.x += (Math.random() - 0.5) * 0.2;
  //       sprite.position.y += (Math.random() - 0.5) * 0.2;
  //       sprite.position.z += (Math.random() - 0.5) * 0.2;

  //       this.world.scene.add(sprite);

  //       // Fade out quickly
  //       let life = 0.05;
  //       const fade = () => {
  //         life -= 0.01;
  //         material.opacity = life;

  //         if (life > 0) {
  //           requestAnimationFrame(fade);
  //         } else {
  //           this.world.scene.remove(sprite);
  //           material.dispose();
  //         }
  //       };

  //       fade();
  //     }, i * delayStep);
  //   }

  //   if (!this.muzzleFlashLight) {
  //     this.muzzleFlashLight = new THREE.PointLight(0xffaa55, 0, 5);
  //     this.world.scene.add(this.muzzleFlashLight);
  //   }

  //   this.muzzleFlashLight.position.copy(basePos);
  //   this.muzzleFlashLight.intensity = 3;

  //   setTimeout(() => {
  //     this.muzzleFlashLight.intensity = 0;
  //   }, 50);
  // }

  createMuzzleFlash() {
    if (!this.world || !this.muzzleFlashTexture) return;

    let muzzle = null;

    // 🔍 Find muzzle ("Cylinder") in the ACTIVE weapon model
    this.pitchObj.traverse((child) => {
      if (child.name === "Cylinder" && !muzzle) {
        muzzle = child;
      }
    });

    if (!muzzle) {
      console.warn("No muzzle found");
      return;
    }

    const worldPos = new THREE.Vector3();
    muzzle.getWorldPosition(worldPos);

    const material = new THREE.SpriteMaterial({
      map: this.muzzleFlashTexture,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });

    const sprite = new THREE.Sprite(material);

    // ✅ REAL weapon position
    sprite.position.copy(worldPos);

    // 👇 tweak this to fit your gun size
    sprite.scale.set(5, 5, 1);

    this.world.scene.add(sprite);

    setTimeout(() => {
      this.world.scene.remove(sprite);
      material.dispose();
    }, 80);
  }

  update(delta) {
    if (this.weaponSwitchCooldown > 0) {
      this.weaponSwitchCooldown -= delta;
    }

    const currentWeapon = this.weapons[this.currentWeaponIndex];
    if (currentWeapon && this.world) {
      currentWeapon.update(delta, this.world.scene);
    }

    // Update hitbox visualizer position
    this.updateHitboxVisualizer();

    // If firing and weapon is out of ammo, stop firing
    if (this.isFiring && currentWeapon && currentWeapon.ammo <= 0) {
      this.stopShooting();
    }
  }

  takeDamage(amount, killerId = null) {
    if (this.isDead) return;

    this.health = Math.max(0, this.health - amount);

    if (this.health <= 0) {
      this.die(killerId);
    }
  }

  die(killerId = null) {
    if (this.isDead) return;
    this.isDead = true;
    this.deathTime = Date.now();

    // Stop all movement
    this.velocity.set(0, 0, 0);

    if (this.world?.controls) {
      this.world.controls.velocity.set(0, 0, 0);
      this.world.controls.moveForward = false;
      this.world.controls.moveBackward = false;
      this.world.controls.moveLeft = false;
      this.world.controls.moveRight = false;
    }

    console.log(`Player ${this.name} died. Killed by: ${killerId}`);

    // Play dying animation
    this.playAnimation("dying", !!this.socket, false);

    // If local player, show death screen
    if (this.socket) {
      this.socket.emit("playerDied", {
        id: this.id,
        killerId: killerId,
      });

      // Show death screen after a short delay to let the death animation start
      setTimeout(() => {
        this.showDeathScreen(killerId);
      }, 500);
    }

    // For remote players, schedule removal
    if (!this.socket) {
      // Remote player - remove after death animation
      setTimeout(() => {
        if (this.nameLabel) {
          this.nameLabel.remove();
          this.nameLabel = null;
        }
        if (this.world) {
          this.world.removeObject(this.threeObj);
        }
        if (window.minimap) {
          window.minimap.removePlayer(this.id);
        }
      }, 3000); // Wait for death animation
    }
  }

  showDeathScreen(killerId) {
    // Create death overlay
    const overlay = document.createElement("div");
    overlay.id = "death-overlay";
    overlay.style.cssText = `
    position: fixed; inset: 0;
    background: rgba(200, 0, 0, 0.3);
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    z-index: 99999;
    font-family: Arial, sans-serif;
    color: white;
    animation: deathFade 0.5s ease-in;
  `;

    overlay.innerHTML = `
    <div style="text-align: center;">
      <h1 style="font-size: 64px; margin: 0; text-shadow: 2px 2px 8px rgba(0,0,0,0.8);">YOU DIED</h1>
      ${killerId ? `<p style="font-size: 24px; margin: 16px 0; opacity: 0.9;">Eliminated</p>` : ""}
      <div id="death-countdown" style="font-size: 20px; margin-top: 24px; opacity: 0.8;">
        Leaving in <span id="death-timer">5</span>s...
      </div>
    </div>
  `;

    // Add CSS animation
    const style = document.createElement("style");
    style.textContent = `
    @keyframes deathFade {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `;
    document.head.appendChild(style);
    document.body.appendChild(overlay);

    // Countdown timer
    let remaining = Math.ceil(this.RESPAWN_DELAY / 1000);
    const timerEl = overlay.querySelector("#death-timer");

    const countdown = setInterval(() => {
      remaining--;
      if (timerEl) timerEl.textContent = remaining;
      if (remaining <= 0) {
        clearInterval(countdown);
      }
    }, 1000);

    // Disconnect after delay
    setTimeout(() => {
      clearInterval(countdown);
      // Reload the page to fully disconnect and reset
      window.location.reload();
    }, this.RESPAWN_DELAY);
  }

  // Add health UI update helper
  updateHealthUI() {
    const healthBar = document.getElementById("health-fill");
    const healthText = document.getElementById("health-text");
    if (healthBar) {
      const pct = (this.health / this.maxHealth) * 100;
      healthBar.style.width = pct + "%";
      healthBar.style.background =
        pct > 60 ? "#00cc44" : pct > 30 ? "#ffaa00" : "#cc2200";
    }
    if (healthText) {
      healthText.textContent = Math.ceil(this.health);
    }
  }

  // updateBullets(delta) {
  //   for (let i = this.bullets.length - 1; i >= 0; i--) {
  //     const bullet = this.bullets[i];

  //     bullet.position.add(
  //       bullet.userData.velocity.clone().multiplyScalar(delta),
  //     );

  //     const distanceTraveled = bullet.position.distanceTo(
  //       bullet.userData.startPosition,
  //     );
  //     if (distanceTraveled > bullet.userData.range) {
  //       this.world.scene.remove(bullet);
  //       this.bullets.splice(i, 1);
  //       continue;
  //     }

  //     const raycaster = new THREE.Raycaster();
  //     raycaster.set(
  //       bullet.userData.startPosition,
  //       bullet.userData.velocity.clone().normalize(),
  //     );
  //     raycaster.far = distanceTraveled;

  //     const intersects = raycaster.intersectObjects(
  //       this.world.getObjects(),
  //       true,
  //     );

  //     if (intersects.length > 0) {
  //       this.world.scene.remove(bullet);
  //       this.bullets.splice(i, 1);
  //     }
  //   }
  // }

  getCameraDirection() {
    if (this.world?.camera) {
      const direction = new THREE.Vector3();
      this.world.camera.getWorldDirection(direction);
      return direction;
    }
    return new THREE.Vector3(0, 0, -1);
  }

  handleRemoteShot(data) {
    const weapon = this.weapons[data.weaponIndex];
    if (weapon && this.world) {
      const flashGeometry = new THREE.SphereGeometry(
        weapon.muzzleFlashSize,
        8,
        8,
      );
      const flashMaterial = new THREE.MeshBasicMaterial({
        color: weapon.muzzleFlashColor,
        transparent: true,
        opacity: 0.8,
      });

      const flash = new THREE.Mesh(flashGeometry, flashMaterial);
      flash.position.copy(this.threeObj.position);
      flash.position.y += 12;

      this.world.scene.add(flash);
      setTimeout(() => {
        this.world.scene.remove(flash);
      }, 100);
    }
  }

  handleRemoteWeaponSwitch(weaponIndex) {
    console.log(
      `Remote weapon switch for ${this.name} to index ${weaponIndex}`,
    );

    this.ensureWeaponsReady().then(() => {
      if (weaponIndex >= 0 && weaponIndex < this.weapons.length) {
        this.currentWeaponIndex = weaponIndex;
        setTimeout(() => {
          this.attachCurrentWeapon();
          console.log(
            `Remote player ${this.name} now has weapon ${this.weapons[weaponIndex]?.name}`,
          );
        }, 200);
      }
    });
  }

  ensureWeaponsReady() {
    return new Promise((resolve) => {
      if (this.weapons.length > 0) {
        resolve();
      } else {
        console.log(`Weapons not loaded for ${this.name}, loading now...`);
        const checkInterval = setInterval(() => {
          if (this.weapons.length > 0) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      }
    });
  }

  // ✅ Reload weapon — startReload fires onReloadStart callback for animation
  // reloadWeapon() {
  //   const currentWeapon = this.weapons[this.currentWeaponIndex];
  //   if (!currentWeapon) return false;

  //   if (currentWeapon.ammo >= currentWeapon.maxAmmo) return false;
  //   if (currentWeapon.isReloading) return false;

  //   // ✅ startReload fires onReloadStart which plays animation and emits socket
  //   return currentWeapon.startReload();
  // }

  reloadWeapon() {
    const currentWeapon = this.weapons[this.currentWeaponIndex];
    if (!currentWeapon) return false;
    if (currentWeapon.ammo >= currentWeapon.maxAmmo) return false;
    if (currentWeapon.isReloading) return false;

    // Check reserves — player needs at least 1 reserve to reload
    const reserves = this.weaponReserves[currentWeapon.name] || 0;
    if (reserves <= 0) {
      // No ammo left — notify player
      if (window.roomManager) {
        window.roomManager.showNotification(
          `❌ No ammo for ${currentWeapon.name}! Find an ammo box.`,
          "#ff4444",
        );
      }
      return false;
    }

    return currentWeapon.startReload();
  }

  registerMixerWithWorld(world) {
    if (this.mixer && world) {
      world.addMixer(this.mixer);
    }
  }

  loadModel(tintColor) {
    if (this.modelLoading || this.modelLoaded) {
      console.log(`Model already loading/loaded for ${this.name}, skipping`);
      return;
    }

    this.modelLoading = true;
    console.log(
      `Starting to load model for player: ${this.name} (ID: ${this.id})`,
    );

    const loader = new GLTFLoader();

    loader.load(
      "/assets/models/soldier1.glb",
      (gltf) => {
        console.log(`Model loaded for player: ${this.name} (ID: ${this.id})`);
        const model = gltf.scene;

        model.scale.set(280, 280, 280);
        model.rotation.set(0, Math.PI, 0);

        if (tintColor) {
          this.applyTintToModel(model, tintColor);
        }

        this.pitchObj.add(model);
        this.threeObj.add(this.pitchObj);

        if (gltf.animations && gltf.animations.length > 0) {
          this.setupAnimations(model, gltf.animations);
        }

        this.modelLoading = false;
        this.modelLoaded = true;
        console.log("Model loaded successfully for player:", this.name);

        this.attachCurrentWeapon();
        this.loadJumpAnimation();
      },
      (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
      },
      (error) => {
        console.error("Error loading model:", error);
        this.createFallbackCube(tintColor);
      },
    );
  }

  applyTintToModel(model, tintColor) {
    model.traverse((child) => {
      if (child.isMesh) {
        if (Array.isArray(child.material)) {
          child.material = child.material.map((mat) => mat.clone());
        } else {
          child.material = child.material.clone();
        }

        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];

        materials.forEach((mat) => {
          mat.color.setHex(tintColor);
          if (mat.emissive) mat.emissive.setHex(0x222222);
          mat.needsUpdate = true;
        });
      }
    });
  }

  setupAnimations(model, animations) {
    console.log(
      "Available animations:",
      animations.map((a) => a.name),
    );

    const mixer = new THREE.AnimationMixer(model);

    const animationMap = {
      idle: animations.find((a) => a.name === "idle"),
      walk: animations.find((a) => a.name === "walking"),
      run: animations.find((a) => a.name === "running"),
      firing: animations.find((a) => a.name === "firing"),
      dying: animations.find((a) => a.name === "dying"),
      reloading: animations.find((a) => a.name === "reloading"),
      ready: animations.find((a) => a.name === "ready"),
    };

    Object.entries(animationMap).forEach(([name, anim]) => {
      if (anim) {
        console.log(`Found ${name} animation:`, anim.name);
      } else {
        console.warn(`Could not find ${name} animation`);
      }
    });

    const animationActions = {
      idle: animationMap.idle ? mixer.clipAction(animationMap.idle) : null,
      walk: animationMap.walk ? mixer.clipAction(animationMap.walk) : null,
      run: animationMap.run ? mixer.clipAction(animationMap.run) : null,
      firing: animationMap.firing
        ? mixer.clipAction(animationMap.firing)
        : null,
      dying: animationMap.dying ? mixer.clipAction(animationMap.dying) : null,
      reloading: animationMap.reloading
        ? mixer.clipAction(animationMap.reloading)
        : null,
      ready: animationMap.ready ? mixer.clipAction(animationMap.ready) : null,
      current: null,
    };

    if (animationActions.idle) {
      animationActions.idle.play();
      animationActions.current = animationActions.idle;
      this.currentAnimation = "idle";
      console.log("Playing idle animation");
    } else {
      console.warn(`No idle animation found for player ${this.name}`);
    }

    model.userData.animationMixer = mixer;
    model.userData.animationActions = animationActions;

    if (this.world) {
      this.world.addMixer(mixer);
    } else {
      this.mixer = mixer;
    }
  }

  loadJumpAnimation() {
    const fbxLoader = new FBXLoader();

    const model = this.pitchObj.children[0];
    if (!model) {
      console.error(
        "Cannot load jump animation - model not found for player:",
        this.name,
      );
      return;
    }

    fbxLoader.load(
      "/assets/animations/Rifle Jump In Place.fbx",
      (fbx) => {
        console.log("Jump animation loaded successfully");

        const model = this.pitchObj.children[0];
        if (!model) {
          console.error("Model not loaded yet for jump animation");
          return;
        }

        const mixer =
          model.userData.animationMixer || new THREE.AnimationMixer(model);

        let jumpClip = null;
        if (fbx.animations && fbx.animations.length > 0) {
          jumpClip = this.removeRootMotion(fbx.animations[0]);
        }

        if (jumpClip) {
          this.jumpAction = mixer.clipAction(jumpClip);

          if (this.world && !model.userData.animationMixer) {
            this.world.addMixer(mixer);
          }

          model.userData.animationMixer = mixer;
          this.jumpAnimationLoaded = true;
          console.log("Jump animation ready for player:", this.name);

          if (this.pendingJumpAnimation) {
            this.pendingJumpAnimation = false;
            this.playJumpAnimation();
          }
        } else {
          console.warn("No animation found in jump FBX file");
        }
      },
      (xhr) => {
        console.log(
          "Jump animation loading: " + (xhr.loaded / xhr.total) * 100 + "%",
        );
      },
      (error) => {
        console.error("Error loading jump animation:", error);
      },
    );
  }

  removeRootMotion(clip) {
    const tracks = [];
    for (const track of clip.tracks) {
      if (!track.name.includes(".position")) {
        tracks.push(track);
      } else {
        console.log("Removing root motion track:", track.name);
      }
    }
    return new THREE.AnimationClip(clip.name, clip.duration, tracks);
  }

  playJumpAnimation() {
    if (!this.modelLoaded) return;

    if (!this.jumpAnimationLoaded || !this.jumpAction) {
      this.pendingJumpAnimation = true;
      return;
    }

    const model = this.pitchObj.children[0];
    if (!model) return;

    const actions = model.userData.animationActions;
    const previousAction = actions ? actions.current : null;

    if (previousAction) previousAction.fadeOut(0.1);

    if (!this.jumpAction._mixer) {
      this.jumpAction = model.userData.animationMixer.clipAction(
        this.jumpAction._clip,
      );
    }

    const yRotation = model.rotation.y;

    this.jumpAction.reset().fadeIn(0.1).play();
    this.currentAnimation = "jump";

    const interval = setInterval(() => {
      if (this.currentAnimation !== "jump") {
        clearInterval(interval);
        return;
      }
      model.rotation.x = Math.PI / 2;
      model.rotation.z = 0;
      model.rotation.y = yRotation;
    }, 16);

    setTimeout(() => {
      clearInterval(interval);

      if (this.jumpAction) this.jumpAction.fadeOut(0.1);

      model.rotation.x = 0;
      model.rotation.z = 0;
      model.rotation.y = yRotation;

      if (actions) {
        const isMoving =
          Math.abs(this.velocity?.x || 0) > 0.01 ||
          Math.abs(this.velocity?.z || 0) > 0.01;
        const returnAnimation = isMoving
          ? this.isRunning
            ? "run"
            : "walk"
          : "idle";

        const newAction = actions[returnAnimation];
        if (newAction) {
          newAction.reset().fadeIn(0.1).play();
          actions.current = newAction;
          this.currentAnimation = returnAnimation;
        }
      }
    }, 600);
  }

  playAnimation(animationName, broadcast = true, loop = true) {
    if (!this.modelLoaded) return;

    const model = this.pitchObj.children[0];
    if (!model || !model.userData.animationActions) return;

    const actions = model.userData.animationActions;
    const newAction = actions[animationName];

    if (!newAction) return;

    if (actions.current !== newAction) {
      if (actions.current) actions.current.fadeOut(0.2);

      newAction.reset();

      if (loop) {
        newAction.setLoop(THREE.LoopRepeat, Infinity);
      } else {
        newAction.setLoop(THREE.LoopOnce, 1);
        newAction.clampWhenFinished = true;
      }

      newAction.fadeIn(0.2);
      newAction.play();
      actions.current = newAction;
      this.currentAnimation = animationName;

      if (broadcast && this.socket) {
        this.socket.emit("playerAnimation", {
          id: this.id,
          animation: animationName,
        });
      }

      if (!loop) {
        const mixer = model.userData.animationMixer;
        const onFinished = () => {
          mixer.removeEventListener("finished", onFinished);

          const isMoving =
            Math.abs(this.velocity?.x || 0) > 0.01 ||
            Math.abs(this.velocity?.z || 0) > 0.01;

          if (isMoving) {
            this.playAnimation(this.isRunning ? "run" : "walk", true, true);
          } else {
            this.playAnimation("idle", true, true);
          }
        };
        mixer.addEventListener("finished", onFinished);
      }
    }
  }

  updateAnimation(isMoving, isRunning = false) {
    if (!this.modelLoaded) return;

    if (isMoving) {
      if (isRunning && this.hasAnimation("run")) {
        this.playAnimation("run", true);
      } else if (this.hasAnimation("walk")) {
        this.playAnimation("walk", true);
      }
    } else {
      this.playAnimation("idle", true);
    }
  }

  hasAnimation(animationName) {
    const model = this.pitchObj.children[0];
    if (!model || !model.userData.animationActions) return false;
    return model.userData.animationActions[animationName] !== null;
  }

  handleRemoteAnimation(animationName) {
    this.playAnimation(animationName, false);
  }

  createFallbackCube(tintColor = 0xff0000) {
    const size = 20;
    const geometry = new THREE.BoxGeometry(size, size, size);
    const material = new THREE.MeshPhongMaterial({
      color: tintColor,
      emissive: 0x222222,
    });

    const fallbackMesh = new THREE.Mesh(geometry, material);
    this.pitchObj.add(fallbackMesh);
    this.threeObj.add(this.pitchObj);
    this.modelLoaded = true;
    console.log("Fallback cube created for player:", this.name);
  }

  setPos(posObj) {
    this.threeObj.position.copy(posObj);
  }

  setRotation(rotationObj) {
    this.threeObj.rotation.y = rotationObj.y;
    if (this.pitchObj) {
      this.pitchObj.rotation.x = rotationObj.x;
    }
  }

  // Replace setPos for remote players:
  setTargetPos(posObj) {
    if (!this.targetPosition) {
      this.targetPosition = new THREE.Vector3(posObj.x, posObj.y, posObj.z);
      this.threeObj.position.set(posObj.x, posObj.y, posObj.z);
    } else {
      this.targetPosition.set(posObj.x, posObj.y, posObj.z);
    }
  }

  setTargetRotation(rotObj) {
    this.targetRotationY = rotObj.y;
  }

  getRotation() {
    return {
      x: this.pitchObj ? this.pitchObj.rotation.x : 0,
      y: this.threeObj.rotation.y,
      z: 0,
    };
  }

  getThreeObj() {
    return this.threeObj;
  }

  getSpeechObj() {
    return this.speechObj;
  }

  getNameObj() {
    return this.nameObj;
  }

  serverFormat() {
    return {
      id: this.id,
      name: this.name,
      color: this.color,
      pos: this.threeObj.position,
      rotation: {
        x: this.pitchObj ? this.pitchObj.rotation.x : 0,
        y: this.threeObj.rotation.y,
      },
      weaponIndex: this.currentWeaponIndex,
      animation: this.currentAnimation,
    };
  }

  clientFormat() {
    return {
      id: this.id,
      name: this.name,
      color: this.color,
      pos: {
        x: this.threeObj.position.x,
        y: this.threeObj.position.y,
        z: this.threeObj.position.z,
      },
      rotation: {
        x: this.pitchObj ? this.pitchObj.rotation.x : 0,
        y: this.threeObj.rotation.y,
        z: 0,
      },
      animation: this.currentAnimation,
      weaponIndex: this.currentWeaponIndex,
    };
  }

  // In the remove/destroy method
  cleanup() {
    if (this.laserLine && this.world && this.world.scene) {
      this.world.scene.remove(this.laserLine);
      this.laserLine.geometry.dispose();
      this.laserLine.material.dispose();
      this.laserLine = null;
    }

    // Stop firing when cleaning up
    this.stopShooting();
  }
}
