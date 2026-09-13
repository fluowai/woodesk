-- Migration: 20260911000000_add_saas_plans.sql
-- Description: Adiciona tabelas de Planos e Limites para o modelo SaaS (Revendas limitando clientes)

CREATE TABLE IF NOT EXISTS public.plans (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    max_users integer NOT NULL DEFAULT 1,
    max_waha_connections integer NOT NULL DEFAULT 1,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_admin_all_plans" ON public.plans
    FOR ALL
    USING (public.fn_is_platform_admin())
    WITH CHECK (public.fn_is_platform_admin());

CREATE POLICY "users_read_plans" ON public.plans
    FOR SELECT
    USING (true);

-- Associa uma organização a um plano
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.plans(id);

-- Cria view ou helper para verificar limite de usuários (exemplo)
CREATE OR REPLACE FUNCTION public.fn_check_plan_limits()
RETURNS trigger AS $$
DECLARE
    v_plan_max_users integer;
    v_current_users integer;
BEGIN
    -- Busca limite
    SELECT p.max_users INTO v_plan_max_users
    FROM public.organizations o
    JOIN public.plans p ON p.id = o.plan_id
    WHERE o.id = NEW.organization_id;

    IF v_plan_max_users IS NULL THEN
        RETURN NEW; -- Sem plano = sem limite restrito nesta fase
    END IF;

    -- Conta usuários atuais
    SELECT count(*) INTO v_current_users
    FROM public.user_organizations
    WHERE organization_id = NEW.organization_id;

    IF v_current_users >= v_plan_max_users THEN
        RAISE EXCEPTION 'Limite de usuários excedido para o plano atual.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_check_plan_limits ON public.user_organizations;
CREATE TRIGGER tr_check_plan_limits
    BEFORE INSERT ON public.user_organizations
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_check_plan_limits();
