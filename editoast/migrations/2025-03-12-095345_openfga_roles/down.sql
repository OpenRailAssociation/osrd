-- Just like up.sql, no data migration is necessary.
create table authn_group_membership (
    id bigserial primary key,
    "user" bigint references authn_user on delete cascade not null,
    "group" bigint references authn_group on delete cascade not null,
    unique ("user", "group")
);

create table authz_role (
    id bigserial primary key,
    subject bigint references authn_subject on delete cascade not null,
    role varchar(255) not null, -- builtin role
    unique (subject, role)
);

alter table authn_user
alter column name
drop not null;
