import type { EditorDocument } from './types';

const DATABASE_NAME = 'synaptable-local';
const STORE_NAME = 'documents';
const DOCUMENT_ID = 'current';

type StoredDocument = EditorDocument & { id: string };

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveLocalDocument(document: EditorDocument): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const stored: StoredDocument = { ...document, id: DOCUMENT_ID };
    store.put(stored);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function loadLocalDocument(): Promise<EditorDocument | null> {
  const database = await openDatabase();
  const stored = await new Promise<StoredDocument | undefined>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(DOCUMENT_ID);
    request.onsuccess = () => resolve(request.result as StoredDocument | undefined);
    request.onerror = () => reject(request.error);
  });
  database.close();
  if (!stored || stored.schemaVersion !== 1) return null;
  return {
    schemaVersion: stored.schemaVersion,
    title: stored.title,
    nodes: stored.nodes,
    edges: stored.edges,
    updatedAt: stored.updatedAt,
  };
}

export async function clearLocalDocument(): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(DOCUMENT_ID);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}
