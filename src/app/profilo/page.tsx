import { Download, Trash2 } from "lucide-react";
import { Card, OriginTag, PageHeader, SectionTitle, SportBadge } from "@/components/ui";
import { daysBetween, formatDayMonth } from "@/lib/dates";
import { getData } from "@/lib/demo/store";
import { formatPace, powerZones } from "@/lib/training/formulas";

export const dynamic = "force-dynamic";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-3 last:border-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right text-sm font-medium">{children}</dd>
    </div>
  );
}

export default function ProfilePage() {
  const { athlete: a, events, today } = getData();
  const age = Math.floor(daysBetween(a.birthDate, today) / 365.25);

  return (
    <>
      <PageHeader title="Profilo" subtitle="I tuoi dati, obiettivi e parametri di allenamento." />

      <div className="flex flex-col gap-6">
        <Card className="flex items-center gap-4">
          <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-run to-bike text-2xl font-bold text-white">
            {a.name.charAt(0)}
          </span>
          <div className="min-w-0">
            <p className="text-xl font-bold">{a.name}</p>
            <p className="text-sm text-muted">{age} anni · {a.heightCm} cm · {a.weightKg} kg</p>
            <div className="mt-2 flex flex-wrap gap-2">{a.sports.map((s) => <SportBadge key={s.sport} sport={s.sport} />)}</div>
          </div>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <section>
            <SectionTitle>Obiettivi ed eventi</SectionTitle>
            <Card>
              <dl>
                <Row label="Obiettivo principale">{a.goals.primary}</Row>
                <Row label="Obiettivi secondari">{a.goals.secondary.join(" · ")}</Row>
                {events.map((e) => (
                  <Row key={e.id} label={`Evento ${e.priority}`}>
                    {e.name}
                    <span className="block text-xs text-muted">{formatDayMonth(e.date, false)} · {e.distanceKm} km</span>
                  </Row>
                ))}
              </dl>
            </Card>
          </section>

          <section>
            <SectionTitle>Disponibilità</SectionTitle>
            <Card>
              <dl>
                <Row label="Ore a settimana">{a.weeklyHoursAvailable} h</Row>
                <Row label="Giorni">{a.availableDays.join(", ")}</Row>
                <Row label="Seduta più lunga">{a.maxSessionMin} minuti</Row>
                <Row label="Attrezzatura">{a.equipment.join(", ")}</Row>
                <Row label="Limitazioni">{a.limitations.join(", ") || "Nessuna"}</Row>
              </dl>
            </Card>
          </section>

          <section>
            <SectionTitle>Livello</SectionTitle>
            <Card>
              <dl>
                {a.sports.map((s) => (
                  <Row key={s.sport} label={s.sport === "run" ? "Corsa" : "Ciclismo"}>
                    <span className="capitalize">{s.level}</span>
                    <span className="block text-xs text-muted">{s.yearsExperience} anni di esperienza</span>
                  </Row>
                ))}
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
                {a.ftpW && (
                  <Row label="FTP">
                    <span className="flex items-center justify-end gap-2">{a.ftpW.value} W <OriginTag origin={a.ftpW.origin} /></span>
                    <span className="block text-xs text-muted">{(a.ftpW.value / a.weightKg).toFixed(1).replace(".", ",")} W/kg · dal test del {formatDayMonth(a.ftpW.date, false)}</span>
                  </Row>
                )}
              </dl>
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
          <SectionTitle>I tuoi dati</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <button disabled className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-line bg-surface text-sm font-semibold text-faint">
              <Download className="size-5" aria-hidden /> Esporta i miei dati
            </button>
            <button disabled className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-bad/30 bg-surface text-sm font-semibold text-bad/50">
              <Trash2 className="size-5" aria-hidden /> Cancella account e dati
            </button>
          </div>
          <p className="mt-2 text-xs text-faint">Modifica del profilo, esportazione e cancellazione arrivano con la Milestone 2.</p>
        </section>
      </div>
    </>
  );
}
