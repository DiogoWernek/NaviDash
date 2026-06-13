import { NextRequest, NextResponse } from "next/server";
import type { AdSet, Ad } from "@/types";
import { MOCK_CAMPAIGNS } from "@/lib/mock-data";

const USE_MOCK =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("<project-ref>") ||
  process.env.USE_MOCK_DATA === "true";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get("campaignId");
  const accountId = searchParams.get("accountId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!campaignId || !accountId || !startDate || !endDate) {
    return NextResponse.json({ error: "Parâmetros obrigatórios: campaignId, accountId, startDate, endDate" }, { status: 400 });
  }

  if (USE_MOCK) {
    const campaign = MOCK_CAMPAIGNS.find((c) => c.id === campaignId);
    return NextResponse.json({ adsets: campaign?.adsets ?? [] });
  }

  return handleReal(campaignId, accountId, startDate, endDate);
}

async function handleReal(
  campaignId: string,
  accountId: string,
  startDate: string,
  endDate: string
): Promise<NextResponse> {
  try {
    const { supabaseAdmin } = await import("@/lib/supabase");
    const { fetchAdSetInsights, fetchAdInsights, parseRoas, parseConversionsAll } = await import("@/lib/meta");

    const { data: accounts, error } = await supabaseAdmin
      .from("ad_accounts")
      .select("meta_account_id, access_token, name")
      .eq("id", accountId)
      .limit(1);
    if (error || !accounts?.length) throw error ?? new Error("Conta não encontrada");

    const account = accounts[0];
    const dateParams = { since: startDate, until: endDate };

    const [adsetInsights, adInsightsData] = await Promise.all([
      fetchAdSetInsights(account.meta_account_id, account.access_token, dateParams, campaignId).catch(() => []),
      fetchAdInsights(account.meta_account_id, account.access_token, dateParams, campaignId).catch(() => []),
    ]);

    const adsets: AdSet[] = adsetInsights
      .filter((a) => (a as Record<string, unknown>).campaign_id === campaignId)
      .map((as) => {
        const asRaw = as as Record<string, unknown>;
        const asId = String(asRaw.adset_id ?? "");
        const asSpend = parseFloat(as.spend ?? "0");
        const asConvs = parseConversionsAll(as);

        const ads: Ad[] = adInsightsData
          .filter((ad) => (ad as Record<string, unknown>).adset_id === asId)
          .map((ad) => {
            const adRaw = ad as Record<string, unknown>;
            const adConvs = parseConversionsAll(ad);
            const adSpend = parseFloat(ad.spend ?? "0");
            return {
              id: String(adRaw.ad_id ?? `ad-${ad.ad_name}`),
              adset_id: asId,
              name: String(adRaw.ad_name ?? "Anúncio"),
              spend: adSpend,
              impressions: parseInt(ad.impressions ?? "0"),
              clicks: parseInt(ad.clicks ?? "0"),
              ctr: parseFloat(ad.ctr ?? "0"),
              cpm: parseFloat(ad.cpm ?? "0"),
              roas: parseRoas(ad),
              conversions: adConvs,
              cpa: adConvs > 0 ? adSpend / adConvs : undefined,
            };
          });

        return {
          id: asId,
          campaign_id: campaignId,
          name: String(asRaw.adset_name ?? "Conjunto"),
          spend: asSpend,
          impressions: parseInt(as.impressions ?? "0"),
          clicks: parseInt(as.clicks ?? "0"),
          ctr: parseFloat(as.ctr ?? "0"),
          cpm: parseFloat(as.cpm ?? "0"),
          roas: parseRoas(as),
          conversions: asConvs,
          cpa: asConvs > 0 ? asSpend / asConvs : undefined,
          ads,
        };
      });

    return NextResponse.json({ adsets });
  } catch (error) {
    console.error("[adsets] Error:", error);
    return NextResponse.json({ error: "Falha ao carregar conjuntos" }, { status: 500 });
  }
}
