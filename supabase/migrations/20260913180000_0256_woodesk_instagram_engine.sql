-- 0256 — engine explícito para sessões Instagram Graph.

alter table public.channel_sessions
  drop constraint if exists channel_sessions_engine_check;
alter table public.channel_sessions
  add constraint channel_sessions_engine_check
  check (engine = any (array['NOWEB'::text, 'WEBJS'::text, 'INSTAGRAM_GRAPH'::text]));
