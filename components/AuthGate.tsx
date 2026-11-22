"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { cacheShop, cachedShop } from "@/lib/data";
import { kvDel } from "@/lib/idb";
import { getState, isNetworkError, startSync } from "@/lib/offline";
import type { Shop } from "@/lib/types";

const ACTIVE_FLAG = "smartpos:active";

export default function AuthGate({
  children,
}: {
  children: (shop: Shop, signOut: () => void) => ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [shop, setShop] = useState<Shop | null>(null);
  const [shopLoaded, setShopLoaded] = useState(false);
  // Set when the phone is offline and the saved login can't be refreshed: keep working with the saved shop.
  const [offlineShop, setOfflineShop] = useState<Shop | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data, error }) => {
      setSession(data.session);
      if (!data.session && localStorage.getItem(ACTIVE_FLAG) === "1") {
        const saved = await cachedShop<Shop>();
        const couldBeOffline = error?.name === "AuthRetryableFetchError" || !navigator.onLine;
        if (saved && couldBeOffline) setOfflineShop(saved);
      }
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_OUT") setOfflineShop(null);
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
      .then(async ({ data, error }) => {
        if (error) {
          const saved = await cachedShop<Shop>();
          if (saved && isNetworkError(error)) setShop(saved);
          setShopLoaded(true);
          return;
        }
        if (data) {
          await cacheShop(data);
          localStorage.setItem(ACTIVE_FLAG, "1");
        }
        setShop((data as Shop | null) ?? null);
        setShopLoaded(true);
      });
  }, [session]);

  const current = session && shop ? shop : offlineShop;

  useEffect(() => {
    if (current) startSync(current.id);
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function signOut() {
    const pending = getState().pending;
    if (
      pending > 0 &&
      !confirm(
        `${pending} change${pending === 1 ? " hasn't" : "s haven't"} reached the server yet. Sign out anyway? They stay on this phone and sync the next time you sign in.`
      )
    ) {
      return;
    }
    if (current) {
      for (const k of ["products", "sales", "reports", "provider"]) await kvDel(`${current.id}:${k}`);
    }
    localStorage.removeItem(ACTIVE_FLAG);
    await kvDel("shop");
    setOfflineShop(null);
    // "local" signs out on this device without needing the internet.
    await supabase.auth.signOut({ scope: "local" });
  }

  if (!ready) return <Splash text="Loading…" />;
  if (!current) {
    if (!session) return <SignIn />;
    if (!shopLoaded) return <Splash text="Loading your shop…" />;
    return <CreateShop onCreated={setShop} />;
  }

  return <>{children(current, signOut)}</>;
}

function Splash({ text }: { text: string }) {
  return (
    <div className="splash">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-mark.svg" fetchPriority="high" alt="SmartPOS" width={84} height={61} />
      <div>{text}</div>
    </div>
  );
}

function SignIn() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function google() {
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) {
        setError(
          isNetworkError(error)
            ? "No internet connection. Signing in needs internet the first time."
            : /not enabled|unsupported provider/i.test(error.message)
              ? "Google sign-in isn't switched on yet. Use your email and password for now."
              : error.message
        );
        setBusy(false);
      }
      // On success the browser leaves for Google, then comes back signed in.
    } catch {
      setError("No internet connection. Signing in needs internet the first time.");
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(isNetworkError(error) ? "No internet connection. Signing in needs internet the first time." : error.message);
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) setError(isNetworkError(error) ? "No internet connection. Creating an account needs internet." : error.message);
        else if (!data.session) setInfo("Check your email to confirm your account, then sign in.");
      }
    } catch {
      setError("No internet connection. Signing in needs internet the first time.");
    }
    setBusy(false);
  }

  return (
    <div className="auth">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="auth-logo" src="/logo.svg" fetchPriority="high" alt="SmartPOS: Keep Track. Move Fast. Grow Big." width={782} height={534} />
      <form className="card" onSubmit={submit}>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          placeholder="At least 6 characters"
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
        <div className="divider">or</div>
        <button type="button" className="btn ghost full google" disabled={busy} onClick={google}>
          <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.5-4.1 7-10.2 7-17.6z" />
            <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.100 0 24s.9 7.600 2.600 10.800l7.900-6.100z" />
            <path fill="#34A853" d="M24 48c6.5 0 11.900-2.100 15.900-5.800l-7.600-5.900c-2.100 1.400-4.900 2.300-8.300 2.300-6.300 0-11.600-4.100-13.500-9.800l-7.900 6.100C6.500 42.600 14.600 48 24 48z" />
          </svg>
          Continue with Google
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
      <p className="muted center" style={{ fontSize: 12.5 }}>
        By continuing you agree to our <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.
      </p>
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
    if (error) setError(isNetworkError(error) ? "No internet connection. Setting up your shop needs internet." : error.message);
    else {
      await cacheShop(data);
      localStorage.setItem(ACTIVE_FLAG, "1");
      onCreated(data as Shop);
    }
    setBusy(false);
  }

  return (
    <div className="auth">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="auth-logo" src="/logo.svg" fetchPriority="high" alt="SmartPOS" width={782} height={534} style={{ width: "min(180px, 55%)" }} />
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
