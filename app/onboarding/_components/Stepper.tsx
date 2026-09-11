"use client";

import { usePathname } from "next/navigation";
import { useT } from "@/hooks/i18n/useT";
import { cn } from "@/lib/utils";

export interface PassoVisivel {
  segmento: string;
  rotulo: string;
  cumprido: boolean;
}

const DESCRICOES: Record<string, string> = {
  "Seu negócio": "Informações básicas",
  "Canais": "Telefone e outros",
  "Equipe": "Convidar e treinar",
  "Organização": "Filas e departamentos",
  "Atendimento": "Regras e IA",
  "Pronto!": "Tudo configurado"
};

export function Stepper({ passos }: { passos: PassoVisivel[] }) {
  const t = useT();
  const pathname = usePathname() ?? "";
  const idx = passos.findIndex((p) => pathname.includes(`/${p.segmento}`));

  // Ensure index is at least 0
  const activeIdx = idx === -1 ? 0 : idx;
  
  // Calculate progress width based on current step (e.g. 1st step = 0%, 2nd = 20%, etc)
  const progressWidth = passos.length > 1 ? (activeIdx / (passos.length - 1)) * 100 : 0;

  return (
    <div className="relative">
      {/* Background connecting line */}
      <div className="absolute left-0 top-[18px] w-full h-[2px] bg-slate-200 -z-10 px-[10%]" />
      
      {/* Active progress line */}
      <div 
        className="absolute left-[10%] top-[18px] h-[2px] bg-blue-600 -z-10 transition-all duration-300"
        style={{ width: `calc(${progressWidth}% * 0.8)` }}
      />
      
      <ol
        aria-label="onboarding steps"
        className="flex w-full items-start justify-between"
      >
        {passos.map((p, i) => {
          const isActive = i === activeIdx;
          const isCompleted = i < activeIdx || p.cumprido;
          const sublabel = DESCRICOES[p.rotulo];

          return (
            <li
              key={p.segmento}
              aria-current={isActive ? "step" : undefined}
              className="flex flex-1 flex-col items-center group bg-[#f8fafc]"
            >
              <div className="bg-[#f8fafc] px-4 pb-2">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold mx-auto",
                    (isActive || isCompleted) 
                      ? "bg-blue-600 text-white"
                      : "bg-slate-200 text-slate-500"
                  )}
                >
                  {i + 1}
                </div>
              </div>
              <div className="text-center mt-1">
                <span
                  className={cn(
                    "block text-[15px] font-bold",
                    isActive || isCompleted ? "text-slate-900" : "text-slate-500"
                  )}
                >
                  {t(p.rotulo)}
                </span>
                {sublabel && (
                  <span className="hidden md:block text-xs font-medium text-slate-500 mt-0.5">
                    {t(sublabel)}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
