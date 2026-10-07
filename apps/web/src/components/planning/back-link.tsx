import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex h-10 items-center gap-1 font-semibold text-ink-3 hover:text-ink">
      <ChevronLeft className="size-5" aria-hidden />{children}
    </Link>
  );
}
