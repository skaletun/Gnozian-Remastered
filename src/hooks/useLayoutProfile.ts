import { useEffect, useMemo, useRef, useState } from 'react';

export type LayoutProfile = 'desktop' | 'tablet' | 'mobile';
export interface LayoutDimensions { width: number; height: number; touch: boolean }

/** Landscape phones must use the phone HUD even when width exceeds 820 px. */
export function resolveLayoutProfile({ width, height, touch }: LayoutDimensions): LayoutProfile {
  // Landscape phones and touch tablets share the remastered touch HUD.
  // The previous 1024px cut-off classified many tablets as "tablet",
  // silently bringing back the oversized desktop overlays on touchscreens.
  if (touch && width > height && width <= 1600) return 'mobile';
  if (width > height && height <= 600 && width <= 1100) return 'mobile';
  if (width <= 820 || (touch && width <= 1024)) return 'mobile';
  if (width <= 1220 || touch) return 'tablet';
  return 'desktop';
}

export function useLayoutProfile(): LayoutProfile {
  const [dimensions, setDimensions] = useState<LayoutDimensions>(() => ({
    width: typeof window === 'undefined' ? 1280 : window.innerWidth,
    height: typeof window === 'undefined' ? 800 : window.innerHeight,
    touch: typeof window !== 'undefined' ? window.matchMedia('(pointer: coarse)').matches : false,
  }));
  const resizeRafRef = useRef<number | null>(null);

  useEffect(() => {
    const media = window.matchMedia('(pointer: coarse)');
    const onResize = () => {
      if (resizeRafRef.current !== null) cancelAnimationFrame(resizeRafRef.current);
      resizeRafRef.current = requestAnimationFrame(() => {
        resizeRafRef.current = null;
        setDimensions({ width: window.innerWidth, height: window.innerHeight, touch: media.matches });
      });
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    media.addEventListener?.('change', onResize);
    return () => {
      if (resizeRafRef.current !== null) cancelAnimationFrame(resizeRafRef.current);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      media.removeEventListener?.('change', onResize);
    };
  }, []);

  return useMemo(() => resolveLayoutProfile(dimensions), [dimensions]);
}
