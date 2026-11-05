import { describe, expect, it } from 'vitest';
import { endTurn, foundCity, hexDistance, moveSelected, newWorld, selectHex } from './world';
describe('deterministic world', () => {
  it('has a reproducible world seed', () => expect(newWorld(123)).toEqual(newWorld(123)));
  it('uses axial movement distance', () => expect(hexDistance({q:0,r:0},{q:2,r:-1})).toBe(2));
  it('increments resources and refreshes movement on turn end', () => {
    const next=endTurn(newWorld());expect(next.turn).toBe(2);expect(next.units[0].moves).toBe(2);expect(next.gold).toBe(21);
  });
  it('allows movement to a free adjacent land tile', () => {
    const first=newWorld();const selected=selectHex(first,1,0);
    const dest=first.hexes.find(h=>hexDistance(h,first.units[0])===1&&h.terrain!=='water'&&h.terrain!=='mountain'&&!(h.q===0&&h.r===0))!;
    const moved=moveSelected(selected,dest.q,dest.r);
    expect(moved.units[0].q).toBe(dest.q);expect(moved.units[0].moves).toBe(1);
  });
  it('builds a second settlement when production is available', () => {
    const w=selectHex(newWorld(),1,0);const next=foundCity({...w,production:8});
    expect(next.hexes.filter(h=>h.city)).toHaveLength(2);expect(next.units).toHaveLength(0);
  });
});
