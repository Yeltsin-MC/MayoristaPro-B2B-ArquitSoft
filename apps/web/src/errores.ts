/**
 * Texto de error para mostrar en pantalla, siempre en español.
 * Los errores propios (new Error con el mensaje de la API) se muestran tal cual;
 * los del navegador («Failed to fetch», JSON inválido) se cambian por un texto claro.
 */
export function textoError(error: unknown, alternativo: string): string {
  if (error instanceof TypeError)
    return 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
  if (error instanceof Error && error.name === 'Error' && error.message) return error.message;
  return alternativo;
}
