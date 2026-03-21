/**
 * AnimationTimeline.js
 * Keyframe timeline panel for Pyrite64's animation system.
 *
 * Renders an interactive timeline with:
 *  - Playback controls (play, pause, stop, loop toggle)
 *  - Scrubber bar with frame/time cursor
 *  - Per-track keyframe diamonds (click to select, double-click to edit)
 *  - Track add/remove/reorder
 *  - Integration with the Three.js viewport for live preview
 *
 * The timeline operates on AnimClip data and emits events that the
 * viewport and inspector panels consume for real-time preview.
 */
import { addTrack, insertKeyframe, removeKeyframe, evaluateTrack, } from './AnimationClip.js';
// ─── AnimationTimeline ────────────────────────────────────────────────────────
export class AnimationTimeline {
    constructor(opts) {
        // State
        this.clip = null;
        this.currentTime = 0;
        this.playbackState = 'stopped';
        this.playbackStartMs = 0;
        this.playbackStartTime = 0;
        this.animFrameId = null;
        // Selection
        this.selectedTrackIdx = -1;
        this.selectedKeyframeIdx = -1;
        // UI scaling
        this.pixelsPerSecond = 200;
        this.trackHeight = 32;
        this.headerHeight = 40;
        this.rulerHeight = 24;
        this.scrollLeft = 0;
        // DOM refs (created in buildUI)
        this.canvas = null;
        this.ctx = null;
        this.toolbar = null;
        // Event handlers (stored for cleanup)
        this.canvasClickHandler = null;
        this.canvasDblClickHandler = null;
        this.canvasMouseDownHandler = null;
        this.resizeObserver = null;
        this.container = opts.container;
        this.callbacks = opts.callbacks;
        this.fps = opts.fps ?? 30;
        this.snapToFrame = opts.snapToFrame ?? true;
        this.buildUI();
        this.renderCanvas();
    }
    // ── Public API ──────────────────────────────────────────────────────────────
    /** Load a clip into the timeline for editing. */
    loadClip(clip) {
        this.stop();
        this.clip = clip;
        this.currentTime = 0;
        this.selectedTrackIdx = -1;
        this.selectedKeyframeIdx = -1;
        this.renderCanvas();
        this.emitTimeUpdate();
    }
    /** Get the currently loaded clip. */
    getClip() {
        return this.clip;
    }
    /** Get the current playback time. */
    getCurrentTime() {
        return this.currentTime;
    }
    /** Start or resume playback. */
    play() {
        if (!this.clip)
            return;
        if (this.playbackState === 'playing')
            return;
        this.playbackState = 'playing';
        this.playbackStartMs = performance.now();
        this.playbackStartTime = this.currentTime;
        this.callbacks.onPlaybackChange('playing');
        const tick = () => {
            const elapsed = (performance.now() - this.playbackStartMs) / 1000;
            let t = this.playbackStartTime + elapsed;
            if (this.clip.loop) {
                t = t % this.clip.duration;
            }
            else if (t >= this.clip.duration) {
                t = this.clip.duration;
                this.pause();
            }
            this.currentTime = t;
            this.emitTimeUpdate();
            this.renderCanvas();
            if (this.playbackState === 'playing') {
                this.animFrameId = requestAnimationFrame(tick);
            }
        };
        this.animFrameId = requestAnimationFrame(tick);
    }
    /** Pause playback at the current time. */
    pause() {
        this.playbackState = 'paused';
        if (this.animFrameId !== null) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
        this.callbacks.onPlaybackChange('paused');
    }
    /** Stop playback and reset to time 0. */
    stop() {
        this.playbackState = 'stopped';
        if (this.animFrameId !== null) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
        this.currentTime = 0;
        this.callbacks.onPlaybackChange('stopped');
        this.emitTimeUpdate();
        this.renderCanvas();
    }
    /** Set the scrubber to a specific time. */
    seekTo(time) {
        if (!this.clip)
            return;
        this.currentTime = Math.max(0, Math.min(time, this.clip.duration));
        if (this.snapToFrame) {
            this.currentTime = Math.round(this.currentTime * this.fps) / this.fps;
        }
        this.emitTimeUpdate();
        this.renderCanvas();
    }
    /** Add a new track to the current clip. */
    addTrackToClip(targetNode, property) {
        if (!this.clip)
            return;
        addTrack(this.clip, targetNode, property);
        this.callbacks.onClipModified(this.clip);
        this.renderCanvas();
    }
    /** Remove a track by index. */
    removeTrackFromClip(index) {
        if (!this.clip)
            return;
        if (index >= 0 && index < this.clip.tracks.length) {
            this.clip.tracks.splice(index, 1);
            this.selectedTrackIdx = -1;
            this.selectedKeyframeIdx = -1;
            this.callbacks.onClipModified(this.clip);
            this.renderCanvas();
        }
    }
    /** Insert a keyframe at the current time on the given track. */
    addKeyframeAtCursor(trackIndex, easing = 'linear') {
        if (!this.clip)
            return;
        const track = this.clip.tracks[trackIndex];
        if (!track)
            return;
        const currentValue = evaluateTrack(track, this.currentTime);
        const kf = {
            time: this.currentTime,
            value: currentValue,
            easing,
        };
        insertKeyframe(track, kf);
        this.callbacks.onClipModified(this.clip);
        this.renderCanvas();
    }
    /** Remove the currently selected keyframe. */
    removeSelectedKeyframe() {
        if (!this.clip || this.selectedTrackIdx < 0 || this.selectedKeyframeIdx < 0)
            return;
        const track = this.clip.tracks[this.selectedTrackIdx];
        if (!track)
            return;
        removeKeyframe(track, this.selectedKeyframeIdx);
        this.selectedKeyframeIdx = -1;
        this.callbacks.onClipModified(this.clip);
        this.renderCanvas();
    }
    /** Set zoom level (pixels per second). */
    setZoom(pixelsPerSecond) {
        this.pixelsPerSecond = Math.max(50, Math.min(800, pixelsPerSecond));
        this.renderCanvas();
    }
    /** Clean up DOM and listeners. */
    dispose() {
        if (this.animFrameId !== null) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        if (this.canvas && this.canvasClickHandler) {
            this.canvas.removeEventListener('click', this.canvasClickHandler);
        }
        if (this.canvas && this.canvasDblClickHandler) {
            this.canvas.removeEventListener('dblclick', this.canvasDblClickHandler);
        }
        if (this.canvas && this.canvasMouseDownHandler) {
            this.canvas.removeEventListener('mousedown', this.canvasMouseDownHandler);
        }
        this.container.innerHTML = '';
    }
    // ── Private: UI construction ────────────────────────────────────────────────
    buildUI() {
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.background = '#1a1a2e';
        this.container.style.color = '#e0e0e0';
        this.container.style.fontFamily = "'JetBrains Mono', 'Fira Code', monospace";
        this.container.style.fontSize = '12px';
        this.container.style.overflow = 'hidden';
        this.container.style.userSelect = 'none';
        // Toolbar
        this.toolbar = document.createElement('div');
        this.toolbar.style.cssText =
            'display:flex; align-items:center; gap:6px; padding:4px 8px; ' +
                'background:#16162a; border-bottom:1px solid #2a2a4a;';
        const makeBtn = (label, onClick) => {
            const btn = document.createElement('button');
            btn.textContent = label;
            btn.style.cssText =
                'background:#2a2a4a; color:#e0e0e0; border:1px solid #3a3a5a; ' +
                    'border-radius:4px; padding:3px 10px; cursor:pointer; font-size:12px;';
            btn.addEventListener('click', onClick);
            return btn;
        };
        this.toolbar.append(makeBtn('⏮', () => this.seekTo(0)), makeBtn('▶', () => this.play()), makeBtn('⏸', () => this.pause()), makeBtn('⏹', () => this.stop()), makeBtn('🔁', () => {
            if (this.clip) {
                this.clip.loop = !this.clip.loop;
                this.callbacks.onClipModified(this.clip);
            }
        }), makeBtn('◆+', () => {
            if (this.selectedTrackIdx >= 0) {
                this.addKeyframeAtCursor(this.selectedTrackIdx);
            }
        }), makeBtn('🗑', () => this.removeSelectedKeyframe()), makeBtn('➕', () => this.zoomIn()), makeBtn('➖', () => this.zoomOut()));
        // Time display
        const timeLabel = document.createElement('span');
        timeLabel.id = 'p64-timeline-time';
        timeLabel.style.cssText = 'margin-left:auto; color:#ffcc00; font-weight:bold;';
        timeLabel.textContent = '0:00.000';
        this.toolbar.append(timeLabel);
        this.container.append(this.toolbar);
        // Canvas
        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = 'flex:1; width:100%; cursor:crosshair;';
        this.container.append(this.canvas);
        this.ctx = this.canvas.getContext('2d');
        // Event listeners
        this.canvasClickHandler = (e) => this.handleCanvasClick(e);
        this.canvasDblClickHandler = (e) => this.handleCanvasDblClick(e);
        this.canvasMouseDownHandler = (e) => this.handleScrubDrag(e);
        this.canvas.addEventListener('click', this.canvasClickHandler);
        this.canvas.addEventListener('dblclick', this.canvasDblClickHandler);
        this.canvas.addEventListener('mousedown', this.canvasMouseDownHandler);
        // Resize observer
        this.resizeObserver = new ResizeObserver(() => {
            if (!document.contains(this.container)) {
                this.resizeObserver?.disconnect();
                return;
            }
            this.resizeCanvas();
            this.renderCanvas();
        });
        this.resizeObserver.observe(this.container);
        this.resizeCanvas();
    }
    resizeCanvas() {
        if (!this.canvas)
            return;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx?.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx?.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
    zoomIn() {
        this.setZoom(this.pixelsPerSecond * 1.25);
    }
    zoomOut() {
        this.setZoom(this.pixelsPerSecond / 1.25);
    }
    // ── Private: Rendering ──────────────────────────────────────────────────────
    renderCanvas() {
        if (!this.ctx || !this.canvas)
            return;
        const w = this.canvas.width / window.devicePixelRatio;
        const h = this.canvas.height / window.devicePixelRatio;
        const ctx = this.ctx;
        ctx.save();
        ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
        // Clear
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, w, h);
        if (!this.clip) {
            ctx.fillStyle = '#555';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No clip loaded — create or select an animation clip', w / 2, h / 2);
            ctx.restore();
            return;
        }
        const labelWidth = 140;
        const timelineX = labelWidth;
        const timelineW = w - labelWidth;
        // ── Ruler ──
        this.renderRuler(ctx, timelineX, 0, timelineW, this.rulerHeight);
        // ── Tracks ──
        const trackY0 = this.rulerHeight;
        for (let i = 0; i < this.clip.tracks.length; i++) {
            const y = trackY0 + i * this.trackHeight;
            this.renderTrackLabel(ctx, this.clip.tracks[i], 0, y, labelWidth, this.trackHeight, i);
            this.renderTrackKeyframes(ctx, this.clip.tracks[i], timelineX, y, timelineW, this.trackHeight, i);
        }
        // ── Playhead ──
        const playheadX = timelineX + this.timeToX(this.currentTime);
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, h);
        ctx.stroke();
        // Playhead triangle
        ctx.fillStyle = '#ff4444';
        ctx.beginPath();
        ctx.moveTo(playheadX - 6, 0);
        ctx.lineTo(playheadX + 6, 0);
        ctx.lineTo(playheadX, 8);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        // Update time label
        this.updateTimeLabel();
    }
    renderRuler(ctx, x, y, w, h) {
        if (!this.clip)
            return;
        ctx.fillStyle = '#16162a';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#3a3a5a';
        ctx.fillStyle = '#888';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        // Draw tick marks
        const step = 1 / this.fps;
        const majorEvery = this.fps; // Every second
        for (let f = 0; f <= this.clip.duration * this.fps; f++) {
            const t = f * step;
            const px = x + this.timeToX(t);
            if (px < x || px > x + w)
                continue;
            const isMajor = f % majorEvery === 0;
            ctx.beginPath();
            ctx.moveTo(px, y + h);
            ctx.lineTo(px, y + h - (isMajor ? 14 : 5));
            ctx.lineWidth = isMajor ? 1.5 : 0.5;
            ctx.stroke();
            if (isMajor) {
                ctx.fillText(`${(f / this.fps).toFixed(0)}s`, px, y + 10);
            }
        }
    }
    renderTrackLabel(ctx, track, x, y, w, h, index) {
        // Background
        const isSelected = index === this.selectedTrackIdx;
        ctx.fillStyle = isSelected ? '#2a2a5a' : '#1e1e38';
        ctx.fillRect(x, y, w, h);
        // Border
        ctx.strokeStyle = '#2a2a4a';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);
        // Property icon
        const icon = track.property === 'position' ? '📍' :
            track.property === 'rotation' ? '🔄' : '📐';
        // Text
        ctx.fillStyle = isSelected ? '#ffcc00' : '#ccc';
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`${icon} ${track.targetNode}.${track.property}`, x + 6, y + h / 2 + 4);
    }
    renderTrackKeyframes(ctx, track, x, y, w, h, trackIdx) {
        // Background
        ctx.fillStyle = '#1a1a30';
        ctx.fillRect(x, y, w, h);
        // Horizontal line
        ctx.strokeStyle = '#2a2a4a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y + h / 2);
        ctx.lineTo(x + w, y + h / 2);
        ctx.stroke();
        // Draw keyframe diamonds
        for (let ki = 0; ki < track.keyframes.length; ki++) {
            const kf = track.keyframes[ki];
            const kx = x + this.timeToX(kf.time);
            const ky = y + h / 2;
            const isSelected = trackIdx === this.selectedTrackIdx &&
                ki === this.selectedKeyframeIdx;
            // Diamond shape
            const size = isSelected ? 7 : 5;
            ctx.fillStyle = isSelected ? '#ffcc00' :
                kf.easing === 'bezier' ? '#44aaff' :
                    kf.easing === 'step' ? '#ff8844' : '#88cc44';
            ctx.beginPath();
            ctx.moveTo(kx, ky - size);
            ctx.lineTo(kx + size, ky);
            ctx.lineTo(kx, ky + size);
            ctx.lineTo(kx - size, ky);
            ctx.closePath();
            ctx.fill();
            // Outline
            ctx.strokeStyle = isSelected ? '#fff' : '#555';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }
    timeToX(time) {
        return (time * this.pixelsPerSecond) - this.scrollLeft;
    }
    xToTime(x) {
        return (x + this.scrollLeft) / this.pixelsPerSecond;
    }
    // ── Private: Interaction ────────────────────────────────────────────────────
    handleCanvasClick(e) {
        if (!this.clip || !this.canvas)
            return;
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const labelWidth = 140;
        // Click on track label → select track
        if (mx < labelWidth) {
            const trackIdx = Math.floor((my - this.rulerHeight) / this.trackHeight);
            if (trackIdx >= 0 && trackIdx < this.clip.tracks.length) {
                this.selectedTrackIdx = trackIdx;
                this.selectedKeyframeIdx = -1;
                this.renderCanvas();
            }
            return;
        }
        // Click on timeline area → check for keyframe hit
        const trackIdx = Math.floor((my - this.rulerHeight) / this.trackHeight);
        if (trackIdx < 0 || trackIdx >= this.clip.tracks.length)
            return;
        const track = this.clip.tracks[trackIdx];
        const clickTime = this.xToTime(mx - labelWidth);
        // Check if we hit a keyframe (within 8px tolerance)
        const tolerance = 8 / this.pixelsPerSecond;
        for (let ki = 0; ki < track.keyframes.length; ki++) {
            if (Math.abs(track.keyframes[ki].time - clickTime) < tolerance) {
                this.selectedTrackIdx = trackIdx;
                this.selectedKeyframeIdx = ki;
                this.callbacks.onKeyframeSelect(track, ki);
                this.renderCanvas();
                return;
            }
        }
        // Click on empty area → deselect keyframe, move cursor
        this.selectedTrackIdx = trackIdx;
        this.selectedKeyframeIdx = -1;
        this.seekTo(clickTime);
    }
    handleCanvasDblClick(e) {
        if (!this.clip || !this.canvas)
            return;
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const labelWidth = 140;
        if (mx <= labelWidth)
            return;
        const trackIdx = Math.floor((my - this.rulerHeight) / this.trackHeight);
        if (trackIdx < 0 || trackIdx >= this.clip.tracks.length)
            return;
        // Double-click on timeline → add keyframe at that time
        const clickTime = this.xToTime(mx - labelWidth);
        this.seekTo(clickTime);
        this.addKeyframeAtCursor(trackIdx);
    }
    handleScrubDrag(e) {
        if (!this.clip || !this.canvas)
            return;
        const rect = this.canvas.getBoundingClientRect();
        const my = e.clientY - rect.top;
        const labelWidth = 140;
        // Only scrub if clicking on the ruler area
        if (my > this.rulerHeight)
            return;
        const onMove = (me) => {
            const mx = me.clientX - rect.left;
            const t = this.xToTime(mx - labelWidth);
            this.seekTo(t);
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        // Initial seek
        const mx = e.clientX - rect.left;
        this.seekTo(this.xToTime(mx - labelWidth));
    }
    // ── Private: Events ─────────────────────────────────────────────────────────
    emitTimeUpdate() {
        if (!this.clip)
            return;
        const evals = this.clip.tracks.map(track => ({
            targetNode: track.targetNode,
            property: track.property,
            value: evaluateTrack(track, this.currentTime),
        }));
        this.callbacks.onTimeUpdate(this.currentTime, evals);
    }
    updateTimeLabel() {
        const label = document.getElementById('p64-timeline-time');
        if (!label)
            return;
        const min = Math.floor(this.currentTime / 60);
        const sec = this.currentTime % 60;
        const frame = Math.floor(this.currentTime * this.fps);
        label.textContent = `${min}:${sec.toFixed(3).padStart(6, '0')} f${frame}`;
    }
}
