"use client";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Surfaced clearly in the browser console during setup.
  console.warn(
    "[TableSplit] Missing Supabase env vars. Copy .env.local.example to " +
      ".env.local and fill in NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY."
  );
}

// Anonymous diners + shared-password staff both use the public anon key.
// Placeholder fallbacks keep createClient from throwing during the build /
// server render when env vars aren't present; real calls simply fail at
// runtime until .env.local is filled in.
export const supabase = createClient(
  url ?? "https://placeholder.supabase.co",
  anonKey ?? "placeholder-anon-key",
  { realtime: { params: { eventsPerSecond: 10 } } }
);

export const STAFF_PASSWORD =
  process.env.NEXT_PUBLIC_STAFF_PASSWORD ?? "lumo2025";
