-- This file should undo anything in `up.sql`
UPDATE infra_object_operational_point SET data = jsonb_set(data, '{extensions, sncf, kp}', '""');
