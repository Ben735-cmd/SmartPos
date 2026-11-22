import type { Metadata } from "next";
import { CONTACTS } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Terms of Service | SmartPOS",
  description: "The terms for using SmartPOS.",
};

export default function Terms() {
  const c = CONTACTS[0];
  return (
    <main className="about legal">
      <a className="back" href="/">
        Back to the app
      </a>
      <h1 style={{ textAlign: "left" }}>Terms of Service</h1>
      <p className="muted">Last updated: 22 November 2026</p>

      <p>By creating an account or using SmartPOS, you agree to these terms. If you do not agree, please do not use the app.</p>

      <h2>What SmartPOS is</h2>
      <p>
        SmartPOS is a tool for recording sales, tracking stock and expenses, and viewing reports for your business. It helps you keep records. It
        is not an accounting, tax or legal service, and you remain responsible for your business's books and obligations.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>Give accurate information and keep your sign-in details private.</li>
        <li>You are responsible for what happens under your account, including what anyone you share it with does.</li>
        <li>You must be at least 18 years old.</li>
      </ul>

      <h2>Your data</h2>
      <p>
        The records you enter belong to you. You allow us to store and process them to provide SmartPOS. Our{" "}
        <a href="/privacy">Privacy Policy</a> explains how we handle them.
      </p>

      <h2>Mobile money payments</h2>
      <p>
        Automatic mobile money payments are provided through a payment provider you choose and set up yourself. Payments, fees and disputes are
        between you, your customer and that provider. Always confirm that money has arrived before handing over goods. Manual mode records what
        you tell it and cannot check that a payment was really received.
      </p>

      <h2>Using the app properly</h2>
      <ul>
        <li>Do not use SmartPOS for anything unlawful, or to harm, mislead or defraud others.</li>
        <li>Do not try to break into the service, disrupt it, or access other shops' information.</li>
      </ul>

      <h2>Availability</h2>
      <p>
        We work to keep SmartPOS running, and it can keep working without internet, but we cannot promise it will always be available or free of
        errors. Back up important records, and check that your sales have synced.
      </p>

      <h2>Limits of our responsibility</h2>
      <p>
        SmartPOS is provided "as is". To the extent the law allows, we are not responsible for lost sales, lost profit or other indirect loss
        arising from using the app, including loss caused by incorrect entries, unsynced data on a lost or reset phone, or problems with a
        payment provider.
      </p>

      <h2>Ending your use</h2>
      <p>You can stop using SmartPOS at any time and ask us to delete your account. We may suspend accounts that break these terms.</p>

      <h2>Changes</h2>
      <p>We may update these terms. We will change the date above, and if the change is significant we will tell you in the app.</p>

      <h2>Contact us</h2>
      <p>
        {c.name}, <a href={`mailto:${c.email}`}>{c.email}</a>
        {c.phone ? <>, {c.phone}</> : null}.
      </p>
    </main>
  );
}
