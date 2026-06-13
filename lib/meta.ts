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
}

export async function fetchCampaignList(
  accountId: string,
  accessToken: string
): Promise<MetaCampaignRaw[]> {
  const url = `${META_API_BASE}/${accountId}/campaigns?fields=id,name,status,objective,daily_budget&limit=200&access_token=${accessToken}`;
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
