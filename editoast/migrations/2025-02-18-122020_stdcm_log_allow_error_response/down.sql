DELETE FROM stdcm_logs WHERE response ? 'response' = FALSE;
UPDATE stdcm_logs SET response = response->'response';
