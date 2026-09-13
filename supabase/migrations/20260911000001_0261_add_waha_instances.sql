-- Migration: 20260911000001_add_waha_instances.sql
-- Description: Adiciona cluster de WAHA (instâncias) para balanceamento de carga

CREATE TABLE public.waha_instances (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid REFERENCES public.organizations(id), -- NULL se for pool público da revenda
    name text NOT NULL,
    api_url text NOT NULL,
    api_key_encrypted text, -- Opcional, para armazenar a chave daquela instância específica
    active_sessions integer NOT NULL DEFAULT 0,
    max_sessions integer NOT NULL DEFAULT 100,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'offline', 'maintenance')),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.waha_instances ENABLE ROW LEVEL SECURITY;

-- As instâncias "públicas" (organization_id NULL) são visíveis para todos
-- As dedicadas são visíveis apenas para a org.
CREATE POLICY "users_read_waha_instances" ON public.waha_instances
    FOR SELECT
    USING (
        organization_id IS NULL OR 
        organization_id IN (SELECT public.fn_user_org_ids()) OR 
        public.fn_is_platform_admin()
    );

CREATE POLICY "platform_admin_all_waha" ON public.waha_instances
    FOR ALL
    USING (public.fn_is_platform_admin())
    WITH CHECK (public.fn_is_platform_admin());

-- Adiciona a referência na tabela de sessões para saber em qual container WAHA ela mora
ALTER TABLE public.channel_sessions
ADD COLUMN waha_instance_id uuid REFERENCES public.waha_instances(id);
