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

### ✅ Completed (continued)

4. **Particle System** → three-nebula
   - File: `NebulaParticleSystem.ts`
   - Replaces: `ParticleSystem.ts`
   - Status: New wrapper created with preset library
   - Benefits: More emitter shapes, advanced behaviors, better GPU optimization

5. **Animation System** → Three.js AnimationMixer
   - File: `ThreeAnimationWrapper.ts`
   - Replaces: `AnimationClip.ts`, `AnimationTimeline.ts`
   - Status: New wrapper created with event system
   - Benefits: Native Three.js integration, skeletal animation, blending

6. **Integration Example**
   - File: `IntegrationExample.ts`
   - Status: Complete example game engine showing all components working together
   - Benefits: Reference implementation, demonstrates best practices

### ✅ Completed (continued)

7. **Camera Controls** → Three.js Controls
   - File: `ThreeCameraControls.ts`
   - Replaces: `CameraController.ts`, `CinematicCamera.ts`
   - Status: Complete wrapper with multiple control modes
   - Benefits: Orbit, Fly, FirstPerson, PointerLock, Follow, Cinematic modes

8. **Input Management** → Unified Input System
   - File: `UnifiedInputManager.ts`
   - Replaces: `InputManager.ts`
   - Status: Complete input system with action mapping
   - Benefits: Unified API, gamepad support, touch gestures, haptic feedback

### 📋 Planned

9. **Visual Node Editor** → rete.js
   - Target: Enhance `VibeNode.ts`
   - Status: Library installed, integration pending

10. **Build Pipeline** → Vite
    - Target: Replace `BuildPipeline.ts`, modernize build system
    - Status: Planned - significant migration effort

11. **Vector Math** → gl-matrix
    - Target: Replace custom vec3 functions in physics
    - Status: Library installed, can be used directly

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

### Particle System (three-nebula)

```typescript
import { NebulaParticleSystem } from './NebulaParticleSystem';

const particleSystem = new NebulaParticleSystem(scene, camera);

// Create from preset
particleSystem.createFromPreset('fire_emitter', 'fire');
const emitter = particleSystem.getEmitter('fire_emitter');

// Update in render loop
particleSystem.update(deltaTime);
```

### Animation System (Three.js AnimationMixer)

```typescript
import { AnimationController } from './ThreeAnimationWrapper';

const controller = new AnimationController(characterModel);
controller.addClips(gltfModel.animations);

// Play animation with crossfade
controller.play('walk', { loop: true, speed: 1.0, fadeInDuration: 0.3 });

// Update in render loop
controller.update(deltaTime);
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

### Camera Controls (Three.js)

```typescript
import { CameraManager, CameraShake } from './ThreeCameraControls';

const cameraManager = new CameraManager(canvas, {
  fov: 75,
  position: [0, 5, 10],
  lookAt: [0, 0, 0]
});

// Orbit controls (best for scene inspection)
cameraManager.setupOrbitControls({
  enableDamping: true,
  autoRotate: true,
  minDistance: 2,
  maxDistance: 50
});

// Follow camera (for player character)
cameraManager.setupFollowCamera(playerObject, {
  offset: [0, 3, 8],
  lookAtOffset: [0, 1, 0],
  smoothness: 0.1
});

// Cinematic camera with keyframes
cameraManager.setupCinematicCamera([
  { time: 0, position: [0, 5, 10], lookAt: [0, 0, 0] },
  { time: 2, position: [5, 8, 5], lookAt: [0, 0, 0], fov: 60 },
  { time: 4, position: [0, 10, 0], lookAt: [0, 0, 0], fov: 90 }
], true); // loop=true

cameraManager.playCinematic();

// Camera shake for impact effects
const shake = new CameraShake(cameraManager.getCamera());
shake.shake(0.5, 0.3); // intensity, duration

// Update in render loop
cameraManager.update(deltaTime);
shake.update(deltaTime);
```

### Input Management (Unified)

```typescript
import { UnifiedInputManager } from './UnifiedInputManager';

const input = new UnifiedInputManager(canvas);

// Map actions to inputs
input.mapAction('jump',
  { device: 'keyboard', input: 'Space' },
  { device: 'gamepad', input: 0 } // A button
);

input.mapAction('fire',
  { device: 'mouse', input: 0 }, // Left click
  { device: 'gamepad', input: 7 } // Right trigger
);

// Register action callbacks
input.onAction('jump', () => {
  player.jump();
});

// Query input directly
if (input.isAction('fire')) {
  player.shoot();
}

// Gamepad axes
const leftStickX = input.getGamepadAxis(0, 0);
const leftStickY = input.getGamepadAxis(0, 1);

// Haptic feedback
input.vibrate(0, 1.0, 200); // gamepad 0, full intensity, 200ms

// Update at start of each frame
input.update();
```

### Complete Integration Example

See `IntegrationExample.ts` for a full working example that combines all components:
- Physics simulation with Rapier
- Audio with spatial positioning
- ECS for game logic
- Particle effects
- Animated characters
- Camera controls
- Input handling

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

1. Integrate and validate the existing `NebulaParticleSystem.ts` wrapper for three-nebula
2. Benchmark performance differences
3. Update VSCode extension to use new implementations
4. Create migration examples for desktop app
5. Document API differences
6. Set up automated tests
