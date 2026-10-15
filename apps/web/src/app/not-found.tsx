import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-3xl">Pagina nu există</h1>
      <p className="max-w-sm text-ink-3">Fie adresa este greșită, fie nu ai acces la această pagină.</p>
      <Link href="/" className={buttonClass("primary", "lg", "mt-2")}>
        Mergi la pagina de start
      </Link>
    </main>
  );
}
