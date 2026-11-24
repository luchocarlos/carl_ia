# Diplomado IA

Capa de IA para consumir varios proveedores desde un solo endpoint, pensada para funcionar en producción con modelos gratuitos. Incluye el backend Strapi y el frontend **Carl** (código y documentación técnica) conectados por un contrato HTTP propio.

- **Backend:** Strapi 5 + TypeScript.
- **Frontend:** React + Vite (`frontend/`).
- **Capa de IA:** `backend/src/api/ia/` con catálogo de proveedores y adaptadores.

## Estructura

```text
backend/src/api/ia/
├── controllers/ia.ts        # endpoints de diagnóstico y proveedores
├── controllers/contrato.ts  # /api/chat (SSE) y /api/usage
├── routes/ia.ts
├── services/ia.ts           # validación, cadena de respaldo y caché
├── services/contrato.ts     # cupo diario, prompt de programación y SSE
├── services/ia.test.ts
├── services/contrato.test.ts
├── providers/               # adaptadores por familia de API
│   ├── index.ts             # registro de proveedores
│   ├── openai-compatible.ts # OpenRouter, Groq, Cerebras, Mistral, Ollama
│   ├── google.ts            # Gemini
│   ├── http.ts
│   ├── errors.ts
│   └── types.ts
└── data/models.json         # catálogo de proveedores y modelos gratis
```

## Puesta en marcha

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm run develop
```

Configura al menos una API key en `backend/.env`. Con OpenRouter:

```env
IA_DEFAULT_PROVIDER=auto
OPENROUTER_API_KEY=tu_key
OPENROUTER_SITE_URL=http://localhost:5173
OPENROUTER_SITE_NAME=diplomado_ia
```

Con `IA_DEFAULT_PROVIDER=auto` el backend usa el modelo gratis del catálogo y, si falla, pasa al siguiente proveedor configurado.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

```env
VITE_API_BASE_URL=http://127.0.0.1:1337
```

Sin `VITE_API_BASE_URL` el frontend usa `MockClient` y muestra «Modo demostración». Con la variable definida habla con `/api/chat` y `/api/usage`. No hay claves en el navegador.

## Endpoints

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/ia/estado` | Diagnóstico público del servicio |
| `GET` | `/api/ia/proveedores` | Proveedores, si tienen credenciales y la cadena activa |
| `GET` | `/api/ia/models?provider=openrouter` | Modelos del proveedor (caché de 5 min) |
| `GET` | `/api/ia/models?provider=openrouter&free=1` | Solo modelos gratuitos |
| `GET` | `/api/ia/models?provider=auto` | Modelos gratis de todos los proveedores |
| `POST` | `/api/ia/chat` | Envía mensajes y devuelve la respuesta |
| `POST` | `/api/chat` | Contrato del frontend: misma conversación, respuesta por SSE |
| `GET` | `/api/usage` | Consumo diario del usuario y cupo global |

Si `IA_API_KEY` está definida, las rutas `/api/ia/*` (excepto `/api/ia/estado`) exigen el header `X-API-Key`. Las rutas del contrato (`/api/chat`, `/api/usage`) están pensadas para el navegador: no llevan claves y se protegen con el cupo diario.

### Ejemplo de chat

```bash
curl -X POST http://localhost:1337/api/ia/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: tu_ia_api_key" \
  -d '{
    "provider": "auto",
    "system": "Responde en español y de forma breve.",
    "messages": [
      { "role": "user", "content": "¿Qué es una API?" }
    ],
    "temperature": 0.7,
    "maxTokens": 512
  }'
```

Respuesta:

```json
{
  "provider": "openrouter",
  "model": "google/gemma-4-31b-it:free",
  "content": "...",
  "usage": { "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0 },
  "fallbacks": [
    { "provider": "groq", "status": 429, "error": "Rate limit exceeded" }
  ]
}
```

`fallbacks` solo aparece si un proveedor falló antes del que respondió.

## Contrato de Carl

El frontend consume dos rutas sin claves. El cupo se calcula en puntos:

| Modo | Coste |
| --- | --- |
| Código | 1 |
| Documentación | 3 |

Límite diario por usuario: `IA_DAILY_LIMIT` (30 por defecto). Cupo global compartido: `IA_GLOBAL_DAILY_LIMIT` (300 por defecto). El reinicio es a medianoche de `America/Bogota` y se devuelve en `resetAt`.

El usuario se identifica con el header anónimo `X-Carl-User` (lo genera el frontend y lo guarda en `localStorage`); si falta, se usa la IP.

### `POST /api/chat` (SSE)

```http
POST /api/chat
Content-Type: application/json
X-Carl-User: 8f14e45f-ceea-467f-a8b8-5f0a3d1c2b7e

{ "mode": "text", "messages": [{ "role": "user", "content": "Hola" }] }
```

```text
data: {"delta":"Hola"}
data: {"delta":" mundo"}
data: {"done":true,"provider":"openrouter","model":"..."}
data: [DONE]
```

Si el proveedor falla después de abrir el stream, se envía `{"error":"...","status":503}` y se devuelven los puntos. Un `429` del proveedor se traduce a `503` para no confundirlo con el cupo del usuario.

El backend añade un prompt de sistema que limita a Carl a programación (código, depuración, arquitectura, bases de datos, APIs, DevOps y herramientas). Si el tema no encaja, responde únicamente «Solo puedo ayudarte con temas de programación.». Cada respuesta se limita a 800 tokens.

### `GET /api/usage`

```json
{
  "used": 4,
  "limit": 30,
  "resetAt": "2026-11-22T05:00:00.000Z",
  "global": { "pct": 42, "status": "ok" }
}
```

Errores de cupo:

```json
{ "error": "quota_user", "message": "Alcanzaste tu límite diario.", "resetAt": "..." }
```

`status` global: `ok` (< 80 %), `ocupado` (≥ 80 %) o `lleno` (100 %). El consumo se persiste en `.data/usage.json` (configurable con `IA_USAGE_FILE`).

## Cadena de respaldo

`provider: "auto"` (o no enviar `provider` si `IA_DEFAULT_PROVIDER=auto`) arma una cadena y prueba en orden:

1. El proveedor por defecto.
2. `IA_FALLBACK_CHAIN`, si está definida.
3. Los proveedores gratuitos del catálogo que tengan `defaultModel`.

Solo se reintenta con `429`, `502`, `503` y `504`. Un `400` se devuelve de inmediato porque el problema es la solicitud, no el proveedor.

```env
# Formato: proveedor:modelo,proveedor:modelo
IA_FALLBACK_CHAIN=groq:llama-3.3-70b-versatile,google:gemini-2.5-flash
```

También puedes fijar un modelo por proveedor sin tocar el catálogo:

```env
IA_MODEL_GROQ=llama-3.3-70b-versatile
IA_MODEL_GOOGLE=gemini-2.5-flash
```

## Modelos gratuitos

OpenRouter publica modelos con el sufijo `:free`. El catálogo trae los vigentes al momento de escribir esto:

```text
google/gemma-4-31b-it:free
google/gemma-4-26b-a4b-it:free
nvidia/nemotron-3.5-lightning:free
nvidia/nemotron-3-ultra-550b-a55b:free
nvidia/nemotron-3.5-super-vl:free
nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free
inclusionai/ling-3.2-flash:free
baidu/ernie-5.5-flash-preview:free
liquid/lfm-3-1.7b:free
particle-ai/particle-1:free
recursive/flint-v1.0:free
```

Verifícalos con:

```bash
curl "http://localhost:1337/api/ia/models?provider=openrouter&free=1"
```

> Los modelos gratuitos rotan. Si uno deja de existir, actualiza `freeModels` en `backend/src/api/ia/data/models.json` o pide la lista en vivo con `GET /api/ia/models?provider=openrouter`.

### Límites de OpenRouter

Los modelos `:free` tienen límites compartidos y pueden responder `429` en horas pico. La cadena de respaldo está pensada justamente para eso. Revisa los límites vigentes en <https://openrouter.ai/docs/api-reference/limits>.

## Proveedores incluidos

| ID | API | Gratis | Variable |
| --- | --- | --- | --- |
| `openrouter` | OpenAI-compatible | Sí (`:free`) | `OPENROUTER_API_KEY` |
| `groq` | OpenAI-compatible | Sí (capa gratuita) | `GROQ_API_KEY` |
| `cerebras` | OpenAI-compatible | Sí (capa gratuita) | `CEREBRAS_API_KEY` |
| `mistral` | OpenAI-compatible | Sí (capa gratuita) | `MISTRAL_API_KEY` |
| `google` | Gemini nativo | Sí (capa gratuita) | `GEMINI_API_KEY` |
| `opencode` | OpenAI-compatible | No | `OPENCODE_API_KEY` |
| `ollama` | OpenAI-compatible | Sí (local) | — |

### Sobre los modelos gratis de OpenCode

Los modelos `*-free` de OpenCode **no se pueden usar desde una aplicación web**, ni siquiera con un backend propio. El endpoint de modelos es público, pero un `chat/completions` sin credenciales de OpenCode responde:

```json
{
  "error": {
    "type": "FreeUsageLimitError",
    "message": "Free usage limit reached. Free models work in OpenCode; subscribe to OpenCode Go to keep going."
  }
}
```

Es una restricción del servicio, no del código: no existe una API key pública que puedas guardar en el servidor para revender esos modelos. Las opciones reales para producción son:

1. **Modelos `:free` de OpenRouter** con tu propia key (lo que usa esta capa por defecto).
2. **Capas gratuitas de Groq, Cerebras, Mistral o Gemini**, agregándolas a la cadena.
3. **OpenCode Go o modelos pagados** si quieres específicamente ese catálogo.
4. **Ollama** en un servidor propio, si el hosting lo permite.

## Producción

### Backend en Render

El archivo `render.yaml` ya define el servicio. En el panel de Render configura:

```env
IA_API_KEY=<clave_larga_aleatoria>
OPENROUTER_API_KEY=<tu_key>
OPENROUTER_SITE_URL=https://tu-frontend.onrender.com
OPENROUTER_SITE_NAME=diplomado_ia
FRONTEND_URL=https://tu-frontend.onrender.com
IA_DAILY_LIMIT=30
IA_GLOBAL_DAILY_LIMIT=300
```

Notas:

- `FRONTEND_URL` acepta varias URLs separadas por coma y alimenta el CORS de Strapi.
- `IA_API_KEY` evita que cualquiera consuma tu cuota gratuita. El frontend la envía como `X-API-Key`.
- El plan free de Render suspende el servicio por inactividad; la primera petición puede tardar en despertar.
- SQLite en Render free no es persistente. Para esta capa no importa, pero no guardes datos ahí.

### Frontend en Render (sitio estático)

```env
VITE_API_BASE_URL=https://tu-backend.onrender.com
```

El frontend no guarda claves: el backend aplica el cupo diario y el global. Configura `FRONTEND_URL` en el backend con el dominio del frontend para el CORS.

### Checklist

- [ ] `OPENROUTER_API_KEY` definida en el backend.
- [ ] `FRONTEND_URL` con el dominio real del frontend.
- [ ] Al menos dos proveedores en `IA_FALLBACK_CHAIN`.
- [ ] `GET /api/ia/estado` muestra la cadena esperada.
- [ ] `POST /api/chat` responde por SSE.
- [ ] `GET /api/usage` devuelve `used`, `limit`, `resetAt` y `global`.

## Agregar un proveedor

1. Agrega una entrada en `backend/src/api/ia/data/models.json`.
2. Si su API es compatible con OpenAI, usa `"api": "openai"` y no necesitas código.
3. Si usa otra familia de API, crea un adaptador en `backend/src/api/ia/providers/` y regístralo en `providers/index.ts`.
4. Agrega la variable de entorno en `backend/.env.example`.

## Pruebas

```bash
cd backend
npm test
```
