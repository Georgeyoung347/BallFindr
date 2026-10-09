/**
 * Public site footer: links, legal, contact and socials.
 */
import { Link } from "@tanstack/react-router";
import { handleInstagramClick } from "@/lib/instagram";
import { Instagram, Music2 } from "lucide-react";
import { Logo } from "./Logo";

const columns = [
  {
    title: "Platform",
    links: [
      { label: "Players", href: "/#for-players" },
      { label: "Clubs", href: "/#for-clubs" },
      { label: "How it works", href: "/#how-it-works" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/#vision" },
      { label: "Contact", href: "mailto:ballfindr@gmail.com" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Notice", href: "/privacy" },
      { label: "Terms & Conditions", href: "/terms" },
      { label: "Cookies", href: "/cookies" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background px-5 py-14 sm:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Football recruitment, made simple.
            </p>
            <div className="mt-5 flex gap-2">
              <a
                href="https://www.instagram.com/ball.findr/"
                onClick={handleInstagramClick}
                aria-label="BallFindr on Instagram"
                className="grid size-10 place-items-center rounded-xl border border-border bg-elevated/60 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
              >
                <Instagram className="size-4" />
              </a>
              <a
                href="https://www.tiktok.com/@ballfindr"
                aria-label="BallFindr on TikTok"
                className="grid size-10 place-items-center rounded-xl border border-border bg-elevated/60 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
              >
                <Music2 className="size-4" />
              </a>
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="eyebrow">{col.title}</h3>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} BallFindr. All rights reserved.</p>
          <div className="flex gap-5">
            <Link to="/join/player" className="transition-colors hover:text-foreground">
              I'm a player
            </Link>
            <Link to="/join/club" className="transition-colors hover:text-foreground">
              I'm a club
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
