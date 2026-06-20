import * as THREE from "three";

// math utilities
function lerp(min, max, value) {
  return (max - min) * value + min;
}

function invLerp(min, max, value) {
  return (value - min) / (max - min);
}

// Easing functions
const Easing = {
  linear: (x) => x,
  easeInQuad: (x) => x * x,
  easeOutQuad: (x) => 1 - (1 - x) * (1 - x),
  easeInOutQuad: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
  easeInCubic: (x) => x * x * x,
  easeOutCubic: (x) => 1 - Math.pow(1 - x, 3),
  easeInOutCubic: (x) =>
    x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
  easeInQuart: (x) => x * x * x * x,
  easeOutQuart: (x) => 1 - Math.pow(1 - x, 4),
  easeInExpo: (x) => (x === 0 ? 0 : Math.pow(2, 10 * x - 10)),
  easeOutExpo: (x) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  easeInOutExpo: (x) =>
    x === 0
      ? 0
      : x === 1
      ? 1
      : x < 0.5
      ? Math.pow(2, 20 * x - 10) / 2
      : (2 - Math.pow(2, -20 * x + 10)) / 2,
  easeOutCirc: (x) => Math.sqrt(1 - Math.pow(x - 1, 2)),
  easeOutBack: (x) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  },
};

// RandomSparkles geometry
class RandomSparkles extends THREE.BufferGeometry {
  constructor(nbSparkles) {
    super();
    const positions = [];
    // Reduce from 200 to 30-40 for performance
    const count = Math.min(nbSparkles, 40);
    for (let i = 0; i < count; i++) {
      const radius = 0.5 + Math.random() * 0.5;
      const angle = Math.random() * Math.PI * 2;
      const x = radius * Math.cos(angle);
      const y = 0.5 + Math.random() * 1;
      const z = -radius * Math.sin(angle);
      positions.push(x, y, z);
    }
    this.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
  }
}

// Timeline class
class Timeline {
  constructor(variables) {
    this.frame = null;
    this.variables = this._computeTimeline(variables);
    this.timestamp = 0;
    this.listeners = [];
  }

  _computeKeyframes(initialValue, keyframes) {
    const result = [];
    let previousKeyframe = undefined;

    for (const { delay = 0, duration, value, easing } of keyframes) {
      if (delay > 0) {
        const startAt = previousKeyframe?.endAt ?? 0;
        const endAt = startAt + delay;
        const delayValue = previousKeyframe?.to ?? initialValue;
        const delayKeyframe = {
          startAt,
          endAt,
          from: delayValue,
          to: delayValue,
          easing,
        };
        result.push(delayKeyframe);
        previousKeyframe = delayKeyframe;
      }
      const startAt = previousKeyframe?.endAt ?? 0;
      const endAt = startAt + duration;
      const from = previousKeyframe?.to ?? initialValue;
      const keyframe = { startAt, endAt, from, to: value, easing };
      result.push(keyframe);
      previousKeyframe = keyframe;
    }
    return result;
  }

  _computeTimeline(variables) {
    return variables.map(({ target, key, initialValue, keyframes }) => ({
      target,
      key,
      keyframes: this._computeKeyframes(initialValue, keyframes),
    }));
  }

  _findKeyframe(keyframes, timestamp) {
    const first = keyframes[0];
    const last = keyframes[keyframes.length - 1];
    if (timestamp < first.startAt) return first;
    if (timestamp > last.endAt) return last;
    return keyframes.find(
      ({ startAt, endAt }) => timestamp >= startAt && timestamp <= endAt,
    );
  }

  _getValue(variable, timestamp) {
    const { startAt, endAt, from, to, easing } = this._findKeyframe(
      variable.keyframes,
      timestamp,
    );
    if (from === to) return from;
    const progress = invLerp(startAt, endAt, timestamp);
    if (progress <= 0) return from;
    if (progress >= 1) return to;
    return lerp(from, to, easing(progress));
  }

  _isCompleted(timestamp) {
    return this.variables.every(
      ({ keyframes }) => keyframes[keyframes.length - 1].endAt < timestamp,
    );
  }

  play() {
    if (this.running()) return;
    let lastTimestamp = Date.now();

    const tick = () => {
      const now = Date.now();
      this.timestamp += now - lastTimestamp;
      lastTimestamp = now;

      for (const variable of this.variables) {
        variable.target[variable.key] = this._getValue(
          variable,
          this.timestamp,
        );
      }

      if (this._isCompleted(this.timestamp)) {
        this.listeners.forEach((l) => l());
        this.frame = null;
      } else {
        this.frame = requestAnimationFrame(tick);
      }
    };

    this.frame = requestAnimationFrame(tick);
  }

  pause() {
    if (this.frame != null) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }
  }

  seek(timestamp) {
    this.timestamp = timestamp;
    for (const variable of this.variables) {
      variable.target[variable.key] = this._getValue(variable, this.timestamp);
    }
  }

  running() {
    return this.frame != null;
  }

  addEventListener(type, listener) {
    if (type === "completed") this.listeners.push(listener);
  }

  removeEventListener(type, listener) {
    const index = this.listeners.indexOf(listener);
    if (index >= 0) this.listeners.splice(index, 1);
  }
}

// Shaders with proper precision declarations
const fireSmokeVertex = `
precision highp float;

attribute vec3 position;
attribute vec2 uv;

uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat4 modelMatrix;

uniform float u_smokeScale;
uniform float u_height;

varying vec2 v_uv;

void main() {

    vec3 pos = position;

    // scale
    pos *= u_smokeScale;

    // rise upward
    pos.y += u_height;

    // extract camera right/up vectors
    vec3 cameraRight = vec3(
        viewMatrix[0][0],
        viewMatrix[1][0],
        viewMatrix[2][0]
    );

    vec3 cameraUp = vec3(
        viewMatrix[0][1],
        viewMatrix[1][1],
        viewMatrix[2][1]
    );

    // explosion center in world space
    vec3 center = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;

    // billboarded vertex
    vec3 billboardPos =
        center +
        cameraRight * pos.x +
        cameraUp * pos.y;

    gl_Position =
        projectionMatrix *
        viewMatrix *
        vec4(billboardPos, 1.0);

    v_uv = uv;
}
`;

const fireSmokeFragment = `
precision highp float;
uniform float u_time;
uniform float u_noiseSpeed;
uniform float u_noiseScale;
uniform float u_circleLimit;
uniform float u_circleSmoothness;
uniform float u_intensity;
uniform float u_intensitySmoothness;
uniform float u_transparency;
uniform float u_transparencySmoothness;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform vec3 u_c4;
varying vec2 v_uv;

float random(vec3 seed) {
  return fract(sin(dot(seed, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
}

float snoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n = mix(mix(mix(random(i), random(i + vec3(1,0,0)), f.x),
                 mix(random(i + vec3(0,1,0)), random(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(random(i + vec3(0,0,1)), random(i + vec3(1,0,1)), f.x),
                 mix(random(i + vec3(0,1,1)), random(i + vec3(1,1,1)), f.x), f.y), f.z);
  return n * 2.0 - 1.0;
}

float snoiseFractal(vec3 p) {
  return snoise(p) * 0.5 + snoise(p * 2.0) * 0.25 + snoise(p * 4.0) * 0.125 + snoise(p * 8.0) * 0.0625;
}

float invLerp(float a, float b, float v) { return (v - a) / (b - a); }

float quadraticCircle(vec2 uv) {
  float d = distance(uv, vec2(0.5));
  return 1.0 - d * d;
}

vec3 colorRamp(vec3 a, vec3 b, vec3 c, vec3 d, float t) {
  if (t < 0.33) return mix(a, b, t / 0.33);
  if (t < 0.66) return mix(b, c, (t - 0.33) / 0.33);
  return mix(c, d, (t - 0.66) / 0.34);
}

void main() {
  float noise = snoiseFractal(vec3(v_uv * u_noiseScale, u_time * u_noiseSpeed));
  noise = invLerp(-1.5, 0.4, noise);
  float circle = quadraticCircle(v_uv);
  circle = invLerp(u_circleLimit, u_circleLimit + u_circleSmoothness, circle);
  float shape = circle * noise;
  float intensity = invLerp(u_intensity, u_intensity + u_intensitySmoothness, shape);
  float alpha = invLerp(u_transparency, u_transparency + u_transparencySmoothness, shape);
  vec3 color = colorRamp(u_c1, u_c2, u_c3, u_c4, intensity);
  gl_FragColor = vec4(color, alpha);
}
`;

const sparklesVertex = `
precision highp float;
attribute vec3 position;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat4 modelMatrix;
uniform float u_sparkleScale;
uniform float u_sparkleHeight;
uniform float u_sparkleRadius;

void main() {
  vec3 pos = position;
  pos.xz *= u_sparkleRadius;
  pos.y *= u_sparkleHeight;
  vec4 viewPos = viewMatrix * modelMatrix * vec4(pos, 1.0);
  gl_PointSize = 600.0 * u_sparkleScale / -viewPos.z;
  gl_Position = projectionMatrix * viewPos;
}
`;

const sparklesFragment = `
precision highp float;
uniform float u_sparkleIntensity;
uniform vec3 u_c1;
uniform vec3 u_c2;

float linearCircle(vec2 uv) { return 1.0 - distance(uv, vec2(0.5)); }
float invLerp(float a, float b, float v) { return (v - a) / (b - a); }

void main() {
  vec2 uv = gl_PointCoord;
  float circle = linearCircle(uv);
  float halo = u_sparkleIntensity * clamp(invLerp(0.5, 10.0, circle), 0.0, 1.0);
  float light = smoothstep(0.8, 0.9, circle);
  float alpha = light + halo;
  vec3 color = mix(u_c1, u_c2, smoothstep(0.8, 1.0, circle));
  gl_FragColor = vec4(color, alpha);
}
`;

const streaksVertex = `
precision highp float;

attribute vec3 position;
attribute vec2 uv;

uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat4 modelMatrix;

varying vec2 v_uv;

void main() {

    vec3 cameraRight = vec3(
        viewMatrix[0][0],
        viewMatrix[1][0],
        viewMatrix[2][0]
    );

    vec3 cameraUp = vec3(
        viewMatrix[0][1],
        viewMatrix[1][1],
        viewMatrix[2][1]
    );

    vec3 center =
        (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;

    vec3 billboardPos =
        center +
        cameraRight * position.x +
        cameraUp * position.y;

    gl_Position =
        projectionMatrix *
        viewMatrix *
        vec4(billboardPos, 1.0);

    v_uv = uv;
}
`;

const streaksFragment = `
precision highp float;
uniform float u_streaksRadius;
uniform float u_streaksCircleSmooth;
uniform float u_streaksNoiseOffset;
uniform float u_streaksNoiseX;
uniform float u_streaksNoiseY;
uniform float u_streaksMin;
uniform float u_streaksSmooth;
uniform float u_streaksAlpha;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
varying vec2 v_uv;

float invLerp(float a, float b, float v) { return (v - a) / (b - a); }
float random(vec2 seed) { return fract(sin(dot(seed, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  float center = clamp(v_uv.y - u_streaksRadius + 1.0, 0.0, 1.0);
  center = 1.0 - center;
  center = invLerp(0.0, u_streaksCircleSmooth, center);
  float side = v_uv.x * (1.0 - v_uv.x) * 4.0;
  side = clamp(invLerp(0.0, 0.15, side), 0.0, 1.0);
  float noiseVal = random(vec2(v_uv.x * u_streaksNoiseX, v_uv.y * u_streaksNoiseY + u_streaksNoiseOffset));
  float factor = center * side * noiseVal;
  factor = invLerp(u_streaksMin, u_streaksMin + u_streaksSmooth, factor);
  vec3 color = mix(u_c1, u_c2, noiseVal);
  color = mix(color, u_c3, smoothstep(0.7, 0.9, noiseVal));
  gl_FragColor = vec4(color, factor * u_streaksAlpha);
}
`;

const dustVertex = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat4 modelMatrix;
uniform float u_dustRadius;
varying vec2 v_uv;

void main() {
  vec3 pos = position;
  pos.xz *= u_dustRadius;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(pos, 1.0);
  v_uv = uv;
}
`;

const dustFragment = `
precision highp float;
uniform float u_time;
uniform float u_dustNoiseScale;
uniform float u_dustNoiseSpeed;
uniform float u_dustTransparency;
uniform float u_dustTransparencySmoothness;
uniform vec3 u_c1;
varying vec2 v_uv;

float random(vec2 seed) { return fract(sin(dot(seed, vec2(12.9898, 78.233))) * 43758.5453); }
float invLerp(float a, float b, float v) { return (v - a) / (b - a); }

void main() {
  vec2 uv = v_uv;
  uv.x = abs(uv.x - 0.5) * 2.0;
  float yGrad = 1.0 - abs(uv.y - 0.5) * 2.0;
  float noise = random(uv * u_dustNoiseScale + u_time * u_dustNoiseSpeed);
  noise = invLerp(-1.5, 0.4, noise);
  float alpha = invLerp(u_dustTransparency, u_dustTransparency + u_dustTransparencySmoothness, noise) * yGrad;
  gl_FragColor = vec4(u_c1, alpha);
}
`;

// Main explosion creation - OPTIMIZED VERSION
export function createExplosion(scene) {
  // Use smaller base geometries
  const u_time = { value: 0 };
  const fireSmokeGeo = new THREE.PlaneGeometry(2, 2);
  const fireSmokeMat = new THREE.RawShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,

    vertexShader: fireSmokeVertex,
    fragmentShader: fireSmokeFragment,
    uniforms: {
      u_time: u_time,
      u_noiseSpeed: { value: 1 },
      u_smokeScale: { value: 1.0 },
      u_height: { value: 0 },
      u_noiseScale: { value: 3 },
      u_circleLimit: { value: 0.7 },
      u_circleSmoothness: { value: 0.3 },
      u_intensity: { value: 0.5 },
      u_intensitySmoothness: { value: 0.4 },
      u_transparency: { value: 0.2 },
      u_transparencySmoothness: { value: 0.15 },
      u_c1: { value: new THREE.Color(0x220000) },
      u_c2: { value: new THREE.Color(0xff2200) },
      u_c3: { value: new THREE.Color(0xff6600) },
      u_c4: { value: new THREE.Color(0xffcc44) },
    },
  });

  // Reduce sparkles count
  const sparklesGeo = new RandomSparkles(30); // Was 200, now 30
  const sparklesMat = new THREE.RawShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    vertexShader: sparklesVertex,
    fragmentShader: sparklesFragment,
    uniforms: {
      u_sparkleHeight: { value: 0 },
      u_sparkleScale: { value: 1.0 },
      u_sparkleRadius: { value: 20 },
      u_sparkleIntensity: { value: 8 },
      u_c1: { value: new THREE.Color(0xffaa44) },
      u_c2: { value: new THREE.Color(0xffffaa) },
    },
  });

  const streaksPlaneGeo = new THREE.PlaneGeometry(3, 3);
  const streaksMat = new THREE.RawShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    vertexShader: streaksVertex,
    fragmentShader: streaksFragment,
    uniforms: {
      u_streaksRadius: { value: 1.5 },
      u_streaksCircleSmooth: { value: 0.4 },
      u_streaksNoiseOffset: { value: 6 },
      u_streaksNoiseX: { value: 15 },
      u_streaksNoiseY: { value: 1 },
      u_streaksMin: { value: 0.0 },
      u_streaksSmooth: { value: 2.0 },
      u_streaksAlpha: { value: 1 },
      u_c1: { value: new THREE.Color(0xff3300) },
      u_c2: { value: new THREE.Color(0xff8800) },
      u_c3: { value: new THREE.Color(0xffcc66) },
    },
  });

  const dustGeo = new THREE.CylinderGeometry(30, 30, 8, 24, 1, true); // Reduced segments from 32 to 24
  const dustMat = new THREE.RawShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.NormalBlending,
    vertexShader: dustVertex,
    fragmentShader: dustFragment,
    side: THREE.DoubleSide,
    uniforms: {
      u_time: u_time,
      u_dustRadius: { value: 2 },
      u_dustNoiseScale: { value: 2 },
      u_dustNoiseSpeed: { value: 1 },
      u_dustTransparency: { value: 0.6 },
      u_dustTransparencySmoothness: { value: 0.7 },
      u_c1: { value: new THREE.Color(0x332200) },
    },
  });

  const light = new THREE.PointLight(0xff8844);
  light.position.set(0, 0.5, 0);
  light.intensity = 0;
  light.distance = 200;

  const fireSmoke = new THREE.Mesh(fireSmokeGeo, fireSmokeMat);
  const sparkles = new THREE.Points(sparklesGeo, sparklesMat);
  const streaks = new THREE.Mesh(streaksPlaneGeo, streaksMat);
  const dust = new THREE.Mesh(dustGeo, dustMat);

  fireSmoke.renderOrder = 2;
  sparkles.renderOrder = 3;
  streaks.renderOrder = 1;

  // Simplified timeline with fewer keyframes
  const timeline = new Timeline([
    {
      target: light,
      key: "intensity",
      initialValue: 0,
      keyframes: [
        { duration: 50, value: 4, easing: Easing.easeInExpo },
        { duration: 500, value: 0, easing: Easing.easeOutQuad },
      ],
    },
    {
      target: fireSmokeMat.uniforms.u_circleLimit,
      key: "value",
      initialValue: 1.0,
      keyframes: [{ duration: 10, value: 0.7, easing: Easing.easeOutExpo }],
    },
    {
      target: fireSmokeMat.uniforms.u_smokeScale,
      key: "value",
      initialValue: 0.1,
      keyframes: [
        { duration: 1000, value: 25, easing: Easing.easeOutExpo }, // scaled x10
      ],
    },
    {
      target: fireSmokeMat.uniforms.u_circleSmoothness,
      key: "value",
      initialValue: 0.15,
      keyframes: [
        { delay: 50, duration: 2000, value: 0.85, easing: Easing.easeOutExpo },
      ],
    },
    {
      target: fireSmokeMat.uniforms.u_height,
      key: "value",
      initialValue: 0,
      keyframes: [
        { duration: 350, value: 8, easing: Easing.easeOutQuad },
        { duration: 2200, value: 20, easing: Easing.easeInQuad },
      ],
    },
    {
      target: fireSmokeMat.uniforms.u_transparencySmoothness,
      key: "value",
      initialValue: 0.1,
      keyframes: [
        { delay: 300, duration: 1800, value: 1.2, easing: Easing.easeInQuad },
      ],
    },
    {
      target: sparklesMat.uniforms.u_sparkleScale,
      key: "value",
      initialValue: 0,
      keyframes: [
        { duration: 50, value: 4, easing: Easing.linear }, // scaled x10
        { delay: 500, duration: 1500, value: 0, easing: Easing.linear },
      ],
    },
    {
      target: sparklesMat.uniforms.u_sparkleHeight,
      key: "value",
      initialValue: 0,
      keyframes: [
        { delay: 0, duration: 500, value: 20, easing: Easing.easeOutQuad }, // scaled x10
        { duration: 1500, value: 11, easing: Easing.easeInQuad }, // scaled x10
      ],
    },
    {
      target: sparklesMat.uniforms.u_sparkleRadius,
      key: "value",
      initialValue: 0,
      keyframes: [
        { delay: 0, duration: 1500, value: 35, easing: Easing.easeOutExpo }, // scaled x10
      ],
    },
    {
      target: streaks.scale,
      key: "y",
      initialValue: 0,
      keyframes: [
        { duration: 10, value: 1, easing: Easing.linear },
        { delay: 300, duration: 10, value: 0, easing: Easing.linear },
      ],
    },
    {
      target: streaksMat.uniforms.u_streaksRadius,
      key: "value",
      initialValue: 0,
      keyframes: [
        { delay: 50, duration: 200, value: 1, easing: Easing.easeOutExpo },
      ],
    },
    {
      target: streaksMat.uniforms.u_streaksAlpha,
      key: "value",
      initialValue: 1,
      keyframes: [
        { delay: 100, duration: 150, value: 0, easing: Easing.easeOutQuad },
      ],
    },
    {
      target: streaksMat.uniforms.u_streaksNoiseOffset,
      key: "value",
      initialValue: 6,
      keyframes: [
        { delay: 50, duration: 400, value: 7.5, easing: Easing.easeOutQuad },
      ],
    },
    {
      target: dustMat.uniforms.u_dustRadius,
      key: "value",
      initialValue: 0,
      keyframes: [
        { delay: 50, duration: 450, value: 40, easing: Easing.easeOutExpo },
      ],
    },
    {
      target: dustMat.uniforms.u_dustTransparency,
      key: "value",
      initialValue: 1,
      keyframes: [
        { duration: 40, value: 0.15, easing: Easing.linear },
        { duration: 350, value: 1.4, easing: Easing.easeOutQuad },
      ],
    },
  ]);

  return { light, fireSmoke, sparkles, streaks, dust, timeline };
}

// export function updateExplosionTime(explosion, deltaTime) {
//   if (!explosion) return;
//   if (explosion.fireSmoke?.material?.uniforms?.u_time) {
//     explosion.fireSmoke.material.uniforms.u_time.value += deltaTime;
//   }
//   if (explosion.dust?.material?.uniforms?.u_time) {
//     explosion.dust.material.uniforms.u_time.value += deltaTime;
//   }
// }

export function updateExplosionTime(explosion, deltaTime) {
  if (!explosion) return;
  // fireSmoke and dust share the same u_time object — only update once
  if (explosion.fireSmoke?.material?.uniforms?.u_time) {
    explosion.fireSmoke.material.uniforms.u_time.value += deltaTime;
  }
  // dust shares the reference, no need to update separately
}
