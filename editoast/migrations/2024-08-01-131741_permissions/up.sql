-- this table is a template, which other grant tables are
-- designed to be created from. it must be kept empty.
create table authz_template_grant(
  -- if subject is null, this grant applies to any subject
  subject     bigint primary key references authn_subject on delete cascade,
  "grant"     bigint not null,
  granted_by  bigint references authn_user on delete set null,
  granted_at  timestamp not null default CURRENT_TIMESTAMP
);

-- raise an error if grants are inserted into the template
create function authz_grant_insert_error() RETURNS trigger AS $err$
    BEGIN
        RAISE EXCEPTION 'authz_grant is a template, which other grant '
        'tables are designed to inherit from. it must be kept empty.';
    END;
$err$ LANGUAGE plpgsql;

create trigger authz_grant_insert_in_template
before insert on authz_template_grant
for each statement
execute function authz_grant_insert_error();

-- these indices speed up cascade deletes
create index on authz_template_grant(subject);
create index on authz_template_grant(granted_by);

-- create a new grant table for EXAMPLE
-- create table authz_grant_EXAMPLE (
--   like authz_template_grant including all,
--   resource bigint references EXAMPLE on delete cascade not null,
--   unique nulls not distinct (resource, subject),
-- );

-- create a new grant table for groups
create table authz_grant_authn_group (
  like authz_template_grant including all,
  resource bigint references authn_group on delete cascade not null,
  unique nulls not distinct (resource, subject)
);
