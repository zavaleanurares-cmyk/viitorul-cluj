"use client";
import { useMemo, useState } from "react";
import { Minus, Plus, ShoppingBag, ShoppingCart, Trash2 } from "lucide-react";
import { formatLei } from "@club/shared";
import { Button, IconButton } from "@/components/ui/button";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { cn } from "@/lib/cn";
import { placeOrder } from "@/app/(app)/club/magazin/actions";

export type FrontVariant = { id: string; size: string | null; stock: number };
export type FrontProduct = {
  id: string; name: string; description: string | null; category: string; price: number; photo: string | null; kind: "item" | "bundle";
  variants: FrontVariant[]; components: Array<{ id: string; name: string; variants: FrontVariant[] }>;
};
type Line = { key: string; product: FrontProduct; variantId: string | null; size: string | null; qty: number; components: Array<{ productId: string; variantId: string; label: string }> };

/** Magazinul pentru familie: alegi mărimea (implicit mărimea copilului), adaugi în coș, comanzi pentru un copil. */
export function ShopFront({ products, kids }: { products: FrontProduct[]; kids: Array<{ id: string; name: string; kitSize: string | null }> }) {
  const t = useT().club.shop;
  const toast = useToast();
  const [cart, setCart] = useState<Line[]>([]);
  const [kid, setKid] = useState(kids[0]?.id ?? "");
  const [note, setNote] = useState("");
  const kitSize = kids.find((k) => k.id === kid)?.kitSize ?? null;
  const total = useMemo(() => cart.reduce((s, l) => s + l.product.price * l.qty, 0), [cart]);
  const order = useAction(placeOrder, { successMessage: false, onSuccess: (r) => { setCart([]); setNote(""); toast(t.family.placed(r.number)); } });
  const add = (l: Omit<Line, "key">) => {
    const key = `${l.product.id}|${l.variantId ?? ""}|${l.components.map((c) => c.variantId).join(",")}`;
    setCart((c) => (c.some((x) => x.key === key) ? c.map((x) => (x.key === key ? { ...x, qty: Math.min(20, x.qty + l.qty) } : x)) : [...c, { ...l, key }]));
    toast(t.family.added);
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <ul className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        {products.map((p) => <ProductCard key={p.id} product={p} kitSize={kitSize} onAdd={add} />)}
      </ul>
      <aside className="space-y-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 lg:sticky lg:top-4 lg:self-start" aria-labelledby="cos">
        <h2 id="cos" className="flex items-center gap-2 text-lg"><ShoppingCart className="size-5" aria-hidden />{t.family.cart}</h2>
        {!cart.length ? <p className="text-ink-3">{t.family.cartEmpty}</p> : (
          <>
            <ul className="divide-y divide-line">
              {cart.map((l) => (
                <li key={l.key} className="flex items-start gap-2 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{l.product.name}</span>
                    <span className="block text-sm text-ink-3">{l.size ?? (l.components.length ? l.components.map((c) => c.label).join(", ") : t.oneSize)}</span>
                    <span className="mt-1 flex items-center gap-1">
                      <IconButton label="−" className="size-8" onClick={() => setCart(cart.map((x) => (x.key === l.key ? { ...x, qty: Math.max(1, x.qty - 1) } : x)))}><Minus className="size-4" aria-hidden /></IconButton>
                      <span className="w-6 text-center tabular-nums">{l.qty}</span>
                      <IconButton label="+" className="size-8" onClick={() => setCart(cart.map((x) => (x.key === l.key ? { ...x, qty: Math.min(20, x.qty + 1) } : x)))}><Plus className="size-4" aria-hidden /></IconButton>
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">{formatLei(l.product.price * l.qty)}</span>
                  <IconButton label={t.family.remove} className="size-9" onClick={() => setCart(cart.filter((x) => x.key !== l.key))}><Trash2 className="size-4" aria-hidden /></IconButton>
                </li>
              ))}
            </ul>
            {kids.length > 1 ? (
              <Field label={t.family.for}><Select value={kid} onChange={(e) => setKid(e.target.value)}>{kids.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</Select></Field>
            ) : <p className="text-sm text-ink-2">{t.family.for}: <span className="font-semibold">{kids[0]?.name}</span></p>}
            <Field label={t.family.note} optional><Input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} /></Field>
            <FormError>{order.error}</FormError>
            <Button className="w-full" size="lg" disabled={!kid} pending={order.pending} icon={<ShoppingBag className="size-5" aria-hidden />}
              onClick={() => order.run({ playerId: kid, note, items: cart.map((l) => ({ productId: l.product.id, variantId: l.variantId, qty: l.qty, components: l.components.map((c) => ({ productId: c.productId, variantId: c.variantId })) })) })}>
              {t.family.place(formatLei(total))}
            </Button>
          </>
        )}
      </aside>
    </div>
  );
}

function ProductCard({ product: p, kitSize, onAdd }: { product: FrontProduct; kitSize: string | null; onAdd: (l: Omit<Line, "key">) => void }) {
  const t = useT().club.shop;
  const pickDefault = (vs: FrontVariant[]) => (vs.length === 1 ? vs[0].id : vs.find((v) => v.size === kitSize && v.stock > 0)?.id ?? "");
  const [variant, setVariant] = useState(() => pickDefault(p.variants));
  const [comps, setComps] = useState<Record<string, string>>(() => Object.fromEntries(p.components.map((c) => [c.id, pickDefault(c.variants)])));
  const [qty, setQty] = useState(1);
  const v = p.variants.find((x) => x.id === variant);
  const soldOut = p.kind === "item" ? p.variants.every((x) => x.stock === 0) : p.components.some((c) => c.variants.every((x) => x.stock === 0));
  const ready = p.kind === "item" ? !!v && v.stock >= qty : p.components.every((c) => (c.variants.find((x) => x.id === comps[c.id])?.stock ?? 0) >= qty);
  return (
    <li className={cn("flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface", soldOut && "opacity-70")}>
      {p.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/files/shop/${p.photo}`} alt="" loading="lazy" className="aspect-square w-full object-cover" />
      ) : <span className="flex aspect-square items-center justify-center bg-sunken"><ShoppingBag className="size-10 text-ink-3" aria-hidden /></span>}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <span className="font-semibold">{p.name}</span>
          <span className="shrink-0 font-bold tabular-nums">{formatLei(p.price)}</span>
        </div>
        {p.description ? <p className="text-sm text-ink-3">{p.description}</p> : null}
        {kitSize && (p.kind === "bundle" || p.variants.some((x) => x.size)) ? <p className="text-xs text-ink-3">★ {t.family.childSize(kitSize)}</p> : null}
        <div className="mt-auto space-y-2">
          {p.kind === "item" ? <SizeSelect kitSize={kitSize} vs={p.variants} value={variant} onChange={setVariant} label={t.family.size} /> : (
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-ink-2">{t.family.bundleSizes}</legend>
              {p.components.map((c) => <SizeSelect key={c.id} kitSize={kitSize} vs={c.variants} value={comps[c.id] ?? ""} onChange={(id) => setComps({ ...comps, [c.id]: id })} label={c.name} />)}
            </fieldset>
          )}
          <div className="flex items-end gap-2">
            <Field label={t.family.qty} className="w-20"><Input type="number" min={1} max={20} value={String(qty)} onChange={(e) => setQty(Math.min(20, Math.max(1, Number(e.target.value) || 1)))} /></Field>
            <Button className="flex-1" disabled={!ready} icon={<Plus className="size-5" aria-hidden />}
              onClick={() => onAdd({
                product: p, variantId: p.kind === "item" ? variant : null, size: p.kind === "item" ? (v?.size ?? null) : null, qty,
                components: p.components.map((c) => ({ productId: c.id, variantId: comps[c.id], label: `${c.name} ${c.variants.find((x) => x.id === comps[c.id])?.size ?? ""}`.trim() })),
              })}>{t.family.add}</Button>
          </div>
        </div>
      </div>
    </li>
  );
}

function SizeSelect({ vs, value, onChange, label, kitSize }: { vs: FrontVariant[]; value: string; onChange: (id: string) => void; label: string; kitSize: string | null }) {
  const t = useT().club.shop;
  if (vs.length === 1 && !vs[0].size) return null;
  return (
    <Field label={label}>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t.family.pickSize}</option>
        {vs.map((x) => <option key={x.id} value={x.id} disabled={x.stock === 0}>{x.size ?? t.oneSize}{x.size === kitSize ? " ★" : ""}{x.stock === 0 ? ` · ${t.family.left(0)}` : x.stock <= 3 ? ` · ${t.family.left(x.stock)}` : ""}</option>)}
      </Select>
    </Field>
  );
}
