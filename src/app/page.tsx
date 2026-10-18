import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/gifts";

export const dynamic = "force-dynamic";

const steps = [
  ["Pick a project", "Choose a verified project — forests, cookstoves, mangroves — and how many tonnes to offset."],
  ["Write the card", "Add the recipient's name and a message. Pay by card; no crypto needed."],
  ["We retire the credits", "The credits are permanently retired on-chain in their name. It can't be undone or resold."],
  ["They get the certificate", "A shareable certificate page with the transaction hash. Anyone can verify it, and they can claim the NFT if they want."],
];

export default async function Home() {
  const [projects, delivered] = await Promise.all([
    prisma.project.findMany({ orderBy: { pricePerTonne: "asc" } }),
    prisma.gift.aggregate({ where: { status: "delivered" }, _sum: { tonnes: true }, _count: true }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4">
      <section className="py-20 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-emerald-700">
          The gift that disappears from the atmosphere
        </p>
        <h1 className="mx-auto mt-4 max-w-3xl text-5xl font-semibold tracking-tight">
          Give a tonne of CO₂, retired in their name.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-stone-600">
          Verified carbon credits, permanently retired on a public blockchain with your
          recipient&apos;s name on the record. A gift they can verify, share, and keep forever.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/gift"
            className="rounded-full bg-emerald-700 px-6 py-3 font-medium text-white hover:bg-emerald-800"
          >
            Send a gift
          </Link>
          <Link
            href="#how"
            className="rounded-full border border-stone-300 px-6 py-3 font-medium hover:bg-white"
          >
            How it works
          </Link>
        </div>
        <p className="mt-6 text-sm text-stone-500">
          {delivered._count} gifts sent · {(delivered._sum.tonnes ?? 0).toFixed(1)} tonnes retired
        </p>
      </section>

      <section id="how" className="py-12">
        <h2 className="text-2xl font-semibold">How it works</h2>
        <ol className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(([title, body], i) => (
            <li key={title} className="rounded-2xl border border-stone-200 bg-white p-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800">
                {i + 1}
              </div>
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-stone-600">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="py-12">
        <h2 className="text-2xl font-semibold">Projects</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/gift?project=${p.id}`}
              className="group rounded-2xl border border-stone-200 bg-white p-5 transition hover:border-emerald-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between">
                <span className="text-4xl">{p.imageEmoji}</span>
                <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium">
                  {formatMoney(p.pricePerTonne)} / tonne
                </span>
              </div>
              <h3 className="mt-3 text-lg font-semibold group-hover:text-emerald-800">{p.name}</h3>
              <p className="text-sm text-stone-500">
                {p.type} · {p.location} · {p.registry} {p.registryId}
              </p>
              <p className="mt-2 text-sm text-stone-600">{p.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
