import { NextResponse } from "next/server";
import { fetchFittingsData } from "@/lib/sheets";

export async function GET() {
  try {
    const items = await fetchFittingsData();
    return NextResponse.json({ items });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Ошибка загрузки данных фитингов";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
