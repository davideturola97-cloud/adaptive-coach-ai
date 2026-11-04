"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const pace = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, "0")}`;

/** Passo (in alto = più veloce) e frequenza cardiaca, parziale per parziale. */
export function PaceHrChart({ data, bike }: { data: { n: number; pace?: number; hr?: number }[]; bike?: boolean }) {
  const rows = data.map((d) => ({ ...d, speed: bike && d.pace ? Math.round((3600 / d.pace) * 10) / 10 : undefined }));
  return (
    <div>
      <div className="-ml-2 h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="n" tickLine={false} axisLine={false} tickFormatter={(v) => (bike ? `${v}` : `${v} km`)} interval="preserveStartEnd" minTickGap={16} />
          {bike ? (
            <YAxis yAxisId="p" dataKey="speed" tickLine={false} axisLine={false} width={40} domain={["auto", "auto"]} tickFormatter={(v) => `${v}`} />
          ) : (
            <YAxis yAxisId="p" dataKey="pace" reversed tickLine={false} axisLine={false} width={40} domain={["auto", "auto"]} tickFormatter={pace} />
          )}
          <YAxis yAxisId="h" orientation="right" dataKey="hr" tickLine={false} axisLine={false} width={34} domain={["auto", "auto"]} />
          <Tooltip
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs shadow-xl shadow-black/40">
                  <p className="mb-1 text-muted">{bike ? `Parziale ${label}` : `Km ${label}`}</p>
                  {payload.map((p) => (
                    <p key={String(p.dataKey)} className="tabular-nums">
                      {p.dataKey === "hr" ? `FC ${p.value} bpm` : p.dataKey === "speed" ? `${p.value} km/h` : `${pace(Number(p.value))} /km`}
                    </p>
                  ))}
                </div>
              ) : null
            }
          />
          <Line yAxisId="p" type="monotone" dataKey={bike ? "speed" : "pace"} stroke={bike ? "var(--color-bike)" : "var(--color-run)"} strokeWidth={2.5} dot={false} connectNulls />
          <Line yAxisId="h" type="monotone" dataKey="hr" stroke="var(--color-estimate)" strokeWidth={2} strokeDasharray="4 3" dot={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
      </div>
      <p className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4" style={{ background: bike ? "var(--color-bike)" : "var(--color-run)" }} />{bike ? "Velocità" : "Passo (in alto = più veloce)"}</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 border-t-2 border-dashed border-estimate" />FC (scala a destra)</span>
      </p>
    </div>
  );
}
