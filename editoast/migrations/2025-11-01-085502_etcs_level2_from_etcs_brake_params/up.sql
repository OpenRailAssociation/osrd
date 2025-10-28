UPDATE rolling_stock
    SET supported_signaling_systems = array_remove(supported_signaling_systems, 'ETCS_LEVEL2')
WHERE supported_signaling_systems @> ARRAY['ETCS_LEVEL2'];
