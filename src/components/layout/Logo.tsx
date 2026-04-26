import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-foreground", className)}
      aria-hidden
    >
      <rect x="0.5" y="0.5" width="31" height="31" rx="8" stroke="currentColor" strokeOpacity="0.18" />
      <path
        d="M9 11.5L20.5 9 14 14.5l9 1.2-12.5 2.6L17 24l-9.5-3.4L9 11.5z"
        fill="currentColor"
      />
      <circle cx="24" cy="9" r="2.2" fill="hsl(var(--sol-green))" />
    </svg>
  );
}
