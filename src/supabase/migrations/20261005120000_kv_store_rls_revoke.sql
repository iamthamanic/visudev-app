-- Harden kv_store_edf036ef: enable RLS and revoke PostgREST/anon/authenticated access.
-- Edge Functions keep access via the service_role key (bypasses RLS).
-- Location: src/supabase/migrations/20261005120000_kv_store_rls_revoke.sql

ALTER TABLE IF EXISTS public.kv_store_edf036ef ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated → deny all via RLS for those roles.
DROP POLICY IF EXISTS "kv_store_edf036ef_deny_all" ON public.kv_store_edf036ef;

REVOKE ALL ON TABLE public.kv_store_edf036ef FROM PUBLIC;
REVOKE ALL ON TABLE public.kv_store_edf036ef FROM anon;
REVOKE ALL ON TABLE public.kv_store_edf036ef FROM authenticated;

GRANT ALL ON TABLE public.kv_store_edf036ef TO service_role;

COMMENT ON TABLE public.kv_store_edf036ef IS
  'Key-value store for VisuDEV Edge Functions. RLS on; only service_role may access.';
