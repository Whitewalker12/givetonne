"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CheckoutForm({ giftId }: { giftId: string }) {
  const router = useRouter();
  const [stage, setStage] = useState<"idle" | "charging" | "retiring">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setStage("charging");
    const body = Object.fromEntries(new FormData(e.currentTarget).entries());
    // The retirement starts as soon as the charge succeeds; flip the label on a timer
    // so the user sees both stages even though it's one request.
    const t = setTimeout(() => setStage("retiring"), 700);
    const res = await fetch(`/api/gifts/${giftId}/pay`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    clearTimeout(t);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Payment failed");
      setStage("idle");
      return;
    }
    router.push(`/gift/${json.slug}?from=checkout`);
  }

  const field =
    "mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 font-mono text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200";
  const busy = stage !== "idle";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-sm font-medium">
        Name on card
        <input name="name" required className={field} defaultValue="" />
      </label>
      <label className="block text-sm font-medium">
        Card number
        <input name="number" required inputMode="numeric" className={field} placeholder="4242 4242 4242 4242" />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm font-medium">
          Expiry
          <input name="exp" required className={field} placeholder="12/28" />
        </label>
        <label className="block text-sm font-medium">
          CVC
          <input name="cvc" required inputMode="numeric" className={field} placeholder="123" />
        </label>
      </div>
      <p className="text-xs text-stone-500">
        Demo mode: use <code>4242 4242 4242 4242</code> to succeed or <code>4000 0000 0000 0002</code> to see a decline.
      </p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-emerald-700 py-3 font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {stage === "idle" && "Pay and retire credits"}
        {stage === "charging" && "Charging card…"}
        {stage === "retiring" && "Retiring credits on-chain… (waiting for block)"}
      </button>
    </form>
  );
}
