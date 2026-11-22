import type { OutboxOp } from "./types";

/**
 * Tiny IndexedDB wrapper: a key/value cache for last-known data, and an ordered outbox of changes
 * waiting to reach the server. Falls back to memory if IndexedDB isn't available (e.g. some private modes),
 * in which case offline data lasts only until the page closes.
 */

const DB_NAME = "smartpos";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;
const memKv = new Map<string, unknown>();
let memOutbox: OutboxOp[] = [];
let memSeq = 1;
let useMemory = typeof indexedDB === "undefined";

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
        if (!db.objectStoreNames.contains("outbox")) db.createObjectStore("outbox", { keyPath: "seq", autoIncrement: true });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(store: "kv" | "outbox", mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return wrap(fn(db.transaction(store, mode).objectStore(store)));
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  if (!useMemory) {
    try {
      return (await withStore("kv", "readonly", (s) => s.get(key))) as T | undefined;
    } catch {
      useMemory = true;
    }
  }
  return memKv.get(key) as T | undefined;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  if (!useMemory) {
    try {
      await withStore("kv", "readwrite", (s) => s.put(value, key));
      return;
    } catch {
      useMemory = true;
    }
  }
  memKv.set(key, value);
}

export async function kvDel(key: string): Promise<void> {
  if (!useMemory) {
    try {
      await withStore("kv", "readwrite", (s) => s.delete(key));
      return;
    } catch {
      useMemory = true;
    }
  }
  memKv.delete(key);
}

export async function outboxAll(): Promise<OutboxOp[]> {
  if (!useMemory) {
    try {
      const rows = (await withStore("outbox", "readonly", (s) => s.getAll())) as OutboxOp[];
      return rows.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
    } catch {
      useMemory = true;
    }
  }
  return [...memOutbox].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
}

export async function outboxAdd(op: OutboxOp): Promise<void> {
  if (!useMemory) {
    try {
      const { seq: _drop, ...rest } = op;
      void _drop;
      await withStore("outbox", "readwrite", (s) => s.add(rest));
      return;
    } catch {
      useMemory = true;
    }
  }
  memOutbox.push({ ...op, seq: memSeq++ });
}

export async function outboxPut(op: OutboxOp): Promise<void> {
  if (!useMemory) {
    try {
      await withStore("outbox", "readwrite", (s) => s.put(op));
      return;
    } catch {
      useMemory = true;
    }
  }
  memOutbox = memOutbox.map((o) => (o.seq === op.seq ? op : o));
}

export async function outboxDelete(seq: number): Promise<void> {
  if (!useMemory) {
    try {
      await withStore("outbox", "readwrite", (s) => s.delete(seq));
      return;
    } catch {
      useMemory = true;
    }
  }
  memOutbox = memOutbox.filter((o) => o.seq !== seq);
}
