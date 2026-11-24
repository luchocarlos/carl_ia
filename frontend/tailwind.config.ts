import type { Config } from 'tailwindcss';

// Configuración de Tailwind: archivos a escanear y extensiones del tema (paleta oscura, fuentes, animaciones).
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'], // dónde buscar clases usadas
  theme: {
    extend: {
      // Paleta propia de la app
      colors: {
        ink: '#09090b', // fondo principal
        panel: '#111114', // fondo de paneles/tarjetas
        line: 'rgba(255,255,255,0.10)', // bordes sutiles
        foreground: '#f4f4f5', // texto principal
        muted: '#a1a1aa', // texto secundario
        accent: '#6366f1', // color de acento (índigo)
        cyan: '#22d3ee',
      },
      fontFamily: {
        // Inter con fuentes del sistema como respaldo
        sans: [
          'Inter',
          'Inter var',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      backgroundImage: {
        'accent-gradient': 'linear-gradient(135deg, #6366f1 0%, #22d3ee 100%)', // degradado índigo → cian
      },
      boxShadow: {
        glow: '0 0 60px -20px rgba(99, 102, 241, 0.45)', // halo suave de color acento
      },
      keyframes: {
        // Brillo deslizante para placeholders de carga
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        // Aparición con ligero desplazamiento hacia arriba
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.8s linear infinite',
        'fade-up': 'fade-up 240ms ease-out both',
      },
    },
  },
  plugins: [],
} satisfies Config;
