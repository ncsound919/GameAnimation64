/**
 * extension.ts
 * VSCode extension entry point for GameAnimation64 Bio Research.
 *
 * Registers:
 *  - Commands: open panel, analyze sequence, track mutations, physics calc, parse FASTA
 *  - Contributes: sidebar views, language associations (FASTA / FASTQ)
 *  - Integrates: BioResearchPanel, SequenceAnalyzer, MutationTracker,
 *                PhysicsCalculator, BioinformaticsProvider
 *
 * All scientific analysis runs in the extension host (Node.js) for
 * performance and security; results are posted to the webview panel.
 */

import * as vscode from 'vscode';
import { BioResearchPanel }        from './BioResearchPanel';
import { SequenceAnalyzer }        from './SequenceAnalyzer';
import { MutationTracker }         from './MutationTracker';
import { PhysicsCalculator }       from './PhysicsCalculator';
import { BioinformaticsProvider }  from './BioinformaticsProvider';

// ─── Extension lifecycle ──────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext): void {

  // ── Open Bio Research Panel ─────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('bioResearch.openPanel', () => {
      BioResearchPanel.open(context);
    }),
  );

  // ── Analyze Sequence (selection or input box) ───────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('bioResearch.analyzeSequence', async () => {
      const editor = vscode.window.activeTextEditor;
      let seq = editor?.document.getText(editor.selection) ?? '';

      if (!seq.trim()) {
        seq = await vscode.window.showInputBox({
          title:       'Analyze Biological Sequence',
          prompt:      'Paste a DNA, RNA, or protein sequence',
          placeHolder: 'ATGCATGCATGC…',
        }) ?? '';
      }

      if (!seq.trim()) return;

      const stats = SequenceAnalyzer.analyze(seq);
      const panel = BioResearchPanel.open(context);

      // Show a quick summary in the notification area
      const gc = isNaN(stats.gcContent) ? '' : `  GC: ${stats.gcContent.toFixed(1)} %`;
      const mw = `  MW: ${(stats.molecularWeight / 1000).toFixed(2)} kDa`;
      vscode.window.showInformationMessage(
        `[${stats.type}] ${stats.length.toLocaleString()} residues${gc}${mw}`,
      );

      void panel; // panel is opened; user can switch to Sequence tab
    }),
  );

  // ── Track Mutations (two sequences from clipboard / input) ──────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('bioResearch.trackMutation', async () => {
      const ref = await vscode.window.showInputBox({
        title:       'Mutation Tracker — Reference Sequence',
        prompt:      'Paste the reference DNA or protein sequence',
        placeHolder: 'Reference sequence…',
      });
      if (!ref?.trim()) return;

      const alt = await vscode.window.showInputBox({
        title:       'Mutation Tracker — Query Sequence',
        prompt:      'Paste the query / variant sequence',
        placeHolder: 'Query sequence…',
      });
      if (!alt?.trim()) return;

      const variants = MutationTracker.callVariants(ref, alt);
      const report   = MutationTracker.report(variants, 'query');
      const voc      = variants.filter(v => v.isVoc);

      if (voc.length > 0) {
        vscode.window.showWarningMessage(`⚠ ${voc.length} Variant(s) of Concern detected!`);
      } else {
        vscode.window.showInformationMessage(`${variants.length} variant(s) found. Open Bio Research panel for details.`);
      }

      BioResearchPanel.open(context);
    }),
  );

  // ── Biophysics Calculator (quick command) ───────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('bioResearch.physicsCalc', async () => {
      const input = await vscode.window.showInputBox({
        title:       'Biophysics Calculator',
        prompt:      'Enter a DNA sequence to compute its melting temperature (Tm)',
        placeHolder: 'ATGCATGC…',
      });
      if (!input?.trim()) return;

      const tm = PhysicsCalculator.meltingTemperature(input.trim());
      vscode.window.showInformationMessage(
        `Tm ≈ ${tm.toFixed(1)} °C  (50 mM NaCl, ${input.trim().length} bp)`,
      );
    }),
  );

  // ── Securely store the Anthropic API key ────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('bioResearch.setApiKey', async () => {
      const key = await vscode.window.showInputBox({
        title:       'Bio Research: Set Anthropic API Key',
        prompt:      'Enter your Anthropic API key. It will be stored in the OS secure credential store.',
        placeHolder: 'sk-ant-…',
        password:    true,
      });
      if (key === undefined) return;  // user cancelled
      if (!key.trim()) {
        vscode.window.showWarningMessage('No API key entered. Nothing was saved.');
        return;
      }
      await context.secrets.store('bioResearch.anthropicApiKey', key.trim());
      vscode.window.showInformationMessage('✅ Anthropic API key saved securely.');
    }),
  );

  // ── Remove the stored API key ────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('bioResearch.clearApiKey', async () => {
      const existing = await context.secrets.get('bioResearch.anthropicApiKey');
      if (!existing) {
        vscode.window.showInformationMessage('No Anthropic API key is currently stored.');
        return;
      }
      await context.secrets.delete('bioResearch.anthropicApiKey');
      vscode.window.showInformationMessage('🗑 Anthropic API key removed from secure store.');
    }),
  );

  // ── Parse FASTA / FASTQ File ────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('bioResearch.parseFasta', async (uri?: vscode.Uri) => {
      let fileUri = uri;
      if (!fileUri) {
        const picks = await vscode.window.showOpenDialog({
          canSelectMany:  false,
          filters: {
            'Bioinformatics files': ['fasta', 'fa', 'fna', 'ffn', 'faa', 'frn', 'fastq', 'fq', 'pdb'],
            'All files': ['*'],
          },
          title: 'Open Bioinformatics File',
        });
        fileUri = picks?.[0];
      }
      if (!fileUri) return;

      await BioResearchPanel.openWithFile(fileUri, context);
    }),
  );

  // ── Show welcome message on first install ───────────────────────────────────
  const installed = context.globalState.get<boolean>('bioResearch.installed');
  if (!installed) {
    context.globalState.update('bioResearch.installed', true);
    vscode.window.showInformationMessage(
      '🔬 Bio Research extension activated! Open the panel via the Command Palette → "Bio Research: Open Bio Research Panel".',
      'Open Panel',
    ).then(choice => {
      if (choice === 'Open Panel') BioResearchPanel.open(context);
    });
  }
}

export function deactivate(): void {
  // Nothing to clean up — subscriptions are disposed via context.subscriptions
}
