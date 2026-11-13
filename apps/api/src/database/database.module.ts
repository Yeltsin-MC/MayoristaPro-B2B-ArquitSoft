import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { Pool } from 'pg';

/** Token del único pool de PostgreSQL compartido por todos los módulos. */
export const PG_POOL = Symbol('PG_POOL');

export function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Configura DATABASE_URL antes de arrancar la API.');
  return new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_SIZE ?? 20),
    connectionTimeoutMillis: 5000,
  });
}

@Global()
@Module({
  providers: [{ provide: PG_POOL, useFactory: createPool }],
  exports: [PG_POOL],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
