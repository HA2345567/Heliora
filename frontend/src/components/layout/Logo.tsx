import { forwardRef, type SVGProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Heliora logo — a minimalist sun/aperture mark.
 * Concentric rings around a solid core, with a Solana-green spark.
 * forwardRef so it can be used as a child of Radix Slot / router Link safely.
 */
export const Logo = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement>>(
  ({ className, ...props }, ref) => (
    <svg
      ref={ref}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-foreground", className)}
      aria-hidden
      {...props}
    >
      <rect x="0.5" y="0.5" width="31" height="31" rx="8" stroke="currentColor" strokeOpacity="0.18" />
      <circle cx="16" cy="16" r="9.25" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.25" />
      <circle cx="16" cy="16" r="5.25" stroke="currentColor" strokeOpacity="0.85" strokeWidth="1.25" />
      <circle cx="16" cy="16" r="2.25" fill="currentColor" />
      <circle cx="24.5" cy="7.5" r="1.75" fill="hsl(var(--sol-green))" />
    </svg>
  ),
);
Logo.displayName = "Logo";
