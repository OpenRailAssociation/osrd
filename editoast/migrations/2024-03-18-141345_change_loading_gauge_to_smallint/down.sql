ALTER TABLE rolling_stock ALTER COLUMN loading_gauge TYPE varchar(16);

UPDATE rolling_stock
SET loading_gauge =
    CASE loading_gauge
        WHEN '0' THEN 'G1'
        WHEN '1' THEN 'G2'
        WHEN '2' THEN 'GA'
        WHEN '3' THEN 'GB'
        WHEN '4' THEN 'GB1'
        WHEN '5' THEN 'GC'
        WHEN '6' THEN 'FR3.3'
        WHEN '7' THEN 'FR3.3/GB/G2'
        WHEN '8' THEN 'GLOTT'
    END;
