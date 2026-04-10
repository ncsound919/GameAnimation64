/**
 * ThreeAnimationWrapper.ts
 * Animation system wrapper using Three.js AnimationMixer for Pyrite64.
 *
 * Replaces the custom AnimationClip.ts and AnimationTimeline.ts with
 * Three.js's built-in animation system, which is production-tested
 * and optimized for WebGL rendering.
 *
 * Benefits over custom implementation:
 *  - Native integration with Three.js scene graph
 *  - Skeletal animation support
 *  - Animation blending and crossfading
 *  - Morph target animations
 *  - Timeline and keyframe interpolation
 *  - Memory-efficient clip sharing
 *
 * Design file reference: Component #8 — Animation & Timeline System
 */

import * as THREE from 'three';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnimationConfig {
  name: string;
  duration: number;
  loop: boolean;
  speed: number;
  weight: number;
  fadeInDuration?: number;
  fadeOutDuration?: number;
}

export interface AnimationEventConfig {
  time: number;
  callback: () => void;
}

// ─── Animation Controller ────────────────────────────────────────────────────

/**
 * Wrapper around Three.js AnimationMixer for easier animation management.
 */
export class AnimationController {
  private mixer: THREE.AnimationMixer;
  private actions: Map<string, THREE.AnimationAction> = new Map();
  private clips: Map<string, THREE.AnimationClip> = new Map();
  private currentAction: THREE.AnimationAction | null = null;
  private object: THREE.Object3D;
  private eventListeners: Map<string, AnimationEventConfig[]> = new Map();

  constructor(object: THREE.Object3D) {
    this.object = object;
    this.mixer = new THREE.AnimationMixer(object);
  }

  // ─── Clip Management ─────────────────────────────────────────────────────

  /**
   * Register an animation clip.
   */
  addClip(clip: THREE.AnimationClip): void {
    this.clips.set(clip.name, clip);
    const action = this.mixer.clipAction(clip);
    this.actions.set(clip.name, action);
  }

  /**
   * Register multiple clips at once.
   */
  addClips(clips: THREE.AnimationClip[]): void {
    for (const clip of clips) {
      this.addClip(clip);
    }
  }

  /**
   * Get a registered clip by name.
   */
  getClip(name: string): THREE.AnimationClip | undefined {
    return this.clips.get(name);
  }

  /**
   * Get all registered clip names.
   */
  getClipNames(): string[] {
    return Array.from(this.clips.keys());
  }

  /**
   * Remove a clip.
   */
  removeClip(name: string): void {
    const action = this.actions.get(name);
    if (action) {
      this.mixer.uncacheAction(this.clips.get(name)!);
      this.actions.delete(name);
    }
    this.clips.delete(name);
  }

  // ─── Playback Control ────────────────────────────────────────────────────

  /**
   * Play an animation by name.
   */
  play(
    name: string,
    config: Partial<AnimationConfig> = {}
  ): THREE.AnimationAction | null {
    const action = this.actions.get(name);
    if (!action) {
      console.warn(`Animation "${name}" not found`);
      return null;
    }

    const cfg: AnimationConfig = {
      name,
      duration: action.getClip().duration,
      loop: true,
      speed: 1.0,
      weight: 1.0,
      fadeInDuration: 0,
      fadeOutDuration: 0,
      ...config,
    };

    // Configure action
    action.setEffectiveTimeScale(cfg.speed);
    action.setEffectiveWeight(cfg.weight);
    action.setLoop(
      cfg.loop ? THREE.LoopRepeat : THREE.LoopOnce,
      cfg.loop ? Infinity : 1
    );

    // Crossfade from current action if specified
    if (this.currentAction && this.currentAction !== action) {
      if (cfg.fadeInDuration! > 0) {
        this.currentAction.fadeOut(cfg.fadeOutDuration || cfg.fadeInDuration!);
        action.reset().fadeIn(cfg.fadeInDuration!).play();
      } else {
        this.currentAction.stop();
        action.reset().play();
      }
    } else {
      action.reset().play();
    }

    this.currentAction = action;
    return action;
  }

  /**
   * Stop current animation.
   */
  stop(): void {
    if (this.currentAction) {
      this.currentAction.stop();
      this.currentAction = null;
    }
  }

  /**
   * Pause current animation.
   */
  pause(): void {
    if (this.currentAction) {
      this.currentAction.paused = true;
    }
  }

  /**
   * Resume current animation.
   */
  resume(): void {
    if (this.currentAction) {
      this.currentAction.paused = false;
    }
  }

  /**
   * Crossfade between two animations.
   */
  crossfade(fromName: string, toName: string, duration: number): void {
    const fromAction = this.actions.get(fromName);
    const toAction = this.actions.get(toName);

    if (!fromAction || !toAction) {
      console.warn(`Cannot crossfade: animation not found`);
      return;
    }

    fromAction.fadeOut(duration);
    toAction.reset().fadeIn(duration).play();
    this.currentAction = toAction;
  }

  /**
   * Blend multiple animations together.
   */
  blend(animations: Array<{ name: string; weight: number }>): void {
    // Stop all actions first
    for (const action of this.actions.values()) {
      action.stop();
    }

    // Play and set weights
    let totalWeight = 0;
    for (const { name, weight } of animations) {
      const action = this.actions.get(name);
      if (action) {
        action.play();
        action.setEffectiveWeight(weight);
        totalWeight += weight;
      }
    }

    // Normalize weights if needed
    if (totalWeight > 0 && totalWeight !== 1.0) {
      for (const { name } of animations) {
        const action = this.actions.get(name);
        if (action) {
          action.setEffectiveWeight(action.getEffectiveWeight() / totalWeight);
        }
      }
    }
  }

  // ─── Playback State ──────────────────────────────────────────────────────

  /**
   * Check if an animation is currently playing.
   */
  isPlaying(name?: string): boolean {
    if (name) {
      const action = this.actions.get(name);
      return action ? action.isRunning() : false;
    }
    return this.currentAction?.isRunning() || false;
  }

  /**
   * Get current animation name.
   */
  getCurrentAnimationName(): string | null {
    if (!this.currentAction) return null;
    return this.currentAction.getClip().name;
  }

  /**
   * Get current playback time.
   */
  getTime(): number {
    return this.currentAction?.time || 0;
  }

  /**
   * Set playback time.
   */
  setTime(time: number): void {
    if (this.currentAction) {
      this.currentAction.time = time;
    }
  }

  /**
   * Get animation duration.
   */
  getDuration(name?: string): number {
    if (name) {
      const clip = this.clips.get(name);
      return clip?.duration || 0;
    }
    return this.currentAction?.getClip().duration || 0;
  }

  /**
   * Set playback speed.
   */
  setSpeed(speed: number): void {
    if (this.currentAction) {
      this.currentAction.setEffectiveTimeScale(speed);
    }
  }

  /**
   * Get playback speed.
   */
  getSpeed(): number {
    return this.currentAction?.getEffectiveTimeScale() || 1.0;
  }

  // ─── Events ──────────────────────────────────────────────────────────────

  /**
   * Add an event callback at a specific time in an animation.
   */
  addEvent(animationName: string, time: number, callback: () => void): void {
    if (!this.eventListeners.has(animationName)) {
      this.eventListeners.set(animationName, []);
    }
    this.eventListeners.get(animationName)!.push({ time, callback });
  }

  /**
   * Clear all events for an animation.
   */
  clearEvents(animationName: string): void {
    this.eventListeners.delete(animationName);
  }

  // ─── Update ──────────────────────────────────────────────────────────────

  /**
   * Update the animation mixer (call in render loop).
   */
  update(deltaTime: number): void {
    this.mixer.update(deltaTime);

    // Process events
    if (this.currentAction) {
      const name = this.currentAction.getClip().name;
      const events = this.eventListeners.get(name);
      if (events) {
        const currentTime = this.currentAction.time;
        for (const event of events) {
          // Trigger if we've passed the event time this frame
          const prevTime = currentTime - deltaTime;
          if (prevTime < event.time && currentTime >= event.time) {
            event.callback();
          }
        }
      }
    }
  }

  /**
   * Clean up resources.
   */
  dispose(): void {
    this.mixer.stopAllAction();
    this.actions.clear();
    this.clips.clear();
    this.eventListeners.clear();
    this.currentAction = null;
  }

  /**
   * Get the underlying Three.js AnimationMixer.
   */
  getMixer(): THREE.AnimationMixer {
    return this.mixer;
  }
}

// ─── Animation Utilities ─────────────────────────────────────────────────────

/**
 * Create a simple position animation clip.
 */
export function createPositionClip(
  name: string,
  targetName: string,
  positions: Array<{ time: number; value: [number, number, number] }>,
  duration: number
): THREE.AnimationClip {
  const times = positions.map(p => p.time);
  const values = positions.flatMap(p => p.value);

  const track = new THREE.VectorKeyframeTrack(
    `${targetName}.position`,
    times,
    values
  );

  return new THREE.AnimationClip(name, duration, [track]);
}

/**
 * Create a simple rotation animation clip.
 */
export function createRotationClip(
  name: string,
  targetName: string,
  rotations: Array<{ time: number; value: THREE.Quaternion }>,
  duration: number
): THREE.AnimationClip {
  const times = rotations.map(r => r.time);
  const values = rotations.flatMap(r => [r.value.x, r.value.y, r.value.z, r.value.w]);

  const track = new THREE.QuaternionKeyframeTrack(
    `${targetName}.quaternion`,
    times,
    values
  );

  return new THREE.AnimationClip(name, duration, [track]);
}

/**
 * Create a simple scale animation clip.
 */
export function createScaleClip(
  name: string,
  targetName: string,
  scales: Array<{ time: number; value: [number, number, number] }>,
  duration: number
): THREE.AnimationClip {
  const times = scales.map(s => s.time);
  const values = scales.flatMap(s => s.value);

  const track = new THREE.VectorKeyframeTrack(
    `${targetName}.scale`,
    times,
    values
  );

  return new THREE.AnimationClip(name, duration, [track]);
}
