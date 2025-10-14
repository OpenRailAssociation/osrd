ALTER TABLE stdcm_search_environment 
ALTER COLUMN active_perimeter DROP DEFAULT,
ALTER COLUMN active_perimeter DROP NOT NULL;

UPDATE stdcm_search_environment 
SET active_perimeter = NULL 
WHERE active_perimeter = 'null'::jsonb;
