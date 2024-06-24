drop table if exists authz_role;
drop table if exists authn_group_membership;
drop table if exists authn_group;
drop table if exists authn_user;
drop table if exists authn_subject;

drop function if exists delete_associated_authn_subject;
drop trigger if exists authn_group_delete_trigger ON authn_group;
drop trigger if exists authn_user_delete_trigger ON authn_user;
