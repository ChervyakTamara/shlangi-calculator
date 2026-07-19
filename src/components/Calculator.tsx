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
import { FITTING_TYPES } from "@/lib/types";

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
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
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
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="mb-4 text-base font-semibold text-slate-800">{title}</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          label="Тип фитинга"
          value={fittingType}
          onChange={(value) => onTypeChange(value as FittingType | "")}
          options={FITTING_TYPES.map((type) => ({ value: type, label: type }))}
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
      <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={hemorrhoid}
          onChange={(event) => onHemorrhoidChange(event.target.checked)}
          disabled={disabled}
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <span>
          Геморрой <span className="text-slate-500">(работа с фитингом клиента, 2 000 ₽)</span>
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
          throw new Error("Не удалось загрузить данные из Google Таблиц");
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
    reportRef.current.innerHTML = buildReportHtml(breakdown);

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
      <div className="flex min-h-[50vh] items-center justify-center text-slate-600">
        Загрузка данных из Google Таблиц...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Параметры РВД</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <SelectField
              label="Тип РВД"
              value={rvdType}
              onChange={setRvdType}
              options={rvdTypes.map((type) => ({ value: type, label: type }))}
              placeholder="Выберите тип"
            />
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-700">DN (диаметр)</span>
              <input
                type="number"
                min="0"
                step="1"
                value={dn}
                onChange={(event) => setDn(event.target.value)}
                placeholder="Например, 12"
                className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-700">Длина, м</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={length}
                onChange={(event) => setLength(event.target.value)}
                placeholder="Например, 1.5"
                className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>

          {rvdType && dnNumber > 0 && !selectedRvd && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Для типа «{rvdType}» и DN {dnNumber} нет данных в таблице.
            </p>
          )}

          {selectedRvd && (
            <div className="mt-4 grid gap-2 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-900 md:grid-cols-2">
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

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Наценка / Скидка</h2>
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={markupEnabled}
                onChange={(event) => handleMarkupChange(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              Наценка
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={discountEnabled}
                onChange={(event) => handleDiscountChange(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              Скидка
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-700">Процент, %</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={adjustmentPercent}
                onChange={(event) => setAdjustmentPercent(event.target.value)}
                disabled={!markupEnabled && !discountEnabled}
                placeholder="0"
                className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
              />
            </label>
          </div>
        </section>
      </div>

      <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Итог</h2>

        {breakdown ? (
          <div className="space-y-2 text-sm text-slate-700">
            <div className="flex justify-between gap-4">
              <span>РВД ({breakdown.length} м)</span>
              <span>{formatRubles(breakdown.hoseCost)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>2 втулки</span>
              <span>{formatRubles(breakdown.sleevesCost)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="truncate">Фитинг 1</span>
              <span>{formatRubles(breakdown.fitting1Cost)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="truncate">Фитинг 2</span>
              <span>{formatRubles(breakdown.fitting2Cost)}</span>
            </div>
            {breakdown.markupAmount > 0 && (
              <div className="flex justify-between gap-4 text-green-700">
                <span>Наценка</span>
                <span>+{formatRubles(breakdown.markupAmount)}</span>
              </div>
            )}
            {breakdown.discountAmount > 0 && (
              <div className="flex justify-between gap-4 text-red-600">
                <span>Скидка</span>
                <span>−{formatRubles(breakdown.discountAmount)}</span>
              </div>
            )}
            <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
              <span className="text-base font-semibold text-slate-900">Итого</span>
              <span className="text-2xl font-bold text-blue-700">
                {formatRubles(breakdown.total)}
              </span>
            </div>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={pdfLoading}
              className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pdfLoading ? "Создание PDF..." : "Скачать PDF"}
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Заполните тип РВД, DN и длину для расчёта стоимости.
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
