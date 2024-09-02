UPDATE rolling_stock
SET effort_curves = REGEXP_REPLACE(effort_curves::text, '"AIR_CONDITIONING"', '"AC"', 'g')::jsonb;
