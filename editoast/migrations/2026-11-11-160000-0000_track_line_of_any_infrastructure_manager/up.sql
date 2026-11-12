-- A track section states its line in the extension of its infrastructure manager: `sncf`, or
-- any other key beside `source` (`db`, `sbb`, `oebb`, ...). `osrd_track_line_extension` returns
-- `sncf` if present, else the other one first by name.

CREATE OR REPLACE FUNCTION osrd_track_line_extension(data jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
AS $function$
-- an absent `sncf` is serialized as JSON null, which COALESCE does not skip
SELECT COALESCE(
        NULLIF(data->'extensions'->'sncf', 'null'::jsonb),
        (
            SELECT extension.value
            FROM jsonb_each(data->'extensions') AS extension
            WHERE extension.key NOT IN ('sncf', 'source')
            ORDER BY extension.key COLLATE "C"
            LIMIT 1
        )
    );
$function$
;
