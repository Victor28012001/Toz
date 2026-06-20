// client/src/main.js
import io from "socket.io-client";
import * as THREE from "three";
import moment from "moment";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { ScreenOrientation } from "@capacitor/screen-orientation";
import { StatusBar } from "@capacitor/status-bar";
import { Preferences } from "@capacitor/preferences";
import World from "./classes/World.js";
import PlayerList from "./classes/PlayerList.js";
import Player from "./classes/Player.js";
import MessageList from "./classes/MessageList.js";
import Message from "./classes/Message.js";
import { Minimap } from "./classes/Minimap.js";
import RoomManager from "./classes/RoomManager.js";
import { MobileControls } from "./classes/mobileControls.js";
// import LoadoutUI from "./classes/loadoutUI.js";
import { WEAPON_CONFIGS } from "./classes/constants.js";
import VoiceChat from "./classes/VoiceChat.js";
import { getWeaponSoundManager } from "./classes/WeaponSoundManager.js";
import { MAPS } from "./classes/MapManager.js";
import UIFlow from "./classes/UIFlow.js";
// import WalletUI from "./classes/WalletUI.js";
import VanillaWalletUI from "./classes/VanillaWalletUI.js";
import FeedbackSystem from "./classes/FeedbackSystem.js";
import LeaderboardUI from "./classes/LeaderboardUI.js";
import ModernHUD from "./classes/ModernHUD.js";
import { createVoiceChatUI } from "./classes/utils.js";
import StoreUI from "./classes/StoreUI.js";
import AdManager from "./classes/AdManager.js";
import AdRewards from "./classes/AdRewards.js";
import AdRewardsUI from "./classes/AdRewardsUI.js";

// In main.js, add this near the top after imports, outside all functions
window.addEventListener("message", async (event) => {
  if (event.origin !== window.location.origin) {
    return;
  }

  if (event.data?.type !== "CIVIC_AUTH_SUCCESS") {
    return;
  }

  console.log("🎉 Auth success message received in main window");

  // Show loading notification
  if (feedbackSystem) {
    feedbackSystem.showNotification(
      "Authentication successful! Loading wallet...",
      "#ffaa00",
    );
  }

  // Show loading on wallet button if walletUI exists
  if (window.walletUI) {
    window.walletUI._setButtonLoading(true);
    window.walletUI._setStatus("Loading wallet...", "#ffaa00");
  }

  // Wait a bit for cookies to be set
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Force fetch wallet
  let attempts = 0;
  const maxAttempts = 10;
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  while (attempts < maxAttempts) {
    attempts++;
    console.log(`🔄 Fetching wallet, attempt ${attempts}...`);

    if (window.walletUI) {
      window.walletUI._setStatus(
        `Fetching wallet (${attempts}/${maxAttempts})...`,
        "#ffaa00",
      );
    }

    try {
      const res = await fetch("/api/wallet", { credentials: "include" });
      const data = await res.json();

      if (data.authenticated && data.wallet) {
        console.log("✅ Wallet confirmed:", data.wallet);

        // Update VanillaWalletUI instance
        if (window.walletUI) {
          window.walletUI.walletAddress = data.wallet;
          window.walletUI.isAuthenticated = true;

          const name = data.user?.name || data.wallet.slice(0, 6);
          const initial = name.charAt(0).toUpperCase();
          window.walletUI._setButtonConnected(name, initial);
          window.walletUI._setButtonLoading(false);
          window.walletUI._setStatus(`✅ Signed in as ${name}`, "#14F195");
        }

        // Fire wallet-ready event
        window.dispatchEvent(
          new CustomEvent("wallet-ready", {
            detail: { address: data.wallet, user: data.user },
          }),
        );

        // Send to socket
        if (window.socket?.connected) {
          window.socket.emit("walletConnected", { wallet: data.wallet });
        }

        // Update store
        if (window.storeUI) {
          window.storeUI.updateWalletDisplay();
        }

        // Update self player
        if (window.self_player) {
          window.self_player.walletAddress = data.wallet;
        }

        return; // Success
      }
    } catch (e) {
      console.warn(`Attempt ${attempts} failed:`, e);
    }

    await delay(1000);
  }

  console.error("❌ Could not confirm wallet after auth");
  if (window.walletUI) {
    window.walletUI._setButtonLoading(false);
    window.walletUI._setStatus(
      "Auth failed — please refresh and try again",
      "#ff6666",
    );
  }
});

// window.addEventListener("message", (event) => {
//     console.log("📨 Received message:", {
//         type: event.data?.type,
//         origin: event.origin,
//         source: event.source ? (event.source === window ? "self" : "other") : "unknown",
//         data: event.data
//     });
// });

window.WEAPON_CONFIGS = WEAPON_CONFIGS;

const isNative = Capacitor.isNativePlatform();

// ──────────────────────────────────────────────────────────────────
// CONNECTION MANAGER
// ──────────────────────────────────────────────────────────────────
class ConnectionManager {
  constructor() {
    this.serverUrl = null;
    this.socket = null;
  }

  // async getServerUrl() {
  //   return "https://serrulate-nonenviably-halina.ngrok-free.dev";
  // }

  async getServerUrl() {
    return "https://eloquence-overlay-kisser.ngrok-free.dev";
  }

  // async getServerUrl() {
  //   return "http://localhost:5000";
  // }

  async connect() {
    const serverUrl = await this.getServerUrl();
    console.log("Connecting to server:", serverUrl);
    this.socket = io(serverUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000,
      upgrade: true,
      rememberUpgrade: true,
    });
    return this.socket;
  }
}

// ──────────────────────────────────────────────────────────────────
// UI SOUND MANAGER
// ──────────────────────────────────────────────────────────────────
class UISoundManager {
  constructor() {
    this.sounds = {
      button: null, // Click_Electronic_00.mp3
      select: null, // Click_Electronic_14.mp3
    };
    this.audioContext = null;
    this.isEnabled = true;
    this.init();
  }

  async init() {
    try {
      // Create AudioContext (will be resumed on user interaction)
      this.audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();

      // Load sounds
      await this.loadSound("/assets/sounds/Click_Electronic_00.mp3", "button");
      await this.loadSound("/assets/sounds/Click_Electronic_14.mp3", "select");

      console.log("✅ UI sounds loaded");
    } catch (error) {
      console.warn("⚠️ Could not load UI sounds:", error);
    }
  }

  async loadSound(url, name) {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.sounds[name] = audioBuffer;
    } catch (error) {
      console.warn(`Failed to load sound ${url}:`, error);
    }
  }

  playButtonClick() {
    if (!this.isEnabled || !this.audioContext || !this.sounds.button) return;

    // Resume context if suspended (browser autoplay policy)
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume().then(() => {
        this._playSound("button");
      });
    } else {
      this._playSound("button");
    }
  }

  playSelectClick() {
    if (!this.isEnabled || !this.audioContext || !this.sounds.select) return;

    // Resume context if suspended (browser autoplay policy)
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume().then(() => {
        this._playSound("select");
      });
    } else {
      this._playSound("select");
    }
  }

  _playSound(soundName) {
    try {
      const source = this.audioContext.createBufferSource();
      source.buffer = this.sounds[soundName];

      // Add a small gain node for volume control
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = 0.3; // 30% volume

      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      source.start(0);
    } catch (error) {
      console.warn(`Failed to play ${soundName} sound:`, error);
    }
  }

  resume() {
    if (this.audioContext && this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }
  }
}

// ──────────────────────────────────────────────────────────────────
// GLOBALS
// ──────────────────────────────────────────────────────────────────
let connectionManager, socket, world, self;
let roomManager, voiceChat, loadoutUI, minimap, mobileControls;
let pendingLoadoutWeapons = null;
let gameStarted = false;
let lastUpdateTime = 0;

let deathScreenTimeout = null;
let respawnCountdownInterval = null;
let isRespawning = false;
let respawnTimer = null;
let walletUI;
let feedbackSystem, currencySystem;
let modernHUD;

let isGameActive = false;
let isUIFlowActive = true;

let adManager, adRewards, adRewardsUI;

let deathCount = 0;

// Selected map key — set by UIFlow before session start
let selectedMapKey = null;

const players = new PlayerList();
window.players = players;
const messages = new MessageList();
const messageHistory = new MessageList();
let historyCurrent = -1;
const speechRange = 300;
const isMobile = /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent);
const UPDATE_INTERVAL = isMobile ? 100 : 50;
let uiSoundManager = null;
let lastCameraMode = "shoulder"; // Default mode
let lastIsAiming = true; // Shoulder mode has aiming active

window.footstepSounds = [];
window.breathingSounds = [];
window.footstepIndex = 0;
window.footstepTimer = 0;
window.breathTimer = 0;
window.breathIndex = 0;
window.wasRunning = false;
window.breathInterval = 0.8;
window.targetBreathInterval = 0.8;
window.breathVolume = 0.05;
window.targetBreathVolume = 0.05;
window.isGameActive = isGameActive;
window.isUIFlowActive = isUIFlowActive;

// ──────────────────────────────────────────────────────────────────
// CAPACITOR INIT
// ──────────────────────────────────────────────────────────────────
async function initCapacitor() {
  if (!isNative) return;
  try {
    await ScreenOrientation.lock({ orientation: "landscape" });
    await StatusBar.hide();
    await CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        if (world?.setReducedPerformance) world.setReducedPerformance(false);
        if (connectionManager.socket && !connectionManager.socket.connected)
          connectionManager.socket.connect();
      } else {
        if (world?.setReducedPerformance) world.setReducedPerformance(true);
      }
    });
    await CapacitorApp.addListener("backButton", () => {
      if (confirm("Exit game?")) CapacitorApp.exitApp();
    });
  } catch (error) {
    console.error("Capacitor init error:", error);
  }
}

// ──────────────────────────────────────────────────────────────────
// SOUNDS
// ──────────────────────────────────────────────────────────────────
function initSounds() {
  ["/assets/sounds/st1.mp3", "/assets/sounds/st2.mp3"].forEach((f) => {
    const a = new Audio(f);
    a.volume = 0.2;
    window.footstepSounds.push(a);
  });
  ["/assets/sounds/breathe-in.mp3", "/assets/sounds/breathe-out.mp3"].forEach(
    (f) => {
      const a = new Audio(f);
      a.volume = 0.05;
      window.breathingSounds.push(a);
    },
  );
  const unlock = () => {
    [...window.footstepSounds, ...window.breathingSounds].forEach((s) => {
      s.play()
        .then(() => s.pause())
        .catch(() => {});
      s.currentTime = 0;
    });
    document.removeEventListener("click", unlock);
    document.removeEventListener("keydown", unlock);
  };
  document.addEventListener("click", unlock);
  document.addEventListener("keydown", unlock);
}

// ──────────────────────────────────────────────────────────────────
// MAIN ENTRY
// ──────────────────────────────────────────────────────────────────
async function initGame() {
  await initCapacitor();

  // Initialize UI sound manager
  uiSoundManager = new UISoundManager();
  window.uiSoundManager = uiSoundManager;

  // Resume audio context on first user interaction
  const resumeAudio = () => {
    if (uiSoundManager && uiSoundManager.audioContext) {
      uiSoundManager.resume();
    }
    document.removeEventListener("click", resumeAudio);
    document.removeEventListener("keydown", resumeAudio);
  };
  document.addEventListener("click", resumeAudio);
  document.addEventListener("keydown", resumeAudio);

  // Initialise Three.js world immediately (renderer, camera, etc.)
  // Map won't load until UIFlow provides a selection.
  world = new World();
  const wsm = getWeaponSoundManager();
  await wsm.init(); // ✅ Now audioContext is created

  let leaderboardUI = new LeaderboardUI();
  window.leaderboardUI = leaderboardUI;

  feedbackSystem = new FeedbackSystem(wsm.audioContext);
  window.feedbackSystem = feedbackSystem;

  modernHUD = new ModernHUD();
  window.modernHUD = modernHUD;

  setTimeout(attachStoreButtonEvents, 1000);

  walletUI = new VanillaWalletUI();
  window.walletUI = walletUI;
  initSounds();

  // Connect to server in background
  connectionManager = new ConnectionManager();
  socket = await connectionManager.connect();
  window.socket = socket;

  if (socket) {
    socket.on("connect", () => {
      console.log("Socket connected, checking for wallet...");
      // If wallet was already loaded before socket connected, send it now
      if (window.userWalletAddress) {
        socket.emit("walletConnected", { wallet: window.userWalletAddress });
        console.log(
          "✅ Wallet address re-sent after socket connection:",
          window.userWalletAddress,
        );
      }
      // Also check VanillaWalletUI directly
      if (window.walletUI && window.walletUI.walletAddress) {
        socket.emit("walletConnected", {
          wallet: window.walletUI.walletAddress,
        });
        console.log(
          "✅ Wallet address re-sent from walletUI:",
          window.walletUI.walletAddress,
        );
      }
    });
  }

  // Initialize Ad Manager
  adManager = new AdManager();
  await adManager.initialize();

  // Initialize Ad Rewards
  adRewards = new AdRewards(socket, adManager);
  adRewardsUI = new AdRewardsUI(adRewards);

  window.adManager = adManager;
  window.adRewards = adRewards;
  window.adRewardsUI = adRewardsUI;

  window.storeUI = new StoreUI(socket);

  // Show UI flow — blocks until player picks name + map
  new UIFlow(({ name, mapKey, loadout }) => {
    selectedMapKey = mapKey;
    console.log(
      `✅ UIFlow resolved → name=${name}, map=${mapKey}, loadout=${loadout.length} weapons`,
    );

    // Store loadout for when initSelf fires
    window.pendingLoadoutWeapons = loadout;

    // Load the selected map
    world.loadMapForSession(mapKey);

    // Emit findMatch with map tag so server puts us in the right session
    socket.emit("findMatch", { mapKey });

    // Show the in-game blocker / click-to-play overlay
    _showGameBlocker(name);
  });

  setupSocketHandlers();
}

// ──────────────────────────────────────────────────────────────────
// GAME BLOCKER (click to lock pointer)
// ──────────────────────────────────────────────────────────────────
function _showGameBlocker(playerName) {
  // Reuse existing blocker markup or create minimal one
  let blocker = document.getElementById("blocker");
  if (!blocker) {
    blocker = document.createElement("div");
    blocker.id = "blocker";
    blocker.style.cssText =
      "position:fixed;inset:0;z-index:50;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;font-family:Orbitron,monospace;color:#fff;";
    document.body.appendChild(blocker);
  }

  const mapMeta = {
    shooting_range: "Shooting Range",
    greeble_map: "Ancient Ruins",
  };

  blocker.innerHTML = `
    <div id="instructions" style="text-align:center;max-width:420px;padding:40px;background:rgba(0,0,0,0.7);border:1px solid rgba(80,140,220,0.3);border-radius:4px;">
      <div id="newPlayer" style="margin-bottom:20px;">
        <div style="font-size:13px;letter-spacing:0.3em;color:#4a7ab0;margin-bottom:8px;">OPERATOR</div>
        <div style="font-family:Orbitron,monospace;font-size:22px;font-weight:700;color:#e8f0ff;letter-spacing:0.12em;margin-bottom:4px;">${playerName}</div>
        <div style="font-size:11px;color:#4a6a9a;letter-spacing:0.15em;">ZONE: ${(
          mapMeta[selectedMapKey] || selectedMapKey
        ).toUpperCase()}</div>
        <div style="margin-top:16px;font-size:11px;color:#4a7ab0;letter-spacing:0.1em;">Waiting for session...</div>
      </div>
      <div id="startGame" style="display:none;">
        <button id="btnStart" style="font-family:Orbitron,monospace;font-size:13px;font-weight:700;letter-spacing:0.2em;padding:14px 32px;background:rgba(40,100,200,0.4);border:1px solid rgba(80,180,255,0.7);color:#e8f4ff;border-radius:2px;cursor:pointer;margin-top:12px;">
          ▶ ENTER WARZONE
        </button>
      </div>
    </div>
  `;

  // Pre-fill the txtName equivalent used by socket flow
  window._pendingPlayerName = playerName;
}

// Add function to save camera state
function saveCameraState() {
  if (world && world.controls) {
    lastCameraMode = world.controls.cameraMode;
    lastIsAiming = world.controls.isAiming;
    console.log(
      `Saved camera state: mode=${lastCameraMode}, aiming=${lastIsAiming}`,
    );
  }
}

// Add function to restore camera state
function restoreCameraState() {
  if (world && world.controls) {
    const controls = world.controls;

    // Force restore to the saved mode
    if (controls.cameraMode !== lastCameraMode) {
      // Cycle until we reach the saved mode
      const modes = ["thirdPerson", "shoulder", "fps"];
      while (controls.cameraMode !== lastCameraMode) {
        controls.cycleCameraMode();
      }
    }

    // Restore aiming state based on mode
    if (lastCameraMode === "shoulder" || lastCameraMode === "fps") {
      if (!controls.isAiming) {
        controls.startAiming();
      }
    } else {
      if (controls.isAiming) {
        controls.stopAiming();
      }
    }

    // Handle FPS mode specific: hide player mesh
    if (lastCameraMode === "fps") {
      if (controls.player && controls.player.pitchObj) {
        controls.player.pitchObj.visible = false;
      }
      controls.createFPSWeapon();
      if (world.crosshair3D) {
        world.crosshair3D.show();
      }
    } else {
      if (controls.player && controls.player.pitchObj) {
        controls.player.pitchObj.visible = true;
      }
      if (controls.fpsWeapon) {
        controls.camera.remove(controls.fpsWeapon);
        controls.fpsWeapon = null;
      }
      if (lastCameraMode === "shoulder") {
        if (world.crosshair3D) {
          world.crosshair3D.show();
          world.crosshair3D.setAiming(true);
        }
      } else {
        if (world.crosshair3D) {
          world.crosshair3D.hide();
        }
      }
    }

    console.log(
      `Restored camera state: mode=${controls.cameraMode}, aiming=${controls.isAiming}`,
    );
  }
}

// ──────────────────────────────────────────────────────────────────
// SOCKET HANDLERS
// ──────────────────────────────────────────────────────────────────
function setupSocketHandlers() {
  // Server acknowledges match — now create session with player name
  socket.on("matchJoined", ({ matchId }) => {
    console.log("✅ Joined match:", matchId, "map:", selectedMapKey);
    // Emit initNewSession using the name chosen in UIFlow
    const name = window._pendingPlayerName || "Operator";
    socket.emit("initNewSession", name);
  });

  socket.on("killReward", (data) => {
    console.log(`🏆 Kill reward received:`, data);

    if (feedbackSystem) {
      const headshotBonus = data.isHeadshot ? " 🎯 HEADSHOT BONUS!" : "";
      feedbackSystem.showNotification(
        `🏆 +${data.reward || data.amount} $JBKS for ${
          data.weapon || data.weaponName
        } kill!${headshotBonus}`,
        "#14F195",
      );
    }

    fetchCreditsAndUpdateDisplay();
  });

  // Optional: Add daily claim response
  socket.on("dailyClaimReward", (data) => {
    if (feedbackSystem) {
      feedbackSystem.showNotification(
        `🎁 Daily reward: +${data.amount} $JBKS!`,
        "#00ff88",
      );
    }
  });

  socket.on("checkSessionCallback", () => {
    // We now skip this path — UIFlow handles name entry before connection
    players.getAll().forEach((player) => {
      if (player.mixer) world.addMixer(player.mixer);
    });
  });

  socket.on("playerAnimation", (data) => {
    const player = players.find(data.id);
    if (player && player !== self) player.handleRemoteAnimation(data.animation);
  });

  socket.on("initSelf", (data) => {
    console.log("✅ initSelf received");

    self = new Player(data.id, data.name, data.color, socket, world, data.pos);
    window.self_player = self;

    // Show that player is now loading
    if (world.mapLoadingScreen) {
      world.updateLoadingProgress(50, "Loading player model...", "player");
    }

    if (window.pendingLoadoutWeapons?.length === 4) {
      self.setLoadout(window.pendingLoadoutWeapons);

      // ✅ EMIT confirmLoadout HERE, after loadout is set
      const weaponNames = window.pendingLoadoutWeapons.map((w) => w.name);
      socket.emit("confirmLoadout", { weapons: weaponNames });

      window.pendingLoadoutWeapons = null;
    } else {
      self.loadDefaultWeapons();
    }

    // ADD THIS: Ensure weapons are ready and attached
    self.ensureWeaponsReady().then(() => {
      setTimeout(() => {
        self.attachCurrentWeapon();
        console.log("✅ Self weapons attached:", self.weapons?.length);
      }, 100);
    });

    players.add(self);
    world.initControls(self);

    // ✅ Wait for player model to load using an interval (since onModelLoaded doesn't exist)
    let modelCheckAttempts = 0;
    const maxModelCheckAttempts = 100;

    const checkModelLoaded = setInterval(() => {
      modelCheckAttempts++;

      if (self.modelLoaded) {
        clearInterval(checkModelLoaded);
        console.log("✅ Player model loaded successfully");

        // Update loading progress if loading screen exists
        if (world.updateLoadingProgress) {
          world.updateLoadingProgress(100, "Player ready!", "player");
          // Hide loading screen after a short delay
          setTimeout(() => {
            world.hideMapLoadingScreen();
            // ✅ Show the ready button
            if (world.showReadyButton) {
              world.showReadyButton();
            }
          }, 500);
        }
      } else if (modelCheckAttempts >= maxModelCheckAttempts) {
        clearInterval(checkModelLoaded);
        console.warn("⚠️ Player model load timeout, proceeding anyway");
        if (world.hideMapLoadingScreen) {
          world.hideMapLoadingScreen();
          if (world.showReadyButton) {
            world.showReadyButton();
          }
        }
      }
    }, 100);

    // Activate jetpack immediately if on greeble map
    if (selectedMapKey === "greeble_map" && world.controls) {
      // Don't auto-activate — player must pick up a jetpack
      console.log(
        "Greeble map: jetpack pickups spawned, player must collect one",
      );
    }

    voiceChat = new VoiceChat(socket, self);
    window.voiceChat = voiceChat;

    if (world.controls) {
      mobileControls = new MobileControls(world.controls);
      mobileControls.init();
      window.mobileControls = mobileControls;
    }

    minimap = new Minimap(2000);
    minimap.setPlayer(self);
    window.minimap = minimap;

    // Only init room manager for maps with rooms
    if (MAPS[selectedMapKey]?.hasRooms) {
      roomManager = new RoomManager(world, socket, self, minimap);
      window.roomManager = roomManager;
      _setupRoomManagerCallbacks();
    }

    if (modernHUD) {
      modernHUD.updateGrenadeCount(self.grenadeCount, self.maxGrenades);
    }

    startGame();
  });

  socket.on("spawnPoints", (spawnPositions) => {
    window.spawnPoints = spawnPositions;
    if (world && !world.spawnPointsRequested) {
      const currentMapConfig = world.mapManager?.currentMapConfig;
      if (currentMapConfig?.hasSpawnBoxes) {
        world.createBoxesAtSpawnPoints(spawnPositions);
      } else {
        world.spawnPointsRequested = true;
      }
    }
  });

  socket.on("initOthersCallback", (data) => {
    console.log("initOthersCallback received with", data.length, "players");
    for (const playerData of data) {
      if (playerData.mapKey && playerData.mapKey !== selectedMapKey) continue;

      const existingPlayer = players.find(playerData.id);
      if (existingPlayer) continue;

      const newPlayer = new Player(
        playerData.id,
        playerData.name,
        playerData.color,
        null,
        world,
        playerData.pos,
      );
      if (playerData.weaponIndex !== undefined)
        newPlayer.currentWeaponIndex = playerData.weaponIndex;
      if (playerData.loadout?.length > 0) {
        newPlayer.setLoadoutFromServer(playerData.loadout);
      }
      players.add(newPlayer);
      world.addObject(newPlayer.getThreeObj());
      if (minimap) minimap.addPlayer(playerData.id, newPlayer);

      // MODIFIED: Add timeout to give model time to load
      newPlayer.ensureWeaponsReady().then(() => {
        const checkInterval = setInterval(() => {
          if (newPlayer.modelLoaded) {
            clearInterval(checkInterval);
            newPlayer.attachCurrentWeapon();
            console.log(
              `✅ Attached weapons for existing player ${newPlayer.name}`,
            );
          }
        }, 100);
        // Safety timeout
        setTimeout(() => {
          clearInterval(checkInterval);
          if (newPlayer.modelLoaded) {
            newPlayer.attachCurrentWeapon();
          }
        }, 5000);
      });
    }
  });

  socket.on("newPlayer", (data) => {
    if (data.mapKey && data.mapKey !== selectedMapKey) return;
    const existingPlayer = players.find(data.id);
    if (existingPlayer) return;
    if (!world) return;

    const newPlayer = new Player(
      data.id,
      data.name,
      data.color,
      null,
      world,
      data.pos,
    );
    if (data.weaponIndex !== undefined)
      newPlayer.currentWeaponIndex = data.weaponIndex;

    if (data.loadout?.length > 0) {
      // Convert weapon names to configs
      const weaponConfigs = data.loadout
        .map((name) => {
          const found = Object.entries(WEAPON_CONFIGS).find(
            ([, cfg]) => cfg.name === name,
          );
          return found ? found[1] : null;
        })
        .filter(Boolean);
      if (weaponConfigs.length === 4) {
        newPlayer.setLoadout(weaponConfigs);
      }
    }

    players.add(newPlayer);
    world.addObject(newPlayer.getThreeObj());
    if (minimap) minimap.addPlayer(data.id, newPlayer);

    newPlayer.ensureWeaponsReady().then(() => {
      const checkInterval = setInterval(() => {
        if (newPlayer.modelLoaded) {
          clearInterval(checkInterval);
          newPlayer.attachCurrentWeapon();
        }
      }, 100);
    });

    addMessage(
      new Message(
        `${data.name} joined the game`,
        { name: "Server" },
        Date.now(),
      ),
    );
  });

  socket.on("updatePlayer", (data) => {
    const player = players.find(data.id);
    if (player) {
      const prevIdx = player.currentWeaponIndex;
      player.setTargetPos(data.pos);
      player.setTargetRotation(data.rotation);
      if (data.animation && player !== self)
        player.handleRemoteAnimation(data.animation);
      if (
        data.weaponIndex !== undefined &&
        data.weaponIndex !== prevIdx &&
        player !== self
      ) {
        player.currentWeaponIndex = data.weaponIndex;
        player
          .ensureWeaponsReady()
          .then(() => setTimeout(() => player.attachCurrentWeapon(), 50));
      }
      const distance = world.getDistanceTo(player.getThreeObj());
      if (player.nameLabel) player.nameLabel.show = distance <= speechRange;
    }
  });

  socket.on("updatePlayerName", (data) => {
    const player = players.find(data.id);
    if (player) {
      const oldName = player.name;
      player.name = data.name;
      if (player.nameLabel?.element)
        player.nameLabel.element.textContent = data.name;
      addMessage(
        new Message(
          `${oldName} changed name to ${player.name}`,
          { name: "Server" },
          Date.now(),
        ),
      );
    }
  });

  socket.on("removePlayer", (data) => {
    const player = players.find(data.id);
    if (player) {
      if (player.nameLabel?.parent)
        player.nameLabel.parent.remove(player.nameLabel);
      if (player.nameLabelObj?.parent)
        player.nameLabelObj.parent.remove(player.nameLabelObj);
      players.remove(player);
      world.removeObject(player.getThreeObj());
      if (minimap) minimap.removePlayer(data.id);
    }
  });

  socket.on("playerLoadout", (data) => {
    // ✅ Skip if this is our own loadout (we already have weapons attached)
    if (data.id === self?.id) return;

    const player = players.find(data.id);
    if (player && player !== self) {
      const weaponConfigs = data.weapons
        .map((name) => {
          const found = Object.entries(WEAPON_CONFIGS).find(
            ([, cfg]) => cfg.name === name,
          );
          return found ? found[1] : null;
        })
        .filter(Boolean);
      if (weaponConfigs.length === 4) {
        player.setLoadout(weaponConfigs);
        // ADD THIS: Ensure weapons are ready and attach them
        player.ensureWeaponsReady().then(() => {
          setTimeout(() => {
            if (player.modelLoaded) {
              player.attachCurrentWeapon();
              console.log(`✅ Attached weapons for ${player.name}`);
            }
          }, 200);
        });
      }
    }
  });

  socket.on("playerWeaponSwitch", (data) => {
    const player = players.find(data.id);
    if (player && player !== self)
      player.handleRemoteWeaponSwitch(data.weaponIndex);
  });

  socket.on("playerReload", (data) => {
    const player = players.find(data.id);
    if (player && player !== self) player.playAnimation("reloading", false);
  });

  socket.on("playerHit", (data) => {
    if (data.shooterId === self?.id) {
      feedbackSystem.playHitSound(); // ✅ Add this
      feedbackSystem.showHitMarker(data.isHeadshot);
      showHitMarker();
      // Show damage number on target
      const targetPlayer = players.find(data.targetId);
      if (targetPlayer) {
        showDamageNumber(
          data.damage,
          targetPlayer.getThreeObj().position,
          data.isHeadshot,
        );
      }
    }

    const targetPlayer = players.find(data.targetId);
    if (targetPlayer && world) {
      const pos = targetPlayer.getThreeObj().position.clone();
      pos.y += 12;
      showHitEffect(pos);
      if (targetPlayer === self) {
        self.takeDamage(data.damage);
        self.updateHealthUI();
        // Show damage number on self
        showDamageNumber(
          data.damage,
          self.getThreeObj().position,
          data.isHeadshot,
        );
      }
    }
  });

  socket.on("progressionUpdate", (data) => {
    if (data.progression) {
      feedbackSystem.updateCreditsDisplay(
        data.progression.credits,
        data.progression.level,
      );
      feedbackSystem.updateXPBar(
        data.progression.xp,
        100 * Math.pow(data.progression.level + 1, 1.5),
      );
      feedbackSystem.updateDailyChallenges(
        data.progression.dailyChallenges,
        data.progression.dailyChallengeProgress,
      );

      if (data.killRewards) {
        const r = data.killRewards;
        feedbackSystem.showNotification(
          `+${r.xpGained} XP 💎 +${r.creditsGained} credits`,
          "#ffaa00",
        );
        if (r.leveledUp && r.newLevel) {
          feedbackSystem.showLevelUp(r.newLevel, r.newUnlocks || []);
        }
      }
    }
  });

  // Leaderboard handler
  socket.on("leaderboardUpdate", (data) => {
    if (window.leaderboardUI && window.leaderboardUI.isOpen)
      window.leaderboardUI.update(data);
  });

  socket.on("playerDied", (data) => {
    const player = players.find(data.playerId);
    if (!player) return;

    if (player === self) {
      // Enhanced death screen with killer info
      const killer = players.find(data.killerId);
      if (killer) {
        addKillFeedEntry(
          killer.name,
          player.name,
          data.weaponName,
          data.isHeadshot,
        );
      }
      showDeathScreen(
        killer?.name || "Unknown",
        data.weaponName,
        data.isHeadshot,
      );

      // Disable controls
      if (world && world.controls) {
        world.controls.enabled = false;
      }

      // Hide crosshair
      if (world && world.crosshair3D) {
        world.crosshair3D.hide();
      }

      self.die(data.killerId);
      return;
    }

    // Remote player death
    player.playAnimation("dying", false, false);
    player.isDead = true;

    const killer = players.find(data.killerId);
    const headshotText = data.isHeadshot ? " 💀 HEADSHOT!" : "";
    addMessage(
      new Message(
        `💀 ${killer?.name || "Unknown"} eliminated ${
          player.name
        }${headshotText}`,
        { name: "Server" },
        Date.now(),
      ),
    );

    setTimeout(() => {
      if (player.nameLabel?.parent)
        player.nameLabel.parent.remove(player.nameLabel);
      if (player.nameLabelObj?.parent)
        player.nameLabelObj.parent.remove(player.nameLabelObj);

      // ✅ Dispose weapon models to free GPU memory
      player.weapons?.forEach((w) => {
        if (w.model) {
          w.model.traverse((child) => {
            if (child.isMesh) {
              child.geometry?.dispose();
              if (Array.isArray(child.material)) {
                child.material.forEach((m) => m.dispose());
              } else {
                child.material?.dispose();
              }
            }
          });
        }
        if (w.holsteredModel?.parent)
          w.holsteredModel.parent.remove(w.holsteredModel);
      });

      players.remove(player);
      if (world) world.removeObject(player.getThreeObj());
      if (minimap) minimap.removePlayer(data.playerId);
    }, 5000);

    if (data.killerId === self?.id && data.killerId !== data.playerId) {
      feedbackSystem.addKillfeedEntry(
        self.name,
        data.playerName,
        data.weaponName,
        data.isHeadshot,
      );
      if (data.isHeadshot) {
        feedbackSystem.playHeadshotSound(); // ✅ Add this
      } else {
        feedbackSystem.playKillSound(); // ✅ Add this
      }
    }

    if (
      data.killerProgression &&
      data.killerProgression.currentKillstreak > 1
    ) {
      feedbackSystem.showKillstreak(data.killerProgression.currentKillstreak);
    }
  });

  socket.on("inventoryUpdate", (data) => {
    if (window.modernHUD) {
      window.modernHUD.updateInventory(data.inventory);
    }
  });

  socket.on("ammoCollected", (data) => {
    if (window.modernHUD) {
      window.modernHUD.updateInventory(data.inventory);
    }
    if (feedbackSystem) {
      feedbackSystem.showNotification(
        "📦 Ammo Pack added to inventory!",
        "#ffaa00",
      );
    }
  });

  socket.on("vaccineCollected", (data) => {
    if (window.modernHUD) {
      window.modernHUD.updateInventory(data.inventory);
    }
    if (feedbackSystem) {
      feedbackSystem.showNotification(
        "💉 Vaccine added to inventory!",
        "#00ff88",
      );
    }
  });

  socket.on("itemUsed", (data) => {
    if (window.modernHUD) {
      window.modernHUD.updateInventory(data.inventory);
    }

    if (data.effect === "vaccine_activated") {
      if (window.modernHUD) {
        window.modernHUD.showVaccineStatus(true, data.expiresAt);
      }
      if (feedbackSystem) {
        feedbackSystem.showNotification(
          "💉 Vaccine Activated! 60s Protection",
          "#00ff88",
        );
      }
    } else if (data.effect === "ammo_added") {
      // Update reserves in player
      if (self && data.weaponName) {
        self.weaponReserves[data.weaponName] = data.reserves;
      }
      if (feedbackSystem) {
        feedbackSystem.showNotification(
          `📦 +1 ${data.weaponName} Reload`,
          "#ffaa00",
        );
      }
    }
  });

  socket.on("playerVaccineActive", (data) => {
    // Other player activated vaccine - visual indicator
    const player = players.find(data.playerId);
    if (player && player !== self) {
      // Could add a green glow effect here
    }
  });

  socket.on("grenadeCountUpdate", (data) => {
    if (self) {
      self.grenadeCount = data.count;
      self.maxGrenades = data.max;
      if (window.modernHUD) {
        window.modernHUD.updateGrenadeCount(data.count, data.max);
      }
    }
  });

  socket.on("grenadeRefill", (data) => {
    if (self) {
      self.grenadeCount = data.count;
      if (window.modernHUD) {
        window.modernHUD.updateGrenadeCount(data.count, data.max);
      }
      if (feedbackSystem) {
        feedbackSystem.showNotification("💣 +1 Grenade!", "#ffaa44");
      }
    }
  });

  socket.on("newMessage", (data) => {
    const sender = players.find(data.sender.id) ?? data.sender;
    addMessage(new Message(data.text, sender, data.date));
  });

  socket.on("remoteGrenadeThrown", (data) => {
    const player = players.find(data.playerId);
    if (!player || player === self) return;

    // Create and animate a grenade for this remote player
    if (world?.controls) {
      const pos = new THREE.Vector3(
        data.position.x,
        data.position.y,
        data.position.z,
      );
      const dir = new THREE.Vector3(
        data.direction.x,
        data.direction.y,
        data.direction.z,
      );
      world.controls.spawnGrenade(pos, dir, data.throwPower);
    }
  });

  socket.on("remoteGrenadeExploded", (data) => {
    // Create explosion effect at the position (visual only)
    if (world?.controls) {
      const pos = new THREE.Vector3(
        data.position.x,
        data.position.y,
        data.position.z,
      );
      // Create a temporary grenade-like object for the explosion visual
      const dummyGrenade = { position: pos };
      world.controls.explodeGrenade(dummyGrenade);
    }

    // ✅ Apply damage to local player if within radius
    if (self && !self.isDead) {
      const pos = new THREE.Vector3(
        data.position.x,
        data.position.y,
        data.position.z,
      );
      const dist = self.threeObj.position.distanceTo(pos);

      console.log(`💥 Explosion distance: ${dist}, radius: ${data.radius}`);

      if (dist < data.radius) {
        // Calculate damage based on distance
        let damageAmount = Math.floor(data.damage * (1 - dist / data.radius));
        damageAmount = Math.max(10, damageAmount);

        console.log(`💥 Player took ${damageAmount} damage from grenade!`);

        self.takeDamage(damageAmount, data.throwerId);
        self.updateHealthUI();

        // Show damage number
        showDamageNumber(damageAmount, self.threeObj.position, false);
      }
    }
  });

  socket.on("remoteMuzzleFlash", (data) => {
    const player = players.find(data.playerId);
    if (!player || player === self) return;

    // Create a small flash at the position
    if (world?.scene) {
      const pos = new THREE.Vector3(
        data.position.x,
        data.position.y,
        data.position.z,
      );
      const geo = new THREE.SphereGeometry(1, 8, 8);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffaa00,
        transparent: true,
        opacity: 0.8,
      });
      const flash = new THREE.Mesh(geo, mat);
      flash.position.copy(pos);
      world.scene.add(flash);
      setTimeout(() => {
        world.scene.remove(flash);
        geo.dispose();
        mat.dispose();
      }, 100);
    }
  });

  socket.on("serverResponse", (data) => addServerResponse(data));

  socket.on("walletConnected", (data) => {
    if (self) {
      self.solanaWallet = data.wallet;
      self.wallet = data.wallet;
      self.walletAddress = data.wallet;
    }
  });

  socket.on("leaderboardData", (data) => {
    if (window.walletUI) {
      window.walletUI.updateLeaderboard(data.players || []);
    }
    if (window.leaderboardUI) {
      window.leaderboardUI.update(data);
    }
  });

  socket.on("purchaseConfirmed", (data) => {
    console.log("✅ Purchase confirmed:", data);

    if (feedbackSystem) {
      feedbackSystem.showNotification(
        `🛒 ${data.item?.name} added to inventory!`,
        "#14F195",
      );
    }

    // ✅ Update balance display with real on-chain balance
    if (data.newBalance !== undefined) {
      const jbksEl = document.getElementById("profile-jbks");
      if (jbksEl) jbksEl.textContent = `${data.newBalance.toFixed(2)} $JBKS`;

      const storeWallet = document.getElementById("store-wallet");
      if (storeWallet && window.walletUI?.getWalletAddress?.()) {
        const addr = window.walletUI.getWalletAddress();
        storeWallet.textContent = `${addr.slice(0, 6)}...${addr.slice(
          -4,
        )} · ${data.newBalance.toFixed(2)} $JBKS`;
      }
    }

    if (modernHUD && self?.inventory) {
      modernHUD.updateInventory(self.inventory);
    }
  });

  // Add this at the end of the function:
  setupRespawnHandlers();
}

// ──────────────────────────────────────────────────────────────────
// ROOM MANAGER CALLBACKS (shooting_range only)
// ──────────────────────────────────────────────────────────────────
function _setupRoomManagerCallbacks() {
  if (!roomManager) return;

  roomManager.onInitRooms = (roomsData) => {
    roomsData.forEach((roomData) => {
      if (minimap) {
        minimap.addRoom(roomData.id, {
          position: new THREE.Vector3(
            roomData.position.x,
            roomData.position.y,
            roomData.position.z,
          ),
          ammoBoxPosition: new THREE.Vector3(
            roomData.ammoBoxPosition.x,
            roomData.ammoBoxPosition.y,
            roomData.ammoBoxPosition.z,
          ),
          vaccineBoxPosition: new THREE.Vector3(
            roomData.vaccineBoxPosition.x,
            roomData.vaccineBoxPosition.y,
            roomData.vaccineBoxPosition.z,
          ),
          name: roomData.name,
          ammoBoxOpen: false,
          vaccineBoxOpen: false,
          timeRemaining: 0,
        });
      }
    });
  };

  roomManager.onRoomActivated = (data) => {
    if (minimap) {
      minimap.rooms.forEach((r, id) =>
        minimap.updateRoomStatus(
          id,
          id === data.roomId ? "active" : "inactive",
        ),
      );
      minimap.showTarget(data.roomId);
    }
    const el = document.getElementById("room-status");
    if (el) {
      el.style.display = "block";
      el.style.borderLeftColor = "#ffaa00";
      const t = Math.max(0, Math.ceil((data.expiresAt - Date.now()) / 1000));
      el.innerHTML = `<strong style="color:#ffaa00;font-size:16px;">🔔 ACTIVE ROOM</strong><br><span style="color:#fff;font-size:13px;">${data.name}</span><br><span style="color:#ffff00">⏱️ ${t}s remaining</span>`;
    }
  };

  roomManager.onRoomStatus = (data) => {
    const el = document.getElementById("room-status");
    if (el) {
      if (data.timeRemaining > 0) {
        el.style.display = "block";
        el.innerHTML = `<strong style="color:#ffaa00;font-size:16px;">🔔 ACTIVE ROOM</strong><br><span style="color:#ffff00">⏱️ ${Math.ceil(
          data.timeRemaining / 1000,
        )}s </span><span style="color:#00ff00">📦 Ammo: ${
          data.ammoBoxOpen ? "✓" : "✗"
        } (${
          data.ammoCollectedCount
        }) </span><span style="color:#ffff00">💉 Vaccine: ${
          data.vaccineBoxOpen ? "✓" : "✗"
        } (${data.vaccineCollectedCount})</span>`;
      } else {
        el.style.display = "none";
      }
    }
  };
}

// ──────────────────────────────────────────────────────────────────
// START GAME
// ──────────────────────────────────────────────────────────────────
function startGame() {
  if (gameStarted) return;
  gameStarted = true;

  // Set game as active - now keyboard events will work
  window.isGameActive = true;
  window.isUIFlowActive = false;

  // ✅ Resume AudioContext on first game start
  if (feedbackSystem) {
    feedbackSystem.resumeAudioContext();
  }

  const blocker = document.getElementById("blocker");
  const newPlayerDiv = document.getElementById("newPlayer");
  const startGameDiv = document.getElementById("startGame");
  const chatDiv = document.getElementById("chat");

  if (newPlayerDiv) newPlayerDiv.style.display = "none";
  if (startGameDiv) startGameDiv.style.display = "block";
  if (chatDiv) chatDiv.style.display = "block";

  // ✅ Create voice chat UI dynamically
  createVoiceChatUI();

  if (isMobile || isNative) {
    document.getElementById("btnStart")?.click();
  } else {
    document.getElementById("btnStart")?.focus();
  }

  socket.emit("initOthers", "");
  updateSelf();
  if (MAPS[selectedMapKey]?.hasRooms) createRoomStatusIndicator();
  window.roomManager = roomManager;
  window.updateInteractionPrompt = updateInteractionPrompt;
}

// ──────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────
function trim(str) {
  return str.trim();
}

// Add this function to fetch current token balance and update display
async function fetchCreditsAndUpdateDisplay() {
  try {
    const response = await fetch("/api/wallet", { credentials: "include" });
    if (!response.ok) return;
    const data = await response.json();

    if (data.authenticated && data.wallet) {
      const tokenBalance = data.tokenBalance || 0;
      const level = data.user?.level || 1;

      // Update feedback system display
      if (feedbackSystem) {
        feedbackSystem.updateCreditsDisplay(Math.floor(tokenBalance), level);
      }

      // Update profile modal balance if open
      const jbksEl = document.getElementById("profile-jbks");
      if (jbksEl) {
        jbksEl.textContent = `${tokenBalance.toFixed(2)} $JBKS`;
      }

      // Update store wallet display
      const storeWallet = document.getElementById("store-wallet");
      if (storeWallet && data.wallet) {
        storeWallet.textContent = `${data.wallet.slice(
          0,
          6,
        )}...${data.wallet.slice(-4)} · ${tokenBalance.toFixed(2)} $JBKS`;
        storeWallet.style.color = "#14F195";
      }

      console.log(`💰 Balance updated: ${tokenBalance} $JBKS`);
    }
  } catch (error) {
    console.error("Error fetching balance:", error);
  }
}

function updateSelf() {
  const now = Date.now();
  if (now - lastUpdateTime < UPDATE_INTERVAL) {
    setTimeout(updateSelf, UPDATE_INTERVAL - (now - lastUpdateTime));
    return;
  }
  lastUpdateTime = now;
  if (self) {
    socket.emit("updatePlayer", {
      id: self.id,
      color: self.color,
      pos: self.threeObj.position,
      rotation: {
        x: self.pitchObj?.rotation.x || 0,
        y: self.threeObj.rotation.y,
      },
      weaponIndex: self.currentWeaponIndex,
      animation: self.currentAnimation,
      mapKey: selectedMapKey, // ← include mapKey so server/clients can filter
    });
    if (minimap) {
      if (!minimap.player) minimap.player = {};
      minimap.player.position = self.threeObj.position;
      minimap.player.rotation = { y: self.threeObj.rotation.y };
      minimap.player.name = self.name;
    }
    if (self.weapons?.length > 0) {
      const w = self.weapons[self.currentWeaponIndex];
      if (w && modernHUD) {
        const reserves = self.weaponReserves?.[w.name] ?? 0;
        modernHUD.updateAmmo(
          w.ammo,
          w.maxAmmo,
          reserves,
          w.name,
          self.weapons,
          self.currentWeaponIndex,
        );
      }
    }

    // Update health in modern HUD
    if (modernHUD && self) {
      modernHUD.updateHealth(self.health, self.maxHealth);
    }
  }
  setTimeout(updateSelf, 20);
}

function sendMessage() {
  const input = document.getElementById("txtMessage");
  const message = trim(input.value.replace(/(\r\n|\n|\r)/gm, ""));
  if (message.length > 0) {
    socket.emit("sendMessage", message);
    input.value = "";
    messageHistory.add(new Message(message, self, Date.now()));
    historyCurrent = messageHistory.getAll().length;
  }
}

function addMessage(message) {
  const className = message.sender.name === "Server" ? "server" : "";
  const html = `<tr class="${className}"><td class="timestamp">${moment(
    message.date,
  ).format("HH:mm")}</td><td><span class="userName">${
    message.sender.name
  }:</span> ${message.text.replace(/\n/g, "<br>")}</td></tr>`;
  const messageList = document.getElementById("messageList");
  const messagesInner = document.getElementById("messagesInner");
  if (messageList) messageList.insertAdjacentHTML("beforeend", html);
  if (messagesInner)
    requestAnimationFrame(() => {
      messagesInner.scrollTop = messagesInner.scrollHeight;
    });
}

function addServerResponse(response) {
  const html = `<tr><td colspan="2" class="${response.type}">${response.text}</td></tr>`;
  const messageList = document.getElementById("messageList");
  const messagesInner = document.getElementById("messagesInner");
  if (messageList) messageList.insertAdjacentHTML("beforeend", html);
  if (messagesInner)
    requestAnimationFrame(() => {
      messagesInner.scrollTop = messagesInner.scrollHeight;
    });
}

function historyPrev() {
  const h = messageHistory.getAll();
  if (historyCurrent > 0) {
    const msg = h[--historyCurrent];
    if (document.getElementById("txtMessage"))
      document.getElementById("txtMessage").value = msg?.text || "";
  }
}
function historyNext() {
  const h = messageHistory.getAll();
  if (historyCurrent < h.length - 1) {
    const msg = h[++historyCurrent];
    if (document.getElementById("txtMessage"))
      document.getElementById("txtMessage").value = msg?.text || "";
  }
}

function createRoomStatusIndicator() {
  if (document.getElementById("room-status")) return;
  const style = document.createElement("style");
  style.textContent = `
      #room-status {
          position:fixed;top:30px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.1);color:white;padding:10px;font-family:Arial;font-size:0.8rem;z-index:9;border-left:4px solid #888;display:none;text-align:center;
      }
      
      @media (max-width: 960px) {
          #room-status {
              font-size: 10px;
              padding: 8px 16px;
          }
      }
  `;
  document.head.appendChild(style);
  const indicator = document.createElement("div");
  indicator.id = "room-status";
  document.body.appendChild(indicator);
}

function updateInteractionPrompt() {
  // No-op if roomManager not present (greeble map)
  if (!roomManager) return;
  const interactionPrompt = document.getElementById("interaction-prompt");
  if (!interactionPrompt) return;
  if (roomManager?.currentRoomId && roomManager?.activeRoom) {
    const room = roomManager.rooms.get(roomManager.currentRoomId);
    if (room?.isActive) {
      interactionPrompt.style.display = "block";
      if (!room.ammoBoxOpen || !room.vaccineBoxOpen) {
        const available = [];
        if (!room.ammoBoxOpen) available.push("Ammo");
        if (!room.vaccineBoxOpen) available.push("Vaccine");
        interactionPrompt.innerHTML = `🎁 Press E to open (${available.join(
          " / ",
        )})`;
      } else {
        interactionPrompt.innerHTML = "🎁 All boxes opened";
        interactionPrompt.style.opacity = "0.5";
      }
    } else {
      interactionPrompt.style.display = "none";
    }
  } else {
    interactionPrompt.style.display = "none";
  }
}

function showHitMarker() {
  if (world?.crosshair3D) world.crosshair3D.hitFeedback();
  const marker = document.createElement("div");
  marker.style.cssText =
    "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:20px;height:20px;border:2px solid red;border-radius:50%;pointer-events:none;z-index:40;";
  document.body.appendChild(marker);
  setTimeout(() => marker.remove(), 200);
}

function showHitEffect(position) {
  if (!world?.scene) return;
  const geo = new THREE.SphereGeometry(3, 8, 8);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0.7,
  });
  const effect = new THREE.Mesh(geo, mat);
  effect.position.copy(position);
  world.scene.add(effect);
  setTimeout(() => {
    world.scene.remove(effect);
    geo.dispose();
    mat.dispose();
  }, 150);
}

function setupRespawnHandlers() {
  socket.on("playerRespawned", (data) => {
    if (data.playerId === self?.id) return;

    // REUSE existing player object instead of destroying + recreating
    let existingPlayer = players.find(data.playerId);
    if (existingPlayer) {
      // Just reset their state and reposition — don't recreate
      existingPlayer.health = data.health;
      existingPlayer.maxHealth = data.maxHealth;
      existingPlayer.isDead = false;
      existingPlayer.deathProcessed = false;
      existingPlayer.threeObj.visible = true;
      existingPlayer.threeObj.position.set(
        data.position.x,
        data.position.y,
        data.position.z,
      );
      if (existingPlayer.nameLabel) {
        existingPlayer.nameLabel.element.style.opacity = "1";
      }
      existingPlayer.playAnimation("idle", false, true);
      return; // Don't create a new player
    }

    // Only create new player if they truly don't exist yet
    const newPlayer = new Player(
      data.playerId,
      data.playerName,
      data.color || null,
      null,
      world,
      data.position,
    );
    newPlayer.health = data.health;
    newPlayer.maxHealth = data.maxHealth;
    newPlayer.isDead = false;

    if (data.loadout?.length > 0) newPlayer.setLoadoutFromServer(data.loadout);

    players.add(newPlayer);
    world.addObject(newPlayer.getThreeObj());
    if (minimap) minimap.addPlayer(data.playerId, newPlayer);

    newPlayer.ensureWeaponsReady().then(() => {
      const checkInterval = setInterval(() => {
        if (newPlayer.modelLoaded) {
          clearInterval(checkInterval);
          newPlayer.attachCurrentWeapon();
        }
      }, 100);
    });
  });

  socket.on("respawnConfirmed", (data) => {
    isRespawning = false;
    if (!self) return;

    saveCameraState();

    self.setPos(data.position);
    self.setRotation(data.rotation);
    self.health = data.health;
    self.maxHealth = data.maxHealth;
    self.isDead = false;
    self.deathProcessed = false;
    self.updateHealthUI();

    if (self.threeObj) self.threeObj.visible = true;
    if (self.pitchObj) self.pitchObj.visible = true;

    if (!players.find(self.id)) players.add(self);

    if (world?.controls) {
      world.controls.enabled = true;
      world.controls.isDead = false;
      world.controls.velocity.set(0, 0, 0);
    }

    hideDeathScreen();

    if (minimap) minimap.setPlayer(self);

    // Defer weapon re-attach to next frame — don't block render
    requestAnimationFrame(() => {
      self.ensureWeaponsReady().then(() => {
        self.attachCurrentWeapon();
        self.updateHolsteredWeapons();
      });
      // Restore camera after weapons are set
      setTimeout(() => restoreCameraState(), 50);
    });
  });
}

// function showDeathScreen(killerName, weaponName, isHeadshot) {
//   const existingOverlay = document.getElementById("death-overlay");
//   if (existingOverlay) existingOverlay.remove();

//   const overlay = document.createElement("div");
//   overlay.id = "death-overlay";
//   overlay.style.cssText = `
//         position: fixed; inset: 0;
//         background: linear-gradient(135deg, rgba(100, 0, 0, 0.85), rgba(0, 0, 0, 0.95));
//         display: flex; flex-direction: column;
//         align-items: center; justify-content: center;
//         z-index: 99999;
//         font-family: 'Orbitron', monospace;
//         animation: deathFade 0.5s ease-in;
//     `;

//   const headshotText = isHeadshot
//     ? '<span style="color:#ff4444; font-weight:bold;">💀 HEADSHOT! 💀</span><br>'
//     : "";

//   overlay.innerHTML = `
//         <div style="text-align: center; max-width: 500px; padding: 40px; background: rgba(0,0,0,0.8); border: 1px solid #ff4444; border-radius: 8px;">
//             <h1 style="font-size: 64px; margin: 0; color: #ff4444; text-shadow: 0 0 20px rgba(255,0,0,0.5);">YOU DIED</h1>
//             ${headshotText}
//             <p style="font-size: 20px; margin: 16px 0; color: #ffaa44;">
//                 Killed by ${killerName || "Unknown"} ${
//     weaponName ? `(${weaponName})` : ""
//   }
//             </p>
//             <div style="margin: 30px 0;">
//                 <div style="font-size: 14px; color: #aaa; margin-bottom: 10px;">RESPAWNING IN</div>
//                 <div id="death-timer" style="font-size: 48px; font-weight: bold; color: #ffaa44;">5</div>
//             </div>
//             <div style="display: flex; gap: 20px; justify-content: center;">
//                 <button id="respawn-now" style="
//                     padding: 12px 24px;
//                     font-family: 'Orbitron', monospace;
//                     background: #44aa44;
//                     border: none;
//                     color: white;
//                     cursor: pointer;
//                     border-radius: 4px;
//                     font-weight: bold;
//                 ">⚡ RESPAWN NOW</button>
//                 <button id="spectate-mode" style="
//                     padding: 12px 24px;
//                     font-family: 'Orbitron', monospace;
//                     background: #444;
//                     border: none;
//                     color: white;
//                     cursor: pointer;
//                     border-radius: 4px;
//                 ">👁️ SPECTATE</button>
//             </div>
//         </div>
//     `;

//   document.body.appendChild(overlay);

//   if (!document.querySelector("#death-animation-style")) {
//     const style = document.createElement("style");
//     style.id = "death-animation-style";
//     style.textContent = `
//             @keyframes deathFade {
//                 from { opacity: 0; transform: scale(1.1); }
//                 to { opacity: 1; transform: scale(1); }
//             }
//             @keyframes timerPulse {
//                 0%, 100% { opacity: 1; transform: scale(1); }
//                 50% { opacity: 0.7; transform: scale(1.05); }
//             }
//         `;
//     document.head.appendChild(style);
//   }

//   let remaining = 5;
//   const timerEl = overlay.querySelector("#death-timer");

//   respawnCountdownInterval = setInterval(() => {
//     remaining--;
//     if (timerEl) {
//       timerEl.textContent = remaining;
//       timerEl.style.animation = "timerPulse 0.5s ease";
//       setTimeout(() => {
//         if (timerEl) timerEl.style.animation = "";
//       }, 500);
//     }

//     if (remaining <= 0) {
//       clearInterval(respawnCountdownInterval);
//       respawnCountdownInterval = null;
//       requestRespawn();
//     }
//   }, 1000);

//   const respawnBtn = overlay.querySelector("#respawn-now");
//   if (respawnBtn) {
//     respawnBtn.addEventListener("click", () => {
//       if (respawnCountdownInterval) {
//         clearInterval(respawnCountdownInterval);
//         respawnCountdownInterval = null;
//       }
//       requestRespawn();
//     });
//   }

//   const spectateBtn = overlay.querySelector("#spectate-mode");
//   if (spectateBtn) {
//     spectateBtn.addEventListener("click", () => {
//       console.log("Spectate mode - to be implemented");
//     });
//   }

//   // Add watch ad for revive button
//   const reviveAdBtn = document.createElement("button");
//   reviveAdBtn.textContent = "📺 WATCH AD TO RESPAWN";
//   reviveAdBtn.style.cssText = `
//         background: linear-gradient(135deg, #ffaa00, #ff6600);
//         border: none;
//         color: #000;
//         padding: 12px 24px;
//         border-radius: 8px;
//         cursor: pointer;
//         font-family: 'Orbitron', monospace;
//         font-weight: bold;
//         margin-top: 10px;
//         width: 100%;
//     `;
//   reviveAdBtn.onclick = async () => {
//     await adRewards.claimReward("revive");
//   };

//   // Add free rewards button
//   const rewardsBtn = document.createElement("button");
//   rewardsBtn.textContent = "🎁 FREE REWARDS";
//   rewardsBtn.style.cssText = `
//         background: linear-gradient(135deg, #9945FF, #14F195);
//         border: none;
//         color: white;
//         padding: 12px 24px;
//         border-radius: 8px;
//         cursor: pointer;
//         font-family: 'Orbitron', monospace;
//         font-weight: bold;
//         margin-top: 10px;
//         width: 100%;
//     `;
//   rewardsBtn.onclick = () => {
//     adRewardsUI.show();
//   };

//   // Add buttons to death screen
//   const buttonContainer = overlay.querySelector(".buttons-container");
//   if (buttonContainer) {
//     buttonContainer.appendChild(reviveAdBtn);
//     buttonContainer.appendChild(rewardsBtn);
//   }
// }

function showDeathScreen(killerName, weaponName, isHeadshot) {
  const existingOverlay = document.getElementById("death-overlay");
  if (existingOverlay) existingOverlay.remove();

  const overlay = document.createElement("div");
  overlay.id = "death-overlay";
  overlay.style.cssText = `
        position: fixed; inset: 0;
        background: linear-gradient(135deg, rgba(100, 0, 0, 0.85), rgba(0, 0, 0, 0.95));
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        z-index: 1015;
        font-family: 'Orbitron', monospace;
        animation: deathFade 0.5s ease-in;
    `;

  const headshotText = isHeadshot
    ? '<span style="color:#ff4444; font-weight:bold;">💀 HEADSHOT! 💀</span><br>'
    : "";

  overlay.innerHTML = `
        <div style="text-align: center; max-width: 500px; padding: 40px; background: rgba(0,0,0,0.8); border: 1px solid #ff4444; border-radius: 8px;">
            <h1 style="font-size: 64px; margin: 0; color: #ff4444; text-shadow: 0 0 20px rgba(255,0,0,0.5);">YOU DIED</h1>
            ${headshotText}
            <p style="font-size: 20px; margin: 16px 0; color: #ffaa44;">
                Killed by ${killerName || "Unknown"} ${
    weaponName ? `(${weaponName})` : ""
  }
            </p>
            <div style="margin: 30px 0;">
                <div style="font-size: 14px; color: #aaa; margin-bottom: 10px;">RESPAWNING IN</div>
                <div id="death-timer" style="font-size: 48px; font-weight: bold; color: #ffaa44;">5</div>
            </div>
            <div id="death-buttons" style="display: flex; flex-direction: column; gap: 10px; margin-top: 20px;">
                <button id="respawn-now" style="
                    padding: 12px 24px;
                    font-family: 'Orbitron', monospace;
                    background: #44aa44;
                    border: none;
                    color: white;
                    cursor: pointer;
                    border-radius: 4px;
                    font-weight: bold;
                ">⚡ RESPAWN NOW</button>
                <button id="watch-ad-revive" style="
                    background: linear-gradient(135deg, #ffaa00, #ff6600);
                    border: none;
                    color: #000;
                    padding: 12px 24px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-family: 'Orbitron', monospace;
                    font-weight: bold;
                ">📺 WATCH AD TO RESPAWN</button>
                <button id="free-rewards-btn" style="
                    background: linear-gradient(135deg, #9945FF, #14F195);
                    border: none;
                    color: white;
                    padding: 12px 24px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-family: 'Orbitron', monospace;
                    font-weight: bold;
                ">🎁 FREE REWARDS</button>
                <button id="spectate-mode" style="
                    padding: 12px 24px;
                    font-family: 'Orbitron', monospace;
                    background: #444;
                    border: none;
                    color: white;
                    cursor: pointer;
                    border-radius: 4px;
                ">👁️ SPECTATE</button>
            </div>
        </div>
    `;

  document.body.appendChild(overlay);

  // Add CSS animation if not exists
  if (!document.querySelector("#death-animation-style")) {
    const style = document.createElement("style");
    style.id = "death-animation-style";
    style.textContent = `
            @keyframes deathFade {
                from { opacity: 0; transform: scale(1.1); }
                to { opacity: 1; transform: scale(1); }
            }
            @keyframes timerPulse {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.7; transform: scale(1.05); }
            }
        `;
    document.head.appendChild(style);
  }

  let remaining = 5;
  const timerEl = overlay.querySelector("#death-timer");

  respawnCountdownInterval = setInterval(() => {
    remaining--;
    if (timerEl) {
      timerEl.textContent = remaining;
      timerEl.style.animation = "timerPulse 0.5s ease";
      setTimeout(() => {
        if (timerEl) timerEl.style.animation = "";
      }, 500);
    }

    if (remaining <= 0) {
      clearInterval(respawnCountdownInterval);
      respawnCountdownInterval = null;
      requestRespawn();
    }
  }, 1000);

  // Respawn button
  const respawnBtn = overlay.querySelector("#respawn-now");
  if (respawnBtn) {
    respawnBtn.addEventListener("click", () => {
      if (respawnCountdownInterval) {
        clearInterval(respawnCountdownInterval);
        respawnCountdownInterval = null;
      }
      requestRespawn();
    });
  }

  // Watch ad revive button
  const watchAdBtn = overlay.querySelector("#watch-ad-revive");
  if (watchAdBtn && window.adRewards) {
    watchAdBtn.addEventListener("click", async () => {
      if (respawnCountdownInterval) {
        clearInterval(respawnCountdownInterval);
        respawnCountdownInterval = null;
      }
      await window.adRewards.claimReward("revive");
    });
  }

  // Free rewards button
  const rewardsBtn = overlay.querySelector("#free-rewards-btn");
  if (rewardsBtn && window.adRewardsUI) {
    rewardsBtn.addEventListener("click", () => {
      window.adRewardsUI.show();
    });
  }

  const spectateBtn = overlay.querySelector("#spectate-mode");
  if (spectateBtn) {
    spectateBtn.addEventListener("click", () => {
      console.log("Spectate mode - to be implemented");
    });
  }
}

function hideDeathScreen() {
  const overlay = document.getElementById("death-overlay");
  if (overlay) overlay.remove();

  if (respawnCountdownInterval) {
    clearInterval(respawnCountdownInterval);
    respawnCountdownInterval = null;
  }
}

function requestRespawn() {
  if (isRespawning) {
    console.log("Already respawning, ignoring");
    return;
  }

  // ✅ Check if already alive
  if (self && !self.isDead) {
    console.log("Player is already alive, ignoring respawn request");
    return;
  }

  isRespawning = true;

  // Clear any existing countdown
  if (respawnCountdownInterval) {
    clearInterval(respawnCountdownInterval);
    respawnCountdownInterval = null;
  }

  if (world && world.controls) {
    world.controls.enabled = false;
  }

  // ✅ Show interstitial ad every 5th death
  deathCount++;
  if (deathCount % 5 === 0 && window.adManager) {
    window.adManager.showInterstitial(() => {
      // Continue with respawn after ad closes
      socket.emit("requestRespawn");
    });
  } else {
    socket.emit("requestRespawn");
  }
}

function showDamageNumber(damage, position, isHeadshot = false) {
  const damageDiv = document.createElement("div");
  damageDiv.className = "damage-number";
  if (isHeadshot) damageDiv.classList.add("headshot");
  if (damage >= 50) damageDiv.classList.add("critical");

  damageDiv.textContent = isHeadshot ? `💀 ${damage}` : `-${damage}`;

  // Convert world position to screen position
  if (world && world.camera) {
    const vector = new THREE.Vector3(position.x, position.y + 10, position.z);
    vector.project(world.camera);

    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;

    damageDiv.style.left = `${x - 20}px`;
    damageDiv.style.top = `${y - 20}px`;
  }

  document.body.appendChild(damageDiv);

  setTimeout(() => damageDiv.remove(), 800);
}

// Add kill feed entry
function addKillFeedEntry(killerName, victimName, weaponName, isHeadshot) {
  const feed = document.getElementById("kill-feed");
  if (!feed) {
    const newFeed = document.createElement("div");
    newFeed.id = "kill-feed";
    newFeed.style.cssText =
      "position: fixed; top: 70px; right: 10px; z-index: 50;";
    document.body.appendChild(newFeed);
  }

  const entry = document.createElement("div");
  entry.className = "kill-feed-entry";
  if (isHeadshot) entry.classList.add("headshot");

  entry.innerHTML = `
        <span style="color: #ffaa44;">${killerName}</span>
        <span style="color: #ff4444;"> ✦ </span>
        <span style="color: #ffffff;">${victimName}</span>
        <span style="color: #888; font-size: 10px; margin-left: 8px;">${weaponName}</span>
        ${
          isHeadshot
            ? '<span style="color: #ff8800; margin-left: 8px;">💀 HEADSHOT</span>'
            : ""
        }
    `;

  document.getElementById("kill-feed").appendChild(entry);

  setTimeout(() => entry.remove(), 5000);
}

// ──────────────────────────────────────────────────────────────────
// EVENT LISTENERS
// ──────────────────────────────────────────────────────────────────
window.addEventListener("weaponChanged", (e) => {
  if (mobileControls)
    mobileControls.updateWeaponIndicator(e.detail.current, e.detail.total);
});

window.addEventListener("wallet-ready", (event) => {
  if (socket && socket.connected) {
    socket.emit("walletConnected", {
      wallet: event.detail.address,
      userId: event.detail.user?.id  // ✅ Send Civic user ID
    });
  }
  if (self) {
    self.walletAddress = event.detail.address;
  }
  console.log("🎉 Wallet ready:", event.detail.address);

  // Show success notification
  if (feedbackSystem) {
    feedbackSystem.showNotification(
      `✅ Wallet connected: ${event.detail.address.slice(
        0,
        6,
      )}...${event.detail.address.slice(-4)}`,
      "#14F195",
    );
  }

  // Store for later use
  window.userWalletAddress = event.detail.address;

  if (socket && socket.connected) {
    socket.emit("walletConnected", { wallet: event.detail.address });
    console.log("✅ Wallet address sent to server:", event.detail.address);
  } else {
    console.log("⚠️ Socket not connected yet, waiting...");
    if (feedbackSystem) {
      feedbackSystem.showNotification(
        "Connecting to game server...",
        "#ffaa00",
      );
    }
    // Wait for socket connection
    const checkSocket = setInterval(() => {
      if (socket && socket.connected) {
        clearInterval(checkSocket);
        socket.emit("walletConnected", { wallet: event.detail.address });
        console.log(
          "✅ Wallet address sent after socket connect:",
          event.detail.address,
        );
        if (feedbackSystem) {
          feedbackSystem.showNotification(
            "✅ Wallet linked to game!",
            "#14F195",
          );
        }
      }
    }, 100);

    // Timeout fallback
    setTimeout(() => {
      clearInterval(checkSocket);
      if (socket && !socket.connected) {
        console.warn("⚠️ Socket never connected, wallet not sent");
        if (feedbackSystem) {
          feedbackSystem.showNotification(
            "⚠️ Game server not connected",
            "#ffaa00",
          );
        }
      }
    }, 5000);
  }

  if (self) {
    self.walletAddress = event.detail.address;
    self.solanaWallet = event.detail.address;
  }
});

document.addEventListener("keydown", (e) => {
  if (!window.isGameActive) return;

  // if (e.code === "KeyB" && self) {
  //   self.hitboxVisible = !self.hitboxVisible;
  //   self.enableHitboxVisualization(self.hitboxVisible);
  // }
  if (e.code === "KeyP" && window.storeUI) {
    window.storeUI.toggle();
  }
});

window._useInventoryItem = (itemId) => {
  if (socket) {
    socket.emit("useItem", { itemId });
  }
};

document.getElementById("txtMessage")?.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    sendMessage();
  }
});

document.getElementById("txtMessage")?.addEventListener("keydown", (e) => {
  if (e.key === "ArrowUp") {
    e.preventDefault();
    historyPrev();
  } else if (e.key === "ArrowDown") historyNext();
});

function attachStoreButtonEvents() {
  const plusBox = document.querySelector(".plus-box");
  if (!plusBox) {
    // If element doesn't exist yet, try again after a delay
    setTimeout(attachStoreButtonEvents, 500);
    return;
  }

  // Remove existing listeners to avoid duplicates
  const newPlusBox = plusBox.cloneNode(true);
  plusBox.parentNode.replaceChild(newPlusBox, plusBox);

  // Add click event for desktop
  newPlusBox.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if player is dead
    if (self && self.isDead) {
      if (feedbackSystem) {
        feedbackSystem.showNotification(
          "Can't open store while dead!",
          "#ffaa00",
        );
      }
      return;
    }

    if (!walletUI || !walletUI.isLoggedIn()) {
      if (feedbackSystem) {
        feedbackSystem.showNotification("Please sign in first!", "#ffaa00");
      }
      // Trigger login
      walletUI?.login();
      return;
    }

    if (window.storeUI) {
      window.storeUI.toggle();
    }
  });

  // Add touch event for mobile
  newPlusBox.addEventListener("touchstart", (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if player is dead
    if (self && self.isDead) {
      if (feedbackSystem) {
        feedbackSystem.showNotification(
          "Can't open store while dead!",
          "#ffaa00",
        );
      }
      return;
    }

    if (!walletUI || !walletUI.isLoggedIn()) {
      if (feedbackSystem) {
        feedbackSystem.showNotification("Please sign in first!", "#ffaa00");
      }
      walletUI?.login();
      return;
    }

    if (window.storeUI) {
      window.storeUI.toggle();
    }
  });

  console.log("✅ Store button events attached to .plus-box");
}

// Sync function for World.js
window.syncPlayerToServer = function () {
  if (!self) return;
  socket.emit("updatePlayer", {
    id: self.id,
    color: self.color,
    pos: self.threeObj.position,
    rotation: {
      x: self.pitchObj?.rotation.x || 0,
      y: self.threeObj.rotation.y,
    },
    weaponIndex: self.currentWeaponIndex,
    animation: self.currentAnimation,
    mapKey: selectedMapKey,
  });
};

window.addEventListener("beforeunload", () => {
  if (world) world.cleanup();
  if (self) self.cleanup();
});

const style = document.createElement("style");
style.textContent = `
  @keyframes slideIn {
    from { opacity: 0; transform: translateX(20px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes slideOut {
    from { opacity: 1; transform: translateX(0); }
    to { opacity: 0; transform: translateX(20px); }
  }
  @keyframes flashFade {
    from { opacity: 1; }
    to { opacity: 0; }
  }
  @keyframes damageFloat {
    0% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(-40px); }
  }
  @keyframes healthPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
    .plus-box {
        cursor: pointer !important;
        transition: all 0.2s ease !important;
        user-select: none !important;
        -webkit-tap-highlight-color: transparent !important;
    }
    
    .plus-box:active {
        transform: scale(0.95) !important;
        background: rgba(255, 170, 0, 0.3) !important;
    }
`;
document.head.appendChild(style);

// ── BOOT ──────────────────────────────────────────────────────────
initGame().catch(console.error);
