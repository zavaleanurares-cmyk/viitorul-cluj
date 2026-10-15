"use server";
import { z } from "zod";
import { parseLei } from "@club/shared";
import { fail, run } from "@/lib/actions";
import { deleteFiles } from "@/lib/storage";
import { getT } from "@/messages";

const t = getT().club.shop;
const OFFICE = ["admin", "secretary", "accountant"] as const;
const PATHS = ["/club/magazin", "/magazin"];

const Product = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  category: z.enum(["kit", "training", "accessories", "other"]),
  price: z.string().max(20),
  photoPaths: z.array(z.string().max(300)).max(6),
  kind: z.enum(["item", "bundle"]),
  sizeKind: z.enum(["apparel", "shoes", "none"]),
  active: z.boolean(),
  variants: z.array(z.object({ size: z.string().max(12).nullable(), stock: z.coerce.number().int().min(0).max(100000) })).max(40),
  bundleItems: z.array(z.uuid()).max(10),
});
export type ProductInput = z.input<typeof Product>;

export async function saveProduct(input: ProductInput) {
  return run<{ id: string }>({ roles: [...OFFICE], revalidate: PATHS }, async ({ db }) => {
    const r = Product.safeParse(input);
    if (!r.success) fail(t.errors.invalid);
    const v = r.data;
    const price = parseLei(v.price);
    if (price === null || price < 0) fail(t.errors.price);
    const before = v.id ? (await db.from("shop_products").select("photo_paths").eq("id", v.id).maybeSingle()).data : null;
    const { data, error } = await db.rpc("save_product", {
      p: {
        id: v.id ?? "", name: v.name, description: v.description ?? "", category: v.category, price, photo_paths: v.photoPaths,
        kind: v.kind, size_kind: v.sizeKind, is_active: v.active,
        variants: v.sizeKind === "none" ? [{ size: null, stock: v.variants[0]?.stock ?? 0 }] : v.variants, bundle_items: v.bundleItems,
      },
    });
    if (error) throw error;
    const gone = (before?.photo_paths ?? []).filter((p: string) => !v.photoPaths.includes(p));
    if (gone.length) await deleteFiles(db, "shop", gone);
    return { id: data as string };
  });
}

export async function setOrderStatus(input: { id: string; status: "ready" | "picked_up" | "placed" }) {
  return run({ roles: [...OFFICE], revalidate: PATHS }, async ({ db }) => {
    const v = z.object({ id: z.uuid(), status: z.enum(["ready", "picked_up", "placed"]) }).parse(input);
    const { error } = await db.rpc("set_order_status", { p_id: v.id, p_status: v.status });
    if (error) throw error;
    return null;
  });
}

/** Biroul sau familia (cât timp comanda nu e pregătită; verificat în baza de date). */
export async function cancelOrder(input: { id: string; reason: string }) {
  return run({ revalidate: [...PATHS, "/plati"] }, async ({ db }) => {
    const v = z.object({ id: z.uuid(), reason: z.string().max(500) }).parse(input);
    const { error } = await db.rpc("cancel_order", { p_id: v.id, p_reason: v.reason });
    if (error) throw error;
    return null;
  });
}

const Item = z.object({
  productId: z.uuid(), variantId: z.uuid().nullable(), qty: z.number().int().min(1).max(20),
  components: z.array(z.object({ productId: z.uuid(), variantId: z.uuid() })).max(10),
});

export async function placeOrder(input: { playerId: string; items: Array<z.input<typeof Item>>; note: string }) {
  return run<{ id: string; number: number; total: number }>({ revalidate: [...PATHS, "/plati", "/azi"] }, async ({ db }) => {
    const v = z.object({ playerId: z.uuid(), items: z.array(Item).min(1).max(30), note: z.string().max(500) }).parse(input);
    const { data, error } = await db.rpc("place_order", {
      p_player: v.playerId, p_note: v.note,
      p_items: v.items.map((i) => ({ product_id: i.productId, variant_id: i.variantId, qty: i.qty, components: i.components.map((c) => ({ product_id: c.productId, variant_id: c.variantId })) })),
    });
    if (error) throw error;
    return data as { id: string; number: number; total: number };
  });
}
