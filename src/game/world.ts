/** Pure deterministic world model. Independent from React, Babylon and DOM. */
export type Terrain = 'grass' | 'forest' | 'water' | 'mountain' | 'desert' | 'hills';
export type Hex = { q: number; r: number; terrain: Terrain; elevation: number; owner: number | null; city: boolean; explored: boolean };
export type Unit = { id: number; q: number; r: number; owner: number; moves: number };
export type World = { version: 1; turn: number; seed: number; size: number; hexes: Hex[]; units: Unit[]; selected: string | null; food: number; production: number; gold: number };
export const axialKey = (q: number, r: number) => `${q},${r}`;
export const hexDistance = (a: Pick<Hex, 'q'|'r'>, b: Pick<Hex, 'q'|'r'>): number =>
  (Math.abs(a.q-b.q)+Math.abs(a.r-b.r)+Math.abs(a.q+a.r-b.q-b.r))/2;
function random(seed: number) {
  let value = seed >>> 0;
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
}
export function newWorld(seed = 49321, size = 6): World {
  const rnd = random(seed);
  const hexes: Hex[] = [];
  for (let q=-size; q<=size; q++) for (let r=-size; r<=size; r++) {
    if (Math.abs(q+r)>size) continue;
    const v=rnd();
    const terrain: Terrain = v < .12 ? 'water' : v < .22 ? 'mountain' : v < .39 ? 'forest' : v < .50 ? 'hills' : v < .61 ? 'desert' : 'grass';
    hexes.push({q,r,terrain,elevation:terrain==='mountain'?.7:terrain==='hills'?.35:0,owner:null,city:false,explored:true});
  }
  const center=hexes.find(h=>h.q===0&&h.r===0)!;
  center.terrain='grass';center.owner=0;center.city=true;
  const adjacent=hexes.find(h=>h.q===1&&h.r===0)!;
  adjacent.terrain='grass';
  return {version:1,turn:1,seed,size,hexes,units:[{id:1,q:1,r:0,owner:0,moves:2}],selected:null,food:6,production:4,gold:20};
}
export function selectHex(world: World,q:number,r:number):World {
  if (!world.hexes.some(h=>h.q===q&&h.r===r)) return world;
  return {...world,selected:axialKey(q,r)};
}
export function moveSelected(world: World,q:number,r:number):World {
  const selected=world.selected;
  if (!selected) return world;
  const unit=world.units.find(u=>axialKey(u.q,u.r)===selected&&u.owner===0);
  const tile=world.hexes.find(h=>h.q===q&&h.r===r);
  if (!unit||!tile||tile.terrain==='water'||tile.terrain==='mountain'||unit.moves<1||hexDistance(unit,tile)!==1||world.units.some(u=>u.q===q&&u.r===r)) return world;
  return {...world,selected:axialKey(q,r),units:world.units.map(u=>u.id===unit.id?{...u,q,r,moves:u.moves-1}:u)};
}
export function foundCity(world: World):World {
  const selected=world.selected;
  const unit=world.units.find(u=>axialKey(u.q,u.r)===selected);
  const hex=world.hexes.find(h=>axialKey(h.q,h.r)===selected);
  if (!unit||!hex||hex.city||hex.terrain==='water'||hex.terrain==='mountain'||world.production<5) return world;
  return {...world,production:world.production-5,hexes:world.hexes.map(h=>h===hex?{...h,city:true,owner:0}:h),units:world.units.filter(u=>u.id!==unit.id)};
}
export function endTurn(world: World):World {
  const cities=world.hexes.filter(h=>h.city&&h.owner===0).length;
  return {...world,turn:world.turn+1,food:world.food+cities*2,production:world.production+cities*3,gold:world.gold+cities,units:world.units.map(u=>({...u,moves:2}))};
}
export const WORLD_SAVE_KEY='gnozian-remastered-world-v1';
export function loadWorld():World {
  try {
    const raw=localStorage.getItem(WORLD_SAVE_KEY);
    if (raw) {
      const data:unknown=JSON.parse(raw);
      if(data&&typeof data==='object'&&'version' in data&&data.version===1&&'hexes' in data&&Array.isArray(data.hexes)&&'units' in data&&Array.isArray(data.units)) return data as World;
    }
  } catch { /* corrupted or disabled storage: start safely */ }
  return newWorld();
}
export function saveWorld(world: World):void { try {localStorage.setItem(WORLD_SAVE_KEY,JSON.stringify(world));}catch{/* private mode quota */} }
