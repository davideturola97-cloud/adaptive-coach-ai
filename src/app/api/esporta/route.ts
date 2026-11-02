import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

const TABLES = ["profiles", "athlete_sports", "events", "planned_workouts", "activities", "feedback", "test_results"] as const;

/** Esporta tutti i dati dell'utente collegato in un file JSON. RLS garantisce che escano solo le sue righe. */
export async function GET() {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Esportazione non disponibile in modalità dimostrativa" }, { status: 400 });
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const out: Record<string, unknown> = { esportato_il: new Date().toISOString(), account: { id: user.id, email: user.email, creato_il: user.created_at } };
  for (const t of TABLES) {
    const { data, error } = await supabase.from(t).select("*");
    if (error) return NextResponse.json({ error: `Esportazione non riuscita (${t})` }, { status: 500 });
    out[t] = data;
  }
  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="adaptive-coach-dati-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
