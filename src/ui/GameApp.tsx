import { useCallback, useEffect, useRef, useState } from 'react';
import { BabylonWorld } from '../render/BabylonWorld';
import { endTurn, foundCity, loadWorld, moveSelected, newWorld, saveWorld, selectHex, type World } from '../game/world';

export function GameApp() {
  const [world,setWorld]=useState<World>(()=>loadWorld());
  const [installPrompt,setInstallPrompt]=useState<{prompt:()=>Promise<void>}|null>(null);
  const canvas=useRef<HTMLCanvasElement>(null);
  const renderer=useRef<BabylonWorld|null>(null);
  const pick=useRef<(q:number,r:number)=>void>(()=>{});
  pick.current=(q,r)=>setWorld(w=>selectHex(w,q,r));
  useEffect(()=>{
    const target=canvas.current;
    if(!target)return;
    let graphics:BabylonWorld;
    try{graphics=new BabylonWorld(target,(q,r)=>pick.current(q,r));}catch(error){
      console.error('WebGL initialization failed',error);target.style.display='none';return;
    }
    renderer.current=graphics;
    const resize=()=>graphics.resize();
    window.addEventListener('resize',resize);
    const observer=new ResizeObserver(resize);
    observer.observe(target);
    return ()=>{observer.disconnect();window.removeEventListener('resize',resize);renderer.current=null;graphics.dispose();};
  },[]);
  useEffect(()=>{renderer.current?.setWorld(world);saveWorld(world);},[world]);
  useEffect(()=>{
    function beforeInstall(event:Event) {
      event.preventDefault();
      const deferred=event as Event & {prompt:()=>Promise<void>};
      setInstallPrompt({prompt:()=>deferred.prompt()});
    }
    window.addEventListener('beforeinstallprompt',beforeInstall);
    return ()=>window.removeEventListener('beforeinstallprompt',beforeInstall);
  },[]);
  const selected=world.hexes.find(h=>`${h.q},${h.r}`===world.selected);
  const selectedUnit=world.units.find(u=>`${u.q},${u.r}`===world.selected);
  const tapMove=useCallback(()=>{
    if(!world.selected)return;
    const unit=world.units.find(u=>u.owner===0&&u.moves>0);
    if(!unit)return;
    const tile=world.hexes.find(h=>`${h.q},${h.r}`===world.selected);
    if(!tile)return;
    // Select a destination: move the first player unit to the touched neighboring cell.
    setWorld(w=>moveSelected({...w,selected:`${unit.q},${unit.r}`},tile.q,tile.r));
  },[world]);
  return <main className="game">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">⬡</span><div><strong>GNOZIAN</strong><small>REMASTERED · EARLY BUILD</small></div></div>
      <div className="resources"><span title="Food">🍞 {world.food}</span><span title="Production">⚒ {world.production}</span><span title="Gold">◈ {world.gold}</span></div>
    </header>
    <section className="viewport" aria-label="Интерактивная трёхмерная карта">
      <canvas ref={canvas} className="world-canvas" aria-label="Babylon.js 3D world" />
      <div className="map-hint">Пальцем: вращение и масштаб · тап: выбор гекса</div>
      <div className="view-controls">
        <button aria-label="Приблизить" onClick={()=>renderer.current?.zoom(-1)}>＋</button>
        <button aria-label="Отдалить" onClick={()=>renderer.current?.zoom(1)}>－</button>
        <button aria-label="Центрировать" onClick={()=>renderer.current?.home()}>⌂</button>
      </div>
      <div className="compass">3D · LOW POLY</div>
    </section>
    <footer className="control-panel">
      <div className="turn-box"><small>ХОД</small><b>{world.turn}</b></div>
      <div className="selection"><b>{selected? `Гекс ${selected.q}, ${selected.r}`:'Исследуйте мир'}</b><span>{selected? `Ландшафт: ${selected.terrain}${selected.city?' · Город':''}${selectedUnit?' · Разведчик':''}`:'Выберите клетку на карте'}</span></div>
      <div className="actions">
        <button disabled={!selected||!!selectedUnit} onClick={tapMove} title="Переместить разведчика в соседнюю клетку">Идти</button>
        <button disabled={!selectedUnit||world.production<5} onClick={()=>setWorld(foundCity)} title="Основание города за 5 производства">Город</button>
        <button className="primary" onClick={()=>setWorld(endTurn)}>Ход →</button>
      </div>
    </footer>
    <aside className="utility-bar">
      <button onClick={()=>{if(window.confirm('Начать новую игру? Текущее сохранение будет заменено.'))setWorld(newWorld(Math.floor(Math.random()*100000000)));}}>Новая карта</button>
      <button onClick={()=>{const blob=new Blob([JSON.stringify(world)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='gnozian-remastered-save.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);}}>Экспорт сохранения</button>
      {installPrompt&&<button onClick={()=>{void installPrompt.prompt();setInstallPrompt(null);}}>Установить игру</button>}
    </aside>
  </main>;
}
