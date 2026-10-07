import { redirect } from "next/navigation";
import { homePath } from "@club/shared";
import { getSession } from "@/lib/auth";
import { getT } from "@/messages";
import { SignInForm } from "./form";

export const metadata = { title: "Autentificare" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ inapoi?: string }> }) {
  const session = await getSession();
  if (session) redirect(homePath(session.ctx.role));
  const { inapoi } = await searchParams;
  const t = getT().auth.signIn;
  return (
    <>
      <h1 className="text-3xl">{t.title}</h1>
      <p className="mb-6 mt-1 text-ink-3">{t.intro}</p>
      <SignInForm next={inapoi ?? null} />
    </>
  );
}
