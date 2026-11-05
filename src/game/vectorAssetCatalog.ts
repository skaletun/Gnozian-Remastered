import { normalizeHexColor } from './canvasGlyphDraw';

export type VisualRemasterDetail = 'balanced' | 'ultra';

export interface VisualStyleTokens {
  terrainEdgeLight: string;
  terrainEdgeDark: string;
  roadColor: string;
  roadGlow: string;
  riverColor: string;
  cityGlow: string;
  unitGlow: string;
  overlayText: string;
}

export interface VectorAssetCatalog {
  detail: VisualRemasterDetail;
  tokens: VisualStyleTokens;
}

export function createVectorAssetCatalog(detail: VisualRemasterDetail): VectorAssetCatalog {
  const ultra = detail === 'ultra';
  return {
    detail,
    tokens: {
      terrainEdgeLight: ultra ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.11)',
      terrainEdgeDark: ultra ? 'rgba(0,0,0,0.38)' : 'rgba(0,0,0,0.28)',
      roadColor: ultra ? 'rgba(233, 193, 124, 0.86)' : 'rgba(208, 173, 108, 0.75)',
      roadGlow: ultra ? 'rgba(255, 214, 136, 0.33)' : 'rgba(245, 206, 132, 0.22)',
      riverColor: ultra ? 'rgba(120, 209, 255, 0.82)' : 'rgba(120, 195, 240, 0.64)',
      cityGlow: ultra ? 'rgba(255, 220, 130, 0.30)' : 'rgba(255, 210, 120, 0.2)',
      unitGlow: ultra ? 'rgba(255, 238, 180, 0.26)' : 'rgba(255, 230, 170, 0.16)',
      overlayText: 'rgba(245, 245, 245, 0.96)',
    },
  };
}

export function civPrimaryColor(input: string | undefined): string {
  return normalizeHexColor(input ?? '#888888');
}

