// // import { io } from 'socket.io-client';
// import * as THREE from "three";
// import moment from "https://cdn.jsdelivr.net/npm/moment@2.29.4/+esm";
// import World from "./classes/World.js";
// import PlayerList from "./classes/PlayerList.js";
// import Player from "./classes/Player.js";
// import MessageList from "./classes/MessageList.js";
// import Message from "./classes/Message.js";
// import Label, { LabelPlugin } from "./classes/Label.js";
// import { Minimap } from "./classes/Minimap.js";
// import RoomManager from "./classes/RoomManager.js";
// import { MobileControls } from "./classes/mobileControls.js";
// import LoadoutUI from "./classes/loadoutUI.js";
// import { WEAPON_CONFIGS } from "./classes/constants.js";
// import VoiceChat from "./classes/VoiceChat.js";
// window.WEAPON_CONFIGS = WEAPON_CONFIGS;

// const socket = io();
// let world;
// let self;
// let roomManager;
// const players = new PlayerList();
// const messages = new MessageList();
// const messageHistory = new MessageList();
// let historyCurrent = -1;
// const speechRange = 300;

// let voiceChat = null;

// let crosshair3D = null;

// let loadoutUI = null;
// let pendingPlayerData = null;
// let pendingLoadoutWeapons = null;

// // Create minimap (will be properly initialized after self is created)
// let minimap = null;

// // Create interaction prompt (will be initialized after DOM is ready)
// let interactionPrompt = null;

// let mobileControls = null;

// let gameStarted = false;

// window.onload = () => {
//   const newPlayerDiv = document.getElementById("newPlayer");
//   const startGameDiv = document.getElementById("startGame");
//   const chatDiv = document.getElementById("chat");

//   // NEW: Handle showLoadout event
//   socket.on("showLoadout", (data) => {
//     console.log("✅ Show loadout event received for:", data.name);

//     // Store player data for later
//     window.pendingPlayerData = data;

//     // Hide name entry UI
//     const newPlayerDiv = document.getElementById("newPlayer");
//     if (newPlayerDiv) {
//       newPlayerDiv.style.display = "none";
//     }

//     // Show loadout UI
//     showLoadoutSelection();
//   });

//   socket.on("checkSessionCallback", () => {
//     // Only create world if it doesn't exist yet
//     if (!world) {
//       world = new World();
//     }

//     // Register any existing players' mixers
//     players.getAll().forEach((player) => {
//       if (player.mixer) {
//         world.addMixer(player.mixer);
//       }
//     });

//     newPlayerDiv.style.display = "block";
//     document.getElementById("txtName").focus();
//   });
//   socket.on("playerAnimation", (data) => {
//     const player = players.find(data.id);
//     if (player && player !== self) {
//       player.handleRemoteAnimation(data.animation);
//     }
//   });

//   socket.on("initSelf", (data) => {
//     console.log(
//       "✅ initSelf received, initializing player in world with loadout:",
//       window.pendingLoadoutWeapons,
//     );

//     // Make sure world exists
//     if (!world) {
//       world = new World();
//     }

//     // Create the actual player
//     self = new Player(data.id, data.name, data.color, socket, world, data.pos);

//     // Apply the selected loadout if available
//     if (
//       window.pendingLoadoutWeapons &&
//       window.pendingLoadoutWeapons.length === 4
//     ) {
//       console.log(
//         "Applying loadout to player:",
//         window.pendingLoadoutWeapons.map((w) => w.name),
//       );
//       self.setLoadout(window.pendingLoadoutWeapons);
//       // Clear the pending loadout
//       window.pendingLoadoutWeapons = null;
//     } else {
//       // Fallback - load default weapons
//       console.log("No loadout found, loading default weapons");
//       self.loadDefaultWeapons();
//     }

//     players.add(self);
//     world.initControls(self);

//     // document.addEventListener("keydown", (e) => {
//     //   if (e.code === "KeyC" && world && world.controls) {
//     //     world.controls.toggleCameraMode();
//     //   }
//     // });

//     document.addEventListener("keydown", (e) => {
//       if (e.code === "KeyC" && world && world.controls) {
//         // Toggle aim for keyboard testing
//         if (world.controls.isAiming) {
//           world.controls.stopAiming();
//         } else {
//           world.controls.startAiming();
//         }
//       }
//     });

//     // Initialize voice chat
//     voiceChat = new VoiceChat(socket, self);

//     // Make voiceChat available globally for UI updates
//     window.voiceChat = voiceChat;

//     // Initialize mobile controls
//     if (world.controls) {
//       mobileControls = new MobileControls(world.controls);
//       mobileControls.init();
//     }

//     // Initialize minimap after player is created
//     minimap = new Minimap(2000);
//     minimap.setPlayer(self);

//     // Initialize roomManager
//     roomManager = new RoomManager(world, socket, self, minimap);

//     // ✅ Minimap room init via callback — not a second socket listener
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

//     // ✅ Hook into roomManager for UI updates
//     roomManager.onRoomActivated = (data, room) => {
//       console.log("main.js onRoomActivated:", data.roomId, data.name);

//       // Update minimap
//       if (minimap) {
//         minimap.rooms.forEach((r, id) => {
//           minimap.updateRoomStatus(
//             id,
//             id === data.roomId ? "active" : "inactive",
//           );
//         });
//         minimap.showTarget(data.roomId);
//       }

//       // Update status indicator
//       roomStatusIndicator.style.display = "block";
//       roomStatusIndicator.style.borderLeftColor = "#ffaa00";
//       const timeRemaining = Math.max(
//         0,
//         Math.ceil((data.expiresAt - Date.now()) / 1000),
//       );
//       roomStatusIndicator.innerHTML = `
//         <strong style="color:#ffaa00; font-size: 16px;">🔔 ACTIVE ROOM</strong><br>
//         <span style="color:#ffffff; font-size: 13px;">${data.name}</span><br>
//         <span style="color:#ffff00">⏱️ ${timeRemaining}s remaining</span>
//     `;
//     };
//     roomManager.onRoomStatus = (data) => {
//       if (data.timeRemaining > 0) {
//         roomStatusIndicator.style.display = "block";
//         roomStatusIndicator.innerHTML = `
//             <strong style="color:#ffaa00; font-size: 16px;">🔔 ACTIVE ROOM</strong><br>
//             <span style="color:#ffff00">⏱️ ${Math.ceil(data.timeRemaining / 1000)}s</span><br>
//             <span style="color:#00ff00">📦 Ammo: ${data.ammoBoxOpen ? "✓" : "✗"} (${data.ammoCollectedCount})</span><br>
//             <span style="color:#ffff00">💉 Vaccine: ${data.vaccineBoxOpen ? "✓" : "✗"} (${data.vaccineCollectedCount})</span>
//         `;
//       } else {
//         roomStatusIndicator.style.display = "none";
//       }
//     };

//     // AFTER player is created, show weapon loadout selection
//     startGame();
//   });

//   // Also initialize roomManager when session is restored
//   socket.on("checkSession", (cookieId) => {
//     if (cookieId.length !== 0) {
//       const player = players.find(cookieId);
//       if (player !== null) {
//         socket.data.player = player;
//         // Instead, show loadout UI if player exists but hasn't selected loadout
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
//       if (existingPlayer) {
//         console.log(
//           `Player ${playerData.name} already exists, skipping creation`,
//         );
//         continue;
//       }

//       console.log(
//         "Creating player from initOthersCallback:",
//         playerData.name,
//         playerData.id,
//       );

//       const newPlayer = new Player(
//         playerData.id,
//         playerData.name,
//         playerData.color,
//         null,
//         world,
//         playerData.pos,
//       );

//       // Set the weapon index from the received data
//       if (playerData.weaponIndex !== undefined) {
//         newPlayer.currentWeaponIndex = playerData.weaponIndex;
//       }

//       // Set loadout if available
//       if (playerData.loadout && playerData.loadout.length > 0) {
//         newPlayer.setLoadoutFromServer(playerData.loadout);
//       }

//       players.add(newPlayer);
//       world.addObject(newPlayer.getThreeObj());

//       // Add to minimap
//       if (minimap) {
//         minimap.addPlayer(playerData.id, newPlayer);
//       }

//       newPlayer.nameLabel = new Label(
//         newPlayer.getNameObj(),
//         playerData.name,
//         "nameLabel",
//         "center",
//       );

//       // Ensure weapons are ready and attach after model loads
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
//     console.log("newPlayer event received:", data.name, data.id);

//     const existingPlayer = players.find(data.id);
//     if (existingPlayer) {
//       console.log(`Player ${data.name} already exists, skipping creation`);
//       return;
//     }

//     if (world !== undefined) {
//       const newPlayer = new Player(
//         data.id,
//         data.name,
//         data.color,
//         null,
//         world,
//         data.pos,
//       );

//       if (data.weaponIndex !== undefined) {
//         newPlayer.currentWeaponIndex = data.weaponIndex;
//       }

//       // Set loadout if available
//       if (data.loadout && data.loadout.length > 0) {
//         newPlayer.setLoadoutFromServer(data.loadout);
//       }

//       players.add(newPlayer);
//       world.addObject(newPlayer.getThreeObj());

//       if (minimap) {
//         minimap.addPlayer(data.id, newPlayer);
//       }

//       newPlayer.nameLabel = new Label(
//         newPlayer.getNameObj(),
//         data.name,
//         "nameLabel",
//         "center",
//       );

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
//       // Store previous weapon index to check if it changed
//       const previousWeaponIndex = player.currentWeaponIndex;

//       player.setPos(data.pos);
//       player.setRotation(data.rotation);

//       // If animation data is included, update it for remote players
//       if (data.animation && player !== self) {
//         player.handleRemoteAnimation(data.animation);
//       }

//       // If weapon index changed, update the weapon visually
//       if (
//         data.weaponIndex !== undefined &&
//         data.weaponIndex !== previousWeaponIndex &&
//         player !== self
//       ) {
//         console.log(
//           `Remote player ${player.name} switched to weapon ${data.weaponIndex}`,
//         );

//         // Force immediate update
//         player.currentWeaponIndex = data.weaponIndex;

//         // Ensure weapons are ready and attach
//         player.ensureWeaponsReady().then(() => {
//           // Small delay to ensure any ongoing animations don't interfere
//           setTimeout(() => {
//             player.attachCurrentWeapon();
//             console.log(`Weapon attached for remote player ${player.name}`);
//           }, 50);
//         });
//       }

//       const distance = world.getDistanceTo(player.getThreeObj());
//       player.nameLabel.show = distance <= speechRange;
//     }
//   });
//   socket.on("updatePlayerName", (data) => {
//     const player = players.find(data.id);
//     if (player !== null) {
//       const oldName = player.name;
//       player.name = data.name;
//       const prevLabel = LabelPlugin.find(player.getNameObj());
//       if (prevLabel !== null) {
//         prevLabel.remove();
//         player.nameLabel = new Label(
//           player.getNameObj(),
//           player.name,
//           "nameLabel",
//           "center",
//         );
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
//       player.nameLabel?.remove();
//       player.nameLabel = null;
//       players.remove(player);
//       world.removeObject(player.getThreeObj());

//       // Remove from minimap
//       if (minimap) {
//         minimap.removePlayer(data.id);
//       }
//     }
//   });

//   // Add socket listener for remote player loadout sync
//   socket.on("playerLoadout", (data) => {
//     const player = players.find(data.id);
//     if (player && player !== self) {
//       // Load the weapon configs for remote player
//       const weaponConfigs = data.weapons
//         .map((weaponName) => {
//           const found = Object.entries(WEAPON_CONFIGS).find(
//             ([key, config]) => config.name === weaponName,
//           );
//           return found ? found[1] : null;
//         })
//         .filter((w) => w);

//       if (weaponConfigs.length === 4) {
//         player.setLoadout(weaponConfigs);
//       }
//     }
//   });

//   // Add this to main.js socket listeners
//   socket.on("playerLoadout", (data) => {
//     const player = players.find(data.id);
//     if (player && player !== self) {
//       // Load the weapon configs for remote player
//       const weaponConfigs = data.weapons
//         .map((weaponName) => {
//           const found = Object.entries(WEAPON_CONFIGS).find(
//             ([key, config]) => config.name === weaponName,
//           );
//           return found ? found[1] : null;
//         })
//         .filter((w) => w);

//       if (weaponConfigs.length === 4) {
//         player.setLoadout(weaponConfigs);
//       }
//     }
//   });

//   socket.on("playerWeaponSwitch", (data) => {
//     const player = players.find(data.id);
//     if (player && player !== self) {
//       player.handleRemoteWeaponSwitch(data.weaponIndex);
//     }
//   });

//   socket.on("playerReload", (data) => {
//     const player = players.find(data.id);
//     if (player && player !== self) {
//       // Visual indication of reload for remote players
//       player.playAnimation("reloading", false);
//     }
//   });

//   // Update existing playerShot handler
//   socket.on("playerShot", (data) => {
//     const player = players.find(data.id);
//     if (player && player !== self) {
//       player.handleRemoteShot(data);
//     }
//   });

//   // ============================================================

//   socket.on("newMessage", (data) => {
//     let sender = players.find(data.sender.id) ?? data.sender;
//     if (sender !== self && sender instanceof Player) {
//       const distance = world.getDistanceTo(sender.getThreeObj());
//       if (distance <= speechRange) {
//         const prevLabel = LabelPlugin.find(sender.getSpeechObj());
//         if (prevLabel) prevLabel.remove();
//         new Label(
//           sender.getSpeechObj(),
//           data.text,
//           "speechBubble",
//           "left",
//           3 + data.text.length * 0.05,
//         );
//       }
//     }
//     const newMessage = new Message(data.text, sender, data.date);
//     messages.add(newMessage);
//     addMessage(newMessage);
//   });
//   socket.on("serverResponse", (data) => {
//     addServerResponse(data);
//   });
//   document
//     .getElementById("btnSendName")
//     ?.addEventListener("click", initNewSession);
//   document.getElementById("txtName")?.addEventListener("keypress", (e) => {
//     if (e.key === "Enter") {
//       e.preventDefault();
//       initNewSession();
//     }
//   });
//   document.getElementById("txtMessage")?.addEventListener("keypress", (e) => {
//     if (e.key === "Enter") {
//       e.preventDefault();
//       sendMessage();
//     }
//   });
//   document.getElementById("txtMessage")?.addEventListener("keydown", (e) => {
//     switch (e.key) {
//       case "ArrowUp":
//         e.preventDefault();
//         historyPrev();
//         break;
//       case "ArrowDown":
//         historyNext();
//         break;
//     }
//   });

//   checkSession();
// };
// // -------------------- Functions --------------------
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

//     // Update minimap player reference (just in case)
//     if (minimap) {
//       if (!minimap.player) minimap.player = {};
//       minimap.player.position = self.threeObj.position;
//       minimap.player.rotation = { y: self.threeObj.rotation.y };
//       minimap.player.name = self.name;
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
//   const html = `
//     <tr class="${className}">
//       <td class="timestamp">${moment(message.date).format("HH:mm")}</td>
//       <td><span class="userName">${message.sender.name}:</span> ${message.text.replace(/\n/g, "<br>")}</td>
//     </tr>
//   `;
//   document.getElementById("messageList").innerHTML += html;
//   document.getElementById("messagesInner").scrollTop =
//     document.getElementById("messagesInner").scrollHeight;
// }
// function addServerResponse(response) {
//   const html = `
//     <tr>
//       <td colspan="2" class="${response.type}">${response.text}</td>
//     </tr>
//   `;
//   document.getElementById("messageList").innerHTML += html;
//   document.getElementById("messagesInner").scrollTop =
//     document.getElementById("messagesInner").scrollHeight;
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
//   indicator.style.cssText = `
//         position: fixed;
//         top: 240px;
//         right: 20px;
//         background: rgba(0,0,0,0.8);
//         color: white;
//         padding: 10px;
//         border-radius: 5px;
//         font-family: Arial;
//         font-size: 14px;
//         z-index: 999;
//         border-left: 4px solid #888;
//         display: none;
//     `;
//   document.body.appendChild(indicator);
//   return indicator;
// }

// // Update prompt visibility function
// function updateInteractionPrompt() {
//   if (!interactionPrompt) return;

//   if (roomManager && roomManager.currentRoomId && roomManager.activeRoom) {
//     const room = roomManager.rooms.get(roomManager.currentRoomId);
//     if (room && room.isActive) {
//       interactionPrompt.style.display = "block";

//       // Update prompt text based on what's available
//       if (!room.ammoBoxOpen || !room.vaccineBoxOpen) {
//         let available = [];
//         if (!room.ammoBoxOpen) available.push("Ammo");
//         if (!room.vaccineBoxOpen) available.push("Vaccine");
//         interactionPrompt.innerHTML = `🎁 Press E to open (${available.join(" / ")})`;
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
//   // Make socket available globally for LoadoutUI
//   window.socket = socket;

//   console.log("🎮 Creating Loadout UI");

//   loadoutUI = new LoadoutUI((selectedWeapons) => {
//     console.log(
//       "✅ Selected weapons in callback:",
//       selectedWeapons.map((w) => w.name),
//     );

//     // Store the selected weapons
//     pendingLoadoutWeapons = selectedWeapons;

//     // The actual confirmation is now handled in LoadoutUI.confirm()
//     // which emits 'confirmLoadout' to the server
//   });
// }

// function startGame() {
//   if (gameStarted) return;
//   gameStarted = true;

//   const newPlayerDiv = document.getElementById("newPlayer");
//   const startGameDiv = document.getElementById("startGame");
//   const chatDiv = document.getElementById("chat");

//   newPlayerDiv.style.display = "none";
//   startGameDiv.style.display = "block";
//   chatDiv.style.display = "block";

//   // On mobile, auto-start without button click
//   const isMobile =
//     /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
//       navigator.userAgent,
//     );

//   if (isMobile) {
//     // Auto-start for mobile
//     document.getElementById("btnStart")?.click();
//   } else {
//     document.getElementById("btnStart")?.focus();
//   }

//   socket.emit("initOthers", "");
//   updateSelf();
// }

// // Update weapon indicator when weapon changes
// window.addEventListener("weaponChanged", (e) => {
//   if (mobileControls) {
//     mobileControls.updateWeaponIndicator(e.detail.current, e.detail.total);
//   }
// });

// const roomStatusIndicator = createRoomStatusIndicator();

// function animateMinimap() {
//   if (minimap) {
//     minimap.updateAll();
//   }

//   // Update mobile controls
//   if (mobileControls) {
//     mobileControls.update();
//   }

//   updateInteractionPrompt();
//   requestAnimationFrame(animateMinimap);
// }

// // Start minimap animation loop
// animateMinimap();
// //# sourceMappingURL=main.js.map
// import { io } from 'socket.io-client';
import * as THREE from "three";
import moment from "https://cdn.jsdelivr.net/npm/moment@2.29.4/+esm";
import World from "./classes/World.js";
import PlayerList from "./classes/PlayerList.js";
import Player from "./classes/Player.js";
import MessageList from "./classes/MessageList.js";
import Message from "./classes/Message.js";
import Label, { LabelPlugin } from "./classes/Label.js";
import { Minimap } from "./classes/Minimap.js";
import RoomManager from "./classes/RoomManager.js";
import { MobileControls } from "./classes/mobileControls.js";
import LoadoutUI from "./classes/loadoutUI.js";
import { WEAPON_CONFIGS } from "./classes/constants.js";
import VoiceChat from "./classes/VoiceChat.js";
window.WEAPON_CONFIGS = WEAPON_CONFIGS;

const socket = io();
let world;
let self;
let roomManager;
const players = new PlayerList();
window.players = players;
const messages = new MessageList();
const messageHistory = new MessageList();
let historyCurrent = -1;
const speechRange = 300;

let voiceChat = null;

let crosshair3D = null;

let loadoutUI = null;
let pendingPlayerData = null;
let pendingLoadoutWeapons = null;

// Create minimap (will be properly initialized after self is created)
let minimap = null;

// Create interaction prompt (will be initialized after DOM is ready)
let interactionPrompt = null;

let mobileControls = null;

let gameStarted = false;

window.onload = () => {
  const newPlayerDiv = document.getElementById("newPlayer");

  socket.emit("findMatch");

  socket.on("matchJoined", ({ matchId }) => {
    console.log("✅ Joined match:", matchId);

    // Continue your normal flow AFTER match is ready
    checkSession();
  });

  // NEW: Handle showLoadout event
  socket.on("showLoadout", (data) => {
    console.log("✅ Show loadout event received for:", data.name);

    // Store player data for later
    window.pendingPlayerData = data;

    // Hide name entry UI
    const newPlayerDiv = document.getElementById("newPlayer");
    if (newPlayerDiv) {
      newPlayerDiv.style.display = "none";
    }

    // Show loadout UI
    showLoadoutSelection();
  });

  socket.on("checkSessionCallback", () => {
    // Only create world if it doesn't exist yet
    if (!world) {
      world = new World();
    }

    // Register any existing players' mixers
    players.getAll().forEach((player) => {
      if (player.mixer) {
        world.addMixer(player.mixer);
      }
    });

    newPlayerDiv.style.display = "block";
    document.getElementById("txtName").focus();
  });
  socket.on("playerAnimation", (data) => {
    const player = players.find(data.id);
    if (player && player !== self) {
      player.handleRemoteAnimation(data.animation);
    }
  });

  socket.on("initSelf", (data) => {
    console.log(
      "✅ initSelf received, initializing player in world with loadout:",
      window.pendingLoadoutWeapons,
    );

    // Make sure world exists
    if (!world) {
      world = new World();
    }

    // Create the actual player
    self = new Player(data.id, data.name, data.color, socket, world, data.pos);

    // Apply the selected loadout if available
    if (
      window.pendingLoadoutWeapons &&
      window.pendingLoadoutWeapons.length === 4
    ) {
      console.log(
        "Applying loadout to player:",
        window.pendingLoadoutWeapons.map((w) => w.name),
      );
      self.setLoadout(window.pendingLoadoutWeapons);
      // Clear the pending loadout
      window.pendingLoadoutWeapons = null;
    } else {
      // Fallback - load default weapons
      console.log("No loadout found, loading default weapons");
      self.loadDefaultWeapons();
    }

    players.add(self);
    world.initControls(self);

    // document.addEventListener("keydown", (e) => {
    //   if (e.code === "KeyC" && world && world.controls) {
    //     world.controls.toggleCameraMode();
    //   }
    // });

    document.addEventListener("keydown", (e) => {
      if (e.code === "KeyC" && world && world.controls) {
        // Toggle aim for keyboard testing
        if (world.controls.isAiming) {
          world.controls.stopAiming();
        } else {
          world.controls.startAiming();
        }
      }
    });

    // Initialize voice chat
    voiceChat = new VoiceChat(socket, self);

    // Make voiceChat available globally for UI updates
    window.voiceChat = voiceChat;

    // Initialize mobile controls
    if (world.controls) {
      mobileControls = new MobileControls(world.controls);
      mobileControls.init();
    }

    // Initialize minimap after player is created
    minimap = new Minimap(2000);
    minimap.setPlayer(self);

    // Initialize roomManager
    roomManager = new RoomManager(world, socket, self, minimap);

    // ✅ Minimap room init via callback — not a second socket listener
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

    // ✅ Hook into roomManager for UI updates
    roomManager.onRoomActivated = (data, room) => {
      console.log("main.js onRoomActivated:", data.roomId, data.name);

      // Update minimap
      if (minimap) {
        minimap.rooms.forEach((r, id) => {
          minimap.updateRoomStatus(
            id,
            id === data.roomId ? "active" : "inactive",
          );
        });
        minimap.showTarget(data.roomId);
      }

      // Update status indicator
      roomStatusIndicator.style.display = "block";
      roomStatusIndicator.style.borderLeftColor = "#ffaa00";
      const timeRemaining = Math.max(
        0,
        Math.ceil((data.expiresAt - Date.now()) / 1000),
      );
      roomStatusIndicator.innerHTML = `
        <strong style="color:#ffaa00; font-size: 16px;">🔔 ACTIVE ROOM</strong><br>
        <span style="color:#ffffff; font-size: 13px;">${data.name}</span><br>
        <span style="color:#ffff00">⏱️ ${timeRemaining}s remaining</span>
    `;
    };
    roomManager.onRoomStatus = (data) => {
      if (data.timeRemaining > 0) {
        roomStatusIndicator.style.display = "block";
        roomStatusIndicator.innerHTML = `
            <strong style="color:#ffaa00; font-size: 16px;">🔔 ACTIVE ROOM</strong><br>
            <span style="color:#ffff00">⏱️ ${Math.ceil(data.timeRemaining / 1000)}s </span>
            <span style="color:#00ff00">📦 Ammo: ${data.ammoBoxOpen ? "✓" : "✗"} (${data.ammoCollectedCount}) </span>
            <span style="color:#ffff00">💉 Vaccine: ${data.vaccineBoxOpen ? "✓" : "✗"} (${data.vaccineCollectedCount})</span>
        `;
      } else {
        roomStatusIndicator.style.display = "none";
      }
    };

    // AFTER player is created, show weapon loadout selection
    startGame();
  });

  // Also initialize roomManager when session is restored
  socket.on("checkSession", (cookieId) => {
    if (cookieId.length !== 0) {
      const player = players.find(cookieId);
      if (player !== null) {
        socket.data.player = player;
        // Instead, show loadout UI if player exists but hasn't selected loadout
        if (player.loadout && player.loadout.length > 0) {
          socket.emit("initSelf", player.clientFormat());
        } else {
          socket.emit("showLoadout", player.clientFormat());
        }
      }
    }
  });
  socket.on("initOthersCallback", (data) => {
    console.log("initOthersCallback received with", data.length, "players");
    for (const playerData of data) {
      const existingPlayer = players.find(playerData.id);
      if (existingPlayer) {
        console.log(
          `Player ${playerData.name} already exists, skipping creation`,
        );
        continue;
      }

      console.log(
        "Creating player from initOthersCallback:",
        playerData.name,
        playerData.id,
      );

      const newPlayer = new Player(
        playerData.id,
        playerData.name,
        playerData.color,
        null,
        world,
        playerData.pos,
      );

      // Set the weapon index from the received data
      if (playerData.weaponIndex !== undefined) {
        newPlayer.currentWeaponIndex = playerData.weaponIndex;
      }

      // Set loadout if available
      if (playerData.loadout && playerData.loadout.length > 0) {
        newPlayer.setLoadoutFromServer(playerData.loadout);
      }

      players.add(newPlayer);
      world.addObject(newPlayer.getThreeObj());

      // Add to minimap
      if (minimap) {
        minimap.addPlayer(playerData.id, newPlayer);
      }

      newPlayer.nameLabel = new Label(
        newPlayer.getNameObj(),
        playerData.name,
        "nameLabel",
        "center",
      );

      // Ensure weapons are ready and attach after model loads
      newPlayer.ensureWeaponsReady().then(() => {
        const checkModelInterval = setInterval(() => {
          if (newPlayer.modelLoaded) {
            clearInterval(checkModelInterval);
            newPlayer.attachCurrentWeapon();
          }
        }, 100);
      });
    }
  });
  socket.on("newPlayer", (data) => {
    console.log("newPlayer event received:", data.name, data.id);

    const existingPlayer = players.find(data.id);
    if (existingPlayer) {
      console.log(`Player ${data.name} already exists, skipping creation`);
      return;
    }

    if (world !== undefined) {
      const newPlayer = new Player(
        data.id,
        data.name,
        data.color,
        null,
        world,
        data.pos,
      );

      if (data.weaponIndex !== undefined) {
        newPlayer.currentWeaponIndex = data.weaponIndex;
      }

      // Set loadout if available
      if (data.loadout && data.loadout.length > 0) {
        newPlayer.setLoadoutFromServer(data.loadout);
      }

      players.add(newPlayer);
      world.addObject(newPlayer.getThreeObj());

      if (minimap) {
        minimap.addPlayer(data.id, newPlayer);
      }

      newPlayer.nameLabel = new Label(
        newPlayer.getNameObj(),
        data.name,
        "nameLabel",
        "center",
      );

      newPlayer.ensureWeaponsReady().then(() => {
        const checkModelInterval = setInterval(() => {
          if (newPlayer.modelLoaded) {
            clearInterval(checkModelInterval);
            newPlayer.attachCurrentWeapon();
          }
        }, 100);
      });

      const newMessage = new Message(
        `${data.name} joined the game`,
        { name: "Server" },
        Date.now(),
      );
      addMessage(newMessage);
    }
  });
  socket.on("updatePlayer", (data) => {
    const player = players.find(data.id);
    if (player !== null) {
      // Store previous weapon index to check if it changed
      const previousWeaponIndex = player.currentWeaponIndex;

      // player.setPos(data.pos);
      // player.setRotation(data.rotation);
      player.setTargetPos(data.pos);
      player.setTargetRotation(data.rotation);

      // If animation data is included, update it for remote players
      if (data.animation && player !== self) {
        player.handleRemoteAnimation(data.animation);
      }

      // If weapon index changed, update the weapon visually
      if (
        data.weaponIndex !== undefined &&
        data.weaponIndex !== previousWeaponIndex &&
        player !== self
      ) {
        console.log(
          `Remote player ${player.name} switched to weapon ${data.weaponIndex}`,
        );

        // Force immediate update
        player.currentWeaponIndex = data.weaponIndex;

        // Ensure weapons are ready and attach
        player.ensureWeaponsReady().then(() => {
          // Small delay to ensure any ongoing animations don't interfere
          setTimeout(() => {
            player.attachCurrentWeapon();
            console.log(`Weapon attached for remote player ${player.name}`);
          }, 50);
        });
      }

      const distance = world.getDistanceTo(player.getThreeObj());
      player.nameLabel.show = distance <= speechRange;
    }
  });
  socket.on("updatePlayerName", (data) => {
    const player = players.find(data.id);
    if (player !== null) {
      const oldName = player.name;
      player.name = data.name;
      const prevLabel = LabelPlugin.find(player.getNameObj());
      if (prevLabel !== null) {
        prevLabel.remove();
        player.nameLabel = new Label(
          player.getNameObj(),
          player.name,
          "nameLabel",
          "center",
        );
      }
      const newMessage = new Message(
        `${oldName} changed name to ${player.name}`,
        { name: "Server" },
        Date.now(),
      );
      addMessage(newMessage);
    }
  });
  socket.on("removePlayer", (data) => {
    const player = players.find(data.id);
    if (player !== null) {
      player.nameLabel?.remove();
      player.nameLabel = null;
      players.remove(player);
      world.removeObject(player.getThreeObj());

      // Remove from minimap
      if (minimap) {
        minimap.removePlayer(data.id);
      }
    }
  });

  // Add socket listener for remote player loadout sync
  socket.on("playerLoadout", (data) => {
    const player = players.find(data.id);
    if (player && player !== self) {
      // Load the weapon configs for remote player
      const weaponConfigs = data.weapons
        .map((weaponName) => {
          const found = Object.entries(WEAPON_CONFIGS).find(
            ([key, config]) => config.name === weaponName,
          );
          return found ? found[1] : null;
        })
        .filter((w) => w);

      if (weaponConfigs.length === 4) {
        player.setLoadout(weaponConfigs);
      }
    }
  });

  // Add this to main.js socket listeners
  socket.on("playerLoadout", (data) => {
    const player = players.find(data.id);
    if (player && player !== self) {
      // Load the weapon configs for remote player
      const weaponConfigs = data.weapons
        .map((weaponName) => {
          const found = Object.entries(WEAPON_CONFIGS).find(
            ([key, config]) => config.name === weaponName,
          );
          return found ? found[1] : null;
        })
        .filter((w) => w);

      if (weaponConfigs.length === 4) {
        player.setLoadout(weaponConfigs);
      }
    }
  });

  socket.on("playerWeaponSwitch", (data) => {
    const player = players.find(data.id);
    if (player && player !== self) {
      player.handleRemoteWeaponSwitch(data.weaponIndex);
    }
  });

  socket.on("playerReload", (data) => {
    const player = players.find(data.id);
    if (player && player !== self) {
      // Visual indication of reload for remote players
      player.playAnimation("reloading", false);
    }
  });

  // Update existing playerShot handler
  socket.on("playerShot", (data) => {
    const player = players.find(data.id);
    if (player && player !== self) {
      player.handleRemoteShot(data);
    }
  });

  socket.on("playerHit", (data) => {
    // Show hit marker on screen
    if (data.shooterId === self?.id) {
      showHitMarker();
    }

    // Show hit effect on the target player
    const targetPlayer = players.find(data.targetId);
    if (targetPlayer && world) {
      const pos = targetPlayer.getThreeObj().position.clone();
      pos.y += 12;
      showHitEffect(pos);

      // If we are the target, take damage
      if (targetPlayer === self) {
        self.takeDamage(data.damage);
        self.updateHealthUI();
      }
    }
  });

  // When server broadcasts a player death
  socket.on("playerDied", (data) => {
    const player = players.find(data.playerId);
    if (!player) return;

    // If this is the local player dying, handle separately
    if (player === self) {
      self.die(data.killerId);
      return;
    }

    // Remote player died
    player.playAnimation("dying", false, false);
    player.isDead = true;

    // Kill feed message
    const killerPlayer = players.find(data.killerId);
    const killerName = killerPlayer?.name || "Unknown";
    const newMessage = new Message(
      `💀 ${killerName} eliminated ${player.name}`,
      { name: "Server" },
      Date.now(),
    );
    addMessage(newMessage);

    // Remove remote dead player after animation finishes
    setTimeout(() => {
      if (player.nameLabel) {
        player.nameLabel.remove();
        player.nameLabel = null;
      }
      players.remove(player);
      if (world) world.removeObject(player.getThreeObj());
      if (minimap) minimap.removePlayer(data.playerId);
    }, 3000);
  });

  // ============================================================

  socket.on("newMessage", (data) => {
    let sender = players.find(data.sender.id) ?? data.sender;
    if (sender !== self && sender instanceof Player) {
      const distance = world.getDistanceTo(sender.getThreeObj());
      if (distance <= speechRange) {
        const prevLabel = LabelPlugin.find(sender.getSpeechObj());
        if (prevLabel) prevLabel.remove();
        new Label(
          sender.getSpeechObj(),
          data.text,
          "speechBubble",
          "left",
          3 + data.text.length * 0.05,
        );
      }
    }
    const newMessage = new Message(data.text, sender, data.date);
    messages.add(newMessage);
    addMessage(newMessage);
  });
  socket.on("serverResponse", (data) => {
    addServerResponse(data);
  });
  document
    .getElementById("btnSendName")
    ?.addEventListener("click", initNewSession);
  document.getElementById("txtName")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      initNewSession();
    }
  });
  document.getElementById("txtMessage")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  });
  document.getElementById("txtMessage")?.addEventListener("keydown", (e) => {
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        historyPrev();
        break;
      case "ArrowDown":
        historyNext();
        break;
    }
  });

  // checkSession();
};
// -------------------- Functions --------------------
function trim(str) {
  return str.trim();
}
function checkSession() {
  socket.emit("checkSession", "");
}
function initNewSession() {
  const name = document.getElementById("txtName").value;
  socket.emit("initNewSession", name);
}
function updateSelf() {
  if (self) {
    const format = {
      id: self.id,
      color: self.color,
      pos: self.threeObj.position,
      rotation: {
        x: self.pitchObj ? self.pitchObj.rotation.x : 0,
        y: self.threeObj.rotation.y,
      },
      weaponIndex: self.currentWeaponIndex,
      animation: self.currentAnimation,
    };
    socket.emit("updatePlayer", format);

    // Update minimap player reference (just in case)
    if (minimap) {
      if (!minimap.player) minimap.player = {};
      minimap.player.position = self.threeObj.position;
      minimap.player.rotation = { y: self.threeObj.rotation.y };
      minimap.player.name = self.name;
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
  const html = `
    <tr class="${className}">
      <td class="timestamp">${moment(message.date).format("HH:mm")}</td>
      <td><span class="userName">${message.sender.name}:</span> ${message.text.replace(/\n/g, "<br>")}</td>
    </tr>
  `;
  document.getElementById("messageList").innerHTML += html;
  document.getElementById("messagesInner").scrollTop =
    document.getElementById("messagesInner").scrollHeight;
}
function addServerResponse(response) {
  const html = `
    <tr>
      <td colspan="2" class="${response.type}">${response.text}</td>
    </tr>
  `;
  document.getElementById("messageList").innerHTML += html;
  document.getElementById("messagesInner").scrollTop =
    document.getElementById("messagesInner").scrollHeight;
}
function historyPrev() {
  const h = messageHistory.getAll();
  if (historyCurrent > 0) {
    const msg = h[--historyCurrent];
    document.getElementById("txtMessage").value = msg ? msg.text : "";
  }
}
function historyNext() {
  const h = messageHistory.getAll();
  if (historyCurrent < h.length - 1) {
    const msg = h[++historyCurrent];
    document.getElementById("txtMessage").value = msg ? msg.text : "";
  }
}

function createRoomStatusIndicator() {
  const indicator = document.createElement("div");
  indicator.id = "room-status";
  indicator.style.cssText = `
        position: fixed;
        top: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.1);
        color: white;
        padding: 10px;
        font-family: Arial;
        font-size: 0.8rem;
        z-index: 999;
        border-left: 4px solid #888;
        display: none;
        text-align: center;
    `;
  document.body.appendChild(indicator);
  return indicator;
}

// Update prompt visibility function
function updateInteractionPrompt() {
  if (!interactionPrompt) return;

  if (roomManager && roomManager.currentRoomId && roomManager.activeRoom) {
    const room = roomManager.rooms.get(roomManager.currentRoomId);
    if (room && room.isActive) {
      interactionPrompt.style.display = "block";

      // Update prompt text based on what's available
      if (!room.ammoBoxOpen || !room.vaccineBoxOpen) {
        let available = [];
        if (!room.ammoBoxOpen) available.push("Ammo");
        if (!room.vaccineBoxOpen) available.push("Vaccine");
        interactionPrompt.innerHTML = `🎁 Press E to open (${available.join(" / ")})`;
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

function showLoadoutSelection() {
  // Make socket available globally for LoadoutUI
  window.socket = socket;

  console.log("🎮 Creating Loadout UI");

  loadoutUI = new LoadoutUI((selectedWeapons) => {
    console.log(
      "✅ Selected weapons in callback:",
      selectedWeapons.map((w) => w.name),
    );

    // Store the selected weapons
    pendingLoadoutWeapons = selectedWeapons;

    // The actual confirmation is now handled in LoadoutUI.confirm()
    // which emits 'confirmLoadout' to the server
  });
}

function showHitMarker() {
  // Flash the crosshair red
  if (world?.crosshair3D) {
    world.crosshair3D.hitFeedback();
  }

  // Optional: HTML hit marker
  const marker = document.createElement("div");
  marker.style.cssText = `
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 20px; height: 20px;
    border: 2px solid red;
    border-radius: 50%;
    pointer-events: none;
    z-index: 9999;
    animation: hitPulse 0.2s ease-out forwards;
  `;
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
  const bar = document.createElement("div");
  bar.id = "health-bar";
  bar.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    width: 200px;
    background: rgba(0,0,0,0.6);
    border-radius: 8px;
    padding: 6px 10px;
    z-index: 1000;
    font-family: Arial;
  `;
  bar.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="color: #ff4444; font-size: 16px;">♥</span>
      <div style="flex: 1; background: rgba(255,255,255,0.15); border-radius: 4px; height: 10px; overflow: hidden;">
        <div id="health-fill" style="height: 100%; width: 100%; background: #00cc44; transition: width 0.3s, background 0.3s; border-radius: 4px;"></div>
      </div>
      <span id="health-text" style="color: white; font-size: 13px; min-width: 28px; text-align: right;">100</span>
    </div>
  `;
  document.body.appendChild(bar);
}

function startGame() {
  if (gameStarted) return;
  gameStarted = true;

  const newPlayerDiv = document.getElementById("newPlayer");
  const startGameDiv = document.getElementById("startGame");
  const chatDiv = document.getElementById("chat");

  newPlayerDiv.style.display = "none";
  startGameDiv.style.display = "block";
  chatDiv.style.display = "block";

  // On mobile, auto-start without button click
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );

  if (isMobile) {
    // Auto-start for mobile
    document.getElementById("btnStart")?.click();
  } else {
    document.getElementById("btnStart")?.focus();
  }

  socket.emit("initOthers", "");
  updateSelf();
  createHealthBar();
}

// Update weapon indicator when weapon changes
window.addEventListener("weaponChanged", (e) => {
  if (mobileControls) {
    mobileControls.updateWeaponIndicator(e.detail.current, e.detail.total);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.code === "KeyB" && self) {
    // Press B to toggle hitbox
    if (!self.hitboxVisible) {
      self.enableHitboxVisualization(true);
      self.hitboxVisible = true;
      console.log("Hitbox visualization ON");
    } else {
      self.enableHitboxVisualization(false);
      self.hitboxVisible = false;
      console.log("Hitbox visualization OFF");
    }
  }
});

const roomStatusIndicator = createRoomStatusIndicator();

function animateMinimap() {
  // Interpolate all remote players
  players.getAll().forEach((p) => {
    if (p !== self) p.interpolate?.();
  });

  if (minimap) minimap.updateAll();
  if (mobileControls) mobileControls.update();
  updateInteractionPrompt();
  requestAnimationFrame(animateMinimap);
}

// Start minimap animation loop
animateMinimap();
//# sourceMappingURL=main.js.map
