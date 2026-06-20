// classes/Room.js
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

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
  }

  // ─────────────────────────────────────────────
  // BOX LOADING
  // ─────────────────────────────────────────────

  loadBoxesIfNeeded() {
    if (this.boxesLoaded) return;
    this.boxesLoaded = true;

    const loader = new GLTFLoader();

    loader.load(
      "/assets/models/soviet_weapons_ammo_crate_box_animated_low_poly-opt-opt.glb",
      (gltf) => {
        if (this.ammoBoxModel) {
          this.world.scene.remove(this.ammoBoxModel);
        }

        this.ammoBoxModel = gltf.scene;
        this.ammoBoxModel.scale.set(2, 2, 2);
        this.ammoBoxModel.position.copy(this.ammoBoxPosition);
        this.ammoBoxModel.position.y += 0.5;
        this.ammoBoxModel.visible = this.isActive;
        this.world.scene.add(this.ammoBoxModel);

        this.ammoLid = null;
        this.ammoBoxModel.traverse((child) => {
          if (child.name === "lid_crate_0") {
            this.ammoLid = child;
          }
        });

        this.updateAmmoBoxVisual();

        this.ammoBoxModel.userData = {
          initialY: this.ammoBoxModel.position.y,
        };
      },
    );

    loader.load("/assets/models/pelican_case_game_ready-opt.glb", (gltf) => {
      if (this.vaccineBoxModel) {
        this.world.scene.remove(this.vaccineBoxModel);
      }

      this.vaccineBoxModel = gltf.scene;
      this.vaccineBoxModel.scale.set(0.02, 0.02, 0.02);
      this.vaccineBoxModel.position.copy(this.vaccineBoxPosition);
      this.vaccineBoxModel.position.y += 0.5;
      this.vaccineBoxModel.visible = this.isActive;
      this.world.scene.add(this.vaccineBoxModel);

      this.vaccineLid = null;
      this.vaccineBoxModel.traverse((child) => {
        if (child.name === "Case_Upper") {
          this.vaccineLid = child;
        }
      });

      this.updateVaccineBoxVisual();

      this.vaccineBoxModel.userData = {
        initialY: this.vaccineBoxModel.position.y,
        phase: Math.PI,
      };
    });
  }

  // ─────────────────────────────────────────────
  // AMMO CONTENTS — load ammo_boxes_pack duplicated x2 = 12 child meshes
  // ─────────────────────────────────────────────

  loadAmmoContents() {
    if (this.ammoContentsGroup) return; // already loaded

    const loader = new GLTFLoader();
    loader.load(
      "/assets/models/ammo_boxes_pack_low-poly_game-ready-opt.glb",
      (gltf) => {
        this.ammoContentsGroup = new THREE.Group();
        this.ammoChildMeshes = [];
        this.ammoTakenCount = 0;

        const TOTAL_DUPLICATES = 2;

        for (let d = 0; d < TOTAL_DUPLICATES; d++) {
          gltf.scene.traverse((child) => {
            if (child.isMesh) {
              // ✅ Clone the mesh itself (NOT the whole scene)
              const mesh = child.clone();

              mesh.scale.set(0.1, 0.1, 0.1);

              // ✅ FULL control of position now
              mesh.position.set(
                (Math.random() - 0.5) * 8.0, // much wider spread
                Math.random() * 0.2,
                (Math.random() - 0.5) * 8.0,
              );

              mesh.rotation.y = Math.random() * Math.PI;

              this.ammoContentsGroup.add(mesh);
              this.ammoChildMeshes.push(mesh);
            }
          });
        }

        console.log(
          `Ammo contents loaded: ${this.ammoChildMeshes.length} meshes`,
        );

        this.ammoContentsGroup.position.copy(this.ammoBoxPosition);
        this.ammoContentsGroup.position.y += 1.2;

        this.ammoContentsGroup.scale.set(0.5, 0.5, 0.5);
        this.ammoContentsGroup.visible = false;

        this.world.scene.add(this.ammoContentsGroup);
      },
    );
  }

  // ─────────────────────────────────────────────
  // VACCINE CONTENTS — load syringe model duplicated x10
  // ─────────────────────────────────────────────

  loadVaccineContents() {
    if (this.vaccineContentsGroup) return;

    const loader = new GLTFLoader();
    loader.load(
      "/assets/models/syringe-opt.glb",
      (gltf) => {
        this.vaccineContentsGroup = new THREE.Group();
        this.syringeMeshes = [];
        this.vaccineTakenCount = 0;

        const SYRINGE_COUNT = 10;

        for (let i = 0; i < SYRINGE_COUNT; i++) {
          const clone = gltf.scene.clone(true);

          // ✅ Arrange syringes in a small grid inside the case
          const col = i % 5;
          const row = Math.floor(i / 5);

          const SPACING_X = 0.5; // was 0.25
          const SPACING_Z = 0.7; // was 0.35

          clone.position.set((col - 2) * SPACING_X, 0, (row - 0.5) * SPACING_Z);

          // Lay them flat
          clone.rotation.set(Math.PI / 2, 0, 0);
          clone.scale.set(0.1, 0.1, 0.1);

          this.vaccineContentsGroup.add(clone);
          this.syringeMeshes.push(clone);
        }

        // Position inside open vaccine case
        this.vaccineContentsGroup.position.copy(this.vaccineBoxPosition);
        this.vaccineContentsGroup.position.y += 1.0;
        this.vaccineContentsGroup.visible = false; // hidden until opened

        this.world.scene.add(this.vaccineContentsGroup);

        console.log(`Vaccine contents loaded: ${SYRINGE_COUNT} syringes`);
      },
      undefined,
      (err) => console.error("Failed to load vaccine contents:", err),
    );
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
    const geometry = new THREE.SphereGeometry(this.radius, 32, 16);
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
      `Ammo piece removed. Remaining: ${visible.length - 1}/${this.ammoChildMeshes.length}`,
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
      `Syringe removed. Remaining: ${visible.length - 1}/${this.syringeMeshes.length}`,
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
    const time = Date.now() * 0.001;

    if (this.ammoBoxModel && !this.ammoBoxOpen) {
      this.ammoBoxModel.position.y =
        this.ammoBoxPosition.y + 0.5 + Math.sin(time * 2) * 0.2;
      this.ammoBoxModel.rotation.y += 0.01;
    }

    if (this.vaccineBoxModel && !this.vaccineBoxOpen) {
      this.vaccineBoxModel.position.y =
        this.vaccineBoxPosition.y + 0.5 + Math.sin(time * 2 + Math.PI) * 0.2;
      this.vaccineBoxModel.rotation.y -= 0.01;
    }

    // ✅ Keep contents group anchored to box position (box floats)
    if (this.ammoContentsGroup && this.ammoBoxOpen) {
      this.ammoContentsGroup.position.y =
        this.ammoBoxPosition.y + 1.2 + Math.sin(time * 2) * 0.2;
    }

    if (this.vaccineContentsGroup && this.vaccineBoxOpen) {
      this.vaccineContentsGroup.position.y =
        this.vaccineBoxPosition.y + 1.0 + Math.sin(time * 2 + Math.PI) * 0.2;
    }

    if (this.activeGlow) {
      const pulse = 0.1 + Math.sin(time * 3) * 0.05;
      this.activeGlow.material.opacity = pulse;
    }

    if (!this.playerInRoom && this.promptSprite) {
      this.world.scene.remove(this.promptSprite);
      this.promptSprite = null;
    }
  }
}
