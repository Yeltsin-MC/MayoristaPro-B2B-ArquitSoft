import { Logger, OnModuleDestroy } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { PublicCatalogCache } from '../application/public-catalog-cache';

type Client = RedisClientType<{}, {}, {}, 2>;

export function cacheInteger(name: string, fallback: number, min: number, max: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} debe ser un entero entre ${min} y ${max}.`);
  }
  return value;
}

export class RedisCatalogCache implements PublicCatalogCache, OnModuleDestroy {
  private readonly logger = new Logger(RedisCatalogCache.name);
  private client?: Client;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private stopped = false;
  private warned = false;

  constructor(
    private readonly url = process.env.REDIS_URL,
    private readonly timeoutMs = cacheInteger('CATALOG_CACHE_TIMEOUT_MS', 100, 10, 1000),
  ) {
    this.open();
  }

  private open(): void {
    if (!this.url || this.stopped) return;
    const client = createClient({
      url: this.url,
      RESP: 2,
      maintNotifications: 'disabled',
      socket: { connectTimeout: this.timeoutMs, reconnectStrategy: 1000 },
      disableOfflineQueue: true,
      commandsQueueMaxLength: 64,
      commandOptions: { timeout: this.timeoutMs },
    });
    this.client = client;
    client.on('error', () => {
      if (!this.warned) this.logger.warn('Redis no disponible. El catálogo utiliza PostgreSQL.');
      this.warned = true;
    });
    client.on('ready', () => { this.warned = false; });
    const deadline = setTimeout(() => this.discard(client), this.timeoutMs);
    void client.connect().catch(() => {}).finally(() => clearTimeout(deadline));
  }

  private discard(client: Client): void {
    if (this.client !== client) return;
    this.client = undefined;
    if (client.isOpen) client.destroy();
    if (!this.stopped) {
      this.reconnectTimer = setTimeout(() => this.open(), 1000);
      this.reconnectTimer.unref();
    }
  }

  get available(): boolean {
    return this.client?.isReady === true;
  }

  private async execute<T>(operation: (client: Client) => Promise<T>): Promise<T> {
    const client = this.client;
    if (!client?.isReady) throw new Error('Redis no disponible.');
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation(client),
        new Promise<never>((_, reject) => {
          deadline = setTimeout(() => {
            this.discard(client);
            reject(new Error('Tiempo de espera Redis agotado.'));
          }, this.timeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(deadline);
    }
  }

  get(key: string): Promise<string | null> {
    return this.execute(client => client.get(key));
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.execute(client => client.set(key, value, { EX: ttlSeconds }));
  }

  onModuleDestroy(): void {
    this.stopped = true;
    clearTimeout(this.reconnectTimer);
    if (this.client?.isOpen) this.client.destroy();
  }
}
