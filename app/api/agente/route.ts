import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { PLAN_SYSTEM_PROMPT, MOCK_PLAN } from "@/lib/agent";
import type {
  AgentFormData, AdPlan, AudienceCreative, AudienceCreativeItem,
  MessagingChannels, PlacementSelection, AdPlanTargeting,
} from "@/types";

const USE_MOCK =
  process.env.MOCK_AGENT === "true" ||
  !process.env.ANTHROPIC_API_KEY ||
  process.env.ANTHROPIC_API_KEY.startsWith("sk-ant-...");

const anthropic = USE_MOCK
  ? null
  : new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function describeCreative(c: AudienceCreativeItem, index: number): string {
  const mediaDesc = c.media_type === "video"
    ? "Vídeo único — NÃO inclua video_url/video_thumbnail_url, o sistema preenche"
    : `${c.images.length} imagem(ns) (${c.images.length > 1 ? "carrossel" : "imagem única"}) — NÃO inclua as URLs, o sistema preenche`;

  return `  Criativo ${index + 1}:
  - Tipo de mídia: ${c.media_type} — ${mediaDesc}
  - Título: ${c.headline}
  - Texto principal: ${c.primary_text}
  - Descrição: ${c.description}
  - CTA: ${c.cta}
  - URL de destino: ${c.destination_url}`;
}

function describeAudience(a: AudienceCreative, index: number): string {
  const genders =
    a.genders.includes("all") || a.genders.length === 0
      ? [0]
      : a.genders.map((g) => (g === "male" ? 1 : 2));

  const creativesBlock = a.creatives.map((c, i) => describeCreative(c, i)).join("\n");

  return `### Público ${index + 1}
Descrição (pt-BR): ${a.audience_description}
Localizações: ${a.locations}
Idade: ${a.age_min}–${a.age_max}
Gêneros (raw → códigos Meta): ${a.genders.join(",")} → ${JSON.stringify(genders)}
Criativos (${a.creatives.length}) — retorne EXATAMENTE ${a.creatives.length} item(ns) em "creatives" para este público, na mesma ordem:
${creativesBlock}`;
}

function buildPrompt(formData: AgentFormData): string {
  const budgetCents = Math.round(formData.budget_amount * 100);
  const audiencesBlock = formData.audiences.map(describeAudience).join("\n\n");

  return `Gere o plano de campanha (CBO) para os dados abaixo. Retorne EXATAMENTE ${formData.audiences.length} item(ns) em "adsets", na mesma ordem dos públicos.

Campaign name: ${formData.campaign_name}
Objective: ${formData.objective}
Budget type: ${formData.budget_type} | Amount (centavos, nível da campanha/CBO): ${budgetCents}
Start date: ${formData.start_date}
End date: ${formData.end_date ?? "sem data de fim"}
Facebook Page ID: ${formData.facebook_page_id ?? ""}

## Públicos (${formData.audiences.length}):

${audiencesBlock}

Retorne SOMENTE o JSON do plano.`;
}

// Normaliza datas "YYYY-MM-DDTHH:mm" (datetime-local) → "YYYY-MM-DDTHH:mm:ss+0000"
function toMetaTime(value?: string): string | undefined {
  if (!value) return undefined;
  if (value.includes("+")) return value;
  const withSeconds = value.length === 16 ? `${value}:00` : value;
  return `${withSeconds}+0000`;
}

// Garante que cada criativo receba a mídia real (imagem(ns) ou vídeo+capa) do público/criativo
// correspondente no formulário — o Claude nunca inclui essas URLs (instruído a omitir).
function injectMedia(plan: AdPlan, formData: AgentFormData): AdPlan {
  return {
    ...plan,
    adsets: plan.adsets.map((adset, i) => {
      const audience = formData.audiences[i];
      return {
        ...adset,
        creatives: adset.creatives.map((creative, j) => {
          const source = audience?.creatives[j];
          const pageId = creative.page_id || (formData.facebook_page_id ?? "");
          // Nome é sempre o que o usuário digitou no formulário — nunca o que o Claude
          // sugeriu, pra nunca herdar/repetir o nome do conjunto.
          const name = source?.name || creative.name;

          if (source?.media_type === "video") {
            return {
              ...creative,
              name,
              page_id: pageId,
              media_type: "video" as const,
              image_urls: [],
              video_url: source.video?.url ?? "",
              video_thumbnail_url: source.video_thumbnail?.url ?? "",
            };
          }
          return {
            ...creative,
            name,
            page_id: pageId,
            media_type: "image" as const,
            image_urls: (source?.images ?? []).map((im) => im.url),
          };
        }),
      };
    }),
  };
}

// optimization_goal seguro por objetivo — escolhido para NÃO exigir pixel nem
// formulário de lead (o que quebraria a criação do adset). Estes são valores que a
// Meta aceita para qualquer conta, sem configuração extra. Usado quando o público
// NÃO tem conversão por mensagens habilitada (ver PERFORMANCE_GOALS abaixo).
const OPTIMIZATION_GOAL_BY_OBJECTIVE: Record<string, string> = {
  OUTCOME_TRAFFIC: "LINK_CLICKS",
  OUTCOME_AWARENESS: "REACH",
  // POST_ENGAGEMENT exige boost de post existente (object_story_id), que a API
  // não retorna para criativos inline nesta conta. IMPRESSIONS é válido para
  // OUTCOME_ENGAGEMENT, não exige promoted_object e mantém o objetivo como Engajamento.
  OUTCOME_ENGAGEMENT: "IMPRESSIONS",
  OUTCOME_SALES: "LINK_CLICKS", // sem pixel configurado → otimiza por cliques no link
  OUTCOME_LEADS: "LINK_CLICKS", // fallback caso não seja Click-to-WhatsApp
};

// "Meta de Desempenho" — só aparece pros objetivos Engajamento/Vendas quando o público
// tem "conversão por mensagens" habilitada (checklist Navigare 01/07/2026, item 1.4).
// optimization_goal de cada opção CONFIRMADO via validate_only contra a API real
// (act_277363527797303, 2026-07-01) — exceto "leads por mensagens", que NÃO está aqui:
// testei LEAD_GENERATION, QUALITY_LEAD e MESSAGING_PURCHASE_CONVERSION para
// OUTCOME_ENGAGEMENT e a Meta rejeitou os 3 (error_subcode 2490408, "meta de desempenho
// não disponível para o objetivo da campanha"). Falta descobrir o valor certo antes de
// oferecer essa opção no formulário — ver [[project-navidash]] / conversa com o cliente.
const PERFORMANCE_GOALS: Record<string, Array<{ value: string; label: string; optimization_goal: string }>> = {
  OUTCOME_ENGAGEMENT: [
    { value: "conversations", label: "Maximizar o número de conversas", optimization_goal: "CONVERSATIONS" },
    { value: "link_clicks", label: "Maximizar o número de cliques no link", optimization_goal: "LINK_CLICKS" },
  ],
  OUTCOME_SALES: [
    // "conversions" aqui é a leitura literal do checklist — NÃO consegui confirmar via
    // validate_only se é isso mesmo ou se deveria ser MESSAGING_PURCHASE_CONVERSION
    // (o candidato "nativo" de mensagens, testado mas bloqueado por outra restrição da
    // única campanha Sales disponível na conta — orçamento/pixel compartilhado no CBO).
    // Se a Meta rejeitar na hora de criar, esse é o primeiro valor a trocar.
    { value: "conversions", label: "Maximizar o número de conversões", optimization_goal: "OFFSITE_CONVERSIONS" },
    { value: "conversations", label: "Maximizar o número de conversas", optimization_goal: "CONVERSATIONS" },
    { value: "link_clicks", label: "Maximizar o número de cliques no link", optimization_goal: "LINK_CLICKS" },
  ],
};

// Mapa determinístico: canais marcados (independentes) → destination_type da Meta.
// Confirmado contra o enum oficial (facebook_business/adobjects/adset.py DestinationType,
// SDK Python oficial da Meta) — nunca deixamos o LLM escolher esse valor.
function buildDestinationType(channels: MessagingChannels): string | undefined {
  const { whatsapp: w, messenger: m, instagram: i } = channels;
  if (w && m && i) return "MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP";
  if (w && m) return "MESSAGING_MESSENGER_WHATSAPP";
  if (w && i) return "MESSAGING_INSTAGRAM_DIRECT_WHATSAPP";
  if (m && i) return "MESSAGING_INSTAGRAM_DIRECT_MESSENGER";
  if (w) return "WHATSAPP";
  if (m) return "MESSENGER";
  if (i) return "INSTAGRAM_DIRECT";
  return undefined;
}

// Posicionamento agora é por público (conjunto) — nunca do LLM, sempre determinístico
// a partir do que foi marcado no formulário.
//
// Grafo de co-exigências da Meta CONFIRMADO via validate_only contra a API real
// (act_277363527797303, 2026-07-02) — o usuário não precisa saber de nada disso, o
// formulário só deixa marcar posições reais e este resolvedor completa o resto:
//   - facebook_positions: profile_feed/marketplace/search/instream_video/notification
//     exigem "feed" junto. "story" exige "feed" OU instagram_positions incluir "story".
//   - instagram_positions: "explore_home" exige "explore"; "explore" e "ig_search"
//     exigem "stream" (Feed do Instagram).
//   - messenger_positions: "story" exige facebook "feed" OU instagram "story" (mesma
//     regra do Facebook Stories).
//   - audience_network_positions (qualquer uma) exige facebook_positions incluir "feed".
//   - whatsapp_positions=["status"] exige instagram_positions incluir "story".
//   - Threads exige instagram_positions incluir "stream"; threads_positions NÃO tem
//     valor próprio válido (testei "feed" e "threads_feed", ambos rejeitados) — por
//     isso a plataforma "threads" nunca manda esse campo, só entra em publisher_platforms.
//   - Se uma plataforma for marcada sem nenhuma posição própria (não deveria mais
//     acontecer pela UI, mas fica de defesa), cai no posicionamento principal dela.
function applyPlacement(targeting: AdPlanTargeting, placement?: PlacementSelection): AdPlanTargeting {
  const cleared: AdPlanTargeting = {
    ...targeting,
    publisher_platforms: undefined,
    facebook_positions: undefined,
    instagram_positions: undefined,
    messenger_positions: undefined,
    audience_network_positions: undefined,
    threads_positions: undefined,
    whatsapp_positions: undefined,
  };
  if (!placement || placement.mode !== "manual" || placement.platforms.length === 0) return cleared;

  const platforms = new Set(placement.platforms);
  const fb = new Set(platforms.has("facebook") ? (placement.facebook_positions ?? []) : []);
  const ig = new Set(platforms.has("instagram") ? (placement.instagram_positions ?? []) : []);
  const msg = new Set(platforms.has("messenger") ? (placement.messenger_positions ?? []) : []);
  const an = new Set(platforms.has("audience_network") ? (placement.audience_network_positions ?? []) : []);

  // Defesa: plataforma marcada sem nenhuma posição própria → usa a posição principal dela.
  if (platforms.has("facebook") && fb.size === 0) fb.add("feed");
  if (platforms.has("instagram") && ig.size === 0) ig.add("stream");
  if (platforms.has("messenger") && msg.size === 0) msg.add("messenger_home");
  if (platforms.has("audience_network") && an.size === 0) an.add("classic");

  // Resolve o grafo de dependências até estabilizar (algumas encadeiam, ex.
  // explore_home → explore → stream).
  let changed = true;
  while (changed) {
    changed = false;
    const need = (set: Set<string>, value: string) => {
      if (!set.has(value)) { set.add(value); changed = true; }
    };

    if (fb.has("profile_feed") || fb.has("marketplace") || fb.has("search") || fb.has("instream_video") || fb.has("notification")) {
      need(fb, "feed");
    }
    if ((fb.has("story") || msg.has("story")) && !ig.has("story")) {
      need(fb, "feed");
    }
    if (ig.has("explore_home")) need(ig, "explore");
    if (ig.has("explore") || ig.has("ig_search")) need(ig, "stream");
    if (an.size > 0 && !fb.has("feed")) { if (!platforms.has("facebook")) { platforms.add("facebook"); changed = true; } need(fb, "feed"); }
    if (platforms.has("whatsapp")) { if (!platforms.has("instagram")) { platforms.add("instagram"); changed = true; } need(ig, "story"); }
    if (platforms.has("threads")) { if (!platforms.has("instagram")) { platforms.add("instagram"); changed = true; } need(ig, "stream"); }
  }

  if (fb.size > 0) platforms.add("facebook");
  if (ig.size > 0) platforms.add("instagram");
  if (msg.size > 0) platforms.add("messenger");
  if (an.size > 0) platforms.add("audience_network");

  return {
    ...cleared,
    publisher_platforms: Array.from(platforms),
    facebook_positions: fb.size > 0 ? Array.from(fb) : undefined,
    instagram_positions: ig.size > 0 ? Array.from(ig) : undefined,
    messenger_positions: msg.size > 0 ? Array.from(msg) : undefined,
    audience_network_positions: an.size > 0 ? Array.from(an) : undefined,
    whatsapp_positions: platforms.has("whatsapp") ? ["status"] : undefined,
    // threads_positions fica sempre omitido — ver nota acima
  };
}

// Define a configuração TÉCNICA de cada conjunto (posicionamento, optimization_goal,
// destination_type, CTA) de forma DETERMINÍSTICA — não confiamos nos enums que o modelo
// gera (ele alucina valores como OFFSITE_CONVERSIONS sem pixel, ou LEAD_GENERATION sem
// formulário). Cobre 3 casos, nesta ordem de prioridade por público:
//   1) Leads clássico via Click-to-WhatsApp (comportamento já existente, intocado)
//   2) Engajamento/Vendas com "conversão por mensagens" habilitada (novo, por conjunto)
//   3) Fallback padrão por objetivo (comportamento já existente, intocado)
function applyDeterministicConfig(plan: AdPlan, formData: AgentFormData): AdPlan {
  const objective = formData.objective;
  const pageId = formData.facebook_page_id ?? "";
  const waDigits = (formData.whatsapp_number ?? "").replace(/\D/g, "");
  // Número é sempre opcional — mesmo sem ele, Leads continua sendo Click-to-WhatsApp
  // (é a única forma de "Leads" implementada aqui); sem número, a Meta usa o padrão da página.
  const classicWhatsAppLeads = objective === "OUTCOME_LEADS";
  const waLink = waDigits ? `https://api.whatsapp.com/send?phone=${waDigits}` : "";
  // A Meta EXIGE link_data.link sempre (confirmado via validate_only — rejeita vazio/ausente
  // mesmo em anúncios de engajamento/mensagens). Como a URL de destino não é mais obrigatória
  // no formulário pra esses casos, caímos na própria Página do Facebook quando o usuário não
  // preencheu nada.
  const pageFallbackLink = pageId ? `https://www.facebook.com/${pageId}` : "";
  const ensureLink = (link: string) => link || pageFallbackLink;

  return {
    ...plan,
    campaign: { ...plan.campaign, objective },
    adsets: plan.adsets.map((adset, i) => {
      const audience = formData.audiences[i];
      const targeting = applyPlacement(adset.targeting, audience?.placement);

      if (classicWhatsAppLeads) {
        return {
          ...adset,
          targeting,
          optimization_goal: "CONVERSATIONS",
          billing_event: "IMPRESSIONS",
          destination_type: "WHATSAPP",
          // whatsapp_phone_number é quem realmente decide pra qual número o clique abre —
          // sem ele a Meta ignora o número escolhido e cai no padrão já ligado à página.
          promoted_object: { page_id: pageId, whatsapp_phone_number: waDigits || undefined },
          creatives: adset.creatives.map((cr) => ({
            ...cr,
            call_to_action_type: "WHATSAPP_MESSAGE",
            whatsapp_link: waLink,
            link: ensureLink(cr.link || waLink),
          })),
        };
      }

      const isMessaging =
        (objective === "OUTCOME_ENGAGEMENT" || objective === "OUTCOME_SALES") &&
        !!audience?.messaging_enabled;

      if (isMessaging) {
        const destinationType = buildDestinationType(audience!.messaging_channels) ?? "WHATSAPP";
        const isWhatsAppOnly = destinationType === "WHATSAPP";
        const includesWhatsApp = destinationType.includes("WHATSAPP");
        const goalDef = PERFORMANCE_GOALS[objective]?.find((g) => g.value === audience!.performance_goal);
        const ctaType = isWhatsAppOnly ? "WHATSAPP_MESSAGE" : "MESSAGE_PAGE";

        return {
          ...adset,
          targeting,
          optimization_goal: goalDef?.optimization_goal ?? "CONVERSATIONS",
          billing_event: "IMPRESSIONS",
          destination_type: destinationType,
          promoted_object: {
            page_id: pageId,
            whatsapp_phone_number: includesWhatsApp ? (waDigits || undefined) : undefined,
          },
          creatives: adset.creatives.map((cr) => ({
            ...cr,
            call_to_action_type: ctaType,
            whatsapp_link: isWhatsAppOnly ? waLink : undefined,
            link: isWhatsAppOnly ? ensureLink(cr.link || waLink) : ensureLink(cr.link),
          })),
        };
      }

      return {
        ...adset,
        targeting,
        optimization_goal: OPTIMIZATION_GOAL_BY_OBJECTIVE[objective] ?? "LINK_CLICKS",
        billing_event: "IMPRESSIONS",
        destination_type: undefined,
        promoted_object: undefined,
        creatives: adset.creatives.map((cr) => ({ ...cr, link: ensureLink(cr.link) })),
      };
    }),
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { formData: AgentFormData };
  const { formData } = body;

  if (!formData || !formData.audiences?.length) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
  }

  const hasMedia = formData.audiences.every((a) =>
    a.creatives.length > 0 &&
    a.creatives.every((c) => (c.media_type === "video" ? !!c.video : c.images.length > 0))
  );
  if (!hasMedia) {
    return NextResponse.json({ error: "Cada criativo precisa de ao menos uma imagem (ou um vídeo)" }, { status: 400 });
  }

  const budgetCents = Math.round(formData.budget_amount * 100);
  const startTime = toMetaTime(formData.start_date) ?? `${formData.start_date}:00+0000`;
  const endTime = toMetaTime(formData.end_date);

  // Mock mode — monta o plano a partir do form, sem chamar Claude
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 1200));
    const mockPlan: AdPlan = {
      summary: MOCK_PLAN.summary,
      campaign: {
        name: formData.campaign_name || MOCK_PLAN.campaign.name,
        objective: formData.objective,
        special_ad_categories: [],
        daily_budget: formData.budget_type === "daily" ? budgetCents : undefined,
        lifetime_budget: formData.budget_type === "total" ? budgetCents : undefined,
      },
      adsets: formData.audiences.map((a, i) => ({
        name: `Público ${i + 1} — ${a.audience_description.slice(0, 30)}`,
        start_time: startTime,
        end_time: endTime,
        optimization_goal: "LINK_CLICKS",
        billing_event: "IMPRESSIONS",
        targeting: {
          geo_locations: { countries: ["BR"] },
          age_min: a.age_min,
          age_max: a.age_max,
          genders: a.genders.includes("all") || a.genders.length === 0
            ? [0]
            : a.genders.map((g) => (g === "male" ? 1 : 2)),
          interests: [
            { name: "Interesse sugerido", keyword: "marketing" },
          ],
        },
        creatives: a.creatives.map((c, j) => ({
          name: c.name || `Criativo ${j + 1} — Público ${i + 1}`,
          title: c.headline || MOCK_PLAN.adsets[0].creatives[0].title,
          body: c.primary_text || MOCK_PLAN.adsets[0].creatives[0].body,
          description: c.description || MOCK_PLAN.adsets[0].creatives[0].description,
          call_to_action_type: c.cta,
          link: c.destination_url || MOCK_PLAN.adsets[0].creatives[0].link,
          page_id: formData.facebook_page_id ?? MOCK_PLAN.adsets[0].creatives[0].page_id,
          media_type: c.media_type,
          image_urls: c.images.map((im) => im.url),
        })),
      })),
    };
    return NextResponse.json({ plan: applyDeterministicConfig(mockPlan, formData), mock: true });
  }

  try {
    const userPrompt = buildPrompt(formData);

    const message = await anthropic!.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: PLAN_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const rawContent = message.content[0];
    if (rawContent.type !== "text") {
      return NextResponse.json({ error: "Resposta inesperada do Claude" }, { status: 500 });
    }

    // Extract JSON from response (Claude may wrap in markdown code blocks)
    let jsonStr = rawContent.text.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
    if (jsonMatch) jsonStr = jsonMatch[1];

    let plan = JSON.parse(jsonStr) as AdPlan;

    // Garante orçamento CBO e datas mesmo se o modelo divergir
    plan.campaign.daily_budget = formData.budget_type === "daily" ? budgetCents : undefined;
    plan.campaign.lifetime_budget = formData.budget_type === "total" ? budgetCents : undefined;
    plan.adsets = plan.adsets.map((adset) => ({
      ...adset,
      start_time: toMetaTime(adset.start_time) ?? startTime,
      end_time: toMetaTime(adset.end_time) ?? endTime,
    }));

    plan = injectMedia(plan, formData);
    plan = applyDeterministicConfig(plan, formData);

    return NextResponse.json({ plan, mock: false });
  } catch (err) {
    console.error("[api/agente] Plan generation error:", err);
    return NextResponse.json(
      { error: `Falha ao gerar plano: ${String(err instanceof Error ? err.message : err)}` },
      { status: 500 }
    );
  }
}
