import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "@/lib/database.types"; // Using current types as baseline

/**
 * Cliente exclusivo do Mega Admin (Control Plane).
 * Diferente do `admin.ts`, este NÃO aponta para o Supabase da Revenda local,
 * mas sim para o banco central do dono do SaaS, para consultar licenças, faturamento, etc.
 * 
 * ⚠️ NUNCA vaze esta conexão para o Data Plane (app do cliente).
 */
export function getMegaAdminClient() {
  if (!env.MEGA_ADMIN_DB_URL || !env.MEGA_ADMIN_SERVICE_ROLE_KEY) {
    throw new Error("Credenciais do Mega Admin não configuradas no ambiente.");
  }
  
  return createClient<Database>(
    env.MEGA_ADMIN_DB_URL,
    env.MEGA_ADMIN_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false },
    }
  );
}
