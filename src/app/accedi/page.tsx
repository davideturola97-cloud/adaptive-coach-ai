import { Activity } from "lucide-react";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { AuthForm } from "./auth-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ errore?: string }> }) {
  if (!isSupabaseConfigured()) redirect("/");
  const { errore } = await searchParams;
  return (
    <div className="mx-auto flex min-h-[80dvh] max-w-sm flex-col justify-center gap-8 py-10">
      <div className="flex flex-col items-start gap-4">
        <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-run to-bike">
          <Activity className="size-6 text-white" aria-hidden />
        </span>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Adaptive Coach AI</h1>
          <p className="mt-1 text-muted">Il tuo programma di corsa e ciclismo, che si adatta alla tua settimana.</p>
        </div>
      </div>
      <AuthForm linkError={errore === "link"} />
    </div>
  );
}
