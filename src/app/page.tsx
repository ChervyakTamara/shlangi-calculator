import Calculator from "@/components/Calculator";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 px-4 py-8 md:px-8">
      <div className="mx-auto mb-8 max-w-5xl">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Калькулятор стоимости РВД
        </h1>
        <p className="mt-2 text-slate-600">
          Расчёт цены шланга с фитингами. Данные загружаются из Google Таблиц.
        </p>
      </div>
      <Calculator />
    </main>
  );
}
