DELETE FROM macro_node WHERE path_item_key LIKE 'domestic:FR-%';
UPDATE macro_node SET path_item_key = 'domestic:FR-' || SUBSTRING(path_item_key, 9) WHERE path_item_key LIKE 'trigram:%';
