// classes/Room.js
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export default class Room {
  constructor(data, world, socket) {
    this.id = data.id;
    this.buildingId = data.buildingId;
    this.name = data.name;
    this.position = new THREE.Vector3(
      data.position.x,
      data.position.y,
      data.position.z,
    );
    this.ammoBoxPosition = new THREE.Vector3(
      data.ammoBoxPosition.x,
      data.ammoBoxPosition.y,
      data.ammoBoxPosition.z,
    );
    this.vaccineBoxPosition = new THREE.Vector3(
      data.vaccineBoxPosition.x,
      data.vaccineBoxPosition.y,
      data.vaccineBoxPosition.z,
    );
    this.radius = data.radius || 15;
    this.world = world;
    this.socket = socket;

    // Box states
    this.ammoBoxOpen = false;
    this.vaccineBoxOpen = false;
    this.ammoCollectedCount = 0;
    this.vaccineCollectedCount = 0;
    this.isActive = false;
    this.timeRemaining = 0;
    this.playerInRoom = false;

    // Models and animations
    this.ammoBoxModel = null;
    this.vaccineBoxModel = null;
    this.ammoMixer = null;
    this.vaccineMixer = null;
    this.ammoAction = null;
    this.vaccineAction = null;

    // ─── Contents tracking ─────────────────────
    // Ammo: 2 duplicates of ammo_boxes_pack model, each has child meshes
    // Total child meshes across both = 12 ammo slots
    this.ammoContentsGroup = null; // THREE.Group holding all ammo content meshes
    this.ammoChildMeshes = []; // flat list of individual child meshes (12 total)
    this.ammoTakenCount = 0;

    // Vaccine: 10 syringe duplicates
    this.vaccineContentsGroup = null;
    this.syringeMeshes = []; // list of syringe clone root objects
    this.vaccineTakenCount = 0;

    // Effects
    this.activeGlow = null;
    this.roomBoundary = null;

    this.boxesLoaded = false;
    this.createRoomBoundary();
    this.loadBoxesIfNeeded();
    this.loadAmmoContents();
    this.loadVaccineContents();
  }

  loadBoxesIfNeeded() {
    if (this.boxesLoaded) return;
    this.boxesLoaded = true;

    // Use cached assets instead of loading new ones
    if (this.world.assetCache.ammoCrate) {
      this.ammoBoxModel = this.world.assetCache.ammoCrate.clone();
      this.ammoBoxModel.scale.set(2, 2, 2);
      this.ammoBoxModel.position.copy(this.ammoBoxPosition);
      this.ammoBoxModel.position.y += 0.5;
      this.ammoBoxModel.visible = true;
      this.world.scene.add(this.ammoBoxModel);

      // Find lid
      this.ammoBoxModel.traverse((child) => {
        if (child.name === "lid_crate_0") this.ammoLid = child;
      });
      this.updateAmmoBoxVisual();
    }

    if (this.world.assetCache.vaccineCase) {
      this.vaccineBoxModel = this.world.assetCache.vaccineCase.clone();
      this.vaccineBoxModel.scale.set(0.02, 0.02, 0.02);
      this.vaccineBoxModel.position.copy(this.vaccineBoxPosition);
      this.vaccineBoxModel.position.y += 0.5;
      this.vaccineBoxModel.visible = true;
      this.world.scene.add(this.vaccineBoxModel);

      // Find lid
      this.vaccineBoxModel.traverse((child) => {
        if (child.name === "Case_Upper") this.vaccineLid = child;
      });
      this.updateVaccineBoxVisual();
    }
  }

  loadAmmoContents() {
    if (this.ammoContentsGroup) return;

    if (!this.world.assetCache.ammoContents) return;

    this.ammoContentsGroup = new THREE.Group();
    this.ammoChildMeshes = [];
    this.ammoTakenCount = 0;

    const TOTAL_DUPLICATES = 2;

    for (let d = 0; d < TOTAL_DUPLICATES; d++) {
      const clone = this.world.assetCache.ammoContents.clone();
      clone.traverse((child) => {
        if (child.isMesh) {
          const mesh = child.clone();
          mesh.scale.set(0.1, 0.1, 0.1);
          mesh.position.set(
            (Math.random() - 0.5) * 8.0,
            Math.random() * 0.2,
            (Math.random() - 0.5) * 8.0,
          );
          mesh.rotation.y = Math.random() * Math.PI;
          this.ammoContentsGroup.add(mesh);
          this.ammoChildMeshes.push(mesh);
        }
      });
    }

    this.ammoContentsGroup.position.copy(this.ammoBoxPosition);
    this.ammoContentsGroup.position.y += 1.2;
    this.ammoContentsGroup.scale.set(0.5, 0.5, 0.5);
    this.ammoContentsGroup.visible = false;
    this.world.scene.add(this.ammoContentsGroup);
  }

  loadVaccineContents() {
    if (this.vaccineContentsGroup) return;

    if (!this.world.assetCache.syringe) return;

    this.vaccineContentsGroup = new THREE.Group();
    this.syringeMeshes = [];
    this.vaccineTakenCount = 0;

    const SYRINGE_COUNT = 10;

    for (let i = 0; i < SYRINGE_COUNT; i++) {
      const clone = this.world.assetCache.syringe.clone(true);
      const col = i % 5;
      const row = Math.floor(i / 5);
      const SPACING_X = 0.5;
      const SPACING_Z = 0.7;
      clone.position.set((col - 2) * SPACING_X, 0, (row - 0.5) * SPACING_Z);
      clone.rotation.set(Math.PI / 2, 0, 0);
      clone.scale.set(0.1, 0.1, 0.1);
      this.vaccineContentsGroup.add(clone);
      this.syringeMeshes.push(clone);
    }

    this.vaccineContentsGroup.position.copy(this.vaccineBoxPosition);
    this.vaccineContentsGroup.position.y += 1.0;
    this.vaccineContentsGroup.visible = false;
    this.world.scene.add(this.vaccineContentsGroup);
  }

  // ─────────────────────────────────────────────
  // LID VISUALS
  // ─────────────────────────────────────────────

  updateAmmoBoxVisual() {
    if (!this.ammoLid) return;
    if (this.ammoBoxOpen) {
      this.ammoLid.rotation.x = Math.PI;
    } else {
      this.ammoLid.rotation.x = 0;
    }
  }

  updateVaccineBoxVisual() {
    if (!this.vaccineLid) return;
    if (this.vaccineBoxOpen) {
      this.vaccineLid.rotation.x = 0;
    } else {
      this.vaccineLid.rotation.x = Math.PI;
    }
  }

  // ─────────────────────────────────────────────
  // ROOM BOUNDARY
  // ─────────────────────────────────────────────

  createRoomBoundary() {
    const segments = this.isMobile ? 16 : 32;
    const geometry = new THREE.SphereGeometry(
      this.radius,
      segments,
      segments / 2,
    );
    const material = new THREE.MeshBasicMaterial({
      color: 0x44aaff,
      transparent: true,
      opacity: 0.1,
      wireframe: true,
    });
    this.roomBoundary = new THREE.Mesh(geometry, material);
    this.roomBoundary.position.copy(this.position);
    this.roomBoundary.position.y += 2;
    this.roomBoundary.visible = false;
    this.roomBoundary.matrixAutoUpdate = false;
    this.roomBoundary.updateMatrix();
    this.world.scene.add(this.roomBoundary);
  }

  // ─────────────────────────────────────────────
  // ACTIVATION
  // ─────────────────────────────────────────────

  setActive(active, expiresAt = null) {
    if (this.isActive === active) return;
    this.isActive = active;

    if (active) {
      this.loadBoxesIfNeeded();

      // ✅ Pre-load contents so they're ready when box opens
      this.loadAmmoContents();
      this.loadVaccineContents();

      if (this.ammoBoxModel) this.ammoBoxModel.visible = true;
      if (this.vaccineBoxModel) this.vaccineBoxModel.visible = true;

      if (!this.activeGlow) {
        const geometry = new THREE.SphereGeometry(this.radius, 32, 16);
        const material = new THREE.MeshBasicMaterial({
          color: 0xffaa00,
          transparent: true,
          opacity: 0.15,
          side: THREE.BackSide,
        });
        this.activeGlow = new THREE.Mesh(geometry, material);
        this.activeGlow.position.copy(this.position);
        this.activeGlow.position.y += 2;
        this.world.scene.add(this.activeGlow);
      }

      this.roomBoundary.visible = true;
    } else {
      if (this.activeGlow) {
        this.world.scene.remove(this.activeGlow);
        this.activeGlow = null;
      }

      this.ammoBoxOpen = false;
      this.vaccineBoxOpen = false;
      this.updateAmmoBoxVisual();
      this.updateVaccineBoxVisual();

      // ✅ Hide contents
      if (this.ammoContentsGroup) {
        this.ammoContentsGroup.visible = false;
        // Reset all child meshes visibility
        this.ammoChildMeshes.forEach((m) => (m.visible = true));
        this.ammoTakenCount = 0;
      }
      if (this.vaccineContentsGroup) {
        this.vaccineContentsGroup.visible = false;
        this.syringeMeshes.forEach((s) => (s.visible = true));
        this.vaccineTakenCount = 0;
      }

      if (this.ammoMixer) {
        this.ammoMixer.stopAllAction();
        this.world.removeMixer?.(this.ammoMixer);
        this.ammoMixer = null;
        this.ammoAction = null;
      }
      if (this.vaccineMixer) {
        this.vaccineMixer.stopAllAction();
        this.world.removeMixer?.(this.vaccineMixer);
        this.vaccineMixer = null;
        this.vaccineAction = null;
      }

      this.roomBoundary.visible = false;
    }
  }

  // ─────────────────────────────────────────────
  // OPEN BOX
  // ─────────────────────────────────────────────

  openBox(boxType, playerName, isFirstOpener, collectionCount) {
    if (boxType === "ammo") {
      this.ammoBoxOpen = true;
      this.ammoCollectedCount = collectionCount;
      this.updateAmmoBoxVisual();

      // ✅ Show ammo contents when first opened
      if (this.ammoContentsGroup) {
        this.ammoContentsGroup.visible = true;
      }

      // ✅ Remove one child mesh per collection (hide it)
      this.removeOneAmmoPiece();
    } else {
      this.vaccineBoxOpen = true;
      this.vaccineCollectedCount = collectionCount;
      this.updateVaccineBoxVisual();

      // ✅ Show vaccine contents when first opened
      if (this.vaccineContentsGroup) {
        this.vaccineContentsGroup.visible = true;
      }

      // ✅ Remove one syringe per collection
      this.removeOneSyringe();
    }

    this.showCollectionEffect(boxType, playerName, collectionCount);
  }

  // ─────────────────────────────────────────────
  // REMOVE AMMO PIECE — hide one child mesh
  // ─────────────────────────────────────────────

  removeOneAmmoPiece() {
    if (!this.ammoChildMeshes || this.ammoChildMeshes.length === 0) return;

    // Find the first still-visible child mesh and hide it
    const visible = this.ammoChildMeshes.filter((m) => m.visible);
    if (visible.length === 0) return;

    // ✅ Remove from the end (last collected = last mesh)
    const toRemove = visible[visible.length - 1];
    toRemove.visible = false;
    this.ammoTakenCount++;

    console.log(
      `Ammo piece removed. Remaining: ${visible.length - 1}/${
        this.ammoChildMeshes.length
      }`,
    );
  }

  // ─────────────────────────────────────────────
  // REMOVE SYRINGE — hide one syringe clone
  // ─────────────────────────────────────────────

  removeOneSyringe() {
    if (!this.syringeMeshes || this.syringeMeshes.length === 0) return;

    const visible = this.syringeMeshes.filter((s) => s.visible);
    if (visible.length === 0) return;

    const toRemove = visible[visible.length - 1];
    toRemove.visible = false;
    this.vaccineTakenCount++;

    console.log(
      `Syringe removed. Remaining: ${visible.length - 1}/${
        this.syringeMeshes.length
      }`,
    );
  }

  // ─────────────────────────────────────────────
  // CLOSE BOX (animation)
  // ─────────────────────────────────────────────

  closeBox(boxType) {
    const mixer = boxType === "ammo" ? this.ammoMixer : this.vaccineMixer;
    const action = boxType === "ammo" ? this.ammoAction : this.vaccineAction;

    if (!mixer || !action) return;

    const fullDuration = action.getClip().duration;
    const halfDuration = fullDuration / 2;

    action.paused = false;
    action.timeScale = 1;
    action.time = halfDuration;
    action.play();

    setTimeout(() => {
      action.paused = true;
      action.time = 0;
    }, halfDuration * 1000);
  }

  // ─────────────────────────────────────────────
  // EFFECTS
  // ─────────────────────────────────────────────

  createOpenEffect(position, boxType) {
    const color = boxType === "ammo" ? 0x00ff00 : 0xffff00;
    const particleCount = 20;

    for (let i = 0; i < particleCount; i++) {
      const geometry = new THREE.SphereGeometry(0.1, 4, 4);
      const material = new THREE.MeshBasicMaterial({ color });
      const particle = new THREE.Mesh(geometry, material);

      particle.position.copy(position);
      particle.position.y += 0.5;

      this.world.scene.add(particle);

      const angle = (i / particleCount) * Math.PI * 2;
      const speed = 0.02;
      const startTime = Date.now();

      const animateParticle = () => {
        const elapsed = Date.now() - startTime;
        const progress = elapsed / 500;

        if (progress < 1) {
          particle.position.x += Math.cos(angle) * speed;
          particle.position.z += Math.sin(angle) * speed;
          particle.position.y += speed;
          particle.material.opacity = 1 - progress;
          requestAnimationFrame(animateParticle);
        } else {
          this.world.scene.remove(particle);
        }
      };

      animateParticle();
    }
  }

  showCollectionEffect(boxType, playerName, collectionCount) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = boxType === "ammo" ? "#00ff00" : "#ffff00";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`${playerName} opened ${boxType}!`, canvas.width / 2, 30);
    ctx.fillStyle = "#ffffff";
    ctx.font = "14px Arial";
    ctx.fillText(`${collectionCount} collected`, canvas.width / 2, 50);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const textSprite = new THREE.Sprite(material);
    textSprite.scale.set(6, 1.5, 1);

    const boxPos =
      boxType === "ammo" ? this.ammoBoxPosition : this.vaccineBoxPosition;
    textSprite.position.copy(boxPos);
    textSprite.position.y += 3;

    this.world.scene.add(textSprite);

    setTimeout(() => {
      this.world.scene.remove(textSprite);
    }, 3000);
  }

  // ─────────────────────────────────────────────
  // PLAYER IN ROOM
  // ─────────────────────────────────────────────

  setPlayerInRoom(inRoom) {
    this.playerInRoom = inRoom;
  }

  showInteractionPrompt() {
    if (this.promptSprite) {
      this.world.scene.remove(this.promptSprite);
    }

    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Press C to collect", canvas.width / 2, 30);
    ctx.fillStyle = "#ffff00";
    ctx.fillText("(Ammo + Vaccine)", canvas.width / 2, 50);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    this.promptSprite = new THREE.Sprite(material);
    this.promptSprite.scale.set(6, 1.5, 1);
    this.promptSprite.position.copy(this.position);
    this.promptSprite.position.y += 5;

    this.world.scene.add(this.promptSprite);
  }

  // ─────────────────────────────────────────────
  // UPDATE LOOP
  // ─────────────────────────────────────────────

  update(delta) {
    // BIG SAVING: Do nothing for rooms that aren't currently in play
    if (!this.isActive) return;

    const time = Date.now() * 0.001;

    if (this.ammoBoxModel && !this.ammoBoxOpen) {
      this.ammoBoxModel.position.y =
        this.ammoBoxPosition.y + 0.5 + Math.sin(time * 2) * 0.2;
      this.ammoBoxModel.rotation.y += 0.01;
      this.ammoBoxModel.updateMatrix(); // Update matrix only when we move it
    }

    if (this.vaccineBoxModel && !this.vaccineBoxOpen) {
      this.vaccineBoxModel.position.y =
        this.vaccineBoxPosition.y + 0.5 + Math.sin(time * 2 + Math.PI) * 0.2;
      this.vaccineBoxModel.rotation.y -= 0.01;
      this.vaccineBoxModel.updateMatrix();
    }

    // Update contents groups only if they are visible
    if (
      this.ammoContentsGroup &&
      this.ammoBoxOpen &&
      this.ammoContentsGroup.visible
    ) {
      this.ammoContentsGroup.position.y =
        this.ammoBoxPosition.y + 1.2 + Math.sin(time * 2) * 0.2;
      this.ammoContentsGroup.updateMatrix();
    }

    if (
      this.vaccineContentsGroup &&
      this.vaccineBoxOpen &&
      this.vaccineContentsGroup.visible
    ) {
      this.vaccineContentsGroup.position.y =
        this.vaccineBoxPosition.y + 1.0 + Math.sin(time * 2 + Math.PI) * 0.2;
      this.vaccineContentsGroup.updateMatrix();
    }

    if (this.activeGlow) {
      this.activeGlow.material.opacity = 0.1 + Math.sin(time * 3) * 0.05;
    }
  }
}
