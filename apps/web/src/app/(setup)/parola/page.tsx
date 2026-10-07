import { requireSession } from "@/lib/auth";
import { Notice } from "@/components/ui/card";
import { getT } from "@/messages";
import { PasswordForm } from "./form";

export const metadata = { title: "Parolă nouă" };

export default async function PasswordPage({ searchParams }: { searchParams: Promise<{ prima?: string }> }) {
  await requireSession({ allowPendingSetup: true });
  const { prima } = await searchParams;
  const t = getT().auth.password;
  return (
    <>
      <h1 className="mb-4 text-3xl">{t.title}</h1>
      {prima ? <Notice className="mb-5">{t.firstTime}</Notice> : null}
      <PasswordForm />
    </>
  );
}
