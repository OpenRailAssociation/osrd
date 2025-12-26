DROP TRIGGER IF EXISTS authn_user_delete_trigger ON authn_user;
DROP TRIGGER IF EXISTS authn_group_delete_trigger ON authn_group;
DROP FUNCTION IF EXISTS delete_associated_authn_subject() CASCADE;
ALTER SEQUENCE IF EXISTS authn_subject_id_seq OWNED BY NONE;
ALTER TABLE authn_group DROP CONSTRAINT IF EXISTS authn_group_id_fkey;
ALTER TABLE authn_user DROP CONSTRAINT IF EXISTS authn_user_id_fkey;
DROP TABLE IF EXISTS authn_subject;
ALTER TABLE authn_user ALTER COLUMN id SET DEFAULT nextval('authn_subject_id_seq');
ALTER TABLE authn_group ALTER COLUMN id SET DEFAULT nextval('authn_subject_id_seq');
