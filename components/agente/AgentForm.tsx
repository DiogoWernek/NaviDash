"use client";

import { useState, useEffect } from "react";
import {
  Building2, Megaphone, Users,
  ChevronDown, ChevronUp, Send, AlertCircle, Upload, Wand2, X as XIcon,
  Plus, Trash2, Images, Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ImageUpload } from "./ImageUpload";
import { VideoUpload } from "./VideoUpload";
import { ImageGenerator } from "./ImageGenerator";
import { FacebookPageSelect } from "./FacebookPageSelect";
import { cn } from "@/lib/utils";
import type {
  BusinessManager, AdAccount, AgentFormData, AudienceCreative, AudienceCreativeItem,
  AudienceImage, PlacementSelection, AdObjective, AdCta,
} from "@/types";

interface AgentFormProps {
  businessManagers: BusinessManager[];
  adAccounts: AdAccount[];
  onSubmit: (formData: AgentFormData) => void;
  disabled?: boolean;
  initialFormData?: AgentFormData;
}

const OBJECTIVES = [
  { value: "OUTCOME_TRAFFIC", label: "Tráfego" },
  { value: "OUTCOME_LEADS", label: "Geração de Cadastros" },
  { value: "OUTCOME_SALES", label: "Vendas" },
  { value: "OUTCOME_AWARENESS", label: "Reconhecimento de Marca" },
  { value: "OUTCOME_ENGAGEMENT", label: "Engajamento" },
] as const;

const CTA_OPTIONS = [
  { value: "LEARN_MORE", label: "Saiba Mais" },
  { value: "SHOP_NOW", label: "Comprar Agora" },
  { value: "SIGN_UP", label: "Cadastre-se" },
  { value: "CONTACT_US", label: "Fale Conosco" },
  { value: "BOOK_NOW", label: "Reserve Agora" },
  { value: "GET_QUOTE", label: "Solicitar Orçamento" },
] as const;

// "Meta de Desempenho" — só aparece para Engajamento/Vendas quando o conjunto tem
// conversão por mensagens habilitada. O optimization_goal de cada valor é resolvido
// deterministicamente no servidor (app/api/agente/route.ts, PERFORMANCE_GOALS) e foi
// confirmado contra a API real (validate_only) — exceto "leads por mensagens", que ainda
// não tem optimization_goal confirmado pra Engajamento (testei 3 candidatos, a Meta
// rejeitou os 3) e por isso não aparece aqui. Ver nota em PERFORMANCE_GOALS no route.ts.
const PERFORMANCE_GOAL_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  OUTCOME_ENGAGEMENT: [
    { value: "conversations", label: "Maximizar o número de conversas" },
    { value: "link_clicks", label: "Maximizar o número de cliques no link" },
  ],
  OUTCOME_SALES: [
    { value: "conversions", label: "Maximizar o número de conversões" },
    { value: "conversations", label: "Maximizar o número de conversas" },
    { value: "link_clicks", label: "Maximizar o número de cliques no link" },
  ],
};

// Posicionamento manual — MESMO agrupamento visual do Ads Manager real (Feeds / Stories,
// Status e Reels / In-stream / Pesquisa / Apps e sites), pra bater com o que o cliente vê
// ao conferir a campanha lá. Cada item tem field=posição real (verificada via validate_only
// contra a API, 2026-07-02) ou "whatsapp"/"threads" pros dois casos que são só plataforma
// (sem posição própria selecionável). Dependências entre posições (ex: "Explorar" exigir
// "Feed do Instagram") são resolvidas sozinhas no servidor — aqui é só a lista do que
// existe de verdade (removi valores que testei e a Meta rejeitou: video_feeds e
// facebook_business_explore pro Facebook, sponsored_messages pro Messenger).
type RealPositionField = "facebook_positions" | "instagram_positions" | "messenger_positions" | "audience_network_positions";

interface PlacementItem {
  key: string;
  label: string;
  platform: string;
  field: RealPositionField | "whatsapp" | "threads";
  value?: string; // presente quando field é uma posição real
}

const PLACEMENT_GROUPS: Array<{ label: string; items: PlacementItem[] }> = [
  {
    label: "Feeds",
    items: [
      { key: "fb-feed", label: "Feed do Facebook", platform: "facebook", field: "facebook_positions", value: "feed" },
      { key: "fb-profile", label: "Feed do perfil do Facebook", platform: "facebook", field: "facebook_positions", value: "profile_feed" },
      { key: "ig-feed", label: "Feed do Instagram", platform: "instagram", field: "instagram_positions", value: "stream" },
      { key: "fb-marketplace", label: "Facebook Marketplace", platform: "facebook", field: "facebook_positions", value: "marketplace" },
      { key: "fb-rhc", label: "Coluna da direita do Facebook", platform: "facebook", field: "facebook_positions", value: "right_hand_column" },
      { key: "ig-explore", label: "Explorar do Instagram", platform: "instagram", field: "instagram_positions", value: "explore" },
      { key: "ig-explore-home", label: "Início do Explorar do Instagram", platform: "instagram", field: "instagram_positions", value: "explore_home" },
      { key: "fb-notification", label: "Notificações do Facebook", platform: "facebook", field: "facebook_positions", value: "notification" },
      { key: "threads-feed", label: "Feed do Threads", platform: "threads", field: "threads" },
    ],
  },
  {
    label: "Stories, Status e Reels",
    items: [
      { key: "ig-story", label: "Instagram Stories", platform: "instagram", field: "instagram_positions", value: "story" },
      { key: "fb-story", label: "Facebook Stories", platform: "facebook", field: "facebook_positions", value: "story" },
      { key: "msg-story", label: "Messenger Stories", platform: "messenger", field: "messenger_positions", value: "story" },
      { key: "ig-reels", label: "Instagram Reels", platform: "instagram", field: "instagram_positions", value: "reels" },
      { key: "fb-reels", label: "Facebook Reels", platform: "facebook", field: "facebook_positions", value: "facebook_reels" },
      { key: "wa-status", label: "Status do WhatsApp", platform: "whatsapp", field: "whatsapp" },
    ],
  },
  {
    label: "Anúncios in-stream para Reels",
    items: [
      { key: "fb-instream", label: "Vídeo in-stream (Facebook)", platform: "facebook", field: "facebook_positions", value: "instream_video" },
    ],
  },
  {
    label: "Resultados de pesquisa",
    items: [
      { key: "fb-search", label: "Pesquisa do Facebook", platform: "facebook", field: "facebook_positions", value: "search" },
      { key: "ig-search", label: "Pesquisa do Instagram", platform: "instagram", field: "instagram_positions", value: "ig_search" },
    ],
  },
  {
    label: "Apps e sites / Messenger",
    items: [
      { key: "an-classic", label: "Audience Network", platform: "audience_network", field: "audience_network_positions", value: "classic" },
      { key: "an-rewarded", label: "Vídeo recompensado", platform: "audience_network", field: "audience_network_positions", value: "rewarded_video" },
      { key: "msg-home", label: "Caixa de entrada do Messenger", platform: "messenger", field: "messenger_positions", value: "messenger_home" },
    ],
  },
];

function isPlacementChecked(value: PlacementSelection, item: PlacementItem): boolean {
  if (item.field === "whatsapp" || item.field === "threads") return value.platforms.includes(item.field);
  return ((value[item.field] as string[] | undefined) ?? []).includes(item.value!);
}

// Marcar/desmarcar um item SEMPRE mantém `platforms` em sincronia com as posições
// escolhidas (nunca fica uma plataforma marcada sem nenhuma posição real, nem uma
// posição sem a plataforma correspondente) — elimina a classe de bug de "marquei mas
// não veio" por inconsistência de estado.
function togglePlacementItem(value: PlacementSelection, item: PlacementItem): PlacementSelection {
  if (item.field === "whatsapp" || item.field === "threads") {
    const has = value.platforms.includes(item.field);
    return { ...value, platforms: has ? value.platforms.filter((p) => p !== item.field) : [...value.platforms, item.field] };
  }
  const current = (value[item.field] as string[] | undefined) ?? [];
  const has = current.includes(item.value!);
  const next = has ? current.filter((v) => v !== item.value) : [...current, item.value!];
  const platforms = next.length > 0
    ? (value.platforms.includes(item.platform) ? value.platforms : [...value.platforms, item.platform])
    : value.platforms.filter((p) => p !== item.platform);
  return { ...value, [item.field]: next, platforms };
}

// id determinístico (evita mismatch de hidratação)
let _uid = 0;
const uid = () => `id-${++_uid}`;

function makeCreativeItem(): AudienceCreativeItem {
  return {
    id: uid(),
    name: "",
    media_type: "image",
    images: [],
    headline: "",
    primary_text: "",
    description: "",
    cta: "LEARN_MORE",
    destination_url: "",
  };
}

function makeAudience(): AudienceCreative {
  return {
    id: uid(),
    audience_description: "",
    locations: "Brasil",
    age_min: 18,
    age_max: 65,
    genders: ["all"],
    messaging_enabled: false,
    messaging_channels: { whatsapp: false, messenger: false, instagram: false },
    performance_goal: "",
    placement: { mode: "automatic", platforms: [] },
    creatives: [makeCreativeItem()],
  };
}

// Máscara "+55 (98) 98464-8307" enquanto digita. Armazena o valor já mascarado —
// a normalização pra Meta (só dígitos, pro link wa.me) acontece em applyDeterministicConfig
// (app/api/agente/route.ts), que já faz `.replace(/\D/g, "")` antes de usar.
function formatWhatsAppInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 13); // DDI(2) + DDD(2) + número(até 9)
  const ddi = digits.slice(0, 2);
  const ddd = digits.slice(2, 4);
  const rest = digits.slice(4);

  let out = ddi ? `+${ddi}` : "";
  if (ddd) out += ` (${ddd})`;
  if (rest) {
    const splitAt = rest.length >= 9 ? 5 : 4;
    out += rest.length > splitAt ? ` ${rest.slice(0, splitAt)}-${rest.slice(splitAt)}` : ` ${rest}`;
  }
  return out;
}

function nowLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T00:00`;
}

const defaultForm: AgentFormData = {
  bm_id: "",
  account_ids: [],
  facebook_page_id: "",
  whatsapp_number: "",
  campaign_name: "",
  objective: "OUTCOME_TRAFFIC",
  budget_type: "daily",
  budget_amount: 50,
  start_date: nowLocal(),
  end_date: "",
  audiences: [makeAudience()],
};

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  step: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  completed?: boolean;
}

function FormSection({ icon, title, step, open, onToggle, children, completed }: SectionProps) {
  return (
    <div className={cn(
      "rounded-xl border transition-all",
      open ? "border-meta-blue/30 bg-card shadow-sm" : "border-border bg-card/50"
    )}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <div className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-colors",
          completed
            ? "bg-success text-white"
            : open
            ? "bg-meta-blue text-white"
            : "bg-muted text-muted-foreground"
        )}>
          {completed ? "✓" : step}
        </div>
        <div className={cn("flex items-center gap-2 flex-1", open ? "text-foreground" : "text-muted-foreground")}>
          {icon}
          <span className="text-sm font-semibold">{title}</span>
        </div>
        <div className="text-muted-foreground">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-4 space-y-3 border-t border-border/50">
          {children}
        </div>
      )}
    </div>
  );
}

function FieldRow({ label, children, hint, required }: { label: string; children: React.ReactNode; hint?: string; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function buildImagePrompt(c: AudienceCreativeItem, campaignName: string, audienceDescription: string): string {
  const parts = [
    c.headline && `"${c.headline}"`,
    campaignName && `campanha: ${campaignName}`,
    c.primary_text && c.primary_text.slice(0, 80),
    audienceDescription && audienceDescription.slice(0, 60),
  ].filter(Boolean);
  if (parts.length === 0) return "";
  return `Foto profissional para anúncio de mídia social: ${parts.join(". ")}. Fundo limpo e moderno, sem texto na imagem, fotorrealista, iluminação de estúdio.`;
}

// ── Posicionamento (por público) ────────────────────────────────────────────────

function PlacementPicker({ value, onChange, disabled }: {
  value: PlacementSelection;
  onChange: (v: PlacementSelection) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {[
          { value: "automatic" as const, label: "Automático", desc: "Meta otimiza (Advantage+)" },
          { value: "manual" as const, label: "Manual", desc: "Você escolhe onde aparece" },
        ].map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => onChange({ ...value, mode: p.value })}
            disabled={disabled}
            className={cn(
              "flex flex-col items-start gap-0.5 rounded-lg border p-2.5 text-left transition-all",
              value.mode === p.value
                ? "border-meta-blue bg-meta-blue/5 ring-1 ring-meta-blue/30"
                : "border-border hover:border-meta-blue/40"
            )}
          >
            <span className="text-xs font-medium">{p.label}</span>
            <span className="text-[10px] text-muted-foreground">{p.desc}</span>
          </button>
        ))}
      </div>

      {value.mode === "manual" && (
        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground italic">
            Dependências entre posicionamentos (ex: Explorar do Instagram exigir o Feed do Instagram) são resolvidas automaticamente.
          </p>
          {PLACEMENT_GROUPS.map((group) => (
            <div key={group.label} className="rounded-lg border border-border/60 p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{group.label}</p>
              <div className="grid grid-cols-2 gap-1">
                {group.items.map((item) => (
                  <label key={item.key} className="flex items-center gap-1.5 cursor-pointer py-0.5">
                    <Checkbox
                      checked={isPlacementChecked(value, item)}
                      onCheckedChange={() => onChange(togglePlacementItem(value, item))}
                      disabled={disabled}
                    />
                    <span className="text-[11px] text-muted-foreground">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Conversão por mensagens (por público, Engajamento/Vendas) ──────────────────────

function MessagingConfig({ objective, audience, onChange, disabled }: {
  objective: AdObjective;
  audience: AudienceCreative;
  onChange: (partial: Partial<AudienceCreative>) => void;
  disabled?: boolean;
}) {
  const goals = PERFORMANCE_GOAL_OPTIONS[objective] ?? [];

  return (
    <div className="space-y-2 rounded-lg border border-border/60 p-2.5">
      <label className="flex items-center gap-2 cursor-pointer">
        <Checkbox
          checked={audience.messaging_enabled}
          onCheckedChange={(checked) => onChange({ messaging_enabled: !!checked })}
          disabled={disabled}
        />
        <span className="text-xs font-medium">Conversão = Destino das Mensagens (WhatsApp/Messenger/Instagram)</span>
      </label>

      {audience.messaging_enabled && (
        <div className="ml-6 space-y-2.5 pt-1">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Canais (destino manual)
            </p>
            <div className="flex items-center gap-3">
              {([
                { key: "whatsapp" as const, label: "WhatsApp" },
                { key: "messenger" as const, label: "Messenger" },
                { key: "instagram" as const, label: "Instagram" },
              ]).map((ch) => (
                <label key={ch.key} className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox
                    checked={audience.messaging_channels[ch.key]}
                    onCheckedChange={(checked) =>
                      onChange({ messaging_channels: { ...audience.messaging_channels, [ch.key]: !!checked } })
                    }
                    disabled={disabled}
                  />
                  <span className="text-xs">{ch.label}</span>
                </label>
              ))}
            </div>
          </div>

          <FieldRow label="Meta de Desempenho">
            <Select value={audience.performance_goal} onValueChange={(v) => onChange({ performance_goal: v })}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {goals.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldRow>
        </div>
      )}
    </div>
  );
}

// ── Bloco de um criativo (imagem única/carrossel OU vídeo único) ────────────────────

interface CreativeItemBlockProps {
  creative: AudienceCreativeItem;
  index: number;
  total: number;
  campaignName: string;
  audienceDescription: string;
  objective: AdObjective;
  attempted: boolean;
  disabled?: boolean;
  onChange: (partial: Partial<AudienceCreativeItem>) => void;
  onRemove: () => void;
}

function CreativeItemBlock({
  creative, index, total, campaignName, audienceDescription, objective, attempted, disabled, onChange, onRemove,
}: CreativeItemBlockProps) {
  // Engajamento não precisa de link de destino (a Meta ainda exige um `link` internamente,
  // mas o sistema cai pra URL da Página do Facebook sozinho se o campo ficar vazio).
  const destinationUrlRequired = objective !== "OUTCOME_ENGAGEMENT";
  const [imageMode, setImageMode] = useState<"upload" | "generate">("upload");
  const c = creative;
  const err = (cond: boolean) => attempted && cond;

  const addImage = (img: AudienceImage) => onChange({ images: [...c.images, img] });
  const removeImage = (idx: number) => onChange({ images: c.images.filter((_, i) => i !== idx) });

  return (
    <div className="rounded-lg border border-border/70 bg-background p-2.5 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">
          Criativo {index + 1}{total > 1 ? ` de ${total}` : ""}
        </span>
        {total > 1 && (
          <Button
            type="button" variant="ghost" size="icon"
            className="h-6 w-6 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onRemove} disabled={disabled} title="Remover criativo"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      <FieldRow label="Nome do Criativo" required hint="Identifica esse anúncio no Ads Manager — não herda o nome do conjunto">
        <Input
          value={c.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Ex: Banner Promoção Verão — Variante A"
          className={cn("h-9 text-sm", err(!c.name.trim()) && "border-destructive")}
        />
      </FieldRow>

      <div className="flex rounded-lg border border-border p-0.5 bg-muted/30 w-fit">
        {([
          { value: "image" as const, label: "Imagem" },
          { value: "video" as const, label: "Vídeo" },
        ]).map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => onChange({ media_type: m.value })}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-all",
              c.media_type === m.value ? "bg-meta-blue text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
            disabled={disabled}
          >
            {m.label}
          </button>
        ))}
      </div>

      {c.media_type === "image" ? (
        <div className="space-y-2">
          {c.images.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {c.images.map((img, i) => (
                <div key={i} className="relative rounded-lg overflow-hidden border border-border group/img">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.preview} alt={`Imagem ${i + 1}`} className="w-full h-20 object-cover" />
                  <span className="absolute top-1 left-1 rounded bg-black/60 px-1 text-[10px] font-medium text-white">{i + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    disabled={disabled}
                    className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover/img:opacity-100 hover:bg-destructive"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex rounded-lg border border-border p-0.5 bg-background">
            {([
              { value: "upload" as const, label: "Upload", icon: <Upload className="h-3.5 w-3.5" /> },
              { value: "generate" as const, label: "Prompt para IA", icon: <Wand2 className="h-3.5 w-3.5" /> },
            ]).map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setImageMode(m.value)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                  imageMode === m.value ? "bg-meta-blue text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
                disabled={disabled}
              >
                {m.icon}{m.label}
              </button>
            ))}
          </div>

          {imageMode === "upload" ? (
            <ImageUpload
              imageUrl={null}
              onUpload={(url, preview) => addImage({ url, preview })}
              onClear={() => {}}
              disabled={disabled}
            />
          ) : (
            <ImageGenerator
              initialPrompt={buildImagePrompt(c, campaignName, audienceDescription)}
              onAccept={(url, preview) => addImage({ url, preview: preview || url })}
              disabled={disabled}
            />
          )}

          {err(c.images.length === 0) && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />Adicione ao menos uma imagem
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">1 imagem = imagem única · 2 ou mais = carrossel</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div>
            <p className="text-[11px] text-muted-foreground mb-1">Vídeo</p>
            <VideoUpload
              videoUrl={c.video?.url ?? null}
              onUpload={(url, preview) => onChange({ video: { url, preview } })}
              onClear={() => onChange({ video: undefined })}
              disabled={disabled}
            />
            {err(!c.video) && (
              <p className="text-xs text-destructive flex items-center gap-1 mt-1"><AlertCircle className="h-3 w-3" />Envie o vídeo</p>
            )}
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground mb-1">Capa do vídeo (obrigatória)</p>
            <ImageUpload
              imageUrl={c.video_thumbnail?.url ?? null}
              onUpload={(url, preview) => onChange({ video_thumbnail: { url, preview } })}
              onClear={() => onChange({ video_thumbnail: undefined })}
              disabled={disabled}
            />
            {err(!c.video_thumbnail) && (
              <p className="text-xs text-destructive flex items-center gap-1 mt-1"><AlertCircle className="h-3 w-3" />Envie uma imagem de capa</p>
            )}
          </div>
        </div>
      )}

      <FieldRow label="Título" required hint="Máximo 40 caracteres">
        <div className="relative">
          <Input
            value={c.headline}
            onChange={(e) => onChange({ headline: e.target.value.slice(0, 40) })}
            placeholder="Ex: Descubra nossa nova coleção"
            className={cn("h-9 text-sm pr-12", err(!c.headline.trim()) && "border-destructive")}
          />
          <span className={cn("absolute right-3 top-1/2 -translate-y-1/2 text-[11px] tabular-nums", c.headline.length > 35 ? "text-warning" : "text-muted-foreground")}>
            {c.headline.length}/40
          </span>
        </div>
      </FieldRow>

      <FieldRow label="Texto Principal" required hint="Máximo 125 caracteres">
        <div className="relative">
          <Textarea
            value={c.primary_text}
            onChange={(e) => onChange({ primary_text: e.target.value.slice(0, 125) })}
            placeholder="Ex: Aproveite os melhores produtos com frete grátis!"
            rows={2}
            className={cn("text-sm pr-16", err(!c.primary_text.trim()) && "border-destructive")}
          />
          <span className={cn("absolute right-3 top-3 text-[11px] tabular-nums", c.primary_text.length > 110 ? "text-warning" : "text-muted-foreground")}>
            {c.primary_text.length}/125
          </span>
        </div>
      </FieldRow>

      <FieldRow label="Descrição" hint="Máximo 30 caracteres (opcional)">
        <div className="relative">
          <Input
            value={c.description}
            onChange={(e) => onChange({ description: e.target.value.slice(0, 30) })}
            placeholder="Ex: Frete grátis"
            className="h-9 text-sm pr-12"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground tabular-nums">
            {c.description.length}/30
          </span>
        </div>
      </FieldRow>

      <div className="grid grid-cols-2 gap-2">
        <FieldRow label="Botão (CTA)">
          <Select value={c.cta} onValueChange={(v) => onChange({ cta: v as AdCta })}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CTA_OPTIONS.map((ct) => <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow
          label="URL de Destino"
          required={destinationUrlRequired}
          hint={destinationUrlRequired ? undefined : "Opcional em Engajamento — sem preencher, usa a própria Página do Facebook"}
        >
          <Input
            value={c.destination_url}
            onChange={(e) => onChange({ destination_url: e.target.value })}
            placeholder="https://..."
            className={cn("h-9 text-sm", destinationUrlRequired && err(!c.destination_url.trim()) && "border-destructive")}
          />
        </FieldRow>
      </div>
    </div>
  );
}

// ── Subcard de Público (conjunto de anúncios) ──────────────────────────────────────

interface AudienceCardProps {
  audience: AudienceCreative;
  index: number;
  total: number;
  campaignName: string;
  objective: AdObjective;
  attempted: boolean;
  disabled?: boolean;
  onChange: (partial: Partial<AudienceCreative>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}

function AudienceCard({
  audience, index, total, campaignName, objective, attempted, disabled,
  onChange, onRemove, onDuplicate,
}: AudienceCardProps) {
  const a = audience;
  const isEngagement = objective === "OUTCOME_ENGAGEMENT";
  const err = (cond: boolean) => attempted && cond;
  const showMessaging = objective === "OUTCOME_ENGAGEMENT" || objective === "OUTCOME_SALES";

  const updateCreative = (creativeId: string, partial: Partial<AudienceCreativeItem>) =>
    onChange({ creatives: a.creatives.map((c) => (c.id === creativeId ? { ...c, ...partial } : c)) });

  const addCreative = () => onChange({ creatives: [...a.creatives, makeCreativeItem()] });
  const removeCreative = (creativeId: string) =>
    onChange({ creatives: a.creatives.filter((c) => c.id !== creativeId) });

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-3">
      {/* Header do público */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-meta-blue/10 text-meta-blue text-xs font-bold">
            {index + 1}
          </div>
          <span className="text-sm font-semibold">Público {index + 1}</span>
          <Badge variant="outline" className="text-[10px] gap-1">
            <Images className="h-2.5 w-2.5" />
            {a.creatives.length} criativo{a.creatives.length !== 1 ? "s" : ""}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:bg-meta-blue/10 hover:text-meta-blue"
            onClick={onDuplicate}
            disabled={disabled}
            title="Duplicar público (copia criativos e campos)"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          {total > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={onRemove}
              disabled={disabled}
              title="Remover público"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* ── Público ── */}
      <FieldRow
        label="Descrição do Público"
        required
        hint="Descreva em português. O agente converte para o targeting da Meta."
      >
        <Textarea
          value={a.audience_description}
          onChange={(e) => onChange({ audience_description: e.target.value })}
          placeholder="Ex: Mulheres de 25 a 40 anos interessadas em moda e beleza"
          rows={2}
          className={cn("text-sm", err(!a.audience_description.trim()) && "border-destructive")}
        />
      </FieldRow>

      <FieldRow label="Localização" required hint="Cidades, estados ou países separados por vírgula">
        <Input
          value={a.locations}
          onChange={(e) => onChange({ locations: e.target.value })}
          placeholder="Ex: São Paulo, Rio de Janeiro"
          className={cn("h-9 text-sm", err(!a.locations.trim()) && "border-destructive")}
        />
      </FieldRow>

      <div className="grid grid-cols-3 gap-2">
        <FieldRow label="Idade Mín.">
          <Input
            type="number" min={13} max={65}
            value={a.age_min}
            onChange={(e) => onChange({ age_min: parseInt(e.target.value) || 18 })}
            className="h-9 text-sm"
          />
        </FieldRow>
        <FieldRow label="Idade Máx.">
          <Input
            type="number" min={a.age_min} max={65}
            value={a.age_max}
            onChange={(e) => onChange({ age_max: parseInt(e.target.value) || 65 })}
            className="h-9 text-sm"
          />
        </FieldRow>
        <FieldRow label="Gênero">
          <div className="flex items-center gap-2 h-9">
            {[
              { value: "all", label: "Todos" },
              { value: "male", label: "M" },
              { value: "female", label: "F" },
            ].map((g) => (
              <label key={g.value} className="flex items-center gap-1 cursor-pointer">
                <Checkbox
                  checked={g.value === "all" ? a.genders.includes("all") : (a.genders.includes(g.value) && !a.genders.includes("all"))}
                  onCheckedChange={(checked) => {
                    if (g.value === "all") {
                      onChange({ genders: checked ? ["all"] : [] });
                    } else {
                      const current = a.genders.filter((v) => v !== "all");
                      onChange({ genders: checked ? [...current, g.value] : current.filter((v) => v !== g.value) });
                    }
                  }}
                />
                <span className="text-xs">{g.label}</span>
              </label>
            ))}
          </div>
        </FieldRow>
      </div>

      <div className="border-t border-border/50 pt-3" />

      {showMessaging && (
        <MessagingConfig objective={objective} audience={a} onChange={onChange} disabled={disabled} />
      )}

      <div>
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
          Posicionamento
        </p>
        <PlacementPicker value={a.placement} onChange={(placement) => onChange({ placement })} disabled={disabled} />
        {err(a.placement.mode === "manual" && a.placement.platforms.length === 0) && (
          <p className="text-xs text-destructive mt-1">Selecione ao menos uma plataforma</p>
        )}
      </div>

      <div className="border-t border-border/50 pt-3 space-y-2">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          Criativos ({a.creatives.length})
        </p>
        {a.creatives.map((c, i) => (
          <CreativeItemBlock
            key={c.id}
            creative={c}
            index={i}
            total={a.creatives.length}
            campaignName={campaignName}
            audienceDescription={a.audience_description}
            objective={objective}
            attempted={attempted}
            disabled={disabled}
            onChange={(partial) => updateCreative(c.id, partial)}
            onRemove={() => removeCreative(c.id)}
          />
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full h-8 gap-1.5 text-xs border-dashed"
          onClick={addCreative}
          disabled={disabled}
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar criativo
        </Button>
      </div>
    </div>
  );
}

// ── Formulário principal ────────────────────────────────────────────────────────

export function AgentForm({ businessManagers, adAccounts, onSubmit, disabled, initialFormData }: AgentFormProps) {
  const [form, setForm] = useState<AgentFormData>(initialFormData ?? defaultForm);
  const [openSection, setOpenSection] = useState(1);
  const [attempted, setAttempted] = useState(false);
  const [budgetCents, setBudgetCents] = useState(() =>
    Math.round((initialFormData?.budget_amount ?? defaultForm.budget_amount) * 100)
  );

  // Auto-seleciona a BM única quando ainda não há conta escolhida
  useEffect(() => {
    if (businessManagers.length === 1 && !form.bm_id) {
      setForm((prev) => ({ ...prev, bm_id: businessManagers[0].id }));
    }
  }, [businessManagers]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof AgentFormData>(key: K, value: AgentFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const selectAccount = (id: string) => {
    const account = adAccounts.find((acc) => acc.id === id);
    setForm((prev) => ({ ...prev, account_ids: [id], bm_id: account?.bm_id ?? prev.bm_id }));
  };

  const handleBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
    const cents = parseInt(digits || "0", 10);
    setBudgetCents(cents);
    set("budget_amount", cents / 100);
  };

  const budgetDisplay = (budgetCents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // ── Helpers de públicos ──
  const updateAudience = (id: string, partial: Partial<AudienceCreative>) =>
    setForm((prev) => ({
      ...prev,
      audiences: prev.audiences.map((a) => (a.id === id ? { ...a, ...partial } : a)),
    }));

  const addAudience = () =>
    setForm((prev) => ({ ...prev, audiences: [...prev.audiences, makeAudience()] }));

  // Duplica um público logo abaixo do original, copiando criativos e campos preenchidos
  const duplicateAudience = (id: string) =>
    setForm((prev) => {
      const index = prev.audiences.findIndex((a) => a.id === id);
      if (index === -1) return prev;
      const source = prev.audiences[index];
      const copy: AudienceCreative = {
        ...source,
        id: uid(),
        genders: [...source.genders],
        messaging_channels: { ...source.messaging_channels },
        placement: { ...source.placement, platforms: [...source.placement.platforms] },
        creatives: source.creatives.map((c) => ({
          ...c,
          id: uid(),
          images: c.images.map((img) => ({ ...img })),
        })),
      };
      const next = [...prev.audiences];
      next.splice(index + 1, 0, copy);
      return { ...prev, audiences: next };
    });

  const removeAudience = (id: string) =>
    setForm((prev) => ({ ...prev, audiences: prev.audiences.filter((a) => a.id !== id) }));

  // ── Validação ──
  const creativeValid = (c: AudienceCreativeItem) => {
    const hasMedia = c.media_type === "video" ? (!!c.video && !!c.video_thumbnail) : c.images.length > 0;
    const destinationUrlOk = form.objective === "OUTCOME_ENGAGEMENT" || !!c.destination_url.trim();
    return !!c.name.trim() && hasMedia && !!c.headline.trim() && !!c.primary_text.trim() && destinationUrlOk;
  };

  const audienceValid = (a: AudienceCreative) =>
    !!a.audience_description.trim() && !!a.locations.trim() &&
    a.creatives.length > 0 && a.creatives.every(creativeValid) &&
    (!a.messaging_enabled || (
      (a.messaging_channels.whatsapp || a.messaging_channels.messenger || a.messaging_channels.instagram) &&
      !!a.performance_goal
    )) &&
    (a.placement.mode !== "manual" || a.placement.platforms.length > 0);

  // Número do WhatsApp é sempre opcional (Leads clássico OU canal WhatsApp na conversão
  // por mensagens) — sem ele, a Meta usa o número padrão já conectado à página.
  const anyAudienceNeedsWhatsApp = form.audiences.some((a) => a.messaging_enabled && a.messaging_channels.whatsapp);

  const isSection1Done = form.account_ids.length > 0 && !!form.facebook_page_id?.trim();
  const isSection2Done =
    !!form.campaign_name.trim() && form.budget_amount > 0 && !!form.start_date &&
    (form.budget_type !== "total" || !!form.end_date);
  const isSection3Done = form.audiences.length > 0 && form.audiences.every(audienceValid);

  const isValid = isSection1Done && isSection2Done && isSection3Done;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (isValid) {
      onSubmit(form);
    } else {
      // Abre a primeira seção incompleta
      if (!isSection1Done) setOpenSection(1);
      else if (!isSection2Done) setOpenSection(2);
      else setOpenSection(3);
    }
  };

  const showWhatsAppField = form.objective === "OUTCOME_LEADS" || anyAudienceNeedsWhatsApp;

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      {/* Section 1: Conta */}
      <FormSection
        icon={<Building2 className="h-3.5 w-3.5" />}
        title="Conta de Anúncios"
        step={1}
        open={openSection === 1}
        onToggle={() => setOpenSection(openSection === 1 ? 0 : 1)}
        completed={isSection1Done}
      >
        <FieldRow label="Conta de Anúncios" required hint="Selecione a conta onde o anúncio será criado">
          <div className="space-y-2">
            {adAccounts.map((acc) => (
              <button
                key={acc.id}
                type="button"
                onClick={() => selectAccount(acc.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all",
                  form.account_ids[0] === acc.id
                    ? "border-meta-blue bg-meta-blue/5 ring-1 ring-meta-blue/30"
                    : "border-border hover:border-meta-blue/40"
                )}
              >
                <div className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  form.account_ids[0] === acc.id ? "border-meta-blue" : "border-muted-foreground/50"
                )}>
                  {form.account_ids[0] === acc.id && <div className="h-2 w-2 rounded-full bg-meta-blue" />}
                </div>
                <span className="text-sm font-medium flex-1 truncate">{acc.name}</span>
                <span className="text-[11px] font-mono text-muted-foreground">{acc.meta_account_id}</span>
              </button>
            ))}
          </div>
          {attempted && !isSection1Done && <p className="text-xs text-destructive">Selecione uma conta de anúncios</p>}
        </FieldRow>

        <FieldRow label="Página do Facebook" required>
          <FacebookPageSelect
            value={form.facebook_page_id ?? ""}
            onChange={(pageId) => set("facebook_page_id", pageId)}
            error={attempted && !form.facebook_page_id?.trim()}
          />
          {attempted && !form.facebook_page_id?.trim() && (
            <p className="text-xs text-destructive">Selecione ou cadastre uma Página do Facebook</p>
          )}
        </FieldRow>

        {isSection1Done && (
          <Button type="button" size="sm" className="w-full h-8 text-xs" onClick={() => setOpenSection(2)}>
            Próximo
          </Button>
        )}
      </FormSection>

      {/* Section 2: Campanha */}
      <FormSection
        icon={<Megaphone className="h-3.5 w-3.5" />}
        title="Campanha"
        step={2}
        open={openSection === 2}
        onToggle={() => setOpenSection(openSection === 2 ? 0 : 2)}
        completed={isSection2Done}
      >
        <FieldRow label="Nome da Campanha" required>
          <Input
            value={form.campaign_name}
            onChange={(e) => set("campaign_name", e.target.value)}
            placeholder="Ex: Campanha Verão 2025"
            className={cn("h-9 text-sm", attempted && !form.campaign_name.trim() && "border-destructive")}
          />
        </FieldRow>

        <FieldRow label="Objetivo">
          <Select value={form.objective} onValueChange={(v) => set("objective", v as AgentFormData["objective"])}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {OBJECTIVES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </FieldRow>

        {showWhatsAppField && (
          <FieldRow
            label="Número do WhatsApp"
            hint={
              form.objective === "OUTCOME_LEADS"
                ? "Opcional — Leads via Click-to-WhatsApp. Se deixar em branco, a Meta usa o número padrão já conectado à página. Precisa já estar vinculado ao WhatsApp Business da conta."
                : "Opcional — usado pelo(s) público(s) com canal WhatsApp habilitado (Seção 3). Se deixar em branco, a Meta usa o número padrão já conectado à página. Precisa já estar vinculado ao WhatsApp Business da conta."
            }
          >
            <Input
              value={form.whatsapp_number ?? ""}
              onChange={(e) => set("whatsapp_number", formatWhatsAppInput(e.target.value))}
              placeholder="+55 (98) 98464-8307"
              inputMode="numeric"
              className="h-9 text-sm"
            />
            {form.objective === "OUTCOME_LEADS" && attempted && !form.facebook_page_id?.trim() && (
              <p className="text-xs text-destructive">
                Preencha o ID da Página do Facebook na Seção 1 — obrigatório para leads no WhatsApp.
              </p>
            )}
          </FieldRow>
        )}

        <div className="grid grid-cols-2 gap-2">
          <FieldRow label="Tipo de Orçamento">
            <Select value={form.budget_type} onValueChange={(v) => set("budget_type", v as "daily" | "total")}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Diário</SelectItem>
                <SelectItem value="total">Total da campanha</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>

          <FieldRow label="Orçamento (R$)" required hint="Da campanha · a Meta distribui entre os públicos (CBO)">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">R$</span>
              <Input
                type="text"
                inputMode="numeric"
                value={budgetDisplay}
                onChange={handleBudgetChange}
                className={cn("h-9 text-sm pl-9", attempted && form.budget_amount <= 0 && "border-destructive")}
                placeholder="0,00"
              />
            </div>
          </FieldRow>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <FieldRow label="Início (data e hora)" required>
            <Input
              type="datetime-local"
              value={form.start_date}
              onChange={(e) => set("start_date", e.target.value)}
              className={cn("h-9 text-sm", attempted && !form.start_date && "border-destructive")}
            />
          </FieldRow>

          <FieldRow label="Fim (data e hora)" required={form.budget_type === "total"}>
            <Input
              type="datetime-local"
              value={form.end_date ?? ""}
              onChange={(e) => set("end_date", e.target.value || undefined)}
              min={form.start_date}
              className={cn("h-9 text-sm", attempted && form.budget_type === "total" && !form.end_date && "border-destructive")}
            />
            {form.budget_type === "total" && <p className="text-[11px] text-muted-foreground">Obrigatória para orçamento total</p>}
          </FieldRow>
        </div>

        {isSection2Done && (
          <Button type="button" size="sm" className="w-full h-8 text-xs" onClick={() => setOpenSection(3)}>
            Próximo
          </Button>
        )}
      </FormSection>

      {/* Section 3: Públicos, Conversão, Posicionamento & Criativos */}
      <FormSection
        icon={<Users className="h-3.5 w-3.5" />}
        title={`Públicos & Criativos${form.audiences.length > 1 ? ` (${form.audiences.length})` : ""}`}
        step={3}
        open={openSection === 3}
        onToggle={() => setOpenSection(openSection === 3 ? 0 : 3)}
        completed={isSection3Done}
      >
        <p className="text-[11px] text-muted-foreground -mt-1">
          Cada público é um conjunto de anúncios: tem seu próprio posicionamento e pode ter vários criativos
          (imagem única, carrossel ou vídeo).
        </p>

        <div className="space-y-3">
          {form.audiences.map((a, i) => (
            <AudienceCard
              key={a.id}
              audience={a}
              index={i}
              total={form.audiences.length}
              campaignName={form.campaign_name}
              objective={form.objective}
              attempted={attempted}
              disabled={disabled}
              onChange={(partial) => updateAudience(a.id, partial)}
              onRemove={() => removeAudience(a.id)}
              onDuplicate={() => duplicateAudience(a.id)}
            />
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full h-9 gap-1.5 text-xs border-dashed"
          onClick={addAudience}
          disabled={disabled}
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar outro público
        </Button>
      </FormSection>

      {/* Submit */}
      <Button
        type="submit"
        variant="meta"
        size="lg"
        disabled={disabled}
        className="w-full h-11 gap-2 text-sm font-semibold shadow-md shadow-meta-blue/20"
      >
        <Send className="h-4 w-4" />
        {disabled ? "Agente trabalhando..." : "Criar Anúncio com IA"}
      </Button>
    </form>
  );
}
