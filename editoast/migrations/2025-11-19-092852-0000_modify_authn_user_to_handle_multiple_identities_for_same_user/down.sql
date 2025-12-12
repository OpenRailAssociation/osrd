drop trigger check_authn_user_has_at_least_one_identity_after_delete on authn_user;
drop function check_user_has_at_least_one_identity_after_delete;
drop trigger authn_user_delete_trigger on authn_user_identity;
drop function delete_associated_authn_user;
drop trigger check_authn_user_identity_update on authn_user_identity;
drop function check_authn_user_identity_update_does_not_leave_user_without_identity;

alter table authn_user add column identity_id varchar(255);

-- Small hack that prevents having to either delete the users or
-- invent them new identities on revert. It is done for development
-- purposes: reverting that migration will delete identities on any
-- user which has several identities.
update authn_user
set identity_id = identities.identity
from (
    select user_id, any_value(identity) as identity
    from authn_user_identity
    group by user_id
) identities
where identities.user_id = authn_user.id;

alter table authn_user add unique (identity_id);
alter table authn_user alter column identity_id set not null;

drop index idx_authn_user_identity_user_id;
drop table authn_user_identity;
