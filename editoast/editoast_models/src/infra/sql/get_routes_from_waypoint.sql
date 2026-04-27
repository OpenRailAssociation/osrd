SELECT routes.obj_id as route_id,
    TRUE as is_entry_point
from infra_object_route as routes
where infra_id = $1
    and routes.data->'entry_point'->>'id' = $2
    AND routes.data->'entry_point'->>'type' = $3
UNION
SELECT routes.obj_id as route_id,
    FALSE as is_entry_point
from infra_object_route as routes
where infra_id = $1
    and routes.data->'exit_point'->>'id' = $2
    AND routes.data->'exit_point'->>'type' = $3
