import { customAlphabet } from "nanoid";
import type { Gift, Project, Retirement } from "@prisma/client";
import { prisma } from "./db";
import { formatMoney } from "./pricing";

/**
 * Email delivery. With RESEND_API_KEY set, mail goes out through Resend;
 * without it, the message is written to the server log and recorded in
 * EmailLog with provider "console" so the admin page still shows it.
 */

const id = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12);

const FROM = process.env.EMAIL_FROM ?? "GiveTonne <onboarding@resend.dev>";

export function appUrl(path = "") {
  const base =
    process.env.APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null) ??
    "http://localhost:3000";
  return base.replace(/\/$/, "") + path;
}

type Mail = { giftId: string; kind: "receipt" | "certificate"; to: string; subject: string; html: string };

async function send(mail: Mail) {
  const apiKey = process.env.RESEND_API_KEY;
  let provider = "console";
  let messageId: string | null = null;

  if (apiKey) {
    const { Resend } = await import("resend");
    const { data, error } = await new Resend(apiKey).emails.send({
      from: FROM,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
    });
    if (error) throw new Error(`Resend: ${error.message}`);
    provider = "resend";
    messageId = data?.id ?? null;
  } else {
    console.log(`[email:console] to=${mail.to} subject="${mail.subject}"`);
  }

  await prisma.emailLog.create({
    data: { id: `em_${id()}`, giftId: mail.giftId, kind: mail.kind, to: mail.to, subject: mail.subject, provider, messageId },
  });
}

type FullGift = Gift & { project: Project; retirement: Retirement | null };

function layout(body: string) {
  return `<!doctype html><html><body style="margin:0;background:#fafaf9;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1c1917">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px">
    <div style="font-weight:600;font-size:18px;margin-bottom:24px">🌱 GiveTonne</div>
    <div style="background:#fff;border:1px solid #e7e5e4;border-radius:16px;padding:28px">${body}</div>
    <p style="color:#78716c;font-size:12px;margin-top:24px">You're receiving this because a GiveTonne gift involves this address.</p>
  </div></body></html>`;
}

const button = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#047857;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600">${label}</a>`;

export async function sendReceipt(gift: FullGift) {
  const when = gift.deliverAt && gift.deliverAt > new Date()
    ? `We'll email ${gift.recipientName} their certificate on ${gift.deliverAt.toDateString()}.`
    : `${gift.recipientEmail ? `We've emailed ${gift.recipientName} their certificate.` : "Share the certificate link below with them."}`;
  const url = appUrl(`/gift/${gift.slug}?claim=${gift.claimToken}`);

  await send({
    giftId: gift.id,
    kind: "receipt",
    to: gift.giverEmail,
    subject: `Your gift to ${gift.recipientName} is retired on-chain`,
    html: layout(`
      <h1 style="font-size:22px;margin:0 0 12px">Done — ${gift.tonnes} ${gift.tonnes === 1 ? "tonne" : "tonnes"} retired for ${gift.recipientName}</h1>
      <p>${when}</p>
      <p style="color:#57534e;font-size:14px">${gift.project.name} · ${gift.project.registry} ${gift.project.registryId} · ${formatMoney(gift.amountCents)} paid</p>
      ${gift.retirement ? `<p style="font-family:monospace;font-size:12px;color:#57534e;word-break:break-all">tx ${gift.retirement.txHash}</p>` : ""}
      <p style="margin-top:20px">${button(url, "Open the certificate")}</p>
      <p style="font-size:13px;color:#78716c">This link includes the private claim token for the NFT, so only share it with ${gift.recipientName}.</p>
    `),
  });
}

export async function sendCertificate(gift: FullGift) {
  if (!gift.recipientEmail) return false;
  const url = appUrl(`/gift/${gift.slug}?claim=${gift.claimToken}`);

  await send({
    giftId: gift.id,
    kind: "certificate",
    to: gift.recipientEmail,
    subject: `${gift.giverName} retired ${gift.tonnes} ${gift.tonnes === 1 ? "tonne" : "tonnes"} of CO₂ in your name`,
    html: layout(`
      <p style="font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#047857;margin:0 0 8px">Certificate of carbon retirement</p>
      <h1 style="font-size:26px;margin:0 0 8px">${gift.recipientName}</h1>
      <p style="margin:0 0 16px;color:#44403c">${gift.tonnes} ${gift.tonnes === 1 ? "tonne" : "tonnes"} of CO₂ permanently retired in your name, through ${gift.project.name} (${gift.project.location}).</p>
      ${gift.message ? `<blockquote style="border-left:3px solid #6ee7b7;margin:0 0 16px;padding-left:12px;font-style:italic">“${gift.message}”</blockquote>` : ""}
      <p style="margin:0 0 20px">— ${gift.giverName}</p>
      <p>${button(url, "View your certificate")}</p>
      <p style="font-size:13px;color:#78716c">The retirement is recorded on a public blockchain. Your certificate page has a “Verify on chain” button, and you can optionally claim the certificate NFT to a wallet.</p>
    `),
  });
  return true;
}
