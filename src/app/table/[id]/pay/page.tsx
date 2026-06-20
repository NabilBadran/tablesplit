"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTableSession } from "@/lib/useTableSession";
import { useClaims } from "@/lib/ClaimContext";
import { supabase } from "@/lib/supabaseClient";
import { money, round2, serviceAmount, VENUE_NAME } from "@/lib/format";
import { Brand } from "@/components/Brand";
import { Spinner, SuccessCheck } from "@/components/Feedback";
import type { Payment } from "@/lib/types";

type Stage = "processing" | "success" | "receipt" | "review";

export default function PayPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { table, session, items } = useTableSession(id);
  const claims = useClaims();
  const [stage, setStage] = useState<Stage>(
    claims.payment ? "receipt" : "processing"
  );
  const started = useRef(false);

  // Receipt lines from this phone's claims (persist after paying).
  const lines = useMemo(
    () =>
      items
        .filter((i) => claims.myUnits(i.id) > 0)
        .map((i) => ({
          id: i.id,
          name: i.name,
          units: claims.myUnits(i.id),
          amount: round2(i.price * claims.myUnits(i.id)),
        })),
    [items, claims]
  );

  const subtotal = claims.mySubtotal(items);
  const pct = claims.servicePct ?? 0;
  const service = serviceAmount(subtotal, pct);
  const total = round2(subtotal + service);

  // Run the mock payment once.
  useEffect(() => {
    if (started.current) return;
    if (claims.payment) return; // already paid, showing receipt
    if (!session || subtotal <= 0) {
      router.replace(`/table/${id}`); // nothing to pay
      return;
    }
    started.current = true;

    const run = async () => {
      await wait(1500); // mimic processing
      const { data, error } = await supabase
        .from("payments")
        .insert({
          session_id: session.id,
          item_ids: lines.map((l) => l.id),
          subtotal,
          service_charge_pct: pct,
          service_charge_amount: service,
          total,
          status: "paid",
        })
        .select()
        .single();
      if (error) {
        console.error("[TableSplit] payment failed", error);
        started.current = false;
        router.replace(`/table/${id}`);
        return;
      }
      claims.setPayment(data as Payment);
      setStage("success");
      await wait(1300);
      setStage("receipt");
    };
    run();
  }, [session, subtotal, lines, pct, service, total, claims, id, router]);

  if (stage === "processing" || stage === "success") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
        {stage === "processing" ? (
          <>
            <Spinner className="h-9 w-9 text-brand" />
            <p className="mt-5 font-serif text-xl text-brand">
              Taking your payment…
            </p>
            <p className="tnum mt-1 text-sm text-muted">{money(total)}</p>
          </>
        ) : (
          <>
            <SuccessCheck />
            <p className="mt-6 font-serif text-2xl font-semibold text-brand">
              Paid
            </p>
            <p className="tnum mt-1 text-sm text-muted">{money(total)}</p>
          </>
        )}
      </main>
    );
  }

  if (stage === "review") {
    return <ReviewScreen tableId={id} />;
  }

  // Receipt
  const paid = claims.payment;
  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <div className="animate-fade-up flex flex-col items-center text-center">
        <SuccessCheck />
        <h1 className="mt-5 font-serif text-3xl font-semibold text-brand">
          All paid
        </h1>
        <p className="mt-1 text-sm text-muted">
          {table?.name} · {VENUE_NAME}
        </p>
      </div>

      <div className="mt-8 rounded-card border border-line bg-surface p-5 shadow-soft">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
          Your receipt
        </p>
        <ul className="mt-3 divide-y divide-line">
          {lines.map((l) => (
            <li key={l.id} className="flex justify-between py-2 text-sm">
              <span className="text-ink">
                {l.name}
                {l.units !== 1 && (
                  <span className="tnum ml-1 text-muted">
                    × {Number.isInteger(l.units) ? l.units : l.units.toFixed(2)}
                  </span>
                )}
              </span>
              <span className="tnum font-medium text-ink">
                {money(l.amount)}
              </span>
            </li>
          ))}
        </ul>
        <div className="tnum mt-3 space-y-1.5 border-t border-line pt-3 text-sm">
          <Row label="Subtotal" value={money(subtotal)} />
          <Row label={`Service (${pct}%)`} value={money(service)} />
          <div className="flex justify-between pt-1.5">
            <span className="font-serif text-lg font-semibold text-brand">
              Total paid
            </span>
            <span className="font-serif text-xl font-semibold text-brand">
              {money(paid?.total ?? total)}
            </span>
          </div>
        </div>
        <p className="mt-4 text-center text-[11px] text-muted">
          Mock payment · no card was charged · {refLabel(paid)}
        </p>
      </div>

      <button
        onClick={() => setStage("review")}
        className="mt-6 w-full rounded-btn bg-brand py-4 text-base font-semibold text-cream shadow-soft active:scale-[0.99]"
      >
        Leave a review
      </button>
      <Link
        href={`/table/${id}`}
        className="mt-3 block text-center text-sm font-medium text-muted"
      >
        Back to the bill
      </Link>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted">
      <span>{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}

function refLabel(p: Payment | null) {
  if (!p) return "ref —";
  return `ref ${p.id.slice(0, 8).toUpperCase()}`;
}

// ── Fake Google-style review ────────────────────────────────────────────────
function ReviewScreen({ tableId }: { tableId: string }) {
  const [stars, setStars] = useState(5);
  const [text, setText] = useState("");
  const [posted, setPosted] = useState(false);

  if (posted) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="animate-scale-in text-5xl">🌿</div>
        <h1 className="mt-4 font-serif text-2xl font-semibold text-brand">
          Grazie!
        </h1>
        <p className="mt-2 max-w-xs text-sm text-muted">
          Thanks for reviewing {VENUE_NAME}. (Demo only — nothing was posted.)
        </p>
        <Link
          href={`/table/${tableId}`}
          className="mt-8 rounded-btn border border-line bg-surface px-5 py-3 text-sm font-semibold text-brand"
        >
          Done
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <div className="rounded-card border border-line bg-surface p-6 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand font-serif text-lg text-cream">
            L
          </div>
          <div>
            <p className="font-semibold text-ink">{VENUE_NAME}</p>
            <p className="text-xs text-muted">Modern Italian · London</p>
          </div>
        </div>

        <p className="mt-5 text-sm text-muted">How was everything?</p>
        <div className="mt-2 flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setStars(n)}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              className="text-3xl leading-none transition active:scale-90"
              style={{ color: n <= stars ? "#B08D57" : "#E6E1D7" }}
            >
              ★
            </button>
          ))}
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Share a few words about your visit…"
          className="mt-4 w-full resize-none rounded-btn border border-line bg-cream px-4 py-3 text-sm outline-none focus:border-gold"
        />

        <button
          onClick={() => setPosted(true)}
          className="mt-4 w-full rounded-btn bg-brand py-3.5 font-semibold text-cream active:scale-[0.99]"
        >
          Post review
        </button>
        <p className="mt-3 text-center text-[11px] text-muted">
          Mock review screen for the demo — links would point to your Google
          Business profile.
        </p>
      </div>
    </main>
  );
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
