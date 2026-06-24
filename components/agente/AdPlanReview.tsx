"use client";

import { useState } from "react";
import {
  CheckCircle2, Edit2, ExternalLink, Megaphone,
  Image as ImageIcon, LayoutGrid, AlertCircle, ArrowLeft, Send, Tag, Images,
  Copy, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AdPlan, AdPlanAdset } from "@/types";

const CTA_LABELS: Record<string, string> = {
  LEARN_MORE: "Saiba Mais",
  SHOP_NOW: "Comprar Agora",
  SIGN_UP: "Cadastre-se",
  CONTACT_US: "Fale Conosco",
  BOOK_NOW: "Reserve Agora",
  GET_QUOTE: "Solicitar Orçamento",
  WHATSAPP_MESSAGE: "Enviar mensagem (WhatsApp)",
};

const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_TRAFFIC: "Tráfego",
  OUTCOME_LEADS: "Geração de Cadastros",
  OUTCOME_SALES: "Vendas",
  OUTCOME_AWARENESS: "Reconhecimento de Marca",
  OUTCOME_ENGAGEMENT: "Engajamento",
};

function formatBudget(cents: number | null | undefined): string {
  if (!cents) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

// "YYYY-MM-DDTHH:mm:ss+0000" → "YYYY-MM-DDTHH:mm"
function toLocalInput(metaTime?: string): string {
  if (!metaTime) return "";
  return metaTime.slice(0, 16);
}

// "YYYY-MM-DDTHH:mm:ss+0000" → "DD/MM/YYYY HH:mm"
function formatDateTime(metaTime?: string): string {
  if (!metaTime) return "—";
  const [datePart, timePart] = metaTime.slice(0, 16).split("T");
  if (!datePart) return "—";
  const [y, m, d] = datePart.split("-");
  return `${d}/${m}/${y}${timePart ? ` ${timePart}` : ""}`;
}

function genderLabelFor(genders: number[]): string {
  if (!genders.length || genders.includes(0)) return "Todos";
  return genders.map((g) => (g === 1 ? "Masculino" : "Feminino")).join(" + ");
}

// Serializa o plano completo em texto plano para a área de transferência.
function buildPlanText(plan: AdPlan): string {
  const c = plan.campaign;
  const budget = c.daily_budget
    ? `${formatBudget(c.daily_budget)} / dia`
    : `${formatBudget(c.lifetime_budget)} total`;

  const lines: string[] = [];

  lines.push("═══════════════════════════════════════════");
  lines.push(`CAMPANHA: ${c.name}`);
  lines.push("═══════════════════════════════════════════");
  lines.push(`Objetivo: ${OBJECTIVE_LABELS[c.objective] ?? c.objective}`);
  lines.push(`Orçamento (CBO): ${budget}`);
  lines.push(`Categorias especiais: ${c.special_ad_categories.length ? c.special_ad_categories.join(", ") : "Nenhuma"}`);
  lines.push(`Início: ${formatDateTime(plan.adsets[0]?.start_time)}`);
  lines.push(`Fim: ${formatDateTime(plan.adsets[0]?.end_time)}`);
  if (plan.summary) {
    lines.push("");
    lines.push(`Resumo: ${plan.summary}`);
  }

  plan.adsets.forEach((adset, i) => {
    const t = adset.targeting;
    const cr = adset.creative;
    const isCarousel = cr.image_urls.length > 1;

    lines.push("");
    lines.push("───────────────────────────────────────────");
    lines.push(`CONJUNTO ${i + 1}: ${adset.name}`);
    lines.push("───────────────────────────────────────────");
    lines.push(`Meta de otimização: ${adset.optimization_goal}`);
    lines.push(`Evento de cobrança: ${adset.billing_event}`);

    lines.push("");
    lines.push("PÚBLICO:");
    lines.push(`  Localização: ${t.geo_locations.countries?.join(", ") ?? "BR"}${t.geo_locations.cities?.length ? ` — ${t.geo_locations.cities.map((ci) => ci.name).join(", ")}` : ""}`);
    lines.push(`  Faixa etária: ${t.age_min}–${t.age_max} anos`);
    lines.push(`  Gênero: ${genderLabelFor(t.genders)}`);
    const interests = (t.interests ?? []).map((it) => it.name);
    lines.push(`  Interesses: ${interests.length ? interests.join(", ") : "Sem interesses"}`);
    const placements = t.publisher_platforms?.length ? t.publisher_platforms.join(", ") : "Automático (Advantage+)";
    lines.push(`  Posicionamentos: ${placements}`);

    lines.push("");
    lines.push(`ANÚNCIO${isCarousel ? ` (Carrossel · ${cr.image_urls.length} imagens)` : ""}:`);
    lines.push(`  Título: ${cr.title}`);
    lines.push(`  Texto principal: ${cr.body}`);
    lines.push(`  Descrição: ${cr.description}`);
    lines.push(`  Botão (CTA): ${CTA_LABELS[cr.call_to_action_type] ?? cr.call_to_action_type}`);
    lines.push(`  URL de destino: ${cr.link || "—"}`);
    if (adset.destination_type === "WHATSAPP") {
      lines.push(`  Destino do clique: WhatsApp${cr.whatsapp_link ? ` — ${cr.whatsapp_link}` : ""}`);
    }
    lines.push(`  Page ID: ${cr.page_id || "—"}`);
    lines.push(`  ${isCarousel ? "Imagens" : "Imagem"}:`);
    cr.image_urls.forEach((url, idx) => {
      lines.push(`    ${idx + 1}. ${url}`);
    });
  });

  return lines.join("\n");
}

interface EditableFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  multiline?: boolean;
  type?: string;
}

function EditableField({ label, value, onChange, maxLength, multiline, type = "text" }: EditableFieldProps) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="group space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 text-[10px] text-meta-blue hover:text-meta-blue/80"
        >
          <Edit2 className="h-2.5 w-2.5" />
          {editing ? "Fechar" : "Editar"}
        </button>
      </div>

      {editing ? (
        multiline ? (
          <div className="relative">
            <Textarea
              value={value}
              onChange={(e) => onChange(maxLength ? e.target.value.slice(0, maxLength) : e.target.value)}
              rows={3}
              className="text-sm"
              autoFocus
            />
            {maxLength && (
              <span className={cn("absolute right-2 bottom-2 text-[10px] tabular-nums", value.length > maxLength * 0.9 ? "text-warning" : "text-muted-foreground")}>
                {value.length}/{maxLength}
              </span>
            )}
          </div>
        ) : (
          <div className="relative">
            <Input
              type={type}
              value={value}
              onChange={(e) => onChange(maxLength ? e.target.value.slice(0, maxLength) : e.target.value)}
              className="h-8 text-sm"
              autoFocus
            />
            {maxLength && (
              <span className={cn("absolute right-2 top-1/2 -translate-y-1/2 text-[10px] tabular-nums", value.length > maxLength * 0.9 ? "text-warning" : "text-muted-foreground")}>
                {value.length}/{maxLength}
              </span>
            )}
          </div>
        )
      ) : (
        <p className="text-sm text-foreground leading-snug">{value || <span className="text-muted-foreground italic">Não definido</span>}</p>
      )}
    </div>
  );
}

function ReviewSection({ icon, title, badge, children }: { icon: React.ReactNode; title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 bg-muted/30">
        <div className="flex h-5 w-5 items-center justify-center text-muted-foreground">{icon}</div>
        <span className="text-xs font-semibold">{title}</span>
        {badge && <div className="ml-auto">{badge}</div>}
      </div>
      <div className="px-4 py-3 space-y-3">{children}</div>
    </div>
  );
}

interface AdPlanReviewProps {
  plan: AdPlan;
  isMock: boolean;
  onApprove: (editedPlan: AdPlan) => void;
  onBack: () => void;
  disabled?: boolean;
}

export function AdPlanReview({ plan, isMock, onApprove, onBack, disabled }: AdPlanReviewProps) {
  const [edited, setEdited] = useState<AdPlan>(() => JSON.parse(JSON.stringify(plan)));
  const [copied, setCopied] = useState(false);

  const handleCopyPlan = async () => {
    try {
      await navigator.clipboard.writeText(buildPlanText(edited));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponível — ignora silenciosamente
    }
  };

  const setCampaign = (field: keyof AdPlan["campaign"], value: unknown) =>
    setEdited((prev) => ({ ...prev, campaign: { ...prev.campaign, [field]: value } }));

  const setCreative = (i: number, field: keyof AdPlanAdset["creative"], value: unknown) =>
    setEdited((prev) => ({
      ...prev,
      adsets: prev.adsets.map((a, idx) => (idx === i ? { ...a, creative: { ...a.creative, [field]: value } } : a)),
    }));

  const setAdsetName = (i: number, value: string) =>
    setEdited((prev) => ({
      ...prev,
      adsets: prev.adsets.map((a, idx) => (idx === i ? { ...a, name: value } : a)),
    }));

  // Datas são uniformes (vêm da campanha) — editar aplica a todos os adsets
  const setAllDates = (field: "start_time" | "end_time", inputValue: string) => {
    const metaValue = inputValue ? `${inputValue}:00+0000` : undefined;
    setEdited((prev) => ({ ...prev, adsets: prev.adsets.map((a) => ({ ...a, [field]: metaValue })) }));
  };

  const budgetLabel = edited.campaign.daily_budget
    ? `${formatBudget(edited.campaign.daily_budget)} / dia`
    : `${formatBudget(edited.campaign.lifetime_budget)} total`;

  const startInput = toLocalInput(edited.adsets[0]?.start_time);
  const endInput = toLocalInput(edited.adsets[0]?.end_time);
  const missingPageId = edited.adsets.some((a) => !a.creative.page_id);

  return (
    <div className="space-y-4">
      {/* Summary banner */}
      <div className={cn("flex items-start gap-3 rounded-xl border px-4 py-3", isMock ? "border-yellow-500/30 bg-yellow-500/5" : "border-meta-blue/30 bg-meta-blue/5")}>
        <AlertCircle className={cn("h-4 w-4 shrink-0 mt-0.5", isMock ? "text-yellow-500" : "text-meta-blue")} />
        <div>
          {isMock && (
            <p className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 mb-0.5">
              Modo Simulação — nenhum dado real será enviado para a Meta
            </p>
          )}
          <p className="text-sm text-foreground/80">{edited.summary}</p>
        </div>
      </div>

      {/* Campaign (uma vez) */}
      <ReviewSection
        icon={<Megaphone className="h-3.5 w-3.5" />}
        title="Campanha"
        badge={<Badge variant="outline" className="text-[10px]">CBO · {edited.adsets.length} público{edited.adsets.length !== 1 ? "s" : ""}</Badge>}
      >
        <EditableField label="Nome da campanha" value={edited.campaign.name} onChange={(v) => setCampaign("name", v)} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Objetivo</p>
            <Badge variant="outline" className="text-xs">{OBJECTIVE_LABELS[edited.campaign.objective] ?? edited.campaign.objective}</Badge>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Orçamento (campanha)</p>
            <p className="text-sm font-medium">{budgetLabel}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Início</Label>
            <Input type="datetime-local" value={startInput} onChange={(e) => setAllDates("start_time", e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Fim</Label>
            <Input type="datetime-local" value={endInput} onChange={(e) => setAllDates("end_time", e.target.value)} className="h-8 text-sm" />
          </div>
        </div>
      </ReviewSection>

      {/* Públicos + Criativos */}
      <div className="space-y-3">
        {edited.adsets.map((adset, i) => {
          const genderLabel = adset.targeting.genders.includes(0)
            ? "Todos"
            : adset.targeting.genders.map((g) => (g === 1 ? "Masculino" : "Feminino")).join(" + ");
          const isCarousel = adset.creative.image_urls.length > 1;

          return (
            <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 bg-muted/30">
                <div className="flex h-5 w-5 items-center justify-center rounded bg-meta-blue/10 text-meta-blue text-[10px] font-bold">{i + 1}</div>
                <span className="text-xs font-semibold">Público {i + 1}</span>
                <Badge variant="outline" className="text-[10px] gap-1 ml-auto">
                  <Images className="h-2.5 w-2.5" />
                  {isCarousel ? `Carrossel · ${adset.creative.image_urls.length}` : "Imagem única"}
                </Badge>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 p-4">
                {/* Esquerda: público */}
                <div className="xl:col-span-3 space-y-3">
                  <EditableField label="Nome do conjunto" value={adset.name} onChange={(v) => setAdsetName(i, v)} />

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Localização</p>
                      <p className="text-sm">{adset.targeting.geo_locations.countries?.join(", ") ?? "BR"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Faixa etária</p>
                      <p className="text-sm">{adset.targeting.age_min}–{adset.targeting.age_max} anos</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Gênero</p>
                      <p className="text-sm">{genderLabel}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Interesses sugeridos</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(adset.targeting.interests ?? []).map((it, idx) => (
                        <Badge key={idx} variant="secondary" className="gap-1 text-xs">
                          <Tag className="h-2.5 w-2.5" />{it.name}
                        </Badge>
                      ))}
                      {(adset.targeting.interests ?? []).length === 0 && (
                        <span className="text-xs text-muted-foreground italic">Sem interesses</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Direita: criativo */}
                <div className="xl:col-span-2 space-y-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1">
                      <ImageIcon className="h-3 w-3" />
                      {isCarousel ? "Imagens do carrossel" : "Imagem"}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {adset.creative.image_urls.map((url, idx) => (
                        <div key={idx} className="relative rounded-lg overflow-hidden border border-border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={`Imagem ${idx + 1}`} className="w-full h-20 object-cover" />
                          {isCarousel && (
                            <span className="absolute top-1 left-1 rounded bg-black/60 px-1 text-[10px] font-medium text-white">{idx + 1}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <EditableField label="Título" value={adset.creative.title} onChange={(v) => setCreative(i, "title", v)} maxLength={40} />
                  <EditableField label="Texto principal" value={adset.creative.body} onChange={(v) => setCreative(i, "body", v)} maxLength={125} multiline />
                  <EditableField label="Descrição" value={adset.creative.description} onChange={(v) => setCreative(i, "description", v)} maxLength={30} />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Botão (CTA)</p>
                      <Badge variant="outline" className="text-xs">{CTA_LABELS[adset.creative.call_to_action_type] ?? adset.creative.call_to_action_type}</Badge>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Page ID</p>
                      <p className="text-xs font-mono text-muted-foreground">{adset.creative.page_id || "—"}</p>
                    </div>
                  </div>

                  <EditableField label="URL de destino" value={adset.creative.link} onChange={(v) => setCreative(i, "link", v)} type="url" />

                  {adset.destination_type === "WHATSAPP" && (
                    <div className="rounded-md border border-success/30 bg-success/5 px-2.5 py-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-success mb-0.5">Destino do clique</p>
                      <p className="text-xs text-foreground">
                        WhatsApp{adset.creative.whatsapp_link ? ` · +${adset.creative.whatsapp_link.replace(/\D/g, "")}` : ""}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Placements (do primeiro adset, uniforme) */}
      <ReviewSection icon={<LayoutGrid className="h-3.5 w-3.5" />} title="Posicionamentos">
        {edited.adsets[0]?.targeting.publisher_platforms ? (
          <div className="flex flex-wrap gap-1.5">
            {edited.adsets[0].targeting.publisher_platforms!.map((p) => (
              <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <p className="text-sm">Automático (Advantage+) — Meta otimiza os posicionamentos</p>
          </div>
        )}
      </ReviewSection>

      {/* Warning page_id */}
      {missingPageId && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-3 py-2">
          <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0" />
          <p className="text-xs text-yellow-600 dark:text-yellow-400">
            <strong>Page ID não informado.</strong> O criativo precisa de um Facebook Page ID. Volte ao formulário e preencha o campo &quot;ID da Página do Facebook&quot;.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <Button variant="outline" onClick={onBack} disabled={disabled} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao formulário
        </Button>
        <div className="flex-1" />
        <Button
          variant="outline"
          onClick={handleCopyPlan}
          className={cn("gap-1.5", copied && "border-success/40 text-success")}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copiado!" : "Copiar dados"}
        </Button>
        <Button variant="meta" onClick={() => onApprove(edited)} disabled={disabled} className="gap-2 px-6 shadow-md shadow-meta-blue/20">
          <Send className="h-4 w-4" />
          {isMock ? "Simular criação" : "Aprovar e Criar Anúncio"}
          <ExternalLink className="h-3.5 w-3.5 opacity-70" />
        </Button>
      </div>
    </div>
  );
}
