# Carl

SPA de IA especializada en programación, con dos modos: **Código** y **Documentación técnica**. Interfaz en español, estética oscura inspirada en Linear/Raycast, sin copiar assets ni código de terceros.

> Esta fase incluye el frontend y su contrato HTTP. Sin `VITE_API_BASE_URL` funciona con `MockClient`, que simula streaming y consumo. Con la variable definida habla con el backend Strapi del proyecto (`/api/chat`, `/api/usage`). El backend responde **solo** sobre programación.

## Stack

- Vite + React 18 + TypeScript
- Tailwind CSS 3.4
- lucide-react + framer-motion
- react-markdown + remark-gfm + rehype-highlight
- zustand con `persist`
- Vitest (unidades) y Playwright (flujo de chat)

El nombre de la app vive en un único lugar: `src/config.ts` → `APP_NAME = "Carl"`.

## Comandos

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # tsc --noEmit && vite build
npm run preview
npm run lint
npm test          # Vitest
npm run e2e       # Playwright (requiere npx playwright install chromium)
npm run contrast  # contraste WCAG AA de design/tokens.json
```

## Estructura

```text
src/
├── config.ts                 # nombre, costos, límites, sugerencias
├── types/                    # Mode, Chat, ChatMessage, AiClient, Usage
├── services/
│   ├── index.ts              # elige MockClient o HttpClient
│   ├── mockClient.ts         # streaming falso y uso simulado
│   └── httpClient.ts         # contrato HTTP + parser SSE + ApiError
├── store/
│   ├── chatStore.ts          # chats persistidos (localStorage)
│   ├── usageStore.ts         # consumo diario persistido
│   ├── uiStore.ts            # modo, borrador, sidebar, confirmación
│   └── toastStore.ts         # avisos con acción "Reintentar"
├── hooks/
│   ├── useEnviarMensaje.ts   # envío, streaming, abort, timeout, 429
│   └── useAutoResize.ts
├── lib/                      # tiempo Bogotá, consumo y descargas
├── components/
│   ├── layout/               # Sidebar, Header
│   ├── chat/                 # Composer, Markdown, mensajes, resultados
│   ├── usage/                # barras de consumo
│   └── ui/                   # toasts, diálogo de confirmación
├── tests/setup.ts
└── index.css                 # Tailwind + estilos de Markdown/highlight.js

design/tokens.json            # tokens de color y tipografía
scripts/contrast.py           # verificación WCAG AA
e2e/chat.spec.ts              # flujo: enviar mensaje + recargar
```

## Capa de servicios

Interfaz `AiClient`:

```ts
chat(mode, messages, { signal, onDelta }): Promise<void>
usage(): Promise<{ used, limit, resetAt, global: { pct, status } }>
```

- **MockClient (por defecto):** no hace red. Simula el streaming con trozos y `AbortSignal`, y devuelve un uso coherente con el store.
- **HttpClient:** se activa cuando defines `VITE_API_BASE_URL`. Usa `fetch` y `ReadableStream` para leer SSE, envía un identificador anónimo `X-Carl-User` y detecta errores enviados dentro del stream.

### Contrato del backend

Implementado en el backend:

```http
POST /api/chat
{ "mode": "text", "messages": [{ "role": "user", "content": "¿Cómo depuro este error?" }] }
→ text/event-stream

data: {"delta":"Hola"}
data: {"delta":" mundo"}
data: [DONE]
```

```http
GET /api/usage
→ { "used": 4, "limit": 30, "resetAt": "2026-11-22T05:00:00.000Z",
    "global": { "pct": 42, "status": "ok" } }

429 → { "error": "quota_user" | "quota_global", "resetAt": "..." }
```

Cero claves en el frontend. `.env.example` solo contiene `VITE_API_BASE_URL`.

El parser SSE acepta `delta`, `content` o `text` dentro de cada `data:` y también texto plano.

## Consumo diario

| Modo | Coste |
| --- | --- |
| Código | 1 punto |
| Documentación | 3 puntos |

- Límite diario: **30 puntos** (`src/config.ts`).
- Verde < 80 %, ámbar ≥ 80 %, rojo al 100 %.
- El reinicio es a medianoche **America/Bogota** (UTC-5, sin horario de verano). Se muestra la hora de reinicio.
- Al llegar al 100 % se bloquea el envío y se avisa. La UI es informativa: al conectar el backend, `/api/usage` es la fuente de verdad y `reconciliar()` ajusta el estado local.
- Ambas barras usan `role="progressbar"` con `aria-valuenow`, `aria-valuemin`, `aria-valuemax` y `aria-valuetext`.

## Persistencia

- Chats e historial en `localStorage` (`carl:chats:v1`) con un storage envuelto en `try/catch`: si la cuota se llena, aparece un aviso y la app sigue funcionando.
- Consumo en `carl:usage:v1`.
- Identificador anónimo del navegador en `carl:user:v1`; viaja como `X-Carl-User` para que el cupo sea por persona y no por IP compartida.
- Los historiales guardados con el antiguo modo Imagen se descartan al rehidratar; el resto se normaliza a Código o Documentación.
- "Borrar historial" pide confirmación y no altera el consumo.

## Accesibilidad

- `aria-live="polite"` en respuestas y en el contador.
- `aria-pressed` en el selector de modo, `aria-current` en el chat activo.
- Navegación completa por teclado, `focus-visible` global y trampa de foco en el diálogo de borrado (Escape cierra).
- Enlace "Saltar al contenido".
- Contraste AA verificado con `npm run contrast` (texto 18.1:1, secundario 7.76:1, estados 7–12:1).
- `prefers-reduced-motion` respetado por CSS y por framer-motion.

## Seguridad del frontend

- `index.html` incluye una CSP estricta (`script-src 'self'`, `object-src 'none'`, `base-uri 'self'`). En desarrollo se retira mediante un plugin de Vite porque React Refresh necesita scripts inline y HMR un WebSocket.
- `frame-ancestors 'none'` no puede aplicarse desde `<meta>`: se envía como cabecera en el blueprint de Render y en `vercel.json`, junto con `X-Frame-Options: DENY`, `X-Content-Type-Options` y `Referrer-Policy`.
- Sin `dangerouslySetInnerHTML`.
- Markdown con `skipHtml`: el HTML crudo se ignora. Los enlaces se renderizan como texto y las imágenes del modelo no se muestran.
- Aviso visible de privacidad en el estado vacío y en la barra lateral.
- `VITE_API_TOKEN` no existe: la autenticación, si hace falta, será del backend.

## Despliegue en Render (sitio estático)

El blueprint `render.yaml` de la raíz del repositorio ya lo define:

- Build: `npm ci && npm run build`
- Publish: `dist`
- Rewrite SPA: `/* → /index.html`
- Cabeceras: CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options` y `Referrer-Policy`
- Variable opcional: `VITE_API_BASE_URL`

Pasos: en Render crea un **Blueprint** con este repositorio, o un Static Site manual con esos valores. Define `VITE_API_BASE_URL` con la URL del backend.

`vercel.json` también incluye la regla SPA.

## Limitaciones conocidas

- **Sin `OPENROUTER_API_KEY` el backend no responde.** El frontend muestra el mensaje del servidor («Falta configurar una API key de IA…») y permite reintentar.
- **Solo programación:** el backend aplica un prompt de sistema que rechaza otros temas con «Solo puedo ayudarte con temas de programación.» y limita cada respuesta a 800 tokens.
- **Timeout de 30 s** en el cliente. Si el backend necesita más, hay que ajustar `REQUEST_TIMEOUT_MS` o mover el timeout al servidor.
- **localStorage** es limitado y no se sincroniza entre dispositivos. El historial se pierde al borrar datos del navegador.
- **CSP:** `style-src` incluye `'unsafe-inline'` porque framer-motion aplica estilos inline; `connect-src https:` permite apuntar a cualquier backend configurado. Para un backend local en `http://` usa `npm run dev` (la CSP se retira en desarrollo).
- **Fuente Inter:** se usa si está instalada; si no, cae al stack del sistema. No se cargan fuentes externas para no romper la CSP ni la privacidad.

## Verificación realizada

- `npx tsc --noEmit` sin errores.
- `npm run lint` sin errores.
- `npm test`: 11 pruebas (costos, 80 %/100 %, reinicio Bogotá, bloqueo, reconciliación y migración del historial sin el modo Imagen).
- `npm run build` correcto, con chunks separados (`react`, `markdown`, `motion`).
- `npm run contrast`: todas las combinaciones cumplen AA.
- `npm run e2e`: Playwright (Chromium) con dos flujos: enviar un mensaje de código, recibir el streaming del mock y comprobar que el historial persiste al recargar; y, en móvil, abrir el menú, cancelar el borrado y confirmar la eliminación del historial.
- Build de producción servido con `vite preview`: sin errores de consola ni violaciones de CSP.
