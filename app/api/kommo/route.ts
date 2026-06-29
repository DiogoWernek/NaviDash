import { NextRequest, NextResponse } from "next/server";
import type { KommoDashboardData } from "@/lib/kommo";

const EMPTY: KommoDashboardData = {
  totalLeads: 0, totalMatriculas: 0, totalLost: 0, totalRevenue: 0, cpa: 0,
  byStage: [], byCourse: [], bySource: [], byDay: [],
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const spend = parseFloat(searchParams.get("spend") ?? "0");

  if (!from || !to) {
    return NextResponse.json({ error: "from e to são obrigatórios" }, { status: 400 });
  }

  const hasCredentials =
    process.env.KOMMO_DOMAIN &&
    !process.env.KOMMO_DOMAIN.includes("<") &&
    process.env.KOMMO_ACCESS_TOKEN &&
    !process.env.KOMMO_ACCESS_TOKEN.includes("<");

  if (!hasCredentials) {
    return NextResponse.json(EMPTY);
  }

  const defaultTicketPrice = process.env.KOMMO_DEFAULT_TICKET_PRICE
    ? parseFloat(process.env.KOMMO_DEFAULT_TICKET_PRICE)
    : 0;

  try {
    const { supabaseAdmin } = await import("@/lib/supabase");
    const { buildDashboardFromCache } = await import("@/lib/kommo");

    const { data: cached, error } = await supabaseAdmin
      .from("kommo_leads_cache")
      .select("lead_id,price,status_id,status_name,is_won,is_lost,course,source,created_date")
      .gte("created_date", from)
      .lte("created_date", to);

    if (error) throw error;

    if (cached && cached.length > 0) {
      return NextResponse.json(buildDashboardFromCache(cached, spend, defaultTicketPrice));
    }

    return NextResponse.json(EMPTY);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[api/kommo]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
