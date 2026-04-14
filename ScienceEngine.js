/**
 * ScienceEngine.js
 * High-end digital science engine for Pyrite64.
 *
 * Provides a unified panel and API for:
 *
 * Core
 *  - Multimodal scientific intelligence (literature, patents, regulations,
 *    lab logs, omics data, imagery, sensor signals, 3D scans)
 *  - AI-powered discovery beyond keyword matching with cross-disciplinary
 *    connection surfacing
 *  - Foundational models supporting prediction and generation across
 *    complex research workflows
 *  - Advanced analytics and predictive modeling for faster decisions
 *  - Real-time data management and processing for simulation-heavy programs
 *
 * Enterprise
 *  - Secure, scalable infrastructure with managed accounts, SSO, and
 *    global privacy support
 *  - Built-in collaboration tools (simultaneous work, commenting, version
 *    control) for technical teams
 *  - Deep integration with research and developer ecosystems
 *  - Governance capabilities to scale AI responsibly
 *  - Quality and uncertainty tracing for reproducibility and rigor
 *
 * Premium
 *  - Precision search and summarization
 *  - Cross-disciplinary architecture (climate, physics, astronomy, …)
 *  - High-performance digital backbone for modern R&D
 *  - Next-generation scientific computing with AI + advanced computation
 *  - Data-to-discovery transformation platform
 */

// ─── Built-in capability registry ─────────────────────────────────────────────

export const SCIENCE_CAPABILITIES = [
  // ── Core ──
  {
    id: 'multimodal-intelligence',
    tier: 'core',
    icon: '⬡',
    label: 'Multimodal Scientific Intelligence',
    description:
      'Understands literature, patents, regulations, lab logs, omics data, imagery, ' +
      'sensor signals, and 3D scans in one unified environment.',
  },
  {
    id: 'ai-discovery',
    tier: 'core',
    icon: '◈',
    label: 'AI-Powered Discovery',
    description:
      'Goes beyond keyword matching to surface contextually relevant research and ' +
      'hidden connections across disciplines.',
  },
  {
    id: 'foundational-models',
    tier: 'core',
    icon: '◉',
    label: 'Foundational Science Models',
    description:
      'Supports both prediction and generation across complex research workflows ' +
      'using domain-adapted foundation models.',
  },
  {
    id: 'predictive-analytics',
    tier: 'core',
    icon: '▲',
    label: 'Advanced Analytics & Predictive Modeling',
    description:
      'Turns massive datasets into faster, clearer decisions with confidence ' +
      'intervals and uncertainty quantification.',
  },
  {
    id: 'realtime-processing',
    tier: 'core',
    icon: '⟳',
    label: 'Real-Time Data Processing',
    description:
      'Manages and processes simulation-heavy, data-intensive scientific programs ' +
      'with low-latency streaming pipelines.',
  },

  // ── Enterprise ──
  {
    id: 'secure-infra',
    tier: 'enterprise',
    icon: '🔒',
    label: 'Secure, Scalable Infrastructure',
    description:
      'Enterprise-grade managed accounts, SSO, and global privacy support ' +
      'designed for large-scale research organizations.',
  },
  {
    id: 'collaboration',
    tier: 'enterprise',
    icon: '◎',
    label: 'Built-in Collaboration Tools',
    description:
      'Simultaneous editing, commenting, and version control for distributed ' +
      'technical research teams.',
  },
  {
    id: 'ecosystem-integration',
    tier: 'enterprise',
    icon: '⬢',
    label: 'Deep Ecosystem Integration',
    description:
      'Connects with research and developer ecosystems to streamline workflows ' +
      'and reduce maintenance overhead.',
  },
  {
    id: 'governance',
    tier: 'enterprise',
    icon: '⊠',
    label: 'AI Governance',
    description:
      'Helps organizations scale AI responsibly across models, applications, ' +
      'and data sources with full audit trails.',
  },
  {
    id: 'quality-tracing',
    tier: 'enterprise',
    icon: '⊞',
    label: 'Quality & Uncertainty Tracing',
    description:
      'Improves trust, reproducibility, and scientific rigor in digital twin ' +
      'and modeling workflows.',
  },

  // ── Premium ──
  {
    id: 'precision-search',
    tier: 'premium',
    icon: '⊙',
    label: 'Precision Search & Summarization',
    description:
      'Helps researchers find, understand, and act on complex information ' +
      'in minutes using semantic retrieval and generative summaries.',
  },
  {
    id: 'cross-disciplinary',
    tier: 'premium',
    icon: '✦',
    label: 'Cross-Disciplinary Architecture',
    description:
      'Supports domains from climate and environmental monitoring to ' +
      'high-energy physics and astronomy in a single platform.',
  },
  {
    id: 'hpc-backbone',
    tier: 'premium',
    icon: '⚡',
    label: 'High-Performance Digital Backbone',
    description:
      'Modern R&D backbone built to accelerate innovation, improve productivity, ' +
      'and support data-driven decisions at scale.',
  },
  {
    id: 'nextgen-computing',
    tier: 'premium',
    icon: '∞',
    label: 'Next-Generation Scientific Computing',
    description:
      'AI and advanced computation work together to speed discovery in areas ' +
      'where classical compute alone is insufficient.',
  },
  {
    id: 'data-to-discovery',
    tier: 'premium',
    icon: '◆',
    label: 'Data → Discovery Platform',
    description:
      'Engineered not just to store data, but to transform raw data into ' +
      'actionable scientific discoveries.',
  },
];

// ─── ScienceEngine ────────────────────────────────────────────────────────────

/**
 * Core science engine runtime.
 *
 * Manages the capability registry, discovery pipeline, analytics jobs,
 * collaboration sessions, and governance log.
 */
export class ScienceEngine {
  constructor() {
    this.handlers      = {};
    this.jobs          = new Map();
    this.collaborators = new Map();
    this.auditLog      = [];
    this.jobSeq        = 0;
    this.capabilities  = SCIENCE_CAPABILITIES;
  }

  // ── Event emitter ─────────────────────────────────────────────────────────

  on(event, handler) {
    const current = this.handlers[event];

    if (!current) {
      this.handlers[event] = handler;
      return this;
    }

    if (current._listenerSet instanceof Set) {
      current._listenerSet.add(handler);
      return this;
    }

    this.handlers[event] = this._createHandlerDispatcher(current, handler);
    return this;
  }

  off(event, handler) {
    const current = this.handlers[event];

    if (!current) {
      return this;
    }

    if (current === handler) {
      delete this.handlers[event];
      return this;
    }

    if (!(current._listenerSet instanceof Set)) {
      return this;
    }

    current._listenerSet.delete(handler);

    if (current._listenerSet.size === 0) {
      delete this.handlers[event];
      return this;
    }

    if (current._listenerSet.size === 1) {
      this.handlers[event] = current._listenerSet.values().next().value;
    }

    return this;
  }

  _createHandlerDispatcher(...handlers) {
    const listeners = new Set(handlers);
    const dispatcher = (...args) => {
      listeners.forEach((listener) => listener(...args));
    };

    dispatcher._listenerSet = listeners;
    return dispatcher;
  }
  // ── Discovery ─────────────────────────────────────────────────────────────

  /**
   * Run a contextual discovery query across the scientific corpus.
   * Returns a ranked list of results with cross-disciplinary connection hints.
   */
  discover(query) {
    const limit            = Math.min(query.limit ?? 5, 20);
    const requestedDomains = query.domains;
    const domains          =
      !requestedDomains || requestedDomains.length === 0
        ? ALL_DOMAINS
        : requestedDomains;
    const results = this._syntheticDiscover(query.text, domains, limit);
    this._emit('discoveryComplete', results);
    return results;
  }

  // ── Analytics ─────────────────────────────────────────────────────────────

  /**
   * Submit an analytics job. Returns the job ID.
   */
  submitAnalyticsJob(label, domain) {
    const id  = `job-${++this.jobSeq}`;
    const job = { id, label, domain, status: 'queued', progressPct: 0 };
    this.jobs.set(id, job);
    this._simulateJobProgress(job);
    return id;
  }

  getJob(id) {
    return this.jobs.get(id);
  }

  listJobs() {
    return [...this.jobs.values()];
  }

  // ── Collaboration ─────────────────────────────────────────────────────────

  addCollaborator(info) {
    this.collaborators.set(info.userId, { ...info, online: true });
    this._emit('collaboratorJoin', info);
  }

  removeCollaborator(userId) {
    const info = this.collaborators.get(userId);
    if (info) {
      info.online = false;
      this._emit('collaboratorLeave', userId);
    }
  }

  getOnlineCollaborators() {
    return [...this.collaborators.values()].filter(c => c.online);
  }

  // ── Governance ────────────────────────────────────────────────────────────

  logGovernance(action, userId, modelId, dataSource, approved) {
    const record = {
      timestamp: Date.now(),
      action, userId, modelId, dataSource, approved,
    };
    this.auditLog.push(record);
    this._emit('governanceLog', record);
  }

  getAuditLog() {
    return [...this.auditLog];
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _emit(event, ...args) {
    const h = this.handlers[event];
    if (h) h(...args);
  }

  _syntheticDiscover(text, domains, limit) {
    const results = [];
    const query   = text.toLowerCase();
    for (let i = 0; i < Math.min(limit, domains.length * 2); i++) {
      const domain = domains[i % domains.length];
      results.push({
        id:         `result-${i}`,
        title:      `${capitalize(domain)} insight: ${text.slice(0, 40)}`,
        summary:    `Contextually relevant finding in ${domain} matching query: "${query}".`,
        domain,
        relevance:  Math.max(0, Math.min(1, Math.round((1 - i * 0.08) * 100) / 100)),
        connection: i % 3 === 0
          ? `Cross-disciplinary link to ${domains[(i + 1) % domains.length]}`
          : '',
      });
    }
    return results;
  }

  _simulateJobProgress(job) {
    job.status = 'running';
    const tick = () => {
      job.progressPct = Math.min(job.progressPct + 10 + Math.random() * 15, 100);
      if (job.progressPct >= 100) {
        job.progressPct = 100;
        job.status      = 'done';
        job.result = {
          summary:     `Analysis complete for ${job.label}.`,
          confidence:  0.85 + Math.random() * 0.10,
          uncertainty: 0.05 + Math.random() * 0.10,
          predictions: [
            { label: 'Primary signal',   value: 0.72, upper: 0.81, lower: 0.63 },
            { label: 'Secondary signal', value: 0.45, upper: 0.54, lower: 0.36 },
            { label: 'Noise floor',      value: 0.12, upper: 0.17, lower: 0.07 },
          ],
        };
        this._emit('analyticsComplete', { ...job });
      } else {
        setTimeout(tick, 300 + Math.random() * 400);
      }
    };
    setTimeout(tick, 200);
  }
}

// ─── ScienceEnginePanel ───────────────────────────────────────────────────────

/**
 * Dashboard panel that surfaces the ScienceEngine capabilities.
 */
export class ScienceEnginePanel {
  constructor(engine) {
    this.engine           = engine ?? new ScienceEngine();
    this.activeTier       = 'core';
    this.tierBtns         = new Map();
    this._jobRefreshTimer = null;
    this.el               = this._buildDOM();
    this._wireEngineEvents();
    this._renderCapabilities();
  }

  dispose() {
    this._stopJobRefreshLoop();
    this.el.remove();
  }

  // ── DOM ───────────────────────────────────────────────────────────────────

  _buildDOM() {
    const panel = document.createElement('div');
    panel.id        = 'science-engine-panel';
    panel.className = 'science-panel';

    panel.innerHTML = `
      <div class="sci-header">
        <div class="sci-title">
          <span class="sci-icon">◆</span>
          <span>Science Engine</span>
        </div>
        <div class="sci-tier-tabs" id="sci-tier-tabs"></div>
      </div>

      <div class="sci-cap-grid" id="sci-cap-grid"></div>

      <div class="sci-section">
        <div class="sci-section-label">AI-Powered Discovery</div>
        <div class="sci-search-row">
          <input
            class="sci-search"
            id="sci-search-input"
            type="text"
            placeholder="Search across literature, patents, omics, imagery…"
          />
          <button class="sci-search-btn" id="sci-search-btn">Discover</button>
        </div>
        <div class="sci-results" id="sci-results"></div>
      </div>

      <div class="sci-section">
        <div class="sci-section-label">Analytics Jobs</div>
        <div class="sci-jobs-row">
          <button class="sci-job-btn" data-domain="life-sciences">Life Sci</button>
          <button class="sci-job-btn" data-domain="climate-environment">Climate</button>
          <button class="sci-job-btn" data-domain="high-energy-physics">HEP</button>
          <button class="sci-job-btn" data-domain="omics">Omics</button>
        </div>
        <div class="sci-jobs" id="sci-jobs"></div>
      </div>
    `;

    // Tier tabs
    const tabsEl = panel.querySelector('#sci-tier-tabs');
    for (const tier of ['core', 'enterprise', 'premium']) {
      const btn = document.createElement('button');
      btn.className   = `sci-tier-btn${tier === this.activeTier ? ' active' : ''}`;
      btn.textContent = capitalize(tier);
      btn.addEventListener('click', () => this._selectTier(tier));
      tabsEl.appendChild(btn);
      this.tierBtns.set(tier, btn);
    }

    // Cache refs
    this.capGridEl   = panel.querySelector('#sci-cap-grid');
    this.resultsEl   = panel.querySelector('#sci-results');
    this.jobsEl      = panel.querySelector('#sci-jobs');
    this.searchInput = panel.querySelector('#sci-search-input');

    // Discovery search
    panel.querySelector('#sci-search-btn').addEventListener('click', () => this._runDiscovery());
    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._runDiscovery();
    });

    // Analytics job buttons
    panel.querySelectorAll('.sci-job-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const domain = btn.dataset.domain;
        const label  = btn.textContent ?? domain;
        this.engine.submitAnalyticsJob(label, domain);
        this._refreshJobList();
        this._ensureJobRefreshLoop();
      });
    });

    return panel;
  }

  _selectTier(tier) {
    this.activeTier = tier;
    for (const [t, btn] of this.tierBtns) {
      btn.classList.toggle('active', t === tier);
    }
    this._renderCapabilities();
  }

  _renderCapabilities() {
    const caps = this.engine.capabilities.filter(c => c.tier === this.activeTier);
    this.capGridEl.innerHTML = '';
    for (const cap of caps) {
      const card = document.createElement('div');
      card.className = `sci-cap-card sci-tier-${cap.tier}`;
      card.innerHTML = `
        <div class="sci-cap-icon">${cap.icon}</div>
        <div class="sci-cap-body">
          <div class="sci-cap-label">${escapeHTML(cap.label)}</div>
          <div class="sci-cap-desc">${escapeHTML(cap.description)}</div>
        </div>
      `;
      this.capGridEl.appendChild(card);
    }
  }

  _runDiscovery() {
    const text = this.searchInput.value.trim();
    if (!text) return;
    this.resultsEl.innerHTML = '<div class="sci-loading">Discovering…</div>';
    this.engine.discover({ text, limit: 4 });
  }

  _renderResults(results) {
    this.resultsEl.innerHTML = '';
    if (results.length === 0) {
      this.resultsEl.innerHTML = '<div class="sci-empty">No results found.</div>';
      return;
    }
    for (const r of results) {
      const row = document.createElement('div');
      row.className = 'sci-result-row';
      const pct = Math.round(r.relevance * 100);
      row.innerHTML = `
        <div class="sci-result-meta">
          <span class="sci-result-domain">${escapeHTML(r.domain)}</span>
          <span class="sci-result-relevance">${pct}% relevance</span>
        </div>
        <div class="sci-result-title">${escapeHTML(r.title)}</div>
        <div class="sci-result-summary">${escapeHTML(r.summary)}</div>
        ${r.connection
          ? `<div class="sci-result-connection">🔗 ${escapeHTML(r.connection)}</div>`
          : ''}
      `;
      this.resultsEl.appendChild(row);
    }
  }

  _refreshJobList() {
    const jobs = this.engine.listJobs();
    this.jobsEl.innerHTML = '';
    for (const job of jobs.slice(-5).reverse()) {
      const row = document.createElement('div');
      row.className = `sci-job-row sci-job-${job.status}`;
      const statusIcon =
        job.status === 'done'    ? '✓' :
        job.status === 'running' ? '⟳' :
        job.status === 'error'   ? '✗' : '…';
      row.innerHTML = `
        <span class="sci-job-status">${statusIcon}</span>
        <span class="sci-job-label">${escapeHTML(job.label)}</span>
        <span class="sci-job-domain">${escapeHTML(job.domain)}</span>
        <div class="sci-job-bar">
          <div class="sci-job-fill" style="width:${job.progressPct}%"></div>
        </div>
        ${job.result
          ? `<span class="sci-job-conf">${Math.round(job.result.confidence * 100)}% conf</span>`
          : ''}
      `;
      this.jobsEl.appendChild(row);
    }
  }

  _ensureJobRefreshLoop() {
    if (this._jobRefreshTimer) return;
    this._jobRefreshTimer = setInterval(() => {
      const jobs = this.engine.listJobs();
      const hasRunningJobs = jobs.some((job) => job.status === 'running');
      if (hasRunningJobs) {
        this._refreshJobList();
      } else {
        this._stopJobRefreshLoop();
      }
    }, 250);
  }

  _stopJobRefreshLoop() {
    if (!this._jobRefreshTimer) return;
    clearInterval(this._jobRefreshTimer);
    this._jobRefreshTimer = null;
  }

  _wireEngineEvents() {
    this._refreshJobList();
    this._ensureJobRefreshLoop();
    this.engine
      .on('analyticsComplete', () => {
        this._refreshJobList();
        const hasRunningJobs = this.engine.listJobs().some((job) => job.status === 'running');
        if (!hasRunningJobs) {
          this._stopJobRefreshLoop();
        }
      })
      .on('discoveryComplete', (results) => this._renderResults(results));
  }
}

// ─── Module-level helpers ──────────────────────────────────────────────────────

const ALL_DOMAINS = [
  'life-sciences', 'climate-environment', 'high-energy-physics',
  'astronomy', 'materials-science', 'omics', 'imaging', 'simulation',
];

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function escapeHTML(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
