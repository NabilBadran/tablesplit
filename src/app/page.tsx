import Link from "next/link";
import { Brand } from "@/components/Brand";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 py-10">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <Brand size="lg" tagline />

        <h1 className="mt-10 font-serif text-4xl font-semibold leading-tight text-brand">
          Scan. Split. Pay.
        </h1>
        <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-muted">
          Split and pay your bill from your own phone. No app to download, no
          card details to type.
        </p>

        <div className="mt-10 w-full space-y-3">
          <Link
            href="/staff"
            className="block rounded-btn bg-brand px-5 py-4 text-center font-semibold text-cream shadow-soft transition active:scale-[0.99]"
          >
            Staff dashboard
          </Link>
          <Link
            href="/qr"
            className="block rounded-btn border border-line bg-surface px-5 py-4 text-center font-semibold text-brand transition active:scale-[0.99]"
          >
            Table QR codes
          </Link>
        </div>

        <p className="mt-8 text-xs leading-relaxed text-muted">
          Diners reach their bill by scanning the QR code on their table — open
          the QR page on a laptop and scan a code with your phone to try it.
        </p>
      </div>

      <footer className="pt-8 text-center text-[11px] uppercase tracking-[0.18em] text-muted">
        TableSplit · Demo
      </footer>
    </main>
  );
}
