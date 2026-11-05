/**
 * Spend available movement points along a legal route during one AI turn.
 * Civilians should not be artificially limited to one hex when the unit has
 * enough movement points to cover more. No direct state mutation or teleporting.
 */
import type { GameState, Unit } from './types';
import type { AIEngineAPI } from './ai';

export function moveAiUnitToward(
  initialState: GameState,
  unitId: number,
  destination: { q: number; r: number },
  api: Pick<AIEngineAPI, 'bestNeighborToward'|'canFriendlyStackOnTile'|'moveUnit'>,
): GameState {
  let state = initialState;
  const first = state.units.find(u=>u.id===unitId);
  if(!first || first.movement <= 0) return state;
  // Every valid move consumes >=1 point. A hard cap also protects against
  // malformed modded units, malicious saves and engine regressions.
  const limit = Math.min(32,Math.max(1,Math.ceil(first.movement)+2));
  const seen = new Set<string>([first.q+','+first.r]);
  for(let i=0;i<limit;i++){
    const current:Unit|undefined=state.units.find(u=>u.id===unitId);
    if(!current || current.movement<=0) break;
    if(current.q===destination.q&&current.r===destination.r)break;
    const next=api.bestNeighborToward(state,current,destination.q,destination.r);
    if(!next)break;
    const key=next.q+','+next.r;
    if(seen.has(key))break;
    if(!api.canFriendlyStackOnTile(state,current.owner,current.type,next.q,next.r,current.id))break;
    const advanced=api.moveUnit(state,unitId,next.q,next.r);
    const after=advanced.units.find(u=>u.id===unitId);
    // If the real movement engine refused this move, do not retry forever.
    if(!after || (after.q===current.q&&after.r===current.r))break;
    if(after.movement >= current.movement)break;
    seen.add(key);
    state=advanced;
  }
  return state;
}
