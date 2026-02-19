/**
 * VibeAgent.js
 * Specialized AI agents for the Pyrite64 Vibe Coding Engine.
 *
 * Each agent is an autonomous unit with:
 *  - A domain-specific system prompt tuned for its area of expertise
 *  - An independent Anthropic API call (can run in parallel)
 *  - A task queue for sequential work within the agent
 *  - Status tracking (idle → thinking → done | error)
 *  - Memory: a short rolling context window of past results
 *
 * Available agents:
 *  AnimationAgent    – clip playback, timeline, blend trees, state machines
 *  MovementAgent     – locomotion, physics, pathfinding, input response
 *  AIBehaviorAgent   – enemy AI, perception, patrol/chase/flee, decisions
 *  AudioAgent        – SFX triggers, music cues, spatial audio wiring
 *  SceneAgent        – scene transitions, object spawning, lifecycle events
 *  BuildAgent        – node graph cleanup, N64 budget optimization, refactoring
 *
 * All agents share the same base NodeGraphConfig output contract.
 */
// ─── Base Agent ──────────────────────────────────────────────────────────────
const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';
// Shared N64 constraint footer appended to every agent's system prompt
const N64_CONSTRAINT_FOOTER = `
N64 HARD CONSTRAINTS (non-negotiable):
- No heap allocations. No dynamic strings. No recursion.
- Keep graphs small: 3-15 nodes max. N64 runs scripts at ~3% CPU budget.
- Only flow edges between flow ports; only value edges between value ports.
- Every graph MUST start from an entry-point node.
- Positions are canvas layout only (arbitrary integers).
OUTPUT: Return ONLY a JSON object. No markdown, no explanation. Schema:
{"nodes":[{"id":string,"type":string,"position":[number,number],"data":{}}],"edges":[{"from":string,"fromPort":string,"to":string,"toPort":string}]}`.trim();
export class VibeAgent {
    constructor() {
        this.status = 'idle';
        this.lastTask = null;
        this.lastResult = null;
        // Rolling memory: last N result summaries fed back as context
        this.memory = [];
        this.MEMORY_WINDOW = 3;
        this.statusListeners = [];
    }
    onStatus(cb) {
        this.statusListeners.push(cb);
        return this;
    }
    /** Run the agent on a task. Returns a merged result promise. */
    async run(task) {
        this.lastTask = task;
        this.setStatus('thinking', `Processing: ${task.prompt.slice(0, 60)}…`);
        const t0 = performance.now();
        try {
            const patch = await this.callAPI(task);
            const ms = Math.round(performance.now() - t0);
            // Store summary in memory
            const summary = `[${this.name}] Generated ${patch.nodes.length} nodes for: "${task.prompt.slice(0, 50)}"`;
            this.memory = [...this.memory.slice(-(this.MEMORY_WINDOW - 1)), summary];
            this.setStatus('done', `Done in ${ms}ms — ${patch.nodes.length} nodes`);
            this.lastResult = { agentRole: this.role, agentName: this.name, task, patch, error: null, durationMs: ms };
            return this.lastResult;
        }
        catch (e) {
            const ms = Math.round(performance.now() - t0);
            const msg = e instanceof Error ? e.message : String(e);
            this.setStatus('error', msg);
            this.lastResult = { agentRole: this.role, agentName: this.name, task, patch: null, error: msg, durationMs: ms };
            return this.lastResult;
        }
    }
    /** Reset agent to idle state. */
    reset() {
        this.setStatus('idle', 'Ready');
    }
    // ── Private ───────────────────────────────────────────────────────────────
    async callAPI(task) {
        const apiKey = (typeof globalThis !== 'undefined' && globalThis.process?.env?.ANTHROPIC_API_KEY)
            ? globalThis.process.env.ANTHROPIC_API_KEY
            : undefined;
        const ctx = task.context;
        const systemPrompt = [
            this.buildDomainPrompt(ctx),
            '',
            this.memory.length > 0
                ? `RECENT CONTEXT:\n${this.memory.map(m => '  ' + m).join('\n')}`
                : '',
            '',
            N64_CONSTRAINT_FOOTER,
        ].filter(Boolean).join('\n');
        // Electron IPC path
        if (typeof window !== 'undefined' && window.electronAPI) {
            return window.electronAPI.invoke('vibe:generate-agent', {
                role: this.role,
                prompt: task.prompt,
                context: ctx,
                systemPrompt,
            });
        }
        if (!apiKey)
            throw new Error('ANTHROPIC_API_KEY not set');
        const res = await fetch(ANTHROPIC_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: MODEL,
                max_tokens: 1024,
                system: systemPrompt,
                messages: [{ role: 'user', content: task.prompt }],
            }),
        });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            let msg = '';
            try {
                msg = JSON.parse(body)?.error?.message ?? '';
            }
            catch {
                msg = body;
            }
            throw new Error(`API ${res.status}: ${msg || res.statusText}`);
        }
        const data = await res.json();
        const text = data.content
            .filter((b) => b.type === 'text')
            .map((b) => b.text)
            .join('');
        const json = extractJSON(text);
        if (!json)
            throw new Error(`No JSON in response from ${this.name}`);
        const patch = JSON.parse(json);
        if (!Array.isArray(patch.nodes) || !Array.isArray(patch.edges)) {
            throw new Error(`Invalid patch shape from ${this.name}`);
        }
        return patch;
    }
    setStatus(status, message) {
        this.status = status;
        for (const cb of this.statusListeners) {
            cb({ role: this.role, status, message });
        }
    }
}
// ─── Specialized Agents ───────────────────────────────────────────────────────
/** Handles animation clip playback, blend trees, and state-machine-driven anims */
export class AnimationAgent extends VibeAgent {
    constructor() {
        super(...arguments);
        this.role = 'animation';
        this.name = 'AnimationAgent';
        this.color = '#e040fb';
        this.icon = '▶';
    }
    buildDomainPrompt(ctx) {
        const anims = ctx.animations.join(', ') || 'none known';
        return `You are the ANIMATION specialist for Pyrite64 (N64 game engine).
Your job: generate node graph logic specifically for animation clip control.
Entity: "${ctx.entityName}". Available clips: ${anims}.

ANIMATION NODE TYPES you may use:
  PlayAnim, StopAnim, SetAnimSpeed, SetAnimBlend, WaitAnimEnd,
  OnTick, OnStart, OnAnimEnd, OnCollide, Branch, Wait, Repeat, Sequence

RULES:
- Prefer blend transitions (SetAnimBlend) over hard cuts when transitioning clips.
- Use WaitAnimEnd before sequential clips to prevent overlap.
- Loop animations (walk/run/idle) should have loop:true in data.
- Action animations (attack/jump/die) should have loop:false.
- Keep blend factors in 0.0–1.0 range (N64 fixed-point).
Entity context: ${ctx.entityName} in scene with [${ctx.sceneEntities.join(', ')}].`;
    }
}
/** Handles locomotion, physics responses, and stick/button-driven movement */
export class MovementAgent extends VibeAgent {
    constructor() {
        super(...arguments);
        this.role = 'movement';
        this.name = 'MovementAgent';
        this.color = '#00d4ff';
        this.icon = '↕';
    }
    buildDomainPrompt(ctx) {
        return `You are the MOVEMENT specialist for Pyrite64 (N64 game engine).
Your job: generate node graph logic for entity locomotion and physics.
Entity: "${ctx.entityName}".

MOVEMENT NODE TYPES you may use:
  MoveToward, SetVelocity, SetPosition, ReadStick,
  OnTick, OnStart, OnButtonPress, OnButtonHeld, OnButtonRelease,
  Branch, Wait, Repeat, GetDistance, MathOp, Value, Compare

RULES:
- Use ReadStick for analog movement (normalize output vector).
- Clamp velocity values to N64 fixed-point range (-127..127 per axis).
- For "patrol" patterns, use MoveToward + WaitAnimEnd/Wait + Repeat forever.
- For "jump", apply positive Y velocity then gravity (negative Y) after delay.
- Prefer SetVelocity over SetPosition for physics-driven movement.
Scene entities: [${ctx.sceneEntities.join(', ')}].`;
    }
}
/** Handles enemy AI: perception, decision trees, patrol/chase/flee state machines */
export class AIBehaviorAgent extends VibeAgent {
    constructor() {
        super(...arguments);
        this.role = 'ai-behavior';
        this.name = 'AIBehaviorAgent';
        this.color = '#ff6b35';
        this.icon = '⚙';
    }
    buildDomainPrompt(ctx) {
        return `You are the AI BEHAVIOR specialist for Pyrite64 (N64 game engine).
Your job: generate node graph logic for enemy/NPC decision making and behavior trees.
Entity: "${ctx.entityName}".

AI NODE TYPES you may use:
  OnTick, OnCollide, OnTimer, StateMachine, SetState, GetState,
  Branch, Sequence, Repeat, Wait,
  MoveToward, SetVelocity, GetDistance, GetHealth,
  SetVisible, Spawn, Destroy, Func, Compare, CompBool, MathOp, Value

RULES:
- For multi-state behavior, use StateMachine + SetState for transitions.
- Perception checks (GetDistance < threshold) drive state changes.
- Use OnTimer for periodic checks to reduce OnTick overhead.
- State 0 = IDLE, State 1 = PATROL, State 2 = CHASE is a good default.
- Health thresholds can drive "flee" behavior (GetHealth → Compare → SetState).
Scene entities: [${ctx.sceneEntities.join(', ')}].`;
    }
}
/** Handles sound/music triggers, spatial audio queuing, and reactive audio */
export class AudioAgent extends VibeAgent {
    constructor() {
        super(...arguments);
        this.role = 'audio';
        this.name = 'AudioAgent';
        this.color = '#39ff14';
        this.icon = '♪';
    }
    buildDomainPrompt(ctx) {
        const sounds = ctx.sounds.join(', ') || 'none known';
        return `You are the AUDIO specialist for Pyrite64 (N64 game engine).
Your job: generate node graph logic for sound effect and music triggering.
Entity: "${ctx.entityName}". Available sounds: ${sounds}.

AUDIO NODE TYPES you may use:
  PlaySound, OnStart, OnTick, OnCollide, OnTimer, OnAnimEnd,
  OnButtonPress, Branch, Sequence, Wait, Repeat,
  GetDistance, Compare, SetVisible, Destroy

RULES:
- Use OnAnimEnd to sync SFX to animation events (footsteps, impacts).
- Use GetDistance + Compare for proximity-based audio triggers.
- Avoid playing the same sound every frame — use a state flag or timer.
- PlaySound nodes have sound id in data.sound — use only from available list.
- BGM on OnStart should be looped (if supported) or re-triggered via OnTimer.`;
    }
}
/** Handles scene transitions, object lifecycle, spawn waves, and global events */
export class SceneAgent extends VibeAgent {
    constructor() {
        super(...arguments);
        this.role = 'scene';
        this.name = 'SceneAgent';
        this.color = '#ffd700';
        this.icon = '✦';
    }
    buildDomainPrompt(ctx) {
        return `You are the SCENE MANAGEMENT specialist for Pyrite64 (N64 game engine).
Your job: generate node graph logic for scene-level events and object lifecycle.
Entity: "${ctx.entityName}".

SCENE NODE TYPES you may use:
  OnStart, OnTick, OnCollide, OnTimer, OnAnimEnd,
  Spawn, Destroy, SetVisible, SceneLoad,
  Wait, Repeat, Sequence, Branch,
  AddScore, GetScore, SetHealth, GetHealth,
  Compare, Value

RULES:
- Scene transitions (SceneLoad) should always have a Wait before them for effect.
- Spawn waves use Repeat + Spawn + Wait for staggered spawning.
- Clean up spawned objects with Destroy + OnTimer to avoid memory limits.
- Score pickups: OnCollide → AddScore → PlaySound → Destroy (this entity).
Scene entities: [${ctx.sceneEntities.join(', ')}].`;
    }
}
/** Analyzes and refactors existing node graphs for N64 budget compliance */
export class BuildAgent extends VibeAgent {
    constructor() {
        super(...arguments);
        this.role = 'build';
        this.name = 'BuildAgent';
        this.color = '#90caf9';
        this.icon = '⬡';
    }
    buildDomainPrompt(ctx) {
        return `You are the BUILD OPTIMIZER for Pyrite64 (N64 game engine).
Your job: generate minimal, performance-optimal node graphs that stay within N64 budget.
Entity: "${ctx.entityName}".

OPTIMIZATION RULES:
- Never use OnTick for logic that can be event-driven (use OnCollide, OnTimer, OnButtonPress).
- Replace Sequence chains with Repeat+Wait where possible.
- Prefer GetDistance+Compare over per-frame position checks.
- Avoid chained PlayAnim without WaitAnimEnd (causes frame waste).
- Merge multiple SetVelocity calls into one.
- Target maximum 8 nodes per entry point chain.
ALL node types are available. The user's request is an optimization goal.`;
    }
}
// ─── Agent factory ────────────────────────────────────────────────────────────
export function createAllAgents() {
    return {
        'animation': new AnimationAgent(),
        'movement': new MovementAgent(),
        'ai-behavior': new AIBehaviorAgent(),
        'audio': new AudioAgent(),
        'scene': new SceneAgent(),
        'build': new BuildAgent(),
    };
}
// ─── Helpers ─────────────────────────────────────────────────────────────────
function extractJSON(text) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start)
        return null;
    return text.slice(start, end + 1);
}
