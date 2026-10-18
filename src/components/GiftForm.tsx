"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney, quote } from "@/lib/pricing";

type Project = {
  id: string;
  name: string;
  location: string;
  type: string;
  pricePerTonne: number;
  imageEmoji: string;
  availableTonnes: number;
};

const presets = [0.5, 1, 2, 5, 10];

export function GiftForm({ projects, initialProject }: { projects: Project[]; initialProject?: string }) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(initialProject ?? projects[0]?.id ?? "");
  const [tonnes, setTonnes] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const project = useMemo(() => projects.find((p) => p.id === projectId), [projects, projectId]);
  const price = project ? quote(project.pricePerTonne, tonnes) : null;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const body = Object.fromEntries(form.entries());
    const res = await fetch("/api/gifts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, projectId, tonnes }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Something went wrong");
      setBusy(false);
      return;
    }
    router.push(`/checkout/${json.id}`);
  }

  const field =
    "mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200";

  return (
    <form onSubmit={onSubmit} className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-8">
        <fieldset>
          <legend className="text-lg font-semibold">1. Choose a project</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {projects.map((p) => (
              <label
                key={p.id}
                className={`cursor-pointer rounded-xl border p-4 transition ${
                  p.id === projectId ? "border-emerald-600 bg-emerald-50" : "border-stone-200 bg-white hover:border-stone-300"
                }`}
              >
                <input
                  type="radio"
                  name="project"
                  value={p.id}
                  checked={p.id === projectId}
                  onChange={() => setProjectId(p.id)}
                  className="sr-only"
                />
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{p.imageEmoji}</span>
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-stone-500">
                      {p.type} · {p.location} · {formatMoney(p.pricePerTonne)}/t
                    </div>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-lg font-semibold">2. How much CO₂?</legend>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {presets.map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => setTonnes(t)}
                className={`rounded-full border px-4 py-1.5 text-sm ${
                  tonnes === t ? "border-emerald-600 bg-emerald-600 text-white" : "border-stone-300 bg-white"
                }`}
              >
                {t} t
              </button>
            ))}
            <input
              type="number"
              min={0.5}
              max={100}
              step={0.5}
              value={tonnes}
              onChange={(e) => setTonnes(Number(e.target.value))}
              className="w-24 rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
            />
          </div>
          <p className="mt-2 text-xs text-stone-500">
            1 tonne ≈ a round-trip flight London → New York, or 4,000 km of driving.
          </p>
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="text-lg font-semibold">3. Who is it for?</legend>
          <label className="text-sm font-medium sm:col-span-2">
            Recipient&apos;s name <span className="text-stone-400">(goes on the blockchain record)</span>
            <input name="recipientName" required maxLength={80} className={field} placeholder="Priya Sharma" />
          </label>
          <label className="text-sm font-medium sm:col-span-2">
            Message
            <textarea
              name="message"
              maxLength={280}
              rows={3}
              className={field}
              placeholder="Happy birthday! A tonne of CO₂ gone, in your name."
            />
          </label>
          <label className="text-sm font-medium">
            Recipient&apos;s email <span className="text-stone-400">(optional)</span>
            <input name="recipientEmail" type="email" className={field} />
          </label>
          <div />
          <label className="text-sm font-medium">
            Your name
            <input name="giverName" required maxLength={80} className={field} />
          </label>
          <label className="text-sm font-medium">
            Your email
            <input name="giverEmail" type="email" required className={field} />
          </label>
        </fieldset>
      </div>

      <aside className="h-fit rounded-2xl border border-stone-200 bg-white p-5 lg:sticky lg:top-6">
        <h2 className="font-semibold">Summary</h2>
        {project && price ? (
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-stone-600">
                {tonnes} t · {project.name}
              </dt>
              <dd>{formatMoney(price.credits)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-600">Platform fee (10%)</dt>
              <dd>{formatMoney(price.fee)}</dd>
            </div>
            <div className="flex justify-between border-t border-stone-200 pt-2 font-semibold">
              <dt>Total</dt>
              <dd>{formatMoney(price.total)}</dd>
            </div>
          </dl>
        ) : null}
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={busy || !project}
          className="mt-4 w-full rounded-full bg-emerald-700 py-3 font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Continue to payment"}
        </button>
      </aside>
    </form>
  );
}
