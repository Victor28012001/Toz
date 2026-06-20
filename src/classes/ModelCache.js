// client/src/classes/ModelCache.js
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

class ModelCache {
    constructor() {
        this.playerModel = null;
        this.playerAnimations = null;
        this.weaponModels = new Map();
        this.loader = new GLTFLoader();
        this.isLoading = false;
        this.loadPromise = null;
    }

    // Preload player model once
    async preloadPlayerModel() {
        if (this.playerModel) return this.playerModel;
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = new Promise((resolve, reject) => {
            this.loader.load(
                "/assets/models/soldier10.glb",
                (gltf) => {
                    // Clone the model for deep copy
                    this.playerModel = gltf.scene.clone(true);
                    this.playerAnimations = gltf.animations;
                    console.log("✅ Player model cached");
                    resolve(this.playerModel);
                },
                undefined,
                (error) => reject(error)
            );
        });

        return this.loadPromise;
    }

    // Preload weapon models
    async preloadWeaponModel(weaponConfig) {
        if (this.weaponModels.has(weaponConfig.name)) {
            return this.weaponModels.get(weaponConfig.name);
        }

        return new Promise((resolve, reject) => {
            this.loader.load(
                weaponConfig.modelPath,
                (gltf) => {
                    const model = gltf.scene.clone(true);
                    model.scale.set(weaponConfig.scale, weaponConfig.scale, weaponConfig.scale);
                    this.weaponModels.set(weaponConfig.name, model);
                    console.log(`✅ Weapon ${weaponConfig.name} cached`);
                    resolve(model);
                },
                undefined,
                (error) => reject(error)
            );
        });
    }

    // Get cached player model (clone for new instance)
    getPlayerModel() {
        if (!this.playerModel) return null;
        // Return a deep clone for the new player
        return this.playerModel.clone(true);
    }

    getPlayerAnimations() {
        return this.playerAnimations;
    }

    // Get cached weapon model
    getWeaponModel(weaponName) {
        const model = this.weaponModels.get(weaponName);
        if (!model) return null;
        return model.clone(true);
    }

    // Preload all default weapons
    async preloadAllWeapons(weaponConfigs) {
        const promises = weaponConfigs.map(config => this.preloadWeaponModel(config));
        await Promise.all(promises);
        console.log("✅ All weapons preloaded");
    }
}

// Singleton instance
export const modelCache = new ModelCache();