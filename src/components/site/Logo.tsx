/**
 * BallFindr logo/wordmark link.
 */
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import transparentLogo from "@/assets/ballfindr-logo-transparent.png";

export function Logo({ className, to = "/" }: { className?: string; to?: string }) {
  return (
    <Link
      to={to as never}
      className={cn(
        "group inline-flex shrink-0 items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
      aria-label="BallFindr home"
    >
      <img
        src={transparentLogo}
        alt="BallFindr"
        width={1600}
        height={800}
        draggable={false}
        className="h-14 w-auto transition-transform duration-200 group-hover:scale-[1.03]"
      />
    </Link>
  );
}
