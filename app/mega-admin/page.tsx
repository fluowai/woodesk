import { notFound } from "next/navigation";
import { env } from "@/lib/env";
import { MegaAdminClient } from "./_client";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mega Admin | Control Plane",
};

export default function MegaAdminPage({
  searchParams,
}: {
  searchParams: { secret?: string };
}) {
  // 1. Só existe se o ambiente tiver as chaves master configuradas
  if (!env.MEGA_ADMIN_DB_URL || !env.MEGA_ADMIN_SERVICE_ROLE_KEY) {
    notFound();
  }

  // 2. Proteção super simples via INTERNAL_SECRET na URL ou cookie
  // Em produção real, você pode plugar um SSO ou Auth robusto aqui.
  if (searchParams.secret !== env.INTERNAL_SECRET) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-zinc-950 text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Acesso Negado</h1>
          <p className="mt-2 text-zinc-400">Forneça o secret correto para acessar o Control Plane.</p>
        </div>
      </div>
    );
  }

  return <MegaAdminClient />;
}
