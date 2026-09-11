"use client";
import { AlertsBell } from "./AlertsBell";
import { MobileSidebar } from "./MobileSidebar";
import { TenantSwitcher } from "./TenantSwitcher";
import { UserMenu } from "./UserMenu";
import { SearchTrigger } from "./SearchTrigger";

import { useMarcaDaInstalacao } from "@/lib/branding/contexto";
import { useAuth } from "@/hooks/auth/AuthProvider";

export function TopBar() {
  const brand = useMarcaDaInstalacao();
  const { activeOrg } = useAuth();
  const nome = activeOrg?.marca?.nome ?? brand.name;
  const logo = activeOrg?.marca?.logoUrl || brand.logoUrl;

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 border-b bg-background px-3 md:gap-4 md:px-6">
      <div className="flex min-w-0 items-center gap-4">
        <MobileSidebar />
        <div className="hidden md:flex items-center">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={nome} className="h-7 w-auto max-w-[10rem] object-contain" />
          ) : (
            <span className="font-semibold tracking-tight">{nome}</span>
          )}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 justify-center md:max-w-md">
        <SearchTrigger />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <TenantSwitcher />
        <AlertsBell />
        <UserMenu />
      </div>
    </header>
  );
}
