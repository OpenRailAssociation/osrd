CREATE OR REPLACE FUNCTION {trigger}_fun()
    RETURNS TRIGGER
    LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE "{search_table}"
        SET {set_columns}
        FROM (SELECT NEW.*) AS "{source_table}"
        {joins}
        WHERE "{source_table}".id = "{search_table}".id;
    RETURN NEW;
END;
$$;
CREATE OR REPLACE TRIGGER {trigger}
AFTER UPDATE ON "{source_table}"
FOR EACH ROW EXECUTE FUNCTION {trigger}_fun();
