const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NotFoundException } = require('@nestjs/common');
const { ApiExceptionFilter } = require('../apps/api/dist/common/api-exception.filter');
const { statusForCode } = require('../apps/api/dist/common/domain-error');
const { TradeRule } = require('../apps/api/dist/trade/domain/trade');
const { PaymentError } = require('../apps/api/dist/payments/domain/payment');

function respond(error) {
  const sent = {};
  const response = { status(code) { sent.status = code; return this; }, json(body) { sent.body = body; } };
  const host = { switchToHttp: () => ({ getResponse: () => response }) };
  new ApiExceptionFilter().catch(error, host);
  return sent;
}

test('códigos de dominio se traducen a un estado HTTP estable', () => {
  assert.equal(statusForCode('INVALID_INPUT'), 422);
  assert.equal(statusForCode('ORDER_NOT_FOUND'), 404);
  assert.equal(statusForCode('FORBIDDEN'), 403);
  assert.equal(statusForCode('INVALID_SIGNATURE'), 401);
  assert.equal(statusForCode('OFFER_EXPIRED'), 409);
});

test('todos los errores salen con el formato { statusCode, code, message }', () => {
  assert.deepEqual(respond(new TradeRule('INVALID_INPUT', 'Dato inválido.')), {
    status: 422, body: { statusCode: 422, code: 'INVALID_INPUT', message: 'Dato inválido.' },
  });
  assert.equal(respond(new PaymentError('ORDER_NOT_FOUND', 'No existe.')).status, 404);
  const http = respond(new NotFoundException('Lote no disponible.'));
  assert.equal(http.status, 404);
  assert.equal(http.body.code, 'NOT_FOUND');
  assert.equal(http.body.message, 'Lote no disponible.');
  const unknown = respond(new Error('detalle interno'));
  assert.deepEqual(unknown.body, { statusCode: 500, code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' });
});
