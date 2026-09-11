"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function MegaAdminClient() {
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  const handleGenerateKey = () => {
    // Aqui no futuro chamaremos uma action server-side para gerar o par RSA
    // e inserir na tabela `licenses` do Banco Master.
    setGeneratedKey("sk_live_master_" + Math.random().toString(36).substring(2, 15));
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-8 text-zinc-100">
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Mega Admin Control Plane</h1>
          <p className="mt-2 text-zinc-400">Gerencie revendas, licenças e faturamento global.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
            <CardHeader>
              <CardTitle>Gerador de Licenças (RSA)</CardTitle>
              <CardDescription className="text-zinc-400">
                Crie uma chave criptografada para uma nova revenda.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={handleGenerateKey} className="w-full bg-indigo-600 hover:bg-indigo-700">
                Gerar Nova Licença
              </Button>
              {generatedKey && (
                <div className="mt-4 rounded-md bg-zinc-950 p-4 font-mono text-sm break-all text-green-400 border border-zinc-800">
                  {generatedKey}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
            <CardHeader>
              <CardTitle>Revendas Ativas</CardTitle>
              <CardDescription className="text-zinc-400">
                Monitoramento de ping e status.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-white">4</div>
              <p className="mt-2 text-sm text-zinc-400">Instâncias rodando o baseline SaaS.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
