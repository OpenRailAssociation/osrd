SELECT DISTINCT jsonb_object_keys(data->'speed_limit_by_tag') AS tag
FROM infra_object_speed_section
WHERE infra_id = $1
ORDER BY tag
