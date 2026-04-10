/**
 * BitECSWrapper.ts
 * Entity Component System wrapper using bitECS for Pyrite64's game engine.
 *
 * Replaces the custom EntityComponentSystem.ts with the high-performance
 * bitECS library optimized for cache-friendly data-oriented design.
 *
 * Benefits over custom implementation:
 *  - Extremely fast iteration via typed arrays
 *  - Memory-efficient component storage
 *  - Query caching and optimization
 *  - Archetypes for better cache locality
 *  - Active development and community
 *
 * Design file reference: Component #1 — Scene Graph & Entity Component System
 */

import {
  createWorld,
  addEntity,
  removeEntity,
  addComponent,
  removeComponent,
  hasComponent,
  defineComponent,
  defineQuery,
  Changed,
  Not,
  Types,
  IWorld,
} from 'bitecs';

// ─── Component Definitions ───────────────────────────────────────────────────

/** Transform component — position, rotation, scale. */
export const Transform = defineComponent({
  positionX: Types.f32,
  positionY: Types.f32,
  positionZ: Types.f32,
  rotationX: Types.f32,
  rotationY: Types.f32,
  rotationZ: Types.f32,
  scaleX: Types.f32,
  scaleY: Types.f32,
  scaleZ: Types.f32,
});

/** Velocity component for physics/movement. */
export const Velocity = defineComponent({
  x: Types.f32,
  y: Types.f32,
  z: Types.f32,
});

/** RigidBody component for physics. */
export const RigidBody = defineComponent({
  mass: Types.f32,
  friction: Types.f32,
  restitution: Types.f32,
  isKinematic: Types.ui8, // boolean
  bodyHandle: Types.ui32, // Rapier body handle
});

/** Collider component. */
export const Collider = defineComponent({
  shapeType: Types.ui8, // 0=box, 1=sphere, 2=capsule, etc.
  sizeX: Types.f32,
  sizeY: Types.f32,
  sizeZ: Types.f32,
  isTrigger: Types.ui8,
  layer: Types.ui16,
});

/** Mesh component for 3D rendering. */
export const Mesh = defineComponent({
  modelId: Types.ui32,   // Index into model array
  materialId: Types.ui32,
  castShadow: Types.ui8,
  visible: Types.ui8,
});

/** Camera component. */
export const Camera = defineComponent({
  fov: Types.f32,
  near: Types.f32,
  far: Types.f32,
  isActive: Types.ui8,
  projectionType: Types.ui8, // 0=perspective, 1=orthographic
});

/** Light component. */
export const Light = defineComponent({
  lightType: Types.ui8, // 0=directional, 1=point, 2=spot, 3=ambient
  colorR: Types.f32,
  colorG: Types.f32,
  colorB: Types.f32,
  intensity: Types.f32,
  range: Types.f32,
});

/** AudioSource component. */
export const AudioSource = defineComponent({
  clipId: Types.ui32,
  volume: Types.f32,
  pitch: Types.f32,
  loop: Types.ui8,
  spatial: Types.ui8,
  maxDistance: Types.f32,
});

/** ParticleEmitter component. */
export const ParticleEmitter = defineComponent({
  presetId: Types.ui32,
  emissionRate: Types.f32,
  maxParticles: Types.ui32,
  autoPlay: Types.ui8,
});

/** Health component. */
export const Health = defineComponent({
  current: Types.i32,
  max: Types.i32,
});

/** Tag component - generic marker. */
export const Tag = defineComponent({
  tagBits: Types.ui32, // Use bit flags for multiple tags
});

// ─── Tag Utilities ───────────────────────────────────────────────────────────

export const TagBits = {
  Player: 1 << 0,
  Enemy: 1 << 1,
  Bullet: 1 << 2,
  Pickup: 1 << 3,
  Obstacle: 1 << 4,
  NPC: 1 << 5,
  Trigger: 1 << 6,
  Interactive: 1 << 7,
} as const;

export function hasTag(eid: number, tag: number): boolean {
  return (Tag.tagBits[eid] & tag) !== 0;
}

export function addTag(eid: number, tag: number): void {
  Tag.tagBits[eid] |= tag;
}

export function removeTag(eid: number, tag: number): void {
  Tag.tagBits[eid] &= ~tag;
}

// ─── Common Queries ──────────────────────────────────────────────────────────

/** All entities with Transform + Velocity (moving objects). */
export const movingObjectsQuery = defineQuery([Transform, Velocity]);

/** All entities with Transform + Mesh (renderable). */
export const renderableQuery = defineQuery([Transform, Mesh]);

/** All entities with Transform + RigidBody (physics objects). */
export const physicsQuery = defineQuery([Transform, RigidBody]);

/** All entities with Camera. */
export const cameraQuery = defineQuery([Camera, Transform]);

/** All entities with Light. */
export const lightQuery = defineQuery([Light, Transform]);

/** All entities with ParticleEmitter. */
export const particleEmitterQuery = defineQuery([ParticleEmitter, Transform]);

// ─── World Wrapper ───────────────────────────────────────────────────────────

export class BitECSWorld {
  readonly world: IWorld;
  private entityNames: Map<number, string> = new Map();
  private entityParents: Map<number, number | null> = new Map();
  private entityChildren: Map<number, number[]> = new Map();
  private nextEntityId = 0;

  constructor() {
    this.world = createWorld();
  }

  // ─── Entity Management ──────────────────────────────────────────────────

  /** Create a new entity. */
  createEntity(name = 'Entity'): number {
    const eid = addEntity(this.world);
    this.entityNames.set(eid, name);
    this.entityParents.set(eid, null);
    this.entityChildren.set(eid, []);
    return eid;
  }

  /** Remove an entity and all its children. */
  destroyEntity(eid: number): void {
    // Recursively destroy children
    const children = this.entityChildren.get(eid) || [];
    for (const childId of [...children]) {
      this.destroyEntity(childId);
    }

    // Remove from parent
    const parent = this.entityParents.get(eid);
    if (parent !== null && parent !== undefined) {
      const siblings = this.entityChildren.get(parent);
      if (siblings) {
        const idx = siblings.indexOf(eid);
        if (idx !== -1) siblings.splice(idx, 1);
      }
    }

    removeEntity(this.world, eid);
    this.entityNames.delete(eid);
    this.entityParents.delete(eid);
    this.entityChildren.delete(eid);
  }

  /** Get entity name. */
  getName(eid: number): string {
    return this.entityNames.get(eid) || `Entity#${eid}`;
  }

  /** Set entity name. */
  setName(eid: number, name: string): void {
    this.entityNames.set(eid, name);
  }

  /** Set parent-child relationship. */
  setParent(childId: number, parentId: number | null): void {
    // Remove from old parent
    const oldParent = this.entityParents.get(childId);
    if (oldParent !== null && oldParent !== undefined) {
      const siblings = this.entityChildren.get(oldParent);
      if (siblings) {
        const idx = siblings.indexOf(childId);
        if (idx !== -1) siblings.splice(idx, 1);
      }
    }

    this.entityParents.set(childId, parentId);

    // Add to new parent
    if (parentId !== null) {
      const children = this.entityChildren.get(parentId);
      if (children && !children.includes(childId)) {
        children.push(childId);
      }
    }
  }

  /** Get parent entity ID. */
  getParent(eid: number): number | null {
    return this.entityParents.get(eid) ?? null;
  }

  /** Get child entity IDs. */
  getChildren(eid: number): number[] {
    return this.entityChildren.get(eid) || [];
  }

  // ─── Component Helpers ──────────────────────────────────────────────────

  /** Add Transform component with initial values. */
  addTransform(
    eid: number,
    position: [number, number, number] = [0, 0, 0],
    rotation: [number, number, number] = [0, 0, 0],
    scale: [number, number, number] = [1, 1, 1]
  ): void {
    addComponent(this.world, Transform, eid);
    Transform.positionX[eid] = position[0];
    Transform.positionY[eid] = position[1];
    Transform.positionZ[eid] = position[2];
    Transform.rotationX[eid] = rotation[0];
    Transform.rotationY[eid] = rotation[1];
    Transform.rotationZ[eid] = rotation[2];
    Transform.scaleX[eid] = scale[0];
    Transform.scaleY[eid] = scale[1];
    Transform.scaleZ[eid] = scale[2];
  }

  /** Get Transform as array tuple. */
  getTransform(eid: number): {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  } | null {
    if (!hasComponent(this.world, Transform, eid)) return null;
    return {
      position: [
        Transform.positionX[eid],
        Transform.positionY[eid],
        Transform.positionZ[eid],
      ],
      rotation: [
        Transform.rotationX[eid],
        Transform.rotationY[eid],
        Transform.rotationZ[eid],
      ],
      scale: [
        Transform.scaleX[eid],
        Transform.scaleY[eid],
        Transform.scaleZ[eid],
      ],
    };
  }

  /** Set Transform position. */
  setPosition(eid: number, pos: [number, number, number]): void {
    if (!hasComponent(this.world, Transform, eid)) return;
    Transform.positionX[eid] = pos[0];
    Transform.positionY[eid] = pos[1];
    Transform.positionZ[eid] = pos[2];
  }

  /** Add Velocity component. */
  addVelocity(eid: number, vel: [number, number, number] = [0, 0, 0]): void {
    addComponent(this.world, Velocity, eid);
    Velocity.x[eid] = vel[0];
    Velocity.y[eid] = vel[1];
    Velocity.z[eid] = vel[2];
  }

  /** Get Velocity. */
  getVelocity(eid: number): [number, number, number] | null {
    if (!hasComponent(this.world, Velocity, eid)) return null;
    return [Velocity.x[eid], Velocity.y[eid], Velocity.z[eid]];
  }

  /** Set Velocity. */
  setVelocity(eid: number, vel: [number, number, number]): void {
    if (!hasComponent(this.world, Velocity, eid)) return;
    Velocity.x[eid] = vel[0];
    Velocity.y[eid] = vel[1];
    Velocity.z[eid] = vel[2];
  }

  // ─── Systems ────────────────────────────────────────────────────────────

  /**
   * Run a system function on all matching entities.
   * Systems should be pure functions that iterate over query results.
   */
  runSystem(queryFn: (world: IWorld) => number[], systemFn: (eid: number, dt: number) => void, dt: number): void {
    const entities = queryFn(this.world);
    for (let i = 0; i < entities.length; i++) {
      systemFn(entities[i], dt);
    }
  }

  // ─── Utility ────────────────────────────────────────────────────────────

  /** Get the underlying bitECS world. */
  getRawWorld(): IWorld {
    return this.world;
  }

  /** Reset the world (clear all entities). */
  clear(): void {
    // BitECS doesn't have a built-in clear, so we manually remove all entities
    // This is a simple approach; in production you might want to track all eids
    for (const eid of this.entityNames.keys()) {
      removeEntity(this.world, eid);
    }
    this.entityNames.clear();
    this.entityParents.clear();
    this.entityChildren.clear();
  }
}

// ─── Example Systems ─────────────────────────────────────────────────────────

/** Simple movement system that applies velocity to position. */
export function movementSystem(eid: number, dt: number): void {
  Transform.positionX[eid] += Velocity.x[eid] * dt;
  Transform.positionY[eid] += Velocity.y[eid] * dt;
  Transform.positionZ[eid] += Velocity.z[eid] * dt;
}

/** Example usage:
 * const world = new BitECSWorld();
 * const player = world.createEntity('Player');
 * world.addTransform(player, [0, 0, 0]);
 * world.addVelocity(player, [1, 0, 0]);
 *
 * // In game loop:
 * world.runSystem(movingObjectsQuery, movementSystem, deltaTime);
 */
