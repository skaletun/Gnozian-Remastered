import { useCallback, useEffect, useRef } from 'react';
import {
  ArcRotateCamera, Color3, Color4, Engine, HemisphericLight, DirectionalLight,
  Matrix, Mesh, MeshBuilder, PointerEventTypes, Quaternion, Scene,
  StandardMaterial, Vector3
} from '@babylonjs/core';
import type { GameState, TerrainType, Tile } from '../game/types';
import type { GraphicsSettings } from '../game/settingsConstants';
import type { CameraState } from '../game/hexMetrics';

interface Props {
  gameState: GameState;
  liveCamera?: CameraState;
  onTileClick: (q:number,r:number,mods?:{altKey?:boolean;shiftKey?:boolean})=>void;
  onClearSelection?: ()=>void;
  onCameraChange: (camera:CameraState)=>void;
  graphics?: GraphicsSettings;
  cameraControls?: {sensitivity:number;sensitivityX:number;sensitivityY:number;zoomSensitivity:number;invertX:boolean;invertY:boolean};
  onViewportSize?: (w:number,h:number)=>void;
  localViewerCivIndex?:number;
  interactionTick?:number;
}

const TERRAIN_COLORS:Record<TerrainType,string>={
  ocean:'#245773',coast:'#3888a4',plains:'#b5a46a',grassland:'#6c9b58',
  desert:'#d3b574',tundra:'#aaa79a',snow:'#d7e6e6',
  forest:'#386f45',jungle:'#286c4b',hills:'#8e8758',mountains:'#8b969b',
};
type TileRef = {q:number;r:number};
type Shape = 'hex'|'box'|'cone'|'pyramid'|'sphere'|'cylinder'|'torus';
type Batch = {shape:Shape;color:string;matrices:Matrix[];refs?:TileRef[];pickable:boolean};
const HEX_RADIUS=1.04;
function tileWorld(q:number,r:number):Vector3 {
  return new Vector3((q-r*.5)*1.75,0,r*1.52);
}
const qIdentity=Quaternion.Identity();
function transform(pos:Vector3,scale:Vector3,angle=0):Matrix {
  return Matrix.Compose(scale,angle?Quaternion.RotationAxis(Vector3.Up(),angle):qIdentity,pos);
}
function isValidHex(s:string):boolean{return /^#[a-fA-F0-9]{6}$/.test(s);}
class BabylonGnozianMap {
  readonly engine:Engine;
  readonly scene:Scene;
  readonly camera:ArcRotateCamera;
  private sky:HemisphericLight;
  private sun:DirectionalLight;
  private meshes=new Map<string,Mesh>();
  private materials=new Map<string,StandardMaterial>();
  private selectedMeshes:Mesh[]=[];
  private refs=new Map<Mesh,TileRef[]>();
  private initialCamera=true;
  private lastSelected:string|null=null;
  private pointerDown:{x:number;y:number;at:number}|null=null;
  private onPick:(q:number,r:number,mods?:{altKey?:boolean;shiftKey?:boolean})=>void;
  private onViewportSize?:(w:number,h:number)=>void;
  private destroyed=false;
  constructor(canvas:HTMLCanvasElement,pick:Props['onTileClick'],onViewportSize?:Props['onViewportSize']) {
    this.onPick=pick;
    this.onViewportSize=onViewportSize;
    this.engine=new Engine(canvas,true,{stencil:false,preserveDrawingBuffer:false,powerPreference:'high-performance'});
    this.engine.setHardwareScalingLevel(Math.max(1,window.devicePixelRatio/1.6));
    this.scene=new Scene(this.engine);
    this.scene.clearColor=Color4.FromHexString('#0e202bff');
    this.sky=new HemisphericLight('ambient',new Vector3(0,1,0),this.scene);
    this.sky.intensity=.88;
    this.sun=new DirectionalLight('sun',new Vector3(-.35,-1,.5),this.scene);
    this.sun.intensity=.8;
    this.camera=new ArcRotateCamera('touch-orbit',-Math.PI/2.0,1.03,30,Vector3.Zero(),this.scene);
    this.camera.lowerRadiusLimit=4;this.camera.upperRadiusLimit=150;
    this.camera.lowerBetaLimit=.35;this.camera.upperBetaLimit=1.47;
    this.camera.wheelPrecision=40;this.camera.pinchPrecision=65;
    this.camera.panningSensibility=90;
    this.camera.attachControl(canvas,true);
    this.camera.useBouncingBehavior=false;
    this.camera.useAutoRotationBehavior=false;
    this.scene.onPointerObservable.add(info=>{
      const ev=info.event as PointerEvent;
      if(info.type===PointerEventTypes.POINTERDOWN){
        this.pointerDown={x:ev.clientX,y:ev.clientY,at:performance.now()};
        return;
      }
      if(info.type!==PointerEventTypes.POINTERUP)return;
      const down=this.pointerDown;this.pointerDown=null;
      if(!down||Math.hypot(down.x-ev.clientX,down.y-ev.clientY)>12)return;
      if(ev.button===2)return;
      const p=this.scene.pick(this.scene.pointerX,this.scene.pointerY);
      const mesh=p?.pickedMesh;
      if(!mesh)return;
      const refs=this.refs.get(mesh as Mesh);
      const index=p?.thinInstanceIndex??-1;
      const tile=(index>=0?refs?.[index]:null)??(mesh.metadata?.tile as TileRef|undefined);
      if(tile)this.onPick(tile.q,tile.r,{altKey:ev.altKey,shiftKey:ev.shiftKey});
    });
    canvas.addEventListener('contextmenu',event=>event.preventDefault());
    this.engine.runRenderLoop(()=>{if(!this.destroyed&&!document.hidden)this.scene.render();});
    this.resize();
  }
  private mat(color:string):StandardMaterial {
    const key=isValidHex(color)?color:'#8d8d8d';
    const existing=this.materials.get(key);if(existing)return existing;
    const mat=new StandardMaterial('low-poly-'+key,this.scene);
    mat.diffuseColor=Color3.FromHexString(key);
    mat.specularColor=Color3.Black();
    mat.backFaceCulling=true;
    mat.freeze();
    this.materials.set(key,mat);
    return mat;
  }
  private master(shape:Shape,color:string):Mesh {
    const key=shape+':'+color;
    const old=this.meshes.get(key);if(old)return old;
    let m:Mesh;
    if(shape==='hex')m=MeshBuilder.CreateCylinder(key,{diameter:HEX_RADIUS*2,height:1,tessellation:6},this.scene);
    else if(shape==='box')m=MeshBuilder.CreateBox(key,{size:1},this.scene);
    else if(shape==='cone')m=MeshBuilder.CreateCylinder(key,{diameterBottom:1,diameterTop:0,height:1,tessellation:5},this.scene);
    else if(shape==='pyramid')m=MeshBuilder.CreateCylinder(key,{diameterBottom:1,diameterTop:0,height:1,tessellation:4},this.scene);
    else if(shape==='torus')m=MeshBuilder.CreateTorus(key,{diameter:1,thickness:.055,tessellation:6},this.scene);
    else if(shape==='sphere')m=MeshBuilder.CreateSphere(key,{diameter:1,segments:6},this.scene);
    else m=MeshBuilder.CreateCylinder(key,{diameter:1,height:1,tessellation:6},this.scene);
    m.material=this.mat(color);
    m.thinInstanceEnablePicking=true;
    this.meshes.set(key,m);
    return m;
  }
  private visible(tile:Tile,viewer:number):boolean {
    return tile.revealed?.[viewer]!==false;
  }
  setState(state:GameState,viewer:number,graphics?:GraphicsSettings):void {
    if(this.destroyed)return;
    const batches=new Map<string,Batch>();
    const touched=new Set<string>();
    const add=(shape:Shape,color:string,pos:Vector3,scale:Vector3,ref?:TileRef,angle=0):void=>{
      const key=shape+':'+color+(ref?':tile':':prop');
      let b=batches.get(key);
      if(!b){b={shape,color,matrices:[],refs:ref?[]:undefined,pickable:!!ref};batches.set(key,b);}
      b.matrices.push(transform(pos,scale,angle));
      if(ref)b.refs!.push(ref);
    };
    const treesAllowed=graphics?.terrainDetails!==false;
    const cityById=new Map(state.cities.map(c=>[c.id,c]));
    const tileByKey=new Map<string,Tile>();
    for(const row of state.tiles)for(const tile of row){
      const k=tile.q+','+tile.r;tileByKey.set(k,tile);
      const p=tileWorld(tile.q,tile.r);
      const revealed=this.visible(tile,viewer);
      const seen=tile.visible?.[viewer]!==false;
      const color=!revealed?'#16212a':!seen?'#52646b':TERRAIN_COLORS[tile.terrain];
      const lift=tile.terrain==='mountains'?.52:tile.terrain==='hills'?.22:.11;
      add('hex',color,new Vector3(p.x,-.18+lift*.5,p.z),new Vector3(1,lift+.30,1),{q:tile.q,r:tile.r},Math.PI/6);
      if(!revealed)continue;
      if(tile.terrain==='mountains')add('cone','#b9b8a6',p.add(new Vector3(0,.63,0)),new Vector3(.92,1.27,.92));
      if(tile.terrain==='hills')add('pyramid','#888052',p.add(new Vector3(0,.35,0)),new Vector3(.88,.62,.88));
      if(treesAllowed&&(tile.terrain==='forest'||tile.terrain==='jungle')){
        const n=tile.terrain==='jungle'?3:2;
        for(let i=0;i<n;i++){
          const a=i*2.39996+tile.q*.1;
          const dx=Math.cos(a)*.37,dz=Math.sin(a)*.31;
          add('cylinder','#6b4e34',p.add(new Vector3(dx,.29,dz)),new Vector3(.12,.53,.12));
          add('cone',tile.terrain==='forest'?'#27503b':'#14583a',p.add(new Vector3(dx,.68,dz)),new Vector3(.67,.78,.67));
        }
      }
      if(tile.road)add('box','#9b8b6e',p.add(new Vector3(0,.15,0)),new Vector3(1.15,.055,.12));
      if(tile.river)add('box','#4ca3c8',p.add(new Vector3(-.34,.16,.03)),new Vector3(.11,.05,1.05),undefined,.25);
      if(tile.improvement&&tile.improvement!=='none'){
        const imp=tile.improvement;
        if(imp==='farm'){
          for(let i=0;i<3;i++)add('box','#b9a448',p.add(new Vector3(-.40+i*.30,.18,.34)),new Vector3(.23,.13,.37));
        }else if(imp==='mine')add('pyramid','#665f58',p.add(new Vector3(.38,.36,.24)),new Vector3(.55,.54,.55));
        else if(imp==='lumber_mill')add('box','#865e38',p.add(new Vector3(.38,.27,.23)),new Vector3(.38,.39,.33));
        else if(imp==='fishing_boats')add('box','#e4d7b4',p.add(new Vector3(.21,.18,.19)),new Vector3(.55,.12,.28));
        else add('cylinder','#c7b78d',p.add(new Vector3(.34,.29,.20)),new Vector3(.30,.40,.30));
      }
      if(tile.resource&&seen)add('sphere','#f0ce78',p.add(new Vector3(-.45,.31,-.24)),new Vector3(.19,.19,.19));
      if(tile.city!==null&&tile.city!==undefined){
        const city=cityById.get(tile.city);
        const owner=city?.owner??tile.owner??0;
        const c=state.civilizations[owner]?.color;
        const color=isValidHex(c??'')?c:'#d8be85';
        add('box','#e8d7af',p.add(new Vector3(0,.36,0)),new Vector3(.69,.53,.60));
        add('pyramid',color,p.add(new Vector3(0,.76,0)),new Vector3(.90,.40,.80));
        add('box','#d3b88b',p.add(new Vector3(.48,.36,.09)),new Vector3(.23,.71,.27));
        if(city?.isCapital){
          add('cylinder','#dfd7bf',p.add(new Vector3(-.47,.44,0)),new Vector3(.22,.75,.22));
          add('cone',color,p.add(new Vector3(-.47,.94,0)),new Vector3(.42,.36,.42));
        }
        if((city?.buildings?.length??0)>5)add('box','#c7b7a3',p.add(new Vector3(0,.30,.57)),new Vector3(.54,.45,.31));
        if(tile.owner!==null){
          const flag=color;
          add('box','#ddddce',p.add(new Vector3(-.22,.94,-.22)),new Vector3(.055,.83,.055));
          add('box',flag,p.add(new Vector3(-.05,1.17,-.22)),new Vector3(.36,.19,.05));
        }
      }
      if(tile.owner!==null&&graphics?.showTerritory!==false&&tile.city==null){
        const civColor=state.civilizations[tile.owner]?.color;
        if(isValidHex(civColor??''))add('box',civColor!,p.add(new Vector3(.64,.15,.62)),new Vector3(.25,.07,.25));
      }
    }
    for(const unit of state.units){
      const tile=tileByKey.get(unit.q+','+unit.r);
      if(!tile||!this.visible(tile,viewer))continue;
      const p=tileWorld(unit.q,unit.r);
      const color=state.civilizations[unit.owner]?.color;
      const ownerColor=isValidHex(color??'')?color!:'#d8c69a';
      const water=tile.terrain==='ocean'||tile.terrain==='coast';
      const ref={q:unit.q,r:unit.r};
      if(water){
        add('box','#a49b78',p.add(new Vector3(0,.25,0)),new Vector3(.75,.17,.38),ref);
        add('box',ownerColor,p.add(new Vector3(0,.57,0)),new Vector3(.09,.65,.09));
        add('pyramid','#e2d5ad',p.add(new Vector3(.08,.64,0)),new Vector3(.45,.60,.08));
      }else{
        add('cylinder',ownerColor,p.add(new Vector3(0,.27,0)),new Vector3(.31,.38,.31),ref);
        add('sphere','#e6cfab',p.add(new Vector3(0,.58,0)),new Vector3(.26,.26,.26));
        if(unit.type==='settler'||unit.type==='worker')add('box','#9a7047',p.add(new Vector3(.2,.28,.12)),new Vector3(.30,.28,.32));
        else if(unit.type==='scout')add('cone','#425b40',p.add(new Vector3(0,.78,0)),new Vector3(.36,.24,.36));
        else if(unit.type.includes('tank'))add('box','#5f7456',p.add(new Vector3(0,.17,0)),new Vector3(.68,.24,.42));
        else add('box','#a9a9a8',p.add(new Vector3(.22,.42,0)),new Vector3(.09,.55,.08));
      }
    }
    for(const [key,b] of batches){
      const mesh=this.master(b.shape,b.color);
      const array=new Float32Array(b.matrices.length*16);
      b.matrices.forEach((m,i)=>m.copyToArray(array,i*16));
      mesh.thinInstanceSetBuffer('matrix',array,16,true);
      mesh.isPickable=b.pickable;
      mesh.thinInstanceEnablePicking=b.pickable;
      mesh.setEnabled(true);
      if(b.refs)this.refs.set(mesh,b.refs);
      else this.refs.delete(mesh);
      touched.add(b.shape+':'+b.color);
      void key;
    }
    for(const [key,mesh] of this.meshes)if(!touched.has(key)){mesh.thinInstanceCount=0;mesh.setEnabled(false);this.refs.delete(mesh);}
    for(const m of this.selectedMeshes)m.dispose();
    this.selectedMeshes=[];
    const selected=state.selectedTile??(state.selectedUnitId!==null?state.units.find(u=>u.id===state.selectedUnitId):null)??(state.selectedCityId!==null?state.cities.find(c=>c.id===state.selectedCityId):null);
    if(selected){
      const pos=tileWorld(selected.q,selected.r);
      const ring=MeshBuilder.CreateTorus('selected-hex',{diameter:1.65,thickness:.105,tessellation:6},this.scene);
      ring.material=this.mat('#ffcf5b');ring.isPickable=false;
      ring.position=pos.add(new Vector3(0,.24,0));this.selectedMeshes.push(ring);
      const selectedKey=selected.q+','+selected.r;
      if(selectedKey!==this.lastSelected&&this.camera.radius<16)this.camera.setTarget(pos);
      this.lastSelected=selectedKey;
    }
    const sunlight=Math.max(.22,Math.cos(((state.world.hour??12)-12)*Math.PI/12)*.75+.3);
    this.sun.intensity=sunlight;this.sky.intensity=.48+sunlight*.40;
    if(this.initialCamera){
      const first=state.cities.find(c=>c.owner===viewer)||state.cities[0];
      if(first)this.camera.setTarget(tileWorld(first.q,first.r));
      this.camera.radius=state.tiles.length>60?29:22;
      this.initialCamera=false;
    }
  }
  applyPreferences(graphics?:GraphicsSettings,controls?:Props['cameraControls']):void{
    if(this.destroyed)return;
    // Render resolution is explicitly adjustable to balance battery and clarity.
    const dpr=Math.max(1,window.devicePixelRatio||1);
    const scale=graphics?.renderScale??1;
    const budget=window.matchMedia('(pointer:coarse)').matches?1.35:1.75;
    const effectiveDpr=Math.min(dpr,budget*scale);
    const hardwareScale=Math.max(1,dpr/effectiveDpr);
    if(Math.abs(this.engine.getHardwareScalingLevel()-hardwareScale)>.025){
      this.engine.setHardwareScalingLevel(hardwareScale);
      this.engine.resize();
    }
    const sensitivity=Math.max(.3,Math.min(3,controls?.sensitivity??1));
    const x=Math.max(.3,Math.min(3,controls?.sensitivityX??1));
    const y=Math.max(.3,Math.min(3,controls?.sensitivityY??1));
    const zoom=Math.max(.3,Math.min(3,controls?.zoomSensitivity??1));
    const pointer=this.camera.inputs.attached['pointers'] as unknown as {
      angularSensibilityX:number;angularSensibilityY:number;
    } | undefined;
    if(pointer){
      pointer.angularSensibilityX=(1000/(sensitivity*x))*(controls?.invertX?-1:1);
      pointer.angularSensibilityY=(1000/(sensitivity*y))*(controls?.invertY?-1:1);
    }
    this.camera.wheelPrecision=40/zoom;
    this.camera.pinchPrecision=65/zoom;
    this.camera.panningSensibility=90/sensitivity;
    this.camera.inertia=graphics?.motion==='reduced'?0.12:0.75;
  }
  resize():void{
    if(this.destroyed)return;
    this.engine.resize();
    const canvas=this.engine.getRenderingCanvas();
    if(canvas)this.onViewportSize?.(canvas.clientWidth,canvas.clientHeight);
  }
  dispose():void {
    this.destroyed=true;
    this.engine.stopRenderLoop();
    this.scene.dispose();
    this.engine.dispose();
  }
}
export default function GameCanvas(props:Props){
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const renderer=useRef<BabylonGnozianMap|null>(null);
  const onPick=useRef(props.onTileClick);
  onPick.current=props.onTileClick;
  const onViewport=useRef(props.onViewportSize);
  onViewport.current=props.onViewportSize;
  const viewer=props.localViewerCivIndex??0;
  useEffect(()=>{
    const canvas=canvasRef.current;
    if(!canvas)return;
    const r=new BabylonGnozianMap(canvas,(q,r,mods)=>onPick.current(q,r,mods),(w,h)=>onViewport.current?.(w,h));
    renderer.current=r;
    const observer=new ResizeObserver(()=>r.resize());observer.observe(canvas);
    const windowResize=()=>r.resize();window.addEventListener('resize',windowResize);
    return ()=>{observer.disconnect();window.removeEventListener('resize',windowResize);renderer.current=null;r.dispose();};
  },[]);
  useEffect(()=>{
    renderer.current?.applyPreferences(props.graphics,props.cameraControls);
  },[props.graphics,props.cameraControls]);
  useEffect(()=>{
    renderer.current?.setState(props.gameState,viewer,props.graphics);
  },[props.gameState,viewer,props.graphics,props.interactionTick]);
  const onWheel=useCallback((event:React.WheelEvent<HTMLCanvasElement>)=>{
    // Babylon ArcRotateCamera handles wheel and pinch zoom natively.
    event.stopPropagation();
  },[]);
  return <canvas ref={canvasRef} className="w-full h-full block cursor-crosshair"
    onWheel={onWheel} style={{touchAction:'none',display:'block',width:'100%',height:'100%'}}
    aria-label="Интерактивная трёхмерная карта Gnozian. Коснитесь клетки, чтобы выбрать." />;
}
