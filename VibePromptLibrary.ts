/**
 * VibePromptLibrary.ts
 * Domain-specific prompt templates for Pyrite64 vibe coding.
 *
 * Each template carries a title, description, category, and a
 * `build(ctx)` function that returns a fully-formed user prompt
 * string ready to feed into VibeNode.generate().
 *
 * Categories:
 *  - movement    – locomotion, physics, pathfinding
 *  - animation   – clip playback, blending, state machines
 *  - combat      – damage, health, spawning, projectiles
 *  - ai          – enemy behavior, patrol, chase, flee
 *  - camera      – follow, shake, transitions
 *  - audio       – music, SFX, spatial audio
 *  - ui          – HUD, score, health bars
 *  - lifecycle   – init, destroy, scene transitions
 */

import type { VibeContext } from './VibeNode.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PromptCategory =
  | 'movement'
  | 'animation'
  | 'combat'
  | 'ai'
  | 'camera'
  | 'audio'
  | 'ui'
  | 'lifecycle';

export interface PromptTemplate {
  id:          string;
  title:       string;
  description: string;
  category:    PromptCategory;
  /** Icon glyph for the dashboard chip */
  icon:        string;
  /** Minimum entity requirements (optional) */
  requires?:   { animations?: boolean; sounds?: boolean; otherEntities?: boolean };
  /** Build the final prompt string given current context */
  build:       (ctx: VibeContext) => string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function entityOr(ctx: VibeContext, fallback: string): string {
  return ctx.entityName || fallback;
}

function firstAnimOr(ctx: VibeContext, fallback: string): string {
  return ctx.animations[0] ?? fallback;
}

function firstSoundOr(ctx: VibeContext, fallback: string): string {
  return ctx.sounds[0] ?? fallback;
}

function otherEntities(ctx: VibeContext): string[] {
  return ctx.sceneEntities.filter(e => e !== ctx.entityName);
}

// ─── Template library ─────────────────────────────────────────────────────────

export const PROMPT_LIBRARY: PromptTemplate[] = [

  // ── Movement ───────────────────────────────────────────────────────────────

  {
    id: 'move-wasd',
    title: 'WASD Movement',
    description: 'Move entity with analog stick / WASD at a fixed speed',
    category: 'movement',
    icon: '↕',
    build: (ctx) =>
      `Make "${entityOr(ctx, 'Player')}" move using joystick input at speed 2.0. ` +
      `Use OnTick to read input and SetVelocity to apply. ` +
      `Clamp to N64 fixed-point range.`,
  },
  {
    id: 'move-toward-target',
    title: 'Move Toward Target',
    description: 'Smoothly move toward another entity',
    category: 'movement',
    icon: '→',
    requires: { otherEntities: true },
    build: (ctx) => {
      const target = otherEntities(ctx)[0] ?? 'Goal';
      return (
        `Make "${entityOr(ctx, 'Player')}" move toward "${target}" at speed 1.5. ` +
        `Use MoveToward node. When distance < 0.5, stop and fire a "reached" event.`
      );
    },
  },
  {
    id: 'move-patrol',
    title: 'Patrol Path',
    description: 'Walk between two waypoints',
    category: 'movement',
    icon: '⇄',
    build: (ctx) =>
      `Make "${entityOr(ctx, 'Guard')}" patrol between two positions: ` +
      `(0,0,0) and (10,0,0). Use MoveToward for each leg, Wait 1.0s at each end, ` +
      `and Repeat indefinitely. Play walk animation while moving.`,
  },
  {
    id: 'move-jump',
    title: 'Jump',
    description: 'Apply an upward impulse and return to ground',
    category: 'movement',
    icon: '⤴',
    build: (ctx) =>
      `When the A button is pressed, make "${entityOr(ctx, 'Player')}" jump: ` +
      `Set Y velocity to 8.0, wait 0.4s, then set Y velocity to -12.0 (gravity). ` +
      `Play jump animation during ascent.`,
  },

  // ── Animation ──────────────────────────────────────────────────────────────

  {
    id: 'anim-idle-walk',
    title: 'Idle ↔ Walk Blend',
    description: 'Blend between idle and walk based on speed',
    category: 'animation',
    icon: '🏃',
    requires: { animations: true },
    build: (ctx) =>
      `On each tick, check "${entityOr(ctx, 'Player')}" speed. ` +
      `If speed > 0.1, play "${firstAnimOr(ctx, 'walk')}" with blend factor proportional to speed. ` +
      `Otherwise blend to "${ctx.animations[1] ?? 'idle'}". Use SetAnimBlend.`,
  },
  {
    id: 'anim-attack-combo',
    title: 'Attack Combo',
    description: 'Chain 2 attack anims on repeated button press',
    category: 'animation',
    icon: '⚔',
    requires: { animations: true },
    build: (ctx) =>
      `When B button is pressed, play "attack1". If B is pressed again within 0.3s, ` +
      `play "attack2" instead. Use WaitAnimEnd between steps. ` +
      `Return to idle after combo ends.`,
  },
  {
    id: 'anim-on-event',
    title: 'Anim on Event',
    description: 'Play an animation when a signal is received',
    category: 'animation',
    icon: '▶',
    requires: { animations: true },
    build: (ctx) =>
      `When "${entityOr(ctx, 'Door')}" receives the "open" event, ` +
      `play the "${firstAnimOr(ctx, 'open')}" animation once, then stop.`,
  },

  // ── Combat ─────────────────────────────────────────────────────────────────

  {
    id: 'combat-damage',
    title: 'Take Damage',
    description: 'Reduce health on collision, flash red, destroy at 0',
    category: 'combat',
    icon: '💥',
    build: (ctx) =>
      `When "${entityOr(ctx, 'Player')}" collides with any entity tagged "hazard", ` +
      `reduce health by 1. Flash the entity red for 0.2s. ` +
      `If health reaches 0, play death animation and Destroy after 1s.`,
  },
  {
    id: 'combat-projectile',
    title: 'Shoot Projectile',
    description: 'Spawn a projectile moving forward',
    category: 'combat',
    icon: '●→',
    build: (ctx) =>
      `When B button is pressed, Spawn a "Bullet" prefab at "${entityOr(ctx, 'Player')}" position. ` +
      `Set the bullet velocity to (0, 0, 5). After 2s, Destroy the bullet. ` +
      `Play "${firstSoundOr(ctx, 'shoot')}" sound on spawn.`,
  },
  {
    id: 'combat-health-pickup',
    title: 'Health Pickup',
    description: 'Collect item to restore health',
    category: 'combat',
    icon: '♥',
    build: (ctx) =>
      `When "${entityOr(ctx, 'HealthPack')}" collides with "Player", ` +
      `add 1 to Player health (max 3), play "${firstSoundOr(ctx, 'pickup')}" sound, ` +
      `and Destroy this entity.`,
  },

  // ── AI ─────────────────────────────────────────────────────────────────────

  {
    id: 'ai-chase',
    title: 'Chase Player',
    description: 'Enemy follows the player when close',
    category: 'ai',
    icon: '👁',
    requires: { otherEntities: true },
    build: (ctx) =>
      `On each tick, get distance from "${entityOr(ctx, 'Enemy')}" to "Player". ` +
      `If distance < 8, MoveToward "Player" at speed 1.5 and play "run" anim. ` +
      `If distance >= 8, stop and play "idle".`,
  },
  {
    id: 'ai-flee',
    title: 'Flee from Player',
    description: 'Run away when player is close',
    category: 'ai',
    icon: '🏃‍♂️',
    requires: { otherEntities: true },
    build: (ctx) =>
      `On each tick if "${entityOr(ctx, 'Rabbit')}" is within distance 5 of "Player", ` +
      `set velocity away from Player at speed 3.0. Otherwise play "idle" and stop.`,
  },
  {
    id: 'ai-state-machine',
    title: 'State Machine (3 states)',
    description: 'Idle → patrol → chase with transitions',
    category: 'ai',
    icon: '⚙',
    build: (ctx) =>
      `Create a 3-state behavior for "${entityOr(ctx, 'Guard')}": ` +
      `IDLE: wait 2s then go to PATROL. ` +
      `PATROL: move between (0,0,0) and (10,0,0), if distance to "Player" < 6 go to CHASE. ` +
      `CHASE: MoveToward "Player" at speed 2.0, if distance > 10 go to IDLE. ` +
      `Use Repeat to keep the state machine running.`,
  },

  // ── Camera ─────────────────────────────────────────────────────────────────

  {
    id: 'cam-follow',
    title: 'Camera Follow',
    description: 'Smooth camera follow behind an entity',
    category: 'camera',
    icon: '📷',
    build: (ctx) =>
      `On each tick, set "MainCamera" position to "${entityOr(ctx, 'Player')}" ` +
      `position + offset (0, 5, -8). Lerp the position with factor 0.1 for smoothness.`,
  },
  {
    id: 'cam-shake',
    title: 'Camera Shake',
    description: 'Short screen shake on impact',
    category: 'camera',
    icon: '📳',
    build: (ctx) =>
      `When "${entityOr(ctx, 'Player')}" receives a "hit" event, ` +
      `shake the "MainCamera" by adding random offsets (±0.3) to position ` +
      `for 0.3s (5 iterations of Wait 0.06), then restore original position.`,
  },

  // ── Audio ──────────────────────────────────────────────────────────────────

  {
    id: 'audio-bgm',
    title: 'Background Music',
    description: 'Play BGM on scene start',
    category: 'audio',
    icon: '🎵',
    requires: { sounds: true },
    build: (ctx) =>
      `On Start, play "${firstSoundOr(ctx, 'bgm')}" sound in a loop.`,
  },
  {
    id: 'audio-footsteps',
    title: 'Footstep SFX',
    description: 'Play footstep sound while walking',
    category: 'audio',
    icon: '👟',
    requires: { sounds: true },
    build: (ctx) =>
      `On each tick, if "${entityOr(ctx, 'Player')}" speed > 0.1, ` +
      `play "${firstSoundOr(ctx, 'step')}" every 0.4s. Stop when speed drops to 0.`,
  },

  // ── UI ─────────────────────────────────────────────────────────────────────

  {
    id: 'ui-score',
    title: 'Score Counter',
    description: 'Increment score on coin collect',
    category: 'ui',
    icon: '🪙',
    build: (ctx) =>
      `When "${entityOr(ctx, 'Coin')}" collides with "Player", ` +
      `AddScore 100, play "${firstSoundOr(ctx, 'coin')}" sound, and Destroy this entity.`,
  },

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  {
    id: 'life-scene-switch',
    title: 'Scene Transition',
    description: 'Load a new scene when reaching a trigger',
    category: 'lifecycle',
    icon: '🚪',
    build: (ctx) =>
      `When "Player" collides with "${entityOr(ctx, 'DoorTrigger')}", ` +
      `wait 0.5s, then load scene "NextLevel".`,
  },
  {
    id: 'life-spawn-wave',
    title: 'Spawn Wave',
    description: 'Spawn N enemies at intervals',
    category: 'lifecycle',
    icon: '🌊',
    build: (ctx) =>
      `On Start, Repeat 5 times: Spawn "Enemy" at a random X offset (0-10, 0, 0), ` +
      `Wait 1.0s between spawns. Play "${firstSoundOr(ctx, 'spawn')}" each time.`,
  },
  {
    id: 'life-timed-destroy',
    title: 'Timed Destroy',
    description: 'Destroy entity after a delay',
    category: 'lifecycle',
    icon: '⏱',
    build: (ctx) =>
      `On Start, Wait 5.0s, then Destroy "${entityOr(ctx, 'Particle')}".`,
  },
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/** Get all templates in a category. */
export function getTemplatesByCategory(cat: PromptCategory): PromptTemplate[] {
  return PROMPT_LIBRARY.filter(t => t.category === cat);
}

/** Get all unique categories present in the library. */
export function getCategories(): PromptCategory[] {
  return [...new Set(PROMPT_LIBRARY.map(t => t.category))];
}

/** Find a template by id. */
export function getTemplateById(id: string): PromptTemplate | undefined {
  return PROMPT_LIBRARY.find(t => t.id === id);
}

/**
 * Filter templates that are usable given the current context.
 * Templates whose `requires` field references missing data are excluded.
 */
export function getAvailableTemplates(ctx: VibeContext): PromptTemplate[] {
  return PROMPT_LIBRARY.filter(t => {
    if (!t.requires) return true;
    if (t.requires.animations && ctx.animations.length === 0) return false;
    if (t.requires.sounds && ctx.sounds.length === 0) return false;
    if (t.requires.otherEntities && ctx.sceneEntities.length <= 1) return false;
    return true;
  });
}

/**
 * Build grouped template data for UI rendering.
 * Returns a map of category → templates, sorted by category name.
 */
export function getGroupedTemplates(ctx?: VibeContext): Map<PromptCategory, PromptTemplate[]> {
  const templates = ctx ? getAvailableTemplates(ctx) : PROMPT_LIBRARY;
  const grouped = new Map<PromptCategory, PromptTemplate[]>();

  for (const t of templates) {
    const list = grouped.get(t.category) ?? [];
    list.push(t);
    grouped.set(t.category, list);
  }

  return grouped;
}
