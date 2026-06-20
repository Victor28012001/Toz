// client/src/classes/StoreUI.js

import NotificationPopup from "./NotificationPopup.js";
import ConfirmModal from "./ConfirmModal.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";

export default class StoreUI {
  constructor(socket) {
    this.socket = socket;
    this.isOpen = false;
    this.modal = null;
    this.currentCategory = "all";
    this.items = [];
    this.rotatingItems = [];
    this.nextRefresh = 0;
    this.timerInterval = null;
    this.isProcessing = false;
    this.currentPurchase = null;

    // Store previous pointer lock state
    this.wasPointerLocked = false;

    // Initialize notification systems
    this.notifications = new NotificationPopup();
    this.confirmModal = new ConfirmModal();

    this.createUI();
    this.setupSocketListeners();

    // Add resize listener to handle responsive layout
    window.addEventListener("resize", () => this.renderItems());
  }

  createUI() {
    if (document.getElementById("store-modal")) return;

    this.modal = document.createElement("div");
    this.modal.id = "store-modal";
    this.modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.95);
            z-index: 102;
            display: none;
            font-family: 'Orbitron', monospace;
            overflow-y: auto;
        `;

    // Add responsive styles
    const style = document.createElement("style");
    style.textContent = `
            @media screen and (max-width: 950px) {
                #store-items-grid {
                    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)) !important;
                    gap: 12px !important;
                }
                .store-item-card {
                    padding: 10px !important;
                }
                .store-item-icon {
                    width: 60px !important;
                    height: 60px !important;
                }
                .store-item-name {
                    font-size: 10px !important;
                    margin: 5px 0 3px 0 !important;
                }
                .store-item-desc {
                    font-size: 8px !important;
                    margin-bottom: 8px !important;
                    line-height: 1.2 !important;
                }
                .store-item-price {
                    font-size: 12px !important;
                }
                .store-item-price small {
                    font-size: 8px !important;
                }
                .store-buy-btn {
                    padding: 4px 8px !important;
                    font-size: 10px !important;
                }
                .store-category-btn {
                    padding: 6px 12px !important;
                    font-size: 11px !important;
                }
                .store-balance {
                    font-size: 11px !important;
                    padding: 4px 8px !important;
                }
                .store-balance span {
                    font-size: 11px !important;
                }
                .store-header h2 {
                    font-size: 18px !important;
                }
                .store-header{
                    justify-content: space-around !important;
                }
                .store-refresh-timer {
                    font-size: 9px !important;
                    margin-bottom: 10px !important;
                }
                .daily-deals-title {
                    font-size: 14px !important;
                    margin: 5px 0 !important;
                }
                .regular-title {
                    font-size: 14px !important;
                    margin: 5px 0 !important;
                }
                .discount-badge {
                    font-size: 8px !important;
                    padding: 2px 6px !important;
                    top: -6px !important;
                    right: -6px !important;
                }
            }
            
            @media screen and (max-width: 480px) {
                #store-items-grid {
                    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)) !important;
                    gap: 8px !important;
                }
                .store-item-icon {
                    width: 50px !important;
                    height: 50px !important;
                }
                .store-item-name {
                    font-size: 9px !important;
                }
                .store-item-desc {
                    display: none !important;
                }
                .store-item-price {
                    font-size: 11px !important;
                }
                .store-buy-btn {
                    padding: 3px 6px !important;
                    font-size: 9px !important;
                }
                .category-buttons {
                    gap: 6px !important;
                    margin-bottom: 15px !important;
                }
                .store-category-btn {
                    padding: 4px 8px !important;
                    font-size: 9px !important;
                }
            }
        `;
    document.head.appendChild(style);

    this.modal.innerHTML = `
            <div style="max-width: 1200px; margin: 0 auto; padding: 20px;">
                <div class="store-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid rgba(255,170,0,0.3); padding-bottom: 15px;">
                    <h2 style="color: #ffaa00; margin: 0;">🛒 STORE</h2>
                    <div style="display: flex; align-items: center; gap: 20px;">
                        <div class="store-balance" style="background: rgba(0,0,0,0.5); padding: 8px 16px; border-radius: 8px;">
                            <span style="color: #ffaa00;">💰 Wallet: </span>
                            <span id="store-wallet" style="color: #14F195; font-weight: bold;">Not connected</span>
                        </div>
                        <button id="close-store" style="
                            background: none;
                            border: none;
                            color: white;
                            width: 40px;
                            height: 40px;
                            border-radius: 50%;
                            cursor: pointer;
                            font-size: 20px;
                        ">✕</button>
                    </div>
                </div>

                <div id="store-refresh-timer" class="store-refresh-timer" style="text-align: right; margin-bottom: 15px; font-size: 12px; color: #ffaa00;"></div>

                <div class="category-buttons" style="display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;">
                    <button class="store-category store-category-btn" data-category="all" style="background: #ffaa00; color: #000; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">ALL</button>
                    <button class="store-category store-category-btn" data-category="weapon" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,170,0,0.3); color: #fff; padding: 8px 16px; border-radius: 4px; cursor: pointer;">🔫 WEAPONS</button>
                    <button class="store-category store-category-btn" data-category="consumable" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,170,0,0.3); color: #fff; padding: 8px 16px; border-radius: 4px; cursor: pointer;">📦 CONSUMABLES</button>
                    <button class="store-category store-category-btn" data-category="cosmetic" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,170,0,0.3); color: #fff; padding: 8px 16px; border-radius: 4px; cursor: pointer;">🎨 COSMETICS</button>
                    <button class="store-category store-category-btn" data-category="boost" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,170,0,0.3); color: #fff; padding: 8px 16px; border-radius: 4px; cursor: pointer;">⚡ BOOSTS</button>
                </div>

                <div id="store-items-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px;">
                </div>
            </div>
        `;

    document.body.appendChild(this.modal);

    // Close button
    document
      .getElementById("close-store")
      .addEventListener("click", () => this.close());

    // Category buttons
    document.querySelectorAll(".store-category").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.currentCategory = btn.dataset.category;

        // Update button styles
        document.querySelectorAll(".store-category").forEach((b) => {
          if (b.dataset.category === this.currentCategory) {
            b.style.background = "#ffaa00";
            b.style.color = "#000";
          } else {
            b.style.background = "rgba(255,255,255,0.1)";
            b.style.color = "#fff";
          }
        });

        this.loadItems();
      });
    });

    // Load initial items
    this.loadItems();
  }

  updateWalletDisplay() {
    const walletSpan = document.getElementById("store-wallet");
    if (!walletSpan) return;

    // Check VanillaWalletUI
    const address = window.walletUI?.getWalletAddress?.();
    if (address) {
      walletSpan.textContent = `${address.slice(0, 6)}...${address.slice(-4)}`;
      walletSpan.style.color = "#14F195";
    } else {
      walletSpan.textContent = "Not connected";
      walletSpan.style.color = "#ff6666";
    }
  }

  setupSocketListeners() {
    if (!this.socket) return;

    this.socket.on("storeRefreshed", (data) => {
      this.rotatingItems = data.rotatingItems;
      this.nextRefresh = data.nextRefresh;
      this.updateRefreshTimer();
      this.loadItems();
    });

    // ✅ Update display whenever wallet connects
    window.addEventListener("wallet-ready", () => {
      this.updateWalletDisplay();
    });
  }

  loadItems() {
    if (!this.socket || !this.socket.connected) return;

    this.socket.emit(
      "store-getItems",
      {
        category: this.currentCategory === "all" ? null : this.currentCategory,
      },
      (response) => {
        if (response && response.success) {
          this.items = response.items || [];
          this.rotatingItems = response.rotatingItems || [];
          this.nextRefresh = response.nextRefresh || 0;
          this.renderItems();
          this.updateRefreshTimer();
          this.updateBalance();
        }
      },
    );
  }

  renderItems() {
    const grid = document.getElementById("store-items-grid");
    if (!grid) return;

    const isMobile = window.innerWidth <= 950;

    // Separate rotating items (daily deals)
    const rotatingIds = (this.rotatingItems || []).map((i) => i.id);
    const rotatingItemsToShow = (this.items || []).filter((i) =>
      rotatingIds.includes(i.id),
    );
    const regularItems = (this.items || []).filter(
      (i) => !rotatingIds.includes(i.id),
    );

    let html = "";

    // Rotating items section
    if (rotatingItemsToShow.length > 0 && this.currentCategory === "all") {
      html += `
                <div style="grid-column: 1 / -1; margin: 10px 0 5px 0;">
                    <h3 class="daily-deals-title" style="color: #ffaa00; font-size: 16px; margin: 10px 0;">🔥 DAILY DEALS</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(${
                      isMobile ? "140px" : "200px"
                    }, 1fr)); gap: ${isMobile ? "12px" : "20px"};">
            `;

      rotatingItemsToShow.forEach((item) => {
        const discountedPrice = item.discount
          ? Math.floor(item.price * (1 - item.discount / 100))
          : item.price;

        html += this.createItemCard(item, true, discountedPrice);
      });

      html += `</div></div>`;
    }

    // Regular items
    if (regularItems.length > 0) {
      html += `
                <div style="grid-column: 1 / -1; margin: 10px 0 5px 0;">
                    <h3 class="regular-title" style="color: #fff; font-size: 16px; margin: 10px 0;">📦 REGULAR ITEMS</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(${
                      isMobile ? "140px" : "200px"
                    }, 1fr)); gap: ${isMobile ? "12px" : "20px"};">
            `;

      regularItems.forEach((item) => {
        html += this.createItemCard(item, false);
      });

      html += `</div></div>`;
    }

    grid.innerHTML =
      html ||
      '<div style="grid-column: 1/-1; text-align: center; padding: 40px;">No items available</div>';

    // Add buy button listeners
    document.querySelectorAll(".buy-item-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const itemId = btn.dataset.itemId;
        const itemName = btn.dataset.itemName;
        const price = parseInt(btn.dataset.price);

        this.purchaseItem(itemId, itemName, price);
      });
    });

    // Add watch ad button listeners
    document.querySelectorAll(".watch-ad-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const itemId = btn.dataset.itemId;
        const itemName = btn.dataset.itemName;
        const itemPrice = parseInt(btn.dataset.itemPrice);
        this.watchAdForItem(itemId, itemName, itemPrice);
      });
    });
  }

  createItemCard(item, isDeal = false, discountedPrice = null) {
    const finalPrice = discountedPrice || item.price;
    const originalPrice = item.price;
    const discountPercent = item.discount || 0;
    const isMobile = window.innerWidth <= 950;

    return `
    <div class="store-item-card" style="
      background: rgba(20,20,40,0.9);
      border: 1px solid ${isDeal ? "#ffaa00" : "rgba(255,255,255,0.1)"};
      border-radius: 8px;
      padding: ${isMobile ? "10px" : "15px"};
      transition: transform 0.2s;
      position: relative;
      display: flex;
      flex-direction: column;
      aspect-ratio: 1 / 1;
    ">
      ${
        isDeal
          ? `<div class="discount-badge" style="position: absolute; top: -10px; right: -10px; background: #ffaa00; color: #000; padding: 4px 8px; border-radius: 20px; font-size: 12px; font-weight: bold;">-${discountPercent}%</div>`
          : ""
      }
      
      <div style="text-align: center; margin-bottom: 10px; flex-shrink: 0;">
        <img class="store-item-icon" src="${item.icon}" alt="${
      item.name
    }" style="width: ${isMobile ? "60px" : "80px"}; height: ${
      isMobile ? "60px" : "80px"
    }; object-fit: contain; border-radius: 8px; margin: 0 auto;" onerror="this.src='/assets/ui/default.png'">
      </div>
      
      <h4 class="store-item-name" style="margin: ${
        isMobile ? "5px 0 3px 0" : "10px 0 5px 0"
      }; color: #fff; font-size: ${
      isMobile ? "10px" : "14px"
    }; text-align: center;">${item.name}</h4>
      
      <p class="store-item-desc" style="font-size: ${
        isMobile ? "8px" : "11px"
      }; color: #aaa; margin-bottom: ${
      isMobile ? "8px" : "10px"
    }; text-align: center; line-height: 1.2; flex-grow: 1;">${
      item.description
    }</p>
      
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: auto; gap: ${
        isMobile ? "5px" : "10px"
      };">
        <div class="store-item-price" style="flex-shrink: 0;">
          ${
            isDeal && originalPrice > finalPrice
              ? `<span style="text-decoration: line-through; color: #888; font-size: ${
                  isMobile ? "8px" : "10px"
                };">${originalPrice}</span>
             <span style="color: #ffaa00; font-weight: bold; font-size: ${
               isMobile ? "12px" : "16px"
             };">${finalPrice}</span>`
              : `<span style="color: #ffaa00; font-weight: bold; font-size: ${
                  isMobile ? "12px" : "16px"
                };">${finalPrice}</span>`
          }
          <span style="color: #14F195; font-size: ${
            isMobile ? "8px" : "10px"
          };"> $JBKS</span>
        </div>
        <div style="display: flex; gap: 5px;">
          <button class="watch-ad-btn" data-item-id="${
            item.id
          }" data-item-name="${
      item.name
    }" data-item-price="${finalPrice}" style="
            background: linear-gradient(135deg, #9945FF, #14F195);
            border: none;
            color: white;
            padding: ${isMobile ? "4px 8px" : "6px 12px"};
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            font-size: ${isMobile ? "8px" : "10px"};
            white-space: nowrap;
          ">📺 FREE</button>
          <button class="buy-item-btn store-buy-btn" data-item-id="${
            item.id
          }" data-item-name="${item.name}" data-price="${finalPrice}" style="
            background: linear-gradient(135deg, #ffaa00, #ff6600);
            border: none;
            color: #000;
            padding: ${isMobile ? "4px 8px" : "6px 12px"};
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            font-size: ${isMobile ? "10px" : "12px"};
            white-space: nowrap;
          ">BUY</button>
        </div>
      </div>
    </div>
  `;
  }

  async purchaseItem(itemId, itemName, price) {
    if (this.isProcessing) {
      this.notifications.warning("Purchase in progress...", 2000);
      return;
    }

    if (!window.walletUI || !window.walletUI.isLoggedIn()) {
      this.notifications.error("Please sign in first!", 3000);
      window.walletUI?.login();
      return;
    }

    const confirmed = await this.confirmModal.show({
      icon: "💎",
      title: "Confirm Purchase",
      message: `Purchase ${itemName} for ${price} $JBKS?`,
    });

    if (!confirmed) {
      this.notifications.info("Purchase cancelled", 2000);
      return;
    }

    this.isProcessing = true;
    const loadingNotif = this.notifications.show(
      `Processing purchase of ${itemName}...`,
      "info",
      0,
    );

    try {
      // ✅ Step 1: Request transaction from server via HTTP
      const initRes = await fetch("/api/store/purchase", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, quantity: 1 }),
      });
      const initData = await initRes.json();

      if (loadingNotif?.parentNode)
        loadingNotif.parentNode.removeChild(loadingNotif);

      if (!initData.success && !initData.requiresSignature) {
        this.isProcessing = false;
        this.notifications.error(
          `❌ ${initData.error || "Purchase failed"}`,
          4000,
        );
        return;
      }

      if (initData.requiresSignature) {
        await this._signAndConfirmPurchase(initData, itemId, itemName);
      }
    } catch (e) {
      if (loadingNotif?.parentNode)
        loadingNotif.parentNode.removeChild(loadingNotif);
      this.isProcessing = false;
      console.error("Purchase error:", e);
      this.notifications.error("Purchase failed: " + e.message, 4000);
    }
  }

  async _signAndConfirmPurchase(initData, itemId, itemName) {
    const signNotif = this.notifications.show(
      "Authorizing payment...",
      "info",
      0,
    );

    try {
      // ✅ Check if Civic wallet is available for client-side signing
      if (window.civicWallet?.isReady && initData.transaction) {
        // Use Civic embedded wallet to sign the transaction
        const signNotif2 = this.notifications.show(
          "Please approve in Civic wallet...",
          "info",
          0,
        );

        try {
          const signature = await window.civicWallet.signAndSendTransaction(
            initData.transaction,
          );

          if (signNotif2?.parentNode)
            signNotif2.parentNode.removeChild(signNotif2);

          // Confirm with server
          const confirmRes = await fetch("/api/store/confirm-purchase-signed", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ itemId, quantity: 1, signature }),
          });
          const confirmData = await confirmRes.json();

          if (signNotif?.parentNode)
            signNotif.parentNode.removeChild(signNotif);

          if (confirmData.success) {
            this.isProcessing = false;
            this.notifications.success(`✅ Purchased ${itemName}!`, 3000);
            this.updateBalance();
            this.loadItems();
            this.animatePurchase(itemId);

            // Apply item via socket
            if (this.socket) {
              this.socket.emit(
                "store-purchase",
                {
                  itemId,
                  quantity: 1,
                  serverConfirmed: true,
                },
                () => {},
              );
            }
          } else {
            throw new Error(confirmData.error || "Purchase failed");
          }
          return;
        } catch (walletErr) {
          if (signNotif2?.parentNode)
            signNotif2.parentNode.removeChild(signNotif2);
          console.warn(
            "Civic wallet signing failed, falling back:",
            walletErr.message,
          );
          // Fall through to server-side confirmation
        }
      }

      // ✅ Fallback: server-authoritative purchase (ledger-based)
      const confirmRes = await fetch("/api/store/confirm-purchase", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, quantity: 1, authorized: true }),
      });
      const confirmData = await confirmRes.json();

      if (signNotif?.parentNode) signNotif.parentNode.removeChild(signNotif);

      if (confirmData.success) {
        this.isProcessing = false;
        this.notifications.success(`✅ Purchased ${itemName}!`, 3000);
        this.updateBalance();
        this.loadItems();
        this.animatePurchase(itemId);

        if (this.socket) {
          this.socket.emit(
            "store-purchase",
            {
              itemId,
              quantity: 1,
              serverConfirmed: true,
            },
            () => {},
          );
        }
      } else {
        this.isProcessing = false;
        this.notifications.error(
          `❌ ${confirmData.error || "Purchase failed"}`,
          4000,
        );
      }
    } catch (e) {
      if (signNotif?.parentNode) signNotif.parentNode.removeChild(signNotif);
      this.isProcessing = false;
      this.notifications.error("Payment failed: " + e.message, 4000);
    }
  }

  async handleTransactionSignature(response, itemId, itemName) {
    try {
      // Get the Civic user context from the global store
      // This should be set by VanillaWalletUI after successful login
      const userContext = window.civicUserContext;

      if (!userContext) {
        this.notifications.error(
          "Civic wallet not available. Please log in again.",
          5000,
        );
        return;
      }

      // Check if user has a wallet
      const userHasWallet = userContext.solana && userContext.solana.wallet;

      if (!userHasWallet) {
        // User doesn't have a wallet yet - create one
        this.notifications.show("Creating your secure wallet...", "info", 0);
        await userContext.createWallet();
        // Wait a moment for wallet to be ready
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Refresh user context
        const refreshedContext = window.civicUserContext;
        if (!refreshedContext?.solana?.wallet) {
          throw new Error("Wallet creation failed");
        }
      }

      // Now we have access to the wallet
      const { wallet, address } = userContext.solana;
      console.log(`💰 Using Civic wallet: ${address}`);

      // Show signing notification
      const signNotif = this.notifications.show(
        "Please approve the transaction in Civic wallet...",
        "info",
        0,
      );

      // Deserialize the transaction
      const { Transaction, Connection } = await import("@solana/web3.js");
      const transaction = Transaction.from(
        Buffer.from(response.transaction, "base64"),
      );

      // Create connection
      const connection = new Connection("https://api.devnet.solana.com");

      // Send transaction using Civic's embedded wallet
      // The wallet follows Solana Wallet Adapter interface
      const signature = await wallet.sendTransaction(transaction, connection);

      if (signNotif && signNotif.parentNode) {
        signNotif.parentNode.removeChild(signNotif);
      }

      // Show confirmation notification
      const confirmNotif = this.notifications.show(
        "Confirming transaction...",
        "info",
        0,
      );

      // Wait for confirmation
      await connection.confirmTransaction(signature, "confirmed");

      if (confirmNotif && confirmNotif.parentNode) {
        confirmNotif.parentNode.removeChild(confirmNotif);
      }

      // Send the signature back to server
      this.socket.emit(
        "store-purchase",
        {
          itemId: response.itemId,
          quantity: response.quantity,
          signature: signature,
        },
        (finalResponse) => {
          this.isProcessing = false;

          if (finalResponse && finalResponse.success) {
            this.notifications.success(`✅ Purchased ${itemName}!`, 3000);
            this.updateBalance();
            this.loadItems();
            this.animatePurchase(itemId);
          } else {
            this.notifications.error(
              `Purchase failed: ${finalResponse?.message || "Unknown error"}`,
              4000,
            );
          }
        },
      );
    } catch (error) {
      this.isProcessing = false;
      console.error("Transaction failed:", error);
      this.notifications.error(
        error.message || "Transaction failed. Please try again.",
        4000,
      );
    }
  }

  async watchAdForItem(itemId, itemName, itemPrice) {
    if (!window.adRewards) {
      this.notifications.error("Ads not available", 2000);
      return;
    }

    const confirmed = await this.confirmModal.show({
      icon: "📺",
      title: "Watch Ad",
      message: `Watch a short ad to get ${itemName} for free? (Save ${itemPrice} $JBKS)`,
    });

    if (!confirmed) return;

    const success = await window.adRewards.adManager.showRewardedVideo(
      (reward) => {
        // This runs when ad is fully watched
        this.claimFreeItem(itemId, itemName);
      },
      (completed) => {
        if (!completed) {
          this.notifications.error("Ad not completed. No reward given.", 3000);
        }
      },
    );

    if (!success) {
      this.notifications.error("Failed to load ad. Please try again.", 3000);
    }
  }

  claimFreeItem(itemId, itemName) {
    this.isProcessing = true;

    this.socket.emit(
      "store-purchase",
      { itemId, quantity: 1, free: true },
      (response) => {
        this.isProcessing = false;
        if (response && response.success) {
          this.notifications.success(
            `🎉 You received ${itemName} for free!`,
            3000,
          );
          this.updateBalance();
          this.loadItems();
          this.animatePurchase(itemId);
        } else {
          this.notifications.error(`Failed to claim ${itemName}`, 3000);
        }
      },
    );
  }

  animatePurchase(itemId) {
    // Find the purchased item card and add animation
    const cards = document.querySelectorAll(".store-item-card");
    for (const card of cards) {
      const btn = card.querySelector(".buy-item-btn");
      if (btn && btn.dataset.itemId === itemId) {
        card.style.animation = "purchaseGlow 0.5s ease-out";
        setTimeout(() => {
          card.style.animation = "";
        }, 500);
        break;
      }
    }
  }

  async updateBalance() {
    const walletSpan = document.getElementById("store-wallet");
    if (!walletSpan) return;

    const address = window.walletUI?.getWalletAddress?.();
    if (!address) return;

    try {
      const response = await fetch("/api/wallet", { credentials: "include" });
      const data = await response.json();
      if (data.authenticated && data.wallet) {
        walletSpan.textContent = `${data.wallet.slice(
          0,
          6,
        )}...${data.wallet.slice(-4)} · ${(data.tokenBalance || 0).toFixed(
          2,
        )} $JBKS`;
        walletSpan.style.color = "#14F195";
      }
    } catch (e) {
      // Fallback to just showing address
      walletSpan.textContent = `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
  }

  updateRefreshTimer() {
    const timerDiv = document.getElementById("store-refresh-timer");
    if (!timerDiv) return;

    const updateTimer = () => {
      const now = Date.now();
      const timeLeft = this.nextRefresh - now;

      if (timeLeft <= 0) {
        timerDiv.textContent = "Refreshing deals...";
        return;
      }

      const hours = Math.floor(timeLeft / (1000 * 60 * 60));
      const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

      timerDiv.textContent = `🔄 Daily deals refresh in: ${hours}h ${minutes}m ${seconds}s`;
    };

    updateTimer();
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(updateTimer, 1000);
  }

  async open() {
    if (this.isOpen) return;

    if (!window.walletUI || !window.walletUI.isLoggedIn()) {
      this.notifications.warning("Please sign in to access the store!", 4000);
      if (window.walletUI) window.walletUI.login();
      return;
    }

    this.wasPointerLocked = document.pointerLockElement !== null;
    if (this.wasPointerLocked && document.exitPointerLock) {
      document.exitPointerLock();
    }

    this.isOpen = true;
    this.modal.style.display = "block";

    // ✅ Always refresh wallet display when opening
    this.updateWalletDisplay();
    this.loadItems();
    this.updateBalance();

    if (window.self_player?.world?.controls) {
      window.self_player.world.controls._inventoryOpen = true;
      window.self_player.world.controls.enabled = false;
    }
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.modal.style.display = "none";

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    // Notify controls to re-enable input
    if (window.self_player?.world?.controls) {
      window.self_player.world.controls._inventoryOpen = false;
      // Re-enable controls
      window.self_player.world.controls.enabled = true;

      // ✅ Re-lock pointer if it was locked before
      if (this.wasPointerLocked && window.self_player.world.controls.blocker) {
        // Request pointer lock again
        const element = document.body;
        if (element.requestPointerLock) {
          element.requestPointerLock();
        } else if (element.mozRequestPointerLock) {
          element.mozRequestPointerLock();
        } else if (element.webkitRequestPointerLock) {
          element.webkitRequestPointerLock();
        }
      }
    }
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }
}

// Add purchase animation
const purchaseStyle = document.createElement("style");
purchaseStyle.textContent = `
    @keyframes purchaseGlow {
        0% {
            box-shadow: 0 0 0 0 rgba(0, 255, 0, 0.4);
            border-color: rgba(0, 255, 0, 0.3);
        }
        50% {
            box-shadow: 0 0 20px 10px rgba(0, 255, 0, 0.6);
            border-color: #00ff00;
            transform: scale(1.02);
        }
        100% {
            box-shadow: 0 0 0 0 rgba(0, 255, 0, 0);
            border-color: rgba(255,255,255,0.1);
        }
    }
`;
document.head.appendChild(purchaseStyle);
