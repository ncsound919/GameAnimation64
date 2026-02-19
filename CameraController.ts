/**
 * CameraController.ts
 * Orbit (hold Alt + drag) and Fly (WASD) camera controller for the viewport.
 *
 * Wraps Three.js OrbitControls as the base, adds:
 *  - Fly mode toggle (F key)
 *  - Focus-to-box utility (used by viewport's frameAll / frameNode)
 *  - Scroll-to-zoom with smooth damping
 *  - Middle-mouse pan
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

type Mode = 'orbit' | 'fly';

export class CameraController {
  private orbit:  OrbitControls;
  private camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  private perspCamera: THREE.PerspectiveCamera;
  private orthoCamera: THREE.OrthographicCamera | null = null;
  private isOrtho: boolean = false;
  private mode:   Mode = 'orbit';
  private domElement: HTMLElement;

  // Fly mode state
  private keys    = new Set<string>();
  private flySpeed = 8.0;  // units/second
  private clock   = new THREE.Clock();
  
  // Event handlers (stored for cleanup)
  private keyDownHandler: ((e: KeyboardEvent) => void) | null = null;
  private keyUpHandler: ((e: KeyboardEvent) => void) | null = null;

  // Callback for when the camera instance changes (ortho toggle)
  onCameraChange?: (camera: THREE.PerspectiveCamera | THREE.OrthographicCamera) => void;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.perspCamera = camera;
    this.domElement = domElement;

    this.orbit = new OrbitControls(camera, domElement);
    this.orbit.enableDamping   = true;
    this.orbit.dampingFactor   = 0.08;
    this.orbit.screenSpacePanning = true;
    this.orbit.minDistance     = 0.2;
    this.orbit.maxDistance     = 400;

    // Keyboard listeners for fly mode
    domElement.tabIndex = 0;  // make focusable
    this.keyDownHandler = (e: KeyboardEvent) => this.onKeyDown(e);
    this.keyUpHandler = (e: KeyboardEvent) => this.onKeyUp(e);
    domElement.addEventListener('keydown', this.keyDownHandler);
    domElement.addEventListener('keyup', this.keyUpHandler);
  }

  /** Called every frame from the render loop. */
  update(): void {
    if (this.mode === 'orbit') {
      this.orbit.update();
    } else {
      this.updateFly();
    }
  }

  /**
   * Smoothly move the camera so a bounding box fills the view.
   * Works in both orbit and fly modes.
   */
  fitToBox(box: THREE.Box3): void {
    const center = new THREE.Vector3();
    const size   = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov    = this.perspCamera.fov * (Math.PI / 180);
    const dist   = (maxDim / 2) / Math.tan(fov / 2) * 1.5;

    this.orbit.target.copy(center);
    this.camera.position.copy(center).add(new THREE.Vector3(dist * 0.6, dist * 0.4, dist));
    this.camera.lookAt(center);
    this.orbit.update();
  }

  dispose(): void {
    this.orbit.dispose();
    
    if (this.keyDownHandler && this.domElement) {
      this.domElement.removeEventListener('keydown', this.keyDownHandler);
      this.keyDownHandler = null;
    }
    
    if (this.keyUpHandler && this.domElement) {
      this.domElement.removeEventListener('keyup', this.keyUpHandler);
      this.keyUpHandler = null;
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private onKeyDown(e: KeyboardEvent): void {
    this.keys.add(e.code);
    if (e.code === 'KeyF') {
      this.mode = this.mode === 'orbit' ? 'fly' : 'orbit';
      this.orbit.enabled = this.mode === 'orbit';
    }
    if (e.code === 'Numpad5') this.toggleOrtho();
    if (e.code === 'Numpad1') this.setView('front');
    if (e.code === 'Numpad3') this.setView('side');
    if (e.code === 'Numpad7') this.setView('top');
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keys.delete(e.code);
  }

  private updateFly(): void {
    const dt  = this.clock.getDelta();
    
    // Reset flySpeed to default if ShiftLeft is not pressed
    this.flySpeed = this.keys.has('ShiftLeft') ? 24 : 8;
    const spd = this.flySpeed * dt;

    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    const right = new THREE.Vector3();
    right.crossVectors(forward, this.camera.up).normalize();

    if (this.keys.has('KeyW') || this.keys.has('ArrowUp'))   this.camera.position.addScaledVector(forward,  spd);
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) this.camera.position.addScaledVector(forward, -spd);
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) this.camera.position.addScaledVector(right,   -spd);
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight'))this.camera.position.addScaledVector(right,    spd);
    if (this.keys.has('KeyE')) this.camera.position.y += spd;
    if (this.keys.has('KeyQ')) this.camera.position.y -= spd;
  }

  /** Get the current active camera. */
  getCamera(): THREE.PerspectiveCamera | THREE.OrthographicCamera {
    return this.camera;
  }

  private toggleOrtho(): void {
    this.isOrtho = !this.isOrtho;

    if (this.isOrtho) {
      // Create orthographic camera matching current perspective view
      const aspect = this.domElement.clientWidth / this.domElement.clientHeight;
      const dist = this.camera.position.distanceTo(this.orbit.target);
      const halfH = dist * Math.tan(THREE.MathUtils.degToRad(this.perspCamera.fov / 2));
      const halfW = halfH * aspect;

      this.orthoCamera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.01, 500);
      this.orthoCamera.position.copy(this.camera.position);
      this.orthoCamera.quaternion.copy(this.camera.quaternion);
      this.orthoCamera.zoom = 1;
      this.orthoCamera.updateProjectionMatrix();

      this.camera = this.orthoCamera;
    } else {
      // Restore perspective camera, keeping current viewpoint
      this.perspCamera.position.copy(this.camera.position);
      this.perspCamera.quaternion.copy(this.camera.quaternion);
      this.camera = this.perspCamera;
    }

    // Re-attach controls to the new camera
    this.orbit.object = this.camera;
    this.orbit.update();

    this.onCameraChange?.(this.camera);
  }

  private setView(view: 'front' | 'side' | 'top'): void {
    const target = this.orbit.target.clone();
    const dist   = this.camera.position.distanceTo(target);
    switch (view) {
      case 'front': this.camera.position.set(target.x,          target.y,          target.z + dist); break;
      case 'side':  this.camera.position.set(target.x + dist,   target.y,          target.z);        break;
      case 'top':   this.camera.position.set(target.x,          target.y + dist,   target.z);        break;
    }
    this.camera.lookAt(target);
    this.orbit.update();
  }
}
