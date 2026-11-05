export const modalBackdropMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.18, ease: 'easeOut' as const },
};

export const modalCardMotion = {
  initial: { scale: 0.94, opacity: 0, y: 10 },
  animate: { scale: 1, opacity: 1, y: 0 },
  exit: { scale: 0.97, opacity: 0, y: 8 },
  transition: { type: 'spring' as const, stiffness: 340, damping: 30, mass: 0.82 },
};
