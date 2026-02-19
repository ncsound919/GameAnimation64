/**
 * palette_reduce.c
 * Pyrite64 — N64 Palette Quantization Module (Implementation)
 *
 * @copyright 2025 - Max Bebök
 * @license MIT
 *
 * See palette_reduce.h for technique description and API.
 */

#include "renderer/palette_reduce.h"

// ─── Style configurations ─────────────────────────────────────────────────────

// Saturation: 256 = 1.0x, 332 = 1.3x, 358 = 1.4x, 192 = 0.75x, 230 = 0.9x
// Warmth:     0 = neutral, +77 ≈ +0.3, -26 ≈ -0.1, +13 ≈ +0.05, +38 ≈ +0.15

static const PaletteStyleConf STYLE_TABLE[PALETTE_STYLE_COUNT] = {
  [PALETTE_STYLE_CLASSIC_CEL] = { .saturation = 256, .warmth =   0, .bands = 4 },
  [PALETTE_STYLE_ANIME]       = { .saturation = 332, .warmth = -26, .bands = 3 },
  [PALETTE_STYLE_COMIC_BOOK]  = { .saturation = 358, .warmth =  13, .bands = 3 },
  [PALETTE_STYLE_WATERCOLOR]  = { .saturation = 192, .warmth =  38, .bands = 6 },
  [PALETTE_STYLE_RETRO]       = { .saturation = 230, .warmth =  77, .bands = 4 },
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Clamp an integer to 0–255. */
static inline uint8_t clamp8(int v) {
  if (v < 0) return 0;
  if (v > 255) return 255;
  return (uint8_t)v;
}

/** Quantize a single 0–255 channel value to N bands. */
static inline uint8_t quantize_channel(uint8_t val, uint8_t bands) {
  if (bands < 2) bands = 2;
  if (bands > 8) bands = 8;
  /* Map 0–255 evenly to 0..(bands-1), then back to 0–255.
   * Using (val * (bands-1) + 127) / 255 for consistent rounding. */
  uint32_t idx = ((uint32_t)val * (bands - 1) + 127) / 255;
  if (idx >= bands) idx = bands - 1;
  return (uint8_t)((idx * 255) / (bands - 1));
}

// ─── Public API ───────────────────────────────────────────────────────────────

color_t palette_quantize_color(color_t c, uint8_t bands) {
  color_t out;
  out.r = quantize_channel(c.r, bands);
  out.g = quantize_channel(c.g, bands);
  out.b = quantize_channel(c.b, bands);
  out.a = c.a;  /* preserve alpha */
  return out;
}

void palette_quantize_verts(T3DModel *model, uint8_t bands) {
  assertf(model != NULL, "palette_quantize_verts: model is NULL");

  for (uint32_t oi = 0; oi < model->numObjects; oi++) {
    T3DObject *obj = &model->objects[oi];
    for (uint32_t pi = 0; pi < obj->numParts; pi++) {
      T3DObjectPart *part = &obj->parts[pi];

      uint32_t vertCount = part->numVertices;
      if (vertCount == 0 || !part->vert) continue;

      uint32_t pairCount = (vertCount + 1) / 2;
      for (uint32_t v = 0; v < pairCount; v++) {
        T3DVertPacked *vp = &part->vert[v];

        /* Vertex A color */
        vp->rgbaA[0] = quantize_channel(vp->rgbaA[0], bands);
        vp->rgbaA[1] = quantize_channel(vp->rgbaA[1], bands);
        vp->rgbaA[2] = quantize_channel(vp->rgbaA[2], bands);

        /* Vertex B color (if pair is complete) */
        if (v * 2 + 1 < vertCount) {
          vp->rgbaB[0] = quantize_channel(vp->rgbaB[0], bands);
          vp->rgbaB[1] = quantize_channel(vp->rgbaB[1], bands);
          vp->rgbaB[2] = quantize_channel(vp->rgbaB[2], bands);
        }
      }

      /* Flush data cache so RSP reads updated vertex colors */
      data_cache_hit_writeback(part->vert, pairCount * sizeof(T3DVertPacked));
    }
  }
}

color_t palette_remap_to_style(color_t c, PaletteStyle style) {
  assertf(style < PALETTE_STYLE_COUNT, "palette_remap_to_style: invalid style %d", style);

  const PaletteStyleConf *conf = &STYLE_TABLE[style];

  /* 1. Quantize to bands */
  color_t q = palette_quantize_color(c, conf->bands);

  /* 2. Compute luminance (BT.601 approximation in integer: 77R + 150G + 29B) >> 8 */
  int luma = (77 * q.r + 150 * q.g + 29 * q.b) >> 8;

  /* 3. Saturation adjustment: lerp each channel toward/away from luma.
   *    new = luma + (channel - luma) * saturation / 256 */
  int dr = (((int)q.r - luma) * conf->saturation) >> 8;
  int dg = (((int)q.g - luma) * conf->saturation) >> 8;
  int db = (((int)q.b - luma) * conf->saturation) >> 8;

  int r = luma + dr;
  int g = luma + dg;
  int b = luma + db;

  /* 4. Warmth shift: boost red, reduce blue, slight green boost.
   *    warmth is signed 8.8 fixed-point.
   *    Scale factors: 15/256 ≈ 0.06 per unit (R/B), 5/256 ≈ 0.02 per unit (G).
   *    At max warmth (+0.3 = 77), this gives R += ~4.5, B -= ~4.5, G += ~1.5 */
  r += (conf->warmth * 15) >> 8;
  b -= (conf->warmth * 15) >> 8;
  g += (conf->warmth * 5) >> 8;

  color_t out;
  out.r = clamp8(r);
  out.g = clamp8(g);
  out.b = clamp8(b);
  out.a = q.a;
  return out;
}

const PaletteStyleConf* palette_get_style_conf(PaletteStyle style) {
  if (style >= PALETTE_STYLE_COUNT) return &STYLE_TABLE[PALETTE_STYLE_CLASSIC_CEL];
  return &STYLE_TABLE[style];
}
