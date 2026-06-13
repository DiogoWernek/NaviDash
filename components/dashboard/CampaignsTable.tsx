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
import type { Campaign, AdSet, FilterState } from "@/types";

interface CampaignsTableProps {
  campaigns: Campaign[];
  loading?: boolean;
  currentFilters?: FilterState | null;
}

type SortKey = "name" | "spend" | "budget" | "impressions" | "clicks" | "ctr" | "cpm" | "cpa" | "roas";
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

function AdSetRows({ adsets, loadingAdsets }: { adsets: AdSet[]; loadingAdsets: boolean }) {
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
        <td colSpan={11} className="px-8 py-3">
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
        return (
          <React.Fragment key={adset.id}>
            <tr
              className="border-b border-border/40 bg-muted/5 cursor-pointer transition-colors hover:bg-muted/15"
              onClick={() => toggleAdSet(adset.id)}
            >
              <td className="py-2 pr-3" style={{ paddingLeft: "40px" }}>
                <div className="flex items-center gap-2">
                  {adset.ads && adset.ads.length > 0 ? (
                    isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  ) : <div className="w-3.5" />}
                  <span className="text-xs font-medium truncate max-w-[200px]">{adset.name}</span>
                </div>
              </td>
              <td className="px-3 py-2" /><td className="px-3 py-2" />
              <td className="px-3 py-2 text-right"><span className="font-mono text-xs">—</span></td>
              <td className="px-3 py-2 text-right"><span className="font-mono text-xs font-semibold">{formatCurrency(adset.spend)}</span></td>
              <td className="px-3 py-2 text-right"><span className="font-mono text-xs">{formatNumber(adset.impressions)}</span></td>
              <td className="px-3 py-2 text-right"><span className="font-mono text-xs">{formatNumber(adset.clicks)}</span></td>
              <td className="px-3 py-2 text-right"><span className="font-mono text-xs">{formatPercent(adset.ctr)}</span></td>
              <td className="px-3 py-2 text-right"><span className="font-mono text-xs">{formatCurrency(adset.cpm)}</span></td>
              <td className="px-3 py-2 text-right">
                <span className="font-mono text-xs">{adset.cpa ? formatCurrency(adset.cpa) : "—"}</span>
              </td>
              <td className="px-3 py-2 pr-4 text-right"><span className="font-mono text-xs">{adset.roas > 0 ? formatRoas(adset.roas) : <span className="text-muted-foreground">—</span>}</span></td>
            </tr>
            {isExpanded && adset.ads?.map((ad) => (
              <tr key={ad.id} className="border-b border-border/30 bg-muted/10 transition-colors hover:bg-muted/20">
                <td className="py-2 pr-3" style={{ paddingLeft: "60px" }}>
                  <div className="flex items-center gap-2">
                    <div className="h-1 w-1 rounded-full bg-muted-foreground/40 shrink-0" />
                    <span className="text-xs text-muted-foreground truncate max-w-[190px]">{ad.name}</span>
                  </div>
                </td>
                <td className="px-3 py-2" /><td className="px-3 py-2" />
                <td className="px-3 py-2 text-right"><span className="font-mono text-xs">—</span></td>
                <td className="px-3 py-2 text-right"><span className="font-mono text-xs">{formatCurrency(ad.spend)}</span></td>
                <td className="px-3 py-2 text-right"><span className="font-mono text-xs">{formatNumber(ad.impressions)}</span></td>
                <td className="px-3 py-2 text-right"><span className="font-mono text-xs">{formatNumber(ad.clicks)}</span></td>
                <td className="px-3 py-2 text-right"><span className="font-mono text-xs">{formatPercent(ad.ctr)}</span></td>
                <td className="px-3 py-2 text-right"><span className="font-mono text-xs">{formatCurrency(ad.cpm)}</span></td>
                <td className="px-3 py-2 text-right"><span className="font-mono text-xs">{ad.cpa ? formatCurrency(ad.cpa) : "—"}</span></td>
                <td className="px-3 py-2 pr-4 text-right"><span className="font-mono text-xs">{ad.roas > 0 ? formatRoas(ad.roas) : <span className="text-muted-foreground">—</span>}</span></td>
              </tr>
            ))}
          </React.Fragment>
        );
      })}
    </>
  );
}

export function CampaignsTable({ campaigns, loading, currentFilters }: CampaignsTableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [adsetCache, setAdsetCache] = useState<Record<string, AdSet[]>>({});
  const [loadingAdsets, setLoadingAdsets] = useState<Set<string>>(new Set());

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const fetchAdsets = useCallback(async (campaignId: string, accountId: string) => {
    if (adsetCache[campaignId] !== undefined) return;
    if (!currentFilters) return;

    setLoadingAdsets((prev) => new Set(prev).add(campaignId));
    try {
      const params = new URLSearchParams({
        campaignId,
        accountId,
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
        // Lazy-load adsets when expanding (skip for mock data that already has adsets)
        if (!campaign.adsets?.length) {
          fetchAdsets(campaign.id, campaign.account_id);
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
      const aVal = a[sortKey as keyof Campaign] as number;
      const bVal = b[sortKey as keyof Campaign] as number;
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
            {/* Status filter tabs */}
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
                <table className="w-full min-w-[900px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-2.5 pl-4 pr-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        <div className="flex items-center gap-1">
                          Campanha
                          <SortButton column="name" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        </div>
                      </th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Objetivo</th>
                      <th className={thClass}>
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip><TooltipTrigger asChild><span className="cursor-help">Orçamento</span></TooltipTrigger><TooltipContent side="top" className="text-xs">Orçamento diário da campanha</TooltipContent></Tooltip>
                          <SortButton column="budget" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        </div>
                      </th>
                      <th className={thClass}>
                        <div className="flex items-center justify-end gap-1">Gasto <SortButton column="spend" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} /></div>
                      </th>
                      <th className={thClass}>
                        <div className="flex items-center justify-end gap-1">Impressões <SortButton column="impressions" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} /></div>
                      </th>
                      <th className={thClass}>
                        <div className="flex items-center justify-end gap-1">Cliques <SortButton column="clicks" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} /></div>
                      </th>
                      <th className={thClass}>
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip><TooltipTrigger asChild><span className="cursor-help">CTR</span></TooltipTrigger><TooltipContent side="top" className="max-w-48 text-xs">Taxa de Clique — % que viram e clicaram</TooltipContent></Tooltip>
                          <SortButton column="ctr" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        </div>
                      </th>
                      <th className={thClass}>
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip><TooltipTrigger asChild><span className="cursor-help">CPM</span></TooltipTrigger><TooltipContent side="top" className="text-xs">Custo por Mil Impressões</TooltipContent></Tooltip>
                          <SortButton column="cpm" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        </div>
                      </th>
                      <th className={thClass}>
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip><TooltipTrigger asChild><span className="cursor-help">CPA</span></TooltipTrigger><TooltipContent side="top" className="max-w-52 text-xs">Custo por Aquisição — Gasto ÷ Conversões</TooltipContent></Tooltip>
                          <SortButton column="cpa" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        </div>
                      </th>
                      <th className={thClass + " pr-4"}>
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip><TooltipTrigger asChild><span className="cursor-help">ROAS</span></TooltipTrigger><TooltipContent side="top" className="max-w-52 text-xs">Retorno sobre Investimento. Acima de 1,0x = retorno positivo</TooltipContent></Tooltip>
                          <SortButton column="roas" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-12 text-center text-sm text-muted-foreground">
                          Nenhuma campanha encontrada
                        </td>
                      </tr>
                    ) : (
                      paginated.map((campaign) => {
                        const isExpanded = expandedCampaigns.has(campaign.id);
                        const adsets = campaign.adsets?.length ? campaign.adsets : (adsetCache[campaign.id] ?? []);
                        const isLoadingAdsets = loadingAdsets.has(campaign.id);
                        const cpa = campaign.cpa ?? (campaign.conversions && campaign.conversions > 0 ? campaign.spend / campaign.conversions : null);

                        return (
                          <React.Fragment key={campaign.id}>
                            <tr
                              className={cn("border-b border-border/60 cursor-pointer transition-colors hover:bg-muted/20", isExpanded && "bg-muted/10")}
                              onClick={() => toggleCampaign(campaign)}
                            >
                              <td className="py-3 pl-4 pr-3">
                                <div className="flex items-center gap-2">
                                  {isExpanded
                                    ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                                    : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                                  <span className="text-sm font-medium truncate max-w-[200px]">{campaign.name}</span>
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <Badge variant={STATUS_VARIANTS[campaign.status] ?? "outline"}>
                                  {STATUS_LABELS[campaign.status] ?? campaign.status}
                                </Badge>
                              </td>
                              <td className="px-3 py-3">
                                <span className="text-xs text-muted-foreground">
                                  {OBJECTIVE_LABELS[campaign.objective] ?? campaign.objective}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-right">
                                <span className="font-mono text-sm text-muted-foreground">
                                  {campaign.budget ? formatCurrency(campaign.budget) : "—"}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-right">
                                <span className={cn("font-mono text-sm font-semibold", campaign.spend === 0 && "text-muted-foreground")}>
                                  {formatCurrency(campaign.spend)}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-right">
                                <span className="font-mono text-sm">
                                  {campaign.spend === 0 ? <span className="text-muted-foreground">—</span> : formatNumber(campaign.impressions)}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-right">
                                <span className="font-mono text-sm">
                                  {campaign.spend === 0 ? <span className="text-muted-foreground">—</span> : formatNumber(campaign.clicks)}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-right">
                                <span className="font-mono text-sm">
                                  {campaign.spend === 0 ? <span className="text-muted-foreground">—</span> : formatPercent(campaign.ctr)}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-right">
                                <span className="font-mono text-sm">
                                  {campaign.spend === 0 ? <span className="text-muted-foreground">—</span> : formatCurrency(campaign.cpm)}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-right">
                                <span className="font-mono text-sm text-muted-foreground">
                                  {cpa !== null ? formatCurrency(cpa) : "—"}
                                </span>
                              </td>
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
                            </tr>
                            {isExpanded && (
                              <AdSetRows adsets={adsets} loadingAdsets={isLoadingAdsets} />
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
    </TooltipProvider>
  );
}
