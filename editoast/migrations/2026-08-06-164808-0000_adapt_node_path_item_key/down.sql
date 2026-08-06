DELETE FROM macro_node WHERE path_item_key LIKE 'trigram:%';
UPDATE macro_node SET path_item_key = 'trigram:' || SUBSTRING(path_item_key, 13) WHERE path_item_key LIKE 'domestic:FR-%';
