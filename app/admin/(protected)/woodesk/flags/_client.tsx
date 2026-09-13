"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Flag = { key: string; enabled: boolean; config: Record<string, unknown>; updated_at: string | null };

export function WoodeskFlagsClient() {
  const [organizationId, setOrganizationId] = useState("");
  const [flags, setFlags] = useState<Flag[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setMessage(null);
    const response = await fetch(`/api/v1/admin/woodesk/feature-flags?organization_id=${encodeURIComponent(organizationId)}`);
    if (!response.ok) throw new Error("flags_load_failed");
    const payload = await response.json() as { data?: { flags?: Flag[] } };
    setFlags(payload.data?.flags ?? []);
  }

  async function toggle(flag: Flag) {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/v1/admin/woodesk/feature-flags", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organization_id: organizationId, key: flag.key, enabled: !flag.enabled, config: flag.config }) });
      if (!response.ok) throw new Error("flag_update_failed");
      setFlags((current) => current.map((item) => item.key === flag.key ? { ...item, enabled: !item.enabled } : item));
      setMessage(`Flag ${flag.key} atualizada.`);
    } catch { setMessage("Não foi possível atualizar a flag."); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6 p-6"><header><h1 className="text-2xl font-semibold tracking-tight">Feature flags Woodesk</h1><p className="text-sm text-muted-foreground">Operação exclusiva de platform admin por organização.</p></header><Card><CardHeader><CardTitle className="text-base">Consultar organização</CardTitle></CardHeader><CardContent><form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); void load().catch(() => setMessage("Não foi possível carregar as flags.")); }}><Input className="min-w-80 flex-1" aria-label="ID da organização" placeholder="UUID da organização" value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} required /><Button type="submit">Carregar</Button></form></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Flags Woodesk</CardTitle></CardHeader><CardContent>{flags.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma flag disponível.</p> : <ul className="divide-y">{flags.map((flag) => <li key={flag.key} className="flex items-center justify-between gap-3 py-3 text-sm"><span><strong>{flag.key}</strong><br /><span className="text-xs text-muted-foreground">{flag.updated_at ? `Atualizada em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(flag.updated_at))}` : "Ainda não configurada"}</span></span><Button type="button" variant={flag.enabled ? "secondary" : "outline"} disabled={busy} onClick={() => void toggle(flag)}>{flag.enabled ? "Desabilitar" : "Habilitar"}</Button></li>)}</ul>}</CardContent></Card>{message && <p className="text-sm text-muted-foreground" role="status">{message}</p>}</div>;
}
