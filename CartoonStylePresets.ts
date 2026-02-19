/**
 * CartoonStylePresets.ts
 * Named cartoon style configurations for Pyrite64's cartoon render system.
 *
 * Each preset configures the CartoonPass shader uniforms to achieve a
 * distinct visual aesthetic.  Presets can be selected in the viewport
 * mode dropdown, the VibePresets shading tab, or via the vibe chat.
 *
 * All styles are implemented with open-source Three.js shaders —
 * no proprietary tools or paid plugins required.
 */

// ─── Cartoon style identifier ─────────────────────────────────────────────────

export type CartoonStyleId =
  | 'classic-cel'
  | 'anime'
  | 'comic-book'
  | 'watercolor'
  | 'retro';

// ─── Cartoon style configuration ──────────────────────────────────────────────

export interface CartoonStyleConfig {
  /** Unique style identifier. */
  id: CartoonStyleId;
  /** Human-readable label. */
  label: string;
  /** Short description. */
  description: string;
  /** Icon for UI display. */
  icon: string;

  // ── Cel-shade parameters ──
  /** Number of discrete shade bands (2–8). */
  bands: number;
  /** Brightness curve exponent — <1 brightens shadows, >1 darkens them. */
  bandBias: number;

  // ── Outline parameters ──
  /** Outline detection strength (0 = none, 1 = heavy). */
  outlineStr: number;
  /** Outline color RGB [0–1]. */
  outlineColor: [number, number, number];

  // ── Halftone / dot screen ──
  /** Halftone dot strength (0 = disabled). */
  halftoneStr: number;
  /** Halftone dot scale (pixels per dot). */
  halftoneScale: number;

  // ── Hatching / cross-hatch ──
  /** Hatching strength in shadow regions (0 = disabled). */
  hatchStr: number;
  /** Hatching line density. */
  hatchDensity: number;

  // ── Rim / fresnel highlight ──
  /** Rim light strength (0 = disabled). */
  rimStr: number;
  /** Rim light color RGB [0–1]. */
  rimColor: [number, number, number];

  // ── Color grading ──
  /** Saturation multiplier (1 = unchanged, <1 desaturated, >1 vivid). */
  saturation: number;
  /** Warm/cool shift (-1 cool … 0 neutral … +1 warm). */
  warmth: number;
  /** Paper/noise texture strength for watercolor effect (0 = disabled). */
  paperStr: number;
}

// ─── Preset definitions ───────────────────────────────────────────────────────

export const CARTOON_STYLE_PRESETS: readonly CartoonStyleConfig[] = [
  {
    id:          'classic-cel',
    label:       'Classic Cel-Shade',
    description: 'Clean flat color bands with crisp black outlines — the standard cartoon look.',
    icon:        '🎨',
    bands:       4,
    bandBias:    1.0,
    outlineStr:  0.8,
    outlineColor: [0, 0, 0],
    halftoneStr:  0,
    halftoneScale: 4.0,
    hatchStr:     0,
    hatchDensity: 60,
    rimStr:       0,
    rimColor:     [1, 1, 1],
    saturation:   1.0,
    warmth:       0,
    paperStr:     0,
  },
  {
    id:          'anime',
    label:       'Anime',
    description: 'Soft gradient bands with rim lighting and vivid colors — anime / manga inspired.',
    icon:        '⛩',
    bands:       3,
    bandBias:    0.7,
    outlineStr:  0.5,
    outlineColor: [0.1, 0.05, 0.15],
    halftoneStr:  0,
    halftoneScale: 4.0,
    hatchStr:     0,
    hatchDensity: 60,
    rimStr:       0.6,
    rimColor:     [0.8, 0.85, 1.0],
    saturation:   1.3,
    warmth:       -0.1,
    paperStr:     0,
  },
  {
    id:          'comic-book',
    label:       'Comic Book',
    description: 'Bold outlines with halftone dot shading — classic comic / pop-art aesthetic.',
    icon:        '💥',
    bands:       3,
    bandBias:    1.2,
    outlineStr:  1.0,
    outlineColor: [0, 0, 0],
    halftoneStr:  0.7,
    halftoneScale: 3.0,
    hatchStr:     0,
    hatchDensity: 60,
    rimStr:       0,
    rimColor:     [1, 1, 1],
    saturation:   1.4,
    warmth:       0.05,
    paperStr:     0,
  },
  {
    id:          'watercolor',
    label:       'Watercolor',
    description: 'Soft edges with paper texture and desaturated palette — painterly illustration look.',
    icon:        '🖌',
    bands:       6,
    bandBias:    0.8,
    outlineStr:  0.3,
    outlineColor: [0.2, 0.15, 0.1],
    halftoneStr:  0,
    halftoneScale: 4.0,
    hatchStr:     0,
    hatchDensity: 60,
    rimStr:       0,
    rimColor:     [1, 1, 1],
    saturation:   0.75,
    warmth:       0.15,
    paperStr:     0.5,
  },
  {
    id:          'retro',
    label:       'Retro Cartoon',
    description: 'Warm tones with cross-hatch shadows and film grain — vintage animation feel.',
    icon:        '📺',
    bands:       4,
    bandBias:    1.1,
    outlineStr:  0.7,
    outlineColor: [0.15, 0.08, 0.0],
    halftoneStr:  0,
    halftoneScale: 4.0,
    hatchStr:     0.5,
    hatchDensity: 80,
    rimStr:       0,
    rimColor:     [1, 1, 1],
    saturation:   0.9,
    warmth:       0.3,
    paperStr:     0.25,
  },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Look up a preset by id.  Returns `undefined` if not found. */
export function getCartoonStyle(id: CartoonStyleId): CartoonStyleConfig | undefined {
  for (let i = 0; i < CARTOON_STYLE_PRESETS.length; i++) {
    if (CARTOON_STYLE_PRESETS[i].id === id) return CARTOON_STYLE_PRESETS[i];
  }
  return undefined;
}

/** Get the default style (classic cel-shade). */
export function getDefaultCartoonStyle(): CartoonStyleConfig {
  return CARTOON_STYLE_PRESETS[0];
}

/** List all available style ids. */
export function listCartoonStyleIds(): CartoonStyleId[] {
  const ids: CartoonStyleId[] = [];
  for (let i = 0; i < CARTOON_STYLE_PRESETS.length; i++) {
    ids.push(CARTOON_STYLE_PRESETS[i].id);
  }
  return ids;
}
