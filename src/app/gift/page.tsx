import { prisma } from "@/lib/db";
import { GiftForm } from "@/components/GiftForm";

export const dynamic = "force-dynamic";

export default async function GiftPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project } = await searchParams;
  const projects = await prisma.project.findMany({
    where: { availableTonnes: { gt: 0 } },
    orderBy: { pricePerTonne: "asc" },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Send a gift</h1>
      <p className="mt-2 text-stone-600">Takes about a minute. The recipient doesn&apos;t need a wallet.</p>
      <div className="mt-8">
        <GiftForm projects={projects} initialProject={project} />
      </div>
    </div>
  );
}
