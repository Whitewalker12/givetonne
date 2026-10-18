"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ClaimForm({ slug, token }: { slug: string; token: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const wallet = String(new FormData(e.currentTarget).get("wallet") ?? "");
    const res = await fetch(`/api/gifts/${slug}/claim`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, wallet }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Claim failed");
      setBusy(false);
      return;
    }
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium hover:bg-stone-50"
      >
        Claim certificate NFT to a wallet (optional)
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-stone-200 bg-white p-4">
      <label className="block text-sm font-medium">
        Your wallet address
        <input
          name="wallet"
          required
          placeholder="0x…"
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-sm"
        />
      </label>
      <p className="mt-1 text-xs text-stone-500">
        The certificate NFT will be transferred to this address. The retirement itself stays in your name either way.
      </p>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? "Transferring…" : "Claim"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-3 text-sm text-stone-600">
          Cancel
        </button>
      </div>
    </form>
  );
}
