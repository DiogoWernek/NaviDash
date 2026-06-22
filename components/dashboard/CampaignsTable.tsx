"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  ChevronDown,
  ChevronRight,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  Video,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatRoas,
  cn,
} from "@/lib/utils";
import type { Campaign, AdSet, Ad, FilterState } from "@/types";
import { AdDetailsModal } from "./AdDetailsModal";

interface CampaignsTableProps {
  campaigns: Campaign[];
  loading?: boolean;
  currentFilters?: FilterState | null;
}

type SortKey = "name" | "spend" | "budget" | "impressions" | "clicks" | "ctr" | "cpm" | "cpa" | "roas"
  | "resultado" | "custo_resultado" | "updated_at"
  | "messaging_conversations" | "cost_per_conversation"
  | "leads_form" | "cost_per_lead_form" | "cost_per_thruplay" | "cost_per_landing_page_view"
  | "post_reactions" | "post_comments" | "post_shares" | "follows" | "profile_visits";
type SortDir = "asc" | "desc";
type StatusFilter = "all" | "ACTIVE" | "PAUSED" | "ARCHIVED";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativo",
  PAUSED: "Pausado",
  ARCHIVED: "Arquivado",
};

const STATUS_VARIANTS: Record<string, "active" | "paused" | "archived"> = {
  ACTIVE: "active",
  PAUSED: "paused",
  ARCHIVED: "archived",
};

const OBJECTIVE_LABELS: Record<string, string> = {
  CONVERSIONS: "Conversões",
  BRAND_AWARENESS: "Reconhecimento",
  APP_INSTALLS: "Instalações",
  LEAD_GENERATION: "Leads",
  TRAFFIC: "Tráfego",
  ENGAGEMENT: "Engajamento",
  VIDEO_VIEWS: "Visualizações",
  MESSAGES: "Mensagens",
  OUTCOME_ENGAGEMENT: "Engajamento",
  OUTCOME_LEADS: "Leads",
  OUTCOME_TRAFFIC: "Tráfego",
  OUTCOME_SALES: "Vendas",
  OUTCOME_APP_PROMOTION: "App",
  OUTCOME_AWARENESS: "Reconhecimento",
};

const PAGE_SIZE = 20;

// ── Helpers: Resultado e Custo/Resultado por objetivo ────────────────────────

function getResultadoLabel(objective: string): string {
  const obj = objective.toUpperCase();
  if (obj.includes("LEAD")) return "Leads";
  if (obj === "MESSAGES") return "Conversas";
  if (obj.includes("TRAFFIC")) return "Cliques LP";
  if (obj.includes("VIDEO") || (obj.includes("AWARENESS") && !obj.includes("BRAND"))) return "ThruPlays";
  if (obj === "APP_INSTALLS" || obj.includes("APP_PROMOTION")) return "Instalações";
  if (obj === "ENGAGEMENT" || obj.includes("OUTCOME_ENGAGEMENT")) return "Engajamentos";
  return "Compras";
}

function getResultadoValue(
  item: Pick<Campaign, "conversions" | "leads_form" | "messaging_conversations" | "clicks">,
  objective: string
): number | null {
  const obj = objective.toUpperCase();
  if (obj.includes("LEAD")) return item.leads_form ?? null;
  if (obj === "MESSAGES") return item.messaging_conversations ?? null;
  if (obj.includes("TRAFFIC")) return item.clicks ?? null;
  return item.conversions ?? null;
}

function getCustoResultadoValue(
  item: Pick<Campaign, "cost_per_result" | "cpa" | "cost_per_lead_form" | "cost_per_conversation" | "cost_per_landing_page_view" | "cost_per_thruplay">,
  objective: string
): number | null {
  if (item.cost_per_result) return item.cost_per_result;
  const obj = objective.toUpperCase();
  if (obj.includes("LEAD")) return item.cost_per_lead_form ?? null;
  if (obj === "MESSAGES") return item.cost_per_conversation ?? null;
  if (obj.includes("TRAFFIC")) return item.cost_per_landing_page_view ?? null;
  if (obj.includes("VIDEO") || obj.includes("AWARENESS")) return item.cost_per_thruplay ?? null;
  return item.cpa ?? null;
}

function getAdSetResultadoValue(adset: AdSet, objective: string): number | null {
  return getResultadoValue(
    { conversions: adset.conversions, leads_form: adset.leads_form, messaging_conversations: adset.messaging_conversations, clicks: adset.clicks },
    objective
  );
}

function getAdSetCustoResultadoValue(adset: AdSet, objective: string): number | null {
  return getCustoResultadoValue(
    { cost_per_result: adset.cost_per_result, cpa: adset.cpa, cost_per_lead_form: adset.cost_per_lead_form, cost_per_conversation: adset.cost_per_conversation, cost_per_landing_page_view: adset.cost_per_landing_page_view, cost_per_thruplay: adset.cost_per_thruplay },
    objective
  );
}

function getAdResultadoValue(ad: Ad, objective: string): number | null {
  return getResultadoValue(
    { conversions: ad.conversions, leads_form: ad.leads_form, messaging_conversations: ad.messaging_conversations, clicks: ad.clicks },
    objective
  );
}

function getAdCustoResultadoValue(ad: Ad, objective: string): number | null {
  return getCustoResultadoValue(
    { cost_per_result: undefined, cpa: ad.cpa, cost_per_lead_form: ad.cost_per_lead_form, cost_per_conversation: ad.cost_per_conversation, cost_per_landing_page_view: ad.cost_per_landing_page_view, cost_per_thruplay: ad.cost_per_thruplay },
    objective
  );
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

// ── Sort button ───────────────────────────────────────────────────────────────

function SortButton({ column, sortKey, sortDir, onSort }: {
  column: SortKey; sortKey: SortKey; sortDir: SortDir; onSort: (key: SortKey) => void;
}) {
  return (
    <button onClick={() => onSort(column)} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
      {sortKey === column ? (
        sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}

// ── AdSet + Ad rows ───────────────────────────────────────────────────────────

function AdSetRows({ adsets, loadingAdsets, accountId, objective, onAdAction }: {
  adsets: AdSet[];
  loadingAdsets: boolean;
  accountId: string;
  objective: string;
  onAdAction: (metaAdId: string, adName: string) => void;
}) {
  const [expandedAdSets, setExpandedAdSets] = useState<Set<string>>(new Set());

  function toggleAdSet(id: string) {
    setExpandedAdSets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (loadingAdsets) {
    return (
      <tr>
        <td colSpan={26} className="px-8 py-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Carregando conjuntos de anúncios...
          </div>
        </td>
      </tr>
    );
  }

  return (
    <>
      {adsets.map((adset) => {
        const isExpanded = expandedAdSets.has(adset.id);
        const resultado = getAdSetResultadoValue(adset, objective);
        const custoResultado = getAdSetCustoResultadoValue(adset, objective);
        return (
          <React.Fragment key={adset.id}>
            <tr
              className="border-b border-border/40 bg-muted/5 cursor-pointer transition-colors hover:bg-muted/15"
              onClick={() => toggleAdSet(adset.id)}
            >
              {/* Ações */}
              <td className="pl-4 pr-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-30 cursor-not-allowed" disabled>
                  <Video className="h-3.5 w-3.5" />
                </Button>
              </td>
              {/* Nome */}
              <td className="py-2 pr-3" style={{ paddingLeft: "40px" }}>
                <div className="flex items-center gap-2">
                  {adset.ads && adset.ads.length > 0 ? (
                    isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  ) : <div className="w-3.5" />}
                  <span className="text-xs font-medium truncate max-w-[200px]">{adset.name}</span>
                </div>
              </td>
              {/* Status (vazio) */}
              <td className="px-3 py-2" />
              {/* Última Edição (vazio) */}
              <td className="px-3 py-2" />
              {/* Objetivo (vazio) */}
              <td className="px-3 py-2" />
              {/* Resultado */}
              <td className="px-3 py-2 text-right">
                <span className="font-mono text-xs">{resultado !== null ? formatNumber(resultado) : <span className="text-muted-foreground">—</span>}</span>
              </td>
              {/* Custo/Resultado */}
              <td className="px-3 py-2 text-right">
                <span className="font-mono text-xs text-muted-foreground">{custoResultado ? formatCurrency(custoResultado) : "—"}</span>
              </td>
              {/* Orçamento */}
              <td className="px-3 py-2 text-right"><span className="font-mono text-xs">—</span></td>
              {/* Gasto */}
              <td className="px-3 py-2 text-right"><span className="font-mono text-xs font-semibold">{formatCurrency(adset.spend)}</span></td>
              {/* Impressões */}
              <td className="px-3 py-2 text-right"><span className="font-mono text-xs">{formatNumber(adset.impressions)}</span></td>
              {/* Cliques */}
              <td className="px-3 py-2 text-right"><span className="font-mono text-xs">{formatNumber(adset.clicks)}</span></td>
              {/* CTR */}
              <td className="px-3 py-2 text-right"><span className="font-mono text-xs">{formatPercent(adset.ctr)}</span></td>
              {/* CPM */}
              <td className="px-3 py-2 text-right"><span className="font-mono text-xs">{formatCurrency(adset.cpm)}</span></td>
              {/* CPA */}
              <td className="px-3 py-2 text-right">
                <span className="font-mono text-xs">{adset.cpa ? formatCurrency(adset.cpa) : "—"}</span>
              </td>
              {/* ROAS */}
              <td className="px-3 py-2 pr-4 text-right"><span className="font-mono text-xs">{adset.roas > 0 ? formatRoas(adset.roas) : <span className="text-muted-foreground">—</span>}</span></td>
              {/* Conversas */}
              <td className="px-3 py-2 text-right"><span className="font-mono text-xs">{adset.messaging_conversations ? formatNumber(adset.messaging_conversations) : <span className="text-muted-foreground">—</span>}</span></td>
              {/* C/Conversa */}
              <td className="px-3 py-2 text-right"><span className="font-mono text-xs text-muted-foreground">{adset.cost_per_conversation ? formatCurrency(adset.cost_per_conversation) : "—"}</span></td>
              {/* Leads Form. */}
              <td className="px-3 py-2 text-right"><span className="font-mono text-xs">{adset.leads_form ? formatNumber(adset.leads_form) : <span className="text-muted-foreground">—</span>}</span></td>
              {/* C/Lead Form. */}
              <td className="px-3 py-2 text-right"><span className="font-mono text-xs text-muted-foreground">{adset.cost_per_lead_form ? formatCurrency(adset.cost_per_lead_form) : "—"}</span></td>
              {/* C/ThruPlay */}
              <td className="px-3 py-2 text-right"><span className="font-mono text-xs text-muted-foreground">{adset.cost_per_thruplay ? formatCurrency(adset.cost_per_thruplay) : "—"}</span></td>
              {/* C/Pág. Site */}
              <td className="px-3 py-2 text-right"><span className="font-mono text-xs text-muted-foreground">{adset.cost_per_landing_page_view ? formatCurrency(adset.cost_per_landing_page_view) : "—"}</span></td>
              {/* Reações */}
              <td className="px-3 py-2 text-right"><span className="font-mono text-xs">{adset.post_reactions ? formatNumber(adset.post_reactions) : <span className="text-muted-foreground">—</span>}</span></td>
              {/* Comentários */}
              <td className="px-3 py-2 text-right"><span className="font-mono text-xs">{adset.post_comments ? formatNumber(adset.post_comments) : <span className="text-muted-foreground">—</span>}</span></td>
              {/* Compartilh. */}
              <td className="px-3 py-2 text-right"><span className="font-mono text-xs">{adset.post_shares ? formatNumber(adset.post_shares) : <span className="text-muted-foreground">—</span>}</span></td>
              {/* Seguidores */}
              <td className="px-3 py-2 text-right"><span className="font-mono text-xs">{adset.follows ? formatNumber(adset.follows) : <span className="text-muted-foreground">—</span>}</span></td>
              {/* Vis. Perfil */}
              <td className="px-3 py-2 text-right"><span className="font-mono text-xs">{adset.profile_visits ? formatNumber(adset.profile_visits) : <span className="text-muted-foreground">—</span>}</span></td>
            </tr>
            {isExpanded && adset.ads?.map((ad) => {
              const adResultado = getAdResultadoValue(ad, objective);
              const adCusto = getAdCustoResultadoValue(ad, objective);
              return (
                <tr key={ad.id} className="border-b border-border/30 bg-muted/10 transition-colors hover:bg-muted/20">
                  {/* Ações */}
                  <td className="pl-4 pr-2 py-2 text-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-meta-blue hover:bg-meta-blue/10"
                          onClick={() => onAdAction(ad.id, ad.name)}
                        >
                          <Video className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="text-xs">Métricas de Vídeo &amp; Prévia do Criativo</TooltipContent>
                    </Tooltip>
                  </td>
                  {/* Nome */}
                  <td className="py-2 pr-3" style={{ paddingLeft: "60px" }}>
                    <div className="flex items-center gap-2">
                      <div className="h-1 w-1 rounded-full bg-muted-foreground/40 shrink-0" />
                      <span className="text-xs text-muted-foreground truncate max-w-[190px]">{ad.name}</span>
                    </div>
                  </td>
                  {/* Status (vazio) */}
                  <td className="px-3 py-2" />
                  {/* Última Edição (vazio) */}
                  <td className="px-3 py-2" />
                  {/* Objetivo (vazio) */}
                  <td className="px-3 py-2" />
                  {/* Resultado */}
                  <td className="px-3 py-2 text-right">
                    <span className="font-mono text-xs">{adResultado !== null ? formatNumber(adResultado) : <span className="text-muted-foreground">—</span>}</span>
                  </td>
                  {/* Custo/Resultado */}
                  <td className="px-3 py-2 text-right">
                    <span className="font-mono text-xs text-muted-foreground">{adCusto ? formatCurrency(adCusto) : "—"}</span>
                  </td>
                  {/* Orçamento */}
                  <td className="px-3 py-2 text-right"><span className="font-mono text-xs">—</span></td>
                  {/* Gasto */}
                  <td className="px-3 py-2 text-right"><span className="font-mono text-xs">{formatCurrency(ad.spend)}</span></td>
                  {/* Impressões */}
                  <td className="px-3 py-2 text-right"><span className="font-mono text-xs">{formatNumber(ad.impressions)}</span></td>
                  {/* Cliques */}
                  <td className="px-3 py-2 text-right"><span className="font-mono text-xs">{formatNumber(ad.clicks)}</span></td>
                  {/* CTR */}
                  <td className="px-3 py-2 text-right"><span className="font-mono text-xs">{formatPercent(ad.ctr)}</span></td>
                  {/* CPM */}
                  <td className="px-3 py-2 text-right"><span className="font-mono text-xs">{formatCurrency(ad.cpm)}</span></td>
                  {/* CPA */}
                  <td className="px-3 py-2 text-right"><span className="font-mono text-xs">{ad.cpa ? formatCurrency(ad.cpa) : "—"}</span></td>
                  {/* ROAS */}
                  <td className="px-3 py-2 pr-4 text-right"><span className="font-mono text-xs">{ad.roas > 0 ? formatRoas(ad.roas) : <span className="text-muted-foreground">—</span>}</span></td>
                  {/* Conversas */}
                  <td className="px-3 py-2 text-right"><span className="font-mono text-xs">{ad.messaging_conversations ? formatNumber(ad.messaging_conversations) : <span className="text-muted-foreground">—</span>}</span></td>
                  {/* C/Conversa */}
                  <td className="px-3 py-2 text-right"><span className="font-mono text-xs text-muted-foreground">{ad.cost_per_conversation ? formatCurrency(ad.cost_per_conversation) : "—"}</span></td>
                  {/* Leads Form. */}
                  <td className="px-3 py-2 text-right"><span className="font-mono text-xs">{ad.leads_form ? formatNumber(ad.leads_form) : <span className="text-muted-foreground">—</span>}</span></td>
                  {/* C/Lead Form. */}
                  <td className="px-3 py-2 text-right"><span className="font-mono text-xs text-muted-foreground">{ad.cost_per_lead_form ? formatCurrency(ad.cost_per_lead_form) : "—"}</span></td>
                  {/* C/ThruPlay */}
                  <td className="px-3 py-2 text-right"><span className="font-mono text-xs text-muted-foreground">{ad.cost_per_thruplay ? formatCurrency(ad.cost_per_thruplay) : "—"}</span></td>
                  {/* C/Pág. Site */}
                  <td className="px-3 py-2 text-right"><span className="font-mono text-xs text-muted-foreground">{ad.cost_per_landing_page_view ? formatCurrency(ad.cost_per_landing_page_view) : "—"}</span></td>
                  {/* Reações */}
                  <td className="px-3 py-2 text-right"><span className="font-mono text-xs">{ad.post_reactions ? formatNumber(ad.post_reactions) : <span className="text-muted-foreground">—</span>}</span></td>
                  {/* Comentários */}
                  <td className="px-3 py-2 text-right"><span className="font-mono text-xs">{ad.post_comments ? formatNumber(ad.post_comments) : <span className="text-muted-foreground">—</span>}</span></td>
                  {/* Compartilh. */}
                  <td className="px-3 py-2 text-right"><span className="font-mono text-xs">{ad.post_shares ? formatNumber(ad.post_shares) : <span className="text-muted-foreground">—</span>}</span></td>
                  {/* Seguidores */}
                  <td className="px-3 py-2 text-right"><span className="font-mono text-xs">{ad.follows ? formatNumber(ad.follows) : <span className="text-muted-foreground">—</span>}</span></td>
                  {/* Vis. Perfil */}
                  <td className="px-3 py-2 text-right"><span className="font-mono text-xs">{ad.profile_visits ? formatNumber(ad.profile_visits) : <span className="text-muted-foreground">—</span>}</span></td>
                </tr>
              );
            })}
          </React.Fragment>
        );
      })}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CampaignsTable({ campaigns, loading, currentFilters }: CampaignsTableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [adsetCache, setAdsetCache] = useState<Record<string, AdSet[]>>({});
  const [loadingAdsets, setLoadingAdsets] = useState<Set<string>>(new Set());
  const [selectedAd, setSelectedAd] = useState<{ metaAdId: string; adName: string; accountId: string } | null>(null);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const fetchAdsets = useCallback(async (campaignId: string, accountId: string, objective: string) => {
    if (adsetCache[campaignId] !== undefined) return;
    if (!currentFilters) return;

    setLoadingAdsets((prev) => new Set(prev).add(campaignId));
    try {
      const params = new URLSearchParams({
        campaignId,
        accountId,
        objective,
        startDate: currentFilters.dateRange.from.toISOString().split("T")[0],
        endDate: currentFilters.dateRange.to.toISOString().split("T")[0],
      });
      const res = await fetch(`/api/adsets?${params}`);
      const data = await res.json();
      setAdsetCache((prev) => ({ ...prev, [campaignId]: data.adsets ?? [] }));
    } catch (err) {
      console.error("[CampaignsTable] Adsets error:", err);
      setAdsetCache((prev) => ({ ...prev, [campaignId]: [] }));
    } finally {
      setLoadingAdsets((prev) => { const next = new Set(prev); next.delete(campaignId); return next; });
    }
  }, [adsetCache, currentFilters]);

  function toggleCampaign(campaign: Campaign) {
    setExpandedCampaigns((prev) => {
      const next = new Set(prev);
      if (next.has(campaign.id)) {
        next.delete(campaign.id);
      } else {
        next.add(campaign.id);
        if (!campaign.adsets?.length) {
          fetchAdsets(campaign.id, campaign.account_id, campaign.objective);
        }
      }
      return next;
    });
  }

  const filteredAndSorted = useMemo(() => {
    let result = campaigns.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

    result = [...result].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
      if (sortKey === "budget") return ((a.budget ?? 0) - (b.budget ?? 0)) * dir;
      if (sortKey === "cpa") return ((a.cpa ?? 0) - (b.cpa ?? 0)) * dir;
      if (sortKey === "resultado") return ((getResultadoValue(a, a.objective) ?? 0) - (getResultadoValue(b, b.objective) ?? 0)) * dir;
      if (sortKey === "custo_resultado") return ((getCustoResultadoValue(a, a.objective) ?? 0) - (getCustoResultadoValue(b, b.objective) ?? 0)) * dir;
      if (sortKey === "updated_at") return ((a.updated_at ?? "").localeCompare(b.updated_at ?? "")) * dir;
      const aVal = Number(a[sortKey as keyof Campaign] ?? 0);
      const bVal = Number(b[sortKey as keyof Campaign] ?? 0);
      return (aVal - bVal) * dir;
    });

    return result;
  }, [campaigns, search, sortKey, sortDir, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / PAGE_SIZE));
  const paginated = filteredAndSorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeCounts = {
    all: campaigns.length,
    ACTIVE: campaigns.filter((c) => c.status === "ACTIVE").length,
    PAUSED: campaigns.filter((c) => c.status === "PAUSED").length,
    ARCHIVED: campaigns.filter((c) => c.status === "ARCHIVED").length,
  };

  const thClass = "px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide";

  return (
    <TooltipProvider delayDuration={200}>
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 pb-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <CardTitle className="text-sm font-semibold">Campanhas</CardTitle>
            <div className="flex items-center gap-1">
              {(["all", "ACTIVE", "PAUSED"] as StatusFilter[]).map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setPage(1); }}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    statusFilter === s
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {s === "all" ? "Todas" : STATUS_LABELS[s]}
                  <span className={cn("ml-1 rounded-full px-1.5 py-0.5 text-[10px]",
                    statusFilter === s ? "bg-background" : "bg-muted"
                  )}>
                    {activeCounts[s]}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="relative w-52">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar campanha..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="h-8 pl-8 text-xs"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[2300px]">
                  <thead>
                    <tr className="border-b border-border">
                      {/* Ações */}
                      <th className="pl-4 pr-2 py-2.5 w-12 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Ações
                      </th>
                      {/* Campanha */}
                      <th className="py-2.5 pl-1 pr-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        <div className="flex items-center gap-1">
                          Campanha
                          <SortButton column="name" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        </div>
                      </th>
                      {/* Status */}
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                      {/* Última Edição */}
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        <div className="flex items-center gap-1">
                          <Tooltip><TooltipTrigger asChild><span className="cursor-help">Última Edição</span></TooltipTrigger><TooltipContent side="top" className="text-xs">Data da última alteração na campanha</TooltipContent></Tooltip>
                          <SortButton column="updated_at" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        </div>
                      </th>
                      {/* Objetivo */}
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Objetivo</th>
                      {/* Resultado */}
                      <th className={thClass}>
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild><span className="cursor-help">Resultado</span></TooltipTrigger>
                            <TooltipContent side="top" className="max-w-64 text-xs">
                              Principal resultado da campanha — varia pelo objetivo: Compras (Vendas/App), Leads (Formulário), Conversas (Mensagens), Cliques de LP (Tráfego)
                            </TooltipContent>
                          </Tooltip>
                          <SortButton column="resultado" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        </div>
                      </th>
                      {/* Custo/Resultado */}
                      <th className={thClass}>
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild><span className="cursor-help">Custo/Resultado</span></TooltipTrigger>
                            <TooltipContent side="top" className="max-w-64 text-xs">
                              Custo por Resultado — varia pelo objetivo: Compras (Vendas), Leads (Formulário), Conversas (Mensagens), Visualizações LP (Tráfego)
                            </TooltipContent>
                          </Tooltip>
                          <SortButton column="custo_resultado" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        </div>
                      </th>
                      {/* Orçamento */}
                      <th className={thClass}>
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip><TooltipTrigger asChild><span className="cursor-help">Orçamento</span></TooltipTrigger><TooltipContent side="top" className="text-xs">Orçamento diário da campanha</TooltipContent></Tooltip>
                          <SortButton column="budget" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        </div>
                      </th>
                      {/* Gasto */}
                      <th className={thClass}>
                        <div className="flex items-center justify-end gap-1">Gasto <SortButton column="spend" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} /></div>
                      </th>
                      {/* Impressões */}
                      <th className={thClass}>
                        <div className="flex items-center justify-end gap-1">Impressões <SortButton column="impressions" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} /></div>
                      </th>
                      {/* Cliques */}
                      <th className={thClass}>
                        <div className="flex items-center justify-end gap-1">Cliques <SortButton column="clicks" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} /></div>
                      </th>
                      {/* CTR */}
                      <th className={thClass}>
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip><TooltipTrigger asChild><span className="cursor-help">CTR</span></TooltipTrigger><TooltipContent side="top" className="max-w-48 text-xs">Taxa de Clique — % que viram e clicaram</TooltipContent></Tooltip>
                          <SortButton column="ctr" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        </div>
                      </th>
                      {/* CPM */}
                      <th className={thClass}>
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip><TooltipTrigger asChild><span className="cursor-help">CPM</span></TooltipTrigger><TooltipContent side="top" className="text-xs">Custo por Mil Impressões</TooltipContent></Tooltip>
                          <SortButton column="cpm" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        </div>
                      </th>
                      {/* CPA */}
                      <th className={thClass}>
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip><TooltipTrigger asChild><span className="cursor-help">CPA</span></TooltipTrigger><TooltipContent side="top" className="max-w-52 text-xs">Custo por Aquisição — Gasto ÷ Conversões</TooltipContent></Tooltip>
                          <SortButton column="cpa" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        </div>
                      </th>
                      {/* ROAS */}
                      <th className={thClass + " pr-4"}>
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip><TooltipTrigger asChild><span className="cursor-help">ROAS</span></TooltipTrigger><TooltipContent side="top" className="max-w-52 text-xs">Retorno sobre Investimento. Acima de 1,0x = retorno positivo</TooltipContent></Tooltip>
                          <SortButton column="roas" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        </div>
                      </th>
                      {/* Conversas */}
                      <th className={thClass}>
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip><TooltipTrigger asChild><span className="cursor-help">Conversas</span></TooltipTrigger><TooltipContent side="top" className="max-w-56 text-xs">Conversas Iniciadas no WhatsApp ou Messenger</TooltipContent></Tooltip>
                          <SortButton column="messaging_conversations" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        </div>
                      </th>
                      {/* C/Conversa */}
                      <th className={thClass}>
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip><TooltipTrigger asChild><span className="cursor-help">C/Conversa</span></TooltipTrigger><TooltipContent side="top" className="max-w-56 text-xs">Custo por Conversa Iniciada (WhatsApp / Messenger)</TooltipContent></Tooltip>
                          <SortButton column="cost_per_conversation" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        </div>
                      </th>
                      {/* Leads Form. */}
                      <th className={thClass}>
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip><TooltipTrigger asChild><span className="cursor-help">Leads Form.</span></TooltipTrigger><TooltipContent side="top" className="max-w-56 text-xs">Leads Gerados via Formulário Nativo do Meta</TooltipContent></Tooltip>
                          <SortButton column="leads_form" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        </div>
                      </th>
                      {/* C/Lead Form. */}
                      <th className={thClass}>
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip><TooltipTrigger asChild><span className="cursor-help">C/Lead Form.</span></TooltipTrigger><TooltipContent side="top" className="max-w-56 text-xs">Custo por Lead via Formulário Nativo do Meta</TooltipContent></Tooltip>
                          <SortButton column="cost_per_lead_form" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        </div>
                      </th>
                      {/* C/ThruPlay */}
                      <th className={thClass}>
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip><TooltipTrigger asChild><span className="cursor-help">C/ThruPlay</span></TooltipTrigger><TooltipContent side="top" className="max-w-56 text-xs">Custo por ThruPlay — visualização completa do vídeo (ou até 15s se mais curto)</TooltipContent></Tooltip>
                          <SortButton column="cost_per_thruplay" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        </div>
                      </th>
                      {/* C/Pág. Site */}
                      <th className={thClass}>
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip><TooltipTrigger asChild><span className="cursor-help">C/Pág. Site</span></TooltipTrigger><TooltipContent side="top" className="max-w-56 text-xs">Custo por Visualização de Página do Site (rastreada pelo Pixel Meta)</TooltipContent></Tooltip>
                          <SortButton column="cost_per_landing_page_view" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        </div>
                      </th>
                      {/* Reações */}
                      <th className={thClass}>
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip><TooltipTrigger asChild><span className="cursor-help">Reações</span></TooltipTrigger><TooltipContent side="top" className="max-w-56 text-xs">Reações no post do anúncio (curtidas, amei, haha, etc.) atribuídas ao anúncio</TooltipContent></Tooltip>
                          <SortButton column="post_reactions" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        </div>
                      </th>
                      {/* Comentários */}
                      <th className={thClass}>
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip><TooltipTrigger asChild><span className="cursor-help">Comentários</span></TooltipTrigger><TooltipContent side="top" className="max-w-56 text-xs">Comentários no post do anúncio atribuídos ao anúncio</TooltipContent></Tooltip>
                          <SortButton column="post_comments" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        </div>
                      </th>
                      {/* Compartilh. */}
                      <th className={thClass}>
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip><TooltipTrigger asChild><span className="cursor-help">Compartilh.</span></TooltipTrigger><TooltipContent side="top" className="max-w-56 text-xs">Compartilhamentos do post do anúncio atribuídos ao anúncio</TooltipContent></Tooltip>
                          <SortButton column="post_shares" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        </div>
                      </th>
                      {/* Seguidores */}
                      <th className={thClass}>
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip><TooltipTrigger asChild><span className="cursor-help">Seguidores</span></TooltipTrigger><TooltipContent side="top" className="max-w-56 text-xs">Seguidores ganhos atribuídos ao anúncio</TooltipContent></Tooltip>
                          <SortButton column="follows" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        </div>
                      </th>
                      {/* Vis. Perfil */}
                      <th className={thClass}>
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip><TooltipTrigger asChild><span className="cursor-help">Vis. Perfil</span></TooltipTrigger><TooltipContent side="top" className="max-w-56 text-xs">Visitas ao Perfil do Instagram atribuídas ao anúncio</TooltipContent></Tooltip>
                          <SortButton column="profile_visits" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.length === 0 ? (
                      <tr>
                        <td colSpan={26} className="py-12 text-center text-sm text-muted-foreground">
                          Nenhuma campanha encontrada
                        </td>
                      </tr>
                    ) : (
                      paginated.map((campaign) => {
                        const isExpanded = expandedCampaigns.has(campaign.id);
                        const adsets = campaign.adsets?.length ? campaign.adsets : (adsetCache[campaign.id] ?? []);
                        const isLoadingAdsets = loadingAdsets.has(campaign.id);
                        const cpa = campaign.cpa ?? (campaign.conversions && campaign.conversions > 0 ? campaign.spend / campaign.conversions : null);
                        const resultado = getResultadoValue(campaign, campaign.objective);
                        const custoResultado = getCustoResultadoValue(campaign, campaign.objective);
                        const resultadoLabel = getResultadoLabel(campaign.objective);

                        return (
                          <React.Fragment key={campaign.id}>
                            <tr
                              className={cn("border-b border-border/60 cursor-pointer transition-colors hover:bg-muted/20", isExpanded && "bg-muted/10")}
                              onClick={() => toggleCampaign(campaign)}
                            >
                              {/* Ações */}
                              <td className="pl-4 pr-2 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-30 cursor-not-allowed" disabled>
                                        <Video className="h-3.5 w-3.5" />
                                      </Button>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="text-xs">Expanda a campanha para ver anúncios</TooltipContent>
                                </Tooltip>
                              </td>
                              {/* Nome */}
                              <td className="py-3 pl-1 pr-3">
                                <div className="flex items-center gap-2">
                                  {isExpanded
                                    ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                                    : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                                  <span className="text-sm font-medium truncate max-w-[200px]">{campaign.name}</span>
                                </div>
                              </td>
                              {/* Status */}
                              <td className="px-3 py-3">
                                <Badge variant={STATUS_VARIANTS[campaign.status] ?? "outline"}>
                                  {STATUS_LABELS[campaign.status] ?? campaign.status}
                                </Badge>
                              </td>
                              {/* Última Edição */}
                              <td className="px-3 py-3">
                                <span className="font-mono text-xs text-muted-foreground">
                                  {formatDate(campaign.updated_at)}
                                </span>
                              </td>
                              {/* Objetivo */}
                              <td className="px-3 py-3">
                                <span className="text-xs text-muted-foreground">
                                  {OBJECTIVE_LABELS[campaign.objective] ?? campaign.objective}
                                </span>
                              </td>
                              {/* Resultado */}
                              <td className="px-3 py-3 text-right">
                                {resultado !== null ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="font-mono text-sm font-semibold cursor-default">
                                        {formatNumber(resultado)}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="text-xs">{resultadoLabel}</TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <span className="font-mono text-sm text-muted-foreground">—</span>
                                )}
                              </td>
                              {/* Custo/Resultado */}
                              <td className="px-3 py-3 text-right">
                                <span className="font-mono text-sm text-muted-foreground">
                                  {custoResultado ? formatCurrency(custoResultado) : "—"}
                                </span>
                              </td>
                              {/* Orçamento */}
                              <td className="px-3 py-3 text-right">
                                <span className="font-mono text-sm text-muted-foreground">
                                  {campaign.budget ? formatCurrency(campaign.budget) : "—"}
                                </span>
                              </td>
                              {/* Gasto */}
                              <td className="px-3 py-3 text-right">
                                <span className={cn("font-mono text-sm font-semibold", campaign.spend === 0 && "text-muted-foreground")}>
                                  {formatCurrency(campaign.spend)}
                                </span>
                              </td>
                              {/* Impressões */}
                              <td className="px-3 py-3 text-right">
                                <span className="font-mono text-sm">
                                  {campaign.spend === 0 ? <span className="text-muted-foreground">—</span> : formatNumber(campaign.impressions)}
                                </span>
                              </td>
                              {/* Cliques */}
                              <td className="px-3 py-3 text-right">
                                <span className="font-mono text-sm">
                                  {campaign.spend === 0 ? <span className="text-muted-foreground">—</span> : formatNumber(campaign.clicks)}
                                </span>
                              </td>
                              {/* CTR */}
                              <td className="px-3 py-3 text-right">
                                <span className="font-mono text-sm">
                                  {campaign.spend === 0 ? <span className="text-muted-foreground">—</span> : formatPercent(campaign.ctr)}
                                </span>
                              </td>
                              {/* CPM */}
                              <td className="px-3 py-3 text-right">
                                <span className="font-mono text-sm">
                                  {campaign.spend === 0 ? <span className="text-muted-foreground">—</span> : formatCurrency(campaign.cpm)}
                                </span>
                              </td>
                              {/* CPA */}
                              <td className="px-3 py-3 text-right">
                                <span className="font-mono text-sm text-muted-foreground">
                                  {cpa !== null ? formatCurrency(cpa) : "—"}
                                </span>
                              </td>
                              {/* ROAS */}
                              <td className="px-3 py-3 pr-4 text-right">
                                {campaign.spend === 0 || campaign.roas === 0 ? (
                                  <span className="font-mono text-sm text-muted-foreground">—</span>
                                ) : (
                                  <span className={cn("font-mono text-sm font-semibold",
                                    campaign.roas >= 3 ? "text-success" : campaign.roas >= 1 ? "text-foreground" : "text-danger"
                                  )}>
                                    {formatRoas(campaign.roas)}
                                  </span>
                                )}
                              </td>
                              {/* Conversas */}
                              <td className="px-3 py-3 text-right">
                                <span className="font-mono text-sm">
                                  {campaign.messaging_conversations ? formatNumber(campaign.messaging_conversations) : <span className="text-muted-foreground">—</span>}
                                </span>
                              </td>
                              {/* C/Conversa */}
                              <td className="px-3 py-3 text-right">
                                <span className="font-mono text-sm text-muted-foreground">
                                  {campaign.cost_per_conversation ? formatCurrency(campaign.cost_per_conversation) : "—"}
                                </span>
                              </td>
                              {/* Leads Form. */}
                              <td className="px-3 py-3 text-right">
                                <span className="font-mono text-sm">
                                  {campaign.leads_form ? formatNumber(campaign.leads_form) : <span className="text-muted-foreground">—</span>}
                                </span>
                              </td>
                              {/* C/Lead Form. */}
                              <td className="px-3 py-3 text-right">
                                <span className="font-mono text-sm text-muted-foreground">
                                  {campaign.cost_per_lead_form ? formatCurrency(campaign.cost_per_lead_form) : "—"}
                                </span>
                              </td>
                              {/* C/ThruPlay */}
                              <td className="px-3 py-3 text-right">
                                <span className="font-mono text-sm text-muted-foreground">
                                  {campaign.cost_per_thruplay ? formatCurrency(campaign.cost_per_thruplay) : "—"}
                                </span>
                              </td>
                              {/* C/Pág. Site */}
                              <td className="px-3 py-3 text-right">
                                <span className="font-mono text-sm text-muted-foreground">
                                  {campaign.cost_per_landing_page_view ? formatCurrency(campaign.cost_per_landing_page_view) : "—"}
                                </span>
                              </td>
                              {/* Reações */}
                              <td className="px-3 py-3 text-right">
                                <span className="font-mono text-sm">{campaign.post_reactions ? formatNumber(campaign.post_reactions) : <span className="text-muted-foreground">—</span>}</span>
                              </td>
                              {/* Comentários */}
                              <td className="px-3 py-3 text-right">
                                <span className="font-mono text-sm">{campaign.post_comments ? formatNumber(campaign.post_comments) : <span className="text-muted-foreground">—</span>}</span>
                              </td>
                              {/* Compartilh. */}
                              <td className="px-3 py-3 text-right">
                                <span className="font-mono text-sm">{campaign.post_shares ? formatNumber(campaign.post_shares) : <span className="text-muted-foreground">—</span>}</span>
                              </td>
                              {/* Seguidores */}
                              <td className="px-3 py-3 text-right">
                                <span className="font-mono text-sm">{campaign.follows ? formatNumber(campaign.follows) : <span className="text-muted-foreground">—</span>}</span>
                              </td>
                              {/* Vis. Perfil */}
                              <td className="px-3 py-3 text-right">
                                <span className="font-mono text-sm">{campaign.profile_visits ? formatNumber(campaign.profile_visits) : <span className="text-muted-foreground">—</span>}</span>
                              </td>
                            </tr>
                            {isExpanded && (
                              <AdSetRows
                                adsets={adsets}
                                loadingAdsets={isLoadingAdsets}
                                accountId={campaign.account_id}
                                objective={campaign.objective}
                                onAdAction={(metaAdId, adName) =>
                                  setSelectedAd({ metaAdId, adName, accountId: campaign.account_id })
                                }
                              />
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    {filteredAndSorted.length} campanhas · página {page} de {totalPages}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Anterior
                    </Button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = Math.min(Math.max(page - 2, 1) + i, totalPages - Math.min(4, totalPages - 1) + i);
                      return (
                        <Button
                          key={pageNum}
                          variant={pageNum === page ? "default" : "outline"}
                          size="sm"
                          className="h-7 w-7 text-xs p-0"
                          onClick={() => setPage(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      {selectedAd && currentFilters && (
        <AdDetailsModal
          metaAdId={selectedAd.metaAdId}
          adName={selectedAd.adName}
          accountId={selectedAd.accountId}
          startDate={currentFilters.dateRange.from.toISOString().split("T")[0]}
          endDate={currentFilters.dateRange.to.toISOString().split("T")[0]}
          onClose={() => setSelectedAd(null)}
        />
      )}
    </TooltipProvider>
  );
}
