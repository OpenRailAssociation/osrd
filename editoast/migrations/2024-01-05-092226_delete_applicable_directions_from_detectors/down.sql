UPDATE infra_object_detector 
SET data = jsonb_set(data, '{applicable_directions}', '"BOTH"');

UPDATE infra
SET railjson_version = '3.4.6';
