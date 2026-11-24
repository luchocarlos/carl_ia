import { beforeEach, describe, expect, it } from 'vitest';
import { COSTS, DAILY_LIMIT } from '../config';
import { claveDiaBogota, proximoReinicio } from '../lib/time';
import { estadoDeConsumo } from '../lib/usage';
import { useUsageStore } from './usageStore';

// Deja el store de consumo en cero para la fecha indicada.
function reiniciar(ahora = new Date()) {
  useUsageStore.setState({
    dia: claveDiaBogota(ahora),
    usado: 0,
    limite: DAILY_LIMIT,
    resetAt: proximoReinicio(ahora).toISOString(),
    globalPct: 0,
    globalStatus: 'ok',
    lastSync: null,
  });
}

// Cada test parte de un almacenamiento limpio y un contador en cero.
beforeEach(() => {
  localStorage.clear();
  reiniciar();
});

// Costos por modo y acumulación respetando el límite diario.
describe('costos y consumo', () => {
  it('asigna los costos acordados por modo', () => {
    expect(COSTS.text).toBe(1);
    expect(COSTS.document).toBe(3);
  });

  it('acumula puntos y respeta el límite', () => {
    const { registrarConsumo, puedeGastar } = useUsageStore.getState();

    registrarConsumo(COSTS.text);
    registrarConsumo(COSTS.document);

    expect(useUsageStore.getState().usado).toBe(4); // 1 + 3
    expect(puedeGastar(COSTS.document)).toBe(true);

    useUsageStore.setState({ usado: 28 }); // quedan 2 puntos
    expect(useUsageStore.getState().puedeGastar(COSTS.document)).toBe(false); // 3 no caben
    expect(useUsageStore.getState().puedeGastar(2)).toBe(true); // 2 justo caben
  });

  // Umbrales visuales: 'busy' desde el 80 % y 'full' al 100 % (bloquea nuevos envíos).
  it('marca ámbar al 80 % y bloquea al 100 %', () => {
    useUsageStore.setState({ usado: 24 });
    expect(estadoDeConsumo(24, DAILY_LIMIT)).toBe('busy');

    useUsageStore.setState({ usado: DAILY_LIMIT });
    expect(estadoDeConsumo(DAILY_LIMIT, DAILY_LIMIT)).toBe('full');
    expect(useUsageStore.getState().puedeGastar(1)).toBe(false);
  });

  // registrarConsumo nunca deja `usado` por encima del límite.
  it('no supera el límite al registrar de más', () => {
    useUsageStore.setState({ usado: 29 });
    useUsageStore.getState().registrarConsumo(COSTS.document);
    expect(useUsageStore.getState().usado).toBe(DAILY_LIMIT);
  });
});

// El día cambia a medianoche de Bogotá (UTC-5), es decir, a las 05:00 UTC.
describe('reinicio diario en America/Bogota', () => {
  it('calcula la próxima medianoche como 05:00 UTC', () => {
    expect(proximoReinicio(new Date('2026-11-21T15:00:00.000Z')).toISOString()).toBe(
      '2026-11-22T05:00:00.000Z',
    );
  });

  it('reinicia al cambiar de día en Bogotá', () => {
    useUsageStore.setState({ dia: '2026-11-20', usado: 12 });

    useUsageStore.getState().reiniciarSiCambioDia(new Date('2026-11-21T05:00:00.000Z')); // exactamente medianoche en Bogotá

    const estado = useUsageStore.getState();
    expect(estado.dia).toBe('2026-11-21');
    expect(estado.usado).toBe(0);
    expect(estado.resetAt).toBe('2026-11-22T05:00:00.000Z');
  });

  it('no reinicia antes de la medianoche de Bogotá', () => {
    useUsageStore.setState({ dia: '2026-11-20', usado: 12 });

    useUsageStore.getState().reiniciarSiCambioDia(new Date('2026-11-21T04:59:00.000Z')); // 23:59 en Bogotá

    expect(useUsageStore.getState().usado).toBe(12);
    expect(useUsageStore.getState().dia).toBe('2026-11-20');
  });
});

// reconciliar() reemplaza los valores locales con los que devuelve el backend.
describe('reconciliación con el servidor', () => {
  it('toma los valores de /api/usage como fuente de verdad', () => {
    useUsageStore.getState().reconciliar({
      used: 7,
      limit: 30,
      resetAt: '2026-11-22T05:00:00.000Z',
      global: { pct: 88, status: 'ocupado' },
    });

    const estado = useUsageStore.getState();
    expect(estado.usado).toBe(7);
    expect(estado.globalPct).toBe(88);
    expect(estado.globalStatus).toBe('ocupado');
    expect(estado.resetAt).toBe('2026-11-22T05:00:00.000Z');
  });
});
