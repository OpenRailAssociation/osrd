ALTER TABLE "infra_layer_buffer_stop" DROP COLUMN "schematic";
ALTER TABLE "infra_layer_detector" DROP COLUMN "schematic";
ALTER TABLE "infra_layer_electrification" DROP COLUMN "schematic";
ALTER TABLE "infra_layer_error" DROP COLUMN "schematic";
ALTER TABLE "infra_layer_neutral_section" DROP COLUMN "schematic";
ALTER TABLE "infra_layer_neutral_sign" DROP COLUMN "schematic";
ALTER TABLE "infra_layer_operational_point" DROP COLUMN "schematic";
ALTER TABLE "infra_layer_psl_sign" DROP COLUMN "schematic";
ALTER TABLE "infra_layer_signal" DROP COLUMN "schematic";
ALTER TABLE "infra_layer_speed_section" DROP COLUMN "schematic";
ALTER TABLE "infra_layer_switch" DROP COLUMN "schematic";
ALTER TABLE "infra_layer_track_section" DROP COLUMN "schematic";
ALTER TABLE "pathfinding" DROP COLUMN "schematic";
ALTER TABLE "infra_layer_neutral_sign" DROP COLUMN "angle_sch";
ALTER TABLE "infra_layer_psl_sign" DROP COLUMN "angle_sch";
ALTER TABLE "infra_layer_signal" DROP COLUMN "angle_sch";

ALTER TABLE infra_object_track_section DISABLE TRIGGER search_track__upd_trig;
UPDATE infra_object_track_section
SET data = data - 'sch';
ALTER TABLE infra_object_track_section ENABLE TRIGGER search_track__upd_trig;

UPDATE infra
SET railjson_version = '3.4.12';

ALTER TABLE infra
ALTER COLUMN railjson_version
SET DEFAULT '3.4.12';
