DELETE FROM macro_node WHERE path_item_key LIKE 'trigram:%';
UPDATE macro_node SET path_item_key = 'trigram:' || SUBSTRING(path_item_key, 10, LENGTH(path_item_key) - 12) WHERE path_item_key LIKE 'domestic:%#__';
UPDATE macro_node SET trigram = SUBSTRING(trigram, 1, LENGTH(trigram) - 3) WHERE trigram LIKE '%#__';
