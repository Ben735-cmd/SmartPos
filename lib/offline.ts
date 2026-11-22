import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";
import { outboxAdd, outboxAll, outboxDelete, outboxPut } from "./idb";
import type { ExpensePayload, OutboxOp, Product, SalePayload } from "./types";

export type SyncState = {
  /** Our best guess that the server is reachable. */
  online: boolean;
  /** Changes saved on this device waiting to reach the server. */
  pending: number;
  /** Changes the server rejected; they need a human to look. */
  failed: number;
  syncing: boolean;
  /** The saved login expired while offline; the user must sign in again to finish syncing. */
  authNeeded: boolean;
  /** Bumps every time something was successfully synced, so screens know to reload. */
  lastSync: number;
};

const SERVER_STATE: SyncState = { online: true, pending: 0, failed: 0, syncing: false, authNeeded: false, lastSync: 0 };
let state: SyncState = SERVER_STATE;
const listeners = new Set<() => void>();

function set(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
export const getState = () => state;
export function useSync(): SyncState {
  return useSyncExternalStore(subscribe, getState, () => SERVER_STATE);
}

export function markNetwork(ok: boolean) {
  const browserOnline = typeof navigator === "undefined" || navigator.onLine !== false;
  const online = browserOnline && ok;
  if (online !== state.online) set({ online });
}

export function isNetworkError(e: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const msg = String((e as { message?: string })?.message ?? e ?? "");
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|timed? ?out|aborted|internet disconnected/i.test(msg);
}

function isAuthError(e: unknown): boolean {
  const err = e as { code?: string; status?: number; message?: string };
  return err?.code === "PGRST301" || err?.status === 401 || /jwt|not authenticated|invalid claim/i.test(err?.message ?? "");
}

/** A message a shopkeeper can understand. */
export function friendlyError(e: unknown): string {
  if (isNetworkError(e)) return "No internet connection. This needs internet, so try again when you're back online.";
  return String((e as { message?: string })?.message ?? e ?? "Something went wrong");
}

async function refreshCounts() {
  const ops = await outboxAll();
  set({
    pending: ops.filter((o) => !o.failed).length,
    failed: ops.filter((o) => o.failed).length,
  });
}

type RunResult = "ok" | "network" | "auth" | { error: string };

async function runOp(op: OutboxOp): Promise<RunResult> {
  try {
    let error: { code?: string; message: string } | null = null;
    if (op.kind === "sale") {
      ({ error } = await supabase.rpc("record_sale_offline", { p_sale: op.payload }));
    } else if (op.kind === "product") {
      ({ error } = await supabase.from("products").upsert(op.payload, { onConflict: "id", ignoreDuplicates: true }));
    } else {
      ({ error } = await supabase.from("expenses").upsert(op.payload, { onConflict: "id", ignoreDuplicates: true }));
    }
    if (!error) return "ok";
    if (op.kind === "sale" && error.code === "23505") return "ok"; // the same sale arrived twice: already saved
    if (isNetworkError(error)) return "network";
    if (isAuthError(error)) return "auth";
    return { error: error.message };
  } catch (e) {
    if (isNetworkError(e)) return "network";
    return { error: String((e as Error)?.message ?? e) };
  }
}

let activeShop: string | null = null;

/** Send queued changes to the server, oldest first. Safe to call any time; only one run happens at once. */
/** One pass over the queue. Returns how many changes reached the server. */
async function syncPass(): Promise<number> {
  let synced = 0;
  const ops = (await outboxAll()).filter((o) => !o.failed && o.shop_id === activeShop);
  for (const op of ops) {
    const res = await runOp(op);
    if (res === "ok") {
      await outboxDelete(op.seq!);
      synced++;
      markNetwork(true);
    } else if (res === "network") {
      markNetwork(false);
      break; // keep order: stop here and retry later
    } else if (res === "auth") {
      set({ authNeeded: true });
      break;
    } else {
      await outboxPut({ ...op, failed: true, error: res.error, attempts: op.attempts + 1 });
    }
  }
  if (synced > 0) set({ authNeeded: false });
  return synced;
}

let current: Promise<void> | null = null;
let rerun = false;

/**
 * Send queued changes to the server, oldest first. Only one run happens at a time. If something new is
 * saved or this is called again mid-run, the run does another pass straight after, so nothing waits for the timer.
 * The returned promise resolves when the whole run (including that extra pass) is done.
 */
export function trySync(): Promise<void> {
  if (!activeShop) return Promise.resolve();
  if (current) {
    rerun = true;
    return current;
  }
  current = (async () => {
    set({ syncing: true });
    let synced = 0;
    try {
      do {
        rerun = false;
        synced += await syncPass();
      } while (rerun);
    } finally {
      current = null;
      await refreshCounts();
      set({ syncing: false, ...(synced > 0 ? { lastSync: Date.now() } : {}) });
    }
  })();
  return current;
}

export type NewOp =
  | { kind: "sale"; shop_id: string; payload: SalePayload }
  | { kind: "product"; shop_id: string; payload: Product }
  | { kind: "expense"; shop_id: string; payload: ExpensePayload };

/** Save a change on the device first, then try to send it. Never blocks on the network. */
export async function enqueue(op: NewOp): Promise<void> {
  await outboxAdd({ ...op, created_at: new Date().toISOString(), attempts: 0 } as OutboxOp);
  await refreshCounts();
  void trySync();
}

export async function retryFailed(): Promise<void> {
  const ops = await outboxAll();
  for (const op of ops) {
    if (op.failed) await outboxPut({ ...op, failed: false, error: undefined });
  }
  await refreshCounts();
  void trySync();
}

export async function discardOp(seq: number): Promise<void> {
  await outboxDelete(seq);
  await refreshCounts();
}

let started = false;
/** Call once the signed-in shop is known. Keeps syncing in the background. */
export function startSync(shopId: string) {
  activeShop = shopId;
  void refreshCounts();
  if (started || typeof window === "undefined") {
    void trySync();
    return;
  }
  started = true;
  set({ online: navigator.onLine !== false });
  window.addEventListener("online", () => {
    markNetwork(true);
    void trySync();
  });
  window.addEventListener("offline", () => set({ online: false }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void trySync();
  });
  setInterval(() => {
    if (state.pending > 0) void trySync();
  }, 20000);
  void trySync();
}

