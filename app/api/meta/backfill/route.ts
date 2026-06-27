import { NextRequest, NextResponse } from "next/server";

// POST /api/meta/backfill
// Body: { startDate: "2026-01-01", endDate: "2026-06-11" }
// Fetches historical daily data from Meta API and saves to Supabase daily_insights.
// Requires x-sync-secret header.

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-sync-secret");
  if (secret !== process.env.SYNC_SECRET && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { startDate, endDate, force } = body as { startDate?: string; endDate?: string; force?: boolean };

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "startDate e endDate são obrigatórios" }, { status: 400 });
  }

  const { supabaseAdmin } = await import("@/lib/supabase");
  const { fetchInsights, fetchBreakdown, parseRoas, parseConversionsAll, parseLeadsTotal, parseRevenue } = await import("@/lib/meta");

  const { data: accounts, error } = await supabaseAdmin.from("ad_accounts").select("*").eq("active", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!accounts?.length) return NextResponse.json({ message: "Nenhuma conta ativa" });

  // Build list of dates to sync
  const dates: string[] = [];
  const cursor = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  while (cursor <= end) {
    dates.push(cursor.toISOString().split("T")[0]);
    cursor.setDate(cursor.getDate() + 1);
  }

  const results: { account: string; date: string; status: "ok" | "skip" | "error"; error?: string }[] = [];

  for (const account of accounts) {
    for (const dateStr of dates) {
      try {
        if (!force) {
          const { data: existing } = await supabaseAdmin
            .from("daily_insights")
            .select("id")
            .eq("account_id", account.id)
            .eq("date", dateStr)
            .limit(1);

          if (existing?.length) {
            results.push({ account: account.name, date: dateStr, status: "skip" });
            continue;
          }
        }

        const [mainData, platformBD, deviceBD, ageBD] = await Promise.all([
          fetchInsights(account.meta_account_id, account.access_token, {
            since: dateStr,
            until: dateStr,
            timeIncrement: 1,
          }),
          fetchBreakdown(account.meta_account_id, account.access_token, "publisher_platform", { since: dateStr, until: dateStr }).catch(() => []),
          fetchBreakdown(account.meta_account_id, account.access_token, "device_platform", { since: dateStr, until: dateStr }).catch(() => []),
          fetchBreakdown(account.meta_account_id, account.access_token, "age,gender", { since: dateStr, until: dateStr }).catch(() => []),
        ]);

        const row = mainData[0];
        if (!row) {
          results.push({ account: account.name, date: dateStr, status: "skip" });
          continue;
        }

        const { error: upsertErr } = await supabaseAdmin.from("daily_insights").upsert(
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
            conversions: parseConversionsAll(row),
            leads: parseLeadsTotal(row),
            revenue: parseRevenue(row),
            roas: parseRoas(row),
            breakdown_platform: platformBD.map((d) => {
              const r = d as Record<string, unknown>;
              const seg = String(r.publisher_platform ?? "Não reconhecido").replace(/\bunknown\b/gi, "Não reconhecido");
              return { segment: seg, impressions: parseInt(d.impressions ?? "0"), clicks: parseInt(d.clicks ?? "0"), spend: parseFloat(d.spend ?? "0"), ctr: parseFloat(d.ctr ?? "0"), cpm: parseFloat(d.cpm ?? "0"), roas: parseRoas(d) };
            }),
            breakdown_device: deviceBD.map((d) => {
              const r = d as Record<string, unknown>;
              const seg = String(r.device_platform ?? "Não reconhecido").replace(/\bunknown\b/gi, "Não reconhecido");
              return { segment: seg, impressions: parseInt(d.impressions ?? "0"), clicks: parseInt(d.clicks ?? "0"), spend: parseFloat(d.spend ?? "0"), ctr: parseFloat(d.ctr ?? "0"), cpm: parseFloat(d.cpm ?? "0"), roas: parseRoas(d) };
            }),
            breakdown_age_gender: ageBD.map((d) => {
              const r = d as Record<string, unknown>;
              const norm = (v: unknown) => String(v ?? "Não reconhecido").replace(/\bunknown\b/gi, "Não reconhecido");
              const gender = r.gender === "male" ? "Masculino" : r.gender === "female" ? "Feminino" : norm(r.gender);
              return { segment: `${norm(r.age)} • ${gender}`, impressions: parseInt(d.impressions ?? "0"), clicks: parseInt(d.clicks ?? "0"), spend: parseFloat(d.spend ?? "0"), ctr: parseFloat(d.ctr ?? "0"), cpm: parseFloat(d.cpm ?? "0"), roas: parseRoas(d) };
            }),
            raw_json: row,
            synced_at: new Date().toISOString(),
          },
          { onConflict: "account_id,date" }
        );

        if (upsertErr) throw upsertErr;

        results.push({ account: account.name, date: dateStr, status: "ok" });

        // Throttle to avoid Meta API rate limits
        await new Promise((r) => setTimeout(r, 300));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ account: account.name, date: dateStr, status: "error", error: msg });
      }
    }
  }

  const ok = results.filter((r) => r.status === "ok").length;
  const skipped = results.filter((r) => r.status === "skip").length;
  const errors = results.filter((r) => r.status === "error").length;

  return NextResponse.json({ success: true, summary: { ok, skipped, errors }, results });
}
