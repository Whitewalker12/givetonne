import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/gifts";
import { chain } from "@/lib/chain";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  delivered: "bg-emerald-100 text-emerald-800",
  pending_payment: "bg-stone-100 text-stone-700",
  retiring: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-800",
};

export default async function AdminPage() {
  const [projects, gifts, emails, inventory] = await Promise.all([
    prisma.project.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { gifts: true } } } }),
    prisma.gift.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { project: true, retirement: true } }),
    prisma.emailLog.findMany({ orderBy: { sentAt: "desc" }, take: 30, include: { gift: { select: { slug: true } } } }),
    chain.inventoryTonnes?.().catch(() => null) ?? Promise.resolve(null),
  ]);
  const delivered = gifts.filter((g) => g.status === "delivered");
  const revenue = delivered.reduce((s, g) => s + g.amountCents, 0);
  const cogs = delivered.reduce((s, g) => s + Math.round(g.project.pricePerTonne * g.tonnes), 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        {[
          ["Gifts delivered", String(delivered.length)],
          ["Tonnes retired", delivered.reduce((s, g) => s + g.tonnes, 0).toFixed(1)],
          ["Revenue", formatMoney(revenue)],
          ["Margin", formatMoney(revenue - cogs)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wider text-stone-500">{label}</div>
            <div className="mt-1 text-2xl font-semibold">{value}</div>
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-xl font-semibold">Credit inventory</h2>
      <p className="mt-1 text-sm text-stone-500">
        Chain: <span className="font-mono">{chain.name}</span>
        {inventory !== null ? <> · operator wallet can retire <strong>{inventory.toFixed(3)} t</strong> right now</> : null}
      </p>
      <table className="mt-3 w-full overflow-hidden rounded-xl border border-stone-200 bg-white text-sm">
        <thead className="bg-stone-50 text-left text-xs uppercase tracking-wider text-stone-500">
          <tr>
            <th className="px-4 py-2">Project</th>
            <th className="px-4 py-2">Registry</th>
            <th className="px-4 py-2 text-right">Price / t</th>
            <th className="px-4 py-2 text-right">Available t</th>
            <th className="px-4 py-2 text-right">Gifts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {projects.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-2">{p.imageEmoji} {p.name}</td>
              <td className="px-4 py-2 text-stone-600">{p.registry} {p.registryId}</td>
              <td className="px-4 py-2 text-right">{formatMoney(p.pricePerTonne)}</td>
              <td className="px-4 py-2 text-right">{p.availableTonnes}</td>
              <td className="px-4 py-2 text-right">{p._count.gifts}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mt-10 text-xl font-semibold">Recent gifts</h2>
      <table className="mt-3 w-full overflow-hidden rounded-xl border border-stone-200 bg-white text-sm">
        <thead className="bg-stone-50 text-left text-xs uppercase tracking-wider text-stone-500">
          <tr>
            <th className="px-4 py-2">When</th>
            <th className="px-4 py-2">From → To</th>
            <th className="px-4 py-2">Project</th>
            <th className="px-4 py-2 text-right">t</th>
            <th className="px-4 py-2 text-right">Paid</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Tx</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {gifts.map((g) => (
            <tr key={g.id}>
              <td className="whitespace-nowrap px-4 py-2 text-stone-600">{g.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
              <td className="px-4 py-2">
                {g.giverName} → <Link href={`/gift/${g.slug}`} className="underline">{g.recipientName}</Link>
              </td>
              <td className="px-4 py-2">{g.project.name}</td>
              <td className="px-4 py-2 text-right">{g.tonnes}</td>
              <td className="px-4 py-2 text-right">{formatMoney(g.amountCents)}</td>
              <td className="px-4 py-2">
                <span className={`rounded-full px-2 py-0.5 text-xs ${statusColor[g.status] ?? ""}`}>{g.status}</span>
                {g.status === "delivered" && !g.deliveredAt && g.deliverAt ? (
                  <span className="ml-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-800">
                    email {g.deliverAt.toISOString().slice(0, 10)}
                  </span>
                ) : null}
              </td>
              <td className="px-4 py-2 font-mono text-xs">
                {g.retirement ? (
                  <Link href={`/verify/${g.retirement.txHash}`} className="underline">
                    {g.retirement.txHash.slice(0, 10)}…
                  </Link>
                ) : "—"}
              </td>
            </tr>
          ))}
          {gifts.length === 0 ? (
            <tr><td colSpan={7} className="px-4 py-6 text-center text-stone-500">No gifts yet.</td></tr>
          ) : null}
        </tbody>
      </table>

      <h2 className="mt-10 text-xl font-semibold">Emails</h2>
      <p className="mt-1 text-sm text-stone-500">
        {process.env.RESEND_API_KEY ? "Sending through Resend." : "No RESEND_API_KEY set — emails are logged here instead of sent."}
      </p>
      <table className="mt-3 w-full overflow-hidden rounded-xl border border-stone-200 bg-white text-sm">
        <thead className="bg-stone-50 text-left text-xs uppercase tracking-wider text-stone-500">
          <tr>
            <th className="px-4 py-2">When</th>
            <th className="px-4 py-2">Kind</th>
            <th className="px-4 py-2">To</th>
            <th className="px-4 py-2">Subject</th>
            <th className="px-4 py-2">Via</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {emails.map((e) => (
            <tr key={e.id}>
              <td className="whitespace-nowrap px-4 py-2 text-stone-600">{e.sentAt.toISOString().slice(0, 16).replace("T", " ")}</td>
              <td className="px-4 py-2">{e.kind}</td>
              <td className="px-4 py-2">{e.to}</td>
              <td className="px-4 py-2"><Link href={`/gift/${e.gift.slug}`} className="underline">{e.subject}</Link></td>
              <td className="px-4 py-2 text-stone-600">{e.provider}</td>
            </tr>
          ))}
          {emails.length === 0 ? (
            <tr><td colSpan={5} className="px-4 py-6 text-center text-stone-500">No emails yet.</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
