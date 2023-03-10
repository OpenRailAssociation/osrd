SELECT DISTINCT jsonb_object_keys(data->'speed_limit_by_tag') AS tag
FROM osrd_infra_speedsectionmodel
WHERE infra_id = %s
ORDER BY tag