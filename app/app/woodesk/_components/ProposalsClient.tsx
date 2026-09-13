"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { copyToClipboard } from "@/lib/clipboard";

type Item = { description: string; quantity: string; unit_price_cents: string };
type ProposalItem = { id?: string; description: string; quantity: number; unit_price_cents: number };
type Proposal = { id: string; title: string; status: string; total_cents: number; currency: string; created_at: string; discount_cents?: number; valid_until?: string | null; terms?: string | null; commercial_proposal_items?: ProposalItem[] };

function money(cents: number, currency: string) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100); }

export function ProposalsClient() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<Item[]>([{ description: "", quantity: "1", unit_price_cents: "0" }]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [discount, setDiscount] = useState("0");
  const [terms, setTerms] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [publicLink, setPublicLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch("/api/v1/woodesk/proposals");
    if (!response.ok) throw new Error("proposals_load_failed");
    const payload = await response.json() as { data?: { proposals?: Proposal[] } };
    setProposals(payload.data?.proposals ?? []);
  }
  useEffect(() => { void load().catch(() => setMessage("Não foi possível carregar as propostas.")); }, []);

  function edit(proposal: Proposal) {
    setEditingId(proposal.id); setTitle(proposal.title); setDiscount(String(proposal.discount_cents ?? 0)); setTerms(proposal.terms ?? "");
    setItems((proposal.commercial_proposal_items ?? []).map((item) => ({ description: item.description, quantity: String(item.quantity), unit_price_cents: String(item.unit_price_cents) })));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function clearEditor() { setEditingId(null); setTitle(""); setDiscount("0"); setTerms(""); setItems([{ description: "", quantity: "1", unit_price_cents: "0" }]); }

  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(null);
    try {
      const editing = Boolean(editingId);
      const response = await fetch(editing ? `/api/v1/woodesk/proposals/${editingId}` : "/api/v1/woodesk/proposals", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, discount_cents: Number(discount), terms: terms || undefined, items: items.map((item) => ({ description: item.description, quantity: Number(item.quantity), unit_price_cents: Number(item.unit_price_cents) })) }) });
      if (!response.ok) throw new Error("proposal_create_failed");
      clearEditor(); setMessage(editing ? "Rascunho atualizado." : "Proposta criada como rascunho."); await load();
    } catch { setMessage("Não foi possível criar a proposta. Confira os itens e o recurso."); }
    finally { setBusy(false); }
  }

  async function send(id: string) {
    const response = await fetch(`/api/v1/woodesk/proposals/${id}/send`, { method: "POST" });
    if (!response.ok) { setMessage("Não foi possível enviar a proposta."); return; }
    const payload = await response.json() as { data?: { public_token?: string } };
    const token = payload.data?.public_token;
    setPublicLink(token ? `${window.location.origin}/public/proposals/${token}` : null);
    setMessage("Proposta enviada. Copie o link público agora; ele não será exibido novamente.");
    await load();
  }

  return <div className="flex h-full flex-col gap-6 p-6">
    <header><h1 className="text-2xl font-semibold tracking-tight">Propostas comerciais</h1><p className="text-sm text-muted-foreground">Monte ofertas com itens, valores e condições para seus leads.</p></header>
    {message && <p className="text-sm text-muted-foreground" role="status">{message}</p>}
    {publicLink && <Card><CardHeader><CardTitle className="text-base">Link público da proposta</CardTitle></CardHeader><CardContent><p className="break-all rounded-md border bg-muted p-3 text-sm">{publicLink}</p><Button type="button" className="mt-3" onClick={() => void copyToClipboard(publicLink)}>Copiar link</Button></CardContent></Card>}
    <Card><CardHeader><CardTitle className="text-base">{editingId ? "Editar rascunho" : "Nova proposta"}</CardTitle></CardHeader><CardContent><form onSubmit={create} className="space-y-4"><Input aria-label="Título da proposta" placeholder="Título da proposta" value={title} onChange={(event) => setTitle(event.target.value)} required /><Input aria-label="Desconto em centavos" type="number" min="0" step="1" value={discount} onChange={(event) => setDiscount(event.target.value)} /><Input aria-label="Condições" placeholder="Condições comerciais (opcional)" value={terms} onChange={(event) => setTerms(event.target.value)} />{items.map((item, index) => <div key={index} className="grid gap-2 sm:grid-cols-[1fr_100px_150px_auto]"><Input aria-label={`Item ${index + 1}`} placeholder="Descrição do item" value={item.description} onChange={(event) => setItems((current) => current.map((value, position) => position === index ? { ...value, description: event.target.value } : value))} required /><Input aria-label={`Quantidade do item ${index + 1}`} type="number" min="0.001" step="0.001" value={item.quantity} onChange={(event) => setItems((current) => current.map((value, position) => position === index ? { ...value, quantity: event.target.value } : value))} required /><Input aria-label={`Preço do item ${index + 1}`} type="number" min="0" step="1" value={item.unit_price_cents} onChange={(event) => setItems((current) => current.map((value, position) => position === index ? { ...value, unit_price_cents: event.target.value } : value))} required />{items.length > 1 && <Button type="button" variant="ghost" onClick={() => setItems((current) => current.filter((_, position) => position !== index))}>Remover</Button>}</div>)}<div className="flex flex-wrap gap-3"><Button type="button" variant="secondary" onClick={() => setItems((current) => [...current, { description: "", quantity: "1", unit_price_cents: "0" }])}>Adicionar item</Button><Button type="submit" disabled={busy}>{busy ? "Salvando…" : editingId ? "Salvar rascunho" : "Criar rascunho"}</Button>{editingId && <Button type="button" variant="ghost" onClick={clearEditor}>Cancelar</Button>}</div></form></CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Propostas recentes</CardTitle></CardHeader><CardContent>{proposals.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma proposta criada ainda.</p> : <ul className="divide-y">{proposals.map((proposal) => <li key={proposal.id} className="flex flex-col gap-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"><span><strong>{proposal.title}</strong> · {proposal.status} · {money(proposal.total_cents, proposal.currency)}</span>{proposal.status === "draft" && <div className="flex gap-2"><Button type="button" variant="ghost" onClick={() => edit(proposal)}>Editar</Button><Button type="button" variant="secondary" onClick={() => void send(proposal.id)}>Enviar</Button></div>}</li>)}</ul>}</CardContent></Card>
  </div>;
}
