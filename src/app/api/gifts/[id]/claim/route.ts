import { NextResponse } from "next/server";
import { z } from "zod";
import { claimCertificate } from "@/lib/gifts";

const claimInput = z.object({ token: z.string().min(1), wallet: z.string().trim() });

/** `id` here is the gift slug, since the claim link is built from the certificate URL. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: slug } = await params;
  const parsed = claimInput.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try {
    await claimCertificate(slug, parsed.data.token, parsed.data.wallet);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
