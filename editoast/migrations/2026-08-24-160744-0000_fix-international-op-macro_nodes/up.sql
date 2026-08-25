-- delete like domestic:MES/BV#FR
-- macro_nodes created between 6th August and today will be lost, this is intentional
DELETE FROM macro_node WHERE path_item_key LIKE '%#FR' AND trigram LIKE '%#FR';

-- update (MES/BV, domestic:FR-MES/BV) -> (MES/BV#FR, domestic:MES/BV#FR)
UPDATE macro_node
SET
    path_item_key = REPLACE(path_item_key, 'domestic:FR-', 'domestic:') || '#FR',
    trigram = trigram || '#FR'
WHERE
    path_item_key LIKE 'domestic:FR-%'
