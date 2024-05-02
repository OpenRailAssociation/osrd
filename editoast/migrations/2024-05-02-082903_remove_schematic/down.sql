ALTER TABLE "infra_layer_buffer_stop" ADD COLUMN "schematic" GEOMETRY NOT NULL;
ALTER TABLE "infra_layer_detector" ADD COLUMN "schematic" GEOMETRY NOT NULL;
ALTER TABLE "infra_layer_electrification" ADD COLUMN "schematic" GEOMETRY NOT NULL;
ALTER TABLE "infra_layer_error" ADD COLUMN "schematic" GEOMETRY;
ALTER TABLE "infra_layer_neutral_section" ADD COLUMN "schematic" GEOMETRY NOT NULL;
ALTER TABLE "infra_layer_neutral_sign" ADD COLUMN "schematic" GEOMETRY NOT NULL;
ALTER TABLE "infra_layer_operational_point" ADD COLUMN "schematic" GEOMETRY NOT NULL;
ALTER TABLE "infra_layer_psl_sign" ADD COLUMN "schematic" GEOMETRY NOT NULL;
ALTER TABLE "infra_layer_signal" ADD COLUMN "schematic" GEOMETRY NOT NULL;
ALTER TABLE "infra_layer_speed_section" ADD COLUMN "schematic" GEOMETRY NOT NULL;
ALTER TABLE "infra_layer_switch" ADD COLUMN "schematic" GEOMETRY NOT NULL;
ALTER TABLE "infra_layer_track_section" ADD COLUMN "schematic" GEOMETRY NOT NULL;
ALTER TABLE "pathfinding" ADD COLUMN "schematic" GEOMETRY NOT NULL;
ALTER TABLE "infra_layer_neutral_sign" ADD COLUMN "angle_sch" DOUBLE PRECISION NOT NULL;
ALTER TABLE "infra_layer_psl_sign" ADD COLUMN "angle_sch" DOUBLE PRECISION NOT NULL;
ALTER TABLE "infra_layer_signal" ADD COLUMN "angle_sch" DOUBLE PRECISION NOT NULL;

UPDATE infra_object_track_section
SET data = data || jsonb_build_object('sch', data->'geo');

UPDATE infra
SET railjson_version = '3.4.11';

ALTER TABLE infra
ALTER COLUMN railjson_version
SET DEFAULT '3.4.11';
