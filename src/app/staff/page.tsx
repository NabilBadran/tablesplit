"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase, STAFF_PASSWORD } from "@/lib/supabaseClient";
import {
  billTotal,
  isSettled,
  lineTotal,
  money,
  paidValue,
  VENUE_NAME,
} from "@/lib/format";
import { Brand } from "@/components/Brand";
import type { MenuItem, Payment, Session, SessionItem, Table } from "@/lib/types";

const CATEGORY_ORDER = ["starter", "main", "dessert", "drink"] as const;
const CATEGORY_LABEL: Record<string, string> = {
  starter: "Starters",
  main: "Mains",
  dessert: "Desserts",
  drink: "Drinks",
};

type TableStatus = "empty" | "open" | "settled";

export default function StaffPage() {
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("ts_staff") === "1") setUnlocked(true);
  }, []);

  if (!unlocked) return <Gate onUnlock={() => setUnlocked(true)} />;
  return <Dashboard />;
}

// ── Password gate ───────────────────────────────────────────────────────────
function Gate({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState("");
  const [wrong, setWrong] = useState(false);

  const submit = () => {
    if (value === STAFF_PASSWORD) {
      sessionStorage.setItem("ts_staff", "1");
      onUnlock();
    } else {
      setWrong(true);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-6">
      <Brand size="lg" tagline />
      <h1 className="mt-8 font-serif text-2xl font-semibold text-brand">
        Staff dashboard
      </h1>
      <p className="mt-2 text-sm text-muted">Enter the shared password.</p>
      <input
        type="password"
        autoFocus
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setWrong(false);
        }}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Password"
        className="mt-6 w-full rounded-btn border border-line bg-surface px-4 py-3 text-center text-lg tracking-widest outline-none focus:border-brand"
      />
      {wrong && (
        <p className="mt-3 text-sm text-gold">That password didn&apos;t match.</p>
      )}
      <button
        onClick={submit}
        className="mt-5 w-full rounded-btn bg-brand px-5 py-3 font-semibold text-cream shadow-soft active:scale-[0.99]"
      >
        Unlock
      </button>
      <Link href="/" className="mt-6 text-xs text-muted">
        ← Back home
      </Link>
    </main>
  );
}

// ── Dashboard ───────────────────────────────────────────────────────────────
interface TableState {
  table: Table;
  session: Session | null;
  items: SessionItem[];
  payments: Payment[];
}

function Dashboard() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [states, setStates] = useState<TableState[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const [{ data: tables }, { data: sessions }, { data: menuItems }] =
      await Promise.all([
        supabase.from("tables").select("*").order("name"),
        supabase.from("sessions").select("*").eq("status", "open"),
        supabase.from("menu_items").select("*"),
      ]);

    const sessionByTable = new Map<string, Session>();
    (sessions ?? []).forEach((s) => sessionByTable.set(s.table_id, s));
    const sessionIds = (sessions ?? []).map((s) => s.id);

    let items: SessionItem[] = [];
    let payments: Payment[] = [];
    if (sessionIds.length) {
      const [{ data: si }, { data: pm }] = await Promise.all([
        supabase.from("session_items").select("*").in("session_id", sessionIds),
        supabase.from("payments").select("*").in("session_id", sessionIds),
      ]);
      items = si ?? [];
      payments = pm ?? [];
    }

    setStates(
      (tables ?? []).map((table) => {
        const session = sessionByTable.get(table.id) ?? null;
        return {
          table,
          session,
          items: session
            ? items.filter((i) => i.session_id === session.id)
            : [],
          payments: session
            ? payments.filter((p) => p.session_id === session.id)
            : [],
        };
      })
    );
    setMenu(menuItems ?? []);
    setLoading(false);
  }, []);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(load, 120);
  }, [load]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("staff")
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "session_items" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, schedule)
      .subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(ch);
    };
  }, [load, schedule]);

  const statusOf = (s: TableState): TableStatus => {
    if (!s.session) return "empty";
    return isSettled(s.items, s.payments) ? "settled" : "open";
  };

  const selected = states.find((s) => s.table.id === selectedId) ?? null;

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-brand"
      >
        ← Home
      </Link>
      <header className="mt-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
            {VENUE_NAME} · Service
          </p>
          <h1 className="font-serif text-2xl font-semibold text-brand">
            Floor plan
          </h1>
        </div>
        <Brand size="sm" />
      </header>

      <Legend />

      <div className="mt-6 grid items-start gap-8 lg:grid-cols-[1fr_minmax(360px,420px)]">
        {/* Floor plan */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-36 animate-pulse rounded-card bg-surface"
                />
              ))
            : states.map((s) => (
                <TableTile
                  key={s.table.id}
                  state={s}
                  status={statusOf(s)}
                  active={s.table.id === selectedId}
                  onClick={() => setSelectedId(s.table.id)}
                />
              ))}
        </div>

        {/* Order-entry panel */}
        <div>
          {selected ? (
            <OrderPanel
              key={selected.table.id}
              state={selected}
              menu={menu}
              onChanged={load}
            />
          ) : (
            <div className="rounded-card border border-dashed border-line bg-surface/60 p-10 text-center text-sm text-muted">
              Select a table to take its order.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Legend() {
  const dot = "inline-block h-2.5 w-2.5 rounded-full";
  return (
    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
      <span className="flex items-center gap-2">
        <span className={`${dot} bg-line`} /> Empty
      </span>
      <span className="flex items-center gap-2">
        <span className={`${dot} bg-gold`} /> Open bill
      </span>
      <span className="flex items-center gap-2">
        <span className={`${dot} bg-brand`} /> Paid
      </span>
    </div>
  );
}

// ── Table tile ──────────────────────────────────────────────────────────────
function TableTile({
  state,
  status,
  active,
  onClick,
}: {
  state: TableState;
  status: TableStatus;
  active: boolean;
  onClick: () => void;
}) {
  const total = billTotal(state.items);
  const paid = paidValue(state.payments);

  const styles: Record<TableStatus, string> = {
    empty: "bg-surface border-line text-muted",
    open: "bg-gold-soft border-gold/40 text-ink",
    settled: "bg-brand border-brand text-cream",
  };
  const label: Record<TableStatus, string> = {
    empty: "Empty",
    open: "Open bill",
    settled: "Paid",
  };

  return (
    <button
      onClick={onClick}
      className={`relative flex h-36 flex-col justify-between rounded-card border p-4 text-left shadow-soft transition active:scale-[0.99] ${
        styles[status]
      } ${active ? "ring-2 ring-brand ring-offset-2 ring-offset-cream" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span className="font-serif text-xl font-semibold">
          {state.table.name}
        </span>
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            status === "empty"
              ? "bg-line"
              : status === "open"
              ? "bg-gold"
              : "bg-cream"
          }`}
        />
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
          {label[status]}
        </p>
        {status !== "empty" && (
          <p className="tnum mt-0.5 text-lg font-semibold">
            {money(paid)}{" "}
            <span className="text-xs font-normal opacity-70">
              / {money(total)}
            </span>
          </p>
        )}
      </div>
    </button>
  );
}

// ── Order panel ─────────────────────────────────────────────────────────────
function OrderPanel({
  state,
  menu,
  onChanged,
}: {
  state: TableState;
  menu: MenuItem[];
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const settled =
    !!state.session && isSettled(state.items, state.payments);
  const total = billTotal(state.items);
  const paid = paidValue(state.payments);

  // Add a menu item: create the session on first add, else bump qty.
  const addItem = async (m: MenuItem) => {
    setBusy(true);
    try {
      let sessionId = state.session?.id;
      if (!sessionId) {
        const { data, error } = await supabase
          .from("sessions")
          .insert({ table_id: state.table.id, service_charge_default: 12.5 })
          .select()
          .single();
        if (error) throw error;
        sessionId = data.id;
      }
      const existing = state.items.find((i) => i.menu_item_id === m.id);
      if (existing) {
        await supabase
          .from("session_items")
          .update({ qty: existing.qty + 1 })
          .eq("id", existing.id);
      } else {
        await supabase.from("session_items").insert({
          session_id: sessionId,
          menu_item_id: m.id,
          name: m.name,
          price: m.price,
          qty: 1,
        });
      }
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  const changeQty = async (item: SessionItem, delta: number) => {
    setBusy(true);
    try {
      const next = item.qty + delta;
      if (next <= 0) {
        await supabase.from("session_items").delete().eq("id", item.id);
      } else {
        await supabase
          .from("session_items")
          .update({
            qty: next,
            claimed_qty: Math.min(item.claimed_qty, next),
          })
          .eq("id", item.id);
      }
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  const resetTable = async () => {
    setBusy(true);
    try {
      if (state.session) {
        // Cascade deletes session_items + payments, returning tile to empty.
        await supabase.from("sessions").delete().eq("id", state.session.id);
      }
      await onChanged();
      setConfirmReset(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-card border border-line bg-surface p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl font-semibold text-brand">
          {state.table.name}
        </h2>
        {state.session && (
          <span
            className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
              settled ? "bg-brand text-cream" : "bg-gold-soft text-ink"
            }`}
          >
            {settled ? "Paid" : "Open"}
          </span>
        )}
      </div>

      {/* Current order */}
      {state.items.length > 0 ? (
        <ul className="mt-4 divide-y divide-line">
          {state.items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-2.5">
              <div className="flex-1">
                <p className="text-sm font-medium text-ink">{item.name}</p>
                <p className="tnum text-xs text-muted">
                  {money(item.price)} · {item.claimed_qty.toFixed(2)}/{item.qty}{" "}
                  claimed
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <QtyBtn onClick={() => changeQty(item, -1)} disabled={busy}>
                  −
                </QtyBtn>
                <span className="tnum w-5 text-center text-sm font-semibold">
                  {item.qty}
                </span>
                <QtyBtn onClick={() => changeQty(item, 1)} disabled={busy}>
                  +
                </QtyBtn>
              </div>
              <span className="tnum w-16 text-right text-sm font-semibold">
                {money(lineTotal(item))}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-btn bg-cream px-4 py-3 text-sm text-muted">
          No items yet. Tap the menu below to start this table&apos;s bill.
        </p>
      )}

      {state.items.length > 0 && (
        <div className="tnum mt-3 flex items-center justify-between border-t border-line pt-3 text-sm">
          <span className="text-muted">
            Paid {money(paid)} of {money(total)}
          </span>
          <span className="font-serif text-lg font-semibold text-brand">
            {money(total)}
          </span>
        </div>
      )}

      {/* Menu */}
      <div className="mt-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
          Add to bill
        </p>
        <div className="mt-3 space-y-4">
          {CATEGORY_ORDER.map((cat) => {
            const items = menu.filter((m) => m.category === cat);
            if (!items.length) return null;
            return (
              <div key={cat}>
                <p className="mb-1.5 text-xs font-medium text-muted">
                  {CATEGORY_LABEL[cat]}
                </p>
                <div className="flex flex-wrap gap-2">
                  {items.map((m) => (
                    <button
                      key={m.id}
                      disabled={busy}
                      onClick={() => addItem(m)}
                      className="tnum rounded-btn border border-line bg-cream px-3 py-2 text-left text-xs font-medium text-ink transition hover:border-brand hover:bg-brand-tint disabled:opacity-50"
                    >
                      {m.name}
                      <span className="ml-2 text-muted">{money(m.price)}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reset */}
      {state.session && (
        <div className="mt-6 border-t border-line pt-4">
          {confirmReset ? (
            <div className="flex items-center gap-2">
              <span className="flex-1 text-sm text-muted">
                Clear this table and wipe the bill?
              </span>
              <button
                onClick={() => setConfirmReset(false)}
                className="rounded-btn px-3 py-2 text-sm font-medium text-muted"
              >
                Cancel
              </button>
              <button
                onClick={resetTable}
                disabled={busy}
                className="rounded-btn bg-brand px-4 py-2 text-sm font-semibold text-cream"
              >
                Reset
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmReset(true)}
              className="w-full rounded-btn border border-line py-2.5 text-sm font-semibold text-brand transition hover:bg-cream"
            >
              Reset table
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function QtyBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface text-base leading-none text-ink transition hover:border-brand disabled:opacity-40"
    >
      {children}
    </button>
  );
}
