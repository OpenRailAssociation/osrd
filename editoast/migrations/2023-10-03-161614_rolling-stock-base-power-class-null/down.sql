-- This file should undo anything in `up.sql`
alter table rolling_stock 
	drop constraint base_power_class_null_or_non_empty;

update
	rolling_stock
set
	base_power_class = ''
where
	base_power_class is null;

alter table rolling_stock alter column base_power_class set not null;
