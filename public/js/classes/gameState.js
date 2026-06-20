// From main.js to utils.js
import { originalPlayerOpacity } from "./main.js";

export function storePlayerOpacity(player) {
  if (!player) return;

  originalPlayerOpacity.clear();

  player.traverse((child) => {
    // Skip weapons when storing opacity
    if (child.isMesh && child.material && !child.name.includes("weapon_")) {
      if (Array.isArray(child.material)) {
        originalPlayerOpacity.set(
          child,
          child.material.map((mat) => ({
            opacity: mat.opacity,
            transparent: mat.transparent,
          }))
        );
      } else {
        originalPlayerOpacity.set(child, {
          opacity: child.material.opacity,
          transparent: child.material.transparent,
        });
      }
    }
  });
}

export function setPlayerOpacity(player, opacity) {
  if (!player) return;

  player.traverse((child) => {
    // Skip weapons when setting opacity - they should always be fully visible
    if (child.isMesh && child.material && !child.name.includes("weapon_")) {
      if (Array.isArray(child.material)) {
        child.material.forEach((mat) => {
          mat.opacity = opacity;
          mat.transparent = opacity < 1.0;
          mat.needsUpdate = true;
        });
      } else {
        child.material.opacity = opacity;
        child.material.transparent = opacity < 1.0;
        child.material.needsUpdate = true;
      }
    }
  });
}

export function restorePlayerOpacity(player) {
  if (!player) return;

  player.traverse((child) => {
    if (child.isMesh && child.material && originalPlayerOpacity.has(child)) {
      const original = originalPlayerOpacity.get(child);

      if (Array.isArray(child.material) && Array.isArray(original)) {
        child.material.forEach((mat, index) => {
          if (original[index]) {
            mat.opacity = original[index].opacity;
            mat.transparent = original[index].transparent;
            mat.needsUpdate = true;
          }
        });
      } else if (!Array.isArray(child.material) && !Array.isArray(original)) {
        child.material.opacity = original.opacity;
        child.material.transparent = original.transparent;
        child.material.needsUpdate = true;
      }
    }
  });

  originalPlayerOpacity.clear();
}