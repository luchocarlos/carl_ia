# Carl IA

Asistente de IA especializado en programación. Tiene dos modos: **Código** y **Documentación técnica**. Usa modelos gratuitos de varios proveedores detrás de un solo endpoint y cambia de proveedor automáticamente si uno falla.

El proyecto tiene dos partes:

- **Backend:** API construida con Strapi 5 y TypeScript. Guarda las claves de los proveedores, aplica un cupo diario y envía las respuestas por streaming (SSE).
- **Frontend:** SPA en React, Vite y Tailwind. No guarda claves: solo habla con el backend.

## Cómo funciona

1. El usuario escribe en el frontend. La app genera un identificador anónimo y lo guarda en el navegador.
2. El frontend envía la conversación al backend.
3. El backend comprueba el cupo, agrega un prompt de sistema que limita las respuestas a temas de programación y llama al proveedor de IA.
4. Si el proveedor falla por saturación (`429`, `502`, `503`, `504`), el backend prueba el siguiente de la cadena de respaldo.
5. La respuesta llega al navegador en trozos, en tiempo real.

## Desarrollo local

Requisitos: Node.js 20 o superior.

### Backend

```bash
npm install
cp .env.example .env
npm run develop
```

Configura en el `.env` al menos una clave de proveedor (por ejemplo `OPENROUTER_API_KEY`). El servidor queda en `http://localhost:1337`.

### Frontend

```bash
npm install
cp .env.example .env
npm run dev
```

```env
VITE_API_BASE_URL=http://127.0.0.1:1337
```

Si `VITE_API_BASE_URL` está vacía, el frontend funciona en **modo demostración**: simula las respuestas sin conectarse a ningún servidor.

## Despliegue en Render

El repositorio incluye un blueprint (`render.yaml`) que crea los dos servicios en el plan gratuito.

1. En Render: **New → Blueprint** y conecta este repositorio.
2. Render crea el backend (Web Service) y el frontend (Static Site).
3. Completa las variables marcadas como manuales (tablas de abajo).
4. Cuando ambos tengan su URL, actualiza `FRONTEND_URL`, `OPENROUTER_SITE_URL`, `PUBLIC_URL` y `VITE_API_BASE_URL`, y vuelve a desplegar.

### Ajustes para 512 MB de RAM

El plan gratuito de Render tiene 512 MB. Strapi normalmente compila un panel de administración que necesita más de 1 GB, así que en producción:

- **Build:** `npm ci && npm run build:server`. Solo compila el servidor con TypeScript, sin el panel admin.
- **Start:** `npm run start:prod`. Arranca con el heap de Node limitado a 320 MB.
- **`SERVE_ADMIN=false`:** el panel admin no se sirve. La app no lo necesita.

Medido en producción: unos 325 MB de memoria en reposo y durante un chat.

### Variables del backend

**Las define el blueprint** (puedes dejarlas así):

| Variable | Valor | Para qué sirve |
| --- | --- | --- |
| `NODE_ENV` | `production` | Modo producción |
| `NODE_VERSION` | `22.14.0` | Versión de Node en Render |
| `HOST` | `0.0.0.0` | Escucha en todas las interfaces |
| `SERVE_ADMIN` | `false` | Desactiva el panel admin (ahorra RAM) |
| `PROXY` | `true` | Confía en el proxy de Render (IP real del usuario) |
| `DATABASE_CLIENT` | `sqlite` | Base de datos interna de Strapi |
| `DATABASE_FILENAME` | `.tmp/data.db` | Archivo SQLite |
| `APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `JWT_SECRET`, `ENCRYPTION_KEY` | *(generadas por Render)* | Secretos internos de Strapi |
| `IA_DEFAULT_PROVIDER` | `auto` | Usa la cadena de respaldo |
| `IA_MODEL_OPENROUTER` | `openrouter/free` | Modelo por defecto en OpenRouter |
| `IA_FALLBACK_CHAIN` | `openrouter:openrouter/free,groq:openai/gpt-oss-120b` | Orden de proveedores a probar |
| `IA_DAILY_LIMIT` | `30` | Puntos diarios por usuario |
| `IA_GLOBAL_DAILY_LIMIT` | `300` | Puntos diarios para todos los usuarios |
| `OPENROUTER_SITE_NAME` | `carl_ia` | Nombre que ve OpenRouter |

**Las completas tú en el panel de Render:**

| Variable | Ejemplo | ¿Obligatoria? |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | `sk-or-v1-...` | Sí (o al menos otra clave de proveedor) |
| `GROQ_API_KEY` | `gsk_...` | Recomendada (respaldo en la cadena) |
| `FRONTEND_URL` | `https://tu-frontend.onrender.com` | Sí: permite el CORS. Acepta varias URLs separadas por coma |
| `OPENROUTER_SITE_URL` | `https://tu-frontend.onrender.com` | Recomendada |
| `PUBLIC_URL` | `https://tu-backend.onrender.com` | Recomendada |
| `IA_API_KEY` | una cadena larga aleatoria | Opcional: protege las rutas de diagnóstico y el chat directo |
| `IA_DEFAULT_MODEL` | — | Opcional: fuerza un modelo concreto |
| `IA_USAGE_FILE` | — | Opcional: archivo donde se guarda el consumo |
| `CEREBRAS_API_KEY`, `MISTRAL_API_KEY`, `GEMINI_API_KEY`, `OPENCODE_API_KEY` | — | Opcionales: más proveedores |

`FRONTEND_URL` y `PUBLIC_URL` van sin barra final.

### Variables del frontend

| Variable | Ejemplo | Nota |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `https://tu-backend.onrender.com` | URL del backend, sin barra final. Se inyecta al compilar: si la cambias, vuelve a desplegar el frontend |

### Limitaciones del plan gratuito

- El backend se suspende tras unos 15 minutos sin uso. La primera petición después de eso puede tardar entre 30 y 60 segundos.
- El disco no es persistente: el contador de consumo diario y la base SQLite se reinician en cada deploy o reinicio. Para esta app no es un problema, porque no guarda datos de usuarios.

### Checklist después del deploy

- [ ] `GET https://tu-backend.onrender.com/api/ia/estado` responde `"ok": true` y muestra la cadena de proveedores.
- [ ] `FRONTEND_URL` coincide exactamente con la URL del frontend.
- [ ] El frontend ya no muestra «Modo demostración».
- [ ] Un mensaje de prueba recibe respuesta.

## Endpoints

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/ia/estado` | Diagnóstico público del servicio |
| `GET` | `/api/ia/proveedores` | Proveedores y si tienen credenciales |
| `GET` | `/api/ia/models?provider=openrouter&free=1` | Modelos gratuitos de un proveedor |
| `POST` | `/api/ia/chat` | Chat directo (respuesta JSON) |
| `POST` | `/api/chat` | Chat del frontend (respuesta por SSE) |
| `GET` | `/api/usage` | Consumo diario del usuario y cupo global |

Si `IA_API_KEY` está definida, las rutas `/api/ia/*` (excepto `/api/ia/estado`) exigen el header `X-API-Key`. Las rutas que usa el frontend (`/api/chat` y `/api/usage`) no llevan clave y se protegen con el cupo diario.

### Ejemplo: chat por SSE

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

Si el proveedor falla con el stream ya abierto, se envía `{"error":"...","status":503}` y se devuelven los puntos al usuario.

### Ejemplo: consumo

```json
{
  "used": 4,
  "limit": 30,
  "resetAt": "2026-11-22T05:00:00.000Z",
  "global": { "pct": 42, "status": "ok" }
}
```

## Cupo diario

| Modo | Coste |
| --- | --- |
| Código | 1 punto |
| Documentación | 3 puntos |

- Límite por usuario: `IA_DAILY_LIMIT`. Límite compartido: `IA_GLOBAL_DAILY_LIMIT`.
- El cupo se reinicia a medianoche, hora de Bogotá.
- El estado global es `ok` (< 80 %), `ocupado` (≥ 80 %) o `lleno` (100 %).

## Proveedores

| ID | Gratis | Variable |
| --- | --- | --- |
| `openrouter` | Sí (modelos `:free`) | `OPENROUTER_API_KEY` |
| `groq` | Sí (capa gratuita) | `GROQ_API_KEY` |
| `cerebras` | Sí (capa gratuita) | `CEREBRAS_API_KEY` |
| `mistral` | Sí (capa gratuita) | `MISTRAL_API_KEY` |
| `google` (Gemini) | Sí (capa gratuita) | `GEMINI_API_KEY` |
| `opencode` | No | `OPENCODE_API_KEY` |
| `ollama` | Sí (servidor propio) | — |

Los modelos gratuitos tienen límites compartidos y pueden saturarse en horas pico. Por eso conviene configurar al menos dos proveedores en `IA_FALLBACK_CHAIN`:

```env
# Formato: proveedor:modelo,proveedor:modelo
IA_FALLBACK_CHAIN=openrouter:openrouter/free,groq:openai/gpt-oss-120b
```

Los modelos gratuitos de OpenCode solo funcionan dentro de su propia herramienta y no se pueden usar desde una aplicación web.

## Pruebas

En cada parte del proyecto:

```bash
npm test
```

El frontend además tiene `npm run lint` y pruebas end-to-end con `npm run e2e` (Playwright).
