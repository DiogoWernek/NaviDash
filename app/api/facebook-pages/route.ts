import { NextResponse } from "next/server";
import type { FacebookPage } from "@/types";

const USE_MOCK =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("<project-ref>") ||
  process.env.USE_MOCK_DATA === "true";

export async function GET() {
  if (USE_MOCK) {
    const mock: FacebookPage[] = [
      { id: "mock-1", name: "Página Exemplo", meta_page_id: "123456789012345", created_at: new Date().toISOString() },
    ];
    return NextResponse.json(mock);
  }

  try {
    const { supabaseAdmin } = await import("@/lib/supabase");
    const { data, error } = await supabaseAdmin
      .from("facebook_pages")
      .select("*")
      .order("name");

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error("[api/facebook-pages] GET error:", error);
    return NextResponse.json({ error: "Falha ao carregar páginas" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (USE_MOCK) {
    const body = await req.json() as { name: string; meta_page_id: string };
    const created: FacebookPage = {
      id: `mock-${Date.now()}`,
      name: body.name,
      meta_page_id: body.meta_page_id,
      created_at: new Date().toISOString(),
    };
    return NextResponse.json(created, { status: 201 });
  }

  try {
    const body = await req.json() as { name: string; meta_page_id: string };

    if (!body.name?.trim() || !body.meta_page_id?.trim()) {
      return NextResponse.json({ error: "Nome e ID são obrigatórios" }, { status: 400 });
    }

    const { supabaseAdmin } = await import("@/lib/supabase");
    const { data, error } = await supabaseAdmin
      .from("facebook_pages")
      .insert({ name: body.name.trim(), meta_page_id: body.meta_page_id.trim() })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("[api/facebook-pages] POST error:", error);
    return NextResponse.json({ error: "Falha ao salvar página" }, { status: 500 });
  }
}
