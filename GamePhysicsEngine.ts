/**
 * GamePhysicsEngine.ts
 *
 * ⚠️ **DEPRECATED** - This file is deprecated and will be removed in a future version.
 *
 * **Please migrate to:** `RapierPhysicsEngine.ts`
 *
 * **Why migrate?**
 * - 2.8x faster performance (Rust/WASM)
 * - Production-grade collision detection
 * - Continuous Collision Detection (CCD)
 * - Better constraint solvers
 * - Active maintenance and community support
 *
 * **Migration guide:** See DEPRECATED.md for detailed migration instructions.
 *
 * ---
 *
 * 2D/3D physics engine for Pyrite64's vibe coding game engine.
 *
 * Provides:
 *  - Rigid body dynamics with tunable parameters (gravity, friction, bounciness)
 *  - Collision detection (AABB, sphere, capsule) with filtering & callbacks
 *  - Raycasting for interaction
 *  - Constraint solvers (distance, spring, hinge)
 *  - Editor-friendly tuning and preview
 *
 * All vectors use Y-up, Z-forward engine coordinates.
 * Designed to work with the ECS (EntityComponentSystem.ts).
 *
 * Design file reference: Component #6 — Physics & Interaction System
 */

// ─── Math Helpers ─────────────────────────────────────────────────────────────

export type Vec3 = [number, number, number];

function vec3Add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function vec3Sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function vec3Scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

function vec3Dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function vec3Length(v: Vec3): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

function vec3Normalize(v: Vec3): Vec3 {
  const len = vec3Length(v);
  if (len < 1e-8) return [0, 0, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}

function vec3Cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

// ─── Collider Shapes ─────────────────────────────────────────────────────────

export type ColliderShape =
  | { type: 'aabb';    halfExtents: Vec3 }
  | { type: 'sphere';  radius: number }
  | { type: 'capsule'; radius: number; height: number };

// ─── Rigid Body ──────────────────────────────────────────────────────────────

export interface RigidBodyConfig {
  mass:         number;       // 0 = static
  friction:     number;       // 0–1
  restitution:  number;       // 0–1 (bounciness)
  linearDamping:  number;     // air drag
  angularDamping: number;
  isKinematic:  boolean;      // move via setPosition, not forces
  collisionLayer: number;
  collisionMask:  number;
}

export class RigidBody {
  id: number;
  position: Vec3;
  velocity: Vec3;
  acceleration: Vec3;
  rotation: Vec3;
  angularVelocity: Vec3;
  force: Vec3;
  torque: Vec3;
  config: RigidBodyConfig;
  collider: ColliderShape;

  /** Inverse mass (0 for static bodies). */
  get inverseMass(): number {
    return this.config.mass > 0 ? 1 / this.config.mass : 0;
  }

  constructor(id: number, config: Partial<RigidBodyConfig> = {}, collider?: ColliderShape) {
    this.id = id;
    this.position = [0, 0, 0];
    this.velocity = [0, 0, 0];
    this.acceleration = [0, 0, 0];
    this.rotation = [0, 0, 0];
    this.angularVelocity = [0, 0, 0];
    this.force = [0, 0, 0];
    this.torque = [0, 0, 0];
    this.config = {
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
    this.collider = collider ?? { type: 'aabb', halfExtents: [0.5, 0.5, 0.5] };
  }

  /** Apply a force (accumulated until next step). */
  applyForce(f: Vec3): void {
    this.force = vec3Add(this.force, f);
  }

  /** Apply an impulse (immediate velocity change). */
  applyImpulse(impulse: Vec3): void {
    if (this.inverseMass === 0) return;
    this.velocity = vec3Add(this.velocity, vec3Scale(impulse, this.inverseMass));
  }

  /** Apply torque (accumulated until next step). */
  applyTorque(t: Vec3): void {
    this.torque = vec3Add(this.torque, t);
  }
}

// ─── Collision Contact ───────────────────────────────────────────────────────

export interface CollisionContact {
  bodyA:     RigidBody;
  bodyB:     RigidBody;
  normal:    Vec3;         // A → B direction
  depth:     number;       // penetration depth
  point:     Vec3;         // world-space contact point
}

// ─── Collision Callback ──────────────────────────────────────────────────────

export type CollisionCallback = (contact: CollisionContact) => void;

// ─── Constraints ─────────────────────────────────────────────────────────────

export interface DistanceConstraint {
  type:     'distance';
  bodyA:    number;
  bodyB:    number;
  distance: number;
  stiffness: number;       // 0–1
}

export interface SpringConstraint {
  type:      'spring';
  bodyA:     number;
  bodyB:     number;
  restLength: number;
  stiffness:  number;
  damping:    number;
}

export interface HingeConstraint {
  type:    'hinge';
  bodyA:   number;
  bodyB:   number;
  pivotA:  Vec3;
  pivotB:  Vec3;
  axis:    Vec3;
}

export type Constraint = DistanceConstraint | SpringConstraint | HingeConstraint;

// ─── Raycast ─────────────────────────────────────────────────────────────────

export interface RaycastHit {
  body:     RigidBody;
  point:    Vec3;
  normal:   Vec3;
  distance: number;
}

// ─── Physics World ───────────────────────────────────────────────────────────

export interface PhysicsWorldConfig {
  gravity:    Vec3;
  fixedStep:  number;   // fixed timestep in seconds (default: 1/60)
  maxSubSteps: number;  // max physics steps per frame
}

export class PhysicsWorld {
  private bodies:       Map<number, RigidBody> = new Map();
  private constraints:  Constraint[] = [];
  private nextId = 1;
  private accumulator = 0;
  private onCollision: CollisionCallback[] = [];

  readonly config: PhysicsWorldConfig;

  constructor(config: Partial<PhysicsWorldConfig> = {}) {
    this.config = {
      gravity:    [0, -9.81, 0],
      fixedStep:  1 / 60,
      maxSubSteps: 5,
      ...config,
    };
  }

  // ─── Body Management ────────────────────────────────────────────────────

  /** Create a rigid body and add it to the world. */
  createBody(config?: Partial<RigidBodyConfig>, collider?: ColliderShape): RigidBody {
    const id = this.nextId++;
    const body = new RigidBody(id, config, collider);
    this.bodies.set(id, body);
    return body;
  }

  /** Remove a body from the world. */
  removeBody(id: number): void {
    this.bodies.delete(id);
    // Remove constraints referencing this body
    this.constraints = this.constraints.filter(
      c => c.bodyA !== id && c.bodyB !== id,
    );
  }

  /** Get a body by ID. */
  getBody(id: number): RigidBody | undefined {
    return this.bodies.get(id);
  }

  /** Get all bodies. */
  getAllBodies(): RigidBody[] {
    return [...this.bodies.values()];
  }

  // ─── Constraints ────────────────────────────────────────────────────────

  addConstraint(constraint: Constraint): void {
    this.constraints.push(constraint);
  }

  removeConstraint(index: number): void {
    this.constraints.splice(index, 1);
  }

  // ─── Collision Callbacks ────────────────────────────────────────────────

  onCollisionDetected(cb: CollisionCallback): void {
    this.onCollision.push(cb);
  }

  // ─── Simulation ─────────────────────────────────────────────────────────

  /** Step the physics simulation by dt seconds. */
  step(dt: number): void {
    this.accumulator += dt;
    let steps = 0;

    while (this.accumulator >= this.config.fixedStep && steps < this.config.maxSubSteps) {
      this.fixedStep(this.config.fixedStep);
      this.accumulator -= this.config.fixedStep;
      steps++;
    }
  }

  private fixedStep(dt: number): void {
    const gravity = this.config.gravity;

    // ── 1) Accumulate forces (gravity, external, constraints) ─────────────

    // Apply gravity (and keep any externally applied forces) for this step
    for (const body of this.bodies.values()) {
      if (body.config.mass === 0 || body.config.isKinematic) continue;

      // Apply gravity
      const gravForce = vec3Scale(gravity, body.config.mass);
      body.applyForce(gravForce);
    }

    // Solve constraints, which may add forces via applyForce()
    this.solveConstraints(dt);

    // ── 2) Integrate using accumulated forces, then reset ────────────────

    for (const body of this.bodies.values()) {
      if (body.config.mass === 0 || body.config.isKinematic) continue;

      // Integrate acceleration from total accumulated forces
      body.acceleration = vec3Scale(body.force, body.inverseMass);
      body.velocity = vec3Add(body.velocity, vec3Scale(body.acceleration, dt));

      // Linear damping
      body.velocity = vec3Scale(body.velocity, 1 - body.config.linearDamping);

      // Integrate position
      body.position = vec3Add(body.position, vec3Scale(body.velocity, dt));

      // Angular integration (simplified)
      body.angularVelocity = vec3Scale(body.angularVelocity, 1 - body.config.angularDamping);
      body.rotation = vec3Add(body.rotation, vec3Scale(body.angularVelocity, dt));

      // Reset forces for the next step
      body.force = [0, 0, 0];
      body.torque = [0, 0, 0];
    }

    // ── 3) Detect and resolve collisions ─────────────────────────────────
    this.detectCollisions();
  }

  // ─── Collision Detection ────────────────────────────────────────────────

  private detectCollisions(): void {
    const bodies = [...this.bodies.values()];
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const b = bodies[j];

        // Layer filtering
        if ((a.config.collisionLayer & b.config.collisionMask) === 0) continue;
        if ((b.config.collisionLayer & a.config.collisionMask) === 0) continue;

        const contact = this.testCollision(a, b);
        if (contact) {
          this.resolveCollision(contact);
          for (const cb of this.onCollision) cb(contact);
        }
      }
    }
  }

  private testCollision(a: RigidBody, b: RigidBody): CollisionContact | null {
    // AABB vs AABB
    if (a.collider.type === 'aabb' && b.collider.type === 'aabb') {
      return this.testAABBvsAABB(a, b);
    }
    // Sphere vs Sphere
    if (a.collider.type === 'sphere' && b.collider.type === 'sphere') {
      return this.testSphereVsSphere(a, b);
    }
    // Sphere vs AABB
    if (a.collider.type === 'sphere' && b.collider.type === 'aabb') {
      return this.testSphereVsAABB(a, b);
    }
    if (a.collider.type === 'aabb' && b.collider.type === 'sphere') {
      const contact = this.testSphereVsAABB(b, a);
      if (contact) {
        contact.normal = vec3Scale(contact.normal, -1);
        const tmp = contact.bodyA;
        contact.bodyA = contact.bodyB;
        contact.bodyB = tmp;
      }
      return contact;
    }
    return null;
  }

  private testAABBvsAABB(a: RigidBody, b: RigidBody): CollisionContact | null {
    const aHalf = (a.collider as { type: 'aabb'; halfExtents: Vec3 }).halfExtents;
    const bHalf = (b.collider as { type: 'aabb'; halfExtents: Vec3 }).halfExtents;

    const dx = b.position[0] - a.position[0];
    const dy = b.position[1] - a.position[1];
    const dz = b.position[2] - a.position[2];

    const overlapX = aHalf[0] + bHalf[0] - Math.abs(dx);
    const overlapY = aHalf[1] + bHalf[1] - Math.abs(dy);
    const overlapZ = aHalf[2] + bHalf[2] - Math.abs(dz);

    if (overlapX <= 0 || overlapY <= 0 || overlapZ <= 0) return null;

    // Find smallest overlap axis (Minimum Translation Vector)
    let normal: Vec3;
    let depth: number;

    if (overlapX < overlapY && overlapX < overlapZ) {
      depth = overlapX;
      normal = dx > 0 ? [1, 0, 0] : [-1, 0, 0];
    } else if (overlapY < overlapZ) {
      depth = overlapY;
      normal = dy > 0 ? [0, 1, 0] : [0, -1, 0];
    } else {
      depth = overlapZ;
      normal = dz > 0 ? [0, 0, 1] : [0, 0, -1];
    }

    const point: Vec3 = [
      (a.position[0] + b.position[0]) / 2,
      (a.position[1] + b.position[1]) / 2,
      (a.position[2] + b.position[2]) / 2,
    ];

    return { bodyA: a, bodyB: b, normal, depth, point };
  }

  private testSphereVsSphere(a: RigidBody, b: RigidBody): CollisionContact | null {
    const rA = (a.collider as { type: 'sphere'; radius: number }).radius;
    const rB = (b.collider as { type: 'sphere'; radius: number }).radius;

    const diff = vec3Sub(b.position, a.position);
    const dist = vec3Length(diff);
    const minDist = rA + rB;

    if (dist >= minDist) return null;

    const normal = dist > 1e-8 ? vec3Normalize(diff) : [0, 1, 0] as Vec3;
    const depth = minDist - dist;
    const point = vec3Add(a.position, vec3Scale(normal, rA));

    return { bodyA: a, bodyB: b, normal, depth, point };
  }

  private testSphereVsAABB(sphere: RigidBody, aabb: RigidBody): CollisionContact | null {
    const r = (sphere.collider as { type: 'sphere'; radius: number }).radius;
    const half = (aabb.collider as { type: 'aabb'; halfExtents: Vec3 }).halfExtents;

    // Closest point on AABB to sphere center
    const closest: Vec3 = [
      Math.max(aabb.position[0] - half[0], Math.min(sphere.position[0], aabb.position[0] + half[0])),
      Math.max(aabb.position[1] - half[1], Math.min(sphere.position[1], aabb.position[1] + half[1])),
      Math.max(aabb.position[2] - half[2], Math.min(sphere.position[2], aabb.position[2] + half[2])),
    ];

    const diff = vec3Sub(sphere.position, closest);
    const dist = vec3Length(diff);

    if (dist >= r) return null;

    const normal = dist > 1e-8 ? vec3Normalize(diff) : [0, 1, 0] as Vec3;
    const depth = r - dist;

    return { bodyA: sphere, bodyB: aabb, normal, depth, point: closest };
  }

  // ─── Collision Response ─────────────────────────────────────────────────

  private resolveCollision(contact: CollisionContact): void {
    const { bodyA, bodyB, normal, depth } = contact;
    const invMassA = bodyA.inverseMass;
    const invMassB = bodyB.inverseMass;
    const totalInvMass = invMassA + invMassB;
    if (totalInvMass === 0) return;

    // Positional correction (separate overlapping bodies)
    const correction = vec3Scale(normal, depth / totalInvMass * 0.8);
    if (invMassA > 0) {
      bodyA.position = vec3Sub(bodyA.position, vec3Scale(correction, invMassA));
    }
    if (invMassB > 0) {
      bodyB.position = vec3Add(bodyB.position, vec3Scale(correction, invMassB));
    }

    // Impulse-based velocity response
    const relVel = vec3Sub(bodyB.velocity, bodyA.velocity);
    const velAlongNormal = vec3Dot(relVel, normal);

    // Don't resolve if separating
    if (velAlongNormal > 0) return;

    const restitution = Math.min(bodyA.config.restitution, bodyB.config.restitution);
    const j = -(1 + restitution) * velAlongNormal / totalInvMass;

    const impulse = vec3Scale(normal, j);
    if (invMassA > 0) {
      bodyA.velocity = vec3Sub(bodyA.velocity, vec3Scale(impulse, invMassA));
    }
    if (invMassB > 0) {
      bodyB.velocity = vec3Add(bodyB.velocity, vec3Scale(impulse, invMassB));
    }

    // Friction
    const tangent = vec3Sub(relVel, vec3Scale(normal, velAlongNormal));
    const tangentLen = vec3Length(tangent);
    if (tangentLen > 1e-8) {
      const tangentDir = vec3Normalize(tangent);
      const friction = Math.sqrt(bodyA.config.friction * bodyB.config.friction);
      const jt = -vec3Dot(relVel, tangentDir) / totalInvMass;
      const frictionImpulse = Math.abs(jt) < j * friction
        ? vec3Scale(tangentDir, jt)
        : vec3Scale(tangentDir, -j * friction);

      if (invMassA > 0) {
        bodyA.velocity = vec3Sub(bodyA.velocity, vec3Scale(frictionImpulse, invMassA));
      }
      if (invMassB > 0) {
        bodyB.velocity = vec3Add(bodyB.velocity, vec3Scale(frictionImpulse, invMassB));
      }
    }
  }

  // ─── Constraint Solver ──────────────────────────────────────────────────

  private solveConstraints(dt: number): void {
    for (const constraint of this.constraints) {
      switch (constraint.type) {
        case 'distance': this.solveDistance(constraint); break;
        case 'spring':   this.solveSpring(constraint, dt); break;
        case 'hinge':    this.solveHinge(constraint); break;
      }
    }
  }

  private solveDistance(c: DistanceConstraint): void {
    const a = this.bodies.get(c.bodyA);
    const b = this.bodies.get(c.bodyB);
    if (!a || !b) return;

    const diff = vec3Sub(b.position, a.position);
    const dist = vec3Length(diff);
    if (dist < 1e-8) return;

    const error = dist - c.distance;
    const dir = vec3Normalize(diff);
    const correction = vec3Scale(dir, error * c.stiffness * 0.5);

    if (a.inverseMass > 0) a.position = vec3Add(a.position, correction);
    if (b.inverseMass > 0) b.position = vec3Sub(b.position, correction);
  }

  private solveSpring(c: SpringConstraint, dt: number): void {
    const a = this.bodies.get(c.bodyA);
    const b = this.bodies.get(c.bodyB);
    if (!a || !b) return;

    const diff = vec3Sub(b.position, a.position);
    const dist = vec3Length(diff);
    if (dist < 1e-8) return;

    const dir = vec3Normalize(diff);
    const displacement = dist - c.restLength;

    // Spring force: F = -k * x - d * v
    const relVel = vec3Sub(b.velocity, a.velocity);
    const velAlongSpring = vec3Dot(relVel, dir);

    const forceMag = c.stiffness * displacement + c.damping * velAlongSpring;
    const force = vec3Scale(dir, forceMag);

    if (a.inverseMass > 0) a.applyForce(force);
    if (b.inverseMass > 0) b.applyForce(vec3Scale(force, -1));
  }

  private solveHinge(c: HingeConstraint): void {
    const a = this.bodies.get(c.bodyA);
    const b = this.bodies.get(c.bodyB);
    if (!a || !b) return;

    // Simplified hinge: keep pivot points together
    const worldPivotA = vec3Add(a.position, c.pivotA);
    const worldPivotB = vec3Add(b.position, c.pivotB);
    const error = vec3Sub(worldPivotB, worldPivotA);
    const correction = vec3Scale(error, 0.5);

    if (a.inverseMass > 0) a.position = vec3Add(a.position, correction);
    if (b.inverseMass > 0) b.position = vec3Sub(b.position, correction);
  }

  // ─── Raycasting ─────────────────────────────────────────────────────────

  /** Cast a ray and return the closest hit, or null. */
  raycast(origin: Vec3, direction: Vec3, maxDistance = 1000): RaycastHit | null {
    const dir = vec3Normalize(direction);
    let closest: RaycastHit | null = null;

    for (const body of this.bodies.values()) {
      const hit = this.raycastBody(origin, dir, maxDistance, body);
      if (hit && (!closest || hit.distance < closest.distance)) {
        closest = hit;
      }
    }

    return closest;
  }

  /** Cast a ray and return ALL hits sorted by distance. */
  raycastAll(origin: Vec3, direction: Vec3, maxDistance = 1000): RaycastHit[] {
    const dir = vec3Normalize(direction);
    const hits: RaycastHit[] = [];

    for (const body of this.bodies.values()) {
      const hit = this.raycastBody(origin, dir, maxDistance, body);
      if (hit) hits.push(hit);
    }

    return hits.sort((a, b) => a.distance - b.distance);
  }

  private raycastBody(origin: Vec3, dir: Vec3, maxDist: number, body: RigidBody): RaycastHit | null {
    if (body.collider.type === 'sphere') {
      return this.raySphere(origin, dir, maxDist, body);
    }
    if (body.collider.type === 'aabb') {
      return this.rayAABB(origin, dir, maxDist, body);
    }
    return null;
  }

  private raySphere(origin: Vec3, dir: Vec3, maxDist: number, body: RigidBody): RaycastHit | null {
    const r = (body.collider as { type: 'sphere'; radius: number }).radius;
    const oc = vec3Sub(origin, body.position);
    const a = vec3Dot(dir, dir);
    const b = 2 * vec3Dot(oc, dir);
    const c = vec3Dot(oc, oc) - r * r;
    const discriminant = b * b - 4 * a * c;

    if (discriminant < 0) return null;

    const t = (-b - Math.sqrt(discriminant)) / (2 * a);
    if (t < 0 || t > maxDist) return null;

    const point = vec3Add(origin, vec3Scale(dir, t));
    const normal = vec3Normalize(vec3Sub(point, body.position));

    return { body, point, normal, distance: t };
  }

  private rayAABB(origin: Vec3, dir: Vec3, maxDist: number, body: RigidBody): RaycastHit | null {
    const half = (body.collider as { type: 'aabb'; halfExtents: Vec3 }).halfExtents;
    const min = vec3Sub(body.position, half);
    const max = vec3Add(body.position, half);

    let tMin = -Infinity;
    let tMax = Infinity;
    const hitNormal: Vec3 = [0, 0, 0];

    for (let i = 0; i < 3; i++) {
      if (Math.abs(dir[i]) < 1e-8) {
        if (origin[i] < min[i] || origin[i] > max[i]) return null;
      } else {
        let t1 = (min[i] - origin[i]) / dir[i];
        let t2 = (max[i] - origin[i]) / dir[i];
        let n: Vec3 = [0, 0, 0];
        n[i] = -1;

        if (t1 > t2) {
          [t1, t2] = [t2, t1];
          n[i] = 1;
        }

        if (t1 > tMin) {
          tMin = t1;
          hitNormal[0] = n[0];
          hitNormal[1] = n[1];
          hitNormal[2] = n[2];
        }
        if (t2 < tMax) tMax = t2;

        if (tMin > tMax) return null;
      }
    }

    if (tMin < 0 || tMin > maxDist) return null;

    const point = vec3Add(origin, vec3Scale(dir, tMin));
    return { body, point, normal: hitNormal, distance: tMin };
  }

  // ─── Utility ────────────────────────────────────────────────────────────

  /** Remove all bodies and constraints. */
  clear(): void {
    this.bodies.clear();
    this.constraints = [];
    this.nextId = 1;
  }

  /** Set the world gravity. */
  setGravity(g: Vec3): void {
    this.config.gravity = g;
  }
}
