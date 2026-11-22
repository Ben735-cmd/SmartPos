// SmartPOS mobile-money payments.
// Providers: "demo" (simulated, for testing), "flutterwave" (real, each shop uses its own secret key),
// "manual" (no automatic collection; cashier types the transaction reference).
// Provider secret keys live in shop_payment_secrets, which no browser can read.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const NETWORKS = ["MTN", "Airtel", "Zamtel"];
const PROVIDERS = ["manual", "demo", "flutterwave"];
const PENDING_TIMEOUT_MS = 3 * 60 * 1000;

/** Accepts 0971234567, 971234567, +260971234567, 260 97 123 4567. Returns 260971234567 or null. */
function normalisePhone(raw: string): string | null {
  let d = String(raw ?? "").replace(/[^\d]/g, "");
  if (d.startsWith("260")) d = d.slice(3);
  else if (d.startsWith("0")) d = d.slice(1);
  return /^[79]\d{8}$/.test(d) ? "260" + d : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: userData } = await asUser.auth.getUser();
  if (!userData?.user) return json({ error: "Please sign in again." }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request." }, 400);
  }
  const action = String(body.action ?? "");
  const shopId = String(body.shop_id ?? "");

  // RLS only lets the owner see their own shop, so this doubles as the ownership check.
  const { data: shop } = await asUser.from("shops").select("id").eq("id", shopId).maybeSingle();
  if (!shop) return json({ error: "Shop not found." }, 404);

  const { data: settings } = await admin.from("shop_payment_settings").select("provider").eq("shop_id", shopId).maybeSingle();
  const provider = settings?.provider ?? "manual";

  if (action === "get_settings") {
    const { data: sec } = await admin.from("shop_payment_secrets").select("shop_id").eq("shop_id", shopId).maybeSingle();
    return json({ provider, has_key: !!sec });
  }

  if (action === "save_settings") {
    const next = String(body.provider ?? "");
    if (!PROVIDERS.includes(next)) return json({ error: "Unknown provider." }, 400);
    const key = typeof body.secret_key === "string" ? body.secret_key.trim() : "";
    if (next === "flutterwave") {
      const { data: existing } = await admin.from("shop_payment_secrets").select("shop_id").eq("shop_id", shopId).maybeSingle();
      if (!key && !existing) return json({ error: "Paste your Flutterwave secret key to turn this on." }, 400);
    }
    if (key) {
      const { error } = await admin.from("shop_payment_secrets").upsert({ shop_id: shopId, secret_key: key, updated_at: new Date().toISOString() });
      if (error) return json({ error: "Couldn't save the key." }, 500);
    }
    const { error } = await admin.from("shop_payment_settings").upsert({ shop_id: shopId, provider: next, updated_at: new Date().toISOString() });
    if (error) return json({ error: "Couldn't save settings." }, 500);
    return json({ ok: true, provider: next });
  }

  if (action === "start") {
    const id = String(body.payment_id ?? "");
    const amount = Number(body.amount);
    const network = String(body.network ?? "");
    const phone = normalisePhone(String(body.phone ?? ""));
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Bad payment id." }, 400);
    if (!(amount > 0) || amount > 1_000_000) return json({ error: "Bad amount." }, 400);
    if (!NETWORKS.includes(network)) return json({ error: "Pick MTN, Airtel or Zamtel." }, 400);
    if (!phone) return json({ error: "Enter a valid Zambian mobile number, like 0971234567." }, 400);
    if (provider === "manual") return json({ error: "Automatic mobile payments aren't turned on for this shop." }, 400);

    // Safe to retry: the same payment id never charges twice.
    const { data: existing } = await admin.from("mobile_payments").select("*").eq("id", id).eq("shop_id", shopId).maybeSingle();
    if (existing) return json({ payment: existing });

    let status = "pending";
    let message: string | null = null;
    let providerRef: string | null = null;

    if (provider === "demo") {
      providerRef = "demo-" + id.slice(0, 8);
      message = "Demo mode: no real money moves.";
    } else if (provider === "flutterwave") {
      const { data: sec } = await admin.from("shop_payment_secrets").select("secret_key").eq("shop_id", shopId).maybeSingle();
      if (!sec) return json({ error: "Add your Flutterwave key in Payment settings." }, 400);
      providerRef = id;
      try {
        const res = await fetch("https://api.flutterwave.com/v3/charges?type=mobile_money_zambia", {
          method: "POST",
          headers: { Authorization: `Bearer ${sec.secret_key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            tx_ref: id,
            amount,
            currency: "ZMW",
            network,
            phone_number: phone,
            email: userData.user.email ?? "customer@smartpos.app",
          }),
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok || out.status === "error") {
          status = "failed";
          message = String(out.message ?? "The provider refused this payment.").slice(0, 200);
        }
      } catch {
        return json({ error: "Couldn't reach the payment provider. Check the internet and try again." }, 502);
      }
    }

    const { data: row, error } = await admin
      .from("mobile_payments")
      .insert({ id, shop_id: shopId, amount, phone, network, provider, provider_ref: providerRef, status, message })
      .select("*")
      .single();
    if (error) return json({ error: "Couldn't record the payment." }, 500);
    return json({ payment: row });
  }

  if (action === "status" || action === "cancel") {
    const id = String(body.payment_id ?? "");
    const { data: p } = await admin.from("mobile_payments").select("*").eq("id", id).eq("shop_id", shopId).maybeSingle();
    if (!p) return json({ error: "Payment not found." }, 404);
    if (p.status !== "pending") return json({ payment: p });

    let status: string = "pending";
    let message: string | null = p.message;

    if (action === "cancel") {
      status = "cancelled";
      message = "Cancelled by the cashier.";
    } else if (p.provider === "demo") {
      const age = Date.now() - new Date(p.created_at).getTime();
      if (age >= 6000) {
        // Demo rule: numbers ending in 0000 are declined, everything else is approved.
        if (p.phone.endsWith("0000")) {
          status = "failed";
          message = "Demo: customer declined.";
        } else {
          status = "succeeded";
          message = "Demo: approved.";
        }
      }
    } else if (p.provider === "flutterwave") {
      const { data: sec } = await admin.from("shop_payment_secrets").select("secret_key").eq("shop_id", shopId).maybeSingle();
      if (sec) {
        try {
          const res = await fetch(
            `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(p.provider_ref ?? p.id)}`,
            { headers: { Authorization: `Bearer ${sec.secret_key}` } }
          );
          const out = await res.json().catch(() => ({}));
          const d = out?.data;
          if (d?.status === "successful") {
            if (Number(d.amount) >= Number(p.amount) && d.currency === "ZMW") {
              status = "succeeded";
              message = "Paid.";
            } else {
              status = "failed";
              message = "Amount paid didn't match. Check your provider dashboard.";
            }
          } else if (d?.status === "failed") {
            status = "failed";
            message = String(d.processor_response ?? "Customer declined or payment failed.").slice(0, 200);
          }
        } catch {
          /* keep waiting; the next check will try again */
        }
      }
    }

    if (status === "pending" && Date.now() - new Date(p.created_at).getTime() > PENDING_TIMEOUT_MS) {
      status = "failed";
      message = "No answer from the customer's phone. Try again.";
    }

    if (status !== "pending") {
      const { data: updated } = await admin
        .from("mobile_payments")
        .update({ status, message, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("status", "pending")
        .select("*")
        .maybeSingle();
      return json({ payment: updated ?? { ...p, status, message } });
    }
    return json({ payment: p });
  }

  return json({ error: "Unknown action." }, 400);
});
