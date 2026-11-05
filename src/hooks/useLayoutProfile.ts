import { useEffect, useMemo, useRef, useState } from 'react';

export type LayoutProfile = 'desktop' | 'tablet' | 'mobile';

export function useLayoutProfile(): LayoutProfile {
  const [w, setW] = useState(() => (typeof window === 'undefined' ? 1280 : window.innerWidth));
  const [touch, setTouch] = useState(() => (typeof window !== 'undefined' ? window.matchMedia('(pointer: coarse)').matches : false));
  const resizeRafRef = useRef<number | null>(null);

  useEffect(() => {
    const onResize = () => {
      if (resizeRafRef.current != null) cancelAnimationFrame(resizeRafRef.current);
      resizeRafRef.current = requestAnimationFrame(() => {
        resizeRafRef.current = null;
        setW(window.innerWidth);
      });
    };
    const media = window.matchMedia('(pointer: coarse)');
    const onMedia = () => setTouch(media.matches);
    window.addEventListener('resize', onResize);
    media.addEventListener?.('change', onMedia);
    return () => {
      if (resizeRafRef.current != null) cancelAnimationFrame(resizeRafRef.current);
      window.removeEventListener('resize', onResize);
      media.removeEventListener?.('change', onMedia);
    };
  }, []);
  return useMemo(() => {
    if (w <= 820 || (touch && w <= 1024)) return 'mobile';
    if (w <= 1220 || touch) return 'tablet';
    return 'desktop';
  }, [touch, w]);
}

