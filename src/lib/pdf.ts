import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { CalculationBreakdown } from "./types";
import { formatRubles } from "./calculator";

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
  const margin = 10;
  const maxWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * maxWidth) / canvas.width;

  let y = margin;
  let remainingHeight = imgHeight;

  if (imgHeight <= pageHeight - margin * 2) {
    pdf.addImage(imgData, "PNG", margin, y, maxWidth, imgHeight);
  } else {
    pdf.addImage(imgData, "PNG", margin, y, maxWidth, imgHeight);
    remainingHeight -= pageHeight - margin * 2;
    while (remainingHeight > 0) {
      pdf.addPage();
      y = margin - (imgHeight - remainingHeight);
      pdf.addImage(imgData, "PNG", margin, y, maxWidth, imgHeight);
      remainingHeight -= pageHeight - margin * 2;
    }
  }

  pdf.save(`raschet-rvd-${Date.now()}.pdf`);
}

export function buildReportHtml(breakdown: CalculationBreakdown): string {
  const date = new Date().toLocaleString("ru-RU");

  return `
    <div style="font-family: Arial, sans-serif; color: #0f172a; padding: 24px; max-width: 600px;">
      <h1 style="font-size: 22px; margin: 0 0 4px;">Расчёт стоимости РВД</h1>
      <p style="color: #64748b; font-size: 13px; margin: 0 0 20px;">Дата: ${date}</p>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr style="background: #1e40af; color: white;">
            <th style="padding: 10px; text-align: left;">Параметр</th>
            <th style="padding: 10px; text-align: left;">Значение</th>
            <th style="padding: 10px; text-align: right;">Стоимость</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background: #f8fafc;"><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Тип РВД</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${breakdown.rvdType}</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"></td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">DN</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${breakdown.dn}</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"></td></tr>
          <tr style="background: #f8fafc;"><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Длина, м</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${breakdown.length}</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"></td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">РВД (${formatRubles(breakdown.pricePerMeter)}/м × ${breakdown.length} м)</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatRubles(breakdown.hoseCost)}</td></tr>
          <tr style="background: #f8fafc;"><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">2 втулки</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatRubles(breakdown.sleevesCost)}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Фитинг 1</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${breakdown.fitting1Label}</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatRubles(breakdown.fitting1Cost)}</td></tr>
          <tr style="background: #f8fafc;"><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Фитинг 2</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${breakdown.fitting2Label}</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatRubles(breakdown.fitting2Cost)}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Промежуточный итог</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatRubles(breakdown.subtotal)}</td></tr>
          ${breakdown.markupAmount > 0 ? `<tr style="background: #f8fafc;"><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Наценка</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">+${formatRubles(breakdown.markupAmount)}</td></tr>` : ""}
          ${breakdown.discountAmount > 0 ? `<tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Скидка</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">−${formatRubles(breakdown.discountAmount)}</td></tr>` : ""}
          <tr style="background: #dbeafe; font-weight: bold; font-size: 16px;">
            <td style="padding: 12px 8px;">ИТОГО</td>
            <td style="padding: 12px 8px;"></td>
            <td style="padding: 12px 8px; text-align: right; color: #1d4ed8;">${formatRubles(breakdown.total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}
