-- Allows two different projects to use the same image
ALTER TABLE project
DROP CONSTRAINT project_image_id_key;

-- Prevents an image from being deleted if it is used by a project
ALTER TABLE project
DROP CONSTRAINT IF EXISTS project_image_id_fkey;

ALTER TABLE project ADD CONSTRAINT project_image_id_fkey FOREIGN KEY (image_id) REFERENCES document (id) ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
