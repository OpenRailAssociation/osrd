SELECT DISTINCT ((data->'voltage')->>0) AS voltage
FROM osrd_infra_catenarymodel
WHERE infra_id = $1
ORDER BY voltage