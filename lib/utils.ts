import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(Math.round(value));
}

export function formatPercent(value: number, decimals = 2): string {
  return (
    new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value) + "%"
  );
}

export function formatRoas(value: number): string {
  return (
    new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value) + "x"
  );
}

export function formatDate(date: string): string {
  const d = new Date(date + "T00:00:00");
  return new Intl.DateTimeFormat("pt-BR").format(d);
}

export function formatDateShort(date: string): string {
  const d = new Date(date + "T00:00:00");
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(d);
}

export function formatVariation(
  current: number,
  previous: number
): { value: string; positive: boolean } {
  if (previous === 0) return { value: "—", positive: true };
  const diff = ((current - previous) / previous) * 100;
  const positive = diff >= 0;
  const formatted = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Math.abs(diff));
  return {
    value: `${positive ? "+" : "-"}${formatted}%`,
    positive,
  };
}

export function formatMetricValue(metric: string, value: number): string {
  switch (metric) {
    case "spend":
    case "cpm":
    case "cpc":
      return formatCurrency(value);
    case "impressions":
    case "clicks":
    case "reach":
    case "conversions":
      return formatNumber(value);
    case "ctr":
      return formatPercent(value);
    case "frequency":
      return value.toFixed(2);
    case "roas":
      return formatRoas(value);
    default:
      return value.toString();
  }
}

export function getDateRange(preset: string): { from: Date; to: Date } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  switch (preset) {
    case "today": {
      return { from: today, to: today };
    }
    case "7d": {
      const from = new Date(today);
      from.setDate(today.getDate() - 6);
      return { from, to: today };
    }
    case "30d": {
      const from = new Date(today);
      from.setDate(today.getDate() - 29);
      return { from, to: today };
    }
    case "90d": {
      const from = new Date(today);
      from.setDate(today.getDate() - 89);
      return { from, to: today };
    }
    default: {
      const from = new Date(today);
      from.setDate(today.getDate() - 29);
      return { from, to: today };
    }
  }
}

export function dateToString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isToday(dateStr: string): boolean {
  const today = dateToString(new Date());
  return dateStr === today;
}

export function getPreviousPeriod(from: Date, to: Date): { from: Date; to: Date } {
  const duration = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 86400000);
  const prevFrom = new Date(prevTo.getTime() - duration);
  return { from: prevFrom, to: prevTo };
}
