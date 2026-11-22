"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { daysAgo, formatTime, localDate, money } from "@/lib/format";
import { PAYMENT_LABELS, type PaymentMethod, type Sale } from "@/lib/types";

const METHODS = Object.keys(PAYMENT_LABELS) as PaymentMethod[];

/** End-of-day check: what SmartPOS says came in vs what's really in the till and the MoMo apps. */
export default function ReconcileCard({ shopId, sales, online }: { shopId: string; sales: Sale[]; online: boolean }) {
  const [day, setDay] = useState(localDate());
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState<PaymentMethod | null>(null);

  const days = useMemo(() => Array.from({ length: 30 }, (_, i) => localDate(daysAgo(i))), []);

  const expected = useMemo(() => {
    const out: Record<string, { total: number; sales: Sale[] }> = {};
    for (const m of METHODS) out[m] = { total: 0, sales: [] };
    for (const s of sales) {
      if (s.status === "refunded") continue;
      if (localDate(new Date(s.created_at)) !== day) continue;
      out[s.payment_method].total += Number(s.total);
      out[s.payment_method].sales.push(s);
    }
    return out;
  }, [sales, day]);

  // Load anything already saved for this day.
  useEffect(() => {
    setMsg("");
    setError("");
    setSaved({});
    setCounted({});
    if (!online) return;
    supabase
      .from("daily_checks")
      .select("method,counted")
      .eq("shop_id", shopId)
      .eq("day", day)
      .then(({ data }) => {
        const s: Record<string, number> = {};
        const c: Record<string, string> = {};
        for (const r of data ?? []) {
          s[r.method] = Number(r.counted);
          c[r.method] = String(r.counted);
        }
        setSaved(s);
        setCounted(c);
      });
  }, [shopId, day, online]);

  async function save() {
    setBusy(true);
    setMsg("");
    setError("");
    const rows = METHODS.filter((m) => counted[m] !== undefined && counted[m] !== "" && Number(counted[m]) >= 0).map((m) => ({
      shop_id: shopId,
      day,
      method: m,
      expected: expected[m].total,
      counted: Number(counted[m]),
      updated_at: new Date().toISOString(),
    }));
    if (rows.length === 0) {
      setError("Enter at least one amount.");
    } else {
      const { error: e } = await supabase.from("daily_checks").upsert(rows);
      if (e) setError("Couldn't save. Check the internet and try again.");
      else {
        setSaved(Object.fromEntries(rows.map((r) => [r.method, r.counted])));
        setMsg("Saved.");
      }
    }
    setBusy(false);
  }

  const isToday = day === localDate();

  return (
    <div className="card">
      <h2>Daily check</h2>
      <p className="muted">
        Compare what SmartPOS recorded with what you really received. Check your cash drawer, and the balance or SMS history in each MoMo app.
      </p>

      <label htmlFor="check-day">Day</label>
      <select id="check-day" value={day} onChange={(e) => setDay(e.target.value)}>
        {days.map((d, i) => (
          <option key={d} value={d}>
            {i === 0 ? "Today" : i === 1 ? "Yesterday" : d}
            {i > 1 ? "" : ` (${d})`}
          </option>
        ))}
      </select>

      {METHODS.map((m) => {
        const e = expected[m];
        const raw = counted[m];
        const has = raw !== undefined && raw !== "";
        const diff = has ? Number(raw) - e.total : 0;
        const missingRef = m === "cash" ? 0 : e.sales.filter((s) => !s.payment_reference).length;
        return (
          <div className="list-item" key={m}>
            <div className="row between">
              <strong>{PAYMENT_LABELS[m]}</strong>
              <span>
                SmartPOS: <strong>{money(e.total)}</strong> <span className="muted">({e.sales.length} sale{e.sales.length === 1 ? "" : "s"})</span>
              </span>
            </div>
            <label htmlFor={`c-${m}`}>{m === "cash" ? "Cash counted" : "Received in the app"}</label>
            <input
              id={`c-${m}`}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={raw ?? ""}
              onChange={(ev) => setCounted((p) => ({ ...p, [m]: ev.target.value }))}
              placeholder={e.total ? e.total.toFixed(2) : "0.00"}
            />
            {has && (
              <div className={Math.abs(diff) < 0.005 ? "notice" : "error"}>
                {Math.abs(diff) < 0.005
                  ? "✓ Matches"
                  : diff < 0
                    ? `Short by ${money(-diff)}. Money recorded but not received.`
                    : `Over by ${money(diff)}. More received than recorded.`}
              </div>
            )}
            {missingRef > 0 && (
              <div className="muted">
                {missingRef} sale{missingRef === 1 ? "" : "s"} with no reference, so harder to check.
              </div>
            )}
            {e.sales.length > 0 && (
              <button className="btn ghost small" style={{ marginTop: 6 }} onClick={() => setOpen(open === m ? null : m)}>
                {open === m ? "Hide sales" : "Show sales"}
              </button>
            )}
            {open === m &&
              e.sales.map((s) => (
                <div className="row between muted" key={s.id} style={{ marginTop: 4 }}>
                  <span>
                    {formatTime(s.created_at)} · {s.payment_reference ?? "no reference"}
                  </span>
                  <span>{money(s.total)}</span>
                </div>
              ))}
          </div>
        );
      })}

      {!isToday && <p className="muted">Sales still waiting to sync from a phone may not be included yet.</p>}
      {error && <div className="error">{error}</div>}
      {msg && <div className="notice">{msg}</div>}
      <div style={{ height: 8 }} />
      <button className="btn full" disabled={busy || !online} onClick={save}>
        {busy ? "Saving…" : online ? "Save this check" : "Saving needs internet"}
      </button>
      {Object.keys(saved).length > 0 && <p className="muted center">A check is saved for this day. Saving again replaces it.</p>}
    </div>
  );
}
