"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  calculatePrice,
  filterFittings,
  findRvdItem,
  formatRubles,
} from "@/lib/calculator";
import { buildReportHtml, generatePdfReport } from "@/lib/pdf";
import type {
  CalculationBreakdown,
  FittingItem,
  FittingType,
  RvdItem,
} from "@/lib/types";
import { FITTING_TYPES, getFittingTypeLabel } from "@/lib/types";

const fieldClass =
  "w-full border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500";
const labelClass = "text-xs font-medium uppercase tracking-wide text-neutral-500";
const sectionClass = "border border-neutral-300 bg-white p-5";
const sectionTitleClass = "mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-800";

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={labelClass}>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className={fieldClass}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FittingSection({
  title,
  dn,
  fittingType,
  onTypeChange,
  fittingId,
  onFittingChange,
  hemorrhoid,
  onHemorrhoidChange,
  options,
  disabled,
}: {
  title: string;
  dn: number;
  fittingType: FittingType | "";
  onTypeChange: (value: FittingType | "") => void;
  fittingId: string;
  onFittingChange: (value: string) => void;
  hemorrhoid: boolean;
  onHemorrhoidChange: (value: boolean) => void;
  options: FittingItem[];
  disabled: boolean;
}) {
  return (
    <section className={sectionClass}>
      <h3 className={sectionTitleClass}>{title}</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          label="Тип фитинга"
          value={fittingType}
          onChange={(value) => onTypeChange(value as FittingType | "")}
          options={FITTING_TYPES.map((type) => ({
            value: type,
            label: getFittingTypeLabel(type),
          }))}
          placeholder="Выберите тип"
          disabled={disabled || hemorrhoid}
        />
        <SelectField
          label="Фитинг"
          value={fittingId}
          onChange={onFittingChange}
          options={options.map((item) => ({
            value: item.id,
            label: `${item.visible} — ${formatRubles(item.price)}`,
          }))}
          placeholder={
            hemorrhoid
              ? "Не требуется (геморрой)"
              : !fittingType
                ? "Сначала выберите тип"
                : dn <= 0
                  ? "Укажите DN"
                  : options.length === 0
                    ? "Нет подходящих фитингов"
                    : "Выберите фитинг"
          }
          disabled={disabled || hemorrhoid || !fittingType || dn <= 0}
        />
      </div>
      <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          checked={hemorrhoid}
          onChange={(event) => onHemorrhoidChange(event.target.checked)}
          disabled={disabled}
          className="h-4 w-4 border-neutral-400"
        />
        <span>
          Геморрой <span className="text-neutral-500">(работа с фитингом клиента, 2 000 ₽)</span>
        </span>
      </label>
    </section>
  );
}

export default function Calculator() {
  const reportRef = useRef<HTMLDivElement>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [rvdData, setRvdData] = useState<RvdItem[]>([]);
  const [fittings, setFittings] = useState<FittingItem[]>([]);
  const [rvdTypes, setRvdTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [rvdType, setRvdType] = useState("");
  const [dn, setDn] = useState("");
  const [length, setLength] = useState("");

  const [fitting1Type, setFitting1Type] = useState<FittingType | "">("");
  const [fitting1Id, setFitting1Id] = useState("");
  const [fitting1Hemorrhoid, setFitting1Hemorrhoid] = useState(false);

  const [fitting2Type, setFitting2Type] = useState<FittingType | "">("");
  const [fitting2Id, setFitting2Id] = useState("");
  const [fitting2Hemorrhoid, setFitting2Hemorrhoid] = useState(false);

  const [markupEnabled, setMarkupEnabled] = useState(false);
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [adjustmentPercent, setAdjustmentPercent] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [rvdResponse, fittingsResponse] = await Promise.all([
          fetch("/api/rvd"),
          fetch("/api/fittings"),
        ]);

        if (!rvdResponse.ok || !fittingsResponse.ok) {
          throw new Error("Не удалось загрузить данные");
        }

        const rvdJson = await rvdResponse.json();
        const fittingsJson = await fittingsResponse.json();

        setRvdData(rvdJson.items);
        setRvdTypes(rvdJson.types);
        setFittings(fittingsJson.items);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Ошибка загрузки данных",
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const dnNumber = Number.parseFloat(dn) || 0;
  const lengthNumber = Number.parseFloat(length.replace(",", ".")) || 0;
  const percentNumber = Number.parseFloat(adjustmentPercent.replace(",", ".")) || 0;

  const fitting1Options = useMemo(
    () =>
      fitting1Type && dnNumber > 0
        ? filterFittings(fittings, dnNumber, fitting1Type)
        : [],
    [fittings, dnNumber, fitting1Type],
  );

  const fitting2Options = useMemo(
    () =>
      fitting2Type && dnNumber > 0
        ? filterFittings(fittings, dnNumber, fitting2Type)
        : [],
    [fittings, dnNumber, fitting2Type],
  );

  const selectedRvd = useMemo(
    () => (rvdType && dnNumber > 0 ? findRvdItem(rvdData, rvdType, dnNumber) : undefined),
    [rvdData, rvdType, dnNumber],
  );

  const breakdown: CalculationBreakdown | null = useMemo(() => {
    if (!rvdType || dnNumber <= 0 || lengthNumber <= 0) return null;

    return calculatePrice(
      {
        rvdType,
        dn: dnNumber,
        length: lengthNumber,
        fitting1Type,
        fitting1Id,
        fitting1Hemorrhoid,
        fitting2Type,
        fitting2Id,
        fitting2Hemorrhoid,
        markupEnabled,
        discountEnabled,
        adjustmentPercent: percentNumber,
      },
      rvdData,
      fittings,
    );
  }, [
    rvdType,
    dnNumber,
    lengthNumber,
    fitting1Type,
    fitting1Id,
    fitting1Hemorrhoid,
    fitting2Type,
    fitting2Id,
    fitting2Hemorrhoid,
    markupEnabled,
    discountEnabled,
    percentNumber,
    rvdData,
    fittings,
  ]);

  function handleFitting1TypeChange(value: FittingType | "") {
    setFitting1Type(value);
    setFitting1Id("");
  }

  function handleFitting2TypeChange(value: FittingType | "") {
    setFitting2Type(value);
    setFitting2Id("");
  }

  function handleFitting1Hemorrhoid(checked: boolean) {
    setFitting1Hemorrhoid(checked);
    if (checked) setFitting1Id("");
  }

  function handleFitting2Hemorrhoid(checked: boolean) {
    setFitting2Hemorrhoid(checked);
    if (checked) setFitting2Id("");
  }

  function handleMarkupChange(checked: boolean) {
    setMarkupEnabled(checked);
    if (checked) setDiscountEnabled(false);
  }

  function handleDiscountChange(checked: boolean) {
    setDiscountEnabled(checked);
    if (checked) setMarkupEnabled(false);
  }

  function handleDownloadPdf() {
    if (!breakdown || !reportRef.current) return;

    setPdfLoading(true);
    reportRef.current.innerHTML = buildReportHtml(breakdown, {
      markupEnabled,
      discountEnabled,
      adjustmentPercent: percentNumber,
    });

    generatePdfReport(breakdown, reportRef.current)
      .catch(() => {
        alert("Не удалось создать PDF. Попробуйте ещё раз.");
      })
      .finally(() => {
        setPdfLoading(false);
      });
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-neutral-600">
        Загрузка...
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-neutral-400 bg-white p-6 text-sm text-neutral-800">
        {error}
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[1fr_300px]">
      <div className="space-y-5">
        <section className={sectionClass}>
          <h2 className={sectionTitleClass}>Параметры РВД</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <SelectField
              label="Тип РВД"
              value={rvdType}
              onChange={setRvdType}
              options={rvdTypes.map((type) => ({ value: type, label: type }))}
              placeholder="Выберите тип"
            />
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>DN (диаметр)</span>
              <input
                type="number"
                min="0"
                step="1"
                value={dn}
                onChange={(event) => setDn(event.target.value)}
                placeholder="12"
                className={fieldClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Длина, м</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={length}
                onChange={(event) => setLength(event.target.value)}
                placeholder="1.5"
                className={fieldClass}
              />
            </label>
          </div>

          {rvdType && dnNumber > 0 && !selectedRvd && (
            <p className="mt-3 border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
              Для типа «{rvdType}» и DN {dnNumber} нет данных.
            </p>
          )}

          {selectedRvd && (
            <div className="mt-4 grid gap-1 border-t border-neutral-200 pt-4 text-sm text-neutral-700 md:grid-cols-2">
              <span>Цена за метр: {formatRubles(selectedRvd.pricePerMeter)}</span>
              <span>2 втулки: {formatRubles(selectedRvd.priceFor2Sleeves)}</span>
            </div>
          )}
        </section>

        <FittingSection
          title="Фитинг 1"
          dn={dnNumber}
          fittingType={fitting1Type}
          onTypeChange={handleFitting1TypeChange}
          fittingId={fitting1Id}
          onFittingChange={setFitting1Id}
          hemorrhoid={fitting1Hemorrhoid}
          onHemorrhoidChange={handleFitting1Hemorrhoid}
          options={fitting1Options}
          disabled={false}
        />

        <FittingSection
          title="Фитинг 2"
          dn={dnNumber}
          fittingType={fitting2Type}
          onTypeChange={handleFitting2TypeChange}
          fittingId={fitting2Id}
          onFittingChange={setFitting2Id}
          hemorrhoid={fitting2Hemorrhoid}
          onHemorrhoidChange={handleFitting2Hemorrhoid}
          options={fitting2Options}
          disabled={false}
        />

        <section className={sectionClass}>
          <h2 className={sectionTitleClass}>Наценка / Скидка</h2>
          <div className="flex flex-col gap-3 max-w-xs">
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={markupEnabled}
                onChange={(event) => handleMarkupChange(event.target.checked)}
                className="h-4 w-4 border-neutral-400"
              />
              Наценка
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={discountEnabled}
                onChange={(event) => handleDiscountChange(event.target.checked)}
                className="h-4 w-4 border-neutral-400"
              />
              Скидка
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Процент, %</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={adjustmentPercent}
                onChange={(event) => setAdjustmentPercent(event.target.value)}
                disabled={!markupEnabled && !discountEnabled}
                placeholder="0"
                className={`${fieldClass} w-full`}
              />
            </label>
          </div>
        </section>
      </div>

      <aside className={`h-fit ${sectionClass} lg:sticky lg:top-6`}>
        <h2 className={sectionTitleClass}>Итог</h2>

        {breakdown ? (
          <div className="space-y-2 text-sm text-neutral-700">
            <div className="flex justify-between gap-4 border-b border-neutral-200 pb-2">
              <span>РВД ({breakdown.length} м)</span>
              <span>{formatRubles(breakdown.hoseCost)}</span>
            </div>
            <div className="flex justify-between gap-4 border-b border-neutral-200 pb-2">
              <span>2 втулки</span>
              <span>{formatRubles(breakdown.sleevesCost)}</span>
            </div>
            <div className="flex justify-between gap-4 border-b border-neutral-200 pb-2">
              <span className="truncate">Фитинг 1</span>
              <span>{formatRubles(breakdown.fitting1Cost)}</span>
            </div>
            <div className="flex justify-between gap-4 border-b border-neutral-200 pb-2">
              <span className="truncate">Фитинг 2</span>
              <span>{formatRubles(breakdown.fitting2Cost)}</span>
            </div>
            {breakdown.markupAmount > 0 && (
              <div className="flex justify-between gap-4 border-b border-neutral-200 pb-2">
                <span>Наценка ({percentNumber}%)</span>
                <span>+{formatRubles(breakdown.markupAmount)}</span>
              </div>
            )}
            {breakdown.discountAmount > 0 && (
              <div className="flex justify-between gap-4 border-b border-neutral-200 pb-2">
                <span>Скидка ({percentNumber}%)</span>
                <span>−{formatRubles(breakdown.discountAmount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t-2 border-neutral-800 pt-3">
              <span className="text-sm font-semibold uppercase tracking-wide text-neutral-900">
                Итого
              </span>
              <span className="text-lg font-semibold text-neutral-900">
                {formatRubles(breakdown.total)}
              </span>
            </div>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={pdfLoading}
              className="mt-4 w-full border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pdfLoading ? "Создание PDF..." : "Скачать PDF"}
            </button>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">
            Заполните тип РВД, DN и длину для расчёта.
          </p>
        )}
      </aside>

      <div
        ref={reportRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-[-9999px] top-0 bg-white"
      />
    </div>
  );
}
