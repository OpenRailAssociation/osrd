SELECT DISTINCT ((data->'voltage')->>0) AS voltage
FROM infra_object_catenary
WHERE infra_id = $1
ORDER BY voltage
