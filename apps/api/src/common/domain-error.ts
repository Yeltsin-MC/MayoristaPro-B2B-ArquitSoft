/**
 * Error de regla de negocio con un código estable (p. ej. INVALID_INPUT,
 * OFFER_EXPIRED). La capa HTTP traduce el código a un estado HTTP en
 * ApiExceptionFilter; el dominio no conoce HTTP.
 */
export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** Estado HTTP para un código de dominio. */
export function statusForCode(code: string): number {
  if (code === 'FORBIDDEN') return 403;
  if (code === 'INVALID_SIGNATURE') return 401;
  if (code.endsWith('_NOT_FOUND')) return 404;
  if (code.startsWith('INVALID_')) return 422;
  return 409;
}
