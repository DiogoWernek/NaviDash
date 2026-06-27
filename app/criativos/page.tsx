"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useDashboard } from "@/lib/dashboard-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowUp, ArrowDown, ArrowUpDown, Search, Film, ImageIcon,
  ChevronLeft, ChevronRight, LayoutList, LayoutGrid,
} from "lucide-react";
import { formatCurrency, formatNumber, formatPercent, dateToString } from "@/lib/utils";
import type { AdGalleryItem } from "@/app/api/ads/route";
import type { AdThumbnailData } from "@/app/api/ad-thumbnail/route";

const PAGE_SIZE = 25;

type SortKey = keyof Pick<AdGalleryItem, "ad_name" | "spend" | "impressions" | "ctr" | "cpc" | "frequency" | "leads" | "cpl" | "hook3s_rate" | "hold_rate">;
type SortDir = "asc" | "desc";
type ViewMode = "table" | "card";

// Cache thumbnails in memory so navigating pages doesn't re-fetch
const thumbCache = new Map<string, AdThumbnailData>();

function AdThumbnailCell({
  adId,
  accountId,
  index,
  size = "sm",
}: {
  adId: string;
  accountId: string;
  index: number;
  size?: "sm" | "lg";
}) {
  const [data, setData] = useState<AdThumbnailData | null>(() => thumbCache.get(adId) ?? null);
  const [loading, setLoading] = useState(!thumbCache.has(adId));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (thumbCache.has(adId)) {
      setData(thumbCache.get(adId)!);
      setLoading(false);
      return;
    }
    // Stagger requests by index to avoid hammering Meta API
    timerRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ metaAdId: adId, accountId });
        const res = await fetch(`/api/ad-thumbnail?${params}`);
        if (res.ok) {
          const json: AdThumbnailData = await res.json();
          thumbCache.set(adId, json);
          setData(json);
        }
      } catch {
        // silently ignore — thumbnail just won't show
      } finally {
        setLoading(false);
      }
    }, index * 120);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [adId, accountId, index]);

  const url = data?.thumbnail_url ?? data?.image_url;
  const isVideo = data?.is_video;

  if (size === "lg") {
    return (
      <div className="relative w-full aspect-video bg-muted rounded-t-md overflow-hidden flex items-center justify-center">
        {loading ? (
          <div className="absolute inset-0 animate-pulse bg-muted" />
        ) : url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            {isVideo ? <Film className="h-8 w-8" /> : <ImageIcon className="h-8 w-8" />}
          </div>
        )}
        {isVideo && url && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/25">
            <Film className="h-6 w-6 text-white drop-shadow" />
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return <div className="h-9 w-9 shrink-0 rounded animate-pulse bg-muted" />;
  }

  if (!url) {
    return (
      <div className="h-9 w-9 shrink-0 rounded bg-muted/50 flex items-center justify-center">
        {isVideo ? <Film className="h-3.5 w-3.5 text-muted-foreground" /> : <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>
    );
  }

  return (
    <div className="relative h-9 w-9 shrink-0 rounded overflow-hidden bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="h-full w-full object-cover" />
      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <Film className="h-3 w-3 text-white" />
        </div>
      )}
    </div>
  );
}

function SortIcon({ col, sortKey, dir }: { col: SortKey; sortKey: SortKey; dir: SortDir }) {
  if (col !== sortKey) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
  return dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

function Metric({
  label,
  value,
  highlight,
  className,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-xs font-mono font-medium${highlight ? " text-success" : ""}`}>{value}</p>
    </div>
  );
}

function AdCard({ ad, index }: { ad: AdGalleryItem; index: number }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card overflow-hidden hover:border-border transition-colors">
      <AdThumbnailCell adId={ad.ad_id} accountId={ad.account_id} index={index} size="lg" />
      <div className="p-3 space-y-2">
        <div className="flex items-start gap-1.5">
          {ad.hook3s_rate > 0 && (
            <Badge variant="outline" className="text-[9px] h-4 px-1 gap-0.5 shrink-0 mt-0.5">
              <Film className="h-2.5 w-2.5" /> Vídeo
            </Badge>
          )}
          <p className="text-xs font-medium leading-tight line-clamp-2" title={ad.ad_name}>
            {ad.ad_name}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-1 border-t border-border/40">
          <Metric label="Gasto" value={formatCurrency(ad.spend)} />
          <Metric label="CTR" value={formatPercent(ad.ctr, 2)} highlight={ad.ctr >= 1} />
          <Metric label="Leads" value={ad.leads > 0 ? formatNumber(ad.leads) : "—"} />
          <Metric
            label="CPL"
            value={ad.cpl > 0 ? formatCurrency(ad.cpl) : "—"}
            highlight={ad.cpl > 0 && ad.cpl < 50}
          />
          {ad.hook3s_rate > 0 && (
            <Metric
              label="Hook 3s"
              value={formatPercent(ad.hook3s_rate, 1)}
              highlight={ad.hook3s_rate >= 20}
              className="col-span-2"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function CriativosPage() {
  const { currentFilters, loadingAccounts } = useDashboard();
  const [ads, setAds] = useState<AdGalleryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  const fetchAds = useCallback(async () => {
    if (!currentFilters || currentFilters.selectedAccountIds.length === 0) return;
    setLoading(true);
    setPage(0);
    try {
      const params = new URLSearchParams({
        accountIds: currentFilters.selectedAccountIds.join(","),
        startDate: dateToString(currentFilters.dateRange.from),
        endDate: dateToString(currentFilters.dateRange.to),
      });
      const res = await fetch(`/api/ads?${params}`);
      const data = await res.json();
      setAds(data.ads ?? []);
    } catch (err) {
      console.error("[criativos] Error:", err);
    } finally {
      setLoading(false);
    }
  }, [currentFilters]);

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  // Reset page on search/sort change
  useEffect(() => { setPage(0); }, [search, sortKey, sortDir]);

  const filtered = ads.filter((ad) =>
    ad.ad_name.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === "string" && typeof bv === "string") {
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageAds = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const cols: Array<{ key: SortKey; label: string; format: (v: AdGalleryItem) => string }> = [
    { key: "spend", label: "Gasto", format: (a) => formatCurrency(a.spend) },
    { key: "impressions", label: "Views", format: (a) => formatNumber(a.impressions) },
    { key: "ctr", label: "CTR", format: (a) => formatPercent(a.ctr, 2) },
    { key: "cpc", label: "CPC", format: (a) => a.cpc > 0 ? formatCurrency(a.cpc) : "—" },
    { key: "frequency", label: "Freq.", format: (a) => a.frequency > 0 ? a.frequency.toFixed(1) : "—" },
    { key: "leads", label: "Leads", format: (a) => a.leads > 0 ? formatNumber(a.leads) : "—" },
    { key: "cpl", label: "CPL", format: (a) => a.cpl > 0 ? formatCurrency(a.cpl) : "—" },
    { key: "hook3s_rate", label: "Hook 3s", format: (a) => a.hook3s_rate > 0 ? formatPercent(a.hook3s_rate, 1) : "—" },
    { key: "hold_rate", label: "Hold", format: (a) => a.hold_rate > 0 ? formatPercent(a.hold_rate, 1) : "—" },
  ];

  const isWaiting = !currentFilters || loadingAccounts;

  const Pagination = () => totalPages > 1 ? (
    <div className="flex items-center justify-between border-t border-border/50 px-4 py-3">
      <p className="text-[11px] text-muted-foreground">
        {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} de {sorted.length}
      </p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          const pageNum = totalPages <= 5 ? i : Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
          return (
            <Button key={pageNum} variant={pageNum === page ? "default" : "outline"} size="icon" className="h-7 w-7 text-xs" onClick={() => setPage(pageNum)}>
              {pageNum + 1}
            </Button>
          );
        })}
        <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  ) : null;

  return (
    <main className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-sm font-semibold">Galeria de Criativos</CardTitle>
              {!loading && ads.length > 0 && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {filtered.length} anúncio{filtered.length !== 1 ? "s" : ""} · página {page + 1} de {totalPages}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar anúncio..."
                  className="pl-8 h-8 text-xs"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {/* View mode toggle */}
              <div className="flex items-center rounded-md border border-border overflow-hidden">
                <button
                  onClick={() => setViewMode("table")}
                  className={`flex items-center justify-center h-8 w-8 transition-colors ${
                    viewMode === "table"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                  title="Tabela"
                >
                  <LayoutList className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setViewMode("card")}
                  className={`flex items-center justify-center h-8 w-8 transition-colors ${
                    viewMode === "card"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                  title="Cards"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isWaiting || loading ? (
            viewMode === "card" ? (
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {[0,1,2,3,4,5,6,7,8,9].map((i) => (
                  <div key={i} className="rounded-lg border border-border/60 overflow-hidden">
                    <Skeleton className="w-full aspect-video rounded-none" />
                    <div className="p-3 space-y-2">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 space-y-2">
                {[0,1,2,3,4,5].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded shrink-0" />
                    <Skeleton className="h-9 flex-1" />
                  </div>
                ))}
              </div>
            )
          ) : sorted.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-10">
              {ads.length === 0 ? "Selecione um período e conta para carregar criativos" : "Nenhum criativo encontrado"}
            </p>
          ) : viewMode === "card" ? (
            <>
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {pageAds.map((ad, i) => (
                  <AdCard key={ad.ad_id} ad={ad} index={i} />
                ))}
              </div>
              <Pagination />
            </>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground w-[300px]">
                        <button className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("ad_name")}>
                          Anúncio <SortIcon col="ad_name" sortKey={sortKey} dir={sortDir} />
                        </button>
                      </th>
                      {cols.map((c) => (
                        <th key={c.key} className="px-3 py-2.5 text-right font-medium text-muted-foreground whitespace-nowrap">
                          <button className="flex items-center gap-1 ml-auto hover:text-foreground" onClick={() => toggleSort(c.key)}>
                            {c.label} <SortIcon col={c.key} sortKey={sortKey} dir={sortDir} />
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageAds.map((ad, i) => (
                      <tr key={ad.ad_id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2.5">
                            <AdThumbnailCell adId={ad.ad_id} accountId={ad.account_id} index={i} />
                            <div className="min-w-0">
                              <p className="font-medium truncate max-w-[200px]" title={ad.ad_name}>{ad.ad_name}</p>
                              {ad.hook3s_rate > 0 && (
                                <Badge variant="outline" className="text-[9px] mt-0.5 h-4 px-1 gap-0.5">
                                  <Film className="h-2.5 w-2.5" /> Vídeo
                                </Badge>
                              )}
                            </div>
                          </div>
                        </td>
                        {cols.map((c) => (
                          <td key={c.key} className="px-3 py-2 text-right font-mono">
                            <span className={
                              c.key === "cpl" && ad.cpl > 0 && ad.cpl < 50 ? "text-success" :
                              c.key === "hook3s_rate" && ad.hook3s_rate >= 20 ? "text-success" :
                              c.key === "ctr" && ad.ctr >= 1 ? "text-success" : ""
                            }>
                              {c.format(ad)}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination />
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
