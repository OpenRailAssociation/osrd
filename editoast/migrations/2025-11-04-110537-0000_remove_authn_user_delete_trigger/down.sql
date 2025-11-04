create function delete_associated_authn_subject()
returns trigger as $$
begin
    delete from authn_subject where id = old.id;
    return old;
end;
$$ language plpgsql;

create trigger authn_user_delete_trigger before
delete on authn_user
for each row execute function delete_associated_authn_subject ();
