export interface RvdItem {
  diameter: number;
  type: string;
  pricePerMeter: number;
  priceFor2Sleeves: number;
}

export interface FittingItem {
  id: string;
  standard: string;
  type: string;
  size: string;
  dn: number;
  price: number;
  visible: string;
}

export const FITTING_TYPES = ["Г", "45", "90", "Ш"] as const;
export type FittingType = (typeof FITTING_TYPES)[number];

export const HEMORRHOID_PRICE = 2000;

export interface CalculationInput {
  rvdType: string;
  dn: number;
  length: number;
  fitting1Type: FittingType | "";
  fitting1Id: string;
  fitting1Hemorrhoid: boolean;
  fitting2Type: FittingType | "";
  fitting2Id: string;
  fitting2Hemorrhoid: boolean;
  markupEnabled: boolean;
  discountEnabled: boolean;
  adjustmentPercent: number;
}

export interface CalculationBreakdown {
  rvdType: string;
  dn: number;
  length: number;
  pricePerMeter: number;
  hoseCost: number;
  sleevesCost: number;
  fitting1Label: string;
  fitting1Cost: number;
  fitting2Label: string;
  fitting2Cost: number;
  subtotal: number;
  markupAmount: number;
  discountAmount: number;
  total: number;
}
