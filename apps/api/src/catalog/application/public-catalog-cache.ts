export interface CatalogRevision {
  revision(): Promise<string>;
}

export interface PublicCatalogCache {
  readonly available: boolean;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}
