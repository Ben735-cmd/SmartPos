"use client";

import { useState } from "react";
import AuthGate from "@/components/AuthGate";
import SellTab from "@/components/SellTab";
import ProductsTab from "@/components/ProductsTab";
import SalesTab from "@/components/SalesTab";
import ReportsTab from "@/components/ReportsTab";
import SettingsTab from "@/components/SettingsTab";
import StatusBar from "@/components/StatusBar";
import Icon from "@/components/Icons";

const TABS = [
  { id: "sell", label: "Sell", icon: "sell" },
  { id: "products", label: "Products", icon: "products" },
  { id: "sales", label: "Sales", icon: "sales" },
  { id: "reports", label: "Reports", icon: "reports" },
  { id: "settings", label: "Settings", icon: "settings" },
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
              <div className="brand">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-mark.svg" fetchPriority="high" alt="SmartPOS" width={44} height={32} />
                <div>
                  <div className="name">{shop.name}</div>
                  <div className="sub">SmartPOS</div>
                </div>
              </div>
              <div className="row">
                <StatusBar />
              </div>
            </div>

            {/* Tabs stay mounted-by-key so each one refetches fresh data when opened. */}
            {tab === "sell" && <SellTab key="sell" shop={shop} />}
            {tab === "products" && <ProductsTab key="products" shop={shop} />}
            {tab === "sales" && <SalesTab key="sales" shop={shop} />}
            {tab === "reports" && <ReportsTab key="reports" shop={shop} />}
            {tab === "settings" && <SettingsTab key="settings" shop={shop} onSignOut={signOut} />}
          </div>

          <nav className="tabs">
            {TABS.map((t) => (
              <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
                <span className="ico">
                  <Icon name={t.icon} />
                </span>
                {t.label}
              </button>
            ))}
          </nav>
        </>
      )}
    </AuthGate>
  );
}
