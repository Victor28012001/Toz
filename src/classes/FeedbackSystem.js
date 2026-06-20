export default class FeedbackSystem {
  constructor(existingAudioContext = null) {
    this.createFeedbackElements();
    this.sounds = {};
    this.audioContext =
      existingAudioContext ||
      new (window.AudioContext || window.webkitAudioContext)();
  }

  resumeAudioContext() {
    if (this.audioContext.state === "suspended") {
      this.audioContext
        .resume()
        .then(() => {
          console.log("AudioContext resumed in FeedbackSystem");
        })
        .catch((err) => {
          console.error("Failed to resume AudioContext:", err);
        });
    }
  }

  createFeedbackElements() {
    // Hit marker
    this.hitMarker = document.createElement("div");
    this.hitMarker.id = "hit-marker";
    this.hitMarker.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: 30px; height: 30px; pointer-events: none; z-index: 40;
      opacity: 0; transition: opacity 0.1s;
    `;
    this.hitMarker.innerHTML = `
      <svg width="30" height="30" viewBox="0 0 30 30">
        <line x1="2" y1="15" x2="10" y2="15" stroke="white" stroke-width="2"/>
        <line x1="20" y1="15" x2="28" y2="15" stroke="white" stroke-width="2"/>
        <line x1="15" y1="2" x2="15" y2="10" stroke="white" stroke-width="2"/>
        <line x1="15" y1="20" x2="15" y2="28" stroke="white" stroke-width="2"/>
      </svg>
    `;
    document.body.appendChild(this.hitMarker);

    // Killfeed container
    this.killfeed = document.createElement("div");
    this.killfeed.id = "kill-feed-enhanced";
    this.killfeed.style.cssText = `
      position: fixed; top: 70px; right: 10px; z-index: 50;
      display: flex; flex-direction: column; gap: 4px;
      pointer-events: none;
    `;
    document.body.appendChild(this.killfeed);

    // Level up notification
    this.levelUpNotification = document.createElement("div");
    this.levelUpNotification.id = "level-up-notification";
    this.levelUpNotification.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0);
      background: linear-gradient(135deg, #ff6b00, #ffaa00);
      color: white; padding: 20px 40px;
      font-family: 'Orbitron', monospace; font-size: 24px; font-weight: bold;
      z-index: 60; pointer-events: none;
      text-align: center; box-shadow: 0 0 40px rgba(255, 170, 0, 0.5);
      transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `;
    document.body.appendChild(this.levelUpNotification);

    // XP bar
    this.xpBar = document.createElement("div");
    this.xpBar.id = "xp-bar";
    this.xpBar.style.cssText = `
      position: fixed; bottom: 60px; left: 50%; transform: translateX(-50%);
      width: 300px; height: 4px; background: rgba(255,255,255,0.1);
      z-index: 10;
    `;
    this.xpBar.innerHTML = `<div id="xp-fill" style="height: 100%; background: #ffaa00; transition: width 0.3s; width: 0%"></div>`;
    document.body.appendChild(this.xpBar);

    // Credits display
    this.creditsDisplay = document.createElement("div");
    this.creditsDisplay.id = "credits-display";
    this.creditsDisplay.style.cssText = `
      position: fixed; top: 60px; right: 20px; z-index: 10;
      font-family: 'Orbitron', monospace; font-size: 14px;
      color: #ffaa00; display: flex; align-items: center; gap: 8px;
    `;
    this.creditsDisplay.innerHTML = `<span><img src="/assets/textures/juksbucks.png" alt="" style="width: 20px; height: 20px;" /></span><span id="credits-amount">0</span><span style="margin-left: 12px;">⭐ Lv.<span id="player-level">1</span></span>`;
    document.body.appendChild(this.creditsDisplay);

    // Killstreak display
    this.killstreakDisplay = document.createElement("div");
    this.killstreakDisplay.id = "killstreak-display";
    this.killstreakDisplay.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0);
      color: #ff4444; font-family: 'Orbitron', monospace; font-size: 48px;
      font-weight: bold; z-index: 60; pointer-events: none;
      text-shadow: 0 0 20px rgba(255,0,0,0.5);
      transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `;
    document.body.appendChild(this.killstreakDisplay);

    // Daily challenges
    this.dailyChallengesDisplay = document.createElement("div");
    this.dailyChallengesDisplay.id = "daily-challenges";
    this.dailyChallengesDisplay.style.cssText = `
      position: fixed; top: 100px; right: 20px; z-index: 10;
      background: rgba(0,0,0,0.7);
      padding: 10px 14px; font-family: Arial, sans-serif;
      font-size: 11px; color: white; border: 1px solid rgba(255,255,255,0.15);
    `;
    document.body.appendChild(this.dailyChallengesDisplay);
  }

  _ensureRunning() {
    if (!this.audioContext) {
      console.error("No AudioContext!");
      return false;
    }
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume(); // Fire and forget - it'll be ready for next sound
      console.log("AudioContext was suspended, resuming...");
      return false; // Sound won't play this time, but next one will
    }
    return true;
  }

  playHitSound() {
    if (!this._ensureRunning()) return;
    const now = this.audioContext.currentTime;

    // Create noise burst for impact
    const bufferSize = this.audioContext.sampleRate * 0.15;
    const noiseBuffer = this.audioContext.createBuffer(
      1,
      bufferSize,
      this.audioContext.sampleRate,
    );
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
    }

    const noise = this.audioContext.createBufferSource();
    noise.buffer = noiseBuffer;

    // Bandpass filter for metallic impact
    const filter = this.audioContext.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(2000, now);
    filter.frequency.exponentialRampToValueAtTime(400, now + 0.1);
    filter.Q.value = 2;

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioContext.destination);
    noise.start(now);
    noise.stop(now + 0.15);
  }

  playKillSound() {
    if (!this._ensureRunning()) return;
    const now = this.audioContext.currentTime;

    // Deep bass drop + metallic ring
    const bassDuration = 0.4;
    const bassBuffer = this.audioContext.createBuffer(
      1,
      this.audioContext.sampleRate * bassDuration,
      this.audioContext.sampleRate,
    );
    const bassData = bassBuffer.getChannelData(0);
    for (let i = 0; i < bassBuffer.length; i++) {
      const t = i / this.audioContext.sampleRate;
      bassData[i] =
        Math.sin(2 * Math.PI * 80 * t) * Math.pow(1 - t / bassDuration, 1.5);
    }

    const bass = this.audioContext.createBufferSource();
    bass.buffer = bassBuffer;

    const bassFilter = this.audioContext.createBiquadFilter();
    bassFilter.type = "lowpass";
    bassFilter.frequency.value = 200;

    const bassGain = this.audioContext.createGain();
    bassGain.gain.setValueAtTime(0.6, now);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + bassDuration);

    bass.connect(bassFilter);
    bassFilter.connect(bassGain);
    bassGain.connect(this.audioContext.destination);
    bass.start(now);

    // Metallic ping overlay
    const ringFreqs = [600, 900, 1200, 1500];
    ringFreqs.forEach((freq, i) => {
      const osc = this.audioContext.createOscillator();
      const ringGain = this.audioContext.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const startTime = now + i * 0.03;
      ringGain.gain.setValueAtTime(0, startTime);
      ringGain.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
      ringGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);
      osc.connect(ringGain);
      ringGain.connect(this.audioContext.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.3);
    });
  }

  playHeadshotSound() {
    if (!this._ensureRunning()) return;
    const now = this.audioContext.currentTime;

    // Sharp metallic crack
    const crackDuration = 0.08;
    const crackBuffer = this.audioContext.createBuffer(
      1,
      this.audioContext.sampleRate * crackDuration,
      this.audioContext.sampleRate,
    );
    const crackData = crackBuffer.getChannelData(0);
    for (let i = 0; i < crackBuffer.length; i++) {
      crackData[i] =
        (Math.random() * 2 - 1) * Math.pow(1 - i / crackBuffer.length, 4);
    }

    const crack = this.audioContext.createBufferSource();
    crack.buffer = crackBuffer;

    const crackFilter = this.audioContext.createBiquadFilter();
    crackFilter.type = "highpass";
    crackFilter.frequency.value = 3000;

    const crackGain = this.audioContext.createGain();
    crackGain.gain.setValueAtTime(0.7, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + crackDuration);

    crack.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(this.audioContext.destination);
    crack.start(now);

    // Descending digital sweep
    const sweepOsc = this.audioContext.createOscillator();
    const sweepGain = this.audioContext.createGain();
    sweepOsc.type = "sawtooth";
    sweepOsc.frequency.setValueAtTime(2000, now);
    sweepOsc.frequency.exponentialRampToValueAtTime(200, now + 0.3);
    sweepGain.gain.setValueAtTime(0.15, now);
    sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    const sweepFilter = this.audioContext.createBiquadFilter();
    sweepFilter.type = "lowpass";
    sweepFilter.frequency.setValueAtTime(4000, now);
    sweepFilter.frequency.exponentialRampToValueAtTime(500, now + 0.3);

    sweepOsc.connect(sweepFilter);
    sweepFilter.connect(sweepGain);
    sweepGain.connect(this.audioContext.destination);
    sweepOsc.start(now);
    sweepOsc.stop(now + 0.3);

    // Sub bass punch
    const subOsc = this.audioContext.createOscillator();
    const subGain = this.audioContext.createGain();
    subOsc.type = "sine";
    subOsc.frequency.value = 50;
    subGain.gain.setValueAtTime(0.5, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    subOsc.connect(subGain);
    subGain.connect(this.audioContext.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.25);
  }

  playLevelUpSound() {
    if (!this._ensureRunning()) return;
    const now = this.audioContext.currentTime;

    const masterGain = this.audioContext.createGain();
    masterGain.connect(this.audioContext.destination);
    masterGain.gain.setValueAtTime(0.5, now);
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

    // Rising synth arp
    const notes = [261, 329, 392, 523, 659, 784, 1047, 1319, 1568];
    notes.forEach((freq, i) => {
      const delay = i * 0.08;
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      const filter = this.audioContext.createBiquadFilter();

      osc.type = "sawtooth";
      osc.frequency.value = freq;
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(500, now + delay);
      filter.frequency.linearRampToValueAtTime(3000, now + delay + 0.15);
      gain.gain.setValueAtTime(0, now + delay);
      gain.gain.linearRampToValueAtTime(0.15, now + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.3);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);
      osc.start(now + delay);
      osc.stop(now + delay + 0.3);
    });

    // Deep bass swell
    const bassDuration = 1.5;
    const bassBuffer = this.audioContext.createBuffer(
      1,
      this.audioContext.sampleRate * bassDuration,
      this.audioContext.sampleRate,
    );
    const bassData = bassBuffer.getChannelData(0);
    for (let i = 0; i < bassBuffer.length; i++) {
      const t = i / this.audioContext.sampleRate;
      bassData[i] = Math.sin(2 * Math.PI * 40 * t) * (1 - t / bassDuration);
    }

    const bass = this.audioContext.createBufferSource();
    bass.buffer = bassBuffer;
    const bassFilter = this.audioContext.createBiquadFilter();
    bassFilter.type = "lowpass";
    bassFilter.frequency.value = 100;
    const bassGain = this.audioContext.createGain();
    bassGain.gain.setValueAtTime(0.4, now);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + bassDuration);
    bass.connect(bassFilter);
    bassFilter.connect(bassGain);
    bassGain.connect(masterGain);
    bass.start(now);

    // White noise whoosh
    const whooshDuration = 1.0;
    const whooshBuffer = this.audioContext.createBuffer(
      1,
      this.audioContext.sampleRate * whooshDuration,
      this.audioContext.sampleRate,
    );
    const whooshData = whooshBuffer.getChannelData(0);
    for (let i = 0; i < whooshBuffer.length; i++) {
      const t = i / this.audioContext.sampleRate;
      whooshData[i] =
        (Math.random() * 2 - 1) * Math.sin((Math.PI * t) / whooshDuration);
    }

    const whoosh = this.audioContext.createBufferSource();
    whoosh.buffer = whooshBuffer;
    const whooshFilter = this.audioContext.createBiquadFilter();
    whooshFilter.type = "bandpass";
    whooshFilter.frequency.setValueAtTime(500, now);
    whooshFilter.frequency.linearRampToValueAtTime(8000, now + whooshDuration);
    whooshFilter.Q.value = 1;
    const whooshGain = this.audioContext.createGain();
    whooshGain.gain.setValueAtTime(0.2, now);
    whooshGain.gain.exponentialRampToValueAtTime(0.001, now + whooshDuration);
    whoosh.connect(whooshFilter);
    whooshFilter.connect(whooshGain);
    whooshGain.connect(masterGain);
    whoosh.start(now);
  }

  showHitMarker(isHeadshot = false) {
    this.hitMarker.style.opacity = "1";
    if (isHeadshot) {
      this.hitMarker.querySelector("svg").style.transform = "scale(1.5)";
      this.hitMarker
        .querySelector("svg")
        .querySelectorAll("line")
        .forEach((l) => l.setAttribute("stroke", "#ff4444"));
    }
    setTimeout(() => {
      this.hitMarker.style.opacity = "0";
      this.hitMarker.querySelector("svg").style.transform = "scale(1)";
      this.hitMarker
        .querySelector("svg")
        .querySelectorAll("line")
        .forEach((l) => l.setAttribute("stroke", "white"));
    }, 200);
  }

  addKillfeedEntry(killerName, victimName, weaponName, isHeadshot) {
    const entry = document.createElement("div");
    entry.style.cssText = `
      background: rgba(0,0,0,0.8); padding: 6px 12px;
      font-size: 12px; font-family: Arial;
      color: white; animation: slideIn 0.3s ease;
      border-left: 3px solid ${isHeadshot ? "#ff4444" : "#ffaa44"};
    `;
    entry.innerHTML = `
      <span style="color: #ffaa44;">${killerName}</span>
      <span style="color: #888;"> ✦ </span>
      <span>${victimName}</span>
      <span style="color: #666; margin-left: 8px;">${weaponName}</span>
      ${isHeadshot ? '<span style="color: #ff8800;"> 💀</span>' : ""}
    `;
    this.killfeed.insertBefore(entry, this.killfeed.firstChild);
    setTimeout(() => {
      entry.style.animation = "slideOut 0.3s ease forwards";
      setTimeout(() => entry.remove(), 300);
    }, 5000);
    while (this.killfeed.children.length > 5) this.killfeed.lastChild.remove();
  }

  showKillstreak(count) {
    this.killstreakDisplay.textContent = `🔥 ${count} KILL STREAK!`;
    this.killstreakDisplay.style.transform = "translate(-50%, -50%) scale(1)";
    const flash = document.createElement("div");
    flash.style.cssText = `
      position: fixed; inset: 0; pointer-events: none; z-index: 50;
      background: radial-gradient(circle, rgba(255,50,0,0.3) 0%, transparent 70%);
      animation: flashFade 0.5s ease-out forwards;
    `;
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 500);
    setTimeout(() => {
      this.killstreakDisplay.style.transform = "translate(-50%, -50%) scale(0)";
    }, 2000);
  }

  showLevelUp(level, unlockedItems) {
    this.playLevelUpSound();
    this.levelUpNotification.innerHTML = `
      <div style="font-size: 14px; color: #ffe0b0;">LEVEL UP!</div>
      <div style="font-size: 36px; margin: 8px 0;">⭐ ${level} ⭐</div>
      ${unlockedItems
        .map(
          (item) =>
            `<div style="font-size: 12px; color: #ffe0b0;">🔓 ${item} Unlocked!</div>`,
        )
        .join("")}
    `;
    this.levelUpNotification.style.transform = "translate(-50%, -50%) scale(1)";
    setTimeout(() => {
      this.levelUpNotification.style.transform =
        "translate(-50%, -50%) scale(0)";
    }, 3000);
  }

  updateXPBar(xp, xpToNextLevel) {
    const fill = document.getElementById("xp-fill");
    if (fill) fill.style.width = `${(xp / xpToNextLevel) * 100}%`;
  }

  updateCreditsDisplay(credits, level) {
    const creditsEl = document.getElementById("credits-amount");
    const levelEl = document.getElementById("player-level");
    if (creditsEl) creditsEl.textContent = credits;
    if (levelEl) levelEl.textContent = level;
  }

  updateDailyChallenges(challenges, progress) {
    this.dailyChallengesDisplay.innerHTML = `
      <div style="color: #ffaa44; margin-bottom: 8px; font-weight: bold;">📋 DAILY CHALLENGES</div>
      ${challenges
        .map((c) => {
          const pct = Math.min(100, (progress[c.id] / c.target) * 100);
          const completed = progress[c.id] >= c.target;
          return `<div style="margin-bottom: 4px; ${
            completed ? "color: #00ff88;" : ""
          }">
          ${completed ? "✅" : "⬜"} ${c.name}
          <span style="color: #888; font-size: 10px;">${progress[c.id]}/${
            c.target
          }</span>
          <span style="color: #ffaa00; font-size: 10px;">💎${c.reward}</span>
        </div>`;
        })
        .join("")}
    `;
  }

  showNotification(message, color = "#ffaa00") {
    const notif = document.createElement("div");
    notif.style.cssText = `
      position: fixed; top: 200px; right: 20px; z-index: 60;
      color: ${color}; font-family: 'Orbitron', monospace;
      font-size: 14px; animation: slideIn 0.3s ease;
      background: rgba(0,0,0,0.8); padding: 8px 16px;
      border: 1px solid ${color};
    `;
    notif.textContent = message;
    document.body.appendChild(notif);
    setTimeout(() => {
      notif.style.animation = "slideOut 0.3s ease forwards";
      setTimeout(() => notif.remove(), 300);
    }, 2000);
  }

  showDamageNumber(damage, x, y, isHeadshot = false) {
    const div = document.createElement("div");
    div.style.cssText = `
      position: fixed; left: ${x}px; top: ${y}px;
      color: ${isHeadshot ? "#ff4444" : "#ffff00"};
      font-family: 'Orbitron', monospace; font-size: ${
        isHeadshot ? "24px" : "18px"
      };
      font-weight: bold; pointer-events: none; z-index: 40;
      text-shadow: 0 0 10px ${
        isHeadshot ? "rgba(255,0,0,0.8)" : "rgba(255,255,0,0.8)"
      };
      animation: damageFloat 0.8s ease-out forwards;
    `;
    div.textContent = isHeadshot ? `💀 ${damage}` : `-${damage}`;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 800);
  }

  showLeaderboard() {
    if (window.socket) {
      window.socket.emit("requestLeaderboard", { sortBy: "kills" });
    }
  }
}
