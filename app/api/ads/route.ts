import { NextRequest, NextResponse } from "next/server";

export interface AdGalleryItem {
  ad_id: string;
  ad_name: string;
  account_id: string;
  campaign_id: string;
  adset_id: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  frequency: number;
  leads: number;
  cpl: number;
  hook3s: number;
  hook3s_rate: number;
  thruplay: number;
  hold_rate: number;
  from_cache?: boolean;
}

const USE_MOCK =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("<project-ref>") ||
  process.env.USE_MOCK_DATA === "true";

const MOCK_ADS: AdGalleryItem[] = [
  { ad_id: "ad-001", ad_name: "Criativo 1 — Imagem Produto", account_id: "mock-account", campaign_id: "camp-001", adset_id: "adset-001", spend: 1200, impressions: 48000, clicks: 960, ctr: 2.0, cpc: 1.25, frequency: 2.1, leads: 34, cpl: 35.29, hook3s: 12000, hook3s_rate: 25.0, thruplay: 3600, hold_rate: 30.0 },
  { ad_id: "ad-002", ad_name: "Criativo 2 — Vídeo 15s", account_id: "mock-account", campaign_id: "camp-001", adset_id: "adset-001", spend: 980, impressions: 32000, clicks: 640, ctr: 2.0, cpc: 1.53, frequency: 1.8, leads: 22, cpl: 44.55, hook3s: 9600, hook3s_rate: 30.0, thruplay: 2880, hold_rate: 30.0 },
  { ad_id: "ad-003", ad_name: "Criativo 3 — Carrossel", account_id: "mock-account", campaign_id: "camp-002", adset_id: "adset-002", spend: 760, impressions: 22000, clicks: 440, ctr: 2.0, cpc: 1.73, frequency: 2.4, leads: 18, cpl: 42.22, hook3s: 0, hook3s_rate: 0, thruplay: 0, hold_rate: 0 },
  { ad_id: "ad-004", ad_name: "Criativo 4 — Vídeo Depoimento", account_id: "mock-account", campaign_id: "camp-003", adset_id: "adset-003", spend: 540, impressions: 18000, clicks: 360, ctr: 2.0, cpc: 1.5, frequency: 1.5, leads: 11, cpl: 49.09, hook3s: 5400, hook3s_rate: 30.0, thruplay: 1620, hold_rate: 30.0 },
  { ad_id: "ad-005", ad_name: "Criativo 5 — Story Vertical", account_id: "mock-account", campaign_id: "camp-004", adset_id: "adset-004", spend: 380, impressions: 15000, clicks: 300, ctr: 2.0, cpc: 1.27, frequency: 1.9, leads: 8, cpl: 47.5, hook3s: 4500, hook3s_rate: 30.0, thruplay: 0, hold_rate: 0 },
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const accountIdsParam = searchParams.get("accountIds") ?? "";
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!accountIdsParam || !startDate || !endDate) {
    return NextResponse.json({ error: "Parâmetros obrigatórios: accountIds, startDate, endDate" }, { status: 400 });
  }

  if (USE_MOCK) {
    return NextResponse.json({ ads: MOCK_ADS, from_cache: true });
  }

  const accountIds = accountIdsParam.split(",").filter(Boolean);
  return handleReal(accountIds, startDate, endDate);
}

async function handleReal(accountIds: string[], startDate: string, endDate: string): Promise<NextResponse> {
  try {
    const { supabaseAdmin } = await import("@/lib/supabase");

    // ── 1. Tentar cache ─────────────────────────────────────────────────────
    // Helper para buscar cache com datas exatas
    async function fetchCache(pStart: string, pEnd: string) {
      return supabaseAdmin
        .from("ad_insights_cache")
        .select("*")
        .in("account_id", accountIds)
        .eq("period_start", pStart)
        .eq("period_end", pEnd)
        .order("spend", { ascending: false });
    }

    // Primeiro tenta match exato; se falhar, tenta versão "encerrada ontem"
    // (o cron grava period_end = ontem, mas a UI pede endDate = hoje).
    let { data: cached, error: cacheError } = await fetchCache(startDate, endDate);

    if ((!cached || cached.length === 0) && !cacheError) {
      const todayUTC = new Date().toISOString().split("T")[0];
      if (endDate >= todayUTC) {
        // endDate é hoje ou futuro — tenta a versão cacheada mais recente disponível.
        // O cron grava period_end = ontem (relativo a quando ele rodou) e só roda 1x/dia
        // às 09:00 UTC. Entre meia-noite e esse horário, "ontem" ainda não existe no cache
        // — então aceitamos até STALE_TOLERANCE_DAYS de defasagem em vez de exigir match
        // exato, pra evitar cair no fallback ao vivo (lento com centenas de anúncios).
        const durationDays = Math.round(
          (new Date(endDate + "T00:00:00Z").getTime() - new Date(startDate + "T00:00:00Z").getTime()) / 86400000
        );
        const yesterdayObj = new Date();
        yesterdayObj.setUTCDate(yesterdayObj.getUTCDate() - 1);

        const STALE_TOLERANCE_DAYS = 3;
        const periodEndMin = new Date(yesterdayObj);
        periodEndMin.setUTCDate(periodEndMin.getUTCDate() - STALE_TOLERANCE_DAYS);

        // Janela de período_start: esperado ± 2 dias
        const pStartExpected = new Date(yesterdayObj);
        pStartExpected.setUTCDate(pStartExpected.getUTCDate() - durationDays);
        const pStartMin = new Date(pStartExpected);
        pStartMin.setUTCDate(pStartMin.getUTCDate() - 2);
        const pStartMax = new Date(pStartExpected);
        pStartMax.setUTCDate(pStartMax.getUTCDate() + 2);

        const { data: fb, error: fbErr } = await supabaseAdmin
          .from("ad_insights_cache")
          .select("*")
          .in("account_id", accountIds)
          .lte("period_end", yesterdayObj.toISOString().split("T")[0])
          .gte("period_end", periodEndMin.toISOString().split("T")[0])
          .gte("period_start", pStartMin.toISOString().split("T")[0])
          .lte("period_start", pStartMax.toISOString().split("T")[0])
          .order("period_end", { ascending: false })
          .order("cached_at", { ascending: false });

        if (!fbErr && fb && fb.length > 0) {
          // Pode haver mais de um snapshot por anúncio (dias diferentes cacheados) —
          // fica só com o mais recente de cada (já vem ordenado period_end/cached_at desc).
          const latestByAd = new Map<string, Record<string, unknown>>();
          for (const row of fb as Record<string, unknown>[]) {
            const key = `${row.account_id}:${row.ad_id}`;
            if (!latestByAd.has(key)) latestByAd.set(key, row);
          }
          cached = Array.from(latestByAd.values());
          cacheError = null;
        }
      }
    }

    if (!cacheError && cached && cached.length > 0) {
      // Verifica se todos os accountIds têm dados em cache
      const cachedAccountIds = new Set(cached.map((r: { account_id: string }) => r.account_id));
      const allCovered = accountIds.every((id) => cachedAccountIds.has(id));

      if (allCovered) {
        const ads: AdGalleryItem[] = cached.map((r: Record<string, unknown>) => ({
          ad_id: String(r.ad_id),
          ad_name: String(r.ad_name ?? "Anúncio"),
          account_id: String(r.account_id),
          campaign_id: String(r.campaign_id ?? ""),
          adset_id: String(r.adset_id ?? ""),
          spend: Number(r.spend),
          impressions: Number(r.impressions),
          clicks: Number(r.clicks),
          ctr: Number(r.ctr),
          cpc: Number(r.cpc),
          frequency: Number(r.frequency),
          leads: Number(r.leads),
          cpl: Number(r.leads) > 0 ? Number(r.spend) / Number(r.leads) : 0,
          hook3s: Number(r.hook3s),
          hook3s_rate: Number(r.hook3s_rate),
          thruplay: Number(r.thruplay),
          hold_rate: Number(r.hold_rate),
          from_cache: true,
        }));

        ads.sort((a, b) => b.spend - a.spend);
        console.log(`[ads] Cache hit: ${ads.length} anúncios para ${accountIds.join(",")} (${startDate} → ${endDate})`);
        return NextResponse.json({ ads, from_cache: true });
      }
    }

    // ── 2. Cache miss → buscar da Meta API ──────────────────────────────────
    console.log(`[ads] Cache miss para ${accountIds.join(",")} (${startDate} → ${endDate}), buscando da Meta...`);

    const {
      fetchAdInsights,
      parseLeadsTotal,
      parseVideoPlay3s,
      parseThruPlay,
    } = await import("@/lib/meta");

    const { data: accounts, error } = await supabaseAdmin
      .from("ad_accounts")
      .select("*")
      .in("id", accountIds);
    if (error) throw error;

    const allAds: AdGalleryItem[] = [];
    const cacheRows: Record<string, unknown>[] = [];

    await Promise.all(
      (accounts ?? []).map(async (account) => {
        try {
          const adInsights = await fetchAdInsights(
            account.meta_account_id,
            account.access_token,
            { since: startDate, until: endDate },
          );

          for (const row of adInsights) {
            const spend = parseFloat((row.spend as string) ?? "0");
            const impressions = parseInt((row.impressions as string) ?? "0");
            const clicks = parseInt((row.clicks as string) ?? "0");
            const ctr = parseFloat((row.ctr as string) ?? "0");
            const cpc = parseFloat((row.cpc as string) ?? "0");
            const frequency = parseFloat((row.frequency as string) ?? "0");
            const leads = parseLeadsTotal(row);
            const hook3s = parseVideoPlay3s(row);
            const thruplay = parseThruPlay(row);
            const hook3s_rate = impressions > 0 ? (hook3s / impressions) * 100 : 0;
            const hold_rate = hook3s > 0 ? (thruplay / hook3s) * 100 : 0;

            allAds.push({
              ad_id: (row.ad_id as string) ?? "",
              ad_name: (row.ad_name as string) ?? "Anúncio",
              account_id: account.id,
              campaign_id: (row.campaign_id as string) ?? "",
              adset_id: (row.adset_id as string) ?? "",
              spend, impressions, clicks, ctr, cpc, frequency, leads,
              cpl: leads > 0 ? spend / leads : 0,
              hook3s, hook3s_rate, thruplay, hold_rate,
              from_cache: false,
            });

            // Preparar row para cache
            cacheRows.push({
              account_id: account.id,
              ad_id: row.ad_id,
              ad_name: row.ad_name ?? "Anúncio",
              campaign_id: row.campaign_id,
              adset_id: row.adset_id,
              period_start: startDate,
              period_end: endDate,
              spend, impressions, clicks, ctr, cpc, frequency, leads,
              hook3s, hook3s_rate, thruplay, hold_rate,
              cached_at: new Date().toISOString(),
            });
          }
        } catch (err) {
          console.error(`[ads] Erro na conta ${account.name}:`, err);
        }
      }),
    );

    // Salvar no cache em background (sem bloquear a resposta)
    if (cacheRows.length > 0) {
      const batchUpsert = async () => {
        for (let i = 0; i < cacheRows.length; i += 50) {
          await supabaseAdmin
            .from("ad_insights_cache")
            .upsert(cacheRows.slice(i, i + 50), { onConflict: "account_id,ad_id,period_start,period_end" });
        }
        console.log(`[ads] Cache gravado: ${cacheRows.length} anúncios para ${startDate} → ${endDate}`);
      };
      // Fire and forget — não bloqueia a resposta
      batchUpsert().catch((e) => console.error("[ads] Erro ao gravar cache:", e));
    }

    allAds.sort((a, b) => b.spend - a.spend);
    return NextResponse.json({ ads: allAds, from_cache: false });
  } catch (error) {
    console.error("[ads] Error:", error);
    return NextResponse.json({ error: "Falha ao carregar anúncios" }, { status: 500 });
  }
}
