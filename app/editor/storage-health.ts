export type StorageHealth = {
  supported: boolean;
  usage: number | null;
  quota: number | null;
  persisted: boolean | null;
};

export function isQuotaExceededError(error: unknown): boolean {
  return error instanceof DOMException && (
    error.name === 'QuotaExceededError'
    || error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || error.code === 22
    || error.code === 1014
  );
}

export function storageUsageRatio(health: StorageHealth): number | null {
  if (health.usage === null || health.quota === null || health.quota <= 0) return null;
  return Math.max(0, Math.min(1, health.usage / health.quota));
}

export function formatStorageBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return 'Unknown';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

export async function inspectStorageHealth(): Promise<StorageHealth> {
  const storage = navigator.storage;
  if (!storage) return { supported: false, usage: null, quota: null, persisted: null };
  const estimatePromise: Promise<StorageEstimate> = storage.estimate
    ? storage.estimate().catch(() => ({}))
    : Promise.resolve({});
  const persistedPromise: Promise<boolean | null> = storage.persisted
    ? storage.persisted().catch(() => null)
    : Promise.resolve(null);
  const [estimate, persisted] = await Promise.all([
    estimatePromise,
    persistedPromise,
  ]);
  return {
    supported: true,
    usage: typeof estimate.usage === 'number' ? estimate.usage : null,
    quota: typeof estimate.quota === 'number' ? estimate.quota : null,
    persisted,
  };
}

export async function requestPersistentStorage(): Promise<boolean | null> {
  const persist = navigator.storage?.persist;
  if (!persist) return null;
  return persist.call(navigator.storage);
}
