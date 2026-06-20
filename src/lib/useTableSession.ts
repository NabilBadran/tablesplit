"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import type { Payment, Session, SessionItem, Table } from "./types";

interface State {
  table: Table | null;
  session: Session | null;
  items: SessionItem[];
  payments: Payment[];
  loading: boolean;
  error: string | null;
}

const empty: State = {
  table: null,
  session: null,
  items: [],
  payments: [],
  loading: true,
  error: null,
};

/**
 * Loads everything a diner needs for one table and keeps it live.
 * Any claim/payment from any phone triggers a refetch via Supabase realtime,
 * so all devices viewing the same table stay in sync (spec 4.3 concurrency).
 */
export function useTableSession(tableId: string) {
  const [state, setState] = useState<State>(empty);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(async () => {
    try {
      const { data: table, error: tErr } = await supabase
        .from("tables")
        .select("*")
        .eq("id", tableId)
        .maybeSingle();
      if (tErr) throw tErr;

      const { data: session, error: sErr } = await supabase
        .from("sessions")
        .select("*")
        .eq("table_id", tableId)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (sErr) throw sErr;

      if (!session) {
        setState({
          table: table ?? null,
          session: null,
          items: [],
          payments: [],
          loading: false,
          error: null,
        });
        return;
      }

      const [{ data: items }, { data: payments }] = await Promise.all([
        supabase
          .from("session_items")
          .select("*")
          .eq("session_id", session.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("payments")
          .select("*")
          .eq("session_id", session.id)
          .order("created_at", { ascending: true }),
      ]);

      setState({
        table: table ?? null,
        session,
        items: items ?? [],
        payments: payments ?? [],
        loading: false,
        error: null,
      });
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : "Could not load the bill.",
      }));
    }
  }, [tableId]);

  // Debounced reload so a burst of realtime events fetches once.
  const scheduleReload = useCallback(() => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(reload, 120);
  }, [reload]);

  useEffect(() => {
    reload();
    const channel = supabase
      .channel(`table-${tableId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions" },
        scheduleReload
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "session_items" },
        scheduleReload
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments" },
        scheduleReload
      )
      .subscribe();

    return () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      supabase.removeChannel(channel);
    };
  }, [tableId, reload, scheduleReload]);

  return { ...state, reload };
}
