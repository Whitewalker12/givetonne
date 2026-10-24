# GiveTonne

Gift verified carbon credits to someone. The credits are permanently retired on-chain
in the recipient's name, and they get an emailed certificate anyone can verify.

![certificate](docs/certificate.png)

## What's in the MVP

- **Gift flow** — pick a project, tonnes, recipient + message, optional delivery date, pay by card.
- **Real carbon credits, retired on-chain** — the operator wallet holds Toucan **NCT**
  (tokenized Verra credits). Each gift redeems NCT → TCO2, retires it, and mints a Toucan
  **RetirementCertificate NFT** in the recipient's name. Redemption fees are grossed up so the
  recipient always gets at least the tonnes the gifter paid for. Inventory is checked on-chain
  *before* the card is charged.
- **Two lighter modes** for development: `evm` writes to GiveTonne's own record contract
  (`GiveTonneRetirements.sol`, no credit asset behind it); the default simulation needs no
  wallet at all.
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
   `DATABASE_URL`. If that URL is the pooled one (host contains `-pooler`), append
   `&pgbouncer=true`. The `vercel-build` script pushes the schema and seeds projects on deploy.
2. **Blockchain — real credits via Toucan**
   1. Create a fresh wallet (MetaMask → new account → export private key). This is the
      backend's *operator* wallet; it signs every retirement. Never reuse a personal wallet.
   2. **Testnet (Celo Alfajores):** add the Alfajores network to MetaMask, get test CELO from
      https://faucet.celo.org, then test NCT from Toucan's faucet (docs.toucan.earth →
      Developers → Testnet faucets).
      **Mainnet (Polygon):** send MATIC for gas and buy NCT with USDC on Polygon (any DEX;
      Toucan's app at app.toucan.earth also works). ~1 NCT ≈ 1 tonne; price moves with the
      market, so reprice `Project.pricePerTonne` accordingly.
   3. Set env vars on the host: `CHAIN_ADAPTER=toucan`, `CHAIN_ID=44787` (or `137`),
      `CHAIN_RPC_URL`, `CHAIN_OPERATOR_KEY`. Pool/registry addresses are built in per network.
   4. `/admin` now shows how many tonnes the wallet can still retire. Top up NCT as it sells.

   *Alternative without buying credits yet* — `CHAIN_ADAPTER=evm` on Polygon Amoy: fund the
   wallet from https://faucet.polygon.technology, run
   `CHAIN_RPC_URL=https://rpc-amoy.polygon.technology CHAIN_OPERATOR_KEY=0x... npm run chain:deploy`,
   and set `CHAIN_ID=80002` + the printed `CHAIN_CONTRACT_ADDRESS`. This records retirements
   publicly but no real credit is cancelled.
3. **Email** — sign up at resend.com, create an API key, set `RESEND_API_KEY`. To send from
   your own domain, verify it in Resend and set `EMAIL_FROM="GiveTonne <hello@yourdomain>"`.
   Set `APP_URL` to the public site URL so email links are right (Vercel fills a fallback).
4. **Cron** — `vercel.json` schedules `/api/cron/deliver` hourly. Vercel sets `CRON_SECRET`
   automatically; the route rejects calls without it.

See `.env.example` for every variable.

## How the Toucan retirement works

```
operator wallet ──redeemAuto2(NCT)──▶ pool ──▶ TCO2 tokens (specific Verra vintage)
                ──retire(TCO2)──────▶ TCO2 burned; RetirementCertificates.registerEvent()
                ──mintCertificate(...)─▶ RetirementCertificate NFT: beneficiaryString = recipient,
                                          retirementMessage = gift message, events = what was burned
```

The certificate tx hash is what the gift page links to. `/verify` reads the certificate and its
retirement events straight from the chain and compares them with GiveTonne's record. The NFT
is minted to the operator and transferred to the recipient on claim.

The `Project` catalogue is still used for pricing and story; which *exact* vintage the pool hands
out is decided by Toucan's ranking (`redeemAuto2` picks the lowest-ranked eligible TCO2s). To pin
specific projects, switch to `redeemOutMany` with chosen TCO2 addresses.

Testing without a funded wallet: `contracts/testing/FakeToucan.sol` mirrors the Toucan
interfaces; `npx tsx scripts/deploy-fake-toucan.ts` deploys them to a local node and prints
the env vars.

## Layout

```
contracts/GiveTonneRetirements.sol   own retirement record + certificate NFT (evm mode)
contracts/testing/FakeToucan.sol     local stand-ins for Toucan (tests only)
scripts/compile-contract.ts          solc → typed ABI modules (checked in)
scripts/deploy-contract.ts           npm run chain:deploy (evm mode)
scripts/deploy-fake-toucan.ts        local Toucan test rig
prisma/schema.prisma                 Project, Gift, Retirement, EmailLog, MockLedgerEntry
src/lib/chain/                       ChainAdapter: toucan.ts (real credits), evm.ts, mock.ts
src/lib/email.ts                     Resend / console delivery + templates
src/lib/payments.ts                  charge() — swap for Stripe
src/lib/gifts.ts                     createGift, payAndRetire, claimCertificate, deliverDue
src/app/                             pages + API routes (/api/gifts, /api/cron/deliver)
src/components/                      client forms
```
