import * as THREE from "three";
import { MeshBVH, acceleratedRaycast } from "three-mesh-bvh";
import { Capsule } from "three/addons/math/Capsule.js";

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

    // Slope handling properties
    this.slopeRaycastDistance = 5; // How far to check for slopes
    this.maxSlopeAngle = 45; // Maximum walkable slope angle in degrees
    this.slopeAdjustSpeed = 0.3; // How fast to adjust to slope
    this.verticalSmoothFactor = 0.2;

    this.onMouseMove = (event) => {
      if (!this.enabled) return;
      const movementX =
        event.movementX || event.mozMovementX || event.webkitMovementX || 0;
      const movementY =
        event.movementY || event.mozMovementY || event.webkitMovementY || 0;

      this.cameraRotation.x -= movementX * 0.002;
      this.cameraRotation.y -= movementY * 0.002;
      this.cameraRotation.y = Math.max(
        0.1,
        Math.min(this.PI_2 - 0.1, this.cameraRotation.y),
      );
    };

    this.onMouseDown = (event) => {
      if (!this.enabled || this.isTyping()) return;

      if (event.button === 2) {
        // Right mouse — AIM
        this.startAiming();
      } else if (event.button === 0) {
        // Left mouse — SHOOT (always shoot, aim not required unless you want it)
        // If you want shooting only while aiming, uncomment the if condition:
        // if (this.isAiming) this.shoot();
        this.shoot();
      }
    };

    // Update onMouseUp:
    this.onMouseUp = (event) => {
      if (event.button === 0) {
        // Stop firing when mouse button is released
        if (this.player) {
          this.player.stopShooting();
        }
      }
      if (event.button === 2) {
        this.stopAiming();
      }
    };

    this.onKeyDown = (event) => {
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
          if (!this.jumpCooldown) {
            this.velocity.y += 4;
            if (this.player && this.player.modelLoaded) {
              this.player.playJumpAnimation();
            }

            // Set cooldown
            this.jumpCooldown = true;
            setTimeout(() => {
              this.jumpCooldown = false;
            }, this.jumpCooldownTime);
          }
          break;
        case "KeyF":
          this.shoot();
          break;
        case "KeyR":
          this.reload();
          break;
        case "KeyQ":
          this.toggleWeaponWheel();
          break;
        case "KeyE":
          if (this.weaponWheelOpen) {
            this.cycleWeaponWheel(1); // next
          } else if (this.player) {
            const nextIndex =
              (this.player.currentWeaponIndex + 1) % this.player.weapons.length;
            this.player.switchWeapon(nextIndex, true);
          }
          break;
        default:
          // Handle digit keys for weapon switching
          if (event.code.startsWith("Digit") && this.player) {
            const digit = parseInt(event.code.slice(5)); // Remove "Digit"
            console.log(
              `Digit pressed: ${digit}, weapons available: ${this.player.weapons.length}`,
            );

            // Weapon indices: 0-based, so digit 1 = index 0, digit 2 = index 1, etc.
            if (digit >= 1 && digit <= this.player.weapons.length) {
              const weaponIndex = digit - 1;
              console.log(`Switching to weapon index: ${weaponIndex}`);
              this.player.switchWeapon(weaponIndex, true);
            } else {
              console.log(`No weapon at index ${digit - 1}`);
            }
          }
          break;
      }
    };

    this.onKeyUp = (event) => {
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

    this.spineInterval = setInterval(() => {
      if (this.spineBone && this.enabled) {
        this.spineBone.rotation.x +=
          (this.spineTargetRotation - this.spineBone.rotation.x) * 0.2;
      }
    }, 16);
    // Camera mode
    this.cameraMode = "thirdPerson"; // "thirdPerson" or "shoulder"
    this.shoulderOffset = new THREE.Vector3(2, 1.5, 3); // Right shoulder offset

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
  }

  // Add method to toggle camera
  toggleCameraMode() {
    if (this.cameraMode === "thirdPerson") {
      this.cameraMode = "shoulder";
      console.log("Switched to shoulder camera");
    } else {
      this.cameraMode = "thirdPerson";
      console.log("Switched to third-person camera");
    }
  }

  // ----------------------------
  // New method for safe capsule creation
  // ----------------------------
  createPlayerCapsule() {
    if (this.player && this.player.modelLoaded && this.playerObj) {
      const box = new THREE.Box3().setFromObject(this.playerObj);
      const size = new THREE.Vector3();
      box.getSize(size);

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

  enforceMapBoundary() {
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

  // shoot() {
  //   if (this.shootingCooldown || !this.enabled) return;

  //   this.shootingCooldown = true;

  //   if (this.player && this.player.modelLoaded) {
  //     const shotFired = this.player.shoot();

  //     if (shotFired) {
  //       // ✅ Only play firing animation if not already reloading
  //       if (this.player.currentAnimation !== "reloading") {
  //         this.player.playAnimation("firing", true);

  //         setTimeout(() => {
  //           if (this.player && this.player.modelLoaded) {
  //             // ✅ Don't override reload animation
  //             if (this.player.currentAnimation === "reloading") return;

  //             const isMoving =
  //               Math.abs(this.velocity.x) > 0.01 ||
  //               Math.abs(this.velocity.z) > 0.01;

  //             if (isMoving) {
  //               this.player.playAnimation(
  //                 this.isRunning ? "run" : "walk",
  //                 true,
  //               );
  //             } else {
  //               this.player.playAnimation("idle", true);
  //             }
  //           }
  //         }, 300);
  //       }
  //     }
  //     if (shotFired && this.world?.crosshair3D) {
  //       this.world.crosshair3D.fireFeedback();
  //     }
  //   }

  //   setTimeout(() => {
  //     this.shootingCooldown = false;
  //   }, 200);
  // }

  shoot() {
    if (this.shootingCooldown || !this.enabled) return;

    // Don't set cooldown here - let the weapon handle fire rate
    // Just call player.startShooting() which will handle everything

    if (this.player && this.player.modelLoaded) {
      this.player.startShooting();

      // Play firing animation
      if (this.player.currentAnimation !== "reloading") {
        this.player.playAnimation("firing", true);

        // Schedule return to idle/walk/run after animation
        setTimeout(() => {
          if (this.player && this.player.modelLoaded) {
            if (this.player.currentAnimation === "reloading") return;

            const isMoving =
              Math.abs(this.velocity.x) > 0.01 ||
              Math.abs(this.velocity.z) > 0.01;
            if (isMoving) {
              this.player.playAnimation(this.isRunning ? "run" : "walk", true);
            } else {
              this.player.playAnimation("idle", true);
            }
          }
        }, 200);
      }
    }
  }

  // Add reload method
  reload() {
    if (!this.enabled) return;

    if (this.player && this.player.modelLoaded) {
      this.player.reloadWeapon();
      this.player.playAnimation("reloading", true, false);
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

  applySpineRotation() {
    if (!this.spineBone) return;

    // Directly set the rotation with very high influence
    // Use 0.8 for much faster response and to override animations
    this.spineBone.rotation.x +=
      (this.spineTargetRotation - this.spineBone.rotation.x) * 0.8;

    // Force clamp to target if close enough
    if (Math.abs(this.spineBone.rotation.x - this.spineTargetRotation) < 0.01) {
      this.spineBone.rotation.x = this.spineTargetRotation;
    }

    // Constrain other axes to prevent weird twisting
    this.spineBone.rotation.y = 0;
    this.spineBone.rotation.z = 0;

    // Force matrix update to ensure changes take effect
    this.spineBone.updateMatrix();
  }

  // Also add this method to find spine bone when model changes:
  findSpineBone() {
    if (!this.player || !this.player.modelLoaded) return;

    const model = this.player.pitchObj.children[0];
    if (!model) return;

    // Try all possible spine bone names
    const spineNames = [
      "mixamorigSpine1",
      "mixamorigSpine",
      "Spine1",
      "Spine",
      "mixamorigSpine2",
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

  // Update updateSpineRotation to use the find method:
  updateSpineRotation() {
    if (!this.player || !this.player.modelLoaded) return;

    if (this.isAiming) {
      // Find spine bone if not found yet
      if (!this.spineBone) {
        this.findSpineBone();
        return;
      }

      // Check if spine bone still exists (model might have changed)
      if (!this.spineBone.parent) {
        this.spineBone = null;
        return;
      }

      // Get camera vertical rotation and map to desired range
      const minCam = 0.1; // ~5.7° - looking up
      const maxCam = this.PI_2 - 0.1; // ~84.3° - looking down

      // Map to desired spine rotation range
      const minSpine = (-15 * Math.PI) / 180; // -15° (look up)
      const maxSpine = (45 * Math.PI) / 180; // 45° (look down)

      // Clamp and map camera rotation to spine rotation
      const camY = Math.max(minCam, Math.min(maxCam, this.cameraRotation.y));
      const t = (camY - minCam) / (maxCam - minCam);
      this.spineTargetRotation = minSpine + t * (maxSpine - minSpine);
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

      // ✅ Define a deadzone in the middle — spine only rotates beyond these thresholds
      const deadzoneLow = 0.6; // camera Y below this = look up zone
      const deadzoneHigh = 1.0; // camera Y above this = look down zone
      // Between 0.6 and 1.0 = neutral, spine stays at 0

      let spineTarget = 0;

      if (this.cameraRotation.y < deadzoneLow) {
        // ✅ Looking up — map deadzoneLow → minCam to 0 → minSpine
        const t =
          (deadzoneLow - this.cameraRotation.y) / (deadzoneLow - minCam);
        const clampedT = Math.max(0, Math.min(1, t));
        const minSpine = (-30 * Math.PI) / 180;
        spineTarget = minSpine * clampedT;
      } else if (this.cameraRotation.y > deadzoneHigh) {
        // ✅ Looking down — map deadzoneHigh → maxCam to 0 → maxSpine
        const t =
          (this.cameraRotation.y - deadzoneHigh) / (maxCam - deadzoneHigh);
        const clampedT = Math.max(0, Math.min(1, t));
        const maxSpine = (85 * Math.PI) / 180;
        spineTarget = maxSpine * clampedT;
      } else {
        // ✅ Inside deadzone — no spine rotation
        spineTarget = 0;
      }

      this.spineTargetRotation = spineTarget;
    }
  }

  update(delta) {
    if (!this.enabled) return;

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

    // While aiming, use player body facing for movement (not camera orbit angle)
    // This prevents direction drift when playerObj.rotation.y and cameraRotation.x desync
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

    // const currentSpeed = this.isRunning ? this.runSpeed : this.walkSpeed;
    const currentSpeed = this.isAiming
      ? this.walkSpeed * 0.5 // RE-style slow strafe while aimed
      : this.isRunning
        ? this.runSpeed
        : this.walkSpeed;

    if (this.moveDirection.length() > 0) {
      this.moveDirection.normalize();

      if (!this.isAiming) {
        // Free movement: player faces movement direction
        const targetAngle = Math.atan2(
          this.moveDirection.x,
          this.moveDirection.z,
        );
        const adjustedTargetAngle = targetAngle + Math.PI;
        let angleDiff = adjustedTargetAngle - this.playerObj.rotation.y;
        angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
        this.playerObj.rotation.y += angleDiff * 0.1;
      }

      const targetVelX = this.moveDirection.x * currentSpeed;
      const targetVelZ = this.moveDirection.z * currentSpeed;
      this.velocity.x += (targetVelX - this.velocity.x) * 0.1;
      this.velocity.z += (targetVelZ - this.velocity.z) * 0.1;
    } else {
      this.velocity.x *= 0.92;
      this.velocity.z *= 0.92;
    }

    // ─── AIM BODY ROTATION ────────────────────────
    if (this.isAiming) {
      const targetYaw = this.cameraRotation.x - 0.1;
      let yawDiff = targetYaw - this.playerObj.rotation.y;
      yawDiff = Math.atan2(Math.sin(yawDiff), Math.cos(yawDiff));
      this.playerObj.rotation.y += yawDiff * 0.15;
    }

    // ─── GRAVITY ──────────────────────────────────
    this.velocity.y -= 0.2 * delta;
    if (this.isOnObject) this.velocity.y = Math.max(0, this.velocity.y);

    // ─── MOVE PLAYER ONCE ─────────────────────────
    this.playerObj.position.add(this.velocity);

    // ─── GROUND + WORLD COLLISIONS ────────────────
    this.checkCollisions(); // ✅ ground check — sets isOnObject/canJump

    // ─── BUILDING COLLISIONS (push out only, no position.add) ─────
    this.resolveBuildingCollisions(); // ✅ renamed — only resolves, no double-move

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
    if (!this.shootingCooldown && this.player && this.player.modelLoaded) {
      const isMoving =
        Math.abs(this.velocity.x) > 0.01 || Math.abs(this.velocity.z) > 0.01;
      if (isMoving) {
        this.player.playAnimation(this.isRunning ? "run" : "walk", true);
      } else if (wasMoving && !isMoving) {
        this.player.playAnimation("idle", true);
      }
    }

    // ─── SPINE ROTATION ───────────────────────────
    this.updateSpineRotation();

    // Apply spine rotation multiple times in different phases
    if (this.spineBone) {
      // First application - moderate
      this.applySpineRotation();

      // Second application after a tiny delay via setTimeout
      // This helps fight animation blending
      setTimeout(() => {
        if (this.spineBone) {
          this.spineBone.rotation.x +=
            (this.spineTargetRotation - this.spineBone.rotation.x) * 0.5;
        }
      }, 0);

      // Also apply in next frame via requestAnimationFrame
      requestAnimationFrame(() => {
        if (this.spineBone) {
          this.spineBone.rotation.x +=
            (this.spineTargetRotation - this.spineBone.rotation.x) * 0.3;
        }
      });
    }

    // ─── BOUNDARY ─────────────────────────────────
    this.enforceMapBoundary();

    // ─── CAMERA ───────────────────────────────────
    this.updateCameraPosition(delta);
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

    if (this.isAiming) {
      const camYaw = this.cameraRotation.x;

      const eyePos = this.playerObj.position.clone();
      eyePos.y += 16;

      const pullDist = 18;
      const backX = Math.sin(camYaw) * pullDist;
      const backZ = Math.cos(camYaw) * pullDist;

      const sideOffset = 6;
      const rightX = Math.cos(camYaw) * sideOffset;
      const rightZ = -Math.sin(camYaw) * sideOffset;

      const maxDownwardAngle = 0.25; // Adjust this value (higher = less downward movement)
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

      this.camera.position.lerp(targetPos, 0.25);

      // Look target also needs to move vertically with pitch
      const lookDist = 80;
      const pitchAngle = (pitchNorm - 0.3) * (Math.PI * 0.6); // -0.57 to +1.0 radians
      const aimTarget = new THREE.Vector3(
        this.playerObj.position.x -
          Math.sin(camYaw) * lookDist * Math.cos(pitchAngle),
        this.playerObj.position.y + 14 - Math.sin(pitchAngle) * lookDist,
        this.playerObj.position.z -
          Math.cos(camYaw) * lookDist * Math.cos(pitchAngle),
      );
      this.camera.lookAt(aimTarget);
    } else {
      // --- Standard third-person free orbit (your existing code) ---
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

      this.camera.position.lerp(targetCameraPos, 0.3);

      const lookAtPos = this.playerObj.position
        .clone()
        .add(new THREE.Vector3(6, 16, 0));
      this.camera.lookAt(lookAtPos);
    }
  }

  checkCollisions() {
    this.isOnObject = false;
    this.canJump = false;

    // ✅ Cast downward from player's feet
    this.caster.set(
      new THREE.Vector3(
        this.playerObj.position.x,
        this.playerObj.position.y + 1, // slightly above feet
        this.playerObj.position.z,
      ),
      new THREE.Vector3(0, -1, 0),
    );

    const intersections = this.caster.intersectObjects(
      this.world.getObjects(),
      true,
    ); // ✅ recursive = true

    if (intersections.length > 0) {
      const distance = intersections[0].distance;
      if (distance < 2) {
        // ✅ within 2 units below feet
        this.isOnObject = true;
        this.canJump = true;

        // ✅ Push player up so they sit on surface instead of falling through
        this.playerObj.position.y = intersections[0].point.y;
        this.velocity.y = 0;
      }
    }

    // ✅ Fallback ground at y=0
    if (this.playerObj.position.y <= 0) {
      this.playerObj.position.y = 0;
      this.velocity.y = 0;
      this.isOnObject = true;
      this.canJump = true;
    }
  }

  resolveBuildingCollisions() {
    if (!this.world.buildingMeshes || !this.playerCollider) return;

    const capsule = this.playerCollider;
    let collisionDetected = false;
    let groundY = null;

    // Run multiple iterations to catch all overlapping surfaces
    const ITERATIONS = 3;

    for (let iter = 0; iter < ITERATIONS; iter++) {
      for (const mesh of this.world.buildingMeshes) {
        if (!mesh.geometry.boundsTree) continue;

        const inverseMat = new THREE.Matrix4().copy(mesh.matrixWorld).invert();
        const localStart = capsule.start.clone().applyMatrix4(inverseMat);
        const localEnd = capsule.end.clone().applyMatrix4(inverseMat);
        const segment = new THREE.Line3(localStart, localEnd);

        const scaleX = mesh.matrixWorld.elements[0];
        const scaleZ = mesh.matrixWorld.elements[10];
        const localRadius =
          capsule.radius / Math.max(Math.abs(scaleX), Math.abs(scaleZ));

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

            if (dist < localRadius) {
              collisionDetected = true;
              const depth = localRadius - dist;

              const worldCapsulePoint = capsulePoint
                .clone()
                .applyMatrix4(mesh.matrixWorld);
              const worldTriPoint = triPoint
                .clone()
                .applyMatrix4(mesh.matrixWorld);

              // Calculate push direction
              const pushDir = worldCapsulePoint
                .clone()
                .sub(worldTriPoint)
                .normalize();

              if (pushDir.lengthSq() < 0.001) return;

              const worldDepth =
                depth * Math.max(Math.abs(scaleX), Math.abs(scaleZ));

              // Apply correction
              const correction = pushDir.clone().multiplyScalar(worldDepth);
              this.playerObj.position.add(correction);
              capsule.start.add(correction);
              capsule.end.add(correction);

              // Update local coordinates
              localStart.copy(capsule.start).applyMatrix4(inverseMat);
              localEnd.copy(capsule.end).applyMatrix4(inverseMat);
              segment.set(localStart, localEnd);

              // Cancel velocity into surface
              const velDot = this.velocity.dot(pushDir);
              if (velDot < 0) {
                this.velocity.addScaledVector(pushDir, -velDot);
              }

              // Track ground Y for slope following
              if (pushDir.y > 0.3) {
                this.isOnObject = true;
                this.canJump = true;
                this.velocity.y = Math.max(0, this.velocity.y);

                // Store the highest ground point for slope following
                if (groundY === null || worldTriPoint.y > groundY) {
                  groundY = worldTriPoint.y;
                }
              }
            }
          },
        });
      }
    }

    // Slope following - keep player on ground
    if (this.isOnObject && groundY !== null) {
      const targetY = groundY + 8; // Add capsule offset

      // Smoothly interpolate to target Y position
      // This creates a smooth sliding motion up/down slopes
      this.playerObj.position.y +=
        (targetY - this.playerObj.position.y) * this.verticalSmoothFactor;

      // Update capsule
      capsule.start.y = this.playerObj.position.y + 8;
      capsule.end.y = this.playerObj.position.y + 14;
    }

    // If no collision detected, apply gravity normally
    if (!collisionDetected) {
      this.isOnObject = false;
      this.canJump = false;
    }
  }

  checkBuildingCollisions() {
    if (!this.world.buildingMeshes || !this.playerCollider) return;

    // ✅ Move player first, then resolve
    this.playerObj.position.add(this.velocity);

    // Update capsule to new position
    const capsule = this.playerCollider;
    capsule.start.copy(this.playerObj.position).add(new THREE.Vector3(0, 2, 0));
    capsule.end.copy(this.playerObj.position).add(new THREE.Vector3(0, 10, 0));

    for (const mesh of this.world.buildingMeshes) {
      if (!mesh.geometry.boundsTree) continue;

      const inverseMat = new THREE.Matrix4().copy(mesh.matrixWorld).invert();
      const localStart = capsule.start.clone().applyMatrix4(inverseMat);
      const localEnd = capsule.end.clone().applyMatrix4(inverseMat);
      const segment = new THREE.Line3(localStart, localEnd);

      mesh.geometry.boundsTree.shapecast({
        intersectsBounds: (box) => {
          const capsuleBox = new THREE.Box3()
            .setFromPoints([localStart, localEnd])
            .expandByScalar(capsule.radius);
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

          if (dist < capsule.radius) {
            const depth = capsule.radius - dist;

            // ✅ Push direction in world space
            const worldCapsulePoint = capsulePoint
              .clone()
              .applyMatrix4(mesh.matrixWorld);
            const worldTriPoint = triPoint
              .clone()
              .applyMatrix4(mesh.matrixWorld);
            const pushDir = worldCapsulePoint
              .clone()
              .sub(worldTriPoint)
              .normalize();
            const correction = pushDir.multiplyScalar(depth);

            // ✅ Apply correction to player position and capsule
            this.playerObj.position.add(correction);
            capsule.start.add(correction);
            capsule.end.add(correction);

            // ✅ Cancel velocity into the wall
            const velDot = this.velocity.dot(pushDir.negate());
            if (velDot > 0) {
              this.velocity.add(pushDir.multiplyScalar(velDot));
            }
          }
        },
      });
    }

    // ✅ Ground clamp after collision resolution
    if (this.playerObj.position.y < 0) {
      this.velocity.y = 0;
      this.playerObj.position.y = 0;
      this.canJump = true;
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
        z-index: 9999;
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

  // Add this simpler raycast method as backup
  checkBuildingCollisionsRaycast() {
    if (!this.world.buildingMeshes || this.world.buildingMeshes.length === 0) {
      return;
    }

    const playerPos = this.playerObj.position;
    const rayDirections = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1),
    ];

    const collisionCheckDistance = 12; // CHANGE THIS - was this.buildingCollisionRadius + 5

    for (const dir of rayDirections) {
      this.caster.ray.origin.copy(playerPos);
      this.caster.ray.direction.copy(dir);

      const intersections = this.caster.intersectObjects(
        this.world.buildingMeshes,
      );

      if (
        intersections.length > 0 &&
        intersections[0].distance < collisionCheckDistance // CHANGE THIS
      ) {
        // Push player away
        const pushDir = dir.clone().negate();
        const pushAmount = 2; // CHANGE THIS - simpler fixed push amount
        playerPos.add(pushDir.multiplyScalar(pushAmount));

        // Stop velocity in that direction
        const dot = this.velocity.dot(dir);
        if (dot > 0) {
          this.velocity.add(dir.clone().multiplyScalar(-dot));
        }
      }
    }
  }

  unlock() {
    this.enabled = true;
    if (this.blocker) this.blocker.style.display = "none";
  }

  lock() {
    this.enabled = false;
    if (this.blocker) this.blocker.style.display = "block";
    if (this.instructions) this.instructions.style.display = "";
    this.blurMessage();
  }

  startAiming() {
    if (this.isAiming) return;
    this.isAiming = true;
    this.targetFOV = this.aimFOV;
    // Do NOT touch playerObj.rotation.y or cameraRotation here
    if (this.world && this.world.crosshair3D) {
      this.world.crosshair3D.setAiming(true);
    }
    if (this.player?.modelLoaded) {
      this.player.playAnimation("idle", true);
    }
  }

  stopAiming() {
    if (!this.isAiming) return;
    this.isAiming = false;
    this.targetFOV = this.normalFOV;
    // cameraRotation.x is already correct — no sync needed
    // playerObj.rotation.y ≈ cameraRotation.x, orbit resumes seamlessly
    if (this.world && this.world.crosshair3D) {
      this.world.crosshair3D.setAiming(false);
    }
  }

  init() {
    if (this.isMobile) {
      console.log("Mobile device detected - skipping pointer lock");
      this.enabled = true; // Enable controls immediately
      if (this.blocker) this.blocker.style.display = "none";
      if (this.instructions) this.instructions.style.display = "none";
      return;
    }

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
      const pointerlockchange = () => {
        if (
          document.pointerLockElement === element ||
          document.mozPointerLockElement === element ||
          document.webkitPointerLockElement === element
        ) {
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
  }
}
