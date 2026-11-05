import { describe, expect, it } from 'vitest';
import { getNeighbors, hexDistance } from './mapgen';
import { gridToScreen, screenToGrid } from './hexMetrics';
import { HEX_WORLD_STEP, hexWorldPosition } from './hexGeometry';

describe('single canonical axial hex coordinate system', () => {
  it('counts all six hex neighbors as one step', () => {
    const neighbors=getNeighbors(5,5,11,11);
    expect(neighbors).toHaveLength(6);
    for(const neighbor of neighbors){
      expect(hexDistance(5,5,neighbor.q,neighbor.r)).toBe(1);
      expect(hexDistance(neighbor.q,neighbor.r,5,5)).toBe(1);
    }
  });
  it('takes exactly two moves to reach (q+2,r-2)', () => {
    expect(hexDistance(4,4,6,2)).toBe(2);
    expect(hexDistance(4,4,4,4)).toBe(0);
    expect(hexDistance(0,0,4,4)).toBe(8);
  });
  it('has equal Babylon world spacing for all six neighbors', () => {
    const center=hexWorldPosition(5,5);
    for(const neighbor of getNeighbors(5,5,11,11)){
      const pos=hexWorldPosition(neighbor.q,neighbor.r);
      expect(Math.hypot(pos.x-center.x,pos.z-center.z)).toBeCloseTo(HEX_WORLD_STEP,9);
    }
  });
  it('converts axial hex centers between map grid and screen with no drift', () => {
    for(let r=0;r<10;r++)for(let q=0;q<10;q++){
      const p=gridToScreen(q,r,1);
      expect(screenToGrid(p.x,p.y,0,0,1)).toEqual({q,r});
    }
  });
  it('maintains triangle inequality across different quadrants', () => {
    const nodes=[{q:0,r:0},{q:3,r:-2},{q:1,r:7},{q:-5,r:1},{q:6,r:4}];
    for(const a of nodes)for(const b of nodes)for(const c of nodes){
      expect(hexDistance(a.q,a.r,c.q,c.r)).toBeLessThanOrEqual(
        hexDistance(a.q,a.r,b.q,b.r)+hexDistance(b.q,b.r,c.q,c.r)
      );
    }
  });
});
