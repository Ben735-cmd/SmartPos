"use client";

import Icon from "./Icons";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { money, formatTime } from "@/lib/format";
import { loadSales } from "@/lib/data";
import { friendlyError, useSync } from "@/lib/offline";
import { PAYMENT_LABELS, type Sale, type Shop } from "@/lib/types";
import Receipt from "./Receipt";

export default function SalesTab({ shop }: { shop: Shop }) {
  const sync = useSync();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const [viewing, setViewing] = useState<Sale | null>(null);
  const [error, setError] = useState("");

  async function load(first = false) {
    if (first) {
      const quick = await loadSales(shop.id, true);
      if (quick.sales.length > 0) {
        setSales(quick.sales);
        setLoading(false);
      }
    }
    const { sales: fresh, stale: isStale } = await loadSales(shop.id);
    setSales(fresh);
    setStale(isStale);
    setLoading(false);
  }

  useEffect(() => {
    load(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (sync.lastSync) load();
  }, [sync.lastSync]); // eslint-disable-line react-hooks/exhaustive-deps

  async function refund(sale: Sale) {
    if (!confirm(`Refund ${sale.receipt_no} for ${money(sale.total)}? Stock will be put back.`)) return;
    setError("");
    const { error: err } = await supabase.rpc("refund_sale", { p_sale_id: sale.id });
    if (err) setError(friendlyError(err));
    await load();
  }

  return (
    <>
      <h2>Sales history</h2>
      {error && <div className="error">{error}</div>}
      {stale && !sync.online && (
        <p className="muted">Offline: showing saved sales. Refunds need internet.</p>
      )}
      <div className="card">
        {loading ? (
          <p className="muted">Loading…</p>
        ) : sales.length === 0 ? (
          <div className="empty">
            <div className="art">
              <Icon name="receipt" />
            </div>
            <h3>No sales yet</h3>
            <p className="muted">Sales you make on the Sell tab show up here with their receipts.</p>
          </div>
        ) : (
          sales.map((s) => (
            <div className="list-item" key={s.id}>
              <div className="row between">
                <div>
                  <strong>{s.receipt_no}</strong>
                  <div className="muted">
                    {formatTime(s.created_at)} · {PAYMENT_LABELS[s.payment_method]}
                  </div>
                </div>
                <div className="right">
                  <strong style={s.status === "refunded" ? { textDecoration: "line-through" } : undefined}>
                    {money(s.total)}
                  </strong>
                  {s.status === "refunded" && <div className="badge out">Refunded</div>}
                  {s.pending && <div className="badge low">Saved on phone</div>}
                </div>
              </div>
              <div className="row" style={{ marginTop: 6 }}>
                <button className="btn ghost small" onClick={() => setViewing(s)}>
                  Receipt
                </button>
                {s.status === "completed" && !s.pending && (
                  <button className="btn ghost small" onClick={() => refund(s)}>
                    Refund
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      {viewing && <Receipt shop={shop} sale={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}
