import { describe, expect, it, vi } from 'vitest';
import type { GameState, Unit } from './types';
import type { AIEngineAPI } from './ai';
import { moveAiUnitToward } from './aiUnitMovement';

const unit=(movement=3):Unit=>({
  id:5,owner:0,type:'settler',q:0,r:0,movement,maxMovement:3,
  hp:100,maxHp:100,strength:0,rangedStrength:0,range:0,
  hasAttacked:false,promotions:[],era:'ancient',name:'Settler',
});
const state=(movement=3)=>({units:[unit(movement)]} as unknown as GameState);
function mockApi(opts:{blocked?:boolean;refuse?:boolean;free?:boolean}={}){
  return {
    bestNeighborToward:vi.fn((_s:GameState,u:Unit,targetQ:number)=>u.q===targetQ?null:{q:u.q+1,r:0}),
    canFriendlyStackOnTile:vi.fn(()=>!opts.blocked),
    moveUnit:vi.fn((s:GameState,_id:number,q:number,r:number)=>{
      if(opts.refuse)return s;
      return {...s,units:s.units.map(u=>({...u,q,r,movement:u.movement-(opts.free?0:1)}))};
    }),
  } as unknown as Pick<AIEngineAPI,'bestNeighborToward'|'canFriendlyStackOnTile'|'moveUnit'>;
}
describe('AI unit movement',()=>{
  it('spends multiple movement points to approach a distant destination',()=>{
    const api=mockApi();
    const next=moveAiUnitToward(state(3),5,{q:9,r:0},api);
    expect(next.units[0]?.q).toBe(3);
    expect(next.units[0]?.movement).toBe(0);
  });
  it('stops on arrival instead of overshooting',()=>{
    const api=mockApi();
    const next=moveAiUnitToward(state(3),5,{q:2,r:0},api);
    expect(next.units[0]?.q).toBe(2);
    expect(next.units[0]?.movement).toBe(1);
  });
  it('never moves into a blocked or enemy-occupied tile',()=>{
    const api=mockApi({blocked:true});
    const old=state(3);
    expect(moveAiUnitToward(old,5,{q:8,r:0},api)).toBe(old);
    expect(api.moveUnit).not.toHaveBeenCalled();
  });
  it('never loops if the engine rejects a move without changing unit coordinates',()=>{
    const api=mockApi({refuse:true});
    const old=state(3);
    expect(moveAiUnitToward(old,5,{q:8,r:0},api)).toBe(old);
    expect(api.moveUnit).toHaveBeenCalledTimes(1);
  });
  it('never loops if a malformed engine returns free movement',()=>{
    const api=mockApi({free:true});
    const old=state(3);
    expect(moveAiUnitToward(old,5,{q:8,r:0},api)).toBe(old);
    expect(api.moveUnit).toHaveBeenCalledTimes(1);
  });
  it('skips units that have no movement left',()=>{
    const api=mockApi();
    expect(moveAiUnitToward(state(0),5,{q:5,r:0},api).units[0]?.q).toBe(0);
    expect(api.bestNeighborToward).not.toHaveBeenCalled();
  });
});
