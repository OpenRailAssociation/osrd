CREATE OR REPLACE FUNCTION {trigger}_fun()
    RETURNS TRIGGER
    LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO "{search_table}" (id, {insert_columns})
        SELECT "{source_table}".id AS id, {select_columns}
        FROM (SELECT NEW.*) AS "{source_table}"
        {joins};
    RETURN NEW;
END;
$$;
CREATE OR REPLACE TRIGGER {trigger}
AFTER INSERT ON "{source_table}"
FOR EACH ROW EXECUTE FUNCTION {trigger}_fun();
