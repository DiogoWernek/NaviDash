"use client";

import { useState, useEffect } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { FacebookPage } from "@/types";

interface Props {
  value: string;
  onChange: (pageId: string) => void;
  error?: boolean;
}

export function FacebookPageSelect({ value, onChange, error }: Props) {
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");
  const [metaPageId, setMetaPageId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/facebook-pages")
      .then((r) => r.json())
      .then((data: FacebookPage[]) => setPages(Array.isArray(data) ? data : []))
      .catch(() => setPages([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!name.trim() || !metaPageId.trim()) {
      setSaveError("Preencha os dois campos.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/facebook-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), meta_page_id: metaPageId.trim() }),
      });
      const created = await res.json() as FacebookPage & { error?: string };
      if (!res.ok) {
        setSaveError(created.error ?? "Erro ao salvar.");
        return;
      }
      setPages((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      onChange(created.meta_page_id);
      setOpen(false);
      setName("");
      setMetaPageId("");
    } catch {
      setSaveError("Erro de conexão.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex gap-2">
        <Select
          value={value}
          onValueChange={onChange}
          disabled={loading}
        >
          <SelectTrigger className={cn("h-9 text-sm flex-1", error && !value && "border-destructive")}>
            {loading
              ? <span className="flex items-center gap-1.5 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Carregando...</span>
              : <SelectValue placeholder="Selecione uma página..." />
            }
          </SelectTrigger>
          <SelectContent>
            {pages.length === 0 && (
              <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                Nenhuma página cadastrada
              </div>
            )}
            {pages.map((p) => (
              <SelectItem key={p.id} value={p.meta_page_id}>
                <span className="font-medium">{p.name}</span>
                <span className="ml-2 font-mono text-muted-foreground text-[11px]">{p.meta_page_id}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 px-2.5 shrink-0"
          onClick={() => setOpen(true)}
          title="Cadastrar nova página"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar Página do Facebook</DialogTitle>
            <DialogDescription>
              Encontre o ID em: Página → Sobre → role até o fim → &quot;ID da Página&quot;
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Nome da Página <span className="text-destructive">*</span>
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Clínica Saúde Total"
                className="h-9 text-sm"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                ID da Página <span className="text-destructive">*</span>
              </Label>
              <Input
                value={metaPageId}
                onChange={(e) => setMetaPageId(e.target.value.replace(/\D/g, ""))}
                placeholder="Ex: 123456789012345"
                className="h-9 text-sm font-mono"
              />
            </div>

            {saveError && (
              <p className="text-xs text-destructive">{saveError}</p>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-9 text-sm"
                onClick={() => { setOpen(false); setSaveError(null); setName(""); setMetaPageId(""); }}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="flex-1 h-9 text-sm"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
