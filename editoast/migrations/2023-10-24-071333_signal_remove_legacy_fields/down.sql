UPDATE infra_object_signal SET data = jsonb_set(data, '{extensions, sncf, aspects}', '[]');
UPDATE infra_object_signal SET data = jsonb_set(data, '{extensions, sncf, comment}', '""');
UPDATE infra_object_signal SET data = jsonb_set(data, '{extensions, sncf, default_aspect}', '""');
UPDATE infra_object_signal SET data = jsonb_set(data, '{extensions, sncf, installation_type}', '""');
UPDATE infra_object_signal SET data = jsonb_set(data, '{extensions, sncf, is_in_service}', 'false');
UPDATE infra_object_signal SET data = jsonb_set(data, '{extensions, sncf, is_lightable}', 'false');
UPDATE infra_object_signal SET data = jsonb_set(data, '{extensions, sncf, is_operational}', 'false');
UPDATE infra_object_signal SET data = jsonb_set(data, '{extensions, sncf, support_type}', '""');
UPDATE infra_object_signal SET data = jsonb_set(data, '{extensions, sncf, type_code}', '""');
UPDATE infra_object_signal SET data = jsonb_set(data, '{extensions, sncf, value}', '""');

ALTER TABLE infra ALTER column railjson_version SET DEFAULT '3.4.4';

UPDATE infra SET railjson_version = '3.4.4';
