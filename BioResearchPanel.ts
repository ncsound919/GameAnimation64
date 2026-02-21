/**
 * BioResearchPanel.ts
 * VSCode WebviewPanel that hosts all Bio Research tools.
 *
 * Panels:
 *  - Sequence Analysis (DNA/RNA/protein stats, ORF finder, motif search)
 *  - Mutation Tracker (variant calling, VOC flagging, alignment view)
 *  - Biophysics Calculator (thermodynamics, hydrodynamics, electrostatics)
 *  - Bioinformatics File Viewer (FASTA / FASTQ / PDB parsing & stats)
 *
 * Communication model:
 *  - Webview posts { command, payload } messages to the extension host
 *  - Extension host dispatches to the relevant module and replies with
 *    { command: '<cmd>Result', payload: <result | error> }
 *
 * AI integration:
 *  - If an Anthropic API key is configured (bioResearch.anthropicApiKey),
 *    the panel exposes an "Ask AI" button that sends the current analysis
 *    context to Claude for interpretation.
 */

import * as vscode from 'vscode';
import { SequenceAnalyzer, SequenceStats, Orf } from './SequenceAnalyzer';
import { MutationTracker, Variant }              from './MutationTracker';
import { PhysicsCalculator }                     from './PhysicsCalculator';
import { BioinformaticsProvider, FastaRecord }   from './BioinformaticsProvider';

// ─── Panel message types ──────────────────────────────────────────────────────

interface PanelMessage {
  command: string;
  payload: unknown;
}

// ─── BioResearchPanel ─────────────────────────────────────────────────────────

export class BioResearchPanel {
  static readonly viewType = 'bioResearch.panel';
  private static instance: BioResearchPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly context: vscode.ExtensionContext;
  private disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
    this.panel   = panel;
    this.context = context;

    this.panel.webview.html = this.buildHtml();
    this.panel.webview.onDidReceiveMessage(this.onMessage.bind(this), undefined, this.disposables);
    this.panel.onDidDispose(this.dispose.bind(this), undefined, this.disposables);
  }

  /** Open or reveal the Bio Research Panel. */
  static open(context: vscode.ExtensionContext): BioResearchPanel {
    if (BioResearchPanel.instance) {
      BioResearchPanel.instance.panel.reveal(vscode.ViewColumn.Two);
      return BioResearchPanel.instance;
    }

    const panel = vscode.window.createWebviewPanel(
      BioResearchPanel.viewType,
      '🔬 Bio Research',
      vscode.ViewColumn.Two,
      {
        enableScripts:         true,
        retainContextWhenHidden: true,
      },
    );

    BioResearchPanel.instance = new BioResearchPanel(panel, context);
    return BioResearchPanel.instance;
  }

  /** Open the panel and pre-load a FASTA/FASTQ/PDB file from disk. */
  static async openWithFile(uri: vscode.Uri, context: vscode.ExtensionContext): Promise<void> {
    const panel = BioResearchPanel.open(context);
    const bytes = await vscode.workspace.fs.readFile(uri);
    const text  = Buffer.from(bytes).toString('utf8');
    panel.panel.webview.postMessage({ command: 'loadFile', payload: { name: uri.fsPath, content: text } });
  }

  // ─── Message handler ─────────────────────────────────────────────────────────

  private onMessage(msg: PanelMessage): void {
    try {
      switch (msg.command) {
        case 'analyzeSequence':    this.handleAnalyzeSequence(msg.payload);    break;
        case 'findOrfs':           this.handleFindOrfs(msg.payload);           break;
        case 'findMotif':          this.handleFindMotif(msg.payload);          break;
        case 'callVariants':       this.handleCallVariants(msg.payload);       break;
        case 'computeThermo':      this.handleComputeThermo(msg.payload);      break;
        case 'computeMeltingTemp': this.handleMeltingTemp(msg.payload);        break;
        case 'computeDebye':       this.handleDebye(msg.payload);              break;
        case 'parseFile':          this.handleParseFile(msg.payload);          break;
        case 'askAi':              this.handleAskAi(msg.payload);              break;
        default:
          this.reply('error', `Unknown command: ${msg.command}`);
      }
    } catch (err: unknown) {
      this.reply('error', err instanceof Error ? err.message : String(err));
    }
  }

  // ─── Handlers ────────────────────────────────────────────────────────────────

  private handleAnalyzeSequence(payload: unknown): void {
    const { sequence } = payload as { sequence: string };
    const stats = SequenceAnalyzer.analyze(sequence);
    const rc    = stats.type === 'DNA' ? SequenceAnalyzer.reverseComplement(sequence) : undefined;
    this.reply('analyzeSequenceResult', { stats, reverseComplement: rc });
  }

  private handleFindOrfs(payload: unknown): void {
    const { sequence, minLength } = payload as { sequence: string; minLength?: number };
    const orfs = SequenceAnalyzer.findOrfs(sequence, minLength ?? 20);
    this.reply('findOrfsResult', { orfs: orfs.slice(0, 50) }); // cap at 50 for display
  }

  private handleFindMotif(payload: unknown): void {
    const { sequence, motif } = payload as { sequence: string; motif: string };
    const matches = SequenceAnalyzer.findMotif(sequence, motif);
    this.reply('findMotifResult', { matches });
  }

  private handleCallVariants(payload: unknown): void {
    const { ref, alt, sequenceName } = payload as { ref: string; alt: string; sequenceName?: string };
    const variants = MutationTracker.callVariants(ref, alt, false, sequenceName ?? 'query');
    const report   = MutationTracker.report(variants, sequenceName ?? 'query');
    this.reply('callVariantsResult', { variants, report });
  }

  private handleComputeThermo(payload: unknown): void {
    const { deltaH, deltaS, tempC } = payload as { deltaH: number; deltaS: number; tempC?: number };
    const result = PhysicsCalculator.gibbsFreeEnergy(deltaH, deltaS, (tempC ?? 25) + 273.15);
    this.reply('computeThermoResult', result);
  }

  private handleMeltingTemp(payload: unknown): void {
    const { sequence, saltM } = payload as { sequence: string; saltM?: number };
    const tm = PhysicsCalculator.meltingTemperature(sequence, saltM ?? 0.05);
    this.reply('computeMeltingTempResult', { tm_celsius: tm });
  }

  private handleDebye(payload: unknown): void {
    const { ionicStrength, dielectric, tempC } = payload as {
      ionicStrength: number; dielectric?: number; tempC?: number;
    };
    const ld = PhysicsCalculator.debyeLength(ionicStrength, dielectric ?? 78.4, (tempC ?? 25) + 273.15);
    this.reply('computeDebyeResult', { debyeLength_nm: ld * 1e9 });
  }

  private handleParseFile(payload: unknown): void {
    const { content } = payload as { content: string };
    const format = BioinformaticsProvider.detectFormat(content);
    let result: unknown;

    if (format === 'fasta') {
      const records = BioinformaticsProvider.parseFasta(content);
      const stats   = BioinformaticsProvider.assemblyStats(records);
      result = { format, records: records.slice(0, 100), stats, totalRecords: records.length };
    } else if (format === 'fastq') {
      const records = BioinformaticsProvider.parseFastq(content);
      result = {
        format,
        records: records.slice(0, 100).map(r => ({
          id: r.id, description: r.description,
          length: r.sequence.length,
          meanQ:  Math.round(BioinformaticsProvider.meanQuality(r) * 10) / 10,
        })),
        totalRecords: records.length,
      };
    } else if (format === 'pdb') {
      const atoms   = BioinformaticsProvider.parsePdb(content);
      const chains  = BioinformaticsProvider.chainIds(atoms);
      const centroid = BioinformaticsProvider.centroid(atoms.filter(a => a.name === 'CA'));
      result = {
        format,
        atomCount:  atoms.length,
        chains,
        centroid,
        residueCount: new Set(atoms.map(a => `${a.chainId}:${a.resSeq}`)).size,
      };
    } else {
      result = { format: 'unknown', message: 'Could not detect file format.' };
    }

    this.reply('parseFileResult', result);
  }

  private async handleAskAi(payload: unknown): Promise<void> {
    const { prompt, context: ctx } = payload as { prompt: string; context: string };

    // Read from the secure secrets store first; fall back to settings for backward compatibility
    let key = await this.context.secrets.get('bioResearch.anthropicApiKey') ?? '';
    if (!key) {
      const cfg = vscode.workspace.getConfiguration('bioResearch');
      key = cfg.get<string>('anthropicApiKey', '');
    }

    if (!key) {
      this.reply('askAiResult', {
        error: 'No Anthropic API key found. Run the command "Bio Research: Set Anthropic API Key" to store it securely.',
      });
      return;
    }

    try {
      const body = JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        system: 'You are an expert scientific assistant specialising in biotech, biochemistry, bioinformatics, ' +
                'physics, and disease/virus/mutation research. Provide concise, accurate answers grounded in ' +
                'established science. Cite relevant databases (UniProt, NCBI, PDB) where appropriate.',
        messages: [{ role: 'user', content: `Context:\n${ctx}\n\nQuestion:\n${prompt}` }],
      });

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method:  'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         key,
          'anthropic-version': '2023-06-01',
        },
        body,
      });

      if (!resp.ok) {
        const errText = await resp.text();
        this.reply('askAiResult', { error: `Anthropic API error ${resp.status}: ${errText}` });
        return;
      }

      const data = await resp.json() as { content?: Array<{ type: string; text: string }> };
      const text = data.content?.find(c => c.type === 'text')?.text ?? '(no response)';
      this.reply('askAiResult', { text });
    } catch (err: unknown) {
      this.reply('askAiResult', { error: err instanceof Error ? err.message : String(err) });
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private reply(command: string, payload: unknown): void {
    this.panel.webview.postMessage({ command, payload });
  }

  dispose(): void {
    BioResearchPanel.instance = undefined;
    this.panel.dispose();
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
  }

  // ─── Webview HTML ─────────────────────────────────────────────────────────────

  private buildHtml(): string {
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';">
<title>Bio Research</title>
<style>
  :root { --bg: #1e1e2e; --panel: #2a2a3e; --border: #444466; --accent: #7ec8e3;
          --green: #4ec994; --red: #f08080; --text: #cdd6f4; --muted: #888; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); font-family: 'Segoe UI', sans-serif;
         font-size: 13px; overflow: hidden; display: flex; flex-direction: column; height: 100vh; }

  /* ── Tab bar ── */
  #tabs { display: flex; border-bottom: 1px solid var(--border); background: var(--panel); flex-shrink: 0; }
  .tab  { padding: 8px 16px; cursor: pointer; border-bottom: 2px solid transparent; user-select: none; }
  .tab.active { border-bottom-color: var(--accent); color: var(--accent); }
  .tab:hover:not(.active) { background: #33334a; }

  /* ── Panels ── */
  #content { flex: 1; overflow-y: auto; padding: 16px; }
  .panel   { display: none; }
  .panel.active { display: block; }

  /* ── Form elements ── */
  label    { display: block; font-size: 11px; color: var(--muted); margin-bottom: 4px; margin-top: 12px; }
  textarea, input[type=text], input[type=number], select {
    width: 100%; background: #252535; border: 1px solid var(--border); color: var(--text);
    border-radius: 4px; padding: 6px 8px; font-family: 'Consolas', monospace; font-size: 12px; }
  textarea { min-height: 80px; resize: vertical; }
  button   { margin-top: 10px; padding: 6px 14px; background: var(--accent); color: #111;
             border: none; border-radius: 4px; cursor: pointer; font-weight: 600; }
  button:hover { filter: brightness(1.1); }
  button.danger { background: var(--red); }

  /* ── Results ── */
  .result  { margin-top: 14px; background: var(--panel); border: 1px solid var(--border);
             border-radius: 6px; padding: 12px; font-family: 'Consolas', monospace; font-size: 11px;
             white-space: pre-wrap; word-break: break-all; max-height: 400px; overflow-y: auto; }
  .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 10px; }
  .stat-item { background: var(--panel); border: 1px solid var(--border); border-radius: 4px; padding: 8px; }
  .stat-item .key   { font-size: 10px; color: var(--muted); }
  .stat-item .value { font-size: 14px; font-weight: 600; color: var(--accent); }
  .voc { color: var(--red); font-weight: bold; }
  .tag { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 10px;
         margin-right: 4px; background: #333356; }
  .tag.dna    { background: #1a3a2a; color: var(--green); }
  .tag.rna    { background: #2a1a3a; color: #c08fe0; }
  .tag.prot   { background: #3a2a1a; color: #e0a050; }
  .section-title { font-size: 14px; font-weight: 600; color: var(--accent); margin-bottom: 8px; margin-top: 4px; }
</style>
</head>
<body>

<!-- Tab bar -->
<div id="tabs">
  <div class="tab active" data-panel="sequence">🧬 Sequence</div>
  <div class="tab" data-panel="mutations">🦠 Mutations</div>
  <div class="tab" data-panel="physics">⚛️ Biophysics</div>
  <div class="tab" data-panel="files">📂 Files</div>
  <div class="tab" data-panel="ai">🤖 AI Assistant</div>
</div>

<div id="content">

  <!-- ── Sequence Analysis ─────────────────────────────────────────────────── -->
  <div class="panel active" id="panel-sequence">
    <div class="section-title">Sequence Analysis</div>

    <label>Sequence (DNA / RNA / Protein)</label>
    <textarea id="seqInput" placeholder="Paste sequence here…"></textarea>

    <button id="btnAnalyze">Analyze</button>
    <button id="btnFindOrfs" style="margin-left:8px">Find ORFs</button>

    <label style="margin-top:14px">Motif / Regex search</label>
    <div style="display:flex;gap:8px;align-items:flex-end">
      <input type="text" id="motifInput" placeholder="e.g. ATG or TATAAA" style="flex:1">
      <button id="btnMotif" style="margin-top:0">Search</button>
    </div>

    <div class="result" id="seqResult">Results will appear here…</div>
  </div>

  <!-- ── Mutation Tracker ──────────────────────────────────────────────────── -->
  <div class="panel" id="panel-mutations">
    <div class="section-title">Mutation Tracker</div>

    <label>Reference sequence</label>
    <textarea id="refSeq" placeholder="Reference DNA / protein sequence…"></textarea>

    <label>Query / alternate sequence</label>
    <textarea id="altSeq" placeholder="Query / alternate sequence…"></textarea>

    <label>Sequence name (optional)</label>
    <input type="text" id="seqName" placeholder="e.g. SARS-CoV-2 Spike variant">

    <button id="btnVariants">Call Variants</button>

    <div class="result" id="mutResult">Alignment and variant report will appear here…</div>
  </div>

  <!-- ── Biophysics Calculator ─────────────────────────────────────────────── -->
  <div class="panel" id="panel-physics">
    <div class="section-title">Biophysics Calculator</div>

    <!-- Gibbs -->
    <div class="section-title" style="font-size:12px;margin-top:8px">Gibbs Free Energy (ΔG = ΔH − TΔS)</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
      <div><label>ΔH (kJ/mol)</label><input type="number" id="thDeltaH" value="-50"></div>
      <div><label>ΔS (J/mol·K)</label><input type="number" id="thDeltaS" value="-100"></div>
      <div><label>Temperature (°C)</label><input type="number" id="thTemp" value="25"></div>
    </div>
    <button id="btnThermo">Calculate ΔG</button>

    <!-- Melting Tm -->
    <div class="section-title" style="font-size:12px;margin-top:16px">DNA Melting Temperature (Tm)</div>
    <div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:flex-end">
      <div><label>DNA sequence (5'→3')</label><input type="text" id="tmSeq" placeholder="ATGCATGC…"></div>
      <div><label>Salt [Na⁺] (M)</label><input type="number" id="tmSalt" value="0.05" step="0.01"></div>
    </div>
    <button id="btnTm">Calculate Tm</button>

    <!-- Debye -->
    <div class="section-title" style="font-size:12px;margin-top:16px">Debye Screening Length</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
      <div><label>Ionic strength (mol/L)</label><input type="number" id="debyeI" value="0.15" step="0.01"></div>
      <div><label>Dielectric constant</label><input type="number" id="debyeEps" value="78.4"></div>
      <div><label>Temperature (°C)</label><input type="number" id="debyeTemp" value="25"></div>
    </div>
    <button id="btnDebye">Calculate λ<sub>D</sub></button>

    <div class="result" id="physResult">Results will appear here…</div>
  </div>

  <!-- ── Bioinformatics Files ──────────────────────────────────────────────── -->
  <div class="panel" id="panel-files">
    <div class="section-title">Bioinformatics File Viewer</div>

    <label>Paste FASTA / FASTQ / PDB file content</label>
    <textarea id="fileContent" placeholder="Paste file content here, or open a .fasta/.fa/.fastq/.pdb file from the Explorer…" style="min-height:120px"></textarea>
    <button id="btnParseFile">Parse File</button>

    <div class="result" id="fileResult">File statistics and records will appear here…</div>
  </div>

  <!-- ── AI Assistant ──────────────────────────────────────────────────────── -->
  <div class="panel" id="panel-ai">
    <div class="section-title">AI Research Assistant (Claude)</div>
    <p style="color:var(--muted);font-size:11px;margin-bottom:12px">
      Requires an Anthropic API key set in VSCode settings (<code>bioResearch.anthropicApiKey</code>).
    </p>

    <label>Research context (paste sequence, variant list, or analysis result)</label>
    <textarea id="aiContext" placeholder="e.g. paste analysis results from other tabs here…" style="min-height:80px"></textarea>

    <label>Question / prompt</label>
    <textarea id="aiPrompt" placeholder="e.g. What are the functional implications of this missense mutation in spike protein?" style="min-height:60px"></textarea>

    <button id="btnAsk">Ask AI</button>

    <div class="result" id="aiResult">AI response will appear here…</div>
  </div>

</div><!-- #content -->

<script>
(function() {
  const vscode = acquireVsCodeApi();

  // ── Tab switching ──
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab, .panel').forEach(el => el.classList.remove('active'));
      tab.classList.add('active');
      const panelId = 'panel-' + tab.dataset.panel;
      document.getElementById(panelId)?.classList.add('active');
    });
  });

  // ── Send helpers ──
  const send = (command, payload) => vscode.postMessage({ command, payload });

  // ── Sequence ──
  document.getElementById('btnAnalyze').onclick = () => {
    const sequence = document.getElementById('seqInput').value.trim();
    if (!sequence) return;
    send('analyzeSequence', { sequence });
  };
  document.getElementById('btnFindOrfs').onclick = () => {
    const sequence = document.getElementById('seqInput').value.trim();
    if (!sequence) return;
    send('findOrfs', { sequence, minLength: 20 });
  };
  document.getElementById('btnMotif').onclick = () => {
    const sequence = document.getElementById('seqInput').value.trim();
    const motif    = document.getElementById('motifInput').value.trim();
    if (!sequence || !motif) return;
    send('findMotif', { sequence, motif });
  };

  // ── Mutations ──
  document.getElementById('btnVariants').onclick = () => {
    const ref = document.getElementById('refSeq').value.trim();
    const alt = document.getElementById('altSeq').value.trim();
    const seqName = document.getElementById('seqName').value.trim();
    if (!ref || !alt) return;
    send('callVariants', { ref, alt, sequenceName: seqName || 'query' });
  };

  // ── Physics ──
  document.getElementById('btnThermo').onclick = () => {
    send('computeThermo', {
      deltaH: parseFloat(document.getElementById('thDeltaH').value),
      deltaS: parseFloat(document.getElementById('thDeltaS').value),
      tempC:  parseFloat(document.getElementById('thTemp').value),
    });
  };
  document.getElementById('btnTm').onclick = () => {
    send('computeMeltingTemp', {
      sequence: document.getElementById('tmSeq').value.trim(),
      saltM:    parseFloat(document.getElementById('tmSalt').value),
    });
  };
  document.getElementById('btnDebye').onclick = () => {
    send('computeDebye', {
      ionicStrength: parseFloat(document.getElementById('debyeI').value),
      dielectric:    parseFloat(document.getElementById('debyeEps').value),
      tempC:         parseFloat(document.getElementById('debyeTemp').value),
    });
  };

  // ── Files ──
  document.getElementById('btnParseFile').onclick = () => {
    const content = document.getElementById('fileContent').value;
    if (!content.trim()) return;
    send('parseFile', { content });
  };

  // ── AI ──
  document.getElementById('btnAsk').onclick = () => {
    const prompt  = document.getElementById('aiPrompt').value.trim();
    const context = document.getElementById('aiContext').value.trim();
    if (!prompt) return;
    document.getElementById('aiResult').textContent = 'Thinking…';
    send('askAi', { prompt, context });
  };

  // ── Receive messages ──
  window.addEventListener('message', e => {
    const { command, payload } = e.data;

    if (command === 'loadFile') {
      document.getElementById('fileContent').value = payload.content;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      document.querySelector('[data-panel="files"]')?.classList.add('active');
      document.getElementById('panel-files')?.classList.add('active');
      send('parseFile', { content: payload.content });
      return;
    }

    if (command === 'analyzeSequenceResult') {
      const { stats, reverseComplement } = payload;
      const typeTags = { DNA: 'dna', RNA: 'rna', PROTEIN: 'prot' };
      const tag = typeTags[stats.type] || '';
      let out = '';
      out += \`<span class="tag \${tag}">\${stats.type}</span>  Length: \${stats.length.toLocaleString()} residues\\n\\n\`;
      if (!isNaN(stats.gcContent)) out += \`GC content        : \${stats.gcContent.toFixed(2)} %\\n\`;
      out += \`Molecular weight  : \${(stats.molecularWeight / 1000).toFixed(2)} kDa\\n\`;
      if (!isNaN(stats.isoelectricPoint)) out += \`Isoelectric point : pH \${stats.isoelectricPoint}\\n\`;
      out += \`\\nComposition:\\n\`;
      for (const [k, v] of Object.entries(stats.composition).sort(([,a],[,b]) => b - a)) {
        const pct = (v / stats.length * 100).toFixed(1);
        out += \`  \${k.padEnd(2)}: \${String(v).padStart(6)}  (\${pct} %)\\n\`;
      }
      if (reverseComplement) {
        out += \`\\nReverse complement (first 60 nt):\\n\${reverseComplement.slice(0, 60)}\${reverseComplement.length > 60 ? '…' : ''}\`;
      }
      document.getElementById('seqResult').innerHTML = out;
      return;
    }

    if (command === 'findOrfsResult') {
      const { orfs } = payload;
      if (!orfs.length) { document.getElementById('seqResult').textContent = 'No ORFs found.'; return; }
      let out = \`Found \${orfs.length} ORF(s):\\n\\n\`;
      for (const o of orfs) {
        out += \`[\${o.strand}] frame \${o.frame}  pos \${o.start}–\${o.end}  \${o.length} aa\\n\`;
        out += \`  \${o.protein.slice(0, 60)}\${o.protein.length > 60 ? '…' : ''}\\n\`;
      }
      document.getElementById('seqResult').textContent = out;
      return;
    }

    if (command === 'findMotifResult') {
      const { matches } = payload;
      if (!matches.length) { document.getElementById('seqResult').textContent = 'Motif not found.'; return; }
      document.getElementById('seqResult').textContent =
        \`Found \${matches.length} match(es):\\n\` +
        matches.map(m => \`  pos \${m.position}: \${m.match}\`).join('\\n');
      return;
    }

    if (command === 'callVariantsResult') {
      const { report, variants } = payload;
      const vocLines = variants.filter(v => v.isVoc).map(v =>
        \`<span class="voc">⚠ VOC: \${v.hgvsN}\${v.hgvsP ? ' / ' + v.hgvsP : ''}</span>\`);
      document.getElementById('mutResult').innerHTML =
        (vocLines.length ? vocLines.join('\\n') + '\\n\\n' : '') + report;
      return;
    }

    if (command === 'computeThermoResult') {
      const r = payload;
      document.getElementById('physResult').textContent =
        \`ΔH = \${r.deltaH_kJmol} kJ/mol\\nΔS = \${r.deltaS_JmolK} J/(mol·K)\\nT  = \${document.getElementById('thTemp').value} °C\\n\\nΔG = \${r.deltaG_kJmol.toFixed(3)} kJ/mol\\nK  = \${r.equilibriumK.toExponential(3)}\\nSpontaneous: \${r.spontaneous ? 'YES ✓' : 'NO ✗'}\`;
      return;
    }

    if (command === 'computeMeltingTempResult') {
      document.getElementById('physResult').textContent = \`Tm ≈ \${payload.tm_celsius.toFixed(1)} °C\`;
      return;
    }

    if (command === 'computeDebyeResult') {
      document.getElementById('physResult').textContent = \`Debye length λD ≈ \${payload.debyeLength_nm.toFixed(3)} nm\`;
      return;
    }

    if (command === 'parseFileResult') {
      const p = payload;
      let out = \`Format: \${p.format.toUpperCase()}\\n\`;
      if (p.stats) {
        out += \`\\nAssembly statistics:\\n\`;
        out += \`  Sequences  : \${p.stats.numSequences.toLocaleString()}\\n\`;
        out += \`  Total len  : \${p.stats.totalLength.toLocaleString()} bp\\n\`;
        out += \`  N50        : \${p.stats.n50.toLocaleString()} bp\\n\`;
        out += \`  GC content : \${p.stats.gcContent.toFixed(2)} %\\n\`;
        if (p.records.length) {
          out += \`\\nFirst \${p.records.length} record(s):\\n\`;
          for (const r of p.records.slice(0, 10)) {
            out += \`  >\${r.id}  \${r.sequence.length.toLocaleString()} bp  GC=\${calcGC(r.sequence)}%\\n\`;
          }
          if (p.totalRecords > 10) out += \`  … and \${p.totalRecords - 10} more.\\n\`;
        }
      } else if (p.atomCount !== undefined) {
        out += \`  Atoms      : \${p.atomCount.toLocaleString()}\\n\`;
        out += \`  Residues   : \${p.residueCount.toLocaleString()}\\n\`;
        out += \`  Chains     : \${p.chains.join(', ')}\\n\`;
        out += \`  Centroid   : (\${p.centroid.x.toFixed(2)}, \${p.centroid.y.toFixed(2)}, \${p.centroid.z.toFixed(2)}) Å\\n\`;
      }
      document.getElementById('fileResult').textContent = out;
      return;
    }

    if (command === 'askAiResult') {
      document.getElementById('aiResult').textContent = payload.error
        ? '❌ ' + payload.error
        : payload.text;
      return;
    }

    if (command === 'error') {
      const activeResult = document.querySelector('.panel.active .result');
      if (activeResult) activeResult.textContent = '❌ Error: ' + payload;
      return;
    }
  });

  function calcGC(seq) {
    const s = seq.toUpperCase();
    const gc = (s.match(/[GC]/g) || []).length;
    const tot = (s.match(/[ACGTN]/g) || []).length;
    return tot ? (gc / tot * 100).toFixed(1) : '0.0';
  }
})();
</script>
</body>
</html>`;
  }
}
