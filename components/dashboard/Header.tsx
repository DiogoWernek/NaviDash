"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CalendarIcon, ChevronDown, RefreshCw, Check, ArrowRight, Bot, Download } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ThemeToggle } from "./ThemeToggle";
import { cn, getDateRange } from "@/lib/utils";
import type { BusinessManager, AdAccount, FilterState, DateRange } from "@/types";

interface HeaderProps {
  businessManagers: BusinessManager[];
  adAccounts: AdAccount[];
  onFilterChange: (filters: FilterState) => void;
  loading?: boolean;
  onSyncClick?: () => void;
  isSyncing?: boolean;
  onExportCsv?: () => void;
  hasData?: boolean;
}

const DATE_PRESETS = [
  { label: "Hoje", value: "today" },
  { label: "1d", value: "1d" },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
  { label: "90d", value: "90d" },
] as const;

const ALL_BMS = "__all__";

export function Header({
  businessManagers,
  adAccounts,
  onFilterChange,
  loading,
  onSyncClick,
  isSyncing,
  onExportCsv,
  hasData,
}: HeaderProps) {
  const [selectedBmId, setSelectedBmId] = useState<string>(ALL_BMS);
  const [activePreset, setActivePreset] = useState<string>("30d");
  const [dateRange, setDateRange] = useState<DateRange>(getDateRange("30d"));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [bmDropdownOpen, setBmDropdownOpen] = useState(false);
  const [pending, setPending] = useState<{ from?: Date; to?: Date }>({});
  const [phase, setPhase] = useState<"start" | "end">("start");

  // Accounts that belong to the selected BM (or all accounts if "Todas")
  const activeAccountIds = selectedBmId === ALL_BMS
    ? adAccounts.map((a) => a.id)
    : adAccounts.filter((a) => a.bm_id === selectedBmId).map((a) => a.id);

  // Fire filter change whenever BM selection or date changes
  useEffect(() => {
    if (activeAccountIds.length > 0) {
      onFilterChange({ selectedBmId, selectedAccountIds: activeAccountIds, dateRange });
    }
  }, [selectedBmId, dateRange, adAccounts.length, onFilterChange]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleBmSelect(bmId: string) {
    setSelectedBmId(bmId);
    setBmDropdownOpen(false);
  }

  function handlePreset(preset: string) {
    setActivePreset(preset);
    setDateRange(getDateRange(preset));
  }

  function openCalendar(open: boolean) {
    if (open) {
      setPending({ from: dateRange.from, to: dateRange.to });
      setPhase("start");
    }
    setCalendarOpen(open);
  }

  function handleDayClick(day: Date | undefined) {
    if (!day) return;
    if (phase === "start") {
      setPending(prev => ({
        from: day,
        to: prev.to && day < prev.to ? prev.to : undefined,
      }));
      setPhase("end");
    } else {
      if (pending.from && day >= pending.from) {
        setPending(prev => ({ ...prev, to: day }));
      } else {
        // Clicked before start → reset start, stay in end phase
        setPending({ from: day, to: undefined });
      }
    }
  }

  function applyRange() {
    if (pending.from && pending.to) {
      setDateRange({ from: pending.from, to: pending.to });
      setActivePreset("custom");
      setCalendarOpen(false);
    }
  }

  const selectedBm = businessManagers.find((bm) => bm.id === selectedBmId);
  const bmLabel = selectedBmId === ALL_BMS ? "Todas as Contas" : (selectedBm?.name ?? "Business Manager");

  const dateLabel =
    activePreset !== "custom"
      ? DATE_PRESETS.find((p) => p.value === activePreset)?.label
      : `${format(dateRange.from, "dd/MM/yy", { locale: ptBR })} – ${format(dateRange.to, "dd/MM/yy", { locale: ptBR })}`;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6">
        <div className="flex h-14 items-center justify-between gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-meta-blue">
              <span className="text-xs font-bold text-white">N</span>
            </div>
            <span className="text-base font-bold tracking-tight">NaviDash</span>
          </div>

          {/* Filters */}
          <div className="flex flex-1 items-center justify-center gap-2 overflow-x-auto">
            {/* BM Selector */}
            <Popover open={bmDropdownOpen} onOpenChange={setBmDropdownOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-medium min-w-0 max-w-[200px]"
                  disabled={loading}
                >
                  <span className="truncate">{bmLabel}</span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-1" align="start">
                <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Business Manager
                </p>

                {/* Todas as BMs */}
                <button
                  onClick={() => handleBmSelect(ALL_BMS)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted",
                    selectedBmId === ALL_BMS && "text-meta-blue font-medium"
                  )}
                >
                  <div className="h-1.5 w-1.5 rounded-full bg-meta-blue shrink-0" />
                  <span className="flex-1 text-left">Todas as Contas</span>
                  {selectedBmId === ALL_BMS && <Check className="h-3.5 w-3.5 shrink-0" />}
                </button>

                <div className="my-1 border-t border-border/50" />

                {businessManagers.map((bm) => (
                  <button
                    key={bm.id}
                    onClick={() => handleBmSelect(bm.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted",
                      selectedBmId === bm.id && "text-meta-blue font-medium"
                    )}
                  >
                    <div className="h-1.5 w-1.5 rounded-full bg-success shrink-0" />
                    <span className="flex-1 text-left truncate">{bm.name}</span>
                    {selectedBmId === bm.id && <Check className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                ))}

                {/* Account count hint */}
                <p className="px-2 pt-2 pb-1 text-[10px] text-muted-foreground">
                  {activeAccountIds.length} conta{activeAccountIds.length !== 1 ? "s" : ""} ativa{activeAccountIds.length !== 1 ? "s" : ""}
                </p>
              </PopoverContent>
            </Popover>

            {/* Date Presets */}
            <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
              {DATE_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => handlePreset(preset.value)}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs font-medium transition-all",
                    activePreset === preset.value
                      ? "bg-meta-blue text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom Date Picker */}
            <Popover open={calendarOpen} onOpenChange={openCalendar}>
              <PopoverTrigger asChild>
                <Button
                  variant={activePreset === "custom" ? "meta" : "outline"}
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-medium"
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {activePreset === "custom" ? dateLabel : "Período"}
                </Button>
              </PopoverTrigger>
              {onExportCsv && (
              <Button
                variant="outline"
                size="sm"
                onClick={onExportCsv}
                disabled={!hasData}
                className="h-8 gap-1.5 text-xs font-medium hover:text-foreground"
                title="Exportar dados como CSV"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Exportar CSV</span>
              </Button>
            )}
              <PopoverContent className="w-auto p-0" align="end">
                {/* Chips de início/fim — clicáveis para editar cada um */}
                <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                  <button
                    onClick={() => setPhase("start")}
                    className={cn(
                      "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 transition-all min-w-[90px]",
                      phase === "start"
                        ? "bg-meta-blue/10 ring-1 ring-meta-blue"
                        : "hover:bg-muted"
                    )}
                  >
                    <span className={cn("text-[10px] font-semibold uppercase tracking-wider",
                      phase === "start" ? "text-meta-blue" : "text-muted-foreground"
                    )}>Início</span>
                    <span className={cn("text-sm font-medium",
                      pending.from ? (phase === "start" ? "text-meta-blue" : "text-foreground") : "text-muted-foreground"
                    )}>
                      {pending.from ? format(pending.from, "dd MMM yy", { locale: ptBR }) : "—"}
                    </span>
                  </button>

                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

                  <button
                    onClick={() => setPhase("end")}
                    className={cn(
                      "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 transition-all min-w-[90px]",
                      phase === "end"
                        ? "bg-meta-blue/10 ring-1 ring-meta-blue"
                        : "hover:bg-muted"
                    )}
                  >
                    <span className={cn("text-[10px] font-semibold uppercase tracking-wider",
                      phase === "end" ? "text-meta-blue" : "text-muted-foreground"
                    )}>Fim</span>
                    <span className={cn("text-sm font-medium",
                      pending.to ? (phase === "end" ? "text-meta-blue" : "text-foreground") : "text-muted-foreground"
                    )}>
                      {pending.to ? format(pending.to, "dd MMM yy", { locale: ptBR }) : "—"}
                    </span>
                  </button>

                  {pending.from && pending.to && (
                    <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
                      {Math.round((pending.to.getTime() - pending.from.getTime()) / 86400000) + 1} dias
                    </span>
                  )}
                </div>

                {/* Instrução contextual */}
                <div className="px-4 pt-2 pb-0">
                  <p className="text-[11px] text-muted-foreground">
                    {phase === "start" ? "Clique no calendário para definir o início" : "Agora clique para definir o fim"}
                  </p>
                </div>

                <Calendar
                  mode="single"
                  selected={phase === "start" ? pending.from : pending.to}
                  onSelect={handleDayClick}
                  disabled={(date) => date > new Date()}
                  numberOfMonths={2}
                  locale={ptBR}
                  modifiers={{
                    range_start: pending.from ? [pending.from] : [],
                    range_end: pending.to ? [pending.to] : [],
                    range_middle: pending.from && pending.to
                      ? [{ after: pending.from, before: pending.to }]
                      : [],
                  }}
                  modifiersClassNames={{
                    range_start: "!bg-meta-blue !text-white rounded-full",
                    range_end: "!bg-meta-blue !text-white rounded-full",
                    range_middle: "!bg-meta-blue/15 !rounded-none",
                  }}
                />

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-border px-4 py-3">
                  <button
                    onClick={() => { setPending({ from: dateRange.from, to: dateRange.to }); setPhase("start"); }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Resetar
                  </button>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setCalendarOpen(false)}>
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-meta-blue hover:bg-meta-blue/90 text-white"
                      disabled={!pending.from || !pending.to}
                      onClick={applyRange}
                    >
                      Aplicar
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-1 shrink-0">
            {onSyncClick && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onSyncClick}
                disabled={isSyncing}
                className="h-9 w-9"
                title="Sincronizar dados"
              >
                <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
              </Button>
            )}
            <ThemeToggle />
            <Link href="/agente">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs font-medium border-meta-blue/30 text-meta-blue hover:bg-meta-blue hover:text-white hover:border-meta-blue transition-all"
                title="Agente de criação de anúncios"
              >
                <Bot className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Criar Anúncio</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
