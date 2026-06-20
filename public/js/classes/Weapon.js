// import { DEVELOPMENT_MODE } from "../main.js";
import * as THREE from "three";

export default class Weapon {
  constructor(config) {
    this.config = config;
    this.name = config.name;
    this.modelPath = config.modelPath;
    this.handleObject = config.handleObject;
    this.ammo = config.ammo;
    this.maxAmmo = config.maxAmmo;
    this.damage = config.damage;
    this.reloadTime = config.reloadTime;
    this.fireRate = config.fireRate;
    this.range = config.range;
    this.accuracy = config.accuracy;
    this.weight = config.weight;
    this.recoil = config.recoil;
    this.muzzleFlashSize = config.muzzleFlashSize;
    this.muzzleFlashColor = config.muzzleFlashColor;
    this.muzzleFlashDuration = config.muzzleFlashDuration;
    this.sound = config.sound;
    this.bulletSpeed = config.bulletSpeed;
    this.bulletSize = config.bulletSize;
    this.bulletColor = config.bulletColor;
    this.spread = config.spread || 0.0;
    this.pellets = config.pellets || 1;
    this.scale = config.scale || 1.0;

    this.model = null;
    this.isReloading = false;
    this.lastFireTime = 0;
    this.reloadStartTime = 0;
    this.muzzleFlash = null;
    this.muzzleFlashLight = null;
    this.muzzleFlashEndTime = 0;
    this.rotation = config.rotation || { x: 0, y: 0, z: 0 };
    this.position = config.position || { x: 0, y: 0, z: 0 };

    // Cache for muzzle position
    this.cachedMuzzlePosition = null;
    this.muzzlePositionNeedsUpdate = true;

    // ✅ Callbacks — always defined so they are safe to call
    this.onReloadStart = null;
    this.onReloadComplete = null;

    // New properties for holstered weapons
    this.holsteredModel = null;
    this.isHolstered = false;
    this.holsterPosition = { x: 0, y: 0, z: 0 };
    this.holsterRotation = { x: 0, y: 0, z: 0 };

    this.fireMode = config.fireMode || "semi"; // "semi", "auto", "bolt", "pump"
    this.triggerType = config.triggerType || "click"; // "click", "hold", "delay"
    this.isFiring = false; // Track if fire button is held
    this.fireInterval = null; // For auto-fire
    this.lastAutoFireTime = 0;
  }

  startFiring() {
    if (this.fireMode === "auto") {
      this.isFiring = true;
      this.autoFire();
    } else if (this.fireMode === "semi") {
      // Semi-auto: fire once per click
      return this.fire();
    }
    return false;
  }

  stopFiring() {
    this.isFiring = false;
    if (this.fireInterval) {
      clearTimeout(this.fireInterval);
      this.fireInterval = null;
    }
  }

  autoFire() {
    if (!this.isFiring) return;

    const currentTime = Date.now() / 1000;
    const timeSinceLastFire = currentTime - this.lastFireTime;

    if (timeSinceLastFire >= this.fireRate && this.canFire()) {
      this.fire();
      this.lastFireTime = currentTime;
    }

    // Schedule next check
    this.fireInterval = setTimeout(
      () => {
        this.autoFire();
      },
      Math.max(10, (this.fireRate * 1000) / 2),
    ); // Check twice per fire rate cycle
  }

  createHolsteredVersion() {
    if (!this.model) return null;

    const holstered = this.model.clone();
    // Use config.scale if available, otherwise use default
    const scaleValue =
      this.config && this.config.holsterScale
        ? this.config.holsterScale
        : this.scale * 0.7;

    holstered.scale.set(scaleValue, scaleValue, scaleValue);

    holstered.userData.isHolstered = true;
    holstered.userData.weaponName = this.name;

    return holstered;
  }

  attachHolstered(parent, position, rotation) {
    if (!this.holsteredModel) {
      this.holsteredModel = this.createHolsteredVersion();
    }

    if (this.holsteredModel) {
      this.holsteredModel.position.set(position.x, position.y, position.z);
      this.holsteredModel.rotation.set(rotation.x, rotation.y, rotation.z);
      parent.add(this.holsteredModel);
      this.isHolstered = true;
    }
  }

  detachHolstered() {
    if (this.holsteredModel && this.holsteredModel.parent) {
      this.holsteredModel.parent.remove(this.holsteredModel);
    }
    this.isHolstered = false;
  }

  canFire() {
    if (this.isReloading) return false;
    if (this.ammo <= 0) return false;

    const currentTime = Date.now() / 1000;
    const timeSinceLastFire = currentTime - this.lastFireTime;
    return timeSinceLastFire >= this.fireRate;
  }

  fire(scene, pitchObj = null, threeObj = null) {
    if (!this.canFire()) return false;

    this.ammo--;
    this.lastFireTime = Date.now() / 1000;

    this.createMuzzleFlash(scene, pitchObj, threeObj);

    // ✅ Auto-reload when last bullet is fired
    if (this.ammo <= 0 && !this.isReloading) {
      this.startReload();
    }

    return true;
  }

  // Find the farthest point (muzzle) of the weapon
  findMuzzlePosition() {
    if (!this.model) return null;

    // Return cached position if model hasn't moved
    if (!this.muzzlePositionNeedsUpdate && this.cachedMuzzlePosition) {
      return this.cachedMuzzlePosition.clone();
    }

    const bbox = new THREE.Box3().setFromObject(this.model);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    bbox.getCenter(center);
    bbox.getSize(size);

    const forward = new THREE.Vector3(0, 0, -1);

    let farthestPoint = null;
    let maxDot = -Infinity;

    this.model.traverse((child) => {
      if (child.isMesh && child.geometry) {
        const geometry = child.geometry;
        const positionAttribute = geometry.attributes.position;

        if (positionAttribute) {
          const vertex = new THREE.Vector3();
          for (let i = 0; i < positionAttribute.count; i++) {
            vertex.fromBufferAttribute(positionAttribute, i);
            child.localToWorld(vertex);

            const dot = vertex.dot(forward);
            if (dot > maxDot) {
              maxDot = dot;
              farthestPoint = vertex.clone();
            }
          }
        }
      }
    });

    if (!farthestPoint) {
      farthestPoint = center.clone().add(forward.multiplyScalar(size.z / 2));
    }

    this.cachedMuzzlePosition = farthestPoint.clone();
    this.muzzlePositionNeedsUpdate = false;

    return farthestPoint;
  }

  markMuzzleDirty() {
    this.muzzlePositionNeedsUpdate = true;
  }

  createMuzzleFlash(scene, pitchObj = null, threeObj = null) {
    if (this.muzzleFlash) {
      scene.remove(this.muzzleFlash);
      this.muzzleFlash = null;
    }

    if (this.muzzleFlashLight) {
      scene.remove(this.muzzleFlashLight);
      this.muzzleFlashLight = null;
    }

    // ✅ Find Cylinder in the live scene (pitchObj/threeObj), not original model
    let cylinderMesh = null;

    if (pitchObj) {
      pitchObj.traverse((child) => {
        if (child.name === "Cylinder" && !cylinderMesh) {
          cylinderMesh = child;
        }
      });
    }

    if (!cylinderMesh && threeObj) {
      threeObj.traverse((child) => {
        if (child.name === "Cylinder" && !cylinderMesh) {
          cylinderMesh = child;
        }
      });
    }

    if (!cylinderMesh) return;

    const worldPos = new THREE.Vector3();
    cylinderMesh.getWorldPosition(worldPos);

    const flashGeometry = new THREE.SphereGeometry(this.muzzleFlashSize, 8, 8);
    const flashMaterial = new THREE.MeshBasicMaterial({
      color: this.muzzleFlashColor,
      transparent: true,
      opacity: 0.2,
    });

    this.muzzleFlash = new THREE.Mesh(flashGeometry, flashMaterial);
    this.muzzleFlash.scale.set(0.2, 0.2, 0.2);
    this.muzzleFlash.position.copy(worldPos);

    // ✅ Add point light for glow effect
    const flashLight = new THREE.PointLight(this.muzzleFlashColor, 3, 20);
    flashLight.position.copy(worldPos);
    this.muzzleFlashLight = flashLight;

    scene.add(this.muzzleFlash);
    scene.add(flashLight);

    this.muzzleFlashEndTime = Date.now() + this.muzzleFlashDuration * 1000;
  }

  updateMuzzleFlash(scene) {
    if (!this.muzzleFlash) return;

    const currentTime = Date.now();
    if (currentTime >= this.muzzleFlashEndTime) {
      scene.remove(this.muzzleFlash);
      this.muzzleFlash = null;

      if (this.muzzleFlashLight) {
        scene.remove(this.muzzleFlashLight);
        this.muzzleFlashLight = null;
      }
    } else {
      const timeLeft = this.muzzleFlashEndTime - currentTime;
      const fadeProgress = timeLeft / (this.muzzleFlashDuration * 1000);
      this.muzzleFlash.material.opacity = 0.2 * fadeProgress;
      // this.muzzleFlash.scale.setScalar(1 + (1 - fadeProgress) * 0.5);

      if (this.muzzleFlashLight) {
        this.muzzleFlashLight.intensity = 3 * fadeProgress;
      }
    }
  }

  startReload() {
    if (this.isReloading || this.ammo >= this.maxAmmo) return false;

    this.isReloading = true;
    this.reloadStartTime = Date.now();

    // ✅ Fire callback so Player can play animation
    if (this.onReloadStart) this.onReloadStart();

    setTimeout(() => {
      this.completeReload();
      // ✅ Fire callback so Player can return to idle/walk/run
      if (this.onReloadComplete) this.onReloadComplete();
    }, this.reloadTime * 1000);

    return true;
  }

  completeReload() {
    this.ammo = this.maxAmmo;
    this.isReloading = false;
  }

  isReloadComplete() {
    if (!this.isReloading) return true;
    const currentTime = Date.now();
    return currentTime - this.reloadStartTime >= this.reloadTime * 1000;
  }

  playSound(soundType) {
    // Implement sound effects here
  }

  update(delta, scene) {
    // ✅ Only update muzzle flash — setTimeout in startReload handles reload completion
    this.updateMuzzleFlash(scene);
  }

  getSpeedMultiplier() {
    return 1.0 / Math.max(0.5, Math.min(2.0, this.weight));
  }
}
