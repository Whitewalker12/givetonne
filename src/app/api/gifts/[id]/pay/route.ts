import { NextResponse } from "next/server";
import { z } from "zod";
import { payAndRetire } from "@/lib/gifts";

const cardInput = z.object({
  name: z.string().trim().min(1),
  number: z.string().trim().min(13),
  exp: z.string().trim(),
  cvc: z.string().trim(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = cardInput.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Please fill in all card details." }, { status: 400 });
  }
  try {
    const result = await payAndRetire(id, parsed.data);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 402 });
    return NextResponse.json({ slug: result.slug });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
