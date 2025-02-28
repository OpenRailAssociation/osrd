-- Roles and group membership are now stored in OpenFGA. No data migration is neceseary as
-- we'll recreate the roles from scratch.
drop table if exists authn_group_membership;

drop table if exists authz_role;

-- Makes `name` column not nullable as it doesn't make sense
update authn_user
set
    name = '<not provided>'
where
    name is null;

alter table authn_user
alter column name
set
    not null;
