const META_API_VERSION = "v21.0";
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

export interface MetaInsightsParams {
  since: string;
  until: string;
  level?: "account" | "campaign" | "adset" | "ad";
  timeIncrement?: number | "monthly" | "all_days";
  fields?: string[];
  breakdown?: string;
  filtering?: string;
}

export interface MetaInsightsRaw {
  impressions?: string;
  clicks?: string;
  spend?: string;
  reach?: string;
  frequency?: string;
  cpm?: string;
  cpc?: string;
  ctr?: string;
  conversions?: string;
  purchase_roas?: Array<{ action_type: string; value: string }>;
  actions?: Array<{ action_type: string; value: string }>;
  date_start?: string;
  date_stop?: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  [key: string]: unknown;
}

export interface MetaApiResponse {
  data: MetaInsightsRaw[];
  paging?: {
    cursors?: { before: string; after: string };
    next?: string;
  };
}

const DEFAULT_FIELDS = [
  "impressions",
  "clicks",
  "spend",
  "reach",
  "frequency",
  "cpm",
  "cpc",
  "ctr",
  "conversions",
  "purchase_roas",
  "actions",
].join(",");

export async function fetchInsights(
  accountId: string,
  accessToken: string,
  params: MetaInsightsParams
): Promise<MetaInsightsRaw[]> {
  const searchParams = new URLSearchParams({
    access_token: accessToken,
    fields: params.fields?.join(",") ?? DEFAULT_FIELDS,
    time_range: JSON.stringify({ since: params.since, until: params.until }),
    time_increment: String(params.timeIncrement ?? 1),
    level: params.level ?? "account",
  });

  if (params.breakdown) {
    searchParams.set("breakdowns", params.breakdown);
  }

  if (params.filtering) {
    searchParams.set("filtering", params.filtering);
  }

  const url = `${META_API_BASE}/${accountId}/insights?${searchParams.toString()}`;
  const allData: MetaInsightsRaw[] = [];

  let nextUrl: string | undefined = url;
  while (nextUrl) {
    const response = await fetch(nextUrl);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Meta API error: ${error?.error?.message ?? response.statusText}`
      );
    }
    const json: MetaApiResponse = await response.json();
    allData.push(...json.data);
    nextUrl = json.paging?.next;

    if (nextUrl) await new Promise((r) => setTimeout(r, 200));
  }

  return allData;
}

export async function fetchBreakdown(
  accountId: string,
  accessToken: string,
  breakdownType: "publisher_platform" | "device_platform" | "age,gender",
  params: { since: string; until: string }
): Promise<MetaInsightsRaw[]> {
  return fetchInsights(accountId, accessToken, {
    ...params,
    timeIncrement: "all_days" as const,
    breakdown: breakdownType,
    fields: ["impressions", "clicks", "spend", "cpm", "ctr", "purchase_roas"],
  });
}

export async function fetchCampaignInsights(
  accountId: string,
  accessToken: string,
  params: { since: string; until: string }
): Promise<MetaInsightsRaw[]> {
  return fetchInsights(accountId, accessToken, {
    ...params,
    timeIncrement: "all_days" as const,
    level: "campaign",
    fields: [
      "campaign_id",
      "campaign_name",
      "impressions",
      "clicks",
      "spend",
      "reach",
      "cpm",
      "cpc",
      "ctr",
      "purchase_roas",
      "actions",
    ],
  });
}

const ADSET_FIELDS = [
  "campaign_id",
  "adset_id",
  "adset_name",
  "impressions",
  "clicks",
  "spend",
  "reach",
  "cpm",
  "cpc",
  "ctr",
  "purchase_roas",
  "actions",
];

const AD_FIELDS = [
  "campaign_id",
  "adset_id",
  "ad_id",
  "ad_name",
  "impressions",
  "clicks",
  "spend",
  "cpm",
  "cpc",
  "ctr",
  "purchase_roas",
  "actions",
];

export async function fetchAdSetInsights(
  accountId: string,
  accessToken: string,
  params: { since: string; until: string },
  campaignId?: string
): Promise<MetaInsightsRaw[]> {
  return fetchInsights(accountId, accessToken, {
    ...params,
    timeIncrement: "all_days" as const,
    level: "adset",
    fields: ADSET_FIELDS,
    filtering: campaignId
      ? JSON.stringify([{ field: "campaign.id", operator: "EQUAL", value: campaignId }])
      : undefined,
  });
}

export async function fetchAdInsights(
  accountId: string,
  accessToken: string,
  params: { since: string; until: string },
  campaignId?: string
): Promise<MetaInsightsRaw[]> {
  return fetchInsights(accountId, accessToken, {
    ...params,
    timeIncrement: "all_days" as const,
    level: "ad",
    fields: AD_FIELDS,
    filtering: campaignId
      ? JSON.stringify([{ field: "campaign.id", operator: "EQUAL", value: campaignId }])
      : undefined,
  });
}

export function parseRoas(data: MetaInsightsRaw): number {
  const purchaseRoas = data.purchase_roas?.find(
    (a) => a.action_type === "omni_purchase"
  );
  if (purchaseRoas) return parseFloat(purchaseRoas.value);

  const actions = data.actions ?? [];
  const purchases = actions.find(
    (a) => a.action_type === "omni_purchase" || a.action_type === "purchase"
  );
  if (purchases && data.spend) {
    const purchaseValue = parseFloat(purchases.value);
    const spend = parseFloat(data.spend);
    if (spend > 0) return purchaseValue / spend;
  }

  return 0;
}

export function parseConversions(data: MetaInsightsRaw): number {
  const actions = data.actions ?? [];
  const conversions = actions.find(
    (a) => a.action_type === "omni_purchase" || a.action_type === "purchase"
  );
  return conversions ? parseInt(conversions.value) : 0;
}

export interface MetaCampaignRaw {
  id: string;
  name: string;
  status: string;
  objective: string;
  daily_budget?: string;
  updated_time?: string;
}

export async function fetchCampaignList(
  accountId: string,
  accessToken: string
): Promise<MetaCampaignRaw[]> {
  const url = `${META_API_BASE}/${accountId}/campaigns?fields=id,name,status,objective,daily_budget,updated_time&limit=200&access_token=${accessToken}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.data ?? []) as MetaCampaignRaw[];
}

export function parseConversionsAll(data: MetaInsightsRaw): number {
  const actions = data.actions ?? [];
  const relevant = actions.find(
    (a) =>
      a.action_type === "omni_purchase" ||
      a.action_type === "purchase" ||
      a.action_type === "lead" ||
      a.action_type === "complete_registration" ||
      a.action_type === "onsite_conversion.lead_grouped" ||
      a.action_type === "onsite_conversion.messaging_conversation_started_7d"
  );
  return relevant ? parseInt(relevant.value) : 0;
}

export function parseMessagingConversations(data: MetaInsightsRaw): number {
  const actions = data.actions ?? [];
  const item = actions.find(
    (a) => a.action_type === "onsite_conversion.messaging_conversation_started_7d"
  );
  return item ? parseInt(item.value) : 0;
}

export function parseLeadsForm(data: MetaInsightsRaw): number {
  const actions = data.actions ?? [];
  const item = actions.find(
    (a) => a.action_type === "onsite_conversion.lead_grouped" || a.action_type === "lead"
  );
  return item ? parseInt(item.value) : 0;
}

export function parseThruPlay(data: MetaInsightsRaw): number {
  const actions = data.actions ?? [];
  const item = actions.find((a) => a.action_type === "video_thruplay");
  return item ? parseInt(item.value) : 0;
}

export function parseLandingPageViews(data: MetaInsightsRaw): number {
  const actions = data.actions ?? [];
  const item = actions.find((a) => a.action_type === "landing_page_view");
  return item ? parseInt(item.value) : 0;
}

export function parsePostReactions(data: MetaInsightsRaw): number {
  const actions = data.actions ?? [];
  const item = actions.find((a) => a.action_type === "post_reaction");
  return item ? parseInt(item.value) : 0;
}

export function parsePostComments(data: MetaInsightsRaw): number {
  const actions = data.actions ?? [];
  const item = actions.find((a) => a.action_type === "comment");
  return item ? parseInt(item.value) : 0;
}

export function parsePostShares(data: MetaInsightsRaw): number {
  const actions = data.actions ?? [];
  const item = actions.find((a) => a.action_type === "post");
  return item ? parseInt(item.value) : 0;
}

export function parseFollows(data: MetaInsightsRaw): number {
  const actions = data.actions ?? [];
  const item = actions.find((a) => a.action_type === "follow");
  return item ? parseInt(item.value) : 0;
}

export function parseProfileVisits(data: MetaInsightsRaw): number {
  const actions = data.actions ?? [];
  const item = actions.find((a) => a.action_type === "profile_visit");
  return item ? parseInt(item.value) : 0;
}

export interface MetaCreativeInfo {
  id: string;
  name?: string;
  thumbnail_url?: string;
  image_url?: string;
  video_id?: string;
  body?: string;
  title?: string;
}

export async function fetchAdVideoMetrics(
  metaAdId: string,
  accessToken: string,
  params: { since: string; until: string }
): Promise<MetaInsightsRaw | null> {
  const fields = [
    "spend",
    "video_play_actions",
    "video_p25_watched_actions",
    "video_p50_watched_actions",
    "video_p75_watched_actions",
    "video_p100_watched_actions",
    "video_avg_time_watched_actions",
    "actions",
  ].join(",");

  const searchParams = new URLSearchParams({
    access_token: accessToken,
    fields,
    time_range: JSON.stringify({ since: params.since, until: params.until }),
    time_increment: "all_days",
  });

  try {
    const response = await fetch(`${META_API_BASE}/${metaAdId}/insights?${searchParams.toString()}`);
    if (!response.ok) return null;
    const json: MetaApiResponse = await response.json();
    return json.data[0] ?? null;
  } catch {
    return null;
  }
}

export async function fetchAdCreative(
  metaAdId: string,
  accessToken: string,
  accountId?: string
): Promise<MetaCreativeInfo | null> {
  try {
    const fields = [
      "id",
      "name",
      "thumbnail_url",
      "image_url",
      "image_hash",
      "video_id",
      "body",
      "title",
      "object_story_spec",
    ].join(",");

    const url = `${META_API_BASE}/${metaAdId}/adcreatives?fields=${fields}&access_token=${accessToken}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.error("[fetchAdCreative] adcreatives failed:", await response.text());
      return null;
    }
    const json = await response.json();
    const raw = json.data?.[0];
    console.log("[fetchAdCreative] raw creative:", JSON.stringify(raw));
    if (!raw) return null;

    const creative = raw as MetaCreativeInfo & {
      image_hash?: string;
      object_story_spec?: {
        link_data?: { image_hash?: string; image_url?: string };
        video_data?: { image_hash?: string };
        photo_data?: { images?: Record<string, { url?: string }> };
      };
    };

    // Try to get full-resolution image URL
    let fullImageUrl: string | undefined = creative.image_url;

    // Extract image hash from story spec if not directly available
    const imageHash =
      creative.image_hash ??
      creative.object_story_spec?.link_data?.image_hash ??
      creative.object_story_spec?.video_data?.image_hash;

    console.log("[fetchAdCreative] imageHash:", imageHash, "accountId:", accountId, "existing image_url:", fullImageUrl);

    if (imageHash && accountId) {
      try {
        // Meta adimages API: hashes must be passed as hashes[0]=VALUE
        const hashParams = new URLSearchParams({
          "hashes[0]": imageHash,
          fields: "url,width,height",
          access_token: accessToken,
        });
        const imgRes = await fetch(`${META_API_BASE}/${accountId}/adimages?${hashParams}`);
        const imgJson = await imgRes.json();
        console.log("[fetchAdCreative] adimages response:", JSON.stringify(imgJson));
        if (imgRes.ok) {
          // Response is an object keyed by hash, not an array
          const imgData = imgJson.data
            ? imgJson.data[0]
            : imgJson[imageHash];
          const imgUrl = imgData?.url ?? imgData?.url_128;
          if (imgUrl) fullImageUrl = imgUrl;
        }
      } catch (e) {
        console.error("[fetchAdCreative] adimages error:", e);
      }
    }

    // Fetch high-res thumbnail via creative object (supports thumbnail_width/height params)
    let betterThumbnail: string | undefined = creative.thumbnail_url;
    try {
      const hiResParams = new URLSearchParams({
        fields: "thumbnail_url",
        thumbnail_width: "1080",
        thumbnail_height: "1080",
        access_token: accessToken,
      });
      const hiResRes = await fetch(`${META_API_BASE}/${creative.id}?${hiResParams}`);
      const hiResJson = await hiResRes.json();
      console.log("[fetchAdCreative] hi-res thumbnail response:", JSON.stringify(hiResJson));
      if (hiResRes.ok && hiResJson.thumbnail_url) {
        betterThumbnail = hiResJson.thumbnail_url;
      }
    } catch (e) {
      console.error("[fetchAdCreative] hi-res thumbnail error:", e);
    }

    // For video creatives, also try the video thumbnails endpoint for even better quality
    if (creative.video_id) {
      try {
        const vidRes = await fetch(
          `${META_API_BASE}/${creative.video_id}?fields=thumbnails{uri,width,height}&access_token=${accessToken}`
        );
        const vidJson = await vidRes.json();
        console.log("[fetchAdCreative] video thumbnails:", JSON.stringify(vidJson));
        if (vidRes.ok) {
          const thumbs: Array<{ uri: string; width: number; height: number }> =
            vidJson.thumbnails?.data ?? [];
          if (thumbs.length > 0) {
            const largest = thumbs.reduce((a, b) => (b.width > a.width ? b : a));
            betterThumbnail = largest.uri;
          }
        }
      } catch (e) {
        console.error("[fetchAdCreative] video thumbnails error:", e);
      }
    }

    return {
      id: creative.id,
      name: creative.name,
      thumbnail_url: betterThumbnail,
      image_url: fullImageUrl,
      video_id: creative.video_id,
      body: creative.body,
      title: creative.title,
    };
  } catch {
    return null;
  }
}

export async function refreshLongLivedToken(
  shortLivedToken: string
): Promise<string> {
  const url = new URL(`${META_API_BASE}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", process.env.META_APP_ID!);
  url.searchParams.set("client_secret", process.env.META_APP_SECRET!);
  url.searchParams.set("fb_exchange_token", shortLivedToken);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error("Failed to refresh token");
  }
  const data = await response.json();
  return data.access_token;
}
