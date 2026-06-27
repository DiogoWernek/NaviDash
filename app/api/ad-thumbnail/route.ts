import { NextRequest, NextResponse } from "next/server";

export interface AdThumbnailData {
  thumbnail_url?: string;
  image_url?: string;
  is_video: boolean;
}

const USE_MOCK =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("<project-ref>") ||
  process.env.USE_MOCK_DATA === "true";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const metaAdId = searchParams.get("metaAdId");
  const accountId = searchParams.get("accountId");

  if (!metaAdId || !accountId) {
    return NextResponse.json({ error: "Parâmetros obrigatórios: metaAdId, accountId" }, { status: 400 });
  }

  if (USE_MOCK) {
    return NextResponse.json({ thumbnail_url: undefined, image_url: undefined, is_video: false } satisfies AdThumbnailData);
  }

  try {
    const { supabaseAdmin } = await import("@/lib/supabase");
    const { fetchAdCreative } = await import("@/lib/meta");

    const { data: accounts, error } = await supabaseAdmin
      .from("ad_accounts")
      .select("access_token, meta_account_id")
      .eq("id", accountId)
      .limit(1);

    if (error || !accounts?.length) {
      return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
    }

    const { access_token, meta_account_id } = accounts[0];
    const creative = await fetchAdCreative(metaAdId, access_token, meta_account_id);

    return NextResponse.json({
      thumbnail_url: creative?.thumbnail_url,
      image_url: creative?.image_url,
      is_video: !!creative?.video_id,
    } satisfies AdThumbnailData);
  } catch (err) {
    console.error("[ad-thumbnail] Error:", err);
    return NextResponse.json({ error: "Falha ao carregar thumbnail" }, { status: 500 });
  }
}
