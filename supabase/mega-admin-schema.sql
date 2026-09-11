-- Schema para o Banco de Dados Central (Control Plane) do Mega Admin
-- ATENÇÃO: Este script NÃO deve ser rodado nas instâncias das Revendas.
-- Ele deve ser aplicado apenas no Supabase do Dono da Plataforma.

CREATE TABLE public.resellers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    contact_email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled'))
);

CREATE TABLE public.licenses (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    reseller_id uuid REFERENCES public.resellers(id) NOT NULL,
    license_key text NOT NULL UNIQUE,
    tier text NOT NULL DEFAULT 'pro',
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
    features jsonb DEFAULT '{}'::jsonb
);

-- RLS
ALTER TABLE public.resellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

-- As requisições para esse banco serão feitas exclusivamente via SERVICE_ROLE KEY
-- pelas instâncias das revendas (apenas leitura para validar, ou ping de telemetria)
-- e pela interface do Mega Admin. Logo, não precisamos de policies complexas para `authenticated`.

CREATE POLICY "Service Role Full Access" ON public.resellers
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service Role Full Access" ON public.licenses
    FOR ALL
    USING (true)
    WITH CHECK (true);
