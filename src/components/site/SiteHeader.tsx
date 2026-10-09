/**
 * Public site header with navigation and Join / Sign in buttons.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";

const navLinks = [
  { label: "Discover", href: "/#preview" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "For Players", href: "/#for-players" },
  { label: "For Clubs", href: "/#for-clubs" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        <Logo />

        <nav className="hidden items-center gap-7 md:flex" aria-label="Main">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Button asChild variant="quiet" size="sm">
            <Link to="/login">Log in</Link>
          </Button>
          <Button asChild variant="volt" size="default">
            <Link to="/join">Get Started</Link>
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="grid size-10 place-items-center rounded-xl border border-border bg-elevated/60 md:hidden"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-border bg-background md:hidden">
          <nav className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-5 py-4" aria-label="Mobile">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 text-base font-medium text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-3 grid gap-2">
              <Button asChild variant="subtle" size="lg">
                <Link to="/login" onClick={() => setOpen(false)}>
                  Log in
                </Link>
              </Button>
              <Button asChild variant="volt" size="lg">
                <Link to="/join" onClick={() => setOpen(false)}>
                  Get Started
                </Link>
              </Button>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
