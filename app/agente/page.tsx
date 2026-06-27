"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  Bot, History, Sparkles, BarChart2, CheckCircle2,
  XCircle, Loader2, Check, Building2, Megaphone, Users,
} from "lucide-react";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";
import { AgentForm } from "@/components/agente/AgentForm";
import { AdPlanReview } from "@/components/agente/AdPlanReview";
import { RunHistory } from "@/components/agente/RunHistory";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type {
  BusinessManager, AdAccount, AgentFormData,
  AdPlan, ExecuteStreamEvent, ExecuteResult,
} from "@/types";

type Phase =
  | "form"
  | "planning"
  | "review"
  | "executing"
  | "done"
  | "error";

interface ExecStep {
  step: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
  value?: string;
}

interface ExecGroup {
  group_id: string;
  group_name: string;
  steps: ExecStep[];
}

const CAMPAIGN_GROUP = "__campaign__";

const AUD_STEP_ORDER = [
  "upload_image",
  "search_interests",
  "create_adset",
  "create_creative",
  "create_ad",
];

const STEP_LABELS: Record<string, string> = {
  create_campaign: "Criação da campanha",
  upload_image: "Upload das imagens para Meta",
  search_interests: "Busca de interesses",
  create_adset: "Criação do conjunto",
  create_creative: "Criação do criativo",
  create_ad: "Criação do anúncio",
};

function StepRow({ s }: { s: ExecStep }) {
  return (
    <div className={cn(
      "flex items-center gap-3 rounded-lg border px-3 py-2 transition-all",
      s.status === "done" && "border-success/30 bg-success/5",
      s.status === "running" && "border-meta-blue/30 bg-meta-blue/5",
      s.status === "error" && "border-destructive/30 bg-destructive/5",
      s.status === "pending" && "border-border bg-muted/20 opacity-50"
    )}>
      <div className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
        s.status === "done" && "bg-success/20",
        s.status === "running" && "bg-meta-blue/20",
        s.status === "error" && "bg-destructive/20",
        s.status === "pending" && "bg-muted"
      )}>
        {s.status === "done" && <Check className="h-3 w-3 text-success" />}
        {s.status === "running" && <Loader2 className="h-3 w-3 text-meta-blue animate-spin" />}
        {s.status === "error" && <XCircle className="h-3 w-3 text-destructive" />}
        {s.status === "pending" && <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-medium truncate",
          s.status === "done" && "text-success",
          s.status === "running" && "text-meta-blue",
          s.status === "pending" && "text-muted-foreground"
        )}>
          {s.label}
        </p>
        {s.value && s.status === "done" && (
          <p className="text-[11px] text-muted-foreground font-mono truncate">{s.value}</p>
        )}
      </div>
    </div>
  );
}

export default function AgentePage() {
  const [businessManagers, setBusinessManagers] = useState<BusinessManager[]>([]);
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  const [phase, setPhase] = useState<Phase>("form");
  const [planError, setPlanError] = useState<string | null>(null);
  const [plan, setPlan] = useState<AdPlan | null>(null);
  const [isMock, setIsMock] = useState(false);
  const [formData, setFormData] = useState<AgentFormData | null>(null);

  const [execGroups, setExecGroups] = useState<ExecGroup[]>([]);
  const [execResult, setExecResult] = useState<ExecuteResult | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data) => {
        setBusinessManagers(data.businessManagers ?? []);
        setAdAccounts(data.adAccounts ?? []);
        setLoadingAccounts(false);
      })
      .catch(() => setLoadingAccounts(false));
  }, []);

  const accountMap = Object.fromEntries(adAccounts.map((a) => [a.id, a.name]));

  const handleFormSubmit = useCallback(async (fd: AgentFormData) => {
    setFormData(fd);
    setPhase("planning");
    setPlanError(null);

    try {
      const res = await fetch("/api/agente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData: fd }),
      });
      const data = await res.json() as { plan?: AdPlan; mock?: boolean; error?: string };

      if (!res.ok || data.error) {
        setPlanError(data.error ?? "Falha ao gerar plano");
        setPhase("error");
        return;
      }

      setPlan(data.plan!);
      setIsMock(data.mock ?? false);
      setPhase("review");
    } catch (err) {
      setPlanError(String(err instanceof Error ? err.message : err));
      setPhase("error");
    }
  }, []);

  const handleApprove = useCallback(async (approvedPlan: AdPlan) => {
    if (!formData) return;
    // Persiste a versão editada pelo usuário na revisão — usada pelo "Tentar novamente"
    setPlan(approvedPlan);
    setPhase("executing");
    setExecResult(null);

    // Pré-inicializa: grupo da campanha + um grupo por público
    const initialGroups: ExecGroup[] = [
      {
        group_id: CAMPAIGN_GROUP,
        group_name: "Campanha",
        steps: [{ step: "create_campaign", label: STEP_LABELS.create_campaign, status: "pending" }],
      },
      ...approvedPlan.adsets.map((a, i) => ({
        group_id: String(i),
        group_name: a.name,
        steps: AUD_STEP_ORDER.map((step) => ({
          step,
          label: STEP_LABELS[step] ?? step,
          status: "pending" as const,
        })),
      })),
    ];
    setExecGroups(initialGroups);

    try {
      const res = await fetch("/api/agente/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: approvedPlan,
          accountIds: formData.account_ids,
          formData,
        }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ message: "Falha na execução" })) as { message?: string };
        setPlanError(err.message ?? "Erro desconhecido");
        setPhase("error");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as ExecuteStreamEvent;

            if (event.type === "step" && event.group_id) {
              setExecGroups((prev) =>
                prev.map((g) =>
                  g.group_id === event.group_id
                    ? {
                        ...g,
                        steps: g.steps.map((s) =>
                          s.step === event.step
                            ? { ...s, status: event.status as ExecStep["status"], label: event.label ?? s.label, value: event.value }
                            : s
                        ),
                      }
                    : g
                )
              );
            } else if (event.type === "group_start" && event.group_id) {
              setExecGroups((prev) =>
                prev.map((g) =>
                  g.group_id === event.group_id ? { ...g, group_name: event.group_name ?? g.group_name } : g
                )
              );
            } else if (event.type === "done" && event.result) {
              setExecResult(event.result);
              setPhase("done");
              setHistoryRefreshKey((k) => k + 1);
            } else if (event.type === "error") {
              setPlanError(event.message ?? "Erro na execução");
              setPhase("error");
              setHistoryRefreshKey((k) => k + 1);
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err) {
      setPlanError(String(err instanceof Error ? err.message : err));
      setPhase("error");
    }
  }, [formData]);

  const handleReset = () => {
    setPhase("form");
    setPlan(null);
    setPlanError(null);
    setExecGroups([]);
    setExecResult(null);
    setFormData(null);
  };

  // Volta ao formulário com os dados preenchidos — não zera o form
  const handleBackToForm = () => {
    setPhase("form");
    setPlanError(null);
    setExecGroups([]);
    setExecResult(null);
    // formData e plan são mantidos: AgentForm recebe initialFormData
  };

  // Re-executa com o mesmo plano aprovado — sem chamar o Claude novamente
  const handleRetry = useCallback(() => {
    if (plan) handleApprove(plan);
  }, [plan, handleApprove]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-meta-blue">
                  <span className="text-xs font-bold text-white">N</span>
                </div>
                <span className="text-base font-bold tracking-tight">NaviDash</span>
              </div>
              <div className="hidden sm:flex items-center gap-1 rounded-lg border border-border p-0.5 bg-muted/30">
                <Link href="/">
                  <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                    <BarChart2 className="h-3.5 w-3.5" />
                    Dashboard
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs bg-meta-blue text-white hover:bg-meta-blue/90" disabled>
                  <Bot className="h-3.5 w-3.5" />
                  Agente
                </Button>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2 rounded-full border border-meta-blue/30 bg-meta-blue/5 px-3 py-1">
              <Sparkles className="h-3.5 w-3.5 text-meta-blue" />
              <span className="text-xs font-medium text-meta-blue">
                {isMock ? "Modo Simulação" : "Powered by Claude"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {phase !== "form" && phase !== "planning" && (
                <Button variant="outline" size="sm" onClick={handleReset} disabled={phase === "executing"} className="h-8 text-xs hidden sm:flex">
                  Nova criação
                </Button>
              )}
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-screen-2xl px-4 sm:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="h-5 w-5 text-meta-blue" />
            Agente de Criação de Anúncios
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Preencha o formulário, revise o plano gerado pela IA e aprove para criar o anúncio na Meta.
          </p>
        </div>

        {/* ── Phase: Form ─────────────────────────────────────────────── */}
        {phase === "form" && (
          <div className="max-w-2xl mx-auto">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-meta-blue/10">
                  <Sparkles className="h-3.5 w-3.5 text-meta-blue" />
                </div>
                <h2 className="text-sm font-semibold">Dados do Anúncio</h2>
                <div className="ml-auto">
                  <span className="text-[11px] text-muted-foreground">
                    Após preencher, a IA irá gerar um plano para revisão
                  </span>
                </div>
              </div>

              {loadingAccounts ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Carregando contas...</span>
                </div>
              ) : (
                <AgentForm
                  businessManagers={businessManagers}
                  adAccounts={adAccounts}
                  onSubmit={handleFormSubmit}
                  initialFormData={formData ?? undefined}
                />
              )}
            </div>
          </div>
        )}

        {/* ── Phase: Planning ──────────────────────────────────────────── */}
        {phase === "planning" && (
          <div className="max-w-md mx-auto">
            <div className="rounded-xl border border-border bg-card p-8 text-center space-y-5">
              <div className="flex justify-center">
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-meta-blue/10">
                  <Bot className="h-8 w-8 text-meta-blue" />
                  <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-meta-blue">
                    <Sparkles className="h-3 w-3 text-white" />
                  </div>
                </div>
              </div>
              <div>
                <h2 className="text-base font-semibold mb-1">Analisando seus dados...</h2>
                <p className="text-sm text-muted-foreground">
                  O Claude está gerando um plano otimizado de campanha com base nas suas informações.
                </p>
              </div>
              <div className="flex justify-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-2 w-2 rounded-full bg-meta-blue animate-pulse"
                    style={{ animationDelay: `${i * 200}ms` }}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Isso leva alguns segundos...</p>
            </div>
          </div>
        )}

        {/* ── Phase: Review ────────────────────────────────────────────── */}
        {phase === "review" && plan && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-meta-blue text-white text-xs font-bold">2</div>
              <h2 className="text-base font-semibold">Revisar e Aprovar o Plano</h2>
              <span className="text-xs text-muted-foreground ml-1">
                Edite qualquer campo passando o mouse sobre ele — depois aprove para criar.
              </span>
            </div>
            <AdPlanReview
              plan={plan}
              isMock={isMock}
              onApprove={handleApprove}
              onBack={handleBackToForm}
            />
          </div>
        )}

        {/* ── Phase: Executing ─────────────────────────────────────────── */}
        {phase === "executing" && (
          <div className="max-w-lg mx-auto">
            <div className="rounded-xl border border-border bg-card p-6 space-y-5">
              <div className="text-center space-y-2">
                <div className="flex justify-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-meta-blue/10">
                    <Loader2 className="h-6 w-6 text-meta-blue animate-spin" />
                  </div>
                </div>
                <h2 className="text-base font-semibold">Criando campanha na Meta...</h2>
                <p className="text-xs text-muted-foreground">
                  {execGroups.length > 2
                    ? `Campanha com ${execGroups.length - 1} públicos`
                    : "Aguarde enquanto o anúncio é configurado"}
                </p>
              </div>

              <div className="space-y-4">
                {execGroups.map((g) => (
                  <div key={g.group_id} className="space-y-1.5">
                    <div className="flex items-center gap-2 px-1">
                      {g.group_id === CAMPAIGN_GROUP
                        ? <Megaphone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        : <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      <span className="text-xs font-semibold text-muted-foreground truncate">{g.group_name}</span>
                    </div>
                    {g.steps.map((s) => <StepRow key={s.step} s={s} />)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Phase: Done ──────────────────────────────────────────────── */}
        {phase === "done" && execResult && (
          <div className="max-w-lg mx-auto">
            <div className="rounded-xl border border-success/30 bg-success/5 p-6 space-y-4">
              <div className="text-center space-y-2">
                <div className="flex justify-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
                    <CheckCircle2 className="h-8 w-8 text-success" />
                  </div>
                </div>
                <h2 className="text-lg font-bold text-success">
                  {isMock ? "Simulação concluída!" : "Campanha criada com sucesso!"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {isMock
                    ? "Todos os passos foram simulados. Configure as credenciais reais para criar anúncios de verdade."
                    : `Campanha com ${execResult.adsets.length} público${execResult.adsets.length !== 1 ? "s" : ""} criada com status PAUSADO. Revise no Ads Manager e ative manualmente quando pronto.`}
                </p>
              </div>

              <div className="rounded-lg border border-border bg-card p-3 space-y-3">
                {/* Conta + campanha */}
                <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold">{execResult.account_name}</span>
                </div>
                <div className="rounded-md border border-border bg-muted/30 px-3 py-1.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Campanha ID</p>
                  <p className="text-xs font-mono text-foreground mt-0.5">{execResult.campaign_id}</p>
                </div>

                {/* Públicos */}
                {execResult.adsets.map((ad, i) => (
                  <div key={i} className="rounded-md border border-border bg-muted/20 p-2.5 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-4 w-4 items-center justify-center rounded bg-meta-blue/10 text-meta-blue text-[10px] font-bold">{i + 1}</div>
                      <span className="text-xs font-medium truncate">{ad.name}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { label: "Conjunto", value: ad.adset_id },
                        { label: "Criativo", value: ad.creative_id },
                        { label: "Anúncio", value: ad.ad_id },
                      ].map((item) => (
                        <div key={item.label} className="rounded border border-border bg-card px-2 py-1">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{item.label}</p>
                          <p className="text-[11px] font-mono text-foreground truncate">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {!isMock && (
                  <a
                    href={`https://adsmanager.facebook.com/adsmanager/manage/ads?act=${adAccounts.find((a) => a.id === execResult.account_id)?.meta_account_id ?? execResult.account_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-lg border border-meta-blue/30 bg-meta-blue/5 px-4 py-2 text-xs text-meta-blue font-medium hover:bg-meta-blue/10 transition-colors"
                  >
                    Abrir no Ads Manager
                  </a>
                )}
              </div>

              <Button variant="outline" className="w-full" onClick={handleReset}>
                Criar outro anúncio
              </Button>
            </div>
          </div>
        )}

        {/* ── Phase: Error ─────────────────────────────────────────────── */}
        {phase === "error" && (
          <div className="max-w-md mx-auto">
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 space-y-4 text-center">
              <div className="flex justify-center">
                <XCircle className="h-12 w-12 text-destructive" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-destructive mb-1">Ocorreu um erro</h2>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{planError}</p>
              </div>
              <div className="flex flex-col gap-2">
                {plan && (
                  <Button variant="meta" className="w-full" onClick={handleRetry}>
                    Tentar novamente
                  </Button>
                )}
                {plan && (
                  <Button variant="outline" className="w-full" onClick={() => setPhase("review")}>
                    Voltar à revisão
                  </Button>
                )}
                <Button variant="ghost" className="w-full text-muted-foreground" onClick={handleReset}>
                  Recomeçar do zero
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Run History ───────────────────────────────────────────────── */}
        <div className="mt-10">
          <Tabs defaultValue="history">
            <TabsList className="h-9">
              <TabsTrigger value="history" className="gap-1.5 text-xs">
                <History className="h-3.5 w-3.5" />
                Histórico de Criações
              </TabsTrigger>
            </TabsList>
            <TabsContent value="history" className="mt-4">
              <div className="rounded-xl border border-border bg-card p-4">
                <RunHistory accountMap={accountMap} refreshKey={historyRefreshKey} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
