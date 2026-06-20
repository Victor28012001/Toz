// client/src/classes/ModernHUD.js

export default class ModernHUD {
  constructor() {
    this.container = null;
    this.healthFill = null;
    this.healthText = null;
    this.ammoCurrent = null;
    this.ammoMax = null;
    this.weaponImage = null;
    this.secondaryWeaponImage = null;
    this.weaponSlot = null;
    this.reservesText = null;
    this.grenadeCount = null; // Add grenade count reference
    this.weaponIconMap = {};
    this.createHUD();
    this._selectedInventoryIndex = 0;
    this._boundInventoryKeyHandler = null;
    this._inventory = [];
    this._inventorySocket = null;
    this._outsideClickHandler = null;
    this._globalKeyHandler = null;
  }

  createHUD() {
    const oldHealthBar = document.getElementById("health-bar");
    const oldAmmoHUD = document.getElementById("ammo-hud");
    if (oldHealthBar) oldHealthBar.remove();
    if (oldAmmoHUD) oldAmmoHUD.remove();

    this._buildWeaponIconMap();

    this.container = document.createElement("div");
    this.container.className = "modern-hud-wrapper";
    this.container.style.cssText = `
      position: fixed;
      left: 50%;
      bottom: 18px;
      transform: translateX(-50%);
      display: flex;
      flex-direction: column;
      gap: 6px;
      z-index: 60;
      pointer-events: none;
    `;

    this.container.innerHTML = `
      <div class="hud-bottom" style="display: flex; align-items: flex-end; gap: 8px;">
        
        <div class="hud-slot bag-slot" style="
          position: relative; height: 52px; width: 54px;
          background: rgba(20,20,20,.88); overflow: hidden;
          display: flex; align-items: center; justify-content: center;
        pointer-events: auto;">
          <div style="position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(255,255,255,.04), rgba(255,255,255,0)); pointer-events: none;"></div>
          <img src="/assets/ui/backpack.png" alt="" style="width: 32px; height: 32px; object-fit: contain; filter: brightness(1.5); opacity: 0.9;" />
        </div>

        <div class="hud-slot weapon-slot active" id="hud-weapon-slot" style="
          position: relative; height: 52px; width: 165px;
          background: rgba(38,38,38,.95); overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          border-bottom: 3px solid #ffffff;
          box-shadow: 0 0 12px rgba(255,255,255,.08), inset 0 0 0 1px rgba(255,255,255,.05);
        pointer-events: auto;">
          <div style="position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(255,255,255,.04), rgba(255,255,255,0)); pointer-events: none;"></div>
          <div class="ammo-display" style="position: absolute; top: 4px; left: 10px; font-size: 12px; color: #d6d6d6; letter-spacing: .5px; font-family: 'Courier New', monospace;pointer-events: none;">
            <span class="ammo-current" id="modern-ammo-current" style="font-size: 20px; font-weight: bold;">--</span>
            <br><span class="ammo-max" id="modern-ammo-max" style="font-size: 11px; color: #888;">/--</span>
          </div>
          <img id="modern-weapon-img" src="" alt="" style="width: 120px; height: 40px; object-fit: contain; filter: brightness(1.5) contrast(1.2); transform: scaleX(-1); opacity: 0.9;" />
          <span id="modern-reserves" style="position: absolute; bottom: 4px; right: 8px; font-size: 10px; color: #ffcc00; font-family: 'Courier New', monospace;"></span>
        </div>

        <div class="hud-slot secondary-slot" style="
          position: relative; height: 52px; width: 54px;
          background: rgba(20,20,20,.88); overflow: hidden;
          display: flex; align-items: center; justify-content: center;
        pointer-events: auto;">
          <div style="position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(255,255,255,.04), rgba(255,255,255,0)); pointer-events: none;"></div>
          <img id="modern-secondary-weapon-img" src="" alt="" style="width: 38px; height: 30px; object-fit: contain; filter: brightness(1.2) grayscale(0.3); opacity: 0.7; transform: scaleX(-1);" />
        </div>

        <div class="hud-slot grenade-slot" id="grenade-slot" style="
          position: relative; height: 52px; width: 54px;
          background: rgba(20,20,20,.88); overflow: hidden;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 2px;
        pointer-events: auto;">
          <div style="position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(255,255,255,.04), rgba(255,255,255,0)); pointer-events: none;"></div>
          <img src="/assets/ui/grenade.png" alt="" style="width: 28px; height: 28px; object-fit: contain; filter: brightness(1.3); opacity: 0.85;" />
          <span id="grenade-count" style="font-size: 11px; font-weight: bold; color: #ffaa44; font-family: 'Courier New', monospace; text-shadow: 0 0 2px #000;">3</span>
        </div>

      </div>

      <div class="health-bar-wrapper" style="display: flex; align-items: center; gap: 6px;">
        <div class="plus-box" style="width: 28px; height: 18px; background: rgba(20,20,20,.88); border: 1px solid rgba(255,255,255,.12); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(6px); color: #fff; pointer-events: auto;">+</div>
        <div class="health-bar-outer" style="width: 320px; height: 8px; background: rgba(20,20,20,.88); border: 1px solid rgba(255,255,255,.14); position: relative; display: flex; align-items: center; backdrop-filter: blur(6px);">
          <div id="modern-health-fill" class="health-fill" style="width: 100%; height: 14px; background: #ffffff; transition: width 0.3s ease, background 0.3s ease;"></div>
        </div>
        <span id="modern-health-text" style="color: #ffffff; font-size: 12px; font-family: 'Courier New', monospace; font-weight: bold; margin-left: 4px; min-width: 28px;">100</span>
      </div>
    `;

    document.body.appendChild(this.container);

    this.healthFill = document.getElementById("modern-health-fill");
    this.healthText = document.getElementById("modern-health-text");
    this.ammoCurrent = document.getElementById("modern-ammo-current");
    this.ammoMax = document.getElementById("modern-ammo-max");
    this.weaponImage = document.getElementById("modern-weapon-img");
    this.secondaryWeaponImage = document.getElementById(
      "modern-secondary-weapon-img",
    );
    this.weaponSlot = document.getElementById("hud-weapon-slot");
    this.reservesText = document.getElementById("modern-reserves");
    this.grenadeCount = document.getElementById("grenade-count");

    // Set up global I key for inventory
    this.setupGlobalInventoryKey();
    this.setupBackpackClick();
  }

  // Add this method to update grenade count
  updateGrenadeCount(count, maxGrenades = 3) {
    if (this.grenadeCount) {
      this.grenadeCount.textContent = count;
      if (count === 0) {
        this.grenadeCount.style.color = "#ff4444";
        // Optional: add pulsing effect when out of grenades
        this.grenadeCount.style.animation = "pulse 0.5s ease";
        setTimeout(() => {
          if (this.grenadeCount) this.grenadeCount.style.animation = "";
        }, 500);
      } else if (count < maxGrenades / 2) {
        this.grenadeCount.style.color = "#ffaa44";
      } else {
        this.grenadeCount.style.color = "#00ff88";
      }
    }
  }

  _buildWeaponIconMap() {
    const WEAPON_CONFIGS = window.WEAPON_CONFIGS || {};
    Object.entries(WEAPON_CONFIGS).forEach(([key, config]) => {
      const path = `/assets/ui/weapons/${key}.jpg`;
      this.weaponIconMap[config.name] = path;
    });
  }

  updateHealth(health, maxHealth) {
    if (!this.healthFill || !this.healthText) return;

    const pct = (health / maxHealth) * 100;
    this.healthFill.style.width = pct + "%";
    this.healthText.textContent = Math.ceil(health);

    if (pct > 60) {
      this.healthFill.style.background = "#ffffff";
      this.healthFill.style.animation = "";
    } else if (pct > 30) {
      this.healthFill.style.background = "#ffaa00";
      this.healthFill.style.animation = "";
    } else {
      this.healthFill.style.background = "#ff4444";
      this.healthFill.style.animation = "healthPulse 0.5s ease infinite";
    }
  }

  updateAmmo(
    current,
    max,
    reserves,
    weaponName,
    allWeapons,
    currentWeaponIndex,
  ) {
    if (this.ammoCurrent) this.ammoCurrent.textContent = current;
    if (this.ammoMax) this.ammoMax.textContent = "/" + max;
    if (this.reservesText) {
      this.reservesText.textContent = reserves > 0 ? "×" + reserves : "EMPTY";
      this.reservesText.style.color = reserves > 0 ? "#ffcc00" : "#ff4444";
    }

    // Update current weapon image
    if (weaponName && this.weaponImage) {
      let weaponKey = null;
      const WEAPON_CONFIGS = window.WEAPON_CONFIGS || {};
      for (const [key, config] of Object.entries(WEAPON_CONFIGS)) {
        if (config.name === weaponName) {
          weaponKey = key;
          break;
        }
      }

      if (weaponKey) {
        const imagePath = `/assets/ui/weapons/${weaponKey}.jpg`;
        this.weaponImage.src = imagePath;
        this.weaponImage.style.display = "";
      } else {
        console.warn(`No config key found for weapon: "${weaponName}"`);
        this.weaponImage.style.display = "none";
      }
    }

    // Update secondary (next) weapon image
    if (
      allWeapons &&
      currentWeaponIndex !== undefined &&
      this.secondaryWeaponImage
    ) {
      const nextIndex = (currentWeaponIndex + 1) % allWeapons.length;
      const nextWeapon = allWeapons[nextIndex];

      if (nextWeapon) {
        let weaponKey = null;
        const WEAPON_CONFIGS = window.WEAPON_CONFIGS || {};
        for (const [key, config] of Object.entries(WEAPON_CONFIGS)) {
          if (config.name === nextWeapon.name) {
            weaponKey = key;
            break;
          }
        }

        if (weaponKey) {
          const imagePath = `/assets/ui/weapons/${weaponKey}.jpg`;
          this.secondaryWeaponImage.src = imagePath;
          this.secondaryWeaponImage.style.display = "";
        } else {
          console.warn(`No config key found for weapon: "${nextWeapon.name}"`);
          this.secondaryWeaponImage.style.display = "none";
        }
      }
    }
  }

  updateWeaponIndicator(currentIndex, totalWeapons) {
    if (this.weaponSlot) {
      if (currentIndex === 0) {
        this.weaponSlot.style.borderBottom = "3px solid #ffffff";
        this.weaponSlot.style.boxShadow =
          "0 0 12px rgba(255,255,255,.08), inset 0 0 0 1px rgba(255,255,255,.05)";
      } else {
        this.weaponSlot.style.borderBottom = "3px solid rgba(255,255,255,.3)";
        this.weaponSlot.style.boxShadow = "none";
      }
    }
  }

  createInventoryPanel() {
    if (document.getElementById("inventory-panel")) return;

    const panel = document.createElement("div");
    panel.id = "inventory-panel";
    panel.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 380px;
      max-height: 70vh;
      background: rgba(15, 15, 15, 0.97);
      border: 2px solid rgba(255, 170, 0, 0.3);
      border-radius: 8px;
      padding: 16px;
      z-index: 100;
      display: none;
      font-family: 'Courier New', monospace;
      color: #fff;
      box-shadow: 0 0 20px rgba(0,0,0,0.8);
      outline: none;
      overflow-y: auto;
      touch-action: manipulation;
    `;
    panel.tabIndex = 0;

    panel.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
        <span style="font-size: 16px; font-weight: bold; color: #ffaa00;">🎒 INVENTORY</span>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 10px; color: #666;">ARROWS • ENTER • I</span>
          <button id="inventory-close-btn" style="
            background: rgba(255, 68, 68, 0.8);
            border: none;
            color: #fff;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            line-height: 1;
            transition: all 0.15s;
            z-index: 101;
          ">✕</button>
        </div>
      </div>
      <div id="inventory-grid" style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; min-height: 200px;"></div>
    `;

    document.body.appendChild(panel);

    // Close button - desktop
    document
      .getElementById("inventory-close-btn")
      .addEventListener("click", (e) => {
        e.stopPropagation();
        this._closeInventory();
      });

    // Close button - mobile
    document
      .getElementById("inventory-close-btn")
      .addEventListener("touchend", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._closeInventory();
      });

    // Click outside to close (both mobile and desktop)
    this._outsideClickHandler = (e) => {
      if (!panel.contains(e.target) && e.target.id !== "inventory-close-btn") {
        this._closeInventory();
      }
    };
    document.addEventListener("click", this._outsideClickHandler);
    document.addEventListener("touchstart", this._outsideClickHandler);

    // Prevent clicks inside panel from closing it
    panel.addEventListener("click", (e) => e.stopPropagation());
    panel.addEventListener("touchstart", (e) => e.stopPropagation());
  }

  _closeInventory() {
    const panel = document.getElementById("inventory-panel");
    if (panel) {
      panel.style.display = "none";
    }
    // Remove only the navigation handler, not the global one
    if (this._boundInventoryKeyHandler) {
      document.removeEventListener("keydown", this._boundInventoryKeyHandler);
      this._boundInventoryKeyHandler = null;
    }
    if (this._outsideClickHandler) {
      document.removeEventListener("click", this._outsideClickHandler);
      document.removeEventListener("touchstart", this._outsideClickHandler);
      this._outsideClickHandler = null;
    }
    if (window.self_player?.world?.controls) {
      window.self_player.world.controls._inventoryOpen = false;
    }
  }

  toggleInventory(inventory, socket) {
    let panel = document.getElementById("inventory-panel");
    if (!panel) {
      this.createInventoryPanel();
      panel = document.getElementById("inventory-panel");
    }

    if (panel.style.display === "block") {
      this._closeInventory();
      // Notify controls that inventory closed
      if (window.self_player?.world?.controls) {
        window.self_player.world.controls._inventoryOpen = false;
      }
      return false;
    }

    panel.style.display = "block";
    this.renderInventory(inventory || [], socket);

    if (this._boundInventoryKeyHandler) {
      document.removeEventListener("keydown", this._boundInventoryKeyHandler);
    }
    this._boundInventoryKeyHandler = (e) => this.handleInventoryKeyDown(e);
    document.addEventListener("keydown", this._boundInventoryKeyHandler);

    return true;
  }

  renderInventory(inventory, socket) {
    const grid = document.getElementById("inventory-grid");
    if (!grid) return;

    this._selectedInventoryIndex = 0;
    this._inventory = inventory || [];
    this._inventorySocket = socket;

    const totalSlots = 16;
    let html = "";

    for (let i = 0; i < totalSlots; i++) {
      const item = inventory[i] || null;

      if (item) {
        // ✅ FIX: Use itemId or id (handle both)
        const itemId = item.itemId || item.id;
        const icon =
          item.type === "vaccine"
            ? "💉"
            : item.type === "ammo"
            ? "🔫"
            : item.type === "health"
            ? "❤️"
            : "📦";
        const color =
          item.type === "vaccine"
            ? "#00ff88"
            : item.type === "ammo"
            ? "#ffaa00"
            : item.type === "health"
            ? "#ff4444"
            : "#ffaa00";

        html += `
        <div class="inv-slot" data-index="${i}" data-item-id="${itemId}" style="
          position: relative;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          background: rgba(255, 255, 255, 0.05);
          border: 2px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          padding: 8px;
          aspect-ratio: 1;
          cursor: pointer;
          text-align: center;
          transition: all 0.15s;
        ">
          <span style="font-size: 28px;">${icon}</span>
          <span style="color: ${color}; font-weight: bold; font-size: 9px; margin-top: 2px;">${item.name.substring(
          0,
          12,
        )}</span>
          <span style="
            position: absolute;
            top: 2px;
            right: 2px;
            background: ${color};
            color: #000;
            border-radius: 50%;
            min-width: 18px;
            height: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 9px;
            font-weight: bold;
            padding: 0 3px;
          ">${item.count || 1}</span>
        </div>`;
      } else {
        html += `
        <div class="inv-slot empty-slot" data-index="${i}" style="
          display: flex; align-items: center; justify-content: center;
          background: rgba(255, 255, 255, 0.02);
          border: 1px dashed rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          aspect-ratio: 1;
          color: #333;
          font-size: 20px;
        ">-</div>`;
      }
    }

    grid.innerHTML = html;

    this._highlightInventorySlot(0);

    // Click on item to use it
    grid.querySelectorAll(".inv-slot:not(.empty-slot)").forEach((slot) => {
      slot.addEventListener("click", (e) => {
        e.stopPropagation();
        const itemId = slot.dataset.itemId;
        if (itemId && window._useInventoryItem) {
          window._useInventoryItem(itemId);
        }
      });
    });

    const panel = document.getElementById("inventory-panel");
    if (panel) {
      panel.focus();
    }
  }

  _highlightInventorySlot(index) {
    const grid = document.getElementById("inventory-grid");
    if (!grid) return;

    // Remove all highlights
    grid.querySelectorAll(".inv-slot").forEach((s) => {
      s.style.border = s.dataset.itemId
        ? "2px solid rgba(255, 255, 255, 0.1)"
        : "1px dashed rgba(255, 255, 255, 0.08)";
      s.style.background = s.dataset.itemId
        ? "rgba(255, 255, 255, 0.05)"
        : "rgba(255, 255, 255, 0.02)";
    });

    // Highlight selected
    const selected = grid.querySelector(`.inv-slot[data-index="${index}"]`);
    if (selected) {
      selected.style.border = "2px solid #ffaa00";
      selected.style.background = "rgba(255, 170, 0, 0.15)";
      this._selectedInventoryIndex = index;
    }
  }

  setupGlobalInventoryKey() {
    if (this._globalKeyHandler) return;

    this._globalKeyHandler = (e) => {
      // Only handle I key when not typing in an input
      if (
        e.code === "KeyI" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        e.stopPropagation();

        const panel = document.getElementById("inventory-panel");
        if (panel && panel.style.display === "block") {
          this._closeInventory();
        } else if (window.socket) {
          const handler = (data) => {
            window.socket.off("inventoryUpdate", handler);
            this.toggleInventory(data.inventory, window.socket);
            if (window.self_player?.world?.controls) {
              window.self_player.world.controls._inventoryOpen = true;
            }
          };
          window.socket.on("inventoryUpdate", handler);
          window.socket.emit("requestInventory");
        }
      }
    };

    document.addEventListener("keydown", this._globalKeyHandler);
  }

  handleInventoryKeyDown(e) {
    const grid = document.getElementById("inventory-grid");
    if (!grid) return;

    // Block ALL keys when inventory is open
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    let newIndex = this._selectedInventoryIndex;

    switch (e.key) {
      case "ArrowUp":
        newIndex = Math.max(0, this._selectedInventoryIndex - 4);
        break;
      case "ArrowDown":
        newIndex = Math.min(15, this._selectedInventoryIndex + 4);
        break;
      case "ArrowLeft":
        if (this._selectedInventoryIndex % 4 !== 0) {
          newIndex = this._selectedInventoryIndex - 1;
        }
        break;
      case "ArrowRight":
        if (this._selectedInventoryIndex % 4 !== 3) {
          newIndex = this._selectedInventoryIndex + 1;
        }
        break;
      case "Enter":
      case " ":
        const selected = grid.querySelector(
          `.inv-slot[data-index="${this._selectedInventoryIndex}"]`,
        );
        if (selected && selected.dataset.itemId && window._useInventoryItem) {
          window._useInventoryItem(selected.dataset.itemId);
        }
        return;
      case "i":
      case "I":
        this._closeInventory();
        return;
      default:
        return;
    }

    if (newIndex !== this._selectedInventoryIndex) {
      this._highlightInventorySlot(newIndex);
    }
  }

  updateInventory(inventory) {
    this._inventory = inventory || [];

    // Update collect dot indicator
    const collectDot = document.querySelector(".collect-dot");
    if (collectDot) {
      const hasItems = this._inventory.length > 0;
      collectDot.style.display = hasItems ? "block" : "none";
      if (hasItems) {
        const hasVaccine = this._inventory.some(
          (item) => item.type === "vaccine",
        );
        collectDot.style.background = hasVaccine ? "#00ff88" : "#ffaa00";
      }
    }

    // ✅ Refresh grid if panel is open
    const panel = document.getElementById("inventory-panel");
    if (panel && panel.style.display === "block") {
      this.renderInventory(this._inventory, this._inventorySocket);
    }

    // ✅ Update backpack badge
    this.updateBackpackBadge();
  }

  // ✅ Add this new method to show inventory count on backpack
  updateBackpackBadge() {
    const bagSlot = document.querySelector(".bag-slot");
    if (!bagSlot) return;

    // Remove existing badge if any
    const existingBadge = bagSlot.querySelector(".inventory-badge");
    if (existingBadge) existingBadge.remove();

    const itemCount = this._inventory?.length || 0;
    if (itemCount > 0) {
      const badge = document.createElement("span");
      badge.className = "inventory-badge";
      badge.style.cssText = `
      position: absolute;
      top: -4px;
      right: -4px;
      background: #ffaa00;
      color: #000;
      border-radius: 50%;
      min-width: 18px;
      height: 18px;
      font-size: 10px;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 4px;
      font-family: 'Courier New', monospace;
      border: 1px solid rgba(0,0,0,0.3);
    `;
      badge.textContent = itemCount;
      bagSlot.style.position = "relative";
      bagSlot.appendChild(badge);
    }
  }

  setupBackpackClick() {
    const bagSlot = document.querySelector(".bag-slot");
    if (bagSlot) {
      // Remove existing listeners to avoid duplicates
      const newBagSlot = bagSlot.cloneNode(true);
      bagSlot.parentNode.replaceChild(newBagSlot, bagSlot);

      newBagSlot.addEventListener("click", (e) => {
        e.stopPropagation();
        if (window.socket) {
          // Request inventory from server
          window.socket.emit("requestInventory");
          // Set up one-time handler
          const handler = (data) => {
            window.socket.off("inventoryUpdate", handler);
            this.toggleInventory(data.inventory, window.socket);
            if (window.self_player?.world?.controls) {
              window.self_player.world.controls._inventoryOpen = true;
            }
          };
          window.socket.on("inventoryUpdate", handler);
        }
      });
    }
  }
}
