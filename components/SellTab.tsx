"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { money } from "@/lib/format";
import { loadProducts } from "@/lib/data";
import { enqueue, useSync } from "@/lib/offline";
import { buildSalePayload, salePayloadToSale, uuid } from "@/lib/pending";
import { PAYMENT_LABELS, type PaymentMethod, type Product, type Sale, type Shop } from "@/lib/types";
import Receipt from "./Receipt";
import BarcodeScanner from "./BarcodeScanner";
import MomoPay from "./MomoPay";
import Icon from "./Icons";
import { NETWORK_FOR, getProvider, type Provider } from "@/lib/momo";

type CartLine = { product: Product; quantity: number };

type NewItemMode = { kind: "quick" } | { kind: "scan"; barcode: string };

const maxQty = (p: Product) => (p.track_stock ? p.stock : Infinity);
const soldOut = (p: Product) => p.track_stock && p.stock <= 0;
const byName = (a: Product, b: Product) => a.name.localeCompare(b.name);

export default function SellTab({ shop }: { shop: Shop }) {
  const sync = useSync();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
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
  const [provider, setProvider] = useState<Provider>("manual");
  const [momoOpen, setMomoOpen] = useState(false);
  const [manualMomo, setManualMomo] = useState(false);
  const cartRef = useRef<HTMLDivElement>(null);
  const [cartInView, setCartInView] = useState(false);

  const productsRef = useRef<Product[]>([]);
  productsRef.current = products;

  async function load(first = false) {
    if (first) {
      // Show the saved list straight away; refresh from the server after.
      const quick = await loadProducts(shop.id, true);
      if (quick.products.length > 0) {
        setProducts(quick.products);
        setLoading(false);
      }
    }
    const { products: fresh, stale: isStale } = await loadProducts(shop.id);
    setProducts(fresh);
    setStale(isStale);
    setLoading(false);
  }

  useEffect(() => {
    load(true);
    getProvider(shop.id, true).then(setProvider);
    getProvider(shop.id).then(setProvider);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // After a background sync finishes, pick up the server's numbers.
  useEffect(() => {
    if (sync.lastSync) load();
  }, [sync.lastSync]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 2500);
    return () => clearTimeout(t);
  }, [notice]);

  // Warm the barcode scanner's code while there's internet, so it also opens offline.
  useEffect(() => {
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 3000));
    idle(() => {
      import("@zxing/browser").catch(() => {});
    });
  }, []);

  useEffect(() => {
    const el = cartRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setCartInView(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, [cart.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q) || (p.barcode ?? "") === q
    );
  }, [products, query]);

  const total = cart.reduce((sum, l) => sum + l.product.price * l.quantity, 0);
  // Automatic mobile payments need internet; offline (or if the cashier prefers) it falls back to typing the reference.
  const network = NETWORK_FOR[method];
  const useMomo = !!network && provider !== "manual" && sync.online && !manualMomo;

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

  /** The sale is saved on this phone first, so it works the same with or without internet. */
  async function checkout(paidRef?: string) {
    setBusy(true);
    setError("");
    try {
      const lines = cart.map((l) => ({ product: l.product, quantity: l.quantity }));
      const payload = buildSalePayload(shop.id, lines, method, paidRef ?? (reference.trim() || null));
      await enqueue({ kind: "sale", shop_id: shop.id, payload });
      setReceipt(salePayloadToSale(payload));
      // Update the screen's stock right away; the server's numbers replace this after syncing.
      setProducts((prev) =>
        prev.map((p) => {
          const line = lines.find((l) => l.product.id === p.id);
          return line && p.track_stock ? { ...p, stock: Math.max(0, p.stock - line.quantity) } : p;
        })
      );
      setCart([]);
      setReference("");
      setMethod("cash");
      setManualMomo(false);
    } catch {
      setError("Couldn't save this sale on the phone. Check that the phone has free storage and try again.");
    }
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
          <svg className="ico-inline" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l1.6-2.4h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.6" /></svg>
          Scan
        </button>
      </div>

      {notice && <div className="notice">{notice}</div>}
      {stale && products.length > 0 && !sync.online && (
        <p className="muted">Offline: showing your product list from the last time you were connected.</p>
      )}

      {loading ? (
        <p className="muted">Loading products…</p>
      ) : (
        <>
          {products.length === 0 && (
            <div className="card empty">
              <div className="art">
                <Icon name="box" />
              </div>
              <h3>Add your first products</h3>
              <p className="muted">Load many at once in the Products tab, or tap “Item not listed” below to sell something right now.</p>
            </div>
          )}
          <div className="grid">
            {filtered.map((p) => (
              <button key={p.id} className="product-tile" disabled={soldOut(p)} onClick={() => add(p)}>
                <div className="pname">{p.name}</div>
                <div className="pprice">{money(p.price)}</div>
                <div
                  className={`muted stock ${!p.track_stock ? "none" : p.stock <= 0 ? "out" : p.stock <= p.low_stock_threshold ? "low" : ""}`}
                >
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
        <div className="card cart" ref={cartRef} style={{ marginTop: 14 }}>
          <h2>Current sale</h2>
          {cart.map((l) => (
            <div className="list-item row" key={l.product.id}>
              <div className="grow">
                <div>{l.product.name}</div>
                <div className="muted">{money(l.product.price)} each</div>
              </div>
              <div className="qty">
                <button aria-label={`Remove one ${l.product.name}`} onClick={() => setQty(l.product.id, l.quantity - 1)}>
                  −
                </button>
                <strong>{l.quantity}</strong>
                <button
                  aria-label={`Add one ${l.product.name}`}
                  disabled={l.quantity >= maxQty(l.product)}
                  onClick={() => setQty(l.product.id, l.quantity + 1)}
                >
                  +
                </button>
              </div>
              <div style={{ minWidth: 84, fontVariantNumeric: "tabular-nums", fontWeight: 600 }} className="right">
                {money(l.product.price * l.quantity)}
              </div>
            </div>
          ))}

          <div className="total-line">
            <span>Total</span>
            <span className="big">{money(total)}</span>
          </div>

          <label id="method-label">Payment</label>
          <div className="methods" role="group" aria-labelledby="method-label">
            {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((m) => (
              <button key={m} type="button" className="method" aria-pressed={method === m} onClick={() => setMethod(m)}>
                <span className={`dot ${m}`} />
                {PAYMENT_LABELS[m]}
              </button>
            ))}
          </div>

          {method !== "cash" && !useMomo && (
            <>
              <label htmlFor="ref">Transaction ID from the SMS (optional)</label>
              <input id="ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. MP2611.1234.A56789" />
            </>
          )}

          {error && <div className="error">{error}</div>}
          <div style={{ height: 8 }} />
          {useMomo ? (
            <>
              <button className="btn full" disabled={busy} onClick={() => setMomoOpen(true)}>
                {`Request ${PAYMENT_LABELS[method]} payment · ${money(total)}`}
              </button>
              <button className="btn ghost full" style={{ marginTop: 8 }} onClick={() => setManualMomo(true)}>
                Customer already paid? Enter reference
              </button>
            </>
          ) : (
            <button className="btn full" disabled={busy} onClick={() => checkout()}>
              {busy ? "Saving…" : `Complete sale · ${money(total)}`}
            </button>
          )}
          <button className="btn ghost full" style={{ marginTop: 8 }} onClick={() => setCart([])}>
            Clear
          </button>
        </div>
      )}

      {cart.length > 0 && !cartInView && (
        <div className="chargebar">
          <button onClick={() => cartRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}>
            <span className="count">
              {cart.reduce((n, l) => n + l.quantity, 0)} item{cart.reduce((n, l) => n + l.quantity, 0) === 1 ? "" : "s"}
            </span>
            <span className="amt">{money(total)}</span>
            <span>Review and charge</span>
          </button>
        </div>
      )}

      {momoOpen && network && (
        <MomoPay
          shopId={shop.id}
          amount={total}
          network={network}
          onClose={() => setMomoOpen(false)}
          onPaid={(ref) => {
            setMomoOpen(false);
            checkout(ref);
          }}
        />
      )}

      {scanning && <BarcodeScanner onDetect={onScan} onClose={() => setScanning(false)} title="Scan items" />}

      {newItem && (
        <NewItemForm
          shop={shop}
          mode={newItem}
          onClose={() => setNewItem(null)}
          onCreated={(p, qty) => {
            setNewItem(null);
            setProducts((prev) => [...prev.filter((x) => x.id !== p.id), p].sort(byName));
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
    const product: Product = {
      id: uuid(),
      shop_id: shop.id,
      name: name.trim(),
      sku: null,
      price: Number(price),
      cost_price: Number(cost || 0),
      stock: fromScan ? Math.max(0, Math.floor(Number(stock) || 0)) : 0,
      low_stock_threshold: 5,
      active: true,
      barcode: fromScan ? mode.barcode : null,
      // Scanned items are new stock the owner is counting. Quick items are sold without tracking.
      track_stock: fromScan,
      quick_added: !fromScan,
    };
    try {
      // Saved on the phone and sent to the server as soon as there's internet.
      await enqueue({ kind: "product", shop_id: shop.id, payload: product });
      onCreated(product, fromScan ? 1 : saleQty);
    } catch {
      setError("Couldn't save on the phone. Check free storage and try again.");
      setBusy(false);
    }
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
        <input id="ni-name" placeholder="e.g. Cooking oil 2L" required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        <div className="row">
          <div className="grow">
            <label htmlFor="ni-price">Selling price (K)</label>
            <input id="ni-price" placeholder="0.00" required type="number" min="0.01" step="0.01" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="grow">
            <label htmlFor="ni-cost">Cost (K, optional)</label>
            <input id="ni-cost" placeholder="0.00" type="number" min="0" step="0.01" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
          </div>
        </div>
        {fromScan ? (
          <>
            <label htmlFor="ni-stock">How many do you have in stock?</label>
            <input id="ni-stock" placeholder="e.g. 12" required type="number" min="1" step="1" inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} />
          </>
        ) : (
          <>
            <label htmlFor="ni-qty">Quantity sold now</label>
            <input id="ni-qty" placeholder="1" required type="number" min="1" step="1" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
          </>
        )}
        {error && <div className="error">{error}</div>}
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
