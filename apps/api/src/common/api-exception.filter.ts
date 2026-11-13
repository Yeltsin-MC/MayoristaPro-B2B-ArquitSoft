import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { DomainError, statusForCode } from './domain-error';

/**
 * Formato único de error para toda la API:
 *   { statusCode, code, message }
 * Las HttpException de Nest conservan sus campos (message, error) y suman `code`.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('API');

  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse();
    if (error instanceof DomainError) {
      const statusCode = statusForCode(error.code);
      response.status(statusCode).json({ statusCode, code: error.code, message: error.message });
      return;
    }
    if (error instanceof HttpException) {
      const statusCode = error.getStatus();
      const body = error.getResponse();
      const fields = typeof body === 'string' ? { message: body } : (body as Record<string, unknown>);
      response.status(statusCode).json({ statusCode, code: HttpStatus[statusCode] ?? 'HTTP_ERROR', ...fields });
      return;
    }
    this.logger.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    response.status(500).json({ statusCode: 500, code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' });
  }
}
