import * as THREE from "three";
import { MeshBVH, acceleratedRaycast } from "three-mesh-bvh";
import { Capsule } from "three/examples/jsm/math/Capsule.js";
import { createExplosion, updateExplosionTime } from "./Explosion.js";

THREE.Mesh.prototype.raycast = acceleratedRaycast;

export class PointerLockControlsCustom {
  constructor(camera, player, world) {
    this.isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      );

    this.enabled = false;
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.isOnObject = false;
    this.canJump = false;
    this.velocity = new THREE.Vector3();
    this.moveDirection = new THREE.Vector3();
    this.caster = new THREE.Raycaster();
    this.PI_2 = Math.PI / 2;

    this.isInWater = false;

    this._isShootingAnimation = false;
    this._shootingAnimTimer = null;

    // Movement speeds
    this.walkSpeed = 0.6;
    this.runSpeed = 1.2;
    this.isRunning = false;

    this.spineBone = null;
    this.spineTargetRotation = 0;

    this.buildingCollisionRadius = 8; // Adjust based on player size
    this.tempVector = new THREE.Vector3();

    // Shooting properties
    this.isShooting = false;
    this.shootingCooldown = false;
    this.shootCooldownTime = 200; // ms between shots
    this.shootAnimationTime = 300; // ms for animation to play

    // Third-person camera properties
    this.cameraOffset = new THREE.Vector3(0, 10, 25);
    this.cameraSmoothing = 0.15;
    this.cameraRotation = new THREE.Vector2(0, 0.3);
    this.cameraDistance = 25; // Explicit camera distance
    this.cameraHeight = 8; // Height above player

    // Camera collision properties
    this.minCameraDistance = 5; // Minimum distance when obstructed
    this.maxCameraDistance = 25; // Normal distance
    this.currentCameraDistance = 25;
    this.cameraCollisionRadius = 2; // Radius for camera collision check

    this.modelBaseRotation = 0;

    this.playerCollider = new Capsule(
      new THREE.Vector3(0, 8, 0),
      new THREE.Vector3(0, 14, 0),
      4,
    );
    this.fpsCameraBone = null;
    this.frontMesh = null;
    this.frontMeshWasVisible = true;

    // Slope handling properties
    this.slopeRaycastDistance = 5; // How far to check for slopes
    this.maxSlopeAngle = 45; // Maximum walkable slope angle in degrees
    this.slopeAdjustSpeed = 0.3; // How fast to adjust to slope
    this.verticalSmoothFactor = 0.2;

    // Add these properties in the constructor
    this.currentWaterZone = null;
    this.currentWaterDirection = new THREE.Vector3(0, 0, 0);

    // Jetpack — GREEBLE MAP ONLY
    this.jetpackActive = false;
    this.jetpackFuel = 100;
    this.maxJetpackFuel = 100;
    this.jetpackThrust = 16;
    this.jetpackFuelDrain = 2;
    this.jetpackFuelRegen = 0.8; // regenerates when on ground
    this.isJetpacking = false;
    this.jetpackWasFiring = false;
    this.attachedJetpackModel = null;
    this.attachedJetpackCylinders = [];

    // Jetpack burst/throttle properties
    this.jetpackBurstCooldown = 0;
    this.jetpackBurstDuration = 0;
    this.maxBurstDuration = 0.5; // Maximum burst time in seconds
    this.burstCooldownTime = 0.3; // Cooldown between bursts in seconds

    // Grenade system
    this.isGrenadeAiming = false;
    this.grenadeThrowPower = 30;
    this.grenadeTrajectoryPoints = [];
    this.grenadePreviewLine = null;

    // Add this property in constructor
    this.currentExplosion = null;
    this.explosionCleanupTimer = null;

    this.currentAnimation = "idle";

    this._inventoryOpen = false;

    this.onMouseMove = (event) => {
      console.log
      if (!this.enabled) return;
      // ✅ Remove any pointer lock check — just use the movement values directly
      // Pointer lock API sets movementX/Y automatically when locked

      const movementX =
        event.movementX || event.mozMovementX || event.webkitMovementX || 0;
      const movementY =
        event.movementY || event.mozMovementY || event.webkitMovementY || 0;

      if (movementX !== 0 || movementY !== 0) {
        this.cameraRotation.x -= movementX * 0.002;
        this.cameraRotation.y -= movementY * 0.002;
        this.cameraRotation.y = Math.max(
          0.1,
          Math.min(this.PI_2 - 0.1, this.cameraRotation.y),
        );
      }
    };

    this.onMouseDown = (event) => {
      if (!this.enabled || this.isTyping()) return;

      if (event.button === 2) {
        if (this.isAiming) {
          this.stopAiming();
        } else {
          this.startAiming();
        }
      } else if (event.button === 0) {
        if (this.isAiming && this.player && this.player.modelLoaded) {
          this.player.startShooting();

          if (this.player.currentAnimation !== "reloading") {
            const isMoving =
              Math.abs(this.velocity.x) > 0.05 ||
              Math.abs(this.velocity.z) > 0.05;

            // Clear any existing timer
            if (this._shootingAnimTimer) {
              clearTimeout(this._shootingAnimTimer);
            }

            this._isShootingAnimation = true;

            if (isMoving && this.isRunning) {
              this.player.playAnimation("firingRun", true);
            } else if (isMoving) {
              this.player.playAnimation("firingWalk", true);
            } else {
              this.player.playAnimation("firing", true);
            }
          }
        }
      }
    };

    // Update onMouseUp:
    this.onMouseUp = (event) => {
      if (event.button === 0) {
        if (this.player) {
          this.player.stopShooting();
        }

        // Reset animation after a short delay to let the last firing animation play
        if (this._shootingAnimTimer) {
          clearTimeout(this._shootingAnimTimer);
        }
        this._shootingAnimTimer = setTimeout(() => {
          this._isShootingAnimation = false;
          if (this.player && this.player.modelLoaded) {
            const currentAnim = this.player.currentAnimation;
            if (
              currentAnim === "firing" ||
              currentAnim === "firingWalk" ||
              currentAnim === "firingRun"
            ) {
              const isMoving =
                Math.abs(this.velocity.x) > 0.01 ||
                Math.abs(this.velocity.z) > 0.01;
              if (isMoving) {
                this.player.playAnimation(
                  this.isRunning ? "run" : "walk",
                  true,
                );
              } else {
                this.player.playAnimation("idle", true);
              }
            }
          }
        }, 300); // Short delay to let muzzle flash finish
      }
      if (event.button === 2) {
        // Don't stop aiming here
      }
    };

    this.onKeyDown = (event) => {
      if (window.isGameActive === false) return;

      if (this.isTyping()) return;

      switch (event.code) {
        case "ArrowUp":
        case "KeyW":
          this.moveForward = true;
          break;
        case "ArrowLeft":
        case "KeyA":
          this.moveLeft = true;
          break;
        case "ArrowDown":
        case "KeyS":
          this.moveBackward = true;
          break;
        case "ArrowRight":
        case "KeyD":
          this.moveRight = true;
          break;
        case "ShiftLeft":
        case "ShiftRight":
          this.isRunning = true;
          break;
        case "Space":
          const isGreebleMap =
            this.world.mapManager?.currentMap === "greeble_map";

          if (isGreebleMap && this.jetpackActive && this.jetpackFuel > 0) {
            this.isJetpacking = true;
            event.preventDefault();
          } else if (!this.jumpCooldown) {
            if (this.isOnObject || this.canJump) {
              this.player.playAnimation("ready", true);
              this.velocity.y = 1.1;
              this.isOnObject = false;
              this.canJump = false;
              this.jumpCooldown = true;
              setTimeout(() => {
                this.jumpCooldown = false;
              }, this.jumpCooldownTime);
            }
          }
          break;
        case "KeyF":
          if (this.isAiming) {
            this.stopAiming();
          } else {
            this.startAiming();
          }
          break;
        case "KeyR":
          this.reload();
          break;
        case "KeyQ":
          this.toggleWeaponWheel();
          break;
        case "KeyE":
          if (this.weaponWheelOpen) {
            this.cycleWeaponWheel(1);
          } else if (this.player) {
            const nextIndex =
              (this.player.currentWeaponIndex + 1) % this.player.weapons.length;
            // Play ready animation, switch weapon after it completes
            this.player.playAnimation("ready", false, false);
            setTimeout(() => {
              this.player.switchWeapon(nextIndex, true);
            }, 600); // Wait for ready animation to play out
          }
          break;
        case "KeyG":
          if (event.repeat) return;
          if (!this.player || !this.player.modelLoaded || !this.isAiming) break;

          if (this.isGrenadeAiming) {
            // Cancel grenade mode
            this.isGrenadeAiming = false;
            // ✅ Hide and clean up preview line
            if (this.grenadePreviewLine && this.grenadePreviewLine.parent) {
              this.world.scene.remove(this.grenadePreviewLine);
              this.grenadePreviewLine = null;
            }
            if (this._grenadeLandingMarker) {
              this._grenadeLandingMarker.visible = false;
            }
            this._lastGrenadeDirKey = null;
          } else {
            // Enter grenade mode
            this.isGrenadeAiming = true;
            this.player.playAnimation("idle", true);
            if (this._grenadeLandingMarker) {
              this._grenadeLandingMarker.visible = false;
            }
          }
          break;

        case "KeyV": // Press V to cycle camera modes
          this.cycleCameraMode();
          break;
        default:
          if (event.code.startsWith("Digit") && this.player) {
            const digit = parseInt(event.code.slice(5));
            if (digit >= 1 && digit <= this.player.weapons.length) {
              const weaponIndex = digit - 1;
              this.player.playAnimation("ready", false, false);
              setTimeout(() => {
                this.player.switchWeapon(weaponIndex, true);
              }, 600);
            }
          }
          break;
      }
    };

    this.onKeyUp = (event) => {
      if (window.isGameActive === false) return;

      if (this.isTyping()) return;
      switch (event.code) {
        case "ArrowUp":
        case "KeyW":
          this.moveForward = false;
          break;
        case "ArrowLeft":
        case "KeyA":
          this.moveLeft = false;
          break;
        case "ArrowDown":
        case "KeyS":
          this.moveBackward = false;
          break;
        case "ArrowRight":
        case "KeyD":
          this.moveRight = false;
          break;
        case "ShiftLeft":
        case "ShiftRight":
          this.isRunning = false;
          break;
        case "Space":
          this.isJetpacking = false;
          break;
        case "KeyT":
          if (event.repeat) return;
          if (this.isGrenadeAiming) {
            this.isGrenadeAiming = false;
            // ✅ Clean up preview
            if (this.grenadePreviewLine && this.grenadePreviewLine.parent) {
              this.world.scene.remove(this.grenadePreviewLine);
              this.grenadePreviewLine = null;
            }
            if (this._grenadeLandingMarker) {
              this._grenadeLandingMarker.visible = false;
            }
            this._lastGrenadeDirKey = null;
            this.throwGrenade();
          }
          break;
      }
    };

    this.camera = camera;
    this.player = player;
    this.world = world;
    this.playerObj = this.player.getThreeObj();

    // ✅ Safely create capsule after player model loads
    this.createPlayerCapsule();

    this.canJump = true; // Start as true so first jump works
    this.jumpCooldown = false;
    this.jumpCooldownTime = 500; // 1/2 second cooldown (adjust as needed)

    this.blocker = document.getElementById("blocker");
    this.instructions = document.getElementById("instructions");
    this.unlockButton = document.getElementById("btnStart");

    this.createWeaponWheelUI();

    this.updateCameraPosition(0);
    this.init();

    this.leftShoulder = null;
    this.rightShoulder = null;
    this._originalLeftShoulderRot = null;
    this._originalRightShoulderRot = null;

    // Add these properties for mobile optimization
    this.useBVH = true; // Use BVH on all devices
    this.collisionIterations = this.isMobile ? 1 : 3; // Fewer iterations on mobile
    this.collisionFrameCounter = 0; // Separate counter for collision skipping
    this.collisionFrameSkip = this.isMobile ? 2 : 1; // Skip frames on mobile

    this._inverseMatTemp = new THREE.Matrix4();
    this._localStartTemp = new THREE.Vector3();
    this._localEndTemp = new THREE.Vector3();

    this._grenadePreviewGeo = new THREE.BufferGeometry();
    this._grenadePreviewMat = new THREE.LineBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.7,
      depthTest: false,
    });
    this.grenadePreviewLine = new THREE.Line(
      this._grenadePreviewGeo,
      this._grenadePreviewMat,
    );
    this.grenadePreviewLine.visible = false;

    if (!this.isMobile) {
      this.spineInterval = setInterval(() => {
        if (this.spineBone && this.enabled) {
          this.spineBone.rotation.x +=
            (this.spineTargetRotation - this.spineBone.rotation.x) * 0.2;
        }
      }, 16);
    } else {
      this.spineInterval = null;
      console.log("Spine rotation disabled on mobile");
    }
    // Camera mode
    this.cameraMode = "thirdPerson"; // "thirdPerson" or "shoulder"
    this.shoulderOffset = new THREE.Vector3(2, 1.5, 3); // Right shoulder offset, or "fps"
    this.fpsCameraOffset = new THREE.Vector3(0, 0.15, 0.25); // x=left/right, y=up/down, z=forward offset

    this.isAiming = false;
    this.aimFOV = 60;
    this.normalFOV = 75;
    this.targetFOV = this.normalFOV;
    this.aimShoulderOffset = new THREE.Vector3(5.5, 19.8, 4); // right shoulder
    this.aimTransitionSpeed = 0.12;

    // Add with other properties
    this.groundSnapHeight = 0.5;
    this.groundSnapCooldown = 0;
    this.lastGroundY = null;
    this.stableGroundCounter = 0;
    this.verticalVelocityLimit = 5;

    this.currentWaterZone = null;
    this.currentWaterDirection = new THREE.Vector3(0, 0, 0);

    this.frameCounter = 0;
  }

  findFPSBone() {
    if (!this.player || !this.player.modelLoaded) return;

    const model = this.player.pitchObj.children[0];
    if (!model) return;

    // Try multiple possible bone names for FPS camera attachment
    const boneNames = [
      "mixamorigSpine2",
      "mixamorigSpine1",
      "mixamorigHead",
      "Head",
      "mixamorigNeck",
      "Neck",
      "Camera_socket",
      "camera_attach",
    ];

    for (const name of boneNames) {
      const bone = model.getObjectByName(name);
      if (bone && bone.isBone) {
        this.fpsCameraBone = bone;
        console.log("✅ FPS camera bone found:", name);
        break;
      }
    }

    // If no bone found, find any head/spine bone
    if (!this.fpsCameraBone) {
      model.traverse((obj) => {
        if (obj.isBone) {
          const name = obj.name.toLowerCase();
          if (
            name.includes("head") ||
            name.includes("neck") ||
            name.includes("spine2") ||
            name.includes("spine1")
          ) {
            if (!this.fpsCameraBone) {
              this.fpsCameraBone = obj;
              console.log("✅ Fallback FPS bone found:", obj.name);
            }
          }
        }
      });
    }

    // Find arm meshes to keep visible
    this.findFrontMesh();
  }

  findFrontMesh() {
    if (!this.player || !this.player.modelLoaded) return;

    const model = this.player.pitchObj.children[0];
    if (!model) return;

    // Find just the front mesh
    model.traverse((obj) => {
      if (obj.isMesh) {
        const name = obj.name.toLowerCase();
        // Look for front/face mesh
        if (
          name === "front" ||
          name.includes("front") ||
          name === "face" ||
          name.includes("face") ||
          name === "head_front"
        ) {
          this.frontMesh = obj;
          console.log("✅ Front mesh found:", obj.name);
        }
      }
    });
  }

  // Simplified setupFPSMode - only hide front mesh
  setupFPSMode() {
    if (!this.fpsCameraBone) {
      this.findFPSBone();
    }

    // Find front mesh if not found
    if (!this.frontMesh) {
      this.findFrontMesh();
    }

    // Make sure we have spine bone for vertical look
    if (!this.spineBone) {
      this.findSpineBone();
    }

    // Parent camera to bone (spine2 or head)
    if (this.fpsCameraBone) {
      // Store original camera position in scene
      if (this.camera.parent) {
        this.camera.parent.remove(this.camera);
      }

      // Add camera to bone
      this.fpsCameraBone.add(this.camera);

      // Position camera at eye level relative to the bone
      // These values need tuning based on your model
      const boneName = this.fpsCameraBone.name.toLowerCase();
      if (boneName.includes("spine2")) {
        // Spine2 is lower, need to offset up to eye level
        this.camera.position.set(0.033, 1.3, -0.02);
        this.camera.rotation.set(0, Math.PI + (45 * Math.PI) / 180, 0);
        this.camera.rotation.z = 0;
        this.camera.rotation.x = 0;
      } else {
        this.camera.position.set(0, 0.5, -0.1);
      }

      console.log("✅ FPS camera attached to bone:", this.fpsCameraBone.name);
      console.log("Camera offset:", this.camera.position);
    } else {
      console.warn("⚠️ No FPS bone found");
    }

    // Hide ONLY the front mesh, keep everything else visible
    if (this.frontMesh) {
      this.frontMesh.visible = false;
      console.log("✅ Front mesh hidden for FPS mode");
    }

    this.frontMeshWasVisible = this.frontMesh ? this.frontMesh.visible : true;
  }

  cleanupFPSMode() {
    // Remove camera from bone
    if (this.fpsCameraBone && this.camera.parent === this.fpsCameraBone) {
      this.fpsCameraBone.remove(this.camera);
      // Add camera back to scene
      if (this.world && this.world.scene) {
        this.world.scene.add(this.camera);
      }
    }

    // Restore ONLY the front mesh visibility
    if (this.frontMesh) {
      this.frontMesh.visible = true;
      console.log("✅ Front mesh restored");
    }
  }

  activateJetpack(fuelAmount = null) {
    console.log("activateJetpack called - current state:", this.jetpackActive);

    if (!this.jetpackActive) {
      this.jetpackActive = true;
      this.jetpackFuel = fuelAmount !== null ? fuelAmount : this.maxJetpackFuel;
      this._jetpackOutOfFuel = false;
      console.log("✅ Jetpack activated! Fuel:", this.jetpackFuel);

      if (window.roomManager?.showNotification) {
        window.roomManager.showNotification(
          "🚀 JETPACK ACQUIRED! Hold SPACE to fly!",
          "#00aaff",
        );
      }
      this.updateJetpackUI();

      // Trigger attachment through world
      if (this.world && this.world._attachJetpackToPlayer) {
        console.log("Triggering jetpack model attachment");
        this.world._attachJetpackToPlayer();
      }
    } else if (fuelAmount !== null) {
      // Refuel existing jetpack
      this.jetpackFuel = Math.min(
        this.jetpackFuel + fuelAmount,
        this.maxJetpackFuel,
      );
      console.log("Jetpack refueled to:", this.jetpackFuel);
      if (window.roomManager?.showNotification) {
        window.roomManager.showNotification(
          `⛽ JETPACK REFUELED +${fuelAmount}%`,
          "#00ffaa",
        );
      }
      this.updateJetpackUI();
    }
  }

  deactivateJetpack() {
    this.jetpackActive = false;
    this.isJetpacking = false;
    this.jetpackFuel = 0;
  }

  // ----------------------------
  // New method for safe capsule creation
  // ----------------------------
  createPlayerCapsule() {
    if (this.player && this.player.modelLoaded && this.playerObj) {
      const box = new THREE.Box3().setFromObject(this.playerObj);
      const size = new THREE.Vector3();
      box.getSize(size);

      if (this.player && this.player.modelLoaded && !this.fpsCameraBone) {
        this.findFPSBone();
        this.findFrontMesh(); // Also find front mesh
      }

      // Make sure box has valid numbers
      if (isNaN(size.x) || isNaN(size.y) || isNaN(size.z)) {
        console.warn("Player bounding box not ready yet, retrying...");
        setTimeout(() => this.createPlayerCapsule(), 100);
        return;
      }

      const radius = Math.max(size.x, size.z) / 2;
      const start = new THREE.Vector3(0, box.min.y, 0);
      const end = new THREE.Vector3(0, box.max.y, 0);

      this.playerCollider = new Capsule(start.clone(), end.clone(), radius);
      console.log("Capsule radius:", radius, "height:", size.y);

      const capsuleGeo = new THREE.CylinderGeometry(
        radius,
        radius,
        end.y - start.y,
        16,
      );
      const capsuleMat = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        wireframe: true,
        visible: false,
      });
      this.capsuleMesh = new THREE.Mesh(capsuleGeo, capsuleMat);
      this.world.scene.add(this.capsuleMesh);
    } else {
      // Retry in 100ms if model not loaded yet
      setTimeout(() => this.createPlayerCapsule(), 100);
    }
  }

  ensureSpineBone() {
    if (!this.spineBone && this.player?.modelLoaded) {
      this.findSpineBone();
    }
  }

  enforceMapBoundary() {
    // Skip boundary enforcement for greeble map
    if (this.world.mapManager?.currentMap === "greeble_map") return;

    if (!this.world.barrierData) return;

    const barrier = this.world.barrierData;
    const playerPos = this.playerObj.position;

    // Calculate horizontal distance from center
    const dx = playerPos.x - barrier.center.x;
    const dz = playerPos.z - barrier.center.z;
    const horizontalDist = Math.sqrt(dx * dx + dz * dz);

    // Calculate height above ground
    const heightAboveGround = playerPos.y - barrier.groundLevel;

    // For a dome, the allowed radius at a given height follows the circle equation:
    // r^2 = x^2 + y^2, so x = sqrt(r^2 - y^2)
    // But since our dome is a hemisphere, we need to ensure we don't go above the dome

    const margin = 3; // Keep player inside with a small margin

    // Check if player is above the dome (shouldn't happen, but just in case)
    if (heightAboveGround > barrier.radius - margin) {
      playerPos.y = barrier.groundLevel + (barrier.radius - margin);
      if (this.velocity.y > 0) {
        this.velocity.y = 0;
      }
    }

    // Calculate maximum allowed horizontal distance at this height
    // Using circle equation: maxDist = sqrt(radius^2 - height^2)
    // But ensure we don't take sqrt of negative number
    let maxHorizontalDist;
    if (heightAboveGround < 0) {
      // Below ground - use full radius
      maxHorizontalDist = barrier.radius;
    } else if (heightAboveGround >= barrier.radius) {
      // Above dome - shouldn't happen, but clamp to 0
      maxHorizontalDist = 0;
    } else {
      maxHorizontalDist = Math.sqrt(
        Math.pow(barrier.radius, 2) - Math.pow(heightAboveGround, 2),
      );
    }

    // Check if player is outside the dome horizontally
    if (horizontalDist > maxHorizontalDist - margin) {
      // Push player back inside
      const angle = Math.atan2(dz, dx);
      const newHorizontalDist = Math.max(0, maxHorizontalDist - margin);

      playerPos.x = barrier.center.x + Math.cos(angle) * newHorizontalDist;
      playerPos.z = barrier.center.z + Math.sin(angle) * newHorizontalDist;

      // Cancel outward velocity
      const outwardDir = new THREE.Vector3(dx, 0, dz).normalize();
      const velDot = this.velocity.dot(outwardDir);
      if (velDot > 0) {
        this.velocity.addScaledVector(outwardDir, -velDot);
      }
    }

    // Ground collision (keep player from falling through)
    if (playerPos.y < barrier.groundLevel) {
      playerPos.y = barrier.groundLevel;
      this.velocity.y = Math.max(0, this.velocity.y);
      this.isOnObject = true;
      this.canJump = true;
    }
  }

  // Add reload method
  reload() {
    if (!this.enabled) return;

    if (this.player && this.player.modelLoaded) {
      const currentAnim = this.player.currentAnimation;
      if (
        currentAnim === "reloading" ||
        currentAnim === "reloadingWalk" ||
        currentAnim === "reloadingRun"
      )
        return;

      console.log("Velocity at reload:", this.velocity.x, this.velocity.z);

      this._reloadIsMoving =
        Math.abs(this.velocity.x) > 0.01 || Math.abs(this.velocity.z) > 0.01;
      this._reloadIsRunning = this.isRunning;

      console.log(
        `Reload triggered — moving: ${this._reloadIsMoving}, running: ${this._reloadIsRunning}`,
      );

      this.player.reloadWeapon();
    }
  }

  createHitEffect(position) {
    const geometry = new THREE.SphereGeometry(2, 8, 8);
    const material = new THREE.MeshBasicMaterial({ color: 0xff5500 });
    const effect = new THREE.Mesh(geometry, material);
    effect.position.copy(position);

    this.world.scene.add(effect);

    setTimeout(() => {
      this.world.scene.remove(effect);
      geometry.dispose();
      material.dispose();
    }, 200);
  }

  isTyping() {
    const activeElement = document.activeElement;
    if (!activeElement) return false;
    return (
      activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA"
    );
  }

  focusMessage() {
    const messageInput = document.getElementById("txtMessage");
    if (messageInput) messageInput.focus();
  }

  blurMessage() {
    const messageInput = document.getElementById("txtMessage");
    if (messageInput) messageInput.blur();
  }

  getObject() {
    return this.playerObj;
  }

  isOnObjectSetter(bool) {
    this.isOnObject = bool;
    this.canJump = bool;
  }

  // applySpineRotation() {
  //   if (!this.spineBone) return;

  //   // Apply rotation on the appropriate axis
  //   if (this.spineUseZAxis) {
  //     // Use Z axis for idle and firing animations
  //     this.spineBone.rotation.z +=
  //       (this.spineTargetRotation - this.spineBone.rotation.z) * 0.8;

  //     if (
  //       Math.abs(this.spineBone.rotation.z - this.spineTargetRotation) < 0.01
  //     ) {
  //       this.spineBone.rotation.z = this.spineTargetRotation;
  //     }

  //     // Reset X axis when using Z
  //     this.spineBone.rotation.x = 0;
  //   } else {
  //     // Use X axis for other animations (walk, run, reloading, etc.)
  //     // INVERTED: multiply by -1 to fix direction
  //     const invertedTarget = -this.spineTargetRotation;

  //     this.spineBone.rotation.x +=
  //       (invertedTarget - this.spineBone.rotation.x) * 0.8;

  //     if (Math.abs(this.spineBone.rotation.x - invertedTarget) < 0.01) {
  //       this.spineBone.rotation.x = invertedTarget;
  //     }

  //     // Reset Z axis when using X
  //     this.spineBone.rotation.z = 0;
  //   }

  //   // Keep Y axis at 0 for both cases
  //   this.spineBone.rotation.y = 0;

  //   this.spineBone.updateMatrix();
  // }

  applySpineRotation() {
    if (!this.spineBone) return;

    if (this.cameraMode === "fps") {
      // FPS mode: only X axis rotation, Y and Z always zero
      this.spineBone.rotation.x +=
        (this.spineTargetRotation - this.spineBone.rotation.x) * 0.8;

      if (
        Math.abs(this.spineBone.rotation.x - this.spineTargetRotation) < 0.01
      ) {
        this.spineBone.rotation.x = this.spineTargetRotation;
      }

      this.spineBone.rotation.y = 0;
      this.spineBone.rotation.z = 0;
      this.spineBone.updateMatrix();
      return;
    }

    // All other modes: original axis logic
    if (this.spineUseZAxis) {
      this.spineBone.rotation.z +=
        (this.spineTargetRotation - this.spineBone.rotation.z) * 0.8;

      if (
        Math.abs(this.spineBone.rotation.z - this.spineTargetRotation) < 0.01
      ) {
        this.spineBone.rotation.z = this.spineTargetRotation;
      }

      this.spineBone.rotation.x = 0;
    } else {
      const invertedTarget = -this.spineTargetRotation;

      this.spineBone.rotation.x +=
        (invertedTarget - this.spineBone.rotation.x) * 0.8;

      if (Math.abs(this.spineBone.rotation.x - invertedTarget) < 0.01) {
        this.spineBone.rotation.x = invertedTarget;
      }

      this.spineBone.rotation.z = 0;
    }

    this.spineBone.rotation.y = 0;
    this.spineBone.updateMatrix();
  }

  // Also add this method to find spine bone when model changes:
  findSpineBone() {
    if (!this.player || !this.player.modelLoaded) return;

    const model = this.player.pitchObj.children[0];
    if (!model) return;

    // Try all possible spine bone names
    const spineNames = [
      "mixamorigSpine2",
      "mixamorigSpine",
      "Spine1",
      "Spine",
      "mixamorigSpine1",
      "Spine2",
      "Spine3",
    ];

    for (const name of spineNames) {
      const spine = model.getObjectByName(name);
      if (spine) {
        this.spineBone = spine;
        console.log("Spine bone found:", name);

        // Store original rotation properties
        if (!this.originalSpineProps) {
          this.originalSpineProps = {
            rotation: spine.rotation.clone(),
          };
        }
        break;
      }
    }
  }

  findHeadBone() {
    if (!this.player || !this.player.modelLoaded) return;

    const model = this.player.pitchObj.children[0];
    if (!model) return;

    this.headBone =
      model.getObjectByName("mixamorigHead") ||
      model.getObjectByName("Head") ||
      model.getObjectByName("mixamorigNeck") ||
      model.getObjectByName("Neck");

    if (this.headBone) {
      console.log("Head bone found for FPS mode:", this.headBone.name);
    }
  }

  ensureSpineBoneAndAttach() {
    if (!this.spineBone && this.player?.modelLoaded) {
      this.findSpineBone();
    }
    return this.spineBone;
  }

  updateSpineRotation() {
    if (!this.player || !this.player.modelLoaded) return;

    // Check what animation is currently playing
    const currentAnim = this.player.currentAnimation;

    // Determine which axis to use based on animation
    const useZAiming = currentAnim === "idle" || currentAnim === "firing";

    if (this.isAiming) {
      if (!this.spineBone) {
        this.findSpineBone();
        return;
      }

      if (!this.spineBone.parent) {
        this.spineBone = null;
        return;
      }

      // Get camera vertical rotation
      const camY = this.cameraRotation.y;
      const minCam = 0.1;
      const maxCam = this.PI_2 - 0.1;

      // Convert camera angle to a range from 0 to 1
      const t = (camY - minCam) / (maxCam - minCam);

      // Map to spine rotation range: +30° up to -70° down
      const maxUpAngle = (30 * Math.PI) / 180;
      const maxDownAngle = (-70 * Math.PI) / 180;

      // Calculate target rotation
      const targetRotation = maxUpAngle + t * (maxDownAngle - maxUpAngle);

      // Store which axis to use
      this.spineUseZAxis = useZAiming;
      this.spineTargetRotation = targetRotation;
    } else {
      if (!this.spineBone) {
        this.findSpineBone();
        return;
      }

      if (!this.spineBone.parent) {
        this.spineBone = null;
        return;
      }

      const minCam = 0.1;
      const maxCam = this.PI_2 - 0.1;
      const deadzoneLow = 0.6;
      const deadzoneHigh = 1.0;

      let targetRotation = 0;

      if (this.cameraRotation.y < deadzoneLow) {
        const t =
          (deadzoneLow - this.cameraRotation.y) / (deadzoneLow - minCam);
        const clampedT = Math.max(0, Math.min(1, t));
        const maxUpAngle = (30 * Math.PI) / 180;
        targetRotation = maxUpAngle * clampedT;
      } else if (this.cameraRotation.y > deadzoneHigh) {
        const t =
          (this.cameraRotation.y - deadzoneHigh) / (maxCam - deadzoneHigh);
        const clampedT = Math.max(0, Math.min(1, t));
        const maxDownAngle = (-70 * Math.PI) / 180;
        targetRotation = maxDownAngle * clampedT;
      } else {
        targetRotation = 0;
      }

      this.spineUseZAxis = useZAiming;
      this.spineTargetRotation = targetRotation;
    }
  }

  update(delta) {
    if (!this.enabled) return;

    // Skip all movement/controls when inventory is open
    if (this._inventoryOpen) {
      this.moveForward = false;
      this.moveBackward = false;
      this.moveLeft = false;
      this.moveRight = false;
      this.velocity.x *= 0.85;
      this.velocity.z *= 0.85;
      return;
    }

    // ✅ SNAP PLAYER BODY TO CAMERA DIRECTION AT START OF FRAME
    // This ensures movement calculations use the correct facing direction
    if (
      this.isAiming ||
      this.cameraMode === "shoulder" ||
      this.cameraMode === "fps"
    ) {
      const camYaw = this.cameraRotation.x;
      let angleDiff = camYaw - this.playerObj.rotation.y;
      angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
      // ✅ Fast snap when aiming — 0.3 instead of 0.15
      this.playerObj.rotation.y += angleDiff * 0.3;
    }

    // Try to find spine bone on every frame until found
    if (!this.spineBone && this.player?.modelLoaded) {
      this.findSpineBone();
      if (this.spineBone) {
        console.log("✅ Spine bone found in update loop:", this.spineBone.name);
      }
    }

    if (
      !this.headBone &&
      this.player?.modelLoaded &&
      this.cameraMode === "fps"
    ) {
      this.findHeadBone();
    }

    // Store original delta for jetpack BEFORE modifying it
    const originalDelta = Math.min(delta, 0.1);

    // Skip expensive operations on mobile
    const skipSpine = this.isMobile;

    const isGreebleMap = this.world.mapManager?.currentMap === "greeble_map";

    delta *= 0.1;

    // Limit vertical velocity to prevent bouncing
    this.velocity.y = Math.max(
      -this.verticalVelocityLimit,
      Math.min(this.verticalVelocityLimit, this.velocity.y),
    );

    const wasMoving =
      Math.abs(this.velocity.x) > 0.01 || Math.abs(this.velocity.z) > 0.01;

    // ─── MOVEMENT DIRECTION ───────────────────────
    this.moveDirection.set(0, 0, 0);

    // When aiming, movement should be relative to where the player is facing (camera direction)
    // When not aiming, movement is relative to camera orbit
    // const movementAngle = this.isAiming
    //   ? this.playerObj.rotation.y
    //   : this.cameraRotation.x;

    const movementAngle = this.cameraRotation.x;

    const cameraForward = new THREE.Vector3(0, 0, -1).applyEuler(
      new THREE.Euler(0, movementAngle, 0),
    );
    cameraForward.y = 0;
    cameraForward.normalize();
    const cameraRight = new THREE.Vector3(1, 0, 0).applyEuler(
      new THREE.Euler(0, movementAngle, 0),
    );
    cameraRight.y = 0;
    cameraRight.normalize();

    if (this.moveForward) this.moveDirection.add(cameraForward);
    if (this.moveBackward) this.moveDirection.sub(cameraForward);
    if (this.moveLeft) this.moveDirection.sub(cameraRight);
    if (this.moveRight) this.moveDirection.add(cameraRight);

    // const currentSpeed = this.isAiming
    //   ? this.walkSpeed * 0.5 // Slow strafe while aimed
    //   : this.isRunning
    //   ? this.runSpeed
    //   : this.walkSpeed;
    const currentSpeed = this.isAiming
      ? this.isRunning
        ? this.runSpeed
        : this.walkSpeed // Full speed while aiming
      : this.isRunning
      ? this.runSpeed
      : this.walkSpeed;

    // if (this.moveDirection.length() > 0) {
    //   this.moveDirection.normalize();

    //   // Always face the movement direction when not aiming
    //   // When aiming, the player already faces the camera (handled in updateCameraPosition)
    //   if (!this.isAiming) {
    //     const targetAngle = Math.atan2(
    //       this.moveDirection.x,
    //       this.moveDirection.z,
    //     );
    //     const adjustedTargetAngle = targetAngle + Math.PI;
    //     let angleDiff = adjustedTargetAngle - this.playerObj.rotation.y;
    //     angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
    //     this.playerObj.rotation.y += angleDiff * 0.1;
    //   }

    if (this.moveDirection.length() > 0) {
      this.moveDirection.normalize();

      if (!this.isAiming) {
        const targetAngle = Math.atan2(
          this.moveDirection.x,
          this.moveDirection.z,
        );
        const adjustedTargetAngle = targetAngle + Math.PI;
        let angleDiff = adjustedTargetAngle - this.playerObj.rotation.y;
        angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
        this.playerObj.rotation.y += angleDiff * 0.1;
      }

      // 👇 Block movement entirely when grenade aiming
      if (!this.isGrenadeAiming && !this.player.throwInProgress) {
        const targetVelX = this.moveDirection.x * currentSpeed;
        const targetVelZ = this.moveDirection.z * currentSpeed;
        this.velocity.x += (targetVelX - this.velocity.x) * 0.1;
        this.velocity.z += (targetVelZ - this.velocity.z) * 0.1;
      } else {
        this.velocity.x *= 0.85; // bleed off existing momentum
        this.velocity.z *= 0.85;
      }

      // const targetVelX = this.moveDirection.x * currentSpeed;
      // const targetVelZ = this.moveDirection.z * currentSpeed;
      // this.velocity.x += (targetVelX - this.velocity.x) * 0.1;
      // this.velocity.z += (targetVelZ - this.velocity.z) * 0.1;
    } else {
      this.velocity.x *= 0.92;
      this.velocity.z *= 0.92;
    }

    // ─── AIM BODY ROTATION ────────────────────────

    // ─── GRENADE AIM PREVIEW ─────────────────────
    if (this.isGrenadeAiming) {
      this.updateGrenadePreview();
    }
    // In the jetpack section, add hover stabilization
    if (isGreebleMap && this.jetpackActive) {
      if (this.isJetpacking && this.jetpackFuel > 0) {
        // Check burst cooldown
        if (this.jetpackBurstCooldown > 0) {
          this.jetpackBurstCooldown -= originalDelta;
          // Can't thrust while on cooldown
        } else if (this.jetpackBurstDuration < this.maxBurstDuration) {
          // Allow thrusting within burst limit
          if (this.jetpackFuel > 0) {
            this.jetpackBurstDuration += originalDelta;

            // ── DRAIN FUEL ────────────────────────────────────────
            this.jetpackFuel -= this.jetpackFuelDrain * originalDelta;
            if (this.jetpackFuel < 0) this.jetpackFuel = 0;

            // ── THRUST DIRECTION ──────────────────────────────────
            const thrustDir = new THREE.Vector3();
            const forward = new THREE.Vector3(
              -Math.sin(this.cameraRotation.x),
              0,
              -Math.cos(this.cameraRotation.x),
            );
            const right = new THREE.Vector3(
              Math.cos(this.cameraRotation.x),
              0,
              -Math.sin(this.cameraRotation.x),
            );

            if (this.moveForward) thrustDir.add(forward);
            if (this.moveBackward) thrustDir.sub(forward);
            if (this.moveLeft) thrustDir.sub(right);
            if (this.moveRight) thrustDir.add(right);

            thrustDir.y += 0.6;
            thrustDir.normalize();

            const thrustPower = 14;
            this.velocity.addScaledVector(
              thrustDir,
              thrustPower * originalDelta,
            );
            this.velocity.multiplyScalar(0.985);

            const maxSpeed = 7;
            if (this.velocity.length() > maxSpeed)
              this.velocity.setLength(maxSpeed);

            if (
              !this.moveForward &&
              !this.moveBackward &&
              !this.moveLeft &&
              !this.moveRight
            ) {
              this.velocity.y *= 0.9;
            }

            if (
              this.player?.modelLoaded &&
              this.player.currentAnimation !== "ready"
            ) {
              this.player.playAnimation("ready", true);
            }
          }
        } else {
          // Burst limit reached, force stop jetpacking
          this.isJetpacking = false;
          this.jetpackBurstCooldown = this.burstCooldownTime;
        }
      } else if (this.isJetpacking && this.jetpackFuel <= 0) {
        this.isJetpacking = false;
        this._jetpackOutOfFuel = true;
        if (window.roomManager?.showNotification) {
          window.roomManager.showNotification(
            "⚠️ JETPACK OUT OF FUEL!",
            "#ff6600",
          );
        }
      } else {
        // Reset burst duration when not jetpacking
        if (this.jetpackBurstDuration > 0 && !this.isJetpacking) {
          this.jetpackBurstDuration = 0;
        }

        this.velocity.y -= 0.04 * originalDelta;
        this.velocity.multiplyScalar(0.992);
      }

      if (this.frameCounter % 30 === 0) this.updateJetpackUI();
    }
    const usingJetpack =
      isGreebleMap &&
      this.jetpackActive &&
      this.isJetpacking &&
      this.jetpackFuel > 0;

    if (this.isInWater) {
      // No gravity in water — applyWaterPhysics locks Y directly
      this.velocity.y = 0;
    } else if (!usingJetpack) {
      this.velocity.y -= 0.45 * originalDelta; // normal gravity
    } else {
      this.velocity.y -= 0.05 * originalDelta; // lighter gravity while flying
    }

    // ─── MOVE PLAYER ONCE ─────────────────────────
    if (this.isInWater) {
      // Only apply horizontal movement in water — Y is controlled entirely by applyWaterPhysics
      this.playerObj.position.x += this.velocity.x;
      this.playerObj.position.z += this.velocity.z;
      // Y is set directly in applyWaterPhysics — never touched here
    } else {
      this.playerObj.position.add(this.velocity);
    }

    // ─── GROUND + WORLD COLLISIONS ────────────────
    this.checkCollisions(); // ✅ ground check — sets isOnObject/canJump

    this.checkWaterCollision();
    this.applyWaterPhysics(originalDelta);

    // ─── BUILDING COLLISIONS - Use BVH on ALL devices with optimization ─────
    this.resolveBuildingCollisionsOptimized();

    // ─── SYNC ─────────────────────────────────────
    this.player.setPos(this.playerObj.position);
    this.player.isRunning = this.isRunning;

    // ─── UPDATE CAPSULE ───────────────────────────
    if (this.playerCollider) {
      this.playerCollider.start
        .copy(this.playerObj.position)
        .add(new THREE.Vector3(0, 8, 0)); // ✅ was 2
      this.playerCollider.end
        .copy(this.playerObj.position)
        .add(new THREE.Vector3(0, 14, 0));

      if (this.capsuleMesh) {
        const mid = this.playerCollider.start
          .clone()
          .add(this.playerCollider.end)
          .multiplyScalar(0.5);
        this.capsuleMesh.position.copy(mid);
      }
    }

    // ─── ANIMATIONS ───────────────────────────────
    // Skip animation changes during throw OR grenade aim
    if (this.player.throwInProgress || this.isGrenadeAiming) {
      // Still update everything else, just skip animation changes
    } else if (this._isShootingAnimation) {
      // Don't change animation while actively shooting
    } else {
      const isMoving =
        Math.abs(this.velocity.x) > 0.05 || Math.abs(this.velocity.z) > 0.05;
      const isRunning = isMoving && this.isRunning;

      // ✅ Improved falling detection
      const isInAir = !this.isOnObject && !this.canJump;
      const isFalling = this.velocity.y < -0.5;

      // Only play falling if actually in air AND falling down
      const shouldPlayFalling = isInAir && isFalling;

      if (this.player && this.player.modelLoaded) {
        const currentAnim = this.player.currentAnimation;

        // Don't interrupt reload animations
        if (
          currentAnim === "reloading" ||
          currentAnim === "reloadingWalk" ||
          currentAnim === "reloadingRun"
        ) {
          // Skip animation changes while reloading
        }
        // Handle falling
        else if (shouldPlayFalling && currentAnim !== "falling") {
          this.player.playAnimation("falling", true);
        }
        // Handle landing (transition out of falling)
        else if (!shouldPlayFalling && currentAnim === "falling") {
          // Just landed - transition to movement or idle
          if (isMoving) {
            this.player.playAnimation(isRunning ? "run" : "walk", true);
          } else {
            this.player.playAnimation("idle", true);
          }
        }
        // Normal ground movement
        else if (!shouldPlayFalling && currentAnim !== "falling") {
          let targetAnimation = "idle";
          if (isMoving) {
            targetAnimation = isRunning ? "run" : "walk";
          }
          if (currentAnim !== targetAnimation) {
            this.player.playAnimation(targetAnimation, true);
          }
        }
      }
    }

    // ─── SPINE ROTATION ───────────────────────────
    if (!skipSpine) {
      this.updateSpineRotation();

      if (this.spineBone) {
        this.spineBone.rotation.x +=
          (this.spineTargetRotation - this.spineBone.rotation.x) * 0.8;
        if (
          Math.abs(this.spineBone.rotation.x - this.spineTargetRotation) < 0.01
        ) {
          this.spineBone.rotation.x = this.spineTargetRotation;
        }
        this.spineBone.rotation.y = 0;
        this.spineBone.rotation.z = 0;
        this.spineBone.updateMatrix();
      }
    }

    // ─── BOUNDARY ─────────────────────────────────
    this.enforceMapBoundary();

    // ─── CAMERA ───────────────────────────────────
    this.updateCameraPosition(delta);
  }

  updateGrenadePreview() {
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    direction.normalize();

    const dirKey = `${direction.x.toFixed(3)},${direction.y.toFixed(
      3,
    )},${direction.z.toFixed(3)},${this.grenadeThrowPower.toFixed(1)}`;
    if (this._lastGrenadeDirKey === dirKey) return;
    this._lastGrenadeDirKey = dirKey;

    // ✅ Remove old line if exists
    if (this.grenadePreviewLine && this.grenadePreviewLine.parent) {
      this.world.scene.remove(this.grenadePreviewLine);
      if (this.grenadePreviewLine.geometry)
        this.grenadePreviewLine.geometry.dispose();
      if (this.grenadePreviewLine.material)
        this.grenadePreviewLine.material.dispose();
      this.grenadePreviewLine = null;
    }

    // Get start position
    const pos = new THREE.Vector3();
    const rightHand = this.player.bones?.rightHand;
    if (rightHand) {
      rightHand.getWorldPosition(pos);
    } else {
      pos.copy(this.playerObj.position);
      pos.y += 14;
    }

    const points = [];
    const vel = direction.clone().multiplyScalar(this.grenadeThrowPower);
    const gravity = -15;
    const dt = 0.05;
    let currentPos = pos.clone();

    for (let i = 0; i < 200; i++) {
      points.push(currentPos.clone());
      vel.y += gravity * dt;
      currentPos.addScaledVector(vel, dt);
      if (currentPos.y < 0) {
        points.push(currentPos.clone());
        break;
      }
    }

    if (points.length < 2) return;

    // ✅ Create new line
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.7,
      depthTest: false,
    });

    this.grenadePreviewLine = new THREE.Line(geometry, material);
    this.world.scene.add(this.grenadePreviewLine);

    this._updateGrenadeLandingMarker(currentPos);
  }

  _updateGrenadeLandingMarker(landPos) {
    if (!this._grenadeLandingMarker) {
      const geo = new THREE.RingGeometry(1, 2.5, 24);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xff4400,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
        depthTest: false,
      });
      this._grenadeLandingMarker = new THREE.Mesh(geo, mat);
      this._grenadeLandingMarker.rotation.x = -Math.PI / 2;
      this.world.scene.add(this._grenadeLandingMarker);
    }
    // ✅ Check if marker exists before setting visibility
    if (this._grenadeLandingMarker) {
      this._grenadeLandingMarker.visible = true;
      this._grenadeLandingMarker.position.copy(landPos);
      this._grenadeLandingMarker.position.y += 0.2;
    }
  }

  createJetpackEffect() {
    if (!this.world || !this.world.scene) return;

    // Throttle particles
    if (this.lastJetpackParticle && Date.now() - this.lastJetpackParticle < 50)
      return;
    this.lastJetpackParticle = Date.now();

    // Create flame particles at player's feet
    const particleCount = 3;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const offsetX = (Math.random() - 0.5) * 1;
      const offsetZ = (Math.random() - 0.5) * 1;
      positions[i * 3] = this.playerObj.position.x + offsetX;
      positions[i * 3 + 1] = this.playerObj.position.y - 1;
      positions[i * 3 + 2] = this.playerObj.position.z + offsetZ;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xff6600,
      size: 0.1,
      transparent: true,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(geometry, material);
    this.world.scene.add(particles);

    // Fade out and remove
    setTimeout(() => {
      this.world.scene.remove(particles);
      geometry.dispose();
      material.dispose();
    }, 100);
  }

  updateJetpackUI() {
    const isGreebleMap = this.world?.mapManager?.currentMap === "greeble_map";
    if (!isGreebleMap) return;

    let jetpackUI = document.getElementById("jetpack-ui");
    if (!jetpackUI) {
      jetpackUI = document.createElement("div");
      jetpackUI.id = "jetpack-ui";
      jetpackUI.style.cssText = `
                position: fixed; bottom: 100px; right: 20px; width: 160px;
                background: rgba(0,0,0,0.75); border-radius: 8px;
                padding: 10px 14px; font-family: 'Orbitron', monospace; color: white;
                z-index: 10; border: 1px solid #00aaff;
            `;
      jetpackUI.innerHTML = `
                <div style="font-size:10px;letter-spacing:0.2em;margin-bottom:6px;color:#4af">🚀 JETPACK FUEL</div>
                <div style="width:100%;height:8px;background:#1a1a2e;border-radius:4px;overflow:hidden;">
                    <div id="jetpack-fuel-bar" style="width:100%;height:100%;background:#00aaff;transition:width 0.15s;border-radius:4px;"></div>
                </div>
                <div id="jetpack-fuel-text" style="font-size:9px;margin-top:4px;text-align:right;letter-spacing:0.15em;">100%</div>
                <div id="jetpack-status" style="font-size:9px;margin-top:2px;color:#666;letter-spacing:0.1em;"></div>
            `;
      document.body.appendChild(jetpackUI);
    }

    if (!this.jetpackActive) {
      jetpackUI.style.display = "none";
      return;
    }

    jetpackUI.style.display = "block";
    const fuelPercent = (this.jetpackFuel / this.maxJetpackFuel) * 100;
    const fuelBar = document.getElementById("jetpack-fuel-bar");
    const fuelText = document.getElementById("jetpack-fuel-text");
    const fuelStatus = document.getElementById("jetpack-status");

    if (fuelBar) {
      fuelBar.style.width = `${fuelPercent}%`;
      if (fuelPercent > 60) fuelBar.style.background = "#00ff88";
      else if (fuelPercent > 25) fuelBar.style.background = "#ffaa00";
      else fuelBar.style.background = "#ff4400";
    }
    if (fuelText) fuelText.textContent = `${Math.floor(fuelPercent)}%`;
    if (fuelStatus) {
      if (this._jetpackOutOfFuel) fuelStatus.textContent = "RECHARGING...";
      else if (this.isJetpacking) fuelStatus.textContent = "THRUSTING";
      else if (fuelPercent >= 100) fuelStatus.textContent = "READY";
      else fuelStatus.textContent = `REGEN ${Math.floor(fuelPercent)}%`;
      fuelStatus.style.color = this._jetpackOutOfFuel
        ? "#ff6600"
        : this.isJetpacking
        ? "#00aaff"
        : "#4a7a4a";
    }
  }

  playPickupAnimation() {
    if (!this.player || !this.player.modelLoaded) return;
    this.player.playAnimation("pickup", false);

    // Return to idle after pickup animation
    setTimeout(() => {
      if (this.player && this.player.modelLoaded) {
        const isMoving =
          Math.abs(this.velocity.x) > 0.05 || Math.abs(this.velocity.z) > 0.05;
        this.player.playAnimation(
          isMoving ? (this.isRunning ? "run" : "walk") : "idle",
          true,
        );
      }
    }, 4133); // Duration of pickup animation
  }

  checkCameraObstruction() {
    if (!this.world.buildingMeshes) return;

    // Player position (eye level)
    const playerPos = this.playerObj.position.clone();
    playerPos.y += 12; // Eye level height

    // Direction from player to where camera should be
    const direction = new THREE.Vector3(
      Math.sin(this.cameraRotation.x) * Math.cos(this.cameraRotation.y),
      Math.sin(this.cameraRotation.y),
      Math.cos(this.cameraRotation.x) * Math.cos(this.cameraRotation.y),
    ).normalize();

    // Raycast from player in camera direction
    const raycaster = new THREE.Raycaster(
      playerPos,
      direction,
      0,
      this.maxCameraDistance,
    );

    // Get all building meshes that could obstruct the view
    const obstacles = this.world.buildingMeshes.filter((mesh) => {
      return mesh.visible;
    });

    const intersects = raycaster.intersectObjects(obstacles, true);

    if (intersects.length > 0) {
      // Find the closest intersection
      const closestHit = intersects.reduce((closest, hit) => {
        return hit.distance < closest.distance ? hit : closest;
      }, intersects[0]);

      // Calculate new camera distance (with a small margin to avoid clipping)
      const newDistance = Math.max(
        this.minCameraDistance,
        closestHit.distance - 2, // 2 units away from the wall
      );

      // Smoothly interpolate to new distance
      this.currentCameraDistance +=
        (newDistance - this.currentCameraDistance) * 0.1;
    } else {
      // No obstruction, smoothly return to max distance
      this.currentCameraDistance +=
        (this.maxCameraDistance - this.currentCameraDistance) * 0.1;
    }
  }

  updateCameraPosition(delta) {
    this.checkCameraObstruction();

    // Smoothly lerp FOV
    if (this.targetFOV !== undefined) {
      this.camera.fov += (this.targetFOV - this.camera.fov) * 0.15;
      this.camera.updateProjectionMatrix();
    }

    // FPS Camera Mode - Camera is parented to bone, apply mouse look to player rotation
    if (this.cameraMode === "fps") {
      // Apply mouse look to PLAYER rotation (not camera directly)
      // This rotates the entire player model including the spine2 bone
      const camYaw = this.cameraRotation.x;

      // Rotate player to face camera direction (same as shoulder mode)
      let angleDiff = camYaw - this.playerObj.rotation.y;
      angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
      this.playerObj.rotation.y += angleDiff * 0.15;

      // For vertical look, we need to rotate the camera's parent (spine2) or use spine bone
      // Since the camera is attached to spine2, we can rotate the spine bone for vertical look
      if (this.fpsCameraBone && this.spineBone) {
        // Map vertical mouse look to spine rotation
        const minCam = 0.1;
        const maxCam = this.PI_2 - 0.1;
        const t = (this.cameraRotation.y - minCam) / (maxCam - minCam);

        // Map to spine rotation range: +30° up to -70° down
        const maxUpAngle = (30 * Math.PI) / 180;
        const maxDownAngle = (-70 * Math.PI) / 180;
        const targetRotation = maxUpAngle + t * (maxDownAngle - maxUpAngle);

        // Apply to spine bone
        this.spineBone.rotation.x = targetRotation;
        this.spineBone.updateMatrix();
      }

      return;
    }

    // SHOULDER MODE (over-the-shoulder aiming)
    if (this.isAiming || this.cameraMode === "shoulder") {
      const camYaw = this.cameraRotation.x;

      // ✅ Instant player rotation to match camera — remove the lerp lag
      this.playerObj.rotation.y = camYaw;

      // Rotate player to face camera direction when aiming
      let angleDiff = camYaw - this.playerObj.rotation.y;
      angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
      this.playerObj.rotation.y += angleDiff * 0.15;

      // Calculate camera position (over-the-shoulder from right side)
      const eyePos = this.playerObj.position.clone();
      eyePos.y += 16;

      const pullDist = 18;
      const backX = Math.sin(camYaw) * pullDist;
      const backZ = Math.cos(camYaw) * pullDist;

      const sideOffset = 6;
      const rightX = Math.cos(camYaw) * sideOffset;
      const rightZ = -Math.sin(camYaw) * sideOffset;

      const maxDownwardAngle = 0.25;
      const clampedRotationY = Math.max(
        maxDownwardAngle,
        this.cameraRotation.y,
      );
      const pitchNorm = (clampedRotationY - 0.1) / (this.PI_2 - 0.2);
      const verticalOffset = (pitchNorm - 0.3) * 60;

      const targetPos = new THREE.Vector3(
        eyePos.x + backX + rightX,
        eyePos.y + verticalOffset,
        eyePos.z + backZ + rightZ,
      );

      this.camera.position.lerp(targetPos, this.isInWater ? 1.0 : 0.25);

      const lookDist = 80;
      const pitchAngle = (pitchNorm - 0.3) * (Math.PI * 0.6);
      const aimTarget = new THREE.Vector3(
        this.playerObj.position.x -
          Math.sin(camYaw) * lookDist * Math.cos(pitchAngle),
        this.playerObj.position.y + 14 - Math.sin(pitchAngle) * lookDist,
        this.playerObj.position.z -
          Math.cos(camYaw) * lookDist * Math.cos(pitchAngle),
      );
      this.camera.lookAt(aimTarget);
      return;
    }

    // THIRD PERSON MODE - Free orbit
    const horizontalDistance =
      this.currentCameraDistance * Math.cos(this.cameraRotation.y);
    const verticalDistance =
      this.currentCameraDistance * Math.sin(this.cameraRotation.y);

    const targetCameraPos = new THREE.Vector3(
      this.playerObj.position.x +
        Math.sin(this.cameraRotation.x) * horizontalDistance,
      this.playerObj.position.y + this.cameraHeight + verticalDistance,
      this.playerObj.position.z +
        Math.cos(this.cameraRotation.x) * horizontalDistance,
    );

    const lerpFactor = this.isInWater ? 1.0 : 0.3;
    this.camera.position.lerp(targetCameraPos, lerpFactor);

    const lookAtPos = this.playerObj.position
      .clone()
      .add(new THREE.Vector3(0, 12, 0));
    this.camera.lookAt(lookAtPos);
  }

  cycleCameraMode() {
    const modes = ["thirdPerson", "shoulder", "fps"];
    const currentIndex = modes.indexOf(this.cameraMode);
    const nextIndex = (currentIndex + 1) % modes.length;

    // Stop aiming before switching modes
    if (this.isAiming) {
      this.stopAiming();
    }

    // Handle exiting FPS mode
    if (this.cameraMode === "fps") {
      this.cleanupFPSMode();
    }

    this.cameraMode = modes[nextIndex];

    // Save to global state
    if (window.saveCameraState) {
      window.saveCameraState();
    }

    // Handle entering new mode
    if (this.cameraMode === "fps") {
      this.setupFPSMode();

      if (this.world && this.world.crosshair3D) {
        this.world.crosshair3D.show();
      }

      this.isAiming = true;
      this.targetFOV = this.aimFOV;
    } else if (this.cameraMode === "shoulder") {
      // Make sure front mesh is visible (it should be, but just in case)
      if (this.frontMesh) {
        this.frontMesh.visible = true;
      }

      if (this.player && this.player.pitchObj) {
        this.player.pitchObj.visible = true;
      }

      if (this.world && this.world.crosshair3D) {
        this.world.crosshair3D.show();
        this.world.crosshair3D.setAiming(true);
      }

      this.isAiming = true;
      this.targetFOV = this.aimFOV;
    } else {
      // Third person mode

      // Make sure front mesh is visible
      if (this.frontMesh) {
        this.frontMesh.visible = true;
      }

      // Third person mode
      if (this.player && this.player.pitchObj) {
        this.player.pitchObj.visible = true;
      }

      if (this.world && this.world.crosshair3D) {
        this.world.crosshair3D.hide();
      }

      this.isAiming = false;
      this.targetFOV = this.normalFOV;
    }

    // Show notification
    if (window.roomManager?.showNotification) {
      const modeNames = {
        thirdPerson: "THIRD PERSON",
        shoulder: "OVER SHOULDER",
        fps: "FPS",
      };
      window.roomManager.showNotification(
        `${modeNames[this.cameraMode]} MODE`,
        "#ffaa00",
      );
    }

    console.log(
      `Camera mode changed to: ${this.cameraMode}, isAiming: ${this.isAiming}`,
    );
  }

  checkCollisions() {
    // Skip ground collision entirely when in water
    if (this.isInWater) {
      this.isOnObject = true;
      this.canJump = false;
      return;
    }

    // Reset ground state first
    let wasOnGround = this.isOnObject;
    this.isOnObject = false;
    this.canJump = false;

    // Raycast from multiple points for better building detection
    const feetPos = this.playerObj.position.clone();
    feetPos.y += 1;

    // Cast multiple rays in a small radius for better detection on uneven surfaces
    const rayOffsets = [
      { x: 0, z: 0 }, // Center
      { x: 0.5, z: 0 }, // Right
      { x: -0.5, z: 0 }, // Left
      { x: 0, z: 0.5 }, // Front
      { x: 0, z: -0.5 }, // Back
    ];

    let closestHit = null;
    let closestDistance = Infinity;

    // Get all objects that can be stood on
    const groundObjects = this.world.getObjects().filter((obj) => {
      let current = obj;
      while (current) {
        if (
          current.name === "Boundary" ||
          current.userData?.isWater ||
          current.userData?.isWaterCurrentZone ||
          current.name === "Object_69"
        ) {
          return false;
        }
        current = current.parent;
      }
      return true;
    });

    for (const offset of rayOffsets) {
      this.caster.set(
        new THREE.Vector3(
          feetPos.x + offset.x,
          feetPos.y,
          feetPos.z + offset.z,
        ),
        new THREE.Vector3(0, -1, 0),
      );

      const intersections = this.caster.intersectObjects(groundObjects, true);

      if (intersections.length > 0 && intersections[0].distance < 2) {
        if (intersections[0].distance < closestDistance) {
          closestDistance = intersections[0].distance;
          closestHit = intersections[0];
        }
      }
    }

    if (closestHit && closestDistance < 1.5) {
      this.isOnObject = true;
      this.canJump = true;

      // Calculate the surface height
      const targetY = closestHit.point.y;
      const yDiff = targetY - this.playerObj.position.y;

      // Only snap if falling or small adjustment
      if (this.velocity.y <= 0 || yDiff < 0.3) {
        this.playerObj.position.y = targetY;
        this.velocity.y = 0;
      }

      // Reset jetpack burst when landing
      this.jetpackBurstDuration = 0;
      this.jetpackBurstCooldown = 0;

      // ✅ Reset falling animation when landed
      if (this.player && this.player.currentAnimation === "falling") {
        const isMoving =
          Math.abs(this.velocity.x) > 0.05 || Math.abs(this.velocity.z) > 0.05;
        if (isMoving) {
          this.player.playAnimation(this.isRunning ? "run" : "walk", true);
        } else {
          this.player.playAnimation("idle", true);
        }
      }
    }

    const isGreebleMap = this.world.mapManager?.currentMap === "greeble_map";
    if (!isGreebleMap && this.playerObj.position.y <= 0) {
      this.playerObj.position.y = 0;
      this.velocity.y = 0;
      this.isOnObject = true;
      this.canJump = true;

      if (this.player && this.player.currentAnimation === "falling") {
        const isMoving =
          Math.abs(this.velocity.x) > 0.05 || Math.abs(this.velocity.z) > 0.05;
        if (isMoving) {
          this.player.playAnimation(this.isRunning ? "run" : "walk", true);
        } else {
          this.player.playAnimation("idle", true);
        }
      }
    }
  }

  resetWaterState() {
    this.isInWater = false;
    // Don't reset isOnObject/canJump here - let ground detection handle it
  }

  checkWaterCollision() {
    // Store previous zone before resetting
    const previousZone = this.currentWaterZone;

    this.currentWaterZone = null;
    this.currentWaterDirection.set(0, 0, 0);

    const px = this.playerObj.position.x;
    const py = this.playerObj.position.y;
    const pz = this.playerObj.position.z;

    for (const obj of this.world.objects) {
      if (!obj.userData?.isWaterCurrentZone) continue;

      obj.updateWorldMatrix(true, false);
      const bounds = new THREE.Box3().setFromObject(obj);

      const inX = px >= bounds.min.x && px <= bounds.max.x;
      const inZ = pz >= bounds.min.z && pz <= bounds.max.z;
      // ── KEY FIX: also check Y so bridge players are excluded ──────────
      // Player feet (py) must be below the box top (bounds.max.y).
      // Add a small upward tolerance (2 units) so the player can enter
      // from the top surface of the water without having to jump.
      const inY = py <= bounds.max.y + 2;

      if (inX && inZ && inY) {
        this.currentWaterZone = obj;
        if (obj.userData.currentDirection) {
          this.currentWaterDirection.copy(obj.userData.currentDirection);
        }
        break;
      }
    }

    // Reset water state if left water zone
    if (previousZone && !this.currentWaterZone) {
      this.resetWaterState();
    }
  }

  applyWaterPhysics(originalDelta) {
    if (!this.currentWaterZone) return;
    if (this.currentWaterDirection.lengthSq() < 0.001) return;

    const playerPos = this.playerObj.position;

    // Cache ride Y once per zone
    if (!this.currentWaterZone.userData._cachedTopY) {
      this.currentWaterZone.updateWorldMatrix(true, false);
      const b = new THREE.Box3().setFromObject(this.currentWaterZone);
      this.currentWaterZone.userData._cachedTopY = b.max.y + 9.5;
    }

    // Hard-lock Y every frame — no threshold, no lerp, no spring
    playerPos.y = this.currentWaterZone.userData._cachedTopY;
    this.velocity.y = 0;
    this.isInWater = true;
    this.isOnObject = true;
    this.canJump = false;

    // Current force
    const velAlongCurrent = this.velocity.dot(this.currentWaterDirection);
    const deficit = 4.5 - velAlongCurrent;
    if (deficit > 0) {
      this.velocity.addScaledVector(
        this.currentWaterDirection,
        Math.min(10.0 * originalDelta, deficit),
      );
    }
  }

  resolveBuildingCollisionsOptimized() {
    if (this.isInWater) return;
    if (!this.world.buildingMeshes || !this.playerCollider) return;

    // Frame skipping
    this.collisionFrameCounter = (this.collisionFrameCounter || 0) + 1;
    const skipRate = this.isMobile ? 2 : this.collisionFrameSkip;
    if (this.collisionFrameCounter % skipRate !== 0) return;
    if (this.collisionFrameCounter > 1000) this.collisionFrameCounter = 0;

    const playerPos = this.playerObj.position;

    // Distance cull — only check nearby meshes
    const nearbyMeshes = this.world.buildingMeshes.filter((mesh) => {
      if (mesh.userData?.isWater || mesh.userData?.skipCollision) return false;
      if (mesh.name === "Object_61" || mesh.name === "Object_37") return false;
      if (mesh.name === "Object_69") return false;
      if (!mesh.geometry.boundsTree) return false;

      // Skip branch materials
      if (mesh.material) {
        const materials = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        for (const mat of materials) {
          if (mat?.name) {
            const n = mat.name.toLowerCase();
            if (n === "branch" || n === "drytree_texture") return false;
          }
        }
      }

      // Distance cull
      if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
      if (!this._meshWorldPosTemp) this._meshWorldPosTemp = new THREE.Vector3();
      mesh.getWorldPosition(this._meshWorldPosTemp);
      const dist = playerPos.distanceTo(this._meshWorldPosTemp);
      const radius = mesh.geometry.boundingSphere.radius;
      return dist < radius + 80;
    });

    if (nearbyMeshes.length === 0) return;

    const capsule = this.playerCollider;
    let collisionDetected = false;
    let groundY = null;

    const ITERATIONS = this.collisionIterations;
    const capsuleRadius = capsule.radius;
    const verticalSmoothFactor = this.verticalSmoothFactor;

    for (let iter = 0; iter < ITERATIONS; iter++) {
      for (const mesh of nearbyMeshes) {
        // ✅ nearbyMeshes, not buildingMeshes
        if (!mesh.geometry.boundsTree) continue;

        const matrixWorld = mesh.matrixWorld;
        const scaleX = matrixWorld.elements[0];
        const scaleZ = matrixWorld.elements[10];
        const localRadius =
          capsuleRadius / Math.max(Math.abs(scaleX), Math.abs(scaleZ));

        this._inverseMatTemp.copy(matrixWorld).invert();
        const localStart = this._localStartTemp
          .copy(capsule.start)
          .applyMatrix4(this._inverseMatTemp);
        const localEnd = this._localEndTemp
          .copy(capsule.end)
          .applyMatrix4(this._inverseMatTemp);
        const segment = new THREE.Line3(localStart, localEnd);

        mesh.geometry.boundsTree.shapecast({
          intersectsBounds: (box) => {
            const capsuleBox = new THREE.Box3()
              .setFromPoints([localStart, localEnd])
              .expandByScalar(localRadius);
            return box.intersectsBox(capsuleBox);
          },
          intersectsTriangle: (tri) => {
            const triPoint = new THREE.Vector3();
            const capsulePoint = new THREE.Vector3();
            const dist = tri.closestPointToSegment(
              segment,
              triPoint,
              capsulePoint,
            );

            const normal = tri.getNormal(new THREE.Vector3());
            normal.applyQuaternion(mesh.quaternion);
            normal.normalize();

            if (mesh.name === "Boundary" && normal.y > 0.7) return;

            if (dist < localRadius) {
              collisionDetected = true;
              const depth = localRadius - dist;

              const worldCapsulePoint = capsulePoint
                .clone()
                .applyMatrix4(matrixWorld);
              const worldTriPoint = triPoint.clone().applyMatrix4(matrixWorld);
              const pushDir = worldCapsulePoint
                .clone()
                .sub(worldTriPoint)
                .normalize();

              if (pushDir.lengthSq() < 0.001) return;

              const worldDepth =
                depth * Math.max(Math.abs(scaleX), Math.abs(scaleZ));
              const correction = pushDir.clone().multiplyScalar(worldDepth);
              playerPos.add(correction);
              capsule.start.add(correction);
              capsule.end.add(correction);

              localStart.copy(capsule.start).applyMatrix4(this._inverseMatTemp);
              localEnd.copy(capsule.end).applyMatrix4(this._inverseMatTemp);
              segment.set(localStart, localEnd);

              const velDot = this.velocity.dot(pushDir);
              if (velDot < 0) {
                this.velocity.addScaledVector(pushDir, -velDot);
              }

              if (pushDir.y > 0.3) {
                this.isOnObject = true;
                this.canJump = true;
                this.velocity.y = Math.max(0, this.velocity.y);
                if (groundY === null || worldTriPoint.y > groundY) {
                  groundY = worldTriPoint.y;
                }
              }
            }
          },
        });
      }
    }

    if (this.isOnObject && groundY !== null) {
      const targetY = groundY + 8;
      playerPos.y += (targetY - playerPos.y) * verticalSmoothFactor;
      capsule.start.y = playerPos.y + 8;
      capsule.end.y = playerPos.y + 14;
    }

    if (!collisionDetected && !this.isOnObject) {
      this.isOnObject = false;
      this.canJump = false;
    }
  }

  createWeaponWheelUI() {
    if (document.getElementById("weapon-wheel-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "weapon-wheel-overlay";
    overlay.style.cssText = `
        position: fixed; inset: 0;
        display: none; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.55);
        z-index: 40;
    `;

    const wrapper = document.createElement("div");
    wrapper.style.cssText = "position: relative; width: 360px; height: 360px;";

    const canvas = document.createElement("canvas");
    canvas.id = "ww-canvas";
    canvas.width = 360;
    canvas.height = 360;
    canvas.style.cssText = "position: absolute; inset: 0;";
    wrapper.appendChild(canvas);

    const centerLabel = document.createElement("div");
    centerLabel.id = "ww-center";
    centerLabel.style.cssText = `
        position: absolute; top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        text-align: center; width: 130px; pointer-events: none;
    `;
    centerLabel.innerHTML = `
        <div id="ww-name" style="font-size: 15px; font-weight: 500; color: #fff; line-height: 1.3;"></div>
        <div id="ww-ammo" style="font-size: 12px; color: rgba(255,255,255,0.6); margin-top: 3px;"></div>
    `;
    wrapper.appendChild(centerLabel);

    const hint = document.createElement("div");
    hint.style.cssText = `
        position: absolute; bottom: -32px; left: 0; right: 0;
        text-align: center; font-size: 12px; color: rgba(255,255,255,0.45);
        font-family: sans-serif;
    `;
    hint.textContent = "Q — confirm   |   E — next weapon";
    wrapper.appendChild(hint);

    overlay.appendChild(wrapper);
    document.body.appendChild(overlay);

    this.wwOverlay = overlay;
    this.wwCanvas = canvas;
    this.wwCtx = canvas.getContext("2d");
    this.weaponWheelOpen = false;
    this.wwSelected = 0;
  }

  drawWeaponWheel() {
    if (!this.weaponWheelOpen) return;

    // Throttle to 20fps on mobile
    if (this.isMobile) {
      const now = performance.now();
      if (!this.lastWheelDraw) this.lastWheelDraw = 0;
      if (now - this.lastWheelDraw < 50) return;
      this.lastWheelDraw = now;
    }

    if (!this.wwCtx || !this.player) return;

    const weapons = this.player.weapons;
    const n = weapons.length;
    const ctx = this.wwCtx;
    const W = 360,
      H = 360,
      cx = W / 2,
      cy = H / 2;
    const outerR = 155,
      innerR = 65;

    ctx.clearRect(0, 0, W, H);

    const colors = [
      "#378ADD",
      "#D85A30",
      "#639922",
      "#7F77DD",
      "#D4537E",
      "#BA7517",
      "#E24B4A",
      "#1D9E75",
      "#888780",
    ];

    for (let i = 0; i < n; i++) {
      const startAngle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const endAngle = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
      const isSelected = i === this.wwSelected;
      const midAngle = (startAngle + endAngle) / 2;
      const color = colors[i % colors.length];

      ctx.beginPath();
      ctx.moveTo(
        cx + Math.cos(startAngle) * innerR,
        cy + Math.sin(startAngle) * innerR,
      );
      ctx.arc(cx, cy, outerR + (isSelected ? 14 : 0), startAngle, endAngle);
      ctx.arc(cx, cy, innerR, endAngle, startAngle, true);
      ctx.closePath();

      ctx.fillStyle = isSelected ? color : "rgba(255,255,255,0.1)";
      ctx.fill();
      ctx.strokeStyle = isSelected ? "#fff" : "rgba(255,255,255,0.2)";
      ctx.lineWidth = isSelected ? 2 : 0.5;
      ctx.stroke();

      const labelR = (outerR + innerR) / 2 + (isSelected ? 7 : 0);
      const lx = cx + Math.cos(midAngle) * labelR;
      const ly = cy + Math.sin(midAngle) * labelR;

      ctx.save();
      ctx.translate(lx, ly);
      const parts = weapons[i].name.split(" ");
      ctx.fillStyle = isSelected ? "#fff" : "rgba(255,255,255,0.65)";
      ctx.font = `${isSelected ? "500" : "400"} 10px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (parts.length > 1) {
        ctx.fillText(parts[0], 0, -6);
        ctx.fillText(parts.slice(1).join(" "), 0, 6);
      } else {
        ctx.fillText(parts[0], 0, 0);
      }
      ctx.restore();
    }

    // inner circle
    ctx.beginPath();
    ctx.arc(cx, cy, innerR - 2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fill();

    // update center label
    const w = weapons[this.wwSelected];
    document.getElementById("ww-name").textContent = w.name;
    const ammoStr = `${w.ammo} / ${w.maxAmmo}`;
    document.getElementById("ww-ammo").textContent = w.isReloading
      ? "Reloading..."
      : ammoStr;
  }

  toggleWeaponWheel() {
    if (!this.wwOverlay) this.createWeaponWheelUI();

    this.weaponWheelOpen = !this.weaponWheelOpen;

    if (this.weaponWheelOpen) {
      // ✅ Start selection at current weapon
      this.wwSelected = this.player ? this.player.currentWeaponIndex : 0;
      this.wwOverlay.style.display = "flex";
      this.drawWeaponWheel();
    } else {
      // ✅ Confirm selection — switch weapon and close
      this.wwOverlay.style.display = "none";
      if (this.player && this.wwSelected !== this.player.currentWeaponIndex) {
        this.player.switchWeapon(this.wwSelected, true);
      }
    }
  }

  cycleWeaponWheel(direction) {
    if (!this.player) return;
    const n = this.player.weapons.length;
    this.wwSelected = (this.wwSelected + direction + n) % n;
    this.drawWeaponWheel();
  }

  throwGrenade() {
    if (!this.player || !this.player.modelLoaded) return;

    // ✅ Check if player has grenades
    if (!this.player.hasGrenades()) {
      if (window.roomManager?.showNotification) {
        window.roomManager.showNotification(
          "❌ No grenades left! Find ammo boxes.",
          "#ff4444",
        );
      }
      return;
    }

    // Play throw animation
    this.player.playAnimation("throw", false, false);

    // Calculate throw direction based on camera
    const throwDirection = new THREE.Vector3();
    this.camera.getWorldDirection(throwDirection);
    throwDirection.y += 0.2;
    throwDirection.normalize();

    // Calculate spawn position
    let spawnPos = this.playerObj.position.clone();
    spawnPos.y += 14;
    const rightHand = this.player.bones?.rightHand;
    if (rightHand) {
      spawnPos = new THREE.Vector3();
      rightHand.getWorldPosition(spawnPos);
    }

    // ✅ Use one grenade
    this.player.useGrenade();

    // Then update the HUD:
    if (window.modernHUD) {
      window.modernHUD.updateGrenadeCount(
        this.player.grenadeCount,
        this.player.maxGrenades,
      );
    }

    // Wait for animation, then spawn grenade locally
    setTimeout(() => {
      this.spawnGrenade(spawnPos, throwDirection);

      // Emit to server for other players
      if (this.player.socket) {
        this.player.socket.emit("grenadeThrown", {
          position: { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z },
          direction: {
            x: throwDirection.x,
            y: throwDirection.y,
            z: throwDirection.z,
          },
          throwPower: this.grenadeThrowPower,
        });
      }
    }, 1700);
  }

  spawnGrenade(position, direction, power = null) {
    // Create a simple sphere grenade
    const grenadeGeo = new THREE.SphereGeometry(0.8, 16, 16);
    const grenadeMat = new THREE.MeshStandardMaterial({
      color: 0x2d5a1e,
      roughness: 0.4,
      metalness: 0.6,
      emissive: 0x111111,
    });
    const grenade = new THREE.Mesh(grenadeGeo, grenadeMat);
    grenade.position.copy(position);
    grenade.castShadow = true;

    this.world.scene.add(grenade);

    // Physics
    const speed = power || this.grenadeThrowPower;
    const velocity = direction.clone().multiplyScalar(speed);
    const gravity = -15;
    let lifeTime = 3.0; // seconds until explosion

    const startTime = performance.now();

    const updateGrenade = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - startTime) / 1000);

      lifeTime -= dt;

      if (lifeTime <= 0) {
        // Explode!
        this.explodeGrenade(grenade);
        return;
      }

      // Apply gravity
      velocity.y += gravity * dt;

      // Move grenade
      grenade.position.x += velocity.x * dt;
      grenade.position.y += velocity.y * dt;
      grenade.position.z += velocity.z * dt;

      // Spin the grenade
      grenade.rotation.x += 5 * dt;
      grenade.rotation.z += 3 * dt;

      // Ground collision
      if (grenade.position.y < 0.5) {
        grenade.position.y = 0.5;
        velocity.y = 0;
        velocity.multiplyScalar(0.3); // Bounce dampening

        // If almost stopped, detonate
        if (velocity.length() < 1) {
          setTimeout(() => this.explodeGrenade(grenade), 500);
          return;
        }
      }

      requestAnimationFrame(updateGrenade);
    };

    requestAnimationFrame(updateGrenade);
  }

  explodeGrenade(grenade) {
    // Use grenade position directly — it already collided with ground in spawnGrenade
    const explosionPos = grenade.position.clone();
    explosionPos.y += 0.5; // slight lift so it sits on surface, not inside it

    // Emit explosion to server
    if (grenade.geometry && this.player?.socket) {
      this.player.socket.emit("grenadeExploded", {
        position: { x: explosionPos.x, y: explosionPos.y, z: explosionPos.z },
        damage: 80,
        radius: 90,
        throwerId: this.player.id,
      });
    }

    // Remove grenade
    if (grenade.geometry) {
      this.world.scene.remove(grenade);
      grenade.geometry.dispose();
      grenade.material.dispose();
      grenade.children.forEach((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }

    // Clean up previous explosion
    if (this.currentExplosion) {
      this.cleanupExplosion();
    }

    // Create explosion
    const explosion = createExplosion(this.world.scene);

    explosion.light.position.copy(explosionPos);
    explosion.fireSmoke.position.copy(explosionPos);
    explosion.sparkles.position.copy(explosionPos);
    explosion.streaks.position.copy(explosionPos);
    explosion.dust.position.copy(explosionPos);

    explosion.fireSmoke.rotation.z = Math.random() * Math.PI * 2;
    explosion.streaks.rotation.z = Math.random() * Math.PI * 2;
    explosion.dust.rotation.y = Math.random() * Math.PI * 2;

    this.world.scene.add(explosion.light);
    this.world.scene.add(explosion.fireSmoke);
    this.world.scene.add(explosion.sparkles);
    this.world.scene.add(explosion.streaks);
    this.world.scene.add(explosion.dust);

    this.currentExplosion = explosion;
    explosion.timeline.play();

    let lastTime = performance.now();
    let animationId = null;

    const animate = () => {
      if (!this.currentExplosion || explosion !== this.currentExplosion) return;

      const now = performance.now();
      const delta = Math.min(0.033, (now - lastTime) / 1000);
      lastTime = now;
      updateExplosionTime(explosion, delta);

      if (explosion.timeline && explosion.timeline.running()) {
        animationId = requestAnimationFrame(animate);
      } else {
        setTimeout(() => {
          if (this.currentExplosion === explosion) {
            this.cleanupExplosion();
          }
          if (animationId) cancelAnimationFrame(animationId);
        }, 200);
      }
    };

    animationId = requestAnimationFrame(animate);

    // Damage nearby players
    if (window.players) {
      const allPlayers = window.players.getAll();
      allPlayers.forEach((p) => {
        if (p === this.player) return;
        if (p.isDead) return;
        const dist = p.threeObj.position.distanceTo(explosionPos);
        if (dist < 50) {
          const damage = Math.floor(80 * (1 - dist / 90));
          p.takeDamage(damage, this.player?.id || null);
        }
      });
    }
  }

  cleanupExplosion() {
    if (this.currentExplosion) {
      // Remove from scene and dispose
      if (this.currentExplosion.light && this.currentExplosion.light.parent) {
        this.world.scene.remove(this.currentExplosion.light);
      }
      if (
        this.currentExplosion.fireSmoke &&
        this.currentExplosion.fireSmoke.parent
      ) {
        this.world.scene.remove(this.currentExplosion.fireSmoke);
        if (this.currentExplosion.fireSmoke.geometry)
          this.currentExplosion.fireSmoke.geometry.dispose();
        if (this.currentExplosion.fireSmoke.material)
          this.currentExplosion.fireSmoke.material.dispose();
      }
      if (
        this.currentExplosion.sparkles &&
        this.currentExplosion.sparkles.parent
      ) {
        this.world.scene.remove(this.currentExplosion.sparkles);
        if (this.currentExplosion.sparkles.geometry)
          this.currentExplosion.sparkles.geometry.dispose();
        if (this.currentExplosion.sparkles.material)
          this.currentExplosion.sparkles.material.dispose();
      }
      if (
        this.currentExplosion.streaks &&
        this.currentExplosion.streaks.parent
      ) {
        this.world.scene.remove(this.currentExplosion.streaks);
        if (this.currentExplosion.streaks.geometry)
          this.currentExplosion.streaks.geometry.dispose();
        if (this.currentExplosion.streaks.material)
          this.currentExplosion.streaks.material.dispose();
      }
      if (this.currentExplosion.dust && this.currentExplosion.dust.parent) {
        this.world.scene.remove(this.currentExplosion.dust);
        if (this.currentExplosion.dust.geometry)
          this.currentExplosion.dust.geometry.dispose();
        if (this.currentExplosion.dust.material)
          this.currentExplosion.dust.material.dispose();
      }

      this.currentExplosion = null;
    }
  }

  unlock() {
    this.enabled = true;
    if (this.blocker) this.blocker.style.display = "none";
  }

  lock() {
    this.enabled = false;
    if (this.blocker) this.blocker.style.display = "flex";
    if (this.instructions) this.instructions.style.display = "";
    this.blurMessage();
  }

  startAiming() {
    if (this.isAiming) return;

    // In shoulder or FPS mode, aiming is always active, so don't allow toggling off
    if (this.cameraMode === "shoulder" || this.cameraMode === "fps") {
      return;
    }

    this.isAiming = true;
    this.targetFOV = this.aimFOV;

    if (this.world && this.world.crosshair3D) {
      this.world.crosshair3D.setAiming(true);
      this.world.crosshair3D.show();
    }

    if (this.player?.modelLoaded) {
      this.player.playAnimation("idle", true);
    }
  }

  stopAiming() {
    if (!this.isAiming) return;

    // In shoulder or FPS mode, aiming is always active, so don't allow toggling off
    if (this.cameraMode === "shoulder" || this.cameraMode === "fps") {
      return;
    }

    this.isAiming = false;
    this.targetFOV = this.normalFOV;

    if (this.world && this.world.crosshair3D) {
      this.world.crosshair3D.setAiming(false);
      this.world.crosshair3D.hide();
    }
  }

  // init() {
  //   if (this.isMobile) {
  //     console.log("Mobile device detected - skipping pointer lock");
  //     this.enabled = true; // Enable controls immediately
  //     if (this.blocker) this.blocker.style.display = "none";
  //     if (this.instructions) this.instructions.style.display = "none";
  //     return;
  //   }

  //   this.world.scene.add(this.grenadePreviewLine);

  //   this.onWheel = (event) => {
  //     if (!this.isGrenadeAiming) return;
  //     event.preventDefault();
  //     this.grenadeThrowPower = Math.max(
  //       5,
  //       Math.min(80, this.grenadeThrowPower - event.deltaY * 0.02),
  //     );
  //   };
  //   document.addEventListener("wheel", this.onWheel, { passive: false });

  //   document.addEventListener("mousemove", this.onMouseMove, false);
  //   document.addEventListener("mousedown", this.onMouseDown, false); // Add mouse down listener
  //   document.addEventListener("keydown", this.onKeyDown, false);
  //   document.addEventListener("keyup", this.onKeyUp, false);
  //   document.addEventListener("keypress", this.onEnterPress, false);
  //   document.addEventListener("mouseup", this.onMouseUp, false);
  //   // Prevent context menu on right click
  //   document.addEventListener("contextmenu", (e) => e.preventDefault());

  //   const havePointerLock =
  //     "pointerLockElement" in document ||
  //     "mozPointerLockElement" in document ||
  //     "webkitPointerLockElement" in document;

  //   if (havePointerLock) {
  //     const element = document.body;
  //     const pointerlockchange = () => {
  //       if (
  //         document.pointerLockElement === element ||
  //         document.mozPointerLockElement === element ||
  //         document.webkitPointerLockElement === element
  //       ) {
  //         this.unlock();
  //       } else {
  //         this.lock();
  //       }
  //     };

  //     const pointerlockerror = () => {
  //       if (this.instructions) this.instructions.style.display = "";
  //     };

  //     document.addEventListener("pointerlockchange", pointerlockchange, false);
  //     document.addEventListener(
  //       "mozpointerlockchange",
  //       pointerlockchange,
  //       false,
  //     );
  //     document.addEventListener(
  //       "webkitpointerlockchange",
  //       pointerlockchange,
  //       false,
  //     );
  //     document.addEventListener("pointerlockerror", pointerlockerror, false);
  //     document.addEventListener("mozpointerlockerror", pointerlockerror, false);
  //     document.addEventListener(
  //       "webkitpointerlockerror",
  //       pointerlockerror,
  //       false,
  //     );

  //     if (this.unlockButton) {
  //       this.unlockButton.addEventListener(
  //         "click",
  //         () => {
  //           if (this.instructions) this.instructions.style.display = "none";
  //           const el = element;
  //           el.requestPointerLock =
  //             el.requestPointerLock ||
  //             el.mozRequestPointerLock ||
  //             el.webkitRequestPointerLock;

  //           if (/Firefox/i.test(navigator.userAgent)) {
  //             const fullscreenchange = () => {
  //               if (
  //                 document.fullscreenElement === element ||
  //                 document.mozFullscreenElement === element ||
  //                 document.mozFullScreenElement === element
  //               ) {
  //                 document.removeEventListener(
  //                   "fullscreenchange",
  //                   fullscreenchange,
  //                 );
  //                 document.removeEventListener(
  //                   "mozfullscreenchange",
  //                   fullscreenchange,
  //                 );
  //                 el.requestPointerLock();
  //               }
  //             };
  //             document.addEventListener(
  //               "fullscreenchange",
  //               fullscreenchange,
  //               false,
  //             );
  //             document.addEventListener(
  //               "mozfullscreenchange",
  //               fullscreenchange,
  //               false,
  //             );

  //             el.requestFullscreen =
  //               el.requestFullscreen ||
  //               el.mozRequestFullscreen ||
  //               el.mozRequestFullScreen ||
  //               el.webkitRequestFullscreen;
  //             el.requestFullscreen();
  //           } else {
  //             el.requestPointerLock();
  //           }
  //         },
  //         false,
  //       );
  //     }
  //   } else if (this.instructions) {
  //     this.instructions.innerHTML =
  //       "Your browser doesn't seem to support Pointer Lock API";
  //   }
  // }

  init() {
    if (this.isMobile) {
      console.log("Mobile device detected - skipping pointer lock");
      this.enabled = true; // Enable controls immediately
      if (this.blocker) this.blocker.style.display = "none";
      if (this.instructions) this.instructions.style.display = "none";
      return;
    }

    // 🔧 FIX: Ensure the body element captures all mouse events
    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";
    document.body.style.touchAction = "none";

    // 🔧 FIX: Prevent default behavior that might interfere with pointer lock
    document.addEventListener("selectstart", (e) => e.preventDefault(), false);

    this.world.scene.add(this.grenadePreviewLine);

    this.onWheel = (event) => {
      if (!this.isGrenadeAiming) return;
      event.preventDefault();
      this.grenadeThrowPower = Math.max(
        5,
        Math.min(80, this.grenadeThrowPower - event.deltaY * 0.02),
      );
    };
    document.addEventListener("wheel", this.onWheel, { passive: false });

    document.addEventListener("mousemove", this.onMouseMove, false);
    document.addEventListener("mousedown", this.onMouseDown, false); // Add mouse down listener
    document.addEventListener("keydown", this.onKeyDown, false);
    document.addEventListener("keyup", this.onKeyUp, false);
    document.addEventListener("keypress", this.onEnterPress, false);
    document.addEventListener("mouseup", this.onMouseUp, false);
    // Prevent context menu on right click
    document.addEventListener("contextmenu", (e) => e.preventDefault());

    const havePointerLock =
      "pointerLockElement" in document ||
      "mozPointerLockElement" in document ||
      "webkitPointerLockElement" in document;

    if (havePointerLock) {
      const element = document.body;

      // 🔧 FIX: Updated pointerlockchange handler - re-request lock if lost during gameplay
      const pointerlockchange = () => {
        const pointerLockElement =
          document.pointerLockElement ||
          document.mozPointerLockElement ||
          document.webkitPointerLockElement;

        if (pointerLockElement === element) {
          this.unlock();
        } else {
          this.lock();
        }
      };

      const pointerlockerror = () => {
        if (this.instructions) this.instructions.style.display = "";
      };

      document.addEventListener("pointerlockchange", pointerlockchange, false);
      document.addEventListener(
        "mozpointerlockchange",
        pointerlockchange,
        false,
      );
      document.addEventListener(
        "webkitpointerlockchange",
        pointerlockchange,
        false,
      );
      document.addEventListener("pointerlockerror", pointerlockerror, false);
      document.addEventListener("mozpointerlockerror", pointerlockerror, false);
      document.addEventListener(
        "webkitpointerlockerror",
        pointerlockerror,
        false,
      );

      if (this.unlockButton) {
        this.unlockButton.addEventListener(
          "click",
          () => {
            if (this.instructions) this.instructions.style.display = "none";
            const el = element;
            el.requestPointerLock =
              el.requestPointerLock ||
              el.mozRequestPointerLock ||
              el.webkitRequestPointerLock;

            if (/Firefox/i.test(navigator.userAgent)) {
              const fullscreenchange = () => {
                if (
                  document.fullscreenElement === element ||
                  document.mozFullscreenElement === element ||
                  document.mozFullScreenElement === element
                ) {
                  document.removeEventListener(
                    "fullscreenchange",
                    fullscreenchange,
                  );
                  document.removeEventListener(
                    "mozfullscreenchange",
                    fullscreenchange,
                  );
                  el.requestPointerLock();
                }
              };
              document.addEventListener(
                "fullscreenchange",
                fullscreenchange,
                false,
              );
              document.addEventListener(
                "mozfullscreenchange",
                fullscreenchange,
                false,
              );

              el.requestFullscreen =
                el.requestFullscreen ||
                el.mozRequestFullscreen ||
                el.mozRequestFullScreen ||
                el.webkitRequestFullscreen;
              el.requestFullscreen();
            } else {
              el.requestPointerLock();
            }
          },
          false,
        );
      }
    } else if (this.instructions) {
      this.instructions.innerHTML =
        "Your browser doesn't seem to support Pointer Lock API";
    }
  }

  cleanup() {
    if (this.spineInterval) {
      clearInterval(this.spineInterval);
    }
    // Clear animation timer
    if (this._animationChangeTimer) {
      clearTimeout(this._animationChangeTimer);
      this._animationChangeTimer = null;
    }

    if (this._grenadeLandingMarker) {
      this.world.scene.remove(this._grenadeLandingMarker);
      this._grenadeLandingMarker.geometry.dispose();
      this._grenadeLandingMarker.material.dispose();
      this._grenadeLandingMarker = null;
    }

    // ✅ ADD THIS - Clean up explosion when game closes
    if (this.currentExplosion) {
      this.cleanupExplosion();
    }
  }
}
