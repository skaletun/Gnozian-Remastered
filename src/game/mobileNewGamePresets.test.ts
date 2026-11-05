import { describe, expect, it } from 'vitest';
import { splitMobileMapSizes } from './mobileNewGamePresets';

const presets=Array.from({length:16},(_,i)=>({w:20+i*10,h:16+i*5,label:'Map '+i}));

describe('compact new game map-size selector', () => {
  it('keeps common presets visible while all 16 options remain accessible',()=>{
    const {featured,additional}=splitMobileMapSizes(presets,50,31);
    expect(featured.map(p=>p.label)).toEqual(['Map 0','Map 1','Map 3','Map 5']);
    expect(featured.length+additional.length).toBe(16);
    expect(new Set([...featured,...additional])).toEqual(new Set(presets));
  });
  it('promotes selected exotic size to the main row without duplication',()=>{
    const {featured,additional}=splitMobileMapSizes(presets,presets[14].w,presets[14].h);
    expect(featured).toContain(presets[14]);
    expect(additional).not.toContain(presets[14]);
    expect(featured.length+additional.length).toBe(16);
  });
  it('preserves selection across the smallest and largest maps',()=>{
    for(const selected of [presets[0],presets[15]]){
      const {featured,additional}=splitMobileMapSizes(presets,selected.w,selected.h);
      expect(featured).toContain(selected);
      expect([...featured,...additional]).toHaveLength(16);
    }
  });
  it('handles a reduced preset list without adding fictional entries',()=>{
    expect(splitMobileMapSizes([{w:20,h:16}],20,16)).toEqual({
      featured:[{w:20,h:16}],additional:[],
    });
  });
});
