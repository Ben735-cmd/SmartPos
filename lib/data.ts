import { supabase } from "./supabase";
import { kvGet, kvSet, outboxAll } from "./idb";
import { isNetworkError, markNetwork } from "./offline";
import { applyPendingToProducts, pendingExpenses, pendingSales } from "./pending";
import { daysAgo, localDate } from "./format";
import type { Expense, Product, Sale } from "./types";

const FETCH_TIMEOUT_MS = 8000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Request timed out")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

/**
 * Try the server; on failure (or a slow connection) fall back to the last copy saved on this device.
 * With cacheOnly it never touches the network, so screens can show saved data instantly and refresh after.
 */
async function cached<T>(key: string, fetcher: () => Promise<T>, cacheOnly = false): Promise<{ data: T | null; stale: boolean }> {
  if (!cacheOnly) {
    try {
      const data = await withTimeout(fetcher(), FETCH_TIMEOUT_MS);
      markNetwork(true);
      await kvSet(key, data);
      return { data, stale: false };
    } catch (e) {
      if (isNetworkError(e)) markNetwork(false);
    }
  }
  const old = await kvGet<T>(key);
  return { data: old ?? null, stale: true };
}

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw res.error;
  return (res.data ?? []) as T;
}

export async function loadProducts(shopId: string, cacheOnly = false): Promise<{ products: Product[]; stale: boolean }> {
  const { data, stale } = await cached<Product[]>(
    `${shopId}:products`,
    async () => must(await supabase.from("products").select("*").eq("active", true).order("name")),
    cacheOnly
  );
  const ops = await outboxAll();
  return { products: applyPendingToProducts(data ?? [], ops, shopId), stale };
}

export async function loadSales(shopId: string, cacheOnly = false): Promise<{ sales: Sale[]; stale: boolean }> {
  const { data, stale } = await cached<Sale[]>(
    `${shopId}:sales`,
    async () => must(await supabase.from("sales").select("*, sale_items(*)").order("created_at", { ascending: false }).limit(100)),
    cacheOnly
  );
  const ops = await outboxAll();
  const server = data ?? [];
  const seen = new Set(server.map((s) => s.id)); // a sale that just synced must not show twice
  return { sales: [...pendingSales(ops, shopId).filter((s) => !seen.has(s.id)), ...server], stale };
}

export async function loadReportData(
  shopId: string,
  cacheOnly = false
): Promise<{ sales: Sale[]; expenses: Expense[]; products: Product[]; stale: boolean; hasData: boolean }> {
  const since = daysAgo(29);
  const { data, stale } = await cached<{ sales: Sale[]; expenses: Expense[]; products: Product[] }>(
    `${shopId}:reports`,
    async () => {
      const [s, e, p] = await Promise.all([
        supabase.from("sales").select("*, sale_items(*)").gte("created_at", since.toISOString()).order("created_at", { ascending: false }),
        supabase
          .from("expenses")
          .select("*")
          .gte("expense_date", localDate(since))
          .order("expense_date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase.from("products").select("*").eq("active", true),
      ]);
      return { sales: must<Sale[]>(s), expenses: must<Expense[]>(e), products: must<Product[]>(p) };
    },
    cacheOnly
  );
  const ops = await outboxAll();
  const base = data ?? { sales: [], expenses: [], products: [] };
  const saleIds = new Set(base.sales.map((s) => s.id));
  const expenseIds = new Set(base.expenses.map((x) => x.id));
  return {
    sales: [...pendingSales(ops, shopId).filter((s) => !saleIds.has(s.id)), ...base.sales],
    expenses: [...pendingExpenses(ops, shopId).filter((x) => !expenseIds.has(x.id)), ...base.expenses],
    products: applyPendingToProducts(base.products, ops, shopId),
    stale,
    hasData: data !== null,
  };
}

/** Remember the shop so the app can open offline. */
export async function cacheShop<T>(shop: T) {
  await kvSet("shop", shop);
}
export async function cachedShop<T>(): Promise<T | undefined> {
  return kvGet<T>("shop");
}
