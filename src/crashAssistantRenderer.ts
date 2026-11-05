// Renderer crash assistant — captures errors, rejections and console warnings/errors
const winAny: any = window as any;
const electronAPI = winAny.electronAPI;

function sendRendererLog(payload: { type: string; message?: string; error?: any; stack?: string }) {
  try {
    if (electronAPI?.sendCrashLog) electronAPI.sendCrashLog(payload);
  } catch (e) {
    // ignore
  }
}

function openCrashWindow(payload: { type: string; message?: string; error?: any; stack?: string }) {
  try {
    if (electronAPI?.openCrashWindow) electronAPI.openCrashWindow(payload);
  } catch (e) {
    // ignore
  }
}

let alreadyOpened = false;

window.addEventListener("error", (ev: ErrorEvent) => {
  try {
    const payload = {
      type: "error",
      message: ev.message,
      error: ev.error ?? { filename: ev.filename, lineno: ev.lineno, colno: ev.colno },
      stack: ev.error?.stack || `${ev.filename}:${ev.lineno}:${ev.colno}`,
    };
    sendRendererLog(payload);
    if (!alreadyOpened) {
      alreadyOpened = true;
      openCrashWindow(payload);
    }
  } catch (e) {
    // ignore
  }
});

window.addEventListener("unhandledrejection", (ev: PromiseRejectionEvent) => {
  try {
    const reason = ev.reason;
    const payload = {
      type: "error",
      message: reason?.message || String(reason),
      error: reason,
      stack: reason?.stack || "",
    };
    sendRendererLog(payload);
    if (!alreadyOpened) {
      alreadyOpened = true;
      openCrashWindow(payload);
    }
  } catch (e) {
    // ignore
  }
});

// capture console warnings + errors
try {
  const origWarn = console.warn.bind(console);
  console.warn = (...args: any[]) => {
    try {
      sendRendererLog({ type: "warn", message: args.map(String).join(" ") });
    } catch (e) {}
    origWarn(...args);
  };
} catch (e) {}

try {
  const origError = console.error.bind(console);
  console.error = (...args: any[]) => {
    try {
      sendRendererLog({ type: "error", message: args.map(String).join(" ") });
    } catch (e) {}
    origError(...args);
  };
} catch (e) {}

export {};
