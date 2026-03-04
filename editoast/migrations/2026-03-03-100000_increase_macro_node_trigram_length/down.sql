UPDATE macro_node SET trigram = LEFT(trigram, 25) WHERE LENGTH(trigram) > 25;
ALTER TABLE macro_node ALTER COLUMN trigram TYPE varchar(25);
