/**
 * palette_reduce.h
 * Pyrite64 — N64 Palette Quantization Module
 *
 * @copyright 2025 - Max Bebök
 * @license MIT
 *
 * Quantizes vertex colors to discrete bands for
 * cartoon rendering on N64 hardware.
 *
 * Technique:
 *   N64 vertex colors are 8-bit per channel (RGBA).  For cartoon styles
 *   we reduce the effective palette by snapping each channel to the nearest
 *   band.  This produces the flat-color look associated with cel-shading
 *   and can be combined with the cel_shader combiner and outline pass
 *   for a complete cartoon pipeline.
 *
 *   Quantization is performed at asset load time (baked into vertex colors)
 *   so there is zero runtime cost.
 *
 * Usage:
 *   1. palette_quantize_color()   — snap a single color to N bands
 *   2. palette_quantize_verts()   — batch-process a T3DModel's vertex colors
 *   3. palette_remap_to_style()   — remap quantized colors through a style LUT
 */

#pragma once

#include <stdint.h>
#include <stdbool.h>
#include <libdragon.h>
#include <t3d/t3d.h>
#include <t3d/t3dmodel.h>

#ifdef __cplusplus
extern "C" {
#endif

// ─── Style presets ────────────────────────────────────────────────────────────

/** Cartoon style identifiers matching the editor's CartoonStylePresets. */
typedef enum {
  PALETTE_STYLE_CLASSIC_CEL = 0,
  PALETTE_STYLE_ANIME       = 1,
  PALETTE_STYLE_COMIC_BOOK  = 2,
  PALETTE_STYLE_WATERCOLOR  = 3,
  PALETTE_STYLE_RETRO       = 4,
  PALETTE_STYLE_COUNT
} PaletteStyle;

/** Per-style color remap configuration. */
typedef struct {
  /** Saturation multiplier (fixed-point 8.8: 256 = 1.0). */
  uint16_t saturation;
  /** Warmth shift applied to R/B channels (signed 8.8). */
  int16_t warmth;
  /** Number of quantization bands per channel (2–8). */
  uint8_t bands;
} PaletteStyleConf;

// ─── API ──────────────────────────────────────────────────────────────────────

/**
 * Quantize a single color_t to N discrete bands per channel.
 *
 * @param c     Input color (RGBA 0–255)
 * @param bands Number of quantization steps per channel (2–8)
 * @return      Quantized color (alpha preserved)
 */
color_t palette_quantize_color(color_t c, uint8_t bands);

/**
 * Batch-quantize all vertex colors in a T3DModel.
 * Modifies vertex data in-place.  Call once at load time.
 *
 * @param model  Model to process (modified in place)
 * @param bands  Bands per channel (2–8)
 */
void palette_quantize_verts(T3DModel *model, uint8_t bands);

/**
 * Apply a cartoon style remap to a color.
 * Performs quantization + saturation + warmth shift.
 *
 * @param c     Input color
 * @param style Style preset identifier
 * @return      Remapped color
 */
color_t palette_remap_to_style(color_t c, PaletteStyle style);

/**
 * Get the configuration for a palette style.
 *
 * @param style Style preset identifier
 * @return      Pointer to the style configuration (static, do not free)
 */
const PaletteStyleConf* palette_get_style_conf(PaletteStyle style);

#ifdef __cplusplus
}
#endif
