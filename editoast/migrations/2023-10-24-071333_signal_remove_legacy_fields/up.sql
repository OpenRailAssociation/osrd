-- Your SQL goes here
UPDATE infra_object_signal
SET data = data - 'linked_detector' #- '{extensions,sncf,aspects}'
    #- '{extensions,sncf,comment}'
    #- '{extensions,sncf,default_aspect}'
    #- '{extensions,sncf,installation_type}'
    #- '{extensions,sncf,is_in_service}'
    #- '{extensions,sncf,is_lightable}'
    #- '{extensions,sncf,is_operational}'
    #- '{extensions,sncf,support_type}'
    #- '{extensions,sncf,type_code}'
    #- '{extensions,sncf,value}';

ALTER TABLE infra ALTER column railjson_version SET DEFAULT '3.4.5';

UPDATE infra SET railjson_version = '3.4.5';
