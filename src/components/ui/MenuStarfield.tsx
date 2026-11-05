import { useMemo } from 'react';
import { twMerge } from 'tailwind-merge';

/** Deterministic PRNG so star positions do not change every React render (major menu perf fix). */
function lcg(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

export type MenuStarfieldProps = {
  count?: number;
  /** Changes the star pattern (e.g. per screen). */
  seed?: number;
  className?: string;
  /** When false, stars are static (cheaper; good for dense MP header). */
  twinkle?: boolean;
};

export function MenuStarfield({ count = 80, seed = 0x5e17c001, className, twinkle = true }: MenuStarfieldProps) {
  const stars = useMemo(() => {
    const rand = lcg(seed);
    return Array.from({ length: count }, (_, id) => {
      const size = 1 + rand() * 2;
      const left = rand() * 100;
      const top = rand() * 100;
      const opacity = 0.12 + rand() * 0.48;
      if (!twinkle) {
        return { id, size, left, top, opacity };
      }
      const dur = 2 + rand() * 3;
      const delay = rand() * 3;
      return {
        id,
        size,
        left,
        top,
        opacity,
        anim: `twinkle ${dur}s ease-in-out infinite`,
        animDelay: `${delay}s`,
      };
    });
  }, [count, seed, twinkle]);

  return (
    <div className={twMerge('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      {stars.map(s => (
        <div
          key={s.id}
          className="absolute rounded-full bg-white"
          style={{
            width: s.size,
            height: s.size,
            left: `${s.left}%`,
            top: `${s.top}%`,
            opacity: s.opacity,
            ...('anim' in s && s.anim
              ? { animation: s.anim, animationDelay: s.animDelay }
              : {}),
          }}
        />
      ))}
    </div>
  );
}
