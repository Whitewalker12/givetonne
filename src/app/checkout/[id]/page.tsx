import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatMoney, quote } from "@/lib/gifts";
import { CheckoutForm } from "@/components/CheckoutForm";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gift = await prisma.gift.findUnique({ where: { id }, include: { project: true } });
  if (!gift) notFound();
  if (gift.status === "delivered") redirect(`/gift/${gift.slug}`);

  const price = quote(gift.project.pricePerTonne, gift.tonnes);

  return (
    <div className="mx-auto grid max-w-4xl gap-8 px-4 py-12 lg:grid-cols-2">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Payment</h1>
        <p className="mt-2 text-stone-600">Once the card clears, we retire the credits immediately.</p>
        <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-5">
          <CheckoutForm giftId={gift.id} />
        </div>
      </div>

      <aside className="h-fit rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="font-semibold">Your gift</h2>
        <div className="mt-3 flex items-center gap-3">
          <span className="text-3xl">{gift.project.imageEmoji}</span>
          <div>
            <div className="font-medium">{gift.project.name}</div>
            <div className="text-xs text-stone-500">
              {gift.project.registry} {gift.project.registryId} · vintage {gift.project.vintage}
            </div>
          </div>
        </div>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-stone-600">For</dt>
            <dd className="font-medium">{gift.recipientName}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-600">{gift.tonnes} tonnes CO₂</dt>
            <dd>{formatMoney(price.credits)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-600">Platform fee</dt>
            <dd>{formatMoney(price.fee)}</dd>
          </div>
          <div className="flex justify-between border-t border-stone-200 pt-2 font-semibold">
            <dt>Total</dt>
            <dd>{formatMoney(gift.amountCents)}</dd>
          </div>
        </dl>
        {gift.message ? (
          <blockquote className="mt-4 rounded-lg bg-stone-50 p-3 text-sm italic text-stone-700">
            “{gift.message}”
          </blockquote>
        ) : null}
      </aside>
    </div>
  );
}
