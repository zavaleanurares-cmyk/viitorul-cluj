import type { CSSProperties } from "react";

function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function isHexColor(v: unknown): v is string {
  return typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v.trim());
}

/** Text alb sau închis pe culoarea clubului — se alege varianta cu contrast mai mare. */
export function inkOn(hex: string): string {
  const l = luminance(hex);
  const white = 1.05 / (l + 0.05);
  const dark = (l + 0.05) / (luminance("#0e1726") + 0.05);
  return white >= dark ? "#ffffff" : "#0e1726";
}

/** Variabilele CSS ale temei clubului (siglă + culori configurabile). */
export function clubThemeStyle(club: { primary_color: string; accent_color: string }): CSSProperties {
  const primary = isHexColor(club.primary_color) ? club.primary_color : "#12305a";
  const accent = isHexColor(club.accent_color) ? club.accent_color : primary;
  const ink = inkOn(primary);
  return {
    "--club-primary": primary,
    "--club-primary-ink": ink,
    "--club-accent": accent,
    // Variabilele Tailwind (`bg-brand`, `text-brand-ink`) sunt declarate pe :root, unde `var(--club-primary)`
    // este deja rezolvată la valoarea implicită; de aceea le setăm și direct, pe elementul cu tema clubului.
    "--color-brand": primary,
    "--color-brand-ink": ink,
    "--color-accent": accent,
  } as CSSProperties;
}
