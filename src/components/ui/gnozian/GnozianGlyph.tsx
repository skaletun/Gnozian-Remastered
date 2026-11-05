/**
 * Compact UI glyphs (24×24) — gold/ink line art matching gnozian-ico / GNOZIAN palette.
 * Use with Tailwind: className="text-amber-300" for stroke via currentColor.
 */
import { memo, type ReactNode } from 'react';
import { Gnz2DAsset, type Gnz2DIconName } from '../Gnz2DAsset';

export type GnozianGlyphName =
  | 'globe'
  | 'empire'
  | 'city'
  | 'crown'
  | 'chart'
  | 'book'
  | 'trophy'
  | 'target'
  | 'star'
  | 'gear'
  | 'save'
  | 'map'
  | 'compass'
  | 'rocket'
  | 'wave'
  | 'dice'
  | 'play'
  | 'door'
  | 'volume'
  | 'music'
  | 'bell'
  | 'gamepad'
  | 'palette'
  | 'monitor'
  | 'info'
  | 'turtle'
  | 'walk'
  | 'bolt'
  | 'sparkles'
  | 'chat'
  | 'grid'
  | 'moon'
  | 'sun'
  | 'flask'
  | 'swords'
  | 'temple'
  | 'handshake'
  | 'warn'
  | 'religion'
  | 'volcano'
  | 'monolith'
  | 'masks'
  | 'spy'
  | 'food'
  | 'shield'
  | 'sword'
  | 'bow'
  | 'foot'
  | 'cog'
  | 'culture'
  | 'science'
  | 'diplomacy'
  | 'mountain'
  | 'islands'
  | 'lake'
  | 'home'
  | 'hammer'
  | 'pickaxe'
  | 'war'
  | 'user'
  | 'refresh'
  | 'keyboard'
  | 'check';

type Msg = import('../../../game/types').GameMessage['type'];

const GLYPHS: Record<GnozianGlyphName, (p: { sw: number }) => ReactNode> = {
  globe: ({ sw }) => (
    <>
      <circle cx="12" cy="12" r="9" strokeWidth={sw} />
      <ellipse cx="12" cy="12" rx="3.5" ry="9" strokeWidth={sw} />
      <path d="M3 12h18" strokeWidth={sw} />
    </>
  ),
  empire: ({ sw }) => (
    <>
      <path
        d="M7 18V10M10 18V8M13 18V6M16 18V9"
        strokeWidth={sw}
        strokeLinecap="round"
      />
      <path d="M6 8h12l-1-4H7z" strokeWidth={sw} strokeLinejoin="round" />
    </>
  ),
  city: ({ sw }) => (
    <>
      <path d="M5 18V11l3-2 3 2 3-2 3 2v7" strokeWidth={sw} strokeLinejoin="round" />
      <path d="M9 18v-3h6v3" strokeWidth={sw} />
    </>
  ),
  crown: ({ sw }) => (
    <>
      <path
        d="M5 16l2-8 3 4 2-6 3 6 3-4 2 8H5z"
        strokeWidth={sw}
        strokeLinejoin="round"
      />
    </>
  ),
  chart: ({ sw }) => (
    <>
      <path d="M4 18V6M8 18v-8M12 18V9M16 18v-5M20 18V4" strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  book: ({ sw }) => (
    <>
      <path d="M6 5h5a2 2 0 012 2v12a2 2 0 00-2-2H6z" strokeWidth={sw} />
      <path d="M18 5h-5a2 2 0 00-2 2v12a2 2 0 012-2h5z" strokeWidth={sw} />
    </>
  ),
  trophy: ({ sw }) => (
    <>
      <path d="M8 6h8v4a4 4 0 01-8 0V6z" strokeWidth={sw} />
      <path d="M6 8H4M18 8h2M8 18h8M9 14h6" strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  target: ({ sw }) => (
    <>
      <circle cx="12" cy="12" r="9" strokeWidth={sw} />
      <circle cx="12" cy="12" r="5" strokeWidth={sw} />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </>
  ),
  star: ({ sw }) => (
    <path
      d="M12 3l2.2 6.8H21l-5.5 4 2.1 6.7L12 16.3 6.4 20.5l2.1-6.7L3 9.8h6.8z"
      strokeWidth={sw}
      strokeLinejoin="round"
    />
  ),
  gear: ({ sw }) => (
    <path
      d="M12 8a4 4 0 014 4 4 4 0 01-4 4 4 4 0 01-4-4 4 4 0 014-4zm0-3v2m0 10v2M5.6 6.4l1.4 1.4m10 10l1.4 1.4M4 12h2m12 0h2M5.6 17.6l1.4-1.4m10-10l1.4-1.4"
      strokeWidth={sw}
      strokeLinecap="round"
    />
  ),
  save: ({ sw }) => (
    <>
      <rect x="5" y="4" width="14" height="16" rx="2" strokeWidth={sw} />
      <path d="M9 4v4h6V4" strokeWidth={sw} />
      <rect x="8" y="12" width="8" height="6" rx="1" strokeWidth={sw} />
    </>
  ),
  map: ({ sw }) => (
    <>
      <path d="M5 6l4-2 5 2 5-2v14l-5 2-5-2-4 2z" strokeWidth={sw} strokeLinejoin="round" />
      <path d="M9 4v14M14 6v14" strokeWidth={sw} opacity={0.6} />
    </>
  ),
  compass: ({ sw }) => (
    <>
      <circle cx="12" cy="12" r="9" strokeWidth={sw} />
      <path d="M12 5l2 7-2 7-2-7z" fill="currentColor" opacity={0.35} stroke="none" />
      <path d="M12 5l2 7-2 7-2-7z" strokeWidth={sw} strokeLinejoin="round" />
    </>
  ),
  rocket: ({ sw }) => (
    <>
      <path d="M12 3L9 14h6z" strokeWidth={sw} strokeLinejoin="round" />
      <path d="M9 14H6l-2 3M15 14h3l2 3" strokeWidth={sw} strokeLinecap="round" />
      <path d="M10 18h4" strokeWidth={sw} />
    </>
  ),
  wave: ({ sw }) => (
    <path
      d="M3 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 16c2-2 4-2 6 0s4 2 6 0 4-2 6 0"
      strokeWidth={sw}
      strokeLinecap="round"
    />
  ),
  dice: ({ sw }) => (
    <>
      <rect x="5" y="5" width="14" height="14" rx="2" strokeWidth={sw} transform="rotate(-8 12 12)" />
      <circle cx="9" cy="9" r="1" fill="currentColor" />
      <circle cx="15" cy="15" r="1" fill="currentColor" />
    </>
  ),
  play: () => <path d="M8 6l10 6-10 6z" fill="currentColor" stroke="none" />,
  door: ({ sw }) => (
    <>
      <rect x="6" y="4" width="10" height="16" rx="1" strokeWidth={sw} />
      <circle cx="13" cy="12" r="1" fill="currentColor" />
    </>
  ),
  volume: ({ sw }) => (
    <>
      <path d="M5 10v4h3l4 3V7L8 10z" strokeWidth={sw} strokeLinejoin="round" />
      <path d="M15 9a4 4 0 010 6M17 7a7 7 0 010 10" strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  music: ({ sw }) => (
    <>
      <path d="M8 18V8l8-2v10" strokeWidth={sw} strokeLinecap="round" />
      <circle cx="6" cy="18" r="2" strokeWidth={sw} />
      <circle cx="14" cy="16" r="2" strokeWidth={sw} />
    </>
  ),
  bell: ({ sw }) => (
    <>
      <path d="M12 4a4 4 0 014 4v5l2 3H6l2-3V8a4 4 0 014-4z" strokeWidth={sw} strokeLinejoin="round" />
      <path d="M10 20h4" strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  gamepad: ({ sw }) => (
    <>
      <path d="M6 10h12a4 4 0 014 4v1a3 3 0 01-3 3h-1a3 3 0 01-3-3v-1H7a3 3 0 01-3 3H3a3 3 0 01-3-3v-1a4 4 0 014-4z" strokeWidth={sw} />
      <circle cx="8" cy="14" r="1" fill="currentColor" />
      <path d="M16 13v2M15 14h2" strokeWidth={sw} />
    </>
  ),
  palette: ({ sw }) => (
    <>
      <path
        d="M12 4a8 8 0 018 8c0 3-2 4-4 4h-2a2 2 0 00-2 2 2 2 0 01-4 0 8 8 0 010-14z"
        strokeWidth={sw}
      />
      <circle cx="9" cy="9" r="1" fill="currentColor" opacity={0.7} />
      <circle cx="14" cy="8" r="1" fill="currentColor" opacity={0.7} />
    </>
  ),
  monitor: ({ sw }) => (
    <>
      <rect x="4" y="5" width="16" height="11" rx="1" strokeWidth={sw} />
      <path d="M8 19h8M12 16v3" strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  info: ({ sw }) => (
    <>
      <circle cx="12" cy="12" r="9" strokeWidth={sw} />
      <path d="M12 10v6M12 7v1" strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  turtle: ({ sw }) => (
    <>
      <ellipse cx="12" cy="14" rx="7" ry="4" strokeWidth={sw} />
      <path d="M5 14H3M19 14h2M8 10c-1-2 1-4 4-4s5 2 4 4" strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  walk: ({ sw }) => (
    <>
      <circle cx="9" cy="6" r="2" strokeWidth={sw} />
      <path d="M9 9l-1 6M9 9l2 5M9 12h3l2 4M7 18l2-3" strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  bolt: ({ sw }) => <path d="M13 3L8 13h4l-1 8 7-12h-5z" strokeWidth={sw} strokeLinejoin="round" />,
  sparkles: ({ sw }) => (
    <>
      <path d="M12 3v4M12 17v4M4 12h4M16 12h4M6.3 6.3l2.8 2.8M15 15l2.8 2.8M17.7 6.3L15 9M9 15l-2.8 2.8" strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  chat: ({ sw }) => (
    <>
      <path d="M5 6h14a2 2 0 012 2v6a2 2 0 01-2 2H10l-4 3v-3H5a2 2 0 01-2-2V8a2 2 0 012-2z" strokeWidth={sw} />
    </>
  ),
  grid: ({ sw }) => (
    <>
      <path d="M4 8h16M4 12h16M4 16h16M8 4v16M12 4v16M16 4v16" strokeWidth={sw} />
    </>
  ),
  moon: ({ sw }) => <path d="M18 14a7 7 0 11-9-9 6 6 0 109 9z" strokeWidth={sw} />,
  sun: ({ sw }) => (
    <>
      <circle cx="12" cy="12" r="4" strokeWidth={sw} />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  flask: ({ sw }) => (
    <>
      <path d="M9 3h6M10 3v6l-3 11h10l-3-11V3" strokeWidth={sw} strokeLinejoin="round" />
      <path d="M8 16h8" strokeWidth={sw} opacity={0.5} />
    </>
  ),
  swords: ({ sw }) => (
    <>
      <path d="M6 18L16 4M7 4l10 14" strokeWidth={sw} strokeLinecap="round" />
      <path d="M5 17l2 2M17 5l2 2" strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  temple: ({ sw }) => (
    <>
      <path d="M4 18h16M6 18V10l6-6 6 6v8" strokeWidth={sw} strokeLinejoin="round" />
      <path d="M9 18v-5h6v5" strokeWidth={sw} />
    </>
  ),
  handshake: ({ sw }) => (
    <>
      <path d="M4 12l3-2 2 1 3-3 2 2 3-1 3 3" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 14l4 4h4l2-2" strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  warn: ({ sw }) => (
    <>
      <path d="M12 4l9 16H3z" strokeWidth={sw} strokeLinejoin="round" />
      <path d="M12 9v5M12 17v1" strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  religion: ({ sw }) => (
    <>
      <circle cx="12" cy="8" r="3" strokeWidth={sw} />
      <path d="M8 18c0-3 2-5 4-5s4 2 4 5" strokeWidth={sw} />
    </>
  ),
  volcano: ({ sw }) => (
    <>
      <path d="M4 18h16M7 18L10 10l2 4 2-6 3 10" strokeWidth={sw} strokeLinejoin="round" />
      <path d="M11 6l1-2 1 2" strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  monolith: ({ sw }) => (
    <>
      <path d="M10 4l-2 14h8L14 4z" strokeWidth={sw} strokeLinejoin="round" />
      <path d="M8 18h8" strokeWidth={sw} />
    </>
  ),
  masks: ({ sw }) => (
    <>
      <ellipse cx="8" cy="11" rx="4" ry="5" strokeWidth={sw} />
      <ellipse cx="16" cy="12" rx="3.5" ry="4.5" strokeWidth={sw} opacity={0.75} />
    </>
  ),
  spy: ({ sw }) => (
    <>
      <ellipse cx="12" cy="10" rx="6" ry="4" strokeWidth={sw} />
      <path d="M6 10H4M18 10h2M9 14l-2 5M15 14l2 5" strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  food: ({ sw }) => (
    <>
      <path d="M12 4c-2 4-5 7-5 11a5 5 0 0010 0c0-4-3-7-5-11z" strokeWidth={sw} strokeLinejoin="round" />
    </>
  ),
  shield: ({ sw }) => <path d="M12 3l7 3v6c0 4-3 8-7 10-4-2-7-6-7-10V6z" strokeWidth={sw} strokeLinejoin="round" />,
  sword: ({ sw }) => (
    <>
      <path d="M8 4l10 10M9 15l2 2" strokeWidth={sw} strokeLinecap="round" />
      <path d="M6 18l3-3" strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  bow: ({ sw }) => (
    <>
      <path d="M5 18c4-6 4-10 0-16M5 10h10" strokeWidth={sw} strokeLinecap="round" />
      <path d="M15 10l2-1" strokeWidth={sw} />
    </>
  ),
  foot: ({ sw }) => (
    <>
      <ellipse cx="10" cy="8" rx="3" ry="4" strokeWidth={sw} transform="rotate(-15 10 8)" />
      <ellipse cx="14" cy="14" rx="2.5" ry="3.5" strokeWidth={sw} transform="rotate(10 14 14)" />
    </>
  ),
  cog: ({ sw }) => (
    <>
      <circle cx="12" cy="12" r="3" strokeWidth={sw} />
      <path d="M12 5v2m0 10v2M5 12h2m10 0h2M7 7l1.5 1.5M15.5 15.5L17 17M17 7l-1.5 1.5M7.5 15.5L6 17" strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  culture: ({ sw }) => (
    <>
      <path d="M8 6c-2 6-2 10 0 12M16 7c2 5 2 9 0 12" strokeWidth={sw} strokeLinecap="round" />
      <path d="M6 18h12" strokeWidth={sw} />
    </>
  ),
  science: ({ sw }) => (
    <>
      <circle cx="12" cy="12" r="3" strokeWidth={sw} />
      <ellipse cx="12" cy="12" rx="9" ry="4" strokeWidth={sw} transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="4" strokeWidth={sw} transform="rotate(-60 12 12)" />
    </>
  ),
  diplomacy: ({ sw }) => (
    <>
      <circle cx="12" cy="12" r="9" strokeWidth={sw} />
      <ellipse cx="12" cy="12" rx="3.5" ry="9" strokeWidth={sw} />
      <path d="M3 12h18" strokeWidth={sw} />
    </>
  ),
  mountain: ({ sw }) => (
    <>
      <path d="M4 18L10 6l4 6 6-12 4 18z" strokeWidth={sw} strokeLinejoin="round" />
    </>
  ),
  islands: ({ sw }) => (
    <>
      <path d="M4 14c2-1 4 0 5 2M11 10c2-1 4 1 4 3M17 14c1-2 3-3 5-2" strokeWidth={sw} strokeLinecap="round" />
      <path d="M3 18h18" strokeWidth={sw} opacity={0.4} />
    </>
  ),
  lake: ({ sw }) => (
    <>
      <path d="M5 14c2-3 5-4 8-2s6 0 8-3" strokeWidth={sw} strokeLinecap="round" />
      <ellipse cx="12" cy="16" rx="7" ry="2" strokeWidth={sw} />
    </>
  ),
  home: ({ sw }) => (
    <>
      <path d="M4 10l8-6 8 6v10H4z" strokeWidth={sw} strokeLinejoin="round" />
      <rect x="9" y="14" width="6" height="6" strokeWidth={sw} />
    </>
  ),
  hammer: ({ sw }) => (
    <>
      <path d="M5 16l8-8M14 6l3 3-2 2-3-3z" strokeWidth={sw} strokeLinejoin="round" />
      <path d="M4 18l2-2" strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  pickaxe: ({ sw }) => (
    <>
      <path d="M6 17l10-10M15 5l3 3-2 2" strokeWidth={sw} strokeLinejoin="round" />
      <path d="M5 18l2-2" strokeWidth={sw} />
    </>
  ),
  war: ({ sw }) => GLYPHS.swords({ sw }),
  user: ({ sw }) => (
    <>
      <circle cx="12" cy="8" r="3" strokeWidth={sw} />
      <path d="M6 18c0-4 2.5-6 6-6s6 2 6 6" strokeWidth={sw} />
    </>
  ),
  refresh: ({ sw }) => (
    <>
      <path d="M5 8a7 7 0 0112-2M19 16a7 7 0 01-12 2" strokeWidth={sw} />
      <path d="M17 6V2h-4M7 18v4h4" strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  keyboard: ({ sw }) => (
    <>
      <rect x="3" y="7" width="18" height="10" rx="1" strokeWidth={sw} />
      <path d="M6 10h2M10 10h2M14 10h2M6 13h12M6 16h8" strokeWidth={sw} />
    </>
  ),
  check: ({ sw }) => (
    <>
      <path d="M4 12l5 5L20 6" strokeWidth={sw} />
    </>
  ),
};


/** Use crisp, gold-trimmed atomic artwork at display sizes. Text-sized glyphs
 * remain their original currentColor vector outlines for maximum legibility. */
const REMASTER_GLYPH: Partial<Record<GnozianGlyphName, Gnz2DIconName>> = {
  globe:'world', empire:'empire', city:'city', crown:'trophy', chart:'economy',
  book:'book', trophy:'trophy', target:'scout', star:'star', gear:'settings',
  save:'save', map:'map', compass:'scout', rocket:'science', wave:'ocean',
  dice:'hex', play:'play', door:'exit', bell:'warning', palette:'culture',
  monitor:'eye', walk:'movement', sparkles:'star', chat:'diplomacy',
  grid:'hex', sun:'star', flask:'science', swords:'war', temple:'government',
  handshake:'diplomacy', warn:'warning', religion:'culture', volcano:'mountain',
  monolith:'ruins', masks:'culture', spy:'eye', food:'food', shield:'shield',
  sword:'war', bow:'archer', foot:'movement', cog:'production',
  culture:'culture', science:'science', diplomacy:'diplomacy',
  mountain:'mountain', islands:'ship', lake:'ocean', home:'city',
  hammer:'hammer', pickaxe:'mine', war:'war', user:'population',
  refresh:'continue', keyboard:'menu', check:'check',
};

export const GnozianGlyph = memo(function GnozianGlyph({
  name,
  size = 18,
  className,
  title,
}: {
  name: GnozianGlyphName;
  size?: number;
  className?: string;
  title?: string;
}) {
  const remastered = REMASTER_GLYPH[name];
  if (size >= 20 && remastered) {
    return (
      <Gnz2DAsset
        name={remastered}
        size={size >= 82 ? 'lg' : size >= 45 ? 'md' : 'sm'}
        width={size}
        height={size}
        className={`inline-block shrink-0 ${className ?? ''}`}
        alt={title ?? ''}
        aria-hidden={title ? undefined : true}
      />
    );
  }
  const sw = 1.55;
  const Body = GLYPHS[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`inline-block shrink-0 ${className ?? ''}`}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <g stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <Body sw={sw} />
      </g>
    </svg>
  );
});

export const MESSAGE_GLYPH: Record<Msg, GnozianGlyphName> = {
  tech: 'flask',
  combat: 'swords',
  city: 'temple',
  diplomacy: 'handshake',
  warning: 'warn',
  info: 'info',
  religion: 'religion',
  disaster: 'volcano',
  wonder: 'monolith',
  tourism: 'masks',
  espionage: 'spy',
};