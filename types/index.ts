export interface BusinessManager {
  id: string;
  name: string;
  meta_bm_id: string;
  created_at: string;
}

export interface AdAccount {
  id: string;
  bm_id: string;
  name: string;
  meta_account_id: string;
  access_token: string;
  token_expires_at: string;
  currency: string;
  active: boolean;
  created_at: string;
}

export interface DailyInsight {
  id: string;
  account_id: string;
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  reach: number;
  frequency: number;
  cpm: number;
  cpc: number;
  ctr: number;
  conversions: number;
  roas: number;
  breakdown_platform: BreakdownItem[];
  breakdown_device: BreakdownItem[];
  breakdown_age_gender: BreakdownItem[];
  raw_json?: unknown;
  synced_at?: string;
}

export interface BreakdownItem {
  segment: string;
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number;
  cpm: number;
  roas: number;
}

export interface Campaign {
  id: string;
  account_id: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  objective: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  roas: number;
  adsets?: AdSet[];
}

export interface AdSet {
  id: string;
  campaign_id: string;
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  roas: number;
  ads?: Ad[];
}

export interface Ad {
  id: string;
  adset_id: string;
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  roas: number;
}

export interface InsightResponse {
  insights: DailyInsight[];
  previousInsights: DailyInsight[];
  campaigns: Campaign[];
}

export interface AccountsResponse {
  businessManagers: BusinessManager[];
  adAccounts: AdAccount[];
}

export interface KpiSummary {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  roas: number;
  reach: number;
  conversions: number;
}

export interface DateRange {
  from: Date;
  to: Date;
}

export type MetricKey = "spend" | "impressions" | "clicks" | "ctr" | "cpm" | "roas";

export type BreakdownType = "platform" | "device" | "age_gender";

export interface ChartDataPoint {
  date: string;
  [accountId: string]: number | string;
}

export interface FilterState {
  selectedBmId: string;
  selectedAccountIds: string[];
  dateRange: DateRange;
}
