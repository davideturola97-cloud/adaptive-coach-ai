"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { profileFromForm } from "@/lib/domain/profile-schema";
import { persistProfile } from "@/lib/data/mutations";
import { getUser } from "@/lib/supabase/server";

export type ProfileState = { errors?: string[] };

export async function updateProfile(_: ProfileState, fd: FormData): Promise<ProfileState> {
  const parsed = profileFromForm(fd);
  if (!parsed.success) return { errors: [...new Set(parsed.error.issues.map((i) => i.message))] };
  const p = parsed.data;

  const { supabase, user } = await getUser();
  if (!user) return { errors: ["Sessione scaduta: accedi di nuovo."] };

  const error = await persistProfile(supabase, user.id, p);
  if (error) return { errors: [error] };

  revalidatePath("/", "layout");
  redirect("/profilo");
}

export async function deleteAccount(fd: FormData) {
  if (fd.get("confirm") !== "CANCELLA") redirect("/profilo?errore=conferma");
  const { supabase, user } = await getUser();
  if (!user) redirect("/accedi");
  const { error } = await supabase.rpc("delete_my_account");
  if (error) redirect("/profilo?errore=cancellazione");
  await supabase.auth.signOut();
  redirect("/accedi");
}
