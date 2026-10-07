// Transformă CSV-urile din data/private în XLSX (pentru testul de import cap-coadă).
import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import writeXlsxFile from "write-excel-file/node";

const dir = path.resolve("data/private");
for (const name of ["stare-de-sanatate", "fatigue-l3"]) {
  const csv = fs.readFileSync(path.join(dir, `${name}.csv`), "utf8");
  const rows = Papa.parse(csv).data.filter((r, i, a) => i < a.length - 1 || r.join("") !== "");
  const width = Math.max(...rows.map((r) => r.length));
  const data = rows.map((r) =>
    Array.from({ length: width }, (_, c) => {
      const v = r[c] ?? "";
      if (v === "") return null;
      return /^\d+$/.test(v) ? { value: Number(v), type: Number } : { value: v, type: String };
    }),
  );
  await writeXlsxFile(data).toFile(path.join(dir, `${name}.xlsx`));
  console.log(name, rows.length, "rânduri");
}
