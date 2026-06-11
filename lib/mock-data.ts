import type {
  BusinessManager,
  AdAccount,
  DailyInsight,
  Campaign,
  BreakdownItem,
} from "@/types";

export const MOCK_BUSINESS_MANAGERS: BusinessManager[] = [
  {
    id: "bm-001",
    name: "Conta Principal",
    meta_bm_id: "112233445566",
    created_at: "2024-01-15T00:00:00Z",
  },
  {
    id: "bm-002",
    name: "Conta Saúde",
    meta_bm_id: "998877665544",
    created_at: "2024-03-20T00:00:00Z",
  },
];

const TOKEN_PRINCIPAL =
  process.env.META_TOKEN_CONTA_PRINCIPAL ?? "mock_token_1";
const TOKEN_SAUDE =
  process.env.META_TOKEN_CONTA_SAUDE ?? "mock_token_2";

export const MOCK_AD_ACCOUNTS: AdAccount[] = [
  {
    id: "acc-001",
    bm_id: "bm-001",
    name: "Alpha — Conta Principal",
    meta_account_id: "act_111111111",
    access_token: TOKEN_PRINCIPAL,
    token_expires_at: "2026-08-15T00:00:00Z",
    currency: "BRL",
    active: true,
    created_at: "2024-01-15T00:00:00Z",
  },
  {
    id: "acc-002",
    bm_id: "bm-001",
    name: "Alpha — Conta Principal (2)",
    meta_account_id: "act_222222222",
    access_token: TOKEN_PRINCIPAL,
    token_expires_at: "2026-08-15T00:00:00Z",
    currency: "BRL",
    active: true,
    created_at: "2024-02-10T00:00:00Z",
  },
  {
    id: "acc-003",
    bm_id: "bm-002",
    name: "Saúde — Conta Principal",
    meta_account_id: "act_333333333",
    access_token: TOKEN_SAUDE,
    token_expires_at: "2026-09-01T00:00:00Z",
    currency: "BRL",
    active: true,
    created_at: "2024-03-20T00:00:00Z",
  },
  {
    id: "acc-004",
    bm_id: "bm-002",
    name: "Saúde — Conta Secundária",
    meta_account_id: "act_444444444",
    access_token: TOKEN_SAUDE,
    token_expires_at: "2026-09-01T00:00:00Z",
    currency: "BRL",
    active: true,
    created_at: "2024-04-05T00:00:00Z",
  },
];

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generatePlatformBreakdown(
  totalSpend: number,
  totalImpressions: number,
  totalClicks: number,
  seed: number
): BreakdownItem[] {
  const platforms = [
    { segment: "Facebook Feed", ratio: 0.45 },
    { segment: "Instagram Feed", ratio: 0.25 },
    { segment: "Instagram Stories", ratio: 0.15 },
    { segment: "Reels", ratio: 0.10 },
    { segment: "Marketplace", ratio: 0.05 },
  ];

  return platforms.map(({ segment, ratio }, i) => {
    const noise = 0.85 + seededRandom(seed + i) * 0.3;
    const adjRatio = ratio * noise;
    const spend = totalSpend * adjRatio;
    const impressions = Math.round(totalImpressions * adjRatio);
    const clicks = Math.round(totalClicks * adjRatio);
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
    const roas = spend > 0 ? (spend * (2 + seededRandom(seed + i + 10))) / spend : 0;
    return { segment, impressions, clicks, spend, ctr, cpm, roas };
  });
}

function generateDeviceBreakdown(
  totalSpend: number,
  totalImpressions: number,
  totalClicks: number,
  seed: number
): BreakdownItem[] {
  const devices = [
    { segment: "Mobile", ratio: 0.72 },
    { segment: "Desktop", ratio: 0.22 },
    { segment: "Tablet", ratio: 0.06 },
  ];

  return devices.map(({ segment, ratio }, i) => {
    const noise = 0.9 + seededRandom(seed + i + 20) * 0.2;
    const adjRatio = ratio * noise;
    const spend = totalSpend * adjRatio;
    const impressions = Math.round(totalImpressions * adjRatio);
    const clicks = Math.round(totalClicks * adjRatio);
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
    const roas = spend > 0 ? 1.5 + seededRandom(seed + i + 30) * 3 : 0;
    return { segment, impressions, clicks, spend, ctr, cpm, roas };
  });
}

function generateAgeGenderBreakdown(
  totalSpend: number,
  totalImpressions: number,
  totalClicks: number,
  seed: number
): BreakdownItem[] {
  const segments = [
    { segment: "18-24 • Feminino", ratio: 0.12 },
    { segment: "18-24 • Masculino", ratio: 0.10 },
    { segment: "25-34 • Feminino", ratio: 0.22 },
    { segment: "25-34 • Masculino", ratio: 0.18 },
    { segment: "35-44 • Feminino", ratio: 0.16 },
    { segment: "35-44 • Masculino", ratio: 0.12 },
    { segment: "45-54 • Feminino", ratio: 0.06 },
    { segment: "45-54 • Masculino", ratio: 0.04 },
  ];

  return segments.map(({ segment, ratio }, i) => {
    const noise = 0.8 + seededRandom(seed + i + 40) * 0.4;
    const adjRatio = ratio * noise;
    const spend = totalSpend * adjRatio;
    const impressions = Math.round(totalImpressions * adjRatio);
    const clicks = Math.round(totalClicks * adjRatio);
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
    const roas = spend > 0 ? 1.2 + seededRandom(seed + i + 50) * 4 : 0;
    return { segment, impressions, clicks, spend, ctr, cpm, roas };
  });
}

export function generateMockInsights(
  accountId: string,
  startDate: string,
  endDate: string
): DailyInsight[] {
  const insights: DailyInsight[] = [];

  const accountMultipliers: Record<string, number> = {
    "acc-001": 1.4,
    "acc-002": 0.9,
    "acc-003": 1.1,
    "acc-004": 0.7,
  };
  const multiplier = accountMultipliers[accountId] ?? 1.0;

  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");

  let cursor = new Date(start);
  let dayIndex = 0;

  while (cursor <= end) {
    const dateStr = cursor.toISOString().split("T")[0];
    const seed = parseInt(accountId.replace(/\D/g, "")) * 1000 + dayIndex;
    const dayOfWeek = cursor.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const weekendFactor = isWeekend ? 0.75 : 1.0;

    const baseSpend = (200 + seededRandom(seed) * 300) * multiplier * weekendFactor;
    const spend = Math.round(baseSpend * 100) / 100;

    const baseCpm = 18 + seededRandom(seed + 1) * 12;
    const impressions = Math.round((spend / baseCpm) * 1000);
    const ctr = 1.8 + seededRandom(seed + 2) * 2.5;
    const clicks = Math.round((impressions * ctr) / 100);
    const cpc = clicks > 0 ? spend / clicks : 0;
    const reach = Math.round(impressions * (0.7 + seededRandom(seed + 3) * 0.2));
    const frequency = impressions > 0 ? impressions / reach : 1;
    const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
    const conversions = Math.round(clicks * (0.03 + seededRandom(seed + 4) * 0.05));
    const roas = spend > 0 ? (spend * (1.8 + seededRandom(seed + 5) * 3)) / spend : 0;

    insights.push({
      id: `insight-${accountId}-${dateStr}`,
      account_id: accountId,
      date: dateStr,
      impressions,
      clicks,
      spend,
      reach,
      frequency: Math.round(frequency * 100) / 100,
      cpm: Math.round(cpm * 100) / 100,
      cpc: Math.round(cpc * 100) / 100,
      ctr: Math.round(ctr * 100) / 100,
      conversions,
      roas: Math.round(roas * 100) / 100,
      breakdown_platform: generatePlatformBreakdown(spend, impressions, clicks, seed),
      breakdown_device: generateDeviceBreakdown(spend, impressions, clicks, seed),
      breakdown_age_gender: generateAgeGenderBreakdown(spend, impressions, clicks, seed),
      synced_at: new Date().toISOString(),
    });

    cursor.setDate(cursor.getDate() + 1);
    dayIndex++;
  }

  return insights;
}

export const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: "camp-001",
    account_id: "acc-001",
    name: "Vendas — Black Friday 2024",
    status: "ACTIVE",
    objective: "CONVERSIONS",
    spend: 4850.0,
    impressions: 245000,
    clicks: 6200,
    ctr: 2.53,
    cpm: 19.8,
    roas: 3.8,
    adsets: [
      {
        id: "adset-001",
        campaign_id: "camp-001",
        name: "Público Quente — Compradores",
        spend: 2100.0,
        impressions: 98000,
        clicks: 2800,
        ctr: 2.86,
        cpm: 21.4,
        roas: 4.2,
        ads: [
          {
            id: "ad-001",
            adset_id: "adset-001",
            name: "Vídeo 15s — Produto Destaque",
            spend: 1200.0,
            impressions: 58000,
            clicks: 1700,
            ctr: 2.93,
            cpm: 20.7,
            roas: 4.5,
          },
          {
            id: "ad-002",
            adset_id: "adset-001",
            name: "Carrossel — Top 5 Produtos",
            spend: 900.0,
            impressions: 40000,
            clicks: 1100,
            ctr: 2.75,
            cpm: 22.5,
            roas: 3.9,
          },
        ],
      },
      {
        id: "adset-002",
        campaign_id: "camp-001",
        name: "Lookalike 2% — Clientes",
        spend: 1650.0,
        impressions: 82000,
        clicks: 2000,
        ctr: 2.44,
        cpm: 20.1,
        roas: 3.6,
        ads: [
          {
            id: "ad-003",
            adset_id: "adset-002",
            name: "Imagem Estática — Oferta Especial",
            spend: 850.0,
            impressions: 42000,
            clicks: 980,
            ctr: 2.33,
            cpm: 20.2,
            roas: 3.4,
          },
          {
            id: "ad-004",
            adset_id: "adset-002",
            name: "Vídeo 30s — Brand Story",
            spend: 800.0,
            impressions: 40000,
            clicks: 1020,
            ctr: 2.55,
            cpm: 20.0,
            roas: 3.8,
          },
        ],
      },
      {
        id: "adset-003",
        campaign_id: "camp-001",
        name: "Interesses — Moda & Lifestyle",
        spend: 1100.0,
        impressions: 65000,
        clicks: 1400,
        ctr: 2.15,
        cpm: 16.9,
        roas: 3.2,
        ads: [
          {
            id: "ad-005",
            adset_id: "adset-003",
            name: "Coleção Outono — Carrossel",
            spend: 1100.0,
            impressions: 65000,
            clicks: 1400,
            ctr: 2.15,
            cpm: 16.9,
            roas: 3.2,
          },
        ],
      },
    ],
  },
  {
    id: "camp-002",
    account_id: "acc-001",
    name: "Remarketing — Abandono de Carrinho",
    status: "ACTIVE",
    objective: "CONVERSIONS",
    spend: 1920.0,
    impressions: 88000,
    clicks: 3100,
    ctr: 3.52,
    cpm: 21.8,
    roas: 5.1,
    adsets: [
      {
        id: "adset-004",
        campaign_id: "camp-002",
        name: "Visitantes 7 dias",
        spend: 1200.0,
        impressions: 54000,
        clicks: 1980,
        ctr: 3.67,
        cpm: 22.2,
        roas: 5.4,
        ads: [
          {
            id: "ad-006",
            adset_id: "adset-004",
            name: "Dinâmico — Produto no Carrinho",
            spend: 700.0,
            impressions: 32000,
            clicks: 1200,
            ctr: 3.75,
            cpm: 21.9,
            roas: 5.8,
          },
          {
            id: "ad-007",
            adset_id: "adset-004",
            name: "Dinâmico — Produtos Vistos",
            spend: 500.0,
            impressions: 22000,
            clicks: 780,
            ctr: 3.55,
            cpm: 22.7,
            roas: 4.9,
          },
        ],
      },
      {
        id: "adset-005",
        campaign_id: "camp-002",
        name: "Visitantes 30 dias",
        spend: 720.0,
        impressions: 34000,
        clicks: 1120,
        ctr: 3.29,
        cpm: 21.2,
        roas: 4.6,
        ads: [
          {
            id: "ad-008",
            adset_id: "adset-005",
            name: "Oferta com Desconto — 10%",
            spend: 720.0,
            impressions: 34000,
            clicks: 1120,
            ctr: 3.29,
            cpm: 21.2,
            roas: 4.6,
          },
        ],
      },
    ],
  },
  {
    id: "camp-003",
    account_id: "acc-001",
    name: "Awareness — Lançamento Verão",
    status: "PAUSED",
    objective: "BRAND_AWARENESS",
    spend: 3200.0,
    impressions: 420000,
    clicks: 4800,
    ctr: 1.14,
    cpm: 7.6,
    roas: 1.8,
    adsets: [
      {
        id: "adset-006",
        campaign_id: "camp-003",
        name: "Amplo — 18-45 anos",
        spend: 3200.0,
        impressions: 420000,
        clicks: 4800,
        ctr: 1.14,
        cpm: 7.6,
        roas: 1.8,
        ads: [
          {
            id: "ad-009",
            adset_id: "adset-006",
            name: "Vídeo Institucional 60s",
            spend: 2000.0,
            impressions: 280000,
            clicks: 2900,
            ctr: 1.04,
            cpm: 7.1,
            roas: 1.6,
          },
          {
            id: "ad-010",
            adset_id: "adset-006",
            name: "Imagem Conceitual — Verão",
            spend: 1200.0,
            impressions: 140000,
            clicks: 1900,
            ctr: 1.36,
            cpm: 8.6,
            roas: 2.1,
          },
        ],
      },
    ],
  },
  {
    id: "camp-004",
    account_id: "acc-002",
    name: "Instalações de App — iOS",
    status: "ACTIVE",
    objective: "APP_INSTALLS",
    spend: 2650.0,
    impressions: 180000,
    clicks: 5400,
    ctr: 3.0,
    cpm: 14.7,
    roas: 2.9,
    adsets: [
      {
        id: "adset-007",
        campaign_id: "camp-004",
        name: "iOS — 25-44 anos",
        spend: 1800.0,
        impressions: 120000,
        clicks: 3700,
        ctr: 3.08,
        cpm: 15.0,
        roas: 3.1,
        ads: [
          {
            id: "ad-011",
            adset_id: "adset-007",
            name: "App Store — Preview Vídeo",
            spend: 1000.0,
            impressions: 68000,
            clicks: 2100,
            ctr: 3.09,
            cpm: 14.7,
            roas: 3.2,
          },
          {
            id: "ad-012",
            adset_id: "adset-007",
            name: "Screenshots — Funcionalidades",
            spend: 800.0,
            impressions: 52000,
            clicks: 1600,
            ctr: 3.08,
            cpm: 15.4,
            roas: 2.9,
          },
        ],
      },
      {
        id: "adset-008",
        campaign_id: "camp-004",
        name: "iOS — Lookalike Usuários",
        spend: 850.0,
        impressions: 60000,
        clicks: 1700,
        ctr: 2.83,
        cpm: 14.2,
        roas: 2.6,
        ads: [
          {
            id: "ad-013",
            adset_id: "adset-008",
            name: "Depoimento — Usuário Real",
            spend: 850.0,
            impressions: 60000,
            clicks: 1700,
            ctr: 2.83,
            cpm: 14.2,
            roas: 2.6,
          },
        ],
      },
    ],
  },
  {
    id: "camp-005",
    account_id: "acc-003",
    name: "Promoção — Frete Grátis",
    status: "ACTIVE",
    objective: "CONVERSIONS",
    spend: 3100.0,
    impressions: 162000,
    clicks: 4900,
    ctr: 3.02,
    cpm: 19.1,
    roas: 4.2,
    adsets: [
      {
        id: "adset-009",
        campaign_id: "camp-005",
        name: "Público Quente",
        spend: 1900.0,
        impressions: 95000,
        clicks: 3100,
        ctr: 3.26,
        cpm: 20.0,
        roas: 4.5,
        ads: [
          {
            id: "ad-014",
            adset_id: "adset-009",
            name: "Banner Frete Grátis",
            spend: 1000.0,
            impressions: 48000,
            clicks: 1600,
            ctr: 3.33,
            cpm: 20.8,
            roas: 4.8,
          },
          {
            id: "ad-015",
            adset_id: "adset-009",
            name: "Carrossel Produtos em Promoção",
            spend: 900.0,
            impressions: 47000,
            clicks: 1500,
            ctr: 3.19,
            cpm: 19.1,
            roas: 4.2,
          },
        ],
      },
      {
        id: "adset-010",
        campaign_id: "camp-005",
        name: "Novos Públicos",
        spend: 1200.0,
        impressions: 67000,
        clicks: 1800,
        ctr: 2.69,
        cpm: 17.9,
        roas: 3.8,
        ads: [
          {
            id: "ad-016",
            adset_id: "adset-010",
            name: "Vídeo Unboxing",
            spend: 1200.0,
            impressions: 67000,
            clicks: 1800,
            ctr: 2.69,
            cpm: 17.9,
            roas: 3.8,
          },
        ],
      },
    ],
  },
  {
    id: "camp-006",
    account_id: "acc-004",
    name: "Geração de Leads — B2B",
    status: "ACTIVE",
    objective: "LEAD_GENERATION",
    spend: 1850.0,
    impressions: 72000,
    clicks: 1440,
    ctr: 2.0,
    cpm: 25.7,
    roas: 2.1,
    adsets: [
      {
        id: "adset-011",
        campaign_id: "camp-006",
        name: "Decisores — C-Level",
        spend: 1100.0,
        impressions: 42000,
        clicks: 880,
        ctr: 2.10,
        cpm: 26.2,
        roas: 2.3,
        ads: [
          {
            id: "ad-017",
            adset_id: "adset-011",
            name: "E-book Gratuito — ROI",
            spend: 600.0,
            impressions: 22000,
            clicks: 480,
            ctr: 2.18,
            cpm: 27.3,
            roas: 2.5,
          },
          {
            id: "ad-018",
            adset_id: "adset-011",
            name: "Webinar Exclusivo",
            spend: 500.0,
            impressions: 20000,
            clicks: 400,
            ctr: 2.0,
            cpm: 25.0,
            roas: 2.1,
          },
        ],
      },
      {
        id: "adset-012",
        campaign_id: "camp-006",
        name: "Gerentes e Diretores",
        spend: 750.0,
        impressions: 30000,
        clicks: 560,
        ctr: 1.87,
        cpm: 25.0,
        roas: 1.9,
        ads: [
          {
            id: "ad-019",
            adset_id: "adset-012",
            name: "Case de Sucesso — Cliente",
            spend: 750.0,
            impressions: 30000,
            clicks: 560,
            ctr: 1.87,
            cpm: 25.0,
            roas: 1.9,
          },
        ],
      },
    ],
  },
];
