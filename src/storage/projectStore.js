/**
 * @fileoverview IndexedDB Project Store with availability guard and in-memory fallback.
 * Provides safe asynchronous CRUD operations for editor projects across browser environments.
 */

const DB_NAME = 'sarj_cam_db';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

/** @type {IDBDatabase|null} */
let dbInstance = null;

/** @type {boolean} */
let isDbAvailable =
  typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB !== null;

/** @type {Map<string, object>} */
const inMemoryFallbackStore = new Map();

/**
 * Returns whether IndexedDB is currently available and functioning.
 * @returns {boolean} True if native IndexedDB is available, false if using in-memory fallback.
 */
export function isStorageAvailable() {
  return isDbAvailable;
}

/**
 * Initializes the IndexedDB database connection.
 * If blocked (e.g. private browsing, sandbox restrictions), falls back to an in-memory store gracefully.
 * @returns {Promise<{ success: boolean, inMemory: boolean }>}
 */
export function initProjectStore() {
  return new Promise((resolve) => {
    if (!isDbAvailable) {
      console.warn(
        '[ProjectStore] IndexedDB is not supported in this environment. Falling back to in-memory store.'
      );
      return resolve({ success: true, inMemory: true });
    }

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (e) => {
        console.warn(
          '[ProjectStore] IndexedDB open error (likely private mode or quota limit):',
          e
        );
        isDbAvailable = false;
        resolve({ success: false, inMemory: true });
      };

      request.onsuccess = (e) => {
        const target = /** @type {IDBOpenDBRequest} */ (e.target);
        dbInstance = target.result;

        // Catch connection closed or unhandled errors later
        dbInstance.onerror = (event) => {
          console.error('[ProjectStore] Generic database error:', event);
        };

        resolve({ success: true, inMemory: false });
      };

      request.onupgradeneeded = (e) => {
        const target = /** @type {IDBOpenDBRequest} */ (e.target);
        const db = target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
    } catch (err) {
      console.warn('[ProjectStore] Exception initializing IndexedDB:', err);
      isDbAvailable = false;
      resolve({ success: false, inMemory: true });
    }
  });
}

/**
 * Fetches all saved projects, sorted by last updated timestamp descending.
 * @returns {Promise<Array<object>>}
 */
export function getAllProjects() {
  return new Promise((resolve) => {
    if (!isDbAvailable || !dbInstance) {
      const projects = Array.from(inMemoryFallbackStore.values());
      projects.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      return resolve(projects);
    }

    try {
      const transaction = dbInstance.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = (e) => {
        const target = /** @type {IDBRequest} */ (e.target);
        const results = target.result || [];
        results.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        resolve(results);
      };

      request.onerror = () => {
        const fallback = Array.from(inMemoryFallbackStore.values());
        resolve(fallback);
      };
    } catch (err) {
      console.warn('[ProjectStore] Failed to read from IndexedDB, using fallback:', err);
      resolve(Array.from(inMemoryFallbackStore.values()));
    }
  });
}

/**
 * Fetches a single project by its ID.
 * @param {string} id - Project identifier.
 * @returns {Promise<object|null>}
 */
export function getProject(id) {
  return new Promise((resolve) => {
    if (!id) return resolve(null);

    if (!isDbAvailable || !dbInstance) {
      return resolve(inMemoryFallbackStore.get(id) || null);
    }

    try {
      const transaction = dbInstance.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = (e) => {
        const target = /** @type {IDBRequest} */ (e.target);
        resolve(target.result || inMemoryFallbackStore.get(id) || null);
      };

      request.onerror = () => {
        resolve(inMemoryFallbackStore.get(id) || null);
      };
    } catch (err) {
      console.warn(`[ProjectStore] Error fetching project ${id}:`, err);
      resolve(inMemoryFallbackStore.get(id) || null);
    }
  });
}

/**
 * Saves or updates a project in the store.
 * @param {object} project - The project object (must have an `id` property).
 * @returns {Promise<{ success: boolean, inMemory: boolean, error?: string }>}
 */
export function saveProject(project) {
  return new Promise((resolve) => {
    if (!project || !project.id) {
      return resolve({
        success: false,
        inMemory: !isDbAvailable,
        error: 'Project must contain a valid ID'
      });
    }

    // Always keep in-memory fallback updated
    inMemoryFallbackStore.set(project.id, project);

    if (!isDbAvailable || !dbInstance) {
      return resolve({ success: true, inMemory: true });
    }

    try {
      const transaction = dbInstance.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(project);

      request.onsuccess = () => {
        resolve({ success: true, inMemory: false });
      };

      request.onerror = (e) => {
        const target = /** @type {IDBRequest} */ (e.target);
        console.warn('[ProjectStore] Save error in IndexedDB:', target.error);
        resolve({
          success: true,
          inMemory: true,
          error: target.error ? target.error.message : 'Database write error'
        });
      };
    } catch (err) {
      console.warn('[ProjectStore] Save transaction error:', err);
      resolve({
        success: true,
        inMemory: true,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });
}

/**
 * Deletes a project from the store by its ID.
 * @param {string} id - Project identifier.
 * @returns {Promise<{ success: boolean }>}
 */
export function deleteProject(id) {
  return new Promise((resolve) => {
    inMemoryFallbackStore.delete(id);

    if (!isDbAvailable || !dbInstance) {
      return resolve({ success: true });
    }

    try {
      const transaction = dbInstance.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve({ success: true });
      request.onerror = () => resolve({ success: false });
    } catch (err) {
      console.warn(`[ProjectStore] Delete transaction error for ${id}:`, err);
      resolve({ success: false });
    }
  });
}
