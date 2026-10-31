"use client";
import { useState } from "react";

export default function HandwrittenInput({ onText }: { onText(text: string): void }) {
  const [image, setImage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  async function select(file?: File) {
    if (!file) return;
    setError(""); setImage(""); setName(""); setBusy(true);
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error("Фото слишком большое: максимум 20 МБ.");
      const bitmap = await createImageBitmap(file);
      try {
        const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Не удалось открыть фото.");
        context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        setImage(canvas.toDataURL("image/jpeg", 0.9)); setName(file.name);
      } finally { bitmap.close(); }
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось открыть фото. Выбери JPG или PNG."); }
    finally { setBusy(false); }
  }
  async function recognize() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/handwriting", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({image}), signal:AbortSignal.timeout(55000)});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось распознать запись.");
      if (typeof result.text !== "string" || !result.text.trim()) throw new Error("Текст на фото не найден.");
      onText(result.text);
    } catch (e) { setError(e instanceof Error ? e.message : "Распознавание не удалось. Попробуй ещё раз."); }
    finally { setBusy(false); }
  }
  return <div className="mb-4 border border-neutral-200 bg-neutral-50 p-3 text-sm">
    <p className="mb-2 font-medium">Распознать запись от руки</p>
    <p className="mb-3 text-neutral-600">Сфотографируй одну строку РВД крупно и без бликов. Фото будет отправлено в сервис распознавания. Полученный текст можно исправить перед заполнением.</p>
    <label className="block">Фото записи (JPG, PNG, WebP)
      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} className="mt-2 block w-full text-sm" onChange={e => { void select(e.target.files?.[0]); e.target.value = ""; }}/>
    </label>
    {name && <p className="mt-2 break-all text-neutral-600">Выбрано: {name}</p>}
    <button type="button" disabled={!image || busy} onClick={recognize} className="mt-3 border border-neutral-800 px-3 py-2 font-medium disabled:opacity-50">{busy ? "Обработка фото…" : "Распознать фото"}</button>
    {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
  </div>;
}
