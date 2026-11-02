"use client";

import clsx from "clsx";
import { Activity, Bot, CalendarDays, Dumbbell, Home, LineChart, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/calendario", label: "Calendario", icon: CalendarDays },
  { href: "/allenamenti", label: "Allenamenti", icon: Dumbbell },
  { href: "/coach", label: "Coach AI", icon: Bot },
  { href: "/progressi", label: "Progressi", icon: LineChart },
  { href: "/profilo", label: "Profilo", icon: UserRound },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppShell({ children, demo }: { children: React.ReactNode; demo: boolean }) {
  const pathname = usePathname();

  // Pagina di accesso: niente menu.
  if (["/accedi", "/privacy", "/offline"].some((p) => pathname.startsWith(p))) return <main className="px-4 sm:px-6">{children}</main>;

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      {/* Barra laterale: da tablet in su */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-8 border-r border-line bg-surface px-4 py-6 md:flex">
        <Link href="/" className="flex items-center gap-2.5 px-2">
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-run to-bike">
            <Activity className="size-5 text-white" aria-hidden />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-bold">Adaptive Coach</span>
            <span className="block text-xs text-muted">AI · versione 0.1</span>
          </span>
        </Link>
        <nav aria-label="Sezioni" className="flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(pathname, href) ? "page" : undefined}
              className={clsx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive(pathname, href) ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2/60 hover:text-fg",
              )}
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="min-w-0">
        {demo && (
          <div className="border-b border-estimate/30 bg-estimate/10 px-4 py-2 text-center text-xs text-estimate">
            Modalità dimostrativa: tutti i dati sono di esempio e non appartengono a una persona reale.
          </div>
        )}
        <main className="mx-auto w-full max-w-5xl px-4 pb-32 pt-5 sm:px-6 md:pb-12">{children}</main>
      </div>

      {/* Barra in basso: smartphone */}
      <nav
        aria-label="Sezioni"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <ul className="grid grid-cols-6">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={clsx("flex min-h-16 flex-col items-center justify-center gap-1 text-[10.5px] font-medium", active ? "text-fg" : "text-faint")}
                >
                  <Icon className={clsx("size-[22px]", active && "text-run")} aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
