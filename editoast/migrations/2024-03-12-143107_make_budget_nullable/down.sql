UPDATE study SET budget = COALESCE(budget, 0);
ALTER TABLE study ALTER COLUMN budget SET NOT NULL;

UPDATE project SET budget = COALESCE(budget, 0);
ALTER TABLE project ALTER COLUMN budget SET NOT NULL;
