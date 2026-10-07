"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

/**
 * „Înapoi": dacă pagina a primit `?inapoi=/cale`, este un link către acea cale (merge și la deschidere directă);
 * altfel folosește istoricul browserului, cu o cale de rezervă dacă nu există istoric.
 */
export function BackButton({ href, fallback, label }: { href: string | null; fallback: string; label: string }) {
  const router = useRouter();
  const cls = buttonClass("ghost", "md", "-ml-3 pl-2 pr-3");
  if (href) {
    return (
      <Link href={href} className={cls}>
        <ChevronLeft className="size-5" aria-hidden />
        {label}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={cls}
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallback);
      }}
    >
      <ChevronLeft className="size-5" aria-hidden />
      {label}
    </button>
  );
}
