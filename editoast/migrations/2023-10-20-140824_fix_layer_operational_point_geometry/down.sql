ALTER TABLE infra_layer_operational_point
ALTER COLUMN geographic TYPE GEOMETRY(MULTIPOINT, 3857) USING ST_Multi(geographic);
ALTER TABLE infra_layer_operational_point
ALTER COLUMN schematic TYPE GEOMETRY(MULTIPOINT, 3857) USING ST_Multi(schematic);
