import React, { useState, useEffect } from 'react';
import { minimizeWindow, maximizeWindow, closeWindow, getWindowState } from '@/utils/electronAPI';
import { t } from '../i18n';

/**
 * Electron Window Controls
 * Custom title bar with minimize, maximize, and close buttons
 * Only renders in Electron environments
 */
export const ElectronWindowControls: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const checkMaximizedState = async () => {
      const state = await getWindowState();
      if (state) {
        setIsMaximized(state.isMaximized);
      }
    };

    checkMaximizedState();

    // Listen for window state changes
    window.addEventListener('maximize', () => setIsMaximized(true));
    window.addEventListener('unmaximize', () => setIsMaximized(false));

    return () => {
      window.removeEventListener('maximize', () => setIsMaximized(true));
      window.removeEventListener('unmaximize', () => setIsMaximized(false));
    };
  }, []);

  const buttonClasses = 'hover:bg-gray-700 px-3 py-1 transition-colors text-gray-300 hover:text-white font-bold';
  const closeButtonClasses = 'hover:bg-red-600 px-3 py-1 transition-colors text-gray-300 hover:text-white font-bold';

  return (
    <div 
      className="fixed top-0 right-0 flex items-center bg-gray-800 border-b border-gray-700 select-none z-50" 
      style={{ 
        height: '32px', 
        userSelect: 'none', 
        WebkitUserSelect: 'none',
        WebkitAppRegion: 'no-drag'
      } as React.CSSProperties & { WebkitAppRegion?: string }}
    >
      <button
        onClick={minimizeWindow}
        className={buttonClasses}
        title={t('window.minimize')}
        style={{ width: '45px' }}
      >
        −
      </button>

      <button
        onClick={maximizeWindow}
        className={buttonClasses}
        title={isMaximized ? t('window.restore') : t('window.maximize')}
        style={{ width: '45px' }}
      >
        {isMaximized ? '❒' : '□'}
      </button>

      <button
        onClick={closeWindow}
        className={closeButtonClasses}
        title={t('window.close')}
        style={{ width: '45px' }}
      >
        ✕
      </button>
    </div>
  );
};

export default ElectronWindowControls;
