"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Proposal = { id: string; title: string; status: string; currency: string; subtotal_cents: number; discount_cents: number; total_cents: number; valid_until: string | null; terms: string | null; signed_at: string | null; signed_name: string | null; items?: Array<{ id: string; description: string; quantity: number; unit_price_cents: number; total_cents: number }> };

function money(cents: number, currency: string) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100); }

export default function PublicProposalPage() {
  const params = useParams<{ token: string }>();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch(`/api/v1/public/proposals/${params.token}`).then(async (response) => {
      if (!response.ok) throw new Error("proposal_unavailable");
      const payload = await response.json() as { data?: Proposal };
      setProposal(payload.data ?? null);
    }).catch(() => setMessage("Esta proposta não está disponível ou expirou."));
  }, [params.token]);

  async function sign(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(null);
    try {
      const response = await fetch(`/api/v1/public/proposals/${params.token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signed_name: name }) });
      const payload = await response.json() as { data?: Proposal; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "signature_failed");
      setProposal((current) => current ? { ...current, ...payload.data, status: "accepted", signed_name: name } : current);
      setMessage("Proposta aceita com sucesso.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível aceitar a proposta."); }
    finally { setBusy(false); }
  }

  return <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 p-6"><header><h1 className="text-2xl font-semibold tracking-tight">{proposal?.title ?? "Proposta comercial"}</h1><p className="text-sm text-muted-foreground">Confira os detalhes antes de confirmar.</p></header>{message && <p className="text-sm text-muted-foreground" role="status">{message}</p>}{proposal && <><Card><CardHeader><CardTitle className="text-base">Itens da proposta</CardTitle></CardHeader><CardContent><ul className="divide-y">{(proposal.items ?? []).map((item) => <li key={item.id} className="flex justify-between gap-4 py-3 text-sm"><span>{item.description} × {item.quantity}</span><span>{money(item.total_cents, proposal.currency)}</span></li>)}</ul><div className="mt-4 flex justify-between border-t pt-4 font-semibold"><span>Total</span><span>{money(proposal.total_cents, proposal.currency)}</span></div>{proposal.terms && <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">{proposal.terms}</p>}</CardContent></Card>{proposal.status === "sent" ? <Card><CardHeader><CardTitle className="text-base">Aceite eletrônico</CardTitle></CardHeader><CardContent><form onSubmit={sign} className="flex flex-col gap-3 sm:flex-row"><Input aria-label="Nome completo" placeholder="Seu nome completo" value={name} onChange={(event) => setName(event.target.value)} minLength={2} required /><Button type="submit" disabled={busy}>{busy ? "Confirmando…" : "Aceitar proposta"}</Button></form></CardContent></Card> : <p className="rounded-md border p-4 text-sm text-muted-foreground">Status da proposta: {proposal.status}{proposal.signed_name ? ` · aceita por ${proposal.signed_name}` : ""}</p>}</>}</main>;
}
