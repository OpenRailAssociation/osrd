WITH errors AS (
    SELECT unnest($2) as speed_id,
        unnest($3) as information
)
INSERT INTO osrd_infra_errorlayer (
        infra_id,
        obj_id,
        obj_type,
        geographic,
        schematic,
        information
    )
SELECT $1 as infra_id,
    errors.speed_id as obj_id,
    'SpeedSection' as obj_type,
    speeds.geographic,
    speeds.schematic,
    errors.information
FROM errors
    LEFT JOIN osrd_infra_speedsectionlayer AS speeds ON speeds.obj_id = errors.speed_id
    AND speeds.infra_id = $1