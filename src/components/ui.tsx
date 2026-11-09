import clsx from "clsx";
import { Bike, Dumbbell, Footprints, Waves } from "lucide-react";
import Link from "next/link";
import { formatDayMonth, weekdayName } from "@/lib/dates";
import { SPORTS, WORKOUT_TYPE_LABEL } from "@/lib/domain/sports";
import type { PlannedWorkout, Sport, ValueOrigin, WorkoutStatus } from "@/lib/domain/types";
import { formatDuration } from "@/lib/training/formulas";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-5", className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{children}</h2>
      {hint && <span className="text-xs text-faint">{hint}</span>}
    </div>
  );
}

export function SportIcon({ sport, className }: { sport: Sport; className?: string }) {
  const Icon = { run: Footprints, bike: Bike, swim: Waves, gym: Dumbbell }[sport];
  return <Icon className={clsx("size-4", className)} style={{ color: SPORTS[sport].colorVar }} aria-hidden />;
}

export function SportBadge({ sport }: { sport: Sport }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ background: SPORTS[sport].softVar, color: SPORTS[sport].colorVar }}
    >
      <SportIcon sport={sport} className="size-3.5" />
      {SPORTS[sport].label}
    </span>
  );
}

/** Etichetta che dice da dove viene un numero. Le stime sono sempre segnalate. */
export function OriginTag({ origin }: { origin: ValueOrigin }) {
  const styles: Record<ValueOrigin, string> = {
    stimato: "border-estimate/40 text-estimate",
    misurato: "border-ok/40 text-ok",
    dichiarato: "border-line text-muted",
  };
  return <span className={clsx("rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", styles[origin])}>{origin}</span>;
}

const STATUS_STYLE: Record<WorkoutStatus, string> = {
  programmato: "text-muted",
  completato: "text-ok",
  saltato: "text-bad",
  modificato: "text-warn",
};

export function StatusLabel({ status }: { status: WorkoutStatus }) {
  return <span className={clsx("text-xs font-semibold capitalize", STATUS_STYLE[status])}>{status}</span>;
}

export function Stat({ label, value, unit, note, origin, accent }: { label: string; value: string; unit?: string; note?: React.ReactNode; origin?: ValueOrigin; accent?: string }) {
  return (
    <Card className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted">{label}</span>
        {origin && <OriginTag origin={origin} />}
      </div>
      <p className="num text-4xl font-semibold leading-none" style={accent ? { color: accent } : undefined}>
        {value}
        {unit && <span className="ml-1 text-lg font-medium text-muted">{unit}</span>}
      </p>
      {note && <p className="text-xs text-muted">{note}</p>}
    </Card>
  );
}

export function WorkoutRow({ w, showDate = true }: { w: PlannedWorkout; showDate?: boolean }) {
  return (
    <Link
      href={`/allenamenti/${w.id}`}
      className="group flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 transition-colors hover:border-faint"
    >
      <span className="h-10 w-1 shrink-0 rounded-full" style={{ background: SPORTS[w.sport].colorVar }} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{w.title}</p>
        <p className="truncate text-xs text-muted">
          {showDate && `${weekdayName(w.date, true)} ${formatDayMonth(w.date)} · `}
          {WORKOUT_TYPE_LABEL[w.type]} · {w.sport === "run" && w.distanceKm ? `${w.distanceEstimated ? "≈ " : ""}${w.distanceKm.toLocaleString("it-IT")} km` : formatDuration(w.durationMin)} · {w.intensity}
        </p>
      </div>
      <StatusLabel status={w.status} />
    </Link>
  );
}

/** Pallino colorato di uno sport (calendario, settimana). */
export function SportDot({ sport, className, faded }: { sport: Sport; className?: string; faded?: boolean }) {
  return <span className={clsx("rounded-full", className ?? "size-2", faded && "opacity-30")} style={{ background: SPORTS[sport].colorVar }} />;
}

export function SportLegend({ sports }: { sports: Sport[] }) {
  return (
    <p className="flex flex-wrap gap-4 text-xs text-muted">
      {sports.map((s) => (
        <span key={s} className="flex items-center gap-1.5"><SportDot sport={s} /> {SPORTS[s].label}</span>
      ))}
    </p>
  );
}
