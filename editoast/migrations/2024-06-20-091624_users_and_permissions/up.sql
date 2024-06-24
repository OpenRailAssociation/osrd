-- Users and groups

create table authn_subject(
    id  bigserial primary key
);

create table authn_user(
    id           bigint primary key references authn_subject on delete cascade,
    identity_id  varchar(255) not null,
    name         text,
    unique (identity_id)
);

create table authn_group(
    id   bigint primary key references authn_subject on delete cascade,
    name text not null
);

create table authn_group_membership(
    id       bigserial primary key,
    "user"   bigint references authn_user  on delete cascade not null,
    "group"  bigint references authn_group on delete cascade not null,
    unique ("user", "group")
);

create function delete_associated_authn_subject()
returns trigger as $$
begin
    delete from authn_subject where id = old.id;
    return old;
end;
$$ language plpgsql;

create trigger authn_group_delete_trigger
before delete on authn_group
for each row
execute function delete_associated_authn_subject();

create trigger authn_user_delete_trigger
before delete on authn_user
for each row
execute function delete_associated_authn_subject();

-- Roles

create table authz_role(
    id       bigserial primary key,
    subject  bigint references authn_subject on delete cascade not null,
    role     varchar(255) not null, -- builtin role
    unique (subject, role)
);
