ALTER TABLE infra_layer_error ADD info_hash varchar(40) NOT NULL DEFAULT 'undefined';
UPDATE infra_layer_error SET info_hash = id::text;
ALTER TABLE infra_layer_error ADD CONSTRAINT error_hash_unique UNIQUE (info_hash, infra_id);
