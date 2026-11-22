import type { Metadata } from "next";
import { CONTACTS } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Privacy Policy | SmartPOS",
  description: "How SmartPOS collects, uses and protects your information.",
};

export default function Privacy() {
  const c = CONTACTS[0];
  return (
    <main className="about legal">
      <a className="back" href="/">
        Back to the app
      </a>
      <h1 style={{ textAlign: "left" }}>Privacy Policy</h1>
      <p className="muted">Last updated: 22 November 2026</p>

      <p>
        SmartPOS is a point-of-sale and business app for small shops in Zambia. This policy explains what information we collect, why, and the
        choices you have. We keep it plain on purpose.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Your account:</strong> your email address and a password (stored securely, never readable by us). If you sign in with Google,
          we receive your name and email address from Google. We do not receive your Google password and we do not access your Google contacts,
          files or other Google data.
        </li>
        <li>
          <strong>Your shop's records:</strong> the shop name, products, prices, stock, sales, receipts, expenses and daily cash checks that you
          enter or create while using the app.
        </li>
        <li>
          <strong>Mobile money details:</strong> when you request a mobile money payment from a customer, we process the customer's phone number
          and the amount so the payment can be requested and confirmed.
        </li>
        <li>
          <strong>Photos you choose to upload:</strong> if you use "photo of your list" to add products, the photo is sent to an AI service to
          read the text. We do not keep the photo.
        </li>
        <li>
          <strong>Payment provider keys:</strong> if you connect your own payment provider account, the key you enter is stored on our server
          only and is never shown again.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To run the app: sign you in, record sales, track stock and show your reports.</li>
        <li>To request and confirm mobile money payments you ask for.</li>
        <li>To keep the service secure and fix problems.</li>
      </ul>
      <p>We do not sell your information. We do not show advertising. We do not use your shop's data to build profiles of you or your customers.</p>

      <h2>Who else handles your information</h2>
      <p>We use trusted services to run SmartPOS. They process data on our behalf and only to provide their service:</p>
      <ul>
        <li>Supabase: database and sign-in.</li>
        <li>Vercel: hosting the website.</li>
        <li>Google: only if you choose "Continue with Google".</li>
        <li>Groq: reads photos of product lists, only when you use that feature.</li>
        <li>Your chosen payment provider (for example Flutterwave): only if you turn on automatic mobile money payments.</li>
      </ul>

      <h2>Your shop's data stays yours</h2>
      <p>Each shop can see only its own records. Other shops cannot open them.</p>

      <h2>Data on your phone</h2>
      <p>
        So the app can keep working without internet, SmartPOS saves your products, recent sales and any changes not yet synced on your phone.
        Signing out removes the saved copies. We also store a small sign-in token in your browser to keep you signed in.
      </p>

      <h2>How long we keep it</h2>
      <p>We keep your information while your account is active. If you ask us to delete your account, we delete your shop's records and your sign-in details.</p>

      <h2>Your choices</h2>
      <ul>
        <li>Ask to see, correct or delete the information we hold about you.</li>
        <li>Stop using Google sign-in at any time by using email and password, or by removing SmartPOS from your Google account's connected apps.</li>
        <li>Delete your account by contacting us.</li>
      </ul>

      <h2>Children</h2>
      <p>SmartPOS is for people running a business. It is not meant for children under 18.</p>

      <h2>Changes</h2>
      <p>If we change this policy, we will update the date at the top. If a change is significant, we will tell you in the app.</p>

      <h2>Contact us</h2>
      <p>
        Questions or requests about your information: {c.name},{" "}
        <a href={`mailto:${c.email}`}>{c.email}</a>
        {c.phone ? <>, {c.phone}</> : null}.
      </p>
    </main>
  );
}
