import { customAlphabet } from "nanoid";
import { z } from "zod";
import { prisma } from "./db";
import { chain } from "./chain";
import { charge, type CardInput } from "./payments";
import { sendCertificate, sendReceipt } from "./email";

const slugId = customAlphabet("abcdefghjkmnpqrstuvwxyz23456789", 10);
const token = customAlphabet("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 32);

import { quote } from "./pricing";
export { formatMoney, quote, PLATFORM_FEE_BPS } from "./pricing";

export const giftInput = z.object({
  projectId: z.string().min(1),
  tonnes: z.coerce.number().min(0.5).max(100),
  giverName: z.string().trim().min(1).max(80),
  giverEmail: z.string().trim().email(),
  recipientName: z.string().trim().min(1).max(80),
  recipientEmail: z.string().trim().email().optional().or(z.literal("")),
  message: z.string().trim().max(280),
  // "" or missing = deliver right after payment; otherwise an ISO date (YYYY-MM-DD)
  deliverAt: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date")
    .optional()
    .or(z.literal("")),
});
export type GiftInput = z.infer<typeof giftInput>;

export async function createGift(input: GiftInput) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: input.projectId } });
  if (project.availableTonnes < input.tonnes) {
    throw new Error("Not enough credits available in this project.");
  }
  const { total } = quote(project.pricePerTonne, input.tonnes);
  // Scheduled sends go out at 09:00 UTC on the chosen day.
  const deliverAt = input.deliverAt ? new Date(`${input.deliverAt}T09:00:00Z`) : null;
  if (deliverAt && deliverAt < new Date(Date.now() - 24 * 3600 * 1000)) {
    throw new Error("Delivery date is in the past.");
  }
  return prisma.gift.create({
    data: {
      id: `gift_${slugId()}`,
      slug: slugId(),
      claimToken: token(),
      giverName: input.giverName,
      giverEmail: input.giverEmail,
      recipientName: input.recipientName,
      recipientEmail: input.recipientEmail || null,
      message: input.message,
      tonnes: input.tonnes,
      amountCents: total,
      status: "pending_payment",
      projectId: project.id,
      deliverAt,
    },
  });
}

/** Charge the card, then retire the credits on chain in the recipient's name. */
export async function payAndRetire(giftId: string, card: CardInput) {
  const gift = await prisma.gift.findUniqueOrThrow({
    where: { id: giftId },
    include: { project: true },
  });
  if (gift.status !== "pending_payment") {
    throw new Error("This gift has already been paid for.");
  }

  const payment = await charge(gift.amountCents, card);
  if (!payment.ok) return { ok: false as const, error: payment.error };

  await prisma.gift.update({
    where: { id: gift.id },
    data: { status: "retiring", paymentId: payment.paymentId },
  });

  try {
    const result = await chain.retire({
      giftId: gift.id,
      projectRegistryId: gift.project.registryId,
      tonnes: gift.tonnes,
      beneficiaryName: gift.recipientName,
      beneficiaryMessage: gift.message || `A gift from ${gift.giverName}`,
    });

    await prisma.$transaction([
      prisma.retirement.create({
        data: {
          id: `ret_${slugId()}`,
          giftId: gift.id,
          chain: result.chain,
          txHash: result.txHash,
          blockNumber: result.blockNumber,
          contract: result.contract,
          serialRange: result.serialRange,
          certTokenId: result.certTokenId,
          beneficiaryName: gift.recipientName,
          beneficiaryMsg: gift.message,
          tonnes: gift.tonnes,
        },
      }),
      prisma.gift.update({ where: { id: gift.id }, data: { status: "delivered" } }),
      prisma.project.update({
        where: { id: gift.projectId },
        data: { availableTonnes: { decrement: gift.tonnes } },
      }),
    ]);
  } catch (err) {
    // In production this is where you'd refund the payment.
    await prisma.gift.update({ where: { id: gift.id }, data: { status: "failed" } });
    throw err;
  }

  // Emails are best-effort: the retirement is done, so never fail the request here.
  try {
    const full = await prisma.gift.findUniqueOrThrow({
      where: { id: gift.id },
      include: { project: true, retirement: true },
    });
    await sendReceipt(full);
    if (!full.deliverAt || full.deliverAt <= new Date()) await deliver(full.id);
  } catch (err) {
    console.error("email failed", err);
  }

  return { ok: true as const, slug: gift.slug };
}

/** Email the recipient their certificate and mark the gift delivered. */
async function deliver(giftId: string) {
  const full = await prisma.gift.findUniqueOrThrow({
    where: { id: giftId },
    include: { project: true, retirement: true },
  });
  if (full.deliveredAt) return false;
  const sent = await sendCertificate(full);
  await prisma.gift.update({ where: { id: giftId }, data: { deliveredAt: new Date() } });
  return sent;
}

/** Cron entry point: send every scheduled certificate whose time has come. */
export async function deliverDue() {
  const due = await prisma.gift.findMany({
    where: { status: "delivered", deliveredAt: null, deliverAt: { lte: new Date() } },
    select: { id: true },
  });
  let sent = 0;
  for (const { id } of due) {
    try {
      if (await deliver(id)) sent++;
    } catch (err) {
      console.error(`deliver ${id} failed`, err);
    }
  }
  return sent;
}

export async function claimCertificate(slug: string, claimToken: string, wallet: string) {
  const gift = await prisma.gift.findUniqueOrThrow({
    where: { slug },
    include: { retirement: true },
  });
  if (gift.claimToken !== claimToken) throw new Error("Invalid claim link.");
  if (!gift.retirement) throw new Error("This gift has not been retired yet.");
  if (gift.retirement.claimedBy) throw new Error("This certificate was already claimed.");
  if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) throw new Error("Enter a valid wallet address.");

  await chain.claimCertificate(gift.retirement.certTokenId, wallet);
  await prisma.retirement.update({
    where: { id: gift.retirement.id },
    data: { claimedBy: wallet },
  });
}
