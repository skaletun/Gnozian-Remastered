/**
 * Electron IPC utilities
 * Safe communication between React and Electron main process
 */

export const electronAPI = () => {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI;
  }
  return null;
};

/** Preload `contextBridge` is available — safe to call IPC. */
export const hasElectronBridge = () => electronAPI() !== null;

function electronUserAgent(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /\bElectron\/\d/i.test(navigator.userAgent);
}

/**
 * Desktop Electron shell (bridge or at least Chromium's Electron UA).
 * Use {@link hasElectronBridge} before invoking IPC (close window, Discord, display mode).
 */
export const isElectronShell = () => hasElectronBridge() || electronUserAgent();

/** @deprecated Prefer {@link isElectronShell} or {@link hasElectronBridge} by intent. */
export const isElectron = () => isElectronShell();

export async function minimizeWindow() {
  const api = electronAPI();
  if (api) {
    return api.minimizeWindow();
  }
}

export async function maximizeWindow() {
  const api = electronAPI();
  if (api) {
    return api.maximizeWindow();
  }
}

export async function closeWindow() {
  const api = electronAPI();
  if (api) {
    return api.closeWindow();
  }
}

export async function setDisplayMode(mode: 'windowed' | 'borderless' | 'fullscreen'): Promise<void> {
  const api = electronAPI();
  if (api?.setDisplayMode) {
    await api.setDisplayMode(mode);
  }
}

export async function getWindowState() {
  const api = electronAPI();
  if (api) {
    return {
      isMaximized: await api.isMaximized(),
    };
  }
  return null;
}

export function onWindowStateChanged(callback: (state: { isMaximized: boolean }) => void) {
  const api = electronAPI();
  if (api) {
    api.onWindowStateChanged(callback);
  }
}

export function removeWindowStateListener() {
  const api = electronAPI();
  if (api) {
    api.removeWindowStateListener();
  }
}

export type DiscordRichPresenceStatus = {
  clientIdConfigured: boolean;
  connected: boolean;
  lastError: string | null;
};

export type DiscordRichPresenceInvokeResult = DiscordRichPresenceStatus & {
  ok?: boolean;
  error?: string;
};

export async function setDiscordRichPresence(
  payload: Record<string, unknown>
): Promise<DiscordRichPresenceInvokeResult | null> {
  const api = electronAPI();
  if (!api?.discordSetRichPresence) return null;
  return api.discordSetRichPresence(payload);
}

export async function clearDiscordRichPresence(): Promise<DiscordRichPresenceInvokeResult | null> {
  const api = electronAPI();
  if (!api?.discordClearRichPresence) return null;
  return api.discordClearRichPresence();
}

export async function getDiscordRichPresenceStatus(): Promise<DiscordRichPresenceStatus | null> {
  const api = electronAPI();
  if (!api?.discordGetRichPresenceStatus) return null;
  return api.discordGetRichPresenceStatus();
}
