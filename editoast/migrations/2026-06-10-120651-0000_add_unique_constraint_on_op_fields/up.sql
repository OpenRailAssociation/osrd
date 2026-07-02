-- Your SQL goes here
UPDATE infra_object_operational_point
SET data = jsonb_set(data, '{main_code}', data->'id')
WHERE data->>'main_code' = '???';

-- The overtake PR has an id following this pattern
-- "id" : "OVERTAKE_1_2_A;Strasbourg"
-- The new secondary code will retrieve : OVERTAKE_{op_number}_{direction}
-- "secondary_code" : "OVERTAKE_1_A"
UPDATE infra_object_operational_point
SET data = jsonb_set(data, '{secondary_code}', to_jsonb(CONCAT('OVERTAKE_', split_part(data->>'id', '_', 2), '_', split_part(split_part(data->>'id', '_', 4), ';', 1))))
WHERE data->>'secondary_name' = 'OVERTAKE';

CREATE SEQUENCE secondary_code_seq;
UPDATE infra_object_operational_point i
-- Add an integer as suffix to secondary code to the duplicated domestic codes
SET data = jsonb_set(data, '{secondary_code}', to_jsonb(CONCAT(COALESCE(data->>'secondary_code', 'secondary_code'), '_', nextval('secondary_code_seq'))))
FROM (
     SELECT infra_id,
     data->>'main_code' AS main_code,
     data->>'secondary_code' AS secondary_code,
     data->>'country_code' AS country_code
     FROM infra_object_operational_point
     GROUP BY infra_id,
     data->>'main_code',
     data->>'secondary_code',
     data->>'country_code'
     HAVING COUNT(*) > 1) AS duplicates
WHERE i.infra_id = duplicates.infra_id
     AND i.data->>'main_code' IS NOT DISTINCT FROM duplicates.main_code
     AND i.data->>'secondary_code' IS NOT DISTINCT FROM duplicates.secondary_code
     AND i.data->>'country_code' IS NOT DISTINCT FROM duplicates.country_code;
DROP SEQUENCE secondary_code_seq;

CREATE SEQUENCE secondary_code_seq;
UPDATE infra_object_operational_point i
-- Add an integer as suffix to secondary code to the duplicated uic codes
SET data = jsonb_set(data, '{secondary_code}', to_jsonb(CONCAT(COALESCE(data->>'secondary_code', 'secondary_code'), '_', nextval('secondary_code_seq'))))
FROM (
     SELECT infra_id,
     data->>'uic' AS uic,
     data->>'secondary_code' AS secondary_code
     FROM infra_object_operational_point
     GROUP BY infra_id,
     data->>'uic',
     data->>'secondary_code'
     HAVING COUNT(*) > 1) AS duplicates
WHERE i.infra_id = duplicates.infra_id
     AND i.data->>'uic' IS NOT DISTINCT FROM duplicates.uic
     AND i.data->>'secondary_code' IS NOT DISTINCT FROM duplicates.secondary_code;
DROP SEQUENCE secondary_code_seq;

CREATE UNIQUE INDEX domestic_unique_index ON infra_object_operational_point(infra_id, (data->>'country_code'), (data->>'main_code'), (data->>'secondary_code')) NULLS NOT DISTINCT;
CREATE UNIQUE INDEX uic_unique_index ON infra_object_operational_point(infra_id, (data->>'uic'), (data->>'secondary_code'));
CREATE UNIQUE INDEX plc_unique_index ON infra_object_operational_point(infra_id, (data->>'plc'));
