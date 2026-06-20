// classes/Minimap.js
export class Minimap {
  constructor(worldSize = 2000) {
    this.container = null;
    this.canvas = null;
    this.ctx = null;
    this.player = null;
    this.players = new Map();
    this.rooms = new Map();

    this.worldSize = worldSize;
    this.mapSize = 100;
    this.viewRadius = 300;
    this.uiScale = this.mapSize / 200;

    this.createMinimap();
    this.createTopCompass(); // Create top screen compass
  }

  createMinimap() {
    this.container = document.createElement("div");
    this.container.id = "minimap";
    this.container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: ${this.mapSize}px;
      height: ${this.mapSize}px;
      background: rgba(20, 20, 30, 0.6);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 50%;
      overflow: hidden;
      z-index: 1000;
      box-shadow: 0 0 15px rgba(0,0,0,0.5);
    `;

    this.canvas = document.createElement("canvas");
    this.canvas.width = this.mapSize;
    this.canvas.height = this.mapSize;
    this.container.appendChild(this.canvas);

    document.body.appendChild(this.container);

    this.ctx = this.canvas.getContext("2d");
  }

  // --------------------------
  // HUD Compass at top of screen
  // --------------------------
  createTopCompass() {
    this.directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const minorTicksPerSegment = 2; // number of minor ticks between main directions

    // Outer container
    this.hudCompass = document.createElement("div");
    this.hudCompass.style.cssText = `
    position: fixed;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    height: 30px;
    overflow: hidden;
    color: #fff;
    font-size: 12px;
    font-family: Arial, sans-serif;
    font-weight: bold;
    z-index: 2000;
    background: rgba(0,0,0,0.1);
    box-sizing: border-box;
    border: 1px solid rgba(255,255,255,0.2);
  `;
    document.body.appendChild(this.hudCompass);

    // Inner scrollable container
    this.hudCompassInner = document.createElement("div");
    this.hudCompassInner.style.cssText = `
    display: flex;
    position: relative;
    left: 0;
    white-space: nowrap;
    height: 100%;
    align-items: flex-end;
  `;

    // Repeat multiple times for smooth scrolling
    const totalRepeats = 5;
    this.segmentWidth = 60; // width of one direction + minor ticks

    for (let repeat = 0; repeat < totalRepeats; repeat++) {
      this.directions.forEach((dir, i) => {
        const segment = document.createElement("div");
        segment.style.cssText = `
        display: flex;
        flex-direction: row;
        align-items: flex-end;
      `;

        // Main tick + label
        const mainTick = document.createElement("div");
        mainTick.style.cssText = `
        width: 2px;
        height: 12px;
        background: #fff;
        margin-right: 4px;
      `;
        const label = document.createElement("div");
        label.innerText = dir;
        label.style.cssText = `
        font-size: 12px;
        margin-left: 2px;
      `;
        segment.appendChild(mainTick);
        segment.appendChild(label);

        // Minor ticks
        for (let m = 0; m < minorTicksPerSegment; m++) {
          const minor = document.createElement("div");
          minor.style.cssText = `
          width: 1px;
          height: 6px;
          background: #fff;
          margin: 0 10px;
        `;
          segment.appendChild(minor);
        }

        this.hudCompassInner.appendChild(segment);
      });
    }

    this.hudCompass.appendChild(this.hudCompassInner);

    // Center red marker
    this.hudCompassMarker = document.createElement("div");
    this.hudCompassMarker.style.cssText = `
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    height: 100%;
    width: 2px;
    background: #ff0000;
    z-index: 10;
  `;
    this.hudCompass.appendChild(this.hudCompassMarker);
  }

  updateTopCompass() {
    // Debug logging
    if (!this.player) {
      console.log("No player in compass update");
      return;
    }

    if (!this.hudCompassInner) {
      console.log("No compass inner element");
      return;
    }

    // Get rotation from threeObj
    let playerRotationY = null;

    // Try different ways to get rotation
    if (this.player.threeObj?.rotation?.y !== undefined) {
      playerRotationY = this.player.threeObj.rotation.y;
    } else if (this.player.getRotationY) {
      playerRotationY = this.player.getRotationY();
    } else if (
      this.player.getRotation &&
      this.player.getRotation().y !== undefined
    ) {
      playerRotationY = this.player.getRotation().y;
    }

    if (playerRotationY === null || playerRotationY === undefined) {
      console.warn("Cannot get player rotationY");
      return;
    }

    // Convert rotation to degrees, normalize 0-360
    let deg = (playerRotationY * 180) / Math.PI;
    deg = ((deg % 360) + 360) % 360;

    // Get dimensions
    const innerWidth = this.hudCompassInner.scrollWidth;
    const compassWidth = this.hudCompass.clientWidth;

    if (innerWidth === 0 || compassWidth === 0) {
      console.warn("Compass dimensions not ready");
      return;
    }

    // Calculate shift
    const shift = (deg / 360) * innerWidth;

    // Apply transform
    this.hudCompassInner.style.left = `${-shift + compassWidth / 2}px`;

    // Optional: Add smooth transition
    this.hudCompassInner.style.transition = "left 0.1s ease-out";
  }

  setPlayer(player) {
    this.player = player;
  }

  addPlayer(id, obj) {
    this.players.set(id, { object: obj, name: obj.name || "Player" });
  }

  removePlayer(id) {
    this.players.delete(id);
  }

  addRoom(id, obj) {
    this.rooms.set(id, { object: obj, status: "inactive" });
  }

  updateRoomStatus(id, status) {
    const r = this.rooms.get(id);
    if (r) r.status = status;
  }

  worldToMapX(x, px) {
    const dx = x - px;
    return (dx / this.viewRadius) * (this.mapSize / 2) + this.mapSize / 2;
  }

  worldToMapY(z, pz) {
    const dz = z - pz;
    return (dz / this.viewRadius) * (this.mapSize / 2) + this.mapSize / 2;
  }

  drawPlayer() {
    const c = this.mapSize / 2;
    const r = 5 * this.uiScale;

    this.ctx.beginPath();
    this.ctx.arc(c, c, r, 0, Math.PI * 2);
    this.ctx.fillStyle = "#00ff00";
    this.ctx.fill();
  }

  drawOtherPlayers() {
    if (!this.player?.position) return;
    this.players.forEach((p) => {
      let pos = p.object?.position || p.object?.threeObj?.position;
      if (!pos) return;

      const x = this.worldToMapX(pos.x, this.player.position.x);
      const y = this.worldToMapY(pos.z, this.player.position.z);

      if (x < 0 || y < 0 || x > this.mapSize || y > this.mapSize) return;

      const size = 3 * this.uiScale;
      this.ctx.beginPath();
      this.ctx.arc(x, y, size, 0, Math.PI * 2);
      this.ctx.fillStyle = "#ffff00";
      this.ctx.fill();
    });
  }

  drawRooms() {
    if (!this.player?.position) return;
    this.rooms.forEach((room) => {
      const pos = room.object?.position;
      if (!pos) return;

      const x = this.worldToMapX(pos.x, this.player.position.x);
      const y = this.worldToMapY(pos.z, this.player.position.z);

      if (x < 0 || y < 0 || x > this.mapSize || y > this.mapSize) return;

      const r = 8 * this.uiScale;
      let color = "rgba(100,100,100,0.2)";
      if (room.status === "active") color = "rgba(255,170,0,0.3)";
      if (room.status === "ammo_open") color = "rgba(0,255,0,0.3)";
      if (room.status === "vaccine_open") color = "rgba(255,255,0,0.3)";
      if (room.status === "both_open") color = "rgba(0,255,255,0.3)";

      this.ctx.beginPath();
      this.ctx.arc(x, y, r, 0, Math.PI * 2);
      this.ctx.fillStyle = color;
      this.ctx.fill();

      if (room.object.ammoBoxPosition) {
        const ax = this.worldToMapX(
          room.object.ammoBoxPosition.x,
          this.player.position.x,
        );
        const ay = this.worldToMapY(
          room.object.ammoBoxPosition.z,
          this.player.position.z,
        );
        const s = 3 * this.uiScale;
        this.ctx.fillStyle = "#00ff00";
        this.ctx.fillRect(ax - s / 2, ay - s / 2, s, s);
      }

      if (room.object.vaccineBoxPosition) {
        const vx = this.worldToMapX(
          room.object.vaccineBoxPosition.x,
          this.player.position.x,
        );
        const vy = this.worldToMapY(
          room.object.vaccineBoxPosition.z,
          this.player.position.z,
        );
        const vr = 2 * this.uiScale;
        this.ctx.beginPath();
        this.ctx.arc(vx, vy, vr, 0, Math.PI * 2);
        this.ctx.fillStyle = "#ffff00";
        this.ctx.fill();
      }
    });
  }

  drawTargetArrow() {
    if (!this.targetPos || !this.player?.position) return;
    const c = this.mapSize / 2;
    const tx = this.worldToMapX(this.targetPos.x, this.player.position.x);
    const ty = this.worldToMapY(this.targetPos.z, this.player.position.z);
    const dx = tx - c;
    const dy = ty - c;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxR = this.mapSize / 2 - 10;

    if (dist > maxR) {
      const angle = Math.atan2(dy, dx);
      const x = c + Math.cos(angle) * maxR;
      const y = c + Math.sin(angle) * maxR;

      const size = 6 * this.uiScale;

      this.ctx.save();
      this.ctx.translate(x, y);
      this.ctx.rotate(angle);
      this.ctx.beginPath();
      this.ctx.moveTo(size, 0);
      this.ctx.lineTo(-size / 2, -size / 2);
      this.ctx.lineTo(-size / 2, size / 2);
      this.ctx.closePath();
      this.ctx.fillStyle = "#ff00ff";
      this.ctx.fill();
      this.ctx.restore();
    }
  }

  drawGrid() {
    if (!this.player?.position) return;
    const center = this.mapSize / 2;
    const grid = 50;
    const px = this.player.position.x % grid;
    const pz = this.player.position.z % grid;
    const offsetX = (px / this.viewRadius) * (this.mapSize / 2);
    const offsetY = (pz / this.viewRadius) * (this.mapSize / 2);
    const step = (grid / this.viewRadius) * (this.mapSize / 2);
    this.ctx.strokeStyle = "rgba(255,255,255,0.03)";
    this.ctx.lineWidth = 1;

    for (let x = center + offsetX; x < this.mapSize; x += step) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.mapSize);
      this.ctx.stroke();
    }

    for (let y = center + offsetY; y < this.mapSize; y += step) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.mapSize, y);
      this.ctx.stroke();
    }
  }

  showTarget(id) {
    const r = this.rooms.get(id);
    if (r) this.targetPos = r.object.position;
  }

  clearTarget() {
    this.targetPos = null;
  }

  update() {
    if (!this.player?.position) return;
    this.ctx.clearRect(0, 0, this.mapSize, this.mapSize);
    this.drawGrid();
    this.drawRooms();
    this.drawOtherPlayers();
    this.drawPlayer();
    this.drawTargetArrow();
    this.updateTopCompass();
  }

  updateAll() {
    this.update();
  }
}
