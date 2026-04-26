import { cn } from "@/lib/utils";

/**
 * Heliora logo — a minimalist sun/aperture mark.
 * Concentric rings around a solid core, with a subtle Solana-green spark.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-foreground", className)}
      aria-hidden
    >
      {/* Rounded square frame */}
      <rect
        x="0.5"
        y="0.5"
        width="31"
        height="31"
        rx="8"
        stroke="currentColor"
        strokeOpacity="0.18"
      />
      {/* Outer ring */}
      <circle
        cx="16"
        cy="16"
        r="9.25"
        stroke="currentColor"
        strokeOpacity="0.55"
        strokeWidth="1.25"
      />
      {/* Inner ring */}
      <circle
        cx="16"
        cy="16"
        r="5.25"
        stroke="currentColor"
        strokeOpacity="0.85"
        strokeWidth="1.25"
      />
      {/* Solid core */}
      <circle cx="16" cy="16" r="2.25" fill="currentColor" />
      {/* Accent spark */}
      <circle cx="24.5" cy="7.5" r="1.75" fill="hsl(var(--sol-green))" />
    </svg>
  );
}
