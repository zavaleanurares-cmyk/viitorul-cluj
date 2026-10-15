import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/ui/card";
import { TabLinks } from "@/components/ui/misc";
import { getT } from "@/messages";

export function SiteHeader({ slug, current, action }: { slug: string; current: "news" | "gallery" | "settings" | "privacy"; action?: React.ReactNode }) {
  const t = getT().club.website;
  return (
    <>
      <PageHeader title={t.title} description={t.description}
        action={<div className="flex flex-wrap gap-2">
          <a href={`/c/${slug}`} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full px-4 font-medium hover:bg-line bg-sunken transition-colors"><ExternalLink className="size-5" aria-hidden />{t.open}</a>
          {action}
        </div>} />
      <TabLinks className="mb-4" current={current} tabs={[
        { key: "news", href: "/club/site", label: t.tabs.news },
        { key: "gallery", href: "/club/site/galerie", label: t.tabs.gallery },
        { key: "settings", href: "/club/site/setari", label: t.tabs.settings },
        { key: "privacy", href: "/club/site/confidentialitate", label: t.tabs.privacy },
      ]} />
    </>
  );
}
