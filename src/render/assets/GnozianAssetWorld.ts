/** Game-state driven animated glTF world, entirely visual; keeps existing deterministic 4X simulation unchanged. */
import {
  SceneLoader, Vector3, TransformNode, type Scene, type AssetContainer,
  type AnimationGroup, type InstantiatedEntries,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import type { GameState, Tile, Unit } from '../../game/types';
import { hexWorldPosition, worldPointToAxial } from '../../game/hexGeometry';
import { CIV_TEMPLATES } from '../../game/constants';

type Kind='terrain'|'resources'|'improvements'|'buildings'|'units'|'wonders'|'cities'|'districts'|'props';
type Wish={ key:string; kind:Kind; id:string; variant:string; lod:0|1; p:Vector3; size:number; yaw:number; clip:string };
type Actor={ p:Vector3; end:number; kind:'move'|'attack' };
type Live={ wish:Wish; root:TransformNode; cloned:InstantiatedEntries; groups:AnimationGroup[]; clip:string; actor?:Actor; nextAmbientAt:number };
type LastUnit={q:number;r:number;hasAttacked:boolean;hp:number};
const FAUNA=new Set(['cattle','sheep','deer','horse','fish']);
const CAVALRY=new Set(['horseman','knight','cavalry']);
const MACHINES=new Set(['tank','catapult','cannon','artillery','fighter','bomber','nuclear_missile']);
const RANGED=new Set(['archer','musketman','rifleman','infantry','fighter','bomber']);
const VARIANTS:Record<string,string[]>={
  ocean:['base','deep','swell'],coast:['base','lagoon','rocky'],
  plains:['base','dry','golden'],grassland:['base','flowers','lush'],
  desert:['base','oasis','badlands'],tundra:['base','bog','permafrost'],
  snow:['base','blue_ice','drifts'],forest:['base','autumn','conifer'],
  jungle:['base','ancient','mangrove'],hills:['base','rocky','terraced'],
  mountains:['base','snowpeak','volcanic'],
};
function world(q:number,r:number):Vector3 { const p=hexWorldPosition(q,r);return new Vector3(p.x,0,p.z); }
function seed(q:number,r:number):number {
  let n=Math.imul(q+92717,374761393)^Math.imul(r+47777,668265263);
  n=Math.imul(n^(n>>>13),1274126177);return (n^(n>>>16))>>>0;
}
function height(t:Tile):number {return (t.terrain==='mountains'?.52:t.terrain==='hills'?.22:.11)+.1;}
function signed(w:Wish):string{return [w.kind,w.id,w.variant,w.lod,w.size].join(':');}
function url(w:Wish):string {
  if(!/^[a-z0-9_]+$/.test(w.id)||!/^[a-z0-9_]+$/.test(w.variant))throw new Error('Bad 3D asset ID');
  return (import.meta.env.BASE_URL.replace(/\/?$/,'/'))+'models/'+w.kind+'/'+w.kind+'_'+w.id+'_'+w.variant+'_lod'+w.lod+'.glb';
}
export class GnozianAssetWorld {
  private readonly scene:Scene;
  private readonly target:()=>Vector3;
  private readonly changed:()=>void;
  private cache=new Map<string,AssetContainer>();
  private pending=new Map<string,Promise<AssetContainer|null>>();
  private absent=new Set<string>();
  private jobs:Array<()=>void>=[];
  private loading=0;
  private live=new Map<string,Live>();
  private wants=new Map<string,Wish>();
  private lastUnits=new Map<number,LastUnit>();
  private state:GameState|null=null;
  private viewer=0;
  private details=true;
  private lastCamera=Vector3.Zero();
  private lastFrame=0;
  private dead=false;
  private observe;
  constructor(scene:Scene,cameraTarget:()=>Vector3,onChanged:()=>void){
    this.scene=scene;this.target=cameraTarget;this.changed=onChanged;
    this.observe=scene.onBeforeRenderObservable.add(()=>this.tick());
  }
  has(key:string):boolean {return this.live.has(key);}
  sync(state:GameState,viewer:number,details:boolean):void {
    if(this.dead)return;
    this.state=state;this.viewer=viewer;this.details=details;
    this.update(true);
  }
  private tick():void {
    if(this.dead)return;
    const now=performance.now(),camera=this.target();
    if(now-this.lastFrame>650){
      this.lastFrame=now;
      if(Vector3.DistanceSquared(camera,this.lastCamera)>1.2){
        this.lastCamera.copyFrom(camera);this.update(false);
      }
    }
    for(const live of this.live.values()){
      if(!live.actor && now >= live.nextAmbientAt) {
        if(live.wish.kind==='resources' && FAUNA.has(live.wish.id)) this.play(live,live.clip==='idle'?(live.wish.id==='fish'?'swim':'graze'):'idle');
        else if(live.wish.kind==='units' && (live.wish.id==='worker'||live.wish.id.startsWith('great_')))this.play(live,live.clip==='idle'?(live.wish.id==='worker'?'work':'gesture'):'idle');
        live.nextAmbientAt=now+4500+(seed(Math.floor(live.root.position.x),Math.floor(live.root.position.z))%3500);
      }
      const a=live.actor;if(!a)continue;
      if(now>=a.end){
        live.root.position.copyFrom(a.p);live.actor=undefined;this.play(live,'idle');continue;
      }
      if(a.kind==='move')live.root.position=Vector3.Lerp(live.root.position,a.p,.17);
    }
  }
  private play(l:Live,name:string):void {
    const next=l.groups.find(g=>g.name===name)||l.groups.find(g=>g.name==='idle')||l.groups[0];
    if(!next||l.clip===next.name)return;
    for(const group of l.groups)group.stop();
    next.start(true,1,next.from,next.to,false);l.clip=next.name;
  }
  private wish(key:string,kind:Kind,id:string,p:Vector3,size=1,variant='base',lod:0|1=0,clip='ambient',yaw=0):void {
    this.wants.set(key,{key,kind,id,p,size,variant,lod,clip,yaw});
  }
  private update(capture:boolean):void {
    const state=this.state;
    if(!state||this.dead)return;
    const c=this.target(),shown:Array<{t:Tile;p:Vector3;d:number}>=[];
    const hex=worldPointToAxial(c.x,c.z);
    const qMin=Math.max(0,Math.floor(hex.q)-17),qMax=Math.ceil(hex.q)+17;
    const rMin=Math.max(0,Math.floor(hex.r)-12),rMax=Math.min(state.tiles.length-1,Math.ceil(hex.r)+12);
    for(let r=rMin;r<=rMax;r++)for(let q=qMin;q<=qMax;q++){
      const t=state.tiles[r]?.[q];
      if(!t||t.revealed?.[this.viewer]===false)continue;
      const p=world(t.q,t.r),d=Vector3.Distance(p,c);
      if(d<15)shown.push({t,p,d});
    }
    shown.sort((a,b)=>a.d-b.d);
    this.wants.clear();
    const touch=typeof navigator!=='undefined'&&navigator.maxTouchPoints>0;
    const maxTerrain=touch?(this.details?52:30):(this.details?120:65);
    const maxDetails=touch?38:105;
    const maxActors=touch?30:70;
    let extras=0;
    for(const {t,p,d} of shown.slice(0,maxTerrain)){
      const variants=VARIANTS[t.terrain]??['base'];
      const variant=variants[seed(t.q,t.r)%variants.length]!;
      this.wish('terrain:'+t.q+':'+t.r,'terrain',t.terrain,p.add(new Vector3(0,.1,0)),1,variant,d>9?1:0);
      if(t.visible?.[this.viewer]===false||extras>=maxDetails)continue;
      if(t.resource){
        const animal=FAUNA.has(t.resource);
        this.wish('resource:'+t.q+':'+t.r,'resources',t.resource,p.add(new Vector3(-.27,height(t),-.25)),.42,'base',0,animal?'idle':'ambient');extras++;
      }
      if(t.improvement&&t.improvement!=='none'){
        this.wish('improvement:'+t.q+':'+t.r,'improvements',t.improvement,p.add(new Vector3(.26,height(t),.20)),.48);extras++;
      }
      if(t.road){
        this.wish('road:'+t.q+':'+t.r,'props','road_dirt',p.add(new Vector3(0,height(t)-.06,0)),.85);extras++;
      }
    }
    const townById=new Map(state.cities.map(city=>[city.id,city]));
    for(const city of state.cities){
      const t=state.tiles[city.r]?.[city.q];if(!t||t.revealed?.[this.viewer]===false)continue;
      const p=world(city.q,city.r);if(Vector3.Distance(p,c)>17)continue;
      const variant=city.isCapital||city.settlementTier===3?'capital':city.settlementTier===1||city.settlementKind==='town'?'town':'city';
      const civilization=state.civilizations[city.owner];
      const civId=state.civilizationIdentity?.find(x=>x.civIndex===city.owner)?.templateId || CIV_TEMPLATES.find(x=>x.name===civilization?.name)?.id||CIV_TEMPLATES[city.owner%CIV_TEMPLATES.length]?.id||'roman_empire';
      this.wish('city:'+city.id,'cities',civId,p.add(new Vector3(0,height(t),0)),.92,variant);
      if(extras>=maxDetails)continue;
      const buildings=city.buildings;
      for(let i=0;i<buildings.length;i++){
        if(extras++>=maxDetails)break;
        const a=i*2.399963+city.id,dist=.45+.16*Math.floor(i/6);
        this.wish('building:'+city.id+':'+i,'buildings',buildings[i]!,p.add(new Vector3(Math.cos(a)*dist,height(t),Math.sin(a)*dist)),.23); 
      }
      for(const district of city.districts??[]){
        if(extras++>=maxDetails)break;
        const dt=state.tiles[district.r]?.[district.q],dp=world(district.q,district.r);
        if(!dt||dt.revealed?.[this.viewer]===false||Vector3.Distance(dp,c)>15)continue;
        this.wish('district:'+district.id,'districts',district.type,dp.add(new Vector3(0,height(dt),0)),.62);
      }
    }
    for(const [id,owner] of Object.entries(state.systems?.wonderOwners??{})){
      if(!owner||extras++>=maxDetails)break;
      const city=townById.get(owner.cityId);if(!city)continue;
      const t=state.tiles[city.r]?.[city.q],p=world(city.q,city.r);
      if(!t||t.revealed?.[this.viewer]===false||Vector3.Distance(p,c)>16)continue;
      this.wish('wonder:'+id,'wonders',id,p.add(new Vector3(.54,height(t),-.52)),.43);
    }
    let actors=0;
    for(const unit of state.units){
      if(actors>=maxActors)break;
      const t=state.tiles[unit.r]?.[unit.q],p=world(unit.q,unit.r);
      if(!t||t.revealed?.[this.viewer]===false||Vector3.Distance(p,c)>17)continue;
      this.wish('unit:'+unit.id,'units',unit.type,p.add(new Vector3(0,height(t),0)),.72,'base',0,'idle');
      actors++;
    }
    let dirty=false;
    for(const [key,object] of this.live){
      const want=this.wants.get(key);
      if(!want||signed(object.wish)!==signed(want)){this.remove(key);dirty=true;}
    }
    for(const w of this.wants.values()){
      const object=this.live.get(w.key);
      if(object) {
        if(!object.actor && !w.key.startsWith('unit:'))object.root.position.copyFrom(w.p);
        if(w.kind==='terrain'){
          if(Vector3.Distance(w.p,c)<8){if(!object.clip)this.play(object,'ambient');}
          else if(object.clip){for(const group of object.groups)group.stop();object.clip='';}
        }
        continue;
      }
      const u=url(w);
      if(this.absent.has(u))continue;
      if(this.cache.has(u)){if(this.spawn(w))dirty=true;continue;}
      void this.request(u).then(asset=>{
        if(!asset||this.dead)return;
        const current=this.wants.get(w.key);
        if(!current||signed(current)!==signed(w)||this.live.has(w.key))return;
        if(this.spawn(current))this.changed();
      });
    }
    if(capture)this.track(state.units,state.tiles);
    if(dirty)this.changed();
  }
  private track(units:Unit[],tiles:Tile[][]):void {
    const next=new Map<number,LastUnit>();
    for(const u of units){
      next.set(u.id,{q:u.q,r:u.r,hasAttacked:u.hasAttacked,hp:u.hp});
      const old=this.lastUnits.get(u.id),live=this.live.get('unit:'+u.id);
      if(!old||!live)continue;
      if(old.q!==u.q||old.r!==u.r){
        const t=tiles[u.r]?.[u.q],dst=world(u.q,u.r);
        dst.y=t?height(t):.2;
        live.actor={p:dst,end:performance.now()+520,kind:'move'};
        this.play(live,CAVALRY.has(u.type)?'gallop':MACHINES.has(u.type)?'move':'walk');
      }else if(old.hp>u.hp){
        live.actor={p:live.root.position.clone(),end:performance.now()+500,kind:'attack'};
        this.play(live,'defend');
      }else if(!old.hasAttacked&&u.hasAttacked){
        live.actor={p:live.root.position.clone(),end:performance.now()+460,kind:'attack'};
        this.play(live,RANGED.has(u.type)?'shoot':'attack');
      }
    }
    this.lastUnits=next;
  }
  private flush():void {
    while(!this.dead&&this.loading<4&&this.jobs.length)this.jobs.shift()!();
  }
  private request(src:string):Promise<AssetContainer|null>{
    if(this.cache.has(src))return Promise.resolve(this.cache.get(src)!);
    if(this.absent.has(src)||this.dead)return Promise.resolve(null);
    const old=this.pending.get(src);if(old)return old;
    const task=new Promise<AssetContainer|null>(resolve=>{
      this.jobs.push(()=>{
        this.loading++;
        const cut=src.lastIndexOf('/');
        void SceneLoader.LoadAssetContainerAsync(src.slice(0,cut+1),src.slice(cut+1),this.scene)
        .then(container=>{
          if(this.dead){container.dispose();resolve(null);}
          else {this.cache.set(src,container);resolve(container);}
        })
        .catch(err=>{this.absent.add(src);console.warn('[Gnozian 3D] Falling back for '+src,err);resolve(null);})
        .finally(()=>{this.loading--;this.pending.delete(src);this.flush();});
      });
      this.flush();
    });
    this.pending.set(src,task);return task;
  }
  private spawn(w:Wish):boolean{
    const source=this.cache.get(url(w));
    if(!source||this.dead)return false;
    try{
      const cloned=source.instantiateModelsToScene();
      const root=new TransformNode('3d-'+w.key,this.scene);
      root.position.copyFrom(w.p);root.scaling.setAll(w.size);root.rotation.y=w.yaw;
      for(const node of cloned.rootNodes){
        node.parent=root;
        for(const mesh of node.getChildMeshes(false))mesh.isPickable=false;
      }
      const object:Live={wish:w,root,cloned,groups:cloned.animationGroups,clip:'',nextAmbientAt:performance.now()+4000+(seed(Math.floor(w.p.x),Math.floor(w.p.z))%3000)};
      this.live.set(w.key,object);
      if(w.kind!=='terrain'||Vector3.Distance(w.p,this.target())<8)this.play(object,w.clip);
      return true;
    }catch(error){console.error('[Gnozian 3D] Instantiation failed '+w.key,error);this.absent.add(url(w));return false;}
  }
  private remove(key:string):void {
    const object=this.live.get(key);if(!object)return;
    this.live.delete(key);
    object.cloned.dispose();
    object.root.dispose();
  }
  dispose():void{
    if(this.dead)return;
    this.dead=true;
    if(this.observe)this.scene.onBeforeRenderObservable.remove(this.observe);
    for(const key of [...this.live.keys()])this.remove(key);
    for(const value of this.cache.values())value.dispose();
    this.cache.clear();this.pending.clear();this.jobs.length=0;
    this.wants.clear();this.lastUnits.clear();
  }
}
