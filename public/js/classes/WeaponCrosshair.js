// WeaponCrosshair.js
import * as THREE from "three";

export class WeaponCrosshair {
  constructor(camera, scene) {
    this.camera = camera;
    this.scene = scene;
    this.group = null;
    this.isVisible = false;
    this.isAiming = false;
    this.distance = 9;
    this.spreadRadius = 0.08; // current spread (animated)
    this.baseRadius = 0.06; // resting spread when aimed
    this.currentColor = 0x00ff00;
    this.hitColor = 0xff0000;
    this.createCrosshair();
  }

  createCrosshair() {
    this.group = new THREE.Group();

    // Spread ring (replaces static inner ring — grows on fire)
    const ringMat = new THREE.MeshBasicMaterial({ color: this.currentColor });
    this.spreadRing = new THREE.Mesh(
      new THREE.TorusGeometry(this.baseRadius, 0.008, 12, 48),
      ringMat,
    );
    this.group.add(this.spreadRing);

    // Center dot
    this.centerDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff3333 }),
    );
    this.group.add(this.centerDot);

    // Four lines that pull back from centre (gap shows spread)
    const lineMat = () =>
      new THREE.MeshBasicMaterial({ color: this.currentColor });
    const makeBar = (w, h) => new THREE.BoxGeometry(w, h, 0.005);

    this.lines = {
      n: new THREE.Mesh(makeBar(0.012, 0.1), lineMat()),
      s: new THREE.Mesh(makeBar(0.012, 0.1), lineMat()),
      e: new THREE.Mesh(makeBar(0.1, 0.012), lineMat()),
      w: new THREE.Mesh(makeBar(0.1, 0.012), lineMat()),
    };
    this.lines.n.position.set(0, 0.14, 0);
    this.lines.s.position.set(0, -0.14, 0);
    this.lines.e.position.set(0.14, 0, 0);
    this.lines.w.position.set(-0.14, 0, 0);
    Object.values(this.lines).forEach((l) => this.group.add(l));

    this.group.position.set(0, 0, -this.distance);
    this.group.visible = false;
    this.camera.add(this.group);
    this.group.position.set(0, 0, -this.distance);
  }

  show() {
    this.isVisible = true;
    this.group.visible = true;
  }
  hide() {
    this.isVisible = false;
    this.group.visible = false;
  }

  setAiming(aiming) {
    this.isAiming = aiming;
    if (aiming) {
      this.show();
    } else {
      this.hide();
    }
  }

  update() {
    if (!this.isVisible) return;

    // Spread recovery
    this.spreadRadius += (this.baseRadius - this.spreadRadius) * 0.15;
    const scale = this.spreadRadius / this.baseRadius;
    this.spreadRing.scale.setScalar(scale);

    const offset = 0.14 + (scale - 1) * 0.12;
    this.lines.n.position.y = offset;
    this.lines.s.position.y = -offset;
    this.lines.e.position.x = offset;
    this.lines.w.position.x = -offset;
  }

  fireFeedback() {
    this.spreadRadius = this.baseRadius * 2.2; // spike on fire
  }

  hitFeedback() {
    this.spreadRing.material.color.setHex(this.hitColor);
    this.centerDot.material.color.setHex(this.hitColor);
    setTimeout(() => {
      this.spreadRing.material.color.setHex(this.currentColor);
      this.centerDot.material.color.setHex(0xff3333);
    }, 150);
  }

  setColor(color) {
    this.currentColor = color;
    this.spreadRing.material.color.setHex(color);
    Object.values(this.lines).forEach((l) => l.material.color.setHex(color));
  }
}
