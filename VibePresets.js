/**
 * VibePresets.ts
 * Preset library for the Pyrite64 Vibe Coding Engine creator page.
 *
 * Organized into 6 top-level categories (tabs) mirroring a sports-game
 * character-creation flow.  Each preset carries:
 *   - visual metadata (icon, thumbnail color, tags)
 *   - a `config` record that maps directly to engine settings
 *   - a `prompt` string ready to pipe into the vibe chat for refinement
 *
 * Categories:
 *  1. World        — terrain, skybox, time-of-day, weather
 *  2. Player       — movement archetype, camera, base stats
 *  3. Enemies      — behavior archetype, spawn pattern
 *  4. Physics      — gravity, collision response, body types
 *  5. Shading      — render pipeline, lighting, materials
 *  6. Game Mode    — genre template (platformer, racer, RPG, …)
 */
export const PRESET_CATEGORIES = [
    { id: 'world', label: 'World', icon: '◈', desc: 'Terrain, sky, time of day, weather' },
    { id: 'player', label: 'Player', icon: '⬡', desc: 'Movement archetype, camera, base stats' },
    { id: 'enemies', label: 'Enemies', icon: '⚔', desc: 'Behavior archetype, spawn patterns' },
    { id: 'physics', label: 'Physics', icon: '◎', desc: 'Gravity, collision, body types' },
    { id: 'shading', label: 'Shading', icon: '◐', desc: 'Render pipeline, lighting, materials' },
    { id: 'gamemode', label: 'Game Mode', icon: '▶', desc: 'Genre template to kickstart a project' },
];
// ═════════════════════════════════════════════════════════════════════════════
//  WORLD PRESETS
// ═════════════════════════════════════════════════════════════════════════════
const WORLD_PRESETS = [
    {
        id: 'world-grasslands', category: 'world',
        title: 'Grasslands', subtitle: 'Rolling green hills, clear sky',
        icon: '🌿', thumbGrad: 'linear-gradient(135deg, #2d7d46 0%, #87ceeb 100%)',
        tags: ['outdoor', 'day', 'peaceful'],
        options: [
            { key: 'timeOfDay', label: 'Time of Day', type: 'select', default: 1,
                choices: ['Dawn', 'Midday', 'Sunset', 'Night'] },
            { key: 'fogDensity', label: 'Fog Density', type: 'slider', default: 0.3,
                range: [0, 1, 0.05] },
            { key: 'clearColor', label: 'Sky Color', type: 'color', default: '#87ceeb' },
            { key: 'ambientLevel', label: 'Ambient Brightness', type: 'slider', default: 0.6,
                range: [0, 1, 0.05] },
        ],
        config: {
            fogMode: 'clear-color', fogMin: 400, fogMax: 900,
            clearColor: [0.53, 0.81, 0.92],
            ambientColor: [0.6, 0.6, 0.55],
            dir0Color: [1.0, 0.95, 0.85], dir0Rot: [45, -30, 0],
        },
        prompt: 'I started from the Grasslands world preset — rolling green hills with clear sky. Help me customize the terrain layout, add trees or rocks, and tune the lighting to match my game\'s mood.',
    },
    {
        id: 'world-desert', category: 'world',
        title: 'Desert Canyon', subtitle: 'Sandy dunes, heat haze, orange sky',
        icon: '🏜', thumbGrad: 'linear-gradient(135deg, #c2842f 0%, #f5c76e 100%)',
        tags: ['outdoor', 'hot', 'barren'],
        options: [
            { key: 'timeOfDay', label: 'Time of Day', type: 'select', default: 1,
                choices: ['Dawn', 'Midday', 'Sunset', 'Night'] },
            { key: 'fogDensity', label: 'Heat Haze', type: 'slider', default: 0.5,
                range: [0, 1, 0.05] },
            { key: 'clearColor', label: 'Sky Color', type: 'color', default: '#f5c76e' },
        ],
        config: {
            fogMode: 'custom-color', fogMin: 300, fogMax: 700,
            fogColor: [0.96, 0.78, 0.43], clearColor: [0.96, 0.78, 0.43],
            ambientColor: [0.75, 0.55, 0.35],
            dir0Color: [1.0, 0.85, 0.50], dir0Rot: [70, -10, 0],
        },
        prompt: 'I started from the Desert Canyon preset. Help me add sandstone pillars, cacti, and maybe a distant oasis — all within N64 budget.',
    },
    {
        id: 'world-dungeon', category: 'world',
        title: 'Dungeon', subtitle: 'Dark stone corridors, torch light',
        icon: '🕯', thumbGrad: 'linear-gradient(135deg, #1a1a2e 0%, #4a3520 100%)',
        tags: ['indoor', 'dark', 'fantasy'],
        options: [
            { key: 'torchFlicker', label: 'Torch Flicker', type: 'toggle', default: true },
            { key: 'fogDensity', label: 'Fog Density', type: 'slider', default: 0.7,
                range: [0, 1, 0.05] },
            { key: 'clearColor', label: 'Ambient Tint', type: 'color', default: '#1a1a2e' },
        ],
        config: {
            fogMode: 'custom-color', fogMin: 100, fogMax: 400,
            fogColor: [0.05, 0.03, 0.08], clearColor: [0.04, 0.03, 0.07],
            ambientColor: [0.12, 0.08, 0.06],
            dir0Color: [0.85, 0.55, 0.25], dir0Rot: [30, 0, 0],
        },
        prompt: 'I started with the Dungeon preset — dark corridors with torchlight. Help me add flickering light variation, cobwebs, treasure chests, and locked doors.',
    },
    {
        id: 'world-snow', category: 'world',
        title: 'Snow Mountain', subtitle: 'Icy peaks, blizzard atmosphere',
        icon: '❄', thumbGrad: 'linear-gradient(135deg, #b0c4de 0%, #ffffff 100%)',
        tags: ['outdoor', 'cold', 'mountain'],
        options: [
            { key: 'blizzard', label: 'Blizzard Effect', type: 'toggle', default: false },
            { key: 'fogDensity', label: 'Snowfall Fog', type: 'slider', default: 0.4,
                range: [0, 1, 0.05] },
            { key: 'clearColor', label: 'Sky Color', type: 'color', default: '#b0c4de' },
        ],
        config: {
            fogMode: 'custom-color', fogMin: 250, fogMax: 600,
            fogColor: [0.82, 0.85, 0.92], clearColor: [0.69, 0.77, 0.87],
            ambientColor: [0.55, 0.58, 0.70],
            dir0Color: [0.90, 0.92, 1.0], dir0Rot: [35, -45, 0],
        },
        prompt: 'I started from the Snow Mountain preset. Help me add pine trees, ice patches for sliding, and a cabin or cave entrance.',
    },
    {
        id: 'world-lava', category: 'world',
        title: 'Volcanic Cavern', subtitle: 'Molten lava, ember particles',
        icon: '🌋', thumbGrad: 'linear-gradient(135deg, #2c0a0a 0%, #ff4500 100%)',
        tags: ['indoor', 'hot', 'danger'],
        options: [
            { key: 'lavaGlow', label: 'Lava Glow Intensity', type: 'slider', default: 0.8,
                range: [0, 1, 0.05] },
            { key: 'fogDensity', label: 'Smoke', type: 'slider', default: 0.6,
                range: [0, 1, 0.05] },
            { key: 'clearColor', label: 'Ambient Tint', type: 'color', default: '#1a0505' },
        ],
        config: {
            fogMode: 'custom-color', fogMin: 150, fogMax: 500,
            fogColor: [0.3, 0.05, 0.02], clearColor: [0.1, 0.02, 0.02],
            ambientColor: [0.45, 0.12, 0.05],
            dir0Color: [1.0, 0.35, 0.10], dir0Rot: [20, 0, 0],
        },
        prompt: 'I started from the Volcanic Cavern preset. Help me add rising lava platforms, falling rock hazards, and heat wave visual distortion within N64 limits.',
    },
    {
        id: 'world-space', category: 'world',
        title: 'Space Station', subtitle: 'Zero-G corridors, starfield backdrop',
        icon: '🚀', thumbGrad: 'linear-gradient(135deg, #0a0a2e 0%, #1a1a5e 50%, #000010 100%)',
        tags: ['indoor', 'sci-fi', 'dark'],
        options: [
            { key: 'starDensity', label: 'Star Density', type: 'slider', default: 0.5,
                range: [0, 1, 0.1] },
            { key: 'clearColor', label: 'Space Color', type: 'color', default: '#000010' },
        ],
        config: {
            fogMode: 'none', clearColor: [0.0, 0.0, 0.04],
            ambientColor: [0.15, 0.15, 0.25],
            dir0Color: [0.6, 0.7, 1.0], dir0Rot: [60, 30, 0],
        },
        prompt: 'I started from the Space Station preset. Help me add floating platforms, airlock doors, and a viewport with an animated planet backdrop.',
    },
];
// ═════════════════════════════════════════════════════════════════════════════
//  PLAYER PRESETS
// ═════════════════════════════════════════════════════════════════════════════
const PLAYER_PRESETS = [
    {
        id: 'player-platformer', category: 'player',
        title: 'Platformer Hero', subtitle: 'Jump, run, double-jump',
        icon: '🏃', thumbGrad: 'linear-gradient(135deg, #9d4edd 0%, #00d4ff 100%)',
        tags: ['3D', 'jump', 'fast'],
        options: [
            { key: 'moveSpeed', label: 'Move Speed', type: 'slider', default: 4.0,
                range: [1, 10, 0.5] },
            { key: 'jumpForce', label: 'Jump Force', type: 'slider', default: 8.0,
                range: [2, 16, 0.5] },
            { key: 'doubleJump', label: 'Double Jump', type: 'toggle', default: true },
            { key: 'cameraFollow', label: 'Camera Mode', type: 'select', default: 0,
                choices: ['Follow Behind', 'Orbit', 'Side-Scroll', 'Fixed'] },
        ],
        config: {
            collBody: { type: 'Sphere', halfExtend: [0.5, 0.5, 0.5], isTrigger: false },
            moveSpeed: 4.0, jumpForce: 8.0, gravity: -18.0,
            animations: ['idle', 'run', 'jump', 'fall', 'land', 'double_jump'],
        },
        prompt: 'I started from the Platformer Hero preset (speed 4, jump 8, double-jump). Help me wire up the movement nodes: OnTick → ReadStick → SetVelocity, OnButtonPress(A) → jump, and blend between idle/run/jump/fall animations.',
    },
    {
        id: 'player-topdown', category: 'player',
        title: 'Top-Down Explorer', subtitle: 'Zelda-style 8-dir movement',
        icon: '🧭', thumbGrad: 'linear-gradient(135deg, #39ff14 0%, #2d7d46 100%)',
        tags: ['top-down', 'explore', 'RPG'],
        options: [
            { key: 'moveSpeed', label: 'Move Speed', type: 'slider', default: 3.0,
                range: [1, 8, 0.5] },
            { key: 'dashEnabled', label: 'Dash Ability', type: 'toggle', default: false },
            { key: 'cameraHeight', label: 'Camera Height', type: 'slider', default: 12,
                range: [5, 25, 1] },
        ],
        config: {
            collBody: { type: 'Box', halfExtend: [0.4, 0.8, 0.4], isTrigger: false },
            moveSpeed: 3.0, gravity: -20.0,
            animations: ['idle', 'walk_n', 'walk_s', 'walk_e', 'walk_w', 'interact'],
        },
        prompt: 'I started from the Top-Down Explorer preset (Zelda-style). Help me set up 8-directional movement with ReadStick, animation blending for N/S/E/W directions, and an interaction trigger on A button.',
    },
    {
        id: 'player-racer', category: 'player',
        title: 'Racer', subtitle: 'Kart/vehicle with drift & boost',
        icon: '🏎', thumbGrad: 'linear-gradient(135deg, #ff6b35 0%, #ffd700 100%)',
        tags: ['vehicle', 'fast', 'racing'],
        options: [
            { key: 'topSpeed', label: 'Top Speed', type: 'slider', default: 12.0,
                range: [5, 25, 0.5] },
            { key: 'turnRate', label: 'Turn Sharpness', type: 'slider', default: 5.0,
                range: [1, 10, 0.5] },
            { key: 'driftEnabled', label: 'Drift Mechanic', type: 'toggle', default: true },
            { key: 'boostEnabled', label: 'Boost Pads', type: 'toggle', default: true },
        ],
        config: {
            collBody: { type: 'Box', halfExtend: [0.6, 0.3, 1.0], isTrigger: false },
            topSpeed: 12.0, turnRate: 5.0, gravity: -20.0,
            animations: ['idle', 'drive', 'drift_l', 'drift_r', 'boost', 'spin_out'],
        },
        prompt: 'I started from the Racer preset. Help me wire up acceleration with A button, steering with ReadStick, drift on Z with a boost payoff, and handleCollide for walls/other racers.',
    },
    {
        id: 'player-fighter', category: 'player',
        title: 'Brawler', subtitle: 'Melee combos, dodge, block',
        icon: '👊', thumbGrad: 'linear-gradient(135deg, #ff0055 0%, #cc0044 100%)',
        tags: ['action', 'melee', 'combat'],
        options: [
            { key: 'health', label: 'Starting Health', type: 'slider', default: 100,
                range: [50, 200, 10] },
            { key: 'attackPower', label: 'Attack Power', type: 'slider', default: 10,
                range: [1, 30, 1] },
            { key: 'comboDepth', label: 'Combo Chain Length', type: 'slider', default: 3,
                range: [1, 5, 1] },
            { key: 'dodgeRoll', label: 'Dodge Roll', type: 'toggle', default: true },
        ],
        config: {
            collBody: { type: 'Box', halfExtend: [0.4, 0.9, 0.4], isTrigger: false },
            health: 100, moveSpeed: 3.5, gravity: -18.0,
            animations: ['idle', 'run', 'attack1', 'attack2', 'attack3', 'dodge', 'hit', 'ko'],
        },
        prompt: 'I started from the Brawler preset (3-hit combo). Help me wire combo chain: OnButtonPress(A) → StateMachine(idle/atk1/atk2/atk3), each state plays its anim and waits for WaitAnimEnd before returning to idle. Add B button for dodge roll.',
    },
    {
        id: 'player-fps', category: 'player',
        title: 'First-Person', subtitle: 'Goldeneye-style FPS controls',
        icon: '🎯', thumbGrad: 'linear-gradient(135deg, #0a2463 0%, #3e92cc 100%)',
        tags: ['FPS', 'shooter', 'camera'],
        options: [
            { key: 'moveSpeed', label: 'Move Speed', type: 'slider', default: 3.5,
                range: [1, 8, 0.5] },
            { key: 'lookSens', label: 'Look Sensitivity', type: 'slider', default: 2.0,
                range: [0.5, 5, 0.25] },
            { key: 'autoAim', label: 'Auto-Aim Assist', type: 'toggle', default: true },
        ],
        config: {
            collBody: { type: 'Cylinder', halfExtend: [0.4, 0.9, 0.4], isTrigger: false },
            moveSpeed: 3.5, lookSpeed: 2.0, gravity: -18.0,
            animations: ['idle', 'walk', 'shoot', 'reload', 'hit'],
        },
        prompt: 'I started from the First-Person preset (Goldeneye-style). Help me wire strafe movement with ReadStick, C-button look, Z-trigger to shoot with PlayAnim and PlaySound, and R for reload.',
    },
];
// ═════════════════════════════════════════════════════════════════════════════
//  ENEMY PRESETS
// ═════════════════════════════════════════════════════════════════════════════
const ENEMY_PRESETS = [
    {
        id: 'enemy-patrol', category: 'enemies',
        title: 'Patrol Guard', subtitle: 'Walk between waypoints, chase on sight',
        icon: '🛡', thumbGrad: 'linear-gradient(135deg, #ff6b35 0%, #c0392b 100%)',
        tags: ['ground', 'chase', 'melee'],
        options: [
            { key: 'patrolRadius', label: 'Patrol Radius', type: 'slider', default: 8,
                range: [2, 20, 1] },
            { key: 'chaseSpeed', label: 'Chase Speed', type: 'slider', default: 3.0,
                range: [1, 8, 0.5] },
            { key: 'detectRange', label: 'Detect Range', type: 'slider', default: 6,
                range: [2, 15, 1] },
            { key: 'health', label: 'Health', type: 'slider', default: 30,
                range: [10, 100, 5] },
        ],
        config: {
            collBody: { type: 'Box', halfExtend: [0.5, 0.8, 0.5] },
            states: ['patrol', 'chase', 'attack', 'stunned'],
            animations: ['walk', 'run', 'attack', 'hit', 'die'],
        },
        prompt: 'I started from the Patrol Guard enemy preset. Wire a StateMachine with states: patrol → chase (when GetDistance < 6) → attack (when close) → patrol (when player escapes). Play walk/run/attack anims per state.',
    },
    {
        id: 'enemy-flying', category: 'enemies',
        title: 'Flying Swooper', subtitle: 'Circles overhead, dives to attack',
        icon: '🦅', thumbGrad: 'linear-gradient(135deg, #5e2d91 0%, #9d4edd 100%)',
        tags: ['air', 'dive', 'ranged'],
        options: [
            { key: 'circleRadius', label: 'Circle Radius', type: 'slider', default: 6,
                range: [3, 12, 1] },
            { key: 'diveSpeed', label: 'Dive Speed', type: 'slider', default: 8.0,
                range: [3, 15, 0.5] },
            { key: 'health', label: 'Health', type: 'slider', default: 15,
                range: [5, 50, 5] },
        ],
        config: {
            collBody: { type: 'Sphere', halfExtend: [0.4, 0.4, 0.4] },
            states: ['circle', 'dive', 'recover'],
            animations: ['fly', 'dive', 'hit', 'die'],
        },
        prompt: 'I started from the Flying Swooper enemy preset. Wire a StateMachine: circle (orbit player at y+5) → dive (when timer expires) → recover (fly back up). Use SetVelocity for smooth motion.',
    },
    {
        id: 'enemy-turret', category: 'enemies',
        title: 'Stationary Turret', subtitle: 'Fixed position, shoots at player',
        icon: '🔫', thumbGrad: 'linear-gradient(135deg, #555 0%, #888 100%)',
        tags: ['stationary', 'ranged', 'shooter'],
        options: [
            { key: 'fireRate', label: 'Fire Rate (s)', type: 'slider', default: 1.5,
                range: [0.3, 5, 0.1] },
            { key: 'range', label: 'Range', type: 'slider', default: 10,
                range: [3, 20, 1] },
            { key: 'health', label: 'Health', type: 'slider', default: 50,
                range: [10, 100, 5] },
        ],
        config: {
            collBody: { type: 'Box', halfExtend: [0.5, 0.6, 0.5], isFixed: true },
            states: ['idle', 'tracking', 'firing'],
            animations: ['idle', 'aim', 'fire', 'destroyed'],
        },
        prompt: 'I started from the Stationary Turret preset. Wire: OnTick → GetDistance(Player) → Branch(< range) → aim rotation + Spawn("Projectile") on timer, Play fire anim and sound. Destructible with 50 HP.',
    },
    {
        id: 'enemy-boss', category: 'enemies',
        title: 'Boss (Multi-Phase)', subtitle: '3-phase boss with phase transitions',
        icon: '💀', thumbGrad: 'linear-gradient(135deg, #8b0000 0%, #ff0055 50%, #ffd700 100%)',
        tags: ['boss', 'multi-phase', 'hard'],
        options: [
            { key: 'phases', label: 'Number of Phases', type: 'slider', default: 3,
                range: [2, 5, 1] },
            { key: 'health', label: 'Total Health', type: 'slider', default: 200,
                range: [50, 500, 25] },
            { key: 'arenaSize', label: 'Arena Size', type: 'slider', default: 15,
                range: [8, 30, 1] },
        ],
        config: {
            collBody: { type: 'Box', halfExtend: [1.0, 1.5, 1.0] },
            states: ['intro', 'phase1', 'transition', 'phase2', 'transition2', 'phase3', 'defeated'],
            animations: ['idle', 'roar', 'attack_melee', 'attack_range', 'stagger', 'transition', 'die'],
        },
        prompt: 'I started from the Multi-Phase Boss preset (3 phases, 200 HP). Wire a StateMachine: intro(roar anim) → phase1(melee attacks) → transition(at 66% HP) → phase2(adds ranged attacks) → transition2(at 33%) → phase3(enrage) → defeated. Each phase should increase speed.',
    },
];
// ═════════════════════════════════════════════════════════════════════════════
//  PHYSICS PRESETS
// ═════════════════════════════════════════════════════════════════════════════
const PHYSICS_PRESETS = [
    {
        id: 'phys-standard', category: 'physics',
        title: 'Standard Platformer', subtitle: 'SM64-style gravity + ground snap',
        icon: '⬇', thumbGrad: 'linear-gradient(135deg, #2196f3 0%, #00bcd4 100%)',
        tags: ['gravity', 'platformer', 'default'],
        options: [
            { key: 'gravity', label: 'Gravity', type: 'slider', default: -18.0,
                range: [-30, -5, 0.5] },
            { key: 'terminalVel', label: 'Terminal Velocity', type: 'slider', default: -25.0,
                range: [-50, -10, 1] },
            { key: 'groundSnap', label: 'Ground Snap', type: 'toggle', default: true },
        ],
        config: {
            gravity: -18.0, terminalVelocity: -25.0,
            groundSnap: true, slopeLimit: 45,
            collTriTypes: ['FLOOR', 'WALL', 'CEIL'],
        },
        prompt: 'I chose Standard Platformer physics (gravity -18, ground snap, 45° slope limit). Help me add slope sliding for steep surfaces and a coyote-time window for jump.',
    },
    {
        id: 'phys-floaty', category: 'physics',
        title: 'Floaty / Moon', subtitle: 'Low gravity, high jumps, slow fall',
        icon: '🌙', thumbGrad: 'linear-gradient(135deg, #1a1a4e 0%, #4a4a8e 100%)',
        tags: ['low-gravity', 'moon', 'space'],
        options: [
            { key: 'gravity', label: 'Gravity', type: 'slider', default: -6.0,
                range: [-15, -1, 0.5] },
            { key: 'airControl', label: 'Air Control', type: 'slider', default: 0.8,
                range: [0, 1, 0.05] },
        ],
        config: {
            gravity: -6.0, terminalVelocity: -10.0,
            groundSnap: false, airControl: 0.8,
        },
        prompt: 'I chose Floaty / Moon physics (gravity -6, high air control). Help me make movement feel spacey — long hang time, gentle arcs, maybe a jetpack burst on B.',
    },
    {
        id: 'phys-heavy', category: 'physics',
        title: 'Heavy / Tank', subtitle: 'Strong gravity, weighty feel',
        icon: '⚓', thumbGrad: 'linear-gradient(135deg, #333 0%, #666 100%)',
        tags: ['heavy', 'tank', 'mech'],
        options: [
            { key: 'gravity', label: 'Gravity', type: 'slider', default: -28.0,
                range: [-40, -15, 1] },
            { key: 'friction', label: 'Ground Friction', type: 'slider', default: 0.85,
                range: [0.5, 1, 0.05] },
        ],
        config: {
            gravity: -28.0, terminalVelocity: -40.0,
            groundSnap: true, friction: 0.85,
        },
        prompt: 'I chose Heavy / Tank physics (gravity -28, high friction). Help me make the player feel weighty with slow acceleration, screen shake on landing, and a charge-up for jumps.',
    },
    {
        id: 'phys-water', category: 'physics',
        title: 'Underwater', subtitle: 'Swim controls, buoyancy, currents',
        icon: '🌊', thumbGrad: 'linear-gradient(135deg, #004e92 0%, #00b4d8 100%)',
        tags: ['water', 'swim', 'buoyancy'],
        options: [
            { key: 'buoyancy', label: 'Buoyancy', type: 'slider', default: 0.5,
                range: [0, 1, 0.05] },
            { key: 'dragCoeff', label: 'Water Drag', type: 'slider', default: 0.6,
                range: [0.1, 1, 0.05] },
            { key: 'currentStrength', label: 'Current Strength', type: 'slider', default: 2.0,
                range: [0, 8, 0.5] },
        ],
        config: {
            gravity: -4.0, terminalVelocity: -8.0,
            buoyancy: 0.5, drag: 0.6,
        },
        prompt: 'I chose Underwater physics (low gravity, buoyancy 0.5, drag 0.6). Help me wire swim controls: ReadStick for horizontal, A to swim up, B to dive, and gradual deceleration.',
    },
    {
        id: 'phys-zero-g', category: 'physics',
        title: 'Zero Gravity', subtitle: 'Full 3D free-float movement',
        icon: '✦', thumbGrad: 'linear-gradient(135deg, #0a0a3e 0%, #2a2a6e 100%)',
        tags: ['zero-g', 'space', 'float'],
        options: [
            { key: 'thrustPower', label: 'Thrust Power', type: 'slider', default: 5.0,
                range: [1, 12, 0.5] },
            { key: 'dampening', label: 'Dampening', type: 'slider', default: 0.95,
                range: [0.8, 1, 0.01] },
        ],
        config: {
            gravity: 0, terminalVelocity: -50.0,
            dampening: 0.95,
        },
        prompt: 'I chose Zero Gravity physics. Help me wire 6-axis movement: ReadStick for horizontal thrust, C-up/C-down for vertical, A for forward boost, with gradual dampening so the player drifts.',
    },
];
// ═════════════════════════════════════════════════════════════════════════════
//  SHADING / LIGHTING PRESETS
// ═════════════════════════════════════════════════════════════════════════════
const SHADING_PRESETS = [
    {
        id: 'shade-n64-classic', category: 'shading',
        title: 'N64 Classic', subtitle: 'Authentic point-filtered, vertex-lit',
        icon: '📺', thumbGrad: 'linear-gradient(135deg, #2a2a4a 0%, #4a4a7a 100%)',
        tags: ['retro', 'authentic', 'vertex-lit'],
        options: [
            { key: 'texFilter', label: 'Texture Filter', type: 'select', default: 0,
                choices: ['Point (N64)', '3-Point (N64 Bilinear)', 'Bilinear (Modern)'] },
            { key: 'ditherAlpha', label: 'Dither Alpha', type: 'toggle', default: true },
            { key: 'fogEnabled', label: 'Distance Fog', type: 'toggle', default: true },
        ],
        config: {
            renderPipeline: 'default', texFilter: 'point',
            colorCombiner: '1-cycle', ditherAlpha: true,
            lighting: true, vertexEffect: 'NONE',
        },
        prompt: 'I chose the N64 Classic shading preset — point-filtered textures, vertex lighting, classic fog. Help me tune the color combiner modes for my materials and set up proper environmental mapping.',
    },
    {
        id: 'shade-toon', category: 'shading',
        title: 'Cel / Cartoon', subtitle: 'Discrete shading bands + thick outlines',
        icon: '🎨', thumbGrad: 'linear-gradient(135deg, #e040fb 0%, #ff4081 100%)',
        tags: ['toon', 'cel', 'outlines'],
        options: [
            { key: 'bandCount', label: 'Shade Bands', type: 'slider', default: 3,
                range: [2, 6, 1] },
            { key: 'outlineThick', label: 'Outline Thickness', type: 'slider', default: 2.0,
                range: [0.5, 5, 0.25] },
            { key: 'outlineColor', label: 'Outline Color', type: 'color', default: '#000000' },
            { key: 'tintColor', label: 'Shade Tint', type: 'color', default: '#3322aa' },
        ],
        config: {
            renderPipeline: 'default',
            vertexEffect: 'CELSHADE_COLOR',
            outlineEnabled: true, outlineMode: 0, outlineThickness: 2.0,
            celBands: 3, celTint: [0.2, 0.13, 0.67],
        },
        prompt: 'I chose the Cel / Cartoon shading preset — 3 shade bands with thick black outlines. Help me set up the outline component on my entities and tune the cel shading tint for a cozy cartoon look.',
    },
    {
        id: 'shade-hdr', category: 'shading',
        title: 'HDR Bloom', subtitle: 'High dynamic range with glow post-process',
        icon: '✨', thumbGrad: 'linear-gradient(135deg, #000 0%, #222 50%, #ffd700 100%)',
        tags: ['bloom', 'glow', 'modern'],
        options: [
            { key: 'bloomIntensity', label: 'Bloom Intensity', type: 'slider', default: 0.6,
                range: [0.1, 2, 0.1] },
            { key: 'bloomThreshold', label: 'Bloom Threshold', type: 'slider', default: 0.8,
                range: [0.3, 1, 0.05] },
            { key: 'exposure', label: 'Exposure', type: 'slider', default: 1.0,
                range: [0.3, 3, 0.1] },
        ],
        config: {
            renderPipeline: 'HDRBloom',
            bloomIntensity: 0.6, bloomThreshold: 0.8,
            lighting: true, envColor: [1.0, 0.95, 0.8],
        },
        prompt: 'I chose HDR Bloom shading — intense glow on bright surfaces. Help me set env colors on materials that should glow (lava, crystals, UI elements) and balance the bloom so it doesn\'t wash out.',
    },
    {
        id: 'shade-flat', category: 'shading',
        title: 'Flat / Unlit', subtitle: 'No lighting, pure vertex/texture color',
        icon: '◻', thumbGrad: 'linear-gradient(135deg, #fff 0%, #ddd 100%)',
        tags: ['flat', 'unlit', 'stylized'],
        options: [
            { key: 'texFilter', label: 'Texture Filter', type: 'select', default: 0,
                choices: ['Point', '3-Point', 'Bilinear'] },
        ],
        config: {
            renderPipeline: 'default', lighting: false,
            colorCombiner: '1-cycle', vertexEffect: 'NONE',
        },
        prompt: 'I chose Flat / Unlit shading — no lighting, pure texture and vertex color. Help me set up bold color-keyed materials for a minimalist art style.',
    },
    {
        id: 'shade-fresnel', category: 'shading',
        title: 'Fresnel Glow', subtitle: 'Edge glow effect on all surfaces',
        icon: '💎', thumbGrad: 'linear-gradient(135deg, #0a0a3a 0%, #00d4ff 100%)',
        tags: ['fresnel', 'glow', 'sci-fi'],
        options: [
            { key: 'fresnelColor', label: 'Fresnel Color', type: 'color', default: '#00d4ff' },
            { key: 'fresnelPower', label: 'Fresnel Power', type: 'slider', default: 2.0,
                range: [0.5, 5, 0.25] },
            { key: 'baseLighting', label: 'Base Lighting', type: 'toggle', default: true },
        ],
        config: {
            renderPipeline: 'default', lighting: true,
            fresnel: true, fresnelColor: [0, 0.83, 1.0], fresnelPower: 2.0,
        },
        prompt: 'I chose Fresnel Glow shading — cyan edge glow on all surfaces. Help me set up per-material fresnel with different colors (cyan for player, red for enemies, gold for pickups).',
    },
];
// ═════════════════════════════════════════════════════════════════════════════
//  GAME MODE / GENRE TEMPLATES
// ═════════════════════════════════════════════════════════════════════════════
const GAMEMODE_PRESETS = [
    {
        id: 'gm-platformer-3d', category: 'gamemode',
        title: '3D Platformer', subtitle: 'SM64 / Banjo style collect-a-thon',
        icon: '⭐', thumbGrad: 'linear-gradient(135deg, #9d4edd 0%, #ffd700 100%)',
        tags: ['platformer', '3D', 'collect'],
        options: [
            { key: 'collectibles', label: 'Collectible Types', type: 'slider', default: 3,
                range: [1, 6, 1] },
            { key: 'lives', label: 'Starting Lives', type: 'slider', default: 3,
                range: [1, 9, 1] },
        ],
        config: {
            genre: '3d-platformer',
            includes: ['player-platformer', 'phys-standard', 'world-grasslands', 'shade-n64-classic'],
        },
        prompt: 'I want to make a 3D Platformer (SM64 / Banjo style). Set up: a hub world with 3 star doors, collectible coins/stars/health, checkpoints, lives with a game-over screen, and world transitions.',
    },
    {
        id: 'gm-kart-racer', category: 'gamemode',
        title: 'Kart Racer', subtitle: 'Mario Kart style racing with items',
        icon: '🏁', thumbGrad: 'linear-gradient(135deg, #ff0055 0%, #00d4ff 100%)',
        tags: ['racing', 'kart', 'multiplayer'],
        options: [
            { key: 'racerCount', label: 'AI Racers', type: 'slider', default: 7,
                range: [1, 11, 1] },
            { key: 'laps', label: 'Lap Count', type: 'slider', default: 3,
                range: [1, 7, 1] },
            { key: 'itemsEnabled', label: 'Items', type: 'toggle', default: true },
        ],
        config: {
            genre: 'kart-racer',
            includes: ['player-racer', 'phys-standard', 'world-grasslands', 'shade-n64-classic'],
        },
        prompt: 'I want to make a Kart Racer (Mario Kart style). Set up: a race track with checkpoints, lap counter, AI opponents with rubber-banding, item boxes with shells/boosts/banana, finish line detection, and results screen.',
    },
    {
        id: 'gm-adventure', category: 'gamemode',
        title: 'Action-Adventure', subtitle: 'Zelda-style dungeons + overworld',
        icon: '🗡', thumbGrad: 'linear-gradient(135deg, #2d7d46 0%, #ffd700 100%)',
        tags: ['adventure', 'RPG', 'dungeon'],
        options: [
            { key: 'hearts', label: 'Start Hearts', type: 'slider', default: 3,
                range: [1, 10, 1] },
            { key: 'inventory', label: 'Inventory Size', type: 'slider', default: 8,
                range: [4, 16, 1] },
        ],
        config: {
            genre: 'action-adventure',
            includes: ['player-topdown', 'phys-standard', 'world-grasslands', 'shade-n64-classic'],
        },
        prompt: 'I want to make an Action-Adventure (Zelda style). Set up: an overworld with dungeon entrances, key items to unlock doors, a heart-based health system, sword attack on B, and NPC dialogue triggers.',
    },
    {
        id: 'gm-fps', category: 'gamemode',
        title: 'FPS Arena', subtitle: 'Goldeneye / Perfect Dark multiplayer',
        icon: '🔫', thumbGrad: 'linear-gradient(135deg, #0a2463 0%, #c0392b 100%)',
        tags: ['FPS', 'shooter', 'arena'],
        options: [
            { key: 'fragLimit', label: 'Frag Limit', type: 'slider', default: 10,
                range: [5, 30, 5] },
            { key: 'weaponCount', label: 'Weapon Types', type: 'slider', default: 4,
                range: [2, 8, 1] },
            { key: 'bots', label: 'AI Bots', type: 'slider', default: 3,
                range: [0, 7, 1] },
        ],
        config: {
            genre: 'fps-arena',
            includes: ['player-fps', 'phys-standard', 'world-dungeon', 'shade-n64-classic'],
        },
        prompt: 'I want to make an FPS Arena (Goldeneye style). Set up: weapon pickups with ammo, frag counter, respawn points, AI bots with patrol/chase behavior, and a match timer.',
    },
    {
        id: 'gm-horror', category: 'gamemode',
        title: 'Survival Horror', subtitle: 'Resident Evil style tension',
        icon: '🕯', thumbGrad: 'linear-gradient(135deg, #0a0a0a 0%, #2c0a0a 100%)',
        tags: ['horror', 'survival', 'puzzle'],
        options: [
            { key: 'ammoScarcity', label: 'Ammo Scarcity', type: 'slider', default: 0.7,
                range: [0.1, 1, 0.1] },
            { key: 'jumpScares', label: 'Jump Scares', type: 'toggle', default: true },
        ],
        config: {
            genre: 'survival-horror',
            includes: ['player-topdown', 'phys-standard', 'world-dungeon', 'shade-fresnel'],
        },
        prompt: 'I want to make a Survival Horror game (RE style). Set up: limited ammo, locked doors with key items, dark rooms with flashlight toggle, enemy encounters that trigger on proximity, and tense audio cues.',
    },
    {
        id: 'gm-party', category: 'gamemode',
        title: 'Party / Mini-Games', subtitle: 'Mario Party style mini-game collection',
        icon: '🎉', thumbGrad: 'linear-gradient(135deg, #ff6b35 0%, #39ff14 50%, #00d4ff 100%)',
        tags: ['party', 'minigame', 'multiplayer'],
        options: [
            { key: 'miniGameCount', label: 'Mini-Games', type: 'slider', default: 5,
                range: [3, 12, 1] },
            { key: 'rounds', label: 'Rounds', type: 'slider', default: 10,
                range: [5, 20, 1] },
        ],
        config: {
            genre: 'party',
            includes: ['player-platformer', 'phys-standard', 'world-grasslands', 'shade-toon'],
        },
        prompt: 'I want to make a Party Game (Mario Party style). Set up: a board game hub with selectable mini-games, a turn system, score tracking, and 3 starter mini-games (button mash race, platform survival, coin grab).',
    },
];
// ═════════════════════════════════════════════════════════════════════════════
//  COMBINED LIBRARY
// ═════════════════════════════════════════════════════════════════════════════
export const ALL_PRESETS = [
    ...WORLD_PRESETS,
    ...PLAYER_PRESETS,
    ...ENEMY_PRESETS,
    ...PHYSICS_PRESETS,
    ...SHADING_PRESETS,
    ...GAMEMODE_PRESETS,
];
/** Get all presets for a category. */
export function getPresetsByCategory(cat) {
    return ALL_PRESETS.filter(p => p.category === cat);
}
/** Find a preset by id. */
export function getPresetById(id) {
    return ALL_PRESETS.find(p => p.id === id);
}
/** Get all tags used across all presets (for search/filter). */
export function getAllTags() {
    const tags = new Set();
    for (const p of ALL_PRESETS)
        p.tags.forEach(t => tags.add(t));
    return [...tags].sort();
}
