/** Nombre de archivo seguro y corto (sin tildes ni caracteres especiales, máx. 48 caracteres). */
export function nombreSeguro(base: string, extension: string): string {
  const limpio = base
    .normalize('NFD') // separa letras y tildes
    .replace(/[\u0300-\u036f]/g, '') // elimina las tildes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // cualquier otro carácter pasa a guion
    .replace(/^-+|-+$/g, '') // sin guiones al inicio ni al final
    .slice(0, 48);

  return `${limpio || 'carl'}.${extension}`; // 'carl' si el nombre queda vacío
}

// Descarga un Blob en el navegador creando un enlace temporal y simulando el clic.
export function descargarBlob(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob); // URL temporal en memoria
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.rel = 'noopener';
  document.body.appendChild(enlace); // algunos navegadores exigen que esté en el DOM
  enlace.click();
  enlace.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500); // libera la memoria tras iniciar la descarga
}

// Descarga un texto como archivo Markdown (.md).
export function descargarTexto(contenido: string, nombre: string): void {
  descargarBlob(new Blob([contenido], { type: 'text/markdown;charset=utf-8' }), nombre);
}
