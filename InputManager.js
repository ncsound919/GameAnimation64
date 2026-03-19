/**
 * InputManager.js
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

// ─── Input Manager ───────────────────────────────────────────────────────────

export class InputManager {
  actions = new Map();
  buttonStates = new Map();
  axisValues = new Map();
  activeContext = null;
  gamepads = new Map();
  listeners = new Map();
  recording = false;
  recordBuffer = [];

  gamepadConfig = {
    deadZone:      0.15,
    hapticEnabled: true,
    sensitivity:   1.0,
  };

  // Accessibility
  assistMode = false;
  remappings = new Map();

  // ─── Initialization ─────────────────────────────────────────────────────

  /** Attach input listeners to the DOM. */
  attach(element) {
    element.addEventListener('keydown', this.onKeyDown);
    element.addEventListener('keyup', this.onKeyUp);
    element.addEventListener('mousedown', this.onMouseDown);
    element.addEventListener('mouseup', this.onMouseUp);
    element.addEventListener('mousemove', this.onMouseMove);
    element.addEventListener('touchstart', this.onTouchStart);
    element.addEventListener('touchend', this.onTouchEnd);

    // Gamepad connection
    if (typeof window !== 'undefined') {
      window.addEventListener('gamepadconnected', this.onGamepadConnected);
      window.addEventListener('gamepaddisconnected', this.onGamepadDisconnected);
    }
  }

  /** Detach all input listeners. */
  detach(element) {
    element.removeEventListener('keydown', this.onKeyDown);
    element.removeEventListener('keyup', this.onKeyUp);
    element.removeEventListener('mousedown', this.onMouseDown);
    element.removeEventListener('mouseup', this.onMouseUp);
    element.removeEventListener('mousemove', this.onMouseMove);
    element.removeEventListener('touchstart', this.onTouchStart);
    element.removeEventListener('touchend', this.onTouchEnd);
  }

  // ─── Action Management ──────────────────────────────────────────────────

  /** Register an input action with its bindings. */
  registerAction(action) {
    this.actions.set(action.id, action);
    this.buttonStates.set(action.id, 'idle');
  }

  /** Remove an input action. */
  unregisterAction(id) {
    this.actions.delete(id);
    this.buttonStates.delete(id);
  }

  /** Get the current state of an action. */
  getActionState(id) {
    return this.buttonStates.get(id) ?? 'idle';
  }

  /** Check if an action was just pressed this frame. */
  isActionPressed(id) {
    return this.buttonStates.get(id) === 'pressed';
  }

  /** Check if an action is currently held. */
  isActionHeld(id) {
    const state = this.buttonStates.get(id);
    return state === 'pressed' || state === 'held';
  }

  /** Check if an action was just released this frame. */
  isActionReleased(id) {
    return this.buttonStates.get(id) === 'released';
  }

  /** Get the axis value for an action (-1 to 1). */
  getAxis(id) {
    return this.axisValues.get(id) ?? 0;
  }

  // ─── Context ────────────────────────────────────────────────────────────

  /** Set the active input context (e.g. 'gameplay', 'menu', 'cutscene'). */
  setContext(context) {
    this.activeContext = context;
  }

  /** Get the active input context. */
  getContext() {
    return this.activeContext;
  }

  // ─── Key Remapping ──────────────────────────────────────────────────────

  /** Remap an input to a different key (for accessibility). */
  remap(originalInput, newInput) {
    this.remappings.set(originalInput, newInput);
  }

  /** Clear a specific remapping. */
  clearRemap(originalInput) {
    this.remappings.delete(originalInput);
  }

  /** Clear all remappings. */
  clearAllRemaps() {
    this.remappings.clear();
  }

  // ─── Assist Mode ────────────────────────────────────────────────────────

  /** Enable or disable assist mode (longer input windows, auto-combos). */
  setAssistMode(enabled) {
    this.assistMode = enabled;
  }

  /** Check if assist mode is enabled. */
  isAssistModeEnabled() {
    return this.assistMode;
  }

  // ─── Haptic Feedback ────────────────────────────────────────────────────

  /** Trigger haptic feedback on a gamepad. */
  vibrate(gamepadIndex, pattern) {
    if (!this.gamepadConfig.hapticEnabled) return;
    if (typeof navigator === 'undefined') return;

    const gamepads = navigator.getGamepads();
    const gp = gamepads[gamepadIndex];
    if (!gp) return;

    // Standard Gamepad Haptics API
    const actuator = gp.vibrationActuator;
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
  pulseVibrate(gamepadIndex, intensity = 0.5, duration = 100) {
    this.vibrate(gamepadIndex, { duration, intensity });
  }

  // ─── Gamepad Polling ────────────────────────────────────────────────────

  /** Call each frame to poll gamepad state and update actions. */
  update() {
    // Transition 'pressed' → 'held' and 'released' → 'idle'
    for (const [id, state] of this.buttonStates) {
      if (state === 'pressed') this.buttonStates.set(id, 'held');
      if (state === 'released') this.buttonStates.set(id, 'idle');
    }

    // Poll gamepads
    this.pollGamepads();
  }

  pollGamepads() {
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
  startRecording() {
    this.recording = true;
    this.recordBuffer = [];
  }

  /** Stop recording and return the recorded inputs. */
  stopRecording() {
    this.recording = false;
    return [...this.recordBuffer];
  }

  // ─── Events ─────────────────────────────────────────────────────────────

  /** Subscribe to an input event. */
  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(callback);
  }

  /** Unsubscribe from an event. */
  off(event, callback) {
    const cbs = this.listeners.get(event);
    if (!cbs) return;
    const idx = cbs.indexOf(callback);
    if (idx !== -1) cbs.splice(idx, 1);
  }

  emit(event, data) {
    const cbs = this.listeners.get(event);
    if (cbs) for (const cb of cbs) cb(data);
  }

  // ─── Internal Handlers ──────────────────────────────────────────────────

  onKeyDown = (e) => {
    const key = this.resolveRemap(e.code);
    this.processInput('keyboard', key, true, this.getModifiers(e));
  };

  onKeyUp = (e) => {
    const key = this.resolveRemap(e.code);
    this.processInput('keyboard', key, false);
  };

  onMouseDown = (e) => {
    this.processInput('mouse', `mouse_btn_${e.button}`, true);
  };

  onMouseUp = (e) => {
    this.processInput('mouse', `mouse_btn_${e.button}`, false);
  };

  onMouseMove = (e) => {
    this.emit('mouse:move', { x: e.clientX, y: e.clientY, dx: e.movementX, dy: e.movementY });
  };

  onTouchStart = (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      this.emit('touch:start', { id: touch.identifier, x: touch.clientX, y: touch.clientY });
    }
  };

  onTouchEnd = (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      this.emit('touch:end', { id: touch.identifier, x: touch.clientX, y: touch.clientY });
    }
  };

  onGamepadConnected = (e) => {
    this.gamepads.set(e.gamepad.index, e.gamepad);
    this.emit('gamepad:connected', { index: e.gamepad.index, id: e.gamepad.id });
  };

  onGamepadDisconnected = (e) => {
    this.gamepads.delete(e.gamepad.index);
    this.emit('gamepad:disconnected', { index: e.gamepad.index });
  };

  // ─── Internal Logic ─────────────────────────────────────────────────────

  processInput(device, input, active, modifiers) {
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

  updateAxis(input, value) {
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

  resolveRemap(input) {
    return this.remappings.get(input) ?? input;
  }

  getModifiers(e) {
    const mods = [];
    if (e.shiftKey) mods.push('Shift');
    if (e.ctrlKey)  mods.push('Control');
    if (e.altKey)   mods.push('Alt');
    if (e.metaKey)  mods.push('Meta');
    return mods;
  }

  // ─── Serialization ─────────────────────────────────────────────────────

  /** Export all action mappings as JSON. */
  exportMappings() {
    const mappings = [];
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
  importMappings(data) {
    this.actions.clear();
    this.buttonStates.clear();
    for (const entry of data.actions) {
      this.registerAction(entry);
    }
    if (data.remappings) {
      this.remappings = new Map(Object.entries(data.remappings));
    }
  }
}

// ─── Input Event (for recording) ─────────────────────────────────────────────

// ─── Default Action Presets ──────────────────────────────────────────────────

/** Standard FPS/Platformer action set. */
export const DEFAULT_ACTIONS = [
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
