// let userPublicKey = localStorage.getItem("userPublicKey") || null;

// export function setUserPublicKey(key) {
//   userPublicKey = key;
//   localStorage.setItem("userPublicKey", key);
// }

// export function getUserPublicKey() {
//   return userPublicKey;
// }

// export function clearUserPublicKey() {
//   userPublicKey = null;
//   localStorage.removeItem("userPublicKey");
// }

// export function isWalletConnected() {
//   const publicKey = getUserPublicKey();
//   const wallet = window.solana || window.solflare;
//   return !!publicKey && !!wallet && wallet.isConnected;
// }

// export async function ensureWalletConnected() {
//   if (!isWalletConnected()) {
//     const wallet = window.solana || window.solflare;
//     if (wallet) {
//       try {
//         await wallet.connect();
//         return true;
//       } catch (error) {
//         console.error("Wallet connection failed:", error);
//         return false;
//       }
//     }
//     return false;
//   }
//   return true;
// }

// walletState.js — Devnet-aware wallet state
// Uses sessionStorage (not localStorage) since devnet keys shouldn't persist long-term

let userPublicKey = sessionStorage.getItem("userPublicKey") || null;
const NETWORK = "devnet";

export function setUserPublicKey(key) {
    userPublicKey = key;
    sessionStorage.setItem("userPublicKey", key);
}

export function getUserPublicKey() {
    return userPublicKey;
}

export function clearUserPublicKey() {
    userPublicKey = null;
    sessionStorage.removeItem("userPublicKey");
}

export function isWalletConnected() {
    const publicKey = getUserPublicKey();
    const wallet    = window.solana || window.solflare;
    return !!publicKey && !!wallet && wallet.isConnected;
}

export function getNetwork() {
    return NETWORK;
}

export async function ensureWalletConnected() {
    if (isWalletConnected()) return true;

    const wallet = window.solana || window.solflare;
    if (!wallet) {
        console.warn("No Solana wallet found. Install Phantom or Solflare.");
        return false;
    }

    try {
        const resp = await wallet.connect();
        const pk   = resp.publicKey?.toString() || wallet.publicKey?.toString();
        if (pk) {
            setUserPublicKey(pk);
            console.log(`✅ Wallet connected (${NETWORK}): ${pk.slice(0,8)}…`);

            // Request airdrop on devnet if balance is low
            await _requestDevnetAirdropIfNeeded(pk);
            return true;
        }
    } catch (err) {
        console.error("Wallet connection failed:", err.message);
    }
    return false;
}

// Airdrop 1 SOL on devnet if balance < 0.1 SOL
async function _requestDevnetAirdropIfNeeded(publicKeyStr) {
    try {
        const { Connection, PublicKey, LAMPORTS_PER_SOL } = await import("@solana/web3.js");
        const conn   = new Connection("https://api.devnet.solana.com", "confirmed");
        const pk     = new PublicKey(publicKeyStr);
        const bal    = await conn.getBalance(pk);

        if (bal < 0.1 * LAMPORTS_PER_SOL) {
            console.log("💧 Requesting devnet airdrop (1 SOL)…");
            const sig = await conn.requestAirdrop(pk, LAMPORTS_PER_SOL);
            await conn.confirmTransaction(sig, "confirmed");
            console.log("✅ Airdrop confirmed:", sig);
        } else {
            console.log(`💰 Devnet balance: ${(bal / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
        }
    } catch (err) {
        // Airdrop failures are non-critical (rate limits etc.)
        console.warn("Devnet airdrop skipped:", err.message);
    }
}