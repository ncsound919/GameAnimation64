/**
 * desktop/api-server.ts
 * Express API server for the Pyrite64 standalone desktop app.
 *
 * Provides:
 *  - POST /api/chat       → Proxies multi-turn chat to Anthropic API
 *  - POST /api/generate   → Proxies single-shot generation to Anthropic API
 *  - POST /api/generate-agent → Role-specialized agent generation (animation, combat, etc.)
 *  - POST /api/analyze    → Runs SequenceAnalyzer on a biological sequence
 *  - POST /api/mutations  → Runs MutationTracker on ref + query sequences
 *  - POST /api/physics    → Runs PhysicsCalculator (melting temp, etc.)
 *  - POST /api/parse-file → Parses FASTA / FASTQ / PDB file content
 *  - POST /api/key        → Stores the Anthropic API key in memory
 *  - DELETE /api/key       → Clears the stored API key
 *  - GET  /api/key/status → Returns whether an API key is stored
 *  - GET  /api/health     → Health check
 *
 * The server also serves static files from the repository root so the
 * renderer can load vibe-dashboard.html and all its JS/CSS assets.
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import http from 'http';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AnthropicMessage {
  role: string;
  content: string;
}

interface ChatRequestBody {
  prompt: string;
  context: Record<string, unknown>;
  history?: AnthropicMessage[];
}

interface GenerateRequestBody {
  prompt: string;
  context: Record<string, unknown>;
}

interface GenerateAgentRequestBody {
  role: string;
  prompt: string;
  context: Record<string, unknown>;
  systemPrompt?: string;
}

interface AnalyzeRequestBody {
  sequence: string;
}

interface MutationsRequestBody {
  reference: string;
  query: string;
}

interface PhysicsRequestBody {
  sequence: string;
  calculation: 'meltingTemperature' | 'gibbsFreeEnergy' | 'diffusionCoefficient';
}

interface ParseFileRequestBody {
  content: string;
  filename: string;
}

// ─── In-memory state ─────────────────────────────────────────────────────────

let anthropicApiKey = '';

// ─── Server factory ──────────────────────────────────────────────────────────

export function createApiServer(staticRoot: string): { app: express.Application; server: http.Server; getPort: () => number } {
  const app = express();

  // Body parsing
  app.use(express.json({ limit: '10mb' }));

  // Serve static files from project root (html, css, js, data/)
  app.use(express.static(staticRoot, {
    extensions: ['html', 'js', 'css', 'json', 'png', 'jpg', 'gif', 'svg', 'woff2', 'ttf'],
  }));

  // ── Error handler ───────────────────────────────────────────────────────

  function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
    return (req: Request, res: Response, next: NextFunction) => {
      fn(req, res).catch(next);
    };
  }

  // ── Health check ────────────────────────────────────────────────────────

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', hasApiKey: !!anthropicApiKey });
  });

  // ── API Key management ──────────────────────────────────────────────────

  app.post('/api/key', (req: Request, res: Response) => {
    const { key } = req.body as { key?: string };
    if (!key || typeof key !== 'string' || !key.trim()) {
      res.status(400).json({ error: 'Missing or empty API key' });
      return;
    }
    anthropicApiKey = key.trim();
    res.json({ status: 'stored' });
  });

  app.delete('/api/key', (_req: Request, res: Response) => {
    anthropicApiKey = '';
    res.json({ status: 'cleared' });
  });

  app.get('/api/key/status', (_req: Request, res: Response) => {
    res.json({ hasKey: !!anthropicApiKey });
  });

  // ── Anthropic proxy: single-shot generate ───────────────────────────────

  app.post('/api/generate', asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as GenerateRequestBody;
    if (!body.prompt) {
      res.status(400).json({ error: 'Missing prompt' });
      return;
    }
    if (!anthropicApiKey) {
      res.status(401).json({ error: 'No API key configured. Set your Anthropic API key in Settings.' });
      return;
    }

    const rawSystemPrompt = (body as any).systemPrompt;
    const system =
      typeof rawSystemPrompt === 'string' && rawSystemPrompt.trim().length > 0
        ? rawSystemPrompt
        : buildSystemPrompt(body.context);

    const response = await callAnthropic({
      system,
      messages: [{ role: 'user', content: body.prompt }],
      maxTokens: 2048,
    });
    res.json(response);
  }));

  // ── Anthropic proxy: multi-turn chat ────────────────────────────────────

  app.post('/api/chat', asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as ChatRequestBody;
    if (!body.prompt) {
      res.status(400).json({ error: 'Missing prompt' });
      return;
    }
    if (!anthropicApiKey) {
      res.status(401).json({ error: 'No API key configured. Set your Anthropic API key in Settings.' });
      return;
    }

    const messages: AnthropicMessage[] = body.history
      ? [...body.history]
      : [{ role: 'user', content: body.prompt }];

    // Ensure last message is in the list (if history was provided without the latest)
    if (body.history && body.history.length > 0) {
      const last = body.history[body.history.length - 1];
      if (last.content !== body.prompt) {
        messages.push({ role: 'user', content: body.prompt });
      }
    }

    const response = await callAnthropic({
      system: buildChatSystemPrompt(body.context),
      messages,
      maxTokens: 4096,
    });
    res.json(response);
  }));

  // ── Vibe Agent: role-specialized AI generation ──────────────────────────

  app.post('/api/generate-agent', asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as GenerateAgentRequestBody;
    if (!body.prompt) {
      res.status(400).json({ error: 'Missing prompt' });
      return;
    }
    if (!anthropicApiKey) {
      res.status(401).json({ error: 'No API key configured. Set your Anthropic API key in Settings.' });
      return;
    }

    const safeRole =
      typeof body.role === 'string' && body.role.trim().length > 0
        ? body.role
        : 'generic';
    const safeContext =
      body && typeof body.context === 'object' && body.context !== null
        ? body.context
        : {};

    const system =
      typeof body.systemPrompt === 'string' && body.systemPrompt.trim().length > 0
        ? body.systemPrompt
        : buildAgentSystemPrompt(safeRole, safeContext);

    const response = await callAnthropic({
      system,
      messages: [{ role: 'user', content: body.prompt }],
      maxTokens: 4096,
    });

    // Try to extract a JSON NodeGraphConfig patch from the response text
    const text = response.text;
    let patch: unknown = null;

    // Prefer a fenced ```json block if present
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
    let jsonString: string | null = null;

    if (jsonMatch) {
      jsonString = jsonMatch[1];
    } else {
      // Fallback: attempt to extract raw JSON by taking first '{' .. last '}'
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonString = text.slice(firstBrace, lastBrace + 1);
      }
    }

    if (jsonString != null) {
      try {
        patch = JSON.parse(jsonString);
      } catch {
        // not valid JSON — leave patch as null and return raw text
      }
    }

    res.json({ text: response.text, patch, model: response.model });
  }));

  // ── Bio Research: Sequence analysis ─────────────────────────────────────

  app.post('/api/analyze', asyncHandler(async (req: Request, res: Response) => {
    const { sequence } = req.body as AnalyzeRequestBody;
    if (!sequence) {
      res.status(400).json({ error: 'Missing sequence' });
      return;
    }

    // Dynamic import to avoid coupling at module level
    const { SequenceAnalyzer } = await import('../SequenceAnalyzer.js');
    const result = SequenceAnalyzer.analyze(sequence);
    res.json(result);
  }));

  // ── Bio Research: Mutation tracking ─────────────────────────────────────

  app.post('/api/mutations', asyncHandler(async (req: Request, res: Response) => {
    const { reference, query } = req.body as MutationsRequestBody;
    if (!reference || !query) {
      res.status(400).json({ error: 'Missing reference or query sequence' });
      return;
    }

    const { MutationTracker } = await import('../MutationTracker.js');
    const variants = MutationTracker.callVariants(reference, query);
    const report = MutationTracker.report(variants, 'query');
    res.json({ variants, report });
  }));

  // ── Bio Research: Physics calculations ──────────────────────────────────

  app.post('/api/physics', asyncHandler(async (req: Request, res: Response) => {
    const { sequence, calculation } = req.body as PhysicsRequestBody;
    if (!sequence) {
      res.status(400).json({ error: 'Missing sequence' });
      return;
    }

    const { PhysicsCalculator } = await import('../PhysicsCalculator.js');
    let result: unknown;
    switch (calculation) {
      case 'meltingTemperature':
        result = PhysicsCalculator.meltingTemperature(sequence);
        break;
      case 'gibbsFreeEnergy':
        result = PhysicsCalculator.gibbsFreeEnergy(sequence.length * 100, sequence.length * 80);
        break;
      case 'diffusionCoefficient':
        result = PhysicsCalculator.diffusionCoefficient(PhysicsCalculator.stokesRadiusEstimate_m(sequence.length * 110));
        break;
      default:
        result = PhysicsCalculator.meltingTemperature(sequence);
    }
    res.json({ calculation: calculation || 'meltingTemperature', value: result, sequenceLength: sequence.length });
  }));

  // ── Bio Research: File parsing ──────────────────────────────────────────

  app.post('/api/parse-file', asyncHandler(async (req: Request, res: Response) => {
    const { content, filename } = req.body as ParseFileRequestBody;
    if (!content || !filename) {
      res.status(400).json({ error: 'Missing content or filename' });
      return;
    }

    const { BioinformaticsProvider } = await import('../BioinformaticsProvider.js');
    const ext = path.extname(filename).toLowerCase();
    let result: unknown;
    if (['.fasta', '.fa', '.fna', '.ffn', '.faa', '.frn'].includes(ext)) {
      result = BioinformaticsProvider.parseFasta(content);
    } else if (['.fastq', '.fq'].includes(ext)) {
      result = BioinformaticsProvider.parseFastq(content);
    } else if (ext === '.pdb') {
      result = BioinformaticsProvider.parsePdb(content);
    } else {
      res.status(400).json({ error: `Unsupported file type: ${ext}` });
      return;
    }
    res.json(result);
  }));

  // ── Global error handler ────────────────────────────────────────────────

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[API Server Error]', err.message);
    res.status(500).json({ error: err.message });
  });

  // ── Start server on random available port ───────────────────────────────

  const server = http.createServer(app);
  server.listen(0, '127.0.0.1'); // port 0 = OS picks a free port

  const getPort = (): number => {
    const addr = server.address();
    if (addr && typeof addr === 'object') return addr.port;
    return 0;
  };

  return { app, server, getPort };
}

// ─── Anthropic API helper ─────────────────────────────────────────────────────

interface AnthropicCallOptions {
  system: string;
  messages: AnthropicMessage[];
  maxTokens: number;
}

async function callAnthropic(opts: AnthropicCallOptions): Promise<{ text: string; model: string }> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: opts.maxTokens,
      system: opts.system,
      messages: opts.messages,
    }),
  });

  if (!res.ok) {
    const rawBody = await res.text();
    let apiMessage = '';
    try {
      const parsed = JSON.parse(rawBody);
      if (parsed?.error?.message) apiMessage = parsed.error.message;
      else if (parsed?.message) apiMessage = parsed.message;
    } catch {
      // not JSON
    }
    throw new Error(apiMessage || rawBody || `Anthropic API error ${res.status}`);
  }

  const data = await res.json() as {
    model: string;
    content: Array<{ type: string; text?: string }>;
  };
  const text = data.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('');

  return { text, model: data.model };
}

// ─── Prompt builders (mirror VibeNode.ts logic) ──────────────────────────────

function buildSystemPrompt(context: Record<string, unknown>): string {
  const entityName = String(context.entityName ?? 'Entity');
  const nodeTypes = Array.isArray(context.availableNodeTypes) ? context.availableNodeTypes : [];
  return `You are a Pyrite64 Node-Graph assistant. Generate a NodeGraphConfig JSON patch for the entity "${entityName}".
This is a vibe-coding engine for Nintendo 64 homebrew. Users describe gameplay in plain English and you produce node graphs.

AVAILABLE NODE TYPES: ${nodeTypes.join(', ')}

CONSTRAINTS:
- No heap allocations at runtime
- No dynamic strings
- Only valid Pyrite64 node types and connection types
- Output must be serializable to .p64graph format
- N64 hardware: 4MB RDRAM, 64 tri/mesh, 800 verts/frame

Respond with a JSON object: { "nodes": [...], "edges": [...] }`;
}

function buildChatSystemPrompt(context: Record<string, unknown>): string {
  return buildSystemPrompt(context) + `

You may also provide explanations in natural language alongside the JSON patch.
If the user asks a question, answer it. If they describe behavior, generate the node graph.
Wrap any JSON patch in a \`\`\`json code fence.`;
}

function buildAgentSystemPrompt(role: string, context: Record<string, unknown>): string {
  const entityName = String(context.entityName ?? 'Entity');
  const nodeTypes = Array.isArray(context.availableNodeTypes) ? context.availableNodeTypes : [];

  const domainGuidance: Record<string, string> = {
    animation:    'You specialize in skeletal animation, blend trees, state machines, and timeline sequencing.',
    movement:     'You specialize in locomotion, physics response, pathfinding, and input-driven motion.',
    combat:       'You specialize in damage flow, combo chains, parries, boss phases, and hit detection.',
    'ai-behavior':'You specialize in enemy AI, perception cones, patrol/chase/flee state machines, and decision trees.',
    audio:        'You specialize in SFX triggers, adaptive music cues, and spatial audio wiring.',
    scene:        'You specialize in scene transitions, object spawning, lifecycle events, and cutscenes.',
    build:        'You specialize in node graph cleanup, N64 budget optimization, and graph refactoring.',
  };

  const domain = domainGuidance[role] ?? 'You are a general-purpose Pyrite64 Node-Graph assistant.';

  return `You are a Pyrite64 Vibe-Coding agent (role: ${role}). ${domain}
Generate a NodeGraphConfig JSON patch for the entity "${entityName}".

AVAILABLE NODE TYPES: ${nodeTypes.join(', ')}

CONSTRAINTS:
- No heap allocations at runtime
- No dynamic strings
- Only valid Pyrite64 node types
- Output must be serializable to .p64graph format
- N64 hardware: 4MB RDRAM, 64 tri/mesh, 800 verts/frame
- Keep graphs under 20 nodes where possible

Wrap any JSON patch in a \`\`\`json code fence. You may explain your choices briefly.`;
}
