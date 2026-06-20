const SERVER_URL = "";

export default class VanillaWalletUI {
  constructor() {
    this.walletAddress = null;
    this.isAuthenticated = false;
    this.authWindow = null;
    this.profileModal = null;
    this.createUI();
    this.checkAuthStatus();

  }

  createUI() {
    // Inject styles
    if (!document.getElementById("wallet-ui-styles")) {
      const style = document.createElement("style");
      style.id = "wallet-ui-styles";
      style.textContent = `
        #wallet-button {
          position: fixed;
          top: 12px;
          right: 20px;
          z-index: 1010;
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-family: 'Orbitron', monospace;
          font-size: 11px;
          font-weight: bold;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        #wallet-button.disconnected {
          background: linear-gradient(135deg, #9945FF, #14F195);
          color: white;
        }
        #wallet-button.connected {
          background: rgba(0,0,0,0.7);
          border: 1px solid #14F195;
          color: #14F195;
        }
        #wallet-button:hover {
          transform: scale(1.05);
          filter: brightness(1.15);
        }
        #wallet-avatar {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: linear-gradient(135deg, #9945FF, #14F195);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          flex-shrink: 0;
        }
        #profile-modal {
          position: fixed;
          inset: 0;
          z-index: 1020;
          display: none;
          align-items: center;
          justify-content: center;
          background: rgba(0,0,0,0.7);
          font-family: 'Orbitron', monospace;
        }
        #profile-modal.open {
          display: flex;
        }
        #profile-card {
          background: linear-gradient(135deg, #0a0a1a, #12102a);
          border: 1px solid rgba(153,69,255,0.4);
          border-radius: 16px;
          padding: 30px;
          width: 380px;
          max-width: 90vw;
          box-shadow: 0 0 40px rgba(153,69,255,0.2);
          position: relative;
          animation: profileSlideIn 0.2s ease;
        }
        @keyframes profileSlideIn {
          from { opacity: 0; transform: scale(0.95) translateY(-10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        #profile-close {
          position: absolute;
          top: 14px;
          right: 14px;
          background: rgba(255,255,255,0.08);
          border: none;
          color: #aaa;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        #profile-close:hover { background: rgba(255,68,68,0.3); color: white; }
        .profile-section {
          margin-bottom: 20px;
          padding-bottom: 20px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .profile-section:last-child { border-bottom: none; margin-bottom: 0; }
        .profile-label {
          font-size: 9px;
          letter-spacing: 0.15em;
          color: #666;
          margin-bottom: 4px;
          text-transform: uppercase;
        }
        .profile-value {
          font-size: 14px;
          color: #e8f0ff;
          word-break: break-all;
        }
        .stat-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .stat-row:last-child { border-bottom: none; }
        .stat-label { font-size: 11px; color: #888; }
        .stat-value { font-size: 14px; font-weight: bold; }
        .profile-action-btn {
          width: 100%;
          padding: 11px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          font-family: 'Orbitron', monospace;
          font-size: 11px;
          font-weight: bold;
          letter-spacing: 0.1em;
          margin-bottom: 8px;
          transition: filter 0.2s;
        }
        .profile-action-btn:hover { filter: brightness(1.15); }
        .btn-claim {
          background: linear-gradient(135deg, #14F195, #0ea868);
          color: #000;
        }
        .btn-claim:disabled {
          background: rgba(255,255,255,0.1);
          color: #555;
          cursor: not-allowed;
          filter: none;
        }
        .btn-logout {
          background: rgba(255,68,68,0.15);
          border: 1px solid rgba(255,68,68,0.4) !important;
          color: #ff6666;
        }
        .token-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(153,69,255,0.15);
          border: 1px solid rgba(153,69,255,0.3);
          border-radius: 20px;
          padding: 4px 12px;
          font-size: 18px;
          font-weight: bold;
          color: #14F195;
        }
      `;
      document.head.appendChild(style);
    }

    // Wallet button
    this.walletButton = document.createElement("button");
    this.walletButton.id = "wallet-button";
    this.walletButton.className = "disconnected";
    this.walletButton.innerHTML = `<span>👛</span><span id="wallet-btn-label">Sign In</span>`;
    this.walletButton.onclick = () => this._onButtonClick();
    document.body.appendChild(this.walletButton);

    // Profile modal
    this.profileModal = document.createElement("div");
    this.profileModal.id = "profile-modal";
    this.profileModal.innerHTML = `
      <div id="profile-card">
        <button id="profile-close">✕</button>

        <div style="text-align:center; margin-bottom: 24px;">
          <div id="profile-modal-avatar" style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#9945FF,#14F195);margin:0 auto 10px;display:flex;align-items:center;justify-content:center;font-size:24px;">👤</div>
          <div id="profile-name" style="font-size:16px;font-weight:700;color:#e8f0ff;letter-spacing:0.08em;">—</div>
          <div id="profile-email" style="font-size:10px;color:#666;margin-top:3px;letter-spacing:0.05em;">—</div>
        </div>

        <div class="profile-section">
          <div class="profile-label">Wallet Address</div>
          <div class="profile-value" id="profile-wallet-addr" style="font-size:11px;color:#9945FF;">—</div>
        </div>

        <div class="profile-section">
          <div class="profile-label">Balances</div>
          <div class="stat-row">
            <span class="stat-label">💰 $JBKS Tokens</span>
            <span class="stat-value" id="profile-jbks" style="color:#14F195;">—</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">◎ SOL Balance</span>
            <span class="stat-value" id="profile-sol" style="color:#9945FF;">—</span>
          </div>
        </div>

        <div class="profile-section">
          <div class="profile-label">Daily Reward</div>
          <div style="text-align:center;margin:10px 0;">
            <div id="profile-daily-amount" class="token-badge">🎁 +100 $JBKS Daily</div>
          </div>
          <button class="profile-action-btn btn-claim" id="profile-claim-btn">
            🎁 CLAIM DAILY REWARD
          </button>
          <div id="profile-claim-status" style="font-size:9px;color:#666;text-align:center;min-height:14px;margin-top:4px;"></div>
        </div>

        <div class="profile-section" style="border-bottom:none;padding-bottom:0;margin-bottom:0;">
          <button class="profile-action-btn btn-logout" id="profile-logout-btn">
            🚪 SIGN OUT
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(this.profileModal);

    // Close modal on backdrop click
    this.profileModal.addEventListener("click", (e) => {
      if (e.target === this.profileModal) this._closeProfile();
    });
    document
      .getElementById("profile-close")
      .addEventListener("click", () => this._closeProfile());
    document
      .getElementById("profile-logout-btn")
      .addEventListener("click", () => this.logout());
    document
      .getElementById("profile-claim-btn")
      .addEventListener("click", () => this._claimDaily());
  }

  _setButtonLoading(isLoading) {
    const btn = document.getElementById("wallet-button");
    const label = document.getElementById("wallet-btn-label");
    const iconSpan = btn?.querySelector("span:first-child");

    if (isLoading) {
      if (btn) {
        btn.disabled = true;
        btn.style.opacity = "0.7";
        btn.style.cursor = "wait";
      }
      if (iconSpan) {
        iconSpan.innerHTML = `<div class="spinner-small" style="width:18px;height:18px;border:2px solid rgba(255,255,255,0.2);border-top-color:#14F195;border-radius:50%;animation:spin 0.6s linear infinite;"></div>`;
      }
      if (label) label.textContent = "Connecting...";
    } else {
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.style.cursor = "pointer";
      }
    }
  }

  // Add a loading indicator inside the profile modal
  _showProfileLoading() {
    const jbksEl = document.getElementById("profile-jbks");
    const solEl = document.getElementById("profile-sol");
    const walletAddrEl = document.getElementById("profile-wallet-addr");

    if (jbksEl)
      jbksEl.innerHTML = `<span class="spinner-text">⏳ Loading...</span>`;
    if (solEl)
      solEl.innerHTML = `<span class="spinner-text">⏳ Loading...</span>`;
    if (walletAddrEl)
      walletAddrEl.innerHTML = `<span class="spinner-text">⏳ Fetching wallet...</span>`;
  }

  _onButtonClick() {
    if (this.isAuthenticated) {
      this._openProfile();
    } else {
      this.login();
    }
  }

  _setButtonConnected(name, initial) {
    const btn = document.getElementById("wallet-button");
    const label = document.getElementById("wallet-btn-label");
    if (btn) btn.className = "connected";
    if (label) label.textContent = name || "Connected";

    // Replace icon with avatar initial
    const iconSpan = btn?.querySelector("span:first-child");
    if (iconSpan) {
      iconSpan.innerHTML = `<div id="wallet-avatar">${initial || "👤"}</div>`;
    }
  }

  _setButtonDisconnected() {
    const btn = document.getElementById("wallet-button");
    const label = document.getElementById("wallet-btn-label");
    if (btn) btn.className = "disconnected";
    if (label) label.textContent = "Sign In";
    const iconSpan = btn?.querySelector("span:first-child");
    if (iconSpan) iconSpan.textContent = "👛";
  }

  _setStatus(text, color = "#00ff00") {
    // Use feedbackSystem if available, otherwise console
    if (window.feedbackSystem) {
      window.feedbackSystem.showNotification(text, color);
    } else {
      console.log(`[Wallet] ${text}`);
    }
  }

  //   async _openProfile() {
  //     // Re-fetch latest wallet data
  //     try {
  //       const response = await fetch("/api/wallet", { credentials: "include" });
  //       const data = await response.json();

  //       if (data.authenticated && data.wallet) {
  //         document.getElementById("profile-name").textContent =
  //           data.user?.name || "Player";
  //         document.getElementById("profile-email").textContent =
  //           data.user?.email || "";
  //         document.getElementById(
  //           "profile-wallet-addr",
  //         ).textContent = `${data.wallet.slice(0, 8)}...${data.wallet.slice(-6)}`;
  //         document.getElementById("profile-jbks").textContent = `${(
  //           data.tokenBalance || 0
  //         ).toFixed(2)} $JBKS`;
  //         document.getElementById("profile-sol").textContent = `${(
  //           data.solBalance || 0
  //         ).toFixed(4)} SOL`;

  //         // Set avatar initial
  //         const name = data.user?.name || "?";
  //         const initial = name.charAt(0).toUpperCase();
  //         document.getElementById("profile-modal-avatar").textContent = initial;
  //       }
  //     } catch (e) {
  //       console.error("Failed to load profile data:", e);
  //     }

  //     // Check daily claim availability
  //     this._updateDailyClaimButton();

  //     // Disable game controls while profile is open
  //     if (window.self_player?.world?.controls) {
  //       window.self_player.world.controls._inventoryOpen = true;
  //     }

  //     this.profileModal.classList.add("open");
  //   }

  async _openProfile() {
    // Show loading state in modal
    this._showProfileLoading();

    // Re-fetch latest wallet data
    try {
      const response = await fetch("/api/wallet", { credentials: "include" });
      const data = await response.json();

      if (data.authenticated && data.wallet) {
        // Update with actual data
        document.getElementById("profile-name").textContent =
          data.user?.name || "Player";
        document.getElementById("profile-email").textContent =
          data.user?.email || "";
        document.getElementById(
          "profile-wallet-addr",
        ).textContent = `${data.wallet.slice(0, 8)}...${data.wallet.slice(-6)}`;
        document.getElementById("profile-jbks").textContent = `${(
          data.tokenBalance || 0
        ).toFixed(2)} $JBKS`;
        document.getElementById("profile-sol").textContent = `${(
          data.solBalance || 0
        ).toFixed(4)} SOL`;

        // Set avatar initial
        const name = data.user?.name || "?";
        const initial = name.charAt(0).toUpperCase();
        document.getElementById("profile-modal-avatar").textContent = initial;
      } else {
        // Show error state
        document.getElementById("profile-jbks").innerHTML =
          '<span style="color:#ff6666;">Failed to load</span>';
        document.getElementById("profile-sol").innerHTML =
          '<span style="color:#ff6666;">Failed to load</span>';
      }
    } catch (e) {
      console.error("Failed to load profile data:", e);
      document.getElementById("profile-jbks").innerHTML =
        '<span style="color:#ff6666;">Error loading</span>';
      document.getElementById("profile-sol").innerHTML =
        '<span style="color:#ff6666;">Error loading</span>';
    }

    // Check daily claim availability
    this._updateDailyClaimButton();

    // Disable game controls while profile is open
    if (window.self_player?.world?.controls) {
      window.self_player.world.controls._inventoryOpen = true;
    }

    this.profileModal.classList.add("open");
  }

  _closeProfile() {
    this.profileModal.classList.remove("open");

    // Re-enable game controls
    if (window.self_player?.world?.controls) {
      window.self_player.world.controls._inventoryOpen = false;
    }
  }

  _updateDailyClaimButton() {
    const btn = document.getElementById("profile-claim-btn");
    const status = document.getElementById("profile-claim-status");
    if (!btn || !status) return;

    const lastClaim = localStorage.getItem("last_daily_claim");
    if (lastClaim) {
      const elapsed = Date.now() - parseInt(lastClaim);
      const oneDay = 24 * 60 * 60 * 1000;
      if (elapsed < oneDay) {
        const hoursLeft = Math.ceil((oneDay - elapsed) / (60 * 60 * 1000));
        btn.disabled = true;
        btn.textContent = `⏳ CLAIMED`;
        status.textContent = `Next claim in ${hoursLeft}h`;
        return;
      }
    }

    btn.disabled = false;
    btn.textContent = "🎁 CLAIM DAILY REWARD";
    status.textContent = "10 $JBKS available now!";
    status.style.color = "#14F195";
  }

  async _claimDaily() {
    const btn = document.getElementById("profile-claim-btn");
    const status = document.getElementById("profile-claim-status");
    if (!btn || btn.disabled) return;

    btn.disabled = true;
    btn.textContent = "⏳ Claiming...";

    try {
      const response = await fetch("/api/token/claim-daily", {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();

      if (data.success) {
        localStorage.setItem("last_daily_claim", Date.now().toString());
        status.textContent = `✅ +${data.reward} $JBKS claimed!`;
        status.style.color = "#14F195";
        btn.textContent = "⏳ CLAIMED";

        // Refresh balance display
        document.getElementById("profile-jbks").textContent = `${(
          data.newBalance || 0
        ).toFixed(2)} $JBKS`;

        this._setStatus(
          `🎁 +${data.reward} $JBKS daily reward claimed!`,
          "#14F195",
        );

        // Also update the feedback system display
        if (window.feedbackSystem) {
          window.feedbackSystem.updateCreditsDisplay(data.newBalance || 0, 1);
        }

        // Also fetch and update from server to ensure consistency
        this._refreshBalanceDisplay();
      } else {
        status.textContent = data.error || "Already claimed";
        status.style.color = "#ff6666";
        btn.disabled = false;
        btn.textContent = "🎁 CLAIM DAILY REWARD";
      }
    } catch (e) {
      status.textContent = "Claim failed";
      status.style.color = "#ff6666";
      btn.disabled = false;
      btn.textContent = "🎁 CLAIM DAILY REWARD";
    }
  }

  async _refreshBalanceDisplay() {
    try {
      const response = await fetch("/api/wallet", { credentials: "include" });
      const data = await response.json();

      if (data.authenticated && data.wallet) {
        if (window.feedbackSystem) {
          window.feedbackSystem.updateCreditsDisplay(
            Math.floor(data.tokenBalance || 0),
            data.user?.level || 1,
          );
        }
        document.getElementById("profile-jbks").textContent = `${(
          data.tokenBalance || 0
        ).toFixed(2)} $JBKS`;
      }
    } catch (e) {}
  }

  async checkAuthStatus() {
    try {
      const response = await fetch("/api/auth/status", {
        credentials: "include",
      });
      const data = await response.json();
      if (data.authenticated) {
        await this.loadWallet();
      }
    } catch (e) {
      console.error("Error checking auth status:", e);
    }
  }

  async login() {
    try {
      this._setButtonLoading(true);
      this._setStatus("Opening login window...", "#ffaa00");

      const response = await fetch("/auth/login-url", {
        credentials: "include",
      });
      const { loginUrl } = await response.json();

      const width = 500,
        height = 700;
      const left = (screen.width - width) / 2;
      const top = (screen.height - height) / 2;

      this.authWindow = window.open(
        loginUrl,
        "Civic Auth",
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`,
      );

      if (!this.authWindow || this.authWindow.closed) {
        this._setButtonLoading(false);
        this._setStatus("Popup blocked — please allow popups", "#ff6666");
        return;
      }

      this._setStatus(
        "Please complete authentication in the popup...",
        "#ffaa00",
      );

      // Poll for popup close
      const pollClosed = setInterval(async () => {
        if (this.authWindow?.closed) {
          clearInterval(pollClosed);
          console.log("Popup closed, fetching wallet...");

          // Popup closed - try to fetch wallet (cookies should be set)
          this._setStatus(
            "Authentication complete! Loading wallet...",
            "#ffaa00",
          );

          // Wait a moment for cookies to be fully set
          await new Promise((resolve) => setTimeout(resolve, 1500));

          // Fetch wallet
          const success = await this._loadWalletWithRetry(8, 1000);

          if (!success) {
            this._setButtonLoading(false);
            this._setStatus("Could not load wallet after login", "#ff6666");
          }
        }
      }, 1500);

      // Also listen for direct messages as backup
      // const messageHandler = async (event) => {
      //   if (event.data?.type === "CIVIC_AUTH_SUCCESS") {
      //     console.log("Received auth success message");
      //     clearInterval(pollClosed);
      //     window.removeEventListener("message", messageHandler);

      //     this._setStatus(
      //       "Authentication successful! Loading wallet...",
      //       "#ffaa00",
      //     );
      //     await new Promise((resolve) => setTimeout(resolve, 1000));
      //     await this._loadWalletWithRetry(5, 1000);
      //   }
      // };
      // window.addEventListener("message", messageHandler);
    } catch (e) {
      console.error("Error initiating login:", e);
      this._setButtonLoading(false);
      this._setStatus("Login failed", "#ff6666");
    }
  }

  async loadWallet() {
    return this._loadWalletWithRetry(3, 800);
  }

  async _loadWalletWithRetry(maxAttempts = 5, delayMs = 1000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`🔄 Wallet load attempt ${attempt}/${maxAttempts}...`);

      // Update status message
      this._setStatus(
        `Connecting to blockchain... (${attempt}/${maxAttempts})`,
        "#ffaa00",
      );

      try {
        const response = await fetch("/api/wallet", { credentials: "include" });
        const data = await response.json();

        if (data.authenticated && data.wallet) {
          // Success - update everything
          this.walletAddress = data.wallet;
          this.isAuthenticated = true;

          const name = data.user?.name || data.wallet.slice(0, 6);
          const initial = name.charAt(0).toUpperCase();
          this._setButtonConnected(name, initial);
          this._setButtonLoading(false);
          this._setStatus(`✅ Signed in as ${name}`, "#14F195");

          // Dispatch wallet-ready event
          window.dispatchEvent(
            new CustomEvent("wallet-ready", {
              detail: { address: this.walletAddress, user: data.user },
            }),
          );

          // Send to socket
          if (window.socket && window.socket.connected) {
            window.socket.emit("walletConnected", {
              wallet: this.walletAddress,
            });
          }

          // Update store display
          if (window.storeUI) {
            window.storeUI.updateWalletDisplay();
          }

          console.log(`✅ Wallet loaded on attempt ${attempt}`);
          return true;
        } else {
          console.log(
            `⏳ Not authenticated yet (attempt ${attempt}), retrying...`,
          );
          this._setStatus(
            `Waiting for authentication... (${attempt}/${maxAttempts})`,
            "#ffaa00",
          );
        }
      } catch (e) {
        console.warn(`⚠️ Wallet fetch failed (attempt ${attempt}):`, e);
        this._setStatus(
          `Connection issue, retrying... (${attempt}/${maxAttempts})`,
          "#ffaa00",
        );
      }

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    // All attempts failed
    this._setButtonLoading(false);
    console.error("❌ Failed to load wallet after all attempts");
    this._setStatus("Sign in failed — please refresh", "#ff6666");
    return false;
  }

  async logout() {
    this._closeProfile();
    try {
      const response = await fetch("/api/auth/logout", {
        credentials: "include",
      });
      const data = await response.json();

      if (data.logoutUrl) {
        // Open logout silently in background iframe instead of popup
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.src = data.logoutUrl;
        document.body.appendChild(iframe);
        setTimeout(() => iframe.remove(), 3000);
      }
    } catch (e) {
      console.error("Logout error:", e);
    }

    this.walletAddress = null;
    this.isAuthenticated = false;
    this._setButtonDisconnected();
    this._setStatus("Signed out", "#aaa");
    localStorage.removeItem("last_daily_claim");

    window.dispatchEvent(new CustomEvent("wallet-logout"));
  }

  getWalletAddress() {
    return this.walletAddress;
  }
  isLoggedIn() {
    return this.isAuthenticated;
  }

  updateLeaderboard() {} // stub for compatibility
}
