import { NodeGraphNode, NodeGraphEdge, NodeGraphConfig } from './VibeNode.js';

/**
 * A Game Component is a pre-packaged set of logic (Node Graph) and properties
 * that can be applied to an entity to give it specific behavior instantly.
 */
export interface GameComponentTemplate {
  id:          string;
  label:       string;
  category:    'Movement' | 'Logic' | 'Combat' | 'Interaction' | 'UI';
  icon:        string; // Material symbol name
  description: string;
  
  /**
   * Generates the node graph patch to apply to the entity.
   * @param entityName The target entity name.
   */
  buildGraph: (entityName: string) => NodeGraphConfig;

  /**
   * Technical constraints or requirements (e.g. "Requires a Collision Body").
   */
  requirements?: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _idCounter = 1000;
const nextId = (): string => `node_${_idCounter++}`;

/** Creates a standard node config. */
const node = (type: string, x: number, y: number, data: Record<string, any> = {}): NodeGraphNode => ({
  id: nextId(),
  type,
  position: [x, y],
  data
});

/** Creates an edge between two nodes. */
const connect = (from: NodeGraphNode, fromPort: string, to: NodeGraphNode, toPort: string): NodeGraphEdge => ({
  from: from.id,
  fromPort: fromPort,
  to: to.id,
  toPort: toPort
});

// ─── Component Definitions ───────────────────────────────────────────────────

export const GAME_COMPONENTS: GameComponentTemplate[] = [

  // ─── MOVEMENT ──────────────────────────────────────────────────────────────
  {
    id: 'platformer-controller',
    label: 'Platformer Controller',
    category: 'Movement',
    icon: 'directions_run',
    description: 'Basic 2D/3D platformer movement with jump and gravity.',
    requirements: ['Collision Body (Dynamic)', 'Freeze Rotation'],
    buildGraph: (ent) => {
      const nodes: NodeGraphNode[] = [];
      const edges: NodeGraphEdge[] = [];
      
      const start = node('OnTick', 50, 50);
      const stick = node('ReadStick', 250, 50, { stick: 'Left' });
      const move  = node('MoveDirection', 500, 50, { speed: 10, relative: 'Camera' });
      
      const btn   = node('OnButtonPress', 50, 200, { button: 'A' });
      const jump  = node('SetVelocity', 300, 200, { y: 15, mode: 'Add' }); // naive jump
      
      nodes.push(start, stick, move, btn, jump);
      
      edges.push(connect(start, 'out', stick, 'in'));
      edges.push(connect(stick, 'vec', move, 'direction'));
      edges.push(connect(stick, 'out', move, 'in'));
      edges.push(connect(btn, 'out', jump, 'in'));
      
      return { nodes, edges };
    }
  },

  {
    id: 'fps-controller',
    label: 'FPS Controller',
    category: 'Movement',
    icon: 'api',
    description: 'First-person movement with camera look.',
    requirements: ['Camera (Child)', 'Collision Body'],
    buildGraph: (ent) => {
      const nodes: NodeGraphNode[] = [];
      const edges: NodeGraphEdge[] = [];

      // Movement
      const tick = node('OnTick', 50, 50);
      const move = node('MoveDirection', 300, 50, { speed: 8, relative: 'Self' });
      const look = node('ReadStick', 300, 200, { stick: 'Right' });
      const rot  = node('SetRotation', 550, 200, { axis: 'Y', speed: 2 });

      nodes.push(tick, move, look, rot);
      
      edges.push(connect(tick, 'out', move, 'in'));
      edges.push(connect(tick, 'out', look, 'in'));
      edges.push(connect(look, 'out', rot, 'in'));
      
      return { nodes, edges };
    }
  },

  // ─── INTERACTION ───────────────────────────────────────────────────────────
  {
    id: 'door-logic',
    label: 'Simple Door',
    category: 'Interaction',
    icon: 'sensor_door',
    description: 'Opens when player is near and presses interact.',
    requirements: ['IsTrigger (Proximity)'],
    buildGraph: (ent) => {
      const nodes: NodeGraphNode[] = [];
      const edges: NodeGraphEdge[] = [];

      const onEnter = node('OnCollide', 50, 50, { type: 'Enter', tag: 'Player' });
      const check   = node('OnButtonPress', 300, 50, { button: 'B' }); // Interact
      const anim    = node('PlayAnim', 550, 50, { anim: 'Open', loop: false });
      const sound   = node('PlaySound', 550, 150, { sound: 'DoorOpen' });

      nodes.push(onEnter, check, anim, sound);
      
      edges.push(connect(onEnter, 'out', check, 'in'));
      
      return { nodes, edges };
    }
  },

  {
    id: 'collectible-health',
    label: 'Health Pickup',
    category: 'Interaction',
    icon: 'favorite',
    description: 'Restores health and destroys self on touch.',
    requirements: ['IsTrigger'],
    buildGraph: (ent) => {
      const nodes: NodeGraphNode[] = [];
      const edges: NodeGraphEdge[] = [];

      const hit  = node('OnCollide', 50, 50, { tag: 'Player' });
      const heal = node('SetHealth', 300, 50, { amount: 25, mode: 'Add', target: 'Other' });
      const sfx  = node('PlaySound', 300, 150, { sound: 'Pickup' });
      const kill = node('Destroy', 550, 50, { target: 'Self', delay: 0.1 });

      nodes.push(hit, heal, sfx, kill);

      edges.push(connect(hit, 'out', heal, 'in'));
      edges.push(connect(hit, 'out', sfx, 'in'));
      edges.push(connect(heal, 'out', kill, 'in'));

      return { nodes, edges };
    }
  },

  // ─── LOGIC ─────────────────────────────────────────────────────────────────
  {
    id: 'patrol-ai',
    label: 'Patrol AI',
    category: 'Logic',
    icon: 'visibility',
    description: 'Moves between waypoints.',
    requirements: ['Waypoints (Children)'],
    buildGraph: (ent) => {
      const nodes: NodeGraphNode[] = [];
      const edges: NodeGraphEdge[] = [];

      const tick = node('OnTick', 50, 50);
      const move = node('MoveDirection', 300, 50, { speed: 4, direction: 'Forward' });
      
      const hit  = node('OnCollide', 50, 200, { tag: 'Wall' });
      const turn = node('SetRotation', 300, 200, { y: 180, mode: 'Add' });

      nodes.push(tick, move, hit, turn);
      edges.push(connect(tick, 'out', move, 'in'));
      edges.push(connect(hit, 'out', turn, 'in'));

      return { nodes, edges };
    }
  },

  // ─── UNITY-INSPIRED ────────────────────────────────────────────────────────

  {
    id: 'animator-state-machine',
    label: 'Animator (State Machine)',
    category: 'Movement',
    icon: 'account_tree',
    description: 'Unity Mecanim-style state machine: Idle → Walk → Run → Jump → Fall. Driven by speed and grounded state.',
    requirements: ['Animations: Idle, Walk, Run, Jump, Fall'],
    buildGraph: (ent) => {
      const nodes: NodeGraphNode[] = [];
      const edges: NodeGraphEdge[] = [];

      // Read inputs every tick
      const tick   = node('OnTick', 50, 50);
      const stick  = node('ReadStick', 250, 50, { stick: 'Left' });
      const speed  = node('GetMagnitude', 450, 50);

      // State branches: grounded?
      const ground = node('IsGrounded', 250, 200);
      const bGnd   = node('Branch', 450, 200);

      // Ground states: idle or moving
      const bMove  = node('Branch', 650, 200, { threshold: 0.1 });
      const bRun   = node('Branch', 850, 200, { threshold: 0.6 });
      const idle   = node('PlayAnim', 1050, 100, { anim: 'Idle',  loop: true, blend: 0.15 });
      const walk   = node('PlayAnim', 1050, 200, { anim: 'Walk',  loop: true, blend: 0.15 });
      const run    = node('PlayAnim', 1050, 300, { anim: 'Run',   loop: true, blend: 0.15 });

      // Air states
      const vel    = node('GetVelocityY', 650, 350);
      const bAir   = node('Branch', 850, 350, { threshold: 0 });
      const jump   = node('PlayAnim', 1050, 380, { anim: 'Jump',  loop: false, blend: 0.1 });
      const fall   = node('PlayAnim', 1050, 460, { anim: 'Fall',  loop: true,  blend: 0.1 });

      // Jump input
      const btn    = node('OnButtonPress', 50, 480, { button: 'A' });
      const doJump = node('SetVelocity', 300, 480, { y: 14, mode: 'Set' });

      nodes.push(tick, stick, speed, ground, bGnd, bMove, bRun, idle, walk, run, vel, bAir, jump, fall, btn, doJump);

      edges.push(connect(tick,  'out', stick,  'in'));
      edges.push(connect(stick, 'vec', speed,  'vec'));
      edges.push(connect(tick,  'out', ground, 'in'));
      edges.push(connect(ground,'bool',bGnd,   'cond'));
      edges.push(connect(speed, 'f',   bMove,  'value'));
      edges.push(connect(bGnd,  'true',bMove,  'in'));
      edges.push(connect(bMove, 'false',idle,  'in'));
      edges.push(connect(speed, 'f',   bRun,   'value'));
      edges.push(connect(bMove, 'true', bRun,  'in'));
      edges.push(connect(bRun,  'false',walk,  'in'));
      edges.push(connect(bRun,  'true', run,   'in'));
      edges.push(connect(bGnd,  'false',vel,   'in'));
      edges.push(connect(vel,   'f',    bAir,  'value'));
      edges.push(connect(bAir,  'true', jump,  'in'));
      edges.push(connect(bAir,  'false',fall,  'in'));
      edges.push(connect(btn,   'out',  doJump,'in'));

      return { nodes, edges };
    }
  },

  {
    id: 'rigidbody-push',
    label: 'Rigidbody Interaction',
    category: 'Interaction',
    icon: 'open_with',
    description: 'Unity-style: push physics objects on contact. Applies an impulse proportional to the player\'s velocity.',
    requirements: ['Collision Body (Dynamic)', 'Tag: Pushable on target'],
    buildGraph: (ent) => {
      const nodes: NodeGraphNode[] = [];
      const edges: NodeGraphEdge[] = [];

      const hit    = node('OnCollide', 50, 50, { tag: 'Pushable', type: 'Stay' });
      const myVel  = node('GetVelocity', 300, 50, { target: 'Self' });
      const scale  = node('ScaleVec', 500, 50, { scale: 0.6 });
      const impulse= node('AddForce', 700, 50, { target: 'Other', mode: 'Impulse' });

      nodes.push(hit, myVel, scale, impulse);
      edges.push(connect(hit,    'out', myVel,   'in'));
      edges.push(connect(myVel,  'vec', scale,   'vec'));
      edges.push(connect(hit,    'out', impulse, 'in'));
      edges.push(connect(scale,  'vec', impulse, 'force'));

      return { nodes, edges };
    }
  },

  // ─── UNREAL-INSPIRED ───────────────────────────────────────────────────────

  {
    id: 'ai-perception-sight',
    label: 'AI Perception (Sight)',
    category: 'Logic',
    icon: 'remove_red_eye',
    description: 'Unreal AI Perception: line-of-sight check triggers chase or alert behaviors.',
    requirements: ['Tag: Player exists in scene'],
    buildGraph: (ent) => {
      const nodes: NodeGraphNode[] = [];
      const edges: NodeGraphEdge[] = [];

      const tick   = node('OnTick', 50, 50);
      const los    = node('CheckLineOfSight', 280, 50, { target: 'Player', maxDist: 12, fovDeg: 90 });
      const bSee   = node('Branch', 500, 50);

      // Seen: chase
      const chase  = node('MoveToward', 700, 50, { target: 'Player', speed: 5 });
      const atkAnim= node('PlayAnim', 900, 50, { anim: 'Chase', loop: true, blend: 0.2 });
      const sfxAlert=node('PlaySound', 900, 150, { sound: 'Alert', oneshot: true });

      // Not seen: resume patrol
      const patrol = node('MoveDirection', 700, 200, { speed: 2, direction: 'Forward' });
      const idleA  = node('PlayAnim', 900, 250, { anim: 'Walk', loop: true, blend: 0.2 });

      nodes.push(tick, los, bSee, chase, atkAnim, sfxAlert, patrol, idleA);

      edges.push(connect(tick,    'out',   los,    'in'));
      edges.push(connect(los,     'bool',  bSee,   'cond'));
      edges.push(connect(bSee,    'true',  chase,  'in'));
      edges.push(connect(chase,   'out',   atkAnim,'in'));
      edges.push(connect(bSee,    'true',  sfxAlert,'in'));
      edges.push(connect(bSee,    'false', patrol, 'in'));
      edges.push(connect(patrol,  'out',   idleA,  'in'));

      return { nodes, edges };
    }
  },

  {
    id: 'blueprint-spawner',
    label: 'Blueprint Spawner',
    category: 'Logic',
    icon: 'add_circle',
    description: 'Unreal Blueprint-style: spawn an entity prefab at a socket on a trigger event.',
    requirements: ['SpawnSocket (Child node named "SpawnPoint")'],
    buildGraph: (ent) => {
      const nodes: NodeGraphNode[] = [];
      const edges: NodeGraphEdge[] = [];

      const btn    = node('OnButtonPress', 50, 50, { button: 'B' });
      const timer  = node('Timer', 250, 50, { duration: 0.5, repeat: false });
      const spawn  = node('Spawn', 500, 50, { prefab: 'Projectile', socket: 'SpawnPoint', pooled: true });
      const vel    = node('SetVelocity', 750, 50, { z: 20, mode: 'Set', target: 'Spawned' });
      const sfx    = node('PlaySound', 750, 150, { sound: 'Shoot' });
      const lim    = node('Timer', 750, 250, { duration: 3.0, repeat: false });
      const dest   = node('Destroy', 950, 250, { target: 'Spawned', delay: 0 });

      nodes.push(btn, timer, spawn, vel, sfx, lim, dest);
      edges.push(connect(btn,   'out',     timer,  'in'));
      edges.push(connect(timer, 'elapsed', spawn,  'in'));
      edges.push(connect(spawn, 'out',     vel,    'in'));
      edges.push(connect(spawn, 'out',     sfx,    'in'));
      edges.push(connect(spawn, 'out',     lim,    'in'));
      edges.push(connect(lim,   'elapsed', dest,   'in'));

      return { nodes, edges };
    }
  },

  // ─── GODOT-INSPIRED ────────────────────────────────────────────────────────

  {
    id: 'area-detector',
    label: 'Area Detector (Signals)',
    category: 'Logic',
    icon: 'radar',
    description: 'Godot Area3D-style: emit "entered" / "exited" signals when entities overlap this zone. Other nodes can subscribe.',
    requirements: ['IsTrigger (Volume)'],
    buildGraph: (ent) => {
      const nodes: NodeGraphNode[] = [];
      const edges: NodeGraphEdge[] = [];

      const enter  = node('OnCollide', 50, 50,  { type: 'Enter' });
      const exit   = node('OnCollide', 50, 200, { type: 'Exit'  });
      const sigIn  = node('EmitSignal', 300, 50,  { signal: `${ent}.area_entered`, payload: 'Other' });
      const sigOut = node('EmitSignal', 300, 200, { signal: `${ent}.area_exited`,  payload: 'Other' });
      const sfxIn  = node('PlaySound', 550, 50,  { sound: 'AreaEnter' });
      const sfxOut = node('PlaySound', 550, 200, { sound: 'AreaExit'  });

      nodes.push(enter, exit, sigIn, sigOut, sfxIn, sfxOut);
      edges.push(connect(enter, 'out', sigIn,  'in'));
      edges.push(connect(sigIn, 'out', sfxIn,  'in'));
      edges.push(connect(exit,  'out', sigOut, 'in'));
      edges.push(connect(sigOut,'out', sfxOut, 'in'));

      return { nodes, edges };
    }
  },

  {
    id: 'tween-mover',
    label: 'Tween Mover',
    category: 'Movement',
    icon: 'swap_horiz',
    description: 'Godot Tween-style: smoothly interpolate position between two points on a trigger, with configurable easing.',
    requirements: ['Two child nodes named "PointA" and "PointB"'],
    buildGraph: (ent) => {
      const nodes: NodeGraphNode[] = [];
      const edges: NodeGraphEdge[] = [];

      const btn    = node('OnButtonPress', 50, 50, { button: 'B' });
      const getPosA= node('GetChildPos', 280, 50,  { child: 'PointA' });
      const getPosB= node('GetChildPos', 280, 150, { child: 'PointB' });
      const tween  = node('Tween', 520, 100, { duration: 1.2, easing: 'EaseInOut', property: 'position' });
      const sfxDone= node('PlaySound', 760, 100, { sound: 'TweenDone' });

      nodes.push(btn, getPosA, getPosB, tween, sfxDone);
      edges.push(connect(btn,    'out',  getPosA, 'in'));
      edges.push(connect(btn,    'out',  getPosB, 'in'));
      edges.push(connect(getPosA,'pos',  tween,   'from'));
      edges.push(connect(getPosB,'pos',  tween,   'to'));
      edges.push(connect(btn,    'out',  tween,   'in'));
      edges.push(connect(tween,  'done', sfxDone, 'in'));

      return { nodes, edges };
    }
  },

  // ─── COMBAT ────────────────────────────────────────────────────────────────

  {
    id: 'melee-attack',
    label: 'Melee Attack',
    category: 'Combat',
    icon: 'sports_martial_arts',
    description: 'Press attack button → play swing animation → hitbox active mid-swing → apply damage on hit.',
    requirements: ['Animations: Attack', 'HitboxVolume (Child)'],
    vibePrompt:
      'I have the basic melee attack applied. Now make it feel AAA: add hit-stop (freeze 3 frames on ' +
      'connect via SetAnimSpeed 0 for 0.1s then restore), screen-shake on hit, and a push-back impulse ' +
      'that knocks the enemy away from the attacker. Keep total node count under 15.',
    buildGraph: (ent) => {
      const nodes: NodeGraphNode[] = [];
      const edges: NodeGraphEdge[] = [];

      const btn    = node('OnButtonPress', 50, 50, { button: 'B' });
      const anim   = node('PlayAnim', 280, 50, { anim: 'Attack', loop: false, blend: 0.05 });
      const wait   = node('WaitFrames', 500, 50, { frames: 8 });
      const hbOn   = node('SetCollider', 700, 50,  { child: 'Hitbox', enabled: true });
      const hit    = node('OnCollide', 50, 200, { tag: 'Enemy', source: 'Hitbox' });
      const dmg    = node('SetHealth', 300, 200, { amount: -20, mode: 'Add', target: 'Other' });
      const sfx    = node('PlaySound', 300, 300, { sound: 'Hit' });
      const vfx    = node('PlayVFX', 500, 200, { vfx: 'HitSpark', socket: 'Other' });
      const waitOff= node('WaitFrames', 700, 200, { frames: 6 });
      const hbOff  = node('SetCollider', 900, 200, { child: 'Hitbox', enabled: false });

      nodes.push(btn, anim, wait, hbOn, hit, dmg, sfx, vfx, waitOff, hbOff);
      edges.push(connect(btn,     'out',     anim,    'in'));
      edges.push(connect(anim,    'out',     wait,    'in'));
      edges.push(connect(wait,    'elapsed', hbOn,    'in'));
      edges.push(connect(hit,     'out',     dmg,     'in'));
      edges.push(connect(hit,     'out',     sfx,     'in'));
      edges.push(connect(dmg,     'out',     vfx,     'in'));
      edges.push(connect(anim,    'out',     waitOff, 'in'));
      edges.push(connect(waitOff, 'elapsed', hbOff,   'in'));

      return { nodes, edges };
    }
  },

  {
    id: 'combo-chain',
    label: 'Combo Chain (3-Hit)',
    category: 'Combat',
    icon: 'bolt',
    description: 'Chained 3-hit melee combo with attack-cancel windows. Re-pressing B within the window advances the chain; missing the window resets to idle.',
    requirements: ['Animations: Attack1, Attack2, Attack3', 'HitboxVolume (Child)'],
    vibePrompt:
      'I have a 3-hit combo applied to this entity. Extend it with: (1) a heavy finisher on the 3rd ' +
      'hit that deals 3× damage and launches the enemy upward (SetVelocity y:8 on Other), ' +
      '(2) an aerial follow-up if the player jumps immediately after the 3rd hit, ' +
      '(3) cancel recovery on dodge press. Keep graphs under 15 nodes each.',
    buildGraph: (ent) => {
      const nodes: NodeGraphNode[] = [];
      const edges: NodeGraphEdge[] = [];

      // ── State machine: combo step 0 → 1 → 2 → reset ─────────────────────
      // Using an integer flag stored as state to track combo step.
      const init   = node('OnStart',      50, 50);
      const reset  = node('SetState',     250, 50,  { name: 'ComboStep', value: 0 });

      // On attack press, read current step and branch
      const btn    = node('OnButtonPress', 50, 200, { button: 'B' });
      const step   = node('GetState',     250, 200, { name: 'ComboStep' });
      const sw     = node('SwitchCase',   450, 200, { cases: ['0', '1', '2'] });

      // Step 0 → Attack1
      const atk1   = node('PlayAnim',   700, 100, { anim: 'Attack1', loop: false, blend: 0.05 });
      const set1   = node('SetState',   900, 100, { name: 'ComboStep', value: 1 });
      const hb1On  = node('SetCollider',1100, 100, { child: 'Hitbox', enabled: true });
      const wait1  = node('WaitFrames', 1100, 180, { frames: 6 });
      const hb1Off = node('SetCollider',1300, 180, { child: 'Hitbox', enabled: false });

      // Step 1 → Attack2
      const atk2   = node('PlayAnim',   700, 280, { anim: 'Attack2', loop: false, blend: 0.05 });
      const set2   = node('SetState',   900, 280, { name: 'ComboStep', value: 2 });
      const hb2On  = node('SetCollider',1100, 280, { child: 'Hitbox', enabled: true });
      const wait2  = node('WaitFrames', 1100, 360, { frames: 6 });
      const hb2Off = node('SetCollider',1300, 360, { child: 'Hitbox', enabled: false });

      // Step 2 → Attack3 (finisher) → auto-reset
      const atk3   = node('PlayAnim',   700, 460, { anim: 'Attack3', loop: false, blend: 0.05 });
      const set3   = node('SetState',   900, 460, { name: 'ComboStep', value: 0 });
      const hb3On  = node('SetCollider',1100, 460, { child: 'Hitbox', enabled: true });
      const wait3  = node('WaitFrames', 1100, 540, { frames: 8 });
      const hb3Off = node('SetCollider',1300, 540, { child: 'Hitbox', enabled: false });

      // Shared: damage on hit
      const hitEvt = node('OnCollide',    50, 650, { tag: 'Enemy', source: 'Hitbox' });
      const dmg    = node('SetHealth',   280, 650, { amount: -15, mode: 'Add', target: 'Other' });
      const sfx    = node('PlaySound',   280, 730, { sound: 'Hit' });
      const vfx    = node('PlayVFX',     500, 650, { vfx: 'HitSpark', socket: 'Other' });

      // Combo window expiry: if animEnd fires before next press, reset step
      const animEnd= node('OnAnimEnd',   50, 880);
      const rstEnd = node('SetState',   250, 880, { name: 'ComboStep', value: 0 });

      nodes.push(
        init, reset,
        btn, step, sw,
        atk1, set1, hb1On, wait1, hb1Off,
        atk2, set2, hb2On, wait2, hb2Off,
        atk3, set3, hb3On, wait3, hb3Off,
        hitEvt, dmg, sfx, vfx,
        animEnd, rstEnd,
      );

      edges.push(connect(init,  'out',  reset,  'in'));
      edges.push(connect(btn,   'out',  step,   'in'));
      edges.push(connect(step,  'value', sw,    'value'));
      edges.push(connect(btn,   'out',  sw,     'in'));

      edges.push(connect(sw,   'S0',   atk1,   'in'));
      edges.push(connect(atk1, 'out',  set1,   'in'));
      edges.push(connect(set1, 'out',  hb1On,  'in'));
      edges.push(connect(hb1On,'out',  wait1,  'in'));
      edges.push(connect(wait1,'elapsed',hb1Off,'in'));

      edges.push(connect(sw,   'S1',   atk2,   'in'));
      edges.push(connect(atk2, 'out',  set2,   'in'));
      edges.push(connect(set2, 'out',  hb2On,  'in'));
      edges.push(connect(hb2On,'out',  wait2,  'in'));
      edges.push(connect(wait2,'elapsed',hb2Off,'in'));

      edges.push(connect(sw,   'S2',   atk3,   'in'));
      edges.push(connect(atk3, 'out',  set3,   'in'));
      edges.push(connect(set3, 'out',  hb3On,  'in'));
      edges.push(connect(hb3On,'out',  wait3,  'in'));
      edges.push(connect(wait3,'elapsed',hb3Off,'in'));

      edges.push(connect(hitEvt,'out', dmg,    'in'));
      edges.push(connect(hitEvt,'out', sfx,    'in'));
      edges.push(connect(dmg,  'out',  vfx,    'in'));

      edges.push(connect(animEnd,'out',rstEnd, 'in'));

      return { nodes, edges };
    }
  },

  {
    id: 'dodge-roll',
    label: 'Dodge Roll (i-frames)',
    category: 'Combat',
    icon: '360',
    description: 'Dark Souls-style dodge roll: read direction from left stick, apply movement impulse, grant invincibility during active frames, then land with a short recovery window. Consumes stamina.',
    requirements: ['Animations: Dodge', 'Stamina system (flag: Stamina)'],
    vibePrompt:
      'I have dodge roll applied. Now add: (1) directional dodge — detect stick X/Y and set the dodge ' +
      'velocity in that direction instead of always forward, (2) perfect-dodge (within first 3 frames) ' +
      'briefly slow time (SetAnimSpeed 0.3 for 0.2s on all entities tagged Enemy) creating a stylish ' +
      'parry window, (3) reduce stamina by 25 per dodge.',
    buildGraph: (ent) => {
      const nodes: NodeGraphNode[] = [];
      const edges: NodeGraphEdge[] = [];

      const btn    = node('OnButtonPress', 50, 50, { button: 'Z' });

      // Stamina gate
      const stam   = node('GetState',     250, 50, { name: 'Stamina' });
      const enoughStam = node('Compare',  450, 50, { op: '>=' });
      const stamVal= node('Value',        450, 120, { value: 25 });
      const gate   = node('Branch',       650, 50);

      // Dodge execution
      const anim   = node('PlayAnim',     850, 50, { anim: 'Dodge', loop: false, blend: 0.05 });
      const vel    = node('SetVelocity',  1050, 50, { z: 10, y: 1, mode: 'Set' });
      const iOn    = node('SetState',     1250, 50, { name: 'Invincible', value: 1 });

      // Drain stamina
      const drainAmt = node('Value',      250, 200, { value: 25 });
      const newStam  = node('MathOp',     450, 200, { op: 'Sub' });
      const setStam  = node('SetState',   650, 200, { name: 'Stamina' });

      // Active i-frame window (8 frames)
      const waitActive = node('WaitFrames', 850, 200, { frames: 8 });
      const iOff     = node('SetState',   1050, 200, { name: 'Invincible', value: 0 });

      // Recovery: decelerate
      const decel  = node('SetVelocity',  1250, 200, { z: 0, mode: 'Set' });

      // Stamina recovery on tick
      const tick   = node('OnTick',       50, 400);
      const curStam= node('GetState',     250, 400, { name: 'Stamina' });
      const maxChk = node('Compare',      450, 400, { op: '<' });
      const maxVal = node('Value',        450, 470, { value: 100 });
      const recov  = node('Branch',       650, 400);
      const addStam= node('MathOp',       850, 400, { op: 'Add' });
      const rateVal= node('Value',        850, 470, { value: 1 });
      const saveSt = node('SetState',     1050, 400, { name: 'Stamina' });

      nodes.push(
        btn, stam, enoughStam, stamVal, gate,
        anim, vel, iOn, drainAmt, newStam, setStam,
        waitActive, iOff, decel,
        tick, curStam, maxChk, maxVal, recov, addStam, rateVal, saveSt,
      );

      edges.push(connect(btn,   'out',  stam,   'in'));
      edges.push(connect(stam,  'value',enoughStam,'A'));
      edges.push(connect(stamVal,'value',enoughStam,'B'));
      edges.push(connect(enoughStam,'value',gate,'cond'));
      edges.push(connect(btn,   'out',  gate,   'in'));
      edges.push(connect(gate,  'true', anim,   'in'));
      edges.push(connect(anim,  'out',  vel,    'in'));
      edges.push(connect(vel,   'out',  iOn,    'in'));
      edges.push(connect(stam,  'value',newStam,'A'));
      edges.push(connect(drainAmt,'value',newStam,'B'));
      edges.push(connect(iOn,   'out',  setStam,'in'));
      edges.push(connect(newStam,'result',setStam,'value'));
      edges.push(connect(setStam,'out',  waitActive,'in'));
      edges.push(connect(waitActive,'elapsed',iOff,'in'));
      edges.push(connect(iOff,  'out',  decel,  'in'));

      edges.push(connect(tick,  'out',  curStam,'in'));
      edges.push(connect(curStam,'value',maxChk,'A'));
      edges.push(connect(maxVal,'value',maxChk,'B'));
      edges.push(connect(maxChk,'value',recov,'cond'));
      edges.push(connect(tick,  'out',  recov,  'in'));
      edges.push(connect(recov, 'true', saveSt, 'in'));
      edges.push(connect(curStam,'value',addStam,'A'));
      edges.push(connect(rateVal,'value',addStam,'B'));
      edges.push(connect(addStam,'result',saveSt,'value'));

      return { nodes, edges };
    }
  },

  {
    id: 'lock-on-targeting',
    label: 'Lock-On Targeting',
    category: 'Combat',
    icon: 'gps_fixed',
    description: 'Z-targeting (Zelda/Souls): press Z to lock camera and movement onto nearest tagged enemy. C-Up cycles between targets. Camera orbits around locked target.',
    requirements: ['Tag: Enemy exists in scene', 'MainCamera in scene'],
    vibePrompt:
      'I have lock-on targeting applied. Extend it: (1) while locked on, strafe with left stick ' +
      '(relative to camera plane, not world-forward), (2) auto-switch target if locked enemy is ' +
      'destroyed (listen for OnSignal "enemy.defeated", find next nearest), ' +
      '(3) draw a targeting reticle sprite over the locked entity using SetHUDVisible.',
    buildGraph: (ent) => {
      const nodes: NodeGraphNode[] = [];
      const edges: NodeGraphEdge[] = [];

      // Toggle lock-on state on Z press
      const zBtn   = node('OnButtonPress', 50, 50, { button: 'Z' });
      const locked = node('GetState',     250, 50, { name: 'LockOn' });
      const isLocked = node('Compare',   450, 50, { op: '==' });
      const zeroVal= node('Value',       450, 120, { value: 0 });
      const branch = node('Branch',      650, 50);

      // Activate lock-on
      const findNearest = node('Func',   850, 50, { name: 'FindNearestTagged', arg0: 'Enemy', arg1: 12 });
      const setTarget   = node('SetState',1050,50, { name: 'LockTarget', value: 0 });
      const setLocked   = node('SetState',1250,50, { name: 'LockOn', value: 1 });

      // Deactivate lock-on
      const clearLock   = node('SetState',850, 200, { name: 'LockOn', value: 0 });

      // Tick: orient camera toward locked target while active
      const tick    = node('OnTick',      50, 350);
      const chkLock = node('GetState',   250, 350, { name: 'LockOn' });
      const isOn    = node('Compare',    450, 350, { op: '==' });
      const oneVal  = node('Value',      450, 420, { value: 1 });
      const guard   = node('Branch',     650, 350);
      const getTarget= node('GetState',  850, 350, { name: 'LockTarget' });
      const camAim  = node('Func',      1050, 350, { name: 'AimCameraAt', arg0: 'LockTarget', blendSpeed: 8 });
      const faceEnemy= node('Func',     1250, 350, { name: 'FaceEntity', arg0: 'LockTarget', blendSpeed: 12 });

      // Cycle targets with C-Up
      const cUp     = node('OnButtonPress', 50, 550, { button: 'C-Up' });
      const cycle   = node('Func',          280, 550, { name: 'CycleNearestTagged', arg0: 'Enemy', maxDist: 12 });
      const saveNext= node('SetState',      500, 550, { name: 'LockTarget', value: 0 });

      nodes.push(
        zBtn, locked, isLocked, zeroVal, branch,
        findNearest, setTarget, setLocked, clearLock,
        tick, chkLock, isOn, oneVal, guard, getTarget, camAim, faceEnemy,
        cUp, cycle, saveNext,
      );

      edges.push(connect(zBtn,   'out',  locked,   'in'));
      edges.push(connect(locked, 'value',isLocked, 'A'));
      edges.push(connect(zeroVal,'value',isLocked, 'B'));
      edges.push(connect(isLocked,'value',branch,  'cond'));
      edges.push(connect(zBtn,   'out',  branch,   'in'));
      edges.push(connect(branch, 'true', findNearest,'in'));
      edges.push(connect(findNearest,'out',setTarget,'in'));
      edges.push(connect(setTarget,'out',setLocked, 'in'));
      edges.push(connect(branch, 'false',clearLock, 'in'));

      edges.push(connect(tick,   'out',  chkLock,  'in'));
      edges.push(connect(chkLock,'value',isOn,     'A'));
      edges.push(connect(oneVal, 'value',isOn,     'B'));
      edges.push(connect(isOn,   'value',guard,    'cond'));
      edges.push(connect(tick,   'out',  guard,    'in'));
      edges.push(connect(guard,  'true', getTarget,'in'));
      edges.push(connect(getTarget,'value',camAim, 'in'));
      edges.push(connect(camAim, 'out',  faceEnemy,'in'));

      edges.push(connect(cUp,    'out',  cycle,    'in'));
      edges.push(connect(cycle,  'out',  saveNext, 'in'));

      return { nodes, edges };
    }
  },

  {
    id: 'health-damage-system',
    label: 'Health & Damage System',
    category: 'Combat',
    icon: 'monitor_heart',
    description: 'Full health system: damage intake gated by invincibility flag, hurt animation, i-frame timer, death sequence, and scene reload on HP ≤ 0.',
    requirements: ['Tag: Enemy or Player on self', 'Animations: Hurt, Die'],
    vibePrompt:
      'I have the health/damage system applied. Now add: (1) damage types — read a "DamageType" ' +
      'property from the source entity (Fire/Ice/Physical) and apply a 1.5× multiplier for the ' +
      'entity\'s weakness stored in state "Weakness", (2) a brief screen flash (SetVisible on a ' +
      'full-screen overlay entity for 2 frames) on each hit, (3) display remaining HP in the HUD ' +
      'immediately after each damage event using SetHUDText.',
    buildGraph: (ent) => {
      const nodes: NodeGraphNode[] = [];
      const edges: NodeGraphEdge[] = [];

      const hit     = node('OnCollide', 50, 50,  { tag: 'DamageSource' });
      const checkInvincible = node('CheckFlag', 280, 50,  { flag: 'Invincible', expected: false });
      const dmg     = node('SetHealth', 500, 50,  { amount: -10, mode: 'Add', target: 'Self' });
      const hurt    = node('PlayAnim', 700, 50,   { anim: 'Hurt', loop: false, blend: 0.05 });
      const sfxHurt = node('PlaySound', 700, 150, { sound: 'Hurt' });
      const setInv  = node('SetFlag', 900, 50,    { flag: 'Invincible', value: true });
      const timer   = node('Timer', 900, 150,     { duration: 1.5, repeat: false });
      const clrInv  = node('SetFlag', 1100, 150,  { flag: 'Invincible', value: false });

      const hp      = node('GetHealth', 50, 300,  { target: 'Self' });
      const dead    = node('Branch', 280, 300,    { threshold: 0, op: 'LessEqual' });
      const dieAnim = node('PlayAnim', 500, 300,  { anim: 'Die', loop: false, blend: 0.05 });
      const sfxDie  = node('PlaySound', 500, 400, { sound: 'Die' });
      const respawn = node('Timer', 700, 300,     { duration: 3.0, repeat: false });
      const reload  = node('LoadScene', 900, 300, { scene: 'Current', resetHealth: true });

      nodes.push(hit, checkInvincible, dmg, hurt, sfxHurt, setInv, timer, clrInv, hp, dead, dieAnim, sfxDie, respawn, reload);
      edges.push(connect(hit,            'out',     checkInvincible, 'in'));
      edges.push(connect(checkInvincible,'out',     dmg,     'in'));
      edges.push(connect(dmg,     'out',     hurt,    'in'));
      edges.push(connect(dmg,     'out',     sfxHurt, 'in'));
      edges.push(connect(dmg,     'out',     setInv,  'in'));
      edges.push(connect(setInv,  'out',     timer,   'in'));
      edges.push(connect(timer,   'elapsed', clrInv,  'in'));
      edges.push(connect(dmg,     'out',     hp,      'in'));
      edges.push(connect(hp,      'f',       dead,    'value'));
      edges.push(connect(dead,    'true',    dieAnim, 'in'));
      edges.push(connect(dead,    'true',    sfxDie,  'in'));
      edges.push(connect(dieAnim, 'out',     respawn, 'in'));
      edges.push(connect(respawn, 'elapsed', reload,  'in'));

      return { nodes, edges };
    }
  },

  {
    id: 'ranged-weapon',
    label: 'Ranged Weapon (Charge Shot)',
    category: 'Combat',
    icon: 'track_changes',
    description: 'Hold B to charge, release to fire. Charge time determines damage and projectile size. Three-shot burst on tap, single charged shot on hold ≥ 0.6s.',
    requirements: ['Animations: Shoot, Charge', 'Prefab: Bullet, ChargedBullet'],
    vibePrompt:
      'I have the ranged weapon applied. Add: (1) ammo limit — maximum 12 shots stored in state ' +
      '"Ammo", decrement on each fire, prevent firing at 0, show ammo count in HUD, ' +
      '(2) reload on R button — play Reload animation, wait for AnimEnd, refill Ammo to 12, ' +
      'play a reload sound, (3) bullet spread — add a small random X offset (±0.5) to bullet ' +
      'spawn position to simulate gun kick.',
    buildGraph: (ent) => {
      const nodes: NodeGraphNode[] = [];
      const edges: NodeGraphEdge[] = [];

      // Track hold duration via a per-tick counter
      const hold   = node('OnButtonHeld',  50, 50,  { button: 'B' });
      const incChg = node('GetState',      250, 50, { name: 'ChargeTime' });
      const addOne = node('MathOp',        450, 50, { op: 'Add' });
      const oneV   = node('Value',         450, 120, { value: 1 });
      const setChg = node('SetState',      650, 50,  { name: 'ChargeTime' });

      // On release: read charge, branch tap vs charged
      const rel    = node('OnButtonRelease', 50, 250, { button: 'B' });
      const chgVal = node('GetState',        250, 250, { name: 'ChargeTime' });
      const isChgd = node('Compare',         450, 250, { op: '>=' });
      const thres  = node('Value',           450, 320, { value: 18 }); // ~0.6s @ 30fps
      const bBranch= node('Branch',          650, 250);

      // Tap: 3-shot burst
      const shootAnim  = node('PlayAnim',   850, 150, { anim: 'Shoot', loop: false, blend: 0.05 });
      const spawn1 = node('Spawn',          1050, 150, { prefab: 'Bullet', socket: 'SpawnPoint', pooled: true });
      const vel1   = node('SetVelocity',    1250, 150, { z: 24, mode: 'Set', target: 'Spawned' });
      const sfxShot= node('PlaySound',      1050, 230, { sound: 'Shoot' });
      const life1  = node('Timer',          1250, 230, { duration: 2.0, repeat: false });
      const dest1  = node('Destroy',        1450, 230, { target: 'Spawned' });

      // Charged: single heavy shot
      const chgAnim  = node('PlayAnim',     850, 380, { anim: 'Charge', loop: false, blend: 0.05 });
      const spawn2   = node('Spawn',        1050, 380, { prefab: 'ChargedBullet', socket: 'SpawnPoint', pooled: true });
      const vel2     = node('SetVelocity',  1250, 380, { z: 16, mode: 'Set', target: 'Spawned' });
      const sfxBig   = node('PlaySound',    1050, 460, { sound: 'ChargedShot' });
      const life2    = node('Timer',        1250, 460, { duration: 4.0, repeat: false });
      const dest2    = node('Destroy',      1450, 460, { target: 'Spawned' });

      // Always reset charge timer after release
      const clrChg   = node('SetState',    850, 550, { name: 'ChargeTime', value: 0 });

      nodes.push(
        hold, incChg, addOne, oneV, setChg,
        rel, chgVal, isChgd, thres, bBranch,
        shootAnim, spawn1, vel1, sfxShot, life1, dest1,
        chgAnim, spawn2, vel2, sfxBig, life2, dest2,
        clrChg,
      );

      edges.push(connect(hold,  'out',     setChg,  'in'));
      edges.push(connect(incChg,'value',   addOne, 'A'));
      edges.push(connect(oneV,  'value',   addOne, 'B'));
      edges.push(connect(addOne,'result',  setChg, 'value'));

      edges.push(connect(rel,   'out',  chgVal,  'in'));
      edges.push(connect(chgVal,'value',isChgd,  'A'));
      edges.push(connect(thres, 'value',isChgd,  'B'));
      edges.push(connect(isChgd,'value',bBranch, 'cond'));
      edges.push(connect(rel,   'out',  bBranch, 'in'));

      edges.push(connect(bBranch,'false',shootAnim,'in'));
      edges.push(connect(shootAnim,'out', spawn1, 'in'));
      edges.push(connect(spawn1,  'out', vel1,   'in'));
      edges.push(connect(spawn1,  'out', sfxShot,'in'));
      edges.push(connect(spawn1,  'out', life1,  'in'));
      edges.push(connect(life1,   'elapsed',dest1,'in'));

      edges.push(connect(bBranch,'true', chgAnim,'in'));
      edges.push(connect(chgAnim,'out',  spawn2, 'in'));
      edges.push(connect(spawn2, 'out',  vel2,   'in'));
      edges.push(connect(spawn2, 'out',  sfxBig, 'in'));
      edges.push(connect(spawn2, 'out',  life2,  'in'));
      edges.push(connect(life2,  'elapsed',dest2,'in'));

      edges.push(connect(rel,    'out',  clrChg, 'in'));

      return { nodes, edges };
    }
  },

  // ─── UI ────────────────────────────────────────────────────────────────────

  {
    id: 'hud-health-bar',
    label: 'HUD Health Bar',
    category: 'UI',
    icon: 'health_and_safety',
    description: 'Live health bar overlay: color transitions from green → yellow → red as HP drops. Includes numeric HP/MaxHP readout.',
    requirements: ['Health system on entity'],
    vibePrompt:
      'I have the health bar applied. Now add: (1) a low-health warning — when HP ≤ 25% pulse ' +
      'the bar opacity with a WaitFrames loop (on 3 frames, off 3 frames) and play a heartbeat ' +
      'sound every 1.5s, (2) a brief "damage flash" that instantly sets the bar to white for ' +
      '2 frames then eases back to the normal color whenever damage is taken ' +
      '(listen for OnSignal "player.damaged").',
    buildGraph: (ent) => {
      const nodes: NodeGraphNode[] = [];
      const edges: NodeGraphEdge[] = [];

      const tick   = node('OnTick', 50, 50);
      const hp     = node('GetHealth', 280, 50, { target: ent });
      const maxHp  = node('GetProperty', 480, 50, { target: ent, prop: 'maxHealth' });
      const ratio  = node('Divide', 680, 50);
      const hudBar = node('SetHUDBar', 880, 50, { element: 'HealthBar', colorLow: '#e84040', colorHigh: '#40e860' });
      const hudNum = node('SetHUDText', 880, 150, { element: 'HealthNum', format: '{0}/{1}' });

      nodes.push(tick, hp, maxHp, ratio, hudBar, hudNum);
      edges.push(connect(tick,  'out', hp,     'in'));
      edges.push(connect(tick,  'out', maxHp,  'in'));
      edges.push(connect(hp,    'f',   ratio,  'a'));
      edges.push(connect(maxHp, 'f',   ratio,  'b'));
      edges.push(connect(ratio, 'f',   hudBar, 'ratio'));
      edges.push(connect(hp,    'f',   hudNum, 'arg0'));
      edges.push(connect(maxHp, 'f',   hudNum, 'arg1'));

      return { nodes, edges };
    }
  },

  {
    id: 'stamina-bar',
    label: 'Stamina Bar',
    category: 'UI',
    icon: 'electric_bolt',
    description: 'Stamina gauge that tracks the Stamina state variable every tick, with a recovery delay — depletes on action, pauses, then recharges. HUD bar turns yellow when low.',
    requirements: ['Dodge Roll or similar stamina-consuming component'],
    vibePrompt:
      'I have the stamina bar HUD applied. Extend it: (1) delay recovery by 0.8s after the last ' +
      'stamina-draining action — use a SetFlag "StaminaRecharging false" on drain and a Timer to ' +
      'set it true again before recovery starts, (2) play a short "depleted" sound when stamina ' +
      'hits zero and briefly flash the bar red, (3) add a second "exhausted" state where movement ' +
      'speed is halved (SetState "SpeedMod" 50) until stamina exceeds 30.',
    buildGraph: (ent) => {
      const nodes: NodeGraphNode[] = [];
      const edges: NodeGraphEdge[] = [];

      const tick   = node('OnTick', 50, 50);
      const stam   = node('GetState', 280, 50, { name: 'Stamina' });
      const maxSt  = node('Value', 480, 50, { value: 100 });
      const ratio  = node('Divide', 680, 50);
      const hudBar = node('SetHUDBar', 880, 50,
        { element: 'StaminaBar', colorLow: '#e8c040', colorHigh: '#40aaff' });
      const hudNum = node('SetHUDText', 880, 150, { element: 'StaminaNum', format: '{0}' });

      // Deplete indicator: show warning when stamina < 25
      const lowChk = node('Compare', 280, 250, { op: '<' });
      const lowVal = node('Value',   480, 250, { value: 25 });
      const warnBr = node('Branch',  680, 250);
      const warnOn = node('SetHUDVisible', 880, 250, { element: 'StaminaWarning', visible: true });
      const warnOf = node('SetHUDVisible', 880, 350, { element: 'StaminaWarning', visible: false });

      nodes.push(tick, stam, maxSt, ratio, hudBar, hudNum, lowChk, lowVal, warnBr, warnOn, warnOf);
      edges.push(connect(tick,  'out',   stam,   'in'));
      edges.push(connect(tick,  'out',   maxSt,  'in'));
      edges.push(connect(stam,  'value', ratio,  'a'));
      edges.push(connect(maxSt, 'value', ratio,  'b'));
      edges.push(connect(ratio, 'f',     hudBar, 'ratio'));
      edges.push(connect(stam,  'value', hudNum, 'arg0'));
      edges.push(connect(stam,  'value', lowChk, 'A'));
      edges.push(connect(lowVal,'value', lowChk, 'B'));
      edges.push(connect(lowChk,'value', warnBr, 'cond'));
      edges.push(connect(tick,  'out',   warnBr, 'in'));
      edges.push(connect(warnBr,'true',  warnOn, 'in'));
      edges.push(connect(warnBr,'false', warnOf, 'in'));

      return { nodes, edges };
    }
  },

  {
    id: 'boss-health-bar',
    label: 'Boss Health Bar',
    category: 'UI',
    icon: 'warning',
    description: 'Dramatic boss health bar: entity name title, segmented HP phases (each phase triggers a special event), and an intro animation that drops in from off-screen on boss spawn.',
    requirements: ['Boss entity with maxHealth set', 'Animations: BossIntro on boss'],
    vibePrompt:
      'I have the boss health bar applied. Now add: (1) at each phase boundary (75%, 50%, 25% HP) ' +
      'trigger a boss "enrage" event via EmitSignal "boss.phase_change" with the phase number as ' +
      'payload, (2) play a camera shake for 0.5s at each phase transition, (3) change the bar ' +
      'color per phase: green → orange → red → flashing red using SetHUDBar colorHigh per phase.',
    buildGraph: (ent) => {
      const nodes: NodeGraphNode[] = [];
      const edges: NodeGraphEdge[] = [];

      // Init: show bar with boss name, play intro
      const start  = node('OnStart', 50, 50);
      const showBar= node('SetHUDVisible', 280, 50, { element: 'BossBar', visible: true });
      const setName= node('SetHUDText', 480, 50, { element: 'BossName', format: ent });
      const slide  = node('Tween', 680, 50, { duration: 0.8, easing: 'EaseOut', element: 'BossBar', property: 'y', from: -80, to: 0 });
      const sfxIntro = node('PlaySound', 880, 50, { sound: 'BossIntro' });

      // Per tick: update bar fill
      const tick   = node('OnTick', 50, 250);
      const hp     = node('GetHealth', 280, 250, { target: ent });
      const maxHp  = node('GetProperty', 480, 250, { target: ent, prop: 'maxHealth' });
      const ratio  = node('Divide', 680, 250);
      const hudBar = node('SetHUDBar', 880, 250,
        { element: 'BossHealthBar', colorLow: '#ff2020', colorHigh: '#20e840', segments: 4 });

      // On death: hide bar
      const die    = node('OnSignal', 50, 450, { signal: `${ent}.death` });
      const hideBar= node('SetHUDVisible', 280, 450, { element: 'BossBar', visible: false });
      const sfxDead= node('PlaySound', 480, 450, { sound: 'BossDefeat' });

      nodes.push(start, showBar, setName, slide, sfxIntro, tick, hp, maxHp, ratio, hudBar, die, hideBar, sfxDead);

      edges.push(connect(start,  'out', showBar, 'in'));
      edges.push(connect(showBar,'out', setName, 'in'));
      edges.push(connect(setName,'out', slide,   'in'));
      edges.push(connect(slide,  'done',sfxIntro,'in'));

      edges.push(connect(tick,   'out', hp,      'in'));
      edges.push(connect(tick,   'out', maxHp,   'in'));
      edges.push(connect(hp,     'f',   ratio,   'a'));
      edges.push(connect(maxHp,  'f',   ratio,   'b'));
      edges.push(connect(ratio,  'f',   hudBar,  'ratio'));

      edges.push(connect(die,    'out', hideBar, 'in'));
      edges.push(connect(hideBar,'out', sfxDead, 'in'));

      return { nodes, edges };
    }
  },

  {
    id: 'floating-damage-numbers',
    label: 'Floating Damage Numbers',
    category: 'UI',
    icon: 'crisis_alert',
    description: 'Spawn a world-space damage number label at the hit point, float it upward over 0.8s, then fade and destroy it. Critical hits show in red at larger scale.',
    requirements: ['Prefab: DamageLabel (HUD world-space sprite)', 'Health system on target'],
    vibePrompt:
      'I have floating damage numbers applied. Now: (1) color-code by damage type — physical: white, ' +
      'fire: orange, ice: cyan, critical: red at 1.5× scale, (2) add a brief "pop" scale tween ' +
      '(1.4→1.0 over 4 frames) on spawn for extra juice, (3) stack multiple numbers slightly offset ' +
      'horizontally so simultaneous hits don\'t overlap (read state "DmgNumCount" as X offset).',
    buildGraph: (ent) => {
      const nodes: NodeGraphNode[] = [];
      const edges: NodeGraphEdge[] = [];

      // React to a signal that any damage event emits
      const dmgEvt = node('OnSignal', 50, 50, { signal: `${ent}.damage_taken`, payload: 'amount' });

      // Spawn label at hit position
      const spawn  = node('Spawn', 280, 50, { prefab: 'DamageLabel', socket: 'HitPoint', pooled: true });
      const setText= node('SetProperty', 500, 50, { target: 'Spawned', prop: 'text', source: 'payload' });

      // Float upward animation
      const floatTw= node('Tween', 700, 50, { duration: 0.8, easing: 'EaseOut',
        target: 'Spawned', property: 'posY', from: 0, to: 1.5 });

      // Fade out in parallel
      const fadeTw = node('Tween', 700, 150, { duration: 0.8, easing: 'Linear',
        target: 'Spawned', property: 'alpha', from: 1.0, to: 0.0 });

      // Destroy after float completes
      const dest   = node('Destroy', 950, 100, { target: 'Spawned', delay: 0 });

      // Critical hit branch: damage > 30 → red + scale
      const amount = node('GetProperty', 50, 300, { target: 'Spawned', prop: 'numericValue' });
      const isCrit = node('Compare', 250, 300, { op: '>' });
      const critThr= node('Value', 250, 370, { value: 30 });
      const critBr = node('Branch', 450, 300);
      const setRed = node('SetProperty', 650, 300, { target: 'Spawned', prop: 'color', value: '#ff2020' });
      const setScale=node('SetProperty', 850, 300, { target: 'Spawned', prop: 'scale', value: 1.5 });

      nodes.push(dmgEvt, spawn, setText, floatTw, fadeTw, dest, amount, isCrit, critThr, critBr, setRed, setScale);

      edges.push(connect(dmgEvt,'out',  spawn,   'in'));
      edges.push(connect(spawn, 'out',  setText, 'in'));
      edges.push(connect(setText,'out', floatTw, 'in'));
      edges.push(connect(setText,'out', fadeTw,  'in'));
      edges.push(connect(floatTw,'done',dest,    'in'));

      edges.push(connect(spawn,  'out',  amount, 'in'));
      edges.push(connect(amount, 'value',isCrit, 'A'));
      edges.push(connect(critThr,'value',isCrit, 'B'));
      edges.push(connect(isCrit, 'value',critBr, 'cond'));
      edges.push(connect(spawn,  'out',  critBr, 'in'));
      edges.push(connect(critBr, 'true', setRed,  'in'));
      edges.push(connect(setRed, 'out',  setScale,'in'));

      return { nodes, edges };
    }
  },

  {
    id: 'dialogue-box',
    label: 'Dialogue Box',
    category: 'UI',
    icon: 'chat_bubble',
    description: 'NPC dialogue system: show a portrait + name + typewriter-effect text box on interaction. Advances on A press, hides on the last line, supports multiple pages.',
    requirements: ['IsTrigger on NPC', 'HUD elements: DialogueBox, DialogueName, DialogueText, Portrait'],
    vibePrompt:
      'I have the dialogue box applied. Extend it: (1) add a "choice branch" — on specific pages ' +
      'show two response options via SetHUDText "Choice A" / "Choice B" and read C-Left/C-Right ' +
      'to pick, storing the result in state "PlayerChoice", (2) play a different character voice ' +
      'beep pitched per character (use PlaySound "Beep" with a pitch property on each character ' +
      'definition), (3) emit signal "dialogue.complete" when the last page dismisses so other ' +
      'systems (doors, cutscenes) can listen.',
    buildGraph: (ent) => {
      const nodes: NodeGraphNode[] = [];
      const edges: NodeGraphEdge[] = [];

      // Trigger interaction
      const enter  = node('OnCollide', 50, 50, { type: 'Enter', tag: 'Player' });
      const intBtn = node('OnButtonPress', 50, 150, { button: 'B' }); // interact
      const guard  = node('CheckFlag', 280, 150, { flag: 'InDialogue', expected: false });

      // Show dialogue UI
      const showBox= node('SetHUDVisible', 500, 150, { element: 'DialogueBox', visible: true });
      const setName= node('SetHUDText',   700, 150, { element: 'DialogueName', format: ent });
      const setFlag= node('SetFlag',      900, 150, { flag: 'InDialogue', value: true });
      const setPage= node('SetState',     900, 250, { name: 'DialoguePage', value: 0 });

      // Typewriter: page 0
      const type0  = node('TypewriterText', 500, 350, { element: 'DialogueText',
        text: `Hello! I am ${ent}. Press A to continue.`, charDelay: 0.04 });
      const beep0  = node('PlaySound', 700, 350, { sound: 'DialogueBeep', loop: false });

      // Advance on A
      const adv    = node('OnButtonPress', 50, 500, { button: 'A' });
      const inDlg  = node('CheckFlag',    280, 500, { flag: 'InDialogue', expected: true });
      const page   = node('GetState',     500, 500, { name: 'DialoguePage' });
      const sw     = node('SwitchCase',   700, 500, { cases: ['0', '1'] });

      // Page 1: last page
      const type1  = node('TypewriterText', 900, 500, { element: 'DialogueText',
        text: 'Goodbye!', charDelay: 0.04 });
      const type1End=node('WaitAnimEnd',  1100, 500);

      // Close
      const close  = node('SetHUDVisible', 1300, 500, { element: 'DialogueBox', visible: false });
      const clrFlg = node('SetFlag',       1300, 600, { flag: 'InDialogue', value: false });
      const sig    = node('EmitSignal',    1300, 700, { signal: `${ent}.dialogue_complete` });

      nodes.push(enter, intBtn, guard, showBox, setName, setFlag, setPage, type0, beep0,
        adv, inDlg, page, sw, type1, type1End, close, clrFlg, sig);

      edges.push(connect(enter,  'out',  intBtn,  'in'));
      edges.push(connect(intBtn, 'out',  guard,   'in'));
      edges.push(connect(guard,  'out',  showBox, 'in'));
      edges.push(connect(showBox,'out',  setName, 'in'));
      edges.push(connect(setName,'out',  setFlag, 'in'));
      edges.push(connect(setFlag,'out',  setPage, 'in'));
      edges.push(connect(setPage,'out',  type0,   'in'));
      edges.push(connect(type0,  'out',  beep0,   'in'));

      edges.push(connect(adv,    'out',  inDlg,  'in'));
      edges.push(connect(inDlg,  'out',  page,   'in'));
      edges.push(connect(page,   'value',sw,     'value'));
      edges.push(connect(inDlg,  'out',  sw,     'in'));
      edges.push(connect(sw,     'S1',   type1,  'in'));
      edges.push(connect(type1,  'out',  type1End,'in'));
      edges.push(connect(type1End,'out', close,  'in'));
      edges.push(connect(close,  'out',  clrFlg, 'in'));
      edges.push(connect(clrFlg, 'out',  sig,    'in'));

      return { nodes, edges };
    }
  },

  {
    id: 'hud-score-counter',
    label: 'Score Counter',
    category: 'UI',
    icon: 'stars',
    description: 'Increments score on item pickup or enemy defeat and refreshes the HUD score display. Supports multiplier combos.',
    requirements: ['ScoreManager singleton in scene'],
    vibePrompt:
      'I have the score counter applied. Now add a combo multiplier: (1) each enemy defeat within ' +
      '3s of the last increments a combo counter (state "Combo"), (2) the score added is base × ' +
      'Combo (use MathOp Mul), (3) a 3s timer resets Combo to 1 on expiry, (4) display the combo ' +
      'count with a large SetHUDText "×{0} COMBO!" element that fades out after 1.5s when not ' +
      'renewed. Keep total under 15 nodes.',
    buildGraph: (ent) => {
      const nodes: NodeGraphNode[] = [];
      const edges: NodeGraphEdge[] = [];

      const collect = node('OnCollide', 50, 50,  { tag: 'Collectible' });
      const defeat  = node('OnSignal',  50, 200, { signal: 'enemy.defeated' });
      const pts1    = node('SetProperty', 300, 50,  { target: 'ScoreManager', prop: 'score', amount: 10, mode: 'Add' });
      const pts2    = node('SetProperty', 300, 200, { target: 'ScoreManager', prop: 'score', amount: 100, mode: 'Add' });
      const score   = node('GetProperty', 550, 100, { target: 'ScoreManager', prop: 'score' });
      const hud     = node('SetHUDText',  750, 100, { element: 'ScoreLabel', format: 'SCORE {0}' });
      const sfx1    = node('PlaySound', 300, 150,   { sound: 'Coin' });
      const sfx2    = node('PlaySound', 300, 300,   { sound: 'Defeat' });

      nodes.push(collect, defeat, pts1, pts2, score, hud, sfx1, sfx2);
      edges.push(connect(collect, 'out', pts1,  'in'));
      edges.push(connect(collect, 'out', sfx1,  'in'));
      edges.push(connect(defeat,  'out', pts2,  'in'));
      edges.push(connect(defeat,  'out', sfx2,  'in'));
      edges.push(connect(pts1,    'out', score, 'in'));
      edges.push(connect(pts2,    'out', score, 'in'));
      edges.push(connect(score,   'f',   hud,   'arg0'));

      return { nodes, edges };
    }
  }
];

export function getGroupedComponents(): Record<string, GameComponentTemplate[]> {
  const groups: Record<string, GameComponentTemplate[]> = {};
  for (const c of GAME_COMPONENTS) {
    if (!groups[c.category]) groups[c.category] = [];
    groups[c.category].push(c);
  }
  return groups;
}
