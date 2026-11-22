"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { TEMPLATE_CSV, parseTable, tableToRows, cleanNumber, type ImportRow } from "@/lib/csv";
import { STARTER_PACKS } from "@/lib/starterPacks";
import type { Shop } from "@/lib/types";
import ImportReview from "./ImportReview";

type Mode = "menu" | "paste" | "starter" | "photo" | "review";

/** Shrink a phone photo so it uploads fast on a weak connection. */
async function shrinkImage(file: File, maxSide = 1600): Promise<{ base64: string; mediaType: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
  return { base64: dataUrl.split(",")[1], mediaType: "image/jpeg" };
}

export default function BulkAdd({
  shop,
  onClose,
  onDone,
}: {
  shop: Shop;
  onClose: () => void;
  onDone: (summary: string) => void;
}) {
  const [mode, setMode] = useState<Mode>("menu");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [hint, setHint] = useState<string | undefined>();
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  function review(r: ImportRow[], h?: string) {
    setRows(r);
    setHint(h);
    setMode("review");
  }

  function fromText(t: string) {
    setError("");
    const parsed = tableToRows(parseTable(t));
    if (parsed.length === 0) {
      setError("I couldn't find any products in that. Each line needs at least a name and a price.");
      return;
    }
    review(parsed);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (/\.xlsx?$/i.test(f.name)) {
      setError("Excel files can't be read directly. In Excel choose Save As → CSV, or just copy the cells and paste them here.");
      return;
    }
    fromText(await f.text());
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "smartpos-products-template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy(true);
    setError("");
    try {
      const { base64, mediaType } = await shrinkImage(f);
      const { data, error: fnError } = await supabase.functions.invoke("extract-products", {
        body: { image_base64: base64, media_type: mediaType },
      });
      if (fnError) {
        // Try to surface the function's own message.
        let msg = fnError.message;
        const ctx = (fnError as { context?: Response }).context;
        if (ctx && typeof ctx.json === "function") {
          try {
            const j = await ctx.json();
            if (j?.error) msg = j.error;
          } catch {
            /* keep default */
          }
        }
        setError(msg);
      } else {
        const items = ((data as { items?: Record<string, unknown>[] })?.items ?? []).map((it) => ({
          name: String(it.name ?? "").trim(),
          price: cleanNumber(String(it.price ?? "")),
          cost: cleanNumber(String(it.cost ?? "")),
          stock: cleanNumber(String(it.stock ?? "")),
          barcode: String(it.barcode ?? "").replace(/\s+/g, ""),
        }));
        if (items.length === 0) setError("I couldn't read any products from that photo. Try a closer, brighter, straighter picture.");
        else review(items, "Read from your photo. AI can misread handwriting, so check every name and price before importing.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong reading the photo.");
    }
    setBusy(false);
  }

  if (mode === "review") {
    return <ImportReview shop={shop} initial={rows} hint={hint} onCancel={() => setMode("menu")} onDone={onDone} />;
  }

  if (mode === "starter") {
    return (
      <>
        <div className="row between" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Starter packs</h2>
          <button className="btn ghost small" onClick={() => setMode("menu")}>
            Back
          </button>
        </div>
        <p className="muted">
          Pick your type of business. You get a list of common items and just fill in your prices and stock.
        </p>
        {STARTER_PACKS.map((p) => (
          <button
            key={p.id}
            className="product-tile"
            style={{ width: "100%", marginBottom: 8 }}
            onClick={() =>
              review(
                p.items.map((name) => ({ name, price: "", cost: "", stock: "", barcode: "" })),
                "Type a selling price for the items you actually sell. Items without a price are skipped. Remove any row you don't need with ✕."
              )
            }
          >
            <div className="pname">
              {p.emoji} {p.label}
            </div>
            <div className="muted">{p.items.length} common items</div>
          </button>
        ))}
      </>
    );
  }

  if (mode === "paste") {
    return (
      <>
        <div className="row between" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>From a spreadsheet</h2>
          <button className="btn ghost small" onClick={() => setMode("menu")}>
            Back
          </button>
        </div>
        <div className="card">
          <p>
            Copy your rows from Excel or Google Sheets and paste them below. Columns, in order:{" "}
            <strong>name, price, cost, stock, barcode</strong> (only name and price are required).
          </p>
          <textarea
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"Mealie meal 25kg\t285\t250\t10\nCooking oil 2L\t95\t80\t12"}
            style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 14 }}
          />
          {error && <div className="error">{error}</div>}
          <div style={{ height: 8 }} />
          <button className="btn full" disabled={!text.trim()} onClick={() => fromText(text)}>
            Continue
          </button>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn ghost grow" onClick={() => fileRef.current?.click()}>
              Upload CSV file
            </button>
            <button className="btn ghost grow" onClick={downloadTemplate}>
              Download template
            </button>
          </div>
          <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" hidden onChange={onFile} />
        </div>
      </>
    );
  }

  if (mode === "photo") {
    return (
      <>
        <div className="row between" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>From a photo</h2>
          <button className="btn ghost small" onClick={() => setMode("menu")} disabled={busy}>
            Back
          </button>
        </div>
        <div className="card">
          <p>
            Take a clear photo of your stock book, a supplier price list or a handwritten list. AI reads it and
            builds the product list for you to check.
          </p>
          <ul className="muted" style={{ paddingLeft: 18, marginTop: 0 }}>
            <li>Good light, camera straight above the page</li>
            <li>One page at a time</li>
            <li>Names and prices should be visible</li>
          </ul>
          {error && <div className="error">{error}</div>}
          <button className="btn full" disabled={busy} onClick={() => photoRef.current?.click()}>
            {busy ? "Reading your photo… (can take up to 30 seconds)" : "Take or choose a photo"}
          </button>
          <input ref={photoRef} type="file" accept="image/*" capture="environment" hidden onChange={onPhoto} />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="row between" style={{ marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Add many products</h2>
        <button className="btn ghost small" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="muted">Pick the way that suits your shop. You can check everything before it's saved.</p>
      {[
        { m: "starter" as Mode, t: "📋 Starter pack", d: "Common items for your type of shop. Just add prices." },
        { m: "paste" as Mode, t: "📄 Spreadsheet or CSV", d: "Paste rows from Excel or Google Sheets, or upload a CSV." },
        { m: "photo" as Mode, t: "Photo of your list", d: "Photograph a stock book or price list. AI reads it." },
      ].map((o) => (
        <button
          key={o.m}
          className="product-tile"
          style={{ width: "100%", marginBottom: 8 }}
          onClick={() => {
            setError("");
            setMode(o.m);
          }}
        >
          <div className="pname">{o.t}</div>
          <div className="muted">{o.d}</div>
        </button>
      ))}
      <p className="muted">
        Tip: you can also scan barcodes at the till, and add items on the spot while selling.
      </p>
    </>
  );
}
