import Link from "next/link";
import { prisma } from "@/lib/db";
import { chain } from "@/lib/chain";

export const dynamic = "force-dynamic";

/**
 * Mimics what a block explorer shows: the raw ledger entry, independent of our
 * database, then a cross-check that the two agree.
 */
export default async function VerifyPage({ params }: { params: Promise<{ txHash: string }> }) {
  const { txHash } = await params;
  const [onChain, record] = await Promise.all([
    chain.lookup(txHash),
    prisma.retirement.findUnique({ where: { txHash }, include: { gift: true } }),
  ]);

  const checks = onChain && record
    ? [
        ["Beneficiary", onChain.beneficiaryName === record.beneficiaryName],
        ["Tonnes", onChain.tonnes === record.tonnes],
        ["Serial range", onChain.serialRange === record.serialRange],
        ["Certificate id", onChain.certTokenId === record.certTokenId],
      ] as const
    : [];
  const allGood = checks.length > 0 && checks.every(([, ok]) => ok);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-xs font-medium uppercase tracking-widest text-stone-500">Chain explorer · {chain.name}</p>
      <h1 className="mt-2 break-all font-mono text-lg">{txHash}</h1>

      {!onChain ? (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          No retirement with this transaction hash exists on chain.
        </div>
      ) : (
        <>
          <div
            className={`mt-6 rounded-xl border p-4 ${
              allGood ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            <strong>{allGood ? "✓ Verified." : "⚠ Mismatch."}</strong>{" "}
            {allGood
              ? `${onChain.tonnes} tonnes retired for ${onChain.beneficiaryName}, and the on-chain record matches GiveTonne's.`
              : "The on-chain record and GiveTonne's record differ."}
          </div>

          <section className="mt-8">
            <h2 className="font-semibold">Ledger entry</h2>
            <pre className="mt-2 overflow-x-auto rounded-xl bg-stone-900 p-4 text-xs text-stone-100">
              {JSON.stringify(onChain, null, 2)}
            </pre>
          </section>

          <section className="mt-8">
            <h2 className="font-semibold">Cross-check against GiveTonne</h2>
            <ul className="mt-2 divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white text-sm">
              {checks.map(([label, ok]) => (
                <li key={label} className="flex justify-between px-4 py-2">
                  <span>{label}</span>
                  <span className={ok ? "text-emerald-700" : "text-red-600"}>{ok ? "match" : "mismatch"}</span>
                </li>
              ))}
              {!record ? <li className="px-4 py-2 text-stone-500">No matching gift in GiveTonne.</li> : null}
            </ul>
            {record ? (
              <Link href={`/gift/${record.gift.slug}`} className="mt-3 inline-block text-sm text-emerald-700 underline">
                View certificate →
              </Link>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
