// Player.js
import * as THREE from "three";
import {
  CSS2DRenderer,
  CSS2DObject,
} from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
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
    this.speechObj = new THREE.Object3D();
    this.speechObj.position.set(-15, 15, 0);
    this.nameObj = new THREE.Object3D();
    this.nameObj.position.set(0, 30, 0);

    // Weapon system properties
    this.weapons = [];
    this.currentWeaponIndex = 0;
    this.bullets = [];
    this.weaponSwitchCooldown = 0;
    this.WEAPON_SWITCH_COOLDOWN = 0.5;
    this.lastSwitchTime = 0;

    this.maxGrenades = 3; // Maximum grenades a player can carry
    this.grenadeCount = 3; // Start with 3 grenades

    this.solanaWallet = null; // Add this
    this.wallet = null; // Add this

    this.deathProcessed = false;
    this.lastKillTime = 0;
    this.killCooldown = 1000;

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

    // CREATE LABEL - NOW AFTER threeObj IS CREATED
    this.nameLabelObj = new THREE.Object3D();
    this.nameLabelObj.position.set(0, 22, 0);

    const nameDiv = document.createElement("div");
    nameDiv.className = "label";
    nameDiv.textContent = this.name;
    nameDiv.style.marginTop = "-1em";
    nameDiv.style.cssText = `
        background: rgba(0,0,0,0.75);
        color: #ffaa00;
        padding: 4px 12px;
        font-size: 14px;
        font-family: Arial, sans-serif;
        font-weight: bold;
        white-space: nowrap;
        pointer-events: none;
    `;

    this.nameLabel = new CSS2DObject(nameDiv);
    this.nameLabel.position.set(0, 0, 0);
    this.nameLabelObj.add(this.nameLabel);
    this.threeObj.add(this.nameLabelObj);

    // Pitch object for vertical rotation
    this.pitchObj = new THREE.Object3D();

    // Load the GLB model
    this.loadModel(this.color);

    this.velocity = new THREE.Vector3();

    // Loadout system
    this.loadoutWeapons = [];
    this.holsteredWeapons = [];
    this.backHolsterPoint = null;
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

    this.weaponReserves = {};

    this.muzzleFlashTexture = new THREE.TextureLoader().load(
      "/assets/textures/muzzle_flash.png",
    );
    this.isFiring = false;
    this.fireInterval = null;

    this.throwInProgress = false;

    // Add hit flash style
    Player.addHitFlashStyle();
  }

  startShooting() {
    if (this.isFiring) return;

    const currentWeapon = this.weapons[this.currentWeaponIndex];
    if (!currentWeapon) return;

    // Check if weapon has ammo
    if (currentWeapon.ammo <= 0) {
      // Save movement state for reload animation
      const controls = this.world?.controls;
      if (controls) {
        controls._reloadIsMoving =
          Math.abs(controls.velocity?.x || 0) > 0.01 ||
          Math.abs(controls.velocity?.z || 0) > 0.01;
        controls._reloadIsRunning = controls.isRunning;
      }

      // Try to reload instead of shooting
      this.reloadWeapon();
      return;
    }

    // Check if weapon can fire before starting
    if (!currentWeapon.canFire()) return;

    this.isFiring = true;

    if (currentWeapon.fireMode === "auto") {
      this.autoFireLoop();
    } else {
      // Semi-auto or other modes: fire once
      this.shoot();
      // For semi-auto, we don't keep firing, so stop immediately
      this.isFiring = false;
    }
  }

  stopShooting() {
    this.isFiring = false;

    if (this.fireInterval) {
      clearTimeout(this.fireInterval);
      this.fireInterval = null;
    }

    // Tell weapon to stop firing
    const currentWeapon = this.weapons[this.currentWeaponIndex];
    if (currentWeapon && currentWeapon.stopFiring) {
      currentWeapon.stopFiring();
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

    // Check ammo FIRST
    if (currentWeapon.ammo <= 0) {
      // Save movement state for reload animation
      const controls = this.world?.controls;
      if (controls) {
        controls._reloadIsMoving =
          Math.abs(controls.velocity?.x || 0) > 0.01 ||
          Math.abs(controls.velocity?.z || 0) > 0.01;
        controls._reloadIsRunning = controls.isRunning;
      }

      this.reloadWeapon();
      this.stopShooting();
      return;
    }

    // Check if weapon can fire
    if (currentWeapon.canFire()) {
      this.shoot();
    }

    // Continue firing if still holding and weapon has ammo
    if (this.isFiring && currentWeapon.ammo > 0 && !currentWeapon.isReloading) {
      const fireDelay = Math.max(50, currentWeapon.fireRate * 1000);
      this.fireInterval = setTimeout(() => {
        this.autoFireLoop();
      }, fireDelay);
    }
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
    if (this.bones?.spine) {
      this.backHolsterPoint = this.bones.spine;
    } else if (this.modelLoaded) {
      // Fallback dummy point
      this.backHolsterPoint = new THREE.Object3D();
      this.backHolsterPoint.position.set(0, 8, -5);
      this.threeObj.add(this.backHolsterPoint);
    }
  }

  findWaistHolsterPoint() {
    if (this.bones?.hips) {
      this.waistHolsterPoint = this.bones.hips;
    } else if (this.modelLoaded) {
      // fallback
      this.waistHolsterPoint = new THREE.Object3D();
      this.waistHolsterPoint.position.set(0, 10, 0);
      this.threeObj.add(this.waistHolsterPoint);
    }
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
                  `Current weapon attached: ${
                    this.weapons[this.currentWeaponIndex]?.name
                  }`,
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

  hasGrenades() {
    return this.grenadeCount > 0;
  }

  useGrenade() {
    if (this.grenadeCount > 0) {
      this.grenadeCount--;
      this.updateGrenadeUI();
      return true;
    }
    return false;
  }

  addGrenade(amount = 1) {
    this.grenadeCount = Math.min(this.maxGrenades, this.grenadeCount + amount);
    this.updateGrenadeUI();
  }

  updateGrenadeUI() {
    // Update the grenade counter in HUD
    const grenadeElement = document.getElementById("grenade-count");
    if (grenadeElement) {
      grenadeElement.textContent = this.grenadeCount;
      if (this.grenadeCount === 0) {
        grenadeElement.style.color = "#ff4444";
      } else {
        grenadeElement.style.color = "#ffaa44";
      }
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

  setupWeaponCallbacks() {
    this.weapons.forEach((weapon) => {
      weapon.onReloadStart = () => {
        console.log("onReloadStart called for", weapon.name);

        const controls = this.world?.controls;

        let isMoving, isRunning;

        if (controls && controls._reloadIsMoving !== undefined) {
          isMoving = controls._reloadIsMoving;
          isRunning = controls._reloadIsRunning;
        } else {
          isMoving =
            Math.abs(this.velocity?.x || 0) > 0.01 ||
            Math.abs(this.velocity?.z || 0) > 0.01;
          isRunning = this.isRunning || false;
        }

        console.log(
          `Reload state — moving: ${isMoving}, running: ${isRunning}`,
        );

        if (isMoving) {
          // Moving - pick based on speed
          if (isRunning) {
            this.playAnimation("reloadingRun", !!this.socket, false);
          } else {
            this.playAnimation("reloadingWalk", !!this.socket, false);
          }
        } else {
          // Stationary - use standing reload
          this.playAnimation("reloading", !!this.socket, false);
        }

        if (this.socket) {
          this.socket.emit("playerReload", { id: this.id });
        }
      };

      weapon.onReloadComplete = () => {
        if (this.weaponReserves[weapon.name] > 0) {
          this.weaponReserves[weapon.name]--;
        }
        this.updateAmmoHUD();

        this.currentAnimation = "";

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

    // Use cached bone reference instead of recursive getObjectByName
    const rightHand = this.bones?.rightHand;
    if (!rightHand) return;

    // Remove existing weapons from hand
    rightHand.children.forEach((child) => {
      if (child.name && child.name.includes("weapon_")) {
        rightHand.remove(child);
      }
    });

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

    // If in FPS mode, refresh the FPS weapon
    if (this.world?.controls?.cameraMode === "fps") {
      this.world.controls.refreshFPSWeapon();
    }

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

    // ✅ Simple raycast for obstacles
    const raycaster = new THREE.Raycaster(origin, direction);

    // Get all world objects that should block bullets
    const obstacles = this.world.objects.filter((obj) => {
      // Skip players, UI, and small objects
      if (obj.userData?.isPlayer) return false;
      if (obj.isCSS2DObject) return false;
      if (obj.isPoints || obj.isSprite) return false;
      return true;
    });

    // Find closest obstacle hit
    const hits = raycaster.intersectObjects(obstacles, true);
    const closestObstacle = hits.length > 0 ? hits[0] : null;

    let hitPlayer = null;
    let hitPoint = null;
    let hitDistance = Infinity;
    let isHeadshot = false;
    let targetInSpawnBox = false;

    if (window.players) {
      window.players.getAll().forEach((player) => {
        if (player === this) return;
        if (player.isDead) return;

        if (this.world && this.world.isPlayerInSpawnBox) {
          const targetPos = player.getThreeObj().position;
          if (this.world.isPlayerInSpawnBox(targetPos)) return;
        }

        const hitbox = player.getHitbox();

        const headHit = this.rayIntersectsCylinder(
          origin,
          direction,
          hitbox.head,
        );

        let playerHitDistance = Infinity;
        let hitType = null;
        let hitPos = null;

        if (headHit && headHit.distance > 0) {
          playerHitDistance = headHit.distance;
          hitType = "head";
          hitPos = headHit.point;
        } else {
          const bodyHit = this.rayIntersectsCylinder(
            origin,
            direction,
            hitbox.body,
          );
          if (bodyHit && bodyHit.distance > 0) {
            playerHitDistance = bodyHit.distance;
            hitType = "body";
            hitPos = bodyHit.point;
          }
        }

        // ✅ ONLY hit if player is closer than any obstacle
        const obstacleDistance = closestObstacle
          ? closestObstacle.distance
          : Infinity;
        if (
          playerHitDistance < obstacleDistance &&
          playerHitDistance < hitDistance
        ) {
          hitDistance = playerHitDistance;
          hitPlayer = player.id;
          hitPoint = hitPos;
          isHeadshot = hitType === "head";
        }
      });
    }

    const damage = currentWeapon.getDamage(isHeadshot);

    if (this.socket) {
      this.socket.emit("fireWeapon", {
        position: origin,
        direction: direction,
        weaponIndex: this.currentWeaponIndex,
        weaponName: currentWeapon.name,
        targetId: hitPlayer || null,
        hitPoint: hitPoint || null,
        isHeadshot: isHeadshot || false,
        damage: damage,
        clientPing: this.socket.lastPing || 0,
        targetInSpawnBox: targetInSpawnBox,
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

  createMuzzleFlash() {
    if (!this.world || !this.muzzleFlashTexture) return;

    let muzzle = null;
    let worldPos = new THREE.Vector3();

    // Check if in FPS mode
    const isFPSMode = this.world?.controls?.cameraMode === "fps";

    if (isFPSMode && this.world?.controls?.fpsWeapon) {
      // In FPS mode, find muzzle on the camera-attached weapon
      const fpsWeapon = this.world.controls.fpsWeapon;
      fpsWeapon.traverse((child) => {
        if (child.name === "Cylinder" && !muzzle) {
          muzzle = child;
        }
      });

      if (muzzle) {
        muzzle.getWorldPosition(worldPos);
      }
    } else {
      // Original third-person mode - find muzzle on player model
      this.pitchObj.traverse((child) => {
        if (child.name === "Cylinder" && !muzzle) {
          muzzle = child;
        }
      });

      if (muzzle) {
        muzzle.getWorldPosition(worldPos);
      }
    }

    if (!muzzle) {
      // If no muzzle found, use weapon position as fallback
      if (isFPSMode && this.world?.controls?.fpsWeapon) {
        worldPos = this.world.controls.fpsWeapon.position.clone();
        this.world.controls.fpsWeapon.localToWorld(worldPos);
      } else if (this.bones?.rightHand) {
        this.bones.rightHand.getWorldPosition(worldPos);
      } else {
        worldPos = this.threeObj.position.clone();
        worldPos.y += 14;
      }
    }

    const material = new THREE.SpriteMaterial({
      map: this.muzzleFlashTexture,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });

    const sprite = new THREE.Sprite(material);
    sprite.position.copy(worldPos);

    // Scale based on weapon type or FPS mode
    const scale = isFPSMode ? 1.5 : 2.5;
    sprite.scale.set(scale, scale, 1);

    this.world.scene.add(sprite);

    setTimeout(() => {
      this.world.scene.remove(sprite);
      material.dispose();
    }, 80);

    // Emit muzzle flash to other players
    if (this.socket) {
      this.socket.emit("muzzleFlash", {
        position: { x: worldPos.x, y: worldPos.y, z: worldPos.z },
      });
    }
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
    if (this.hitboxVisible) {
      this.updateHitboxVisualizer();
    }

    // If firing and weapon is out of ammo, stop firing
    if (this.isFiring && currentWeapon && currentWeapon.ammo <= 0) {
      this.stopShooting();
    }
  }

  takeDamage(amount, killerId = null) {
    // ✅ Don't process damage if already dead
    if (this.isDead) return false;

    // Only play hit animation if not already playing hit animation
    if (this.currentAnimation !== "hit") {
      this.playAnimation("hit", !!this.socket, false);
    }

    this.health = Math.max(0, this.health - amount);

    // Add hit feedback effect (optional)
    if (
      this.world &&
      this.world.controls &&
      this === this.world.controls.player
    ) {
      // Show hit indicator on screen for local player
      this.showHitIndicator();
    }

    // ✅ Mark as dead immediately when health reaches 0
    if (this.health <= 0 && !this.isDead) {
      this.isDead = true;
      this.die(killerId);
      return true;
    }

    return this.health <= 0;
  }

  showHitIndicator() {
    // Create a red flash overlay effect
    const indicator = document.createElement("div");
    indicator.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: radial-gradient(circle, rgba(255,0,0,0.3) 0%, rgba(255,0,0,0) 70%);
        pointer-events: none;
        z-index: 39;
        animation: hitFlash 0.2s ease-out;
    `;
    document.body.appendChild(indicator);

    setTimeout(() => {
      if (indicator && indicator.remove) indicator.remove();
    }, 200);
  }

  // Add CSS animation if not present
  static addHitFlashStyle() {
    if (document.getElementById("hit-flash-style")) return;
    const style = document.createElement("style");
    style.id = "hit-flash-style";
    style.textContent = `
        @keyframes hitFlash {
            0% { opacity: 1; }
            100% { opacity: 0; }
        }
    `;
    document.head.appendChild(style);
  }

  die(killerId = null) {
    // ✅ Prevent multiple calls
    if (this.isDead) return;
    if (this.deathProcessed) return;

    this.deathProcessed = true;
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

    // ✅ Play dying animation and wait for it to finish before hiding
    this.playAnimation("dying", !!this.socket, false);

    // ✅ Get the model and mixer
    const model = this.pitchObj?.children[0];
    if (model?.userData?.animationMixer) {
      const mixer = model.userData.animationMixer;

      // ✅ Listen for animation finished
      const onAnimationFinished = () => {
        mixer.removeEventListener("finished", onAnimationFinished);

        // ✅ STOP all actions after dying animation completes
        mixer.stopAllAction();

        // Hide the model after animation completes
        if (this.threeObj) {
          this.threeObj.visible = false;
        }
        if (this.nameLabel) {
          this.nameLabel.element.style.opacity = "0";
        }

        console.log(`Dying animation finished for ${this.name}, hiding player`);
      };

      mixer.addEventListener("finished", onAnimationFinished);

      // ✅ Also set a timeout as fallback (in case animation doesn't trigger finished event)
      setTimeout(() => {
        if (this.threeObj && this.threeObj.visible !== false) {
          console.log(`Fallback: Hiding player ${this.name} after timeout`);
          this.threeObj.visible = false;
          if (this.nameLabel) {
            this.nameLabel.element.style.opacity = "0";
          }
        }
      }, 4500);
    } else {
      // Fallback if no animation mixer
      setTimeout(() => {
        if (this.threeObj) {
          this.threeObj.visible = false;
        }
        if (this.nameLabel) {
          this.nameLabel.element.style.opacity = "0";
        }
      }, 4500);
    }
  }

  // Also update resetHealth to reset the deathProcessed flag:
  resetHealth() {
    this.health = this.maxHealth;
    this.isDead = false;
    this.deathProcessed = false; // ✅ Reset the flag
    this.lastSpawnTime = Date.now();
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

  reloadWeapon() {
    const currentWeapon = this.weapons[this.currentWeaponIndex];
    if (!currentWeapon) return false;
    this.world?.controls?.addFPSWeaponReload();

    // Don't reload if already at max ammo
    if (currentWeapon.ammo >= currentWeapon.maxAmmo) return false;

    // Don't reload if already reloading
    if (currentWeapon.isReloading) return false;

    // Check reserves
    const reserves = this.weaponReserves[currentWeapon.name] || 0;
    if (reserves <= 0) {
      if (window.roomManager) {
        window.roomManager.showNotification(
          `❌ No ammo for ${currentWeapon.name}! Find an ammo box.`,
          "#ff4444",
        );
      }
      return false;
    }

    // This will trigger onReloadStart callback which plays animation
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
      "/assets/models/soldier11.glb",
      (gltf) => {
        const model = gltf.scene;

        model.scale.set(280, 280, 280);
        model.rotation.set(-Math.PI / 2, 0, Math.PI);

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

    // Map animation names from the new model
    const animationMap = {
      // Core animations
      idle: animations.find((a) => a.name === "Idle Aiming"),
      walk: animations.find((a) => a.name === "Walk Forward"), // Changed from "Rifle Walk"
      walk1: animations.find((a) => a.name === "Rifle Walk"),
      run: animations.find((a) => a.name === "Run Forward"), // Changed from "Rifle Run"
      run1: animations.find((a) => a.name === "Rifle Run"),
      firing: animations.find((a) => a.name === "Firing Rifle"),
      hit: animations.find((a) => a.name === "Hit" || a.name === "Hit React"),
      dying: animations.find((a) => a.name === "Dying"),
      reloading: animations.find((a) => a.name === "Reloading"),
      reloadingRun: animations.find((a) => a.name === "Reload_running"), // First Reload anim
      reloadingWalk: animations.find((a) => a.name === "Reload_walking"), // Second Reload anim
      ready: animations.find((a) => a.name === "Rifle Pull Out"),

      // Grenade throw
      throw: animations.find((a) => a.name === "Grenade Throw"),
      tossGrenade: animations.find((a) => a.name === "Toss Grenade"),
      throwWalking: animations.find((a) => a.name === "Walking Grenade Throw"),
      throwRunning: animations.find((a) => a.name === "Run And Throw Grenade"),

      // Firing while moving
      firingWalk: animations.find(
        (a) => a.name === "Firing Rifle walking crouching",
      ),
      firingRun: animations.find((a) => a.name === "Shoot Rifle running"),

      // Air
      falling: animations.find((a) => a.name === "Falling Idle"),

      // Pickup
      pickup: animations.find((a) => a.name === "Finding and picking item"),

      // Crouching (defined but not used yet)
      crouchDeath: animations.find((a) => a.name === "Crouch Death"),
      crouchRapidFire: animations.find((a) => a.name === "Crouch Rapid Fire"),
      reloadCrouching: animations.find((a) => a.name === "Reload crouching"),
      kneelIdle: animations.find((a) => a.name === "Rifle Kneel Idle"),
      walkCrouching: animations.find(
        (a) => a.name === "Walk Crouching Forward",
      ),
    };

    // Log what we found
    Object.entries(animationMap).forEach(([name, anim]) => {
      if (anim) {
        console.log(`✅ Found ${name}: ${anim.name}`);
      } else {
        console.warn(`⚠️ Missing ${name} animation`);
      }
    });

    const animationActions = {
      idle: animationMap.idle ? mixer.clipAction(animationMap.idle) : null,
      walk: animationMap.walk ? mixer.clipAction(animationMap.walk) : null,
      run: animationMap.run ? mixer.clipAction(animationMap.run) : null,
      walk1: animationMap.walk1 ? mixer.clipAction(animationMap.walk1) : null,
      run1: animationMap.run1 ? mixer.clipAction(animationMap.run1) : null,
      firing: animationMap.firing
        ? mixer.clipAction(animationMap.firing)
        : null,
      firingWalk: animationMap.firingWalk
        ? mixer.clipAction(animationMap.firingWalk)
        : null,
      firingRun: animationMap.firingRun
        ? mixer.clipAction(animationMap.firingRun)
        : null,
      hit: animationMap.hit ? mixer.clipAction(animationMap.hit) : null,
      dying: animationMap.dying ? mixer.clipAction(animationMap.dying) : null,
      reloading: animationMap.reloading
        ? mixer.clipAction(animationMap.reloading)
        : null,
      reloadingWalk: animationMap.reloadingWalk
        ? mixer.clipAction(animationMap.reloadingWalk)
        : null,
      reloadingRun: animationMap.reloadingRun
        ? mixer.clipAction(animationMap.reloadingRun)
        : null,
      ready: animationMap.ready ? mixer.clipAction(animationMap.ready) : null,
      throw: animationMap.throw ? mixer.clipAction(animationMap.throw) : null,
      tossGrenade: animationMap.tossGrenade
        ? mixer.clipAction(animationMap.tossGrenade)
        : null,
      throwWalking: animationMap.throwWalking
        ? mixer.clipAction(animationMap.throwWalking)
        : null,
      throwRunning: animationMap.throwRunning
        ? mixer.clipAction(animationMap.throwRunning)
        : null,
      falling: animationMap.falling
        ? mixer.clipAction(animationMap.falling)
        : null,
      pickup: animationMap.pickup
        ? mixer.clipAction(animationMap.pickup)
        : null,

      // Crouching (defined but not used yet)
      crouchDeath: animationMap.crouchDeath
        ? mixer.clipAction(animationMap.crouchDeath)
        : null,
      crouchRapidFire: animationMap.crouchRapidFire
        ? mixer.clipAction(animationMap.crouchRapidFire)
        : null,
      reloadCrouching: animationMap.reloadCrouching
        ? mixer.clipAction(animationMap.reloadCrouching)
        : null,
      kneelIdle: animationMap.kneelIdle
        ? mixer.clipAction(animationMap.kneelIdle)
        : null,
      walkCrouching: animationMap.walkCrouching
        ? mixer.clipAction(animationMap.walkCrouching)
        : null,

      current: null,
    };

    // Play idle by default
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

    this.bones = {
      rightHand:
        model.getObjectByName("mixamorigRightHand") ||
        model.getObjectByName("RightHand"),
      spine:
        model.getObjectByName("mixamorigSpine") ||
        model.getObjectByName("Spine"),
      hips:
        model.getObjectByName("mixamorigHips") || model.getObjectByName("Hips"),
    };

    if (!this.bones.rightHand) console.warn(`Bones not found for ${this.name}`);

    if (this.world) {
      this.world.addMixer(mixer);
    } else {
      this.mixer = mixer;
    }
  }

  // playAnimation(animationName, broadcast = true, loop = true) {
  //   if (!this.modelLoaded) return;

  //   // Don't interrupt dying animation
  //   if (this.currentAnimation === "dying" && animationName !== "dying") {
  //     return;
  //   }

  //   // Don't interrupt throw animation
  //   if (this.currentAnimation === "throw" && animationName !== "throw") return;

  //   const forceReplayAnimations = ["firing", "throw", "dying"];

  //   if (
  //     this.currentAnimation === animationName &&
  //     !forceReplayAnimations.includes(animationName)
  //   ) {
  //     return;
  //   }

  //   const model = this.pitchObj.children[0];
  //   if (!model || !model.userData.animationActions) return;

  //   const actions = model.userData.animationActions;
  //   const mixer = model.userData.animationMixer;

  //   // Map "throw" to "tossGrenade" action
  //   let actionName = animationName;
  //   if (animationName === "throw") {
  //     actionName = "tossGrenade";
  //   }

  //   const newAction = actions[actionName];

  //   if (!newAction) return;

  //   if (actions.current !== newAction) {
  //     if (actions.current) {
  //       actions.current.fadeOut(0.2);
  //     }

  //     newAction.reset();

  //     if (loop) {
  //       newAction.setLoop(THREE.LoopRepeat, Infinity);
  //     } else {
  //       newAction.setLoop(THREE.LoopOnce, 1);
  //       newAction.clampWhenFinished = true;
  //     }

  //     newAction.fadeIn(0.2);
  //     newAction.play();
  //     actions.current = newAction;
  //     this.currentAnimation = animationName;

  //     // Set throwInProgress flag
  //     if (animationName === "throw") {
  //       this.throwInProgress = true;
  //     }

  //     if (broadcast && this.socket) {
  //       this.socket.emit("playerAnimation", {
  //         id: this.id,
  //         animation: animationName,
  //       });
  //     }

  //     // For non-looping animations, handle auto-return
  //     if (!loop) {
  //       const onFinished = () => {
  //         mixer.removeEventListener("finished", onFinished);

  //         if (animationName === "throw") {
  //           this.throwInProgress = false;
  //         }

  //         // Don't auto-return for dying animation - let the death handler manage it
  //         if (animationName === "dying") {
  //           return;
  //         }

  //         const isMoving =
  //           Math.abs(this.velocity?.x || 0) > 0.01 ||
  //           Math.abs(this.velocity?.z || 0) > 0.01;

  //         // Force reset currentAnimation so the guard doesn't block us
  //         const prevAnimation = this.currentAnimation;
  //         this.currentAnimation = "";

  //         if (prevAnimation === "throw") {
  //           // Only auto-return for throw
  //           if (isMoving) {
  //             this.playAnimation(this.isRunning ? "run" : "walk", true, true);
  //           } else {
  //             this.playAnimation("idle", true, true);
  //           }
  //         }
  //         // For other one-shot animations (ready, pickup), don't auto-return
  //       };
  //       mixer.addEventListener("finished", onFinished);
  //     }
  //   }

  //   this.currentAnimation = animationName;
  // }

  playAnimation(animationName, broadcast = true, loop = true) {
    if (!this.modelLoaded) return;

    // Don't interrupt dying animation
    if (this.currentAnimation === "dying" && animationName !== "dying") {
      return;
    }

    // Don't interrupt throw animation unless it's a different movement state
    if (this.currentAnimation === "throw" && animationName !== "throw") {
      // If we're throwing and trying to change movement state, let it change
      if (animationName === "walk" || animationName === "run") {
        // Cancel current throw to allow movement
        if (this.throwInProgress) {
          this.throwInProgress = false;
        }
      } else {
        return;
      }
    }

    const forceReplayAnimations = ["firing", "throw", "dying"];

    if (
      this.currentAnimation === animationName &&
      !forceReplayAnimations.includes(animationName)
    ) {
      return;
    }

    const model = this.pitchObj.children[0];
    if (!model || !model.userData.animationActions) return;

    const actions = model.userData.animationActions;
    const mixer = model.userData.animationMixer;

    // Map grenade throw animations based on movement state
    let actionName = animationName;
    if (animationName === "throw") {
      // Check if player is moving and which animation to use
      const isMoving =
        Math.abs(this.velocity?.x || 0) > 0.05 ||
        Math.abs(this.velocity?.z || 0) > 0.05;
      const isRunning = isMoving && this.world?.controls?.isRunning;

      if (isRunning && actions.throwRunning) {
        actionName = "throwRunning";
      } else if (isMoving && actions.throwWalking) {
        actionName = "throwWalking";
      } else {
        actionName = "tossGrenade";
      }
    }

    const newAction = actions[actionName];

    if (!newAction) return;

    if (actions.current !== newAction) {
      if (actions.current) {
        actions.current.fadeOut(0.2);
      }

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

      // Set throwInProgress flag
      if (animationName === "throw") {
        this.throwInProgress = true;
      }

      if (broadcast && this.socket) {
        this.socket.emit("playerAnimation", {
          id: this.id,
          animation: animationName,
        });
      }

      // For non-looping animations, handle auto-return
      if (!loop) {
        const onFinished = () => {
          mixer.removeEventListener("finished", onFinished);

          if (animationName === "throw") {
            this.throwInProgress = false;
          }

          // Don't auto-return for dying animation
          if (animationName === "dying") {
            return;
          }

          const isMoving =
            Math.abs(this.velocity?.x || 0) > 0.05 ||
            Math.abs(this.velocity?.z || 0) > 0.05;

          // Force reset currentAnimation
          const prevAnimation = this.currentAnimation;
          this.currentAnimation = "";

          if (prevAnimation === "throw") {
            if (isMoving) {
              if (this.world?.controls?.cameraMode === "thirdPerson") {
                this.playAnimation(
                  this.isRunning ? "run1" : "walk1",
                  true,
                  true,
                );
              } else {
                this.playAnimation(this.isRunning ? "run" : "walk", true, true);
              }
            } else {
              this.playAnimation("idle", true, true);
            }
          }
        };
        mixer.addEventListener("finished", onFinished);
      }
    }

    this.currentAnimation = animationName;
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
    // If it's a non-looping animation, we need to handle the return
    if (
      animationName === "throw" ||
      animationName === "ready" ||
      animationName === "pickup" ||
      animationName === "dying"
    ) {
      this.playAnimation(animationName, false, false);
    } else {
      this.playAnimation(animationName, false, true);
    }
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
    // Make sure the nameObj exists and is in the correct position
    if (!this.nameObj) {
      this.nameObj = new THREE.Object3D();
      this.nameObj.position.set(0, 30, 0);
      this.threeObj.add(this.nameObj);
    }
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
    // Properly remove the label
    if (this.nameLabel) {
      if (this.nameLabel.parent) {
        this.nameLabel.parent.remove(this.nameLabel);
      }
      this.nameLabel = null;
    }
    if (this.nameLabelObj && this.nameLabelObj.parent) {
      this.nameLabelObj.parent.remove(this.nameLabelObj);
      this.nameLabelObj = null;
    }
    // Stop firing when cleaning up
    this.stopShooting();
  }
}

// Then AFTER the Player class, add the exports:
let labelRenderer = null;

export function initLabelRenderer() {
  if (labelRenderer) return;
  labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.domElement.style.position = "absolute";
  labelRenderer.domElement.style.top = "0px";
  labelRenderer.domElement.style.left = "0px";
  labelRenderer.domElement.style.pointerEvents = "none";
  document.body.appendChild(labelRenderer.domElement);
  console.log("Label renderer initialized");
}

export function renderLabels(scene, camera) {
  if (labelRenderer) {
    labelRenderer.render(scene, camera);
  }
}
