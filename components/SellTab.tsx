"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { money } from "@/lib/format";
import { PAYMENT_LABELS, type PaymentMethod, type Product, type Sale, type Shop } from "@/lib/types";
import Receipt from "./Receipt";
import BarcodeScanner from "./BarcodeScanner";

type CartLine = { product: Product; quantity: number };

type NewItemMode = { kind: "quick" } | { kind: "scan"; barcode: string };

const maxQty = (p: Product) => (p.track_stock ? p.stock : Infinity);
const soldOut = (p: Product) => p.track_stock && p.stock <= 0;

export default function SellTab({ shop }: { shop: Shop }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [scanning, setScanning] = useState(false);
  const [newItem, setNewItem] = useState<NewItemMode | null>(null);

  const productsRef = useRef<Product[]>([]);
  productsRef.current = products;

  async function load() {
    const { data } = await supabase.from("products").select("*").eq("active", true).order("name");
    setProducts((data as Product[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 2500);
    return () => clearTimeout(t);
  }, [notice]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q) || (p.barcode ?? "") === q
    );
  }, [products, query]);

  const total = cart.reduce((sum, l) => sum + l.product.price * l.quantity, 0);

  function add(p: Product, qty = 1) {
    setError("");
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === p.id);
      if (existing) {
        const next = Math.min(existing.quantity + qty, maxQty(p));
        return prev.map((l) => (l.product.id === p.id ? { ...l, quantity: next } : l));
      }
      return [...prev, { product: p, quantity: Math.min(qty, maxQty(p)) }];
    });
  }

  function setQty(id: string, qty: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.product.id === id ? { ...l, quantity: Math.min(qty, maxQty(l.product)) } : l))
        .filter((l) => l.quantity > 0)
    );
  }

  /** Handles a scanned or typed barcode. Returns true if it matched a product. */
  function handleCode(code: string): boolean {
    const p = productsRef.current.find((x) => x.barcode === code);
    if (!p) return false;
    if (soldOut(p)) {
      setNotice(`${p.name} is out of stock`);
      return true;
    }
    add(p);
    setNotice(`Added ${p.name}`);
    return true;
  }

  function onScan(code: string) {
    if (!handleCode(code)) {
      setScanning(false);
      setNewItem({ kind: "scan", barcode: code });
    }
  }

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const q = query.trim();
    if (!q) return;
    // USB / Bluetooth barcode scanners type the code and press Enter.
    if (handleCode(q)) {
      setQuery("");
    } else if (/^\d{6,}$/.test(q)) {
      setNewItem({ kind: "scan", barcode: q });
      setQuery("");
    } else if (filtered.length === 1 && !soldOut(filtered[0])) {
      add(filtered[0]);
      setQuery("");
    }
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
      <div className="row" style={{ marginBottom: 12 }}>
        <input
          className="grow"
          placeholder="Search or scan…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onSearchKey}
          enterKeyHint="search"
        />
        <button className="btn" onClick={() => setScanning(true)} aria-label="Scan barcode">
          📷 Scan
        </button>
      </div>

      {notice && <div className="notice">{notice}</div>}

      {loading ? (
        <p className="muted">Loading products…</p>
      ) : (
        <>
          {products.length === 0 && (
            <div className="card center">
              <p>No products yet.</p>
              <p className="muted">Add many at once in the Products tab, or tap “Item not listed” to sell something right now.</p>
            </div>
          )}
          <div className="grid">
            {filtered.map((p) => (
              <button key={p.id} className="product-tile" disabled={soldOut(p)} onClick={() => add(p)}>
                <div className="pname">{p.name}</div>
                <div className="pprice">{money(p.price)}</div>
                <div className="muted">
                  {!p.track_stock ? "Stock not tracked" : p.stock <= 0 ? "Out of stock" : `${p.stock} in stock`}
                </div>
              </button>
            ))}
          </div>
          <button className="btn ghost full" style={{ marginTop: 12 }} onClick={() => setNewItem({ kind: "quick" })}>
            + Item not listed
          </button>
        </>
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
                disabled={l.quantity >= maxQty(l.product)}
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

      {scanning && <BarcodeScanner onDetect={onScan} onClose={() => setScanning(false)} title="Scan items" />}

      {newItem && (
        <NewItemForm
          shop={shop}
          mode={newItem}
          onClose={() => setNewItem(null)}
          onCreated={async (p, qty) => {
            setNewItem(null);
            await load();
            add(p, qty);
            setNotice(`Added ${p.name}`);
          }}
        />
      )}

      {receipt && <Receipt shop={shop} sale={receipt} onClose={() => setReceipt(null)} />}
    </>
  );
}

function NewItemForm({
  shop,
  mode,
  onClose,
  onCreated,
}: {
  shop: Shop;
  mode: NewItemMode;
  onClose: () => void;
  onCreated: (p: Product, qty: number) => void;
}) {
  const fromScan = mode.kind === "scan";
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [qty, setQty] = useState("1");
  const [stock, setStock] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const saleQty = Math.max(1, Math.floor(Number(qty) || 1));
    const row = {
      shop_id: shop.id,
      name: name.trim(),
      price: Number(price),
      cost_price: Number(cost || 0),
      barcode: fromScan ? mode.barcode : null,
      // Scanned items are new stock the owner is counting. Quick items are sold without tracking.
      track_stock: fromScan,
      quick_added: !fromScan,
      stock: fromScan ? Math.max(0, Math.floor(Number(stock) || 0)) : 0,
    };
    const { data, error: err } = await supabase.from("products").insert(row).select("*").single();
    if (err) {
      setError(err.message);
      setBusy(false);
      return;
    }
    onCreated(data as Product, fromScan ? 1 : saleQty);
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="receipt" style={{ fontFamily: "inherit" }} onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h2>{fromScan ? "New item" : "Item not listed"}</h2>
        {fromScan ? (
          <p className="muted">
            Barcode <strong>{mode.barcode}</strong> isn't in your shop yet. Add it once and it scans instantly from now on.
          </p>
        ) : (
          <p className="muted">Sell it now. You can set up its stock later in Products.</p>
        )}
        <label htmlFor="ni-name">Name</label>
        <input id="ni-name" required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        <div className="row">
          <div className="grow">
            <label htmlFor="ni-price">Selling price (K)</label>
            <input id="ni-price" required type="number" min="0.01" step="0.01" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="grow">
            <label htmlFor="ni-cost">Cost (K, optional)</label>
            <input id="ni-cost" type="number" min="0" step="0.01" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
          </div>
        </div>
        {fromScan ? (
          <>
            <label htmlFor="ni-stock">How many do you have in stock?</label>
            <input id="ni-stock" required type="number" min="1" step="1" inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} />
          </>
        ) : (
          <>
            <label htmlFor="ni-qty">Quantity sold now</label>
            <input id="ni-qty" required type="number" min="1" step="1" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
          </>
        )}
        {error && <div className="error">{error.includes("barcode_key") ? "That barcode already exists." : error}</div>}
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" className="btn ghost grow" onClick={onClose}>
            Cancel
          </button>
          <button className="btn grow" disabled={busy}>
            {busy ? "Saving…" : "Add to sale"}
          </button>
        </div>
      </form>
    </div>
  );
}
