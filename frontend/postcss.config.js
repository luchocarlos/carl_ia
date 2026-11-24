// PostCSS: procesa el CSS con Tailwind y añade prefijos de navegador automáticamente.
export default {
  plugins: {
    tailwindcss: {}, // genera las utilidades de Tailwind
    autoprefixer: {}, // añade prefijos -webkit-, -moz-… según los navegadores objetivo
  },
};
