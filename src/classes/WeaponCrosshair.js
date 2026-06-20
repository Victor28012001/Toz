import * as THREE from "three";

export class WeaponCrosshair {
  constructor(camera, scene) {
    this.camera = camera;
    this.scene = scene;
    this.group = null;
    this.isVisible = false;
    this.isAiming = false;
    this.distance = 9;
    this.spreadRadius = 0.08;
    this.baseRadius = 0.06;
    this.currentColor = 0x00ff00;
    this.hitColor = 0xff0000;
    this._hitTimeout = null;

    // Reusable color objects — avoid new THREE.Color() each frame
    this._colorNormal = new THREE.Color(this.currentColor);
    this._colorHit = new THREE.Color(this.hitColor);
    this._colorDot = new THREE.Color(0xff3333);

    this.createCrosshair();
  }

  createCrosshair() {
    this.group = new THREE.Group();

    // Single shared material instances — not one per mesh
    this._ringMat = new THREE.MeshBasicMaterial({
      color: this.currentColor,
      depthTest: false,   // always renders on top, no depth sort cost
    });
    this._lineMat = new THREE.MeshBasicMaterial({
      color: this.currentColor,
      depthTest: false,
    });
    this._dotMat = new THREE.MeshBasicMaterial({
      color: 0xff3333,
      depthTest: false,
    });

    // Spread ring — lower segment counts for mobile
    this.spreadRing = new THREE.Mesh(
      new THREE.TorusGeometry(this.baseRadius, 0.008, 6, 24), // was 12,48
      this._ringMat,
    );
    this.group.add(this.spreadRing);

    // Center dot — lowest poly count
    this.centerDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 4, 4), // was 8,8
      this._dotMat,
    );
    this.group.add(this.centerDot);

    // Four lines — share ONE geometry per axis, shared material
    const hBar = new THREE.BoxGeometry(0.1, 0.012, 0.005);
    const vBar = new THREE.BoxGeometry(0.012, 0.1, 0.005);

    this.lineN = new THREE.Mesh(vBar, this._lineMat);
    this.lineS = new THREE.Mesh(vBar, this._lineMat); // reuse same geometry
    this.lineE = new THREE.Mesh(hBar, this._lineMat);
    this.lineW = new THREE.Mesh(hBar, this._lineMat);

    this.lineN.position.set(0, 0.14, 0);
    this.lineS.position.set(0, -0.14, 0);
    this.lineE.position.set(0.14, 0, 0);
    this.lineW.position.set(-0.14, 0, 0);

    this.group.add(this.lineN);
    this.group.add(this.lineS);
    this.group.add(this.lineE);
    this.group.add(this.lineW);

    this.group.position.set(0, 0, -this.distance);
    this.group.visible = false;

    // renderOrder ensures it draws last, avoiding overdraw sorting
    this.group.renderOrder = 999;

    this.camera.add(this.group);
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
    aiming ? this.show() : this.hide();
  }

  update() {
    if (!this.isVisible) return;

    // Skip update if spread has fully recovered — saves 6 position writes per frame
    const diff = this.baseRadius - this.spreadRadius;
    if (Math.abs(diff) < 0.0001) return;

    this.spreadRadius += diff * 0.15;
    const scale = this.spreadRadius / this.baseRadius;
    this.spreadRing.scale.setScalar(scale);

    const offset = 0.14 + (scale - 1) * 0.12;
    this.lineN.position.y = offset;
    this.lineS.position.y = -offset;
    this.lineE.position.x = offset;
    this.lineW.position.x = -offset;
  }

  fireFeedback() {
    this.spreadRadius = this.baseRadius * 2.2;
  }

  hitFeedback() {
    // Avoid allocating new color objects — reuse cached ones
    this._ringMat.color.copy(this._colorHit);
    this._dotMat.color.copy(this._colorHit);

    if (this._hitTimeout) clearTimeout(this._hitTimeout);
    this._hitTimeout = setTimeout(() => {
      this._ringMat.color.copy(this._colorNormal);
      this._dotMat.color.copy(this._colorDot);
      this._hitTimeout = null;
    }, 150);
  }

  setColor(color) {
    this.currentColor = color;
    this._colorNormal.setHex(color);
    this._ringMat.color.setHex(color);
    this._lineMat.color.setHex(color);
  }

  dispose() {
    if (this._hitTimeout) clearTimeout(this._hitTimeout);
    this.spreadRing.geometry.dispose();
    this.centerDot.geometry.dispose();
    this._ringMat.dispose();
    this._lineMat.dispose();
    this._dotMat.dispose();
    this.camera.remove(this.group);
  }
}