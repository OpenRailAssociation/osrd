drop trigger if exists authn_user_delete_trigger on authn_user;

create trigger authn_user_delete_trigger after
delete on authn_user
for each row execute function delete_associated_authn_subject ();
