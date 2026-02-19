/**
 * CartoonPass.ts
 * Post-processing pass that applies cartoon / cel-shade aesthetics.
 *
 * Composited in EffectComposer after the main RenderPass.
 * Mimics what the N64 C cartoon module does via RDP tricks:
 *  - Discrete shade banding
 *  - Hard inked outline edges
 *
 * Extended to support multiple cartoon styles via CartoonStylePresets:
 *  - Classic Cel-Shade:  flat bands + crisp outlines
 *  - Anime:              soft bands + rim lighting + vivid colors
 *  - Comic Book:         bold outlines + halftone dot shading
 *  - Watercolor:         soft edges + paper texture + desaturated palette
 *  - Retro Cartoon:      warm tones + cross-hatch shadows
 *
 * Uses Three.js ShaderPass with a custom GLSL shader.
 * All effects are implemented with open-source GLSL — no proprietary tools.
 */

import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass';
import { type CartoonStyleConfig, getDefaultCartoonStyle } from './CartoonStylePresets.js';

// ─── Cartoon shader GLSL ──────────────────────────────────────────────────────

const CartoonShader = {
  uniforms: {
    tDiffuse:      { value: null as THREE.Texture | null },
    tDepth:        { value: null as THREE.Texture | null },
    resolution:    { value: new THREE.Vector2(1, 1) },

    // Cel-shade
    bands:         { value: 4.0 },
    bandBias:      { value: 1.0 },

    // Outline
    outlineStr:    { value: 0.8 },
    outlineColor:  { value: new THREE.Vector3(0, 0, 0) },

    // Halftone
    halftoneStr:   { value: 0.0 },
    halftoneScale: { value: 4.0 },

    // Hatching
    hatchStr:      { value: 0.0 },
    hatchDensity:  { value: 60.0 },

    // Rim light
    rimStr:        { value: 0.0 },
    rimColor:      { value: new THREE.Vector3(1, 1, 1) },

    // Color grading
    saturation:    { value: 1.0 },
    warmth:        { value: 0.0 },
    paperStr:      { value: 0.0 },
  },

  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform vec2      resolution;

    // Cel-shade
    uniform float bands;
    uniform float bandBias;

    // Outline
    uniform float outlineStr;
    uniform vec3  outlineColor;

    // Halftone
    uniform float halftoneStr;
    uniform float halftoneScale;

    // Hatching
    uniform float hatchStr;
    uniform float hatchDensity;

    // Rim light
    uniform float rimStr;
    uniform vec3  rimColor;

    // Color grading
    uniform float saturation;
    uniform float warmth;
    uniform float paperStr;

    varying vec2 vUv;

    // ── Edge detection (Sobel-like on color) ────────────────────────────
    float edgeDetect() {
      vec2 texel = 1.0 / resolution;
      vec3 c0 = texture2D(tDiffuse, vUv).rgb;
      vec3 c1 = texture2D(tDiffuse, vUv + vec2( texel.x, 0.0)).rgb;
      vec3 c2 = texture2D(tDiffuse, vUv + vec2(-texel.x, 0.0)).rgb;
      vec3 c3 = texture2D(tDiffuse, vUv + vec2(0.0,  texel.y)).rgb;
      vec3 c4 = texture2D(tDiffuse, vUv + vec2(0.0, -texel.y)).rgb;
      float edge = length(c0 - c1) + length(c0 - c2) + length(c0 - c3) + length(c0 - c4);
      return clamp(edge * 2.0, 0.0, 1.0);
    }

    // ── Cel-shade quantization ──────────────────────────────────────────
    vec3 celShade(vec3 color) {
      float luma   = dot(color, vec3(0.299, 0.587, 0.114));
      float biased = pow(luma, bandBias);
      // Epsilon prevents floor(0.99999) from rounding down at exact band boundaries
      float banded = floor(biased * bands + 0.001) / bands;
      float ratio  = banded / max(luma, 0.001);
      return color * ratio;
    }

    // ── Halftone dot pattern ────────────────────────────────────────────
    float halftone(vec2 uv, float luma) {
      vec2 grid   = uv * resolution / halftoneScale;
      vec2 center = floor(grid) + 0.5;
      float dist  = length(grid - center);
      // 0.5 = max radius to fit within grid cell; dark pixels get larger dots
      float radius = sqrt(1.0 - luma) * 0.5;
      return smoothstep(radius - 0.05, radius + 0.05, dist);
    }

    // ── Cross-hatch pattern ─────────────────────────────────────────────
    float crossHatch(vec2 uv, float luma) {
      float s = sin(uv.x * hatchDensity + uv.y * hatchDensity) * 0.5 + 0.5;
      float s2 = sin(uv.x * hatchDensity - uv.y * hatchDensity) * 0.5 + 0.5;
      float h1 = step(luma, 0.4) * step(0.5, s);
      float h2 = step(luma, 0.25) * step(0.5, s2);
      return max(h1, h2);
    }

    // ── Rim / fresnel approximation (screen-space) ──────────────────────
    float rimDetect() {
      vec2 texel = 1.0 / resolution;
      float d0 = dot(texture2D(tDiffuse, vUv).rgb, vec3(0.299, 0.587, 0.114));
      float d1 = dot(texture2D(tDiffuse, vUv + vec2(texel.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
      float d2 = dot(texture2D(tDiffuse, vUv + vec2(-texel.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
      float d3 = dot(texture2D(tDiffuse, vUv + vec2(0.0, texel.y)).rgb, vec3(0.299, 0.587, 0.114));
      float d4 = dot(texture2D(tDiffuse, vUv + vec2(0.0, -texel.y)).rgb, vec3(0.299, 0.587, 0.114));
      float gradient = abs(d0 - d1) + abs(d0 - d2) + abs(d0 - d3) + abs(d0 - d4);
      return clamp(gradient * 3.0, 0.0, 1.0);
    }

    // ── Paper texture (procedural noise) ────────────────────────────────
    float paperNoise(vec2 uv) {
      vec2 p = uv * resolution * 0.5;
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    // ── Saturation adjustment ───────────────────────────────────────────
    vec3 adjustSaturation(vec3 color, float sat) {
      float luma = dot(color, vec3(0.299, 0.587, 0.114));
      return mix(vec3(luma), color, sat);
    }

    // ── Warm/cool shift ─────────────────────────────────────────────────
    vec3 adjustWarmth(vec3 color, float w) {
      color.r += w * 0.06;
      color.b -= w * 0.06;
      color.g += w * 0.02;
      return clamp(color, 0.0, 1.0);
    }

    // ── Main ────────────────────────────────────────────────────────────
    void main() {
      vec4 src    = texture2D(tDiffuse, vUv);
      float luma  = dot(src.rgb, vec3(0.299, 0.587, 0.114));

      // 1. Cel-shade quantization
      vec3 shaded = celShade(src.rgb);

      // 2. Edge outline
      float edge = edgeDetect();
      shaded = mix(shaded, outlineColor, edge * outlineStr);

      // 3. Halftone dots (applied to shadow regions)
      if (halftoneStr > 0.001) {
        float ht = halftone(vUv, luma);
        float shadow = 1.0 - smoothstep(0.3, 0.5, luma);
        shaded = mix(shaded, shaded * ht, halftoneStr * shadow);
      }

      // 4. Cross-hatch lines (applied to dark regions)
      if (hatchStr > 0.001) {
        float hatch = crossHatch(vUv, luma);
        shaded = mix(shaded, shaded * (1.0 - hatch * 0.6), hatchStr);
      }

      // 5. Rim / fresnel highlight
      if (rimStr > 0.001) {
        float rim = rimDetect();
        shaded += rimColor * rim * rimStr * 0.5;
      }

      // 6. Color grading
      shaded = adjustSaturation(shaded, saturation);
      shaded = adjustWarmth(shaded, warmth);

      // 7. Paper texture overlay
      if (paperStr > 0.001) {
        float noise = paperNoise(vUv);
        shaded = mix(shaded, shaded * (0.85 + noise * 0.3), paperStr);
      }

      gl_FragColor = vec4(clamp(shaded, 0.0, 1.0), src.a);
    }
  `,
};

// ─── CartoonPass ─────────────────────────────────────────────────────────────

export class CartoonPass extends Pass {
  private material: THREE.ShaderMaterial;
  private fsQuad:   FullScreenQuad;

  // Expose to let the viewport read/write these
  bands      = 4;
  outlineStr = 0.8;

  constructor() {
    super();

    this.material = new THREE.ShaderMaterial({
      uniforms:       THREE.UniformsUtils.clone(CartoonShader.uniforms),
      vertexShader:   CartoonShader.vertexShader,
      fragmentShader: CartoonShader.fragmentShader,
    });

    this.fsQuad = new FullScreenQuad(this.material);
  }

  /**
   * Apply a named cartoon style preset.
   * Updates all shader uniforms to match the style configuration.
   */
  applyStyle(style: CartoonStyleConfig): void {
    const u = this.material.uniforms;
    this.bands      = style.bands;
    this.outlineStr = style.outlineStr;

    u['bands'].value         = style.bands;
    u['bandBias'].value      = style.bandBias;
    u['outlineStr'].value    = style.outlineStr;
    u['outlineColor'].value.set(...style.outlineColor);
    u['halftoneStr'].value   = style.halftoneStr;
    u['halftoneScale'].value = style.halftoneScale;
    u['hatchStr'].value      = style.hatchStr;
    u['hatchDensity'].value  = style.hatchDensity;
    u['rimStr'].value        = style.rimStr;
    u['rimColor'].value.set(...style.rimColor);
    u['saturation'].value    = style.saturation;
    u['warmth'].value        = style.warmth;
    u['paperStr'].value      = style.paperStr;
  }

  setSize(width: number, height: number): void {
    this.material.uniforms['resolution'].value.set(width, height);
  }

  render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
  ): void {
    this.material.uniforms['tDiffuse'].value   = readBuffer.texture;
    this.material.uniforms['bands'].value      = this.bands;
    this.material.uniforms['outlineStr'].value = this.outlineStr;

    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) renderer.clear();
    }

    this.fsQuad.render(renderer);
  }

  dispose(): void {
    this.material.dispose();
    this.fsQuad.dispose();
  }
}
