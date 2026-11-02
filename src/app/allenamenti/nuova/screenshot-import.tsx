"use client";

import { Camera, ImageUp, TriangleAlert } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { analyzeScreenshot } from "@/app/coach/actions";
import { ActivityForm } from "@/components/activity-form";
import { fieldLabel, type Extraction } from "@/lib/ai/screenshot";
import { SPORTS } from "@/lib/domain/sports";
import type { Sport } from "@/lib/domain/types";
import { formatDuration } from "@/lib/training/formulas";

/** Riduce l'immagine nel browser (max 1600 px, JPEG): meno dati inviati, meno costi, nessun file salvato. */
async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function ScreenshotImport({ today, sports, enabled, demo }: { today: string; sports: Sport[]; enabled: boolean; demo: boolean }) {
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Extraction | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setResult(null);
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) return setError("Carica un'immagine (JPG, PNG, WEBP o foto dell'iPhone).");
    if (file.size > 15_000_000) return setError("Immagine troppo grande.");
    start(async () => {
      try {
        const dataUrl = await shrink(file);
        setPreview(dataUrl);
        const r = await analyzeScreenshot(dataUrl);
        if ("error" in r) setError(r.error);
        else setResult(r.extraction);
      } catch {
        setError("Non riesco ad aprire questa immagine. Prova con uno screenshot in JPG o PNG.");
      }
    });
  };

  const sport: Sport | undefined = result?.sport && sports.includes(result.sport) ? result.sport : result?.sport ?? undefined;
  const recognized = result
    ? ([
        ["App", result.app],
        ["Sport", result.sport && SPORTS[result.sport].label],
        ["Data", result.data],
        ["Durata", result.durata_minuti && formatDuration(result.durata_minuti)],
        ["Distanza", result.distanza_km && `${result.distanza_km.toLocaleString("it-IT")} km`],
        ["Passo", result.passo],
        ["Velocità", result.velocita_kmh && `${result.velocita_kmh.toLocaleString("it-IT")} km/h`],
        ["FC media", result.fc_media && `${result.fc_media} bpm`],
        ["Potenza", result.potenza_media_w && `${result.potenza_media_w} W`],
        ["Dislivello", result.dislivello_m !== null && result.dislivello_m !== undefined ? `${result.dislivello_m} m` : null],
        ["Intervalli", result.intervalli],
      ] as const).filter(([, v]) => v)
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[var(--radius-card)] border border-dashed border-faint bg-surface/50 p-4 sm:p-5">
        <p className="flex items-center gap-2 font-semibold"><Camera className="size-5" aria-hidden /> Da uno screenshot</p>
        <p className="mt-1 text-sm text-muted">Strava, Garmin Connect, Apple Salute o un&apos;altra app: il coach legge i dati, tu controlli e confermi. L&apos;immagine non viene salvata.</p>
        <input ref={input} type="file" accept="image/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        <button type="button" disabled={!enabled || demo || busy} onClick={() => input.current?.click()} className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-xl bg-fg px-5 text-sm font-semibold text-bg disabled:opacity-50">
          <ImageUp className="size-5" aria-hidden /> {busy ? "Leggo lo screenshot..." : "Scegli uno screenshot"}
        </button>
        {!enabled && !demo && <p className="mt-2 text-xs text-muted">Serve la chiave OpenAI per leggere gli screenshot.</p>}
        {error && <p role="alert" className="mt-3 text-sm text-bad">{error}</p>}
      </div>

      {result && (
        <>
          <div className="grid gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:grid-cols-[8rem_1fr] sm:p-5">
            {/* eslint-disable-next-line @next/next/no-img-element -- anteprima locale, non ottimizzabile */}
            {preview && <img src={preview} alt="Screenshot caricato" className="max-h-56 w-full rounded-xl object-contain sm:w-32" />}
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Ho letto questi dati</p>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {recognized.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted">{k}</dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
              {(result.illeggibili.length > 0 || result.scartati.length > 0) && (
                <p className="mt-3 flex gap-2 rounded-xl bg-warn/10 px-3 py-2 text-sm text-warn">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    {result.illeggibili.length > 0 && <>Non leggibili: {result.illeggibili.map(fieldLabel).join(", ")}. </>}
                    {result.scartati.length > 0 && <>Scartati perché non plausibili: {result.scartati.join(", ")}. </>}
                    Completali tu se li conosci.
                  </span>
                </p>
              )}
              {!result.data && <p className="mt-2 text-xs text-muted">La data non era nello screenshot: ho messo oggi, correggila se serve.</p>}
            </div>
          </div>
          <p className="text-sm text-muted">Controlla i valori qui sotto, aggiungi il tuo feedback e salva. Se l&apos;attività è già registrata, te lo segnalo.</p>
          <ActivityForm
            key={JSON.stringify(result)}
            defaults={{
              date: result.data ?? today,
              sport,
              title: result.titolo ?? undefined,
              durationMin: result.durata_minuti ?? undefined,
              distanceKm: result.distanza_km ?? undefined,
              avgHr: result.fc_media ? Math.round(result.fc_media) : undefined,
              avgPowerW: result.potenza_media_w ? Math.round(result.potenza_media_w) : undefined,
              elevationM: result.dislivello_m !== null ? Math.round(result.dislivello_m) : undefined,
              source: "screenshot",
            }}
            sports={sports}
            today={today}
            demo={demo}
          />
        </>
      )}
    </div>
  );
}
