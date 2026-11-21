export type ImportRow = {
  name: string;
  price: string;
  cost: string;
  stock: string;
  barcode: string;
};

export const TEMPLATE_CSV =
  "name,price,cost,stock,barcode\n" +
  "Mealie meal 25kg,285,250,10,\n" +
  "Cooking oil 2L,95,80,12,6001234567890\n" +
  "Sugar 2kg,62,54,20,\n";

/** Split pasted text or a CSV file into rows. Handles quotes, and comma / tab / semicolon separators. */
export function parseTable(text: string): string[][] {
  const clean = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const firstLine = clean.split("\n").find((l) => l.trim() !== "") ?? "";
  const counts = { "\t": 0, ";": 0, ",": 0 } as Record<string, number>;
  let inQ = false;
  for (const ch of firstLine) {
    if (ch === '"') inQ = !inQ;
    else if (!inQ && ch in counts) counts[ch]++;
  }
  const delim = counts["\t"] > 0 ? "\t" : counts[";"] > counts[","] ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  inQ = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQ) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQ = false;
      } else cell += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  rows.push(row);
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ""));
}

/** Parse a money/quantity cell: "K 1,250.50" -> "1250.5". Returns "" if not a number. */
export function cleanNumber(s: string): string {
  const t = s.replace(/[^0-9.,-]/g, "");
  if (!t) return "";
  // "1,250.50" -> 1250.50 ; "12,5" -> 12.5
  const normalised =
    t.includes(",") && t.includes(".")
      ? t.replace(/,/g, "")
      : /,\d{1,2}$/.test(t)
        ? t.replace(",", ".")
        : t.replace(/,/g, "");
  const n = Number(normalised);
  return Number.isFinite(n) ? String(n) : "";
}

const ALIASES: Record<keyof ImportRow, string[]> = {
  name: ["name", "item", "items", "product", "products", "description", "product name", "item name"],
  price: ["price", "selling price", "sell price", "sell", "retail", "retail price", "unit price", "amount"],
  cost: ["cost", "cost price", "buying price", "buy price", "buy", "wholesale", "purchase price"],
  stock: ["stock", "qty", "quantity", "on hand", "count", "stock on hand", "units"],
  barcode: ["barcode", "sku", "code", "bar code", "ean", "upc"],
};

export function tableToRows(table: string[][]): ImportRow[] {
  if (table.length === 0) return [];
  const header = table[0].map((h) => h.toLowerCase().trim());
  const mapping: Partial<Record<keyof ImportRow, number>> = {};
  (Object.keys(ALIASES) as (keyof ImportRow)[]).forEach((field) => {
    const idx = header.findIndex((h) => ALIASES[field].includes(h));
    if (idx >= 0) mapping[field] = idx;
  });

  let body = table;
  let map: Record<keyof ImportRow, number | undefined>;
  if (mapping.name !== undefined) {
    body = table.slice(1);
    map = {
      name: mapping.name,
      price: mapping.price,
      cost: mapping.cost,
      stock: mapping.stock,
      barcode: mapping.barcode,
    };
  } else {
    // No header row: assume the order name, price, cost, stock, barcode.
    map = { name: 0, price: 1, cost: 2, stock: 3, barcode: 4 };
  }

  const get = (r: string[], i: number | undefined) => (i === undefined ? "" : (r[i] ?? ""));
  return body
    .map((r) => ({
      name: get(r, map.name).trim(),
      price: cleanNumber(get(r, map.price)),
      cost: cleanNumber(get(r, map.cost)),
      stock: cleanNumber(get(r, map.stock)),
      barcode: get(r, map.barcode).replace(/\s+/g, ""),
    }))
    .filter((r) => r.name !== "");
}
