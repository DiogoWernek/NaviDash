import { NextRequest, NextResponse } from "next/server";
import type { InsightResponse, DailyInsight } from "@/types";
import {
  generateMockInsights,
  MOCK_CAMPAIGNS,
  MOCK_AD_ACCOUNTS,
} from "@/lib/mock-data";
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
  console.log("[api/insights] accountIds:", accountIds);

  if (USE_MOCK) {
    return handleMock(accountIds, startDate, endDate);
  }

  return handleReal(accountIds, startDate, endDate);
}

function handleMock(
  accountIds: string[],
  startDate: string,
  endDate: string
): NextResponse {
  const allInsights: DailyInsight[] = [];

  for (const accountId of accountIds) {
    const insights = generateMockInsights(accountId, startDate, endDate);
    allInsights.push(...insights);
  }

  const startDateObj = new Date(startDate + "T00:00:00");
  const endDateObj = new Date(endDate + "T00:00:00");
  const { from: prevFrom, to: prevTo } = getPreviousPeriod(
    startDateObj,
    endDateObj
  );

  const previousInsights: DailyInsight[] = [];
  for (const accountId of accountIds) {
    const insights = generateMockInsights(
      accountId,
      dateToString(prevFrom),
      dateToString(prevTo)
    );
    previousInsights.push(...insights);
  }

  const campaigns = MOCK_CAMPAIGNS.filter((c) => {
    const account = MOCK_AD_ACCOUNTS.find((a) => a.id === c.account_id);
    return account && accountIds.includes(account.id);
  });

  const response: InsightResponse = {
    insights: allInsights,
    previousInsights,
    campaigns,
  };

  return NextResponse.json(response);
}

async function handleReal(
  accountIds: string[],
  startDate: string,
  endDate: string
): Promise<NextResponse> {
  try {
    const { supabaseAdmin } = await import("@/lib/supabase");
    const {
      fetchInsights: fetchMetaInsights,
      parseRoas,
      parseConversions,
    } = await import("@/lib/meta");

    const startDateObj = new Date(startDate + "T00:00:00");
    const endDateObj = new Date(endDate + "T00:00:00");
    const includestoday = isToday(endDate);

    const { from: prevFrom, to: prevTo } = getPreviousPeriod(
      startDateObj,
      endDateObj
    );

    const accountsResult = await supabaseAdmin
      .from("ad_accounts")
      .select("*")
      .in("id", accountIds);

    if (accountsResult.error) throw accountsResult.error;
    const accounts = accountsResult.data ?? [];

    const allInsights: DailyInsight[] = [];
    const allPrevInsights: DailyInsight[] = [];

    for (const account of accounts) {
      let historicalStart = startDate;
      let historicalEnd = endDate;

      if (includestoday) {
        const yesterday = new Date(endDateObj);
        yesterday.setDate(yesterday.getDate() - 1);
        historicalEnd = dateToString(yesterday);
      }

      if (historicalStart <= historicalEnd) {
        const { data: dbInsights } = await supabaseAdmin
          .from("daily_insights")
          .select("*")
          .eq("account_id", account.id)
          .gte("date", historicalStart)
          .lte("date", historicalEnd);

        if (dbInsights) allInsights.push(...dbInsights);
      }

      if (includestoday) {
        const todayStr = dateToString(new Date());
        try {
          const metaData = await fetchMetaInsights(
            account.meta_account_id,
            account.access_token,
            { since: todayStr, until: todayStr }
          );

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
              conversions: parseConversions(row),
              roas: parseRoas(row),
              breakdown_platform: [],
              breakdown_device: [],
              breakdown_age_gender: [],
            });
          }
        } catch (err) {
          console.error(`Meta API error for account ${account.id}:`, err);
        }
      }

      const { data: prevDbInsights } = await supabaseAdmin
        .from("daily_insights")
        .select("*")
        .eq("account_id", account.id)
        .gte("date", dateToString(prevFrom))
        .lte("date", dateToString(prevTo));

      if (prevDbInsights) allPrevInsights.push(...prevDbInsights);
    }

    const { data: campaignsData } = await supabaseAdmin
      .from("campaigns")
      .select("*, adsets(*, ads(*))")
      .in("account_id", accountIds);

    const response: InsightResponse = {
      insights: allInsights,
      previousInsights: allPrevInsights,
      campaigns: campaignsData ?? [],
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching insights:", error);
    return NextResponse.json(
      { error: "Falha ao carregar insights" },
      { status: 500 }
    );
  }
}
