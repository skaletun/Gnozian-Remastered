export {};

declare global {
  interface Window {
    electronAPI?: {
      minimizeWindow: () => Promise<void>;
      maximizeWindow: () => Promise<boolean>;
      closeWindow: () => Promise<void>;
      setDisplayMode: (mode: 'windowed' | 'borderless' | 'fullscreen') => Promise<void>;
      isMaximized: () => Promise<boolean>;
      onWindowStateChanged: (callback: (state: { isMaximized: boolean }) => void) => void;
      removeWindowStateListener: () => void;
      sendCrashLog?: (payload: { type?: string; message?: string; error?: any; stack?: string }) => void;
      openCrashWindow?: (payload: { type?: string; message?: string; error?: any; stack?: string }) => Promise<{ file?: string; error?: string } | void>;
      discordSetRichPresence: (payload: Record<string, unknown>) => Promise<{
        ok?: boolean;
        error?: string;
        clientIdConfigured: boolean;
        connected: boolean;
        lastError: string | null;
      }>;
      discordClearRichPresence: () => Promise<{
        ok?: boolean;
        error?: string;
        clientIdConfigured: boolean;
        connected: boolean;
        lastError: string | null;
      }>;
      discordGetRichPresenceStatus: () => Promise<{
        clientIdConfigured: boolean;
        connected: boolean;
        lastError: string | null;
      }>;
    };
  }
}
