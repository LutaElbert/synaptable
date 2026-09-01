import type { EditorDocument } from './types';
import { validateEditorDocument } from './document-file';

const DATABASE_NAME = 'synaptable-local';
const DOCUMENT_STORE_NAME = 'documents';
const CHECKPOINT_STORE_NAME = 'checkpoints';
const PREFERENCE_STORE_NAME = 'preferences';
const LEGACY_DOCUMENT_ID = 'current';
const ACTIVE_PROJECT_KEY = 'activeProjectId';
const DATABASE_VERSION = 4;
export const MAX_CHECKPOINTS = 20;
export const MAX_CHECKPOINT_BYTES = 80 * 1024 * 1024;

type LegacyStoredDocument = EditorDocument & { id: typeof LEGACY_DOCUMENT_ID };
type StoredProject = {
  id: string;
  title: string;
  updatedAt: number;
  document: EditorDocument;
};
type StoredPreference = { name: string; value: string };

export type LocalProjectSummary = Pick<StoredProject, 'id' | 'title' | 'updatedAt'>;
export type LocalWorkspace = {
  activeProjectId: string;
  document: EditorDocument;
  projects: LocalProjectSummary[];
};

export type LocalCheckpoint = {
  id: string;
  projectId: string;
  createdAt: number;
  title: string;
  bytes: number;
  document: EditorDocument;
};

export function serializedDocumentBytes(document: EditorDocument): number {
  return new TextEncoder().encode(JSON.stringify(document)).byteLength;
}

export function checkpointIdsToPrune(
  checkpoints: LocalCheckpoint[],
  maxCount = MAX_CHECKPOINTS,
  maxBytes = MAX_CHECKPOINT_BYTES,
): string[] {
  const retained = [...checkpoints].sort((left, right) => right.createdAt - left.createdAt);
  let bytes = retained.reduce((total, checkpoint) => total + checkpoint.bytes, 0);
  const pruned: string[] = [];
  while (retained.length > maxCount || (retained.length > 1 && bytes > maxBytes)) {
    const oldest = retained.pop();
    if (!oldest) break;
    bytes -= oldest.bytes;
    pruned.push(oldest.id);
  }
  return pruned;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error('The local database transaction was cancelled.'));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      const transaction = request.transaction;
      if (!transaction) throw new Error('The local database upgrade is unavailable.');
      if (!database.objectStoreNames.contains(DOCUMENT_STORE_NAME)) {
        database.createObjectStore(DOCUMENT_STORE_NAME, { keyPath: 'id' });
      }
      const checkpoints = database.objectStoreNames.contains(CHECKPOINT_STORE_NAME)
        ? transaction.objectStore(CHECKPOINT_STORE_NAME)
        : database.createObjectStore(CHECKPOINT_STORE_NAME, { keyPath: 'id' });
      if (!checkpoints.indexNames.contains('createdAt')) checkpoints.createIndex('createdAt', 'createdAt');
      if (!checkpoints.indexNames.contains('projectId')) checkpoints.createIndex('projectId', 'projectId');
      if (!checkpoints.indexNames.contains('projectCreatedAt')) {
        checkpoints.createIndex('projectCreatedAt', ['projectId', 'createdAt']);
      }
      if (!database.objectStoreNames.contains(PREFERENCE_STORE_NAME)) {
        database.createObjectStore(PREFERENCE_STORE_NAME, { keyPath: 'name' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close other SynapTable tabs before upgrading local projects.'));
  });
}

function isStoredProject(value: unknown): value is StoredProject {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<StoredProject>;
  return typeof record.id === 'string'
    && record.id !== LEGACY_DOCUMENT_ID
    && typeof record.title === 'string'
    && typeof record.updatedAt === 'number'
    && Boolean(record.document);
}

function projectSummary(project: StoredProject): LocalProjectSummary {
  return { id: project.id, title: project.title, updatedAt: project.updatedAt };
}

function storedProject(id: string, document: EditorDocument): StoredProject {
  const validated = validateEditorDocument(document);
  return {
    id,
    title: validated.title,
    updatedAt: validated.updatedAt,
    document: validated,
  };
}

export async function initializeLocalWorkspace(fallback: EditorDocument): Promise<LocalWorkspace> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(
      [DOCUMENT_STORE_NAME, CHECKPOINT_STORE_NAME, PREFERENCE_STORE_NAME],
      'readwrite',
    );
    const completion = transactionComplete(transaction);
    const documents = transaction.objectStore(DOCUMENT_STORE_NAME);
    const checkpoints = transaction.objectStore(CHECKPOINT_STORE_NAME);
    const preferences = transaction.objectStore(PREFERENCE_STORE_NAME);
    const [records, activePreference] = await Promise.all([
      requestResult(documents.getAll()),
      requestResult(preferences.get(ACTIVE_PROJECT_KEY)) as Promise<StoredPreference | undefined>,
    ]);

    const projects = records
      .filter(isStoredProject)
      .map((record) => storedProject(record.id, record.document))
      .sort((left, right) => right.updatedAt - left.updatedAt);
    let active = projects.find((project) => project.id === activePreference?.value) ?? projects[0];

    if (!active) {
      const legacy = records.find((record) => (
        Boolean(record)
        && typeof record === 'object'
        && (record as { id?: unknown }).id === LEGACY_DOCUMENT_ID
      )) as LegacyStoredDocument | undefined;
      const document = validateEditorDocument(legacy ?? fallback);
      active = storedProject(crypto.randomUUID(), document);
      documents.put(active);
    }

    // This also makes an interrupted version-4 initialization resumable: a
    // project record can already exist while legacy checkpoints still need a
    // project association.
    const checkpointCursor = checkpoints.openCursor();
    checkpointCursor.onsuccess = () => {
      const cursor = checkpointCursor.result;
      if (!cursor) return;
      const checkpoint = cursor.value as Partial<LocalCheckpoint>;
      if (!checkpoint.projectId) cursor.update({ ...checkpoint, projectId: active!.id });
      cursor.continue();
    };

    preferences.put({ name: ACTIVE_PROJECT_KEY, value: active.id } satisfies StoredPreference);
    await completion;
    const summaries = [active, ...projects.filter((project) => project.id !== active.id)]
      .map(projectSummary)
      .sort((left, right) => right.updatedAt - left.updatedAt);
    return { activeProjectId: active.id, document: active.document, projects: summaries };
  } finally {
    database.close();
  }
}

export async function listLocalProjects(): Promise<LocalProjectSummary[]> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(DOCUMENT_STORE_NAME, 'readonly');
    const records = await requestResult(transaction.objectStore(DOCUMENT_STORE_NAME).getAll());
    return records
      .filter(isStoredProject)
      .map((record) => projectSummary(storedProject(record.id, record.document)))
      .sort((left, right) => right.updatedAt - left.updatedAt);
  } finally {
    database.close();
  }
}

export async function getLocalPreference(name: string): Promise<string | null> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(PREFERENCE_STORE_NAME, 'readonly');
    const preference = await requestResult(transaction.objectStore(PREFERENCE_STORE_NAME).get(name)) as StoredPreference | undefined;
    return preference?.value ?? null;
  } finally {
    database.close();
  }
}

export async function setLocalPreference(name: string, value: string): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(PREFERENCE_STORE_NAME, 'readwrite');
    const completion = transactionComplete(transaction);
    transaction.objectStore(PREFERENCE_STORE_NAME).put({ name, value } satisfies StoredPreference);
    await completion;
  } finally {
    database.close();
  }
}

export async function loadLocalProject(projectId: string): Promise<EditorDocument | null> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(DOCUMENT_STORE_NAME, 'readonly');
    const record = await requestResult(transaction.objectStore(DOCUMENT_STORE_NAME).get(projectId));
    return isStoredProject(record) ? validateEditorDocument(record.document) : null;
  } finally {
    database.close();
  }
}

export async function setActiveLocalProject(projectId: string): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction([DOCUMENT_STORE_NAME, PREFERENCE_STORE_NAME], 'readwrite');
    const completion = transactionComplete(transaction);
    const record = await requestResult(transaction.objectStore(DOCUMENT_STORE_NAME).get(projectId));
    if (!isStoredProject(record)) {
      await completion;
      throw new Error('That local project no longer exists.');
    }
    transaction.objectStore(PREFERENCE_STORE_NAME).put({ name: ACTIVE_PROJECT_KEY, value: projectId });
    await completion;
  } finally {
    database.close();
  }
}

export async function createLocalProject(document: EditorDocument): Promise<LocalProjectSummary> {
  const project = storedProject(crypto.randomUUID(), document);
  const database = await openDatabase();
  try {
    const transaction = database.transaction([DOCUMENT_STORE_NAME, PREFERENCE_STORE_NAME], 'readwrite');
    const completion = transactionComplete(transaction);
    transaction.objectStore(DOCUMENT_STORE_NAME).put(project);
    transaction.objectStore(PREFERENCE_STORE_NAME).put({ name: ACTIVE_PROJECT_KEY, value: project.id });
    await completion;
    return projectSummary(project);
  } finally {
    database.close();
  }
}

export async function saveLocalDocument(projectId: string, document: EditorDocument): Promise<void> {
  const project = storedProject(projectId, document);
  const database = await openDatabase();
  try {
    const transaction = database.transaction(DOCUMENT_STORE_NAME, 'readwrite');
    const completion = transactionComplete(transaction);
    transaction.objectStore(DOCUMENT_STORE_NAME).put(project);
    await completion;
  } finally {
    database.close();
  }
}

export async function renameLocalProject(projectId: string, title: string): Promise<EditorDocument> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(DOCUMENT_STORE_NAME, 'readwrite');
    const completion = transactionComplete(transaction);
    const store = transaction.objectStore(DOCUMENT_STORE_NAME);
    const record = await requestResult(store.get(projectId));
    if (!isStoredProject(record)) {
      await completion;
      throw new Error('That local project no longer exists.');
    }
    const document = validateEditorDocument({ ...record.document, title: title.trim() || 'Untitled project', updatedAt: Date.now() });
    store.put(storedProject(projectId, document));
    await completion;
    return document;
  } finally {
    database.close();
  }
}

export async function deleteLocalProject(projectId: string): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction([DOCUMENT_STORE_NAME, CHECKPOINT_STORE_NAME], 'readwrite');
    const completion = transactionComplete(transaction);
    transaction.objectStore(DOCUMENT_STORE_NAME).delete(projectId);
    const index = transaction.objectStore(CHECKPOINT_STORE_NAME).index('projectId');
    const cursorRequest = index.openKeyCursor(IDBKeyRange.only(projectId));
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) return;
      transaction.objectStore(CHECKPOINT_STORE_NAME).delete(cursor.primaryKey);
      cursor.continue();
    };
    await completion;
  } finally {
    database.close();
  }
}

export async function clearLocalDocument(projectId?: string): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction([DOCUMENT_STORE_NAME, PREFERENCE_STORE_NAME], 'readwrite');
    const completion = transactionComplete(transaction);
    let id = projectId;
    if (!id) {
      const preference = await requestResult(transaction.objectStore(PREFERENCE_STORE_NAME).get(ACTIVE_PROJECT_KEY)) as StoredPreference | undefined;
      id = preference?.value;
    }
    if (id) transaction.objectStore(DOCUMENT_STORE_NAME).delete(id);
    await completion;
  } finally {
    database.close();
  }
}

export async function listLocalCheckpoints(projectId: string): Promise<LocalCheckpoint[]> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(CHECKPOINT_STORE_NAME, 'readonly');
    const stored = await requestResult(
      transaction.objectStore(CHECKPOINT_STORE_NAME).index('projectId').getAll(projectId),
    ) as LocalCheckpoint[];
    return stored
      .map((checkpoint) => {
        const document = validateEditorDocument(checkpoint.document);
        return {
          ...checkpoint,
          projectId,
          bytes: Number.isFinite(checkpoint.bytes) && checkpoint.bytes > 0
            ? checkpoint.bytes
            : serializedDocumentBytes(document),
          document,
        };
      })
      .sort((left, right) => right.createdAt - left.createdAt);
  } finally {
    database.close();
  }
}

export async function createLocalCheckpoint(projectId: string, document: EditorDocument): Promise<LocalCheckpoint> {
  const validated = validateEditorDocument(document);
  const bytes = serializedDocumentBytes(validated);
  if (bytes > MAX_CHECKPOINT_BYTES) {
    throw new Error('This project is too large for a local checkpoint. Download a backup instead.');
  }
  const checkpoint: LocalCheckpoint = {
    id: crypto.randomUUID(),
    projectId,
    createdAt: Date.now(),
    title: document.title,
    bytes,
    document: validated,
  };
  const database = await openDatabase();
  try {
    const transaction = database.transaction(CHECKPOINT_STORE_NAME, 'readwrite');
    const completion = transactionComplete(transaction);
    transaction.objectStore(CHECKPOINT_STORE_NAME).put(checkpoint);
    await completion;
  } finally {
    database.close();
  }
  const checkpoints = await listLocalCheckpoints(projectId);
  await Promise.all(checkpointIdsToPrune(checkpoints).map((id) => deleteLocalCheckpoint(id)));
  return checkpoint;
}

export async function deleteLocalCheckpoint(id: string): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(CHECKPOINT_STORE_NAME, 'readwrite');
    const completion = transactionComplete(transaction);
    transaction.objectStore(CHECKPOINT_STORE_NAME).delete(id);
    await completion;
  } finally {
    database.close();
  }
}
