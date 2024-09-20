-- Your SQL goes here
ALTER TABLE rolling_stock
ADD freight_compatible BOOLEAN NOT NULL DEFAULT FALSE;
