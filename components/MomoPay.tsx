"use client";

import { useEffect, useRef, useState } from "react";
import { money } from "@/lib/format";
import { cancelPayment, checkPayment, startPayment, type MomoPayment } from "@/lib/momo";
import { uuid } from "@/lib/pending";

/** Asks the customer's phone for payment and waits for them to approve. */
export default function MomoPay({
  shopId,
  amount,
  network,
  onPaid,
  onClose,
}: {
  shopId: string;
  amount: number;
  network: "MTN" | "Airtel" | "Zamtel";
  onPaid: (reference: string) => void;
  onClose: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [payment, setPayment] = useState<MomoPayment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // One id per attempt, so tapping twice or retrying a bad connection never charges twice.
  const attemptId = useRef(uuid());

  const waiting = payment?.status === "pending";

  useEffect(() => {
    if (!payment || payment.status !== "pending") return;
    const t = setInterval(async () => {
      try {
        const r = await checkPayment(shopId, payment.id);
        setPayment(r.payment);
      } catch {
        /* a missed check is fine; the next one will catch up */
      }
    }, 3000);
    return () => clearInterval(t);
  }, [payment, shopId]);

  useEffect(() => {
    if (payment?.status === "succeeded") {
      const ref = `${network} ${payment.provider_ref ?? payment.id.slice(0, 8)}`;
      const t = setTimeout(() => onPaid(ref), 900);
      return () => clearTimeout(t);
    }
  }, [payment?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  async function request(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await startPayment(shopId, { id: attemptId.current, amount, phone, network });
      setPayment(r.payment);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
    setBusy(false);
  }

  async function cancel() {
    if (payment && waiting) {
      try {
        await cancelPayment(shopId, payment.id);
      } catch {
        /* closing anyway */
      }
    }
    onClose();
  }

  function tryAgain() {
    attemptId.current = uuid();
    setPayment(null);
    setError("");
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className="card" style={{ width: "100%", maxWidth: 380 }}>
        <h2>
          {network} payment · {money(amount)}
        </h2>

        {!payment && (
          <form onSubmit={request}>
            <label htmlFor="momo-phone">Customer's {network} number</label>
            <input
              id="momo-phone"
              type="tel"
              inputMode="tel"
              autoFocus
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 0971234567"
            />
            <p className="muted">The customer gets a prompt on their phone and enters their PIN to approve.</p>
            {error && <div className="error">{error}</div>}
            <button className="btn full" disabled={busy}>
              {busy ? "Sending…" : "Request payment"}
            </button>
            <button type="button" className="btn ghost full" style={{ marginTop: 8 }} onClick={onClose}>
              Back
            </button>
          </form>
        )}

        {waiting && (
          <>
            <p className="center" style={{ fontSize: 18 }}>⏳ Waiting for the customer to approve…</p>
            <p className="muted center">Ask them to check their phone. This updates by itself.</p>
            {payment?.message && <p className="muted center">{payment.message}</p>}
            <button className="btn ghost full" onClick={cancel}>
              Cancel
            </button>
          </>
        )}

        {payment?.status === "succeeded" && <p className="center" style={{ fontSize: 20 }}>✅ Paid</p>}

        {(payment?.status === "failed" || payment?.status === "cancelled") && (
          <>
            <div className="error">{payment.message ?? "The payment didn't go through."}</div>
            <button className="btn full" onClick={tryAgain}>
              Try again
            </button>
            <button className="btn ghost full" style={{ marginTop: 8 }} onClick={onClose}>
              Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
