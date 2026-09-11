"use client";

import { useT } from "@/hooks/i18n/useT";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function ResellerDashboardClient() {
  const t = useT();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{t("Dashboard da Revenda")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("Gerencie seus clientes, planos e limites de consumo.")}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t("Clientes Ativos")}</CardTitle>
            <CardDescription>{t("Total de organizações ativas sob sua gestão")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">12</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>{t("Consumo LLM (Mês)")}</CardTitle>
            <CardDescription>{t("Gasto total com IA neste ciclo")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">R$ 145,00</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("Licenças Disponíveis")}</CardTitle>
            <CardDescription>{t("Com base no seu plano Mega Admin")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">38 / 50</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("Gestão de Clientes")}</CardTitle>
          <CardDescription>{t("Ajuste os planos e bloqueie inadimplentes")}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Aqui futuramente listaremos a tabela de clientes com ações para trocar o plan_id e suspender a organização.
          </p>
          <Button variant="outline">{t("Ver Todos os Clientes")}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
