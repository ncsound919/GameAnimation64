/**
 * ParticleSystem.ts
 * GPU-accelerated particle & VFX system for Pyrite64's vibe coding engine.
 *
 * Uses Three.js Points / InstancedMesh for efficient GPU-side rendering.
 * Provides:
 *  - Configurable emitters (rate, lifetime, shape)
 *  - Per-particle forces (gravity, wind, turbulence)
 *  - Preset library for common effects (fire, magic, sparks, smoke, etc.)
 *  - Color / size curves over lifetime
 *
 * Design file reference: Component #4 — Particle & VFX System
 */

import * as THREE from 'three';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EmitterShape = 'point' | 'sphere' | 'box' | 'cone' | 'ring';
export type BlendMode = 'additive' | 'normal' | 'multiply';

/** A single stop on a gradient (0–1 normalized lifetime). */
export interface GradientStop {
  t:     number;
  value: [number, number, number, number]; // RGBA
}

/** Size key over lifetime. */
export interface SizeKey {
  t:    number;
  size: number;
}

/** Configuration for a particle emitter. */
export interface ParticleEmitterConfig {
  /** Maximum number of alive particles. */
  maxParticles:   number;
  /** Particles spawned per second. */
  emissionRate:   number;
  /** Particle lifetime in seconds [min, max]. */
  lifetime:       [number, number];
  /** Initial speed [min, max]. */
  speed:          [number, number];
  /** Emitter shape and size. */
  shape:          EmitterShape;
  shapeSize:      [number, number, number];
  /** Spread angle in degrees (for cone / point). */
  spread:         number;
  /** World-space gravity applied to particles. */
  gravity:        [number, number, number];
  /** Color gradient over lifetime. */
  colorOverLife:  GradientStop[];
  /** Size curve over lifetime. */
  sizeOverLife:   SizeKey[];
  /** Blend mode for rendering. */
  blendMode:      BlendMode;
  /** Texture path (optional — defaults to soft circle). */
  textureUrl?:    string;
  /** Whether particles face the camera (billboard). */
  billboard:      boolean;
  /** World space (true) or local to emitter (false). */
  worldSpace:     boolean;
  /** Wind force vector. */
  wind:           [number, number, number];
  /** Turbulence strength (0 = none). */
  turbulence:     number;
  /** Sort particles back-to-front for transparency (costly). */
  depthSort:      boolean;
}

// ─── Internal Particle State ─────────────────────────────────────────────────

interface Particle {
  alive:     boolean;
  age:       number;
  lifetime:  number;
  position:  THREE.Vector3;
  velocity:  THREE.Vector3;
  size:      number;
  color:     THREE.Color;
  alpha:     number;
}

// ─── Particle Emitter ────────────────────────────────────────────────────────

export class ParticleEmitter {
  readonly config: ParticleEmitterConfig;
  private particles: Particle[];
  private pool:      number[];   // indices of dead particles
  private emitAccum: number = 0;
  private mesh:      THREE.Points;
  private geometry:  THREE.BufferGeometry;
  private material:  THREE.PointsMaterial;

  /** The Three.js object to add to the scene. */
  get object3D(): THREE.Object3D { return this.mesh; }

  /** Whether the emitter is actively spawning. */
  playing = true;

  constructor(config: Partial<ParticleEmitterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    const max = this.config.maxParticles;

    // Pre-allocate particle pool
    this.particles = [];
    this.pool = [];
    for (let i = 0; i < max; i++) {
      this.particles.push({
        alive: false, age: 0, lifetime: 1,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        size: 1, color: new THREE.Color(1, 1, 1), alpha: 1,
      });
      this.pool.push(i);
    }

    // Geometry — positions + sizes + colors stored in buffers
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position',
      new THREE.Float32BufferAttribute(new Float32Array(max * 3), 3));
    this.geometry.setAttribute('aSize',
      new THREE.Float32BufferAttribute(new Float32Array(max), 1));
    this.geometry.setAttribute('color',
      new THREE.Float32BufferAttribute(new Float32Array(max * 3), 3));
    this.geometry.setDrawRange(0, 0);

    // Material
    this.material = new THREE.PointsMaterial({
      size:              1,
      sizeAttenuation:   true,
      vertexColors:      true,
      transparent:       true,
      depthWrite:        false,
      blending:          this.blendModeToThree(this.config.blendMode),
    });

    // Make the `aSize` per-particle attribute affect the rendered point size.
    // We inject the attribute into the vertex shader and multiply it into gl_PointSize.
    this.material.onBeforeCompile = (shader) => {
      // Declare the aSize attribute in the vertex shader.
      shader.vertexShader = shader.vertexShader.replace(
        'void main() {',
        'attribute float aSize;\nvoid main() {'
      );

      // Apply aSize to the computed point size. We handle both the sizeAttenuation
      // and non-attenuated variants used by PointsMaterial across Three.js versions.
      shader.vertexShader = shader.vertexShader
        .replace(
          'gl_PointSize = size * ( scale / - mvPosition.z );',
          'gl_PointSize = size * aSize * ( scale / - mvPosition.z );'
        )
        .replace(
          'gl_PointSize = size;',
          'gl_PointSize = size * aSize;'
        );
    };

    if (this.config.textureUrl) {
      const loader = new THREE.TextureLoader();
      loader.load(this.config.textureUrl, (tex) => {
        this.material.map = tex;
        this.material.needsUpdate = true;
      });
    }

    this.mesh = new THREE.Points(this.geometry, this.material);
    this.mesh.frustumCulled = false;
  }

  /** Advance the simulation by dt seconds. */
  update(dt: number): void {
    // Emit new particles
    if (this.playing) {
      this.emitAccum += this.config.emissionRate * dt;
      while (this.emitAccum >= 1 && this.pool.length > 0) {
        this.emitAccum -= 1;
        this.spawn();
      }
    }

    // Update existing particles
    const grav = new THREE.Vector3(...this.config.gravity);
    const wind = new THREE.Vector3(...this.config.wind);
    let aliveCount = 0;

    const positions = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const sizes     = this.geometry.getAttribute('aSize') as THREE.BufferAttribute;
    const colors    = this.geometry.getAttribute('color') as THREE.BufferAttribute;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.alive) continue;

      p.age += dt;
      if (p.age >= p.lifetime) {
        p.alive = false;
        this.pool.push(i);
        continue;
      }

      // Physics
      p.velocity.addScaledVector(grav, dt);
      p.velocity.addScaledVector(wind, dt);

      // Turbulence (simple noise approximation)
      if (this.config.turbulence > 0) {
        const t = this.config.turbulence * dt;
        p.velocity.x += (Math.random() - 0.5) * t;
        p.velocity.y += (Math.random() - 0.5) * t;
        p.velocity.z += (Math.random() - 0.5) * t;
      }

      p.position.addScaledVector(p.velocity, dt);

      // Evaluate curves
      const lifeT = p.age / p.lifetime;
      const col = sampleGradient(this.config.colorOverLife, lifeT);
      p.color.setRGB(col[0], col[1], col[2]);
      p.alpha = col[3];
      p.size = sampleSizeCurve(this.config.sizeOverLife, lifeT);

      // Write to buffers
      positions.setXYZ(aliveCount, p.position.x, p.position.y, p.position.z);
      sizes.setX(aliveCount, p.size);
      colors.setXYZ(aliveCount, p.color.r, p.color.g, p.color.b);
      aliveCount++;
    }

    this.geometry.setDrawRange(0, aliveCount);
    positions.needsUpdate = true;
    sizes.needsUpdate     = true;
    colors.needsUpdate    = true;
  }

  /** Immediately emit a burst of particles. */
  burst(count: number): void {
    for (let i = 0; i < count && this.pool.length > 0; i++) {
      this.spawn();
    }
  }

  /** Stop emitting (existing particles finish their life). */
  stop(): void { this.playing = false; }

  /** Resume emitting. */
  play(): void { this.playing = true; }

  /** Kill all particles immediately. */
  clear(): void {
    for (let i = 0; i < this.particles.length; i++) {
      if (this.particles[i].alive) {
        this.particles[i].alive = false;
        this.pool.push(i);
      }
    }
    this.geometry.setDrawRange(0, 0);
  }

  /** Dispose GPU resources. */
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }

  // ─── Private ────────────────────────────────────────────────────────────

  private spawn(): void {
    const idx = this.pool.pop()!;
    const p = this.particles[idx];
    p.alive = true;
    p.age = 0;
    p.lifetime = lerp(this.config.lifetime[0], this.config.lifetime[1], Math.random());

    // Position from shape
    this.sampleShape(p.position);

    // Velocity — outward from center with spread
    const speed = lerp(this.config.speed[0], this.config.speed[1], Math.random());
    p.velocity.set(
      (Math.random() - 0.5) * this.config.spread,
      1,
      (Math.random() - 0.5) * this.config.spread,
    ).normalize().multiplyScalar(speed);

    p.size = 1;
    p.color.setRGB(1, 1, 1);
    p.alpha = 1;
  }

  private sampleShape(out: THREE.Vector3): void {
    const s = this.config.shapeSize;
    switch (this.config.shape) {
      case 'point':
        out.set(0, 0, 0);
        break;
      case 'sphere': {
        const u = Math.random() * Math.PI * 2;
        const v = Math.acos(2 * Math.random() - 1);
        const r = Math.cbrt(Math.random()) * s[0];
        out.set(r * Math.sin(v) * Math.cos(u), r * Math.sin(v) * Math.sin(u), r * Math.cos(v));
        break;
      }
      case 'box':
        out.set(
          (Math.random() - 0.5) * s[0],
          (Math.random() - 0.5) * s[1],
          (Math.random() - 0.5) * s[2],
        );
        break;
      case 'cone': {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * s[0];
        out.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
        break;
      }
      case 'ring': {
        const a = Math.random() * Math.PI * 2;
        out.set(Math.cos(a) * s[0], 0, Math.sin(a) * s[0]);
        break;
      }
    }
  }

  private blendModeToThree(mode: BlendMode): THREE.Blending {
    switch (mode) {
      case 'additive': return THREE.AdditiveBlending;
      case 'multiply': return THREE.MultiplyBlending;
      default:         return THREE.NormalBlending;
    }
  }
}

// ─── Curve Helpers ───────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function sampleGradient(stops: GradientStop[], t: number): [number, number, number, number] {
  if (stops.length === 0) return [1, 1, 1, 1];
  if (stops.length === 1) return [...stops[0].value];
  if (t <= stops[0].t) return [...stops[0].value];
  if (t >= stops[stops.length - 1].t) return [...stops[stops.length - 1].value];

  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].t && t <= stops[i + 1].t) {
      const f = (t - stops[i].t) / (stops[i + 1].t - stops[i].t);
      return [
        lerp(stops[i].value[0], stops[i + 1].value[0], f),
        lerp(stops[i].value[1], stops[i + 1].value[1], f),
        lerp(stops[i].value[2], stops[i + 1].value[2], f),
        lerp(stops[i].value[3], stops[i + 1].value[3], f),
      ];
    }
  }
  return [1, 1, 1, 1];
}

function sampleSizeCurve(keys: SizeKey[], t: number): number {
  if (keys.length === 0) return 1;
  if (keys.length === 1) return keys[0].size;
  if (t <= keys[0].t) return keys[0].size;
  if (t >= keys[keys.length - 1].t) return keys[keys.length - 1].size;

  for (let i = 0; i < keys.length - 1; i++) {
    if (t >= keys[i].t && t <= keys[i + 1].t) {
      const f = (t - keys[i].t) / (keys[i + 1].t - keys[i].t);
      return lerp(keys[i].size, keys[i + 1].size, f);
    }
  }
  return 1;
}

// ─── Default Config ──────────────────────────────────────────────────────────

const DEFAULT_CONFIG: ParticleEmitterConfig = {
  maxParticles:  500,
  emissionRate:  50,
  lifetime:      [0.5, 2.0],
  speed:         [1, 3],
  shape:         'point',
  shapeSize:     [1, 1, 1],
  spread:        0.5,
  gravity:       [0, -9.8, 0],
  colorOverLife: [
    { t: 0,   value: [1, 1, 1, 1] },
    { t: 1,   value: [1, 1, 1, 0] },
  ],
  sizeOverLife:  [
    { t: 0, size: 1 },
    { t: 1, size: 0 },
  ],
  blendMode:     'additive',
  billboard:     true,
  worldSpace:    true,
  wind:          [0, 0, 0],
  turbulence:    0,
  depthSort:     false,
};

// ─── Preset Library ──────────────────────────────────────────────────────────

export const PARTICLE_PRESETS: Record<string, Partial<ParticleEmitterConfig>> = {

  fire: {
    maxParticles: 300,
    emissionRate: 80,
    lifetime:     [0.3, 1.2],
    speed:        [1.5, 4],
    shape:        'cone',
    shapeSize:    [0.3, 0, 0],
    spread:       0.3,
    gravity:      [0, 2, 0],
    colorOverLife: [
      { t: 0,    value: [1.0, 0.9, 0.2, 1.0] },
      { t: 0.3,  value: [1.0, 0.5, 0.0, 0.9] },
      { t: 0.7,  value: [0.8, 0.1, 0.0, 0.5] },
      { t: 1.0,  value: [0.2, 0.0, 0.0, 0.0] },
    ],
    sizeOverLife: [
      { t: 0,   size: 0.5 },
      { t: 0.3, size: 1.2 },
      { t: 1,   size: 0.0 },
    ],
    blendMode: 'additive',
    turbulence: 3,
  },

  smoke: {
    maxParticles: 200,
    emissionRate: 30,
    lifetime:     [1.5, 4.0],
    speed:        [0.5, 1.5],
    shape:        'sphere',
    shapeSize:    [0.5, 0.5, 0.5],
    spread:       0.6,
    gravity:      [0, 0.5, 0],
    colorOverLife: [
      { t: 0,   value: [0.4, 0.4, 0.4, 0.3] },
      { t: 0.5, value: [0.6, 0.6, 0.6, 0.2] },
      { t: 1.0, value: [0.8, 0.8, 0.8, 0.0] },
    ],
    sizeOverLife: [
      { t: 0,   size: 0.3 },
      { t: 0.5, size: 1.5 },
      { t: 1,   size: 3.0 },
    ],
    blendMode: 'normal',
    turbulence: 1,
  },

  magic: {
    maxParticles: 400,
    emissionRate: 100,
    lifetime:     [0.5, 1.5],
    speed:        [2, 5],
    shape:        'sphere',
    shapeSize:    [0.2, 0.2, 0.2],
    spread:       1.0,
    gravity:      [0, 0, 0],
    colorOverLife: [
      { t: 0,   value: [0.3, 0.5, 1.0, 1.0] },
      { t: 0.5, value: [0.8, 0.3, 1.0, 0.8] },
      { t: 1.0, value: [1.0, 0.8, 1.0, 0.0] },
    ],
    sizeOverLife: [
      { t: 0,   size: 0.8 },
      { t: 0.5, size: 0.4 },
      { t: 1,   size: 0.0 },
    ],
    blendMode: 'additive',
    turbulence: 5,
  },

  sparks: {
    maxParticles: 150,
    emissionRate: 0,  // burst-only
    lifetime:     [0.2, 0.8],
    speed:        [5, 12],
    shape:        'point',
    shapeSize:    [0, 0, 0],
    spread:       1.0,
    gravity:      [0, -15, 0],
    colorOverLife: [
      { t: 0,   value: [1.0, 0.9, 0.4, 1.0] },
      { t: 0.5, value: [1.0, 0.6, 0.1, 0.8] },
      { t: 1.0, value: [0.5, 0.1, 0.0, 0.0] },
    ],
    sizeOverLife: [
      { t: 0,   size: 0.3 },
      { t: 1,   size: 0.05 },
    ],
    blendMode: 'additive',
  },

  rain: {
    maxParticles: 1000,
    emissionRate: 300,
    lifetime:     [0.5, 1.0],
    speed:        [10, 15],
    shape:        'box',
    shapeSize:    [20, 0, 20],
    spread:       0.05,
    gravity:      [0, -20, 0],
    colorOverLife: [
      { t: 0,   value: [0.7, 0.8, 1.0, 0.6] },
      { t: 1.0, value: [0.7, 0.8, 1.0, 0.0] },
    ],
    sizeOverLife: [
      { t: 0, size: 0.1 },
      { t: 1, size: 0.1 },
    ],
    blendMode: 'normal',
  },

  snow: {
    maxParticles: 500,
    emissionRate: 80,
    lifetime:     [3, 6],
    speed:        [0.3, 1.0],
    shape:        'box',
    shapeSize:    [15, 0, 15],
    spread:       0.8,
    gravity:      [0, -1, 0],
    colorOverLife: [
      { t: 0,   value: [1.0, 1.0, 1.0, 0.9] },
      { t: 1.0, value: [1.0, 1.0, 1.0, 0.0] },
    ],
    sizeOverLife: [
      { t: 0, size: 0.2 },
      { t: 1, size: 0.15 },
    ],
    blendMode: 'normal',
    turbulence: 2,
    wind: [0.5, 0, 0.2],
  },

  glitch: {
    maxParticles: 200,
    emissionRate: 60,
    lifetime:     [0.05, 0.3],
    speed:        [3, 8],
    shape:        'box',
    shapeSize:    [1, 1, 1],
    spread:       1.0,
    gravity:      [0, 0, 0],
    colorOverLife: [
      { t: 0,   value: [0.0, 1.0, 0.5, 1.0] },
      { t: 0.5, value: [1.0, 0.0, 1.0, 0.8] },
      { t: 1.0, value: [0.0, 0.5, 1.0, 0.0] },
    ],
    sizeOverLife: [
      { t: 0, size: 0.5 },
      { t: 1, size: 0.5 },
    ],
    blendMode: 'additive',
    turbulence: 10,
  },

  dust: {
    maxParticles: 100,
    emissionRate: 15,
    lifetime:     [2, 5],
    speed:        [0.1, 0.4],
    shape:        'box',
    shapeSize:    [5, 2, 5],
    spread:       1.0,
    gravity:      [0, 0.05, 0],
    colorOverLife: [
      { t: 0,   value: [0.8, 0.7, 0.5, 0.0] },
      { t: 0.2, value: [0.8, 0.7, 0.5, 0.3] },
      { t: 0.8, value: [0.8, 0.7, 0.5, 0.3] },
      { t: 1.0, value: [0.8, 0.7, 0.5, 0.0] },
    ],
    sizeOverLife: [
      { t: 0, size: 0.3 },
      { t: 1, size: 0.6 },
    ],
    blendMode: 'normal',
    turbulence: 0.5,
  },
};

// ─── Factory ─────────────────────────────────────────────────────────────────

/** Create a particle emitter from a preset name. */
export function createEmitterFromPreset(presetName: string): ParticleEmitter | null {
  const preset = PARTICLE_PRESETS[presetName];
  if (!preset) return null;
  return new ParticleEmitter(preset);
}
