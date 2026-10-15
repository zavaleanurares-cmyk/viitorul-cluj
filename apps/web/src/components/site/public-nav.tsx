"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/** Meniul site-ului public: o bandă care derulează orizontal pe telefon. */
export function PublicNav({ items, base }: { items: Array<{ href: string; label: string }>; base: string }) {
  const path = usePathname();
  if (items.length < 2) return null;
  const active = (href: string) => (href === base ? path === base : path === href || path.startsWith(href + "/"));
  return (
    <nav aria-label="Meniu" className="mx-auto max-w-5xl overflow-x-auto px-1">
      <ul className="flex gap-1">
        {items.map((i) => (
          <li key={i.href}>
            <Link href={i.href} aria-current={active(i.href) ? "page" : undefined}
              className={cn("flex h-11 items-center whitespace-nowrap px-3 text-[0.9375rem] transition-colors", active(i.href) ? "font-semibold text-ink" : "font-medium text-ink-3 hover:text-ink")}>
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
