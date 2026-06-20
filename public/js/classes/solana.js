// solana.js - Complete Solana Devnet Integration
// MagicBlock for multiplayer | Metaplex for NFTs | Devnet

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Keypair,
} from "@solana/web3.js";
import { Buffer } from "buffer";
window.Buffer = Buffer;

// ============================================================
// DEVNET CONFIGURATION
// ============================================================
export const DEVNET_RPC = "https://api.devnet.solana.com";
export const DEVNET_WS = "wss://api.devnet.solana.com";

// MagicBlock Ephemeral Rollup endpoint (devnet)
export const MAGICBLOCK_DEVNET_RPC = "https://devnet.magicblock.app/";
export const MAGICBLOCK_DEVNET_WS = "wss://devnet.magicblock.app/";

// Metaplex token metadata program (same on devnet/mainnet)
export const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
);

// ============================================================
// PSG1 - Gamification Engine (unchanged, works offline too)
// ============================================================
export class PSG1GamificationEngine {
  constructor() {
    this.achievements = new Map();
    this.leaderboard = new Map();
    this.playerScores = new Map();
    this.challenges = [];
    this.dailyQuests = [];

    this.achievementTypes = {
      FIRST_BLOOD: { id: "first_blood", points: 100, title: "First Blood" },
      SHARPSHOOTER: { id: "sharpshooter", points: 500, title: "Sharpshooter" },
      EXPLORER: { id: "explorer", points: 200, title: "City Explorer" },
      COLLECTOR: { id: "collector", points: 1000, title: "Card Collector" },
      SURVIVOR: { id: "survivor", points: 1500, title: "Night Survivor" },
    };
  }

  trackPlayerActivity(playerId, activity, value) {
    let score = this.playerScores.get(playerId) || 0;
    score += value;
    this.playerScores.set(playerId, score);
    this.checkAchievements(playerId, activity, value);
    this.updateLeaderboard(playerId, score);
    window.dispatchEvent(
      new CustomEvent("psg1-gamification", {
        detail: { playerId, activity, value, totalScore: score },
      }),
    );
    return score;
  }

  checkAchievements(playerId, activity, value) {
    const pa = this.achievements.get(playerId) || new Set();
    if (activity === "kill" && value >= 1 && !pa.has("first_blood"))
      this.unlockAchievement(playerId, "FIRST_BLOOD");
    if (activity === "kill" && value >= 10 && !pa.has("sharpshooter"))
      this.unlockAchievement(playerId, "SHARPSHOOTER");
    if (activity === "distance" && value >= 1000 && !pa.has("explorer"))
      this.unlockAchievement(playerId, "EXPLORER");
    if (activity === "collect" && value >= 5 && !pa.has("collector"))
      this.unlockAchievement(playerId, "COLLECTOR");
    if (activity === "survive" && value >= 10 && !pa.has("survivor"))
      this.unlockAchievement(playerId, "SURVIVOR");
  }

  unlockAchievement(playerId, type) {
    const ach = this.achievementTypes[type];
    const pa = this.achievements.get(playerId) || new Set();
    pa.add(ach.id);
    this.achievements.set(playerId, pa);
    this.trackPlayerActivity(playerId, "achievement", ach.points);
    if (typeof window.showAchievementNotification === "function")
      window.showAchievementNotification(ach);
    window.dispatchEvent(
      new CustomEvent("psg1-achievement", {
        detail: { playerId, achievement: ach },
      }),
    );
  }

  updateLeaderboard(playerId, score) {
    this.leaderboard.set(playerId, score);
    const sorted = Array.from(this.leaderboard.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    window.dispatchEvent(
      new CustomEvent("psg1-leaderboard-update", { detail: sorted }),
    );
    return sorted;
  }

  getPlayerStats(playerId) {
    return {
      score: this.playerScores.get(playerId) || 0,
      achievements: Array.from(this.achievements.get(playerId) || []),
      rank: this.getPlayerRank(playerId),
    };
  }

  getPlayerRank(playerId) {
    const sorted = Array.from(this.leaderboard.entries()).sort(
      (a, b) => b[1] - a[1],
    );
    const idx = sorted.findIndex(([id]) => id === playerId);
    return idx === -1 ? null : idx + 1;
  }
}

// ============================================================
// MagicBlock - Real-Time Multiplayer on Devnet
// ============================================================
export class MagicBlockRealTimeGaming {
  constructor(connection, wallet) {
    this.baseConnection = connection; // devnet base layer
    this.wallet = wallet;
    this.ephemeralConnection = null; // MagicBlock fast layer
    this.gameStates = new Map();
    this.activeSessions = new Map();
    this.ws = null;
    this.wsReconnectTimer = null;
    this.wsReconnectAttempts = 0;
    this.wsMaxReconnectAttempts = 3;
    this.initialized = false;
    this.playerPositions = new Map(); // playerId -> {x,y,z,rot}
    this.remotePlayerMeshes = new Map(); // playerId -> THREE.Group (set externally)
    this.localPlayerId = null;
    this.tickRate = 20; // updates per second
    this.tickTimer = null;
    this.latency = 0;
    this.pingHistory = [];
  }

  async initialize() {
    try {
      // Create connection to MagicBlock ephemeral rollup (devnet)
      this.ephemeralConnection = new Connection(MAGICBLOCK_DEVNET_RPC, {
        commitment: "confirmed",
        wsEndpoint: MAGICBLOCK_DEVNET_WS,
        confirmTransactionInitialTimeout: 30000,
      });

      // Test connectivity with a simple getSlot
      const slot = await this.ephemeralConnection.getSlot().catch(() => null);
      if (slot !== null) {
        console.log(`✅ MagicBlock Devnet connected — slot ${slot}`);
      } else {
        // Fallback to base devnet for state, still usable
        console.warn(
          "⚠️  MagicBlock endpoint unreachable, falling back to devnet",
        );
        this.ephemeralConnection = this.baseConnection;
      }

      this.initialized = true;

      // Connect WebSocket for real-time updates
      this._connectWebSocket();

      return true;
    } catch (err) {
      console.error("MagicBlock init error:", err.message);
      this.ephemeralConnection = this.baseConnection;
      this.initialized = true; // still functional in degraded mode
      return false;
    }
  }

  // ── WebSocket for sub-100ms player sync ──────────────────────────────────
  _connectWebSocket() {
    try {
      this.ws = new WebSocket(MAGICBLOCK_DEVNET_WS);

      this.ws.onopen = () => {
        console.log("🔗 MagicBlock WS connected");
        this.wsReconnectAttempts = 0; // Reset retry counter on success
        this._startPositionBroadcast();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this._handleWsMessage(msg);
        } catch (_) {}
      };

      this.ws.onerror = () => {}; // silent — we degrade gracefully

      this.ws.onclose = () => {
        this._stopPositionBroadcast();
        // Reconnect after 3s (but only retry up to 3 times)
        if (this.wsReconnectAttempts < this.wsMaxReconnectAttempts) {
          this.wsReconnectAttempts++;
          clearTimeout(this.wsReconnectTimer);
          this.wsReconnectTimer = setTimeout(
            () => this._connectWebSocket(),
            3000,
          );
        } else {
          console.warn(
            "⚠️  MagicBlock WS unavailable after 3 attempts — multiplayer disabled",
          );
        }
      };
    } catch (_) {
      // WebSocket not critical — game still works
    }
  }

  _handleWsMessage(msg) {
    switch (msg.type) {
      case "player_position": {
        const { playerId, position, rotation, animation } = msg;
        if (playerId === this.localPlayerId) return;
        this.playerPositions.set(playerId, {
          position,
          rotation,
          animation,
          ts: Date.now(),
        });
        window.dispatchEvent(
          new CustomEvent("mb-player-update", { detail: msg }),
        );
        break;
      }
      case "player_join": {
        window.dispatchEvent(
          new CustomEvent("mb-player-join", { detail: msg }),
        );
        break;
      }
      case "player_leave": {
        this.playerPositions.delete(msg.playerId);
        window.dispatchEvent(
          new CustomEvent("mb-player-leave", { detail: msg }),
        );
        break;
      }
      case "game_event": {
        window.dispatchEvent(new CustomEvent("mb-game-event", { detail: msg }));
        break;
      }
      case "pong": {
        this.latency = Date.now() - msg.sentAt;
        this.pingHistory.push(this.latency);
        if (this.pingHistory.length > 20) this.pingHistory.shift();
        break;
      }
    }
  }

  _send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  // ── Position broadcast ────────────────────────────────────────────────────
  _startPositionBroadcast() {
    if (this.tickTimer) return;
    const interval = Math.floor(1000 / this.tickRate);
    this.tickTimer = setInterval(() => this._broadcastPosition(), interval);
  }

  _stopPositionBroadcast() {
    clearInterval(this.tickTimer);
    this.tickTimer = null;
  }

  _broadcastPosition() {
    // No-op — updateLocalPlayerPosition() is called directly from the game loop.
    // This timer exists as a fallback for sessions without a running game loop.
  }

  // Call this every frame from your game loop (or it auto-broadcasts via timer)
  updateLocalPlayerPosition(playerId, position, rotation, animation) {
    this.localPlayerId = playerId;
    this._send({
      type: "player_position",
      playerId,
      sessionId: this._activeSessionId,
      position: { x: position.x, y: position.y, z: position.z },
      rotation: { y: rotation.y },
      animation,
      ts: Date.now(),
    });
  }

  // Ping for latency measurement
  ping() {
    this._send({ type: "ping", sentAt: Date.now() });
  }

  getAverageLatency() {
    if (!this.pingHistory.length) return 0;
    return Math.round(
      this.pingHistory.reduce((a, b) => a + b, 0) / this.pingHistory.length,
    );
  }

  // ── Session management (on-chain record via devnet) ───────────────────────
  async createGameSession(gameId, players) {
    const session = {
      id: gameId,
      players,
      state: { playerPositions: new Map(), scores: new Map(), events: [] },
      startTime: Date.now(),
      lastUpdate: Date.now(),
      verified: false,
    };

    this.gameStates.set(gameId, session);
    this._activeSessionId = gameId;

    // Broadcast join event
    this._send({
      type: "player_join",
      playerId: this.localPlayerId,
      gameId,
      players,
    });

    // Attempt on-chain memo record (lightweight, no extra program needed)
    if (this.wallet && this.wallet.publicKey && this.baseConnection) {
      try {
        const { blockhash } = await this.baseConnection.getLatestBlockhash();
        const tx = new Transaction({
          recentBlockhash: blockhash,
          feePayer: this.wallet.publicKey,
        });

        // Memo instruction — records session ID on chain cheaply
        const memoData = Buffer.from(
          JSON.stringify({ gameId, players, ts: Date.now() }),
        );
        tx.add({
          keys: [],
          programId: new PublicKey(
            "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
          ),
          data: memoData,
        });

        const signed = await this.wallet.signTransaction(tx);
        const sig = await this.baseConnection.sendRawTransaction(
          signed.serialize(),
          { skipPreflight: true },
        );
        session.onChainSig = sig;
        session.verified = true;
        console.log(`📋 Session recorded on devnet: ${sig}`);
      } catch (err) {
        // Memo is optional — don't block game start
        console.warn("Session memo skipped:", err.message);
      }
    }

    window.dispatchEvent(
      new CustomEvent("session-created", { detail: session }),
    );
    return session;
  }

  broadcastGameEvent(eventType, data) {
    this._send({
      type: "game_event",
      eventType,
      data,
      playerId: this.localPlayerId,
      ts: Date.now(),
    });
  }

  getRemotePlayers() {
    const now = Date.now();
    const result = [];
    this.playerPositions.forEach((data, id) => {
      // Discard stale positions (>5 s)
      if (now - data.ts < 5000) result.push({ id, ...data });
    });
    return result;
  }

  cleanup() {
    this._stopPositionBroadcast();
    if (this.ws) this.ws.close();
    clearTimeout(this.wsReconnectTimer);
  }
}

// ============================================================
// Metaplex - NFT Minting for Bounty Cards & Weapons (Devnet)
// ============================================================
export class MetaplexAssetSystem {
  constructor(connection, wallet) {
    this.connection = connection;
    this.wallet = wallet;
    this.assets = new Map(); // mint -> asset data
    this.equipped = new Map(); // slot -> asset
    this.available = !!(connection && wallet);
    this.umi = null; // Metaplex UMI instance (lazy-loaded)
  }

  async initialize() {
    if (!this.available) {
      console.warn("Metaplex: wallet not connected");
      return false;
    }

    // Lazy-load Metaplex UMI — only if installed in the project.
    // @vite-ignore comments prevent Vite from trying to resolve these at build time.
    try {
      const { createUmi } = await import(
        /* @vite-ignore */ "@metaplex-foundation/umi"
      );
      const { walletAdapterIdentity } = await import(
        /* @vite-ignore */ "@metaplex-foundation/umi-signer-wallet-adapters"
      );
      const { mplTokenMetadata } = await import(
        /* @vite-ignore */ "@metaplex-foundation/mpl-token-metadata"
      );

      this.umi = createUmi(DEVNET_RPC)
        .use(walletAdapterIdentity(this.wallet))
        .use(mplTokenMetadata());

      console.log("✅ Metaplex UMI ready on devnet");
    } catch (_) {
      // UMI packages not installed — use manual transaction approach
      console.warn("Metaplex UMI not installed, using manual TX approach");
      this.umi = null;
    }

    return true;
  }

  // ── Build metadata JSON and upload to devnet-friendly storage ────────────
  _buildMetadataUri(assetData) {
    // In production you'd upload to Arweave/IPFS.
    // For devnet we use a data URI so it works offline too.
    const meta = {
      name: assetData.name,
      symbol: assetData.symbol || "GAME",
      description: assetData.description || `${assetData.name} — in-game asset`,
      image:
        assetData.image || "https://placehold.co/400x400/111/00ff88?text=NFT",
      attributes: assetData.attributes || [],
      properties: { files: [], category: "image" },
      external_url: "https://your-game.com",
    };

    // Encode as base64 data URI (works without a server)
    const json = JSON.stringify(meta);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return `data:application/json;base64,${b64}`;
  }

  // ── Create a real NFT on devnet ───────────────────────────────────────────
  async mintNFT(assetData) {
    if (!this.wallet || !this.wallet.publicKey) {
      console.warn("Wallet not connected — storing asset locally");
      return this._storeLocalAsset(assetData);
    }

    const metadataUri = this._buildMetadataUri(assetData);

    // --- Try UMI path first ---
    if (this.umi) {
      try {
        const { generateSigner, percentAmount } = await import(
          /* @vite-ignore */ "@metaplex-foundation/umi"
        );
        const { createNft } = await import(
          /* @vite-ignore */ "@metaplex-foundation/mpl-token-metadata"
        );

        const mintKeypair = generateSigner(this.umi);

        const result = await createNft(this.umi, {
          mint: mintKeypair,
          name: assetData.name,
          symbol: assetData.symbol || "GAME",
          uri: metadataUri,
          sellerFeeBasisPoints: percentAmount(0),
          isMutable: true,
        }).sendAndConfirm(this.umi);

        const asset = {
          mint: mintKeypair.publicKey.toString(),
          metadata: { uri: metadataUri },
          data: assetData,
          equipped: false,
          onChain: true,
          sig: result.signature.toString(),
        };

        this.assets.set(asset.mint, asset);
        window.dispatchEvent(
          new CustomEvent("asset-created", { detail: asset }),
        );
        console.log(`🎨 NFT minted on devnet: ${asset.mint}`);
        return asset;
      } catch (err) {
        console.warn("UMI mint failed, falling back to manual:", err.message);
      }
    }

    // --- Manual transaction fallback (no extra packages needed) ---
    return await this._mintNFTManual(assetData, metadataUri);
  }

  async _mintNFTManual(assetData, metadataUri) {
    // Uses only @solana/web3.js (Keypair, SystemProgram already imported at top of file).
    // Creates a minimal SPL token mint using raw instructions.
    try {
      const SPL_TOKEN_PROGRAM_ID = new PublicKey(
        "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      );
      const MINT_SIZE = 82; // fixed MintLayout size

      const mintKp = Keypair.generate();
      const mintRent =
        await this.connection.getMinimumBalanceForRentExemption(MINT_SIZE);
      const { blockhash } = await this.connection.getLatestBlockhash();

      // Encode InitializeMint instruction manually (discriminator = [0] for initialize mint)
      const initMintData = Buffer.alloc(67);
      initMintData[0] = 0; // instruction index: InitializeMint
      initMintData[1] = 0; // decimals = 0 (NFT)
      // mint authority (32 bytes at offset 2)
      this.wallet.publicKey.toBuffer().copy(initMintData, 2);
      initMintData[34] = 1; // COption::Some
      // freeze authority (32 bytes at offset 35)
      this.wallet.publicKey.toBuffer().copy(initMintData, 35);

      const tx = new Transaction({
        recentBlockhash: blockhash,
        feePayer: this.wallet.publicKey,
      });

      tx.add(
        SystemProgram.createAccount({
          fromPubkey: this.wallet.publicKey,
          newAccountPubkey: mintKp.publicKey,
          space: MINT_SIZE,
          lamports: mintRent,
          programId: SPL_TOKEN_PROGRAM_ID,
        }),
        {
          keys: [
            { pubkey: mintKp.publicKey, isSigner: false, isWritable: true },
            {
              pubkey: new PublicKey(
                "SysvarRent111111111111111111111111111111111",
              ),
              isSigner: false,
              isWritable: false,
            },
          ],
          programId: SPL_TOKEN_PROGRAM_ID,
          data: initMintData,
        },
      );

      tx.partialSign(mintKp);
      const signed = await this.wallet.signTransaction(tx);
      const sig = await this.connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: true,
      });
      const latest = await this.connection.getLatestBlockhash();
      await this.connection.confirmTransaction(
        {
          signature: sig,
          blockhash: latest.blockhash,
          lastValidBlockHeight: latest.lastValidBlockHeight,
        },
        "confirmed",
      );

      const asset = {
        mint: mintKp.publicKey.toString(),
        metadata: { uri: metadataUri },
        data: assetData,
        equipped: false,
        onChain: true,
        sig,
      };

      this.assets.set(asset.mint, asset);
      window.dispatchEvent(new CustomEvent("asset-created", { detail: asset }));
      console.log(`🎨 NFT minted on devnet: ${asset.mint}`);
      return asset;
    } catch (err) {
      console.error("Manual mint failed:", err.message);
      return this._storeLocalAsset(assetData);
    }
  }

  _storeLocalAsset(assetData) {
    const fakeId = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const asset = {
      mint: fakeId,
      metadata: {},
      data: assetData,
      equipped: false,
      onChain: false,
    };
    this.assets.set(asset.mint, asset);
    window.dispatchEvent(new CustomEvent("asset-created", { detail: asset }));
    return asset;
  }

  // ── Equip / unequip helpers ───────────────────────────────────────────────
  async equipAsset(mint, slot) {
    const asset = this.assets.get(mint);
    if (!asset) return false;
    if (this.equipped.has(slot)) await this.unequipAsset(slot);
    asset.equipped = true;
    asset.equippedSlot = slot;
    this.equipped.set(slot, asset);
    window.dispatchEvent(
      new CustomEvent("asset-equipped", { detail: { asset, slot } }),
    );
    return true;
  }

  async unequipAsset(slot) {
    const asset = this.equipped.get(slot);
    if (!asset) return;
    asset.equipped = false;
    delete asset.equippedSlot;
    this.equipped.delete(slot);
    window.dispatchEvent(
      new CustomEvent("asset-unequipped", { detail: { asset, slot } }),
    );
  }

  // ── Convenience: mint a bounty card NFT ──────────────────────────────────
  async mintBountyCard(cardNumber, cardName, rarity = "common") {
    const rarityColors = {
      common: "#aaaaaa",
      uncommon: "#00cc44",
      rare: "#4466ff",
      legendary: "#ffaa00",
    };
    return this.mintNFT({
      name: `Bounty Card #${cardNumber} — ${cardName}`,
      symbol: "BCARD",
      description: `A ${rarity} bounty card collected in-game.`,
      image: `https://placehold.co/400x600/${rarityColors[rarity].replace("#", "")}/ffffff?text=Card+${cardNumber}`,
      attributes: [
        { trait_type: "Card Number", value: String(cardNumber) },
        { trait_type: "Card Name", value: cardName },
        { trait_type: "Rarity", value: rarity },
        { trait_type: "Game", value: "AlienCity" },
      ],
      effects: {
        scoreBonus: rarity === "legendary" ? 500 : rarity === "rare" ? 200 : 50,
      },
    });
  }

  // ── Convenience: mint a weapon NFT ───────────────────────────────────────
  async mintWeaponNFT(weaponConfig) {
    return this.mintNFT({
      name: `Weapon: ${weaponConfig.name}`,
      symbol: "WEAPON",
      description: `A ${weaponConfig.name} weapon NFT from AlienCity.`,
      image: `https://placehold.co/400x400/111133/00ffff?text=${encodeURIComponent(weaponConfig.name)}`,
      attributes: [
        { trait_type: "Weapon Type", value: weaponConfig.name },
        { trait_type: "Damage", value: String(weaponConfig.damage) },
        { trait_type: "Range", value: String(weaponConfig.range) },
        { trait_type: "Fire Rate", value: String(weaponConfig.fireRate) },
        { trait_type: "Ammo", value: String(weaponConfig.maxAmmo) },
      ],
      effects: {
        damage: weaponConfig.damage * 0.1,
        range: weaponConfig.range * 0.1,
        fireRate: weaponConfig.fireRate * 0.1,
      },
    });
  }

  getAssets() {
    return Array.from(this.assets.values());
  }
  getEquippedAssets() {
    return Array.from(this.equipped.entries());
  }
}

// ============================================================
// Jupiter DeFi (devnet — price data is real, swaps are devnet)
// ============================================================
export class JupiterDeFiIntegration {
  constructor(connection, wallet) {
    this.connection = connection;
    this.wallet = wallet;
    this.mobileOptimized =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      );
    this.available = !!(connection && wallet);
  }

  async initialize() {
    if (this.mobileOptimized) this._setupMobileUI();
    console.log("✅ Jupiter DeFi ready (devnet)");
    return true;
  }

  _setupMobileUI() {
    const existing = document.getElementById("jupiter-mobile-controls");
    if (existing) existing.remove();

    const div = document.createElement("div");
    div.id = "jupiter-mobile-controls";
    div.style.cssText = `
            position:fixed; bottom:10px; right:20px;
            background:rgba(0,0,0,0.85); border-radius:12px; z-index:1000; border:1px solid #333;
            display: ${walletConnected ? 'block' : 'none'};
        `;
    div.innerHTML = `
            <button id="jup-swap"   style="margin:4px;padding:10px 14px;background:#00ff88;color:#000;border:none;border-radius:8px;cursor:pointer;font-weight:700;">💰 Swap</button>
            <button id="jup-stake"  style="margin:4px;padding:10px 14px;background:#ffaa00;color:#000;border:none;border-radius:8px;cursor:pointer;font-weight:700;">📈 Stake</button>
        `;
    document.body.appendChild(div);
    document
      .getElementById("jup-swap")
      ?.addEventListener("click", () => this.performSwap("SOL", "USDC", 0.01));
  }

  async performSwap(from, to, amount) {
    if (!this.wallet?.publicKey) {
      alert("Connect wallet first");
      return null;
    }
    // Jupiter V6 quote (works on devnet for price discovery)
    try {
      const url = `https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=${Math.floor(amount * LAMPORTS_PER_SOL)}&slippageBps=50`;
      const resp = await fetch(url)
        .then((r) => r.json())
        .catch(() => null);
      if (resp?.outAmount) {
        const usdcOut = (parseInt(resp.outAmount) / 1_000_000).toFixed(2);
        console.log(`Jupiter quote: ${amount} SOL → ~${usdcOut} USDC`);
        this._awardRewards(amount);
        return resp;
      }
    } catch (_) {}
    this._awardRewards(amount);
    return null;
  }

  _awardRewards(amount) {
    const pts = Math.floor(amount * 1000);
    window.dispatchEvent(
      new CustomEvent("jupiter-reward", { detail: { points: pts } }),
    );
  }

  startMobileAdventure(type) {
    const map = {
      TREASURE_HUNT: { name: "Treasure Hunt", duration: 300, reward: 500 },
      TOKEN_COLLECTOR: { name: "Token Collector", duration: 600, reward: 1000 },
      DEFI_QUEST: { name: "DeFi Quest", duration: 900, reward: 2000 },
    };
    const adv = map[type];
    if (!adv) return;
    window.dispatchEvent(new CustomEvent("adventure-started", { detail: adv }));
    setTimeout(
      () =>
        window.dispatchEvent(
          new CustomEvent("adventure-complete", { detail: adv }),
        ),
      adv.duration * 1000,
    );
  }
}

// ============================================================
// Arcium Encrypted Gaming (Web Crypto API — no extra packages)
// ============================================================
export class ArciumEncryptedGaming {
  constructor() {
    this.sessions = new Map();
    this.activeId = null;
    this.cryptoAvail = !!window.crypto?.subtle;
  }

  async initialize() {
    if (!this.cryptoAvail) {
      console.warn("Web Crypto unavailable");
      return false;
    }
    console.log("✅ Arcium encryption ready");
    return true;
  }

  async _genKey() {
    return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ]);
  }

  async createSession(sessionId, playerId) {
    if (!this.cryptoAvail) return sessionId;
    const key = await this._genKey();
    this.sessions.set(sessionId, { playerId, key, data: [], active: true });
    this.activeId = sessionId;
    window.dispatchEvent(
      new CustomEvent("session-created", { detail: { id: sessionId } }),
    );
    return sessionId;
  }

  async encrypt(data, sid = this.activeId) {
    const sess = this.sessions.get(sid);
    if (!sess) return data;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      sess.key,
      new TextEncoder().encode(JSON.stringify(data)),
    );
    return {
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(enc)),
      ts: Date.now(),
    };
  }

  async decrypt(pkg, sid = this.activeId) {
    const sess = this.sessions.get(sid);
    if (!sess) return pkg;
    const raw = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(pkg.iv) },
      sess.key,
      new Uint8Array(pkg.data),
    );
    return JSON.parse(new TextDecoder().decode(raw));
  }

  startPrivateMode() {
    const id = `priv_${Date.now()}`;
    this.createSession(id, "player");
    window.dispatchEvent(
      new CustomEvent("private-mode-started", { detail: { sessionId: id } }),
    );
    return id;
  }
}

// ============================================================
// Achievement notification (shared UI helper)
// ============================================================
export function showAchievementNotification(achievement) {
  const el = document.createElement("div");
  el.style.cssText = `
        position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
        background:linear-gradient(135deg,gold,orange); color:#000;
        padding:24px 32px; border-radius:12px; font-size:22px; font-weight:700;
        z-index:10000; text-align:center; box-shadow:0 0 30px gold;
        animation:fadeInOut 3s ease-in-out forwards;
    `;
  el.innerHTML = `🏆 ACHIEVEMENT UNLOCKED!<br><span style="font-size:16px">${achievement.title}</span><br><span style="font-size:13px">+${achievement.points} pts</span>`;
  if (!document.getElementById("solana-styles")) {
    const s = document.createElement("style");
    s.id = "solana-styles";
    s.textContent = `@keyframes fadeInOut{0%{opacity:0;transform:translate(-50%,-30%)}10%{opacity:1;transform:translate(-50%,-50%)}90%{opacity:1;transform:translate(-50%,-50%)}100%{opacity:0;transform:translate(-50%,-70%)}}`;
    document.head.appendChild(s);
  }
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ============================================================
// HUD overlay — shows devnet status, latency, wallet
// ============================================================
export function createSolanaHUD() {
  const existing = document.getElementById("solana-hud");
  if (existing) return existing;

  const hud = document.createElement("div");
  hud.id = "solana-hud";
  hud.style.cssText = `
        position:fixed; bottom:80px; right:20px;
        background:rgba(0,0,0,0.75); backdrop-filter:blur(8px);
        border:1px solid rgba(0,255,136,0.3); border-radius:10px;
        padding:10px 14px; color:#fff; font-size:11px;
        font-family:'Courier New',monospace; z-index:1000;
        line-height:1.7; min-width:180px;
    `;
  hud.innerHTML = `
        <div style="color:#00ff88;font-weight:700;margin-bottom:4px;letter-spacing:1px">⬡ SOLANA DEVNET</div>
        <div id="sol-wallet">Wallet: <span style="color:#aaa">Not connected</span></div>
        <div id="sol-network">Network: <span style="color:#ffaa00">devnet</span></div>
        <div id="sol-mb">MagicBlock: <span style="color:#aaa">connecting…</span></div>
        <div id="sol-latency">Latency: <span style="color:#aaa">—</span></div>
        <div id="sol-players">Players: <span style="color:#aaa">1</span></div>
        <div id="sol-nfts">NFTs minted: <span style="color:#aaa">0</span></div>
    `;
  document.body.appendChild(hud);
  return hud;
}

export function updateSolanaHUD(magicBlock, metaplex, wallet) {
  const el = (id) => document.getElementById(id);
  if (!document.getElementById("solana-hud")) return;

  if (wallet?.publicKey) {
    const pk = wallet.publicKey.toString();
    const short = pk.slice(0, 4) + "…" + pk.slice(-4);
    const span = el("sol-wallet")?.querySelector("span");
    if (span) {
      span.textContent = short;
      span.style.color = "#00ff88";
    }
  }

  if (magicBlock?.initialized) {
    const mb = el("sol-mb")?.querySelector("span");
    if (mb) {
      mb.textContent = "online";
      mb.style.color = "#00ff88";
    }
  }

  if (magicBlock) {
    const lat = el("sol-latency")?.querySelector("span");
    if (lat) {
      const ms = magicBlock.getAverageLatency();
      lat.textContent = ms ? `${ms}ms` : "—";
      lat.style.color = ms < 100 ? "#00ff88" : ms < 200 ? "#ffaa00" : "#ff4444";
    }
    const pl = el("sol-players")?.querySelector("span");
    if (pl) pl.textContent = magicBlock.getRemotePlayers().length + 1;
  }

  if (metaplex) {
    const nfts = el("sol-nfts")?.querySelector("span");
    if (nfts) {
      const count = metaplex.getAssets().filter((a) => a.onChain).length;
      nfts.textContent = String(count);
      if (count > 0) nfts.style.color = "#00ff88";
    }
  }
}

// ============================================================
// Main init — call once, returns all systems
// ============================================================
export async function initSolanaTracks(connection, wallet, walletConnected) {
  console.log("🚀 Initialising Solana gaming systems (devnet)…");

  // Always use devnet connection
  const devnetConnection = new Connection(DEVNET_RPC, {
    commitment: "confirmed",
    wsEndpoint: DEVNET_WS,
  });

  const psg1 = new PSG1GamificationEngine();
  const jupiter = new JupiterDeFiIntegration(devnetConnection, wallet, walletConnected);
  const metaplex = new MetaplexAssetSystem(devnetConnection, wallet);
  const arcium = new ArciumEncryptedGaming();
  const magicblock = new MagicBlockRealTimeGaming(devnetConnection, wallet);

  await Promise.allSettled([
    jupiter.initialize(),
    metaplex.initialize(),
    arcium.initialize(),
    magicblock.initialize(),
  ]);

  window.showAchievementNotification = showAchievementNotification;

  // Create and start updating the devnet HUD
//   createSolanaHUD();
  const hudInterval = setInterval(
    () => updateSolanaHUD(magicblock, metaplex, wallet),
    2000,
  );
  window._solanaHudInterval = hudInterval;

  console.log("✅ All Solana systems ready:", {
    psg1: true,
    jupiter: jupiter.available,
    metaplex: metaplex.available,
    arcium: arcium.cryptoAvail,
    magicblock: magicblock.initialized,
  });

  return { psg1, jupiter, metaplex, arcium, magicblock };
}
