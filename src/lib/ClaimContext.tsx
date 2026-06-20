"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
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
      const next = round2((prev[id] ?? 0) + delta);
      const copy = { ...prev };
      if (next <= 1e-6) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  }, []);

  // Push a delta to the shared row, then mirror it locally as "mine".
  const applyDelta = useCallback(
    async (item: SessionItem, delta: number) => {
      const { error } = await supabase.rpc("claim_delta", {
        p_item: item.id,
        p_delta: delta,
      });
      if (error) {
        console.error("[TableSplit] claim_delta failed", error);
        return;
      }
      bump(item.id, delta);
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
    round2(item.qty / Math.max(1, item.split_count));

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
        await applyDelta(item, round2(item.qty / n));
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
        await applyDelta(item, -round2(item.qty / share));
      }
    },
    [applyDelta, equalSplitN]
  );

  const myUnits = useCallback((id: string) => myClaims[id] ?? 0, [myClaims]);

  const mySubtotal = useCallback(
    (items: SessionItem[]) =>
      round2(
        items.reduce((sum, i) => sum + i.price * (myClaims[i.id] ?? 0), 0)
      ),
    [myClaims]
  );

  const reset = useCallback(() => {
    setMyClaims({});
    setServicePct(null);
    setEqualSplitN(null);
    setPayment(null);
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
