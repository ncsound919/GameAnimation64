/**
 * AudioEngine.ts
 * Spatial audio engine with adaptive music for Pyrite64's vibe coding engine.
 *
 * Built on the Web Audio API for cross-platform compatibility.
 * Provides:
 *  - Spatial 3D audio with HRTF panning
 *  - Adaptive music system with cross-fading layers
 *  - Real-time audio parameter control
 *  - Audio visualization (waveform & spectrum data)
 *  - Sound effect management with pooling
 *
 * Design file reference: Component #5 — Audio Engine with Adaptive Music
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type AudioState = 'stopped' | 'playing' | 'paused';

export interface AudioClipConfig {
  /** Unique identifier for the clip. */
  id:       string;
  /** URL or path to the audio file. */
  url:      string;
  /** Base volume (0–1). */
  volume:   number;
  /** Playback rate multiplier. */
  pitch:    number;
  /** Whether to loop. */
  loop:     boolean;
  /** Spatial audio settings (null = 2D). */
  spatial?: SpatialConfig;
}

export interface SpatialConfig {
  /** Panning model: 'HRTF' for binaural, 'equalpower' for basic stereo. */
  panningModel:  'HRTF' | 'equalpower';
  /** Distance model for volume falloff. */
  distanceModel: 'inverse' | 'linear' | 'exponential';
  /** Reference distance for volume calculation. */
  refDistance:    number;
  /** Maximum distance beyond which volume is 0 (linear only). */
  maxDistance:    number;
  /** Rolloff factor for distance attenuation. */
  rolloffFactor: number;
}

/** An active sound instance with playback controls. */
export interface SoundHandle {
  readonly id: string;
  readonly clipId: string;
  state:   AudioState;
  play():  void;
  pause(): void;
  stop():  void;
  setVolume(v: number): void;
  setPitch(p: number): void;
  setPosition(x: number, y: number, z: number): void;
}

// ─── Music Layer ─────────────────────────────────────────────────────────────

export interface MusicLayer {
  /** Unique layer identifier. */
  id:       string;
  /** Audio clip URL. */
  url:      string;
  /** Base volume for this layer. */
  volume:   number;
  /** Whether this layer is currently active. */
  active:   boolean;
}

export interface MusicTrackConfig {
  /** Unique track identifier. */
  id:       string;
  /** BPM for synchronization. */
  bpm:      number;
  /** Layers that compose this track. */
  layers:   MusicLayer[];
  /** Cross-fade duration in seconds when changing layers. */
  fadeDuration: number;
}

// ─── Audio Engine ────────────────────────────────────────────────────────────

export class AudioEngine {
  private context:     AudioContext | null = null;
  private masterGain:  GainNode | null = null;
  private clipCache:   Map<string, AudioBuffer> = new Map();
  private activeSounds: Map<string, SoundInstance> = new Map();
  private analyser:    AnalyserNode | null = null;
  private nextSoundId  = 1;

  // Music system
  private currentTrack:  MusicTrackConfig | null = null;
  private musicSources:  Map<string, { source: AudioBufferSourceNode; gain: GainNode }> = new Map();
  private musicPlaying   = false;

  // Listener position (for spatial audio)
  private listenerPos: [number, number, number] = [0, 0, 0];
  private listenerFwd: [number, number, number] = [0, 0, -1];
  private listenerUp:  [number, number, number] = [0, 1, 0];

  /** Master volume (0–1). */
  get masterVolume(): number {
    return this.masterGain?.gain.value ?? 1;
  }
  set masterVolume(v: number) {
    if (this.masterGain) this.masterGain.gain.value = Math.max(0, Math.min(1, v));
  }

  // ─── Initialization ─────────────────────────────────────────────────────

  /** Initialize the audio context. Must be called after user interaction. */
  async init(): Promise<void> {
    if (this.context) return;
    this.context = new AudioContext();

    this.masterGain = this.context.createGain();
    this.masterGain.connect(this.context.destination);

    // Analyser for visualization
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 2048;
    this.masterGain.connect(this.analyser);
  }

  /** Resume the context if suspended (browser autoplay policy). */
  async resume(): Promise<void> {
    if (this.context?.state === 'suspended') {
      await this.context.resume();
    }
  }

  // ─── Clip Loading ───────────────────────────────────────────────────────

  /** Load an audio clip from a URL and cache it. */
  async loadClip(id: string, url: string): Promise<void> {
    if (this.clipCache.has(id)) return;
    if (!this.context) throw new Error('AudioEngine not initialized');

    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
    this.clipCache.set(id, audioBuffer);
  }

  /** Check if a clip is loaded. */
  isClipLoaded(id: string): boolean {
    return this.clipCache.has(id);
  }

  /** Unload a cached clip. */
  unloadClip(id: string): void {
    this.clipCache.delete(id);
  }

  // ─── Sound Playback ─────────────────────────────────────────────────────

  /** Play a sound effect. Returns a handle for controlling playback. */
  playSound(config: AudioClipConfig): SoundHandle | null {
    if (!this.context || !this.masterGain) return null;

    const buffer = this.clipCache.get(config.id);
    if (!buffer) return null;

    const soundId = `sound_${this.nextSoundId++}`;
    const instance = new SoundInstance(
      soundId, config, buffer, this.context, this.masterGain,
    );
    instance.play();
    this.activeSounds.set(soundId, instance);

    // Auto-cleanup on end
    instance.onEnded = () => this.activeSounds.delete(soundId);

    return instance;
  }

  /** Stop all active sounds. */
  stopAllSounds(): void {
    for (const instance of this.activeSounds.values()) {
      instance.stop();
    }
    this.activeSounds.clear();
  }

  // ─── Spatial Audio ──────────────────────────────────────────────────────

  /** Update the listener position (usually the camera). */
  setListenerPosition(x: number, y: number, z: number): void {
    this.listenerPos = [x, y, z];
    if (this.context) {
      const listener = this.context.listener;
      if (listener.positionX) {
        listener.positionX.value = x;
        listener.positionY.value = y;
        listener.positionZ.value = z;
      }
    }
  }

  /** Update the listener orientation. */
  setListenerOrientation(
    fwdX: number, fwdY: number, fwdZ: number,
    upX: number, upY: number, upZ: number,
  ): void {
    this.listenerFwd = [fwdX, fwdY, fwdZ];
    this.listenerUp = [upX, upY, upZ];
    if (this.context) {
      const listener = this.context.listener;
      if (listener.forwardX) {
        listener.forwardX.value = fwdX;
        listener.forwardY.value = fwdY;
        listener.forwardZ.value = fwdZ;
        listener.upX.value = upX;
        listener.upY.value = upY;
        listener.upZ.value = upZ;
      }
    }
  }

  // ─── Adaptive Music ─────────────────────────────────────────────────────

  /** Load and start a music track with its layers. */
  async startMusic(track: MusicTrackConfig): Promise<void> {
    if (!this.context || !this.masterGain) return;

    // Stop existing music
    this.stopMusic();
    this.currentTrack = track;

    // Load all layer buffers
    for (const layer of track.layers) {
      if (!this.clipCache.has(layer.id)) {
        await this.loadClip(layer.id, layer.url);
      }
    }

    // Create synchronized sources for all layers
    const startTime = this.context.currentTime + 0.1;
    for (const layer of track.layers) {
      const buffer = this.clipCache.get(layer.id);
      if (!buffer) continue;

      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const gain = this.context.createGain();
      gain.gain.value = layer.active ? layer.volume : 0;
      source.connect(gain);
      gain.connect(this.masterGain);
      source.start(startTime);

      this.musicSources.set(layer.id, { source, gain });
    }

    this.musicPlaying = true;
  }

  /** Activate or deactivate a music layer with cross-fade. */
  setLayerActive(layerId: string, active: boolean): void {
    if (!this.currentTrack || !this.context) return;

    const entry = this.musicSources.get(layerId);
    const layer = this.currentTrack.layers.find(l => l.id === layerId);
    if (!entry || !layer) return;

    const fadeDuration = this.currentTrack.fadeDuration;
    const now = this.context.currentTime;
    entry.gain.gain.cancelScheduledValues(now);
    entry.gain.gain.setValueAtTime(entry.gain.gain.value, now);
    entry.gain.gain.linearRampToValueAtTime(
      active ? layer.volume : 0,
      now + fadeDuration,
    );
    layer.active = active;
  }

  /** Set the volume of a specific music layer. */
  setLayerVolume(layerId: string, volume: number): void {
    const entry = this.musicSources.get(layerId);
    if (entry) entry.gain.gain.value = volume;
  }

  /** Stop all music playback. */
  stopMusic(): void {
    for (const { source } of this.musicSources.values()) {
      try { source.stop(); } catch { /* already stopped */ }
    }
    this.musicSources.clear();
    this.musicPlaying = false;
    this.currentTrack = null;
  }

  // ─── Visualization ──────────────────────────────────────────────────────

  /** Get frequency-domain data (spectrum analyzer). */
  getFrequencyData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(0);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  /** Get time-domain data (waveform). */
  getWaveformData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(0);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);
    return data;
  }

  // ─── Cleanup ────────────────────────────────────────────────────────────

  /** Dispose the entire audio engine. */
  async dispose(): Promise<void> {
    this.stopAllSounds();
    this.stopMusic();
    this.clipCache.clear();
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
  }
}

// ─── Sound Instance ──────────────────────────────────────────────────────────

class SoundInstance implements SoundHandle {
  readonly id: string;
  readonly clipId: string;
  state: AudioState = 'stopped';
  onEnded?: () => void;

  private source:  AudioBufferSourceNode | null = null;
  private gainNode: GainNode;
  private panner:  PannerNode | null = null;
  private buffer:  AudioBuffer;
  private ctx:     AudioContext;
  private dest:    AudioNode;
  private config:  AudioClipConfig;
  private startOffset = 0;
  private startTime   = 0;

  constructor(
    id: string,
    config: AudioClipConfig,
    buffer: AudioBuffer,
    ctx: AudioContext,
    dest: AudioNode,
  ) {
    this.id = id;
    this.clipId = config.id;
    this.config = config;
    this.buffer = buffer;
    this.ctx = ctx;
    this.dest = dest;

    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = config.volume;

    // Spatial setup
    if (config.spatial) {
      this.panner = ctx.createPanner();
      this.panner.panningModel = config.spatial.panningModel;
      this.panner.distanceModel = config.spatial.distanceModel;
      this.panner.refDistance = config.spatial.refDistance;
      this.panner.maxDistance = config.spatial.maxDistance;
      this.panner.rolloffFactor = config.spatial.rolloffFactor;
      this.gainNode.connect(this.panner);
      this.panner.connect(dest);
    } else {
      this.gainNode.connect(dest);
    }
  }

  play(): void {
    if (this.state === 'playing') return;
    this.source = this.ctx.createBufferSource();
    this.source.buffer = this.buffer;
    this.source.loop = this.config.loop;
    this.source.playbackRate.value = this.config.pitch;
    this.source.connect(this.gainNode);
    this.source.start(0, this.startOffset);
    this.startTime = this.ctx.currentTime;
    this.state = 'playing';

    this.source.onended = () => {
      if (this.state === 'playing') {
        this.state = 'stopped';
        this.startOffset = 0;
        this.onEnded?.();
      }
    };
  }

  pause(): void {
    if (this.state !== 'playing' || !this.source) return;
    this.startOffset += this.ctx.currentTime - this.startTime;
    this.source.stop();
    this.source = null;
    this.state = 'paused';
  }

  stop(): void {
    if (this.source) {
      try { this.source.stop(); } catch { /* already stopped */ }
      this.source = null;
    }
    this.state = 'stopped';
    this.startOffset = 0;
  }

  setVolume(v: number): void {
    this.gainNode.gain.value = Math.max(0, Math.min(1, v));
  }

  setPitch(p: number): void {
    if (this.source) this.source.playbackRate.value = p;
  }

  setPosition(x: number, y: number, z: number): void {
    if (this.panner) {
      if (this.panner.positionX) {
        this.panner.positionX.value = x;
        this.panner.positionY.value = y;
        this.panner.positionZ.value = z;
      }
    }
  }
}
