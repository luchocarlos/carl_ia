// Punto de entrada de la aplicación: monta <App /> en el elemento #root del HTML.
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // estilos globales (Tailwind + Markdown + resaltado de código)

// Nodo raíz definido en index.html donde se monta React
const raiz = document.getElementById('root');

// Si falta el contenedor no hay dónde renderizar: se falla de forma explícita
if (!raiz) {
  throw new Error('No se encontró el elemento #root');
}

// StrictMode activa comprobaciones extra en desarrollo (doble render, efectos, etc.)
ReactDOM.createRoot(raiz).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
