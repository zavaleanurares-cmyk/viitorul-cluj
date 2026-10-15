export type PublicSponsor = { name: string; tier: string; url: string | null; logo_path: string | null };

/** Sponsorii afișați pe site: sigla (sau numele), cu link spre site-ul firmei. */
export function SponsorStrip({ sponsors, media, title }: { sponsors: PublicSponsor[]; media: string; title: string }) {
  if (!sponsors.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-2xl">{title}</h2>
      <ul className="flex flex-wrap items-center gap-3">
        {sponsors.map((s) => {
          const inner = s.logo_path ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`${media}/${s.logo_path}`} alt={s.name} className={s.tier === "main" ? "h-16 w-auto max-w-56 object-contain" : "h-12 w-auto max-w-40 object-contain"} />
          ) : <span className={s.tier === "main" ? "text-xl font-bold" : "font-semibold"}>{s.name}</span>;
          return (
            <li key={s.name} className="flex min-h-20 items-center rounded-[var(--radius-card)] border border-line bg-white px-5 py-3">
              {s.url ? <a href={s.url} target="_blank" rel="noreferrer sponsored">{inner}</a> : inner}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
