import Link from "next/link";
import { notFound } from "next/navigation";
import { DEMO_ROLES, DEMO_SLUG, demoLoginEnabled } from "@/lib/demo";
import { getT } from "@/messages";
import { DemoRoles } from "./roles";

export const metadata = { title: "Demo" };

export default function DemoPage() {
  if (!demoLoginEnabled()) notFound();
  const t = getT().auth;
  return (
    <>
      <h1 className="text-3xl">{t.demo.title}</h1>
      <p className="mb-6 mt-1 text-ink-3">{t.demo.intro}</p>
      <DemoRoles roles={[...DEMO_ROLES]} />
      <div className="mt-6 grid gap-1 text-center">
        <Link href={`/c/${DEMO_SLUG}`} className="inline-flex h-11 items-center justify-center font-semibold underline">{t.demo.site}</Link>
        <Link href="/autentificare" className="inline-flex h-11 items-center justify-center text-ink-2 underline">{t.demo.signIn}</Link>
      </div>
    </>
  );
}
