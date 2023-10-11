ALTER TABLE infra_layer_operational_point DROP COLUMN kp;
ALTER TABLE infra_layer_operational_point ADD CONSTRAINT infra_layer_operational_point_infra_id_obj_id_key UNIQUE (infra_id, obj_id);
