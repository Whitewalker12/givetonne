import { NextResponse } from "next/server";
import { createGift, giftInput } from "@/lib/gifts";

export async function POST(req: Request) {
  const parsed = giftInput.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  try {
    const gift = await createGift(parsed.data);
    return NextResponse.json({ id: gift.id });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
