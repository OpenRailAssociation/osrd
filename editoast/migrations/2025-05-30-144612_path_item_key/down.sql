UPDATE train_schedule
SET
    path = (
        SELECT
            jsonb_agg(jsonb_set(item, '{id}', item->'key') - 'key')
        FROM
            jsonb_array_elements(path) AS item
    );
