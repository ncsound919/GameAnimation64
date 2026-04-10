/**
 * RapierPhysicsEngine.ts
 * Physics engine wrapper using Rapier3D for Pyrite64's game engine.
 *
 * Replaces the custom GamePhysicsEngine.ts with the industry-standard
 * Rapier physics library (Rust-compiled to WASM for maximum performance).
 *
 * Benefits over custom implementation:
 *  - Production-ready collision detection
 *  - Advanced constraint solvers
 *  - Continuous collision detection (CCD)
 *  - Better performance via WASM
 *  - Active maintenance and bug fixes
 *
 * Design file reference: Component #6 — Physics & Interaction System
 */

import RAPIER from '@dimforge/rapier3d-compat';

export type Vec3 = [number, number, number];

// ─── Rigid Body Configuration ────────────────────────────────────────────────

export interface RigidBodyConfig {
  mass:         number;       // 0 = static
  friction:     number;       // 0–1
  restitution:  number;       // 0–1 (bounciness)
  linearDamping:  number;     // air drag
  angularDamping: number;
  isKinematic:  boolean;      // move via setPosition, not forces
  collisionLayer: number;
  collisionMask:  number;
  density?:     number;       // optional explicit density override (kg/m^3)
}

// ─── Collider Shapes ─────────────────────────────────────────────────────────

export type ColliderShape =
  | { type: 'box';     halfExtents: Vec3 }
  | { type: 'sphere';  radius: number }
  | { type: 'capsule'; radius: number; height: number }
  | { type: 'cylinder'; radius: number; height: number }
  | { type: 'cone';    radius: number; height: number };

// ─── Collision Contact ───────────────────────────────────────────────────────

export interface CollisionContact {
  bodyA:     number;  // body handle
  bodyB:     number;
  normal:    Vec3;
  depth:     number;
  point:     Vec3;
}

export type CollisionCallback = (contact: CollisionContact) => void;

// ─── Raycast Hit ─────────────────────────────────────────────────────────────

export interface RaycastHit {
  bodyHandle: number;
  point:      Vec3;
  normal:     Vec3;
  distance:   number;
}

// ─── Rapier Physics World ────────────────────────────────────────────────────

export interface PhysicsWorldConfig {
  gravity:    Vec3;
  fixedStep:  number;   // fixed timestep in seconds (default: 1/60)
  maxSubSteps: number;  // max physics steps per frame
}

export class RapierPhysicsWorld {
  private world: RAPIER.World | null = null;
  private eventQueue: RAPIER.EventQueue | null = null;
  private bodies: Map<number, RAPIER.RigidBody> = new Map();
  private colliders: Map<number, RAPIER.Collider> = new Map();
  private accumulator = 0;
  private onCollision: CollisionCallback[] = [];
  private initialized = false;

  readonly config: PhysicsWorldConfig;

  constructor(config: Partial<PhysicsWorldConfig> = {}) {
    this.config = {
      gravity:    [0, -9.81, 0],
      fixedStep:  1 / 60,
      maxSubSteps: 5,
      ...config,
    };
  }

  /** Initialize Rapier (async, must be called before use). */
  async init(): Promise<void> {
    if (this.initialized) return;

    await RAPIER.init();

    const gravity = new RAPIER.Vector3(
      this.config.gravity[0],
      this.config.gravity[1],
      this.config.gravity[2]
    );

    this.world = new RAPIER.World(gravity);
    this.eventQueue = new RAPIER.EventQueue(true);
    this.initialized = true;
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.world) {
      throw new Error('RapierPhysicsWorld not initialized. Call init() first.');
    }
  }

  // ─── Body Management ────────────────────────────────────────────────────

  /**
   * Create a rigid body and add it to the world.
   * Returns the body handle (number) for later reference.
   */
  createBody(
    position: Vec3 = [0, 0, 0],
    config: Partial<RigidBodyConfig> = {},
    collider?: ColliderShape
  ): number {
    this.ensureInitialized();

    const cfg: RigidBodyConfig = {
      mass: 1,
      friction: 0.5,
      restitution: 0.3,
      linearDamping: 0.01,
      angularDamping: 0.05,
      isKinematic: false,
      collisionLayer: 1,
      collisionMask: 0xFFFF,
      ...config,
    };

    // Create rigid body descriptor
    let bodyDesc: RAPIER.RigidBodyDesc;
    if (cfg.mass === 0) {
      bodyDesc = RAPIER.RigidBodyDesc.fixed();
    } else if (cfg.isKinematic) {
      bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased();
    } else {
      bodyDesc = RAPIER.RigidBodyDesc.dynamic();
    }

    bodyDesc.setTranslation(position[0], position[1], position[2]);
    bodyDesc.setLinearDamping(cfg.linearDamping);
    bodyDesc.setAngularDamping(cfg.angularDamping);

    const body = this.world!.createRigidBody(bodyDesc);
    const handle = body.handle;
    this.bodies.set(handle, body);

    // Create collider if specified
    if (collider) {
      this.addCollider(handle, collider, cfg);
    }

    return handle;
  }

  /**
   * Add a collider shape to an existing body.
   */
  addCollider(
    bodyHandle: number,
    shape: ColliderShape,
    config: Partial<RigidBodyConfig> = {}
  ): number {
    this.ensureInitialized();

    const body = this.bodies.get(bodyHandle);
    if (!body) throw new Error(`Body ${bodyHandle} not found`);

    const cfg: RigidBodyConfig = {
      mass: 1,
      friction: 0.5,
      restitution: 0.3,
      linearDamping: 0.01,
      angularDamping: 0.05,
      isKinematic: false,
      collisionLayer: 1,
      collisionMask: 0xFFFF,
      ...config,
    };

    // Create collider descriptor based on shape
    let colliderDesc: RAPIER.ColliderDesc;

    switch (shape.type) {
      case 'box':
        colliderDesc = RAPIER.ColliderDesc.cuboid(
          shape.halfExtents[0],
          shape.halfExtents[1],
          shape.halfExtents[2]
        );
        break;
      case 'sphere':
        colliderDesc = RAPIER.ColliderDesc.ball(shape.radius);
        break;
      case 'capsule':
        colliderDesc = RAPIER.ColliderDesc.capsule(shape.height / 2, shape.radius);
        break;
      case 'cylinder':
        colliderDesc = RAPIER.ColliderDesc.cylinder(shape.height / 2, shape.radius);
        break;
      case 'cone':
        colliderDesc = RAPIER.ColliderDesc.cone(shape.height / 2, shape.radius);
        break;
      default:
        throw new Error(`Unsupported collider shape: ${(shape as any).type}`);
    }

    colliderDesc.setFriction(cfg.friction);
    colliderDesc.setRestitution(cfg.restitution);
    colliderDesc.setCollisionGroups(
      (cfg.collisionLayer << 16) | cfg.collisionMask
    );

    if (cfg.mass > 0 && !cfg.isKinematic) {
      const density = cfg.density ?? this.computeDensity(cfg.mass, shape);
      if (density !== null) {
        colliderDesc.setDensity(density);
      }
    }

    const collider = this.world!.createCollider(colliderDesc, body);
    const handle = collider.handle;
    this.colliders.set(handle, collider);

    return handle;
  }

  /** Compute density from a desired mass and collider shape volume. */
  private computeDensity(mass: number, shape: ColliderShape): number | null {
    const volume = this.computeShapeVolume(shape);
    if (!volume || volume <= 0) return null;
    return mass / volume;
  }

  /** Compute the volume of a collider shape (in m^3). */
  private computeShapeVolume(shape: ColliderShape): number | null {
    switch (shape.type) {
      case 'box': {
        const [hx, hy, hz] = shape.halfExtents;
        return 8 * hx * hy * hz; // (2*hx)*(2*hy)*(2*hz)
      }
      case 'sphere':
        return (4 / 3) * Math.PI * Math.pow(shape.radius, 3);
      case 'capsule': {
        const r = shape.radius;
        const h = shape.height;
        const cylinderVolume = Math.PI * r * r * h;
        const sphereVolume = (4 / 3) * Math.PI * Math.pow(r, 3);
        return cylinderVolume + sphereVolume;
      }
      case 'cylinder':
        return Math.PI * shape.radius * shape.radius * shape.height;
      case 'cone':
        return (1 / 3) * Math.PI * shape.radius * shape.radius * shape.height;
      default:
        return null;
    }
  }

  /** Remove a body from the world. */
  removeBody(handle: number): void {
    this.ensureInitialized();
    const body = this.bodies.get(handle);
    if (body) {
      this.world!.removeRigidBody(body);
      this.bodies.delete(handle);
    }
  }

  /** Get a body by handle. */
  getBody(handle: number): RAPIER.RigidBody | undefined {
    return this.bodies.get(handle);
  }

  /** Get body position. */
  getPosition(handle: number): Vec3 | null {
    const body = this.bodies.get(handle);
    if (!body) return null;
    const pos = body.translation();
    return [pos.x, pos.y, pos.z];
  }

  /** Set body position (for kinematic or teleporting). */
  setPosition(handle: number, pos: Vec3): void {
    const body = this.bodies.get(handle);
    if (!body) return;
    body.setTranslation(new RAPIER.Vector3(pos[0], pos[1], pos[2]), true);
  }

  /** Get body velocity. */
  getVelocity(handle: number): Vec3 | null {
    const body = this.bodies.get(handle);
    if (!body) return null;
    const vel = body.linvel();
    return [vel.x, vel.y, vel.z];
  }

  /** Set body velocity. */
  setVelocity(handle: number, vel: Vec3): void {
    const body = this.bodies.get(handle);
    if (!body) return;
    body.setLinvel(new RAPIER.Vector3(vel[0], vel[1], vel[2]), true);
  }

  /** Apply force to body. */
  applyForce(handle: number, force: Vec3): void {
    const body = this.bodies.get(handle);
    if (!body) return;
    body.addForce(new RAPIER.Vector3(force[0], force[1], force[2]), true);
  }

  /** Apply impulse to body. */
  applyImpulse(handle: number, impulse: Vec3): void {
    const body = this.bodies.get(handle);
    if (!body) return;
    body.applyImpulse(new RAPIER.Vector3(impulse[0], impulse[1], impulse[2]), true);
  }

  // ─── Collision Callbacks ────────────────────────────────────────────────

  onCollisionDetected(cb: CollisionCallback): void {
    this.onCollision.push(cb);
  }

  // ─── Simulation ─────────────────────────────────────────────────────────

  /** Step the physics simulation by dt seconds. */
  step(dt: number): void {
    this.ensureInitialized();

    this.accumulator += dt;
    let steps = 0;

    while (this.accumulator >= this.config.fixedStep && steps < this.config.maxSubSteps) {
      this.world!.step(this.eventQueue!);
      this.processCollisionEvents();
      this.accumulator -= this.config.fixedStep;
      steps++;
    }
  }

  private processCollisionEvents(): void {
    if (!this.eventQueue) return;

    this.eventQueue.drainCollisionEvents((h1, h2, started) => {
      if (!started) return; // Only process collision start events

      // Find the rigid bodies associated with these colliders
      const collider1 = this.world!.getCollider(h1);
      const collider2 = this.world!.getCollider(h2);
      if (!collider1 || !collider2) return;

      const body1Handle = collider1.parent();
      const body2Handle = collider2.parent();
      if (body1Handle == null || body2Handle == null) return;

      // Get contact information
      const contact: CollisionContact = {
        bodyA: body1Handle,
        bodyB: body2Handle,
        normal: [0, 1, 0], // Rapier doesn't provide this in event, would need manifolds
        depth: 0,
        point: [0, 0, 0],
      };

      // Notify callbacks
      for (const cb of this.onCollision) {
        cb(contact);
      }
    });
  }

  // ─── Raycasting ─────────────────────────────────────────────────────────

  /** Cast a ray and return the closest hit, or null. */
  raycast(origin: Vec3, direction: Vec3, maxDistance = 1000): RaycastHit | null {
    this.ensureInitialized();

    const ray = new RAPIER.Ray(
      new RAPIER.Vector3(origin[0], origin[1], origin[2]),
      new RAPIER.Vector3(direction[0], direction[1], direction[2])
    );

    const hit = this.world!.castRay(ray, maxDistance, true);
    if (!hit) return null;

    const collider = this.world!.getCollider(hit.collider);
    if (!collider) return null;
    const body = collider.parent();
    if (!body) return null;

    const hitPoint = ray.pointAt(hit.toi);
    const normal = hit.normal;

    return {
      bodyHandle: body.handle,
      point: [hitPoint.x, hitPoint.y, hitPoint.z],
      normal: normal ? [normal.x, normal.y, normal.z] : [0, 1, 0],
      distance: hit.toi,
    };
  }

  /** Cast a ray and return ALL hits sorted by distance. */
  raycastAll(origin: Vec3, direction: Vec3, maxDistance = 1000): RaycastHit[] {
    this.ensureInitialized();

    const ray = new RAPIER.Ray(
      new RAPIER.Vector3(origin[0], origin[1], origin[2]),
      new RAPIER.Vector3(direction[0], direction[1], direction[2])
    );

    const hits: RaycastHit[] = [];

    this.world!.castRay(ray, maxDistance, true, (hit) => {
      const collider = this.world!.getCollider(hit.collider);
      if (!collider) return true;

      const body = collider.parent();
      if (!body) return true;

      const hitPoint = ray.pointAt(hit.toi);
      const normal = hit.normal;

      hits.push({
        bodyHandle: body.handle,
        point: [hitPoint.x, hitPoint.y, hitPoint.z],
        normal: normal ? [normal.x, normal.y, normal.z] : [0, 1, 0],
        distance: hit.toi,
      });

      return true; // Continue checking for more hits
    });

    return hits.sort((a, b) => a.distance - b.distance);
  }

  // ─── Utility ────────────────────────────────────────────────────────────

  /** Remove all bodies and reset. */
  clear(): void {
    this.ensureInitialized();

    // Remove all bodies
    for (const body of this.bodies.values()) {
      this.world!.removeRigidBody(body);
    }

    this.bodies.clear();
    this.colliders.clear();
  }

  /** Set the world gravity. */
  setGravity(g: Vec3): void {
    this.ensureInitialized();
    this.config.gravity = g;
    this.world!.gravity.x = g[0];
    this.world!.gravity.y = g[1];
    this.world!.gravity.z = g[2];
  }

  /** Get the underlying Rapier world (for advanced usage). */
  getRawWorld(): RAPIER.World | null {
    return this.world;
  }
}
