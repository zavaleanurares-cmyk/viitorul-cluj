import type { SiteBlock } from "@club/shared";

/**
 * Corpul unei știri, din blocurile editorului. Același cod pe site, în aplicație și în previzualizarea
 * editorului; `mediaBase` spune de unde vin imaginile (/c/<slug>/media sau /api/files/site).
 */
export function BlocksView({ blocks, mediaBase }: { blocks: SiteBlock[]; mediaBase: string }) {
  return (
    <div className="space-y-5 text-lg leading-relaxed">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "heading":
            return b.text.trim() ? <h2 key={i} className="pt-2 text-2xl">{b.text}</h2> : null;
          case "paragraph":
            return b.text.trim() ? <p key={i} className="whitespace-pre-line">{b.text}</p> : null;
          case "quote":
            return b.text.trim() ? (
              <blockquote key={i} className="border-l-4 border-brand pl-4 text-xl italic text-ink-2">
                <p className="whitespace-pre-line">„{b.text}”</p>
                {b.by ? <footer className="mt-1 text-base not-italic text-ink-3">— {b.by}</footer> : null}
              </blockquote>
            ) : null;
          case "list":
            return b.items.some((x) => x.trim()) ? (
              <ul key={i} className="list-disc space-y-1 pl-6">{b.items.filter((x) => x.trim()).map((x, k) => <li key={k}>{x}</li>)}</ul>
            ) : null;
          case "image":
            return b.path ? (
              <figure key={i} className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${mediaBase}/${b.path}`} alt={b.alt ?? ""} loading="lazy" className="w-full rounded-[var(--radius-card)] bg-sunken object-cover" />
                {b.caption ? <figcaption className="text-sm text-ink-3">{b.caption}</figcaption> : null}
              </figure>
            ) : null;
          default:
            return null;
        }
      })}
    </div>
  );
}
