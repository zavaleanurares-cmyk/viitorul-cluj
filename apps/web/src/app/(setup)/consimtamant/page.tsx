import { redirect } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { CONSENT_VERSION, consentAudience, consentText, homePath, isMinor } from "@club/shared";
import { requireSession } from "@/lib/auth";
import { Notice } from "@/components/ui/card";
import { getT } from "@/messages";
import { ConsentForm } from "./form";

export const metadata = { title: "Acord" };

export default async function ConsentPage() {
  const { ctx } = await requireSession({ allowPendingSetup: true });
  if (ctx.profile.must_change_password) redirect("/parola?prima=1");
  if (ctx.consentAccepted) redirect(homePath(ctx.role));
  const t = getT().auth.consent;
  const minor = ctx.role === "player" && isMinor(ctx.player?.birth_date, ctx.today) === true;
  const text = consentText(consentAudience(ctx.role, minor), ctx.club.name);

  return (
    <>
      <h1 className="text-3xl">{text.title}</h1>
      <p className="mt-3 text-lg">{text.intro}</p>
      {minor ? <Notice tone="yellow" className="mt-4">{t.minorNote}</Notice> : null}
      <ul className="mt-5 space-y-3">
        {text.points.map((p, i) => (
          <li key={i} className="flex gap-3 text-ink-2">
            <CircleCheck className="mt-0.5 size-5 shrink-0 text-ink-3" aria-hidden />
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <ConsentForm minor={minor} acceptLabel={text.accept} />
      {minor ? <p className="mt-4 text-sm text-ink-3">{t.paperAlternative}</p> : null}
      <p className="mt-6 text-xs text-ink-3">
        {t.version}: {CONSENT_VERSION}
      </p>
    </>
  );
}
