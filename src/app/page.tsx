import clsx from "clsx";
import { ChevronRight, Flag } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { eventDescription } from "@/components/event-summary";
import { Card, SectionTitle, SportBadge, SportDot, Stat, StatusLabel, WorkoutRow } from "@/components/ui";
import { addDays, daysBetween, formatDayMonth, mondayOf, weekdayName } from "@/lib/dates";
import { SPORT_KEYS, SPORTS } from "@/lib/domain/sports";
import { TEST_CATALOG } from "@/lib/training/tests";
import { Signals } from "@/components/signals";
import { feedbackSignals } from "@/lib/training/feedback";
import { getAppData } from "@/lib/data/repository";
import { adherence, loadState, weeklySummaries } from "@/lib/training/analytics";
import { formatDuration } from "@/lib/training/formulas";
import { MorningCheckin, StravaAutoSync, WeeklyReviewCard } from "@/components/today";
import { AddFeedbackForm, SkipFeedbackButton } from "@/components/strava";
import { waitingFeedback } from "@/lib/training/waiting";
import { swapSuggestion } from "@/lib/training/gym-swaps";
import { GymSwapsCard } from "@/components/gym-swaps";
import { readinessAdvice } from "@/lib/training/readiness";
import { proposeReschedule } from "@/lib/planning/reschedule";
import { weeklyReview } from "@/lib/planning/weekly-review";
import { paceReference } from "@/lib/training/run-paces";
import type { PlannedWorkout, WorkoutStep } from "@/lib/domain/types";

/** Una riga per fase: "6 × 3' · 4:25 – 4:35 /km". */
function stepLine(s: WorkoutStep): string {
  const what = [s.repeat ? `${s.repeat} ×` : "", s.distanceKm ? (s.distanceKm < 1 ? `${Math.round(s.distanceKm * 1000)} m` : `${String(s.distanceKm).replace(".", ",")} km`) : s.durationMin ? formatDuration(s.durationMin) : ""].filter(Boolean).join(" ");
  const how = s.exercise ? s.note : s.target?.value ?? `RPE ${s.rpe[0] === s.rpe[1] ? s.rpe[0] : `${s.rpe[0]}–${s.rpe[1]}`}`;
  return [s.exercise ? s.label : `${s.label}${what ? ` ${what}` : ""}`, how].filter(Boolean).join(" · ");
}

function TodayWorkout({ w }: { w: PlannedWorkout }) {
  const st = w.structure;
  const rows: { k: string; v: string }[] = [
    ...st.warmup.map((s) => ({ k: "Riscaldamento", v: stepLine(s) })),
    ...st.main.map((s) => ({ k: s.exercise ? "Esercizio" : "Parte centrale", v: stepLine(s) })),
    ...(st.recoveries ? [{ k: "Recuperi", v: `${st.recoveries}${st.recoveryTarget ? ` · ${st.recoveryTarget.value}` : ""}` }] : []),
    ...st.cooldown.map((s) => ({ k: "Defaticamento", v: stepLine(s) })),
  ];
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <SportBadge sport={w.sport} />
          <h2 className="mt-2 text-xl font-bold">{w.title}</h2>
          <p className="mt-1 text-sm text-muted">{formatDuration(w.durationMin)} · {w.intensity}</p>
        </div>
        <StatusLabel status={w.status} />
      </div>
      <ol className="flex flex-col gap-1.5 border-t border-line pt-3 text-sm">
        {rows.map((r, i) => (
          <li key={i} className="flex flex-col sm:flex-row sm:gap-3">
            <span className="w-32 shrink-0 text-xs uppercase tracking-wide text-faint">{r.k}</span>
            <span>{r.v}</span>
          </li>
        ))}
      </ol>
      {w.paceSource && <p className="text-xs text-faint">Passi stimati da: {w.paceSource}</p>}
      {w.status === "programmato" ? (
        <div className="grid grid-cols-2 gap-2">
          <Link href={`/allenamenti/${w.id}#registra`} className="flex min-h-12 items-center justify-center rounded-xl bg-ok font-semibold text-bg">Fatto</Link>
          <Link href={`/allenamenti/${w.id}`} className="flex min-h-12 items-center justify-center rounded-xl border border-line font-semibold">Dettagli</Link>
        </div>
      ) : (
        <Link href={`/allenamenti/${w.id}`} className="text-sm font-semibold underline">Vedi la seduta</Link>
      )}
    </Card>
  );
}

export const dynamic = "force-dynamic";

const LOAD_COLOR = { basso: "var(--color-muted)", equilibrato: "var(--color-ok)", "in crescita": "var(--color-warn)", alto: "var(--color-bad)" } as const;

export default async function HomePage() {
  const data = await getAppData();
  const { today, athlete, events, plan, activities, mode, onboardingCompleted, plannedTests, checkins } = data;
  if (mode === "utente" && !onboardingCompleted) redirect("/onboarding");
  const demo = mode === "demo";
  // Controllo del mattino: se fatto, il consiglio del coach (e la proposta concreta) per oggi.
  const checkin = checkins.find((c) => c.date === today);
  const advice = checkin ? readinessAdvice(checkin, plan.filter((p) => p.date === today), checkins) : undefined;
  const firstProposal = advice?.disruption ? proposeReschedule({ today, athlete, plan, events, disruption: advice.disruption }).proposals.find((p) => p.changes.length) : undefined;
  // Attività da Strava che aspettano lo sforzo percepito.
  const waiting = waitingFeedback(activities, today);
  // Revisione della settimana (da sabato a lunedì).
  const ref = paceReference(athlete, activities, plan, today);
  const review = mode === "utente" || demo ? weeklyReview({ ...data, thresholdSec: ref?.thresholdSec }) : null;
  const practiced = SPORT_KEYS.filter((s) => athlete.sports.some((x) => x.sport === s) || activities.some((a) => a.sport === s));
  const signals = feedbackSignals(activities, plan, today);
  const firstUnlogged = plan.find((p) => p.status === "programmato" && p.date < today && p.date >= addDays(today, -7));
  const dueTests = plannedTests.filter((t) => t.status === "proposto" || ((t.status === "programmato" || t.status === "rimandato") && t.dueDate && t.dueDate <= addDays(today, 7)));
  const monday = mondayOf(today);
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const todays = plan.filter((p) => p.date === today);
  const next = plan.filter((p) => p.date > today).slice(0, 3);
  const [prev, cur] = weeklySummaries(activities, plan, today, 2);
  const load = loadState(activities, today);
  const adh = adherence(plan, addDays(today, -28), today);
  const race = events.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
  const plannedWeekMin = plan.filter((p) => p.date >= monday && p.date <= addDays(monday, 6)).reduce((t, p) => t + p.durationMin, 0);

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-muted">
          {weekdayName(today)} {formatDayMonth(today, false)}
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Ciao, {athlete.name.split(" ")[0]}</h1>
      </header>

      {race && (
        <Link href="/profilo" className="group relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-gradient-to-br from-run/20 via-surface to-surface p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-run">
                <Flag className="size-3.5" aria-hidden /> Obiettivo principale
              </p>
              <p className="mt-1 truncate text-lg font-semibold">{race.name}</p>
              <p className="text-sm text-muted">{eventDescription(race)}</p>
              {athlete.goals.primary && <p className="text-sm text-muted">{athlete.goals.primary}</p>}
            </div>
            <p className="num shrink-0 text-right text-6xl font-semibold leading-none">
              {daysBetween(today, race.date)}
              <span className="block text-xs font-medium tracking-wide text-muted">giorni</span>
            </p>
          </div>
        </Link>
      )}

      {!demo && <StravaAutoSync />}

      <section>
        <SectionTitle>Come stai oggi</SectionTitle>
        <MorningCheckin existing={checkin} advice={advice} proposal={firstProposal && { id: firstProposal.id, title: firstProposal.title, summary: firstProposal.summary }} demo={demo} />
      </section>

      {waiting.length > 0 && (
        <section>
          <SectionTitle hint={waiting.length > 1 ? <Link href="/allenamenti" className="font-semibold hover:underline">altre {waiting.length - 1}</Link> : undefined}>Com&apos;è andata?</SectionTitle>
          <Card className="flex flex-col gap-3">
            <p className="text-sm">
              <b>{waiting[0].title || "Attività"}</b> <span className="text-muted">· {weekdayName(waiting[0].date)} {formatDayMonth(waiting[0].date, false)} · da Strava</span>
            </p>
            <AddFeedbackForm key={waiting[0].id} activityId={waiting[0].id} />
            <SkipFeedbackButton activityId={waiting[0].id} disabled={demo} />
          </Card>
        </section>
      )}

      {review && (
        <WeeklyReviewCard
          target={review.targetMonday}
          summary={review.summary}
          decision={review.decision}
          changes={review.changes.map((c) => ({ day: `${weekdayName(c.date)} ${formatDayMonth(c.date, false)}`, before: c.before, after: c.after }))}
          demo={demo}
        />
      )}

      <Signals signals={signals} registerHref={firstUnlogged ? `/allenamenti/${firstUnlogged.id}` : undefined} />

      {dueTests.length > 0 && (
        <Link href="/test" className="block">
          <Card className="flex items-center justify-between gap-3 border-warn/40 transition-colors hover:border-warn">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-warn">Test consigliati</p>
              <p className="mt-1 font-semibold">{dueTests.map((t) => TEST_CATALOG[t.kind].label).join(" · ")}</p>
              <p className="text-sm text-muted">Fallo, rimandalo o inserisci un risultato recente.</p>
            </div>
            <ChevronRight className="size-5 shrink-0 text-faint" aria-hidden />
          </Card>
        </Link>
      )}

      <section>
        <SectionTitle hint={<Link href="/riprogramma" className="font-semibold text-warn hover:underline">Ho un imprevisto</Link>}>Oggi</SectionTitle>
        {todays.length ? (
          <div className="flex flex-col gap-3">
            {todays.map((w) => {
              const sug = swapSuggestion(w, data);
              return (
                <div key={w.id} className="flex flex-col gap-3">
                  {sug && <GymSwapsCard workoutId={w.id} reasons={sug.reasons} swaps={sug.swaps} demo={demo} />}
                  <TodayWorkout w={w} />
                </div>
              );
            })}
          </div>
        ) : mode === "utente" && !plan.some((p) => p.date >= today) ? (
          <Link href="/programma" className="block">
            <Card className="flex flex-col gap-2 border-ok/40 transition-colors hover:border-ok">
              <p className="font-semibold">Crea il tuo programma</p>
              <p className="text-sm text-muted">Il coach prepara le settimane attorno alle tue gare e ai tuoi giorni liberi.</p>
            </Card>
          </Link>
        ) : (
          <Card>
            <p className="font-semibold">Giorno di riposo</p>
            <p className="mt-1 text-sm text-muted">Il recupero fa parte del programma. Una camminata leggera va benissimo.</p>
          </Card>
        )}
      </section>

      <section>
        <SectionTitle hint={`${formatDuration(cur.runMin + cur.bikeMin)} su ${formatDuration(plannedWeekMin)} previsti`}>Questa settimana</SectionTitle>
        <ol className="grid grid-cols-7 gap-1.5">
          {week.map((d) => {
            const items = plan.filter((p) => p.date === d);
            const isToday = d === today;
            return (
              <li key={d} className={clsx("flex flex-col items-center gap-2 rounded-xl border px-1 py-2.5", isToday ? "border-fg/60 bg-surface-2" : "border-line bg-surface")}>
                <span className={clsx("text-[11px] font-medium", isToday ? "text-fg" : "text-muted")}>{weekdayName(d, true)}</span>
                <span className="num text-lg leading-none">{Number(d.slice(8))}</span>
                <span className="flex h-2 gap-1">
                  {items.map((p) => (
                    <SportDot key={p.id} sport={p.sport} faded={p.status === "saltato"} className={clsx("size-2", p.status === "programmato" && "opacity-60")} />
                  ))}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {practiced.filter((sp) => sp !== "gym").map((sp) => {
          const km = { run: [cur.runKm, prev.runKm], bike: [cur.bikeKm, prev.bikeKm], swim: [cur.swimKm, prev.swimKm] }[sp as "run" | "bike" | "swim"];
          const mins = { run: [cur.runMin, prev.runMin], bike: [cur.bikeMin, prev.bikeMin], swim: [cur.swimMin, prev.swimMin] }[sp as "run" | "bike" | "swim"];
          return sp === "bike" ? (
            <Stat key={sp} label={`${SPORTS[sp].label} questa settimana`} value={formatDuration(mins[0])} note={`Settimana scorsa ${formatDuration(mins[1])}`} accent={SPORTS[sp].colorVar} origin="misurato" />
          ) : (
            <Stat key={sp} label={`${SPORTS[sp].label} questa settimana`} value={km[0].toLocaleString("it-IT")} unit="km" note={`Settimana scorsa ${km[1].toLocaleString("it-IT")} km`} accent={SPORTS[sp].colorVar} origin="misurato" />
          );
        })}
        {practiced.includes("gym") && (
          <Stat label="Palestra questa settimana" value={formatDuration(cur.gymMin)} note={`Settimana scorsa ${formatDuration(prev.gymMin)}`} accent={SPORTS.gym.colorVar} origin="misurato" />
        )}
        <Stat label="Aderenza 4 settimane" value={adh === null ? "–" : `${Math.round(adh * 100)}`} unit="%" note="Sedute fatte su sedute previste" />
        <Stat
          label="Carico recente"
          value={load.state ?? "–"}
          origin="stimato"
          accent={load.state ? LOAD_COLOR[load.state] : undefined}
          note={load.ratio === null ? "Servono 4 settimane di dati" : `Ultimi 7 giorni / media 28 giorni: ${load.ratio.toFixed(2).replace(".", ",")}`}
        />
      </section>

      <section>
        <SectionTitle hint={<Link href="/calendario" className="hover:text-fg">Calendario</Link>}>Prossimi allenamenti</SectionTitle>
        <div className="flex flex-col gap-2">
          {next.map((w) => (
            <WorkoutRow key={w.id} w={w} />
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Ultime attività</SectionTitle>
        <div className="flex flex-col gap-2">
          {plan.filter((p) => p.date < today).slice(-3).reverse().map((w) => (
            <Link key={w.id} href={`/allenamenti/${w.id}`} className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3 hover:border-faint">
              <span className="flex min-w-0 items-center gap-2">
                <SportBadge sport={w.sport} />
                <span className="truncate text-sm font-medium">{w.title}</span>
              </span>
              <StatusLabel status={w.status} />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
