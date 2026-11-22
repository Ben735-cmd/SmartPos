"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ImportRow } from "@/lib/csv";
import { friendlyError } from "@/lib/offline";
import type { Shop } from "@/lib/types";

type Existing = { id: string; name: string; barcode: string | null };

export default function ImportReview({
  shop,
  initial,
  hint,
  onCancel,
  onDone,
}: {
  shop: Shop;
  initial: ImportRow[];
  hint?: string;
  onCancel: () => void;
  onDone: (summary: string) => void;
}) {
  const [rows, setRows] = useState<ImportRow[]>(initial);
  const [existing, setExisting] = useState<Existing[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase
      .from("products")
      .select("id,name,barcode")
      .eq("active", true)
      .then(({ data }) => setExisting((data as Existing[]) ?? []));
  }, []);

  function matchOf(r: ImportRow): Existing | undefined {
    const bc = r.barcode.trim();
    const nm = r.name.trim().toLowerCase();
    return (
      (bc ? existing.find((e) => e.barcode === bc) : undefined) ?? existing.find((e) => e.name.trim().toLowerCase() === nm)
    );
  }

  const prepared = useMemo(
    () =>
      rows.map((r) => {
        const price = Number(r.price);
        const valid = r.name.trim() !== "" && Number.isFinite(price) && price > 0;
        return { r, valid, match: matchOf(r) };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, existing]
  );

  const ready = prepared.filter((p) => p.valid);
  const updates = ready.filter((p) => p.match).length;
  const creates = ready.length - updates;
  const skipped = rows.length - ready.length;

  function set(i: number, patch: Partial<ImportRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function run() {
    setBusy(true);
    setError("");
    const num = (s: string) => (s.trim() === "" ? 0 : Number(s));
    const seen = new Set<string>();
    const toInsert: Record<string, unknown>[] = [];
    const toUpdate: { id: string; patch: Record<string, unknown> }[] = [];

    for (const { r, match } of ready) {
      const key = (r.barcode.trim() || r.name.trim().toLowerCase()).toLowerCase();
      if (seen.has(key)) continue; // same item listed twice in the sheet
      seen.add(key);

      const stock = Math.max(0, Math.floor(num(r.stock)));
      const base = {
        name: r.name.trim(),
        price: Number(r.price),
        cost_price: Math.max(0, num(r.cost)),
        barcode: r.barcode.trim() || null,
      };
      if (match) {
        const patch: Record<string, unknown> = { ...base };
        if (r.stock.trim() !== "") patch.stock = stock;
        if (!base.barcode) delete patch.barcode;
        if (r.cost.trim() === "") delete patch.cost_price;
        toUpdate.push({ id: match.id, patch });
      } else {
        toInsert.push({ ...base, shop_id: shop.id, stock });
      }
    }

    for (let i = 0; i < toInsert.length; i += 200) {
      const { error: err } = await supabase.from("products").insert(toInsert.slice(i, i + 200));
      if (err) {
        setError(err.message.includes("barcode_key") ? "Two products have the same barcode. Fix it and try again." : friendlyError(err));
        setBusy(false);
        return;
      }
    }
    for (let i = 0; i < toUpdate.length; i += 10) {
      const results = await Promise.all(
        toUpdate.slice(i, i + 10).map((u) => supabase.from("products").update(u.patch).eq("id", u.id))
      );
      const failed = results.find((x) => x.error);
      if (failed?.error) {
        setError(friendlyError(failed.error));
        setBusy(false);
        return;
      }
    }
    setBusy(false);
    onDone(
      `${toInsert.length} product${toInsert.length === 1 ? "" : "s"} added` +
        (toUpdate.length ? `, ${toUpdate.length} updated` : "")
    );
  }

  return (
    <>
      <div className="row between" style={{ marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Check before importing</h2>
        <button className="btn ghost small" onClick={onCancel}>
          Back
        </button>
      </div>
      <p className="muted">
        {hint ?? "Fix anything that looks wrong. Rows without a selling price are skipped."}
      </p>

      <div className="card" style={{ padding: 0 }}>
        {rows.length === 0 && <p className="muted center" style={{ padding: 12 }}>Nothing to import.</p>}
        {prepared.map(({ r, valid, match }, i) => (
          <div className="list-item" key={i} style={{ padding: "10px 12px", opacity: valid ? 1 : 0.7 }}>
            <div className="row">
              <input
                aria-label="Product name"
                placeholder="Product name"
                value={r.name}
                onChange={(e) => set(i, { name: e.target.value })}
                style={{ fontWeight: 600 }}
              />
              <button
                className="btn ghost small"
                aria-label="Remove row"
                onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
              >
                ✕
              </button>
            </div>
            <div className="row" style={{ marginTop: 6 }}>
              <div className="grow">
                <label>Price (K)</label>
                <input type="number" placeholder="0.00" min="0" step="0.01" inputMode="decimal" value={r.price} onChange={(e) => set(i, { price: e.target.value })} />
              </div>
              <div className="grow">
                <label>Cost (K)</label>
                <input type="number" placeholder="0.00" min="0" step="0.01" inputMode="decimal" value={r.cost} onChange={(e) => set(i, { cost: e.target.value })} />
              </div>
              <div className="grow">
                <label>Stock</label>
                <input type="number" placeholder="0" min="0" step="1" inputMode="numeric" value={r.stock} onChange={(e) => set(i, { stock: e.target.value })} />
              </div>
            </div>
            <div className="row" style={{ marginTop: 6 }}>
              {match && valid && <span className="badge low">Already exists: will update</span>}
              {!valid && <span className="badge out">Skipped: add a price</span>}
              {r.barcode && <span className="muted">Barcode {r.barcode}</span>}
            </div>
          </div>
        ))}
      </div>

      {error && <div className="error">{error}</div>}
      <div style={{ position: "sticky", bottom: 64, background: "var(--bg)", paddingTop: 8 }}>
        <button className="btn full" disabled={busy || ready.length === 0} onClick={run}>
          {busy
            ? "Importing…"
            : `Import ${ready.length} product${ready.length === 1 ? "" : "s"}` +
              (updates ? ` (${creates} new, ${updates} updates)` : "")}
        </button>
        {skipped > 0 && <p className="muted center" style={{ marginTop: 6 }}>{skipped} row(s) skipped (no price)</p>}
      </div>
    </>
  );
}
