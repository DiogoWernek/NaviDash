"use client";

import { useState, useEffect } from "react";
import { CalendarIcon, ChevronDown, RefreshCw, Check } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ThemeToggle } from "./ThemeToggle";
import { cn, getDateRange, dateToString } from "@/lib/utils";
import type { BusinessManager, AdAccount, FilterState, DateRange } from "@/types";

interface HeaderProps {
  businessManagers: BusinessManager[];
  adAccounts: AdAccount[];
  onFilterChange: (filters: FilterState) => void;
  loading?: boolean;
  onSyncClick?: () => void;
  isSyncing?: boolean;
}

const DATE_PRESETS = [
  { label: "Hoje", value: "today" },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
  { label: "90d", value: "90d" },
] as const;

export function Header({
  businessManagers,
  adAccounts,
  onFilterChange,
  loading,
  onSyncClick,
  isSyncing,
}: HeaderProps) {
  const [selectedBmId, setSelectedBmId] = useState<string>("");
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [activePreset, setActivePreset] = useState<string>("30d");
  const [dateRange, setDateRange] = useState<DateRange>(getDateRange("30d"));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [bmDropdownOpen, setBmDropdownOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);

  const filteredAccounts = adAccounts.filter(
    (a) => !selectedBmId || a.bm_id === selectedBmId
  );

  useEffect(() => {
    console.log("[Header] businessManagers mudou:", businessManagers.length, "| selectedBmId:", selectedBmId);
    if (businessManagers.length > 0 && !selectedBmId) {
      const firstBm = businessManagers[0];
      console.log("[Header] Selecionando BM inicial:", firstBm.id, firstBm.name);
      setSelectedBmId(firstBm.id);
    }
  }, [businessManagers, selectedBmId]);

  useEffect(() => {
    console.log("[Header] filteredAccounts:", filteredAccounts.length, "| selectedAccountIds:", selectedAccountIds.length);
    if (filteredAccounts.length > 0 && selectedAccountIds.length === 0) {
      const ids = filteredAccounts.map((a) => a.id);
      console.log("[Header] Selecionando contas iniciais:", ids);
      setSelectedAccountIds(ids);
    }
  }, [filteredAccounts, selectedAccountIds.length]);

  useEffect(() => {
    console.log("[Header] Disparando onFilterChange — contas:", selectedAccountIds.length, "| bm:", selectedBmId);
    if (selectedAccountIds.length > 0) {
      onFilterChange({ selectedBmId, selectedAccountIds, dateRange });
    }
  }, [selectedBmId, selectedAccountIds, dateRange, onFilterChange]);

  function handleBmSelect(bmId: string) {
    setSelectedBmId(bmId);
    const accounts = adAccounts.filter((a) => a.bm_id === bmId);
    setSelectedAccountIds(accounts.map((a) => a.id));
    setBmDropdownOpen(false);
  }

  function toggleAccount(accountId: string) {
    setSelectedAccountIds((prev) => {
      if (prev.includes(accountId)) {
        if (prev.length === 1) return prev;
        return prev.filter((id) => id !== accountId);
      }
      return [...prev, accountId];
    });
  }

  function selectAllAccounts() {
    setSelectedAccountIds(filteredAccounts.map((a) => a.id));
  }

  function handlePreset(preset: string) {
    setActivePreset(preset);
    setDateRange(getDateRange(preset));
  }

  function handleCalendarSelect(range: { from?: Date; to?: Date } | undefined) {
    if (range?.from && range?.to) {
      setDateRange({ from: range.from, to: range.to });
      setActivePreset("custom");
      setCalendarOpen(false);
    } else if (range?.from) {
      setDateRange({ from: range.from, to: range.from });
    }
  }

  const selectedBm = businessManagers.find((bm) => bm.id === selectedBmId);
  const allSelected = selectedAccountIds.length === filteredAccounts.length;

  const dateLabel =
    activePreset !== "custom"
      ? DATE_PRESETS.find((p) => p.value === activePreset)?.label
      : `${format(dateRange.from, "dd/MM/yy", { locale: ptBR })} – ${format(
          dateRange.to,
          "dd/MM/yy",
          { locale: ptBR }
        )}`;

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
                  className="h-8 gap-1.5 text-xs font-medium min-w-0 max-w-[180px]"
                >
                  <span className="truncate">
                    {selectedBm?.name ?? "Business Manager"}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-1" align="start">
                <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Business Managers
                </p>
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
                    {selectedBmId === bm.id && (
                      <Check className="h-3.5 w-3.5 shrink-0" />
                    )}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            {/* Account Selector */}
            <Popover open={accountDropdownOpen} onOpenChange={setAccountDropdownOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-medium min-w-0 max-w-[220px]"
                >
                  <span className="truncate">
                    {allSelected
                      ? "Todas as contas"
                      : selectedAccountIds.length === 1
                      ? filteredAccounts.find(
                          (a) => a.id === selectedAccountIds[0]
                        )?.name ?? "1 conta"
                      : `${selectedAccountIds.length} contas`}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-1" align="start">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Ad Accounts
                  </p>
                  <button
                    onClick={selectAllAccounts}
                    className="text-xs text-meta-blue hover:underline"
                  >
                    Todas
                  </button>
                </div>
                {filteredAccounts.map((account) => {
                  const isSelected = selectedAccountIds.includes(account.id);
                  return (
                    <button
                      key={account.id}
                      onClick={() => toggleAccount(account.id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted",
                        isSelected && "bg-meta-blue/5"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                          isSelected
                            ? "border-meta-blue bg-meta-blue"
                            : "border-border bg-transparent"
                        )}
                      >
                        {isSelected && (
                          <Check className="h-2.5 w-2.5 text-white" />
                        )}
                      </div>
                      <div className="flex flex-col items-start min-w-0">
                        <span className="truncate font-medium text-xs">
                          {account.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {account.meta_account_id}
                        </span>
                      </div>
                    </button>
                  );
                })}
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
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
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
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={handleCalendarSelect}
                  disabled={(date) => date > new Date()}
                  numberOfMonths={2}
                  locale={ptBR}
                />
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
                <RefreshCw
                  className={cn("h-4 w-4", isSyncing && "animate-spin")}
                />
              </Button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
