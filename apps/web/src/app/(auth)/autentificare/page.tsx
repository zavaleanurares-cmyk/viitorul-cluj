import { redirect } from "next/navigation";
import { homePath } from "@club/shared";
import { getSession } from "@/lib/auth";
import { getT } from "@/messages";
import { SignInForm } from "./form";
import Link from "next/link";
import { demoLoginEnabled } from "@/lib/demo";

export const metadata = { title: "Autentificare" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ inapoi?: string }> }) {
  const session = await getSession();
  if (session) redirect(homePath(session.ctx.role));
  const { inapoi } = await searchParams;
  const t = getT().auth.signIn;
  return (
    <>
      <h1 className="text-2xl">{t.title}</h1>
      <p className="mb-6 mt-2 text-[0.9375rem] text-ink-3">{t.intro}</p>
      <SignInForm next={inapoi ?? null} />
      {demoLoginEnabled() ? (
        <p className="mt-4 border-t border-line pt-4 text-center">
          <Link href="/demo" className="inline-flex min-h-11 items-center font-medium text-st-blue hover:underline">{t.demo}</Link>
        </p>
      ) : null}
    </>
  );
}
