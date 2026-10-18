import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { chain } from "@/lib/chain";
import { ClaimForm } from "@/components/ClaimForm";

export const dynamic = "force-dynamic";

export default async function CertificatePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ from?: string; claim?: string }>;
}) {
  const [{ slug }, { from, claim }] = await Promise.all([params, searchParams]);
  const gift = await prisma.gift.findUnique({
    where: { slug },
    include: { project: true, retirement: true },
  });
  if (!gift || !gift.retirement) notFound();
  const r = gift.retirement;
  const canClaim = claim === gift.claimToken || from === "checkout";

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      {from === "checkout" ? (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <strong>Done.</strong> The credits are retired. Share this page with {gift.recipientName} — the
          private claim link (with the NFT option) is{" "}
          <code className="break-all">/gift/{gift.slug}?claim={gift.claimToken}</code>
        </div>
      ) : null}

      <article className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-emerald-700 to-emerald-900 px-8 py-10 text-white">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-emerald-200">
            Certificate of carbon retirement
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">{gift.recipientName}</h1>
          <p className="mt-2 text-emerald-100">
            {gift.tonnes} {gift.tonnes === 1 ? "tonne" : "tonnes"} of CO₂ permanently retired in your name
          </p>
          {gift.message ? (
            <blockquote className="mt-6 border-l-2 border-emerald-300 pl-4 text-lg italic text-emerald-50">
              “{gift.message}”
            </blockquote>
          ) : null}
          <p className="mt-4 text-sm text-emerald-200">— {gift.giverName}</p>
        </div>

        <div className="grid gap-6 px-8 py-8 sm:grid-cols-2">
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">Project</h2>
            <p className="mt-1 text-2xl">{gift.project.imageEmoji}</p>
            <p className="font-medium">{gift.project.name}</p>
            <p className="text-sm text-stone-600">
              {gift.project.type} · {gift.project.location}
            </p>
            <p className="text-sm text-stone-600">
              {gift.project.registry} {gift.project.registryId} · vintage {gift.project.vintage}
            </p>
          </section>

          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">On-chain record</h2>
            <dl className="mt-1 space-y-1 text-sm">
              <div>
                <dt className="text-stone-500">Network</dt>
                <dd className="font-mono">{r.chain}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Transaction</dt>
                <dd className="break-all font-mono text-xs">{r.txHash}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Block · Certificate #</dt>
                <dd className="font-mono">
                  {r.blockNumber.toLocaleString()} · {r.certTokenId}
                </dd>
              </div>
              <div>
                <dt className="text-stone-500">Serials retired</dt>
                <dd className="font-mono text-xs">{r.serialRange}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Retired at</dt>
                <dd>{r.retiredAt.toUTCString()}</dd>
              </div>
            </dl>
          </section>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-stone-200 bg-stone-50 px-8 py-5">
          <Link
            href={chain.explorerTxUrl(r.txHash)}
            className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
          >
            Verify on chain ↗
          </Link>
          {r.claimedBy ? (
            <span className="text-sm text-stone-600">
              NFT claimed by <code className="font-mono text-xs">{r.claimedBy}</code>
            </span>
          ) : canClaim ? (
            <ClaimForm slug={gift.slug} token={gift.claimToken} />
          ) : null}
        </div>
      </article>
    </div>
  );
}
