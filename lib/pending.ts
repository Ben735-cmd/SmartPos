// Pure helpers for data that is saved on the device but not yet confirmed by the server.
// No browser or network access here, so they are easy to test.
import type { Expense, ExpensePayload, OutboxOp, PaymentMethod, Product, Sale, SalePayload } from "./types";

export function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function buildSalePayload(
  shopId: string,
  lines: { product: Product; quantity: number }[],
  method: PaymentMethod,
  reference: string | null,
  now: Date = new Date()
): SalePayload {
  const id = uuid();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return {
    id,
    shop_id: shopId,
    receipt_no: `R-${yy}${mm}${dd}-${id.slice(0, 5).toUpperCase()}`,
    created_at: now.toISOString(),
    payment_method: method,
    payment_reference: method === "cash" ? null : reference,
    items: lines.map((l) => ({
      product_id: l.product.id,
      name: l.product.name,
      quantity: l.quantity,
      unit_price: Number(l.product.price),
      unit_cost: Number(l.product.cost_price),
    })),
  };
}

export function salePayloadToSale(p: SalePayload): Sale {
  return {
    id: p.id,
    receipt_no: p.receipt_no,
    total: round2(p.items.reduce((s, it) => s + it.unit_price * it.quantity, 0)),
    payment_method: p.payment_method,
    payment_reference: p.payment_reference,
    status: "completed",
    created_at: p.created_at,
    pending: true,
    sale_items: p.items.map((it, i) => ({
      id: `${p.id}-${i}`,
      product_name: it.name,
      quantity: it.quantity,
      unit_price: it.unit_price,
      unit_cost: it.unit_cost,
    })),
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const live = (ops: OutboxOp[], shopId: string) => ops.filter((o) => o.shop_id === shopId && !o.failed);

/** Server product list plus whatever is still waiting to sync: new items, and stock already sold. */
export function applyPendingToProducts(products: Product[], ops: OutboxOp[], shopId: string): Product[] {
  const byId = new Map<string, Product>(products.map((p) => [p.id, { ...p }]));
  for (const op of live(ops, shopId)) {
    if (op.kind === "product") {
      if (!byId.has(op.payload.id)) byId.set(op.payload.id, { ...op.payload });
    } else if (op.kind === "sale") {
      for (const it of op.payload.items) {
        const p = it.product_id ? byId.get(it.product_id) : undefined;
        if (p && p.track_stock) p.stock = Math.max(0, p.stock - it.quantity);
      }
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function pendingSales(ops: OutboxOp[], shopId: string): Sale[] {
  return live(ops, shopId)
    .filter((o): o is Extract<OutboxOp, { kind: "sale" }> => o.kind === "sale")
    .map((o) => salePayloadToSale(o.payload))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export function pendingExpenses(ops: OutboxOp[], shopId: string): Expense[] {
  return live(ops, shopId)
    .filter((o): o is Extract<OutboxOp, { kind: "expense" }> => o.kind === "expense")
    .map((o) => {
      const p: ExpensePayload = o.payload;
      return { id: p.id, description: p.description, category: p.category, amount: p.amount, expense_date: p.expense_date };
    });
}

/** Short human description of a queued change, for the "needs attention" list. */
export function describeOp(op: OutboxOp): string {
  if (op.kind === "sale") {
    const total = op.payload.items.reduce((s, it) => s + it.unit_price * it.quantity, 0);
    return `Sale ${op.payload.receipt_no} · K ${total.toFixed(2)}`;
  }
  if (op.kind === "product") return `New product: ${op.payload.name}`;
  return `Expense: ${op.payload.description} · K ${Number(op.payload.amount).toFixed(2)}`;
}
