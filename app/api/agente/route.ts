import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { PLAN_SYSTEM_PROMPT, MOCK_PLAN } from "@/lib/agent";
import type { AgentFormData, AdPlan, AudienceCreative } from "@/types";

const USE_MOCK =
  process.env.MOCK_AGENT === "true" ||
  !process.env.ANTHROPIC_API_KEY ||
  process.env.ANTHROPIC_API_KEY.startsWith("sk-ant-...");

const anthropic = USE_MOCK
  ? null
  : new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function describeAudience(a: AudienceCreative, index: number): string {
  const genders =
    a.genders.includes("all") || a.genders.length === 0
      ? [0]
      : a.genders.map((g) => (g === "male" ? 1 : 2));

  return `### Público ${index + 1}
Descrição (pt-BR): ${a.audience_description}
Localizações: ${a.locations}
Idade: ${a.age_min}–${a.age_max}
Gêneros (raw → códigos Meta): ${a.genders.join(",")} → ${JSON.stringify(genders)}
Imagens: ${a.images.length} (${a.images.length > 1 ? "carrossel" : "imagem única"}) — NÃO inclua as URLs, o sistema preenche
Copy do criativo:
- Título: ${a.headline}
- Texto principal: ${a.primary_text}
- Descrição: ${a.description}
- CTA: ${a.cta}
- URL de destino: ${a.destination_url}`;
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
Placements: ${formData.placements}${formData.placements === "manual" ? ` — ${(formData.manual_placements ?? []).join(", ")}` : ""}

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

// Garante que cada adset receba as URLs reais das imagens do público correspondente
function injectImages(plan: AdPlan, formData: AgentFormData): AdPlan {
  return {
    ...plan,
    adsets: plan.adsets.map((adset, i) => ({
      ...adset,
      creative: {
        ...adset.creative,
        page_id: adset.creative.page_id || (formData.facebook_page_id ?? ""),
        image_urls: (formData.audiences[i]?.images ?? []).map((im) => im.url),
      },
    })),
  };
}

// Objetivo Leads via Click-to-WhatsApp: a Meta exige destination_type + promoted_object
// (página) + otimização por CONVERSAS, e o criativo precisa do CTA WHATSAPP_MESSAGE.
// Sobrescreve o que o modelo gerou para garantir uma configuração válida.
function applyWhatsApp(plan: AdPlan, formData: AgentFormData): AdPlan {
  if (formData.objective !== "OUTCOME_LEADS" || !formData.whatsapp_number) return plan;
  const digits = formData.whatsapp_number.replace(/\D/g, "");
  if (!digits) return plan;
  const waLink = `https://api.whatsapp.com/send?phone=${digits}`;
  const pageId = formData.facebook_page_id ?? "";
  return {
    ...plan,
    adsets: plan.adsets.map((adset) => ({
      ...adset,
      optimization_goal: "CONVERSATIONS",
      billing_event: "IMPRESSIONS",
      destination_type: "WHATSAPP",
      promoted_object: { page_id: pageId },
      creative: {
        ...adset.creative,
        call_to_action_type: "WHATSAPP_MESSAGE",
        whatsapp_link: waLink,
        link: adset.creative.link || waLink,
      },
    })),
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { formData: AgentFormData };
  const { formData } = body;

  if (!formData || !formData.audiences?.length) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
  }

  const hasImages = formData.audiences.every((a) => a.images.length > 0);
  if (!hasImages) {
    return NextResponse.json({ error: "Cada público precisa de ao menos uma imagem" }, { status: 400 });
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
        creative: {
          name: `Criativo — Público ${i + 1}`,
          title: a.headline || MOCK_PLAN.adsets[0].creative.title,
          body: a.primary_text || MOCK_PLAN.adsets[0].creative.body,
          description: a.description || MOCK_PLAN.adsets[0].creative.description,
          call_to_action_type: a.cta,
          link: a.destination_url || MOCK_PLAN.adsets[0].creative.link,
          page_id: formData.facebook_page_id ?? MOCK_PLAN.adsets[0].creative.page_id,
          image_urls: a.images.map((im) => im.url),
        },
      })),
    };
    return NextResponse.json({ plan: applyWhatsApp(mockPlan, formData), mock: true });
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

    plan = injectImages(plan, formData);
    plan = applyWhatsApp(plan, formData);

    return NextResponse.json({ plan, mock: false });
  } catch (err) {
    console.error("[api/agente] Plan generation error:", err);
    return NextResponse.json(
      { error: `Falha ao gerar plano: ${String(err instanceof Error ? err.message : err)}` },
      { status: 500 }
    );
  }
}
