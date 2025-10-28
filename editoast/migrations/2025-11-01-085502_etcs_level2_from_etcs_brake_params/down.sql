UPDATE rolling_stock
    SET supported_signaling_systems = array_append(supported_signaling_systems, 'ETCS_LEVEL2')
WHERE etcs_brake_params IS NOT NULL
  AND etcs_brake_params <> 'null'::jsonb
  AND NOT (supported_signaling_systems @> ARRAY['ETCS_LEVEL2']);
