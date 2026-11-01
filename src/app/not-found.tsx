import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-3 py-16">
      <h1 className="text-2xl font-bold">Pagina non trovata</h1>
      <p className="text-muted">L&apos;allenamento o la pagina che cerchi non esiste.</p>
      <Link href="/" className="min-h-11 rounded-xl bg-fg px-4 py-2.5 text-sm font-semibold text-bg">Torna alla Home</Link>
    </div>
  );
}
