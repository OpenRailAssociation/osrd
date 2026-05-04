-- This file should undo anything in `up.sql`
UPDATE infra_object_operational_point SET data = data - 'plc';
UPDATE infra SET railjson_version = '3.5.1';
