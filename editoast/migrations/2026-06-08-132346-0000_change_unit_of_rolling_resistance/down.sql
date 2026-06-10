-- This file should undo anything in `up.sql`
UPDATE rolling_stock
SET
    rolling_resistance = jsonb_build_object(
        'type', rolling_resistance ->> 'type',
        'A', cast(rolling_resistance ->> 'A' AS numeric) * cast(mass as numeric),
        'B', cast(rolling_resistance ->> 'B' AS numeric) * cast(mass as numeric),
        'C', cast(rolling_resistance ->> 'C' AS numeric) * cast(mass as numeric)
    );
