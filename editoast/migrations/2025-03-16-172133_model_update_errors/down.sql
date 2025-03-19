ALTER TABLE project ADD CONSTRAINT project_image_id_key UNIQUE (image_id);

ALTER TABLE project
DROP CONSTRAINT IF EXISTS project_image_id_fkey;

ALTER TABLE project ADD CONSTRAINT project_image_id_fkey FOREIGN KEY (image_id) REFERENCES document (id) DEFERRABLE INITIALLY DEFERRED;
