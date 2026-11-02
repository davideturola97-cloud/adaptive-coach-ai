import { WifiOff } from "lucide-react";

export const metadata = { title: "Sei offline · Adaptive Coach AI" };
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <WifiOff className="size-10 text-muted" aria-hidden />
      <h1 className="text-2xl font-bold">Sei offline</h1>
      <p className="text-muted">
        Per vedere il programma e registrare gli allenamenti serve la connessione: i tuoi dati non vengono salvati sul telefono.
        Appena torni online, riprova.
      </p>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- ricarica completa: serve a riprovare la rete */}
      <a href="/" className="inline-flex min-h-12 items-center rounded-xl bg-fg px-5 font-semibold text-bg">Riprova</a>
    </div>
  );
}
