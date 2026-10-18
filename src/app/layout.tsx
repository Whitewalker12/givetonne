import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "CarbonGift — gift a tonne of CO₂, retired in their name",
  description:
    "Give verified carbon credits as a gift. Retired on-chain in the recipient's name, with a certificate anyone can verify.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-stone-50 text-stone-900">
        <header className="border-b border-stone-200 bg-white/80 backdrop-blur">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              🌱 CarbonGift
            </Link>
            <div className="flex items-center gap-5 text-sm text-stone-600">
              <Link href="/#how" className="hover:text-stone-900">How it works</Link>
              <Link href="/admin" className="hover:text-stone-900">Admin</Link>
              <Link
                href="/gift"
                className="rounded-full bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800"
              >
                Send a gift
              </Link>
            </div>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-stone-200 py-6 text-center text-xs text-stone-500">
          Demo build · retirements run on a simulated chain · no real money moves
        </footer>
      </body>
    </html>
  );
}
