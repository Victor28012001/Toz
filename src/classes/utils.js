

  // explodeGrenade(grenade) {
  //   const explosionPos = grenade.position.clone();

  //   // Emit explosion to server for other players (skip for remote explosions)
  //   if (grenade.geometry && this.player?.socket) {
  //     this.player.socket.emit("grenadeExploded", {
  //       position: { x: explosionPos.x, y: explosionPos.y, z: explosionPos.z },
  //       damage: 80,
  //       radius: 10,
  //       throwerId: this.player.id,
  //     });
  //   }

  //   // Remove grenade - only if it has geometry (not a dummy from remote)
  //   if (grenade.geometry) {
  //     this.world.scene.remove(grenade);
  //     grenade.geometry.dispose();
  //     grenade.material.dispose();
  //     grenade.children.forEach((child) => {
  //       if (child.geometry) child.geometry.dispose();
  //       if (child.material) child.material.dispose();
  //     });
  //   }

  //   // Load textures
  //   const textureLoader = new THREE.TextureLoader();
  //   const fireTexture = textureLoader.load("/assets/textures/fire.png");
  //   const smokeTexture = textureLoader.load("/assets/textures/smoke.png");

  //   // Create container
  //   const domeContainer = new THREE.Group();
  //   domeContainer.position.copy(explosionPos);
  //   this.world.scene.add(domeContainer);

  //   const numFireSprites = 240;
  //   const numSmokeSprites = 120;
  //   const fireLayers = 4;
  //   const smokeLayers = 3;
  //   const allFireSprites = [];
  //   const allSmokeSprites = [];

  //   // ── FIRE SPRITES (inner layers, brighter) ──
  //   for (let layer = 0; layer < fireLayers; layer++) {
  //     const layerRadius = 4 + layer * 2.5;
  //     const numLayerSprites = Math.floor(numFireSprites / fireLayers);

  //     for (let i = 0; i < numLayerSprites; i++) {
  //       const phi = Math.acos(1 - (2 * (i + 0.5)) / numLayerSprites);
  //       const theta = Math.PI * (1 + Math.sqrt(5)) * i;

  //       const x = Math.sin(phi) * Math.cos(theta);
  //       const y = Math.cos(phi);
  //       const z = Math.sin(phi) * Math.sin(theta);

  //       const spriteMat = new THREE.SpriteMaterial({
  //         color: new THREE.Color().setHSL(
  //           0.06 + Math.random() * 0.1,
  //           1,
  //           0.35 + Math.random() * 0.55,
  //         ),
  //         map: fireTexture,
  //         blending: THREE.AdditiveBlending,
  //         transparent: true,
  //         opacity: 0.5 + Math.random() * 0.5,
  //         depthWrite: false,
  //       });

  //       const sprite = new THREE.Sprite(spriteMat);
  //       sprite.position.set(x * layerRadius, y * layerRadius, z * layerRadius);

  //       const spriteSize = 2.5 + Math.random() * 4;
  //       sprite.scale.set(spriteSize, spriteSize, 1);
  //       sprite.userData = {
  //         type: "fire",
  //         baseSize: spriteSize,
  //         baseOpacity: spriteMat.opacity,
  //         layer: layer,
  //         phase: Math.random() * Math.PI * 2,
  //         speed: 0.5 + Math.random() * 1.5,
  //       };

  //       domeContainer.add(sprite);
  //       allFireSprites.push(sprite);
  //     }
  //   }

  //   // ── SMOKE SPRITES (outer layers, darker, slower, billowing) ──
  //   for (let layer = 0; layer < smokeLayers; layer++) {
  //     const layerRadius = 8 + layer * 3.5;
  //     const numLayerSprites = Math.floor(numSmokeSprites / smokeLayers);

  //     for (let i = 0; i < numLayerSprites; i++) {
  //       const phi = Math.acos(1 - (2 * (i + 0.5)) / numLayerSprites);
  //       const theta = Math.PI * (1 + Math.sqrt(5)) * i;

  //       const x = Math.sin(phi) * Math.cos(theta);
  //       const y = Math.cos(phi) * 0.7; // Flatten smoke toward top
  //       const z = Math.sin(phi) * Math.sin(theta);

  //       const smokeColor = new THREE.Color().setHSL(
  //         0.08 + Math.random() * 0.04,
  //         0.1 + Math.random() * 0.2,
  //         0.15 + Math.random() * 0.35,
  //       );

  //       const spriteMat = new THREE.SpriteMaterial({
  //         color: smokeColor,
  //         map: smokeTexture,
  //         blending: THREE.NormalBlending,
  //         transparent: true,
  //         opacity: 0.3 + Math.random() * 0.5,
  //         depthWrite: false,
  //       });

  //       const sprite = new THREE.Sprite(spriteMat);
  //       sprite.position.set(x * layerRadius, y * layerRadius, z * layerRadius);

  //       const spriteSize = 4 + Math.random() * 8;
  //       sprite.scale.set(spriteSize, spriteSize, 1);
  //       sprite.userData = {
  //         type: "smoke",
  //         baseSize: spriteSize,
  //         baseOpacity: spriteMat.opacity,
  //         layer: layer,
  //         phase: Math.random() * Math.PI * 2,
  //         speed: 0.2 + Math.random() * 0.6,
  //         riseSpeed: 1 + Math.random() * 3,
  //       };

  //       domeContainer.add(sprite);
  //       allSmokeSprites.push(sprite);
  //     }
  //   }

  //   // Sub-surface glow dome
  //   const glowGeo = new THREE.SphereGeometry(4, 32, 32);
  //   const glowMat = new THREE.ShaderMaterial({
  //     uniforms: {
  //       time: { value: 0 },
  //       opacity: { value: 0.5 },
  //     },
  //     vertexShader: `
  //       varying vec2 vUv;
  //       varying vec3 vNormal;
  //       void main() {
  //         vUv = uv;
  //         vNormal = normalize(normalMatrix * normal);
  //         gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  //       }
  //     `,
  //     fragmentShader: `
  //       uniform float time;
  //       uniform float opacity;
  //       varying vec2 vUv;
  //       varying vec3 vNormal;

  //       void main() {
  //         float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 1.5);
  //         float pulse = 1.0 + sin(time * 8.0) * 0.2;
  //         float glow = fresnel * opacity * pulse;
  //         vec3 color = mix(vec3(1.0, 0.3, 0.02), vec3(1.0, 0.7, 0.15), glow);
  //         gl_FragColor = vec4(color, glow * 0.8);
  //       }
  //     `,
  //     transparent: true,
  //     blending: THREE.AdditiveBlending,
  //     depthWrite: false,
  //   });
  //   const glowDome = new THREE.Mesh(glowGeo, glowMat);
  //   domeContainer.add(glowDome);

  //   // Inner bright core
  //   const coreGeo = new THREE.SphereGeometry(1.2, 16, 16);
  //   const coreMat = new THREE.ShaderMaterial({
  //     uniforms: {
  //       time: { value: 0 },
  //       opacity: { value: 1.0 },
  //     },
  //     vertexShader: `
  //       varying vec2 vUv;
  //       void main() {
  //         vUv = uv;
  //         gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  //       }
  //     `,
  //     fragmentShader: `
  //       uniform float time;
  //       uniform float opacity;
  //       varying vec2 vUv;

  //       void main() {
  //         float d = length(vUv - 0.5) * 2.0;
  //         float glow = 1.0 - smoothstep(0.0, 1.0, d);
  //         float pulse = 1.0 + sin(time * 15.0) * 0.3;
  //         float alpha = glow * opacity * pulse;
  //         vec3 color = mix(vec3(1.0, 0.95, 0.8), vec3(1.0, 0.4, 0.02), d);
  //         gl_FragColor = vec4(color, alpha);
  //       }
  //     `,
  //     transparent: true,
  //     blending: THREE.AdditiveBlending,
  //     depthWrite: false,
  //   });
  //   const core = new THREE.Mesh(coreGeo, coreMat);
  //   domeContainer.add(core);

  //   // Flash light
  //   const flashLight = new THREE.PointLight(0xff6600, 0, 60);
  //   flashLight.position.copy(explosionPos);
  //   this.world.scene.add(flashLight);

  //   // Animation
  //   let elapsed = 0;
  //   const duration = 2.2;
  //   const expandTime = 0.2;
  //   const burnTime = 0.7;
  //   const decayTime = 1.3;
  //   let lastTime = performance.now();

  //   const animateExplosion = () => {
  //     const now = performance.now();
  //     const dt = Math.min(0.05, (now - lastTime) / 1000);
  //     lastTime = now;
  //     elapsed += dt;

  //     if (elapsed >= duration) {
  //       // Don't remove domeContainer - let smoke continue to dissipate
  //       // Only remove glow and core immediately
  //       domeContainer.remove(glowDome);
  //       domeContainer.remove(core);
  //       glowGeo.dispose();
  //       glowMat.dispose();
  //       coreGeo.dispose();
  //       coreMat.dispose();

  //       this.world.scene.remove(flashLight);

  //       // Fire sprites can be removed now (they should be fully faded)
  //       allFireSprites.forEach((s) => {
  //         domeContainer.remove(s);
  //         s.material.map = null;
  //         s.material.dispose();
  //       });
  //       allFireSprites.length = 0;

  //       // Smoke continues to exist and fade - set up a slow fade-out
  //       const smokeFadeStart = performance.now();
  //       const smokeFadeDuration = 3.0; // 3 seconds to fully dissipate

  //       const fadeSmoke = () => {
  //         const smokeElapsed = (performance.now() - smokeFadeStart) / 1000;
  //         const smokeProgress = smokeElapsed / smokeFadeDuration;

  //         if (smokeProgress >= 1.0) {
  //           // Finally remove everything
  //           this.world.scene.remove(domeContainer);
  //           allSmokeSprites.forEach((s) => {
  //             s.material.map = null;
  //             s.material.dispose();
  //           });
  //           allSmokeSprites.length = 0;
  //           return;
  //         }

  //         // Continue fading and moving smoke outward/upward
  //         allSmokeSprites.forEach((s) => {
  //           s.material.opacity = Math.max(
  //             0,
  //             0.15 * (1.0 - smokeProgress * smokeProgress),
  //           );
  //           const growth = 5.0 + smokeProgress * 8.0;
  //           const spriteScale = s.userData.baseSize * growth;
  //           s.scale.set(spriteScale, spriteScale, 1);

  //           // Continue rising
  //           s.position.y +=
  //             0.016 * s.userData.riseSpeed * (0.3 + smokeProgress);
  //           const outwardDir = new THREE.Vector3(
  //             s.position.x,
  //             0,
  //             s.position.z,
  //           ).normalize();
  //           s.position.x += outwardDir.x * 0.016 * 1.5 * smokeProgress;
  //           s.position.z += outwardDir.z * 0.016 * 1.5 * smokeProgress;
  //         });

  //         // Slightly shrink the container
  //         domeContainer.scale.setScalar(2.5 + smokeProgress * 2.0);

  //         requestAnimationFrame(fadeSmoke);
  //       };

  //       requestAnimationFrame(fadeSmoke);
  //       return;
  //     }

  //     let explosionScale;

  //     // Phase 1: Rapid expansion
  //     if (elapsed < expandTime) {
  //       const t = elapsed / expandTime;
  //       const easeOut = 1.0 - Math.pow(1.0 - t, 3.0);
  //       explosionScale = 0.01 + easeOut * 2.5;
  //       flashLight.intensity = 25 * easeOut;

  //       domeContainer.scale.setScalar(explosionScale);
  //       glowMat.uniforms.opacity.value = 0.5 * easeOut;
  //       coreMat.uniforms.opacity.value = easeOut;

  //       // Fire sprites appear
  //       allFireSprites.forEach((s) => {
  //         const layerScale = 1.0 + s.userData.layer * 0.3;
  //         const spriteScale = s.userData.baseSize * easeOut * layerScale;
  //         s.scale.set(spriteScale, spriteScale, 1);
  //         s.material.opacity = s.userData.baseOpacity * easeOut;
  //       });

  //       // Smoke appears slightly delayed and at edges
  //       allSmokeSprites.forEach((s) => {
  //         const delay = s.userData.layer * 0.15;
  //         const smokeT = Math.max(0, (t - delay) / (1.0 - delay));
  //         const spriteScale = s.userData.baseSize * smokeT;
  //         s.scale.set(spriteScale, spriteScale, 1);
  //         s.material.opacity = s.userData.baseOpacity * smokeT * 0.5;
  //       });
  //     }
  //     // Phase 2: Intense burn
  //     else if (elapsed < expandTime + burnTime) {
  //       const t = (elapsed - expandTime) / burnTime;
  //       const pulse =
  //         1.0 +
  //         Math.sin(elapsed * 10.0) * 0.06 +
  //         Math.sin(elapsed * 6.5) * 0.04;
  //       explosionScale = 2.5 * pulse;

  //       domeContainer.scale.setScalar(explosionScale);
  //       glowMat.uniforms.opacity.value = 0.5 * (1.0 - t * 0.4);
  //       coreMat.uniforms.opacity.value = 1.0 - t * 0.6;
  //       flashLight.intensity = 25 * (1.0 - t * 0.4);

  //       // Fire flickers intensely
  //       allFireSprites.forEach((s) => {
  //         const flicker =
  //           0.6 +
  //           Math.sin(elapsed * s.userData.speed * 10 + s.userData.phase) * 0.4;
  //         const spriteScale =
  //           s.userData.baseSize * pulse * (1.0 + s.userData.layer * 0.15);
  //         s.scale.set(spriteScale, spriteScale, 1);
  //         s.material.opacity =
  //           s.userData.baseOpacity * flicker * (1.0 - t * 0.3);
  //         s.material.rotation += dt * s.userData.speed * 2.5;
  //       });

  //       // Smoke builds up
  //       allSmokeSprites.forEach((s) => {
  //         const flicker =
  //           0.8 +
  //           Math.sin(elapsed * s.userData.speed * 4 + s.userData.phase) * 0.2;
  //         const growth = 1.0 + t * 1.5;
  //         const spriteScale = s.userData.baseSize * growth;
  //         s.scale.set(spriteScale, spriteScale, 1);
  //         s.material.opacity =
  //           s.userData.baseOpacity * flicker * Math.min(1.0, t * 2.0);
  //         s.material.rotation += dt * s.userData.speed * 1.2;

  //         // Smoke rises
  //         s.position.y += dt * s.userData.riseSpeed * t;
  //       });
  //     }
  //     // Phase 3: Die down - fire fades, smoke billows
  //     else {
  //       const t = (elapsed - expandTime - burnTime) / decayTime;
  //       const easeIn = t * t;

  //       explosionScale = 2.5 * (1.0 + easeIn * 0.3); // Slight expansion as it cools
  //       domeContainer.scale.setScalar(explosionScale);

  //       glowMat.uniforms.opacity.value = Math.max(0, 0.3 - easeIn * 0.3);
  //       coreMat.uniforms.opacity.value = Math.max(0, 0.4 - easeIn * 0.4);
  //       flashLight.intensity = 15 * (1.0 - easeIn);

  //       // Fire fades out
  //       allFireSprites.forEach((s) => {
  //         const fadeAlpha = s.userData.baseOpacity * (1.0 - easeIn);
  //         s.material.opacity = Math.max(0, fadeAlpha);
  //         const shrinkScale = s.userData.baseSize * (1.0 - easeIn * 0.7);
  //         s.scale.set(shrinkScale, shrinkScale, 1);
  //         s.material.rotation += dt * s.userData.speed * 1.0;
  //       });

  //       // Smoke dominates - grows larger, rises, fades slowly
  //       allSmokeSprites.forEach((s) => {
  //         const growth = 2.5 + t * 3.0;
  //         const fadeAlpha = s.userData.baseOpacity * (1.0 - t * 0.6);
  //         const spriteScale = s.userData.baseSize * growth;
  //         s.scale.set(spriteScale, spriteScale, 1);
  //         s.material.opacity = Math.max(0, fadeAlpha);
  //         s.material.rotation += dt * s.userData.speed * 0.8;

  //         // Smoke rises and expands outward
  //         s.position.y += dt * s.userData.riseSpeed * (0.5 + t);
  //         const outwardDir = new THREE.Vector3(
  //           s.position.x,
  //           0,
  //           s.position.z,
  //         ).normalize();
  //         s.position.x += outwardDir.x * dt * 2 * t;
  //         s.position.z += outwardDir.z * dt * 2 * t;
  //       });
  //     }

  //     glowMat.uniforms.time.value += dt;
  //     coreMat.uniforms.time.value += dt;

  //     requestAnimationFrame(animateExplosion);
  //   };

  //   requestAnimationFrame(animateExplosion);

  //   // Damage nearby players
  //   if (window.players) {
  //     const allPlayers = window.players.getAll();
  //     allPlayers.forEach((p) => {
  //       if (p === this.player) return;
  //       if (p.isDead) return;
  //       const dist = p.threeObj.position.distanceTo(explosionPos);
  //       if (dist < 10) {
  //         const damage = Math.floor(80 * (1 - dist / 10));
  //         p.takeDamage(damage, this.player?.id || null);
  //       }
  //     });
  //   }
  // }
  
    // createMuzzleFlash() {
    //   if (!this.world || !this.muzzleFlashTexture) return;
  
    //   let muzzle = null;
  
    //   // 🔍 Find muzzle ("Cylinder") in the ACTIVE weapon model
    //   this.pitchObj.traverse((child) => {
    //     if (child.name === "Cylinder" && !muzzle) {
    //       muzzle = child;
    //     }
    //   });
  
    //   if (!muzzle) {
    //     console.warn("No muzzle found");
    //     return;
    //   }
  
    //   const worldPos = new THREE.Vector3();
    //   muzzle.getWorldPosition(worldPos);
  
    //   const material = new THREE.SpriteMaterial({
    //     map: this.muzzleFlashTexture,
    //     blending: THREE.AdditiveBlending,
    //     transparent: true,
    //     depthWrite: false,
    //   });
  
    //   const sprite = new THREE.Sprite(material);
  
    //   // ✅ REAL weapon position
    //   sprite.position.copy(worldPos);
  
    //   // 👇 tweak this to fit your gun size
    //   sprite.scale.set(5, 5, 1);
  
    //   this.world.scene.add(sprite);
  
    //   setTimeout(() => {
    //     this.world.scene.remove(sprite);
    //     material.dispose();
    //   }, 80);
  
    //   // Emit muzzle flash to other players
    //   if (this.socket) {
    //     this.socket.emit("muzzleFlash", {
    //       position: { x: worldPos.x, y: worldPos.y, z: worldPos.z },
    //     });
    //   }
    // }
    
      // explodeGrenade(grenade) {
      //   const explosionPos = grenade.position.clone();
    
      //   // Emit explosion to server for other players (skip for remote explosions)
      //   if (grenade.geometry && this.player?.socket) {
      //     this.player.socket.emit("grenadeExploded", {
      //       position: { x: explosionPos.x, y: explosionPos.y, z: explosionPos.z },
      //       damage: 80,
      //       radius: 10,
      //       throwerId: this.player.id,
      //     });
      //   }
    
      //   // Remove grenade - only if it has geometry
      //   if (grenade.geometry) {
      //     this.world.scene.remove(grenade);
      //     grenade.geometry.dispose();
      //     grenade.material.dispose();
      //     grenade.children.forEach((child) => {
      //       if (child.geometry) child.geometry.dispose();
      //       if (child.material) child.material.dispose();
      //     });
      //   }
    
      //   // Cache textures
      //   if (!this._grenadeTextures) {
      //     const textureLoader = new THREE.TextureLoader();
      //     this._grenadeTextures = {
      //       fire: textureLoader.load("/assets/textures/fire.png"),
      //       smoke: textureLoader.load("/assets/textures/smoke.png"),
      //     };
      //   }
      //   const { fireTexture, smokeTexture } = this._grenadeTextures;
    
      //   // ── OPTIMIZED: Single Points system for fire ──
      //   const fireCount = 200;
      //   const firePositions = new Float32Array(fireCount * 3);
      //   const fireSizes = new Float32Array(fireCount);
      //   const firePhases = new Float32Array(fireCount); // for animation
    
      //   for (let i = 0; i < fireCount; i++) {
      //     const phi = Math.acos(1 - 2 * Math.random());
      //     const theta = Math.PI * 2 * Math.random();
      //     const r = 3 + Math.random() * 8;
      //     firePositions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
      //     firePositions[i * 3 + 1] = Math.cos(phi) * r;
      //     firePositions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
      //     fireSizes[i] = 2 + Math.random() * 5;
      //     firePhases[i] = Math.random() * Math.PI * 2;
      //   }
    
      //   const fireGeo = new THREE.BufferGeometry();
      //   fireGeo.setAttribute(
      //     "position",
      //     new THREE.BufferAttribute(firePositions, 3),
      //   );
      //   fireGeo.setAttribute("size", new THREE.BufferAttribute(fireSizes, 1));
    
      //   // Use ShaderMaterial for Points to have per-point size variation
      //   const fireMat = new THREE.PointsMaterial({
      //     map: fireTexture,
      //     color: 0xff6600,
      //     size: 3,
      //     blending: THREE.AdditiveBlending,
      //     transparent: true,
      //     opacity: 0.8,
      //     depthWrite: false,
      //   });
    
      //   const firePoints = new THREE.Points(fireGeo, fireMat);
      //   firePoints.position.copy(explosionPos);
      //   this.world.scene.add(firePoints);
      //   firePoints.userData = { phases: firePhases, baseSizes: fireSizes };
    
      //   // ── OPTIMIZED: Single Points system for smoke ──
      //   const smokeCount = 80;
      //   const smokePositions = new Float32Array(smokeCount * 3);
      //   const smokeData = []; // store per-particle data
    
      //   for (let i = 0; i < smokeCount; i++) {
      //     const phi = Math.acos(1 - 2 * Math.random());
      //     const theta = Math.PI * 2 * Math.random();
      //     const r = 6 + Math.random() * 10;
      //     smokePositions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
      //     smokePositions[i * 3 + 1] = Math.cos(phi) * 0.7 * r;
      //     smokePositions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
      //     smokeData.push({
      //       riseSpeed: 1 + Math.random() * 3,
      //       baseSize: 3 + Math.random() * 6,
      //       phase: Math.random() * Math.PI * 2,
      //     });
      //   }
    
      //   const smokeGeo = new THREE.BufferGeometry();
      //   smokeGeo.setAttribute(
      //     "position",
      //     new THREE.BufferAttribute(smokePositions, 3),
      //   );
    
      //   const smokeMat = new THREE.PointsMaterial({
      //     map: smokeTexture,
      //     color: 0x444444,
      //     size: 5,
      //     blending: THREE.NormalBlending,
      //     transparent: true,
      //     opacity: 0.5,
      //     depthWrite: false,
      //   });
    
      //   const smokePoints = new THREE.Points(smokeGeo, smokeMat);
      //   smokePoints.position.copy(explosionPos);
      //   this.world.scene.add(smokePoints);
      //   smokePoints.userData = { smokeData };
    
      //   // Sub-surface glow dome (lightweight)
      //   const glowGeo = new THREE.SphereGeometry(3, 16, 16); // reduced segments
      //   const glowMat = new THREE.MeshBasicMaterial({
      //     color: 0xff4400,
      //     transparent: true,
      //     opacity: 0.4,
      //     blending: THREE.AdditiveBlending,
      //     depthWrite: false,
      //   });
      //   const glowDome = new THREE.Mesh(glowGeo, glowMat);
      //   glowDome.position.copy(explosionPos);
      //   this.world.scene.add(glowDome);
    
      //   // Inner bright core
      //   const coreGeo = new THREE.SphereGeometry(1, 8, 8);
      //   const coreMat = new THREE.MeshBasicMaterial({
      //     color: 0xffffff,
      //     transparent: true,
      //     opacity: 0.9,
      //     blending: THREE.AdditiveBlending,
      //     depthWrite: false,
      //   });
      //   const core = new THREE.Mesh(coreGeo, coreMat);
      //   core.position.copy(explosionPos);
      //   this.world.scene.add(core);
    
      //   // Flash light
      //   const flashLight = new THREE.PointLight(0xff6600, 0, 60);
      //   flashLight.position.copy(explosionPos);
      //   this.world.scene.add(flashLight);
    
      //   // Animation
      //   let elapsed = 0;
      //   const duration = 2.0;
      //   const expandTime = 0.2;
      //   const burnTime = 0.6;
      //   const decayTime = 1.2;
      //   let lastTime = performance.now();
    
      //   const animateExplosion = () => {
      //     const now = performance.now();
      //     const dt = Math.min(0.05, (now - lastTime) / 1000);
      //     lastTime = now;
      //     elapsed += dt;
    
      //     if (elapsed >= duration) {
      //       this.world.scene.remove(firePoints);
      //       this.world.scene.remove(smokePoints);
      //       this.world.scene.remove(glowDome);
      //       this.world.scene.remove(core);
      //       this.world.scene.remove(flashLight);
      //       fireGeo.dispose();
      //       fireMat.dispose();
      //       smokeGeo.dispose();
      //       smokeMat.dispose();
      //       glowGeo.dispose();
      //       glowMat.dispose();
      //       coreGeo.dispose();
      //       coreMat.dispose();
      //       return;
      //     }
    
      //     const progress = elapsed / duration;
      //     let scale;
    
      //     // Phase 1: Rapid expansion
      //     if (elapsed < expandTime) {
      //       const t = elapsed / expandTime;
      //       const easeOut = 1 - Math.pow(1 - t, 3);
      //       scale = 0.01 + easeOut * 2.5;
      //       flashLight.intensity = 25 * easeOut;
      //       core.scale.setScalar(0.01 + easeOut * 2.5);
      //       glowDome.scale.setScalar(0.01 + easeOut * 2.5);
      //       fireMat.opacity = 0.8 * easeOut;
      //       smokeMat.opacity = 0.5 * easeOut * 0.3;
      //     }
      //     // Phase 2: Intense burn
      //     else if (elapsed < expandTime + burnTime) {
      //       const t = (elapsed - expandTime) / burnTime;
      //       const pulse = 1 + Math.sin(elapsed * 8) * 0.05;
      //       scale = 2.5 * pulse;
      //       fireMat.opacity = 0.8 * (1 - t * 0.3);
      //       smokeMat.opacity = 0.5 * Math.min(1, t * 2);
      //       core.scale.setScalar(2.5 * (1 - t * 0.4));
      //       glowDome.scale.setScalar(2.5 * pulse);
      //       flashLight.intensity = 25 * (1 - t * 0.4);
      //     }
      //     // Phase 3: Die down
      //     else {
      //       const t = (elapsed - expandTime - burnTime) / decayTime;
      //       const easeIn = t * t;
      //       scale = 2.5 * (1 + easeIn * 0.3);
      //       fireMat.opacity = Math.max(0, 0.56 - easeIn * 0.56);
      //       smokeMat.opacity = Math.max(0, 0.5 * (1 - t * 0.5));
      //       coreMat.opacity = Math.max(0, 0.9 - easeIn * 0.9);
      //       glowMat.opacity = Math.max(0, 0.4 - easeIn * 0.4);
      //       flashLight.intensity = 15 * (1 - easeIn);
      //     }
    
      //     firePoints.scale.setScalar(scale);
      //     smokePoints.scale.setScalar(scale * 1.2);
    
      //     // Move smoke upward
      //     const smokePos = smokeGeo.attributes.position.array;
      //     const smokeDataArr = smokePoints.userData.smokeData;
      //     for (let i = 0; i < smokeCount; i++) {
      //       smokePos[i * 3 + 1] += dt * smokeDataArr[i].riseSpeed * (1 + progress);
      //     }
      //     smokeGeo.attributes.position.needsUpdate = true;
    
      //     requestAnimationFrame(animateExplosion);
      //   };
    
      //   requestAnimationFrame(animateExplosion);
    
      //   // Damage nearby players
      //   if (window.players) {
      //     const allPlayers = window.players.getAll();
      //     allPlayers.forEach((p) => {
      //       if (p === this.player) return;
      //       if (p.isDead) return;
      //       const dist = p.threeObj.position.distanceTo(explosionPos);
      //       if (dist < 10) {
      //         const damage = Math.floor(80 * (1 - dist / 10));
      //         p.takeDamage(damage, this.player?.id || null);
      //       }
      //     });
      //   }
      // }
      
      // ✅ Add this function to create voice chat UI
      export function createVoiceChatUI() {
        // Check if voice chat UI already exists
        if (document.getElementById("voice-chat")) return;
      
        // Create voice chat container
        const voiceChatDiv = document.createElement("div");
        voiceChatDiv.id = "voice-chat";
      
        // Create voice controls
        const voiceControls = document.createElement("div");
        voiceControls.className = "voice-controls";
      
        // Create voice toggle button
        const voiceToggle = document.createElement("button");
        voiceToggle.id = "voice-toggle";
        voiceToggle.textContent = "🎤";
        voiceToggle.style.cssText = `
          width: 48px;
          height: 48px;
        `;
      
        // Create mic level indicator
        const micLevel = document.createElement("div");
        micLevel.className = "mic-level";
        micLevel.style.cssText = `
          width: 4px;
          height: 30px;
          background: rgba(0, 255, 0, 0.5);
          border-radius: 2px;
          transition: height 0.05s;
        `;
      
        // Create voice users list
        const voiceUsersList = document.createElement("div");
        voiceUsersList.className = "voice-users-list";
        voiceUsersList.style.cssText = `
          position: absolute;
          bottom: 60px;
          left: 0;
          background: rgba(0, 0, 0, 0.8);
          border-radius: 8px;
          padding: 8px;
          min-width: 150px;
          max-height: 200px;
          overflow-y: auto;
          display: none;
          backdrop-filter: blur(5px);
          border: 1px solid rgba(80, 140, 220, 0.3);
        `;
      
        voiceControls.appendChild(voiceToggle);
        voiceControls.appendChild(micLevel);
        voiceChatDiv.appendChild(voiceControls);
        voiceChatDiv.appendChild(voiceUsersList);
      
        // Add hover effect to show users list
        voiceChatDiv.addEventListener("mouseenter", () => {
          voiceUsersList.style.display = "block";
        });
      
        voiceChatDiv.addEventListener("mouseleave", () => {
          voiceUsersList.style.display = "none";
        });
      
        document.body.appendChild(voiceChatDiv);
      
        // Add styles for voice chat if not already present
        if (!document.getElementById("voice-chat-styles")) {
          const style = document.createElement("style");
          style.id = "voice-chat-styles";
          style.textContent = `
            .voice-user {
              display: flex;
              align-items: center;
              gap: 8px;
              padding: 4px 8px;
              font-size: 12px;
              color: #fff;
              font-family: 'Share Tech Mono', monospace;
            }
            
            .voice-user .status {
              width: 8px;
              height: 8px;
              border-radius: 50%;
              background: #666;
            }
            
            .voice-user .status.connected {
              background: #00ff00;
              box-shadow: 0 0 5px #00ff00;
            }
            
            .voice-user .status.connecting {
              background: #ffaa00;
              animation: pulse 1s infinite;
            }
            
            .voice-user .status.disconnected {
              background: #ff0000;
            }
            
            .voice-user.speaking {
              background: rgba(0, 255, 0, 0.2);
              border-left: 2px solid #00ff00;
            }
            
            .voice-toggle.enabled {
              background: rgba(255, 0, 0, 0.7);
              border-color: rgba(255, 80, 80, 0.8);
              animation: pulse-red 1s infinite;
            }
            
            .voice-toggle.disabled {
              background: rgba(0, 0, 0, 0.7);
              border-color: rgba(80, 140, 220, 0.5);
            }
            
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.5; }
            }
            
            @keyframes pulse-red {
              0%, 100% { box-shadow: 0 0 0 0 rgba(255, 0, 0, 0.4); }
              50% { box-shadow: 0 0 0 5px rgba(255, 0, 0, 0); }
            }
          `;
          document.head.appendChild(style);
        }
      }