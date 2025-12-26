CREATE TABLE authn_subject (
	id bigint PRIMARY KEY
);

INSERT INTO authn_subject (id)
SELECT id FROM authn_user
UNION
SELECT id FROM authn_group
ON CONFLICT DO NOTHING;

ALTER SEQUENCE authn_subject_id_seq OWNED BY authn_subject.id;

ALTER TABLE authn_user ADD CONSTRAINT authn_user_id_fkey FOREIGN KEY (id) REFERENCES authn_subject(id) ON DELETE CASCADE;
ALTER TABLE authn_group ADD CONSTRAINT authn_group_id_fkey FOREIGN KEY (id) REFERENCES authn_subject(id) ON DELETE CASCADE;

CREATE FUNCTION delete_associated_authn_subject()
RETURNS trigger AS $$
BEGIN
    DELETE FROM authn_subject WHERE id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER authn_group_delete_trigger
AFTER DELETE ON authn_group
FOR EACH ROW
EXECUTE FUNCTION delete_associated_authn_subject();

CREATE TRIGGER authn_user_delete_trigger
AFTER DELETE ON authn_user
FOR EACH ROW
EXECUTE FUNCTION delete_associated_authn_subject();

ALTER TABLE authn_user ALTER COLUMN id DROP DEFAULT;
ALTER TABLE authn_group ALTER COLUMN id DROP DEFAULT;
