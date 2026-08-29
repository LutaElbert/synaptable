import type { EditorDocument } from './types';
import { validateEditorDocument } from './document-file';

const DATABASE_NAME = 'synaptable-local';
const STORE_NAME = 'documents';
const CHECKPOINT_STORE_NAME = 'checkpoints';
const DOCUMENT_ID = 'current';
const DATABASE_VERSION = 3;
const MAX_CHECKPOINTS = 20;

type StoredDocument = EditorDocument & { id: string };

export type LocalCheckpoint = {
  id: string;
  createdAt: number;
  title: string;
  document: EditorDocument;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(CHECKPOINT_STORE_NAME)) {
        const store = database.createObjectStore(CHECKPOINT_STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveLocalDocument(document: EditorDocument): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const stored: StoredDocument = { ...validateEditorDocument(document), id: DOCUMENT_ID };
      store.put(stored);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export async function loadLocalDocument(): Promise<EditorDocument | null> {
  const database = await openDatabase();
  try {
    const stored = await new Promise<StoredDocument | undefined>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(DOCUMENT_ID);
      request.onsuccess = () => resolve(request.result as StoredDocument | undefined);
      request.onerror = () => reject(request.error);
    });
    if (!stored) return null;
    return validateEditorDocument(stored);
  } finally {
    database.close();
  }
}

export async function clearLocalDocument(): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(DOCUMENT_ID);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export async function listLocalCheckpoints(): Promise<LocalCheckpoint[]> {
  const database = await openDatabase();
  try {
    const stored = await new Promise<LocalCheckpoint[]>((resolve, reject) => {
      const transaction = database.transaction(CHECKPOINT_STORE_NAME, 'readonly');
      const request = transaction.objectStore(CHECKPOINT_STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result as LocalCheckpoint[]);
      request.onerror = () => reject(request.error);
    });
    return stored
      .map((checkpoint) => ({ ...checkpoint, document: validateEditorDocument(checkpoint.document) }))
      .sort((a, b) => b.createdAt - a.createdAt);
  } finally {
    database.close();
  }
}

export async function createLocalCheckpoint(document: EditorDocument): Promise<LocalCheckpoint> {
  const checkpoint: LocalCheckpoint = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    title: document.title,
    document: validateEditorDocument(document),
  };
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(CHECKPOINT_STORE_NAME, 'readwrite');
      transaction.objectStore(CHECKPOINT_STORE_NAME).put(checkpoint);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
  const checkpoints = await listLocalCheckpoints();
  await Promise.all(checkpoints.slice(MAX_CHECKPOINTS).map((item) => deleteLocalCheckpoint(item.id)));
  return checkpoint;
}

export async function deleteLocalCheckpoint(id: string): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(CHECKPOINT_STORE_NAME, 'readwrite');
      transaction.objectStore(CHECKPOINT_STORE_NAME).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}
