CREATE OR REPLACE FUNCTION search_track__del_trig_fun() RETURNS trigger LANGUAGE plpgsql AS $function$ BEGIN
DELETE FROM search_track
WHERE search_track.infra_id = OLD.infra_id
    AND search_track.line_code = (OLD."data"#>>'{extensions,sncf,line_code}')::integer
    AND NOT EXISTS(
        SELECT NULL
        FROM infra_object_track_section AS model
        WHERE model.id <> OLD.id
            AND model.infra_id = OLD.infra_id
            AND model."data"#>>'{extensions,sncf,line_code}' = OLD."data"#>>'{extensions,sncf,line_code}'
        GROUP BY model."data"#>>'{extensions,sncf,line_code}'
    );
RETURN OLD;
END;
$function$;
