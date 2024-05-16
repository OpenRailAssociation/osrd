WITH modes AS (
    SELECT key,
        value
    FROM rolling_stock,
        jsonb_each(rolling_stock.effort_curves->'modes')
)
SELECT DISTINCT modes.key AS voltage
FROM modes
WHERE (modes.value->>'is_electric')::boolean
UNION
SELECT DISTINCT ((data->'voltage')->>0) AS voltage
FROM infra_object_electrification
WHERE infra_id = $1
ORDER BY voltage
