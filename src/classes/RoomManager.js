// classes/RoomManager.js
import Room from "./Room.js";

export default class RoomManager {
  constructor(world, socket, player, minimap = null) {
    this.world = world;
    this.socket = socket;
    this.player = player;
    this.rooms = new Map();
    this.activeRoom = null;
    this.currentRoomId = null;
    this.interactionKey = "KeyC";
    this.keyDown = false;
    this.minimap = minimap;

    // NEW: per-room-activation tracking (client-side mirror of server state)
    this.collectedAmmoThisRoom = new Set(); // set of weaponNames already collected
    this.collectedVaccineThisRoom = false;
    this.weaponSlotsFull = new Set(); // weaponNames where 2/2 slots are taken

    this.setupSocketListeners();
    this.setupKeyListeners();

    this.lastRoomCheckTime = 0;
    this.roomCheckInterval = 200; // Check every 200ms

    const style = document.createElement("style");
    style.textContent = `
    .rm-notification {
        position: fixed;
        top: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.8);
        padding: 15px 30px;
        border-radius: 5px;
        font-family: Arial;
        z-index: 10;
        display: none;
        pointer-events: none;
        font-size: 16px;
        white-space: nowrap;
    }
    
    @media (max-width: 960px) {
        .rm-notification {
            font-size: 10px;
            padding: 8px 16px;
        }
    }
`;
    document.head.appendChild(style);

    // Then create the element without inline styles
    this.notificationEl = document.createElement("div");
    this.notificationEl.className = "rm-notification";
    document.body.appendChild(this.notificationEl);
  }

  setupSocketListeners() {
    console.log("RoomManager: setting up listeners");

    this.socket.off("initRooms");
    this.socket.off("roomActivated");
    this.socket.off("boxOpened");
    this.socket.off("roomStatus");
    this.socket.off("enteredRoom");
    this.socket.off("ammoReceived");
    this.socket.off("vaccineReceived");
    this.socket.off("boxError");

    this.socket.on("initRooms", (roomsData) => {
      console.log("RoomManager: initRooms", roomsData.length);
      roomsData.forEach((roomData) => this.addRoom(roomData));
      if (this.onInitRooms) this.onInitRooms(roomsData);
      this.socket.emit("requestActiveRoom");
    });

    this.socket.on("roomActivated", (data) => {
      const room = this.rooms.get(data.roomId);
      if (!room) {
        console.warn("RoomManager: room not found for id", data.roomId);
        return;
      }

      // Deactivate previous room
      if (this.activeRoom && this.activeRoom !== room) {
        if (this.activeRoom.ammoBoxOpen) this.activeRoom.closeBox("ammo");
        if (this.activeRoom.vaccineBoxOpen) this.activeRoom.closeBox("vaccine");
        this.activeRoom.setActive(false);
        if (this.currentRoomId === this.activeRoom.id) {
          this.currentRoomId = null;
          this.showNotification("⏰ Room expired!", "#ff8800");
        }
      }

      // NEW: reset per-room collection tracking on new activation
      this.collectedAmmoThisRoom.clear();
      this.collectedVaccineThisRoom = false;
      this.weaponSlotsFull.clear();

      room.setActive(true, data.expiresAt);
      room.ammoBoxOpen = data.ammoBoxOpen;
      room.vaccineBoxOpen = data.vaccineBoxOpen;
      this.activeRoom = room;

      setTimeout(() => {
        if (!room.isActive) return;
        if (!room.ammoBoxOpen) {
          room.ammoBoxOpen = true;
          room.updateAmmoBoxVisual();
          if (room.ammoContentsGroup) room.ammoContentsGroup.visible = true;
        }
        if (!room.vaccineBoxOpen) {
          room.vaccineBoxOpen = true;
          room.updateVaccineBoxVisual();
          if (room.vaccineContentsGroup)
            room.vaccineContentsGroup.visible = true;
        }
      }, 1000);

      if (this.minimap) {
        this.minimap.updateRoomStatus(data.roomId, "active");
        this.minimap.showTarget(data.roomId);
      }

      if (this.onRoomActivated) this.onRoomActivated(data, room);
      this.showNotification(`🔔 ${room.name} is now active!`, "#ffaa00");
    });

    this.socket.on("boxOpened", (data) => {
      const room = this.rooms.get(data.roomId);
      if (room) {
        room.openBox(
          data.boxType,
          data.playerName,
          data.isFirstOpener,
          data.collectionCount,
        );

        // Show notification for local player
        if (data.playerId === this.player.id) {
          if (data.boxType === "ammo") {
            const wname = data.weaponName || "weapon";
            this.showNotification(`✅ Got ammo for ${wname}!`, "#00ff00");
          } else {
            this.showNotification("💉 You got the VACCINE!", "#ffff00");
          }
        }

        // NEW: track slot fullness for all players
        // When boxOpened fires, check if slot is now full
        if (
          data.boxType === "ammo" &&
          data.weaponName &&
          data.collectionCount >= 2
        ) {
          this.weaponSlotsFull.add(data.weaponName);
        }
      }
    });

    this.socket.on("roomStatus", (data) => {
      const room = this.rooms.get(data.roomId);
      if (room) {
        room.timeRemaining = data.timeRemaining;
        room.ammoBoxOpen = data.ammoBoxOpen;
        room.ammoCollectedCount = data.ammoCollectedCount;
        room.vaccineBoxOpen = data.vaccineBoxOpen;
        room.vaccineCollectedCount = data.vaccineCollectedCount;

        // NEW: update weapon slot fullness from status
        if (data.ammoBox && data.ammoBox.weaponSlots) {
          for (const [wname, count] of Object.entries(
            data.ammoBox.weaponSlots,
          )) {
            if (count >= 2) this.weaponSlotsFull.add(wname);
          }
        }
      }
      if (this.onRoomStatus) this.onRoomStatus(data);
    });

    this.socket.on("enteredRoom", (data) => {
      const room = this.rooms.get(data.roomId);
      if (room) {
        this.currentRoomId = data.roomId;
        room.setPlayerInRoom(true);
      }
    });

    // NEW: ammoReceived now carries weaponName + updated reserves
    this.socket.on("ammoReceived", (data) => {
      if (!this.player || !this.player.weapons) return;
      const weaponName = data.weaponName;
      const weapon = this.player.weapons.find((w) => w.name === weaponName);
      if (weapon) {
        // Refill to max ammo
        weapon.ammo = weapon.maxAmmo;
        // Store reserves on the weapon object
        weapon.reserves = (weapon.reserves || 0) + 1;
        console.log(
          `✅ Ammo received for ${weaponName} — reserves: ${weapon.reserves}`,
        );
        // Update HUD
        if (this.onAmmoUpdate) this.onAmmoUpdate(weapon);
      }
    });

    this.socket.on("vaccineReceived", () => {
      console.log("Vaccine received!");
      this.showNotification("💊 You are protected!", "#00ffff");
    });

    // NEW: box error feedback
    this.socket.on("boxError", (data) => {
      this.showNotification(`⚠️ ${data.message}`, "#ff4444");
    });
  }

  setupKeyListeners() {
    document.addEventListener("keydown", (e) => {
      if (e.code === "KeyC" && !this.keyDown) {
        this.keyDown = true;
        this.handleInteraction();
      }
    });
    document.addEventListener("keyup", (e) => {
      if (e.code === "KeyC") this.keyDown = false;
    });
  }

  handleInteraction() {
    if (!this.currentRoomId || !this.activeRoom) return;
    const room = this.rooms.get(this.currentRoomId);
    if (!room || !room.isActive) return;

    let didAnything = false;

    // ── VACCINE (once per activation per player) ──────────────────────────
    if (!this.collectedVaccineThisRoom) {
      this.collectedVaccineThisRoom = true; // optimistic
      this.socket.emit("openBox", { roomId: room.id, boxType: "vaccine" });
      didAnything = true;
    }

    // ── AMMO (per current weapon) ─────────────────────────────────────────
    const currentWeapon = this.player.weapons[this.player.currentWeaponIndex];
    if (!currentWeapon) return;

    const weaponName = currentWeapon.name;

    if (this.collectedAmmoThisRoom.has(weaponName)) {
      // Already collected for THIS weapon — tell player to switch
      this.showNotification(`🔁 Switch weapon to collect more ammo`, "#aaaaaa");
    } else if (this.weaponSlotsFull.has(weaponName)) {
      // 2/2 slots taken by others for this weapon
      this.showNotification(
        `❌ ${weaponName} ammo already taken (2/2)`,
        "#ff4444",
      );
    } else {
      // Attempt collection
      this.collectedAmmoThisRoom.add(weaponName); // optimistic
      this.socket.emit("openBox", {
        roomId: room.id,
        boxType: "ammo",
        weaponName: weaponName,
      });
      didAnything = true;
    }

    if (!didAnything && this.collectedVaccineThisRoom) {
      const allWeaponsCollected = this.player.weapons.every(
        (w) =>
          this.collectedAmmoThisRoom.has(w.name) ||
          this.weaponSlotsFull.has(w.name),
      );
      if (allWeaponsCollected) {
        this.showNotification("📦 Nothing left to collect here!", "#888888");
      }
    }
  }

  addRoom(data) {
    if (!this.rooms.has(data.id)) {
      const room = new Room(data, this.world, this.socket);
      this.rooms.set(data.id, room);
    } else {
      console.warn("RoomManager: duplicate addRoom ignored for", data.id);
    }
  }

  checkPlayerRooms() {
    if (!this.player) return;

    const now = performance.now();
    if (now - this.lastRoomCheckTime < this.roomCheckInterval) return;
    this.lastRoomCheckTime = now;

    const playerPos = this.player.getThreeObj().position;
    let inAnyRoom = false;

    this.rooms.forEach((room) => {
      if (room.isActive) {
        const dx = playerPos.x - room.position.x;
        const dy = playerPos.y - room.position.y;
        const dz = playerPos.z - room.position.z;

        // Use squared distance to avoid Math.sqrt
        const distanceSq = dx * dx + dy * dy + dz * dz;
        const radiusSq = room.radius * room.radius;

        const wasInRoom = room.playerInRoom;
        const isInRoom = distanceSq < radiusSq;

        if (isInRoom && !wasInRoom) {
          this.socket.emit("enteredRoom", { roomId: room.id });
          this.showNotification(`🏠 Entered ${room.name}`, "#00ff00");
          this._showCollectionHint(room);
        } else if (!isInRoom && wasInRoom) {
          this.showNotification(`🚪 Left ${room.name}`, "#ffaa00");
        }

        room.setPlayerInRoom(isInRoom);
        if (isInRoom) {
          inAnyRoom = true;
          this.currentRoomId = room.id;
        }
      }
    });

    if (!inAnyRoom) this.currentRoomId = null;

    if (this.interactionPrompt) {
      this.interactionPrompt.style.display =
        this.currentRoomId && this.activeRoom ? "block" : "none";
    }
  }

  // NEW: show a hint about what's collectible when entering a room
  _showCollectionHint(room) {
    if (!this.player || !this.player.weapons) return;
    const collectible = this.player.weapons.filter(
      (w) =>
        !this.collectedAmmoThisRoom.has(w.name) &&
        !this.weaponSlotsFull.has(w.name),
    );
    if (collectible.length > 0) {
      const names = collectible.map((w) => w.name).join(", ");
      this.showNotification(
        `🎁 Press C — ammo available for: ${names}`,
        "#00ffff",
      );
    } else if (!this.collectedVaccineThisRoom) {
      this.showNotification(`🎁 Press C — vaccine available!`, "#ffff00");
    }
  }

  showNotification(message, color) {
    this.notificationEl.textContent = message;
    this.notificationEl.style.color = color;
    this.notificationEl.style.borderColor = color;
    this.notificationEl.style.border = `2px solid ${color}`;
    this.notificationEl.style.display = "block";
    this.notificationEl.style.animation = "none";

    // Use requestAnimationFrame to skip the forced reflow
    requestAnimationFrame(() => {
      // Ensuring the previous style changes are processed
      requestAnimationFrame(() => {
        this.notificationEl.style.animation = "fadeOut 3s forwards";
      });
    });

    clearTimeout(this.notificationTimeout);
    this.notificationTimeout = setTimeout(() => {
      this.notificationEl.style.display = "none";
    }, 3000);
  }

  update(delta) {
    this.rooms.forEach((room) => {
      if (room.isActive) {
        room.update(delta);
      }
    });
    this.checkPlayerRooms();
  }
}
