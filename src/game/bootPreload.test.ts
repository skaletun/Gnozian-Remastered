import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const retired = [
  'src/style.css',
  'src/game/renderer.ts',
  'src/game/renderer3d.ts',
  'src/game/mapRenderer.ts',
  'src/game/renderFacade.ts',
  'src/game/visualRemasterRenderer.ts',
  'src/game/vectorAssetCatalog.ts',
  'src/game/vectorUnitModels.ts',
  'src/game/vectorBuildingModels.ts',
  'src/game/vectorImprovementModels.ts',
  'src/game/unitVisualState.ts',
  'src/game/canvasGlyphDraw.ts',
];

describe('remaster renderer ownership', () => {
  it('uses the active Babylon map during game preload', () => {
    const preload = readFileSync(path.resolve('src/game/bootPreload.ts'), 'utf8');
    expect(preload).toContain("import('../components/GameCanvas')");
    expect(preload).not.toContain("import('./mapRenderer')");
    expect(preload).not.toContain("import('./visualRemasterRenderer')");
  });
  it('does not ship abandoned map implementations or the ancient style sheet', () => {
    for (const file of retired) {
      expect(existsSync(path.resolve(file)), file).toBe(false);
    }
  });
  it('retains live gameplay effects, feature systems and working UI assets', () => {
    expect(existsSync(path.resolve('src/game/visualFxPipeline.ts'))).toBe(true);
    expect(existsSync(path.resolve('src/game/featureSystems.ts'))).toBe(true);
    expect(existsSync(path.resolve('src/components/GameCanvas.tsx'))).toBe(true);
    expect(existsSync(path.resolve('scripts/generate2dAssets.mjs'))).toBe(true);
  });
});
