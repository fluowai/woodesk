import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { WelcomeForm } from "./_form";
import { branding } from "@/lib/branding";
import { createClient } from "@/lib/supabase/server";
import { lerRetratoDaInstalacao } from "@/lib/instalacao/retrato";
import { traduzir } from "@/lib/i18n/dicionario";

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/login");
  const idioma = user.idioma;

  const supabase = await createClient();
  const retrato = await lerRetratoDaInstalacao({ supabase, orgId: activeOrg.orgId });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
      
      {/* Left Column - Main Form Area */}
      <div className="flex flex-col bg-white rounded-3xl shadow-sm border border-slate-100 p-8 md:p-10">
        <div className="mb-6 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 21V9.5C4 8.94772 4.44772 8.5 5 8.5H19C19.5523 8.5 20 8.94772 20 9.5V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14 21V16.5C14 15.9477 13.5523 15.5 13 15.5H11C10.4477 15.5 10 15.9477 10 16.5V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4 8.5L12 3L20 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9.5 12H10.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13.5 12H14.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold tracking-tight text-slate-900">
              {traduzir("Conte um pouco sobre o seu negócio", idioma)}
            </h3>
            <p className="text-slate-500 mt-1">
              {traduzir("Essas informações nos ajudam a personalizar sua experiência.", idioma)}
            </p>
          </div>
        </div>
        
        <div className="flex-1">
          <WelcomeForm defaultOrgName={retrato.empresa.aindaSemNomeProprio ? "" : activeOrg.name} />
        </div>
        
        <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-6">
          <div className="text-sm text-slate-400">
            {branding().name} • v1.0.0
          </div>
          <div className="text-blue-600 italic text-sm" style={{ fontFamily: "cursive" }}>
            {traduzir("Tecnologia que aproxima pessoas! 💙", idioma)}
          </div>
        </div>
      </div>

      {/* Right Column - Promos / Tips */}
      <div className="flex flex-col gap-6">
        
        {/* Banner */}
        <div className="rounded-3xl bg-blue-50 border border-blue-100 p-8 overflow-hidden relative">
          <div className="relative z-10">
            <div className="text-xs font-bold text-blue-600 mb-2 uppercase tracking-wider">
              {branding().name.toUpperCase()}
            </div>
            <h3 className="text-2xl font-bold tracking-tight text-slate-900 mb-4 leading-tight">
              Mais que<br />atendimento,<br />relacionamentos<br />de verdade.
            </h3>
            <div className="h-0.5 w-8 bg-blue-600 mb-6"></div>
            <p className="text-sm text-slate-700 leading-relaxed">
              Organize, automatize e venda mais com o {branding().name}.
            </p>
          </div>
          <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-white/40 rounded-full blur-2xl z-0"></div>
          {/* Fictional graphic representation matching the image */}
          <div className="absolute right-0 bottom-4 w-40 opacity-90 z-0">
             <div className="bg-white rounded-xl shadow-lg p-3 mb-2 transform -translate-x-4">
                <div className="h-2 w-16 bg-slate-200 rounded-full mb-2"></div>
                <div className="h-2 w-12 bg-slate-200 rounded-full"></div>
             </div>
             <div className="bg-blue-600 text-white rounded-xl shadow-lg p-3 rounded-bl-none transform translate-x-2 relative z-10">
                <div className="h-2 w-20 bg-blue-400 rounded-full mb-2"></div>
                <div className="h-2 w-16 bg-blue-400 rounded-full"></div>
             </div>
          </div>
        </div>
        
        {/* Tip */}
        <div className="rounded-3xl bg-blue-50/50 border border-blue-100 p-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">💡</span>
            <h4 className="text-base font-bold text-slate-900">Dica</h4>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Quanto mais informações você preencher, melhor poderemos personalizar sua experiência e sugerir configurações ideais para o seu negócio.
          </p>
        </div>
        
      </div>
      
    </div>
  );
}
