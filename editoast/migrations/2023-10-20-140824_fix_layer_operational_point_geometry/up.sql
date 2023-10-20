ALTER TABLE infra_layer_operational_point
ALTER COLUMN geographic TYPE GEOMETRY(POINT, 3857) USING ST_SetSRID(ST_GeometryN(geographic, 1), 3857);
ALTER TABLE infra_layer_operational_point
ALTER COLUMN schematic TYPE GEOMETRY(POINT, 3857) USING ST_SetSRID(ST_GeometryN(schematic, 1), 3857);
