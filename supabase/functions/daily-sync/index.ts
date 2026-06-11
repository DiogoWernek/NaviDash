import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const META_API_VERSION = "v21.0";
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MetaRow {
  impressions?: string;
  clicks?: string;
  spend?: string;
  reach?: string;
  frequency?: string;
  cpm?: string;
  cpc?: string;
  ctr?: string;
  actions?: Array<{ action_type: string; value: string }>;
  purchase_roas?: Array<{ action_type: string; value: string }>;
  publisher_platform?: string;
  device_platform?: string;
  age?: string;
  gender?: string;
  [key: string]: unknown;
}

function parseRoas(row: MetaRow): number {
  const purchaseRoas = row.purchase_roas?.find(
    (a) => a.action_type === "omni_purchase"
  );
  if (purchaseRoas) return parseFloat(purchaseRoas.value);
  const purchases = row.actions?.find(
    (a) => a.action_type === "omni_purchase" || a.action_type === "purchase"
  );
  if (purchases && row.spend) {
    return parseFloat(purchases.value) / (parseFloat(row.spend) || 1);
  }
  return 0;
}

function parseConversions(row: MetaRow): number {
  const conv = row.actions?.find(
    (a) => a.action_type === "omni_purchase" || a.action_type === "purchase"
  );
  return conv ? parseInt(conv.value) : 0;
}

async function fetchMeta(
  accountId: string,
  token: string,
  params: Record<string, string>
): Promise<MetaRow[]> {
  const qs = new URLSearchParams({ ...params, access_token: token });
  const url = `${META_API_BASE}/${accountId}/insights?${qs}`;

  const results: MetaRow[] = [];
  let nextUrl: string | undefined = url;

  while (nextUrl) {
    const res = await fetch(nextUrl);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err?.error?.message ?? "Meta API error");
    }
    const json = await res.json();
    results.push(...(json.data ?? []));
    nextUrl = json.paging?.next;
    if (nextUrl) await new Promise((r) => setTimeout(r, 200));
  }

  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split("T")[0];

    console.log(`🔄 Iniciando sync para ${dateStr}...`);

    const { data: accounts, error: accErr } = await supabase
      .from("ad_accounts")
      .select("*")
      .eq("active", true);

    if (accErr) throw accErr;
    if (!accounts?.length) {
      return new Response(
        JSON.stringify({ message: "Nenhuma conta ativa encontrada" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📋 Encontradas ${accounts.length} contas para sincronizar`);

    const results = [];

    for (const account of accounts) {
      const commonParams = {
        time_range: JSON.stringify({ since: dateStr, until: dateStr }),
        time_increment: "all_days",
      };

      try {
        const [mainData, platformData, deviceData, ageData] = await Promise.all([
          fetchMeta(account.meta_account_id, account.access_token, {
            ...commonParams,
            time_increment: "1",
            level: "account",
            fields:
              "impressions,clicks,spend,reach,frequency,cpm,cpc,ctr,conversions,purchase_roas,actions",
          }),
          fetchMeta(account.meta_account_id, account.access_token, {
            ...commonParams,
            breakdowns: "publisher_platform",
            fields: "impressions,clicks,spend,ctr,cpm,purchase_roas",
          }),
          fetchMeta(account.meta_account_id, account.access_token, {
            ...commonParams,
            breakdowns: "device_platform",
            fields: "impressions,clicks,spend,ctr,cpm,purchase_roas",
          }),
          fetchMeta(account.meta_account_id, account.access_token, {
            ...commonParams,
            breakdowns: "age,gender",
            fields: "impressions,clicks,spend,ctr,cpm,purchase_roas",
          }),
        ]);

        const row = mainData[0];
        if (!row) {
          console.log(`⚠️  Sem dados para conta ${account.name} em ${dateStr}`);
          continue;
        }

        const mapBreakdown = (data: MetaRow[], segmentKey: keyof MetaRow) =>
          data.map((d) => ({
            segment: String(d[segmentKey] ?? "Desconhecido"),
            impressions: parseInt(d.impressions ?? "0"),
            clicks: parseInt(d.clicks ?? "0"),
            spend: parseFloat(d.spend ?? "0"),
            ctr: parseFloat(d.ctr ?? "0"),
            cpm: parseFloat(d.cpm ?? "0"),
            roas: parseRoas(d),
          }));

        const mapAgeGender = (data: MetaRow[]) =>
          data.map((d) => ({
            segment: `${d.age ?? "?"} • ${d.gender === "male" ? "Masculino" : d.gender === "female" ? "Feminino" : d.gender ?? "?"}`,
            impressions: parseInt(d.impressions ?? "0"),
            clicks: parseInt(d.clicks ?? "0"),
            spend: parseFloat(d.spend ?? "0"),
            ctr: parseFloat(d.ctr ?? "0"),
            cpm: parseFloat(d.cpm ?? "0"),
            roas: parseRoas(d),
          }));

        const { error: upsertErr } = await supabase
          .from("daily_insights")
          .upsert(
            {
              account_id: account.id,
              date: dateStr,
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
              breakdown_platform: mapBreakdown(platformData, "publisher_platform"),
              breakdown_device: mapBreakdown(deviceData, "device_platform"),
              breakdown_age_gender: mapAgeGender(ageData),
              raw_json: row,
              synced_at: new Date().toISOString(),
            },
            { onConflict: "account_id,date" }
          );

        if (upsertErr) throw upsertErr;

        if (account.token_expires_at) {
          const expiry = new Date(account.token_expires_at);
          const daysLeft = Math.ceil((expiry.getTime() - Date.now()) / 86400000);
          if (daysLeft <= 7) {
            console.warn(
              `⚠️  TOKEN EXPIRANDO: conta "${account.name}" expira em ${daysLeft} dia(s)!`
            );
          }
        }

        console.log(`✅ Sincronizado: ${account.name}`);
        results.push({ account: account.name, status: "ok" });

        await new Promise((r) => setTimeout(r, 200));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`❌ Erro na conta ${account.name}:`, msg);
        results.push({ account: account.name, status: "error", error: msg });
      }
    }

    const successCount = results.filter((r) => r.status === "ok").length;
    const errorCount = results.filter((r) => r.status === "error").length;

    console.log(
      `🏁 Sync concluído: ${successCount} sucesso(s), ${errorCount} erro(s)`
    );

    return new Response(
      JSON.stringify({
        success: true,
        date: dateStr,
        results,
        summary: { success: successCount, errors: errorCount },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("❌ Sync falhou:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
