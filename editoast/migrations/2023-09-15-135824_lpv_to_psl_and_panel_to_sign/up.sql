alter table infra alter column railjson_version set default '3.4.2';

update infra set railjson_version = '3.4.2';

alter table infra_layer_lpv_panel rename to infra_layer_psl_sign;

update infra_object_speed_section set data['extensions']['psl_sncf'] = data['extensions']['lpv_sncf'];

update infra_object_speed_section set data['extensions'] = data['extensions'] - 'lpv_sncf';
