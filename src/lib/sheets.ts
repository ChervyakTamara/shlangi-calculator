import type { FittingItem, RvdItem } from "./types";

const RVD_SHEET_ID =
  process.env.RVD_SHEET_ID ?? "1pri9slkKWLlis1BtgjbyBRQi0x7YJTp9fHj9dWoYvtE";
const FITTINGS_SHEET_ID =
  process.env.FITTINGS_SHEET_ID ?? "1pYookWPBfWMz24_hR72RywDYxdZNYjBagqttqr1NXRg";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || (char === "\r" && next === "\n")) {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      if (char === "\r") i++;
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function parsePrice(value: string): number {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeFittingType(type: string): string {
  const trimmed = type.trim();
  if (trimmed === "45" || trimmed === "90") return trimmed;
  if (/^г$/i.test(trimmed) || trimmed === "Г") return "Г";
  if (/^ш$/i.test(trimmed) || trimmed === "Ш") return "Ш";
  return trimmed;
}

async function fetchSheetCsv(sheetId: string): Promise<string> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;
  const response = await fetch(url, { next: { revalidate: 300 } });

  if (!response.ok) {
    throw new Error(`Не удалось загрузить таблицу: ${response.status}`);
  }

  return response.text();
}

export async function fetchRvdData(): Promise<RvdItem[]> {
  const csv = await fetchSheetCsv(RVD_SHEET_ID);
  const rows = parseCsv(csv);

  return rows.slice(1).flatMap((row) => {
    const [diameterRaw, type, pricePerMeterRaw, sleevesRaw] = row;
    if (!diameterRaw || !type) return [];

    const diameter = Number.parseInt(diameterRaw.trim(), 10);
    if (!Number.isFinite(diameter)) return [];

    return [
      {
        diameter,
        type: type.trim(),
        pricePerMeter: parsePrice(pricePerMeterRaw ?? "0"),
        priceFor2Sleeves: parsePrice(sleevesRaw ?? "0"),
      },
    ];
  });
}

export async function fetchFittingsData(): Promise<FittingItem[]> {
  const csv = await fetchSheetCsv(FITTINGS_SHEET_ID);
  const rows = parseCsv(csv);

  return rows.slice(1).flatMap((row, index) => {
    const [standard, type, size, dnRaw, priceRaw, visible] = row;
    if (!type || !dnRaw || !visible) return [];

    const dn = Number.parseInt(dnRaw.trim(), 10);
    if (!Number.isFinite(dn)) return [];

    const normalizedType = normalizeFittingType(type);
    const price = parsePrice(priceRaw ?? "0");

    return [
      {
        id: `${index}-${standard}-${normalizedType}-${dn}-${size}`,
        standard: (standard ?? "").trim(),
        type: normalizedType,
        size: (size ?? "").trim(),
        dn,
        price,
        visible: visible.trim(),
      },
    ];
  });
}
