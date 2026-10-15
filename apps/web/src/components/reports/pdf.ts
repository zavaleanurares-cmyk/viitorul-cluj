import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

/**
 * Mic motor de paginare peste pdf-lib, pentru rapoartele A4: titluri, perechi etichetă–valoare,
 * tabele cu text pe mai multe rânduri și antet repetat la schimbarea paginii, subsol cu numărul paginii.
 *
 * Fontul este Atkinson Hyperlegible Next (același ca în aplicație), încorporat ca TTF: fonturile
 * standard din PDF nu au ș / ț / ă. Fișierele stau în `components/reports/fonts/` și sunt incluse în
 * build prin `outputFileTracingIncludes` (next.config.ts).
 */

const FONT_DIRS = [
  path.join(process.cwd(), "src/components/reports/fonts"),
  // când procesul pornește din rădăcina monorepo-ului
  path.join(process.cwd(), "apps/web/src/components/reports/fonts"),
];

async function readFont(file: string): Promise<Uint8Array> {
  let last: unknown;
  for (const dir of FONT_DIRS) {
    try {
      return await fs.readFile(path.join(dir, file));
    } catch (e) {
      last = e;
    }
  }
  throw new Error(`Fontul ${file} lipsește din build: ${(last as Error)?.message ?? ""}`);
}

let fontBytes: Promise<[Uint8Array, Uint8Array]> | null = null;
function loadFonts() {
  fontBytes ??= Promise.all([
    readFont("AtkinsonHyperlegibleNext-Regular.ttf"),
    readFont("AtkinsonHyperlegibleNext-Bold.ttf"),
  ]).catch((e) => {
    fontBytes = null;
    throw e;
  });
  return fontBytes;
}

const INK = rgb(0.055, 0.09, 0.149);
const INK_2 = rgb(0.212, 0.255, 0.31);
const INK_3 = rgb(0.349, 0.396, 0.459);
const LINE = rgb(0.827, 0.851, 0.878);
const FILL = rgb(0.949, 0.957, 0.965);

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 40;
const FOOTER = 28;

export type Cell = string | number | null | undefined | { text: string | number | null | undefined; bold?: boolean; muted?: boolean; dot?: string };
export type Column = { header: string; width: number; align?: "left" | "right" | "center" };

function hex(color: string) {
  const n = parseInt(color.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export class Report {
  private page!: PDFPage;
  private y = 0;
  private readonly size: [number, number];
  private charset = new Set<number>();

  private constructor(
    private readonly pdf: PDFDocument,
    private readonly regular: PDFFont,
    private readonly bold: PDFFont,
    private readonly meta: { club: string; title: string; footer: string; pageLabel: (n: number, total: number) => string },
    landscape: boolean,
  ) {
    this.size = landscape ? [A4[1], A4[0]] : A4;
    this.charset = new Set(regular.getCharacterSet());
  }

  static async create(opts: {
    club: string; title: string; subtitle?: string; generated: string; footer: string;
    pageLabel: (n: number, total: number) => string; landscape?: boolean;
  }): Promise<Report> {
    const [regularBytes, boldBytes] = await loadFonts();
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    // subset: true este obligatoriu — fără subsetare pdf-lib scrie greșit lățimile glifelor (spații late între litere)
    const regular = await pdf.embedFont(regularBytes, { subset: true });
    const bold = await pdf.embedFont(boldBytes, { subset: true });
    pdf.setTitle(`${opts.title} — ${opts.club}`);
    pdf.setAuthor(opts.club);
    pdf.setCreator(opts.club);
    pdf.setLanguage("ro-RO");
    const r = new Report(pdf, regular, bold, { club: opts.club, title: opts.title, footer: opts.footer, pageLabel: opts.pageLabel }, !!opts.landscape);
    r.newPage();
    r.masthead(opts.club, opts.title, opts.subtitle, opts.generated);
    return r;
  }

  private get width() { return this.size[0] - 2 * MARGIN; }
  private get bottom() { return MARGIN + FOOTER; }

  /** Înlocuiește ce nu poate fi desenat: ş/ţ cu sedilă → ș/ț, spații speciale, caractere absente din font. */
  private clean(input: string | number | null | undefined): string {
    const s = String(input ?? "")
      .replace(/ş/g, "ș").replace(/Ş/g, "Ș").replace(/ţ/g, "ț").replace(/Ţ/g, "Ț")
      .replace(/[   \t]/g, " ").replace(/\r/g, "").normalize("NFC");
    let out = "";
    for (const ch of s) {
      const cp = ch.codePointAt(0)!;
      out += ch === "\n" || this.charset.has(cp) ? ch : cp < 32 ? "" : "?";
    }
    return out;
  }

  private wrap(text: string, font: PDFFont, size: number, max: number): string[] {
    const lines: string[] = [];
    for (const para of this.clean(text).split("\n")) {
      let line = "";
      for (const word of para.split(/ +/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= max) {
          line = candidate;
          continue;
        }
        if (line) lines.push(line);
        // un cuvânt mai lat decât coloana se rupe pe litere
        let rest = word;
        while (font.widthOfTextAtSize(rest, size) > max && rest.length > 1) {
          let cut = rest.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > max) cut--;
          lines.push(rest.slice(0, cut));
          rest = rest.slice(cut);
        }
        line = rest;
      }
      lines.push(line);
    }
    return lines.length ? lines : [""];
  }

  private newPage() {
    this.page = this.pdf.addPage(this.size);
    this.y = this.size[1] - MARGIN;
  }

  /** Trece pe pagină nouă dacă nu mai încap `height` puncte. Întoarce true dacă a schimbat pagina. */
  private need(height: number): boolean {
    if (this.y - height >= this.bottom) return false;
    this.newPage();
    return true;
  }

  private masthead(club: string, title: string, subtitle: string | undefined, generated: string) {
    const p = this.page;
    p.drawText(this.clean(club), { x: MARGIN, y: this.y - 10, size: 10, font: this.bold, color: INK_3 });
    const g = this.clean(generated);
    p.drawText(g, { x: MARGIN + this.width - this.regular.widthOfTextAtSize(g, 9), y: this.y - 10, size: 9, font: this.regular, color: INK_3 });
    this.y -= 18;
    for (const line of this.wrap(title, this.bold, 20, this.width)) {
      p.drawText(line, { x: MARGIN, y: this.y - 20, size: 20, font: this.bold, color: INK });
      this.y -= 25;
    }
    if (subtitle) {
      for (const line of this.wrap(subtitle, this.regular, 11, this.width)) {
        p.drawText(line, { x: MARGIN, y: this.y - 12, size: 11, font: this.regular, color: INK_2 });
        this.y -= 15;
      }
    }
    this.y -= 6;
    p.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: MARGIN + this.width, y: this.y }, thickness: 1.2, color: INK });
    this.y -= 6;
  }

  space(points = 8) { this.y -= points; }

  /** O imagine PNG (ex. semnătura), aliniată la stânga, în limitele date. */
  async image(png: Uint8Array, opts: { width: number; height: number }) {
    const img = await this.pdf.embedPng(png);
    const scale = Math.min(opts.width / img.width, opts.height / img.height, 1);
    const w = img.width * scale;
    const h = img.height * scale;
    this.need(h + 8);
    this.y -= h;
    this.page.drawImage(img, { x: MARGIN, y: this.y, width: w, height: h });
    this.y -= 8;
  }

  /** Titlu de secțiune. Rămâne pe aceeași pagină cu cel puțin `keep` puncte din conținutul care urmează. */
  heading(text: string, keep = 60) {
    this.need(30 + keep);
    this.y -= 12;
    this.page.drawText(this.clean(text), { x: MARGIN, y: this.y - 13, size: 13, font: this.bold, color: INK });
    this.y -= 21;
  }

  paragraph(text: string, opts: { size?: number; muted?: boolean; bold?: boolean } = {}) {
    const size = opts.size ?? 10;
    const font = opts.bold ? this.bold : this.regular;
    for (const line of this.wrap(text, font, size, this.width)) {
      this.need(size + 4);
      this.page.drawText(line, { x: MARGIN, y: this.y - size, size, font, color: opts.muted ? INK_3 : INK });
      this.y -= size + 4;
    }
  }

  /** Perechi etichetă–valoare, pe coloane. */
  keyValues(pairs: Array<[string, string | number | null | undefined]>, columns = 2) {
    const gap = 16;
    const colW = (this.width - gap * (columns - 1)) / columns;
    const labelW = Math.min(120, colW * 0.42);
    for (let i = 0; i < pairs.length; i += columns) {
      const row = pairs.slice(i, i + columns).map(([k, v]) => ({
        k: this.wrap(k, this.regular, 9.5, labelW - 6),
        v: this.wrap(v === null || v === undefined || v === "" ? "—" : String(v), this.bold, 10, colW - labelW),
      }));
      const lines = Math.max(...row.map((c) => Math.max(c.k.length, c.v.length)));
      const h = lines * 13 + 5;
      this.need(h);
      row.forEach((c, j) => {
        const x = MARGIN + j * (colW + gap);
        c.k.forEach((l, n) => this.page.drawText(l, { x, y: this.y - 10 - n * 13, size: 9.5, font: this.regular, color: INK_3 }));
        c.v.forEach((l, n) => this.page.drawText(l, { x: x + labelW, y: this.y - 10 - n * 13, size: 10, font: this.bold, color: INK }));
      });
      this.y -= h;
      this.page.drawLine({ start: { x: MARGIN, y: this.y + 1 }, end: { x: MARGIN + this.width, y: this.y + 1 }, thickness: 0.5, color: LINE });
    }
    this.y -= 4;
  }

  /**
   * Tabel. Lățimile coloanelor sunt proporții (se scalează la lățimea paginii).
   * Textul se rupe pe rânduri în celulă; un rând nu se împarte între pagini; antetul se repetă pe fiecare pagină.
   */
  table(columns: Column[], rows: Cell[][], opts: { size?: number; empty?: string } = {}) {
    const size = opts.size ?? 9;
    const lineH = size + 3;
    const padX = 5;
    const padY = 4;
    const total = columns.reduce((s, c) => s + c.width, 0);
    const widths = columns.map((c) => (c.width / total) * this.width);
    const xs = widths.map((_, i) => MARGIN + widths.slice(0, i).reduce((s, w) => s + w, 0));

    if (!rows.length) {
      if (opts.empty) this.paragraph(opts.empty, { muted: true });
      return;
    }

    const drawHeader = () => {
      const head = columns.map((c, i) => this.wrap(c.header, this.bold, size - 0.5, widths[i] - 2 * padX));
      const h = Math.max(...head.map((l) => l.length)) * lineH + 2 * padY;
      this.page.drawRectangle({ x: MARGIN, y: this.y - h, width: this.width, height: h, color: FILL });
      head.forEach((lines, i) => lines.forEach((l, n) => {
        const w = this.bold.widthOfTextAtSize(l, size - 0.5);
        const x = columns[i].align === "right" ? xs[i] + widths[i] - padX - w : columns[i].align === "center" ? xs[i] + (widths[i] - w) / 2 : xs[i] + padX;
        this.page.drawText(l, { x, y: this.y - padY - size + 1 - n * lineH, size: size - 0.5, font: this.bold, color: INK_2 });
      }));
      this.y -= h;
      this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: MARGIN + this.width, y: this.y }, thickness: 0.8, color: INK_3 });
    };

    // antetul nu rămâne singur în josul paginii
    this.need(60);
    drawHeader();

    for (const row of rows) {
      const cells = columns.map((c, i) => {
        const raw = row[i];
        const o = raw && typeof raw === "object" ? raw : { text: raw };
        const font = o.bold ? this.bold : this.regular;
        const text = o.text === null || o.text === undefined ? "" : String(o.text);
        const dotW = o.dot ? size : 0;
        return { ...o, font, lines: this.wrap(text, font, size, widths[i] - 2 * padX - dotW), dotW };
      });
      const h = Math.max(...cells.map((c) => c.lines.length)) * lineH + 2 * padY - 1;
      if (this.need(h)) drawHeader();
      cells.forEach((c, i) => {
        if (c.dot && c.lines[0]) {
          this.page.drawCircle({ x: xs[i] + padX + size * 0.32, y: this.y - padY - size * 0.6, size: size * 0.32, color: hex(c.dot) });
        }
        c.lines.forEach((l, n) => {
          const w = c.font.widthOfTextAtSize(l, size);
          const align = columns[i].align;
          const x = align === "right" ? xs[i] + widths[i] - padX - w : align === "center" ? xs[i] + (widths[i] - w) / 2 : xs[i] + padX + c.dotW;
          this.page.drawText(l, { x, y: this.y - padY - size + 1 - n * lineH, size, font: c.font, color: c.muted ? INK_3 : INK });
        });
      });
      this.y -= h;
      this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: MARGIN + this.width, y: this.y }, thickness: 0.5, color: LINE });
    }
    this.y -= 6;
  }

  /** Scrie subsolurile (acum se știe numărul de pagini) și întoarce fișierul. */
  async bytes(): Promise<Uint8Array> {
    const pages = this.pdf.getPages();
    pages.forEach((p, i) => {
      const y = MARGIN - 4;
      p.drawLine({ start: { x: MARGIN, y: y + 14 }, end: { x: MARGIN + this.width, y: y + 14 }, thickness: 0.5, color: LINE });
      const right = this.clean(this.meta.pageLabel(i + 1, pages.length));
      const rightW = this.regular.widthOfTextAtSize(right, 8);
      p.drawText(right, { x: MARGIN + this.width - rightW, y, size: 8, font: this.regular, color: INK_3 });
      const left = this.wrap(`${this.meta.club} · ${this.meta.title} · ${this.meta.footer}`, this.regular, 8, this.width - rightW - 16)[0];
      p.drawText(left, { x: MARGIN, y, size: 8, font: this.regular, color: INK_3 });
    });
    return this.pdf.save();
  }
}
