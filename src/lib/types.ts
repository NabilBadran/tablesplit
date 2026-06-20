// ============================================================================
// Shared types — the locked contract that mirrors supabase/schema.sql (Section 3).
// Any change here is a team decision, not a unilateral edit.
// ============================================================================

export type Category = "starter" | "main" | "dessert" | "drink";
export type SessionStatus = "open" | "paid";

export interface Table {
  id: string;
  name: string;
}

export interface Session {
  id: string;
  table_id: string;
  status: SessionStatus;
  service_charge_default: number;
  created_at: string;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: Category;
}

export interface SessionItem {
  id: string;
  session_id: string;
  menu_item_id: string | null;
  name: string;
  price: number;
  qty: number;
  claimed_qty: number;
  split_count: number;
  created_at: string;
}

export interface Payment {
  id: string;
  session_id: string;
  item_ids: string[];
  subtotal: number;
  service_charge_pct: number;
  service_charge_amount: number;
  total: number;
  status: "paid";
  created_at: string;
}

// Local-only (per phone, never persisted): how much of each session_item
// "I" have personally claimed. Keyed by session_item id.
export type MyClaims = Record<string, number>;
