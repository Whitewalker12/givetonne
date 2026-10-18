# CarbonGift

Gift verified carbon credits to someone. The credits are permanently retired on-chain
in the recipient's name, and they get a shareable certificate anyone can verify.

**This is the demo build.** Payments and the blockchain are simulated so the full
product flow works end-to-end without real money or a funded wallet.

## Run it

```bash
npm install
npm run db:setup   # creates prisma/dev.db and seeds four projects
npm run dev        # http://localhost:3000
```

Test cards: `4242 4242 4242 4242` succeeds, `4000 0000 0000 0002` is declined.
Any expiry in `MM/YY` form and any 3-digit CVC.

## Flow

1. `/` — landing, project catalogue
2. `/gift` — pick project, tonnes, recipient name + message
3. `/checkout/:id` — card payment → credits retired → redirect to certificate
4. `/gift/:slug` — public certificate. `?claim=<token>` (shown once after checkout) also offers the NFT claim
5. `/verify/:txHash` — "block explorer" view: raw ledger entry cross-checked against the app database
6. `/admin` — inventory, revenue, margin, recent gifts

## How the simulation works, and what changes for production

| Piece | Demo | Production |
|---|---|---|
| Chain | `src/lib/chain/mock.ts` — append-only ledger in `.mockchain/ledger.json`, deterministic tx hashes, fake block delay | `ToucanChain` on Polygon calling the Toucan/KlimaDAO retirement aggregator with `beneficiaryName` + `retirementMessage`; read the retirement certificate NFT id from the event |
| Credits | Seeded `Project` rows with `availableTonnes` | Pre-bought TCO2/NCT held in a backend wallet, or buy-on-demand per gift |
| Payments | `src/lib/payments.ts` — Luhn check + Stripe-style test numbers | Stripe PaymentIntent; retire from the `payment_intent.succeeded` webhook |
| DB | SQLite via Prisma | Postgres (change `provider` in `prisma/schema.prisma`) |
| Email | none | send certificate link to recipient on delivery / scheduled date |

Only `src/lib/chain/index.ts` and `src/lib/payments.ts` need to change for the swap;
the pages and `src/lib/gifts.ts` are adapter-agnostic.

## Layout

```
prisma/schema.prisma      Project, Gift, Retirement
prisma/seed.ts            sample projects
src/lib/chain/            ChainAdapter interface + MockChain
src/lib/payments.ts       charge()
src/lib/gifts.ts          createGift, payAndRetire, claimCertificate, pricing
src/app/                  pages + API routes
src/components/           client forms (gift, checkout, claim)
```
