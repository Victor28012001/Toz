// client/src/classes/LobbyUI.js
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import Player from "./Player.js";
import Weapon from "./Weapon.js";
import { WEAPON_CONFIGS } from "./constants.js";

export default class LobbyUI {
  constructor(socket, onGameStart) {
    this.socket = socket;
    this.onGameStart = onGameStart;
    this.lobbyId = null;
    this.isHost = false;
    this.playerName = null;
    this.players = new Map();
    this.votes = {
      shooting_range: 0,
      greeble_map: 0,
      lowpoly_environment: 0,
    };
    this.selectedMapKey = "shooting_range";
    this.gameDuration = 10;
    this.selectedWeaponKeys = [];
    this.isReady = false;

    // 3D Scene
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.orbitControls = null;
    this.playerInstances = new Map();
    this.animationId = null;
    this.currentlyFocusedPlayerId = null;
    this.localPlayer = null;

    this.gltfLoader = new GLTFLoader();
    this.stylesInjected = false;

    // Store weapon models for reuse
    this.weaponModelCache = new Map();

    window._currentLobbyUI = this;

    this.lastFrameTime = null;
  }

  injectStyles() {
    if (this.stylesInjected) return;
    this.stylesInjected = true;

    const style = document.createElement("style");
    style.id = "lobby-3d-style";
    style.textContent = `
      #lobby-3d-root { position: fixed; inset: 0; z-index: 90; background: #050810; overflow: hidden; }
      #lobby-3d-canvas { position: absolute; width: 100%; height: 100%; display: block; }
      .lobby-overlay { position: fixed; inset: 0; z-index: 11; pointer-events: none; display: flex; justify-content: space-between; padding: 20px; }
      .lobby-overlay > * { pointer-events: all; }
      .lobby-panel { background: rgba(8,15,30,0.92); border: 1px solid rgba(80,140,220,0.25); border-radius: 4px; padding: 20px; backdrop-filter: blur(8px); max-width: 320px; max-height: 90vh; overflow-y: auto; }
      .lobby-panel.right { margin-left: auto; }
      .lobby-title { font-family: 'Orbitron', monospace; font-size: 16px; font-weight: 700; letter-spacing: 0.15em; color: #fff; margin-bottom: 16px; }
      .lobby-label { font-size: 10px; letter-spacing: 0.2em; color: #4a7ab0; text-transform: uppercase; margin-top: 16px; margin-bottom: 8px; display: block; }
      .lobby-label:first-child { margin-top: 0; }
      .lobby-players-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(85px, 1fr)); gap: 8px; margin-bottom: 16px; max-height: 180px; overflow-y: auto; }
      .lobby-player-card { background: rgba(0,0,0,0.4); border: 1px solid rgba(80,140,220,0.3); border-radius: 4px; padding: 8px; text-align: center; font-size: 10px; cursor: pointer; transition: all 0.2s; }
      .lobby-player-card:hover { border-color: rgba(80,200,255,0.6); background: rgba(80,160,255,0.1); }
      .lobby-player-card.focused { border-color: #00ff88; background: rgba(0,200,120,0.15); }
      .lobby-player-card.ready { border-color: rgba(0,200,120,0.6); background: rgba(0,200,120,0.08); }
      .lobby-player-name { color: #e0f0ff; font-weight: bold; margin-bottom: 4px; font-size: 9px; word-break: break-word; }
      .lobby-player-status { color: #4a7ab0; font-size: 8px; }
      .lobby-player-status.ready { color: #00ff88; }
      .lobby-host-badge { color: #ffaa00; margin-left: 4px; }
      .weapon-select-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin: 12px 0; max-height: 250px; overflow-y: auto; }
      .weapon-option { background: rgba(0,0,0,0.4); border: 1px solid rgba(80,140,220,0.3); border-radius: 4px; padding: 8px 4px; text-align: center; cursor: pointer; font-size: 9px; transition: all 0.2s; }
      .weapon-option:hover { border-color: rgba(80,160,255,0.5); background: rgba(80,160,255,0.1); }
      .weapon-option.selected { border-color: #00ff88; background: rgba(0,200,120,0.15); }
      .weapon-name { font-weight: bold; color: #e0f0ff; margin-bottom: 4px; }
      .weapon-stats { font-size: 7px; color: #4a7ab0; display: flex; justify-content: center; gap: 8px; }
      .map-select-grid { display: grid; grid-template-columns: 1fr; gap: 8px; margin: 12px 0; }
      .map-option { background: rgba(0,0,0,0.4); border: 1px solid rgba(80,140,220,0.3); border-radius: 4px; padding: 10px; text-align: center; cursor: pointer; transition: all 0.2s; }
      .map-option:hover { border-color: rgba(80,160,255,0.5); background: rgba(80,160,255,0.1); }
      .map-option.selected { border-color: #00ff88; background: rgba(0,200,120,0.1); }
      .map-name { font-family: 'Orbitron', monospace; font-size: 11px; font-weight: bold; color: #e0f0ff; }
      .map-desc { font-size: 8px; color: #4a7ab0; margin-top: 2px; }
      .map-votes { font-size: 9px; color: #ffaa00; margin-top: 4px; }
      .duration-control { display: flex; align-items: center; gap: 12px; margin: 12px 0; }
      .duration-control input { flex: 1; height: 4px; background: rgba(80,140,220,0.3); border-radius: 2px; -webkit-appearance: none; }
      .duration-control input::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; background: #4a7ab0; border-radius: 50%; cursor: pointer; }
      .lobby-btn { width: 100%; padding: 10px 16px; font-family: 'Orbitron', monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.2em; border: 1px solid rgba(80,160,255,0.5); background: rgba(30,70,140,0.25); color: #a0c8ff; cursor: pointer; margin-top: 8px; transition: all 0.2s; }
      .lobby-btn:hover { border-color: rgba(80,200,255,0.8); background: rgba(40,90,180,0.35); }
      .lobby-btn.primary { background: rgba(40,100,200,0.4); border-color: rgba(80,180,255,0.7); color: #e8f4ff; }
      .lobby-btn.ready { background: rgba(0,200,120,0.2); border-color: rgba(0,200,120,0.6); color: #00ff88; }
      .lobby-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .error-message { color: #ff6060; font-size: 10px; text-align: center; margin-top: 10px; }
      .selection-info { font-size: 10px; color: #4a7ab0; text-align: center; margin-top: 8px; padding: 6px; background: rgba(0,0,0,0.3); border-radius: 4px; }
    `;
    document.head.appendChild(style);
  }

  async loadWeaponModel(weaponKey) {
    if (this.weaponModelCache.has(weaponKey)) {
      return this.weaponModelCache.get(weaponKey).clone();
    }

    const config = WEAPON_CONFIGS[weaponKey];
    if (!config || !config.modelPath) return null;

    return new Promise((resolve) => {
      this.gltfLoader.load(
        config.modelPath,
        (gltf) => {
          const model = gltf.scene;
          model.scale.set(
            config.scale || 1,
            config.scale || 1,
            config.scale || 1,
          );
          this.weaponModelCache.set(weaponKey, model.clone());
          resolve(model);
        },
        undefined,
        (error) => {
          console.warn(`Failed to load weapon ${weaponKey}:`, error);
          resolve(null);
        },
      );
    });
  }

  async createWeaponInstance(weaponKey) {
    const config = WEAPON_CONFIGS[weaponKey];
    if (!config) return null;

    const weapon = new Weapon(config);
    const model = await this.loadWeaponModel(weaponKey);
    if (model) {
      weapon.model = model;
    }
    return weapon;
  }

  async createPlayerInstance(playerId, playerName, colorHex, isLocal = false) {
    const tempWorld = {
      addMixer: () => {},
      scene: this.scene,
    };

    const player = new Player(
      playerId,
      playerName,
      colorHex, // This passes color to Player constructor
      isLocal ? this.socket : null,
      tempWorld,
      new THREE.Vector3(0, 0, 0),
    );

    // Wait for model to load
    await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (player.modelLoaded) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 50);
    });

    // Fix orientation - rotate model to stand upright
    if (player.pitchObj) {
      player.pitchObj.rotation.x = 0;
      player.pitchObj.rotation.y = Math.PI;
      player.pitchObj.rotation.z = 0;
    }

    // Scale down the model for lobby view
    if (player.pitchObj && player.pitchObj.children[0]) {
      const model = player.pitchObj.children[0];
      model.scale.set(28, 28, 28);

      // ✅ CRITICAL: Apply the tint color to the model materials
      if (colorHex) {
        model.traverse((child) => {
          if (child.isMesh) {
            if (Array.isArray(child.material)) {
              child.material = child.material.map((mat) => mat.clone());
              child.material.forEach((mat) => {
                mat.color.setHex(colorHex);
                if (mat.emissive) mat.emissive.setHex(0x222222);
              });
            } else if (child.material) {
              child.material = child.material.clone();
              child.material.color.setHex(colorHex);
              if (child.material.emissive)
                child.material.emissive.setHex(0x222222);
            }
          }
        });
        console.log(
          `Applied color ${colorHex.toString(16)} to player ${playerName}`,
        );
      }
    }

    setTimeout(() => {
      const model = player.pitchObj?.children[0];
      if (model) {
        // Force play idle animation - BUT ONLY ONCE
        if (
          model.userData?.animationActions?.idle &&
          !player._animationStarted
        ) {
          model.userData.animationActions.idle.play();
          player._animationStarted = true;
        }
      }
    }, 100);

    return player;
  }

  async attachWeaponToPlayer(playerId, weaponKey) {
    const entry = this.playerInstances.get(playerId);
    if (!entry || !entry.player) return;

    const weapon = await this.createWeaponInstance(weaponKey);
    if (!weapon || !weapon.model) return;

    const config = WEAPON_CONFIGS[weaponKey];

    // Position weapon in hand
    weapon.model.position.set(
      config.position?.x || 0.2,
      config.position?.y || 0.7,
      config.position?.z || 0,
    );
    weapon.model.rotation.set(
      config.rotation?.x || Math.PI / 2,
      config.rotation?.y || Math.PI,
      config.rotation?.z || Math.PI / 2,
    );
    weapon.model.userData.isWeapon = true;
    weapon.model.userData.weaponKey = weaponKey;

    // Remove existing weapon
    if (entry.currentWeapon && entry.currentWeapon.parent) {
      entry.currentWeapon.parent.remove(entry.currentWeapon);
    }

    // Attach to right hand
    if (entry.player.bones?.rightHand) {
      entry.player.bones.rightHand.add(weapon.model);
      entry.currentWeapon = weapon.model;
      entry.currentWeaponKey = weaponKey;
      entry.weaponInstance = weapon;
    }

    // ✅ THIS is what you wanted
    if (typeof entry.player.playAnimation === "function") {
      entry.player.playAnimation("idle", true, true, true);
    }
  }

  async setup3DScene(playersList) {
    const canvas = document.getElementById("lobby-3d-canvas");
    if (!canvas) return;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050810);
    this.scene.fog = new THREE.FogExp2(0x050810, 0.008);

    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    this.camera.position.set(0, 3, 8);
    this.camera.lookAt(0, 1.5, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;

    // OrbitControls - only controls for camera movement
    this.orbitControls = new OrbitControls(this.camera, canvas);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.05;
    this.orbitControls.zoomSpeed = 1.2;
    this.orbitControls.rotateSpeed = 1.0;
    this.orbitControls.panSpeed = 0.8;
    this.orbitControls.enableZoom = true;
    this.orbitControls.enablePan = true;
    this.orbitControls.target.set(0, 1.5, 0);
    this.orbitControls.minDistance = 0.1; // Allow extremely close zoom
    this.orbitControls.maxDistance = 20;

    // Lighting
    // Daytime lighting - Bright and vivid
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.8); // Much higher intensity
    this.scene.add(ambientLight);

    // Main directional light (sun) - higher and brighter
    const mainLight = new THREE.DirectionalLight(0xfff5e6, 2.5);
    mainLight.position.set(10, 20, 5);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 30;
    mainLight.shadow.camera.left = -10;
    mainLight.shadow.camera.right = 10;
    mainLight.shadow.camera.top = 10;
    mainLight.shadow.camera.bottom = -10;
    this.scene.add(mainLight);

    // Secondary sun light from opposite angle
    const secondaryLight = new THREE.DirectionalLight(0xffccaa, 1.2);
    secondaryLight.position.set(-5, 15, -3);
    this.scene.add(secondaryLight);

    // Fill light from below (bounce light)
    const fillLight = new THREE.PointLight(0xaaddff, 0.8);
    fillLight.position.set(0, -1, 0);
    this.scene.add(fillLight);

    // Warm fill from front
    const warmFill = new THREE.PointLight(0xffaa66, 0.9);
    warmFill.position.set(2, 3, 4);
    this.scene.add(warmFill);

    // Cool fill from front-left
    const coolFill = new THREE.PointLight(0x88aaff, 0.9);
    coolFill.position.set(-2, 3, 4);
    this.scene.add(coolFill);

    // Bright rim light from back
    const rimLight = new THREE.PointLight(0xffdd88, 0.8);
    rimLight.position.set(0, 3, -5);
    this.scene.add(rimLight);

    // Hemisphere light for sky/ground bounce
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xaaccff, 1.2);
    this.scene.add(hemiLight);

    // Ground platform
    const platformGeo = new THREE.CylinderGeometry(6, 6, 0.1, 32);
    const platformMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      metalness: 0.7,
      roughness: 0.3,
    });
    const platform = new THREE.Mesh(platformGeo, platformMat);
    platform.position.y = -0.05;
    platform.receiveShadow = true;
    this.scene.add(platform);

    // Glow ring
    const ringGeo = new THREE.TorusGeometry(5.5, 0.05, 64, 200);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x88ccff,
      emissive: 0x4488aa,
      emissiveIntensity: 0.4,
      metalness: 0.8,
      roughness: 0.2,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0;
    this.scene.add(ring);

    // Create local player
    const localPlayerData = Array.from(playersList).find(
      (p) => p.id === this.socket.id,
    );
    if (localPlayerData) {
      this.localPlayer = await this.createPlayerInstance(
        localPlayerData.id,
        localPlayerData.name,
        localPlayerData.color || 0x44aaff,
        true,
      );
      this.localPlayer.threeObj.position.set(0, 0, 0);
      this.scene.add(this.localPlayer.threeObj);

      this.playerInstances.set(localPlayerData.id, {
        player: this.localPlayer,
        position: { x: 0, z: 0, angle: 0 },
        currentWeapon: null,
        currentWeaponKey: null,
        weaponInstance: null,
        name: localPlayerData.name,
      });
    }

    // Position other players in a circle around the center
    const radius = 3.5;
    let angle = 0;
    const otherPlayers = Array.from(playersList).filter(
      (p) => p.id !== this.socket.id,
    );
    const angleStep =
      otherPlayers.length > 0 ? (Math.PI * 2) / otherPlayers.length : 0;

    for (const playerData of otherPlayers) {
      const pos = {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        angle: (angle * 180) / Math.PI,
      };

      const playerInstance = await this.createPlayerInstance(
        playerData.id,
        playerData.name,
        playerData.color || 0x66ccff,
        false,
      );
      playerInstance.threeObj.position.set(pos.x, 0, pos.z);
      // Make other players face the center
      const directionToCenter = Math.atan2(-pos.x, -pos.z);
      playerInstance.threeObj.rotation.y = directionToCenter;

      this.scene.add(playerInstance.threeObj);
      this.playerInstances.set(playerData.id, {
        player: playerInstance,
        position: pos,
        currentWeapon: null,
        currentWeaponKey: null,
        weaponInstance: null,
        name: playerData.name,
      });

      angle += angleStep;
    }
  }

  focusOnPlayer(playerId) {
    const entry = this.playerInstances.get(playerId);
    if (!entry || !entry.player) return;

    this.currentlyFocusedPlayerId = playerId;

    const playerPos = entry.player.threeObj.position.clone();

    if (this.orbitControls) {
      const target = playerPos.clone();

      // 🎯 still look at upper body (good)
      target.y += 1.4;

      // 📦 camera position (SAME HEIGHT as target → no tilt)
      const newCameraPos = new THREE.Vector3(
        target.x,
        target.y, // 👈 KEY: same height = straight look
        target.z + 2.5, // forward distance only (no vertical offset)
      );

      this.orbitControls.target.copy(target);
      this.camera.position.copy(newCameraPos);

      this.orbitControls.update();
    }

    document.querySelectorAll(".lobby-player-card").forEach((card) => {
      card.classList.toggle("focused", card.dataset.playerId === playerId);
    });
  }

  resetCamera() {
    console.log("Resetting camera to default view");
    this.currentlyFocusedPlayerId = null;

    if (this.orbitControls) {
      this.orbitControls.enabled = true;
      // Reset to default view - much further away
      this.orbitControls.target.set(0, 1.5, 0);
      this.camera.position.set(0, 4, 10);
      this.orbitControls.update();
    }

    document.querySelectorAll(".lobby-player-card").forEach((card) => {
      card.classList.remove("focused");
    });
  }

  animate() {
    this.animationId = requestAnimationFrame(() => this.animate());
    if (!this.scene || !this.camera || !this.renderer) return;

    const time = Date.now() * 0.001;

    // Calculate delta time for animations
    const now = performance.now();
    const delta = Math.min(1 / 30, (now - (this.lastFrameTime || now)) / 1000);
    this.lastFrameTime = now;

    // 🔥 CRITICAL: Update animation mixers for ALL players
    this.playerInstances.forEach((data) => {
      if (
        data.player &&
        data.player.pitchObj &&
        data.player.pitchObj.children[0]
      ) {
        const model = data.player.pitchObj.children[0];
        if (model.userData?.animationMixer) {
          model.userData.animationMixer.update(delta);
        }
      }
    });

    // Animate other players with subtle idle floating
    this.playerInstances.forEach((data, id) => {
      if (id !== this.socket.id && data.player && data.player.threeObj) {
        if (data.position) {
          data.player.threeObj.position.y =
            Math.sin(time * 1.5 + data.position.x) * 0.02;
        }
      }
    });

    // Update orbit controls
    if (this.orbitControls) {
      this.orbitControls.update();
    }

    this.renderer.render(this.scene, this.camera);
  }

  showLoadoutUI(lobbyData) {
    this.injectStyles();

    this.lobbyId = lobbyData.lobbyId;
    this.isHost = lobbyData.isHost || false;
    this.playerName = lobbyData.name;

    // Build players map
    this.players.set(this.socket.id, {
      id: this.socket.id,
      name: this.playerName,
      isReady: false,
      isHost: this.isHost,
      color: 0x44aaff,
    });

    if (lobbyData.players) {
      lobbyData.players.forEach((p) => {
        if (p.id !== this.socket.id) {
          this.players.set(p.id, {
            id: p.id,
            name: p.name,
            isReady: p.isReady || false,
            isHost: p.id === lobbyData.hostId,
            color: 0x66ccff,
            selectedLoadout: p.selectedLoadout || [],
          });
        }
      });
    }

    this.createUI();
    this.setup3DScene(Array.from(this.players.values()));
    this.animate();
    this.bindEvents();
    this.setupSocketListeners();
  }

  setupSocketListeners() {
    this.socket.on("playerJoinedLobby", (data) => {
      console.log("playerJoinedLobby event received:", data);
      if (data.players) {
        data.players.forEach((p) => {
          if (!this.players.has(p.id)) {
            this.players.set(p.id, p);
            this.addPlayerToScene(p);
          }
        });
        this.updatePlayersDisplay(Array.from(this.players.values()));
      }
    });

    this.socket.on("lobbyDisbanded", () => {
      console.log("⚠️ Lobby was disbanded");
      this.showError("Lobby was closed by host or all players left");
      setTimeout(() => {
        this.hideAll();
        location.reload();
      }, 2000);
    });

    this.socket.on("playerLeftLobby", (data) => {
      console.log("playerLeftLobby event received:", data);
      if (data.players) {
        const currentIds = new Set(data.players.map((p) => p.id));
        for (const [id, player] of this.players) {
          if (!currentIds.has(id)) {
            const entry = this.playerInstances.get(id);
            if (entry && entry.player && entry.player.threeObj) {
              this.scene.remove(entry.player.threeObj);
              entry.player.cleanup();
              this.playerInstances.delete(id);
            }
            this.players.delete(id);
          }
        }
        this.updatePlayersDisplay(Array.from(this.players.values()));
        if (data.newHostId === this.socket.id) this.setHost(true);
      }
    });

    this.socket.on("mapVotesUpdated", (data) => {
      console.log("✅ Received mapVotesUpdated:", data);
      if (data && data.votes) {
        this.updateMapVotes(data.votes, data.selectedMap);
      }
    });

    this.socket.on("playerReadyStatusUpdated", (data) => {
      if (data.players) {
        data.players.forEach((p) => {
          if (this.players.has(p.id)) {
            const existing = this.players.get(p.id);
            existing.isReady = p.isReady;
            this.players.set(p.id, existing);
          }
        });
        this.updatePlayersDisplay(Array.from(this.players.values()));
      }
    });

    this.socket.on("playerLoadoutUpdated", (data) => {
      console.log("playerLoadoutUpdated received:", data);
      if (data.loadout && data.loadout.length > 0) {
        const weaponName = data.loadout[0];
        const weaponEntry = Object.entries(WEAPON_CONFIGS).find(
          ([, config]) => config.name === weaponName,
        );
        if (weaponEntry) {
          this.attachWeaponToPlayer(data.playerId, weaponEntry[0]);
        }
      }
    });

    this.socket.on("gameDurationUpdated", (data) =>
      this.updateGameDuration(data.gameDuration, data.gameDurationMinutes),
    );
    this.socket.on("gameStarting", (data) => {
      this.hideAll();
      this.onGameStart(data);
    });
    this.socket.on("transitionToMatch", () => {
      this.hideAll();
      this.onGameStart({});
    });
    this.socket.on("lobbyError", (data) => this.showError(data.message));
  }

  async addPlayerToScene(playerData) {
    const radius = 3.5;
    const currentPlayers = Array.from(this.playerInstances.keys()).filter(
      (id) => id !== this.socket.id,
    );
    const angle = currentPlayers.length * ((Math.PI * 2) / this.players.size);

    const pos = {
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      angle: (angle * 180) / Math.PI,
    };

    const playerInstance = await this.createPlayerInstance(
      playerData.id,
      playerData.name,
      playerData.color || 0x66ccff,
      false,
    );
    playerInstance.threeObj.position.set(pos.x, 0, pos.z);
    const directionToCenter = Math.atan2(-pos.x, -pos.z);
    playerInstance.threeObj.rotation.y = directionToCenter;

    this.scene.add(playerInstance.threeObj);
    this.playerInstances.set(playerData.id, {
      player: playerInstance,
      position: pos,
      currentWeapon: null,
      currentWeaponKey: null,
      weaponInstance: null,
      name: playerData.name,
    });

    if (playerData.selectedLoadout && playerData.selectedLoadout.length > 0) {
      const weaponName = playerData.selectedLoadout[0];
      const weaponEntry = Object.entries(WEAPON_CONFIGS).find(
        ([, config]) => config.name === weaponName,
      );
      if (weaponEntry) {
        this.attachWeaponToPlayer(playerData.id, weaponEntry[0]);
      }
    }
  }

  createUI() {
    const existing = document.getElementById("lobby-3d-root");
    if (existing) existing.remove();

    const root = document.createElement("div");
    root.id = "lobby-3d-root";
    root.innerHTML = `
      <canvas id="lobby-3d-canvas"></canvas>
      <div class="lobby-overlay">
        <div class="lobby-panel">
          <div class="lobby-title">WINNOWING LOBBY</div>
          <div id="lobby-players-grid" class="lobby-players-grid"></div>
          <div class="map-select-grid" id="map-select-grid"></div>
          ${
            this.isHost
              ? `<div class="duration-control"><input type="range" id="duration-slider" min="5" max="30" step="5" value="${this.gameDuration}"><span id="duration-value" style="color:#ffaa00">${this.gameDuration} min</span></div>`
              : ""
          }
          <button id="reset-camera-btn" class="lobby-btn" style="margin-top:12px">🎥 RESET CAMERA</button>
        </div>
        <div class="lobby-panel right">
          <div class="lobby-title">⚔️ LOADOUT</div>
          <div id="weapon-select-grid" class="weapon-select-grid"></div>
          <div class="selection-info" id="loadout-count">Selected: 0 / 4</div>
          <button id="lobby-ready-btn" class="lobby-btn" disabled>🎯 READY</button>
          <button id="lobby-back-btn" class="lobby-btn">← BACK</button>
          ${
            this.isHost
              ? `<button id="lobby-start-btn" class="lobby-btn primary" style="margin-top:12px">▶ START GAME</button>`
              : ""
          }
        </div>
      </div>
    `;
    document.body.appendChild(root);
    this.root = root;
  }

  createWeaponsHTML() {
    return Object.entries(WEAPON_CONFIGS)
      .map(
        ([key, config]) => `
        <div class="weapon-option" data-weapon="${key}">
          <div class="weapon-name">${config.name}</div>
          <div class="weapon-stats">
            <span>💥 ${config.damage}</span>
            <span>🔫 ${config.maxAmmo}</span>
            <span>⚡ ${(config.fireRate * 1000).toFixed(0)}ms</span>
          </div>
        </div>
      `,
      )
      .join("");
  }

  updatePlayersDisplay(playersList) {
    const grid = document.getElementById("lobby-players-grid");
    if (grid) {
      grid.innerHTML = playersList
        .map(
          (p) => `
        <div class="lobby-player-card ${
          p.isReady ? "ready" : ""
        }" data-player-id="${p.id}">
          <div class="lobby-player-name">
            ${this.escapeHtml(p.name)}
            ${p.isHost ? '<span class="lobby-host-badge">★</span>' : ""}
          </div>
          <div class="lobby-player-status ${p.isReady ? "ready" : ""}">
            ${p.isReady ? "✓ READY" : "● WAITING"}
          </div>
        </div>
      `,
        )
        .join("");

      document.querySelectorAll(".lobby-player-card").forEach((card) => {
        const playerId = card.dataset.playerId;

        card.addEventListener("click", (e) => {
          e.stopPropagation();

          // 🚫 ignore all other players
          if (playerId !== this.socket.id) return;

          // ✅ only your own player can be focused
          this.focusOnPlayer(playerId);
        });
      });
    }
  }

  updateGameDuration(durationMs, minutes) {
    this.gameDuration = minutes;
    const slider = document.getElementById("duration-slider");
    const valueEl = document.getElementById("duration-value");
    if (slider) slider.value = minutes;
    if (valueEl) valueEl.textContent = `${minutes} min`;
  }

  setHost(isHost) {
    this.isHost = isHost;
    if (isHost && !document.getElementById("lobby-start-btn")) {
      const btn = document.createElement("button");
      btn.id = "lobby-start-btn";
      btn.className = "lobby-btn primary";
      btn.textContent = "▶ START GAME";
      btn.style.marginTop = "12px";
      btn.onclick = () => {
        if (this.socket && this.lobbyId) {
          this.socket.emit("startGame", { lobbyId: this.lobbyId });
        }
      };
      const rightPanel = document.querySelector(".lobby-panel.right");
      if (rightPanel) {
        rightPanel.appendChild(btn);
      }
    }
  }

  showError(message) {
    const errorDiv = document.createElement("div");
    errorDiv.className = "error-message";
    errorDiv.textContent = message;
    const rightPanel = document.querySelector(".lobby-panel.right");
    if (rightPanel) {
      const existing = rightPanel.querySelector(".error-message");
      if (existing) existing.remove();
      rightPanel.appendChild(errorDiv);
      setTimeout(() => errorDiv.remove(), 3000);
    }
  }

  updateMapVotes(votes, selectedMap) {
    let votesObject = {};

    if (Array.isArray(votes)) {
      votes.forEach((v) => {
        if (v.mapKey) {
          const voteCount =
            v.votes !== undefined
              ? v.votes
              : v.count !== undefined
              ? v.count
              : 0;
          votesObject[v.mapKey] = voteCount;
        }
      });
    } else {
      votesObject = votes;
    }

    const mapKeys = ["shooting_range", "greeble_map", "lowpoly_environment"];
    for (const mapKey of mapKeys) {
      const count = votesObject[mapKey] || 0;
      this.votes[mapKey] = count;
      const el = document.getElementById(`votes-${mapKey}`);
      if (el) {
        el.textContent = `${count} vote${count !== 1 ? "s" : ""}`;
      }
    }

    if (selectedMap) {
      this.selectedMapKey = selectedMap;
      document.querySelectorAll(".map-option").forEach((opt) => {
        opt.classList.toggle("selected", opt.dataset.map === selectedMap);
      });
    }
  }

  createMapsHTML() {
    const maps = [
      {
        key: "shooting_range",
        name: "🎯 SHOOTING RANGE",
        desc: "Desert tactical combat",
      },
      {
        key: "greeble_map",
        name: "🏛️ ANCIENT RUINS",
        desc: "Aerial jetpack combat",
      },
      {
        key: "lowpoly_environment",
        name: "🌳 LOW POLY VALLEY",
        desc: "Fantasy exploration",
      },
    ];

    return maps
      .map(
        (map) => `
      <div class="map-option ${
        this.selectedMapKey === map.key ? "selected" : ""
      }" data-map="${map.key}">
        <div class="map-name">${map.name}</div>
        <div class="map-desc">${map.desc}</div>
        <div class="map-votes" id="votes-${map.key}">${
          this.votes[map.key] || 0
        } votes</div>
      </div>
    `,
      )
      .join("");
  }

  bindEvents() {
    // Weapon selection
    const selectedWeapons = new Set();
    const weaponsContainer = document.getElementById("weapon-select-grid");
    if (weaponsContainer) {
      weaponsContainer.innerHTML = this.createWeaponsHTML();
      document.querySelectorAll(".weapon-option").forEach((opt) => {
        opt.addEventListener("click", async (e) => {
          e.stopPropagation();
          const weaponKey = opt.dataset.weapon;

          if (opt.classList.contains("selected")) {
            opt.classList.remove("selected");
            selectedWeapons.delete(weaponKey);
          } else if (selectedWeapons.size < 4) {
            opt.classList.add("selected");
            selectedWeapons.add(weaponKey);
            await this.attachWeaponToPlayer(this.socket.id, weaponKey);
          } else {
            this.showError("Maximum 4 weapons selected!");
            return;
          }

          const countEl = document.getElementById("loadout-count");
          if (countEl) {
            countEl.textContent = `Selected: ${selectedWeapons.size} / 4`;
          }

          const readyBtn = document.getElementById("lobby-ready-btn");
          if (readyBtn) {
            readyBtn.disabled = selectedWeapons.size !== 4;
            if (selectedWeapons.size === 4) {
              readyBtn.classList.add("primary");
            } else {
              readyBtn.classList.remove("primary");
            }
          }
        });
      });
    }

    // Map selection
    const mapsContainer = document.getElementById("map-select-grid");
    if (mapsContainer) {
      mapsContainer.innerHTML = this.createMapsHTML();
      document.querySelectorAll(".map-option").forEach((opt) => {
        opt.addEventListener("click", (e) => {
          e.stopPropagation();
          const mapKey = opt.dataset.map;
          if (this.socket && this.lobbyId) {
            this.socket.emit("voteForMap", { lobbyId: this.lobbyId, mapKey });
          }
        });
      });
    }

    // Reset camera button
    const resetCamBtn = document.getElementById("reset-camera-btn");
    if (resetCamBtn) {
      resetCamBtn.addEventListener("click", () => {
        this.resetCamera();
      });
    }

    // Ready button
    const readyBtn = document.getElementById("lobby-ready-btn");
    if (readyBtn) {
      // Ready button — in bindEvents()
      readyBtn.addEventListener("click", () => {
        const selectedWeaponKeys = Array.from(
          document.querySelectorAll(".weapon-option.selected"),
        ).map((opt) => opt.dataset.weapon);
        if (selectedWeaponKeys.length !== 4) {
          this.showError("Please select exactly 4 weapons!");
          return;
        }

        if (this.socket && this.lobbyId) {
          const weaponNames = selectedWeaponKeys.map(
            (key) => WEAPON_CONFIGS[key]?.name || key,
          );

          // ✅ Store for auto-confirm when transitionToMatch arrives
          window.pendingLoadoutWeapons = weaponNames;

          this.socket.emit("setLoadout", {
            lobbyId: this.lobbyId,
            weapons: weaponNames,
          });
          this.socket.emit("setPlayerReady", {
            lobbyId: this.lobbyId,
            isReady: true,
          });

          readyBtn.textContent = "✓ READY";
          readyBtn.classList.add("ready");
          readyBtn.disabled = true;
        }
      });
    }

    // Back button
    const backBtn = document.getElementById("lobby-back-btn");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        // ✅ Clear lobby loadout since player is leaving
        window.pendingLoadoutWeapons = null;

        if (this.socket && this.lobbyId) {
          this.socket.emit("leaveLobby");
        }
        this.hideAll();
        location.reload();
      });
    }

    // Duration slider (host only)
    const durationSlider = document.getElementById("duration-slider");
    if (durationSlider) {
      durationSlider.addEventListener("input", (e) => {
        const minutes = parseInt(e.target.value);
        this.gameDuration = minutes;
        const valueEl = document.getElementById("duration-value");
        if (valueEl) valueEl.textContent = `${minutes} min`;
        if (this.socket && this.lobbyId) {
          this.socket.emit("setGameDuration", {
            lobbyId: this.lobbyId,
            durationMinutes: minutes,
          });
        }
      });
    }

    // Start button (host only)
    const startBtn = document.getElementById("lobby-start-btn");
    if (startBtn) {
      startBtn.addEventListener("click", () => {
        if (this.socket && this.lobbyId) {
          this.socket.emit("startGame", { lobbyId: this.lobbyId });
        }
      });
    }

    this.updatePlayersDisplay(Array.from(this.players.values()));
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text || "";
    return div.innerHTML;
  }

  hideAll() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    if (this.orbitControls) {
      this.orbitControls.dispose();
    }

    if (this.renderer) {
      this.renderer.dispose();
    }

    if (this.root) {
      this.root.remove();
    }

    this.playerInstances.forEach((entry) => {
      if (entry.player) entry.player.cleanup();
    });
    this.playerInstances.clear();
    this.weaponModelCache.clear();

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.orbitControls = null;

    window._currentLobbyUI = null;
  }
}
