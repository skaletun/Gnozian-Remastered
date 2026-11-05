import { useEffect, useState } from 'react';
import { t, getLanguage } from '../i18n';
import { GNOZIAN_RELEASE_VERSION } from '../game/releaseVersion';
import { playUiClick } from '../audio/AudioManager';
import { Gnz2DAsset } from './ui/Gnz2DAsset';
import './mobile-menu.css';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice?: Promise<{outcome:string}> };
type Props = {
  hasSave: boolean;
  playerNickname: string;
  onNewGame: () => void;
  onContinueGame: () => void;
  onLoadGame: () => void;
  onSettings?: () => void;
  onAchievements?: () => void;
  onMapEditor?: () => void;
  onTutorial?: () => void;
};

export default function MobileMainMenu({
  hasSave,playerNickname,onNewGame,onContinueGame,onLoadGame,
  onSettings,onAchievements,onMapEditor,onTutorial,
}:Props){
  const [online,setOnline]=useState(()=>navigator.onLine);
  const [prompt,setPrompt]=useState<InstallEvent|null>(null);
  const [showInstallHint,setShowInstallHint]=useState(false);
  const [installed,setInstalled]=useState(()=>window.matchMedia('(display-mode: standalone)').matches);
  useEffect(()=>{
    const update=()=>setOnline(navigator.onLine);
    const install=(event:Event)=>{event.preventDefault();setPrompt(event as InstallEvent);};
    const complete=()=>{setInstalled(true);setPrompt(null);};
    window.addEventListener('online',update);window.addEventListener('offline',update);
    window.addEventListener('beforeinstallprompt',install);window.addEventListener('appinstalled',complete);
    return ()=>{
      window.removeEventListener('online',update);window.removeEventListener('offline',update);
      window.removeEventListener('beforeinstallprompt',install);window.removeEventListener('appinstalled',complete);
    };
  },[]);
  const action=(callback?:()=>void)=>()=>{playUiClick();callback?.();};
  const isRu=getLanguage()==='ru';
  async function requestInstall(){
    if(prompt){await prompt.prompt();setPrompt(null);}
    else setShowInstallHint(true);
  }
  return <main className="rmm-root">
    <div className="rmm-landscape" aria-hidden="true">
      <div className="rmm-disc rmm-disc-outer"/>
      <div className="rmm-disc rmm-disc-inner"/>
      <div className="rmm-horizon"/>
      <div className="rmm-spire rmm-spire-one"/>
      <div className="rmm-spire rmm-spire-two"/>
    </div>
    <header className="rmm-top">
      <div className="rmm-mark" aria-label="Gnozian logo"><Gnz2DAsset name="empire" className="rmm-mark-asset" /></div>
      <div className="rmm-toptext"><strong>GNOZIAN</strong><span>REMASTERED</span></div>
      <div className="rmm-connection" aria-label={online?'Online':'Offline'}>
        <span className={online?'rmm-dot rmm-dot-online':'rmm-dot'}/>
        {online?'ONLINE':'OFFLINE'}
      </div>
    </header>
    <div className="rmm-body">
      <div className="rmm-overline">{isRu?'ЭПОХА ЦИВИЛИЗАЦИЙ':'RISE OF CIVILIZATIONS'}</div>
      <h1>{isRu?'ТВОЯ ИСТОРИЯ.':'YOUR HISTORY.'}<span>{isRu?'ТВОЯ ИМПЕРИЯ.':'YOUR EMPIRE.'}</span></h1>
      <p className="rmm-lead">
        {isRu?'Исследуй мир, строй города, веди дипломатию и перепиши историю.':
          'Explore the world, build cities, master diplomacy, and rewrite history.'}
      </p>
      <div className="rmm-sigil" aria-hidden="true"><span>✦</span><span>⬡</span><span>✦</span></div>
      <section className="rmm-primary" aria-label={isRu?'Начало игры':'Play'}>
        {hasSave&&<button type="button" className="rmm-continue" onClick={action(onContinueGame)}>
          <span className="rmm-button-symbol" aria-hidden="true"><Gnz2DAsset name="continue" className="rmm-icon" /></span>
          <span><strong>{t('menu.continueGame')}</strong><small>{isRu?'Вернуться к своей империи':'Return to your empire'}</small></span>
          <span className="rmm-chevron">›</span>
        </button>}
        <button type="button" className="rmm-newgame" onClick={action(onNewGame)}>
          <span className="rmm-button-symbol" aria-hidden="true"><Gnz2DAsset name="play" className="rmm-icon" /></span>
          <span><strong>{t('menu.newGame')}</strong><small>{isRu?'Основать новую цивилизацию':'Found a new civilization'}</small></span>
          <span className="rmm-chevron">›</span>
        </button>
      </section>
      <div className="rmm-grid">
        <button type="button" onClick={action(onLoadGame)}><Gnz2DAsset name="save" className="rmm-icon" />{t('menu.loadGame')}</button>
        {onSettings&&<button type="button" onClick={action(onSettings)}><Gnz2DAsset name="settings" className="rmm-icon" />{t('menu.settings')}</button>}
        {onAchievements&&<button type="button" onClick={action(onAchievements)}><Gnz2DAsset name="trophy" className="rmm-icon" />{t('menu.achievements')}</button>}
        {onTutorial&&<button type="button" onClick={action(onTutorial)}><Gnz2DAsset name="book" className="rmm-icon" />{t('menu.tutorial')}</button>}
        {onMapEditor&&<button type="button" onClick={action(onMapEditor)}><Gnz2DAsset name="map" className="rmm-icon" />{t('menu.mapEditor')}</button>}
        {!installed&&<button type="button" onClick={()=>void requestInstall()}><Gnz2DAsset name="download" className="rmm-icon" />{isRu?'Установить':'Install PWA'}</button>}
      </div>
      {showInstallHint&&<div className="rmm-install-hint" role="status">
        <span>{isRu?'Для установки открой меню браузера и выбери «Установить приложение» или «На экран Домой».':
          'Open your browser menu and choose Install App or Add to Home Screen.'}</span>
        <button type="button" onClick={()=>setShowInstallHint(false)} aria-label={isRu?'Закрыть':'Close'}>✕</button>
      </div>}
      <div className="rmm-identity">{isRu?'ПРАВИТЕЛЬ':'LEADER'} <strong>{playerNickname||'Gnozian'}</strong><span>✦</span> v{GNOZIAN_RELEASE_VERSION}</div>
    </div>
    <footer className="rmm-footer"><span>GNOZIAN REMASTERED</span><span>{isRu?'ОДИНОЧНАЯ ИГРА ДОСТУПНА ОФЛАЙН':'SINGLE PLAYER AVAILABLE OFFLINE'}</span></footer>
  </main>;
}
