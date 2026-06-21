"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTableSession } from "@/lib/useTableSession";
import { useClaims } from "@/lib/ClaimContext";
import { supabase } from "@/lib/supabaseClient";
import {
  SERVICE_OPTIONS,
  isFullyClaimed,
  money,
  round2,
  serviceAmount,
  VENUE_NAME,
} from "@/lib/format";
import { Brand } from "@/components/Brand";
import { Spinner } from "@/components/Feedback";
import Link from "next/link";
import type { SessionItem } from "@/lib/types";

const CATEGORY_ORDER = ["starter", "main", "dessert", "drink"] as const;
const CATEGORY_LABEL: Record<string, string> = {
  starter: "Starters",
  main: "Mains",
  dessert: "Desserts",
  drink: "Drinks",
};

export default function BillPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { table, session, items, payments, loading, error } = useTableSession(id);
  const claims = useClaims();
  const [catById, setCatById] = useState<Record<string, string>>({});

  // Category lives on menu_items (not session_items), so load it once to group
  // the diner's bill. Resilient to menu changes — no hardcoded names.
  useEffect(() => {
    supabase
      .from("menu_items")
      .select("id, category")
      .then(({ data }) => {
        const map: Record<string, string> = {};
        (data ?? []).forEach((m) => (map[m.id] = m.category));
        setCatById(map);
      });
  }, []);

  const menuCat = (item: SessionItem): string =>
    (item.menu_item_id && catById[item.menu_item_id]) || "main";

  // Pre-select the table's suggested service charge once the session loads.
  useEffect(() => {
    if (session && claims.servicePct === null) {
      claims.setServicePct(session.service_charge_default);
    }
  }, [session, claims]);

  // Release claims if the user leaves without paying.
  useEffect(() => {
    const release = () => {
      if (claims.payment) return; // already paid — keep the record
      const entries = Object.entries(claims.myClaims);
      if (!entries.length) return;
      const payload = JSON.stringify({
        claims: entries.map(([itemId, units]) => ({ itemId, delta: -units })),
      });
      navigator.sendBeacon("/api/unclaim", new Blob([payload], { type: "application/json" }));
    };
    window.addEventListener("pagehide", release);
    return () => window.removeEventListener("pagehide", release);
  }, [claims]);

  const subtotal = claims.mySubtotal(items);
  const pct = claims.servicePct ?? 0;
  const service = serviceAmount(subtotal, pct);
  const total = round2(subtotal + service);
  const hasClaimed = subtotal > 0;

  if (loading) {
    return (
      <Centered>
        <Spinner className="h-6 w-6 text-brand" />
        <p className="mt-3 text-sm text-muted">Loading your table…</p>
      </Centered>
    );
  }

  if (error) {
    return (
      <Centered>
        <p className="font-serif text-xl text-brand">Something went wrong</p>
        <p className="mt-2 max-w-xs text-sm text-muted">{error}</p>
      </Centered>
    );
  }

  if (!session) {
    return (
      <Centered>
        <Brand size="md" tagline />
        <p className="mt-8 font-serif text-2xl text-brand">
          {table?.name ?? "Your table"}
        </p>
        <p className="mt-2 max-w-xs text-sm text-muted">
          Your bill isn&apos;t open yet. Your server will add your order in a
          moment — this page updates by itself.
        </p>
        <Spinner className="mt-6 h-5 w-5 text-gold" />
      </Centered>
    );
  }

  // Once this diner has paid, don't show the claim list again — show a
  // confirmation with a link to their receipt instead.
  if (claims.payment) {
    return (
      <Centered>
        <Brand size="md" />
        <div className="mt-8 flex h-16 w-16 items-center justify-center rounded-full bg-brand text-3xl text-cream">
          ✓
        </div>
        <p className="mt-5 font-serif text-2xl font-semibold text-brand">
          You&apos;re all paid
        </p>
        <p className="mt-2 max-w-xs text-sm text-muted">
          Thanks! You&apos;ve already paid your share at {table?.name}.
        </p>
        <Link
          href={`/table/${id}/pay`}
          className="mt-6 rounded-btn bg-brand px-5 py-3 text-sm font-semibold text-cream shadow-soft"
        >
          View your receipt
        </Link>
      </Centered>
    );
  }

  return (
    <main className="mx-auto max-w-md px-5 pb-44 pt-8">
      {/* Header */}
      <header className="text-center">
        <Brand size="md" />
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
          {table?.name} · Live bill
        </p>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-brand">
          Tap what you had
        </h1>
        <p className="mt-2 text-sm text-muted">
          Only pay for what you ordered. Your picks sync across the table live.
        </p>
      </header>

      {/* Equal-split shortcut */}
      <EqualSplitBar items={items} hasPriorPayments={payments.length > 0} />

      {/* Items grouped by category */}
      <div className="mt-6 space-y-6">
        {CATEGORY_ORDER.map((cat) => {
          const group = items.filter((i) => menuCat(i) === cat);
          if (!group.length) return null;
          return (
            <section key={cat}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                {CATEGORY_LABEL[cat]}
              </p>
              <div className="space-y-2.5">
                {group.map((item) => (
                  <ItemCard key={item.id} item={item} hasPriorPayments={payments.length > 0} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Service charge */}
      <ServiceSelector
        pct={claims.servicePct}
        suggested={session.service_charge_default}
        onChange={claims.setServicePct}
      />

      {/* Sticky pay bar */}
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-cream/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur">
        <div className="mx-auto max-w-md">
          <div className="tnum flex items-baseline justify-between text-sm text-muted">
            <span>Your subtotal</span>
            <span>{money(subtotal)}</span>
          </div>
          <div className="tnum mt-1 flex items-baseline justify-between text-sm text-muted">
            <span>Service ({pct}%)</span>
            <span>{money(service)}</span>
          </div>
          <div className="tnum mt-1.5 flex items-baseline justify-between">
            <span className="font-serif text-lg font-semibold text-brand">
              Your total
            </span>
            <span className="font-serif text-2xl font-semibold text-brand">
              {money(total)}
            </span>
          </div>
          <button
            disabled={!hasClaimed}
            onClick={() => router.push(`/table/${id}/pay`)}
            className="mt-3 w-full rounded-btn bg-brand py-4 text-center text-base font-semibold text-cream shadow-soft transition active:scale-[0.99] disabled:opacity-40"
          >
            {hasClaimed ? `Pay ${money(total)}` : "Tap your items to pay"}
          </button>
        </div>
      </div>
    </main>
  );
}

// ── Equal-split bar ─────────────────────────────────────────────────────────
function EqualSplitBar({ items, hasPriorPayments }: { items: SessionItem[]; hasPriorPayments: boolean }) {
  const claims = useClaims();
  const [picking, setPicking] = useState(false);
  const [customN, setCustomN] = useState("");

  if (hasPriorPayments && !claims.equalSplitN) return null;

  const splitBy = (n: number) => {
    if (!Number.isFinite(n) || n < 2) return;
    claims.applyEqualSplit(items, Math.round(n));
    setPicking(false);
    setCustomN("");
  };

  if (claims.equalSplitN) {
    return (
      <div className="mt-5 flex items-center justify-between rounded-card border border-gold/40 bg-gold-soft px-4 py-3">
        <p className="text-sm font-medium text-ink">
          Splitting the whole bill {claims.equalSplitN} ways
        </p>
        <button
          onClick={() => claims.clearEqualSplit(items)}
          className="text-sm font-semibold text-brand underline-offset-2 hover:underline"
        >
          Undo
        </button>
      </div>
    );
  }

  return (
    <div className="mt-5">
      {picking ? (
        <div className="rounded-card border border-line bg-surface p-4 shadow-soft">
          <p className="text-sm font-medium text-ink">
            Split everything equally — how many of you?
          </p>
          <div className="mt-3 flex gap-2">
            {[2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                onClick={() => splitBy(n)}
                className="tnum flex-1 rounded-btn border border-line bg-cream py-2.5 text-sm font-semibold text-ink hover:border-brand hover:bg-brand-tint"
              >
                {n}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-muted">More than 6?</span>
            <input
              type="number"
              min={2}
              inputMode="numeric"
              value={customN}
              onChange={(e) => setCustomN(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && splitBy(Number(customN))}
              placeholder="e.g. 8"
              className="tnum w-20 rounded-btn border border-line bg-cream px-3 py-2 text-center outline-none focus:border-gold"
            />
            <button
              onClick={() => splitBy(Number(customN))}
              disabled={!customN || Number(customN) < 2}
              className="rounded-btn bg-brand px-3 py-2 text-sm font-semibold text-cream disabled:opacity-40"
            >
              Split
            </button>
          </div>
          <button
            onClick={() => {
              setPicking(false);
              setCustomN("");
            }}
            className="mt-2 w-full py-1 text-xs text-muted"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setPicking(true)}
          className="w-full rounded-card border border-dashed border-gold/50 bg-surface py-3 text-sm font-semibold text-brand transition hover:bg-gold-soft"
        >
          Split everything equally
        </button>
      )}
    </div>
  );
}

// ── Item card ───────────────────────────────────────────────────────────────
function ItemCard({ item, hasPriorPayments }: { item: SessionItem; hasPriorPayments: boolean }) {
  const claims = useClaims();
  const mine = claims.myUnits(item.id);
  const available = round2(item.qty - item.claimed_qty);
  const locked = claims.equalSplitN !== null;
  const split = item.split_count > 1;
  const shareSize = item.qty / Math.max(1, item.split_count);
  const myShares = split ? Math.round(mine / shareSize) : 0;
  const fully = isFullyClaimed(item);

  return (
    <div
      className={`rounded-card border p-4 transition ${
        mine > 0
          ? "border-brand bg-brand-tint"
          : "border-line bg-surface"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-ink">{item.name}</p>
          <p className="tnum mt-0.5 text-xs text-muted">
            {money(item.price)}
            {item.qty > 1 && ` · ${item.qty} ordered`}
          </p>
        </div>
        <div className="text-right">
          {mine > 0 && (
            <p className="tnum font-serif text-lg font-semibold text-brand">
              {(() => {
                const splitN = item.split_count > 1 ? item.split_count : (claims.equalSplitN ?? 1);
                if (splitN > 1) {
                  const myShares2 = Math.round(mine / (item.qty / splitN));
                  return money(round2((item.price / splitN) * myShares2));
                }
                return money(round2(item.price * mine));
              })()}
            </p>
          )}
          <p className="tnum text-[11px] text-muted">
            {fully
              ? "Fully claimed"
              : split
              ? `${item.split_count - Math.round(item.claimed_qty / shareSize)} of ${item.split_count} shares left`
              : `${available} of ${item.qty} left`}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-3">
        {locked ? (
          <p className="text-xs italic text-muted">
            Included in your equal split
          </p>
        ) : split ? (
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted">
              Split {item.split_count} ways ·{" "}
              <span className="tnum font-medium text-ink">
                {money(round2(item.price * shareSize))}
              </span>{" "}
              each
              {myShares > 0 && (
                <span className="tnum ml-1 text-brand">· you: {myShares}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {myShares > 0 && (
                <Stepper
                  label="−"
                  onClick={() => claims.unclaimShare(item)}
                />
              )}
              <button
                disabled={fully}
                onClick={() => claims.claimShare(item)}
                className="rounded-btn bg-brand px-3 py-1.5 text-xs font-semibold text-cream disabled:opacity-40"
              >
                Claim a share
              </button>
              {item.claimed_qty < 1e-6 && (
                <button
                  onClick={() => claims.setSplit(item, 1)}
                  aria-label="Undo split"
                  className="px-1 text-sm text-muted hover:text-brand"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <SplitPicker item={item} hasPriorPayments={hasPriorPayments} />
            <div className="flex items-center gap-2">
              {mine > 0 && (
                <Stepper label="−" onClick={() => claims.unclaimUnit(item)} />
              )}
              {mine > 0 && (
                <span className="tnum w-5 text-center text-sm font-semibold text-ink">
                  {mine}
                </span>
              )}
              <button
                disabled={available < 1}
                onClick={() => claims.claimUnit(item)}
                className="rounded-btn bg-brand px-4 py-1.5 text-sm font-semibold text-cream disabled:opacity-40"
              >
                {mine > 0 ? "+" : "This is mine"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SplitPicker({ item, hasPriorPayments }: { item: SessionItem; hasPriorPayments: boolean }) {
  const claims = useClaims();
  const [open, setOpen] = useState(false);

  // Lock splitting once anyone has claimed, split, or paid.
  if (item.claimed_qty > 1e-6 || item.split_count > 1 || hasPriorPayments) return <span />;

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-gold underline-offset-2 hover:underline"
      >
        Share &amp; split
      </button>
    );

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted">ways:</span>
      {[2, 3, 4].map((n) => (
        <button
          key={n}
          onClick={() => {
            claims.setSplit(item, n);
            setOpen(false);
          }}
          className="tnum h-6 w-6 rounded-full border border-line text-xs font-semibold text-ink hover:border-brand"
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function Stepper({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-full border border-brand/30 bg-surface text-base leading-none text-brand"
    >
      {label}
    </button>
  );
}

// ── Service selector ────────────────────────────────────────────────────────
function ServiceSelector({
  pct,
  suggested,
  onChange,
}: {
  pct: number | null;
  suggested: number;
  onChange: (n: number) => void;
}) {
  const isPreset = pct !== null && SERVICE_OPTIONS.includes(pct as never);
  const [custom, setCustom] = useState(!isPreset && pct !== null);

  return (
    <section className="mt-8">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
        Service charge
      </p>
      <div className="rounded-card border border-line bg-surface p-4 shadow-soft">
        <div className="flex flex-wrap gap-2">
          {SERVICE_OPTIONS.map((opt) => {
            const active = !custom && pct === opt;
            return (
              <button
                key={opt}
                onClick={() => {
                  setCustom(false);
                  onChange(opt);
                }}
                className={`tnum flex-1 rounded-btn px-2 py-2.5 text-sm font-semibold transition ${
                  active
                    ? "bg-gold text-white shadow-soft"
                    : "border border-line bg-cream text-ink hover:border-gold"
                }`}
              >
                {opt}%
                {opt === suggested && (
                  <span className="ml-1 text-[10px] font-medium opacity-70">
                    suggested
                  </span>
                )}
              </button>
            );
          })}
          <button
            onClick={() => setCustom(true)}
            className={`rounded-btn px-3 py-2.5 text-sm font-semibold transition ${
              custom
                ? "bg-gold text-white shadow-soft"
                : "border border-line bg-cream text-ink hover:border-gold"
            }`}
          >
            Custom
          </button>
        </div>
        {custom && (
          <div className="mt-3 flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={100}
              inputMode="decimal"
              placeholder="e.g. 8"
              defaultValue={pct ?? undefined}
              onChange={(e) => onChange(Number(e.target.value) || 0)}
              className="tnum w-24 rounded-btn border border-line bg-cream px-3 py-2 text-center outline-none focus:border-gold"
            />
            <span className="text-sm text-muted">% of your subtotal</span>
          </div>
        )}
      </div>
    </section>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      {children}
    </main>
  );
}
