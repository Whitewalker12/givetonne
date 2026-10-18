# GiveTonne

Gift verified carbon credits to someone. The credits are permanently retired on-chain
in the recipient's name, and they get an emailed certificate anyone can verify.

![certificate](docs/certificate.png)

## What's in the MVP

- **Gift flow** — pick a project, tonnes, recipient + message, optional delivery date, pay by card.
- **On-chain retirement** — a `GiveTonneRetirements` smart contract records each retirement
  in the beneficiary's name and mints a certificate NFT they can claim to a wallet.
  Runs on Polygon (Amoy testnet by default) via `viem`; falls back to an in-database
  simulation when no wallet is configured.
- **Certificate page** — `/gift/:slug`, public, with a "Verify on chain" link.
- **Verify page** — `/verify/:txHash` reads the retirement back from the chain and
  cross-checks it against GiveTonne's own record.
- **Email** — receipt to the gifter, certificate to the recipient, now or on a chosen date
  (hourly Vercel cron). Through Resend; logged to `/admin` when no API key is set.
- **Admin** — inventory, revenue, margin, recent gifts, email log.
- **Payments** — simulated card checkout (Luhn + Stripe-style test numbers). Swap for Stripe
  in `src/lib/payments.ts`.

## Run locally

```bash
npm install
npm run db:dev        # starts a local Postgres (Prisma dev server); paste its URL into .env as DATABASE_URL
npm run db:setup      # creates tables and seeds four projects
npm run dev           # http://localhost:3000
```

Test cards: `4242 4242 4242 4242` succeeds, `4000 0000 0000 0002` is declined.
Any `MM/YY` expiry and 3-digit CVC.

With no `CHAIN_*` or `RESEND_*` env vars the app uses the simulated chain and logs
emails to `/admin`. Everything else behaves exactly as in production.

## Go live — checklist

1. **Database** — any Postgres. On Vercel: *Storage → Create Database → Neon*; it sets
   `DATABASE_URL`. The `vercel-build` script pushes the schema and seeds projects on deploy.
2. **Blockchain (Polygon Amoy testnet)**
   1. Create a fresh wallet (MetaMask → new account → export private key). This is the
      backend's *operator* wallet; it signs every retirement. Never reuse a personal wallet.
   2. Get free test MATIC: https://faucet.polygon.technology (network: Amoy).
   3. Deploy the contract once:
      ```bash
      CHAIN_RPC_URL=https://rpc-amoy.polygon.technology CHAIN_OPERATOR_KEY=0x... npm run chain:deploy
      ```
      It prints `CHAIN_CONTRACT_ADDRESS=0x...`.
   4. Set env vars on the host: `CHAIN_ADAPTER=evm`, `CHAIN_ID=80002`, `CHAIN_RPC_URL`,
      `CHAIN_OPERATOR_KEY`, `CHAIN_CONTRACT_ADDRESS`. Certificates now link to
      amoy.polygonscan.com.
   5. Mainnet later: `CHAIN_ID=137`, a mainnet RPC, real MATIC in the operator wallet,
      redeploy the contract.
3. **Email** — sign up at resend.com, create an API key, set `RESEND_API_KEY`. To send from
   your own domain, verify it in Resend and set `EMAIL_FROM="GiveTonne <hello@yourdomain>"`.
   Set `APP_URL` to the public site URL so email links are right (Vercel fills a fallback).
4. **Cron** — `vercel.json` schedules `/api/cron/deliver` hourly. Vercel sets `CRON_SECRET`
   automatically; the route rejects calls without it.

See `.env.example` for every variable.

## Where the real credits come from

The contract is the public, beneficiary-named *record*. The credits themselves have to be
sourced and retired at a registry. Two routes, both behind the same `ChainAdapter` interface:

- **Tokenized credits (recommended)** — buy TCO2/NCT via Toucan / KlimaDAO on Polygon with the
  operator wallet and call their retirement aggregator with `beneficiaryName` + message; store
  that tx alongside ours. Fully on-chain, no paperwork.
- **Registry retirement** — buy credits from a broker, retire them on Verra / Gold Standard in
  the recipient's name, and pass the registry serial range into `retire()` as `serialRange`.

Until one of those is wired in, `serialRange` on-chain is a placeholder and the app sells
from a seeded inventory (`Project.availableTonnes`).

## Layout

```
contracts/GiveTonneRetirements.sol   retirement registry + certificate NFT
scripts/compile-contract.ts          solc → src/lib/chain/GiveTonneRetirements.ts (checked in)
scripts/deploy-contract.ts           npm run chain:deploy
prisma/schema.prisma                 Project, Gift, Retirement, EmailLog, MockLedgerEntry
src/lib/chain/                       ChainAdapter: evm.ts (real), mock.ts (simulation)
src/lib/email.ts                     Resend / console delivery + templates
src/lib/payments.ts                  charge() — swap for Stripe
src/lib/gifts.ts                     createGift, payAndRetire, claimCertificate, deliverDue
src/app/                             pages + API routes (/api/gifts, /api/cron/deliver)
src/components/                      client forms
```
