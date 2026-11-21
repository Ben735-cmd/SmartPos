"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { money } from "@/lib/format";
import type { Product, Shop } from "@/lib/types";
import BulkAdd from "./BulkAdd";
import BarcodeScanner from "./BarcodeScanner";

type Form = {
  id?: string;
  name: string;
  sku: string;
  barcode: string;
  price: string;
  cost_price: string;
  stock: string;
  low_stock_threshold: string;
  track_stock: boolean;
};

const EMPTY: Form = {
  name: "",
  sku: "",
  barcode: "",
  price: "",
  cost_price: "",
  stock: "",
  low_stock_threshold: "5",
  track_stock: true,
};

export default function ProductsTab({ shop }: { shop: Shop }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form | null>(null);
  const [bulk, setBulk] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");

  async function load() {
    const { data } = await supabase.from("products").select("*").eq("active", true).order("name");
    setProducts((data as Product[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const tracked = products.filter((p) => p.track_stock);
  const stockValue = tracked.reduce((s, p) => s + p.stock * Number(p.cost_price), 0);
  const retailValue = tracked.reduce((s, p) => s + p.stock * Number(p.price), 0);
  const q = query.trim().toLowerCase();
  const shown = q
    ? products.filter((p) => p.name.toLowerCase().includes(q) || (p.barcode ?? "").includes(q) || (p.sku ?? "").toLowerCase().includes(q))
    : products;

  function edit(p: Product) {
    setError("");
    setForm({
      id: p.id,
      name: p.name,
      sku: p.sku ?? "",
      barcode: p.barcode ?? "",
      price: String(p.price),
      cost_price: String(p.cost_price),
      stock: String(p.stock),
      low_stock_threshold: String(p.low_stock_threshold),
      track_stock: p.track_stock,
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError("");
    const row = {
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      barcode: form.barcode.trim() || null,
      price: Number(form.price),
      cost_price: Number(form.cost_price || 0),
      stock: Math.floor(Number(form.stock || 0)),
      low_stock_threshold: Math.floor(Number(form.low_stock_threshold || 0)),
      track_stock: form.track_stock,
      quick_added: false,
    };
    const { error: err } = form.id
      ? await supabase.from("products").update(row).eq("id", form.id)
      : await supabase.from("products").insert({ ...row, shop_id: shop.id });
    if (err) {
      setError(err.message.includes("barcode_key") ? "Another product already uses that barcode." : err.message);
    } else {
      setForm(null);
      await load();
    }
    setBusy(false);
  }

  async function remove(p: Product) {
    if (!confirm(`Remove ${p.name}? Past sales will keep their records.`)) return;
    await supabase.from("products").update({ active: false }).eq("id", p.id);
    await load();
  }

  if (bulk) {
    return (
      <BulkAdd
        shop={shop}
        onClose={() => setBulk(false)}
        onDone={async (summary) => {
          setBulk(false);
          setNotice(summary);
          await load();
        }}
      />
    );
  }

  if (form) {
    return (
      <>
        <form className="card" onSubmit={save}>
          <h2>{form.id ? "Edit product" : "Add product"}</h2>
          <label htmlFor="pname">Name</label>
          <input id="pname" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />

          <label htmlFor="pbarcode">Barcode (optional)</label>
          <div className="row">
            <input
              id="pbarcode"
              className="grow"
              inputMode="numeric"
              value={form.barcode}
              onChange={(e) => setForm({ ...form, barcode: e.target.value.replace(/\s+/g, "") })}
            />
            <button type="button" className="btn ghost" onClick={() => setScanning(true)}>
              📷 Scan
            </button>
          </div>

          <div className="row">
            <div className="grow">
              <label htmlFor="pprice">Selling price (K)</label>
              <input id="pprice" required type="number" min="0" step="0.01" inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div className="grow">
              <label htmlFor="pcost">Cost price (K)</label>
              <input id="pcost" type="number" min="0" step="0.01" inputMode="decimal" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} />
            </div>
          </div>

          <label className="row" style={{ margin: "12px 0 4px", color: "var(--text)", fontSize: 15 }}>
            <input
              type="checkbox"
              checked={form.track_stock}
              onChange={(e) => setForm({ ...form, track_stock: e.target.checked })}
              style={{ width: 20, height: 20 }}
            />
            Keep count of stock for this item
          </label>

          {form.track_stock && (
            <div className="row">
              <div className="grow">
                <label htmlFor="pstock">Stock on hand</label>
                <input id="pstock" required type="number" min="0" step="1" inputMode="numeric" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
              </div>
              <div className="grow">
                <label htmlFor="plow">Low-stock alert at</label>
                <input id="plow" type="number" min="0" step="1" inputMode="numeric" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} />
              </div>
            </div>
          )}

          {error && <div className="error">{error}</div>}
          <div style={{ height: 8 }} />
          <div className="row">
            <button type="button" className="btn ghost grow" onClick={() => setForm(null)}>
              Cancel
            </button>
            <button className="btn grow" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
        {scanning && (
          <BarcodeScanner
            title="Scan the product barcode"
            onDetect={(code) => {
              setForm((f) => (f ? { ...f, barcode: code } : f));
              setScanning(false);
            }}
            onClose={() => setScanning(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      {notice && <div className="notice">{notice}</div>}

      <div className="stats">
        <div className="stat">
          <div className="label">Stock value (at cost)</div>
          <div className="value">{money(stockValue)}</div>
        </div>
        <div className="stat">
          <div className="label">Stock value (at selling price)</div>
          <div className="value">{money(retailValue)}</div>
        </div>
      </div>

      <div className="row">
        <button className="btn grow" onClick={() => { setNotice(""); setBulk(true); }}>
          ⚡ Add many
        </button>
        <button className="btn ghost grow" onClick={() => { setNotice(""); setError(""); setForm(EMPTY); }}>
          + Add one
        </button>
      </div>

      {products.length > 8 && (
        <input
          style={{ marginTop: 12 }}
          placeholder="Search products…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}

      <div className="card" style={{ marginTop: 12 }}>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : products.length === 0 ? (
          <p className="muted center">Nothing here yet. Tap “Add many” to load a starter pack, a spreadsheet or a photo of your list.</p>
        ) : (
          shown.map((p) => {
            const out = p.track_stock && p.stock <= 0;
            const low = p.track_stock && !out && p.stock <= p.low_stock_threshold;
            return (
              <div className="list-item" key={p.id}>
                <div className="row between">
                  <div className="grow">
                    <strong>{p.name}</strong>
                    <div className="muted">
                      {money(p.price)} · cost {money(p.cost_price)}
                      {p.barcode ? ` · ${p.barcode}` : ""}
                    </div>
                  </div>
                  {p.track_stock ? (
                    <span className={`badge ${out ? "out" : low ? "low" : "ok"}`}>
                      {out ? "Out" : low ? `Low: ${p.stock}` : `${p.stock} in stock`}
                    </span>
                  ) : (
                    <span className="badge">{p.quick_added ? "Quick-added" : "Not counted"}</span>
                  )}
                </div>
                <div className="row" style={{ marginTop: 6 }}>
                  <button className="btn ghost small" onClick={() => edit(p)}>
                    {p.track_stock ? "Edit / restock" : "Edit / set up stock"}
                  </button>
                  <button className="btn ghost small" onClick={() => remove(p)}>
                    Remove
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
