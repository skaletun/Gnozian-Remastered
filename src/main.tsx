import React from 'react';
import { createRoot } from 'react-dom/client';
import { GameApp } from './ui/GameApp';
import './style.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode><GameApp /></React.StrictMode>,
);
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(error => console.warn('Offline installation failed', error));
  });
}
