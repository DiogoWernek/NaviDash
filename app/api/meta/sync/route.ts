import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-sync-secret");
  if (secret !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const USE_MOCK =
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes("<project-ref>") ||
    process.env.USE_MOCK_DATA === "true";

  if (USE_MOCK) {
    return NextResponse.json({
      success: true,
      message: "Modo mock — nenhum sync realizado",
      synced: 0,
    });
  }

  try {
    const { supabaseAdmin } = await import("@/lib/supabase");
    const { fetchInsights, fetchBreakdown, parseRoas, parseConversions } =
      await import("@/lib/meta");

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split("T")[0];

    const { data: accounts, error } = await supabaseAdmin
      .from("ad_accounts")
      .select("*")
      .eq("active", true);

    if (error) throw error;

    let syncedCount = 0;
    const errors: string[] = [];

    for (const account of accounts ?? []) {
      try {
        const [insights, platformBreakdown, deviceBreakdown, ageGenderBreakdown] =
          await Promise.all([
            fetchInsights(account.meta_account_id, account.access_token, {
              since: dateStr,
              until: dateStr,
            }),
            fetchBreakdown(
              account.meta_account_id,
              account.access_token,
              "publisher_platform",
              { since: dateStr, until: dateStr }
            ),
            fetchBreakdown(
              account.meta_account_id,
              account.access_token,
              "device_platform",
              { since: dateStr, until: dateStr }
            ),
            fetchBreakdown(
              account.meta_account_id,
              account.access_token,
              "age,gender",
              { since: dateStr, until: dateStr }
            ),
          ]);

        const row = insights[0];
        if (!row) continue;

        const mapBreakdown = (data: typeof platformBreakdown) =>
          data.map((d) => ({
            segment: Object.values(d).find((v) => typeof v === "string" && v !== dateStr) as string,
            impressions: parseInt(d.impressions ?? "0"),
            clicks: parseInt(d.clicks ?? "0"),
            spend: parseFloat(d.spend ?? "0"),
            ctr: parseFloat(d.ctr ?? "0"),
            cpm: parseFloat(d.cpm ?? "0"),
            roas: parseRoas(d),
          }));

        await supabaseAdmin.from("daily_insights").upsert(
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
            breakdown_platform: mapBreakdown(platformBreakdown),
            breakdown_device: mapBreakdown(deviceBreakdown),
            breakdown_age_gender: mapBreakdown(ageGenderBreakdown),
            raw_json: row,
            synced_at: new Date().toISOString(),
          },
          { onConflict: "account_id,date" }
        );

        const tokenExpiry = account.token_expires_at
          ? new Date(account.token_expires_at)
          : null;
        if (tokenExpiry) {
          const daysUntilExpiry = Math.ceil(
            (tokenExpiry.getTime() - Date.now()) / 86400000
          );
          if (daysUntilExpiry <= 7) {
            console.warn(
              `⚠️  Token da conta ${account.name} expira em ${daysUntilExpiry} dias!`
            );
          }
        }

        syncedCount++;
        await new Promise((r) => setTimeout(r, 200));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${account.name}: ${msg}`);
        console.error(`Sync error for ${account.name}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      synced: syncedCount,
      errors: errors.length > 0 ? errors : undefined,
      date: dateStr,
    });
  } catch (error) {
    console.error("Sync failed:", error);
    return NextResponse.json({ error: "Falha no sync" }, { status: 500 });
  }
}
