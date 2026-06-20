import { ClaimProvider } from "@/lib/ClaimContext";

export default function TableLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ClaimProvider>{children}</ClaimProvider>;
}
