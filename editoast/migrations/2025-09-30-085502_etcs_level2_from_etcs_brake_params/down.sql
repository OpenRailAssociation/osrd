-- This file should undo anything in `up.sql`

UPDATE rolling_stock
SET supported_signaling_systems = supported_signaling_systems || ARRAY['ETCS_LEVEL2']
WHERE etcs_brake_params IS NOT NULL
  AND etcs_brake_params <> 'null'::jsonb
  AND NOT (supported_signaling_systems @> ARRAY['ETCS_LEVEL2']);
