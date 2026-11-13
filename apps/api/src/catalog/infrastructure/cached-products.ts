import { createHash } from 'node:crypto';
import { CatalogFilters, CatalogOptions, ProductReader, PublishedProduct } from '../application/list-products';
import { CatalogRevision, PublicCatalogCache } from '../application/public-catalog-cache';

export function catalogNamespace(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  const identity = [url.hostname, url.port, url.pathname, url.username, url.searchParams.get('options') ?? ''];
  return 'mayoristapro:catalog:v1:' + createHash('sha256').update(JSON.stringify(identity)).digest('hex');
}

export class CachedProducts implements ProductReader {
  readonly stats = { hits: 0, misses: 0, bypasses: 0, fills: 0, sourceReads: 0, revisionReads: 0 };

  constructor(
    private readonly source: ProductReader & CatalogRevision,
    private readonly cache: PublicCatalogCache,
    readonly namespace: string,
    private readonly ttlSeconds: number,
  ) {}

  key(revision: string, route: string, parameters: unknown): string {
    const hash = createHash('sha256').update(JSON.stringify(parameters)).digest('hex');
    return `${this.namespace}:${revision}:${route}:${hash}`;
  }

  listPublished(offset: number, limit: number, filters: CatalogFilters = {}): Promise<PublishedProduct[]> {
    filters = { ...filters, search: filters.search?.trim(), supplier: filters.supplier?.toLowerCase() };
    const parameters = [offset, limit, filters.search?.trim() || '', filters.category || '',
      filters.supplier?.toLowerCase() || '', filters.available ?? null, filters.sort || ''];
    return this.read('products', parameters, () => this.source.listPublished(offset, limit, filters));
  }

  options(): Promise<CatalogOptions> {
    return this.read('options', [], () => this.source.options());
  }

  private version(): Promise<string> {
    this.stats.revisionReads++;
    return this.source.revision();
  }

  private load<T>(load: () => Promise<T>): Promise<T> {
    this.stats.sourceReads++;
    return load();
  }

  private async read<T>(route: string, parameters: unknown, load: () => Promise<T>): Promise<T> {
    if (!this.cache.available) {
      this.stats.bypasses++;
      return this.load(load);
    }
    let revision: string;
    let key: string;
    try {
      revision = await this.version();
      key = this.key(revision, route, parameters);
      const cached = await this.cache.get(key);
      if (cached !== null) {
        const value = JSON.parse(cached) as T;
        if (await this.version() === revision) {
          this.stats.hits++;
          return value;
        }
        this.stats.bypasses++;
        return this.load(load);
      }
    } catch {
      this.stats.bypasses++;
      return this.load(load);
    }
    this.stats.misses++;
    // PostgreSQL failures propagate once, independently of cache failures.
    const value = await this.load(load);
    try {
      if (await this.version() === revision) {
        await this.cache.set(key, JSON.stringify(value), this.ttlSeconds);
        this.stats.fills++;
      }
    } catch {
      // The database read already succeeded. A failed fill must preserve it.
    }
    return value;
  }
}
