-- Renames the `id` field of each path item to `key`
UPDATE train_schedule
SET
    path = (
        SELECT
            jsonb_agg(jsonb_set(item, '{key}', item->'id') - 'id')
        FROM
            jsonb_array_elements(path) AS item
    );
