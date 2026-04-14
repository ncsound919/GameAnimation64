/**
 * ScienceEngine.ts
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

// ─── Capability tiers ──────────────────────────────────────────────────────────

export type CapabilityTier = 'core' | 'enterprise' | 'premium';

export interface ScienceCapability {
  id:          string;
  tier:        CapabilityTier;
  label:       string;
  description: string;
  /** Icon glyph rendered inside each capability card. */
  icon:        string;
}

// ─── Scientific domain ─────────────────────────────────────────────────────────

export type ScientificDomain =
  | 'life-sciences'
  | 'climate-environment'
  | 'high-energy-physics'
  | 'astronomy'
  | 'materials-science'
  | 'omics'
  | 'imaging'
  | 'simulation';

// ─── Discovery query / result ──────────────────────────────────────────────────

export interface DiscoveryQuery {
  /** Natural-language query or topic. */
  text:     string;
  /** Restrict to these domains; empty = all. */
  domains?: ScientificDomain[];
  /** Maximum number of results to return. */
  limit?:   number;
}

export interface DiscoveryResult {
  id:         string;
  title:      string;
  summary:    string;
  domain:     ScientificDomain;
  relevance:  number;   // 0–1
  /** Cross-disciplinary connection hint (empty string = none). */
  connection: string;
}

// ─── Analytics job ────────────────────────────────────────────────────────────

export interface AnalyticsJob {
  id:         string;
  label:      string;
  domain:     ScientificDomain;
  status:     'queued' | 'running' | 'done' | 'error';
  progressPct: number;  // 0–100
  result?:    AnalyticsResult;
}

export interface AnalyticsResult {
  summary:     string;
  confidence:  number;   // 0–1
  predictions: PredictionPoint[];
  uncertainty: number;   // 0–1; lower = more certain
}

export interface PredictionPoint {
  label: string;
  value: number;
  upper: number;  // confidence upper bound
  lower: number;  // confidence lower bound
}

// ─── Collaboration session ─────────────────────────────────────────────────────

export interface CollaboratorInfo {
  userId:    string;
  displayName: string;
  /** CSS color for cursor/avatar. */
  color:     string;
  online:    boolean;
}

// ─── Governance record ─────────────────────────────────────────────────────────

export interface GovernanceRecord {
  timestamp:   number;
  action:      string;
  userId:      string;
  modelId:     string;
  dataSource:  string;
  approved:    boolean;
}

// ─── Science engine events ────────────────────────────────────────────────────

export interface ScienceEngineEvents {
  discoveryComplete: (results: DiscoveryResult[]) => void;
  analyticsComplete: (job: AnalyticsJob)           => void;
  collaboratorJoin:  (info: CollaboratorInfo)       => void;
  collaboratorLeave: (userId: string)               => void;
  governanceLog:     (record: GovernanceRecord)     => void;
}

// ─── Built-in capability registry ─────────────────────────────────────────────

export const SCIENCE_CAPABILITIES: ScienceCapability[] = [
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
  private handlers:     Partial<ScienceEngineEvents> = {};
  private jobs:         Map<string, AnalyticsJob>    = new Map();
  private collaborators:Map<string, CollaboratorInfo>= new Map();
  private auditLog:     GovernanceRecord[]           = [];
  private jobSeq:       number                       = 0;

  /** All registered capabilities. */
  readonly capabilities: ScienceCapability[] = SCIENCE_CAPABILITIES;

  // ── Event emitter ─────────────────────────────────────────────────────────

  on<K extends keyof ScienceEngineEvents>(
    event: K,
    handler: ScienceEngineEvents[K],
  ): this {
    this.handlers[event] = handler as ScienceEngineEvents[K];
    return this;
  }

  // ── Discovery ─────────────────────────────────────────────────────────────

  /**
   * Run a contextual discovery query across the scientific corpus.
   * Returns a ranked list of results with cross-disciplinary connection hints.
   *
   * In production this delegates to a vector search + LLM re-ranking service.
   * The stub implementation returns synthetic results for UI development.
   */
  discover(query: DiscoveryQuery): DiscoveryResult[] {
    const limit   = Math.min(query.limit ?? 5, 20);
    const domains = query.domains ?? ALL_DOMAINS;
    const results = this.syntheticDiscover(query.text, domains, limit);
    this.emit('discoveryComplete', results);
    return results;
  }

  // ── Analytics ─────────────────────────────────────────────────────────────

  /**
   * Submit an analytics job. Returns the job ID.
   * Progress is simulated asynchronously; real implementations send to a
   * remote compute cluster and poll for completion.
   */
  submitAnalyticsJob(label: string, domain: ScientificDomain): string {
    const id = `job-${++this.jobSeq}`;
    const job: AnalyticsJob = {
      id, label, domain,
      status: 'queued',
      progressPct: 0,
    };
    this.jobs.set(id, job);
    this.simulateJobProgress(job);
    return id;
  }

  /** Get a job by ID. */
  getJob(id: string): AnalyticsJob | undefined {
    return this.jobs.get(id);
  }

  /** List all jobs. */
  listJobs(): AnalyticsJob[] {
    return [...this.jobs.values()];
  }

  // ── Collaboration ─────────────────────────────────────────────────────────

  /** Register a collaborator as online. */
  addCollaborator(info: CollaboratorInfo): void {
    this.collaborators.set(info.userId, { ...info, online: true });
    this.emit('collaboratorJoin', info);
  }

  /** Mark a collaborator as offline. */
  removeCollaborator(userId: string): void {
    const info = this.collaborators.get(userId);
    if (info) {
      info.online = false;
      this.emit('collaboratorLeave', userId);
    }
  }

  /** Get all active (online) collaborators. */
  getOnlineCollaborators(): CollaboratorInfo[] {
    return [...this.collaborators.values()].filter(c => c.online);
  }

  // ── Governance ────────────────────────────────────────────────────────────

  /** Log an AI action for governance and auditability. */
  logGovernance(
    action:     string,
    userId:     string,
    modelId:    string,
    dataSource: string,
    approved:   boolean,
  ): void {
    const record: GovernanceRecord = {
      timestamp: Date.now(),
      action, userId, modelId, dataSource, approved,
    };
    this.auditLog.push(record);
    this.emit('governanceLog', record);
  }

  /** Return the full governance audit trail. */
  getAuditLog(): GovernanceRecord[] {
    return [...this.auditLog];
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private emit<K extends keyof ScienceEngineEvents>(
    event: K,
    ...args: Parameters<ScienceEngineEvents[K]>
  ): void {
    const h = this.handlers[event];
    if (h) (h as (...a: unknown[]) => void)(...args);
  }

  /** Synthetic discovery implementation for UI/dev purposes. */
  private syntheticDiscover(
    text: string,
    domains: ScientificDomain[],
    limit: number,
  ): DiscoveryResult[] {
    const results: DiscoveryResult[] = [];
    const query = text.toLowerCase();
    for (let i = 0; i < Math.min(limit, domains.length * 2); i++) {
      const domain = domains[i % domains.length];
      results.push({
        id:         `result-${i}`,
        title:      `${capitalize(domain)} insight: ${text.slice(0, 40)}`,
        summary:    `Contextually relevant finding in ${domain} matching query: "${query}".`,
        domain,
        relevance:  Math.round((1 - i * 0.08) * 100) / 100,
        connection: i % 3 === 0
          ? `Cross-disciplinary link to ${domains[(i + 1) % domains.length]}`
          : '',
      });
    }
    return results;
  }

  /** Simulate asynchronous job progress (real impl polls a compute backend). */
  private simulateJobProgress(job: AnalyticsJob): void {
    job.status = 'running';
    const tick = (): void => {
      job.progressPct = Math.min(job.progressPct + 10 + Math.random() * 15, 100);
      if (job.progressPct >= 100) {
        job.progressPct = 100;
        job.status = 'done';
        job.result = {
          summary:    `Analysis complete for ${job.label}.`,
          confidence: 0.85 + Math.random() * 0.10,
          uncertainty: 0.05 + Math.random() * 0.10,
          predictions: [
            { label: 'Primary signal',   value: 0.72, upper: 0.81, lower: 0.63 },
            { label: 'Secondary signal', value: 0.45, upper: 0.54, lower: 0.36 },
            { label: 'Noise floor',      value: 0.12, upper: 0.17, lower: 0.07 },
          ],
        };
        this.emit('analyticsComplete', { ...job });
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
 *
 * Layout:
 *  ┌─────────────────────────────────────────────────────┐
 *  │  [Tier tabs: Core · Enterprise · Premium]           │
 *  ├─────────────────────────────────────────────────────┤
 *  │  Capability cards (icon · label · description)      │
 *  ├─────────────────────────────────────────────────────┤
 *  │  Discovery search bar + results list               │
 *  ├─────────────────────────────────────────────────────┤
 *  │  Analytics jobs progress list                       │
 *  └─────────────────────────────────────────────────────┘
 */
export class ScienceEnginePanel {
  readonly el:     HTMLElement;
  readonly engine: ScienceEngine;

  private activeTier:   CapabilityTier = 'core';
  private tierBtns:     Map<CapabilityTier, HTMLElement> = new Map();
  private capGridEl!:   HTMLElement;
  private resultsEl!:   HTMLElement;
  private jobsEl!:      HTMLElement;
  private searchInput!: HTMLInputElement;

  constructor(engine?: ScienceEngine) {
    this.engine = engine ?? new ScienceEngine();
    this.el     = this.buildDOM();
    this.wireEngineEvents();
    this.renderCapabilities();
  }

  // ── Public ────────────────────────────────────────────────────────────────

  dispose(): void {
    this.el.remove();
  }

  // ── DOM ───────────────────────────────────────────────────────────────────

  private buildDOM(): HTMLElement {
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
    const tabsEl = panel.querySelector<HTMLElement>('#sci-tier-tabs')!;
    const tiers: CapabilityTier[] = ['core', 'enterprise', 'premium'];
    for (const tier of tiers) {
      const btn = document.createElement('button');
      btn.className = `sci-tier-btn${tier === this.activeTier ? ' active' : ''}`;
      btn.textContent = capitalize(tier);
      btn.addEventListener('click', () => this.selectTier(tier));
      tabsEl.appendChild(btn);
      this.tierBtns.set(tier, btn);
    }

    // Cache refs
    this.capGridEl   = panel.querySelector('#sci-cap-grid')!;
    this.resultsEl   = panel.querySelector('#sci-results')!;
    this.jobsEl      = panel.querySelector('#sci-jobs')!;
    this.searchInput = panel.querySelector<HTMLInputElement>('#sci-search-input')!;

    // Discovery search
    panel.querySelector('#sci-search-btn')!.addEventListener('click', () => this.runDiscovery());
    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.runDiscovery();
    });

    // Analytics job buttons
    panel.querySelectorAll<HTMLButtonElement>('.sci-job-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const domain = btn.dataset.domain as ScientificDomain;
        const label  = btn.textContent ?? domain;
        this.engine.submitAnalyticsJob(label, domain);
        this.refreshJobList();
      });
    });

    return panel;
  }

  private selectTier(tier: CapabilityTier): void {
    this.activeTier = tier;
    for (const [t, btn] of this.tierBtns) {
      btn.classList.toggle('active', t === tier);
    }
    this.renderCapabilities();
  }

  private renderCapabilities(): void {
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

  private runDiscovery(): void {
    const text = this.searchInput.value.trim();
    if (!text) return;
    this.resultsEl.innerHTML = '<div class="sci-loading">Discovering…</div>';
    this.engine.discover({ text, limit: 4 });
  }

  private renderResults(results: DiscoveryResult[]): void {
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

  private refreshJobList(): void {
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

  // ── Engine event wiring ───────────────────────────────────────────────────

  private wireEngineEvents(): void {
    this.engine
      .on('analyticsComplete', () => this.refreshJobList())
      .on('discoveryComplete', (results) => this.renderResults(results));
  }
}

// ─── Module-level helpers ──────────────────────────────────────────────────────

const ALL_DOMAINS: ScientificDomain[] = [
  'life-sciences', 'climate-environment', 'high-energy-physics',
  'astronomy', 'materials-science', 'omics', 'imaging', 'simulation',
];

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
