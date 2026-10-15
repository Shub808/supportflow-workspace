import Link from "next/link";
import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/theme";
import { Avatar, Button, Chip } from "@/components/ui/primitives";
import { signOutAction } from "@/server/actions/session";
import { ROLE_CAPABILITIES } from "@/server/auth/roles";
import type { Agent } from "@/types/domain";

const NAV = [
  { href: "/inbox", label: "Inbox" },
  { href: "/kb", label: "Knowledge base" },
] as const;

/**
 * Workspace chrome.
 *
 * A Server Component: it needs the signed-in agent and nothing interactive
 * beyond the theme toggle and the sign-out form, so there is no reason to ship
 * it to the browser.
 */
export function WorkspaceShell({
  agent,
  current,
  children,
}: {
  agent: Agent;
  current: "inbox" | "kb";
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only-focusable absolute top-2 left-2 z-50 rounded-(--radius-control) bg-accent-600 px-3 py-1.5 text-sm text-white"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-4">
          <Link href="/inbox" className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="flex size-7 items-center justify-center rounded-md bg-accent-600 text-sm font-bold text-white"
            >
              S
            </span>
            <span className="text-sm font-semibold text-ink">SupportFlow</span>
          </Link>

          <Chip tone="warn" className="hidden sm:inline-flex">
            Demo data
          </Chip>

          <nav aria-label="Main" className="ml-2 flex items-center gap-1">
            {NAV.map((item) => {
              const active =
                (current === "inbox" && item.href === "/inbox") ||
                (current === "kb" && item.href === "/kb");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "rounded-(--radius-control) bg-accent-tint px-2.5 py-1.5 text-sm font-medium text-accent-on-tint"
                      : "rounded-(--radius-control) px-2.5 py-1.5 text-sm text-muted hover:bg-surface-muted hover:text-ink"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <div className="hidden items-center gap-2 sm:flex">
              <Avatar name={agent.name} />
              <div className="leading-tight">
                <p className="text-xs font-medium text-ink">{agent.name}</p>
                <p className="text-xs text-subtle">
                  {agent.role} · {ROLE_CAPABILITIES[agent.role].length} permissions
                </p>
              </div>
            </div>
            <form action={signOutAction}>
              <Button type="submit" size="sm" variant="ghost">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main id="main" className="min-w-0 flex-1">
        {children}
      </main>
    </div>
  );
}
