import * as THREE from "three";

export class FootstepManager {
  constructor(audioContext) {
    this.audioContext = audioContext;
    this.footstepSounds = [];
    this.currentFootstepIndex = 0;
    this.footstepTimer = 0;
    this.isFootstepPlaying = false;
    
    // Configuration
    this.FOOTSTEP_WALK_INTERVAL = 0.5; // seconds between footsteps when walking
    this.FOOTSTEP_RUN_INTERVAL = 0.3;  // seconds between footsteps when running
    this.WALK_VOLUME = 0.4;
    this.RUN_VOLUME = 0.6;
    
    // Ground detection
    this.groundMeshes = [];
    this.player = null;
    this.scene = null;
  }

  async loadSounds(soundPaths) {
    try {
      for (const soundPath of soundPaths) {
        const response = await fetch(soundPath);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        
        this.footstepSounds.push(audioBuffer);
      }
      
      return true;
    } catch (err) {
      console.error('Error loading footstep sounds:', err);
      return false;
    }
  }

  initialize(player, scene) {
    this.player = player;
    this.scene = scene;
    this.collectGroundMeshes();
  }

  collectGroundMeshes() {
    if (!this.scene) return;
    
    this.scene.traverse((obj) => {
      if (obj.isMesh && (
        obj.name === "base_ground" || 
        obj.name.includes("floor_") ||
        obj.name.includes("road") ||
        obj.name.includes("flight") ||
        obj.name.includes("break") ||
        obj.name.includes("stairs")
      )) {
        this.groundMeshes.push(obj);
      }
    });
    
    console.log(`Collected ${this.groundMeshes.length} ground meshes for footstep detection`);
  }

  isPlayerOnGround() {
    if (!this.player) return false;
    
    const playerPos = this.player.position.clone();
    playerPos.y += 0.1; // Slightly above feet position
    
    const raycaster = new THREE.Raycaster();
    raycaster.set(playerPos, new THREE.Vector3(0, -1, 0), 0, 1.5);
    
    const intersects = raycaster.intersectObjects(this.groundMeshes, true);
    return intersects.length > 0;
  }

  getSurfaceVolumeMultiplier(playerPos) {
    if (!this.scene) return 1.0;
    
    const raycaster = new THREE.Raycaster();
    raycaster.set(playerPos, new THREE.Vector3(0, -1, 0), 0, 1.5);
    
    const intersects = raycaster.intersectObjects(this.groundMeshes, true);
    
    if (intersects.length > 0) {
      const hitObject = intersects[0].object;
      
      // Adjust volume based on surface
      if (hitObject.name.includes("road") || hitObject.name.includes("concrete")) {
        return 1.0; // Normal volume for hard surfaces
      } else if (hitObject.name.includes("grass") || hitObject.name.includes("dirt")) {
        return 0.7; // Quieter for soft surfaces
      } else if (hitObject.name.includes("metal") || hitObject.name.includes("stairs")) {
        return 1.2; // Louder for metal surfaces
      } else if (hitObject.name.includes("wood")) {
        return 0.9; // Slightly different for wood
      }
    }
    
    return 1.0; // Default
  }

  playFootstepSound(isRunning = false) {
    if (this.footstepSounds.length === 0 || !this.player) return null;
    
    // Create audio source
    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();
    
    // Select footstep sound (alternate between sounds)
    this.currentFootstepIndex = (this.currentFootstepIndex + 1) % this.footstepSounds.length;
    source.buffer = this.footstepSounds[this.currentFootstepIndex];
    
    // Set volume based on movement type and surface
    const baseVolume = isRunning ? this.RUN_VOLUME : this.WALK_VOLUME;
    const playerPos = this.player.position.clone();
    const surfaceMultiplier = this.getSurfaceVolumeMultiplier(playerPos);
    const finalVolume = baseVolume * surfaceMultiplier;
    
    gainNode.gain.setValueAtTime(finalVolume, this.audioContext.currentTime);
    
    // Connect nodes
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    // Add slight pitch variation for realism
    const pitchVariation = 0.9 + Math.random() * 0.2; // 0.9 to 1.1
    source.playbackRate.value = pitchVariation;
    
    // Start playing
    source.start(0);
    
    // Clean up
    source.onended = () => {
      this.isFootstepPlaying = false;
    };
    
    this.isFootstepPlaying = true;

    return source;
  }

  update(delta, isMoving, isRunning = false) {
    // Only update if player is moving and on ground
    if (!isMoving || !this.isPlayerOnGround()) {
      this.footstepTimer = 0;
      return;
    }
    
    // Update timer
    this.footstepTimer += delta;
    
    // Determine footstep interval based on movement type
    const interval = isRunning ? this.FOOTSTEP_RUN_INTERVAL : this.FOOTSTEP_WALK_INTERVAL;
    
    // Play footstep sound when timer exceeds interval
    if (this.footstepTimer >= interval) {
      this.playFootstepSound(isRunning);
      this.footstepTimer = 0;
      
      // Add slight randomization to interval for more natural sound
      const randomVariation = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
      this.footstepTimer = -interval * 0.1 * randomVariation; // Negative to create slight offset for next step
    }
  }

  // Optional: Different footstep sounds for different situations
  playJumpSound() {
    if (this.footstepSounds.length === 0) return null;
    
    // Use first footstep sound for jump (or you could load separate jump sounds)
    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();
    
    source.buffer = this.footstepSounds[0];
    gainNode.gain.setValueAtTime(this.RUN_VOLUME * 0.8, this.audioContext.currentTime);
    
    // Faster playback for jump sound
    source.playbackRate.value = 1.3;
    
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    source.start(0);
    
    return source;
  }

  playLandSound() {
    if (this.footstepSounds.length === 0) return null;
    
    // Use last footstep sound for landing
    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();
    
    const soundIndex = this.footstepSounds.length - 1;
    source.buffer = this.footstepSounds[soundIndex];
    gainNode.gain.setValueAtTime(this.RUN_VOLUME, this.audioContext.currentTime);
    
    // Slower, heavier playback for landing
    source.playbackRate.value = 0.8;
    
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    source.start(0);
    
    return source;
  }

  // Clean up resources
  dispose() {
    this.footstepSounds = [];
    this.groundMeshes = [];
    this.player = null;
    this.scene = null;
  }

  // Configuration setters
  setWalkVolume(volume) {
    this.WALK_VOLUME = Math.max(0, Math.min(1, volume));
  }

  setRunVolume(volume) {
    this.RUN_VOLUME = Math.max(0, Math.min(1, volume));
  }

  setWalkInterval(interval) {
    this.FOOTSTEP_WALK_INTERVAL = Math.max(0.1, interval);
  }

  setRunInterval(interval) {
    this.FOOTSTEP_RUN_INTERVAL = Math.max(0.1, interval);
  }
}