import type { AiClient } from '../types';
import { HttpClient } from './httpClient';
import { MockClient } from './mockClient';

const base = (import.meta.env.VITE_API_BASE_URL ?? '').trim(); // URL del backend definida en el .env

/** Sin VITE_API_BASE_URL se usa el mock. Cliente único que usa toda la app. */
export const aiClient: AiClient = base ? new HttpClient(base) : new MockClient();

export const usandoMock = base.length === 0; // true en modo demostración (sin backend)
export { ApiError } from './httpClient';
