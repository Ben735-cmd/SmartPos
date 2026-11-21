"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { money } from "@/lib/format";
import { PAYMENT_LABELS, type PaymentMethod, type Product, type Sale, type Shop } from "@/lib/types";
import Receipt from "./Receipt";

type CartLine = { product: Product; quantity: number };

export default function SellTab({ shop }: { shop: Shop }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<Sale | null>(null);

  async function load() {
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("active", true)
      .order("name");
    setProducts((data as Product[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q));
  }, [products, query]);

  const total = cart.reduce((sum, l) => sum + l.product.price * l.quantity, 0);

  function add(p: Product) {
    setError("");
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === p.id);
      if (existing) {
        if (existing.quantity >= p.stock) return prev;
        return prev.map((l) => (l.product.id === p.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { product: p, quantity: 1 }];
    });
  }

  function setQty(id: string, qty: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.product.id === id ? { ...l, quantity: Math.min(qty, l.product.stock) } : l))
        .filter((l) => l.quantity > 0)
    );
  }

  async function checkout() {
    setBusy(true);
    setError("");
    const items = cart.map((l) => ({ product_id: l.product.id, quantity: l.quantity }));
    const { data, error: rpcError } = await supabase.rpc("record_sale", {
      p_shop_id: shop.id,
      p_items: items,
      p_method: method,
      p_reference: method === "cash" ? null : reference.trim() || null,
    });
    if (rpcError) {
      setError(rpcError.message);
      setBusy(false);
      return;
    }
    const { data: sale } = await supabase
      .from("sales")
      .select("*, sale_items(*)")
      .eq("id", data as string)
      .single();
    setReceipt(sale as Sale);
    setCart([]);
    setReference("");
    setMethod("cash");
    await load();
    setBusy(false);
  }

  return (
    <>
      <input
        placeholder="Search products…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginBottom: 12 }}
      />

      {loading ? (
        <p className="muted">Loading products…</p>
      ) : products.length === 0 ? (
        <div className="card center">
          <p>No products yet.</p>
          <p className="muted">Go to the Products tab and add what you sell.</p>
        </div>
      ) : (
        <div className="grid">
          {filtered.map((p) => (
            <button key={p.id} className="product-tile" disabled={p.stock <= 0} onClick={() => add(p)}>
              <div className="pname">{p.name}</div>
              <div className="pprice">{money(p.price)}</div>
              <div className="muted">{p.stock <= 0 ? "Out of stock" : `${p.stock} in stock`}</div>
            </button>
          ))}
        </div>
      )}

      {cart.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <h2>Current sale</h2>
          {cart.map((l) => (
            <div className="list-item row" key={l.product.id}>
              <div className="grow">
                <div>{l.product.name}</div>
                <div className="muted">{money(l.product.price)} each</div>
              </div>
              <button className="btn ghost small" onClick={() => setQty(l.product.id, l.quantity - 1)}>
                −
              </button>
              <strong style={{ minWidth: 24, textAlign: "center" }}>{l.quantity}</strong>
              <button
                className="btn ghost small"
                disabled={l.quantity >= l.product.stock}
                onClick={() => setQty(l.product.id, l.quantity + 1)}
              >
                +
              </button>
              <div style={{ minWidth: 80 }} className="right">
                {money(l.product.price * l.quantity)}
              </div>
            </div>
          ))}

          <div className="row between" style={{ marginTop: 12 }}>
            <span>Total</span>
            <span className="big">{money(total)}</span>
          </div>

          <label htmlFor="method">Payment</label>
          <select id="method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((m) => (
              <option key={m} value={m}>
                {PAYMENT_LABELS[m]}
              </option>
            ))}
          </select>

          {method !== "cash" && (
            <>
              <label htmlFor="ref">Transaction reference (optional)</label>
              <input id="ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. MP2611.1234.A56789" />
            </>
          )}

          {error && <div className="error">{error}</div>}
          <div style={{ height: 8 }} />
          <button className="btn full" disabled={busy} onClick={checkout}>
            {busy ? "Saving…" : `Complete sale · ${money(total)}`}
          </button>
          <button className="btn ghost full" style={{ marginTop: 8 }} onClick={() => setCart([])}>
            Clear
          </button>
        </div>
      )}

      {receipt && <Receipt shop={shop} sale={receipt} onClose={() => setReceipt(null)} />}
    </>
  );
}
