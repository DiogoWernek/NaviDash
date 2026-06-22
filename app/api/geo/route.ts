import { NextRequest, NextResponse } from "next/server";
import { MOCK_GEO_BRAZIL, MOCK_GEO_AFRICA } from "@/lib/mock-data";
import type { GeoDataItem } from "@/types";

const USE_MOCK =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("<project-ref>") ||
  process.env.USE_MOCK_DATA === "true";

// Maps Meta region name → Brazilian state abbreviation
// Meta returns region names with and without diacritics — include both variants
const BRAZIL_REGION_TO_SIGLA: Record<string, string> = {
  // with accents
  "Acre": "AC", "Alagoas": "AL", "Amapá": "AP", "Amazonas": "AM",
  "Bahia": "BA", "Ceará": "CE", "Distrito Federal": "DF", "Espírito Santo": "ES",
  "Goiás": "GO", "Maranhão": "MA", "Mato Grosso": "MT", "Mato Grosso do Sul": "MS",
  "Minas Gerais": "MG", "Pará": "PA", "Paraíba": "PB", "Paraná": "PR",
  "Pernambuco": "PE", "Piauí": "PI", "Rio de Janeiro": "RJ",
  "Rio Grande do Norte": "RN", "Rio Grande do Sul": "RS", "Rondônia": "RO",
  "Roraima": "RR", "Santa Catarina": "SC", "São Paulo": "SP",
  "Sergipe": "SE", "Tocantins": "TO",
  // without accents (Meta API sometimes returns these)
  "Amapa": "AP", "Ceara": "CE", "Espirito Santo": "ES", "Goias": "GO",
  "Maranhao": "MA", "Para": "PA", "Paraiba": "PB", "Parana": "PR",
  "Piaui": "PI", "Rondonia": "RO", "Sao Paulo": "SP",
};

const BRAZIL_SIGLA_TO_NAME: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia",
  CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás",
  MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
  PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí",
  RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul",
  RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo",
  SE: "Sergipe", TO: "Tocantins",
};

const AFRICA_CODE_TO_NAME: Record<string, string> = {
  NG: "Nigéria", ZA: "África do Sul", KE: "Quênia", GH: "Gana", EG: "Egito",
  ET: "Etiópia", TZ: "Tanzânia", CI: "Costa do Marfim", SN: "Senegal",
  CM: "Camarões", UG: "Uganda", MA: "Marrocos", AO: "Angola", MZ: "Moçambique",
  MG: "Madagáscar", ZM: "Zâmbia", ZW: "Zimbábue", RW: "Ruanda", BF: "Burkina Faso",
  ML: "Mali", TD: "Chade", NE: "Níger", DZ: "Argélia", TN: "Tunísia",
  LY: "Líbia", SD: "Sudão", SS: "Sudão do Sul", BI: "Burundi", CD: "RD Congo",
  CG: "Congo", GA: "Gabão", GN: "Guiné", SL: "Serra Leoa", LR: "Libéria",
  GM: "Gâmbia", GW: "Guiné-Bissau", CV: "Cabo Verde", ST: "São Tomé",
  KM: "Comores", MU: "Maurício", LS: "Lesoto", SZ: "Suazilândia",
  BW: "Botsuana", NA: "Namíbia", SO: "Somália", DJ: "Djibuti", ER: "Eritreia",
};

const AFRICA_CODES = new Set(Object.keys(AFRICA_CODE_TO_NAME));

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const accountIdsParam = searchParams.get("accountIds") ?? "";
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!accountIdsParam || !startDate || !endDate) {
    return NextResponse.json({ error: "Parâmetros obrigatórios: accountIds, startDate, endDate" }, { status: 400 });
  }

  if (USE_MOCK) {
    return NextResponse.json({ brazil: MOCK_GEO_BRAZIL, africa: MOCK_GEO_AFRICA });
  }

  return handleReal(accountIdsParam.split(",").filter(Boolean), startDate, endDate);
}

async function handleReal(accountIds: string[], startDate: string, endDate: string): Promise<NextResponse> {
  try {
    const { supabaseAdmin } = await import("@/lib/supabase");
    const { fetchInsights } = await import("@/lib/meta");

    const { data: accounts, error } = await supabaseAdmin.from("ad_accounts").select("*").in("id", accountIds);
    if (error) throw error;

    const brazilAcc: Record<string, { spend: number; impressions: number; clicks: number }> = {};
    const africaAcc: Record<string, { spend: number; impressions: number; clicks: number }> = {};

    await Promise.all(
      (accounts ?? []).map(async (account) => {
        try {
          // Brazil: breakdown by region (dimensão vem automaticamente, não vai em fields)
          const brazilData = await fetchInsights(account.meta_account_id, account.access_token, {
            since: startDate,
            until: endDate,
            timeIncrement: "all_days" as const,
            breakdown: "region",
            fields: ["impressions", "clicks", "spend"],
          }).catch((e) => { console.error("[geo] Brazil region fetch error:", e?.message); return []; });

          console.log(`[geo] Brazil region rows for ${account.name}:`, brazilData.length, brazilData.slice(0, 2));
          for (const row of brazilData) {
            const r = row as Record<string, unknown>;
            if (r.country && (r.country as string).toUpperCase() !== "BR") continue;
            const regionName = (r.region as string) ?? "";
            const sigla = BRAZIL_REGION_TO_SIGLA[regionName];
            if (!sigla) {
              if (regionName) console.log(`[geo] Unknown region: "${regionName}"`);
              continue;
            }
            if (!brazilAcc[sigla]) brazilAcc[sigla] = { spend: 0, impressions: 0, clicks: 0 };
            brazilAcc[sigla].spend += parseFloat((r.spend as string) || "0");
            brazilAcc[sigla].impressions += parseInt((r.impressions as string) || "0");
            brazilAcc[sigla].clicks += parseInt((r.clicks as string) || "0");
          }

          // Africa: breakdown by country (dimensão vem automaticamente)
          const countryData = await fetchInsights(account.meta_account_id, account.access_token, {
            since: startDate,
            until: endDate,
            timeIncrement: "all_days" as const,
            breakdown: "country",
            fields: ["impressions", "clicks", "spend"],
          }).catch((e) => { console.error("[geo] Country fetch error:", e?.message); return []; });

          for (const row of countryData) {
            const r = row as Record<string, unknown>;
            const code = (r.country as string)?.toUpperCase();
            if (!code || !AFRICA_CODES.has(code)) continue;
            if (!africaAcc[code]) africaAcc[code] = { spend: 0, impressions: 0, clicks: 0 };
            africaAcc[code].spend += parseFloat((r.spend as string) ?? "0");
            africaAcc[code].impressions += parseInt((r.impressions as string) ?? "0");
            africaAcc[code].clicks += parseInt((r.clicks as string) ?? "0");
          }
        } catch (err) {
          console.error(`[geo] Error for account ${account.name}:`, err);
        }
      })
    );

    const brazil: GeoDataItem[] = Object.entries(brazilAcc).map(([code, d]) => ({
      code,
      name: BRAZIL_SIGLA_TO_NAME[code] ?? code,
      spend: Math.round(d.spend * 100) / 100,
      impressions: d.impressions,
      clicks: d.clicks,
      ctr: d.impressions > 0 ? Math.round((d.clicks / d.impressions) * 10000) / 100 : 0,
      cpm: d.impressions > 0 ? Math.round((d.spend / d.impressions) * 100000) / 100 : 0,
    })).sort((a, b) => b.spend - a.spend);

    const africa: GeoDataItem[] = Object.entries(africaAcc).map(([code, d]) => ({
      code,
      name: AFRICA_CODE_TO_NAME[code] ?? code,
      spend: Math.round(d.spend * 100) / 100,
      impressions: d.impressions,
      clicks: d.clicks,
      ctr: d.impressions > 0 ? Math.round((d.clicks / d.impressions) * 10000) / 100 : 0,
      cpm: d.impressions > 0 ? Math.round((d.spend / d.impressions) * 100000) / 100 : 0,
    })).sort((a, b) => b.spend - a.spend);

    return NextResponse.json({ brazil, africa });
  } catch (err) {
    console.error("[geo] Error:", err);
    return NextResponse.json({ error: "Falha ao carregar dados geográficos" }, { status: 500 });
  }
}
