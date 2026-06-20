// ============================================
// MOBILE CONTROLS SYSTEM
// Virtual Joystick + Action Buttons
// ============================================

export class MobileControls {
  constructor(controls) {
    this.controls = controls;
    this.enabled = this.isMobileDevice();
    this.joystick = null;
    this.joystickData = {
      active: false,
      x: 0,
      y: 0,
      angle: 0,
      distance: 0,
    };

    this.buttons = {
      shoot: false,
      jump: false,
      sprint: false,
      reload: false,
      nextWeapon: false,
      prevWeapon: false,
      weaponWheel: false,
      collect: false,
      aim: false,
    };

    this.touches = new Map();
    this.joystickTouch = null;
    this.weaponWheelActive = false;
    this.selectedWeaponIndex = 0;

    this.config = {
      joystickSize: 120,
      joystickStickSize: 50,
      joystickMaxDistance: 50,
      buttonSize: 30,
      buttonGap: 10,
    };

    // Add these camera rotation properties
    this.targetCameraRotation = { x: 0, y: 0.3 };
    this.currentCameraRotation = { x: 0, y: 0.3 };
    this.cameraSmoothingFactor = 0.15;
    this.cameraRotationSensitivity = 0.005;
  }

  isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );
  }

  // MOVE createImageButton HERE - BEFORE it's used in createActionButtons
  createImageButton(id, imgPath, size) {
    const button = document.createElement("div");
    button.id = `mobile-btn-${id}`;
    button.className = "mobile-action-button";
    button.setAttribute("data-action", id);
    button.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      background: rgba(0, 0, 0, 0.65);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.08s linear;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      touch-action: none;
      -webkit-tap-highlight-color: transparent;
      border: 2px solid rgba(255, 255, 255, 0.4);
      backdrop-filter: blur(8px);
      position: relative;
      z-index: 10001;
    `;

    const img = document.createElement("img");
    img.src = imgPath;
    img.style.cssText = `
      width: ${size * 0.55}px;
      height: ${size * 0.55}px;
      object-fit: contain;
      pointer-events: none;
      filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
    `;
    button.appendChild(img);

    // Active state
    button.addEventListener("touchstart", (e) => {
      e.preventDefault();
      button.style.transform = "scale(0.88)";
      button.style.background = "rgba(255, 255, 255, 0.4)";
    });

    button.addEventListener("touchend", (e) => {
      e.preventDefault();
      button.style.transform = "scale(1)";
      button.style.background = "rgba(0, 0, 0, 0.65)";
    });

    button.addEventListener("touchcancel", (e) => {
      e.preventDefault();
      button.style.transform = "scale(1)";
      button.style.background = "rgba(0, 0, 0, 0.65)";
    });

    return button;
  }

  init() {
    if (!this.enabled) return;

    console.log("Initializing mobile controls...");

    if (this.controls) {
      this.controls.isMobile = true;
      this.controls.enabled = true;

      if (this.controls.unlockButton) {
        this.controls.unlockButton.onclick = null;
      }

      const blocker = document.getElementById("blocker");
      const instructions = document.getElementById("instructions");
      if (blocker) blocker.style.display = "none";
      if (instructions) instructions.style.display = "none";

      const startGameDiv = document.getElementById("startGame");
      if (startGameDiv) startGameDiv.style.display = "none";

      // Initialize camera rotation on mobile
      if (this.controls.cameraRotation) {
        this.controls.cameraRotation.x = 0; // Horizontal
        this.controls.cameraRotation.y = 0.3; // Vertical (slightly down)
      }
    }

    this.createJoystick();
    this.createActionButtons();
    this.createWeaponWheelOverlay();
    this.createCameraRotationOverlay();
    this.setupTouchEvents();
    this.setupKeyboardProxy();

    document.body.style.cursor = "none";
    this.autoStartGame();
  }

  createActionButtons() {
    const buttonContainer = document.createElement("div");
    buttonContainer.id = "mobile-action-buttons";
    buttonContainer.style.cssText = `
      position: fixed;
      bottom: 30px;
      left: 30px;
      width: 200px;
      height: 200px;
      z-index: 10000;
      touch-action: none;
      pointer-events: auto;
    `;

    const shootSize = 85;
    const smallSize = 55;

    // Create shoot button (bottom-left corner)
    const shootBtn = this.createImageButton(
      "shoot",
      "/assets/ui/shoot.png",
      shootSize,
    );
    shootBtn.style.position = "absolute";
    shootBtn.style.left = `0px`;
    shootBtn.style.bottom = `0px`;
    buttonContainer.appendChild(shootBtn);

    // Small buttons with exact positions
    const buttons = [
      {
        id: "reload",
        img: "/assets/ui/reload.png",
        size: smallSize,
        left: 0,
        top: 37.5,
      },
      {
        id: "jump",
        img: "/assets/ui/jump.png",
        size: smallSize,
        left: 102.5,
        bottom: 0,
      },
      {
        id: "sprint",
        img: "/assets/ui/sprint.png",
        size: smallSize,
        left: 78,
        top: 55.5,
      },
      {
        id: "weaponWheel",
        img: "/assets/ui/switch.png",
        size: smallSize,
        right: -30,
        bottom: 0,
      },
      {
        id: "collect",
        img: "/assets/ui/collect.png",
        size: 50,
        right: -20,
        bottom: 65,
      },
      {
        id: "aim",
        img: "/assets/ui/aim.png", // or any sight icon
        size: 70,
        left: 0, // position left of shoot button
        top: -40,
      },
    ];

    buttons.forEach((btn) => {
      const button = this.createImageButton(btn.id, btn.img, btn.size);
      button.style.position = "absolute";
      button.style.left = btn.left !== undefined ? `${btn.left}px` : "auto";
      button.style.right = btn.right !== undefined ? `${btn.right}px` : "auto";
      if (btn.top !== undefined) {
        button.style.top = `${btn.top}px`;
      }
      if (btn.bottom !== undefined) {
        button.style.bottom = `${btn.bottom}px`;
      }

      // Add running indicator for sprint button
      if (btn.id === "sprint") {
        this.addRunningIndicator(button);
      }

      buttonContainer.appendChild(button);
    });

    document.body.appendChild(buttonContainer);
  }

  // Add running indicator to sprint button
  addRunningIndicator(button) {
    const indicator = document.createElement("div");
    indicator.className = "sprint-indicator";
    indicator.style.cssText = `
      position: absolute;
      bottom: -8px;
      right: -8px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #ffaa00;
      display: none;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
      color: #000;
      box-shadow: 0 0 5px rgba(255,170,0,0.5);
      animation: sprintPulse 0.8s infinite;
    `;
    indicator.textContent = "⚡";
    button.style.position = "relative";
    button.appendChild(indicator);
    button.dataset.indicator = indicator;
  }

  createWeaponWheelOverlay() {
    if (document.getElementById("mobile-weapon-wheel")) return;

    const overlay = document.createElement("div");
    overlay.id = "mobile-weapon-wheel";
    overlay.style.cssText = `
        position: fixed; inset: 0;
        display: none; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.75);
        z-index: 20000;
        touch-action: none;
        pointer-events: auto;
    `;

    const wrapper = document.createElement("div");
    wrapper.style.cssText = "position: relative; width: 360px; height: 360px;";

    const canvas = document.createElement("canvas");
    canvas.id = "mobile-ww-canvas";
    canvas.width = 360;
    canvas.height = 360;
    canvas.style.cssText = "position: absolute; inset: 0;";
    wrapper.appendChild(canvas);

    const centerLabel = document.createElement("div");
    centerLabel.id = "mobile-ww-center";
    centerLabel.style.cssText = `
        position: absolute; top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        text-align: center; width: 140px; pointer-events: none;
    `;
    centerLabel.innerHTML = `
        <div id="mobile-ww-name" style="font-size: 14px; font-weight: 500; color: #ffaa00; line-height: 1.3;"></div>
        <div id="mobile-ww-ammo" style="font-size: 11px; color: rgba(255,255,255,0.7); margin-top: 3px;"></div>
    `;
    wrapper.appendChild(centerLabel);

    const hint = document.createElement("div");
    hint.style.cssText = `
        position: absolute; bottom: -40px; left: 0; right: 0;
        text-align: center; font-size: 12px; color: rgba(255,255,255,0.6);
        font-family: sans-serif;
        background: rgba(0,0,0,0.5);
        padding: 5px;
        border-radius: 8px;
    `;
    hint.textContent = "Tap a weapon to equip";
    wrapper.appendChild(hint);

    overlay.appendChild(wrapper);
    document.body.appendChild(overlay);

    this.wwOverlay = overlay;
    this.wwCanvas = canvas;
    this.wwCtx = canvas.getContext("2d");
    this.weaponWheelOpen = false;
    this.wwSelected = 0;
  }

  showWeaponWheel() {
    if (!this.controls || !this.controls.player) return;

    const weapons = this.controls.player.weapons;
    if (!weapons || weapons.length === 0) return;

    // Set the selected index to the current weapon
    this.wwSelected = this.controls.player.currentWeaponIndex;

    this.weaponWheelOpen = true;
    this.wwOverlay.style.display = "flex";

    // Draw the weapon wheel
    this.drawWeaponWheel();

    // Add touch/click listeners for weapon selection
    this.setupWheelTouchListeners();
  }

  hideWeaponWheel() {
    this.weaponWheelOpen = false;
    this.wwOverlay.style.display = "none";
    this.removeWheelTouchListeners();
  }

  drawWeaponWheel() {
    if (!this.wwCtx || !this.controls || !this.controls.player) return;

    const weapons = this.controls.player.weapons;
    const n = weapons.length;
    const ctx = this.wwCtx;
    const W = 360,
      H = 360,
      cx = W / 2,
      cy = H / 2;
    const outerR = 155,
      innerR = 65;

    ctx.clearRect(0, 0, W, H);

    const colors = [
      "#378ADD",
      "#D85A30",
      "#639922",
      "#7F77DD",
      "#D4537E",
      "#BA7517",
      "#E24B4A",
      "#1D9E75",
      "#888780",
    ];

    for (let i = 0; i < n; i++) {
      const startAngle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const endAngle = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
      const isSelected = i === this.wwSelected;
      const midAngle = (startAngle + endAngle) / 2;
      const color = colors[i % colors.length];

      ctx.beginPath();
      ctx.moveTo(
        cx + Math.cos(startAngle) * innerR,
        cy + Math.sin(startAngle) * innerR,
      );
      ctx.arc(cx, cy, outerR + (isSelected ? 14 : 0), startAngle, endAngle);
      ctx.arc(cx, cy, innerR, endAngle, startAngle, true);
      ctx.closePath();

      ctx.fillStyle = isSelected ? color : `rgba(0, 0, 0, 0.7)`;
      ctx.fill();
      ctx.strokeStyle = isSelected ? "#ffaa00" : "rgba(255,255,255,0.3)";
      ctx.lineWidth = isSelected ? 3 : 1;
      ctx.stroke();

      // Draw weapon icon/name on the wheel
      const labelR = (outerR + innerR) / 2 + (isSelected ? 7 : 0);
      const lx = cx + Math.cos(midAngle) * labelR;
      const ly = cy + Math.sin(midAngle) * labelR;

      ctx.save();
      ctx.translate(lx, ly);

      // Try to draw weapon image if available
      const weaponName = weapons[i].name;
      ctx.fillStyle = isSelected ? "#ffaa00" : "#ffffff";
      ctx.font = `${isSelected ? "bold 12px" : "11px"} sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Shorten weapon name if too long
      let displayName = weaponName;
      if (weaponName.length > 12) {
        displayName = weaponName.substring(0, 10) + "...";
      }
      ctx.fillText(displayName, 0, -8);

      // Draw ammo count
      ctx.fillStyle = isSelected ? "#ffaa00" : "rgba(255,255,255,0.7)";
      ctx.font = "9px monospace";
      ctx.fillText(`${weapons[i].ammo}/${weapons[i].maxAmmo}`, 0, 8);

      ctx.restore();
    }

    // inner circle
    ctx.beginPath();
    ctx.arc(cx, cy, innerR - 2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.8)";
    ctx.fill();
    ctx.strokeStyle = "#ffaa00";
    ctx.lineWidth = 2;
    ctx.stroke();

    // UPDATE center label with the selected weapon (current selection)
    const selectedWeapon = weapons[this.wwSelected];
    if (selectedWeapon) {
      const centerName = document.getElementById("mobile-ww-name");
      const centerAmmo = document.getElementById("mobile-ww-ammo");
      if (centerName) {
        centerName.textContent = selectedWeapon.name;
      }
      if (centerAmmo) {
        const ammoStr = `${selectedWeapon.ammo} / ${selectedWeapon.maxAmmo}`;
        centerAmmo.textContent = selectedWeapon.isReloading
          ? "Reloading..."
          : ammoStr;
      }
    }
  }

  setupWheelTouchListeners() {
    // Remove any existing listeners first
    this.removeWheelTouchListeners();

    // Add touch listener to the canvas for weapon selection
    this.wheelTouchHandler = (e) => {
      e.preventDefault();
      const rect = this.wwCanvas.getBoundingClientRect();
      const scaleX = this.wwCanvas.width / rect.width;
      const scaleY = this.wwCanvas.height / rect.height;

      let clientX, clientY;

      if (e.touches) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      const canvasX = (clientX - rect.left) * scaleX;
      const canvasY = (clientY - rect.top) * scaleY;

      this.checkWheelSelection(canvasX, canvasY);
    };

    this.wwCanvas.addEventListener("touchstart", this.wheelTouchHandler, {
      passive: false,
    });
    this.wwCanvas.addEventListener("click", this.wheelTouchHandler);

    // Close on background click
    this.wwOverlayBgHandler = (e) => {
      if (e.target === this.wwOverlay) {
        this.hideWeaponWheel();
      }
    };
    this.wwOverlay.addEventListener("click", this.wwOverlayBgHandler);
  }

  removeWheelTouchListeners() {
    if (this.wheelTouchHandler) {
      this.wwCanvas.removeEventListener("touchstart", this.wheelTouchHandler);
      this.wwCanvas.removeEventListener("click", this.wheelTouchHandler);
      this.wheelTouchHandler = null;
    }
    if (this.wwOverlayBgHandler) {
      this.wwOverlay.removeEventListener("click", this.wwOverlayBgHandler);
      this.wwOverlayBgHandler = null;
    }
  }

  checkWheelSelection(canvasX, canvasY) {
    const cx = 180,
      cy = 180; // Center of canvas (360/2)
    const dx = canvasX - cx;
    const dy = canvasY - cy;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const outerR = 155;
    const innerR = 65;

    // Check if click is within the wheel area
    if (distance >= innerR && distance <= outerR + 14) {
      const angle = Math.atan2(dy, dx);
      let angleDeg = ((angle * 180) / Math.PI + 90 + 360) % 360;

      const weapons = this.controls.player.weapons;
      const n = weapons.length;
      const sliceAngle = 360 / n;

      let selectedIndex = Math.floor(angleDeg / sliceAngle) % n;

      if (selectedIndex >= 0 && selectedIndex < n) {
        this.selectWeaponFromWheel(selectedIndex);
      }
    }
  }

  selectWeaponFromWheel(index) {
    if (this.controls && this.controls.player) {
      const weapon = this.controls.player.weapons[index];
      if (weapon) {
        // Switch weapon
        this.controls.player.switchWeapon(index, true);

        // Update the selected index for when wheel is reopened
        this.wwSelected = index;

        // Update the center label if wheel is still open (should close after selection)
        const centerName = document.getElementById("mobile-ww-name");
        const centerAmmo = document.getElementById("mobile-ww-ammo");
        if (centerName) centerName.textContent = weapon.name;
        if (centerAmmo)
          centerAmmo.textContent = `${weapon.ammo}/${weapon.maxAmmo}`;

        this.showNotification(`Equipped ${weapon.name}`, "#ffaa00");
      }
    }
    this.hideWeaponWheel();
  }

  autoStartGame() {
    const startBtn = document.getElementById("btnStart");
    if (startBtn) {
      setTimeout(() => {
        startBtn.click();
      }, 500);
    }
  }

  setupKeyboardProxy() {
    window.addEventListener("mobileButtonPress", (e) => {
      const { action, pressed, toggle } = e.detail;

      if (toggle && action === "sprint") {
        // For sprint toggle, just update the controls isRunning state
        if (this.controls) {
          this.controls.isRunning = pressed;
        }
        return;
      }

      // For non-sprint buttons, directly call the controls methods
      switch (action) {
        case "aim":
          if (this.controls) {
            if (pressed) {
              this.controls.startAiming();
            } else {
              this.controls.stopAiming();
              // Sync mobile smoothing state to current cameraRotation (unchanged by stopAiming)
              if (this.targetCameraRotation && this.controls.cameraRotation) {
                this.targetCameraRotation.x = this.controls.cameraRotation.x;
                this.currentCameraRotation.x = this.controls.cameraRotation.x;
              }
            }
          }
          return;
        case "shoot":
          if (pressed && this.controls && this.controls.isAiming) {
            this.controls.shoot();
          }
          return;
        case "weaponWheel":
          if (pressed && !this.weaponWheelActive) {
            this.showWeaponWheel();
          }
          return;
        case "collect":
          if (pressed) {
            // DIRECT CALL to RoomManager's handleInteraction
            // Instead of dispatching keyboard events, call the room manager directly
            if (window.roomManager) {
              window.roomManager.handleInteraction();
            }
            // Also try to trigger the key event as fallback
            const keyEvent = new KeyboardEvent("keydown", {
              code: "KeyC",
              key: "c",
              bubbles: true,
              cancelable: true,
            });
            document.dispatchEvent(keyEvent);
          }
          return;

        case "jump":
          if (pressed && this.controls) {
            // Directly trigger jump
            if (!this.controls.jumpCooldown) {
              this.controls.velocity.y += 4;
              if (this.controls.player && this.controls.player.modelLoaded) {
                this.controls.player.playJumpAnimation();
              }
              this.controls.jumpCooldown = true;
              setTimeout(() => {
                if (this.controls) this.controls.jumpCooldown = false;
              }, this.controls.jumpCooldownTime || 500);
            }
          }
          return;
        case "reload":
          if (pressed && this.controls) {
            this.controls.reload();
          }
          return;
        case "nextWeapon":
          if (pressed && this.controls && this.controls.player) {
            const nextIndex =
              (this.controls.player.currentWeaponIndex + 1) %
              this.controls.player.weapons.length;
            this.controls.player.switchWeapon(nextIndex, true);
          }
          return;
        case "prevWeapon":
          if (pressed && this.controls && this.controls.player) {
            const prevIndex =
              (this.controls.player.currentWeaponIndex -
                1 +
                this.controls.player.weapons.length) %
              this.controls.player.weapons.length;
            this.controls.player.switchWeapon(prevIndex, true);
          }
          return;
      }
    });
  }

  createJoystick() {
    const container = document.createElement("div");
    container.id = "mobile-joystick-container";
    container.style.cssText = `
      position: fixed;
      bottom: 30px;
      right: 30px;
      width: ${this.config.joystickSize}px;
      height: ${this.config.joystickSize}px;
      background: rgba(255, 255, 255, 0.2);
      border: 3px solid rgba(255, 255, 255, 0.4);
      border-radius: 50%;
      z-index: 10000;
      touch-action: none;
      pointer-events: auto;
      backdrop-filter: blur(5px);
    `;

    const stick = document.createElement("div");
    stick.id = "mobile-joystick-stick";
    stick.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      width: ${this.config.joystickStickSize}px;
      height: ${this.config.joystickStickSize}px;
      background: rgba(255, 255, 255, 0.9);
      border: 2px solid rgba(0, 0, 0, 0.3);
      border-radius: 50%;
      transform: translate(-50%, -50%);
      transition: transform 0.05s linear, background 0.1s;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    `;

    container.appendChild(stick);
    document.body.appendChild(container);

    const rect = container.getBoundingClientRect();

    this.joystick = {
      container,
      stick,
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
    };

    window.addEventListener("resize", () => {
      const newRect = this.joystick.container.getBoundingClientRect();
      this.joystick.centerX = newRect.left + newRect.width / 2;
      this.joystick.centerY = newRect.top + newRect.height / 2;
    });
  }

  createButton(id, label, color, size = null) {
    const btnSize = size || this.config.buttonSize;
    const button = document.createElement("div");
    button.id = `mobile-btn-${id}`;
    button.className = "mobile-action-button";
    button.setAttribute("data-action", id);
    button.style.cssText = `
      width: ${btnSize}px;
      height: ${btnSize}px;
      background: ${color};
      border: 2px solid rgba(255, 255, 255, 0.4);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: ${btnSize * 0.5}px;
      color: white;
      user-select: none;
      cursor: pointer;
      transition: transform 0.1s, box-shadow 0.1s, opacity 0.1s;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
      touch-action: none;
      -webkit-tap-highlight-color: transparent;
    `;
    button.textContent = label;
    return button;
  }

  setupTouchEvents() {
    if (this.joystick) {
      this.joystick.container.addEventListener(
        "touchstart",
        (e) => this.handleJoystickStart(e),
        { passive: false },
      );
      this.joystick.container.addEventListener(
        "touchmove",
        (e) => this.handleJoystickMove(e),
        { passive: false },
      );
      this.joystick.container.addEventListener(
        "touchend",
        (e) => this.handleJoystickEnd(e),
        { passive: false },
      );
      this.joystick.container.addEventListener(
        "touchcancel",
        (e) => this.handleJoystickEnd(e),
        { passive: false },
      );
    }

    document.querySelectorAll(".mobile-action-button").forEach((btn) => {
      btn.addEventListener("touchstart", (e) => this.handleButtonStart(e), {
        passive: false,
      });
      btn.addEventListener("touchend", (e) => this.handleButtonEnd(e), {
        passive: false,
      });
      btn.addEventListener("touchcancel", (e) => this.handleButtonEnd(e), {
        passive: false,
      });
    });

    document.addEventListener(
      "touchmove",
      (e) => {
        if (
          e.target.closest("#mobile-joystick-container") ||
          e.target.closest(".mobile-action-button") ||
          e.target.closest("#mobile-weapon-wheel")
        ) {
          e.preventDefault();
        }
      },
      { passive: false },
    );
  }

  handleJoystickStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    this.joystickTouch = touch.identifier;
    this.joystickData.active = true;

    this.updateJoystickPosition(touch.clientX, touch.clientY);

    this.joystick.stick.style.background = "rgba(255, 255, 255, 1)";
  }

  handleJoystickMove(e) {
    e.preventDefault();
    if (!this.joystickData.active) return;

    const touch = Array.from(e.touches).find(
      (t) => t.identifier === this.joystickTouch,
    );
    if (!touch) return;

    this.updateJoystickPosition(touch.clientX, touch.clientY);
    this.updateMovementFromJoystick();
  }

  handleJoystickEnd(e) {
    e.preventDefault();
    this.joystickData.active = false;
    this.joystickData.x = 0;
    this.joystickData.y = 0;
    this.joystickData.angle = 0;
    this.joystickData.distance = 0;
    this.joystickTouch = null;

    this.joystick.stick.style.transform = "translate(-50%, -50%)";
    this.joystick.stick.style.background = "rgba(255, 255, 255, 0.9)";

    if (this.controls) {
      this.controls.moveForward = false;
      this.controls.moveBackward = false;
      this.controls.moveLeft = false;
      this.controls.moveRight = false;
    }
  }

  updateJoystickPosition(touchX, touchY) {
    const deltaX = touchX - this.joystick.centerX;
    const deltaY = touchY - this.joystick.centerY;

    let distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const maxDistance = this.config.joystickMaxDistance;
    const angle = Math.atan2(deltaY, deltaX);

    let limitedDeltaX = deltaX;
    let limitedDeltaY = deltaY;

    if (distance > maxDistance) {
      limitedDeltaX = Math.cos(angle) * maxDistance;
      limitedDeltaY = Math.sin(angle) * maxDistance;
      distance = maxDistance;
    }

    this.joystickData.x = limitedDeltaX / maxDistance;
    this.joystickData.y = limitedDeltaY / maxDistance;
    this.joystickData.angle = angle;
    this.joystickData.distance = distance / maxDistance;

    const stickX = limitedDeltaX;
    const stickY = limitedDeltaY;
    this.joystick.stick.style.transform = `translate(calc(-50% + ${stickX}px), calc(-50% + ${stickY}px))`;

    if (distance > maxDistance * 0.7) {
      this.joystick.stick.style.background = "rgba(255, 200, 100, 1)";
    } else {
      this.joystick.stick.style.background = "rgba(255, 255, 255, 1)";
    }
  }

  updateMovementFromJoystick() {
    if (!this.controls) return;

    const deadzone = 0.15;
    const x =
      Math.abs(this.joystickData.x) > deadzone ? this.joystickData.x : 0;
    const y =
      Math.abs(this.joystickData.y) > deadzone ? this.joystickData.y : 0;

    this.controls.moveForward = y < -deadzone;
    this.controls.moveBackward = y > deadzone;
    this.controls.moveLeft = x < -deadzone;
    this.controls.moveRight = x > deadzone;
  }

  createCameraRotationOverlay() {
    // Check if overlay already exists
    if (document.getElementById("camera-rotation-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "camera-rotation-overlay";
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: transparent;
        z-index: 5000;
        touch-action: none;
        pointer-events: auto;
    `;

    document.body.appendChild(overlay);
    this.cameraOverlay = overlay;

    // Track touch for camera rotation
    this.lastTouchX = 0;
    this.lastTouchY = 0;
    this.isTouching = false;

    // Add touch event listeners
    overlay.addEventListener(
      "touchstart",
      (e) => this.handleCameraTouchStart(e),
      { passive: false },
    );
    overlay.addEventListener(
      "touchmove",
      (e) => this.handleCameraTouchMove(e),
      { passive: false },
    );
    overlay.addEventListener("touchend", (e) => this.handleCameraTouchEnd(e), {
      passive: false,
    });
    overlay.addEventListener(
      "touchcancel",
      (e) => this.handleCameraTouchEnd(e),
      { passive: false },
    );

    // Start camera smoothing after overlay is created
    this.setupCameraSmoothing();
  }

  handleCameraTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    this.lastTouchX = touch.clientX;
    this.lastTouchY = touch.clientY;
    this.isTouching = true;
  }

  handleCameraTouchMove(e) {
    e.preventDefault();
    if (!this.isTouching || !this.controls) return;

    // Ensure targetCameraRotation exists
    if (!this.targetCameraRotation) {
      this.targetCameraRotation = { x: 0, y: 0.3 };
    }

    const touch = e.touches[0];
    const deltaX = touch.clientX - this.lastTouchX;
    const deltaY = touch.clientY - this.lastTouchY;

    if (deltaX !== 0 || deltaY !== 0) {
      // Update target rotation
      this.targetCameraRotation.x -= deltaX * this.cameraRotationSensitivity;

      const newPitch =
        this.targetCameraRotation.y - deltaY * this.cameraRotationSensitivity;
      this.targetCameraRotation.y = Math.max(
        0.1,
        Math.min(this.controls.PI_2 - 0.1, newPitch),
      );

      this.lastTouchX = touch.clientX;
      this.lastTouchY = touch.clientY;

      // Update spine rotation
      if (this.controls.updateSpineRotation) {
        this.controls.updateSpineRotation();
      }
    }
  }

  handleCameraTouchEnd(e) {
    e.preventDefault();
    this.isTouching = false;
    this.lastTouchX = 0;
    this.lastTouchY = 0;
  }

  setupCameraSmoothing() {
    // Ensure target and current rotations are initialized
    if (!this.targetCameraRotation) {
      this.targetCameraRotation = { x: 0, y: 0.3 };
    }
    if (!this.currentCameraRotation) {
      this.currentCameraRotation = { x: 0, y: 0.3 };
    }

    const smoothCamera = () => {
      if (
        this.controls &&
        this.controls.cameraRotation &&
        this.targetCameraRotation &&
        this.currentCameraRotation
      ) {
        // Smooth interpolation
        this.currentCameraRotation.x +=
          (this.targetCameraRotation.x - this.currentCameraRotation.x) *
          this.cameraSmoothingFactor;
        this.currentCameraRotation.y +=
          (this.targetCameraRotation.y - this.currentCameraRotation.y) *
          this.cameraSmoothingFactor;

        this.controls.cameraRotation.x = this.currentCameraRotation.x;
        this.controls.cameraRotation.y = this.currentCameraRotation.y;
      }
      requestAnimationFrame(smoothCamera);
    };

    smoothCamera();
  }

  handleButtonStart(e) {
    e.preventDefault();
    const button = e.target.closest(".mobile-action-button");
    if (!button) return;

    const action = button.dataset.action;

    button.style.transform = "scale(0.85)";
    button.style.opacity = "0.8";

    if (action === "sprint") {
      const newSprintState = !this.buttons.sprint;
      this.buttons.sprint = newSprintState;
      if (newSprintState) {
        button.style.border = "3px solid #ffaa00";
        button.style.boxShadow = "0 0 10px rgba(255,170,0,0.5)";
        this.showNotification("Sprint ON", "#ffaa00");
      } else {
        button.style.border = "2px solid rgba(255, 255, 255, 0.4)";
        button.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.4)";
        this.showNotification("Sprint OFF", "#ffaa00");
      }
      window.dispatchEvent(
        new CustomEvent("mobileButtonPress", {
          detail: { action, pressed: newSprintState, toggle: true },
        }),
      );
    } else if (action === "aim") {
      // Toggle aim like sprint
      const newAimState = !this.buttons.aim;
      this.buttons.aim = newAimState;
      if (newAimState) {
        button.style.border = "3px solid #ff4444";
        button.style.boxShadow = "0 0 10px rgba(255,68,68,0.6)";
      } else {
        button.style.border = "2px solid rgba(255, 255, 255, 0.4)";
        button.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.4)";
      }
      window.dispatchEvent(
        new CustomEvent("mobileButtonPress", {
          detail: { action, pressed: newAimState, toggle: true },
        }),
      );
    } else if (action === "collect") {
      this.showNotification("Collecting items...", "#ffaa00");
      // Dispatch IMMEDIATELY
      window.dispatchEvent(
        new CustomEvent("mobileButtonPress", {
          detail: { action, pressed: true, toggle: false },
        }),
      );
    } else {
      this.buttons[action] = true;
      window.dispatchEvent(
        new CustomEvent("mobileButtonPress", {
          detail: { action, pressed: true, toggle: false },
        }),
      );
    }
  }

  handleButtonEnd(e) {
    e.preventDefault();
    const button = e.target.closest(".mobile-action-button");
    if (!button) return;

    const action = button.dataset.action;

    button.style.transform = "scale(1)";
    button.style.opacity = "1";

    // Don't auto-release toggle buttons
    if (action !== "sprint" && action !== "aim") {
      this.buttons[action] = false;
      window.dispatchEvent(
        new CustomEvent("mobileButtonPress", {
          detail: { action, pressed: false, toggle: false },
        }),
      );
    }
  }

  adjustControlPositions() {
    if (this.joystick) {
      const rect = this.joystick.container.getBoundingClientRect();
      this.joystick.centerX = rect.left + rect.width / 2;
      this.joystick.centerY = rect.top + rect.height / 2;
    }
  }

  getJoystickState() {
    return {
      active: this.joystickData.active,
      x: this.joystickData.x,
      y: this.joystickData.y,
      angle: this.joystickData.angle,
      distance: this.joystickData.distance,
    };
  }

  isButtonPressed(action) {
    return this.buttons[action] || false;
  }

  updateWeaponIndicator(currentWeapon, totalWeapons) {
    const counter = document.getElementById("weapon-counter");
    if (counter) {
      counter.textContent = `${currentWeapon + 1}/${totalWeapons}`;
    }
  }

  showNotification(message, color) {
    const toast = document.createElement("div");
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.9);
      color: ${color};
      padding: 10px 20px;
      border-radius: 8px;
      font-family: Arial;
      font-size: 14px;
      z-index: 20001;
      border: 2px solid ${color};
      animation: fadeOut 2s forwards;
      white-space: nowrap;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  }

  setVisible(visible) {
    const elements = [
      "mobile-joystick-container",
      "mobile-action-buttons",
      "mobile-weapon-indicator",
    ];

    elements.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.style.display = visible ? "flex" : "none";
      }
    });
  }

  update() {
    if (this.enabled && this.joystickData.active) {
      this.updateMovementFromJoystick();
    }
  }

  destroy() {
    const elements = [
      "mobile-joystick-container",
      "mobile-action-buttons",
      "mobile-weapon-indicator",
      "mobile-weapon-wheel",
      "camera-rotation-overlay",
    ];

    elements.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });

    // Clean up camera properties
    this.targetCameraRotation = null;
    this.currentCameraRotation = null;
    this.isTouching = false;

    document.body.style.cursor = "default";
  }
}
