/**
 * VibeCreatorPage.ts
 * "Create" page for the Pyrite64 Vibe Coding Engine.
 *
 * Styled like a sports-game character creation screen with tabbed
 * categories (World, Player, Enemies, Physics, Shading, Game Mode).
 *
 * Layout:
 *  ┌───────────────────────────────────────────────────────────────────┐
 *  │  [Back ←]  CREATE YOUR GAME  [Category tabs ...]                 │
 *  ├──────────┬────────────────────────────────────┬──────────────────┤
 *  │ Category │ Preset Card Grid (pick one)        │ Tweak Panel     │
 *  │ sidebar  │ - thumbnail swatch                 │ - sliders       │
 *  │ (icons)  │ - title / subtitle / tags          │ - toggles       │
 *  │          │                                    │ - dropdowns     │
 *  │          │                                    │ - "Apply" btn   │
 *  │          │                                    │ - "Chat" btn    │
 *  ├──────────┴────────────────────────────────────┴──────────────────┤
 *  │  [Summary bar — active selections per category + total]          │
 *  └──────────────────────────────────────────────────────────────────┘
 *
 * Events:
 *  - presetApply    → preset config is committed, caller integrates into scene
 *  - openChat       → user wants to refine their preset with the vibe coder
 *  - back           → return to the main dashboard view
 */

import {
  Preset, PresetOption, PresetCategory,
  PRESET_CATEGORIES, getPresetsByCategory, getPresetById, ALL_PRESETS,
} from './VibePresets.js';

// ─── Event map ────────────────────────────────────────────────────────────────

export interface CreatorPageEvents {
  /** Preset applied with final config (after user tweaks). */
  presetApply: (preset: Preset, tweakedConfig: Record<string, unknown>) => void;
  /** User clicked "Refine with Vibe Coder" — inject prompt into chat. */
  openChat:    (prompt: string) => void;
  /** User clicked the back button. */
  back:        () => void;
}

// ─── VibeCreatorPage ──────────────────────────────────────────────────────────

export class VibeCreatorPage {
  readonly el: HTMLElement;

  private handlers:        Partial<CreatorPageEvents> = {};
  private activeCategory:  PresetCategory             = 'world';
  private selectedPreset:  Preset | null              = null;
  private tweakedValues:   Record<string, unknown>    = {};
  /** Tracks one chosen preset per category for the summary bar. */
  private selections:      Partial<Record<PresetCategory, Preset>> = {};

  // Cached DOM refs
  private cardGridEl!:    HTMLElement;
  private tweakPanelEl!:  HTMLElement;
  private summaryBarEl!:  HTMLElement;
  private categoryBtns:   Map<PresetCategory, HTMLElement> = new Map();
  private searchInput!:   HTMLInputElement;
  private filterTag:      string | null = null;

  constructor() {
    this.el = this.buildDOM();
    this.selectCategory('world');
  }

  // ── Public ──────────────────────────────────────────────────────────────────

  on<K extends keyof CreatorPageEvents>(event: K, handler: CreatorPageEvents[K]): this {
    this.handlers[event] = handler as any;
    return this;
  }

  /** Get all user selections (one preset per category). */
  getSelections(): Partial<Record<PresetCategory, { preset: Preset; config: Record<string, unknown> }>> {
    const out: Partial<Record<PresetCategory, { preset: Preset; config: Record<string, unknown> }>> = {};
    for (const [cat, preset] of Object.entries(this.selections) as [PresetCategory, Preset][]) {
      out[cat] = { preset, config: { ...preset.config } };
    }
    return out;
  }

  dispose(): void {
    this.el.remove();
  }

  // ── DOM Construction ───────────────────────────────────────────────────────

  private buildDOM(): HTMLElement {
    const el = document.createElement('div');
    el.id = 'vibe-creator';

    // ── Header ────────────────────────────────────────────────────────────
    const header = document.createElement('div');
    header.className = 'creator-header';

    const backBtn = document.createElement('button');
    backBtn.className = 'creator-back-btn';
    backBtn.innerHTML = '← Back';
    backBtn.addEventListener('click', () => this.handlers.back?.());

    const titleBlock = document.createElement('div');
    titleBlock.className = 'creator-title-block';
    titleBlock.innerHTML = `
      <div class="creator-title">Create Your Game</div>
      <div class="creator-subtitle">Pick presets, tweak settings, then refine with the Vibe Coder</div>
    `;

    header.appendChild(backBtn);
    header.appendChild(titleBlock);
    el.appendChild(header);

    // ── Category tabs (horizontal strip) ──────────────────────────────────
    const tabStrip = document.createElement('div');
    tabStrip.className = 'creator-tab-strip';

    for (const cat of PRESET_CATEGORIES) {
      const tab = document.createElement('button');
      tab.className = 'creator-tab';
      tab.dataset.cat = cat.id;
      tab.innerHTML = `<span class="tab-icon">${cat.icon}</span><span class="tab-label">${cat.label}</span>`;
      tab.title = cat.desc;
      tab.addEventListener('click', () => this.selectCategory(cat.id));
      tabStrip.appendChild(tab);
      this.categoryBtns.set(cat.id, tab);
    }

    el.appendChild(tabStrip);

    // ── Body (grid: cards + tweak panel) ──────────────────────────────────
    const body = document.createElement('div');
    body.className = 'creator-body';

    // ── Search / filter bar ──────────────────────────────────────────────
    const searchBar = document.createElement('div');
    searchBar.className = 'creator-search-bar';

    const searchInput = document.createElement('input');
    searchInput.className = 'creator-search-input';
    searchInput.type = 'text';
    searchInput.placeholder = '🔍 Search presets…';
    searchInput.addEventListener('input', () => this.renderCards());
    this.searchInput = searchInput;
    searchBar.appendChild(searchInput);

    body.appendChild(searchBar);

    // ── Card grid ────────────────────────────────────────────────────────
    const cardGrid = document.createElement('div');
    cardGrid.className = 'creator-card-grid';
    this.cardGridEl = cardGrid;
    body.appendChild(cardGrid);

    // ── Tweak panel (right) ──────────────────────────────────────────────
    const tweakPanel = document.createElement('div');
    tweakPanel.className = 'creator-tweak-panel';
    tweakPanel.innerHTML = `
      <div class="tweak-placeholder">
        <div style="font-size:28px; opacity:0.3; margin-bottom:8px;">◈</div>
        <div>Select a preset to customize</div>
      </div>
    `;
    this.tweakPanelEl = tweakPanel;
    body.appendChild(tweakPanel);

    el.appendChild(body);

    // ── Summary bar (bottom) ─────────────────────────────────────────────
    const summary = document.createElement('div');
    summary.className = 'creator-summary-bar';
    this.summaryBarEl = summary;
    el.appendChild(summary);
    this.renderSummary();

    return el;
  }

  // ── Category selection ─────────────────────────────────────────────────────

  private selectCategory(cat: PresetCategory): void {
    this.activeCategory = cat;
    this.filterTag = null;
    this.searchInput.value = '';

    // Update tab active state
    for (const [id, btn] of this.categoryBtns) {
      btn.classList.toggle('active', id === cat);
    }

    // If a preset was already selected in this category, restore it
    this.selectedPreset = this.selections[cat] ?? null;
    this.tweakedValues = this.selectedPreset
      ? this.buildDefaultValues(this.selectedPreset)
      : {};

    this.renderCards();
    this.renderTweakPanel();
  }

  // ── Card grid rendering ────────────────────────────────────────────────────

  private renderCards(): void {
    this.cardGridEl.innerHTML = '';

    let presets = getPresetsByCategory(this.activeCategory);

    // Search filter
    const query = this.searchInput.value.trim().toLowerCase();
    if (query) {
      presets = presets.filter(p =>
        p.title.toLowerCase().includes(query) ||
        p.subtitle.toLowerCase().includes(query) ||
        p.tags.some(t => t.toLowerCase().includes(query))
      );
    }

    // Tag filter
    if (this.filterTag) {
      const ft = this.filterTag;
      presets = presets.filter(p => p.tags.includes(ft));
    }

    for (const preset of presets) {
      const card = this.buildPresetCard(preset);
      this.cardGridEl.appendChild(card);
    }

    if (presets.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'card-grid-empty';
      empty.textContent = 'No presets match your search.';
      this.cardGridEl.appendChild(empty);
    }
  }

  private buildPresetCard(preset: Preset): HTMLElement {
    const card = document.createElement('div');
    card.className = 'creator-card';
    if (this.selectedPreset?.id === preset.id) {
      card.classList.add('selected');
    }

    // Thumbnail swatch
    const thumb = document.createElement('div');
    thumb.className = 'card-thumb';
    thumb.style.background = preset.thumbGrad;
    thumb.innerHTML = `<span class="card-thumb-icon">${preset.icon}</span>`;

    // Info
    const info = document.createElement('div');
    info.className = 'card-info';

    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = preset.title;

    const sub = document.createElement('div');
    sub.className = 'card-sub';
    sub.textContent = preset.subtitle;

    // Tags
    const tagWrap = document.createElement('div');
    tagWrap.className = 'card-tags';
    for (const t of preset.tags) {
      const chip = document.createElement('span');
      chip.className = 'card-tag';
      chip.textContent = t;
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        this.filterTag = this.filterTag === t ? null : t;
        this.renderCards();
      });
      tagWrap.appendChild(chip);
    }

    info.appendChild(title);
    info.appendChild(sub);
    info.appendChild(tagWrap);
    card.appendChild(thumb);
    card.appendChild(info);

    card.addEventListener('click', () => this.onCardSelect(preset));
    return card;
  }

  private onCardSelect(preset: Preset): void {
    this.selectedPreset = preset;
    this.tweakedValues = this.buildDefaultValues(preset);
    this.renderCards();
    this.renderTweakPanel();
  }

  // ── Tweak panel rendering ──────────────────────────────────────────────────

  private renderTweakPanel(): void {
    const panel = this.tweakPanelEl;
    panel.innerHTML = '';

    if (!this.selectedPreset) {
      panel.innerHTML = `
        <div class="tweak-placeholder">
          <div style="font-size:28px; opacity:0.3; margin-bottom:8px;">◈</div>
          <div>Select a preset to customize</div>
        </div>
      `;
      return;
    }

    const preset = this.selectedPreset;

    // ── Header ──────────────────────────────────────────────────────────
    const header = document.createElement('div');
    header.className = 'tweak-header';
    header.innerHTML = `
      <div class="tweak-icon" style="background:${preset.thumbGrad};">${preset.icon}</div>
      <div>
        <div class="tweak-title">${preset.title}</div>
        <div class="tweak-sub">${preset.subtitle}</div>
      </div>
    `;
    panel.appendChild(header);

    // ── Options ─────────────────────────────────────────────────────────
    const optionsList = document.createElement('div');
    optionsList.className = 'tweak-options';

    for (const opt of preset.options) {
      const row = this.buildOptionRow(opt);
      optionsList.appendChild(row);
    }

    panel.appendChild(optionsList);

    // ── Actions ─────────────────────────────────────────────────────────
    const actions = document.createElement('div');
    actions.className = 'tweak-actions';

    const applyBtn = document.createElement('button');
    applyBtn.className = 'tweak-btn apply';
    applyBtn.innerHTML = '✓ Apply Preset';
    applyBtn.addEventListener('click', () => this.applyPreset());

    const chatBtn = document.createElement('button');
    chatBtn.className = 'tweak-btn chat';
    chatBtn.innerHTML = '✦ Refine with Vibe Coder';
    chatBtn.addEventListener('click', () => {
      if (this.selectedPreset) {
        this.handlers.openChat?.(this.selectedPreset.prompt);
      }
    });

    actions.appendChild(applyBtn);
    actions.appendChild(chatBtn);
    panel.appendChild(actions);
  }

  private buildOptionRow(opt: PresetOption): HTMLElement {
    const row = document.createElement('div');
    row.className = 'tweak-option-row';

    const label = document.createElement('label');
    label.className = 'tweak-option-label';
    label.textContent = opt.label;

    const control = document.createElement('div');
    control.className = 'tweak-option-control';

    switch (opt.type) {
      case 'select': {
        const sel = document.createElement('select');
        sel.className = 'tweak-select';
        for (let i = 0; i < (opt.choices?.length ?? 0); i++) {
          const o = document.createElement('option');
          o.value = String(i);
          o.textContent = opt.choices![i];
          if (i === (this.tweakedValues[opt.key] ?? opt.default)) o.selected = true;
          sel.appendChild(o);
        }
        sel.addEventListener('change', () => {
          this.tweakedValues[opt.key] = parseInt(sel.value, 10);
        });
        control.appendChild(sel);
        break;
      }
      case 'slider': {
        const [min, max, step] = opt.range!;
        const val = this.tweakedValues[opt.key] as number ?? opt.default as number;

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'tweak-slider';
        slider.min = String(min);
        slider.max = String(max);
        slider.step = String(step);
        slider.value = String(val);

        const valEl = document.createElement('span');
        valEl.className = 'tweak-slider-val';
        valEl.textContent = String(val);

        slider.addEventListener('input', () => {
          const v = parseFloat(slider.value);
          this.tweakedValues[opt.key] = v;
          valEl.textContent = String(v);
        });

        control.appendChild(slider);
        control.appendChild(valEl);
        break;
      }
      case 'toggle': {
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'tweak-toggle';
        cb.checked = (this.tweakedValues[opt.key] ?? opt.default) as boolean;
        cb.addEventListener('change', () => {
          this.tweakedValues[opt.key] = cb.checked;
        });
        control.appendChild(cb);
        break;
      }
      case 'color': {
        const color = document.createElement('input');
        color.type = 'color';
        color.className = 'tweak-color';
        color.value = (this.tweakedValues[opt.key] ?? opt.default) as string;
        color.addEventListener('input', () => {
          this.tweakedValues[opt.key] = color.value;
        });
        control.appendChild(color);
        break;
      }
    }

    row.appendChild(label);
    row.appendChild(control);
    return row;
  }

  // ── Apply ──────────────────────────────────────────────────────────────────

  private applyPreset(): void {
    if (!this.selectedPreset) return;

    // Merge tweaked values into preset config
    const finalConfig = { ...this.selectedPreset.config, ...this.tweakedValues };

    // Store selection
    this.selections[this.activeCategory] = this.selectedPreset;

    this.handlers.presetApply?.(this.selectedPreset, finalConfig);
    this.renderSummary();
    this.renderCards(); // update selected state
  }

  // ── Summary bar ────────────────────────────────────────────────────────────

  private renderSummary(): void {
    this.summaryBarEl.innerHTML = '';

    const label = document.createElement('span');
    label.className = 'summary-label';
    label.textContent = 'Build: ';

    this.summaryBarEl.appendChild(label);

    let count = 0;
    for (const cat of PRESET_CATEGORIES) {
      const preset = this.selections[cat.id];
      const chip = document.createElement('span');
      chip.className = `summary-chip${preset ? ' active' : ''}`;
      chip.innerHTML = preset
        ? `<span class="summary-chip-icon">${preset.icon}</span> ${preset.title}`
        : `<span class="summary-chip-icon">${cat.icon}</span> ${cat.label}`;
      chip.addEventListener('click', () => this.selectCategory(cat.id));
      this.summaryBarEl.appendChild(chip);
      if (preset) count++;
    }

    const counter = document.createElement('span');
    counter.className = 'summary-counter';
    counter.textContent = `${count} / ${PRESET_CATEGORIES.length} set`;
    this.summaryBarEl.appendChild(counter);

    // ── "Start Building" button (only if at least one selected) ──
    if (count > 0) {
      const startBtn = document.createElement('button');
      startBtn.className = 'summary-start-btn';
      startBtn.innerHTML = '▶ Start Building';
      startBtn.addEventListener('click', () => {
        // Build a combined prompt from all selections
        const lines: string[] = [];
        for (const cat of PRESET_CATEGORIES) {
          const p = this.selections[cat.id];
          if (p) lines.push(`• ${cat.label}: ${p.title}`);
        }
        const combinedPrompt = `I've selected these presets:\n${lines.join('\n')}\n\nHelp me wire everything together into a playable starting point. Set up the scene, player controller, and basic game loop.`;
        this.handlers.openChat?.(combinedPrompt);
      });
      this.summaryBarEl.appendChild(startBtn);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private buildDefaultValues(preset: Preset): Record<string, unknown> {
    const vals: Record<string, unknown> = {};
    for (const opt of preset.options) {
      vals[opt.key] = opt.default;
    }
    return vals;
  }
}
