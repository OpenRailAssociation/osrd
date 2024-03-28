UPDATE infra_object_signal
SET data = jsonb_set(data, '{sight_distance}', '400.0')
WHERE '"TVM300"'::jsonb <@ jsonb_path_query_array(data, '$.logical_signals[*].signaling_system')
   OR '"TVM430"'::jsonb <@ jsonb_path_query_array(data, '$.logical_signals[*].signaling_system');
