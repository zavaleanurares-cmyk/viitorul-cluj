import { ShoppingBag } from "lucide-react";
import { formatDate, formatLei } from "@club/shared";
import { requireRole } from "@/lib/auth";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/status";
import { FamilyClubTabs } from "@/components/club/family-tabs";
import { ShopFront, type FrontProduct } from "@/components/club/shop-front";
import { CancelOwnOrder } from "@/components/club/shop-family";
import { getT } from "@/messages";

export const metadata = { title: "Magazin" };
const TONE = { placed: "yellow", ready: "green", picked_up: "gray", cancelled: "gray" } as const;

export default async function FamilyShop() {
  const { db, ctx } = await requireRole("guardian", "player");
  const t = getT().club.shop;
  const [{ data: products }, { data: kids }, { data: orders }] = await Promise.all([
    db.from("shop_products").select("id, name, description, category, price, photo_paths, kind, shop_variants(id, size, stock, sort), shop_bundle_items!shop_bundle_items_bundle_id_fkey(product_id)").eq("is_active", true).order("sort").order("name"),
    db.from("players").select("id, full_name, kit_size, birth_date").eq("is_active", true).order("full_name"),
    db.from("shop_orders").select("id, number, child_name, status, total, created_at, shop_order_items(title, size, qty, parent_id)").order("created_at", { ascending: false }).limit(20),
  ]);
  const vs = (p: { shop_variants: Array<{ id: string; size: string | null; stock: number; sort: number }> | null }) =>
    [...(p.shop_variants ?? [])].sort((a, b) => a.sort - b.sort).map((x) => ({ id: x.id, size: x.size, stock: x.stock }));
  const all = products ?? [];
  const front: FrontProduct[] = all.map((p) => ({
    id: p.id, name: p.name, description: p.description, category: p.category, price: p.price, photo: p.photo_paths[0] ?? null, kind: p.kind as "item" | "bundle",
    variants: vs(p as never),
    components: ((p.shop_bundle_items ?? []) as Array<{ product_id: string }>).map((b) => all.find((x) => x.id === b.product_id)).filter(Boolean)
      .map((c) => ({ id: c!.id, name: c!.name, variants: vs(c as never) })),
  })).filter((p) => p.kind === "item" ? p.variants.length > 0 : p.components.length > 0);
  const minorPlayer = ctx.role === "player" && (!ctx.player?.birth_date || ctx.player.birth_date > `${Number(ctx.today.slice(0, 4)) - 18}${ctx.today.slice(4)}`);
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="mx-auto max-w-2xl lg:max-w-none"><FamilyClubTabs current="shop" /></div>
      <PageHeader title={t.family.title} description={t.family.description} />
      {orders?.length ? (
        <section>
          <h2 className="mb-2 text-lg">{t.family.mine}</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
            {orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{t.orderNo(o.number)} · {formatLei(o.total)}</span>
                  <span className="block text-sm text-ink-3">{o.child_name} · {formatDate(o.created_at.slice(0, 10))} · {((o.shop_order_items ?? []) as Array<{ title: string; size: string | null; qty: number; parent_id: string | null }>).filter((i) => !i.parent_id).map((i) => `${i.qty} × ${i.title}${i.size ? ` ${i.size}` : ""}`).join(", ")}</span>
                </span>
                <Badge tone={TONE[o.status as keyof typeof TONE]}>{t.status[o.status as keyof typeof t.status]}</Badge>
                {o.status === "placed" ? <CancelOwnOrder id={o.id} /> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {!front.length ? <EmptyState icon={<ShoppingBag className="size-8" aria-hidden />} title={t.family.empty} />
        : minorPlayer ? <p className="text-ink-2">{t.family.askParent}</p>
        : <ShopFront products={front} kids={(kids ?? []).map((k) => ({ id: k.id, name: k.full_name, kitSize: k.kit_size }))} />}
    </div>
  );
}
