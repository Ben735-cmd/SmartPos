"use client";

import { useState } from "react";
import AuthGate from "@/components/AuthGate";
import SellTab from "@/components/SellTab";
import ProductsTab from "@/components/ProductsTab";
import SalesTab from "@/components/SalesTab";
import ReportsTab from "@/components/ReportsTab";
import StatusBar from "@/components/StatusBar";

const TABS = [
  { id: "sell", label: "🛒 Sell" },
  { id: "products", label: "📦 Products" },
  { id: "sales", label: "🧾 Sales" },
  { id: "reports", label: "📊 Reports" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function Home() {
  const [tab, setTab] = useState<TabId>("sell");

  return (
    <AuthGate>
      {(shop, signOut) => (
        <>
          <div className="shell">
            <div className="topbar">
              <div>
                <div className="name">{shop.name}</div>
                <div className="sub">SmartPos</div>
              </div>
              <div className="row">
                <StatusBar />
                <button className="btn ghost small" onClick={signOut}>
                  Sign out
                </button>
              </div>
            </div>

            {/* Tabs stay mounted-by-key so each one refetches fresh data when opened. */}
            {tab === "sell" && <SellTab key="sell" shop={shop} />}
            {tab === "products" && <ProductsTab key="products" shop={shop} />}
            {tab === "sales" && <SalesTab key="sales" shop={shop} />}
            {tab === "reports" && <ReportsTab key="reports" shop={shop} />}
          </div>

          <nav className="tabs">
            {TABS.map((t) => (
              <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </nav>
        </>
      )}
    </AuthGate>
  );
}
