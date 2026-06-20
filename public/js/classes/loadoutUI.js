// classes/LoadoutUI.js
import { WEAPON_CONFIGS } from "./constants.js";

export default class LoadoutUI {
  constructor(onConfirm) {
    this.onConfirm = onConfirm;
    this.selectedWeapons = [];
    this.availableWeapons = Object.entries(WEAPON_CONFIGS).map(
      ([key, config]) => ({
        key: key,
        name: config.name,
        damage: config.damage,
        maxAmmo: config.maxAmmo,
        fireRate: config.fireRate,
        config: config,
      }),
    );

    this.createUI();
  }

  createUI() {
    // Remove existing if any
    const existing = document.getElementById("weapon-loadout");
    if (existing) existing.remove();

    const container = document.createElement("div");
    container.id = "weapon-loadout";

    const overlay = document.createElement("div");
    overlay.className = "loadout-overlay";

    const title = document.createElement("h3");
    title.textContent = "Select Your Loadout (4 Weapons)";
    overlay.appendChild(title);

    const selectionCount = document.createElement("div");
    selectionCount.className = "loadout-selection";
    selectionCount.id = "selection-count";
    selectionCount.textContent = "Selected: 0 / 4";
    overlay.appendChild(selectionCount);

    const grid = document.createElement("div");
    grid.className = "weapon-grid";

    this.availableWeapons.forEach((weapon) => {
      const card = this.createWeaponCard(weapon);
      grid.appendChild(card);
    });

    overlay.appendChild(grid);

    const confirmBtn = document.createElement("button");
    confirmBtn.id = "confirm-loadout";
    confirmBtn.textContent = "Confirm Loadout";
    confirmBtn.disabled = true;
    confirmBtn.onclick = () => this.confirm();
    overlay.appendChild(confirmBtn);

    container.appendChild(overlay);
    document.body.appendChild(container);

    this.container = container;
    this.selectionCount = selectionCount;
    this.confirmBtn = confirmBtn;

    console.log("✅ Loadout UI created and added to DOM");
    console.log("Container element:", container);
    console.log(
      "Container styles:",
      window.getComputedStyle(container).display,
    );
  }

  createWeaponCard(weapon) {
    const card = document.createElement("div");
    card.className = "weapon-card";
    card.dataset.weapon = weapon.key;

    const iconDiv = document.createElement("div");
    iconDiv.className = "weapon-icon";

    iconDiv.textContent = "";
    iconDiv.style.backgroundImage = `url(/assets/ui/weapons/${weapon.key}.jpg)`;
    iconDiv.style.backgroundSize = "contain";
    iconDiv.style.backgroundRepeat = "no-repeat";
    iconDiv.style.backgroundPosition = "center";

    const name = document.createElement("div");
    name.className = "weapon-name";
    name.textContent = weapon.name;

    const stats = document.createElement("div");
    stats.className = "weapon-stats";
    stats.innerHTML = `
      <span>💥 ${weapon.damage}</span>
      <span>🔫 ${weapon.maxAmmo}</span>
      <span>⚡ ${weapon.fireRate}s</span>
    `;

    card.appendChild(iconDiv);
    card.appendChild(name);
    card.appendChild(stats);

    card.onclick = () => this.toggleWeapon(weapon, card);

    return card;
  }

  toggleWeapon(weapon, card) {
    const index = this.selectedWeapons.findIndex((w) => w.key === weapon.key);

    if (index === -1) {
      if (this.selectedWeapons.length >= 4) {
        this.showNotification("You can only select 4 weapons!", "#ff0000");
        return;
      }
      this.selectedWeapons.push(weapon);
      card.classList.add("selected");
    } else {
      this.selectedWeapons.splice(index, 1);
      card.classList.remove("selected");
    }

    this.selectionCount.textContent = `Selected: ${this.selectedWeapons.length} / 4`;

    // Update confirm button state
    if (this.selectedWeapons.length === 4) {
      this.confirmBtn.disabled = false;
    } else {
      this.confirmBtn.disabled = true;
    }
  }

  confirm() {
    console.log(
      "Confirm button clicked, selected weapons:",
      this.selectedWeapons.length,
    );

    if (this.selectedWeapons.length !== 4) {
      this.showNotification("Please select exactly 4 weapons!", "#ffaa00");
      return;
    }

    const weaponNames = this.selectedWeapons.map((w) => w.name);
    console.log("Emitting confirmLoadout with weapons:", weaponNames);

    // Store the selected configs globally for when initSelf is called
    window.pendingLoadoutWeapons = this.selectedWeapons.map((w) => w.config);

    // Send confirmation to server
    if (window.socket) {
      window.socket.emit("confirmLoadout", { weapons: weaponNames });
    } else {
      console.error("Socket not available!");
    }

    this.close();
  }

  close() {
    if (this.container) {
      this.container.remove();
      console.log("Loadout UI closed");
    }
  }

  showNotification(message, color) {
    const notification = document.createElement("div");
    notification.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.9);
      color: ${color};
      padding: 15px 30px;
      border-radius: 8px;
      font-family: Arial;
      font-size: 18px;
      z-index: 100001;
      border: 2px solid ${color};
      white-space: nowrap;
      animation: loadoutFadeOut 2s forwards;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      if (document.body.contains(notification)) {
        notification.remove();
      }
    }, 2000);
  }
}
