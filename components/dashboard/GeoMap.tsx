"use client";

import { useState, useEffect, useRef } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin } from "lucide-react";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import type { GeoData, GeoDataItem } from "@/types";

// ISO 3166-1 numeric → alpha-2 (Africa only)
const ISO_NUM_TO_CODE: Record<number, string> = {
  12: "DZ",  24: "AO",  72: "BW", 108: "BI", 120: "CM", 132: "CV",
  140: "CF", 148: "TD", 174: "KM", 178: "CG", 180: "CD", 262: "DJ",
  818: "EG", 232: "ER", 231: "ET", 266: "GA", 288: "GH", 270: "GM",
  324: "GN", 624: "GW", 384: "CI", 404: "KE", 426: "LS", 430: "LR",
  434: "LY", 450: "MG", 454: "MW", 466: "ML", 478: "MR", 480: "MU",
  504: "MA", 508: "MZ", 516: "NA", 562: "NE", 566: "NG", 646: "RW",
  678: "ST", 686: "SN", 694: "SL", 706: "SO", 710: "ZA", 728: "SS",
  729: "SD", 748: "SZ", 834: "TZ", 768: "TG", 788: "TN", 800: "UG",
  894: "ZM", 716: "ZW",
};

interface TooltipState {
  item: GeoDataItem;
  x: number;
  y: number;
}

interface GeoMapProps {
  geoData: GeoData | null;
  loading?: boolean;
}

// Color scale: darker = less spend, lighter = more spend
const COLOR_LOW  = { r: 14,  g: 36,  b: 80  }; // #0e2450 — deep navy
const COLOR_HIGH = { r: 191, g: 219, b: 254 }; // #bfdbfe — blue-200

function spendToColor(spend: number, max: number): string {
  if (max === 0 || spend === 0) return "#172033"; // no data — near-background
  const t = Math.pow(spend / max, 0.55);
  const r = Math.round(COLOR_LOW.r + (COLOR_HIGH.r - COLOR_LOW.r) * t);
  const g = Math.round(COLOR_LOW.g + (COLOR_HIGH.g - COLOR_LOW.g) * t);
  const b = Math.round(COLOR_LOW.b + (COLOR_HIGH.b - COLOR_LOW.b) * t);
  return `rgb(${r},${g},${b})`;
}

function getAccentColor() {
  if (typeof window === "undefined") return "#3b82f6";
  const v = getComputedStyle(document.documentElement).getPropertyValue("--meta-blue").trim();
  return v || "#3b82f6";
}

export function GeoMap({ geoData, loading }: GeoMapProps) {
  const [view, setView] = useState<"brazil" | "africa">("brazil");
  const [africaGeo, setAfricaGeo] = useState<object | null>(null);
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [accentColor, setAccentColor] = useState("#1e40af");
  const containerRef = useRef<HTMLDivElement>(null);

  // Load Africa TopoJSON once (bundled locally in /public/geo/)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch("/geo/world-110m.json");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const topo: any = await res.json();
      const { feature } = await import("topojson-client");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!cancelled) setAfricaGeo(feature(topo, topo.objects.countries) as any);
    }
    load().catch(console.error);
    return () => { cancelled = true; };
  }, []);

  // Pick up the CSS accent color after mount (needed for dark/light theme)
  useEffect(() => {
    setAccentColor(getAccentColor());
  }, []);

  const items: GeoDataItem[] =
    view === "brazil" ? (geoData?.brazil ?? []) : (geoData?.africa ?? []);

  const maxSpend = items.reduce((m, i) => Math.max(m, i.spend), 0);
  const totalSpend = items.reduce((s, i) => s + i.spend, 0);
  const byCode = (code: string) => items.find((i) => i.code === code);

  function fillColor(code: string) {
    if (code === hoveredCode) return "#ffffff";
    const item = byCode(code);
    return spendToColor(item?.spend ?? 0, maxSpend);
  }

  function onGeoEnter(e: React.MouseEvent<SVGPathElement>, code: string) {
    setHoveredCode(code);
    const item = byCode(code);
    if (!item) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({ item, x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  function onGeoMove(e: React.MouseEvent<SVGPathElement>) {
    if (!tooltip) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip((p) => (p ? { ...p, x: e.clientX - rect.left, y: e.clientY - rect.top } : null));
  }

  function onGeoLeave() {
    setHoveredCode(null);
    setTooltip(null);
  }

  const geoStyleFn = (code: string) => ({
    default: {
      fill: fillColor(code),
      stroke: "rgba(255,255,255,0.08)",
      strokeWidth: 0.5,
      outline: "none",
      transition: "fill 130ms ease",
      cursor: byCode(code) ? "pointer" : "default",
    },
    hover: {
      fill: "#ffffff",
      stroke: "rgba(255,255,255,0.3)",
      strokeWidth: 0.7,
      outline: "none",
      cursor: byCode(code) ? "pointer" : "default",
    },
    pressed: { outline: "none" },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <MapPin className="h-4 w-4 text-meta-blue" />
          Investimento por Região
        </CardTitle>
        <Select value={view} onValueChange={(v) => setView(v as "brazil" | "africa")}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="brazil" className="text-xs">Brasil</SelectItem>
            <SelectItem value="africa" className="text-xs">África</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>

      <CardContent className="pb-4">
        {loading ? (
          <Skeleton className="h-72 w-full rounded-lg" />
        ) : (
          <div className="flex gap-4">
            {/* ── Left: ranked list ── */}
            <div className="w-[42%] shrink-0 space-y-0.5">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {view === "brazil" ? "Estado" : "País"}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Gasto · Share
                </span>
              </div>

              {items.length === 0 ? (
                <p className="py-10 text-center text-xs text-muted-foreground">
                  Sem dados para o período
                </p>
              ) : (
                <>
                  {items.slice(0, 12).map((item) => {
                    const barPct = maxSpend > 0 ? (item.spend / maxSpend) * 100 : 0;
                    const share = totalSpend > 0 ? (item.spend / totalSpend) * 100 : 0;
                    const isActive = hoveredCode === item.code;

                    return (
                      <div
                        key={item.code}
                        className={`rounded-md px-1.5 py-1 transition-colors cursor-default ${isActive ? "bg-meta-blue/10" : "hover:bg-muted/50"}`}
                        onMouseEnter={() => setHoveredCode(item.code)}
                        onMouseLeave={() => setHoveredCode(null)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-7 shrink-0 rounded bg-blue-50 dark:bg-blue-950/60 px-1 py-0.5 text-center text-[10px] font-bold text-meta-blue leading-tight">
                            {item.code}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span className={`text-[11px] font-medium truncate ${isActive ? "text-meta-blue" : ""}`}>
                                {item.name}
                              </span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[11px] font-semibold tabular-nums">
                                  {formatCurrency(item.spend)}
                                </span>
                                <span className="text-[10px] text-muted-foreground tabular-nums w-9 text-right">
                                  {share.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full transition-all duration-200"
                                style={{
                                  width: `${barPct}%`,
                                  background: isActive
                                    ? accentColor
                                    : "linear-gradient(to right, rgb(147,197,253), rgb(30,64,175))",
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div className="mt-2 flex items-center justify-between border-t border-border pt-2 px-1">
                    <span className="text-[10px] text-muted-foreground">
                      Total ({items.length} {view === "brazil" ? "estados" : "países"})
                    </span>
                    <span className="text-xs font-semibold">{formatCurrency(totalSpend)}</span>
                  </div>
                </>
              )}
            </div>

            {/* ── Right: map + legend ── */}
            <div ref={containerRef} className="relative flex-1 select-none flex flex-col">
              {/* Map */}
              <div className="flex-1">
                {view === "brazil" && (
                  // Brazil bounding box: lon -74→-28, lat -34→+5
                  // scale=420, height=420 keeps all states in frame
                  <ComposableMap
                    projection="geoMercator"
                    projectionConfig={{ scale: 420, center: [-54, -13] }}
                    width={400}
                    height={420}
                    style={{ width: "100%", height: "auto" }}
                  >
                    <Geographies geography="/geo/brazil-states.json">
                      {({ geographies }) =>
                        geographies.map((geo) => {
                          const code = (geo.properties as Record<string, string>).sigla ?? "";
                          return (
                            <Geography
                              key={geo.rsmKey}
                              geography={geo}
                              style={geoStyleFn(code)}
                              onMouseEnter={(e) => onGeoEnter(e, code)}
                              onMouseMove={onGeoMove}
                              onMouseLeave={onGeoLeave}
                            />
                          );
                        })
                      }
                    </Geographies>
                  </ComposableMap>
                )}

                {view === "africa" && (
                  // Africa: lon -18→52, lat -35→37 (incl. Madagascar at ~50°E)
                  // Mercator span ~1.32*scale → scale=195 fits in height=420 with padding
                  <ComposableMap
                    projection="geoMercator"
                    projectionConfig={{ scale: 195, center: [18, 2] }}
                    width={420}
                    height={430}
                    style={{ width: "100%", height: "auto" }}
                  >
                    {africaGeo && (
                      <Geographies geography={africaGeo}>
                        {({ geographies }) =>
                          geographies.map((geo) => {
                            const code = ISO_NUM_TO_CODE[Number(geo.id)];
                            if (!code) return null;
                            return (
                              <Geography
                                key={geo.rsmKey}
                                geography={geo}
                                style={geoStyleFn(code)}
                                onMouseEnter={(e) => onGeoEnter(e, code)}
                                onMouseMove={onGeoMove}
                                onMouseLeave={onGeoLeave}
                              />
                            );
                          })
                        }
                      </Geographies>
                    )}
                  </ComposableMap>
                )}
              </div>

              {/* Legend */}
              {maxSpend > 0 && (
                <div className="mt-1 px-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">Menor</span>
                    <div
                      className="flex-1 h-2 rounded-full"
                      style={{
                        background: `linear-gradient(to right, rgb(${COLOR_LOW.r},${COLOR_LOW.g},${COLOR_LOW.b}), rgb(${COLOR_HIGH.r},${COLOR_HIGH.g},${COLOR_HIGH.b}))`,
                      }}
                    />
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">Maior</span>
                  </div>
                  <div className="flex justify-between mt-0.5 px-10">
                    <span className="text-[9px] text-muted-foreground">{formatCurrency(0)}</span>
                    <span className="text-[9px] text-muted-foreground">{formatCurrency(maxSpend / 2)}</span>
                    <span className="text-[9px] text-muted-foreground">{formatCurrency(maxSpend)}</span>
                  </div>
                </div>
              )}

              {/* Tooltip */}
              {tooltip && <MapTooltip tooltip={tooltip} containerRef={containerRef} />}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MapTooltip({
  tooltip,
  containerRef,
}: {
  tooltip: TooltipState;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const containerW = containerRef.current?.offsetWidth ?? 500;
  const w = 188;
  const x = tooltip.x + 14 + w > containerW ? tooltip.x - w - 14 : tooltip.x + 14;
  const y = Math.max(4, tooltip.y - 10);

  return (
    <div
      className="pointer-events-none absolute z-50 rounded-lg border border-border bg-popover shadow-xl p-2.5 space-y-1"
      style={{ left: x, top: y, width: w }}
    >
      <p className="font-semibold text-foreground text-xs leading-tight mb-1.5">
        {tooltip.item.name}
      </p>
      <TRow label="Gasto"      value={formatCurrency(tooltip.item.spend)} />
      <TRow label="Impressões" value={formatNumber(tooltip.item.impressions)} />
      <TRow label="Cliques"    value={formatNumber(tooltip.item.clicks)} />
      <TRow label="CTR"        value={formatPercent(tooltip.item.ctr)} />
      <TRow label="CPM"        value={formatCurrency(tooltip.item.cpm)} />
    </div>
  );
}

function TRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
