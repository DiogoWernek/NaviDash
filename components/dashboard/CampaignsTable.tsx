"use client";

import { useState, useMemo } from "react";
import {
  ChevronDown,
  ChevronRight,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatRoas,
  cn,
} from "@/lib/utils";
import type { Campaign, AdSet, Ad } from "@/types";

interface CampaignsTableProps {
  campaigns: Campaign[];
  loading?: boolean;
}

type SortKey = "name" | "spend" | "impressions" | "clicks" | "ctr" | "cpm" | "roas";
type SortDir = "asc" | "desc";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativo",
  PAUSED: "Pausado",
  ARCHIVED: "Arquivado",
};

const STATUS_VARIANTS: Record<
  string,
  "active" | "paused" | "archived"
> = {
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
};

function SortButton({
  column,
  sortKey,
  sortDir,
  onSort,
}: {
  column: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  return (
    <button
      onClick={() => onSort(column)}
      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {sortKey === column ? (
        sortDir === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}

function AdRow({ ad, depth = 3 }: { ad: Ad; depth?: number }) {
  return (
    <tr className="border-b border-border/30 bg-muted/10 transition-colors hover:bg-muted/20">
      <td className="py-2 pl-4 pr-3" style={{ paddingLeft: `${depth * 20}px` }}>
        <div className="flex items-center gap-2">
          <div className="h-1 w-1 rounded-full bg-muted-foreground/40 shrink-0" />
          <span className="text-xs text-muted-foreground truncate max-w-[240px]">
            {ad.name}
          </span>
        </div>
      </td>
      <td className="px-3 py-2" />
      <td className="px-3 py-2" />
      <td className="px-3 py-2 text-right">
        <span className="font-mono text-xs">{formatCurrency(ad.spend)}</span>
      </td>
      <td className="px-3 py-2 text-right">
        <span className="font-mono text-xs">{formatNumber(ad.impressions)}</span>
      </td>
      <td className="px-3 py-2 text-right">
        <span className="font-mono text-xs">{formatNumber(ad.clicks)}</span>
      </td>
      <td className="px-3 py-2 text-right">
        <span className="font-mono text-xs">{formatPercent(ad.ctr)}</span>
      </td>
      <td className="px-3 py-2 text-right">
        <span className="font-mono text-xs">{formatCurrency(ad.cpm)}</span>
      </td>
      <td className="px-3 py-2 pr-4 text-right">
        <span className="font-mono text-xs">{formatRoas(ad.roas)}</span>
      </td>
    </tr>
  );
}

function AdSetRow({
  adset,
  expandedAdSets,
  toggleAdSet,
}: {
  adset: AdSet;
  expandedAdSets: Set<string>;
  toggleAdSet: (id: string) => void;
}) {
  const isExpanded = expandedAdSets.has(adset.id);

  return (
    <>
      <tr
        className="border-b border-border/40 bg-muted/5 cursor-pointer transition-colors hover:bg-muted/15"
        onClick={() => toggleAdSet(adset.id)}
      >
        <td className="py-2 pl-4 pr-3" style={{ paddingLeft: "40px" }}>
          <div className="flex items-center gap-2">
            {adset.ads && adset.ads.length > 0 ? (
              isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )
            ) : (
              <div className="w-3.5" />
            )}
            <span className="text-xs font-medium truncate max-w-[220px]">
              {adset.name}
            </span>
          </div>
        </td>
        <td className="px-3 py-2" />
        <td className="px-3 py-2" />
        <td className="px-3 py-2 text-right">
          <span className="font-mono text-xs font-semibold">
            {formatCurrency(adset.spend)}
          </span>
        </td>
        <td className="px-3 py-2 text-right">
          <span className="font-mono text-xs">{formatNumber(adset.impressions)}</span>
        </td>
        <td className="px-3 py-2 text-right">
          <span className="font-mono text-xs">{formatNumber(adset.clicks)}</span>
        </td>
        <td className="px-3 py-2 text-right">
          <span className="font-mono text-xs">{formatPercent(adset.ctr)}</span>
        </td>
        <td className="px-3 py-2 text-right">
          <span className="font-mono text-xs">{formatCurrency(adset.cpm)}</span>
        </td>
        <td className="px-3 py-2 pr-4 text-right">
          <span className="font-mono text-xs">{formatRoas(adset.roas)}</span>
        </td>
      </tr>
      {isExpanded &&
        adset.ads?.map((ad) => <AdRow key={ad.id} ad={ad} />)}
    </>
  );
}

export function CampaignsTable({ campaigns, loading }: CampaignsTableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [expandedAdSets, setExpandedAdSets] = useState<Set<string>>(new Set());

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function toggleCampaign(id: string) {
    setExpandedCampaigns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAdSet(id: string) {
    setExpandedAdSets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filteredAndSorted = useMemo(() => {
    let result = campaigns.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase())
    );

    result = [...result].sort((a, b) => {
      const aVal = a[sortKey] as number | string;
      const bVal = b[sortKey] as number | string;
      const dir = sortDir === "asc" ? 1 : -1;
      if (typeof aVal === "string") {
        return aVal.localeCompare(bVal as string) * dir;
      }
      return ((aVal as number) - (bVal as number)) * dir;
    });

    return result;
  }, [campaigns, search, sortKey, sortDir]);

  const thClass =
    "px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide";

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-semibold">Campanhas</CardTitle>
        <div className="relative w-52">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar campanha..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2.5 pl-4 pr-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <div className="flex items-center gap-1">
                      Campanha
                      <SortButton
                        column="name"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={handleSort}
                      />
                    </div>
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Objetivo
                  </th>
                  <th className={thClass}>
                    <div className="flex items-center justify-end gap-1">
                      Gasto
                      <SortButton
                        column="spend"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={handleSort}
                      />
                    </div>
                  </th>
                  <th className={thClass}>
                    <div className="flex items-center justify-end gap-1">
                      Impressões
                      <SortButton
                        column="impressions"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={handleSort}
                      />
                    </div>
                  </th>
                  <th className={thClass}>
                    <div className="flex items-center justify-end gap-1">
                      Cliques
                      <SortButton
                        column="clicks"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={handleSort}
                      />
                    </div>
                  </th>
                  <th className={thClass}>
                    <div className="flex items-center justify-end gap-1">
                      CTR
                      <SortButton
                        column="ctr"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={handleSort}
                      />
                    </div>
                  </th>
                  <th className={thClass}>
                    <div className="flex items-center justify-end gap-1">
                      CPM
                      <SortButton
                        column="cpm"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={handleSort}
                      />
                    </div>
                  </th>
                  <th className={thClass + " pr-4"}>
                    <div className="flex items-center justify-end gap-1">
                      ROAS
                      <SortButton
                        column="roas"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={handleSort}
                      />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSorted.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                      Nenhuma campanha encontrada
                    </td>
                  </tr>
                ) : (
                  filteredAndSorted.map((campaign) => {
                    const isExpanded = expandedCampaigns.has(campaign.id);
                    return (
                      <>
                        <tr
                          key={campaign.id}
                          className={cn(
                            "border-b border-border/60 cursor-pointer transition-colors hover:bg-muted/20",
                            isExpanded && "bg-muted/10"
                          )}
                          onClick={() => toggleCampaign(campaign.id)}
                        >
                          <td className="py-3 pl-4 pr-3">
                            <div className="flex items-center gap-2">
                              {campaign.adsets && campaign.adsets.length > 0 ? (
                                isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                )
                              ) : (
                                <div className="w-4" />
                              )}
                              <span className="text-sm font-medium truncate max-w-[240px]">
                                {campaign.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <Badge
                              variant={STATUS_VARIANTS[campaign.status] ?? "outline"}
                            >
                              {STATUS_LABELS[campaign.status] ?? campaign.status}
                            </Badge>
                          </td>
                          <td className="px-3 py-3">
                            <span className="text-xs text-muted-foreground">
                              {OBJECTIVE_LABELS[campaign.objective] ?? campaign.objective}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <span className="font-mono text-sm font-semibold">
                              {formatCurrency(campaign.spend)}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <span className="font-mono text-sm">
                              {formatNumber(campaign.impressions)}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <span className="font-mono text-sm">
                              {formatNumber(campaign.clicks)}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <span className="font-mono text-sm">
                              {formatPercent(campaign.ctr)}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <span className="font-mono text-sm">
                              {formatCurrency(campaign.cpm)}
                            </span>
                          </td>
                          <td className="px-3 py-3 pr-4 text-right">
                            <span className="font-mono text-sm">
                              {formatRoas(campaign.roas)}
                            </span>
                          </td>
                        </tr>
                        {isExpanded &&
                          campaign.adsets?.map((adset) => (
                            <AdSetRow
                              key={adset.id}
                              adset={adset}
                              expandedAdSets={expandedAdSets}
                              toggleAdSet={toggleAdSet}
                            />
                          ))}
                      </>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
