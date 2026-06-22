"use client";

import { useState, useEffect } from "react";
import {
  Building2, Megaphone, Users, Image, LayoutGrid,
  ChevronDown, ChevronUp, Send, AlertCircle, Upload, Wand2, X as XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ImageUpload } from "./ImageUpload";
import { ImageGenerator } from "./ImageGenerator";
import { cn } from "@/lib/utils";
import type { BusinessManager, AdAccount, AgentFormData } from "@/types";

interface AgentFormProps {
  businessManagers: BusinessManager[];
  adAccounts: AdAccount[];
  onSubmit: (formData: AgentFormData, imageUrl: string, imagePreview: string) => void;
  disabled?: boolean;
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

const defaultForm: AgentFormData = {
  bm_id: "",
  account_ids: [],
  facebook_page_id: "",
  campaign_name: "",
  objective: "OUTCOME_TRAFFIC",
  budget_type: "daily",
  budget_amount: 50,
  start_date: new Date().toISOString().split("T")[0],
  end_date: "",
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
  placements: "automatic",
  manual_placements: [],
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

function buildImagePrompt(form: AgentFormData): string {
  const parts = [
    form.headline && `"${form.headline}"`,
    form.campaign_name && `campanha: ${form.campaign_name}`,
    form.primary_text && form.primary_text.slice(0, 80),
    form.audience_description && form.audience_description.slice(0, 60),
  ].filter(Boolean);
  if (parts.length === 0) return "";
  return `Foto profissional para anúncio de mídia social: ${parts.join(". ")}. Fundo limpo e moderno, sem texto na imagem, fotorrealista, iluminação de estúdio.`;
}

export function AgentForm({ businessManagers, adAccounts, onSubmit, disabled }: AgentFormProps) {
  const [form, setForm] = useState<AgentFormData>(defaultForm);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageMode, setImageMode] = useState<"upload" | "generate">("upload");
  const [openSection, setOpenSection] = useState(1);
  const [errors, setErrors] = useState<Partial<Record<keyof AgentFormData | "image", string>>>({});

  const filteredAccounts = adAccounts.filter(
    (a) => !form.bm_id || a.bm_id === form.bm_id
  );

  // Auto-select the single BM on mount
  useEffect(() => {
    if (businessManagers.length === 1 && !form.bm_id) {
      setForm((prev) => ({ ...prev, bm_id: businessManagers[0].id }));
    }
  }, [businessManagers]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof AgentFormData>(key: K, value: AgentFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const toggleAccount = (id: string) => {
    setForm((prev) => {
      const current = prev.account_ids;
      const next = current.includes(id)
        ? current.filter((v) => v !== id)
        : [...current, id];
      return { ...prev, account_ids: next };
    });
    setErrors((prev) => ({ ...prev, account_ids: undefined }));
  };

  const togglePlacement = (value: string) => {
    setForm((prev) => {
      const current = prev.manual_placements ?? [];
      return {
        ...prev,
        manual_placements: current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value],
      };
    });
  };

  const validate = (): boolean => {
    const e: typeof errors = {};
    if (!form.bm_id) e.bm_id = "Nenhuma BM encontrada";
    if (form.account_ids.length === 0) e.account_ids = "Selecione ao menos uma conta de anúncios";
    if (!form.campaign_name.trim()) e.campaign_name = "Nome da campanha obrigatório";
    if (!form.budget_amount || form.budget_amount <= 0) e.budget_amount = "Valor deve ser maior que zero";
    if (!form.start_date) e.start_date = "Data de início obrigatória";
    if (!form.audience_description.trim()) e.audience_description = "Descreva o público-alvo";
    if (!form.locations.trim()) e.locations = "Informe as localizações";
    if (!form.headline.trim()) e.headline = "Título obrigatório";
    if (!form.primary_text.trim()) e.primary_text = "Texto principal obrigatório";
    if (!form.destination_url.trim()) e.destination_url = "URL de destino obrigatória";
    if (!imageUrl) e.image = "Faça o upload de uma imagem";
    if (form.placements === "manual" && (form.manual_placements ?? []).length === 0) {
      e.placements = "Selecione ao menos um posicionamento";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate() && imageUrl) {
      onSubmit(form, imageUrl, imagePreview ?? "");
    }
  };

  const isSection1Done = !!form.bm_id && form.account_ids.length > 0;
  const isSection2Done = !!form.campaign_name && !!form.objective && form.budget_amount > 0 && !!form.start_date;
  const isSection3Done = !!form.audience_description && !!form.locations;
  const isSection4Done = !!imageUrl && !!form.headline && !!form.primary_text && !!form.destination_url;

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
        {/* BM info — auto-selecionada, sem dropdown */}
        {businessManagers.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2">
            <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Business Manager:</span>
            <span className="text-xs font-semibold">{businessManagers[0].name}</span>
          </div>
        )}

        <FieldRow label="Contas de Anúncios" required hint="Selecione uma ou ambas as contas para criar o anúncio">
          <div className="space-y-2">
            {filteredAccounts.map((a) => (
              <label
                key={a.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all",
                  form.account_ids.includes(a.id)
                    ? "border-meta-blue bg-meta-blue/5 ring-1 ring-meta-blue/30"
                    : "border-border hover:border-meta-blue/40"
                )}
              >
                <Checkbox
                  checked={form.account_ids.includes(a.id)}
                  onCheckedChange={() => toggleAccount(a.id)}
                />
                <span className="text-sm font-medium">{a.name}</span>
                <span className="ml-auto text-[11px] font-mono text-muted-foreground">{a.meta_account_id}</span>
              </label>
            ))}
          </div>
          {errors.account_ids && <p className="text-xs text-destructive">{errors.account_ids}</p>}
        </FieldRow>

        <FieldRow
          label="ID da Página do Facebook"
          hint="Obrigatório para criar o criativo. Encontre em: facebook.com/[sua-página]/about → ID da Página"
        >
          <Input
            value={form.facebook_page_id ?? ""}
            onChange={(e) => set("facebook_page_id", e.target.value.replace(/\D/g, ""))}
            placeholder="Ex: 123456789012345"
            className="h-9 text-sm font-mono"
          />
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
            className={cn("h-9 text-sm", errors.campaign_name && "border-destructive")}
          />
          {errors.campaign_name && <p className="text-xs text-destructive">{errors.campaign_name}</p>}
        </FieldRow>

        <FieldRow label="Objetivo">
          <Select value={form.objective} onValueChange={(v) => set("objective", v as AgentFormData["objective"])}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OBJECTIVES.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>

        <div className="grid grid-cols-2 gap-2">
          <FieldRow label="Tipo de Orçamento">
            <Select value={form.budget_type} onValueChange={(v) => set("budget_type", v as "daily" | "total")}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Diário</SelectItem>
                <SelectItem value="total">Total da campanha</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>

          <FieldRow label="Valor (R$)" required>
            <Input
              type="number"
              min={1}
              value={form.budget_amount}
              onChange={(e) => set("budget_amount", parseFloat(e.target.value) || 0)}
              className={cn("h-9 text-sm", errors.budget_amount && "border-destructive")}
            />
            {errors.budget_amount && <p className="text-xs text-destructive">{errors.budget_amount}</p>}
          </FieldRow>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <FieldRow label="Data de Início" required>
            <Input
              type="date"
              value={form.start_date}
              onChange={(e) => set("start_date", e.target.value)}
              className={cn("h-9 text-sm", errors.start_date && "border-destructive")}
            />
          </FieldRow>

          <FieldRow label="Data de Fim">
            <Input
              type="date"
              value={form.end_date ?? ""}
              onChange={(e) => set("end_date", e.target.value || undefined)}
              min={form.start_date}
              className="h-9 text-sm"
            />
          </FieldRow>
        </div>

        {isSection2Done && (
          <Button type="button" size="sm" className="w-full h-8 text-xs" onClick={() => setOpenSection(3)}>
            Próximo
          </Button>
        )}
      </FormSection>

      {/* Section 3: Público */}
      <FormSection
        icon={<Users className="h-3.5 w-3.5" />}
        title="Público-Alvo"
        step={3}
        open={openSection === 3}
        onToggle={() => setOpenSection(openSection === 3 ? 0 : 3)}
        completed={isSection3Done}
      >
        <FieldRow
          label="Descrição do Público"
          required
          hint="Descreva o público em português. O agente irá interpretá-lo e converter para targeting da Meta."
        >
          <Textarea
            value={form.audience_description}
            onChange={(e) => set("audience_description", e.target.value)}
            placeholder="Ex: Mulheres de 25 a 40 anos interessadas em moda e beleza, que seguem marcas de luxo"
            rows={3}
            className={cn("text-sm", errors.audience_description && "border-destructive")}
          />
          {errors.audience_description && <p className="text-xs text-destructive">{errors.audience_description}</p>}
        </FieldRow>

        <FieldRow label="Localização" required hint="Cidades, estados ou países separados por vírgula">
          <Input
            value={form.locations}
            onChange={(e) => set("locations", e.target.value)}
            placeholder="Ex: São Paulo, Rio de Janeiro"
            className={cn("h-9 text-sm", errors.locations && "border-destructive")}
          />
        </FieldRow>

        <div className="grid grid-cols-2 gap-2">
          <FieldRow label="Idade Mínima">
            <Input
              type="number"
              min={13}
              max={65}
              value={form.age_min}
              onChange={(e) => set("age_min", parseInt(e.target.value) || 18)}
              className="h-9 text-sm"
            />
          </FieldRow>

          <FieldRow label="Idade Máxima">
            <Input
              type="number"
              min={form.age_min}
              max={65}
              value={form.age_max}
              onChange={(e) => set("age_max", parseInt(e.target.value) || 65)}
              className="h-9 text-sm"
            />
          </FieldRow>
        </div>

        <FieldRow label="Gênero">
          <div className="flex items-center gap-4">
            {[
              { value: "all", label: "Todos" },
              { value: "male", label: "Masculino" },
              { value: "female", label: "Feminino" },
            ].map((g) => (
              <label key={g.value} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={g.value === "all" ? form.genders.includes("all") : (form.genders.includes(g.value) && !form.genders.includes("all"))}
                  onCheckedChange={(checked) => {
                    if (g.value === "all") {
                      set("genders", checked ? ["all"] : []);
                    } else {
                      const current = form.genders.filter((v) => v !== "all");
                      if (checked) {
                        set("genders", [...current, g.value]);
                      } else {
                        set("genders", current.filter((v) => v !== g.value));
                      }
                    }
                  }}
                />
                <span className="text-sm">{g.label}</span>
              </label>
            ))}
          </div>
        </FieldRow>

        {isSection3Done && (
          <Button type="button" size="sm" className="w-full h-8 text-xs" onClick={() => setOpenSection(4)}>
            Próximo
          </Button>
        )}
      </FormSection>

      {/* Section 4: Criativo */}
      <FormSection
        icon={<Image className="h-3.5 w-3.5" />}
        title="Criativo do Anúncio"
        step={4}
        open={openSection === 4}
        onToggle={() => setOpenSection(openSection === 4 ? 0 : 4)}
        completed={isSection4Done}
      >
        <FieldRow label="Imagem do Anúncio" required>
          {/* Confirmed image preview — shown when image is set, regardless of mode */}
          {imageUrl && imagePreview && (
            <div className="relative rounded-xl overflow-hidden border border-border group mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt="Imagem do anúncio" className="w-full h-44 object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs bg-background/90"
                  onClick={() => { setImageUrl(null); setImagePreview(null); setImageMode("upload"); }}
                  disabled={disabled}
                >
                  <Upload className="h-3 w-3" />Trocar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 gap-1.5 text-xs bg-meta-blue/90 text-white hover:bg-meta-blue"
                  onClick={() => { setImageUrl(null); setImagePreview(null); setImageMode("generate"); }}
                  disabled={disabled}
                >
                  <Wand2 className="h-3 w-3" />Regerar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="h-8 w-8 p-0"
                  onClick={() => { setImageUrl(null); setImagePreview(null); }}
                  disabled={disabled}
                >
                  <XIcon className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Mode tabs + content — shown when no image is confirmed */}
          {!imageUrl && (
            <div className="space-y-2">
              <div className="flex rounded-lg border border-border p-0.5 bg-muted/30">
                {([
                  { value: "upload" as const, label: "Upload", icon: <Upload className="h-3.5 w-3.5" /> },
                  { value: "generate" as const, label: "Prompt para IA", icon: <Wand2 className="h-3.5 w-3.5" /> },
                ] as const).map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setImageMode(m.value)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                      imageMode === m.value
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    disabled={disabled}
                  >
                    {m.icon}
                    {m.label}
                  </button>
                ))}
              </div>

              {imageMode === "upload" && (
                <ImageUpload
                  onUpload={(url, preview) => {
                    setImageUrl(url);
                    setImagePreview(preview);
                    setErrors((prev) => ({ ...prev, image: undefined }));
                  }}
                  onClear={() => { setImageUrl(null); setImagePreview(null); }}
                  imageUrl={imageUrl}
                  disabled={disabled}
                />
              )}

              {imageMode === "generate" && (
                <ImageGenerator
                  initialPrompt={buildImagePrompt(form)}
                  onAccept={(url, preview) => {
                    setImageUrl(url);
                    setImagePreview(preview);
                    setErrors((prev) => ({ ...prev, image: undefined }));
                  }}
                  disabled={disabled}
                />
              )}
            </div>
          )}

          {errors.image && (
            <p className="text-xs text-destructive flex items-center gap-1 mt-1">
              <AlertCircle className="h-3 w-3" />
              {errors.image}
            </p>
          )}
        </FieldRow>

        <FieldRow label="Título" required hint="Máximo 40 caracteres">
          <div className="relative">
            <Input
              value={form.headline}
              onChange={(e) => set("headline", e.target.value.slice(0, 40))}
              placeholder="Ex: Descubra nossa nova coleção"
              className={cn("h-9 text-sm pr-12", errors.headline && "border-destructive")}
            />
            <span className={cn(
              "absolute right-3 top-1/2 -translate-y-1/2 text-[11px] tabular-nums",
              form.headline.length > 35 ? "text-warning" : "text-muted-foreground"
            )}>
              {form.headline.length}/40
            </span>
          </div>
          {errors.headline && <p className="text-xs text-destructive">{errors.headline}</p>}
        </FieldRow>

        <FieldRow label="Texto Principal" required hint="Máximo 125 caracteres">
          <div className="relative">
            <Textarea
              value={form.primary_text}
              onChange={(e) => set("primary_text", e.target.value.slice(0, 125))}
              placeholder="Ex: Aproveite os melhores produtos com frete grátis para todo o Brasil!"
              rows={3}
              className={cn("text-sm pr-16", errors.primary_text && "border-destructive")}
            />
            <span className={cn(
              "absolute right-3 top-3 text-[11px] tabular-nums",
              form.primary_text.length > 110 ? "text-warning" : "text-muted-foreground"
            )}>
              {form.primary_text.length}/125
            </span>
          </div>
          {errors.primary_text && <p className="text-xs text-destructive">{errors.primary_text}</p>}
        </FieldRow>

        <FieldRow label="Descrição" hint="Máximo 30 caracteres (opcional)">
          <div className="relative">
            <Input
              value={form.description}
              onChange={(e) => set("description", e.target.value.slice(0, 30))}
              placeholder="Ex: Frete grátis"
              className="h-9 text-sm pr-12"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground tabular-nums">
              {form.description.length}/30
            </span>
          </div>
        </FieldRow>

        <div className="grid grid-cols-2 gap-2">
          <FieldRow label="Botão (CTA)">
            <Select value={form.cta} onValueChange={(v) => set("cta", v as AgentFormData["cta"])}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CTA_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          <FieldRow label="URL de Destino" required>
            <Input
              value={form.destination_url}
              onChange={(e) => set("destination_url", e.target.value)}
              placeholder="https://..."
              className={cn("h-9 text-sm", errors.destination_url && "border-destructive")}
            />
            {errors.destination_url && <p className="text-xs text-destructive">{errors.destination_url}</p>}
          </FieldRow>
        </div>

        {isSection4Done && (
          <Button type="button" size="sm" className="w-full h-8 text-xs" onClick={() => setOpenSection(5)}>
            Próximo
          </Button>
        )}
      </FormSection>

      {/* Section 5: Posicionamentos */}
      <FormSection
        icon={<LayoutGrid className="h-3.5 w-3.5" />}
        title="Posicionamentos"
        step={5}
        open={openSection === 5}
        onToggle={() => setOpenSection(openSection === 5 ? 0 : 5)}
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
            {errors.placements && <p className="text-xs text-destructive">{errors.placements}</p>}
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
