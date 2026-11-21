"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Shop } from "@/lib/types";

export default function AuthGate({
  children,
}: {
  children: (shop: Shop, signOut: () => void) => ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [shop, setShop] = useState<Shop | null>(null);
  const [shopLoaded, setShopLoaded] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setShop(null);
      setShopLoaded(false);
      return;
    }
    supabase
      .from("shops")
      .select("id,name,currency")
      .maybeSingle()
      .then(({ data }) => {
        setShop((data as Shop | null) ?? null);
        setShopLoaded(true);
      });
  }, [session]);

  if (!ready) return <div className="auth center muted">Loading…</div>;
  if (!session) return <SignIn />;
  if (!shopLoaded) return <div className="auth center muted">Loading your shop…</div>;
  if (!shop) return <CreateShop onCreated={setShop} />;

  return <>{children(shop, () => supabase.auth.signOut())}</>;
}

function SignIn() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) setError(error.message);
      else if (!data.session) setInfo("Check your email to confirm your account, then sign in.");
    }
    setBusy(false);
  }

  return (
    <div className="auth">
      <h1 className="center">SmartPos</h1>
      <p className="muted center">Simple point-of-sale for your shop</p>
      <form className="card" onSubmit={submit}>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "in" ? "current-password" : "new-password"}
        />
        {error && <div className="error">{error}</div>}
        {info && <div className="notice">{info}</div>}
        <div style={{ height: 8 }} />
        <button className="btn full" disabled={busy}>
          {busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}
        </button>
        <p className="center muted" style={{ marginTop: 12 }}>
          {mode === "in" ? "New here?" : "Already have an account?"}{" "}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setMode(mode === "in" ? "up" : "in");
              setError("");
              setInfo("");
            }}
          >
            {mode === "in" ? "Create an account" : "Sign in"}
          </a>
        </p>
      </form>
    </div>
  );
}

function CreateShop({ onCreated }: { onCreated: (s: Shop) => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { data, error } = await supabase
      .from("shops")
      .insert({ name: name.trim() })
      .select("id,name,currency")
      .single();
    if (error) setError(error.message);
    else onCreated(data as Shop);
    setBusy(false);
  }

  return (
    <div className="auth">
      <h1 className="center">Set up your shop</h1>
      <form className="card" onSubmit={submit}>
        <label htmlFor="shop">Shop name</label>
        <input id="shop" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mulenga's Groceries" />
        {error && <div className="error">{error}</div>}
        <div style={{ height: 8 }} />
        <button className="btn full" disabled={busy || !name.trim()}>
          {busy ? "Creating…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
