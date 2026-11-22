"use client";

import { useEffect, useState } from "react";
import { getSettings, saveSettings, type Provider } from "@/lib/momo";
import type { Shop } from "@/lib/types";

const OPTIONS: { id: Provider; title: string; text: string }[] = [
  { id: "manual", title: "Manual", text: "Customer pays to your number; you type the reference (or leave it blank)." },
  { id: "demo", title: "Demo (testing)", text: "Practice the whole flow. No real money moves. Numbers ending 0000 are declined." },
  { id: "flutterwave", title: "Flutterwave (real payments)", text: "Customer is prompted on their phone and the sale is marked paid automatically." },
];

export default function SettingsTab({ shop, onSignOut }: { shop: Shop; onSignOut: () => void }) {
  const [provider, setProvider] = useState<Provider>("manual");
  const [hasKey, setHasKey] = useState(false);
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getSettings(shop.id)
      .then((s) => {
        setProvider(s.provider);
        setHasKey(s.has_key);
      })
      .catch(() => setError("Payment settings need internet. Connect and open this tab again."))
      .finally(() => setLoading(false));
  }, [shop.id]);

  async function save() {
    setBusy(true);
    setMsg("");
    setError("");
    try {
      await saveSettings(shop.id, provider, key.trim() || undefined);
      if (key.trim()) setHasKey(true);
      setKey("");
      setMsg("Saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    }
    setBusy(false);
  }

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <>
    <div className="card">
      <h2>{shop.name}</h2>
      <p className="muted">Your shop on SmartPOS.</p>
      <div className="row stretch" style={{ marginTop: 8 }}>
        <a className="btn ghost grow" href="/about">
          About
        </a>
        <button className="btn ghost grow" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </div>
    <div className="card">
      <h2>Mobile payments</h2>
      <p className="muted">Choose how MTN MoMo, Airtel Money and Zamtel Kwacha payments work at the till.</p>

      {OPTIONS.map((o) => (
        <label key={o.id} className="option">
          <input type="radio" name="provider" checked={provider === o.id} onChange={() => setProvider(o.id)} />
          <strong>{o.title}</strong>
          <div className="muted">{o.text}</div>
        </label>
      ))}

      {provider === "flutterwave" && (
        <>
          <label htmlFor="fw-key">Flutterwave secret key {hasKey && <span className="muted">(saved, leave blank to keep it)</span>}</label>
          <input id="fw-key" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="FLWSECK-…" />
          <p className="muted">
            Get this from your own Flutterwave account (Settings → API keys). Payments go straight to your account. The key is stored on the
            server only and is never shown again.
          </p>
        </>
      )}

      {error && <div className="error">{error}</div>}
      {msg && <div className="notice">{msg}</div>}
      <div style={{ height: 8 }} />
      <button className="btn full" disabled={busy} onClick={save}>
        {busy ? "Saving…" : "Save"}
      </button>
    </div>
    </>
  );
}
