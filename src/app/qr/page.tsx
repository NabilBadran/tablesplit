"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Brand } from "@/components/Brand";
import type { Table } from "@/lib/types";

export default function QrPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [origin, setOrigin] = useState("");
  const [qr, setQr] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    supabase
      .from("tables")
      .select("*")
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setTables(data ?? []);
      });
  }, []);

  useEffect(() => {
    if (!origin || tables.length === 0) return;
    (async () => {
      const next: Record<string, string> = {};
      for (const t of tables) {
        next[t.id] = await QRCode.toDataURL(`${origin}/table/${t.id}`, {
          width: 480,
          margin: 1,
          color: { dark: "#1F3D2B", light: "#FFFFFF" },
        });
      }
      setQr(next);
    })();
  }, [origin, tables]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/" className="text-sm font-medium text-muted">
          ← Home
        </Link>
        <button
          onClick={() => window.print()}
          className="rounded-btn bg-brand px-4 py-2 text-sm font-semibold text-cream"
        >
          Print all
        </button>
      </div>

      <div className="mt-8 text-center">
        <Brand size="lg" tagline />
        <h1 className="mt-6 font-serif text-2xl font-semibold text-brand">
          Table QR codes
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Place one on each table. Diners scan to open their live bill. The
          codes encode this device&apos;s address — regenerate them after you
          start your ngrok tunnel so phones can reach you.
        </p>
      </div>

      {error && (
        <p className="mt-6 rounded-card border border-line bg-surface p-4 text-center text-sm text-muted">
          Couldn&apos;t load tables: {error}. Check your Supabase env vars and
          that you&apos;ve run schema.sql + seed.sql.
        </p>
      )}

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {tables.map((t) => (
          <div
            key={t.id}
            className="flex flex-col items-center rounded-card border border-line bg-surface p-6 shadow-soft"
          >
            {qr[t.id] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qr[t.id]}
                alt={`QR code for ${t.name}`}
                className="h-44 w-44"
              />
            ) : (
              <div className="h-44 w-44 animate-pulse rounded-lg bg-cream" />
            )}
            <p className="mt-4 font-serif text-xl font-semibold text-brand">
              {t.name}
            </p>
            <p className="mt-1 break-all text-center text-[11px] text-muted">
              {origin}/table/{t.id}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
