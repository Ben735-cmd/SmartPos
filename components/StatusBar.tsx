"use client";

import { useEffect, useState } from "react";
import { outboxAll } from "@/lib/idb";
import { discardOp, retryFailed, trySync, useSync } from "@/lib/offline";
import { describeOp } from "@/lib/pending";
import type { OutboxOp } from "@/lib/types";

export default function StatusBar() {
  const s = useSync();
  const [open, setOpen] = useState(false);

  let text: string;
  let cls = "ok";
  if (s.failed > 0) {
    text = `⚠ ${s.failed} need${s.failed === 1 ? "s" : ""} attention`;
    cls = "out";
  } else if (s.authNeeded) {
    text = "Sign in again to finish syncing";
    cls = "out";
  } else if (!s.online) {
    text = s.pending > 0 ? `Offline · ${s.pending} saved on phone` : "Offline · you can keep selling";
    cls = "low";
  } else if (s.syncing && s.pending > 0) {
    text = `Syncing ${s.pending}…`;
    cls = "low";
  } else if (s.pending > 0) {
    text = `${s.pending} waiting to sync`;
    cls = "low";
  } else {
    text = "✓ All saved";
  }

  const clickable = s.failed > 0 || s.pending > 0;

  return (
    <>
      <button
        className={`badge ${cls}`}
        style={{ border: 0, cursor: clickable ? "pointer" : "default" }}
        onClick={() => {
          if (s.failed > 0) setOpen(true);
          else if (s.pending > 0) void trySync();
        }}
        aria-live="polite"
      >
        {text}
      </button>
      {open && <Issues onClose={() => setOpen(false)} />}
    </>
  );
}

function Issues({ onClose }: { onClose: () => void }) {
  const s = useSync();
  const [ops, setOps] = useState<OutboxOp[]>([]);

  useEffect(() => {
    outboxAll().then((all) => setOps(all.filter((o) => o.failed)));
  }, [s.failed, s.pending]);

  useEffect(() => {
    if (s.failed === 0) onClose();
  }, [s.failed, onClose]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="receipt" style={{ fontFamily: "inherit" }} onClick={(e) => e.stopPropagation()}>
        <h2>Needs attention</h2>
        <p className="muted">
          These were saved on this phone, but the server refused them. Try again, or remove them if they're not needed.
        </p>
        {ops.map((op) => (
          <div className="list-item" key={op.seq}>
            <strong>{describeOp(op)}</strong>
            <div className="error" style={{ margin: "4px 0" }}>
              {op.error}
            </div>
            <button className="btn ghost small" onClick={() => discardOp(op.seq!)}>
              Remove
            </button>
          </div>
        ))}
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn ghost grow" onClick={onClose}>
            Close
          </button>
          <button className="btn grow" onClick={() => retryFailed()}>
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
