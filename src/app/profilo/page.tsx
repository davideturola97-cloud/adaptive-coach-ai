import { Download, LogOut, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { signOut } from "@/app/accedi/actions";
import { Card, OriginTag, PageHeader, SectionTitle, SportBadge } from "@/components/ui";
import { daysBetween, formatDayMonth } from "@/lib/dates";
import { getAppData } from "@/lib/data/repository";
import { eventDescription } from "@/components/event-summary";
import { sportLabel } from "@/lib/domain/sports";
import { formatPace, formatSwimPace, powerZones } from "@/lib/training/formulas";
import { deleteAccount } from "./actions";
import { InstallApp } from "@/components/pwa";
import { StravaSection } from "@/components/strava-section";
import { stravaStatus } from "@/lib/strava/service";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-3 last:border-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right text-sm font-medium">{children}</dd>
    </div>
  );
}

const dash = "–";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ errore?: string; strava?: string }> }) {
  const { athlete: a, events, today, mode, email } = await getAppData();
  const { errore, strava } = await searchParams;
  const demo = mode === "demo";
  const strStatus = demo ? null : await stravaStatus((await getUser()).supabase);
  const age = a.birthDate ? `${Math.floor(daysBetween(a.birthDate, today) / 365.25)} anni` : null;
  const body = [age, a.heightCm && `${a.heightCm} cm`, a.weightKg && `${a.weightKg} kg`].filter(Boolean).join(" · ");

  return (
    <>
      <PageHeader
        title="Profilo"
        subtitle={email ? `Collegato come ${email}` : "I tuoi dati, obiettivi e parametri di allenamento."}
        action={!demo && (
          <Link href="/profilo/modifica" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-fg px-4 text-sm font-semibold text-bg">
            <Pencil className="size-4" aria-hidden /> Modifica
          </Link>
        )}
      />

      <div className="flex flex-col gap-6">
        <Card className="flex items-center gap-4">
          <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-run to-bike text-2xl font-bold text-white">
            {a.name.charAt(0)}
          </span>
          <div className="min-w-0">
            <p className="text-xl font-bold">{a.name}</p>
            <p className="text-sm text-muted">{body || "Completa il profilo per iniziare"}</p>
            <div className="mt-2 flex flex-wrap gap-2">{a.sports.map((s) => <SportBadge key={s.sport} sport={s.sport} />)}</div>
          </div>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <section>
            <SectionTitle>Obiettivi ed eventi</SectionTitle>
            <Card>
              <dl>
                <Row label="Obiettivo principale">{a.goals.primary || dash}</Row>
                <Row label="Obiettivi secondari">{a.goals.secondary.join(" · ") || dash}</Row>
                {events.filter((e) => e.date >= today).map((e) => (
                  <Row key={e.id} label={`Gara ${e.priority}`}>
                    {e.name}
                    <span className="block text-xs text-muted">{eventDescription(e)}</span>
                  </Row>
                ))}
              </dl>
              {!demo && <Link href="/profilo/gare" className="mt-3 flex min-h-11 items-center justify-center rounded-xl border border-line text-sm font-semibold hover:border-faint">Gestisci le gare</Link>}
            </Card>
          </section>

          <section>
            <SectionTitle>Disponibilità</SectionTitle>
            <Card>
              <dl>
                <Row label="Ore a settimana">{a.weeklyHoursAvailable !== undefined ? `${a.weeklyHoursAvailable} h` : dash}</Row>
                <Row label="Giorni">{a.availableDays.join(", ") || dash}</Row>
                <Row label="Seduta più lunga">{a.maxSessionMin ? `${a.maxSessionMin} minuti` : dash}</Row>
                <Row label="Attrezzatura">{a.equipment.join(", ") || dash}</Row>
                <Row label="Limitazioni">{a.limitations.join(", ") || "Nessuna"}</Row>
              </dl>
            </Card>
          </section>

          <section>
            <SectionTitle>Livello</SectionTitle>
            <Card>
              <dl>
                {a.sports.map((s) => (
                  <Row key={s.sport} label={sportLabel(s.sport)}>
                    <span className="capitalize">{s.level}</span>
                    <span className="block text-xs text-muted">{s.yearsExperience} anni di esperienza{s.weeklyVolume ? ` · ${s.weeklyVolume}` : ""}</span>
                  </Row>
                ))}
                {a.swim && (
                  <Row label="Nuoto: dettagli">
                    {[a.swim.poolLengthM && `Vasca da ${a.swim.poolLengthM} m`, a.swim.openWater && "acque libere", a.swim.wetsuit && "con muta"].filter(Boolean).join(" · ") || dash}
                    <span className="block text-xs text-muted">{a.swim.strokes.join(", ")}</span>
                  </Row>
                )}
                {!a.sports.length && <p className="py-2 text-sm text-muted">Nessuno sport scelto.</p>}
              </dl>
            </Card>
          </section>

          <section>
            <SectionTitle>Parametri attuali</SectionTitle>
            <Card>
              <dl>
                {a.thresholdPaceSecPerKm && (
                  <Row label="Ritmo di soglia">
                    <span className="flex items-center justify-end gap-2">{formatPace(a.thresholdPaceSecPerKm.value)} <OriginTag origin={a.thresholdPaceSecPerKm.origin} /></span>
                    <span className="block text-xs text-muted">dal test del {formatDayMonth(a.thresholdPaceSecPerKm.date, false)}</span>
                  </Row>
                )}
                {a.cssPaceSecPer100m && (
                  <Row label="Ritmo CSS (nuoto)">
                    <span className="flex items-center justify-end gap-2">{formatSwimPace(a.cssPaceSecPer100m.value)} <OriginTag origin={a.cssPaceSecPer100m.origin} /></span>
                    <span className="block text-xs text-muted">dal test del {formatDayMonth(a.cssPaceSecPer100m.date, false)}</span>
                  </Row>
                )}
                {a.ftpW && (
                  <Row label="FTP">
                    <span className="flex items-center justify-end gap-2">{a.ftpW.value} W <OriginTag origin={a.ftpW.origin} /></span>
                    <span className="block text-xs text-muted">{a.weightKg ? `${(a.ftpW.value / a.weightKg).toFixed(1).replace(".", ",")} W/kg · ` : ""}dal test del {formatDayMonth(a.ftpW.date, false)}</span>
                  </Row>
                )}
              </dl>
              {!a.thresholdPaceSecPerKm && !a.ftpW && !a.cssPaceSecPer100m && <p className="py-2 text-sm text-muted">Ancora nessun test: il coach usa l&apos;RPE.</p>}
              <Link href="/test" className="mt-3 flex min-h-11 items-center justify-center rounded-xl border border-line text-sm font-semibold hover:border-faint">Test e parametri</Link>
            </Card>
          </section>
        </div>

        {a.ftpW && (
          <section>
            <SectionTitle hint={<OriginTag origin="stimato" />}>Zone di potenza (Coggan)</SectionTitle>
            <Card className="p-0 sm:p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm tabular-nums">
                  <thead className="text-left text-xs text-muted">
                    <tr><th className="px-4 py-3 font-medium">Zona</th><th className="px-4 py-3 font-medium">Nome</th><th className="px-4 py-3 text-right font-medium">Watt</th></tr>
                  </thead>
                  <tbody>
                    {powerZones(a.ftpW.value).map((z) => (
                      <tr key={z.zone} className="border-t border-line">
                        <td className="px-4 py-3"><span className="inline-block size-2.5 rounded-sm bg-bike" style={{ opacity: 0.25 + z.zone * 0.125 }} /> Z{z.zone}</td>
                        <td className="px-4 py-3">{z.name}</td>
                        <td className="px-4 py-3 text-right">{z.maxW === null ? `> ${z.minW}` : `${z.minW} – ${z.maxW}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>
        )}

        <section>
          <SectionTitle>Scheda di palestra</SectionTitle>
          <Card className="flex flex-col gap-3">
            {a.gymSchedule?.length ? (
              <ul className="flex flex-col gap-1 text-sm">
                {a.gymSchedule.map((g) => <li key={g.day}><b>{g.day}</b> · {[g.groups.join(", "), g.exercises?.length ? `${g.exercises.length} esercizi` : ""].filter(Boolean).join(" · ")} · {g.durationMin}&apos;</li>)}
              </ul>
            ) : (
              <p className="text-sm text-muted">Hai una scheda a giorni fissi (es. lunedì petto e tricipiti, giovedì gambe)? Inseriscila: il coach ci costruisce intorno il programma e ti avvisa dei conflitti.</p>
            )}
            <Link href="/profilo/palestra" className="inline-flex min-h-11 items-center self-start rounded-xl border border-line px-4 text-sm font-semibold hover:border-faint">
              {a.gymSchedule?.length ? "Modifica la scheda e leggi i consigli" : "Inserisci la scheda"}
            </Link>
          </Card>
        </section>

        <section id="strava" className="scroll-mt-4">
          <SectionTitle>Strava</SectionTitle>
          <StravaSection status={strStatus} esito={strava} demo={demo} />
        </section>

        <section>
          <SectionTitle>App sul telefono</SectionTitle>
          <Card className="flex flex-col gap-3">
            <p className="text-sm text-muted">Installa Coach sulla schermata Home: si apre a schermo intero come un&apos;app, su iPhone e Android.</p>
            <InstallApp />
          </Card>
        </section>

        <section>
          <SectionTitle>I tuoi dati</SectionTitle>
          <p className="mb-3 text-sm text-muted">Come li trattiamo: <Link href="/privacy" className="font-semibold text-fg underline">privacy</Link>.</p>
          {demo ? (
            <p className="text-sm text-muted">Esportazione e cancellazione sono disponibili quando accedi con il tuo account.</p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <a href="/api/esporta" className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-line bg-surface text-sm font-semibold hover:border-faint">
                  <Download className="size-5" aria-hidden /> Esporta i miei dati (JSON)
                </a>
                <form action={signOut}>
                  <button className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-line bg-surface text-sm font-semibold hover:border-faint">
                    <LogOut className="size-5" aria-hidden /> Esci
                  </button>
                </form>
              </div>
              <details className="rounded-2xl border border-bad/30 bg-surface p-4">
                <summary className="flex min-h-8 cursor-pointer items-center gap-2 text-sm font-semibold text-bad">
                  <Trash2 className="size-4" aria-hidden /> Cancella account e tutti i dati
                </summary>
                <form action={deleteAccount} className="mt-4 flex flex-col gap-3">
                  <p className="text-sm text-muted">Profilo, programmi, attività, feedback e test vengono eliminati per sempre. Prima puoi esportarli.</p>
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Per confermare scrivi CANCELLA
                    <input id="confirm" name="confirm" autoComplete="off" className="min-h-12 rounded-xl border border-line bg-bg px-4 text-base outline-none focus:border-bad" />
                  </label>
                  <button className="min-h-12 rounded-xl bg-bad text-sm font-semibold text-white">Cancella definitivamente</button>
                </form>
              </details>
              {errore === "conferma" && <p role="alert" className="text-sm text-bad">Per cancellare l&apos;account scrivi CANCELLA nel campo di conferma.</p>}
              {errore === "cancellazione" && <p role="alert" className="text-sm text-bad">Cancellazione non riuscita. Riprova tra poco.</p>}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
