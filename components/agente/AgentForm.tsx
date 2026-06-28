"use client";

import { useState, useEffect } from "react";
import {
  Building2, Megaphone, Users, LayoutGrid,
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
import { ImageGenerator } from "./ImageGenerator";
import { FacebookPageSelect } from "./FacebookPageSelect";
import { cn } from "@/lib/utils";
import type { BusinessManager, AdAccount, AgentFormData, AudienceCreative, AudienceImage } from "@/types";

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

const MANUAL_PLACEMENT_OPTIONS = [
  { value: "facebook_feed", label: "Facebook Feed" },
  { value: "instagram_feed", label: "Instagram Feed" },
  { value: "instagram_stories", label: "Instagram Stories" },
  { value: "facebook_reels", label: "Facebook Reels" },
  { value: "instagram_reels", label: "Instagram Reels" },
  { value: "facebook_stories", label: "Facebook Stories" },
  { value: "facebook_marketplace", label: "Marketplace" },
];

// id determinístico (evita mismatch de hidratação)
let _uid = 0;
const uid = () => `aud-${++_uid}`;

function makeAudience(): AudienceCreative {
  return {
    id: uid(),
    audience_description: "",
    locations: "Brasil",
    age_min: 18,
    age_max: 65,
    genders: ["all"],
    headline: "",
    primary_text: "",
    description: "",
    cta: "LEARN_MORE",
    destination_url: "",
    images: [],
  };
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
  placements: "automatic",
  manual_placements: [],
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

function buildImagePrompt(a: AudienceCreative, campaignName: string): string {
  const parts = [
    a.headline && `"${a.headline}"`,
    campaignName && `campanha: ${campaignName}`,
    a.primary_text && a.primary_text.slice(0, 80),
    a.audience_description && a.audience_description.slice(0, 60),
  ].filter(Boolean);
  if (parts.length === 0) return "";
  return `Foto profissional para anúncio de mídia social: ${parts.join(". ")}. Fundo limpo e moderno, sem texto na imagem, fotorrealista, iluminação de estúdio.`;
}

// ── Subcard de Público + Criativo ──────────────────────────────────────────────

interface AudienceCardProps {
  audience: AudienceCreative;
  index: number;
  total: number;
  campaignName: string;
  attempted: boolean;
  disabled?: boolean;
  onChange: (partial: Partial<AudienceCreative>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onAddImage: (img: AudienceImage) => void;
  onRemoveImage: (imgIndex: number) => void;
}

function AudienceCard({
  audience, index, total, campaignName, attempted, disabled,
  onChange, onRemove, onDuplicate, onAddImage, onRemoveImage,
}: AudienceCardProps) {
  const [imageMode, setImageMode] = useState<"upload" | "generate">("upload");
  const a = audience;
  const err = (cond: boolean) => attempted && cond;

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-3">
      {/* Header do público */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-meta-blue/10 text-meta-blue text-xs font-bold">
            {index + 1}
          </div>
          <span className="text-sm font-semibold">Público {index + 1}</span>
          {a.images.length > 0 && (
            <Badge variant="outline" className="text-[10px] gap-1">
              <Images className="h-2.5 w-2.5" />
              {a.images.length > 1 ? `Carrossel · ${a.images.length}` : "Imagem única"}
            </Badge>
          )}
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

      {/* ── Criativo ── */}
      <FieldRow label="Imagens do Criativo" required hint="1 imagem = imagem única · 2 ou mais = carrossel">
        {a.images.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-2">
            {a.images.map((img, i) => (
              <div key={i} className="relative rounded-lg overflow-hidden border border-border group/img">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.preview} alt={`Imagem ${i + 1}`} className="w-full h-20 object-cover" />
                <span className="absolute top-1 left-1 rounded bg-black/60 px-1 text-[10px] font-medium text-white">{i + 1}</span>
                <button
                  type="button"
                  onClick={() => onRemoveImage(i)}
                  disabled={disabled}
                  className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover/img:opacity-100 hover:bg-destructive"
                >
                  <XIcon className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
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
              onUpload={(url, preview) => onAddImage({ url, preview })}
              onClear={() => {}}
              disabled={disabled}
            />
          ) : (
            <ImageGenerator
              initialPrompt={buildImagePrompt(a, campaignName)}
              onAccept={(url, preview) => onAddImage({ url, preview: preview || url })}
              disabled={disabled}
            />
          )}
        </div>

        {err(a.images.length === 0) && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />Adicione ao menos uma imagem
          </p>
        )}
      </FieldRow>

      <FieldRow label="Título" required hint="Máximo 40 caracteres">
        <div className="relative">
          <Input
            value={a.headline}
            onChange={(e) => onChange({ headline: e.target.value.slice(0, 40) })}
            placeholder="Ex: Descubra nossa nova coleção"
            className={cn("h-9 text-sm pr-12", err(!a.headline.trim()) && "border-destructive")}
          />
          <span className={cn("absolute right-3 top-1/2 -translate-y-1/2 text-[11px] tabular-nums", a.headline.length > 35 ? "text-warning" : "text-muted-foreground")}>
            {a.headline.length}/40
          </span>
        </div>
      </FieldRow>

      <FieldRow label="Texto Principal" required hint="Máximo 125 caracteres">
        <div className="relative">
          <Textarea
            value={a.primary_text}
            onChange={(e) => onChange({ primary_text: e.target.value.slice(0, 125) })}
            placeholder="Ex: Aproveite os melhores produtos com frete grátis!"
            rows={2}
            className={cn("text-sm pr-16", err(!a.primary_text.trim()) && "border-destructive")}
          />
          <span className={cn("absolute right-3 top-3 text-[11px] tabular-nums", a.primary_text.length > 110 ? "text-warning" : "text-muted-foreground")}>
            {a.primary_text.length}/125
          </span>
        </div>
      </FieldRow>

      <FieldRow label="Descrição" hint="Máximo 30 caracteres (opcional)">
        <div className="relative">
          <Input
            value={a.description}
            onChange={(e) => onChange({ description: e.target.value.slice(0, 30) })}
            placeholder="Ex: Frete grátis"
            className="h-9 text-sm pr-12"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground tabular-nums">
            {a.description.length}/30
          </span>
        </div>
      </FieldRow>

      <div className="grid grid-cols-2 gap-2">
        <FieldRow label="Botão (CTA)">
          <Select value={a.cta} onValueChange={(v) => onChange({ cta: v as AudienceCreative["cta"] })}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CTA_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="URL de Destino" required>
          <Input
            value={a.destination_url}
            onChange={(e) => onChange({ destination_url: e.target.value })}
            placeholder="https://..."
            className={cn("h-9 text-sm", err(!a.destination_url.trim()) && "border-destructive")}
          />
        </FieldRow>
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
        images: source.images.map((img) => ({ ...img })),
      };
      const next = [...prev.audiences];
      next.splice(index + 1, 0, copy);
      return { ...prev, audiences: next };
    });

  const removeAudience = (id: string) =>
    setForm((prev) => ({ ...prev, audiences: prev.audiences.filter((a) => a.id !== id) }));

  const addImage = (id: string, img: AudienceImage) =>
    setForm((prev) => ({
      ...prev,
      audiences: prev.audiences.map((a) => (a.id === id ? { ...a, images: [...a.images, img] } : a)),
    }));

  const removeImage = (id: string, imgIndex: number) =>
    setForm((prev) => ({
      ...prev,
      audiences: prev.audiences.map((a) =>
        a.id === id ? { ...a, images: a.images.filter((_, i) => i !== imgIndex) } : a
      ),
    }));

  const togglePlacement = (value: string) =>
    setForm((prev) => {
      const current = prev.manual_placements ?? [];
      return {
        ...prev,
        manual_placements: current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value],
      };
    });

  // ── Validação ──
  const audienceValid = (a: AudienceCreative) =>
    !!a.audience_description.trim() && !!a.locations.trim() && a.images.length > 0 &&
    !!a.headline.trim() && !!a.primary_text.trim() && !!a.destination_url.trim();

  // Leads via Click-to-WhatsApp exige número do WhatsApp + ID da página
  const leadsWhatsAppOk =
    form.objective !== "OUTCOME_LEADS" ||
    (!!form.whatsapp_number?.trim() && !!form.facebook_page_id?.trim());

  const isSection1Done = form.account_ids.length > 0 && !!form.facebook_page_id?.trim();
  const isSection2Done =
    !!form.campaign_name.trim() && form.budget_amount > 0 && !!form.start_date &&
    (form.budget_type !== "total" || !!form.end_date) && leadsWhatsAppOk;
  const isSection3Done = form.audiences.length > 0 && form.audiences.every(audienceValid);

  const isValid = isSection1Done && isSection2Done && isSection3Done &&
    (form.placements !== "manual" || (form.manual_placements ?? []).length > 0);

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

        {form.objective === "OUTCOME_LEADS" && (
          <FieldRow
            label="Número do WhatsApp"
            required
            hint="Leads via Click-to-WhatsApp. Com DDI e DDD (ex: 55 98 8464-8307). Exige também o ID da Página do Facebook (Seção 1), com o WhatsApp conectado à página."
          >
            <Input
              value={form.whatsapp_number ?? ""}
              onChange={(e) => set("whatsapp_number", e.target.value)}
              placeholder="Ex: 55 98 8464-8307"
              className={cn("h-9 text-sm", attempted && !form.whatsapp_number?.trim() && "border-destructive")}
            />
            {attempted && !form.facebook_page_id?.trim() && (
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

      {/* Section 3: Públicos & Criativos */}
      <FormSection
        icon={<Users className="h-3.5 w-3.5" />}
        title={`Públicos & Criativos${form.audiences.length > 1 ? ` (${form.audiences.length})` : ""}`}
        step={3}
        open={openSection === 3}
        onToggle={() => setOpenSection(openSection === 3 ? 0 : 3)}
        completed={isSection3Done}
      >
        <p className="text-[11px] text-muted-foreground -mt-1">
          Cada público tem seu próprio criativo. Adicione mais de uma imagem em um público para criar um carrossel.
        </p>

        <div className="space-y-3">
          {form.audiences.map((a, i) => (
            <AudienceCard
              key={a.id}
              audience={a}
              index={i}
              total={form.audiences.length}
              campaignName={form.campaign_name}
              attempted={attempted}
              disabled={disabled}
              onChange={(partial) => updateAudience(a.id, partial)}
              onRemove={() => removeAudience(a.id)}
              onDuplicate={() => duplicateAudience(a.id)}
              onAddImage={(img) => addImage(a.id, img)}
              onRemoveImage={(idx) => removeImage(a.id, idx)}
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

      {/* Section 4: Posicionamentos */}
      <FormSection
        icon={<LayoutGrid className="h-3.5 w-3.5" />}
        title="Posicionamentos"
        step={4}
        open={openSection === 4}
        onToggle={() => setOpenSection(openSection === 4 ? 0 : 4)}
        completed={false}
      >
        <FieldRow label="Tipo de Posicionamento">
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: "automatic", label: "Automático", desc: "Meta otimiza os posicionamentos (Advantage+)" },
              { value: "manual", label: "Manual", desc: "Escolha onde seu anúncio vai aparecer" },
            ].map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => set("placements", p.value as "automatic" | "manual")}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-all",
                  form.placements === p.value
                    ? "border-meta-blue bg-meta-blue/5 ring-1 ring-meta-blue/30"
                    : "border-border hover:border-meta-blue/40"
                )}
              >
                <span className="text-sm font-medium">{p.label}</span>
                <span className="text-[11px] text-muted-foreground">{p.desc}</span>
              </button>
            ))}
          </div>
        </FieldRow>

        {form.placements === "manual" && (
          <FieldRow label="Posicionamentos Manuais">
            <div className="grid grid-cols-2 gap-2">
              {MANUAL_PLACEMENT_OPTIONS.map((p) => (
                <label key={p.value} className="flex items-center gap-2 cursor-pointer py-1">
                  <Checkbox
                    checked={(form.manual_placements ?? []).includes(p.value)}
                    onCheckedChange={() => togglePlacement(p.value)}
                  />
                  <span className="text-sm">{p.label}</span>
                </label>
              ))}
            </div>
            {attempted && form.placements === "manual" && (form.manual_placements ?? []).length === 0 && (
              <p className="text-xs text-destructive">Selecione ao menos um posicionamento</p>
            )}
          </FieldRow>
        )}
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
