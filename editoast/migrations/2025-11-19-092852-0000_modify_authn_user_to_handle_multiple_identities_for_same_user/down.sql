drop trigger check_authn_user_has_at_least_one_identity_after_delete on authn_user;
drop function check_user_has_at_least_one_identity_after_delete;
drop trigger authn_user_delete_trigger on authn_user_identity;
drop function delete_associated_authn_user;
drop trigger check_authn_user_identity_update on authn_user_identity;
drop function check_authn_user_identity_update_does_not_leave_user_without_identity;

alter table authn_user add column identity_id varchar(255);

-- Keep the oldest identity for each user on migration revert.
-- Done in order to improve the developers quality of life: applying
-- and then rolling back the migration will leave their user identities
-- in the same state as before.
update authn_user
set identity_id =  (
    select identity
    from authn_user_identity
    where authn_user.id = authn_user_identity.user_id
    order by authn_user_identity.id asc
    limit 1
);

alter table authn_user add unique (identity_id);
alter table authn_user alter column identity_id set not null;

drop index idx_authn_user_identity_user_id;
drop table authn_user_identity;
