"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useT } from "@/hooks/i18n/useT";

import { acceptWelcome } from "@/app/actions/onboarding/acceptWelcome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Buildings, MapPin } from "@phosphor-icons/react";

const FUSOS: { id: string; cidade: string }[] = [
  { id: "America/Sao_Paulo", cidade: "São Paulo, Rio, Brasília, Sul e Sudeste" },
  { id: "America/Recife", cidade: "Recife, Salvador, Fortaleza e Nordeste" },
  { id: "America/Belem", cidade: "Belém e Pará" },
  { id: "America/Manaus", cidade: "Manaus e Amazonas" },
  { id: "America/Cuiaba", cidade: "Cuiabá e Mato Grosso" },
  { id: "America/Rio_Branco", cidade: "Rio Branco e Acre" },
  { id: "America/Argentina/Buenos_Aires", cidade: "Buenos Aires" },
  { id: "Europe/Lisbon", cidade: "Lisboa" },
  { id: "Europe/Madrid", cidade: "Madri" },
  { id: "America/New_York", cidade: "Nova York" },
  { id: "America/Los_Angeles", cidade: "Los Angeles" },
  { id: "UTC", cidade: "Outro (horário universal)" },
];

export function WelcomeForm({ defaultOrgName }: { defaultOrgName: string }) {
  const t = useT();
  const [displayName, setDisplayName] = useState(defaultOrgName);
  const [oQueFaz, setOQueFaz] = useState("");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [accepted, setAccepted] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-6 mt-6"
      action={(formData) => {
        if (!accepted) {
          toast.error(t("Aceite os termos para continuar."));
          return;
        }
        startTransition(async () => {
          const res = await acceptWelcome(formData);
          if (res && !res.ok) {
            toast.error(`Falha: ${res.error}`);
          }
        });
      }}
    >
      <div className="space-y-2.5">
        <Label htmlFor="display_name" className="text-sm font-bold text-slate-900">{t("Nome do seu negócio")}</Label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-slate-400">
            <Buildings className="w-5 h-5" />
          </div>
          <Input
            id="display_name"
            name="display_name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            minLength={2}
            maxLength={120}
            required
            className="pl-11 h-12 rounded-xl border-slate-200 text-slate-900 bg-white"
            placeholder={t("Woodesk Chat")}
          />
        </div>
        <p className="text-xs text-slate-400">
          {t("É o nome que aparecerá para sua equipe e nos relatórios.")}
        </p>
      </div>

      <div className="space-y-2.5">
        <Label htmlFor="o_que_faz" className="text-sm font-bold text-slate-900">{t("O que vocês fazem?")}</Label>
        <Input
          id="o_que_faz"
          name="o_que_faz"
          value={oQueFaz}
          onChange={(e) => setOQueFaz(e.target.value)}
          maxLength={280}
          className="h-12 rounded-xl border-slate-200 text-slate-900 bg-white"
          placeholder={t("Ex.: clínica odontológica, venda de roupas, serviços de TI...")}
        />
        <p className="text-xs text-slate-400">
          {t("Uma breve descrição ajuda a configurar os módulos e sugestões mais relevantes para o seu segmento.")}
        </p>
      </div>

      <div className="space-y-2.5">
        <Label htmlFor="timezone" className="text-sm font-bold text-slate-900">{t("Onde você atende?")}</Label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-slate-400 z-10">
            <MapPin className="w-5 h-5" />
          </div>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger id="timezone" className="pl-11 h-12 rounded-xl border-slate-200 text-slate-900 bg-white w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FUSOS.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {t(f.cidade)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <input type="hidden" name="timezone" value={timezone} />
        <p className="text-xs text-slate-400">
          {t("Selecione a região principal em que seu negócio atua.")}
        </p>
      </div>

      <label className="flex items-start gap-2 text-xs text-slate-400 pt-2 cursor-pointer opacity-80 hover:opacity-100 transition-opacity">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
          required
        />
        <span>
          {t("Li e aceito os")}{" "}
          <a className="underline hover:text-slate-600" href="/legal/terms" target="_blank" rel="noreferrer">
            {t("Termos de Uso")}
          </a>{" "}
          {t("e a")}{" "}
          <a className="underline hover:text-slate-600" href="/legal/privacy" target="_blank" rel="noreferrer">
            {t("Política de Privacidade")}
          </a>
          .
        </span>
      </label>

      <div className="mt-8 flex items-center justify-end gap-6 pt-4">
        <div className="text-sm text-slate-400">
          {t("Passo 1 de 6")}
        </div>
        <Button 
          type="submit" 
          disabled={pending || !accepted} 
          className="h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-sm transition-all"
        >
          {pending ? t("Salvando...") : (
            <>
              {t("Continuar")}
              <svg className="ml-2 w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
