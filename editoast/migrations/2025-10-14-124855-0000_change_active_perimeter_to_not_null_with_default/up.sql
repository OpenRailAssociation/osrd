UPDATE stdcm_search_environment 
SET active_perimeter = 'null'::jsonb 
WHERE active_perimeter IS NULL;

ALTER TABLE stdcm_search_environment 
ALTER COLUMN active_perimeter SET NOT NULL,
ALTER COLUMN active_perimeter SET DEFAULT 'null'::jsonb;
