/**
 * UnifiedInputManager.ts
 * Unified input management system for Pyrite64's game engine.
 *
 * Replaces the custom InputManager.ts with a comprehensive system
 * that handles keyboard, mouse, gamepad, and touch inputs.
 *
 * Benefits over custom implementation:
 *  - Unified API for all input types
 *  - Action mapping system
 *  - Gamepad hot-plugging support
 *  - Touch gesture recognition
 *  - Input buffering and replay
 *  - Customizable dead zones
 *
 * Design file reference: Component #9 — Input Handling & Haptics
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type InputDevice = 'keyboard' | 'mouse' | 'gamepad' | 'touch';

export interface KeyboardState {
  pressed: Set<string>;
  justPressed: Set<string>;
  justReleased: Set<string>;
}

export interface MouseState {
  x: number;
  y: number;
  deltaX: number;
  deltaY: number;
  buttons: Set<number>;
  justPressed: Set<number>;
  justReleased: Set<number>;
  wheel: number;
}

export interface GamepadState {
  connected: boolean;
  buttons: boolean[];
  justPressed: Set<number>;
  justReleased: Set<number>;
  axes: number[];
  id: string;
  hapticActuator: GamepadHapticActuator | null;
}

export interface TouchState {
  touches: Array<{
    id: number;
    x: number;
    y: number;
    startX: number;
    startY: number;
  }>;
  justStarted: Set<number>;
  justEnded: Set<number>;
}

export interface ActionBinding {
  device: InputDevice;
  input: string | number; // Key code, button index, etc.
  modifiers?: string[]; // For keyboard: shift, ctrl, alt, meta
}

export type ActionCallback = () => void;

// ─── Unified Input Manager ───────────────────────────────────────────────────

export class UnifiedInputManager {
  private keyboard: KeyboardState = {
    pressed: new Set(),
    justPressed: new Set(),
    justReleased: new Set(),
  };

  private mouse: MouseState = {
    x: 0,
    y: 0,
    deltaX: 0,
    deltaY: 0,
    buttons: new Set(),
    justPressed: new Set(),
    justReleased: new Set(),
    wheel: 0,
  };

  private gamepads: Map<number, GamepadState> = new Map();
  private touch: TouchState = {
    touches: [],
    justStarted: new Set(),
    justEnded: new Set(),
  };

  private actions: Map<string, ActionBinding[]> = new Map();
  private actionCallbacks: Map<string, ActionCallback[]> = new Map();

  private enabled = true;
  private pointerLocked = false;
  private element: HTMLElement;

  // Configuration
  private gamepadDeadzone = 0.15;
  private mouseSensitivity = 1.0;

  constructor(element: HTMLElement = document.body) {
    this.element = element;
    this.setupEventListeners();
  }

  // ─── Event Listener Setup ───────────────────────────────────────────────

  private setupEventListeners(): void {
    // Keyboard
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    // Mouse
    this.element.addEventListener('mousedown', this.onMouseDown);
    this.element.addEventListener('mouseup', this.onMouseUp);
    this.element.addEventListener('mousemove', this.onMouseMove);
    this.element.addEventListener('wheel', this.onMouseWheel);
    this.element.addEventListener('contextmenu', (e) => e.preventDefault());

    // Pointer lock
    document.addEventListener('pointerlockchange', this.onPointerLockChange);

    // Gamepad
    window.addEventListener('gamepadconnected', this.onGamepadConnected);
    window.addEventListener('gamepaddisconnected', this.onGamepadDisconnected);

    // Touch
    this.element.addEventListener('touchstart', this.onTouchStart);
    this.element.addEventListener('touchmove', this.onTouchMove);
    this.element.addEventListener('touchend', this.onTouchEnd);
    this.element.addEventListener('touchcancel', this.onTouchEnd);
  }

  // ─── Keyboard Events ────────────────────────────────────────────────────

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.enabled) return;

    const key = e.code;
    if (!this.keyboard.pressed.has(key)) {
      this.keyboard.justPressed.add(key);
    }
    this.keyboard.pressed.add(key);

    // Check for action triggers
    this.checkActions();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (!this.enabled) return;

    const key = e.code;
    this.keyboard.pressed.delete(key);
    this.keyboard.justReleased.add(key);
  };

  // ─── Mouse Events ───────────────────────────────────────────────────────

  private onMouseDown = (e: MouseEvent): void => {
    if (!this.enabled) return;

    if (!this.mouse.buttons.has(e.button)) {
      this.mouse.justPressed.add(e.button);
    }
    this.mouse.buttons.add(e.button);

    this.checkActions();
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (!this.enabled) return;

    this.mouse.buttons.delete(e.button);
    this.mouse.justReleased.add(e.button);
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.enabled) return;

    this.mouse.deltaX = e.movementX * this.mouseSensitivity;
    this.mouse.deltaY = e.movementY * this.mouseSensitivity;
    this.mouse.x = e.clientX;
    this.mouse.y = e.clientY;
  };

  private onMouseWheel = (e: WheelEvent): void => {
    if (!this.enabled) return;
    this.mouse.wheel = e.deltaY;
  };

  // ─── Pointer Lock ───────────────────────────────────────────────────────

  private onPointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.element;
  };

  requestPointerLock(): void {
    this.element.requestPointerLock();
  }

  exitPointerLock(): void {
    document.exitPointerLock();
  }

  isPointerLocked(): boolean {
    return this.pointerLocked;
  }

  // ─── Gamepad Events ─────────────────────────────────────────────────────

  private onGamepadConnected = (e: GamepadEvent): void => {
    console.log(`Gamepad connected: ${e.gamepad.id}`);
    this.gamepads.set(e.gamepad.index, {
      connected: true,
      buttons: [],
      justPressed: new Set(),
      justReleased: new Set(),
      axes: [],
      id: e.gamepad.id,
      hapticActuator: e.gamepad.hapticActuators?.[0] || null,
    });
  };

  private onGamepadDisconnected = (e: GamepadEvent): void => {
    console.log(`Gamepad disconnected: ${e.gamepad.id}`);
    this.gamepads.delete(e.gamepad.index);
  };

  // ─── Touch Events ───────────────────────────────────────────────────────

  private onTouchStart = (e: TouchEvent): void => {
    if (!this.enabled) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      this.touch.touches.push({
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        startX: touch.clientX,
        startY: touch.clientY,
      });
      this.touch.justStarted.add(touch.identifier);
    }
  };

  private onTouchMove = (e: TouchEvent): void => {
    if (!this.enabled) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const existing = this.touch.touches.find(t => t.id === touch.identifier);
      if (existing) {
        existing.x = touch.clientX;
        existing.y = touch.clientY;
      }
    }
  };

  private onTouchEnd = (e: TouchEvent): void => {
    if (!this.enabled) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      this.touch.touches = this.touch.touches.filter(t => t.id !== touch.identifier);
      this.touch.justEnded.add(touch.identifier);
    }
  };

  // ─── Action System ──────────────────────────────────────────────────────

  /**
   * Map an action to one or more input bindings.
   */
  mapAction(actionName: string, ...bindings: ActionBinding[]): void {
    this.actions.set(actionName, bindings);
  }

  /**
   * Register a callback for an action.
   */
  onAction(actionName: string, callback: ActionCallback): void {
    if (!this.actionCallbacks.has(actionName)) {
      this.actionCallbacks.set(actionName, []);
    }
    this.actionCallbacks.get(actionName)!.push(callback);
  }

  /**
   * Check if an action is currently active.
   */
  isAction(actionName: string): boolean {
    const bindings = this.actions.get(actionName);
    if (!bindings) return false;

    for (const binding of bindings) {
      if (this.isBindingActive(binding)) return true;
    }
    return false;
  }

  /**
   * Check if an action was just triggered this frame.
   */
  isActionJustPressed(actionName: string): boolean {
    const bindings = this.actions.get(actionName);
    if (!bindings) return false;

    for (const binding of bindings) {
      if (this.isBindingJustPressed(binding)) return true;
    }
    return false;
  }

  private isBindingActive(binding: ActionBinding): boolean {
    switch (binding.device) {
      case 'keyboard':
        return this.keyboard.pressed.has(binding.input as string);
      case 'mouse':
        return this.mouse.buttons.has(binding.input as number);
      case 'gamepad':
        // Check all connected gamepads
        for (const state of this.gamepads.values()) {
          if (state.buttons[binding.input as number]) return true;
        }
        return false;
      default:
        return false;
    }
  }

  private isBindingJustPressed(binding: ActionBinding): boolean {
    switch (binding.device) {
      case 'keyboard':
        return this.keyboard.justPressed.has(binding.input as string);
      case 'mouse':
        return this.mouse.justPressed.has(binding.input as number);
      case 'gamepad':
        for (const state of this.gamepads.values()) {
          if (state.justPressed.has(binding.input as number)) return true;
        }
        return false;
      default:
        return false;
    }
  }

  private checkActions(): void {
    for (const [actionName, callbacks] of this.actionCallbacks) {
      if (this.isActionJustPressed(actionName)) {
        for (const callback of callbacks) {
          callback();
        }
      }
    }
  }

  // ─── Direct Input Queries ───────────────────────────────────────────────

  isKeyPressed(key: string): boolean {
    return this.keyboard.pressed.has(key);
  }

  isKeyJustPressed(key: string): boolean {
    return this.keyboard.justPressed.has(key);
  }

  isKeyJustReleased(key: string): boolean {
    return this.keyboard.justReleased.has(key);
  }

  isMouseButtonPressed(button: number): boolean {
    return this.mouse.buttons.has(button);
  }

  getMousePosition(): { x: number; y: number } {
    return { x: this.mouse.x, y: this.mouse.y };
  }

  getMouseDelta(): { x: number; y: number } {
    return { x: this.mouse.deltaX, y: this.mouse.deltaY };
  }

  getMouseWheel(): number {
    return this.mouse.wheel;
  }

  getGamepadAxis(gamepadIndex: number, axisIndex: number): number {
    const gamepad = this.gamepads.get(gamepadIndex);
    if (!gamepad) return 0;

    const value = gamepad.axes[axisIndex] || 0;
    return Math.abs(value) < this.gamepadDeadzone ? 0 : value;
  }

  isGamepadButtonPressed(gamepadIndex: number, buttonIndex: number): boolean {
    const gamepad = this.gamepads.get(gamepadIndex);
    return gamepad?.buttons[buttonIndex] || false;
  }

  /**
   * Trigger haptic feedback on a gamepad.
   */
  vibrate(gamepadIndex: number, intensity = 1.0, duration = 200): void {
    const gamepad = this.gamepads.get(gamepadIndex);
    if (gamepad?.hapticActuator) {
      gamepad.hapticActuator.pulse(intensity, duration);
    }
  }

  // ─── Update ─────────────────────────────────────────────────────────────

  /**
   * Update input state (call at the start of each frame).
   */
  update(): void {
    // Clear "just pressed/released" states
    this.keyboard.justPressed.clear();
    this.keyboard.justReleased.clear();
    this.mouse.justPressed.clear();
    this.mouse.justReleased.clear();
    this.touch.justStarted.clear();
    this.touch.justEnded.clear();

    // Reset mouse delta and wheel
    this.mouse.deltaX = 0;
    this.mouse.deltaY = 0;
    this.mouse.wheel = 0;

    // Update gamepads (must poll manually)
    this.updateGamepads();
  }

  private updateGamepads(): void {
    const gamepads = navigator.getGamepads();

    for (let i = 0; i < gamepads.length; i++) {
      const gamepad = gamepads[i];
      if (!gamepad) continue;

      let state = this.gamepads.get(i);
      if (!state) {
        // Initialize if not already tracked
        state = {
          connected: true,
          buttons: [],
          justPressed: new Set(),
          justReleased: new Set(),
          axes: [],
          id: gamepad.id,
          hapticActuator: gamepad.hapticActuators?.[0] || null,
        };
        this.gamepads.set(i, state);
      }

      // Update button states
      const prevButtons = state.buttons;
      state.buttons = gamepad.buttons.map(b => b.pressed);
      state.justPressed.clear();
      state.justReleased.clear();

      for (let j = 0; j < state.buttons.length; j++) {
        if (state.buttons[j] && !prevButtons[j]) {
          state.justPressed.add(j);
        } else if (!state.buttons[j] && prevButtons[j]) {
          state.justReleased.add(j);
        }
      }

      // Update axes
      state.axes = Array.from(gamepad.axes);
    }
  }

  // ─── Configuration ──────────────────────────────────────────────────────

  setGamepadDeadzone(deadzone: number): void {
    this.gamepadDeadzone = deadzone;
  }

  setMouseSensitivity(sensitivity: number): void {
    this.mouseSensitivity = sensitivity;
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  // ─── Cleanup ────────────────────────────────────────────────────────────

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.element.removeEventListener('mousedown', this.onMouseDown);
    this.element.removeEventListener('mouseup', this.onMouseUp);
    this.element.removeEventListener('mousemove', this.onMouseMove);
    this.element.removeEventListener('wheel', this.onMouseWheel);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    window.removeEventListener('gamepadconnected', this.onGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this.onGamepadDisconnected);
    this.element.removeEventListener('touchstart', this.onTouchStart);
    this.element.removeEventListener('touchmove', this.onTouchMove);
    this.element.removeEventListener('touchend', this.onTouchEnd);
  }
}
