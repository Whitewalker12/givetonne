import { NextResponse } from "next/server";
import { deliverDue } from "@/lib/gifts";

/**
 * Sends certificate emails whose deliverAt has arrived. Vercel Cron calls this
 * hourly (see vercel.json) with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sent = await deliverDue();
  return NextResponse.json({ sent });
}
