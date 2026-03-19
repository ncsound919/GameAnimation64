/**
 * CinematicCamera.ts
 * Advanced camera & cinematography tools for Pyrite64's vibe coding engine.
 *
 * Extends the base CameraController with:
 *  - Follow camera with smooth tracking
 *  - Camera shake effects (impact, continuous, directional)
 *  - Spline-based camera path system
 *  - Timeline-based cutscene sequencer
 *  - Zoom and post-process transitions
 *
 * Design file reference: Component #7 — Camera & Cinematography Tools
 */

import * as THREE from 'three';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CameraMode = 'follow' | 'orbit' | 'fly' | 'cinematic' | 'firstPerson';

/** Configuration for the follow camera. */
export interface FollowConfig {
  /** Offset from target (local space). */
  offset:      THREE.Vector3;
  /** Smooth follow speed (higher = faster catch-up). */
  smoothSpeed: number;
  /** Lookahead distance based on target velocity. */
  lookAhead:   number;
  /** Minimum distance from target. */
  minDistance:  number;
  /** Maximum distance from target. */
  maxDistance:  number;
  /** Whether the camera rotates with the target. */
  inheritRotation: boolean;
}

/** Camera shake configuration. */
export interface ShakeConfig {
  /** Shake intensity (units of displacement). */
  intensity:  number;
  /** Shake frequency (oscillations per second). */
  frequency:  number;
  /** Duration in seconds (0 = infinite). */
  duration:   number;
  /** Decay curve — how fast it fades out (higher = faster). */
  decay:      number;
  /** Directional bias (null = omni-directional). */
  direction?: THREE.Vector3;
}

/** A waypoint on a camera path. */
export interface CameraWaypoint {
  /** World position. */
  position: THREE.Vector3;
  /** Look-at target. */
  lookAt:   THREE.Vector3;
  /** Field of view at this waypoint. */
  fov:      number;
  /** Time in seconds to reach this waypoint from the previous one. */
  duration: number;
  /** Easing function name. */
  easing:   'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
}

/** A cutscene action (camera move, shake, zoom, etc.). */
export interface CutsceneAction {
  type:     'move' | 'shake' | 'zoom' | 'wait' | 'lookAt' | 'fade';
  /** Start time in seconds. */
  time:     number;
  /** Duration in seconds. */
  duration: number;
  /** Action-specific parameters. */
  params:   Record<string, any>;
}

/** Full cutscene definition. */
export interface CutsceneData {
  name:       string;
  duration:   number;
  actions:    CutsceneAction[];
  loop:       boolean;
}

// ─── Cinematic Camera ────────────────────────────────────────────────────────

export class CinematicCamera {
  private camera:  THREE.PerspectiveCamera;
  private mode:    CameraMode = 'orbit';
  private clock:   THREE.Clock;

  // Follow camera state
  private followTarget:   THREE.Vector3 = new THREE.Vector3();
  private followVelocity: THREE.Vector3 = new THREE.Vector3();
  private followConfig: FollowConfig = {
    offset:      new THREE.Vector3(0, 5, -10),
    smoothSpeed: 5,
    lookAhead:   2,
    minDistance:  3,
    maxDistance:  20,
    inheritRotation: false,
  };

  // Shake state
  private shakes: ActiveShake[] = [];

  // Camera path
  private pathWaypoints: CameraWaypoint[] = [];
  private pathTime      = 0;
  private pathPlaying   = false;
  private pathTotalTime = 0;

  // Cutscene
  private activeCutscene: CutsceneData | null = null;
  private cutsceneTime   = 0;
  private cutscenePlaying = false;

  // Transition
  private transitionStart: { pos: THREE.Vector3; rot: THREE.Euler; fov: number } | null = null;
  private transitionEnd:   { pos: THREE.Vector3; rot: THREE.Euler; fov: number } | null = null;
  private transitionDuration = 0;
  private transitionElapsed  = 0;
  private transitioning = false;

  // Original state (for reset)
  private originalPosition: THREE.Vector3;
  private originalRotation: THREE.Euler;
  private originalFov:      number;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.clock = new THREE.Clock();
    this.originalPosition = camera.position.clone();
    this.originalRotation = camera.rotation.clone();
    this.originalFov = camera.fov;
  }

  /** Get the current camera mode. */
  getMode(): CameraMode { return this.mode; }

  /** Set camera mode. */
  setMode(mode: CameraMode): void { this.mode = mode; }

  /** Get the managed camera. */
  getCamera(): THREE.PerspectiveCamera { return this.camera; }

  // ─── Update (call every frame) ──────────────────────────────────────────

  update(dt?: number): void {
    const delta = dt ?? this.clock.getDelta();

    if (this.transitioning) {
      this.updateTransition(delta);
      return;
    }

    switch (this.mode) {
      case 'follow':    this.updateFollow(delta); break;
      case 'cinematic': this.updatePath(delta); break;
    }

    // Apply shake on top of current position
    this.updateShake(delta);

    // Cutscene
    if (this.cutscenePlaying) {
      this.updateCutscene(delta);
    }
  }

  // ─── Follow Camera ──────────────────────────────────────────────────────

  /** Set the target position for the follow camera to track. */
  setFollowTarget(position: THREE.Vector3, velocity?: THREE.Vector3): void {
    this.followTarget.copy(position);
    if (velocity) this.followVelocity.copy(velocity);
  }

  /** Configure the follow camera. */
  configureFollow(config: Partial<FollowConfig>): void {
    Object.assign(this.followConfig, config);
  }

  private updateFollow(dt: number): void {
    const config = this.followConfig;

    // Desired position: target + offset + lookahead
    const desired = this.followTarget.clone()
      .add(config.offset)
      .add(this.followVelocity.clone().multiplyScalar(config.lookAhead));

    // Clamp distance
    const toTarget = desired.clone().sub(this.followTarget);
    const dist = toTarget.length();
    if (dist < config.minDistance) {
      toTarget.normalize().multiplyScalar(config.minDistance);
      desired.copy(this.followTarget).add(toTarget);
    } else if (dist > config.maxDistance) {
      toTarget.normalize().multiplyScalar(config.maxDistance);
      desired.copy(this.followTarget).add(toTarget);
    }

    // Smooth interpolation
    this.camera.position.lerp(desired, 1 - Math.exp(-config.smoothSpeed * dt));
    this.camera.lookAt(this.followTarget);
  }

  // ─── Camera Shake ───────────────────────────────────────────────────────

  /** Start a camera shake effect. Returns an ID for stopping it early. */
  shake(config: Partial<ShakeConfig> = {}): number {
    const shake: ActiveShake = {
      id: Date.now(),
      intensity: config.intensity ?? 0.5,
      frequency: config.frequency ?? 25,
      duration:  config.duration ?? 0.3,
      decay:     config.decay ?? 5,
      direction: config.direction ?? null,
      elapsed:   0,
    };
    this.shakes.push(shake);
    return shake.id;
  }

  /** Stop a specific shake by ID. */
  stopShake(id: number): void {
    this.shakes = this.shakes.filter(s => s.id !== id);
  }

  /** Stop all active shakes. */
  stopAllShakes(): void {
    this.shakes = [];
  }

  private updateShake(dt: number): void {
    if (this.shakes.length === 0) return;

    let totalOffset = new THREE.Vector3();

    for (let i = this.shakes.length - 1; i >= 0; i--) {
      const s = this.shakes[i];
      s.elapsed += dt;

      // Remove expired shakes
      if (s.duration > 0 && s.elapsed >= s.duration) {
        this.shakes.splice(i, 1);
        continue;
      }

      // Calculate decay
      const life = s.duration > 0 ? s.elapsed / s.duration : 0;
      const decayMul = Math.exp(-s.decay * life);
      const intensity = s.intensity * decayMul;

      // Generate noise offset
      const t = s.elapsed * s.frequency;
      if (s.direction) {
        const noise = Math.sin(t * 6.28) * intensity;
        totalOffset.add(s.direction.clone().normalize().multiplyScalar(noise));
      } else {
        totalOffset.x += Math.sin(t * 6.28 + 0) * intensity;
        totalOffset.y += Math.sin(t * 6.28 + 2.1) * intensity;
        totalOffset.z += Math.sin(t * 6.28 + 4.2) * intensity * 0.5;
      }
    }

    this.camera.position.add(totalOffset);
  }

  // ─── Camera Path ────────────────────────────────────────────────────────

  /** Set waypoints for a camera path. */
  setPath(waypoints: CameraWaypoint[]): void {
    this.pathWaypoints = waypoints;
    this.pathTotalTime = waypoints.reduce((sum, w) => sum + w.duration, 0);
    this.pathTime = 0;
  }

  /** Start playing the camera path. */
  playPath(): void {
    this.pathPlaying = true;
    this.pathTime = 0;
    this.mode = 'cinematic';
  }

  /** Pause the camera path. */
  pausePath(): void {
    this.pathPlaying = false;
  }

  /** Stop and reset the camera path. */
  stopPath(): void {
    this.pathPlaying = false;
    this.pathTime = 0;
  }

  private updatePath(dt: number): void {
    if (!this.pathPlaying || this.pathWaypoints.length < 2) return;

    this.pathTime += dt;
    if (this.pathTime >= this.pathTotalTime) {
      this.pathPlaying = false;
      return;
    }

    // Find current segment
    let accumTime = 0;
    for (let i = 0; i < this.pathWaypoints.length - 1; i++) {
      const wp = this.pathWaypoints[i];
      const next = this.pathWaypoints[i + 1];
      if (this.pathTime >= accumTime && this.pathTime < accumTime + next.duration) {
        const segT = (this.pathTime - accumTime) / next.duration;
        const easedT = this.applyEasing(segT, next.easing);

        // Interpolate position
        this.camera.position.lerpVectors(wp.position, next.position, easedT);

        // Interpolate look-at
        const lookAt = new THREE.Vector3().lerpVectors(wp.lookAt, next.lookAt, easedT);
        this.camera.lookAt(lookAt);

        // Interpolate FOV
        this.camera.fov = wp.fov + (next.fov - wp.fov) * easedT;
        this.camera.updateProjectionMatrix();
        return;
      }
      accumTime += next.duration;
    }
  }

  // ─── Cutscenes ──────────────────────────────────────────────────────────

  /** Load a cutscene definition. */
  loadCutscene(data: CutsceneData): void {
    this.activeCutscene = data;
    this.cutsceneTime = 0;
  }

  /** Play the loaded cutscene. */
  playCutscene(): void {
    if (!this.activeCutscene) return;
    this.cutscenePlaying = true;
    this.cutsceneTime = 0;
  }

  /** Stop the cutscene. */
  stopCutscene(): void {
    this.cutscenePlaying = false;
    this.cutsceneTime = 0;
    this.activeCutscene = null;
  }

  private updateCutscene(dt: number): void {
    if (!this.activeCutscene) return;

    this.cutsceneTime += dt;
    if (this.cutsceneTime >= this.activeCutscene.duration) {
      if (this.activeCutscene.loop) {
        this.cutsceneTime = 0;
      } else {
        this.cutscenePlaying = false;
        return;
      }
    }

    // Execute actions whose time has been reached
    for (const action of this.activeCutscene.actions) {
      if (this.cutsceneTime >= action.time && this.cutsceneTime < action.time + action.duration) {
        this.executeCutsceneAction(action);
      }
    }
  }

  private executeCutsceneAction(action: CutsceneAction): void {
    const p = action.params;
    switch (action.type) {
      case 'move':
        if (p['position']) {
          const target = new THREE.Vector3(p['position'][0], p['position'][1], p['position'][2]);
          const t = Math.min(1, (this.cutsceneTime - action.time) / action.duration);
          this.camera.position.lerp(target, t);
        }
        break;

      case 'lookAt':
        if (p['target']) {
          const target = new THREE.Vector3(p['target'][0], p['target'][1], p['target'][2]);
          this.camera.lookAt(target);
        }
        break;

      case 'zoom':
        if (p['fov'] !== undefined) {
          const t = Math.min(1, (this.cutsceneTime - action.time) / action.duration);
          this.camera.fov = this.originalFov + (p['fov'] - this.originalFov) * t;
          this.camera.updateProjectionMatrix();
        }
        break;

      case 'shake':
        // Trigger a shake if not already running
        if (p['_shakeStarted'] === undefined) {
          p['_shakeStarted'] = true;
          this.shake({
            intensity: p['intensity'] ?? 0.5,
            duration: action.duration,
            frequency: p['frequency'] ?? 25,
          });
        }
        break;

      case 'wait':
        // No-op; just waits
        break;
    }
  }

  // ─── Smooth Transition ──────────────────────────────────────────────────

  /** Smoothly transition the camera to a new position/rotation/fov. */
  transitionTo(position: THREE.Vector3, lookAt: THREE.Vector3, fov: number, duration = 1.0): void {
    this.transitionStart = {
      pos: this.camera.position.clone(),
      rot: this.camera.rotation.clone(),
      fov: this.camera.fov,
    };
    // Calculate target rotation
    const tempCam = this.camera.clone();
    tempCam.position.copy(position);
    tempCam.lookAt(lookAt);

    this.transitionEnd = {
      pos: position.clone(),
      rot: tempCam.rotation.clone(),
      fov,
    };
    this.transitionDuration = duration;
    this.transitionElapsed = 0;
    this.transitioning = true;
  }

  private updateTransition(dt: number): void {
    if (!this.transitionStart || !this.transitionEnd) return;

    this.transitionElapsed += dt;
    const t = Math.min(1, this.transitionElapsed / this.transitionDuration);
    const easedT = this.applyEasing(t, 'easeInOut');

    this.camera.position.lerpVectors(this.transitionStart.pos, this.transitionEnd.pos, easedT);
    this.camera.fov = this.transitionStart.fov + (this.transitionEnd.fov - this.transitionStart.fov) * easedT;
    this.camera.updateProjectionMatrix();

    // Rotation slerp via quaternions
    const startQ = new THREE.Quaternion().setFromEuler(this.transitionStart.rot);
    const endQ = new THREE.Quaternion().setFromEuler(this.transitionEnd.rot);
    const q = new THREE.Quaternion();
    q.slerpQuaternions(startQ, endQ, easedT);
    this.camera.quaternion.copy(q);

    if (t >= 1) {
      this.transitioning = false;
      this.transitionStart = null;
      this.transitionEnd = null;
    }
  }

  // ─── Easing ─────────────────────────────────────────────────────────────

  private applyEasing(t: number, easing: string): number {
    switch (easing) {
      case 'easeIn':    return t * t;
      case 'easeOut':   return 1 - (1 - t) * (1 - t);
      case 'easeInOut': return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      default:          return t;
    }
  }

  // ─── Reset ──────────────────────────────────────────────────────────────

  /** Reset camera to its original position/rotation/fov. */
  reset(): void {
    this.camera.position.copy(this.originalPosition);
    this.camera.rotation.copy(this.originalRotation);
    this.camera.fov = this.originalFov;
    this.camera.updateProjectionMatrix();
    this.stopAllShakes();
    this.stopPath();
    this.stopCutscene();
    this.transitioning = false;
  }
}

// ─── Internal Types ──────────────────────────────────────────────────────────

interface ActiveShake {
  id:        number;
  intensity: number;
  frequency: number;
  duration:  number;
  decay:     number;
  direction: THREE.Vector3 | null;
  elapsed:   number;
}
