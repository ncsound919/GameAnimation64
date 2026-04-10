/**
 * ThreeCameraControls.ts
 * Camera control wrapper using Three.js built-in controls for Pyrite64.
 *
 * Replaces the custom CameraController.ts and CinematicCamera.ts with
 * Three.js's production-tested camera control systems.
 *
 * Benefits over custom implementation:
 *  - Production-tested camera behaviors
 *  - Smooth damping and interpolation
 *  - Multiple control schemes (Orbit, Fly, FirstPerson, etc.)
 *  - Touch and mobile support
 *  - Extensive configuration options
 *
 * Design file reference: Component #7 — Camera & Cinematography Tools
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FlyControls } from 'three/examples/jsm/controls/FlyControls.js';
import { FirstPersonControls } from 'three/examples/jsm/controls/FirstPersonControls.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CameraControlType = 'orbit' | 'fly' | 'firstperson' | 'pointerlock' | 'follow' | 'cinematic';

export interface CameraConfig {
  fov: number;
  near: number;
  far: number;
  position: [number, number, number];
  lookAt: [number, number, number];
}

export interface OrbitControlsConfig {
  enableDamping: boolean;
  dampingFactor: number;
  enableZoom: boolean;
  zoomSpeed: number;
  enablePan: boolean;
  panSpeed: number;
  enableRotate: boolean;
  rotateSpeed: number;
  minDistance: number;
  maxDistance: number;
  minPolarAngle: number;
  maxPolarAngle: number;
  autoRotate: boolean;
  autoRotateSpeed: number;
}

export interface FollowCameraConfig {
  offset: [number, number, number];
  lookAtOffset: [number, number, number];
  smoothness: number;
  rotationSmoothness: number;
}

export interface CinematicKeyframe {
  time: number;
  position: [number, number, number];
  lookAt: [number, number, number];
  fov?: number;
}

// ─── Camera Manager ──────────────────────────────────────────────────────────

/**
 * Unified camera management system supporting multiple control schemes.
 */
export class CameraManager {
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls | FlyControls | FirstPersonControls | PointerLockControls | null = null;
  private domElement: HTMLElement;
  private controlType: CameraControlType = 'orbit';

  // Follow camera state
  private followTarget: THREE.Object3D | null = null;
  private followConfig: FollowCameraConfig = {
    offset: [0, 5, 10],
    lookAtOffset: [0, 0, 0],
    smoothness: 0.1,
    rotationSmoothness: 0.1,
  };

  // Cinematic camera state
  private cinematicKeyframes: CinematicKeyframe[] = [];
  private cinematicTime = 0;
  private cinematicPlaying = false;
  private cinematicLoop = false;

  constructor(
    domElement: HTMLElement,
    config: Partial<CameraConfig> = {}
  ) {
    this.domElement = domElement;

    const cfg: CameraConfig = {
      fov: 75,
      near: 0.1,
      far: 1000,
      position: [0, 5, 10],
      lookAt: [0, 0, 0],
      ...config,
    };

    this.camera = new THREE.PerspectiveCamera(
      cfg.fov,
      domElement.clientWidth / domElement.clientHeight,
      cfg.near,
      cfg.far
    );

    this.camera.position.set(...cfg.position);
    this.camera.lookAt(...cfg.lookAt);
  }

  // ─── Control Setup ──────────────────────────────────────────────────────

  /**
   * Set up orbit controls (best for 3D scene inspection).
   */
  setupOrbitControls(config: Partial<OrbitControlsConfig> = {}): OrbitControls {
    this.disposeCurrentControls();
    this.controlType = 'orbit';

    const controls = new OrbitControls(this.camera, this.domElement);

    const cfg: OrbitControlsConfig = {
      enableDamping: true,
      dampingFactor: 0.05,
      enableZoom: true,
      zoomSpeed: 1.0,
      enablePan: true,
      panSpeed: 1.0,
      enableRotate: true,
      rotateSpeed: 1.0,
      minDistance: 1,
      maxDistance: 100,
      minPolarAngle: 0,
      maxPolarAngle: Math.PI,
      autoRotate: false,
      autoRotateSpeed: 2.0,
      ...config,
    };

    controls.enableDamping = cfg.enableDamping;
    controls.dampingFactor = cfg.dampingFactor;
    controls.enableZoom = cfg.enableZoom;
    controls.zoomSpeed = cfg.zoomSpeed;
    controls.enablePan = cfg.enablePan;
    controls.panSpeed = cfg.panSpeed;
    controls.enableRotate = cfg.enableRotate;
    controls.rotateSpeed = cfg.rotateSpeed;
    controls.minDistance = cfg.minDistance;
    controls.maxDistance = cfg.maxDistance;
    controls.minPolarAngle = cfg.minPolarAngle;
    controls.maxPolarAngle = cfg.maxPolarAngle;
    controls.autoRotate = cfg.autoRotate;
    controls.autoRotateSpeed = cfg.autoRotateSpeed;

    this.controls = controls;
    return controls;
  }

  /**
   * Set up fly controls (freeform camera movement).
   */
  setupFlyControls(movementSpeed = 10, rollSpeed = 0.5): FlyControls {
    this.disposeCurrentControls();
    this.controlType = 'fly';

    const controls = new FlyControls(this.camera, this.domElement);
    controls.movementSpeed = movementSpeed;
    controls.rollSpeed = rollSpeed;
    controls.dragToLook = true;

    this.controls = controls;
    return controls;
  }

  /**
   * Set up first person controls (FPS-style camera).
   */
  setupFirstPersonControls(movementSpeed = 10, lookSpeed = 0.1): FirstPersonControls {
    this.disposeCurrentControls();
    this.controlType = 'firstperson';

    const controls = new FirstPersonControls(this.camera, this.domElement);
    controls.movementSpeed = movementSpeed;
    controls.lookSpeed = lookSpeed;
    controls.lookVertical = true;
    controls.constrainVertical = true;
    controls.verticalMin = 0.5;
    controls.verticalMax = Math.PI - 0.5;

    this.controls = controls;
    return controls;
  }

  /**
   * Set up pointer lock controls (for locked FPS games).
   */
  setupPointerLockControls(): PointerLockControls {
    this.disposeCurrentControls();
    this.controlType = 'pointerlock';

    const controls = new PointerLockControls(this.camera, this.domElement);
    this.controls = controls;
    return controls;
  }

  /**
   * Set up follow camera (smoothly follows a target object).
   */
  setupFollowCamera(
    target: THREE.Object3D,
    config: Partial<FollowCameraConfig> = {}
  ): void {
    this.disposeCurrentControls();
    this.controlType = 'follow';
    this.followTarget = target;
    this.followConfig = { ...this.followConfig, ...config };
  }

  /**
   * Set up cinematic camera (plays through keyframes).
   */
  setupCinematicCamera(keyframes: CinematicKeyframe[], loop = false): void {
    this.disposeCurrentControls();
    this.controlType = 'cinematic';
    this.cinematicKeyframes = keyframes.sort((a, b) => a.time - b.time);
    this.cinematicLoop = loop;
    this.cinematicTime = 0;
  }

  // ─── Cinematic Controls ─────────────────────────────────────────────────

  playCinematic(): void {
    this.cinematicPlaying = true;
    this.cinematicTime = 0;
  }

  pauseCinematic(): void {
    this.cinematicPlaying = false;
  }

  stopCinematic(): void {
    this.cinematicPlaying = false;
    this.cinematicTime = 0;
  }

  seekCinematic(time: number): void {
    this.cinematicTime = Math.max(0, time);
  }

  // ─── Update ─────────────────────────────────────────────────────────────

  /**
   * Update camera (call in render loop).
   */
  update(deltaTime: number): void {
    switch (this.controlType) {
      case 'orbit':
        if (this.controls instanceof OrbitControls) {
          this.controls.update();
        }
        break;

      case 'fly':
        if (this.controls instanceof FlyControls) {
          this.controls.update(deltaTime);
        }
        break;

      case 'firstperson':
        if (this.controls instanceof FirstPersonControls) {
          this.controls.update(deltaTime);
        }
        break;

      case 'pointerlock':
        // PointerLockControls doesn't need update
        break;

      case 'follow':
        this.updateFollowCamera(deltaTime);
        break;

      case 'cinematic':
        this.updateCinematicCamera(deltaTime);
        break;
    }
  }

  private updateFollowCamera(deltaTime: number): void {
    if (!this.followTarget) return;

    const targetPos = this.followTarget.position;
    const offset = this.followConfig.offset;
    const lookAtOffset = this.followConfig.lookAtOffset;

    // Calculate desired camera position
    const desiredPos = new THREE.Vector3(
      targetPos.x + offset[0],
      targetPos.y + offset[1],
      targetPos.z + offset[2]
    );

    // Smoothly interpolate to desired position
    this.camera.position.lerp(desiredPos, this.followConfig.smoothness);

    // Look at target with offset
    const lookAtPos = new THREE.Vector3(
      targetPos.x + lookAtOffset[0],
      targetPos.y + lookAtOffset[1],
      targetPos.z + lookAtOffset[2]
    );

    this.camera.lookAt(lookAtPos);
  }

  private updateCinematicCamera(deltaTime: number): void {
    if (!this.cinematicPlaying || this.cinematicKeyframes.length === 0) return;

    this.cinematicTime += deltaTime;

    const totalDuration = this.cinematicKeyframes[this.cinematicKeyframes.length - 1].time;

    // Handle looping
    if (this.cinematicTime > totalDuration) {
      if (this.cinematicLoop) {
        this.cinematicTime = 0;
      } else {
        this.cinematicPlaying = false;
        return;
      }
    }

    // Find surrounding keyframes
    let keyframe1: CinematicKeyframe | null = null;
    let keyframe2: CinematicKeyframe | null = null;

    for (let i = 0; i < this.cinematicKeyframes.length - 1; i++) {
      if (
        this.cinematicTime >= this.cinematicKeyframes[i].time &&
        this.cinematicTime <= this.cinematicKeyframes[i + 1].time
      ) {
        keyframe1 = this.cinematicKeyframes[i];
        keyframe2 = this.cinematicKeyframes[i + 1];
        break;
      }
    }

    if (!keyframe1 || !keyframe2) return;

    // Interpolate between keyframes
    const t =
      (this.cinematicTime - keyframe1.time) / (keyframe2.time - keyframe1.time);

    const pos1 = new THREE.Vector3(...keyframe1.position);
    const pos2 = new THREE.Vector3(...keyframe2.position);
    this.camera.position.lerpVectors(pos1, pos2, t);

    const lookAt1 = new THREE.Vector3(...keyframe1.lookAt);
    const lookAt2 = new THREE.Vector3(...keyframe2.lookAt);
    const lookAt = new THREE.Vector3().lerpVectors(lookAt1, lookAt2, t);
    this.camera.lookAt(lookAt);

    // Interpolate FOV if specified
    if (keyframe1.fov !== undefined && keyframe2.fov !== undefined) {
      this.camera.fov = keyframe1.fov + (keyframe2.fov - keyframe1.fov) * t;
      this.camera.updateProjectionMatrix();
    }
  }

  // ─── Camera Utilities ───────────────────────────────────────────────────

  /**
   * Get the Three.js camera.
   */
  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  /**
   * Get current controls instance.
   */
  getControls(): OrbitControls | FlyControls | FirstPersonControls | PointerLockControls | null {
    return this.controls;
  }

  /**
   * Set camera position.
   */
  setPosition(x: number, y: number, z: number): void {
    this.camera.position.set(x, y, z);
  }

  /**
   * Set camera look-at target.
   */
  setLookAt(x: number, y: number, z: number): void {
    this.camera.lookAt(x, y, z);
  }

  /**
   * Set camera FOV.
   */
  setFOV(fov: number): void {
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Handle window resize.
   */
  handleResize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  // ─── Cleanup ────────────────────────────────────────────────────────────

  private disposeCurrentControls(): void {
    if (this.controls) {
      this.controls.dispose();
      this.controls = null;
    }
  }

  dispose(): void {
    this.disposeCurrentControls();
    this.followTarget = null;
    this.cinematicKeyframes = [];
  }
}

// ─── Camera Shake Effect ─────────────────────────────────────────────────────

export class CameraShake {
  private camera: THREE.Camera;
  private originalPosition: THREE.Vector3 = new THREE.Vector3();
  private shakeIntensity = 0;
  private shakeDuration = 0;
  private shakeTime = 0;
  private shaking = false;

  constructor(camera: THREE.Camera) {
    this.camera = camera;
  }

  /**
   * Trigger a camera shake effect.
   */
  shake(intensity = 0.5, duration = 0.5): void {
    this.originalPosition.copy(this.camera.position);
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
    this.shakeTime = 0;
    this.shaking = true;
  }

  /**
   * Update shake effect (call in render loop).
   */
  update(deltaTime: number): void {
    if (!this.shaking) return;

    this.shakeTime += deltaTime;

    if (this.shakeTime >= this.shakeDuration) {
      // Shake complete, reset to original position
      this.camera.position.copy(this.originalPosition);
      this.shaking = false;
      return;
    }

    // Apply shake offset with decay
    const progress = this.shakeTime / this.shakeDuration;
    const decay = 1 - progress;
    const intensity = this.shakeIntensity * decay;

    this.camera.position.x = this.originalPosition.x + (Math.random() - 0.5) * intensity;
    this.camera.position.y = this.originalPosition.y + (Math.random() - 0.5) * intensity;
    this.camera.position.z = this.originalPosition.z + (Math.random() - 0.5) * intensity;
  }

  isShaking(): boolean {
    return this.shaking;
  }
}
