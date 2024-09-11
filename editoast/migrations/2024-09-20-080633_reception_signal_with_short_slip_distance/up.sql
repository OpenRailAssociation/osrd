-- rename train_schedule.schedule[*].on_stop_signal to reception_signal and
-- change false/true to respectively "OPEN"/"STOP" (not using "SHORT_SLIP_STOP")
UPDATE train_schedule
SET schedule = (SELECT jsonb_agg(
        CASE WHEN elem->'on_stop_signal' IS NOT NULL THEN
            jsonb_set(
                elem,
                '{reception_signal}',
                to_jsonb(CASE WHEN bool(elem->>'on_stop_signal') = TRUE THEN 'STOP' ELSE 'OPEN' END),
                TRUE)
            #- '{on_stop_signal}'
        ELSE elem END
    )
    FROM jsonb_array_elements("schedule") elem
    )
WHERE schedule IS NOT NULL AND schedule::TEXT != '[]';
