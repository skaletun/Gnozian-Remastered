import { useCallback, useEffect, useState } from 'react';
import type { Language } from '../i18n';
import { getLanguage, setLanguage } from '../i18n';
import {
  DEFAULT_SETTINGS, GRAPHICS_PROFILE_PRESETS,
  type GameSettings, type GraphicsProfile, type GraphicsSettings,
} from '../game/settingsConstants';
import { loadSettings, saveSettingsToStorage } from '../game/settingsStorage';
import './mobile-settings.css';

type Tab = 'display' | 'controls' | 'gameplay' | 'audio' | 'language';
type Props = {
  onClose: () => void;
  onSave?: (settings: GameSettings) => void;
  onLanguageChange?: (language: Language) => void;
};

const LABELS = {
  ru: {
    title: 'НАСТРОЙКИ', subtitle: 'GNOZIAN REMASTERED',
    display: 'Графика', controls: 'Камера', gameplay: 'Игра', audio: 'Звук', language: 'Язык',
    close: 'Готово', reset: 'Сбросить настройки', confirm: 'Сбросить все настройки до стандартных?',
    profile: 'Профиль качества', performance: 'Экономия', balanced: 'Баланс', quality: 'Качество',
    render: 'Разрешение рендера', lower: 'Экономное', native: 'Обычное', sharp: 'Чёткое',
    details: 'Детали мира', territory: 'Территории цивилизаций',
    adaptive: 'Адаптивная производительность', adaptiveHint: 'Снижение нагрузки при падении FPS',
    camera: 'Чувствительность камеры', zoom: 'Масштабирование',
    invertX: 'Инвертировать горизонталь', invertY: 'Инвертировать вертикаль',
    tutorial: 'Один палец — вращение. Два пальца — панорамирование и масштабирование. Тап — выбрать клетку.',
    tooltip: 'Подсказки', autoTurn: 'Автоматически заканчивать ход',
    speed: 'Скорость анимации', slow: 'Медленно', normal: 'Обычно', fast: 'Быстро',
    master: 'Общая громкость', music: 'Музыка', sounds: 'Звуковые эффекты',
    fullscreen: 'Полный экран', exitFullscreen: 'Выйти из полного экрана',
    unsupported: 'Полноэкранный режим не поддерживается этим браузером',
    offline: 'Настройки сохраняются на устройстве и работают без сети',
    english: 'English', russian: 'Русский',
    version: 'Настройки применяются сразу',
  },
  en: {
    title: 'SETTINGS', subtitle: 'GNOZIAN REMASTERED',
    display: 'Graphics', controls: 'Camera', gameplay: 'Game', audio: 'Audio', language: 'Language',
    close: 'Done', reset: 'Reset all settings', confirm: 'Restore default settings?',
    profile: 'Quality preset', performance: 'Battery saver', balanced: 'Balanced', quality: 'Quality',
    render: 'Render resolution', lower: 'Lower', native: 'Native', sharp: 'Sharper',
    details: 'World details', territory: 'Civilization borders',
    adaptive: 'Adaptive performance', adaptiveHint: 'Reduce GPU load when FPS drops',
    camera: 'Camera sensitivity', zoom: 'Zoom sensitivity',
    invertX: 'Invert horizontal', invertY: 'Invert vertical',
    tutorial: 'One finger: orbit. Two fingers: pan and zoom. Tap a tile to select it.',
    tooltip: 'Tooltips', autoTurn: 'Automatically end turn',
    speed: 'Animation speed', slow: 'Slow', normal: 'Normal', fast: 'Fast',
    master: 'Master volume', music: 'Music', sounds: 'Sound effects',
    fullscreen: 'Fullscreen', exitFullscreen: 'Exit fullscreen',
    unsupported: 'This browser does not support fullscreen',
    offline: 'Preferences are stored on this device and work offline',
    english: 'English', russian: 'Русский',
    version: 'Settings apply instantly',
  },
} as const;

function Toggle({ name, hint, value, onChange }: {
  name: string; hint?: string; value: boolean; onChange: (next: boolean) => void;
}) {
  return <label className="rm-toggle">
    <span className="rm-toggle-label"><strong>{name}</strong>{hint && <small>{hint}</small>}</span>
    <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} />
    <span className="rm-switch" aria-hidden="true" />
  </label>;
}
function Range({ name, value, min, max, step, unit, onChange }: {
  name: string; value: number; min: number; max: number; step: number;
  unit: string; onChange: (value: number) => void;
}) {
  const percent = ((value - min) / (max - min)) * 100;
  return <label className="rm-range">
    <span className="rm-range-head"><strong>{name}</strong><output>{value.toFixed(step < 1 ? 2 : 0)}{unit}</output></span>
    <input type="range" min={min} max={max} step={step} value={value}
      style={{ background: 'linear-gradient(90deg,#e9c17d '+percent+'%,#36515e '+percent+'%)' }}
      onChange={e => onChange(e.currentTarget.valueAsNumber)} />
  </label>;
}
function Choices<T extends string | number>({ name, options, value, onChange }: {
  name: string; options: ReadonlyArray<{value:T; label:string}>; value:T; onChange:(value:T)=>void;
}) {
  return <fieldset className="rm-choices">
    <legend>{name}</legend>
    <div className="rm-options">{options.map(option =>
      <button type="button" key={String(option.value)} aria-pressed={option.value === value}
        className={option.value === value ? 'rm-option rm-option-active' : 'rm-option'}
        onClick={() => onChange(option.value)}>{option.label}</button>
    )}</div>
  </fieldset>;
}

export default function MobileSettingsScreen({ onClose, onSave, onLanguageChange }: Props) {
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [tab, setTab] = useState<Tab>('display');
  const [fullscreen, setFullscreen] = useState(!!document.fullscreenElement);
  const strings = LABELS[settings.language];
  const commit = useCallback((update: (old: GameSettings) => GameSettings) => {
    setSettings(old => {
      const next = update(old);
      saveSettingsToStorage(next);
      if (old.language !== next.language || getLanguage() !== next.language) {
        setLanguage(next.language);
        onLanguageChange?.(next.language);
      }
      onSave?.(next);
      return next;
    });
  }, [onSave, onLanguageChange]);
  const graphic = useCallback(<K extends keyof GraphicsSettings>(key: K, value: GraphicsSettings[K]) => {
    commit(old => ({ ...old, graphics: { ...old.graphics, [key]: value } }));
  }, [commit]);
  const control = useCallback(<K extends keyof GameSettings['cameraControls']>(key: K, value: GameSettings['cameraControls'][K]) => {
    commit(old => ({ ...old, cameraControls: { ...old.cameraControls, [key]: value } }));
  }, [commit]);
  useEffect(() => {
    const listener = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', listener);
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.fullscreenElement) onClose();
    };
    window.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('fullscreenchange', listener);
      window.removeEventListener('keydown', escape);
    };
  }, [onClose]);
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { /* iOS Safari does not offer element fullscreen */ }
  }
  const tabs: { key: Tab; icon: string; name: string }[] = [
    { key:'display', icon:'◈', name:strings.display },
    { key:'controls', icon:'◎', name:strings.controls },
    { key:'gameplay', icon:'⌘', name:strings.gameplay },
    { key:'audio', icon:'♫', name:strings.audio },
    { key:'language', icon:'文', name:strings.language },
  ];
  return <div className="rm-overlay" role="presentation">
    <section className="rm-panel" role="dialog" aria-modal="true" aria-labelledby="rm-settings-title">
      <header className="rm-header">
        <div><small>{strings.subtitle}</small><h1 id="rm-settings-title">{strings.title}</h1></div>
        <button type="button" className="rm-close" onClick={onClose} aria-label={strings.close}>✕</button>
      </header>
      <nav className="rm-tabs" aria-label={strings.title}>{tabs.map(item =>
        <button type="button" key={item.key} className={tab===item.key?'rm-tab rm-tab-active':'rm-tab'}
          onClick={()=>setTab(item.key)} aria-current={tab===item.key?'page':undefined}>
          <span aria-hidden="true">{item.icon}</span><span>{item.name}</span>
        </button>
      )}</nav>
      <div className="rm-scroll" key={tab}>
        {tab==='display' && <div className="rm-section">
          <Choices name={strings.profile} value={settings.graphics.graphicsProfile === 'cinematic'?'quality':settings.graphics.graphicsProfile}
            options={(['performance','balanced','quality'] as GraphicsProfile[]).map(value=>({
              value,label:strings[value],
            }))} onChange={profile=>commit(old=>({
              ...old,graphics:{...old.graphics,...GRAPHICS_PROFILE_PRESETS[profile],graphicsProfile:profile,
                showTerritory:old.graphics.showTerritory,showRevealEffects:old.graphics.showRevealEffects,
              },
            }))} />
          <Choices name={strings.render} value={settings.graphics.renderScale} options={[
            {value:0.75 as const,label:strings.lower},
            {value:1 as const,label:strings.native},
            {value:1.25 as const,label:strings.sharp},
          ]} onChange={value=>graphic('renderScale',value)} />
          <Toggle name={strings.details} value={settings.graphics.terrainDetails} onChange={v=>graphic('terrainDetails',v)} />
          <Toggle name={strings.territory} value={settings.graphics.showTerritory}
            onChange={v=>commit(old=>({...old,graphics:{...old.graphics,showTerritory:v,territoryBorders:v}}))} />
          <Toggle name={strings.adaptive} hint={strings.adaptiveHint} value={settings.graphics.adaptiveFrameQualityScaling}
            onChange={v=>graphic('adaptiveFrameQualityScaling',v)} />
          {'requestFullscreen' in document.documentElement &&
            <button className="rm-row-action" type="button" onClick={()=>void toggleFullscreen()}>
              {fullscreen?strings.exitFullscreen:strings.fullscreen} <span aria-hidden="true">↗</span>
            </button>}
        </div>}
        {tab==='controls' && <div className="rm-section">
          <p className="rm-help">{strings.tutorial}</p>
          <Range name={strings.camera} min={0.3} max={3} step={0.05} unit="×"
            value={settings.cameraControls.sensitivity} onChange={v=>control('sensitivity',v)} />
          <Range name={strings.zoom} min={0.3} max={3} step={0.05} unit="×"
            value={settings.cameraControls.zoomSensitivity} onChange={v=>control('zoomSensitivity',v)} />
          <Toggle name={strings.invertX} value={settings.cameraControls.invertX} onChange={v=>control('invertX',v)} />
          <Toggle name={strings.invertY} value={settings.cameraControls.invertY} onChange={v=>control('invertY',v)} />
        </div>}
        {tab==='gameplay' && <div className="rm-section">
          <Toggle name={strings.tooltip} value={settings.showTooltips}
            onChange={v=>commit(old=>({...old,showTooltips:v}))} />
          <Toggle name={strings.autoTurn} value={settings.autoEndTurn}
            onChange={v=>commit(old=>({...old,autoEndTurn:v}))} />
          <Choices name={strings.speed} value={settings.animationSpeed} options={[
            {value:'slow',label:strings.slow},
            {value:'normal',label:strings.normal},
            {value:'fast',label:strings.fast},
          ]} onChange={v=>commit(old=>({...old,animationSpeed:v}))} />
        </div>}
        {tab==='audio' && <div className="rm-section">
          <Range name={strings.master} value={Math.round(settings.masterVolume*100)}
            min={0} max={100} step={1} unit="%" onChange={v=>commit(old=>({...old,masterVolume:v/100}))} />
          <Range name={strings.music} value={Math.round(settings.musicVolume*100)}
            min={0} max={100} step={1} unit="%" onChange={v=>commit(old=>({...old,musicVolume:v/100}))} />
          <Range name={strings.sounds} value={Math.round(settings.sfxVolume*100)}
            min={0} max={100} step={1} unit="%" onChange={v=>commit(old=>({...old,sfxVolume:v/100}))} />
        </div>}
        {tab==='language' && <div className="rm-section">
          <Choices name={strings.language} value={settings.language} options={[
            {value:'ru',label:strings.russian},
            {value:'en',label:strings.english},
          ]} onChange={v=>commit(old=>({...old,language:v}))} />
        </div>}
        <p className="rm-footnote">{strings.offline}</p>
        <button className="rm-reset" type="button" onClick={()=>{
          if(window.confirm(strings.confirm))commit(()=>({
            ...DEFAULT_SETTINGS, graphics:{...DEFAULT_SETTINGS.graphics},
            cameraControls:{...DEFAULT_SETTINGS.cameraControls},
          }));
        }}>{strings.reset}</button>
      </div>
      <footer className="rm-footer"><small>{strings.version}</small>
        <button type="button" className="rm-done" onClick={onClose}>{strings.close} ✓</button>
      </footer>
    </section>
  </div>;
}
