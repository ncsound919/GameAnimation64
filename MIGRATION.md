# Migration to Open Source Components

This document tracks the migration from custom hand-coded components to established open-source libraries in the Pyrite64/GameAnimation64 engine.

## Migration Status

### ✅ Completed

1. **Physics Engine** → Rapier3D
   - File: `RapierPhysicsEngine.ts`
   - Replaces: `GamePhysicsEngine.ts`
   - Status: New wrapper created
   - Benefits: WASM performance, production-ready, CCD support

2. **Audio Engine** → Howler.js
   - File: `HowlerAudioEngine.ts`
   - Replaces: `AudioEngine.ts`
   - Status: New wrapper created
   - Benefits: Cross-browser, spatial audio, adaptive music support

3. **Entity Component System** → bitECS
   - File: `BitECSWrapper.ts`
   - Replaces: `EntityComponentSystem.ts`
   - Status: New wrapper created
   - Benefits: Cache-friendly typed arrays, extreme performance

### 🚧 In Progress

4. **Particle System** → three-nebula
   - Target: Replace `ParticleSystem.ts`
   - Status: Library installed, wrapper needed

5. **Animation System** → Three.js AnimationMixer
   - Target: Replace `AnimationClip.ts`, `AnimationTimeline.ts`
   - Status: Need to create wrapper

### 📋 Planned

6. **Visual Node Editor** → rete.js
   - Target: Enhance `VibeNode.ts`
   - Status: Library installed

7. **Camera Controls** → Three.js Controls
   - Target: Replace `CameraController.ts`, `CinematicCamera.ts`

8. **Input Management** → gamepad.js + keymaster
   - Target: Replace `InputManager.ts`

9. **Build Pipeline** → Vite
   - Target: Replace `BuildPipeline.ts`, modernize build system

10. **Vector Math** → gl-matrix
    - Target: Replace custom vec3 functions in physics
    - Status: Library installed

## Usage Examples

### Physics (Rapier)

```typescript
import { RapierPhysicsWorld } from './RapierPhysicsEngine';

// Initialize physics world
const physics = new RapierPhysicsWorld({
  gravity: [0, -9.81, 0],
  fixedStep: 1/60
});

await physics.init(); // Must call before use

// Create a dynamic sphere
const sphereHandle = physics.createBody(
  [0, 10, 0], // position
  { mass: 1.0, friction: 0.5, restitution: 0.8 },
  { type: 'sphere', radius: 1.0 }
);

// Update in game loop
physics.step(deltaTime);
const position = physics.getPosition(sphereHandle);
```

### Audio (Howler)

```typescript
import { HowlerAudioEngine } from './HowlerAudioEngine';

const audio = new HowlerAudioEngine();

// Register audio clips
audio.registerClip({
  id: 'bgm_level1',
  url: ['audio/bgm.mp3', 'audio/bgm.ogg'],
  volume: 0.7,
  loop: true,
  spatial: false,
  pool: 1
});

// Play background music
audio.loadMusicLayer({
  id: 'main_theme',
  url: 'audio/theme.mp3',
  volume: 0.8,
  loop: true,
  fadeTime: 2000
});
audio.playMusicLayer('main_theme', 2000);

// Play 3D positioned sound effect
audio.playSpatialSFX('explosion', [10, 0, 5], 1.0, 1.0);

// Update listener position (camera/player)
audio.setListenerPosition([playerX, playerY, playerZ]);
```

### ECS (bitECS)

```typescript
import { BitECSWorld, movingObjectsQuery, movementSystem } from './BitECSWrapper';

const world = new BitECSWorld();

// Create entity with components
const player = world.createEntity('Player');
world.addTransform(player, [0, 0, 0]);
world.addVelocity(player, [1, 0, 0]);

// Run systems in game loop
world.runSystem(movingObjectsQuery, movementSystem, deltaTime);

// Access component data
const transform = world.getTransform(player);
console.log('Player position:', transform.position);
```

## Migration Strategy

### Phase 1: Parallel Implementation (Current)
- New wrapper files coexist with old implementations
- No breaking changes to existing code
- Allows gradual testing and validation

### Phase 2: Adapter Layer
- Create compatibility adapters for old API
- Update high-traffic call sites
- Maintain backward compatibility

### Phase 3: Deprecation
- Mark old implementations as deprecated
- Add console warnings
- Update documentation

### Phase 4: Removal
- Remove deprecated implementations
- Clean up unused code
- Update all references

## Benefits Achieved

1. **Performance**: WASM physics, typed array ECS, optimized audio
2. **Maintenance**: Less custom code to maintain
3. **Features**: Access to advanced features (CCD, spatial audio, etc.)
4. **Stability**: Battle-tested libraries with extensive test coverage
5. **Community**: Active development, bug fixes, security updates
6. **Documentation**: Rich ecosystem of tutorials and examples

## Breaking Changes

### None Yet
All new implementations are additive and don't break existing code.

### Planned (Phase 3+)
- `GamePhysicsEngine.PhysicsWorld` → `RapierPhysicsWorld`
- `AudioEngine` → `HowlerAudioEngine`
- `EntityComponentSystem.World` → `BitECSWorld`

## Testing Checklist

- [ ] Physics: Collision detection accuracy
- [ ] Physics: Raycast functionality
- [ ] Physics: Performance benchmarks
- [ ] Audio: Spatial positioning accuracy
- [ ] Audio: Cross-browser compatibility
- [ ] Audio: Mobile unlock behavior
- [ ] ECS: Query performance
- [ ] ECS: Component add/remove operations
- [ ] ECS: Memory usage comparison

## Performance Metrics

### Before Migration
- ECS iteration: ~X ms for 10k entities
- Physics step: ~Y ms for 1k bodies
- Audio sources: Z concurrent sounds

### After Migration (Target)
- ECS iteration: <X/2 ms (bitECS typed arrays)
- Physics step: <Y/2 ms (Rapier WASM)
- Audio sources: Unlimited (Howler pooling)

## Next Steps

1. Create particle system wrapper for three-nebula
2. Benchmark performance differences
3. Update VSCode extension to use new implementations
4. Create migration examples for desktop app
5. Document API differences
6. Set up automated tests
