CREATE TYPE rolling_stock_category AS ENUM (
    'HIGH_SPEED_TRAIN',
    'INTERCITY_TRAIN',
    'REGIONAL_TRAIN',
    'NIGHT_TRAIN',
    'COMMUTER_TRAIN',
    'FREIGHT_TRAIN',
    'FAST_FREIGHT_TRAIN',
    'TRAM_TRAIN',
    'TOURISTIC_TRAIN',
    'WORK_TRAIN'
);

ALTER TABLE rolling_stock
ADD COLUMN primary_category rolling_stock_category NOT NULL DEFAULT 'FREIGHT_TRAIN',
ADD COLUMN other_categories rolling_stock_category[] NOT NULL DEFAULT '{}';

UPDATE rolling_stock SET railjson_version = '3.3';
