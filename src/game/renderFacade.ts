import type { GameState } from './types';
import type { GraphicsSettings } from './settingsConstants';
import type { VectorAssetCatalog } from './vectorAssetCatalog';
import { createVectorAssetCatalog } from './vectorAssetCatalog';
import { renderVisualRemasterOverlay } from './visualRemasterRenderer';

export interface RenderFacadeInput {
  canvas: HTMLCanvasElement;
  state: GameState;
  hoveredTile: { q: number; r: number } | null;
  time: number;
  graphics: GraphicsSettings;
  cameraOverride?: { x: number; y: number; zoom: number; rotation?: number };
  ctx: CanvasRenderingContext2D;
  localViewerCivIndex: number;
}

export class RenderFacade {
  private catalogBalanced: VectorAssetCatalog | null = null;
  private catalogUltra: VectorAssetCatalog | null = null;

  render(input: RenderFacadeInput): void {
    const detail = input.graphics.visualDetail ?? 'balanced';
    let catalog: VectorAssetCatalog;
    if (detail === 'ultra') {
      if (!this.catalogUltra) this.catalogUltra = createVectorAssetCatalog('ultra');
      catalog = this.catalogUltra;
    } else {
      if (!this.catalogBalanced) this.catalogBalanced = createVectorAssetCatalog('balanced');
      catalog = this.catalogBalanced;
    }
    renderVisualRemasterOverlay({
      state: input.state,
      time: input.time,
      camera: input.cameraOverride ?? input.state.camera,
      ctx: input.ctx,
      canvas: input.canvas,
      graphics: input.graphics,
      localViewerCivIndex: input.localViewerCivIndex,
      catalog,
      hoveredTile: input.hoveredTile,
    });
  }
}

