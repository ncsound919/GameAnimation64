/**
 * desktop/preload.ts
 * Electron preload script — exposes a secure IPC bridge to the renderer.
 *
 * This runs in a sandboxed context with access to `ipcRenderer`. It uses
 * `contextBridge` to expose a minimal `electronAPI` object on `window`,
 * which the existing VibeNode.ts checks for:
 *
 *   if (window.electronAPI) { ... }
 *
 * Channels exposed:
 *   invoke('vibe:generate', payload)  → returns NodeGraphConfig text
 *   invoke('vibe:chat', payload)      → returns chat response text
 *   invoke('vibe:set-key', key)       → stores the Anthropic API key
 *   invoke('vibe:clear-key')          → clears the stored key
 *   invoke('vibe:key-status')         → returns { hasKey: boolean }
 */

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Generic invoke — mirrors Electron's ipcRenderer.invoke.
   * Only whitelisted channels are allowed.
   */
  invoke: (channel: string, ...args: unknown[]): Promise<unknown> => {
    const allowed = [
      'vibe:generate',
      'vibe:chat',
      'vibe:set-key',
      'vibe:clear-key',
      'vibe:key-status',
      'vibe:open-file',
      'vibe:save-file',
    ];
    if (!allowed.includes(channel)) {
      return Promise.reject(new Error(`IPC channel "${channel}" is not allowed`));
    }
    return ipcRenderer.invoke(channel, ...args);
  },

  /** Listen for events from the main process. */
  on: (channel: string, callback: (...args: unknown[]) => void): void => {
    const allowed = ['vibe:update', 'vibe:error'];
    if (allowed.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
  },
});
