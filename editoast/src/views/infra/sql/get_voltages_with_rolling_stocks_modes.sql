WITH modes AS (
    SELECT key,
        value
    FROM osrd_infra_rollingstock AS r,
        jsonb_each(r.effort_curves->'modes')
)
SELECT DISTINCT modes.key AS voltage
FROM modes
WHERE (modes.value->>'is_electric')::boolean
UNION
SELECT DISTINCT ((data->'voltage')->>0) AS voltage
FROM osrd_infra_catenarymodel
WHERE infra_id = $1
ORDER BY voltage