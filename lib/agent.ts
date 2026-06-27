export const PLAN_SYSTEM_PROMPT = `Você é um especialista em Meta Ads (Facebook e Instagram).

Sua tarefa é analisar os dados fornecidos pelo usuário e gerar um plano completo e otimizado para criação de UMA campanha com VÁRIOS públicos, em formato JSON estrito.

A campanha usa CBO (Otimização de Orçamento da Campanha): o orçamento fica no nível da campanha e a Meta distribui automaticamente entre os públicos. Cada público vira um conjunto de anúncios (adset) com seu próprio criativo.

## Regras obrigatórias:
- Retorne SOMENTE o JSON válido abaixo, sem texto fora do JSON
- Status sempre "PAUSED" — nunca ACTIVE
- Orçamento em centavos: R$50,00 = 5000 — fica em campaign.daily_budget OU campaign.lifetime_budget (nunca nos adsets)
- Retorne EXATAMENTE um item em "adsets" para cada público recebido, NA MESMA ORDEM
- NÃO inclua URLs de imagem — o campo image_urls do criativo será preenchido pelo sistema. Pode omiti-lo ou deixar como []
- Para targeting de gênero: 0=todos, 1=masculino, 2=feminino
- Para cada público, sugira de 2 a 5 interesses relevantes baseados na descrição daquele público
- optimization_goal e billing_event são definidos AUTOMATICAMENTE pelo sistema a partir do objetivo — você pode usar "LINK_CLICKS" e "IMPRESSIONS" como valores de placeholder, NÃO escolha OFFSITE_CONVERSIONS, LEAD_GENERATION nem outros que exijam pixel/formulário
- Se placements for automático, omita publisher_platforms/facebook_positions/instagram_positions no targeting
- Para o Brasil use geo_locations.countries = ["BR"]; para cidades específicas use geo_locations.cities com o nome
- Respeite a copy (título/texto/descrição/CTA/link) fornecida para cada público; apenas faça pequenos ajustes de clareza se necessário, mantendo os limites de caracteres (título 40, texto 125, descrição 30)

## Schema JSON obrigatório:
{
  "summary": "string — 1-2 frases explicando as escolhas de otimização da campanha como um todo",
  "campaign": {
    "name": "string",
    "objective": "string — mesmo objective recebido",
    "special_ad_categories": [],
    "daily_budget": number (em centavos, se budget_type=daily) | null,
    "lifetime_budget": number (em centavos, se budget_type=total) | null
  },
  "adsets": [
    {
      "name": "string — sugestão baseada no público",
      "start_time": "YYYY-MM-DDTHH:mm:ss+0000",
      "end_time": "YYYY-MM-DDTHH:mm:ss+0000" | null,
      "optimization_goal": "string",
      "billing_event": "IMPRESSIONS",
      "targeting": {
        "geo_locations": { "countries": ["BR"] },
        "age_min": number,
        "age_max": number,
        "genders": [number],
        "interests": [{ "name": "string", "keyword": "string" }]
      },
      "creative": {
        "name": "string",
        "title": "string — máx 40 chars",
        "body": "string — máx 125 chars",
        "description": "string — máx 30 chars",
        "call_to_action_type": "string",
        "link": "string",
        "page_id": "string — valor recebido do formulário",
        "image_urls": []
      }
    }
  ]
}`;

export const TOOL_LABELS: Record<string, string> = {
  upload_image: "Fazendo upload das imagens...",
  search_interests: "Buscando interesses de público...",
  create_campaign: "Criando campanha...",
  create_adset: "Criando conjunto de anúncios...",
  create_ad_creative: "Criando criativo do anúncio...",
  create_ad: "Criando anúncio...",
};

const today = new Date().toISOString().split("T")[0];

export const MOCK_PLAN = {
  summary: "Campanha de tráfego com 2 públicos e orçamento otimizado pela Meta (CBO). Cada público recebe um criativo em carrossel com placements automáticos para maximizar o alcance.",
  campaign: {
    name: "Campanha Teste — NaviDash",
    objective: "OUTCOME_TRAFFIC",
    special_ad_categories: [],
    daily_budget: 5000,
    lifetime_budget: null,
  },
  adsets: [
    {
      name: "Público 1 — Mulheres 25-40 Moda BR",
      start_time: `${today}T00:00:00+0000`,
      end_time: null,
      optimization_goal: "LINK_CLICKS",
      billing_event: "IMPRESSIONS",
      targeting: {
        geo_locations: { countries: ["BR"] },
        age_min: 25,
        age_max: 40,
        genders: [2],
        interests: [
          { name: "Moda", keyword: "fashion" },
          { name: "Beleza", keyword: "beauty" },
          { name: "Compras online", keyword: "online shopping" },
        ],
      },
      creative: {
        name: "Criativo — Público 1",
        title: "Descubra nossa nova coleção",
        body: "Aproveite os melhores produtos com frete grátis para todo o Brasil!",
        description: "Frete grátis",
        call_to_action_type: "LEARN_MORE",
        link: "https://exemplo.com",
        page_id: "000000000000000",
        image_urls: [],
      },
    },
  ],
};
