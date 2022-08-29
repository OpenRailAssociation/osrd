SELECT DISTINCT (data->'voltage')::float AS voltage
FROM osrd_infra_catenarymodel
WHERE infra_id = %s
ORDER BY voltage