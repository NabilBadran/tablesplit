"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "./supabaseClient";
import { round2, serviceAmount } from "./format";
import type { MyClaims, Payment, SessionItem } from "./types";

interface ClaimContextValue {
  /** Units (or fractional split-shares) of each item this phone has claimed. */
  myClaims: MyClaims;
  /** Chosen service-charge %, or null until the diner confirms the default. */
  servicePct: number | null;
  setServicePct: (pct: number) => void;
  /** If the whole bill was split equally, the N used; else null. */
  equalSplitN: number | null;

  myUnits: (itemId: string) => number;
  mySubtotal: (items: SessionItem[]) => number;

  claimUnit: (item: SessionItem) => Promise<void>;
  unclaimUnit: (item: SessionItem) => Promise<void>;
  setSplit: (item: SessionItem, n: number) => Promise<void>;
  claimShare: (item: SessionItem) => Promise<void>;
  unclaimShare: (item: SessionItem) => Promise<void>;
  applyEqualSplit: (items: SessionItem[], n: number) => Promise<void>;
  clearEqualSplit: (items: SessionItem[]) => Promise<void>;

  /** Result of a successful (mock) payment, read by the receipt screen. */
  payment: Payment | null;
  setPayment: (p: Payment | null) => void;

  reset: () => void;
}

const ClaimContext = createContext<ClaimContextValue | null>(null);

export function ClaimProvider({ children }: { children: React.ReactNode }) {
  const [myClaims, setMyClaims] = useState<MyClaims>({});
  const [servicePct, setServicePct] = useState<number | null>(null);
  const [equalSplitN, setEqualSplitN] = useState<number | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);

  const bump = useCallback((id: string, delta: number) => {
    setMyClaims((prev) => {
      const next = (prev[id] ?? 0) + delta;
      const copy = { ...prev };
      if (next <= 1e-6) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  }, []);

  // Latest server-confirmed claimed_qty per item + a per-item promise chain so
  // rapid taps are serialised. The DB clamps to [0, qty]; the client must mirror
  // only the amount actually applied, or a spammed "+" drifts the local "mine"
  // count past what really exists.
  const serverClaimed = useRef<Record<string, number>>({});
  const chains = useRef<Record<string, Promise<unknown>>>({});

  const applyDelta = useCallback(
    (item: SessionItem, delta: number) => {
      const run = async () => {
        const base = Math.max(
          serverClaimed.current[item.id] ?? item.claimed_qty,
          item.claimed_qty
        );
        let target = Math.max(0, Math.min(item.qty, round2(base + delta)));
        // Fractional splits (e.g. 1 ÷ 3 = 0.33, ×3 = 0.99) leave a sub-unit
        // sliver that would never settle. If a claim lands within a sliver of
        // full, snap to exactly the quantity — the last share absorbs the
        // rounding, exactly like rounding a real split bill.
        if (delta > 0 && item.qty - target > 1e-6 && item.qty - target < 0.05) {
          target = item.qty;
        }
        const realDelta = round2(target - base);
        if (realDelta === 0) return; // already at a bound — ignore extra taps
        const { data, error } = await supabase.rpc("claim_delta", {
          p_item: item.id,
          p_delta: realDelta,
        });
        if (error) {
          console.error("[TableSplit] claim_delta failed", error);
          return;
        }
        // The DB function locks the row and returns exactly how much it applied
        // ({ claimed_qty, applied }). That `applied` is authoritative even when
        // two phones claim the same item at once. Older DB versions return the
        // row instead — fall back to a best-effort estimate there.
        const res = data as { claimed_qty?: number; applied?: number };
        const newClaimed =
          typeof res.applied === "number"
            ? (res.claimed_qty as number)
            : (data as SessionItem).claimed_qty;
        const applied =
          typeof res.applied === "number"
            ? res.applied
            : round2(newClaimed - base);
        const credit =
          realDelta >= 0
            ? Math.min(realDelta, Math.max(0, applied))
            : Math.max(realDelta, Math.min(0, applied));
        serverClaimed.current[item.id] = newClaimed;
        if (credit !== 0) bump(item.id, credit);
      };
      // Serialise per item so concurrent taps can't race past the limit.
      const prev = chains.current[item.id] ?? Promise.resolve();
      const next = prev.then(run, run);
      chains.current[item.id] = next;
      return next;
    },
    [bump]
  );

  const claimUnit = useCallback(
    (item: SessionItem) => applyDelta(item, 1),
    [applyDelta]
  );
  const unclaimUnit = useCallback(
    (item: SessionItem) => applyDelta(item, -1),
    [applyDelta]
  );

  const shareSize = (item: SessionItem) =>
    item.qty / Math.max(1, item.split_count);

  const claimShare = useCallback(
    (item: SessionItem) => applyDelta(item, shareSize(item)),
    [applyDelta]
  );
  const unclaimShare = useCallback(
    (item: SessionItem) => applyDelta(item, -shareSize(item)),
    [applyDelta]
  );

  // Set how many ways a shared dish is divided (writes to the shared row).
  const setSplit = useCallback(async (item: SessionItem, n: number) => {
    const { error } = await supabase
      .from("session_items")
      .update({ split_count: Math.max(1, n) })
      .eq("id", item.id);
    if (error) console.error("[TableSplit] setSplit failed", error);
  }, []);

  // Claim a 1/N share of the whole bill in one tap.
  const applyEqualSplit = useCallback(
    async (items: SessionItem[], n: number) => {
      setEqualSplitN(n);
      for (const item of items) {
        await applyDelta(item, item.qty / n);
      }
    },
    [applyDelta]
  );

  const clearEqualSplit = useCallback(
    async (items: SessionItem[]) => {
      const share = equalSplitN;
      setEqualSplitN(null);
      if (!share) return;
      for (const item of items) {
        await applyDelta(item, -(item.qty / share));
      }
    },
    [applyDelta, equalSplitN]
  );

  const myUnits = useCallback((id: string) => myClaims[id] ?? 0, [myClaims]);

  const mySubtotal = useCallback(
    (items: SessionItem[]) =>
      round2(
        items.reduce((sum, i) => {
          const claimed = myClaims[i.id] ?? 0;
          if (i.split_count > 1 && claimed > 0) {
            const shareSize = i.qty / i.split_count;
            const myShares = Math.round(claimed / shareSize);
            return sum + (i.price / i.split_count) * myShares;
          }
          return sum + i.price * claimed;
        }, 0)
      ),
    [myClaims]
  );

  const reset = useCallback(() => {
    setMyClaims({});
    setServicePct(null);
    setEqualSplitN(null);
    setPayment(null);
    serverClaimed.current = {};
    chains.current = {};
  }, []);

  const value = useMemo<ClaimContextValue>(
    () => ({
      myClaims,
      servicePct,
      setServicePct,
      equalSplitN,
      myUnits,
      mySubtotal,
      claimUnit,
      unclaimUnit,
      setSplit,
      claimShare,
      unclaimShare,
      applyEqualSplit,
      clearEqualSplit,
      payment,
      setPayment,
      reset,
    }),
    [
      myClaims,
      servicePct,
      equalSplitN,
      myUnits,
      mySubtotal,
      claimUnit,
      unclaimUnit,
      setSplit,
      claimShare,
      unclaimShare,
      applyEqualSplit,
      clearEqualSplit,
      payment,
      reset,
    ]
  );

  return (
    <ClaimContext.Provider value={value}>{children}</ClaimContext.Provider>
  );
}

export function useClaims() {
  const ctx = useContext(ClaimContext);
  if (!ctx) throw new Error("useClaims must be used within a ClaimProvider");
  return ctx;
}

// Re-export so screens can compute service amounts from the same source.
export { serviceAmount };
