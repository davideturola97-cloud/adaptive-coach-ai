import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getAppData } from "@/lib/data/repository";
import { OnboardingWizard } from "./wizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const data = await getAppData();
  if (data.mode === "demo") redirect("/");
  return (
    <>
      <PageHeader title="Conosciamoci" subtitle="Cinque passi per costruire un programma su misura. Puoi cambiare tutto in seguito dal Profilo." />
      <OnboardingWizard a={data.athlete} />
    </>
  );
}
