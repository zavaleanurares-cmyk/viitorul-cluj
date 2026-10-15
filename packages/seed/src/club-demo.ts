/**
 * Clubul demo, faza 4 · Club: mesaje și contracte (apoi înscrieri, tabere, site, magazin, susținători).
 * Totul prin funcțiile aplicației, cu identitatea conturilor demo. Totul inventat.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import zlib from "node:zlib";
import { createDb, type Db } from "@club/db";
import { PRIVACY_POLICY_STARTER, STANDARD_CONTRACTS, addDays, slugify, todayIn } from "@club/shared";
import { writeLocalFile } from "./perf";
import { must } from "./common";

async function rpc<T>(db: Db, fn: string, args: Record<string, unknown>, label: string): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any).rpc(fn, args);
  if (error) throw new Error(`${label}: ${error.message}`);
  return data as T;
}

/** O semnătură desenată (PNG alb-negru, 360×120): o linie ondulată, ca să arate a semnătură în PDF. */
export function demoSignaturePng(): Buffer {
  const w = 360, h = 120;
  const px = new Uint8Array(w * h).fill(255);
  const dot = (x: number, y: number) => {
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const xx = Math.round(x) + dx, yy = Math.round(y) + dy;
      if (xx >= 0 && xx < w && yy >= 0 && yy < h) px[yy * w + xx] = 20;
    }
  };
  for (let t = 0; t <= 1; t += 0.0004) {
    const x = 20 + t * 320;
    const y = 62 + Math.sin(t * 19) * 26 * (1 - t * 0.6) + Math.sin(t * 61) * 6;
    dot(x, y);
  }
  for (let t = 0; t <= 1; t += 0.002) dot(150 + t * 190, 98 - t * 6); // sublinierea
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w + 1)] = 0; Buffer.from(px.subarray(y * w, (y + 1) * w)).copy(raw, y * (w + 1) + 1); }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 0; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

export async function seedClubDemo(admin: Db, clubId: string, ids: Record<string, string>): Promise<void> {
  const today = todayIn();
  await seedMessages(admin, clubId, ids, today);
  await seedContracts(admin, clubId, ids, today);
  await seedEnrolment(admin, clubId, ids, today);
  await seedCamps(admin, clubId, ids, today);
  await seedWebsite(admin, clubId, ids, today);
  await seedShop(admin, clubId, ids);
  await seedSupporters(admin, clubId, ids, today);
}

/** Suporteri: campania 230 pentru veniturile anului trecut, câteva formulare, trei sponsori (doi afișați pe site). */
async function seedSupporters(admin: Db, clubId: string, ids: Record<string, string>, today: string) {
  const { count } = await admin.from("support_campaigns").select("id", { count: "exact", head: true }).eq("club_id", clubId);
  if (count || !ids.contabil) return;
  const acc = createDb({ sub: ids.contabil, role: "authenticated" });
  const year = Number(today.slice(0, 4)) - 1;
  await rpc(acc, "save_campaign", { p: { income_year: year, title: `Redirecționare 3,5% · veniturile din ${year}`, goal: 150, deadline: `${year + 1}-05-25`, is_active: true } }, "campania 230");
  const people: Array<[string, string]> = [["Moldovan Ana", "received"], ["Rus Gheorghe", "submitted"], ["Pop Daniela", "submitted"], ["Sabău Ioan", "received"], ["Câmpean Lucia", "received"]];
  for (const [name, status] of people) await rpc(acc, "save_pledge", { p: { full_name: name, status, two_years: name.length % 2 === 0 } }, `formular ${name}`);
  const { data: club } = await admin.from("clubs").select("slug").eq("id", clubId).single();
  for (const name of ["Toma Radu", "Lazăr Elena"]) {
    await rpc(createDb({ role: "anon" }), "record_support_pledge", { p_slug: club!.slug, p_ip: `203.0.113.${name.length}`, p: { full_name: name, two_years: true, keep_contact: false } }, "formular de pe site");
  }
  const logo = (c0: string, c1: string) => {
    const img = demoImage(c0, c1);
    if (!img) return "";
    const p = `${clubId}/sponsor/${crypto.randomUUID()}.jpg`;
    return writeLocalFile("site", p, img) ? p : "";
  };
  await rpc(acc, "save_sponsor", { p: { name: "Construct Nord SRL", fiscal_code: "RO10000001", contact_name: "Andrei Mureșan", email: "contact@example.com", kind: "money", amount: 2500000,
    status: "signed", starts_on: `${year + 1}-01-01`, ends_on: `${year + 1}-12-31`, tier: "main", url: "https://example.com", logo_path: logo("12305a", "f2c14e"), show_on_site: true } }, "sponsor 1");
  await rpc(acc, "save_sponsor", { p: { name: "Farmacia Centrală", kind: "goods", amount: 300000, status: "paid", tier: "partner", logo_path: logo("0e5c3a", "ffffff"), show_on_site: true,
    notes: "Truse medicale pentru toate echipele." } }, "sponsor 2");
  await rpc(acc, "save_sponsor", { p: { name: "Transport Rapid", kind: "services", status: "negotiating", tier: "partner", contact_name: "Ioana Pop", phone: "0744000111" } }, "sponsor 3");
}

/** Magazin: tricou, șort, jambiere, trening, rucsac, pachetul de echipament; comenzile părintelui demo. */
async function seedShop(admin: Db, clubId: string, ids: Record<string, string>) {
  const { count } = await admin.from("shop_products").select("id", { count: "exact", head: true }).eq("club_id", clubId);
  if (count || !ids.secretariat) return;
  const office = createDb({ sub: ids.secretariat, role: "authenticated" });
  const photo = (c0: string, c1: string) => {
    const img = demoImage(c0, c1);
    if (!img) return [];
    const p = `${clubId}/${crypto.randomUUID()}.jpg`;
    return writeLocalFile("shop", p, img) ? [p] : [];
  };
  const sizes = (stock: number[]) => ["128", "140", "152", "164", "S", "M", "L"].map((size, i) => ({ size, stock: stock[i] ?? 0 }));
  const product = (p: Record<string, unknown>) => rpc<string>(office, "save_product", { p }, `produs ${p.name}`);
  const jersey = await product({ name: "Tricou de joc", description: "Tricoul oficial, cu emblema clubului. Numărul se imprimă la club.", category: "kit", price: 12000, kind: "item", size_kind: "apparel", photo_paths: photo("0e5c3a", "1f8a5a"), variants: sizes([4, 8, 6, 2, 3, 5, 1]) });
  const shorts = await product({ name: "Șort de joc", category: "kit", price: 6000, kind: "item", size_kind: "apparel", photo_paths: photo("ffffff", "0e5c3a"), variants: sizes([5, 9, 7, 4, 3, 2, 0]) });
  const socks = await product({ name: "Jambiere", category: "kit", price: 2500, kind: "item", size_kind: "none", photo_paths: photo("0e5c3a", "f2c14e"), variants: [{ size: null, stock: 40 }] });
  await product({ name: "Trening de prezentare", description: "Bluză și pantaloni, pentru deplasări.", category: "training", price: 24000, kind: "item", size_kind: "apparel", photo_paths: photo("12305a", "0e5c3a"), variants: sizes([2, 3, 3, 1, 2, 2, 1]) });
  await product({ name: "Rucsac", category: "accessories", price: 9000, kind: "item", size_kind: "none", photo_paths: photo("3a3a3a", "0e5c3a"), variants: [{ size: null, stock: 12 }] });
  const kit = await product({ name: "Pachet echipament de joc", description: "Tricou, șort și jambiere, cu 15 lei mai ieftin decât separat.", category: "kit", price: 17000, kind: "bundle", size_kind: "none", photo_paths: photo("f2c14e", "0e5c3a"), bundle_items: [jersey, shorts, socks] });
  if (!ids.parinte) return;
  const { data: g } = await admin.from("guardians").select("guardian_players(player_id)").eq("user_id", ids.parinte).eq("club_id", clubId).maybeSingle();
  const child = (g?.guardian_players as Array<{ player_id: string }> | undefined)?.[0]?.player_id;
  if (!child) return;
  const v = async (product: string, size: string | null) => {
    const q = admin.from("shop_variants").select("id").eq("product_id", product);
    return must((await (size === null ? q.is("size", null) : q.eq("size", size)).single()), "mărime").id;
  };
  const parent = createDb({ sub: ids.parinte, role: "authenticated" });
  await rpc(parent, "set_kit_size", { p_player: child, p_size: "152" }, "mărimea copilului");
  const first = await rpc<{ id: string }>(parent, "place_order", { p_player: child, p_note: null, p_items: [
    { product_id: kit, qty: 1, components: [{ product_id: jersey, variant_id: await v(jersey, "164") }, { product_id: shorts, variant_id: await v(shorts, "164") }, { product_id: socks, variant_id: await v(socks, null) }] },
  ] }, "comanda 1");
  await rpc(office, "set_order_status", { p_id: first.id, p_status: "ready" }, "gata");
  await rpc(office, "set_order_status", { p_id: first.id, p_status: "picked_up" }, "predată");
  await rpc(parent, "place_order", { p_player: child, p_note: "Dacă se poate, cu numărul 7.", p_items: [{ product_id: jersey, variant_id: await v(jersey, "164"), qty: 1 }] }, "comanda 2");
}

/** O imagine demo (degrade între două culori), doar dacă ffmpeg există. */
function demoImage(c0: string, c1: string): Buffer | null {
  try {
    const out = path.join(os.tmpdir(), `lr-img-${process.pid}-${crypto.randomUUID()}.jpg`);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", `gradients=s=1280x800:c0=0x${c0}:c1=0x${c1}:x0=0:y0=0:x1=1280:y1=800`, "-frames:v", "1", out], { stdio: "ignore", timeout: 30000 });
    const buf = fs.readFileSync(out);
    fs.unlinkSync(out);
    return buf;
  } catch {
    return null;
  }
}
function storeImage(clubId: string, kind: "post" | "foto", c0: string, c1: string): string | null {
  const img = demoImage(c0, c1);
  if (!img) return null;
  const p = `${clubId}/${kind}/${crypto.randomUUID()}.jpg`;
  return writeLocalFile("site", p, img) ? p : null;
}

/** Site: setări, politica (textul model), trei știri (site, aplicație, ciornă), o galerie cu acord foto. */
async function seedWebsite(admin: Db, clubId: string, ids: Record<string, string>, today: string) {
  const { count } = await admin.from("site_posts").select("id", { count: "exact", head: true }).eq("club_id", clubId);
  if (count || !ids.secretariat) return;
  const office = createDb({ sub: ids.secretariat, role: "authenticated" });
  const { data: club } = await admin.from("clubs").select("name").eq("id", clubId).single();
  const groups = (await admin.from("groups").select("id, name").eq("club_id", clubId)).data ?? [];
  const g = (n: string) => groups.find((x) => x.name === n)?.id;
  await rpc(office, "save_site_settings", { p: {
    tagline: "Fotbal pentru copii, juniori și seniori, din 1998.",
    about: "Clubul s-a născut dintr-o grupă de copii care se antrenau pe terenul școlii. Astăzi avem cinci echipe, antrenori licențiați și o bază proprie.\n\nCredem în fotbal jucat cu plăcere, în disciplină și în școală pe primul loc.",
    address: "Str. Stadionului 10, Cluj-Napoca", email: "contact@example.com", phone: "0264 000 000", map_url: "https://www.openstreetmap.org/",
    facebook: "https://facebook.com/", instagram: "https://instagram.com/", show_staff: true, roster_groups: [g("Seniori")].filter(Boolean),
  } }, "setările site-ului");
  await rpc(office, "publish_site_policy", { p_body: PRIVACY_POLICY_STARTER.replaceAll("{{club}}", club?.name ?? "Clubul") }, "politica");
  const cover1 = storeImage(clubId, "post", "0e5c3a", "f2c14e");
  const inline = storeImage(clubId, "post", "12305a", "7cc4e8");
  const p1 = await rpc<string>(office, "save_site_post", { p: {
    title: "Victorie în derby-ul U17", slug: slugify("Victorie în derby-ul U17"), cover_path: cover1 ?? "", to_site: true, to_app: true, app_group_ids: [g("U17")].filter(Boolean),
    blocks: [
      { type: "paragraph", text: "Echipa U17 a câștigat sâmbătă derby-ul cu Unirea Podgoria, scor 3–1, după o repriză a doua foarte bună." },
      { type: "heading", text: "Golurile" },
      { type: "list", items: ["minutul 34 – lovitură liberă direct la vinclu", "minutul 58 – contraatac pe partea stângă", "minutul 81 – penalty"] },
      ...(inline ? [{ type: "image", path: inline, alt: "Echipa U17 după meci", caption: "Bucuria de după fluierul final." }] : []),
      { type: "quote", text: "Am crescut de la meci la meci. Băieții au muncit mult în săptămâna asta.", by: "antrenorul echipei" },
      { type: "paragraph", text: "Următorul meci se joacă acasă, duminică, de la ora 11. Vă așteptăm în tribună!" },
    ],
  } }, "știre 1");
  await rpc(office, "publish_site_post", { p_id: p1, p_publish: true }, "publicare 1");
  const p2 = await rpc<string>(office, "save_site_post", { p: {
    title: "Programul din vacanța de iarnă", slug: slugify("Programul din vacanța de iarnă"), to_site: false, to_app: true, app_group_ids: [],
    blocks: [{ type: "paragraph", text: "Între 22 decembrie și 6 ianuarie antrenamentele se țin doar marțea și joia, la sala de sport. Taxa lunară pentru ianuarie se emite normal." }],
  } }, "știre 2");
  await rpc(office, "publish_site_post", { p_id: p2, p_publish: true }, "publicare 2");
  await rpc(office, "save_site_post", { p: { title: "Ziua porților deschise", slug: slugify("Ziua porților deschise"), to_site: true, to_app: false,
    blocks: [{ type: "paragraph", text: "Sâmbătă, 9 mai, copiii născuți între 2016 și 2019 pot încerca un antrenament gratuit." }] } }, "ciornă");
  await admin.from("site_posts").update({ published_at: new Date(Date.now() - 5 * 86400e3).toISOString() }).eq("id", p1);

  // galerie: o fotografie cu copilul demo (are acord foto semnat), una cu un copil fără acord (ascunsă), două de grup fără etichete
  const album = await rpc<string>(office, "save_album", { p: { title: "Turneul de toamnă U17", taken_on: addDays(today, -12) } }, "album");
  const { data: g2 } = ids.parinte ? await admin.from("guardians").select("guardian_players(player_id)").eq("user_id", ids.parinte).eq("club_id", clubId).maybeSingle() : { data: null };
  const child = (g2?.guardian_players as Array<{ player_id: string }> | undefined)?.[0]?.player_id;
  const other = (await admin.from("players").select("id").eq("club_id", clubId).eq("group_id", g("U17") ?? "").eq("photo_consent", false).neq("id", child ?? "").limit(1)).data?.[0]?.id;
  const shots: Array<[string, string, string, string[]]> = [
    ["0e5c3a", "9bd17a", "Încălzirea de dinaintea primului meci.", []],
    ["f2c14e", "e8762d", "Portarul nostru, decisiv la penalty-uri.", child ? [child] : []],
    ["12305a", "e04e5b", "Echipa, înainte de finală.", other ? [other] : []],
    ["3a3a3a", "f2c14e", "Medaliile.", []],
  ];
  for (const [c0, c1, caption, players] of shots) {
    const p = storeImage(clubId, "foto", c0, c1);
    if (!p) continue;
    const id = await rpc<string>(office, "save_photo", { p: { album_id: album, path: p, caption, player_ids: players } }, "fotografie");
    await rpc(office, "save_photo", { p: { id, caption, player_ids: players } }, "fotografie verificată");
  }
  await rpc(office, "save_album", { p: { id: album, title: "Turneul de toamnă U17", taken_on: addDays(today, -12), status: "published" } }, "album publicat");
}

/** Tabere: una de iarnă cu înscrieri (copilul părintelui demo confirmat, două de pe site de confirmat), una în pregătire, una trecută. */
async function seedCamps(admin: Db, clubId: string, ids: Record<string, string>, today: string) {
  const { count } = await admin.from("camps").select("id", { count: "exact", head: true }).eq("club_id", clubId);
  if (count || !ids.secretariat || !ids.parinte) return;
  const office = createDb({ sub: ids.secretariat, role: "authenticated" });
  const year = Number(today.slice(0, 4));
  const winter = await rpc<string>(office, "save_camp", { p: {
    title: "Tabăra de iarnă", location: "Baza sportivă Feleacu", starts_on: `${year}-12-27`, ends_on: `${year}-12-30`, price: 85000, capacity: 24,
    birth_year_from: year - 18, birth_year_to: year - 12, deadline: `${year}-12-15`, status: "open", is_public: true,
    description: "Patru zile de pregătire: două antrenamente pe zi, sală de forță, analiză video și un turneu în ultima zi.\n\nPrețul include cazarea, trei mese pe zi și transportul din Cluj. Copiii au nevoie de echipament de sală și de teren sintetic.",
  } }, "tabăra de iarnă");
  await rpc(office, "save_camp", { p: {
    title: "Tabăra de vară pentru portari", location: "Gilău", starts_on: `${year + 1}-07-06`, ends_on: `${year + 1}-07-10`, price: 120000, capacity: 12,
    birth_year_from: year - 18, birth_year_to: year - 10, status: "draft", is_public: true,
  } }, "tabăra de vară");
  const past = await rpc<string>(office, "save_camp", { p: {
    title: "Cantonament de vară", location: "Sovata", starts_on: `${year}-07-20`, ends_on: `${year}-07-26`, price: 0, capacity: 30, status: "open", is_public: false,
  } }, "cantonament");
  await admin.from("camps").update({ status: "closed" }).eq("id", past);
  const { data: g } = await admin.from("guardians").select("guardian_players(player_id)").eq("user_id", ids.parinte).eq("club_id", clubId).maybeSingle();
  const child = (g?.guardian_players as Array<{ player_id: string }> | undefined)?.[0]?.player_id;
  if (child) {
    const parent = createDb({ sub: ids.parinte, role: "authenticated" });
    await rpc(parent, "register_camp", { p_camp: winter, p_player: child, p_notes: "Nu mănâncă lactate." }, "înscriere copil demo");
  }
  const { data: club } = await admin.from("clubs").select("slug").eq("id", clubId).single();
  const anon = createDb({ role: "anon" });
  for (const [name, age, parent, phone] of [["Lazăr Mihai", 13, "Lazăr Corina", "0744555666"], ["Pavel Erik", 14, "Pavel Ionuț", "0733444555"]] as const) {
    await rpc(anon, "submit_camp_registration", { p_slug: club!.slug, p_camp: winter, p_ip: `203.0.113.${age}`,
      p: { child_name: name, birth_date: `${year - age}-04-0${age % 9 + 1}`, parent_name: parent, parent_phone: phone, consent: true } }, `înscriere ${name}`);
  }
}

/** Înscrieri: cereri în toate etapele, una cu probă la următorul antrenament U17 (o vede antrenorul de juniori). */
async function seedEnrolment(admin: Db, clubId: string, ids: Record<string, string>, today: string) {
  const { count } = await admin.from("enrolment_requests").select("id", { count: "exact", head: true }).eq("club_id", clubId);
  if (count || !ids.secretariat) return;
  const { data: club } = await admin.from("clubs").select("slug").eq("id", clubId).single();
  const anon = createDb({ role: "anon" });
  const office = createDb({ sub: ids.secretariat, role: "authenticated" });
  const year = Number(today.slice(0, 4));
  const pub = (child: string, age: number, parent: string, extra: Record<string, unknown> = {}) => rpc(anon, "submit_enrolment_request", {
    p_slug: club!.slug, p_ip: `203.0.113.${Math.floor(Math.random() * 200)}`,
    p: { child_name: child, birth_date: `${year - age}-0${1 + (child.length % 9)}-1${child.length % 9}`, parent_name: parent,
         parent_email: `${parent.split(" ")[0].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()}.demo@example.com`, parent_phone: "0740123456", consent: true, ...extra },
  }, `cerere ${child}`);
  await pub("Rusu Andrei", 9, "Rusu Elena", { position: "MID", notes: "Joacă de doi ani la o școală de fotbal din cartier." });
  await pub("Mureșan Ioana", 12, "Mureșan Dan", { relation: "father", position: "FWD" });
  await pub("Cozma David", 15, "Cozma Maria", { relation: "mother", position: "GK", previous_club: "CS Feleacu" });
  await pub("Bălan Tudor", 16, "Bălan Sorin", { relation: "father", position: "DEF", previous_club: "Unirea Dej" });
  await rpc(office, "create_enrolment_request", { p: { child_name: "Pop Matei", birth_date: `${year - 11}-03-04`, parent_name: "Pop Adriana", relation: "mother", parent_phone: "0745111222" } }, "cerere la telefon");
  const reqs = (await admin.from("enrolment_requests").select("id, child_name, group_id").eq("club_id", clubId)).data ?? [];
  const byName = (n: string) => reqs.find((r) => r.child_name === n)!;
  // proba lui Cozma David: următorul antrenament al echipei lui
  const nextTraining = async (groupId: string | null) => {
    if (!groupId) return null;
    const { data } = await admin.from("events").select("id, event_teams!inner(group_id)").eq("event_teams.group_id", groupId).eq("kind", "training")
      .neq("status", "cancelled").is("deleted_at", null).gt("starts_at", new Date().toISOString()).order("starts_at").limit(1);
    return data?.[0]?.id ?? null;
  };
  const david = byName("Cozma David");
  const ev = await nextTraining(david.group_id);
  if (ev) await rpc(office, "book_trial", { p_id: david.id, p_event: ev }, "probă David");
  const tudor = byName("Bălan Tudor");
  const ev2 = await nextTraining(tudor.group_id);
  if (ev2) {
    await rpc(office, "book_trial", { p_id: tudor.id, p_event: ev2 }, "probă Tudor");
    await rpc(office, "record_trial", { p_id: tudor.id, p_rating: 4, p_note: "Bun în duelurile aeriene, comunică mult. Trebuie lucrat la pasa cu stângul." }, "probă notată");
  }
  await rpc(office, "decline_enrolment", { p_id: byName("Mureșan Ioana").id, p_reason: "Familia s-a mutat în alt oraș.", p_withdrawn: true }, "retrasă");
}

/** Mesaje: unul trimis părinților U17 (citit de părintele demo) și unul programat pentru mâine. */
async function seedMessages(admin: Db, clubId: string, ids: Record<string, string>, today: string) {
  const { count } = await admin.from("messages").select("id", { count: "exact", head: true }).eq("club_id", clubId);
  if (count || !ids.secretariat || !ids.parinte) return;
  const { data: g } = await admin.from("guardians").select("guardian_players(players(group_id))").eq("user_id", ids.parinte).eq("club_id", clubId).maybeSingle();
  const groupId = (g?.guardian_players as Array<{ players: { group_id: string } | null }> | undefined)?.[0]?.players?.group_id;
  if (!groupId) return;
  const office = createDb({ sub: ids.secretariat, role: "authenticated" });
  const sent = await rpc<{ id: string }>(office, "send_message", {
    p: {
      title: "Echipamentul pentru sezonul nou",
      body: "Bună ziua,\n\nEchipamentul de joc pentru sezonul nou se ridică de la secretariat, de luni până joi, între 16:00 și 19:00. Vă rugăm să verificați mărimea în aplicație înainte.\n\nMulțumim,\nSecretariatul clubului",
      audience: { audiences: ["guardians"], group_ids: [groupId], exclude_user_ids: [] },
    },
  }, "mesaj trimis");
  const parent = createDb({ sub: ids.parinte, role: "authenticated" });
  if (sent?.id) await rpc(parent, "mark_message_read", { p_id: sent.id }, "mesaj citit");
  await rpc(office, "send_message", {
    p: {
      title: "Ședința cu părinții",
      body: "Vă așteptăm joi, la ora 18:30, în sala de la stadion, pentru prezentarea programului de pregătire din iarnă.",
      audience: { audiences: ["guardians"], group_ids: [groupId], exclude_user_ids: [] },
      scheduled_at: `${addDays(today, 1)}T07:00:00Z`,
    },
  }, "mesaj programat");
}

/**
 * Contracte: modelele standard; acordul foto trimis echipei copilului părintelui demo (semnat de părinte, cu semnătură desenată),
 * contractul de participare în așteptare pentru același copil, regulamentul seniorilor trimis jucătorului adult (îl semnează singur).
 */
async function seedContracts(admin: Db, clubId: string, ids: Record<string, string>, today: string) {
  const { count } = await admin.from("contract_templates").select("id", { count: "exact", head: true }).eq("club_id", clubId);
  if (count || !ids.secretariat || !ids.parinte) return;
  const office = createDb({ sub: ids.secretariat, role: "authenticated" });
  const tpl: Record<string, string> = {};
  for (const s of STANDARD_CONTRACTS) tpl[s.key] = await rpc<string>(office, "save_contract_template", { p: { name: s.name, kind: s.kind, body: s.body } }, `model ${s.key}`);

  const { data: g } = await admin.from("guardians").select("guardian_players(player_id, players(group_id))").eq("user_id", ids.parinte).eq("club_id", clubId).maybeSingle();
  const link = (g?.guardian_players as Array<{ player_id: string; players: { group_id: string } | null }> | undefined)?.[0];
  if (!link?.players) return;
  const team = (await admin.from("players").select("id").eq("group_id", link.players.group_id).eq("is_active", true)).data?.map((p) => p.id) ?? [];
  await rpc(office, "send_contracts", { p_template: tpl.photo, p_players: team, p_due_on: addDays(today, 14) }, "acord foto U17");
  await rpc(office, "send_contracts", { p_template: tpl.enrolment, p_players: [link.player_id], p_due_on: addDays(today, 7) }, "fișa de înscriere");

  // Părintele semnează acordul foto.
  const { data: photo } = await admin.from("contracts").select("id, signer_name").eq("player_id", link.player_id).eq("signer_user_id", ids.parinte).eq("title", STANDARD_CONTRACTS.find((s) => s.key === "photo")!.name).maybeSingle();
  if (photo) {
    const parent = createDb({ sub: ids.parinte, role: "authenticated" });
    const p = `${clubId}/${photo.id}/semnatura-${crypto.randomUUID()}.png`;
    if (writeLocalFile("contracts", p, demoSignaturePng())) {
      await rpc(parent, "view_contract", { p_id: photo.id, p_ip: "192.0.2.10" }, "deschidere");
      await rpc(parent, "sign_contract", { p_id: photo.id, p_name: photo.signer_name, p_signature_path: p, p_ip: "192.0.2.10", p_user_agent: "Demo" }, "semnare");
    }
  }

  // Un model scris de birou: regulamentul intern pentru seniori, pe care jucătorul adult îl semnează singur.
  if (ids.jucator) {
    const { data: adult } = await admin.from("players").select("id, group_id").eq("user_id", ids.jucator).maybeSingle();
    if (adult?.group_id) {
      const rules = await rpc<string>(office, "save_contract_template", {
        p: {
          name: "Regulamentul intern al lotului de seniori", kind: "other",
          body: "Subsemnatul {{jucator}}, jucător al echipei {{echipa}}, am luat la cunoștință regulamentul intern al {{club}} pentru sezonul {{sezon}}:\n\n1. Prezența la antrenamente și la meciuri este obligatorie; absențele se anunță în aplicație cu cel puțin 24 de ore înainte.\n2. Chestionarul de stare se completează zilnic până la ora 10:00.\n3. Echipamentul primit rămâne proprietatea clubului și se returnează la sfârșitul sezonului.\n4. Abaterile disciplinare se discută cu antrenorul principal și cu directorul sportiv.\n\nData: {{data}}",
        },
      }, "model regulament");
      const senior = (await admin.from("players").select("id").eq("group_id", adult.group_id).eq("is_active", true).limit(12)).data?.map((p) => p.id) ?? [];
      await rpc(office, "send_contracts", { p_template: rules, p_players: [...new Set([adult.id, ...senior])], p_due_on: addDays(today, 10) }, "regulament seniori");
    }
  }
}
