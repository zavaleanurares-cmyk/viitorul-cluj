import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireCapability } from "@/lib/auth";
import { PageHeader } from "@/components/ui/card";
import { getT } from "@/messages";
import { TfbWizard } from "@/components/imports/tfb-wizard";

/** Migrarea din The Football Brain (administrarea clubului). */
export default async function Page() {
  const { ctx } = await requireCapability("administerClub");
  const t = getT().tfb;
  const back = ctx.role === "physio" ? { href: "/import", label: getT().imports.title } : { href: "/administrare/club", label: getT().admin.club.title };
  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        back={(
          <Link href={back.href} className="inline-flex h-10 items-center gap-1 font-semibold text-ink-3 hover:text-ink">
            <ChevronLeft className="size-5" aria-hidden />{back.label}
          </Link>
        )}
      />
      <TfbWizard today={ctx.today} />
    </>
  );
}
