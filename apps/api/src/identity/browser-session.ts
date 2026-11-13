import { ForbiddenException } from '@nestjs/common';
import { IncomingMessage, ServerResponse } from 'node:http';
import { TLSSocket } from 'node:tls';

const NAME = 'mayoristapro_session';

export function browserToken(cookie?: string): string | undefined {
  const values = cookie?.split(';').map(value => value.trim()).filter(value => value.startsWith(NAME + '=')) ?? [];
  if (values.length !== 1) return undefined;
  const token = values[0].slice(NAME.length + 1);
  return /^[a-f0-9]{64}$/.test(token) ? token : undefined;
}

function secureCookie(request: IncomingMessage): boolean {
  const publicUrl = process.env.FRONTEND_URL ?? process.env.API_URL;
  return request.socket instanceof TLSSocket || (publicUrl
    ? new URL(publicUrl).protocol === 'https:' : process.env.NODE_ENV === 'production');
}

export function sameOrigin(request: IncomingMessage): void {
  if (!request.headers.origin) return; // Los clientes API con Bearer siguen siendo compatibles.
  const expected = new URL((secureCookie(request) ? 'https://' : 'http://') + request.headers.host).origin;
  if (request.headers.origin !== expected) throw new ForbiddenException('Origen de acceso no permitido.');
}

export function sessionCookie(response: ServerResponse, request: IncomingMessage, token?: string): void {
  // Sin Expires/Max-Age en el alta: cookie de sesión, limitada además por PostgreSQL.
  const attributes = ['Path=/api/v1/auth', 'HttpOnly', 'SameSite=Strict'];
  if (secureCookie(request)) attributes.push('Secure');
  if (!token) attributes.push('Max-Age=0');
  response.setHeader('Set-Cookie', NAME + '=' + (token ?? '') + '; ' + attributes.join('; '));
  response.setHeader('Cache-Control', 'no-store');
}