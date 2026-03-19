/**
 * InputManager.ts
 * Abstracted input handling with haptics for Pyrite64's vibe coding engine.
 *
 * Provides:
 *  - Unified input layer (keyboard, mouse, gamepad, touch)
 *  - Action mapping with context sensitivity
 *  - Gamepad support with dead zones and haptic feedback
 *  - Input recording and playback
 *  - Accessibility features (key remapping, assist modes)
 *
 * Design file reference: Component #9 — Input Handling & Haptics
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type InputDevice = 'keyboard' | 'mouse' | 'gamepad' | 'touch';
export type ButtonState = 'pressed' | 'held' | 'released' | 'idle';

/** An abstract action that can be triggered by any input binding. */
export interface InputAction {
  /** Unique action identifier (e.g. 'jump', 'move_left', 'attack'). */
  id:          string;
  /** Human-readable label. */
  label:       string;
  /** Input bindings that trigger this action. */
  bindings:    InputBinding[];
  /** Context in which this action is active (null = always). */
  context?:    string;
  /** Whether this action is currently enabled. */
  enabled:     boolean;
}

/** A binding maps a physical input to an action. */
export interface InputBinding {
  device:    InputDevice;
  /** Key code, button index, or axis name. */
  input:     string;
  /** For axis inputs: positive direction maps to this action. */
  axisPositive?: boolean;
  /** Modifier keys required (keyboard only). */
  modifiers?: string[];
}

/** Axis input value (-1 to 1). */
export interface AxisValue {
  actionId: string;
  value:    number;
}

/** Gamepad configuration. */
export interface GamepadConfig {
  /** Dead zone for analog sticks (0–1). */
  deadZone:      number;
  /** Vibration support. */
  hapticEnabled: boolean;
  /** Sensitivity multiplier for analog sticks. */
  sensitivity:   number;
}

/** Touch gesture types. */
export type GestureType = 'tap' | 'doubletap' | 'swipe' | 'pinch' | 'hold';

export interface TouchGesture {
  type:      GestureType;
  position:  [number, number];
  delta?:    [number, number];
  scale?:    number;
  duration?: number;
}

/** Haptic feedback pattern. */
export interface HapticPattern {
  /** Duration in milliseconds. */
  duration: number;
  /** Intensity (0–1). */
  intensity: number;
  /** Delay before start in milliseconds. */
  delay?: number;
}

// ─── Input Manager ───────────────────────────────────────────────────────────

export class InputManager {
  private actions:     Map<string, InputAction> = new Map();
  private buttonStates: Map<string, ButtonState> = new Map();
  private axisValues:  Map<string, number> = new Map();
  private activeContext: string | null = null;
  private gamepads:    Map<number, Gamepad> = new Map();
  private listeners:   Map<string, Array<(data: any) => void>> = new Map();
  private recording:   boolean = false;
  private recordBuffer: InputEvent[] = [];

  readonly gamepadConfig: GamepadConfig = {
    deadZone:      0.15,
    hapticEnabled: true,
    sensitivity:   1.0,
  };

  // Accessibility
  private assistMode = false;
  private remappings: Map<string, string> = new Map();

  // ─── Initialization ─────────────────────────────────────────────────────

  /** Attach input listeners to the DOM. */
  attach(element: HTMLElement | Document): void {
    element.addEventListener('keydown', this.onKeyDown as EventListener);
    element.addEventListener('keyup', this.onKeyUp as EventListener);
    element.addEventListener('mousedown', this.onMouseDown as EventListener);
    element.addEventListener('mouseup', this.onMouseUp as EventListener);
    element.addEventListener('mousemove', this.onMouseMove as EventListener);
    element.addEventListener('touchstart', this.onTouchStart as EventListener);
    element.addEventListener('touchend', this.onTouchEnd as EventListener);

    // Gamepad connection
    if (typeof window !== 'undefined') {
      window.addEventListener('gamepadconnected', this.onGamepadConnected as EventListener);
      window.addEventListener('gamepaddisconnected', this.onGamepadDisconnected as EventListener);
    }
  }

  /** Detach all input listeners. */
  detach(element: HTMLElement | Document): void {
    element.removeEventListener('keydown', this.onKeyDown as EventListener);
    element.removeEventListener('keyup', this.onKeyUp as EventListener);
    element.removeEventListener('mousedown', this.onMouseDown as EventListener);
    element.removeEventListener('mouseup', this.onMouseUp as EventListener);
    element.removeEventListener('mousemove', this.onMouseMove as EventListener);
    element.removeEventListener('touchstart', this.onTouchStart as EventListener);
    element.removeEventListener('touchend', this.onTouchEnd as EventListener);

    if (typeof window !== 'undefined') {
      window.removeEventListener('gamepadconnected', this.onGamepadConnected as EventListener);
      window.removeEventListener('gamepaddisconnected', this.onGamepadDisconnected as EventListener);
    }
  }

  // ─── Action Management ──────────────────────────────────────────────────

  /** Register an input action with its bindings. */
  registerAction(action: InputAction): void {
    this.actions.set(action.id, action);
    this.buttonStates.set(action.id, 'idle');
  }

  /** Remove an input action. */
  unregisterAction(id: string): void {
    this.actions.delete(id);
    this.buttonStates.delete(id);
  }

  /** Get the current state of an action. */
  getActionState(id: string): ButtonState {
    return this.buttonStates.get(id) ?? 'idle';
  }

  /** Check if an action was just pressed this frame. */
  isActionPressed(id: string): boolean {
    return this.buttonStates.get(id) === 'pressed';
  }

  /** Check if an action is currently held. */
  isActionHeld(id: string): boolean {
    const state = this.buttonStates.get(id);
    return state === 'pressed' || state === 'held';
  }

  /** Check if an action was just released this frame. */
  isActionReleased(id: string): boolean {
    return this.buttonStates.get(id) === 'released';
  }

  /** Get the axis value for an action (-1 to 1). */
  getAxis(id: string): number {
    return this.axisValues.get(id) ?? 0;
  }

  // ─── Context ────────────────────────────────────────────────────────────

  /** Set the active input context (e.g. 'gameplay', 'menu', 'cutscene'). */
  setContext(context: string | null): void {
    this.activeContext = context;
  }

  /** Get the active input context. */
  getContext(): string | null {
    return this.activeContext;
  }

  // ─── Key Remapping ──────────────────────────────────────────────────────

  /** Remap an input to a different key (for accessibility). */
  remap(originalInput: string, newInput: string): void {
    this.remappings.set(originalInput, newInput);
  }

  /** Clear a specific remapping. */
  clearRemap(originalInput: string): void {
    this.remappings.delete(originalInput);
  }

  /** Clear all remappings. */
  clearAllRemaps(): void {
    this.remappings.clear();
  }

  // ─── Assist Mode ────────────────────────────────────────────────────────

  /** Enable or disable assist mode (longer input windows, auto-combos). */
  setAssistMode(enabled: boolean): void {
    this.assistMode = enabled;
  }

  /** Check if assist mode is enabled. */
  isAssistModeEnabled(): boolean {
    return this.assistMode;
  }

  // ─── Haptic Feedback ────────────────────────────────────────────────────

  /** Trigger haptic feedback on a gamepad. */
  vibrate(gamepadIndex: number, pattern: HapticPattern): void {
    if (!this.gamepadConfig.hapticEnabled) return;
    if (typeof navigator === 'undefined') return;

    const gamepads = navigator.getGamepads();
    const gp = gamepads[gamepadIndex];
    if (!gp) return;

    // Standard Gamepad Haptics API
    const actuator = (gp as any).vibrationActuator;
    if (actuator) {
      actuator.playEffect('dual-rumble', {
        startDelay: pattern.delay ?? 0,
        duration: pattern.duration,
        weakMagnitude: pattern.intensity * 0.5,
        strongMagnitude: pattern.intensity,
      });
    }
  }

  /** Quick vibration pulse. */
  pulseVibrate(gamepadIndex: number, intensity = 0.5, duration = 100): void {
    this.vibrate(gamepadIndex, { duration, intensity });
  }

  // ─── Gamepad Polling ────────────────────────────────────────────────────

  /** Call each frame to poll gamepad state and update actions. */
  update(): void {
    // Transition 'pressed' → 'held' and 'released' → 'idle'
    for (const [id, state] of this.buttonStates) {
      if (state === 'pressed') this.buttonStates.set(id, 'held');
      if (state === 'released') this.buttonStates.set(id, 'idle');
    }

    // Poll gamepads
    this.pollGamepads();
  }

  private pollGamepads(): void {
    if (typeof navigator === 'undefined') return;

    const gamepads = navigator.getGamepads();
    for (const gp of gamepads) {
      if (!gp) continue;

      // Process buttons
      for (let i = 0; i < gp.buttons.length; i++) {
        const btnInput = `gamepad_btn_${i}`;
        const pressed = gp.buttons[i].pressed;
        this.processInput('gamepad', btnInput, pressed);
      }

      // Process axes
      for (let i = 0; i < gp.axes.length; i++) {
        let value = gp.axes[i];
        // Apply dead zone
        if (Math.abs(value) < this.gamepadConfig.deadZone) value = 0;
        value *= this.gamepadConfig.sensitivity;
        value = Math.max(-1, Math.min(1, value));

        const axisInput = `gamepad_axis_${i}`;
        this.updateAxis(axisInput, value);
      }
    }
  }

  // ─── Recording & Playback ──────────────────────────────────────────────

  /** Start recording inputs. */
  startRecording(): void {
    this.recording = true;
    this.recordBuffer = [];
  }

  /** Stop recording and return the recorded inputs. */
  stopRecording(): InputEvent[] {
    this.recording = false;
    return [...this.recordBuffer];
  }

  // ─── Events ─────────────────────────────────────────────────────────────

  /** Subscribe to an input event. */
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

  private emit(event: string, data: any): void {
    const cbs = this.listeners.get(event);
    if (cbs) for (const cb of cbs) cb(data);
  }

  // ─── Internal Handlers ──────────────────────────────────────────────────

  private onKeyDown = (e: KeyboardEvent): void => {
    const key = this.resolveRemap(e.code);
    this.processInput('keyboard', key, true, this.getModifiers(e));
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const key = this.resolveRemap(e.code);
    this.processInput('keyboard', key, false);
  };

  private onMouseDown = (e: MouseEvent): void => {
    this.processInput('mouse', `mouse_btn_${e.button}`, true);
  };

  private onMouseUp = (e: MouseEvent): void => {
    this.processInput('mouse', `mouse_btn_${e.button}`, false);
  };

  private onMouseMove = (e: MouseEvent): void => {
    this.emit('mouse:move', { x: e.clientX, y: e.clientY, dx: e.movementX, dy: e.movementY });
  };

  private onTouchStart = (e: TouchEvent): void => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      this.emit('touch:start', { id: touch.identifier, x: touch.clientX, y: touch.clientY });
    }
  };

  private onTouchEnd = (e: TouchEvent): void => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      this.emit('touch:end', { id: touch.identifier, x: touch.clientX, y: touch.clientY });
    }
  };

  private onGamepadConnected = (e: GamepadEvent): void => {
    this.gamepads.set(e.gamepad.index, e.gamepad);
    this.emit('gamepad:connected', { index: e.gamepad.index, id: e.gamepad.id });
  };

  private onGamepadDisconnected = (e: GamepadEvent): void => {
    this.gamepads.delete(e.gamepad.index);
    this.emit('gamepad:disconnected', { index: e.gamepad.index });
  };

  // ─── Internal Logic ─────────────────────────────────────────────────────

  private processInput(device: InputDevice, input: string, active: boolean, modifiers?: string[]): void {
    for (const [actionId, action] of this.actions) {
      if (!action.enabled) continue;
      if (action.context && action.context !== this.activeContext) continue;

      for (const binding of action.bindings) {
        if (binding.device !== device || binding.input !== input) continue;
        if (binding.modifiers && modifiers) {
          if (!binding.modifiers.every(m => modifiers.includes(m))) continue;
        }

        const oldState = this.buttonStates.get(actionId);
        if (active && (oldState === 'idle' || oldState === 'released')) {
          this.buttonStates.set(actionId, 'pressed');
          this.emit('action:pressed', { actionId, device, input });
        } else if (!active && (oldState === 'pressed' || oldState === 'held')) {
          this.buttonStates.set(actionId, 'released');
          this.emit('action:released', { actionId, device, input });
        }

        if (this.recording) {
          this.recordBuffer.push({
            timestamp: Date.now(),
            actionId,
            device,
            input,
            active,
          });
        }
      }
    }
  }

  private updateAxis(input: string, value: number): void {
    for (const [actionId, action] of this.actions) {
      if (!action.enabled) continue;
      if (action.context && action.context !== this.activeContext) continue;

      for (const binding of action.bindings) {
        if (binding.input !== input) continue;
        const adjustedValue = binding.axisPositive === false ? -value : value;
        this.axisValues.set(actionId, adjustedValue);
      }
    }
  }

  private resolveRemap(input: string): string {
    return this.remappings.get(input) ?? input;
  }

  private getModifiers(e: KeyboardEvent): string[] {
    const mods: string[] = [];
    if (e.shiftKey) mods.push('Shift');
    if (e.ctrlKey)  mods.push('Control');
    if (e.altKey)   mods.push('Alt');
    if (e.metaKey)  mods.push('Meta');
    return mods;
  }

  // ─── Serialization ─────────────────────────────────────────────────────

  /** Export all action mappings as JSON. */
  exportMappings(): object {
    const mappings: any[] = [];
    for (const action of this.actions.values()) {
      mappings.push({
        id: action.id,
        label: action.label,
        bindings: action.bindings,
        context: action.context,
        enabled: action.enabled,
      });
    }
    return { actions: mappings, remappings: Object.fromEntries(this.remappings) };
  }

  /** Import action mappings from JSON. */
  importMappings(data: { actions: any[]; remappings?: Record<string, string> }): void {
    this.actions.clear();
    this.buttonStates.clear();
    for (const entry of data.actions) {
      this.registerAction(entry as InputAction);
    }
    if (data.remappings) {
      this.remappings = new Map(Object.entries(data.remappings));
    }
  }
}

// ─── Input Event (for recording) ─────────────────────────────────────────────

interface InputEvent {
  timestamp: number;
  actionId:  string;
  device:    InputDevice;
  input:     string;
  active:    boolean;
}

// ─── Default Action Presets ──────────────────────────────────────────────────

/** Standard FPS/Platformer action set. */
export const DEFAULT_ACTIONS: InputAction[] = [
  {
    id: 'move_forward', label: 'Move Forward', enabled: true,
    bindings: [
      { device: 'keyboard', input: 'KeyW' },
      { device: 'gamepad', input: 'gamepad_axis_1', axisPositive: false },
    ],
  },
  {
    id: 'move_back', label: 'Move Back', enabled: true,
    bindings: [
      { device: 'keyboard', input: 'KeyS' },
      { device: 'gamepad', input: 'gamepad_axis_1', axisPositive: true },
    ],
  },
  {
    id: 'move_left', label: 'Move Left', enabled: true,
    bindings: [
      { device: 'keyboard', input: 'KeyA' },
      { device: 'gamepad', input: 'gamepad_axis_0', axisPositive: false },
    ],
  },
  {
    id: 'move_right', label: 'Move Right', enabled: true,
    bindings: [
      { device: 'keyboard', input: 'KeyD' },
      { device: 'gamepad', input: 'gamepad_axis_0', axisPositive: true },
    ],
  },
  {
    id: 'jump', label: 'Jump', enabled: true,
    bindings: [
      { device: 'keyboard', input: 'Space' },
      { device: 'gamepad', input: 'gamepad_btn_0' },
    ],
  },
  {
    id: 'attack', label: 'Attack', enabled: true,
    bindings: [
      { device: 'mouse', input: 'mouse_btn_0' },
      { device: 'gamepad', input: 'gamepad_btn_2' },
    ],
  },
  {
    id: 'interact', label: 'Interact', enabled: true,
    bindings: [
      { device: 'keyboard', input: 'KeyE' },
      { device: 'gamepad', input: 'gamepad_btn_3' },
    ],
  },
  {
    id: 'pause', label: 'Pause', enabled: true,
    bindings: [
      { device: 'keyboard', input: 'Escape' },
      { device: 'gamepad', input: 'gamepad_btn_9' },
    ],
  },
];
