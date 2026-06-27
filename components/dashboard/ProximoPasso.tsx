"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, Palette, Target, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const PASSOS = [
  {
    href: "/campanhas",
    icon: BarChart3,
    title: "Campanhas",
    desc: "Veja desempenho detalhado de cada campanha, conjuntos e anúncios.",
    color: "text-meta-blue",
    bg: "bg-meta-blue/10",
  },
  {
    href: "/criativos",
    icon: Palette,
    title: "Criativos",
    desc: "Analise galeria de anúncios com métricas de engajamento e vídeo.",
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
  {
    href: "/otimizacao",
    icon: Target,
    title: "Eficiência",
    desc: "Compare CPL, CPA e custo por conversa entre campanhas e conjuntos.",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    href: "/publico",
    icon: Users,
    title: "Público",
    desc: "Explore distribuição geográfica e demográfica do seu público.",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
];

export function ProximoPasso() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {PASSOS.map((p) => {
        const Icon = p.icon;
        return (
          <Link key={p.href} href={p.href}>
            <Card className="group h-full cursor-pointer hover:shadow-md hover:border-border transition-all">
              <CardContent className="p-4 flex flex-col gap-2.5 h-full">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${p.bg}`}>
                  <Icon className={`h-4 w-4 ${p.color}`} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{p.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{p.desc}</p>
                </div>
                <div className={`flex items-center gap-1 text-xs font-medium ${p.color} group-hover:gap-2 transition-all`}>
                  Ver análise <ArrowRight className="h-3 w-3" />
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
