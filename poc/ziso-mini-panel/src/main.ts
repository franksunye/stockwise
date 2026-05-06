import type {
  PhysicalPosition,
  PhysicalSize,
  Window as TauriWindow,
} from "@tauri-apps/api/window";

type SignalType = "Breakout" | "Pullback" | "VolumeSpike" | "RiskAlert";
type SignalDirection = "up" | "down" | "neutral";
type TriggerType = "passive" | "active" | "critical";
type PanelMode = "compact" | "expanded";
type FocusMode = "normal" | "dim";

interface Signal {
  id: string;
  symbol: string;
  companyName: string;
  type: SignalType;
  direction: SignalDirection;
  strength: 1 | 2 | 3 | 4 | 5;
  timestamp: number;
  description: string;
  context: string;
  trigger: TriggerType;
  price: string;
  change: string;
}

interface WindowState {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  panelMode?: PanelMode;
  focusMode?: FocusMode;
  isFloating?: boolean;
}

const STORAGE_KEY = "ziso-mini-panel:v1:window-state";
const SNAP_THRESHOLD = 34;
const COMPACT_SIZE = { width: 320, height: 220 };
const EXPANDED_SIZE = { width: 360, height: 460 };

const mockSignals: Signal[] = [
  {
    id: "nvda-risk",
    symbol: "NVDA",
    companyName: "NVIDIA Corporation",
    type: "RiskAlert",
    direction: "down",
    strength: 5,
    timestamp: Date.now(),
    description: "Price is above plan range",
    context: "Extended from upper range. Wait for a clean reset.",
    trigger: "critical",
    price: "845.23",
    change: "+1.25%",
  },
  {
    id: "aapl-breakout",
    symbol: "AAPL",
    companyName: "Apple Inc.",
    type: "Breakout",
    direction: "up",
    strength: 4,
    timestamp: Date.now(),
    description: "Above 185 resistance",
    context: "Volume expanding. Breakout needs one more strong hold.",
    trigger: "active",
    price: "178.45",
    change: "-0.32%",
  },
  {
    id: "tsla-pullback",
    symbol: "TSLA",
    companyName: "Tesla Inc.",
    type: "Pullback",
    direction: "neutral",
    strength: 3,
    timestamp: Date.now(),
    description: "Back near demand zone",
    context: "Watch reaction near support. No chase until strength returns.",
    trigger: "active",
    price: "252.18",
    change: "+2.15%",
  },
  {
    id: "msft-idle",
    symbol: "MSFT",
    companyName: "Microsoft Corporation",
    type: "VolumeSpike",
    direction: "neutral",
    strength: 2,
    timestamp: Date.now(),
    description: "No active signal",
    context: "Quiet tape. Keep watching for a clean trigger.",
    trigger: "passive",
    price: "337.15",
    change: "-0.18%",
  },
];

let activeIndex = 0;
let pinnedSignalId: string | null = null;
let expandedSignalId: string | null = mockSignals[0].id;
let showMultiple = false;
let lastTrigger: TriggerType = "critical";
let isFloating = true;
let panelMode: PanelMode = "expanded";
let focusMode: FocusMode = "normal";
let autoCollapseTimer: number | undefined;
let moveSaveTimer: number | undefined;
let isSnapping = false;
let appWindow: TauriWindow | null = null;
let trayIcon: unknown;

function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

function readStoredWindowState(): WindowState {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as WindowState;
  } catch {
    return {};
  }
}

function writeStoredWindowState(nextState: WindowState): void {
  const previous = readStoredWindowState();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...previous, ...nextState }));
}

async function saveNativeWindowState(): Promise<void> {
  if (!appWindow) return;
  const [position, size] = await Promise.all([appWindow.outerPosition(), appWindow.outerSize()]);
  writeStoredWindowState({
    x: position.x,
    y: position.y,
    width: size.width,
    height: size.height,
    panelMode,
    focusMode,
    isFloating,
  });
}

async function setNativePanelSize(mode: PanelMode): Promise<void> {
  if (!appWindow) return;
  const { LogicalSize } = await import("@tauri-apps/api/window");
  const size = mode === "compact" ? COMPACT_SIZE : EXPANDED_SIZE;
  await appWindow.setSize(new LogicalSize(size.width, size.height));
}

async function setPanelMode(mode: PanelMode): Promise<void> {
  panelMode = mode;
  writeStoredWindowState({ panelMode });
  await setNativePanelSize(mode);
  render();
}

async function togglePanelMode(): Promise<void> {
  await setPanelMode(panelMode === "compact" ? "expanded" : "compact");
}

async function toggleFocusMode(): Promise<void> {
  focusMode = focusMode === "normal" ? "dim" : "normal";
  writeStoredWindowState({ focusMode });
  render();
}

async function showAndFocus(): Promise<void> {
  if (!appWindow) return;
  await appWindow.show();
  await appWindow.setFocus();
}

async function toggleVisibility(): Promise<void> {
  if (!appWindow) return;
  if (await appWindow.isVisible()) {
    await appWindow.hide();
    return;
  }
  await showAndFocus();
}

async function snapToRightEdge(): Promise<void> {
  if (!appWindow) return;
  const { PhysicalPosition, currentMonitor } = await import("@tauri-apps/api/window");
  const [monitor, size] = await Promise.all([currentMonitor(), appWindow.outerSize()]);
  const workArea = monitor?.workArea;
  if (!workArea) return;
  const x = workArea.position.x + workArea.size.width - size.width - 18;
  const y = workArea.position.y + 88;
  await appWindow.setPosition(new PhysicalPosition(x, y));
  await appWindow.show();
  await appWindow.setFocus();
  await saveNativeWindowState();
}

async function snapToNearestEdge(position: PhysicalPosition, size: PhysicalSize): Promise<void> {
  if (!appWindow || isSnapping) return;
  const { PhysicalPosition, currentMonitor } = await import("@tauri-apps/api/window");
  const monitor = await currentMonitor();
  const workArea = monitor?.workArea;
  if (!workArea) return;

  let nextX = position.x;
  let nextY = position.y;
  const left = workArea.position.x;
  const top = workArea.position.y;
  const right = workArea.position.x + workArea.size.width;
  const bottom = workArea.position.y + workArea.size.height;

  if (Math.abs(position.x - left) <= SNAP_THRESHOLD) nextX = left + 10;
  if (Math.abs(position.x + size.width - right) <= SNAP_THRESHOLD) nextX = right - size.width - 10;
  if (Math.abs(position.y - top) <= SNAP_THRESHOLD) nextY = top + 10;
  if (Math.abs(position.y + size.height - bottom) <= SNAP_THRESHOLD) nextY = bottom - size.height - 10;

  if (nextX === position.x && nextY === position.y) return;
  isSnapping = true;
  await appWindow.setPosition(new PhysicalPosition(nextX, nextY));
  window.setTimeout(() => {
    isSnapping = false;
  }, 180);
}

async function deliverAttention(trigger: TriggerType): Promise<void> {
  if (!appWindow || trigger === "passive") return;
  if (trigger === "critical") {
    const { UserAttentionType } = await import("@tauri-apps/api/window");
    await appWindow.show();
    await appWindow.setFocus();
    await appWindow.requestUserAttention(UserAttentionType.Informational);
  }
}

async function initNativeWindow(): Promise<void> {
  if (!isTauriRuntime()) return;
  const { getCurrentWindow, PhysicalPosition, LogicalSize } = await import("@tauri-apps/api/window");
  appWindow = getCurrentWindow();

  const stored = readStoredWindowState();
  isFloating = stored.isFloating ?? isFloating;
  panelMode = stored.panelMode ?? panelMode;
  focusMode = stored.focusMode ?? focusMode;

  await appWindow.setAlwaysOnTop(isFloating);
  if (stored.width && stored.height) {
    await appWindow.setSize(new LogicalSize(stored.width, stored.height));
  } else {
    await setNativePanelSize(panelMode);
  }
  if (typeof stored.x === "number" && typeof stored.y === "number") {
    await appWindow.setPosition(new PhysicalPosition(stored.x, stored.y));
  }

  await appWindow.onMoved(({ payload }) => {
    window.clearTimeout(moveSaveTimer);
    moveSaveTimer = window.setTimeout(async () => {
      if (!appWindow) return;
      const size = await appWindow.outerSize();
      await snapToNearestEdge(payload, size);
      await saveNativeWindowState();
    }, 220);
  });

  await appWindow.onResized(() => {
    window.clearTimeout(moveSaveTimer);
    moveSaveTimer = window.setTimeout(() => {
      void saveNativeWindowState();
    }, 220);
  });

  await initTray();
  await initGlobalShortcuts();
}

async function initTray(): Promise<void> {
  if (!isTauriRuntime()) return;
  const [{ Menu }, { TrayIcon }] = await Promise.all([
    import("@tauri-apps/api/menu"),
    import("@tauri-apps/api/tray"),
  ]);

  const menu = await Menu.new({
    items: [
      { id: "toggle", text: "Show / Hide", action: () => void toggleVisibility() },
      { id: "dock", text: "Dock Right", action: () => void snapToRightEdge() },
      { id: "mode", text: "Compact / Expanded", action: () => void togglePanelMode() },
      { id: "dim", text: "Dim Mode", action: () => void toggleFocusMode() },
      { id: "critical", text: "Trigger Critical Mock", action: () => activateSignal(0, "critical") },
      { id: "quit", text: "Quit", action: () => void appWindow?.close() },
    ],
  });

  trayIcon = await TrayIcon.new({
    id: "ziso-mini-panel-tray",
    title: "Z",
    tooltip: "ZISO Mini Panel",
    menu,
    showMenuOnLeftClick: true,
    action: (event) => {
      if (event.type === "Click" && event.button === "Left" && event.buttonState === "Up") {
        void toggleVisibility();
      }
    },
  });
  void trayIcon;
}

async function initGlobalShortcuts(): Promise<void> {
  if (!isTauriRuntime()) return;
  const { register } = await import("@tauri-apps/plugin-global-shortcut");
  try {
    await register(["Alt+Space", "Alt+Z"], (event) => {
      if (event.state !== "Pressed") return;
      if (event.shortcut === "Alt+Space") void toggleVisibility();
      if (event.shortcut === "Alt+Z") void snapToRightEdge();
    });
  } catch (error) {
    console.warn("Global shortcuts were not registered.", error);
  }
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);
}

function strengthLabel(strength: Signal["strength"]): string {
  if (strength >= 5) return "Critical";
  if (strength >= 4) return "Strong";
  if (strength >= 3) return "Watch";
  return "Quiet";
}

function directionLabel(direction: SignalDirection): string {
  if (direction === "up") return "UP";
  if (direction === "down") return "DOWN";
  return "FLAT";
}

function signalTypeLabel(type: SignalType): string {
  if (type === "VolumeSpike") return "Volume Spike";
  if (type === "RiskAlert") return "Risk Alert";
  return type;
}

function confidenceDots(strength: Signal["strength"]): string {
  return Array.from({ length: 5 }, (_, index) => (index < strength ? "|" : ".")).join("");
}

function activeSignals(): Signal[] {
  return mockSignals
    .map((signal, index) => ({
      ...signal,
      timestamp: signal.timestamp + index,
    }))
    .sort((a, b) => {
      const priority = { critical: 3, active: 2, passive: 1 };
      return (
        priority[b.trigger] - priority[a.trigger] ||
        b.strength - a.strength ||
        b.timestamp - a.timestamp
      );
    });
}

function currentSignal(): Signal {
  return mockSignals[activeIndex];
}

function setAutoCollapse(): void {
  window.clearTimeout(autoCollapseTimer);
  autoCollapseTimer = window.setTimeout(() => {
    if (!pinnedSignalId) {
      expandedSignalId = null;
      showMultiple = false;
      void setPanelMode("compact");
    }
  }, 5000);
}

function activateSignal(index: number, trigger: TriggerType): void {
  activeIndex = index;
  mockSignals[index].timestamp = Date.now();
  lastTrigger = trigger;
  expandedSignalId = mockSignals[index].id;
  if (trigger !== "passive") void setPanelMode("expanded");
  void deliverAttention(trigger);
  setAutoCollapse();
  render();
}

function cycleSignal(): void {
  const nextIndex = (activeIndex + 1) % mockSignals.length;
  activateSignal(nextIndex, mockSignals[nextIndex].trigger);
}

function renderIdle(signal: Signal): string {
  return `
    <section class="panel-body idle-state" id="panel-body">
      <div class="symbol-stack">
        <span class="symbol">${signal.symbol}</span>
        <span class="company">${signal.companyName}</span>
      </div>
      <p class="idle-copy">No active signal</p>
      <p class="timestamp">Last update: ${formatTime(signal.timestamp)}</p>
    </section>
  `;
}

function renderSignal(signal: Signal): string {
  const isExpanded =
    panelMode === "expanded" && (expandedSignalId === signal.id || pinnedSignalId === signal.id);

  return `
    <section class="panel-body signal-state ${signal.trigger}" id="panel-body" data-signal-id="${signal.id}">
      <div class="signal-heading">
        <div>
          <span class="symbol">${signal.symbol}</span>
          <span class="company">${signal.companyName}</span>
        </div>
        <span class="price-stack">
          <strong>${signal.price}</strong>
          <span class="${signal.change.startsWith("+") ? "positive" : "negative"}">${signal.change}</span>
        </span>
      </div>

      <div class="signal-card">
        <span class="trigger-dot ${signal.trigger}"></span>
        <div class="signal-copy">
          <strong>${signalTypeLabel(signal.type)} ${directionLabel(signal.direction)}</strong>
          <span>${signal.description}</span>
        </div>
        <span class="strength">${strengthLabel(signal.strength)}</span>
      </div>

      <div class="confidence-row">
        <span>Confidence</span>
        <strong>${confidenceDots(signal.strength)}</strong>
      </div>

      <div class="context ${isExpanded ? "expanded" : ""}">
        <span>Context</span>
        <p>${signal.context}</p>
      </div>

      <div class="panel-footer">
        <span>Updated ${formatTime(signal.timestamp)}</span>
        <button type="button" id="pin-signal">${pinnedSignalId === signal.id ? "Unpin" : "Pin"}</button>
      </div>
    </section>
  `;
}

function renderMultiple(): string {
  const rows = activeSignals()
    .map(
      (signal) => `
        <button class="signal-row ${signal.trigger}" type="button" data-select-signal="${signal.id}">
          <span class="row-symbol">${signal.symbol}</span>
          <span>${signalTypeLabel(signal.type)}</span>
          <strong>${directionLabel(signal.direction)}</strong>
        </button>
      `,
    )
    .join("");

  return `
    <section class="panel-body multiple-state" id="panel-body">
      <div class="list-heading">
        <span>Active signals</span>
        <strong>${activeSignals().length}</strong>
      </div>
      <div class="signal-list">${rows}</div>
      <p class="timestamp">Last update: ${formatTime(Date.now())}</p>
    </section>
  `;
}

function render(): void {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) return;

  const signal = currentSignal();
  const body =
    showMultiple ? renderMultiple() : signal.trigger === "passive" ? renderIdle(signal) : renderSignal(signal);

  app.innerHTML = `
    <main class="mini-panel ${lastTrigger} ${panelMode} ${focusMode}" data-tauri-drag-region>
      <header class="panel-header" data-tauri-drag-region>
        <div class="brand" data-tauri-drag-region>
          <span class="brand-mark">Z</span>
          <span>ZISO</span>
        </div>
        <div class="window-cluster">
          <span class="live"><span></span>Live</span>
          <button class="window-button ${isFloating ? "active" : ""}" type="button" id="toggle-floating" title="Toggle always on top">Top</button>
          <button class="window-button ${panelMode === "compact" ? "active" : ""}" type="button" id="toggle-mode" title="Compact / expanded">${panelMode === "compact" ? "Full" : "Mini"}</button>
          <button class="window-button ${focusMode === "dim" ? "active" : ""}" type="button" id="toggle-dim" title="Dim mode">Dim</button>
          <button class="window-button" type="button" id="minimize-window" title="Minimize">-</button>
          <button class="window-button close" type="button" id="close-window" title="Close">x</button>
        </div>
      </header>

      ${body}

      <nav class="controls" aria-label="Mini panel controls">
        <button type="button" id="next-signal">Next</button>
        <button type="button" id="toggle-list">${showMultiple ? "Single" : "List"}</button>
        <button type="button" id="critical-signal">Critical</button>
        <button type="button" id="dock-right">Dock</button>
      </nav>
      <button class="resize-handle" type="button" id="resize-window" title="Resize"></button>
    </main>
  `;

  bindEvents();
}

function bindEvents(): void {
  document.querySelector(".panel-header")?.addEventListener("pointerdown", (event) => {
    if ((event.target as HTMLElement).closest("button")) return;
    void appWindow?.startDragging();
  });

  document.querySelector("#panel-body")?.addEventListener("mouseenter", () => {
    if (panelMode === "compact") void setPanelMode("expanded");
  });

  document.querySelector("#toggle-floating")?.addEventListener("click", async () => {
    isFloating = !isFloating;
    writeStoredWindowState({ isFloating });
    await appWindow?.setAlwaysOnTop(isFloating);
    render();
  });

  document.querySelector("#toggle-mode")?.addEventListener("click", () => {
    void togglePanelMode();
  });

  document.querySelector("#toggle-dim")?.addEventListener("click", () => {
    void toggleFocusMode();
  });

  document.querySelector("#minimize-window")?.addEventListener("click", () => {
    void appWindow?.minimize();
  });

  document.querySelector("#close-window")?.addEventListener("click", () => {
    void appWindow?.close();
  });

  document.querySelector("#resize-window")?.addEventListener("pointerdown", () => {
    void appWindow?.startResizeDragging("SouthEast");
  });

  document.querySelector("#next-signal")?.addEventListener("click", cycleSignal);

  document.querySelector("#dock-right")?.addEventListener("click", () => {
    void snapToRightEdge();
  });

  document.querySelector("#toggle-list")?.addEventListener("click", () => {
    showMultiple = !showMultiple;
    void setPanelMode("expanded");
    setAutoCollapse();
    render();
  });

  document.querySelector("#critical-signal")?.addEventListener("click", () => {
    activateSignal(0, "critical");
  });

  document.querySelector("#pin-signal")?.addEventListener("click", () => {
    const signal = currentSignal();
    pinnedSignalId = pinnedSignalId === signal.id ? null : signal.id;
    expandedSignalId = pinnedSignalId;
    if (pinnedSignalId) void setPanelMode("expanded");
    render();
  });

  document.querySelector(".signal-state")?.addEventListener("mouseenter", () => {
    expandedSignalId = currentSignal().id;
    void setPanelMode("expanded");
    setAutoCollapse();
    render();
  });

  document.querySelectorAll<HTMLButtonElement>("[data-select-signal]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.selectSignal;
      const nextIndex = mockSignals.findIndex((nextSignal) => nextSignal.id === id);
      if (nextIndex >= 0) {
        showMultiple = false;
        activateSignal(nextIndex, mockSignals[nextIndex].trigger);
      }
    });
  });
}

window.addEventListener("DOMContentLoaded", () => {
  const stored = readStoredWindowState();
  panelMode = stored.panelMode ?? panelMode;
  focusMode = stored.focusMode ?? focusMode;
  isFloating = stored.isFloating ?? isFloating;

  void initNativeWindow();
  render();
  window.setInterval(cycleSignal, 9000);
});
