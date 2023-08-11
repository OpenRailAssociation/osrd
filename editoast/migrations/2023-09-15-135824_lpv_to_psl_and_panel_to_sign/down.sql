alter table infra alter column railjson_version set default '3.4.1';

update infra set railjson_version = '3.4.1';

alter table infra_layer_psl_sign rename to infra_layer_lpv_panel;

update infra_object_speed_section set data['extensions']['lpv_sncf'] = data['extensions']['psl_sncf'];

update infra_object_speed_section set data['extensions'] = data['extensions'] - 'psl_sncf';
