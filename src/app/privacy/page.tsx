import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Privacy · Adaptive Coach AI" };
export const dynamic = "force-static";

function S({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-6 py-6">
      <Link href="/" className="inline-flex min-h-11 w-fit items-center gap-2 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> Torna all&apos;app
      </Link>
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Privacy</h1>
        <p className="mt-1 text-sm text-muted">Come Adaptive Coach AI tratta i tuoi dati, in parole semplici.</p>
      </header>

      <S title="Quali dati">
        <p>L&apos;email e la password dell&apos;account (la password è gestita da Supabase e nessuno può leggerla).</p>
        <p>
          Il profilo che compili (età, sesso, peso, altezza, sport praticati, disponibilità, attrezzatura, limitazioni fisiche, obiettivi),
          le gare, il programma, gli allenamenti registrati con i loro dati (durata, distanza, frequenza cardiaca, potenza, intertempi),
          il tuo feedback (sforzo, fatica, sonno, dolori, note), i test e le conversazioni con il coach AI.
          Alcuni di questi sono <b className="text-fg">dati relativi alla salute</b>: li usi tu per allenarti e servono solo a questo.
        </p>
        <p>Per limitare gli abusi: un contatore giornaliero delle richieste al coach AI e, per i tentativi di accesso sbagliati, solo impronte cifrate (non leggibili) di indirizzo IP ed email, cancellate dopo un giorno.</p>
      </S>

      <S title="Dove sono e chi li vede">
        <p>
          I dati sono nel database Supabase del progetto, nella regione scelta alla creazione (Unione Europea, Irlanda), protetti da regole
          che permettono a ogni account di leggere e modificare solo i propri dati. L&apos;app è ospitata su Vercel.
        </p>
        <p>
          Quando usi il coach AI o carichi uno screenshot, il messaggio, i dati di allenamento necessari alla risposta e l&apos;immagine vengono
          inviati a OpenAI tramite la sua API, alle condizioni di OpenAI per l&apos;API. Gli screenshot non vengono salvati dall&apos;app:
          resta solo ciò che confermi nel modulo.
        </p>
        <p>Non ci sono pubblicità, profilazione commerciale o strumenti di analisi del traffico. I dati non vengono venduti né ceduti.</p>
      </S>

      <S title="Cookie">
        <p>Solo cookie tecnici, necessari per restare collegati al tuo account. Nessun cookie di tracciamento.</p>
      </S>

      <S title="Sul telefono">
        <p>L&apos;app installata conserva solo i file dell&apos;interfaccia e una pagina &quot;sei offline&quot;. Programma, attività e conversazioni non vengono salvati sul dispositivo.</p>
      </S>

      <S title="I tuoi diritti">
        <p>Dal <Link href="/profilo" className="font-semibold text-fg underline">Profilo</Link> puoi in ogni momento:</p>
        <ul className="list-disc pl-5">
          <li>modificare i dati del profilo;</li>
          <li>esportare tutti i tuoi dati in un file JSON;</li>
          <li>cancellare l&apos;account e tutti i dati, per sempre;</li>
          <li>cancellare singole attività e conversazioni con il coach.</li>
        </ul>
        <p>Il consenso dato alla registrazione si revoca cancellando l&apos;account.</p>
      </S>

      <S title="Non è un servizio medico">
        <p>
          Adaptive Coach AI dà indicazioni di allenamento. Non fa diagnosi e non sostituisce medico, fisioterapista o allenatore qualificato.
          Con dolore che non passa, malessere o dubbi sulla salute, rivolgiti a un professionista.
        </p>
      </S>
    </article>
  );
}
