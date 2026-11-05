import {
  ArcRotateCamera, Color3, Color4, DirectionalLight, Engine, HemisphericLight,
  Mesh, MeshBuilder, Scene, StandardMaterial, Vector3, type AbstractMesh,
  PointerEventTypes,
} from '@babylonjs/core';
import type { World, Hex, Terrain } from '../game/world';
import { axialKey } from '../game/world';

/** Mobile-budget-friendly low-poly hex world, rendered entirely by Babylon.js. */
const COLORS: Record<Terrain, string> = {
  grass:'#5a9860',forest:'#315f49',water:'#286f98',mountain:'#858b8a',desert:'#c4a36b',hills:'#8f8d58'
};
const spacing = 1.13;
function location(q:number,r:number):Vector3 {
  return new Vector3(spacing*Math.sqrt(3)*(q+r/2),0,spacing*1.5*r);
}
function material(scene:Scene,name:string,hex:string):StandardMaterial {
  const mat=new StandardMaterial(name,scene);
  mat.diffuseColor=Color3.FromHexString(hex);mat.specularColor=Color3.Black();mat.freeze();
  return mat;
}
export class BabylonWorld {
  readonly engine: Engine;
  readonly scene: Scene;
  private camera:ArcRotateCamera;
  private meshes:AbstractMesh[]=[];
  private mats:Record<Terrain,StandardMaterial>;
  private cityMat:StandardMaterial;
  private roofMat:StandardMaterial;
  private treeMat:StandardMaterial;
  private unitMat:StandardMaterial;
  private markerMat:StandardMaterial;
  private click:(q:number,r:number)=>void;
  private disposed=false;
  constructor(canvas:HTMLCanvasElement,onHex:(q:number,r:number)=>void) {
    this.click=onHex;
    this.engine=new Engine(canvas,true,{preserveDrawingBuffer:false,stencil:false,powerPreference:'high-performance'});
    // Limit backing buffer pixel count on high-DPI smartphones.
    this.engine.setHardwareScalingLevel(Math.max(1,window.devicePixelRatio/1.75));
    this.scene=new Scene(this.engine);
    this.scene.clearColor=new Color4(.055,.105,.135,1);
    this.scene.ambientColor=new Color3(.22,.25,.28);
    new HemisphericLight('sky',new Vector3(0,1,0),this.scene).intensity=.9;
    const sun=new DirectionalLight('sun',new Vector3(-.5,-1,.6),this.scene);sun.intensity=.85;
    this.camera=new ArcRotateCamera('orbit',-Math.PI/2,1.03,29,Vector3.Zero(),this.scene);
    this.camera.lowerBetaLimit=.34;this.camera.upperBetaLimit=1.40;
    this.camera.lowerRadiusLimit=7;this.camera.upperRadiusLimit=65;
    this.camera.wheelPrecision=35;this.camera.pinchPrecision=115;
    this.camera.panningSensibility=105;
    this.camera.attachControl(canvas,true);
    this.mats=Object.fromEntries(Object.entries(COLORS).map(([k,v])=>[k,material(this.scene,k,v)])) as Record<Terrain,StandardMaterial>;
    this.cityMat=material(this.scene,'stone','#d6c49c');
    this.roofMat=material(this.scene,'roof','#b16e47');
    this.treeMat=material(this.scene,'tree','#1e5839');
    this.unitMat=material(this.scene,'unit','#e9d39a');
    this.markerMat=material(this.scene,'marker','#f7d16c');
    const pointer=this.scene.onPointerObservable.add(info=>{
      if(info.type!==PointerEventTypes.POINTERPICK)return;
      let node=info.pickInfo?.pickedMesh;
      while(node && !node.metadata?.tile) node=node.parent as Mesh|null;
      if(node?.metadata?.tile){const {q,r}=node.metadata.tile as {q:number;r:number};this.click(q,r);}
    });
    void pointer;
    this.engine.runRenderLoop(()=>{if(!this.disposed)this.scene.render();});
  }
  private add(mesh:AbstractMesh,tile?:Hex):void {
    this.meshes.push(mesh);
    if(tile)mesh.metadata={tile:{q:tile.q,r:tile.r}};
  }
  private box(name:string,pos:Vector3,scale:Vector3,mat:StandardMaterial,tile:Hex):void {
    const box=MeshBuilder.CreateBox(name,{width:scale.x,height:scale.y,depth:scale.z},this.scene);
    box.position=pos;box.material=mat;this.add(box,tile);
  }
  private tree(tile:Hex,center:Vector3,index:number):void {
    const dx=index===0?-.24:.22;const dz=index===0?.2:-.18;
    this.box('trunk',center.add(new Vector3(dx,.30,dz)),new Vector3(.14,.55,.14),this.roofMat,tile);
    const crown=MeshBuilder.CreateCylinder('pine',{diameterBottom:.70,diameterTop:0,height:1.04,tessellation:5},this.scene);
    crown.position=center.add(new Vector3(dx,.85,dz));crown.material=this.treeMat;this.add(crown,tile);
  }
  private settlement(tile:Hex,center:Vector3):void {
    const base=center.add(new Vector3(0,.33,0));
    this.box('hall',base,new Vector3(.62,.70,.62),this.cityMat,tile);
    const roof=MeshBuilder.CreateCylinder('roof',{diameterBottom:.89,diameterTop:0,height:.45,tessellation:4},this.scene);
    roof.rotation.y=Math.PI/4;
    roof.position=center.add(new Vector3(0,.90,0));roof.material=this.roofMat;this.add(roof,tile);
    this.box('tower',center.add(new Vector3(.46,.39,.20)),new Vector3(.24,.80,.24),this.cityMat,tile);
  }
  setWorld(world:World):void {
    for(const mesh of this.meshes)mesh.dispose(false,true);
    this.meshes=[];
    const selected=world.selected;
    for(const hex of world.hexes) {
      const center=location(hex.q,hex.r);
      const height=.22+hex.elevation;
      const tile=MeshBuilder.CreateCylinder('hex-'+axialKey(hex.q,hex.r),{diameter:2.17,height,tessellation:6},this.scene);
      tile.position=center.add(new Vector3(0,height/2-.14,0));
      tile.rotation.y=Math.PI/6;
      tile.material=this.mats[hex.terrain];
      this.add(tile,hex);
      const top=center.add(new Vector3(0,height-.11,0));
      if(hex.terrain==='forest'){this.tree(hex,top,0);this.tree(hex,top,1);}
      if(hex.terrain==='mountain'){
        const peak=MeshBuilder.CreateCylinder('peak',{diameterBottom:1.1,diameterTop:0,height:1.25,tessellation:5},this.scene);
        peak.position=top.add(new Vector3(0,.6,0));peak.material=this.mats.mountain;this.add(peak,hex);
      }
      if(hex.city)this.settlement(hex,top);
      if(selected===axialKey(hex.q,hex.r)){
        const ring=MeshBuilder.CreateTorus('selection',{diameter:1.8,thickness:.085,tessellation:6},this.scene);
        ring.position=top.add(new Vector3(0,.04,0));ring.material=this.markerMat;this.add(ring,hex);
      }
    }
    for(const unit of world.units){
      const hex=world.hexes.find(h=>h.q===unit.q&&h.r===unit.r);
      if(!hex)continue;
      const top=location(hex.q,hex.r).add(new Vector3(0,.13+hex.elevation,0));
      this.box('unit-base',top.add(new Vector3(0,.12,0)),new Vector3(.30,.28,.32),this.unitMat,hex);
      const head=MeshBuilder.CreateSphere('scout-head',{diameter:.31,segments:5},this.scene);
      head.position=top.add(new Vector3(0,.45,0));head.material=this.unitMat;this.add(head,hex);
    }
  }
  resize():void {this.engine.resize();}
  zoom(direction:number):void {this.camera.radius=Math.max(7,Math.min(65,this.camera.radius+direction*3));}
  home():void {this.camera.setTarget(Vector3.Zero());this.camera.alpha=-Math.PI/2;this.camera.beta=1.03;this.camera.radius=29;}
  dispose():void {this.disposed=true;this.engine.stopRenderLoop();this.scene.dispose();this.engine.dispose();}
}
