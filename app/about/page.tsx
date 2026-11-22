import type { Metadata } from "next";
import { CONTACTS } from "@/lib/brand";

export const metadata: Metadata = {
  title: "About SmartPOS",
  description: "SmartPOS is a simple, affordable point-of-sale and business app made for small shops in Zambia.",
};

export default function About() {
  return (
    <main className="about">
      <a className="back" href="/">
        Back to the app
      </a>

      <div className="hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="SmartPOS: Keep Track. Move Fast. Grow Big." width={300} height={205} />
      </div>

      <h1>Run your shop from your phone</h1>
      <p className="lede">
        SmartPOS is a simple, affordable till and stock book for small businesses in Zambia. No special hardware, no complicated setup.
      </p>

      <h2>What it does</h2>
      <div className="facts">
        <div>
          <strong>Sell fast</strong>
          Tap items or scan barcodes with your phone camera. Print or share a receipt on WhatsApp.
        </div>
        <div>
          <strong>Know your stock</strong>
          Stock goes down as you sell, and you see what is running low before it runs out.
        </div>
        <div>
          <strong>See your profit</strong>
          Daily and weekly sales, expenses and profit, and what came in by cash, MTN, Airtel or Zamtel.
        </div>
        <div>
          <strong>Keeps working offline</strong>
          No data bundles or network? Keep selling. Everything saves on the phone and syncs when the internet is back.
        </div>
      </div>

      <h2>Built for how shops really work</h2>
      <ul>
        <li>Load your products in minutes: starter packs, a spreadsheet, or a photo of your price list.</li>
        <li>Works with cash and mobile money: MTN MoMo, Airtel Money and Zamtel Kwacha.</li>
        <li>Made in Zambia, priced for small businesses.</li>
      </ul>

      <h2>Your data is yours</h2>
      <p>Each shop sees only its own products, sales and reports. Nobody else can open them.</p>

      <h2>Contact us</h2>
      <p>Questions, feedback or need help getting started? Reach out to us directly.</p>
      <div className="facts">
        {CONTACTS.map((c) => (
          <div key={c.name}>
            <strong>{c.name}</strong>
            {c.phone && (
              <span style={{ display: "block" }}>
                Phone: <a href={`tel:${c.phone.replace(/\s+/g, "")}`}>{c.phone}</a>
                {c.whatsapp && (
                  <>
                    {" · "}
                    <a href={`https://wa.me/${c.whatsapp}`}>WhatsApp</a>
                  </>
                )}
              </span>
            )}
            {c.email && (
              <span style={{ display: "block" }}>
                Email: <a href={`mailto:${c.email}`}>{c.email}</a>
              </span>
            )}
          </div>
        ))}
      </div>

      <p className="muted center" style={{ marginTop: 32 }}>
        SmartPOS · Keep Track. Move Fast. Grow Big.
      </p>
    </main>
  );
}
