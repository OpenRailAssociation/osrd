-- Your SQL goes here
alter table rolling_stock alter column base_power_class drop not null;

update
	rolling_stock
set
	base_power_class = null
where
	base_power_class = '';

alter table rolling_stock
  add constraint base_power_class_null_or_non_empty check (base_power_class is null
	or length(base_power_class) > 0);
