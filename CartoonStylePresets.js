/**
 * CartoonStylePresets.js
 * Named cartoon style configurations for Pyrite64's cartoon render system.
 *
 * Each preset configures the CartoonPass shader uniforms to achieve a
 * distinct visual aesthetic.  Presets can be selected in the viewport
 * mode dropdown, the VibePresets shading tab, or via the vibe chat.
 *
 * All styles are implemented with open-source Three.js shaders —
 * no proprietary tools or paid plugins required.
 */

// ─── Preset definitions ───────────────────────────────────────────────────────

export const CARTOON_STYLE_PRESETS = [
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
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Look up a preset by id.  Returns `undefined` if not found. */
export function getCartoonStyle(id) {
  for (let i = 0; i < CARTOON_STYLE_PRESETS.length; i++) {
    if (CARTOON_STYLE_PRESETS[i].id === id) return CARTOON_STYLE_PRESETS[i];
  }
  return undefined;
}

/** Get the default style (classic cel-shade). */
export function getDefaultCartoonStyle() {
  return CARTOON_STYLE_PRESETS[0];
}

/** List all available style ids. */
export function listCartoonStyleIds() {
  const ids = [];
  for (let i = 0; i < CARTOON_STYLE_PRESETS.length; i++) {
    ids.push(CARTOON_STYLE_PRESETS[i].id);
  }
  return ids;
}
