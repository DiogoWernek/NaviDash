import { NextRequest, NextResponse } from "next/server";
import type { InsightResponse, DailyInsight } from "@/types";
import { generateMockInsights, MOCK_CAMPAIGNS, MOCK_AD_ACCOUNTS } from "@/lib/mock-data";
import { isToday, getPreviousPeriod, dateToString } from "@/lib/utils";

const USE_MOCK =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("<project-ref>") ||
  process.env.USE_MOCK_DATA === "true";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const accountIdsParam = searchParams.get("accountIds") ?? "";
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  console.log("[api/insights] USE_MOCK:", USE_MOCK, "| params:", { accountIdsParam, startDate, endDate });

  if (!accountIdsParam || !startDate || !endDate) {
    return NextResponse.json(
      { error: "Parâmetros obrigatórios: accountIds, startDate, endDate" },
      { status: 400 }
    );
  }

  const accountIds = accountIdsParam.split(",").filter(Boolean);

  if (USE_MOCK) {
    return handleMock(accountIds, startDate, endDate);
  }

  return handleReal(accountIds, startDate, endDate);
}

function handleMock(accountIds: string[], startDate: string, endDate: string): NextResponse {
  const allInsights: DailyInsight[] = [];
  for (const accountId of accountIds) {
    allInsights.push(...generateMockInsights(accountId, startDate, endDate));
  }

  const startDateObj = new Date(startDate + "T00:00:00");
  const endDateObj = new Date(endDate + "T00:00:00");
  const { from: prevFrom, to: prevTo } = getPreviousPeriod(startDateObj, endDateObj);

  const previousInsights: DailyInsight[] = [];
  for (const accountId of accountIds) {
    previousInsights.push(...generateMockInsights(accountId, dateToString(prevFrom), dateToString(prevTo)));
  }

  const campaigns = MOCK_CAMPAIGNS.filter((c) => {
    const account = MOCK_AD_ACCOUNTS.find((a) => a.id === c.account_id);
    return account && accountIds.includes(account.id);
  });

  return NextResponse.json({ insights: allInsights, previousInsights, campaigns } as InsightResponse);
}

async function handleReal(accountIds: string[], startDate: string, endDate: string): Promise<NextResponse> {
  try {
    const { supabaseAdmin } = await import("@/lib/supabase");
    const { fetchInsights: fetchMetaInsights, fetchBreakdown, parseRoas, parseConversionsAll, parseLeadsTotal, parseRevenue, parseLinkClicks, parseVideoPlay3s, parseThruPlay, parseVideoAvgTime, parseVideoP25, parseVideoP50, parseVideoP75, parseVideoP100 } = await import("@/lib/meta");
    type MetaInsightsRaw = Awaited<ReturnType<typeof fetchMetaInsights>>[number];

    const startDateObj = new Date(startDate + "T00:00:00");
    const endDateObj = new Date(endDate + "T00:00:00");
    const includestoday = isToday(endDate);
    const todayStr = dateToString(new Date());
    const { from: prevFrom, to: prevTo } = getPreviousPeriod(startDateObj, endDateObj);

    const { data: accounts, error } = await supabaseAdmin.from("ad_accounts").select("*").in("id", accountIds);
    if (error) throw error;

    const allInsights: DailyInsight[] = [];
    const allPrevInsights: DailyInsight[] = [];

    for (const account of accounts ?? []) {
      // Historical from Supabase
      let historicalEnd = endDate;
      if (includestoday) {
        const yesterday = new Date(endDateObj);
        yesterday.setDate(yesterday.getDate() - 1);
        historicalEnd = dateToString(yesterday);
      }

      if (startDate <= historicalEnd) {
        const { data: dbInsights } = await supabaseAdmin
          .from("daily_insights")
          .select("*")
          .eq("account_id", account.id)
          .gte("date", startDate)
          .lte("date", historicalEnd);
        if (dbInsights) {
          for (const row of dbInsights) {
            if (row.raw_json) {
              const raw = row.raw_json as MetaInsightsRaw;
              if (row.leads == null) row.leads = parseLeadsTotal(raw);
              if (row.revenue == null) row.revenue = parseRevenue(raw);
              if (row.link_clicks == null) row.link_clicks = parseLinkClicks(raw);
              row.video_plays = parseVideoPlay3s(raw);
              row.video_thruplay = parseThruPlay(raw);
              row.video_avg_time = parseVideoAvgTime(raw);
              row.video_p25 = parseVideoP25(raw);
              row.video_p50 = parseVideoP50(raw);
              row.video_p75 = parseVideoP75(raw);
              row.video_p100 = parseVideoP100(raw);
            }
            allInsights.push(row);
          }
        }
      }

      // Today live from Meta API (with breakdowns in parallel)
      if (includestoday) {
        try {
          const [metaData, platformBD, deviceBD, ageBD] = await Promise.all([
            fetchMetaInsights(account.meta_account_id, account.access_token, { since: todayStr, until: todayStr }),
            fetchBreakdown(account.meta_account_id, account.access_token, "publisher_platform", { since: todayStr, until: todayStr }).catch(() => []),
            fetchBreakdown(account.meta_account_id, account.access_token, "device_platform", { since: todayStr, until: todayStr }).catch(() => []),
            fetchBreakdown(account.meta_account_id, account.access_token, "age,gender", { since: todayStr, until: todayStr }).catch(() => []),
          ]);

          for (const row of metaData) {
            allInsights.push({
              id: `live-${account.id}-${todayStr}`,
              account_id: account.id,
              date: todayStr,
              impressions: parseInt(row.impressions ?? "0"),
              clicks: parseInt(row.clicks ?? "0"),
              spend: parseFloat(row.spend ?? "0"),
              reach: parseInt(row.reach ?? "0"),
              frequency: parseFloat(row.frequency ?? "0"),
              cpm: parseFloat(row.cpm ?? "0"),
              cpc: parseFloat(row.cpc ?? "0"),
              ctr: parseFloat(row.ctr ?? "0"),
              conversions: parseConversionsAll(row),
              leads: parseLeadsTotal(row),
              revenue: parseRevenue(row),
              link_clicks: parseLinkClicks(row),
              video_plays: parseVideoPlay3s(row),
              video_thruplay: parseThruPlay(row),
              video_avg_time: parseVideoAvgTime(row),
              video_p25: parseVideoP25(row),
              video_p50: parseVideoP50(row),
              video_p75: parseVideoP75(row),
              video_p100: parseVideoP100(row),
              roas: parseRoas(row),
              breakdown_platform: platformBD.map((d) => ({
                segment: String((d as Record<string, unknown>).publisher_platform ?? "Desconhecido"),
                impressions: parseInt(d.impressions ?? "0"),
                clicks: parseInt(d.clicks ?? "0"),
                spend: parseFloat(d.spend ?? "0"),
                ctr: parseFloat(d.ctr ?? "0"),
                cpm: parseFloat(d.cpm ?? "0"),
                roas: parseRoas(d),
              })),
              breakdown_device: deviceBD.map((d) => ({
                segment: String((d as Record<string, unknown>).device_platform ?? "Desconhecido"),
                impressions: parseInt(d.impressions ?? "0"),
                clicks: parseInt(d.clicks ?? "0"),
                spend: parseFloat(d.spend ?? "0"),
                ctr: parseFloat(d.ctr ?? "0"),
                cpm: parseFloat(d.cpm ?? "0"),
                roas: parseRoas(d),
              })),
              breakdown_age_gender: ageBD.map((d) => {
                const r = d as Record<string, unknown>;
                const gender = r.gender === "male" ? "Masculino" : r.gender === "female" ? "Feminino" : String(r.gender ?? "?");
                return {
                  segment: `${r.age ?? "?"} • ${gender}`,
                  impressions: parseInt(d.impressions ?? "0"),
                  clicks: parseInt(d.clicks ?? "0"),
                  spend: parseFloat(d.spend ?? "0"),
                  ctr: parseFloat(d.ctr ?? "0"),
                  cpm: parseFloat(d.cpm ?? "0"),
                  roas: parseRoas(d),
                };
              }),
            });
          }
        } catch (err) {
          console.error(`[insights] Meta live error for ${account.name}:`, err);
        }
      }

      // Previous period from Supabase
      const { data: prevDbInsights } = await supabaseAdmin
        .from("daily_insights")
        .select("*")
        .eq("account_id", account.id)
        .gte("date", dateToString(prevFrom))
        .lte("date", dateToString(prevTo));
      if (prevDbInsights) allPrevInsights.push(...prevDbInsights);
    }

    // Campaigns are loaded separately via /api/campaigns
    return NextResponse.json({ insights: allInsights, previousInsights: allPrevInsights, campaigns: [] } as InsightResponse);
  } catch (error) {
    console.error("[insights] Error:", error);
    return NextResponse.json({ error: "Falha ao carregar insights" }, { status: 500 });
  }
}
