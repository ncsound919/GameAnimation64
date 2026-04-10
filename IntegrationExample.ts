/**
 * IntegrationExample.ts
 * Example showing how to use all the new open-source component wrappers together.
 *
 * This demonstrates the integration of:
 *  - RapierPhysicsEngine (physics)
 *  - HowlerAudioEngine (audio)
 *  - BitECSWorld (entity component system)
 *  - NebulaParticleSystem (particles)
 *  - AnimationController (animations)
 *
 * Usage: Copy and adapt this code to your own game/application.
 */

import * as THREE from 'three';
import { RapierPhysicsWorld } from './RapierPhysicsEngine';
import { HowlerAudioEngine } from './HowlerAudioEngine';
import { BitECSWorld, Transform, Velocity, RigidBody, movingObjectsQuery } from './BitECSWrapper';
import { NebulaParticleSystem } from './NebulaParticleSystem';
import { AnimationController } from './ThreeAnimationWrapper';

// ─── Example Game Engine ──────────────────────────────────────────────────────

export class ExampleGameEngine {
  // Three.js
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;

  // New open-source components
  private physics!: RapierPhysicsWorld;
  private audio: HowlerAudioEngine;
  private ecs: BitECSWorld;
  private particles!: NebulaParticleSystem;

  // Entity-to-physics mapping
  private entityPhysicsMap: Map<number, number> = new Map();

  // Animation controllers per entity
  private animationControllers: Map<number, AnimationController> = new Map();

  // Timing
  private clock: THREE.Clock;
  private running = false;

  constructor(canvas: HTMLCanvasElement) {
    // Initialize Three.js
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 5, 10);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;

    // Initialize audio
    this.audio = new HowlerAudioEngine();

    // Initialize ECS
    this.ecs = new BitECSWorld();

    // Initialize clock
    this.clock = new THREE.Clock();

    // Set up scene
    this.setupScene();
  }

  async init(): Promise<void> {
    // Initialize physics (async because Rapier needs to load WASM)
    this.physics = new RapierPhysicsWorld({
      gravity: [0, -9.81, 0],
      fixedStep: 1 / 60,
    });
    await this.physics.init();

    // Initialize particle system
    this.particles = new NebulaParticleSystem(this.scene, this.camera);

    // Load audio assets
    this.loadAudioAssets();

    console.log('✅ Game engine initialized with open-source components');
  }

  private setupScene(): void {
    // Add lights
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);

    // Add ground plane
    const groundGeometry = new THREE.PlaneGeometry(50, 50);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x33aa33 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Create the static ground collider only after physics has been assigned.
    const createGroundColliderWhenReady = (): void => {
      if (!this.physics) {
        requestAnimationFrame(createGroundColliderWhenReady);
        return;
      }

      this.physics.createBody(
        [0, 0, 0],
        { mass: 0 }, // static
        { type: 'box', halfExtents: [25, 0.1, 25] }
      );
    };

    createGroundColliderWhenReady();
  }

  private loadAudioAssets(): void {
    // Register background music
    this.audio.registerClip({
      id: 'bgm',
      url: ['audio/background.mp3', 'audio/background.ogg'],
      volume: 0.5,
      loop: true,
      spatial: false,
      pool: 1,
    });

    // Register sound effects
    this.audio.registerClip({
      id: 'jump',
      url: ['audio/jump.mp3'],
      volume: 0.8,
      loop: false,
      spatial: false,
      pool: 3,
    });

    this.audio.registerClip({
      id: 'explosion',
      url: ['audio/explosion.mp3'],
      volume: 1.0,
      loop: false,
      spatial: true,
      pool: 5,
    });
  }

  // ─── Entity Creation Examples ───────────────────────────────────────────

  /**
   * Create a physics-enabled dynamic object (e.g., a ball).
   */
  createPhysicsBall(position: [number, number, number]): number {
    // Create ECS entity
    const entity = this.ecs.createEntity('PhysicsBall');
    this.ecs.addTransform(entity, position);
    this.ecs.addVelocity(entity, [0, 0, 0]);

    // Create Three.js mesh
    const geometry = new THREE.SphereGeometry(0.5, 32, 32);
    const material = new THREE.MeshStandardMaterial({ color: 0xff6600 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.castShadow = true;
    this.scene.add(mesh);

    // Create physics body
    const physicsHandle = this.physics.createBody(
      position,
      { mass: 1.0, friction: 0.5, restitution: 0.8 },
      { type: 'sphere', radius: 0.5 }
    );

    // Link entity to physics and mesh
    this.entityPhysicsMap.set(entity, physicsHandle);
    (mesh as any).entityId = entity;

    return entity;
  }

  /**
   * Create an animated character.
   */
  createCharacter(position: [number, number, number], model: THREE.Object3D): number {
    // Create ECS entity
    const entity = this.ecs.createEntity('Character');
    this.ecs.addTransform(entity, position);

    // Add to scene
    model.position.set(...position);
    this.scene.add(model);

    // Set up animations (assuming model has animations)
    const controller = new AnimationController(model);

    // If model has animations loaded from GLTF
    // const gltf = ...;
    // controller.addClips(gltf.animations);

    this.animationControllers.set(entity, controller);

    // Create physics body for character
    const physicsHandle = this.physics.createBody(
      position,
      { mass: 80, friction: 0.0, isKinematic: true },
      { type: 'capsule', radius: 0.5, height: 1.8 }
    );
    this.entityPhysicsMap.set(entity, physicsHandle);

    return entity;
  }

  /**
   * Create a particle effect at a position.
   */
  createExplosion(position: [number, number, number]): void {
    // Create particle emitter
    this.particles.createFromPreset('explosion', 'fire');
    const emitter = this.particles.getEmitter('explosion');
    if (emitter) {
      emitter.position.set(...position);
      emitter.emit(50); // Burst 50 particles
    }

    // Play spatial audio
    this.audio.playSpatialSFX('explosion', position, 1.0, 1.0);
  }

  // ─── Game Loop ───────────────────────────────────────────────────────────

  start(): void {
    this.running = true;
    this.clock.start();
    this.gameLoop();

    // Start background music
    // this.audio.playSFX('bgm');
  }

  stop(): void {
    this.running = false;
  }

  private gameLoop = (): void => {
    if (!this.running) return;

    const deltaTime = this.clock.getDelta();

    // Update systems
    this.updatePhysics(deltaTime);
    this.updateECS(deltaTime);
    this.updateAnimations(deltaTime);
    this.updateParticles(deltaTime);
    this.syncPhysicsToVisuals();

    // Render
    this.renderer.render(this.scene, this.camera);

    // Schedule next frame
    requestAnimationFrame(this.gameLoop);
  };

  private updatePhysics(dt: number): void {
    this.physics.step(dt);
  }

  private updateECS(dt: number): void {
    // Example: Simple movement system
    const movingEntities = movingObjectsQuery(this.ecs.getRawWorld());
    for (let i = 0; i < movingEntities.length; i++) {
      const eid = movingEntities[i];
      Transform.positionX[eid] += Velocity.x[eid] * dt;
      Transform.positionY[eid] += Velocity.y[eid] * dt;
      Transform.positionZ[eid] += Velocity.z[eid] * dt;
    }
  }

  private updateAnimations(dt: number): void {
    for (const controller of this.animationControllers.values()) {
      controller.update(dt);
    }
  }

  private updateParticles(dt: number): void {
    this.particles.update(dt);
  }

  /**
   * Sync physics body positions to Three.js meshes.
   */
  private syncPhysicsToVisuals(): void {
    for (const [entityId, physicsHandle] of this.entityPhysicsMap) {
      const position = this.physics.getPosition(physicsHandle);
      if (!position) continue;

      // Update ECS transform
      this.ecs.setPosition(entityId, position);

      // Find corresponding mesh in scene and update
      this.scene.traverse((obj) => {
        if ((obj as any).entityId === entityId && obj instanceof THREE.Mesh) {
          obj.position.set(...position);
        }
      });
    }
  }

  // ─── Input Handling Example ─────────────────────────────────────────────

  handleInput(key: string): void {
    switch (key) {
      case 'space':
        // Spawn a ball
        this.createPhysicsBall([
          Math.random() * 4 - 2,
          10,
          Math.random() * 4 - 2,
        ]);
        this.audio.playSFX('jump');
        break;

      case 'e':
        // Create explosion at random position
        this.createExplosion([
          Math.random() * 10 - 5,
          1,
          Math.random() * 10 - 5,
        ]);
        break;
    }
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────────

  dispose(): void {
    this.running = false;
    this.physics.clear();
    this.audio.dispose();
    this.ecs.clear();
    this.particles.dispose();
    this.renderer.dispose();
  }
}

// ─── Usage Example ───────────────────────────────────────────────────────────

/*
// In your main application file:

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const engine = new ExampleGameEngine(canvas);

await engine.init();
engine.start();

// Handle keyboard input
window.addEventListener('keydown', (e) => {
  engine.handleInput(e.key);
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  engine.dispose();
});
*/
