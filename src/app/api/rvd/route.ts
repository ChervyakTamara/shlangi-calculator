import { NextResponse } from "next/server";
import { fetchRvdData } from "@/lib/sheets";

export async function GET() {
  try {
    const data = await fetchRvdData();
    const types = [...new Set(data.map((item) => item.type))].sort();

    return NextResponse.json({ items: data, types });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Ошибка загрузки данных РВД";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
