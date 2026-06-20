import { VENUE_NAME, VENUE_TAGLINE } from "@/lib/format";

export function Brand({
  size = "md",
  tagline = false,
  onDark = false,
}: {
  size?: "sm" | "md" | "lg";
  tagline?: boolean;
  onDark?: boolean;
}) {
  const nameSize =
    size === "lg" ? "text-3xl" : size === "sm" ? "text-lg" : "text-2xl";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full bg-gold"
        />
        <span
          className={`font-serif ${nameSize} font-semibold tracking-tight ${
            onDark ? "text-cream" : "text-brand"
          }`}
        >
          {VENUE_NAME}
        </span>
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full bg-gold"
        />
      </div>
      {tagline && (
        <span
          className={`text-[11px] font-medium uppercase tracking-[0.18em] ${
            onDark ? "text-cream/70" : "text-muted"
          }`}
        >
          {VENUE_TAGLINE}
        </span>
      )}
    </div>
  );
}
