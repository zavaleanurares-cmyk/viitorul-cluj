import { ShoppingBag } from "lucide-react";
import { formatDate, formatLei } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/status";
import { TabLinks } from "@/components/ui/misc";
import { OrderActions, ProductButton } from "@/components/club/shop-admin";
import { getT } from "@/messages";

export const metadata = { title: "Magazin" };

type View = "open" | "ready" | "done" | "cancelled" | "products";
const SLUG: Record<string, View> = { gata: "ready", predate: "done", anulate: "cancelled", produse: "products" };
const STATUS: Record<Exclude<View, "products">, string> = { open: "placed", ready: "ready", done: "picked_up", cancelled: "cancelled" };

type Item = { id: string; title: string; size: string | null; qty: number; unit_price: number; parent_id: string | null };

export default async function ShopAdmin({ searchParams }: { searchParams: Promise<{ vedere?: string }> }) {
  const { db, ctx } = await requireCapability("manageShop");
  const t = getT().club.shop;
  const view: View = SLUG[(await searchParams).vedere ?? ""] ?? "open";
  const tab = (v: View, label: string) => ({ key: v, href: `/club/magazin${v === "open" ? "" : `?vedere=${Object.keys(SLUG).find((k) => SLUG[k] === v)}`}`, label });
  const [{ data: products }, { data: counts }] = await Promise.all([
    db.from("shop_products").select("id, name, description, category, price, photo_paths, kind, size_kind, is_active, shop_variants(size, stock, sort), shop_bundle_items!shop_bundle_items_bundle_id_fkey(product_id)").order("sort").order("name"),
    db.from("shop_orders").select("status").in("status", ["placed", "ready"]),
  ]);
  const nOpen = (counts ?? []).filter((x) => x.status === "placed").length;
  const nReady = (counts ?? []).filter((x) => x.status === "ready").length;
  const items = (products ?? []).filter((p) => p.kind === "item").map((p) => ({ id: p.id, name: p.name }));
  const header = (
    <>
      <PageHeader title={t.title} description={t.description}
        action={<div className="flex flex-wrap gap-2"><ProductButton clubId={ctx.club.id} kind="bundle" items={items} /><ProductButton clubId={ctx.club.id} items={items} /></div>} />
      <TabLinks className="mb-4" current={view} tabs={[
        tab("open", `${t.orders.views.open}${nOpen ? ` · ${nOpen}` : ""}`), tab("ready", `${t.orders.views.ready}${nReady ? ` · ${nReady}` : ""}`),
        tab("done", t.orders.views.done), tab("cancelled", t.orders.views.cancelled), tab("products", t.tabs.products),
      ]} />
    </>
  );

  if (view === "products") {
    return (
      <>
        {header}
        {!products?.length ? <EmptyState icon={<ShoppingBag className="size-8" aria-hidden />} title={t.products.empty} /> : (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {products.map((p) => {
              const vars = [...((p.shop_variants ?? []) as Array<{ size: string | null; stock: number; sort: number }>)].sort((a, b) => a.sort - b.sort);
              const total = vars.reduce((s, x) => s + x.stock, 0);
              const bundle = ((p.shop_bundle_items ?? []) as Array<{ product_id: string }>).map((b) => b.product_id);
              return (
                <li key={p.id} className="flex gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3">
                  {p.photo_paths[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/files/shop/${p.photo_paths[0]}`} alt="" className="size-24 shrink-0 rounded-[var(--radius-control)] object-cover" />
                  ) : <span className="flex size-24 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-sunken"><ShoppingBag className="size-8 text-ink-3" aria-hidden /></span>}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start gap-2">
                      <span className="flex-1 font-semibold">{p.name}</span>
                      <ProductButton clubId={ctx.club.id} items={items} product={{
                        id: p.id, name: p.name, description: p.description ?? "", category: p.category as "kit", price: String(p.price / 100).replace(".", ","),
                        photoPaths: p.photo_paths, kind: p.kind as "item", sizeKind: p.size_kind as "apparel", active: p.is_active,
                        variants: vars.map((x) => ({ size: x.size, stock: x.stock })), bundleItems: bundle,
                      }} />
                    </div>
                    <p className="text-sm text-ink-3">{t.categories[p.category as keyof typeof t.categories]} · <span className="font-semibold text-ink">{formatLei(p.price)}</span></p>
                    <div className="flex flex-wrap gap-1">
                      {!p.is_active ? <Badge tone="gray">{t.products.hidden}</Badge> : null}
                      {p.kind === "bundle" ? <Badge tone="blue">{t.products.bundle}: {bundle.map((id) => items.find((x) => x.id === id)?.name).filter(Boolean).join(" + ")}</Badge> : (
                        total === 0 ? <Badge tone="red">{t.products.outOfStock}</Badge> : null
                      )}
                    </div>
                    {p.kind === "item" ? (
                      <p className="flex flex-wrap gap-x-2 gap-y-0.5 text-sm tabular-nums">
                        {vars.map((x) => <span key={x.size ?? "-"} className={x.stock === 0 ? "text-ink-3 line-through" : x.stock <= 2 ? "font-semibold text-st-red" : "text-ink-2"}>{x.size ?? t.oneSize}: {x.stock}</span>)}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </>
    );
  }

  const { data: orders } = await db.from("shop_orders").select("id, number, child_name, status, total, charge_id, note, created_at, cancel_reason, shop_order_items(id, title, size, qty, unit_price, parent_id)")
    .eq("status", STATUS[view]).order("created_at", { ascending: view === "open" || view === "ready" }).limit(300);
  const chargeIds = (orders ?? []).map((o) => o.charge_id).filter(Boolean) as string[];
  const { data: bal } = chargeIds.length ? await db.from("charge_balances").select("id, state").in("id", chargeIds) : { data: [] };
  const paid = new Map((bal ?? []).map((b) => [b.id, b.state === "paid" || b.state === "waived"]));
  // lista de pregătire: pe produs și mărime, din comenzile noi
  const pick = new Map<string, number>();
  if (view === "open") for (const o of orders ?? []) {
    const lines = (o.shop_order_items ?? []) as Item[];
    for (const i of lines) {
      if (lines.some((x) => x.parent_id === i.id)) continue; // antetul unui pachet: se pregătesc produsele din el
      const k = `${i.title}|${i.size ?? ""}`;
      pick.set(k, (pick.get(k) ?? 0) + i.qty);
    }
  }
  return (
    <>
      {header}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        {!orders?.length ? <EmptyState icon={<ShoppingBag className="size-8" aria-hidden />} title={t.orders.empty} /> : (
          <ul className="space-y-3">
            {orders.map((o) => {
              const lines = (o.shop_order_items ?? []) as Item[];
              return (
                <li key={o.id} className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{t.orderNo(o.number)} · {o.child_name}</p>
                      <p className="text-sm text-ink-3">{t.orders.placedOn(formatDate(o.created_at.slice(0, 10)))}</p>
                    </div>
                    <span className="text-lg font-bold tabular-nums">{formatLei(o.total)}</span>
                    {o.charge_id ? <Badge tone={paid.get(o.charge_id) ? "green" : "outline"}>{paid.get(o.charge_id) ? t.orders.paid : t.orders.unpaid}</Badge> : null}
                  </div>
                  <ul className="mt-2 space-y-0.5 text-ink-2">
                    {lines.filter((l) => !l.parent_id).map((l) => (
                      <li key={l.id}>
                        {l.qty} × {l.title}{l.size ? ` · ${l.size}` : ""}
                        {lines.some((x) => x.parent_id === l.id) ? <span className="text-sm text-ink-3"> ({lines.filter((x) => x.parent_id === l.id).map((x) => `${x.title} ${x.size ?? ""}`.trim()).join(", ")})</span> : null}
                      </li>
                    ))}
                  </ul>
                  {o.note ? <p className="mt-2 rounded-[var(--radius-control)] bg-sunken px-3 py-2 text-sm">{o.note}</p> : null}
                  {o.cancel_reason ? <p className="mt-2 text-sm text-ink-3">{o.cancel_reason}</p> : null}
                  <div className="mt-3"><OrderActions id={o.id} status={o.status} /></div>
                </li>
              );
            })}
          </ul>
        )}
        {view === "open" ? (
          <aside>
            <h2 className="mb-2 text-lg">{t.orders.pickList}</h2>
            {!pick.size ? <p className="text-sm text-ink-3">{t.orders.pickListEmpty}</p> : (
              <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface text-sm">
                {[...pick.entries()].sort().map(([k, n]) => {
                  const [title, size] = k.split("|");
                  return <li key={k} className="flex justify-between gap-2 px-3 py-2"><span>{title}{size ? ` · ${size}` : ""}</span><span className="font-bold tabular-nums">{n}</span></li>;
                })}
              </ul>
            )}
          </aside>
        ) : null}
      </div>
    </>
  );
}
