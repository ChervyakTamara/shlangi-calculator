import type { FittingItem } from "./types";
import type { FittingType } from "./types";
import type { RvdItem } from "./types";
import { normalizeSpeech } from "./speech-normalization";
type Database = { rvd: RvdItem[]; fittings: FittingItem[] };

export interface VoiceCommandResult {
  rvdType?: string;
  dn?: string;
  length?: string;
  fitting1Type?: FittingType;
  fitting1Id?: string;
  fitting2Type?: FittingType;
  fitting2Id?: string;
  markupEnabled?: boolean;
  adjustmentPercent?: string;
  matchedFittings: string[];
  warnings: string[];
}

const normalize = normalizeSpeech;

const normalizedSize = (value: string) => value
  .replace(/(\d+)\s+(\d+\/\d+)/g, "$1.$2")
  .replace(/(?:дюйм[а-я]*|["″])/gu, "")
  .replace(/,/g, ".")
  .replace(/[х×*]/gi, "x")
  .replace(/\s*(?:на|x)\s*/gi, "x")
  .replace(/\s+/g, "")
  .replace(/\.0(?=x|$)/g, "");

function fittingStandardAliases(standard: string): string[] {
  const value = normalize(standard.split("(")[0]).replace(/[^a-zа-яё0-9]/g, "");
  const aliases: Record<string, string[]> = {
    dkol: ["dkol", "дкол", "д кол", "д-коль"],
    dkos: ["dkos", "дкос", "д кос"],
    dk: ["dk", "дк", "д к"],
  };
  return [...new Set([value, ...(aliases[value] ?? [])])].sort((a, b) => b.length - a.length);
}

function fittingAngle(text: string, from: number, to: number): FittingType | undefined {
  const nearby = text.slice(from, to);
  // «Прямой штуцер» is still catalog type Ш, not Г.
  if (/(?:^|[^а-яa-z])(?:штуцер[а-я]*|ш|ша)(?=$|[^а-яa-z])/u.test(nearby)) return "Ш";
  const explicit = nearby.match(/(?:^|[\s,;])(45|90)(?:\s*(?:°|градус(?:а|ов)?|град))?(?=$|[\s,;.])/u);
  if (explicit) return explicit[1] as FittingType;
  if (/(?:прямой|прямое|прямая|прямые|ровный)/.test(nearby)) return "Г";
  return undefined;
}

function findFittingMatches(text: string, database: Database, dn: number): {
  fittings: (FittingItem | undefined)[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const found: (FittingItem | undefined)[] = [];
  const standards = [...new Set(database.fittings.map((item) => item.standard))]
    .flatMap((standard) => fittingStandardAliases(standard).map((alias) => ({ standard, alias })))
    .sort((a, b) => b.alias.length - a.alias.length);

  const mentions: { standard: string; match: RegExpMatchArray; start: number }[] = [];
  for (const { standard, alias } of standards) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const sizePattern = '(\\d+(?:[.,]\\d+)?\\s*(?:на|[xх×*])\\s*\\d+(?:[.,]\\d+)?|\\d+(?:[. ]\\d+)?/\\d+\\s*(?:["″]|дюйм[а-я]*)?|\\d+\\s*(?:["″]|дюйм[а-я]*))';
    const expression = new RegExp(`${escaped}\\s*${sizePattern}`, "giu");
    for (const match of text.matchAll(expression)) {
      const start = match.index ?? 0;
      if (!mentions.some((item) => item.start === start)) mentions.push({ standard, match, start });
    }
  }
  mentions.sort((a, b) => a.start - b.start);
  for (let index = 0; index < mentions.length; index++) {
      const { standard, match, start } = mentions[index];
      const previous = mentions[index - 1];
      const prefixStart = previous ? previous.start + previous.match[0].length : 0;
      const nextStart = mentions[index + 1]?.start ?? text.length;
      const type = fittingAngle(text, prefixStart, start)
        ?? (index === mentions.length - 1 ? fittingAngle(text, start + match[0].length, nextStart) : undefined);
      if (!type) {
        warnings.push(`Для фитинга ${standard} ${match[1]} не распознал тип (прямой, 45° или 90°).`);
        found.push(undefined);
        continue;
      }
      const spokenSize = normalizedSize(match[1]);
      const candidates = database.fittings.filter((item) =>
        normalize(item.standard.split("(")[0]).replace(/[^a-zа-яё0-9]/g, "") ===
          normalize(standard.split("(")[0]).replace(/[^a-zа-яё0-9]/g, "") &&
        item.type === type && item.dn === dn && normalizedSize(item.size) === spokenSize,
      );
      if (candidates.length === 1) found.push(candidates[0]);
      else {
        found.push(undefined);
        if (candidates.length > 1) warnings.push(`Найдено несколько фитингов ${standard} ${match[1]} для DN ${dn}; выбери точный вручную.`);
        else warnings.push(`В базе нет фитинга ${standard} ${match[1]} для DN ${dn}.`);
      }
  }

  if (found.length === 1 && /(?:с\s*(?:2|двух|обеих)\s*сторон|оба\s*(?:одинаковые|таких|прямые)|2\s*одинаковых|одинаковые\s*фитинги)/u.test(text)) found.push(found[0]);
  if (found.length > 2) warnings.push("Распознано больше двух фитингов; заполнены первые два по порядку диктовки.");
  return { fittings: found.slice(0, 2), warnings: [...new Set(warnings)] };
}

export function parseVoiceCommand(transcript: string, database: Database): VoiceCommandResult {
  const text = normalize(transcript).replace(
    /([a-z]+)\s*\(\s*(г|ш|45|90)\s*\)\s*(\d+(?:[.,]\d+)?\s*(?:[xх×*]|на)\s*\d+(?:[.,]\d+)?)(?:\s*\(\s*(45|90)\s*\))?/gu,
    (_,standard,type,size,angle) => `${angle || (type === "г" ? "прямой" : type)} ${standard} ${size}`,
  );
  const result: VoiceCommandResult = { matchedFittings: [], warnings: [] };

  const normalizedText = text.replace(/(\d+)\s*сн/g, "$1sn");
  const rvdTypes = [...new Set(database.rvd.map((item) => item.type))]
    .sort((a, b) => b.length - a.length);
  const selectedRvd = rvdTypes.find((type) => {
    const key = normalize(type).replace(/[^a-zа-яё0-9]/g, "").replace(/сн/g, "sn");
    if (/ptfe/i.test(type)) return /ptfe/.test(normalizedText);
    if (type.includes("/")) {
      const prefix = type.match(/^\d+/)?.[0] ?? "";
      if (type.split("/").some(part => {
        const alternative = normalize(/^\d/.test(part) ? part : prefix + part).replace(/[^a-zа-я0-9]/g, "");
        return normalizedText.replace(/[^a-zа-я0-9]/g, "").includes(alternative);
      })) return true;
    }
    return key.length > 1 && normalizedText.replace(/[^a-zа-яё0-9]/g, "").includes(key);
  });
  if (selectedRvd) result.rvdType = selectedRvd;
  else result.warnings.push("Не удалось распознать тип РВД.");

  const dnMatch = text.match(/(?:^|[\s,;])(?:dn|дн|диаметр)\s*[:=-]?\s*(\d+(?:[.,]\d+)?)/i);
  if (dnMatch) result.dn = dnMatch[1].replace(",", ".");
  else result.warnings.push("Не удалось распознать DN (например, «DN 20»).");

  const lengthMatch = text.match(/(?:^|[\s,;])(?:длин(?:а|на|ну|е|ы)?|[lл])\s*(?:равна\s*|[=:]\s*)?(\d+(?:[.,]\d+)?)/i)
    ?? text.match(/\b(\d+(?:[.,]\d+)?)\s*(?:метр(?:а|ов)?|м\b)/i);
  if (lengthMatch) {
    const numeric = lengthMatch[1];
    const unit = text.slice((lengthMatch.index ?? 0) + lengthMatch[0].length).match(/^\s*(сантиметр[а-я]*|см|миллиметр[а-я]*|мм)(?=$|[^а-я])/u)?.[1];
    const divisor = unit?.startsWith("с") ? 100 : unit?.startsWith("м") ? 1000 : 1;
    result.length = String(Number(numeric.replace(",", ".")) / divisor);
  } else result.warnings.push("Не удалось распознать длину в метрах.");

  const percentMatch = text.match(/(?:наценк\w*|накрут\w*)[^\d]{0,16}(\d+(?:[.,]\d+)?)\s*(?:%|процент\w*)?/i);
  if (percentMatch) {
    result.markupEnabled = true;
    result.adjustmentPercent = percentMatch[1].replace(",", ".");
  }

  const dnNumber = Number(result.dn);
  if (Number.isFinite(dnNumber) && dnNumber > 0) {
    const matching = findFittingMatches(text, database, dnNumber);
    result.warnings.push(...matching.warnings);
    const [first, second] = matching.fittings;
    if (first) {
      result.fitting1Type = first.type as FittingType;
      result.fitting1Id = first.id;
      result.matchedFittings.push(first.visible);
    }
    if (second) {
      result.fitting2Type = second.type as FittingType;
      result.fitting2Id = second.id;
      result.matchedFittings.push(second.visible);
    }
    if (matching.fittings.length < 2 && !result.warnings.some((warning) => warning.includes("фитинг"))) {
      result.warnings.push("Распознано меньше двух фитингов.");
    }
  }

  return result;
}


