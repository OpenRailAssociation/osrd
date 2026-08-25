UPDATE macro_node
SET
    path_item_key = REPLACE(path_item_key, '#FR', ''),
    trigram = REPLACE(trigram, '#FR', '')
WHERE
    path_item_key LIKE 'domestic:%#FR' AND
    trigram LIKE '%#FR';

UPDATE macro_node
SET
    path_item_key = REPLACE(path_item_key, 'domestic:', 'domestic:FR-'),
    trigram = REPLACE(trigram, '#FR', '')
WHERE
    path_item_key LIKE 'domestic:%' AND
    trigram LIKE '%#FR' AND
    path_item_key NOT LIKE 'domestic:%#FR';
