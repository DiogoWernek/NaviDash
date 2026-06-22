"use client";

import { useState } from "react";
import { Wand2, Copy, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ImageUpload } from "./ImageUpload";

interface ImageGeneratorProps {
  initialPrompt?: string;
  onAccept: (url: string, preview: string) => void;
  disabled?: boolean;
}

export function ImageGenerator({ initialPrompt = "", onAccept, disabled }: ImageGeneratorProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    if (!initialPrompt.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/generate-image-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: initialPrompt }),
      });
      const data = await res.json() as { prompt?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Falha ao gerar prompt");
      setGeneratedPrompt(data.prompt ?? null);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!generatedPrompt) return;
    await navigator.clipboard.writeText(generatedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      {!generatedPrompt ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Claude cria um prompt detalhado em inglês com base nas informações do anúncio.
            Cole-o no <span className="font-medium text-foreground">Gemini</span> para gerar a imagem e depois faça upload aqui.
          </p>
          <Button
            type="button"
            className={cn("w-full h-9 gap-2 text-sm", loading && "bg-meta-blue/80")}
            onClick={generate}
            disabled={loading || !initialPrompt.trim() || disabled}
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Gerando prompt...</>
            ) : (
              <><Wand2 className="h-4 w-4" />Gerar Prompt com Claude</>
            )}
          </Button>
          {!initialPrompt.trim() && (
            <p className="text-[11px] text-muted-foreground text-center">
              Preencha o título e texto principal primeiro
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Prompt gerado</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1.5"
                onClick={copy}
              >
                {copied ? (
                  <><Check className="h-3 w-3 text-success" />Copiado!</>
                ) : (
                  <><Copy className="h-3 w-3" />Copiar</>
                )}
              </Button>
            </div>
            <Textarea
              value={generatedPrompt}
              onChange={(e) => setGeneratedPrompt(e.target.value)}
              rows={5}
              className="text-xs font-mono resize-none"
            />
            <p className="text-[11px] text-muted-foreground">
              Você pode editar o prompt. Cole no{" "}
              <span className="font-medium text-foreground">Gemini</span>{" "}
              (gemini.google.com) ou outro gerador de imagens.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[11px] text-muted-foreground">Após gerar, faça upload aqui</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <ImageUpload
            onUpload={(url, preview) => onAccept(url, preview)}
            onClear={() => {}}
            imageUrl={null}
            disabled={disabled}
          />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full h-7 text-xs text-muted-foreground gap-1.5"
            onClick={() => { setGeneratedPrompt(null); setError(null); }}
            disabled={disabled}
          >
            <Wand2 className="h-3 w-3" />
            Gerar novo prompt
          </Button>
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive flex items-center gap-1.5">
          <X className="h-3 w-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
