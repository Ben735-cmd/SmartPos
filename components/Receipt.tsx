"use client";

import { money, formatTime } from "@/lib/format";
import { PAYMENT_LABELS, type Sale, type Shop } from "@/lib/types";

export function receiptText(shop: Shop, sale: Sale): string {
  const lines: string[] = [];
  lines.push(shop.name);
  lines.push(`Receipt ${sale.receipt_no}`);
  lines.push(formatTime(sale.created_at));
  lines.push("--------------------------");
  for (const it of sale.sale_items ?? []) {
    lines.push(`${it.quantity} x ${it.product_name}  ${money(it.quantity * it.unit_price)}`);
  }
  lines.push("--------------------------");
  lines.push(`TOTAL ${money(sale.total)}`);
  lines.push(
    `Paid: ${PAYMENT_LABELS[sale.payment_method]}${sale.payment_reference ? " (" + sale.payment_reference + ")" : ""}`
  );
  if (sale.status === "refunded") lines.push("** REFUNDED **");
  lines.push("Thank you!");
  return lines.join("\n");
}

export default function Receipt({ shop, sale, onClose }: { shop: Shop; sale: Sale; onClose: () => void }) {
  async function share() {
    const text = receiptText(shop, sale);
    if (navigator.share) {
      try {
        await navigator.share({ title: `Receipt ${sale.receipt_no}`, text });
        return;
      } catch {
        /* user cancelled */
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="receipt paper" onClick={(e) => e.stopPropagation()}>
        <div className="center">
          <strong>{shop.name}</strong>
          <div>Receipt {sale.receipt_no}</div>
          <div className="muted">{formatTime(sale.created_at)}</div>
        </div>
        <hr />
        {(sale.sale_items ?? []).map((it) => (
          <div className="line" key={it.id}>
            <span>
              {it.quantity} x {it.product_name}
            </span>
            <span>{money(it.quantity * it.unit_price)}</span>
          </div>
        ))}
        <hr />
        <div className="line">
          <strong>TOTAL</strong>
          <strong>{money(sale.total)}</strong>
        </div>
        <div className="muted">
          Paid: {PAYMENT_LABELS[sale.payment_method]}
          {sale.payment_reference ? ` (${sale.payment_reference})` : ""}
        </div>
        {sale.status === "refunded" && <div className="error center">REFUNDED</div>}
        <p className="center" style={{ marginTop: 12 }}>
          Thank you!
        </p>
        <div className="row no-print" style={{ marginTop: 12 }}>
          <button className="btn ghost grow" onClick={share}>
            Share
          </button>
          <button className="btn ghost grow" onClick={() => window.print()}>
            Print
          </button>
          <button className="btn grow" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
