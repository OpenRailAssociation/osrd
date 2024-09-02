UPDATE rolling_stock
SET effort_curves = REGEXP_REPLACE(effort_curves::text, '"AC"', '"AIR_CONDITIONING"', 'g')::jsonb;
