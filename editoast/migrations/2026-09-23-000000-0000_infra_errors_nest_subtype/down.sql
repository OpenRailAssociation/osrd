UPDATE infra_layer_error
SET information = (information - 'sub_type') || information->'sub_type'
WHERE information ? 'sub_type';
