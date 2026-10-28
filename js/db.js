/**
 * Local persistence. Everything lives in the browser's IndexedDB: books,
 * page text, cached passage vectors, chat history, settings and quiz results.
 * No account, no server-side student database. If IndexedDB is unavailable
 * (some private windows), an in-memory backend keeps the session usable.
 */

import { maskStudentKeyVault } from "./student-keys.js";

const DB_NAME = "vignan-study-ai";
const DB_VERSION = 1;
const STORES = ["books", "chunks", "settings", "messages", "results"];

let backendPromise = null;

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted"));
  });
}

function openIDB() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error("IndexedDB is unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("books")) db.createObjectStore("books", { keyPath: "id" });
      if (!db.objectStoreNames.contains("chunks")) {
        const chunks = db.createObjectStore("chunks", { keyPath: "id" });
        chunks.createIndex("bookId", "bookId", { unique: false });
      }
      if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings", { keyPath: "key" });
      if (!db.objectStoreNames.contains("messages")) {
        const messages = db.createObjectStore("messages", { keyPath: "id" });
        messages.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (!db.objectStoreNames.contains("results")) {
        const results = db.createObjectStore("results", { keyPath: "id" });
        results.createIndex("date", "date", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open IndexedDB"));
    request.onblocked = () => reject(new Error("IndexedDB upgrade was blocked by another tab"));
  });
}

function idbBackend(db) {
  const run = async (storeName, mode, callback) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const result = await callback(store, transaction);
    await transactionDone(transaction);
    return result;
  };
  return {
    mode: "indexeddb",
    get: (store, key) => run(store, "readonly", async (objectStore) => requestResult(objectStore.get(key))),
    put: (store, value) => run(store, "readwrite", async (objectStore) => {
      objectStore.put(value);
      return value;
    }),
    delete: (store, key) => run(store, "readwrite", async (objectStore) => {
      objectStore.delete(key);
      return true;
    }),
    getAll: (store) => run(store, "readonly", async (objectStore) => requestResult(objectStore.getAll())),
    getByIndex: (store, indexName, key) =>
      run(store, "readonly", async (objectStore) => requestResult(objectStore.index(indexName).getAll(key))),
    clear: (store) => run(store, "readwrite", async (objectStore) => {
      objectStore.clear();
      return true;
    }),
    clearAll: async () => {
      await Promise.all(STORES.map((store) => run(store, "readwrite", async (objectStore) => objectStore.clear())));
    },
  };
}

function memoryBackend() {
  const stores = new Map(STORES.map((store) => [store, new Map()]));
  const keyOf = (store) => (store === "settings" ? "key" : "id");
  return {
    mode: "memory",
    async get(store, key) {
      return stores.get(store)?.get(key) ?? null;
    },
    async put(store, value) {
      stores.get(store).set(value[keyOf(store)], value);
      return value;
    },
    async delete(store, key) {
      stores.get(store)?.delete(key);
      return true;
    },
    async getAll(store) {
      return [...(stores.get(store)?.values() || [])];
    },
    async getByIndex(store, indexName, key) {
      return [...(stores.get(store)?.values() || [])].filter((value) => value[indexName] === key);
    },
    async clear(store) {
      stores.get(store)?.clear();
      return true;
    },
    async clearAll() {
      stores.forEach((store) => store.clear());
    },
  };
}

async function backend() {
  if (!backendPromise) {
    backendPromise = openIDB().then(idbBackend).catch(() => memoryBackend());
  }
  return backendPromise;
}

export async function getStorageMode() {
  return (await backend()).mode;
}

export async function getAllBooks() {
  const db = await backend();
  const books = await db.getAll("books");
  return books.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function getBook(id) {
  return (await backend()).get("books", id);
}

export async function saveBookIndex(index) {
  const db = await backend();
  await db.put("books", index.book);
  for (const chunk of index.chunks) await db.put("chunks", chunk);
  return index.book;
}

export async function getBookChunks(bookId) {
  const db = await backend();
  const chunks = await db.getByIndex("chunks", "bookId", bookId);
  return chunks.sort((a, b) => a.order - b.order);
}

export async function getBookIndex(bookId) {
  const book = await getBook(bookId);
  if (!book) return null;
  return { book, chunks: await getBookChunks(bookId), pages: book.pages || [] };
}

export async function loadAllIndexes() {
  const books = await getAllBooks();
  return Promise.all(
    books.map(async (book) => ({
      book,
      chunks: await getBookChunks(book.id),
      pages: book.pages || [],
    })),
  );
}

export async function deleteBook(bookId) {
  const db = await backend();
  const chunks = await db.getByIndex("chunks", "bookId", bookId);
  for (const chunk of chunks) await db.delete("chunks", chunk.id);
  await db.delete("books", bookId);
}

export async function getSetting(key, fallback = null) {
  const entry = await (await backend()).get("settings", key);
  return entry ? entry.value : fallback;
}

export async function setSetting(key, value) {
  await (await backend()).put("settings", { key, value });
  return value;
}

export async function addMessage(message) {
  await (await backend()).put("messages", message);
}

export async function getMessages(limit = 100) {
  const messages = await (await backend()).getAll("messages");
  return messages.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))).slice(-limit);
}

export async function clearMessages() {
  await (await backend()).clear("messages");
}

export async function addResult(result) {
  await (await backend()).put("results", result);
}

export async function getResults(limit = 200) {
  const results = await (await backend()).getAll("results");
  return results.sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, limit);
}

export async function clearResults() {
  await (await backend()).clear("results");
}

export async function clearAllData() {
  await (await backend()).clearAll();
  backendPromise = null;
}

export async function storageSummary() {
  const db = await backend();
  const [books, chunks, results, messages] = await Promise.all([
    db.getAll("books"),
    db.getAll("chunks"),
    db.getAll("results"),
    db.getAll("messages"),
  ]);
  let quota = null;
  try {
    if (globalThis.navigator?.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      quota = { usage: estimate.usage || 0, quota: estimate.quota || 0 };
    }
  } catch {
    quota = null;
  }
  return {
    mode: db.mode,
    books: books.length,
    chunks: chunks.length,
    results: results.length,
    messages: messages.length,
    quota,
  };
}

/** Export metadata and study history. PDF binaries are intentionally excluded. */
export async function exportData() {
  const db = await backend();
  const [books, settings, results, messages] = await Promise.all([
    db.getAll("books"),
    db.getAll("settings"),
    db.getAll("results"),
    db.getAll("messages"),
  ]);
  const safeBooks = books.map(({ fileBlob, stats, pages, ...book }) => ({
    ...book,
    pageCount: pages?.length || book.pageCount,
  }));
  const safeSettings = settings
    .filter((entry) => entry.key !== "customApiKey")
    .map((entry) => {
      if (entry.key !== "settings" || !entry.value?.providers) return entry;
      const providers = Object.fromEntries(
        Object.entries(entry.value.providers).map(([id, config]) => [
          id,
          {
            ...config,
            apiKey: config?.apiKey ? "[stored locally]" : "",
            apiKeys: (config?.apiKeys || []).map(() => "[stored locally]"),
          },
        ]),
      );
      return {
        ...entry,
        value: {
          ...entry.value,
          providers,
          studentKeys: maskStudentKeyVault(entry.value.studentKeys),
          searchToken: "",
        },
      };
    });
  return {
    format: "vignan-vidyanikethan-ai-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    books: safeBooks,
    settings: safeSettings,
    results,
    messages,
  };
}
