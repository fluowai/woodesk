-- 0245: mantém o vocabulário do banco alinhado aos workers Woodesk.
alter table public.job_queue drop constraint if exists job_queue_kind_check;
alter table public.job_queue add constraint job_queue_kind_check
  check (kind in ('inbound_turn','followup_turn','watchdog','flywheel','case_reply_turn','operator_turn','transactional_delivery','approved_reply','lead_finder_search','local_seo_grid','voice_call','lead_enrichment','agent_task','campaign_execution','google_business_sync'));
