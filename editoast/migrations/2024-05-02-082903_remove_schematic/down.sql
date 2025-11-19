ALTER TABLE "infra_layer_buffer_stop" ADD COLUMN "schematic" GEOMETRY;
ALTER TABLE "infra_layer_detector" ADD COLUMN "schematic" GEOMETRY;
ALTER TABLE "infra_layer_electrification" ADD COLUMN "schematic" GEOMETRY;
ALTER TABLE "infra_layer_error" ADD COLUMN "schematic" GEOMETRY;
ALTER TABLE "infra_layer_neutral_section" ADD COLUMN "schematic" GEOMETRY;
ALTER TABLE "infra_layer_neutral_sign" ADD COLUMN "schematic" GEOMETRY;
ALTER TABLE "infra_layer_operational_point" ADD COLUMN "schematic" GEOMETRY;
ALTER TABLE "infra_layer_psl_sign" ADD COLUMN "schematic" GEOMETRY;
ALTER TABLE "infra_layer_signal" ADD COLUMN "schematic" GEOMETRY;
ALTER TABLE "infra_layer_speed_section" ADD COLUMN "schematic" GEOMETRY;
ALTER TABLE "infra_layer_switch" ADD COLUMN "schematic" GEOMETRY;
ALTER TABLE "infra_layer_track_section" ADD COLUMN "schematic" GEOMETRY;
ALTER TABLE "pathfinding" ADD COLUMN "schematic" GEOMETRY;
ALTER TABLE "infra_layer_neutral_sign" ADD COLUMN "angle_sch" DOUBLE PRECISION;
ALTER TABLE "infra_layer_psl_sign" ADD COLUMN "angle_sch" DOUBLE PRECISION;
ALTER TABLE "infra_layer_signal" ADD COLUMN "angle_sch" DOUBLE PRECISION;

UPDATE "infra_layer_buffer_stop" SET "schematic" = "geographic";
UPDATE "infra_layer_detector" SET "schematic" = "geographic";
UPDATE "infra_layer_electrification" SET "schematic" = "geographic";
UPDATE "infra_layer_error" SET "schematic" = "geographic";
UPDATE "infra_layer_neutral_section" SET "schematic" = "geographic";
UPDATE "infra_layer_neutral_sign" SET "schematic" = "geographic";
UPDATE "infra_layer_operational_point" SET "schematic" = "geographic";
UPDATE "infra_layer_psl_sign" SET "schematic" = "geographic";
UPDATE "infra_layer_signal" SET "schematic" = "geographic";
UPDATE "infra_layer_speed_section" SET "schematic" = "geographic";
UPDATE "infra_layer_switch" SET "schematic" = "geographic";
UPDATE "infra_layer_track_section" SET "schematic" = "geographic";
UPDATE "pathfinding" SET "schematic" = "geographic";
UPDATE "infra_layer_neutral_sign" SET "angle_sch" = "angle_geo";
UPDATE "infra_layer_signal" SET "angle_sch" = "angle_geo";
UPDATE "infra_layer_psl_sign" SET "angle_sch" = "angle_geo";

ALTER TABLE "infra_layer_buffer_stop" ALTER COLUMN "schematic" SET NOT NULL;
ALTER TABLE "infra_layer_detector" ALTER COLUMN "schematic" SET NOT NULL;
ALTER TABLE "infra_layer_electrification" ALTER COLUMN "schematic" SET NOT NULL;
ALTER TABLE "infra_layer_error" ALTER COLUMN "schematic" SET NOT NULL;
ALTER TABLE "infra_layer_neutral_section" ALTER COLUMN "schematic" SET NOT NULL;
ALTER TABLE "infra_layer_neutral_sign" ALTER COLUMN "schematic" SET NOT NULL;
ALTER TABLE "infra_layer_operational_point" ALTER COLUMN "schematic" SET NOT NULL;
ALTER TABLE "infra_layer_psl_sign" ALTER COLUMN "schematic" SET NOT NULL;
ALTER TABLE "infra_layer_signal" ALTER COLUMN "schematic" SET NOT NULL;
ALTER TABLE "infra_layer_speed_section" ALTER COLUMN "schematic" SET NOT NULL;
ALTER TABLE "infra_layer_switch" ALTER COLUMN "schematic" SET NOT NULL;
ALTER TABLE "infra_layer_track_section" ALTER COLUMN "schematic" SET NOT NULL;
ALTER TABLE "pathfinding" ALTER COLUMN "schematic" SET NOT NULL;
ALTER TABLE "infra_layer_neutral_sign" ALTER COLUMN "angle_sch" SET NOT NULL;
ALTER TABLE "infra_layer_psl_sign" ALTER COLUMN "angle_sch" SET NOT NULL;
ALTER TABLE "infra_layer_signal" ALTER COLUMN "angle_sch" SET NOT NULL;

UPDATE infra_object_track_section
SET data = data || jsonb_build_object('sch', data->'geo');

UPDATE infra
SET railjson_version = '3.4.11';

ALTER TABLE infra
ALTER COLUMN railjson_version
SET DEFAULT '3.4.11';
