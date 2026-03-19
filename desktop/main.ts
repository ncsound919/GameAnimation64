/**
 * desktop/main.ts
 * Electron main process for the Pyrite64 standalone desktop application.
 *
 * Responsibilities:
 *  1. Start the Express API server (api-server.ts)
 *  2. Create the main BrowserWindow pointing at the dashboard
 *  3. Handle IPC from the renderer (preload.ts) for:
 *     - vibe:generate  → forward to API server
 *     - vibe:chat      → forward to API server
 *     - vibe:set-key   → store API key via API server
 *     - vibe:clear-key → clear API key
 *     - vibe:key-status→ check if key is stored
 *     - vibe:open-file → native file open dialog
 *     - vibe:save-file → native file save dialog
 *  4. Provide native menus and keyboard shortcuts
 */

import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { createApiServer } from './api-server.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const PRELOAD_PATH = path.join(__dirname, 'preload.js');
const IS_DEV = process.env.NODE_ENV === 'development';

// ─── State ───────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;
let serverPort = 0;

// ─── Window creation ─────────────────────────────────────────────────────────

async function createWindow(): Promise<void> {
  // Start API server and wait for port
  const { getPort, server } = createApiServer(PROJECT_ROOT);
  await new Promise<void>((resolve) => {
    if (server.listening) {
      resolve();
    } else {
      server.on('listening', () => resolve());
    }
  });
  serverPort = getPort();
  console.log(`[Pyrite64] API server ready on http://127.0.0.1:${serverPort}`);

  // Create the main browser window
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: 'Pyrite64 – Vibe Coding Engine',
    backgroundColor: '#060612',
    show: false, // show after ready-to-show for smooth startup
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Graceful show
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Load the dashboard
  await mainWindow.loadURL(`http://127.0.0.1:${serverPort}/vibe-dashboard.html`);

  // Open DevTools in development
  if (IS_DEV) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Build native menu
  buildMenu();
}

// ─── IPC Handlers ────────────────────────────────────────────────────────────

function registerIPC(): void {
  const baseUrl = () => `http://127.0.0.1:${serverPort}`;

  // ── Generate (single-shot) ─────────────────────────────────────────────
  ipcMain.handle('vibe:generate', async (_event, payload: { prompt: string; context: Record<string, unknown> }) => {
    const res = await fetch(`${baseUrl()}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
      throw new Error(err.error ?? `API error ${res.status}`);
    }
    const data = await res.json() as { text: string };
    // Extract JSON patch from the text response and parse into an object
    const jsonString = extractJSON(data.text);
    if (jsonString == null) {
      return null;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonString);
    } catch (e) {
      throw new Error('Failed to parse generated JSON patch');
    }
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Generated JSON patch is not a valid object');
    }
    return parsed;
  });

  // ── Chat (multi-turn) ──────────────────────────────────────────────────
  ipcMain.handle('vibe:chat', async (_event, payload: { prompt: string; context: Record<string, unknown>; history?: Array<{ role: string; content: string }> }) => {
    const res = await fetch(`${baseUrl()}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
      throw new Error(err.error ?? `API error ${res.status}`);
    }
    const data = await res.json() as { text: string };
    return data.text;
  });

  // ── Agent generation (NodeGraphConfig patch) ────────────────────────────
  ipcMain.handle(
    'vibe:generate-agent',
    async (
      _event,
      payload: {
        role: string;
        prompt: string;
        context: Record<string, unknown>;
        systemPrompt?: string;
      },
    ) => {
      const res = await fetch(`${baseUrl()}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
        throw new Error(err.error ?? `API error ${res.status}`);
      }
      const data = await res.json() as { text: string };
      // Extract NodeGraphConfig patch from the text response, consistent with browser path
      const jsonString = extractJSON(data.text);
      if (jsonString == null) {
        throw new Error('No JSON in agent response');
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonString);
      } catch {
        throw new Error('Failed to parse generated JSON patch');
      }
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Generated JSON patch is not a valid object');
      }
      return parsed;
    },
  );

  // ── API Key management ─────────────────────────────────────────────────
  ipcMain.handle('vibe:set-key', async (_event, key: string) => {
    const res = await fetch(`${baseUrl()}/api/key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
    return res.ok;
  });

  ipcMain.handle('vibe:clear-key', async () => {
    const res = await fetch(`${baseUrl()}/api/key`, { method: 'DELETE' });
    return res.ok;
  });

  ipcMain.handle('vibe:key-status', async () => {
    const res = await fetch(`${baseUrl()}/api/key/status`);
    return res.json();
  });

  // ── File dialogs ───────────────────────────────────────────────────────
  ipcMain.handle('vibe:open-file', async (_event, filters?: { name: string; extensions: string[] }[]) => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: filters ?? [
        { name: 'Pyrite64 Scenes', extensions: ['p64scene', 'p64graph'] },
        { name: 'Bio Files', extensions: ['fasta', 'fa', 'fastq', 'fq', 'pdb'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return { filePath, content, name: path.basename(filePath) };
  });

  ipcMain.handle('vibe:save-file', async (_event, payload: { content: string; defaultName?: string }) => {
    if (!mainWindow) return null;
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: payload.defaultName ?? 'untitled.p64graph',
      filters: [
        { name: 'Pyrite64 Graph', extensions: ['p64graph'] },
        { name: 'JSON', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (result.canceled || !result.filePath) return null;
    await fs.promises.writeFile(result.filePath, payload.content, 'utf-8');
    return result.filePath;
  });
}

// ─── Menu ────────────────────────────────────────────────────────────────────

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => shell.openExternal('https://github.com/ncsound919/GameAnimation64'),
        },
        {
          label: 'About Pyrite64',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'About Pyrite64',
              message: 'Pyrite64 – Vibe Coding Engine',
              detail: 'AI-powered visual programming for Nintendo 64 homebrew.\n\nVersion 0.1.0\n© 2024 GameAnimation64',
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ─── JSON extraction helper (mirrors VibeNode.ts) ────────────────────────────

function extractJSON(text: string): string | null {
  // Try to find a JSON code fence first
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // Fall back to finding a top-level { ... }
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (text[i] === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

// ─── App lifecycle ───────────────────────────────────────────────────────────

app.whenReady().then(() => {
  registerIPC();
  createWindow();

  app.on('activate', () => {
    // macOS: re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Quit on all platforms (including macOS)
  app.quit();
});
