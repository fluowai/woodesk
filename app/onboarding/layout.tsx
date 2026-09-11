import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { loadOnboardingState } from "@/app/actions/onboarding/_shared";
import { Stepper } from "./_components/Stepper";
import { SkipToEnd } from "./_components/SkipToEnd";
import { branding } from "@/lib/branding";
import { passosVisiveis } from "@/lib/onboarding/passos";
import { env } from "@/lib/env";
import { IdiomaProvider } from "@/lib/i18n/IdiomaProvider";
import { OnboardingShell } from "./_components/OnboardingShell";
import { AuthProvider } from "@/hooks/auth/AuthProvider";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (user.support) redirect("/app/inbox");
  if (!activeOrg) redirect("/get-started");

  const { state, onboardedAt } = await loadOnboardingState(activeOrg.orgId);
  if (onboardedAt) redirect("/app/inbox");

  const passos = passosVisiveis({ lojaLigada: env.NUVEMSHOP_ENABLED }).map((p) => ({
    segmento: p.segmento,
    rotulo: p.rotulo,
    cumprido: p.cumprido(state),
  }));

  const isDev = process.env.NODE_ENV !== "production";

  return (
    <IdiomaProvider locale={user.locale}>
      <AuthProvider user={user} activeOrg={activeOrg}>
        <OnboardingShell>
          <div className="mx-auto w-full max-w-[1200px]">
            
            <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h1 className="mb-2 text-sm font-bold uppercase tracking-widest text-blue-600">
                  ONBOARDING {branding().name.toUpperCase()}
                </h1>
                <h2 className="text-3xl font-bold tracking-tight text-slate-800">
                  Vamos configurar seu <span className="text-blue-600">{branding().name}</span>
                </h2>
                <p className="mt-2 text-slate-500">
                  Em poucos passos você estará pronto para atender seus clientes e impulsionar seu negócio.
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex max-w-[320px] items-start gap-3 rounded-2xl bg-blue-50/50 border border-blue-100 p-4">
                  <div className="mt-0.5 text-blue-600">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 8L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 16.01L12.01 15.9989" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-blue-900">Que bom ter você aqui!</h4>
                    <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
                      Vamos deixar tudo pronto para o seu sucesso.
                    </p>
                  </div>
                </div>

                {isDev ? (
                  <div className="shrink-0">
                    <SkipToEnd />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mb-8">
              <Stepper passos={passos} />
            </div>

            {children}

          </div>
        </OnboardingShell>
      </AuthProvider>
    </IdiomaProvider>
  );
}
