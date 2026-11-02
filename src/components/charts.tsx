"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipProps } from "recharts";

type Row = Record<string, string | number | null>;

export interface Series {
  key: string;
  label: string;
  color: string;
  format: (v: number) => string;
}

function ChartTooltip({ active, payload, label, series, labelFormat }: TooltipProps<number, string> & { series: Series[]; labelFormat?: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs shadow-xl shadow-black/40">
      <p className="mb-1 text-muted">{labelFormat ? labelFormat(String(label)) : label}</p>
      {series.map((s) => {
        const p = payload.find((x) => x.dataKey === s.key);
        if (!p || p.value == null) return null;
        return (
          <p key={s.key} className="flex items-center justify-between gap-4 tabular-nums">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="font-semibold text-fg">{s.format(Number(p.value))}</span>
          </p>
        );
      })}
    </div>
  );
}

export function StackedBars({ data, xKey, series, yFormat, labelFormat, height = 240 }: { data: Row[]; xKey: string; series: Series[]; yFormat: (v: number) => string; labelFormat?: (l: string) => string; height?: number }) {
  return (
    <div style={{ height }} className="-ml-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickFormatter={labelFormat} interval="preserveStartEnd" minTickGap={12} />
          <YAxis tickLine={false} axisLine={false} tickFormatter={yFormat} width={40} allowDecimals={false} />
          <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={<ChartTooltip series={series} labelFormat={labelFormat} />} />
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} stackId="a" fill={s.color} radius={i === series.length - 1 ? [4, 4, 0, 0] : 0} maxBarSize={36} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Lines({ data, xKey, series, yFormat, labelFormat, height = 220, reversed = false, domain }: { data: Row[]; xKey: string; series: Series[]; yFormat: (v: number) => string; labelFormat?: (l: string) => string; height?: number; reversed?: boolean; domain?: [number | "auto", number | "auto"] }) {
  return (
    <div style={{ height }} className="-ml-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickFormatter={labelFormat} interval="preserveStartEnd" minTickGap={12} />
          <YAxis tickLine={false} axisLine={false} tickFormatter={yFormat} width={48} reversed={reversed} domain={domain ?? ["auto", "auto"]} />
          <Tooltip cursor={{ stroke: "var(--color-faint)" }} content={<ChartTooltip series={series} labelFormat={labelFormat} />} />
          {series.map((s) => (
            <Line key={s.key} type="linear" dataKey={s.key} stroke={s.color} strokeWidth={2} dot={{ r: 3, fill: s.color, strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* Grafici pronti per le pagine: le funzioni di formato stanno qui, lato client. */

const MONTHS_SHORT = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const dayMonth = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
};
const hours = (min: number) => {
  const m = Math.round(min);
  return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}'` : `${m}'`;
};
const pace = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

const inHours = (v: number) => `${v}h`;
const hoursFromH = (h: number) => hours(h * 60);

export function VolumeChart({ data }: { data: { weekStart: string; runMin: number; bikeMin: number; swimMin: number; gymMin: number }[] }) {
  const all = [
    { key: "swimH", min: "swimMin", label: "Nuoto", color: "var(--color-swim)" },
    { key: "bikeH", min: "bikeMin", label: "Ciclismo", color: "var(--color-bike)" },
    { key: "runH", min: "runMin", label: "Corsa", color: "var(--color-run)" },
    { key: "gymH", min: "gymMin", label: "Palestra", color: "var(--color-gym)" },
  ] as const;
  const used = all.filter((s) => data.some((d) => d[s.min] > 0));
  return (
    <StackedBars
      data={data.map((d) => Object.fromEntries([["weekStart", d.weekStart], ...used.map((s) => [s.key, d[s.min] / 60])]))}
      xKey="weekStart"
      labelFormat={dayMonth}
      yFormat={inHours}
      series={used.map((s) => ({ key: s.key, label: s.label, color: s.color, format: hoursFromH }))}
    />
  );
}

export function RunKmChart({ data }: { data: { weekStart: string; runKm: number }[] }) {
  return (
    <StackedBars
      data={data}
      xKey="weekStart"
      labelFormat={dayMonth}
      height={200}
      yFormat={(v) => `${v}`}
      series={[{ key: "runKm", label: "Corsa", color: "var(--color-run)", format: (v) => `${v.toLocaleString("it-IT")} km` }]}
    />
  );
}

export function BikeHoursChart({ data }: { data: { weekStart: string; bikeMin: number }[] }) {
  return (
    <StackedBars
      data={data.map((d) => ({ weekStart: d.weekStart, bikeH: d.bikeMin / 60 }))}
      xKey="weekStart"
      labelFormat={dayMonth}
      height={200}
      yFormat={inHours}
      series={[{ key: "bikeH", label: "Ciclismo", color: "var(--color-bike)", format: hoursFromH }]}
    />
  );
}

export function LoadChart({ data }: { data: { weekStart: string; load: number }[] }) {
  return (
    <StackedBars
      data={data}
      xKey="weekStart"
      labelFormat={dayMonth}
      height={200}
      yFormat={(v) => `${v}`}
      series={[{ key: "load", label: "Carico (min × RPE)", color: "var(--color-warn)", format: (v) => v.toLocaleString("it-IT") }]}
    />
  );
}

export function AdherenceChart({ data }: { data: { weekStart: string; adherence: number | null }[] }) {
  return (
    <Lines
      data={data}
      xKey="weekStart"
      labelFormat={dayMonth}
      height={200}
      domain={[0, 100]}
      yFormat={(v) => `${v}%`}
      series={[{ key: "adherence", label: "Aderenza", color: "var(--color-ok)", format: (v) => `${Math.round(v)}%` }]}
    />
  );
}

export function PaceChart({ data }: { data: { weekStart: string; easyPace: number | null }[] }) {
  return (
    <Lines
      data={data}
      xKey="weekStart"
      labelFormat={dayMonth}
      reversed
      yFormat={pace}
      series={[{ key: "easyPace", label: "Ritmo medio corse facili", color: "var(--color-run)", format: (v) => `${pace(v)} /km` }]}
    />
  );
}
