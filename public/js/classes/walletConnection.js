import { WalletModal, walletModalStyles } from "./walletModal.js";
import { setUserPublicKey, clearUserPublicKey, getUserPublicKey } from "./walletState.js";

// Event name for wallet changes
const WALLET_CHANGE_EVENT = 'wallet-changed';

export function createSolanaWalletButton(buttonSelector, onWalletChange = null) {
  const connectBtn = document.querySelector(buttonSelector);
  if (!connectBtn) return;

  const modal = new WalletModal();
  injectStyles(walletModalStyles);

  let originalText = connectBtn.textContent;
  connectBtn.dataset.connected = "false";

  function getAvailableWallets() {
    const wallets = [];
    if (window.solana?.isPhantom) wallets.push({ name: "Phantom", provider: window.solana });
    if (window.backpack?.solana) wallets.push({ name: "Backpack", provider: window.backpack.solana });
    if (window.solflare?.isSolflare) wallets.push({ name: "Solflare", provider: window.solflare });
    return wallets;
  }

  function dispatchWalletChangeEvent() {
    window.dispatchEvent(new CustomEvent(WALLET_CHANGE_EVENT, {
      detail: { publicKey: getUserPublicKey() }
    }));
  }

  async function connect(wallet) {
    try {
      const walletProvider = wallet.provider;
      const res = await walletProvider.connect();
      const publicKey = res?.publicKey?.toString() || walletProvider.publicKey?.toString();
      const displayKey = `${publicKey.slice(0, 6)}...${publicKey.slice(-4)}`;
      
      setUserPublicKey(publicKey);
      connectBtn.textContent = displayKey;
      connectBtn.dataset.content = displayKey;
      connectBtn.dataset.connected = "true";
      connectBtn.dataset.walletName = wallet.name;
      
      console.log(`${wallet.name} connected:`, publicKey);
      dispatchWalletChangeEvent();
      
      if (onWalletChange) onWalletChange(publicKey);

      walletProvider.on?.("disconnect", () => {
        disconnectWallet(wallet);
      });
    } catch (err) {
      console.error(`${wallet.name} connection failed:`, err);
    }
  }

  async function disconnectWallet(wallet) {
    try {
      if (wallet.provider.disconnect) {
        await wallet.provider.disconnect();
      }
      clearUserPublicKey();
      connectBtn.textContent = originalText;
      connectBtn.dataset.content = originalText;
      connectBtn.dataset.connected = "false";
      connectBtn.dataset.walletName = "";
      
      console.log(`${wallet.name} disconnected.`);
      dispatchWalletChangeEvent();
      
      if (onWalletChange) onWalletChange(null);
    } catch (err) {
      console.error(`Failed to disconnect ${wallet.name}:`, err);
    }
  }

  connectBtn.addEventListener("click", async () => {
    const wallets = getAvailableWallets();

    if (connectBtn.dataset.connected === "true") {
      const walletName = connectBtn.dataset.walletName;
      const wallet = wallets.find((w) => w.name === walletName);
      if (wallet) {
        await disconnectWallet(wallet);
      }
      return;
    }

    if (wallets.length === 0) {
      alert("No supported wallets found. Please install Phantom, Backpack, or Solflare.");
      window.open("https://phantom.app", "_blank");
      return;
    }

    if (wallets.length === 1) {
      await connect(wallets[0]);
    } else {
      modal.open(wallets, async (selectedWallet) => {
        await connect(selectedWallet);
      });
    }
  });

  // Auto-connect on load
  window.addEventListener("load", async () => {
    const wallets = getAvailableWallets();
    for (const wallet of wallets) {
      try {
        const res = await wallet.provider.connect({ onlyIfTrusted: true });
        const publicKey = res?.publicKey?.toString() || wallet.provider.publicKey?.toString();
        
        if (publicKey) {
          setUserPublicKey(publicKey);
          const displayKey = `${publicKey.slice(0, 6)}...${publicKey.slice(-4)}`;
          connectBtn.textContent = displayKey;
          connectBtn.dataset.content = displayKey;
          connectBtn.dataset.connected = "true";
          connectBtn.dataset.walletName = wallet.name;
          
          console.log(`Auto-connected ${wallet.name}:`, publicKey);
          dispatchWalletChangeEvent();
          
          if (onWalletChange) onWalletChange(publicKey);
          break;
        }
      } catch (err) {
        console.debug(`Silent connect failed for ${wallet.name}`);
      }
    }
  });

  return {
    onWalletChange: (callback) => {
      window.addEventListener(WALLET_CHANGE_EVENT, (e) => {
        callback(e.detail.publicKey);
      });
    }
  };
}

function injectStyles(styleStr) {
  const style = document.createElement("style");
  style.textContent = styleStr;
  document.head.appendChild(style);
}