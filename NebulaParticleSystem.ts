/**
 * NebulaParticleSystem.ts
 * Particle system wrapper using three-nebula for Pyrite64's game engine.
 *
 * Replaces the custom ParticleSystem.ts with the feature-rich
 * three-nebula library for GPU-accelerated particle effects.
 *
 * Benefits over custom implementation:
 *  - More emitter shapes and behaviors
 *  - Advanced particle behaviors (attractors, repulsors, etc.)
 *  - Better performance optimization
 *  - Rich preset library
 *  - Active community and updates
 *
 * Design file reference: Component #4 — Particle & VFX System
 */

import * as THREE from 'three';
import {
  System as NebulaSystem,
  Emitter,
  Rate,
  Span,
  Position,
  Mass,
  Radius,
  Life,
  Body,
  Vector3D,
  PointZone,
  SphereZone,
  BoxZone,
  Velocity,
  RandomDrift,
  Gravity,
  Color,
  Scale,
  Alpha,
  SpriteRenderer,
} from 'three-nebula';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EmitterShape = 'point' | 'sphere' | 'box' | 'cone' | 'ring';
export type BlendMode = 'additive' | 'normal' | 'multiply';

export interface ParticleEmitterConfig {
  maxParticles: number;
  emissionRate: number;
  lifetime: [number, number];
  speed: [number, number];
  shape: EmitterShape;
  shapeSize: [number, number, number];
  spread: number;
  gravity: [number, number, number];
  colorOverLife: Array<{ t: number; value: [number, number, number, number] }>;
  sizeOverLife: Array<{ t: number; size: number }>;
  blendMode: BlendMode;
  textureUrl?: string;
  billboard: boolean;
  worldSpace: boolean;
  wind: [number, number, number];
  turbulence: number;
  depthSort: boolean;
}

// ─── Nebula Particle System ──────────────────────────────────────────────────

export class NebulaParticleSystem {
  private system: NebulaSystem;
  private renderer: SpriteRenderer;
  private emitters: Map<string, Emitter> = new Map();
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    this.scene = scene;
    this.system = new NebulaSystem();
    this.renderer = new SpriteRenderer(scene, THREE);
    this.system.addRenderer(this.renderer);
  }

  /**
   * Create a particle emitter from configuration.
   */
  createEmitter(id: string, config: Partial<ParticleEmitterConfig> = {}): Emitter {
    const cfg: ParticleEmitterConfig = {
      maxParticles: 500,
      emissionRate: 50,
      lifetime: [0.5, 2.0],
      speed: [1, 3],
      shape: 'point',
      shapeSize: [1, 1, 1],
      spread: 0.5,
      gravity: [0, -9.8, 0],
      colorOverLife: [
        { t: 0, value: [1, 1, 1, 1] },
        { t: 1, value: [1, 1, 1, 0] },
      ],
      sizeOverLife: [
        { t: 0, size: 1 },
        { t: 1, size: 0 },
      ],
      blendMode: 'additive',
      billboard: true,
      worldSpace: true,
      wind: [0, 0, 0],
      turbulence: 0,
      depthSort: false,
      ...config,
    };

    const emitter = new Emitter();

    // Respect particle cap from config/preset.
    if (typeof (emitter as any).setMaxParticles === 'function') {
      (emitter as any).setMaxParticles(cfg.maxParticles);
    } else {
      (emitter as any).maxParticles = cfg.maxParticles;
    }

    // Set emission rate
    emitter.setRate(new Rate(new Span(cfg.emissionRate, cfg.emissionRate), new Span(0.1, 0.2)));

    // Set position zone based on shape
    const zone = this.createZone(cfg.shape, cfg.shapeSize);
    emitter.setPosition(new Position(zone));

    // Set particle lifetime
    emitter.addInitializer(new Life(cfg.lifetime[0], cfg.lifetime[1]));

    // Set particle mass (for physics)
    emitter.addInitializer(new Mass(1));

    // Set initial size
    emitter.addInitializer(new Radius(cfg.sizeOverLife[0].size));

    // Create particle body (sprite)
    const material = new THREE.SpriteMaterial({
      color: 0xffffff,
      blending: this.getBlendMode(cfg.blendMode),
      transparent: true,
      depthWrite: false,
    });

    if (cfg.textureUrl) {
      const loader = new THREE.TextureLoader();
      loader.load(cfg.textureUrl, (texture) => {
        material.map = texture;
        material.needsUpdate = true;
      });
    }

    emitter.addInitializer(new Body(new THREE.Sprite(material)));

    // Set initial velocity
    emitter.addInitializer(
      new Velocity(
        new Vector3D(0, cfg.speed[0], 0),
        new Vector3D(cfg.spread, cfg.speed[1], cfg.spread),
        'vector'
      )
    );

    // Add gravity behavior
    if (cfg.gravity[0] !== 0 || cfg.gravity[1] !== 0 || cfg.gravity[2] !== 0) {
      emitter.addBehaviour(
        new Gravity(cfg.gravity[0], cfg.gravity[1], cfg.gravity[2])
      );
    }

    // Add turbulence (random drift)
    if (cfg.turbulence > 0) {
      emitter.addBehaviour(new RandomDrift(cfg.turbulence, cfg.turbulence, cfg.turbulence, 0.05));
    }

    // Add color gradient
    if (cfg.colorOverLife.length > 1) {
      const colors = cfg.colorOverLife.map(stop =>
        new THREE.Color(stop.value[0], stop.value[1], stop.value[2])
      );
      emitter.addBehaviour(new Color(...colors));
    }

    // Add size curve
    if (cfg.sizeOverLife.length > 1) {
      const sizes = cfg.sizeOverLife.map(stop => stop.size);
      emitter.addBehaviour(new Scale(...sizes));
    }

    // Add alpha fade
    const alphaStops = cfg.colorOverLife.map(stop => stop.value[3]);
    if (alphaStops.length > 1) {
      emitter.addBehaviour(new Alpha(...alphaStops));
    }

    // Set total particles
    emitter.setTotalEmitTimes(Infinity);

    // Store and add to system
    this.emitters.set(id, emitter);
    this.system.addEmitter(emitter);

    return emitter;
  }

  /**
   * Create emitter from preset name.
   */
  createFromPreset(id: string, presetName: string): Emitter | null {
    const preset = NEBULA_PRESETS[presetName];
    if (!preset) return null;
    return this.createEmitter(id, preset);
  }

  /**
   * Get an emitter by ID.
   */
  getEmitter(id: string): Emitter | undefined {
    return this.emitters.get(id);
  }

  /**
   * Remove an emitter.
   */
  removeEmitter(id: string): void {
    const emitter = this.emitters.get(id);
    if (emitter) {
      this.system.removeEmitter(emitter);
      emitter.destroy();
      this.emitters.delete(id);
    }
  }

  /**
   * Update the particle system (call in render loop).
   */
  update(dt: number): void {
    this.system.update(dt);
  }

  /**
   * Stop all emitters.
   */
  stopAll(): void {
    for (const emitter of this.emitters.values()) {
      emitter.stopEmit();
    }
  }

  /**
   * Start all emitters.
   */
  startAll(): void {
    for (const emitter of this.emitters.values()) {
      emitter.emit();
    }
  }

  /**
   * Dispose all resources.
   */
  dispose(): void {
    for (const emitter of this.emitters.values()) {
      emitter.destroy();
    }
    this.emitters.clear();
    this.system.destroy();
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  private createZone(shape: EmitterShape, size: [number, number, number]) {
    switch (shape) {
      case 'point':
        return new PointZone();
      case 'sphere':
        return new SphereZone(0, 0, 0, size[0]);
      case 'box':
        return new BoxZone(size[0], size[1], size[2]);
      case 'cone':
      case 'ring':
        throw new Error(`Unsupported emitter shape: ${shape}`);
      default:
        throw new Error(`Unknown emitter shape: ${shape}`);
    }
  }

  private getBlendMode(mode: BlendMode): THREE.Blending {
    switch (mode) {
      case 'additive':
        return THREE.AdditiveBlending;
      case 'multiply':
        return THREE.MultiplyBlending;
      default:
        return THREE.NormalBlending;
    }
  }
}

// ─── Preset Library ──────────────────────────────────────────────────────────

export const NEBULA_PRESETS: Record<string, Partial<ParticleEmitterConfig>> = {
  fire: {
    maxParticles: 300,
    emissionRate: 80,
    lifetime: [0.3, 1.2],
    speed: [1.5, 4],
    shape: 'sphere',
    shapeSize: [0.3, 0.3, 0.3],
    spread: 0.3,
    gravity: [0, 2, 0],
    colorOverLife: [
      { t: 0, value: [1.0, 0.9, 0.2, 1.0] },
      { t: 0.3, value: [1.0, 0.5, 0.0, 0.9] },
      { t: 0.7, value: [0.8, 0.1, 0.0, 0.5] },
      { t: 1.0, value: [0.2, 0.0, 0.0, 0.0] },
    ],
    sizeOverLife: [
      { t: 0, size: 0.5 },
      { t: 0.3, size: 1.2 },
      { t: 1, size: 0.0 },
    ],
    blendMode: 'additive',
    turbulence: 3,
  },

  smoke: {
    maxParticles: 200,
    emissionRate: 30,
    lifetime: [1.5, 4.0],
    speed: [0.5, 1.5],
    shape: 'sphere',
    shapeSize: [0.5, 0.5, 0.5],
    spread: 0.6,
    gravity: [0, 0.5, 0],
    colorOverLife: [
      { t: 0, value: [0.4, 0.4, 0.4, 0.3] },
      { t: 0.5, value: [0.6, 0.6, 0.6, 0.2] },
      { t: 1.0, value: [0.8, 0.8, 0.8, 0.0] },
    ],
    sizeOverLife: [
      { t: 0, size: 0.3 },
      { t: 0.5, size: 1.5 },
      { t: 1, size: 3.0 },
    ],
    blendMode: 'normal',
    turbulence: 1,
  },

  magic: {
    maxParticles: 400,
    emissionRate: 100,
    lifetime: [0.5, 1.5],
    speed: [2, 5],
    shape: 'sphere',
    shapeSize: [0.2, 0.2, 0.2],
    spread: 1.0,
    gravity: [0, 0, 0],
    colorOverLife: [
      { t: 0, value: [0.3, 0.5, 1.0, 1.0] },
      { t: 0.5, value: [0.8, 0.3, 1.0, 0.8] },
      { t: 1.0, value: [1.0, 0.8, 1.0, 0.0] },
    ],
    sizeOverLife: [
      { t: 0, size: 0.8 },
      { t: 0.5, size: 0.4 },
      { t: 1, size: 0.0 },
    ],
    blendMode: 'additive',
    turbulence: 5,
  },

  sparks: {
    maxParticles: 150,
    emissionRate: 0,
    lifetime: [0.2, 0.8],
    speed: [5, 12],
    shape: 'point',
    shapeSize: [0, 0, 0],
    spread: 1.0,
    gravity: [0, -15, 0],
    colorOverLife: [
      { t: 0, value: [1.0, 0.9, 0.4, 1.0] },
      { t: 0.5, value: [1.0, 0.6, 0.1, 0.8] },
      { t: 1.0, value: [0.5, 0.1, 0.0, 0.0] },
    ],
    sizeOverLife: [
      { t: 0, size: 0.3 },
      { t: 1, size: 0.05 },
    ],
    blendMode: 'additive',
  },
};
