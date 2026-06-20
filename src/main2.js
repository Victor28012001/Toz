// // client/src/main.js (Capacitor compatible version)
// import io from "socket.io-client";
// import * as THREE from "three";
// import moment from "moment";
// import { Capacitor } from "@capacitor/core";
// import { App as CapacitorApp } from "@capacitor/app";
// import { ScreenOrientation } from "@capacitor/screen-orientation";
// import { StatusBar } from "@capacitor/status-bar";
// import { Preferences } from "@capacitor/preferences";
// // import Stats from "stats.js";
// import World from "./classes/World.js";
// import PlayerList from "./classes/PlayerList.js";
// import Player from "./classes/Player.js";
// import MessageList from "./classes/MessageList.js";
// import Message from "./classes/Message.js";
// import { Minimap } from "./classes/Minimap.js";
// import RoomManager from "./classes/RoomManager.js";
// import { MobileControls } from "./classes/mobileControls.js";
// import LoadoutUI from "./classes/loadoutUI.js";
// import { WEAPON_CONFIGS } from "./classes/constants.js";
// import VoiceChat from "./classes/VoiceChat.js";
// import { getWeaponSoundManager } from "./classes/WeaponSoundManager.js";
// import MapManager, { MAPS } from "./classes/MapManager.js";

// window.WEAPON_CONFIGS = WEAPON_CONFIGS;

// // Detect if running in Capacitor
// const isNative = Capacitor.isNativePlatform();
// const platform = Capacitor.getPlatform();

// // Add this function after imports
// // let stats = null;

// // function initStats() {
// //   stats = new Stats();
// //   stats.showPanel(0); // 0: fps, 1: ms, 2: memory, 3: loaded
// //   stats.dom.style.position = "fixed";
// //   stats.dom.style.top = "10px";
// //   stats.dom.style.left = "10px";
// //   stats.dom.style.zIndex = "10000";
// //   stats.dom.style.backgroundColor = "rgba(0,0,0,0.7)";
// //   stats.dom.style.padding = "5px";
// //   stats.dom.style.borderRadius = "5px";
// //   document.body.appendChild(stats.dom);

// //   function animate() {
// //     stats.begin();
// //     stats.end();
// //     requestAnimationFrame(animate);
// //   }
// //   requestAnimationFrame(animate);

// //   console.log("📊 FPS counter active");
// //   return stats;
// // }

// // Server connection management
// class ConnectionManager {
//   constructor() {
//     this.serverUrl = null;
//     this.socket = null;
//   }

//   async getServerUrl() {
//     // if (!isNative) {
//     //   // Web version - use same origin or localhost
//     //   return window.location.origin;
//     // }

//     // For development on REAL DEVICE - use your computer's IP
//     // REPLACE with your actual IP
//     return "https://serrulate-nonenviably-halina.ngrok-free.dev";
//   }

//   async connect() {
//     const serverUrl = await this.getServerUrl();
//     console.log("Connecting to server:", serverUrl);

//     this.socket = io(serverUrl, {
//       transports: ["websocket", "polling"],
//       reconnection: true,
//       reconnectionAttempts: 10,
//       reconnectionDelay: 1000,
//       timeout: 20000,
//       upgrade: true,
//       rememberUpgrade: true,
//     });

//     return this.socket;
//   }
// }

// // Initialize Capacitor plugins
// async function initCapacitor() {
//   if (!isNative) return;

//   try {
//     // Lock to landscape orientation
//     await ScreenOrientation.lock({ orientation: "landscape" });

//     // Hide status bar for fullscreen
//     await StatusBar.hide();

//     // Handle app state changes
//     await CapacitorApp.addListener("appStateChange", ({ isActive }) => {
//       if (isActive) {
//         console.log("App resumed");
//         if (world && world.setReducedPerformance) {
//           world.setReducedPerformance(false);
//         }
//         if (connectionManager.socket && !connectionManager.socket.connected) {
//           connectionManager.socket.connect();
//         }
//       } else {
//         console.log("App paused");
//         if (world && world.setReducedPerformance) {
//           world.setReducedPerformance(true);
//         }
//       }
//     });

//     // Handle back button
//     await CapacitorApp.addListener("backButton", () => {
//       if (confirm("Exit game?")) {
//         CapacitorApp.exitApp();
//       }
//     });
//   } catch (error) {
//     console.error("Capacitor init error:", error);
//   }
// }

// // Global variables
// let connectionManager;
// let socket;
// let world;
// let self;
// let roomManager;
// const players = new PlayerList();
// window.players = players;
// const messages = new MessageList();
// const messageHistory = new MessageList();
// let historyCurrent = -1;
// const speechRange = 300;
// let voiceChat = null;
// let crosshair3D = null;
// let loadoutUI = null;
// let pendingPlayerData = null;
// let pendingLoadoutWeapons = null;
// let minimap = null;
// let interactionPrompt = null;
// let mobileControls = null;
// let gameStarted = false;
// let lastUpdateTime = 0;
// let lastMinimapUpdate = 0;
// let lastInterpUpdate = 0;
// let frameCounter = 0;
// const IS_MOBILE_DEVICE = /Android|webOS|iPhone|iPad|iPod/i.test(
//   navigator.userAgent,
// );

// // To this (attach to window):
// window.footstepSounds = [];
// window.breathingSounds = [];
// window.footstepIndex = 0;
// window.footstepTimer = 0;
// window.breathTimer = 0;
// window.breathIndex = 0;
// window.wasRunning = false;
// window.breathInterval = 0.8;
// window.targetBreathInterval = 0.8;
// window.breathVolume = 0.05;
// window.targetBreathVolume = 0.05;

// function initSounds() {
//   // Footstep sounds
//   const footstepFiles = ["/assets/sounds/st1.mp3", "/assets/sounds/st2.mp3"];
//   footstepFiles.forEach((file) => {
//     const audio = new Audio(file);
//     audio.volume = 0.2;
//     window.footstepSounds.push(audio);
//   });

//   // Breathing sounds
//   const breathingFiles = [
//     "/assets/sounds/breathe-in.mp3",
//     "/assets/sounds/breathe-out.mp3",
//   ];
//   breathingFiles.forEach((file) => {
//     const audio = new Audio(file);
//     audio.volume = 0.05;
//     window.breathingSounds.push(audio);
//   });

//   // Unlock audio on first click
//   const unlockAudio = () => {
//     window.footstepSounds.forEach((s) => {
//       s.play()
//         .then(() => s.pause())
//         .catch(() => {});
//       s.currentTime = 0;
//     });
//     window.breathingSounds.forEach((s) => {
//       s.play()
//         .then(() => s.pause())
//         .catch(() => {});
//       s.currentTime = 0;
//     });
//     document.removeEventListener("click", unlockAudio);
//     document.removeEventListener("keydown", unlockAudio);
//   };

//   document.addEventListener("click", unlockAudio);
//   document.addEventListener("keydown", unlockAudio);
// }

// const isMobile = /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent);
// const UPDATE_INTERVAL = isMobile ? 100 : 50; // Send updates less frequently

// // Initialize the game
// async function initGame() {
//   // Initialize Capacitor first
//   await initCapacitor();

//   // Setup connection
//   connectionManager = new ConnectionManager();
//   socket = await connectionManager.connect();

//   // Make socket globally available
//   window.socket = socket;

//   // Setup all socket event handlers
//   setupSocketHandlers();

//   // Emit findMatch to start
//   socket.emit("findMatch");
// }

// function setupSocketHandlers() {
//   socket.on("matchJoined", ({ matchId }) => {
//     console.log("✅ Joined match:", matchId);
//     checkSession();
//   });

//   socket.on("showLoadout", (data) => {
//     console.log("✅ Show loadout event received for:", data.name);
//     window.pendingPlayerData = data;

//     const newPlayerDiv = document.getElementById("newPlayer");
//     if (newPlayerDiv) {
//       newPlayerDiv.style.display = "none";
//     }

//     showLoadoutSelection();
//   });

//   socket.on("checkSessionCallback", () => {
//     if (!world) {
//       world = new World();

//       // Add map selection button
//       const mapSelectBtn = document.createElement("button");
//       mapSelectBtn.textContent = "🗺️ Select Map";
//       mapSelectBtn.style.cssText = `
//             position: fixed;
//             bottom: 20px;
//             left: 20px;
//             z-index: 1000;
//             padding: 10px 20px;
//             background: #ffaa00;
//             color: #000;
//             border: none;
//             border-radius: 5px;
//             cursor: pointer;
//             font-weight: bold;
//             font-family: Arial, sans-serif;
//         `;
//       mapSelectBtn.onclick = () => {
//         if (world && world.mapManager) {
//           world.mapManager.showMapSelector();
//         }
//       };
//       document.body.appendChild(mapSelectBtn);

//       initSounds();
//       const weaponSoundManager = getWeaponSoundManager();
//       weaponSoundManager.init();

//       // Initialize FPS counter
//       //   if (!stats) {
//       //     initStats();
//       //   }
//     }

//     const testBtn = document.createElement("button");
//     testBtn.textContent = "Test Sound";
//     testBtn.style.cssText =
//       "position: fixed; bottom: 100px; right: 20px; z-index: 9999; padding: 10px; background: red; color: white;";
//     testBtn.onclick = () => {
//       const soundManager = getWeaponSoundManager();
//       soundManager.testReload();
//     };
//     document.body.appendChild(testBtn);

//     // Remove after 60 seconds
//     setTimeout(() => testBtn.remove(), 60000);

//     players.getAll().forEach((player) => {
//       if (player.mixer) {
//         world.addMixer(player.mixer);
//       }
//     });

//     const newPlayerDiv = document.getElementById("newPlayer");
//     if (newPlayerDiv) newPlayerDiv.style.display = "block";
//     const nameInput = document.getElementById("txtName");
//     if (nameInput) nameInput.focus();
//   });

//   socket.on("playerAnimation", (data) => {
//     const player = players.find(data.id);
//     if (player && player !== self) {
//       player.handleRemoteAnimation(data.animation);
//     }
//   });

//   socket.on("initSelf", (data) => {
//     console.log("✅ initSelf received");

//     if (!world) {
//       world = new World();
//     }

//     self = new Player(data.id, data.name, data.color, socket, world, data.pos);
//     window.self_player = self;

//     if (
//       window.pendingLoadoutWeapons &&
//       window.pendingLoadoutWeapons.length === 4
//     ) {
//       console.log(
//         "Applying loadout:",
//         window.pendingLoadoutWeapons.map((w) => w.name),
//       );
//       self.setLoadout(window.pendingLoadoutWeapons);
//       window.pendingLoadoutWeapons = null;
//     } else {
//       console.log("Loading default weapons");
//       self.loadDefaultWeapons();
//     }

//     players.add(self);
//     world.initControls(self);

//     // Check spawn point
//     if (window.spawnPoints && window.spawnPoints.length > 0) {
//       const currentPos = self.threeObj.position;
//       const matchingSpawn = window.spawnPoints.find(
//         (sp) =>
//           Math.abs(sp.x - currentPos.x) < 1 &&
//           Math.abs(sp.z - currentPos.z) < 1,
//       );
//       if (matchingSpawn) {
//         console.log(
//           `Player spawned at spawn point ${window.spawnPoints.indexOf(
//             matchingSpawn,
//           )}`,
//         );
//       }
//     }

//     // Initialize voice chat
//     voiceChat = new VoiceChat(socket, self);
//     window.voiceChat = voiceChat;

//     // Initialize mobile controls
//     if (world.controls) {
//       mobileControls = new MobileControls(world.controls);
//       mobileControls.init();
//       window.mobileControls = mobileControls;
//     }

//     // Initialize minimap
//     minimap = new Minimap(2000);
//     minimap.setPlayer(self);

//     // Add this line to ensure window.minimap is set:
//     window.minimap = minimap;

//     // Initialize roomManager
//     roomManager = new RoomManager(world, socket, self, minimap);
//     window.roomManager = roomManager;

//     roomManager.onInitRooms = (roomsData) => {
//       roomsData.forEach((roomData) => {
//         if (minimap) {
//           minimap.addRoom(roomData.id, {
//             position: new THREE.Vector3(
//               roomData.position.x,
//               roomData.position.y,
//               roomData.position.z,
//             ),
//             ammoBoxPosition: new THREE.Vector3(
//               roomData.ammoBoxPosition.x,
//               roomData.ammoBoxPosition.y,
//               roomData.ammoBoxPosition.z,
//             ),
//             vaccineBoxPosition: new THREE.Vector3(
//               roomData.vaccineBoxPosition.x,
//               roomData.vaccineBoxPosition.y,
//               roomData.vaccineBoxPosition.z,
//             ),
//             name: roomData.name,
//             ammoBoxOpen: false,
//             vaccineBoxOpen: false,
//             timeRemaining: 0,
//           });
//         }
//       });
//     };

//     roomManager.onRoomActivated = (data, room) => {
//       console.log("main.js onRoomActivated:", data.roomId, data.name);

//       if (minimap) {
//         minimap.rooms.forEach((r, id) => {
//           minimap.updateRoomStatus(
//             id,
//             id === data.roomId ? "active" : "inactive",
//           );
//         });
//         minimap.showTarget(data.roomId);
//       }

//       const roomStatusIndicator = document.getElementById("room-status");
//       if (roomStatusIndicator) {
//         roomStatusIndicator.style.display = "block";
//         roomStatusIndicator.style.borderLeftColor = "#ffaa00";
//         const timeRemaining = Math.max(
//           0,
//           Math.ceil((data.expiresAt - Date.now()) / 1000),
//         );
//         roomStatusIndicator.innerHTML = `
//                     <strong style="color:#ffaa00; font-size: 16px;">🔔 ACTIVE ROOM</strong><br>
//                     <span style="color:#ffffff; font-size: 13px;">${data.name}</span><br>
//                     <span style="color:#ffff00">⏱️ ${timeRemaining}s remaining</span>
//                 `;
//       }
//     };

//     roomManager.onRoomStatus = (data) => {
//       const roomStatusIndicator = document.getElementById("room-status");
//       if (roomStatusIndicator) {
//         if (data.timeRemaining > 0) {
//           roomStatusIndicator.style.display = "block";
//           roomStatusIndicator.innerHTML = `
//                         <strong style="color:#ffaa00; font-size: 16px;">🔔 ACTIVE ROOM</strong><br>
//                         <span style="color:#ffff00">⏱️ ${Math.ceil(
//                           data.timeRemaining / 1000,
//                         )}s </span>
//                         <span style="color:#00ff00">📦 Ammo: ${
//                           data.ammoBoxOpen ? "✓" : "✗"
//                         } (${data.ammoCollectedCount}) </span>
//                         <span style="color:#ffff00">💉 Vaccine: ${
//                           data.vaccineBoxOpen ? "✓" : "✗"
//                         } (${data.vaccineCollectedCount})</span>
//                     `;
//         } else {
//           roomStatusIndicator.style.display = "none";
//         }
//       }
//     };

//     startGame();
//   });

//   //   socket.on("spawnPoints", (spawnPositions) => {
//   //     window.spawnPoints = spawnPositions;
//   //     if (world && !world.spawnPointsRequested) {
//   //       world.createBoxesAtSpawnPoints(spawnPositions);
//   //     }
//   //   });

//   socket.on("spawnPoints", (spawnPositions) => {
//     window.spawnPoints = spawnPositions;

//     // Only create boxes if current map needs them
//     if (world && !world.spawnPointsRequested) {
//       // Check if current map has spawn boxes enabled
//       const currentMapConfig = world.mapManager?.currentMapConfig;
//       if (currentMapConfig && currentMapConfig.hasSpawnBoxes) {
//         world.createBoxesAtSpawnPoints(spawnPositions);
//       } else {
//         console.log("Spawn boxes disabled for current map, skipping creation");
//         // Still mark as requested to prevent future requests
//         world.spawnPointsRequested = true;
//       }
//     }
//   });

//   socket.on("checkSession", (cookieId) => {
//     if (cookieId.length !== 0) {
//       const player = players.find(cookieId);
//       if (player !== null) {
//         socket.data.player = player;
//         if (player.loadout && player.loadout.length > 0) {
//           socket.emit("initSelf", player.clientFormat());
//         } else {
//           socket.emit("showLoadout", player.clientFormat());
//         }
//       }
//     }
//   });

//   socket.on("initOthersCallback", (data) => {
//     console.log("initOthersCallback received with", data.length, "players");
//     for (const playerData of data) {
//       const existingPlayer = players.find(playerData.id);
//       if (existingPlayer) continue;

//       const newPlayer = new Player(
//         playerData.id,
//         playerData.name,
//         playerData.color,
//         null,
//         world,
//         playerData.pos,
//       );
//       if (playerData.weaponIndex !== undefined)
//         newPlayer.currentWeaponIndex = playerData.weaponIndex;
//       if (playerData.loadout && playerData.loadout.length > 0)
//         newPlayer.setLoadoutFromServer(playerData.loadout);

//       players.add(newPlayer);
//       world.addObject(newPlayer.getThreeObj());
//       if (minimap) minimap.addPlayer(playerData.id, newPlayer);

//       newPlayer.ensureWeaponsReady().then(() => {
//         const checkModelInterval = setInterval(() => {
//           if (newPlayer.modelLoaded) {
//             clearInterval(checkModelInterval);
//             newPlayer.attachCurrentWeapon();
//           }
//         }, 100);
//       });
//     }
//   });

//   socket.on("newPlayer", (data) => {
//     const existingPlayer = players.find(data.id);
//     if (existingPlayer) return;

//     if (world !== undefined) {
//       const newPlayer = new Player(
//         data.id,
//         data.name,
//         data.color,
//         null,
//         world,
//         data.pos,
//       );
//       if (data.weaponIndex !== undefined)
//         newPlayer.currentWeaponIndex = data.weaponIndex;
//       if (data.loadout && data.loadout.length > 0)
//         newPlayer.setLoadoutFromServer(data.loadout);

//       players.add(newPlayer);
//       world.addObject(newPlayer.getThreeObj());
//       if (minimap) minimap.addPlayer(data.id, newPlayer);

//       newPlayer.ensureWeaponsReady().then(() => {
//         const checkModelInterval = setInterval(() => {
//           if (newPlayer.modelLoaded) {
//             clearInterval(checkModelInterval);
//             newPlayer.attachCurrentWeapon();
//           }
//         }, 100);
//       });

//       const newMessage = new Message(
//         `${data.name} joined the game`,
//         { name: "Server" },
//         Date.now(),
//       );
//       addMessage(newMessage);
//     }
//   });

//   socket.on("updatePlayer", (data) => {
//     const player = players.find(data.id);
//     if (player !== null) {
//       const previousWeaponIndex = player.currentWeaponIndex;
//       player.setTargetPos(data.pos);
//       player.setTargetRotation(data.rotation);
//       if (data.animation && player !== self)
//         player.handleRemoteAnimation(data.animation);

//       if (
//         data.weaponIndex !== undefined &&
//         data.weaponIndex !== previousWeaponIndex &&
//         player !== self
//       ) {
//         player.currentWeaponIndex = data.weaponIndex;
//         player.ensureWeaponsReady().then(() => {
//           setTimeout(() => player.attachCurrentWeapon(), 50);
//         });
//       }

//       const distance = world.getDistanceTo(player.getThreeObj());
//       if (player.nameLabel) player.nameLabel.show = distance <= speechRange;
//     }
//   });

//   socket.on("updatePlayerName", (data) => {
//     const player = players.find(data.id);
//     if (player !== null) {
//       const oldName = player.name;
//       player.name = data.name;

//       // Update the existing CSS2D label instead of creating a new one
//       if (player.nameLabel && player.nameLabel.element) {
//         player.nameLabel.element.textContent = data.name;
//       }
//       const newMessage = new Message(
//         `${oldName} changed name to ${player.name}`,
//         { name: "Server" },
//         Date.now(),
//       );
//       addMessage(newMessage);
//     }
//   });

//   socket.on("removePlayer", (data) => {
//     const player = players.find(data.id);
//     if (player !== null) {
//       if (player.nameLabel) {
//         if (player.nameLabel.parent) {
//           player.nameLabel.parent.remove(player.nameLabel);
//         }
//         player.nameLabel = null;
//       }
//       if (player.nameLabelObj && player.nameLabelObj.parent) {
//         player.nameLabelObj.parent.remove(player.nameLabelObj);
//         player.nameLabelObj = null;
//       }
//       players.remove(player);
//       world.removeObject(player.getThreeObj());
//       if (minimap) minimap.removePlayer(data.id);
//     }
//   });

//   socket.on("playerLoadout", (data) => {
//     const player = players.find(data.id);
//     if (player && player !== self) {
//       const weaponConfigs = data.weapons
//         .map((weaponName) => {
//           const found = Object.entries(WEAPON_CONFIGS).find(
//             ([key, config]) => config.name === weaponName,
//           );
//           return found ? found[1] : null;
//         })
//         .filter((w) => w);
//       if (weaponConfigs.length === 4) player.setLoadout(weaponConfigs);
//     }
//   });

//   socket.on("playerWeaponSwitch", (data) => {
//     const player = players.find(data.id);
//     if (player && player !== self)
//       player.handleRemoteWeaponSwitch(data.weaponIndex);
//   });

//   socket.on("playerReload", (data) => {
//     const player = players.find(data.id);
//     if (player && player !== self) player.playAnimation("reloading", false);
//   });

//   socket.on("playerHit", (data) => {
//     if (data.shooterId === self?.id) showHitMarker();
//     const targetPlayer = players.find(data.targetId);
//     if (targetPlayer && world) {
//       const pos = targetPlayer.getThreeObj().position.clone();
//       pos.y += 12;
//       showHitEffect(pos);
//       if (targetPlayer === self) {
//         self.takeDamage(data.damage);
//         self.updateHealthUI();
//       }
//     }
//   });

//   socket.on("playerDied", (data) => {
//     const player = players.find(data.playerId);
//     if (!player) return;
//     if (player === self) {
//       self.die(data.killerId);
//       return;
//     }
//     player.playAnimation("dying", false, false);
//     player.isDead = true;
//     const killerPlayer = players.find(data.killerId);
//     const killerName = killerPlayer?.name || "Unknown";
//     const newMessage = new Message(
//       `💀 ${killerName} eliminated ${player.name}`,
//       { name: "Server" },
//       Date.now(),
//     );
//     addMessage(newMessage);
//     setTimeout(() => {
//       if (player.nameLabel) player.nameLabel.remove();
//       players.remove(player);
//       if (world) world.removeObject(player.getThreeObj());
//       if (minimap) minimap.removePlayer(data.playerId);
//     }, 3000);
//   });

//   socket.on("newMessage", (data) => {
//     let sender = players.find(data.sender.id) ?? data.sender;
//     if (sender !== self && sender instanceof Player) {
//       const distance = world.getDistanceTo(sender.getThreeObj());
//       //   if (distance <= speechRange) {
//       //     const prevLabel = LabelPlugin.find(sender.getSpeechObj());
//       //     if (prevLabel) prevLabel.remove();
//       //     new Label(
//       //       sender.getSpeechObj(),
//       //       data.text,
//       //       "speechBubble",
//       //       "left",
//       //       3 + data.text.length * 0.05,
//       //     );
//       //   }
//     }
//     const newMessage = new Message(data.text, sender, data.date);
//     messages.add(newMessage);
//     addMessage(newMessage);
//   });

//   socket.on("serverResponse", (data) => {
//     addServerResponse(data);
//   });
// }

// // Helper functions (keep all your existing helper functions)
// function trim(str) {
//   return str.trim();
// }
// function checkSession() {
//   socket.emit("checkSession", "");
// }
// function initNewSession() {
//   const name = document.getElementById("txtName").value;
//   socket.emit("initNewSession", name);
// }

// function updateSelf() {
//   const now = Date.now();
//   if (now - lastUpdateTime < UPDATE_INTERVAL) {
//     setTimeout(updateSelf, UPDATE_INTERVAL - (now - lastUpdateTime));
//     return;
//   }
//   lastUpdateTime = now;
//   if (self) {
//     const format = {
//       id: self.id,
//       color: self.color,
//       pos: self.threeObj.position,
//       rotation: {
//         x: self.pitchObj ? self.pitchObj.rotation.x : 0,
//         y: self.threeObj.rotation.y,
//       },
//       weaponIndex: self.currentWeaponIndex,
//       animation: self.currentAnimation,
//     };
//     socket.emit("updatePlayer", format);
//     if (minimap) {
//       if (!minimap.player) minimap.player = {};
//       minimap.player.position = self.threeObj.position;
//       minimap.player.rotation = { y: self.threeObj.rotation.y };
//       minimap.player.name = self.name;
//     }
//     if (self.weapons && self.weapons.length > 0) {
//       const w = self.weapons[self.currentWeaponIndex];
//       const nameEl = document.getElementById("ammo-weapon-name");
//       const currEl = document.getElementById("ammo-current");
//       const maxEl = document.getElementById("ammo-max");
//       const resEl = document.getElementById("ammo-reserves");
//       if (w) {
//         if (nameEl) nameEl.textContent = w.name;
//         if (currEl) currEl.textContent = w.ammo;
//         if (maxEl) maxEl.textContent = w.maxAmmo;
//         if (resEl) {
//           const res = self.weaponReserves?.[w.name] ?? 0;
//           resEl.textContent = res > 0 ? `×${res}` : "EMPTY";
//           resEl.style.color = res > 0 ? "#ffcc00" : "#ff4444";
//         }
//       }
//     }
//   }
//   setTimeout(updateSelf, 20);
// }

// function sendMessage() {
//   const input = document.getElementById("txtMessage");
//   const message = trim(input.value.replace(/(\r\n|\n|\r)/gm, ""));
//   if (message.length > 0) {
//     socket.emit("sendMessage", message);
//     input.value = "";
//     messageHistory.add(new Message(message, self, Date.now()));
//     historyCurrent = messageHistory.getAll().length;
//   }
// }

// function addMessage(message) {
//   const className = message.sender.name === "Server" ? "server" : "";
//   const html = `<tr class="${className}"><td class="timestamp">${moment(
//     message.date,
//   ).format("HH:mm")}</td><td><span class="userName">${
//     message.sender.name
//   }:</span> ${message.text.replace(/\n/g, "<br>")}<\/td><\/tr>`;

//   const messageList = document.getElementById("messageList");
//   const messagesInner = document.getElementById("messagesInner");

//   if (messageList) {
//     // Use insertAdjacentHTML instead of innerHTML += for better performance
//     messageList.insertAdjacentHTML("beforeend", html);
//   }

//   if (messagesInner) {
//     // Defer the scroll calculation to avoid a forced reflow
//     requestAnimationFrame(() => {
//       messagesInner.scrollTop = messagesInner.scrollHeight;
//     });
//   }
// }

// function addServerResponse(response) {
//   const html = `<tr><td colspan="2" class="${response.type}">${response.text}<\/td><\/tr>`;
//   const messageList = document.getElementById("messageList");
//   const messagesInner = document.getElementById("messagesInner");

//   if (messageList) {
//     messageList.insertAdjacentHTML("beforeend", html);
//   }

//   if (messagesInner) {
//     requestAnimationFrame(() => {
//       messagesInner.scrollTop = messagesInner.scrollHeight;
//     });
//   }
// }

// function historyPrev() {
//   const h = messageHistory.getAll();
//   if (historyCurrent > 0) {
//     const msg = h[--historyCurrent];
//     document.getElementById("txtMessage").value = msg ? msg.text : "";
//   }
// }

// function historyNext() {
//   const h = messageHistory.getAll();
//   if (historyCurrent < h.length - 1) {
//     const msg = h[++historyCurrent];
//     document.getElementById("txtMessage").value = msg ? msg.text : "";
//   }
// }

// function createRoomStatusIndicator() {
//   const indicator = document.createElement("div");
//   indicator.id = "room-status";
//   indicator.style.cssText = `position: fixed; top: 30px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.1); color: white; padding: 10px; font-family: Arial; font-size: 0.8rem; z-index: 999; border-left: 4px solid #888; display: none; text-align: center;`;
//   document.body.appendChild(indicator);
//   return indicator;
// }

// function updateInteractionPrompt() {
//   if (!interactionPrompt) return;
//   if (roomManager && roomManager.currentRoomId && roomManager.activeRoom) {
//     const room = roomManager.rooms.get(roomManager.currentRoomId);
//     if (room && room.isActive) {
//       interactionPrompt.style.display = "block";
//       if (!room.ammoBoxOpen || !room.vaccineBoxOpen) {
//         let available = [];
//         if (!room.ammoBoxOpen) available.push("Ammo");
//         if (!room.vaccineBoxOpen) available.push("Vaccine");
//         interactionPrompt.innerHTML = `🎁 Press E to open (${available.join(
//           " / ",
//         )})`;
//       } else {
//         interactionPrompt.innerHTML = "🎁 All boxes opened";
//         interactionPrompt.style.opacity = "0.5";
//       }
//     } else {
//       interactionPrompt.style.display = "none";
//     }
//   } else {
//     interactionPrompt.style.display = "none";
//   }
// }

// function showLoadoutSelection() {
//   window.socket = socket;
//   loadoutUI = new LoadoutUI((selectedWeapons) => {
//     pendingLoadoutWeapons = selectedWeapons;
//   });
// }

// function showHitMarker() {
//   if (world?.crosshair3D) world.crosshair3D.hitFeedback();
//   const marker = document.createElement("div");
//   marker.style.cssText = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 20px; height: 20px; border: 2px solid red; border-radius: 50%; pointer-events: none; z-index: 9999; animation: hitPulse 0.2s ease-out forwards;`;
//   document.body.appendChild(marker);
//   setTimeout(() => marker.remove(), 200);
// }

// function showHitEffect(position) {
//   if (!world?.scene) return;
//   const geo = new THREE.SphereGeometry(3, 8, 8);
//   const mat = new THREE.MeshBasicMaterial({
//     color: 0xff0000,
//     transparent: true,
//     opacity: 0.7,
//   });
//   const effect = new THREE.Mesh(geo, mat);
//   effect.position.copy(position);
//   world.scene.add(effect);
//   setTimeout(() => {
//     world.scene.remove(effect);
//     geo.dispose();
//     mat.dispose();
//   }, 150);
// }

// function createHealthBar() {
//   const bar = document.createElement("div");
//   bar.id = "health-bar";
//   bar.style.cssText = `position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); width: 200px; background: rgba(0,0,0,0.6); border-radius: 8px; padding: 6px 10px; z-index: 1000; font-family: Arial;`;
//   bar.innerHTML = `<div style="display: flex; align-items: center; gap: 8px;"><span style="color: #ff4444; font-size: 16px;">♥</span><div style="flex: 1; background: rgba(255,255,255,0.15); border-radius: 4px; height: 10px; overflow: hidden;"><div id="health-fill" style="height: 100%; width: 100%; background: #00cc44; transition: width 0.3s, background 0.3s; border-radius: 4px;"></div></div><span id="health-text" style="color: white; font-size: 13px; min-width: 28px; text-align: right;">100</span></div>`;
//   document.body.appendChild(bar);
// }

// function startGame() {
//   if (gameStarted) return;
//   gameStarted = true;

//   const newPlayerDiv = document.getElementById("newPlayer");
//   const startGameDiv = document.getElementById("startGame");
//   const chatDiv = document.getElementById("chat");

//   if (newPlayerDiv) newPlayerDiv.style.display = "none";
//   if (startGameDiv) startGameDiv.style.display = "block";
//   if (chatDiv) chatDiv.style.display = "block";

//   const isMobile =
//     /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
//       navigator.userAgent,
//     );
//   if (isMobile || isNative) {
//     document.getElementById("btnStart")?.click();
//   } else {
//     document.getElementById("btnStart")?.focus();
//   }

//   socket.emit("initOthers", "");
//   updateSelf();
//   createHealthBar();
//   createAmmoHUD();
//   window.roomManager = roomManager;
// }

// function createAmmoHUD() {
//   const hud = document.createElement("div");
//   hud.id = "ammo-hud";
//   hud.style.cssText = `position: fixed; bottom: 20px; right: 20px; background: rgba(0,0,0,0.6); border-radius: 8px; padding: 8px 16px; z-index: 1000; font-family: 'Courier New', monospace; color: white; display: flex; align-items: center; gap: 8px; border: 1px solid rgba(255,255,255,0.15);`;
//   hud.innerHTML = `<span style="color:#aaa;font-size:12px" id="ammo-weapon-name">—</span><span style="font-size:22px;font-weight:bold" id="ammo-current">—</span><span style="color:#666;font-size:16px">/</span><span style="color:#888;font-size:16px" id="ammo-max">—</span><span style="font-size:13px;min-width:36px;text-align:right" id="ammo-reserves"></span>`;
//   document.body.appendChild(hud);
// }

// // Event listeners
// window.addEventListener("weaponChanged", (e) => {
//   if (mobileControls)
//     mobileControls.updateWeaponIndicator(e.detail.current, e.detail.total);
// });

// document.addEventListener("keydown", (e) => {
//   if (e.code === "KeyB" && self) {
//     if (!self.hitboxVisible) {
//       self.enableHitboxVisualization(true);
//       self.hitboxVisible = true;
//     } else {
//       self.enableHitboxVisualization(false);
//       self.hitboxVisible = false;
//     }
//   }
// });

// // Add this anywhere after world is defined
// document.addEventListener("keydown", (e) => {
//   if (e.code === "KeyM" && world && world.mapManager) {
//     world.mapManager.showMapSelector();
//   }
// });

// document
//   .getElementById("btnSendName")
//   ?.addEventListener("click", initNewSession);
// document.getElementById("txtName")?.addEventListener("keypress", (e) => {
//   if (e.key === "Enter") {
//     e.preventDefault();
//     initNewSession();
//   }
// });
// document.getElementById("txtMessage")?.addEventListener("keypress", (e) => {
//   if (e.key === "Enter") {
//     e.preventDefault();
//     sendMessage();
//   }
// });
// document.getElementById("txtMessage")?.addEventListener("keydown", (e) => {
//   switch (e.key) {
//     case "ArrowUp":
//       e.preventDefault();
//       historyPrev();
//       break;
//     case "ArrowDown":
//       historyNext();
//       break;
//   }
// });

// const roomStatusIndicator = createRoomStatusIndicator();

// window.players = players;
// window.roomManager = roomManager;
// window.mobileControls = mobileControls;
// window.self_player = self;
// window.updateInteractionPrompt = updateInteractionPrompt;

// // Sync function for World.js to call
// window.syncPlayerToServer = function () {
//   if (!self) return;
//   socket.emit("updatePlayer", {
//     id: self.id,
//     color: self.color,
//     pos: self.threeObj.position,
//     rotation: {
//       x: self.pitchObj ? self.pitchObj.rotation.x : 0,
//       y: self.threeObj.rotation.y,
//     },
//     weaponIndex: self.currentWeaponIndex,
//     animation: self.currentAnimation,
//   });
// };

// window.addEventListener("beforeunload", () => {
//   if (world) {
//     world.cleanup();
//   }
//   if (self) {
//     self.cleanup();
//   }
// });

// // Start the game
// initGame().catch(console.error);

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
import LoadoutUI from "./classes/loadoutUI.js";
import { WEAPON_CONFIGS } from "./classes/constants.js";
import VoiceChat from "./classes/VoiceChat.js";
import { getWeaponSoundManager } from "./classes/WeaponSoundManager.js";
import MapManager, { MAPS } from "./classes/MapManager.js";
import UIFlow from "./classes/UIFlow.js";
import LobbyUI from "./classes/LobbyUI.js";

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

  async getServerUrl() {
    return "https://serrulate-nonenviably-halina.ngrok-free.dev";
  }

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
// GLOBALS
// ──────────────────────────────────────────────────────────────────
let connectionManager, socket, world, self;
let roomManager, voiceChat, loadoutUI, minimap, mobileControls;
let pendingLoadoutWeapons = null;
let gameStarted = false;
let lastUpdateTime = 0;

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
  world = new World();
  window.world = world;
  initSounds();
  getWeaponSoundManager().init();

  connectionManager = new ConnectionManager();
  socket = await connectionManager.connect();
  window.socket = socket;

  setupSocketHandlers();

  // Show UI flow with socket reference for lobby listing
  new UIFlow(({ name, mapKey, lobbyId, isCreating, gameDuration }) => {
    window._pendingPlayerName = name;
    selectedMapKey = mapKey;

    if (isCreating) {
      // Create new lobby
      socket.emit("createLobby", { playerName: name, gameDuration });
    } else if (lobbyId) {
      // Join existing lobby
      socket.emit("joinLobby", { lobbyId, playerName: name });
    } else {
      // Fallback to direct match
      world.loadMapForSession(mapKey);
      socket.emit("findMatch", { mapKey });
      _showGameBlocker(name, mapKey);
    }
  }, socket);
}

// ──────────────────────────────────────────────────────────────────
// GAME BLOCKER (click to lock pointer)
// ──────────────────────────────────────────────────────────────────
function _showGameBlocker(playerName, mapKey = selectedMapKey) {
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
    lowpoly_environment: "Low Poly Valley",
  };

  const mapDisplayName = mapKey ? mapMeta[mapKey] || mapKey : "Unknown Zone";

  blocker.innerHTML = `
    <div id="instructions" style="text-align:center;max-width:420px;padding:40px;background:rgba(0,0,0,0.7);border:1px solid rgba(80,140,220,0.3);border-radius:4px;">
      <div id="newPlayer" style="margin-bottom:20px;">
        <div style="font-size:13px;letter-spacing:0.3em;color:#4a7ab0;margin-bottom:8px;">OPERATOR</div>
        <div style="font-family:Orbitron,monospace;font-size:22px;font-weight:700;color:#e8f0ff;letter-spacing:0.12em;margin-bottom:4px;">${playerName}</div>
        <div style="font-size:11px;color:#4a6a9a;letter-spacing:0.15em;">ZONE: ${mapDisplayName.toUpperCase()}</div>
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

// ──────────────────────────────────────────────────────────────────
// SOCKET HANDLERS
// ──────────────────────────────────────────────────────────────────
function setupSocketHandlers() {
  // Server acknowledges match — now show 3D lobby
  socket.on("matchJoined", ({ matchId }) => {
    console.log("✅ Joined match:", matchId, "map:", selectedMapKey);

    // Hide the blocker
    const blocker = document.getElementById("blocker");
    if (blocker) blocker.style.display = "none";

    // For direct matchmaking (no lobby), just show loadout selection
    // The server will emit showLoadout after initNewSession is called
    // But we need to call initNewSession first
    const name = window._pendingPlayerName || "Operator";
    socket.emit("initNewSession", name);
  });

  // Also add these socket handlers
  socket.on("lobbyCreated", (data) => {
    console.log("Lobby created:", data);
    const lobbyUI = new LobbyUI(socket, (gameData) => {
      console.log("🎮 Game starting from lobby:", gameData);
    });
    lobbyUI.showLoadoutUI({
      ...data,
      name: window._pendingPlayerName,
      lobbyId: data.lobbyId,
    });
  });

  socket.on("lobbyJoined", (data) => {
    console.log("Lobby joined:", data);
    const lobbyUI = new LobbyUI(socket, (gameData) => {
      console.log("🎮 Game starting from lobby:", gameData);
    });
    lobbyUI.showLoadoutUI({
      ...data,
      name: window._pendingPlayerName,
      lobbyId: data.lobbyId,
    });
  });

  socket.on("showLoadout", (data) => {
    console.log("✅ Show loadout event received for:", data.name);
    window.pendingPlayerData = data;

    // ✅ If weapons were already selected in the lobby, skip the LoadoutUI
    // and auto-confirm using the lobby loadout
    if (window.pendingLoadoutWeapons?.length > 0) {
      console.log("🎮 Using lobby loadout, skipping LoadoutUI");
      const weaponNames = window.pendingLoadoutWeapons.map((w) =>
        typeof w === "string" ? w : w.name,
      );
      socket.emit("confirmLoadout", { weapons: weaponNames });
      return;
    }

    // Only show the LoadoutUI for direct matchmaking (no lobby)
    const newPlayerDiv = document.getElementById("newPlayer");
    if (newPlayerDiv) newPlayerDiv.style.display = "none";
    showLoadoutSelection();
  });

  socket.on("transitionToMatch", (data) => {
    console.log("🎮 Transitioning to match", data);

    const lobbyRoot = document.getElementById("lobby-3d-root");
    if (lobbyRoot) lobbyRoot.remove();

    if (data?.matchId) window._currentMatchId = data.matchId;

    const mapToLoad = data?.mapKey || selectedMapKey || "shooting_range";
    selectedMapKey = mapToLoad;
    world.loadMapForSession(selectedMapKey);

    // ✅ Show the blocker while we wait for the server's showLoadout
    _showGameBlocker(window._pendingPlayerName || "Operator", selectedMapKey);

    // ✅ REMOVED: do NOT emit initNewSession here.
    // The server now emits showLoadout automatically after startGame.
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

    // ✅ Handle both lobby loadout (strings) and direct loadout (config objects)
    const pending = window.pendingLoadoutWeapons;
    if (pending?.length > 0) {
      if (typeof pending[0] === "string") {
        // Came from lobby — resolve names to configs
        const configs = pending
          .map((name) => {
            const entry = Object.entries(WEAPON_CONFIGS).find(
              ([, cfg]) => cfg.name === name,
            );
            return entry ? entry[1] : null;
          })
          .filter(Boolean);
        if (configs.length === 4) self.setLoadout(configs);
        else self.loadDefaultWeapons();
      } else {
        // Came from LoadoutUI — already config objects
        self.setLoadout(pending);
      }
      window.pendingLoadoutWeapons = null;
    } else {
      self.loadDefaultWeapons();
    }

    players.add(self);
    world.initControls(self);

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
      // ── KEY: only show players on the same map ─────────────────
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
      if (playerData.loadout?.length > 0)
        newPlayer.setLoadoutFromServer(playerData.loadout);
      players.add(newPlayer);
      world.addObject(newPlayer.getThreeObj());
      if (minimap) minimap.addPlayer(playerData.id, newPlayer);
      newPlayer.ensureWeaponsReady().then(() => {
        const checkInterval = setInterval(() => {
          if (newPlayer.modelLoaded) {
            clearInterval(checkInterval);
            newPlayer.attachCurrentWeapon();
          }
        }, 100);
      });
    }
  });

  socket.on("newPlayer", (data) => {
    // ── KEY: only show players on the same map ─────────────────────
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
    if (data.loadout?.length > 0) newPlayer.setLoadoutFromServer(data.loadout);
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
      if (weaponConfigs.length === 4) player.setLoadout(weaponConfigs);
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
    if (data.shooterId === self?.id) showHitMarker();
    const targetPlayer = players.find(data.targetId);
    if (targetPlayer && world) {
      const pos = targetPlayer.getThreeObj().position.clone();
      pos.y += 12;
      showHitEffect(pos);
      if (targetPlayer === self) {
        self.takeDamage(data.damage);
        self.updateHealthUI();
      }
    }
  });

  socket.on("playerDied", (data) => {
    const player = players.find(data.playerId);
    if (!player) return;
    if (player === self) {
      self.die(data.killerId);
      return;
    }
    player.playAnimation("dying", false, false);
    player.isDead = true;
    const killer = players.find(data.killerId);
    addMessage(
      new Message(
        `💀 ${killer?.name || "Unknown"} eliminated ${player.name}`,
        { name: "Server" },
        Date.now(),
      ),
    );
    setTimeout(() => {
      if (player.nameLabel?.parent)
        player.nameLabel.parent.remove(player.nameLabel);
      players.remove(player);
      if (world) world.removeObject(player.getThreeObj());
      if (minimap) minimap.removePlayer(data.playerId);
    }, 3000);
  });

  socket.on("newMessage", (data) => {
    const sender = players.find(data.sender.id) ?? data.sender;
    addMessage(new Message(data.text, sender, data.date));
  });

  socket.on("serverResponse", (data) => addServerResponse(data));
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

  const blocker = document.getElementById("blocker");
  const newPlayerDiv = document.getElementById("newPlayer");
  const startGameDiv = document.getElementById("startGame");
  const chatDiv = document.getElementById("chat");

  if (newPlayerDiv) newPlayerDiv.style.display = "none";
  if (startGameDiv) startGameDiv.style.display = "block";
  if (chatDiv) chatDiv.style.display = "block";

  if (isMobile || isNative) {
    document.getElementById("btnStart")?.click();
  } else {
    document.getElementById("btnStart")?.focus();
  }

  socket.emit("initOthers", "");
  updateSelf();
  createHealthBar();
  createAmmoHUD();
  if (MAPS[selectedMapKey]?.hasRooms) createRoomStatusIndicator();
  window.roomManager = roomManager;
  window.updateInteractionPrompt = updateInteractionPrompt;
}

// ──────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────
function showLoadoutSelection() {
  window.socket = socket;
  loadoutUI = new LoadoutUI((selectedWeapons) => {
    pendingLoadoutWeapons = selectedWeapons;
    window.pendingLoadoutWeapons = selectedWeapons;
    socket.emit("confirmLoadout", {
      weapons: selectedWeapons.map((w) => w.name),
    });
  });
}

function trim(str) {
  return str.trim();
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
      if (w) {
        const nameEl = document.getElementById("ammo-weapon-name");
        const currEl = document.getElementById("ammo-current");
        const maxEl = document.getElementById("ammo-max");
        const resEl = document.getElementById("ammo-reserves");
        if (nameEl) nameEl.textContent = w.name;
        if (currEl) currEl.textContent = w.ammo;
        if (maxEl) maxEl.textContent = w.maxAmmo;
        if (resEl) {
          const res = self.weaponReserves?.[w.name] ?? 0;
          resEl.textContent = res > 0 ? `×${res}` : "EMPTY";
          resEl.style.color = res > 0 ? "#ffcc00" : "#ff4444";
        }
      }
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
  const indicator = document.createElement("div");
  indicator.id = "room-status";
  indicator.style.cssText =
    "position:fixed;top:30px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.1);color:white;padding:10px;font-family:Arial;font-size:0.8rem;z-index:9;border-left:4px solid #888;display:none;text-align:center;";
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

function createHealthBar() {
  if (document.getElementById("health-bar")) return;
  const bar = document.createElement("div");
  bar.id = "health-bar";
  bar.style.cssText =
    "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);width:200px;background:rgba(0,0,0,0.6);border-radius:8px;padding:6px 10px;z-index:1000;font-family:Arial;";
  bar.innerHTML = `<div style="display:flex;align-items:center;gap:8px;"><span style="color:#ff4444;font-size:16px;">♥</span><div style="flex:1;background:rgba(255,255,255,0.15);border-radius:4px;height:10px;overflow:hidden;"><div id="health-fill" style="height:100%;width:100%;background:#00cc44;transition:width 0.3s,background 0.3s;border-radius:4px;"></div></div><span id="health-text" style="color:white;font-size:13px;min-width:28px;text-align:right;">100</span></div>`;
  document.body.appendChild(bar);
}

function createAmmoHUD() {
  if (document.getElementById("ammo-hud")) return;
  const hud = document.createElement("div");
  hud.id = "ammo-hud";
  hud.style.cssText =
    "position:fixed;bottom:20px;right:20px;background:rgba(0,0,0,0.6);border-radius:8px;padding:8px 16px;z-index:1000;font-family:'Courier New',monospace;color:white;display:flex;align-items:center;gap:8px;border:1px solid rgba(255,255,255,0.15);";
  hud.innerHTML = `<span style="color:#aaa;font-size:12px" id="ammo-weapon-name">—</span><span style="font-size:22px;font-weight:bold" id="ammo-current">—</span><span style="color:#666;font-size:16px">/</span><span style="color:#888;font-size:16px" id="ammo-max">—</span><span style="font-size:13px;min-width:36px;text-align:right" id="ammo-reserves"></span>`;
  document.body.appendChild(hud);
}

// ──────────────────────────────────────────────────────────────────
// EVENT LISTENERS
// ──────────────────────────────────────────────────────────────────
window.addEventListener("weaponChanged", (e) => {
  if (mobileControls)
    mobileControls.updateWeaponIndicator(e.detail.current, e.detail.total);
});

document.addEventListener("keydown", (e) => {
  if (e.code === "KeyB" && self) {
    self.hitboxVisible = !self.hitboxVisible;
    self.enableHitboxVisualization(self.hitboxVisible);
  }
  // if (e.code === "KeyM" && world?.mapManager) world.mapManager.showMapSelector();
});

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

// ── BOOT ──────────────────────────────────────────────────────────
initGame().catch(console.error);
