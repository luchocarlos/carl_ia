import { expect, test } from '@playwright/test';

// Flujo principal: enviar un mensaje, recibir la respuesta simulada, descontar la cuota y conservarlo tras recargar.
test('envía un mensaje con MockClient y persiste al recargar', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /¿Qué programamos hoy\?/ })).toBeVisible(); // pantalla de inicio

  // Escribe y envía con Enter
  const entrada = page.getByLabel('Mensaje para Carl');
  await entrada.fill('Hola Carl, ¿puedes revisar mi código?');
  await entrada.press('Enter');

  await expect(page.getByRole('article', { name: 'Tu mensaje' })).toContainText(
    'Hola Carl, ¿puedes revisar mi código?',
  );

  // Espera a que el streaming simulado termine de pintar la respuesta
  await expect(page.getByText('Revisión rápida (demostración)')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Estoy en modo demostración/)).toBeVisible();

  await expect(page.getByText('1/30 pts')).toBeVisible(); // modo texto cuesta 1 punto

  // Tras recargar, el historial se rehidrata desde localStorage
  await page.reload();

  await expect(page.getByRole('article', { name: 'Tu mensaje' })).toContainText(
    'Hola Carl, ¿puedes revisar mi código?',
  );
});

// En viewport móvil: abrir el menú lateral, cancelar y luego confirmar el borrado del historial.
test('en móvil abre el menú y borra el historial con confirmación', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); // tamaño de un teléfono
  await page.goto('/');

  // Crea una conversación para que haya algo que borrar
  const entrada = page.getByLabel('Mensaje para Carl');
  await entrada.fill('Una idea para probar el historial');
  await entrada.press('Enter');
  await expect(page.getByText('Revisión rápida (demostración)')).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await expect(
    page.getByRole('navigation', { name: 'Historial de conversaciones' }),
  ).toBeVisible();

  // Cancelar cierra el diálogo sin borrar
  await page.getByRole('button', { name: 'Borrar historial' }).click();
  await expect(page.getByRole('dialog', { name: '¿Borrar todo el historial?' })).toBeVisible();

  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Confirmar borra todo y vuelve a la pantalla de inicio
  await page.getByRole('button', { name: 'Borrar historial' }).click();
  await page.getByRole('button', { name: 'Borrar todo' }).click();

  await expect(page.getByRole('heading', { name: /¿Qué programamos hoy\?/ })).toBeVisible();
  await expect(page.getByText('Aún no hay conversaciones.')).toBeVisible();
});
