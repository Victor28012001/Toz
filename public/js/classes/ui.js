// // From main.js to utils.js
// import * as THREE from "three";
// import { buildingObjects, alienMonsterSystem, alienDogSystem, bountySystem} from "./World.js";
// import { BOUNTY_VALUE } from "./bountySystem.js";
// let healthBar = null;
// let scoreDisplay = null;
// let minimap = null;
// let minimapCtx = null;
// import { playerHealth, playerScore, playerAmmo, maxAmmo } from "./World.js";

// export function createCrosshair() {
//   const crosshair = document.createElement("div");
//   crosshair.id = "crosshair";
//   crosshair.style.cssText = `
//     position: fixed;
//     top: 50%;
//     left: 50%;
//     transform: translate(-50%, -50%);
//     width: 20px;
//     height: 20px;
//     pointer-events: none;
//     z-index: 1000;
//   `;

//   crosshair.innerHTML = `
//     <div style="position: absolute; top: 50%; left: 0; width: 100%; height: 2px; background: white; transform: translateY(-50%);"></div>
//     <div style="position: absolute; left: 50%; top: 0; width: 2px; height: 100%; background: white; transform: translateX(-50%);"></div>
//     <div style="position: absolute; top: 50%; left: 50%; width: 4px; height: 4px; background: #00ff00; border-radius: 50%; transform: translate(-50%, -50%);"></div>
//   `;

//   document.body.appendChild(crosshair);
//   crosshair.style.display = "none";
//   return crosshair;
// }

// export function createTimeUI() {
//   const timeUI = document.createElement("div");
//   timeUI.id = "time-display";
//   timeUI.style.cssText = `
//     position: fixed;
//     top: 10px;
//     left: 50%;
//     transform: translateX(-50%);
//     // background: rgba(0, 0, 0, 0.7);
//     color: white;
//     padding: 10px 15px;
//     border-radius: 5px;
//     font-family: Arial, sans-serif;
//     font-size: 18px;
//     // border: 2px solid #555;
//     z-index: 1000;
//     min-width: 150px;
//   `;

//   timeUI.innerHTML = `
//     <div style="display: flex; align-items: center; gap: 10px;">
//       <span id="time-icon" style="font-size: 24px;">☀️</span>
//       <div>
//         <div id="time-text" style="font-weight: bold;">12:00 PM</div>
//         <div id="time-period" style="font-size: 12px; color: #aaa;">Day</div>
//       </div>
//     </div>
//   `;

//   document.body.appendChild(timeUI);
//   return timeUI;
// }

// export function createDoorPromptUI() {
//   const doorPrompt = document.createElement("div");
//   doorPrompt.id = "door-prompt";
//   doorPrompt.style.cssText = `
//     position: fixed;
//     top: 50%;
//     left: 50%;
//     transform: translate(-50%, -50%);
//     background: rgba(0, 0, 0, 0.8);
//     color: white;
//     padding: 15px 25px;
//     border-radius: 10px;
//     font-family: Arial, sans-serif;
//     font-size: 18px;
//     border: 2px solid #00ff00;
//     z-index: 1001;
//     display: none;
//     pointer-events: none;
//     text-align: center;
//     min-width: 200px;
//   `;

//   doorPrompt.innerHTML = `
//     <div style="margin-bottom: 5px;">🚪 Door</div>
//     <div style="font-size: 16px; color: #00ff00;">Press <span style="background: #333; padding: 2px 8px; border-radius: 4px; margin: 0 5px;">O</span> to open</div>
//   `;

//   document.body.appendChild(doorPrompt);
//   return doorPrompt;
// }

// export function createGameUI() {
//   // Health bar
//   healthBar = document.createElement("div");
//   healthBar.id = "health-bar";
//   healthBar.style.cssText = `
//     position: fixed;
//     top: 20px;
//     left: 20px;
//     width: 200px;
//     height: 10px;
//     background: #333;
//     border: 2px solid #555;
//     border-radius: 5px;
//     overflow: hidden;
//     z-index: 1000;
//   `;

//   const healthFill = document.createElement("div");
//   healthFill.id = "health-fill";
//   healthFill.style.cssText = `
//     width: 100%;
//     height: 100%;
//     background: #00ff00;
//     transition: width 0.3s;
//   `;
//   healthBar.appendChild(healthFill);
//   document.body.appendChild(healthBar);

//   // Add time UI
//   createTimeUI();

//   // Score display
//   scoreDisplay = document.createElement("div");
//   scoreDisplay.id = "score-display";
//   scoreDisplay.style.cssText = `
//     position: fixed;
//     top: 40px;
//     left: 20px;
//     color: white;
//     font-family: Arial, sans-serif;
//     font-size: small;
//     z-index: 1000;
//   `;
//   scoreDisplay.textContent = `Score: $${playerScore}`;
//   document.body.appendChild(scoreDisplay);

//   // Score display
//   let profileDisplay
//   profileDisplay = document.createElement("div");
//   profileDisplay.id = "profile-display";
//   profileDisplay.style.cssText = `
//     position: fixed;
//     top: 20px;
//     left: 5px;
//     color: white;
//     font-family: Arial, sans-serif;
//     font-size: small;
//     z-index: 1000;
//     width: 48px;
//     height: 48px;
//     border: 2px solid white;
//     border-radius: 50%;
//     overflow: hidden;
//   `;
//   profileDisplay.innerHTML = `<img src="assets/textures/pfp.jpg" style="width:100%">`;
//   document.body.appendChild(profileDisplay);

//   // Minimap
//   minimap = document.createElement("canvas");
//   minimap.id = "minimap";
//   minimap.width = 200;
//   minimap.height = 200;
//   minimap.style.cssText = `
//     position: fixed;
//     top: 10px;
//     right: 20px;
//     width: 100px;
//     height: 100px;
//     background: rgba(0, 0, 0, 0.5);
//     border: 2px solid white;
//     border-radius: 10px;
//     z-index: 1000;
//   `;
//   document.body.appendChild(minimap);
//   minimapCtx = minimap.getContext("2d");

//   // Instructions
//   const instructions = document.createElement("div");
//   instructions.id = "instructions";
//   instructions.style.cssText = `
//     position: fixed;
//     bottom: 60px;
//     left: 20px;
//     color: white;
//     font-family: Arial, sans-serif;
//     font-size: 14px;
//     z-index: 1000;
//   `;
//   instructions.innerHTML = `
//     WASD/Arrows: Move<br>
//     Mouse: Aim & Look<br>
//     Left Click: Shoot<br>
//     O: Open Doors<br>
//     Shift: Run<br>
//     F: Collect Ammo/Health
//   `;
//   document.body.appendChild(instructions);
// }

// export function updateHealthBar() {
//   if (!healthBar) return;
//   const healthFill = healthBar.querySelector("#health-fill");
//   if (healthFill) {
//     const healthPercent = (playerHealth / 100) * 100;
//     healthFill.style.width = `${healthPercent}%`;

//     // Change color based on health
//     if (healthPercent > 50) {
//       healthFill.style.background = "#00ff00";
//     } else if (healthPercent > 25) {
//       healthFill.style.background = "#ffff00";
//     } else {
//       healthFill.style.background = "#ff0000";
//     }
//   }
// }

// export function updateScoreDisplay() {
//   if (scoreDisplay) {
//     scoreDisplay.textContent = `Score: $${playerScore}`;
//   }
// }

// export function updateMinimap(currentControlledPlayer) {
//   if (!minimapCtx || !currentControlledPlayer) return;

//   const ctx = minimapCtx;
//   const mapSize = 100; // Game world units represented on minimap

//   // Clear minimap
//   ctx.clearRect(0, 0, minimap.width, minimap.height);

//   // Draw background
//   ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
//   ctx.fillRect(0, 0, minimap.width, minimap.height);

//   // Get player position
//   const playerPos = new THREE.Vector3();
//   currentControlledPlayer.getWorldPosition(playerPos);

//   // Calculate view bounds
//   const centerX = minimap.width / 2;
//   const centerY = minimap.height / 2;

//   // Draw buildings
//   ctx.fillStyle = "rgba(100, 100, 100, 0.8)";
//   buildingObjects.forEach((building) => {
//     const buildingPos = new THREE.Vector3();
//     building.getWorldPosition(buildingPos);

//     const x =
//       centerX + (buildingPos.x - playerPos.x) * (minimap.width / mapSize);
//     const y =
//       centerY + (buildingPos.z - playerPos.z) * (minimap.height / mapSize);

//     // Draw building as rectangle
//     ctx.fillRect(x - 10, y - 10, 20, 20);
//   });

//   // Draw player
//   ctx.fillStyle = "#00ffff";
//   ctx.beginPath();
//   ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
//   ctx.fill();

//   // Draw player direction
//   ctx.strokeStyle = "#00ffff";
//   ctx.lineWidth = 2;
//   ctx.beginPath();
//   ctx.moveTo(centerX, centerY);
//   const dirX = centerX + Math.sin(currentControlledPlayer.rotation.y) * 15;
//   const dirY = centerY + Math.cos(currentControlledPlayer.rotation.y) * 15;
//   ctx.lineTo(dirX, dirY);
//   ctx.stroke();

//   // Draw aliens (red) - ACCESS THROUGH SYSTEM
//   if (alienMonsterSystem) {
//     ctx.fillStyle = "#ff0000";
//     alienMonsterSystem.alienMonsters.forEach((alien) => {
//       if (!alien.userData.alive) return;

//       const alienPos = new THREE.Vector3();
//       alien.getWorldPosition(alienPos);

//       const x = centerX + (alienPos.x - playerPos.x) * (minimap.width / mapSize);
//       const y = centerY + (alienPos.z - playerPos.z) * (minimap.height / mapSize);

//       if (x >= 0 && x <= minimap.width && y >= 0 && y <= minimap.height) {
//         ctx.beginPath();
//         ctx.arc(x, y, 3, 0, Math.PI * 2);
//         ctx.fill();
//       }
//     });
//   }

//   // Draw alien dogs (orange) - ACCESS THROUGH SYSTEM
//   if (alienDogSystem) {
//     ctx.fillStyle = "#ff8800"; // Orange for alien dogs
//     alienDogSystem.alienDogLickers.forEach((alienDog) => {
//       if (!alienDog.userData.alive) return;

//       const alienDogPos = new THREE.Vector3();
//       alienDog.getWorldPosition(alienDogPos);

//       const x = centerX + (alienDogPos.x - playerPos.x) * (minimap.width / mapSize);
//       const y = centerX + (alienDogPos.z - playerPos.z) * (minimap.height / mapSize);

//       if (x >= 0 && x <= minimap.width && y >= 0 && y <= minimap.height) {
//         ctx.beginPath();
//         ctx.arc(x, y, 3, 0, Math.PI * 2);
//         ctx.fill();
//       }
//     });
//   }

//   // Draw bounties (yellow) - ACCESS THROUGH SYSTEM
//   if (bountySystem) {
//     ctx.fillStyle = "#ffff00";
//     bountySystem.bounties.forEach((bounty) => {
//       const bountyPos = new THREE.Vector3();
//       bounty.getWorldPosition(bountyPos);

//       const x = centerX + (bountyPos.x - playerPos.x) * (minimap.width / mapSize);
//       const y = centerY + (bountyPos.z - playerPos.z) * (minimap.height / mapSize);

//       if (x >= 0 && x <= minimap.width && y >= 0 && y <= minimap.height) {
//         ctx.fillRect(x - 2, y - 2, 4, 4);
//       }
//     });
//   }
// }

// export function createPauseOverlay() {
//   const overlay = document.createElement("div");
//   overlay.id = "pauseOverlay";
//   overlay.style.cssText = `
//     position: fixed;
//     top: 0;
//     left: 0;
//     width: 100%;
//     height: 100%;
//     background: rgba(0, 0, 0, 0.7);
//     color: white;
//     display: none;
//     flex-direction: column;
//     justify-content: center;
//     align-items: center;
//     z-index: 2000;
//     font-family: Arial, sans-serif;
//     text-align: center;
//     cursor: default;
//   `;

//   overlay.innerHTML = `
//     <h1 style="font-size: 48px; margin-bottom: 20px;">PAUSED</h1>
//     <p style="font-size: 24px; margin-bottom: 30px;">Press P to resume</p>
//     <div style="font-size: 18px; color: #ccc;">
//       <p>Health: ${playerHealth}</p>
//       <p>Score: $${playerScore}</p>
//       <p>Ammo: ${playerAmmo}/${maxAmmo}</p>
//     </div>
//   `;

//   document.body.appendChild(overlay);
//   return overlay;
// }

// export function gameOver(controls, renderer) {
//   // Display game over screen
//   const gameOverScreen = document.createElement("div");
//   gameOverScreen.id = "game-over";
//   gameOverScreen.style.cssText = `
//     position: fixed;
//     top: 0;
//     left: 0;
//     width: 100%;
//     height: 100%;
//     background: rgba(0, 0, 0, 0.9);
//     color: white;
//     display: flex;
//     flex-direction: column;
//     justify-content: center;
//     align-items: center;
//     z-index: 2000;
//     font-family: Arial, sans-serif;
//     text-align: center;
//   `;

//   gameOverScreen.innerHTML = `
//     <h1 style="font-size: 48px; color: #ff0000;">GAME OVER</h1>
//     <p style="font-size: 24px;">Final Score: $${playerScore}</p>
//     <p style="font-size: 18px; margin-top: 20px;">Aliens Eliminated: ${Math.floor(
//       playerScore / BOUNTY_VALUE
//     )}</p>
//     <button id="restart-button" style="margin-top: 30px; padding: 15px 30px; font-size: 20px; background: #00ff00; border: none; border-radius: 5px; cursor: pointer;">
//       Restart Game
//     </button>
//   `;

//   document.body.appendChild(gameOverScreen);

//   controls.enabled = false;
//   // Show cursor
//   document.body.style.cursor = "default";

//   // Exit pointer lock
//   if (document.pointerLockElement === renderer.domElement) {
//     document.exitPointerLock();
//   }

//   // Add restart functionality
//   const restartButton = document.getElementById("restart-button");
//   restartButton.addEventListener("click", () => {
//     location.reload();
//   });

//   // Disable controls
//   controls.enabled = false;
// }

// export function createCardCollectionUI() {
//   const cardUI = document.createElement('div');
//   cardUI.id = 'card-collection-ui';
//   cardUI.style.cssText = `
//     position: fixed;
//     top: 30px;
//     left: 48px;
//     background: rgba(0, 0, 0, 0.85);
//     color: white;
//     padding: 2px 0px 2px 28px;
//     font-family: Arial, sans-serif;
//     z-index: 1000;
//     border: 2px solid rgb(51, 51, 51);
//     box-shadow: rgba(0, 0, 0, 0.5) 0px 4px 12px;
//     backdrop-filter: blur(5px);
//   `;
  
//   cardUI.innerHTML = `
    
//     <div style="display: flex; gap: 5px;">
//       <div id="card1-container" class="card-container" style="background: rgba(255, 0, 0, 0.2); padding: 8px; border: 1px solid rgba(255, 0, 0, 0.5);">
//         <div id="card1-count" style="font-size: x-small; font-weight: bold; color: #ff6666;">0</div>
//       </div>
      
//       <div id="card2-container" class="card-container" style="background: rgba(0, 255, 0, 0.2); padding: 8px; border: 1px solid rgba(0, 255, 0, 0.5);">
//         <div id="card2-count" style="font-size: x-small; font-weight: bold; color: #66ff66;">0</div>
//       </div>
      
//       <div id="card3-container" class="card-container" style="background: rgba(0, 0, 255, 0.2); padding: 8px; border: 1px solid rgba(0, 0, 255, 0.5);">
//         <div id="card3-count" style="font-size: x-small; font-weight: bold; color: #6666ff;">0</div>
//       </div>
      
//       <div id="card4-container" class="card-container" style="background: rgba(255, 255, 0, 0.2); padding: 8px; border: 1px solid rgba(255, 255, 0, 0.5);">
//         <div id="card4-count" style="font-size: x-small; font-weight: bold; color: #ffff66;">0</div>
//       </div>
      
//       <div id="card5-container" class="card-container" style="background: rgba(255, 0, 255, 0.2); padding: 8px; border: 1px solid rgba(255, 0, 255, 0.5); grid-column: span 2;">
//         <div id="card5-count" style="font-size: x-small; font-weight: bold; color: #ff66ff;">0</div>
//       </div>
//     </div>
    
//     <div id="set-status" style="
//       border-radius: 6px;
//       transition: all 0.3s;
//       display: flex;
//       align-items: center;
//       gap: 10px;
//     ">
//       <div style="font-size: x-small; color: #aaa;">SET COMPLETION</div>
//       <div id="set-progress" style="
//         font-size: x-small;
//         font-weight: bold;
//         margin: 5px 0;
//         color: #ff9900;
//       ">0/5 Cards</div>
//       <div id="set-complete" style="
//         font-size: x-small;
//         color: #ff4444;
//         display: none;
//       ">⚠️ INCOMPLETE</div>
//     </div>
//   `;
  
//   document.body.appendChild(cardUI);
//   return cardUI;
// }

// export function updateCardCollectionUI(bountySystem) {
//   if (!bountySystem) return;
  
//   const status = bountySystem.getCollectionStatus();
  
//   // Update card counts
//   for (let i = 1; i <= 5; i++) {
//     const countElement = document.getElementById(`card${i}-count`);
//     const containerElement = document.getElementById(`card${i}-container`);
//     const count = status[`card${i}`] || 0;
    
//     if (countElement) {
//       countElement.textContent = count;
      
//       // Add animation when card count increases
//       if (count > 0) {
//         countElement.style.transform = 'scale(1.1)';
//         setTimeout(() => {
//           countElement.style.transform = 'scale(1)';
//         }, 200);
//       }
//     }
    
//     // Highlight collected cards
//     if (containerElement && count > 0) {
//       containerElement.style.boxShadow = '0 0 10px currentColor';
//       containerElement.style.animation = 'pulse 2s infinite';
//     } else if (containerElement) {
//       containerElement.style.boxShadow = 'none';
//       containerElement.style.animation = 'none';
//     }
//   }
  
//   // Update progress
//   const totalCollected = Object.values(status)
//     .filter((val, idx) => idx < 5) // Only card counts
//     .reduce((a, b) => a + b, 0);
  
//   const uniqueCards = Object.values(status)
//     .filter((val, idx) => idx < 5)
//     .filter(count => count > 0).length;
  
//   const progressElement = document.getElementById('set-progress');
//   const completeElement = document.getElementById('set-complete');
//   const setStatusElement = document.getElementById('set-status');
  
//   if (progressElement) {
//     progressElement.textContent = `${uniqueCards}/5 Cards`;
//   }
  
//   if (completeElement && setStatusElement) {
//     if (status.hasCompleteSet) {
//       // Complete set achieved
//       completeElement.textContent = '✅ COMPLETE!';
//       completeElement.style.color = '#00ff00';
//       completeElement.style.display = 'block';
//       setStatusElement.style.borderColor = '#00ff00';
//       setStatusElement.style.boxShadow = '0 0 15px rgba(0, 255, 0, 0.5)';
      
//       // Add celebration animation
//       setStatusElement.style.animation = 'celebrate 1s ease-in-out';
      
//       // Add CSS animation for celebration
//       if (!document.getElementById('celebration-style')) {
//         const style = document.createElement('style');
//         style.id = 'celebration-style';
//         style.textContent = `
//           @keyframes celebrate {
//             0% { transform: scale(1); }
//             50% { transform: scale(1.05); }
//             100% { transform: scale(1); }
//           }
//           @keyframes pulse {
//             0% { opacity: 0.8; }
//             50% { opacity: 1; }
//             100% { opacity: 0.8; }
//           }
//         `;
//         document.head.appendChild(style);
//       }
//     } else {
//       // Incomplete
//       completeElement.textContent = '⚠️ INCOMPLETE';
//       completeElement.style.color = '#ff4444';
//       // completeElement.style.display = 'block';
//       setStatusElement.style.borderColor = '#444';
//       setStatusElement.style.boxShadow = 'none';
//       setStatusElement.style.animation = 'none';
//     }
//   }
  
//   // Add pulse animation for newly collected cards
//   if (!document.getElementById('card-ui-styles')) {
//     const style = document.createElement('style');
//     style.id = 'card-ui-styles';
//     style.textContent = `
//       @keyframes pulse {
//         0% { transform: scale(1); box-shadow: 0 0 5px currentColor; }
//         50% { transform: scale(1.05); box-shadow: 0 0 15px currentColor; }
//         100% { transform: scale(1); box-shadow: 0 0 5px currentColor; }
//       }
//       .card-container {
//         transition: all 0.3s ease;
//       }
//       .card-container:hover {
//         transform: translateY(-2px);
//       }
//     `;
//     document.head.appendChild(style);
//   }
// }

// export function showCardNotification(cardNumber, cardName = "") {
//   // Create a floating notification for collected card
//   const notification = document.createElement('div');
//   notification.className = 'card-notification';
  
//   const cardNames = ["Access Key", "Security Pass", "Data Crystal", "Power Core", "Control Chip"];
//   const name = cardName || cardNames[cardNumber - 1] || `Card ${cardNumber}`;
  
//   notification.innerHTML = `
//     <div style="display: flex; align-items: center; gap: 10px;">
//       <div style="
//         width: 30px;
//         height: 40px;
//         background: ${getCardColor(cardNumber)};
//         border-radius: 4px;
//         border: 2px solid white;
//         position: relative;
//       ">
//         <div style="
//           position: absolute;
//           top: 50%;
//           left: 50%;
//           transform: translate(-50%, -50%);
//           color: white;
//           font-weight: bold;
//           font-size: 16px;
//         ">${cardNumber}</div>
//       </div>
//       <div>
//         <div style="font-size: 14px; color: #aaa;">CARD COLLECTED</div>
//         <div style="font-size: 18px; color: white; font-weight: bold;">${name}</div>
//       </div>
//     </div>
//   `;
  
//   notification.style.cssText = `
//     position: fixed;
//     top: 100px;
//     right: 20px;
//     background: rgba(0, 0, 0, 0.9);
//     padding: 15px;
//     border-radius: 10px;
//     border-left: 5px solid ${getCardColor(cardNumber)};
//     z-index: 2000;
//     animation: slideInRight 0.5s ease-out, fadeOut 0.5s ease-in 2.5s forwards;
//     box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
//   `;
  
//   // Add animation styles
//   if (!document.getElementById('notification-styles')) {
//     const style = document.createElement('style');
//     style.id = 'notification-styles';
//     style.textContent = `
//       @keyframes slideInRight {
//         from {
//           transform: translateX(100%);
//           opacity: 0;
//         }
//         to {
//           transform: translateX(0);
//           opacity: 1;
//         }
//       }
//       @keyframes fadeOut {
//         to {
//           opacity: 0;
//           transform: translateX(100%);
//         }
//       }
//     `;
//     document.head.appendChild(style);
//   }
  
//   document.body.appendChild(notification);
  
//   // Remove after animation completes
//   setTimeout(() => {
//     if (notification.parentNode) {
//       document.body.removeChild(notification);
//     }
//   }, 3000);
// }

// function getCardColor(cardNumber) {
//   const colors = [
//     '#ff4444', // Card 1 - Red
//     '#44ff44', // Card 2 - Green
//     '#4444ff', // Card 3 - Blue
//     '#ffff44', // Card 4 - Yellow
//     '#ff44ff'  // Card 5 - Purple
//   ];
//   return colors[cardNumber - 1] || '#ffffff';
// }

// ui.js
import * as THREE from "three";

// UI elements
let healthBar = null;
let scoreDisplay = null;
let minimap = null;
let minimapCtx = null;
let crosshair = null;
let doorPrompt = null;
let pauseOverlay = null;
let cardCollectionUI = null;

// Store reference to world
let worldInstance = null;

export function setWorldInstance(world) {
    worldInstance = world;
}

export function createCrosshair() {
    crosshair = document.createElement('div');
    crosshair.id = 'crosshair';
    crosshair.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 20px;
        height: 20px;
        border: 2px solid white;
        border-radius: 50%;
        pointer-events: none;
        z-index: 1000;
        display: none;
    `;
    document.body.appendChild(crosshair);
    return crosshair;
}

export function createDoorPromptUI() {
    doorPrompt = document.createElement('div');
    doorPrompt.id = 'door-prompt';
    doorPrompt.style.cssText = `
        position: fixed;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        font-family: Arial, sans-serif;
        font-size: 16px;
        border: 2px solid #ffaa00;
        display: none;
        z-index: 1000;
        pointer-events: none;
    `;
    doorPrompt.innerHTML = 'Press <span style="color: #ffaa00; font-weight: bold;">O</span> to open door';
    document.body.appendChild(doorPrompt);
    return doorPrompt;
}

export function createPauseOverlay() {
    pauseOverlay = document.createElement('div');
    pauseOverlay.id = 'pause-overlay';
    pauseOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: none;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        color: white;
        font-family: Arial, sans-serif;
        font-size: 48px;
        flex-direction: column;
    `;
    pauseOverlay.innerHTML = `
        <div>PAUSED</div>
        <div style="font-size: 24px; margin-top: 20px;">Press P to resume</div>
    `;
    document.body.appendChild(pauseOverlay);
    return pauseOverlay;
}

export function createGameUI() {
    // Health Bar
    healthBar = document.createElement('div');
    healthBar.id = 'health-bar';
    healthBar.style.cssText = `
        position: fixed;
        top: 20px;
        left: 20px;
        width: 200px;
        height: 20px;
        background: rgba(0, 0, 0, 0.5);
        border: 2px solid white;
        border-radius: 10px;
        overflow: hidden;
        z-index: 1000;
    `;
    
    const healthFill = document.createElement('div');
    healthFill.id = 'health-fill';
    healthFill.style.cssText = `
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, #ff0000, #ff5555);
        transition: width 0.3s;
    `;
    healthBar.appendChild(healthFill);
    document.body.appendChild(healthBar);

    // Score Display
    scoreDisplay = document.createElement('div');
    scoreDisplay.id = 'score-display';
    scoreDisplay.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        color: white;
        font-family: Arial, sans-serif;
        font-size: 24px;
        font-weight: bold;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
        z-index: 1000;
    `;
    scoreDisplay.innerHTML = 'Score: 0';
    document.body.appendChild(scoreDisplay);

    // Minimap
    minimap = document.createElement('canvas');
    minimap.id = 'minimap';
    minimap.width = 200;
    minimap.height = 200;
    minimap.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 200px;
        height: 200px;
        background: rgba(0, 0, 0, 0.5);
        border: 2px solid white;
        border-radius: 10px;
        z-index: 1000;
    `;
    document.body.appendChild(minimap);
    minimapCtx = minimap.getContext('2d');
}

export function createCardCollectionUI() {
    cardCollectionUI = document.createElement('div');
    cardCollectionUI.id = 'card-collection';
    cardCollectionUI.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: rgba(0, 0, 0, 0.7);
        border: 2px solid gold;
        border-radius: 10px;
        padding: 10px;
        color: white;
        font-family: Arial, sans-serif;
        z-index: 1000;
        display: none;
    `;
    cardCollectionUI.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 5px;">Bounty Cards</div>
        <div id="card-slots"></div>
    `;
    document.body.appendChild(cardCollectionUI);
}

export function updateCardCollectionUI(bountySystem) {
    if (!bountySystem || !cardCollectionUI) return;
    
    const cardSlots = document.getElementById('card-slots');
    if (!cardSlots) return;
    
    const collected = bountySystem.getCollectedCards();
    let html = '';
    
    for (let i = 1; i <= 5; i++) {
        const isCollected = collected.has(i);
        html += `<div style="margin: 5px; padding: 5px; border: 1px solid ${isCollected ? 'gold' : 'gray'}; border-radius: 5px; background: ${isCollected ? 'rgba(255,215,0,0.2)' : 'rgba(128,128,128,0.2)'}">
            Card ${i}: ${isCollected ? '✓' : '✗'}
        </div>`;
    }
    
    cardSlots.innerHTML = html;
    cardCollectionUI.style.display = 'block';
}

export function showCardNotification(title, message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.9);
        border: 2px solid gold;
        border-radius: 10px;
        padding: 20px;
        color: white;
        font-family: Arial, sans-serif;
        text-align: center;
        z-index: 10000;
        animation: fadeInOut 3s ease-in-out;
    `;
    notification.innerHTML = `
        <div style="font-size: 24px; font-weight: bold; margin-bottom: 10px;">${title}</div>
        <div style="font-size: 16px;">${message}</div>
    `;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeInOut {
            0% { opacity: 0; transform: translate(-50%, -60%); }
            10% { opacity: 1; transform: translate(-50%, -50%); }
            90% { opacity: 1; transform: translate(-50%, -50%); }
            100% { opacity: 0; transform: translate(-50%, -40%); }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        document.body.removeChild(notification);
        document.head.removeChild(style);
    }, 3000);
}

export function updateHealthBar() {
    if (!healthBar || !worldInstance) return;
    const healthFill = document.getElementById('health-fill');
    if (healthFill) {
        const healthPercent = (worldInstance.playerHealth / 100) * 100;
        healthFill.style.width = `${Math.max(0, healthPercent)}%`;
        
        // Change color based on health
        if (healthPercent > 60) {
            healthFill.style.background = 'linear-gradient(90deg, #00ff00, #55ff55)';
        } else if (healthPercent > 30) {
            healthFill.style.background = 'linear-gradient(90deg, #ffff00, #ffff55)';
        } else {
            healthFill.style.background = 'linear-gradient(90deg, #ff0000, #ff5555)';
        }
    }
}

export function updateScoreDisplay() {
    if (!scoreDisplay || !worldInstance) return;
    scoreDisplay.innerHTML = `Score: ${worldInstance.playerScore}`;
}

// In ui.js - updateMinimap function
export function updateMinimap(player) {
    if (!minimapCtx || !player) return;
    
    // Check if player has position
    if (!player.position) {
        console.warn("Player has no position for minimap");
        return;
    }
    
    const ctx = minimapCtx;
    const width = minimap.width;
    const height = minimap.height;
    
    // Clear minimap
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, width, height);
    
    // Draw buildings (simplified as squares)
    ctx.fillStyle = '#666';
    if (worldInstance && worldInstance.allBuildings) {
        worldInstance.allBuildings.forEach(building => {
            if (building && building.position) {
                const pos = building.position;
                // Convert world position to minimap coordinates
                const x = (pos.x / 200) * width + width/2;
                const y = (pos.z / 200) * height + height/2;
                ctx.fillRect(x - 2, y - 2, 4, 4);
            }
        });
    }
    
    // Draw player
    ctx.fillStyle = '#00ff00';
    const playerX = (player.position.x / 200) * width + width/2;
    const playerY = (player.position.z / 200) * height + height/2;
    ctx.beginPath();
    ctx.arc(playerX, playerY, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw player direction if rotation exists
    if (player.rotation) {
        ctx.strokeStyle = '#00ff00';
        ctx.beginPath();
        ctx.moveTo(playerX, playerY);
        const dirX = playerX + Math.sin(player.rotation.y || 0) * 10;
        const dirY = playerY + Math.cos(player.rotation.y || 0) * 10;
        ctx.lineTo(dirX, dirY);
        ctx.stroke();
    }
}

export function gameOver(controls, renderer) {
    // Show game over screen
    const gameOverScreen = document.createElement('div');
    gameOverScreen.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        color: white;
        font-family: Arial, sans-serif;
        flex-direction: column;
    `;
    gameOverScreen.innerHTML = `
        <div style="font-size: 48px; font-weight: bold; color: #ff0000; margin-bottom: 20px;">GAME OVER</div>
        <div style="font-size: 24px; margin-bottom: 10px;">Final Score: ${worldInstance ? worldInstance.playerScore : 0}</div>
        <div style="font-size: 18px; color: #888;">Refresh the page to play again</div>
    `;
    document.body.appendChild(gameOverScreen);
    
    // Disable controls
    if (controls) controls.enabled = false;
    if (renderer) renderer.domElement.style.pointerEvents = 'none';
}