import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getAppData } from "@/lib/data/repository";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

export default async function EditProfilePage() {
  const data = await getAppData();
  if (data.mode === "demo") redirect("/profilo");
  return (
    <>
      <Link href="/profilo" className="mb-2 inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> Profilo
      </Link>
      <PageHeader title="Modifica profilo" subtitle="Questi dati servono al coach per costruire il tuo programma. Li vedi solo tu." />
      <ProfileForm a={data.athlete} />
    </>
  );
}
