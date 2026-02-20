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
  {
    id: 'combat-hitstop',
    title: 'Hit-Stop (Impact Freeze)',
    description: 'Freeze both attacker and target for a few frames on connect for AAA impact feel',
    category: 'combat',
    icon: '⚡',
    build: (ctx) =>
      `When "${entityOr(ctx, 'Player')}" successfully lands a hit (OnCollide tag Enemy from Hitbox): ` +
      `immediately set SetAnimSpeed to 0.0 on both Self and Other for 0.1 seconds (3 frames), ` +
      `then restore to 1.0. Simultaneously trigger a camera shake (add random ±0.3 offsets to ` +
      `MainCamera position for 5 iterations of Wait 0.03s) and push Other back with SetVelocity ` +
      `z:-4 in the attacker's facing direction. Keep total nodes under 12.`,
  },
  {
    id: 'combat-combo-extend',
    title: 'Extend Combo Chain',
    description: 'Add a launcher, air combo, and ground slam to an existing combo',
    category: 'combat',
    icon: '🔺',
    requires: { animations: true },
    build: (ctx) =>
      `Extend "${entityOr(ctx, 'Player')}"'s combo chain with three extra moves after the 3rd hit: ` +
      `(1) LAUNCHER — set Other Y velocity to 10 (knock up), play "${ctx.animations[0] ?? 'Launch'}" animation, ` +
      `(2) AIR FOLLOW-UP — if player is airborne (IsGrounded false) and B is pressed, play ` +
      `"${ctx.animations[1] ?? 'AirAttack'}" and set Y velocity to 3 (small hop toward target), ` +
      `(3) GROUND SLAM — on C-Down, dive downward (SetVelocity y:-15), on landing (IsGrounded true) ` +
      `play "${ctx.animations[2] ?? 'Slam'}" and apply a radius knockback via EmitSignal "slam.impact". ` +
      `Each move should gate on state "ComboStep". Keep graphs under 15 nodes each.`,
  },
  {
    id: 'combat-parry',
    title: 'Parry / Perfect Guard',
    description: 'Timed block window that deflects attacks and briefly staggers the attacker',
    category: 'combat',
    icon: '🛡',
    requires: { animations: true },
    build: (ctx) => {
      const guardAnims = ctx.animations.filter(a => /guard|block|parry/i.test(a));
      const guardAnim = guardAnims[0] ?? 'Guard';
      return (
        `Add a parry system to "${entityOr(ctx, 'Player')}": ` +
        `When L button is pressed, play "${guardAnim}" and set flag "Parrying" true for 10 frames ` +
        `(WaitFrames 10), then set false. If OnCollide tag "EnemyAttack" fires while "Parrying" is true: ` +
        `(1) play "${ctx.animations[0] ?? 'ParrySuccess'}" animation, ` +
        `(2) play "${firstSoundOr(ctx, 'parry')}" sound, ` +
        `(3) set Other state "Stunned" to 1 and SetVelocity Other backward z:-3, ` +
        `(4) grant Self 20 stamina (SetState Stamina +20 clamped to 100). ` +
        `If collide fires but Parrying is false, take normal damage instead.`
      );
    },
  },
  {
    id: 'combat-status-effect',
    title: 'Status Effects (Burn / Freeze / Stagger)',
    description: 'Apply a timed elemental status with per-tick damage or movement penalty',
    category: 'combat',
    icon: '🔥',
    build: (ctx) =>
      `When "${entityOr(ctx, 'Enemy')}" is hit by a projectile tagged "Fire": ` +
      `set state "StatusType" to 1 (Burn) and "StatusTimer" to 180 (6 seconds at 30fps). ` +
      `On each tick, if StatusTimer > 0: decrement StatusTimer by 1, and every 30 ticks apply ` +
      `SetHealth -2 on Self to simulate burn damage; play "${firstSoundOr(ctx, 'burn')}" sound. ` +
      `If hit by "Ice" instead: set StatusType 2 (Freeze), SetVelocity to (0,0,0), ` +
      `and set SetAnimSpeed to 0.3 ONCE on status start; restore speed to 1.0 ONCE when ` +
      `StatusTimer reaches 0 (use a flag "FreezeApplied" so the speed change only fires on ` +
      `the first tick, not every tick). ` +
      `When StatusTimer reaches 0 clear the status (StatusType 0) and restore normal speed. ` +
      `Use SwitchCase on StatusType to branch burn vs freeze logic. Keep under 15 nodes.`,
  },
  {
    id: 'combat-boss-phase',
    title: 'Boss Phase Transitions',
    description: 'Drive a multi-phase boss: different attack patterns per HP threshold',
    category: 'combat',
    icon: '👾',
    requires: { animations: true },
    build: (ctx) => {
      const names = ctx.animations;
      return (
        `Build a 3-phase boss for "${entityOr(ctx, 'Boss')}": ` +
        `Phase 1 (HP 100-66%): basic patrol + ranged attack every 3s ` +
        `(Spawn "BossBullet" at SpawnPoint, SetVelocity toward Player). ` +
        `Phase 2 (HP 66-33%): add a charge attack — MoveToward Player at speed 10 for 0.5s then stop; ` +
        `play "${names[0] ?? 'Charge'}" animation, trigger OnCollide damage 30 on contact. ` +
        `Phase 3 (HP 33-0%): play "${names[1] ?? 'Enrage'}" animation, increase all speeds by 1.5×, ` +
        `spawn 2 minions (Spawn "Minion" at offset ±3 X). ` +
        `Use GetHealth + Compare + SwitchCase to switch phases. Emit signal "boss.phase_change" ` +
        `with phase number at each threshold. Total nodes per phase sub-graph: ≤12.`
      );
    },
  },
  {
    id: 'combat-weapon-switch',
    title: 'Weapon Switching',
    description: 'Cycle between up to 3 weapons with different damage, range, and animations',
    category: 'combat',
    icon: '⚔',
    requires: { animations: true },
    build: (ctx) =>
      `Add weapon switching to "${entityOr(ctx, 'Player')}": ` +
      `D-Right cycles to next weapon (SetState "WeaponSlot" (current+1) mod 3). ` +
      `SwitchCase on WeaponSlot: ` +
      `Slot 0 = Sword: melee hitbox damage 20, attack anim "${ctx.animations[0] ?? 'SwordAtk'}", range 1.5; ` +
      `Slot 1 = Bow: Spawn "Arrow" at SpawnPoint velocity z:18, damage 15, anim "${ctx.animations[1] ?? 'BowAtk'}"; ` +
      `Slot 2 = Magic: Spawn "SpellOrb" velocity z:8, damage 30 but 1.5s cooldown (CheckFlag "SpellCooldown"), ` +
      `anim "${ctx.animations[2] ?? 'CastAtk'}". ` +
      `Each slot should also update the HUD weapon icon via SetHUDText "WeaponIcon" with a different symbol. ` +
      `Play "${firstSoundOr(ctx, 'swap')}" on switch. Keep each slot branch ≤6 nodes.`,
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
  {
    id: 'ui-health-bar',
    title: 'Animated Health Bar',
    description: 'HUD health bar with smooth drain animation and low-HP warning',
    category: 'ui',
    icon: '❤',
    build: (ctx) =>
      `Every tick, read "${entityOr(ctx, 'Player')}" GetHealth and maxHealth, divide to get ratio. ` +
      `Drive SetHUDBar element "HealthBar" with that ratio; colorHigh #20e840, colorLow #e82020. ` +
      `Also SetHUDText element "HealthNum" with format "{0}/{1}". ` +
      `When ratio drops below 0.25: start a flicker loop — SetHUDVisible "HealthWarning" true, ` +
      `Wait 0.15s, false, Wait 0.15s, Repeat forever (stop the loop when ratio rises above 0.25 ` +
      `by checking each iteration). Play "${firstSoundOr(ctx, 'heartbeat')}" every 1.5s while critical. ` +
      `Keep total graph ≤14 nodes.`,
  },
  {
    id: 'ui-stamina-bar',
    title: 'Stamina Bar with Recovery Delay',
    description: 'Stamina gauge that pauses before recovering after being spent',
    category: 'ui',
    icon: '⚡',
    build: (ctx) =>
      `Every tick, read state "Stamina" from "${entityOr(ctx, 'Player')}", divide by 100 for ratio. ` +
      `Drive SetHUDBar "StaminaBar" with that ratio; colorHigh #40aaff, colorLow #e8c040. ` +
      `Recovery logic: when Stamina < 100 AND flag "StaminaDepleted" is false, ` +
      `each tick add 1 to Stamina (capped at 100) via GetState + MathOp Add + SetState. ` +
      `When Stamina hits 0: set flag "StaminaDepleted" true, play "${firstSoundOr(ctx, 'depleted')}" sound, ` +
      `start a Timer 0.8s, on elapsed clear "StaminaDepleted" to allow recovery. ` +
      `Show a "STAMINA EMPTY" SetHUDText while depleted. Use SwitchCase or Branch on the depleted flag.`,
  },
  {
    id: 'ui-boss-bar',
    title: 'Boss Health Bar (Phased)',
    description: 'Dramatic boss bar that reveals with an animation and reacts to phase thresholds',
    category: 'ui',
    icon: '👾',
    build: (ctx) =>
      `On Start: SetHUDVisible "BossBar" true, SetHUDText "BossName" "${entityOr(ctx, 'Boss')}", ` +
      `Tween the bar in from y:-80 to y:0 over 0.8s EaseOut, play "${firstSoundOr(ctx, 'bossIntro')}" sound. ` +
      `Every tick: read "${entityOr(ctx, 'Boss')}" GetHealth / maxHealth → SetHUDBar "BossHealthBar" ratio, ` +
      `segments:4, colorHigh #20e840, colorLow #ff2020. ` +
      `Phase transitions: at 75%, 50%, 25% HP (use Compare + Branch each tick, gated by a per-phase ` +
      `flag so it fires only once): EmitSignal "${entityOr(ctx, 'Boss')}.phase_change" with phase index, ` +
      `camera shake (random ±0.3 position for 8 frames). ` +
      `On signal "${entityOr(ctx, 'Boss')}.death": Tween bar out (y:0→-80, 0.5s EaseIn), play "${firstSoundOr(ctx, 'bossDefeat')}" sound. ` +
      `Total ≤15 nodes.`,
  },
  {
    id: 'ui-floating-damage',
    title: 'Floating Damage Numbers',
    description: 'World-space damage labels that float up, fade, and support critical hit styling',
    category: 'ui',
    icon: '💢',
    build: (ctx) =>
      `When "${entityOr(ctx, 'Enemy')}" takes damage (listen OnSignal "${entityOr(ctx, 'Enemy')}.damage_taken"): ` +
      `Spawn prefab "DamageLabel" at socket "HitPoint" (pooled:true). ` +
      `SetProperty "text" on Spawned from the signal payload (damage amount). ` +
      `Simultaneously Tween Spawned posY from 0 to 2.0 over 0.8s EaseOut, and ` +
      `Tween Spawned alpha from 1.0 to 0.0 over 0.8s Linear. On Tween done, Destroy Spawned. ` +
      `Branch on amount > 30 (critical): SetProperty Spawned "color" "#ff2020", "scale" 1.6, ` +
      `add a pop scale tween (1.4→1.0 over 4 frames). For non-crits: color white, scale 1.0. ` +
      `Offset each label slightly in X by reading state "DmgNumStack" (mod 5 × 0.3) to prevent overlap. ` +
      `Keep under 14 nodes.`,
  },
  {
    id: 'ui-minimap',
    title: 'Minimap / Radar Blips',
    description: 'Show player and enemy positions as dots on a 2D minimap overlay',
    category: 'ui',
    icon: '🗺',
    requires: { otherEntities: true },
    build: (ctx) => {
      const enemies = otherEntities(ctx).slice(0, 3);
      const enemyList = enemies.length ? enemies.join('", "') : 'Enemy';
      return (
        `Every tick, read "${entityOr(ctx, 'Player')}" GetPosition and map it to the minimap element ` +
        `"PlayerBlip" (scale world coords by 0.05 to fit the 64×64 minimap). ` +
        `Use SetHUDElement "PlayerBlip" posX/posY. ` +
        `Repeat for entities "${enemyList}": read each GetPosition, compute relative offset from Player, ` +
        `scale by 0.05, clamp to ±32 (minimap half-size), and drive SetHUDElement "EnemyBlip_N" posX/posY. ` +
        `Show enemy blips only when within distance 15 (use GetDistance + Compare + Branch + SetHUDVisible). ` +
        `Pulse player blip scale between 0.9 and 1.1 using a WaitFrames 15 loop. Keep ≤15 nodes.`
      );
    },
  },
  {
    id: 'ui-dialogue',
    title: 'Typewriter Dialogue Box',
    description: 'NPC dialogue with typewriter text, portrait, and A-to-advance paging',
    category: 'ui',
    icon: '💬',
    build: (ctx) =>
      `When Player collides with "${entityOr(ctx, 'NPC')}" (OnCollide Enter, tag Player) and presses B: ` +
      `check flag "InDialogue" is false, then SetHUDVisible "DialogueBox" true, ` +
      `SetHUDText "DialogueName" "${entityOr(ctx, 'NPC')}", SetFlag "InDialogue" true. ` +
      `Use TypewriterText on element "DialogueText" with text page 0, charDelay 0.04s. ` +
      `Play "${firstSoundOr(ctx, 'beep')}" sound looped at low pitch while typing (stop on TypewriterEnd). ` +
      `When A is pressed (guard: InDialogue true): GetState "DialoguePage" SwitchCase: ` +
      `page 0 → show page 1 text, SetState page 1; page 1 → SetHUDVisible "DialogueBox" false, ` +
      `SetFlag "InDialogue" false, EmitSignal "${entityOr(ctx, 'NPC')}.dialogue_complete". ` +
      `Total ≤15 nodes.`,
  },
  {
    id: 'ui-notification-toast',
    title: 'Notification Toast',
    description: 'Pop-up objective/achievement notification that slides in, holds, then fades out',
    category: 'ui',
    icon: '📣',
    build: (ctx) =>
      `Listen for OnSignal "ui.notify" from any source. On fire: ` +
      `SetHUDText "ToastText" with the signal payload string. ` +
      `SetHUDVisible "ToastPanel" true. ` +
      `Tween "ToastPanel" posY from -60 to 0 over 0.3s EaseOut (slide in from top). ` +
      `Wait 2.5s. Tween posY from 0 to -60 over 0.3s EaseIn (slide out). ` +
      `On Tween done: SetHUDVisible "ToastPanel" false. ` +
      `Gate repeat fires with flag "ToastActive" (set true on show, false on hide) so overlapping ` +
      `signals queue rather than overlap — use SetState "ToastQueue" to store pending count. ` +
      `Play "${firstSoundOr(ctx, 'notify')}" on each toast show. Keep ≤12 nodes.`,
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
