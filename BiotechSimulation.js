/**
 * BiotechSimulation.ts
 * Biological entity data model and simulation framework.
 *
 * Provides typed data models and helper functions for biotech simulations
 * that integrate with the existing AnimationClip / AnimationTimeline system.
 *
 * Supported simulation types:
 *  - Cell division:              mitotic phase sequence with spindle dynamics
 *  - Protein conformational change: multi-state folding / domain motion
 *  - Molecular orbital:          Lissajous-based orbital path for small molecules
 *  - Organelle transport:        vesicle trafficking along microtubule tracks
 *
 * Each helper returns a ready-to-use AnimClip that can be loaded directly
 * into AnimationTimeline and exported via N64AnimExporter.
 *
 * Example:
 *   import { generateCellDivisionClip } from './BiotechSimulation';
 *   const clip = generateCellDivisionClip('nucleus', { duration: 4.0 });
 *   timeline.loadClip(clip);
 */
import { createClip, addTrack, insertKeyframe, } from './AnimationClip';
// ─── Public simulation generators ────────────────────────────────────────────
/**
 * Generate an animation clip for a cell division (mitosis) sequence.
 *
 * Phase timeline:
 *   0%  → 20% : Prophase   — nucleus grows, centrosomes separate
 *   20% → 50% : Metaphase  — cell elongates, chromosomes align at plate
 *   50% → 75% : Anaphase   — cell elongates further, poles separate
 *   75% → 100%: Cytokinesis — cell pinches and splits into two daughters
 */
export function generateCellDivisionClip(targetNode, config = {}) {
    const duration = Math.min(config.duration ?? 4.0, 4.0);
    const elongation = config.elongationFactor ?? 1.6;
    const pinch = config.pinchDepth ?? 0.7;
    const daughterSc = config.daughterScale ?? 0.65;
    const clip = createClip(`cell_division_${targetNode}`, duration);
    clip.loop = config.loop ?? false;
    // ── Scale track (elongation + pinch) ──
    const scaleTrack = addTrack(clip, targetNode, 'scale');
    const t = (frac) => frac * duration;
    // Prophase: slight growth
    kf(scaleTrack, t(0.00), [1.0, 1.0, 1.0], 'bezier');
    kf(scaleTrack, t(0.20), [1.05, 1.05, 1.05], 'bezier');
    // Metaphase: elongate on Y
    kf(scaleTrack, t(0.50), [0.90, elongation, 0.90], 'bezier');
    // Anaphase: further elongation
    kf(scaleTrack, t(0.75), [0.75, elongation * 1.2, 0.75], 'bezier');
    // Cytokinesis pinch: X/Z collapse, Y shrinks toward 2× daughter
    kf(scaleTrack, t(0.88), [0.75 * (1 - pinch * 0.5), elongation * 0.8, 0.75 * (1 - pinch * 0.5)], 'bezier');
    // Final: two daughters (represented by scale of one)
    kf(scaleTrack, t(1.00), [daughterSc, daughterSc, daughterSc], 'bezier');
    // ── Position track (cell shifts slightly during division) ──
    const posTrack = addTrack(clip, targetNode, 'position');
    kf(posTrack, t(0.00), [0, 0, 0], 'linear');
    kf(posTrack, t(0.50), [0, 0, 0], 'linear');
    // Daughter 1 moves up after split
    kf(posTrack, t(1.00), [0, elongation * 0.5 * daughterSc, 0], 'bezier');
    return clip;
}
/**
 * Generate an animation clip for protein conformational change.
 *
 * Simulates multi-state folding / domain motion through rotation and scale
 * pulsing — appropriate for receptor activation, enzyme catalysis, etc.
 */
export function generateProteinFoldClip(targetNode, config = {}) {
    const duration = Math.min(config.duration ?? 2.0, 4.0);
    const states = Math.max(2, Math.min(5, config.stateCount ?? 3));
    const rotAmp = config.rotationAmplitude ?? 45;
    const scaleAmp = config.scaleAmplitude ?? 0.15;
    const clip = createClip(`protein_fold_${targetNode}`, duration);
    clip.loop = config.loop ?? true;
    const rotTrack = addTrack(clip, targetNode, 'rotation');
    const scaleTrack = addTrack(clip, targetNode, 'scale');
    for (let s = 0; s <= states; s++) {
        const frac = s / states;
        const t = frac * duration;
        const angle = Math.sin(frac * Math.PI * 2) * rotAmp;
        const sc = 1.0 + Math.sin(frac * Math.PI * 2) * scaleAmp;
        const easing = 'bezier';
        kf(rotTrack, t, [angle * 0.6, angle, angle * 0.4], easing);
        kf(scaleTrack, t, [sc, sc * 0.95, sc], easing);
    }
    return clip;
}
/**
 * Generate a molecular orbital animation (Lissajous path).
 *
 * Suitable for visualising small molecules, ions, or ligands orbiting
 * a receptor or binding site.
 */
export function generateMolecularOrbitClip(targetNode, config = {}) {
    const duration = Math.min(config.duration ?? 2.0, 4.0);
    const radius = config.radius ?? 2.5;
    const freq = config.frequency ?? 0.5;
    const tiltDeg = config.tilt ?? 25;
    const tiltRad = (tiltDeg * Math.PI) / 180;
    const clip = createClip(`molecular_orbit_${targetNode}`, duration);
    clip.loop = config.loop ?? true;
    const posTrack = addTrack(clip, targetNode, 'position');
    const STEPS = 24; // sample resolution for smooth orbit
    for (let i = 0; i <= STEPS; i++) {
        const frac = i / STEPS;
        const t = frac * duration;
        const theta = frac * 2 * Math.PI * freq * duration;
        // Elliptical orbit with tilt
        const x = radius * Math.cos(theta);
        const y = radius * Math.sin(theta) * Math.sin(tiltRad);
        const z = radius * Math.sin(theta) * Math.cos(tiltRad);
        kf(posTrack, t, [x, y, z], 'bezier');
    }
    return clip;
}
/**
 * Generate an organelle transport animation along a microtubule track.
 *
 * Simulates vesicle/cargo trafficking: the entity moves between waypoints
 * (motor protein-driven), pausing briefly at each stop.
 */
export function generateOrganelleTransportClip(targetNode, config = {}) {
    const duration = Math.min(config.duration ?? 3.0, 4.0);
    const pauseDur = config.pauseDuration ?? 0.2;
    const defaultWaypoints = [
        [0, 0, 0],
        [2, 0.5, 0],
        [3, 1.5, 1],
        [2.5, 2.5, 2],
        [1, 3, 2],
    ];
    const waypoints = config.waypoints ?? defaultWaypoints;
    const clip = createClip(`organelle_transport_${targetNode}`, duration);
    clip.loop = config.loop ?? false;
    const posTrack = addTrack(clip, targetNode, 'position');
    const totalPause = pauseDur * waypoints.length;
    const travelTime = duration - totalPause;
    const segTime = waypoints.length > 1
        ? travelTime / (waypoints.length - 1)
        : travelTime;
    let elapsed = 0;
    for (let i = 0; i < waypoints.length; i++) {
        const wp = waypoints[i];
        // Arrive at waypoint
        kf(posTrack, elapsed, wp, 'bezier');
        // Pause at waypoint (insert duplicate keyframe just before next move)
        if (i < waypoints.length - 1) {
            elapsed += pauseDur;
            kf(posTrack, elapsed, wp, 'step');
            elapsed += segTime;
        }
    }
    return clip;
}
// ─── Simulation runner ────────────────────────────────────────────────────────
/**
 * Run a simulation configuration and return a ready-made AnimClip.
 *
 * Dispatches to the appropriate generator based on config.type.
 */
export function runSimulation(config) {
    const warnings = [];
    const targetNode = config.targets[0] ?? 'entity';
    if (config.duration > 4.0) {
        warnings.push(`Duration ${config.duration.toFixed(2)}s exceeds 4s N64 export limit. ` +
            `Clip will be clamped on export.`);
    }
    let clip;
    let summary;
    const base = { duration: config.duration, loop: config.loop };
    switch (config.type) {
        case 'cell-division': {
            const p = config.params;
            clip = generateCellDivisionClip(targetNode, { ...base, ...p });
            summary = `Cell division sequence for "${targetNode}" (${config.duration}s)`;
            break;
        }
        case 'protein-fold': {
            const p = config.params;
            clip = generateProteinFoldClip(targetNode, { ...base, ...p });
            summary = `Protein conformational change for "${targetNode}" (${config.duration}s)`;
            break;
        }
        case 'molecular-orbit': {
            const p = config.params;
            clip = generateMolecularOrbitClip(targetNode, { ...base, ...p });
            summary = `Molecular orbital path for "${targetNode}" (${config.duration}s)`;
            break;
        }
        case 'organelle-transport': {
            const p = config.params;
            clip = generateOrganelleTransportClip(targetNode, { ...base, ...p });
            summary = `Organelle transport along microtubule for "${targetNode}" (${config.duration}s)`;
            break;
        }
        default: {
            clip = createClip(`sim_${config.type}_${targetNode}`, config.duration);
            clip.loop = config.loop;
            summary = `Empty clip for unsupported simulation type "${config.type}"`;
            warnings.push(`Simulation type "${config.type}" has no generator — empty clip returned.`);
        }
    }
    return { clip, summary, warnings };
}
// ─── Preset scene builders ────────────────────────────────────────────────────
/**
 * Returns a pre-defined set of BioEntities representing a eukaryotic cell
 * interior suitable for organelle-level visualization.
 */
export function buildEukaryoticCellScene() {
    return [
        {
            id: 'cell-membrane',
            name: 'Plasma Membrane',
            type: 'lipid-bilayer',
            position: [0, 0, 0],
            scale: [3, 3, 3],
            properties: { tension: 0.4, label: 'Plasma membrane' },
        },
        {
            id: 'nucleus',
            name: 'Nucleus',
            type: 'nucleus',
            position: [0, 0.2, 0],
            scale: [1, 1, 1],
            properties: { mass: 5, label: 'Nucleus' },
        },
        {
            id: 'mito-1',
            name: 'Mitochondrion 1',
            type: 'mitochondria',
            position: [1.2, 0.5, 0.5],
            scale: [0.4, 0.25, 0.25],
            properties: { mass: 1, label: 'ATP factory' },
        },
        {
            id: 'mito-2',
            name: 'Mitochondrion 2',
            type: 'mitochondria',
            position: [-1.1, -0.3, 0.7],
            scale: [0.45, 0.22, 0.22],
            properties: { mass: 1 },
        },
        {
            id: 'vesicle-1',
            name: 'Secretory Vesicle',
            type: 'vesicle',
            position: [0.6, 1.2, -0.4],
            scale: [0.15, 0.15, 0.15],
            properties: { mass: 0.2, label: 'Secretory vesicle' },
        },
        {
            id: 'receptor-1',
            name: 'GPCR Receptor',
            type: 'receptor',
            position: [2.5, 0, 0],
            scale: [0.12, 0.18, 0.12],
            properties: { pHSensitivity: 0.3, label: 'GPCR' },
        },
    ];
}
/**
 * Returns a set of BioEntities representing a protein complex
 * (e.g. a trimeric G-protein or enzyme subunit assembly).
 */
export function buildProteinComplexScene() {
    const subunits = [
        ['subunit-alpha', 'α-subunit', [0.6, 0, 0]],
        ['subunit-beta', 'β-subunit', [-0.3, 0, 0.5]],
        ['subunit-gamma', 'γ-subunit', [-0.3, 0, -0.5]],
    ];
    return subunits.map(([id, name, pos]) => ({
        id,
        name,
        type: 'protein',
        position: pos,
        scale: [0.35, 0.35, 0.35],
        properties: { mass: 2, label: name },
    }));
}
// ─── Utility ──────────────────────────────────────────────────────────────────
/** Shorthand: insert a keyframe with explicit values. */
function kf(track, time, value, easing) {
    const keyframe = { time, value, easing };
    insertKeyframe(track, keyframe);
}
