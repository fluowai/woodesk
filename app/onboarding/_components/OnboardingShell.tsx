"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/hooks/auth/AuthProvider";
import { UserMenu } from "@/components/shell/UserMenu";
import { AlertsBell } from "@/components/shell/AlertsBell";
import { branding } from "@/lib/branding";
import { 
  House, 
  CheckCircle, 
  ChatTeardropText, 
  Users, 
  Sparkle, 
  LinkSimple, 
  Gear, 
  Question,
  Headset,
  ArrowSquareOut,
  MagnifyingGlass,
  ChartBar
} from "@phosphor-icons/react";
import { useT } from "@/hooks/i18n/useT";

function OnboardingSidebar() {
  const t = useT();
  const { name: appName, logo_url: logoUrl } = branding();

  return (
    <div className="flex h-full w-64 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-16 shrink-0 items-center px-6 mt-2">
        {logoUrl ? (
          <img src={logoUrl} alt={appName} className="h-8 object-contain" />
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black text-blue-600 tracking-tighter">W</span>
            <span className="font-bold text-xl text-slate-900">{appName}</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-4">
        <nav className="space-y-1">
          <div className="flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50 cursor-pointer">
            <House className="h-5 w-5" />
            {t("Início")}
          </div>
          
          <div className="flex items-center gap-3 rounded-full bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-600">
            <CheckCircle className="h-5 w-5" weight="regular" />
            {t("Onboarding")}
          </div>

          <div className="flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50 cursor-pointer">
            <ChatTeardropText className="h-5 w-5" />
            {t("Canais")}
          </div>

          <div className="flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50 cursor-pointer">
            <Users className="h-5 w-5" />
            {t("Equipe")}
          </div>

          <div className="flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50 cursor-pointer">
            <Sparkle className="h-5 w-5" />
            {t("IA e Automação")}
          </div>

          <div className="flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50 cursor-pointer">
            <LinkSimple className="h-5 w-5" />
            {t("Integrações")}
          </div>
          
          <div className="flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50 cursor-pointer">
            <ChartBar className="h-5 w-5" />
            {t("Relatórios")}
          </div>

          <div className="flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50 cursor-pointer">
            <Gear className="h-5 w-5" />
            {t("Configurações")}
          </div>
        </nav>
      </div>

      <div className="p-4">
        <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center text-blue-600">
            <Headset className="h-6 w-6" weight="fill" />
          </div>
          <h4 className="mb-2 text-sm font-bold text-slate-900">{t("Precisa de ajuda?")}</h4>
          <p className="mb-5 text-xs text-slate-500 px-1 leading-relaxed">
            {t("Nossa equipe está pronta para te atender.")}
          </p>
          <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors">
            {t("Abrir suporte")}
            <ArrowSquareOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function OnboardingTopBar() {
  const t = useT();
  
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-8">
      <div className="flex w-full max-w-md items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-slate-500">
        <MagnifyingGlass className="h-4 w-4" />
        <input 
          type="text" 
          placeholder={t("Buscar algo no onboarding...")}
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <button className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition-colors">
          <Question className="h-5 w-5" />
        </button>
        <button className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition-colors">
          <AlertsBell />
        </button>
        <div className="h-5 w-px bg-slate-200 mx-1"></div>
        <UserMenu />
      </div>
    </header>
  );
}

export function OnboardingShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full bg-[#f8fafc]">
      <div className="hidden md:block">
        <OnboardingSidebar />
      </div>
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <OnboardingTopBar />
        <main className="flex-1 overflow-auto px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
