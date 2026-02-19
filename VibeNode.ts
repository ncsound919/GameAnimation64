/**
 * VibeNode.ts
 * AI-assisted scripting node for Pyrite64's Node-Graph editor.
 *
 * The user types natural language into this node. On confirm,
 * it calls the Anthropic API (via Electron IPC) and receives
 * a NodeGraphConfig JSON patch which gets inserted into the graph.
 *
 * Constraints enforced by the system prompt:
 *  - No heap allocations at runtime
 *  - No dynamic strings
 *  - Only valid Pyrite64 node types and connection types
 *  - Output must be serializable to the existing .p64graph format
 */

// ─── Types (subset of Pyrite64 Node-Graph format) ────────────────────────────

export interface NodeGraphNode {
  id:       string;
  type:     string;           // e.g. "OnTick", "MoveToward", "PlayAnim", "Branch"
  position: [number, number]; // canvas position
  data:     Record<string, unknown>;
}

export interface NodeGraphEdge {
  from:     string;  // node id
  fromPort: string;
  to:       string;
  toPort:   string;
}

export interface NodeGraphConfig {
  nodes: NodeGraphNode[];
  edges: NodeGraphEdge[];
}

// ─── IPC channel names (must match main process handlers) ────────────────────

export const VIBE_IPC = {
  GENERATE: 'vibe:generate',
  RESULT:   'vibe:result',
  ERROR:    'vibe:error',
} as const;

// ─── VibeNode ─────────────────────────────────────────────────────────────────

export interface VibeNodeOptions {
  /** Callback fired when the API returns a valid NodeGraphConfig patch. */
  onResult: (patch: NodeGraphConfig) => void;
  /** Callback fired on error. */
  onError:  (msg: string) => void;
}

export class VibeNode {
  private opts: VibeNodeOptions;

  constructor(opts: VibeNodeOptions) {
    this.opts = opts;
  }

  /**
   * Submit a natural-language prompt to the Anthropic API.
   * Returns immediately; result is delivered via the onResult callback.
   *
   * @param prompt  Plain English description of desired behavior
   * @param context Current scene context (node types available, entity names, etc.)
   */
  async generate(prompt: string, context: VibeContext): Promise<void> {
    // In Electron renderer, send via IPC to main process which holds the API key
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      (window as any).electronAPI.invoke(VIBE_IPC.GENERATE, { prompt, context })
        .then((result: NodeGraphConfig) => this.opts.onResult(result))
        .catch((err: Error) => this.opts.onError(err.message));
    } else {
      // Dev fallback: direct API call (requires ANTHROPIC_API_KEY in env)
      await this.directGenerate(prompt, context);
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async directGenerate(prompt: string, context: VibeContext): Promise<void> {
    const systemPrompt = buildSystemPrompt(context);
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method:  'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body:    JSON.stringify({
          model:      'claude-sonnet-4-6',
          max_tokens: 2048,
          system:     systemPrompt,
          messages:   [{ role: 'user', content: prompt }],
        }),
      });

      if (!res.ok) {
        // Attempt to extract a useful error message from the response body.
        const rawBody = await res.text();
        let apiMessage = '';
        try {
          const parsed = JSON.parse(rawBody);
          // Many APIs use an { error: { message } } or { message } shape for errors.
          if (parsed && typeof parsed === 'object') {
            if (parsed.error && typeof parsed.error.message === 'string') {
              apiMessage = parsed.error.message;
            } else if (typeof parsed.message === 'string') {
              apiMessage = parsed.message;
            }
          }
        } catch {
          // Body was not JSON; fall back to raw text.
        }

        const base = `Anthropic API request failed with status ${res.status}`;
        const detail = apiMessage || rawBody || res.statusText;
        throw new Error(detail ? `${base}: ${detail}` : base);
      }

      const data = await res.json();
      const text = data.content
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('');

      const json = extractJSON(text);
      if (!json) throw new Error('No valid JSON in response');

      const patch = JSON.parse(json) as NodeGraphConfig;
      validatePatch(patch);  // throws on invalid
      this.opts.onResult(patch);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      this.opts.onError(message);
    }
  }
}

// ─── Context type ─────────────────────────────────────────────────────────────

export interface VibeContext {
  /** Entity this node graph belongs to */
  entityName:       string;
  /** Available node types in the current Pyrite64 build */
  availableNodeTypes: string[];
  /** Names of other entities in the scene */
  sceneEntities:    string[];
  /** Names of animation clips on this entity */
  animations:       string[];
  /** Audio clip ids */
  sounds:           string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sanitize a string to prevent prompt injection attacks.
 * Removes newlines and certain control characters that could be used
 * to inject additional instructions into the system prompt.
 */
function sanitize(str: string): string {
  return str
    .replace(/[\r\n]/g, ' ')  // Replace newlines with spaces
    .replace(/[^\x20-\x7E]/g, '')  // Remove non-printable characters
    .trim();
}

/**
 * Sanitize an array of strings for safe inclusion in prompts.
 */
function sanitizeArray(arr: string[]): string[] {
  return arr.map(sanitize).filter(s => s.length > 0);
}

function buildSystemPrompt(ctx: VibeContext): string {
  // Sanitize all user-provided context data to prevent prompt injection
  const entityName = sanitize(ctx.entityName);
  const nodeTypes = sanitizeArray(ctx.availableNodeTypes);
  const animations = sanitizeArray(ctx.animations);
  const sounds = sanitizeArray(ctx.sounds);
  const entities = sanitizeArray(ctx.sceneEntities);
  
  return `You are a Pyrite64 Node-Graph assistant. Generate a NodeGraphConfig JSON patch for the entity "${entityName}".

RULES (non-negotiable — this runs on N64 hardware):
- Only use these node types: ${nodeTypes.join(', ')}
- No heap allocations. No dynamic strings. No recursion.
- Animation names must be one of: ${animations.join(', ') || 'none'}
- Sound ids must be one of: ${sounds.join(', ') || 'none'}
- Scene entities: ${entities.join(', ') || 'none'}
- Position values are canvas coordinates (arbitrary integers).

OUTPUT: Respond ONLY with a single JSON object. No markdown. No explanation. Schema:
{
  "nodes": [{ "id": string, "type": string, "position": [number, number], "data": {} }],
  "edges": [{ "from": string, "fromPort": string, "to": string, "toPort": string }]
}`.trim();
}

function extractJSON(text: string): string | null {
  const start = text.indexOf('{');
  const end   = text.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  return text.slice(start, end + 1);
}

function validatePatch(patch: NodeGraphConfig): void {
  if (!Array.isArray(patch.nodes)) throw new Error('patch.nodes must be an array');
  if (!Array.isArray(patch.edges)) throw new Error('patch.edges must be an array');
  for (const node of patch.nodes) {
    if (!node.id || !node.type) throw new Error(`Invalid node: ${JSON.stringify(node)}`);
  }
}
