-- Der Runden-Scheduler nutzt SECURITY DEFINER Funktionen (Migration 0009),
-- die als kebapp_policy_executor direkt auf buying_rounds arbeiten. Dafuer
-- fehlten die Tabellenprivilegien (aclcheck: permission denied).

GRANT SELECT, UPDATE ON TABLE public.buying_rounds TO kebapp_policy_executor;
