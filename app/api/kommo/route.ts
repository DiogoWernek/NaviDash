import { NextRequest, NextResponse } from "next/server";
import type { KommoDashboardData } from "@/lib/kommo";

function mockData(from: string, to: string, spend: number): KommoDashboardData {
  const byDay: Array<{ date: string; leads: number; matriculas: number }> = [];
  const fromTs = new Date(from + "T00:00:00").getTime();
  const toTs = new Date(to + "T00:00:00").getTime();
  for (let ts = fromTs; ts <= toTs; ts += 86_400_000) {
    const d = new Date(ts);
    const seed = d.getDate() + d.getMonth() * 31;
    const leads = 2 + (seed % 5);
    const matriculas = seed % 4 === 0 ? 2 : seed % 3 === 0 ? 1 : 0;
    byDay.push({ date: d.toISOString().split("T")[0], leads, matriculas });
  }
  const totalLeads = byDay.reduce((s, d) => s + d.leads, 0);
  const totalMatriculas = byDay.reduce((s, d) => s + d.matriculas, 0);
  const totalLost = Math.floor(totalLeads * 0.38);
  const totalRevenue = totalMatriculas * 1500;
  const cpa = totalMatriculas > 0 ? spend / totalMatriculas : 0;

  return {
    totalLeads,
    totalMatriculas,
    totalLost,
    totalRevenue,
    cpa,
    byStage: [
      { stage: "Ganho", count: totalMatriculas, value: totalRevenue },
      { stage: "Negociação", count: Math.ceil(totalLeads * 0.15), value: 0 },
      { stage: "Standby", count: Math.ceil(totalLeads * 0.10), value: 0 },
      { stage: "Pagamento", count: Math.ceil(totalLeads * 0.07), value: Math.ceil(totalMatriculas * 0.07) * 1500 },
      { stage: "Perdido", count: totalLost, value: 0 },
    ],
    byCourse: [
      { course: "Marketing Digital", leads: Math.ceil(totalLeads * 0.38), matriculas: Math.ceil(totalMatriculas * 0.40), revenue: Math.ceil(totalMatriculas * 0.40) * 1500, cpa: cpa * 1.05 },
      { course: "Gestão de Tráfego", leads: Math.ceil(totalLeads * 0.30), matriculas: Math.ceil(totalMatriculas * 0.30), revenue: Math.ceil(totalMatriculas * 0.30) * 1500, cpa: cpa * 1.10 },
      { course: "Social Media", leads: Math.ceil(totalLeads * 0.22), matriculas: Math.ceil(totalMatriculas * 0.22), revenue: Math.ceil(totalMatriculas * 0.22) * 1500, cpa: cpa * 0.90 },
      { course: "Não informado", leads: Math.ceil(totalLeads * 0.10), matriculas: Math.ceil(totalMatriculas * 0.08), revenue: Math.ceil(totalMatriculas * 0.08) * 1500, cpa: cpa * 0.95 },
    ],
    bySource: [
      { source: "Instagram", count: Math.ceil(totalLeads * 0.48), matriculas: Math.ceil(totalMatriculas * 0.50) },
      { source: "WhatsApp", count: Math.ceil(totalLeads * 0.27), matriculas: Math.ceil(totalMatriculas * 0.27) },
      { source: "Site", count: Math.ceil(totalLeads * 0.17), matriculas: Math.ceil(totalMatriculas * 0.15) },
      { source: "Não informado", count: Math.ceil(totalLeads * 0.08), matriculas: Math.ceil(totalMatriculas * 0.08) },
    ],
    byDay,
  };
}

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
    return NextResponse.json(mockData(from, to, spend));
  }

  try {
    const { fetchKommoLeads, fetchKommoPipelines, buildDashboard } = await import("@/lib/kommo");
    const courseFieldId = process.env.KOMMO_COURSE_FIELD_ID
      ? parseInt(process.env.KOMMO_COURSE_FIELD_ID)
      : undefined;
    const sourceFieldId = process.env.KOMMO_SOURCE_FIELD_ID
      ? parseInt(process.env.KOMMO_SOURCE_FIELD_ID)
      : undefined;
    const defaultTicketPrice = process.env.KOMMO_DEFAULT_TICKET_PRICE
      ? parseFloat(process.env.KOMMO_DEFAULT_TICKET_PRICE)
      : 0;

    const [rawLeads, pipelines] = await Promise.all([
      fetchKommoLeads(from, to),
      fetchKommoPipelines(),
    ]);

    return NextResponse.json(buildDashboard(rawLeads, pipelines, spend, courseFieldId, sourceFieldId, defaultTicketPrice));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[api/kommo]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
