import type { ReactNode } from 'react';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TooltipProps {
  content: ReactNode;
  delay?: number;
  position?: 'top' | 'bottom' | 'left' | 'right';
  children: ReactNode;
  disabled?: boolean;
}

export default function Tooltip({
  content,
  delay = 500,
  position = 'top',
  children,
  disabled = false,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleMouseEnter = () => {
    if (disabled) return;
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const positionClasses: Record<string, string> = {
    top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    left: 'right-full mr-2 top-1/2 -translate-y-1/2',
    right: 'left-full ml-2 top-1/2 -translate-y-1/2',
  };

  const arrowClasses: Record<string, string> = {
    top: 'bottom-[-6px] left-1/2 -translate-x-1/2 border-t-gray-800 border-l-transparent border-r-transparent border-b-transparent',
    bottom: 'top-[-6px] left-1/2 -translate-x-1/2 border-b-gray-800 border-l-transparent border-r-transparent border-t-transparent',
    left: 'left-[-6px] top-1/2 -translate-y-1/2 border-l-gray-800 border-t-transparent border-b-transparent border-r-transparent',
    right: 'right-[-6px] top-1/2 -translate-y-1/2 border-r-gray-800 border-t-transparent border-b-transparent border-l-transparent',
  };

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}

      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`absolute whitespace-nowrap z-[100] ${positionClasses[position]}`}
          >
            <div className="relative bg-gray-800 text-gray-100 text-xs px-3 py-2 rounded-lg shadow-xl border border-gray-700/50 max-w-xs">
              {content}
              <div className={`absolute border-4 ${arrowClasses[position]}`} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Utility hook for creating tooltip content with icons and labels
 */
export function useTooltip(title: string, description?: string, details?: string[]) {
  return (
    <div className="space-y-1">
      <div className="font-semibold text-amber-300">{title}</div>
      {description && <div className="text-gray-300 text-xs">{description}</div>}
      {details && details.length > 0 && (
        <ul className="text-gray-400 text-xs space-y-0.5 mt-2">
          {details.map((detail, i) => (
            <li key={i} className="flex items-start gap-1">
              <span className="mt-0.5">•</span>
              <span>{detail}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
