"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { money, formatTime } from "@/lib/format";
import { PAYMENT_LABELS, type Sale, type Shop } from "@/lib/types";
import Receipt from "./Receipt";

export default function SalesTab({ shop }: { shop: Shop }) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<Sale | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const { data } = await supabase
      .from("sales")
      .select("*, sale_items(*)")
      .order("created_at", { ascending: false })
      .limit(100);
    setSales((data as Sale[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function refund(sale: Sale) {
    if (!confirm(`Refund ${sale.receipt_no} for ${money(sale.total)}? Stock will be put back.`)) return;
    setError("");
    const { error: err } = await supabase.rpc("refund_sale", { p_sale_id: sale.id });
    if (err) setError(err.message);
    await load();
  }

  return (
    <>
      <h2>Sales history</h2>
      {error && <div className="error">{error}</div>}
      <div className="card">
        {loading ? (
          <p className="muted">Loading…</p>
        ) : sales.length === 0 ? (
          <p className="muted center">No sales recorded yet.</p>
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
                </div>
              </div>
              <div className="row" style={{ marginTop: 6 }}>
                <button className="btn ghost small" onClick={() => setViewing(s)}>
                  Receipt
                </button>
                {s.status === "completed" && (
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
