# TableSplit — *Scan. Split. Pay.*

A QR-based, pay-at-table bill-splitting web app for restaurants, built for the
demo venue **Caffè Lumo** (a modern Italian restaurant in London).

Diners scan a permanent QR code on their table, see the live shared bill on
their own phone, tap the items they had (or split shared dishes), choose a
service charge, and pay their share — no app install, no logins, no card
details typed. Staff run a simple dashboard: a floor plan of tables, tap to
take an order, and reset a table when guests leave. Everything stays in sync
across phones in real time via Supabase.

> This is a demo build. Payment is **mocked** (no real money moves) and the
> database policies are deliberately open so anonymous diners can read and
> write. See **Known limitations** before using any of it in production.

---

## What's in the box

```
tablesplit/
├─ src/
│  ├─ app/
│  │  ├─ page.tsx                 Landing hub (links to staff + QR codes)
│  │  ├─ staff/page.tsx           Staff: password gate, floor plan, order entry, reset
│  │  ├─ qr/page.tsx              Printable QR code per table
│  │  └─ table/[id]/
│  │     ├─ layout.tsx            Holds each diner's claim state
│  │     ├─ page.tsx              The live diner bill (claim, split, service, pay)
│  │     └─ pay/page.tsx          Mock payment → receipt → review
│  ├─ components/                 Brand wordmark, spinner, success check
│  └─ lib/
│     ├─ types.ts                 Shared types (mirror of the DB schema)
│     ├─ supabaseClient.ts        Browser Supabase client
│     ├─ useTableSession.ts       Loads + live-subscribes a table's bill
│     ├─ ClaimContext.tsx         Per-phone "what's mine" + claim/split actions
│     └─ format.ts                Money formatting + bill maths
├─ supabase/
│  ├─ schema.sql                  Tables, the claim_delta() function, realtime, RLS
│  └─ seed.sql                    6 tables + the 12-item Caffè Lumo menu
└─ .env.local.example             Copy to .env.local and fill in
```

---

## Prerequisites

- **Node.js 18+** and npm
- A free **Supabase** project — <https://supabase.com>
- **ngrok** (or any tunnel) to put your laptop online so phones can scan —
  <https://ngrok.com>

---

## Setup

### 1. Install

```bash
npm install
```

### 2. Create the database

1. Create a new project at <https://supabase.com>.
2. Open the project's **SQL Editor**.
3. Paste and run **`supabase/schema.sql`** (creates the tables, the
   `claim_delta` function, turns on realtime, adds demo policies).
4. Paste and run **`supabase/seed.sql`** (loads the 6 tables and the menu).

### 3. Add your keys

```bash
cp .env.local.example .env.local
```

Then edit `.env.local` with the values from **Project Settings → API**:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
NEXT_PUBLIC_STAFF_PASSWORD=lumo2025
```

The anon key is meant to be public (it's used in the browser). Change the
staff password before any real demo.

### 4. Run it

```bash
npm run dev          # starts on http://localhost:3000
```

### 5. Put it online for phones

In a second terminal:

```bash
npm run tunnel       # = ngrok http 3000
```

ngrok prints an `https://…ngrok-free.app` URL. **Open that URL on your laptop**
(not `localhost`) — this matters for step 6.

### 6. Print the QR codes

Go to **`/qr`** *through the ngrok URL*. The codes encode the address you're
currently on, so opening this page via ngrok bakes the public URL into every
QR code. Print them (or just show one on screen) and scan with a phone.

> If you generated codes on `localhost` first, just reopen `/qr` on the ngrok
> URL and re-print — the codes regenerate against the new address.

---

## Try it in two minutes (demo script)

1. **Staff** — open `/staff`, enter the password (`lumo2025`). You'll see the
   floor plan: six tables, all *Empty*.
2. Tap **Table 4**. Add a few things from the menu — a couple of mains, a
   dessert, and a **Bottle of Chianti**. The tile turns gold ("Open bill").
3. **Diner phones** — scan Table 4's QR code on two or three phones (or open
   its `/table/<id>` URL in separate browser windows).
4. On phone A, tap your main and your dessert — watch the items tint and the
   "left" counts drop on the *other* phones instantly.
5. On any phone, tap **Share & split** on the Chianti and choose **3** — now
   each phone can **Claim a share** at a third of the price.
6. Each diner picks a **service charge** (12.5% is pre-selected) and taps
   **Pay**. Watch the spinner → success check → itemised receipt → review
   prompt.
7. Back on **staff**, Table 4 turns green ("Paid") once everyone's share is
   covered. Tap **Reset table** to clear it for the next guests.

Unclaimed items never block payment — diners only ever pay for what they tap.

---

## Routes

| Route             | Who    | What                                                |
| ----------------- | ------ | --------------------------------------------------- |
| `/`               | anyone | Landing hub                                         |
| `/staff`          | staff  | Password gate → floor plan, order entry, reset      |
| `/qr`             | staff  | One printable QR code per table                     |
| `/table/[id]`     | diner  | Live bill: claim, split, service charge, pay        |
| `/table/[id]/pay` | diner  | Mock payment, receipt, review                       |

---

## How splitting works

Each phone keeps its own list of "what's mine" in local state — there are no
diner accounts. Claiming an item nudges a shared `claimed_qty` on that line
(via an atomic `claim_delta` database function, so two phones grabbing the
last unit can't over-claim), and realtime broadcasts the change to everyone.

- **Tap to claim** a whole item — you pay its full price.
- **Share & split** a single dish *N* ways — each share is `price ÷ N`, and up
  to *N* people can each claim one.
- **Split everything equally** — one tap claims your `1/N` of the entire bill.

Your service charge applies to *your* subtotal only, so different diners can
tip differently on the same table.

---

## Defaults chosen (spec Section 10)

The spec left a few things to decide on the day; these are the defaults baked
into the seed and config, all easy to change:

- **Venue name:** Caffè Lumo (edit `VENUE_NAME` in `src/lib/format.ts`)
- **Accent colour:** warm gold `#B08D57` (edit `tailwind.config.ts`)
- **Menu:** 12 items across starters / mains / desserts / drinks
  (edit `supabase/seed.sql`)
- **Staff password:** `lumo2025` (edit `NEXT_PUBLIC_STAFF_PASSWORD`)
- **Suggested service charge:** 12.5%
- **Tables:** 6

Brand and palette otherwise follow the spec's Section 6 exactly: deep Italian
green `#1F3D2B`, cream background `#F2EFE9`, Playfair Display for the brand and
headings, Inter for the UI, prices in tabular figures.

---

## Built as one app

The original spec splits the work across three people (A: staff + data, B:
diner claim/split, C: pay + polish). This is delivered as **one integrated
Next.js app** instead, but the seams still line up with those areas:

- **A** → `supabase/`, `src/app/staff`, `src/lib/types.ts`
- **B** → `src/app/table/[id]`, `useTableSession.ts`, `ClaimContext.tsx`
- **C** → `src/app/table/[id]/pay`, `src/app/qr`, the payment + review flow

---

## Known limitations

- **Mock payment.** Paying writes a `payments` row and shows a receipt; no
  payment provider is wired up.
- **Demo security.** Row-level security is open to the anon key so anonymous
  diners can read/write, and the staff "password" is a shared client-side
  gate. Neither is production-grade — real use needs proper auth and locked-
  down policies / a service role for writes.
- **Unclaimed items.** If diners leave items untapped, payment still goes
  through; staff settle the remainder manually (by design — see spec 4.3).
- **Last-unit races.** `claim_delta` clamps the shared total so it can't be
  over-claimed, but each phone's local "mine" is optimistic; in a genuine
  simultaneous tap on the very last unit, one phone may briefly show a claim
  that the database clamped. Fine for a demo, worth hardening for production.

---

## Scripts

```bash
npm run dev      # development server
npm run build    # production build
npm run start    # serve the production build
npm run lint     # lint
npm run tunnel   # ngrok http 3000
```
