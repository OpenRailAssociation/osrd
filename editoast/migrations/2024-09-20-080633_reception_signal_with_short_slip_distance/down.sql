-- rename train_schedule.schedule[*].reception_signal to on_stop_signal and
-- change "OPEN" to false, and the rest ("STOP" or "SHORT_SLIP_STOP") to true
UPDATE train_schedule
SET schedule = (SELECT jsonb_agg(
        CASE WHEN elem->'reception_signal' IS NOT NULL THEN
            jsonb_set(
                elem,
                '{on_stop_signal}',
                to_jsonb(CASE WHEN elem->>'reception_signal' = 'OPEN' THEN FALSE ELSE TRUE END),
                TRUE)
            #- '{reception_signal}'
        ELSE elem END
    )
    FROM jsonb_array_elements("schedule") elem
    )
WHERE schedule IS NOT NULL AND schedule::TEXT != '[]';
