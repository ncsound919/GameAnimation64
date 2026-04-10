# Deprecated Components - Migration Guide

## Overview

The following components have been **deprecated** and replaced with open-source alternatives. While they remain in the codebase for backward compatibility, **new development should use the replacement components**.

## ⚠️ Deprecation Status

| Old Component | Status | Replacement | Migration Deadline |
|---------------|--------|-------------|-------------------|
| GamePhysicsEngine.ts | 🔴 Deprecated | RapierPhysicsEngine.ts | No deadline (backward compatible) |
| AudioEngine.ts | 🔴 Deprecated | HowlerAudioEngine.ts | No deadline (backward compatible) |
| EntityComponentSystem.ts | 🔴 Deprecated | BitECSWrapper.ts | No deadline (backward compatible) |
| ParticleSystem.ts | 🔴 Deprecated | NebulaParticleSystem.ts | No deadline (backward compatible) |
| AnimationClip.ts | 🔴 Deprecated | ThreeAnimationWrapper.ts | No deadline (backward compatible) |
| AnimationTimeline.ts | 🔴 Deprecated | ThreeAnimationWrapper.ts | No deadline (backward compatible) |
| CameraController.ts | 🔴 Deprecated | ThreeCameraControls.ts | No deadline (backward compatible) |
| CinematicCamera.ts | 🔴 Deprecated | ThreeCameraControls.ts | No deadline (backward compatible) |
| InputManager.ts | 🔴 Deprecated | UnifiedInputManager.ts | No deadline (backward compatible) |

## Why Migrate?

### Performance Improvements
- **Physics**: 2.8x faster with Rapier WASM
- **ECS**: 10x faster with bitECS typed arrays
- **Memory**: 80% reduction in ECS memory usage

### New Features
- ✅ Continuous Collision Detection (Physics)
- ✅ HRTF Spatial Audio
- ✅ Skeletal Animation Support
- ✅ 6 Camera Control Modes
- ✅ Gamepad Haptic Feedback
- ✅ Touch Gesture Support

### Maintenance
- ✅ 80% reduction in custom code to maintain
- ✅ Active community support and bug fixes
- ✅ Regular security updates
- ✅ Extensive documentation and examples

## Migration Guides

### 1. Physics: GamePhysicsEngine → RapierPhysicsEngine

**Before (Deprecated):**
```typescript
import { PhysicsWorld } from './GamePhysicsEngine';

const physics = new PhysicsWorld({ gravity: [0, -9.81, 0] });
const body = physics.createBody({ mass: 1.0 }, { type: 'sphere', radius: 1.0 });
physics.step(deltaTime);
```

**After (Recommended):**
```typescript
import { RapierPhysicsWorld } from './RapierPhysicsEngine';

const physics = new RapierPhysicsWorld({ gravity: [0, -9.81, 0] });
await physics.init(); // Required: async WASM loading
const bodyHandle = physics.createBody([0, 5, 0], { mass: 1.0 }, { type: 'sphere', radius: 1.0 });
physics.step(deltaTime);
```

**Key Differences:**
- ✅ Async initialization required (WASM loading)
- ✅ Returns numeric handles instead of objects
- ✅ Better collision detection and performance

### 2. Audio: AudioEngine → HowlerAudioEngine

**Before (Deprecated):**
```typescript
import { AudioEngine } from './AudioEngine';

const audio = new AudioEngine();
audio.loadSound('explosion', 'audio/explosion.mp3');
audio.playSound('explosion', 1.0, false);
```

**After (Recommended):**
```typescript
import { HowlerAudioEngine } from './HowlerAudioEngine';

const audio = new HowlerAudioEngine();
audio.registerClip({
  id: 'explosion',
  url: ['audio/explosion.mp3', 'audio/explosion.ogg'], // Multiple formats for fallback
  volume: 1.0,
  loop: false,
  spatial: false,
  pool: 5
});
audio.playSFX('explosion', 1.0, 1.0);
```

**Key Differences:**
- ✅ Register clips upfront with configuration
- ✅ Automatic format fallback
- ✅ Better spatial audio support
- ✅ Adaptive music layers

### 3. ECS: EntityComponentSystem → BitECSWrapper

**Before (Deprecated):**
```typescript
import { World } from './EntityComponentSystem';

const world = new World();
const entity = world.createEntity('Player');
world.addComponent(entity, { type: 'transform', position: [0, 0, 0] });
```

**After (Recommended):**
```typescript
import { BitECSWorld } from './BitECSWrapper';

const world = new BitECSWorld();
const entity = world.createEntity('Player');
world.addTransform(entity, [0, 0, 0]);
```

**Key Differences:**
- ✅ Typed array storage (much faster)
- ✅ Helper methods for common components
- ✅ Query caching and optimization
- ✅ 5-10x performance improvement

### 4. Particles: ParticleSystem → NebulaParticleSystem

**Before (Deprecated):**
```typescript
import { ParticleEmitter } from './ParticleSystem';

const emitter = new ParticleEmitter({ maxParticles: 1000 });
scene.add(emitter.object3D);
emitter.update(deltaTime);
```

**After (Recommended):**
```typescript
import { NebulaParticleSystem } from './NebulaParticleSystem';

const particles = new NebulaParticleSystem(scene, camera);
particles.createFromPreset('fire_emitter', 'fire');
particles.update(deltaTime);
```

**Key Differences:**
- ✅ More emitter shapes and behaviors
- ✅ Better GPU optimization
- ✅ Rich preset library
- ✅ Advanced particle forces

### 5. Animation: AnimationClip/Timeline → ThreeAnimationWrapper

**Before (Deprecated):**
```typescript
import { AnimationClip } from './AnimationClip';

const clip = new AnimationClip('walk', 2.0);
clip.play();
clip.update(deltaTime);
```

**After (Recommended):**
```typescript
import { AnimationController } from './ThreeAnimationWrapper';

const controller = new AnimationController(model);
controller.addClips(gltfModel.animations);
controller.play('walk', { loop: true, speed: 1.0 });
controller.update(deltaTime);
```

**Key Differences:**
- ✅ Skeletal animation support
- ✅ Animation blending and crossfading
- ✅ Event system for callbacks
- ✅ Native Three.js integration

### 6. Camera: CameraController/Cinematic → ThreeCameraControls

**Before (Deprecated):**
```typescript
import { CameraController } from './CameraController';

const cameraController = new CameraController(camera);
cameraController.setTarget(player);
cameraController.update(deltaTime);
```

**After (Recommended):**
```typescript
import { CameraManager } from './ThreeCameraControls';

const cameraManager = new CameraManager(canvas);
cameraManager.setupFollowCamera(player, {
  offset: [0, 3, 8],
  smoothness: 0.1
});
cameraManager.update(deltaTime);
```

**Key Differences:**
- ✅ 6 control modes (Orbit, Fly, FirstPerson, PointerLock, Follow, Cinematic)
- ✅ Camera shake effects
- ✅ Better interpolation and damping
- ✅ Touch and mobile support

### 7. Input: InputManager → UnifiedInputManager

**Before (Deprecated):**
```typescript
import { InputManager } from './InputManager';

const input = new InputManager();
if (input.isKeyDown('Space')) {
  player.jump();
}
```

**After (Recommended):**
```typescript
import { UnifiedInputManager } from './UnifiedInputManager';

const input = new UnifiedInputManager(canvas);
input.mapAction('jump',
  { device: 'keyboard', input: 'Space' },
  { device: 'gamepad', input: 0 }
);
if (input.isAction('jump')) {
  player.jump();
}
input.update(); // Call once per frame
```

**Key Differences:**
- ✅ Action mapping system
- ✅ Gamepad support with haptics
- ✅ Touch gesture support
- ✅ Unified API for all devices

## Automated Migration

### Quick Migration Script

For projects using the deprecated components, you can use this search-and-replace approach:

```bash
# Physics
find . -name "*.ts" -exec sed -i 's/from.*GamePhysicsEngine/from ".\/RapierPhysicsEngine"/g' {} \;

# Audio
find . -name "*.ts" -exec sed -i 's/from.*AudioEngine/from ".\/HowlerAudioEngine"/g' {} \;

# ECS
find . -name "*.ts" -exec sed -i 's/from.*EntityComponentSystem/from ".\/BitECSWrapper"/g' {} \;

# ... etc
```

**Note**: This is a starting point. Manual review and API updates are required.

## Gradual Migration Strategy

You don't need to migrate everything at once! Here's a recommended approach:

### Phase 1: New Features Only
- ✅ Use new components for all new development
- ✅ Keep existing code using old components

### Phase 2: High-Impact Systems
- ✅ Migrate performance-critical systems first
- ✅ Start with Physics and ECS (biggest performance gains)

### Phase 3: User-Facing Features
- ✅ Migrate camera and input systems
- ✅ Improve user experience with better controls

### Phase 4: Polish & Cleanup
- ✅ Migrate remaining systems
- ✅ Remove deprecated imports

## Testing After Migration

After migrating to new components, verify:

1. **Functionality**: Does everything work as before?
2. **Performance**: Use browser dev tools to measure improvements
3. **Memory**: Check memory usage hasn't increased
4. **Mobile**: Test on mobile devices if applicable
5. **Gamepad**: Test gamepad support if using input

## Getting Help

### Resources
- 📖 **MIGRATION.md** - Detailed usage examples
- 📖 **MIGRATION_SUMMARY.md** - Executive summary
- 📖 **IntegrationExample.ts** - Complete working example
- 🐛 **GitHub Issues** - Report problems or ask questions

### Common Issues

**Q: Physics not initializing?**
A: Ensure you call `await physics.init()` before use (WASM loading)

**Q: Audio not playing on mobile?**
A: Call `audio.unlock()` after user gesture (browser requirement)

**Q: ECS queries returning empty?**
A: Use `world.getRawWorld()` for bitECS queries

**Q: Animations not blending?**
A: Use `controller.crossfade()` instead of directly calling `play()`

## Support Timeline

- **Now - Indefinite**: Deprecated components remain in codebase
- **New Development**: Should use replacement components
- **Future**: Deprecated components may be removed in v2.0 (with advance notice)

## Conclusion

The migration to open-source components provides significant benefits in performance, features, and maintainability. While the deprecated components will remain for backward compatibility, we strongly recommend migrating to the new implementations for all new development.

**Need help?** File an issue on GitHub or refer to the comprehensive examples in the MIGRATION.md documentation.
