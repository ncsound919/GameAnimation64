/**
 * BiotechImagingPass.js
 * Post-processing pass for biotechnology imaging and simulation visualization.
 *
 * Implements multiple biotech microscopy rendering modes as a Three.js
 * post-process pass (composited in EffectComposer after the main RenderPass):
 *
 *  - Fluorescence:    Simulates fluorescence microscopy. Objects glow at
 *                     user-defined emission wavelengths on a dark background.
 *  - Confocal:        Depth-selective imaging with a z-slice PSF (point-spread
 *                     function) blur, mimicking laser scanning confocal output.
 *  - False-Color LUT: Maps scene luminance to a scientific color map
 *                     (Jet / Viridis / Hot / Cool / Grayscale).
 *  - Phase-Contrast:  Edge-enhanced rendering for transparent biological
 *                     structures (simulates Zernike phase contrast).
 *  - Standard:        Pass-through (no effect applied).
 *
 * Usage:
 *   const imagingPass = new BiotechImagingPass();
 *   imagingPass.setMode('fluorescence');
 *   imagingPass.setChannel(0, { color: [0, 1, 0], intensity: 1.2 });
 *   composer.addPass(imagingPass);
 */
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass';
// ─── Biotech imaging shader ───────────────────────────────────────────────────
const BiotechShader = {
    uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: null },
        resolution: { value: new THREE.Vector2(1, 1) },
        // Mode selector: 0=standard 1=fluorescence 2=confocal 3=false-color 4=phase
        mode: { value: 0 },
        // Fluorescence
        bgDarkness: { value: 0.92 },
        ch0Color: { value: new THREE.Vector3(0, 1, 0) }, // GFP green
        ch0Intensity: { value: 1.2 },
        ch1Color: { value: new THREE.Vector3(1, 0, 0.2) }, // mCherry red
        ch1Intensity: { value: 1.0 },
        ch2Color: { value: new THREE.Vector3(0.1, 0.4, 1) }, // DAPI blue
        ch2Intensity: { value: 0.9 },
        ch3Color: { value: new THREE.Vector3(1, 0.9, 0) }, // YFP yellow
        ch3Intensity: { value: 0.8 },
        // Confocal z-slice
        zSlice: { value: 0.5 },
        zThickness: { value: 0.15 },
        cameraNear: { value: 0.01 },
        cameraFar: { value: 500.0 },
        // False-color LUT
        colorMap: { value: 0 }, // 0=jet 1=viridis 2=hot 3=cool 4=grayscale
        lutContrast: { value: 1.0 },
        lutBrightness: { value: 0.0 },
        // Phase contrast
        phaseHalo: { value: 0.6 },
    },
    vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
    fragmentShader: /* glsl */ `
    precision highp float;

    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform vec2      resolution;
    uniform int       mode;

    // Fluorescence
    uniform float bgDarkness;
    uniform vec3  ch0Color;  uniform float ch0Intensity;
    uniform vec3  ch1Color;  uniform float ch1Intensity;
    uniform vec3  ch2Color;  uniform float ch2Intensity;
    uniform vec3  ch3Color;  uniform float ch3Intensity;

    // Confocal
    uniform float zSlice;
    uniform float zThickness;
    uniform float cameraNear;
    uniform float cameraFar;

    // False-color
    uniform int   colorMap;
    uniform float lutContrast;
    uniform float lutBrightness;

    // Phase contrast
    uniform float phaseHalo;

    varying vec2 vUv;

    // ── Linearise depth buffer ──────────────────────────────────────────
    float linearDepth(float d) {
      float z_n = 2.0 * d - 1.0;
      return (2.0 * cameraNear * cameraFar) /
             (cameraFar + cameraNear - z_n * (cameraFar - cameraNear));
    }

    float sceneDepthNorm() {
      float rawDepth = texture2D(tDepth, vUv).r;
      float lin = linearDepth(rawDepth);
      return clamp((lin - cameraNear) / (cameraFar - cameraNear), 0.0, 1.0);
    }

    // ── Fluorescence ────────────────────────────────────────────────────
    //  Each color channel responds to its spectral band in the source image.
    //  Channel 0 (green) ← green component
    //  Channel 1 (red)   ← red component
    //  Channel 2 (blue)  ← blue component
    //  Channel 3 (yellow)← (R+G)/2 high-frequency
    vec4 fluorescenceMode(vec4 src) {
      float luma = dot(src.rgb, vec3(0.299, 0.587, 0.114));

      // Source channel weights
      float wR = src.r;
      float wG = src.g;
      float wB = src.b;
      float wY = (src.r + src.g) * 0.5;

      // Accumulate emitted light per channel
      vec3 emission = vec3(0.0);
      emission += ch0Color * wG * ch0Intensity;
      emission += ch1Color * wR * ch1Intensity;
      emission += ch2Color * wB * ch2Intensity;
      emission += ch3Color * wY * ch3Intensity;

      // Dark background — background stays near-black, signal pops
      float bg = 1.0 - bgDarkness;
      emission = max(emission, vec3(bg * luma));

      return vec4(clamp(emission, 0.0, 1.5), src.a);
    }

    // ── Confocal z-slice ────────────────────────────────────────────────
    //  Blur pixels outside the z-slice; keep in-slice pixels sharp.
    vec4 confocalMode(vec4 src, float depthN) {
      float halfT  = zThickness * 0.5;
      float dist   = abs(depthN - zSlice);
      float inSlice = 1.0 - smoothstep(halfT * 0.5, halfT, dist);

      // Out-of-slice: Gaussian blur approximation (5-sample box)
      vec2 texel = 1.0 / resolution;
      vec4 blurred = src * 0.36;
      blurred += texture2D(tDiffuse, vUv + vec2( texel.x,  0.0      )) * 0.16;
      blurred += texture2D(tDiffuse, vUv + vec2(-texel.x,  0.0      )) * 0.16;
      blurred += texture2D(tDiffuse, vUv + vec2( 0.0,      texel.y  )) * 0.16;
      blurred += texture2D(tDiffuse, vUv + vec2( 0.0,     -texel.y  )) * 0.16;

      vec4 result = mix(blurred, src, inSlice);

      // Dim out-of-slice signal (confocal rejects out-of-focus light)
      float brightness = mix(0.15, 1.0, inSlice);
      result.rgb *= brightness;

      return result;
    }

    // ── False-color LUT ─────────────────────────────────────────────────
    vec3 jetLUT(float t) {
      t = clamp(t, 0.0, 1.0);
      float r = clamp(1.5 - abs(4.0 * t - 3.0), 0.0, 1.0);
      float g = clamp(1.5 - abs(4.0 * t - 2.0), 0.0, 1.0);
      float b = clamp(1.5 - abs(4.0 * t - 1.0), 0.0, 1.0);
      return vec3(r, g, b);
    }

    vec3 viridisLUT(float t) {
      // Piecewise-linear Viridis approximation (5 control points)
      const vec3 c0 = vec3(0.267, 0.004, 0.329);
      const vec3 c1 = vec3(0.229, 0.322, 0.545);
      const vec3 c2 = vec3(0.128, 0.566, 0.551);
      const vec3 c3 = vec3(0.370, 0.789, 0.383);
      const vec3 c4 = vec3(0.993, 0.906, 0.144);
      t = clamp(t, 0.0, 1.0) * 4.0;
      int idx = int(t);
      float f  = fract(t);
      if (idx == 0) return mix(c0, c1, f);
      if (idx == 1) return mix(c1, c2, f);
      if (idx == 2) return mix(c2, c3, f);
      return mix(c3, c4, clamp(f, 0.0, 1.0));
    }

    vec3 hotLUT(float t) {
      // Black → Red → Yellow → White
      t = clamp(t, 0.0, 1.0);
      float r = clamp(t * 3.0,       0.0, 1.0);
      float g = clamp(t * 3.0 - 1.0, 0.0, 1.0);
      float b = clamp(t * 3.0 - 2.0, 0.0, 1.0);
      return vec3(r, g, b);
    }

    vec3 coolLUT(float t) {
      // Cyan → Magenta
      t = clamp(t, 0.0, 1.0);
      return vec3(t, 1.0 - t, 1.0);
    }

    vec4 falseColorMode(vec4 src) {
      float luma = dot(src.rgb, vec3(0.299, 0.587, 0.114));
      luma = clamp(luma * lutContrast + lutBrightness, 0.0, 1.0);

      vec3 mapped;
      if      (colorMap == 0) mapped = jetLUT(luma);
      else if (colorMap == 1) mapped = viridisLUT(luma);
      else if (colorMap == 2) mapped = hotLUT(luma);
      else if (colorMap == 3) mapped = coolLUT(luma);
      else                    mapped = vec3(luma); // grayscale

      return vec4(mapped, src.a);
    }

    // ── Phase contrast ──────────────────────────────────────────────────
    //  Enhances transparent biological structures via halo-edge detection.
    vec4 phaseContrastMode(vec4 src) {
      vec2 texel = 1.0 / resolution;
      // Laplacian kernel (edge = phase-shifted light)
      vec3 sum = vec3(0.0);
      sum += texture2D(tDiffuse, vUv + vec2(-texel.x, -texel.y)).rgb;
      sum += texture2D(tDiffuse, vUv + vec2( 0.0,     -texel.y)).rgb * 2.0;
      sum += texture2D(tDiffuse, vUv + vec2( texel.x, -texel.y)).rgb;
      sum += texture2D(tDiffuse, vUv + vec2(-texel.x,  0.0    )).rgb * 2.0;
      sum -= src.rgb * 12.0;
      sum += texture2D(tDiffuse, vUv + vec2( texel.x,  0.0    )).rgb * 2.0;
      sum += texture2D(tDiffuse, vUv + vec2(-texel.x,  texel.y)).rgb;
      sum += texture2D(tDiffuse, vUv + vec2( 0.0,      texel.y)).rgb * 2.0;
      sum += texture2D(tDiffuse, vUv + vec2( texel.x,  texel.y)).rgb;

      float edgeMag = length(sum) * phaseHalo;

      // Phase contrast: bright halo on bright edges, dark halo on dark edges
      float luma = dot(src.rgb, vec3(0.299, 0.587, 0.114));
      vec3 halo  = src.rgb + sign(luma - 0.5) * edgeMag * 0.5;

      // Convert to grayscale-tinted result (phase images are typically mono)
      float mono = dot(clamp(halo, 0.0, 1.0), vec3(0.299, 0.587, 0.114));
      // Slight blue tint common in phase contrast microscopy
      vec3 out_  = mix(vec3(mono), vec3(mono * 0.88, mono * 0.92, mono), 0.35);

      return vec4(clamp(out_, 0.0, 1.0), src.a);
    }

    // ── Main ────────────────────────────────────────────────────────────
    void main() {
      vec4 src     = texture2D(tDiffuse, vUv);
      float depthN = sceneDepthNorm();

      vec4 result;
      if      (mode == 1) result = fluorescenceMode(src);
      else if (mode == 2) result = confocalMode(src, depthN);
      else if (mode == 3) result = falseColorMode(src);
      else if (mode == 4) result = phaseContrastMode(src);
      else                result = src; // standard pass-through

      gl_FragColor = result;
    }
  `,
};
// ─── Mode / colormap enumerations ─────────────────────────────────────────────
const MODE_INDEX = {
    'standard': 0,
    'fluorescence': 1,
    'confocal': 2,
    'false-color': 3,
    'phase-contrast': 4,
};
const COLOR_MAP_INDEX = {
    'jet': 0,
    'viridis': 1,
    'hot': 2,
    'cool': 3,
    'grayscale': 4,
};
// ─── BiotechImagingPass ───────────────────────────────────────────────────────
/**
 * Three.js post-processing pass for biotech microscopy visualization.
 *
 * Add to an EffectComposer after the main RenderPass:
 * ```ts
 * const pass = new BiotechImagingPass({ mode: 'fluorescence' });
 * composer.addPass(pass);
 * ```
 */
export class BiotechImagingPass extends Pass {
    constructor(opts = {}) {
        super();
        this._mode = opts.mode ?? 'standard';
        this.material = new THREE.ShaderMaterial({
            uniforms: THREE.UniformsUtils.clone(BiotechShader.uniforms),
            vertexShader: BiotechShader.vertexShader,
            fragmentShader: BiotechShader.fragmentShader,
        });
        this.fsQuad = new FullScreenQuad(this.material);
        // Apply initial options
        this.material.uniforms['mode'].value = MODE_INDEX[this._mode];
        this.material.uniforms['bgDarkness'].value = opts.bgDarkness ?? 0.92;
        this.material.uniforms['zSlice'].value = opts.zSlice ?? 0.5;
        this.material.uniforms['zThickness'].value = opts.zThickness ?? 0.15;
        this.material.uniforms['phaseHalo'].value = opts.phaseHalo ?? 0.6;
        this.material.uniforms['colorMap'].value =
            COLOR_MAP_INDEX[opts.colorMap ?? 'viridis'];
        this.enabled = this._mode !== 'standard';
    }
    // ── Public API ─────────────────────────────────────────────────────────────
    /** Switch visualization mode. Setting 'standard' disables the pass. */
    setMode(mode) {
        this._mode = mode;
        this.material.uniforms['mode'].value = MODE_INDEX[mode];
        this.enabled = mode !== 'standard';
    }
    /** Get current visualization mode. */
    getMode() {
        return this._mode;
    }
    /**
     * Configure a fluorescence channel (0–3).
     * Channel assignment: 0=green(GFP) 1=red(mCherry) 2=blue(DAPI) 3=yellow(YFP)
     */
    setChannel(index, ch) {
        const prefix = `ch${index}`;
        const u = this.material.uniforms;
        if (ch.color !== undefined) {
            u[`${prefix}Color`].value.set(...ch.color);
        }
        if (ch.intensity !== undefined) {
            u[`${prefix}Intensity`].value = ch.intensity;
        }
        // enabled: when disabled set intensity to 0
        if (ch.enabled === false) {
            u[`${prefix}Intensity`].value = 0;
        }
    }
    /** Get current channel configuration. */
    getChannel(index) {
        const prefix = `ch${index}`;
        const u = this.material.uniforms;
        const col = u[`${prefix}Color`].value;
        const int_ = u[`${prefix}Intensity`].value;
        return {
            color: [col.x, col.y, col.z],
            intensity: int_,
            enabled: int_ > 0,
        };
    }
    /** Set the background darkness for fluorescence mode (0–1). */
    setBackgroundDarkness(value) {
        this.material.uniforms['bgDarkness'].value = Math.max(0, Math.min(1, value));
    }
    /** Configure the confocal z-slice (0–1 normalized depth). */
    setZSlice(center, thickness) {
        this.material.uniforms['zSlice'].value = Math.max(0, Math.min(1, center));
        this.material.uniforms['zThickness'].value = Math.max(0.01, Math.min(1, thickness));
    }
    /** Set the active color map for false-color mode. */
    setColorMap(map) {
        this.material.uniforms['colorMap'].value = COLOR_MAP_INDEX[map];
    }
    /** Set LUT contrast and brightness for false-color mode. */
    setLUTRange(contrast, brightness) {
        this.material.uniforms['lutContrast'].value = contrast;
        this.material.uniforms['lutBrightness'].value = brightness;
    }
    /** Set the phase-contrast halo strength (0–2). */
    setPhaseHalo(strength) {
        this.material.uniforms['phaseHalo'].value = Math.max(0, strength);
    }
    /** Update camera near/far so confocal depth linearization is accurate. */
    setCameraClip(near, far) {
        this.material.uniforms['cameraNear'].value = near;
        this.material.uniforms['cameraFar'].value = far;
    }
    // ── Pass overrides ─────────────────────────────────────────────────────────
    setSize(width, height) {
        this.material.uniforms['resolution'].value.set(width, height);
    }
    render(renderer, writeBuffer, readBuffer) {
        this.material.uniforms['tDiffuse'].value = readBuffer.texture;
        if (this.renderToScreen) {
            renderer.setRenderTarget(null);
        }
        else {
            renderer.setRenderTarget(writeBuffer);
            if (this.clear)
                renderer.clear();
        }
        this.fsQuad.render(renderer);
    }
    dispose() {
        this.material.dispose();
        this.fsQuad.dispose();
    }
}
