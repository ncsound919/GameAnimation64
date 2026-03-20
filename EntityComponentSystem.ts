/**
 * EntityComponentSystem.ts
 * Lightweight ECS (Entity Component System) for Pyrite64's vibe coding engine.
 *
 * Separates data (components) from behavior (systems), enabling:
 *  - Flexible object composition over rigid inheritance
 *  - Efficient batch processing of similar entities
 *  - Hot-reloading of components during development
 *  - Mix-and-match behaviors like building with Lego blocks
 *
 * Design file reference: Component #1 — Scene Graph & ECS
 */

// ─── Component ────────────────────────────────────────────────────────────────

/** Base interface for all ECS components. */
export interface Component {
  /** Unique component type identifier (e.g. 'transform', 'sprite', 'physics'). */
  readonly type: string;
}

/** Transform component — position, rotation, scale in engine coordinates. */
export interface TransformComponent extends Component {
  type: 'transform';
  position: [number, number, number];
  rotation: [number, number, number];
  scale:    [number, number, number];
}

/** Sprite component for 2D rendering. */
export interface SpriteComponent extends Component {
  type: 'sprite';
  textureId: string;
  width:     number;
  height:    number;
  frameIndex: number;
  flipX:     boolean;
  flipY:     boolean;
}

/** Mesh component for 3D rendering. */
export interface MeshComponent extends Component {
  type: 'mesh';
  modelId:    string;
  materialId: string;
  castShadow: boolean;
  visible:    boolean;
}

/** Rigid body component for physics simulation. */
export interface RigidBodyComponent extends Component {
  type: 'rigidbody';
  mass:        number;
  velocity:    [number, number, number];
  angularVel:  [number, number, number];
  friction:    number;
  restitution: number;
  isKinematic: boolean;
}

/** Collider component for collision detection. */
export interface ColliderComponent extends Component {
  type: 'collider';
  shape:  'box' | 'sphere' | 'capsule' | 'mesh';
  size:   [number, number, number];
  offset: [number, number, number];
  isTrigger: boolean;
  layer:  number;
}

/** Script component to attach behavior logic. */
export interface ScriptComponent extends Component {
  type: 'script';
  scriptId: string;
  properties: Record<string, unknown>;
}

/** Audio source component for spatial sound. */
export interface AudioSourceComponent extends Component {
  type: 'audiosource';
  clipId:    string;
  volume:    number;
  pitch:     number;
  loop:      boolean;
  spatial:   boolean;
  maxDistance: number;
}

/** Tag component — zero-data marker for queries. */
export interface TagComponent extends Component {
  type: 'tag';
  tags: string[];
}

/** Camera component for in-game cameras. */
export interface CameraComponent extends Component {
  type: 'camera';
  fov:        number;
  near:       number;
  far:        number;
  isActive:   boolean;
  projection: 'perspective' | 'orthographic';
}

/** Light component for scene lighting. */
export interface LightComponent extends Component {
  type: 'light';
  lightType: 'directional' | 'point' | 'spot' | 'ambient';
  color:     [number, number, number];
  intensity: number;
  range:     number;
}

/** Particle emitter component. */
export interface ParticleEmitterComponent extends Component {
  type: 'particleemitter';
  presetId:      string;
  emissionRate:  number;
  maxParticles:  number;
  autoPlay:      boolean;
}

// ─── Component Registry ──────────────────────────────────────────────────────

export type ComponentType = Component['type'];
export type ComponentMap = Map<string, Component>;

// ─── Entity ──────────────────────────────────────────────────────────────────

/** Unique entity identifier. */
export type EntityId = number;

export interface Entity {
  readonly id:   EntityId;
  name:          string;
  active:        boolean;
  parent:        EntityId | null;
  children:      EntityId[];
  components:    ComponentMap;
}

// ─── System ──────────────────────────────────────────────────────────────────

/**
 * A System processes entities that have a specific set of components.
 * Systems are executed in priority order each frame.
 */
export interface System {
  /** Unique system name. */
  readonly name: string;
  /** Execution priority (lower = earlier). */
  readonly priority: number;
  /** Component types this system requires an entity to have. */
  readonly requiredComponents: string[];
  /** Whether this system is enabled. */
  enabled: boolean;
  /** Called once when the system is registered. */
  init?(world: World): void;
  /** Called each frame with matching entities and delta time. */
  update(entities: Entity[], dt: number, world: World): void;
  /** Called when the system is removed. */
  destroy?(): void;
}

// ─── Query ───────────────────────────────────────────────────────────────────

/** Query descriptor for filtering entities by components. */
export interface Query {
  /** All of these component types must be present. */
  all?:  string[];
  /** At least one of these component types must be present. */
  any?:  string[];
  /** None of these component types may be present. */
  none?: string[];
}

// ─── World ───────────────────────────────────────────────────────────────────

/**
 * The World is the top-level ECS container.
 * It owns all entities, components, and systems.
 */
export class World {
  private nextEntityId: EntityId = 1;
  private entities:  Map<EntityId, Entity> = new Map();
  private systems:   System[] = [];
  private listeners: Map<string, Array<(data: any) => void>> = new Map();

  // ─── Entity Management ──────────────────────────────────────────────────

  /** Create a new entity and return its ID. */
  createEntity(name = 'Entity'): EntityId {
    const id = this.nextEntityId++;
    const entity: Entity = {
      id,
      name,
      active: true,
      parent: null,
      children: [],
      components: new Map(),
    };
    this.entities.set(id, entity);
    this.emit('entity:created', { entityId: id, name });
    return id;
  }

  /** Remove an entity and all its children recursively. */
  destroyEntity(id: EntityId): void {
    const entity = this.entities.get(id);
    if (!entity) return;

    // Destroy children first
    for (const childId of [...entity.children]) {
      this.destroyEntity(childId);
    }

    // Remove from parent
    if (entity.parent !== null) {
      const parent = this.entities.get(entity.parent);
      if (parent) {
        parent.children = parent.children.filter(c => c !== id);
      }
    }

    this.entities.delete(id);
    this.emit('entity:destroyed', { entityId: id });
  }

  /** Get an entity by ID, or undefined if it doesn't exist. */
  getEntity(id: EntityId): Entity | undefined {
    return this.entities.get(id);
  }

  /** Get all entities (active and inactive). */
  getAllEntities(): Entity[] {
    return [...this.entities.values()];
  }

  /** Set a parent-child relationship between entities. */
  setParent(childId: EntityId, parentId: EntityId | null): void {
    const child = this.entities.get(childId);
    if (!child) return;

    // Remove from old parent
    if (child.parent !== null) {
      const oldParent = this.entities.get(child.parent);
      if (oldParent) {
        oldParent.children = oldParent.children.filter(c => c !== childId);
      }
    }

    child.parent = parentId;

    // Add to new parent
    if (parentId !== null) {
      const newParent = this.entities.get(parentId);
      if (newParent && !newParent.children.includes(childId)) {
        newParent.children.push(childId);
      }
    }
  }

  // ─── Component Management ───────────────────────────────────────────────

  /** Add a component to an entity. Replaces existing component of same type. */
  addComponent(entityId: EntityId, component: Component): void {
    const entity = this.entities.get(entityId);
    if (!entity) return;
    entity.components.set(component.type, component);
    this.emit('component:added', { entityId, componentType: component.type });
  }

  /** Remove a component from an entity by type. */
  removeComponent(entityId: EntityId, componentType: string): void {
    const entity = this.entities.get(entityId);
    if (!entity) return;
    entity.components.delete(componentType);
    this.emit('component:removed', { entityId, componentType });
  }

  /** Get a component from an entity by type. */
  getComponent<T extends Component>(entityId: EntityId, componentType: string): T | undefined {
    const entity = this.entities.get(entityId);
    if (!entity) return undefined;
    return entity.components.get(componentType) as T | undefined;
  }

  /** Check if an entity has a specific component type. */
  hasComponent(entityId: EntityId, componentType: string): boolean {
    const entity = this.entities.get(entityId);
    if (!entity) return false;
    return entity.components.has(componentType);
  }

  // ─── Queries ────────────────────────────────────────────────────────────

  /** Query entities matching a set of component requirements. */
  query(q: Query): Entity[] {
    const results: Entity[] = [];
    for (const entity of this.entities.values()) {
      if (!entity.active) continue;
      if (q.all && !q.all.every(t => entity.components.has(t))) continue;
      if (q.any && !q.any.some(t => entity.components.has(t))) continue;
      if (q.none && q.none.some(t => entity.components.has(t))) continue;
      results.push(entity);
    }
    return results;
  }

  /** Shorthand: get all entities with a specific component. */
  entitiesWith(...types: string[]): Entity[] {
    return this.query({ all: types });
  }

  // ─── System Management ──────────────────────────────────────────────────

  /** Register a system. Systems are sorted by priority. */
  addSystem(system: System): void {
    this.systems.push(system);
    this.systems.sort((a, b) => a.priority - b.priority);
    system.init?.(this);
    this.emit('system:added', { systemName: system.name });
  }

  /** Remove a system by name. */
  removeSystem(name: string): void {
    const idx = this.systems.findIndex(s => s.name === name);
    if (idx === -1) return;
    this.systems[idx].destroy?.();
    this.systems.splice(idx, 1);
    this.emit('system:removed', { systemName: name });
  }

  /** Get a system by name. */
  getSystem(name: string): System | undefined {
    return this.systems.find(s => s.name === name);
  }

  /** Execute all enabled systems for one frame. */
  update(dt: number): void {
    for (const system of this.systems) {
      if (!system.enabled) continue;
      const matching = this.query({ all: system.requiredComponents });
      system.update(matching, dt, this);
    }
  }

  // ─── Events ─────────────────────────────────────────────────────────────

  /** Subscribe to an ECS event. */
  on(event: string, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(callback);
  }

  /** Unsubscribe from an event. */
  off(event: string, callback: (data: any) => void): void {
    const cbs = this.listeners.get(event);
    if (!cbs) return;
    const idx = cbs.indexOf(callback);
    if (idx !== -1) cbs.splice(idx, 1);
  }

  /** Emit an event to all listeners. */
  private emit(event: string, data: any): void {
    const cbs = this.listeners.get(event);
    if (cbs) {
      for (const cb of cbs) cb(data);
    }
  }

  // ─── Serialization ─────────────────────────────────────────────────────

  /** Serialize the world to a plain JSON object. */
  serialize(): object {
    const out: any[] = [];
    for (const entity of this.entities.values()) {
      const components: Record<string, any> = {};
      for (const [type, comp] of entity.components) {
        components[type] = { ...comp };
      }
      out.push({
        id: entity.id,
        name: entity.name,
        active: entity.active,
        parent: entity.parent,
        children: [...entity.children],
        components,
      });
    }
    return { entities: out, nextId: this.nextEntityId };
  }

  /** Restore world state from a serialized object. */
  deserialize(data: { entities: any[]; nextId: number }): void {
    this.entities.clear();
    this.nextEntityId = data.nextId;
    for (const entry of data.entities) {
      const components: ComponentMap = new Map();
      for (const [type, comp] of Object.entries(entry.components)) {
        components.set(type, comp as Component);
      }
      this.entities.set(entry.id, {
        id: entry.id,
        name: entry.name,
        active: entry.active,
        parent: entry.parent,
        children: [...entry.children],
        components,
      });
    }
  }

  /** Reset the world — destroy all entities and remove all systems. */
  reset(): void {
    for (const system of this.systems) system.destroy?.();
    this.systems = [];
    this.entities.clear();
    this.nextEntityId = 1;
    this.listeners.clear();
  }
}

// ─── Factory Helpers ─────────────────────────────────────────────────────────

/** Create a default TransformComponent. */
export function createTransform(
  position: [number, number, number] = [0, 0, 0],
  rotation: [number, number, number] = [0, 0, 0],
  scale:    [number, number, number] = [1, 1, 1],
): TransformComponent {
  return { type: 'transform', position, rotation, scale };
}

/** Create a default MeshComponent. */
export function createMesh(modelId: string, materialId = 'default'): MeshComponent {
  return { type: 'mesh', modelId, materialId, castShadow: true, visible: true };
}

/** Create a default RigidBodyComponent. */
export function createRigidBody(mass = 1.0): RigidBodyComponent {
  return {
    type: 'rigidbody',
    mass,
    velocity: [0, 0, 0],
    angularVel: [0, 0, 0],
    friction: 0.5,
    restitution: 0.3,
    isKinematic: false,
  };
}

/** Create a default ColliderComponent. */
export function createCollider(
  shape: ColliderComponent['shape'] = 'box',
  size: [number, number, number] = [1, 1, 1],
): ColliderComponent {
  return { type: 'collider', shape, size, offset: [0, 0, 0], isTrigger: false, layer: 0 };
}

/** Create a TagComponent. */
export function createTag(...tags: string[]): TagComponent {
  return { type: 'tag', tags };
}

/** Create a ScriptComponent. */
export function createScript(scriptId: string, properties: Record<string, unknown> = {}): ScriptComponent {
  return { type: 'script', scriptId, properties };
}
