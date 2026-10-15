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
    <nav aria-label="Meniu" className="mx-auto max-w-5xl overflow-x-auto px-2">
      <ul className="flex gap-1">
        {items.map((i) => (
          <li key={i.href}>
            <Link href={i.href} aria-current={active(i.href) ? "page" : undefined}
              className={cn("flex h-12 items-center whitespace-nowrap border-b-[3px] px-3 font-semibold", active(i.href) ? "border-current" : "border-transparent opacity-85 hover:opacity-100")}>
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
