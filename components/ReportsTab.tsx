"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { daysAgo, localDate, money } from "@/lib/format";
import { PAYMENT_LABELS, type Expense, type PaymentMethod, type Product, type Sale, type Shop } from "@/lib/types";

type Day = { date: string; revenue: number; cost: number; expenses: number };

export default function ReportsTab({ shop }: { shop: Shop }) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("general");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const since = daysAgo(29);
    const [s, e, p] = await Promise.all([
      supabase
        .from("sales")
        .select("*, sale_items(*)")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false }),
      supabase
        .from("expenses")
        .select("*")
        .gte("expense_date", localDate(since))
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from("products").select("*").eq("active", true),
    ]);
    setSales((s.data as Sale[]) ?? []);
    setExpenses((e.data as Expense[]) ?? []);
    setProducts((p.data as Product[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const report = useMemo(() => {
    const days = new Map<string, Day>();
    for (let i = 0; i < 30; i++) {
      const d = localDate(daysAgo(i));
      days.set(d, { date: d, revenue: 0, cost: 0, expenses: 0 });
    }
    const byMethod: Record<string, number> = {};
    const productTotals = new Map<string, number>();

    for (const s of sales) {
      if (s.status === "refunded") continue;
      const day = days.get(localDate(new Date(s.created_at)));
      if (day) {
        day.revenue += Number(s.total);
        for (const it of s.sale_items ?? []) day.cost += it.quantity * Number(it.unit_cost);
      }
      byMethod[s.payment_method] = (byMethod[s.payment_method] ?? 0) + Number(s.total);
      for (const it of s.sale_items ?? []) {
        productTotals.set(it.product_name, (productTotals.get(it.product_name) ?? 0) + it.quantity);
      }
    }
    for (const x of expenses) {
      const day = days.get(x.expense_date);
      if (day) day.expenses += Number(x.amount);
    }

    const list = Array.from(days.values()).sort((a, b) => (a.date < b.date ? 1 : -1));
    const sum = (rows: Day[]) =>
      rows.reduce(
        (a, d) => ({
          revenue: a.revenue + d.revenue,
          cost: a.cost + d.cost,
          expenses: a.expenses + d.expenses,
        }),
        { revenue: 0, cost: 0, expenses: 0 }
      );

    return {
      today: list[0],
      week: sum(list.slice(0, 7)),
      month: sum(list),
      list: list.slice(0, 7),
      byMethod,
      top: Array.from(productTotals.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
    };
  }, [sales, expenses]);

  const lowStock = products.filter((p) => p.stock <= p.low_stock_threshold).sort((a, b) => a.stock - b.stock);

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error: err } = await supabase
      .from("expenses")
      .insert({ shop_id: shop.id, description: desc.trim(), amount: Number(amount), category });
    if (err) setError(err.message);
    else {
      setDesc("");
      setAmount("");
      await load();
    }
    setBusy(false);
  }

  async function removeExpense(id: string) {
    if (!confirm("Delete this expense?")) return;
    await supabase.from("expenses").delete().eq("id", id);
    await load();
  }

  if (loading) return <p className="muted">Loading reports…</p>;

  const todayProfit = report.today.revenue - report.today.cost - report.today.expenses;
  const weekProfit = report.week.revenue - report.week.cost - report.week.expenses;
  const monthProfit = report.month.revenue - report.month.cost - report.month.expenses;

  return (
    <>
      <h2>Today</h2>
      <div className="stats">
        <div className="stat">
          <div className="label">Revenue</div>
          <div className="value">{money(report.today.revenue)}</div>
        </div>
        <div className="stat">
          <div className="label">Profit (after expenses)</div>
          <div className="value" style={{ color: todayProfit < 0 ? "var(--danger)" : undefined }}>
            {money(todayProfit)}
          </div>
        </div>
        <div className="stat">
          <div className="label">This week</div>
          <div className="value">{money(report.week.revenue)}</div>
          <div className="muted">Profit {money(weekProfit)}</div>
        </div>
        <div className="stat">
          <div className="label">Last 30 days</div>
          <div className="value">{money(report.month.revenue)}</div>
          <div className="muted">Profit {money(monthProfit)}</div>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="card">
          <h3>⚠️ Low stock</h3>
          {lowStock.map((p) => (
            <div className="row between list-item" key={p.id}>
              <span>{p.name}</span>
              <span className={`badge ${p.stock <= 0 ? "out" : "low"}`}>{p.stock <= 0 ? "Out" : `${p.stock} left`}</span>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h3>Last 7 days</h3>
        {report.list.map((d) => (
          <div className="row between list-item" key={d.date}>
            <span>{d.date}</span>
            <span className="right">
              <strong>{money(d.revenue)}</strong>
              <div className="muted">profit {money(d.revenue - d.cost - d.expenses)}</div>
            </span>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Cash flow by payment type (30 days)</h3>
        {Object.keys(report.byMethod).length === 0 ? (
          <p className="muted">No sales yet.</p>
        ) : (
          Object.entries(report.byMethod).map(([m, v]) => (
            <div className="row between list-item" key={m}>
              <span>{PAYMENT_LABELS[m as PaymentMethod]}</span>
              <strong>{money(v)}</strong>
            </div>
          ))
        )}
      </div>

      <div className="card">
        <h3>Best sellers (30 days)</h3>
        {report.top.length === 0 ? (
          <p className="muted">No sales yet.</p>
        ) : (
          report.top.map(([name, qty]) => (
            <div className="row between list-item" key={name}>
              <span>{name}</span>
              <strong>{qty} sold</strong>
            </div>
          ))
        )}
      </div>

      <div className="card">
        <h3>Expenses</h3>
        <form onSubmit={addExpense}>
          <label htmlFor="edesc">What was it for?</label>
          <input id="edesc" required value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Transport, electricity, rent" />
          <div className="row">
            <div className="grow">
              <label htmlFor="eamt">Amount (K)</label>
              <input id="eamt" required type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="grow">
              <label htmlFor="ecat">Category</label>
              <select id="ecat" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="general">General</option>
                <option value="rent">Rent</option>
                <option value="utilities">Utilities</option>
                <option value="transport">Transport</option>
                <option value="salaries">Salaries</option>
                <option value="restocking">Restocking</option>
              </select>
            </div>
          </div>
          {error && <div className="error">{error}</div>}
          <div style={{ height: 8 }} />
          <button className="btn full" disabled={busy}>
            {busy ? "Saving…" : "Add expense"}
          </button>
        </form>
        <div style={{ marginTop: 12 }}>
          {expenses.slice(0, 15).map((x) => (
            <div className="row between list-item" key={x.id}>
              <div className="grow">
                <div>{x.description}</div>
                <div className="muted">
                  {x.expense_date} · {x.category}
                </div>
              </div>
              <strong>{money(x.amount)}</strong>
              <button className="btn ghost small" onClick={() => removeExpense(x.id)}>
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
