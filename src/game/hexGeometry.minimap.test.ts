import { describe, expect, it } from 'vitest';
import {
  hexWorldPosition, worldPointToAxial, miniPointToAxial, axialToMiniPoint,
} from './hexGeometry';

describe('Babylon camera to minimap conversion', () => {
  it('round-trips axial world centers including skewed far rows', () => {
    for (const [q,r] of [[0,0],[3,6],[19,12],[100,30],[159,24]]) {
      const world=hexWorldPosition(q,r);
      const axial=worldPointToAxial(world.x,world.z);
      expect(axial.q).toBeCloseTo(q,7);
      expect(axial.r).toBeCloseTo(r,7);
    }
  });
  it('maps tile centers to exactly their own minimap pixels', () => {
    for (const [q,r] of [[0,0],[10,4],[35,25],[159,40]]) {
      const point=axialToMiniPoint(q,r,160,60,320,120);
      expect(miniPointToAxial(point.x,point.y,160,60,320,120)).toEqual({q,r});
    }
  });
  it('clamps taps outside minimap boundaries safely', () => {
    expect(miniPointToAxial(-50,-2,26,20,228,132)).toEqual({q:0,r:0});
    expect(miniPointToAxial(250,160,26,20,228,132)).toEqual({q:25,r:19});
  });
  it('returns finite coordinates for zero-sized canvases', () => {
    const point=miniPointToAxial(0,0,10,10,0,0);
    expect(point).toEqual({q:0,r:0});
  });
});
