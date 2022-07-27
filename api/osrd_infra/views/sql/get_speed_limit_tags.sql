SELECT jsonb_object_keys(data->'speed_limit_by_tag') AS tag
FROM osrd_infra_speedsectionmodel
WHERE infra_id = %s
GROUP BY tag
ORDER BY tag