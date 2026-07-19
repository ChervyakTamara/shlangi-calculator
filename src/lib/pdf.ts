import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { CalculationBreakdown } from "./types";
import { formatRubles } from "./calculator";

export interface PdfReportOptions {
  markupEnabled: boolean;
  discountEnabled: boolean;
  adjustmentPercent: number;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function row(label: string, value: string): string {
  return `
    <div style="display: flex; justify-content: space-between; gap: 24px; padding: 5px 0; border-bottom: 1px solid #e5e5e5; font-size: 13px; line-height: 1.4;">
      <span style="color: #333;">${escapeHtml(label)}</span>
      <span style="color: #111; text-align: right;">${escapeHtml(value)}</span>
    </div>
  `;
}

function section(title: string, content: string): string {
  return `
    <div style="margin-top: 22px;">
      <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; color: #111; margin-bottom: 10px; text-transform: uppercase;">
        ${escapeHtml(title)}
      </div>
      ${content}
    </div>
  `;
}

export async function generatePdfReport(
  breakdown: CalculationBreakdown,
  container: HTMLElement,
): Promise<void> {
  const canvas = await html2canvas(container, {
    scale: 2,
    backgroundColor: "#ffffff",
    logging: false,
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const maxWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * maxWidth) / canvas.width;

  if (imgHeight <= pageHeight - margin * 2) {
    pdf.addImage(imgData, "PNG", margin, margin, maxWidth, imgHeight);
  } else {
    pdf.addImage(imgData, "PNG", margin, margin, maxWidth, imgHeight);
  }

  const dateStamp = new Date().toISOString().slice(0, 10);
  pdf.save(`raschet-rvd-${dateStamp}.pdf`);
}

export function buildReportHtml(
  breakdown: CalculationBreakdown,
  options: PdfReportOptions,
): string {
  const date = new Date().toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const params = [
    row("Тип РВД", breakdown.rvdType),
    row("DN", String(breakdown.dn)),
    row("Длина", `${breakdown.length} м`),
    row("Цена за метр", `${formatRubles(breakdown.pricePerMeter)}/м`),
    row("Фитинг 1", breakdown.fitting1Label),
    row("Фитинг 2", breakdown.fitting2Label),
  ].join("");

  const costs = [
    row(
      `РВД (${formatRubles(breakdown.pricePerMeter)}/м × ${breakdown.length} м)`,
      formatRubles(breakdown.hoseCost),
    ),
    row("2 втулки", formatRubles(breakdown.sleevesCost)),
    row("Фитинг 1", formatRubles(breakdown.fitting1Cost)),
    row("Фитинг 2", formatRubles(breakdown.fitting2Cost)),
    row("Подитог", formatRubles(breakdown.subtotal)),
    ...(breakdown.markupAmount > 0
      ? [
          row(
            `Наценка (${options.adjustmentPercent}%)`,
            formatRubles(breakdown.markupAmount),
          ),
        ]
      : []),
    ...(breakdown.discountAmount > 0
      ? [
          row(
            `Скидка (${options.adjustmentPercent}%)`,
            `−${formatRubles(breakdown.discountAmount)}`,
          ),
        ]
      : []),
    `
      <div style="display: flex; justify-content: space-between; gap: 24px; padding: 10px 0 4px; margin-top: 6px; border-top: 2px solid #111; font-size: 14px; font-weight: 700;">
        <span>ИТОГО</span>
        <span>${escapeHtml(formatRubles(breakdown.total))}</span>
      </div>
    `,
  ].join("");

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #111; padding: 32px; width: 520px; background: #fff;">
      <div style="font-size: 16px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 8px;">
        Расчёт стоимости РВД
      </div>
      <div style="font-size: 12px; color: #555; margin-bottom: 4px;">
        Дата формирования: ${escapeHtml(date)}
      </div>
      ${section("Параметры заказа", params)}
      ${section("Стоимость", costs)}
      <div style="margin-top: 28px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 11px; color: #777;">
        Документ сформирован калькулятором стоимости РВД
      </div>
    </div>
  `;
}
