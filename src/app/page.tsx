import Calculator from "@/components/Calculator";

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-8 md:px-8">
      <div className="mx-auto mb-6 max-w-5xl border-b border-neutral-300 pb-4">
        <h1 className="text-xl font-semibold tracking-wide text-neutral-900 uppercase">
          Калькулятор стоимости РВД
        </h1>
      </div>
      <Calculator />
    </main>
  );
}
