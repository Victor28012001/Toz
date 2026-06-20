// classes/WeaponSoundManager.js
export default class WeaponSoundManager {
  constructor() {
    this.audioContext = null;
    this.isInitialized = false;
    this.reloadSound = null;
  }

  async init() {
    if (this.isInitialized) return;

    this.audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();

    // Load reload sound file
    this.reloadSound = new Audio("/assets/sounds/reload.mp3");
    this.reloadSound.volume = 0.5;

    const unlockAudio = () => {
      if (this.audioContext && this.audioContext.state === "suspended") {
        this.audioContext.resume();
      }
      // Also unlock the Audio element
      this.reloadSound
        .play()
        .then(() => this.reloadSound.pause())
        .catch(() => {});
      this.reloadSound.currentTime = 0;

      document.removeEventListener("click", unlockAudio);
      document.removeEventListener("keydown", unlockAudio);
      document.removeEventListener("touchstart", unlockAudio);
    };

    document.addEventListener("click", unlockAudio);
    document.addEventListener("keydown", unlockAudio);
    document.addEventListener("touchstart", unlockAudio);

    this.isInitialized = true;
    console.log("WeaponSoundManager initialized");
  }

  // Gunshot sound (synthetic)
  playGunshot(weaponName, pitch = 1.0, volume = 0.8) {
    if (!this.isInitialized || !this.audioContext) return;

    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }

    const now = this.audioContext.currentTime;

    const masterGain = this.audioContext.createGain();
    masterGain.gain.value = volume;
    masterGain.connect(this.audioContext.destination);

    // Bass thump
    const bassOsc = this.audioContext.createOscillator();
    const bassGain = this.audioContext.createGain();
    bassOsc.type = "sine";
    bassOsc.frequency.value = 60 / pitch;
    bassGain.gain.setValueAtTime(volume * 0.8, now);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    bassOsc.connect(bassGain);
    bassGain.connect(masterGain);
    bassOsc.start();
    bassOsc.stop(now + 0.15);

    // Mid range crack
    const crackOsc = this.audioContext.createOscillator();
    const crackGain = this.audioContext.createGain();
    crackOsc.type = "triangle";
    crackOsc.frequency.value = 400 * pitch;
    crackOsc.frequency.exponentialRampToValueAtTime(100 * pitch, now + 0.08);
    crackGain.gain.setValueAtTime(volume * 0.6, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    crackOsc.connect(crackGain);
    crackGain.connect(masterGain);
    crackOsc.start();
    crackOsc.stop(now + 0.12);

    // Noise burst
    const bufferSize = 2048;
    const noiseBuffer = this.audioContext.createBuffer(
      1,
      bufferSize,
      this.audioContext.sampleRate,
    );
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() - 0.5) * 2;
    }

    const noise = this.audioContext.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = this.audioContext.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 800 * pitch;
    noiseFilter.Q.value = 3;

    const noiseGain = this.audioContext.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);
    noise.start();
    noise.stop(now + 0.1);

    const cleanup = () => {
      setTimeout(() => {
        bassOsc.disconnect();
        bassGain.disconnect();
        crackOsc.disconnect();
        crackGain.disconnect();
        noise.disconnect();
        noiseFilter.disconnect();
        noiseGain.disconnect();
        masterGain.disconnect();
      }, 200);
    };

    bassOsc.onended = cleanup;
  }

  // Reload sound using audio file
  playReloadSound(volume = 0.5) {
    if (!this.reloadSound) return;

    // Stop and reset current sound if playing
    this.reloadSound.pause();
    this.reloadSound.currentTime = 0;

    // Set volume
    this.reloadSound.volume = Math.min(1, Math.max(0, volume));

    // Play
    this.reloadSound.play().catch((error) => {
      console.warn("Reload sound play failed:", error);
    });
  }

  playWeaponShot(weapon) {
    if (!weapon) return;

    let pitch = 1.0;
    let volume = 0.8;

    switch (weapon.name) {
      case "Desert Eagle":
        pitch = 0.65;
        volume = 1.0;
        break;
      case "Revolver":
        pitch = 0.7;
        volume = 1.0;
        break;
      case "Glock":
        pitch = 1.2;
        volume = 0.75;
        break;
      case "Luger":
        pitch = 1.15;
        volume = 0.75;
        break;
      case "Dragunov":
        pitch = 0.55;
        volume = 1.0;
        break;
      case "M40":
        pitch = 0.5;
        volume = 1.0;
        break;
      case "Shotgun":
      case "Pump Action":
        pitch = 0.6;
        volume = 1.0;
        break;
      case "AK47":
        pitch = 0.8;
        volume = 0.85;
        break;
      case "M16":
        pitch = 0.85;
        volume = 0.85;
        break;
      case "Kriss Vector":
        pitch = 1.1;
        volume = 0.7;
        break;
      case "MP5":
        pitch = 1.05;
        volume = 0.7;
        break;
      default:
        pitch = 1.0;
        volume = 0.8;
    }

    this.playGunshot(weapon.name, pitch, volume);
  }

  playWeaponReload(weapon) {
    if (!weapon) return;

    let volume = 0.5;

    // Adjust volume based on weapon type
    switch (weapon.name) {
      case "Shotgun":
      case "Pump Action":
        volume = 0.7;
        break;
      case "Dragunov":
      case "M40":
        volume = 0.6;
        break;
      default:
        volume = 0.5;
    }

    this.playReloadSound(volume);
  }

  testSound() {
    console.log("Testing gunshot sound...");
    this.playGunshot("test", 1.0, 0.8);
  }

  testReload() {
    console.log("Testing reload sound...");
    this.playReloadSound(0.6);
  }
}

let weaponSoundManager = null;

export function getWeaponSoundManager() {
  if (!weaponSoundManager) {
    weaponSoundManager = new WeaponSoundManager();
  }
  return weaponSoundManager;
}
