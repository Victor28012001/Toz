// classes/MapManager.js
import * as THREE from "three";

// Greeble map scale factor — used to convert room world coords
// The greeble map uses mapScale:8, shooting_range uses mapScale:15
// Room definitions are authored at shooting_range scale, so we must NOT apply them to greeble_map.

export const MAPS = {
  shooting_range: {
    name: "Shooting Range",
    modelPath: "/assets/models/maps/shooting_game_enviornment_map_tdm5-opt.glb",
    description: "Desert training ground with buildings",
    icon: "🎯",
    mapScale: 15,
    groundMeshName: "ground_ground_0",
    buildingNamePrefix: "Building_",
    hasBarrier: true,
    barrierOpacity: 0.1,
    background: 0x87ceeb,
    ambientLight: 0x404060,
    sunPosition: { x: 1000, y: 2000, z: 1000 },
    spawnOffset: { x: 0, y: 2, z: 0 },
    hasRooms: true,
    hasSpawnBoxes: true,
    roomAssetScale: 1,
    scaleFactor: 8,
    hasJetpack: false,
    // Normal jump for this map
    useJetpack: false,
  },
  greeble_map: {
    name: "Greeble Game Map",
    modelPath: "/assets/models/maps/greeble_game_map2-opt.glb",
    description: "Ancient ruins - Deathmatch",
    icon: "🏛️",
    mapScale: 24,
    groundMeshName: null,
    buildingNamePrefix: null,
    hasBarrier: false,
    barrierOpacity: 0,
    background: 0x1a1a2e,
    ambientLight: 0x303060,
    sunPosition: { x: 500, y: 1500, z: 500 },
    spawnMeshName: "Plane002_walls_0",
    spawnOffset: { x: -28, y: 5, z: 0 },
    hasRooms: false, // No shooting-range rooms on greeble map
    hasSpawnBoxes: false,
    hasJetpack: true,
    useJetpack: true,
    roomAssetScale: 1,
    // Jetpack pickup spawn positions (multiple random spawns handled in World)
    jetpackSpawnCount: 6, // how many pickups to scatter
    jetpackSpawnRadius: 840, // radius around map center to scatter them
    jetpackSpawnY: 5,
    clientSideSpawn: true,
  },
  lowpoly_environment: {
    name: "Low Poly Environment",
    modelPath: "/assets/models/maps/lowpoly_environment-optss.glb",
    description: "Low poly fantasy environment with windmills and bridges",
    icon: "🌳",
    mapScale: 600, // Matches your playtest scale
    groundMeshName: null,
    buildingNamePrefix: null,
    hasBarrier: false,
    barrierOpacity: 0,
    background: 0x1a1a2e,
    ambientLight: 0x404060,
    sunPosition: { x: 10, y: 20, z: 10 },
    spawnMeshName: "Object_63", // The mesh you're spawning on
    spawnOffset: { x: 0, y: 6800, z: 0 }, // left offset + high spawn
    hasRooms: false,
    hasSpawnBoxes: false,
    hasJetpack: false,
    useJetpack: false,
    roomAssetScale: 1,
    // Collision settings
    ignoreCollisionObjects: ["Object_61", "Object_37"], // Skip branches and foliage
    ignoreCollisionMaterials: ["branch", "drytree_texture"],
    clientSideSpawn: true,
  },
};

export default class MapManager {
  constructor(world) {
    this.world = world;
    this.currentMap = null;
    this.currentMapConfig = null;
    this.isLoading = false;
  }

  selectMap(mapKey, mapConfig) {
    if (this.isLoading) return;

    this.isLoading = true;
    this.currentMap = mapKey;
    this.currentMapConfig = mapConfig;

    console.log(
      `Loading map: ${mapConfig.name} with scale: ${mapConfig.mapScale}`,
    );

    this.showLoadingIndicator(mapConfig.name);
    this.clearCurrentEnvironment();
    this.updateWorldSettings(mapConfig);
    this.loadEnvironmentModel(mapConfig);
  }

  clearCurrentEnvironment() {
    if (this.world.currentEnvironmentModel) {
      this.world.scene.remove(this.world.currentEnvironmentModel);
      this.world.currentEnvironmentModel = null;
    }

    this.world.objects = [];
    this.world.buildingMeshes = [];
    this.world.clearSpawnPointBoxes();
    this.world.spawnPointsRequested = false;

    if (this.world.barrierMesh) {
      this.world.scene.remove(this.world.barrierMesh);
      this.world.barrierMesh = null;
    }
    if (this.world.ringMesh) {
      this.world.scene.remove(this.world.ringMesh);
      this.world.ringMesh = null;
    }
    if (this.world.groundRing) {
      this.world.scene.remove(this.world.groundRing);
      this.world.groundRing = null;
    }

    this.world.environmentLoaded = false;

    const jetpackUI = document.getElementById("jetpack-ui");
    if (jetpackUI) jetpackUI.remove();

    if (this.world.controls) {
      this.world.controls.jetpackActive = false;
      this.world.controls.isJetpacking = false;
      this.world.controls.jetpackFuel = 0;
      this.world.controls.disableJetpack?.();
    }

    // Clear all jetpack pickups
    if (this.world.jetpackPickups) {
      this.world.jetpackPickups.forEach((p) => {
        if (p.mesh) this.world.scene.remove(p.mesh);
        if (p.modelMesh) this.world.scene.remove(p.modelMesh);
      });
      this.world.jetpackPickups = [];
    }
    if (this.world.jetpackPickup) {
      this.world.scene.remove(this.world.jetpackPickup);
      this.world.jetpackPickup = null;
    }

    // Clear attached jetpack model
    if (this.world.controls?.attachedJetpackModel) {
      this.world.scene.remove(this.world.controls.attachedJetpackModel);
      this.world.controls.attachedJetpackModel = null;
    }
  }

  updateWorldSettings(mapConfig) {
    if (this.world.scene) {
      this.world.scene.background = new THREE.Color(mapConfig.background);
    }
    if (this.world.ambientLight) {
      this.world.ambientLight.color.setHex(mapConfig.ambientLight);
    }
    if (this.world.sunLight) {
      this.world.sunLight.position.set(
        mapConfig.sunPosition.x,
        mapConfig.sunPosition.y,
        mapConfig.sunPosition.z,
      );
    }
  }

  // loadEnvironmentModel(mapConfig) {
  //   this.world.gltfLoader.load(
  //     mapConfig.modelPath,
  //     (gltf) => {
  //       console.log(`${mapConfig.name} loaded successfully`);
  //       const model = gltf.scene;
  //       this.world.currentEnvironmentModel = model;

  //       model.scale.set(
  //         mapConfig.mapScale,
  //         mapConfig.mapScale,
  //         mapConfig.mapScale,
  //       );
  //       model.position.set(0, 0, 0);
  //       model.rotation.set(0, 0, 0);

  //       if (mapConfig.hasBarrier) {
  //         this.processMapWithBarrier(model, mapConfig);
  //       } else {
  //         this.processMapWithoutBarrier(model, mapConfig);
  //       }

  //       this.world.scene.add(model);
  //       this.world.environmentLoaded = true;
  //       this.world.scene.updateMatrixWorld(true);

  //       if (this.world.player) {
  //         this.positionPlayerOnMap(model, mapConfig);
  //       } else {
  //         // Only defer spawn for maps that use client-side positioning
  //         this.world._pendingSpawnModel = model;
  //         this.world._pendingSpawnConfig = mapConfig;
  //         console.log("Player not ready at map load — spawn deferred");
  //       }

  //       if (mapConfig.hasBarrier) {
  //         this.world.findBuildingMeshes();
  //         this.world.createMapBarrier(model);
  //       }

  //       if (mapConfig.hasRooms) {
  //         this.world.preloadRoomAssets();
  //       }

  //       if (mapConfig.hasSpawnBoxes && this.world.player?.socket) {
  //         this.world.requestSpawnPointsFromServer();
  //       }

  //       // For greeble map: Wait for player model to load before activating jetpack
  //       if (mapConfig.useJetpack && this.world.controls) {
  //         console.log("=== JETPACK ACTIVATION FOR GREEBLE MAP ===");
  //         console.log("mapConfig.useJetpack:", mapConfig.useJetpack);
  //         console.log("this.world.controls exists:", !!this.world.controls);

  //         const world = this.world;
  //         const controls = this.world.controls;

  //         const checkPlayerModel = setInterval(() => {
  //           console.log(
  //             "Waiting for player - modelLoaded:",
  //             world.player?.modelLoaded,
  //             "spineBone:",
  //             !!controls?.spineBone,
  //           );

  //           if (world.player?.modelLoaded && controls?.spineBone) {
  //             clearInterval(checkPlayerModel);
  //             console.log("Player ready, spawning jetpack pickups...");

  //             controls.activateJetpack();

  //             if (world._attachJetpackToPlayer) {
  //               world._attachJetpackToPlayer();
  //             }

  //             // This is where pickups should spawn
  //             if (world.spawnJetpackPickups) {
  //               console.log(
  //                 "Calling spawnJetpackPickups with config:",
  //                 mapConfig,
  //               );
  //               world.spawnJetpackPickups(mapConfig);
  //             } else {
  //               console.error("world.spawnJetpackPickups is not a function!");
  //             }
  //           }
  //         }, 100);
  //       } else {
  //         console.log(
  //           "Jetpack condition NOT met. useJetpack:",
  //           mapConfig.useJetpack,
  //           "controls exists:",
  //           !!this.world.controls,
  //         );
  //       }

  //       this.hideLoadingIndicator();
  //       this.isLoading = false;
  //     },
  //     (xhr) => {
  //       const percent = Math.round((xhr.loaded / xhr.total) * 100);
  //       this.updateLoadingProgress(percent);
  //     },
  //     (error) => {
  //       console.error("Error loading environment model:", error);
  //       this.hideLoadingIndicator();
  //       this.isLoading = false;
  //     },
  //   );
  // }

  loadEnvironmentModel(mapConfig) {
    // ✅ Show loading screen (visual only - doesn't affect timing)
    this.world.showMapLoadingScreen(mapConfig.name);
    this.world.updateLoadingProgress(0, "Loading map assets...", "map");

    this.world.gltfLoader.load(
      mapConfig.modelPath,
      (gltf) => {
        console.log(`${mapConfig.name} loaded successfully`);
        this.world.updateLoadingProgress(
          30,
          "Processing map geometry...",
          "map",
        );

        const model = gltf.scene;
        this.world.currentEnvironmentModel = model;

        model.scale.set(
          mapConfig.mapScale,
          mapConfig.mapScale,
          mapConfig.mapScale,
        );
        model.position.set(0, 0, 0);
        model.rotation.set(0, 0, 0);

        this.world.updateLoadingProgress(
          60,
          "Building collision data...",
          "map",
        );

        // ✅ CRITICAL: Process map and build collisions BEFORE any async waits
        if (mapConfig.hasBarrier) {
          this.processMapWithBarrier(model, mapConfig);
        } else {
          this.processMapWithoutBarrier(model, mapConfig);
        }

        this.world.scene.add(model);
        this.world.environmentLoaded = true;
        this.world.scene.updateMatrixWorld(true);

        this.world.updateLoadingProgress(80, "Finalizing map...", "map");

        // ✅ Position player immediately if ready
        if (this.world.player) {
          this.positionPlayerOnMap(model, mapConfig);
          this.world.updateLoadingProgress(100, "Map ready!", "map");

          // ✅ Just update loading progress, don't wait for player model here
          // The player model loading is handled separately in main.js
          this.world.updateLoadingProgress(100, "Ready to deploy!", "player");
          this.world.hideMapLoadingScreen();

          // ✅ SHOW THE READY BUTTON
          this.world.showReadyButton();
        } else {
          // Defer spawn until player is initialized
          this.world._pendingSpawnModel = model;
          this.world._pendingSpawnConfig = mapConfig;
          this.world.updateLoadingProgress(100, "Waiting for player...", "map");
          // Don't hide loading screen - will be hidden when player loads

          // ✅ Wait for player to load and then show button
          const checkPlayer = setInterval(() => {
            if (this.world.player && this.world.player.modelLoaded) {
              clearInterval(checkPlayer);
              this.world.hideMapLoadingScreen();
              this.world.showReadyButton();
            }
          }, 100);

          // Timeout fallback
          setTimeout(() => {
            clearInterval(checkPlayer);
            if (!(this.world.player && this.world.player.modelLoaded)) {
              this.world.hideMapLoadingScreen();
              this.world.showReadyButton();
              console.warn("Player load timeout, showing button anyway");
            }
          }, 10000);
        }

        if (mapConfig.hasBarrier) {
          this.world.findBuildingMeshes();
          this.world.createMapBarrier(model);
        }

        if (mapConfig.hasRooms) {
          this.world.preloadRoomAssets();
        }

        if (mapConfig.hasSpawnBoxes && this.world.player?.socket) {
          this.world.requestSpawnPointsFromServer();
        }

        // For greeble map: Wait for player model to load before activating jetpack
        if (mapConfig.useJetpack && this.world.controls) {
          console.log("=== JETPACK ACTIVATION FOR GREEBLE MAP ===");
          const world = this.world;
          const controls = this.world.controls;

          const checkPlayerModel = setInterval(() => {
            if (world.player?.modelLoaded && controls?.spineBone) {
              clearInterval(checkPlayerModel);
              console.log("Player ready, spawning jetpack pickups...");
              controls.activateJetpack();
              if (world._attachJetpackToPlayer) {
                world._attachJetpackToPlayer();
              }
              if (world.spawnJetpackPickups) {
                world.spawnJetpackPickups(mapConfig);
              }
            }
          }, 100);
        }

        this.hideLoadingIndicator();
        this.isLoading = false;
      },
      (xhr) => {
        const percent = Math.round((xhr.loaded / xhr.total) * 100);
        this.world.updateLoadingProgress(
          percent * 0.8,
          `Loading assets (${percent}%)...`,
          "map",
        );
        this.updateLoadingProgress(percent);
      },
      (error) => {
        console.error("Error loading environment model:", error);
        this.world.updateLoadingProgress(100, "Error loading map!", "map");
        setTimeout(() => this.world.hideMapLoadingScreen(), 2000);
        // ✅ Still show the button on error so player can continue
        setTimeout(() => this.world.showReadyButton(), 2000);
        this.hideLoadingIndicator();
        this.isLoading = false;
      },
    );
  }

  spawnJetpackPickupsForCurrentMap() {
    if (!this.currentMapConfig?.useJetpack) {
      console.log("Current map doesn't use jetpack");
      return;
    }

    console.log(
      "Spawning jetpack pickups for map:",
      this.currentMapConfig.name,
    );

    if (this.world.spawnJetpackPickups) {
      this.world.spawnJetpackPickups(this.currentMapConfig);
    } else {
      console.error("world.spawnJetpackPickups not available");
    }
  }

  processMapWithBarrier(model, mapConfig) {
    model.traverse((child) => {
      if (child.isMesh) {
        child.frustumCulled = true;
        if (!child.geometry.boundingSphere) {
          child.geometry.computeBoundingSphere();
        }
        child.matrixAutoUpdate = false;
        child.updateMatrix();

        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => this.world.fixMaterial(mat));
          } else {
            this.world.fixMaterial(child.material);
          }
        }

        child.castShadow = !this.world.isReducedPerformance;
        child.receiveShadow = !this.world.isReducedPerformance;
        this.world.objects.push(child);

        if (
          mapConfig.groundMeshName &&
          child.name === mapConfig.groundMeshName
        ) {
          this.world.groundMesh = child;
        }
      }
    });
  }

  processMapWithoutBarrier(model, mapConfig) {
    model.traverse((obj) => {
      if (obj.isMesh) {
        // Mark Boundary mesh for special collision handling
        if (obj.name === "Boundary") {
          obj.userData.isBoundary = true;
        }

        // Mark Water mesh
        if (
          obj.name === "Object_69" ||
          (obj.material && obj.material.name === "Water")
        ) {
          obj.userData.isWater = true;
          obj.userData.skipCollision = true;
          console.log("Found Water mesh - will apply buoyancy force");
        }

        // ✅ MARK WATER CURRENT ZONES (Box1 to Box8) - DISABLE COLLISION
        if (obj.name && obj.name.match(/^Box[1-8]$/)) {
          obj.userData.isWaterCurrentZone = true;
          obj.userData.skipCollision = true; // ✅ DISABLE COLLISION FOR BOXES
          const boxNumber = parseInt(obj.name.replace("Box", ""));
          obj.userData.boxNumber = boxNumber;
          obj.userData.currentDirection = null;
        }

        // Skip branch meshes for collision (like Object_61)
        if (
          mapConfig.ignoreCollisionObjects &&
          mapConfig.ignoreCollisionObjects.includes(obj.name)
        ) {
          obj.userData.skipCollision = true;
        }

        // Also check by material name for branches
        if (mapConfig.ignoreCollisionMaterials && obj.material) {
          const materials = Array.isArray(obj.material)
            ? obj.material
            : [obj.material];
          let shouldSkip = false;
          for (const mat of materials) {
            if (mat && mat.name) {
              const matNameLower = mat.name.toLowerCase();
              if (mapConfig.ignoreCollisionMaterials.includes(matNameLower)) {
                shouldSkip = true;
                break;
              }
            }
          }
          if (shouldSkip) {
            obj.userData.skipCollision = true;
          }
        }

        if (Array.isArray(obj.material)) {
          obj.material.forEach((mat) => {
            mat.side = THREE.DoubleSide;
          });
        } else {
          obj.material.side = THREE.DoubleSide;
        }

        // Only build BVH if not skipping collision
        if (
          !obj.userData.skipCollision &&
          obj.geometry &&
          !obj.geometry.boundsTree
        ) {
          obj.geometry.computeBoundsTree();
        }

        this.world.objects.push(obj);

        // Only add to buildingMeshes if not skipping collision
        if (!obj.userData.skipCollision) {
          this.world.buildingMeshes.push(obj);
        }
      }
    });

    // ✅ AFTER processing all boxes, calculate flow directions based on positions
    const boxes = [];
    for (const obj of this.world.objects) {
      if (obj.userData?.isWaterCurrentZone) {
        boxes.push(obj);
      }
    }

    if (boxes.length > 0) {
      // Sort ascending by box number (Box1=1 is downstream, Box8=8 is upstream)
      boxes.sort((a, b) => a.userData.boxNumber - b.userData.boxNumber);

      // Force world matrix update so getWorldPosition is accurate
      boxes.forEach((box) => box.updateWorldMatrix(true, false));

      // Flow is FROM upstream (high number) TOWARD downstream (low number).
      // For box[i], the downstream neighbour is box[i-1].
      // So assign each box a direction pointing at the next lower-numbered box.
      for (let i = 1; i < boxes.length; i++) {
        const upstreamBox = boxes[i]; // e.g. Box5
        const downstreamBox = boxes[i - 1]; // e.g. Box4

        const upstreamPos = new THREE.Vector3();
        const downstreamPos = new THREE.Vector3();
        upstreamBox.getWorldPosition(upstreamPos);
        downstreamBox.getWorldPosition(downstreamPos);

        // Direction: upstream → downstream
        const direction = new THREE.Vector3()
          .subVectors(downstreamPos, upstreamPos)
          .setY(0) // keep horizontal only
          .normalize();

        upstreamBox.userData.currentDirection = direction;
      }

      // Box1 (the most downstream exit) inherits direction from Box2
      // so the player keeps moving as they exit
      const box1 = boxes[0]; // lowest = most downstream
      if (boxes.length > 1) {
        const box2 = boxes[1];
        if (box2.userData.currentDirection) {
          box1.userData.currentDirection =
            box2.userData.currentDirection.clone();
        }
      } else {
        box1.userData.currentDirection = new THREE.Vector3(1, 0, 0); // fallback
      }
    }
  }

  positionPlayerOnMap(model, mapConfig) {
    if (!this.world.player) return;

    // ✅ For server-side spawn maps, the server already placed the player correctly.
    // Only reposition if this map uses client-side spawning.
    if (!mapConfig.clientSideSpawn) {
      console.log("Server-spawn map — skipping client-side repositioning");
      return;
    }

    const playerObj = this.world.player.threeObj;

    if (mapConfig.spawnMeshName) {
      let targetMesh = null;
      model.traverse((obj) => {
        if (obj.isMesh && obj.name === mapConfig.spawnMeshName) {
          targetMesh = obj;
        }
      });

      if (targetMesh) {
        // Get the mesh's world position directly
        // const meshWorldPos = targetMesh.getWorldPosition(new THREE.Vector3());

        if (mapConfig.name === "Low Poly Environment") {
          // Search entire model for the Boundary mesh
          let boundaryMesh = null;
          model.traverse((obj) => {
            if (obj.isMesh && obj.name === "Boundary") {
              boundaryMesh = obj;
            }
          });

          if (boundaryMesh) {
            boundaryMesh.updateWorldMatrix(true, false);
            const boundaryBox = new THREE.Box3().setFromObject(boundaryMesh);
            const boundaryCenter = new THREE.Vector3();
            boundaryBox.getCenter(boundaryCenter);

            const SPAWN_HEIGHT_ABOVE_TOP = 120;

            // Random X and Z anywhere inside the Boundary box footprint
            const randomX =
              boundaryBox.min.x +
              Math.random() * (boundaryBox.max.x - boundaryBox.min.x);
            const randomZ =
              boundaryBox.min.z +
              Math.random() * (boundaryBox.max.z - boundaryBox.min.z);

            playerObj.position.set(
              randomX,
              boundaryBox.max.y + SPAWN_HEIGHT_ABOVE_TOP,
              randomZ,
            );
          } else {
            // Boundary mesh not found — log all mesh names to help debug
            console.warn(
              "Boundary mesh not found in Low Poly model. Available meshes:",
            );
            model.traverse((obj) => {
              if (obj.isMesh) console.log(" -", obj.name);
            });
            // Fallback to map center
            const box = new THREE.Box3().setFromObject(model);
            const center = new THREE.Vector3();
            box.getCenter(center);
            playerObj.position.set(center.x, box.max.y + 50, center.z);
          }
          playerObj.updateMatrixWorld();
          return;
        } else if (mapConfig.name === "Greeble Game Map") {
          // Fixed spawn position at the center of the map
          playerObj.position.set(0, 15, 0);
          console.log(
            "Player spawned at center of greeble map:",
            playerObj.position,
          );
        } else {
          // Original logic for other maps
          const targetBox = new THREE.Box3().setFromObject(targetMesh);
          const targetCenter = new THREE.Vector3();
          targetBox.getCenter(targetCenter);
          const bottomY = targetBox.min.y;

          const spawnPosition = new THREE.Vector3(
            targetCenter.x + mapConfig.spawnOffset.x,
            bottomY + mapConfig.spawnOffset.y,
            targetCenter.z + mapConfig.spawnOffset.z,
          );
          playerObj.position.copy(spawnPosition);
        }
        playerObj.updateMatrixWorld();
        return;
      }
    }

    // Fallback: spawn at center of map
    const box = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const minY = box.min.y;

    playerObj.position.set(
      center.x + mapConfig.spawnOffset.x,
      minY + mapConfig.spawnOffset.y + 5,
      center.z + mapConfig.spawnOffset.z,
    );
  }

  showLoadingIndicator(mapName) {
    let loadingDiv = document.getElementById("mapLoadingIndicator");
    if (!loadingDiv) {
      loadingDiv = document.createElement("div");
      loadingDiv.id = "mapLoadingIndicator";
      loadingDiv.style.cssText = `
        position: fixed; top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0,0,0,0.9);
        color: white; padding: 20px 40px;
        border-radius: 10px; font-family: Arial, sans-serif;
        text-align: center; z-index: 101;
        border: 2px solid #ffaa00;
      `;
      document.body.appendChild(loadingDiv);
    }
    loadingDiv.innerHTML = `
      <h3>Loading ${mapName}...</h3>
      <div style="width:300px;height:4px;background:#333;margin-top:15px;border-radius:2px;overflow:hidden;">
        <div id="loadingProgress" style="width:0%;height:100%;background:#ffaa00;transition:width 0.3s;"></div>
      </div>
      <p id="loadingPercent" style="margin-top:10px;font-size:12px;">0%</p>
    `;
    loadingDiv.style.display = "block";
  }

  updateLoadingProgress(percent) {
    const progressBar = document.getElementById("loadingProgress");
    const percentText = document.getElementById("loadingPercent");
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (percentText) percentText.textContent = `${percent}%`;
  }

  hideLoadingIndicator() {
    const loadingDiv = document.getElementById("mapLoadingIndicator");
    if (loadingDiv) loadingDiv.style.display = "none";
  }
}
