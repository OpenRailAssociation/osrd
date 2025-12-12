alter table authn_user add column identity_id varchar(255);

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

drop index if exists authn_user_identity_identity;
drop table if exists authn_user_identity;
