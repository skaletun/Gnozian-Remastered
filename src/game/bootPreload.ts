import { assetUrl } from '../utils/assetUrl';

export type BootProgress = {
  /** 0..1 */
  ratio: number;
  phaseKey: string;
};

let menuBootPromise: Promise<void> | null = null;
let gameBootPromise: Promise<void> | null = null;

function yieldToFrame(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => resolve());
  });
}

async function decodeMenuBackground(): Promise<void> {
  if (typeof Image === 'undefined') return;
  const img = new Image();
  img.src = assetUrl('bg-img.png');
  if (img.decode) await img.decode().catch(() => {});
}

const MENU_PHASES: Array<{ key: string; run: () => Promise<unknown> }> = [
  { key: 'boot.phase.menuBg', run: decodeMenuBackground },
];

const GAME_PHASES: Array<{ key: string; run: () => Promise<unknown> }> = [
  {
    key: 'boot.phase.panelsCore',
    run: () =>
      Promise.all([
        import('../components/TechTree'),
        import('../components/CityPanel'),
        import('../components/DiplomacyPanel'),
      ]),
  },
  {
    key: 'boot.phase.panelsMore',
    run: () =>
      Promise.all([
        import('../components/EmpirePanel'),
        import('../components/GovernmentModal'),
        import('../components/StatsScreen'),
        import('../components/GreatPeopleScreen'),
      ]),
  },
  {
    key: 'boot.phase.panelsAux',
    run: () =>
      Promise.all([
        import('../components/HelpScreen'),
        import('../components/VictoryTracker'),
        import('../components/DiplomaticSettlementModal'),
      ]),
  },
  {
    key: 'boot.phase.gameCore',
    run: () => Promise.all([
      import('./featureSystems'),
      import('./movementRules'),
      import('./systems/turnStateCore'),
    ]),
  },
  {
    // The map is actually rendered by Babylon.js. Preload the active component,
    // not abandoned Canvas2D and fake Renderer3D compatibility paths.
    key: 'boot.phase.visual',
    run: () => import('../components/GameCanvas'),
  },
  {
    key: 'boot.phase.pathfinding',
    run: () => import('./pathfinding'),
  },
];

async function runPhased(
  phases: Array<{ key: string; run: () => Promise<unknown> }>,
  onProgress?: (p: BootProgress) => void,
): Promise<void> {
  const n = phases.length;
  for (let i = 0; i < n; i++) {
    await phases[i].run();
    onProgress?.({ ratio: (i + 1) / n, phaseKey: phases[i].key });
    await yieldToFrame();
  }
  onProgress?.({ ratio: 1, phaseKey: 'boot.phase.done' });
}

/**
 * Light startup: menu background decode only. Keeps splash short so the UI thread
 * stays responsive on menu / setup screens.
 */
export function runMenuBootPreload(onProgress?: (p: BootProgress) => void): Promise<void> {
  if (menuBootPromise) {
    return menuBootPromise.then(() => {
      onProgress?.({ ratio: 1, phaseKey: 'boot.phase.done' });
    });
  }

  menuBootPromise = (async () => {
    onProgress?.({ ratio: 0, phaseKey: 'boot.phase.start' });
    await yieldToFrame();
    await runPhased(MENU_PHASES, onProgress);
  })();

  return menuBootPromise;
}

/**
 * Full game modules + lazy panels. Run while the loading overlay is visible
 * (new game, load save, MP connect), then apply state.
 */
export function runGameBootPreload(onProgress?: (p: BootProgress) => void): Promise<void> {
  if (gameBootPromise) {
    return gameBootPromise.then(() => {
      onProgress?.({ ratio: 1, phaseKey: 'boot.phase.done' });
    });
  }

  gameBootPromise = (async () => {
    onProgress?.({ ratio: 0, phaseKey: 'boot.phase.start' });
    await yieldToFrame();
    await runPhased(GAME_PHASES, onProgress);
  })();

  return gameBootPromise;
}
