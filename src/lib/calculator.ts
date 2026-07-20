import type {
  CalculationBreakdown,
  CalculationInput,
  FittingItem,
  RvdItem,
} from "./types";
import { HEMORRHOID_PRICE } from "./types";

export function findRvdItem(
  rvdData: RvdItem[],
  rvdType: string,
  dn: number,
): RvdItem | undefined {
  return rvdData.find((item) => item.type === rvdType && item.diameter === dn);
}

export function filterFittings(
  fittings: FittingItem[],
  dn: number,
  fittingType: string,
): FittingItem[] {
  return fittings.filter(
    (item) => item.dn === dn && item.type === fittingType && item.visible,
  );
}

export function calculatePrice(
  input: CalculationInput,
  rvdData: RvdItem[],
  fittings: FittingItem[],
): CalculationBreakdown | null {
  const rvdItem = findRvdItem(rvdData, input.rvdType, input.dn);
  if (!rvdItem || input.length <= 0) return null;

  const hoseCost = rvdItem.pricePerMeter * input.length;
  const sleevesCost = rvdItem.priceFor2Sleeves;

  let fitting1Cost = 0;
  let fitting1Label = "—";

  if (input.fitting1Hemorrhoid) {
    fitting1Cost = HEMORRHOID_PRICE;
    fitting1Label = "Работа с фитингом клиента";
  } else if (input.fitting1Id) {
    const fitting = fittings.find((item) => item.id === input.fitting1Id);
    if (fitting) {
      fitting1Cost = fitting.price;
      fitting1Label = fitting.visible;
    }
  }

  let fitting2Cost = 0;
  let fitting2Label = "—";

  if (input.fitting2Hemorrhoid) {
    fitting2Cost = HEMORRHOID_PRICE;
    fitting2Label = "Работа с фитингом клиента";
  } else if (input.fitting2Id) {
    const fitting = fittings.find((item) => item.id === input.fitting2Id);
    if (fitting) {
      fitting2Cost = fitting.price;
      fitting2Label = fitting.visible;
    }
  }

  const subtotal = hoseCost + sleevesCost + fitting1Cost + fitting2Cost;
  let total = subtotal;
  let markupAmount = 0;
  let discountAmount = 0;

  if (input.markupEnabled && input.adjustmentPercent > 0) {
    markupAmount = subtotal * (input.adjustmentPercent / 100);
    total += markupAmount;
  }

  if (input.discountEnabled && input.adjustmentPercent > 0) {
    discountAmount = total * (input.adjustmentPercent / 100);
    total -= discountAmount;
  }

  return {
    rvdType: input.rvdType,
    dn: input.dn,
    length: input.length,
    pricePerMeter: rvdItem.pricePerMeter,
    hoseCost,
    sleevesCost,
    fitting1Label,
    fitting1Cost,
    fitting2Label,
    fitting2Cost,
    subtotal,
    markupAmount,
    discountAmount,
    total,
  };
}

export function formatRubles(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}
