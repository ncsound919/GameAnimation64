/**
 * HowlerAudioEngine.ts
 * Audio engine wrapper using Howler.js for Pyrite64's game engine.
 *
 * Replaces the custom AudioEngine.ts with the industry-standard
 * Howler.js library for robust cross-browser audio support.
 *
 * Benefits over custom implementation:
 *  - Cross-browser Web Audio API compatibility
 *  - Automatic fallback to HTML5 Audio
 *  - Advanced spatial audio (3D positioning)
 *  - Audio sprite support
 *  - Better mobile support
 *  - Active maintenance
 *
 * Design file reference: Component #5 — Audio Engine with Adaptive Music
 */

import { Howl, Howler } from 'howler';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AudioClipConfig {
  id:      string;
  url:     string | string[];  // Can provide multiple formats for fallback
  volume:  number;             // 0–1
  loop:    boolean;
  sprite?: Record<string, [number, number]>; // name: [start_ms, duration_ms]
  spatial: boolean;            // Enable 3D positioning
  pool:    number;             // Max concurrent instances (for SFX)
}

export interface AudioSourceConfig {
  clipId:      string;
  volume:      number;    // 0–1
  pitch:       number;    // Playback rate (0.5 = half speed, 2.0 = double speed)
  loop:        boolean;
  spatial:     boolean;
  position:    [number, number, number];
  maxDistance: number;
  refDistance: number;    // Distance at which volume starts to decrease
  rolloffFactor: number;  // How quickly sound attenuates
  autoPlay:    boolean;
}

export interface MusicLayerConfig {
  id:       string;
  url:      string | string[];
  volume:   number;
  loop:     boolean;
  fadeTime: number;  // Fade in/out duration in ms
}

// ─── Audio Clip Registry ──────────────────────────────────────────────────────

class AudioClip {
  readonly id:     string;
  readonly howl:   Howl;
  readonly config: AudioClipConfig;

  constructor(config: AudioClipConfig) {
    this.id = config.id;
    this.config = config;

    this.howl = new Howl({
      src:    config.url,
      volume: config.volume,
      loop:   config.loop,
      sprite: config.sprite,
      pool:   config.pool || 5,
      // Spatial audio settings
      ...(config.spatial ? {
        pannerAttr: {
          panningModel: 'HRTF',
          distanceModel: 'inverse',
          refDistance: 1,
          maxDistance: 100,
          rolloffFactor: 1,
        }
      } : {}),
    });
  }

  play(spriteId?: string): number {
    return this.howl.play(spriteId);
  }

  stop(): void {
    this.howl.stop();
  }

  pause(): void {
    this.howl.pause();
  }

  fade(from: number, to: number, duration: number, soundId?: number): void {
    this.howl.fade(from, to, duration, soundId);
  }

  unload(): void {
    this.howl.unload();
  }
}

// ─── Audio Source (Instance) ──────────────────────────────────────────────────

export class AudioSource {
  private clip: AudioClip | null = null;
  private soundId: number | null = null;
  private config: AudioSourceConfig;

  constructor(config: Partial<AudioSourceConfig> = {}) {
    this.config = {
      clipId: '',
      volume: 1.0,
      pitch: 1.0,
      loop: false,
      spatial: false,
      position: [0, 0, 0],
      maxDistance: 100,
      refDistance: 1,
      rolloffFactor: 1,
      autoPlay: false,
      ...config,
    };
  }

  /** Load an audio clip by ID and optionally start playing. */
  loadClip(clip: AudioClip): void {
    this.clip = clip;

    if (this.config.autoPlay) {
      this.play();
    }
  }

  play(): void {
    if (!this.clip) return;

    this.soundId = this.clip.play();

    if (this.soundId !== null && this.soundId !== undefined) {
      this.clip.howl.volume(this.config.volume, this.soundId);
      this.clip.howl.rate(this.config.pitch, this.soundId);
      this.clip.howl.loop(this.config.loop, this.soundId);

      if (this.config.spatial) {
        this.updatePosition(this.config.position);
      }
    }
  }

  stop(): void {
    if (!this.clip || this.soundId === null) return;
    this.clip.howl.stop(this.soundId);
    this.soundId = null;
  }

  pause(): void {
    if (!this.clip || this.soundId === null) return;
    this.clip.howl.pause(this.soundId);
  }

  resume(): void {
    if (!this.clip || this.soundId === null) return;
    this.clip.howl.play(this.soundId);
  }

  setVolume(vol: number): void {
    this.config.volume = vol;
    if (this.clip && this.soundId !== null) {
      this.clip.howl.volume(vol, this.soundId);
    }
  }

  setPitch(pitch: number): void {
    this.config.pitch = pitch;
    if (this.clip && this.soundId !== null) {
      this.clip.howl.rate(pitch, this.soundId);
    }
  }

  updatePosition(pos: [number, number, number]): void {
    this.config.position = pos;
    if (this.clip && this.soundId !== null && this.config.spatial) {
      this.clip.howl.pos(pos[0], pos[1], pos[2], this.soundId);
    }
  }

  isPlaying(): boolean {
    if (!this.clip || this.soundId === null) return false;
    return this.clip.howl.playing(this.soundId);
  }
}

// ─── Howler Audio Engine ──────────────────────────────────────────────────────

export class HowlerAudioEngine {
  private clips: Map<string, AudioClip> = new Map();
  private musicLayers: Map<string, Howl> = new Map();
  private musicLayerBaseVolumes: Map<string, number> = new Map();
  private sources: AudioSource[] = [];
  private masterVolume = 1.0;
  private musicVolume = 1.0;
  private sfxVolume = 1.0;
  private listenerPosition: [number, number, number] = [0, 0, 0];
  private listenerOrientation: [number, number, number, number, number, number] = [0, 0, -1, 0, 1, 0];

  constructor() {
    // Set up global Howler settings
    Howler.autoUnlock = true; // Auto-unlock audio on first user interaction (mobile)
  }

  // ─── Clip Management ────────────────────────────────────────────────────

  /** Register an audio clip for later use. */
  registerClip(config: AudioClipConfig): void {
    const clip = new AudioClip(config);
    this.clips.set(config.id, clip);
  }

  /** Get a registered clip by ID. */
  getClip(id: string): AudioClip | undefined {
    return this.clips.get(id);
  }

  /** Unload and remove a clip. */
  unloadClip(id: string): void {
    const clip = this.clips.get(id);
    if (clip) {
      clip.unload();
      this.clips.delete(id);
    }
  }

  // ─── Audio Source Management ────────────────────────────────────────────

  /** Create a new audio source (playback instance). */
  createSource(config?: Partial<AudioSourceConfig>): AudioSource {
    const source = new AudioSource(config);
    this.sources.push(source);
    return source;
  }

  /** Play a one-shot sound effect. */
  playSFX(clipId: string, volume = 1.0, pitch = 1.0): void {
    const clip = this.clips.get(clipId);
    if (!clip) {
      console.warn(`Audio clip not found: ${clipId}`);
      return;
    }

    const soundId = clip.play();
    if (soundId !== null && soundId !== undefined) {
      clip.howl.volume(volume * this.sfxVolume * this.masterVolume, soundId);
      clip.howl.rate(pitch, soundId);
    }
  }

  /** Play a spatial sound at a world position. */
  playSpatialSFX(
    clipId: string,
    position: [number, number, number],
    volume = 1.0,
    pitch = 1.0
  ): void {
    const clip = this.clips.get(clipId);
    if (!clip) {
      console.warn(`Audio clip not found: ${clipId}`);
      return;
    }

    const soundId = clip.play();
    if (soundId !== null && soundId !== undefined) {
      clip.howl.volume(volume * this.sfxVolume * this.masterVolume, soundId);
      clip.howl.rate(pitch, soundId);
      clip.howl.pos(position[0], position[1], position[2], soundId);
    }
  }

  // ─── Adaptive Music System ──────────────────────────────────────────────

  /**
   * Load a music layer for adaptive music.
   * Layers can be dynamically faded in/out to create responsive soundtracks.
   */
  loadMusicLayer(config: MusicLayerConfig): void {
    const baseVolume = Math.max(0, Math.min(1, config.volume));
    const howl = new Howl({
      src:    config.url,
      volume: this.computeLayerVolume(baseVolume),
      loop:   config.loop,
      preload: true,
    });

    this.musicLayers.set(config.id, howl);
    this.musicLayerBaseVolumes.set(config.id, baseVolume);
  }

  private computeLayerVolume(baseVolume: number): number {
    return baseVolume * this.musicVolume * this.masterVolume;
  }

  /** Play a music layer (or restart if already playing). */
  playMusicLayer(id: string, fadeInMs = 0): void {
    const layer = this.musicLayers.get(id);
    if (!layer) {
      console.warn(`Music layer not found: ${id}`);
      return;
    }

    const baseVolume = this.musicLayerBaseVolumes.get(id) ?? 1;
    const targetVolume = this.computeLayerVolume(baseVolume);

    if (!layer.playing()) {
      layer.volume(targetVolume);
      layer.play();
      if (fadeInMs > 0) {
        layer.fade(0, targetVolume, fadeInMs);
      }
    }
  }

  /** Stop a music layer. */
  stopMusicLayer(id: string, fadeOutMs = 0): void {
    const layer = this.musicLayers.get(id);
    if (!layer) return;

    if (fadeOutMs > 0) {
      layer.fade(layer.volume(), 0, fadeOutMs);
      layer.once('fade', () => layer.stop());
    } else {
      layer.stop();
    }
  }

  /** Set volume for a specific music layer. */
  setMusicLayerVolume(id: string, volume: number, fadeDuration = 0): void {
    const layer = this.musicLayers.get(id);
    if (!layer) return;

    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.musicLayerBaseVolumes.set(id, clampedVolume);
    const targetVol = this.computeLayerVolume(clampedVolume);

    if (fadeDuration > 0) {
      layer.fade(layer.volume(), targetVol, fadeDuration);
    } else {
      layer.volume(targetVol);
    }
  }

  /** Stop all music layers. */
  stopAllMusic(fadeOutMs = 1000): void {
    for (const [id, _] of this.musicLayers) {
      this.stopMusicLayer(id, fadeOutMs);
    }
  }

  // ─── Volume Control ─────────────────────────────────────────────────────

  setMasterVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    Howler.volume(this.masterVolume);
  }

  setMusicVolume(vol: number): void {
    this.musicVolume = Math.max(0, Math.min(1, vol));
    // Update all active music layers
    for (const [id, layer] of this.musicLayers) {
      const baseVolume = this.musicLayerBaseVolumes.get(id) ?? 1;
      layer.volume(this.computeLayerVolume(baseVolume));
    }
  }

  setSFXVolume(vol: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
  }

  getMasterVolume(): number { return this.masterVolume; }
  getMusicVolume(): number { return this.musicVolume; }
  getSFXVolume(): number { return this.sfxVolume; }

  // ─── Spatial Audio (Listener) ───────────────────────────────────────────

  /** Update listener position (camera/player position in world). */
  setListenerPosition(pos: [number, number, number]): void {
    this.listenerPosition = pos;
    Howler.pos(pos[0], pos[1], pos[2]);
  }

  /** Update listener orientation (forward and up vectors). */
  setListenerOrientation(
    forward: [number, number, number],
    up: [number, number, number]
  ): void {
    this.listenerOrientation = [...forward, ...up] as [number, number, number, number, number, number];
    Howler.orientation(
      forward[0], forward[1], forward[2],
      up[0], up[1], up[2]
    );
  }

  // ─── Utility ────────────────────────────────────────────────────────────

  /** Mute all audio. */
  mute(): void {
    Howler.mute(true);
  }

  /** Unmute all audio. */
  unmute(): void {
    Howler.mute(false);
  }

  /** Get global mute state. */
  isMuted(): boolean {
    return Howler._muted;
  }

  /** Clean up all resources. */
  dispose(): void {
    // Stop and unload all clips
    for (const clip of this.clips.values()) {
      clip.unload();
    }
    this.clips.clear();

    // Stop and unload all music
    for (const layer of this.musicLayers.values()) {
      layer.unload();
    }
    this.musicLayers.clear();
    this.musicLayerBaseVolumes.clear();

    this.sources = [];
  }

  /** Get audio context state (for debugging). */
  getState(): string {
    return Howler.ctx?.state || 'unknown';
  }

  /** Manually unlock audio (for mobile/browsers requiring user gesture). */
  unlock(): void {
    Howler.ctx?.resume();
  }
}
