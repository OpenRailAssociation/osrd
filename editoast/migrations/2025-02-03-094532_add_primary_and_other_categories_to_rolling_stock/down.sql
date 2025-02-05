ALTER TABLE rolling_stock
DROP COLUMN primary_category,
DROP COLUMN other_categories;

UPDATE rolling_stock SET railjson_version = '3.2';

DROP TYPE rolling_stock_category;
