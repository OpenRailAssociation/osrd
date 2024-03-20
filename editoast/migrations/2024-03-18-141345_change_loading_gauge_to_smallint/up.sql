UPDATE rolling_stock
SET loading_gauge = CASE
        loading_gauge
        WHEN 'G1' THEN 0
        WHEN 'G2' THEN 1
        WHEN 'GA' THEN 2
        WHEN 'GB' THEN 3
        WHEN 'GB1' THEN 4
        WHEN 'GC' THEN 5
        WHEN 'FR3.3' THEN 6
        WHEN 'FR3.3/GB/G2' THEN 7
        WHEN 'GLOTT' THEN 8
    END;
    
ALTER TABLE rolling_stock
ALTER COLUMN loading_gauge TYPE smallint USING(loading_gauge::smallint);
