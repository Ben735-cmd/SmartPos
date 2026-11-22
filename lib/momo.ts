import { supabase } from "./supabase";
import { kvGet, kvSet } from "./idb";
import type { PaymentMethod } from "./types";

export type Provider = "manual" | "demo" | "flutterwave";
export type MomoStatus = "pending" | "succeeded" | "failed" | "cancelled";
export type MomoPayment = {
  id: string;
  amount: number;
  phone: string;
  network: string;
  provider: string;
  provider_ref: string | null;
  status: MomoStatus;
  message: string | null;
};

export const NETWORK_FOR: Partial<Record<PaymentMethod, "MTN" | "Airtel" | "Zamtel">> = {
  mtn_momo: "MTN",
  airtel_money: "Airtel",
  zamtel_kwacha: "Zamtel",
};

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("mobile-pay", { body });
  if (error) {
    // Edge function errors carry the server's message in the response body.
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      const j = await ctx.json().catch(() => null);
      if (j?.error) throw new Error(j.error);
    }
    throw new Error("Couldn't reach the payment service. Check the internet and try again.");
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

/** Which payment mode this shop uses. Remembered on the phone so the till still knows offline. */
export async function getProvider(shopId: string, cacheOnly = false): Promise<Provider> {
  const key = `${shopId}:provider`;
  if (!cacheOnly) {
    try {
      const r = await call<{ provider: Provider }>({ action: "get_settings", shop_id: shopId });
      await kvSet(key, r.provider);
      return r.provider;
    } catch {
      /* fall through to the saved value */
    }
  }
  return ((await kvGet<Provider>(key)) ?? "manual") as Provider;
}

export const getSettings = (shopId: string) =>
  call<{ provider: Provider; has_key: boolean }>({ action: "get_settings", shop_id: shopId });

export const saveSettings = async (shopId: string, provider: Provider, secretKey?: string) => {
  const r = await call<{ provider: Provider }>({ action: "save_settings", shop_id: shopId, provider, secret_key: secretKey });
  await kvSet(`${shopId}:provider`, r.provider);
  return r;
};

export const startPayment = (shopId: string, p: { id: string; amount: number; phone: string; network: string }) =>
  call<{ payment: MomoPayment }>({ action: "start", shop_id: shopId, payment_id: p.id, amount: p.amount, phone: p.phone, network: p.network });

export const checkPayment = (shopId: string, id: string) =>
  call<{ payment: MomoPayment }>({ action: "status", shop_id: shopId, payment_id: id });

export const cancelPayment = (shopId: string, id: string) =>
  call<{ payment: MomoPayment }>({ action: "cancel", shop_id: shopId, payment_id: id });
