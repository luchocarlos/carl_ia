/// <reference types="vite/client" />

// Tipado de las variables de entorno expuestas por Vite (solo las que empiezan por VITE_).
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string; // URL del backend; si falta se usa el MockClient
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
